# Forensic Learning Record (Deep Inspection): modu-ai/moai-adk

> **Canonical Artifact**: `07_PROJECT_LEARNING/modu-ai-moai-adk-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/modu-ai/moai-adk](https://github.com/modu-ai/moai-adk))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:34:54.386Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `modu-ai/moai-adk`
- **Description**: Agentic development harness for Claude Code — SPEC-driven plan/run/sync, TRUST 5 quality gates, model+effort routing, and Claude×GLM multi-LLM cost control. Single Go binary, 16 languages, zero deps.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 1231 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.claude/skills/moai-domain-svg-infographic/scripts/render.mjs`
```
#!/usr/bin/env node
// Canonical headless-Chromium renderer for SVG infographics.
//
// Runs on the Node 18+ standard library alone: no package install and no
// bundled browser. It locates a Chromium-family executable already present on
// the machine, discloses exactly which one it used and that browser's version,
// renders the SVG at an integer multiple of its viewBox, then verifies the
// written PNG by reading the dimensions out of the file's own IHDR header.
//
// Usage:
//   node render.mjs <file.svg> [options]
//
// Options:
//   --out <file.png>   output path (default: the input path with a .png suffix)
//   --scale <n>        integer scale factor applied to the viewBox (default 2)
//   --browser <path>   explicit browser executable, skipping discovery
//   --transparent      keep the page background transparent (default is white)
//   --no-sandbox       pass --no-sandbox; needed inside some containers
//   --timeout <ms>     virtual time budget handed to the browser (default 15000)
//   --json             emit machine-readable JSON instead of text
//   --help             print this usage block
//
// Exit codes:
//   0  PNG written and its IHDR dimensions match the requested target
//   1  render failed, or the written PNG did not match the target
//   2  no headless browser could be found  (the graceful-degradation signal:
//      deliver the editable SVG alone and state that no PNG was produced)
//   3  usage error, or the input could not be read

import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync, openSync, readSync, closeSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir, platform } from 'node:os';
import { join, resolve, dirname, basename, extname } from 'node:path';
import { pathToFileURL } from 'node:url';

// ---------------------------------------------------------------------------
// Argument handling
// ---------------------------------------------------------------------------

const USAGE = [
  'Usage: node render.mjs <file.svg> [--out <file.png>] [--scale <n>] [--browser <path>]',
  '                      [--transparent] [--no-sandbox] [--timeout <ms>] [--json]',
  '',
  'Renders an SVG to PNG through a headless Chromium-family browser and verifies',
  'the result against the requested target size.',
  'Exit 0 = verified, 1 = render/verify failure, 2 = no browser found, 3 = usage error.',
].join('\n');

function parseArgs(argv) {
  const opts = {
    input: null,
    out: null,
    scale: 2,
    browser: null,
    transparent: false,
    noSandbox: false,
    timeout: 15000,
    json: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--json') opts.json = true;
    else if (a === '--transparent') opts.transparent = true;
    else if (a === '--no-sandbox') opts.noSandbox = true;
    else if (a === '--out') opts.out = argv[++i];
    else if (a === '--browser') opts.browser = argv[++i];
    else if (a === '--scale') opts.scale = Number(argv[++i]);
    else if (a === '--timeout') opts.timeout = Number(argv[++i]);
    else if (a.startsWith('-')) return { error: `unknown option: ${a}` };
    else if (opts.input === null) opts.input = a;
    else return { error: `unexpected extra argument: ${a}` };
  }
  if (opts.help) return opts;
  if (opts.input === null) return { error: 'missing <file.svg>' };
  if (!Number.isInteger(opts.scale) || opts.scale < 1) return { error: '--scale expects a positive integer' };
  if (!Number.isFinite(opts.timeout) || opts.timeout < 1) return { error: '--timeout expects a positive number of milliseconds' };
  return opts;
}

// ---------------------------------------------------------------------------
// Browser discovery and version disclosure
// ---------------------------------------------------------------------------

const CANDIDATE_PATHS = {
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  ],
  linux: [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/microsoft-edge',
    '/snap/bin/chromium',
  ],
  win32: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ],
};

const PATH_NAMES = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge', 'msedge'];

function browserVersion(exe) {
  const probe = spawnSync(exe, ['--version'], { encoding: 'utf8', timeout: 10000 });
  if (probe.status !== 0 || !probe.stdout) return null;
  return probe.stdout.trim();
}

function discoverBrowser(explicit) {
  if (explicit) {
    if (!existsSync(explicit)) return { error: `--browser path does not exist: ${explicit}` };
    const version = browserVersion(explicit);
    if (version === null) return { error: `--browser path is not an executable browser: ${explicit}` };
    return { executable: explicit, version, source: 'explicit --browser flag' };
  }

  for (const key of ['CHROME_PATH', 'CHROMIUM_PATH', 'BROWSER_PATH']) {
    const fromEnv = process.env[key];
    if (fromEnv && existsSync(fromEnv)) {
      const version = browserVersion(fromEnv);
      if (version !== null) return { executable: fromEnv, version, source: `environment variable ${key}` };
    }
  }

  for (const candidate of CANDIDATE_PATHS[platform()] ?? []) {
    if (!existsSync(candidate)) continue;
    const version = browserVersion(candidate);
    if (version !== null) return { executable: candidate, version, source: 'well-known install location' };
  }

  const lookup = platform() === 'win32' ? 'where' : 'which';
  for (const name of PATH_NAMES) {
    const found = spawnSync(lookup, [name], { encoding: 'utf8', timeout: 10000 });
    if (found.status !== 0 || !found.stdout) continue;
    const exe = found.stdout.split(/\r?\n/)[0].trim();
    if (exe === '' || !existsSync(exe)) continue;
    const version = browserVersion(exe);
    if (version !== null) return { executable: exe, version, source: 'PATH lookup' };
  }

  return { notFound: true };
}

// ---------------------------------------------------------------------------
// SVG intrinsic size
// ---------------------------------------------------------------------------

function intrinsicSize(source) {
  const viewBoxMatch = /<svg\b[^>]*\bviewBox\s*=\s*["']([^"']+)["']/i.exec(source);
  if (viewBoxMatch) {
    const parts = viewBoxMatch[1].trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every(Number.isFinite) && parts[2] > 0 && parts[3] > 0) {
      return { width: parts[2], height: parts[3], from: 'viewBox' };
    }
  }
  const widthMatch = /<svg\b[^>]*\bwidth\s*=\s*["']([0-9.]+)/i.exec(source);
  const heightMatch = /<svg\b[^>]*\bheight\s*=\s*["']([0-9.]+)/i.exec(source);
  if (widthMatch && heightMatch) {
    const w = Number(widthMatch[1]);
    const h = Number(heightMatch[1]);
    if (w > 0 && h > 0) return { width: w, height: h, from: 'width/height attributes' };
  }
  return null;
}

// The SVG is inlined into a wrapper document and stretched by CSS, so the
// viewBox drives the scaling regardless of any width/height on the root element.
function wrapperDocument(svgSource, targetWidth, targetHeight, transparent) {
  const body = svgSource
    .replace(/<\?xml[^>]*\?>/gi, '')
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .trim();
  const background = transparent ? 'transparent' : '#ffffff';
  return [
    '<!DOCTYPE html>',
    '<html><head><meta charset="utf-8"><style>',
    `html,body{margin:0;padding:0;background:${background};}`,
    `#frame{width:${targetWidth}px;height:${targetHeight}px;overflow:hidden;}`,
    '#frame > svg{width:100%;height:100%;display:block;}',
    '</style></head><body>',
    `<div id="frame">${body}</div>`,
    '</body></html>',
  ].join('');
}

// ---------------------------------------------------------------------------
// PNG header verification
// ---------------------------------------------------------------------------

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function readIHDR(pngPath) {
  const header = Buffer.alloc(24);
  const fd = openSync(pngPath, 'r');
  try {
    const read = readSync(fd, header, 0, 24, 0);
    if (read < 24) return { error: 'file is shorter than a PNG header' };
  } finally {
    closeSync(fd);
  }
  if (!header.subarray(0, 8).equals(PNG_SIGNATURE)) return { error: 'file does not carry the PNG signature' };
  if (header.subarray(12, 16).toString('ascii') !== 'IHDR') return { error: 'first PNG chunk is not IHDR' };
  return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

function runBrowser(exe, args) {
  return spawnSync(exe, args, { encoding: 'utf8', timeout: 120000 });
}

function render(opts, browser, targetWidth, targetHeight, wrapperPath, outPath) {
  const baseArgs = [
    '--disable-gpu',
    '--hide-scrollbars',
    '--disable-extensions',
    '--disable-lcd-text',
    `--screenshot=${outPath}`,
    `--window-size=${targetWidth},${targetHeight}`,
    `--virtual-time-budget=${opts.timeout}`,
  ];
  if (opts.transparent) baseArgs.push('--default-background-color=00000000');
  if (opts.noSandbox) baseArgs.push('--no-sandbox');

  const profileDir = mkdtempSync(join(tmpdir(), 'svg-render-profile-'));
  baseArgs.push(`--user-data-dir=${profileDir}`);
  const target = pathToFileURL(wrapperPath).href;

  try {
    // Newer builds require the explicit "new
```

### Core Architecture Module: `.claude/workflows/lsel-drain-loop.js`
```
// lsel-drain-loop.js — `/loop` REMINDER recipe for the LSEL drain
// (SPEC-LSEL-LOCAL-EVOLUTION-001 M2; truth-in-advertising corrected by
// SPEC-LSEL-DRAIN-STALL-001 M1, REQ-LDS-010).
//
// WHAT THIS ACTUALLY IS: a MODEL-MEDIATED REMINDER. Its body only PRINTS commands
// via console.log — it executes nothing, and never has (the earlier header claim
// that it ran drain.sh was false and masked the 3-week drain stall). The durable
// mechanical trigger is the session-start wrapper `session_drain.sh` (exclusive
// lock -> unconditional clusters.json archive -> drain.sh -> one-line status ->
// fail-open), which runs on every Claude session start once wired locally
// (spec.md section E local deliverable). This recipe stays as the in-session
// mid-loop reminder for long sessions: SessionStart fires once per session, and
// mid-session inbox accumulation has no other nudge surface.
//
// Invocation: /loop 30m lsel-drain   (or any interval; the recipe is read-only)
//
// It prints the backlog-check command, the wrapper drain command, and the
// candidate-count query, then stops. It does NOT draft proposals (the curator's
// model-mediated PROPOSE stage reads archived clusters-history copies) and it
// does NOT apply anything.

// The runtime requires `export const meta` to be the FIRST statement in the
// script; a file in this directory without it is skipped at scan time with a
// warning, which is how this recipe went unregistered despite AC-LSEL-007
// recording it as registered. Keep meta first — comments above it are fine,
// executable statements are not.
export const meta = {
	name: 'lsel-drain-loop',
	description: 'Read-only LSEL drain REMINDER: prints backlog-check + session_drain.sh wrapper commands; executes nothing (the mechanical trigger is the session-start wrapper)',
	whenToUse: 'Scheduled via /loop on an interval. Read-only — never commits, pushes, or enters run-phase.',
	phases: [
		{ title: 'Remind', detail: 'print backlog-check + wrapper drain commands + archived candidate count' },
	],
}

// cadence-bridge invariant: this recipe is READ-ONLY. No commit, no push, no
// run-phase entry, and no command execution — output only. If a future edit adds
// a write, it violates the bridge.
const INBOX = ".moai/lessons-inbox.jsonl";
const STATE_DIR = ".moai/state/lsel";
const SESSION_DRAIN = ".claude/skills/hns-lsel-curator/session_drain.sh";
const BACKLOG_CHECK = ".claude/skills/hns-lsel-curator/backlog_check.sh";

// Step 1 (PRINTED): advisory backlog check (emits a system-reminder if overflow).
// Step 2 (PRINTED): the wrapper drain — ALL drains route through session_drain.sh
// (exclusive lock + unconditional archive-before-overwrite); a direct drain.sh
// call bypasses archiving and can silently discard staged candidates.
// Step 3 (PRINTED): candidate count from the newest ARCHIVED copy — the live
// clusters.json is ephemeral (a no-op session-start drain overwrites it with
// candidates: []).
//
// This recipe is invoked by the native `/loop` scheduler on an interval. The
// orchestrator reads its printed output and runs the commands itself; proposal
// drafting stays on-demand (curator PROPOSE), never scheduled.
console.log("lsel-drain-loop: reminder only — prints commands, executes nothing");
console.log("backlog-check: " + BACKLOG_CHECK + " --inbox " + INBOX + " --state-dir " + STATE_DIR);
console.log("drain (wrapper-mediated): " + SESSION_DRAIN + " --inbox " + INBOX + " --state-dir " + STATE_DIR);
console.log("report: LATEST=$(ls -t " + STATE_DIR + "/clusters-history/*.json | head -1); jq '.candidates | length' \"$LATEST\"");
console.log("lsel-drain-loop: read-only complete; proposal drafting is on-demand (curator PROPOSE), not scheduled.");

```

### Core Architecture Module: `internal/ciwatch/state.go`
```
package ciwatch

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

	"gopkg.in/yaml.v3"
)

// StateFile is the default relative path within the project root for the watch flag.
const StateFile = ".moai/state/ci-watch-active.flag"

// WatchState is the in-process representation of the state file.
// It is serialized as single-document YAML for atomic write via tempfile+rename.
type WatchState struct {
	// PRNumber is the PR being watched.
	PRNumber int `yaml:"pr_number"`
	// StartedAt is the ISO-8601 UTC timestamp when the watch loop started.
	StartedAt time.Time `yaml:"started_at"`
	// HeartbeatAt is the ISO-8601 UTC timestamp of the last heartbeat tick.
	// If now() - HeartbeatAt > threshold (90s), the state is considered stale.
	HeartbeatAt time.Time `yaml:"heartbeat_at"`
	// RequiredChecks is the ordered list of required check context names.
	RequiredChecks []string `yaml:"required_checks,omitempty"`
	// AbortRequested is set to true by `moai pr watch --abort`.
	// The watch loop polls this field and exits cleanly when true.
	AbortRequested bool `yaml:"abort_requested"`
}

// IsStale reports whether the heartbeat timestamp is older than threshold.
// A stale state means the watch loop crashed or was interrupted; a new
// invocation may safely take over.
func (s WatchState) IsStale(threshold time.Duration) bool {
	return time.Since(s.HeartbeatAt) > threshold
}

// WriteState atomically writes ws to path via tempfile+rename.
// Intermediate directories are created if missing.
func WriteState(path string, ws WatchState) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("create state dir: %w", err)
	}

	data, err := yaml.Marshal(ws)
	if err != nil {
		return fmt.Errorf("marshal state: %w", err)
	}

	// Atomic write: write to temp file, then rename.
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return fmt.Errorf("write temp state: %w", err)
	}
	if err := os.Rename(tmp, path); err != nil {
		_ = os.Remove(tmp)
		return fmt.Errorf("rename state file: %w", err)
	}
	return nil
}

// ReadState reads and parses the YAML state file at path.
// Returns a wrapped os.ErrNotExist error if the file does not exist.
func ReadState(path string) (WatchState, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return WatchState{}, err
	}

	var ws WatchState
	if err := yaml.Unmarshal(data, &ws); err != nil {
		return WatchState{}, fmt.Errorf("parse state file: %w", err)
	}
	return ws, nil
}

// Touch updates the HeartbeatAt field of the state file to now, preserving
// all other fields. Used by the watch loop's 30-second heartbeat tick.
func Touch(path string) error {
	ws, err := ReadState(path)
	if err != nil {
		return fmt.Errorf("touch read: %w", err)
	}
	ws.HeartbeatAt = time.Now().UTC()
	return WriteState(path, ws)
}

// SetAbortFlag reads the state file at path and sets AbortRequested = true.
// Safe to call from `moai pr watch --abort` concurrently with the watch loop
// because WriteState uses atomic rename.
func SetAbortFlag(path string) error {
	ws, err := ReadState(path)
	if err != nil {
		return fmt.Errorf("set abort flag read: %w", err)
	}
	ws.AbortRequested = true
	return WriteState(path, ws)
}

// DeleteState removes the state file. Called when the watch loop reaches a
// terminal state (all-pass, required-fail, timeout, or abort).
func DeleteState(path string) error {
	err := os.Remove(path)
	if os.IsNotExist(err) {
		return nil
	}
	return err
}

```

### Core Architecture Module: `internal/cli/doctor_hook.go`
```
// Package cli — doctor_hook.go
// Implements "moai doctor hook" subcommand with 27-event coverage table.
// SPEC-V3R2-RT-006 REQ-050, REQ-051, AC-12.
package cli

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/cobra"

	"github.com/modu-ai/moai-adk/internal/hook"
)

// doctorHookOutput is the JSON output shape for "moai doctor hook --json".
type doctorHookOutput struct {
	CoverageTable []doctorHookEntry    `json:"coverage_table"`
	Summary       hook.CoverageSummary `json:"summary"`
}

// doctorHookEntry is a single row in the JSON coverage table.
type doctorHookEntry struct {
	EventName          string `json:"event_name"`
	Resolution         string `json:"resolution"`
	IsActive           bool   `json:"is_active"`
	ObservabilityOptIn bool   `json:"observability_opt_in"`
	HandlerFile        string `json:"handler_file"`
}

// doctorHookCmd is the "moai doctor hook" cobra subcommand.
var doctorHookCmd = &cobra.Command{
	Use:   "hook",
	Short: "Show 27-event hook coverage table",
	Long:  "Print the 27-event hook coverage table with per-event resolution state and observability opt-in status.",
	RunE:  runDoctorHook,
}

func init() {
	doctorCmd.AddCommand(doctorHookCmd)
	doctorHookCmd.Flags().Bool("json", false, "Output as JSON")
	doctorHookCmd.Flags().String("trace", "", "Show recent log lines for the named hook event")
	doctorHookCmd.Flags().Bool("observability", false, "Filter to show only RETIRE-OBS-ONLY events")
}

// runDoctorHook implements the "moai doctor hook" command.
func runDoctorHook(cmd *cobra.Command, _ []string) error {
	jsonOutput := getBoolFlag(cmd, "json")
	traceEvent := getStringFlag(cmd, "trace")
	obsOnly := getBoolFlag(cmd, "observability")

	out := cmd.OutOrStdout()

	// Handle --trace flag: tail hook.log for the named event.
	if traceEvent != "" {
		return runDoctorHookTrace(out, traceEvent)
	}

	// Build enriched table from CoverageTable.
	entries := buildDoctorHookEntries(obsOnly)
	summary := hook.Summarize()

	if jsonOutput {
		return printDoctorHookJSON(out, entries, summary)
	}

	return printDoctorHookText(out, entries, summary)
}

// buildDoctorHookEntries converts the canonical CoverageTable to CLI output entries.
func buildDoctorHookEntries(obsOnly bool) []doctorHookEntry {
	entries := make([]doctorHookEntry, 0, len(hook.CoverageTable))
	for _, e := range hook.CoverageTable {
		if obsOnly && e.Resolution != hook.ResolutionRetireObsOnly {
			continue
		}
		entries = append(entries, doctorHookEntry{
			EventName:          e.EventName,
			Resolution:         string(e.Resolution),
			IsActive:           e.IsActive,
			ObservabilityOptIn: e.ObservabilityOptIn,
			HandlerFile:        e.HandlerFile,
		})
	}
	return entries
}

// printDoctorHookJSON writes JSON output to w.
func printDoctorHookJSON(w io.Writer, entries []doctorHookEntry, summary hook.CoverageSummary) error {
	output := doctorHookOutput{
		CoverageTable: entries,
		Summary:       summary,
	}
	data, err := json.MarshalIndent(output, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal json: %w", err)
	}
	_, _ = fmt.Fprintln(w, string(data))
	return nil
}

// printDoctorHookText writes human-readable table output to w.
func printDoctorHookText(w io.Writer, entries []doctorHookEntry, summary hook.CoverageSummary) error {
	_, _ = fmt.Fprintln(w, "Hook Coverage Table — SPEC-V3R2-RT-006 §5.7")
	_, _ = fmt.Fprintln(w, strings.Repeat("─", 80))
	_, _ = fmt.Fprintf(w, "%-35s %-20s %-8s %s\n", "Event", "Resolution", "Active", "Handler")
	_, _ = fmt.Fprintln(w, strings.Repeat("─", 80))

	for _, e := range entries {
		activeStr := "✓"
		if !e.IsActive {
			if e.ObservabilityOptIn {
				activeStr = "obs"
			} else {
				activeStr = "—"
			}
		}
		_, _ = fmt.Fprintf(w, "%-35s %-20s %-8s %s\n",
			e.EventName, e.Resolution, activeStr, e.HandlerFile)
	}

	_, _ = fmt.Fprintln(w, strings.Repeat("─", 80))
	_, _ = fmt.Fprintf(w, "Summary: total=%d KEEP=%d UPGRADE=%d FIX=%d RETIRE=%d REMOVE=%d COMPOSITE=%d\n",
		summary.Total, summary.Keep, summary.Upgrade, summary.Fix,
		summary.RetireObsOnly, summary.Remove, summary.Composite)
	return nil
}

// runDoctorHookTrace tails .moai/logs/hook.log for lines matching the event name.
// Out-of-scope simplification: tail-only readout (no real-time stream).
// SPEC-V3R2-RT-006 REQ-051.
func runDoctorHookTrace(w io.Writer, eventName string) error {
	cwd, err := os.Getwd()
	if err != nil {
		return fmt.Errorf("getwd: %w", err)
	}

	logPath := filepath.Join(cwd, ".moai", "logs", "hook.log")
	f, err := os.Open(logPath)
	if err != nil {
		if os.IsNotExist(err) {
			_, _ = fmt.Fprintf(w, "No hook.log found at %s\n", logPath)
			return nil
		}
		return fmt.Errorf("open hook.log: %w", err)
	}
	defer func() { _ = f.Close() }()

	needle := strings.ToLower(eventName)
	var matches []string
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Text()
		if strings.Contains(strings.ToLower(line), needle) {
			matches = append(matches, line)
		}
	}
	if err := scanner.Err(); err != nil {
		return fmt.Errorf("scan hook.log: %w", err)
	}

	if len(matches) == 0 {
		_, _ = fmt.Fprintf(w, "No log lines found for event %q in %s\n", eventName, logPath)
		return nil
	}

	// Show last N lines (most recent).
	const maxLines = 20
	start := 0
	if len(matches) > maxLines {
		start = len(matches) - maxLines
	}
	for _, line := range matches[start:] {
		_, _ = fmt.Fprintln(w, line)
	}
	return nil
}

```

### Core Architecture Module: `internal/cli/doctor_render.go`
```
package cli

// doctor result-table render layer (SPEC-CLI-TUX-V3-004 M4c, REQ-TUX4-002/003).
//
// Separated from doctor.go so the verdict logic diff there stays limited to
// the progress reporter seam (AC-TUX4-014 render-layer separation proof).
//
// Rich path (TTY + colour): bubbles v2 table styled from internal/tui tokens.
// Plain path (non-TTY or NO_COLOR): aligned plain-text table, zero ANSI —
// golden-test deterministic. No hex literals in this file (AC-CLI-TUI-013).

import (
	"fmt"
	"io"
	"strings"

	btable "charm.land/bubbles/v2/table"
	lipglossv2 "charm.land/lipgloss/v2"

	"github.com/modu-ai/moai-adk/internal/cli/uikit"
	"github.com/modu-ai/moai-adk/internal/tui"
)

// doctorTableHeaders are the per-section result table column titles.
var doctorTableHeaders = [3]string{"STATUS", "CHECK", "MESSAGE"}

// groupCounts tallies ok/warn/fail for one check group.
func groupCounts(g checkGroup) (ok, warn, fail int) {
	for _, c := range g.checks {
		switch c.Status {
		case uikit.CheckOK:
			ok++
		case uikit.CheckWarn:
			warn++
		case uikit.CheckFail:
			fail++
		}
	}
	return ok, warn, fail
}

// doctorColumnWidths computes the status/check column widths from content.
func doctorColumnWidths(g checkGroup) (statusW, checkW int) {
	statusW = len(doctorTableHeaders[0])
	checkW = len(doctorTableHeaders[1])
	for _, c := range g.checks {
		statusW = max(statusW, len(string(c.Status)))
		checkW = max(checkW, len(c.Name))
	}
	return statusW, checkW
}

// renderDoctorPlainTable renders one group as an aligned plain-text table
// (REQ-TUX4-002 non-TTY pair; zero ANSI).
func renderDoctorPlainTable(g checkGroup) []string {
	statusW, checkW := doctorColumnWidths(g)
	var lines []string
	lines = append(lines, fmt.Sprintf("  %-*s  %-*s  %s",
		statusW, doctorTableHeaders[0], checkW, doctorTableHeaders[1], doctorTableHeaders[2]))
	for _, c := range g.checks {
		lines = append(lines, fmt.Sprintf("  %-*s  %-*s  %s",
			statusW, string(c.Status), checkW, c.Name, c.Message))
	}
	return lines
}

// renderDoctorRichTable renders one group through the bubbles v2 table
// component styled from tui tokens (REQ-TUX4-002 TTY pair; AC-TUX4-002
// bubbles-v2 reachability).
func renderDoctorRichTable(g checkGroup, th tui.Theme) string {
	statusW, checkW := doctorColumnWidths(g)
	msgW := len(doctorTableHeaders[2])
	for _, c := range g.checks {
		msgW = max(msgW, len(c.Message))
	}

	cols := []btable.Column{
		{Title: doctorTableHeaders[0], Width: statusW},
		{Title: doctorTableHeaders[1], Width: checkW},
		{Title: doctorTableHeaders[2], Width: msgW},
	}
	rows := make([]btable.Row, 0, len(g.checks))
	for _, c := range g.checks {
		rows = append(rows, btable.Row{string(c.Status), c.Name, c.Message})
	}

	cellStyle := lipglossv2.NewStyle().Foreground(lipglossv2.Color(th.Body)).Padding(0, 1)
	styles := btable.Styles{
		Header:   lipglossv2.NewStyle().Foreground(lipglossv2.Color(th.Accent)).Bold(true).Padding(0, 1),
		Cell:     cellStyle,
		Selected: lipglossv2.NewStyle(), // static render: no selection highlight
	}

	// Total width: column content widths + per-cell horizontal padding (2 each).
	// The table viewport defaults to width 0 and renders no rows without an
	// explicit width, so this is load-bearing, not cosmetic.
	totalW := statusW + checkW + msgW + 6

	t := btable.New(
		btable.WithColumns(cols),
		btable.WithRows(rows),
		btable.WithHeight(len(rows)+1),
		btable.WithWidth(totalW),
		btable.WithStyles(styles),
	)
	return strings.TrimRight(t.View(), "\n ")
}

// renderDoctorGroups renders the grouped doctor results as per-section
// pass/fail tables with per-section and overall counts, wrapped in the
// System Diagnostics box (REQ-TUX4-002). The table backend is selected by
// the same rich/plain predicate as the glamour surfaces: bubbles v2 table on
// a colour-capable terminal, aligned plain text otherwise (REQ-TUX4-003).
func renderDoctorGroups(out io.Writer, groups []checkGroup, verbose bool, th tui.Theme) string {
	rich := markdownRichEnabled((tui.OSEnv{}).NoColor(), writerIsTerminal(out))

	var bodyLines []string
	okTotal, warnTotal, failTotal := 0, 0, 0
	for _, g := range groups {
		if len(g.checks) == 0 {
			continue
		}
		ok, warn, fail := groupCounts(g)
		okTotal += ok
		warnTotal += warn
		failTotal += fail

		bodyLines = append(bodyLines, tui.Section(g.title, tui.SectionOpts{Theme: &th}))
		if rich {
			bodyLines = append(bodyLines, renderDoctorRichTable(g, th))
		} else {
			bodyLines = append(bodyLines, renderDoctorPlainTable(g)...)
		}
		if verbose {
			for _, c := range g.checks {
				if c.Detail != "" {
					bodyLines = append(bodyLines, "    "+c.Name+": "+c.Detail)
				}
			}
		}
		// Per-section counts (REQ-TUX4-002).
		bodyLines = append(bodyLines, fmt.Sprintf("  %d ok, %d warn, %d fail", ok, warn, fail))
		bodyLines = append(bodyLines, "")
	}

	// Overall summary pill row (Pass/Warn/Fail counts).
	pPass := tui.Pill(tui.PillOpts{Kind: tui.PillOk, Solid: false, Label: fmt.Sprintf("Pass %d", okTotal), Theme: &th})
	pWarn := tui.Pill(tui.PillOpts{Kind: tui.PillWarn, Solid: false, Label: fmt.Sprintf("Warn %d", warnTotal), Theme: &th})
	pErr := tui.Pill(tui.PillOpts{Kind: tui.PillErr, Solid: false, Label: fmt.Sprintf("Fail %d", failTotal), Theme: &th})
	bodyLines = append(bodyLines, pPass+"  "+pWarn+"  "+pErr)

	return tui.Box(tui.BoxOpts{
		Title: "System Diagnostics",
		Body:  strings.Join(bodyLines, "\n"),
		Theme: &th,
	})
}

```

### Core Architecture Module: `internal/cli/harness/v4lifecycle.go`
```
// Package harness — v4 harness lifecycle handlers (SPEC-V3R6-HARNESS-V4-001 M4).
//
// ListHarnesses / EditHarness / RemoveHarness implement design §B.3 lifecycle:
//   - list:   enumerate harnesses by scanning .claude/commands/harness/*.md and
//     joining each with its manifest.json (REQ-HV4-011 / AC-HV4-011a)
//   - edit:   locate the manifest + specialist files for editing (manifest is
//     the SSOT; editing it propagates to Runner behavior on next run)
//   - remove: atomic removal of command + workflow + specialists + skills +
//     manifest, fail-closed if any referenced artifact is missing
//     (orphan prevention, REQ-HV4-011 / AC-HV4-011b/c)
//
// The functions are pure filesystem operations against a projectRoot. The cobra
// command wrappers (newHarnessV4ListCmd etc.) live in package cli and delegate
// here; this file holds the testable logic and shares the C-HRA-008 boundary
// guard (TestPropose_NoAskUserQuestion scans this directory).
//
// @MX:ANCHOR: [AUTO] v4 harness lifecycle handlers (list/edit/remove)
// @MX:REASON: [AUTO] fan_in >= 3 candidate: cobra wrappers, lifecycle tests, moai SKILL.md Branch A dispatcher
package harness

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/modu-ai/moai-adk/internal/harness/v4manifest"
)

// v4CommandsDir is the user-owned directory holding thin-wrapper command files
// (.claude/commands/harness/<name>.md) and their co-located manifest
// subdirectories (.claude/commands/harness/<name>/manifest.json). Matches the
// RunnerTemplate read path (M3 runner_template.go readManifest).
const v4CommandsDir = ".claude/commands/harness"

// v4WorkflowsDir holds the Runner Workflow scripts (hns-<name>-run.js
// canonical; legacy harness-<name>-run.js preserved).
const v4WorkflowsDir = ".claude/workflows"

// v4AgentsDir holds the specialist agent definitions (user-owned namespace).
const v4AgentsDir = ".claude/agents/harness"

// v4SkillsDir is the parent of the per-harness companion skill directories
// (.claude/skills/hns-<name>-*/ canonical; legacy .claude/skills/harness-<name>-*/).
const v4SkillsDir = ".claude/skills"

// v4ArtifactPrefixes are the recognized user-owned artifact-name prefixes for
// the dual-pattern matcher, canonical generation first (SPEC-HNS-PREFIX-RENAME-001
// REQ-HPR-010/011: hns- canonical, harness- legacy — both resolve).
var v4ArtifactPrefixes = []string{"hns-", "harness-"}

// listHarnessCommandNames scans the v4CommandsDir for *.md command files and
// returns the set of known harness names (the file stems). It is the
// disambiguation source for harnessArtifactBelongsTo: without the full name set,
// a bare prefix match cannot distinguish harness "release" from "release-update"
// (SPEC-CLIFIX-CRITICAL-001 REQ-CRIT-001-004).
func listHarnessCommandNames(projectRoot string) []string {
	commandsDir := filepath.Join(projectRoot, v4CommandsDir)
	entries, err := os.ReadDir(commandsDir)
	if err != nil {
		return nil
	}
	var names []string
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		if strings.HasSuffix(e.Name(), ".md") {
			names = append(names, strings.TrimSuffix(e.Name(), ".md"))
		}
	}
	return names
}

// harnessArtifactBelongsTo reports whether the artifact entryName (a file or dir
// name in the hns-<name> / legacy harness-<name> namespace) belongs to the
// harness with the given name, using the set of all known harness names to
// disambiguate prefix collisions via longest-match
// (SPEC-CLIFIX-CRITICAL-001 REQ-CRIT-001-004; dual-pattern per
// SPEC-HNS-PREFIX-RENAME-001 REQ-HPR-010/011).
//
// "hns-release-auditor-specialist.md" belongs to "release" (not
// "release-update") because the longest matching name is "release".
// "hns-release-update-auditor-specialist.md" belongs to "release-update"
// because "release-update" is a longer match than "release". The same
// longest-name-first discipline applies to the legacy harness- generation, so
// a mixed-generation harness resolves as one entry.
func harnessArtifactBelongsTo(entryName, name string, allNames []string) bool {
	bestMatch := ""
	for _, n := range allNames {
		for _, prefix := range v4ArtifactPrefixes {
			art := prefix + n
			if entryName == art || strings.HasPrefix(entryName, art+"-") {
				if len(n) > len(bestMatch) {
					bestMatch = n
				}
			}
		}
	}
	// Fall back to the bare name when allNames is empty (no command files found)
	// so the helper degrades to a prefix+"-" or exact match against name alone.
	if bestMatch == "" {
		for _, prefix := range v4ArtifactPrefixes {
			art := prefix + name
			if entryName == art || strings.HasPrefix(entryName, art+"-") {
				return true
			}
		}
		return false
	}
	return bestMatch == name
}

// HarnessEntry is a single harness enumerated by ListHarnesses.
type HarnessEntry struct {
	// Name is the harness name (derived from the command filename stem).
	Name string `json:"name"`

	// Domain is the human-readable domain from manifest.json (empty if the
	// manifest is missing or unreadable).
	Domain string `json:"domain"`

	// EntryCommand is the /harness:<name> string from the manifest.
	EntryCommand string `json:"entry_command"`

	// RunnerWorkflow is the harness-<name>-run.js filename from the manifest.
	RunnerWorkflow string `json:"runner_workflow"`

	// ManifestMissing is true when a command file exists but its co-located
	// manifest.json does not (partial state). List surfaces this so the user
	// can decide whether to repair or remove.
	ManifestMissing bool `json:"manifest_missing"`

	// CommandPath is the absolute path to the thin-wrapper command file.
	CommandPath string `json:"command_path"`

	// ManifestPath is the absolute path to the manifest.json (may not exist
	// when ManifestMissing is true).
	ManifestPath string `json:"manifest_path"`

	// Schedule is the harness's OPTIONAL declared recurring schedule from
	// manifest.json. Nil when the manifest declares none — the JSON output
	// omits the key entirely (omitempty), keeping schedule-less harnesses
	// byte-identical to the pre-schedule baseline. The list surfaces the
	// DECLARED schedule, not live registration state.
	Schedule *v4manifest.Schedule `json:"schedule,omitempty"`
}

// ListHarnesses enumerates every harness under projectRoot by scanning
// .claude/commands/harness/*.md and joining each with its manifest.json
// (AC-HV4-011a). A command whose manifest is missing is still listed with
// ManifestMissing=true — list never crashes on partial state; remove handles
// atomicity. Returns entries sorted by Name for deterministic output.
func ListHarnesses(projectRoot string) ([]HarnessEntry, error) {
	commandsDir := filepath.Join(projectRoot, v4CommandsDir)
	entries, err := os.ReadDir(commandsDir)
	if err != nil {
		if os.IsNotExist(err) {
			// No harness directory → zero harnesses. Not an error.
			return nil, nil
		}
		return nil, fmt.Errorf("v4lifecycle: list: read commands dir: %w", err)
	}

	var harnesses []HarnessEntry
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		if !strings.HasSuffix(e.Name(), ".md") {
			continue
		}
		name := strings.TrimSuffix(e.Name(), ".md")
		cmdPath := filepath.Join(commandsDir, e.Name())
		manifestPath := filepath.Join(commandsDir, name, "manifest.json")

		entry := HarnessEntry{
			Name:         name,
			CommandPath:  cmdPath,
			ManifestPath: manifestPath,
		}

		if data, mErr := os.ReadFile(manifestPath); mErr == nil {
			var m v4manifest.Manifest
			if jErr := json.Unmarshal(data, &m); jErr == nil {
				entry.Domain = m.Domain
				entry.EntryCommand = m.EntryCommand
				entry.RunnerWorkflow = m.RunnerWorkflow
				entry.Schedule = m.Schedule
			}
			// If JSON unmarshal fails, Domain stays empty but the harness is
			// still listed (ManifestMissing=false because the file exists).
		} else if os.IsNotExist(mErr) {
			entry.ManifestMissing = true
		}
		harnesses = append(harnesses, entry)
	}

	sort.Slice(harnesses, func(i, j int) bool {
		return harnesses[i].Name < harnesses[j].Name
	})
	return harnesses, nil
}

// readDeclaredSchedule best-effort reads the named harness's manifest and
// returns its declared schedule, or nil when the manifest is absent,
// unreadable, or declares no schedule. Callers that need the schedule across
// a destructive operation (remove) MUST call this BEFORE the operation — the
// manifest is deleted by RemoveHarness, so post-removal reads see nothing.
func readDeclaredSchedule(projectRoot, name string) *v4manifest.Schedule {
	manifestPath := filepath.Join(projectRoot, v4CommandsDir, name, "manifest.json")
	data, err := os.ReadFile(manifestPath)
	if err != nil {
		return nil
	}
	var m v4manifest.Manifest
	if err := json.Unmarshal(data, &m); err != nil {
		return nil
	}
	return m.Schedule
}

// HarnessEditPaths is the set of files EditHarness surfaces for editing. The
// manifest is the SSOT; editing it propagates to Runner behavior on the next
// invocation. The specialist files are listed so the user can revise role
// definitions alongside the manifest.
type HarnessEditPaths struct {
	// Name is the harness name.
	Name string `json:"name"`

	// ManifestPath is the manifest.json absolute path (SSOT).
	ManifestPath string `json:"manifest_path"`

	// SpecialistPaths are the absolute paths to the harness's specialist agent
	// definition files under .claude/agents/harness/.
	SpecialistPaths []string `json:"specialist_paths"`

	// SkillPaths are the companion skill directory paths (if any).
	SkillPaths []string `json:"skill_paths"`
}

// EditHarness locates the manifest + specialist + skill files for the named
// harness so the user (or orchestrator) can open them for editing. The manifest
// MUST exist (it is the SSOT); a missing manifest returns an error so the user
// is not directed to edit a harness whose SSOT is gone.
func EditHarness(projectRoot, name string) (HarnessEditPaths, error) {
	commandsDir := filepath.Join(projectRoot, v4CommandsDir)
	manifestPath := filepath.Join(commandsDir, name, "manifes
```

### Core Architecture Module: `internal/cli/harness/v4lifecycle_cmd.go`
```
// Package harness — v4 lifecycle cobra command wrappers (SPEC-V3R6-HARNESS-V4-001 M4).
//
// NewHarnessV4ListCmd / NewHarnessV4EditCmd / NewHarnessV4RemoveCmd are the
// cobra command factories for the three v4 lifecycle verbs. They are registered
// under the existing `moai harness` parent (newHarnessRouterCmd in package cli)
// alongside the V3R2/V3R5 verbs. Each factory is a thin wrapper that resolves
// --project-root and delegates to the pure functions in v4lifecycle.go.
//
// The factories live in the boundary-guarded internal/cli/harness/ package so
// the C-HRA-008 static guard (TestPropose_NoAskUserQuestion) scans them. They
// MUST NOT call AskUserQuestion — the CLI surfaces structured output and
// stderr errors; the orchestrator owns user interaction.
package harness

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/spf13/cobra"

	"github.com/modu-ai/moai-adk/internal/harness/v4manifest"
)

// resolveProjectRootV4 returns the --project-root flag value or the current
// working directory. Mirrors the resolveProjectRoot helper in package cli but
// is local to this package to keep the lifecycle handlers self-contained.
func resolveProjectRootV4(cmd *cobra.Command) (string, error) {
	root, _ := cmd.Flags().GetString("project-root")
	if root == "" {
		// Inherited --project-root from the parent harness command.
		if f := cmd.InheritedFlags().Lookup("project-root"); f != nil {
			root = f.Value.String()
		}
	}
	if root == "" {
		var err error
		root, err = os.Getwd()
		if err != nil {
			return "", fmt.Errorf("v4lifecycle: resolve project root: %w", err)
		}
	}
	return root, nil
}

// NewHarnessV4ListCmd is the `moai harness list` factory (AC-HV4-011a).
// Enumerates every harness under .claude/commands/harness/ joined with its
// manifest. Supports --json for machine-readable output.
func NewHarnessV4ListCmd() *cobra.Command {
	var jsonOutput bool
	cmd := &cobra.Command{
		Use:   "list",
		Short: "List all v4 harnesses",
		Long: `List every harness-v4 entry under .claude/commands/harness/.

Each harness is shown with its name, domain (from manifest.json), and entry
command. A command file whose manifest is missing is still listed with a
manifest_missing flag so partial state is visible.

Use --json for machine-readable output.`,
		RunE: func(cmd *cobra.Command, _ []string) error {
			root, err := resolveProjectRootV4(cmd)
			if err != nil {
				return err
			}
			entries, err := ListHarnesses(root)
			if err != nil {
				return err
			}
			if jsonOutput {
				data, mErr := json.MarshalIndent(entries, "", "  ")
				if mErr != nil {
					return fmt.Errorf("harness list: json marshal: %w", mErr)
				}
				_, _ = fmt.Fprintln(cmd.OutOrStdout(), string(data))
				return nil
			}
			w := cmd.OutOrStdout()
			if len(entries) == 0 {
				_, _ = fmt.Fprintln(w, "No harnesses found under .claude/commands/harness/.")
				return nil
			}
			_, _ = fmt.Fprintf(w, "%-16s %-40s %s\n", "NAME", "DOMAIN", "ENTRY")
			for _, e := range entries {
				domain := e.Domain
				if domain == "" {
					// AC-HLR-013: a command-only thin harness (manifest absent)
					// is an EXPECTED state, not a defect — doctor classifies the
					// same state as SeverityInfo ("command-only thin harness ...
					// Runner/agent axes not applicable"). list MUST use the same
					// non-defect-suggesting framing so the two commands agree.
					// (Pre-M6 this read "(manifest missing)", which contradicted
					// doctor's INFO classification.)
					domain = "(command-only thin harness)"
				}
				entry := e.EntryCommand
				if entry == "" {
					entry = "/harness:" + e.Name
				}
				// Surface the DECLARED schedule only when present — a
				// schedule-less harness's row stays byte-identical to the
				// pre-schedule baseline.
				if e.Schedule != nil {
					entry += fmt.Sprintf("  schedule: %s via %s", e.Schedule.Interval, e.Schedule.Mechanism)
				}
				_, _ = fmt.Fprintf(w, "%-16s %-40s %s\n", e.Name, domain, entry)
			}
			return nil
		},
	}
	cmd.Flags().BoolVar(&jsonOutput, "json", false, "Output as JSON")
	return cmd
}

// NewHarnessV4EditCmd is the `moai harness edit <name>` factory (design §B.3).
// Locates the manifest + specialist + skill files for the named harness and
// prints their paths so the user (or orchestrator) can open them for editing.
func NewHarnessV4EditCmd() *cobra.Command {
	var jsonOutput bool
	cmd := &cobra.Command{
		Use:   "edit <name>",
		Short: "Show paths to edit a v4 harness manifest + specialists",
		Long: `Show the file paths to edit for a harness-v4 entry.

The manifest is the single source of truth — editing it propagates to Runner
behavior on the next invocation. Specialist agent files and companion skill
directories are also listed so role definitions can be revised alongside.

Use --json for machine-readable output.`,
		Args: cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			root, err := resolveProjectRootV4(cmd)
			if err != nil {
				return err
			}
			paths, err := EditHarness(root, args[0])
			if err != nil {
				return err
			}
			if jsonOutput {
				data, mErr := json.MarshalIndent(paths, "", "  ")
				if mErr != nil {
					return fmt.Errorf("harness edit: json marshal: %w", mErr)
				}
				_, _ = fmt.Fprintln(cmd.OutOrStdout(), string(data))
				return nil
			}
			w := cmd.OutOrStdout()
			_, _ = fmt.Fprintf(w, "Harness: %s\n", paths.Name)
			_, _ = fmt.Fprintf(w, "Manifest (SSOT): %s\n", paths.ManifestPath)
			if len(paths.SpecialistPaths) > 0 {
				_, _ = fmt.Fprintln(w, "Specialists:")
				for _, p := range paths.SpecialistPaths {
					_, _ = fmt.Fprintf(w, "  - %s\n", p)
				}
			}
			if len(paths.SkillPaths) > 0 {
				_, _ = fmt.Fprintln(w, "Skills:")
				for _, p := range paths.SkillPaths {
					_, _ = fmt.Fprintf(w, "  - %s\n", p)
				}
			}
			return nil
		},
	}
	cmd.Flags().BoolVar(&jsonOutput, "json", false, "Output as JSON")
	return cmd
}

// NewHarnessV4RemoveCmd is the `moai harness remove <name>` factory
// (AC-HV4-011b/c). Atomically removes command + workflow + specialists +
// skills + manifest. Fails closed if any referenced artifact is missing.
func NewHarnessV4RemoveCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "remove <name>",
		Short: "Atomically remove a v4 harness (command + workflow + specialists + skills + manifest)",
		Long: `Remove a harness-v4 entry and all its artifacts.

Removes ALL of the following atomically:
  - .claude/commands/harness/<name>.md (thin-wrapper command)
  - .claude/commands/harness/<name>/manifest.json (manifest SSOT)
  - .claude/workflows/harness-<name>-run.js (Runner Workflow)
  - .claude/agents/harness/harness-<name>*-specialist.md (specialists)
  - .claude/skills/harness-<name>*/ (companion skills)

Fail-closed: if any referenced artifact is missing (orphan state), the remove
refuses to proceed and names the missing artifact. No partial state is left.`,
		Args: cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			root, err := resolveProjectRootV4(cmd)
			if err != nil {
				return err
			}
			// Pre-read the declared schedule BEFORE removal: RemoveHarness
			// deletes the manifest, so the unregister notice must be computed
			// from pre-deletion state.
			schedule := readDeclaredSchedule(root, args[0])
			if err := RemoveHarness(root, args[0]); err != nil {
				return err
			}
			w := cmd.OutOrStdout()
			_, _ = fmt.Fprintf(w, "harness %q removed (command + workflow + specialists + skills + manifest).\n", args[0])
			// Unregister notice: the CLI only reports the declared mechanism;
			// unregistration itself is an orchestrator-side action (the CLI
			// never invokes Cron tools or arms/cancels loops).
			if schedule != nil {
				switch schedule.Mechanism {
				case v4manifest.MechanismCron:
					_, _ = fmt.Fprintf(w, "note: this harness declared a cron schedule (%s) — unregister it via CronDelete in the orchestrator session.\n", schedule.Interval)
				case v4manifest.MechanismLoop:
					_, _ = fmt.Fprintf(w, "note: this harness declared a /loop schedule (%s) — unregister by cancelling any armed loop in the active session (loop arming is session-scoped).\n", schedule.Interval)
				}
			}
			return nil
		},
	}
	return cmd
}

```

### Core Architecture Module: `internal/cli/hook.go`
```
package cli

import (
	"bufio"
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/spf13/cobra"
	"gopkg.in/yaml.v3"

	"github.com/modu-ai/moai-adk/internal/cli/uikit"
	"github.com/modu-ai/moai-adk/internal/config"
	"github.com/modu-ai/moai-adk/internal/harness"
	"github.com/modu-ai/moai-adk/internal/harness/proposalgen"
	"github.com/modu-ai/moai-adk/internal/harness/routing"
	"github.com/modu-ai/moai-adk/internal/hook"
	"github.com/modu-ai/moai-adk/internal/hook/security"
)

var hookCmd = &cobra.Command{
	Use:     "hook",
	Short:   "Execute hook event handlers",
	GroupID: "tools",
	Long:    "Execute Claude Code hook event handlers. Called by Claude Code settings.json hook configuration.",
}

func init() {
	rootCmd.AddCommand(hookCmd)

	// SPEC-CODEX-WIRING-001 (REQ-CW-007): the --harness flag selects the
	// runtime harness mode on every dispatcher subcommand. codex wraps the
	// dispatcher's output through the codex adapter (MapOutput,
	// RecordDiscards, payload event cross-check); empty/claude is today's
	// behavior byte-for-byte.
	hookCmd.PersistentFlags().String("harness", "", "Harness mode: claude (default) or codex (adapts dispatcher output through the codex hook adapter)")

	// Register all hook subcommands
	hookSubcommands := []struct {
		use   string
		short string
		event hook.EventType
	}{
		{"session-start", "Handle session start event", hook.EventSessionStart},
		{"pre-tool", "Handle pre-tool-use event", hook.EventPreToolUse},
		{"post-tool", "Handle post-tool-use event", hook.EventPostToolUse},
		{"session-end", "Handle session end event", hook.EventSessionEnd},
		{"stop", "Handle stop event", hook.EventStop},
		{"compact", "Handle pre-compact event", hook.EventPreCompact},
		{"post-tool-failure", "Handle post-tool-use failure event", hook.EventPostToolUseFailure},
		{"notification", "Handle notification event", hook.EventNotification},
		{"subagent-start", "Handle subagent start event", hook.EventSubagentStart},
		{"user-prompt-submit", "Handle user prompt submit event", hook.EventUserPromptSubmit},
		{"permission-request", "Handle permission request event", hook.EventPermissionRequest},
		{"teammate-idle", "Handle teammate idle event", hook.EventTeammateIdle},
		{"task-completed", "Handle task completed event", hook.EventTaskCompleted},
		{"subagent-stop", "Handle subagent stop event", hook.EventSubagentStop},
		{"worktree-create", "Handle worktree create event", hook.EventWorktreeCreate},
		{"worktree-remove", "Handle worktree remove event", hook.EventWorktreeRemove},
		{"post-compact", "Handle post-compact event", hook.EventPostCompact},
		{"instructions-loaded", "Handle instructions loaded event", hook.EventInstructionsLoaded},
		{"stop-failure", "Handle stop failure event", hook.EventStopFailure},
		{"config-change", "Handle config change event", hook.EventConfigChange},
		{"task-created", "Handle task created event", hook.EventTaskCreated},
		{"cwd-changed", "Handle cwd changed event", hook.EventCwdChanged},
		{"file-changed", "Handle file changed event", hook.EventFileChanged},
		{"elicitation", "Handle MCP elicitation event", hook.EventElicitation},
		{"elicitation-result", "Handle MCP elicitation result event", hook.EventElicitationResult},
		{"permission-denied", "Handle permission denied event", hook.EventPermissionDenied},
	}

	for _, sub := range hookSubcommands {
		event := sub.event // capture for closure
		cmd := &cobra.Command{
			Use:   sub.use,
			Short: sub.short,
			// Hook subcommands are invoked by Claude Code, not humans: a
			// genuine error must not dump usage noise into the hook pipeline.
			SilenceUsage: true,
			RunE: func(cmd *cobra.Command, _ []string) error {
				return runHookEvent(cmd, event)
			},
		}
		hookCmd.AddCommand(cmd)
	}

	// Add "list" subcommand
	hookCmd.AddCommand(&cobra.Command{
		Use:   "list",
		Short: "List registered hook handlers",
		RunE:  runHookList,
	})

	// Add "agent" subcommand for agent-specific hooks
	hookCmd.AddCommand(&cobra.Command{
		Use:          "agent [action]",
		Short:        "Execute agent-specific hook action",
		Long:         "Execute agent-specific hook actions like cycle-pre-transformation, backend-validation, etc.",
		Args:         cobra.ExactArgs(1),
		SilenceUsage: true,
		RunE:         runAgentHook,
	})

	// harness-observe Add subcommands (SPEC-V3R3-HARNESS-LEARNING-001 T-P1-03)
	// Read PostToolUse hook stdin JSON and record event to usage-log.jsonl.
	hookCmd.AddCommand(&cobra.Command{
		Use:   "harness-observe",
		Short: "Record PostToolUse event to harness usage log",
		Long:  "Reads hook stdin JSON and appends an event to .moai/harness/usage-log.jsonl. Called from handle-harness-observe.sh.",
		RunE:  runHarnessObserve,
	})

	// Multi-event observer subcommands (SPEC-V3R4-HARNESS-002 Round A)
	hookCmd.AddCommand(&cobra.Command{
		Use:   "harness-observe-stop",
		Short: "Record Stop event to harness usage log",
		Long:  "Reads Stop hook stdin JSON and appends a session_stop event to .moai/harness/usage-log.jsonl.",
		RunE:  runHarnessObserveStop,
	})
	hookCmd.AddCommand(&cobra.Command{
		Use:   "harness-observe-subagent-stop",
		Short: "Record SubagentStop event to harness usage log",
		Long:  "Reads SubagentStop hook stdin JSON and appends a subagent_stop event to .moai/harness/usage-log.jsonl.",
		RunE:  runHarnessObserveSubagentStop,
	})
	hookCmd.AddCommand(&cobra.Command{
		Use:   "harness-observe-user-prompt-submit",
		Short: "Record UserPromptSubmit event to harness usage log",
		Long:  "Reads UserPromptSubmit hook stdin JSON and appends a user_prompt event. Default strategy: SHA-256 hash + length.",
		RunE:  runHarnessObserveUserPromptSubmit,
	})

	// Add "spec-status" subcommand (SPEC-STATUS-AUTO-001)
	specStatusCmd := &cobra.Command{
		Use:   "spec-status",
		Short: "Auto-update SPEC status on git commit",
		Long:  "Extract SPEC-IDs from PR titles / commit messages and update their status to 'implemented'. Manual invocation only (moai hook spec-status): no handle-spec-status.sh wrapper exists and there is no settings.json registration — Claude Code exposes no native hook event that delivers a PR title to stdin, so this subcommand has no auto-fire path.",
		RunE:  runSpecStatus,
	}
	hookCmd.AddCommand(specStatusCmd)

	// Add "session-start-compact" subcommand (SPEC-INFINITE-GOAL-001 REQ-5).
	// Isolated-invocation surface for the SessionStart(compact) re-inject handler.
	// Production firing rides on the deps.go registration via the existing
	// handle-session-start.sh → moai hook session-start chain (the handler
	// filters source=="compact" internally); this subcommand + its wrapper expose
	// a dedicated manual/debug path.
	sessionStartCompactCmd := &cobra.Command{
		Use:          "session-start-compact",
		Short:        "Re-inject goal + SPEC context after auto-compact",
		Long:         "SessionStart(compact) re-inject: reads the armed goal + active SPEC progress.md tail and emits (goal condition, SPEC-id, last-verified mechanical state, single next action) to stdout. No-op when no goal is armed.",
		SilenceUsage: true,
		RunE:         runSessionStartCompact,
	}
	hookCmd.AddCommand(sessionStartCompactCmd)

	// Add the in-session security guardian subcommands (SPEC-SEC-GUARDIAN-001).
	// Three thin RunE wrappers forward stdin/stdout to the compiled Go handlers
	// in internal/hook/security. Each is advisory-first + fail-open; none blocks
	// by default and none invokes AskUserQuestion (REQ-SG-040/042/060).
	//   security-scan   L1 PostToolUse — instant regex pattern warnings (advisory)
	//   security-turn   L2 Stop        — turn-diff review (advisory; opt-in block)
	//   security-commit L3 Stop        — commit cross-file review (dormant by default)
	hookCmd.AddCommand(&cobra.Command{
		Use:          "security-scan",
		Short:        "Layer-1 in-session security guardian: PostToolUse pattern warnings",
		Long:         "Scan a written buffer (PostToolUse) for known-dangerous patterns and emit advisory findings. Regex-only, in-process, never blocks. SPEC-SEC-GUARDIAN-001.",
		SilenceUsage: true,
		RunE:         runSecurityScan,
	})
	hookCmd.AddCommand(&cobra.Command{
		Use:          "security-turn",
		Short:        "Layer-2 in-session security guardian: Stop turn-diff review",
		Long:         "Review the turn's working-tree diff (Stop) for high-severity findings. Advisory by default; blocking is opt-in via MOAI_SECURITY_BLOCKING. SPEC-SEC-GUARDIAN-001.",
		SilenceUsage: true,
		RunE:         runSecurityTurn,
	})
	hookCmd.AddCommand(&cobra.Command{
		Use:          "security-commit",
		Short:        "Layer-3 in-session security guardian: commit cross-file review",
		Long:         "Review a commit's changed + related files for cross-file data-flow risks (IDOR / auth-bypass / SSRF). Dormant unless MOAI_SECURITY_COMMIT_REVIEW is set. SPEC-SEC-GUARDIAN-001.",
		SilenceUsage: true,
		RunE:         runSecurityCommit,
	})

	// Add "harness-classify" subcommand (SPEC-V3R6-HARNESS-CLASSIFIER-WIRING-001).
	// Wired into the /moai:harness status workflow body §2.1 to close the V3R4
	// learning loop. Reuses the existing hook namespace per
	// BC-V3R4-HARNESS-001-CLI-RETIREMENT (no new top-level harness namespace).
	hookCmd.AddCommand(&cobra.Command{
		Use:   "harness-classify",
		Short: "Run V3R4 harness classifier and write tier promotions",
		Long: `Reads .moai/harness/usage-log.jsonl, aggregates events into patterns,
classifies tier per learning.tier_thresholds in harness.yaml, and appends
promotions to .moai/harness/learning-history/tier-promotions.jsonl.

Gated by learning.enabled in .moai/config/sections/harness.yaml — when false,
the subcommand is a complete no-op (REQ-HCW-004, preserves REQ-HRN-FND-009).

On classifier error the subcommand emits a "harness-classify error: ..."
annotation to stderr and exits with code 1 so the workflow body can render
the error annotation above its status sections without abort
```

### Core Architecture Module: `internal/cli/hook_harness_codex.go`
```
package cli

// hook_harness_codex.go — SPEC-CODEX-WIRING-001 M3, the `--harness codex`
// runtime mode of the `moai hook` dispatcher (REQ-CW-007).
//
// The seam lives HERE, in the CLI dispatcher layer — in front of and behind
// the dispatcher's own decision logic — and nothing under internal/hook is
// modified (M3 REQ-7 spirit): MapOutput rewrites the serialized output,
// RecordDiscards persists undeliverables, Resolve cross-checks the payload's
// event name against the invoked subcommand, and the exit code / stderr pass
// through untouched.

import (
	"bytes"
	"fmt"
	"os"

	"github.com/spf13/cobra"

	"github.com/modu-ai/moai-adk/internal/codexadapter"
	"github.com/modu-ai/moai-adk/internal/hook"
)

// codexHarnessFlagValue is the single non-default --harness value.
const codexHarnessFlagValue = "codex"

// harnessModeIsCodex reads the --harness flag. Empty means claude (the
// default — flag-absent behavior is byte-identical to today); any value other
// than claude/codex fails loud with the valid set named.
func harnessModeIsCodex(cmd *cobra.Command) (bool, error) {
	switch v := getStringFlag(cmd, "harness"); v {
	case "":
		return false, nil
	case codexHarnessFlagValue:
		return true, nil
	case "claude":
		return false, nil
	default:
		return false, fmt.Errorf("invalid --harness value %q: must be one of: claude, codex", v)
	}
}

// validateCodexHarnessEvent cross-checks the payload's hook_event_name
// against the invoked subcommand via codexadapter.Resolve (REQ-CW-007 second
// clause): the hooks.json the generator emits and the runtime command Codex
// runs must agree, and a mismatch is refused with a diagnostic rather than
// dispatched into the wrong handler.
func validateCodexHarnessEvent(event hook.EventType, input *hook.HookInput) error {
	if input == nil || input.HookEventName == "" {
		// Nothing to cross-check — the dispatcher's own injection (subcommand
		// event) fills an absent name, which by construction matches.
		return nil
	}
	payloadArg, err := codexadapter.Resolve(input.HookEventName)
	if err != nil {
		return fmt.Errorf("codex harness: rejecting payload: %w", err)
	}
	subArg, err := codexadapter.Resolve(string(event))
	if err != nil {
		return fmt.Errorf("codex harness: refusing this subcommand: %w", err)
	}
	if payloadArg != subArg {
		return fmt.Errorf("codex harness: payload hook_event_name %q maps to dispatcher %q but this subcommand dispatches %q — the wiring table and the runtime command disagree",
			input.HookEventName, payloadArg, subArg)
	}
	return nil
}

// writeHookOutputCodex maps one hook output through the codex adapter
// (REQ-CW-007 first clause): continue:false becomes decision:block (reason
// filled), UserPromptSubmit systemMessage routes to additionalContext,
// undeliverables are recorded to the adapter's diagnostic sink, and the
// mapped bytes go to stdout. The hook's own exit code and stderr are not
// touched here — the exit-2 path stays in runHookEvent, and hook stderr was
// already written by the handlers themselves.
func writeHookOutputCodex(event hook.EventType, output *hook.HookOutput) error {
	var raw bytes.Buffer
	if err := deps.HookProtocol.WriteOutput(&raw, output); err != nil {
		return fmt.Errorf("serialize hook output for codex mapping: %w", err)
	}
	mapped, discards, err := codexadapter.MapOutput(event, raw.Bytes())
	if err != nil {
		return fmt.Errorf("map hook output for codex: %w", err)
	}

	// hookBlocked mirrors RecordDiscards' own contract: when the underlying
	// hook exited 2, stderr carries the blocking reason and must not gain a
	// diagnostic line — but the sink record is still written.
	hookBlocked := output != nil && output.ExitCode == 2
	if err := codexadapter.RecordDiscards(resolveHookProjectRoot(), discards, hookBlocked, os.Stderr); err != nil {
		// The sink record is the durable half of the no-silence obligation,
		// but losing the console copy must not lose the hook's own output.
		_, _ = fmt.Fprintf(os.Stderr, "codex harness: record discards: %v\n", err)
	}

	if _, err := os.Stdout.Write(append(mapped, '\n')); err != nil {
		return fmt.Errorf("write mapped hook output: %w", err)
	}
	return nil
}

```

### Core Architecture Module: `internal/cli/hook_install.go`
```
package cli

import (
	"bufio"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// moaiPrePushMarker is the identifier written on line 2 of the hook file.
// Its presence signals that the hook was installed by MoAI-ADK and can be
// safely overwritten on subsequent installs.
const moaiPrePushMarker = "# MoAI-ADK pre-push hook"

// moaiPrePushProvenanceName is the pre-push provenance sidecar basename; see
// hookTier.provenanceName (hook_install_shared.go) for the rationale.
const moaiPrePushProvenanceName = ".moai-pre-push.sha256"

// prePushBackupPrefix is the pre-push backup basename prefix; see
// hookTier.backupPrefix (hook_install_shared.go) for the rationale.
const prePushBackupPrefix = "pre-push.bak."

// errPrePushBackupFailed wraps a pre-push backup-write failure so the optional
// wrapper can turn it into a warning while leaving the hook untouched (the
// REQ-PCP-010 sub-case (a) equivalent for the push tier, t257). It never
// reaches the caller as a failure.
var errPrePushBackupFailed = errors.New("pre-push backup failed")

// ErrUserHookExists is returned when a pre-existing hook without the MoAI
// marker is found. The caller should inform the user and skip installation.
var ErrUserHookExists = errors.New("pre-existing user hook found without MoAI-ADK marker")

// prePushHookContent is the canonical content of the pre-push hook.
// Kept as a constant so the installer and tests share a single source of truth.
//
// MUST stay byte-identical with internal/template/templates/.git_hooks/pre-push.
// TestPrePushTemplateMatchesConstant enforces this; do not edit one without the other.
const prePushHookContent = `#!/bin/sh
# MoAI-ADK pre-push hook — runs make ci-local; logs invocation outcome
# Bypass via: SKIP_MOAI_PREPUSH=1 git push   (logged on next invocation)
# To disable permanently: remove this file or pass --no-hooks to moai update
set -eu

if [ "${SKIP_MOAI_PREPUSH:-0}" = "1" ]; then
    printf '[pre-push] SKIP_MOAI_PREPUSH=1 -- bypass requested\n' >&2
    exit 0
fi

# Capture git's ref-update stdin once, before any later step consumes it. git
# passes lines of "<local ref> <local oid> <remote ref> <remote oid>"; cat exits
# 0 on empty input, so this is safe under "set -eu".
REFS="$(cat)"

REPO_ROOT="$(git rev-parse --show-toplevel)"
LOG_DIR="$REPO_ROOT/.moai/logs"
LOG_FILE="$LOG_DIR/prepush-bypass.log"
mkdir -p "$LOG_DIR" 2>/dev/null || true

START_TS="$(date +%s)"

if [ -f "$REPO_ROOT/Makefile" ]; then
    if make -C "$REPO_ROOT" -s ci-local >/dev/null; then
        OUTCOME="pass"
        EXIT_CODE=0
    else
        EXIT_CODE=$?
        OUTCOME="fail"
    fi
else
    # No Makefile — skip ci-local (end-user project without a CI mirror).
    OUTCOME="skip (no Makefile)"
    EXIT_CODE=0
    printf '[pre-push] No Makefile found — skipping ci-local\n' >&2
fi

END_TS="$(date +%s)"
DURATION=$((END_TS - START_TS))
USER_NAME="${USER:-$(id -un 2>/dev/null || printf 'unknown')}"
BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || printf 'unknown')"

printf '%s\t%s\t%s\t%s\t%ds\n' "$END_TS" "$USER_NAME" "$BRANCH" "$OUTCOME" "$DURATION" >> "$LOG_FILE" 2>/dev/null || true

if [ "$OUTCOME" = "fail" ]; then
    printf '\n[pre-push] FAILED: local CI mirror reported errors.\n' >&2
    printf '[pre-push] Hint: make fmt && make lint && make test\n' >&2
    printf '[pre-push] Override (logged on next invocation): SKIP_MOAI_PREPUSH=1 git push\n' >&2
    exit "$EXIT_CODE"
fi

# Commit-message convention validation. Runs only after ci-local passes (the
# fail branch above exits first). Skipped when moai is not on PATH so projects
# without moai installed are unaffected. The convention engine self-gates on its
# own enforce_on_push config, so this is a no-op unless enforcement is enabled.
if command -v moai >/dev/null 2>&1; then
    ZERO="0000000000000000000000000000000000000000"
    SUBJECTS="$(
        printf '%s\n' "$REFS" | while read -r local_ref local_oid remote_ref remote_oid; do
            [ -z "$local_oid" ] && continue
            if [ "$local_oid" = "$ZERO" ]; then
                # Branch deletion: nothing is being pushed for this ref.
                continue
            elif [ "$remote_oid" = "$ZERO" ]; then
                # New remote ref: enumerate commits not already on any remote.
                git log --format=%s "$local_oid" --not --remotes
            else
                git log --format=%s "$remote_oid".."$local_oid"
            fi
        done
    )"
    if [ -n "$SUBJECTS" ]; then
        printf '%s\n' "$SUBJECTS" | moai hook pre-push
    fi
fi

exit 0
`

// PrePushInstaller installs the MoAI-ADK pre-push git hook. It shares the
// hook-preservation machinery with the pre-commit installer
// (hook_install_shared.go): an existing marker-bearing hook is classified by
// provenance before any overwrite, and a user-modified hook is backed up and
// disclosed rather than silently replaced (t257).
type PrePushInstaller struct {
	// repoRoot is the root of the git repository.
	repoRoot string

	// content is the hook body this installer writes — the "incoming" operand
	// of the attribution. Defaults to prePushHookContent; overridden in tests
	// to construct a version bump without editing the shipped constant.
	content string

	// lastAttribution is the classification of the most recent install run
	// against an existing marker-bearing hook, or nil when the run classified
	// nothing (no existing hook, a non-MoAI hook, or skip=true).
	lastAttribution *hookAttribution

	// lastProvenanceErr holds a provenance-write failure from the most recent
	// run. The write happens after a hook write that already succeeded, so it
	// must not fail the caller; it is recorded rather than discarded so the
	// wrapper can warn about it.
	lastProvenanceErr error

	// lastBackupPath is the backup copy written for a user-modified hook in the
	// most recent run, or "" when no backup was taken. The wrapper reads it to
	// emit the disclosure notice.
	lastBackupPath string

	// now supplies the timestamp for backup names. A seam so tests can force
	// the same stamp twice and construct the occupied-path case.
	now func() time.Time
}

// NewPrePushInstaller creates a PrePushInstaller for the given repository root.
func NewPrePushInstaller(repoRoot string) *PrePushInstaller {
	return &PrePushInstaller{repoRoot: repoRoot, content: prePushHookContent, now: time.Now}
}

// InstallPrePushHook writes the pre-push hook to .git/hooks/pre-push with mode 0755.
//
// Behaviour:
//   - skip=true: no-op, returns nil.
//   - File does not exist: creates it, plus its provenance record.
//   - File exists with MoAI-ADK marker (first 3 lines): classified by the
//     shared three-way attribution — an unmodified hook is replaced quietly;
//     a user-modified (or undecidable-legacy, differing) hook is backed up to
//     `pre-push.bak.<stamp>` BEFORE the replacement.
//   - File exists WITHOUT marker: returns ErrUserHookExists without modifying the file.
func (p *PrePushInstaller) InstallPrePushHook(skip bool) error {
	p.lastAttribution = nil
	p.lastProvenanceErr = nil
	p.lastBackupPath = ""

	if skip {
		return nil
	}

	hookDir := filepath.Join(p.repoRoot, ".git", "hooks")
	if err := os.MkdirAll(hookDir, 0o755); err != nil {
		return fmt.Errorf("create hooks directory: %w", err)
	}

	hookPath := filepath.Join(hookDir, "pre-push")

	// Check if the file already exists.
	if _, err := os.Stat(hookPath); err == nil {
		// File exists — inspect first 3 lines for MoAI marker.
		hasMoaiMarker, err := fileHasMoaiMarker(hookPath)
		if err != nil {
			return fmt.Errorf("read existing hook: %w", err)
		}
		if !hasMoaiMarker {
			return ErrUserHookExists
		}
		// MoAI hook found — classify it before overwriting, exactly as the
		// pre-commit installer does: the verdict decides backup + disclosure.
		installed, err := os.ReadFile(hookPath)
		if err != nil {
			return fmt.Errorf("read existing hook: %w", err)
		}
		attribution := classifyHook(installed, readHookProvenance(hookDir, prePushTier), []byte(p.content))
		p.lastAttribution = &attribution

		// A user-modified hook is copied aside BEFORE the replacement is
		// written, so the patch is recoverable the moment the loss-bearing
		// overwrite happens (REQ-PCP-003 equivalent for the push tier).
		if attribution.Class == hookUserModified {
			backupPath, err := backupHook(hookDir, installed, p.now(), prePushTier)
			if err != nil {
				// The backup sits before the hook write, so a failure here
				// means the patch cannot be made recoverable — the hook is
				// left untouched and the caller is not failed; the wrapper
				// turns this into a warning. Overwriting anyway would destroy
				// the patch with no recoverable copy.
				return fmt.Errorf("%w: %w", errPrePushBackupFailed, err)
			}
			p.lastBackupPath = backupPath
		}
	}

	if err := os.WriteFile(hookPath, []byte(p.content), 0o755); err != nil {
		return fmt.Errorf("write pre-push hook: %w", err)
	}

	// Record what was just written, so the next run can attribute a
	// difference. A failure here follows a hook write that already succeeded,
	// so it must not fail the caller: the missing record self-heals on the
	// next run, which finds installed == incoming and re-stamps.
	p.lastProvenanceErr = writeHookProvenance(hookDir, p.content, prePushTier)

	return nil
}

// installPrePushHookOptional installs the pre-push hook into projectRoot's .git/hooks/
// unless skip is true. Friendly, non-fatal: prints progress to out, warnings to
// warn (a writer distinct from out — callers bind it to the command's stderr,
// the REQ-PCP-004 wiring the pre-commit wrapper uses), returns nothing. Used by
// `moai init` and `moai update` to install the hook consistently
// (REQ-CIAUT-002).
//
// If a non-MoAI user hook is present, this function preserves it and prints a
// note. Other errors are reported as warnings; project init/update is never
// blocked by hook installation failures.
func installPrePushHookOptional(projec
```

### Core Architecture Module: `internal/cli/hook_install_precommit.go`
```
package cli

import (
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"
)

// moaiPreCommitMarker is the identifier written near the top of the pre-commit
// hook file. Its presence signals that the hook was installed by MoAI-ADK and
// can be safely overwritten on subsequent installs.
const moaiPreCommitMarker = "# MoAI-ADK pre-commit hook"

// moaiPreCommitProvenanceName is the pre-commit provenance sidecar basename;
// see hookTier.provenanceName (hook_install_shared.go) for the rationale.
const moaiPreCommitProvenanceName = ".moai-pre-commit.sha256"

// preCommitBackupPrefix is the pre-commit backup basename prefix; see
// hookTier.backupPrefix (hook_install_shared.go) for the rationale.
const preCommitBackupPrefix = "pre-commit.bak."

// errPreCommitBackupFailed wraps a backup-write failure so the optional
// wrapper can turn it into a warning while leaving the hook untouched
// (REQ-PCP-010 sub-case (a)). It never reaches the caller as a failure.
var errPreCommitBackupFailed = errors.New("pre-commit backup failed")

// preCommitHookContent is the canonical content of the pre-commit hook. It
// runs the fast subset (gofmt -l + go vet on staged Go files) followed by the
// heavy quality gate via `moai gate` (vet + lint + test, 16-language detection).
//
// The heavy gate runs in the user's shell — outside Claude Code's 5s PreToolUse
// hook budget — eliminating the census C-2 silent-drop defect. This is the
// relocation surface for SPEC-PRETOOL-GATE-MOVE-001.
//
// MUST stay byte-identical with internal/template/templates/.git_hooks/pre-commit.
// TestPreCommitTemplateMatchesConstant enforces this; do not edit one without the other.
const preCommitHookContent = `#!/bin/sh
# MoAI-ADK pre-commit hook — fast subset (gofmt + go vet) + heavy gate (moai gate)
# Bypass via: SKIP_MOAI_PRECOMMIT=1 git commit
# Heavy gate (vet + lint + test, 16-language detection) runs in your shell, outside the 5s hook budget.
set -eu

if [ "${SKIP_MOAI_PRECOMMIT:-0}" = "1" ]; then
    printf '[pre-commit] SKIP_MOAI_PRECOMMIT=1 -- bypass requested\n' >&2
    exit 0
fi

# Staged Go files (Added / Copied / Modified; deletions excluded via ACM).
STAGED_GO="$(git diff --cached --name-only --diff-filter=ACM | grep '\.go$' || true)"

# --- Fast subset: gofmt + go vet on staged Go files (sub-second; skipped when none staged) ---
if [ -n "$STAGED_GO" ]; then
    # gofmt format check. Skipped when gofmt is not on PATH (non-Go environment).
    if command -v gofmt >/dev/null 2>&1; then
        NEED_FMT="$(
            printf '%s\n' "$STAGED_GO" | while IFS= read -r f; do
                [ -n "$f" ] || continue
                gofmt -l "$f" 2>/dev/null || true
            done
        )"
        if [ -n "$NEED_FMT" ]; then
            printf '\n[pre-commit] FAILED: the following staged files need formatting:\n%s\n' "$NEED_FMT" >&2
            printf '[pre-commit] Hint: gofmt -w <files> && git add <files>\n' >&2
            printf '[pre-commit] Override: SKIP_MOAI_PRECOMMIT=1 git commit\n' >&2
            exit 1
        fi
    fi

    # go vet on the affected packages. Skipped when go is not on PATH (non-Go environment).
    if command -v go >/dev/null 2>&1; then
        PKGS="$(
            printf '%s\n' "$STAGED_GO" | while IFS= read -r f; do
                [ -n "$f" ] || continue
                printf './%s\n' "$(dirname "$f")"
            done | sort -u
        )"
        if [ -n "$PKGS" ]; then
            # Optional Go build tags (.moai/config/build-tags, first non-comment
            # non-blank line) so projects requiring non-default tags (e.g. goolm)
            # are vetted under them.
            BT_TAGS=""
            if [ -f .moai/config/build-tags ]; then
                _bt_line="$(sed -e 's/#.*//' .moai/config/build-tags | awk 'NF{print; exit}')" || true
                [ -n "$_bt_line" ] && BT_TAGS="-tags=$_bt_line"
            fi
            # shellcheck disable=SC2086
            if ! go vet $BT_TAGS $PKGS >/dev/null 2>&1; then
                printf '\n[pre-commit] FAILED: go vet reported issues in the staged packages.\n' >&2
                printf '[pre-commit] Hint: run go vet on the affected packages, fix, then re-commit.\n' >&2
                printf '[pre-commit] Override: SKIP_MOAI_PRECOMMIT=1 git commit\n' >&2
                exit 1
            fi
        fi
    fi
fi

# --- Heavy gate: vet + lint + test via 'moai gate' (16-language toolchain detection) ---
# Runs in the user's shell, outside Claude Code's 5s PreToolUse hook budget.
# Skipped when moai is not on PATH so non-moai downstream projects pass silently.
if command -v moai >/dev/null 2>&1; then
    if ! moai gate; then
        printf '\n[pre-commit] FAILED: moai gate reported errors above.\n' >&2
        printf '[pre-commit] Hint: address the reported issues, then re-commit.\n' >&2
        printf '[pre-commit] Override: SKIP_MOAI_PRECOMMIT=1 git commit\n' >&2
        exit 1
    fi
fi

exit 0
`

// PreCommitInstaller installs the MoAI-ADK pre-commit git hook. It mirrors
// PrePushInstaller's marker-based semantics for the commit tier.
type PreCommitInstaller struct {
	// repoRoot is the root of the git repository.
	repoRoot string

	// content is the hook body this installer writes — the "incoming" operand
	// of the attribution. Defaults to preCommitHookContent; overridden in tests
	// to construct a version bump without editing the shipped constant.
	content string

	// lastAttribution is the classification of the most recent install run
	// against an existing marker-bearing hook, or nil when the run classified
	// nothing (no existing hook, a non-MoAI hook, or skip=true).
	lastAttribution *hookAttribution

	// lastProvenanceErr holds a provenance-write failure from the most recent
	// run. The write happens after a hook write that already succeeded, so it
	// must not fail the caller (REQ-PCP-010); it is recorded rather than
	// discarded so M2 can warn about it.
	lastProvenanceErr error

	// lastBackupPath is the backup copy written for a user-modified hook in the
	// most recent run, or "" when no backup was taken. The wrapper reads it to
	// emit the disclosure notice (REQ-PCP-004).
	lastBackupPath string

	// now supplies the timestamp for backup names. A seam so tests can force
	// the same stamp twice and construct REQ-PCP-009's occupied-path Given.
	now func() time.Time
}

// NewPreCommitInstaller creates a PreCommitInstaller for the given repository root.
func NewPreCommitInstaller(repoRoot string) *PreCommitInstaller {
	return &PreCommitInstaller{repoRoot: repoRoot, content: preCommitHookContent, now: time.Now}
}

// InstallPreCommitHook writes the pre-commit hook to .git/hooks/pre-commit with
// mode 0755.
//
// Behaviour (mirror of InstallPrePushHook):
//   - skip=true: no-op, returns nil.
//   - File does not exist: creates it.
//   - File exists with MoAI-ADK marker (first 3 lines): overwrites safely.
//   - File exists WITHOUT marker: returns ErrUserHookExists without modifying the file.
//
// The installer is config-agnostic: it never reads the
// git_strategy.<mode>.hooks.pre_commit field. Materializing that field's
// declared intent is achieved by making a real hook exist and run the fast
// subset at commit time; a runtime severity dial is a separate follow-up.
func (p *PreCommitInstaller) InstallPreCommitHook(skip bool) error {
	p.lastAttribution = nil
	p.lastProvenanceErr = nil
	p.lastBackupPath = ""

	if skip {
		return nil
	}

	hookDir := filepath.Join(p.repoRoot, ".git", "hooks")
	if err := os.MkdirAll(hookDir, 0o755); err != nil {
		return fmt.Errorf("create hooks directory: %w", err)
	}

	hookPath := filepath.Join(hookDir, "pre-commit")

	// Check if the file already exists.
	if _, err := os.Stat(hookPath); err == nil {
		// File exists — inspect first 3 lines for the MoAI pre-commit marker.
		hasMarker, err := fileHasMarker(hookPath, moaiPreCommitMarker)
		if err != nil {
			return fmt.Errorf("read existing hook: %w", err)
		}
		if !hasMarker {
			return ErrUserHookExists
		}
		// MoAI hook found — classify it before overwriting. The verdict is
		// recorded, not acted on: M1 decides, M2 hangs the backup and the
		// notice off the decision.
		installed, err := os.ReadFile(hookPath)
		if err != nil {
			return fmt.Errorf("read existing hook: %w", err)
		}
		attribution := classifyHook(installed, readHookProvenance(hookDir, preCommitTier), []byte(p.content))
		p.lastAttribution = &attribution

		// REQ-PCP-003: a user-modified hook is copied aside BEFORE the
		// replacement is written, so the patch is recoverable the moment the
		// loss-bearing overwrite happens.
		if attribution.Class == hookUserModified {
			backupPath, err := backupHook(hookDir, installed, p.now(), preCommitTier)
			if err != nil {
				// REQ-PCP-010 sub-case (a): the backup sits before the hook
				// write, so a failure here means the patch cannot be made
				// recoverable — the hook is left untouched and the caller is
				// not failed; the wrapper turns this into a warning. Overwriting
				// anyway would destroy the patch with no recoverable copy,
				// the exact outcome REQ-PCP-006 forbids.
				return fmt.Errorf("%w: %w", errPreCommitBackupFailed, err)
			}
			p.lastBackupPath = backupPath
		}
	}

	if err := os.WriteFile(hookPath, []byte(p.content), 0o755); err != nil {
		return fmt.Errorf("write pre-commit hook: %w", err)
	}

	// Record what was just written, so the next run can attribute a difference
	// (REQ-PCP-001). A failure here follows a hook write that already
	// succeeded, so it must not fail the caller (REQ-PCP-010): the missing
	// record self-heals on the next run, which finds installed == incoming and
	// re-stamps.
	p.lastProvenanceErr = writeHookProvenance(hookDir, p.content, preCommitTier)

	return nil
}

// installPreCommitHookOptional installs the pre-commit hook into projectRoot's
// .git/hooks/ unless skip is true. Friendly, non-fatal: prints progress to out,
// warnings to warn (a writer distinct from out — both callers
```

### Core Architecture Module: `internal/cli/hook_install_shared.go`
```
package cli

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// This file carries the tier-generic core of the hook-preservation machinery
// introduced by SPEC-PRECOMMIT-PRESERVE-001 (t230) for the pre-commit hook and
// extended to the pre-push hook by card t257: the three-way attribution
// classifier, the provenance sidecar, and the pre-replacement backup. Both
// installers share this single implementation — a per-tier second copy is
// forbidden (t257 card scope (2)); per-hook differences live in the hookTier
// value each installer passes in.

// hookTier names the per-hook constants of one install tier. Everything the
// shared machinery needs to specialize its behaviour — messages, sidecar name,
// backup prefix — is carried here so the algorithm itself is written once.
type hookTier struct {
	// label names the hook in human-facing error messages ("pre-commit",
	// "pre-push").
	label string

	// provenanceName is the sidecar basename recording the SHA-256 of the hook
	// content this tool last wrote. It lives beside the hook in .git/hooks/,
	// so it shares the hook's lifetime exactly: wiping .git/hooks/ takes both.
	//
	// The record is the third operand of the attribution in REQ-PCP-014.
	// Without it only "installed" and "incoming" exist, and those two cannot
	// separate "the user changed it" from "we changed it" — a routine version
	// bump then reads as a user patch for every user on every release.
	provenanceName string

	// backupPrefix is the basename prefix of the backup copies taken before a
	// user-modified hook is replaced: `<hook>.bak.<stamp>`, the pattern
	// REQ-PCP-003 names. The stamp is a colon-free UTC form (20060102T150405Z)
	// — RFC3339 proper contains `:`, which is illegal in a Windows filename,
	// and a backup the user cannot create/read on their own platform is not a
	// backup.
	backupPrefix string
}

// preCommitTier is the pre-commit specialization of the shared machinery.
var preCommitTier = hookTier{
	label:          "pre-commit",
	provenanceName: moaiPreCommitProvenanceName,
	backupPrefix:   preCommitBackupPrefix,
}

// prePushTier is the pre-push specialization of the shared machinery (t257).
var prePushTier = hookTier{
	label:          "pre-push",
	provenanceName: moaiPrePushProvenanceName,
	backupPrefix:   prePushBackupPrefix,
}

// hookClass is the attribution verdict for an existing marker-bearing hook.
type hookClass int

const (
	// hookUnmodified: the hook is as MoAI last wrote it. Any difference
	// against the incoming content is an upstream version bump, so the
	// overwrite is quiet (REQ-PCP-002).
	hookUnmodified hookClass = iota
	// hookUserModified: the hook was edited after MoAI wrote it. This is the
	// loss-bearing case; the backup and the notice hang off it.
	hookUserModified
)

func (c hookClass) String() string {
	if c == hookUserModified {
		return "user-modified"
	}
	return "unmodified"
}

// hookBasis names which operands produced the verdict — the third label of the
// three-way classification, kept separate from the verdict because
// "undecidable-legacy" describes how the answer was reached, not what it was.
type hookBasis int

const (
	// hookBasisRecord: a usable provenance record existed, so the verdict
	// comes from installed-vs-recorded — the three-way comparison.
	hookBasisRecord hookBasis = iota
	// hookBasisUndecidableLegacy: no usable record existed, so attribution was
	// impossible and the verdict falls back to installed-vs-incoming, with any
	// difference read as a user edit (REQ-PCP-005). Deliberately the noisy
	// direction: a hand-patched legacy hook is the most likely thing to be
	// found without a record.
	hookBasisUndecidableLegacy
)

func (b hookBasis) String() string {
	if b == hookBasisUndecidableLegacy {
		return "undecidable-legacy"
	}
	return "record"
}

// hookAttribution is one classification of an existing marker-bearing hook.
type hookAttribution struct {
	Class hookClass
	Basis hookBasis
}

// classifyHook decides whether an existing marker-bearing hook was edited by
// the user, from three operands: the installed bytes, the digest this tool
// last recorded writing (empty when absent or unusable), and the incoming
// bytes.
//
// A two-way comparison of installed against incoming cannot make this call: an
// upstream version bump produces the same signal as a user patch, so a two-way
// design warns every user on every release that touches the hook (REQ-PCP-014).
func classifyHook(installed []byte, recordedDigest string, incoming []byte) hookAttribution {
	if recordedDigest == "" {
		// No usable record: attribution is impossible, so fall back to
		// installed-vs-incoming and read any difference as a user edit.
		if bytes.Equal(installed, incoming) {
			return hookAttribution{Class: hookUnmodified, Basis: hookBasisUndecidableLegacy}
		}
		return hookAttribution{Class: hookUserModified, Basis: hookBasisUndecidableLegacy}
	}

	if digestOfBytes(installed) == recordedDigest {
		return hookAttribution{Class: hookUnmodified, Basis: hookBasisRecord}
	}
	return hookAttribution{Class: hookUserModified, Basis: hookBasisRecord}
}

// readHookProvenance returns the recorded digest, or "" when no usable record
// exists. A missing, unreadable or malformed record is treated as absent,
// which routes the caller to the deliberately noisy legacy path (REQ-PCP-005).
func readHookProvenance(hookDir string, tier hookTier) string {
	raw, err := os.ReadFile(filepath.Join(hookDir, tier.provenanceName))
	if err != nil {
		return ""
	}
	digest := strings.TrimSpace(string(raw))
	if len(digest) != hex.EncodedLen(sha256.Size) {
		return ""
	}
	if _, err := hex.DecodeString(digest); err != nil {
		return ""
	}
	return digest
}

// writeHookProvenance records the digest of the content just written.
func writeHookProvenance(hookDir, content string, tier hookTier) error {
	path := filepath.Join(hookDir, tier.provenanceName)
	if err := os.WriteFile(path, []byte(digestOfBytes([]byte(content))+"\n"), 0o644); err != nil {
		return fmt.Errorf("write %s provenance record: %w", tier.label, err)
	}
	return nil
}

func digestOfBytes(b []byte) string {
	sum := sha256.Sum256(b)
	return hex.EncodeToString(sum[:])
}

// backupHook copies the pre-run hook bytes to a timestamped backup in hookDir
// and returns the path chosen. The name is `<hook>.bak.<UTC colon-free
// stamp>`; when a candidate path is occupied a distinct sibling suffix is
// chosen instead — an existing backup is never overwritten (REQ-PCP-009).
// O_EXCL makes the never-clobber guarantee hold even if a file appears between
// the choice and the write.
func backupHook(hookDir string, preRun []byte, now time.Time, tier hookTier) (string, error) {
	stamp := now.UTC().Format("20060102T150405Z")
	for i := 0; ; i++ {
		name := tier.backupPrefix + stamp
		if i > 0 {
			name = fmt.Sprintf("%s.%d", name, i)
		}
		path := filepath.Join(hookDir, name)
		f, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o755)
		if err != nil {
			if os.IsExist(err) {
				continue // occupied: pick a distinct name, never clobber
			}
			return "", fmt.Errorf("back up user-modified %s hook to %s: %w", tier.label, path, err)
		}
		if _, err := f.Write(preRun); err != nil {
			_ = f.Close()
			return "", fmt.Errorf("back up user-modified %s hook to %s: %w", tier.label, path, err)
		}
		if err := f.Close(); err != nil {
			return "", fmt.Errorf("back up user-modified %s hook to %s: %w", tier.label, path, err)
		}
		return path, nil
	}
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1735** (2026-10-03): **Codex 읽기 전용 감사 역할의 sandbox_mode 불일치로 plan-auditor 실행 실패**
  *Symptoms*: ## 재현  1. `moai version` → `moai-adk v3.2.0-rc.22`, commit `69bfbafb2`. 2. 설치된 `.codex/agents/moai/plan-auditor.toml:726`에 `sandbox_mode = "workspace-write"`가 선언되어 있다. `sync-auditor.toml:171`과 `super-advisor.toml:133`도 같다. 3. `mcp__moai__codex_role_audit(role="plan-auditor", worktree_root="~/MoAI/moai-cowork", out=".moai/reports/t1/plan-verdict.md", task="Read-only independent adversarial plan gate ...")` 호출 → `codex_role_audit: codex audit plan-auditor: role "plan-auditor" file declares sandbox_mode "workspace-write", not read-only`.  ## 기대 결과  읽기 전용 감사 역할이 `codex_role_audit`의 read-only 계약을 충족해 계획 감사가 시작되고 독립 판정이 생성된다.  ## 실제 결과와 영향  설치된 Codex 역할 TOML의 sandbox 선언과 감사 실행기의 검증 조건이 충돌해 감사가 시작되지 않는다. 이 저장소의 t1 카드에서는 `moai spec lint SPEC-MOC-QUESTION-CHANNEL-001 --json`이 `[]`를 반환했지만 독립 계획 감사가 막혀 run 단계에 진입할 수 없다.  ## 수정 위치  이 저장소의 `.codex/agents/moai/*.toml`은 설치본이므로 여기서 고치지 않았다. MoAI-ADK 배포 원본의 역할 생성 규칙과 감사 실행기 계약을 정합해 달라. 세 역할만 확인했으며 다른 읽기 전용 역할 전체의 상태는 아직 조사하지 않았다.  
  **Post-Mortem & Fix Analysis**:
  > 카드 t1471로 고쳤고 `develop`에 병합됐습니다(`972797603`).  **원인** 배포된 템플릿에는 문제가 없었습니다. 감사 실행기가 낡은 프로젝트 사본을 읽은 것이 원인이었습니다. - 감사 실행기는 역할 파일을 **프로젝트의** `.codex/agents/moai/<role>.toml`에서 읽고, read-only가 아니면 거부했습니다(`internal/cli/codex_audit_launch.go`). - 반면 어떤 역할을 실행할 수 있는지는 **바이너리에 임베드된** 매니페스트로 판단했습니다. 두 판단의 출처가 달랐던 겁니다. - `llm.yaml`이 `harness: claude`인 프로젝트에서는 `moai update`가 `.codex/`를 숨김 처리해 갱신하지 않습니다(`internal/template/harness_fs.go`). 그래서 예전 `sandbox_mode = "workspace-write"` 사본이 그대로 남아 있었고, plan-auditor가 거부됐습니다. 템플릿 자체는 이미 read-only로 바뀐 뒤였습니다.  **수정** `codexAuditLoadRole`이 이제 역할 파일을 바이너리에 임베드된 템플릿에서 읽습니다. 실행 가능 여부 판단과 역할 내용이 같은 출처를 쓰므로, 프로젝트 사본이 낡았거나 아예 없어도 실행됩니다. read-only 확인은 임베드된 내용에 그대로 적용됩니다.  **검증** 회귀 테스트 `TestCodexAuditLaunchRoleFromEmbedded`가 두 경우(낡은 workspace-write 사본, 사본 없음)를 다룹니다. 수정 전 실패를 먼저 확인했고, 수정 후 통과합니다. `go vet`(Windows 포함)도 통과했습니다.  **동작 변화** 프로젝트에서 감사 역할 지시문을 직접 고쳐 쓰던 방식은 이제 반영되지 않습니다. 독립 감사자는 설치된 바이너리의 지시문을 따릅니다.  다음 릴리스에 포함됩니다. 이 이슈는 닫습니다.  🗿 MoAI 

- **Issue #1732** (2026-10-03): **moai todo add 가 near-duplicate 판정 카드를 행 생성 없이 주석으로 흡수 (3회 재현)**
  *Symptoms*: ## 설명 `moai todo add`가 near-duplicate 판정 카드를 큐 행 생성 없이 기존 행의 주석으로 흡수합니다 — 발행 응답은 성공 id(예: `t1296 10`)를 반환하지만 `moai todo` 목록에 해당 행이 전혀 나타나지 않고, 대신 유사한 기존 행에 "↳ near-duplicate t129X (jev, model signal p=0.94) — moai todo drop t1293" 주석만 부착됩니다.  ## 재현 (2026-09-28, 3회) 1. `moai todo add "…t1293 실패2 분리…"` → 응답 `t1296 10` — 큐에 t1296 행 없음 2. 문구를 바꿔 재발행 → `t1297 10` — 행 없음 3. 어휘 거리를 최대화한 재발행 → `t1299 11` — 행 없음 (의미 유사도 기반 판정으로 추정)  ## 기대 동작 kanban-dispatch 독트린("분석은 관계를 기록한다 — 카드를 접지 않는다, never folds the related card away")대로 near-duplicate 판정이 나더라도 행은 생성되고 주석만 붙어야 합니다. 또는 add 결과에 `absorbed-into:<id>`가 명시되어야 합니다.  ## 위험 1. 발행 응답이 성공 id를 반환해 발행자가 착지로 오인 (관측 없는 완료 주장 유발) 2. 흡수 주석이 진행 중 카드에 `drop` 실행을 제안 — 실제로 drop하면 감사 통과·병합 직전 카드의 작업이 상실됩니다.  ## 증거 - 2026-09-28 리드 세션 전사 (3회 발행 관측) - `.moai/reports/t1293/verdict.md` §Gaps (원본 카드 내용)  ## 우선순위 High — 카드 발행이 조용히 사라져 작업 손실 위험  ## 환경 정보 - MoAI: v3.2.0-rc.16 - OS: Darwin 27.0.0 arm64  
  **Post-Mortem & Fix Analysis**:
  > 카드 t1470으로 고쳤고 `develop`에 병합됐습니다(`16bbd97e7`).  **원인** `todoFindingLine`(`internal/cli/todo_analysis.go`)이 drop/edit 제안에 발견의 대상(subject)이 아니라 **그 줄이 찍히는 행의 카드 id**를 넣고 있었습니다. 그래서 먼저 있던 카드(t1293) 아래에 새 카드(t1296)에 대한 near-duplicate 발견이 표시되면, 안내 문구가 `moai todo drop t1293`이 되어 원본을 지우라고 권했습니다. `moai todo why`도 같은 렌더러를 써서 같은 문제가 있었습니다.  **수정** 제안 인자를 `f.SubjectID`로 바꿨습니다. 이제 원본 카드 아래에서도 drop/edit 안내는 새로 들어온 카드를 가리킵니다. subject 자신의 행 아래에서는 출력이 이전과 같습니다.  **검증** 회귀 테스트 `TestTodoFindingLineSuggestsDroppingTheSubjectNotTheRow`는 수정 전에 실패하는 것을 먼저 확인하고 커밋했고, 수정 후 통과합니다. 발견 줄 관련 테스트 82건도 모두 통과했습니다.  **이번 수정 범위 밖** "행이 목록에 안 보인다"는 부분은 원인이 다릅니다. 출력되는 순번은 queued 카드만 세는데 목록은 picked 카드까지 포함해 한도(당시 20)에서 잘렸고, 잘렸다는 안내는 stderr에만 나왔던 것으로 추정합니다. 이 부분은 t1313(stale 저장소 경고)과 목록 한도를 100으로 올린 변경이 완화했고, 이번 수정에서 따로 고친 것은 없습니다.  다음 릴리스에 포함됩니다. 이 이슈는 닫습니다.  🗿 MoAI 

- **Issue #1716** (2026-09-28): **격리 작업 트리에 .moai가 없어 codex_audit가 감사를 거부함**
  *Symptoms*: ## 설명 `moai worktree new cowork-desktop-portability`로 만든 격리 작업 트리에서 스킬 변경의 적대적 감사를 실행하려 했으나, `mcp__moai__codex_audit(mode="adversarial", target="uncommittedChanges", project_root="~/MoAI/moai-cowork/.claude/worktrees/cowork-desktop-portability")`가 `.moai` 디렉터리가 없다며 거절했다. `git rev-parse --show-toplevel`은 해당 작업 트리를 반환하고, `.moai`는 실제로 존재하지 않는다.  ## 기대한 동작 MoAI의 작업 트리 진입 경로로 만든 격리 작업 트리의 변경을 감사한다. 또는 작업 트리 생성 시 필요한 프로젝트 설정을 안전하게 제공한다.  ## 실제 동작 `codex_audit: project_root ".../cowork-desktop-portability" has no .moai directory, so it is not a MoAI project root` (`isError: true`). `project_root`를 빼면 서버가 기본 체크아웃을 감사해 변경 사항을 놓친다. 기본 체크아웃의 `.moai`를 작업 트리에 연결하는 임시 우회는 하지 않았다.  ## 재현 및 영향 1. `moai worktree new cowork-desktop-portability` 실행. 2. 해당 작업 트리에서 스킬 변경. 3. 위 `codex_audit` 호출. 4. 커밋 전 필수 적대적 감사가 실행되지 않음.  우선순위: 보통. 환경: macOS, MoAI MCP build v3.2.0-rc.13 (60017eb83), 2026-09-24. 
  **Post-Mortem & Fix Analysis**:
  > ## 원인 분석 (`develop` @ `df526c9a9` 소스 판독)  **원인.** `project_root` 검증은 해당 트리 안에 `.moai` 디렉터리가 있는지만 확인합니다.  - `internal/cli/mcp_project_root.go:185-188`: `validateProjectRoot` 는 `.moai` 가 없으면 거부합니다. - `internal/cli/session_worktree.go:205-250`: `moai worktree new` 의 `materializeSessionWorktree` 는 작업 트리만 추가할 뿐 `.moai` 를 따로 마련하지 않습니다. - `.moai` 를 저장소에 커밋하지 않은 프로젝트에서는 새 작업 트리에 `.moai` 가 생기지 않습니다. 예를 들어 moai-cowork 는 `gh api repos/modu-ai/moai-cowork/contents/.moai` 가 404 를 돌려줍니다.  **결과.** 이런 프로젝트의 격리 작업 트리를 `project_root` 로 넘기면, `codex_audit` 를 비롯해 `project_root` 를 받는 도구 13개가 모두 이를 거부합니다. 보고하신 현상과 일치합니다.  **진행 상황.** 코드를 읽어 원인은 확인했지만 아직 재현하지는 않았습니다. 해법이 두 가지라 설계 문서를 먼저 씁니다. - (a) linked worktree 는 git common dir 기준으로 primary 체크아웃의 `.moai` 를 보고 판정합니다. - (b) 작업 트리를 만들 때 `.moai` 를 함께 마련합니다.  반영되면 이 이슈에 다시 알려 드리겠습니다. 
  > `develop` 에서 수리됐습니다 — 2d3bd5061 (카드 t1202·t1213, SPEC-WORKTREE-STATE-ROOT-001).  이제 `.moai` 를 커밋하지 않은 저장소의 linked worktree 도 `project_root` 로 받아들입니다. git 이 해당 트리를 `.moai` 를 가진 primary 체크아웃의 worktree 로 등록하고 있으면 검사가 통과하고, 감사 게이트는 primary 체크아웃에서 읽으며 SPEC 목록은 worktree 와 primary 의 `.moai/specs` 합집합으로 동작합니다(`internal/cli/mcp_project_root.go`). `moai worktree new` 로 만든 격리 트리에서 `codex_audit` 이 더 이상 거절되지 않습니다.  이 커밋은 `origin/develop` 에 있으며 다음 릴리스에 포함됩니다. 

- **Issue #1675** (2026-09-13): **폴백 프로필(__no_such_profile__)에서 statusline이 프로젝트 statusline.yaml 설정을 무시 — gh 폴링 부활·issues/PR 0/0 표시**
  *Symptoms*: ## 설명 [버그 보고] 세션이 프로필 폴백(__no_such_profile__)으로 기동되면 statusline이 프로젝트의 .moai/config/sections/statusline.yaml 설정을 읽지 않고 템플릿 기본값(16세그먼트 전부 on)으로 렌더합니다.  ## 재현 경로 (2026-08-27 실측) 1. 프로젝트 statusline.yaml에 `github: false` + `forge: none` 세팅(2026-08-17 운영자 지시 — 이 세그먼트가 상태줄 갱신마다 gh API를 폴링해 GitHub 속도제한 429에 기여했으므로 렌더·갱신 모두 차단했음) 2. 프로필 지정 없이 세션 기동 — `~/.moai/claude-profiles/__no_such_profile__/`에 런타임 상태(daemon.log·.claude.json, 2026-08-27 12:49 타임스탬프)가 활발히 쌓이는 것을 관측. launch.yaml의 `projects:` 매핑(~/MoAI/mo.ai.kr → mo.ai.kr)은 정상 3. 상태줄에 📡 github 세그먼트가 부활해 렌더됨 — gh API 카운트 폴링이 실패해 issues/PR이 0/0 폴백 표시 4. 실제 GitHub 상태는 open issues 11·open PR 8(gh api repos/... 실측) — 저장소 이상 없음, 표시 전용 결함  ## 기대 동작 - 폴백 프로필에서도 statusline 세그먼트 구성이 프로젝트(또는 글로벌) statusline.yaml을 존중해야 함 - 또는 폴백 컨텍스트에서 gh 폴링 세그먼트(github)의 기본값이 off여야 함 — 8/17에 차단한 속도제한 기여 경로가 조용히 부활하는 것을 구조적으로 방지 - 프로필 매핑이 정상임에도 __no_such_profile__ 폴백이 발생하는 원인(프로필 결정 경로)도 함께 점검 필요  ## 우선순위 Medium — 기능 영향은 표시뿐이나, 운영자가 차단한 gh API 폴링이 조용히 부활하는 것은 속도제한 회귀 경로  ## 환경 정보 - MoAI version: 3.1.2 - OS: Darwin 25.6.0 arm64 (macOS) 
  **Post-Mortem & Fix Analysis**:
  > 재검증 결과를 공유드리고 이 이슈를 닫습니다.  **측정 방법** `/tmp` 격리 프로젝트에서 `gh` 호출을 기록하는 스텁을 PATH 맨 앞에 두고, 배포된 v3.1.2 바이너리와 현재 develop 빌드를 같은 조건으로 돌렸습니다. yaml을 뺀 양성 대조군에서는 두 바이너리 모두 렌더 1회당 `gh` 호출 2회가 기록돼, 계수 장치가 실제로 작동함을 확인했습니다.  | 조건 | v3.1.2 | develop | |---|---|---| | `forge: none` + `segments.github: false`, 폴백 프로필 환경 | 0회 | 0회 | | 같은 yaml, 프로필 환경 없음 | 0회 | 0회 | | `segments.github: false`만 설정(`forge:` 없음) | **2회** | 폴링 차단(세그먼트 스위치가 호출 단계까지 적용) | | yaml 없음(양성 대조군) | 2회 | 2회 |  **결론** 1. 제보하신 핵심 조건(폴백 프로필 + `github: false` + `forge: none`)에서는 v3.1.2에서도 폴링이 되살아나지 않았습니다. develop에 들어간 수리 역시 같은 조건에서 0회를 유지합니다. 2. 다만 v3.1.2에서는 `segments.github: false`가 **표시만 끄고 폴링은 끄지 않는** 반쪽짜리 스위치였다는 점이 실측으로 드러났습니다. 그 버전에서 폴링을 실제로 막은 것은 `forge: none`이었습니다. develop에서는 세그먼트 스위치 하나로 폴링까지 멈추도록 이미 고쳐져 있으며, 다음 릴리스로 전달됩니다. 3. `0/0` 표시는 조회에 실패했을 때 캐시의 0 값이 그대로 그려지는 경로(`internal/statusline/renderer.go`)에서 나옵니다. 4. `__no_such_profile__`은 현재 코드 어디에서도 만들어지거나 선택되지 않습니다. 8월 말 프로브 시기에 남은 디스크 잔재로 보이며, `~/.moai/claude-profiles/` 아래에서 직접 지우셔

- **Issue #1661** (2026-09-13): **graph-freshness 체크가 origin/main HEAD에서 실패 — codemaps 스탬프 객체가 체크아웃에 부재 (#1648 착지 결함)**
  *Symptoms*: ## 설명  t250 (#1648, squash `6786c3fa4`)로 도입된 graph-freshness CI 체크가 origin/main HEAD 자체에서 failure입니다. `./bin/moai graph check`가 codemaps 스탬프 SHA를 `git diff` 기준으로 비교하는데, 해당 객체가 CI 체크아웃에 존재하지 않아 시스템 오류로 즉시 실패합니다.  ## 관측된 출력  - main HEAD (`6786c3fa4`) check-runs: graph-freshness conclusion=failure (2026-08-25T18:39:26Z) - PR #1657 (markdown-only)에서 동일 실패:  ``` graph check: system error: codemaps stamp 0d15864ae90b not comparable in this checkout: git diff 0d15864ae90b: exit status 128: fatal: bad object 0d15864ae90b062bea6f4f30226eab07f6068100 ```  ## 재현 절차  1. `gh api "repos/modu-ai/moai-adk/commits/main/check-runs"` — graph-freshness conclusion=failure 확인 2. 임의 PR에서 graph-freshness 잡 로그 확인 — 위와 동일한 "bad object" 시스템 오류  ## 원인 가설  스탬프 `0d15864ae90b`가 squash 머지로 소실된 사전-squash 객체(개발 브랜치 시점 commit/tree)를 참조 — fresh checkout에서 도달 불가. non-required 체크라 머지는 막히지 않으나 main이 상시 빨간 상태로 유지됩니다.  ## 기대 동작  스탬프가 fresh checkout에서 항상 도달 가능한 객체(origin/main 도달 SHA)만 참조하도록 스탬프 기록/검증을 수정하거나, 도달 불가 시 스킵/경고로 강등해야 합니다.  ## 우선순위  High — main 브랜치 CI가 빨간 상태로 유지됩니다.  ## 환경 정보  - 관측 저장소: modu-ai/moai-adk (origin/main @ 6786c3fa4, PR #1657) - 관측 도구: gh api / gh run view --log-failed 
  **Post-Mortem & Fix Analysis**:
  > Root cause confirmed and remediation in flight: the squash merge of #1648 orphaned the codemaps provenance stamp commit 0d15864ae (branch-only object), making every checkout report not-comparable. The t279 follow-up branch (WT-t250-followup) carries an emergency restamp against main-reachable c9eed8ac6 (commit 52f7ba135) — merging it breaks the inherited red. Structural fix (pre-merge CI guard verifying the stamp commit is a PR-base ancestor) recorded as F5 in .moai/reports/t279/triage-table.md. Will close once the restamp lands on main.
  > 경과 보고드립니다. 보고하신 원인 — 스쿼시 머지로 스탬프 객체(0d15864ae)가 고아가 되어 생긴 system error — 자체는 수리됐습니다. main 스탬프 수리가 #1665(`da791eb0a`)로 main 에 착지했고, 워크플로에는 PR 베이스에서 스탬프 커밋 도달 가능성을 머지 전에 검증하는 가드가 들어갔습니다.  다만 main 은 지금도 빨간 상태이고, 원인이 바뀌었습니다. 최신 main(`7374b183e`, 2026-09-10 실행)에서 graph check 는 system error 가 아니라 codemaps 레이어 staleness 로 실패합니다: `layer codemaps verdict=stale metric=described-source-diff value=45 threshold=40`. 즉 보고하신 「객체 부재」 결함은 닫혔고, 지금 빨간 것은 스탬프가 설명하는 내용과 소스 사이의 드리프트(문턱 초과)입니다. 이 축은 본 이슈의 결함과 별개라, codemaps 재스탬프를 별도 triage 로 갈라 처리하겠습니다.  원 결함 기준으로는 해소됐지만 main 이 계속 빨간 만큼 staleness 원인 정리가 끝날 때까지 이 이슈는 열어 둡니다. 이후 이 이슈는 원 결함(고아 스탬프) 기준으로 닫고, staleness 드리프트는 후속 이슈로 옮기는 쪽이 정확해 보입니다 — 이견 있으면 남겨 주세요.
  > 카드 t688(SPEC-GRAPH-STAMP-ANCESTRY-001)로 수리해 develop `c81955d7e`(origin/develop `d416f8162` 배치)에 착지했습니다.  - checker가 freshness 계산 전에 스탬프 SHA의 HEAD 조상성을 먼저 판정 — 비조상이면 측정값 없이 exit 2(시스템 오류)로 분리 - CI push 분기는 TARGET=HEAD 조상성으로 판정(객체 존재만으로 exit 0 하던 경로 제거) - CLI 복구 문구를 regenerate + reachable stamp로 정정, codemaps 5문서 실재 재생성 후 재스탬프 - 병합 트리 실측: codemaps value 2/40 fresh, citations 0/0 fresh (이전 261/40, 1/0)  main 반영은 다음 release PR 시점입니다. CI 판정(Graph Freshness on `d416f8162`)은 별도로 읽고 있습니다.  🗿 MoAI

- **Issue #1660** (2026-09-13): **goal_arm MCP 래퍼가 산문 조건을 mechanical로 통째 저장 — model 조건 분류 누락으로 매 턴엔드 exit 2 차단**
  *Symptoms*: ## 설명  `mcp__moai__goal_arm` MCP 도구는 condition 문자열을 CLI 파서(parseCondition)의 model/mechanical 분류를 거치지 않고 conditions[0] = {type: "mechanical", cmd: <전체 문자열>} 단일 항목으로 저장합니다. run.md § Run-phase Autonomy (ac_converge)의 canonical 조건처럼 전체가 model condition으로 저작된 산문을 MCP로 arm하면, stop-goal 평가자가 그 산문을 shell 명령으로 실행해 매 턴엔드 exit 2로 차단합니다(수렴 불가능 — 천장 30턴까지 차단 지속). 우회: 순수 shell 명령 조건으로 재무장하면 정상 동작합니다.  ## 재현 절차  1. `mcp__moai__goal_arm` 호출 — condition에 run.md의 ac_converge 원문 형태 산문 전달 (예: "Every blocking acceptance criterion in .moai/specs/SPEC-XXX/spec.md has its PASS evidence surfaced in the conversation ...") 2. `goal_status` 확인 → conditions[0] = {"type":"mechanical","cmd":"Every blocking acceptance criterion ..."} (산문 전체가 cmd로 저장) 3. 다음 턴엔드에 Stop hook (handle-stop-goal.sh) 차단 발생  ## 관측된 출력  - arm 응답: `{"action":"arm","ceiling_maxturns":30,"condition_type":"mechanical",...}` - goal_status: conditions[0].cmd = 산문 전체 (model condition으로 분류되지 않음) - Stop hook 오류: `mechanical condition failed: cmd "Every blocking ..." exited 2 (want 0)`  ## 기대 동작  goal_arm MCP 래퍼가 CLI `/moai goal` 파서와 동일한 조건 분류(트랜스크립트 참조 산문 → model condition, "exits N" 후행 → mechanical)를 적용하거나, 조건별 타입을 명시적으로 전달받아야 합니다.  ## 우선순위  Medium — kickoff 관문의 자율 진행 모드에서 MCP 경로로 arm하면 항상 재현되나, shell 명령 조건으로 우회 가능합니다.  ## 환경 정보  - moai: v3.1.3-rc.1 (30afb9a1d, built 2026-08-24T15:28:13Z) - OS: Darwin 25.5.0 arm64 
  **Post-Mortem & Fix Analysis**:
  > 제보 감사합니다. 이 문제는 `develop` 브랜치에서 수정됐고 다음 릴리스에 포함됩니다(현재 최신 태그는 v3.1.2입니다).  이제 `goal_arm` MCP 래퍼는 CLI `/moai goal`과 **같은 조건 분류기와 같은 검사**를 거칩니다. 셸로 판정할 수 없는 산문 조건이 mechanical(종료 코드 판정) 조건으로 통째 저장돼, 매 턴엔드마다 exit 2로 막히던 현상이 없어졌습니다.  - 조건 분류: `c04188cf8` (merge `314a8410c`) — `ac_converge` 같은 대표 조건을 model 조건으로 분류합니다. - 두 등록 경로 공유 검사: `bdbc09788` (merge `e1d57257f`) — `internal/cli/mcp_server.go`가 CLI와 같은 `parseCondition` + `armTimeConditionGate`를 씁니다. - 회귀 테스트: `TestParseCondition_CanonicalAcConvergeIsModel`, `TestMCPGoalArm_ProseShapedConditionRefused`  제안해 주신 방식과 다른 점이 하나 있습니다. 첫 단어가 명령어처럼 보이는 산문(예: `go test가 통과하고 …`)은 model 조건으로 조용히 바꾸지 않고 **등록 시점에 거절**합니다. 조건을 어떻게 판정할지 추측하지 않고, 쓴 사람이 형태를 분명히 고르게 하려는 결정입니다. 

- **Issue #1597** (2026-08-25): **moai todo — 알 수 없는 동사가 에러 대신 add 폴스루로 카드 생성**
  *Symptoms*: ## 설명  `moai todo pick t151`이 "unknown verb" 에러 대신 add 폴스루로 신규 카드 t177("pick t151")을 생성함.  ## 재현  존재하지 않는 동사로 `moai todo <verb> <text>` 실행 → `moai todo list`에 새 카드 확인.  관측 출력: `t177 12`  ## 기대 동작  알 수 없는 동사는 에러.  ## 실제 동작  조용한 데이터 오염 — 운영 중 리드가 배차 동사 착각으로 쓰레기 카드 생성(t67 사고 동일 계열 재발).  정상 동사: `next` / `unpick` / `edit` / `move` / `drop` / `undrop`  ## 우선순위  Medium — `drop`으로 복구 가능하나, 오타가 조용한 상태 변경으로 이어지는 원인 제거 필요(unknown verb는 silent mutation이 아니라 에러여야 함).  ## 진단 정보  - moai-adk v3.1.2 (전역 ~/go/bin/moai) - Darwin 25.5.0 arm64 - go version go1.26.4 darwin/arm64 

- **Issue #1595** (2026-08-24): **constitution validate ignores [SUPERSEDED] prefix and canary_gate:false**
  *Symptoms*: ## Summary `moai constitution validate` flags entries whose clause carries a `[SUPERSEDED …]` prefix, and entries with `canary_gate: false`, as DRIFT errors. There is currently no way to retire an entry without deleting it.  ## Repro (2026-08-20/22, mo.ai.kr checkout) - 4 retired entries (CONST-V3R2-021..024, replaced by the worktree-opt-in policy) all have `canary_gate: false` — still failing validation. - All `[SUPERSEDED]`-prefixed clauses are checked verbatim → permanent failures.  ## Impact Deleting the entry is the only escape hatch today, which destroys the audit trail of "this clause was retired". Downstream teams are forced to choose between permanent validate noise or losing history.  ## Expected Validate should honor a retirement marker (e.g. `[SUPERSEDED]` prefix or `canary_gate: false`) by skipping the drift check while keeping the entry listed (maybe behind `--strict`).  ## Context t119 §3 / t120 §4 (`.moai/reports/t119-checker-drift-investigation-20260820.md`, `.moai/reports/t120-registry-resync-20260820.md` in mo.ai.kr).

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

### Incident Patch 1: `4755c5e5` (2026-09-30)
**Commit Message**: refactor(config): retire workflow.worktree.tmux_preferred — dead since PR #1278 (card t1287) (#1740)

The key had no production reader after the worktree-surface redesign (PR #1278
deleted the parseTmuxPreferred reader in internal/cli/worktree/new.go), so the
shipped default true and the settings-web toggle described behavior nothing
executed. Remove the field, default, template key, settings schema entry,
console i18n strings (4 locales), and the stale skill-doc line, which now
points at the explicit replacement: moai cc -w <name> --spawn.

- shipped_key_inventory entry (class D, deprecate_after v3.1.0) fulfilled
- existing projects carrying the key are unaffected: unknown-key rejection is
  strict-mode only (MOAI_CONFIG_STRICT=1)
- tests: guard/tab/config/settings/project expectations updated; full suite
  129 packages ok (2 pre-existing machine-env failures unrelated: statusline
  TestBuilderNormalizesMode mid-suite git-count race, workflow
  TestDetectDefaultBranch ambient origin/HEAD=develop)

🗿 MoAI

**File**: `CHANGELOG.md` (modified, +4/-0)
```diff
@@ -104,6 +104,10 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - `moai mcp-server` now advertises its full build stamp (version, commit, build date) in the `initialize` result instead of the bare semver, and its `instructions` field names the running build, its pid, and the fact that a rebuilt binary does not replace an already-spawned server.
 - `moai doctor` gains an **MCP Server Version** check. The server records its build identity to `.moai/state/mcp-server/<pid>.json` while it runs; the check probes those records for liveness and warns when a live server's commit differs from the installed binary's, with reconnect guidance. Dead records are pruned in passing. The check reports OK — never a warning — when no server is running or when the binary carries no commit metadata.
 
+### Removed
+
+- **`workflow.worktree.tmux_preferred` config key and its settings-web toggle** (card t1287) — the key had no production reader since the worktree-surface redesign (PR #1278 deleted the `parseTmuxPreferred` reader), so the shipped default `true` and the console toggle described behavior nothing executed. Removed the field, default, template key, settings schema entry, console i18n strings, and the stale skill-doc line, which now documents the explicit replacement: `moai cc -w <name> --spawn` opens the session in a new tmux window. Existing projects that still carry `tmux_preferred: true` in their `workflow.yaml` are unaffected — the config loader warns on unknown keys only in strict mode (`MOAI_CONFIG_STRICT=1`); drop the line at your next config touch. The `shipped_key_inventory` ledger entry (class D, deprecate_after v3.1.0) is fulfilled by this removal. 🗿 MoAI
+
 ### Changed
 
 - **[SPEC-GLM-FLASH-DEFAULT-001](.moai/specs/SPEC-GLM-FLASH-DEFAULT-001/spec.md)** — the default coding model for GLM-backed sessions is now `glm-5.3-flash` (card t289). `DefaultGLM53Flash` is registered in `internal/config/defaults.go` and every Claude-tier model slot (high/medium/low/fable/haiku/sonnet/opus) resolves to it; `ValidGLMModels()` grows from four to five members, with `glm-5.3` kept explicitly selectable via `DefaultGLM53` so an explicit retarget can never silently drop it. Flash accepts `reasoning_effort: max` only, so the effort overlay (`internal/template/glm_effort_overlay.go`) carries a flash-specific branch on both the wire and display paths: under flash the `max` state is emitted for every Claude effort level, including low — emitting the true low state would send a wire value the model rejects. The statusline context-window table gains an explicit `"glm-5.3-flash": 1_000_000` entry (a divergence guard, not substring inheritance off `glm-5.3`). The web console offers the model in all four locales (`internal/web/assets/i18n.js` labels it "one-million-token context (default)" in en/ko/ja/zh, and the model-select widget carries the five-member set), and the README tier table plus docs-site pages name flash as the default. A boot smoke test (`TestGLMFlashDefaultEnvInjection`) pins the env-level injection. 13 acceptance criteria (AC-001..AC-013): 13 PASS, 0 FAIL. Run-phase commits M1–M6 `a5454a505` → `9e1bb9e3d`. This sync commit carries the 3-phase close (`in-progress → implemented → completed` merged into the sync commit), the `progress.md` §E.4 signal, and this entry; `sync_commit_sha` recorded as `pending-backfill` and backfilled in the immediately following commit. 🗿 MoAI
```

**File**: `internal/config/defaults.go` (modified, +0/-1)
```diff
@@ -812,7 +812,6 @@ func NewDefaultWorkflowConfig() WorkflowConfig {
 			AutoCreate:         false,
 			AutoMerge:          false,
 			SessionNamePattern: "moai-{ProjectName}-{SPEC-ID}",
-			TmuxPreferred:      true,
 		},
 		// SPEC-TODO-ENABLE-FLAG-001 REQ-1: Todo is left at its zero value on
 		// purpose — Enabled stays nil, which TodoEnabled reads as ENABLED.
```

**File**: `internal/config/defaults_test.go` (modified, +0/-1)
```diff
@@ -517,7 +517,6 @@ func TestNewDefaultWorkflowConfigNestedDefaults(t *testing.T) {
 		{"Worktree.AutoCleanup", cfg.Worktree.AutoCleanup, false},
 		{"Worktree.AutoCreate", cfg.Worktree.AutoCreate, false},
 		{"Worktree.AutoMerge", cfg.Worktree.AutoMerge, false},
-		{"Worktree.TmuxPreferred", cfg.Worktree.TmuxPreferred, true},
 	}
 	for _, c := range boolChecks {
 		if c.got != c.want {
```

**File**: `internal/config/testdata/shipped_key_inventory.yaml` (modified, +0/-4)
```diff
@@ -2930,7 +2930,3 @@
   class: D
   evidence: none
   deprecate_after: "v3.1.0"
-- path: "workflow.worktree.tmux_preferred"
-  class: D
-  evidence: none
-  deprecate_after: "v3.1.0"
```

**File**: `internal/config/types.go` (modified, +0/-1)
```diff
@@ -575,7 +575,6 @@ type WorkflowWorktreeConfig struct {
 	AutoCreate         bool   `yaml:"auto_create"`
 	AutoMerge          bool   `yaml:"auto_merge"`
 	SessionNamePattern string `yaml:"session_name_pattern"`
-	TmuxPreferred      bool   `yaml:"tmux_preferred"`
 }
 
 // WorkflowTodoConfig mirrors workflow.todo.* — the backlog-queue guidance gate
```

**File**: `internal/config/types_test.go` (modified, +0/-1)
```diff
@@ -331,7 +331,6 @@ func TestWorkflowConfigNestedFieldReachability(t *testing.T) {
 		{wfType, []string{"Worktree", "AutoCreate"}},
 		{wfType, []string{"Worktree", "AutoMerge"}},
 		{wfType, []string{"Worktree", "SessionNamePattern"}},
-		{wfType, []string{"Worktree", "TmuxPreferred"}},
 	}
 	for _, c := range checks {
 		cur := c.typ
```

**File**: `internal/config/workflow_nested_test.go` (modified, +0/-3)
```diff
@@ -58,9 +58,6 @@ func TestWorkflowYAMLUnmarshalProductionFixture(t *testing.T) {
 	if got := wf.Worktree.SessionNamePattern; got != "moai-{ProjectName}-{SPEC-ID}" {
 		t.Errorf("Worktree.SessionNamePattern: got %q, want %q", got, "moai-{ProjectName}-{SPEC-ID}")
 	}
-	if got := wf.Worktree.TmuxPreferred; got != true {
-		t.Errorf("Worktree.TmuxPreferred: got %v, want true", got)
-	}
 }
 
 // TestWorkflowYAMLUnmarshal_OmittedTokenBudget_PreservesDefaults verifies that
```

**File**: `internal/core/project/initializer_workflow_toggles_test.go` (modified, +0/-2)
```diff
@@ -24,7 +24,6 @@ const templateLikeWorkflow = `workflow:
         auto_create: false
         auto_merge: false
         auto_cleanup: false
-        tmux_preferred: true
     token_budget:
         plan: 30000
         run: 180000
@@ -85,7 +84,6 @@ func TestWriteWorkflowTogglesYAML_PatchesExistingWorktreeKeys(t *testing.T) {
 		"        auto_create: true",
 		"        auto_merge: true",
 		"        auto_cleanup: true",
-		"        tmux_preferred: true",
 		"    token_budget:",
 	} {
 		if !bytes.Contains(got, []byte(want)) {
```

---

### Incident Patch 2: `48239c7d` (2026-08-27)
**Commit Message**: fix(settings): stop GLM settings loss across console saves, launcher rewrites, and inert effort keys (#1676)

* feat(web): absorb GLM Settings rename + tier effort select-lock WIP onto flash-default main

Absorbs the working-tree GLM console changes from the previous session onto
origin/main (3abde7053): section rename to "GLM Settings" across 4 locales,
tier effort select max-lock client logic (app.js), and the glmkey /
schemaform / handlers / i18n touches that carry them. The glm-5.3-flash
model-constant pieces were superseded by upstream SPEC-GLM-FLASH-DEFAULT-001
(t289) and resolved in favor of upstream.

Task: glm-settings-persist

🗿 MoAI

* fix(cli): gate llm.yaml launcher rewrites on semantic change detection

persistTeamMode rewrote .moai/config/sections/llm.yaml on every moai glm /
cg / cc launch: the zero-seeded reload + typed whole-file re-marshal
destroyed hand-written comments, flipped the file mode 0644->0600
(writeFileAtomic's perm), and touched mtime each launch, reopening a
lost-update window against concurrent writers (RC1 of the GLM
settings-persistence cluster).

saveLLMSection now compares the desired post-fill section state with the
persisted llm.yaml semanti

**File**: `internal/cli/glm.go` (modified, +129/-1)
```diff
@@ -11,6 +11,7 @@ import (
 	"fmt"
 	"os"
 	"path/filepath"
+	"reflect"
 	"strconv"
 	"strings"
 
@@ -291,7 +292,7 @@ func runGLM(cmd *cobra.Command, args []string) error {
 	// Z.AI concurrency limits (1-3 in-flight requests per paid tier) are sometimes
 	// misreported by Claude Code as "context window limit".
 	_, _ = fmt.Fprintln(cmd.ErrOrStderr(), "WARNING: moai glm uses GLM models for the MAIN SESSION. Known limitations:")
-	_, _ = fmt.Fprintln(cmd.ErrOrStderr(), "  - Main session context window: 128K (glm-4.5-air), 202K (glm-4.7), 1M (glm-5.2)")
+	_, _ = fmt.Fprintln(cmd.ErrOrStderr(), "  - Main session context window: 1M (glm-5.3, glm-5.3-flash)")
 	_, _ = fmt.Fprintln(cmd.ErrOrStderr(), "  - Z.AI concurrency is limited (1-3 in-flight requests per paid tier)")
 	_, _ = fmt.Fprintln(cmd.ErrOrStderr(), "If you want Claude as leader and GLM for teammates, use 'moai cg' instead.")
 
@@ -656,6 +657,14 @@ func disableTeamMode(projectRoot string) error {
 
 // saveLLMSection saves only the LLM section to llm.yaml.
 // Empty GLM model values are populated with defaults to avoid confusion.
+//
+// @MX:NOTE: [AUTO] RC1 change-detection gate (glm-settings-persist): the write
+// is SKIPPED when the persisted llm.yaml already equals the desired section
+// state semantically (llmSectionSemanticallyEqual below). The launcher calls
+// this on EVERY moai glm/cg/cc launch; an unconditional typed re-marshal there
+// destroyed hand-written comments, flipped the file mode 0644→0600
+// (writeFileAtomic's perm), and touched mtime on every launch — reopening a
+// lost-update window against concurrent writers.
 func saveLLMSection(sectionsDir string, llm config.LLMConfig) error {
 	// Populate empty GLM model values with defaults for clarity.
 	// This prevents llm.yaml from containing empty model strings that
@@ -695,6 +704,14 @@ func saveLLMSection(sectionsDir string, llm config.LLMConfig) error {
 		LLM config.LLMConfig `yaml:"llm"`
 	}{LLM: llm}
 
+	// RC1 change-detection gate: skip the write when the persisted file already
+	// carries this exact section state. A read error leaves the gate undecided
+	// and falls through to the write (the write itself then surfaces the error).
+	if persisted, ok, err := readPersistedLLMSection(sectionsDir); err == nil && ok &&
+		llmSectionSemanticallyEqual(persisted, wrapper.LLM) {
+		return nil
+	}
+
 	data, err := yaml.Marshal(wrapper)
 	if err != nil {
 		return fmt.Errorf("marshal llm config: %w", err)
@@ -704,6 +721,58 @@ func saveLLMSection(sectionsDir string, llm config.LLMConfig) error {
 	return writeFileAtomic(path, data, 0o600)
 }
 
+// readPersistedLLMSection reads the current llm.yaml into a config.LLMConfig.
+// ok is false only when the file does not exist (a first write must proceed);
+// an unreadable or unparseable file returns the error so the caller can fall
+// through to the write path rather than silently skipping it.
+func readPersistedLLMSection(sectionsDir string) (config.LLMConfig, bool, error) {
+	data, err := os.ReadFile(filepath.Join(sectionsDir, "llm.yaml"))
+	if err != nil {
+		if os.IsNotExist(err) {
+			return config.LLMConfig{}, false, nil
+		}
+		return config.LLMConfig{}, false, fmt.Errorf("read llm.yaml: %w", err)
+	}
+	wrapper := struct {
+		LLM config.LLMConfig `yaml:"llm"`
+	}{}
+	if err := yaml.Unmarshal(data, &wrapper); err != nil {
+		return config.LLMConfig{}, false, fmt.Errorf("parse llm.yaml: %w", err)
+	}
+	return wrapper.LLM, true, nil
+}
+
+// llmSectionSemanticallyEqual compares two LLM sections by VALUE, not by file
+// bytes: both are config.LLMConfig structs, so formatting, key order, and
+// comments are invisible to the comparison. This is what lets a hand-written
+// llm.yaml (with comments) be recognized as already carrying the desired
+// state, so the launcher skips the rewrite entirely.
+func llmSectionSemanticallyEqual(a, b config.LLMConfig) bool {
+	normalizeLLMSectionMaps(&a)
+	normalizeLLMSectionMaps(&b)
+	return reflect.DeepEqual(a, b)
+}
+
+// normalizeLLMSectionMaps replaces nil maps with empty maps so a section whose
+// map fields were never set compares equal to one round-tripped through a
+// yaml.Marshal that renders nil maps as `{}`. Deliberate zero-value
+// equivalence: "key absent" and "key present but empty" carry no different
+// intent for these mirrors.
+func normalizeLLMSectionMaps(c *config.LLMConfig) {
+	if c.Profiles == nil {
+		c.Profiles = map[string]map[string]config.ModelEffort{}
+	}
+	if c.HarnessAgents == nil {
+		c.HarnessAgents = map[string]map[string]config.ModelEffort{}
+	}
+	if c.AgentOverrides == nil {
+		c.AgentOverrides = map[string]config.ModelEffort{}
+	}
+	if c.GLM.ContextWindows == nil {
+		c.GLM.ContextWindows = map[string]int{}
+	}
+}
+
 // GLMConfigFromYAML represents the GLM settings from llm.yaml.
 type GLMConfigFromYAML struct {
 	BaseURL string
@@ -713,6 +782,11 @@ type GLMConfigFromYAML struct {
 		Low    string
 		Fable  string
 	}
+	// Effort carries the per-tier re
```

**File**: `internal/cli/glm_persist_gate_test.go` (added, +211/-0)
```diff
@@ -0,0 +1,211 @@
+package cli
+
+// glm_persist_gate_test.go — RC1 regression guards for the launcher-side
+// llm.yaml change-detection gate (glm-settings-persist).
+//
+// persistTeamMode used to rewrite .moai/config/sections/llm.yaml on EVERY
+// `moai glm` / `moai cg` launch: a zero-seeded reload + whole-file typed
+// re-marshal destroyed hand-written comments, flipped the file mode 0644→0600
+// (writeFileAtomic's perm), and touched mtime on every launch — and a
+// semantically-identical rewrite reopened a lost-update window against
+// concurrent writers. The gate must write ONLY when the desired section state
+// actually differs from the persisted one.
+
+import (
+	"os"
+	"path/filepath"
+	"strings"
+	"testing"
+
+	"github.com/modu-ai/moai-adk/internal/config"
+	"github.com/modu-ai/moai-adk/internal/defs"
+)
+
+// writeHandEditedLLMYAML writes a hand-maintained llm.yaml whose semantic
+// content equals the compiled defaults plus the given team_mode — the state a
+// second launch would want to persist. Comments and 0644 mode are deliberately
+// hand-file properties a typed re-marshal destroys.
+func writeHandEditedLLMYAML(t *testing.T, root, teamMode string) string {
+	t.Helper()
+	sectionsDir := filepath.Join(root, defs.MoAIDir, defs.SectionsSubdir)
+	if err := os.MkdirAll(sectionsDir, 0o755); err != nil {
+		t.Fatalf("mkdir sections: %v", err)
+	}
+	var b strings.Builder
+	b.WriteString("# llm.yaml — maintained by hand; comments must survive launches\n")
+	b.WriteString("llm:\n")
+	if teamMode != "" {
+		b.WriteString("  team_mode: " + teamMode + " # written by the launcher\n")
+	}
+	b.WriteString("  glm_env_var: " + config.DefaultGLMEnvVar + "\n")
+	b.WriteString("  glm:\n")
+	b.WriteString("    base_url: " + config.DefaultGLMBaseURL + "\n")
+	b.WriteString("    models:\n")
+	b.WriteString("      high: " + config.DefaultGLMHigh + "\n")
+	b.WriteString("      medium: " + config.DefaultGLMMedium + "\n")
+	b.WriteString("      low: " + config.DefaultGLMLow + "\n")
+	b.WriteString("      fable: " + config.DefaultGLMFable + "\n")
+	b.WriteString("      # legacy aliases kept in sync by hand\n")
+	b.WriteString("      opus: " + config.DefaultGLMOpus + "\n")
+	b.WriteString("      sonnet: " + config.DefaultGLMSonnet + "\n")
+	b.WriteString("      haiku: " + config.DefaultGLMHaiku + "\n")
+
+	path := filepath.Join(sectionsDir, "llm.yaml")
+	if err := os.WriteFile(path, []byte(b.String()), 0o644); err != nil {
+		t.Fatalf("write llm.yaml: %v", err)
+	}
+	return path
+}
+
+// assertFileUnchanged fails when the file's bytes or mode differ from the
+// snapshot taken before the call under test.
+func assertFileUnchanged(t *testing.T, path string, before []byte, modeBefore os.FileMode) {
+	t.Helper()
+	after, err := os.ReadFile(path)
+	if err != nil {
+		t.Fatalf("read llm.yaml after persist: %v", err)
+	}
+	if string(before) != string(after) {
+		t.Errorf("llm.yaml was rewritten although the desired state was already persisted:\nbefore:\n%s\nafter:\n%s", before, after)
+	}
+	info, err := os.Stat(path)
+	if err != nil {
+		t.Fatalf("stat llm.yaml: %v", err)
+	}
+	if info.Mode().Perm() != modeBefore.Perm() {
+		t.Errorf("llm.yaml mode flipped %v → %v on a no-op persist", modeBefore.Perm(), info.Mode().Perm())
+	}
+}
+
+func snapshotLLMYAML(t *testing.T, path string) ([]byte, os.FileMode) {
+	t.Helper()
+	data, err := os.ReadFile(path)
+	if err != nil {
+		t.Fatalf("read llm.yaml: %v", err)
+	}
+	info, err := os.Stat(path)
+	if err != nil {
+		t.Fatalf("stat llm.yaml: %v", err)
+	}
+	return data, info.Mode()
+}
+
+// TestPersistTeamMode_NoRewriteWhenUnchanged pins the RC1 gate: when
+// team_mode already equals the target and no default fill is needed, the
+// launcher must not rewrite llm.yaml — comments survive, the hand-set 0644
+// mode survives, and no lost-update window is reopened.
+func TestPersistTeamMode_NoRewriteWhenUnchanged(t *testing.T) {
+	root := t.TempDir()
+	path := writeHandEditedLLMYAML(t, root, "glm")
+
+	before, modeBefore := snapshotLLMYAML(t, path)
+	if err := persistTeamMode(root, "glm"); err != nil {
+		t.Fatalf("persistTeamMode: %v", err)
+	}
+	assertFileUnchanged(t, path, before, modeBefore)
+}
+
+// TestPersistTeamMode_WritesWhenTeamModeDiffers keeps the real write path
+// alive: a differing team_mode must still be persisted.
+func TestPersistTeamMode_WritesWhenTeamModeDiffers(t *testing.T) {
+	root := t.TempDir()
+	writeHandEditedLLMYAML(t, root, "cg")
+
+	if err := persistTeamMode(root, "glm"); err != nil {
+		t.Fatalf("persistTeamMode: %v", err)
+	}
+	got, err := loadLLMSectionOnly(filepath.Join(root, defs.MoAIDir, defs.SectionsSubdir))
+	if err != nil {
+		t.Fatalf("loadLLMSectionOnly: %v", err)
+	}
+	if got.TeamMode != "glm" {
+		t.Errorf("team_mode = %q, want %q", got.TeamMode, "glm")
+	}
+}
+
+// TestPersistTeamMode_FillsEmptySlotsOnFirstWrite keeps the first-launch fill
+// behavior: empty GLM slots are still populated with compiled defaults.
+func TestPersistTeamMode_
```

**File**: `internal/cli/glm_slot_effort_test.go` (added, +187/-0)
```diff
@@ -0,0 +1,187 @@
+package cli
+
+// glm_slot_effort_test.go — RC3 regression guards for wiring the per-slot
+// llm.glm.effort.* preference into the GLM session launch (glm-settings-persist).
+//
+// The four glm.effort keys were write-only: settings.ApplySchemaEdits stored
+// them, no runtime path read them, and the console labeled them stored-only.
+// Now the launcher resolves the slot serving the MAIN session model and lets a
+// non-empty stored glm.effort[slot] override the prefs/model_policy effort
+// chain, ahead of the existing collapse overlay (which stays governing for the
+// final wire value: stored high and max both reach z.ai as max; flash pins
+// every effort to max).
+
+import (
+	"os"
+	"path/filepath"
+	"testing"
+
+	"github.com/modu-ai/moai-adk/internal/config"
+	"github.com/modu-ai/moai-adk/internal/defs"
+	"github.com/modu-ai/moai-adk/internal/template"
+)
+
+// tierEffortAll builds a GLMTierEffort with every slot set.
+func tierEffortAll(high, medium, low, fable string) config.GLMTierEffort {
+	return config.GLMTierEffort{High: high, Medium: medium, Low: low, Fable: fable}
+}
+
+// TestGLMSlotEffortForModel pins the alias→slot resolution: the pairing is the
+// SAME mapping setGLMEnv uses to assign ANTHROPIC_DEFAULT_*_MODEL (opus feeds
+// Models.High → effort.high, sonnet → Medium, haiku → Low, fable → Fable), with
+// the [1m] suffix split first and canonical claude-* ids reverse-mapped through
+// template.ModelAliasFromCanonicalID. Unknown or empty models resolve "" — the
+// caller falls back to the prefs chain unchanged.
+func TestGLMSlotEffortForModel(t *testing.T) {
+	effort := tierEffortAll("e-high", "e-medium", "e-low", "e-fable")
+	cases := []struct {
+		model string
+		want  string
+	}{
+		{"opus", "e-high"},
+		{"sonnet", "e-medium"},
+		{"haiku", "e-low"},
+		{"fable", "e-fable"},
+		{"opus[1m]", "e-high"},                           // 1M suffix split before lookup
+		{"sonnet[1m]", "e-medium"},                       //
+		{template.ModelIDOpus5, "e-high"},                // canonical id reverse-mapped
+		{"claude-sonnet-5", "e-medium"},                  //
+		{"", ""},                                         // no model pinned → no slot claim
+		{config.DefaultGLM53, ""},                        // raw GLM id is not an alias → ""
+		{template.ModelAliasCanonicalID("opusplan"), ""}, // routing alias owns no tier slot
+	}
+	for _, tc := range cases {
+		if got := glmSlotEffortForModel(tc.model, effort); got != tc.want {
+			t.Errorf("glmSlotEffortForModel(%q) = %q, want %q", tc.model, got, tc.want)
+		}
+	}
+}
+
+// TestLoadGLMConfig_CarriesTierEffort pins that loadGLMConfig no longer drops
+// the persisted per-tier effort on the floor (the structural drop was RC3's
+// root cause): the disk-loaded section's glm.effort map survives into the
+// launcher-facing GLMConfigFromYAML.
+func TestLoadGLMConfig_CarriesTierEffort(t *testing.T) {
+	root := t.TempDir()
+	sectionsDir := filepath.Join(root, defs.MoAIDir, defs.SectionsSubdir)
+	if err := os.MkdirAll(sectionsDir, 0o755); err != nil {
+		t.Fatalf("mkdir sections: %v", err)
+	}
+	src := "llm:\n  glm:\n    effort:\n      high: " + template.GLMStateLow + "\n      fable: " + template.GLMStateMax + "\n"
+	if err := os.WriteFile(filepath.Join(sectionsDir, "llm.yaml"), []byte(src), 0o644); err != nil {
+		t.Fatalf("write llm.yaml: %v", err)
+	}
+
+	origDeps := deps
+	deps = nil // force the disk path — the live launcher path
+	defer func() { deps = origDeps }()
+
+	cfg, err := loadGLMConfig(root)
+	if err != nil {
+		t.Fatalf("loadGLMConfig: %v", err)
+	}
+	if cfg.Effort.High != template.GLMStateLow {
+		t.Errorf("Effort.High = %q, want %q — the stored per-tier effort was dropped", cfg.Effort.High, template.GLMStateLow)
+	}
+	if cfg.Effort.Fable != template.GLMStateMax {
+		t.Errorf("Effort.Fable = %q, want %q", cfg.Effort.Fable, template.GLMStateMax)
+	}
+	if cfg.Effort.Medium != "" || cfg.Effort.Low != "" {
+		t.Errorf("unset slots must stay empty, got %+v", cfg.Effort)
+	}
+}
+
+// TestResolveGLMMainSessionEffort pins the launch precedence: a non-empty
+// stored glm.effort[slot] wins over the prefs/model_policy chain; an empty
+// stored value (or a model with no slot claim) falls back to it unchanged —
+// byte-identical to the pre-RC3 launch behavior.
+func TestResolveGLMMainSessionEffort(t *testing.T) {
+	stored := config.GLMTierEffort{High: template.GLMStateLow}
+
+	t.Run("non-empty stored slot overrides the prefs chain", func(t *testing.T) {
+		if got := resolveGLMMainSessionEffort("opus", stored, "xhigh"); got != template.GLMStateLow {
+			t.Errorf("resolveGLMMainSessionEffort(opus, high=low, fallback=xhigh) = %q, want the stored %q", got, template.GLMStateLow)
+		}
+	})
+	t.Run("empty stored slot keeps the fallback unchanged", func(t *testing.T) {
+		if got := resolveGLMMainSessionEffort("sonnet", stored, "medium"); got != "medium" {
+			t.Errorf("resolveGLMMainSessionEffort(sonnet, high=low, fallback=medium) = %q
```

**File**: `internal/cli/launcher.go` (modified, +19/-8)
```diff
@@ -725,8 +725,9 @@ func launchClaudeDefault(profileName string, extraArgs []string) error {
 	// expand to canonical ids as before (byte-identical to expandModelString).
 	glmBackend := false
 	glmHighModel := ""
+	var glmTierEffort config.GLMTierEffort
 	if root, err := findProjectRoot(); err == nil {
-		glmBackend, glmHighModel = resolveGLMBackendForLaunch(root)
+		glmBackend, glmHighModel, glmTierEffort = resolveGLMBackendForLaunch(root)
 	}
 	model = resolveMainSessionModel(model, glmBackend)
 
@@ -793,7 +794,15 @@ func launchClaudeDefault(profileName string, extraArgs []string) error {
 		// GLM backend: z.ai honors reasoning_effort, NOT Claude's 5-step effort.
 		// Derive ANTHROPIC_REASONING_EFFORT from the effective effort and strip the
 		// inert CLAUDE_CODE_EFFORT_LEVEL so a web-set effort reaches z.ai.
-		launchEnv = buildEnvForGLMLaunch(glmHighModel, effectiveEffort, os.Environ())
+		//
+		// RC3 (glm-settings-persist): a non-empty stored glm.effort[slot] for the
+		// slot serving the main-session model (model is a slot alias here —
+		// resolveMainSessionModel reverse-mapped it above) overrides the
+		// prefs/model_policy chain. Empty stored slot ⇒ the chain, unchanged.
+		// The collapse overlay downstream stays governing for the wire value
+		// (stored high and max both wire as max; flash pins everything to max).
+		launchEnv = buildEnvForGLMLaunch(glmHighModel,
+			resolveGLMMainSessionEffort(model, glmTierEffort, effectiveEffort), os.Environ())
 	} else {
 		// Claude backend: honors the 5-step effort vocabulary (CLAUDE_CODE_EFFORT_LEVEL).
 		launchEnv = buildEnvForLaunch(effectiveEffort, os.Environ())
@@ -1235,16 +1244,18 @@ func resolveMainSessionModel(prefsModel string, glmBackend bool) string {
 // path), matching the pre-existing behavior for a non-GLM checkout.
 // resolveGLMBackendForLaunch reports whether the effective backend is GLM and,
 // when it is, the resolved high-slot model id (the session model the effort
-// overlay branches on — glm-5.3-flash pins every effort to max). The model is
-// "" whenever the backend resolves false or llm.yaml fails to load; the
-// overlay treats an empty model as non-flash.
-func resolveGLMBackendForLaunch(root string) (bool, string) {
+// overlay branches on — glm-5.3-flash pins every effort to max) plus the
+// persisted per-tier effort map (llm.glm.effort.*, RC3
+// glm-settings-persist — resolveGLMMainSessionEffort reads the slot serving
+// the main-session model). The model is "" whenever the backend resolves false
+// or llm.yaml fails to load; the overlay treats an empty model as non-flash.
+func resolveGLMBackendForLaunch(root string) (bool, string, config.GLMTierEffort) {
 	sectionsDir := filepath.Join(filepath.Clean(root), defs.MoAIDir, defs.SectionsSubdir)
 	llm, err := loadLLMSectionOnly(sectionsDir)
 	if err != nil {
-		return false, ""
+		return false, "", config.GLMTierEffort{}
 	}
-	return template.IsGLMBackend(llm), llm.GLM.Models.High
+	return template.IsGLMBackend(llm), llm.GLM.Models.High, llm.GLM.Effort
 }
 
 // syncBypassToSettingsLocal is a backward-compatible wrapper for
```

**File**: `internal/config/types.go` (modified, +8/-6)
```diff
@@ -307,13 +307,15 @@ type GLMSettings struct {
 	ContextWindows map[string]int `yaml:"context_windows,omitempty"`
 	// Effort carries a per-tier reasoning-effort preference.
 	//
-	// STORED ONLY. No runtime path reads it. The GLM launcher injects exactly
-	// one session-global ANTHROPIC_REASONING_EFFORT, derived in
+	// LOAD-BEARING since RC3 (glm-settings-persist): the GLM launcher reads the
+	// slot serving the main session's model (internal/cli
+	// resolveGLMMainSessionEffort) and a non-empty stored value overrides the
+	// prefs/model_policy effort chain for that session. Sub-agents keep the
+	// session-global ANTHROPIC_REASONING_EFFORT derived in
 	// internal/template/glm_effort_overlay.go from the session-wide
-	// llm.effort_level preference — a value unrelated to this tier map. These
-	// four fields therefore record an intent the current single-channel runtime
-	// cannot honor per tier. They are persisted so the preference survives, and
-	// the console labels them stored-only rather than implying they apply.
+	// llm.effort_level preference, and the collapse overlay stays governing for
+	// the final wire value (stored high and max both wire as reasoning_effort
+	// max; low wires as low; glm-5.3-flash pins everything to max).
 	Effort GLMTierEffort `yaml:"effort,omitempty"`
 }
 
```

**File**: `internal/settings/schema_sections.go` (modified, +11/-9)
```diff
@@ -188,12 +188,14 @@ func glmTiers() []string {
 
 // glmDefaultTierEffort는 티어별 추론 강도 기본 선택값이다. 값은 z.ai 정규
 // reasoning-state 이름이며 template 패키지 상수에서 파생한다 — 리터럴 재선언
-// 없음. 이 값들은 저장만 되고 런타임에 적용되지 않는다 (아래 주석 참조).
+// 없음. RC3(glm-settings-persist)부터 메인 세션이 해당 슬롯을 쓰면 런타임에
+// 적용된다 (llmFields 주석 참조).
 //
 // GLM-5.3 기준 기본값: high=high, medium=high, low=low, fable=max. fable만 max인
 // 것은 z.ai가 코딩 과제에 max를 권고하기 때문이고, high/medium이 max가 아닌 것은
 // 세션 전역 값이 모든 spawn에 청구되기 때문이다(SessionGLMReasoningState의 근거와
 // 동일). low 티어는 5.3에서 thinking을 끌 수 없으므로 최저 단계인 low로 내려간다.
+// (주의: collapse 오버레이에 따라 저장된 high도 wire에서는 max로 수렴한다.)
 func glmDefaultTierEffort(tier string) string {
 	switch tier {
 	case "high", "medium":
@@ -211,13 +213,14 @@ func glmDefaultTierEffort(tier string) string {
 // 모델 슬롯은 닫힌 집합이므로 select로 렌더한다 — 옵션은 config.ValidGLMModels()
 // SSOT에서 파생하며 스키마 파일에서 리터럴을 재선언하지 않는다 (AP-2).
 //
-// 추론 강도 4종은 **저장 전용(store-only)** 이다. 런타임 추론 강도 전달 채널은
-// 세션 전역 ANTHROPIC_REASONING_EFFORT 하나뿐이고, 그 값은
-// internal/template/glm_effort_overlay.go가 세션 단위 llm.effort_level
-// 환경설정에서 파생한다 — 이 티어 맵과 무관하다. 따라서 어느 티어의 effort도
-// 런타임에 적용되지 않으며, 콘솔은 적용 원천을 명시하고 이 필드들을 저장 전용으로
-// 표시한다 (REQ-WCR-033). 기존 코드 주석은 z.ai가 해당 환경변수를 준수하는지를
-// UNVERIFIED로 표기하며, 그 표기는 그대로 유지된다.
+// 추론 강도 4종은 RC3(glm-settings-persist)부터 런타임에 적용된다:
+// internal/cli의 런처(resolveGLMMainSessionEffort)가 메인 세션 모델이 속한
+// 슬롯의 값을 읽어 prefs/model_policy 노력 강도 체인보다 우선 적용한다.
+// 서브 에이전트는 기존대로 세션 전역 ANTHROPIC_REASONING_EFFORT
+// (internal/template/glm_effort_overlay.go가 세션 단위 llm.effort_level에서
+// 파생)를 쓴다. 최종 wire 값은 collapse 오버레이가 계속 지배한다 — 저장된
+// high와 max는 모두 max로, low는 low로 전달되고 glm-5.3-flash는 모든 값을
+// max로 고정한다. 콘솔의 안내 문구(sec.llm.effortnote)도 이 내용을 따른다.
 //
 // legacy alias opus/sonnet/haiku는 SPEC-WEB-CONSOLE-012 REQ-WC12-002에서 웹
 // 편집면에서 제거되었다 — GLMModels legacy struct 멤버는 무접촉 보존되어 legacy
@@ -235,7 +238,6 @@ func llmFields() []FieldDef {
 			"f.llm.glm.effort.opt.", template.GLMReasoningStateNames(), "", "")
 		f.Description = "fieldDesc.llm.glm.effort." + tier
 		f.Default = glmDefaultTierEffort(tier)
-		f.StoreOnly = true
 		fields = append(fields, f)
 	}
 	return fields
```

**File**: `internal/settings/sectionapply.go` (modified, +8/-4)
```diff
@@ -226,10 +226,14 @@ func applyLLMKey(l *config.LLMConfig, key, v string) error {
 		l.GLM.Models.Low = v
 	case "glm.models.fable":
 		l.GLM.Models.Fable = v
-	// SPEC-WEB-CONSOLE-REDESIGN-001 M4: per-tier reasoning effort. These are
-	// stored only — no runtime path reads them (the launcher injects one
-	// session-global ANTHROPIC_REASONING_EFFORT derived from llm.effort_level).
-	// The write exists so the preference survives; the console labels it.
+	// SPEC-WEB-CONSOLE-REDESIGN-001 M4: per-tier reasoning effort. Since RC3
+	// (glm-settings-persist) these ARE load-bearing: the GLM launcher
+	// (internal/cli resolveGLMMainSessionEffort) reads the slot serving the
+	// main session's model and lets a non-empty value override the
+	// prefs/model_policy effort chain at the next moai glm launch. Sub-agents
+	// keep the session-global ANTHROPIC_REASONING_EFFORT derived from
+	// llm.effort_level; the collapse overlay governs the wire value (stored
+	// high and max both wire as max).
 	case "glm.effort.high":
 		l.GLM.Effort.High = v
 	case "glm.effort.medium":
```

**File**: `internal/web/assets/app.js` (modified, +42/-0)
```diff
@@ -478,6 +478,46 @@
     reapplyHaikuLocks(); // 초기 상태(서버 렌더가 이미 disabled 를 방출하지만 재확인).
   }
 
+  // ── GLM flash → effort-select lock (3rd Party LLM → GLM Settings 탭) ──
+
+  // applyGLMFlashEffortLock 은 한 GLM 티어의 model select 값이 "glm-5.3-flash"
+  // 이면 같은 티어의 effort select 를 max 로 고정하고 max 이외의 옵션을 비활성화한다.
+  // flash 는 z.ai reasoning_effort "max" 만 받는다(공식 스펙 — low/high 는 미지원).
+  // 티어 페어링은 name 접미사(high/medium/low/fable)로 한다: models.* 전체 뒤에
+  // effort.* 전체가 렌더되어 두 select 가 같은 행 컨테이너에 있지 않기 때문.
+  // haiku 잠금과 달리 select 자체는 활성으로 남겨 "max 고정" 상태를 보여준다.
+  function applyGLMFlashEffortLock(modelSel) {
+    var tier = modelSel.name.slice("llm.glm.models.".length);
+    var effort = document.querySelector('select[name="llm.glm.effort.' + tier + '"]');
+    if (!effort) return;
+    var isFlash = modelSel.value === "glm-5.3-flash";
+    for (var o = 0; o < effort.options.length; o++) {
+      var opt = effort.options[o];
+      opt.disabled = isFlash && opt.value !== "max";
+      if (opt.disabled && opt.selected) effort.value = "max";
+    }
+  }
+
+  // reapplyGLMFlashLocks 는 리스너를 건드리지 않고 현재 값 기준으로 전체 티어의
+  // 잠금을 다시 적용한다 (초기 로드 + 저장 후 body swap 이후 호출).
+  function reapplyGLMFlashLocks() {
+    var models = document.querySelectorAll('select[name^="llm.glm.models."]');
+    for (var i = 0; i < models.length; i++) applyGLMFlashEffortLock(models[i]);
+  }
+
+  // wireGLMFlashEffortLock 은 각 GLM 티어 model select 의 change 에 잠금을 배선한다.
+  function wireGLMFlashEffortLock() {
+    var models = document.querySelectorAll('select[name^="llm.glm.models."]');
+    for (var i = 0; i < models.length; i++) {
+      (function (sel) {
+        sel.addEventListener("change", function () {
+          applyGLMFlashEffortLock(sel);
+        });
+      })(models[i]);
+    }
+    reapplyGLMFlashLocks();
+  }
+
   // initConsole 는 모든 콘솔 초기화를 한 곳에서 수행한다 — DOMContentLoaded(첫
   // 로드 / htmx 비활성 전체 새로고침) 와 htmx:afterSettle(boost body swap 직후)
   // 양쪽에서 호출된다. boost swap 은 body 전체를 교체하므로 새 요소는 리스너가
@@ -501,6 +541,8 @@
     wireProfileMatrix();
     // haiku model → effort select 비활성 잠금(초기 + change + 티어 repopulation).
     wireHaikuEffortLock();
+    // GLM flash model → 티어 effort select 를 max 로 고정(초기 + change).
+    wireGLMFlashEffortLock();
   }
 
   document.addEventListener("DOMContentLoaded", initConsole);
```

---

### Incident Patch 3: `379b310a` (2026-08-26)
**Commit Message**: fix: CI flake 3종 계열 수리 — poller TOCTOU·AND-gate·p95 (t278) (#1666)

* feat(SPEC-CI-FLAKE-SERIES-001): plan-phase artifacts (M, 4 artifacts) (t278)

SPEC-CI-FLAKE-SERIES-001 v0.2.0 (card t278, absorbing t270/t271): spec.md (REQ 12, GEARS) + plan.md (M1-M4) + acceptance.md (AC 10) + progress.md (§E.1 audit-ready, §F mode: serial, semi-autonomous). Plan-audit iter-1: PASS-WITH-DEBT 0.86 (Tier M threshold 0.80), SHOULD-FIX D1/D2 + MINOR D3-D5 all resolved in v0.2.0. Implementation Kickoff Approval granted by operator 2026-08-26. Evidence: .moai/reports/t278/plan-audit-iter1.md.

🗿 MoAI

* docs(SPEC-CI-FLAKE-SERIES-001): M1 investigation artifacts (t278)

Baseline sweep (attempt-aware, 537 runs 2026-08-10..26, 556 attempts):
4 current-defect flare-ups post-#1591 (p-hat 4/166); 2 pre-#1591
bilateral 2.72x occurrences found and excluded by timeline. Statistic
decision: AND-gate adopted (per-round median AND ratio-of-medians over
MaxUnits), fallback trimmed-median rejected on measured arithmetic.

Artifacts: forensics.md, reproduction-rate.md,
timing-statistic-decision.md, sweep-attempts.sh (v2), refetch-jobs.sh;
progress.md E.2 evidence.

🗿 MoAI

* fix(SPEC-CI-FLAKE-SERIES-001): M2 stop

**File**: `.moai/reports/t278/forensics.md` (added, +80/-0)
```diff
@@ -0,0 +1,80 @@
+# Forensics — SPEC-CI-FLAKE-SERIES-001 (t278 M1)
+
+Evidence fixed at run-phase tree `.claude/worktrees/t278` @ `d1289c5db` (branch `WT-ci-flake-series`, base `175d63f3f` = origin/main 2026-08-26). All log excerpts below were re-captured in this run-phase (2026-08-27) with `gh run view <id> --attempt <n> --log-failed` and are quoted verbatim; the number after the colon is the 1-based line offset within that command's output.
+
+## 1. Flake #1 — `TestConcurrentSendPoll` (internal/sessionmsg)
+
+### 1.1 Primary flare-up — run 32774108273 attempt 1 (fast job, required merge gate)
+
+```console
+$ gh run view 32774108273 --attempt 1 --log-failed | grep -n 'ConcurrentSendPoll\|store_test.go'
+112:Test (ubuntu-latest)	Run tests with coverage (fast — no race detector)	2026-08-24T20:33:19.8564953Z --- FAIL: TestConcurrentSendPoll (0.07s)
+113:Test (ubuntu-latest)	Run tests with coverage (fast — no race detector)	2026-08-24T20:33:19.8566145Z     store_test.go:385: received 97 messages, want 100 (loss or duplication)
+```
+
+- PR #1601 (docs-only, `WT-project-pipeline`). **Required gate job** — blocked merge.
+- Duration 0.07s: unrelated to the 60s poll deadline (`store_test.go:351`). Zero `poll:` / `send` error lines anywhere in the failed log — the above 2 lines are the test's only output.
+- Mechanism (spec §2.1, confirmed): stop-rule TOCTOU at `store_test.go:361-370` — the poller observes 0/0 pending at listing time (1), then confirms `sendersDone` closed at select time (3); the last 3 Sends' pending renames can land between the two instants, so both pollers exit with 3 messages forever unreceived.
+
+### 1.2 Recurrence — run 32777242100 attempt 1 (race job, advisory)
+
+```console
+$ gh run view 32777242100 --log-failed | grep -n 'ConcurrentSendPoll'
+3893:Race Test	Run race detector across all packages	2026-08-24T21:07:31.3326286Z --- FAIL: TestConcurrentSendPoll (0.27s)
+```
+
+Same day, 35 minutes later, different job (advisory race). Both job kinds are affected.
+
+## 2. Flake #2 — `TestAssertPairedHealthyEndToEnd` (internal/timing)
+
+### 2.1 Post-#1591 flare-up — run 32779472351 attempt 1 (race job)
+
+```console
+$ gh run view 32779472351 --attempt 1 --log-failed | grep -n 'AssertPaired\|timing.go'
+754:Race Test	UNKNOWN STEP	2026-08-24T21:35:42.6609240Z --- FAIL: TestAssertPairedHealthyEndToEnd (0.13s)
+755:Race Test	UNKNOWN STEP	2026-08-24T21:35:42.6611086Z     timing.go:233: paired-cpu-1x: n=20 median=1.502ms p95=4.479ms worst=5.355ms avg=2.812ms | refUnit=1.375ms ratio=2.47x (maxUnits=2.00x, steadyCeiling=10s, budget=30s)
+756:Race Test	UNKNOWN STEP	2026-08-24T21:35:42.6615423Z     timing.go:237: paired-cpu-1x: measured latency is 2.47x the reference unit (median 1.502491ms), above the 2.00x calibrated bound — the operation now costs more machine-cost units than its design (e.g. an added subprocess or per-write fsync); this is a code regression, not machine load (load inflates the reference equally)
+```
+
+- PR #1600 (`WT-server-version`, internal/cli only). ref and fn are byte-identical `cpuUnit(2_000_000)` (`paired_test.go:68`).
+- **Discriminator**: median(fn)=1.502ms vs median(ref)=refUnit=1.375ms → ratio-of-medians = **1.09x (healthy)**, while the per-round paired-ratio median reads 2.47x. Noise phase-locked to the round alternation (spec §2.2 candidate (i)).
+
+### 2.2 Pre-#1591 occurrences (NEW this sweep — NOT current-defect baseline)
+
+The attempt-aware sweep of the full window found two additional `--- FAIL: TestAssertPairedHealthyEndToEnd` occurrences in run **32429213275** (PR head `ecf9e337`, branch `WT-release-notes`), **both before PR #1591 merged**:
+
+```console
+$ gh run view 32429213275 --attempt 1 --log-failed | grep -A2 'FAIL: TestAssertPairedHealthyEndToEnd'
+Test (ubuntu-latest)	UNKNOWN STEP	2026-08-20T23:39:29.8987941Z --- FAIL: TestAssertPairedHealthyEndToEnd (0.16s)
+Test (ubuntu-latest)	UNKNOWN STEP	2026-08-20T23:39:29.8989093Z     timing.go:209: paired-cpu-1x: n=20 median=3.536ms p95=7.187ms worst=9.187ms avg=3.704ms | refUnit=1.3ms ratio=2.72x (maxUnits=2.00x, steadyCeiling=10s, budget=30s)
+Test (ubuntu-latest)	UNKNOWN STEP	2026-08-20T23:39:29.8991243Z     timing.go:213: paired-cpu-1x: median latency 3.536237ms is 2.72x the reference unit 1.300194ms, above the 2.00x calibrated bound — the operation now costs more machine-cost units than its design (e.g. an added subprocess or per-write fsync); this is a code regression, not machine load (load inflates the reference equally)
+
+$ gh run view 32429213275 --attempt 2 --log-failed | grep 'FAIL: TestAssertPairedHealthyEndToEnd'
+Test (ubuntu-latest)	Run tests with coverage (fast — no race detector)	2026-08-21T02:10:38.6191376Z --- FAIL: TestAssertPairedHealthyEndToEnd (0.15s)
+```
+
+Timeline (measured):
+
+| Event | Timestamp |
+|---|---|
+| run 32429213275 attempt 1 FAIL | 2026-08-20T23:39:29Z |
+| run 32429213275 attempt 2 FAIL (rerun also failed) | 2026-08-21T02:10:38Z |
+| **PR #1591 merged** (`test(ti
```

**File**: `.moai/reports/t278/plan-audit-iter1.md` (added, +87/-0)
```diff
@@ -0,0 +1,87 @@
+# Plan-Audit iter-1 — SPEC-CI-FLAKE-SERIES-001 (card t278)
+
+- Auditor: plan-auditor (independent, fresh context)
+- Date: 2026-08-26
+- Tree: `.claude/worktrees/t278` @ `175d63f3f` (branch `WT-ci-flake-series`)
+- Audit mode: single-backend (claude-only) — `audit_model` not configured in `.moai/config/` (grep 0 hits), so no `audit_multi` fan-out per the cross-model-audit skill's entry condition.
+- Verdict: **PASS-WITH-DEBT** — overall 0.86 (Tier M threshold 0.80), 0 BLOCKING / 2 SHOULD-FIX / 3 MINOR.
+
+---
+
+## Claim / Evidence / Baseline-attribution / Gaps / Residual-risk (audit-level)
+
+**Claim**: The SPEC's evidence chain (3 flakes, 2 premise overturns) and its completion plan are sound and executable.
+
+**Evidence** (all commands run in this audit, this tree):
+
+| # | What was checked | Command | Observed |
+|---|---|---|---|
+| V1 | Flake #1 CI evidence | `gh run view 32774108273 --attempt 1 --log-failed` | `store_test.go:385: received 97 messages, want 100 (loss or duplication)` (0.07s) — byte-identical to spec.md §1.1 |
+| V2 | Flake #1 race-job recurrence | `gh run view 32777242100 --log-failed` | `--- FAIL: TestConcurrentSendPoll (0.27s)` Race Test — matches 관측 2 |
+| V3 | Flake #2 evidence | `gh run view 32779472351 --attempt 1 --log-failed` | `timing.go:233: paired-cpu-1x: n=20 median=1.502ms ... refUnit=1.375ms ratio=2.47x (maxUnits=2.00x...)` — byte-identical; 1.502/1.375 = 1.092x confirms the discriminator arithmetic |
+| V4 | Flake #3 evidence | `gh run view 32815411885 --attempt 1 --log-failed` | `config_change_test.go:51: synchronous return took 123.195919ms, want ≤ 100ms (REQ-HAE-002)` — byte-identical |
+| V5 | Flake #1 TOCTOU code | Read `store_test.go:352-371` | Exit rule at 361-370: 0/0 poll → `select` on `sendersDone` (later time) → immediate exit. Deadline at :351, assertion at :385 — all cited lines exact |
+| V6 | Store exclusion | Read `store.go:262-264, 309-412`, `lock.go:69-114` | Send/Poll both under `withAgentLock` on the same mailbox (in-process mutex + flock) — serialized; claim order writeJSONAtomic(claimed) → removeIfExists(pending), no absence window; TTL sweep 24h/10m (`defaults.go:401-404`) cannot fire in 0.07s |
+| V7 | Flake #3 category error | Read `config_change_test.go:24-63`, `config_change.go:54-82` | RT005 has `t.Parallel()` (:25); assertion :50-52 is single-sample wall clock; Handle sync path = slog.Info + WithTimeout + `go func()` (µs-scale); godoc + `BenchmarkConfigChange_AsyncReturn` (:271-313, p95 check :308-311) confirm the contract is p95 (AC-HAE-003); owner SPEC `SPEC-V3R6-HOOK-ASYNC-EXPAND-001` exists with REQ-HAE-002 |
+| V8 | publish() overturn | `git log -S "func publish(" -- internal/timing/timing.go` | Introduced by `7a531fe86` "test(timing): interleave the calibration reference with the measured runs (t162)" (= PR #1591); `publish()` at timing.go:254-265 called unconditionally in `report()` (:234); `publish_test.go` exists. Card premise "ratio only on failure" is genuinely overturned |
+| V9 | Flake #2 structure | Read `paired_test.go`, `paired_step_test.go`, `timing_test.go` | ref/fn byte-identical `cpuUnit(2_000_000)` (:67-68); alternation at timing.go:342-348; load-step pin + falsifier arm (CheckRatio direct call :56, comment :61-63); historical 2.32x/2.72x/4.64x + 1.82x @ run 32687843472 a1 recorded in test comments — all as cited |
+| V10 | attempt-1 hiding | `gh run list --workflow ci.yml -L 30 --json databaseId,conclusion` | 0 `failure` conclusions among the last 30 runs (08-24→08-26) while ≥4 attempt-1 flare-ups exist in that window (32779472351 and 32815411885 now read `success`). Stronger than the SPEC's own 3-vs-4 measurement |
+| V11 | AC-CFS-007 executability | same run list | ~30 runs / 2.5 days ≈ 12 runs/day cadence → ≥40 go_code=true observations over ≥7 days is concretely achievable (job-count reading: ×2) |
+| V12 | CI job structure | Read `.github/workflows/ci.yml:85-240` | `test` job: no -race, merge gate; `test-race`: advisory; both gated on `needs.detect.outputs.go_code == 'true'` (docs-only PRs excluded from denominator — correctly handled by AC wording "go_code=true") |
+| V13 | Line-reference spot checks | Reads across 6 files | ~15 cited `file:line` references checked; all accurate (incl. `paired_step_test.go:56` CheckRatio, `timing_test.go:14` HARD no-parallel rule, `config_change.go:56-84`) |
+| V14 | AssertPaired blast radius | `grep -rn "AssertPaired(" --include="*_test.go" internal/` | 3 call sites: paired_test.go:61, internal/harness/observer_test.go:251, internal/hook/pre_tool_branch_guard_integration_test.go:207 (TestBranchGuard_Latency) — R1 concern real, M1 item 5 covers enumeration |
+| V15 | New-file collisions | `ls internal/sessionmsg/*_test.go internal/timing/*_test.go` | `stoprule_test.go` / `paired_asym_test.go` do not exist — 신규 as planned; `grep -c "publish(" timing.go` = 2, exactly matching §C expectation |
+
+**Baseline-attribution**: all observations above were produced in t
```

**File**: `.moai/reports/t278/refetch-jobs.sh` (added, +15/-0)
```diff
@@ -0,0 +1,15 @@
+#!/bin/zsh
+# t278 M1 — re-fetch the 16 jobs files that collected a secondary-rate-limit
+# body instead of job rows during sweep v1 (single-flight, 2s spacing).
+set -u
+for id in \
+  31499288220 31626420856 31628085639 31627777786 31639333372 \
+  31641842385 31717046489 31734591740 31728442148 31791185823 \
+  31797542345 31744543706 31783552189 31789379728 31797322925 \
+  31853270653
+do
+  gh api "repos/modu-ai/moai-adk/actions/runs/$id/jobs?per_page=100" \
+    --jq '.jobs[] | "\(.name)\t\(.conclusion)"' > "/tmp/t278-sweep/$id.jobs" 2>/dev/null
+  sleep 2
+done
+echo "REFETCH_DONE"
```

**File**: `.moai/reports/t278/reproduction-rate.md` (added, +86/-0)
```diff
@@ -0,0 +1,86 @@
+# Reproduction Rate — SPEC-CI-FLAKE-SERIES-001 (t278)
+
+Baseline measured 2026-08-27 at run-phase tree `d1289c5db` (branch `WT-ci-flake-series`). Post-merge section will accrue from M3 onward.
+
+## §1 Sweep recipe (attempt-aware, REQ-CFS-009)
+
+- Window: **2026-08-10T00:09:07Z → 2026-08-26T14:55:28Z** (workflow `ci.yml` runs only — the sole go_code-gated workflow that runs the affected jobs).
+- Run enumeration: `gh run list --workflow ci.yml -L 600 --json databaseId,conclusion,createdAt,event` → filter `createdAt >= 2026-08-10` → **537 runs** (439 `pull_request` + 98 `push`).
+- Attempt enumeration per run: `run_attempt` field (highest attempt number) from `gh api repos/modu-ai/moai-adk/actions/runs/<id>`; per-attempt conclusion via `gh run view <id> --attempt <n> --json conclusion`. (The `.../attempts` REST path returns 404 on this repo — see forensics.md §4.)
+- Failed attempts inspected with `gh run view <id> --attempt <n> --log-failed | grep '--- FAIL: <test>'` for the 3 test names.
+- Sweep scripts (committed, re-runnable): `.moai/reports/t278/sweep-attempts.sh` (v2) + `.moai/reports/t278/refetch-jobs.sh` (rate-limit repair for 16 jobs files).
+
+## §2 Baseline occurrence table (Claim)
+
+| # | Test | Run | Attempt | Job | Timestamp (UTC) | Form |
+|---|------|-----|---------|-----|-----------------|------|
+| 1 | TestConcurrentSendPoll | 32774108273 | 1 | Test (ubuntu-latest) — **required gate** | 2026-08-24T20:33:19Z | 97/100 loss, 0 errors, 0.07s |
+| 2 | TestConcurrentSendPoll | 32777242100 | 1 | Race Test (advisory) | 2026-08-24T21:07:31Z | recurrence, 0.27s |
+| 3 | TestAssertPairedHealthyEndToEnd | 32779472351 | 1 | Race Test (advisory) | 2026-08-24T21:35:42Z | per-round 2.47x / ratio-of-medians 1.09x |
+| 4 | TestConfigChange_RT005ReloadIntegration | 32815411885 | 1 | Race Test (advisory) | 2026-08-25T06:12:45Z | single-sample 123.195919ms vs ≤100ms |
+| — | *(pre-#1591, excluded from current-defect baseline)* | 32429213275 | 1 | Test (ubuntu-latest) | 2026-08-20T23:39:29Z | bilateral 2.72x (defect fixed by #1591, merged 2026-08-21T04:20:27Z) |
+| — | *(pre-#1591, excluded)* | 32429213275 | 2 | Test (ubuntu-latest) | 2026-08-21T02:10:38Z | rerun of same run also failed |
+
+Rerun-green concealment re-measured on this window: `gh run list --status failure` style views key on the LATEST attempt; the sweep inspected every attempt and found **19 multi-attempt runs / 556 total attempts** across the 537-run window.
+
+## §3 Green ratio distribution (statistic-decision input)
+
+- **CI channel gap (Gaps)**: `publish()` writes `GITHUB_STEP_SUMMARY`, a web-UI surface with no `gh` CLI read path; green runs' `t.Log` lines are discarded by non-verbose `go test` (both CI jobs run non-verbose). No CI green `paired-cpu-1x` line is mechanically extractable — ≥10 green summary lines could NOT be collected locally in M1. Per plan.md §D-M1 item 3 fallback, the local reference distribution was measured and the gap stands recorded here.
+- **Local reference distribution** (command: `go test -race -count=10 -run TestAssertPairedHealthyEndToEnd -v ./internal/timing/` on darwin, tree `d1289c5db`, 2026-08-27, all PASS, exit 0):
+
+| run | median | refUnit | ratio |
+|-----|--------|---------|-------|
+| 1 | 514µs | 515µs | 1.00x |
+| 2 | 503µs | 503µs | 0.99x |
+| 3 | 514µs | 507µs | 1.01x |
+| 4 | 515µs | 513µs | 1.00x |
+| 5 | 514µs | 511µs | 1.00x |
+| 6 | 512µs | 511µs | 1.00x |
+| 7 | 507µs | 507µs | 1.00x |
+| 8 | 495µs | 496µs | 1.00x |
+| 9 | 514µs | 507µs | 1.00x |
+| 10 | 515µs | 514µs | 1.00x |
+
+Healthy-form evidence: on an unloaded machine the two estimators coincide (0.99x–1.01x), i.e. the divergence seen in occurrence #3 (1.09x vs 2.47x) is a CI-load artifact, not a code property. CI green figures accrue in the post-merge window via the job-summary channel (manual visibility) — recorded as they surface.
+
+## §4 Denominator arithmetic (for REQ-CFS-010 `(1-p̂)^N` confidence)
+
+Observation unit N = count of `go_code=true` workflow runs (spec v0.2.0 D2: run count, NOT job-instance count; both affected jobs enumerated per run).
+
+| Quantity | Value | Derivation |
+|----------|-------|------------|
+| ci.yml runs in window | 537 | run list filter |
+| — with Test job executed (go_code=true) | 535 | jobs API, Test job present under either name era (union 535; `Test (ubuntu-latest)` 529 runs ∩ unexpanded `Test (${{ matrix.os }})` rendering 535 runs — names overlap, not a partition; 0 skipped) |
+| — cancelled before jobs started | 2 | runs 31870129254, 32805423009 (empty jobs list) |
+| Race Test job present | 386 | jobs API (condition `!startsWith(head_ref,'release/')` + workflow evolution) |
+| Runs with >1 attempt | 19 | `run_attempt > 1` |
+| Total attempts inspected | 556 | 518 single-attempt + 38 across multi-attempt runs |
+| Failed attempts grepped for the 3 names | 52 | `--log-failed` + grep |
+| True `--- FAIL:` matches | 6 | 4 current-defect + 2 pre-#1591 |
+| **Post-#1591 ru
```

**File**: `.moai/reports/t278/sweep-attempts.sh` (added, +58/-0)
```diff
@@ -0,0 +1,58 @@
+#!/bin/zsh
+# t278 M1 attempt-aware baseline sweep — SPEC-CI-FLAKE-SERIES-001
+# REQ-CFS-009: every failed attempt of every ci.yml run is inspected, because
+# rerun-green hides attempt-1 failures from `gh run list --status failure`.
+#
+# NOTE on the API: the REST path /actions/runs/<id>/attempts returns 404 on
+# this repo (measured 2026-08-27 — 537/537 runs), so attempts are enumerated
+# from the run's `run_attempt` field (the highest attempt number, 1-based)
+# and each attempt's conclusion is read via `gh run view --attempt N --json`.
+#
+# v2 inputs (from sweep v1, already on disk):
+#   /tmp/t278-runs.tsv            databaseId \t conclusion \t createdAt \t event
+#   /tmp/t278-sweep/<id>.jobs     job name \t conclusion (latest attempt)
+# v2 outputs:
+#   /tmp/t278-sweep/<id>.att<N>   conclusion of attempt N (only when N>1 or failed)
+#   /tmp/t278-sweep/<id>.attempt<N>.hits  grep of the 3 flaky test names
+#   /tmp/t278-sweep/<id>.done2
+set -u
+
+process_run() {
+  local id=$1
+  local dir=/tmp/t278-sweep
+  [ -f "$dir/$id.done2" ] && return 0
+
+  local maxatt
+  maxatt=$(gh api "repos/modu-ai/moai-adk/actions/runs/$id" --jq '.run_attempt' 2>/dev/null)
+  case "$maxatt" in
+    ''|*[!0-9]*) maxatt=1 ;;
+  esac
+
+  local att=1
+  while [ "$att" -le "$maxatt" ]; do
+    local c
+    if [ "$maxatt" -eq 1 ]; then
+      c=$(awk -F'\t' -v id="$id" '$1==id {print $2}' /tmp/t278-runs.tsv)
+    else
+      c=$(gh run view "$id" --attempt "$att" --json conclusion --jq '.conclusion' 2>/dev/null)
+      printf '%s\n' "$c" > "$dir/$id.att$att"
+    fi
+    case "$c" in
+      success|skipped|Success|""|null|cancelled) ;;
+      *)
+        gh run view "$id" --attempt "$att" --log-failed 2>/dev/null \
+          | grep -e 'TestConcurrentSendPoll' -e 'TestAssertPairedHealthyEndToEnd' -e 'TestConfigChange_RT005ReloadIntegration' \
+          > "$dir/$id.attempt${att}.hits"
+        ;;
+    esac
+    att=$((att + 1))
+  done
+  touch "$dir/$id.done2"
+}
+
+while IFS=$'\t' read -r id concl created event; do
+  process_run "$id" &
+  while [ "$(jobs -r | wc -l)" -ge 8 ]; do sleep 0.3; done
+done < /tmp/t278-runs.tsv
+wait
+echo "SWEEP_V2_DONE $(ls /tmp/t278-sweep/*.done2 2>/dev/null | wc -l | tr -d ' ') runs processed"
```

**File**: `.moai/reports/t278/timing-statistic-decision.md` (added, +45/-0)
```diff
@@ -0,0 +1,45 @@
+# Timing Statistic Decision — SPEC-CI-FLAKE-SERIES-001 (t278 M1, REQ-CFS-006)
+
+Decided 2026-08-27 at run-phase tree `d1289c5db`. Verdict: **ADOPT the AND-gate** — the calibrated arm of `AssertPaired` shall fail only when BOTH the per-round paired-ratio median AND the ratio-of-medians exceed `MaxUnits`. The fallback (trimmed per-round median + more iterations) is REJECTED, on measured arithmetic below.
+
+## (a) Option comparison
+
+| Property | AND-gate (adopted) | Fallback: trimmed per-round + Iterations↑ (rejected) |
+|---|---|---|
+| Rule | fail iff `median(perRoundRatios) > MaxUnits` **AND** `median(fn)/median(ref) > MaxUnits` | drop top-k% of per-round ratios, raise Iterations |
+| Alternation-locked asymmetry (post-#1591 observed form: per-round 2.47x, medians 1.09x) | **PASS** — medians healthy ⇒ no failure | trimmed median stays 2.47x ⇒ **still FAILS** (arithmetic below) |
+| Offset load-step (pinned by `TestCalibratedRatioSurvivesOffsetLoadStep`: per-round 1.00x, medians 1.89x) | **PASS** — per-round healthy | PASS (per-round family is step-robust by construction) |
+| Homogeneous true regression (4x every round, pinned by `TestPairedRatioStillCatchesRealCostGrowth`) | **FAIL** — both figures 4x ⇒ detection preserved | FAIL — detection preserved |
+| Healthy code (local 10×0.99–1.01x; CI healthy ≈1.0x expected) | PASS with ~2x headroom under a 2.00x bound | PASS |
+| blast radius | `CheckRatio` semantics extended for the paired path; `Assert`/`Check` (unpaired) untouched | touches sample-count economics of every paired caller (Iterations is a Bound field callers set) |
+
+Implementation note for M2: `measurePaired` already returns `refSt` (`timing.go:332-356`), so both figures exist at the `report()` call site (`timing.go:215-218`); enforce the AND there (or in a new pure helper beside `CheckRatio`, `timing.go:289-308`) while keeping `CheckRatio`'s signature available — `paired_step_test.go:56` and `paired_step_test.go:79` call `CheckRatio`/`Check` directly and must keep compiling and passing unchanged (REQ-CFS-005).
+
+## (b) Measured basis
+
+1. **The only post-#1591 flare-up is alternation-locked asymmetry** (forensics.md §2.1, run 32779472351 a1): `n=20 median=1.502ms … refUnit=1.375ms ratio=2.47x` — ratio-of-medians = 1.502/1.375 = **1.09x (healthy)** while the enforced per-round median reads 2.47x. The defect being fixed is exactly "per-round alone over-trips on this form"; the AND-gate passes it.
+2. **Local green distribution** (10 runs, darwin, `-race -count=10 -run TestAssertPairedHealthyEndToEnd`, tree `d1289c5db`, all PASS): ratios 0.99x–1.01x, median ≈ refUnit ≈ 503–515µs — on healthy unloaded code the two estimators coincide, so the AND conjunction costs nothing there. CI green figures are not mechanically extractable (channel gap — reproduction-rate.md §3).
+3. **Pre-#1591 bilateral form** (run 32429213275 a1/a2, 8/20–21, both before #1591 merged 8/21 04:20): median=3.536ms, refUnit=1.3ms — both estimators ≈ 2.72x. That flake form (measuring tests overlapping windows) was real and was fixed by #1591; the AND-gate **correctly still fails it** — the gate does not re-open a fixed hole.
+4. **Out-of-scope caller flake, same window** (run 32687843472 a1, 8/24, fast job): `TestBranchGuard_Latency` failed with median=3.431ms, refUnit=1.884ms — again bilateral 1.82x. AND-gate behavior unchanged for it; recorded here as evidence the calibrated arm's bilateral class keeps its detection across callers (see (c)).
+
+Why ≥11 rounds must be inflated for the observed form: `medianFloat` returns `sorted[len/2]` (`timing.go:359-366`) = the 11th of 20 sorted values; a 2.47x median requires at least 11 of 20 rounds ≥ 2.47x while `median(fn)/median(ref)` stays 1.09x — only a systematic, alternation-locked asymmetry produces that (spec §2.2 candidate (i); candidate (ii), a CFS freeze of one in-flight sample, lands on random rounds and cannot hold 11 of 20 above bound while keeping both medians equal — no observation in this window matches (ii)).
+
+## (c) Full AssertPaired caller census (command: `grep -rn "AssertPaired(" --include="*_test.go" internal/` — 3 call sites)
+
+| Caller | Site | Bound | Per-caller impact of AND-gate |
+|---|---|---|---|
+| `TestAssertPairedHealthyEndToEnd` | `internal/timing/paired_test.go:61` | MaxUnits 2.0, It 20, W 2, ref/fn byte-identical `cpuUnit(2_000_000)` | The flake itself: observed 2.47x/1.09x form now passes; healthy 1.00x passes; no downside measured |
+| `TestRecordEvent100Sequential` (RecordEvent append cycle) | `internal/harness/observer_test.go:251` | MaxUnits 2.0, It 100, W 5, ref mirrors full append mix | Positive/neutral: alternation-locked false positives suppressed; an added fsync/spawn regression inflates both estimators ⇒ still caught |
+| `TestBranchGuard_Latency` (checkBranchState spawn cycle) | `internal/hook/pre_tool_branch_guard_integration_test.go:207` | MaxUnits 1.5, It 100, W 3, ref = same rev-parse spawn | Positive/neutral, 
```

**File**: `.moai/specs/SPEC-CI-FLAKE-SERIES-001/acceptance.md` (added, +98/-0)
```diff
@@ -0,0 +1,98 @@
+# Acceptance — SPEC-CI-FLAKE-SERIES-001
+
+측정 기준 트리: `.claude/worktrees/t278` @ `175d63f3f` (plan-phase 증거). 아래 RED 값은 이 트리와 CI attempt-1 로그(run ID 명시)에서 실제로 관측한 값이다. 각 AC는 **관측 가능한 출력**을 내는 명령으로 판정한다. 완료 축은 t261 verification-completeness: 검증은 관측으로, 추론으로 대체하지 않는다 — 특히 AC-CFS-007(CI 재현율)은 로컬 초록만으로 판정 불가다.
+
+---
+
+## §D AC 매트릭스
+
+| AC | 요구사항 | RED (현재) | GREEN (목표) |
+|---|---|---|---|
+| AC-CFS-001 | REQ-CFS-001, 002 | 결정론적 재현 테스트가 구 종료 규칙에서 97/100 손실로 실패 | 재현 테스트 100/100 + 수정된 `TestConcurrentSendPoll` 무변식 통과 |
+| AC-CFS-002 | REQ-CFS-001 | (연속성 축 — 현재도 로컬 초록) | `go test -race -count=20 ./internal/sessionmsg/` 연속 통과 |
+| AC-CFS-003 | REQ-CFS-003, 005 | 합성 교대-비대칭 분포에서 현행 추정량(per-round 중앙값)이 오탐 실패 — 이 결함 자체가 단위 테스트로 핀됨 | 신규 추정량은 교대 비대칭 통과 **그리고** 기존 `TestCalibratedRatioSurvivesOffsetLoadStep`(load-step)도 통과 |
+| AC-CFS-004 | REQ-CFS-004 | 균질 3x 합성 분포(mutant: `cpuUnit(6_000_000)`) — 현행 추정량 실패(검출됨) | 신규 추정량도 여전히 실패(검출 보존) |
+| AC-CFS-005 | REQ-CFS-006 | 통계 결정 기록 부재 | `.moai/reports/t278/timing-statistic-decision.md`가 측정 데이터(§D.5 판정 명령)와 호출자 전수를 인용 |
+| AC-CFS-006 | REQ-CFS-007 | 변이(동기 경로 `time.Sleep(150ms)`)에서 현행 단일-샘플 단언 실패 — 단, 무부하시 통과하는 것이 노이즈 취약 | p95 재구성 후: (a) 변이 주입 시 여전히 실패 (b) 변이 제거 시 `go test -race -count=5 -run 'TestConfigChange' ./internal/hook/` 통과 |
+| AC-CFS-007 | REQ-CFS-009, 010, 011 | baseline 미측정(관측된 발화: 4건 — run 32774108273 a1, 32777242100, 32779472351 a1, 32815411885 a1) | `.moai/reports/t278/reproduction-rate.md`: (a) attempt-aware baseline 발화 수·분모(창 2026-08-10~) 측정 (b) 머지 후 N≥40(N = go_code=true workflow run 수 — §D.1 GREEN 조건과 동일 정의) 관측 **AND** ≥7일에서 3 테스트 재발 0 (run ID 목록) (c) 신뢰도 산술(같은 N 정의) + Gaps/Residual-risk |
+| AC-CFS-008 | REQ-CFS-012 | 계열 보고서 부재 | `.moai/reports/t278/series-analysis.md` — 공통 인자 + 3 사례 대응 표 + 재사용 저작 규칙 명문화 |
+| AC-CFS-009 | (범위 규율) | — | diff가 명명된 파일(`store_test.go`, `stoprule` 신규 테스트, `timing.go`, timing 테스트 2종, `config_change_test.go`)과 산출물 경로에만 한정 — 무관 테스트 경화 0건 |
+| AC-CFS-010 | REQ-CFS-008 | 자가선언 측정 테스트 5종 전부 비병렬(현행 트리 실측: VIOLATION 0건 — 판정 명령의 RED는 mutant로 별도 관측 완료, §D.1) | 동일 판정 명령으로 VIOLATION 0건 유지 + 신규 측정 테스트의 마커 합류 |
+
+---
+
+## §D.1 AC 상세
+
+### AC-CFS-001 — 종료 규칙 TOCTOU 제거 (결정론적 RED→GREEN)
+
+**판정 명령** (워크트리 안):
+```bash
+go test -race -count=3 -run 'TestPollerStopRule' -v ./internal/sessionmsg/   # 신규 재현 테스트(명칭은 run-phase 확정)
+go test -race -count=3 -run 'TestConcurrentSendPoll' -v ./internal/sessionmsg/
+```
+
+**RED 근거 (이미 관측됨)**: CI run 32774108273 attempt 1 — `store_test.go:385: received 97 messages, want 100` (0.07s, 에러 0건). 로컬에서는 스케줄링 창이 열리지 않아 재현되지 않으므로, 재현 테스트는 채널 핸드셰이크로 그 인터리빙을 **강제**한다(plan.md §B.1). 수정 전 트리에서 재현 테스트가 97/100으로 실패함을 먼저 관측(RED-now)하고 수정 후 100/100(GREEN)을 관측한다.
+
+**Mutant (규칙 회그 감시)**: 재생성 규칙을 구 형태(select-즉시-탈출)로 되돌리면 재현 테스트가 다시 RED가 됨을 1회 관측해 테스트가 규칙을 실제로 검사함을 증명(관측 기록을 progress.md에).
+
+### AC-CFS-002 — sessionmsg 연속성
+
+**판정 명령**: `go test -race -count=20 ./internal/sessionmsg/` → exit 0. (기존 테스트 주석이 명시하는 acceptance 관례 준수. 로컬은 필요조건일 뿐 — CI 판정은 AC-CFS-007.)
+
+### AC-CFS-003 / AC-CFS-004 — 보정 통계의 이중 속성 (순수 단위 판정)
+
+**판정 명령**: `go test -race -count=5 ./internal/timing/` — 신규 속성 테스트 2종 + 기존 핀 테스트 전부 포함.
+
+- **교대 비대칭 합성 분포**: 참 비 1.00x, 라운드 절반이 fn-우위·절반이 ref-우위(2026-08-24 관측의 통계적 형태 — median(fn)/median(ref)≈1.09x인데 per-round 중앙값 ≥2.4x). 신규 추정량: 통과해야 함. **Falsifier arm**: per-round 단독 추정량은 이 분포에서 실패함을 같은 테스트가 증명(이 팔이 없으면 추정량이 데이터를 무시해도 통과).
+- **균질 3x 분포** (`cpuUnit(6_000_000)` 또는 합성 3x 샘플): 신규 추정량 실패(검출). 현행 추정량도 실패함(RED-now 셀 — 검출력이 현재 있었고 유지됨을 보여주는 기준점).
+- **기존 load-step 핀**: `TestCalibratedRatioSurvivesOffsetLoadStep` 변경 없이 통과 (REQ-CFS-005).
+
+### AC-CFS-005 — 통계 결정 기록
+
+**판정 명령**: `.moai/reports/t278/timing-statistic-decision.md` 존재 + 다음을 인용: (a) AND-gate 대안 비교표, (b) 측정 근거 — 로컬 `-race -count=10 ./internal/timing/ -run TestAssertPairedHealthyEndToEnd`의 ratio 분포와(또는) 확보된 CI 초록 summary 라인 수(채널 격차 명시), (c) `grep -rn "AssertPaired(" --include="*_test.go" internal/` 호출자 전수와 영향 판정.
+
+### AC-CFS-006 — hook 단언 p95 재구성
+
+**판정 명령**:
+```bash
+go test -race -count=5 -run 'TestConfigChange_RT005ReloadIntegration' -v ./internal/hook/   # 변이 전후 각 1회 + 최종
+```
+(1) 변이 주입(동기 경로 `time.Sleep(150*time.Millisecond)`) → 실패 관측. (2) 변이 제거 → 통과 관측. (3) 측정 방식이 다중 샘플 p95(≥20표본)임을 코드에서 확인 — 단일 벽시계 최댓값 형태가 남아 있으면 FAIL.
+
+### AC-CFS-007 — 재현율 verdict (관측 의존 — 로컬 대체 불가)
+
+**Baseline (RED-now 셀)**: 2026-08-24~25에 관측된 발화 4건 (각각 spec.md §1의 run ID·attempt·job·타임스탬프). run-phase M1이 창 2026-08-10~ 전체를 attempt-aware로 sweep해 분모(run 수)와 함께 확정한다.
+
+**판정 명령 (sweep — 스크립트로 `.moai/reports/t278/`에 산출)**:
+```bash
+gh run list --workflow ci.yml -L <창> --json databaseId,conclusion
+# 각 run: gh api repos/modu-ai/moai-adk/actions/runs/<id>/attempts → 실패 attempt마다:
+gh run view <id> --attempt <n> --log-failed | grep -e 'TestConcurrentSendPoll' -e 'TestAssertPairedHealthyEndToEnd' -e 'TestConfigChange_RT005ReloadIntegration'
+```
+
+**GREEN 조건 (모두 관측값)**: (a) baseline 절 완성 (b) 수정 머지 후 **N≥40 — N은 `go_code=true` workflow run 수**(job-인스턴스 수가 아님; 
```

**File**: `.moai/specs/SPEC-CI-FLAKE-SERIES-001/plan.md` (added, +136/-0)
```diff
@@ -0,0 +1,136 @@
+# Plan — SPEC-CI-FLAKE-SERIES-001
+
+## §A 맥락
+
+카드 t278 (t270·t271 흡수). 작업 트리 `.claude/worktrees/t278`, 브랜치 `WT-ci-flake-series`, base `175d63f3f`. plan-phase에서 수행한 로그 포렌식·코드 정독의 결과와 뒤집힌 전제는 `spec.md` §2에 고정됐다 — run-phase는 그 조사를 **다시 하지 않고** §C 사전점검으로 현행성만 확인한 뒤 시작한다.
+
+### Tier 판정 — M
+
+| 축 | 값 | Tier M 상한 | 여유 |
+|---|---|---|---|
+| REQ | 12 (REQ-CFS-001..012) | 16 | 4 |
+| AC | 10 (AC-CFS-001..010) | 16 | 6 |
+| 마일스톤 | 4 | — | — |
+
+- **S 아님**: 3개 패키지 + 공유 라이브러리(internal/timing) 통계 변경 + CI 관측 의존 완료 판정 + 보고서 4종. 단일 파일 편집이 아니다.
+- **L 아님**: 파일 6-8개, 새 아키텍처 없음, 되돌리기 어려운 인터페이스 없음, constitutional 범위 아님.
+
+### 카드 등급
+
+배차 등급 Class B(결함, 원인 미상). plan-phase 조사로 세 메커니즘 중 2개는 확정·1개는 후보 2계열로 좁혔다(#2.1, #2.2). 통계 선택(REQ-CFS-006)에 데이터 의존 설계 결정이 남아 있으므로 SPEC을 세워 진행한다 — 속도가 아니라 결정의 존재가 근거다(결함이라 해도 회귀 방지 속성 테스트라는 설계 판단을 동반).
+
+## §B 수정 설계 (M1 결정 전 확정된 부분)
+
+### B1 — flake #1: 종료 규칙 긍정화 (`internal/sessionmsg/store_test.go`)
+
+현재(`store_test.go:361-370`): 0/0 관측 → `select`로 `sendersDone` 확인(관측보다 나중 시각) → 닫혔으면 즉시 탈출.
+
+수정: 0/0 관측 후 `sendersDone`이 닫혀 보이면 **재poll 1회**를 수행하고, 그 재poll(송신 전원 완료 이후에 시작 = 모든 rename 이후의 리스팅)도 0/0이어야 탈출한다. 재poll의 메시지는 수령 목록에 합산한다. 재수행 불가 창이 원천적으로 사라진다 — `close(sendersDone)`는 `wgSend.Wait()` 뒤에만 실행되므로 모든 Send 반환(따라서 모든 pending rename 완료) 이후이고, 그 이후에 시작한 poll의 빈 관측은 종언(terminal)이다.
+
+결정론적 재현 테스트(REQ-CFS-002, 신규 파일 `internal/sessionmsg/stoprule_test.go` 또는 store_test.go 내): 채널 핸드셰이크로 치명 인터리빙을 강제한다 —
+
+1. 송신 고루틴: 97건 Send → "sent97" 신호 → poller의 "sawEmpty" 신호 대기.
+2. poller: 0/0에 도달하면 "sawEmpty" 신호 → 송신측 "done-closed" 신호 대기(select 직전에서 봉쇄).
+3. 송신: 잔여 3건 Send + done close → "done-closed" 신호.
+4. poller 재개: 구규칙이면 즉시 탈출(97 ≠ 100 RED), 신규칙이면 재poll로 3건 수령(100 GREEN).
+
+동시성 원본 테스트(`TestConcurrentSendPoll`)는 불변식(100 유일·0손실·0중복) 그대로 두고 종료 규칙만 교체한다. sleep 없이 결정론적이다.
+
+### B2 — flake #2: 보정 통계 (internal/timing) — M1 데이터가 선택
+
+Leading option **AND-gate**: calibrated arm 실패 조건을 "per-round 비 중앙값 > MaxUnits **AND** ratio-of-medians > MaxUnits"로.
+
+- 참 균질 회귀(3x): 두 추정량 모두 상회 → 실패 ✓ (REQ-CFS-004 변이로 증명)
+- load-step(핀된 속성): ratio-of-medians만 상회 → 통과 ✓ (REQ-CFS-005)
+- 교대 비대칭(2026-08-24 관측 형태): per-round만 상회(1.09x vs 2.47x) → 통과 ✓ (REQ-CFS-003)
+
+Fallback option: per-round 비의 절사 중앙값(trimmed) + Iterations 증가 — 단 관측 형태는 라운드의 절반이 쏠린 것이라 절사로는 회복 불가 가능성이 높고(§1.2 판별자), M1 합성 분포 테스트가 기각하면 채택하지 않는다.
+
+변경 위치: `AssertPaired`/`report`(`timing.go:215-238`)가 두 수치를 계산해 `CheckRatio` 호출부에서 AND 판정. 순수 함수 `CheckRatio` 시그니처는 가능한 한 유지(기존 핀 테스트 `paired_step_test.go:56`가 직접 호출). 호출자(`TestBranchGuard_Latency` 등) 전수 조사 결과를 M1 결정 문서에 기록.
+
+속성 테스트 2종(신규, `internal/timing/paired_asym_test.go` 가칭):
+- 교대 비대칭 합성 분포: 짝수 라운드 fn+δ/ref 기준, 홀수 라운드 반전 — 참 비 1.00x, per-round 중앙값은 관측 형태처럼 폭등. 신규 추정량은 통과, per-round 단독 추정량은 실패해야 한다(falsifier — 추정량이 데이터를 무시해도 통과하는 테스트가 되지 않기 위한 것, `paired_step_test.go:61-63`의 반위(反僞) 패턴 준용).
+- 균질 3x 분포: 신규 추정량 실패(검출력).
+
+### B3 — flake #3: 단언 재구성 (`internal/hook/config_change_test.go`)
+
+`Handle`을 N=20회(핸들러 매회 신규 생성) 측정해 elapsed 표본 20개를 만들고 p95 ≤ 100ms를 단언한다. 각 표본은 Handle 1회 호출 후 `testutil.WaitForAsync(t, h.waitGroup(), 2*time.Second)`(기존 RT005 종결 패턴, `config_change_test.go:63`)로 해당 핸들러의 비동기 고루틴을 배수한 뒤 다음 표본으로 진행한다 — 표본 간 고루틴 누수·간섭 없이 20개 표본 전원이 종결된 상태에서 판정한다. nearest-rank p95(`timing.go`와 동일 의미론으로 로컬 계산 또는 기존 percentile 도구 재사용)는 20표본에서 두 번째로 큰 값 — 단일 선점 표본 1개가 p95를 침범하지 않는다(선점 2개 이상이 동시에 들어와야 하는데 그 결합 확률은 관측된 단발 형태보다 훨씬 낮다). `WaitForAsync` 종결 검증(긍정 대기)은 그대로 유지. `BenchmarkConfigChange_AsyncReturn`은 무변경(범위 밖).
+
+변이: 동기 경로에 `time.Sleep(150ms)` 주입 시 p95 단언 RED — 검출력 증명 후 변이 제거.
+
+## §C 사전 점검 (run-phase 진입 시 재측정 — 값이 다르면 멈춰 보고)
+
+| 명령 | 기대값 |
+|---|---|
+| `git -C <worktree> rev-parse --short HEAD` | `175d63f3f` 기반 (이후 커밋이 base를 앞지르면 fetch 후 재확인) |
+| `grep -c "publish(" internal/timing/timing.go` | ≥ 2 (정의 + 호출 — publish 회귀 여부) |
+| `gh run view 32774108273 --attempt 1 --log-failed \| grep -c ConcurrentSendPoll` | ≥ 1 (증거 접근성 — 로그 만료 시 spec.md 인용으로 대체하고 M1 sweep이 재수집) |
+| `go test -race -count=1 ./internal/timing/ ./internal/sessionmsg/` | PASS (baseline — 이미 초록이어야 함) |
+
+## §D 마일스톤
+
+### M1 — 조사 확정·baseline 측정·통계 결정 (수정 0건)
+
+1. `.moai/reports/t278/forensics.md`: spec.md §1-§2의 증거(3 run attempt-1 로그 발췌 + 행 번호)를 run-phase 트리 SHA와 함께 고정.
+2. **attempt-aware baseline sweep** (창: 2026-08-10 ~ run-phase 시작일): `gh run list --workflow ci.yml -L <창>` → 각 run의 attempts 열거(`gh api repos/modu-ai/moai-adk/actions/runs/<id>/attempts`) → 실패 attempt마다 `--log-failed`에서 3 테스트명 grep → 발화 수·run ID·job·시각 표. 산출: `.moai/reports/t278/reproduction-rate.md`(baseline 절).
+3. **초록 ratio 분포 수집**: job summary(GITHUB_STEP_SUMMARY)의 `paired-cpu-1x` 라인 ≥10개 — 웹 summary 접근이 불가하면 대안: 해당 job 재실행 없이 과거 초록 run의 summary URL 목록을 run ID와 함께 기록(수동 열람분 인용) 또는 Race Test job에서 직접 측정 1회(`go test -race -run TestAssertPairedHealthyEndToEnd -count=10 ./internal/timing/` — 단일 패키지·부하 규율 내)로 로컬 참조치만 확보하고 CI 초록 분포는 AC-CFS-007 관측 창에서 지속 수집(채널 격차를 결정 문서에 명시).
+4. **통계 결정**: B2의 AND-gate vs fallback을 1-3 데이터로 판정. 산출: `.moai/reports/t
```

---

### Incident Patch 4: `410da655` (2026-08-26)
**Commit Message**: fix(t229): codex verdict synthesis — SPEC-CODEX-VERDICT-SYNTH-001 (unrecognized bodies no longer pass) (#1663)

* docs(t229): establish root cause of audit_multi codex verdict/body mismatch

The codex backend returns no structured verdict at all: ReviewOutput.Verdict is
synthesized by a single regex over the review prose (synthesizeReviewOutput,
mcp_codex.go:1113), and defaults to "pass" when the regex does not match. The
regex was calibrated on codex-cli 0.146.1 review-mode bullets, but the
audit_multi path always runs adversarial mode, whose prompt constrains no
output format.

Live reproduction at codex-cli 0.149.0: field "pass" while the body's first
line reads "Verdict: inconclusive — ... a pass would be unsupported"; bullet
regex hits 0. Same lenient direction as the three recorded t197 mismatches.

Retrospective scan is bounded: no ConvergenceResult was ever persisted
(session_id never passed), so only hand-written verdict tables survive — 9
found, all from t197, 2 with pass-field/FAIL-body plus 1 attested in prose.

Evidence: .moai/reports/t229/{cause.md,live-probe-body.txt,retro-sweep.sh,retro-sweep.md}

🗿 MoAI

* docs(t229): re-cite the cause report against the measured 

**File**: `.moai/reports/t229/baseline-rebased.md` (added, +69/-0)
```diff
@@ -0,0 +1,69 @@
+# t229 — run-phase 착수 베이스라인 (rebase 후 재측정)
+
+리드 지시(Kickoff §참고)에 따라 **바이너리 재설치 + origin/main rebase 후** 트리 기준으로 부분 RED 기대값을 재확인했다.
+
+| 항목 | 값 |
+|---|---|
+| 측정 트리 | `6346e643b` (rebase 후 `WT-audit-verdict-converge` HEAD, base = `origin/main` `f7eec06c7`) |
+| 이전 측정 트리 | `294b4b6ab` |
+| 측정 방법 | `internal/cli` 에 임시 테스트를 넣어 `synthesizeReviewOutput` 직접 호출 후 삭제 |
+| 측정 일자 | 2026-08-25 |
+
+## rebase 가 필요했던 이유
+
+`git rev-list --count --left-right origin/main...HEAD` 가 `10 6` 을 냈고, upstream 10건 중 **`baa100ce5`(t225, #1642)가 `mcp_codex.go`(+106/-16)와 `mcp_convergence.go` 를 건드렸다.** 스테일 base 위에 구현하면 같은 파일에서 충돌하므로 먼저 rebase 했다(6커밋 전부 문서, 충돌 0, 결과 `0 6`).
+
+**합성 seam 자체는 t225 가 건드리지 않았다** — `git show baa100ce5 -- internal/cli/mcp_codex.go | grep -E '^[-+].*(synthesizeReviewOutput|codexFindingBullet|codexStatedVerdict|verdict :=)'` 무출력. 따라서 동작 베이스라인은 그대로이고 **줄 번호만 밀린다**(SPEC 인용은 M1 착수 시 재측정 대상).
+
+부수 확인: t225 의 CR 대응 보고서가 **Major #8 을 t246 계열로 기록**했다 — 감사/핀 해소가 심사 대상과 다른 트리를 읽는 결함. 내가 F9 에서 좁혀 올린 것과 같은 계열이며, `projectRoot` threading 이 인용 가능한 선례로 남았다.
+
+## 바이너리 상태
+
+```
+$ ~/go/bin/moai version
+ v3.1.3-rc.1   30afb9a1d   built 2026-08-24T15:28:13Z
+$ git merge-base --is-ancestor f505955a9 30afb9a1d ; echo $?   # t178 → 0 (포함)
+```
+
+리드가 알린 재설치가 확인됐다. 종전 `v3.1.2 @ a1b1ca696`(259커밋 스테일, t178·t186 미포함)이 라이브 프로브의 `pass` 를 만들어 낸 원인이었고, 지금 바이너리에는 `codexStatedVerdict` 파서가 들어 있다. **다만 이 SPEC 의 검증은 `go test` 로만 한다**(plan.md §A) — 바이너리 경로를 근거로 쓰지 않는다.
+
+## 서식 corpus (AC-CVS-001 — 하나도 `pass` 가 아니어야 함)
+
+| # | 합성 verdict | stated 매치 | bullet 매치 | 상태 |
+|---|---|---|---|---|
+| C1 | `pass` | false | false | **RED** |
+| C2 | `pass` | false | false | **RED** |
+| C3 | `pass` | false | false | **RED** |
+| C4 | `pass` | false | false | **RED** |
+| C5 | `pass` | false | false | **RED** |
+| C6 | `pass` | false | false | **RED** |
+| C7 | `pass` | false | false | **RED** |
+| C8 | `pass` | false | false | **RED** |
+
+**8/8 RED.** 감사 iter1 이 `294b4b6ab` 에서 측정한 것과 동일하다 — acceptance.md 의 "C1~C8 전부" RED 기대가 rebase 후에도 유효하다.
+
+## 조합 corpus (AC-CVS-006 — 채택값 = 집합의 최댓값)
+
+| # | 합성 verdict | 기대 | 상태 |
+|---|---|---|---|
+| K1 | `fail` | `fail` | GREEN |
+| K2 | `fail` | `fail` | GREEN |
+| **K3** | **`pass`** | **`fail`** | **RED** |
+| K4 | `inconclusive` | `inconclusive` | GREEN |
+| K5 | `fail` | `fail` | GREEN |
+| K6 | `fail` | `fail` | GREEN |
+| **K7** | **`pass`** | **`inconclusive`** | **RED** |
+| K8 | `pass` | `pass` | GREEN |
+
+**부분 RED 2행(K3·K7), 나머지 6행 GREEN** — 감사 iter2 실측과 **완전 일치**한다. rebase 도 바이너리 재설치도 이 기대를 바꾸지 않았다.
+
+[HARD] **이 두 행을 초록으로 뒤집는 것은 M2**(점수 표기 신호 도입)다. M1(fall-through 교정)만 착지한 중간 상태에서 K3·K7 이 여전히 붉은 것은 **회귀가 아니라 설계대로**다 — 두 행 모두 `stated` 가 매치되므로 fall-through 경로를 타지 않는다. 그 시점에 기대값을 관측 동작에 맞춰 낮추면 두 행의 검출력이 사라지며, 그것이 이 카드가 다루는 실패 형태다(acceptance.md §C AC-CVS-006 `[HARD]`).
+
+## 검증 명령
+
+```
+go test ./internal/cli/ -run TestT229BaselineRebased -v -count=1 -timeout 1200s   → ok 0.948s
+go vet ./internal/cli/                                                            → rc=0
+```
+
+임시 테스트는 측정 후 삭제했다.
```

**File**: `.moai/reports/t229/cause.md` (added, +150/-0)
```diff
@@ -0,0 +1,150 @@
+# t229 — audit_multi codex 필드-본문 불일치: 원인 확정
+
+| 항목 | 값 |
+|---|---|
+| 카드 | t229 (Class B — 재현됨, 원인 미확정 상태로 착수) |
+| 워크트리 | `.claude/worktrees/t229` · 브랜치 `WT-audit-verdict-converge` |
+| 측정 트리 | `294b4b6ab` (worktree base = `origin/main`) — 아래 모든 `file:line` 은 이 트리 기준 |
+| 측정 일자 | 2026-08-24 |
+| codex 버전 | `codex-cli 0.149.0` (`/Users/goos/.local/bin/codex`) |
+
+---
+
+## 결론 한 줄
+
+**필드-본문 모순이 아니다. 백엔드는 verdict 필드를 애초에 반환하지 않는다** — 그 필드는 MoAI 어댑터가 본문에서 정규식 하나로 **합성**한 값이고, 정규식이 안 맞으면 무조건 `pass`로 떨어진다. 관대한 방향으로만 틀린 이유가 이 기본값이다.
+
+카드가 제시한 세 후보 중:
+
+| 후보 | 판정 |
+|---|---|
+| (a) 백엔드 응답 자체의 필드-본문 모순 | **반증** — 응답에 verdict 필드가 없다 (F1) |
+| (b) 어댑터 추출 오류 | **확정 — 이것이 근본 원인** (F2·F3·F4·F5) |
+| (c) 수렴 엔진의 읽기 범위 | **사실이나 하류** — 엔진은 잘못 합성된 필드를 충실히 전달했을 뿐 (F7) |
+
+---
+
+## F1 — codex는 구조화된 verdict를 반환하지 않는다
+
+`ReviewOutput.Verdict`를 만드는 곳은 코드 전체에서 한 군데다.
+
+```
+internal/cli/mcp_codex.go:1144  func synthesizeReviewOutput(reviewText string) ReviewOutput
+```
+
+호출자는 `mcp_codex.go:705`의 `runTurn` 하나뿐이고(`codex_review_rpc_test.go:122`은 테스트), codex 응답에서 뽑아 쓰는 것은 **본문 텍스트뿐**이다(`bestCodexReviewText`, `mcp_codex.go:1074`). 함수 주석도 이를 명시한다 — *"codex does NOT return a structured verdict enum — it returns free-form prose"*.
+
+즉 필드와 본문은 서로 다른 두 출처가 아니라, **본문 하나에서 파생된 값과 그 원본**이다. 둘이 어긋난다는 것은 파생이 틀렸다는 뜻이다.
+
+## F2 — 합성 규칙은 정규식 1개 + 관대한 기본값
+
+```go
+// mcp_codex.go:1115
+var codexFindingBullet = regexp.MustCompile(`(?m)^\s*[-*]\s+\[[A-Za-z]+\d+\]`)
+
+// mcp_codex.go:1144
+func synthesizeReviewOutput(reviewText string) ReviewOutput {
+    verdict := "pass"
+    if codexFindingBullet.MatchString(reviewText) {
+        verdict = "fail"
+    }
+    ...
+}
+```
+
+- 판정 근거는 `- [P1]` 꼴 심각도 태그 불릿의 **존재 여부** 단 하나.
+- 안 맞으면 `pass`. **증거 부재가 통과 근거로 쓰인다** — 관측 없는 통과 주장의 코드판이다.
+- 주석(`mcp_codex.go:1111-1112`)은 이 정규식이 **codex-cli 0.146.1의 review-mode 출력**으로 검증됐다고 적는다. 설치본은 **0.149.0**.
+
+기존 테스트(`codex_review_rpc_test.go:114` `TestSynthesizeReviewOutput_FindingBulletsMapToFail`)가 다루는 입력은 `- [P1]` / `- [P2]` / 산문 1줄 / 빈 문자열 **4건뿐**이다. 다른 서식은 한 건도 없다.
+
+## F3 — 그런데 audit_multi는 review-mode를 절대 쓰지 않는다
+
+```go
+// mcp_convergence.go:409  performCodexAudit(ctx, target, focus, projectRoot string)
+params := map[string]any{ "target": target, "model": "",
+    "prompt": codexAdversarialReviewPrompt(focus) }
+...
+out, _ := codexReviewRPC(ctx, binaryPath, codexMethodTurnStart, params)
+```
+
+`audit_multi` 경로는 항상 **adversarial 모드**(`turn/start` + 자유형 프롬프트)다. 그리고 그 프롬프트(`mcp_codex.go:1163`)는 출력 **서식을 전혀 지정하지 않는다** — "Report concrete findings with severity, file/line, confidence, and a recommendation."
+
+**review-mode 불릿 관례로 눈금을 맞춘 정규식을, 서식이 자유로운 adversarial 산문에 적용하고 있다.** 이것이 불일치가 이 경로에서만 반복되는 이유다.
+
+## F4 — 라이브 재현 (2026-08-24, codex-cli 0.149.0)
+
+`mcp__moai__codex_audit(mode=adversarial, target=uncommittedChanges)` 1회 실행. 원문: `live-probe-body.txt`.
+
+| 관측 | 값 |
+|---|---|
+| 반환된 `verdict` 필드 | **`pass`** |
+| 본문 1행 | **`Verdict: inconclusive — ... so a pass would be unsupported.`** |
+| `codexFindingBullet` 매치 수 | **0** (`grep -cE '^[[:space:]]*[-*][[:space:]]+\[[A-Za-z]+[0-9]+\]'` → `0`, rc=1) |
+
+codex가 **명시적으로 통과를 거부**한 응답이 `pass`로 합성됐다. t197의 3회와 방향이 같다.
+
+## F5 — 본문에 verdict 단어가 있는데 어댑터가 버린다
+
+위 본문은 첫 줄에 `Verdict: inconclusive`를 적었다. 어댑터에는 이 문자열을 읽는 코드가 **없다**. 백엔드가 스스로 낸 판정을 무시하고 불릿 유무로 다시 추측하는 구조다.
+
+본문은 `Findings: []` / `merge_status:` 를 담은 yaml 블록도 함께 냈다 — codex는 구조를 낼 의사가 있었고, 어댑터가 그것을 읽지 않는다.
+
+## F6 — Findings는 항상 비어 있다 (교차 축, #1632)
+
+```go
+// mcp_codex.go:1155
+Findings:  []Finding{},
+```
+
+하드코딩된 빈 슬라이스다. 따라서 수렴 엔진은 "차단 N건"을 셀 수단조차 없다. **이 카드의 수정 대상이 아니라 #1632의 축**이며, 두 카드가 같은 seam을 만지므로 착수 순서 조율이 필요하다.
+
+## F7 — 수렴 엔진은 필드만 읽는다 (하류, 그러나 검출 지점)
+
+`converge()`(`mcp_convergence.go:135`)가 보는 것은 `PerBackendVerdict.Verdict` 뿐이다. `Summary`(= 본문 원문)는 결과에 실려 나가지만 **판정에 한 번도 쓰이지 않는다**.
+
+엔진은 자기 입력에 대해 정확하게 동작했다 — `codex.Verdict == "pass"` 였으니 `overall_verdict: pass`, 갈림 없으니 `disagreement_flag: false`. 버그는 여기가 아니다. 다만 **필드-본문 불일치를 잡아낼 장치가 파이프라인 어디에도 없다**는 사실은 여기서 확정된다.
+
+## F8 — 소급 스캔: 도달 범위가 좁다 (부재 주장 아님)
+
+스윕 스크립트: `retro-sweep.sh`, 결과: `retro-sweep.md`. 범위는 primary 체크아웃의 `.moai/reports/` + 전 워크트리의 `.moai/reports/` + 전 트리의 `.moai/state/audit-multi/*.json`.
+
+| 관측 | 값 |
+|---|---|
+| 영속된 `ConvergenceResult` 상태파일 | **0건** |
+| 백엔드별 판정표를 담은 리포트 (내용해시 중복 제거) | **9건, 전부 t197** |
+| 그중 `pass` 필드 + FAIL 본문 | **2건** (`verdict-iter3.md`, `verdict-init-2.md`) |
+| 산문으로만 증언된 추가 1건 | iter2 (`verdict-iter3.md:33`) — 별도 판정서 없음 |
+
+상태파일 0건의 뜻은 **이 저장소 이력에서 `audit_multi`가 `session_id`를 넘긴 적이 한 번도 없다**는 것이다(`mcp_convergence.go:573` — 빈 세션 id면 영속화가 no-op). 따라서 t197 레인이 손으로 표를 적어 두지 않았다면 이 불일치는 **아무 흔적도 남기지 않았다**. 소급 스캔이 "3회"에서 멈춘 것은 그 이상이 없어서가 아니라 **볼 수 있는 기록이 거기까지**이기 때문이다.
+
+## F9 — 범위 밖 관측 (카드 t246): 감사 대상 트리가 호출자의 트리와 다르다
+
+**최초 서술 정정.** 처음에는 "codex 백엔드가 워크트리를 무시한다 — `cwd`를 안 넘긴다"로 적었으나, 그 판단은 **stale 트리**(primary 체크아웃의 오래된 로컬 main)를 읽은 결과였다. 현재 main(`294b4b6ab`)에서는 `performCodexAudit`이 `projectRoot` 파라미터를 
```

**File**: `.moai/reports/t229/live-probe-body.txt` (added, +15/-0)
```diff
@@ -0,0 +1,15 @@
+Verdict: inconclusive — the requested new uncommitted Go file is absent, so a pass would be unsupported.
+
+```yaml
+findings: []
+merge_status: review scope not satisfied
+```
+
+Evidence:
+
+- No added or untracked `.go` files were reported by Git.
+- The only uncommitted Go changes are [renderer.go](<repo>/internal/statusline/renderer.go:544) and [renderer_test.go](<repo>/internal/statusline/renderer_test.go:1176).
+- Those edits showed no security or correctness defects: focused test passed, `go vet ./internal/statusline` passed, and `git diff --check` passed.
+- The full package test was blocked by sandbox denial of loopback port binding; this is an environment limitation, not a product finding.
+
+Recommendation: provide or restore the intended new Go file and rerun the review before merging. No merge blockers were found in the two actual Go edits.
```

**File**: `.moai/reports/t229/m1-boundary.md` (added, +166/-0)
```diff
@@ -0,0 +1,166 @@
+# t229 — 마감 시점 상태 (M1~M3 착지)
+
+> **[후속] 이 문서의 §남은 일 1·2번은 다음 세션에서 닫혔다.** 전 패키지 스위트 초록(`ok 510.756s`)과 M4 검증·DoD 뮤테이션 검사는 `m4-close.md` 에 있다. 아래 표는 그 시점의 기록으로 읽을 것.
+
+> **[정정] 이 문서의 제목과 아래 §M1 절은 M1 경계에서 작성됐고, 그 시점 서술은 이미 낡았다.** 마감 지시가 도착한 뒤에도 구현 에이전트에게 halt 가 제때 닿지 않아 **M2·M3 가 이어서 착지했다.** 최종 상태는 이 절이 기준이며, 아래 M1 서술은 **그 시점의 기록으로만** 읽을 것.
+
+## 최종 상태 (세션 종료 시점)
+
+| 항목 | 값 |
+|---|---|
+| head | `a84b25917` · push 완료 (`0 0`) |
+| 트리 | 클린 |
+| 착지 마일스톤 | **M1 · M2 · M3** |
+| 미착수 | **M4** (회귀 고정) |
+
+| 커밋 | 내용 |
+|---|---|
+| `55b2ca3e1` | **M1** — 모드 seam + 집합 최댓값 채택 구조 |
+| `d68b6ea7c` | **M2** — 점수 표기 인식기 (`codexScoredVerdict`) |
+| `a84b25917` | **M3** — 신호 불일치 기록 (`SynthesisNote` + `converge` 반영) |
+
+### [HARD] K3·K7 이 M2 에서 뒤집혔다 — 이 카드의 핵심 주장이 관측됐다
+
+착수 전과 M1 경계에서 붉었던 두 행이 M2 착지 후 초록이다. 예측한 메커니즘 그대로다:
+
+| 행 | 신호 집합 (M2 후) | 채택값 |
+|---|---|---|
+| K3 `Verdict: pass` + `FAIL 0.20 / 1.00` | {pass, fail} | **`fail`** |
+| K7 `INCONCLUSIVE 0.50 / 1.00` + `Verdict: pass` | {inconclusive, pass} | **`inconclusive`** |
+
+근거 — 커밋된 테스트가 두 행을 이름으로 담고 있다: `codex_verdict_scored_test.go:55` "K3 stated pass then scored fail", `:59` "K7 scored inconclusive then stated pass". 실행:
+
+```
+--- PASS: TestSynthesizeReviewOutput_ScoredVerdictIsRead
+--- PASS: TestSynthesizeReviewOutput_ScoredVerdictDoesNotMatchProse
+--- PASS: TestSynthesizeReviewOutput_AdoptsMostConservativeSignal
+--- PASS: TestSynthesizeReviewOutput_SignalOrderDoesNotMatter
+ok  internal/cli  1.372s
+```
+
+`SignalOrderDoesNotMatter` 통과는 **순서 무관 집합 연산**이 기계적으로 확인됐다는 뜻이고, `ScoredVerdictDoesNotMatchProse` 통과는 **좁은 계약이 실제로 산문을 걸러낸다**는 뜻이다("PASS/FAIL 은 평범한 영어 단어"라는 판단이 관측으로 섰다).
+
+### 마감 시점 검증 — 관측한 것만
+
+| 검증 | 결과 |
+|---|---|
+| `go vet ./internal/cli/` (at `a84b25917`) | **rc=0** |
+| M1~M3 대상 테스트 (`Divergence\|Synthesis\|ScoredVerdict\|MostConservative\|SignalOrder\|NativeClean\|ModeSplits\|UnknownMethod\|Converge\|PerBackend`) | **ok 1.331s** |
+| **전 패키지 스위트** | **미검증** — 아래 §스위트 절 참조 |
+
+[HARD] **전 패키지 스위트는 `a84b25917` 에 대해 한 번도 돌지 않았다.** 유일하게 완주한 run 은 M1 이전 트리에 대한 것이고 FAIL 이었다(아래). 다음 세션의 첫 작업은 이것이다.
+
+미측정(마감으로 생략): 커버리지 · `golangci-lint` · `GOOS=windows go vet`.
+
+### 남은 일
+
+| # | 항목 |
+|---|---|
+| 1 | **전 패키지 스위트 재실행** — 래퍼 종료코드가 아니라 출력 본문의 `ok`/`FAIL` 행 판독 |
+| 2 | **M4** — 회귀 고정 (기존 테스트 native 명시 호출 확장, 라이브 프로브 픽스처, `codex_task` 출력 불변) |
+| 3 | sync-audit → 리드 판정 |
+| 4 | 착지 후 리드에게 t234 (= #1632) 착수 가능 신호 |
+
+---
+
+## (이하: M1 경계 시점의 기록)
+
+운영자 마감 지시로 **M1 까지만** 착지시키고 세션을 종료한다는 전제로 작성됐다. 그 전제는 위 정정대로 유지되지 않았다.
+
+| 항목 | 값 |
+|---|---|
+| 브랜치 | `WT-audit-verdict-converge` |
+| 측정 트리 | M1 커밋 직전 스테이지 상태 (base `a7d1001ee`) |
+| 측정 일자 | 2026-08-25 |
+
+## M1 이 실제로 한 일 (실측)
+
+`synthesizeReviewOutput(reviewText, method string)` 로 시그니처를 바꾸고, 판정 로직을 **신호 수집 + 집합 최댓값 채택** 구조로 재작성했다.
+
+| 새 심볼 | 역할 |
+|---|---|
+| `codexVerdictSignal` | 신호 하나(출처 이름 + verdict). 출처 이름은 불일치를 운영자 언어로 설명하기 위해 있다 |
+| `codexVerdictSignalsOf` | 본문이 담은 **모든** 신호를 모은다. 결정하지 않는다 — 넷째 신호는 여기에만 추가된다 |
+| `codexVerdictRank` | `fail`(3) > `inconclusive`(2) > `pass`(1), 미상(0) |
+| `adoptConservativeVerdict` | **P-CONS** — 집합의 최댓값 채택. 순서 의미론 없음 |
+| `codexUnrecognizedVerdict` | 신호 집합이 **비었을 때**의 모드 기본값. native → `pass`, 그 외 → `inconclusive` |
+
+[HARD] 구현이 리드 지침 2를 지켰다: **집합 연산**이며 순서 있는 대입이 아니다. `adoptConservativeVerdict` 주석이 그 이유를 코드에 남겨 두었다 — 순서 규칙으로 쓰면 넷째 신호에서 같은 구멍이 한 겹 옆으로 옮겨 간다는 것. 리드가 SPEC 에 남기라 한 조건부성이 코드 주석으로도 한 번 더 남았다(지침 3 충족).
+
+`codexUnrecognizedVerdict` 주석에 **"인식기를 추가하는 일이 이 함수를 건드리게 만들면 안 된다"** 가 명시돼 있다 — 이 결함의 구조적 원인(판정이 한 CLI 버전 서식에 묶임)이 재발하는 경로를 코드에서 막았다.
+
+## 실측 — 모드 분기가 실제로 배선됐다
+
+```
+T229-M1 | C1 adversarial=inconclusive native=pass
+T229-M1 | C5 adversarial=inconclusive native=pass
+```
+
+**같은 본문이 모드에 따라 갈린다.** 착수 전 베이스라인에서 C1·C5 는 둘 다 `pass` 였다(8/8 RED). AC-CVS-001(미인식 서식은 adversarial 에서 `pass` 아님)과 AC-CVS-003(native 무불릿 정상 리뷰는 `pass` 보존)이 동시에 성립한다.
+
+## [HARD] K3·K7 은 여전히 붉다 — 회귀가 아니라 설계대로다
+
+```
+T229-M1 | K1 adopted=fail         want=fail         GREEN
+T229-M1 | K2 adopted=fail         want=fail         GREEN
+T229-M1 | K3 adopted=pass         want=fail         RED
+T229-M1 | K4 adopted=inconclusive want=inconclusive GREEN
+T229-M1 | K5 adopted=fail         want=fail         GREEN
+T229-M1 | K6 adopted=fail         want=fail         GREEN
+T229-M1 | K7 adopted=pass         want=inconclusive RED
+T229-M1 | K8 adopted=pass         want=pass         GREEN
+```
+
+착수 전 베이스라인과 **동일**하다(K3·K7 RED, 나머지 6행 GREEN). M1 은 이 두 행을 건드리지 않으며, 그것이 옳다:
+
+- K3 = `Verdict: pass` + `FAIL 0.20 / 1.00` · K7 = `INCONCLUSIVE 0.50 / 1.00` + `Verdict: pass`
+- 두 본문 모두 **`stated` 신호가 매치**되므로 신호 집합이 비지 않는다 → `codexUnrecognizedVerdict`(M1 이 고친 fall-through)를 **아예 타지 않는다**
+- 붉은 이유는 점수 표기(`FAIL 0.20` / `INCONCLUSIVE 0.50`)가 **아직 신호로 인식되지 않아** 집합에 들어오지 못하고, 집합에 하나뿐인 `stated: pass` 가 최댓값이 되기 때문이다
+
+[HARD] **이 두 행을 초록으로 뒤집는 것은 M2** — `codexScoredVerdict` 를 `codexVerdictSignalsOf` 에 추가해 점수 표기가 집합에 들어오는 순간, K3 의 집합은 {pass, fail} 이 되어 `fail` 이, K7 의 집합은 {
```

**File**: `.moai/reports/t229/m2-red-tests-draft.go.txt` (added, +92/-0)
```diff
@@ -0,0 +1,92 @@
+package cli
+
+import "testing"
+
+// TestSynthesizeReviewOutput_ScoredVerdictIsRead is AC-CVS-002.
+//
+// codex states a verdict in a score form too — "FAIL 0.75 / 1.00" at the head of
+// a line. Reading it is REQ-CVS-002; the reason it is a narrow recognizer rather
+// than a widening of the existing label regex is plan.md §C.3: PASS and FAIL are
+// ordinary prose words, and a loose recognizer would read a sentence about a
+// test suite as a verdict about the change.
+func TestSynthesizeReviewOutput_ScoredVerdictIsRead(t *testing.T) {
+	cases := []struct {
+		name, body, want string
+	}{
+		{"C8 scored fail", codexFormatCorpus[7].body, "fail"},
+		{"scored pass", "PASS 0.88 / 1.00\n\nNothing to block on.", "pass"},
+		{"scored inconclusive", "INCONCLUSIVE 0.50 / 1.00\n\nCould not reach the diff.", VerdictInconclusive},
+		{"emphasised scored fail", "**FAIL 0.20 / 1.00**\n\nreasons follow", "fail"},
+	}
+	for _, c := range cases {
+		if got := synthesizeReviewOutput(c.body, codexMethodTurnStart).Verdict; got != c.want {
+			t.Errorf("%s: Verdict = %q, want %q\nbody:\n%s", c.name, got, c.want, c.body)
+		}
+	}
+}
+
+// TestSynthesizeReviewOutput_ScoredVerdictDoesNotMatchProse is the other half of
+// AC-CVS-002. A recognizer that reads this sentence as a verdict has widened the
+// hole rather than closed it: the corpus rule then makes this body a pass, which
+// is exactly what §0 forbids for a body carrying no verdict at all.
+func TestSynthesizeReviewOutput_ScoredVerdictDoesNotMatchProse(t *testing.T) {
+	const prose = "the suite reported PASS 12 times before the regression"
+
+	if got := synthesizeReviewOutput(prose, codexMethodTurnStart).Verdict; got == "pass" {
+		t.Errorf("prose mentioning PASS was read as a verdict: Verdict = %q\nbody: %s", got, prose)
+	}
+}
+
+// codexSignalCorpus is the AC-CVS-006 witness set (acceptance.md §B-2, initial
+// 8 rows). Each row is (body, the signal SET that body produces, the expected
+// adopted verdict), and the expectation is ALWAYS the most conservative member
+// of that set — P-CONS, spec.md §A.5. No row carries a hand-made exception.
+//
+// [HARD] K3 and K7 are RED before M2 lands (baseline-rebased.md: both synthesize
+// "pass"). Their expectations are derived from P-CONS, NOT from observed
+// behavior, and must never be lowered to match what the tree currently does.
+// Lowering them would silently delete the two rows' detecting power, which is
+// the failure this whole card is about.
+var codexSignalCorpus = []struct {
+	name, body, want string
+}{
+	{"K1 stated fail then scored pass", "Verdict: fail — merge blocked.\n\nPASS 0.95 / 1.00", "fail"},
+	{"K2 scored pass then stated fail", "PASS 0.95 / 1.00\n\nVerdict: fail — merge blocked.", "fail"},
+	{"K3 stated pass then scored fail", "Verdict: pass — nothing to block on.\n\nFAIL 0.20 / 1.00", "fail"},
+	{"K4 stated inconclusive then scored pass", "Verdict: inconclusive — could not reach the diff.\n\nPASS 0.95 / 1.00", VerdictInconclusive},
+	{"K5 scored pass plus finding bullet", "PASS 0.95 / 1.00\n\n- [P1] path traversal at fs.go:44", "fail"},
+	{"K6 three signals", "Verdict: pass — nothing to block on.\n\nINCONCLUSIVE 0.50 / 1.00\n\n- [P2] weak hash at auth.go:88", "fail"},
+	{"K7 scored inconclusive then stated pass", "INCONCLUSIVE 0.50 / 1.00\n\nVerdict: pass — nothing to block on.", VerdictInconclusive},
+	{"K8 signals agree", "Verdict: pass — nothing to block on.\n\nPASS 0.99 / 1.00", "pass"},
+}
+
+// TestSynthesizeReviewOutput_AdoptsMostConservativeSignal is AC-CVS-006.
+//
+// ONE assertion over the whole corpus. Adding a row — or adding a fourth signal
+// — must never require editing it: P-CONS is stated over the signal SET, and a
+// set has no order, so the rule does not change as signals accumulate. An
+// assertion phrased as "a later signal does not overwrite an earlier one" would
+// be an ordering rule, true only while there are three signals.
+//
+// This AC asserts the ADOPTED VALUE only. It requires nothing of the internal
+// shape — rank table, assignment chain, or branch — so an implementation is free
+// to satisfy P-CONS however it likes.
+func TestSynthesizeReviewOutput_AdoptsMostConservativeSignal(t *testing.T) {
+	for _, c := range codexSignalCorpus {
+		if got := synthesizeReviewOutput(c.body, codexMethodTurnStart).Verdict; got != c.want {
+			t.Errorf("%s: adopted Verdict = %q, want %q (the most conservative member of the signal set)\nbody:\n%s", c.name, got, c.want, c.body)
+		}
+	}
+}
+
+// TestSynthesizeReviewOutput_SignalOrderDoesNotMatter is the order-independence
+// witness called out in acceptance.md §B-2: K1 and K2 carry the SAME signal set
+// in opposite textual order, so they must adopt the same verdict. An
+// implementation that layers assignments splits here.
+func TestSynthesizeReviewOutput_SignalOrderDoesNotMatter(t *testing.T) {
+	k1 := synthesizeReviewOutput(codexSignalCorpus[0].body, codexMethodTurnStart).Verdict
+	k2 := synthesiz
```

**File**: `.moai/reports/t229/m4-close.md` (added, +125/-0)
```diff
@@ -0,0 +1,125 @@
+# t229 M4 — 회귀 고정 마감 기록
+
+> 카드 t229 · SPEC-CODEX-VERDICT-SYNTH-001 · 브랜치 `WT-audit-verdict-converge`
+> 측정 트리: `1e1edf6b4` (클린) · 측정 일자 2026-08-25
+
+## 1. 이 세션이 실제로 한 일
+
+M4 의 테스트 3건은 직전 세션 마지막 커밋 `1e1edf6b4` 에 **이미 함께 착지해 있었다**(파일 `internal/cli/codex_verdict_regression_test.go`, 커밋 제목은 docs 였다). 따라서 이 세션의 M4 작업은 코드 추가가 아니라 **검증과 기록**이다 — 착지한 것이 실제로 도는지, DoD 가 요구한 검사 중 남은 것이 무엇인지.
+
+남아 있던 것은 둘이었다:
+
+1. **전 패키지 스위트** — `a84b25917` 이후 한 번도 완주하지 않았다(`m1-boundary.md` §남은 일 1번).
+2. **DoD 211 의 뮤테이션 독립성 검사** — "mutant (e) 가 AC-CVS-006 에서만 실패하고 AC-CVS-001~005 는 전부 통과함을 확인". 감사 iter2 가 검증 불가 항목을 이것으로 교체했으므로, 확인하지 않으면 DoD 가 닫히지 않는다.
+
+둘 다 이 세션에서 실행했다.
+
+## 2. 전 패키지 스위트 — 초록
+
+```
+$ go test ./internal/cli/ -count=1 -timeout 1200s
+ok  	github.com/modu-ai/moai-adk/internal/cli	510.756s
+```
+
+판정은 **출력 본문의 `ok` 행**으로 했다. 래퍼 종료코드는 근거로 쓰지 않았다(`m1-boundary.md` 가 지목한 실패 형태 — 백그라운드 래퍼의 exit 0 이 패키지 FAIL 을 가린 사고). 실측 510.756초는 `CLAUDE.local.md` §6 의 `internal/cli` 타임아웃 하한 600s 근거와 같은 크기대다.
+
+증거 파일: `.moai/state/verify/t229-m4/pkg-cli.log`
+
+## 3. 정적 검사 — 양 플랫폼 초록
+
+| 명령 | 결과 |
+|---|---|
+| `go vet ./internal/cli/...` | rc=0, 출력 없음 |
+| `GOOS=windows go vet ./internal/cli/...` | rc=0, 출력 없음 |
+
+`m1-boundary.md` 가 미측정으로 남겼던 `GOOS=windows go vet` 이 여기서 닫힌다. 다만 [HARD] **vet 초록은 컴파일만 증명한다** — Windows 동작의 근거가 아니며, 그 판정은 CI 매트릭스 몫이다.
+
+증거 파일: `.moai/state/verify/t229-m4/vet-darwin.log` · `vet-windows.log`
+
+## 4. DoD 211 — mutant (e) 독립성, 실측으로 확인
+
+### 심은 것
+
+`adoptConservativeVerdict` 의 집합 최댓값 채택을 **대입 열 의미론**으로 바꿨다. 이것이 acceptance.md §B-2 가 mutant (e) 로 지목한 형태 — "M2 를 가장 자연스러운 방식으로 쓴 구현" — 이다.
+
+```go
+	adopted := ""
+	for _, s := range signals {
+		adopted = s.verdict          // ← 최댓값 비교를 제거: 나중 신호가 앞선 것을 덮는다
+	}
+	return adopted
+```
+
+### 관측
+
+```
+--- PASS: TestSynthesizeReviewOutput_AdversarialVerdictLine
+--- PASS: TestSynthesizeReviewOutput_VerdictLineDirections
+--- PASS: TestSynthesizeReviewOutput_FindingBulletsMapToFail
+--- PASS: TestSynthesizeReviewOutput_RecordsSignalDivergence
+--- PASS: TestSynthesizeReviewOutput_NoNoteWhenSignalsAgree
+--- PASS: TestConverge_SurfacesSignalDivergence_WithoutBlocking
+--- PASS: TestRunMultiAudit_ForwardsSynthesisNoteToPerBackendVerdict
+--- PASS: TestSynthesizeReviewOutput_AdversarialNeverPassesUnknownFormat
+--- PASS: TestSynthesizeReviewOutput_UnknownMethodIsConservative
+--- PASS: TestSynthesizeReviewOutput_NativeCleanReviewStaysPass
+--- PASS: TestSynthesizeReviewOutput_ModeSplitsTheSameBody
+--- PASS: TestSynthesizeReviewOutput_LiveProbeBodyStaysInconclusive
+--- PASS: TestCodexTask_OutputTextUnchangedByVerdictSynthesis
+--- PASS: TestSynthesizeReviewOutput_ScoredVerdictIsRead
+--- PASS: TestSynthesizeReviewOutput_ScoredVerdictDoesNotMatchProse
+--- FAIL: TestSynthesizeReviewOutput_AdoptsMostConservativeSignal
+--- PASS: TestSynthesizeReviewOutput_SignalOrderDoesNotMatter
+FAIL	github.com/modu-ai/moai-adk/internal/cli	1.179s
+```
+
+갈라진 행:
+
+```
+K1 stated fail then scored pass:      adopted "pass", want "fail"
+K2 scored pass then stated fail:      adopted "pass", want "fail"
+K4 stated inconclusive then scored pass: adopted "pass", want "inconclusive"
+```
+
+### 이 관측이 말하는 것
+
+- **AC-CVS-006 만 죽는다.** AC-CVS-001~005 를 담당하는 테스트 15건이 전부 초록인 채 mutant 가 통과한다. 즉 AC-006 이 없었다면 이 구현이 **초록 신호를 달고 착지**했을 것이고, 이 SPEC 이 없애려던 §0 위반을 이 SPEC 이 새로 만들어 냈을 것이다. D1 이 경고한 그대로다.
+- **`SignalOrderDoesNotMatter` 는 mutant (e) 를 잡지 못한다.** K1·K2 는 텍스트 순서만 다르고 신호 **수집** 순서는 둘 다 `stated → scored` 로 같으므로, 대입 열 의미론 아래에서도 두 행은 **같은 값**(`pass`)을 낸다. 이 테스트가 겨냥한 것은 mutant (f)(텍스트 등장 순서 의존)이며 (e) 가 아니다 — 두 증인이 서로 다른 변종을 담당한다는 사실이 여기서 관측됐다.
+- 세 행이 갈린 이유는 모두 하나다: 관대한 신호(`scored: pass`)가 **수집 순서상 뒤에 오기 때문에** 앞선 보수적 신호를 덮는다.
+
+### 원복
+
+```
+$ git checkout -- internal/cli/mcp_codex.go
+$ shasum -a 256 -c .moai/state/verify/t229-m4/mcp_codex.sha256
+internal/cli/mcp_codex.go: OK
+```
+
+심기 전 해시 `0750534e…` 와 원복 후 해시가 일치한다. 뮤테이션은 트리에 남지 않았다.
+
+증거 파일: `.moai/state/verify/t229-m4/mutant-e.log`
+
+## 5. AC 별 충족 상태
+
+| AC | 증인 | 상태 |
+|---|---|---|
+| AC-CVS-001 미인식 서식은 통과 아님 | `AdversarialNeverPassesUnknownFormat` · `UnknownMethodIsConservative` (C1~C8 corpus 순회) | PASS |
+| AC-CVS-002 점수 표기 인식 | `ScoredVerdictIsRead` · `ScoredVerdictDoesNotMatchProse` | PASS |
+| AC-CVS-003 native 무불릿 보존 | `NativeCleanReviewStaysPass` · `ModeSplitsTheSameBody` | PASS |
+| AC-CVS-004 불일치 채택 + 기록 + 전달 | `RecordsSignalDivergence` · `NoNoteWhenSignalsAgree` · `Converge_SurfacesSignalDivergence_WithoutBlocking` · `RunMultiAudit_ForwardsSynthesisNoteToPerBackendVerdict` | PASS |
+| AC-CVS-005 회귀 방어 (M4) | `FindingBulletsMapToFail`(native 명시) · `LiveProbeBodyStaysInconclusive` · `CodexTask_OutputTextUnchangedByVerdictSynthesis` | PASS |
+| AC-CVS-006 P-CONS 집합 최댓값 | `AdoptsMostConservativeSignal`(K1~K8 단일 단언) · `SignalOrderDoesNotMatter` | PASS |
+
+## 6. 관측하지 않은 것 (Gaps)
+
+- **커버리지 수치** — `-cover` 를 돌리지 않았다. 이 세션은 스위트 1회로 510초를 썼고, 커버리지 재실행은 그만큼을 다시 지출한다. 필요하면 sync-audit 이 요구할 때 측정한다.
+- **`
```

**File**: `.moai/reports/t229/plan-audit-iter1.md` (added, +279/-0)
```diff
@@ -0,0 +1,279 @@
+# SPEC Review Report: SPEC-CODEX-VERDICT-SYNTH-001
+
+Iteration: 1/1 (Tier S ceiling)
+Verdict: **PASS-WITH-DEBT**
+Overall Score: **0.7625** (Tier S threshold 0.75)
+
+Reasoning context ignored per M1 Context Isolation. Judgment rests on the four SPEC
+artifacts, the evidence base named in the dispatch, and my own measurements against
+this worktree.
+
+| Item | Value |
+|---|---|
+| Measurement tree | `/Users/goos/MoAI/moai-adk-go/.claude/worktrees/t229` @ `910f3ffed` (base `294b4b6ab` = `origin/main`) |
+| Every `file:line` below | re-verified in THIS tree, not the primary checkout |
+| Live codex probe | NOT run (dispatch constraint) |
+| Package tests | NOT run — no finding below depends on a test run |
+
+---
+
+## Must-Pass Results
+
+- **[PASS] MP-1 REQ number consistency** — `REQ-CVS-001` … `REQ-CVS-004` at `spec.md:104/108/112/116`. Sequential, no gap, no duplicate, uniform 3-digit padding.
+- **[PASS] MP-2 GEARS format compliance** — judged against the **requirement layer** (`REQ-CVS-*` in `spec.md`), not the ACs. REQ-001 state-driven (`While … the system shall …`), REQ-002 ubiquitous, REQ-003 `Where …` , REQ-004 ubiquitous + `shall not` (GEARS canonical negative). No informal language, no Given/When/Then presented as a REQ. See D5/D6 for two pattern-precision findings that are **not** MP-2 failures.
+- **[PASS] MP-3 YAML frontmatter validity** — `spec.md:1-15` carries all 12 canonical fields (`id`,`title`,`version` quoted,`status`,`created`,`updated`,`author`,`priority`,`phase`,`module`,`lifecycle`,`tags`) plus `tier: S`. No rejected snake_case alias (`created_at`/`updated_at`/`labels`/`spec_id`) present. `plan.md` and `acceptance.md` mirror the same 13 keys.
+- **[N/A] MP-4 language neutrality** — single-language SPEC (Go, `internal/cli` of this tool itself). Auto-pass.
+- **[PASS] MP-5 D7 cross-SPEC reconciliation** — the only external reference is `SPEC-AUDIT-MULTI-MODEL-001`; measured `status: completed`, which is not in {retired, superseded, archived}. No BLOCKING finding.
+- **[PASS] MP-6 D8 cross-platform discipline** — `grep -c syscall` returns 0 across `spec.md`, `plan.md`, `acceptance.md`. Auto-pass.
+- **[PASS] MP-7 clarification gate** — `grep -rn '\[NEEDS CLARIFICATION' .moai/specs/SPEC-CODEX-VERDICT-SYNTH-001/` exits 1 (no match). `research.md` absent, as expected at Tier S.
+
+---
+
+## Category Scores
+
+| Dimension | Score | Rubric Band | Evidence |
+|-----------|-------|-------------|----------|
+| Clarity | 0.75 | 0.75 | Strong: `spec.md:27-33` governing principle, `spec.md:122-128` AC-shape constraint, `plan.md:61` records a rejected alternative. Deducted for D2 (a [HARD] premise at `spec.md:94` that measures false) and D6/D7 ambiguities. |
+| Completeness | 0.75 | 0.75 | All sections present incl. 5 `### Out of Scope — <topic>` H3s with bullets (`spec.md:144-164`). Deducted for D1's uncovered case, D4's unresolved open item, and no landing step in `plan.md`. |
+| Testability | 0.80 | 0.75-1.0 | All 5 ACs are binary-testable Go assertions; each names the mutant it kills. AC-CVS-001 verified genuinely property-shaped. Deducted for D3 (understated RED set). |
+| Traceability | 0.75 | 0.75 | No orphan AC, no uncovered REQ. Exactly one indirect/partial mapping: REQ-CVS-003 is worded over *any* two diverging signals, AC-CVS-004 witnesses only the stated×bullet pair (D1). |
+
+Aggregate = mean(0.75, 0.75, 0.80, 0.75) = **0.7625** ≥ 0.75.
+
+---
+
+## Adversarial hunt — the six items the dispatch named
+
+### 1. Is AC-CVS-001 actually property-shaped? — **YES, verified**
+
+The assertion is `Verdict != "pass"` applied by iterating the corpus (`acceptance.md:59-63`).
+Adding a member of the unrecognized class requires no assertion edit, which is the SPEC's own
+discriminator (`acceptance.md:34`). It is deliberately a **negative** property, not `== inconclusive`
+— correct, since a positive equality would break on a member that legitimately synthesizes `fail`.
+
+**Independence from AC-CVS-002 — verified, they kill different mutants.** Against the named
+mutant (a) (one score regex added, `verdict := "pass"` fall-through kept):
+
+| Corpus member | Mutant (a) result | AC-CVS-001 | AC-CVS-002 |
+|---|---|---|---|
+| C1 blocking-table | `pass` (no signal matches) | **FAILS** | not exercised |
+| C8 scored `FAIL 0.75` | `fail` (score regex reads it) | passes | **passes** |
+
+So AC-CVS-002 alone lets mutant (a) through and AC-CVS-001 alone kills it. The coverage claim
+at `acceptance.md:65` is true. The reciprocal constraint also holds: a "return `inconclusive` for
+everything" mutant satisfies AC-CVS-001 and dies on AC-CVS-002's `fail` assertion; a "return `fail`
+for everything in adversarial" mutant satisfies both and dies on AC-CVS-005's live-probe clause
+(`inconclusive` required). The AC set is mutually constraining as claimed.
+
+### 2. Does any AC observe nothing? — measured, see the RED/pin split below
+
+I replicated `codexFindingBullet` (`internal/cli/mcp_co
```

**File**: `.moai/reports/t229/plan-audit-iter2.md` (added, +289/-0)
```diff
@@ -0,0 +1,289 @@
+# SPEC Review Report: SPEC-CODEX-VERDICT-SYNTH-001 — iter2 (narrow re-audit)
+
+Iteration: 2 (lead-directed delta re-audit)
+Verdict: **PASS-WITH-DEBT**
+Overall Score: **0.8025** — moved **monotonically up** from iter1's 0.7625 (+0.0400). No STOP escalation.
+
+Reasoning context ignored per M1 Context Isolation.
+
+| Item | Value |
+|---|---|
+| Measurement tree | `/Users/goos/MoAI/moai-adk-go/.claude/worktrees/t229` @ `9cb18cf4b`, branch `WT-audit-verdict-converge` |
+| Delta audited | `910f3ffed..9cb18cf4b` — 4 files, +125/−26, SPEC artifacts only (no source changed) |
+| Scope | D1 / D2 / D3 / D9 disposition + new-defect sweep on the delta. Items iter1 cleared were NOT re-derived. |
+| Live codex probe | NOT run |
+| `internal/cli` tests | NOT run — no finding depends on a test run |
+
+**Process note (not a defect):** the Tier S plan-audit ceiling is 1 iteration
+(`harness.plan_audit_tier_ceilings`). This iteration is a lead-directed narrow re-audit of an
+enumerated defect delta, not an auditor-initiated retry. It does not change the verdict authority.
+
+---
+
+## Must-Pass Results (re-verified at v0.4.0)
+
+- **[PASS] MP-1** — `REQ-CVS-001` … `-004` at `spec.md:119/123/127/131`. Count 4, sequential, no gap or duplicate. REQ bodies unchanged by the delta.
+- **[PASS] MP-2** — requirement-layer GEARS unchanged by the delta; iter1's judgment stands. P-CONS was deliberately placed as a §A.5 **property** and an AC criterion rather than a new REQ, so no new requirement text entered the layer.
+- **[PASS] MP-3** — 12 canonical fields present; `version: "0.4.0"`, `updated: 2026-08-25` (valid ISO). No rejected snake_case alias.
+- **[N/A] MP-4** — single-language SPEC.
+- **[PASS] MP-5 D7** — external references still limited to `SPEC-AUDIT-MULTI-MODEL-001` (`status: completed`). No BLOCKING.
+- **[PASS] MP-6 D8** — `syscall` count 0 across all three artifacts.
+- **[PASS] MP-7** — `grep -rn '\[NEEDS CLARIFICATION'` exits 1.
+
+**Budget** — REQ **4/8**, AC **6/8**. Both inside the Tier S ceilings, applied independently.
+
+---
+
+## Category Scores
+
+| Dimension | iter1 | iter2 | Movement |
+|-----------|-------|-------|----------|
+| Clarity | 0.75 | **0.78** | D2's false [HARD] premise removed and P-CONS stated crisply with an explicit anti-formulation warning; offset by two NEW false claims (N1, N2) and a duplicated paragraph (N3). Net small gain. |
+| Completeness | 0.75 | **0.85** | D1's uncovered case now covered by AC-CVS-006; D4's open item closed by measurement; M2 gained an explicit entry gate. Landing route still unstated (iter1 D8, optional, unrepaired). |
+| Testability | 0.80 | **0.83** | AC-CVS-006 measurably kills 6 of the 9 non-correct implementation variants I built; AC-CVS-001's RED expectation corrected. Offset by N1 (a false kill claim), N2 (a false RED claim), and one redundant row (K5). |
+| Traceability | 0.75 | **0.75** | Unchanged. REQ-CVS-003 still maps to AC-CVS-004 alone; AC-CVS-006 traces to a §A.5 property rather than a REQ (N7), and the AC-004 ↔ AC-006 relationship is unstated (N4). |
+
+Aggregate = mean(0.78, 0.85, 0.83, 0.75) = **0.8025** ≥ 0.75 (Tier S threshold).
+
+---
+
+## Method — how the discrimination claims were measured
+
+Reasoning about which mutant a witness row kills is exactly the kind of claim that fails silently,
+so I measured it. I replicated `codexFindingBullet` (`internal/cli/mcp_codex.go:1115`) and
+`codexStatedVerdict` (`:1130`) **verbatim**, added a `codexScoredVerdict` built to `plan.md` §C.3's
+narrow contract (line head + uppercase verdict word + space + a 0..1 decimal), then wrote **eleven
+implementation variants** — the current two-signal shape, each named mutant (e / f / g and their
+plausible sub-shapes), two mis-ranking mutants, and a correct set-max P-CONS implementation — and
+ran all eight §B-2 rows through every one.
+
+```
+impl \ row                        K1   K2   K3   K4   K5   K6   K7   K8   | killed by
+V0  current tree (2 signals)      ok   ok   X    ok   ok   ok   X    ok   | K3,K7
+Ve  mutant(e) naive assign        X    X    ok   X    ok   ok   ok   ok   | K1,K2,K4
+Ve2 naive, reversed order         ok   ok   X    ok   ok   ok   X    ok   | K3,K7
+Vf1 mutant(f) first-in-text       ok   X    X    ok   ok   ok   ok   ok   | K2,K3
+Vf2 mutant(f) last-in-text        X    ok   ok   X    ok   ok   X    ok   | K1,K4,K7
+Vg1 mutant(g) pair, bullet-last   ok   ok   ok   ok   ok   ok   ok   ok   | SURVIVES ALL
+Vg2 mutant(g) pair, early-return  ok   ok   ok   ok   ok   X    ok   ok   | K6
+Vh  bullet-needs-stated           X    X    ok   X    X    ok   ok   ok   | K1,K2,K4,K5
+Vrk wrong rank (pass>inconcl)     ok   ok   ok   X    ok   ok   X    ok   | K4,K7
+Val always-fail                   ok   ok   ok   X    ok   ok   X    X    | K4,K7,K8
+Vok correct P-CONS                ok   ok   ok   ok   ok   ok   ok   ok   | SURVIVES ALL
+```
+
+```
+-- per-row values --
+K1  want=fail          V0=fail          Ve=pass        
```

---

### Incident Patch 5: `5fd63ebc` (2026-08-25)
**Commit Message**: fix(todo): refuse a mistyped verb that addresses a card id (t203) (#1614)

`moai todo pick t151` created a card named "pick t151" instead of erroring:
the t69 fallthrough treats any two-or-more-word invocation as natural
language, and a mistyped dispatch verb is exactly that shape. The lead hit
it in operation, which is how #1597 was filed.

The fallthrough itself is kept — it is what makes `moai todo fix the flaky
gate` work, and t69 accepted mistyped-verb-plus-words as its price. What
changes is the one shape where that price is highest: a verb-shaped first
token followed by a card id is a mistyped verb, not a card, so it errors
and names the registered verbs plus the `moai todo add "<text>"` escape
hatch.

The discriminator is deliberately narrow. Cobra routes registered verbs to
their subcommands, so anything reaching the parent is already an
unregistered word; the id must be the explicit `t<decimal>` form in second
position, never the looser reference the verbs accept — `fix 3 flaky tests`
and `fix the drift found in t151` both still add. The verb list in the
message is derived from the command tree rather than copied, so it cannot
drift as verbs are added (13 are registered t

**File**: `docs-site/content/en/utility-commands/moai-todo.md` (modified, +1/-1)
```diff
@@ -181,7 +181,7 @@ $ moai todo unrelate 2
 | Command | Behavior |
 |------|------|
 | `moai todo` (bare) | Prints the queue. Same output as `list`. |
-| `moai todo <two or more words>` | Adds the natural-language text as an item. A single word (including a typo'd verb) is an error, not an add. |
+| `moai todo <two or more words>` | Adds the natural-language text as an item. A single word (including a typo'd verb) is an error, not an add. A verb-shaped first token followed by a card id (`moai todo pick t151`) is read as a mistyped verb and errors — a card that merely mentions an id later in the sentence still adds. |
 | `moai todo add "<text>" [--pick]` | Adds an item and prints the issued id and position. With `--pick`, the add and the picked mark land in one locked write. |
 | `moai todo list` / `--json` | Renders the queue. `--json` emits the full records as JSON. |
 | `moai todo done <n>` | Removes item `n`. The explicit `t<n>` id form is preferred — queue positions move under concurrent adds. |
```

**File**: `docs-site/content/ja/utility-commands/moai-todo.md` (modified, +1/-1)
```diff
@@ -181,7 +181,7 @@ $ moai todo unrelate 2
 | コマンド | 動作 |
 |------|------|
 | `moai todo` (bare) | キューを出力します。`list` と同じ出力です。 |
-| `moai todo <2語以上>` | 自然言語をそのまま項目として追加します。1語(動詞の打ち間違いを含む)は追加ではなくエラーになります。 |
+| `moai todo <2語以上>` | 自然言語をそのまま項目として追加します。1語(動詞の打ち間違いを含む)は追加ではなくエラーになります。動詞のような最初のトークンの後にカード id が続く場合(`moai todo pick t151`)は打ち間違いの動詞と見なしてエラーです — 文中で id に触れるだけのカードはそのまま追加されます。 |
 | `moai todo add "<text>" [--pick]` | 項目を追加し、発行された id と位置を出力します。`--pick` を付けると追加と選択マークが一度のロックされた書き込みで行われます。 |
 | `moai todo list` / `--json` | キューを表示します。`--json` はレコード全体を JSON で出力します。 |
 | `moai todo done <n>` | `n` 番の項目を削除します。明示的な `t<n>` id 推奨 — 同時追加で位置が動きうるためです。 |
```

**File**: `docs-site/content/ko/utility-commands/moai-todo.md` (modified, +1/-1)
```diff
@@ -181,7 +181,7 @@ $ moai todo unrelate 2
 | 명령 | 동작 |
 |------|------|
 | `moai todo` (bare) | 대기열을 출력합니다. `list`와 같은 출력입니다. |
-| `moai todo <두 단어 이상>` | 자연어 그대로 항목을 추가합니다. 한 단어(오탈자 동사 포함)는 추가가 아니라 에러로 남습니다. |
+| `moai todo <두 단어 이상>` | 자연어 그대로 항목을 추가합니다. 한 단어(오탈자 동사 포함)는 추가가 아니라 에러로 남습니다. 동사처럼 생긴 첫 토큰 뒤에 카드 id가 오면(`moai todo pick t151`) 오탈자 동사로 보아 에러입니다 — 문장 중간에 id를 언급하는 카드는 그대로 추가됩니다. |
 | `moai todo add "<text>" [--pick]` | 항목을 추가하고 발급된 id와 위치를 출력합니다. `--pick`을 붙이면 추가와 선택 표시가 한 번의 잠긴 쓰기로 일어납니다. |
 | `moai todo list` / `--json` | 대기열을 출력합니다. `--json`은 레코드 전체를 JSON으로 내보냅니다. |
 | `moai todo done <n>` | `n`번 항목을 제거합니다. `t<n>` 형태의 명시적 id를 권장합니다 — 동시 추가로 위치가 움직일 수 있기 때문입니다. |
```

**File**: `docs-site/content/zh/utility-commands/moai-todo.md` (modified, +1/-1)
```diff
@@ -181,7 +181,7 @@ $ moai todo unrelate 2
 | 命令 | 行为 |
 |------|------|
 | `moai todo`（裸调用） | 输出队列。与 `list` 输出相同。 |
-| `moai todo <两个词以上>` | 按自然语原样添加条目。单个词（包括打错的动词）不是添加而是报错。 |
+| `moai todo <两个词以上>` | 按自然语原样添加条目。单个词（包括打错的动词）不是添加而是报错。若形如动词的首个词后面跟着卡片 id（`moai todo pick t151`），会被当作打错的动词而报错 —— 只是在句子中提到 id 的卡片仍然照常添加。 |
 | `moai todo add "<text>" [--pick]` | 添加条目，输出签发的 id 和位置。带 `--pick` 时，添加与挑选标记在一次加锁写入里完成。 |
 | `moai todo list` / `--json` | 呈现队列。`--json` 以 JSON 输出完整记录。 |
 | `moai todo done <n>` | 移除第 `n` 号条目。推荐使用显式 `t<n>` id 形式——并发添加会让位置移动。 |
```

**File**: `internal/cli/todo.go` (modified, +72/-1)
```diff
@@ -25,6 +25,8 @@ package cli
 import (
 	"encoding/json"
 	"fmt"
+	"regexp"
+	"sort"
 	"strings"
 
 	"github.com/spf13/cobra"
@@ -92,7 +94,13 @@ workflows/todo.md both document; ` + "`moai todo list`" + ` remains valid and pr
 same thing. A single unknown token stays an error (a mistyped verb must not
 become a card), while a phrase of two or more words falls through to add:
 ` + "`moai todo fix the flaky gate`" + ` adds that card. A one-word card therefore
-needs the explicit add verb — the price of keeping typos loud.`,
+needs the explicit add verb — the price of keeping typos loud.
+
+One fallthrough shape is refused outright: a verb-shaped first token followed
+by a card id (` + "`moai todo pick t151`" + `) is a mistyped verb, not a card, and
+becomes an error naming the known verbs. A card text that merely mentions an
+id later in the sentence still falls through, and ` + "`moai todo add \"<text>\"`" + `
+adds any text verbatim.`,
 		Args: func(cmd *cobra.Command, args []string) error {
 			// t69 fallthrough: two or more words are natural language → add.
 			// Deliberate failure modes: a single token (the mistyped verb
@@ -101,6 +109,13 @@ needs the explicit add verb — the price of keeping typos loud.`,
 			// card needs the explicit add verb; conversely a mistyped verb
 			// followed by more words ("lst the queue") DOES become a card,
 			// the accepted cost of the fallthrough.
+			//
+			// t203 narrows that accepted cost where the cost is highest:
+			// a verb-shaped first token addressing a card id is a mistyped
+			// verb, not a card — see todoMistypedVerbGuard.
+			if err := todoMistypedVerbGuard(cmd, args); err != nil {
+				return err
+			}
 			if len(args) > 1 {
 				return nil
 			}
@@ -122,6 +137,62 @@ needs the explicit add verb — the price of keeping typos loud.`,
 	return cmd
 }
 
+// todoVerbShaped matches a first token that reads as a command verb: one
+// lowercase ASCII word, optionally hyphenated. Bounded in length so a long
+// word in a card text cannot pass for a verb.
+var todoVerbShaped = regexp.MustCompile(`^[a-z][a-z-]{1,15}$`)
+
+// todoCardIDShaped matches the id form the queue issues (`t<decimal>`, see
+// kanban.BacklogStore). Deliberately NOT the looser reference form the verbs
+// accept (`done 151` normalizes a bare number): a bare number is ordinary
+// card text ("fix 3 flaky tests"), while an explicit `t151` in second
+// position is an address.
+var todoCardIDShaped = regexp.MustCompile(`^t\d+$`)
+
+// todoMistypedVerbGuard refuses the one fallthrough shape that is almost
+// never a card: a verb-shaped first token followed by a card id
+// (`moai todo pick t151`). Cobra routes a REGISTERED verb to its subcommand,
+// so anything reaching the parent is an unregistered word — and a word
+// addressing a card id is a mistyped verb whose silent conversion into a
+// card is the data pollution #1597 reports.
+//
+// The t69 usability trade-off is preserved everywhere else: a natural-language
+// card still falls through to add, including one that merely mentions a card
+// id later in the sentence ("fix the drift found in t151"). Only the exact
+// verb-then-id shape is refused, and `moai todo add "<text>"` remains the
+// escape hatch for a card that genuinely reads that way.
+func todoMistypedVerbGuard(cmd *cobra.Command, args []string) error {
+	if len(args) < 2 {
+		return nil
+	}
+	if !todoVerbShaped.MatchString(args[0]) || !todoCardIDShaped.MatchString(args[1]) {
+		return nil
+	}
+	phrase := strings.Join(args, " ")
+	return fmt.Errorf(
+		"todo: %q is not a todo verb and %q is a card id — refusing to create a card named %q.\n"+
+			"Known verbs: %s\nTo add this text as a card anyway: moai todo add %q",
+		args[0], args[1], phrase, strings.Join(todoVerbNames(cmd), ", "), phrase)
+}
+
+// todoVerbNames lists the registered verb names, so the guard's message is
+// derived from the command tree rather than from a hand-maintained list that
+// drifts as verbs are added.
+func todoVerbNames(cmd *cobra.Command) []string {
+	if cmd == nil {
+		return nil
+	}
+	names := make([]string, 0, len(cmd.Commands()))
+	for _, sub := range cmd.Commands() {
+		if sub.Name() == "help" || sub.Name() == "completion" || sub.Hidden {
+			continue
+		}
+		names = append(names, sub.Name())
+	}
+	sort.Strings(names)
+	return names
+}
+
 // newTodoAddCmd — `moai todo add "<text>"` (REQ-TODO-002): append under the
 // lock, print the issued id and its 1-based queue position. `--pick` (t71)
 // folds the pick into the same locked write.
```

**File**: `internal/cli/todo_test.go` (modified, +99/-0)
```diff
@@ -19,6 +19,8 @@ import (
 	"os"
 	"os/exec"
 	"path/filepath"
+	"slices"
+	"sort"
 	"strings"
 	"sync"
 	"testing"
@@ -593,6 +595,103 @@ func TestTodoSingleWordNaturalLanguageStillErrors(t *testing.T) {
 	}
 }
 
+// TestTodoMistypedVerbWithCardIDErrors — t203 (#1597): `moai todo pick t151`
+// used to fall through to add and create a card named "pick t151". A
+// verb-shaped first token addressing a card id is a mistyped verb, so it is
+// an error naming the known verbs, and the queue stays untouched.
+func TestTodoMistypedVerbWithCardIDErrors(t *testing.T) {
+	for _, args := range [][]string{
+		{"pick", "t151"},
+		{"finish", "t20"},
+		{"un-pick", "t7"},
+	} {
+		t.Run(strings.Join(args, "_"), func(t *testing.T) {
+			_, store := todoFixture(t)
+
+			_, errOut, err := runTodo(t, args...)
+			if err == nil {
+				t.Fatalf("%v was accepted, want an error", args)
+			}
+			combined := err.Error() + errOut
+			if !strings.Contains(combined, args[0]) || !strings.Contains(combined, args[1]) {
+				t.Errorf("error must name the token and the id; got %q", combined)
+			}
+			// The message points at the real verbs and at the escape hatch.
+			for _, want := range []string{"next", "done", "moai todo add"} {
+				if !strings.Contains(combined, want) {
+					t.Errorf("error should mention %q; got %q", want, combined)
+				}
+			}
+
+			rec, loadErr := store.Load()
+			if loadErr != nil {
+				t.Fatalf("load: %v", loadErr)
+			}
+			if len(rec.Items) != 0 {
+				t.Errorf("refused invocation still mutated the queue: %+v", rec.Items)
+			}
+		})
+	}
+}
+
+// TestTodoNaturalLanguageCardsSurviveVerbGuard — the t69 trade-off is
+// preserved: the guard is the exact verb-then-id shape and nothing wider. A
+// natural-language card still falls through, including one carrying a bare
+// number or mentioning a card id later in the sentence.
+func TestTodoNaturalLanguageCardsSurviveVerbGuard(t *testing.T) {
+	for _, tc := range []struct {
+		args []string
+		want string
+	}{
+		{[]string{"fix", "the", "flaky", "gate"}, "fix the flaky gate"},
+		{[]string{"fix", "3", "flaky", "tests"}, "fix 3 flaky tests"},
+		{[]string{"fix", "the", "drift", "found", "in", "t151"}, "fix the drift found in t151"},
+		{[]string{"t151", "regression", "follow-up"}, "t151 regression follow-up"},
+	} {
+		t.Run(tc.want, func(t *testing.T) {
+			_, store := todoFixture(t)
+
+			if _, _, err := runTodo(t, tc.args...); err != nil {
+				t.Fatalf("natural-language fallthrough refused: %v", err)
+			}
+			rec, err := store.Load()
+			if err != nil {
+				t.Fatalf("load: %v", err)
+			}
+			if len(rec.Items) != 1 || rec.Items[0].Text != tc.want {
+				t.Errorf("card = %+v; want one card %q", rec.Items, tc.want)
+			}
+		})
+	}
+}
+
+// TestTodoVerbNamesDerivedFromCommandTree — the guard's message lists the
+// registered verbs rather than a hand-maintained copy, so a verb added later
+// appears without a second edit.
+func TestTodoVerbNamesDerivedFromCommandTree(t *testing.T) {
+	cmd := newTodoCmd()
+	names := todoVerbNames(cmd)
+
+	registered := 0
+	for _, sub := range cmd.Commands() {
+		if sub.Name() == "help" || sub.Name() == "completion" || sub.Hidden {
+			continue
+		}
+		registered++
+	}
+	if len(names) != registered {
+		t.Errorf("todoVerbNames returned %d names, want %d (one per registered verb)", len(names), registered)
+	}
+	if !sort.StringsAreSorted(names) {
+		t.Errorf("verb names should be sorted for a stable message: %v", names)
+	}
+	for _, want := range []string{"add", "done", "next"} {
+		if !slices.Contains(names, want) {
+			t.Errorf("verb list missing %q: %v", want, names)
+		}
+	}
+}
+
 // --- t71: pick-marking race hardening ---
 //
 // Incident (2026-08-16, lead run tjv7iy): the lead ran `moai todo next t67`
```

---

### Incident Patch 6: `cb840fcb` (2026-08-25)
**Commit Message**: fix(kanban): register the lead session's own name as its title (t202) (#1613)

* fix(kanban): register the lead session's own name as its title (t202)

A session's name and its title are two separate registrations in Claude
Code. The `--name` injection has shipped since c326eb4e0 and made the lead
addressable — which is why messaging and delegation always worked — but
nothing ever set a TITLE, so the UserPromptSubmit title policy filled the
slot from the most recently modified spec.md and the lead was listed under
an unrelated SPEC heading.

The launcher publishes the lead's RESOLVED name (the operator's own when
they supplied one, the bare or bumped role otherwise) through the
environment the child session already inherits, and the hook titles the
session with it. The branch sits above the SPEC branch — a lead in a
project with SPECs is exactly the failing case — and below the first-wins
guard, so a /rename still wins and no title is re-emitted per turn.

The bootstrap notice gains a sentence in all four locales: the list shows
the same name, the title registers on the first prompt rather than at
launch, and /rename takes precedence.

Companion and lane sessions carry the same def

**File**: `.moai/reports/t202/verdict.md` (added, +101/-0)
```diff
@@ -0,0 +1,101 @@
+# t202 — 칸반 리드 세션 이름의 런타임 등록 (Fixes #1596)
+
+- 카드: t202 (Class C — 설계 방향 리드 확정: (b) 기본 + (a) 병행, (c) 범위 외)
+- 브랜치: `WT-lead-name-register` (base `origin/main` = `28bde4022`)
+- 이슈: #1596
+
+## 1. Claim
+
+`moai cc -k` / `moai glm -k` (및 factory `-f`) 로 띄운 **리드 세션이 세션 목록에 자기 이름으로 표시**된다. 표시 이름은 그 세션이 실제로 띄워진 이름 — 운영자가 직접 준 이름이 있으면 그 이름, 없으면 bare 또는 bump된 역할명(`lead`, `lead-1`) — 과 항상 같은 문자열이다. 나중에 `/rename` 하면 그쪽이 이긴다.
+
+## 2. Evidence
+
+### 2.1 근본 원인 — 카드 전제의 정정
+
+카드와 이슈는 "선언만 하고 런타임에 등록 안 함"으로 적었으나, **`--name` 주입은 이미 존재했고 신고된 빌드에도 들어 있었다.**
+
+```
+$ git log --oneline -1 -S'func appendLeadName' -- internal/cli/kanban.go
+c326eb4e0 feat(kanban): name the lead session by its bare role, not lead-<run-id>
+
+$ git merge-base --is-ancestor c326eb4e0 4b2f203fe && echo "IN 3.1.2 (issue's build)"
+IN 3.1.2 (issue's build)
+```
+
+즉 이슈 본문의 "`/rename` 이 사실상 유일한 등록 수단"은 **이름(name)** 에는 해당하지 않는다. 이슈 본문이 스스로 적은 "메시징·위임 정상"이 그 증거다 — 메시징 주소는 정상 등록돼 있었다.
+
+실제 결함은 **이름과 제목이 서로 다른 두 개의 등록**이라는 데 있다. `--name` 은 메시징 주소만 등록하고, 세션 목록에 뜨는 **제목**은 별도 기록이다. 제목을 아무도 정하지 않으면 `UserPromptSubmit` 훅의 기존 정책이 그 자리를 채우는데, 그 정책의 2순위가 `detectActiveSpec` — 프로젝트에서 가장 최근 수정된 `spec.md` 의 제목이다.
+
+`internal/hook/user_prompt_submit.go` `buildSessionTitle` (수정 전 순서):
+
+1. first-wins 가드 (ai-title / custom-title 있으면 `""`)
+2. **활성 SPEC → `"SPEC-ID: heading"`**  ← 리드 세션이 여기 걸렸다
+3. 첫 사용자 프롬프트에서 파생
+4. `""`
+
+이슈가 관측한 `"SPEC-MIGRATE-002: — 뷰어 프런트엔드 이식"` 은 git 로그가 아니라 **이 2번 분기의 출력 형태**와 정확히 일치한다.
+
+### 2.2 수정
+
+| 파일 | 변경 |
+|---|---|
+| `internal/config/envkeys.go` | `EnvMoaiKanbanLeadName = "MOAI_KANBAN_LEAD_NAME"` 신설 — 리드의 **해소된** 세션 이름을 런처 → 훅으로 전달 |
+| `internal/cli/kanban.go` | `appendLeadName` 이 `([]string, string)` 반환 (argv + 해소된 이름). 운영자가 이름을 준 경우에도 그 이름을 **보고**한다. `exportLeadSessionName(name) func()` 추가 — 기존 `captureEnvState` + 복원 idiom 준수 |
+| `internal/cli/cc.go`, `internal/cli/glm.go` | 리드 분기 4곳(kanban×2, factory×2)에서 `defer exportLeadSessionName(leadName)()` |
+| `internal/hook/user_prompt_submit.go` | `buildSessionTitle` 에 리드 분기 추가 — **first-wins 가드 아래, SPEC 분기 위**. `leadSessionTitle()` 헬퍼가 env를 `TrimSpace` 해서 읽음 |
+| `internal/hook/session_start_kanban_i18n.go`, `session_start_factory_i18n.go` | (a) 안내문 갱신, 4-locale(en/ko/ja/zh) 전부 — 목록에도 같은 이름이 뜨고, 제목은 **첫 프롬프트에** 등록되며, `/rename` 이 우선한다는 사실 명시 |
+
+분기 위치가 설계의 핵심이다.
+
+- **SPEC 분기 위**: 리드가 SPEC 있는 프로젝트에 앉아 있는 상황이 곧 이 결함의 발생 조건이다.
+- **first-wins 가드 아래**: `/rename` 은 다른 모든 출처를 이기듯 이 분기도 이긴다. 매 턴 제목을 다시 쓰는 회귀(#1198)를 되살리지 않는다.
+
+역할명을 훅에서 다시 유추하지 않고 런처가 해소한 값을 그대로 실어 보내는 이유: bump된 리드(`lead-1`)에서 제목과 실제 주소가 갈리기 때문이다.
+
+### 2.3 검증
+
+```
+$ go build ./...                                     (무출력)
+$ gofmt -l <touched 9 files>                         (무출력)
+$ golangci-lint run ./internal/hook/... ./internal/cli/... ./internal/config/...
+0 issues.
+$ go test ./internal/hook/ ./internal/config/ -count=1
+ok  github.com/modu-ai/moai-adk/internal/hook    23.510s
+ok  github.com/modu-ai/moai-adk/internal/config   2.302s
+$ go test ./internal/cli/ -count=1 -timeout 600s
+ok  github.com/modu-ai/moai-adk/internal/cli    344.867s
+```
+
+신규 회귀 테스트 `TestBuildSessionTitle_LeadNameWinsOverSPEC` 5개 서브테스트 전부 PASS:
+
+```
+--- PASS: .../not_a_lead_->_SPEC_title_(unchanged_default)
+--- PASS: .../lead_->_the_session's_own_name,_not_the_SPEC
+--- PASS: .../bumped_lead_->_the_bumped_name
+--- PASS: .../existing_title_wins_over_the_lead_name
+--- PASS: .../whitespace-only_value_->_falls_through_to_the_SPEC_title
+```
+
+첫 서브테스트는 **음성 대조군**이다 — 변수가 없을 때 SPEC 제목이 그대로 나오는 것을 먼저 확인하지 않으면, 양성 케이스가 "모든 세션에 이름을 붙이는" 잘못된 구현으로도 통과한다.
+
+기존 `TestAppendLeadName_OperatorNameWins` 은 반환값 변경에 맞춰 갱신하고, 운영자 이름이 **보고되는지**를 추가로 단언한다.
+
+## 3. Baseline-attribution
+
+- 기준 트리: `WT-lead-name-register`, base `origin/main` = `28bde4022`
+- 모든 수치는 이 트리에서 이 라운드에 실행한 명령의 출력이다. 캐시 비활성(`-count=1`).
+
+## 4. Gaps (미검증)
+
+- **실제 세션에서 제목이 바뀌는지 육안 확인 안 함.** 검증은 `buildSessionTitle` 의 반환값까지다 — 훅이 반환한 `SessionTitle` 을 Claude Code가 실제로 세션 목록에 반영하는 구간은 런타임 소관이고, 이 트리에서 관측하지 않았다. 기존 SPEC 제목 기능이 같은 경로로 동작해 왔다는 것이 유일한 간접 근거다.
+- **동반 세션(plan/run/sync)과 factory lane의 제목은 고치지 않았다.** 동일한 결함이 그대로 남아 있다 — 이름은 `--name` 으로 등록되지만 목록 제목은 여전히 SPEC에서 온다. 카드 범위가 리드였고, `MOAI_KANBAN_LABEL` 이 이미 해소된 라벨을 들고 있어 분기 하나면 되지만 범위 밖이라 손대지 않았다. **후속 카드 후보.**
+- **(c) `moai doctor` 진단 항목은 범위 외** — 리드 지시.
+- 전체 스위트(`go test ./...`)는 로컬에서 돌리지 않았다(CLAUDE.local.md §4). 전 패키지 판정은 CI 몫.
+- Windows/Linux 매트릭스 미검증 — CI 몫. env 전달과 `TrimSpace` 뿐이라 플랫폼 의존은 없어 보이나 관측한 바 없다.
+
+## 5. Residual-risk
+
+- **제목은 첫 프롬프트에 등록된다, 런치 시점이 아니다.** `UserPromptSubmit` 훅이 그 지점이라 구조적이다. 운영자가 첫 프롬프트를 보내기 전에 세션 목록을 보면 여전히 이름이 없다. 안내문(a)에 이 사실을 명시한 이유다.
+- **훅이 꺼진 환경(`disableAllHooks`)에서는 제목이 등록되지 않는다.** 메시징 이름은 `--name` 이라 영향 없다.
+- `os.Setenv` 는 프로세스 전역이다. 신규 테스트는 그래서 병렬이 아니며, 런처 쪽은 기존 `captureEnvState` 복원 규율(`@MX:ANCHOR` on `enterKanbanMode`)을 그대로 따른다. 복원 누락은 같은 바이너리의 뒤따르는 테스트를 오염시킨다.
+- 운영자가 리드에 자기 이름을 준 경우 그 이름이 제목이 된다. 의도된 동작이지만, 종전에는 SPEC 제목이 나왔으므로 그 운영자에게는 **행동 변화**다.
```

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -169,6 +169,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
   reasoning directive z.ai prefixes the response with thinking content blocks whose payload lives
   in `thinking`, not `text` — the blind `Content[0]` read failed open to `inconclusive` while a
   complete review sat in the next block.
+- A Kanban or Factory **lead session now appears in the session list under its own name** rather than an unrelated SPEC heading ([#1596](https://github.com/modu-ai/moai-adk/issues/1596)). A session's name and its title are two separate registrations: `--name` (already injected) made the lead addressable, which is why messaging and delegation always worked, but nothing ever set a title — so the `UserPromptSubmit` title policy filled the slot from the most recently modified `spec.md`, and a lead was listed as `SPEC-…: <heading>`. The launcher now publishes the lead's resolved name — the operator's own when they supplied one, the bare or bumped role otherwise — and the hook titles the session with it, above the SPEC branch and below the first-wins guard, so a later `/rename` still wins. The title registers on the first prompt, not at launch, and the bootstrap notice says so in all four locales. Companion and lane sessions are unchanged.
 
 ## [3.1.3] - 2026-08-24
 
```

**File**: `internal/cli/cc.go` (modified, +6/-2)
```diff
@@ -159,7 +159,9 @@ func runCC(cmd *cobra.Command, args []string) error {
 		leadLabel, _ := parseLeadLabel(filteredArgs)
 		defer enterFactoryLeadMode(entry.FactoryWorkers, leadLabel)()
 		defer exportKanbanLaunchFacts(entry.Spec, kanban.BackendClaude)()
-		filteredArgs = appendLeadName(filteredArgs, launchProjectRoot(), cmd.ErrOrStderr())
+		var leadName string
+		filteredArgs, leadName = appendLeadName(filteredArgs, launchProjectRoot(), cmd.ErrOrStderr())
+		defer exportLeadSessionName(leadName)()
 		settingsFlag, settingsCleanup := prepareKanbanSettings(filteredArgs)
 		if len(settingsFlag) > 0 {
 			filteredArgs = append(filteredArgs, settingsFlag...)
@@ -192,7 +194,9 @@ func runCC(cmd *cobra.Command, args []string) error {
 			defer exportKanbanLaunchFacts(entry.Spec, kanban.BackendClaude)()
 			// A lead launched bare has only an AI-generated title, which claude
 			// discards on /clear; naming it explicitly is what survives.
-			filteredArgs = appendLeadName(filteredArgs, launchProjectRoot(), cmd.ErrOrStderr())
+			var leadName string
+			filteredArgs, leadName = appendLeadName(filteredArgs, launchProjectRoot(), cmd.ErrOrStderr())
+			defer exportLeadSessionName(leadName)()
 			settingsFlag, settingsCleanup := prepareKanbanSettings(filteredArgs)
 			if len(settingsFlag) > 0 {
 				filteredArgs = append(filteredArgs, settingsFlag...)
```

**File**: `internal/cli/glm.go` (modified, +6/-2)
```diff
@@ -222,7 +222,9 @@ func runGLM(cmd *cobra.Command, args []string) error {
 		leadLabel, _ := parseLeadLabel(filteredArgs)
 		defer enterFactoryLeadMode(entry.FactoryWorkers, leadLabel)()
 		defer exportKanbanLaunchFacts(entry.Spec, kanban.BackendGLM)()
-		filteredArgs = appendLeadName(filteredArgs, launchProjectRoot(), cmd.ErrOrStderr())
+		var leadName string
+		filteredArgs, leadName = appendLeadName(filteredArgs, launchProjectRoot(), cmd.ErrOrStderr())
+		defer exportLeadSessionName(leadName)()
 		settingsFlag, settingsCleanup := prepareKanbanSettings(filteredArgs)
 		if len(settingsFlag) > 0 {
 			filteredArgs = append(filteredArgs, settingsFlag...)
@@ -249,7 +251,9 @@ func runGLM(cmd *cobra.Command, args []string) error {
 			defer enterKanbanMode(entry.Spec, leadLabel)()
 			defer exportKanbanLaunchFacts(entry.Spec, kanban.BackendGLM)()
 			// See cc.go: glm mirrors the lead branch exactly.
-			filteredArgs = appendLeadName(filteredArgs, launchProjectRoot(), cmd.ErrOrStderr())
+			var leadName string
+			filteredArgs, leadName = appendLeadName(filteredArgs, launchProjectRoot(), cmd.ErrOrStderr())
+			defer exportLeadSessionName(leadName)()
 			settingsFlag, settingsCleanup := prepareKanbanSettings(filteredArgs)
 			if len(settingsFlag) > 0 {
 				filteredArgs = append(filteredArgs, settingsFlag...)
```

**File**: `internal/cli/kanban.go` (modified, +28/-3)
```diff
@@ -648,13 +648,38 @@ func leadNameArgs(args []string) []string {
 // The bumped value must reach the backend argv: the session name is the address
 // the operator and the peers dispatch to, so a name resolved but not injected
 // leaves everyone addressing a session that answers to something else.
-func appendLeadName(args []string, root string, notes io.Writer) []string {
+func appendLeadName(args []string, root string, notes io.Writer) ([]string, string) {
 	nameArgs := leadNameArgs(args)
 	if len(nameArgs) == 0 {
-		return args
+		// The operator named the session themselves; that name is already in
+		// argv and is the one peers address. Report it so the title registered
+		// downstream is the name the session actually answers to, rather than
+		// the role moai would have chosen.
+		name, _ := parseNamedLabel(args, func(string) bool { return true })
+		return args, name
 	}
 	nameArgs[1] = resolveLeadName(root, nameArgs[1], notes)
-	return append(args, nameArgs...)
+	return append(args, nameArgs...), nameArgs[1]
+}
+
+// exportLeadSessionName publishes the lead's resolved session name to the child
+// session's environment and returns the restore func its callers defer.
+//
+// The name and the TITLE are two separate registrations in Claude Code: `--name`
+// makes the session addressable, and a title has to be set on its own or a
+// generated one takes the slot (issue #1596). Only the launcher knows the
+// resolved name and only a hook can set a title, so the value crosses that gap
+// through the environment the child already inherits.
+//
+// An empty name is a no-op that still returns a usable restore func, so a caller
+// can defer the result unconditionally.
+func exportLeadSessionName(name string) func() {
+	if name == "" {
+		return func() {}
+	}
+	restore := captureEnvState(config.EnvMoaiKanbanLeadName)
+	_ = os.Setenv(config.EnvMoaiKanbanLeadName, name)
+	return restore
 }
 
 // rejectKanbanOnCG returns the sentinel-bearing error when a kanban token
```

**File**: `internal/cli/kanban_lead_name_test.go` (modified, +6/-1)
```diff
@@ -307,8 +307,13 @@ func TestAppendLeadName_OperatorNameWins(t *testing.T) {
 	root := t.TempDir()
 
 	args := []string{"--name", "board-watch"}
-	got := appendLeadName(args, root, nil)
+	got, name := appendLeadName(args, root, nil)
 	if len(got) != len(args) {
 		t.Errorf("appendLeadName appended to an operator-named lead: %q", got)
 	}
+	// The operator's own name is still REPORTED, so the title registered
+	// downstream is the name the session actually answers to (issue #1596).
+	if name != "board-watch" {
+		t.Errorf("appendLeadName reported %q for an operator-named lead, want %q", name, "board-watch")
+	}
 }
```

**File**: `internal/config/envkeys.go` (modified, +17/-0)
```diff
@@ -223,6 +223,23 @@ const (
 	// derivable value (REQ-KRS-005).
 	EnvMoaiKanbanCard = "MOAI_KANBAN_CARD"
 
+	// EnvMoaiKanbanLeadName carries the lead session's RESOLVED name — the value
+	// that actually reached the backend argv as `--name`, which is the operator's
+	// own name when they supplied one and the bare-or-bumped role otherwise.
+	//
+	// It exists because a session name and a session TITLE are two different
+	// registrations in Claude Code. `--name` registers the messaging address, and
+	// peers address the lead correctly by it; the title shown in the session list
+	// is a separate record, and a lead that never set one is given a generated
+	// title instead — which is how a lead came to be listed under an unrelated
+	// SPEC heading while messaging worked perfectly (issue #1596). The launcher is
+	// the only place that knows the resolved name, and the UserPromptSubmit hook
+	// is the only place that can register a title, so the value travels between
+	// them through the environment the child session already inherits.
+	//
+	// It is set on the LEAD only. A companion's title is not registered from here.
+	EnvMoaiKanbanLeadName = "MOAI_KANBAN_LEAD_NAME"
+
 	// EnvMoaiFactoryWorkers carries the Factory Mode signal and the run's
 	// worker count from the launcher entry point to the block-cap inject and
 	// the SessionStart hook. It is set on BOTH the factory lead and every
```

**File**: `internal/hook/session_start_factory_i18n.go` (modified, +4/-4)
```diff
@@ -57,7 +57,7 @@ type factoryMessages struct {
 var factoryLocales = map[string]factoryMessages{
 	langEnglish: {
 		leadHeader:   "Factory Mode: run %s, lead session.",
-		leadIdentity: "This session is named %s. It carries no run id: a second lead launched while this one is live takes the next free number instead, and peers address whichever name the session actually launched under.",
+		leadIdentity: "This session is named %s. It carries no run id: a second lead launched while this one is live takes the next free number instead, and peers address whichever name the session actually launched under. The session list shows that same name — the title is registered on your first prompt, and a later /rename still wins.",
 		leadManual: "This session dispatches cards to %d lanes over cross-session messages.\n" +
 			"The lanes below are launched by hand, one per new terminal, because a session cannot launch another session.\n" +
 			"Lanes are named lane-1..lane-%d; a number whose label is held by a live session is bumped to the next free number.",
@@ -85,7 +85,7 @@ var factoryLocales = map[string]factoryMessages{
 	},
 	"ko": {
 		leadHeader:   "팩토리 모드: run %s, 리더 세션.",
-		leadIdentity: "이 세션의 이름은 %s 입니다. 이름에 run id 는 들어가지 않습니다 — 이 세션이 살아 있는 동안 리드를 하나 더 띄우면 그쪽이 다음 번호를 받고, 다른 세션은 실제로 띄워진 이름으로 이 세션을 부릅니다.",
+		leadIdentity: "이 세션의 이름은 %s 입니다. 이름에 run id 는 들어가지 않습니다 — 이 세션이 살아 있는 동안 리드를 하나 더 띄우면 그쪽이 다음 번호를 받고, 다른 세션은 실제로 띄워진 이름으로 이 세션을 부릅니다. 세션 목록에도 같은 이름이 뜹니다 — 제목은 첫 프롬프트에서 등록되고, 나중에 /rename 을 하면 그쪽이 우선합니다.",
 		leadManual: "이 세션이 세션 간 메시지로 카드를 레인 %d개에 배분합니다.\n" +
 			"아래 레인은 터미널을 하나씩 새로 열어 직접 실행하세요 — 세션은 다른 세션을 띄울 수 없습니다.\n" +
 			"레인 이름은 lane-1..lane-%d 이며, 생존 세션이 이미 쓰고 있는 번호는 다음 빈 번호로 늘어납니다.",
@@ -110,7 +110,7 @@ var factoryLocales = map[string]factoryMessages{
 	},
 	"ja": {
 		leadHeader:   "ファクトリーモード: run %s、リーダーセッション。",
-		leadIdentity: "このセッションの名前は %s です。名前に run id は含まれません — このセッションが生きている間にもう一つリーダーを起動すると、そちらが次の番号を取り、他のセッションは実際に起動した名前でこのセッションを呼びます。",
+		leadIdentity: "このセッションの名前は %s です。名前に run id は含まれません — このセッションが生きている間にもう一つリーダーを起動すると、そちらが次の番号を取り、他のセッションは実際に起動した名前でこのセッションを呼びます。セッション一覧にも同じ名前が表示されます — タイトルは最初のプロンプトで登録され、後から /rename すればそちらが優先されます。",
 		leadManual: "このセッションが、セッション間メッセージでカードをレーン %d 本に割り振ります。\n" +
 			"以下のレーンは、ターミナルを 1 つずつ新規に開いて手動で起動してください — セッションが別のセッションを起動することはできません。\n" +
 			"レーン名は lane-1..lane-%d で、生存セッションが保持する番号は次の空き番号へ繰り上がります。",
@@ -135,7 +135,7 @@ var factoryLocales = map[string]factoryMessages{
 	},
 	"zh": {
 		leadHeader:   "工厂模式：run %s，主导会话。",
-		leadIdentity: "本会话的名称是 %s。名称中不含 run id —— 本会话存活期间再启动一个主导会话，后者会取下一个编号；其他会话按实际启动时的名称来称呼本会话。",
+		leadIdentity: "本会话的名称是 %s。名称中不含 run id —— 本会话存活期间再启动一个主导会话，后者会取下一个编号；其他会话按实际启动时的名称来称呼本会话。会话列表中也显示同一名称 —— 标题在首次提示时注册，之后 /rename 优先。",
 		leadManual: "本会话通过跨会话消息把卡片分发给 %d 条泳道。\n" +
 			"下面的泳道需要各自新开一个终端手动启动 —— 会话无法启动另一个会话。\n" +
 			"泳道命名为 lane-1..lane-%d；已被存活会话占用的编号会顺延到下一个空位。",
```

---

### Incident Patch 7: `07a4ea0e` (2026-08-25)
**Commit Message**: feat(mcp): make a running MCP server's build version visible (t184) (#1600)

The host spawns `moai mcp-server` once per session and never respawns it on
reinstall, so `make install` leaves the host talking to the previous build.
Nothing surfaced that: tools/list simply lacked the new tools and the old
handlers kept answering. The skew was hit twice in one batch.

Two signals now exist.

The server advertises its full build stamp (semver + commit + build date) in
the `initialize` result instead of the bare semver — the semver is unchanged
across a rebuild, so the commit is the only field that can make the skew
visible — and its `instructions` field names the running build, its pid, and
the restart requirement.

`moai doctor` gains an MCP Server Version check. The server stamps its build
identity to `.moai/state/mcp-server/<pid>.json` while it runs; the check
probes those records for liveness and warns when a live server's commit
differs from the installed binary's, with reconnect guidance. Records left by
a hard-killed server are pruned in passing. The check reports OK — never a
warning — with no live server or with no commit metadata to attribute a
mismatch to, so it fires only on 

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -41,6 +41,8 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
   locales.
 
 - Claude and Codex sessions can now message each other directly, through the `moai` MCP server acting as a broker. Four new MCP tools — `session_msg_register`, `session_msg_list`, `session_msg_send`, `session_msg_poll` — let an agent register a mailbox, discover registered peers, deliver a message, and claim its inbox. Messages carry an A2A-aligned envelope (sender, recipient, text, structured `data`, context/task correlation, expiry) and live in a file store under `.moai/state/session-msg/`, so two processes that share nothing but the checkout can still find each other. The core lives in `internal/sessionmsg/`; the tool surface in `internal/cli/mcp_session_msg.go` is a thin wrapper over it, and the tool count in `internal/mcp/catalog.go` grows from 21 to 25. Two caveats worth knowing before relying on it: the new tools only appear after the MCP server is restarted (a running server keeps its old tool list — see `t184`), and on codex-cli 0.147 the `session_msg_send` `data` argument is leniently coerced rather than strictly validated. Sending to an unregistered agent returns a structured error carrying the known-agent list, so the caller can enumerate peers instead of parsing error text. Real-process round-trip between a `moai mcp-server` and a `codex exec` session is covered by an e2e marker test (`session-msg-e2e`).
+- `moai mcp-server` now advertises its full build stamp (version, commit, build date) in the `initialize` result instead of the bare semver, and its `instructions` field names the running build, its pid, and the fact that a rebuilt binary does not replace an already-spawned server.
+- `moai doctor` gains an **MCP Server Version** check. The server records its build identity to `.moai/state/mcp-server/<pid>.json` while it runs; the check probes those records for liveness and warns when a live server's commit differs from the installed binary's, with reconnect guidance. Dead records are pruned in passing. The check reports OK — never a warning — when no server is running or when the binary carries no commit metadata.
 
 ### Changed
 
```

**File**: `internal/cli/doctor.go` (modified, +1/-0)
```diff
@@ -198,6 +198,7 @@ func runGroupedChecksObserved(verbose bool, filterCheck string, obs checkObserve
 		{"MoAI Version", checkMoAIVersion},
 		{"Binary Freshness", checkBinaryFreshness},
 		{"MCP Scope Duplicates", func(v bool) DiagnosticCheck { return checkMCPScopeDuplicates(cwd, v) }},
+		{mcpServerVersionCheckName, func(v bool) DiagnosticCheck { return checkMCPServerVersion(cwd, v) }},
 		{"Constitution Registry", func(v bool) DiagnosticCheck {
 			registryPath := resolveRegistryPath(cwd)
 			strictMode := os.Getenv(constitutionStrictEnvKey) == "1"
```

**File**: `internal/cli/doctor_mcp_version.go` (added, +104/-0)
```diff
@@ -0,0 +1,104 @@
+// Package cli — doctor_mcp_version.go
+//
+// `moai doctor` check: does a RUNNING `moai mcp-server` still match the
+// installed binary?
+//
+// The host spawns the MCP server once per session and never respawns it on
+// reinstall, so `make install` leaves the host talking to the previous build.
+// Nothing surfaces that: tools/list simply lacks the new tools and the old
+// handlers keep answering. This check reads the per-PID build stamps the
+// server writes at startup (mcp_server_runtime.go), probes their liveness,
+// and warns when a live server's commit differs from this binary's.
+package cli
+
+import (
+	"fmt"
+	"os"
+	"sort"
+	"strings"
+
+	"github.com/modu-ai/moai-adk/internal/cli/uikit"
+	"github.com/modu-ai/moai-adk/pkg/version"
+)
+
+// mcpServerVersionCheckName is the doctor check identifier (also the value
+// accepted by `moai doctor --check`).
+const mcpServerVersionCheckName = "MCP Server Version"
+
+// checkMCPServerVersion compares every live `moai mcp-server` process
+// recorded for this project against the installed binary's build commit.
+//
+// Reported OK (never WARN) when:
+//   - no live server is recorded — nothing to compare
+//   - this binary carries no commit metadata ("", "none", "unknown") — a
+//     dev build cannot attribute a mismatch, so a WARN would be noise
+//
+// WARN only on positive evidence: a live server whose commit differs from
+// this binary's. Dead stamps left by a hard-killed server are pruned in
+// passing so they cannot accumulate into a false positive later.
+func checkMCPServerVersion(projectRoot string, verbose bool) DiagnosticCheck {
+	return checkMCPServerVersionAgainst(projectRoot, version.GetCommit(), verbose)
+}
+
+// checkMCPServerVersionAgainst is checkMCPServerVersion with the installed
+// binary's commit injected, so the comparison can be exercised without
+// mutating the package-level build vars.
+func checkMCPServerVersionAgainst(projectRoot, binaryCommit string, verbose bool) DiagnosticCheck {
+	check := DiagnosticCheck{Name: mcpServerVersionCheckName}
+
+	live, stalePaths := liveMCPServerRuntimeRecords(projectRoot)
+	for _, p := range stalePaths {
+		_ = os.Remove(p)
+	}
+
+	if len(live) == 0 {
+		check.Status = uikit.CheckOK
+		check.Message = "no running moai MCP server recorded"
+		if verbose {
+			check.Detail = "the server stamps .moai/state/mcp-server/<pid>.json while it runs"
+		}
+		return check
+	}
+
+	binCommit := strings.TrimSpace(binaryCommit)
+	if binCommit == "" || binCommit == "none" || binCommit == "unknown" {
+		check.Status = uikit.CheckOK
+		check.Message = fmt.Sprintf("%d running MCP server(s); development build (no commit metadata to compare)", len(live))
+		return check
+	}
+
+	var stale []string
+	for _, rec := range live {
+		recCommit := strings.TrimSpace(rec.Commit)
+		if recCommit == "" || recCommit == "none" || recCommit == "unknown" {
+			// The server was itself a dev build; it cannot be attributed
+			// either way, so it is not counted as a mismatch.
+			continue
+		}
+		if !commitsMatch(recCommit, binCommit) {
+			stale = append(stale, fmt.Sprintf("pid %d: %s", rec.PID, shortCommit(recCommit)))
+		}
+	}
+
+	if len(stale) == 0 {
+		check.Status = uikit.CheckOK
+		check.Message = fmt.Sprintf("%d running MCP server(s) match the installed binary (%s)", len(live), shortCommit(binCommit))
+		return check
+	}
+
+	sort.Strings(stale)
+	check.Status = uikit.CheckWarn
+	check.Message = fmt.Sprintf("running MCP server is stale (%s; binary: %s)", strings.Join(stale, ", "), shortCommit(binCommit))
+	check.Detail = "Reconnect the MCP server so the host respawns it (Claude Code: /mcp -> reconnect, or restart the session). " +
+		"A rebuilt binary does not replace an already-running server, so newly added tools stay absent until then."
+	return check
+}
+
+// commitsMatch reports whether two commit strings identify the same commit,
+// tolerating differing abbreviation lengths (one side may be a short hash).
+func commitsMatch(a, b string) bool {
+	if a == b {
+		return true
+	}
+	return strings.HasPrefix(a, b) || strings.HasPrefix(b, a)
+}
```

**File**: `internal/cli/doctor_mcp_version_test.go` (added, +149/-0)
```diff
@@ -0,0 +1,149 @@
+package cli
+
+import (
+	"os"
+	"path/filepath"
+	"strings"
+	"testing"
+
+	"github.com/modu-ai/moai-adk/internal/cli/uikit"
+)
+
+// TestCheckMCPServerVersion_NoRunningServer asserts the check reports OK, not
+// WARN, when nothing is running — absence of a server is not a defect.
+func TestCheckMCPServerVersion_NoRunningServer(t *testing.T) {
+	const binCommit = "aaaaaaaaaaaa"
+	check := checkMCPServerVersionAgainst(t.TempDir(), binCommit, false)
+
+	if check.Name != mcpServerVersionCheckName {
+		t.Errorf("check.Name = %q, want %q", check.Name, mcpServerVersionCheckName)
+	}
+	if check.Status != uikit.CheckOK {
+		t.Errorf("Status = %v, want CheckOK", check.Status)
+	}
+	if !strings.Contains(check.Message, "no running") {
+		t.Errorf("Message = %q, want it to state that no server is recorded", check.Message)
+	}
+}
+
+// TestCheckMCPServerVersion_StaleServerWarns is the core regression: a live
+// server stamped with a different commit than the installed binary MUST warn
+// and MUST tell the operator to reconnect.
+func TestCheckMCPServerVersion_StaleServerWarns(t *testing.T) {
+	const binCommit = "bbbbbbbbbbbb"
+	projectDir := t.TempDir()
+	writeRuntimeRecord(t, projectDir, mcpServerRuntimeRecord{PID: os.Getpid(), Commit: "aaaaaaaaaaaa"})
+
+	check := checkMCPServerVersionAgainst(projectDir, binCommit, false)
+
+	if check.Status != uikit.CheckWarn {
+		t.Fatalf("Status = %v, want CheckWarn (a live server on a different commit is stale)", check.Status)
+	}
+	if !strings.Contains(check.Message, "aaaaaaaaa") || !strings.Contains(check.Message, "bbbbbbbbb") {
+		t.Errorf("Message = %q, want both the server and binary commits named", check.Message)
+	}
+	if !strings.Contains(check.Detail, "Reconnect") {
+		t.Errorf("Detail = %q, want reconnect guidance", check.Detail)
+	}
+}
+
+// TestCheckMCPServerVersion_MatchingServerOK asserts no warning when the live
+// server was built from the installed commit.
+func TestCheckMCPServerVersion_MatchingServerOK(t *testing.T) {
+	const binCommit = "cccccccccccc"
+	projectDir := t.TempDir()
+	writeRuntimeRecord(t, projectDir, mcpServerRuntimeRecord{PID: os.Getpid(), Commit: "cccccccccccc"})
+
+	check := checkMCPServerVersionAgainst(projectDir, binCommit, false)
+
+	if check.Status != uikit.CheckOK {
+		t.Fatalf("Status = %v, want CheckOK", check.Status)
+	}
+	if !strings.Contains(check.Message, "match") {
+		t.Errorf("Message = %q, want it to state the server matches", check.Message)
+	}
+}
+
+// TestCheckMCPServerVersion_AbbreviatedCommitMatches asserts a short-hash
+// stamp is not reported stale against the same commit's long hash.
+func TestCheckMCPServerVersion_AbbreviatedCommitMatches(t *testing.T) {
+	const binCommit = "abcdef1234567890"
+	projectDir := t.TempDir()
+	writeRuntimeRecord(t, projectDir, mcpServerRuntimeRecord{PID: os.Getpid(), Commit: "abcdef123"})
+
+	if check := checkMCPServerVersionAgainst(projectDir, binCommit, false); check.Status != uikit.CheckOK {
+		t.Fatalf("Status = %v, want CheckOK for an abbreviated form of the same commit", check.Status)
+	}
+}
+
+// TestCheckMCPServerVersion_DevBuildSkips asserts a binary with no commit
+// metadata reports OK rather than warning on every server — an unattributable
+// mismatch is a gap, not a defect.
+func TestCheckMCPServerVersion_DevBuildSkips(t *testing.T) {
+	const binCommit = "none"
+	projectDir := t.TempDir()
+	writeRuntimeRecord(t, projectDir, mcpServerRuntimeRecord{PID: os.Getpid(), Commit: "aaaaaaaaaaaa"})
+
+	check := checkMCPServerVersionAgainst(projectDir, binCommit, false)
+	if check.Status != uikit.CheckOK {
+		t.Fatalf("Status = %v, want CheckOK for a dev build", check.Status)
+	}
+	if !strings.Contains(check.Message, "development build") {
+		t.Errorf("Message = %q, want it to name the dev-build skip reason", check.Message)
+	}
+}
+
+// TestCheckMCPServerVersion_DevBuildServerNotCounted asserts a server that was
+// itself built without commit metadata is not counted as a mismatch.
+func TestCheckMCPServerVersion_DevBuildServerNotCounted(t *testing.T) {
+	const binCommit = "dddddddddddd"
+	projectDir := t.TempDir()
+	writeRuntimeRecord(t, projectDir, mcpServerRuntimeRecord{PID: os.Getpid(), Commit: "none"})
+
+	if check := checkMCPServerVersionAgainst(projectDir, binCommit, false); check.Status != uikit.CheckOK {
+		t.Fatalf("Status = %v, want CheckOK when the server carries no commit metadata", check.Status)
+	}
+}
+
+// TestCheckMCPServerVersion_PrunesDeadRecords asserts a stamp left behind by a
+// hard-killed server is removed in passing and never produces a warning.
+func TestCheckMCPServerVersion_PrunesDeadRecords(t *testing.T) {
+	const binCommit = "eeeeeeeeeeee"
+	projectDir := t.TempDir()
+	deadPath := writeRuntimeRecord(t, projectDir, mcpServerRuntimeRecord{PID: 4194303, Commit: "ffffffffffff"})
+
+	check := checkMCPServerVersionAgainst(projectDir, binCommit, false)
+
+	if check.Status != uikit.CheckOK {
+		t.Fatalf("Status = %v, want CheckOK (a dead serve
```

**File**: `internal/cli/mcp_server.go` (modified, +28/-1)
```diff
@@ -85,6 +85,12 @@ provision the entry (M4).`,
 // until the stdio stream closes). REQ-MCP-001. ServeStdio owns its context
 // internally (derived from os signals); there is no ctx to thread here.
 func runMCPServer() error {
+	// Stamp this process's build identity so `moai doctor` can detect a host
+	// still talking to a previously-installed build (mcp_server_runtime.go).
+	// Best-effort by contract: a failed stamp never blocks serving.
+	if recordPath, err := writeMCPServerRuntimeRecord(resolveProjectDir()); err == nil {
+		defer removeMCPServerRuntimeRecord(recordPath)
+	}
 	s := newMoaiMCPServer()
 	// ServeStdio blocks until the stdin stream closes; the goal.go blocking-RunE
 	// pattern. opts remain extensible (error logger, etc.) without API churn.
@@ -98,15 +104,36 @@ func runMCPServer() error {
 // REQ-C-2) from `.moai/config/sections/mcp.yaml` (default all-enabled) and a
 // disabled tool is not registered at all, so it never appears in tools/list.
 func newMoaiMCPServer() *server.MCPServer {
+	// The advertised version carries the FULL build stamp (semver + commit +
+	// build date), not the bare semver. A host that reconnects after a
+	// reinstall shows the same semver either way, so the commit is the only
+	// field that makes a version skew visible in the `initialize` result.
 	s := server.NewMCPServer(
 		moaiMCPServerName,
-		version.GetVersion(),
+		version.GetFullVersion(),
 		server.WithToolCapabilities(true),
+		server.WithInstructions(moaiMCPServerInstructions()),
 	)
 	registerMoaiMCPTools(s, resolveProjectDir())
 	return s
 }
 
+// moaiMCPServerInstructions returns the server `instructions` string sent in
+// the `initialize` result. It names the running build so an operator reading
+// the host's MCP panel can compare it against `moai version` without calling
+// a tool, and states the restart requirement explicitly — a rebuilt binary
+// does not replace an already-spawned server process.
+func moaiMCPServerInstructions() string {
+	return fmt.Sprintf(
+		"moai self-hosted MCP server, build %s (pid %d). "+
+			"This process was spawned by the host and keeps running the build it started with: "+
+			"after reinstalling the moai binary, reconnect the server so the host respawns it, "+
+			"otherwise newly added tools stay absent from tools/list. "+
+			"Run `moai doctor` to compare the running server against the installed binary.",
+		version.GetFullVersion(), os.Getpid(),
+	)
+}
+
 // registerMoaiMCPTools registers the M1 core read/status/audit tool surface
 // (design.md §3). Each tool declares its JSON Schema (REQ-MCP-004) and registers
 // a thin-wrapper handler that calls the verified internal/ integration point
```

**File**: `internal/cli/mcp_server_runtime.go` (added, +150/-0)
```diff
@@ -0,0 +1,150 @@
+// Package cli — mcp_server_runtime.go
+//
+// Build-identity record for a RUNNING `moai mcp-server` process.
+//
+// The MCP server is spawned by the host (Claude Code, Cursor, ...) and lives
+// for the whole host session. Reinstalling the binary mid-session does NOT
+// restart it, so the host keeps talking to the previously-installed build —
+// a silent version skew: newly added tools are absent from tools/list and
+// fixed handlers keep running the old code path, with no signal anywhere.
+//
+// The server therefore stamps its own build identity to disk at startup and
+// removes the stamp on exit. `moai doctor` reads the live stamps and compares
+// them against the currently-installed binary (doctor_mcp_version.go), which
+// turns the skew from invisible into a WARN with restart guidance.
+//
+// One file per PID, so two hosts running a server for the same project each
+// get their own record and neither clobbers the other.
+package cli
+
+import (
+	"encoding/json"
+	"os"
+	"path/filepath"
+	"strconv"
+	"time"
+
+	"github.com/modu-ai/moai-adk/pkg/version"
+)
+
+// mcpServerRuntimeRecord is the on-disk build identity of one running
+// `moai mcp-server` process. Fields mirror pkg/version's build-time vars plus
+// the process identity needed to tell a live server from a stale record.
+type mcpServerRuntimeRecord struct {
+	PID       int    `json:"pid"`
+	Version   string `json:"version"`
+	Commit    string `json:"commit"`
+	BuildDate string `json:"build_date"`
+	StartedAt string `json:"started_at"`
+	// Executable is the resolved path of the running binary, best-effort
+	// (empty when os.Executable fails). Diagnostic only — the commit is the
+	// comparison key.
+	Executable string `json:"executable,omitempty"`
+}
+
+// mcpServerRuntimeDir returns the directory holding per-PID server records for
+// a project. Empty projectDir yields an empty path (caller skips the write).
+func mcpServerRuntimeDir(projectDir string) string {
+	if projectDir == "" {
+		return ""
+	}
+	return filepath.Join(projectDir, ".moai", "state", "mcp-server")
+}
+
+// currentMCPServerRuntimeRecord builds the record describing THIS process.
+func currentMCPServerRuntimeRecord() mcpServerRuntimeRecord {
+	exe, err := os.Executable()
+	if err != nil {
+		exe = ""
+	}
+	return mcpServerRuntimeRecord{
+		PID:        os.Getpid(),
+		Version:    version.GetVersion(),
+		Commit:     version.GetCommit(),
+		BuildDate:  version.GetDate(),
+		StartedAt:  time.Now().UTC().Format(time.RFC3339),
+		Executable: exe,
+	}
+}
+
+// writeMCPServerRuntimeRecord stamps this process's build identity under the
+// project's state directory and returns the written path.
+//
+// Best-effort by contract: a read-only or missing state directory must never
+// prevent the server from serving, so every failure returns ("", err) and the
+// caller ignores it.
+func writeMCPServerRuntimeRecord(projectDir string) (string, error) {
+	dir := mcpServerRuntimeDir(projectDir)
+	if dir == "" {
+		return "", os.ErrInvalid
+	}
+	if err := os.MkdirAll(dir, 0o755); err != nil {
+		return "", err
+	}
+	rec := currentMCPServerRuntimeRecord()
+	data, err := json.MarshalIndent(rec, "", "  ")
+	if err != nil {
+		return "", err
+	}
+	path := filepath.Join(dir, strconv.Itoa(rec.PID)+".json")
+	if err := os.WriteFile(path, append(data, '\n'), 0o644); err != nil {
+		return "", err
+	}
+	return path, nil
+}
+
+// removeMCPServerRuntimeRecord deletes a stamp written by
+// writeMCPServerRuntimeRecord. Best-effort: an empty path or a failed remove
+// is ignored, because a leftover record is pruned by the doctor check's
+// liveness probe anyway.
+func removeMCPServerRuntimeRecord(path string) {
+	if path == "" {
+		return
+	}
+	_ = os.Remove(path)
+}
+
+// readMCPServerRuntimeRecords returns every parseable record in the project's
+// server-record directory. Unreadable or malformed files are skipped rather
+// than reported: a corrupt stamp must not turn a diagnostic into an error.
+func readMCPServerRuntimeRecords(projectDir string) []mcpServerRuntimeRecord {
+	dir := mcpServerRuntimeDir(projectDir)
+	if dir == "" {
+		return nil
+	}
+	entries, err := os.ReadDir(dir)
+	if err != nil {
+		return nil
+	}
+	var records []mcpServerRuntimeRecord
+	for _, e := range entries {
+		if e.IsDir() || filepath.Ext(e.Name()) != ".json" {
+			continue
+		}
+		data, err := os.ReadFile(filepath.Join(dir, e.Name()))
+		if err != nil {
+			continue
+		}
+		var rec mcpServerRuntimeRecord
+		if err := json.Unmarshal(data, &rec); err != nil || rec.PID <= 0 {
+			continue
+		}
+		records = append(records, rec)
+	}
+	return records
+}
+
+// liveMCPServerRuntimeRecords splits records into those whose PID is still
+// alive and the paths of those that are not, so the caller can prune the dead
+// stamps a hard-killed server left behind.
+func liveMCPServerRuntimeRecords(projectDir string) (live []mcpServerRuntimeRecord, stalePaths []string) {
+	dir := mcpServerRuntimeDir(project
```

**File**: `internal/cli/mcp_server_runtime_test.go` (added, +154/-0)
```diff
@@ -0,0 +1,154 @@
+package cli
+
+import (
+	"encoding/json"
+	"os"
+	"path/filepath"
+	"strconv"
+	"strings"
+	"testing"
+
+	"github.com/modu-ai/moai-adk/pkg/version"
+)
+
+// writeRuntimeRecord is a test helper stamping an arbitrary record for a project.
+func writeRuntimeRecord(t *testing.T, projectDir string, rec mcpServerRuntimeRecord) string {
+	t.Helper()
+	dir := mcpServerRuntimeDir(projectDir)
+	if err := os.MkdirAll(dir, 0o755); err != nil {
+		t.Fatalf("MkdirAll: %v", err)
+	}
+	data, err := json.Marshal(rec)
+	if err != nil {
+		t.Fatalf("Marshal: %v", err)
+	}
+	path := filepath.Join(dir, strconv.Itoa(rec.PID)+".json")
+	if err := os.WriteFile(path, data, 0o644); err != nil {
+		t.Fatalf("WriteFile: %v", err)
+	}
+	return path
+}
+
+// TestWriteMCPServerRuntimeRecord_RoundTrip asserts the server's startup stamp
+// lands under .moai/state/mcp-server/<pid>.json carrying this build's identity,
+// and that the exit path removes it.
+func TestWriteMCPServerRuntimeRecord_RoundTrip(t *testing.T) {
+	projectDir := t.TempDir()
+
+	path, err := writeMCPServerRuntimeRecord(projectDir)
+	if err != nil {
+		t.Fatalf("writeMCPServerRuntimeRecord: %v", err)
+	}
+	wantPath := filepath.Join(projectDir, ".moai", "state", "mcp-server", strconv.Itoa(os.Getpid())+".json")
+	if path != wantPath {
+		t.Errorf("record path = %q, want %q", path, wantPath)
+	}
+
+	records := readMCPServerRuntimeRecords(projectDir)
+	if len(records) != 1 {
+		t.Fatalf("read %d records, want 1", len(records))
+	}
+	rec := records[0]
+	if rec.PID != os.Getpid() {
+		t.Errorf("PID = %d, want %d", rec.PID, os.Getpid())
+	}
+	if rec.Version != version.GetVersion() {
+		t.Errorf("Version = %q, want %q", rec.Version, version.GetVersion())
+	}
+	if rec.Commit != version.GetCommit() {
+		t.Errorf("Commit = %q, want %q", rec.Commit, version.GetCommit())
+	}
+	if rec.StartedAt == "" {
+		t.Error("StartedAt is empty; the stamp must record when the server started")
+	}
+
+	removeMCPServerRuntimeRecord(path)
+	if _, err := os.Stat(path); !os.IsNotExist(err) {
+		t.Errorf("record still present after remove: %v", err)
+	}
+}
+
+// TestWriteMCPServerRuntimeRecord_EmptyProjectDir asserts the stamp is skipped
+// rather than written to a relative path when the project dir cannot be
+// resolved — the server must still serve.
+func TestWriteMCPServerRuntimeRecord_EmptyProjectDir(t *testing.T) {
+	path, err := writeMCPServerRuntimeRecord("")
+	if err == nil {
+		t.Error("expected an error for an empty project dir")
+	}
+	if path != "" {
+		t.Errorf("path = %q, want empty", path)
+	}
+}
+
+// TestReadMCPServerRuntimeRecords_SkipsMalformed asserts a corrupt or
+// non-JSON file is skipped, not surfaced as an error — a bad stamp must not
+// break the diagnostic.
+func TestReadMCPServerRuntimeRecords_SkipsMalformed(t *testing.T) {
+	projectDir := t.TempDir()
+	dir := mcpServerRuntimeDir(projectDir)
+	if err := os.MkdirAll(dir, 0o755); err != nil {
+		t.Fatalf("MkdirAll: %v", err)
+	}
+	if err := os.WriteFile(filepath.Join(dir, "999999.json"), []byte("{not json"), 0o644); err != nil {
+		t.Fatalf("WriteFile: %v", err)
+	}
+	if err := os.WriteFile(filepath.Join(dir, "notes.txt"), []byte("ignored"), 0o644); err != nil {
+		t.Fatalf("WriteFile: %v", err)
+	}
+	writeRuntimeRecord(t, projectDir, mcpServerRuntimeRecord{PID: os.Getpid(), Commit: "abc123"})
+
+	records := readMCPServerRuntimeRecords(projectDir)
+	if len(records) != 1 {
+		t.Fatalf("read %d records, want 1 (malformed + non-JSON skipped)", len(records))
+	}
+	if records[0].Commit != "abc123" {
+		t.Errorf("Commit = %q, want abc123", records[0].Commit)
+	}
+}
+
+// TestReadMCPServerRuntimeRecords_MissingDir asserts an absent record
+// directory reads as no records rather than an error.
+func TestReadMCPServerRuntimeRecords_MissingDir(t *testing.T) {
+	if records := readMCPServerRuntimeRecords(t.TempDir()); len(records) != 0 {
+		t.Errorf("read %d records from a project with no state dir, want 0", len(records))
+	}
+	if records := readMCPServerRuntimeRecords(""); len(records) != 0 {
+		t.Errorf("read %d records for an empty project dir, want 0", len(records))
+	}
+}
+
+// TestLiveMCPServerRuntimeRecords_SplitsByLiveness asserts a dead PID's stamp
+// is reported as stale (so the caller can prune it) while this process's own
+// stamp is reported live.
+func TestLiveMCPServerRuntimeRecords_SplitsByLiveness(t *testing.T) {
+	projectDir := t.TempDir()
+	writeRuntimeRecord(t, projectDir, mcpServerRuntimeRecord{PID: os.Getpid(), Commit: "live"})
+	// PID 0 never names a live process and is rejected by the record reader,
+	// so use a PID that is valid-looking but almost certainly dead.
+	deadPath := writeRuntimeRecord(t, projectDir, mcpServerRuntimeRecord{PID: 4194303, Commit: "dead"})
+
+	live, stalePaths := liveMCPServerRuntimeRecords(projectDir)
+	if len(live) != 1 || live[0].Commit != "live" {
+		t.Fatalf("live = %+v, want exactly the running process's record", live)
+	}
+	if len(stalePaths) != 1 || stale
```

**File**: `internal/cli/testdata/doctor-dark.golden` (modified, +3/-2)
```diff
@@ -17,12 +17,13 @@
 │    ok      MoAI Version           moai-adk v3.1.3                                                                                                    │
 │    ok      Binary Freshness       development build (no commit metadata)                                                                             │
 │    ok      MCP Scope Duplicates   no MCP configuration found (project or global)                                                                     │
+│    ok      MCP Server Version     no running moai MCP server recorded                                                                                │
 │    warn    Constitution Registry  zone-registry.md not found at ".claude/rules/moai/core/zone-registry.md" — run `moai constitution list` to verify  │
 │    ok      Harness 5-Layer        .moai/harness/ not present (no harness configured)                                                                 │
 │    ok      Migration              current version 0                                                                                                  │
 │    ok      Plugin Deployment      no plugin marker (binary-managed)                                                                                  │
 │    ok      Home Disk Usage        no ~/.moai home found — nothing to report                                                                          │
-│    7 ok, 3 warn, 0 fail                                                                                                                              │
+│    8 ok, 3 warn, 0 fail                                                                                                                              │
 │                                                                                                                                                      │
 │  Workspace ---                                                                                                                                       │
 │    STATUS  CHECK             MESSAGE                                                                                                                 │
@@ -38,6 +39,6 @@
 │    ok      Codex Wiring      not wired (claude-only project) — skipped                                                                               │
 │    2 ok, 8 warn, 0 fail                                                                                                                              │
 │                                                                                                                                                      │
-│   Pass 14    Warn 11    Fail 0                                                                                                                       │
+│   Pass 15    Warn 11    Fail 0                                                                                                                       │
 │                                                                                                                                                      │
 ╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
```

---

### Incident Patch 8: `bf6083f1` (2026-08-24)
**Commit Message**: fix(constitution): let validate retire an entry instead of deleting it (#1611)

* fix(constitution): let validate retire an entry instead of deleting it (t201)

A registry clause that has been withdrawn had nowhere to live. Its text is
gone from the source tree by construction, so validate's verbatim drift check
could only ever fail, and the single escape was to delete the entry — which
destroys the record that the clause once existed and was retired.

Validate now recognises a `[SUPERSEDED ...]` prefix on a clause as a retirement
marker: the entry's drift, canary-gate, and source-file checks are skipped, it
is counted in a new `retired_count`, and the report names how many were skipped
so a retired clause stays visible rather than disappearing along with its check.
`--strict` ignores the marker and checks retired entries verbatim.

The issue also proposed `canary_gate: false` as a second marker. It cannot be
one: it is the documented default for every Evolvable entry, so honouring it
would disable the drift check across most of the registry. The four entries the
issue names are Evolvable and raise DRIFT only. A retired Frozen entry may carry
`canary_gate: false` as a consequence o

**File**: `.claude/rules/moai/core/zone-registry.md` (modified, +21/-0)
```diff
@@ -36,6 +36,27 @@ CanaryGate defaults (plan.md §7 OQ6 decision):
 - Frozen → `canary_gate: true`
 - Evolvable → `canary_gate: false`
 
+## Retiring an Entry
+
+A clause that is no longer in force is **retired, not deleted** — deleting it destroys the record that the clause once existed and was withdrawn.
+
+To retire an entry, prefix its `clause` with a `[SUPERSEDED …]` marker naming what replaced it:
+
+```text
+clause: "[SUPERSEDED by <replacement>] <the original clause text>"
+```
+
+(The fence above is deliberately tagged `text`, not `yaml`. The registry loader reads the **first** yaml-tagged fence in this file as the entry list, so a yaml-tagged example placed before `## Entries` would be parsed as the registry and fail to load — and so would that fence marker written out literally in prose.)
+
+`moai constitution validate` then counts the entry as retired and skips its drift, canary-gate, and source-file checks — the source text is gone by definition, so those checks could only ever fail. The entry still appears in `moai constitution list`, and the retired total is reported (`retired_count` in JSON output).
+
+Two boundaries:
+
+- The marker is a **prefix**, not a substring. A live clause that merely mentions `[SUPERSEDED …]` in its own text stays fully checked.
+- `canary_gate: false` is **not** a retirement marker — it is the documented default for every Evolvable entry. A retired Frozen entry may carry `canary_gate: false` because it is retired, not the other way round.
+
+`moai constitution validate --strict` ignores the marker and checks retired entries verbatim, for auditing what they still hold.
+
 ## Usage Guide
 
 ```bash
```

**File**: `.moai/reports/t201/verdict.md` (added, +104/-0)
```diff
@@ -0,0 +1,104 @@
+# t201 — constitution validate honours a retirement marker (#1595)
+
+Class B (defect, cause established during run). Branch `WT-constitution-retire`, base `28bde4022`.
+
+## Claim
+
+`moai constitution validate` now skips drift, canary-gate, and source-file checks for a registry entry whose `clause` begins with `[SUPERSEDED …]`, counts it as retired, and keeps it visible in the report. `--strict` restores verbatim checking.
+
+## Cause
+
+`internal/constitution/validator.go` `Validate` checked every entry's clause verbatim against its source file. A retired clause's text is gone from source by construction, so the DRIFT check could only ever fail — deleting the entry was the only escape, which is what destroyed the audit trail the issue describes.
+
+The issue's second symptom (`canary_gate: false`) was investigated and is **not** a second marker. The four entries named in the issue (`CONST-V3R2-021..024`) are `zone: Evolvable`, for which `canary_gate: false` is the documented default; measured, they raise DRIFT only, never `FROZEN_WITHOUT_CANARY`. Honouring `canary_gate: false` as a retirement marker would have disabled the drift check for most of the registry. Retirement is the `[SUPERSEDED …]` prefix alone; the canary invariant is relaxed for a retired Frozen entry as a *consequence* of retirement.
+
+The marker is a prefix rather than a substring for a measured reason: `CONST-V3R2-152`'s live clause instructs that superseded memory entries be marked `[SUPERSEDED by <new-file>]`, and a substring test would silently retire it.
+
+## Evidence
+
+Baseline reproduction, this tree, before the change (65 errors was the primary checkout at an older HEAD; this tree measures 67):
+
+```
+$ go run ./cmd/moai constitution validate 2>&1 | grep -E "CONST-V3R2-02[1-4]"
+  [DRIFT] CONST-V3R2-021 @ CLAUDE.md #14-parallel-execution-safeguards
+  [DRIFT] CONST-V3R2-022 @ CLAUDE.md #14-parallel-execution-safeguards
+  [DRIFT] CONST-V3R2-023 @ CLAUDE.md #14-parallel-execution-safeguards
+  [DRIFT] CONST-V3R2-024 @ CLAUDE.md #14-parallel-execution-safeguards
+```
+
+After, against the same registry:
+
+```
+$ go run ./cmd/moai constitution validate --format json | grep -E '"(drift|retired)_count"'
+  "drift_count": 63,
+  "retired_count": 4,
+
+$ go run ./cmd/moai constitution validate --strict --format json | grep -E '"(drift|retired)_count"'
+  "drift_count": 67,
+  "retired_count": 0,
+```
+
+63 + 4 = 67: the four skipped entries are exactly the retired ones, and `--strict` reproduces the pre-change count byte for byte. No other entry changed state.
+
+Regression tests (`internal/constitution/retirement_test.go`, fixture-based, written before the fix and observed failing to compile on `RetiredCount` / `IsRetiredClause`):
+
+- retired entry raises no DRIFT and reports `RetiredCount: 1`
+- retired Frozen entry with `canary_gate: false` raises no `FROZEN_WITHOUT_CANARY`
+- retired entry whose source file is deleted raises no fatal `SOURCE_FILE_MISSING`
+- `--strict` reports the retired entry as DRIFT
+- control: a non-retired absent clause still reports DRIFT
+- marker-boundary table, including the mid-clause mention that must NOT retire
+
+```
+$ go test ./internal/constitution/... ./internal/cli/ -count=1
+ok  github.com/modu-ai/moai-adk/internal/constitution  0.244s
+ok  github.com/modu-ai/moai-adk/internal/cli           406.930s
+
+$ MOAI_TEMPLATE_LEAK_STRICT=1 go test ./internal/template/... -count=1
+ok  github.com/modu-ai/moai-adk/internal/template            23.443s
+ok  github.com/modu-ai/moai-adk/internal/template/agentemit   0.473s
+
+$ golangci-lint run ./internal/constitution/... ./internal/cli/
+0 issues.
+
+$ go build ./...   # clean
+$ make build       # templates re-embedded; catalog.yaml unchanged
+```
+
+## Defect found in this card's own work (caught by CI, fixed)
+
+The first push broke `Constitution Check`. The documentation section added to `zone-registry.md` carried a yaml-tagged example fence, and the loader (`extractYAMLFence`) takes the **first** yaml-tagged fence in the document as the entry list — so the example became the registry:
+
+```
+Registry load error ".claude/rules/moai/core/zone-registry.md":
+  YAML parsing error: yaml: unmarshal errors: line 2: cannot unmarshal !!map into []constitution.rawEntry
+```
+
+Retagging the fence `text` was not sufficient: the explanatory sentence spelled the fence marker out literally in prose, and `strings.Index(content, "```yaml")` matched that too, producing a second, different parse error (`line 5: mapping values are not allowed in this context`). Both are now avoided by never writing the literal marker in this file.
+
+`TestShippedRegistriesLoad` (`internal/constitution/shipped_registry_test.go`) was added so this cannot recur silently: it loads both shipped registries — local and template mirror — and fails on a parse error. Nothing previously covered the real files; the CI job that noticed is `continue-on-error: true`, i.e. advis
```

**File**: `internal/cli/constitution.go` (modified, +16/-2)
```diff
@@ -243,7 +243,7 @@ func newConstitutionValidateCmd() *cobra.Command {
 	cmd := &cobra.Command{
 		Use:   "validate",
 		Short: "Validate zone registry against source files for drift and invariant violations",
-		Long:  "Checks that every registry entry's clause exists in the source file, validates zone_class enum, canary_gate invariants, and reports drift. Exit codes: 0=ok, 1=drift/errors, 2=fatal (missing source file).",
+		Long:  "Checks that every registry entry's clause exists in the source file, validates zone_class enum, canary_gate invariants, and reports drift. Entries whose clause begins with a [SUPERSEDED …] retirement marker are counted and skipped, so a clause can be retired without deleting its audit record; --strict checks them verbatim like any other entry. Exit codes: 0=ok, 1=drift/errors, 2=fatal (missing source file).",
 		RunE: func(cmd *cobra.Command, _ []string) error {
 			cwd, err := os.Getwd()
 			if err != nil {
@@ -257,7 +257,7 @@ func newConstitutionValidateCmd() *cobra.Command {
 		},
 	}
 
-	cmd.Flags().BoolVar(&strictFlag, "strict", false, "Strict mode (enforces all checks)")
+	cmd.Flags().BoolVar(&strictFlag, "strict", false, "Strict mode (enforces all checks, including on [SUPERSEDED …] retired entries)")
 	cmd.Flags().BoolVar(&failOnWarningFlag, "fail-on-warning", false, "Treat warnings as errors (implies --strict)")
 	cmd.Flags().StringVar(&formatFlag, "format", "text", "Output format (text|json)")
 
@@ -339,6 +339,7 @@ func renderValidateJSON(w io.Writer, result constitution.ValidationResult) error
 		DriftCount        int         `json:"drift_count"`
 		MissingCount      int         `json:"missing_count"`
 		UnregisteredCount int         `json:"unregistered_count"`
+		RetiredCount      int         `json:"retired_count"`
 		Entries           []jsonEntry `json:"entries"`
 		Warnings          []string    `json:"warnings,omitempty"`
 		Skipped           bool        `json:"skipped,omitempty"`
@@ -360,6 +361,7 @@ func renderValidateJSON(w io.Writer, result constitution.ValidationResult) error
 		DriftCount:        result.DriftCount,
 		MissingCount:      result.MissingCount,
 		UnregisteredCount: result.UnregisteredCount,
+		RetiredCount:      result.RetiredCount,
 		Entries:           entries,
 		Warnings:          result.Warnings,
 		Skipped:           result.Skipped,
@@ -382,6 +384,7 @@ func renderValidateText(w io.Writer, result constitution.ValidationResult) {
 
 	if result.Status == constitution.ValidateStatusOK {
 		_, _ = fmt.Fprintf(w, "constitution validate: OK — no drift or violations detected (%d entries checked)\n", 0)
+		renderRetiredNote(w, result)
 		return
 	}
 
@@ -392,6 +395,17 @@ func renderValidateText(w io.Writer, result constitution.ValidationResult) {
 			_, _ = fmt.Fprintf(w, "    detail: %s\n", e.Detail)
 		}
 	}
+	renderRetiredNote(w, result)
+}
+
+// renderRetiredNote reports entries skipped for carrying the [SUPERSEDED …]
+// retirement marker, so a retired clause stays visible instead of disappearing
+// from the report along with its check.
+func renderRetiredNote(w io.Writer, result constitution.ValidationResult) {
+	if result.RetiredCount == 0 {
+		return
+	}
+	_, _ = fmt.Fprintf(w, "\n  %d retired entry/entries skipped ([SUPERSEDED …] marker); re-check them with --strict\n", result.RetiredCount)
 }
 
 // renderConstitutionTable outputs entries in table format.
```

**File**: `internal/constitution/marker_regression_check_test.go` (added, +56/-0)
```diff
@@ -0,0 +1,56 @@
+package constitution
+
+import (
+	"os"
+	"path/filepath"
+	"regexp"
+	"strings"
+	"testing"
+)
+
+// TestIsRetiredClause_ShippedRegistryClassificationUnchanged pins the tightened
+// marker rule against the registry this repository actually ships.
+//
+// The rule was narrowed twice (a boundary character, then requiring the
+// marker's own bracket to close). Narrowing a classifier risks dropping a
+// genuine retirement, and a dropped retirement silently re-enables checks that
+// were deliberately switched off — so the safe direction has to be measured,
+// not asserted. Every clause carrying the marker in shipped form must still
+// classify as retired.
+func TestIsRetiredClause_ShippedRegistryClassificationUnchanged(t *testing.T) {
+	t.Parallel()
+
+	repoRoot := filepath.Join("..", "..")
+	path := filepath.Join(repoRoot, ".claude", "rules", "moai", "core", "zone-registry.md")
+
+	data, err := os.ReadFile(path) //nolint:gosec // fixed in-repo path
+	if err != nil {
+		t.Fatalf("read registry %s: %v", path, err)
+	}
+
+	clauseRE := regexp.MustCompile(`(?m)^  clause: "(.*)"$`)
+	matches := clauseRE.FindAllStringSubmatch(string(data), -1)
+	if len(matches) == 0 {
+		t.Fatalf("no clause lines parsed from %s — the parser or the file shape changed", path)
+	}
+
+	retired := 0
+	for _, m := range matches {
+		clause := m[1]
+		// A clause that carries the marker in its shipped form — leading
+		// "[SUPERSEDED" with the bracket closed before any other opens — is a
+		// genuine retirement and must stay classified as one.
+		if !strings.HasPrefix(strings.TrimSpace(clause), "[SUPERSEDED") {
+			continue
+		}
+		retired++
+		if !IsRetiredClause(clause) {
+			t.Errorf("shipped retirement clause no longer classifies as retired: %.80q", clause)
+		}
+	}
+
+	if retired == 0 {
+		t.Fatal("no retirement-marked clauses found — this test would pass vacuously")
+	}
+	t.Logf("clauses parsed: %d, retirement-marked: %d", len(matches), retired)
+}
```

**File**: `internal/constitution/retirement.go` (added, +47/-0)
```diff
@@ -0,0 +1,47 @@
+package constitution
+
+import "strings"
+
+// retirementMarkerPrefix is the marker that retires a registry entry.
+//
+// A clause beginning with this prefix records a clause that used to be in force
+// and has since been withdrawn. The entry stays in the registry as an audit
+// record ("this clause was retired") instead of being deleted, and validate
+// stops checking it against the source tree — the source text is gone by
+// definition, so a verbatim check can only ever fail.
+//
+// The marker is deliberately a PREFIX rather than a substring: a live clause may
+// legitimately mention the marker in its own text (the session-handoff clause
+// instructing that superseded memory entries be marked with it), and treating
+// that as retirement would silently disable a real check.
+//
+// canary_gate:false is NOT a retirement marker. It is the documented default for
+// every Evolvable entry, so honoring it as one would disable the drift check for
+// most of the registry. Retired entries carry the prefix; the canary invariant is
+// relaxed for them as a consequence of retirement, not as a second marker.
+const retirementMarkerPrefix = "[SUPERSEDED"
+
+// IsRetiredClause reports whether a registry clause carries the retirement
+// marker — a leading "[SUPERSEDED" (optionally followed by a reason, e.g.
+// "[SUPERSEDED by CONST-V3R6-001]"). Leading whitespace is ignored.
+//
+// The marker must be a COMPLETE token: the prefix has to end at the bracket or
+// at a space, and the bracket has to close. A bare prefix match would classify
+// "[SUPERSEDEDLY] …" and an unterminated "[SUPERSEDED …" as retired, and a
+// retired entry skips drift, canary-gate, and source-file validation — so a
+// live or malformed clause would silently switch its own checks off.
+func IsRetiredClause(clause string) bool {
+	trimmed := strings.TrimSpace(clause)
+	if !strings.HasPrefix(trimmed, retirementMarkerPrefix) {
+		return false
+	}
+	rest := trimmed[len(retirementMarkerPrefix):]
+	if rest == "" || (rest[0] != ']' && rest[0] != ' ') {
+		return false
+	}
+	// The marker's OWN bracket has to close. A later bracket belonging to
+	// something else does not: "[SUPERSEDED live [HARD]" ends in ']', but that
+	// one closes "[HARD" and leaves the marker open.
+	closing := strings.IndexByte(rest, ']')
+	return closing >= 0 && !strings.Contains(rest[:closing], "[")
+}
```

**File**: `internal/constitution/retirement_test.go` (added, +194/-0)
```diff
@@ -0,0 +1,194 @@
+package constitution_test
+
+import (
+	"testing"
+
+	"github.com/modu-ai/moai-adk/internal/constitution"
+)
+
+// retiredRegistryEntry is a registry entry whose clause carries the
+// [SUPERSEDED …] retirement marker and whose text no longer exists in source.
+const retiredRegistryEntry = `- id: CONST-V3R2-021
+  zone: Evolvable
+  zone_class: evolvable-experimental
+  file: CLAUDE.md
+  anchor: "#14-parallel-execution-safeguards"
+  clause: "[SUPERSEDED by worktree-opt-in policy] Implementation teammates MUST use isolation: worktree when spawned via Agent()"
+  canary_gate: false
+`
+
+// liveSource is a source file that does NOT contain the retired clause text.
+const liveSource = "# Rules\n\n[ZONE:Evolvable] [HARD] Worktree isolation is opt-in.\n"
+
+// TestValidateSkipsDriftForRetiredEntry verifies that a [SUPERSEDED …]-prefixed
+// clause is not reported as DRIFT, so an entry can be retired without deleting it.
+// Issue #1595.
+func TestValidateSkipsDriftForRetiredEntry(t *testing.T) {
+	t.Parallel()
+
+	dir := t.TempDir()
+	writeSourceInDir(t, dir, "CLAUDE.md", liveSource)
+	regPath := writeRegistryInDir(t, dir, retiredRegistryEntry)
+
+	result, err := constitution.Validate(constitution.ValidateOptions{
+		RegistryPath: regPath,
+		ProjectDir:   dir,
+	})
+	if err != nil {
+		t.Fatalf("Validate() unexpected error: %v", err)
+	}
+	if result.DriftCount != 0 {
+		t.Errorf("DriftCount = %d, want 0; entries: %v", result.DriftCount, result.Entries)
+	}
+	if result.Status != constitution.ValidateStatusOK {
+		t.Errorf("Status = %q, want %q; entries: %v", result.Status, constitution.ValidateStatusOK, result.Entries)
+	}
+	if result.RetiredCount != 1 {
+		t.Errorf("RetiredCount = %d, want 1", result.RetiredCount)
+	}
+}
+
+// TestValidateRetiredFrozenEntrySkipsCanaryCheck verifies that a retired Frozen
+// entry may carry canary_gate:false without a FROZEN_WITHOUT_CANARY error —
+// a retired clause is never amended, so shadow evaluation cannot apply.
+// Issue #1595.
+func TestValidateRetiredFrozenEntrySkipsCanaryCheck(t *testing.T) {
+	t.Parallel()
+
+	dir := t.TempDir()
+	writeSourceInDir(t, dir, "CLAUDE.md", liveSource)
+	regPath := writeRegistryInDir(t, dir, `- id: CONST-V3R2-030
+  zone: Frozen
+  zone_class: frozen-canonical
+  file: CLAUDE.md
+  anchor: "#rules"
+  clause: "[SUPERSEDED by CONST-V3R6-001] Some retired frozen clause."
+  canary_gate: false
+`)
+
+	result, err := constitution.Validate(constitution.ValidateOptions{
+		RegistryPath: regPath,
+		ProjectDir:   dir,
+	})
+	if err != nil {
+		t.Fatalf("Validate() unexpected error: %v", err)
+	}
+	if len(result.Entries) != 0 {
+		t.Errorf("Entries = %v, want none", result.Entries)
+	}
+}
+
+// TestValidateRetiredEntryToleratesMissingSource verifies that a retired entry
+// whose source file no longer exists does not raise the fatal
+// SOURCE_FILE_MISSING error — the entry survives purely as an audit record.
+// Issue #1595.
+func TestValidateRetiredEntryToleratesMissingSource(t *testing.T) {
+	t.Parallel()
+
+	dir := t.TempDir()
+	regPath := writeRegistryInDir(t, dir, `- id: CONST-V3R2-031
+  zone: Evolvable
+  zone_class: evolvable-tuning
+  file: deleted-rule.md
+  anchor: "#gone"
+  clause: "[SUPERSEDED by nothing] A clause whose source file was deleted."
+  canary_gate: false
+`)
+
+	result, err := constitution.Validate(constitution.ValidateOptions{
+		RegistryPath: regPath,
+		ProjectDir:   dir,
+	})
+	if err != nil {
+		t.Fatalf("Validate() unexpected error: %v", err)
+	}
+	if result.MissingCount != 0 {
+		t.Errorf("MissingCount = %d, want 0; entries: %v", result.MissingCount, result.Entries)
+	}
+}
+
+// TestValidateStrictEnforcesRetiredEntry verifies that --strict ignores the
+// retirement marker and checks the clause verbatim, so a maintainer can audit
+// what the retired entries would report.
+// Issue #1595.
+func TestValidateStrictEnforcesRetiredEntry(t *testing.T) {
+	t.Parallel()
+
+	dir := t.TempDir()
+	writeSourceInDir(t, dir, "CLAUDE.md", liveSource)
+	regPath := writeRegistryInDir(t, dir, retiredRegistryEntry)
+
+	result, err := constitution.Validate(constitution.ValidateOptions{
+		RegistryPath: regPath,
+		ProjectDir:   dir,
+		Strict:       true,
+	})
+	if err != nil {
+		t.Fatalf("Validate() unexpected error: %v", err)
+	}
+	if result.DriftCount != 1 {
+		t.Errorf("DriftCount = %d, want 1 under --strict; entries: %v", result.DriftCount, result.Entries)
+	}
+}
+
+// TestValidateNonRetiredEntryStillDrifts is the control: an ordinary entry whose
+// clause is absent from source is still reported, so the retirement skip does
+// not widen into a blanket bypass.
+func TestValidateNonRetiredEntryStillDrifts(t *testing.T) {
+	t.Parallel()
+
+	dir := t.TempDir()
+	writeSourceInDir(t, dir, "CLAUDE.md", liveSource)
+	regPath := writeRegistryInDir(t, dir, `- id: CONST-V3R2-032
+  zone: Evolvable
+  zone_class: evolvable-tuning
+  file: CLAUDE.md
+  anchor: "#rules"
+  clause: "A live clause that is absent from 
```

**File**: `internal/constitution/shipped_registry_test.go` (added, +48/-0)
```diff
@@ -0,0 +1,48 @@
+package constitution_test
+
+import (
+	"os"
+	"path/filepath"
+	"testing"
+
+	"github.com/modu-ai/moai-adk/internal/constitution"
+)
+
+// TestShippedRegistriesLoad guards the registry files this repository actually
+// ships against a parse break.
+//
+// The loader takes the FIRST yaml-tagged code fence in the document as the entry
+// list, so any yaml-tagged example added above "## Entries" — or that fence
+// marker written out literally in prose — silently becomes the registry and the
+// file stops loading. Prose edits to these documents are otherwise untested, and
+// the CI job that would notice is advisory (continue-on-error).
+func TestShippedRegistriesLoad(t *testing.T) {
+	t.Parallel()
+
+	repoRoot := filepath.Join("..", "..")
+	paths := map[string]string{
+		"local":    filepath.Join(repoRoot, ".claude", "rules", "moai", "core", "zone-registry.md"),
+		"template": filepath.Join(repoRoot, "internal", "template", "templates", ".claude", "rules", "moai", "core", "zone-registry.md"),
+	}
+
+	for name, path := range paths {
+		t.Run(name, func(t *testing.T) {
+			t.Parallel()
+
+			// Fatal, not Skip: a deleted or renamed registry is exactly the
+			// failure this test claims to guard, and skipping would report
+			// green for it.
+			if _, err := os.Stat(path); err != nil {
+				t.Fatalf("registry not present at %s: %v", path, err)
+			}
+
+			reg, err := constitution.LoadRegistry(path, repoRoot)
+			if err != nil {
+				t.Fatalf("LoadRegistry(%s): %v", path, err)
+			}
+			if len(reg.Entries) == 0 {
+				t.Errorf("LoadRegistry(%s) returned 0 entries", path)
+			}
+		})
+	}
+}
```

**File**: `internal/constitution/validator.go` (modified, +17/-0)
```diff
@@ -113,6 +113,11 @@ type ValidationResult struct {
 	// UnregisteredCount is the number of ZONE_UNREGISTERED entries.
 	UnregisteredCount int `json:"unregistered_count"`
 
+	// RetiredCount is the number of entries skipped because their clause carries
+	// the [SUPERSEDED …] retirement marker. Always 0 under --strict, which checks
+	// retired entries verbatim like any other.
+	RetiredCount int `json:"retired_count"`
+
 	// Entries is the list of error/warning items.
 	Entries []ValidationEntry `json:"entries"`
 
@@ -201,6 +206,13 @@ func Validate(opts ValidateOptions) (ValidationResult, error) {
 	sourceCache := make(map[string]string)
 
 	for _, entry := range reg.Entries {
+		// 0. Retirement marker — a [SUPERSEDED …] clause is an audit record of a
+		// withdrawn clause, not a live one. Its source text is gone by definition,
+		// so the drift, canary, and source-existence checks below cannot be
+		// satisfied and are skipped. --strict ignores the marker and checks the
+		// entry verbatim, so a maintainer can audit what the retired entries hold.
+		retired := !opts.Strict && IsRetiredClause(entry.Clause)
+
 		// 1. INVALID_ZONE_CLASS check
 		if entry.ZoneClass != "" && !validZoneClasses[entry.ZoneClass] {
 			result.Entries = append(result.Entries, ValidationEntry{
@@ -211,6 +223,11 @@ func Validate(opts ValidateOptions) (ValidationResult, error) {
 			})
 		}
 
+		if retired {
+			result.RetiredCount++
+			continue
+		}
+
 		// 2. FROZEN_WITHOUT_CANARY check
 		if entry.Zone == ZoneFrozen && !entry.CanaryGate {
 			result.Entries = append(result.Entries, ValidationEntry{
```

---

### Incident Patch 9: `f7eec06c` (2026-08-24)
**Commit Message**: fix(security): narrow the pre-write security scan surface and fold the advisory guardian into the post-tool handler (t217) (#1643)

* docs(spec): plan the security scan surface decision (t217)

Card t217: decide where the two duplicated security scans run.

Investigation (.moai/reports/t217/investigation.md) establishes the
premise the card asked for: the PreToolUse ast-grep deny has never
fired in 15,638 transcripts spanning 2026-01-28..2026-08-24, verified
against a BRANCH_GUARD_VIOLATION control proving hook deny reasons do
reach transcripts. The mechanism is live, not broken. Two adjacent
defects surfaced: card worktrees resolve no rules config at all, and
15 extensions trigger the scan while only 4 languages carry rules.

Operator decision: keep the pre-write blocking capability but make it
cheap (A), and merge the PostToolUse guardian process into post-tool
(B). SPEC-SEC-SCAN-SURFACE-001 specifies both.

🗿 MoAI

* docs(spec): close six blocking plan-audit findings (t217)

plan-auditor FAIL 0.65 -> remediation. Frontmatter did not parse at all
(tags: was a sequence against a string field), so era classification and
drift detection were dead for this SPEC; moai spec lint now e

**File**: `.claude/settings.json` (modified, +0/-7)
```diff
@@ -78,13 +78,6 @@
             "args": ["-c", "[ -f \"$0\" ] && exec bash \"$0\"; d=\"${0%/.claude/hooks/moai/*}\"; mkdir -p \"$d/.moai/logs\" 2>/dev/null; printf \"%s %s\\n\" \"$(date -u +%FT%TZ)\" \"hook missing: $0\" >> \"$d/.moai/logs/hook-missing.log\" 2>/dev/null; exit 0", "${CLAUDE_PROJECT_DIR}/.claude/hooks/moai/status-transition-ownership.sh"],
             "timeout": 5,
             "type": "command"
-          },
-          {
-            "command": "bash",
-            "args": ["-c", "[ -f \"$0\" ] && exec bash \"$0\"; d=\"${0%/.claude/hooks/moai/*}\"; mkdir -p \"$d/.moai/logs\" 2>/dev/null; printf \"%s %s\\n\" \"$(date -u +%FT%TZ)\" \"hook missing: $0\" >> \"$d/.moai/logs/hook-missing.log\" 2>/dev/null; exit 0", "${CLAUDE_PROJECT_DIR}/.claude/hooks/moai/handle-security-scan.sh"],
-            "timeout": 5,
-            "type": "command",
-            "async": true
           }
         ],
         "matcher": "Write|Edit|MultiEdit"
```

**File**: `.moai/specs/SPEC-SEC-SCAN-SURFACE-001/acceptance.md` (modified, +1/-1)
```diff
@@ -227,7 +227,7 @@ Commands and their pre-implementation measurements:
 | `git diff --name-only <merge-base>...HEAD` — the mirror and pair audit reads this list, **scoped to the diff** | every `.claude/` entry paired | this SPEC changes `settings.json` only; it touches no hook wrapper |
 | `bash .moai/reports/t217/driftcheck.sh pairaxis` — the **deployed ↔ template** axis REQ-SSS-015 and `spec.md` §D speak to, restricted to wrappers this SPEC's diff changes | prints nothing for every wrapper in the diff | prints **1** line repo-wide (`handle-pre-tool.sh`), pre-existing and out of scope — see the note below. This SPEC's diff contains no wrapper, so its scoped result is **0** |
 | `bash .moai/reports/t217/driftcheck.sh guarded` — the templates-internal axis, retained as a secondary check | prints nothing | prints nothing (**0** lines). The `unguarded` mode of the same script prints **31** lines, because 31 of 35 `.tmpl` files legitimately have no `.sh` sibling inside `templates/`; the guard is the canonical form from `CLAUDE.local.md` §2.3 |
-| `MOAI_TEMPLATE_LEAK_STRICT=1 go test ./internal/template/ -count=1` | pass | **UNVERIFIED** — the run exceeded 120 s and returned empty output at authoring time. This row's "today" value is a Gap, not a Claim (`verification-claim-integrity.md` §2); it must be measured with an explicit longer timeout before M4 cites it |
+| `MOAI_TEMPLATE_LEAK_STRICT=1 go test ./internal/template/ -count=1 -timeout 900s` | pass | **MEASURED at M4** — `ok github.com/modu-ai/moai-adk/internal/template 28.425s`, exit `0`. The authoring-time Gap (the run exceeded a 120 s Bash timeout and returned empty output) is closed: re-run with an explicit `-timeout 900s` and a 900 s call budget, the test completes in ~28 s and passes. Evidence: `.moai/state/verify/t217/template-leak-strict.txt` |
 | `gh pr view --json title,body --jq '.title, (.body \| split("\n")[0])'` | title and first body line each name this a change to the **security scan surface**, neither presents it as a performance improvement (REQ-SSS-016) | no PR exists until M4 |
 
 Note on scope: a repository-wide `.sh` ↔ `.sh.tmpl` byte-equality sweep is **not** a valid gate.
```

**File**: `.moai/specs/SPEC-SEC-SCAN-SURFACE-001/progress.md` (modified, +508/-2)
```diff
@@ -111,11 +111,517 @@ measure it with an explicit longer timeout before citing it.
 
 ## §E.2 Run-phase Evidence
 
-_<pending run-phase>_
+### M1 — A2 + A3: resolve once, skip when there is nothing to find
+
+Baseline attribution for every row below: measured in this run, against this tree, with the
+pre-M1 tree at `053fb1f25` on branch `WT-security-scan-surface`. Redirected output is under
+`.moai/state/verify/t217/`.
+
+**RED evidence (captured before any implementation, `.moai/state/verify/t217/red.txt`)** — the
+new criteria could not compile against the untouched tree, which is what makes the M1 seams
+falsifiably test-first:
+
+```
+internal/hook/security/coverage_test.go:88:27: NewRuleManager().ResolveCoverage undefined (type RuleManager has no field or method ResolveCoverage)
+internal/hook/pre_tool_scan_config_test.go:139:75: undefined: security.LanguageCoverage
+internal/hook/pre_tool_scan_config_test.go:164:75: unknown field Rules in struct literal of type security.ScannerConfig
+internal/hook/pre_tool_scan_config_test.go:165:41: unknown field rules in struct literal of type preToolHandler
+FAIL	github.com/modu-ai/moai-adk/internal/hook [build failed]
+FAIL	github.com/modu-ai/moai-adk/internal/hook/security [build failed]
+```
+
+| AC | Status | Verification command | Actual output |
+|---|---|---|---|
+| AC-SSS-001 | PASS | `go test ./internal/hook/ -run TestScanWriteContentDifferential -count=1 -v` | `--- PASS: TestScanWriteContentDifferential (0.18s)` — ran, not skipped: all five denying fixtures still deny (`error_count=1` for `sample.go`, `digest.go`, `run.js`, `run.ts`, `run.py`), the warning-only fixture still allows. Assertion (ii) does not compile before M2 and is not claimed. Test file unmodified — absent from `git status --short` |
+| AC-SSS-002 | PASS | `go test ./internal/hook/ -run TestScanWriteContentNoConfigNoScan -count=1 -v` | `--- PASS: TestScanWriteContentNoConfigNoScan (0.00s)` — fake records 0 `ScanFile` calls, decision allow |
+| AC-SSS-003 | PASS | `go test ./internal/hook/ -run TestScanWriteContentNoConfigNoTempFile -count=1 -v` | `--- PASS` both arms: `no_config_creates_no_temp_file` (no new `moai-security-scan-*`) and the control `resolvable_config_creates_exactly_one_temp_file` (exactly 1, snapshotted **during** the call from inside the fake, since the deferred cleanup removes it before return) |
+| AC-SSS-004 | PASS | `go test ./internal/hook/ -run TestConfigResolvedByCallerNotScanner -count=1 -v` | `--- PASS: TestConfigResolvedByCallerNotScanner (0.04s)` — scanner-side `FindRulesConfig` counter 0, caller-side resolution counter 1. Both halves counted; the counters invert against the pre-implementation tree (scanner-side 1, caller-side 0). Corroborating grep of the non-test tree: the only remaining `FindRulesConfig` call sites are `coverage.go:74` (the caller-side resolver) and `scanner.go:123`, which is inside `ScanFiles` (**plural**) — not the pre-write path. `ScanFile` performs zero resolutions |
+| AC-SSS-005 | PASS | `go test ./internal/hook/ -run TestScanWriteContentUncoveredLanguage -count=1 -v` | `--- PASS` for all 11 uncovered extensions (`.rs .java .kt .c .cpp .rb .php .swift .cs .ex .scala`), 0 `ScanFile` calls each, plus `control_sample.go` recording 1 |
+| AC-SSS-006 | PASS | `go test ./internal/hook/security/ -run TestCoveredLanguagesFollowConfig -count=1 -v` **and** `go test ./internal/hook/ -run TestScanWriteContentCoveredLanguageFollowsConfig -count=1 -v` | `--- PASS` both. Derivation half: the shipped ruleset covers `go`; a copy whose `ruleDirs` names only a python-rule directory does not. Scan-count half: 1 call vs 0 across the same two arms — the split no hardcoded language list can produce. See the note below on the criterion's cited package |
+| AC-SSS-007 | PASS | `go test ./internal/hook/security/ -run TestUnreadableOrEmptyConfigEscalates -count=1 -v` **and** `go test ./internal/hook/ -run TestScanWriteContentUnreadableConfigEscalates -count=1 -v` | `--- PASS` all three arms in both (malformed YAML / missing `ruleDir` / rule files declaring no `language:`): derivation reports UNKNOWN, and the gate dispatches **1** `ScanFile` call in every case. Behaviour-preservation criterion — PASS value equals today's value by design |
+
+**Note on AC-SSS-006 / AC-SSS-007's cited command.** Both criteria name
+`go test ./internal/hook/security/`, but their stated instrument (the counting fake + a
+`scanWriteContent` call) lives in `internal/hook`; the two cannot be satisfied by one package.
+Each is therefore closed by a pair: the derivation assertion in the package that owns it, and the
+scan-count assertion in the package that owns the gate. Both commands above run and pass. This is
+a criterion-authoring inconsistency, recorded rather than silently resolved.
+
+**Deliverables.**
+
+- `internal/hook/security/coverage.go` (new) — `LanguageCoverage` + `ruleManager.ResolveCoverage`.
+  Three distinguishable states: no config resolved / resolved-but-unknown /
```

**File**: `.moai/specs/SPEC-SEC-SCAN-SURFACE-001/spec.md` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 id: SPEC-SEC-SCAN-SURFACE-001
 title: Security scan surface — cheap pre-write ast-grep gate + PostToolUse guardian merge
 version: 0.3.0
-status: draft
+status: in-progress
 created: 2026-08-24
 updated: 2026-08-24
 author: manager-spec
```

**File**: `internal/cli/deps.go` (modified, +6/-0)
```diff
@@ -242,6 +242,12 @@ func InitDependencies() {
 	secPolicy.MergeExtraPatterns(security.LoadExtraSecurityConfig(cwd))
 	deps.HookRegistry.Register(hook.NewPreToolHandlerWithScanner(deps.Config, secPolicy, securityScanner))
 	deps.HookRegistry.Register(hook.NewPostToolHandlerWithMxValidatorAndTimeout(diagnosticsCollector, astAnalyzer, cwd, 500*time.Millisecond))
+	// The regex security guardian runs in this process alongside the post-tool
+	// handler; the registry accumulates its additionalContext next to the
+	// post-tool handler's systemMessage, so neither advisory is dropped. It
+	// replaces the separate handle-security-scan.sh PostToolUse entry — the
+	// `moai hook security-scan` subcommand it fronted stays registered.
+	deps.HookRegistry.Register(hook.NewPostToolGuardianHandler())
 	deps.HookRegistry.Register(hook.NewCompactHandler())
 	deps.HookRegistry.Register(hook.NewPostToolUseFailureHandler())
 	deps.HookRegistry.Register(hook.NewNotificationHandlerWithConfig(deps.Config))
```

**File**: `internal/cli/hook_e2e_test.go` (modified, +6/-3)
```diff
@@ -429,10 +429,13 @@ func TestHookDepsWiring_HandlerCounts(t *testing.T) {
 		t.Errorf("event %q: got %d handlers, want 1", hook.EventPreToolUse, len(preToolHandlers))
 	}
 
-	// PostToolUse should have exactly 1 handler.
+	// PostToolUse should have exactly 2 handlers: the post-tool handler
+	// (metrics, LSP diagnostics, MX validation) and the in-process security
+	// guardian, which replaced the separate handle-security-scan.sh entry.
 	postToolHandlers := deps.HookRegistry.Handlers(hook.EventPostToolUse)
-	if len(postToolHandlers) != 1 {
-		t.Errorf("event %q: got %d handlers, want 1", hook.EventPostToolUse, len(postToolHandlers))
+	if len(postToolHandlers) != 2 {
+		t.Errorf("event %q: got %d handlers, want 2 (post-tool + security guardian)",
+			hook.EventPostToolUse, len(postToolHandlers))
 	}
 }
 
```

**File**: `internal/hook/post_tool_guardian.go` (added, +85/-0)
```diff
@@ -0,0 +1,85 @@
+package hook
+
+import (
+	"context"
+	"log/slog"
+
+	"github.com/modu-ai/moai-adk/internal/hook/security"
+)
+
+// postToolGuardianHandler runs the regex security guardian's buffer scan inside
+// the post-tool handler's own process for Write / Edit / MultiEdit events,
+// replacing the separate `moai hook security-scan` subprocess the settings
+// PostToolUse matcher used to spawn. The subcommand itself is retained for user
+// projects whose settings still name it.
+//
+// The handler is advisory-only: it emits the guardian banner and findings on
+// hookSpecificOutput.additionalContext and never a decision, never a non-zero
+// exit. Carrying the advisory on additionalContext — rather than folding it into
+// systemMessage, which the post-tool handler already owns — is what lets the
+// registry's mergeHandlerOutput keep both advisories on a single event.
+//
+// @MX:ANCHOR: [AUTO] postToolGuardianHandler is the in-process PostToolUse guardian, registered alongside the post-tool handler in internal/cli/deps.go.
+// @MX:REASON: [AUTO] fan_in >= 3 — deps.go registration, the merge regression test, and the registry always-run tail all depend on its advisory-only contract.
+type postToolGuardianHandler struct{}
+
+// NewPostToolGuardianHandler creates the in-process PostToolUse security
+// guardian handler.
+func NewPostToolGuardianHandler() Handler {
+	return &postToolGuardianHandler{}
+}
+
+// EventType returns EventPostToolUse.
+func (h *postToolGuardianHandler) EventType() EventType {
+	return EventPostToolUse
+}
+
+// AlwaysRun marks the guardian as reachable even when a preceding handler
+// short-circuits Dispatch. A future PostToolUse handler that blocks must not be
+// able to silently mute the security scan.
+func (h *postToolGuardianHandler) AlwaysRun() bool {
+	return true
+}
+
+// Handle scans the written content and returns the guardian advisory, or nil
+// when there is nothing to say. Every path is fail-open: a payload the scanner
+// cannot read yields a silent nil, never an error.
+//
+// The dispatch context carries the registry's hook deadline. An already-expired
+// context yields a silent nil rather than a scan, so the guardian cannot run on
+// past the budget the registry allotted it; that is the same fail-open shape as
+// an unreadable payload, and never an error.
+func (h *postToolGuardianHandler) Handle(ctx context.Context, input *HookInput) (*HookOutput, error) {
+	if input == nil {
+		return nil, nil
+	}
+	if ctx != nil && ctx.Err() != nil {
+		return nil, nil
+	}
+	switch input.ToolName {
+	case "Write", "Edit", "MultiEdit":
+	default:
+		return nil, nil
+	}
+
+	content := security.ExtractToolInputContent(input.ToolInput)
+	if content == "" {
+		return nil, nil
+	}
+	advisory := security.ScanBufferAdvisory(content)
+	if advisory == "" {
+		return nil, nil
+	}
+
+	slog.Debug("security guardian finding surfaced",
+		"tool_name", input.ToolName,
+		"session_id", input.SessionID,
+	)
+
+	return &HookOutput{
+		HookSpecificOutput: &HookSpecificOutput{
+			HookEventName:     "PostToolUse",
+			AdditionalContext: advisory,
+		},
+	}, nil
+}
```

**File**: `internal/hook/post_tool_guardian_test.go` (added, +227/-0)
```diff
@@ -0,0 +1,227 @@
+package hook
+
+import (
+	"bytes"
+	"context"
+	"encoding/json"
+	"strings"
+	"testing"
+
+	"github.com/modu-ai/moai-adk/internal/hook/security"
+)
+
+// guardianPayload is a Write tool_input whose content trips the guardian's
+// critical-severity hardcoded-secret class.
+const guardianPayload = `{"content":"api_key = \"sk-live-abcdef0123456789\"","file_path":"a.py"}`
+
+// guardianStandaloneEnvelope wraps guardianPayload in the PostToolUse envelope
+// HandleSecurityScan reads from stdin.
+const guardianStandaloneEnvelope = `{"tool_name":"Write","tool_input":` + guardianPayload + `}`
+
+func guardianInput() *HookInput {
+	return &HookInput{
+		ToolName:  "Write",
+		ToolInput: json.RawMessage(guardianPayload),
+		SessionID: "test-session",
+	}
+}
+
+// standaloneAdditionalContext runs HandleSecurityScan directly and returns the
+// additionalContext string it emits.
+func standaloneAdditionalContext(t *testing.T) string {
+	t.Helper()
+	var out bytes.Buffer
+	if err := security.HandleSecurityScan(nil, strings.NewReader(guardianStandaloneEnvelope), &out, t.TempDir()); err != nil {
+		t.Fatalf("HandleSecurityScan returned error: %v", err)
+	}
+	var m struct {
+		HookSpecificOutput struct {
+			AdditionalContext string `json:"additionalContext"`
+		} `json:"hookSpecificOutput"`
+	}
+	if err := json.Unmarshal(bytes.TrimSpace(out.Bytes()), &m); err != nil {
+		t.Fatalf("standalone output is not valid JSON: %q (%v)", out.String(), err)
+	}
+	if m.HookSpecificOutput.AdditionalContext == "" {
+		t.Fatalf("standalone handler produced no additionalContext for %q", guardianStandaloneEnvelope)
+	}
+	return m.HookSpecificOutput.AdditionalContext
+}
+
+// TestPostToolGuardianMergeKeepsBothAdvisories — AC-SSS-012.
+// Both the post-tool handler's systemMessage and the guardian's
+// additionalContext survive a single dispatch, and a preceding handler's block
+// decision does not prevent the guardian scan from being reached (spec §A.3).
+func TestPostToolGuardianMergeKeepsBothAdvisories(t *testing.T) {
+	t.Parallel()
+
+	const postToolText = "post-tool advisory: 1 lint error"
+
+	t.Run("both advisories survive the merge", func(t *testing.T) {
+		reg := NewRegistry(&mockConfigProvider{cfg: newTestConfig()})
+		reg.Register(&mockHandler{
+			event:  EventPostToolUse,
+			output: &HookOutput{SystemMessage: postToolText},
+		})
+		reg.Register(NewPostToolGuardianHandler())
+
+		out, err := reg.Dispatch(context.Background(), EventPostToolUse, guardianInput())
+		if err != nil {
+			t.Fatalf("Dispatch error: %v", err)
+		}
+		if out.SystemMessage != postToolText {
+			t.Errorf("systemMessage lost or overwritten: got %q, want %q", out.SystemMessage, postToolText)
+		}
+		if out.HookSpecificOutput == nil || out.HookSpecificOutput.AdditionalContext == "" {
+			t.Fatalf("guardian additionalContext dropped: %+v", out.HookSpecificOutput)
+		}
+		ac := out.HookSpecificOutput.AdditionalContext
+		if !strings.Contains(ac, "hardcoded-secret") {
+			t.Errorf("additionalContext does not carry the guardian finding: %q", ac)
+		}
+		if strings.Contains(ac, postToolText) {
+			t.Errorf("additionalContext contains the post-tool text: %q", ac)
+		}
+		if strings.Contains(out.SystemMessage, ac) {
+			t.Errorf("systemMessage contains the guardian text: %q", out.SystemMessage)
+		}
+	})
+
+	t.Run("a preceding block does not short-circuit the guardian", func(t *testing.T) {
+		reg := NewRegistry(&mockConfigProvider{cfg: newTestConfig()})
+		reg.Register(&mockHandler{
+			event:  EventPostToolUse,
+			output: &HookOutput{Decision: DecisionBlock, Reason: "blocked by an earlier handler"},
+		})
+		reg.Register(NewPostToolGuardianHandler())
+
+		out, err := reg.Dispatch(context.Background(), EventPostToolUse, guardianInput())
+		if err != nil {
+			t.Fatalf("Dispatch error: %v", err)
+		}
+		if out.Decision != DecisionBlock {
+			t.Errorf("the preceding handler's block decision must survive: %+v", out)
+		}
+		if out.HookSpecificOutput == nil || out.HookSpecificOutput.AdditionalContext == "" {
+			t.Fatalf("guardian scan was short-circuited by the preceding block: %+v", out)
+		}
+	})
+}
+
+// TestMergedGuardianTextMatchesStandalone — AC-SSS-013. The merged handler's
+// additionalContext is byte-identical to what HandleSecurityScan emits.
+func TestMergedGuardianTextMatchesStandalone(t *testing.T) {
+	t.Parallel()
+
+	want := standaloneAdditionalContext(t)
+
+	out, err := NewPostToolGuardianHandler().Handle(context.Background(), guardianInput())
+	if err != nil {
+		t.Fatalf("guardian handler returned error: %v", err)
+	}
+	if out == nil || out.HookSpecificOutput == nil {
+		t.Fatalf("guardian handler produced no output for a finding-bearing payload")
+	}
+	if got := out.HookSpecificOutput.AdditionalContext; got != want {
+		t.Errorf("advisory text changed by the merge:\n got: %q\nwant: %q", got, want)
+	}
+}
+
+// TestMergedGuardianNeverBlocks — AC-SSS-014. The guardian introduces no
+// decision, no permissionDecision, no conti
```

---

### Incident Patch 10: `600ecad7` (2026-08-24)
**Commit Message**: fix(statusline): put the ahead/behind commit counts back on the branch

How many commits the local branch holds that its upstream does not, and the
reverse, were rendered on the branch as ↑N/↓N until a layout change moved them
to a slash pair on the repo, and a later one reassigned that pair to open issues
and open PRs. The counts stayed collected on GitStatusData and stopped being
rendered anywhere — the renderer referenced neither field. The operator asks for
them back.

The constraint the removal was protecting is real and is kept: only one
number/number pair may appear on the line, because "59/0" sitting beside "1/1"
was read as issues-over-PRs. Arrows are not a slash pair, so ↑59 ↓7 restores the
counts without reintroducing that ambiguity — which is why the original form,
not the pair, is what returns. Each arrow is omitted at zero, so a synced branch
stays quiet, and the arrows precede the "+N" dirty tail: committed history
first, uncommitted work after.

This reverses a recorded decision ("operator decision, tradeoff accepted"), so
the two tests that encoded it are updated rather than deleted, and each keeps
asserting the half that still holds — that ahead/behind must never 

**File**: `internal/statusline/github_test.go` (modified, +7/-8)
```diff
@@ -209,16 +209,15 @@ func TestRender_ForgePairIsIssuesOverPRs(t *testing.T) {
 	}
 
 	seg := newTestRenderer().renderRepoBranchSegment(data)
-	if want := "📡 modu-ai/moai-adk, 1/1 | 🅱️ main"; seg != want {
+	if want := "📡 modu-ai/moai-adk, 1/1 | 🅱️ main ↑59 ↓7"; seg != want {
 		t.Errorf("repo segment = %q, want %q", seg, want)
 	}
 
-	// Ahead/behind must not reach the bar in any form — not as the pair it
-	// used to be, and not as the ↑N/↓N arrows it was before that.
-	for _, gone := range []string{"59", "7", "↑", "↓"} {
-		if strings.Contains(seg, gone) {
-			t.Errorf("ahead/behind leaked into the segment as %q: %q", gone, seg)
-		}
+	// Ahead/behind is back on the branch (operator request) in the ↑N/↓N arrow
+	// form it carried before the pair. What must NOT return is the slash-pair
+	// spelling: "59/0" beside "1/1" is the misread this whole test guards.
+	if strings.Contains(seg, "59/7") || strings.Contains(seg, "59/0") {
+		t.Errorf("ahead/behind rendered as a slash pair: %q", seg)
 	}
 
 	// Exactly one number/number pair on the line. (owner/name is not a number
@@ -231,7 +230,7 @@ func TestRender_ForgePairIsIssuesOverPRs(t *testing.T) {
 	// full render.
 	data.Git.Modified = 3
 	full := newTestRenderer().Render(data, ModeDefault)
-	if want := "📡 modu-ai/moai-adk, 1/1 | 🅱️ main +3"; !strings.Contains(full, want) {
+	if want := "📡 modu-ai/moai-adk, 1/1 | 🅱️ main ↑59 ↓7 +3"; !strings.Contains(full, want) {
 		t.Errorf("full render must contain %q, got %q", want, full)
 	}
 }
```

**File**: `internal/statusline/renderer.go` (modified, +23/-8)
```diff
@@ -542,16 +542,17 @@ func (r *Renderer) isPREnabled() bool {
 //
 // Only one number/number pair may appear on the line: two of them side by
 // side is what produced the 2026-08-18 misread of the branch's "59/0" as
-// issues over pull requests. The pair therefore carries the counts an
-// operator actually reads off a status bar, and ahead/behind is not rendered
-// anywhere — the data is still collected on GitStatusData, it simply has no
-// slot on the bar.
+// issues over pull requests. The slash pair therefore belongs to the forge
+// counts alone. Ahead/behind returns to the branch in its original arrow form
+// (↑N ↓N) — arrows are not a slash pair, so the counts are readable again
+// without reintroducing the ambiguity the removal was protecting against.
 //
 // Behavior:
-//   - Workspace.Repo present + Branch present: "📡 owner/name, issues/PRs | 🅱️ branch +N"
+//   - Workspace.Repo present + Branch present: "📡 owner/name, issues/PRs | 🅱️ branch ↑A ↓B +N"
 //   - forge pair: see renderForgePair (zeros shown; unknown is "-/-"; gated segment omits it)
-//   - Workspace.Repo nil or incomplete:        "🅱️ branch +N" (forge half withheld, branch kept)
+//   - Workspace.Repo nil or incomplete:        "🅱️ branch ↑A ↓B +N" (forge half withheld, branch kept)
 //   - Branch empty:                            "" (empty — no git context)
+//   - Ahead / Behind == 0:                      the corresponding arrow omitted
 //   - Dirty (Modified + Staged + Untracked) == 0: " +N" portion omitted
 //   - Worktree active:                          "[WT] " prefix prepended to branch
 //
@@ -564,7 +565,8 @@ func (r *Renderer) isPREnabled() bool {
 // @MX:NOTE: [AUTO] layout v3 CH3 — the sole renderer of the repo+branch line.
 // @MX:NOTE: [AUTO] Hide the FORGE half when remote repo info is missing (per user request 2026-05-22 — written when this segment carried repo identity alone).
 // @MX:NOTE: [AUTO] 2026-08-18 merge — GitHub counts moved here from renderSessionLine; ahead/behind demoted from ↑N/↓N arrows on the branch to an always-on "a/b" pair on the repo.
-// @MX:NOTE: [AUTO] 2026-08-20 — the slash pair now carries open issues / open PRs; ahead/behind is no longer rendered (operator decision, tradeoff accepted).
+// @MX:NOTE: [AUTO] 2026-08-20 — the slash pair carries open issues / open PRs.
+// @MX:NOTE: [AUTO] ahead/behind restored on the branch as ↑N ↓N (arrows, not a slash pair) per operator request — the counts had been collected but rendered nowhere.
 func (r *Renderer) renderRepoBranchSegment(data *StatusData) string {
 	if data == nil || !data.Git.Available || data.Git.Branch == "" {
 		return ""
@@ -579,7 +581,20 @@ func (r *Renderer) renderRepoBranchSegment(data *StatusData) string {
 	}
 	branch = "🅱️ " + branch
 
-	// Dirty count (omitted when 0)
+	// Ahead/behind: commits this branch holds that its upstream does not, and the
+	// reverse. Rendered as arrows rather than a slash pair — the line already
+	// carries one "N/N" (the forge counts), and a second one is what produced the
+	// misread that took these counts off the bar. Each arrow is omitted at zero, so
+	// a synced branch stays quiet.
+	if data.Git.Ahead > 0 {
+		branch += fmt.Sprintf(" ↑%d", data.Git.Ahead)
+	}
+	if data.Git.Behind > 0 {
+		branch += fmt.Sprintf(" ↓%d", data.Git.Behind)
+	}
+
+	// Dirty count (omitted when 0). Follows the arrows: committed history first,
+	// then uncommitted work.
 	dirty := data.Git.Modified + data.Git.Staged + data.Git.Untracked
 	if dirty > 0 {
 		branch += fmt.Sprintf(" +%d", dirty)
```

**File**: `internal/statusline/renderer_test.go` (modified, +8/-7)
```diff
@@ -877,16 +877,17 @@ func TestRenderDefaultV3_Line3(t *testing.T) {
 	}
 	// Layout v3 CH3 (2026-05-22 fix, 2026-08-18 merge, 2026-08-20 pair
 	// reassignment): combined repo+branch segment, "📡 owner/name, issues/PRs
-	// | 🅱️ branch +N" (pipe separator, repo prefix required). dirty =
+	// | 🅱️ branch ↑A ↓B +N" (pipe separator, repo prefix required). dirty =
 	// Staged(3) + Modified(2) + Untracked(1) = 6; the forge counts ride the
-	// repo part where ahead/behind used to.
-	if !strings.Contains(l3, "📡 modu-ai/moai-adk, 4/2 | 🅱️ feat/auth +6") {
+	// repo part, and Ahead=2 / Behind=1 ride the branch as arrows.
+	if !strings.Contains(l3, "📡 modu-ai/moai-adk, 4/2 | 🅱️ feat/auth ↑2 ↓1 +6") {
 		t.Errorf("default L3 must contain combined repo_branch segment with pipe separator, got: %q", l3)
 	}
-	// Ahead=2 / Behind=1 are still carried on GitStatusData but must not reach
-	// the line in any form.
-	if strings.Contains(l3, "2/1") || strings.Contains(l3, "↑") || strings.Contains(l3, "↓") {
-		t.Errorf("ahead/behind must not render on L3, got: %q", l3)
+	// Ahead/behind is back on the branch as arrows (operator request), but the
+	// slash pair still belongs to the forge counts alone — a second number pair
+	// is the misread the arrow form exists to avoid.
+	if strings.Contains(l3, "2/1") {
+		t.Errorf("ahead/behind must not render as a slash pair on L3, got: %q", l3)
 	}
 	if strings.Contains(l3, "📦") || strings.Contains(l3, "🔨") {
 		t.Errorf("default L3 must not contain legacy 📦/🔨 prefix, got: %q", l3)
```

**File**: `internal/statusline/repo_branch_segment_test.go` (modified, +89/-1)
```diff
@@ -1,6 +1,10 @@
 package statusline
 
-import "testing"
+import (
+	"regexp"
+	"strings"
+	"testing"
+)
 
 // The branch half of the L3 repo+branch segment comes from local git and is
 // available inside any repository. The forge half (📡 owner/name) comes from the
@@ -105,6 +109,90 @@ func TestRenderRepoBranchSegment_DirtyCountSumsAllThreeCategories(t *testing.T)
 	}
 }
 
+// Ahead/behind — how many commits the local branch holds that the remote does
+// not, and vice versa — is collected on GitStatusData and was rendered on the
+// branch as ↑N/↓N until a layout change moved it to a slash pair on the repo,
+// and a later one reassigned that pair to open issues / open PRs, leaving the
+// counts collected but rendered nowhere.
+//
+// The constraint that removal was protecting is real and is preserved here: only
+// ONE number/number pair may appear on the line, because two slash pairs side by
+// side were misread. Arrows are not a slash pair, so ↑3 ↓1 restores the counts
+// without reintroducing the ambiguity.
+
+// TestRenderRepoBranchSegment_AheadBehindRendersAsArrows pins the restored form.
+func TestRenderRepoBranchSegment_AheadBehindRendersAsArrows(t *testing.T) {
+	t.Parallel()
+
+	cases := []struct {
+		name          string
+		ahead, behind int
+		want          string
+	}{
+		{"ahead only", 3, 0, "🅱️ main ↑3"},
+		{"behind only", 0, 259, "🅱️ main ↓259"},
+		{"both", 1, 259, "🅱️ main ↑1 ↓259"},
+		{"synced — no arrows", 0, 0, "🅱️ main"},
+	}
+	for _, tc := range cases {
+		d := &StatusData{Git: GitStatusData{
+			Branch:    "main",
+			Available: true,
+			Ahead:     tc.ahead,
+			Behind:    tc.behind,
+		}}
+		if got := newTestRenderer().renderRepoBranchSegment(d); got != tc.want {
+			t.Errorf("%s = %q, want %q", tc.name, got, tc.want)
+		}
+	}
+}
+
+// TestRenderRepoBranchSegment_ArrowsPrecedeDirtyCount pins the ordering: the
+// arrows describe committed history, the "+N" tail describes uncommitted work, and
+// they read left to right in that order.
+func TestRenderRepoBranchSegment_ArrowsPrecedeDirtyCount(t *testing.T) {
+	t.Parallel()
+
+	d := repoBranchFixture() // 7 modified + 21 untracked
+	d.Git.Ahead = 1
+	d.Git.Behind = 259
+
+	const want = "🅱️ main ↑1 ↓259 +28"
+	if got := newTestRenderer().renderRepoBranchSegment(d); got != want {
+		t.Errorf("no repo = %q, want %q", got, want)
+	}
+
+	d.Workspace = WorkspaceData{Repo: &RepoInfo{Host: "github.com", Owner: "modu-ai", Name: "moai-adk"}}
+	d.GitHub = GitHubCounts{OpenIssues: 9, OpenPRs: 4, Available: true}
+	const wantFull = "📡 modu-ai/moai-adk, 9/4 | 🅱️ main ↑1 ↓259 +28"
+	if got := newTestRenderer().renderRepoBranchSegment(d); got != wantFull {
+		t.Errorf("with repo = %q, want %q", got, wantFull)
+	}
+}
+
+// TestRenderRepoBranchSegment_OnlyOneSlashPair is the guard for the constraint the
+// earlier removal was protecting: the forge counts are the line's only "N/N", so
+// restoring ahead/behind must not add a second one.
+func TestRenderRepoBranchSegment_OnlyOneSlashPair(t *testing.T) {
+	t.Parallel()
+
+	d := repoBranchFixture()
+	d.Git.Ahead = 59
+	d.Git.Behind = 0
+	d.Workspace = WorkspaceData{Repo: &RepoInfo{Host: "github.com", Owner: "modu-ai", Name: "moai-adk"}}
+	d.GitHub = GitHubCounts{OpenIssues: 9, OpenPRs: 4, Available: true}
+
+	got := newTestRenderer().renderRepoBranchSegment(d)
+	// The owner/name slash is not a number pair; only "N/N" reads as counts.
+	pairs := regexp.MustCompile(`\d+/\d+`).FindAllString(got, -1)
+	if len(pairs) != 1 {
+		t.Errorf("segment %q carries number pairs %v, want exactly 1 (the forge counts)", got, pairs)
+	}
+	if strings.Contains(got, "59/0") {
+		t.Errorf("segment %q renders ahead/behind as a slash pair — the misread this guards against", got)
+	}
+}
+
 // TestRenderRepoBranchSegment_NoGitContextStaysEmpty pins the two conditions that
 // legitimately hide the whole segment: no repository, and no branch to name.
 func TestRenderRepoBranchSegment_NoGitContextStaysEmpty(t *testing.T) {
```

---

### Incident Patch 11: `8f905f33` (2026-08-24)
**Commit Message**: fix(workflows): make the scanned workflow directory parse clean

Every .js directly inside .claude/workflows/ is parsed as a workflow at scan
time, and a scan runs on each skill reload — which PostToolUse triggers on file
edits, so a heavy editing session re-parsed these two files hundreds of times
and logged a warning for each. Inside a worktree both trees are scanned, so the
warning count doubles.

lsel-drain-loop.js carried no `export const meta` at all, so it was skipped on
every scan and was never a registered recipe — despite AC-LSEL-007 recording it
as registered. Give it meta as the first statement. Its body still only prints
the commands it describes rather than running them; that gap is untouched here.

sync-audit-4dim.test.js is a node:test harness, not a workflow, and could never
satisfy the meta rule. Move it to .claude/workflows/tests/, which the scanner
does not descend into (verified by probe: a deliberately invalid script in a
subdirectory drew no warning while the two top-level files still did). Its
sibling-path read is adjusted one level up.

Running that test after the move surfaced a separate, pre-existing condition:
the sentinel pair it extracts is no longer p

**File**: `.claude/workflows/lsel-drain-loop.js` (modified, +14/-0)
```diff
@@ -14,6 +14,20 @@
 // does NOT apply anything (M3). Proposal drafting from clusters.json is an
 // on-demand model-mediated step, not a scheduled one.
 
+// The runtime requires `export const meta` to be the FIRST statement in the
+// script; a file in this directory without it is skipped at scan time with a
+// warning, which is how this recipe went unregistered despite AC-LSEL-007
+// recording it as registered. Keep meta first — comments above it are fine,
+// executable statements are not.
+export const meta = {
+	name: 'lsel-drain-loop',
+	description: 'Read-only LSEL drain trigger: advisory backlog check, mechanical drain, candidate count',
+	whenToUse: 'Scheduled via /loop on an interval. Read-only — never commits, pushes, or enters run-phase.',
+	phases: [
+		{ title: 'Drain', detail: 'backlog check + mechanical inbox drain, then report candidate count' },
+	],
+}
+
 // cadence-bridge invariant: this recipe is READ-ONLY. No commit, no push, no
 // run-phase entry. If a future edit adds a write, it violates the bridge.
 const INBOX = ".moai/lessons-inbox.jsonl";
```

**File**: `.claude/workflows/tests/sync-audit-4dim.test.js` (renamed, +15/-2)
```diff
@@ -17,7 +17,16 @@
 //   uses import/require). The production sync-audit-4dim.js contains NO eval / new Function /
 //   Math.random / Date.now — the verdict path is deterministic and resume-cache safe.
 //
-// Run: `node --test .claude/workflows/sync-audit-4dim.test.js`
+// Run: `node --test .claude/workflows/tests/sync-audit-4dim.test.js`
+//
+// STATUS 2026-08-24: this test does not currently run to completion. The
+// sentinel pair it extracts — `// === VERDICT PURE FUNCTIONS START/END ===` —
+// is no longer present anywhere in sync-audit-4dim.js, so the extraction
+// assertion fails before any subtest executes. The condition predates this
+// file's move out of the scanned workflow directory and is unrelated to it:
+// either the sentinels are restored around the verdict block in the workflow,
+// or this harness is retired. Left in place pending that decision rather than
+// deleted, so the intent and the 15 subtests are not lost.
 //
 // DEV-ONLY — not mirrored to internal/template/templates/.claude/workflows/ (tests are not a
 // distributed template asset).
@@ -29,7 +38,11 @@ import path from 'node:path'
 import { fileURLToPath } from 'node:url'
 
 const __dirname = path.dirname(fileURLToPath(import.meta.url))
-const workflowSrc = fs.readFileSync(path.join(__dirname, 'sync-audit-4dim.js'), 'utf8')
+// The workflow under test is the parent directory: .claude/workflows/ is a
+// registry the runtime scans, and every .js directly inside it must parse as a
+// workflow. This test is not one, so it lives one level down; the scanner does
+// not recurse (verified 2026-08-24).
+const workflowSrc = fs.readFileSync(path.join(__dirname, '..', 'sync-audit-4dim.js'), 'utf8')
 
 // --- extract the pure-verdict block between sentinel comments -----------------------------
 const START = '// === VERDICT PURE FUNCTIONS START ==='
```

---

### Incident Patch 12: `a3ca0621` (2026-08-24)
**Commit Message**: fix(statusline): keep the branch when the forge half of the segment is missing

The L3 segment renders two things with different availability: the branch,
which comes from local git and exists inside any repository, and the forge
identity, which comes from the optional workspace.repo sub-object on Claude
Code's stdin payload and is absent both on payloads that omit it and on
checkouts with no configured remote.

Layout v3 CH3 merged the two into one renderer. The merged function inherited
a hide-on-missing-repo rule written on 2026-05-22, back when the segment
carried repo identity alone — so after the merge that rule took the branch
down with it. On a payload without workspace.repo the whole segment rendered
empty, and the branch name and the uncommitted-work count disappeared from the
bar with no indication why.

Render the halves independently: a missing forge half now withholds only
itself. A repository with 7 modified and 21 untracked files on main renders
"🅱️ main +28" instead of nothing.

The function had no unit coverage — its own source comment recorded that
coverage was deferred "when the function signature stabilizes", which is how
the regression shipped. Tests now pin 

**File**: `internal/statusline/renderer.go` (modified, +17/-14)
```diff
@@ -550,29 +550,26 @@ func (r *Renderer) isPREnabled() bool {
 // Behavior:
 //   - Workspace.Repo present + Branch present: "📡 owner/name, issues/PRs | 🅱️ branch +N"
 //   - forge pair: see renderForgePair (zeros shown; unknown is "-/-"; gated segment omits it)
-//   - Workspace.Repo nil or incomplete:        "" (segment hidden — no git remote context)
+//   - Workspace.Repo nil or incomplete:        "🅱️ branch +N" (forge half withheld, branch kept)
 //   - Branch empty:                            "" (empty — no git context)
 //   - Dirty (Modified + Staged + Untracked) == 0: " +N" portion omitted
 //   - Worktree active:                          "[WT] " prefix prepended to branch
 //
+// The two halves have different availability. The branch comes from local git and
+// exists inside any repository; the forge identity comes from the optional
+// workspace.repo sub-object on Claude Code's stdin, absent both on payloads that
+// omit it and on checkouts with no configured remote. They are therefore rendered
+// independently: a missing forge half withholds only itself.
+//
 // @MX:NOTE: [AUTO] layout v3 CH3 — the sole renderer of the repo+branch line.
-// @MX:NOTE: [AUTO] Hide entire segment when git is uninitialized or remote repo info is missing (per user request 2026-05-22).
+// @MX:NOTE: [AUTO] Hide the FORGE half when remote repo info is missing (per user request 2026-05-22 — written when this segment carried repo identity alone).
 // @MX:NOTE: [AUTO] 2026-08-18 merge — GitHub counts moved here from renderSessionLine; ahead/behind demoted from ↑N/↓N arrows on the branch to an always-on "a/b" pair on the repo.
 // @MX:NOTE: [AUTO] 2026-08-20 — the slash pair now carries open issues / open PRs; ahead/behind is no longer rendered (operator decision, tradeoff accepted).
 func (r *Renderer) renderRepoBranchSegment(data *StatusData) string {
 	if data == nil || !data.Git.Available || data.Git.Branch == "" {
 		return ""
 	}
 
-	// Hide segment when repo info is missing (git uninitialized or remote not configured).
-	if data.Workspace.Repo == nil {
-		return ""
-	}
-	repo := data.Workspace.Repo
-	if repo.Owner == "" || repo.Name == "" {
-		return ""
-	}
-
 	// Worktree marker rides between the branch glyph and the branch name
 	// (operator request 2026-08-18): "🅱️ [WT] release/v3.1.1", not a leading
 	// prefix that separates the glyph from the branch it marks.
@@ -584,14 +581,20 @@ func (r *Renderer) renderRepoBranchSegment(data *StatusData) string {
 
 	// Dirty count (omitted when 0)
 	dirty := data.Git.Modified + data.Git.Staged + data.Git.Untracked
-	var dirtySuffix string
 	if dirty > 0 {
-		dirtySuffix = fmt.Sprintf(" +%d", dirty)
+		branch += fmt.Sprintf(" +%d", dirty)
+	}
+
+	// Withhold the forge half when repo info is missing (no remote configured, or
+	// a stdin payload that carries no workspace.repo). The branch stands alone.
+	repo := data.Workspace.Repo
+	if repo == nil || repo.Owner == "" || repo.Name == "" {
+		return branch
 	}
 
 	repoPart := fmt.Sprintf("📡 %s/%s", repo.Owner, repo.Name) + r.renderForgePair(data)
 
-	return repoPart + " | " + branch + dirtySuffix
+	return repoPart + " | " + branch
 }
 
 // renderForgePair renders the repo segment's slash pair — open issues over
```

**File**: `internal/statusline/repo_branch_segment_test.go` (added, +143/-0)
```diff
@@ -0,0 +1,143 @@
+package statusline
+
+import "testing"
+
+// The branch half of the L3 repo+branch segment comes from local git and is
+// available inside any repository. The forge half (📡 owner/name) comes from the
+// optional workspace.repo sub-object on Claude Code's stdin payload, which is
+// absent on payloads that do not carry it and on checkouts with no remote.
+//
+// Layout v3 CH3 merged the two into one segment. The segment inherited a
+// hide-on-missing-repo rule written in 2026-05-22, when the segment carried only
+// repo identity — so after the merge that rule silently took the branch down with
+// it. These tests pin the two halves as independently renderable.
+
+func repoBranchFixture() *StatusData {
+	return &StatusData{
+		Git: GitStatusData{
+			Branch:    "main",
+			Available: true,
+			Modified:  7,
+			Untracked: 21,
+		},
+	}
+}
+
+// TestRenderRepoBranchSegment_BranchSurvivesMissingForgeInfo is the regression
+// guard: with no workspace.repo the forge half is correctly withheld, but the
+// branch and its dirty count must still render.
+func TestRenderRepoBranchSegment_BranchSurvivesMissingForgeInfo(t *testing.T) {
+	t.Parallel()
+
+	const want = "🅱️ main +28"
+
+	t.Run("repo absent", func(t *testing.T) {
+		t.Parallel()
+		d := repoBranchFixture()
+		if got := newTestRenderer().renderRepoBranchSegment(d); got != want {
+			t.Errorf("nil repo = %q, want %q", got, want)
+		}
+	})
+
+	t.Run("repo present but incomplete", func(t *testing.T) {
+		t.Parallel()
+		for name, repo := range map[string]*RepoInfo{
+			"no owner": {Host: "github.com", Name: "moai-adk"},
+			"no name":  {Host: "github.com", Owner: "modu-ai"},
+			"empty":    {},
+		} {
+			d := repoBranchFixture()
+			d.Workspace = WorkspaceData{Repo: repo}
+			if got := newTestRenderer().renderRepoBranchSegment(d); got != want {
+				t.Errorf("%s = %q, want %q", name, got, want)
+			}
+		}
+	})
+}
+
+// TestRenderRepoBranchSegment_ForgeHalfStillJoinsWhenPresent pins the unchanged
+// combined form, so restoring the branch does not cost the merged layout.
+func TestRenderRepoBranchSegment_ForgeHalfStillJoinsWhenPresent(t *testing.T) {
+	t.Parallel()
+
+	d := repoBranchFixture()
+	d.Workspace = WorkspaceData{Repo: &RepoInfo{Host: "github.com", Owner: "modu-ai", Name: "moai-adk"}}
+	d.GitHub = GitHubCounts{OpenIssues: 9, OpenPRs: 4, Available: true}
+
+	const want = "📡 modu-ai/moai-adk, 9/4 | 🅱️ main +28"
+	if got := newTestRenderer().renderRepoBranchSegment(d); got != want {
+		t.Errorf("combined = %q, want %q", got, want)
+	}
+}
+
+// TestRenderRepoBranchSegment_DirtySuffixOmittedWhenClean pins that a clean tree
+// carries no "+N" tail, in both the forge-present and forge-absent forms.
+func TestRenderRepoBranchSegment_DirtySuffixOmittedWhenClean(t *testing.T) {
+	t.Parallel()
+
+	clean := &StatusData{Git: GitStatusData{Branch: "main", Available: true}}
+	if got := newTestRenderer().renderRepoBranchSegment(clean); got != "🅱️ main" {
+		t.Errorf("clean, no repo = %q, want %q", got, "🅱️ main")
+	}
+
+	clean.Workspace = WorkspaceData{Repo: &RepoInfo{Host: "github.com", Owner: "modu-ai", Name: "moai-adk"}}
+	clean.GitHub = GitHubCounts{Suppressed: true}
+	if got := newTestRenderer().renderRepoBranchSegment(clean); got != "📡 modu-ai/moai-adk | 🅱️ main" {
+		t.Errorf("clean, with repo = %q", got)
+	}
+}
+
+// TestRenderRepoBranchSegment_DirtyCountSumsAllThreeCategories pins that the
+// "+N" tail counts staged, modified, and untracked together — the number an
+// operator reads as "uncommitted work".
+func TestRenderRepoBranchSegment_DirtyCountSumsAllThreeCategories(t *testing.T) {
+	t.Parallel()
+
+	d := &StatusData{Git: GitStatusData{
+		Branch:    "main",
+		Available: true,
+		Staged:    2,
+		Modified:  3,
+		Untracked: 5,
+	}}
+	if got := newTestRenderer().renderRepoBranchSegment(d); got != "🅱️ main +10" {
+		t.Errorf("dirty sum = %q, want %q", got, "🅱️ main +10")
+	}
+}
+
+// TestRenderRepoBranchSegment_NoGitContextStaysEmpty pins the two conditions that
+// legitimately hide the whole segment: no repository, and no branch to name.
+func TestRenderRepoBranchSegment_NoGitContextStaysEmpty(t *testing.T) {
+	t.Parallel()
+
+	cases := map[string]*StatusData{
+		"nil data":          nil,
+		"git unavailable":   {Git: GitStatusData{Branch: "main", Available: false}},
+		"branch unresolved": {Git: GitStatusData{Branch: "", Available: true}},
+	}
+	for name, d := range cases {
+		if got := newTestRenderer().renderRepoBranchSegment(d); got != "" {
+			t.Errorf("%s = %q, want empty", name, got)
+		}
+	}
+}
+
+// TestRenderRepoBranchSegment_WorktreeMarkerRidesTheBranch pins that the [WT]
+// marker stays attached to the branch when the forge half is absent — the
+// worktree case is precisely where workspace.repo is most often missing.
+func TestRenderRepoBranchSegment_WorktreeMarkerRidesTheBranch(t *testing.T) {
+	t.Parallel()
+
+	d := &StatusData{
+		Git:      GitStatusData{Branch: "WT-mx-fanin-perf", Available: true,
```

---

### Incident Patch 13: `294b4b6a` (2026-08-24)
**Commit Message**: fix(doctor): make the exit code and the constitution row tell the truth (t200) (#1612)

* fix(doctor): make the exit code and the constitution row tell the truth (t200)

`moai doctor` printed `Fail N` and exited 0, so no script, hook, or CI
wrapper could tell a failing run from a clean one. And in the same run its
Constitution Registry row reported `ok — 101 entries` while
`moai constitution validate` reported 67 errors against that same checkout:
the row counted entries and never validated anything.

Both now hold:

- A run with one or more Fail checks returns exit 1 through the existing
  ExitCoder boundary; warn-only runs stay exit 0, since a warning is
  advisory. The decision is split into countFailedChecks/doctorExitStatus
  so the contract is testable without depending on the checkout's health.
- checkConstitution runs the same constitution.Validate that
  `moai constitution validate` runs, and surfaces drift as Fail naming the
  error count and the command to run. MOAI_CONSTITUTION_SKIP_VALIDATE=1
  returns it to the structural verdict.

Two fixtures asserted OK on registries whose clauses were absent from their
source files — genuine drift under the new contract. The claus

**File**: `docs-site/content/en/cli-reference/doctor.md` (modified, +11/-0)
```diff
@@ -50,6 +50,17 @@ When the cleanable estimate exceeds the threshold (a compiled default of 500 MB)
 
 The estimate calls **the same scanner** `moai clean --home` uses, so the number doctor quotes and the list clean actually deletes cannot drift apart. Full detail: [Home Directory Hygiene](/en/advanced/home-hygiene).
 
+## Exit codes
+
+Scripts and CI wrappers calling `moai doctor` read the exit code, not the summary line.
+
+| Exit code | Meaning |
+|-----------|---------|
+| `0` | No failing check. Warnings are advisory and do not change the exit code |
+| `1` | One or more checks failed — the summary's `Fail N` carried through |
+
+The Constitution Registry check does more than confirm the registry parses: it runs the **same drift validation** as `moai constitution validate`. Doctor therefore cannot report ok on a checkout where validate fails. Bypassing with `MOAI_CONSTITUTION_SKIP_VALIDATE=1` returns doctor to its structural verdict.
+
 ## Examples
 
 ```bash
```

**File**: `docs-site/content/ja/cli-reference/doctor.md` (modified, +11/-0)
```diff
@@ -50,6 +50,17 @@ moai doctor [OPTIONS]
 
 この推定値は `moai clean --home` が使うのと**同じスキャナ**を呼ぶので、doctor が言う数字と clean が実際に削除する一覧がずれることはありません。詳細は [ホームディレクトリ衛生](/ja/advanced/home-hygiene) にあります。
 
+## 終了コード
+
+スクリプトや CI ラッパーが `moai doctor` を呼ぶとき読むのは、要約の行ではなく終了コードです。
+
+| 終了コード | 意味 |
+|------------|------|
+| `0` | Fail 項目なし。Warn は勧告なので終了コードを変えません |
+| `1` | 一件以上が Fail。要約の `Fail N` がそのまま反映されます |
+
+Constitution Registry の項目は、レジストリが解析できるかを見るだけでなく、`moai constitution validate` と**同じドリフト検証**を実行します。したがって同じチェックアウトで doctor が ok と言い、validate が失敗する、ということは起こりません。`MOAI_CONSTITUTION_SKIP_VALIDATE=1` で迂回すると、doctor は構造検査の判定に戻ります。
+
 ## 例
 
 ```bash
```

**File**: `docs-site/content/ko/cli-reference/doctor.md` (modified, +11/-0)
```diff
@@ -52,6 +52,17 @@ moai doctor [OPTIONS]
 
 이 추정치는 `moai clean --home`이 쓰는 것과 **같은 스캐너**를 호출하므로, doctor가 말하는 숫자와 clean이 실제로 지우는 목록이 어긋나지 않습니다. 자세한 내용은 [홈 디렉터리 위생](/ko/advanced/home-hygiene)에 있습니다.
 
+## 종료 코드
+
+스크립트나 CI 래퍼에서 `moai doctor` 를 부를 때는 요약 줄이 아니라 종료 코드를 읽습니다.
+
+| 종료 코드 | 의미 |
+|-----------|------|
+| `0` | Fail 항목 없음. Warn 은 권고라 종료 코드를 바꾸지 않습니다 |
+| `1` | 한 건 이상이 Fail. 요약의 `Fail N` 이 그대로 반영됩니다 |
+
+Constitution Registry 항목은 레지스트리가 파싱되는지만 보지 않고 `moai constitution validate` 와 **같은 드리프트 검사**를 돌립니다. 따라서 같은 체크아웃에서 doctor 가 ok 라고 하는데 validate 가 실패하는 일은 없습니다. `MOAI_CONSTITUTION_SKIP_VALIDATE=1` 로 우회하면 doctor 도 구조 검사 판정으로 돌아갑니다.
+
 ## 예시
 
 ```bash
```

**File**: `docs-site/content/zh/cli-reference/doctor.md` (modified, +11/-0)
```diff
@@ -50,6 +50,17 @@ moai doctor [OPTIONS]
 
 这个估算调用的是与 `moai clean --home` **同一个扫描器**,所以 doctor 报出的数字和 clean 实际删除的清单不会脱节。详见 [主目录卫生](/zh/advanced/home-hygiene)。
 
+## 退出码
+
+脚本和 CI 包装器调用 `moai doctor` 时，读的是退出码，而不是摘要那一行。
+
+| 退出码 | 含义 |
+|--------|------|
+| `0` | 没有 Fail 项。Warn 属于劝告，不改变退出码 |
+| `1` | 有一项以上 Fail —— 摘要里的 `Fail N` 原样体现 |
+
+Constitution Registry 这一项不只确认注册表能否解析，它跑的是与 `moai constitution validate` **相同的漂移校验**。所以在同一个检出里，doctor 说 ok 而 validate 失败的情况不会出现。用 `MOAI_CONSTITUTION_SKIP_VALIDATE=1` 绕过时，doctor 回到它自己的结构检查判定。
+
 ## 示例
 
 ```bash
```

**File**: `internal/cli/doctor.go` (modified, +89/-14)
```diff
@@ -44,8 +44,9 @@ var doctorCmd = &cobra.Command{
 	Use:     "doctor",
 	Short:   "Run system diagnostics",
 	GroupID: "project",
-	Long:    "Run comprehensive system health checks including Claude Code configuration, dependency verification, and environment diagnostics.",
-	RunE:    runDoctor,
+	Long: "Run comprehensive system health checks including Claude Code configuration, dependency verification, and environment diagnostics.\n\n" +
+		"Exit codes: 0=no failing checks (warnings are advisory and do not fail the run), 1=one or more checks reported Fail.",
+	RunE: runDoctor,
 }
 
 func init() {
@@ -97,12 +98,7 @@ func runDoctor(cmd *cobra.Command, _ []string) error {
 	// Render per-section pass/fail tables + counts + summary (REQ-TUX4-002).
 	_, _ = fmt.Fprintln(out, renderDoctorGroups(out, groups, verbose, th))
 
-	failCount := 0
-	for _, c := range allChecks {
-		if c.Status == uikit.CheckFail {
-			failCount++
-		}
-	}
+	failCount := countFailedChecks(allChecks)
 
 	if fix && failCount > 0 {
 		var fixes []string
@@ -122,7 +118,33 @@ func runDoctor(cmd *cobra.Command, _ []string) error {
 		_, _ = fmt.Fprintf(out, "\nDiagnostics exported to %s\n", exportPath)
 	}
 
-	return nil
+	return doctorExitStatus(failCount)
+}
+
+// countFailedChecks counts the checks whose verdict is Fail — the same number
+// the rendered summary prints as `Fail N`.
+func countFailedChecks(checks []DiagnosticCheck) int {
+	n := 0
+	for _, c := range checks {
+		if c.Status == uikit.CheckFail {
+			n++
+		}
+	}
+	return n
+}
+
+// doctorExitStatus maps a doctor run's failing-check count onto the process
+// exit code (#1593). A run that printed `Fail N` (N > 0) MUST NOT exit 0 —
+// callers (scripts, hooks, CI wrappers) read the exit code, not the summary
+// line. Warn-only runs stay exit 0: a warning is advisory, not a failure.
+func doctorExitStatus(failCount int) error {
+	if failCount == 0 {
+		return nil
+	}
+	return &exitCodeError{
+		code: 1,
+		msg:  fmt.Sprintf("doctor: %d check(s) failed", failCount),
+	}
 }
 
 // checkStatusToTUI converts a uikit.CheckStatus to the tui.CheckLine status string.
@@ -608,11 +630,13 @@ func parseMCPJSON(path string) map[string]struct{} {
 const constitutionStrictEnvKey = "MOAI_CONSTITUTION_STRICT"
 
 // checkConstitution checks the zone registry status.
-// - registry file not found: Warn (optional feature)
-// - load error (duplicate ID, invalid YAML, etc.): Fail
-// - zero Frozen entries: Warn
-// - orphan warnings present + strictMode: Fail; otherwise Warn
-// - normal/OK: OK
+//   - registry file not found: Warn (optional feature)
+//   - load error (duplicate ID, invalid YAML, etc.): Fail
+//   - zero Frozen entries: Warn
+//   - orphan warnings present + strictMode: Fail; otherwise Warn
+//   - registry-vs-source validation errors (same check as `moai constitution
+//     validate`): Fail
+//   - normal/OK: OK
 func checkConstitution(projectDir, registryPath string, verbose, strictMode bool) DiagnosticCheck {
 	check := DiagnosticCheck{Name: "Constitution Registry"}
 
@@ -649,6 +673,15 @@ func checkConstitution(projectDir, registryPath string, verbose, strictMode bool
 		return check
 	}
 
+	// Registry-source drift check (#1594). Loading the registry proves it
+	// parses; it says nothing about whether the clauses still exist in their
+	// source files. Doctor runs the same constitution.Validate that
+	// `moai constitution validate` runs, so a check that a registry "is OK"
+	// cannot disagree with the dedicated command against the same checkout.
+	if vcheck, drifted := validateConstitutionRegistry(projectDir, registryPath, len(reg.Entries), verbose); drifted {
+		return vcheck
+	}
+
 	// Check Frozen entry count
 	frozen := reg.FilterByZone(constitution.ZoneFrozen)
 	if len(frozen) == 0 {
@@ -674,6 +707,48 @@ func checkConstitution(projectDir, registryPath string, verbose, strictMode bool
 	return check
 }
 
+// validateConstitutionRegistry runs the same drift validation as
+// `moai constitution validate` against the registry doctor just loaded.
+// It returns (check, true) when validation found errors — the caller surfaces
+// that check as the Constitution Registry verdict — and (zero, false) when the
+// registry validates clean or the validation was bypassed
+// (MOAI_CONSTITUTION_SKIP_VALIDATE=1), in which case doctor falls through to
+// its own structural verdict.
+func validateConstitutionRegistry(projectDir, registryPath string, entryCount int, verbose bool) (DiagnosticCheck, bool) {
+	check := DiagnosticCheck{Name: "Constitution Registry"}
+
+	result, err := constitution.Validate(constitution.ValidateOptions{
+		RegistryPath: registryPath,
+		ProjectDir:   projectDir,
+	})
+	if result.Skipped {
+		return DiagnosticCheck{}, false
+	}
+	if err == nil && result.Status != constitution.ValidateStatusDrift {
+		return DiagnosticCheck{}, false
+	}
+
+	check.Status = uikit.CheckFail
+	if len(result.Entries) == 0 {
+		// Validation could not complete (e.g. an unreadable sour
```

**File**: `internal/cli/doctor_constitution_test.go` (modified, +79/-1)
```diff
@@ -7,6 +7,7 @@ import (
 	"testing"
 
 	"github.com/modu-ai/moai-adk/internal/cli/uikit"
+	"github.com/modu-ai/moai-adk/internal/constitution"
 )
 
 // validConstitutionRegistryForDoctor is a registry content valid for doctor tests.
@@ -69,13 +70,19 @@ const emptyFrozenRegistryForDoctor = `# Test Registry
 ` + "```" + `
 `
 
+// claudeMDWithClauses carries both clauses referenced by
+// validConstitutionRegistryForDoctor, so the registry validates drift-free.
+// A CLAUDE.md missing them is the drift fixture (see
+// TestCheckConstitution_DriftFailsLikeValidate).
+const claudeMDWithClauses = "# Test\n\nSPEC+EARS format is the requirement form.\n\nTRUST 5 is the quality framework.\n"
+
 // TestCheckConstitution_ValidRegistry verifies that a valid registry returns OK.
 // Relates to AC-CON-001-001.
 func TestCheckConstitution_ValidRegistry(t *testing.T) {
 	dir := t.TempDir()
 
 	// Create CLAUDE.md (used for file-presence verification)
-	if err := os.WriteFile(filepath.Join(dir, "CLAUDE.md"), []byte("# Test"), 0o600); err != nil {
+	if err := os.WriteFile(filepath.Join(dir, "CLAUDE.md"), []byte(claudeMDWithClauses), 0o600); err != nil {
 		t.Fatalf("CLAUDE.md 생성 오류: %v", err)
 	}
 
@@ -91,6 +98,72 @@ func TestCheckConstitution_ValidRegistry(t *testing.T) {
 	}
 }
 
+// TestCheckConstitution_DriftFailsLikeValidate verifies #1594: doctor must not
+// report a registry as OK on entry count alone while `moai constitution
+// validate` reports errors against the same checkout. The registry here loads
+// cleanly (structure is sound) but its clauses are absent from the source file,
+// which is exactly what validate flags as DRIFT.
+func TestCheckConstitution_DriftFailsLikeValidate(t *testing.T) {
+	dir := t.TempDir()
+
+	// CLAUDE.md exists (so the entries are not orphans) but carries neither
+	// clause — the drift condition.
+	if err := os.WriteFile(filepath.Join(dir, "CLAUDE.md"), []byte("# Test\n"), 0o600); err != nil {
+		t.Fatalf("CLAUDE.md 생성 오류: %v", err)
+	}
+
+	registryPath := filepath.Join(dir, "zone-registry.md")
+	if err := os.WriteFile(registryPath, []byte(validConstitutionRegistryForDoctor), 0o600); err != nil {
+		t.Fatalf("registry 파일 생성 오류: %v", err)
+	}
+
+	// Cross-check: the dedicated validate command sees the same drift.
+	result, err := constitution.Validate(constitution.ValidateOptions{
+		RegistryPath: registryPath,
+		ProjectDir:   dir,
+	})
+	if err != nil {
+		t.Fatalf("constitution.Validate 오류: %v", err)
+	}
+	if result.Status != constitution.ValidateStatusDrift {
+		t.Fatalf("fixture 전제 실패: validate Status = %q, want %q", result.Status, constitution.ValidateStatusDrift)
+	}
+
+	check := checkConstitution(dir, registryPath, true, false)
+
+	if check.Status != uikit.CheckFail {
+		t.Errorf("drift registry Status = %q, want %q\n메시지: %s", check.Status, uikit.CheckFail, check.Message)
+	}
+	if !strings.Contains(check.Message, "validate") {
+		t.Errorf("메시지가 validate를 가리켜야 한다: %s", check.Message)
+	}
+	if check.Detail == "" {
+		t.Error("verbose 모드에서 drift 항목 detail이 비어 있으면 안 된다")
+	}
+}
+
+// TestCheckConstitution_SkipValidateBypass verifies that
+// MOAI_CONSTITUTION_SKIP_VALIDATE=1 leaves doctor on its structural verdict
+// rather than turning the bypass into a Fail.
+func TestCheckConstitution_SkipValidateBypass(t *testing.T) {
+	t.Setenv("MOAI_CONSTITUTION_SKIP_VALIDATE", "1")
+
+	dir := t.TempDir()
+	if err := os.WriteFile(filepath.Join(dir, "CLAUDE.md"), []byte("# Test\n"), 0o600); err != nil {
+		t.Fatalf("CLAUDE.md 생성 오류: %v", err)
+	}
+	registryPath := filepath.Join(dir, "zone-registry.md")
+	if err := os.WriteFile(registryPath, []byte(validConstitutionRegistryForDoctor), 0o600); err != nil {
+		t.Fatalf("registry 파일 생성 오류: %v", err)
+	}
+
+	check := checkConstitution(dir, registryPath, false, false)
+
+	if check.Status != uikit.CheckOK {
+		t.Errorf("skip-validate bypass Status = %q, want %q\n메시지: %s", check.Status, uikit.CheckOK, check.Message)
+	}
+}
+
 // TestCheckConstitution_RegistryMissing verifies that a missing registry file returns Warn.
 func TestCheckConstitution_RegistryMissing(t *testing.T) {
 	dir := t.TempDir()
@@ -135,6 +208,11 @@ func TestCheckConstitution_EmptyFrozen(t *testing.T) {
 	}
 
 	registryPath := filepath.Join(dir, "zone-registry.md")
+	// The clause must be present in the source so this fixture isolates the
+	// empty-Frozen condition rather than tripping the drift check.
+	if err := os.WriteFile(filepath.Join(dir, "CLAUDE.md"), []byte("# Test\n\nSome evolvable rule applies here.\n"), 0o600); err != nil {
+		t.Fatalf("CLAUDE.md 갱신 오류: %v", err)
+	}
 	if err := os.WriteFile(registryPath, []byte(emptyFrozenRegistryForDoctor), 0o600); err != nil {
 		t.Fatalf("registry 파일 생성 오류: %v", err)
 	}
```

**File**: `internal/cli/exitcode_contract_test.go` (modified, +27/-0)
```diff
@@ -11,10 +11,37 @@ import (
 
 	"github.com/spf13/cobra"
 
+	"github.com/modu-ai/moai-adk/internal/cli/uikit"
 	"github.com/modu-ai/moai-adk/internal/constitution"
 	"github.com/modu-ai/moai-adk/internal/spec"
 )
 
+// TestExitCodeContract_DoctorFailingChecks verifies #1593: a doctor run whose
+// summary prints `Fail N` (N > 0) exits 1 via the ExitCoder boundary, while a
+// run carrying only OK/Warn checks exits 0 (a warning is advisory).
+func TestExitCodeContract_DoctorFailingChecks(t *testing.T) {
+	clean := []DiagnosticCheck{
+		{Name: "A", Status: uikit.CheckOK},
+		{Name: "B", Status: uikit.CheckWarn},
+	}
+	if got := countFailedChecks(clean); got != 0 {
+		t.Fatalf("countFailedChecks(OK+Warn) = %d, want 0", got)
+	}
+	if err := doctorExitStatus(countFailedChecks(clean)); err != nil {
+		t.Fatalf("warn-only doctor run returned %v, want nil (exit 0)", err)
+	}
+
+	failing := append(clean, DiagnosticCheck{Name: "C", Status: uikit.CheckFail})
+	if got := countFailedChecks(failing); got != 1 {
+		t.Fatalf("countFailedChecks(with 1 Fail) = %d, want 1", got)
+	}
+	err := doctorExitStatus(countFailedChecks(failing))
+	assertExitCode(t, err, 1)
+	if !strings.Contains(err.Error(), "1 check(s) failed") {
+		t.Errorf("error message = %q, want it to name the failing-check count", err.Error())
+	}
+}
+
 // assertExitCode fails the test if err does not carry the expected exit code via
 // the ExitCoder boundary (cmd/moai/main.go errors.As mapping).
 func assertExitCode(t *testing.T, err error, want int) {
```

---

### Incident Patch 14: `8ff3e082` (2026-08-24)
**Commit Message**: fix(worktree): repair the worktree reaper — three-valued merge detection, lock-aware anchor guard, clean --stale inventory (t209) (#1638)

* docs(spec): SPEC-WORKTREE-REAPER-001 plan-phase artifacts (t209)

The card was dispatched as "design a worktree reaper". A reaper already
exists — prMergeCleanup in internal/cli/session_worktree_prmerge.go —
ships enabled in this repo (workflow.yaml auto_cleanup: true), and runs
on every `moai session register` / `moai session list`. It acted during
the investigation itself. So this SPEC repairs and extends it rather
than building a new one.

Measured: 155 worktrees, 30G on disk, 0 under ~/.moai/worktrees (every
tree is L1, so `moai worktree done` has nothing to operate on here).
99 merged WT-* trees are still on disk because branchMergedForCleanup
cannot distinguish "gh gave no answer" from "gh said not merged": once
a merged PR's head branch is deleted, `gh pr view` errors, the seam
returns "", and the tree is preserved forever. The git fallback that
would catch all 99 is reachable only when gh is absent.

The anchor guard reads the session registry, which names 1 of 5 live
anchors; the git worktree lock names 5 of 5. The sweep selected a li

**File**: `.claude/rules/moai/workflow/worktree-integration.md` (modified, +25/-0)
```diff
@@ -66,6 +66,31 @@ The rename is also a disposal-path switch, and that is deliberate:
 
 Either way the unpushed-branch rule above still governs timing — the sweep's merged-branch condition is the same "after the remote merge" boundary. The lane-side procedure that consumes `WT-` branches lives in `kanban-dispatch.md` § Integration into the release branch is self-served.
 
+## Disposing a Worktree the Automatic Sweep Does Not Reach
+
+Automatic disposal covers one shape only: the PR-merge auto-cleanup sweep enumerates `git worktree list` and treats a tree as a candidate solely when its branch carries the launcher's `WT-` prefix. Every other registered worktree — one named after the change it makes, one entered by hand, one whose branch was renamed — falls outside that sweep and stays on disk until someone disposes of it. That is the safe direction (nothing is removed unasked), but it is not a disposal plan.
+
+**Worktree-ness is a property of the checkout, not of the branch name.** A branch-name glob finds only the trees named a particular way; `git worktree list` finds all of them. Any inventory of what is actually on disk therefore starts from the listing, never from a name pattern.
+
+The shipped inventory is the `--stale` sweep's own evaluation, rendered as data:
+
+```bash
+moai worktree clean --stale --json
+```
+
+It emits one object per non-protected registered worktree, carrying the path, the branch, the keep-reason, and the four predicates behind that reason — dirty state, merge state, anchor state, and ignored-content state. It removes nothing: `--json` is a report, and it overrides `--yes` rather than combining with it. A predicate the sweep short-circuited before asking reads `not-checked`, which is deliberately distinct from `undetermined` — the latter means it asked and could not tell. Neither is a negative.
+
+Read the report, then dispose of what it shows as removable:
+
+```bash
+moai worktree clean --stale        # preview: names the trees it would remove
+moai worktree clean --stale --yes  # perform the removals
+```
+
+Both paths honour the same guards: a dirty tree, an unmerged branch, a tree anchoring a live session, a tree holding gitignored content that nothing regenerates, and a tree whose state could not be read are each kept and reported with the reason. The ignored-content guard matters because `git status --porcelain` and a non-forced `git worktree remove` both disregard gitignored files: without it a tree whose only remaining content is agent memory reads as clean and is destroyed silently. It shares one allowlist with the automatic sweep, so both agree on what is regenerable — runtime state, runtime-managed config, build output, test residue — and anything unclassified keeps the tree. Branches are never deleted — the commits stay reachable by branch name after the directory is gone. The merge comparison is against `origin/main` by default, the same ref the automatic sweep uses, so the two cannot reach opposite conclusions about the same tree; `--base` overrides it.
+
+For a tree outside the sweep entirely, the manual path is unchanged: `git worktree unlock <path>` when a dead session's lock is still on it, then `git worktree remove <path>`. The unpushed-branch rule above governs the timing in every case.
+
 ## Claude Code 2.1.50+ Worktree Features
 
 ### `claude --worktree` (`-w`) Flag
```

**File**: `.moai/config/sections/workflow.yaml` (modified, +10/-2)
```diff
@@ -120,8 +120,16 @@ workflow:
     worktree:
         # 2026-05-22: auto_create false (user policy feedback_worktree_autonomous 정렬).
         # L1 worktree는 Claude Code runtime autonomous — MoAI orchestrator는 자동 생성 안함.
-        # auto_merge/auto_cleanup 유지 (사용자 수동 worktree 생성 시에만 자동 머지/정리).
-        auto_cleanup: true
+        # auto_merge 유지 (사용자 수동 worktree 생성 시에만 자동 머지).
+        #
+        # auto_cleanup: true → false (SPEC-WORKTREE-REAPER-001 M1 착지 조건).
+        # M1이 gh no-answer 경로에서 git fallback을 되살리면서, 이 저장소의
+        # 병합된 워크트리 ~98개가 `moai session list` 한 번에 제거 대상이 된다.
+        # 그 일괄 삭제는 SPEC §G에서 범위 밖으로 선언돼 있으므로, 첫 스윕은
+        # `moai session list`의 부수효과가 아니라 의도된 행위여야 한다.
+        # 재활성화는 제거 예정 트리를 먼저 열거한 뒤 운영자가 판단할 것
+        # (acceptance.md AC-WR-023(b)).
+        auto_cleanup: false
         auto_create: false
         auto_merge: true
         session_name_pattern: moai-{ProjectName}-{SPEC-ID}
```

**File**: `.moai/reports/t209/cr-response.md` (added, +151/-0)
```diff
@@ -0,0 +1,151 @@
+# PR #1638 — CodeRabbit review response (t209)
+
+Card t209, SPEC-WORKTREE-REAPER-001, branch `WT-worktree-reaper`.
+
+Two review rounds have landed, on heads `55ecba718` and `b72e8265d`. This file
+records every comment and what was done with it.
+
+**A note on the second round's inline comments.** All 21 inline comments on
+`b72e8265d` are the SAME comments from the `55ecba718` round, re-anchored to
+new line numbers — GitHub carries unresolved threads forward. Five of them
+(stderr, `%w` wrapping, the Windows probe, the docs predicate, the fixture
+comment) name defects already fixed in `b72e8265d` itself; they persist because
+the threads were never resolved, not because the finding recurred. The genuinely
+new material in the second round is the two **outside-diff** comments, which is
+what this round acts on.
+
+---
+
+## Round 2 — outside-diff findings
+
+### OD-1 — recheck ignored content immediately before each removal — **APPLIED**
+
+> *Major.* The ignored-content verdict runs during classification, but the later
+> `Remove(..., false)` call uses that old result. If another process creates
+> `.claude/agent-memory/` or another irreplaceable ignored path after
+> classification, Git can still remove the worktree because ignored files do not
+> trigger non-forced removal refusal.
+
+Verified against the tree before acting, and the finding is correct for exactly
+one of the two paths:
+
+| Path | Shape | Exposed? |
+|---|---|---|
+| `--stale` | classifies the WHOLE population, then removes in a second loop | **Yes** — a tree cleared early can acquire content before its turn |
+| `--merged-only` | classifies and acts one tree at a time | **No** — the verdict at `clean.go:137` already sits immediately before `Remove` at `:148` |
+
+So the fix is one re-read in the `--stale` removal loop, plus a comment on the
+merged limb recording that its guard's POSITION is load-bearing — hoisting it
+into a classification pass would reintroduce exactly this defect there.
+
+The window is **narrowed, not closed**: a gap remains between the second read
+and the removal syscall. Closing it entirely is not available to this design —
+nothing downstream refuses on ignored content, which is the whole reason the
+guard exists.
+
+**RED evidence (mutation).** With the re-read's condition forced false and
+everything else identical:
+
+```
+--- FAIL: TestCleanStale_RechecksIgnoredContentBeforeRemoval (0.00s)
+    clean_ignored_content_test.go:264: content that appeared after classification
+      must still preserve the tree; removed [/wt/race]
+FAIL	github.com/modu-ai/moai-adk/internal/cli/worktree	1.019s
+```
+
+**GREEN, restored:**
+
+```
+=== RUN   TestCleanStale_RechecksIgnoredContentBeforeRemoval
+--- PASS: TestCleanStale_RechecksIgnoredContentBeforeRemoval (0.00s)
+ok  	github.com/modu-ai/moai-adk/internal/cli/worktree	1.452s
+```
+
+The test drives the race directly: the stubbed `--ignored` read returns clean on
+its first call and `!! .claude/agent-memory/` on every later one, and the test
+asserts the guard ran at least twice, that nothing was removed, and that the
+notice names `cause=ignored-content`.
+
+### OD-2 — propagate lock-source failures as system errors (exit 2) — **DECLINED**
+
+> *Major.* Both paths only print a warning and return success, so automation
+> cannot distinguish a fail-closed sweep from completed cleanup. Return a wrapped
+> system error and verify that the command exits with code 2.
+
+Declined on the premise, which was checked rather than assumed. **Automation
+already can distinguish the two**, by the surface built for it in this same SPEC:
+
+- `clean --stale --json` reports every record with `anchored: "undetermined"` and
+  a `keep_reason` carrying `cause=lock-source-unreadable` (REQ-WR-012 — the
+  inventory and the sweep are one evaluation, so the report cannot describe a
+  degraded run as a clean one).
+- The human paths print the same cause-bearing notice, and as of `b72e8265d` it
+  goes to **stderr**, which is where a script looks for a degraded-run warning.
+
+Two further reasons not to take it inside this card:
+
+1. **It contradicts a requirement this SPEC states.** REQ-WR-016: *"The sweep
+   shall not abort its caller on any failure; every failure path shall remain a
+   non-blocking notice."* Two criteria assert it by name. Reversing that is a
+   requirement change, not a review fix, and it belongs where it can be argued
+   with its own acceptance criterion.
+2. **Exit 2 is not reachable by returning an error.** `cmd/moai/main.go:13-22`
+   exits **1** for any error unless it satisfies `cli.ResolveExitCode` — so
+   "return a wrapped system error" yields exit 1, not the 2 the finding asks to
+   verify. Delivering it needs the `ExitCoder` plumbing, which widens the change
+   further.
+
+Recorded as a follow-up card candidate: *"`moai worktree clean` should exit 2
+when its authoritative anchor source is unreadable"*, carrying the REQ-WR-016
+amend
```

**File**: `.moai/reports/t209/ec9-measurement.md` (added, +121/-0)
```diff
@@ -0,0 +1,121 @@
+# EC-9 and the `branch --merged` equivalence — measured
+
+> **v2, 2026-08-24. Section Q1 below REPLACES a wrong result in v1.** The v1
+> conclusion ("`git worktree remove` refuses a tree holding only ignored files")
+> was an artifact of a contaminated fixture. Iteration-2 plan-audit failed to
+> reproduce it, was right, and the contamination is now identified. The v1 text
+> is not preserved: it was cited by `spec.md` §E, `design.md` §A.4/§A.6,
+> `research.md` §D.4a, EC-9, EC-11, REQ-WR-021 and AC-WR-024, and leaving a
+> superseded version in place invites one of those to be re-derived from it.
+
+## Q1 — does `git worktree remove` delete a tree holding only gitignored files?
+
+**Answer: YES. It removes the tree and destroys the ignored content, exit 0.**
+The dirty guard is not backstopped by git here; `git status --porcelain` and
+`git worktree remove` agree in disregarding ignored files.
+
+Clean fixture — repo with `.gitignore` (`build/`) in the initial commit, a linked
+worktree, one ignored file:
+
+```
+$ git status --porcelain | wc -l        → 0     # worktreeIsDirty reads CLEAN
+$ git status --porcelain --ignored | wc -l → 1
+$ git worktree remove ../w ; echo $?
+0
+$ ls ../w
+ls: ../w: No such file or directory             # build/artifact.bin destroyed
+```
+
+### Why v1 measured the opposite — and the finding hiding inside the mistake
+
+The v1 fixture was created **inside this live t209 worktree**, and MoAI's own
+statusline writes state files into whatever tree the session occupies. Between
+v1's `git status` measurement and its `git worktree remove`, two files appeared
+in the scratch worktree:
+
+```
+$ git status --porcelain --ignored=no -uall     # in the scratch worktree
+?? .moai/state/config-cache.json
+?? .moai/state/context-usage.json
+```
+
+The scratch repo carried no `.gitignore` for `.moai/state/`, so those were
+**untracked**, not ignored — and untracked files are exactly what
+`git worktree remove` refuses. v1 measured the untracked-file refusal and
+attributed it to the ignored file. The two fixtures differ in nothing that was
+recorded; they differ in a file written by a process neither fixture mentioned.
+
+Three fixtures, run to isolate it — A (`.gitignore` in the base commit, removed
+promptly) exit 0; B and C (scratch tree lived long enough for the statusline to
+write) exit 128, with the refusal explained by the `??` lines above, not by the
+ignored file. The variable is elapsed time in a live session's tree, not
+`.gitignore` placement or branch topology — both of which were tested and
+rejected as explanations.
+
+**Two lessons, both worth keeping:**
+
+1. **A measurement taken inside a live session's worktree is not isolated.** The
+   session mutates the tree asynchronously. Fixtures for worktree-disposal
+   behaviour belong outside any tree a session occupies.
+2. **The gap between measuring and acting is a race, and the sweep has that same
+   race.** `prMergeCleanup` re-checks `worktreeIsDirty` "immediately before
+   removal" (EC-11 in the M8 SPEC) precisely to narrow it, but narrow is not
+   closed: a tree can go dirty between the check and the `git worktree remove`.
+   Here that race is benign — it makes removal fail rather than succeed — but the
+   SPEC should say that is why, rather than leaving it unstated.
+
+### What this changes in the SPEC
+
+REQ-WR-021's `--ignored` probe is **still the right mechanism**; its rationale
+inverts. It is not a courtesy that avoids a doomed removal — it is the **only**
+thing standing between the sweep and the destruction of ignored content. Every
+artifact that describes it as a second layer behind git's own refusal is wrong
+and must be restated, and `design.md` §A.4's "three backstop layers" is two.
+
+### An unmeasured consequence that needs measuring before M1 lands
+
+`.moai/state/` **is** gitignored in the real repository
+(`git check-ignore -v` → `.gitignore:284:.moai/state/`), and MoAI writes into it
+in every tree a session occupies. So the probe's preserve condition — "this tree
+holds ignored content" — is plausibly true of **every worktree that has ever
+hosted a session**, before Go build output is even considered.
+
+If that is so, the probe preserves nearly the whole population and M1's unblocking
+of the 99 merged trees is undone by M2's own guard. I could not measure it: the
+worktree-isolation guard refuses `cd` and `git -C` into sibling trees, so I can
+observe only this one (`--ignored` → 5 entries). **This is a hypothesis, not a
+finding**, and it is the single most important thing to measure before M1 is
+implemented — from outside the worktrees, over all 154 trees.
+
+It also reframes the design question. If ignored content is universal, "preserve
+on any ignored content" is too blunt, and the SPEC needs a policy that separates
+*regenerable* ignored content (`.moai/state/`, build output — safe to destroy)
+from *irreplaceable* ignored content (a local `.env`) — or it need
```

**File**: `.moai/reports/t209/investigation.md` (added, +190/-0)
```diff
@@ -0,0 +1,190 @@
+# t209 — worktree reaper: plan-phase investigation
+
+Read-only survey run in `/Users/goos/MoAI/moai-adk-go/.claude/worktrees/t209`
+(branch `WT-worktree-reaper`, base `cd0cee1b8` = `origin/main`), 2026-08-24.
+Every number below was measured in this run with the command shown.
+
+## The card's premise is half-wrong, and the correct half is already built
+
+The dispatch asks me to design three axes — safe-disposal condition, L1/L2
+disposal path, session-anchor detection. **All three already exist in the
+codebase**, in `internal/cli/session_worktree_prmerge.go` (`prMergeCleanup`,
+SPEC-SESSION-WORKTREE-001 M8), which runs automatically at `moai session
+register` and `moai session list` and is **already enabled in this repo**
+(`.moai/config/sections/workflow.yaml:124` `auto_cleanup: true`).
+
+I watched it act during this very investigation — running `moai session list
+--json` emitted:
+
+```
+moai: PR-merge cleanup skipped (uncommitted changes): worktree …/t192 preserved
+moai: PR-merge cleanup skipped (uncommitted changes): worktree …/t206 preserved
+moai: removed by PR-merge cleanup: [WT] worktree …/t208 (branch WT-profile-test-isolation merged)
+moai: PR-merge cleanup failed (fatal: cannot remove a locked working tree, lock reason: claude session t212 (pid 31329 …)): worktree …/t212 left on disk
+```
+
+So the deliverable is **not a new reaper**. It is (a) closing the defect that
+makes the existing one preserve almost everything, and (b) closing the safety
+hole the same run exposed.
+
+## Measured state
+
+| Measurement | Command | Value |
+|---|---|---|
+| worktrees registered | `git worktree list \| wc -l` | **155** (154 + primary) |
+| disk footprint | `du -sh .claude/worktrees` | **30G** |
+| under `.claude/worktrees/` (L1) | `git worktree list --porcelain` parent-dir tally | **154** |
+| under `~/.moai/worktrees/` (L2) | same | **0** |
+| L2 registry contents | `cat ~/.moai/worktrees/MoAI-ADK/.moai-worktree-registry.json` | `{}` (2 bytes) |
+| prunable (stale admin dirs) | `git worktree prune --dry-run` | **0** |
+| locked worktrees | `grep -c '^locked'` on porcelain | **5** |
+| `WT-*` branches on worktrees | porcelain branch tally | **111** |
+| non-`WT-*` worktree branches | 154 − 111 | **43** |
+| `WT-*` branches merged into `origin/main` | `git branch --merged origin/main \| grep -c '^WT-'` | **99** |
+
+**L2 is empty.** Every worktree in this repo is L1. `moai worktree done` is
+therefore not merely the wrong verb for these trees — it has *nothing to
+operate on at all* in this repository. The only disposal path that applies is
+`git worktree remove` (with `git worktree unlock` first where locked), which
+is exactly what `prMergeCleanup` already calls.
+
+## Defect 1 — `gh pr view` goes blind the moment the remote branch is deleted
+
+`branchMergedForCleanup` (`session_worktree_prmerge.go:186`) takes the `gh`
+path whenever `gh` is on PATH, and only falls back to `git branch --merged`
+when `gh` is **absent**:
+
+```go
+if ghAvailable {
+    return sessionWorktreeGhPRViewState(branch) == "MERGED"
+}
+```
+
+`ghPRViewStateReal` returns `""` on any gh error — including the ordinary,
+expected case of a merged PR whose head branch was deleted on the remote:
+
+```
+$ gh pr view WT-forge-counts --json state
+no pull requests found for branch "WT-forge-counts"
+
+$ git branch --merged origin/main --format='%(refname:short)' | grep -x 'WT-forge-counts'
+WT-forge-counts
+```
+
+git says merged; gh says no PR; the reaper reads `""`, concludes "not merged",
+and preserves the tree — permanently, on every future sweep. The fallback that
+would have caught it is unreachable because `gh` IS installed.
+
+This is why **99 merged `WT-*` worktrees are still on disk** while the sweep
+runs on every `moai session list`. The mechanism is not a missing feature; it
+is one branch of an if-statement that treats "gh could not tell me" and "gh
+told me it is not merged" as the same answer.
+
+Note the asymmetry that makes this safe to fix: the two sources fail in
+opposite directions. `gh` sees squash merges that `git branch --merged` cannot
+(the documented reason gh is primary); `git branch --merged` sees deleted-branch
+merges that `gh` cannot. Consulting the second when the first returns *no
+answer* — as distinct from a negative answer — loses neither property.
+
+## Defect 2 — the anchor guard is 1-of-5 blind, and git's lock is what is actually protecting live sessions
+
+`prMergeCleanup` calls `session.LiveAnchoredSessions(path, now)`
+(`internal/session/anchor.go:49`), which reads the session registry
+(`.moai/state/active-sessions.json`) and matches entry `cwd` against the tree.
+
+Measured coverage:
+
+| Anchor signal | Live anchors it names |
+|---|---|
+| git worktree lock reason (`locked claude session <name> (pid N …)`) | **5** — t207, t209, t210, t212, t213 |
+| session registry `cwd` under a worktree | **1** — t207 only |
+
+```
+$ ps -o pid=,comm= -p 36912 -p 34699 -p 51045 
```

**File**: `.moai/reports/t209/plan-audit-iter2.md` (added, +350/-0)
```diff
@@ -0,0 +1,350 @@
+# SPEC Review Report: SPEC-WORKTREE-REAPER-001
+
+Iteration: 2/3
+Verdict: **FAIL**
+Overall Score: **0.84** (0.8375 exact; Tier L PASS threshold = 0.85)
+
+Reasoning context ignored per M1 Context Isolation. The dispatch's
+characterisations — including "v0.3.0", "the equivalence claim holds", and "EC-9
+closes in the safe direction" — were treated as hypotheses to test, not as
+premises. Every judgment below is anchored to an artifact line or to a command
+run in `/Users/goos/MoAI/moai-adk-go/.claude/worktrees/t209` (branch
+`WT-worktree-reaper`, HEAD `bee2c2640`) on 2026-08-24.
+
+**Score trajectory: iter1 0.55 → iter2 0.84.** No regression; no STOP signal.
+The FAIL margin is thin (0.0125) and rests on one critical finding whose fix is
+bounded and mechanical. Iteration 3 remains available under the Tier L ceiling.
+
+---
+
+## Must-Pass Results
+
+- **[PASS] MP-1 REQ number consistency** — `grep -o 'REQ-WR-[0-9]*' spec.md | sort -u` → `REQ-WR-001 … REQ-WR-023`, 23 unique, zero-padded, no gaps, no duplicates; `grep -c '^- \*\*REQ-WR-' spec.md` → `23`. Within the Tier L ceiling of 25.
+- **[PASS] MP-2 GEARS format compliance (requirement layer)** — judged against the 23 `REQ-WR-XXX` entries in `spec.md` §D **only**; the Given/When/Then entries in `acceptance.md` are the verification layer and are graded under Group 4. `grep -o '(Ubiquitous)\|(Event-driven)\|(State-driven)\|(Unwanted)\|(Where…)'` → 23 labels for 23 requirements; `grep -n 'Event-detected' spec.md` → **0 matches** (iteration-1 D17 fixed). Mechanical confirmation: `moai spec lint .moai/specs/SPEC-WORKTREE-REAPER-001/spec.md` → exit 0, `✓ No findings — all SPEC documents are valid`.
+- **[PASS] MP-3 YAML frontmatter validity** — spec.md:L1-15 carries all 12 canonical fields (`id`, `title`, `version: "0.2.0"`, `status: draft`, `created`/`updated` ISO, `author`, `priority: P1`, `phase: "v3.1.4 target"` — not a prohibited stage name, `module`, `lifecycle: spec-anchored`, `tags`) plus optional `tier: L`. No rejected snake_case alias. `moai spec lint` exit 0.
+- **[N/A] MP-4 language neutrality** — single-language SPEC (Go, `module: internal/cli`); no template-bound or 16-language content.
+- **[PASS] MP-5 D7 cross-SPEC reconciliation** — `grep -o 'SPEC-([A-Z][A-Z0-9]+-)+[0-9]+' spec.md | sort -u` → `SPEC-SESSION-WORKTREE-001`, `SPEC-WORKTREE-REAPER-001`. `grep '^status:' .moai/specs/SPEC-SESSION-WORKTREE-001/spec.md` → `status: completed` (not retired/superseded/archived). No BLOCKING.
+- **[PASS] MP-6 D8 cross-platform discipline** — `grep -rn 'syscall' <spec dir>` now returns **2 matches** (v0.2.0 additions: `plan.md:125`, `design.md:221`), so D8 is no longer auto-PASS. Both occurrences carry an explicit cross-platform clause in the same sentence/section: `plan.md:125` reads "wrapping the existing syscall, **with the per-platform mapping in `design.md` §B.5**", and `design.md` §B.5 carries a five-row unix/windows probe-mapping table plus the "windows can never assert dead, so never widens removal" clause; `spec.md` §E carries "Windows liveness is unconditionally `true` (`anchor_pid_windows.go`) … Cross-platform verification is `GOOS=windows go vet`", and AC-WR-022 runs it. Confirmed the referenced files are already build-tag-separated: `head -3 internal/session/anchor_pid_unix.go` → `//go:build !windows`; `anchor_pid_windows.go` → `//go:build windows`. Explicit cross-platform exemption clause present ⇒ PASS.
+- **[PASS] MP-7 clarification gate** — `grep -rn '\[NEEDS CLARIFICATION' <spec dir>` → exactly one line, `progress.md:34`, which is a negation ("no `[NEEDS CLARIFICATION]` markers remain"), not a marker. `plan.md` and `research.md` both exist and carry zero markers.
+
+No must-pass criterion fails. **The FAIL is driven by the rubric scores**, principally by N1 below.
+
+---
+
+## Category Scores (0.0-1.0, rubric-anchored)
+
+| Dimension | Score | Rubric Band | Evidence |
+|---|---|---|---|
+| Clarity | 0.80 | 0.75-1.0 | Requirement text is unusually precise and every v0.2.0 wording defect from iteration 1 is repaired: REQ-WR-005 now states its observable rather than "as it does today" (spec.md:L144-146); `design.md` §B.3 pins the stored lock reason vs the porcelain line in a two-row table; the §B.4 fail-closed table is exhaustive and its first row is "no opinion", not "not anchored". Deductions: **REQ-WR-021 (spec.md:L196-201) states as fact a condition that measurement shows does not exist** — "content git counts as modified or untracked that `git status --porcelain` omits" (N1); `spec.md` §E's constraint "git's own removal check is stricter than the dirty guard" asserts the opposite of what reproduces; §D's preamble is self-contradictory — "018-022 are the amendment additions … (018-023)" (spec.md:L127-129). |
+| Completeness | 0.75 | 0.75 | All required sections present; `research.md` added (iteration-1 D16 closed) and it carries real Tier L weight, not padding — the two-sweep comparison table (§A), exact existing tes
```

**File**: `.moai/reports/t209/plan-audit-iter3.md` (added, +263/-0)
```diff
@@ -0,0 +1,263 @@
+# SPEC Review Report: SPEC-WORKTREE-REAPER-001
+
+Iteration: 3/3 (final)
+Verdict: **PASS**
+Overall Score: **0.875** (Tier L threshold 0.85)
+
+Reasoning context ignored per M1 Context Isolation. The dispatch's
+characterisations — "the EC-9 result is corrected", "the fork is settled by
+measurement, not preference", "the t208 path pre-exists M1" — were treated as
+hypotheses to test, not premises. Every judgment below is anchored to an artifact
+line or a command run in
+`/Users/goos/MoAI/moai-adk-go/.claude/worktrees/t209` (branch
+`WT-worktree-reaper`, HEAD `6a9b7c66a`) on 2026-08-24.
+
+**No fixture was built.** The measurement-hygiene instruction is honoured
+literally: this session sits inside a live worktree, the worktree-isolation guard
+refuses `git -C` into sibling trees, and iteration 2's own EC-9 error was produced
+by a fixture built in exactly this position. Where a claim could only be settled
+by a fixture, it is recorded as a **gap**, not measured in a contaminated tree.
+Two such gaps are named in § Gaps.
+
+**Score trajectory: 0.55 → 0.84 → 0.875.** No regression; no STOP signal.
+
+---
+
+## Must-Pass Results
+
+- **[PASS] MP-1 REQ number consistency** — `grep -o 'REQ-WR-[0-9]*' spec.md | sort -u` → `REQ-WR-001 … REQ-WR-024`, 24 unique, zero-padded, no gaps, no duplicates; `grep -c '^- \*\*REQ-WR-' spec.md` → `24`. Declared count matches (`spec.md` §D "24 requirements"; `progress.md` §E.1 "**24**").
+- **[PASS] MP-2 GEARS format compliance — judged against the `REQ-WR-XXX` requirement layer in `spec.md` §D only.** The Given/When/Then entries in `acceptance.md` are the verification layer and are graded under Group 4, not here. `grep -o '(Ubiquitous)\|(Event-driven)\|(State-driven)\|(Unwanted)\|(Where — capability gate)' spec.md | sort | uniq -c` → 9 Ubiquitous + 8 Event-driven + 2 State-driven + 4 Unwanted + 1 Where = **24 labels for 24 requirements**. `grep -c 'Event-detected' spec.md` → `0` (iteration-1 D17 stays fixed). The four v0.3.0 additions/rewrites (REQ-WR-021, 023, 024, and the amended 019) each carry a valid pattern and a `shall`. Mechanical confirmation: `moai spec lint .moai/specs/SPEC-WORKTREE-REAPER-001/spec.md` → exit 0, `✓ No findings — all SPEC documents are valid`.
+- **[PASS] MP-3 YAML frontmatter validity** — spec.md:L1-15 carries all 12 canonical fields (`id`, `title`, `version: "0.3.0"`, `status: draft`, `created`/`updated` ISO, `author`, `priority: P1`, `phase`, `module`, `lifecycle: spec-anchored`, `tags`) plus optional `tier: L`. No rejected snake_case alias. `moai spec lint` exit 0. Version bump to `0.3.0` closes iteration-2 N6.
+- **[N/A] MP-4 language neutrality** — single-language SPEC (Go, `module: internal/cli`); no template-bound or 16-language content.
+- **[PASS] MP-5 D7 cross-SPEC reconciliation** — `grep -Eoh 'SPEC-([A-Z][A-Z0-9]+-)+[0-9]+' *.md | sort -u` → `SPEC-SESSION-WORKTREE-001`, `SPEC-WORKTREE-REAPER-001`. `grep '^status:' .moai/specs/SPEC-SESSION-WORKTREE-001/spec.md` → `completed` — not retired/superseded/archived. No BLOCKING.
+- **[PASS] MP-6 D8 cross-platform discipline** — `grep -rn 'syscall' *.md` → 2 matches (`design.md:311`, `plan.md:147`), both carrying an explicit cross-platform clause in the same sentence: `plan.md:147` "wrapping the existing syscall, **with the per-platform mapping in `design.md` §B.5**"; `design.md` §B.5 carries the five-row unix/windows probe table and the "windows can never assert dead, so never widens removal" clause; `spec.md` §E states the Windows constraint and AC-WR-022 runs `GOOS=windows go vet`. Explicit cross-platform exemption present ⇒ PASS.
+- **[PASS] MP-7 clarification gate** — `grep -rn 'NEEDS CLARIFICATION' <spec dir>` → exactly one line, `progress.md:38`, a **negation** ("no `[NEEDS CLARIFICATION]` markers remain"), not a marker. `plan.md` and `research.md` both exist and carry zero markers. **Judged, not merely counted:** `design.md` §A.7's open fork is the substantive question this criterion exists to catch, and it is examined on its merits in § 3 below. It does not fail MP-7 — the fork is named, gated by a [HARD] M1 precondition, and cannot silently ship — but its decision rule is defective, which is finding F1.
+
+No must-pass criterion fails.
+
+---
+
+## Category Scores (0.0-1.0, rubric-anchored)
+
+| Dimension | Score | Rubric Band | Evidence |
+|---|---|---|---|
+| Clarity | 0.85 | 0.75-1.0 | Every iteration-2 clarity defect is repaired and I verified each: `spec.md` §E's inverted constraint now reads "git does NOT backstop the dirty guard for ignored content" with the measured commands (L253-262); REQ-WR-021 (L188-211) no longer asserts a condition that does not exist and states its pre-detection set as explicitly **non-exhaustive**; `spec.md` §D's preamble contradiction is gone ("018-024 are amendment additions", L129-131). Deductions: `design.md` §A.7's decision rule maps half its outcome space to two policies while the same section claims "a procedure, not a judgeme
```

**File**: `.moai/reports/t209/plan-audit.md` (added, +133/-0)
```diff
@@ -0,0 +1,133 @@
+# SPEC Review Report: SPEC-WORKTREE-REAPER-001
+
+Iteration: 1/3
+Verdict: **FAIL**
+Overall Score: **0.55** (Tier L PASS threshold = 0.85, `spec-workflow.md` § SPEC Complexity Tier)
+
+Reasoning context ignored per M1 Context Isolation. The dispatch prompt's
+characterisations were treated as hypotheses to test, not as premises; every
+judgment below is anchored to an artifact line or to a command run in
+`/Users/goos/MoAI/moai-adk-go/.claude/worktrees/t209` (branch
+`WT-worktree-reaper`, HEAD `cd0cee1b8`) on 2026-08-24.
+
+---
+
+## Must-Pass Results
+
+- **[PASS] MP-1 REQ number consistency** — `grep -o 'REQ-WR-[0-9]*' spec.md | sort -u` returns `REQ-WR-001 … REQ-WR-017`, 17 unique, zero-padded, no gaps, no duplicates; `grep -c '^- \*\*REQ-WR-'` = 17. Within the Tier L ceiling of 25.
+- **[PASS] MP-2 GEARS format compliance (requirement layer)** — judged against the 17 `REQ-WR-XXX` entries in `spec.md` §D only; the Given/When/Then entries in `acceptance.md` are the verification layer and are graded under Group 4. All 17 carry a `shall`/`shall not` response clause with a named subject. Two are mislabelled `(Event-detected)` (spec.md:L99, L118) — not a GEARS pattern name — but the sentences themselves are correct Event-driven form (`When …, the … shall …`). Independent mechanical confirmation: `moai spec lint .moai/specs/SPEC-WORKTREE-REAPER-001/spec.md` → exit 0, `✓ No findings`.
+- **[PASS] MP-3 YAML frontmatter validity** — spec.md:L1-15 carries all 12 canonical fields (`id`, `title`, `version` `"0.1.0"`, `status: draft`, `created`/`updated` ISO, `author`, `priority: P1`, `phase: "v3.1.4 target"` (not a prohibited stage name), `module`, `lifecycle: spec-anchored`, `tags`), plus optional `tier: L`. No rejected snake_case alias. `moai spec lint` exit 0.
+- **[N/A] MP-4 language neutrality** — single-language SPEC (Go, `module: internal/cli`); no template-bound or 16-language content.
+- **[PASS] MP-5 D7 cross-SPEC reconciliation** — one external reference, `SPEC-SESSION-WORKTREE-001`; `.moai/specs/SPEC-SESSION-WORKTREE-001/spec.md` exists, `status: completed` (not retired/superseded/archived). No BLOCKING.
+- **[PASS] MP-6 D8 cross-platform discipline** — `grep -rn 'syscall' .moai/specs/SPEC-WORKTREE-REAPER-001/` returns 0 matches → auto-PASS. (Note: the Windows liveness surface is still a real gap, reported as D7 below, but it is not a D8 `syscall` finding.)
+- **[PASS] MP-7 clarification gate** — `grep -rn '\[NEEDS CLARIFICATION' .moai/specs/SPEC-WORKTREE-REAPER-001/` returns exactly one line, `progress.md:14` (`- No \`[NEEDS CLARIFICATION]\` markers remain.`), which is a negation, not a marker. `research.md` does not exist (see D16).
+
+No must-pass criterion fails. **The FAIL is driven by the rubric scores**, principally Testability — see D1.
+
+---
+
+## Category Scores (0.0-1.0, rubric-anchored)
+
+| Dimension | Score | Rubric Band | Evidence |
+|---|---|---|---|
+| Clarity | 0.75 | 0.75 | Prose is unusually precise and the resolution order (design.md:L31-37) and fail-closed table (design.md:L91-99) are exhaustive. Deductions: REQ-WR-005 "behave as it does today" (spec.md:L105-108) is baseline-relative and unmeasurable in the artifact; "the anchor guard" (spec.md:L112-128) never names which call sites it binds (D3); "lock reason" is used for both git's reason and the full porcelain line (design.md:L80-87 vs acceptance.md:L96-99). |
+| Completeness | 0.60 | 0.50-0.75 | All required sections present; §G Out of Scope is exemplary — five `### Out of Scope — <topic>` H3 sub-headings each with specific bullets (spec.md:L184-216). Deductions: the M3 options table (design.md:L149-153) omits the shipped capability that already does most of O3-b (D4); no requirement or edge case covers the removal class M1 newly creates (D2); Tier L is declared but `research.md`, a required Tier L artifact, is absent (D16). |
+| Testability | **0.30** | 0.25-0.50 | **Measured**: `go test ./internal/cli/ -run TestPRMergeCleanup_GhNoAnswerConsultsGitFallback -count=1` on the pre-implementation tree → `ok github.com/modu-ai/moai-adk/internal/cli 0.830s [no tests to run]`, **exit 0** — while acceptance.md:L47-49 asserts "**This is the criterion that fails on the pre-implementation tree**". 14 of 18 criteria are `-run <test-that-does-not-yet-exist>` with expected observation "ok, exit 0", which is exactly what today's tree produces. See D1. |
+| Traceability | 0.55 | 0.50 | `grep -o 'REQ-WR-[0-9]*' acceptance.md | sort -u` returns only `REQ-WR-004 REQ-WR-013` — 2 of 17 requirements are explicitly cited by any criterion. REQ-WR-009, -010, -011 (registry half), -014, -016, -017 have no criterion that exercises them. Mapping is otherwise implicit by section ordering only. |
+
+Aggregate: (0.75 + 0.60 + 0.30 + 0.55) / 4 = **0.55** < 0.85.
+
+---
+
+## Defects Found (structured defect-list)
+
+**D1.** AC-FALSIFIABILITY — `acceptance.md`:L23-241 (14 criteria) — Every criterion of the form `go test ./internal/cli/... -
```

---

### Incident Patch 15: `a9eb896c` (2026-08-24)
**Commit Message**: fix(security): restore the pre-write ast-grep deny capability (t227) (#1637)

* docs(spec): plan the security scan surface decision (t217)

Card t217: decide where the two duplicated security scans run.

Investigation (.moai/reports/t217/investigation.md) establishes the
premise the card asked for: the PreToolUse ast-grep deny has never
fired in 15,638 transcripts spanning 2026-01-28..2026-08-24, verified
against a BRANCH_GUARD_VIOLATION control proving hook deny reasons do
reach transcripts. The mechanism is live, not broken. Two adjacent
defects surfaced: card worktrees resolve no rules config at all, and
15 extensions trigger the scan while only 4 languages carry rules.

Operator decision: keep the pre-write blocking capability but make it
cheap (A), and merge the PostToolUse guardian process into post-tool
(B). SPEC-SEC-SCAN-SURFACE-001 specifies both.

🗿 MoAI

* docs(spec): close six blocking plan-audit findings (t217)

plan-auditor FAIL 0.65 -> remediation. Frontmatter did not parse at all
(tags: was a sequence against a string field), so era classification and
drift detection were dead for this SPEC; moai spec lint now exits 0.

The substantive finding was the pre-filter de

**File**: `.moai/reports/t217/driftcheck.sh` (added, +36/-0)
```diff
@@ -0,0 +1,36 @@
+#!/usr/bin/env bash
+# t217 D4 measurement. Two variants of the wrapper-pair drift check.
+#
+#   unguarded : the form transcribed into AC-SSS-016 (missing the `[ -f ]` guard)
+#   guarded   : the canonical form from CLAUDE.local.md 2.3
+#
+# Arg 1 selects the directory axis to check.
+set -u
+mode="${1:?usage: driftcheck.sh unguarded|guarded [dir]}"
+dir="${2:-internal/template/templates/.claude/hooks/moai}"
+
+case "$mode" in
+  unguarded)
+    for f in "$dir"/*.tmpl; do
+      b="${f%.tmpl}"
+      diff -q "$b" "$f" >/dev/null 2>&1 || echo "DRIFT $b"
+    done
+    ;;
+  guarded)
+    for f in "$dir"/*.tmpl; do
+      b="${f%.tmpl}"
+      [ -f "$b" ] && { diff -q "$b" "$f" >/dev/null 2>&1 || echo "DRIFT $b"; }
+    done
+    ;;
+  pairaxis)
+    # The axis this SPEC actually touches: deployed .sh <-> template .sh.tmpl
+    for f in "$dir"/*.sh.tmpl; do
+      base=".claude/hooks/moai/$(basename "${f%.tmpl}")"
+      [ -f "$base" ] && { diff -q "$base" "$f" >/dev/null 2>&1 || echo "DRIFT $base"; }
+    done
+    ;;
+  *)
+    echo "unknown mode: $mode" >&2
+    exit 2
+    ;;
+esac
```

**File**: `.moai/reports/t217/investigation.md` (added, +207/-0)
```diff
@@ -0,0 +1,207 @@
+# t217 — 보안 스캔 표면 조사 (plan-phase 선행 근거)
+
+카드: t217 / 브랜치: `security-scan-surface` / 워크트리: `.claude/worktrees/t217`
+선행 확인: PR #1625(t214) MERGED — merge commit `ea4c6736f66e8029f2347f94ef82a4e9f88fd74d` (2026-08-24T05:55:11Z)
+측정 트리: `c4e90cd58` (worktree t217, origin/main 기준)
+
+---
+
+## Claim 1 — PreToolUse 차단 능력은 7개월간 단 한 번도 발화하지 않았다
+
+**Evidence**
+
+deny 사유 문자열은 `internal/hook/pre_tool.go:652` 의
+`fmt.Sprintf("Security vulnerabilities detected in %s:\n%s", ...)` 하나뿐이다.
+런타임 발화면 `%s` 가 치환된 형태로, 소스 인용이면 `%s` 그대로 트랜스크립트에 남는다.
+
+```
+$ grep -rlE "Security vulnerabilities detected in [^%]" /Users/goos/.claude/projects | wc -l
+0
+$ grep -rl  "Security vulnerabilities detected in %s"   /Users/goos/.claude/projects | wc -l
+6      # 전부 pre_tool.go 소스를 읽은 기록
+$ grep -rlE "Security vulnerabilities detected in [^%]" /Users/goos/.moai/claude-profiles | wc -l
+1      # 이 조사 세션 자신의 트랜스크립트(자기 grep 패턴) — 자기 히트
+```
+
+**대조군(관측 가능성 검증)** — 훅 deny 사유가 트랜스크립트에 실제로 남는지 먼저 확인했다.
+
+```
+$ grep -rlE "BRANCH_GUARD_VIOLATION:" /Users/goos/.claude/projects | wc -l
+151
+```
+
+BranchGuard deny 사유는 151개 파일에 남아 있다. 따라서 보안 스캔 deny 의 0건은
+"기록되지 않아서 안 보이는 것"이 아니라 **실제 0회**다.
+
+**Baseline-attribution** — 트랜스크립트 12,265개(`~/.claude/projects`) + 3,373개
+(`~/.moai/claude-profiles`), 최고(最古) 파일 mtime 2026-01-28, 측정 시각 2026-08-24.
+`.moai/logs/` 는 근거로 쓸 수 없다: `moai hook` 경로는 모든 slog 레코드를 `io.Discard`
+로 버리므로(`internal/cli/logging.go:50-63`, MOAI_LOG_LEVEL 로도 못 엶)
+`slog.Warn("security scan blocked write operation")` 은 어디에도 착지하지 않는다.
+
+**Gaps** — 이 머신의 트랜스크립트만 훑었다. 배포 사용자 환경은 관측 범위 밖.
+2026-01-28 이전 기록은 존재하지 않으므로 그 이전은 알 수 없다.
+
+---
+
+## Claim 2 — [정정 2026-08-24, run-phase M0] 기전은 **살아 있지 않다**. 0건은 구조적이다
+
+> **이 절의 원래 주장은 틀렸다.** 아래 원문은 `sg` 를 CLI 로 직접 돌린 한 겹만 쟀고,
+> Go 파이프라인 전체를 재지 않았다. run-phase M0 의 12개 픽스처 전수 재생이
+> 4개 커버 언어의 deny 케이스 전부를 `decision=allow` 로 관측하면서 드러났다.
+>
+> **실제 기전**: error 심각도가 있으면 `sg` 는 rc=1 로 끝나고 배너를 **stderr** 에 쓴다.
+> `ast_grep.go:138` 이 `cmd.CombinedOutput()` 으로 두 스트림을 합치므로 JSON 파싱이 깨지고,
+> 폴백 `parseASTGrepRegex` 는 ast-grep 의 **텍스트** 형식을 기대해 JSON 본문에서 아무것도
+>못 찾는다. → `ErrorCount 0` → `ShouldAlert` false → **deny 없음**.
+> warning 은 rc=0 에 stderr 가 비어 파싱이 성공하므로 영향 없다. 즉 **경고는 되고 차단은 절대 안 된다.**
+>
+> ```
+> $ sg scan --json -c <sgconfig> /tmp/moai-t217-probe.go >out.json 2>err.txt ; echo rc=$?
+> rc=1
+> $ cat err.txt
+> Error: 1 error(s) found in code.
+> $ cat out.json err.txt > combined.txt && python3 -c "import json;json.load(open('combined.txt'))"
+> combined FAILS to parse: Extra data: line 51 column 1 (char 1110)
+> ```
+>
+> **Claim 1 에 미치는 영향**: 트랜스크립트 0건은 "능력이 있는데 안 걸렸다"가 아니라
+> **"발화할 수 없다"** 로 읽어야 한다. 0 은 우연이 아니라 구조적이다. 아래 원문의
+> "고장이 아니라 안 걸린 것"이라는 결론은 철회한다.
+>
+> **처리**: 운영자 판정(2026-08-24) — 수집 결함은 **별도 카드로 먼저** 고치고, t217 은
+> 그 수정이 착지한 트리 위에서 진행한다. 한 번도 발화한 적 없는 deny 를 살리는 것은
+> 동작 변경이므로 그 카드가 자기 위험 논거를 가져야 한다.
+
+### (원문 — 반증됨, 기록 보존)
+
+`sg` **CLI 한 겹**은 error 심각도 findings 를 낸다. 아래는 그 사실에 한해서만 참이다.
+
+**Evidence** — 로컬 룰셋으로 error 심각도 findings 가 실제로 나온다.
+
+```
+$ printf 'package main\n\nconst apiKey = "sk-abcdef1234567890"\n' > /tmp/moai-t217-probe.go
+$ sg scan -c .../.moai/config/astgrep-rules/sgconfig.yml --json /tmp/moai-t217-probe.go
+  → ruleId "sec-hardcoded-credential", severity "error"
+$ grep -rh "^severity:" .moai/config/astgrep-rules/ | sort | uniq -c
+  14 severity: error
+  12 severity: warning
+```
+
+`ShouldAlert` 는 error 카운트로 판정하므로(`scanner.go:166` → reporter) 경로는 도달 가능하다.
+
+---
+
+## Claim 3 — 그러나 워크트리 세션에서는 룰이 아예 로드되지 않는다
+
+**Evidence** — `FindRulesConfig`(`rules.go:34`)의 탐색 경로 6개는 전부 프로젝트 루트 기준이고,
+5·6번이 `.moai/config/astgrep-rules/sgconfig.{yml,yaml}` 다. 이 리포의 카드 워크트리에는
+그 디렉터리가 존재하지 않는다(로컬 전용·미추적).
+
+```
+$ ls .moai/config/astgrep-rules          # 워크트리 t217
+ls: .moai/config/astgrep-rules: No such file or directory
+$ ls /Users/goos/MoAI/moai-adk-go/.moai/config/astgrep-rules   # primary
+go  security  sgconfig.yml
+```
+
+configPath 가 빈 문자열이면 `ast_grep.go:129-134` 가 `--config` 를 빼고 `sg scan --json <file>` 를 부른다.
+
+```
+$ cd /tmp && sg scan --json /tmp/moai-t217-probe.go
+Error: No ast-grep project configuration is found.
+```
+
+즉 **워크트리에서 돌아가는 모든 세션은 매 Write 마다 temp 파일 쓰기 + `sg` 프로세스 기동을
+치르고 findings 0 을 받는다.** 팩토리/칸반 레인은 전부 워크트리에서 돌므로 이 리포의 실제
+작업 대부분이 여기에 해당한다.
+
+**Gaps** — 배포 사용자(비-워크트리)는 템플릿이 `.moai/config/astgrep-rules/sgconfig.yml` 을
+깔아주므로(`internal/template/templates/.moai/config/astgrep-rules/`) 룰이 로드된다.
+워크트리 미로딩이 배포판 결함은 아니다.
+
+---
+
+## Claim 4 — 커버리지 비대칭: 15개 확장자가 스캔을 트리거하는데 룰은 4개 언어뿐
+
+**Evidence**
+
+```
+$ grep -rh "^language:" internal/template/templates/.moai/config/astgrep-rules/ | sort | uniq -c
+  20 language: go
+   2 language: javascript
+   2 language: python
+   2 language: typescript
+```
+
+`supportedLanguages`(`ast_grep.go:358-374`)는 python/javascript/typescript/go/rust/java/
+kotlin/c/cpp/ruby/php/swift/csharp/elixir/scala **15개**. `IsSupportedExtension` 이 통과시키는
+확장자면 무조건 temp 파일 + `sg` 기동이 일어난다. 11개 언어는 룰이 0개인
```

**File**: `.moai/reports/t217/plan-audit-2.md` (added, +289/-0)
```diff
@@ -0,0 +1,289 @@
+# SPEC Review Report: SPEC-SEC-SCAN-SURFACE-001
+
+Iteration: 2/2 (Tier M ceiling)
+Verdict: **PASS**
+Overall Score: **0.925** (Tier M PASS threshold = 0.80)
+Score trend: iteration 1 **0.65** → iteration 2 **0.925**. No regression ⇒ no STOP signal.
+
+측정 트리: worktree `/Users/goos/MoAI/moai-adk-go/.claude/worktrees/t217`, 브랜치 `security-scan-surface`, HEAD `2f8f6a6c1dbc16399cd5a5620463923b82135e22` (`git rev-parse HEAD` 실측, working tree clean).
+Reasoning context ignored per M1 Context Isolation. 입력은 `spec.md` / `plan.md` / `acceptance.md`(Tier M 집합) + 근거 `investigation.md` + 커밋된 측정 스크립트 2종. 룰셋은 워크트리에 없어 primary 체크아웃과 템플릿 사본에서 읽었다.
+Iteration 1 기록은 `plan-audit.md` 에 그대로 보존돼 있다.
+
+---
+
+## Must-Pass Results
+
+- **[PASS] MP-1 REQ number consistency** — `grep -o "REQ-SSS-[0-9]\{3\}" spec.md | sort -u` → 16건, `REQ-SSS-001`…`REQ-SSS-016` 연속, 결번·중복 없음.
+- **[PASS] MP-2 GEARS format compliance** — **요구 레이어(`REQ-XXX` in `spec.md`) 기준**. 16개 전부 다섯 패턴 안에 든다: Ubiquitous(001·003·005·008·010·011·013·014·015·016), Where/When(002·004·007), When(006·012), Where(009). `acceptance.md` 의 Given-When-Then 은 검증 레이어의 정상 형식이므로 여기서 감점하지 않았다(Group 4 소관). 통합으로 생긴 복합 문장 문제는 E5 로 별도 기록 — MP-2 실패가 아니다(이유는 E5 본문).
+- **[PASS] MP-3 YAML frontmatter validity** — iteration 1 의 D1 이 해소됐다. 도메인 전용 도구로 재확인:
+  ```
+  $ ~/go/bin/moai spec lint .moai/specs/SPEC-SEC-SCAN-SURFACE-001/spec.md
+  ✓ No findings — all SPEC documents are valid
+  ```
+  `spec.md:13` 이 `tags: "security, hook, pretooluse, posttooluse, ast-grep, performance"` — 캐논 스키마의 콤마 구분 문자열.
+- **[PASS] MP-4 Section 22 language neutrality** — REQ-SSS-005(spec.md:121)가 커버 언어 집합을 **설정에서 파생**하도록 강제하므로 5번째 언어 룰이 추가되면 스캔이 자동 재개된다. 언어 목록의 코드 하드코딩을 금지하는 조항이 같은 REQ 에 있다. 특정 언어를 primary 로 승격시키는 서술 없음.
+- **[PASS] MP-5 D7 cross-SPEC reconciliation** — `grep -oE "SPEC-([A-Z][A-Z0-9]+-)+[0-9]+" spec.md | sort -u` → 자기 자신 1건. retired/superseded 참조 없음.
+- **[PASS] MP-6 D8 cross-platform discipline** — `grep -c syscall spec.md` → `0`. D8-4 auto-PASS.
+- **[PASS] MP-7 clarification gate** — `grep -rc "NEEDS CLARIFICATION" plan.md` → `0`. `research.md` 는 Tier M 이라 부재가 정상.
+
+일곱 개 전부 통과 — M5 Must-Pass Firewall 미발동.
+
+---
+
+## 렌즈 1 — D2 신규 추출 규칙 2행 정면 공격 (최우선)
+
+결론부터: **반례를 찾지 못했다.** 아래가 찾으려 한 것과, 각각 무엇으로 배제했는지다.
+
+### 대상 모집단을 먼저 고정
+
+`regex:` 를 쓰는 룰은 배포 룰셋 전체에 5개뿐이고, 그중 **error 심각도는 4개**(전부 동일한 `sec-hardcoded-credential` 변종)다:
+
+```
+$ grep -rn "regex:" internal/template/templates/.moai/config/astgrep-rules/
+go/hardcoding.yml:15        regex: '^"https://api\.'                    # severity: warning → 제외
+security/credentials.yml:23 regex: "^\"(sk-|AKIA[0-9A-Z]{16}|ghp_[0-9A-Za-z]{36}|xox[baprs]-|AIza[0-9A-Za-z_-]{35})"   # go
+security/credentials.yml:35 regex: "^[\"'](sk-|…)"                      # python
+security/credentials.yml:47 regex: "^[\"'](sk-|…)"                      # javascript
+security/credentials.yml:59 regex: "^[\"'](sk-|…)"                      # typescript
+go/error-handling.yml:28    regex: '^err(e?|s)$'                        # severity: warning → 제외
+```
+
+### 교대(alternation) 행 — 건전함, 배포 룰셋 전수 확인
+
+다섯 분기 `sk-` / `AKIA[0-9A-Z]{16}` / `ghp_[0-9A-Za-z]{36}` / `xox[baprs]-` / `AIza[0-9A-Za-z_-]{35}` 는 **각각 필수 리터럴 접두**를 갖는다(`sk-`, `AKIA`, `ghp_`, `xox`, `AIza`). 매치는 어느 한 분기를 요구하므로 다섯 중 하나도 없으면 매치가 불가능하다 — `any:` 와 동일한 논리이고 §C.2 가 그렇게 적었다. 더불어 정규식은 **노드 텍스트**에, 프리필터는 **페이로드 전체**에 적용되므로 후자가 전자의 상위집합이다. 거짓 skip 경로 없음.
+
+내가 뒤진 무효화 요인과 결과:
+
+| 무효화 요인 | 배포 룰셋에서 | 근거 |
+|---|---|---|
+| 대소문자 무시 플래그 `(?i)` | **없음** | `grep -rn "(?i)" …astgrep-rules/` → rc=1, 0건 |
+| 선택 그룹이 앞에 오는 분기(`(sk-)?AKIA`) | 없음 | 위 5개 정규식 전수 판독 |
+| 문자클래스로 시작하는 분기 | 없음(그룹 **밖**의 `["']` 는 접두로 채택되지 않음) | 동상 |
+| 앵커 `^` 를 리터럴로 오채택 | 해당 없음 | 동상 |
+
+### `kind:` + `regex:` 행 — 건전함, **실측으로** 확인
+
+가장 위험한 가설은 "정규식이 원본 소스 텍스트가 아니라 **디코드된 문자열 값**에 걸린다"였다. 그렇다면 `"\x73k-…"`(디코드하면 `sk-`)가 오늘 deny 되면서 프리필터에는 `sk-` 리터럴이 없어 skip — 정확히 요청받은 형태의 치명 반례가 된다. 실측:
+
+```
+$ cat /tmp/t217r2/esc.go
+package main
+
+const a = "\x73k-abcdef1234567890"
+
+$ sg scan -c …/astgrep-rules/sgconfig.yml --json /tmp/t217r2/esc.go
+findings: []                                   ← 오늘도 deny 되지 않는다
+
+$ sg scan -c …/astgrep-rules/sgconfig.yml --json /tmp/t217r2/raw.go   # const a = "sk-abcdef1234567890"
+"ruleId": "sec-hardcoded-credential"           ← 대조군: 원본 형태는 잡힌다
+```
+
+ast-grep 의 `regex:` 는 **원본 소스 텍스트**에 걸린다. 룰과 프리필터가 같은 문자열을 본다 ⇒ **오늘 deny 되는 구성이 프리필터를 빠져나가는 경로 없음.**
+
+`kind` 가 정말 좁히기만 하는지도 실측했다 — 주석 안의 `sk-`:
+
+```
+$ printf 'package main\n\n// sk-abcdef1234567890 in a comment, not a string literal\nvar x = 1\n' > kindtest.go
+$ sg scan -c … --json kindtest.go
+findings: []
+```
+
+룰은 안 걸리는데 프리필터는 토큰이 있으니 escalate 한다 — **보수적 방향**(불필요한 escalate)이지 누락이 아니다. `rule:` 안의 동급 원자 규칙은 AND 결합이므로 `kind` 는 매치 집합을 좁히기만 하고, 정규식의 필수 리터럴은 그대로 필수로 남는다. §C.2 가 이를 `all:`-형 결합이라 적은 것은 정확하다.
+
+**렌즈 1 판정: 두 행 모두 배포 룰셋에 대해 건전하다. 반례 0건.** 유일한 잔여는 규칙 표가 커버하지 않는 정규식 문법 클래스(E2) — 오늘 룰셋에는 존재하지 않으므로 잠복이다.
+
+---
+
+## 렌즈 2 — 측정 스크립트 감사
+
+##
```

**File**: `.moai/reports/t217/plan-audit.md` (added, +128/-0)
```diff
@@ -0,0 +1,128 @@
+# SPEC Review Report: SPEC-SEC-SCAN-SURFACE-001
+
+Iteration: 1/2 (Tier M ceiling)
+Verdict: **FAIL**
+Overall Score: **0.65** (Tier M PASS threshold = 0.80)
+
+측정 트리: worktree `/Users/goos/MoAI/moai-adk-go/.claude/worktrees/t217`, 브랜치 `security-scan-surface`, HEAD `c5d08ce0ed916d992ab4e79423e8a3b9bac3aa2d` (`git rev-parse HEAD` 실측).
+Reasoning context ignored per M1 Context Isolation — 감사는 `spec.md` / `plan.md` / `acceptance.md` (Tier M 입력 집합) + 근거 파일 `investigation.md` 만 읽고 수행했다. 룰셋 파일은 워크트리에 없어 primary 체크아웃(`/Users/goos/MoAI/moai-adk-go/.moai/config/astgrep-rules/`)과 템플릿 사본에서 읽었다.
+
+---
+
+## Must-Pass Results
+
+- **[PASS] MP-1 REQ number consistency** — `grep -o "REQ-SSS-[0-9]\{3\}" spec.md | sort -u` → 20건, `REQ-SSS-001`…`REQ-SSS-020` 연속, 결번·중복 없음. 굵은 선언(`^- \*\*REQ-SSS-`) 수도 20으로 일치.
+- **[PASS] MP-2 GEARS format compliance** — **요구 레이어(`REQ-XXX` in `spec.md`)에 대해** 판정. 20개 전부 다섯 패턴 중 하나에 맞는다: Ubiquitous(001·002·004·006·009·011·012·013·015·016·017·018·019·020), Where/When 복합(003·005·008·010, spec.md:94·104·115·121), When(007, L109), Unwanted(011 "shall not be derived from…", L124). `acceptance.md` 의 Given-When-Then 은 검증 레이어이므로 여기서 감점하지 않았다(Group 4 소관).
+- **[FAIL] MP-3 YAML frontmatter validity** — 도메인 전용 도구로 확인. **D1 참조.**
+  ```
+  $ ~/go/bin/moai spec lint .moai/specs/SPEC-SEC-SCAN-SURFACE-001/spec.md
+  ERROR  ParseFailure  …spec.md  1  SPEC parsing failed: frontmatter parsing error:
+    YAML parsing error: yaml: unmarshal errors:
+      line 13: cannot unmarshal !!seq into string
+  1 error(s), 0 warning(s)
+  ```
+- **[PASS] MP-4 Section 22 language neutrality** — 이 SPEC 은 `internal/hook` Go 서브시스템 범위이고, 언어별 도구명을 "primary"로 승격시키지 않는다. 오히려 REQ-SSS-006(spec.md:106)이 커버 언어 집합을 **설정에서 파생**하도록 강제하므로, 5번째 언어 룰이 추가되면 스캔이 자동 재개된다 — 중립성을 코드에 고정하지 않고 데이터로 옮기는 방향이다. 하드코딩 언어 목록 금지 조항도 같은 REQ 에 있다.
+- **[PASS] MP-5 D7 cross-SPEC reconciliation** — `grep -oE "SPEC-([A-Z][A-Z0-9]+-)+[0-9]+" spec.md | sort -u` → `SPEC-SEC-SCAN-SURFACE-001` 자기 자신 1건뿐. retired/superseded 참조 없음 ⇒ BLOCKING 없음.
+- **[PASS] MP-6 D8 cross-platform discipline** — `grep -n "syscall" spec.md` → 0건(rc=1). D8-4에 따라 auto-PASS.
+- **[PASS] MP-7 clarification gate** — `grep -rn '\[NEEDS CLARIFICATION' .moai/specs/SPEC-SEC-SCAN-SURFACE-001/` → 0건(rc=1). `research.md` 는 Tier M 이라 부재가 정상.
+
+MP-3 단독으로 M5 Must-Pass Firewall 이 발동해 총점과 무관하게 `Verdict: FAIL` 이다.
+
+---
+
+## Category Scores (0.0-1.0, rubric-anchored)
+
+| Dimension | Score | Rubric Band | Evidence |
+|-----------|-------|-------------|----------|
+| Clarity | 0.50 | 0.50 | §C.2(spec.md:207-210)의 추출 규칙이 **실제 룰셋의 지배적 형태**에 대해 두 갈래로 읽히고, 두 해석의 결과가 정반대다 — D2 |
+| Completeness | 0.75 | 0.75 | 필수 섹션 전부 존재, Out of Scope H3 6개(L226·234·241·247·254·261) 각각 구체 bullet 보유. 감점: frontmatter 타입 오류(D1) + Tier M REQ 예산 초과(D6) |
+| Testability | 0.50 | 0.50 | 16개 AC 중 3개가 관측을 못 한다: 공허 통과(D3), 미구현 트리에서 이미 실패(D4), 존재하지 않는 seam 의존(D5) |
+| Traceability | 0.85 | 0.75~1.0 경계 | §E(spec.md:270-278)가 REQ 20개를 AC/표면에 전부 사상. REQ-SSS-012(순수함수 요구)만 AC-SSS-008/009 를 통해 **간접** 커버 — 직접 검증 AC 없음 |
+
+산술 평균 0.65. Tier M 임계 0.80 미달.
+
+---
+
+## Defects Found (structured defect-list)
+
+**D1** — `spec.md`:L13 — `tags: [security, hook, pretooluse, posttooluse, ast-grep, performance]` 가 YAML **시퀀스**인데, 캐논 스키마(`.claude/rules/moai/development/spec-frontmatter-schema.md` § Field Reference)와 `internal/spec/lint.go:403` `Tags string \`yaml:"tags"\`` 는 **콤마 구분 문자열**을 요구한다. 결과는 필드 하나가 비는 정도가 아니라 **frontmatter 전체 파싱 실패**(`ParseFailure`, ERROR): 12필드 검증·era 분류(`internal/spec/era.go`)·드리프트 탐지가 이 SPEC 에 대해 통째로 죽는다. — Severity: **critical** — Class: **blocking** — Required fix: `tags: "security, hook, pretooluse, posttooluse, ast-grep, performance"` 로 교체하고 `~/go/bin/moai spec lint .moai/specs/SPEC-SEC-SCAN-SURFACE-001/spec.md` 가 0 error 로 떨어지는 것을 확인할 것.
+
+**D2** — `spec.md`:L207-210 (§C.2 두 번째 bullet) — **pre-filter 추출 규칙이 실제 룰셋의 지배적 형태를 다루지 않는다.** §C.2 는 `pattern:` 의 리터럴 런과 `regex:` 의 "필수 리터럴 접두"만 정의하고, "`kind:`-only rules"를 underivable 로 분류한다. 그런데 배포 룰셋의 `sec-hardcoded-credential` 은 **네 커버 언어 전부**에서 `pattern:` 없이 `kind:` + `regex:` 형태다:
+```
+# internal/template/templates/.moai/config/astgrep-rules/security/credentials.yml
+rule:
+  kind: interpreted_string_literal          # go  (js/ts/python 은 kind: string)
+  regex: "^\"(sk-|AKIA[0-9A-Z]{16}|ghp_[0-9A-Za-z]{36}|xox[baprs]-|AIza[0-9A-Za-z_-]{35})"
+```
+이 형태를 "`kind:`-only" 로 읽으면 **go/js/ts/python 네 언어 전부 underivable** ⇒ REQ-SSS-010 에 따라 무조건 escalate ⇒ **A1 은 어떤 언어에서도 단 한 번도 skip 하지 않는다**(순수 비용). 반대로 "리터럴 앵커가 있으니 derivable" 로 읽으면 정규식 **교대(alternation)** 처리 규칙이 필요한데 §C.2 에 그 규칙이 없다 — `all:`/`any:` 만 정의돼 있다. 두 해석은 AC-SSS-011(§B.4, `.js` payload 가 skip 되어야 함)의 달성 가능 여부를 정반대로 만든다. 덧붙여 §C.2 의 정직성 문단(spec.md:214-218)은 "Go 만 잘 안 걸리고 나머지 세 언어는 절감이 크다"고 단언하는데, 이 룰이 네 언어에 동일하게 걸려 있으므로 그 단언은 D2 가 해소되기 전까지 **미검증 전제**다(VCI §1.1 surface 4). — Severity: **critical** — Class: **blocking** — Required fix: §C.2 에 (a) `pattern:` 없이 `kind:`+`regex:` 인 룰의 처리(derivable/underivab
```

**File**: `.moai/reports/t217/skiprate.py` (added, +78/-0)
```diff
@@ -0,0 +1,78 @@
+"""t217 C.3 measurement: what fraction of real files would the derived literal
+pre-filter skip (i.e. NOT dispatch a scan for)?
+
+Token sets are derived by hand from the SHIPPED ruleset's error-severity rules
+(internal/template/templates/.moai/config/astgrep-rules), applying every row of
+spec.md C.2. The shipped ruleset was verified byte-identical to the primary
+checkout's copy for injection.yml, the file the audit's E1 finding concerned.
+
+SOUNDNESS NOTE. A token set is a UNION, and the pre-filter skips only when NONE
+of its tokens is present. Adding a token can therefore only LOWER a reported
+skip rate, never raise it. An incomplete token set inflates the saving, which is
+why every rule below is enumerated rather than sampled. This is the defect the
+plan audit found in v1 of this script: the python `any:` has FOUR branches and
+only two were listed, inflating python's rate from 85.7% to 92.9%.
+
+go -- 8 error rules
+  go-error-ignored-blank         $_, $ERR = $FUNC($$$ARGS)         -> ',' '='
+  go-defer-in-loop               for .. { .. defer $R.$M() .. }    -> 'for' 'defer'
+  sec-hardcoded-api-key          const $NAME = "sk-$$$REST"        -> 'const'
+  sec-hardcoded-jwt-signing-key  SignedString([]byte("$H"))        -> 'SignedString'
+  sec-command-injection-shell    exec.Command("sh", "-c", $CMD)    -> 'exec.Command'
+  sec-template-injection-html    template.HTML($USER_INPUT)        -> 'template.HTML'
+  sec-weak-hash-md5              md5.New()                         -> 'md5.New'
+  sec-hardcoded-credential       kind: + regex: alternation        -> credential prefixes
+  (',' and '=' from the first rule dominate -- they appear in nearly every Go
+   file -- so the go rate is bounded above by that one rule.)
+
+javascript / typescript -- 2 error rules
+  sec-command-injection-exec     any: child_process.exec | cp.exec -> BOTH branches
+  sec-hardcoded-credential       kind: + regex: alternation        -> credential prefixes
+
+python -- 2 error rules
+  sec-command-injection-shell    any: subprocess.call | subprocess.run
+                                    | subprocess.Popen | os.system -> ALL FOUR branches
+  sec-hardcoded-credential       kind: + regex: alternation        -> credential prefixes
+
+Credential prefixes are the mandatory literal prefix of each branch of
+  ^["'](sk-|AKIA[0-9A-Z]{16}|ghp_[0-9A-Za-z]{36}|xox[baprs]-|AIza[0-9A-Za-z_-]{35})
+
+Only whitespace-free literals are used as tokens. ast-grep normalizes whitespace
+when matching, so a run such as " = " is not guaranteed to appear verbatim in the
+source; '=' is.
+"""
+import os
+import sys
+
+CRED = ['sk-', 'AKIA', 'ghp_', 'xox', 'AIza']
+
+tok = {
+    'go': [',', '=', 'for', 'defer', 'const', 'SignedString', 'exec.Command',
+           'template.HTML', 'md5.New'] + CRED,
+    'js': ['child_process.exec', 'cp.exec'] + CRED,
+    'py': ['subprocess.call', 'subprocess.run', 'subprocess.Popen', 'os.system'] + CRED,
+}
+ext = {'.go': 'go', '.js': 'js', '.jsx': 'js', '.mjs': 'js', '.cjs': 'js',
+       '.ts': 'js', '.tsx': 'js', '.mts': 'js', '.cts': 'js', '.py': 'py'}
+
+root = sys.argv[1]
+skipdirs = {'.git', 'node_modules', 'vendor', 'public', 'resources', 'dist', 'worktrees'}
+stat = {}
+for dp, dn, fn in os.walk(root):
+    dn[:] = [d for d in dn if d not in skipdirs]
+    for f in fn:
+        e = os.path.splitext(f)[1]
+        if e not in ext:
+            continue
+        lang = ext[e]
+        try:
+            c = open(os.path.join(dp, f), encoding='utf-8', errors='replace').read()
+        except Exception:
+            continue
+        hit = any(t in c for t in tok[lang])
+        s = stat.setdefault(lang, [0, 0])
+        s[0] += 1
+        if not hit:
+            s[1] += 1
+for k, (n, skip) in sorted(stat.items()):
+    print(k, 'files=' + str(n), 'wouldSKIP=' + str(skip), 'rate=%.1f%%' % (100 * skip / n))
```

**File**: `.moai/reports/t227/risk-inventory.md` (added, +86/-0)
```diff
@@ -0,0 +1,86 @@
+# t227 — 차단 복원 전 위험 선재고
+
+카드 t227 이 [HARD] 로 요구한 "복원 직후 무엇이 막히기 시작하는지" 실측.
+트리: `.claude/worktrees/t227`, 브랜치 `WT-deny-restore`, 측정 시각 2026-08-24.
+
+## Claim — 수집 결함만 고치면 이 리포 328개 파일에 대한 Write 가 막힌다
+
+**Evidence** — 배포 룰셋으로 리포 소스를 전수 스캔.
+
+```
+$ sg scan --json -c /Users/goos/MoAI/moai-adk-go/.moai/config/astgrep-rules/sgconfig.yml \
+    internal/ pkg/ cmd/ > /tmp/t227-scan.json 2>/tmp/t227-scan.err
+rc=1
+$ cat /tmp/t227-scan.err
+Error: 2065 error(s) found in code.
+Help: Scan succeeded and found error level diagnostics in the codebase.
+```
+
+룰별 분해 (findings 총 2,996 중 error 심각도 2,065):
+
+| ruleId | error findings | 영향 파일 |
+|---|---:|---:|
+| `go-error-ignored-blank` | **2,025** | **328** |
+| `sec-command-injection-shell` | 23 | — |
+| `sec-hardcoded-credential` | 13 | — |
+| `sec-command-injection-exec` | 2 | — |
+| `sec-weak-hash-md5` | 2 | — |
+| **`go-error-ignored-blank` 제외 소계** | **40** | **17** |
+
+`ShouldAlert` 는 error 카운트로 판정하므로, 수집 결함이 고쳐지는 순간 위 파일들의
+내용을 담은 Write 는 deny 됩니다.
+
+**Baseline-attribution** — 위 명령을 이 트리(`WT-deny-restore`, merge 커밋 `5eb53ada3`)에서
+실행하고 그 출력을 파싱한 결과. 프라이머리 체크아웃의 로컬 dogfood 룰셋을 config 로 지정했고,
+해당 룰셋은 템플릿 배포본과 동일 내용이다(t217 iter3 에서 확인).
+
+## 원인 — 보안 룰이 아닌 스타일 룰이 error 심각도에 앉아 있다
+
+2,025/2,065 = **98.1%** 가 `go-error-ignored-blank` 한 룰이다. 이 룰이 잡는 것은
+`_ = foo()` — 이 코드베이스 전역에서 쓰는 Go 관용구이며 보안 결함이 아니다.
+
+`go/` 디렉터리에서 error 심각도인 룰은 정확히 둘:
+
+```
+$ grep -rB4 "^severity: error" .../astgrep-rules/go/ | grep "id:"
+  go-error-ignored-blank
+  go-defer-in-loop
+```
+
+둘 다 보안 룰이 아니다. 심각도가 곧 **쓰기 거부**로 번역되는 게이트에서 스타일 룰이
+`error` 를 다는 것은 분류 오류다.
+
+## 남는 40건의 성격
+
+`go-error-ignored-blank` 를 제외한 40건 17파일은 대부분 **테스트와 픽스처**다:
+`internal/hook/branch_guard_test.go` 의 셸 문자열(가드 패턴 테스트용), `internal/cli/glm_*_test.go`
+의 더미 토큰, `internal/astgrep/testdata/fixtures/`, 그리고 t217 이 만든
+`internal/hook/security/testdata/scan-corpus/` — 마지막 것은 **걸리는 게 정상**이다
+(deny 를 관측하기 위해 존재하는 픽스처).
+
+프로덕션 코드 경로의 히트는 `internal/navigator/tiers/drift.go:75`
+(`sec-command-injection-shell`) 1건이 눈에 띈다.
+
+## 운영자 판정 (2026-08-24)
+
+**수집 결함 수리 + `go-error-ignored-blank`·`go-defer-in-loop` 를 error → warning 으로 강등.**
+잘못 분류된 것을 바로잡는 것이지 게이트를 느슨하게 하는 것이 아니다. 강등 후에도 두 룰은
+warning 경로로 사용자에게 계속 보인다(warning 은 rc=0·stderr 빈 상태라 지금도 정상 동작).
+
+강등 후 예상 노출: **40건 17파일**.
+
+## Gaps
+
+- 파일 스캔은 Write 페이로드의 근사다. deny 는 쓰기 **전** 내용에 걸리므로, 기존 파일 히트 수가
+  곧 차단될 Write 수는 아니다. 다만 같은 파일을 다시 쓰면 같은 히트가 나므로 상한이 아니라
+  현실적 추정으로 읽어야 한다.
+- 이 리포 한 곳의 측정이다. 배포 사용자 코드베이스의 분포는 관측 범위 밖 — 다만
+  `_ = foo()` 는 Go 전반의 관용구라 다른 Go 프로젝트에서도 같은 형태로 나타날 것으로 본다.
+- `internal/navigator/tiers/drift.go:75` 가 진짜 결함인지 오탐인지는 판정하지 않았다. 이 카드
+  범위 밖이며, 강등 후에도 error 로 남으므로 별도로 다뤄야 한다.
+
+## Residual-risk
+
+- 강등은 배포 룰셋 수정이므로 템플릿 미러 + 중립성 가드가 따라붙는다.
+- 프라이머리 체크아웃의 `.moai/config/astgrep-rules/` 는 미추적 로컬 dogfood 사본이라 이
+  브랜치가 갱신하지 않는다. 강등이 로컬에도 반영되려면 별도 동기화가 필요하다.
```

**File**: `.moai/specs/SPEC-SEC-SCAN-SURFACE-001/acceptance.md` (added, +271/-0)
```diff
@@ -0,0 +1,271 @@
+# Acceptance Criteria — SPEC-SEC-SCAN-SURFACE-001
+
+Every criterion below is closed by **running something** and reading its output. No criterion is
+closed by a grep over source text. Every criterion states the value measured on the
+**pre-implementation tree** next to its PASS value; where the two are equal the criterion
+observes nothing and does not belong here.
+
+No criterion asserts a latency figure. Cost is expressed as a count of scans dispatched and temp
+files created.
+
+**The instrument.** Counts are taken on a fake scanner injected through the interface M0 step 1
+introduces, and by snapshotting the process temp directory. `ScanFile` is the only route from
+this path to an `sg` spawn, so a `ScanFile` count of 0 proves a spawn count of 0 — exact for
+every skip case asserted below. `astGrepScanner.scanFunc` is **not** the instrument: it is
+consulted only inside `ScanMultiple` (`ast_grep.go:199-200`) and the single-file `Scan` execs
+`sg` directly at `:137`.
+
+---
+
+## §A Definition of Done
+
+- AC-SSS-001 through AC-SSS-016 all pass, each with the command run and its verbatim output cited.
+- `go test ./internal/hook/...` and `go test ./internal/cli/...` pass on the branch.
+- `go vet ./...` is clean; `golangci-lint run` reports no new finding.
+- `~/go/bin/moai spec lint .moai/specs/SPEC-SEC-SCAN-SURFACE-001/spec.md` reports 0 errors.
+  (The linter takes files, not directories — a directory argument fails with
+  `ParseFailure ... is a directory`, measured.)
+- CI is green on the pull request. CI, not a local run, is the verdict for the full suite.
+
+---
+
+## §B Criteria
+
+### B.1 The invariant
+
+**AC-SSS-001 — the deny verdict is unchanged, and the pre-filter suppresses no deny.**
+Given the differential fixture corpus of plan §F M0, recorded against the **unmodified** gate,
+When the corpus is replayed through `scanWriteContent` after M1, M2, and M3 have landed,
+Then (i) every fixture yields the identical `(decision, reason-nonempty)` pair it yielded before,
+and (ii) for every fixture that denies, the derived pre-filter would not have skipped it.
+Command: `go test ./internal/hook/ -run TestScanWriteContentDifferential -count=1 -v`.
+Pre-implementation measurement: assertion (i)'s expectations are generated from the untouched
+tree in M0 and committed before any behaviour change; assertion (ii) does not compile before M2.
+Corpus validity gate: at least one fixture per covered language must **deny** on the
+pre-implementation tree, else the corpus observes nothing and is rejected.
+
+---
+
+### B.2 Item A2 — no rules config, no scan
+
+**AC-SSS-002 — no config resolves ⇒ no scan dispatched.**
+Given a project root containing no `sgconfig.yml`, no `.ast-grep/`, and no
+`.moai/config/astgrep-rules/`,
+When a `.go` Write payload is passed to `scanWriteContent` with a counting fake scanner,
+Then the fake records **0** `ScanFile` calls and the decision is allow.
+Command: `go test ./internal/hook/ -run TestScanWriteContentNoConfigNoScan -count=1 -v`.
+Pre-implementation measurement: **1** `ScanFile` call. RED before M1.
+
+**AC-SSS-003 — no config resolves ⇒ no temp file.**
+Given the same no-config project root,
+When the same payload is scanned,
+Then no file matching `moai-security-scan-*` appears in the process temp directory during or
+after the call (snapshot before, snapshot after, compare the matching sets).
+Command: `go test ./internal/hook/ -run TestScanWriteContentNoConfigNoTempFile -count=1 -v`.
+Pre-implementation measurement: exactly **1** such file is created (and then removed by the
+deferred cleanup, which is why the check is a during-call snapshot). RED before M1.
+
+**AC-SSS-004 — the scanner performs no second config resolution.**
+Given a `RuleManager` stub counting `FindRulesConfig` calls, wired into the scanner, and a
+caller-side resolution counter,
+When one Write payload is processed end to end with a resolvable config,
+Then the **scanner-side** counter reads **0** and the caller-side counter reads **1**.
+Command: `go test ./internal/hook/ -run TestConfigResolvedByCallerNotScanner -count=1 -v`.
+Pre-implementation measurement: scanner-side **1**, caller-side **0** — measured directly:
+`grep -rn "FindRulesConfig" internal/ | grep -v _test` shows the only pre-write-path call at
+`internal/hook/security/scanner.go:84`, inside `ScanFile`. The two counters invert, so the
+criterion cannot pass on the untouched tree.
+
+---
+
+### B.3 Item A3 — no rules for this language, no scan
+
+**AC-SSS-005 — an uncovered language dispatches no scan.**
+Given a project root carrying the shipped ruleset (four covered languages),
+When a payload whose extension maps to an uncovered but ast-grep-supported language is scanned
+(one case per uncovered language: `.rs`, `.java`, `.kt`, `.c`, `.cpp`, `.rb`, `.php`, `.swift`,
+`.cs`, `.ex`, `.scala`),
+Then the fake records **0** `ScanFile` calls for every case, and a `.go` control case in the same
+test records 
```

**File**: `.moai/specs/SPEC-SEC-SCAN-SURFACE-001/plan.md` (added, +211/-0)
```diff
@@ -0,0 +1,211 @@
+# Implementation Plan — SPEC-SEC-SCAN-SURFACE-001
+
+Ordering principle: the decisions most likely to change come first. M0 pins the invariant and
+builds the measurement instrument the rest of the plan depends on. M1 fixes the shape of the gate
+and of the config-derived language set. M2 carries the one genuinely uncertain piece (pre-filter
+derivation). M3 is the mechanical merge, deferred to last because its design is already settled
+by an existing in-tree merge helper.
+
+---
+
+## §A Context
+
+Evidence base: `.moai/reports/t217/investigation.md`, plus the measurements in `spec.md` §A.1.
+Requirements: `spec.md` §B. The pre-filter-derivation decision, its extraction table, its
+measured skip rates, and its rejected alternative are recorded in `spec.md` §C and are not
+re-opened during implementation.
+
+Two card premises were corrected during authoring (`spec.md` §A.2). One auditor-suggested remedy
+was also corrected — see B-5 below.
+
+---
+
+## §B Known issues in the current surface
+
+| # | Issue | Location | Consequence for the plan |
+|---|---|---|---|
+| B-1 | Config is resolved inside `SecurityScanner.ScanFile`, not in the caller, so the caller cannot short-circuit on an empty result. Measured: exactly one resolution today, at `scanner.go:84`. | `internal/hook/security/scanner.go:84` | M1 moves it to the caller and removes the scanner-side call |
+| B-2 | The temp file is created **before** anything checks whether a scan can produce a finding. | `internal/hook/pre_tool.go` `scanWriteContent` | M1 reorders |
+| B-3 | `IsSupportedExtension` is the only gate between a Write and an `sg` spawn; it answers "can ast-grep parse this?", not "do we have rules for this?". | `internal/hook/security/ast_grep.go` | M1 adds the covered-language gate |
+| B-4 | `slog` output on the `moai hook` path is discarded (`internal/cli/logging.go`), so the existing `slog.Warn` / `slog.Info` lines in `scanWriteContent` are not an observation channel. | `internal/cli/logging.go` | No acceptance criterion may depend on log output |
+| B-5 | **No injection seam exists on the single-file scan path.** `astGrepScanner.scanFunc` is consulted only inside `ScanMultiple` (`ast_grep.go:199-200`); the single-file `Scan` execs `sg` directly at `:137`. The plan audit proposed injecting a stub at the handler level instead — but `preToolHandler.scanner` is a **concrete** `*security.SecurityScanner` (`pre_tool.go:325`), so that is not possible either without a type change. | `internal/hook/security/ast_grep.go`, `internal/hook/pre_tool.go:325` | **M0 owns creating the seam** — see M0 step 1 |
+
+---
+
+## §C Pre-flight
+
+- Confirm the tree still matches the premises: `.moai/config/astgrep-rules` absent in this
+  worktree, `sg` on PATH.
+- Confirm `mergeHandlerOutput` still accumulates `additionalContext` and `systemMessage`
+  (`internal/hook/registry.go:180`), and that `TestDispatch_MergeAccumulatesAdditionalContext`
+  passes on the untouched tree. M3's design depends on it.
+- Copy the shipped ruleset (`internal/template/templates/.moai/config/astgrep-rules/`) into a
+  `t.TempDir()` project root for every test that needs a resolvable config. Never point a test
+  at the developer's real `.moai/config/astgrep-rules/`, which is local-only and dogfood-grade.
+
+---
+
+## §D Constraints
+
+- **The deny verdict is the invariant.** No milestone may land without M0's differential test
+  passing, including its second assertion (no denying fixture is suppressed by the pre-filter).
+- **No latency assertion anywhere.** Cost is measured as counts. The instrument is defined in M0
+  and is the **number of `ScanFile` calls reaching the scanner**, plus the presence or absence of
+  a temp file. `ScanFile` is the sole route from this path to an `sg` spawn, so zero `ScanFile`
+  calls proves zero spawns; the proxy is exact for every skip case an acceptance criterion
+  asserts.
+- **Fail-open on every uncertainty.** Unreadable config, unparseable rule, unrecognized rule
+  shape, empty derived language set ⇒ escalate to `sg`. Never skip.
+- **Template-First.** Every `.claude/` edit lands with its `internal/template/templates/.claude/`
+  mirror in the same commit. This SPEC changes `settings.json` only; it touches no hook wrapper.
+- **Test scope.** Run `go test ./internal/hook/...` and `go test ./internal/cli/...`; do not run
+  the full suite locally. CI on the pull request is the verdict.
+
+---
+
+## §E Self-verification
+
+Before declaring any milestone complete, the implementer states the command run and its verbatim
+output for each acceptance criterion the milestone closes (`acceptance.md`). A criterion with no
+cited command output is a gap, not a pass.
+
+---
+
+## §F Milestones
+
+### M0 — Priority High — Build the instrument, then pin the invariant
+
+Nothing below can be measured until the seam exists (B-5), and nothing can be safely changed
+until the invariant is recorded against the untouched gate.
+
+1. **Crea
```

#### Recent Merged Pull Requests:
- **PR #1745** (2026-10-01): feat(t1298): graph-freshness 충돌 PR 스킵 가시화 — pull_request_target 가드 직 (@GoosLab)
- **PR #1744** (2026-10-01): docs(t1297): adk codemaps 전면 재생성 — graph-freshness 4계층 fresh 복귀 (@GoosLab)
- **PR #1743** (2026-10-01): fix(cli): factory complete supports the primary-develop integration flow (card t1294) (@GoosLab)
- **PR #1742** (2026-10-01): fix(cli): factory checkout assertion accepts case-variant logical PWD; registry CWD normalization (card t1293) (@GoosLab)
- **PR #1741** (2026-10-01): feat(t1277): backlog queue sort control and side detail pane (@GoosLab)
- **PR #1740** (2026-09-30): refactor(config): retire workflow.worktree.tmux_preferred (card t1287) (@GoosLab)
- **PR #1739** (closed): fix(t1286): fable alias targets claude-fable-5-1 — catalog generation bump (@GoosLab)
- **PR #1738** (closed): fix(t1281): manual merge_method default merge + git strategy mode descriptions + GLM note refocus (@GoosLab)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
