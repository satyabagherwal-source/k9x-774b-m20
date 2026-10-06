# Forensic Learning Record (Deep Inspection): modu-ai/moai-adk

> **Canonical Artifact**: `07_PROJECT_LEARNING/modu-ai-moai-adk-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/modu-ai/moai-adk](https://github.com/modu-ai/moai-adk))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:16:43.049Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `modu-ai/moai-adk`
- **Description**: Agentic development harness for Claude Code — SPEC-driven plan/run/sync, TRUST 5 quality gates, model+effort routing, and Claude×GLM multi-LLM cost control. Single Go binary, 16 languages, zero deps.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 1229 stars

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

### Core Architecture Module: `internal/cli/codex_hooks_seed.go`
```
package cli

// codex_hooks_seed.go — SPEC-HANDOFF-NEUTRAL-001 M1.3 (REQ-HN-005/006/007).
//
// The fail-open wrapper around codexwiring.SeedHooksIfMissing shared by the
// worktree materializer (new trees) and the launcher entry path (backfill for
// trees created before this wiring existed). Seeding is additive, never a
// gate: a failure emits a diagnostic on the caller's writer and the caller
// proceeds (REQ-HN-007). Success stays quiet — the seed is not a user-facing
// event.

import (
	"fmt"
	"io"
	"os"
	"path/filepath"

	"github.com/modu-ai/moai-adk/internal/codexwiring"
)

// sessionWorktreeSeedCodexHooks is the seam over the real seeding call so
// tests can run the real body against temp trees or observe the fail-open
// posture, without touching a real worktree.
var sessionWorktreeSeedCodexHooks = seedCodexHooksReal

// seedCodexHooksReal seeds tree's .codex/hooks.json (MoAI-owned entries only,
// existing file untouched) and is fail-open on every error path.
func seedCodexHooksReal(tree string, out io.Writer) {
	if tree == "" {
		return
	}
	if _, err := codexwiring.SeedHooksIfMissing(tree); err != nil {
		_, _ = fmt.Fprintf(out, "moai: codex hooks seeding skipped (%v); continuing without it\n", err)
	}
}

// seedWorktreeEntryHooks applies the launcher-entry backfill (design D2.5
// A-보완): only a tree that already exists on disk is seeded — one stat per
// entry. A not-yet-created tree is Claude Code's to create, and its next
// entry seeds it.
//
// Call this ONLY after the concurrent-writer admission succeeds: the backfill
// writes into the target tree, so a refused launch must never reach it (audit
// F0, sync-audit-opus.md — a refused entry left `?? .codex/hooks.json` behind).
func seedWorktreeEntryHooks(tree string, warn io.Writer) {
	if tree == "" {
		return
	}
	if info, err := os.Stat(tree); err != nil || !info.IsDir() {
		return
	}
	sessionWorktreeSeedCodexHooks(tree, warn)
}

// seedAdmittedWorktreeHooks resolves the -w/--worktree value of an already
// validated launcher argv the same way ccWorktreeWriterPrecheck and
// resolveWorktreeL2Path do, and applies the launcher-entry backfill. The entry
// flows call it at their post-admission point so the backfill only runs on an
// admitted launch. Resolution mirrors resolveWorktreeL2Path's: an absolute
// value is used directly (prefix validation already happened), a short name
// resolves against <root>/.claude/worktrees/<name>.
func seedAdmittedWorktreeHooks(args []string, warn io.Writer) {
	value, ok := worktreeFlagValue(args)
	if !ok || value == "" {
		return
	}
	tree := value
	if !filepath.IsAbs(tree) {
		root, err := findProjectRootFn()
		if err != nil || root == "" {
			return
		}
		tree = filepath.Join(root, ".claude", "worktrees", value)
	}
	seedWorktreeEntryHooks(tree, warn)
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

### Core Architecture Module: `internal/cli/doctor_hook_delivery.go`
```
// Package cli — doctor_hook_delivery.go
//
// Hook Delivery doctor check (SPEC-UPDATE-HOOK-DELIVERY-001, Option B —
// detect + guide). The shipped template's hook entries are compared against
// the project's .claude/settings.json within the hook event keys the project
// already carries; entries the template carries but the project file lacks
// are reported with per-entry placement and remediation guidance.
//
// READ-ONLY by mandate (REQ-UHD-008): this check never writes the user's
// settings.json. `moai update` merge behavior is deliberately unchanged —
// Option A (delivery) was rejected by the operator on 2026-09-03; the merge
// path's silent drop of additions inside carried event keys is documented in
// the SPEC and characterized by TestMergeDropsTemplateAdditionInsideCarriedEventKey.
package cli

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"
	"strings"

	"github.com/modu-ai/moai-adk/internal/cli/uikit"
	"github.com/modu-ai/moai-adk/internal/template"
)

// hookDeliveryScriptPattern matches the .claude/hooks/moai handler path a
// hook entry references. Forward slashes are canonical in settings.json hook
// args on every platform (the entries run through bash), so no separator
// alternation is needed.
var hookDeliveryScriptPattern = regexp.MustCompile(`\.claude/hooks/moai/[A-Za-z0-9._/-]+\.sh`)

// hookDeliveryCheckCommand is the post-update deletion check the guidance
// points at: the manual verification a user runs after `moai update` to see
// whether the update deleted managed files from their project.
const hookDeliveryCheckCommand = "git status --porcelain | grep '^ D'"

// checkHookDelivery reports hook entries the shipped template's settings.json
// carries but the project's .claude/settings.json is missing, within hook
// event keys the project already carries.
//
// Status contract:
//   - ok   — full parity, or one of the informational skips below
//     (no settings.json, no hooks object, template set unavailable)
//   - warn — missing entries found, and/or a malformed input anomaly
//     (unparseable settings.json, a hook event key holding a non-array)
//
// The check is advisory (doctor exits 0 on warn) and never writes anything.
func checkHookDelivery(projectRoot string, verbose bool) DiagnosticCheck {
	check := DiagnosticCheck{Name: "Hook Delivery"}

	settingsPath := filepath.Join(projectRoot, ".claude", "settings.json")
	raw, err := os.ReadFile(settingsPath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			check.Status = uikit.CheckOK
			check.Message = "skipped — no .claude/settings.json in this project"
			return check
		}
		check.Status = uikit.CheckWarn
		check.Message = fmt.Sprintf(".claude/settings.json unreadable — hook-delivery comparison skipped: %v", err)
		return check
	}

	var userRoot map[string]any
	if err := json.Unmarshal(raw, &userRoot); err != nil {
		check.Status = uikit.CheckWarn
		check.Message = fmt.Sprintf(".claude/settings.json is not valid JSON — hook-delivery comparison skipped: %v", err)
		return check
	}

	userHooksValue, present := userRoot["hooks"]
	if !present {
		check.Status = uikit.CheckOK
		check.Message = "skipped — .claude/settings.json carries no hooks"
		return check
	}
	userHooks, ok := userHooksValue.(map[string]any)
	if !ok {
		check.Status = uikit.CheckWarn
		check.Message = ".claude/settings.json hooks value is not an object — hook-delivery comparison skipped"
		return check
	}

	templateHooks, err := renderedTemplateHooks(projectRoot)
	if err != nil {
		// The template side is the binary's own embedded content; failing to
		// render it is an internal anomaly, not a user-facing problem, so the
		// check degrades to an informational skip rather than a nag.
		check.Status = uikit.CheckOK
		check.Message = "skipped — shipped template hook set unavailable"
		if verbose {
			check.Detail = fmt.Sprintf("template render error: %v", err)
		}
		return check
	}

	var missing []string
	var anomalies []string
	for _, eventKey := range sortedTemplateEventKeys(templateHooks) {
		userArr, ok := userHooks[eventKey].([]any)
		if !ok {
			if _, carried := userHooks[eventKey]; carried {
				// REQ-UHD-011: a carried event key holding a non-array is
				// reported and skipped — never modified, never guessed at.
				anomalies = append(anomalies, fmt.Sprintf("hooks.%s is not an array — skipped", eventKey))
			}
			// A key the user does NOT carry is template-introduced and
			// delivered by today's merge (REQ-UHD-001) — not a gap, so it is
			// deliberately not reported here.
			continue
		}
		templateArr, templateIsArr := templateHooks[eventKey].([]any)
		if !templateIsArr {
			continue // malformed template side: skip the key rather than panic
		}
		templateIDs := hookEntryIdentities(templateArr)
		userIDs := hookEntryIdentities(userArr)
		for id, displayName := range templateIDs {
			if _, found := userIDs[id]; !found {
				missing = append(missing, fmt.Sprintf("hooks.%s missing %s", eventKey, displayName))
			}
		}
	}

	if len(missing) == 0 && len(anomalies) == 0 {
		check.Status = uikit.CheckOK
		check.Message = "hook entries match the shipped template"
		if verbose {
			check.Detail = fmt.Sprintf("compared %d carried hook event key(s)", len(userHooks))
		}
		return check
	}

	check.Status = uikit.CheckWarn
	sort.Strings(missing)
	sort.Strings(anomalies)
	lines := append([]string{}, missing...)
	lines = append(lines, anomalies...)
	if len(missing) > 0 {
		lines = append(lines, fmt.Sprintf(
			"re-add each missing entry under the named event key (copy the block from the template settings.json of your moai version); after moai update verify no managed file was deleted: %s",
			hookDeliveryCheckCommand))
	}
	check.Message = strings.Join(lines, "; ")

	if verbose {
		var detail []string
		for _, m := range missing {
			detail = append(detail, m+" — add the entry inside that event key's array in .claude/settings.json")
		}
		detail = append(detail, anomalies...)
		detail = append(detail, fmt.Sprintf(
			"post-update verification: %s — a hit means moai update deleted a managed file; restore it with git restore -- <path> before re-adding hook entries",
			hookDeliveryCheckCommand))
		check.Detail = strings.Join(detail, "\n")
	}
	return check
}

// renderedTemplateHooks renders the embedded settings.json.tmpl for the build
// under test and returns its hooks object. The render honors the project's
// hook.opt_in toggle so a project that opted out of the observability hook
// series is never flagged for hooks its own updates deliberately omitted.
func renderedTemplateHooks(projectRoot string) (map[string]any, error) {
	embedded, err := template.EmbeddedTemplates()
	if err != nil {
		return nil, fmt.Errorf("load embedded templates: %w", err)
	}
	rendered, err := template.NewRenderer(embedded).Render(
		".claude/settings.json.tmpl",
		template.NewTemplateContext(
			template.WithPlatform(runtime.GOOS),
			template.WithHookOptIn(readHookOptInEnabled(projectRoot)),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("render template settings.json: %w", err)
	}
	var root map[string]any
	if err := json.Unmarshal(rendered, &root); err != nil {
		return nil, fmt.Errorf("parse rendered template settings.json: %w", err)
	}
	hooks, ok := root["hooks"].(map[string]any)
	if !ok {
		return nil, errors.New("rendered template settings.json carries no hooks object")
	}
	return hooks, nil
}

// hookEntryIdentities derives one identity string per entry of a hook event
// array (SPEC-UPDATE-HOOK-DELIVERY-001 design.md §G identity rule). An entry
// referencing .claude/hooks/moai handler scripts is identified by those paths
// plus its matcher value — the matcher distinguishes the several blocks that
// wire the SAME handler for different event patterns (the template's
// hooks.PreToolUse carries one block per matcher, and the defect surface this
// SPEC reports on is exactly "a new matcher block inside a carried event key").
// Cosmetic edits elsewhere in the entry (timeout, wrapper text) do not change
// the identity. An entry referencing no script falls back to its canonical
// JSON serialization. The returned map keys are identities, values are
// human-readable names for reports.
func hookEntryIdentities(entries []any) map[string]string {
	identities := make(map[string]string, len(entries))
	for _, entry := range entries {
		data, err := json.Marshal(entry)
		if err != nil {
			continue // unserializable entry cannot be identified; skip it
		}
		scripts := hookDeliveryScriptPattern.FindAllString(string(data), -1)
		matcher := ""
		if entryMap, ok := entry.(map[string]any); ok {
			if m, ok := entryMap["matcher"].(string); ok {
				matcher = m
			}
		}
		if len(scripts) > 0 {
			// Dedupe repeated references while preserving first-seen order.
			seen := make(map[string]bool, len(scripts))
			unique := scripts[:0]
			for _, s := range scripts {
				if !seen[s] {
					seen[s] = true
					unique = append(unique, s)
				}
			}
			id := strings.Join(unique, ",")
			if matcher != "" {
				id += "|" + matcher
			}
			name := path.Base(unique[0])
			if matcher != "" {
				name = fmt.Sprintf("%s (matcher %s)", name, matcher)
			}
			identities[id] = name
			continue
		}
		identities[string(data)] = string(data)
	}
	return identities
}

// sortedTemplateEventKeys returns the template hooks' event keys in
// deterministic order so report lines are stable across runs.
func sortedTemplateEventKeys(hooks map[string]any) []string {
	keys := make([]string, 0, len(hooks))
	for k := range hooks {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

```

### Core Architecture Module: `internal/cli/doctor_hook_missing.go`
```
// doctor_hook_missing.go — `moai doctor` check: hook wrapper fallback log.
//
// The settings.json hook wrappers fall back to a bash -c one-liner when the
// handle-*.sh script is absent at fire time (an update redeploy window leaves
// such a gap) and append an entry to .moai/logs/hook-missing.log. A skipped
// hook is quiet by design, so this check reads the log back and reports it —
// the entry count, the latest missing script, and how many entries lost their
// timestamp to a failed date substitution. Advisory and fail-open: a missing
// or unreadable log reports OK, never FAIL.
package cli

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/modu-ai/moai-adk/internal/cli/uikit"
)

// hookMissingLogCheckName is the doctor check identifier (also the value
// accepted by `moai doctor --check`).
const hookMissingLogCheckName = "Hook Missing Log"

// checkHookMissingLog reports hook-missing.log entries for projectRoot.
func checkHookMissingLog(projectRoot string, verbose bool) DiagnosticCheck {
	check := DiagnosticCheck{Name: hookMissingLogCheckName, Status: uikit.CheckOK}

	data, err := os.ReadFile(filepath.Join(projectRoot, ".moai", "logs", "hook-missing.log"))
	if err != nil {
		check.Message = "no hook-missing entries"
		return check
	}
	var lines []string
	for _, line := range strings.Split(string(data), "\n") {
		if strings.TrimSpace(line) != "" {
			lines = append(lines, line)
		}
	}
	if len(lines) == 0 {
		check.Message = "hook-missing.log is empty"
		return check
	}

	timestampless := 0
	for _, line := range lines {
		if strings.HasPrefix(line, " ") {
			timestampless++
		}
	}

	// The entry format is "<RFC3339 timestamp> hook missing: <script path>";
	// a failed date substitution leaves the leading field blank.
	latest := lines[len(lines)-1]
	script := latest
	if idx := strings.LastIndex(latest, "hook missing: "); idx >= 0 {
		script = strings.TrimSpace(latest[idx+len("hook missing: "):])
	}

	check.Status = uikit.CheckWarn
	check.Message = fmt.Sprintf("%d hook-missing entries; latest: %s", len(lines), filepath.Base(script))
	check.Detail = fmt.Sprintf("Hook wrappers fired while their handle-*.sh script was absent (e.g. during an update redeploy window). %d of %d entries have no timestamp (date substitution failed).", timestampless, len(lines))
	return check
}

```

### Core Architecture Module: `internal/cli/doctor_hook_wiring.go`
```
package cli

// Hook-wiring drift diagnostic (SPEC-HOOK-WIRING-DRIFT-001 M2).
//
// A hook entry added to the settings template after a project was initialized
// can never reach that project through `moai update`: the derived merge base
// recurses only through maps, and a hook entry is an array element, so the
// merge concludes only the user changed `hooks` and preserves the project's
// block wholesale. Scripts are force-synced; registrations are never synced.
// Nothing surfaced that asymmetry — this check does.
//
// It REPORTS and never repairs. With no deploy-time template snapshot, "the
// template gained this entry" and "the user deliberately deleted it" are
// indistinguishable, so an auto-repair would silently override intent on every
// run. The check therefore writes nothing under the project root.

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/modu-ai/moai-adk/internal/cli/uikit"
	"github.com/modu-ai/moai-adk/internal/config"
	"github.com/modu-ai/moai-adk/internal/template"
	"github.com/modu-ai/moai-adk/pkg/version"
)

// hookWiringCheckName is the doctor check-list entry name.
const hookWiringCheckName = "Hook Wiring"

// @MX:ANCHOR: [AUTO] hook-wiring drift diagnostic — render-and-compare seam shared with the settings parity test
// @MX:REASON: [AUTO] the template source is an injectable parameter so a fixture template can be rendered through the same path production uses; hardcoding the expected entries here would rot against the template and recreate the drift class this check exists to surface
// checkHookWiringDrift renders the settings template from tmplFS in memory,
// compares its hook entries against the project's .claude/settings.json, and
// reports divergence in BOTH directions, naming the affected script for each.
//
// tmplFS is a parameter, not the embedded FS read internally: production
// passes template.EmbeddedTemplates() and tests inject a fixture template
// through the same seam. It returns CheckOK on an empty diff and CheckWarn
// otherwise — never CheckFail, and never a write.
func checkHookWiringDrift(projectRoot string, tmplFS fs.FS, verbose bool) DiagnosticCheck {
	check := DiagnosticCheck{Name: hookWiringCheckName}

	settingsPath := filepath.Join(projectRoot, ".claude", "settings.json")
	projectBytes, err := os.ReadFile(settingsPath) // #nosec G304 -- project-root-relative diagnostic read
	if err != nil {
		check.Status = uikit.CheckWarn
		if errors.Is(err, os.ErrNotExist) {
			check.Message = "not checked: .claude/settings.json not found"
			return check
		}
		check.Message = fmt.Sprintf("not checked: cannot read .claude/settings.json: %v", err)
		return check
	}

	projectEntries, err := template.ParseHookEntries(projectBytes)
	if err != nil {
		check.Status = uikit.CheckWarn
		check.Message = fmt.Sprintf("not checked: cannot parse .claude/settings.json: %v", err)
		return check
	}

	tmplCtx := template.NewTemplateContext(
		template.WithPlatform(runtime.GOOS),
		template.WithVersion(version.GetVersion()),
		template.WithHookOptIn(config.LoadSystemHookOptInEnabled(projectRoot)),
	)
	templateEntries, err := template.RenderHookEntries(tmplFS, tmplCtx)
	if err != nil {
		check.Status = uikit.CheckWarn
		check.Message = fmt.Sprintf("not checked: cannot render the settings template: %v", err)
		return check
	}

	templateOnly, projectOnly := template.DiffHookEntries(templateEntries, projectEntries)
	if len(templateOnly) == 0 && len(projectOnly) == 0 {
		check.Status = uikit.CheckOK
		check.Message = fmt.Sprintf("%d hook entries match the template", len(projectEntries))
		if verbose {
			check.Detail = fmt.Sprintf("compared on (event, matcher, script, if, timeout, async); source: %s", settingsPath)
		}
		return check
	}

	check.Status = uikit.CheckWarn
	check.Message = hookWiringDriftMessage(templateOnly, projectOnly)
	check.Detail = hookWiringDriftDetail(templateOnly, projectOnly)
	return check
}

// hookWiringDriftMessage renders the single-line drift summary. Each divergent
// script is named with its direction, because a byte-difference report that
// does not name the script tells the reader nothing actionable.
func hookWiringDriftMessage(templateOnly, projectOnly []template.HookEntry) string {
	var parts []string
	if len(templateOnly) > 0 {
		parts = append(parts, fmt.Sprintf("template-only (in template, not registered in project): %s",
			strings.Join(template.HookEntryScripts(templateOnly), ", ")))
	}
	if len(projectOnly) > 0 {
		parts = append(parts, fmt.Sprintf("project-only (registered in project, not in template): %s",
			strings.Join(template.HookEntryScripts(projectOnly), ", ")))
	}
	return "hook wiring drift — " + strings.Join(parts, "; ")
}

// hookWiringDriftDetail renders the per-entry breakdown shown under --verbose.
func hookWiringDriftDetail(templateOnly, projectOnly []template.HookEntry) string {
	var lines []string
	for _, e := range templateOnly {
		lines = append(lines, "template-only: "+e.String())
	}
	for _, e := range projectOnly {
		lines = append(lines, "project-only: "+e.String())
	}
	lines = append(lines, "reported only — this check changes no file; reconcile .claude/settings.json by hand")
	return strings.Join(lines, "\n")
}

// hookWiringTemplateSource returns the production template source. A load
// failure yields nil, which the check reports as a warn naming the cause
// rather than failing the doctor run.
func hookWiringTemplateSource() fs.FS {
	fsys, err := template.EmbeddedTemplates()
	if err != nil {
		return nil
	}
	return fsys
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

### Core Architecture Module: `internal/cli/home_state_coverage.go`
```
package cli

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"time"
)

type changedLineRange struct{ Start, End int }
type changedCoverageResult struct {
	Covered, Total int
	Percent        float64
}

// changedSurfaceCoverageBudget bounds the focused coverage suite. It exists to
// catch a genuine hang, NOT to race normal completion: the five child `go test`
// invocations were measured at 214s and ~240s on a developer machine under
// ordinary parallel-lane load, so the previous 4-minute value left no headroom
// and failed outright once at exactly 240.00s. Because
// measureChangedSurfaceCoverage also backs the `moai migrate home-state --apply
// --verified-live` pre-check, a bound sitting at the work's own duration turns
// machine load into a production-gate failure. Sized at roughly 3.5x the
// measured worst case (card t948; evidence .moai/reports/t948/verdict.md).
const changedSurfaceCoverageBudget = 15 * time.Minute

const (
	homeStateCoverageCommitSubject            = "feat(state): add guarded home-state rollout (t592)"
	homeStateCoverageRemediationCommitSubject = "fix(state): stabilize committed coverage evidence (t592)"
	homeStateCoverageDeltaCommitSubject       = "fix(state): isolate committed coverage deltas (t592)"
	homeStateCoverageCertificationSubject     = "fix(state): certify review remediation coverage (t592)"
)

type homeStateCoverageChangeSet struct {
	Base, Tip           string
	Native, Disposition []string
	Ranges              map[string][]changedLineRange
}

func measureChangedSurfaceCoverage(ctx context.Context, root string) (float64, error) {
	result, err := measureChangedSurfaceCoverageResultWith(ctx, root, runChangedSurfaceCoverageSuite)
	return result.Percent, err
}

func runChangedSurfaceCoverageSuite(ctx context.Context, root, path string) error {
	pattern := "^(TestHomeState.*|TestHomeLayout.*|TestProject(Layout|Dir).*|TestRuntimeCensus.*|TestAdmission.*|TestFactory.*|TestResolveFactory.*|TestResume.*|TestExpireResume.*|TestImportLegacy.*|TestHandoff.*|TestClaim.*|TestClaimThenInject.*|TestConcurrentConsume.*|TestSQLiteClaim.*|TestNonceFallback.*|TestManualMode.*|TestNonClearSource.*|TestDegradeToGuidance.*|TestFailOpen_CorruptPending.*|TestStaleTTL.*|TestBranchTable.*|TestRenderHandoff.*|TestHandle_.*|TestIsHex.*|TestInjectionHeader.*|TestNoUserInteraction.*|TestThreeHandler.*|TestProfile.*|TestCleanHome.*|TestScanHomeCleanable.*|TestSecureHomeDirectories.*|TestContinue.*|TestCC.*|TestCharacterize_CC.*|TestRunCC.*|TestRunGLM.*|TestSession(Start|End).*|TestPersistedHomeStateEvidence.*|TestPlatformProcessIdentity.*|TestParseChanged.*|TestChangedProduction.*|TestCommittedCoverage.*)$"
	coverpkg := "./internal/cli,./internal/homestate,./internal/hook/handoff,./internal/hook,./internal/factory"
	parts := []struct {
		name string
		args []string
	}{
		{"cli", []string{"./internal/cli", "-run", pattern}},
		{"homestate", []string{"./internal/homestate"}},
		{"handoff", []string{"./internal/hook/handoff"}},
		{"hook", []string{"./internal/hook", "-run", pattern}},
		{"factory", []string{"./internal/factory", "-run", pattern}},
	}
	var merged strings.Builder
	merged.WriteString("mode: set\n")
	for _, part := range parts {
		partPath := path + "." + part.name
		args := append([]string{"test"}, part.args...)
		args = append(args, "-count=1", "-coverpkg="+coverpkg, "-coverprofile="+partPath)
		cmd := exec.CommandContext(ctx, "go", args...)
		cmd.Dir = root
		cmd.Env = append(os.Environ(), "MOAI_HOME_STATE_COVERAGE_CHILD=1")
		if out, err := cmd.CombinedOutput(); err != nil {
			return fmt.Errorf("coverage %s tests: %w\n%s", part.name, err, out)
		}
		raw, err := os.ReadFile(partPath)
		if err != nil {
			return err
		}
		lines := strings.SplitN(string(raw), "\n", 2)
		if len(lines) != 2 || !strings.HasPrefix(lines[0], "mode:") {
			return fmt.Errorf("coverage %s profile malformed", part.name)
		}
		merged.WriteString(lines[1])
		_ = os.Remove(partPath)
	}
	return os.WriteFile(path, []byte(merged.String()), 0o600)
}

func measureChangedSurfaceCoverageWith(ctx context.Context, root string, run func(context.Context, string, string) error) (float64, error) {
	result, err := measureChangedSurfaceCoverageResultWith(ctx, root, run)
	return result.Percent, err
}

func measureChangedSurfaceCoverageResultWith(ctx context.Context, root string, run func(context.Context, string, string) error) (changedCoverageResult, error) {
	ctx, cancel := context.WithTimeout(ctx, changedSurfaceCoverageBudget)
	defer cancel()
	profile, err := os.CreateTemp("", "moai-home-state-coverage-*.out")
	if err != nil {
		return changedCoverageResult{}, err
	}
	path := profile.Name()
	if err := profile.Close(); err != nil {
		return changedCoverageResult{}, err
	}
	defer func() { _ = os.Remove(path) }()
	if err := run(ctx, root, path); err != nil {
		// A child killed at the deadline reports only "signal: killed", which
		// reads as a crash. Name the budget so the failure is attributable
		// without reading this file.
		if errors.Is(ctx.Err(), context.DeadlineExceeded) {
			return changedCoverageResult{}, fmt.Errorf(
				"changed-surface coverage suite exceeded its %s budget: %w", changedSurfaceCoverageBudget, err)
		}
		return changedCoverageResult{}, err
	}
	changeSet, err := resolveHomeStateCoverageChangeSet(root)
	if err != nil {
		return changedCoverageResult{}, err
	}
	result, err := parseChangedLineCoverage(path, changeSet.Ranges)
	if err != nil {
		return changedCoverageResult{}, err
	}
	return result, nil
}

func changedProductionLineRanges(root string, files []string) (map[string][]changedLineRange, error) {
	changeSet, err := resolveHomeStateCoverageChangeSet(root)
	if err != nil {
		return nil, err
	}
	ranges := changeSet.Ranges
	wanted := map[string]bool{}
	for _, file := range files {
		wanted[file] = true
	}
	for file := range ranges {
		if !wanted[file] {
			delete(ranges, file)
		}
	}
	for _, file := range files {
		if _, ok := ranges[file]; !ok {
			return nil, fmt.Errorf("changed production file missing from diff: %s", file)
		}
	}
	return ranges, nil
}

func parseUnifiedZeroDiff(diff string) (map[string][]changedLineRange, error) {
	result := map[string][]changedLineRange{}
	current := ""
	for _, line := range strings.Split(diff, "\n") {
		if strings.HasPrefix(line, "+++ ") {
			path := strings.TrimPrefix(line, "+++ ")
			if path == "/dev/null" {
				return nil, fmt.Errorf("deleted production file")
			}
			if !strings.HasPrefix(path, "b/") {
				return nil, fmt.Errorf("malformed diff target %q", path)
			}
			current = filepath.ToSlash(strings.TrimPrefix(path, "b/"))
			if strings.HasSuffix(current, ".go") && !strings.HasSuffix(current, "_test.go") {
				if _, ok := result[current]; !ok {
					result[current] = nil
				}
			}
			continue
		}
		if !strings.HasPrefix(line, "@@ ") {
			continue
		}
		if current == "" {
			return nil, fmt.Errorf("diff hunk without target")
		}
		plus := strings.Index(line, "+")
		if plus < 0 {
			return nil, fmt.Errorf("malformed diff hunk %q", line)
		}
		end := strings.Index(line[plus:], " @@")
		if end < 0 {
			return nil, fmt.Errorf("malformed diff hunk %q", line)
		}
		spec := line[plus+1 : plus+end]
		parts := strings.Split(spec, ",")
		start, err := strconv.Atoi(parts[0])
		if err != nil {
			return nil, fmt.Errorf("malformed diff hunk %q", line)
		}
		count := 1
		if len(parts) == 2 {
			count, err = strconv.Atoi(parts[1])
			if err != nil {
				return nil, fmt.Errorf("malformed diff hunk %q", line)
			}
		}
		if len(parts) > 2 || count < 0 {
			return nil, fmt.Errorf("malformed diff hunk %q", line)
		}
		if count > 0 {
			result[current] = append(result[current], changedLineRange{Start: start, End: start + count - 1})
		}
	}
	return result, nil
}

func changedProductionFiles(root string) ([]string, []string, error) {
	changeSet, err := resolveHomeStateCoverageChangeSet(root)
	return changeSet.Native, changeSet.Disposition, err
}

func resolveHomeStateCoverageChangeSet(root string) (homeStateCoverageChangeSet, error) {
	var result homeStateCoverageChangeSet
	subjects := []string{
		homeStateCoverageCommitSubject,
		homeStateCoverageRemediationCommitSubject,
		homeStateCoverageDeltaCommitSubject,
		homeStateCoverageCertificationSubject,
	}
	commitsBySubject := make(map[string]string, len(subjects))
	log, err := gitCoverageOutput(root, "log", "--format=%H%x09%s", "HEAD")
	if err != nil {
		return result, err
	}
	for _, line := range strings.Split(strings.TrimSpace(log), "\n") {
		parts := strings.SplitN(line, "\t", 2)
		if len(parts) != 2 {
			continue
		}
		for _, subject := range subjects {
			if parts[1] != subject {
				continue
			}
			if commitsBySubject[subject] != "" {
				return result, fmt.Errorf("ambiguous home-state coverage evidence marker: %s", subject)
			}
			commitsBySubject[subject] = parts[0]
		}
	}
	originalTip := commitsBySubject[homeStateCoverageCommitSubject]
	if originalTip == "" {
		return result, fmt.Errorf("home-state coverage evidence commit not found")
	}
	result.Base, err = gitCoverageOutput(root, "rev-parse", originalTip+"^1")
	if err != nil {
		return result, fmt.Errorf("resolve home-state coverage base: %w", err)
	}
	var auditedCommits []string
	previous := ""
	missingEarlier := false
	for _, subject := range subjects {
		commit := commitsBySubject[subject]
		if commit == "" {
			missingEarlier = true
			continue
		}
		if missingEarlier {
			return result, fmt.Errorf("home-state coverage evidence chain has a missing predecessor: %s", subject)
		}
		if previous != "" {
			if err := gitCoverageRun(root, "merge-base", "--is-ancestor", previous, commit); err != nil {
				return result, fmt.Errorf("home-state coverage evidence does not descend from prior marker: %s: %w", subject, err)
			}
		}
		auditedCommits = append(auditedCommits, commit)
		previous = commit
	}
	result.Tip = auditedCommits[len(auditedCommits)-1]
	if err := gitCoverageRun(root, "merge-base", "--is
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

### Incident Patch 1: `66bb53eb` (2026-10-06)
**Commit Message**: fix(hook): key the auditor start marker by session+agent_type for background spawns (card t1544) (#1763)

Background Agent() spawns deliver a SubagentStart payload without agent_id,
so recordAuditorStart no-oped on every background auditor: the start marker
was never recorded (measured: five spawns, zero markers, synthetic-payload
control records normally) and CheckCitedReceipts structurally failed with
"start marker missing", persisting a rejection that denied every phase-entry
spawn with no path to resolution - the t1509 deadlock.

Key the marker by the new auditreceipt.StartMarkerKey - the agent id when the
payload carried one, else the session_id+agent_type pair - and read and clear
it through the same ordered keys, so a background auditor's PASS is provable
again and a stop payload carrying an id its start lacked still finds the
marker.

Derived-keyed markers are session-era anchors: written keep-earliest and
never deleted by a single instance's stop, so two concurrent same-role
background auditors cannot destroy each other's marker (card-review P2) and
an agent-id FAIL no longer deletes a foreign background marker.

RED first: five new tests in internal/hook reproduce the dea

**File**: `.moai/reports/t1544/card-review.md` (added, +93/-0)
```diff
@@ -0,0 +1,93 @@
+# Card t1544 — card-review (run→sync stage, advisory)
+
+Reviewer: codex (mcp__moai__codex_review, scope=card, project_root=<this
+worktree>) + lane-side disposition of every finding.
+Reviewed tree: `/Users/goos/MoAI/moai-adk-go/.moai/worktrees/t1544`
+(branch `WT-audit-receipt-guard`).
+Review verdict as returned: **fail** — disposition below; the one in-diff
+finding was repaired and re-verified in this tree; the remaining findings are
+outside this card's diff (base mis-resolution) and are handed to the leader.
+
+## Scope note — the review base resolved to develop, not main
+
+The resolver computed merge base `a158b4b5f` (the develop tip; this repo cut
+over to GitHub Flow with main as base and develop left behind), so the
+"card diff" the reviewer saw spans every main-side commit between
+`a158b4b5f` and this branch's point `10df085da` — dozens of files this card
+never touches. Evidence: `git diff --name-only a158b4b5f -- internal/` lists
+~30 files across `internal/cli` (factory_*, todo*, memory_fold*, graph,
+codex_review_*); this card's actual diff is exactly 3 files:
+
+```
+internal/auditreceipt/store.go
+internal/hook/audit_receipt_guard.go
+internal/hook/audit_receipt_guard_test.go
+```
+
+A control run of the same tool with `project_root` = the parent checkout
+returned `inconclusive` ("this tree is not one: no card branch: main") — the
+worktree root is the correct invocation; only its BASE is skewed by the
+cutover.
+
+## Finding 1 (P2) — IN DIFF — repaired
+
+> 다른 감사 인스턴스의 시작 마커를 삭제하지 마세요 —
+> internal/hook/audit_receipt_guard.go
+
+Two hazards named, both real on the first fix version:
+
+1. Two concurrent same-role background auditors share the derived
+   `bg_<session>_<agent_type>` marker; the first accepted PASS deleted it,
+   leaving the second instance's valid PASS refused `start marker missing`.
+2. An agent-id-carrying auditor's FAIL cleared keys including the derived
+   one, deleting a concurrent background auditor's marker.
+
+**Repair (era-anchor semantics for derived keys):**
+- `recordAuditorStart` writes a derived-keyed marker keep-earliest: an
+  existing marker is not overwritten, so a second concurrent start does not
+  move `StartedAt` past receipts the first instance will cite.
+- `readStartMarker` now returns the marker AND the key it was found under;
+  `consumeStartMarker` deletes only that found key, and never a derived key —
+  a derived marker is a session-era anchor that no single stop may destroy.
+  Agent-id-keyed markers keep the exact per-instance consume semantics.
+- Added tests: `TestSubagentStop_ConcurrentBackgroundAuditorsShareEraAnchor`
+  (both concurrent PASSes accepted, keep-earliest pinned) and
+  `TestSubagentStop_AgentIDFailKeepsBackgroundMarker`; the accepted-PASS
+  assertion in `TestSubagentStop_BackgroundSpawnAuditorPassIsProvable` now
+  pins retention. Family run green (see verdict file).
+
+Residual (accepted): derived markers outlive their session as inert orphans
+(keyed by session id, never read again; `.moai/state` is machine-local).
+Anti-recycling under a derived key is session-scoped rather than
+instance-scoped — the finest identity an agent-id-less payload carries.
+
+## Findings 2–8 — OUT OF DIFF — handed to the leader
+
+All cite files this card never touched (`internal/cli/factory_card.go`,
+`internal/cli/todo.go`, `internal/cli/todo_issuance.go`,
+`internal/web/screens.templ`); they describe main-side code between the
+resolver's base and this branch point, not this card's change:
+
+- P1 hub-hint preservation on re-`assign` (factory_card.go:1310)
+- P2 picked-candidate hub-predecessor skip (factory_card.go:821)
+- P2 explicit `--files` in overlap computation (todo.go:940)
+- P2 issuance guidance for `add --pick` (todo.go:873)
+- P2 engage guidance self-comparison (todo_issuance.go:274)
+- P2 SPEC-file read deadline on the I/O itself (todo_issuance.go:152)
+- P2 SVG colors for the relation graph (web/screens.templ:358)
+
+These belong to the leaders'/operators' queue triage, not this card.
+
+## Also observed (out of card, measured on this machine)
+
+`TestStaleRunNoticeFactoryLegacyLabel` (internal/hook/stale_run_m1_test.go)
+fails **pre-existing on mainline**: reproduced on the primary checkout at
+`ec13872f3` (main, none of this card's changes) — expects
+`moai factory relaunch --provider cc` while the notice emits `--provider glm`.
+Not caused by this card; flagged for the leader.
+
+## Verdict
+
+In-diff finding repaired and regression-pinned; remaining findings out of
+diff. This card's diff is judged sound for merge by the lane, subject to the
+leader's independent evidence read.
```

**File**: `.moai/reports/t1544/verdict.md` (added, +120/-0)
```diff
@@ -0,0 +1,120 @@
+# Card t1544 — verdict (run phase)
+
+Card: t1544 (Class B, P1) — audit receipt guard deadlock for background
+Agent() spawns.
+Tree: `/Users/goos/MoAI/moai-adk-go/.moai/worktrees/t1544`, branch
+`WT-audit-receipt-guard`, point `10df085da` (origin/main at intake) + this
+card's diff. Run: tmf011, lane-26.
+
+## Claim
+
+1. The defect is real and reproduced RED first: a SubagentStart payload
+   without agent_id wrote no auditor start marker, and the auditor's
+   SubagentStop was refused `start marker missing` even with a valid receipt —
+   the structural refusal behind the t1509 phase-entry deadlock.
+2. The fix (card direction B — session_id+agent_type marker key) repairs it:
+   the background ceremony now closes — start marker recorded under the
+   derived key, proven PASS accepted, marker semantics safe for concurrent
+   same-role instances (card-review P2 repair).
+3. Scoped verification is green; the 9 failures in the full
+   `internal/hook` package run are pre-existing on mainline, reproduced on
+   the primary checkout at `ec13872f3` without this card's changes.
+
+## Evidence
+
+RED (pre-fix, this tree, this run — the defect):
+
+```
+--- FAIL: TestSubagentStart_BackgroundSpawnWithoutAgentIDRecordsMarker (0.20s)
+    audit_receipt_guard_test.go:418: plan-auditor: no start marker under the background key "bg_sess-bg-1_plan-auditor": ... no such file or directory
+--- FAIL: TestSubagentStop_BackgroundSpawnAuditorPassIsProvable (0.33s)
+    audit_receipt_guard_test.go:452: decision = "block", want none — ... (reason "AUDIT_RECEIPT_VIOLATION: plan-auditor reported PASS but the audit could not be corroborated — start marker missing. ...")
+```
+
+(also RED: the asymmetric id-at-stop case, and the recycled-receipt test
+blocked `start marker missing` instead of reaching
+`receipt created before the auditor started`.)
+
+GREEN (post-fix, this tree, this run):
+
+```
+$ go test ./internal/hook/ -run '<guard family + 8 new tests>' -count=1
+ok  	github.com/modu-ai/moai-adk/internal/hook	13.915s
+
+$ go test ./internal/auditreceipt/... -count=1
+ok  	github.com/modu-ai/moai-adk/internal/auditreceipt	1.388s
+
+$ go vet ./internal/hook/... ./internal/auditreceipt/...
+(exit 0, no output)
+
+$ golangci-lint run ./internal/hook/... ./internal/auditreceipt/...
+0 issues.
+
+$ gofmt -l <3 changed files>   → (empty)
+```
+
+Full package (this tree, `-timeout 30m`, 776s):
+
+```
+FAIL	github.com/modu-ai/moai-adk/internal/hook	776.049s
+--- FAIL: TestStaleRunNoticeFactoryLegacyLabel
+--- FAIL: TestUserPromptSubmitHandler_MultipleSpecs (+7 more of the same two families)
+```
+
+Pre-existence control (primary checkout, main `ec13872f3`, NONE of this
+card's changes, this run):
+
+```
+$ go test ./internal/hook/ -run 'TestUserPromptSubmitHandler|TestBuildSessionTitle' -count=1
+FAIL	github.com/modu-ai/moai-adk/internal/hook	0.891s
+$ go test ./internal/hook/ -run TestStaleRunNoticeFactoryLegacyLabel -count=1
+FAIL	github.com/modu-ai/moai-adk/internal/hook	1.568s
+$ go test ./internal/hook/ -run TestBuildSessionTitle_NilConfig -count=1
+--- FAIL: TestBuildSessionTitle_NilConfig (0.00s)
+    user_prompt_submit_test.go:732: buildSessionTitle() with nil config = "leader", want derived title
+```
+
+All 9 failing tests fail identically on mainline without this card's diff →
+out of card. (Run 1 of the suite additionally hit the 10m default timeout;
+the repo doctrine form `-timeout 30m` was used for the verdict run.)
+
+Card review: `.moai/reports/t1544/card-review.md` — codex scope=card verdict
+`fail`; the single in-diff finding (P2 shared-marker deletion) repaired and
+pinned by two new tests; 7 findings out of diff (review base resolved to the
+develop tip `a158b4b5f` behind main — cutover residue), handed to the leader.
+
+## Baseline-attribution
+
+Every figure above was measured in this run, on this tree
+(`10df085da` + diff), with the lane env scrubbed
+(`unset MOAI_KANBAN_ID MOAI_KANBAN_LEAD_ADDR MOAI_KANBAN_SETTINGS_INJECTED`)
+for test runs; the pre-existence controls were measured on the primary
+checkout at `ec13872f3` in the same run. Tool provenance: the suite runs
+used the `go` toolchain directly; the card review ran through
+`mcp__moai__codex_review` with `project_root` = this worktree (the parent
+root returned `inconclusive`).
+
+## Gaps
+
+- The exact runtime shape of a background spawn's SubagentStop payload
+  (whether it carries agent_id, agent_transcript_path) was not directly
+  observed in this run; the fix covers every combination of id-at-start /
+  id-at-stop through ordered key lookup, and the tests pin both symmetric
+  and asymmetric shapes.
+- CI has not run on this branch yet (PR just opened); the full-suite
+  mainline verdict belongs to CI.
+- The codex review's 7 out-of-diff findings were not reproduced or
+  repaired here (they live in main-side code outside this card's diff).
+
+## Residual-risk
+
+- Derived-key markers are session-scoped anchors: anti-recycling
```

**File**: `internal/auditreceipt/store.go` (modified, +36/-0)
```diff
@@ -153,6 +153,42 @@ type StartMarker struct {
 	StartedAt time.Time `json:"started_at"`
 }
 
+// StartMarkerKey returns the store key identifying one auditor instance's
+// start marker: the agent id when the hook payload carried one, else the
+// session_id + agent_type pair (prefixed "bg_" so a derived key can never
+// collide with a real agent id). A background Agent() spawn delivers a
+// SubagentStart payload without agent_id, so for those spawns the pair is the
+// only identity both events of the spawn carry; keyed by agent id alone the
+// marker was a structural no-op and every later PASS permanently unprovable
+// (card t1544). Two same-role background auditors of one session share the
+// derived key, so a derived-keyed marker is a session-era anchor, not one
+// instance's: it keeps the EARLIEST start (the writer does not overwrite an
+// existing derived marker) and no single stop deletes it — deleting it would
+// destroy the other live instance's marker and re-create the unprovable-PASS
+// deadlock for it. The anchor goes stale with its session id and is never
+// read again. Neither identity present returns "": no key, no marker.
+func StartMarkerKey(agentID, sessionID, agentType string) string {
+	if id := strings.TrimSpace(agentID); id != "" {
+		return id
+	}
+	if s := strings.TrimSpace(sessionID); s != "" {
+		return derivedMarkerKeyPrefix + s + "_" + strings.TrimSpace(agentType)
+	}
+	return ""
+}
+
+// derivedMarkerKeyPrefix marks a start-marker key derived from the
+// session_id + agent_type pair rather than carried by the payload.
+const derivedMarkerKeyPrefix = "bg_"
+
+// IsDerivedMarkerKey reports whether key was derived by StartMarkerKey for an
+// agent-id-less background spawn. Such markers are session-era anchors shared
+// by every same-role background auditor of the session: they are written
+// keep-earliest and never deleted by a single instance's stop.
+func IsDerivedMarkerKey(key string) bool {
+	return strings.HasPrefix(key, derivedMarkerKeyPrefix)
+}
+
 // Rejection records a refused auditor PASS. It outlives the subagent: the
 // PreToolUse guard reads it to keep phase-entry spawns denied.
 type Rejection struct {
```

**File**: `internal/hook/audit_receipt_guard.go` (modified, +64/-18)
```diff
@@ -91,22 +91,40 @@ func auditReceiptScope(input *HookInput) (guardTree, bool) {
 // (REQ-CAG-010). Failures are logged, never surfaced: SubagentStart has no
 // blocking channel, and a marker that could not be written shows up later as
 // the "start marker missing" refusal cause rather than as a silent pass.
+//
+// A background Agent() spawn delivers no agent_id, so the marker is keyed by
+// the identity the payload does carry (session_id + agent_type, card t1544):
+// keyed by agent id alone the write was a structural no-op and the auditor's
+// later PASS permanently unprovable.
 func recordAuditorStart(input *HookInput) {
-	if input == nil || !auditreceipt.IsAuditorAgent(input.AgentType) || input.AgentID == "" {
+	if input == nil || !auditreceipt.IsAuditorAgent(input.AgentType) {
 		return
 	}
+	key := auditreceipt.StartMarkerKey(input.AgentID, input.SessionID, input.AgentType)
+	if key == "" {
+		return // no identity at all: no key, no marker
+	}
 	g, ok := auditReceiptScope(input)
 	if !ok || g.assumed() {
 		return // no store: nothing may be written under any root (REQ-WSR-010)
 	}
+	if auditreceipt.IsDerivedMarkerKey(key) {
+		// A derived key is a session-era anchor shared by every same-role
+		// background auditor of the session: an existing marker keeps the
+		// earliest start, so a second concurrent spawn does not move
+		// StartedAt forward past receipts the first instance will cite.
+		if _, err := auditreceipt.ReadStartMarker(g.store, key); err == nil {
+			return
+		}
+	}
 	m := auditreceipt.StartMarker{
-		AgentID:   input.AgentID,
+		AgentID:   key,
 		AgentType: input.AgentType,
 		SessionID: input.SessionID,
 		TreeRoot:  g.tree,
 	}
 	if err := auditreceipt.WriteStartMarker(g.store, &m); err != nil {
-		slog.Warn("auditor start marker not recorded", "agent_id", input.AgentID, "tree_root", g.tree, "error", err)
+		slog.Warn("auditor start marker not recorded", "agent_id", key, "tree_root", g.tree, "error", err)
 	}
 }
 
@@ -126,7 +144,8 @@ func checkAuditorStop(input *HookInput) *HookOutput {
 	if parsed && !line.IsPass() {
 		// A FAIL needs no receipt: it is not claiming an audit approved anything.
 		if !g.assumed() {
-			clearStartMarker(g.store, input.AgentID)
+			_, key := readStartMarker(g.store, input)
+			consumeStartMarker(g.store, key)
 		}
 		return nil
 	}
@@ -144,7 +163,7 @@ func checkAuditorStop(input *HookInput) *HookOutput {
 		// refusal can be recorded: refuse, and say why the gate applied.
 		cause = auditreceipt.GateAssumedRequiredNote + ", so no audit receipt can be recorded or checked for this tree"
 	case parsed:
-		start := readStartMarker(g.store, input.AgentID)
+		start, foundKey := readStartMarker(g.store, input)
 		ok, failure := auditreceipt.CheckCitedReceipts(g.store, start, cited)
 		if ok {
 			// A proven PASS clears this role's outstanding refusals in THIS tree —
@@ -155,7 +174,7 @@ func checkAuditorStop(input *HookInput) *HookOutput {
 			if err := auditreceipt.ClearRejectionsForRoleInTreeKind(g.store, g.tree, input.AgentType, auditreceipt.KindReceipt); err != nil {
 				slog.Warn("audit rejections not cleared", "agent_type", input.AgentType, "tree_root", g.tree, "error", err)
 			}
-			clearStartMarker(g.store, input.AgentID)
+			consumeStartMarker(g.store, foundKey)
 			return nil
 		}
 		cause = failure
@@ -170,7 +189,8 @@ func checkAuditorStop(input *HookInput) *HookOutput {
 		// hook. The refusal stays on disk (or, with no store, the spawn check
 		// fails closed on its own), so the phase-entry spawns stay denied.
 		if !g.assumed() {
-			clearStartMarker(g.store, input.AgentID)
+			_, key := readStartMarker(g.store, input)
+			consumeStartMarker(g.store, key)
 		}
 		return &HookOutput{SystemMessage: fmt.Sprintf(
 			"%s: this %s PASS is not accepted — %s. Phase-entry spawns (manager-develop / manager-docs / manager-git) stay denied in %s until a PASS citing a valid audit receipt is recorded.",
@@ -216,23 +236,49 @@ func persistAuditRejection(g guardTree, input *HookInput, specID, cause string,
 	}
 }
 
-func readStartMarker(store, agentID string) *auditreceipt.StartMarker {
-	if agentID == "" {
-		return nil
+// markerKeys lists the store keys this instance's start marker may be filed
+// under, best candidate first: the agent id the payload carried, then the
+// session_id+agent_type key a background spawn's start was recorded under —
+// its SubagentStart carries no agent id while its stop payload may still
+// carry one, so both spellings are tried (card t1544).
+func markerKeys(input *HookInput) []string {
+	var keys []string
+	if id := strings.TrimSpace(input.AgentID); id != "" {
+		keys = append(keys, id)
 	}
-	m, err := auditreceipt.ReadStartMarker(store, agentID)
-	if err != nil {
-		return nil // absent or unreadable: both mean this instance cannot be corroborated
+	if bg := auditreceipt.StartMarkerKey("", input.SessionID, input.AgentType); bg != "" {
+		keys = append(keys, bg)
+	}
+	return keys
+}
+
+// readStartMarker loads 
```

**File**: `internal/hook/audit_receipt_guard_test.go` (modified, +211/-0)
```diff
@@ -385,3 +385,214 @@ func TestAuditReceiptGuard_UnreadableEvidence(t *testing.T) {
 		t.Errorf("trailing whitespace PASS: decision = %q, want none", out.Decision)
 	}
 }
+
+// backgroundStartInput builds the SubagentStart payload shape of a background
+// Agent() spawn (card t1544): the auditor type and session id are carried,
+// the agent id is not.
+func backgroundStartInput(root, agentType, sessionID string) *HookInput {
+	return &HookInput{
+		CWD:           root,
+		AgentType:     agentType,
+		SessionID:     sessionID,
+		HookEventName: string(EventSubagentStart),
+	}
+}
+
+// Card t1544: a background Agent() spawn delivers SubagentStart without
+// agent_id, so the auditor start marker must be recorded under the identity
+// the payload does carry (session_id + agent_type). Keyed by agent id alone
+// the write was a structural no-op — the measured failure: five spawns, zero
+// markers — and every later auditor PASS permanently unprovable.
+func TestSubagentStart_BackgroundSpawnWithoutAgentIDRecordsMarker(t *testing.T) {
+	for _, agentType := range []string{auditreceipt.AgentPlanAuditor, auditreceipt.AgentSyncAuditor} {
+		root := newGateTree(t, "required")
+		if _, err := NewSubagentStartHandler().Handle(context.Background(), backgroundStartInput(root, agentType, "sess-bg-1")); err != nil {
+			t.Fatalf("%s: SubagentStart Handle: %v", agentType, err)
+		}
+		key := auditreceipt.StartMarkerKey("", "sess-bg-1", agentType)
+		if key == "" {
+			t.Fatalf("%s: StartMarkerKey returned empty for a background spawn", agentType)
+		}
+		m, err := auditreceipt.ReadStartMarker(root, key)
+		if err != nil {
+			t.Fatalf("%s: no start marker under the background key %q: %v", agentType, key, err)
+		}
+		if m.TreeRoot != root || m.StartedAt.IsZero() {
+			t.Errorf("%s: marker = %+v, want tree %q and a non-zero start time", agentType, m, root)
+		}
+	}
+}
+
+// Card t1544: the background-spawn audit ceremony must close. An auditor
+// spawned without an agent id mints a receipt during its run, cites it in its
+// verdict line, and the stop accepts the PASS instead of refusing it with
+// "start marker missing" — the refusal that, once persisted, denied every
+// phase-entry spawn with no path to resolution (t1509 deadlock).
+func TestSubagentStop_BackgroundSpawnAuditorPassIsProvable(t *testing.T) {
+	root := newGateTree(t, "required")
+	if _, err := NewSubagentStartHandler().Handle(context.Background(), backgroundStartInput(root, auditreceipt.AgentPlanAuditor, "sess-bg-2")); err != nil {
+		t.Fatalf("SubagentStart Handle: %v", err)
+	}
+	// A receipt minted after the marker's start time (Now at write), so the
+	// citation must qualify once the marker is findable.
+	id := seedReceipt(t, root, auditreceipt.Receipt{
+		Tool:      auditreceipt.ToolCodexAudit,
+		TreeRoot:  root,
+		CreatedAt: time.Now().UTC().Add(2 * time.Second),
+	})
+	stop := &HookInput{
+		CWD:                  root,
+		AgentType:            auditreceipt.AgentPlanAuditor,
+		SessionID:            "sess-bg-2",
+		LastAssistantMessage: "AUDIT-VERDICT: PASS spec=SPEC-BG-001 receipts=" + id,
+		HookEventName:        string(EventSubagentStop),
+	}
+	out := runStop(t, stop)
+	if out.Decision != "" {
+		t.Fatalf("decision = %q, want none — a proven background PASS must not block (reason %q)", out.Decision, out.Reason)
+	}
+	// The accepted PASS keeps the derived marker: it is a session-era anchor
+	// a concurrent same-role instance may still need (card t1544 card-review
+	// P2) — only an agent-id-keyed marker is consumed at stop.
+	if key := auditreceipt.StartMarkerKey("", "sess-bg-2", auditreceipt.AgentPlanAuditor); key != "" {
+		if _, err := auditreceipt.ReadStartMarker(root, key); err != nil {
+			t.Errorf("derived start marker %q was consumed by an accepted PASS: %v", key, err)
+		}
+	}
+}
+
+// Card t1544 card-review P2: two concurrent same-role background auditors
+// share the derived marker. The first accepted PASS must not destroy the
+// second instance's provability, and the second start must not move the
+// anchor's start time past receipts the first instance will cite.
+func TestSubagentStop_ConcurrentBackgroundAuditorsShareEraAnchor(t *testing.T) {
+	root := newGateTree(t, "required")
+	session := "sess-bg-5"
+	start := backgroundStartInput(root, auditreceipt.AgentPlanAuditor, session)
+	if _, err := NewSubagentStartHandler().Handle(context.Background(), start); err != nil {
+		t.Fatalf("first SubagentStart Handle: %v", err)
+	}
+	key := auditreceipt.StartMarkerKey("", session, auditreceipt.AgentPlanAuditor)
+	first, err := auditreceipt.ReadStartMarker(root, key)
+	if err != nil {
+		t.Fatalf("first start wrote no marker: %v", err)
+	}
+	// A second same-role spawn of the same session: the anchor keeps the
+	// earliest start.
+	if _, err := NewSubagentStartHandler().Handle(context.Background(), backgroundStartInput(root, auditreceipt.AgentPlanAuditor, session)); err != nil {
+		t.Fatalf("second SubagentStart Handle: %v", err)
+	}
+
```

---

### Incident Patch 2: `10df085d` (2026-10-05)
**Commit Message**: feat(SPEC-MEMORY-FOLD-BUDGET-001): memory hygiene pass 1 - fold verb, doctor budget, card-close wiring (card t1502) (#1759)

* feat(SPEC-MEMORY-FOLD-BUDGET-001): plan-phase artifacts (Tier M, 3 artifacts) (card t1502)

Plan-phase artifacts for card t1502, memory hygiene pass 1: card-done fold
into the archive index, a byte-aware index budget with a SessionStart
warning, and link repair. spec.md carries 15 GEARS requirements, plan.md the
10 open decisions with recommended defaults and 7 dependency-ordered
milestones, acceptance.md 15 criteria whose primary invariant is
reachability and never size, progress.md the section E skeleton, and
decision-index.md the unsettled questions (decision gate on). A small
synthetic fixture store under fixtures/ is the read-only input of the
acceptance commands. Status draft. No Go source and no real memory store
touched.

Authored-By-Agent: manager-spec
🗿 MoAI

* docs(SPEC-MEMORY-FOLD-BUDGET-001): plan delta for audit iteration 1 findings (card t1502)

Plan delta (spec 0.1.0 -> 0.2.0) for card t1502 after plan-audit iteration 1
(FAIL 0.69, 12 blocking findings D1-D12, 8 optional D13-D20) and the leader
ruling: link repair (relink verb, nearest-name

**File**: `.moai/specs/SPEC-MEMORY-FOLD-BUDGET-001/acceptance.md` (added, +433/-0)
```diff
@@ -0,0 +1,433 @@
+# acceptance.md — SPEC-MEMORY-FOLD-BUDGET-001
+
+Verification layer. Each criterion is an `AC-MFB-NNN` Given/When/Then, binary-testable, mapped to its requirement. The requirements themselves are the GEARS entries in `spec.md` §2; nothing here restates them as requirements. Revision 0.4.0 (run-entry delta for audit iteration 3 debt: path-exact Definition of Done, the test-containment cell AC-MFB-008 (xi) with ledger cells E9a/E9b, the multi-line reordering variant, the narrowed checker/doctor statement; 12 requirements and 13 criteria remain). Revision 0.3.0 had split the SessionStart half out.
+
+## 0. Pins, provenance, conventions
+
+- **Document-level tree pin: `2f492df19`.** It binds every RED-now cell below that carries no pin of its own. The plan commits (`73c4ab646`, then `0dfae6d4a`) descend from `2f492df19` and touch only `.moai/specs/SPEC-MEMORY-FOLD-BUDGET-001/**`; no Go source differs between the pinned tree and the plan commits. The cells were re-executed for revision 0.3.0 on tree HEAD `0dfae6d4a` with the stamped binary below; observed output equals what the pinned tree produces (each ledger cell carries a `re-run` line).
+- **Binary provenance.** Every `./bin/moai` command was run with a binary built from this tree and invoked by path: `go build -buildvcs=false -ldflags "-X github.com/modu-ai/moai-adk/pkg/version.Commit=2f492df19 -X github.com/modu-ai/moai-adk/pkg/version.Date=2026-10-04" -o bin/moai ./cmd/moai`; `./bin/moai version` prints commit `2f492df19`. A plain `go build` in this worktree stamped a different checkout's revision (`c8f245c2c9a5`, not an ancestor of HEAD), so the stamp was set explicitly; the commit is therefore declared, not derived.
+- **Real store off limits.** No command in this document, and no green-path command, reads or writes the operator's real memory directory (`spec.md` C-1). Green-path tests copy the fixture or generate stores under `t.TempDir()`, set `HOME`, `USERPROFILE`, `CLAUDE_CONFIG_DIR` and `MOAI_HOME` to temporary directories, and fail if a resolved store lies outside the temporary root. Scratch stores used for design validation (§5) live under the session scratch directory and are always passed with an explicit `--dir`.
+- **Commands are single invocations** run from the repository (tree) root, read-only, with the exit code recorded as its own field. Stdout is verbatim. A table cell never carries a command; the ledger below does, by id. One file per `grep -c` command: the shell used here replaces `grep` with a function whose multi-file output order is not stable.
+- **Green-path rule.** Every `go test -run` selector is anchored `^…$` on each alternation branch, and every green cell is read together with the swept count: `go test -list '<same pattern>' <package>` must list exactly as many names as the pattern has branches. A green with an empty sweep is not a pass. Test names below are the run-phase's to finalize; the binding is the behavior and the swept-count rule.
+- **Release-blocking** = carries RED-now (ledger id) and a green path. **Regression-guard** = guards behavior that must not change, or has a RED that cannot be re-executed on the pinned tree; never recorded as an adopted gate.
+- **Run-phase RED record.** For every Go-test criterion the run phase also records, before GREEN, the verbatim failing output of the new test itself (`tdd-result-contract.md` `EXPECTED_RED`) in `progress.md` §E.2. The plan-phase RED-now below proves the feature is absent; it does not replace that record.
+
+## 1. Fixture and plan-phase baseline
+
+`fixtures/store-A/` is a synthetic store (one `MEMORY.md`, one archive index `project_card_archive_2026_10.md` carrying three links, 11 further topic files and one orphan; 13 topic files besides `MEMORY.md`). The fixture is **frozen**: this revision changes nothing under it, and the tests assert its file list, sizes and the SHA-256 of the two index files before using it, so a later edit cannot silently invalidate the numbers below (the fixture directory is outside the plan-artifact hash subject set).
+
+| File | Bytes |
+|---|---|
+| `MEMORY.md` | 1155 |
+| `project_card_archive_2026_10.md` | 373 |
+| `feedback_alpha.md` | 160 |
+| `feedback_beta.md` | 157 |
+| `feedback_delta_note.md` | 143 |
+| `feedback_hangul.md` | 166 |
+| `feedback_orphan.md` | 154 |
+| `feedback_queue_jump_queue.md` | 198 |
+| `feedback_verify.md` | 186 |
+| `project_card_t8998_older.md` | 163 |
+| `project_card_t8999_prior.md` | 163 |
+| `project_card_t9000_zero.md` | 161 |
+| `project_card_t9001_alpha.md` | 173 |
+| `project_card_t9005_epsilon.md` | 188 |
+
+SHA-256 (measured with `shasum -a 256`, this run, unchanged from 0.2.0): `MEMORY.md` = `252722b91fb9b4f151bc30434656d0f59b29458490fb591ea16fa6ee1592c3d9`; `project_card_archive_2026_10.md` = `c353c3c9adc3255c4a15064deb017ff59ad0052edea6df4232ae336418891105`.
+
+Measured on the committed fixture (`wc -c`, `wc -m`, and the reference oracle in the scratch directory — not par
```

**File**: `.moai/specs/SPEC-MEMORY-FOLD-BUDGET-001/decision-index.md` (added, +102/-0)
```diff
@@ -0,0 +1,102 @@
+# decision-index.md — SPEC-MEMORY-FOLD-BUDGET-001
+
+Questions the interview did not settle, one row each. Detect → Explain → Ask: each row says what is unresolved and why. Labels use the fixed vocabulary `DECIDED`, `POLICY-COVERED`, `EVIDENCE-NEEDED`, `FOUNDER`. Revision 0.3.0 (plan delta for audit iteration 2): the two product-level rows (Q1, Q7) now carry the operator's own confirmation; the two evidence rows (Q3, Q6) state that no requirement depends on them and why that leaves them non-blocking for the Kickoff; every `Default:` names the step of the published default rule that selects it; Q7 is kept because the SessionStart follow-up card inherits it; Q4's default text follows the single archive-index definition of `spec.md` §1.5. Revision 0.4.0 (run-entry delta for audit iteration 3): adds the tenth row (Q10, plan OD-11, the card-close execution bound), which the plan had named as recorded here without a row, and refreshes the `DEFAULT-APPLIED` stamps of Q2, Q4, Q5, Q8 and Q9 after re-reading their text against the current SPEC; no other row changed. Revision 0.2.0 had added `Class:` to every row, dated `DEFAULT-APPLIED` verdicts to the implementation-level rows, and the ninth row (Q9).
+
+Source note for the two operator verdicts below (Q1, Q7). Both were confirmed by the operator directly on 2026-10-04 and relayed through the leader's question channel. That relay is the only source recorded: no row cites a file as an `Authority anchor`, and no verdict rests on a gitignored report. The rows keep the label `FOUNDER` because no committed setting or completed SPEC decides them.
+
+### Q1: Is fold-on-done on by default at first release, or opt-in? (plan.md OD-1)
+
+Label: FOUNDER
+Class: product-level
+Authority anchor: none — no committed setting or completed SPEC decides this question as written.
+Why unresolved: the card says to wire the fold into card close and also says the feature is applied to the real store only after the leader confirms; the two do not fix whether the compiled default is enabled. It is a choice about who bears the risk of an unattended write to a store the host also writes.
+Operator verdict: operator confirmed (via the leader's question channel), 2026-10-04: the `gtd done` wiring ships default OFF and is enabled by an environment variable.
+
+### Q2: Is the gate an environment variable with a constant, or a key in a configuration section? (OD-2)
+
+Label: FOUNDER
+Class: implementation-level
+Authority anchor: none.
+Why unresolved: both mechanisms exist in this subsystem (an environment kill switch for the audit; typed configuration sections elsewhere), and the cost and discoverability differ; no setting names the intended one.
+Default: environment variable read at the call site, with a compiled default constant (rule: step 3 of the published default rule — the option with the smaller user-visible surface, since a configuration key adds a typed struct, a loader and a template mirror; consistent with the `MOAI_MEMORY_AUDIT` kill-switch precedent in `internal/hook/post_tool.go` and `session_start.go` and with the operator's environment-variable gate for Q1).
+Alternate: a key in a configuration section (needs a typed struct, a loader, a template mirror and the loader-completeness test).
+Operator verdict: DEFAULT-APPLIED 2026-10-05T02:03:11Z claude via manager-spec
+
+### Q3: Which measure and which byte cap should the 80 % warning be tied to? (OD-3, OD-4)
+
+Label: EVIDENCE-NEEDED
+Class: product-level
+Authority anchor: none — the doctrine records the host announcement (200 lines or 25KB) and a completed SPEC records a non-truncation observation, neither fixes the unit.
+Why unresolved: whether the loader cuts by raw bytes, characters, loaded content or lines, and whether "25KB" is 25,000 or 25,600 bytes, needs a deliberate truncation experiment that does not exist yet.
+Evidence on hand (gathered in revision 0.2.0, without a truncation experiment and without the real store): (1) `SPEC-MEMORY-STORE-RECONCILE-001` `spec.md:60-61` — a measured index of 26,280 bytes, 18,463 characters and 163 lines whose final line was present in the measuring session's injected context, so a raw-byte cut at 25,600 did not occur; three explanations stay undistinguished (a character cap, a line-only cap, a larger byte cap). (2) The changelog entries quoted in `.claude/rules/moai/workflow/moai-memory.md` § MEMORY.md Index Budget — 2.1.83 (200 lines or 25KB), 2.1.210 (over-limit write is an explicit error), 2.1.211 (the over-limit warning measures loaded content, excluding frontmatter and HTML comments), 2.1.268 (the truncation warning states the lines cut); read here from the doctrine file, not re-fetched from upstream. (3) The doctor measures on the fixture (1,155 bytes, 1,095 characters, 17 lines) — a measurement of the doctor's own reconstruction, not of the loader. The loader's cut unit cannot be established from this evidence, and no truncation experiment was run.
+No requi
```

**File**: `.moai/specs/SPEC-MEMORY-FOLD-BUDGET-001/fixtures/store-A/MEMORY.md` (added, +17/-0)
```diff
@@ -0,0 +1,17 @@
+# Memory Index
+
+> Synthetic fixture for SPEC-MEMORY-FOLD-BUDGET-001. Not a real memory store.
+
+## Open work
+- [t9001 alpha card — done, merged](project_card_t9001_alpha.md) — merged; detail lives in the topic file
+- [t9002 beta card — done](.moai/reports/t9002/verdict.md) — the verdict path is repo-relative
+- [t9006 zeta card — done](.moai/reports/t9006/verdict.md) — a second repo-relative verdict path with the same base name
+- [t9004 delta note](feedback_delta_note.md) — title leads with a card id but the target names no card
+- [Epsilon wrap-up](project_card_t9005_epsilon.md) — target names a card but the title does not
+
+## General discipline
+- [Verify before claiming](feedback_verify.md) — a lesson first recorded on t9001
+- [Queue jumping](feedback_queue_jump_window.md) — dangling: the file on disk is feedback_queue_jump_queue.md
+- [Alpha note](feedback_alpha.md) and [Beta note](feedback_beta.md) — one grouped line carrying two link targets
+- [한글 알파](feedback_hangul.md) — 세 바이트 문자 측정 검증용 항목
+- [Card archive 2026-10](project_card_archive_2026_10.md) — closed cards for the month
```

**File**: `.moai/specs/SPEC-MEMORY-FOLD-BUDGET-001/fixtures/store-A/feedback_alpha.md` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+---
+name: alpha note
+description: Alpha note; fixture lesson carried by a grouped line
+type: feedback
+---
+
+Alpha.
+
+**Why:** fixture.
+**How to apply:** fixture.
```

**File**: `.moai/specs/SPEC-MEMORY-FOLD-BUDGET-001/fixtures/store-A/feedback_beta.md` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+---
+name: beta note
+description: Beta note; fixture lesson carried by a grouped line
+type: feedback
+---
+
+Beta.
+
+**Why:** fixture.
+**How to apply:** fixture.
```

**File**: `.moai/specs/SPEC-MEMORY-FOLD-BUDGET-001/fixtures/store-A/feedback_delta_note.md` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+---
+name: delta note
+description: Delta note; fixture topic file
+type: feedback
+---
+
+Delta note.
+
+**Why:** fixture.
+**How to apply:** fixture.
```

**File**: `.moai/specs/SPEC-MEMORY-FOLD-BUDGET-001/fixtures/store-A/feedback_hangul.md` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+---
+name: hangul item
+description: Three-byte character fixture lesson
+type: feedback
+---
+
+세 바이트 문자 항목.
+
+**Why:** fixture.
+**How to apply:** fixture.
```

**File**: `.moai/specs/SPEC-MEMORY-FOLD-BUDGET-001/fixtures/store-A/feedback_orphan.md` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+---
+name: orphan lesson
+description: Orphan fixture lesson linked from no index
+type: feedback
+---
+
+Orphan.
+
+**Why:** fixture.
+**How to apply:** fixture.
```

---

### Incident Patch 3: `de388878` (2026-10-05)
**Commit Message**: fix(factory): require a recorded driver for the serial slot hold (card t1513) (#1758)

* fix(factory): release the serial slot for driverless rows and refuse lane joins rooted in a worktree (card t1513)

- factorySerialSlotHeld: a row with an empty OwnerLabel holds nothing —
  a picked, ownerless, lease-less row (measured: run tmf011 / t1453)
  carries no lease-expiry safety net and held the serial slot
  indefinitely while every lane lease was refused serial-slot.
- enterFactoryLaneRun: refuse a lane join whose working directory roots
  inside a linked worktree (LANE_JOIN_FROM_WORKTREE sentinel) — such a
  session can never EnterWorktree the next card's tree ('Already in a
  worktree session') and wedges on its first card transition.
  Detection: per-tree git dir != common git dir, symlink-resolved,
  fail-open on git failure.
- tests: slot predicate matrix, driverless-row release end-to-end plus
  the driven-row control arm, and the join-gate refusal faces.

🗿 MoAI

* test(factory): pin the two review-named gaps of the t1513 predicate and join gate (card t1513)

Card-review r1 (PASS) named two unpinned surfaces; both are now tests:

- TestFactoryNextRefusesAgainAfterLaterAssign:

**File**: `internal/cli/factory_card.go` (modified, +17/-6)
```diff
@@ -254,13 +254,24 @@ func factorySerialSlotFree(state string) bool {
 }
 
 // factorySerialSlotHeld reports whether a recorded card holds the serial slot
-// at now: its state is not one of the releasing states, and — for a card in a
-// lease-holding state — its lease has not expired. An expired lease is only
-// collected lazily, by the next transition on that same card, so the row keeps
-// its lease-holding state after the lane that held it is gone; reading the
-// state alone would hold the slot for that lane indefinitely (card t1407).
+// at now. Three conditions hold together: the state is not one of the
+// releasing states; — for a card in a lease-holding state — its lease has not
+// expired; and a driver is recorded. An expired lease is only collected
+// lazily, by the next transition on that same card, so the row keeps its
+// lease-holding state after the lane that held it is gone; reading the state
+// alone would hold the slot for that lane indefinitely (card t1407).
+//
+// The driver condition (card t1513): a row whose OwnerLabel is empty holds
+// nothing. A picked row recorded without a lane (`factory assign` with no
+// --lane) names a nomination nobody is driving, and the lease-expiry net
+// above never applies to it because it carries no lease — the slot would
+// hold for as long as the row exists. Measured 2026-10-05: run tmf011's
+// t1453 sat picked, ownerless, and lease-less for a day while every lane
+// lease in the run was refused `serial-slot`. A later `factory assign
+// --lane` or the nominate arm sets the owner and the row holds again, so
+// only genuinely driverless rows release.
 func factorySerialSlotHeld(c homestate.Card, now time.Time) bool {
-	return !factorySerialSlotFree(c.State) && !c.LeaseExpired(now)
+	return !factorySerialSlotFree(c.State) && !c.LeaseExpired(now) && c.OwnerLabel != ""
 }
 
 // factorySerialInFlightExcluding reports whether a serial card OTHER than
```

**File**: `internal/cli/factory_lane_join_guard_test.go` (added, +131/-0)
```diff
@@ -0,0 +1,131 @@
+// factory_lane_join_guard_test.go — card t1513: the serial slot is held by a
+// recorded driver, not by a state alone. A join-time worktree-root refusal
+// was designed here and WITHDRAWN (see the verdict §부록 C): the lease layer
+// already refuses a tree-rooted lane through factoryAssertParentCheckout on
+// every path, and a join-time refusal fires inside this repository's own
+// worktree-rooted test runs, breaking the whole join family.
+package cli
+
+import (
+	"context"
+	"strings"
+	"testing"
+	"time"
+
+	"github.com/modu-ai/moai-adk/internal/homestate"
+)
+
+// TestFactorySerialSlotHeldRequiresADriver — the slot predicate matrix. A row
+// without an owner holds nothing (the t1453 wedge: picked, ownerless,
+// lease-less, refusing every lease for a day); every driven row keeps the
+// pre-existing behavior.
+func TestFactorySerialSlotHeldRequiresADriver(t *testing.T) {
+	now := time.Now()
+	live := now.Add(time.Hour).Format(time.RFC3339Nano)
+	expired := now.Add(-time.Minute).Format(time.RFC3339Nano)
+	cases := []struct {
+		name string
+		card homestate.Card
+		want bool
+	}{
+		{"picked without owner or lease holds nothing", homestate.Card{CardID: "t1453", State: homestate.CardPicked}, false},
+		{"picked with an owner holds", homestate.Card{CardID: "t1", State: homestate.CardPicked, OwnerLabel: "lane-5"}, true},
+		{"assigned with an owner holds", homestate.Card{CardID: "t2", State: homestate.CardAssigned, OwnerLabel: "lane-2"}, true},
+		{"leased with a live lease holds", homestate.Card{CardID: "t3", State: homestate.CardLeased, OwnerLabel: "lane-1", LeaseHolder: "lane-1", LeaseExpiresAt: live}, true},
+		{"an expired lease frees", homestate.Card{CardID: "t4", State: homestate.CardLeased, OwnerLabel: "lane-1", LeaseHolder: "lane-1", LeaseExpiresAt: expired}, false},
+		{"merge-ready frees", homestate.Card{CardID: "t5", State: homestate.CardMergeReady, OwnerLabel: "lane-1"}, false},
+	}
+	for _, tc := range cases {
+		if got := factorySerialSlotHeld(tc.card, now); got != tc.want {
+			t.Errorf("%s: held=%v, want %v", tc.name, got, tc.want)
+		}
+	}
+}
+
+// TestFactoryNextIgnoresDriverlessPickedRow — the end-to-end release: with a
+// picked, ownerless, lease-less serial row sitting in the run record (the
+// measured t1453 shape), a lane's `factory next --card` leases instead of
+// being refused serial-slot.
+func TestFactoryNextIgnoresDriverlessPickedRow(t *testing.T) {
+	root, _ := flSerialPair(t)
+	nmIsolatedWorktrees(t, "t1", "t2")
+	fcPlace(t, root, homestate.Card{CardID: "t1453", State: homestate.CardPicked})
+	nmLaneEnv(t, "lane-1", "")
+	_, stderr, err := qasRunNext(t, "--run", fcRun, "--card", "t1")
+	if err != nil {
+		t.Fatalf("factory next refused with a driverless picked row in the record: %v stderr=%q", err, stderr)
+	}
+	if st, owner := flRow(t, root, "t1"); st != homestate.CardLeased {
+		t.Fatalf("t1 state=%s owner=%q, want leased", st, owner)
+	}
+}
+
+// TestFactoryNextStillRefusedBehindADrivenRow — the control arm: with an
+// owned serial row in flight (no lease, owner recorded), the slot still holds
+// and `factory next` is refused serial-slot.
+func TestFactoryNextStillRefusedBehindADrivenRow(t *testing.T) {
+	root, _ := flSerialPair(t)
+	nmIsolatedWorktrees(t, "t1", "t2")
+	fcPlace(t, root, homestate.Card{CardID: "t1453", State: homestate.CardPicked, OwnerLabel: "lane-2"})
+	nmLaneEnv(t, "lane-1", "")
+	_, stderr, err := qasRunNext(t, "--run", fcRun, "--card", "t1")
+	if err == nil {
+		t.Fatalf("factory next leased behind a driven serial row: stderr=%q", stderr)
+	}
+	if !strings.Contains(stderr, "refused serial-slot") {
+		t.Fatalf("refusal is not serial-slot: %v stderr=%q", err, stderr)
+	}
+}
+
+// TestFactoryNextRefusesAgainAfterLaterAssign — the reversal path the
+// predicate comment promises (card t1513 review P3-3): an ownerless picked
+// row releases the slot and a lease goes through; a later T2 assign sets the
+// owner and the row holds the slot again.
+func TestFactoryNextRefusesAgainAfterLaterAssign(t *testing.T) {
+	root, _ := flSerialPair(t)
+	nmIsolatedWorktrees(t, "t1", "t2")
+	ctx := context.Background()
+	now := time.Now()
+
+	// The ownerless picked row: recorded the way `factory assign` without
+	// --to leaves it.
+	db, err := homestate.OpenFactory(root)
+	if err != nil {
+		t.Fatalf("open factory: %v", err)
+	}
+	card, err := db.RecordPicked(ctx, fcRun, "t1453", homestate.CardFields{}, "assign", now)
+	if err != nil {
+		t.Fatalf("record picked: %v", err)
+	}
+	if err := db.Close(); err != nil {
+		t.Fatalf("close factory: %v", err)
+	}
+
+	nmLaneEnv(t, "lane-1", "")
+	if _, stderr, err := qasRunNext(t, "--run", fcRun, "--card", "t1"); err != nil {
+		t.Fatalf("an ownerless picked row must not refuse the lease: %v stderr=%q", err, stderr)
+	}
+
+	// T2 assign sets the owner — the row holds again.
+	picked := fcCard(t, root, "t1453")
+	db, err = homestate.OpenFactory(root)
+	if err != nil {
+		t.Fatalf("reopen factory: %v",
```

**File**: `internal/cli/factory_serial_slot_stale_test.go` (modified, +18/-19)
```diff
@@ -268,20 +268,21 @@ func TestFactoryNextAssignedSerialCardHoldsSlotInPickedArms(t *testing.T) {
 }
 
 // TestFactoryNextOwnAssignedSerialCardBlockedByPickedSibling — the option-B
-// exception ignores sibling `assigned` rows and nothing else: a `picked` serial
-// row still counts in arm (a), so a lane's own assigned serial card is not
-// leased past it. (Both rows then wait on each other — arm b cannot take the
-// picked row while the assigned one holds the slot; that residual belongs to
-// the same ruling and is recorded in the amendment, not repaired here.) A
-// mutation that ignores `picked` as well as `assigned` fails this test.
+// exception ignores sibling `assigned` rows and nothing else: a DRIVEN `picked`
+// serial row (an owner recorded) still counts in arm (a), so a lane's own
+// assigned serial card is not leased past it. Card t1513 refined the row read
+// from state-only to driver-carrying — an ownerless picked sibling releases
+// the slot (see TestFactoryNextPickedOwnerlessRowReleasesSlot) — so the
+// blocking shape here is picked WITH an owner. A mutation that ignores driven
+// `picked` rows as well as `assigned` fails this test.
 func TestFactoryNextOwnAssignedSerialCardBlockedByPickedSibling(t *testing.T) {
 	root, store := fcFixture(t)
 	fcQueue(t, store, factory.BacklogStatePicked, factory.BacklogStatePicked)
 	fcClassify(t, store, "t1", factory.ClassPriorityNormal, false, factory.ClassModeSerial)
 	fcClassify(t, store, "t2", factory.ClassPriorityNormal, false, factory.ClassModeSerial)
 	fcPlace(t, root,
 		homestate.Card{CardID: "t1", State: homestate.CardAssigned, OwnerLabel: "lane-1"},
-		homestate.Card{CardID: "t2", State: homestate.CardPicked},
+		homestate.Card{CardID: "t2", State: homestate.CardPicked, OwnerLabel: "lane-2"},
 	)
 	sdRegisterLane(t, root, "lane-1")
 
@@ -290,7 +291,7 @@ func TestFactoryNextOwnAssignedSerialCardBlockedByPickedSibling(t *testing.T) {
 		t.Fatalf("next: %v", err)
 	}
 	if owned {
-		t.Fatalf("lane-1 leased its assigned %s past a picked serial sibling; only assigned siblings are ignored in arm (a)", got.CardID)
+		t.Fatalf("lane-1 leased its assigned %s past a driven picked serial sibling; only assigned siblings are ignored in arm (a)", got.CardID)
 	}
 }
 
@@ -332,15 +333,13 @@ func TestFactoryNextParallelizableLeasesBesideLiveSerial(t *testing.T) {
 	}
 }
 
-// TestFactoryNextPickedOwnerlessRowHoldsSlot_OutOfExpiryScope measures the
-// boundary of the expiry repair: a `picked` row with no owner and no lease —
-// what a failed claim leaves behind, and the shape of t810 in run tm9i7y — is
-// not a lease-holding state, so lease expiry never reaches it and it keeps
-// holding the serial slot. The queue side of t1 is blocked (the operator-held
-// shape), so no lane can take t1 itself and t2 stays refused. Whether such a
-// row should release the slot is the same ruling as the assigned case
-// (REQ-TCD-008), not part of this card's expiry repair.
-func TestFactoryNextPickedOwnerlessRowHoldsSlot_OutOfExpiryScope(t *testing.T) {
+// TestFactoryNextPickedOwnerlessRowReleasesSlot — the ruling the expiry
+// repair left open is now made by card t1513: a `picked` row with no owner
+// and no lease — what a failed claim leaves behind, and the shape of t1453 in
+// run tmf011 — has no recorded driver, so it holds nothing and the queued
+// serial card behind it leases. (The superseded form of this test pinned the
+// old hold; its own comment recorded the ruling as out of that card's scope.)
+func TestFactoryNextPickedOwnerlessRowReleasesSlot(t *testing.T) {
 	root, store := fcFixture(t)
 	fcQueue(t, store, factory.BacklogStateQueued, factory.BacklogStateQueued)
 	fcClassify(t, store, "t1", factory.ClassPriorityNormal, true, factory.ClassModeSerial)
@@ -352,7 +351,7 @@ func TestFactoryNextPickedOwnerlessRowHoldsSlot_OutOfExpiryScope(t *testing.T) {
 	if err != nil {
 		t.Fatalf("next: %v", err)
 	}
-	if owned {
-		t.Fatalf("lane-1 leased %s; a picked ownerless row is outside lease expiry and keeps holding the slot", got.CardID)
+	if !owned || got.CardID != "t2" {
+		t.Fatalf("lane-1 next = (%s, owned=%v), want t2 leased past the ownerless picked t1 (card t1513 ruling)", got.CardID, owned)
 	}
 }
```

---

### Incident Patch 4: `ec13872f` (2026-10-05)
**Commit Message**: fix(cli): skip the codex review gate when the gate binary predates the session tree (card t1528) (#1756)

Root cause of the leader-session 900s turn-end reviews: the hook's
3-tier binary resolution prefers $CLAUDE_PROJECT_DIR/bin/moai, and the
primary checkout's bin/moai was v3.2.0-rc.24 @ c8f245c2c (2026-09-29
tree) — predating BOTH the tree_scope policy (7919da731, 10-02) and the
primary_scope skip (912773c64, 10-03). The executing handler therefore
had no skip policy at all, and the leader's explicit primary_scope:
skip mitigation was a key the stale binary could not even read.

Repair: a binary-age policy shared by both automatic paths (Claude Stop
+ Codex Stop-chain member 6, REQ-CRO-006) — a binlag verdict of
StatusBehind (the gate binary a strict ancestor of the session tree's
HEAD) lets the turn through with a diagnostic row, because the gate
would judge the tree with policy older than the code under review.
Fail-open in the review direction: fresh, divergent, ahead and
not-applicable all review as before. The verdict is read through
binlag.Evaluate — REQ-ABI-006 keeps it the one binary-lag judge; no new
ancestry primitive lands in internal/cli (the exact-set sweep baseline

**File**: `internal/cli/codex_review_binary_age.go` (added, +88/-0)
```diff
@@ -0,0 +1,88 @@
+package cli
+
+// The codex review gate's binary-age policy (card t1528) — the sibling of the
+// tree_scope / primary_scope policies in codex_review_tree_scope.go.
+//
+// The gate binary is itself a judge: its handler embodies the review policies
+// (tree_scope, primary_scope, the self-gate, the receipt rules) that decide
+// what the review covers. A binary whose build commit is a strict ancestor of
+// the session tree's HEAD (binlag.StatusBehind) is running policy OLDER than
+// the code it would judge — the observed t1528 defect shape, where the leader's
+// primary checkout carried a pre-SPEC-CODEX-GATE-SCOPING-001 bin/moai, so the
+// primary-scope skip that the source prescribed never existed in the executing
+// handler and every turn-end reviewed the whole tree.
+//
+// The skip is therefore fail-open in the REVIEW direction: only a decidable
+// behind verdict skips; fresh, divergent, ahead and not-applicable all review
+// exactly as before. An undecidable age (a development build with no commit
+// metadata, a non-git session tree) is not evidence of staleness.
+//
+// Like treeScopeSkipApplies, this policy runs on BOTH automatic paths — the
+// Claude Stop hook and the Codex Stop-chain member 6 — so they cannot disagree
+// (REQ-CRO-006). The explicit producer `moai verify codex-review` never calls
+// it.
+//
+// The verdict itself is NOT re-implemented here: REQ-ABI-006 keeps
+// binlag.Evaluate the one binary-lag judge, and this policy only reads it.
+
+import (
+	"context"
+	"encoding/json"
+	"fmt"
+	"os"
+
+	"github.com/modu-ai/moai-adk/internal/binlag"
+	"github.com/modu-ai/moai-adk/pkg/version"
+)
+
+// reviewGateLagEvaluator is the injectable seam over the one binary-lag judge
+// (binlag.Evaluate); tests stub the verdict instead of shelling out to git.
+var reviewGateLagEvaluator = binlag.Evaluate
+
+// reviewGateBinaryIdentity supplies the judging build's commit and version
+// coordinates (ldflags-injected); tests stub them.
+var reviewGateBinaryIdentity = func() (commit, ver string) {
+	return version.Commit, version.Version
+}
+
+// binaryAgeSkipLogger is the policy-observation sink; tests swap it to capture
+// the row.
+var binaryAgeSkipLogger = logBinaryAgeSkip
+
+// staleBinarySkipApplies reports whether the gate must let the turn through
+// because the executing binary predates the session tree it would judge.
+// sessionDir is the already-resolved session tree (the scope's Dir); an empty
+// dir is not decidable and reviews as before.
+func staleBinarySkipApplies(sessionDir string) bool {
+	commit, ver := reviewGateBinaryIdentity()
+	verdict := reviewGateLagEvaluator(context.Background(), binlag.Request{
+		Dir:           sessionDir,
+		BinaryCommit:  commit,
+		BinaryVersion: ver,
+	})
+	if verdict.Status != binlag.StatusBehind {
+		return false
+	}
+	binaryAgeSkipLogger(verdict)
+	return true
+}
+
+// logBinaryAgeSkip writes the skip row to stderr, the gate's diagnostic channel
+// (stdout stays the pure HookOutput contract), distinguishable per axis
+// (REQ-CGSC-011): the row names the binary_age policy and both coordinates the
+// verdict compared.
+func logBinaryAgeSkip(verdict binlag.Verdict) {
+	row := map[string]any{
+		"gate":          "codex-review-gate",
+		"policy":        "binary_age",
+		"verdict":       verdict.Status,
+		"binary_commit": binlag.Short(verdict.BinaryCommit),
+		"tree_head":     binlag.Short(verdict.SourceHead),
+		"basis":         "gate binary predates the session tree — its review policies are older than the code under review",
+	}
+	b, err := json.Marshal(row)
+	if err != nil {
+		return
+	}
+	fmt.Fprintln(os.Stderr, string(b))
+}
```

**File**: `internal/cli/codex_review_binary_age_test.go` (added, +121/-0)
```diff
@@ -0,0 +1,121 @@
+package cli
+
+import (
+	"context"
+	"testing"
+
+	"github.com/modu-ai/moai-adk/internal/binlag"
+)
+
+// stubLag installs a lag-evaluator stub returning status and restores the real
+// seam on cleanup; captured records whether the policy consulted the judge.
+func stubLag(t *testing.T, status binlag.Status) *bool {
+	t.Helper()
+	called := false
+	prev := reviewGateLagEvaluator
+	reviewGateLagEvaluator = func(_ context.Context, _ binlag.Request) binlag.Verdict {
+		called = true
+		return binlag.Verdict{Status: status, BinaryCommit: "aaa111111", SourceHead: "bbb222222"}
+	}
+	t.Cleanup(func() { reviewGateLagEvaluator = prev })
+	return &called
+}
+
+// stubIdentity pins the binary's ldflags coordinates.
+func stubIdentity(t *testing.T, commit, ver string) {
+	t.Helper()
+	prev := reviewGateBinaryIdentity
+	reviewGateBinaryIdentity = func() (string, string) { return commit, ver }
+	t.Cleanup(func() { reviewGateBinaryIdentity = prev })
+}
+
+func TestStaleBinarySkip_BehindSkips(t *testing.T) {
+	called := stubLag(t, binlag.StatusBehind)
+	stubIdentity(t, "aaa111111", "v1")
+	var rows []binlag.Verdict
+	prevLog := binaryAgeSkipLogger
+	binaryAgeSkipLogger = func(v binlag.Verdict) { rows = append(rows, v) }
+	t.Cleanup(func() { binaryAgeSkipLogger = prevLog })
+
+	if !staleBinarySkipApplies("/some/tree") {
+		t.Fatalf("behind verdict must skip")
+	}
+	if !*called {
+		t.Fatalf("policy did not consult the binary-lag judge")
+	}
+	if len(rows) != 1 {
+		t.Fatalf("behind skip must log exactly one row, got %d", len(rows))
+	}
+}
+
+func TestStaleBinarySkip_NonBehindVerdictsReview(t *testing.T) {
+	for _, status := range []binlag.Status{
+		binlag.StatusFresh,
+		binlag.StatusDivergent,
+		binlag.StatusAhead,
+		binlag.StatusNotApplicable,
+	} {
+		t.Run(string(status), func(t *testing.T) {
+			stubLag(t, status)
+			stubIdentity(t, "aaa111111", "v1")
+			if staleBinarySkipApplies("/some/tree") {
+				t.Fatalf("%s verdict must not skip — only a decidable behind verdict is staleness", status)
+			}
+		})
+	}
+}
+
+// The real judge's undecidable path: a development build carries no commit
+// metadata, so the policy must review (fail-open in the review direction) —
+// this exercises binlag.Evaluate itself, not a stub.
+func TestStaleBinarySkip_DevBuildReviews(t *testing.T) {
+	prev := reviewGateLagEvaluator
+	reviewGateLagEvaluator = binlag.Evaluate
+	t.Cleanup(func() { reviewGateLagEvaluator = prev })
+	stubIdentity(t, "", "dev")
+
+	if staleBinarySkipApplies("/some/tree") {
+		t.Fatalf("a development build (no commit metadata) must not skip")
+	}
+}
+
+// The gate-level contract: on a behind verdict the Claude Stop path returns
+// ALLOW with the binary_age row logged — the row is the observable that the
+// binary-age policy decided the outcome, not a later fail-open arm.
+func TestHandleCodexReviewGate_StaleBinaryAllowsWithRow(t *testing.T) {
+	stubLag(t, binlag.StatusBehind)
+	stubIdentity(t, "aaa111111", "v1")
+	var rows int
+	prevLog := binaryAgeSkipLogger
+	binaryAgeSkipLogger = func(binlag.Verdict) { rows++ }
+	t.Cleanup(func() { binaryAgeSkipLogger = prevLog })
+
+	out, err := HandleCodexReviewGate(gateInput(false), true /* enabled */, "/proj")
+	if err != nil {
+		t.Fatalf("gate error: %v", err)
+	}
+	if out == nil || out.Decision != "" {
+		t.Fatalf("stale-binary path must ALLOW with an empty decision, got %+v", out)
+	}
+	if rows != 1 {
+		t.Fatalf("stale-binary ALLOW must carry exactly one binary_age row, got %d", rows)
+	}
+}
+
+// Contrast: on a fresh verdict the policy stays silent — the gate proceeds past
+// the binary-age arm with no row.
+func TestHandleCodexReviewGate_FreshBinaryLogsNoRow(t *testing.T) {
+	stubLag(t, binlag.StatusFresh)
+	stubIdentity(t, "aaa111111", "v1")
+	var rows int
+	prevLog := binaryAgeSkipLogger
+	binaryAgeSkipLogger = func(binlag.Verdict) { rows++ }
+	t.Cleanup(func() { binaryAgeSkipLogger = prevLog })
+
+	if _, err := HandleCodexReviewGate(gateInput(false), true /* enabled */, "/proj"); err != nil {
+		t.Fatalf("gate error: %v", err)
+	}
+	if rows != 0 {
+		t.Fatalf("fresh binary must not log a binary_age row, got %d", rows)
+	}
+}
```

**File**: `internal/cli/codex_review_gate.go` (modified, +7/-0)
```diff
@@ -106,6 +106,13 @@ func HandleCodexReviewGate(input *hook.HookInput, enabled bool, projectDir strin
 	// serves both execution paths (REQ-CGS-009).
 	scope := reviewScopeResolver(reviewScopeSessionDir(input, projectDir))
 	reviewGateScopeLogger(scope, reviewGateEnvContext())
+	// (3a-0) The binary-age policy (card t1528): a gate binary whose build
+	// commit predates the session tree judges the tree with policy older than
+	// the code under review — skip before any scope-dependent policy runs.
+	// Shared with the Codex Stop-chain path (REQ-CRO-006).
+	if staleBinarySkipApplies(scope.Dir) {
+		return allow, nil
+	}
 	// (3a) The tree_scope policy: a tree-class session with no WT- evidence has
 	// no card to attribute its tree to. The read root is the one `enabled` came
 	// from (reviewGateConfigRoot), resolved only when the class is tree.
```

**File**: `internal/cli/codex_stop_chain.go` (modified, +6/-0)
```diff
@@ -623,6 +623,12 @@ func (c *codexStopChain) codexReviewMember(ctx context.Context) stopMemberOutcom
 	}
 	scope := reviewScopeResolver(c.root)
 	reviewGateScopeLogger(scope, reviewGateEnvContext())
+	// The binary-age policy, shared with the Claude path (card t1528): a gate
+	// binary predating this session tree judges it with policy older than the
+	// code under review — skip before any scope-dependent policy runs.
+	if staleBinarySkipApplies(scope.Dir) {
+		return stopMemberOutcome{Decision: codexadapter.DecisionAllow, Status: stopStatusNotApplicable, Reason: "binary_age=behind"}
+	}
 	// The tree_scope policy, shared with the Claude path (REQ-CRO-006): the key
 	// is read from c.root, the same root `enabled` was read from above. A skip
 	// reads no receipt.
```

---

### Incident Patch 5: `a158b4b5` (2026-10-05)
**Commit Message**: merge(WT-ci-test-timeout): repair the four guard failures left on develop after the cutover (PR #1748 round 2, card pr-1748-r2)

🗿 MoAI

**File**: `.claude/rules/moai/development/manager-develop-prompt-template.md` (modified, +1/-1)
```diff
@@ -168,7 +168,7 @@ Explicit list in each delegation prompt:
 
 > Each E-item is reported per the verification-claim-integrity 5-section format (Claim / Evidence / Baseline-attribution / Gaps / Residual-risk) — see `.claude/rules/moai/core/verification-claim-integrity.md` §3.
 
-**Attribution discipline (the attributable diff-check pattern).** Each §E item (E1-E8) is a formal attributable artifact, not a self-report summary. For every item, the manager-develop MUST name, verbatim:
+**Attribution discipline (SPEC-SYNC-PARALLEL-DOCS-001 A9).** Each §E item (E1-E8) is a formal attributable artifact, not a self-report summary. For every item, the manager-develop MUST name, verbatim:
 - **(a) the command** — the exact invocation that produced the evidence (e.g. `go test ./internal/<pkg>/...`);
 - **(b) the observed output** — the verbatim result block the invocation produced in this run, against this tree (summarized evidence like "all tests passed" is NOT acceptable);
 - **(c) the baseline-attribution** — `(this run, this tree)` plus the HEAD SHA the evidence was captured against, so a later consumer can diff-check the attribution chain.
```

**File**: `internal/harness/rosterguard/registry.go` (modified, +17/-15)
```diff
@@ -544,22 +544,24 @@ func Registry() []Site {
 		// The github-flow cutover preserved deployed policies, manifests and
 		// audit captures into the tracked tree. Each enumerates the agent
 		// names as they stood at capture — a legitimate partial listing, not
-		// a roster claim. Membership only; the numeral layer's citations for
-		// the overlapping paths are carried by the NumeralExemptions rows.
+		// a roster claim. The rows assert nothing — a subset-by-design axis
+		// carries no membership assertion (check.go's registry-contradiction
+		// rule) — and the numeral layer's citations for the overlapping paths
+		// are carried by the NumeralExemptions rows.
 		// Removing the preservation copies removes these rows with them.
-		{ID: "cutover-manifest-listing", Path: ".moai/manifest.json", Axis: AxisSubsetByDesign, Claims: ClaimMembership, Note: "HISTORICAL CAPTURE: the cutover-preserved manifest enumerates the agent definitions as deployed."},
-		{ID: "cutover-policy-agent-authoring-listing", Path: ".moai/policies/development/agent-authoring.md", Axis: AxisSubsetByDesign, Claims: ClaimMembership, Note: "HISTORICAL CAPTURE: preserved policy copy quoting the agent names as deployed."},
-		{ID: "cutover-policy-agent-patterns-listing", Path: ".moai/policies/development/agent-patterns.md", Axis: AxisSubsetByDesign, Claims: ClaimMembership, Note: "HISTORICAL CAPTURE: preserved policy copy quoting the agent names as deployed."},
-		{ID: "cutover-policy-spec-workflow-listing", Path: ".moai/policies/workflow/spec-workflow.md", Axis: AxisSubsetByDesign, Claims: ClaimMembership, Note: "HISTORICAL CAPTURE: preserved policy copy quoting the agent names as deployed."},
-		{ID: "cutover-audit-cards-before-listing", Path: "reports/hooks-audit-20260911-01a08e35/cards-before.json", Axis: AxisSubsetByDesign, Claims: ClaimMembership, Note: "HISTORICAL CAPTURE: a 2026-09-11 hooks-audit card capture, listing agents as they stood."},
-		{ID: "cutover-audit-cards-after-listing", Path: "reports/hooks-audit-20260911-01a08e35/cards-after.json", Axis: AxisSubsetByDesign, Claims: ClaimMembership, Note: "HISTORICAL CAPTURE: a 2026-09-11 hooks-audit card capture, listing agents as they stood."},
-		{ID: "cutover-audit-agent-inventory-listing", Path: "reports/workflow-performance-audit-20260911/agent-inventory.json", Axis: AxisSubsetByDesign, Claims: ClaimMembership, Note: "HISTORICAL CAPTURE: a 2026-09-11 audit inventory of agent files as they stood."},
-		{ID: "cutover-audit-baseline-listing", Path: "reports/workflow-performance-audit-20260911/baseline.json", Axis: AxisSubsetByDesign, Claims: ClaimMembership, Note: "HISTORICAL CAPTURE: a 2026-09-11 audit baseline capture listing agents as measured."},
-		{ID: "cutover-audit-evidence-listing", Path: "reports/workflow-performance-audit-20260911/evidence.json", Axis: AxisSubsetByDesign, Claims: ClaimMembership, Note: "HISTORICAL CAPTURE: a 2026-09-11 audit evidence capture listing agents as measured."},
-		{ID: "cutover-audit-print-check-listing", Path: "reports/workflow-performance-audit-20260911/print-check.pdf", Axis: AxisSubsetByDesign, Claims: ClaimMembership, Note: "HISTORICAL CAPTURE: the audit's print-check PDF, quoting the report's listings."},
-		{ID: "cutover-audit-report-html-listing", Path: "reports/workflow-performance-audit-20260911/report.html", Axis: AxisSubsetByDesign, Claims: ClaimMembership, Note: "HISTORICAL CAPTURE: the audit report's HTML rendering, quoting the agent listings."},
-		{ID: "cutover-audit-report-md-listing", Path: "reports/workflow-performance-audit-20260911/report.md", Axis: AxisSubsetByDesign, Claims: ClaimMembership, Note: "HISTORICAL CAPTURE: the audit report, quoting the agent listings it measured."},
-		{ID: "cutover-audit-rules-inventory-listing", Path: "reports/workflow-performance-audit-20260911/rules-inventory.json", Axis: AxisSubsetByDesign, Claims: ClaimMembership, Note: "HISTORICAL CAPTURE: a 2026-09-11 audit capture whose rule inventory quotes the agent names."},
+		{ID: "cutover-manifest-listing", Path: ".moai/manifest.json", Axis: AxisSubsetByDesign, Note: "HISTORICAL CAPTURE: the cutover-preserved manifest enumerates the agent definitions as deployed."},
+		{ID: "cutover-policy-agent-authoring-listing", Path: ".moai/policies/development/agent-authoring.md", Axis: AxisSubsetByDesign, Note: "HISTORICAL CAPTURE: preserved policy copy quoting the agent names as deployed."},
+		{ID: "cutover-policy-agent-patterns-listing", Path: ".moai/policies/development/agent-patterns.md", Axis: AxisSubsetByDesign, Note: "HISTORICAL CAPTURE: preserved policy copy quoting the agent names as deployed."},
+		{ID: "cutover-policy-spec-workflow-listing", Path: ".moai/policies/workflow/spec-workflow.md", Axis: AxisSubsetByDesign, Note: "HISTORICAL CAPTURE: preserved policy copy quoting the agent names as deployed."},
+		{ID: "cutover-audit-cards-before-listing", Path: "reports/hooks-audit-20260911-01a08e35/cards-before.json", Axis: AxisSubsetByDesign, 
```

**File**: `internal/template/workflow_worktree_key_honesty_test.go` (modified, +0/-2)
```diff
@@ -60,7 +60,6 @@ var expectedWorktreeReaders = map[string][]string{
 	"auto_merge":           {"internal/cli/session_worktree_automerge.go"},
 	"auto_cleanup":         {"internal/cli/session_worktree.go", "internal/cli/session_worktree_prmerge.go"},
 	"session_name_pattern": {},
-	"tmux_preferred":       {},
 }
 
 // reservedWorktreeKeys declares the keys whose reader status is "reserved: no
@@ -70,7 +69,6 @@ var expectedWorktreeReaders = map[string][]string{
 // (REQ-005) rather than silently re-classifying the key as read.
 var reservedWorktreeKeys = map[string]bool{
 	"session_name_pattern": true,
-	"tmux_preferred":       true,
 }
 
 // mandatoryAutoCleanupReaders names the two load-bearing auto-cleanup sites
```

---

### Incident Patch 6: `c6ad7989` (2026-10-05)
**Commit Message**: fix(guards): repair the four guard failures left on develop after the cutover (PR #1748 round 2)

- rosterguard: the 13 cutover-preserved listing rows declared
  ClaimMembership on AxisSubsetByDesign, which supports no membership
  assertion (check.go's registry-contradiction rule). Subset rows
  assert nothing — the agentfm-grid-bucket-rank precedent — so the
  Claims field is dropped; every row keeps its HISTORICAL CAPTURE note,
  which is what the empty-claim Note requirement wants.
- template: the worktree key honesty tables still carried the
  tmux_preferred key after #1740 retired the struct field — the REQ-006
  orphan-key defect. Both entries (expectedWorktreeReaders,
  reservedWorktreeKeys) removed.
- spec: t1522's cutover rewrite neutralized the local copy of the
  manager-develop prompt template's line 171 as well, silently
  reverting the §25 SPEC-ID divergence the AC mirror-parity test pins
  (local carries SPEC-SYNC-PARALLEL-DOCS-001, mirror stays sanitized).
  The local line's SPEC-ID form is restored; the mirror is untouched.

Measured: all four failures reproduced locally before the repair; the
rosterguard package, the internal/spec TestAC family, and the honesty
t

**File**: `.claude/rules/moai/development/manager-develop-prompt-template.md` (modified, +1/-1)
```diff
@@ -168,7 +168,7 @@ Explicit list in each delegation prompt:
 
 > Each E-item is reported per the verification-claim-integrity 5-section format (Claim / Evidence / Baseline-attribution / Gaps / Residual-risk) — see `.claude/rules/moai/core/verification-claim-integrity.md` §3.
 
-**Attribution discipline (the attributable diff-check pattern).** Each §E item (E1-E8) is a formal attributable artifact, not a self-report summary. For every item, the manager-develop MUST name, verbatim:
+**Attribution discipline (SPEC-SYNC-PARALLEL-DOCS-001 A9).** Each §E item (E1-E8) is a formal attributable artifact, not a self-report summary. For every item, the manager-develop MUST name, verbatim:
 - **(a) the command** — the exact invocation that produced the evidence (e.g. `go test ./internal/<pkg>/...`);
 - **(b) the observed output** — the verbatim result block the invocation produced in this run, against this tree (summarized evidence like "all tests passed" is NOT acceptable);
 - **(c) the baseline-attribution** — `(this run, this tree)` plus the HEAD SHA the evidence was captured against, so a later consumer can diff-check the attribution chain.
```

**File**: `internal/harness/rosterguard/registry.go` (modified, +17/-15)
```diff
@@ -544,22 +544,24 @@ func Registry() []Site {
 		// The github-flow cutover preserved deployed policies, manifests and
 		// audit captures into the tracked tree. Each enumerates the agent
 		// names as they stood at capture — a legitimate partial listing, not
-		// a roster claim. Membership only; the numeral layer's citations for
-		// the overlapping paths are carried by the NumeralExemptions rows.
+		// a roster claim. The rows assert nothing — a subset-by-design axis
+		// carries no membership assertion (check.go's registry-contradiction
+		// rule) — and the numeral layer's citations for the overlapping paths
+		// are carried by the NumeralExemptions rows.
 		// Removing the preservation copies removes these rows with them.
-		{ID: "cutover-manifest-listing", Path: ".moai/manifest.json", Axis: AxisSubsetByDesign, Claims: ClaimMembership, Note: "HISTORICAL CAPTURE: the cutover-preserved manifest enumerates the agent definitions as deployed."},
-		{ID: "cutover-policy-agent-authoring-listing", Path: ".moai/policies/development/agent-authoring.md", Axis: AxisSubsetByDesign, Claims: ClaimMembership, Note: "HISTORICAL CAPTURE: preserved policy copy quoting the agent names as deployed."},
-		{ID: "cutover-policy-agent-patterns-listing", Path: ".moai/policies/development/agent-patterns.md", Axis: AxisSubsetByDesign, Claims: ClaimMembership, Note: "HISTORICAL CAPTURE: preserved policy copy quoting the agent names as deployed."},
-		{ID: "cutover-policy-spec-workflow-listing", Path: ".moai/policies/workflow/spec-workflow.md", Axis: AxisSubsetByDesign, Claims: ClaimMembership, Note: "HISTORICAL CAPTURE: preserved policy copy quoting the agent names as deployed."},
-		{ID: "cutover-audit-cards-before-listing", Path: "reports/hooks-audit-20260911-01a08e35/cards-before.json", Axis: AxisSubsetByDesign, Claims: ClaimMembership, Note: "HISTORICAL CAPTURE: a 2026-09-11 hooks-audit card capture, listing agents as they stood."},
-		{ID: "cutover-audit-cards-after-listing", Path: "reports/hooks-audit-20260911-01a08e35/cards-after.json", Axis: AxisSubsetByDesign, Claims: ClaimMembership, Note: "HISTORICAL CAPTURE: a 2026-09-11 hooks-audit card capture, listing agents as they stood."},
-		{ID: "cutover-audit-agent-inventory-listing", Path: "reports/workflow-performance-audit-20260911/agent-inventory.json", Axis: AxisSubsetByDesign, Claims: ClaimMembership, Note: "HISTORICAL CAPTURE: a 2026-09-11 audit inventory of agent files as they stood."},
-		{ID: "cutover-audit-baseline-listing", Path: "reports/workflow-performance-audit-20260911/baseline.json", Axis: AxisSubsetByDesign, Claims: ClaimMembership, Note: "HISTORICAL CAPTURE: a 2026-09-11 audit baseline capture listing agents as measured."},
-		{ID: "cutover-audit-evidence-listing", Path: "reports/workflow-performance-audit-20260911/evidence.json", Axis: AxisSubsetByDesign, Claims: ClaimMembership, Note: "HISTORICAL CAPTURE: a 2026-09-11 audit evidence capture listing agents as measured."},
-		{ID: "cutover-audit-print-check-listing", Path: "reports/workflow-performance-audit-20260911/print-check.pdf", Axis: AxisSubsetByDesign, Claims: ClaimMembership, Note: "HISTORICAL CAPTURE: the audit's print-check PDF, quoting the report's listings."},
-		{ID: "cutover-audit-report-html-listing", Path: "reports/workflow-performance-audit-20260911/report.html", Axis: AxisSubsetByDesign, Claims: ClaimMembership, Note: "HISTORICAL CAPTURE: the audit report's HTML rendering, quoting the agent listings."},
-		{ID: "cutover-audit-report-md-listing", Path: "reports/workflow-performance-audit-20260911/report.md", Axis: AxisSubsetByDesign, Claims: ClaimMembership, Note: "HISTORICAL CAPTURE: the audit report, quoting the agent listings it measured."},
-		{ID: "cutover-audit-rules-inventory-listing", Path: "reports/workflow-performance-audit-20260911/rules-inventory.json", Axis: AxisSubsetByDesign, Claims: ClaimMembership, Note: "HISTORICAL CAPTURE: a 2026-09-11 audit capture whose rule inventory quotes the agent names."},
+		{ID: "cutover-manifest-listing", Path: ".moai/manifest.json", Axis: AxisSubsetByDesign, Note: "HISTORICAL CAPTURE: the cutover-preserved manifest enumerates the agent definitions as deployed."},
+		{ID: "cutover-policy-agent-authoring-listing", Path: ".moai/policies/development/agent-authoring.md", Axis: AxisSubsetByDesign, Note: "HISTORICAL CAPTURE: preserved policy copy quoting the agent names as deployed."},
+		{ID: "cutover-policy-agent-patterns-listing", Path: ".moai/policies/development/agent-patterns.md", Axis: AxisSubsetByDesign, Note: "HISTORICAL CAPTURE: preserved policy copy quoting the agent names as deployed."},
+		{ID: "cutover-policy-spec-workflow-listing", Path: ".moai/policies/workflow/spec-workflow.md", Axis: AxisSubsetByDesign, Note: "HISTORICAL CAPTURE: preserved policy copy quoting the agent names as deployed."},
+		{ID: "cutover-audit-cards-before-listing", Path: "reports/hooks-audit-20260911-01a08e35/cards-before.json", Axis: AxisSubsetByDesign, 
```

**File**: `internal/template/workflow_worktree_key_honesty_test.go` (modified, +0/-2)
```diff
@@ -60,7 +60,6 @@ var expectedWorktreeReaders = map[string][]string{
 	"auto_merge":           {"internal/cli/session_worktree_automerge.go"},
 	"auto_cleanup":         {"internal/cli/session_worktree.go", "internal/cli/session_worktree_prmerge.go"},
 	"session_name_pattern": {},
-	"tmux_preferred":       {},
 }
 
 // reservedWorktreeKeys declares the keys whose reader status is "reserved: no
@@ -70,7 +69,6 @@ var expectedWorktreeReaders = map[string][]string{
 // (REQ-005) rather than silently re-classifying the key as read.
 var reservedWorktreeKeys = map[string]bool{
 	"session_name_pattern": true,
-	"tmux_preferred":       true,
 }
 
 // mandatoryAutoCleanupReaders names the two load-bearing auto-cleanup sites
```

---

### Incident Patch 7: `344bc5fb` (2026-10-05)
**Commit Message**: fix(template): regenerate catalog hashes, plugin payloads and declare the cutover-preserved roster listings (card t1525, PR #1748 red)

The 37c8737e7 live-skill restoration changed the deployed skill tree
without the regeneration cycle (make build was blocked by the
plugin-emit drift), so three parity guards and the rosterguard listing
sweep went red:

1. TestCatalogHashParity + TestCatalogHashCoversSkillSubfiles - the
   moai-workflow-worktree whole-tree hash drifted. gen-catalog-hashes
   --all refreshed catalog.yaml.
2. The plugin-emit drift that blocked make build itself - resolved by
   running make plugin-emit: the factory-foreman SKILL.md and the
   worktree integration module now match the generator.
3. TestSweepFindsNoUndeclaredRosterListing - the cutover preservation
   commits put thirteen paths in front of the roster-listing sweep
   (the preserved manifest, four policy copies, and the
   workflow-performance/hooks-audit captures). All thirteen declared
   in Registry() as subset-by-design membership - historical captures,
   not roster claims; removing the preservation copies removes the
   rows with them.

agents-emit verified clean (the C3 tomls already match their s

**File**: `internal/harness/rosterguard/registry.go` (modified, +21/-0)
```diff
@@ -539,6 +539,27 @@ func Registry() []Site {
 		// the layer is expected not to see them. Declaring that — rather than
 		// widening the noun class or quietly dropping the equality — is what
 		// keeps AC-RNA-006(b) strict instead of unsatisfiable.
+
+		// ── Cutover preservation snapshots (PR #1748 transition M2) ────────
+		// The github-flow cutover preserved deployed policies, manifests and
+		// audit captures into the tracked tree. Each enumerates the agent
+		// names as they stood at capture — a legitimate partial listing, not
+		// a roster claim. Membership only; the numeral layer's citations for
+		// the overlapping paths are carried by the NumeralExemptions rows.
+		// Removing the preservation copies removes these rows with them.
+		{ID: "cutover-manifest-listing", Path: ".moai/manifest.json", Axis: AxisSubsetByDesign, Claims: ClaimMembership, Note: "HISTORICAL CAPTURE: the cutover-preserved manifest enumerates the agent definitions as deployed."},
+		{ID: "cutover-policy-agent-authoring-listing", Path: ".moai/policies/development/agent-authoring.md", Axis: AxisSubsetByDesign, Claims: ClaimMembership, Note: "HISTORICAL CAPTURE: preserved policy copy quoting the agent names as deployed."},
+		{ID: "cutover-policy-agent-patterns-listing", Path: ".moai/policies/development/agent-patterns.md", Axis: AxisSubsetByDesign, Claims: ClaimMembership, Note: "HISTORICAL CAPTURE: preserved policy copy quoting the agent names as deployed."},
+		{ID: "cutover-policy-spec-workflow-listing", Path: ".moai/policies/workflow/spec-workflow.md", Axis: AxisSubsetByDesign, Claims: ClaimMembership, Note: "HISTORICAL CAPTURE: preserved policy copy quoting the agent names as deployed."},
+		{ID: "cutover-audit-cards-before-listing", Path: "reports/hooks-audit-20260911-01a08e35/cards-before.json", Axis: AxisSubsetByDesign, Claims: ClaimMembership, Note: "HISTORICAL CAPTURE: a 2026-09-11 hooks-audit card capture, listing agents as they stood."},
+		{ID: "cutover-audit-cards-after-listing", Path: "reports/hooks-audit-20260911-01a08e35/cards-after.json", Axis: AxisSubsetByDesign, Claims: ClaimMembership, Note: "HISTORICAL CAPTURE: a 2026-09-11 hooks-audit card capture, listing agents as they stood."},
+		{ID: "cutover-audit-agent-inventory-listing", Path: "reports/workflow-performance-audit-20260911/agent-inventory.json", Axis: AxisSubsetByDesign, Claims: ClaimMembership, Note: "HISTORICAL CAPTURE: a 2026-09-11 audit inventory of agent files as they stood."},
+		{ID: "cutover-audit-baseline-listing", Path: "reports/workflow-performance-audit-20260911/baseline.json", Axis: AxisSubsetByDesign, Claims: ClaimMembership, Note: "HISTORICAL CAPTURE: a 2026-09-11 audit baseline capture listing agents as measured."},
+		{ID: "cutover-audit-evidence-listing", Path: "reports/workflow-performance-audit-20260911/evidence.json", Axis: AxisSubsetByDesign, Claims: ClaimMembership, Note: "HISTORICAL CAPTURE: a 2026-09-11 audit evidence capture listing agents as measured."},
+		{ID: "cutover-audit-print-check-listing", Path: "reports/workflow-performance-audit-20260911/print-check.pdf", Axis: AxisSubsetByDesign, Claims: ClaimMembership, Note: "HISTORICAL CAPTURE: the audit's print-check PDF, quoting the report's listings."},
+		{ID: "cutover-audit-report-html-listing", Path: "reports/workflow-performance-audit-20260911/report.html", Axis: AxisSubsetByDesign, Claims: ClaimMembership, Note: "HISTORICAL CAPTURE: the audit report's HTML rendering, quoting the agent listings."},
+		{ID: "cutover-audit-report-md-listing", Path: "reports/workflow-performance-audit-20260911/report.md", Axis: AxisSubsetByDesign, Claims: ClaimMembership, Note: "HISTORICAL CAPTURE: the audit report, quoting the agent listings it measured."},
+		{ID: "cutover-audit-rules-inventory-listing", Path: "reports/workflow-performance-audit-20260911/rules-inventory.json", Axis: AxisSubsetByDesign, Claims: ClaimMembership, Note: "HISTORICAL CAPTURE: a 2026-09-11 audit capture whose rule inventory quotes the agent names."},
 	}
 }
 
```

**File**: `internal/template/catalog.yaml` (modified, +1/-1)
```diff
@@ -111,7 +111,7 @@ catalog:
             - name: moai-workflow-worktree
               tier: core
               path: templates/.claude/skills/moai-workflow-worktree/
-              hash: 27d71d161af2c0b4cbcf561e9c77f100fd9de6b11884bd178eb661f440903b7d
+              hash: e90525aaf18e0c48e359e2c665b1315f9a425eb949c04feb92e530e67ab42055
               version: 1.0.0
             - name: moai-domain-html-report
               tier: core
```

**File**: `plugins/moai/skills/moai-factory-foreman/SKILL.md` (modified, +0/-18)
```diff
@@ -33,13 +33,8 @@ progressive_disclosure:
 One unattended pass of the factory foreman: watch the backlog queue, dispatch
 the next operator-picked card to an isolated worker, collect completion
 evidence, report. The queue surface is `moai gtd`; the dispatch protocol and
-<<<<<<< HEAD:plugins/moai/skills/moai-factory-foreman/SKILL.md
 card classes live in the factory dispatch rule (`.claude/rules/moai/workflow/factory-dispatch.md`).
 `foreman` — an auxiliary role of the leader: the unattended watcher that dispatches the already-picked card to an isolated worker when no leader session is holding the queue.
-=======
-card classes live in the kanban dispatch rule (`.claude/rules/moai/workflow/kanban-dispatch.md`).
-`foreman` — an auxiliary role of the leader: the unattended watcher that dispatches the already-picked card to an isolated worker when no leader session holds the board.
->>>>>>> main:.claude/skills/moai-kanban-foreman/SKILL.md
 
 ## Running unattended
 
@@ -71,15 +66,10 @@ not something this loop can do for itself.
    idle. A batch authorization (`/moai:todo --auto` — the operator's typed
    invocation-as-approval) is the card-pick gate's autonomous form
    (`.claude/rules/moai/workflow/auto-semantics.md` §9): within it, serial
-<<<<<<< HEAD:plugins/moai/skills/moai-factory-foreman/SKILL.md
    consumption on its own judgment, outside the keep-set (bar a `[보류` card,
    which is ranked last, not excluded), is authorized; queue
    ADMISSION stays the operator's. A lane takes its card through
    `moai factory next --card <id>`, never through this loop.
-=======
-   consumption in queue order is authorized; queue ADMISSION stays the
-   operator's.
->>>>>>> main:.claude/skills/moai-kanban-foreman/SKILL.md
 2. **No approval gate is answered on the operator's behalf.** When a card's
    next step needs a human decision that is not already recorded as made
    (plan-to-run kickoff approval, a review severity call, a scope choice),
@@ -113,11 +103,7 @@ not something this loop can do for itself.
    - `command`:
 
      ```sh
-<<<<<<< HEAD:plugins/moai/skills/moai-factory-foreman/SKILL.md
      # The queue directory, resolved the way factory.StateDirForRoot does for a
-=======
-     # The queue directory, resolved the way kanban.StateDirForRoot does for a
->>>>>>> main:.claude/skills/moai-kanban-foreman/SKILL.md
      # standard git-repository project: <moai-home>/db/<project-key>/todo,
      # keyed by the repository's canonical (primary-checkout) root.
      mh=${MOAI_HOME:-$HOME/.moai}
@@ -155,11 +141,7 @@ not something this loop can do for itself.
    input schema, so treat a shorter-than-requested expiry there as expected
    rather than as a fault.
 
-<<<<<<< HEAD:plugins/moai/skills/moai-factory-foreman/SKILL.md
    The watch resolves the queue directory the way `factory.StateDirForRoot`
-=======
-   The watch resolves the queue directory the way `kanban.StateDirForRoot`
->>>>>>> main:.claude/skills/moai-kanban-foreman/SKILL.md
    does for a standard git-repository project — a project-keyed directory
    under the moai home (`MOAI_HOME` when that is set to an absolute path,
    otherwise `~/.moai`), keyed by the primary checkout's root — so a linked
```

**File**: `plugins/moai/skills/moai-workflow-worktree/modules/moai-adk-integration.md` (modified, +1/-2)
```diff
@@ -189,10 +189,9 @@ workflow.worktree section (real keys + real defaults):
 - `auto_create` (bool, default: **false**) — automatically create worktrees. Opt-in; the default flow runs phases on a feature branch in the main checkout.
 - `auto_merge` (bool, default: **false**) — automatically merge worktree branches. Opt-in; off by default.
 - `session_name_pattern` (string, default: `moai-{ProjectName}-{SPEC-ID}`) — naming pattern for sessions spawned inside a worktree.
-- `tmux_preferred` (bool, default: **true**) — prefer tmux for worktree session display.
 
 Notes:
-- The previously-documented fields `auto_sync`, `cleanup_merged`, `worktree_root`, `default_base`, `sync_strategy`, and `registry_type` are NOT fields on the Go struct and MUST NOT be presented as live config keys. (The legacy content that listed them with `true` defaults inverted the real defaults and is corrected here.)
+- The previously-documented fields `auto_sync`, `cleanup_merged`, `worktree_root`, `default_base`, `sync_strategy`, `registry_type`, and `tmux_preferred` are NOT fields on the Go struct and MUST NOT be presented as live config keys. (The legacy content that listed them with `true` defaults inverted the real defaults and is corrected here. `tmux_preferred` is retired — prefer tmux explicitly with `moai cc -w <name> --spawn`.)
 - Worktree automation defaults to OFF in both the distributed template and the local dev config. Changing a default requires a dedicated SPEC.
 
 ---
```

---

### Incident Patch 8: `bb9fff1f` (2026-10-05)
**Commit Message**: fix(guards): PR #1748 red repair - transition M2 (card t1526)

Three defect groups at develop bf9ef4a1c, reproduced identically on both
PR heads:

1. TestVersionStampRegistry - the cutover preservation commits
   (82677fd27, 24cd42160) tracked seven new files that carry the
   authoritative version token without being stamp sites: preserved
   runtime state (.moai/lessons-inbox.jsonl, .moai/archive/) and
   repo-root evidence reports (reports/). The tag hypothesis was
   refuted - the failure shape is registry-vs-population, not tag
   parsing. The exclusion groups gain .moai/archive/,
   .moai/lessons-inbox.jsonl and reports/ (the same class the existing
   .moai/reports/ and .moai/specs/ groups cover).

2. rosterguard numeral breadth-set/axis - the same preservation commits
   put eleven paths in front of the numeral scan that quote roster
   counts as captured: three preserved codex agent tomls, five
   preserved policy copies, three audit-report files. All eleven are
   exempted as historical citations; the rows note that removing the
   preservation copies removes the rows with them.

3. TestRunExternalDelegationDoctrine pairdelta+pointers - the pre-cutover
   main absorb repl

**File**: `.claude/skills/moai/workflows/fix.md` (modified, +2/-2)
```diff
@@ -43,7 +43,7 @@ Flow: Parallel Scan -> Classify -> Fix -> Verify -> Report
 
 ## Pipeline Contract (Agentless Classification)
 
-<!-- @MX:NOTE - Agentless fixed-pipeline classification; localize→repair→validate contract. See spec-workflow.md#subcommand-classification-pipeline-vs-multi-agent. -->
+<!-- @MX:NOTE - Agentless fixed-pipeline classification; localize→repair→validate contract. See spec-workflow.md#subcommand-classification. -->
 
 This subcommand is classified as **Agentless fixed-pipeline**.
 It executes a deterministic 3-phase contract: **localize → repair → validate**.
@@ -55,7 +55,7 @@ It executes a deterministic 3-phase contract: **localize → repair → validate
 - **`--mode` flag handling**: Any `--mode` flag passed to this subcommand is ignored. The system logs `MODE_FLAG_IGNORED_FOR_UTILITY` at info level and proceeds with the fixed pipeline.
 - **Repeatability**: Even when the parent invocation supplies `--mode loop`, the pipeline runs once per command invocation. Re-entry requires explicit user re-invocation.
 
-See [Subcommand Classification matrix](../../../rules/moai/workflow/spec-workflow.md#subcommand-classification-pipeline-vs-multi-agent) for the full pipeline-vs-multi-agent contract.
+See [Subcommand Classification matrix](../../rules/moai/workflow/spec-workflow.md#subcommand-classification) for the full pipeline-vs-multi-agent contract.
 
 ## Loop Taxonomy Position — goal engine + presets
 
```

**File**: `.claude/skills/moai/workflows/loop.md` (modified, +1/-1)
```diff
@@ -45,7 +45,7 @@ This skill is invocable via two equivalent routes:
 Both routes invoke this skill body unchanged. Behavioral equivalence is enforced by a CI audit
 that verifies this skill documents the `/moai run --mode loop` cross-reference.
 
-See [Subcommand Classification matrix](../../../rules/moai/workflow/spec-workflow.md#subcommand-classification-pipeline-vs-multi-agent) for the full pipeline-vs-multi-agent + mode-axis contract.
+See [Subcommand Classification matrix](../../rules/moai/workflow/spec-workflow.md#subcommand-classification) for the full pipeline-vs-multi-agent + mode-axis contract.
 
 ## Relationship to the Pipeline-Level Agentic Completion Loop
 
```

**File**: `internal/cli/version_stamp_registry_test.go` (modified, +3/-0)
```diff
@@ -658,9 +658,12 @@ var versionStampExclusionGroups = []string{
 	".moai/reports/",
 	".moai/specs/",
 	".moai/release-notes/",
+	".moai/archive/",
+	".moai/lessons-inbox.jsonl",
 	"CHANGELOG.md",
 	"*_test.go",
 	"docs-site/content/*/changelog*",
+	"reports/",
 }
 
 // versionStampExclusionGlobRes holds the compiled forms of the groups that
```

**File**: `internal/harness/rosterguard/registry.go` (modified, +20/-0)
```diff
@@ -726,5 +726,25 @@ func NumeralExemptions() []NumeralExempt {
 		{ID: "rosterguard-numeral-test-self", Path: "internal/harness/rosterguard/numeral_test.go", Reason: "SELF-DESCRIPTION: the layer's fixtures ARE roster count claims, synthetic and live-quoted."},
 		{ID: "rosterguard-registry-self", Path: "internal/harness/rosterguard/registry.go", Reason: "SELF-DESCRIPTION: the registry's own comments quote the claims its rows assert."},
 		{ID: "rosterguard-test-self", Path: "internal/harness/rosterguard/rosterguard_test.go", Reason: "SELF-DESCRIPTION: the control probe's deliberately-wrong input includes roster count claims."},
+		//
+		// ── Cutover preservation snapshots (PR #1748 transition M2) ────────
+		// The github-flow cutover preserved deployed assets and audit reports
+		// into the tracked tree (commits 82677fd27, 24cd42160). They quote the
+		// roster counts as the deployed copies stood at capture — historical
+		// citations of the live surfaces, which remain exempted on their own
+		// rows. If the preservation copies are later removed, these rows must
+		// go with them: an exemption for a path the layer no longer reaches
+		// fails the breadth-set test by design.
+		{ID: "cutover-preserved-codex-agent-manager-design", Path: ".codex/agents/moai/manager-design.toml", Reason: "HISTORICAL CITATION: cutover-preserved emitted codex agent definition, quoting roster counts as deployed."},
+		{ID: "cutover-preserved-codex-agent-manager-docs", Path: ".codex/agents/moai/manager-docs.toml", Reason: "HISTORICAL CITATION: cutover-preserved emitted codex agent definition, quoting roster counts as deployed."},
+		{ID: "cutover-preserved-codex-agent-manager-spec", Path: ".codex/agents/moai/manager-spec.toml", Reason: "HISTORICAL CITATION: cutover-preserved emitted codex agent definition, quoting roster counts as deployed."},
+		{ID: "cutover-preserved-policy-agent-authoring", Path: ".moai/policies/development/agent-authoring.md", Reason: "HISTORICAL CITATION: cutover-preserved policy copy, quoting agent counts as deployed."},
+		{ID: "cutover-preserved-policy-agent-patterns", Path: ".moai/policies/development/agent-patterns.md", Reason: "HISTORICAL CITATION: cutover-preserved policy copy, quoting agent counts as deployed."},
+		{ID: "cutover-preserved-policy-spec-frontmatter", Path: ".moai/policies/development/spec-frontmatter-schema.md", Reason: "HISTORICAL CITATION: cutover-preserved policy copy, quoting counts as deployed."},
+		{ID: "cutover-preserved-policy-notice", Path: ".moai/policies/NOTICE.md", Reason: "HISTORICAL CITATION: cutover-preserved policy copy, quoting counts as deployed."},
+		{ID: "cutover-preserved-policy-spec-workflow", Path: ".moai/policies/workflow/spec-workflow.md", Reason: "HISTORICAL CITATION: cutover-preserved policy copy, quoting counts as deployed."},
+		{ID: "cutover-preserved-audit-agent-inventory", Path: "reports/workflow-performance-audit-20260911/agent-inventory.json", Reason: "HISTORICAL CITATION: a 2026-09-11 audit capture — an inventory of agent files as they stood at capture."},
+		{ID: "cutover-preserved-audit-report", Path: "reports/workflow-performance-audit-20260911/report.md", Reason: "HISTORICAL CITATION: a 2026-09-11 audit report, quoting the counts it measured."},
+		{ID: "cutover-preserved-audit-rules-inventory", Path: "reports/workflow-performance-audit-20260911/rules-inventory.json", Reason: "HISTORICAL CITATION: a 2026-09-11 audit capture — an inventory of rule files as they stood at capture."},
 	}
 }
```

---

### Incident Patch 9: `bf9ef4a1` (2026-10-05)
**Commit Message**: fix(template): neutralize card-id mention absorbed from #1740 (transition M2)

Template Neutrality Audit + lsel-leak-guard failed on the cutover merge: 4755c5e50 (#1740) carried 'retired at t1287' into the worktree-integration module template. Reworded without the card id; both leak test families verified green locally (go test ./internal/template/ -run 'Leak|Namespace|Neutrality').

Card: transition-M2 · run tmf011

🗿 MoAI

**File**: `internal/template/templates/.claude/skills/moai-workflow-worktree/modules/moai-adk-integration.md` (modified, +1/-1)
```diff
@@ -191,7 +191,7 @@ workflow.worktree section (real keys + real defaults):
 - `session_name_pattern` (string, default: `moai-{ProjectName}-{SPEC-ID}`) — naming pattern for sessions spawned inside a worktree.
 
 Notes:
-- The previously-documented fields `auto_sync`, `cleanup_merged`, `worktree_root`, `default_base`, `sync_strategy`, `registry_type`, and `tmux_preferred` are NOT fields on the Go struct and MUST NOT be presented as live config keys. (The legacy content that listed them with `true` defaults inverted the real defaults and is corrected here. `tmux_preferred` was retired at t1287 — prefer tmux explicitly with `moai cc -w <name> --spawn`.)
+- The previously-documented fields `auto_sync`, `cleanup_merged`, `worktree_root`, `default_base`, `sync_strategy`, `registry_type`, and `tmux_preferred` are NOT fields on the Go struct and MUST NOT be presented as live config keys. (The legacy content that listed them with `true` defaults inverted the real defaults and is corrected here. `tmux_preferred` is retired — prefer tmux explicitly with `moai cc -w <name> --spawn`.)
 - Worktree automation defaults to OFF in both the distributed template and the local dev config. Changing a default requires a dedicated SPEC.
 
 ---
```

---

### Incident Patch 10: `cfcc77a4` (2026-10-05)
**Commit Message**: merge(origin/main): absorb 4755c5e50 (#1740 tmux_preferred retire) before cutover push (transition M2)

Card: transition-M2 · run tmf011

🗿 MoAI

**File**: `CHANGELOG.md` (modified, +4/-0)
```diff
@@ -586,6 +586,10 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
   - **Docs carry the split in all four locales, guarded** (AC-021): the README.md/README.ko.md/README.ja.md/README.zh.md deploy-mode paragraphs and the docs-site `cli-reference/init.md` pages (en/ko/ja/zh — section-count parity 5 h2 / 4 h3 in each) name the thin default, both full-local flags, the record key, and the safe-side recording; `TestInitDocsDescribeThinDeploy` pins the init `--help`/success-card tokens so the CLI text cannot silently drift from the behavior.
   - Verification (run-phase record: `progress.md` §E.2, card worktree `WT-moai-init-slim`): **21 acceptance criteria (AC-001..021), 21 PASS / 0 FAIL**, each criterion's selector command and deciding output tabled per milestone; the card-review repairs F1–F6 are tabled RED→GREEN (symlink-guarded archive, migration mirror re-home, mode-scoped heal and preview, non-vacuous protected-set hash, accurate re-entry guidance); `golangci-lint run` on `internal/cli`, `internal/template`, `internal/config` = `0 issues.` against the pre-card baseline; `GOOS=windows GOARCH=amd64 go build ./...` exit 0; the two pre-existing guarded-surface failures the flip touched (`TestUpdateLLMYAMLFirstDeployCalm`, `TestUpdateMirrorHeal_RestoresPathA`) are fixed in this change set with the full-package failure disposition tabled in §E.2. Sync-phase additions this commit: `@MX:ANCHOR` on `config.ReadDeployMode` and `template.ApplyDeployMode` (both fan_in=4), zero stale `@MX:TODO` found; owning-test existence re-verified for all 21 ACs, including AC-021's guard. This sync commit carries the 3-phase close (`spec.md` frontmatter `in-progress → completed`, `status` + `updated` only), the `progress.md` §E.4 signal, and this entry; `sync_commit_sha` is written as the `pending-backfill-sync` placeholder in this commit — a commit cannot cite its own hash — and the resolved value is backfilled in a following commit.
 
+### Removed
+
+- **`workflow.worktree.tmux_preferred` config key and its settings-web toggle** (card t1287) — the key had no production reader since the worktree-surface redesign (PR #1278 deleted the `parseTmuxPreferred` reader), so the shipped default `true` and the console toggle described behavior nothing executed. Removed the field, default, template key, settings schema entry, console i18n strings, and the stale skill-doc line, which now documents the explicit replacement: `moai cc -w <name> --spawn` opens the session in a new tmux window. Existing projects that still carry `tmux_preferred: true` in their `workflow.yaml` are unaffected — the config loader warns on unknown keys only in strict mode (`MOAI_CONFIG_STRICT=1`); drop the line at your next config touch. The `shipped_key_inventory` ledger entry (class D, deprecate_after v3.1.0) is fulfilled by this removal. 🗿 MoAI
+
 ### Changed
 
 - **[SPEC-GIT-DELIVERY-PROCEDURE-001](.moai/specs/SPEC-GIT-DELIVERY-PROCEDURE-001/spec.md)** — sync phase (3-phase plan→run→sync, card t622, Tier M). **`/moai sync` no longer merges a PR unless asked: `--auto-merge` is now the single, explicit merge opt-in.** Previously the sync workflow instructions said worktree contexts default to auto-merge, and `--no-merge` was the way to prevent it; the only criterion now is the `--auto-merge` opt-in defined in `manager-git.md` § PR Auto-Merge, and worktree context alone never triggers a merge. `--merge` remains as a deprecated alias of `--auto-merge` (logs a warning), and `--no-merge` is a deprecated no-op kept for compatibility, since not merging is already the default. Mode conditions are stated identically in `manager-git.md` and `delivery.md`: in team mode `--auto-merge` merges only after all approvals are obtained; in personal and manual modes it merges without an approval condition. The merge command no longer hard-codes `--squash` — `gh pr merge --<merge_method> --delete-branch` resolves `<merge_method>` from `git_strategy.<mode>.merge_method` (`squash` | `merge` | `rebase`; default `squash`). manager-git's pre-flight sync check now runs `git fetch` to completion before `git rev-list --count --left-right`, instead of issuing both in one parallel batch where the divergence count could read the pre-fetch remote-tracking ref. The `/moai sync` `argument-hint`, usage lines, and flag lists expose `--auto-merge`. Changed instruction files (local and template copies): `.claude/agents/moai/manager-git.md`, `.claude/commands/moai/sync.md` (template `sync.md.tmpl`), `.claude/skills/moai/SKILL.md`, `.claude/skills/moai/references/reference.md`, `.claude/skills/moai/workflows/sync.md`, `.claude/skills/moai/workflows/sync/delivery.md`, `.claude/skills/moai/workflows/sync/doc-execution.md`, `.claude/skills/moai/workflows/sync/quality-gates-context.md`, plus the regenerated `internal/template/templates/.codex/agents/moai/manager-git.toml`. Instruction text only — no Go code changed. 16 judged acceptance criteria, all PASS in the run phase (`
```

**File**: `internal/config/defaults.go` (modified, +0/-1)
```diff
@@ -1304,7 +1304,6 @@ func NewDefaultWorkflowConfig() WorkflowConfig {
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
@@ -503,7 +503,6 @@ func TestNewDefaultWorkflowConfigNestedDefaults(t *testing.T) {
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
@@ -2491,7 +2491,3 @@
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
@@ -714,7 +714,6 @@ type WorkflowWorktreeConfig struct {
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

### Incident Patch 11: `1840d63c` (2026-10-05)
**Commit Message**: fix(cli): repair the three CI defects t1500's batch carried in unverified (card t1520, debt of t1500)

develop CI at ca29eaf16 flagged three defects that rode the 18-commit
batch in without a full CI pass (consecutive pushes cancelled the batch
run), all surfaced by the t1520 merge:

1. gofmt: internal/runtime/audit_ceiling_test.go carried a misaligned
   comment run - gofmt -w applied.
2. Windows build: audit_gates_failclosed_test.go used installFakeCodex
   and runAudit, which live behind the !windows tag in
   codex_audit_launch_test.go (the fake codex is a POSIX shell script).
   The prepareCodexAudit arm of the propagation ledger moves to
   audit_gates_failclosed_codex_test.go under the same !windows tag;
   the five platform-neutral arms keep full Windows coverage.
3. Golden drift: the R4 fail-closed change (an unreadable or unknown
   gate posture is a distinct error, not an absent one) changed two
   codex_audit results - corrupt-yaml now returns verdict fail with
   gate_unmet naming the parse error, and required-uppercase now fails
   closed on the unknown "REQUIRED" value instead of reading
   inconclusive. Both goldens regenerated
   (UPDATE_CODEX_AUDIT_GOLDEN=1); the 

**File**: `internal/cli/audit_gates_failclosed_codex_test.go` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+//go:build !windows
+
+// Package cli — the codex-launcher arm of the audit-gates fail-closed ledger
+// (SPEC-AUDIT-CEILING-002 M3, AC-ACR-011's R4), split out of
+// audit_gates_failclosed_test.go so the Windows build keeps the
+// platform-neutral arms: the fake codex is a POSIX shell script (see
+// codex_audit_launch_test.go), so this arm cannot build or run on windows.
+package cli
+
+import (
+	"strings"
+	"testing"
+)
+
+// TestGateErrorPropagatesToCallerSitesCodexPrepare — the plan file 18 ledger's
+// prepareCodexAudit site (the sibling test carries the other five): a launch
+// whose audit configuration cannot be read must refuse with the pins error
+// surfaced.
+func TestGateErrorPropagatesToCallerSitesCodexPrepare(t *testing.T) {
+	repo := newAuditRepo(t)
+	installFakeCodex(t)
+	breakTreeWorkflow(t, repo.a1)
+
+	r := runAudit(t, codexAuditRequest{Role: "plan-auditor", ProjectRoot: repo.a, Root: repo.a1})
+	if r.res.ExitCode == 0 {
+		t.Fatal("a launch whose audit configuration cannot be read must refuse")
+	}
+	if !strings.Contains(r.stderr, "workflow.audit pins unreadable") || !strings.Contains(r.stderr, "workflow.yaml") {
+		t.Errorf("stderr = %q, want the pins error surfaced", r.stderr)
+	}
+}
```

**File**: `internal/cli/audit_gates_failclosed_test.go` (modified, +4/-15)
```diff
@@ -145,7 +145,10 @@ func TestWorktreeRootSurfacesGateError(t *testing.T) {
 
 // TestGateErrorPropagatesToCallerSites — AC-ACR-011's R4 arm: the propagation
 // claim is verified PER SITE, one subtest per inventoried caller of plan file
-// 18 (LEDGER-ACR-N's six sites outside the two repaired surfaces).
+// 18 (LEDGER-ACR-N's sites outside the two repaired surfaces). The
+// prepareCodexAudit site lives in audit_gates_failclosed_codex_test.go — the
+// fake codex is POSIX-only, and keeping it here would break the Windows build
+// (CI red at ca29eaf16).
 func TestGateErrorPropagatesToCallerSites(t *testing.T) {
 	t.Run("mcp_claude.go resolveClaudeAuditModelEffort", func(t *testing.T) {
 		_, err := resolveClaudeAuditModelEffort(writeTreeWorkflow(t, unparseableWorkflow), "", "")
@@ -154,20 +157,6 @@ func TestGateErrorPropagatesToCallerSites(t *testing.T) {
 		}
 	})
 
-	t.Run("codex_audit_launch.go prepareCodexAudit", func(t *testing.T) {
-		repo := newAuditRepo(t)
-		installFakeCodex(t)
-		breakTreeWorkflow(t, repo.a1)
-
-		r := runAudit(t, codexAuditRequest{Role: "plan-auditor", ProjectRoot: repo.a, Root: repo.a1})
-		if r.res.ExitCode == 0 {
-			t.Fatal("a launch whose audit configuration cannot be read must refuse")
-		}
-		if !strings.Contains(r.stderr, "workflow.audit pins unreadable") || !strings.Contains(r.stderr, "workflow.yaml") {
-			t.Errorf("stderr = %q, want the pins error surfaced", r.stderr)
-		}
-	})
-
 	t.Run("mcp_glm.go resolveGLMAuditModelEffort", func(t *testing.T) {
 		_, err := resolveGLMAuditModelEffort(writeTreeWorkflow(t, unparseableWorkflow))
 		if err == nil || !strings.Contains(err.Error(), "workflow.yaml") {
```

**File**: `internal/cli/codex_audit_nonrequired_golden_test.go` (modified, +5/-1)
```diff
@@ -80,7 +80,11 @@ func TestCodexAudit_NonRequiredGateGoldenByteIdentical(t *testing.T) {
 		// A `required` padded with whitespace is no longer a non-required state:
 		// the audit plan resolver trims gate values (SPEC-AUDIT-MODEL-CONVERGE-001
 		// EC-1), so it reads as required on every surface —
-		// TestCodexAudit_PaddedRequiredGateFailsClosed pins that reading.
+		// TestCodexAudit_PaddedRequiredGateFailsClosed pins that reading. The
+		// UPPERCASE spelling is a different arm: it is not a valid gate value,
+		// and the R4 fail-closed change (card t1500) surfaces it as a distinct
+		// gate error (verdict fail + gate_unmet), not as a non-required state —
+		// this case now pins that unknown-value refusal.
 		{"required-uppercase", func(t *testing.T, root string) { writeCodexAuditGate(t, root, "REQUIRED") }},
 	}
 	for _, tc := range cases {
```

**File**: `internal/cli/testdata/codex-audit-nonrequired/corrupt-yaml.golden` (modified, +6/-4)
```diff
@@ -4,20 +4,22 @@
     "build_commit": "\u003cbuild_commit\u003e",
     "build_lag": "\u003cbuild_lag\u003e",
     "findings": [],
+    "gate_unmet": "workflow.audit gates unreadable: parse workflow.yaml: yaml: line 1: did not find expected ',' or ']'",
     "next_steps": [
       "fall back to the active auditor (claude)"
     ],
-    "summary": "codex unavailable: codex binary not found in PATH",
-    "verdict": "inconclusive"
+    "summary": "workflow.audit gates unreadable: parse workflow.yaml: yaml: line 1: did not find expected ',' or ']': codex unavailable: codex binary not found in PATH",
+    "verdict": "fail"
   },
   "text": {
     "build_commit": "\u003cbuild_commit\u003e",
     "build_lag": "\u003cbuild_lag\u003e",
     "findings": [],
+    "gate_unmet": "workflow.audit gates unreadable: parse workflow.yaml: yaml: line 1: did not find expected ',' or ']'",
     "next_steps": [
       "fall back to the active auditor (claude)"
     ],
-    "summary": "codex unavailable: codex binary not found in PATH",
-    "verdict": "inconclusive"
+    "summary": "workflow.audit gates unreadable: parse workflow.yaml: yaml: line 1: did not find expected ',' or ']': codex unavailable: codex binary not found in PATH",
+    "verdict": "fail"
   }
 }
```

**File**: `internal/cli/testdata/codex-audit-nonrequired/required-uppercase.golden` (modified, +6/-4)
```diff
@@ -4,20 +4,22 @@
     "build_commit": "\u003cbuild_commit\u003e",
     "build_lag": "\u003cbuild_lag\u003e",
     "findings": [],
+    "gate_unmet": "workflow.audit gates unreadable: audit.gates.codex \"REQUIRED\" unknown (want one of off|advisory|required)",
     "next_steps": [
       "fall back to the active auditor (claude)"
     ],
-    "summary": "codex unavailable: codex binary not found in PATH",
-    "verdict": "inconclusive"
+    "summary": "workflow.audit gates unreadable: audit.gates.codex \"REQUIRED\" unknown (want one of off|advisory|required): codex unavailable: codex binary not found in PATH",
+    "verdict": "fail"
   },
   "text": {
     "build_commit": "\u003cbuild_commit\u003e",
     "build_lag": "\u003cbuild_lag\u003e",
     "findings": [],
+    "gate_unmet": "workflow.audit gates unreadable: audit.gates.codex \"REQUIRED\" unknown (want one of off|advisory|required)",
     "next_steps": [
       "fall back to the active auditor (claude)"
     ],
-    "summary": "codex unavailable: codex binary not found in PATH",
-    "verdict": "inconclusive"
+    "summary": "workflow.audit gates unreadable: audit.gates.codex \"REQUIRED\" unknown (want one of off|advisory|required): codex unavailable: codex binary not found in PATH",
+    "verdict": "fail"
   }
 }
```

**File**: `internal/runtime/audit_ceiling_test.go` (modified, +1/-1)
```diff
@@ -181,7 +181,7 @@ func TestResolvePlanAuditCeiling(t *testing.T) {
 		{"S", 1},
 		{"M", 2},
 		{"L", 3},
-		{"", 3},     // absent tier → L
+		{"", 3},      // absent tier → L
 		{"bogus", 3}, // unknown tier → L
 	}
 	for _, c := range cases {
```

---

### Incident Patch 12: `c5442552` (2026-10-05)
**Commit Message**: fix(factory): carry the card worktree binding across run replacement

A replaced factory run reborn its cards with an empty worktree_path,
so `factory next` refused a card's own surviving tree as a foreign
tree (REQ-SD-011 firing on the card's own tree; observed 10-05 on
t1453). At the lease boundary, a landing directory that a previous
run's record of the SAME card names, and that still exists on disk,
is re-recorded on the new run's row instead of refused; the nominated
lease's read-only precheck skips the foreign-worktree token for the
same shape. Every other shape keeps the refusal unchanged.

- homestate.PreviousCardWorktree: the cross-run binding read
- cli factoryCarryPreviousWorktree + wiring in factoryNextClaim and
  factoryNextValidate
- one constant SQL statement; card and run ids ride placeholders

card t1521

🗿 MoAI

**File**: `internal/cli/factory_card.go` (modified, +66/-7)
```diff
@@ -424,20 +424,56 @@ func factoryClaimFailure(claimCtx context.Context, err error) error {
 	return err
 }
 
+// factoryCardWorktreeDir is the card's landing directory under the shared
+// materializer root — the leaf the REQ-SD-011 refusal and the carry-over both
+// read.
+func factoryCardWorktreeDir(root, cardID string) string {
+	return filepath.Join(root, sessionWorktreeSubdir, cardID)
+}
+
 // factoryRefuseForeignWorktree is the REQ-SD-011 refusal: the card's landing
 // directory already exists and no card record names it (the card itself
 // records no worktree), so `next` refuses before any claim edge and the card
 // row stays unchanged. The leaf name belongs to the card id, so an existing
 // directory there can only be a foreign tree — never one the materializer
-// created for this card.
+// created for this card. The carry-over (factoryCarryPreviousWorktree) runs
+// before this refusal at the lease boundary: a directory a previous run of
+// the SAME card recorded is that card's own tree, re-recorded rather than
+// refused (card t1521); every other shape lands here.
 func factoryRefuseForeignWorktree(root, cardID string) error {
-	dir := filepath.Join(root, sessionWorktreeSubdir, cardID)
+	dir := factoryCardWorktreeDir(root, cardID)
 	if info, err := os.Lstat(dir); err != nil || !info.IsDir() {
 		return nil
 	}
 	return fmt.Errorf("factory next: refused — the worktree directory %s already exists and no card record names it; a card never adopts another card's tree (remove or rename the directory first)", dir)
 }
 
+// factoryCarryPreviousWorktree resolves the binding a run replacement may
+// carry into runID for cardID (card t1521): the card's landing directory
+// exists, a previous run's record of the SAME card names that same directory,
+// and the tree it names still exists on disk. Only that exact shape carries —
+// the new run re-records what its predecessor already bound instead of
+// refusing the card's own surviving tree as foreign. It returns "" when the
+// carry does not apply, leaving the REQ-SD-011 refusal (and the fresh-tree
+// materialization when no directory stands in the way) to the caller.
+func factoryCarryPreviousWorktree(ctx context.Context, db *homestate.FactoryDB, root, runID, cardID string) (string, error) {
+	dir := factoryCardWorktreeDir(root, cardID)
+	if info, err := os.Lstat(dir); err != nil || !info.IsDir() {
+		return "", nil
+	}
+	prev, ok, err := db.PreviousCardWorktree(ctx, cardID, runID)
+	if err != nil || !ok {
+		return "", err
+	}
+	if info, err := os.Stat(prev); err != nil || !info.IsDir() {
+		return "", nil
+	}
+	if !sameDirPath(prev, dir) {
+		return "", nil
+	}
+	return prev, nil
+}
+
 // factoryWorktreeSlug derives the card worktree's WT- branch slug from the
 // card's queue title (the Factory Dispatch Protocol branch-naming rule): lowercase
 // [a-z0-9-], at most three tokens, at most 24 characters, and never
@@ -765,13 +801,26 @@ func factoryNextRecordAndClaim(ctx context.Context, db *homestate.FactoryDB, roo
 // lane through the version-checked F1 edges (T2 then T3), with the lane's
 // label as the lease holder. The REQ-SD-011 worktree refusal fires before
 // the edges: a card with no recorded worktree whose landing directory is
-// already taken by a foreign tree is refused, and no row changes.
+// already taken by a foreign tree is refused, and no row changes. Before the
+// refusal, the run-replacement carry-over re-records a landing directory a
+// previous run of the SAME card bound (card t1521) — the card's own tree, so
+// the lease proceeds onto it instead of refusing it.
 func factoryNextClaim(ctx context.Context, db *homestate.FactoryDB, root, runID string, cur homestate.Card, lane string) (homestate.Card, bool, bool, error) {
 	ctx, cancel := factoryClaimContext(ctx)
 	defer cancel()
 	c := cur
 	if strings.TrimSpace(c.WorktreePath) == "" {
-		if err := factoryRefuseForeignWorktree(root, c.CardID); err != nil {
+		carried, err := factoryCarryPreviousWorktree(ctx, db, root, runID, c.CardID)
+		if err != nil {
+			return factoryNextClaimRefused(factoryClaimFailure(ctx, err))
+		}
+		if carried != "" {
+			next, rerr := db.RecordCardWorktree(ctx, runID, c.CardID, carried, "factory-next", factoryCardNow())
+			if rerr != nil {
+				return factoryNextClaimRefused(factoryClaimFailure(ctx, rerr))
+			}
+			c = next
+		} else if err := factoryRefuseForeignWorktree(root, c.CardID); err != nil {
 			return homestate.Card{}, false, false, err
 		}
 	}
@@ -987,10 +1036,20 @@ func factoryNextValidate(ctx context.Context, l *factory.LockedBacklog, db *home
 		return nom, r, nil
 	}
 	// The claim would refuse a foreign tree only after the promotion; deciding
-	// it here keeps the refusal write-free.
+	// it here keeps the refusal write-free. The carry-over read runs first: a
+	// landing directory the card's own previous run recorded is that card's
+	// tree, and the claim at step 3 re-records the binding instead of
+	// refusing (card t
```

**File**: `internal/homestate/card_worktree.go` (modified, +29/-0)
```diff
@@ -3,6 +3,7 @@ package homestate
 import (
 	"context"
 	"database/sql"
+	"errors"
 	"fmt"
 	"path/filepath"
 	"strings"
@@ -59,3 +60,31 @@ func (f *FactoryDB) RecordCardWorktree(ctx context.Context, runID, cardID, path,
 	}
 	return result, nil
 }
+
+// PreviousCardWorktree reads the newest worktree binding recorded for cardID
+// in a run other than excludeRunID — the binding a run replacement may carry
+// into the new run's row (card t1521). Card rows are keyed per run, so a
+// replacement run's row is born without the binding its predecessor held;
+// this read is what names that binding again. ok is false when no other run
+// recorded a binding for the card. It never writes.
+//
+// @MX:NOTE: [AUTO] the cross-run binding read the lease-boundary carry-over is built on (card t1521)
+// @MX:REASON: an ordering or exclusion change here changes which tree a replaced run re-enters — the one fact the REQ-SD-011 refusal is calibrated against
+func (f *FactoryDB) PreviousCardWorktree(ctx context.Context, cardID, excludeRunID string) (string, bool, error) {
+	// SQL: one constant statement; cardID and excludeRunID ride ? placeholders,
+	// never the statement text.
+	const query = `SELECT c.worktree_path
+FROM cards c LEFT JOIN runs r ON r.run_id = c.run_id
+WHERE c.card_id = ? AND c.run_id != ? AND c.worktree_path != ''
+ORDER BY r.created_at DESC, c.updated_at DESC
+LIMIT 1`
+	var path string
+	err := f.DB.QueryRowContext(ctx, query, cardID, excludeRunID).Scan(&path)
+	if errors.Is(err, sql.ErrNoRows) {
+		return "", false, nil
+	}
+	if err != nil {
+		return "", false, err
+	}
+	return path, true, nil
+}
```

---

### Incident Patch 13: `3e0ec6f2` (2026-10-05)
**Commit Message**: docs(cutover): adopt GitHub Flow cutover rules and reporting-surface guidance (card t1522)

adopted from uncommitted primary work + card t1522

- land the develop->main reference rewrite across AGENTS.md, CLAUDE.md,
  and the .claude/rules/moai/** tree (prescriptive develop references
  replaced with branch-neutral or main wording; the worktree sweep's
  landing check now names origin/main)
- skill-routing.md section 1.1: hosted claude.ai artifacts are Claude
  Code-only; GLM/Codex backends deliver reports as self-contained
  single-file HTML (rule source and template mirror edited in the same
  commit)
- git-strategy.yaml: worktree_base_branch main, manual workflow
  github-flow, develop_branch "" (post-cutover integration branch)

🗿 MoAI

**File**: `.claude/loop.md` (modified, +1/-0)
```diff
@@ -3,6 +3,7 @@
 You are this project's kanban foreman, running unattended. This prompt is one
 iteration of the watch-dispatch-collect cycle over the backlog queue; a bare
 `/loop` in this project runs it at a self-paced interval.
+`foreman` — an auxiliary role of the leader: the unattended watcher that dispatches the already-picked card to an isolated worker when no leader session holds the board.
 
 Begin the iteration by invoking Skill("moai-kanban-foreman") and following it
 for the whole turn. That skill removes AskUserQuestion from your tool pool
```

**File**: `.claude/rules/moai/core/agent-common-protocol-reference.md` (modified, +159/-17)
```diff
@@ -1,10 +1,12 @@
 ---
 description: "Verbatim verification-batch example, output-representation contracts, and CLI idiom catalogue for the agent common protocol"
-paths: "**/agent-common-protocol.md"
+paths: "**/agent-common-protocol.md,**/.claude/agents/moai/*.md,**/.claude/skills/moai/workflows/*.md"
 ---
 
 # Agent Common Protocol — Reference Detail
 
+<!-- mirror-fork: intentional — this copy is deliberately divergent from the local dogfood copy; do not sync mechanically -->
+
 > Detail companion to `agent-common-protocol.md` (the SSOT). That file carries the
 > binding obligations; this file carries the verbatim command batch, the worked
 > contracts, and the CLI idiom catalogue. Loaded only when
@@ -18,8 +20,8 @@ batch for a typical run-phase completion. The orchestrator SHOULD invoke all 7
 in parallel within a single response turn:
 
 ```bash
-# 1. Full test suite (Go)
-go test ./... > /tmp/moai-verify/1-go-test.log 2>&1; echo "exit=$?"; tail -50 /tmp/moai-verify/1-go-test.log
+# 1. Change-scoped tests (Go)
+go test ./internal/<pkg>/... > /tmp/moai-verify/1-go-test.log 2>&1; echo "exit=$?"; tail -50 /tmp/moai-verify/1-go-test.log
 
 # 2. Coverage report (per-package)
 go test -coverprofile=cover.out ./internal/<pkg>/... > /tmp/moai-verify/2-cover.log 2>&1; echo "exit=$?"; tail -50 /tmp/moai-verify/2-cover.log
@@ -53,11 +55,26 @@ This contract governs *how* verification output is represented in context, NOT *
 
 The contract is **"verbatim evidence lives on disk with a citable path; context carries exit code + bounded tail"** — NOT **"drop the evidence"**. Inline quotation is PERMITTED when verbatim output is below the ceiling (the redirect obligation triggers only on exceedance); the diet removes the *double-burn* (Bash inline output + banner re-quote), not the evidence itself. The exact ceiling value and directory scheme are tunable per-domain; the contract holds regardless of the specific numbers.
 
-### Evidence persistence obligation
+### Evidence export obligation
 
 The cited evidence path MUST remain reachable at audit time, including after `/tmp` directory clearance. `/tmp` is OS-cleared periodically (macOS reboot, Linux tmpfs re-mount, systemd-tmpfiles); a cited path that no longer resolves to a file violates `verification-claim-integrity.md` §1.1 surface 1 (orchestrator self-report) and surface 2 (manager-agent §E self-verification) — every claim row MUST remain attributable to a directly-observed command whose verbatim output is reachable at the cited file path.
 
-To satisfy this reachability obligation, evidence SHALL be persisted under `.moai/state/verify/<session>/` (gitignored runtime state, same directory family as `context-usage.json` and `active-sessions.json`). The exact persist mechanism — direct write to `.moai/state/verify/<session>/`, or `/tmp` write followed by a copy step — is a run-phase implementation detail; the contract states the OBLIGATION (evidence survives `/tmp` clearance), not the mechanism. **"Persist evidence" ≠ "drop evidence"**: the diet removes the *double-burn* (inline output + banner re-quote), NOT the evidence itself. The verbatim output MUST remain on disk at a citable, audit-time-reachable path.
+**Surviving `/tmp` is not the same as being reachable at audit time.** `.moai/state/verify/<session>/` is **machine-local scratch**: it outlives `/tmp` clearance, and it is gitignored, so it travels to no clone, no CI runner, and no other machine. A path under it resolves only on the machine that wrote it, and only until that machine's state is cleaned. Naming it as the audit-time citation target states an obligation its own storage cannot meet.
+
+The verdict file is the **local** record a claim cites — in this repository, `.moai/reports/<card-id>/verdict.md`, the same file `kanban-dispatch.md` already fixes as a card's verdict. It reaches no clone and no other machine, so citing it states where the deciding evidence was written, not where a reader elsewhere can fetch it. The obligation is therefore unchanged and its reason is narrower: **carry the deciding evidence into the verdict** — before a claim is made, the command that decided it and the lines of output that decided it are written into the verdict file, and the claim cites that file. Scratch is where a command's raw output lands; the verdict file is what a document is allowed to point at.
+
+**Export width — one file, and it is the verdict file.** A citation **names one file**, never the directory: `.moai/reports/<card-id>/verdict.md`, not `.moai/reports/<card-id>/`. The width is that one filename, and it is a property of the ignore rules rather than a style preference — writing a second artifact beside the verdict leaves an untracked file next to a tracked one, and a citation naming it resolves nowhere outside the tree that wrote it. Without this ceiling the obligation does not remove the scratch tree, it only relocates it into version control, which is the outcome it exists to prevent.
+
+**Selection
```

**File**: `.claude/rules/moai/core/agent-common-protocol.md` (modified, +43/-236)
```diff
@@ -6,7 +6,7 @@ description: Shared protocol auto-loaded for all MoAI agents — user-interactio
 
 Shared protocol for all MoAI agent definitions. This rule is automatically loaded for all agents, eliminating the need to duplicate these sections in each agent body.
 
-> **Detail companion**: `agent-common-protocol-reference.md` (paths-scoped to this file) — verbatim verification batch, output contracts, CLI idioms, Ledger Closure clause bodies, attributable diff-check detail, sync-check rationale + incident records. Read it when composing a verification batch or handling an aborted delegation.
+> **Detail companion**: `agent-common-protocol-reference.md` — verbatim verification batch, output contracts, CLI idioms, Ledger Closure clause bodies, sync-check rationale + incident records, and the bodies relocated from here: § Orchestrator Obligations · § Re-delegation Procedure · § Skeptical Evaluation Stance · § CLAUDE.md Reference · § File Operations Pattern · § Search Pattern · § Tool Selection by Task · § Bash Timeout · § Error Recovery Pattern · § Super-Advisor Escalation (E1-E4) · § Read-only verification batching · § Attributable diff-check doctrinal switch. Load it when composing a verification batch, selecting a tool, recovering from a failed call, escalating to super-advisor, or handling an aborted delegation.
 
 ## User Interaction Boundary
 
@@ -22,40 +22,17 @@ Rules for subagents:
 - All user preferences must arrive via the orchestrator's spawn prompt
 - If the orchestrator omitted critical data, respond with a structured "missing inputs" section and stop
 
-Rationale (1 line): subagents run in isolated, stateless contexts — prompting there is a dead channel; this preserves the orchestrator's single-point-of-contact with the user (CLAUDE.md §8).
+Rationale: subagents run in isolated, stateless contexts — prompting there is a dead channel, and the orchestrator stays the user's single point of contact (CLAUDE.md §8).
 
-### Orchestrator Obligations
-
-> Canonical: see `.claude/rules/moai/core/askuser-protocol.md` § Orchestrator Obligations for the full preload sequence (`ToolSearch(query: "select:AskUserQuestion")` before each call), the AskUserQuestion channel monopoly, the Socratic interview structure, and the option-description standards. This file owns only the subagent-side boundary (above) and the blocker-report → re-delegation flow (below).
-
-The MoAI orchestrator collects all user preferences before delegating to subagents via `Agent()`. On receiving a blocker report from a subagent, it runs an `AskUserQuestion` round, injects the user's responses into a fresh subagent prompt, and re-delegates (procedure below).
+**Lane sessions are orchestrator-class, not subagent-class.** A kanban companion or factory lane holds the question channel for its own card through the factory leader, carries standing spawn authority for the Status Transition Ownership Matrix's specialist (plan → `manager-spec`, run → `manager-develop`, sync → `manager-docs`, plus the chain's auditors; depth-1 only — spawned agents are leaves, bound by the prohibitions above), and never edits phase-owned artifacts directly when that specialist exists. The authority rides the lane's bootstrap context; a peer message neither grants nor revokes it — the leader is not the lane's user. Normative home: `.claude/rules/moai/workflow/kanban-dispatch.md` § Lane spawn authority.
 
 ### Hook Invocation Surface
 
-Three hook scripts mechanically enforce orchestrator-discipline obligations:
-`status-transition-ownership.sh` (PostToolUse on SPEC-artifact writes, advisory),
-`sync-phase-quality-gate.sh` (Stop hook on sync-phase commit, advisory unless
-`MOAI_SYNC_GATE_BLOCKING=1`), and `team-ac-verify.sh` (TaskCompleted in team mode, dormant). All
-three exit 0 always and signal through stdout JSON — exit-code semantics: stdout JSON is honored
-only on exit 0; on exit 2 it is discarded and only stderr is surfaced. Per-row triggers, JSON
-shapes, owning policy, and the subagent-boundary acceptance criterion:
-`agent-common-protocol-reference.md` § Hook Invocation Surface detail.
-
-#### Orchestrator translation responsibility
-
-Hooks return exit codes and structured JSON; they MUST NOT invoke `AskUserQuestion` directly. When a hook signals a block (stdout JSON `"decision":"block"` on exit 0, or a legacy exit-2), the orchestrator MUST:
-
-1. Parse the hook's structured JSON output (`decision`, `reason`, plus optional `ledger_note` / `systemMessage` / `details`)
-2. Preload `AskUserQuestion` via `ToolSearch(query: "select:AskUserQuestion")`
-3. Compose an `AskUserQuestion` round presenting the user with at least: (a) accept the block and address the failed gate, (b) override with `--skip-hook` opt-out (logged to `.moai/logs/hook-skip.log`), (c) abort the workflow
-
-#### Stop self-gate caveat
-
-The Stop hook fires on every turn-end, not only on task completion, so it must self-gate (inspect state, decide whether the turn is a genuine completion poin
```

**File**: `.claude/rules/moai/core/askuser-protocol-reference.md` (modified, +99/-1)
```diff
@@ -1,6 +1,6 @@
 ---
 description: "Detailed reference for AskUserQuestion recommendation-placement principles and the preview field"
-paths: "**/askuser-protocol.md"
+paths: "**/askuser-protocol.md,**/.claude/skills/moai/workflows/*.md,**/.claude/output-styles/moai/*.md"
 ---
 
 # AskUserQuestion Protocol — Reference Detail
@@ -200,3 +200,101 @@ The **Blind Spot Pass** is an OPTIONAL pre-plan Discovery technique for surfacin
 - **Subagent boundary (preserved)**: `Agent(Explore)` — and any subagent — **does not prompt the user** directly; findings surface only through the orchestrator's channel. A subagent that lacks input returns a blocker report; it never asks the user.
 
 ---
+
+## Relocated bodies — always-loaded stub sections
+
+> Relocated from `askuser-protocol.md` to keep the always-loaded file within its size budget. Every binding clause stays inline there; these are the non-binding bodies it points at.
+
+### General Rule for Deferred Tools
+
+Any deferred tool requires a `ToolSearch` select preload before invocation. The pattern generalizes: `ToolSearch(query: "select:<tool>[,<tool>...]")` — single (`select:AskUserQuestion`) or multiple (`select:AskUserQuestion,TaskCreate`).
+
+**Preload sequence** (per turn — if a new turn begins and `AskUserQuestion` will be called again, preload again; never reverse or omit Step 1):
+
+```
+[Turn N]
+Step 1: ToolSearch(query: "select:AskUserQuestion")   ← preload deferred schema
+Step 2: AskUserQuestion({ questions: [...] })           ← now valid to invoke
+```
+
+---
+
+### The Four Triggers (any one activates Stage 1)
+
+1. **Pronoun or demonstrative without clear referent**: "this", "that", "it", "the previous one" — the referent cannot be unambiguously determined from context
+2. **Multi-interpretable action verb without specified scope**: "clean up", "process", "improve", "fix" — the action could apply to multiple different implementations
+3. **Unclear boundaries**: How far to go, how much to change, which files are in scope, where to stop
+4. **Potential conflict with existing state**: Uncommitted changes, in-progress branches, overlapping work that the request might conflict with
+
+### The Five Exceptions (Stage 1 is skipped)
+
+1. Single-line typo or formatting fix — scope is self-evident
+2. Bug fix with explicit reproduction provided — the reproducer defines scope
+3. Direct file read when the path is explicitly specified — no interpretation needed
+4. Command invocation with all required arguments provided — no ambiguity
+5. Continuation of previously confirmed work in the same session — intent already established
+
+### The Unknowns 4-Quadrant Lens
+
+Classify the ambiguity by **user blind spot** (Known-Knowns / Known-Unknowns / Unknown-Knowns / Unknown-Unknowns):
+
+- **Known-Knowns** — stated + confirmed facts. No clarification needed
+- **Known-Unknowns** — gaps the user is aware of. Resolve via a Socratic interview round (§ Socratic Interview Structure)
+- **Unknown-Knowns** — constraints implicit in the codebase the user has not surfaced. Resolve via `Agent(Explore)` read-only reconnaissance, then confirm with the user
+- **Unknown-Unknowns** — risks neither side has articulated. When suspected (unfamiliar domain/subsystem/design territory), run a Blind Spot Pass (§ Blind Spot Pass) before plan-phase entry
+
+### First-Action Sequence After Trigger
+
+```
+Trigger detected
+  → Step 1: ToolSearch(query: "select:AskUserQuestion")   [deferred tool preload]
+  → Step 2: Compose AskUserQuestion round (≤4 Q, ≤4 options, (권장) first under recommendation_mode: push — withheld under pull, conversation_language)
+  → Step 3: Send AskUserQuestion, collect responses
+  → Step 4: Assess intent clarity (100% required)
+  → Step 5: If <100%: go to Step 1 with narrowed questions
+             If 100%: consolidate report → final confirmation → execute
+```
+
+---
+
+### Directive and Recovery
+
+- **Preventive (always):** write all `conversation_language` text as native UTF-8 in the tool-call JSON — this binds **every** tool call carrying multi-byte text, not only `AskUserQuestion` but Bash commands, Write / Edit content arguments, and any other tool-call payload. Never hand-escape a non-ASCII character.
+- **Recovery (on failure):** if a call is rejected with `Invalid tool parameters` and the payload contained non-ASCII text, re-issue the identical call with the text rewritten as native UTF-8 — do not try to "repair" the escape sequence. Do not carry the corrupted form forward; re-author the next non-ASCII payload from the intended source text, not by transcribing the `\uXXXX` run visible in context. Persistent recurrence within a session → escalate to `/clear` with a paste-ready resume (last-resort loop-break).
+
+### Pre-Emit Self-Check (before any tool call carrying non-ASCII text) — 3 items
+
+- [ ] Is every `conversation_language` string in this payload written as native UTF-8 characters (한글 / 日本語 / 中文), with **zero** hand-authored `\uXXXX` sequences?

```

**File**: `.claude/rules/moai/core/askuser-protocol.md` (modified, +59/-120)
```diff
@@ -9,15 +9,15 @@ description: Canonical reference for AskUserQuestion-only interaction protocol,
 >
 > **Loading scope**: Intentionally always-loaded (no `paths:` restriction). The orchestrator may compose an `AskUserQuestion` on any non-trivial turn, so the channel-monopoly rule and the ToolSearch deferred-tool preload procedure must be available every session.
 >
-> **Detail companion**: `askuser-protocol-reference.md` (paths-scoped to this file) — recommendation-placement evidence base, preview-field usage catalogue, and the Non-ASCII encoding root-cause mechanism / pollution-loop detail. Read it when those details are needed.
+> **Detail companion**: `askuser-protocol-reference.md` — recommendation-placement evidence base, preview-field usage catalogue, the Non-ASCII encoding root-cause mechanism / pollution-loop detail, § Blind Spot Pass, and the bodies relocated from here: § General Rule for Deferred Tools · § The Four Triggers · § The Five Exceptions · § The Unknowns 4-Quadrant Lens · § First-Action Sequence After Trigger · § Directive and Recovery · § Pre-Emit Self-Check (non-ASCII) — 3 items · § Pre-emit self-check (report-before-ask) — 5 items. Load it when classifying an ambiguity trigger, preloading a deferred tool, recovering a rejected non-ASCII payload, or running a pre-emit self-check.
 
 ---
 
 ## Channel Monopoly
 
 **AskUserQuestion is the only user-facing question channel.** The MoAI orchestrator MUST route every user-facing question through an `AskUserQuestion` tool invocation. Free-form interrogative prose in the response body is **prohibited** as a question channel.
 
-Applies to all orchestrator turns involving: clarification questions (Stage 1 Clarify), preference/decision questions ("Which approach?", "Continue or abort?"), Socratic interview rounds during Context-First Discovery (CLAUDE.md §7 Rule 5), branch and workflow selection, and conflict resolution (merge strategy, rollback confirmation, etc.).
+Applies to every orchestrator turn involving clarification (Stage 1 Clarify), a preference or decision ("Which approach?", "Continue or abort?"), a Socratic interview round during Context-First Discovery (CLAUDE.md §7 Rule 5), branch and workflow selection, or conflict resolution.
 
 **Exceptions** (free-form prose questions permitted ONLY when):
 - `AskUserQuestion` is technically unavailable — should not occur in normal orchestrator operation
@@ -29,7 +29,7 @@ Applies to all orchestrator turns involving: clarification questions (Stage 1 Cl
 
 ## ToolSearch Preload Procedure
 
-`AskUserQuestion` is a **deferred tool** in Claude Code. Its JSON schema is NOT loaded into the active context at agent initialization time. Attempting to invoke it without first selecting it results in `InputValidationError: tool not in schema`.
+`AskUserQuestion` is a **deferred tool**: its JSON schema is not loaded at agent initialization, so invoking it without selecting it first yields `InputValidationError: tool not in schema`.
 
 ### Mandatory Preload Step
 
@@ -39,20 +39,6 @@ Immediately before **every** `AskUserQuestion` call, the orchestrator MUST invok
 ToolSearch(query: "select:AskUserQuestion")
 ```
 
-### General Rule for Deferred Tools
-
-Any deferred tool requires a `ToolSearch` select preload before invocation. The pattern generalizes: `ToolSearch(query: "select:<tool>[,<tool>...]")` — single (`select:AskUserQuestion`) or multiple (`select:AskUserQuestion,TaskCreate`).
-
-**Preload sequence** (per turn — if a new turn begins and `AskUserQuestion` will be called again, preload again; never reverse or omit Step 1):
-
-```
-[Turn N]
-Step 1: ToolSearch(query: "select:AskUserQuestion")   ← preload deferred schema
-Step 2: AskUserQuestion({ questions: [...] })           ← now valid to invoke
-```
-
----
-
 ## Socratic Interview Structure
 
 When a Stage 1 Clarify trigger is satisfied (see §Ambiguity Triggers and Exceptions), the orchestrator conducts a **Socratic interview** through sequential `AskUserQuestion` rounds (each round: ToolSearch preload → AskUserQuestion; later rounds build on earlier answers; final round is the confirmation — "Proceed with this plan?").
@@ -61,7 +47,7 @@ When a Stage 1 Clarify trigger is satisfied (see §Ambiguity Triggers and Except
 
 1. **Round limit**: Maximum 4 questions per `AskUserQuestion` call (Claude Code hard limit)
 2. **Option limit**: Maximum 4 options per question (Claude Code hard limit)
-3. **First option label**: MUST carry the `(권장)` (Korean) or `(Recommended)` (English) suffix to signal the recommended choice
+3. **First option label**: MUST carry the `(권장)` (Korean) or `(Recommended)` (English) suffix to signal the recommended choice — this is the `push`-mode branch; while `interview.recommendation_mode` is `pull` the suffix is withheld from every option (§ Recommendation Placement Principles → Recommendation mode)
 4. **Language**: All question text, option labels, and option descriptions MUST be in the user's `conversation_language` (read from
```

**File**: `.claude/rules/moai/core/glm-web-tooling.md` (modified, +20/-62)
```diff
@@ -5,7 +5,7 @@ paths: "**/glm-web-tooling.md"
 
 # GLM-Backend Web Tooling Routing — Canonical Rule
 
-This file is the **single source of truth** for how MoAI agents and the orchestrator perform web search, web fetch, and image reading when the session runs on the GLM backend (`moai glm`) or the GLM teammate panes of `moai cg`.
+This file is the **single source of truth** for how MoAI agents and the orchestrator perform web search, web fetch, and image reading when the session runs on the GLM backend (`moai glm`).
 
 > **Why this rule exists**: Under a GLM backend the built-in Claude Code `WebSearch` / `WebFetch` tools route through the z.ai Anthropic-compatible gateway, which intermittently returns HTTP 529 (overload). Reading an image file with the built-in `Read` tool likewise hits a known base64-encoding failure (HTTP 422) under GLM. z.ai ships dedicated MCP servers that run server-side and bypass these failure modes. Without this doctrine, agents silently fall back to the failing built-in tools and research/fetch/vision operations break.
 
@@ -17,12 +17,12 @@ Cross-referenced by: `agent-common-protocol.md` §MCP Fallback Strategy, `settin
 
 [ZONE:Evolvable] [HARD] A session is **GLM-backed** when the `ANTHROPIC_BASE_URL` environment variable contains the substring `api.z.ai`. The canonical default value is `DefaultGLMBaseURL = "https://api.z.ai/api/anthropic"` (defined in `internal/config/defaults.go`). Equivalently, the runtime mode is `LLMModeGLM`.
 
-Three launch modes must be distinguished:
+Distinguish the current session backend from retired configuration:
 
 | Launcher | Backend scope | Does this rule apply? |
 |----------|---------------|-----------------------|
 | `moai glm` | **Whole session** — orchestrator AND all teammates run on GLM | YES — applies to every agent and the orchestrator |
-| `moai cg` | **Hybrid** — Claude leader pane + GLM teammate panes. The leader pane has its GLM env stripped and runs the Claude backend; only the GLM teammate panes hit z.ai routing | YES for GLM teammate panes; NO for the leader pane (see cg-leader exception below) |
+| Legacy `team_mode: cg` | Launch blocked pending explicit migration | No live CG routing; see CG Retirement and Migration |
 | `moai cc` | Claude backend (no GLM env) | NO — built-in tools are the canonical path |
 
 ---
@@ -39,9 +39,9 @@ Three launch modes must be distinguished:
 
 [ZONE:Evolvable] [HARD] While a session is GLM-backed, MoAI agents and the orchestrator SHALL NOT invoke the built-in `WebSearch` or `WebFetch`, nor `Read` on an image file. They SHALL route web search to `mcp__web_search_prime__webSearchPrime`, web fetch to `mcp__web_reader__webReader`, and image reading to a `mcp__zai-mcp-server__*` vision tool (default `analyze_image`).
 
-### cg-leader exception
+### Claude-backed sessions
 
-[ZONE:Evolvable] [HARD] Where the current pane is the `moai cg` **leader** pane (Claude backend, GLM env stripped), the HARD prohibition above does NOT apply — the built-in `WebSearch` / `WebFetch` / `Read` work normally there and are the canonical path. The HARD rule binds only `moai glm` whole-session contexts and `moai cg` GLM-teammate contexts.
+[ZONE:Evolvable] [HARD] The GLM prohibition does not apply to a Claude-backed session. Use the actual session backend to select tools; historical CG configuration is not evidence of a live leader/teammate routing split.
 
 ---
 
@@ -51,69 +51,27 @@ Claude Code versions before 2.1.246 sent the credential configured for a third-p
 
 ---
 
-## CG Mode (Claude + GLM teammates)
+## CG Retirement and Migration
 
-`moai cg` is the **hybrid** launcher named in the GLM-Backend Detection table above: the Claude leader pane keeps the Claude backend while GLM teammate panes route through z.ai. This section is the operational SSOT for how `moai cg` detects, configures, and recovers the hybrid mode. Only the CG operational mechanism is retained here; the retired static Agent Teams orchestration prose (team-spawn patterns, role assignments) is out of scope.
+`moai cg` is retired. It is not an alias for another launcher and cannot create a hybrid session. A stored `llm.team_mode: cg` is legacy data, not a provider selection. Launchers reject it before profile, worktree, tmux, or credential side effects, including continue/resume and explicit model requests.
 
-### Mechanism — tmux session-level environment isolation
+Preview the available role changes without writing configuration:
 
-The hybrid split relies on **tmux session-level environment variables**:
-
-1. `moai cg` calls `tmux set-environment` to inject GLM env vars at the session level.
-2. The CURRENT pane (the leader) is NOT affected — it keeps the Claude backend.
-3. Only NEW panes inherit the session-level env vars.
-4. With `teammateMode: "tmux"` in `.claude/settings.local.json`, teammates spawn in new panes and inherit the GLM env.
-5. Result: leader = Claude API, teammates = z.ai GLM API.
-
-This is NOT headless mode — teammates run as ful
```

**File**: `.claude/rules/moai/core/hooks-system.md` (modified, +2/-1)
```diff
@@ -33,7 +33,7 @@ Active settings.json keys: 20. RETIRE-OBS-ONLY (Go-only): 4.
 | SubagentStop | Agent type | Yes | Runs when a subagent terminates |
 | Notification | Type | No | Runs when notifications sent. Matchers: permission_prompt, idle_prompt, auth_success, elicitation_dialog, elicitation_complete, elicitation_response, agent_needs_input, agent_completed (last two added CC 2.1.198 — fire for background agents). **Go-only observability tap (see sub-table below).** |
 | UserPromptSubmit | No | Yes | Runs when user submits a prompt, before processing |
-| PermissionRequest | Tool name | Yes | Runs when permission dialog appears |
+| PermissionRequest | Tool name | Yes | Runs when permission dialog appears. Since Claude Code v2.1.280, `type: "agent"` is rejected for this event; use a command or HTTP hook for permission decisions. |
 | PermissionDenied | Tool name | No | Runs after auto mode denies a tool call. Return {retry: true} to retry (v2.1.89+) |
 | TeammateIdle | No | Yes | Runs when agent team teammate is about to go idle |
 | TaskCompleted | No | Yes | Runs when a task is being marked complete. **Go-only observability tap (see sub-table below).** |
@@ -170,6 +170,7 @@ Call a tool on a connected MCP server to make validation decisions.
 - Request: Hook event data passed as MCP tool arguments
 - Response: JSON with optional `decision`, `reason`, `additionalContext`
 - Same blocking behavior as command hooks
+- Since v2.1.281, a blocking event waits for a still-connecting MCP server before invoking this hook, up to the MCP connection timeout. Budget that startup wait on latency-sensitive gates.
 - Available since v2.1.85+
 
 ### Async Command Hooks (async: true)
```

**File**: `.claude/rules/moai/core/moai-constitution-detail.md` (modified, +5/-6)
```diff
@@ -1,5 +1,5 @@
 ---
-description: "Detail companion for moai-constitution.md — the Opus 5 / 4.8 prompt-philosophy guidance and the full Lessons Protocol operational detail (topic-file store, harness edit discipline, auto-capture triggers, domain matching, integration points)"
+description: "Detail companion for moai-constitution.md — the Opus 5.5 prompt-philosophy guidance and the full Lessons Protocol operational detail (topic-file store, harness edit discipline, auto-capture triggers, domain matching, integration points)"
 paths: "**/moai-constitution.md,**/agent-authoring.md,**/.claude/skills/moai/workflows/*.md"
 ---
 
@@ -10,7 +10,7 @@ paths: "**/moai-constitution.md,**/agent-authoring.md,**/.claude/skills/moai/wor
 > the Lessons Protocol's operational machinery. Load it when authoring an agent prompt for a
 > specific model tier, or when capturing, draining, or acting on a lesson.
 
-## Opus 5 / 4.8 Prompt Philosophy
+## Opus 5.5 Prompt Philosophy
 
 The binding bullet list lives in the stub. This section carries only what does not belong on the
 always-loaded surface.
@@ -32,9 +32,8 @@ on implicit fan-out silently gets a single-agent answer.
 
 **Effort routing by role.** Route effort by what the work demands rather than by which named agent
 is running: coding and agentic work at `xhigh`, intelligence-sensitive work at `high` or above,
-speed-critical or mechanical work stepped down. The per-agent default table lives in
-`.claude/rules/moai/development/agent-authoring.md` § Effort-Level Calibration Matrix, alongside the
-archived-agent legacy reference.
+speed-critical or mechanical work stepped down. Subagents inherit the main session's effort, so
+the choice is made for the session, not per agent.
 
 ## Lessons Protocol
 
@@ -50,7 +49,7 @@ Rules:
 - Lessons are additive: never overwrite a lesson, append corrections as updates
 - To supersede a lesson, add `[SUPERSEDED by #{new_lesson_number}]` prefix to the old entry
 - Session start: scan lessons for patterns matching current task domain
-- Repo-local lessons inbox (`.moai/lessons-inbox.jsonl`): tool failures and test failures append structured stubs (timestamp, event_key, summary, source) here as they occur. **Drain actor: the MoAI orchestrator. Drain trigger: when the inbox backlog grows large enough to obscure recurring patterns (a cluster of same-`event_key` stubs), the orchestrator drains these stubs into topic-file lesson entries as part of the Lessons Protocol — converting each recurring `event_key` cluster into one candidate `feedback_*.md` topic file before human review, and discarding one-off noise (single-occurrence stubs with no recurring pattern). Drained stubs are marked (the drain-marking mechanism is an implementation detail).**
+- Repo-local lessons inbox (`.moai/lessons-inbox.jsonl`): tool failures and test failures append structured stubs (timestamp, event_key, summary, source) here as they occur — the two wired families are `tool_failure:<tool>:<sig>` and `test_fail:<pkg>:`. **Capture scope (capability + composition):** the inbox records failure-event stubs only; it is not a record of defect families that produce neither a tool failure nor a test failure (vacuous green checks, skip-before-verdict, empty-result-set pass conditions, sibling repair misses, moving-ref assertions, stale-value quotations). The human-mediated loop (lane discovery → factory leader judgment → auto-memory `feedback_*.md` + `MEMORY.md` record) is the learning channel for those tool-invisible families; the measured live composition and its dated baseline live in the learning-channel scope anchor document, not in prose. **Drain actor: the MoAI orchestrator. Drain trigger: when the inbox backlog grows large enough to obscure recurring patterns (a cluster of same-`event_key` stubs), the orchestrator drains these stubs into topic-file lesson entries as part of the Lessons Protocol — converting each recurring `event_key` cluster into one candidate `feedback_*.md` topic file before human review, and discarding one-off noise (single-occurrence stubs with no recurring pattern). Drained stubs are marked (the drain-marking mechanism is an implementation detail).**
 
 Harness Edit Discipline (decision observability):
 - Harness surface tag: each lesson entry SHOULD carry a `surface:` tag naming the harness component it binds to (rule / agent / skill / hook / config / template / workflow) — enables clustering recurring failures by component
```

---

### Incident Patch 14: `29319286` (2026-10-05)
**Commit Message**: fix(t1520): propagate partial ceilings decode errors through the policy fallback (card t1520)

CR-P2-1 (card-review r1): a partially decodable plan_audit_tier_ceilings
({S: 1, M: bad}) left a non-nil typed map behind - yaml.v3 fills the keys
that decoded and returns a TypeError for the rest - so the malformed
predicate's nil-ness check adopted the surviving fragment as a valid
override and the policy fallback substituted defaults for the failed keys,
recording an outcome with a zero-error --record. The loose pass now treats
the typed decode's own error as the malformed signal (matrix M13, with the
readable-policy sibling M14 pinned), and the table-first regression seals
cover both the function-level triple and the CLI-level --record absence.

Matrix: config-error-matrix.md v1.0 to v1.1 (new partial-invalid state).

🗿 MoAI

**File**: `internal/cli/spec_ceiling.go` (modified, +10/-4)
```diff
@@ -175,7 +175,8 @@ func loadCeilingConfig(root string) (map[string]int, string, error) {
 //
 //   - ceilingsMalformed: the plan_audit_tier_ceilings field is present but
 //     cannot be decoded into map[string]int (the raw any survives, the typed
-//     map does not) — R3-P2-1's propagate signal.
+//     map does not — or survives only as a partial fragment whose decode
+//     errored; CR-P2-1) — R3-P2-1's propagate signal.
 //   - policyUnreadable: the POLICY block's own values are what cannot be
 //     read. The policy fields decode into any so every value shape survives
 //     the tolerant pass; a present-but-non-string on_final_hit, or a
@@ -205,9 +206,14 @@ func looseReadCeilingPolicy(path string) (ceilings map[string]int, ceilingsMalfo
 			PlanAuditTierCeilings map[string]int `yaml:"plan_audit_tier_ceilings"`
 		} `yaml:"harness"`
 	}
-	_ = yaml.Unmarshal(data, &typed) // the same typed decode the strict loader runs on this field
-	if raw.Harness.PlanAuditTierCeilings != nil && typed.Harness.PlanAuditTierCeilings == nil {
-		return nil, true, false // the ceilings field itself cannot be decoded — R3-P2-1
+	// CR-P2-1 (card-review r1): a PARTIALLY decodable ceilings field leaves a
+	// non-nil typed map behind — yaml.v3 fills the keys that decoded and
+	// returns a TypeError for the rest. Map nil-ness alone would adopt the
+	// surviving fragment as a valid override, silently substituting defaults
+	// for the failed keys; the decode's own error is the malformed signal.
+	typedErr := yaml.Unmarshal(data, &typed) // the same typed decode the strict loader runs on this field
+	if raw.Harness.PlanAuditTierCeilings != nil && (typedErr != nil || typed.Harness.PlanAuditTierCeilings == nil) {
+		return nil, true, false // the ceilings field itself cannot be decoded — R3-P2-1 / CR-P2-1
 	}
 	policy := raw.Harness.PlanAuditCeilingPolicy
 	if policy.OnFinalHit == nil && policy.AutoDeltaRounds == nil {
```

**File**: `internal/cli/spec_ceiling_config_matrix_test.go` (modified, +76/-4)
```diff
@@ -11,7 +11,11 @@
 // Field states:
 //
 //	ceilings: absent | valid-full | valid-partial (present values valid) |
-//	          malformed (decode into map[string]int fails, e.g. [bad])
+//	          partial-invalid (SOME keys decode, one fails — yaml.v3 fills the
+//	          survivors and returns a TypeError, e.g. {S: 1, M: bad}; the
+//	          typed map is left NON-nil, so nil-ness alone misses it —
+//	          CR-P2-1) |
+//	          malformed (decode into map[string]int fails outright, e.g. [bad])
 //	policy:   absent | readable (on_final_hit string — unknown names are
 //	          REQ-ACR-003 evaluation hold-arm concerns, not config errors) |
 //	          unreadable (non-string on_final_hit, non-int auto_delta_rounds)
@@ -51,10 +55,20 @@
 //	M12 ok            —             readable-other (unknown policy name) → the string
 //	                                           passes through; its hold-arm disposition is
 //	                                           evaluation-level, not config-level
+//	M13 strict-reject partial-invalid unreadable → strict error propagates and names
+//	                                           the ceiling field (CR-P2-1 fix; the
+//	                                           partial decode's survivors must not be
+//	                                           adopted as a valid override — that
+//	                                           absorbed the bad key into a default-
+//	                                           substituted, zero-error --record)
+//	M14 strict-reject partial-invalid readable   → strict error propagates (the loose
+//	                                           pass reports policyUnreadable=false)
 //
 // Regression seals: a joint ceiling+policy decode failure (M6) re-reddens if
 // the fallback again swallows the ceiling error; a partial-ceilings
-// unreadable-policy load (M4) re-reddens if the defaults merge is dropped.
+// unreadable-policy load (M4) re-reddens if the defaults merge is dropped; a
+// partially-decodable ceilings field (M13) re-reddens if the loose pass
+// judges malformed-ness by map nil-ness alone.
 package cli
 
 import (
@@ -270,6 +284,41 @@ func ceilingMatrixRows() []ceilingMatrixRow {
 			wantPolicy: "split-only",
 			focus:      "an unknown policy NAME is not a config error — the string passes through; the hold-arm reading is evaluation-level (existing behavior pinned)",
 		},
+		{
+			row: "M13 strict-reject / partial-invalid / unreadable",
+			yaml: `harness:
+  evaluator:
+    memory_scope: per_iteration
+  plan_audit_tier_ceilings:
+    S: 1
+    M: bad
+  plan_audit_ceiling_policy:
+    auto_delta_rounds: 1
+    on_final_hit: []
+`,
+			wantMap:    nil,
+			wantPolicy: "",
+			wantErr:    true,
+			errNames:   "plan_audit_tier_ceilings",
+			focus:      "CR-P2-1: a partially decodable ceilings field is still a defective ceilings field — yaml.v3 fills the survivors and returns a TypeError, so the typed map is non-nil; adopting the fragment absorbed the bad key into default-substituted ceilings and a zero-error --record",
+		},
+		{
+			row: "M14 strict-reject / partial-invalid / readable",
+			yaml: `harness:
+  evaluator:
+    memory_scope: per_iteration
+  plan_audit_tier_ceilings:
+    S: 1
+    M: bad
+  plan_audit_ceiling_policy:
+    auto_delta_rounds: 1
+    on_final_hit: hold-and-split
+`,
+			wantMap:    nil,
+			wantPolicy: "",
+			wantErr:    true,
+			focus:      "same partial decode with a readable policy — the strict failure stays fatal (existing behavior pinned; guards the readable arm against adopting the fragment too)",
+		},
 	}
 }
 
@@ -349,8 +398,8 @@ func TestSpecCeilingConfigMatrixM10Witness(t *testing.T) {
 
 // TestSpecCeilingConfigMatrixVerb — CLI level for the rows the matrix marks
 // observable at the verb: M4 and M7 reach --record (hold arm, record
-// written), M6 records nothing and the error output names the ceiling field
-// (the record abstention must be auditable).
+// written), M6 and M13 record nothing and the error output names the ceiling
+// field (the record abstention must be auditable).
 func TestSpecCeilingConfigMatrixVerb(t *testing.T) {
 	rows := ceilingMatrixRows()
 	byRow := func(prefix string) ceilingMatrixRow {
@@ -419,6 +468,29 @@ func TestSpecCeilingConfigMatrixVerb(t *testing.T) {
 		}
 	})
 
+	t.Run("M13 no record under a partially decodable ceilings field", func(t *testing.T) {
+		project := ceilingVerbProject(t)
+		matrixOverlay(t, project, byRow("M13").yaml)
+		t.Setenv("CLAUDE_PROJECT_DIR", "")
+		t.Chdir(project)
+
+		cmd := newSpecCmd()
+		var out bytes.Buffer
+		cmd.SetOut(&out)
+		cmd.SetErr(&out)
+		cmd.SetArgs([]string{"ceiling", "SPEC-CEILFIX-001", "--record"})
+		err := cmd.Execute()
+		if err == nil {
+			t.Fatalf("M13 must fail the verb — the surviving fragment must not be adopted as a valid override (CR-P2-1: the defect recorded an outcome under default-substituted ceilings)\noutput: %s", out.String())
+		}
+		if !strings.Contains(err.Error
```

---

### Incident Patch 15: `0c06f0c7` (2026-10-05)
**Commit Message**: chore(SPEC-MOAI-HYGIENE-001): M6 — closure, lint fixes, MX seam annotations, §E.2/§E.3

Card t1518, milestone M6 (closure).

- golangci-lint (CI v2.1.6) internal/hygiene: 0 issues (6 errcheck fixes:
  anchored-root Close, audit appenders, flock failure-path Close, test
  WalkDir / engine Run results).
- Coverage 85.9% (>= 85 TRUST 5 target): production plumbing tests added
  (real pid probe, registry decode, bounded transcript scan over fixture
  roots, settings yaml surface incl. explicit-zero-to-validation,
  exported root-registration, outcome render, nil clocks); the
  unreachable verify-group dating helper removed in favor of the
  per-entry entryDate the sweep actually uses.
- @MX:WARN + @MX:REASON on the seam fields (stat stale seam, lock
  probe, GC pre-rejudge/pre-action/root-handle, hook hygieneRunFn) —
  each names the residual window or platform limit it guards.
- progress.md §E.2 populated: per-commit table, 16-AC green table with
  the exact ledger commands re-run at closure, §E obligations (race,
  vet, lint, windows, isolation-hash equality, mutant-probe record),
  and the real-repo dry-run demonstration (report-only; no rotation
  artifacts; hygiene-audit.jsonl car

**File**: `.moai/specs/SPEC-MOAI-HYGIENE-001/progress.md` (modified, +89/-2)
```diff
@@ -13,11 +13,98 @@
 
 ## §E.2 Run-phase Evidence
 
-_<pending run-phase>_
+Run phase executed by manager-develop (card t1518) on branch `t1518-run` in the agent's isolated worktree, linear on the card HEAD `bde9be69c` (the spawn type's worktree isolation guard refuses card-tree git — recorded in §E.3; the lane lands the branch with one `--ff-only` merge). Commits, all carrying `card t1518`:
+
+| Commit | Content |
+|---|---|
+| `e7c564b38` | STEP 0 — plan-audit iter-3 defect closure (D26–D35), spec v0.4.0, status draft → in-progress |
+| `3ba96f561` | M1 — rotator core + sink registry + completeness guard (v0.4.1: registry extended with the 11 writers the guard verified) |
+| `26593db6f` | M2 — three-signal fail-closed liveness evaluator |
+| `b410c82cf` | M3 — GC sweep, modes, audit granularity, symlink defense |
+| `fa4c202f0` | M4 — named thresholds, workflow.hygiene config, `moai clean` extension |
+| `7a9957d09` | M5 — SessionStart wiring, best-effort, never blocks launch |
+| (this commit) | M6 — closure: lint fixes, MX seam annotations, §E.2/§E.3 |
+
+### AC → green table (each line: the exact ledger command, re-run at closure)
+
+| AC | Command (verbatim) | Observed result |
+|---|---|---|
+| AC-HYG-001 (L-001) | `go test ./internal/hygiene/ -run '^TestRotator_RotatesOverThreshold$' -count=1` | `ok … internal/hygiene 0.296s` — exit 0 |
+| AC-HYG-002 (L-002) | `go test ./internal/hygiene/ -run '^TestRotator_KeepOneCap$' -count=1` | `ok … 0.129s` — exit 0 (crash-recovery arms green) |
+| AC-HYG-003 (L-003) | `go test ./internal/hygiene/ -run '^TestRotator_UnderThresholdAndAbsent$' -count=1` | `ok … 0.117s` — exit 0 |
+| AC-HYG-004 (L-004) | `go test ./internal/hygiene/ -run '^TestRotator_ConcurrentSerialize$' -count=1 -race` | `ok … 1.386s` — exit 0 (stale/no-exclusion arms green) |
+| AC-HYG-005 (L-005) | `go test ./internal/hygiene/ -run '^TestSinkRegistryCompleteness$' -count=1` | `ok … 0.359s` — exit 0 (real-tree arm green over the v0.4.1 registry) |
+| AC-HYG-006 (L-006) | `go test ./internal/hygiene/ -run '^TestLivenessVerdictMatrix$' -count=1` | `ok … 0.108s` — exit 0 (neverDead flips assert unmeasured≠DEAD) |
+| AC-HYG-007 (L-007) | `go test ./internal/hygiene/ -run '^TestReportModeByteIdentical$' -count=1` | `ok … 0.229s` — exit 0 (hash-equal; no lockfile; 1+1 summary rows; self-sink `skipped-report-mode`) |
+| AC-HYG-008 (L-008) | `go test ./internal/hygiene/ -run '^TestApplyModeDeletionSet$' -count=1` | `ok … 0.124s` — exit 0 (D28 race arm + D29 crash arm + already-gone green) |
+| AC-HYG-009 (L-009) | `go test ./internal/hygiene/ -run '^TestAuditRowsComplete$' -count=1` | `ok … 0.123s` — exit 0 |
+| AC-HYG-010 (L-010) | `go test ./internal/hygiene/ -run '^TestUnitIndependence$' -count=1` | `ok … 0.117s` — exit 0 |
+| AC-HYG-011 (L-011) | `go test ./internal/hygiene/ -run '^TestSymlinkRefusalParentSwap$' -count=1` | `ok … 0.119s` — exit 0 (anchored-action refusal; external sentinel survives) |
+| AC-HYG-012 (L-012) | `go test ./internal/hygiene/ -run '^TestLockClassExcluded$' -count=1` | `ok … 0.120s` — exit 0 (both modes; registry structurally lock-free) |
+| AC-HYG-013 (L-013) | `go test ./internal/hook/ -run '^TestSessionStartHygieneBestEffort$' -count=1` | `ok … internal/hook 0.684s` — exit 0, run test count ≥ 1 (empty-sweep RED flipped per §1.1) |
+| AC-HYG-014 (L-014) | `go test ./internal/cli/ -run '^TestCleanHygieneFlags$' -count=1` | `ok … internal/cli 0.827s` — exit 0, run test count ≥ 1 (7 subtests: dry-run, config-apply-without---apply, apply, 3×D30, rotator-dry) |
+| AC-HYG-015 (L-015) | widened threshold grep over `internal/hygiene` | exit **1**, empty output; L-C1 control re-observed: 6 hits, exit 0 |
+| AC-HYG-016 (L-016) | full escape-pattern grep over `internal/hygiene` + both wiring test files | exit **1**, empty output; L-C2 1 hit / L-C3 3 hits, exit 0; runtime guard asserted (non-temp root refused, registered temp root accepted) |
+
+### §E obligations
+
+- `go test ./internal/hygiene/... -count=1 -race`: `ok … 3.065s` (final closure run). Package coverage **85.9%** (≥ 85 target); production plumbing additionally driven cross-package by the CLI/hook wiring suites.
+- `go vet ./internal/hygiene/`: clean. `golangci-lint run internal/hygiene/...` at the CI version **v2.1.6**: **0 issues** (6 errcheck fixes landed at M6).
+- `GOOS=windows go build ./internal/hygiene/ ./internal/cli/`: pass; `GOOS=windows go vet ./internal/hygiene/`: pass (LockFileEx sidecar path compiles).
+- Isolation verification (DoD #3): content hash of the real `.moai/logs` + `.moai/state` taken before/after the verification batch — **identical** (`44c8b5cb…` both sides; the own-session runtime trace writer excluded as the named non-verification observer; the full-suite run had flagged exactly that file, nothing else). No `hygiene-audit.jsonl` exists in the real logs dir — no test touched the real tree.
+- Mutant-probe record (test-level, per §C): AC-HYG-006 — the matrix's neverDead rows force every O
```

**File**: `internal/hook/session_start_hygiene.go` (modified, +5/-0)
```diff
@@ -11,6 +11,11 @@ import (
 // REQ-HYG-014, AC-HYG-013): the deferred advisory pass invokes it
 // best-effort; tests stub it to fail and assert the hook still allows the
 // launch. Production installs runHygieneBestEffort.
+//
+// @MX:WARN @MX:REASON: the seam runs inside the SessionStart deferred
+// pass — a production caller installing a blocking or mutating function
+// here would put hygiene on the launch critical path this wiring exists
+// to keep clear.
 var hygieneRunFn = runSessionHygiene
 
 // runSessionHygiene executes one hygiene pass for the project in the
```

**File**: `internal/hygiene/gc.go` (modified, +14/-1)
```diff
@@ -50,12 +50,25 @@ type GC struct {
 	// preRejudge, when non-nil, runs between enumeration and the D28
 	// action-time re-judge — the writer-race seam (a writer replacing the
 	// file with fresh state between the two steps).
+	//
+	// @MX:WARN @MX:REASON: the seam exists to prove the rejudge catches a
+	// mid-flight writer; a production caller installing destructive work
+	// here would sit inside the deletion critical section.
 	preRejudge func()
 	// preAction, when non-nil, runs between the immediately-before-action
 	// component check and the anchored action — the D27 swap-after-check
 	// seam.
+	//
+	// @MX:WARN @MX:REASON: the seam sits inside the symlink-safety window;
+	// the anchored handle closes the escape for symlink swaps, and this
+	// seam is what lets a test demonstrate it — a production caller here
+	// shares the deletion critical section.
 	preAction func()
 	// rootHandle, when non-nil, replaces os.OpenRoot (anchored-action seam).
+	//
+	// @MX:WARN @MX:REASON: the anchored root handle is the D27 closure; a
+	// production caller returning a plain (non-Root-backed) handle would
+	// reopen the symlink escape window this SPEC closed.
 	rootHandle func(string) (*os.Root, error)
 }
 
@@ -131,7 +144,7 @@ func (g *GC) Run(mode Mode) (*GCReport, error) {
 		if err != nil {
 			return nil, fmt.Errorf("gc: anchored root handle: %w", err)
 		}
-		defer anchor.Close()
+		defer func() { _ = anchor.Close() }()
 	}
 
 	for i := range candidates {
```

**File**: `internal/hygiene/gc_test.go` (modified, +2/-2)
```diff
@@ -294,7 +294,7 @@ func TestReportModeByteIdentical(t *testing.T) {
 
 	treeHash := func() string {
 		h := sha256.New()
-		filepath.WalkDir(moaiRoot, func(path string, d os.DirEntry, err error) error {
+		_ = filepath.WalkDir(moaiRoot, func(path string, d os.DirEntry, err error) error {
 			if err != nil {
 				return err
 			}
@@ -463,7 +463,7 @@ func TestUnitIndependence(t *testing.T) {
 			MinAge: testMinAge, TranscriptWindow: testActivityWindow, HeartbeatWindow: testStaleHb,
 		}
 		registerTestRoot(moaiRoot)
-		e.Run(ModeApply)
+		_, _, _, _ = e.Run(ModeApply)
 		// The engine call itself must not panic; assert through a direct
 		// composition that the GC still completes after the rotator errors.
 		r := &Rotator{LogDir: logDir, MaxBytes: testThreshold, KeptRotations: 2}
```

**File**: `internal/hygiene/liveness_registry_test.go` (added, +102/-0)
```diff
@@ -0,0 +1,102 @@
+package hygiene
+
+import (
+	"encoding/json"
+	"os"
+	"os/exec"
+	"path/filepath"
+	"testing"
+	"time"
+)
+
+// TestLivenessRealRegistry — the production (seam-nil) evaluator path over
+// a fixture registry file: entry present with a reaped pid and an old
+// heartbeat reads DEAD-eligible on the pid+heartbeat half; an entry miss
+// reads unmeasured; a future heartbeat reads affirmative (clock skew errs
+// toward keeping).
+func TestLivenessRealRegistry(t *testing.T) {
+	cmd := exec.Command("true")
+	if err := cmd.Start(); err != nil {
+		t.Fatalf("spawn probe child: %v", err)
+	}
+	deadPID := cmd.Process.Pid
+	_, _ = cmd.Process.Wait()
+
+	registryPath := filepath.Join(t.TempDir(), "active-sessions.json")
+	write := func(entries []RegistryEntry) {
+		t.Helper()
+		blob, err := json.Marshal(entries)
+		if err != nil {
+			t.Fatalf("marshal: %v", err)
+		}
+		if err := os.WriteFile(registryPath, blob, 0o644); err != nil {
+			t.Fatalf("write: %v", err)
+		}
+	}
+
+	old := fixtureNow.Add(-testStaleHb).Add(-time.Hour)
+	write([]RegistryEntry{{SessionID: keyDead, PID: deadPID, LastHeartbeat: old}})
+	l := &Liveness{
+		TranscriptWindow: testActivityWindow,
+		HeartbeatWindow:  testStaleHb,
+		RegistryPath:     registryPath,
+		now:              func() time.Time { return fixtureNow },
+	}
+
+	// Entry present: pid negative (reaped), heartbeat negative, transcript
+	// unmeasured (no roots) ⇒ INDETERMINATE — and the unmeasured names
+	// carry exactly the transcript signal.
+	verdict, unmeasured, evidence := l.Evaluate(keyDead)
+	if verdict != VerdictIndeterminate {
+		t.Fatalf("verdict = %s, want indeterminate (transcript unmeasured)", verdict)
+	}
+	if len(unmeasured) != 1 || unmeasured[0] != "transcript" {
+		t.Fatalf("unmeasured = %v, want [transcript]", unmeasured)
+	}
+	if evidence["pid"] != "negative" || evidence["heartbeat"] != "negative" {
+		t.Fatalf("evidence = %v", evidence)
+	}
+
+	// Entry missing for the key: pid+heartbeat unmeasured (transcript
+	// unmeasured too — no roots), never DEAD.
+	write([]RegistryEntry{{SessionID: keyGoal, PID: deadPID, LastHeartbeat: old}})
+	verdict, unmeasured, _ = l.Evaluate(keyDead)
+	if verdict != VerdictIndeterminate || len(unmeasured) != 3 {
+		t.Fatalf("entry-miss verdict = %s unmeasured = %v", verdict, unmeasured)
+	}
+
+	// Future heartbeat reads affirmative (clock skew errs toward keeping).
+	write([]RegistryEntry{{SessionID: keyDead, PID: deadPID,
+		LastHeartbeat: fixtureNow.Add(time.Hour)}})
+	verdict, _, evidence = l.Evaluate(keyDead)
+	if verdict != VerdictLive || evidence["heartbeat"] != "affirmative" {
+		t.Fatalf("future heartbeat: verdict = %s evidence = %v", verdict, evidence)
+	}
+
+	// Unparseable registry reads as absent: pid+heartbeat unmeasured
+	// (transcript unmeasured as well), never DEAD.
+	if err := os.WriteFile(registryPath, []byte("{broken"), 0o644); err != nil {
+		t.Fatalf("break registry: %v", err)
+	}
+	verdict, unmeasured, _ = l.Evaluate(keyDead)
+	if verdict != VerdictIndeterminate || len(unmeasured) != 3 {
+		t.Fatalf("broken registry verdict = %s unmeasured = %v", verdict, unmeasured)
+	}
+}
+
+// TestNilClockDefaults — the production clock accessors default to
+// time.Now when no injected clock is installed.
+func TestNilClockDefaults(t *testing.T) {
+	r := &Rotator{}
+	if r.pnow().IsZero() {
+		t.Fatalf("rotator nil clock returned zero time")
+	}
+	g := &GC{}
+	if g.gnow().IsZero() {
+		t.Fatalf("gc nil clock returned zero time")
+	}
+	l := &Liveness{}
+	if l.lnow().IsZero() {
+		t.Fatalf("liveness nil clock returned zero time")
+	}
+}
```

**File**: `internal/hygiene/production_plumbing_test.go` (added, +186/-0)
```diff
@@ -0,0 +1,186 @@
+package hygiene
+
+import (
+	"encoding/json"
+	"os"
+	"os/exec"
+	"path/filepath"
+	"strings"
+	"testing"
+	"time"
+)
+
+// TestProbePidAliveProduction — the real (non-seam) pid probe: a live
+// process reads unmeasured (no recorded fingerprint to compare), a reaped
+// process reads negative, and a zero pid reads unmeasured.
+func TestProbePidAliveProduction(t *testing.T) {
+	if s := probePidAlive(0); s != SignalUnmeasured {
+		t.Fatalf("zero pid = %s, want unmeasured", s)
+	}
+	if s := probePidAlive(os.Getpid()); s != SignalUnmeasured {
+		t.Fatalf("live pid = %s, want unmeasured (no recorded fingerprint)", s)
+	}
+	cmd := exec.Command("true")
+	if err := cmd.Start(); err != nil {
+		t.Fatalf("spawn probe child: %v", err)
+	}
+	deadPID := cmd.Process.Pid
+	_, _ = cmd.Process.Wait()
+	if s := probePidAlive(deadPID); s != SignalNegative {
+		t.Fatalf("reaped pid = %s, want negative", s)
+	}
+}
+
+// TestReadRegistryEntriesProduction — the plain registry decode: an array
+// reads back, and an unparseable body errors (the caller then treats the
+// registry as absent — fail-closed).
+func TestReadRegistryEntriesProduction(t *testing.T) {
+	path := filepath.Join(t.TempDir(), "active-sessions.json")
+	entries := []RegistryEntry{{SessionID: keyDead, PID: 4242}}
+	blob, err := json.Marshal(entries)
+	if err != nil {
+		t.Fatalf("marshal: %v", err)
+	}
+	if err := os.WriteFile(path, blob, 0o644); err != nil {
+		t.Fatalf("write: %v", err)
+	}
+	got, err := readRegistryEntries(path)
+	if err != nil || len(got) != 1 || got[0].SessionID != keyDead {
+		t.Fatalf("read = %v, %v; want one entry", got, err)
+	}
+	if err := os.WriteFile(path, []byte("{not json"), 0o644); err != nil {
+		t.Fatalf("rewrite: %v", err)
+	}
+	if _, err := readRegistryEntries(path); err == nil {
+		t.Fatalf("unparseable registry read without error")
+	}
+}
+
+// TestScanTranscriptsProduction — the real (non-seam) transcript scan over
+// fixture profile roots: fresh transcript affirmative, stale negative,
+// absent under resolvable roots unmeasured, and an unresolvable root
+// unmeasured.
+func TestScanTranscriptsProduction(t *testing.T) {
+	root := t.TempDir()
+	projects := filepath.Join(root, "projects")
+	projDir := filepath.Join(projects, "some-project")
+	if err := os.MkdirAll(projDir, 0o755); err != nil {
+		t.Fatalf("mkdir: %v", err)
+	}
+
+	l := &Liveness{
+		TranscriptWindow: testActivityWindow,
+		now:              func() time.Time { return fixtureNow },
+	}
+
+	// Absent under a resolvable root: unmeasured, never negative.
+	l.TranscriptRoots = []string{projects}
+	if s := l.scanTranscripts(keyDead); s != SignalUnmeasured {
+		t.Fatalf("absent transcript = %s, want unmeasured", s)
+	}
+
+	// Fresh transcript: affirmative (two-level shape: projects/<dir>/<key>).
+	freshPath := filepath.Join(projDir, keyDead+".jsonl")
+	if err := os.WriteFile(freshPath, []byte("{}\n"), 0o644); err != nil {
+		t.Fatalf("write fresh: %v", err)
+	}
+	if s := l.scanTranscripts(keyDead); s != SignalAffirmative {
+		t.Fatalf("fresh transcript = %s, want affirmative", s)
+	}
+
+	// Stale transcript: negative.
+	stale := fixtureNow.Add(-testActivityWindow).Add(-time.Hour)
+	if err := os.Chtimes(freshPath, stale, stale); err != nil {
+		t.Fatalf("chtimes: %v", err)
+	}
+	if s := l.scanTranscripts(keyDead); s != SignalNegative {
+		t.Fatalf("stale transcript = %s, want negative", s)
+	}
+
+	// A top-level transcript (root/<key>.jsonl) is found too.
+	l2 := &Liveness{TranscriptWindow: testActivityWindow, TranscriptRoots: []string{projects},
+		now: func() time.Time { return fixtureNow }}
+	if err := os.WriteFile(filepath.Join(projects, keyGoal+".jsonl"), []byte("{}\n"), 0o644); err != nil {
+		t.Fatalf("write top-level: %v", err)
+	}
+	if s := l2.scanTranscripts(keyGoal); s != SignalAffirmative {
+		t.Fatalf("top-level fresh transcript = %s, want affirmative", s)
+	}
+
+	// Unresolvable root: unmeasured.
+	l3 := &Liveness{TranscriptWindow: testActivityWindow,
+		TranscriptRoots: []string{filepath.Join(root, "does-not-exist")},
+		now:             func() time.Time { return fixtureNow }}
+	if s := l3.scanTranscripts(keyDead); s != SignalUnmeasured {
+		t.Fatalf("unresolvable root = %s, want unmeasured", s)
+	}
+
+	// No roots at all: unmeasured.
+	l4 := &Liveness{TranscriptWindow: testActivityWindow, TranscriptRoots: nil,
+		now: func() time.Time { return fixtureNow }}
+	if s := l4.scanTranscripts(keyDead); s != SignalUnmeasured {
+		t.Fatalf("no roots = %s, want unmeasured", s)
+	}
+}
+
+// TestSettingsProductionSurfaces — DefaultSettings mirrors the compiled
+// config constants, ConfigError renders, and the home/config-root
+// resolvers return without error on a developer machine.
+func TestSettingsProductionSurfaces(t *testing.T) {
+	s := DefaultSettings()
+	if err := s.Validate(); err != nil {
+		t.Fatalf("compiled defaults do not validate: %v", err)
+	}
+	if s.AuditLogMaxBytes <= 0 || s.MinAgeDays <= 0 {
+		t.Fatalf("compiled defaults
```

**File**: `internal/hygiene/rotate.go` (modified, +9/-0)
```diff
@@ -37,9 +37,18 @@ type Rotator struct {
 	// statFn, when non-nil, replaces os.Stat — the stale-decision seam
 	// (AC-HYG-004 arm a). The first call models the stale pre-lock
 	// observation; the under-lock re-stat is a later call.
+	//
+	// @MX:WARN @MX:REASON: the stat seam is the documented stale-decision
+	// residual-loss window (SPEC §C residual class); a production caller
+	// installing it would let a pre-lock observation drive destruction.
 	statFn func(string) (fs.FileInfo, error)
 	// lockProbe, when non-nil, replaces the real pass lock — the sidecar
 	// seam modeling held / unverifiable exclusion (AC-HYG-004 arm b).
+	//
+	// @MX:WARN @MX:REASON: the exclusion seam models the Windows
+	// sidecar's held/unverifiable limits; a production caller installing
+	// an always-acquired probe would rotate on unverified exclusivity,
+	// the exact D17 destruction shape.
 	lockProbe func(string) lockResult
 }
 
```

**File**: `internal/hygiene/rotate_lock_unix.go` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@ func (r *Rotator) acquirePassLock() (func(), lockResult) {
 		return func() {}, lockUnverifiable
 	}
 	if err := syscall.Flock(int(f.Fd()), syscall.LOCK_EX|syscall.LOCK_NB); err != nil {
-		f.Close()
+		_ = f.Close()
 		if errors.Is(err, syscall.EWOULDBLOCK) || errors.Is(err, syscall.EAGAIN) || errors.Is(err, syscall.EACCES) {
 			return func() {}, lockHeld
 		}
```

#### Recent Merged Pull Requests:
- **PR #1763** (2026-10-06): fix(hook): key the auditor start marker by session+agent_type for background spawns (card t1544) (@GoosLab)
- **PR #1761** (2026-10-06): feat(SPEC-SESSION-CC-VERSION-002): structural resume-argv interpretation and install-root-anchored version extraction (card t1515) (@GoosLab)
- **PR #1760** (2026-10-05): feat(t1497): move harness log prune off the hook path into a detached child (SPEC-HARNESS-DETACHED-PRUNE-001) (@GoosLab)
- **PR #1759** (2026-10-05): feat(SPEC-MEMORY-FOLD-BUDGET-001): memory hygiene pass 1 - fold verb, doctor budget, card-close wiring (card t1502) (@GoosLab)
- **PR #1758** (2026-10-05): fix(factory): require a recorded driver for the serial slot hold (card t1513) (@GoosLab)
- **PR #1757** (2026-10-06): card t1510: SPEC-SELF-IMPROVE-PROTECTED-ZONE-001 — self-improvement protected zone manifest and PreToolUse guard (@GoosLab)
- **PR #1756** (2026-10-05): fix(cli): skip the codex review gate when the gate binary predates the session tree (card t1528) (@GoosLab)
- **PR #1750** (2026-10-05): SPEC-TODO-CARD-ISSUANCE-001: card issuance quality — overlap hints, relation graph, anti-over-split (card t1454) (@GoosLab)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
