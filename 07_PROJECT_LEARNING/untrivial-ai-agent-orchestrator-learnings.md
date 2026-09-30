# Forensic Learning Record (Deep Inspection): Untrivial-ai/agent-orchestrator

> **Canonical Artifact**: `07_PROJECT_LEARNING/untrivial-ai-agent-orchestrator-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Untrivial-ai/agent-orchestrator](https://github.com/Untrivial-ai/agent-orchestrator))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:55:13.633Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Untrivial-ai/agent-orchestrator`
- **Description**: Run and supervise teams of coding agents from planning to merge. Any harness (Claude code, codex, +25 more). Desktop, web, mobile, and cloud agents.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 12570 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.agents/skills/bug-triage/scripts/push_fix_to_github.py`
```
#!/usr/bin/env python3
"""
Push a file fix to GitHub via API and create a PR.

Usage: python3 push_fix_to_github.py <repo> <branch-name> <file-path> <commit-message> <pr-title> <pr-body>

Reads the original file content from GitHub (default branch), applies a sed-like
replacement using OLD_STRING / NEW_STRING env vars, and pushes via GitHub API.

Environment variables:
  OLD_STRING    - The exact string to find in the file (required)
  NEW_STRING    - The replacement string (set to empty string to delete) (required as env var)
  BASE_SHA      - Override the base commit SHA (optional, defaults to default branch HEAD)
  BASE_BRANCH   - Override the base branch name (optional, defaults to "main")

Example:
  OLD_STRING='<td className="foo">{bar}</td>' \
  NEW_STRING='<td className="foo"><a href="#">{bar}</a></td>' \
  python3 push_fix_to_github.py Untrivial-ai/agent-orchestrator fix/branch packages/web/src/File.tsx \
    "fix: description" "fix: title" "Fixes #123"
"""
import sys, os, json, subprocess, base64


def run_gh(args, check=True):
    """Run a gh API command and return parsed JSON."""
    cmd = ["gh", "api"] + args
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    if check and result.returncode != 0:
        print(f"ERROR: gh api failed: {result.stderr}", file=sys.stderr)
        sys.exit(1)
    try:
        return json.loads(result.stdout) if result.stdout.strip() else {}
    except json.JSONDecodeError:
        if check:
            print(f"ERROR: Invalid JSON: {result.stdout[:300]}", file=sys.stderr)
            sys.exit(1)
        return {}


if __name__ == "__main__":
    if len(sys.argv) < 7:
        print("Usage: push_fix_to_github.py <repo> <branch> <file-path> <commit-msg> <pr-title> <pr-body>", file=sys.stderr)
        sys.exit(1)

    repo = sys.argv[1]
    branch = sys.argv[2]
    file_path = sys.argv[3]
    commit_msg = sys.argv[4]
    pr_title = sys.argv[5]
    pr_body = sys.argv[6]
    base_branch = os.environ.get("BASE_BRANCH", "main")

    old_string = os.environ.get("OLD_STRING", "")
    new_string = os.environ.get("NEW_STRING")

    if not old_string:
        print("ERROR: OLD_STRING env var is required", file=sys.stderr)
        sys.exit(1)
    if new_string is None:
        print("ERROR: NEW_STRING env var is required (set to empty string to delete)", file=sys.stderr)
        sys.exit(1)

    # 1. Get base HEAD SHA first
    base_sha = os.environ.get("BASE_SHA")
    if not base_sha:
        ref_data = run_gh([f"repos/{repo}/git/ref/heads/{base_branch}"])
        base_sha = ref_data["object"]["sha"]

    # 2. Create branch from base SHA (before fetching file to avoid SHA race)
    print(f"Creating branch {branch} from {base_branch} ({base_sha[:8]})...")
    run_gh([
        "-X", "POST", f"repos/{repo}/git/refs",
        "-f", f"ref=refs/heads/{branch}",
        "-f", f"sha={base_sha}"
    ], check=False)

    # 3. Fetch file content from the new branch (avoids SHA mismatch)
    print(f"Fetching {file_path} from {repo} (branch: {branch})...")
    file_data = run_gh([f"repos/{repo}/contents/{file_path}?ref={branch}"])
    file_sha = file_data["sha"]
    decoded_content = base64.b64decode(file_data["content"]).decode("utf-8")

    print(f"File SHA: {file_sha}")

    # 4. Apply replacement
    if old_string not in decoded_content:
        print(f"ERROR: OLD_STRING not found in file!", file=sys.stderr)
        print(f"Looking for:\n{old_string}", file=sys.stderr)
        sys.exit(1)

    match_count = decoded_content.count(old_string)
    if match_count > 1:
        print(f"WARNING: OLD_STRING found {match_count} times — replacing only the first occurrence.", file=sys.stderr)

    new_content = decoded_content.replace(old_string, new_string, 1)
    encoded = base64.b64encode(new_content.encode("utf-8")).decode("ascii")

    # 5. Push file to branch
    print(f"Pushing updated file...")
    result = run_gh([
        "-X", "PUT", f"repos/{repo}/contents/{file_path}",
        "-f", f"message={commit_msg}",
        "-f", f"content={encoded}",
        "-f", f"sha={file_sha}",
        "-f", f"branch={branch}"
    ])

    # 6. Create PR
    print(f"Creating PR...")
    pr_result = run_gh([
        "-X", "POST", f"repos/{repo}/pulls",
        "-f", f"title={pr_title}",
        "-f", f"body={pr_body}",
        "-f", f"head={branch}",
        "-f", f"base={base_branch}"
    ])

    pr_url = pr_result.get("html_url", "unknown")
    pr_number = pr_result.get("number", "?")
    print(f"\n✅ PR #{pr_number}: {pr_url}")

```

### Core Architecture Module: `.claude/skills/bug-triage/scripts/push_fix_to_github.py`
```
#!/usr/bin/env python3
"""
Push a file fix to GitHub via API and create a PR.

Usage: python3 push_fix_to_github.py <repo> <branch-name> <file-path> <commit-message> <pr-title> <pr-body>

Reads the original file content from GitHub (default branch), applies a sed-like
replacement using OLD_STRING / NEW_STRING env vars, and pushes via GitHub API.

Environment variables:
  OLD_STRING    - The exact string to find in the file (required)
  NEW_STRING    - The replacement string (set to empty string to delete) (required as env var)
  BASE_SHA      - Override the base commit SHA (optional, defaults to default branch HEAD)
  BASE_BRANCH   - Override the base branch name (optional, defaults to "main")

Example:
  OLD_STRING='<td className="foo">{bar}</td>' \
  NEW_STRING='<td className="foo"><a href="#">{bar}</a></td>' \
  python3 push_fix_to_github.py Untrivial-ai/agent-orchestrator fix/branch packages/web/src/File.tsx \
    "fix: description" "fix: title" "Fixes #123"
"""
import sys, os, json, subprocess, base64


def run_gh(args, check=True):
    """Run a gh API command and return parsed JSON."""
    cmd = ["gh", "api"] + args
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    if check and result.returncode != 0:
        print(f"ERROR: gh api failed: {result.stderr}", file=sys.stderr)
        sys.exit(1)
    try:
        return json.loads(result.stdout) if result.stdout.strip() else {}
    except json.JSONDecodeError:
        if check:
            print(f"ERROR: Invalid JSON: {result.stdout[:300]}", file=sys.stderr)
            sys.exit(1)
        return {}


if __name__ == "__main__":
    if len(sys.argv) < 7:
        print("Usage: push_fix_to_github.py <repo> <branch> <file-path> <commit-msg> <pr-title> <pr-body>", file=sys.stderr)
        sys.exit(1)

    repo = sys.argv[1]
    branch = sys.argv[2]
    file_path = sys.argv[3]
    commit_msg = sys.argv[4]
    pr_title = sys.argv[5]
    pr_body = sys.argv[6]
    base_branch = os.environ.get("BASE_BRANCH", "main")

    old_string = os.environ.get("OLD_STRING", "")
    new_string = os.environ.get("NEW_STRING")

    if not old_string:
        print("ERROR: OLD_STRING env var is required", file=sys.stderr)
        sys.exit(1)
    if new_string is None:
        print("ERROR: NEW_STRING env var is required (set to empty string to delete)", file=sys.stderr)
        sys.exit(1)

    # 1. Get base HEAD SHA first
    base_sha = os.environ.get("BASE_SHA")
    if not base_sha:
        ref_data = run_gh([f"repos/{repo}/git/ref/heads/{base_branch}"])
        base_sha = ref_data["object"]["sha"]

    # 2. Create branch from base SHA (before fetching file to avoid SHA race)
    print(f"Creating branch {branch} from {base_branch} ({base_sha[:8]})...")
    run_gh([
        "-X", "POST", f"repos/{repo}/git/refs",
        "-f", f"ref=refs/heads/{branch}",
        "-f", f"sha={base_sha}"
    ], check=False)

    # 3. Fetch file content from the new branch (avoids SHA mismatch)
    print(f"Fetching {file_path} from {repo} (branch: {branch})...")
    file_data = run_gh([f"repos/{repo}/contents/{file_path}?ref={branch}"])
    file_sha = file_data["sha"]
    decoded_content = base64.b64decode(file_data["content"]).decode("utf-8")

    print(f"File SHA: {file_sha}")

    # 4. Apply replacement
    if old_string not in decoded_content:
        print(f"ERROR: OLD_STRING not found in file!", file=sys.stderr)
        print(f"Looking for:\n{old_string}", file=sys.stderr)
        sys.exit(1)

    match_count = decoded_content.count(old_string)
    if match_count > 1:
        print(f"WARNING: OLD_STRING found {match_count} times — replacing only the first occurrence.", file=sys.stderr)

    new_content = decoded_content.replace(old_string, new_string, 1)
    encoded = base64.b64encode(new_content.encode("utf-8")).decode("ascii")

    # 5. Push file to branch
    print(f"Pushing updated file...")
    result = run_gh([
        "-X", "PUT", f"repos/{repo}/contents/{file_path}",
        "-f", f"message={commit_msg}",
        "-f", f"content={encoded}",
        "-f", f"sha={file_sha}",
        "-f", f"branch={branch}"
    ])

    # 6. Create PR
    print(f"Creating PR...")
    pr_result = run_gh([
        "-X", "POST", f"repos/{repo}/pulls",
        "-f", f"title={pr_title}",
        "-f", f"body={pr_body}",
        "-f", f"head={branch}",
        "-f", f"base={base_branch}"
    ])

    pr_url = pr_result.get("html_url", "unknown")
    pr_number = pr_result.get("number", "?")
    print(f"\n✅ PR #{pr_number}: {pr_url}")

```

### Core Architecture Module: `backend/cmd/ao/main.go`
```
package main

import (
	"fmt"
	"os"

	"github.com/aoagents/agent-orchestrator/backend/internal/cli"
)

func main() {
	if err := cli.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(cli.ExitCode(err))
	}
}

```

### Core Architecture Module: `backend/cmd/gencodexproto/main.go`
```
// Command gencodexproto generates Go bindings for the Codex app-server protocol
// from the schema the provider itself publishes.
//
// The protocol is a machine-readable contract: `codex app-server
// generate-json-schema --out DIR` writes the whole method and payload surface as
// draft-07 JSON Schema. Reading it beats hand-writing structs, because the
// failure mode of hand-writing is silent: a field spelled slightly wrong
// unmarshals to a zero value and the driver reports "no output" rather than
// "wrong shape". Every payload here is a compile-time type instead.
//
// Usage:
//
//	go run ./cmd/gencodexproto -out internal/adapters/chatdriver/codexappserver/codexproto/protocol.gen.go
//
// With no -schema, the generator asks the installed provider for its schema, so
// what lands in the tree always describes a real build rather than a snapshot
// someone remembered to update.
package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/json"
	"flag"
	"fmt"
	"go/format"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
)

func main() {
	var (
		schemaDir = flag.String("schema", "", "directory of JSON Schema files; empty asks the installed provider")
		out       = flag.String("out", "", "path of the Go file to write (required)")
		binary    = flag.String("codex", "codex", "provider binary used when -schema is empty")
	)
	flag.Parse()

	if *out == "" {
		fatal("-out is required")
	}

	dir := *schemaDir
	version := "unknown"
	if dir == "" {
		tmp, err := os.MkdirTemp("", "codexschema")
		if err != nil {
			fatal("temp dir: %v", err)
		}
		defer func() { _ = os.RemoveAll(tmp) }()
		if err := emitSchema(*binary, tmp); err != nil {
			fatal("%v", err)
		}
		dir = tmp
	}
	if v, err := providerVersion(*binary); err == nil {
		version = v
	}

	g, err := load(dir)
	if err != nil {
		fatal("%v", err)
	}
	g.version = version

	if err := os.MkdirAll(filepath.Dir(*out), 0o750); err != nil {
		fatal("mkdir: %v", err)
	}

	src := g.render()
	formatted, err := format.Source(src)
	if err != nil {
		// Write the unformatted source next to the target so the syntax error is
		// readable; a gofmt failure here is a generator bug, not a schema problem.
		_ = os.WriteFile(*out+".broken", src, 0o600)
		fatal("gofmt: %v (unformatted source at %s.broken)", err, *out)
	}
	if err := os.WriteFile(*out, formatted, 0o600); err != nil {
		fatal("write: %v", err)
	}
	fmt.Fprintf(os.Stderr, "gencodexproto: %d types, %d methods from %s\n",
		len(g.defs), len(g.methods), version)
}

func fatal(formatText string, args ...any) {
	_, _ = fmt.Fprintf(os.Stderr, "gencodexproto: "+formatText+"\n", args...)
	os.Exit(1)
}

func emitSchema(binary, dir string) error {
	cmd := exec.Command(binary, "app-server", "generate-json-schema", "--out", dir)
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("%s app-server generate-json-schema: %w: %s", binary, err, out)
	}
	return nil
}

func providerVersion(binary string) (string, error) {
	out, err := exec.Command(binary, "--version").Output()
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(out)), nil
}

/* ---- schema model ------------------------------------------------------- */

// schema is the subset of draft-07 the Codex protocol actually uses. Verified by
// walking every published file: no patternProperties, no const, no if/then.
type schema struct {
	Ref                  string             `json:"$ref"`
	Type                 json.RawMessage    `json:"type"`
	Enum                 []any              `json:"enum"`
	Properties           map[string]*schema `json:"properties"`
	Required             []string           `json:"required"`
	Items                *schema            `json:"items"`
	AdditionalProperties json.RawMessage    `json:"additionalProperties"`
	OneOf                []*schema          `json:"oneOf"`
	AnyOf                []*schema          `json:"anyOf"`
	AllOf                []*schema          `json:"allOf"`
	Title                string             `json:"title"`
	Description          string             `json:"description"`
	Format               string             `json:"format"`
	Definitions          map[string]*schema `json:"definitions"`

	// permissive marks a schema written as the bare literal `true` or `false`.
	permissive bool
}

// UnmarshalJSON accepts draft-07's boolean schemas. `true` means "any value" and
// `false` means "no value"; both render as raw JSON, which is the only honest Go
// type for a payload the schema declines to describe.
func (s *schema) UnmarshalJSON(data []byte) error {
	var anything bool
	if err := json.Unmarshal(data, &anything); err == nil {
		*s = schema{permissive: true}
		return nil
	}
	type plain schema // no UnmarshalJSON, so this does not recurse
	var p plain
	if err := json.Unmarshal(data, &p); err != nil {
		return err
	}
	*s = schema(p)
	return nil
}

// types reports the declared JSON types, which the schema writes either as a
// string or as a list including "null" for an optional value.
func (s *schema) types() []string {
	if len(s.Type) == 0 {
		return nil
	}
	var one string
	if err := json.Unmarshal(s.Type, &one); err == nil {
		return []string{one}
	}
	var many []string
	if err := json.Unmarshal(s.Type, &many); err == nil {
		return many
	}
	return nil
}

// nullable reports whether the value may be absent, which decides whether the
// Go field is a pointer.
func (s *schema) nullable() bool {
	for _, t := range s.types() {
		if t == "null" {
			return true
		}
	}
	// anyOf: [{...}, {"type": "null"}] is how the schema spells an optional $ref.
	for _, v := range s.AnyOf {
		for _, t := range v.types() {
			if t == "null" {
				return true
			}
		}
	}
	return false
}

// base strips the null arm so the remaining schema describes the value itself.
func (s *schema) base() *schema {
	if len(s.AnyOf) > 0 {
		var concrete []*schema
		for _, v := range s.AnyOf {
			if len(v.types()) == 1 && v.types()[0] == "null" {
				continue
			}
			concrete = append(concrete, v)
		}
		if len(concrete) == 1 {
			return concrete[0]
		}
	}
	// allOf with a single arm is a wrapper the schema uses to attach a description
	// to a $ref.
	if len(s.AllOf) == 1 && s.Ref == "" && len(s.Properties) == 0 {
		return s.AllOf[0]
	}
	return s
}

/* ---- method table ------------------------------------------------------- */

type method struct {
	Name      string // wire method, e.g. "thread/start"
	Direction string // ClientRequest | ClientNotification | ServerRequest | ServerNotification
	Params    string // Go type of params, empty when the method carries none
	Result    string // Go type of the result, empty for notifications
	Doc       string
}

type generator struct {
	version string
	defs    map[string]*schema // merged definitions, by name
	methods []method
}

// unionFiles map a published union file to the direction it describes.
var unionFiles = map[string]string{
	"ClientRequest.json":      "ClientRequest",
	"ClientNotification.json": "ClientNotification",
	"ServerRequest.json":      "ServerRequest",
	"ServerNotification.json": "ServerNotification",
}

func load(dir string) (*generator, error) {
	g := &generator{defs: map[string]*schema{}}

	// The v2 bundle carries every type including the response shapes, which the
	// per-direction union files omit.
	bundle := filepath.Join(dir, "codex_app_server_protocol.v2.schemas.json")
	if err := g.mergeDefs(bundle); err != nil {
		return nil, err
	}

	names := make([]string, 0, len(unionFiles))
	for f := range unionFiles {
		names = append(names, f)
	}
	sort.Strings(names)

	for _, file := range names {
		path := filepath.Join(dir, file)
		if _, err := os.Stat(path); err != nil {
			continue
		}
		if err := g.mergeDefs(path); err != nil {
			return nil, err
		}
		if err := g.collectMethods(path, unionFiles[file]); err != nil {
			return nil, err
		}
	}
	if len(g.methods) == 0 {
		return nil, fmt.Errorf("no methods found in %s; is this a codex schema directory?", dir)
	}
	sort.Slice(g.methods, func(i, j int) bool {
		i
```

### Core Architecture Module: `backend/cmd/pricingcatalog/main.go`
```
// Command pricingcatalog generates and validates AO's reviewed pricing catalog.
package main

import (
	"errors"
	"flag"
	"fmt"
	"io"
	"os"

	"github.com/aoagents/agent-orchestrator/backend/internal/pricing/catalogsync"
)

const maxSourceBytes = 32 << 20

func main() {
	if err := run(os.Args[1:], os.Stdout, os.Stderr); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run(args []string, stdout, stderr io.Writer) error {
	if len(args) == 0 {
		return errors.New("usage: pricingcatalog <sync|validate> [flags]")
	}
	switch args[0] {
	case "sync":
		return runSync(args[1:], stdout, stderr)
	case "validate":
		return runValidate(args[1:], stdout, stderr)
	default:
		return fmt.Errorf("unknown command %q; usage: pricingcatalog <sync|validate> [flags]", args[0])
	}
}

func runSync(args []string, stdout, stderr io.Writer) (err error) {
	flags := flag.NewFlagSet("sync", flag.ContinueOnError)
	flags.SetOutput(stderr)
	root := flags.String("root", ".", "repository root")
	sourcePath := flags.String("source", "", "pinned LiteLLM model_prices_and_context_window.json")
	revision := flags.String("revision", "", "exact LiteLLM revision SHA")
	if err := flags.Parse(args); err != nil {
		return err
	}
	if *sourcePath == "" || *revision == "" {
		return errors.New("sync requires -source and -revision")
	}
	file, err := os.Open(*sourcePath)
	if err != nil {
		return fmt.Errorf("open source: %w", err)
	}
	defer func() {
		if closeErr := file.Close(); err == nil {
			err = closeErr
		}
	}()
	source, err := io.ReadAll(io.LimitReader(file, maxSourceBytes+1))
	if err != nil {
		return fmt.Errorf("read source: %w", err)
	}
	if len(source) > maxSourceBytes {
		return fmt.Errorf("source exceeds %d-byte limit", maxSourceBytes)
	}
	result, err := catalogsync.Sync(*root, source, catalogsync.Source{
		Repository: "BerriAI/litellm",
		Revision:   *revision,
		Path:       "model_prices_and_context_window.json",
	})
	if err != nil {
		return err
	}
	if result.Changed {
		_, _ = fmt.Fprintln(stdout, "changed")
	} else {
		_, _ = fmt.Fprintln(stdout, "unchanged")
	}
	return nil
}

func runValidate(args []string, stdout, stderr io.Writer) error {
	flags := flag.NewFlagSet("validate", flag.ContinueOnError)
	flags.SetOutput(stderr)
	root := flags.String("root", ".", "repository root")
	if err := flags.Parse(args); err != nil {
		return err
	}
	if err := catalogsync.Validate(*root); err != nil {
		return err
	}
	_, _ = fmt.Fprintln(stdout, "valid")
	return nil
}

```

### Core Architecture Module: `backend/internal/adapters/agent/activitydispatch/dispatch.go`
```
// Package activitydispatch is the single source of truth mapping the agent
// token in `ao hooks <agent> <event>` onto the function that interprets that
// agent's hook callbacks as an AO activity state.
//
// The hidden `ao hooks` CLI command dispatches a live callback through it. Every
// adapter that installs `ao hooks <tok>` callbacks must have a deriver
// registered here — otherwise the adapter writes callbacks that nothing on the
// receiving side understands, so its activity is silently never reported.
package activitydispatch

import (
	"github.com/aoagents/agent-orchestrator/backend/internal/adapters/agent/activitystate"
	"github.com/aoagents/agent-orchestrator/backend/internal/adapters/agent/agy"
	"github.com/aoagents/agent-orchestrator/backend/internal/adapters/agent/aider"
	"github.com/aoagents/agent-orchestrator/backend/internal/adapters/agent/amp"
	"github.com/aoagents/agent-orchestrator/backend/internal/adapters/agent/auggie"
	"github.com/aoagents/agent-orchestrator/backend/internal/adapters/agent/claudecode"
	"github.com/aoagents/agent-orchestrator/backend/internal/adapters/agent/codex"
	"github.com/aoagents/agent-orchestrator/backend/internal/adapters/agent/continueagent"
	"github.com/aoagents/agent-orchestrator/backend/internal/adapters/agent/cursor"
	"github.com/aoagents/agent-orchestrator/backend/internal/adapters/agent/droid"
	"github.com/aoagents/agent-orchestrator/backend/internal/adapters/agent/fake"
	"github.com/aoagents/agent-orchestrator/backend/internal/adapters/agent/gemini"
	"github.com/aoagents/agent-orchestrator/backend/internal/adapters/agent/kimchi"
	"github.com/aoagents/agent-orchestrator/backend/internal/adapters/agent/mimocode"
	"github.com/aoagents/agent-orchestrator/backend/internal/adapters/agent/muse"
	"github.com/aoagents/agent-orchestrator/backend/internal/adapters/agent/omp"
	"github.com/aoagents/agent-orchestrator/backend/internal/adapters/agent/opencode"
	"github.com/aoagents/agent-orchestrator/backend/internal/adapters/agent/opencodev2"
	"github.com/aoagents/agent-orchestrator/backend/internal/adapters/agent/pi"
	"github.com/aoagents/agent-orchestrator/backend/internal/adapters/agent/primeagent"
	"github.com/aoagents/agent-orchestrator/backend/internal/adapters/agent/vibe"
	"github.com/aoagents/agent-orchestrator/backend/internal/domain"
)

// DeriveFunc maps a native agent hook event and its raw stdin payload onto an AO
// activity state. ok=false means the event carries no activity signal.
type DeriveFunc func(event string, payload []byte) (domain.ActivityState, bool)

// Derivers maps the agent token in `ao hooks <agent> <event>` to its deriver.
// Per-adapter PRs add their tokens here as they land.
var Derivers = map[string]DeriveFunc{
	// Adapters that parse hook payloads for finer-grained state keep their own
	// deriver; the rest share the name-only StandardDeriveActivityState.
	"claude-code": claudecode.DeriveActivityState,
	"grok":        claudecode.DeriveActivityState,
	"muse":        muse.DeriveActivityState,
	"omp":         omp.DeriveActivityState,
	"codex":       codex.DeriveActivityState,
	"continue":    continueagent.DeriveActivityState,
	"droid":       droid.DeriveActivityState,
	"agy":         agy.DeriveActivityState,
	"aider":       aider.DeriveActivityState,
	"kimchi":      kimchi.DeriveActivityState,
	"opencode":    opencode.DeriveActivityState,
	"opencode-v2": opencodev2.DeriveActivityState,
	"prime-agent": primeagent.DeriveActivityState,
	"mimo-code":   mimocode.DeriveActivityState,
	"amp":         amp.DeriveActivityState,
	"pi":          pi.DeriveActivityState,
	"auggie":      auggie.DeriveActivityState,
	"goose":       activitystate.StandardDeriveActivityState,
	"devin":       activitystate.StandardDeriveActivityState,
	"cursor":      cursor.DeriveActivityState,
	"qwen":        activitystate.StandardDeriveActivityState,
	"gemini":      gemini.DeriveActivityState,
	"copilot":     activitystate.StandardDeriveActivityState,
	"kimi":        activitystate.StandardDeriveActivityState,
	"cline":       activitystate.StandardDeriveActivityState,
	"kiro":        activitystate.StandardDeriveActivityState,
	"kilocode":    activitystate.StandardDeriveActivityState,
	"autohand":    activitystate.StandardDeriveActivityState,
	"vibe":        vibe.DeriveActivityState,
	"fake":        fake.DeriveActivityState,
}

// SignalCoverage describes how much of a harness lifecycle AO can observe.
// Partial coverage can report useful transitions but cannot prove that silence
// means a broken pipeline. Complete coverage is eligible for the no_signal
// watchdog because the harness is expected to report promptly after launch or
// prompt submission.
type SignalCoverage uint8

const (
	// SignalCoverageNone means the harness has no activity callback pipeline.
	SignalCoverageNone SignalCoverage = iota
	// SignalCoveragePartial means the harness emits only a subset of lifecycle
	// transitions, such as Aider's response-ready notification.
	SignalCoveragePartial
	// SignalCoverageComplete means the harness emits enough lifecycle callbacks
	// for prolonged initial silence to indicate a broken pipeline.
	SignalCoverageComplete
)

// signalCoverageOverrides records harnesses whose callback coverage cannot be
// inferred from a same-named Derivers entry. Aider has only a completion
// callback. Continue's Claude-compatible hooks vary by installed CLI version,
// so its terminal fallback is useful without treating hook silence as broken.
var signalCoverageOverrides = map[domain.AgentHarness]SignalCoverage{
	domain.HarnessAider:    SignalCoveragePartial,
	domain.HarnessContinue: SignalCoveragePartial,
}

// CoverageForHarness returns the activity-signal coverage for a selectable
// harness. Same-named callback pipelines are complete by default; exceptional
// aliases and partial pipelines are declared above.
func CoverageForHarness(h domain.AgentHarness) SignalCoverage {
	if coverage, ok := signalCoverageOverrides[h]; ok {
		return coverage
	}
	if _, ok := Derivers[string(h)]; ok {
		return SignalCoverageComplete
	}
	return SignalCoverageNone
}

// Derive looks up the deriver for an agent token and applies it. ok=false when
// the token has no registered deriver or the event carries no activity signal —
// the caller reports nothing in either case.
func Derive(agent, event string, payload []byte) (domain.ActivityState, bool) {
	derive, found := Derivers[agent]
	if !found {
		return "", false
	}
	return derive(event, payload)
}

// SupportsHarness reports whether a harness has any activity callback pipeline,
// including partial coverage and compatibility aliases.
func SupportsHarness(h domain.AgentHarness) bool {
	return CoverageForHarness(h) != SignalCoverageNone
}

// FullySupportsHarness reports whether a harness has complete activity signal
// coverage. Status derivation uses this narrower predicate for the no_signal
// watchdog so a partial pipeline is not penalized for callbacks it cannot emit.
func FullySupportsHarness(h domain.AgentHarness) bool {
	return CoverageForHarness(h) == SignalCoverageComplete
}

```

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

### Core Architecture Module: `backend/internal/adapters/agent/agentbase/agentbase.go`
```
// Package agentbase supplies the defaults an agent adapter would otherwise
// hand-copy. Most adapters implement several ports.Agent methods identically:
// no config keys, prompt delivered in the launch command, and (for the simpler
// harnesses) no hooks, no resume, no session metadata. Embedding Base gives an
// adapter those defaults so it only writes the methods it actually customizes.
package agentbase

import (
	"context"
	"strings"

	"github.com/aoagents/agent-orchestrator/backend/internal/ports"
)

// ModelConfigSpec returns the common optional model config field used by
// adapters that forward a --model-style argument.
func ModelConfigSpec(ctx context.Context, description string) (ports.ConfigSpec, error) {
	if err := ctx.Err(); err != nil {
		return ports.ConfigSpec{}, err
	}
	return ports.ConfigSpec{Fields: []ports.ConfigField{{
		Key: "model", Type: ports.ConfigFieldString, Description: description,
	}}}, nil
}

// AppendModelFlag appends a trimmed model override using the adapter-owned
// static flag name.
func AppendModelFlag(cmd *[]string, cfg ports.AgentConfig, flag string) {
	if model := strings.TrimSpace(cfg.Model); model != "" {
		*cmd = append(*cmd, flag, model)
	}
}

// Base provides no-op defaults for the optional ports.Agent methods. Embed it in
// a Plugin struct (`agentbase.Base`) and override only what the harness needs.
// Every method honors ctx cancellation and otherwise does nothing, matching what
// the adapters previously wrote by hand.
type Base struct{}

// GetConfigSpec reports no agent-specific config keys.
func (Base) GetConfigSpec(ctx context.Context) (ports.ConfigSpec, error) {
	return ports.ConfigSpec{}, ctx.Err()
}

// GetPromptDeliveryStrategy reports that the agent receives its prompt in the
// launch command itself, which is true for every shipped adapter.
func (Base) GetPromptDeliveryStrategy(ctx context.Context, _ ports.LaunchConfig) (ports.PromptDeliveryStrategy, error) {
	if err := ctx.Err(); err != nil {
		return "", err
	}
	return ports.PromptDeliveryInCommand, nil
}

// GetAgentHooks is a no-op for harnesses without a native hook surface.
func (Base) GetAgentHooks(ctx context.Context, _ ports.WorkspaceHookConfig) error {
	return ctx.Err()
}

// GetRestoreCommand reports that no existing native session can be continued.
func (Base) GetRestoreCommand(ctx context.Context, _ ports.RestoreConfig) (cmd []string, ok bool, err error) {
	if err := ctx.Err(); err != nil {
		return nil, false, err
	}
	return nil, false, nil
}

// SessionInfo reports no agent-owned session metadata.
func (Base) SessionInfo(ctx context.Context, _ ports.SessionRef) (ports.SessionInfo, bool, error) {
	if err := ctx.Err(); err != nil {
		return ports.SessionInfo{}, false, err
	}
	return ports.SessionInfo{}, false, nil
}

// StandardSessionInfo returns the normalized session metadata (native session
// id, title, summary) an adapter's hooks persisted under the shared
// ports.MetadataKey* keys. ok is false when none of the three is present. An
// adapter whose SessionInfo just reads those keys delegates here.
func StandardSessionInfo(session ports.SessionRef) (ports.SessionInfo, bool) {
	info := ports.SessionInfo{
		AgentSessionID: session.Metadata[ports.MetadataKeyAgentSessionID],
		Title:          session.Metadata[ports.MetadataKeyTitle],
		Summary:        session.Metadata[ports.MetadataKeySummary],
	}
	if info.AgentSessionID == "" && info.Title == "" && info.Summary == "" {
		return ports.SessionInfo{}, false
	}
	return info, true
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #6008** (2026-09-29): **fix(tracker-intake): gate the intake observer behind AO_TRACKER_INTAKE**
  *Symptoms*: ``` Code changes: +61 -9 Tests: +117 -3 Others: +9 -4 (docs, 5 mdx pages) ```  ## Problem / fix  Tracker intake starts one worker session per eligible issue with nothing bounding how many run at once, so enabling it on a project with N matching open issues starts N agents inside a single one-minute tick. A user hit this with 5 assigned issues: all 5 sessions ran lint and the Go test suite simultaneously and capped the machine's CPU, and killing the sessions did not help, because `seenIssueIDs` counts only live sessions, so a terminated session frees its issue for the very next poll. The only escape was disabling intake on the project.  `AO_TRACKER_INTAKE` moves that decision to whoever runs the daemon, defaulting off. A project's own `trackerIntake.enabled` no longer does anything on its own. Rollback is `AO_TRACKER_INTAKE=on`, not a revert.  Gated off, the observer is never constructed and `startTrackerIntake` returns a nil channel, which the shutdown await in `lifecycle_wiring.go:170` already nil-guards. It does still read the project list once at boot, to report how many projects hold an enabled-but-inert config. That scan gates nothing, because a boot-time scan deciding whether to start the loop is the regression covered by `TestStartTrackerIntake_RunsEvenWithoutEnabledProjects`.  `TrackerIntakeConfig`, the settings UI, the adapters and the OpenAPI schema are untouched, so the in-flight multi-provider intake work in https://github.com/Untrivial-ai/agent-orchestrator/pull/
  **Post-Mortem & Fix Analysis**:
  > ## 🏆 Review leaderboard  Sep 21–28, 2026 · UTC  | Rank | Reviewer | PRs reviewed | Review rounds | PR comments | | :---: | --- | ---: | ---: | ---: | | 🥇 | <img src="https://avatars.githubusercontent.com/u/180498112?u=e5a56125b1eb089c8ce7c0800df23a20d559cd2c&v=4" width="24" height="24" alt="@codebanditssss"> [@codebanditssss](https://github.com/codebanditssss) | 38 | 49 | 56 | | 🥈 | <img src="https://avatars.githubusercontent.com/u/44542765?u=4df62a1ca3b55473f46a507a586e3e4dddb019cc&v=4" width="24" height="24" alt="@illegalcall"> [@illegalcall](https://github.com/illegalcall) | 33 | 57 | 4 | | 🥉 | <img src="https://avatars.githubusercontent.com/u/96230495?u=3ab7514bc4e9916975900c211456c546a0867d64&v=4" width="24" height="24" alt="@nikhilachale"> [@nikhilachale](https://github.com/nikhilachale) | 18 | 45 | 4 | | 4 | <img src="https://avatars.githubusercontent.com/u/64074505?u=cab8d4e9a8a4b5bf79fe10ff06ea4f69b5cb2264&v=4" width="24" height="24" alt="@ronishrohan"> [@ronishrohan](http

- **Issue #6006** (2026-09-29): **this contains the pairing fix for desktop with mobile**
  *Symptoms*: ## What  Fix mobile pairing error reporting so failed QR pairing attempts preserve and display the actual endpoint instead of showing `Reached nothing at :`.  ## Why  The mobile pairing flow was passing empty `host` and `port` values to the connection error handler when the endpoint race failed. This produced an incomplete and misleading error message, even though the endpoint was available from the parsed QR payload.  Fixes the mobile pairing visibility/debugging issue.  ## How  * Preserve the parsed pairing offer through the pairing flow in `packages/mobile/app/pair.tsx`. * Use the first parsed endpoint when reporting a failed connection attempt. * Update `connectionError.ts` to handle missing host/port gracefully instead of rendering an empty `host:port`. * Added development-only logging for parsed endpoints and endpoint racing. * Added regression coverage for endpoint preservation and empty endpoint handling. * Added a LAN listener identity endpoint regression test.  No API contract changes or hardcoded IP/port values were introduced.  ## Testing  Validated locally with:  * `pairFlow.test.ts` — **11/11 passed** * `connectionError.test.ts` — **29/29 passed** * `pairingCode.test.ts` — **17/17 passed** * TypeScript compilation — **passed** * LAN listener tests — **passed** * Mobile bridge endpoint tests — **passed**  Real Android → desktop QR pairing was not tested because a physical/emulated Android environment and LAN setup were not availabl
  **Post-Mortem & Fix Analysis**:
  > ## 🏆 Review leaderboard  Sep 21–28, 2026 · UTC  | Rank | Reviewer | PRs reviewed | Review rounds | PR comments | | :---: | --- | ---: | ---: | ---: | | 🥇 | <img src="https://avatars.githubusercontent.com/u/180498112?u=e5a56125b1eb089c8ce7c0800df23a20d559cd2c&v=4" width="24" height="24" alt="@codebanditssss"> [@codebanditssss](https://github.com/codebanditssss) | 38 | 49 | 56 | | 🥈 | <img src="https://avatars.githubusercontent.com/u/44542765?u=4df62a1ca3b55473f46a507a586e3e4dddb019cc&v=4" width="24" height="24" alt="@illegalcall"> [@illegalcall](https://github.com/illegalcall) | 33 | 58 | 4 | | 🥉 | <img src="https://avatars.githubusercontent.com/u/96230495?u=3ab7514bc4e9916975900c211456c546a0867d64&v=4" width="24" height="24" alt="@nikhilachale"> [@nikhilachale](https://github.com/nikhilachale) | 18 | 45 | 4 | | 4 | <img src="https://avatars.githubusercontent.com/u/64074505?u=cab8d4e9a8a4b5bf79fe10ff06ea4f69b5cb2264&v=4" width="24" height="24" alt="@ronishrohan"> [@ronishrohan](http
  > Addressed All Required Changes  ✅ 1. Block-scoped the const inside switch case (connectionError.ts:141)    • Wrapped the case "unreachable" body in braces to prevent linter issues with case-block declarations  ✅ 2. Extracted DEV check to reduce repetition (race.ts:59)    • Added const isDev = typeof __DEV__ !== "undefined" && __DEV; at the top of raceEndpoints   • Replaced all 7 instances of the repetitive check with if (isDev)  ✅ 3. Strengthened endpoint preservation test (pairFlow.test.ts:151-163)    • Added new test makes parsed endpoints available for error reporting in the UI layer   • Verifies that parsePairingCode correctly extracts endpoints that can be used in error messages   • Tests the contract that pair.tsx relies on when constructing error targets   • Confirms the first endpoint's host and port are accessible for error reporting  Test Results:    • ✅ pairFlow.test.ts: 12/12 passed (added 1 new test)   • ✅ connectionError.test.ts: 29/29 passed   • ✅ T
  > @kekubhai heads up: #5977 looks like it's already doing the same thing — worth coordinating there before this diverges.

- **Issue #6002** (2026-09-28): **fix(settings): keep confirm dialogs above the settings surface**
  *Symptoms*: ## What broke  Turning on the Cloud toggle in Settings (General, under Developer mode) did nothing, while turning it off worked fine. This turned out to be the visible tip of a wider break: **anything that opens from inside the Settings dialog and portals to the page** was invisible, including  - every ConfirmDialog (global **and** project settings, same component): Cloud enable, browser profile delete, account removal - every dropdown and select: Session Interface, terminal shell, theme, language - every popover and tooltip  ## Why  #5873 ("keep dialog above blurred backdrop") fixed the settings dialog rendering behind its own scrim by raising the dialog content to `z-[calc(var(--z-overlay)+1)]` (computed 51). #5944 then deduped the class list and kept that value.  Every popup in the app lives on the `z-overlay` layer (50) and portals after the settings dialog. With the settings surface at 51, each one painted under it: present in the DOM, visually buried, unusable. Enabling Cloud is confirm-gated and disabling is not, which is why the toggle looked dead in one direction only.  ## The fix  One class change in `SettingsDialog.tsx`: the content drops back to `z-overlay` (50). It still paints above its own scrim because the content portals after the overlay and equal z-index ties break by DOM order, the same mechanism every other dialog in this app already uses (ConfirmDialog's box and scrim are both `z-overlay`). Confirms, dropdowns, and popovers opened from Settings portal la
  **Post-Mortem & Fix Analysis**:
  > ## 🏆 Review leaderboard  Sep 21–28, 2026 · UTC  | Rank | Reviewer | PRs reviewed | Review rounds | PR comments | | :---: | --- | ---: | ---: | ---: | | 🥇 | <img src="https://avatars.githubusercontent.com/u/180498112?u=e5a56125b1eb089c8ce7c0800df23a20d559cd2c&v=4" width="24" height="24" alt="@codebanditssss"> [@codebanditssss](https://github.com/codebanditssss) | 38 | 49 | 56 | | 🥈 | <img src="https://avatars.githubusercontent.com/u/44542765?u=4df62a1ca3b55473f46a507a586e3e4dddb019cc&v=4" width="24" height="24" alt="@illegalcall"> [@illegalcall](https://github.com/illegalcall) | 33 | 58 | 6 | | 🥉 | <img src="https://avatars.githubusercontent.com/u/96230495?u=3ab7514bc4e9916975900c211456c546a0867d64&v=4" width="24" height="24" alt="@nikhilachale"> [@nikhilachale](https://github.com/nikhilachale) | 18 | 45 | 3 | | 4 | <img src="https://avatars.githubusercontent.com/u/64074505?u=cab8d4e9a8a4b5bf79fe10ff06ea4f69b5cb2264&v=4" width="24" height="24" alt="@ronishrohan"> [@ronishrohan](http
  > <img width="915" height="679" alt="image" src="https://github.com/user-attachments/assets/8fb12f84-b13b-423b-890e-f43e5cdc4e3a" /> 

- **Issue #6001** (2026-09-29): **fix(mobile): improve drawer and settings responsiveness**
  *Symptoms*: Code changes: +157 -38   Tests: +133 -2   Others: +0 -0  ## What  Make the Android hamburger control reliably open the drawer on affected Pixel devices while preserving the smooth native drawer animation. Also remove avoidable Settings wait states and give the iOS Appearance selector enough width for its selected label.  ## Why  The original fixed edge-swipe target could overlap the hamburger control on devices with tall status-bar or cutout insets. Physical Pixel testing then exposed a second React Native/Fabric failure mode: while the natively transformed content frame is settling, Android can deliver touch-down, touch-up, and the pressed visual state but omit `Pressable.onPress`.  That explains why the control looked pressed without opening and why the issue was more visible on some Android devices and during rapid close/reopen interactions.  The drawer also stayed logically open until its closing spring completed. A second swipe during that interval was therefore calculated from a fully open drawer even when the drawer was almost closed, which could snap it back open.  The Settings sheet had two separate wait sources unrelated to the hamburger changes:  - It reloaded configuration directly from AsyncStorage/SecureStore even though `AppProvider` had already resolved the same configuration, gating the entire sheet behind a spinner. - Disconnect awaited the normal 12-second API timeout before clearing local pairing state when the desktop was unreachable.  The native iOS Appe
  **Post-Mortem & Fix Analysis**:
  > ## 🏆 Review leaderboard  Sep 21–28, 2026 · UTC  | Rank | Reviewer | PRs reviewed | Review rounds | PR comments | | :---: | --- | ---: | ---: | ---: | | 🥇 | <img src="https://avatars.githubusercontent.com/u/180498112?u=e5a56125b1eb089c8ce7c0800df23a20d559cd2c&v=4" width="24" height="24" alt="@codebanditssss"> [@codebanditssss](https://github.com/codebanditssss) | 38 | 49 | 56 | | 🥈 | <img src="https://avatars.githubusercontent.com/u/44542765?u=4df62a1ca3b55473f46a507a586e3e4dddb019cc&v=4" width="24" height="24" alt="@illegalcall"> [@illegalcall](https://github.com/illegalcall) | 33 | 58 | 6 | | 🥉 | <img src="https://avatars.githubusercontent.com/u/96230495?u=3ab7514bc4e9916975900c211456c546a0867d64&v=4" width="24" height="24" alt="@nikhilachale"> [@nikhilachale](https://github.com/nikhilachale) | 18 | 45 | 3 | | 4 | <img src="https://avatars.githubusercontent.com/u/64074505?u=cab8d4e9a8a4b5bf79fe10ff06ea4f69b5cb2264&v=4" width="24" height="24" alt="@ronishrohan"> [@ronishrohan](http
  > @Prasad-D-Ware friendly nudge: if there's an issue this addresses, please link it (Fixes #N). If none exists, no action needed.

- **Issue #6000** (2026-09-29): **fix(mobile): show live desktop status in settings and hide disconnect when unpaired**
  *Symptoms*: ## Summary  Settings' **Connected desktop** row said "Paired" whenever an address was saved. So once the desktop stopped answering, it still read as fine directly above a **Test connection** row reporting "Your desktop disconnected". **Disconnect from desktop** was also shown even with nothing paired.  - **Live status row.** Driven by the store's `configured` + `connection` + `errorStatus` instead of a separately loaded config. Labels: Set up / Connecting… / Connected / Offline / Password rejected / Locked out / Desktop error / Address changed. The rotated-tunnel case uses the same rule as the board. - **Test connection re-races.** It calls `reloadConfig()` (every known endpoint) before pinging, instead of pinging only the last stored address. Afterwards it starts a poll in the background so the status row agrees, except after a rejection, where a second request would count toward the daemon's lockout. The spinner doesn't wait for that poll, which against a dead address would add another full request timeout. - **Disconnect only while paired.** Keyed on the saved pairing, not the live connection, so an offline desktop can still be forgotten. Settings waits for the store's first resolve, so the row never pops in after first paint. - **Failed disconnect is handled.** If `forgetServer()` throws, the config is re-resolved instead of an unhandled rejection leaving the screen stale. If the pairing survived, an alert asks to retry; if only leftovers failed, it carries on to onboardi
  **Post-Mortem & Fix Analysis**:
  > ## 🏆 Review leaderboard  Sep 21–28, 2026 · UTC  | Rank | Reviewer | PRs reviewed | Review rounds | PR comments | | :---: | --- | ---: | ---: | ---: | | 🥇 | <img src="https://avatars.githubusercontent.com/u/180498112?u=e5a56125b1eb089c8ce7c0800df23a20d559cd2c&v=4" width="24" height="24" alt="@codebanditssss"> [@codebanditssss](https://github.com/codebanditssss) | 38 | 49 | 56 | | 🥈 | <img src="https://avatars.githubusercontent.com/u/44542765?u=4df62a1ca3b55473f46a507a586e3e4dddb019cc&v=4" width="24" height="24" alt="@illegalcall"> [@illegalcall](https://github.com/illegalcall) | 33 | 58 | 6 | | 🥉 | <img src="https://avatars.githubusercontent.com/u/96230495?u=3ab7514bc4e9916975900c211456c546a0867d64&v=4" width="24" height="24" alt="@nikhilachale"> [@nikhilachale](https://github.com/nikhilachale) | 18 | 45 | 3 | | 4 | <img src="https://avatars.githubusercontent.com/u/64074505?u=cab8d4e9a8a4b5bf79fe10ff06ea4f69b5cb2264&v=4" width="24" height="24" alt="@ronishrohan"> [@ronishrohan](http
  > @Prasad-D-Ware friendly nudge: if there's an issue this addresses, please link it (Fixes #N). If none exists, no action needed.

- **Issue #5988** (2026-09-30): **fix(files): bound the commit list and read one PR commit directly**
  *Symptoms*: Code changes: +157 -65   Tests: +178 -1   Others: +14 -0 (generated OpenAPI spec and TS types)  Follow-up to #5936, for @kvnloo's [review comment](https://github.com/Untrivial-ai/agent-orchestrator/pull/5936#issuecomment-5859203907).  ## What  - **The commit list is bounded.** A Commits menu (the PR's and the Workspace's) now holds at most the newest 250 commits, and reads at most 2 MiB from each of its two `git log` passes. Both files responses report when older commits were left out: `commitsTruncated: true`. - **Opening a PR commit reads only that commit.** A file or revision read with `commitSha` no longer lists the whole PR. It checks that the SHA belongs to the PR, then reads that one commit, so a commit older than the cap still opens.  ## How  **Bounded list** (`gitCommitLogChanges`, shared by both menus) - `--max-count=251`: the extra commit tells a full list from a cut one. - Both passes go through `gitWorkspaceOutputCapped` with a 2 MiB cap, the same as the diff-group cap. 250 matches GitHub's pull request commits API. - A commit is listed whole or not at all. A pass that hits the cap drops the commit it stopped in. If the `--numstat` pass stopped before the `--name-status` pass, commits past its last whole one are dropped too; without counts, their text files would show as binary. - `commitsTruncated` is optional and omitted when false, so existing clients and TS fixtures are unaffected.  **Direct commit read** (`prCommitFile`) - Accepts only a full lowercase SHA (
  **Post-Mortem & Fix Analysis**:
  > ## 🏆 Review leaderboard  Sep 21–28, 2026 · UTC  | Rank | Reviewer | PRs reviewed | Review rounds | PR comments | | :---: | --- | ---: | ---: | ---: | | 🥇 | <img src="https://avatars.githubusercontent.com/u/180498112?u=e5a56125b1eb089c8ce7c0800df23a20d559cd2c&v=4" width="24" height="24" alt="@codebanditssss"> [@codebanditssss](https://github.com/codebanditssss) | 38 | 49 | 56 | | 🥈 | <img src="https://avatars.githubusercontent.com/u/44542765?u=4df62a1ca3b55473f46a507a586e3e4dddb019cc&v=4" width="24" height="24" alt="@illegalcall"> [@illegalcall](https://github.com/illegalcall) | 32 | 56 | 6 | | 🥉 | <img src="https://avatars.githubusercontent.com/u/96230495?u=3ab7514bc4e9916975900c211456c546a0867d64&v=4" width="24" height="24" alt="@nikhilachale"> [@nikhilachale](https://github.com/nikhilachale) | 17 | 44 | 4 | | 4 | <img src="https://avatars.githubusercontent.com/u/64074505?u=cab8d4e9a8a4b5bf79fe10ff06ea4f69b5cb2264&v=4" width="24" height="24" alt="@ronishrohan"> [@ronishrohan](http

- **Issue #5977** (2026-09-29): **fix(mobile): show user-facing errors instead of raw API and network text**
  *Symptoms*: ## Summary An audit of mobile error handling found that most screens rendered `error.message` as-is. Users saw wire strings like `409 Conflict - …`, `503 Service Unavailable`, or fetch's `Network request failed`. Only the board tabs and pairing flow used the human copy in `connectionError.ts`.  - **`userFacingError()`** (pure, in `connectionError.ts`) picks one sentence per failure:   - Desktop never answered: "Couldn't reach your desktop…"   - 401/403/429: the pairing copy.   - Other 4xx: the daemon's own message, without the status line.   - 5xx: generic copy plus the daemon's request ID for log lookup.   - It never renders a status code or reason phrase. - **Typed errors:** `req()` throws `UnreachableError` for timeouts and failed fetches. `ApiError` gains a `detail` field. `message` keeps its status prefix for logs and Sentry. - **Call sites:** chat, terminal banners, sheets, board row actions, notifications, preview, and interface switching all go through the helper. Removed "No AO server configured", "The daemon did not return…", and similar strings. - **Bug fix:** `spawnErrorCopy` passed an empty host and port, so an offline spawn read "Reached nothing at :.". - **Terminal:** status reads "Live" or "Reconnecting…" instead of `live`/`disconnected`/`error`. The daemon's raw Go terminal errors and exit codes are mapped to user copy (`session/terminalCopy.ts`). - **Desktop disconnected:** chat shows "Not connected to your desktop" and reloads when the board reconnects. The
  **Post-Mortem & Fix Analysis**:
  > ## 🏆 Review leaderboard  Sep 21–28, 2026 · UTC  | Rank | Reviewer | PRs reviewed | Review rounds | PR comments | | :---: | --- | ---: | ---: | ---: | | 🥇 | <img src="https://avatars.githubusercontent.com/u/180498112?u=e5a56125b1eb089c8ce7c0800df23a20d559cd2c&v=4" width="24" height="24" alt="@codebanditssss"> [@codebanditssss](https://github.com/codebanditssss) | 38 | 49 | 56 | | 🥈 | <img src="https://avatars.githubusercontent.com/u/44542765?u=4df62a1ca3b55473f46a507a586e3e4dddb019cc&v=4" width="24" height="24" alt="@illegalcall"> [@illegalcall](https://github.com/illegalcall) | 31 | 55 | 7 | | 🥉 | <img src="https://avatars.githubusercontent.com/u/96230495?u=3ab7514bc4e9916975900c211456c546a0867d64&v=4" width="24" height="24" alt="@nikhilachale"> [@nikhilachale](https://github.com/nikhilachale) | 18 | 45 | 5 | | 4 | <img src="https://avatars.githubusercontent.com/u/64074505?u=cab8d4e9a8a4b5bf79fe10ff06ea4f69b5cb2264&v=4" width="24" height="24" alt="@ronishrohan"> [@ronishrohan](http

- **Issue #5968** (2026-09-28): **fix(markdown): stop clipping heading anchor icon in rich preview**
  *Symptoms*: ## Summary The Rich preview for markdown files clipped the heading link (anchor) icon on hover. `github-markdown-css` positions `.markdown-body .anchor` with `margin-left: -20px`, but `MarkdownFileView` wrapped the body in only 16px of padding (`p-4`), so the icon overflowed the pane's left edge by 4px and got cut off.  This widens the inline padding to 24px (`px-6 py-4`), keeping vertical padding unchanged, and adds a comment explaining the constraint.  ## Tests - Not run locally (worktree has no `node_modules`); class-only change with no test asserting the old class.  ## Risks - Rendered markdown content is 16px narrower in total.  🤖 Generated with [Claude Code](https://claude.com/claude-code)
  **Post-Mortem & Fix Analysis**:
  > ## 🏆 Review leaderboard  Sep 21–28, 2026 · UTC  | Rank | Reviewer | PRs reviewed | Review rounds | PR comments | | :---: | --- | ---: | ---: | ---: | | 🥇 | <img src="https://avatars.githubusercontent.com/u/180498112?u=e5a56125b1eb089c8ce7c0800df23a20d559cd2c&v=4" width="24" height="24" alt="@codebanditssss"> [@codebanditssss](https://github.com/codebanditssss) | 38 | 49 | 56 | | 🥈 | <img src="https://avatars.githubusercontent.com/u/44542765?u=4df62a1ca3b55473f46a507a586e3e4dddb019cc&v=4" width="24" height="24" alt="@illegalcall"> [@illegalcall](https://github.com/illegalcall) | 30 | 54 | 7 | | 🥉 | <img src="https://avatars.githubusercontent.com/u/96230495?u=3ab7514bc4e9916975900c211456c546a0867d64&v=4" width="24" height="24" alt="@nikhilachale"> [@nikhilachale](https://github.com/nikhilachale) | 17 | 44 | 5 | | 4 | <img src="https://avatars.githubusercontent.com/u/64074505?u=cab8d4e9a8a4b5bf79fe10ff06ea4f69b5cb2264&v=4" width="24" height="24" alt="@ronishrohan"> [@ronishrohan](http
  > @AgentWrapper friendly nudge: if there's an issue this addresses, please link it (Fixes #N). If none exists, no action needed.

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

### Incident Patch 1: `ab5a2e37` (2026-09-30)
**Commit Message**: fix(frontend): mask leaked chrome above maximized files (#5860)

**File**: `frontend/src/renderer/native-composition-cascade.test.ts` (modified, +7/-0)
```diff
@@ -119,6 +119,13 @@ describe("native-composition transparency cascade", () => {
 		expect(frameRule?.body).toMatch(/right:\s*var\(--browser-popout-inline-inset\)/);
 	});
 
+	it("masks the reserved macOS titlebar band for the files popout", () => {
+		const maskRule = rules().find((rule) => rule.selector.endsWith(".files-popout-overlay--mac-windowed::before"));
+		expect(maskRule?.body).toMatch(/top:\s*calc\(-1 \* var\(--size-traffic-light-clearance\)\)/);
+		expect(maskRule?.body).toMatch(/height:\s*var\(--size-traffic-light-clearance\)/);
+		expect(maskRule?.body).toMatch(/background:\s*var\(--bg\)/);
+	});
+
 	it("shifts the browser address bar clear of the inspector tabs", () => {
 		const topbarRule = rules().find((rule) => rule.selector.endsWith(".session-inspector__topbar--browser"));
 		expect(topbarRule?.body).toMatch(
```

**File**: `frontend/src/renderer/styles.css` (modified, +17/-0)
```diff
@@ -4730,6 +4730,23 @@ body:has(#root .platform-windows) > .files-popout-overlay {
 	--browser-popout-top: var(--size-traffic-light-clearance);
 }
 
+/* The files popout has no titlebar row of its own. Its content starts below
+   the native traffic-light band, so without a mask the session topbar from
+   underneath the portal remains visible through that band (half of the row
+   is visible on macOS windowed maximization). Keep the reserved band opaque,
+   matching the browser popout's titlebar surface. */
+.files-popout-overlay--mac-windowed::before {
+	position: absolute;
+	top: calc(-1 * var(--size-traffic-light-clearance));
+	right: 0;
+	left: 0;
+	height: var(--size-traffic-light-clearance);
+	content: "";
+	background: var(--bg);
+	border-bottom: 1px solid var(--border);
+	pointer-events: none;
+}
+
 .browser-popout-overlay--mac-windowed {
 	--browser-popout-inline-inset: var(--size-center-panel-inset-mac);
 }
```

---

### Incident Patch 2: `4c5ca686` (2026-09-30)
**Commit Message**: fix(frontend): replace standalone quick launch with Cloud when enabled (#6077)

* fix(frontend): add Cloud action to empty home

* fix(frontend): keep Cloud visible with standalone sessions

* fix(frontend): swap standalone card when Cloud toggles are on

---------

Co-authored-by: AO Tests <ao@example.com>

**File**: `frontend/src/renderer/__tests__/_shell-index-home.test.tsx` (modified, +52/-1)
```diff
@@ -1,5 +1,6 @@
 import { act, fireEvent, render, screen } from "@testing-library/react";
 import { beforeEach, describe, expect, it, vi } from "vitest";
+import { useUiStore } from "../stores/ui-store";
 import {
 	STANDALONE_PROJECT_KIND,
 	STANDALONE_WORKSPACE_ID,
@@ -20,6 +21,7 @@ const routeMocks = vi.hoisted(() => ({
 	startGitHubAuth: vi.fn(),
 	markAutoLoginOffered: vi.fn(),
 	closeTerminal: vi.fn(),
+	cloudEnabled: false,
 }));
 
 vi.mock("@tanstack/react-router", async (importOriginal) => ({
@@ -31,6 +33,10 @@ vi.mock("../hooks/useWorkspaceQuery", () => ({
 	useWorkspaceQuery: () => ({ data: routeMocks.workspaces, isSuccess: true }),
 }));
 
+vi.mock("../hooks/useCloudGate", () => ({
+	useCloudGate: () => ({ cloudEnabled: routeMocks.cloudEnabled }),
+}));
+
 vi.mock("../hooks/useSystemRequirementsGate", () => ({
 	useSystemRequirementsGate: () => ({ blocked: false, requirements: routeMocks.requirements, query: { refetch: vi.fn() } }),
 	useGitHubAuthRequirement: () => ({ data: routeMocks.authRequirement, isFetching: false, refetch: vi.fn() }),
@@ -77,6 +83,7 @@ const standaloneSession = (overrides: Partial<WorkspaceSession>): WorkspaceSessi
 });
 
 beforeEach(() => {
+	useUiStore.setState({ developerMode: false, newTaskRequest: null });
 	routeMocks.navigate.mockReset();
 	routeMocks.workspaces = [];
 	routeMocks.createProjectFlowProps = null;
@@ -85,6 +92,7 @@ beforeEach(() => {
 	routeMocks.startGitHubAuth.mockReset();
 	routeMocks.markAutoLoginOffered.mockReset();
 	routeMocks.closeTerminal.mockReset();
+	routeMocks.cloudEnabled = false;
 });
 
 describe("shell index route", () => {
@@ -97,6 +105,7 @@ describe("shell index route", () => {
 		expect(screen.getByRole("button", { name: "Import an existing project" })).toBeInTheDocument();
 		expect(screen.getByRole("button", { name: "Import a workspace folder" })).toBeInTheDocument();
 		expect(screen.getByRole("button", { name: "New standalone agent" })).toBeInTheDocument();
+		expect(screen.queryByRole("button", { name: "New cloud project" })).not.toBeInTheDocument();
 		expect(screen.queryByText("Recent projects")).not.toBeInTheDocument();
 		expect(routeMocks.navigate).not.toHaveBeenCalled();
 	});
@@ -108,7 +117,48 @@ describe("shell index route", () => {
 		expect(routeMocks.createProjectFlowProps?.sourceSignal?.source).toBe("clone");
 	});
 
+	it("opens cloud project creation when Developer Mode and Cloud are enabled", () => {
+		useUiStore.setState({ developerMode: true });
+		routeMocks.cloudEnabled = true;
+		render(<HomePage />);
+
+		fireEvent.click(screen.getByRole("button", { name: "New cloud project" }));
+		expect(routeMocks.createProjectFlowProps?.sourceSignal?.source).toBe("cloud");
+		expect(screen.queryByRole("button", { name: "New standalone agent" })).not.toBeInTheDocument();
+	});
+
+	it.each([
+		{ developerMode: false, cloudEnabled: true },
+		{ developerMode: true, cloudEnabled: false },
+	])("keeps standalone creation when either toggle is off: %j", ({ developerMode, cloudEnabled }) => {
+		useUiStore.setState({ developerMode });
+		routeMocks.cloudEnabled = cloudEnabled;
+		render(<HomePage />);
+
+		fireEvent.click(screen.getByRole("button", { name: "New standalone agent" }));
+		expect(useUiStore.getState().newTaskRequest?.projectId).toBe(STANDALONE_WORKSPACE_ID);
+		expect(screen.queryByRole("button", { name: "New cloud project" })).not.toBeInTheDocument();
+	});
+
+	it("shows cloud creation when standalone sessions exist without a registered project", () => {
+		useUiStore.setState({ developerMode: true });
+		routeMocks.cloudEnabled = true;
+		routeMocks.workspaces = [{
+			id: STANDALONE_WORKSPACE_ID,
+			name: "Scratchpad",
+			kind: STANDALONE_PROJECT_KIND,
+			path: "Not attached to a project",
+			sessions: [standaloneSession({})],
+		}];
+		render(<HomePage />);
+
+		fireEvent.click(screen.getByRole("button", { name: "New cloud project" }));
+		expect(routeMocks.createProjectFlowProps?.sourceSignal?.source).toBe("cloud");
+	});

```

**File**: `frontend/src/renderer/components/CreateProjectFlow.test.tsx` (modified, +9/-0)
```diff
@@ -1598,6 +1598,15 @@ describe("CreateProjectFlow project import validation", () => {
 		expect(cloudMocks.signIn).toHaveBeenCalledOnce();
 	});
 
+	it("opens the Cloud sign-in flow directly from a home-page signal", async () => {
+		cloudMocks.cloudEnabled = true;
+		const view = render(<CreateProjectFlow mode="choose" sourceSignal={null} {...noop} />, { wrapper: CloudTestProviders });
+
+		view.rerender(<CreateProjectFlow mode="choose" sourceSignal={{ source: "cloud", nonce: 1 }} {...noop} />);
+
+		expect(await screen.findByText(/sign in to AO Cloud to create a cloud project/i)).toBeInTheDocument();
+	});
+
 	it("shows Cloud in a separate card above the local project sources", () => {
 		cloudMocks.cloudEnabled = true;
 		cloudMocks.sessionStatus = "authenticated";
```

**File**: `frontend/src/renderer/components/CreateProjectFlow.tsx` (modified, +8/-5)
```diff
@@ -181,8 +181,8 @@ export function CreateProjectFlow({
 	// "no project in scope" fallback). Lets the shortcut reuse the sidebar's own
 	// create-project flow instead of a separate delegating component.
 	openSignal?: number;
-	// Home-page action cards: each new nonce jumps straight to clone/local/workspace.
-	sourceSignal?: { source: ProjectSource; nonce: number } | null;
+	// Home-page action cards: each new nonce jumps straight to its source.
+	sourceSignal?: { source: ProjectSource | "cloud"; nonce: number } | null;
 }) {
 	const { t } = useTranslation();
 	const resolvedIdleLabel = idleLabel ?? t("createProject.newProject");
@@ -433,10 +433,9 @@ export function CreateProjectFlow({
 		}
 	};
 
-	const startFlow = (presetPath?: string) => {
+	const startFlow = (presetPath?: string, initialOffering: ProjectOffering = "local") => {
 		setPendingDropPath(presetPath ?? null);
-		// Each entry starts on the default Local choice, never a leftover Cloud one.
-		setOffering("local");
+		setOffering(initialOffering);
 		resetProjectImportState();
 		setCloneDetails(initialCloneDetails());
 		if (hasModePicker) {
@@ -478,6 +477,10 @@ export function CreateProjectFlow({
 		if (!sourceSignal || sourceSignal.nonce === lastSourceNonce.current) return;
 		lastSourceNonce.current = sourceSignal.nonce;
 		if (isBusy || modePickerOpen || cloneDialogOpen || folderPickerOpen || selectedPath !== null) return;
+		if (sourceSignal.source === "cloud") {
+			if (cloudEnabled) startFlow(undefined, "cloud");
+			return;
+		}
 		void selectSource(sourceSignal.source);
 	}, [sourceSignal]);
 
```

**File**: `frontend/src/renderer/components/HomePage.tsx` (modified, +23/-11)
```diff
@@ -1,8 +1,9 @@
 import type { ProjectSource } from "@aoagents/product-ui";
 import { useNavigate } from "@tanstack/react-router";
 import { useTranslation } from "react-i18next";
-import { AlertTriangle, Bot, Folder, Folders, FolderOpen, GitFork, Star } from "lucide-react";
+import { AlertTriangle, Bot, Cloud, Folder, Folders, FolderOpen, GitFork, Star } from "lucide-react";
 import { useMemo, useState, type ReactNode } from "react";
+import { useCloudGate } from "../hooks/useCloudGate";
 import { useSystemRequirementsGate } from "../hooks/useSystemRequirementsGate";
 import { useWorkspaceQuery } from "../hooks/useWorkspaceQuery";
 import { aoBridge } from "../lib/bridge";
@@ -28,8 +29,9 @@ import { Badge } from "./ui/badge";
  * - One centered column (`max-w-[640px]`); no upward translate hack.
  * - "Star us" is a quiet text link with dashed underline on hover — NOT a
  *   TopbarButton / accent pill / bordered card.
- * - Primary actions are a 2×2 grid; standalone agent lives IN the grid (not a
- *   full-width accent CTA above). Connect Mobile is settings-only — not here.
+ * - Primary actions are a 2×2 grid; Cloud replaces the standalone-agent action
+ *   in the fourth cell when Developer Mode and Cloud are enabled.
+ *   Connect Mobile is settings-only — not here.
  * - Recent rows use shared {@link NavRowHighlight} (same as sidebar), not a
  *   flat `hover:bg-interactive-hover` wash.
  * - Section titles share {@link HOME_SECTION_TITLE_CLASS}. With no projects the
@@ -157,11 +159,13 @@ export function HomePage() {
 	const navigate = useNavigate();
 	const { t } = useTranslation();
 	const requestNewTask = useUiStore((state) => state.requestNewTask);
+	const developerMode = useUiStore((state) => state.developerMode);
 	const { cloneProject, createProject, daemonStatus, initializeProjectRepository, workspaceStartupState } =
 		useShell();
 	const { blocked: requirementsBlocked } = useSystemRequirementsGate();
+	const { cloudEnabled } = useCloudGate();
 	const workspaceQuery = useWorkspaceQuery();
-	const [sourceSignal, setSourceSignal] = useState<{ source: ProjectSource; nonce: number } | null>(null);
+	const [sourceSignal, setSourceSignal] = useState<{ source: ProjectSource | "cloud"; nonce: number } | null>(null);
 	const projects = workspaceQuery.data ?? [];
 	const recentProjects = useMemo(() => sortProjectsByActivity(projects).slice(0, RECENT_PROJECT_LIMIT), [projects]);
 
@@ -176,7 +180,7 @@ export function HomePage() {
 
 	if (showStartup) return <DaemonStartupLoader />;
 
-	const requestSource = (source: ProjectSource) => {
+	const requestSource = (source: ProjectSource | "cloud") => {
 		setSourceSignal({ source, nonce: Date.now() });
 	};
 
@@ -214,7 +218,7 @@ export function HomePage() {
 							</button>
 						</div>
 
-						{/* 2×2 action grid; standalone agent is a cell here, not a hero CTA above. */}
+						{/* Cloud replaces the standalone action in the same grid cell when enabled. */}
 						<div className="grid grid-cols-2 gap-3">
 							<HomeActionCard
 								icon={<GitFork strokeWidth={1.8} />}
@@ -231,11 +235,19 @@ export function HomePage() {
 								label={t("createProject.addWorkspace")}
 								onClick={() => requestSource("workspace")}
 							/>
-							<HomeActionCard
-								icon={<Bot strokeWidth={1.8} />}
-								label={t("home.newStandaloneAgent")}
-								onClick={() => requestNewTask(STANDALONE_WORKSPACE_ID)}
-							/>
+							{developerMode && cloudEnabled ? (
+								<HomeActionCard
+									icon={<Cloud strokeWidth={1.8} />}
+									label={t("createProject.cloudTitle")}
+									onClick={() => requestSource("cloud")}
+								/>
+							) : (
+								<HomeActionCard
+									icon={<Bot strokeWidth={1.8} />}
+									label={t("home.newStandaloneAgent")}
+									onClick={() => requestNewTask(STANDALONE_WORKSPACE_ID)}
+								/>
+							)}
 						</div>
 					</section>
 
```

---

### Incident Patch 3: `902cefc6` (2026-09-30)
**Commit Message**: fix(settings): hide gated tracker intake controls (#6059)

* feat(settings): report the AO_TRACKER_INTAKE gate to clients

The daemon knew whether intake was gated off; no client did. GET
/api/v1/settings returned localEnabled, cloudOffering and cloudEnabled but
nothing about tracker intake, so the renderer had no way to tell that a
per-project intake toggle could not do anything.

Carries cfg.TrackerIntake through settings.Offering and out as
trackerIntakeEnabled, the same route AO_LOCAL_OFFERING already takes.
OpenAPI and schema.ts regenerated, one line each.

Read-only and boot-resolved, like its siblings: Offering is assigned once
in New with no setter, and AO_TRACKER_INTAKE is read only by config.Load,
so nothing can flip the gate in a live process. There is deliberately no
PATCH route for it.

* fix(settings): hide the intake section when the daemon gate is off

The project settings Issues section still offered "Enable issue intake",
subtitled "Auto-spawn worker sessions from matching tracker issues", while
AO_TRACKER_INTAKE was off. Ticking it saved, read back, and spawned
nothing, with no signal anywhere a desktop user could see. Same for the
create-project sheet.

Hidden r

**File**: `backend/internal/httpd/apispec/openapi.yaml` (modified, +3/-0)
```diff
@@ -13911,6 +13911,8 @@ components:
           type: string
         localEnabled:
           type: boolean
+        trackerIntakeEnabled:
+          type: boolean
       required:
       - defaultSessionMode
       - chatHarnesses
@@ -13919,6 +13921,7 @@ components:
       - cloudOffering
       - cloudEnabled
       - cloudControlPlaneUrl
+      - trackerIntakeEnabled
       type: object
     ShellTerminalEnvelope:
       properties:
```

**File**: `backend/internal/httpd/controllers/dto.go` (modified, +3/-0)
```diff
@@ -2836,6 +2836,9 @@ type SettingsResponse struct {
 	// CloudControlPlaneURL is the cloud control plane base URL; empty when no
 	// control plane is configured.
 	CloudControlPlaneURL string `json:"cloudControlPlaneUrl"`
+	// TrackerIntakeEnabled reports the AO_TRACKER_INTAKE gate, so a client can
+	// avoid offering a per-project intake control the daemon will ignore.
+	TrackerIntakeEnabled bool `json:"trackerIntakeEnabled"`
 }
 
 // AgentInstallerCatalogResponse is the body of GET /api/v1/agents/installers.
```

**File**: `backend/internal/httpd/controllers/settings.go` (modified, +1/-0)
```diff
@@ -116,5 +116,6 @@ func (c *SettingsController) response(snapshot settingssvc.Snapshot) SettingsRes
 		CloudOffering:        snapshot.CloudOffering,
 		CloudEnabled:         offering.CloudEnabled(snapshot),
 		CloudControlPlaneURL: offering.CloudControlPlaneURL,
+		TrackerIntakeEnabled: offering.TrackerIntakeEnabled,
 	}
 }
```

**File**: `backend/internal/service/settings/service.go` (modified, +4/-0)
```diff
@@ -46,6 +46,9 @@ type Offering struct {
 	// CloudControlPlaneURL is the cloud control plane base URL; empty when
 	// no control plane is configured.
 	CloudControlPlaneURL string
+	// TrackerIntakeEnabled reports the AO_TRACKER_INTAKE gate. Clients need it
+	// to avoid offering a per-project intake control the daemon will ignore.
+	TrackerIntakeEnabled bool
 }
 
 // OfferingFromConfig derives the offering gates from daemon config.
@@ -55,6 +58,7 @@ func OfferingFromConfig(cfg config.Config) Offering {
 		LocalEnabled:         cfg.LocalOffering,
 		CloudForced:          cfg.CloudOffering,
 		CloudControlPlaneURL: cfg.CloudControlPlaneURL,
+		TrackerIntakeEnabled: cfg.TrackerIntake,
 	}
 }
 
```

**File**: `backend/internal/service/settings/service_test.go` (modified, +14/-1)
```diff
@@ -1,6 +1,19 @@
 package settings
 
-import "testing"
+import (
+	"testing"
+
+	"github.com/aoagents/agent-orchestrator/backend/internal/config"
+)
+
+func TestOfferingFromConfigCarriesTrackerIntake(t *testing.T) {
+	for _, on := range []bool{true, false} {
+		got := OfferingFromConfig(config.Config{TrackerIntake: on})
+		if got.TrackerIntakeEnabled != on {
+			t.Errorf("OfferingFromConfig(TrackerIntake=%v).TrackerIntakeEnabled = %v, want %v", on, got.TrackerIntakeEnabled, on)
+		}
+	}
+}
 
 // The cloud gate is the single most safety-critical expression in the offering:
 // a false positive would surface cloud UI (and let a local-only build reach a
```

---

### Incident Patch 4: `d4b84409` (2026-09-30)
**Commit Message**: fix(files): bound the commit history read and open one commit directly (#5988)

The Files commit menus (a PR's and the Workspace's) ran two uncapped git log
passes over the whole range, and opening a file from a PR commit re-read that
entire history to find one commit.

- gitCommitLogChanges lists at most 250 commits and keeps at most 2 MiB of
  each pass's output, leaving out any commit either pass read only in part.
  commitsTruncated on both files responses says older commits were left out.
- prCommitFile checks the SHA is a full object name inside base..head, then
  reads only that commit (<sha>^!), so a commit past the cap still opens.
- The capped git helper now sets the same no-prompt environment as the
  uncapped one.

Co-authored-by: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `backend/internal/httpd/apispec/openapi.yaml` (modified, +10/-0)
```diff
@@ -12007,6 +12007,11 @@ components:
           items:
             $ref: '#/components/schemas/WorkspaceCommitSummary'
           type: array
+        commitsTruncated:
+          description: 'True when older commits were left out of commits: the list
+            keeps the newest 250, and stops at the last commit whose changes fit the
+            daemon''s size cap.'
+          type: boolean
         files:
           items:
             $ref: '#/components/schemas/WorkspaceFileSummary'
@@ -12115,6 +12120,11 @@ components:
           items:
             $ref: '#/components/schemas/WorkspaceCommitSummary'
           type: array
+        commitsTruncated:
+          description: 'True when older commits were left out of commits: the list
+            keeps the newest 250, and stops at the last commit whose changes fit the
+            daemon''s size cap.'
+          type: boolean
         compareBaseRef:
           type: string
         compareBaseSha:
```

**File**: `backend/internal/httpd/controllers/dto.go` (modified, +7/-5)
```diff
@@ -512,8 +512,9 @@ type ListWorkspaceFilesResponse struct {
 	// (multi-repo) and scratch sessions.
 	Sections WorkspaceFileSections `json:"sections"`
 	// Commits are the commits between the compare base and HEAD, newest first.
-	Commits []WorkspaceCommitSummary `json:"commits"`
-	Summary WorkspaceSummary         `json:"summary"`
+	Commits          []WorkspaceCommitSummary `json:"commits"`
+	CommitsTruncated bool                     `json:"commitsTruncated,omitempty" description:"True when older commits were left out of commits: the list keeps the newest 250, and stops at the last commit whose changes fit the daemon's size cap."`
+	Summary          WorkspaceSummary         `json:"summary"`
 	// Degraded indicates that the primary file list is available but optional
 	// Git-state enrichment failed and can be retried.
 	Degraded     bool   `json:"degraded"`
@@ -530,9 +531,10 @@ type ListPRFilesResponse struct {
 	Files     []WorkspaceFileSummary `json:"files"`
 	// Commits are the pull request's own commits (base..head), newest first.
 	// File sizes are not read for commit files.
-	Commits   []WorkspaceCommitSummary `json:"commits"`
-	Truncated bool                     `json:"truncated"`
-	Summary   WorkspaceSummary         `json:"summary"`
+	Commits          []WorkspaceCommitSummary `json:"commits"`
+	CommitsTruncated bool                     `json:"commitsTruncated,omitempty" description:"True when older commits were left out of commits: the list keeps the newest 250, and stops at the last commit whose changes fit the daemon's size cap."`
+	Truncated        bool                     `json:"truncated"`
+	Summary          WorkspaceSummary         `json:"summary"`
 }
 
 // WorkspaceFileSections groups a session workspace's changed files by git
```

**File**: `backend/internal/httpd/controllers/sessions.go` (modified, +7/-5)
```diff
@@ -2232,6 +2232,7 @@ func workspaceFilesResponse(files sessionsvc.WorkspaceFiles) ListWorkspaceFilesR
 		Truncated:        files.Truncated,
 		Sections:         workspaceFileSectionsResponse(files.Sections),
 		Commits:          workspaceCommitsResponse(files.Commits),
+		CommitsTruncated: files.CommitsTruncated,
 		Summary:          WorkspaceSummary(files.Summary),
 		Degraded:         files.Degraded,
 		DegradedCode:     files.DegradedCode,
@@ -2242,11 +2243,12 @@ func workspaceFilesResponse(files sessionsvc.WorkspaceFiles) ListWorkspaceFilesR
 
 func prFilesResponse(files sessionsvc.PRFiles) ListPRFilesResponse {
 	return ListPRFilesResponse{
-		SessionID: files.SessionID,
-		Files:     workspaceFileSummariesResponse(files.Files),
-		Commits:   workspaceCommitsResponse(files.Commits),
-		Truncated: files.Truncated,
-		Summary:   WorkspaceSummary(files.Summary),
+		SessionID:        files.SessionID,
+		Files:            workspaceFileSummariesResponse(files.Files),
+		Commits:          workspaceCommitsResponse(files.Commits),
+		CommitsTruncated: files.CommitsTruncated,
+		Truncated:        files.Truncated,
+		Summary:          WorkspaceSummary(files.Summary),
 	}
 }
 
```

**File**: `backend/internal/httpd/controllers/sessions_test.go` (modified, +7/-1)
```diff
@@ -2641,6 +2641,7 @@ func TestSessionsAPI_ListWorkspaceFiles(t *testing.T) {
 			{Path: "README.md", Status: sessionsvc.WorkspaceFileModified, Additions: 2, Deletions: 1, Size: 48, Editable: true},
 			{Path: "notes.txt", PreviousPath: "old-notes.txt", Status: sessionsvc.WorkspaceFileRenamed, Additions: 1, Size: 11},
 		},
+		CommitsTruncated: true,
 	}
 	srv := newSessionTestServer(t, svc)
 
@@ -2663,9 +2664,10 @@ func TestSessionsAPI_ListWorkspaceFiles(t *testing.T) {
 			Size         int64  `json:"size"`
 			Editable     bool   `json:"editable"`
 		} `json:"files"`
+		CommitsTruncated bool `json:"commitsTruncated"`
 	}
 	mustJSON(t, body, &got)
-	if got.SessionID != "ao-1" || len(got.Files) != 2 {
+	if got.SessionID != "ao-1" || len(got.Files) != 2 || !got.CommitsTruncated {
 		t.Fatalf("response = %#v", got)
 	}
 	if got.CompareMode != "base" || got.CompareBaseSHA != "base-sha" || got.CompareBaseRef != "main" {
@@ -2693,6 +2695,7 @@ func TestSessionsAPI_ListPRFiles(t *testing.T) {
 			Author:  "Ada",
 			Files:   []sessionsvc.WorkspaceFileSummary{{Path: "README.md", Status: sessionsvc.WorkspaceFileModified, Additions: 1}},
 		}},
+		CommitsTruncated: true,
 	}
 	srv := newSessionTestServer(t, svc)
 	body, status, _ := doRequest(t, srv, "GET", "/api/v1/sessions/ao-1/pr/42/files", "")
@@ -2709,6 +2712,9 @@ func TestSessionsAPI_ListPRFiles(t *testing.T) {
 	if len(got.Commits) != 1 || got.Commits[0].SHA != "abc123" || len(got.Commits[0].Files) != 1 || got.Commits[0].Files[0].Path != "README.md" {
 		t.Fatalf("commits = %+v, want abc123 changing README.md", got.Commits)
 	}
+	if !got.CommitsTruncated {
+		t.Fatal("commitsTruncated = false, want the service's truncated commit list flagged")
+	}
 }
 
 func TestSessionsAPI_GetPRFileAtCommit(t *testing.T) {
```

**File**: `backend/internal/service/session/pr_files.go` (modified, +61/-26)
```diff
@@ -3,6 +3,7 @@ package session
 import (
 	"context"
 	"fmt"
+	"regexp"
 	"sort"
 	"strconv"
 	"strings"
@@ -17,9 +18,11 @@ type PRFiles struct {
 	SessionID domain.SessionID
 	Files     []WorkspaceFileSummary
 	// Commits are the PR's own commits (base..head), newest first.
-	Commits   []CommitSummary
-	Truncated bool
-	Summary   WorkspaceSummary
+	Commits []CommitSummary
+	// CommitsTruncated means older commits were left out of Commits.
+	CommitsTruncated bool
+	Truncated        bool
+	Summary          WorkspaceSummary
 }
 
 // ListPRFiles returns the committed changed-file set for an associated PR.
@@ -58,8 +61,8 @@ func (s *Service) ListPRFiles(ctx context.Context, id domain.SessionID, number i
 	}
 	// The commit list is best-effort: a PR whose files load still opens, just
 	// without its per-commit menu, if its log cannot be read.
-	commits, _ := prCommitLog(ctx, root, pr)
-	return PRFiles{SessionID: id, Files: files, Commits: commits, Truncated: truncated, Summary: workspaceSummaryFromFiles(files)}, nil
+	commits, commitsTruncated, _ := prCommitLog(ctx, root, pr)
+	return PRFiles{SessionID: id, Files: files, Commits: commits, CommitsTruncated: commitsTruncated, Truncated: truncated, Summary: workspaceSummaryFromFiles(files)}, nil
 }
 
 // GetPRFileAtCommit returns one file's immutable snapshot and patch for a
@@ -230,14 +233,21 @@ func readPRFileRevision(ctx context.Context, root string, id domain.SessionID, r
 	return result, nil
 }
 
-// prCommitLog lists the PR's own commits (base..head), newest first. Like the
-// rest of the PR read model it reads revisions only, never the session
-// worktree, so file sizes are left unset: the list only picks and filters
-// files, and reading a file reports its real size.
-func prCommitLog(ctx context.Context, root string, pr domain.PullRequest) ([]CommitSummary, error) {
-	commits, changes, counts, err := gitCommitLogChanges(ctx, root, pr.BaseSHA+".."+pr.HeadSHA)
+// prCommitLog lists the PR's own commits (base..head), newest first, up to
+// maxCommitLogCommits of them. truncated reports that older commits were left
+// out.
+func prCommitLog(ctx context.Context, root string, pr domain.PullRequest) ([]CommitSummary, bool, error) {
+	return prCommits(ctx, root, pr.BaseSHA+".."+pr.HeadSHA, maxCommitLogCommits)
+}
+
+// prCommits reads up to maxCommits commits in revRange with their changed
+// files. Like the rest of the PR read model it reads revisions only, never the
+// session worktree, so file sizes are left unset: the list only picks and
+// filters files, and reading a file reports its real size.
+func prCommits(ctx context.Context, root, revRange string, maxCommits int) ([]CommitSummary, bool, error) {
+	commits, changes, counts, truncated, err := gitCommitLogChanges(ctx, root, revRange, maxCommits, maxCommitLogBytes)
 	if err != nil {
-		return nil, unavailablePRSource()
+		return nil, false, unavailablePRSource()
 	}
 	for i := range commits {
 		change := changes[commits[i].SHA]
@@ -254,30 +264,55 @@ func prCommitLog(ctx context.Context, root string, pr domain.PullRequest) ([]Com
 		}
 		commits[i].Files = files
 	}
-	return commits, nil
+	return commits, truncated, nil
 }
 
 // prCommitFile resolves one of the PR's own commits and the file rel within
 // it. A SHA outside base..head is rejected, so a commit view never reads
-// revisions the selected PR does not contain.
+// revisions the selected PR does not contain. Only the selected commit is read,
+// never the PR's whole history, so a commit older than the Commits menu's cap
+// still resolves.
 func prCommitFile(ctx context.Context, root string, pr domain.PullRequest, rawSHA, rel string) (CommitSummary, WorkspaceFileSummary, error) {
-	commits, err := prCommitLog(ctx, root, pr)
+	sha := strings.TrimSpace(rawSHA)
+	if !prContainsCommit(ctx, root, pr, sha) {
+		return CommitSummary{}, WorkspaceFileSummary{}, apierr.NotFound("PR_COMMIT_NOT_FOUND", "Commit is not part of the selected pull request")
+	}
+	// <sha>
```

---

### Incident Patch 5: `f912eac7` (2026-09-30)
**Commit Message**: fix(build): use system bsdtar for Windows ACP runtime (#6065)

**File**: `frontend/scripts/build-acp-runtime-helpers.mjs` (modified, +9/-3)
```diff
@@ -1,5 +1,5 @@
 import { mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
-import { join } from "node:path";
+import { join, win32 } from "node:path";
 
 const ROOT_BUILD_TOOLS = ["corepack", "corepack.cmd", "npm", "npm.cmd", "npx", "npx.cmd"];
 const BIN_BUILD_TOOLS = ["corepack", "npm", "npx"];
@@ -152,15 +152,21 @@ function removeFile(path) {
 	}
 }
 
-export function archiveExtraction(archivePath, workDir, { platform = process.platform } = {}) {
+export function archiveExtraction(
+	archivePath,
+	workDir,
+	{ platform = process.platform, systemRoot = process.env.SystemRoot } = {},
+) {
 	// Windows ships bsdtar as System32\tar.exe and it reads zip. PowerShell's
 	// Expand-Archive is the obvious alternative but is bound by MAX_PATH: with
 	// LongPathsEnabled=0 and a deep checkout, Node's bundled npm tree exceeds
 	// 260 characters and extraction fails without a non-zero exit, so the build
 	// only discovers it later, as a missing directory. bsdtar handles the same
 	// archive at the same depth.
 	if (platform === "win32") {
-		return { command: "tar.exe", args: ["-xf", archivePath, "-C", workDir] };
+		if (!systemRoot) throw new Error("SystemRoot is required for Windows archive extraction");
+		// Git Bash can put GNU tar ahead of System32 on PATH.
+		return { command: win32.join(systemRoot, "System32", "tar.exe"), args: ["-xf", archivePath, "-C", workDir] };
 	}
 	return { command: "tar", args: ["-xzf", archivePath, "-C", workDir] };
 }
```

**File**: `frontend/scripts/build-acp-runtime-helpers.test.mjs` (modified, +7/-4)
```diff
@@ -225,9 +225,12 @@ describe("archiveExtraction", () => {
 	// MAX_PATH, and with LongPathsEnabled=0 a deep checkout pushes Node's bundled
 	// npm tree past 260 characters, where it fails while still exiting zero.
 	it("uses bsdtar for the Windows zip", () => {
-		expect(archiveExtraction("C:\w\node.zip", "C:\w", { platform: "win32" })).toEqual({
-			command: "tar.exe",
-			args: ["-xf", "C:\w\node.zip", "-C", "C:\w"],
+		expect(archiveExtraction("C:\\w\\node.zip", "C:\\w", {
+			platform: "win32",
+			systemRoot: "C:\\Windows",
+		})).toEqual({
+			command: "C:\\Windows\\System32\\tar.exe",
+			args: ["-xf", "C:\\w\\node.zip", "-C", "C:\\w"],
 		});
 	});
 
@@ -242,7 +245,7 @@ describe("archiveExtraction", () => {
 
 	it("never shells out to a command interpreter", () => {
 		for (const platform of ["win32", "darwin", "linux"]) {
-			const { command } = archiveExtraction("/w/a", "/w", { platform });
+			const { command } = archiveExtraction("/w/a", "/w", { platform, systemRoot: "C:\\Windows" });
 			expect(command).not.toMatch(/powershell|cmd\.exe|\bsh\b/i);
 		}
 	});
```

---

### Incident Patch 6: `8de638ad` (2026-09-30)
**Commit Message**: fix(session-manager): stop kill stranding a session it cannot fully tear down (#5645)

* fix(session-manager): stop kill stranding a session it cannot fully tear down

`ao session kill` recorded terminal intent as its last step, so any teardown
failure returned before `terminated` was set. `ao session cleanup` only walks
terminated sessions, so the row it refused to mark was the row cleanup refused
to see: the session stayed on the board with no path out, and every retry
returned the same INTERNAL_ERROR.

Two failure classes reached that state and neither protects live work:

- A workspace teardown refusal AO had no typed name for. Only ErrWorkspaceDirty,
  ErrWorkspaceRepoUnavailable and ErrWorkspaceDeferred were tolerated; a locked
  worktree git will not prune, or any other registration leftover, failed the
  kill. Destroy never force-removes, so the worktree was already being preserved
  either way — all that differed was whether the session row survived with it.
  Every workspace failure now preserves the worktree and terminates the session,
  leaving `ao session cleanup` to retry the release and name the reason.
- A runtime Destroy that proves nothing about a live process
  (

**File**: `backend/internal/integration/session_kill_stranded_test.go` (added, +137/-0)
```diff
@@ -0,0 +1,137 @@
+package integration
+
+import (
+	"context"
+	"os"
+	"os/exec"
+	"path/filepath"
+	"testing"
+	"time"
+
+	"github.com/aoagents/agent-orchestrator/backend/internal/adapters/workspace/gitworktree"
+	"github.com/aoagents/agent-orchestrator/backend/internal/domain"
+	"github.com/aoagents/agent-orchestrator/backend/internal/lifecycle"
+	"github.com/aoagents/agent-orchestrator/backend/internal/ports"
+	sessionmanager "github.com/aoagents/agent-orchestrator/backend/internal/session_manager"
+	"github.com/aoagents/agent-orchestrator/backend/internal/storage/sqlite/sqlitetest"
+)
+
+func runGit(t *testing.T, git, dir string, args ...string) {
+	t.Helper()
+	cmd := exec.Command(git, args...)
+	cmd.Dir = dir
+	if out, err := cmd.CombinedOutput(); err != nil {
+		t.Fatalf("git %v: %v\n%s", args, err, out)
+	}
+}
+
+// seedOriginClone builds a clone with a resolvable default branch, which is
+// what the gitworktree adapter requires before it will create a worktree.
+func seedOriginClone(t *testing.T, git, tmp string) string {
+	t.Helper()
+	origin := filepath.Join(tmp, "origin.git")
+	seed := filepath.Join(tmp, "seed")
+	repo := filepath.Join(tmp, "repo")
+	runGit(t, git, tmp, "init", "--bare", origin)
+	runGit(t, git, tmp, "init", seed)
+	runGit(t, git, seed, "config", "user.email", "ao@example.com")
+	runGit(t, git, seed, "config", "user.name", "Ao Agents")
+	if err := os.WriteFile(filepath.Join(seed, "README.md"), []byte("seed\n"), 0o644); err != nil {
+		t.Fatal(err)
+	}
+	runGit(t, git, seed, "add", "README.md")
+	runGit(t, git, seed, "commit", "-m", "seed")
+	runGit(t, git, seed, "branch", "-M", "main")
+	runGit(t, git, seed, "remote", "add", "origin", origin)
+	runGit(t, git, seed, "push", "-u", "origin", "main")
+	runGit(t, git, origin, "symbolic-ref", "HEAD", "refs/heads/main")
+	runGit(t, git, tmp, "clone", origin, repo)
+	runGit(t, git, repo, "config", "user.email", "ao@example.com")
+	runGit(t, git, repo, "config", "user.name", "Ao Agents")
+	return repo
+}
+
+// TestKillAndCleanupReachASessionGitWillNotRelease is the #5463 regression
+// against real git, which no fake workspace can stand in for: a worktree
+// directory that disappeared out of band while git still holds a lock on the
+// registration. `git worktree remove` refuses it, `git worktree prune` declines
+// to clear it, and the adapter reports a refusal AO has no typed name for.
+//
+// That used to fail the kill, which left `terminated` false — and since
+// `ao session cleanup` only walks terminated sessions, the row was reachable by
+// no path at all and stayed on the board forever.
+func TestKillAndCleanupReachASessionGitWillNotRelease(t *testing.T) {
+	git, err := exec.LookPath("git")
+	if err != nil {
+		t.Skip("git not available")
+	}
+	ctx := context.Background()
+	tmp := t.TempDir()
+	repo := seedOriginClone(t, git, tmp)
+
+	workspace, err := gitworktree.New(gitworktree.Options{
+		Binary:       git,
+		ManagedRoot:  filepath.Join(tmp, "managed"),
+		RepoResolver: gitworktree.StaticRepoResolver{"mer": repo},
+	})
+	if err != nil {
+		t.Fatal(err)
+	}
+	store, err := sqlitetest.Open(t.TempDir())
+	if err != nil {
+		t.Fatal(err)
+	}
+	t.Cleanup(func() { _ = store.Close() })
+	if err := store.UpsertProject(ctx, domain.ProjectRecord{
+		ID: "mer", Path: repo, RegisteredAt: time.Now(),
+		Config: domain.ProjectConfig{
+			Worker:       domain.RoleOverride{Harness: domain.HarnessClaudeCode},
+			Orchestrator: domain.RoleOverride{Harness: domain.HarnessClaudeCode},
+		},
+	}); err != nil {
+		t.Fatal(err)
+	}
+	messenger := &captureMessenger{}
+	lcm := lifecycle.New(store, messenger)
+	manager := sessionmanager.New(sessionmanager.Deps{
+		Runtime: &stubRuntime{}, Agents: stubAgents{}, Workspace: workspace, Store: store,
+		Messenger: messenger, Lifecycle: lcm,
+		LookPath: func(string) (string, error) { return "/usr/bin/true", nil },
+	})
+	lcm.SetCompletionTerminator(manager)
+
+	sess, _, _, err := manager.Spawn(ctx, ports.SpawnConfig{Proje
```

**File**: `backend/internal/session_manager/manager.go` (modified, +73/-52)
```diff
@@ -430,6 +430,9 @@ type Manager struct {
 	backgroundWorkers sync.WaitGroup
 	asyncChatSpawnsMu sync.Mutex
 	asyncChatSpawns   map[domain.SessionID]*asyncChatSpawnRun
+	// killTeardown bounds Kill's detached teardown. Zero means
+	// killTeardownBudget; tests shrink it to prove what survives its expiry.
+	killTeardown time.Duration
 	// openTranscriptFile is os.Open in production. The narrow seam lets tests
 	// deterministically prove that a post-stop transcript read failure falls
 	// back without advertising the provider path.
@@ -2096,20 +2099,30 @@ func (m *Manager) RollbackSpawn(ctx context.Context, id domain.SessionID) (delet
 	return m.rollbackSpawn(ctx, id)
 }
 
-// workspacePreserved reports a teardown refusal that must not fail the kill.
-// All three cases leave the directory on disk and none is the user's problem to
-// resolve before the session can go away: uncommitted work is deliberately
-// never force-removed, a project whose repository has been deleted can never
-// have its worktree reclaimed by git at all, and a directory still pinned by a
-// process handle (Windows sharing violation) is deferred for a later cleanup
-// pass rather than unlinked mid-kill. Erroring instead strands the session in
-// the sidebar forever, which is the one outcome a delete must not produce.
-func workspacePreserved(err error) bool {
+// expectedWorkspaceRefusal reports a teardown refusal AO already has a name
+// for: uncommitted work that is deliberately never force-removed, a project
+// whose repository has been deleted, or a directory still pinned by a process
+// handle (Windows sharing violation). It only decides log volume — every
+// workspace teardown failure preserves the worktree, named or not.
+func expectedWorkspaceRefusal(err error) bool {
 	return errors.Is(err, ports.ErrWorkspaceDirty) ||
 		errors.Is(err, ports.ErrWorkspaceRepoUnavailable) ||
 		errors.Is(err, ports.ErrWorkspaceDeferred)
 }
 
+// terminateWithPreservedWorkspace records terminal intent for a session whose
+// workspace could not be released. Nothing was force-removed, so the worktree
+// is still on disk for `ao session cleanup` to retry and report on; what must
+// not survive is the session's claim on the sidebar. dropRestoreMarker is false
+// only for workspace projects, whose rows are left as non-restorable inventory
+// for the same retry.
+func (m *Manager) terminateWithPreservedWorkspace(ctx context.Context, id domain.SessionID, cause error, dropRestoreMarker bool) error {
+	if cause != nil && !expectedWorkspaceRefusal(cause) {
+		m.logger.Warn("kill: workspace teardown failed; worktree preserved", "sessionID", id, "error", cause)
+	}
+	return m.recordTermination(ctx, id, dropRestoreMarker)
+}
+
 // killTeardownBudget bounds the detached teardown Kill runs below. Sized just
 // past the REST layer's default 60s request cap: long enough that a teardown
 // which was going to finish still finishes coherently after the caller has
@@ -2118,6 +2131,34 @@ func workspacePreserved(err error) bool {
 // cancels, never aborts) for minutes on end.
 const killTeardownBudget = 90 * time.Second
 
+// terminalIntentBudget bounds the two writes that record a kill actually
+// happened. They run on their own context because by the time Kill reaches
+// them every destructive step is already done: refusing the write because the
+// teardown budget ran out mid-unlink leaves a session dead everywhere except
+// the row the UI reads, and `ao session cleanup` only walks terminated rows, so
+// nothing can reach it afterwards (#5463). Short, because these are two small
+// local writes, not the git and runtime calls the teardown budget exists for.
+const terminalIntentBudget = 15 * time.Second
+
+// recordTermination performs the writes that outlive teardown: the restore
+// marker must not survive a user kill (#2319) and the row must end up
+// terminated. Deliberately detached from the teardown budget — see
+// terminalIntentBudget.
+func (m *Manager) re
```

**File**: `backend/internal/session_manager/manager_test.go` (modified, +117/-12)
```diff
@@ -484,7 +484,14 @@ func (l *fakeLCM) ActivateChatAgentSwitchTarget(ctx context.Context, activation
 	}
 	return store.ActivateChatAgentSwitchTarget(ctx, activation)
 }
-func (l *fakeLCM) MarkTerminated(_ context.Context, id domain.SessionID) error {
+
+// MarkTerminated mirrors the real lifecycle.Manager, which refuses to write on
+// a dead context. The fake used to ignore ctx entirely, which hid the fact that
+// Kill was recording terminal intent on its own expiring teardown budget.
+func (l *fakeLCM) MarkTerminated(ctx context.Context, id domain.SessionID) error {
+	if err := ctx.Err(); err != nil {
+		return err
+	}
 	if l.terminated == nil {
 		l.terminated = map[domain.SessionID]int{}
 	}
@@ -1022,11 +1029,14 @@ type fakeWorkspace struct {
 	// destroyCtxErr records ctx.Err() as seen by Destroy, so a test can prove
 	// teardown does not inherit a caller's cancellation.
 	destroyCtxErr error
-	fetchErr      error
-	fetches       []fetchDefaultBranchCall
-	resolves      []resolveDefaultBranchCall
-	resolved      map[string]ports.WorkspaceDefaultBranch
-	fetchFunc     func(context.Context, string, ports.WorkspaceDefaultBranch) error
+	// destroyHook runs at the top of Destroy, so a test can make teardown burn
+	// real time against Kill's budget.
+	destroyHook func()
+	fetchErr    error
+	fetches     []fetchDefaultBranchCall
+	resolves    []resolveDefaultBranchCall
+	resolved    map[string]ports.WorkspaceDefaultBranch
+	fetchFunc   func(context.Context, string, ports.WorkspaceDefaultBranch) error
 	// createRepoPath, when set, is returned as the RepoPath of a single-repo
 	// Create so tests can assert it survives the spawn->teardown metadata round
 	// trip (production Create resolves this path; the zero default keeps every
@@ -1172,6 +1182,9 @@ func (w *fakeWorkspace) CreateWorkspaceProject(_ context.Context, cfg ports.Work
 }
 func (w *fakeWorkspace) Destroy(ctx context.Context, info ports.WorkspaceInfo) error {
 	w.lastDestroyInfo = info
+	if w.destroyHook != nil {
+		w.destroyHook()
+	}
 	w.destroyCtxErr = ctx.Err()
 	if info.RepoPath != "" {
 		entry := "Destroy:" + fakeWorkspaceRepoName(info)
@@ -3724,14 +3737,76 @@ func TestKill_DeletesStaleRestoreMarker(t *testing.T) {
 	}
 }
 
-// TestKill_OtherWorkspaceErrorStillFails: only the typed dirty refusal is a
-// success-with-preserved-workspace; any other teardown failure keeps erroring.
-func TestKill_OtherWorkspaceErrorStillFails(t *testing.T) {
+// TestKill_UnnamedWorkspaceErrorPreservesAndTerminates is the #5463 regression
+// on the workspace half. A teardown failure AO has no typed name for (a locked
+// worktree git will not prune, a path that no longer resolves to a live
+// worktree) used to fail the kill, which left `terminated` false — and
+// `ao session cleanup` only walks terminated sessions, so the row was reachable
+// by no path at all. Nothing is force-removed: the worktree stays on disk for
+// cleanup to retry and report on. Only the session's claim on the sidebar goes.
+func TestKill_UnnamedWorkspaceErrorPreservesAndTerminates(t *testing.T) {
 	m, st, _, ws := newManager()
 	st.sessions["mer-1"] = mkLive("mer-1")
-	ws.destroyErr = errors.New("disk on fire")
-	if _, err := m.Kill(ctx, "mer-1"); err == nil || !strings.Contains(err.Error(), "disk on fire") {
-		t.Fatalf("kill err = %v, want workspace error surfaced", err)
+	ws.destroyErr = errors.New("path is still registered after git worktree prune")
+
+	freed, err := m.Kill(ctx, "mer-1")
+	if err != nil {
+		t.Fatalf("Kill: %v", err)
+	}
+	if freed {
+		t.Fatal("freed = true, want false: the worktree was left on disk")
+	}
+	if !st.sessions["mer-1"].IsTerminated {
+		t.Fatal("session must be marked terminated so cleanup can reach it")
+	}
+	if calls := strings.Join(ws.calls, ","); strings.Contains(calls, "ForceDestroy") {
+		t.Fatalf("calls = %s, want no ForceDestroy: a refused teardown is never forced", calls)
+	}
+}
+
+// TestKill_RuntimeDestroyErrorFailsClosedEvenWhenProbeReadsGone pins the

```

---

### Incident Patch 7: `b188dd3b` (2026-09-29)
**Commit Message**: fix(codex): recognize empty TUI placeholder when returning to Chat (#6041)

* fix(codex): recognize empty TUI placeholder during interface switch

Treat the exact default Codex prompt as provider chrome when terminal captures omit dim styling. This prevents the TUI-to-Chat drain from reporting the placeholder as an unsent draft while preserving other text as a draft.

* refactor(codex): name the composer chrome label

Move Codex's empty-composer placeholder out of the LastPromptComposerState
call and into a documented codexComposerChromeLabels var, matching the
claudeComposerChromeLabels convention in the Claude Code adapter.

No behavior change.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

---------

Co-authored-by: nikhil achale <nicachale456@gmail.com>
Co-authored-by: Claude Opus 5 <noreply@anthropic.com>

**File**: `backend/internal/adapters/agent/codex/terminal_activity.go` (modified, +8/-1)
```diff
@@ -8,6 +8,13 @@ import (
 	"github.com/aoagents/agent-orchestrator/backend/internal/ports"
 )
 
+// codexComposerChromeLabels names provider-owned text that Codex paints into
+// the current composer row. After a Chat to Terminal UI switch the placeholder
+// can arrive without dim styling, so its visible characters would otherwise
+// read as an unsent draft. It is not human input and must not fail an
+// interface switch.
+var codexComposerChromeLabels = []string{"Ask Codex to do anything"}
+
 // DetectTerminalActivity reports idle only when Codex's composer and footer are visible.
 func (p *Plugin) DetectTerminalActivity(output string) (domain.ActivityState, bool) {
 	observation := p.InspectTerminalSurface(output)
@@ -22,7 +29,7 @@ func (p *Plugin) DetectTerminalActivity(output string) (domain.ActivityState, bo
 // an active turn remains interruptible.
 func (p *Plugin) InspectTerminalSurface(output string) ports.TerminalSurfaceObservation {
 	observation := ports.TerminalSurfaceObservation{
-		Composer: codexComposerState(terminalui.LastPromptComposerState(codexComposerFrame(output), "›")),
+		Composer: codexComposerState(terminalui.LastPromptComposerState(codexComposerFrame(output), "›", codexComposerChromeLabels...)),
 	}
 	lines := terminalLines(output)
 	if len(lines) < 2 {
```

**File**: `backend/internal/adapters/agent/codex/terminal_activity_test.go` (modified, +12/-0)
```diff
@@ -56,6 +56,18 @@ func TestInspectTerminalSurfaceSeparatesCodexWorkFromComposer(t *testing.T) {
 			wantWork:   ports.TerminalSurfaceWorkIdle,
 			wantEditor: ports.TerminalComposerEmpty,
 		},
+		{
+			name:       "current Codex placeholder without dim styling",
+			output:     "› Ask Codex to do anything\n\nGPT-6-Sol medium · ~/project\n? for shortcuts\n",
+			wantWork:   ports.TerminalSurfaceWorkIdle,
+			wantEditor: ports.TerminalComposerEmpty,
+		},
+		{
+			name:       "text appended to Codex placeholder remains a draft",
+			output:     "› Ask Codex to do anything else\n\nGPT-6-Sol medium · ~/project\n? for shortcuts\n",
+			wantWork:   ports.TerminalSurfaceWorkIdle,
+			wantEditor: ports.TerminalComposerDraft,
+		},
 		{
 			name:       "idle empty composer when constrained viewport hides footer",
 			output:     "\x1b[2m• \x1b[0mE2E_ROUNDTRIP_TWO\n\n\n\x1b[1m›\x1b[0m\n",
```

---

### Incident Patch 8: `39305c3f` (2026-09-29)
**Commit Message**: fix(mobile): refine offline status and selector sizing (#6044)

**File**: `packages/mobile/app/settings.tsx` (modified, +21/-17)
```diff
@@ -242,15 +242,15 @@ function CardRow({
 function DesktopStatusRow() {
 	const t = useTheme();
 	const router = useRouter();
-	const { configured, connection, error, errorStatus, activeEndpoints } = useApp();
+	const { config, configured, connection, error, errorStatus, activeEndpoints } = useApp();
 	// Only a poll that actually failed is a failure. Before the first tick lands
 	// errorStatus is null too, which on its own would read as unreachable. Same
 	// gate as the board, which only shows its failure copy behind `error`.
 	const classified = error ? classifyConnectionFailure(errorStatus ?? undefined) : null;
 	// Same rule as the board's failure copy: a dead tunnel with nothing else to
 	// reach the machine by is a rotated address, not an unreachable machine.
 	const failure =
-		classified === "unreachable" && tunnelMayHaveRotated(activeEndpoints, connection === "open")
+		classified === "unreachable" && tunnelMayHaveRotated(activeEndpoints, config?.endpointKind, connection === "open")
 			? "tunnel-rotated"
 			: classified;
 	const status = describeDesktopStatus({ configured, connection, failure });
@@ -343,6 +343,7 @@ function LayoutGridRow() {
 
 function AppearanceRow() {
 	const t = useTheme();
+	const styles = useThemedStyles(makeStyles);
 	const { preference, scheme, setPreference } = useThemeState();
 	const [open, setOpen] = useState(false);
 	if (Platform.OS === "android") {
@@ -365,21 +366,23 @@ function AppearanceRow() {
 			icon="sun"
 			label="Appearance"
 			right={
-				<Host style={{ width: 124, height: 38 }} colorScheme={scheme} seedColor={t.accent}>
-					<Picker
-						selectedValue={preference}
-						onValueChange={(value) => {
-							haptics.select();
-							setPreference(String(value) as ThemePreference);
-						}}
-						appearance="menu"
-						testID="settings-appearance"
-					>
-						<Picker.Item label="System" value="system" />
-						<Picker.Item label="Light" value="light" />
-						<Picker.Item label="Dark" value="dark" />
-					</Picker>
-				</Host>
+				<View style={styles.appearancePicker}>
+					<Host matchContents={{ horizontal: true }} style={{ height: 38 }} colorScheme={scheme} seedColor={t.accent}>
+						<Picker
+							selectedValue={preference}
+							onValueChange={(value) => {
+								haptics.select();
+								setPreference(String(value) as ThemePreference);
+							}}
+							appearance="menu"
+							testID="settings-appearance"
+						>
+							<Picker.Item label="System" value="system" />
+							<Picker.Item label="Light" value="light" />
+							<Picker.Item label="Dark" value="dark" />
+						</Picker>
+					</Host>
+				</View>
 			}
 		/>
 	);
@@ -661,6 +664,7 @@ const makeStyles = (t: Theme) => StyleSheet.create({
 	rowIcon: { fontFamily: "Geist_400Regular", width: 26, textAlign: "center" },
 	rowLabel: { fontFamily: "Geist_600SemiBold", color: t.textPrimary, fontSize: type.subheadline.fontSize, lineHeight: type.subheadline.lineHeight, fontWeight: "600", flex: 1 },
 	rowValue: { fontFamily: "Geist_400Regular", color: t.textSecondary, fontSize: type.footnote.fontSize, lineHeight: type.footnote.lineHeight, maxWidth: "42%" },
+	appearancePicker: { width: 124, height: 38, alignItems: "flex-end", justifyContent: "center" },
 	disabled: { opacity: 0.45 },
 	disconnect: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.md, borderRadius: 16, borderCurve: "continuous" },
 	disconnectText: { fontFamily: "Geist_600SemiBold", color: t.red, fontSize: type.subheadline.fontSize, lineHeight: type.subheadline.lineHeight, fontWeight: "600" },
```

**File**: `packages/mobile/lib/desktopStatus.test.ts` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@ describe("describeDesktopStatus", () => {
 	// The reported bug: a desktop that stopped answering still read "Paired".
 	it("never calls an unreachable desktop paired", () => {
 		expect(describeDesktopStatus({ configured: true, connection: "closed", failure: "unreachable" })).toEqual({
-			label: "Offline",
+			label: "Unreachable",
 			tone: "error",
 		});
 	});
```

**File**: `packages/mobile/lib/desktopStatus.ts` (modified, +1/-1)
```diff
@@ -35,6 +35,6 @@ export function describeDesktopStatus(input: {
 		default:
 			// Still paired, just not answering. Kept apart from "Set up" so an
 			// offline desktop never reads as an unpaired phone.
-			return { label: "Offline", tone: "error" };
+			return { label: "Unreachable", tone: "error" };
 	}
 }
```

**File**: `packages/mobile/lib/settings-density.source.test.ts` (modified, +4/-2)
```diff
@@ -13,8 +13,10 @@ describe("settings screen density", () => {
 		expect(source).not.toMatch(/\bloadConfig\(\)/);
 	});
 
-	it("gives the native Appearance menu enough room for System on one line", () => {
-		expect(source).toContain("<Host style={{ width: 124, height: 38 }}");
+	it("keeps the Appearance slot wide while trailing-aligning the native menu", () => {
+		expect(source).toContain("<View style={styles.appearancePicker}>");
+		expect(source).toContain('<Host matchContents={{ horizontal: true }} style={{ height: 38 }}');
+		expect(source).toMatch(/appearancePicker:\s*\{[^}]*width:\s*124[^}]*alignItems:\s*"flex-end"/s);
 	});
 
 	it("uses the compact sizing rhythm shared by the Workers UI", () => {
```

**File**: `packages/mobile/lib/spawn-composer-controls.ios.source.test.ts` (modified, +2/-1)
```diff
@@ -5,7 +5,8 @@ import { describe, expect, it } from "vitest";
 const source = readFileSync(fileURLToPath(new URL("./spawn-composer-controls.ios.tsx", import.meta.url)), "utf8");
 
 describe("iOS spawn menu layout", () => {
-	it("keeps the project trigger compact and the other selectors steady", () => {
+	it("keeps the project trigger compact and gives the harness enough label room", () => {
+		expect(source).toContain("const HARNESS_MENU_WIDTH = 124");
 		expect(source).toContain('frame({ width: HARNESS_MENU_WIDTH })');
 		expect(source).toContain('const PROJECT_MENU_WIDTH = 224');
 		expect(source).toContain('{projectLabel}</Text>\n\t\t\t\t\t\t\t<Image systemName="chevron.up.chevron.down"');
```

---

### Incident Patch 9: `b465f2c6` (2026-09-29)
**Commit Message**: fix(mobile): honest connecting state on launch, and distinct connection-state icons (#6042)

* fix(mobile): show connecting state instead of pairing prompt during launch race

The tabs branch on `configured` before `loading`, and the store's config
stays null until the endpoint race finishes. On a slow network a paired
phone showed "No desktop paired / Scan pairing code" for seconds, then
connected on its own. Expose configResolved and render a connecting state
until the first resolution finishes.

Also bound the post-race endpoint refresh with a 5s timeout: it runs inside
launch resolution and previously could hang as long as the OS allowed.

* feat(mobile): give each connection state its own empty-state icon

Every connection failure shared the wifi-off glyph, so a rejected password
looked like a network problem, and the unpaired state used a generic server.

- unpaired: monitor-smartphone
- connecting: monitor-smartphone, breathing (reuses useBreathing, so Reduce
  Motion is honoured); drops the separate spinner
- password rejected: monitor-off
- unreachable: unplug
- rate-limited: timer
- server error: monitor-cog
- address changed: route-off

The icon travels with describeConn

**File**: `packages/mobile/app/(tabs)/index.tsx` (modified, +2/-2)
```diff
@@ -154,9 +154,9 @@ export default function FleetScreen() {
 							<EmptyState icon="search" title="No workers found" message={`No workers match “${query.trim()}”.`} />
 						) : error ? (
 							<EmptyState
-								icon="wifi-off"
+								icon={failure.icon}
 								title={failure.title}
-								message={failure.message}
+								message={failure.hint}
 								action={
 									<View style={styles.errorActions}>
 										<Button title="Retry" icon="refresh-cw" variant="ghost" onPress={onRefresh} />
```

**File**: `packages/mobile/app/(tabs)/projects.tsx` (modified, +2/-2)
```diff
@@ -109,9 +109,9 @@ export default function ProjectsScreen() {
 					ListEmptyComponent={
 						error ? (
 							<EmptyState
-								icon="wifi-off"
+								icon={failure.icon}
 								title={failure.title}
-								message={failure.message}
+								message={failure.hint}
 								action={<Button title="Retry" icon="refresh-cw" variant="ghost" onPress={onRefresh} />}
 							/>
 						) : (
```

**File**: `packages/mobile/app/(tabs)/prs.tsx` (modified, +2/-2)
```diff
@@ -119,9 +119,9 @@ export default function PRsScreen() {
 						filtered.length === 0 ? (
 							error ? (
 								<EmptyState
-									icon="wifi-off"
+									icon={failure.icon}
 									title={failure.title}
-									message={failure.message}
+									message={failure.hint}
 									action={<Button title="Retry" icon="refresh-cw" variant="ghost" onPress={onRefresh} />}
 								/>
 							) : (
```

**File**: `packages/mobile/app/notifications.tsx` (modified, +8/-8)
```diff
@@ -31,6 +31,7 @@ import { MINUTE_MS, useNow } from "../lib/useNow";
 import type { Theme } from "../lib/theme";
 import { useTheme, useThemedStyles } from "../lib/ThemeProvider";
 import { Button, Dot, EmptyState, HeaderIconButton, ScreenHeader } from "../lib/ui";
+import { UnpairedState } from "../lib/UnpairedState";
 import { press, space, type } from "../lib/tokens";
 import { backOr } from "../lib/backNavigation";
 import { shouldKeepPolling, userFacingError } from "../lib/connectionError";
@@ -272,16 +273,15 @@ export default function NotificationsScreen() {
 								message="Notifications load once the app reconnects."
 								action={<Button title="Retry" icon="refresh-cw" variant="ghost" onPress={() => void load("refresh")} />}
 							/>
+						) : !config && !error ? (
+							// Shared with the tabs: "Connecting…" while the launch race runs,
+							// the pairing prompt only once it has found no machine.
+							<UnpairedState />
 						) : (
 							<EmptyState
-								icon={error ? "alert-circle" : config ? "check-circle" : "server"}
-								title={error ? "Couldn't load notifications" : config ? "All caught up" : "No desktop paired"}
-								message={
-									error ??
-									(config
-										? "Updates from workers and pull requests will appear here when they need you."
-										: "Pair this phone with AO to receive worker and pull request updates.")
-								}
+								icon={error ? "alert-circle" : "check-circle"}
+								title={error ? "Couldn't load notifications" : "All caught up"}
+								message={error ?? "Updates from workers and pull requests will appear here when they need you."}
 								action={
 									!error ? undefined
 										: rejected ? <Button title="Scan pairing code" icon="maximize" onPress={() => router.push("/pair")} />
```

**File**: `packages/mobile/app/session/[id].tsx` (modified, +2/-4)
```diff
@@ -123,9 +123,8 @@ export default function MobileSessionRoute() {
 			return (
 				<View style={styles.center}>
 					<EmptyState
-						icon="server"
+						icon="monitor-smartphone"
 						title="No desktop paired"
-						message="Scan the pairing code from AO → Settings → Connect Mobile to drive your agents from here."
 						action={<Button title="Scan pairing code" icon="maximize" onPress={() => router.push("/pair")} />}
 					/>
 				</View>
@@ -134,9 +133,8 @@ export default function MobileSessionRoute() {
 			return (
 				<View style={styles.center}>
 					<EmptyState
-						icon="wifi-off"
+						icon="unplug"
 						title="Not connected to your desktop"
-						message="This session loads once the app reconnects."
 						action={<Button title="Open board" icon="activity" variant="ghost" onPress={() => router.navigate("/")} />}
 					/>
 				</View>
```

---

### Incident Patch 10: `2fcf4723` (2026-09-29)
**Commit Message**: Revert "feat(mobile): add agentic in-app browser (#6040)" (#6052)

This reverts commit fd23cfce33ed5c46966a4bae2f02f59c4ac437f5.

**File**: `backend/internal/browserruntime/broker.go` (modified, +7/-18)
```diff
@@ -353,28 +353,17 @@ func (b *Broker) resolve(msg wireMessage) {
 	if ch == nil {
 		return
 	}
-	deliverPendingResult(ch, msg.OK, msg.Result, msg.Error, "Browser command failed", "browser")
-}
-
-func deliverPendingResult(
-	ch chan pendingResult,
-	ok bool,
-	raw json.RawMessage,
-	commandErr *CommandError,
-	defaultMessage string,
-	decodeSubject string,
-) {
-	if !ok {
-		if commandErr == nil {
-			commandErr = &CommandError{Code: "BROWSER_COMMAND_FAILED", Message: defaultMessage}
+	if !msg.OK {
+		if msg.Error == nil {
+			msg.Error = &CommandError{Code: "BROWSER_COMMAND_FAILED", Message: "Browser command failed"}
 		}
-		ch <- pendingResult{err: *commandErr}
+		ch <- pendingResult{err: *msg.Error}
 		return
 	}
 	var value interface{} = map[string]interface{}{}
-	if len(raw) > 0 && string(raw) != "null" {
-		if err := json.Unmarshal(raw, &value); err != nil {
-			ch <- pendingResult{err: fmt.Errorf("decode %s result: %w", decodeSubject, err)}
+	if len(msg.Result) > 0 && string(msg.Result) != "null" {
+		if err := json.Unmarshal(msg.Result, &value); err != nil {
+			ch <- pendingResult{err: fmt.Errorf("decode browser result: %w", err)}
 			return
 		}
 	}
```

**File**: `backend/internal/browserruntime/mobile.go` (removed, +0/-245)
```diff
@@ -1,245 +0,0 @@
-package browserruntime
-
-import (
-	"context"
-	"encoding/json"
-	"errors"
-	"fmt"
-	"sync"
-	"time"
-
-	"github.com/google/uuid"
-
-	"github.com/aoagents/agent-orchestrator/backend/internal/domain"
-)
-
-// MobileConn is the JSON transport used by a foreground mobile browser target.
-// The HTTP layer adapts its WebSocket implementation to this deliberately small
-// interface so browser routing remains transport independent.
-type MobileConn interface {
-	ReadJSON(context.Context, any) error
-	WriteJSON(context.Context, any) error
-	Close(string) error
-}
-
-type mobileTarget struct {
-	sessionID   domain.SessionID
-	deviceID    string
-	connectedAt time.Time
-	conn        MobileConn
-	writeMu     sync.Mutex
-	mu          sync.Mutex
-	pending     map[string]chan pendingResult
-}
-
-type mobileResultMessage struct {
-	Type      string          `json:"type"`
-	RequestID string          `json:"requestId"`
-	OK        bool            `json:"ok"`
-	Result    json.RawMessage `json:"result,omitempty"`
-	Error     *CommandError   `json:"error,omitempty"`
-}
-
-// MobileHub owns foreground mobile WebView targets. A target exists only while
-// its Preview screen is mounted and active; disconnecting immediately makes
-// commands unavailable rather than queueing work for a stale page.
-type MobileHub struct {
-	mu      sync.Mutex
-	targets map[domain.SessionID]*mobileTarget
-}
-
-// NewMobileHub creates an empty registry of foreground mobile browser targets.
-func NewMobileHub() *MobileHub {
-	return &MobileHub{targets: make(map[domain.SessionID]*mobileTarget)}
-}
-
-// Status returns the foreground mobile runtime state for one session.
-func (h *MobileHub) Status(sessionID domain.SessionID) Status {
-	h.mu.Lock()
-	defer h.mu.Unlock()
-	target := h.targets[sessionID]
-	if target == nil {
-		return Status{}
-	}
-	return Status{Connected: true, ConnectedAt: target.connectedAt}
-}
-
-// Execute sends one browser command to the foreground mobile runtime for a session.
-func (h *MobileHub) Execute(ctx context.Context, sessionID domain.SessionID, action string, args map[string]interface{}) (Result, error) {
-	h.mu.Lock()
-	target := h.targets[sessionID]
-	h.mu.Unlock()
-	if target == nil {
-		return Result{}, ErrUnavailable
-	}
-
-	requestID := uuid.NewString()
-	resultCh := make(chan pendingResult, 1)
-	target.mu.Lock()
-	target.pending[requestID] = resultCh
-	target.mu.Unlock()
-
-	message := wireMessage{Type: "command", RequestID: requestID, SessionID: sessionID, Action: action, Args: args}
-	target.writeMu.Lock()
-	err := target.conn.WriteJSON(ctx, message)
-	target.writeMu.Unlock()
-	if err != nil {
-		target.removePending(requestID)
-		h.disconnect(target)
-		if ctx.Err() != nil {
-			return Result{}, ctx.Err()
-		}
-		return Result{}, ErrUnavailable
-	}
-
-	select {
-	case <-ctx.Done():
-		target.removePending(requestID)
-		cancelCtx, cancel := context.WithTimeout(context.Background(), time.Second)
-		target.writeMu.Lock()
-		_ = target.conn.WriteJSON(cancelCtx, wireMessage{Type: "cancel", RequestID: requestID})
-		target.writeMu.Unlock()
-		cancel()
-		return Result{}, ctx.Err()
-	case result := <-resultCh:
-		if result.err != nil {
-			return Result{}, result.err
-		}
-		return Result{RequestID: requestID, Value: result.value}, nil
-	}
-}
-
-// Serve registers one foreground WebView. A newer connection for the same
-// session replaces the old one so a reconnect cannot leave two phones racing
-// to answer the same command.
-func (h *MobileHub) Serve(ctx context.Context, sessionID domain.SessionID, deviceID string, conn MobileConn) error {
-	if sessionID == "" || deviceID == "" {
-		return errors.New("mobile browser session and device ids are required")
-	}
-	target := &mobileTarget{
-		sessionID: sessionID, deviceID: deviceID, connectedAt: time.Now().UTC(), conn: conn,
-		pending: make(map[string]chan pendingResult),
-	}
-
-	h.mu.Lock()
-	old := h.targets[sessionID]
-	h.targets[sessionID] = target
-	h.mu.Unloc
```

**File**: `backend/internal/browserruntime/mobile_test.go` (removed, +0/-111)
```diff
@@ -1,111 +0,0 @@
-package browserruntime
-
-import (
-	"context"
-	"encoding/json"
-	"errors"
-	"sync"
-	"testing"
-	"time"
-
-	"github.com/aoagents/agent-orchestrator/backend/internal/domain"
-)
-
-type fakeMobileConn struct {
-	reads  chan mobileResultMessage
-	writes chan wireMessage
-	once   sync.Once
-	closed chan struct{}
-}
-
-func newFakeMobileConn() *fakeMobileConn {
-	return &fakeMobileConn{reads: make(chan mobileResultMessage, 2), writes: make(chan wireMessage, 2), closed: make(chan struct{})}
-}
-
-func (f *fakeMobileConn) ReadJSON(ctx context.Context, value any) error {
-	select {
-	case <-ctx.Done():
-		return ctx.Err()
-	case <-f.closed:
-		return errors.New("closed")
-	case message := <-f.reads:
-		*(value.(*mobileResultMessage)) = message
-		return nil
-	}
-}
-func (f *fakeMobileConn) WriteJSON(ctx context.Context, value any) error {
-	select {
-	case <-ctx.Done():
-		return ctx.Err()
-	case <-f.closed:
-		return errors.New("closed")
-	case f.writes <- value.(wireMessage):
-		return nil
-	}
-}
-func (f *fakeMobileConn) Close(string) error { f.once.Do(func() { close(f.closed) }); return nil }
-
-func TestMobileHubRoutesAndCorrelatesSessionCommand(t *testing.T) {
-	hub := NewMobileHub()
-	conn := newFakeMobileConn()
-	ctx, cancel := context.WithCancel(context.Background())
-	defer cancel()
-	serveDone := make(chan error, 1)
-	go func() { serveDone <- hub.Serve(ctx, "s1", "phone-1", conn) }()
-
-	deadline := time.Now().Add(time.Second)
-	for !hub.Status("s1").Connected && time.Now().Before(deadline) {
-		time.Sleep(time.Millisecond)
-	}
-	if !hub.Status("s1").Connected {
-		t.Fatal("mobile target did not register")
-	}
-
-	resultDone := make(chan Result, 1)
-	errDone := make(chan error, 1)
-	go func() {
-		result, err := hub.Execute(context.Background(), "s1", "snapshot", map[string]interface{}{"interactive": true})
-		resultDone <- result
-		errDone <- err
-	}()
-	command := <-conn.writes
-	if command.SessionID != domain.SessionID("s1") || command.Action != "snapshot" || command.RequestID == "" {
-		t.Fatalf("command = %#v", command)
-	}
-	payload, _ := json.Marshal(map[string]interface{}{"text": "button Save [ref=e1]"})
-	conn.reads <- mobileResultMessage{Type: "result", RequestID: command.RequestID, OK: true, Result: payload}
-	if err := <-errDone; err != nil {
-		t.Fatal(err)
-	}
-	result := <-resultDone
-	if result.RequestID != command.RequestID || result.Value.(map[string]interface{})["text"] == "" {
-		t.Fatalf("result = %#v", result)
-	}
-
-	cancel()
-	<-serveDone
-	if hub.Status("s1").Connected {
-		t.Fatal("mobile target remained connected after transport closed")
-	}
-}
-
-func TestRouterAutoPrefersForegroundMobileTarget(t *testing.T) {
-	desktop := New(nil)
-	hub := NewMobileHub()
-	router := NewRouter(desktop, hub)
-	if _, transport := router.Status("s1", "auto"); transport != "electron-webcontents-debugger" {
-		t.Fatalf("disconnected auto transport = %q", transport)
-	}
-	conn := newFakeMobileConn()
-	ctx, cancel := context.WithCancel(context.Background())
-	defer cancel()
-	go func() { _ = hub.Serve(ctx, "s1", "phone-1", conn) }()
-	deadline := time.Now().Add(time.Second)
-	for !hub.Status("s1").Connected && time.Now().Before(deadline) {
-		time.Sleep(time.Millisecond)
-	}
-	status, transport := router.Status("s1", "auto")
-	if !status.Connected || transport != "mobile-webview" {
-		t.Fatalf("auto status = %+v transport=%q", status, transport)
-	}
-}
```

**File**: `backend/internal/cli/browser.go` (modified, +10/-14)
```diff
@@ -26,7 +26,6 @@ type browserStatusDTO struct {
 
 type browserCommandRequestDTO struct {
 	SessionID string         `json:"sessionId"`
-	Surface   string         `json:"surface,omitempty"`
 	Action    string         `json:"action"`
 	Args      map[string]any `json:"args,omitempty"`
 }
@@ -58,24 +57,22 @@ const (
 
 func newBrowserCommand(ctx *commandContext) *cobra.Command {
 	var jsonOutput bool
-	var surface string
 	cmd := &cobra.Command{
 		Use:   "browser",
-		Short: "Inspect and control this AO session's shared browser",
+		Short: "Inspect and control this AO session's shared desktop browser",
 		Long: "Inspect and control the target-isolated browser owned by the current AO session.\n\n" +
-			"Auto mode prefers a foreground mobile Preview browser and otherwise uses desktop.\n" +
-			"Commands operate the same live page the user sees.",
+			"The desktop app must be open. Commands operate the same live page the user sees,\n" +
+			"including while the Browser panel is hidden.",
 		Args: noArgs,
 	}
 	cmd.PersistentFlags().BoolVar(&jsonOutput, "json", false, "print the structured response as JSON")
-	cmd.PersistentFlags().StringVar(&surface, "surface", "auto", "browser surface: auto, desktop, or mobile")
 
 	cmd.AddCommand(&cobra.Command{
 		Use:   "status",
 		Short: "Show whether the desktop browser runtime is connected",
 		Args:  noArgs,
 		RunE: func(cmd *cobra.Command, _ []string) error {
-			status, err := ctx.browserStatus(cmd.Context(), surface)
+			status, err := ctx.browserStatus(cmd.Context())
 			if err != nil {
 				return err
 			}
@@ -489,7 +486,7 @@ func newBrowserCommand(ctx *commandContext) *cobra.Command {
 			if screenshotAnnotate {
 				actionArgs = map[string]any{"annotate": true}
 			}
-			resp, err := ctx.browserAction(cmd.Context(), surface, "screenshot", actionArgs)
+			resp, err := ctx.browserAction(cmd.Context(), "screenshot", actionArgs)
 			if err != nil {
 				return err
 			}
@@ -628,7 +625,7 @@ func currentBrowserIdentity() (string, string, error) {
 	return sessionID, capability, nil
 }
 
-func (c *commandContext) browserStatus(ctx context.Context, surface string) (browserStatusDTO, error) {
+func (c *commandContext) browserStatus(ctx context.Context) (browserStatusDTO, error) {
 	sessionID, capability, err := currentBrowserIdentity()
 	if err != nil {
 		return browserStatusDTO{}, err
@@ -637,15 +634,15 @@ func (c *commandContext) browserStatus(ctx context.Context, surface string) (bro
 	err = c.doJSONPathWithHeaders(
 		ctx,
 		http.MethodGet,
-		"/api/v1/browser/status?sessionId="+url.QueryEscape(sessionID)+"&surface="+url.QueryEscape(surface),
+		"/api/v1/browser/status?sessionId="+url.QueryEscape(sessionID),
 		nil,
 		&out,
 		map[string]string{browserCapabilityHeader: capability},
 	)
 	return out, err
 }
 
-func (c *commandContext) browserAction(ctx context.Context, surface, action string, args map[string]any) (browserCommandResponseDTO, error) {
+func (c *commandContext) browserAction(ctx context.Context, action string, args map[string]any) (browserCommandResponseDTO, error) {
 	sessionID, capability, err := currentBrowserIdentity()
 	if err != nil {
 		return browserCommandResponseDTO{}, err
@@ -655,16 +652,15 @@ func (c *commandContext) browserAction(ctx context.Context, surface, action stri
 		ctx,
 		http.MethodPost,
 		"/api/v1/browser/commands",
-		browserCommandRequestDTO{SessionID: sessionID, Surface: surface, Action: action, Args: args},
+		browserCommandRequestDTO{SessionID: sessionID, Action: action, Args: args},
 		&out,
 		map[string]string{browserCapabilityHeader: capability},
 	)
 	return out, err
 }
 
 func (c *commandContext) runBrowserAction(cmd *cobra.Command, action string, args map[string]any, jsonOutput bool) error {
-	surface, _ := cmd.Flags().GetString("surface")
-	resp, err := c.browserAction(cmd.Context(), surface, action, args)
+	resp, err := c.browserAction(cmd.Context(), action, args)
 	if err != nil {
 		return err
 	}
```

**File**: `backend/internal/cli/browser_test.go` (modified, +2/-6)
```diff
@@ -89,22 +89,19 @@ func TestBrowserStatusAndSnapshot(t *testing.T) {
 	if err != nil || !strings.Contains(out, "Browser runtime: connected") {
 		t.Fatalf("status err=%v stderr=%s stdout=%s", err, errOut, out)
 	}
-	if capture.path != "/api/v1/browser/status?sessionId=ao-1&surface=auto" {
+	if capture.path != "/api/v1/browser/status?sessionId=ao-1" {
 		t.Fatalf("status path = %q", capture.path)
 	}
 	if capture.capability != "capability-1" {
 		t.Fatalf("status capability = %q", capture.capability)
 	}
-	if _, _, err = executeCLI(t, deps, "browser", "status", "--surface", "mobile"); err != nil || capture.path != "/api/v1/browser/status?sessionId=ao-1&surface=mobile" {
-		t.Fatalf("mobile status err=%v path=%q", err, capture.path)
-	}
 	out, errOut, err = executeCLI(t, deps, "browser", "snapshot", "--interactive")
 	if err != nil || !strings.Contains(out, "button Save [ref=e1]") ||
 		!strings.Contains(out, "<<<BEGIN UNTRUSTED EXTERNAL CONTENT>>>") ||
 		!strings.Contains(out, "<<<END UNTRUSTED EXTERNAL CONTENT>>>") {
 		t.Fatalf("snapshot err=%v stderr=%s stdout=%s", err, errOut, out)
 	}
-	if capture.body.SessionID != "ao-1" || capture.body.Surface != "auto" || capture.body.Action != "snapshot" || capture.body.Args["interactive"] != true {
+	if capture.body.SessionID != "ao-1" || capture.body.Action != "snapshot" || capture.body.Args["interactive"] != true {
 		t.Fatalf("command = %#v", capture.body)
 	}
 	out, errOut, err = executeCLI(t, deps, "browser", "get", "text")
@@ -750,7 +747,6 @@ func TestBrowserScreenshotHelpExplainsJSONAndBase64Modes(t *testing.T) {
 
 func TestBrowserRequiresSessionAndValidWait(t *testing.T) {
 	t.Setenv("AO_SESSION_ID", "")
-	t.Setenv("AO_BROWSER_CAPABILITY", "")
 	if _, _, err := executeCLI(t, Deps{}, "browser", "status"); ExitCode(err) != 2 {
 		t.Fatalf("status error = %v code=%d", err, ExitCode(err))
 	}
```

#### Recent Merged Pull Requests:
- **PR #6084** (2026-09-30): feat: polish Accounts Manager settings UI (@ronishrohan)
- **PR #6077** (2026-09-30): fix(frontend): replace standalone quick launch with Cloud when enabled (@Rishet11)
- **PR #6072** (closed): fix(review): let kill work with auto-review on and re-arm the same SHA (@axisrow)
- **PR #6068** (closed): fix(review): reach orphaned reviewer panes after the DB handle is cleared (@axisrow)
- **PR #6066** (closed): fix(chat): settle running turns when the agent controller stops (@axisrow)
- **PR #6065** (2026-09-30): fix(build): pin Windows ACP extraction to system bsdtar (@illegalcall)
- **PR #6059** (2026-09-30): fix(settings): hide gated tracker intake controls (@Pulkit7070)
- **PR #6056** (2026-09-30): docs(readme): list Gemini CLI and DeepSeek agents, update count to 32 (@nikhilachale)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
