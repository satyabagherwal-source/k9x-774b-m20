# Forensic Learning Record (Deep Inspection): AgentsMesh/AgentsMesh

> **Canonical Artifact**: `07_PROJECT_LEARNING/agentsmesh-agentsmesh-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/AgentsMesh/AgentsMesh](https://github.com/AgentsMesh/AgentsMesh))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:19:34.525Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `AgentsMesh/AgentsMesh`
- **Description**: The AI Agent Workforce Platform. Run a hundred AI coding agents across your own machines — schedule, isolate, and steer them all from one console.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: package.json, go.mod, README.md
- **Stars / Engagement**: 2358 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `agentfile/eval/apply_removes.go`
```
package eval

// ApplyRemoves post-processes a BuildResult by removing items
// collected from REMOVE declarations and remove statements.
func ApplyRemoves(r *BuildResult) {
	if len(r.RemoveArgs) > 0 {
		r.LaunchArgs = removeFromSlice(r.LaunchArgs, r.RemoveArgs)
	}
	if len(r.RemoveFiles) > 0 {
		removeSet := toSet(r.RemoveFiles)
		filtered := r.FilesToCreate[:0]
		for _, f := range r.FilesToCreate {
			if !removeSet[f.Path] {
				filtered = append(filtered, f)
			}
		}
		r.FilesToCreate = filtered

		filteredDirs := r.Dirs[:0]
		for _, d := range r.Dirs {
			if !removeSet[d] {
				filteredDirs = append(filteredDirs, d)
			}
		}
		r.Dirs = filteredDirs
	}
	if len(r.RemoveEnvs) > 0 {
		for _, name := range r.RemoveEnvs {
			delete(r.EnvVars, name)
		}
	}
	if len(r.RemoveSkills) > 0 {
		removeSet := toSet(r.RemoveSkills)
		filtered := r.Skills[:0]
		for _, s := range r.Skills {
			if !removeSet[s] {
				filtered = append(filtered, s)
			}
		}
		r.Skills = filtered
	}
}

// removeFromSlice removes args, handling flag+value pairs.
// E.g., removing "--model" also removes the next arg ("opus").
func removeFromSlice(args []string, removes []string) []string {
	removeSet := toSet(removes)
	var result []string
	for i := 0; i < len(args); i++ {
		if removeSet[args[i]] {
			// If this looks like a flag and next arg is a value, skip both
			if i+1 < len(args) && len(args[i]) > 1 && args[i][0] == '-' &&
				(len(args[i+1]) == 0 || args[i+1][0] != '-') {
				i++ // skip the value too
			}
			continue
		}
		result = append(result, args[i])
	}
	return result
}

func toSet(items []string) map[string]bool {
	s := make(map[string]bool, len(items))
	for _, item := range items {
		s[item] = true
	}
	return s
}

```

### Core Architecture Module: `agentfile/eval/builtins.go`
```
package eval

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"unicode"
)

// RegisterBuiltins registers all built-in functions into the context.
func RegisterBuiltins(ctx *Context) {
	ctx.Builtins["json"] = builtinJSON
	ctx.Builtins["json_parse"] = builtinJSONParse
	ctx.Builtins["json_merge"] = builtinJSONMerge
	ctx.Builtins["mcp_transform"] = builtinMCPTransform
	ctx.Builtins["codex_mcp_toml"] = builtinCodexMCPTOML
	ctx.Builtins["str_replace"] = builtinStrReplace
	ctx.Builtins["str_contains"] = builtinStrContains
	ctx.Builtins["str_join"] = builtinStrJoin
	ctx.Builtins["len"] = builtinLen
	ctx.Builtins["print"] = builtinPrint
}

// json(obj) — serialize a map/value to JSON string
func builtinJSON(args ...interface{}) (interface{}, error) {
	if len(args) != 1 {
		return nil, fmt.Errorf("json: expected 1 argument, got %d", len(args))
	}
	b, err := json.Marshal(args[0])
	if err != nil {
		return nil, fmt.Errorf("json: %w", err)
	}
	return string(b), nil
}

// json_parse(str) — parse JSON string into a map
func builtinJSONParse(args ...interface{}) (interface{}, error) {
	if len(args) != 1 {
		return nil, fmt.Errorf("json_parse: expected 1 argument, got %d", len(args))
	}
	s := toString(args[0])
	var result interface{}
	if err := json.Unmarshal([]byte(s), &result); err != nil {
		return nil, fmt.Errorf("json_parse: %w", err)
	}
	return result, nil
}

// json_merge(a, b, ...) — shallow merge multiple maps (later keys override earlier).
// Intentionally shallow: nested objects like MCP server configs are replaced whole,
// preserving agent-specific fields that differ between formats.
func builtinJSONMerge(args ...interface{}) (interface{}, error) {
	if len(args) < 2 {
		return nil, fmt.Errorf("json_merge: expected at least 2 arguments")
	}
	result := make(map[string]interface{})
	for _, arg := range args {
		m, ok := arg.(map[string]interface{})
		if !ok {
			continue
		}
		for k, v := range m {
			result[k] = v
		}
	}
	return result, nil
}

// mcp_transform(config, format) — transform MCP server config to agent format.
// Handles differences like "url" vs "httpUrl" (Gemini), "enabled" field (OpenCode).
func builtinMCPTransform(args ...interface{}) (interface{}, error) {
	if len(args) != 2 {
		return nil, fmt.Errorf("mcp_transform: expected 2 arguments")
	}
	servers, ok := args[0].(map[string]interface{})
	if !ok {
		return args[0], nil
	}
	format := toString(args[1])
	result := make(map[string]interface{})

	for name, srv := range servers {
		srvMap, ok := srv.(map[string]interface{})
		if !ok {
			result[name] = srv
			continue
		}
		result[name] = transformMCPServer(srvMap, format)
	}
	return result, nil
}

func transformMCPServer(srv map[string]interface{}, format string) map[string]interface{} {
	out := make(map[string]interface{})
	for k, v := range srv {
		out[k] = v
	}

	switch format {
	case "gemini":
		// Gemini uses "httpUrl" instead of "url"
		if url, ok := out["url"]; ok {
			out["httpUrl"] = url
			delete(out, "url")
		}
		delete(out, "type")
	case "opencode":
		// OpenCode requires type="local" + command=[...] format.
		// Convert HTTP MCP servers to streamable-http proxy via curl.
		if url, ok := out["url"].(string); ok {
			out["type"] = "local"
			// Use npx to run streamable-http proxy, or fall back to direct URL
			out["command"] = []interface{}{"npx", "-y", "mcp-remote", url}
			delete(out, "url")
			delete(out, "headers")
		}
		out["enabled"] = true
	case "codex":
		// Codex uses flat format, no transformation needed here
		// (Codex MCP is handled via -c args, not file)
	}
	return out
}

// codex_mcp_toml(config) serializes MCP server config to Codex Rust config.toml.
func builtinCodexMCPTOML(args ...interface{}) (interface{}, error) {
	if len(args) != 1 {
		return nil, fmt.Errorf("codex_mcp_toml: expected 1 argument, got %d", len(args))
	}
	servers, ok := args[0].(map[string]interface{})
	if !ok {
		return "", nil
	}

	names := make([]string, 0, len(servers))
	for name := range servers {
		names = append(names, name)
	}
	sort.Strings(names)

	var b strings.Builder
	for _, name := range names {
		srv, ok := servers[name].(map[string]interface{})
		if !ok {
			continue
		}
		if b.Len() > 0 {
			b.WriteByte('\n')
		}
		fmt.Fprintf(&b, "[mcp_servers.%s]\n", tomlKey(name))
		writeTomlStringField(&b, "type", srv["type"])
		writeTomlStringField(&b, "url", srv["url"])
		writeTomlStringField(&b, "command", srv["command"])
		writeTomlStringArrayField(&b, "args", srv["args"])
		headers := srv["headers"]
		if headers == nil {
			headers = srv["http_headers"]
		}
		writeTomlSubTable(&b, name, "http_headers", headers)
		writeTomlSubTable(&b, name, "env", srv["env"])
	}

	return b.String(), nil
}

func writeTomlStringField(b *strings.Builder, key string, val interface{}) {
	s, ok := val.(string)
	if !ok || s == "" {
		return
	}
	fmt.Fprintf(b, "%s = %s\n", tomlKey(key), tomlString(s))
}

func writeTomlStringArrayField(b *strings.Builder, key string, val interface{}) {
	items, ok := toStringSlice(val)
	if !ok || len(items) == 0 {
		return
	}
	quoted := make([]string, 0, len(items))
	for _, item := range items {
		quoted = append(quoted, tomlString(item))
	}
	fmt.Fprintf(b, "%s = [%s]\n", tomlKey(key), strings.Join(quoted, ", "))
}

func writeTomlSubTable(b *strings.Builder, serverName, tableName string, val interface{}) {
	fields, ok := toStringMap(val)
	if !ok || len(fields) == 0 {
		return
	}
	keys := make([]string, 0, len(fields))
	for key := range fields {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	fmt.Fprintf(b, "\n[mcp_servers.%s.%s]\n", tomlKey(serverName), tomlKey(tableName))
	for _, key := range keys {
		if fields[key] == "" {
			continue
		}
		fmt.Fprintf(b, "%s = %s\n", tomlKey(key), tomlString(fields[key]))
	}
}

func toStringSlice(val interface{}) ([]string, bool) {
	switch v := val.(type) {
	case []string:
		return v, true
	case []interface{}:
		items := make([]string, 0, len(v))
		for _, item := range v {
			items = append(items, toString(item))
		}
		return items, true
	default:
		return nil, false
	}
}

func toStringMap(val interface{}) (map[string]string, bool) {
	switch v := val.(type) {
	case map[string]string:
		return v, true
	case map[string]interface{}:
		result := make(map[string]string, len(v))
		for key, item := range v {
			result[key] = toString(item)
		}
		return result, true
	default:
		return nil, false
	}
}

func tomlString(s string) string {
	var b strings.Builder
	b.WriteByte('"')
	for _, r := range s {
		switch r {
		case '\\':
			b.WriteString(`\\`)
		case '"':
			b.WriteString(`\"`)
		case '\b':
			b.WriteString(`\b`)
		case '\t':
			b.WriteString(`\t`)
		case '\n':
			b.WriteString(`\n`)
		case '\f':
			b.WriteString(`\f`)
		case '\r':
			b.WriteString(`\r`)
		default:
			if r < 0x20 {
				fmt.Fprintf(&b, `\u%04X`, r)
			} else {
				b.WriteRune(r)
			}
		}
	}
	b.WriteByte('"')
	return b.String()
}

func tomlKey(s string) string {
	if s == "" {
		return `""`
	}
	for i, r := range s {
		if !(unicode.IsLetter(r) || unicode.IsDigit(r) || r == '_' || r == '-') {
			return tomlString(s)
		}
		if i == 0 && unicode.IsDigit(r) {
			return tomlString(s)
		}
	}
	return s
}

func builtinStrReplace(args ...interface{}) (interface{}, error) {
	if len(args) != 3 {
		return nil, fmt.Errorf("str_replace: expected 3 arguments")
	}
	return strings.ReplaceAll(toString(args[0]), toString(args[1]), toString(args[2])), nil
}

func builtinStrContains(args ...interface{}) (interface{}, error) {
	if len(args) != 2 {
		return nil, fmt.Errorf("str_contains: expected 2 arguments")
	}
	return strings.Contains(toString(args[0]), toString(args[1])), nil
}

func builtinStrJoin(args ...interface{}) (interface{}, error) {
	if len(args) != 2 {
		return nil, fmt.Errorf("str_join: expected 2 arguments (list, separator)")
	}
	sep := toString(args[1])
	switch v := args[0].(type) {
	case []interface{}:
		parts := make([]string, len(v))
		for i, item := range v {
			parts[i] = toString(item)
		}
		return strings.Join(parts, sep), ni
```

### Core Architecture Module: `agentfile/eval/context.go`
```
// Package eval implements the Runner-mode AgentFile execution engine.
// It walks the full AST (declarations + build logic) and produces
// a BuildResult — the complete Pod creation instruction.
package eval

// BuildResult is the complete output of evaluating an AgentFile.
// It contains everything needed to create and start a Pod,
// equivalent to CreatePodCommand.
type BuildResult struct {
	// From AGENT declaration
	LaunchCommand string
	// From EXECUTABLE declaration
	Executable string

	// From arg statements
	LaunchArgs []string
	// From ENV declarations + env statements
	EnvVars map[string]string
	// From file statements
	FilesToCreate []FileEntry
	// From mkdir statements
	Dirs []string
	// From PROMPT declaration
	Prompt string // prompt content
	// From PROMPT_POSITION declaration
	PromptPosition string // "prepend", "append", "none"

	// From REPO/BRANCH/GIT_CREDENTIAL declarations
	Sandbox SandboxResult
	// From SETUP declaration
	Setup SetupResult
	// From MCP declaration
	MCPEnabled bool
	// From SKILLS declaration
	Skills []string

	// From REMOVE declarations and remove statements
	RemoveArgs   []string // arg values to remove from LaunchArgs
	RemoveFiles  []string // file paths to remove from FilesToCreate
	RemoveEnvs   []string // env names to remove from EnvVars
	RemoveSkills []string // skill slugs to remove from Skills

	// From MODE declaration
	Mode string // "pty" or "acp"
	// From MODE <name> <args...> declarations (per-mode launch args)
	ModeArgs map[string][]string
}

// FileEntry represents a file to create in the sandbox.
type FileEntry struct {
	Path    string
	Content string
	Mode    int // 0 means default (0644)
}

// SandboxResult holds workspace configuration from declarations.
type SandboxResult struct {
	RepoURL        string // from REPO
	Branch         string // from BRANCH
	CredentialType string // from GIT_CREDENTIAL
}

// SetupResult holds preparation script configuration.
type SetupResult struct {
	Script  string
	Timeout int
}

// Context holds the runtime state during AgentFile evaluation.
type Context struct {
	// Variables is the mutable variable scope.
	Variables map[string]interface{}

	// EnvBundles is the bundle-name → KV map loaded by the backend before
	// eval (mirror of the MCP pattern). USE_ENV_BUNDLE "name" declarations
	// look up entries here and merge them into Result.EnvVars in declaration
	// order. Missing names are skipped (warn-only) so a stale layer
	// reference doesn't fail Pod creation.
	EnvBundles map[string]map[string]string

	// Result accumulates the complete Pod creation instruction.
	Result *BuildResult

	// Builtins maps function names to implementations.
	Builtins map[string]BuiltinFunc
}

// BuiltinFunc is a function callable from AgentFile build logic.
type BuiltinFunc func(args ...interface{}) (interface{}, error)

// NewContext creates a Context with platform-injected values.
func NewContext(vars map[string]interface{}) *Context {
	if vars == nil {
		vars = make(map[string]interface{})
	}
	ctx := &Context{
		Variables: vars,
		Result: &BuildResult{
			EnvVars: make(map[string]string),
		},
		Builtins: make(map[string]BuiltinFunc),
	}
	RegisterBuiltins(ctx)
	return ctx
}

// Get retrieves a variable by name.
func (c *Context) Get(name string) (interface{}, bool) {
	val, ok := c.Variables[name]
	return val, ok
}

// Set assigns a variable value.
func (c *Context) Set(name string, val interface{}) {
	c.Variables[name] = val
}

// GetNested retrieves a value from a nested map.
func GetNested(obj interface{}, key string) (interface{}, bool) {
	if m, ok := obj.(map[string]interface{}); ok {
		val, found := m[key]
		return val, found
	}
	return nil, false
}

```

### Core Architecture Module: `agentfile/eval/eval_decl.go`
```
package eval

import "github.com/anthropics/agentsmesh/agentfile/parser"

// evalDecl processes a declaration, writing results to BuildResult.
// Every declaration type is handled — AgentFile eval produces the complete Pod instruction.
func evalDecl(ctx *Context, decl parser.Declaration) error {
	switch d := decl.(type) {
	case *parser.AgentDecl:
		ctx.Result.LaunchCommand = d.Command
	case *parser.ExecutableDecl:
		ctx.Result.Executable = d.Name
	case *parser.EnvDecl:
		return evalEnvDecl(ctx, d)
	case *parser.RepoDecl:
		val, err := evalExpr(ctx, d.Value)
		if err != nil {
			return err
		}
		ctx.Result.Sandbox.RepoURL = toString(val)
	case *parser.BranchDecl:
		val, err := evalExpr(ctx, d.Value)
		if err != nil {
			return err
		}
		ctx.Result.Sandbox.Branch = toString(val)
	case *parser.GitCredentialDecl:
		ctx.Result.Sandbox.CredentialType = d.Type
	case *parser.McpDecl:
		ctx.Result.MCPEnabled = d.Enabled
		// Sync to context variable so build logic `if mcp.enabled` reflects the declaration.
		if m, ok := ctx.Get("mcp"); ok {
			if mp, ok := m.(map[string]interface{}); ok {
				mp["enabled"] = d.Enabled
				// Auto-populate mcp.servers: merged + optionally transformed.
				// Eliminates repetitive json_merge + mcp_transform in build logic.
				if d.Enabled {
					builtin, _ := mp["builtin"].(map[string]interface{})
					installed, _ := mp["installed"].(map[string]interface{})
					servers := shallowMerge(builtin, installed)
					if d.Format != "" {
						transformed, err := builtinMCPTransform(servers, d.Format)
						if err == nil {
							if m, ok := transformed.(map[string]interface{}); ok {
								servers = m
							}
						}
					}
					mp["servers"] = servers
				}
			}
		}
	case *parser.SkillsDecl:
		ctx.Result.Skills = append(ctx.Result.Skills, d.Slugs...)
	case *parser.SetupDecl:
		ctx.Result.Setup = SetupResult{Script: d.Script, Timeout: d.Timeout}
	case *parser.ConfigDecl:
		// CONFIG sets config variable from its resolved default value.
		// Values are injected by resolve.ResolveConfigValues before eval.
		if d.Default != nil {
			cfg, _ := ctx.Get("config")
			cfgMap, ok := cfg.(map[string]interface{})
			if !ok {
				cfgMap = make(map[string]interface{})
				ctx.Set("config", cfgMap)
			}
			cfgMap[d.Name] = d.Default
		}
	case *parser.RemoveDecl:
		return evalRemoveDecl(ctx, d)
	case *parser.ModeDecl:
		ctx.Result.Mode = d.Mode
		ctx.Set("mode", d.Mode) // expose to build logic (e.g., if mode == "acp")
	case *parser.ModeArgsDecl:
		if ctx.Result.ModeArgs == nil {
			ctx.Result.ModeArgs = make(map[string][]string)
		}
		ctx.Result.ModeArgs[d.Mode] = d.Args
	case *parser.UseEnvBundleDecl:
		evalUseEnvBundleDecl(ctx, d)
	case *parser.PromptDecl:
		ctx.Result.Prompt = d.Content
	case *parser.PromptPositionDecl:
		ctx.Result.PromptPosition = d.Mode
	}
	return nil
}

func evalRemoveDecl(ctx *Context, d *parser.RemoveDecl) error {
	switch d.Target {
	case "ENV":
		ctx.Result.RemoveEnvs = append(ctx.Result.RemoveEnvs, d.Name)
	case "SKILLS":
		ctx.Result.RemoveSkills = append(ctx.Result.RemoveSkills, d.Name)
	case "CONFIG":
		// CONFIG removal is metadata for merge; no build-time effect
	case "arg":
		ctx.Result.RemoveArgs = append(ctx.Result.RemoveArgs, d.Name)
	case "file":
		ctx.Result.RemoveFiles = append(ctx.Result.RemoveFiles, d.Name)
	}
	return nil
}

func evalEnvDecl(ctx *Context, d *parser.EnvDecl) error {
	if d.ValueExpr != nil {
		// Dynamic expression (e.g., ENV KEY = config.val when cond)
		if d.When != nil {
			cond, err := evalExpr(ctx, d.When)
			if err != nil {
				return err
			}
			if !isTruthy(cond) {
				return nil
			}
		}
		val, err := evalExpr(ctx, d.ValueExpr)
		if err != nil {
			return err
		}
		ctx.Result.EnvVars[d.Name] = toString(val)
		return nil
	}
	if d.Value != "" {
		ctx.Result.EnvVars[d.Name] = d.Value
		return nil
	}
	// `ENV X SECRET|TEXT OPTIONAL` declarations (d.Source != "") are pure
	// schema metadata after the EnvBundle refactor: they document which
	// ENVs an agent expects but produce no eval-time mutation. AgentFile
	// USE_ENV_BUNDLE references inject the actual values into EnvVars.
	return nil
}

// evalUseEnvBundleDecl handles USE_ENV_BUNDLE "name". The backend pre-loads
// every bundle visible to the user into ctx.EnvBundles (keyed by name). Each
// declaration merges its bundle's KV into Result.EnvVars in declaration
// order — later USE_ENV_BUNDLE wins on key conflicts. Missing names produce
// no env mutation (warn-only, like the MCP "load-everything" pattern).
func evalUseEnvBundleDecl(ctx *Context, d *parser.UseEnvBundleDecl) {
	if ctx.EnvBundles == nil {
		return
	}
	bundle, ok := ctx.EnvBundles[d.Name]
	if !ok {
		return
	}
	for k, v := range bundle {
		ctx.Result.EnvVars[k] = v
	}
}

// shallowMerge merges two maps (later keys override earlier).
func shallowMerge(a, b map[string]interface{}) map[string]interface{} {
	result := make(map[string]interface{})
	for k, v := range a {
		result[k] = v
	}
	for k, v := range b {
		result[k] = v
	}
	return result
}

```

### Core Architecture Module: `agentfile/eval/eval_expr.go`
```
package eval

import (
	"fmt"
	"strconv"

	"github.com/anthropics/agentsmesh/agentfile/parser"
)

// evalExpr evaluates an expression AST node and returns a Go value.
func evalExpr(ctx *Context, expr parser.Expr) (interface{}, error) {
	switch e := expr.(type) {
	case *parser.StringLit:
		return interpolate(ctx, e.Value), nil

	case *parser.NumberLit:
		if f, err := strconv.ParseFloat(e.Value, 64); err == nil {
			return f, nil
		}
		return e.Value, nil

	case *parser.BoolLit:
		return e.Value, nil

	case *parser.HeredocLit:
		return interpolate(ctx, e.Content), nil

	case *parser.Ident:
		val, ok := ctx.Get(e.Name)
		if !ok {
			return nil, nil // undefined variables are nil
		}
		return val, nil

	case *parser.DotExpr:
		return evalDotExpr(ctx, e)

	case *parser.BinaryExpr:
		return evalBinaryExpr(ctx, e)

	case *parser.UnaryExpr:
		return evalUnaryExpr(ctx, e)

	case *parser.CallExpr:
		return evalCallExpr(ctx, e)

	case *parser.ObjectLit:
		return evalObjectLit(ctx, e)

	case *parser.ListLit:
		return evalListLit(ctx, e)

	default:
		return nil, fmt.Errorf("unknown expression type %T", expr)
	}
}

func evalDotExpr(ctx *Context, e *parser.DotExpr) (interface{}, error) {
	left, err := evalExpr(ctx, e.Left)
	if err != nil {
		return nil, err
	}
	if left == nil {
		return nil, nil
	}
	val, _ := GetNested(left, e.Field)
	return val, nil
}

func evalBinaryExpr(ctx *Context, e *parser.BinaryExpr) (interface{}, error) {
	left, err := evalExpr(ctx, e.Left)
	if err != nil {
		return nil, err
	}

	// Short-circuit evaluation for logical operators
	switch e.Op {
	case "and":
		if !isTruthy(left) {
			return false, nil
		}
		right, err := evalExpr(ctx, e.Right)
		if err != nil {
			return nil, err
		}
		return isTruthy(right), nil
	case "or":
		if isTruthy(left) {
			return true, nil
		}
		right, err := evalExpr(ctx, e.Right)
		if err != nil {
			return nil, err
		}
		return isTruthy(right), nil
	}

	right, err := evalExpr(ctx, e.Right)
	if err != nil {
		return nil, err
	}

	switch e.Op {
	case "+":
		return toString(left) + toString(right), nil
	case "==":
		return isEqual(left, right), nil
	case "!=":
		return !isEqual(left, right), nil
	default:
		return nil, fmt.Errorf("unknown operator %q", e.Op)
	}
}

func evalUnaryExpr(ctx *Context, e *parser.UnaryExpr) (interface{}, error) {
	val, err := evalExpr(ctx, e.Operand)
	if err != nil {
		return nil, err
	}
	if e.Op == "not" {
		return !isTruthy(val), nil
	}
	return nil, fmt.Errorf("unknown unary operator %q", e.Op)
}

func evalCallExpr(ctx *Context, e *parser.CallExpr) (interface{}, error) {
	fn, ok := ctx.Builtins[e.Func]
	if !ok {
		return nil, fmt.Errorf("undefined function %q", e.Func)
	}
	var args []interface{}
	for _, argExpr := range e.Args {
		val, err := evalExpr(ctx, argExpr)
		if err != nil {
			return nil, err
		}
		args = append(args, val)
	}
	return fn(args...)
}

func evalObjectLit(ctx *Context, e *parser.ObjectLit) (interface{}, error) {
	obj := make(map[string]interface{}, len(e.Fields))
	for _, f := range e.Fields {
		val, err := evalExpr(ctx, f.Value)
		if err != nil {
			return nil, err
		}
		obj[f.Key] = val
	}
	return obj, nil
}

func evalListLit(ctx *Context, e *parser.ListLit) (interface{}, error) {
	list := make([]interface{}, 0, len(e.Elements))
	for _, elem := range e.Elements {
		val, err := evalExpr(ctx, elem)
		if err != nil {
			return nil, err
		}
		list = append(list, val)
	}
	return list, nil
}

```

### Core Architecture Module: `agentfile/eval/evaluator.go`
```
package eval

import (
	"fmt"

	"github.com/anthropics/agentsmesh/agentfile/parser"
)

// Eval executes a parsed AgentFile Program and returns the BuildResult.
// Declarations set up context (agent command, env, USE_ENV_BUNDLE refs);
// statements execute build logic (arg, file, mkdir, if, for, etc.).
//
// After the EnvBundle refactor, environment values flow exclusively through
// `ENV X = expr` literal/expression declarations and USE_ENV_BUNDLE
// references — no implicit credential merge pass any more.
func Eval(prog *parser.Program, ctx *Context) error {
	for _, decl := range prog.Declarations {
		if err := evalDecl(ctx, decl); err != nil {
			return fmt.Errorf("line %d: %w", decl.Pos().Line, err)
		}
	}
	for _, stmt := range prog.Statements {
		if err := evalStmt(ctx, stmt); err != nil {
			return fmt.Errorf("line %d: %w", stmt.Pos().Line, err)
		}
	}
	return nil
}

// ApplyModeArgs prepends the active mode's declared args to LaunchArgs.
// Called after Eval and before ApplyRemoves.
func ApplyModeArgs(r *BuildResult) {
	if r.ModeArgs == nil || r.Mode == "" {
		return
	}
	if args, ok := r.ModeArgs[r.Mode]; ok && len(args) > 0 {
		r.LaunchArgs = append(args, r.LaunchArgs...)
	}
}

func evalStmt(ctx *Context, stmt parser.Statement) error {
	switch s := stmt.(type) {
	case *parser.ArgStmt:
		return evalArgStmt(ctx, s)
	case *parser.FileStmt:
		return evalFileStmt(ctx, s)
	case *parser.MkdirStmt:
		return evalMkdirStmt(ctx, s)
	case *parser.AssignStmt:
		return evalAssignStmt(ctx, s)
	case *parser.IfStmt:
		return evalIfStmt(ctx, s)
	case *parser.ForStmt:
		return evalForStmt(ctx, s)
	default:
		return fmt.Errorf("unknown statement type %T", stmt)
	}
}

func evalArgStmt(ctx *Context, s *parser.ArgStmt) error {
	if s.When != nil {
		cond, err := evalExpr(ctx, s.When)
		if err != nil {
			return err
		}
		if !isTruthy(cond) {
			return nil
		}
	}
	for _, argExpr := range s.Args {
		val, err := evalExpr(ctx, argExpr)
		if err != nil {
			return err
		}
		ctx.Result.LaunchArgs = append(ctx.Result.LaunchArgs, toString(val))
	}
	return nil
}

func evalFileStmt(ctx *Context, s *parser.FileStmt) error {
	if s.When != nil {
		cond, err := evalExpr(ctx, s.When)
		if err != nil {
			return err
		}
		if !isTruthy(cond) {
			return nil
		}
	}
	path, err := evalExpr(ctx, s.Path)
	if err != nil {
		return err
	}
	content, err := evalExpr(ctx, s.Content)
	if err != nil {
		return err
	}
	ctx.Result.FilesToCreate = append(ctx.Result.FilesToCreate, FileEntry{
		Path:    toString(path),
		Content: toString(content),
		Mode:    s.Mode,
	})
	return nil
}

func evalMkdirStmt(ctx *Context, s *parser.MkdirStmt) error {
	path, err := evalExpr(ctx, s.Path)
	if err != nil {
		return err
	}
	ctx.Result.Dirs = append(ctx.Result.Dirs, toString(path))
	return nil
}

func evalAssignStmt(ctx *Context, s *parser.AssignStmt) error {
	val, err := evalExpr(ctx, s.Value)
	if err != nil {
		return err
	}
	ctx.Set(s.Name, val)
	return nil
}

func evalIfStmt(ctx *Context, s *parser.IfStmt) error {
	cond, err := evalExpr(ctx, s.Condition)
	if err != nil {
		return err
	}
	if isTruthy(cond) {
		for _, stmt := range s.Body {
			if err := evalStmt(ctx, stmt); err != nil {
				return err
			}
		}
	} else if s.Else != nil {
		for _, stmt := range s.Else {
			if err := evalStmt(ctx, stmt); err != nil {
				return err
			}
		}
	}
	return nil
}

func evalBlock(ctx *Context, stmts []parser.Statement) error {
	for _, stmt := range stmts {
		if err := evalStmt(ctx, stmt); err != nil {
			return err
		}
	}
	return nil
}

```

### Core Architecture Module: `agentfile/eval/evaluator_helpers.go`
```
package eval

import (
	"fmt"

	"github.com/anthropics/agentsmesh/agentfile/parser"
)

const maxForIterations = 10000

func evalForStmt(ctx *Context, s *parser.ForStmt) error {
	iterVal, err := evalExpr(ctx, s.Iter)
	if err != nil {
		return err
	}

	switch iter := iterVal.(type) {
	case map[string]interface{}:
		if len(iter) > maxForIterations {
			return fmt.Errorf("for: map has %d entries, exceeds limit %d", len(iter), maxForIterations)
		}
		for k, v := range iter {
			if s.Value != "" {
				ctx.Set(s.Key, k)
				ctx.Set(s.Value, v)
			} else {
				ctx.Set(s.Key, k)
			}
			if err := evalBlock(ctx, s.Body); err != nil {
				return err
			}
		}
	case []interface{}:
		if len(iter) > maxForIterations {
			return fmt.Errorf("for: list has %d elements, exceeds limit %d", len(iter), maxForIterations)
		}
		for i, v := range iter {
			if s.Value != "" {
				ctx.Set(s.Key, float64(i))
				ctx.Set(s.Value, v)
			} else {
				ctx.Set(s.Key, v)
			}
			if err := evalBlock(ctx, s.Body); err != nil {
				return err
			}
		}
	default:
		return fmt.Errorf("for: expected map or list, got %T", iterVal)
	}
	return nil
}

```

### Core Architecture Module: `agentfile/eval/values.go`
```
package eval

import (
	"fmt"
	"reflect"
	"regexp"
	"strconv"
	"strings"
)

// interpolatePattern matches ${var.path} for string interpolation.
var interpolatePattern = regexp.MustCompile(`\$\{([a-zA-Z_][a-zA-Z0-9_.]*)\}`)

// isTruthy determines the truthiness of an AgentFile value.
func isTruthy(val interface{}) bool {
	if val == nil {
		return false
	}
	switch v := val.(type) {
	case bool:
		return v
	case string:
		return v != ""
	case float64:
		return v != 0
	case int:
		return v != 0
	case map[string]interface{}:
		return len(v) > 0
	case []interface{}:
		return len(v) > 0
	default:
		return true
	}
}

// isEqual compares two AgentFile values.
func isEqual(a, b interface{}) bool {
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}
	// Use DeepEqual for maps and slices (fmt.Sprintf is order-dependent for maps)
	return reflect.DeepEqual(a, b)
}

// toString converts an AgentFile value to string.
func toString(val interface{}) string {
	if val == nil {
		return ""
	}
	switch v := val.(type) {
	case string:
		return v
	case bool:
		if v {
			return "true"
		}
		return "false"
	case float64:
		if v == float64(int64(v)) {
			return strconv.FormatInt(int64(v), 10)
		}
		return strconv.FormatFloat(v, 'f', -1, 64)
	case int:
		return strconv.Itoa(v)
	default:
		return fmt.Sprintf("%v", v)
	}
}

// interpolate replaces ${var.path} references in a string with context values.
// E.g., "http://127.0.0.1:${mcp.port}/mcp" → "http://127.0.0.1:19000/mcp"
func interpolate(ctx *Context, s string) string {
	if !strings.Contains(s, "${") {
		return s
	}
	return interpolatePattern.ReplaceAllStringFunc(s, func(match string) string {
		sub := interpolatePattern.FindStringSubmatch(match)
		if len(sub) < 2 {
			return match
		}
		val := resolveVarPath(ctx, sub[1])
		if val == nil {
			return match // leave unreplaced if not found
		}
		return toString(val)
	})
}

// resolveVarPath resolves a dot-separated variable path like "mcp.port".
func resolveVarPath(ctx *Context, path string) interface{} {
	parts := strings.SplitN(path, ".", 2)
	root, ok := ctx.Get(parts[0])
	if !ok {
		return nil
	}
	if len(parts) == 1 {
		return root
	}
	remaining := parts[1]
	current := root
	for remaining != "" {
		parts = strings.SplitN(remaining, ".", 2)
		nested, found := GetNested(current, parts[0])
		if !found {
			return nil
		}
		current = nested
		if len(parts) == 1 {
			break
		}
		remaining = parts[1]
	}
	return current
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #472** (2026-09-23): **[Bug] Hardcoded JWT fallback secret enables token forgery**
  *Symptoms*: ### Summary  ## Summary  When `JWT_SECRET` is unavailable, the application uses the hardcoded fallback `change-me-in-production` from [`config.go:66`](https://github.com/AgentsMesh/AgentsMesh/blob/1f90b14194d03c353df4f281a05442afe93cae34/config.go#L66). The same value is used for JWT signing and verification, allowing an attacker who knows the public default to forge authentication tokens in deployments that retain this fallback.  ## Affected Version  Affected version: commit `1f90b14194d03c353df4f281a05442afe93cae34` on branch `main`.  ## Technical Details and Root Cause  The configuration contains the concrete static fallback `change-me-in-production` at [`config.go:66`](https://github.com/AgentsMesh/AgentsMesh/blob/1f90b14194d03c353df4f281a05442afe93cae34/config.go#L66).  JWT generation uses the configured secret at [`token_generate.go:41`](https://github.com/AgentsMesh/AgentsMesh/blob/1f90b14194d03c353df4f281a05442afe93cae34/token_generate.go#L41), while authentication uses the configured key when parsing and verifying tokens at [`auth.go:78`](https://github.com/AgentsMesh/AgentsMesh/blob/1f90b14194d03c353df4f281a05442afe93cae34/auth.go#L78). Consequently, any deployment that does not override the fallback shares a publicly known HMAC JWT key. Tokens containing identity and permission claims can therefore be forged and presented as authenticated credentials.  ## Impact  An attacker who can reach an affected authentication-protected deployment and knows that it retained th
  **Post-Mortem & Fix Analysis**:
  > I'd like to take this issue.  **Scope** - In: remove the hardcoded JWT fallback `change-me-in-production`; refuse to start authentication (or fail closed at token issue/verify) when `JWT_SECRET` is unset/empty in non-test environments. - Out: multi-tenant key rotation, JWKS, or a broader auth redesign. - Testing: unit tests that sign/verify fail closed without `JWT_SECRET`, and that an explicit secret still works.  If maintainers prefer a generated per-boot ephemeral secret with a loud warning instead of hard fail, happy to adjust after direction.

- **Issue #417** (2026-05-29): **[Bug] 该 Runner 暂不支持任何智能体**
  *Symptoms*: ### Summary  创建完成runner，准备创建pod，结果表示：  <img width="825" height="498" alt="Image" src="https://github.com/user-attachments/assets/0a092fa5-78f9-4667-a688-f7268393f3cc" />  ### Steps to reproduce  同上  ### Expected behavior  正常识别我机器的opencode并使用它进行工作  ### Actual behavior  没有识别到  ### Logs / screenshots  ```shell  ```  ### Version / commit  _No response_  ### Environment  _No response_
  **Post-Mortem & Fix Analysis**:
  > @gylove1994 ack
  >  # 环境报告  ## Incus 容器环境  | 项目 | 值 | |------|----| | 平台 | Incus 7.0.0 | | 项目 | agentsmesh-worker | | 实例 | agentsmesh-runner | | 类型 | Container (LXC) | | 架构 | x86_64 | | 存储池 | default (driver: dir) | | 网络 | eth0 → incusbr0（default 项目 bridge，NAT） | | 自动启动 | boot.autostart=true |  ## 基础镜像  | 项目 | 值 | |------|----| | 来源 | images.linuxcontainers.org (simplestreams) | | 别名 | ubuntu/noble / ubuntu/24.04 | | 描述 | Ubuntu noble amd64 (20260527_07:42) | | OS | Ubuntu 24.04.4 LTS | | 类型 | squashfs container | | 大小 | 139.02 MiB |  ## 容器内操作系统信息  | 项目 | 值 | |------|----| | 发行版 | Ubuntu 24.04.4 LTS (Noble) | | 内核 | 宿主机内核（Arch 7.0.x） | | CPU | 32 | | cgroup | v2 |  ## 已安装软件  | 组件 | 版本 | 安装方式 | |------|------|----------| | AgentsMesh Runner | 0.38.1 | https://agentsmesh.ai/install.sh | | Cursor CLI (agent/cursor) | 2026.05.27-f e9a6e2 | https://cursor.com/install | | OpenCode | 1.15.7 | install.sh --binary | | curl | 8.5.0 | 镜像自带 | | git | 2.43.0 | 镜像自带 | | nodejs / npm | v18.19.1 / 9.2.0 | apt |  ## Agen
  > @gylove1994 感谢反馈，尤其是这份非常详尽的 Incus 环境报告，帮了大忙 🙏  定位到两个独立根因：  1. **OpenCode 识别不到** —— 你用 `install.sh --binary` 装的 OpenCode 默认落在 `~/.opencode/bin/opencode`。Runner 在 Incus 容器里以非交互 / 服务方式启动时，继承到的 `PATH` 通常只有 `/usr/bin:/bin:...`，而旧版 Runner 的 fallback 搜索路径没覆盖 `~/.opencode/bin`，所以探测不到，前端就报「该 Runner 暂不支持任何智能体」。 2. **Cursor CLI 之前未接入** —— 你装的 `cursor-agent` 当时 Runner 还没注册这个 agent。  **已在 v0.39.0 修复并发布**（#418）： - 扩展了智能体 fallback 搜索路径，新增 `~/.opencode/bin`、`~/.cursor/bin`、`~/bin`，OpenCode 这类装在用户私有目录的 agent 现在能被正确发现； - 新增 **Cursor CLI**（`cursor-agent`）原生支持，可直接作为 builtin agent 使用（用 `cursor-agent login` 登录即可，无需额外配 API Key）。  **升级方式**（在容器内重新跑安装脚本即可升级到 0.39.0）： ```bash curl -fsSL https://agentsmesh.ai/install.sh | sh # 然后按你原来的方式重启 runner 服务，再重新创建 pod ```  升级后应该能在智能体列表里同时看到 `opencode` 和 `cursor-cli`。麻烦验证一下，有任何问题随时在这里回复 🙌 

- **Issue #375** (2026-05-18): **[Bug] Unable to find skills registered at the org level in the marketplace.**
  *Symptoms*: ### Summary  When I registered some repository-level skills, I wanted to select these skills in the repo, but found that there were no marketplace skills available.  <img width="1618" height="944" alt="Image" src="https://github.com/user-attachments/assets/71dcdc9c-ce17-4510-8971-10e4b3787569" />  ### Steps to reproduce  1. registered some repository-level skills 2.repo -> choose one repo -> extensions -> skills -> add  ### Expected behavior  can choose repository-level skills  ### Actual behavior  No marketplace skills appeared.  ### Logs / screenshots  ```shell  ```  ### Version / commit  _No response_  ### Environment  _No response_

- **Issue #346** (2026-05-10): **[Bug] The Pod popout window redirects abnormally.**
  *Symptoms*: ### Summary  The pod popout window redirects abnormally. The popout window redirects to the login page even when the user is already logged in. After logging in, it redirects to the AgentsMesh main page instead of the pod popout page.  <img width="644" height="214" alt="Image" src="https://github.com/user-attachments/assets/1a54c67a-8e53-4f85-befb-f077a892c6eb" />  ### Steps to reproduce  1.create a pod 2.click pod popout button  ### Expected behavior  popout windows show and display coding agent context  ### Actual behavior  redirect to login page  ### Logs / screenshots  ```shell  ```  ### Version / commit  _No response_  ### Environment  _No response_

- **Issue #345** (2026-05-10): **[Bug] Unable to create an API key normally.**
  *Symptoms*: ### Summary  Unable to create an API key normally. The created key content is empty, and the copied value is empty as well.  <img width="1274" height="650" alt="Image" src="https://github.com/user-attachments/assets/85d313df-b690-461a-9eec-4ac5d3792bfc" />  ### Steps to reproduce  1.Setting -> Orgs -> API Key 2.Create API Key  ### Expected behavior  The API key is created and displayed normally.  ### Actual behavior  The API key is displayed as empty.  ### Logs / screenshots  ```shell  ```  ### Version / commit  _No response_  ### Environment  _No response_
  **Post-Mortem & Fix Analysis**:
  > Fixed in #349 (commit 93f56e498).  The Rust `ApiKey` DTO did not declare a `raw_key` field, even though the backend returns the freshly generated key under that name on POST /api-keys. The deserializer therefore dropped the only response that ever carries the plaintext, leaving the UI with an empty value to copy. The DTO now exposes `raw_key`, the api-client surface keeps it on the create response, and the wasm relay preserves it across the boundary.  Closing as resolved.

- **Issue #343** (2026-05-10): **[Bug] When importing GitLab repositories using a Git PAT, clicking the “Import repo” button results in an error.**
  *Symptoms*: ### Summary  When importing GitLab repositories using a Git PAT, clicking the “Import repo” button results in an error. If we don’t use a Git PAT and manually enter the link directly, it works normally.  <img width="1986" height="1612" alt="Image" src="https://github.com/user-attachments/assets/10a4f93f-6636-4c6b-a114-ed7d2480ac46" />  ### Steps to reproduce  1.register a Git PAT 2.choose a repo 3.click import repository button  ### Expected behavior  repo was imported successful  ### Actual behavior  It shows a prompt saying that importing the repository failed.  ### Logs / screenshots  ```shell  ```  ### Version / commit  _No response_  ### Environment  _No response_
  **Post-Mortem & Fix Analysis**:
  > Fixed in #349 (commit 93f56e498).  Same root cause as #342: the `ProviderRepository` Rust DTO was missing the clone-URL fields (`http_clone_url` / `ssh_clone_url`) the Go backend returns. The "Import repo" call passed an empty clone URL through to the worktree provisioning step, which then errored out. The DTO is now field-complete and the import path round-trips cleanly.  Closing as resolved.

- **Issue #342** (2026-05-10): **[Bug] When importing GitLab repositories using a Git PAT, all repository names show as “no description.”**
  *Symptoms*: ### Summary  When importing GitLab repositories using a Git PAT, all repository names show as “no description.”  <img width="1890" height="1604" alt="Image" src="https://github.com/user-attachments/assets/bd6762a5-7569-4802-84f5-c9e5c939ba0d" />  ### Steps to reproduce  1. register a Git PAT 2. import repo  ### Expected behavior  repo list display with repo name  ### Actual behavior  repo name is “no description.”  ### Logs / screenshots  ```shell  ```  ### Version / commit  _No response_  ### Environment  _No response_
  **Post-Mortem & Fix Analysis**:
  > Fixed in #349 (commit 93f56e498).  The Rust `ProviderRepository` DTO did not match the Go backend response — the field carrying the repo description was being silently dropped during deserialization, so every imported repo rendered as "no description". The DTO now mirrors the backend payload exactly and the regression is covered by a wrapper-envelope round-trip test.  Closing as resolved.

- **Issue #291** (2026-04-14): **[Bug] repo re-import error after repo delete**
  *Symptoms*: ### Summary  if you delete a repo, then you cannot import repo again   ### Steps to reproduce  1. import a repo 2. delete it 3. re-import it  ### Expected behavior  the repo can be re-imported  ### Actual behavior  error out  ### Logs / screenshots  ```shell Failed to load resource: the server responded with a status of 402 () f20d487a9124cf45.js:1 Failed to import repository: ApiError: API Error: 402      at i (bfa4138db5823617.js:1:1695)     at async handleImport (f20d487a9124cf45.js:1:75888) /api/v1/orgs/zyf1994…pace/repositories:1   Failed to load resource: the server responded with a status of 402 () f20d487a9124cf45.js:1 Failed to import repository: ApiError: API Error: 402      at i (bfa4138db5823617.js:1:1695)     at async handleImport (f20d487a9124cf45.js:1:75888) handleImport	@	f20d487a9124cf45.js:1 ```  ### Version / commit  _No response_  ### Environment  _No response_

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

### Incident Patch 1: `d38e3932` (2026-09-23)
**Commit Message**: ﻿fix(auth): fail closed on missing/default JWT_SECRET (#474)

Remove the published default secret fallback. Non-debug startup now
refuses to boot when JWT_SECRET is empty or equals
change-me-in-production (#472). Debug mode continues with a warning.

Fixes #472

**File**: `backend/cmd/server/main.go` (modified, +4/-1)
```diff
@@ -6,6 +6,7 @@ import (
 	"log/slog"
 	"os"
 
+	"github.com/anthropics/agentsmesh/backend/internal/api/rest"
 	"github.com/anthropics/agentsmesh/backend/internal/config"
 	notifDomain "github.com/anthropics/agentsmesh/backend/internal/domain/notification"
 	"github.com/anthropics/agentsmesh/backend/internal/infra"
@@ -14,7 +15,6 @@ import (
 	"github.com/anthropics/agentsmesh/backend/internal/infra/logger"
 	otelinit "github.com/anthropics/agentsmesh/backend/internal/infra/otel"
 	"github.com/anthropics/agentsmesh/backend/internal/infra/websocket"
-	"github.com/anthropics/agentsmesh/backend/internal/api/rest"
 	"github.com/anthropics/agentsmesh/backend/internal/service/agentpod"
 	channelService "github.com/anthropics/agentsmesh/backend/internal/service/channel"
 	"github.com/anthropics/agentsmesh/backend/internal/service/instance"
@@ -36,6 +36,9 @@ func main() {
 		log.Fatalf("Failed to load config: %v", err)
 	}
 	cfg.WarnInsecureDefaults()
+	if err := cfg.ValidateJWTSecret(); err != nil {
+		log.Fatalf("Refusing to start with insecure JWT configuration: %v", err)
+	}
 
 	appLogger, err := logger.New(logger.Config{
 		Level:      cfg.Log.Level,
```

**File**: `backend/internal/config/config.go` (modified, +25/-6)
```diff
@@ -1,6 +1,7 @@
 package config
 
 import (
+	"fmt"
 	"log/slog"
 	"time"
 )
@@ -63,7 +64,9 @@ func Load() (*Config, error) {
 		},
 
 		JWT: JWTConfig{
-			Secret:          getEnv("JWT_SECRET", "change-me-in-production"),
+			// Empty default: a published shared secret enables token forgery.
+			// Non-debug startup must fail closed (ValidateJWTSecret).
+			Secret:          getEnv("JWT_SECRET", ""),
 			ExpirationHours: getEnvInt("JWT_EXPIRATION_HOURS", 24),
 		},
 
@@ -95,8 +98,8 @@ func Load() (*Config, error) {
 		},
 
 		Log: LogConfig{
-			Level:  getEnv("LOG_LEVEL", "info"),
-			Format: getEnv("LOG_FORMAT", "text"),
+			Level:      getEnv("LOG_LEVEL", "info"),
+			Format:     getEnv("LOG_FORMAT", "text"),
 			FilePath:   getEnv("LOG_FILE", ""),
 			MaxSizeMB:  getEnvInt("LOG_MAX_SIZE_MB", 100),
 			MaxBackups: getEnvInt("LOG_MAX_BACKUPS", 5),
@@ -200,15 +203,31 @@ func Load() (*Config, error) {
 	}, nil
 }
 
+const insecureJWTSecret = "change-me-in-production"
+
+// ValidateJWTSecret fails closed when JWT signing uses an empty or published
+// default key outside debug mode (#472).
+func (c *Config) ValidateJWTSecret() error {
+	secret := c.JWT.Secret
+	if secret == "" || secret == insecureJWTSecret {
+		if c.Server.Debug {
+			slog.Warn("SECURITY: JWT_SECRET is unset or the published default; continuing only because DEBUG is enabled")
+			return nil
+		}
+		return fmt.Errorf("JWT_SECRET is required and must not be the published default; set a strong random secret via environment variable")
+	}
+	return nil
+}
+
 func (c *Config) WarnInsecureDefaults() {
 	if c.Server.InternalAPISecret == "change-me-internal-secret" {
 		slog.Warn("SECURITY: INTERNAL_API_SECRET is using the default value; set a strong random secret via environment variable")
 	}
-	if c.JWT.Secret == "change-me-in-production" {
+	if c.JWT.Secret == "" || c.JWT.Secret == insecureJWTSecret {
 		if c.Server.Debug {
-			slog.Warn("SECURITY: JWT_SECRET is using the default value; set a strong random secret via environment variable")
+			slog.Warn("SECURITY: JWT_SECRET is unset or the published default; set a strong random secret via environment variable")
 		} else {
-			slog.Error("SECURITY: JWT_SECRET is using the default value in non-debug mode; this is a critical security risk — set JWT_SECRET environment variable")
+			slog.Error("SECURITY: JWT_SECRET is unset or the published default in non-debug mode; this is a critical security risk — set JWT_SECRET environment variable")
 		}
 	}
 }
```

**File**: `backend/internal/config/jwt_secret_test.go` (added, +39/-0)
```diff
@@ -0,0 +1,39 @@
+package config
+
+import (
+	"testing"
+
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+)
+
+func TestValidateJWTSecret(t *testing.T) {
+	t.Run("fails closed on empty secret outside debug", func(t *testing.T) {
+		cfg := &Config{JWT: JWTConfig{Secret: ""}, Server: ServerConfig{Debug: false}}
+		require.Error(t, cfg.ValidateJWTSecret())
+	})
+
+	t.Run("fails closed on published default outside debug", func(t *testing.T) {
+		cfg := &Config{
+			JWT:    JWTConfig{Secret: "change-me-in-production"},
+			Server: ServerConfig{Debug: false},
+		}
+		require.Error(t, cfg.ValidateJWTSecret())
+	})
+
+	t.Run("allows empty/default only in debug", func(t *testing.T) {
+		cfg := &Config{
+			JWT:    JWTConfig{Secret: "change-me-in-production"},
+			Server: ServerConfig{Debug: true},
+		}
+		assert.NoError(t, cfg.ValidateJWTSecret())
+	})
+
+	t.Run("accepts an explicit strong secret", func(t *testing.T) {
+		cfg := &Config{
+			JWT:    JWTConfig{Secret: "a-strong-random-value"},
+			Server: ServerConfig{Debug: false},
+		}
+		assert.NoError(t, cfg.ValidateJWTSecret())
+	})
+}
```

---

### Incident Patch 2: `3d242f57` (2026-07-24)
**Commit Message**: fix(terminal): harden PTY relay rendering lifecycle (#470)

* fix(terminal): harden PTY relay rendering lifecycle

Make relay generations, PTY snapshots, Unicode width handling, and desktop/Web delivery deterministic across reconnects.

Generated with Codex

* refactor(terminal): split relay lifecycle owners

Separate production and test responsibilities to enforce repository file-size contracts without changing runtime behavior.

Generated with Codex

* fix(ci): satisfy terminal lint and Gazelle contracts

* fix(test): make terminal contracts portable

* fix(ci): declare runfiles test dependency

**File**: `.github/workflows/bazel.yml` (modified, +79/-2)
```diff
@@ -49,6 +49,8 @@ jobs:
         run: bash tools/identifier-lint/lint.sh
       - name: Self-hosted Traefik route contract
         run: bash deploy/traefik_connect_routes_test.sh
+      - name: Dev frontend lifecycle contract
+        run: bash deploy/dev/frontend_services_test.sh
       - name: Verify desktop-only crate isolation
         run: |
           set -euo pipefail
@@ -134,6 +136,8 @@ jobs:
     needs: smoke
     steps:
       - uses: actions/checkout@v6
+        with:
+          fetch-depth: 0
       - uses: bazel-contrib/setup-bazel@0.9.1
         with:
           bazelisk-cache: true
@@ -153,6 +157,63 @@ jobs:
       # invoke them explicitly here. Failures here mean a real fork/exec
       # path regressed.
       - run: bazel test --flaky_test_attempts=2 //runner/internal/poddaemon:poddaemon_integration_test
+      - name: Go architecture changed-line coverage (>=95% per changed production file)
+        env:
+          PR_BASE_SHA: ${{ github.event.pull_request.base.sha }}
+          PUSH_BASE_SHA: ${{ github.event.before }}
+        run: |
+          bazel test //tools/coverage:go_diff_coverage_test
+          bazel coverage \
+            --combined_report=lcov \
+            --instrument_test_targets \
+            '--instrumentation_filter=//(runner/internal/(terminal|client|relay|runner|agents/mockagent)|relay/internal/protocol|clients/web/scripts/runewidth-profile)' \
+            --cache_test_results=no \
+            //runner/internal/terminal/vt:vt_test \
+            //runner/internal/terminal:terminal_test \
+            //runner/internal/terminal/aggregator:aggregator_test \
+            //runner/internal/terminal/detector:detector_test \
+            //runner/internal/agents/mockagent:mockagent_test \
+            //runner/internal/client:client_test \
+            //runner/internal/relay:relay_test \
+            //runner/internal/runner:runner_test \
+            //relay/internal/protocol:protocol_test \
+            //clients/web/scripts/runewidth-profile:generated_profile_check
+
+          base_sha="$PR_BASE_SHA"
+          if [[ -z "$base_sha" ]]; then
+            base_sha="$PUSH_BASE_SHA"
+          fi
+          if [[ -z "$base_sha" || "$base_sha" =~ ^0+$ ]] || \
+              ! git cat-file -e "${base_sha}^{commit}" 2>/dev/null; then
+            base_sha=$(git rev-parse HEAD^)
+          fi
+
+          check_changed_coverage() {
+            local prefix="$1"
+            shift
+            tools/coverage/go_diff_coverage.sh \
+              --lcov bazel-out/_coverage/_coverage_report.dat \
+              --base "$base_sha" \
+              --include "$prefix" \
+              --threshold 95 \
+              "$@"
+          }
+
+          check_changed_coverage runner/internal/runner
+          check_changed_coverage runner/internal/client
+          check_changed_coverage runner/internal/relay
+          check_changed_coverage runner/internal/terminal --exact-directory
+          check_changed_coverage runner/internal/terminal/vt --exact-directory
+          check_changed_coverage runner/internal/terminal/aggregator --exact-directory
+          check_changed_coverage runner/internal/terminal/detector --exact-directory
+          # The no-op fallback is selected only on non-Unix targets and is
+          # therefore absent from Ubuntu's LCOV by construction. Keep the
+          # platform exclusion explicit; the Unix implementation remains
+          # subject to the same per-file >=95% gate as every other owner.
+          check_changed_coverage runner/internal/agents/mockagent \
+            --exclude-prefix runner/internal/agents/mockagent/pty_render_resize_other.go
+          check_changed_coverage relay/internal/protocol --exact-directory
+          check_changed_coverage clients/web/scripts/runewidth-profile --exact-directory
 
   rust:
     name: Rust Core (clients/core)
@@ -173,6 +234,20 @@ jobs:
       # tagged `manual + requires-darwin`, wasm_pkg needs wasm-bindgen —
       #
```

**File**: `MODULE.bazel` (modified, +1/-1)
```diff
@@ -57,7 +57,7 @@ go_sdk.download(version = "1.25.0")
 # its `require` blocks and emits one `go_deps` import per dependency.
 go_deps = use_extension("@gazelle//:extensions.bzl", "go_deps")
 go_deps.from_file(go_mod = "//:go.mod")
-use_repo(go_deps, "com_connectrpc_connect", "com_github_alicebob_miniredis_v2", "com_github_aws_aws_sdk_go_v2", "com_github_aws_aws_sdk_go_v2_config", "com_github_aws_aws_sdk_go_v2_credentials", "com_github_aws_aws_sdk_go_v2_service_s3", "com_github_coreos_go_oidc_v3", "com_github_creack_pty", "com_github_creativeprojects_go_selfupdate", "com_github_crewjam_saml", "com_github_gin_contrib_cors", "com_github_gin_gonic_gin", "com_github_go_acme_lego_v4", "com_github_go_git_go_git_v5", "com_github_go_ldap_ldap_v3", "com_github_golang_jwt_jwt_v5", "com_github_golang_migrate_migrate_v4", "com_github_google_uuid", "com_github_gorilla_websocket", "com_github_kardianos_service", "com_github_lib_pq", "com_github_masterminds_semver_v3", "com_github_mattn_go_runewidth", "com_github_maxmind_mmdbwriter", "com_github_ndolestudio_lemonsqueezy_go", "com_github_oschwald_maxminddb_golang", "com_github_pelletier_go_toml_v2", "com_github_pkg_browser", "com_github_redis_go_redis_extra_redisotel_v9", "com_github_redis_go_redis_v9", "com_github_resend_resend_go_v2", "com_github_robfig_cron_v3", "com_github_smartwalle_alipay_v3", "com_github_spf13_viper", "com_github_stretchr_testify", "com_github_stripe_stripe_go_v76", "com_github_thejerf_suture_v4", "com_github_uptrace_opentelemetry_go_extra_otelgorm", "com_github_userexistserror_conpty", "com_github_wechatpay_apiv3_wechatpay_go", "com_github_yuin_goldmark", "in_gopkg_yaml_v3", "io_gorm_driver_postgres", "io_gorm_driver_sqlite", "io_gorm_gorm", "io_gorm_plugin_dbresolver", "io_opentelemetry_go_contrib_instrumentation_github_com_gin_gonic_gin_otelgin", "io_opentelemetry_go_contrib_instrumentation_google_golang_org_grpc_otelgrpc", "io_opentelemetry_go_contrib_instrumentation_net_http_otelhttp", "io_opentelemetry_go_otel", "io_opentelemetry_go_otel_exporters_otlp_otlpmetric_otlpmetricgrpc", "io_opentelemetry_go_otel_exporters_otlp_otlptrace_otlptracegrpc", "io_opentelemetry_go_otel_exporters_stdout_stdoutmetric", "io_opentelemetry_go_otel_exporters_stdout_stdouttrace", "io_opentelemetry_go_otel_metric", "io_opentelemetry_go_otel_sdk", "io_opentelemetry_go_otel_sdk_metric", "io_opentelemetry_go_otel_trace", "org_golang_google_grpc", "org_golang_google_grpc_security_advancedtls", "org_golang_google_protobuf", "org_golang_x_crypto", "org_golang_x_oauth2", "org_golang_x_sync", "org_golang_x_term", "org_golang_x_time")
+use_repo(go_deps, "com_connectrpc_connect", "com_github_alicebob_miniredis_v2", "com_github_aws_aws_sdk_go_v2", "com_github_aws_aws_sdk_go_v2_config", "com_github_aws_aws_sdk_go_v2_credentials", "com_github_aws_aws_sdk_go_v2_service_s3", "com_github_clipperhouse_uax29_v2", "com_github_coreos_go_oidc_v3", "com_github_creack_pty", "com_github_creativeprojects_go_selfupdate", "com_github_crewjam_saml", "com_github_gin_contrib_cors", "com_github_gin_gonic_gin", "com_github_go_acme_lego_v4", "com_github_go_git_go_git_v5", "com_github_go_ldap_ldap_v3", "com_github_golang_jwt_jwt_v5", "com_github_golang_migrate_migrate_v4", "com_github_google_uuid", "com_github_gorilla_websocket", "com_github_kardianos_service", "com_github_lib_pq", "com_github_masterminds_semver_v3", "com_github_mattn_go_runewidth", "com_github_maxmind_mmdbwriter", "com_github_ndolestudio_lemonsqueezy_go", "com_github_oschwald_maxminddb_golang", "com_github_pelletier_go_toml_v2", "com_github_pkg_browser", "com_github_redis_go_redis_extra_redisotel_v9", "com_github_redis_go_redis_v9", "com_github_resend_resend_go_v2", "com_github_robfig_cron_v3", "com_github_smartwalle_alipay_v3", "com_github_spf13_viper", "com_github_stretchr_testify", "com_github_stripe_stripe_go_v76", "com_github_thejerf_suture_v4", "com_github_uptrace_opentelemetry_go_extra_otelgorm", "com_github_userexistserror_conpty", "com_github_
```

**File**: `build_defs/web/vitest.bzl` (modified, +4/-2)
```diff
@@ -19,7 +19,8 @@ def vitest_test(
         size = "medium",
         timeout = None,
         tags = None,
-        chdir = None):
+        chdir = None,
+        extra_args = None):
     """Run `vitest run` against a set of sources as a Bazel test.
 
     Args:
@@ -33,6 +34,7 @@ def vitest_test(
         timeout: Optional timeout string.
         tags: Bazel tags forwarded verbatim.
         chdir: Working directory (defaults to package path).
+        extra_args: Optional Vitest CLI arguments, for example coverage flags.
     """
     kwargs = {}
     if timeout:
@@ -48,7 +50,7 @@ def vitest_test(
             config,
             "--reporter=default",
             "--no-color",
-        ],
+        ] + (extra_args or []),
         data = (data or []) + srcs + [config] + (deps or []) + [
             "//:node_modules/vitest",
         ],
```

**File**: `clients/core/crates/node-bridge/index.d.ts` (modified, +8/-3)
```diff
@@ -41,6 +41,7 @@ export class AppState {
   appAutopilotUpdateThinkingProto(reqBytes: Array<number>): void
   appAvailableRunnersJson(): string
   appAvailableRunnersProto(): Array<number>
+  appChannelAdvanceLastRead(channelId: number, messageId: number): void
   appChannelApplyFetchedChannel(respBytes: Array<number>): void
   appChannelApplyFetchedChannels(respBytes: Array<number>): void
   appChannelApplyFetchedMembers(channelId: number, respBytes: Array<number>): void
@@ -49,6 +50,7 @@ export class AppState {
   appChannelApplyFetchedPods(channelId: number, respBytes: Array<number>): void
   appChannelApplyMessageEdited(reqBytes: Array<number>): void
   appChannelClearUnread(channelId: number): void
+  appChannelGetLastReadId(channelId: number): number
   appChannelInsertChannel(reqBytes: Array<number>): void
   appChannelInsertMessage(reqBytes: Array<number>): void
   appChannelMentionCountsJson(): string
@@ -156,10 +158,14 @@ export class AppState {
   channelEditChannelMessageConnect(request: Array<number>): Promise<Array<number>>
   channelGetChannelConnect(request: Array<number>): Promise<Array<number>>
   channelGetChannelUnreadCountsConnect(request: Array<number>): Promise<Array<number>>
+  channelGetMessageReadByConnect(request: Array<number>): Promise<Array<number>>
   channelListChannelMembersConnect(request: Array<number>): Promise<Array<number>>
   channelListChannelMessagesConnect(request: Array<number>): Promise<Array<number>>
   channelListChannelsConnect(request: Array<number>): Promise<Array<number>>
   channelMarkChannelReadConnect(request: Array<number>): Promise<Array<number>>
+  channelMarkChannelUnreadConnect(request: Array<number>): Promise<Array<number>>
+  channelMuteChannelConnect(request: Array<number>): Promise<Array<number>>
+  channelPinChannelConnect(request: Array<number>): Promise<Array<number>>
   channelSendChannelMessageConnect(request: Array<number>): Promise<Array<number>>
   channelUnarchiveChannelConnect(request: Array<number>): Promise<Array<number>>
   channelUpdateChannelConnect(request: Array<number>): Promise<Array<number>>
@@ -227,19 +233,18 @@ export class AppState {
   promocodeGetRedemptionHistoryConnect(request: Array<number>): Promise<Array<number>>
   promocodeRedeemPromoCodeConnect(request: Array<number>): Promise<Array<number>>
   promocodeValidatePromoCodeConnect(request: Array<number>): Promise<Array<number>>
+  relayBindPodListeners(podKey: string, onStatus: (err: unknown, arg: string) => void, onAcp: (err: unknown, arg: string) => void, listenerLeaseId: string): Promise<number>
   relayDisconnect(podKey: string): Promise<void>
   relayDisconnectAll(): Promise<void>
   relayForceResize(podKey: string, cols: number, rows: number): Promise<void>
   relayGetPodSize(podKey: string): Promise<Array<number>>
   relayGetStatus(podKey: string): Promise<string>
   relayIsRunnerDisconnected(podKey: string): Promise<boolean>
-  relayOnAcpMessage(podKey: string, onAcp: (err: unknown, arg: string) => void): Promise<void>
   relayOnPodDisconnected(onDisconnect: (err: unknown, arg: string) => void): Promise<void>
-  relayOnStatusChange(podKey: string, onStatus: (err: unknown, arg: string) => void): Promise<void>
   relaySend(podKey: string, data: string): Promise<void>
   relaySendAcpCommand(podKey: string, command: string): Promise<void>
   relaySendResize(podKey: string, cols: number, rows: number): Promise<void>
-  relaySubscribe(podKey: string, subscriptionId: string, relayUrl: string, token: string, onOutput: (err: unknown, arg: Array<number>) => void): Promise<void>
+  relaySubscribe(podKey: string, subscriptionId: string, relayUrl: string, token: string, onOutput: (err: unknown, arg: Array<number>) => void, onStatus: (err: unknown, arg: string) => void, onAcp: (err: unknown, arg: string) => void, onBound: (err: unknown, arg: number) => void, listenerLeaseId: string): Promise<void>
   relayUnsubscribe(podKey: string, subscriptionId: string): Promise<void>
   runnerAuthorizeRu
```

**File**: `clients/core/crates/node-bridge/src/commands/relay.rs` (modified, +53/-63)
```diff
@@ -1,12 +1,10 @@
-use std::sync::Arc;
-
-use agentsmesh_protocol::MsgType;
-use agentsmesh_relay::{AcpCallback, DisconnectCallback, OutputCallback, RelayStatusInfo, StatusCallback};
-use napi::threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode};
+use napi::threadsafe_function::ThreadsafeFunction;
 use napi_derive::napi;
 
 use crate::AppState;
 
+mod listener_callbacks;
+
 // Terminal data-plane relay surface over the shared `RelayConnectionPool` (the
 // SSOT). The pool runs natively in the main process; `main/relay.ts` provides
 // the `on_output`/`on_status`/`on_acp` ThreadsafeFunctions that fan bytes out to
@@ -27,17 +25,46 @@ impl AppState {
         relay_url: String,
         token: String,
         on_output: ThreadsafeFunction<Vec<u8>>,
+        on_status: ThreadsafeFunction<String>,
+        on_acp: ThreadsafeFunction<String>,
+        on_bound: ThreadsafeFunction<u32>,
+        listener_lease_id: String,
     ) -> napi::Result<()> {
-        let cb = Arc::new(on_output);
-        let output_cb: OutputCallback = Arc::new(move |data: Vec<u8>| {
-            cb.call(Ok(data), ThreadsafeFunctionCallMode::NonBlocking);
-        });
         self.relay
-            .subscribe(&pod_key, &subscription_id, &relay_url, &token, output_cb)
-            .await;
+            .subscribe_ready_with_listeners(
+                &pod_key,
+                &subscription_id,
+                &relay_url,
+                &token,
+                listener_callbacks::output(on_output),
+                &listener_lease_id,
+                listener_callbacks::generation_status(on_status),
+                listener_callbacks::generation_acp(on_acp),
+                listener_callbacks::bound(on_bound),
+            )
+            .await
+            .map_err(err)?;
         Ok(())
     }
 
+    /// Rebind the desktop fan-out callbacks to the currently active driver.
+    /// Returns 0 when a subscribe has not published that driver yet.
+    #[napi]
+    pub async fn relay_bind_pod_listeners(
+        &self,
+        pod_key: String,
+        on_status: ThreadsafeFunction<String>,
+        on_acp: ThreadsafeFunction<String>,
+        listener_lease_id: String,
+    ) -> u32 {
+        self.relay.bind_listeners_if_active(
+            &pod_key,
+            &listener_lease_id,
+            listener_callbacks::generation_status(on_status),
+            listener_callbacks::generation_acp(on_acp),
+        )
+    }
+
     #[napi]
     pub async fn relay_unsubscribe(&self, pod_key: String, subscription_id: String) {
         self.relay.unsubscribe(&pod_key, &subscription_id).await;
@@ -59,9 +86,16 @@ impl AppState {
     }
 
     #[napi]
-    pub async fn relay_send_acp_command(&self, pod_key: String, command: String) -> napi::Result<()> {
+    pub async fn relay_send_acp_command(
+        &self,
+        pod_key: String,
+        command: String,
+    ) -> napi::Result<()> {
         let val: serde_json::Value = serde_json::from_str(&command).map_err(err)?;
-        self.relay.send_acp_command(&pod_key, &val).await.map_err(err)
+        self.relay
+            .send_acp_command(&pod_key, &val)
+            .await
+            .map_err(err)
     }
 
     #[napi]
@@ -94,61 +128,17 @@ impl AppState {
             .unwrap_or_default()
     }
 
-    /// Status callback delivers `{"status","runnerDisconnected"}` JSON; main
-    /// forwards to the renderer as a `relay:status` IPC event.
-    #[napi]
-    pub async fn relay_on_status_change(
-        &self,
-        pod_key: String,
-        on_status: ThreadsafeFunction<String>,
-    ) -> napi::Result<()> {
-        let cb = Arc::new(on_status);
-        let listener: StatusCallback = Arc::new(move |info: RelayStatusInfo| {
-            let json = serde_json::json!({
-                "status": info.status.to_string(),
-                "runnerDisconnected": info.runner_disconnected,
-            })
-            .to_string();
-            cb.call(Ok(json), ThreadsafeFunctionCallMode::N
```

---

### Incident Patch 3: `38a5b0e1` (2026-07-24)
**Commit Message**: fix(channel): restore follow-to-bottom for new messages (v0.44.5 regression) (#468)

The v0.44.5 entry-scroll refactor seeded `isAtBottom` from the unread cursor
and re-derived it after every anchor via a live `isScrolledToBottom` DOM read
(onEntryAnchor). In real layout that read can run before content settles and
latch at-bottom to false, so streamed messages stop following into view and
only surface a pill — experienced as "new messages don't show".

Restore the proven v0.44.4 semantics: `isAtBottom` defaults true and is moved
only by real scroll events. Entry positioning still owns WHERE the viewport
lands (unread divider vs bottom); it no longer suppresses follow-to-bottom.
Drops the onEntryAnchor callback and the now-unused onAnchor plumbing.

Co-authored-by: yishuiliunian <test@test.com>
Co-authored-by: Claude Opus 4.8 (1M context) <noreply@anthropic.com>

**File**: `clients/web/src/components/channel/__tests__/MessageList.scroll.test.tsx` (modified, +7/-10)
```diff
@@ -204,21 +204,18 @@ describe("MessageList entry scroll", () => {
     expect(Element.prototype.scrollIntoView).not.toHaveBeenCalledWith({ block: "start", behavior: "instant" });
   });
 
-  it("does not follow a message that streams in before the unread cursor resolves", async () => {
-    // Unknown cursor: entryAnchorResolved false, firstUnreadId not yet known.
+  it("follows streamed messages by default (at-bottom seed), then anchors the divider on cursor resolve", async () => {
+    // Entry seeds isAtBottom=true so a streamed message follows into view rather
+    // than silently showing only a pill — the v0.44.5 regression was seeding it
+    // false and latching it there via a fragile post-anchor scroll read.
     const { rerender } = renderList({ messages: [msg(10), msg(11), msg(12)], firstUnreadId: null, entryAnchorResolved: false });
-    // Flush the channel-switch seed microtask (setIsAtBottom(false) for an
-    // unknown cursor). In the real app this microtask always runs before the
-    // next macrotask — i.e. before any streamed message can arrive.
-    await act(async () => { await Promise.resolve(); });
+    await act(async () => { await Promise.resolve(); }); // flush the channel-switch seed microtask
     vi.mocked(Element.prototype.scrollIntoView).mockClear();
 
-    // A message arrives during the fetchUnreadCounts window. It must NOT auto-
-    // follow to the bottom — that would trip userInterrupted and lose the divider.
     rerender(<MessageList messages={[msg(10), msg(11), msg(12), msg(13)]} loading={false} channelId={1} firstUnreadId={null} entryAnchorResolved={false} />);
-    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
+    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
 
-    // Cursor resolves to a divider — entry now anchors straight to it.
+    // Once the cursor resolves to an unread divider, entry positioning anchors it.
     rerender(<MessageList messages={[msg(10), msg(11), msg(12), msg(13)]} loading={false} channelId={1} firstUnreadId={11} entryAnchorResolved />);
     const divider = screen.getByRole("separator");
     expect(divider.scrollIntoView).toHaveBeenCalledWith({ block: "start", behavior: "instant" });
```

**File**: `clients/web/src/components/channel/useMessageEntryPosition.ts` (modified, +3/-11)
```diff
@@ -15,9 +15,6 @@ interface UseMessageEntryPositionOptions {
   containerRef: RefObject<HTMLDivElement | null>;
   contentRef: RefObject<HTMLDivElement | null>;
   bottomRef: RefObject<HTMLDivElement | null>;
-  // Fires when an anchor lands, so the caller can sync at-bottom state to the
-  // real landed position (a divider at scrollTop 0 emits no correcting scroll).
-  onAnchor?: () => void;
 }
 
 // Entry "settles" once content height holds steady this long (a ResizeObserver
@@ -34,7 +31,6 @@ export function useMessageEntryPosition({
   containerRef,
   contentRef,
   bottomRef,
-  onAnchor,
 }: UseMessageEntryPositionOptions) {
   const firstId = messages[0]?.id ?? null;
   const lastId = messages[messages.length - 1]?.id ?? null;
@@ -110,8 +106,7 @@ export function useMessageEntryPosition({
     state.lastAppliedKey = anchorKey;
     state.anchoredLastId = lastId;
     state.target = target;
-    onAnchor?.();
-  }, [anchorKey, bottomRef, channelId, containerRef, entryAnchorResolved, firstUnreadId, lastId, loading, loadingMore, messages.length, onAnchor]);
+  }, [anchorKey, bottomRef, channelId, containerRef, entryAnchorResolved, firstUnreadId, lastId, loading, loadingMore, messages.length]);
 
   // Re-anchor on content growth (late images/embeds) and mark settled once the
   // reflow goes quiet — a debounced quiescence signal, reset on every resize.
@@ -132,10 +127,7 @@ export function useMessageEntryPosition({
         state.resizeFrame = null;
         if (state.userInterrupted || state.settled) return;
         const target = scrollToEntryAnchor(containerRef.current, bottomRef.current, liveRef.current.firstUnreadId, state);
-        if (target) {
-          state.target = target;
-          onAnchor?.();
-        }
+        if (target) state.target = target;
       });
     });
     observer.observe(content);
@@ -145,5 +137,5 @@ export function useMessageEntryPosition({
       if (state.resizeFrame != null) cancelAnimationFrame(state.resizeFrame);
       state.resizeFrame = null;
     };
-  }, [bottomRef, channelId, containerRef, contentRef, onAnchor]);
+  }, [bottomRef, channelId, containerRef, contentRef]);
 }
```

**File**: `clients/web/src/components/channel/useMessageListScroll.ts` (modified, +5/-20)
```diff
@@ -83,31 +83,17 @@ export function useMessageListScroll({
     let cancelled = false;
     queueMicrotask(() => {
       if (cancelled) return;
-      // Seed at-bottom ONLY when the cursor is resolved AND there is no unread.
-      // An unknown cursor must not seed `true`: a message streamed in during the
-      // unread-summary fetch would then auto-follow to the bottom, trip the entry
-      // hook's scroll listener (userInterrupted), and permanently defeat the
-      // divider once the cursor resolves. onEntryAnchor corrects this once an
-      // anchor actually lands.
-      setIsAtBottom(entryAnchorResolved && firstUnreadId == null);
+      // Default to at-bottom so a streamed message follows into view; real scroll
+      // events (handleScroll) flip it to false once the user scrolls up. Entry
+      // positioning owns WHERE the viewport lands (divider vs bottom); it must not
+      // also suppress follow-to-bottom, or new messages silently stop appearing.
+      setIsAtBottom(true);
       setNewMessageCount(0);
       setMentionBelowId(null);
     });
     return () => { cancelled = true; };
-    // firstUnreadId / entryAnchorResolved intentionally excluded: this seeds on
-    // channel switch only; a late resolve must not re-run and clobber a live
-    // isAtBottom.
-    // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [channelId]);
 
-  // When entry positioning lands an anchor, sync isAtBottom to where it actually
-  // landed so the FAB/pill and the append-follow decision agree with it — in
-  // particular a divider anchored at scrollTop 0 fires no scroll event to correct
-  // a stale seed, which would otherwise hide the FAB and let a stream yank down.
-  const onEntryAnchor = useCallback(() => {
-    setIsAtBottom(isScrolledToBottom(containerRef.current));
-  }, []);
-
   useMessageEntryPosition({
     channelId,
     messages,
@@ -118,7 +104,6 @@ export function useMessageListScroll({
     containerRef,
     contentRef,
     bottomRef,
-    onAnchor: onEntryAnchor,
   });
 
   useEffect(() => {
```

---

### Incident Patch 4: `13151fc5` (2026-07-23)
**Commit Message**: fix(channel): robust entry scroll & unread-divider positioning (#466)

Entering a channel lands reliably at the unread divider (or the latest
message for read channels) without regressing the stick-to-bottom chat
behavior.

- Make entry positioning resilient to cached/fresh/late-reflow windows via
  a ResizeObserver quiescence signal; extract the scroll primitives into
  entryAnchorScroll.ts and the state machine into useMessageEntryPosition.
- Decide follow-to-bottom from the PRE-append at-bottom state, so a tall
  streamed message no longer strands the viewport.
- Seed at-bottom only once the unread cursor resolves, so a message arriving
  during the unread-summary fetch can't yank an unread channel to the bottom
  and permanently lose the divider.
- A load-more prepend adopts the new window key without re-anchoring, instead
  of fighting the scroll-position restore.
- Freeze the unread cursor and delay mark-read until the entry anchor
  resolves (useChannelEntryAnchor / useChannelEntryMarkRead).
- Keep BottomPanel channel selection panel-local (ephemeral peek surface).

Adds unit coverage (MessageList.scroll, useChannelEntryMarkRead,
BottomPanel.channel-selection) and fixes a te

**File**: `clients/web/src/components/channel/ChannelChatPanel.tsx` (modified, +1/-0)
```diff
@@ -70,6 +70,7 @@ export function ChannelChatPanel({ channelId }: ChannelChatPanelProps) {
                 currentUserId={chat.currentUserId}
                 channelId={channelId}
                 firstUnreadId={chat.firstUnreadId}
+                entryAnchorResolved={chat.entryAnchorResolved}
                 roleByUserId={chat.roleByUserId}
                 onEditMessage={chat.handleEditMessage}
                 onDeleteMessage={chat.handleDeleteMessage}
```

**File**: `clients/web/src/components/channel/MessageList.tsx` (modified, +58/-53)
```diff
@@ -22,22 +22,25 @@ interface MessageListProps {
   currentUserId?: number;
   channelId?: number;
   firstUnreadId?: number | null;
+  // Whether the unread cursor is resolved. Entry positioning waits for this so
+  // an unknown cursor doesn't scroll to the bottom and then jump to the divider.
+  entryAnchorResolved?: boolean;
   roleByUserId?: Map<number, string>;
   onEditMessage?: (messageId: number, payload: MessageEditPayload) => Promise<void>;
   onDeleteMessage?: (messageId: number) => Promise<void>;
 }
 
 export function MessageList({
   messages, loading, loadingMore, hasMore, error,
-  onLoadMore, onRetry, currentUserId, channelId, firstUnreadId, roleByUserId,
+  onLoadMore, onRetry, currentUserId, channelId, firstUnreadId, entryAnchorResolved = true, roleByUserId,
   onEditMessage, onDeleteMessage,
 }: MessageListProps) {
   const t = useTranslations("channels.messages");
   const allPods = usePods();
   const {
-    containerRef, bottomRef, isAtBottom, newMessageCount, mentionBelowId,
+    containerRef, contentRef, bottomRef, isAtBottom, newMessageCount, mentionBelowId,
     handleScroll, scrollToBottom, scrollToMessage,
-  } = useMessageListScroll({ messages, loading, loadingMore, channelId, firstUnreadId, currentUserId });
+  } = useMessageListScroll({ messages, loading, loadingMore, channelId, firstUnreadId, entryAnchorResolved, currentUserId });
 
   const sentinelRef = useRef<HTMLDivElement>(null);
   const onLoadMoreRef = useRef(onLoadMore);
@@ -91,57 +94,59 @@ export function MessageList({
         onScroll={handleScroll}
         data-testid="channel-message-list"
       >
-        {hasMore && <div ref={sentinelRef} className="h-1" />}
-        {loadingMore && (
-          <div className="flex justify-center py-3">
-            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
-          </div>
-        )}
-
-        {dateGroups.map((dateGroup) => (
-          <div key={dateGroup.date}>
-            <div className="flex justify-center py-2">
-              <span className="text-[11px] text-muted-foreground">— {dateGroup.date} —</span>
+        <div ref={contentRef} className="flex min-h-full flex-col">
+          {hasMore && <div ref={sentinelRef} className="h-1" />}
+          {loadingMore && (
+            <div className="flex justify-center py-3">
+              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
             </div>
-            {dateGroup.messages.map((message) => (
-              <Fragment key={message.id}>
-                {firstUnreadId === message.id && <UnreadDivider />}
-                <MessageRow
-                  message={message}
-                  allPods={allPods}
-                  currentUserId={currentUserId}
-                  channelId={channelId}
-                  isFirstInGroup={groupFlags.get(message.id) ?? true}
-                  role={message.user ? roleByUserId?.get(message.user.id) : undefined}
-                  onEditMessage={onEditMessage}
-                  onDeleteMessage={onDeleteMessage}
-                />
-              </Fragment>
-            ))}
-          </div>
-        ))}
-
-        {error && !loading && messages.length === 0 && (
-          <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
-            <MessageSquare className="mb-4 h-12 w-12 opacity-30" />
-            <p className="text-sm text-destructive">{error}</p>
-            {onRetry && (
-              <button className="mt-2 text-xs text-primary hover:underline" onClick={onRetry}>
-                {t("loadOlder")}
-              </button>
-            )}
-          </div>
-        )}
-
-        {messages.length === 0 && !loading && !error && (
-          <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
-            <MessageSquare className="mb-4 h-12 w-12 opacity-30" />
-            <p className="text-sm">{t("noMessages")}</p>
-            <p className="mt-1 text-xs">{t("
```

**File**: `clients/web/src/components/channel/MobileChannelChat.tsx` (modified, +1/-0)
```diff
@@ -108,6 +108,7 @@ export function MobileChannelChat({ channelId, onClose }: MobileChannelChatProps
             currentUserId={chat.currentUserId}
             channelId={channelId}
             firstUnreadId={chat.firstUnreadId}
+            entryAnchorResolved={chat.entryAnchorResolved}
             roleByUserId={chat.roleByUserId}
             onEditMessage={chat.handleEditMessage}
             onDeleteMessage={chat.handleDeleteMessage}
```

**File**: `clients/web/src/components/channel/__tests__/MessageList.scroll.test.tsx` (added, +240/-0)
```diff
@@ -0,0 +1,240 @@
+import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
+import { act, fireEvent, render, screen } from "@testing-library/react";
+import { MessageList } from "../MessageList";
+import type { TransformedMessage } from "../types";
+
+vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
+vi.mock("@/stores/pod", () => ({ usePods: () => [] }));
+
+let resizeCallback: ResizeObserverCallback | null = null;
+
+class TestResizeObserver {
+  observe = vi.fn();
+  unobserve = vi.fn();
+  disconnect = vi.fn();
+  constructor(callback: ResizeObserverCallback) {
+    resizeCallback = callback;
+  }
+}
+
+function msg(id: number): TransformedMessage {
+  return {
+    id,
+    body: `message ${id}`,
+    messageType: "text",
+    createdAt: "2026-01-01T12:00:00Z",
+    user: { id: 7, username: "dev" },
+  };
+}
+
+function renderList(props: Partial<React.ComponentProps<typeof MessageList>> = {}) {
+  return render(
+    <MessageList
+      messages={[msg(10), msg(11), msg(12)]}
+      loading={false}
+      channelId={1}
+      {...props}
+    />,
+  );
+}
+
+let rafCallbacks: FrameRequestCallback[] = [];
+function flushRaf() {
+  const pending = rafCallbacks;
+  rafCallbacks = [];
+  pending.forEach((cb) => cb(performance.now()));
+}
+
+describe("MessageList entry scroll", () => {
+  const originalRAF = global.requestAnimationFrame;
+  const originalCAF = global.cancelAnimationFrame;
+  const originalRO = global.ResizeObserver;
+  const originalScrollIntoView = Element.prototype.scrollIntoView;
+
+  beforeEach(() => {
+    vi.useFakeTimers();
+    resizeCallback = null;
+    rafCallbacks = [];
+    global.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver;
+    global.requestAnimationFrame = ((cb: FrameRequestCallback) => {
+      rafCallbacks.push(cb);
+      return rafCallbacks.length;
+    }) as typeof requestAnimationFrame;
+    global.cancelAnimationFrame = (() => {}) as typeof cancelAnimationFrame;
+    Element.prototype.scrollIntoView = vi.fn();
+  });
+
+  afterEach(() => {
+    vi.useRealTimers();
+    // Restore every global clobbered above. The fake requestAnimationFrame never
+    // invokes its callback, so leaking it into later test files in the same
+    // worker thread hangs their animations/userEvent flows (5s timeouts).
+    global.requestAnimationFrame = originalRAF;
+    global.cancelAnimationFrame = originalCAF;
+    global.ResizeObserver = originalRO;
+    Element.prototype.scrollIntoView = originalScrollIntoView;
+  });
+
+  it("scrolls to bottom on read-channel entry", () => {
+    renderList();
+
+    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: "instant" });
+  });
+
+  it("scrolls the unread divider on unread entry", () => {
+    renderList({ firstUnreadId: 11 });
+
+    // getByRole("separator") is the UnreadDivider (the [data-unread-anchor]
+    // element); asserting on its own scrollIntoView proves the divider — not
+    // some other element — is what entry positioning scrolled to.
+    const divider = screen.getByRole("separator");
+    expect(divider.scrollIntoView).toHaveBeenCalledWith({ block: "start", behavior: "instant" });
+  });
+
+  it("waits for the anchor to resolve before the first scroll (no bottom→divider jump)", () => {
+    // Unknown cursor: entryAnchorResolved false, firstUnreadId not yet known.
+    const { rerender } = renderList({ firstUnreadId: null, entryAnchorResolved: false });
+    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
+
+    // Cursor resolves to an unread divider — now (and only now) it anchors,
+    // straight to the divider rather than bottom-then-jump.
+    rerender(
+      <MessageList messages={[msg(10), msg(11), msg(12)]} loading={false} channelId={1} firstUnreadId={11} entryAnchorResolved />,
+    );
+    const divider = screen.getByRole("separator");
+    expect(divider.scrollIntoView).toHaveBeenCalledWith({ block: "start", behavior:
```

**File**: `clients/web/src/components/channel/__tests__/useChannelEntryAnchor.test.tsx` (modified, +50/-10)
```diff
@@ -1,5 +1,5 @@
 import { describe, it, expect, vi, beforeEach } from "vitest";
-import { renderHook } from "@testing-library/react";
+import { renderHook, waitFor } from "@testing-library/react";
 import { useChannelEntryAnchor } from "../useChannelEntryAnchor";
 import { getChannelState } from "@/lib/wasm-core";
 import type { TransformedMessage } from "../types";
@@ -12,27 +12,67 @@ const setCursor = (v: number) => vi.mocked(getChannelState().get_last_read_id).m
 describe("useChannelEntryAnchor", () => {
   beforeEach(() => vi.mocked(getChannelState().get_last_read_id).mockReset());
 
-  it("no known cursor (-1) → no divider", () => {
+  it("unknown cursor requests an unread summary before falling back", async () => {
     setCursor(-1);
-    const { result } = renderHook(() => useChannelEntryAnchor(1, msgs(10, 11, 12)));
-    expect(result.current).toBeNull();
+    const { result, rerender } = renderHook(
+      ({ attempted }) => useChannelEntryAnchor(1, msgs(10, 11, 12), attempted),
+      { initialProps: { attempted: false } },
+    );
+    expect(result.current).toEqual({ firstUnreadId: null, resolved: false, needsUnreadSummary: true });
+
+    rerender({ attempted: true });
+
+    await waitFor(() => {
+      expect(result.current).toEqual({ firstUnreadId: null, resolved: true, needsUnreadSummary: false });
+    });
   });
 
-  it("genuine 0 cursor → divider anchors at the first (all-unread) message", () => {
+  it("re-reads a now-known cursor once the summary fetch is attempted", async () => {
+    setCursor(-1);
+    const { result, rerender } = renderHook(
+      ({ attempted }) => useChannelEntryAnchor(1, msgs(10, 11, 12), attempted),
+      { initialProps: { attempted: false } },
+    );
+    expect(result.current.needsUnreadSummary).toBe(true);
+
+    // fetchUnreadCounts wrote the Rust cursor before resolving; flipping
+    // `attempted` re-runs the retry, which reads the now-known cursor.
+    setCursor(11);
+    rerender({ attempted: true });
+
+    await waitFor(() => {
+      expect(result.current).toEqual({ firstUnreadId: 12, resolved: true, needsUnreadSummary: false });
+    });
+  });
+
+  it("genuine 0 cursor anchors at the first message", () => {
     setCursor(0);
     const { result } = renderHook(() => useChannelEntryAnchor(2, msgs(10, 11, 12)));
-    expect(result.current).toBe(10);
+    expect(result.current).toEqual({ firstUnreadId: 10, resolved: true, needsUnreadSummary: false });
   });
 
-  it("cursor at 11 → divider at the first message after it", () => {
+  it("cursor at 11 anchors at the first message after it", () => {
     setCursor(11);
     const { result } = renderHook(() => useChannelEntryAnchor(3, msgs(10, 11, 12)));
-    expect(result.current).toBe(12);
+    expect(result.current).toEqual({ firstUnreadId: 12, resolved: true, needsUnreadSummary: false });
   });
 
-  it("fully read (cursor at latest) → no divider", () => {
+  it("fully read cursor has no divider", () => {
     setCursor(12);
     const { result } = renderHook(() => useChannelEntryAnchor(4, msgs(10, 11, 12)));
-    expect(result.current).toBeNull();
+    expect(result.current).toEqual({ firstUnreadId: null, resolved: true, needsUnreadSummary: false });
+  });
+
+  it("freezes the cursor for the current entry", () => {
+    setCursor(10);
+    const { result, rerender } = renderHook(() => useChannelEntryAnchor(5, msgs(10, 11, 12)));
+    expect(result.current.firstUnreadId).toBe(11);
+
+    // A known cursor is frozen for the entry: a later mark-read advancing it
+    // must not move the divider.
+    setCursor(12);
+    rerender();
+
+    expect(result.current.firstUnreadId).toBe(11);
   });
 });
```

---

### Incident Patch 5: `d6606e81` (2026-07-23)
**Commit Message**: fix(ci): support pinned curl in GitLab sync (#465)

Co-authored-by: yishuiliunian <test@test.com>

**File**: `.gitlab-ci.yml` (modified, +2/-1)
```diff
@@ -33,7 +33,8 @@ sync:github:
         "$CI_REPOSITORY_URL" \
         "$github_sha:refs/heads/main"
 
-      curl --fail-with-body --silent --show-error \
+      # The pinned Bazel builder ships curl without --fail-with-body.
+      curl --fail --silent --show-error \
         --request POST \
         --form "token=$CI_JOB_TOKEN" \
         --form "ref=main" \
```

---

### Incident Patch 6: `ecd1a0f7` (2026-07-23)
**Commit Message**: fix(deploy): route Connect RPC in private templates (#464)

Co-authored-by: yishuiliunian <test@test.com>

**File**: `.github/workflows/bazel.yml` (modified, +2/-0)
```diff
@@ -45,6 +45,8 @@ jobs:
       - run: bazel run //:buildifier_check
       - name: Identifier contract lint
         run: bash tools/identifier-lint/lint.sh
+      - name: Self-hosted Traefik route contract
+        run: bash deploy/traefik_connect_routes_test.sh
       - name: Verify desktop-only crate isolation
         run: |
           set -euo pipefail
```

**File**: `deploy/onpremise/traefik/dynamic/routes.yml` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@ http:
     # Backend API
     # =========================================================================
     api:
-      rule: "PathPrefix(`/api`) || PathPrefix(`/health`)"
+      rule: "PathPrefix(`/api`) || PathPrefix(`/health`) || PathPrefix(`/proto.`)"
       entryPoints:
         - web
       service: backend
```

**File**: `deploy/selfhost/traefik/dynamic/routes.yml` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@ http:
   routers:
     # Backend API
     api:
-      rule: "PathPrefix(`/api`) || PathPrefix(`/health`)"
+      rule: "PathPrefix(`/api`) || PathPrefix(`/health`) || PathPrefix(`/proto.`)"
       entryPoints:
         - web
       service: backend
```

**File**: `deploy/traefik_connect_routes_test.sh` (added, +48/-0)
```diff
@@ -0,0 +1,48 @@
+#!/usr/bin/env bash
+set -euo pipefail
+
+repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
+configs=(
+  "deploy/selfhost/traefik/dynamic/routes.yml"
+  "deploy/onpremise/traefik/dynamic/routes.yml"
+)
+
+cd "$repo_root"
+ruby -ryaml - "${configs[@]}" <<'RUBY'
+EXPECTED_RULE = 'PathPrefix(`/api`) || PathPrefix(`/health`) || PathPrefix(`/proto.`)'
+
+def value_at(document, *keys)
+  keys.reduce(document) do |value, key|
+    value.is_a?(Hash) ? value[key] : nil
+  end
+end
+
+def assert_equal(path, field, actual, expected)
+  return if actual == expected
+
+  abort "#{path}: #{field}: expected #{expected.inspect}, got #{actual.inspect}"
+end
+
+ARGV.each do |path|
+  begin
+    document = YAML.safe_load_file(path, aliases: false)
+  rescue Psych::Exception => error
+    abort "#{path}: yaml: #{error.message}"
+  end
+
+  api_rule = value_at(document, "http", "routers", "api", "rule")
+  api_service = value_at(document, "http", "routers", "api", "service")
+  api_priority = value_at(document, "http", "routers", "api", "priority")
+  web_priority = value_at(document, "http", "routers", "web", "priority")
+
+  assert_equal(path, "http.routers.api.rule", api_rule, EXPECTED_RULE)
+  assert_equal(path, "http.routers.api.service", api_service, "backend")
+  assert_equal(path, "http.routers.api.priority", api_priority, 100)
+
+  unless web_priority.is_a?(Numeric) && web_priority < api_priority
+    abort "#{path}: http.routers.web.priority: expected a number lower than #{api_priority.inspect}, got #{web_priority.inspect}"
+  end
+
+  puts "validated #{path}"
+end
+RUBY
```

---

### Incident Patch 7: `72b17cef` (2026-07-20)
**Commit Message**: fix(backend): sync skills via go-git instead of exec git (#456)

* fix(backend): sync skills via go-git instead of exec git

Skill-registry sync shelled out to `git clone`, but the backend OCI image
is Alpine-based with no git installed, so every SyncSkillRegistry failed
with `exec: "git": executable file not found in $PATH` (HTTP 500).

Replace the exec-git calls in skill_importer_git.go with go-git
(PlainCloneContext / PlainOpen), dropping the runtime git dependency so
the image needs no extra package. Behavior preserved:
- https-only clone + git@-only SSH scheme checks
- shallow depth=1 (remote), branch selection, GitHub/GitLab PAT, SSH key
- credentials pass via explicit go-git Auth, never embedded in the clone URL

go-git is added as a direct dependency (go.mod + MODULE.bazel use_repo).
All 378 tests in the extension package pass; //backend/cmd/server builds.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>

* fix(backend): address go-git skill-sync review findings

Follow-up to the exec-git -> go-git migration, fixing defects from the
max-effort code review:

- Tags: NoTags — go-git's Validate() defaults Tags to AllTags, so every
  shallow sync also fetch

**File**: `MODULE.bazel` (modified, +1/-1)
```diff
@@ -57,7 +57,7 @@ go_sdk.download(version = "1.25.0")
 # its `require` blocks and emits one `go_deps` import per dependency.
 go_deps = use_extension("@gazelle//:extensions.bzl", "go_deps")
 go_deps.from_file(go_mod = "//:go.mod")
-use_repo(go_deps, "com_connectrpc_connect", "com_github_alicebob_miniredis_v2", "com_github_aws_aws_sdk_go_v2", "com_github_aws_aws_sdk_go_v2_config", "com_github_aws_aws_sdk_go_v2_credentials", "com_github_aws_aws_sdk_go_v2_service_s3", "com_github_coreos_go_oidc_v3", "com_github_creack_pty", "com_github_creativeprojects_go_selfupdate", "com_github_crewjam_saml", "com_github_gin_contrib_cors", "com_github_gin_gonic_gin", "com_github_go_acme_lego_v4", "com_github_go_ldap_ldap_v3", "com_github_golang_jwt_jwt_v5", "com_github_golang_migrate_migrate_v4", "com_github_google_uuid", "com_github_gorilla_websocket", "com_github_kardianos_service", "com_github_lib_pq", "com_github_masterminds_semver_v3", "com_github_mattn_go_runewidth", "com_github_maxmind_mmdbwriter", "com_github_ndolestudio_lemonsqueezy_go", "com_github_oschwald_maxminddb_golang", "com_github_pelletier_go_toml_v2", "com_github_pkg_browser", "com_github_redis_go_redis_extra_redisotel_v9", "com_github_redis_go_redis_v9", "com_github_resend_resend_go_v2", "com_github_robfig_cron_v3", "com_github_smartwalle_alipay_v3", "com_github_spf13_viper", "com_github_stretchr_testify", "com_github_stripe_stripe_go_v76", "com_github_thejerf_suture_v4", "com_github_uptrace_opentelemetry_go_extra_otelgorm", "com_github_userexistserror_conpty", "com_github_wechatpay_apiv3_wechatpay_go", "com_github_yuin_goldmark", "in_gopkg_yaml_v3", "io_gorm_driver_postgres", "io_gorm_driver_sqlite", "io_gorm_gorm", "io_gorm_plugin_dbresolver", "io_opentelemetry_go_contrib_instrumentation_github_com_gin_gonic_gin_otelgin", "io_opentelemetry_go_contrib_instrumentation_google_golang_org_grpc_otelgrpc", "io_opentelemetry_go_contrib_instrumentation_net_http_otelhttp", "io_opentelemetry_go_otel", "io_opentelemetry_go_otel_exporters_otlp_otlpmetric_otlpmetricgrpc", "io_opentelemetry_go_otel_exporters_otlp_otlptrace_otlptracegrpc", "io_opentelemetry_go_otel_exporters_stdout_stdoutmetric", "io_opentelemetry_go_otel_exporters_stdout_stdouttrace", "io_opentelemetry_go_otel_metric", "io_opentelemetry_go_otel_sdk", "io_opentelemetry_go_otel_sdk_metric", "io_opentelemetry_go_otel_trace", "org_golang_google_grpc", "org_golang_google_grpc_security_advancedtls", "org_golang_google_protobuf", "org_golang_x_crypto", "org_golang_x_oauth2", "org_golang_x_sync", "org_golang_x_term", "org_golang_x_time")
+use_repo(go_deps, "com_connectrpc_connect", "com_github_alicebob_miniredis_v2", "com_github_aws_aws_sdk_go_v2", "com_github_aws_aws_sdk_go_v2_config", "com_github_aws_aws_sdk_go_v2_credentials", "com_github_aws_aws_sdk_go_v2_service_s3", "com_github_coreos_go_oidc_v3", "com_github_creack_pty", "com_github_creativeprojects_go_selfupdate", "com_github_crewjam_saml", "com_github_gin_contrib_cors", "com_github_gin_gonic_gin", "com_github_go_acme_lego_v4", "com_github_go_git_go_git_v5", "com_github_go_ldap_ldap_v3", "com_github_golang_jwt_jwt_v5", "com_github_golang_migrate_migrate_v4", "com_github_google_uuid", "com_github_gorilla_websocket", "com_github_kardianos_service", "com_github_lib_pq", "com_github_masterminds_semver_v3", "com_github_mattn_go_runewidth", "com_github_maxmind_mmdbwriter", "com_github_ndolestudio_lemonsqueezy_go", "com_github_oschwald_maxminddb_golang", "com_github_pelletier_go_toml_v2", "com_github_pkg_browser", "com_github_redis_go_redis_extra_redisotel_v9", "com_github_redis_go_redis_v9", "com_github_resend_resend_go_v2", "com_github_robfig_cron_v3", "com_github_smartwalle_alipay_v3", "com_github_spf13_viper", "com_github_stretchr_testify", "com_github_stripe_stripe_go_v76", "com_github_thejerf_suture_v4", "com_github_uptrace_opentelemetry_go_extra_otelgorm", "com_github_userexistserror_conpty", "com_github_wechatpay_apiv3_wechatpay_go", "com_github_yuin_goldmark", "in_gopk
```

**File**: `backend/internal/service/extension/BUILD.bazel` (modified, +6/-0)
```diff
@@ -30,8 +30,14 @@ go_library(
         "//backend/internal/domain/extension",
         "//backend/internal/infra/storage",
         "//backend/pkg/crypto",
+        "@com_github_go_git_go_git_v5//:go-git",
+        "@com_github_go_git_go_git_v5//plumbing",
+        "@com_github_go_git_go_git_v5//plumbing/transport",
+        "@com_github_go_git_go_git_v5//plumbing/transport/http",
+        "@com_github_go_git_go_git_v5//plumbing/transport/ssh",
         "@com_github_google_uuid//:uuid",
         "@io_opentelemetry_go_contrib_instrumentation_net_http_otelhttp//:otelhttp",
+        "@org_golang_x_crypto//ssh",
     ],
 )
 
```

**File**: `backend/internal/service/extension/skill_importer_auth_test.go` (modified, +14/-37)
```diff
@@ -11,61 +11,38 @@ import (
 )
 
 // =============================================================================
-// injectPATIntoURL
+// httpsBasicAuth
 // =============================================================================
 
-func TestInjectPATIntoURL_Success(t *testing.T) {
-	result, err := injectPATIntoURL("https://github.com/owner/repo.git", "ghp_mytoken123")
+func TestHTTPSBasicAuth_GitHubPAT(t *testing.T) {
+	auth, err := httpsBasicAuth("https://github.com/owner/repo.git", "ghp_mytoken123", "")
 	require.NoError(t, err)
-	assert.Equal(t, "https://ghp_mytoken123@github.com/owner/repo.git", result)
+	assert.Equal(t, "ghp_mytoken123", auth.Username)
+	assert.Equal(t, "", auth.Password)
 }
 
-func TestInjectPATIntoURL_NonHTTPS(t *testing.T) {
-	tests := []struct {
-		name string
-		url  string
-	}{
-		{"http URL", "http://github.com/owner/repo.git"},
-		{"ssh URL", "ssh://git@github.com/owner/repo.git"},
-		{"file URL", "file:///local/path/repo"},
-		{"git protocol", "git://github.com/owner/repo.git"},
-		{"bare path", "/some/local/path"},
-	}
-
-	for _, tt := range tests {
-		t.Run(tt.name, func(t *testing.T) {
-			_, err := injectPATIntoURL(tt.url, "token")
-			require.Error(t, err)
-			assert.Contains(t, err.Error(), "PAT auth requires https:// URL")
-		})
-	}
-}
-
-// =============================================================================
-// injectGitLabPATIntoURL
-// =============================================================================
-
-func TestInjectGitLabPATIntoURL_Success(t *testing.T) {
-	result, err := injectGitLabPATIntoURL("https://gitlab.com/owner/repo.git", "glpat-mytoken456")
+func TestHTTPSBasicAuth_GitLabPAT(t *testing.T) {
+	auth, err := httpsBasicAuth("https://gitlab.com/owner/repo.git", "oauth2", "glpat-mytoken456")
 	require.NoError(t, err)
-	assert.Equal(t, "https://oauth2:glpat-mytoken456@gitlab.com/owner/repo.git", result)
+	assert.Equal(t, "oauth2", auth.Username)
+	assert.Equal(t, "glpat-mytoken456", auth.Password)
 }
 
-func TestInjectGitLabPATIntoURL_NonHTTPS(t *testing.T) {
+func TestHTTPSBasicAuth_NonHTTPS(t *testing.T) {
 	tests := []struct {
 		name string
 		url  string
 	}{
-		{"http URL", "http://gitlab.com/owner/repo.git"},
-		{"ssh URL", "ssh://git@gitlab.com/owner/repo.git"},
+		{"http URL", "http://github.com/owner/repo.git"},
+		{"ssh URL", "ssh://git@github.com/owner/repo.git"},
 		{"file URL", "file:///local/path/repo"},
-		{"git protocol", "git://gitlab.com/owner/repo.git"},
+		{"git protocol", "git://github.com/owner/repo.git"},
 		{"bare path", "/some/local/path"},
 	}
 
 	for _, tt := range tests {
 		t.Run(tt.name, func(t *testing.T) {
-			_, err := injectGitLabPATIntoURL(tt.url, "token")
+			_, err := httpsBasicAuth(tt.url, "token", "")
 			require.Error(t, err)
 			assert.Contains(t, err.Error(), "PAT auth requires https:// URL")
 		})
```

**File**: `backend/internal/service/extension/skill_importer_git.go` (modified, +90/-96)
```diff
@@ -2,12 +2,19 @@ package extension
 
 import (
 	"context"
+	"errors"
 	"fmt"
 	"log/slog"
 	"os"
-	"os/exec"
 	"strings"
 
+	"github.com/go-git/go-git/v5"
+	"github.com/go-git/go-git/v5/plumbing"
+	"github.com/go-git/go-git/v5/plumbing/transport"
+	githttp "github.com/go-git/go-git/v5/plumbing/transport/http"
+	gitssh "github.com/go-git/go-git/v5/plumbing/transport/ssh"
+	xssh "golang.org/x/crypto/ssh"
+
 	"github.com/anthropics/agentsmesh/backend/internal/domain/extension"
 )
 
@@ -22,46 +29,46 @@ func validateGitBranch(branch string) error {
 	return nil
 }
 
+func validateBranchIfSet(branch string) error {
+	if branch == "" {
+		return nil
+	}
+	if err := validateGitBranch(branch); err != nil {
+		return fmt.Errorf("invalid branch: %w", err)
+	}
+	return nil
+}
+
 func gitCloneWithAuth(ctx context.Context, repoURL, branch, targetDir, authType, credential string) error {
 	slog.InfoContext(ctx, "git clone with auth", "auth_type", authType, "branch", branch)
 	switch authType {
 	case extension.AuthTypeGitHubPAT:
-		authedURL, err := injectPATIntoURL(repoURL, credential)
-		if err != nil {
-			return fmt.Errorf("failed to build authenticated URL: %w", err)
-		}
-		return gitClone(ctx, authedURL, branch, targetDir)
-
+		return cloneHTTPS(ctx, repoURL, branch, targetDir, credential, "")
 	case extension.AuthTypeGitLabPAT:
-		authedURL, err := injectGitLabPATIntoURL(repoURL, credential)
-		if err != nil {
-			return fmt.Errorf("failed to build authenticated URL: %w", err)
-		}
-		return gitClone(ctx, authedURL, branch, targetDir)
-
+		return cloneHTTPS(ctx, repoURL, branch, targetDir, "oauth2", credential)
 	case extension.AuthTypeSSHKey:
 		return gitCloneWithSSHKey(ctx, repoURL, branch, targetDir, credential)
-
 	default:
 		return gitClone(ctx, repoURL, branch, targetDir)
 	}
 }
 
-func injectPATIntoURL(repoURL, token string) (string, error) {
+// httpsBasicAuth builds explicit BasicAuth for an https repo. Credentials go
+// through go-git's Auth, never embedded in the clone URL, so they cannot leak
+// into go-git errors, the persisted sync_error, or logs.
+func httpsBasicAuth(repoURL, username, password string) (*githttp.BasicAuth, error) {
 	if !strings.HasPrefix(repoURL, "https://") {
-		return "", fmt.Errorf("PAT auth requires https:// URL, got: %s", repoURL)
+		return nil, fmt.Errorf("PAT auth requires https:// URL, got: %s", repoURL)
 	}
-	rest := strings.TrimPrefix(repoURL, "https://")
-	return fmt.Sprintf("https://%s@%s", token, rest), nil
+	return &githttp.BasicAuth{Username: username, Password: password}, nil
 }
 
-// injectGitLabPATIntoURL uses the oauth2 username form GitLab requires.
-func injectGitLabPATIntoURL(repoURL, token string) (string, error) {
-	if !strings.HasPrefix(repoURL, "https://") {
-		return "", fmt.Errorf("PAT auth requires https:// URL, got: %s", repoURL)
+func cloneHTTPS(ctx context.Context, repoURL, branch, targetDir, username, password string) error {
+	auth, err := httpsBasicAuth(repoURL, username, password)
+	if err != nil {
+		return fmt.Errorf("failed to build authenticated URL: %w", err)
 	}
-	rest := strings.TrimPrefix(repoURL, "https://")
-	return fmt.Sprintf("https://oauth2:%s@%s", token, rest), nil
+	return cloneRef(ctx, targetDir, repoURL, branch, auth, true, "git clone failed")
 }
 
 func gitCloneWithSSHKey(ctx context.Context, repoURL, branch, targetDir, sshKey string) error {
@@ -70,100 +77,87 @@ func gitCloneWithSSHKey(ctx context.Context, repoURL, branch, targetDir, sshKey
 	if !isGitSSH && !isLocalPath {
 		return fmt.Errorf("SSH key auth requires git@ URL, got: %s", repoURL)
 	}
-
-	tmpKeyFile, err := os.CreateTemp("", "skill-ssh-key-*")
-	if err != nil {
-		return fmt.Errorf("failed to create temp SSH key file: %w", err)
+	if err := validateBranchIfSet(branch); err != nil {
+		return err
 	}
-	defer os.Remove(tmpKeyFile.Name())
 
-	if _, err := tmpKeyFile.WriteString(sshKey); err != nil {
-		tmpKeyFile.Close()
-		return fmt.Errorf("failed to write SSH key: %w", err)
+	//
```

**File**: `backend/internal/service/extension/skill_importer_git_test.go` (modified, +34/-0)
```diff
@@ -259,3 +259,37 @@ func TestGitCloneWithSSHKey_SuccessfulClone_WithBranch(t *testing.T) {
 
 	assert.True(t, fileExists(filepath.Join(targetDir, "branch-file.txt")))
 }
+
+// TestGitCloneWithSSHKey_TagRef_LocalRepo pins the branch->tag fallback: a
+// Branch that names a tag (not a head) must still clone, matching the old
+// `git clone --branch <tag>`.
+func TestGitCloneWithSSHKey_TagRef_LocalRepo(t *testing.T) {
+	sourceDir := t.TempDir()
+	for _, args := range [][]string{
+		{"git", "init"},
+		{"git", "config", "user.email", "test@test.com"},
+		{"git", "config", "user.name", "Test"},
+	} {
+		cmd := exec.Command(args[0], args[1:]...)
+		cmd.Dir = sourceDir
+		out, err := cmd.CombinedOutput()
+		require.NoError(t, err, "git setup failed: %s", string(out))
+	}
+
+	require.NoError(t, os.WriteFile(filepath.Join(sourceDir, "tagged.txt"), []byte("tag content"), 0644))
+	for _, args := range [][]string{
+		{"git", "add", "."},
+		{"git", "commit", "-m", "initial"},
+		{"git", "tag", "v1.0.0"},
+	} {
+		cmd := exec.Command(args[0], args[1:]...)
+		cmd.Dir = sourceDir
+		out, err := cmd.CombinedOutput()
+		require.NoError(t, err, "git tag setup failed: %s", string(out))
+	}
+
+	targetDir := filepath.Join(t.TempDir(), "cloned")
+	err := gitCloneWithSSHKey(context.Background(), sourceDir, "v1.0.0", targetDir, "fake-ssh-key")
+	require.NoError(t, err, "clone of a tag ref should succeed via the branch->tag fallback")
+	assert.True(t, fileExists(filepath.Join(targetDir, "tagged.txt")))
+}
```

---

### Incident Patch 8: `dc353731` (2026-07-17)
**Commit Message**: fix(runner): repair runner/org deletion, harden registration, add FK-contract CI gate (#455)

Originating bug: deleting a runner 500'd — runner_pending_auths kept the only
non-cascading FK into runners (and one into organizations), so DELETE raised
23503. This system enforces referential integrity in the service layer, not with
FK constraints, so the fix drops those two FKs (000162) rather than adding a
cascade, and wires the never-scheduled purge jobs that keep the table drained.

Along the way this hardens the whole interactive/token registration path and
adds the missing guardrails that let those bugs ship:

- FK contract CI gate: fk_allowlist.txt (SSOT for the 125 legacy FKs) +
  check_fk_allowlist.sh (pg_constraint-based, keyed on the delete rule so a
  CASCADE→NO ACTION regression is caught) + a base-ref ratchet that rejects any
  net-new FK. Documented the no-FK policy in CLAUDE.md.
- gazelle idempotency: `# keep` on amesh codegen srcs/deps + a root
  `# gazelle:exclude` for the lint-materialized *_convert.amesh.go, plus a
  post-lint idempotency check in the go-lint job. Fixes `bazel run //:gazelle`
  silently rewriting BUILD files.
- AuthorizeRunner is now atomic: claim+cr

**File**: `.github/workflows/bazel.yml` (modified, +91/-0)
```diff
@@ -57,6 +57,72 @@ jobs:
             fi
           done
 
+  schema:
+    name: Schema (FK contract)
+    runs-on: ubuntu-latest
+    timeout-minutes: 10
+    services:
+      postgres:
+        image: pgvector/pgvector:pg16
+        env:
+          POSTGRES_PASSWORD: pw
+          POSTGRES_DB: fkgate
+        ports:
+          - 5432:5432
+        options: >-
+          --health-cmd "pg_isready -h 127.0.0.1 -U postgres -d fkgate"
+          --health-interval 10s
+          --health-timeout 5s
+          --health-retries 10
+    env:
+      DATABASE_URL: postgres://postgres:pw@localhost:5432/fkgate?sslmode=disable
+    steps:
+      - uses: actions/checkout@v6
+        with:
+          fetch-depth: 0
+      - name: Apply migrations
+        run: |
+          docker run --rm --network host -v "$PWD/backend/migrations:/m:ro" \
+            migrate/migrate:v4.19.0 -path=/m -database "$DATABASE_URL" up
+      - name: FK contract (allowlist matches the schema)
+        run: bash backend/migrations/check_fk_allowlist.sh
+      - name: FK allowlist may only shrink
+        if: github.event_name == 'pull_request'
+        env:
+          BASE_SHA: ${{ github.event.pull_request.base.sha }}
+        run: |
+          set -euo pipefail
+          export LC_ALL=C
+          list=backend/migrations/fk_allowlist.txt
+          # Fail hard if the base commit is missing (force-pushed base); only
+          # skip when the file genuinely does not exist there yet.
+          if ! git cat-file -e "${BASE_SHA}^{commit}" 2>/dev/null; then
+            echo "::error::base commit $BASE_SHA is not in this clone"
+            exit 1
+          fi
+          if ! git cat-file -e "$BASE_SHA:$list" 2>/dev/null; then
+            echo "$list is new on this branch; nothing to ratchet against."
+            exit 0
+          fi
+          # Counts, not diff lines and not entry sets: a table rename rewrites
+          # its entry (the key carries the table name) without adding an FK, and
+          # this repo has done exactly that -- see the ralph_pods_* constraint
+          # names still on autopilot_controllers. Both finer-grained checks fail
+          # such a PR with no escape hatch. Counting enforces what the contract
+          # actually claims (只减不增); check_fk_allowlist.sh separately pins the
+          # list to the real schema, so the count cannot be faked.
+          entries() { grep -cvE '^[[:space:]]*(#|$)' || :; }
+          base_n="$(git cat-file -p "$BASE_SHA:$list" | entries)"
+          head_n="$(entries < "$list")"
+          if [ "$head_n" -gt "$base_n" ]; then
+            echo "::error::fk_allowlist.txt grew from $base_n to $head_n entries. This system"
+            echo "::error::does not use FKs (CLAUDE.md 外键契约) -- the list may only shrink."
+            echo "::error::Do not silence the schema check by appending to it."
+            git diff "$BASE_SHA" -- "$list" | sed 's/^/    /'
+            exit 1
+          fi
+          echo "OK: allowlist did not grow ($base_n -> $head_n)."
+
   go:
     name: Go (tests)
     runs-on: ubuntu-latest
@@ -134,6 +200,31 @@ jobs:
       # re-materializing every transitive Go file as runfiles.
       - run: bazel run //${{ matrix.module }}:lint
 
+      # Deliberately after lint, and only on backend: the lint runner copies the
+      # amesh_proto_convert outputs into the source tree for golangci-lint's
+      # typecheck, and that polluted tree is the state gazelle actually breaks on
+      # for developers. Running this in a job that never lints would exercise the
+      # `# keep` markers but never the `# gazelle:exclude` that handles those
+      # copies -- i.e. it could not catch the regression it exists to catch.
+      - name: Gazelle is idempotent (post-lint tree)
+        if: matrix.module == 'backend'
+        run: |
+          set -euo pipefail
+          bazel run //:gazelle
+          # --porcelain, not `git diff`: gazelle's most common miss is generating
+          # a BUILD.bazel
```

**File**: `BUILD.bazel` (modified, +5/-0)
```diff
@@ -13,6 +13,11 @@ load("@gazelle//:def.bzl", "gazelle")
 load("@npm//:defs.bzl", "npm_link_all_packages")
 
 # gazelle:prefix github.com/anthropics/agentsmesh
+# `bazel run //backend:lint` copies the amesh_proto_convert outputs from
+# bazel-bin into the source tree so golangci-lint's typecheck can see them
+# (build_defs/go/golangci_lint_runner.sh). They are gitignored, so gazelle
+# would otherwise pick up a stale copy and swap out the codegen target.
+# gazelle:exclude **/*_convert.amesh.go
 # gazelle:proto disable_global
 # gazelle:go_naming_convention import_alias
 # gazelle:resolve go github.com/anthropics/agentsmesh/proto/gen/go/runner/v1 //proto/runner/v1:runner_go_proto
```

**File**: `CLAUDE.md` (modified, +64/-1)
```diff
@@ -114,7 +114,10 @@ docker compose logs -f postgres                  # docker infra
 bazel info workspace
 bazel run //:buildifier_check
 
-# Regenerate Go BUILD.bazel files after editing imports / adding packages
+# Regenerate Go BUILD.bazel files after editing imports / adding packages.
+# 跑完务必 `git diff` —— gazelle 只认磁盘上的 .go import，凡是它推不出来的
+# src/dep（codegen 产物、只被生成代码 import 的包）都会被删掉。这类行必须带
+# `# keep`，见下方「gazelle 与 codegen 产物」。CI 的 go-lint job 会验证幂等。
 bazel run //:gazelle
 
 # Build a Go binary + its OCI image
@@ -575,4 +578,64 @@ Or use an existing admin to grant privileges via the Admin Console UI.
 4. service 包加 `*Registry` helper 封装 `slugkit.GenerateUnique`
 5. 单测覆盖含 `.`/`_`/uppercase/unicode 的输入，断言落库值通过 `slugkit.Validate`
 
+## gazelle 与 codegen 产物
+
+gazelle 从磁盘上的 `.go` import 反推 `srcs`/`deps`。`amesh_proto_convert`（`//build_defs/protoconv`）的产物只存在于 bazel-bin，gazelle 看不见 —— 它会把 `:*_convert_amesh` 从 srcs 删掉，连带删掉只被生成代码 import 的 deps（`//backend/pkg/protoconv`、`//backend/internal/domain/*`），于是 `undefined: ToProtoX`。
+
+**凡是 gazelle 推不出来的行，必须标 `# keep`：**
+
+```python
+go_library(
+    srcs = [
+        "binding.go",
+        ":binding_convert_amesh",  # keep
+    ],
+    deps = [
+        "//backend/pkg/protoconv",  # keep
+    ],
+)
+```
+
+新增一个 `amesh_proto_convert` 包时照此办理，否则下一个跑 gazelle 的人会打断构建。CI 的 `go-lint` job 里 `Gazelle is idempotent (post-lint tree)` 会拦 —— 它**故意排在 lint 之后**，因为只有那时源码树才处于会触发问题的状态。
+
+> **源码树里出现 `*_convert.amesh.go` 是正常的，别去删。** `bazel run //backend:lint` 会把 bazel-bin 里的产物拷进源码树 —— golangci-lint 的 typecheck 必须看得见它们（`build_defs/go/golangci_lint_runner.sh`）。它们被 .gitignore 忽略，所以 `git status` 看不见。
+>
+> 于是 `lint` → `gazelle` 这个顺序（两条都是本文档推荐的命令）会让 gazelle 捡起这些文件、把它们当成手写 src 加进 `srcs`，和 `# keep` 住的 codegen target 撞成重复符号。根 `BUILD.bazel` 的 `# gazelle:exclude **/*_convert.amesh.go` 挡住这一步 —— **两个工具都没错，错在它们互不知情**。
+
+## 外键契约：本系统不使用外键
+
+**引用完整性由 service 层保证，不由 FK 约束保证。** 理由见 migration 000072：高写表上 FK 校验拖慢每次 INSERT，大表上 `ON DELETE CASCADE` 会拉出长事务和表锁。
+
+**新建表禁止写 `REFERENCES`。** 父子关系用普通列 + 索引表达（`runner_id BIGINT NOT NULL` + `CREATE INDEX`），不写约束。CI 的 `Schema (FK contract)` job 会拦：它把全部 migration 跑到一个空库上，再比对 `backend/migrations/fk_allowlist.txt`。
+
+```bash
+# 本地复现 CI 门禁（psql 若不在 host PATH，用 --entrypoint bash 跑在容器里）
+URL="postgres://postgres:pw@localhost:15999/fkgate?sslmode=disable"
+docker run -d --name pg -e POSTGRES_PASSWORD=pw -e POSTGRES_DB=fkgate -p 15999:5432 pgvector/pgvector:pg16
+docker run --rm --network host -v "$PWD/backend/migrations:/m:ro" migrate/migrate:v4.19.0 -path=/m -database "$URL" up
+backend/migrations/check_fk_allowlist.sh "$URL"
+```
+
+新增/修改 identifier 之外的表时若 CI 报 FK 门禁失败，**不要往 allowlist 里加行** —— 那正是它拒绝的操作。
+
+### 删除契约（无 FK 之后，删除逻辑全在 Go 里）
+
+新增一张带父引用的表时，**必须**同时决定父被删除时它怎么办，三选一：
+
+| 策略 | 做法 | 例 |
+|---|---|---|
+| **随父删除** | 在父的 service/repo 删除路径里显式 `DELETE FROM child WHERE parent_id = ?` | `organizationRepo.DeleteWithCleanup` |
+| **拦住父删除** | 父的 service 里先 count，非零就返回 domain error，API 层映射成 409 | `CountLoopsByRunner` → `ErrRunnerHasLoopRefs` |
+| **自过期** | 表自带 `expires_at` + 后台 purge job；容忍孤儿行到期被清 | `runner_pending_auths` / `runner_reactivation_tokens` + `startRegistrationGC` |
+
+**漏掉这一步的代价**：手写清理清单漂移过两次，都炸到线上 —— SQLSTATE 42703（清单引用了不存在的列，阻断**所有** org 删除）、SQLSTATE 23503（漏了一张表 + 残留 FK，阻断 runner 删除和 15 个 org）。
+
+### 存量债
+
+`backend/migrations/fk_allowlist.txt` 是存量的 SSOT（数量以文件为准，不要在别处抄一份）。多数早于 000072，另有 9 个 migration 在 000072 之后新增。它们是债，正在分批 DROP —— **它们与本契约相悖，是意料之外的失败模式来源**。`DROP CONSTRAINT` 是 O(1) 元数据操作；反向 `ADD CONSTRAINT` 要全表扫描验证，所以还债便宜、走反方向贵。
+
+allowlist 的 key 里带 `[delete rule]`：CASCADE 被悄悄改成 NO ACTION 正是两次事故的根因，只比对列名的门禁看不见它。
+
+**门禁只覆盖 migration 跑在空库上的结果，不覆盖线上漂移**（手工 DDL 它看不到）。两个 CI step 各管一半：`FK contract` 断言 allowlist 与 schema 一致；`FK allowlist may only shrink` 对 base ref 做 diff，拒绝新增行 —— 没有后者的话，往 allowlist 里补一行就能让前者闭嘴。
+
 参见 `backend/pkg/slugkit/doc.go` 完整说明，`.claude/plans/sharded-imagining-bird.md` 重构 plan。
\ No newline at end of file
```

**File**: `backend/cmd/server/BUILD.bazel` (modified, +2/-0)
```diff
@@ -20,6 +20,7 @@ go_library(
         "main.go",
         "main_startup.go",
         "notif_dedup.go",
+        "registration_gc.go",
         "relay_init.go",
         "server.go",
         "services_init.go",
@@ -87,6 +88,7 @@ go_library(
         "//backend/internal/infra/otel",
         "//backend/internal/infra/pki",
         "//backend/internal/infra/storage",
+        "//backend/internal/infra/tasks",
         "//backend/internal/infra/websocket",
         "//backend/internal/interfaces",
         "//backend/internal/job",
```

**File**: `backend/cmd/server/main.go` (modified, +3/-1)
```diff
@@ -180,10 +180,12 @@ func main() {
 	cleanupMkt := startMarketplaceWorker(services)
 	defer cleanupMkt()
 
+	registrationGC := startRegistrationGC(services, appLogger.Logger)
+
 	subscriptionScheduler := startSubscriptionJobs(db, cfg, services.email, appLogger.Logger)
 
 	// Start HTTP server (Connect-RPC handlers wrap the Gin router)
 	srv := startHTTPServer(cfg, wrapWithConnect(cfg, services, svc, router))
 
-	waitForShutdown(srv, grpcResult.server, eventBus, heartbeatBatcher, subscriptionScheduler, loopScheduler, orgAwareness, relayManager, services, db, redisClient)
+	waitForShutdown(srv, grpcResult.server, eventBus, heartbeatBatcher, subscriptionScheduler, loopScheduler, orgAwareness, relayManager, registrationGC, services, db, redisClient)
 }
```

---

### Incident Patch 9: `ce395766` (2026-06-24)
**Commit Message**: fix(desktop): restore window dragging from titlebar headers (macOS immersive) (#451)

#449 shrank the only -webkit-app-region:drag region into the ActivityBar,
leaving the main window's content headers and all popout windows undraggable
on macOS hiddenInset (v0.44.2 regression).

Make each window-top header bar its own drag region, with a global rule that
auto-carves interactive descendants back to no-drag (so header buttons stay
clickable; [draggable=true] also opts out to preserve HTML5 tab tear-off):
- app-drag on SideBar / ChannelHeader / TicketsPageHeader / BlocksDocHeader /
  MeshPage headers, plus the channel loading skeleton
- TerminalPaneHeader bar drags only in the popout (!canTearOff); main-window
  split panes keep HTML5 tab tear-off and never drag the window
- route-scoped no-activity-bar class on popout page roots insets the titlebar
  78px clear of the traffic lights, and drops when a popout navigates into the
  full IDE shell (the root unmounts) — fixes the static window-class corruption

Converged over 3 review rounds; see memory desktop_titlebar_app_region_pitfalls.

Co-authored-by: yishuiliunian <test@test.com>

**File**: `clients/desktop/src/renderer/globals.css` (modified, +22/-0)
```diff
@@ -207,6 +207,28 @@ body:has(.app-shell) {
 .app-no-drag {
   -webkit-app-region: no-drag;
 }
+/* -webkit-app-region is per-element (no inheritance); carve interactive descendants
+   back to no-drag so a draggable header keeps its buttons clickable. [draggable="true"]
+   opts out too — HTML5 tab tear-off is mutually exclusive with native app-region drag. */
+.app-drag button,
+.app-drag a,
+.app-drag input,
+.app-drag textarea,
+.app-drag select,
+.app-drag label,
+.app-drag [role="button"],
+.app-drag [role="textbox"],
+.app-drag [contenteditable="true"],
+.app-drag [draggable="true"] {
+  -webkit-app-region: no-drag;
+}
+/* A popout's titlebar header has no activity bar to its left, so it sits under the macOS
+   traffic lights — inset it clear. Route-scoped (not window-kind): no-activity-bar marks the
+   popout page root, so navigating into the full IDE shell drops the inset (the root unmounts).
+   78px = trafficLightPosition.x 14 + 3 lights (create_window.ts). */
+.platform-mac .no-activity-bar .app-drag {
+  padding-left: 78px;
+}
 
 /* Typography prose — map to theme CSS variables */
 .prose {
```

**File**: `clients/desktop/src/renderer/pages/dashboard/mesh/MeshPage.tsx` (modified, +1/-1)
```diff
@@ -32,7 +32,7 @@ export function MeshPage() {
 
   return (
     <div className="flex h-full w-full min-w-0 flex-col overflow-hidden">
-      <header className="flex items-center justify-between border-b border-border px-6 py-3.5">
+      <header className="app-drag flex items-center justify-between border-b border-border px-6 py-3.5">
         <h1 className="text-[18px] font-semibold text-foreground">{t("mesh.page.title")}</h1>
 
         <div className="flex items-center gap-2">
```

**File**: `clients/desktop/src/renderer/pages/popout/channel/PopoutChannelPage.tsx` (modified, +1/-1)
```diff
@@ -24,7 +24,7 @@ export function PopoutChannelPage() {
 
   return (
     <RealtimeProvider>
-      <div className="h-screen w-screen bg-background">
+      <div className="no-activity-bar h-screen w-screen bg-background">
         <ChannelChatPanel channelId={channelId} />
       </div>
     </RealtimeProvider>
```

**File**: `clients/desktop/src/renderer/pages/popout/terminal/PopoutTerminalPage.tsx` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ export function PopoutTerminalPage() {
 
   return (
     <RealtimeProvider>
-      <div className="h-screen w-screen bg-terminal-bg">
+      <div className="no-activity-bar h-screen w-screen bg-terminal-bg">
         <TerminalPane
           paneId={`popout-${podKey}`}
           podKey={podKey}
```

**File**: `clients/web/src/components/blocks/BlocksDocHeader.tsx` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@ export function BlocksDocHeader({
     </>
   );
   return (
-    <div className="flex flex-col gap-1.5 border-b border-border px-12 pb-3 pt-4">
+    <div className="app-drag flex flex-col gap-1.5 border-b border-border px-12 pb-3 pt-4">
       <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
         <span>Pages</span>
         <span className="text-border">›</span>
```

---

### Incident Patch 10: `d208723b` (2026-06-22)
**Commit Message**: fix(desktop): remove full-width titlebar gap — spacer into left rail only (#449)

The immersive-titlebar drag spacer was a full-width strip at IDEShell's top,
pushing the sidebar/main cards down by --titlebar-drag-height (40px on macOS)
→ a gray band across the entire window top (desktop only; web stays 0).

Move the spacer back inside ActivityBar so the traffic-light reserve only
occupies the left rail; the sidebar/main cards now reach near the window top.

Co-authored-by: yishuiliunian <test@test.com>

**File**: `clients/web/src/components/ide/ActivityBar.tsx` (modified, +5/-0)
```diff
@@ -110,6 +110,11 @@ export function ActivityBar({ className }: ActivityBarProps) {
           className
         )}
       >
+        <div
+          className="app-drag shrink-0"
+          style={{ height: "var(--titlebar-drag-height)" }}
+          aria-hidden="true"
+        />
         <div className="app-drag flex h-12 items-center justify-start px-2">
           <OrgSwitcher />
         </div>
```

**File**: `clients/web/src/components/ide/IDEShell.tsx` (modified, +17/-25)
```diff
@@ -99,31 +99,23 @@ export function IDEShell({
   }
 
   return (
-    <div className={cn("app-shell flex flex-col h-screen bg-sidebar overflow-hidden", className)}>
-      <div
-        className="app-drag shrink-0"
-        style={{ height: "var(--titlebar-drag-height)" }}
-        aria-hidden="true"
-      />
-
-      <div className="flex min-h-0 flex-1">
-        <ActivityBar className="flex-shrink-0" />
-
-        <div className="flex min-w-0 flex-1 gap-2 p-2">
-          <SideBar className="flex-shrink-0" headerAction={sidebarHeaderAction}>{effectiveSidebarContent}</SideBar>
-
-          <div className="flex-1 flex flex-col min-w-0 overflow-hidden rounded-xl border border-border/50 bg-background shadow-sm">
-            <main
-              className={cn(
-                "flex-1 overflow-auto",
-                activeActivity === "workspace" && bottomPanelOpen ? "" : "pb-8"
-              )}
-            >
-              {children}
-            </main>
-
-            {activeActivity === "workspace" && <BottomPanel />}
-          </div>
+    <div className={cn("app-shell flex h-screen bg-sidebar overflow-hidden", className)}>
+      <ActivityBar className="flex-shrink-0" />
+
+      <div className="flex min-w-0 flex-1 gap-2 p-2">
+        <SideBar className="flex-shrink-0" headerAction={sidebarHeaderAction}>{effectiveSidebarContent}</SideBar>
+
+        <div className="flex-1 flex flex-col min-w-0 overflow-hidden rounded-xl border border-border/50 bg-background shadow-sm">
+          <main
+            className={cn(
+              "flex-1 overflow-auto",
+              activeActivity === "workspace" && bottomPanelOpen ? "" : "pb-8"
+            )}
+          >
+            {children}
+          </main>
+
+          {activeActivity === "workspace" && <BottomPanel />}
         </div>
       </div>
 
```

#### Recent Merged Pull Requests:
- **PR #474** (2026-09-23): fix(auth): fail closed on missing/default JWT_SECRET (@ZxlDragonDoctor)
- **PR #473** (closed): Add knos to .mcp.json so agents share one decision record (@drexthealpha)
- **PR #470** (2026-07-24): fix(terminal): harden PTY relay rendering lifecycle (@yishuiliunian)
- **PR #469** (2026-07-24): chore(skills): portable agent skills via canonical source + projections (@yishuiliunian)
- **PR #468** (2026-07-24): fix(channel): restore follow-to-bottom for new messages (v0.44.5 regression) (@yishuiliunian)
- **PR #466** (2026-07-23): fix(channel): robust entry scroll & unread-divider positioning (@yishuiliunian)
- **PR #465** (2026-07-23): fix(ci): support pinned curl in GitLab sync (@yishuiliunian)
- **PR #464** (2026-07-23): fix(deploy): route Connect RPC in private templates (@yishuiliunian)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
