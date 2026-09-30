# Forensic Learning Record (Deep Inspection): github/github-mcp-server

> **Canonical Artifact**: `07_PROJECT_LEARNING/github-github-mcp-server-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/github/github-mcp-server](https://github.com/github/github-mcp-server))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:27:17.576Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `github/github-mcp-server`
- **Description**: GitHub's official MCP Server
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 33305 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cmd/github-mcp-server/helpers.go`
```
package main

import "strings"

// formatToolsetName converts a toolset ID to a human-readable name.
// Used by both generate_docs.go and list_scopes.go for consistent formatting.
func formatToolsetName(name string) string {
	switch name {
	case "pull_requests":
		return "Pull Requests"
	case "repos":
		return "Repositories"
	case "code_security":
		return "Code Security"
	case "secret_protection":
		return "Secret Protection"
	case "orgs":
		return "Organizations"
	default:
		// Fallback: capitalize first letter and replace underscores with spaces
		parts := strings.Split(name, "_")
		for i, part := range parts {
			if len(part) > 0 {
				parts[i] = strings.ToUpper(string(part[0])) + part[1:]
			}
		}
		return strings.Join(parts, " ")
	}
}

```

### Core Architecture Module: `cmd/github-mcp-server/list_scopes.go`
```
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"sort"
	"strings"

	"github.com/github/github-mcp-server/pkg/github"
	"github.com/github/github-mcp-server/pkg/inventory"
	"github.com/github/github-mcp-server/pkg/translations"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

// ToolScopeInfo contains scope information for a single tool.
type ToolScopeInfo struct {
	Name            string   `json:"name"`
	Toolset         string   `json:"toolset"`
	ReadOnly        bool     `json:"read_only"`
	ChallengeScopes []string `json:"challenge_scopes,omitempty"`
}

// ScopesOutput is the full output structure for the list-scopes command.
type ScopesOutput struct {
	Tools           []ToolScopeInfo     `json:"tools"`
	UniqueScopes    []string            `json:"unique_scopes"`
	ScopesByTool    map[string][]string `json:"scopes_by_tool"`
	ToolsByScope    map[string][]string `json:"tools_by_scope"`
	EnabledToolsets []string            `json:"enabled_toolsets"`
	ReadOnly        bool                `json:"read_only"`
}

var listScopesCmd = &cobra.Command{
	Use:   "list-scopes",
	Short: "List OAuth scope policies for enabled tools",
	Long: `List the OAuth challenge scopes for all enabled tools.

This command creates an inventory based on the same flags as the stdio command
and outputs the scopes each enabled tool may request in an OAuth challenge.

The output format can be controlled with the --output flag:
  - text (default): Human-readable text output
  - json: JSON output for programmatic use
  - summary: Just the unique scopes needed

Examples:
  # List scopes for default toolsets
  github-mcp-server list-scopes

  # List scopes for specific toolsets
  github-mcp-server list-scopes --toolsets=repos,issues,pull_requests

  # List scopes for all toolsets
  github-mcp-server list-scopes --toolsets=all

  # Output as JSON
  github-mcp-server list-scopes --output=json

  # Just show unique scopes needed
  github-mcp-server list-scopes --output=summary`,
	RunE: func(_ *cobra.Command, _ []string) error {
		return runListScopes()
	},
}

func init() {
	listScopesCmd.Flags().StringP("output", "o", "text", "Output format: text, json, or summary")
	_ = viper.BindPFlag("list-scopes-output", listScopesCmd.Flags().Lookup("output"))

	rootCmd.AddCommand(listScopesCmd)
}

// formatScopeDisplay formats a scope string for display, handling empty scopes.
func formatScopeDisplay(scope string) string {
	if scope == "" {
		return "(no scope required for public read access)"
	}
	return scope
}

func runListScopes() error {
	// Get toolsets configuration (same logic as stdio command)
	var enabledToolsets []string
	if viper.IsSet("toolsets") {
		if err := viper.UnmarshalKey("toolsets", &enabledToolsets); err != nil {
			return fmt.Errorf("failed to unmarshal toolsets: %w", err)
		}
	}
	// else: enabledToolsets stays nil, meaning "use defaults"

	// Get specific tools (similar to toolsets)
	var enabledTools []string
	if viper.IsSet("tools") {
		if err := viper.UnmarshalKey("tools", &enabledTools); err != nil {
			return fmt.Errorf("failed to unmarshal tools: %w", err)
		}
	}

	readOnly := viper.GetBool("read-only")
	outputFormat := viper.GetString("list-scopes-output")

	// Create translation helper
	t, _ := translations.TranslationHelper()

	// Build inventory using the same logic as the stdio server
	inventoryBuilder := github.NewInventory(t).
		WithReadOnly(readOnly)

	// Configure toolsets (same as stdio)
	if enabledToolsets != nil {
		inventoryBuilder = inventoryBuilder.WithToolsets(enabledToolsets)
	}

	// Configure specific tools
	if len(enabledTools) > 0 {
		inventoryBuilder = inventoryBuilder.WithTools(enabledTools)
	}

	inv, err := inventoryBuilder.Build()
	if err != nil {
		return fmt.Errorf("failed to build inventory: %w", err)
	}

	// Collect all tools and their scopes
	output := collectToolScopes(inv, readOnly)

	// Output based on format
	switch outputFormat {
	case "json":
		return outputJSON(output)
	case "summary":
		return outputSummary(output)
	default:
		return outputText(output)
	}
}

func collectToolScopes(inv *inventory.Inventory, readOnly bool) ScopesOutput {
	var tools []ToolScopeInfo
	scopeSet := make(map[string]bool)
	scopesByTool := make(map[string][]string)
	toolsByScope := make(map[string][]string)

	// Get all available tools from the inventory
	// Use context.Background() for feature flag evaluation
	availableTools := inv.AvailableTools(context.Background())

	for _, serverTool := range availableTools {
		tool := serverTool.Tool

		challengeScopes := serverTool.ScopeAccess.Scopes

		// Determine if tool is read-only
		isReadOnly := serverTool.IsReadOnly()

		toolInfo := ToolScopeInfo{
			Name:            tool.Name,
			Toolset:         string(serverTool.Toolset.ID),
			ReadOnly:        isReadOnly,
			ChallengeScopes: challengeScopes,
		}
		tools = append(tools, toolInfo)

		// Track unique scopes
		for _, s := range challengeScopes {
			scopeSet[s] = true
			toolsByScope[s] = append(toolsByScope[s], tool.Name)
		}

		// Track scopes by tool
		scopesByTool[tool.Name] = challengeScopes
	}

	// Sort tools by name
	sort.Slice(tools, func(i, j int) bool {
		return tools[i].Name < tools[j].Name
	})

	// Get unique scopes as sorted slice
	var uniqueScopes []string
	for s := range scopeSet {
		uniqueScopes = append(uniqueScopes, s)
	}
	sort.Strings(uniqueScopes)

	// Sort tools within each scope
	for scope := range toolsByScope {
		sort.Strings(toolsByScope[scope])
	}

	// Get enabled toolsets as string slice
	toolsetIDs := inv.ToolsetIDs()
	toolsetIDStrs := make([]string, len(toolsetIDs))
	for i, id := range toolsetIDs {
		toolsetIDStrs[i] = string(id)
	}

	return ScopesOutput{
		Tools:           tools,
		UniqueScopes:    uniqueScopes,
		ScopesByTool:    scopesByTool,
		ToolsByScope:    toolsByScope,
		EnabledToolsets: toolsetIDStrs,
		ReadOnly:        readOnly,
	}
}

func outputJSON(output ScopesOutput) error {
	encoder := json.NewEncoder(os.Stdout)
	encoder.SetIndent("", "  ")
	return encoder.Encode(output)
}

func outputSummary(output ScopesOutput) error {
	if len(output.UniqueScopes) == 0 {
		fmt.Println("No OAuth scopes required for enabled tools.")
		return nil
	}

	fmt.Println("OAuth scope policies for enabled tools:")
	fmt.Println()
	for _, scope := range output.UniqueScopes {
		fmt.Printf("  %s\n", formatScopeDisplay(scope))
	}
	fmt.Printf("\nTotal: %d unique scope(s)\n", len(output.UniqueScopes))
	return nil
}

func outputText(output ScopesOutput) error {
	fmt.Printf("OAuth Challenge Scopes for Enabled Tools\n")
	fmt.Printf("========================================\n\n")

	fmt.Printf("Enabled Toolsets: %s\n", strings.Join(output.EnabledToolsets, ", "))
	fmt.Printf("Read-Only Mode: %v\n\n", output.ReadOnly)

	// Group tools by toolset
	toolsByToolset := make(map[string][]ToolScopeInfo)
	for _, tool := range output.Tools {
		toolsByToolset[tool.Toolset] = append(toolsByToolset[tool.Toolset], tool)
	}

	// Get sorted toolset names
	var toolsetNames []string
	for name := range toolsByToolset {
		toolsetNames = append(toolsetNames, name)
	}
	sort.Strings(toolsetNames)

	for _, toolsetName := range toolsetNames {
		tools := toolsByToolset[toolsetName]
		fmt.Printf("## %s\n\n", formatToolsetName(toolsetName))

		for _, tool := range tools {
			rwIndicator := "📝"
			if tool.ReadOnly {
				rwIndicator = "👁"
			}

			scopeStr := "(no scope required)"
			if len(tool.ChallengeScopes) > 0 {
				scopeStr = strings.Join(tool.ChallengeScopes, ", ")
			}

			fmt.Printf("  %s %s: %s\n", rwIndicator, tool.Name, scopeStr)
		}
		fmt.Println()
	}

	// Summary
	fmt.Println("## Summary")
	fmt.Println()
	if len(output.UniqueScopes) == 0 {
		fmt.Println("No OAuth scopes are used by enabled tools.")
	} else {
		fmt.Println("Unique challenge scopes:")
		for _, scope := range output.UniqueScopes {
			fmt.Printf("  • %s\n", formatScopeDisplay(scope))
		}
	}
	fmt.Printf("\nTotal: %d tools, %d unique scopes\n", len(output.Tools), len(output.UniqueScopes))

	// Leg
```

### Core Architecture Module: `cmd/github-mcp-server/main.go`
```
package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/github/github-mcp-server/internal/buildinfo"
	"github.com/github/github-mcp-server/internal/ghmcp"
	"github.com/github/github-mcp-server/internal/githubapp"
	"github.com/github/github-mcp-server/internal/oauth"
	"github.com/github/github-mcp-server/pkg/github"
	ghhttp "github.com/github/github-mcp-server/pkg/http"
	ghoauth "github.com/github/github-mcp-server/pkg/http/oauth"
	"github.com/github/github-mcp-server/pkg/utils"
	"github.com/spf13/cobra"
	"github.com/spf13/pflag"
	"github.com/spf13/viper"
)

// These variables are set by the build process using ldflags.
var version = "version"
var commit = "commit"
var date = "date"

var (
	rootCmd = &cobra.Command{
		Use:     "github-mcp-server",
		Short:   "GitHub MCP Server",
		Long:    `A GitHub MCP server that handles various tools and resources.`,
		Version: fmt.Sprintf("Version: %s\nCommit: %s\nBuild Date: %s", version, commit, date),
	}

	stdioCmd = &cobra.Command{
		Use:   "stdio",
		Short: "Start stdio server",
		Long:  `Start a server that communicates via standard input/output streams using JSON-RPC messages.`,
		RunE: func(_ *cobra.Command, _ []string) error {
			token := viper.GetString("personal_access_token")
			appID := viper.GetString("app-id")
			appInstallationID := viper.GetString("app-installation-id")
			appPrivateKeyPath := viper.GetString("app-private-key-path")
			appPrivateKeyInline := viper.GetString("app-private-key")
			appAuthRequested := appID != "" || appInstallationID != "" || appPrivateKeyPath != "" || appPrivateKeyInline != ""

			oauthClientID := viper.GetString("oauth-client-id")
			oauthClientSecret := viper.GetString("oauth-client-secret")
			// Fall back to the build-time baked-in client (official releases) when none is
			// configured explicitly. The baked-in app is registered on github.com, so it is
			// only applied to the default host; GHES/ghe.com users must bring their own
			// --oauth-client-id. Recognizing the host via NormalizeHost means an explicit
			// GITHUB_HOST=github.com (or api.github.com) still counts as the default and keeps
			// zero-config login working. The secret tracks the id, so an explicitly provided
			// id with no secret never picks up the baked-in secret.
			if oauthClientID == "" && !appAuthRequested && oauth.NormalizeHost(viper.GetString("host")) == "https://github.com" {
				oauthClientID = buildinfo.OAuthClientID
				oauthClientSecret = buildinfo.OAuthClientSecret
			}
			if token == "" && !appAuthRequested && oauthClientID == "" {
				return errors.New("authentication required: set GITHUB_PERSONAL_ACCESS_TOKEN, configure GitHub App auth, or pass --oauth-client-id to log in via OAuth")
			}
			if appAuthRequested && token != "" {
				return errors.New("GitHub App authentication and GITHUB_PERSONAL_ACCESS_TOKEN are mutually exclusive: set only one")
			}
			if appAuthRequested && oauthClientID != "" {
				return errors.New("GitHub App authentication and OAuth login (--oauth-client-id) are mutually exclusive: set only one")
			}

			// If you're wondering why we're not using viper.GetStringSlice("toolsets"),
			// it's because viper doesn't handle comma-separated values correctly for env
			// vars when using GetStringSlice.
			// https://github.com/spf13/viper/issues/380
			//
			// Additionally, viper.UnmarshalKey returns an empty slice even when the flag
			// is not set, but we need nil to indicate "use defaults". So we check IsSet first.
			var enabledToolsets []string
			if viper.IsSet("toolsets") {
				if err := viper.UnmarshalKey("toolsets", &enabledToolsets); err != nil {
					return fmt.Errorf("failed to unmarshal toolsets: %w", err)
				}
			}
			// else: enabledToolsets stays nil, meaning "use defaults"

			// Parse tools (similar to toolsets)
			var enabledTools []string
			if viper.IsSet("tools") {
				if err := viper.UnmarshalKey("tools", &enabledTools); err != nil {
					return fmt.Errorf("failed to unmarshal tools: %w", err)
				}
			}

			// Parse excluded tools (similar to tools)
			var excludeTools []string
			if viper.IsSet("exclude_tools") {
				if err := viper.UnmarshalKey("exclude_tools", &excludeTools); err != nil {
					return fmt.Errorf("failed to unmarshal exclude-tools: %w", err)
				}
			}

			// Parse enabled features (similar to toolsets)
			var enabledFeatures []string
			if viper.IsSet("features") {
				if err := viper.UnmarshalKey("features", &enabledFeatures); err != nil {
					return fmt.Errorf("failed to unmarshal features: %w", err)
				}
			}

			ttl := viper.GetDuration("repo-access-cache-ttl")
			stdioServerConfig := ghmcp.StdioServerConfig{
				Version:              version,
				Host:                 viper.GetString("host"),
				Token:                token,
				EnabledToolsets:      enabledToolsets,
				EnabledTools:         enabledTools,
				EnabledFeatures:      enabledFeatures,
				ReadOnly:             viper.GetBool("read-only"),
				ExportTranslations:   viper.GetBool("export-translations"),
				EnableCommandLogging: viper.GetBool("enable-command-logging"),
				LogFilePath:          viper.GetString("log-file"),
				ContentWindowSize:    viper.GetInt("content-window-size"),
				LockdownMode:         viper.GetBool("lockdown-mode"),
				InsidersMode:         viper.GetBool("insiders"),
				ExcludeTools:         excludeTools,
				RepoAccessCacheTTL:   &ttl,
			}

			// When no static token is provided, log in via OAuth using the given
			// client. The requested scopes default to the standard set; high-risk
			// scopes such as delete_repo require explicit --oauth-scopes opt-in.
			// The requested set also filters tools needing other scopes.
			if token == "" && !appAuthRequested {
				scopes := ghoauth.DefaultScopes
				if viper.IsSet("oauth-scopes") {
					if err := viper.UnmarshalKey("oauth-scopes", &scopes); err != nil {
						return fmt.Errorf("failed to unmarshal oauth-scopes: %w", err)
					}
				}
				oauthConfig := oauth.NewGitHubConfig(
					oauthClientID,
					oauthClientSecret,
					scopes,
					viper.GetString("host"),
					viper.GetInt("oauth-callback-port"),
				)
				stdioServerConfig.OAuthManager = oauth.NewManager(oauthConfig, nil)
				stdioServerConfig.OAuthScopes = scopes
			}

			if appAuthRequested {
				tokenProvider, err := newGitHubAppTokenProvider(appID, appInstallationID, appPrivateKeyPath, appPrivateKeyInline, viper.GetString("host"))
				if err != nil {
					return err
				}
				stdioServerConfig.TokenProvider = tokenProvider
			}

			return ghmcp.RunStdioServer(stdioServerConfig)
		},
	}

	httpCmd = &cobra.Command{
		Use:   "http",
		Short: "Start HTTP server",
		Long:  `Start an HTTP server that listens for MCP requests over HTTP.`,
		RunE: func(_ *cobra.Command, _ []string) error {
			// Parse toolsets (same approach as stdio — see comment there)
			var enabledToolsets []string
			if viper.IsSet("toolsets") {
				if err := viper.UnmarshalKey("toolsets", &enabledToolsets); err != nil {
					return fmt.Errorf("failed to unmarshal toolsets: %w", err)
				}
			}

			var enabledTools []string
			if viper.IsSet("tools") {
				if err := viper.UnmarshalKey("tools", &enabledTools); err != nil {
					return fmt.Errorf("failed to unmarshal tools: %w", err)
				}
			}

			var excludeTools []string
			if viper.IsSet("exclude_tools") {
				if err := viper.UnmarshalKey("exclude_tools", &excludeTools); err != nil {
					return fmt.Errorf("failed to unmarshal exclude-tools: %w", err)
				}
			}

			var enabledFeatures []string
			if viper.IsSet("features") {
				if err := viper.UnmarshalKey("features", &enabledFeatures); err != nil {
					return fmt.Errorf("failed to unmarshal features: %w", err)
				}
			}

			ttl := viper.GetDuration("repo-access-cache-ttl")
			httpConfig := ghhttp.ServerConfig{
				Version:              version,
				Host:                 viper.GetString("host"),
				Port:                 viper.GetInt("port"),
				ListenHost:           viper.GetString("listen-host
```

### Core Architecture Module: `cmd/mcpcurl/main.go`
```
package main

import (
	"bufio"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"os"
	"os/exec"
	"slices"
	"strings"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

type (
	// SchemaResponse represents the top-level response containing tools
	SchemaResponse struct {
		Result  Result `json:"result"`
		JSONRPC string `json:"jsonrpc"`
		ID      int    `json:"id"`
	}

	// Result contains the list of available tools
	Result struct {
		Tools []Tool `json:"tools"`
	}

	// Tool represents a single command with its schema
	Tool struct {
		Name        string      `json:"name"`
		Description string      `json:"description"`
		InputSchema InputSchema `json:"inputSchema"`
	}

	// InputSchema defines the structure of a tool's input parameters
	InputSchema struct {
		Type                 string              `json:"type"`
		Properties           map[string]Property `json:"properties"`
		Required             []string            `json:"required"`
		AdditionalProperties bool                `json:"additionalProperties"`
		Schema               string              `json:"$schema"`
	}

	// Property defines a single parameter's type and constraints
	Property struct {
		Type        string        `json:"type"`
		Description string        `json:"description"`
		Enum        []string      `json:"enum,omitempty"`
		Minimum     *float64      `json:"minimum,omitempty"`
		Maximum     *float64      `json:"maximum,omitempty"`
		Items       *PropertyItem `json:"items,omitempty"`
	}

	// PropertyItem defines the type of items in an array property
	PropertyItem struct {
		Type                 string              `json:"type"`
		Properties           map[string]Property `json:"properties,omitempty"`
		Required             []string            `json:"required,omitempty"`
		AdditionalProperties bool                `json:"additionalProperties,omitempty"`
	}

	// JSONRPCRequest represents a JSON-RPC 2.0 request
	JSONRPCRequest struct {
		JSONRPC string        `json:"jsonrpc"`
		ID      int           `json:"id"`
		Method  string        `json:"method"`
		Params  RequestParams `json:"params"`
	}

	// RequestParams contains the tool name and arguments
	RequestParams struct {
		Name      string         `json:"name"`
		Arguments map[string]any `json:"arguments"`
	}

	// Content matches the response format of a text content response
	Content struct {
		Type string `json:"type"`
		Text string `json:"text"`
	}

	ResponseResult struct {
		Content []Content `json:"content"`
	}

	Response struct {
		Result  ResponseResult `json:"result"`
		JSONRPC string         `json:"jsonrpc"`
		ID      int            `json:"id"`
	}
)

var (
	// Create root command
	rootCmd = &cobra.Command{
		Use:   "mcpcurl",
		Short: "CLI tool with dynamically generated commands",
		Long:  "A CLI tool for interacting with MCP API based on dynamically loaded schemas",
		PersistentPreRunE: func(cmd *cobra.Command, _ []string) error {
			// Skip validation for help and completion commands
			if cmd.Name() == "help" || cmd.Name() == "completion" {
				return nil
			}

			// Check if the required global flag is provided
			serverCmd, _ := cmd.Flags().GetString("stdio-server-cmd")
			if serverCmd == "" {
				return fmt.Errorf("--stdio-server-cmd is required")
			}
			return nil
		},
	}

	// Add schema command
	schemaCmd = &cobra.Command{
		Use:   "schema",
		Short: "Fetch schema from MCP server",
		Long:  "Fetches the tools schema from the MCP server specified by --stdio-server-cmd",
		RunE: func(cmd *cobra.Command, _ []string) error {
			serverCmd, _ := cmd.Flags().GetString("stdio-server-cmd")
			if serverCmd == "" {
				return fmt.Errorf("--stdio-server-cmd is required")
			}

			// Build the JSON-RPC request for tools/list
			jsonRequest, err := buildJSONRPCRequest("tools/list", "", nil)
			if err != nil {
				return fmt.Errorf("failed to build JSON-RPC request: %w", err)
			}

			// Execute the server command and pass the JSON-RPC request
			response, err := executeServerCommand(serverCmd, jsonRequest)
			if err != nil {
				return fmt.Errorf("error executing server command: %w", err)
			}

			// Output the response
			fmt.Println(response)
			return nil
		},
	}

	// Create the tools command
	toolsCmd = &cobra.Command{
		Use:   "tools",
		Short: "Access available tools",
		Long:  "Contains all dynamically generated tool commands from the schema",
	}
)

func main() {
	rootCmd.AddCommand(schemaCmd)

	// Add global flag for stdio server command
	rootCmd.PersistentFlags().String("stdio-server-cmd", "", "Shell command to invoke MCP server via stdio (required)")
	_ = rootCmd.MarkPersistentFlagRequired("stdio-server-cmd")

	// Add global flag for pretty printing
	rootCmd.PersistentFlags().Bool("pretty", true, "Pretty print MCP response (only for JSON or JSONL responses)")

	// Add the tools command to the root command
	rootCmd.AddCommand(toolsCmd)

	// Execute the root command once to parse flags
	_ = rootCmd.ParseFlags(os.Args[1:])

	// Get pretty flag
	prettyPrint, err := rootCmd.Flags().GetBool("pretty")
	if err != nil {
		_, _ = fmt.Fprintf(os.Stderr, "Error getting pretty flag: %v\n", err)
		os.Exit(1)
	}
	// Get server command
	serverCmd, err := rootCmd.Flags().GetString("stdio-server-cmd")
	if err == nil && serverCmd != "" {
		// Fetch schema from server
		jsonRequest, err := buildJSONRPCRequest("tools/list", "", nil)
		if err == nil {
			response, err := executeServerCommand(serverCmd, jsonRequest)
			if err == nil {
				// Parse the schema response
				var schemaResp SchemaResponse
				if err := json.Unmarshal([]byte(response), &schemaResp); err == nil {
					// Add all the generated commands as subcommands of tools
					for _, tool := range schemaResp.Result.Tools {
						addCommandFromTool(toolsCmd, &tool, prettyPrint)
					}
				}
			}
		}
	}

	// Execute
	if err := rootCmd.Execute(); err != nil {
		_, _ = fmt.Fprintf(os.Stderr, "Error executing command: %v\n", err)
		os.Exit(1)
	}
}

// addCommandFromTool creates a cobra command from a tool schema
func addCommandFromTool(toolsCmd *cobra.Command, tool *Tool, prettyPrint bool) {
	// Create command from tool
	cmd := &cobra.Command{
		Use:   tool.Name,
		Short: tool.Description,
		Run: func(cmd *cobra.Command, _ []string) {
			// Build a map of arguments from flags
			arguments, err := buildArgumentsMap(cmd, tool)
			if err != nil {
				_, _ = fmt.Fprintf(os.Stderr, "failed to build arguments map: %v\n", err)
				return
			}

			jsonData, err := buildJSONRPCRequest("tools/call", tool.Name, arguments)
			if err != nil {
				_, _ = fmt.Fprintf(os.Stderr, "failed to build JSONRPC request: %v\n", err)
				return
			}

			// Execute the server command
			serverCmd, err := cmd.Flags().GetString("stdio-server-cmd")
			if err != nil {
				_, _ = fmt.Fprintf(os.Stderr, "failed to get stdio-server-cmd: %v\n", err)
				return
			}
			response, err := executeServerCommand(serverCmd, jsonData)
			if err != nil {
				_, _ = fmt.Fprintf(os.Stderr, "error executing server command: %v\n", err)
				return
			}
			if err := printResponse(response, prettyPrint); err != nil {
				_, _ = fmt.Fprintf(os.Stderr, "error printing response: %v\n", err)
				return
			}
		},
	}

	// Initialize viper for this command
	viperInit := func() {
		viper.Reset()
		viper.AutomaticEnv()
		viper.SetEnvPrefix(strings.ToUpper(tool.Name))
		viper.SetEnvKeyReplacer(strings.NewReplacer("-", "_"))
	}

	// We'll call the init function directly instead of with cobra.OnInitialize
	// to avoid conflicts between commands
	viperInit()

	// Add flags based on schema properties
	for name, prop := range tool.InputSchema.Properties {
		isRequired := slices.Contains(tool.InputSchema.Required, name)

		// Enhance description to indicate if parameter is optional
		description := prop.Description
		if !isRequired {
			description += " (optional)"
		}

		switch prop.Type {
		case "string":
			cmd.Flags().String(name, "", description)
			if len(prop.Enum) > 0 {
				// Add validation in PreRun for enum values
				cmd.PreRunE =
```

### Core Architecture Module: `internal/ghmcp/oauth.go`
```
package ghmcp

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"log/slog"
	"strings"

	"github.com/github/github-mcp-server/internal/oauth"
	"github.com/github/github-mcp-server/pkg/inventory"
	"github.com/modelcontextprotocol/go-sdk/mcp"
)

// sessionPrompter adapts an MCP server session to oauth.Prompter, presenting
// authorization prompts to the user via elicitation. Keeping the prompt on the
// MCP control channel (rather than a tool result) keeps the authorization URL
// and any session-bound state out of the model's context.
type sessionPrompter struct {
	session *mcp.ServerSession
}

// elicitationCaps returns the client's declared elicitation capabilities, or nil
// if the client did not advertise any.
func (p *sessionPrompter) elicitationCaps() *mcp.ElicitationCapabilities {
	params := p.session.InitializeParams()
	if params == nil || params.Capabilities == nil {
		return nil
	}
	return params.Capabilities.Elicitation
}

// CanPromptURL reports whether the client supports URL-mode elicitation.
func (p *sessionPrompter) CanPromptURL() bool {
	caps := p.elicitationCaps()
	return caps != nil && caps.URL != nil
}

// PromptURL presents the authorization URL via URL-mode elicitation and blocks
// until the user acknowledges, declines, or ctx is done.
func (p *sessionPrompter) PromptURL(ctx context.Context, prompt oauth.Prompt) error {
	res, err := p.session.Elicit(ctx, &mcp.ElicitParams{
		Mode:          "url",
		Message:       prompt.Message,
		URL:           prompt.URL,
		ElicitationID: rand.Text(),
	})
	if err != nil {
		// The client advertised URL elicitation but the request itself failed:
		// classify it as undeliverable (not a user decision) so the flow can fall
		// back to a channel that needs no client capability.
		return fmt.Errorf("%w: %w", oauth.ErrPromptUnavailable, err)
	}
	if res.Action != "accept" {
		return oauth.ErrPromptDeclined
	}
	return nil
}

// CanPromptForm reports whether the client supports form-mode elicitation. The
// SDK treats a client that advertises neither form nor URL capabilities as
// supporting forms, for backward compatibility, so we mirror that here.
func (p *sessionPrompter) CanPromptForm() bool {
	caps := p.elicitationCaps()
	if caps == nil {
		return false
	}
	return caps.Form != nil || caps.URL == nil
}

// PromptForm presents a textual acknowledgement (used to display a device code
// when URL elicitation is unavailable) and blocks until the user responds.
func (p *sessionPrompter) PromptForm(ctx context.Context, prompt oauth.Prompt) error {
	res, err := p.session.Elicit(ctx, &mcp.ElicitParams{
		Mode:    "form",
		Message: prompt.Message,
	})
	if err != nil {
		// As with PromptURL, a delivery failure is undeliverable rather than a
		// decline, so the flow can fall back instead of aborting.
		return fmt.Errorf("%w: %w", oauth.ErrPromptUnavailable, err)
	}
	if res.Action != "accept" {
		return oauth.ErrPromptDeclined
	}
	return nil
}

// oauthAuthenticator is the subset of *oauth.Manager that the middleware needs.
// Depending on the interface (rather than the concrete manager) lets the
// middleware be exercised with a deterministic fake, since driving the real
// manager to its branches would require standing up live GitHub flows.
type oauthAuthenticator interface {
	HasToken() bool
	Authenticate(ctx context.Context, prompter oauth.Prompter) (*oauth.Outcome, error)
	AwaitToken(ctx context.Context, flowID string) (*oauth.Outcome, error)
	Cancel(flowID string) bool
}

// oauthElicitIDPrefix identifies authorization responses in the multi-round-trip
// InputResponses map. The suffix is the manager's per-flow ID, which prevents a
// delayed response from an older prompt from affecting a newer flow.
const oauthElicitIDPrefix = "github_authorization:"

// serverMayInitiateElicitation reports whether the server is permitted to send
// elicitation requests to the client itself, which the spec allows only before
// protocol version 2026-07-28. A nil or un-negotiated session (only reached in
// unit tests; a real tools/call is always initialized) is treated as legacy.
func serverMayInitiateElicitation(ss *mcp.ServerSession) bool {
	if ss == nil {
		return true
	}
	params := ss.InitializeParams()
	return params == nil || params.ProtocolVersion < inventory.ProtocolVersionMultiRoundTrip
}

// createOAuthToolMiddleware returns tool-handler middleware that authorizes the
// session lazily, on the first tool call. It runs inside the SDK's
// Server.callTool handler so results returned here still receive SDK
// finalization, including resultType: "input_required" for multi-round-trip
// responses.
//
// When a token is already available the call proceeds untouched. Otherwise the
// authorization flow runs, presenting its prompt over whichever channel the
// negotiated protocol allows: on protocol versions before 2026-07-28 the server
// elicits directly; from 2026-07-28 on, where server-initiated requests are
// forbidden (SEP-2322), it uses multi-round-trip elicitation returned from the
// tool call. Either way the last-resort channel returns the instruction as a
// tool result and asks the user to retry.
func createOAuthToolMiddleware(mgr oauthAuthenticator, logger *slog.Logger) inventory.ToolHandlerMiddleware {
	return func(next mcp.ToolHandler) mcp.ToolHandler {
		return func(ctx context.Context, req *mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			if !serverMayInitiateElicitation(req.Session) {
				if flowID, response, ok := authorizationElicitResponse(req.Params.InputResponses); ok {
					return resumeMultiRoundTripAuthorization(ctx, mgr, next, req, flowID, response, logger)
				}
			}

			if mgr.HasToken() {
				return next(ctx, req)
			}
			if serverMayInitiateElicitation(req.Session) {
				return authorizeViaServerElicitation(ctx, mgr, next, req, logger)
			}
			return startMultiRoundTripAuthorization(ctx, mgr, next, req, logger)
		}
	}
}

// authorizeViaServerElicitation drives authorization on legacy protocol versions
// (before 2026-07-28), where the server may present the prompt itself via
// server-initiated elicitation. It blocks until the token arrives, then proceeds.
func authorizeViaServerElicitation(ctx context.Context, mgr oauthAuthenticator, next mcp.ToolHandler, req *mcp.CallToolRequest, logger *slog.Logger) (*mcp.CallToolResult, error) {
	outcome, err := mgr.Authenticate(ctx, &sessionPrompter{session: req.Session})
	if err != nil {
		return nil, fmt.Errorf("github authorization failed: %w", err)
	}
	if outcome != nil && outcome.UserAction != nil {
		logger.Info("surfacing github authorization instructions to user")
		return &mcp.CallToolResult{
			Content: []mcp.Content{&mcp.TextContent{Text: outcome.UserAction.Message}},
		}, nil
	}
	return next(ctx, req)
}

// authorizationElicitResponse finds the authorization response and extracts the
// flow ID encoded in its input-request key.
func authorizationElicitResponse(responses mcp.InputResponseMap) (string, *mcp.ElicitResult, bool) {
	for id, response := range responses {
		flowID, ok := strings.CutPrefix(id, oauthElicitIDPrefix)
		if !ok || flowID == "" {
			continue
		}
		result, _ := response.(*mcp.ElicitResult)
		return flowID, result, true
	}
	return "", nil, false
}

// startMultiRoundTripAuthorization starts authorization on protocol version
// 2026-07-28 or later. Server-initiated requests are forbidden there (SEP-2322),
// so the prompt is returned as an elicitation input request for the client to
// fulfill and retry.
func startMultiRoundTripAuthorization(ctx context.Context, mgr oauthAuthenticator, next mcp.ToolHandler, req *mcp.CallToolRequest, logger *slog.Logger) (*mcp.CallToolResult, error) {
	outcome, err := mgr.Authenticate(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("github authorization failed: %w", err)
	}
	if outcome == nil || outcome.UserAction == nil {
		// Already authorized (e.g. the server opened a browser and the flow
		// completed); proceed.
		return next(ctx, req)
	}

	elicit := authorizati
```

### Core Architecture Module: `internal/ghmcp/server.go`
```
package ghmcp

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/github/github-mcp-server/internal/oauth"
	"github.com/github/github-mcp-server/internal/requeststate"
	"github.com/github/github-mcp-server/pkg/errors"
	"github.com/github/github-mcp-server/pkg/github"
	"github.com/github/github-mcp-server/pkg/http/transport"
	"github.com/github/github-mcp-server/pkg/inventory"
	"github.com/github/github-mcp-server/pkg/lockdown"
	mcplog "github.com/github/github-mcp-server/pkg/log"
	"github.com/github/github-mcp-server/pkg/observability"
	"github.com/github/github-mcp-server/pkg/observability/metrics"
	"github.com/github/github-mcp-server/pkg/raw"
	"github.com/github/github-mcp-server/pkg/scopes"
	"github.com/github/github-mcp-server/pkg/translations"
	"github.com/github/github-mcp-server/pkg/utils"
	gogithub "github.com/google/go-github/v89/github"
	"github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/shurcooL/githubv4"
)

// githubClients holds all the GitHub API clients created for a server instance.
type githubClients struct {
	rest         *gogithub.Client
	restUATransp *transport.UserAgentTransport
	gql          *githubv4.Client
	gqlHTTP      *http.Client // retained for middleware to modify transport
	raw          *raw.Client
	repoAccess   *lockdown.RepoAccessCache
}

// createGitHubClients creates all the GitHub API clients needed by the server.
func createGitHubClients(cfg github.MCPServerConfig, apiHost utils.APIHostResolver) (*githubClients, error) {
	restURL, err := apiHost.BaseRESTURL(context.Background())
	if err != nil {
		return nil, fmt.Errorf("failed to get base REST URL: %w", err)
	}

	uploadURL, err := apiHost.UploadURL(context.Background())
	if err != nil {
		return nil, fmt.Errorf("failed to get upload URL: %w", err)
	}

	graphQLURL, err := apiHost.GraphqlURL(context.Background())
	if err != nil {
		return nil, fmt.Errorf("failed to get GraphQL URL: %w", err)
	}

	rawURL, err := apiHost.RawURL(context.Background())
	if err != nil {
		return nil, fmt.Errorf("failed to get Raw URL: %w", err)
	}

	// allowedHosts scopes the bearer token to the configured GitHub hosts, so a
	// response that redirects off them does not carry the token to the redirect
	// target. See transport.BearerAuthTransport.
	allowedHosts := []string{
		restURL.Host,
		uploadURL.Host,
		graphQLURL.Host,
		rawURL.Host,
	}

	// Construct REST client. BearerAuthTransport handles both static and
	// provider-backed tokens so every authentication mode uses the same host
	// restrictions.
	//
	// ETagTransport sits below the user-agent (and auth) layers so that, by the
	// time it runs, the Authorization header is set and can scope the
	// conditional-request cache per token. It adds ETag/If-None-Match handling
	// so unchanged resources are revalidated with a 304 instead of being
	// re-downloaded in full.
	//
	// The conditional-request cache is enabled only for the REST API client on
	// this long-lived local (stdio) server. The raw-content client below uses a
	// separate transport without it, so large file bodies are never buffered
	// into the cache. The hosted, horizontally-scaled server builds a fresh REST
	// client per request (see pkg/github RequestDeps) and does not use this path.
	restUATransport := &transport.UserAgentTransport{
		Transport: &transport.ETagTransport{Transport: http.DefaultTransport},
		Agent:     fmt.Sprintf("github-mcp-server/%s", cfg.Version),
	}
	restClient, err := newRESTClient(cfg, restUATransport, restURL.String(), uploadURL.String(), allowedHosts)
	if err != nil {
		return nil, fmt.Errorf("failed to create REST client: %w", err)
	}

	// Construct GraphQL client
	// We use NewEnterpriseClient unconditionally since we already parsed the API host
	gqlHTTPClient := &http.Client{
		Transport: &transport.BearerAuthTransport{
			Transport: &transport.GraphQLFeaturesTransport{
				Transport: http.DefaultTransport,
			},
			Token:         cfg.Token,
			TokenProvider: cfg.TokenProvider,
			AllowedHosts:  allowedHosts,
		},
	}

	gqlClient := githubv4.NewEnterpriseClient(graphQLURL.String(), gqlHTTPClient)

	// Create raw content client. It shares the REST client's authentication but
	// uses a transport without the conditional-request cache: raw file bodies can
	// be large and are streamed rather than retained in memory.
	rawUATransport := &transport.UserAgentTransport{
		Transport: http.DefaultTransport,
		Agent:     fmt.Sprintf("github-mcp-server/%s", cfg.Version),
	}
	rawRESTClient, err := newRESTClient(cfg, rawUATransport, restURL.String(), uploadURL.String(), allowedHosts)
	if err != nil {
		return nil, fmt.Errorf("failed to create raw REST client: %w", err)
	}
	rawClient, err := raw.NewClient(rawRESTClient, rawURL)
	if err != nil {
		return nil, fmt.Errorf("failed to create raw client: %w", err)
	}

	// Set up repo access cache for lockdown mode
	var repoAccessCache *lockdown.RepoAccessCache
	if cfg.LockdownMode {
		opts := []lockdown.RepoAccessOption{
			lockdown.WithLogger(cfg.Logger.With("component", "lockdown")),
		}
		if cfg.RepoAccessTTL != nil {
			opts = append(opts, lockdown.WithTTL(*cfg.RepoAccessTTL))
		}
		repoAccessCache = lockdown.NewRepoAccessCache(gqlClient, restClient, opts...)
	}

	return &githubClients{
		rest:         restClient,
		restUATransp: restUATransport,
		gql:          gqlClient,
		gqlHTTP:      gqlHTTPClient,
		raw:          rawClient,
		repoAccess:   repoAccessCache,
	}, nil
}

// newRESTClient builds a go-github REST client that sends requests through the
// supplied user-agent transport. Authentication uses BearerAuthTransport for
// both static and provider-backed tokens, and allowedHosts scopes the token to
// the configured GitHub hosts so it is never leaked to off-host redirects.
func newRESTClient(cfg github.MCPServerConfig, uaTransport *transport.UserAgentTransport, restURL, uploadURL string, allowedHosts []string) (*gogithub.Client, error) {
	return gogithub.NewClient(
		gogithub.WithHTTPClient(&http.Client{Transport: &transport.BearerAuthTransport{
			Transport:     uaTransport,
			Token:         cfg.Token,
			TokenProvider: cfg.TokenProvider,
			AllowedHosts:  allowedHosts,
		}}),
		gogithub.WithEnterpriseURLs(restURL, uploadURL),
	)
}

func NewStdioMCPServer(ctx context.Context, cfg github.MCPServerConfig) (*mcp.Server, error) {
	apiHost, err := utils.NewAPIHost(cfg.Host)
	if err != nil {
		return nil, fmt.Errorf("failed to parse API host: %w", err)
	}

	hostType, err := utils.ParseHostType(cfg.Host)
	if err != nil {
		return nil, fmt.Errorf("failed to classify API host: %w", err)
	}

	clients, err := createGitHubClients(cfg, apiHost)
	if err != nil {
		return nil, fmt.Errorf("failed to create GitHub clients: %w", err)
	}

	// Create feature checker — resolves explicit features + insiders expansion
	featureChecker := createFeatureChecker(cfg.EnabledFeatures, cfg.InsidersMode)

	// Create dependencies for tool handlers
	obs, err := observability.NewExporters(cfg.Logger, metrics.NewNoopMetrics())
	if err != nil {
		return nil, fmt.Errorf("failed to create observability exporters: %w", err)
	}
	deps := github.NewBaseDeps(
		clients.rest,
		clients.gql,
		clients.raw,
		clients.repoAccess,
		cfg.Translator,
		github.FeatureFlags{
			LockdownMode: cfg.LockdownMode,
		},
		cfg.ContentWindowSize,
		featureChecker,
		obs,
	)
	deps.StateSealer, err = requeststate.NewRandom()
	if err != nil {
		return nil, fmt.Errorf("failed to configure request-state protection: %w", err)
	}
	// Build and register the tool/resource/prompt inventory
	inventoryBuilder := github.NewInventory(cfg.Translator, github.WithHost(hostType)).
		WithDeprecatedAliases(github.DeprecatedToolAliases).
		WithReadOnly(cfg.ReadOnly).
		WithToolsets(github.ResolvedEnabledToolsets(cfg.EnabledToolsets, cfg.EnabledTools)).
		WithTools(github.CleanTools(cfg.EnabledTools)).
		WithExcludeTools(cfg.ExcludeTools).
		WithServerInstructions().
		WithFeatureChecker(featureCh
```

### Core Architecture Module: `internal/githubapp/githubapp.go`
```
// Package githubapp provides GitHub App installation access tokens.
package githubapp

import (
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"golang.org/x/oauth2"
)

const (
	jwtLifetime   = 9 * time.Minute
	clockSkew     = time.Minute
	refreshBuffer = 5 * time.Minute
	httpTimeout   = 30 * time.Second
)

// Config describes a GitHub App installation used for server-to-server auth.
type Config struct {
	// AppID is used as the JWT issuer. GitHub accepts an app ID or client ID.
	AppID string

	// InstallationID identifies the installation whose access token is minted.
	InstallationID string

	// PrivateKeyPEM is the RSA key used to sign app JWTs.
	PrivateKeyPEM []byte

	// BaseRESTURL is the REST API base, e.g. https://api.github.com/ for
	// github.com or https://HOST/api/v3/ for GitHub Enterprise Server.
	BaseRESTURL string
}

func (c Config) validate() error {
	switch {
	case c.AppID == "":
		return errors.New("GitHub App ID or client ID is required (GITHUB_APP_ID)")
	case c.InstallationID == "":
		return errors.New("GitHub App installation ID is required (GITHUB_APP_INSTALLATION_ID)")
	case len(c.PrivateKeyPEM) == 0:
		return errors.New("GitHub App private key is required (GITHUB_APP_PRIVATE_KEY_PATH or GITHUB_APP_PRIVATE_KEY)")
	case c.BaseRESTURL == "":
		return errors.New("GitHub App REST base URL is required")
	}
	return nil
}

func parsePrivateKey(pemBytes []byte) (*rsa.PrivateKey, error) {
	block, _ := pem.Decode(pemBytes)
	if block == nil {
		return nil, errors.New("no PEM block found in private key")
	}
	if key, err := x509.ParsePKCS1PrivateKey(block.Bytes); err == nil {
		return key, nil
	}
	parsed, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("parsing private key (want PKCS#1 or PKCS#8 RSA): %w", err)
	}
	key, ok := parsed.(*rsa.PrivateKey)
	if !ok {
		return nil, fmt.Errorf("private key is %T, want an RSA key", parsed)
	}
	return key, nil
}

func mintJWT(appID string, privateKey *rsa.PrivateKey, now time.Time) (string, error) {
	header := map[string]string{"alg": "RS256", "typ": "JWT"}
	claims := map[string]any{
		"iat": now.Add(-clockSkew).Unix(),
		"exp": now.Add(jwtLifetime).Unix(),
		"iss": appID,
	}

	headerJSON, err := json.Marshal(header)
	if err != nil {
		return "", fmt.Errorf("encoding JWT header: %w", err)
	}
	claimsJSON, err := json.Marshal(claims)
	if err != nil {
		return "", fmt.Errorf("encoding JWT claims: %w", err)
	}

	signingInput := base64.RawURLEncoding.EncodeToString(headerJSON) + "." +
		base64.RawURLEncoding.EncodeToString(claimsJSON)

	digest := sha256.Sum256([]byte(signingInput))
	signature, err := rsa.SignPKCS1v15(rand.Reader, privateKey, crypto.SHA256, digest[:])
	if err != nil {
		return "", fmt.Errorf("signing JWT: %w", err)
	}

	return signingInput + "." + base64.RawURLEncoding.EncodeToString(signature), nil
}

type installationTokenSource struct {
	cfg        Config
	privateKey *rsa.PrivateKey
	httpClient *http.Client
}

func newInstallationTokenSource(cfg Config, privateKey *rsa.PrivateKey, httpClient *http.Client) *installationTokenSource {
	if httpClient == nil {
		httpClient = &http.Client{Timeout: httpTimeout}
	}
	return &installationTokenSource{cfg: cfg, privateKey: privateKey, httpClient: httpClient}
}

func (s *installationTokenSource) Token() (*oauth2.Token, error) {
	jwt, err := mintJWT(s.cfg.AppID, s.privateKey, time.Now())
	if err != nil {
		return nil, err
	}

	endpoint, err := url.JoinPath(s.cfg.BaseRESTURL, "app", "installations", s.cfg.InstallationID, "access_tokens")
	if err != nil {
		return nil, fmt.Errorf("building installation token URL: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), httpTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("creating installation token request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+jwt)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("requesting installation token: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusCreated {
		snippet, readErr := io.ReadAll(io.LimitReader(resp.Body, 512))
		if readErr != nil {
			return nil, fmt.Errorf("installation token request failed: %s (reading response: %w)", resp.Status, readErr)
		}
		return nil, fmt.Errorf("installation token request failed: %s: %s", resp.Status, strings.TrimSpace(string(snippet)))
	}

	var body struct {
		Token     string    `json:"token"`
		ExpiresAt time.Time `json:"expires_at"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return nil, fmt.Errorf("decoding installation token response: %w", err)
	}
	if body.Token == "" {
		return nil, errors.New("installation token response did not contain a token")
	}
	if body.ExpiresAt.IsZero() {
		return nil, errors.New("installation token response did not contain an expiry")
	}
	return &oauth2.Token{
		AccessToken: body.Token,
		TokenType:   "token",
		Expiry:      body.ExpiresAt.Add(-refreshBuffer),
	}, nil
}

// Provider caches and refreshes GitHub App installation access tokens.
type Provider struct {
	source oauth2.TokenSource
	logger *slog.Logger

	mu        sync.Mutex
	errLogged bool
}

func NewProvider(cfg Config, logger *slog.Logger) (*Provider, error) {
	if err := cfg.validate(); err != nil {
		return nil, err
	}
	privateKey, err := parsePrivateKey(cfg.PrivateKeyPEM)
	if err != nil {
		return nil, fmt.Errorf("invalid GitHub App private key: %w", err)
	}
	if logger == nil {
		logger = slog.Default()
	}
	source := oauth2.ReuseTokenSource(nil, newInstallationTokenSource(cfg, privateKey, nil))
	return &Provider{source: source, logger: logger}, nil
}

// AccessToken returns a cached token or refreshes it before expiry.
func (p *Provider) AccessToken() string {
	tok, err := p.source.Token()
	if err != nil {
		p.mu.Lock()
		if !p.errLogged {
			p.errLogged = true
			p.logger.Error("failed to obtain GitHub App installation token", "error", err)
		}
		p.mu.Unlock()
		return ""
	}
	p.mu.Lock()
	p.errLogged = false
	p.mu.Unlock()
	return tok.AccessToken
}

```

### Core Architecture Module: `internal/githubv4mock/githubv4mock.go`
```
// githubv4mock package provides a mock GraphQL server used for testing queries produced via
// shurcooL/githubv4 or shurcooL/graphql modules.
package githubv4mock

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

type Matcher struct {
	Request   string
	Variables map[string]any

	Response GQLResponse
}

// NewQueryMatcher constructs a new matcher for the provided query and variables.
// If the provided query is a string, it will be used-as-is, otherwise it will be
// converted to a string using the constructQuery function taken from shurcooL/graphql.
func NewQueryMatcher(query any, variables map[string]any, response GQLResponse) Matcher {
	queryString, ok := query.(string)
	if !ok {
		queryString = constructQuery(query, variables)
	}

	return Matcher{
		Request:   queryString,
		Variables: variables,
		Response:  response,
	}
}

// NewMutationMatcher constructs a new matcher for the provided mutation and variables.
// If the provided mutation is a string, it will be used-as-is, otherwise it will be
// converted to a string using the constructMutation function taken from shurcooL/graphql.
//
// The input parameter is a special form of variable, matching the usage in shurcooL/githubv4. It will be added
// to the query as a variable called `input`. Furthermore, it will be converted to a map[string]any
// to be used for later equality comparison, as when the http handler is called, the request body will no longer
// contain the input struct type information.
func NewMutationMatcher(mutation any, input any, variables map[string]any, response GQLResponse) Matcher {
	mutationString, ok := mutation.(string)
	if !ok {
		// Matching shurcooL/githubv4 mutation behaviour found in https://github.com/shurcooL/githubv4/blob/48295856cce734663ddbd790ff54800f784f3193/githubv4.go#L45-L56
		if variables == nil {
			variables = map[string]any{"input": input}
		} else {
			variables["input"] = input
		}

		mutationString = constructMutation(mutation, variables)
		m, _ := githubv4InputStructToMap(input)
		variables["input"] = m
	}

	return Matcher{
		Request:   mutationString,
		Variables: variables,
		Response:  response,
	}
}

type GQLResponse struct {
	Data   map[string]any `json:"data"`
	Errors []struct {
		Message string `json:"message"`
	} `json:"errors,omitempty"`
}

// DataResponse is the happy path response constructor for a mocked GraphQL request.
func DataResponse(data map[string]any) GQLResponse {
	return GQLResponse{
		Data: data,
	}
}

// ErrorResponse is the unhappy path response constructor for a mocked GraphQL request.\
// Note that for the moment it is only possible to return a single error message.
func ErrorResponse(errorMsg string) GQLResponse {
	return GQLResponse{
		Errors: []struct {
			Message string `json:"message"`
		}{
			{
				Message: errorMsg,
			},
		},
	}
}

// githubv4InputStructToMap converts a struct to a map[string]any, it uses JSON marshalling rather than reflection
// to do so, because the json struct tags are used in the real implementation to produce the variable key names,
// and we need to ensure that when variable matching occurs in the http handler, the keys correctly match.
func githubv4InputStructToMap(s any) (map[string]any, error) {
	jsonBytes, err := json.Marshal(s)
	if err != nil {
		return nil, err
	}

	var result map[string]any
	err = json.Unmarshal(jsonBytes, &result)
	return result, err
}

// NewMockedHTTPClient creates a new HTTP client that registers a handler for /graphql POST requests.
// For each request, an attempt will be be made to match the request body against the provided matchers.
// If a match is found, the corresponding response will be returned with StatusOK.
//
// Note that query and variable matching can be slightly fickle. The client expects an EXACT match on the query,
// which in most cases will have been constructed from a type with graphql tags. The query construction code in
// shurcooL/githubv4 uses the field types to derive the query string, thus a go string is not the same as a graphql.ID,
// even though `type ID string`. It is therefore expected that matching variables have the right type for example:
//
//	githubv4mock.NewQueryMatcher(
//	    struct {
//	        Repository struct {
//	            PullRequest struct {
//	                 ID githubv4.ID
//	            } `graphql:"pullRequest(number: $prNum)"`
//	        } `graphql:"repository(owner: $owner, name: $repo)"`
//	    }{},
//	    map[string]any{
//	        "owner": githubv4.String("owner"),
//	        "repo":  githubv4.String("repo"),
//	        "prNum": githubv4.Int(42),
//	    },
//	    githubv4mock.DataResponse(
//	        map[string]any{
//	            "repository": map[string]any{
//	                "pullRequest": map[string]any{
//	                     "id": "PR_kwDODKw3uc6WYN1T",
//	                 },
//	            },
//	        },
//	    ),
//	)
//
// To aid in variable equality checks, values are considered equal if they approximate to the same type. This is
// required because when the http handler is called, the request body no longer has the type information. This manifests
// particularly when using the githubv4.Input types which have type deffed fields in their structs. For example:
//
//	type CloseIssueInput struct {
//	  IssueID ID `json:"issueId"`
//	  StateReason *IssueClosedStateReason `json:"stateReason,omitempty"`
//	}
//
// This client does not currently provide a mechanism for out-of-band errors e.g. returning a 500,
// and errors are constrained to GQL errors returned in the response body with a 200 status code.
func NewMockedHTTPClient(ms ...Matcher) *http.Client {
	matchers := make(map[string]Matcher, len(ms))
	for _, m := range ms {
		matchers[m.Request] = m
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/graphql", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		gqlRequest, err := parseBody(r.Body)
		if err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}
		defer func() { _ = r.Body.Close() }()

		matcher, ok := matchers[gqlRequest.Query]
		if !ok {
			http.Error(w, fmt.Sprintf("no matcher found for query %s", gqlRequest.Query), http.StatusNotFound)
			return
		}

		if len(gqlRequest.Variables) > 0 {
			if len(gqlRequest.Variables) != len(matcher.Variables) {
				http.Error(w, "variables do not have the same length", http.StatusBadRequest)
				return
			}

			for k, v := range matcher.Variables {
				if !objectsAreEqualValues(v, gqlRequest.Variables[k]) {
					http.Error(w, "variable does not match", http.StatusBadRequest)
					return
				}
			}
		}

		responseBody, err := json.Marshal(matcher.Response)
		if err != nil {
			http.Error(w, "error marshalling response", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(responseBody)
	})

	return &http.Client{Transport: &localRoundTripper{
		handler: mux,
	}}
}

type gqlRequest struct {
	Query     string         `json:"query"`
	Variables map[string]any `json:"variables,omitempty"`
}

func parseBody(r io.Reader) (gqlRequest, error) {
	var req gqlRequest
	err := json.NewDecoder(r).Decode(&req)
	return req, err
}

func Ptr[T any](v T) *T { return &v }

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3214** (2026-09-03): **Title sanitization returns HTML entities in tool output**
  *Symptoms*: ### Describe the bug  GitHub MCP title fields can return HTML entity text instead of the original visible characters. For example, an issue titled `[bug] can't add a connection to toolkits in desktop app` was returned as `[bug] can&#39;t add a connection to toolkits in desktop app`.  This affects short metadata handled by the strict title sanitizer and is separate from Markdown body fidelity work in #3177.  ### Affected version  Not provided; reported against the current GitHub MCP service.  ### Steps to reproduce the behavior  1. Create or read an issue whose title contains an apostrophe, such as `[bug] can't add a connection to toolkits in desktop app`. 2. Retrieve the issue through the GitHub MCP server. 3. Observe that the returned title contains `&#39;` instead of `'`.  ### Expected vs actual behavior  Expected: the returned title preserves visible text as `[bug] can't add a connection to toolkits in desktop app` while remaining safe for tool consumers.  Actual: the returned title contains the encoded entity `[bug] can&#39;t add a connection to toolkits in desktop app`.  ### Logs  N/A. Originally reported in https://github.com/github/github-mcp-server/pull/3177#discussion_r3914431182.

- **Issue #3190** (2026-09-01): **get_review_comments (pull_request_read) silently drops start_line for multi-line PR review comments**
  *Symptoms*: ### Describe the bug  `get_pull_request` (method `get_review_comments`, or the equivalent underlying `pulls/comments` handling) drops the `start_line`/`original_start_line` fields for multi-line ("range") review comments. GitHub's REST API returns both fields when a review comment spans more than one line, but the MCP tool's response only exposes `line` — the end of the range — with no indication the comment covers a range at all. A caller has no way to tell "this comment is about line 69" from "this comment is about lines 62-69"; both look identical in the tool's output.  This isn't just cosmetic — it produces silently wrong interpretations of review feedback. A caller that trusts `line` as "the line this comment is about" will read a comment addressed to an 8-line block as if it were addressed to only its last line, then act on that narrower (wrong) scope: applying a fix to one line when the reviewer meant the whole construct, or misjudging which code the feedback even refers to when the last line alone doesn't contain enough context to make sense of the comment. Because the field is simply absent rather than null or flagged, there's no way for a caller to detect that it's missing information and fall back to something safer — the response looks identical whether the comment was single-line or a wide range, so the failure mode is invisible until someone happens to cross-check against the raw REST API.  ### Affected version  ``` GitHub MCP Server Version: v1.5.0 Commit: 8cd0
  **Post-Mortem & Fix Analysis**:
  > > ### Describe the bug >  > `get_pull_request` (method `get_review_comments`, or the equivalent underlying `pulls/comments` handling) drops the `start_line`/`original_start_line` fields for multi-line ("range") review comments. GitHub's REST API returns both fields when a review comment spans more than one line, but the MCP tool's response only exposes `line` — the end of the range — with no indication the comment covers a range at all. A caller has no way to tell "this comment is about line 69" from "this comment is about lines 62-69"; both look identical in the tool's output. >  > This isn't just cosmetic — it produces silently wrong interpretations of review feedback. A caller that trusts `line` as "the line this comment is about" will read a comment addressed to an 8-line block as if it were addressed to only its last line, then act on that narrower (wrong) scope: applying a fix to one line when the reviewer meant the whole construct, or misjudging which code the feedback even refe

- **Issue #3180** (2026-08-29): **Erro `spawn EINVAL` ao tentar usar a tool `execute_test_plan`**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > Sorry, I opened this in the wrong repository. Closing!
  > > No description provided.  

- **Issue #3170** (2026-09-08): **VS Code remote GitHub MCP server requests delete_repo scope unconditionally on OAuth login, with no way to grant a subset**
  *Symptoms*: ### Describe the bug  When authenticating to the remote GitHub MCP server (`https://api.githubcopilot.com/mcp/`) through VS Code's built-in GitHub OAuth login flow, the consent screen requests the "Delete repositories" permission (`delete_repo` scope — ability to delete any adminable repository) as part of a single, all-or-nothing authorization request. There is no way to complete login while declining just that scope; the only options are to accept the full requested scope set or cancel authentication entirely (leaving the server unusable, failing with a 401).  I suspect this is a (hopefully unintentional) result of #3076. Based on the comments in that PR, it seems that in at least some circumstances it is not intended that the MCP tool require `delete_repo` scope (as long as the MCP tool to delete a repository isn't used, of course).  ### Affected version  Connected via the remote hosted server, not local Docker, so I can't run the local `--version` command. From my VS Code `mcp.json`, the server entry reports: ``` "url": "https://api.githubcopilot.com/mcp/", "version": "0.31.0" ```  VS Code info: ``` Version: 1.135.0 (user setup) Commit: 08d4889f9ec4a1685d257b9b95de036c8e1ce1e5 Date: 2026-08-25T14:26:52Z Electron: 42.8.1 ElectronBuildId: 14906494 Chromium: 148.0.7778.280 Node.js: 24.18.1 V8: 14.8.178.38-electron.0 @github/copilot: 1.0.81-0 @github/copilot-sdk: 1.0.11 OS: Windows_NT x64 10.0.26200 ```  ### Steps to reproduce the behavior  1. In VS Code, configure the market
  **Post-Mortem & Fix Analysis**:
  > Rough one — going from “not the full delete-anything scope” to “accept delete_repo or you can’t log in at all” with no way to scope it down, and a 401 if you decline, is exactly the kind of change that deserves a warning, not a broken login as the discovery mechanism.  We build [Apitella](https://apitella.com/) — mostly focused on catching an MCP server’s tools/permissions changing out from under you without notice. This is the OAuth-consent flavor of that rather than our usual case (tool-level safety hints), but it’s the same root issue: a destructive capability got bundled in with zero visibility until something broke. No specific ask, just flagging it as the same category of problem we spend most of our time on.
  > Apologies, you are correct this is a bug. The default scopes should be only default true ones here:  https://github.com/github/github-mcp-server/blob/main/pkg/scopes/scopes.go#L84-L101  But our metadata has a bug and we will address.  https://api.githubcopilot.com/.well-known/oauth-protected-resource/mcp
  > OK, this is now fixed and deployed to production also.

- **Issue #3160** (2026-09-01): **github_issue_write silently drops labels when caller lacks AddLabelsToLabelable permission**
  *Symptoms*: ### Describe the bug  `github_issue_write` with `method: "create"` (and `method: "update"`) silently drops the `labels` argument when the calling user lacks `AddLabelsToLabelable` permission on the target repository. The API returns success (issue created/updated, no error), but no label is applied. The failure is only detectable by reading back the issue's labels.  Observed against an upstream repo where the caller is not a maintainer, using a label that verifiably exists in the repository (`enhancement`, applied via the repo's issue template):  1. `github_issue_write` create with `labels: ["enhancement"]` → returns success + issue URL. 2. `github_issue_read` with `get_labels` on the created issue → `[]` (empty). 3. Retried via `github_issue_write` update with `labels: ["enhancement"]` → again success, still empty. 4. The label exists in the repo: `GitHub_get_label` returns the label (color `a2eeef`, description "New feature or request"). 5. The equivalent CLI operation fails loudly: `gh issue edit <n> --add-label enhancement` exits 1 with a GraphQL permission error (see Logs).  So the MCP tool succeeds silently where the CLI surfaces the permission boundary — the `labels` field is dropped without any error or warning.  ### Affected version  Could not capture the server version: the docker daemon is not running in this environment (`docker run -i --rm ghcr.io/github/github-mcp-server ./github-mcp-server --version` failed with `failed to connect to the docker API at unix:///v
  **Post-Mortem & Fix Analysis**:
  > Verified against main (`822c8776`) — the report is accurate, and the reason for the silence is structural:  **Root cause walk**  1. Labels are only ever sent inside the create/PATCH request body: `CreateIssue` builds `github.CreateIssueRequest{Labels: ...}` (pkg/github/issues.go ~L2672), `UpdateIssue` sets `issueRequest.Labels` when `LabelsProvided` (~L2758). There is no separate add-labels call anywhere in the codebase (no `AddLabelsToIssue` usage). 2. Both paths return a `MinimalResponse{ID, URL}` built from the *returned* issue and discard everything else (~L2702, ~L2931). The REST response actually echoes the post-write label set, but it is thrown away. 3. So when dotcom silently ignores the labels array for callers lacking `AddLabelsToLabelable`, the tool has no error to surface **and** discards the one signal that would reveal the drop.  **Reproduced at package level** (go1.26.7, worktree at `822c8776`): mocked endpoint answering `201 Created` with an empty `"labels":[]` 

- **Issue #3133** (2026-08-21): **My mobile every id is been hacked delete the sources and file**
  *Symptoms*: ### Describe the bug  A clear and concise description of what the bug is.  ### Affected version  Please run ` docker run -i --rm ghcr.io/github/github-mcp-server ./github-mcp-server --version` and paste the output below  ### Steps to reproduce the behavior  1. Type this '...' 2. View the output '....' 3. See error  ### Expected vs actual behavior  A clear and concise description of what you expected to happen and what actually happened.  ### Logs  Paste any available logs. Redact if needed. 

- **Issue #3132** (2026-08-21): **Gta5
**
  *Symptoms*: ### Describe the bug  A clear and concise description of what the bug is.  ### Affected version  Please run ` docker run -i --rm ghcr.io/github/github-mcp-server ./github-mcp-server --version` and paste the output below  ### Steps to reproduce the behavior  1. Type this '...' 2. View the output '....' 3. See error  ### Expected vs actual behavior  A clear and concise description of what you expected to happen and what actually happened.  ### Logs  Paste any available logs. Redact if needed. 

- **Issue #3124** (2026-08-20): **clear all bugs**
  *Symptoms*: ### Describe the bug  A clear and concise description of what the bug is.  ### Affected version  Please run ` docker run -i --rm ghcr.io/github/github-mcp-server ./github-mcp-server --version` and paste the output below  ### Steps to reproduce the behavior  1. Type this '...' 2. View the output '....' 3. See error  ### Expected vs actual behavior  A clear and concise description of what you expected to happen and what actually happened.  ### Logs  Paste any available logs. Redact if needed. 

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

### Incident Patch 1: `7d13a7ad` (2026-09-08)
**Commit Message**: fix(oauth): advertise only default scopes in protected resource metadata (#3251)

* fix(oauth): advertise only default scopes in metadata

Keep the full OAuth scope catalog available for per-tool step-up challenges, but limit protected resource discovery to the lower-risk default grant.

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>

* Update expectedScopes in oauth_test.go

Co-authored-by: Copilot Autofix powered by AI <175728472+Copilot@users.noreply.github.com>

---------

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>
Co-authored-by: Copilot Autofix powered by AI <175728472+Copilot@users.noreply.github.com>

**File**: `docs/streamable-http.md` (modified, +11/-1)
```diff
@@ -72,13 +72,23 @@ The OAuth protected resource metadata's `resource` attribute will be populated w
   ],
   "scopes_supported": [
     "repo",
-    ...
+    "read:org",
+    "read:user",
+    "user:email",
+    "read:packages",
+    "write:packages",
+    "read:project",
+    "project",
+    "gist",
+    "notifications"
   ],
   ...
 }
 ```
 
 This allows OAuth clients to discover authentication requirements and endpoint information automatically.
+Scopes excluded from this default set, such as `delete_repo`, are requested only
+through a per-tool OAuth authorization challenge when needed.
 
 The HTTP server is the OAuth protected resource, not the authorization server. It
 therefore serves `/.well-known/oauth-protected-resource` but does not serve
```

**File**: `pkg/http/oauth/oauth.go` (modified, +5/-6)
```diff
@@ -20,13 +20,12 @@ const (
 	OAuthProtectedResourcePrefix = "/.well-known/oauth-protected-resource"
 )
 
-// SupportedScopes lists every OAuth scope that an MCP tool may require. HTTP
-// protected-resource metadata advertises this full set so clients can step up
-// authorization for tools excluded from the default grant.
+// SupportedScopes lists every OAuth scope that an MCP tool may require.
 var SupportedScopes = scopes.SupportedOAuthScopes()
 
-// DefaultScopes are requested by stdio OAuth unless the operator explicitly
-// supplies --oauth-scopes. High-risk scopes such as delete_repo require opt-in.
+// DefaultScopes are advertised in protected-resource metadata and requested by
+// stdio OAuth unless the operator explicitly supplies --oauth-scopes. Other
+// scopes require opt-in through a per-tool authorization challenge.
 var DefaultScopes = scopes.DefaultOAuthScopes()
 
 // Config holds the OAuth configuration for the MCP server.
@@ -128,7 +127,7 @@ func (h *AuthHandler) metadataHandler() http.Handler {
 			Resource:               resourceURL,
 			AuthorizationServers:   []string{authorizationServerURL},
 			ResourceName:           "GitHub MCP Server",
-			ScopesSupported:        SupportedScopes,
+			ScopesSupported:        DefaultScopes,
 			BearerMethodsSupported: []string{"header"},
 		}
 
```

**File**: `pkg/http/oauth/oauth_test.go` (modified, +29/-3)
```diff
@@ -436,7 +436,18 @@ func TestHandleProtectedResource(t *testing.T) {
 			host:               "api.example.com",
 			method:             http.MethodGet,
 			expectedStatusCode: http.StatusOK,
-			expectedScopes:     SupportedScopes,
+expectedScopes: []string{
+				"repo",
+				"read:org",
+				"read:user",
+				"user:email",
+				"read:packages",
+				"write:packages",
+				"read:project",
+				"project",
+				"gist",
+				"notifications",
+			},
 			validateResponse: func(t *testing.T, body map[string]any) {
 				t.Helper()
 				assert.Equal(t, "GitHub MCP Server", body["resource_name"])
@@ -573,7 +584,12 @@ func TestHandleProtectedResource(t *testing.T) {
 				if tc.expectedScopes != nil {
 					scopes, ok := body["scopes_supported"].([]any)
 					require.True(t, ok)
-					assert.Len(t, scopes, len(tc.expectedScopes))
+					actualScopes := make([]string, len(scopes))
+					for i, scope := range scopes {
+						actualScopes[i], ok = scope.(string)
+						require.True(t, ok)
+					}
+					assert.Equal(t, tc.expectedScopes, actualScopes)
 				}
 			}
 		})
@@ -671,10 +687,20 @@ func TestSupportedScopes(t *testing.T) {
 	assert.Equal(t, expectedScopes, SupportedScopes)
 }
 
-func TestDefaultScopesRequiresExplicitDeleteRepoOptIn(t *testing.T) {
+func TestDefaultScopesRequireExplicitOptIn(t *testing.T) {
 	assert.Subset(t, SupportedScopes, DefaultScopes)
 	assert.Contains(t, SupportedScopes, "delete_repo")
 	assert.NotContains(t, DefaultScopes, "delete_repo")
+	assert.Contains(t, SupportedScopes, "workflow")
+	assert.NotContains(t, DefaultScopes, "workflow")
+	assert.Contains(t, SupportedScopes, "codespace")
+	assert.NotContains(t, DefaultScopes, "codespace")
+	assert.Contains(t, SupportedScopes, "admin:org")
+	assert.NotContains(t, DefaultScopes, "admin:org")
+	assert.Contains(t, SupportedScopes, "read:enterprise")
+	assert.NotContains(t, DefaultScopes, "read:enterprise")
+	assert.Contains(t, SupportedScopes, "admin:enterprise")
+	assert.NotContains(t, DefaultScopes, "admin:enterprise")
 	assert.Contains(t, DefaultScopes, "repo")
 }
 
```

---

### Incident Patch 2: `9205304f` (2026-09-03)
**Commit Message**: fix: restore sanitizer content boundaries (#3219)

Preserve Markdown and HTML in body and commit-message fields while stripping invisible controls. Apply plain-text sanitization consistently to raw release and sub-issue titles and restore blame headline handling.

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>

**File**: `pkg/github/issues.go` (modified, +1/-1)
```diff
@@ -2013,7 +2013,7 @@ func sanitizeSubIssueTitleAndBody(issue *github.SubIssue) {
 		return
 	}
 	if issue.Title != nil {
-		issue.Title = github.Ptr(sanitize.Sanitize(*issue.Title))
+		issue.Title = github.Ptr(sanitize.PlainText(*issue.Title))
 	}
 	if issue.Body != nil {
 		issue.Body = github.Ptr(sanitize.Content(*issue.Body))
```

**File**: `pkg/github/issues_test.go` (modified, +16/-16)
```diff
@@ -5774,8 +5774,8 @@ func Test_AddSubIssue(t *testing.T) {
 	// Setup mock issue for success case (matches GitHub API response format)
 	mockIssue := &github.Issue{
 		Number:  github.Ptr(42),
-		Title:   github.Ptr("<int>\u200B"),
-		Body:    github.Ptr("This is **Markdown**\u200B"),
+		Title:   github.Ptr("<script>alert(1)</script>can't \"quote\" AT&T\u200B"),
+		Body:    github.Ptr("<script>alert(1)</script>This is **Markdown**\u200B"),
 		State:   github.Ptr("open"),
 		HTMLURL: github.Ptr("https://github.com/owner/repo/issues/42"),
 		User: &github.User{
@@ -5970,8 +5970,8 @@ func Test_AddSubIssue(t *testing.T) {
 			err = json.Unmarshal([]byte(textContent.Text), &returnedIssue)
 			require.NoError(t, err)
 			assert.Equal(t, *tc.expectedIssue.Number, *returnedIssue.Number)
-			assert.Empty(t, *returnedIssue.Title)
-			assert.Equal(t, "This is **Markdown**", *returnedIssue.Body)
+			assert.Equal(t, "can't \"quote\" AT&T", *returnedIssue.Title)
+			assert.Equal(t, "<script>alert(1)</script>This is **Markdown**", *returnedIssue.Body)
 			assert.Equal(t, *tc.expectedIssue.State, *returnedIssue.State)
 			assert.Equal(t, *tc.expectedIssue.HTMLURL, *returnedIssue.HTMLURL)
 			assert.Equal(t, *tc.expectedIssue.User.Login, *returnedIssue.User.Login)
@@ -5999,8 +5999,8 @@ func Test_GetSubIssues(t *testing.T) {
 	mockSubIssues := []*github.Issue{
 		{
 			Number:  github.Ptr(123),
-			Title:   github.Ptr("<int>\u200B"),
-			Body:    github.Ptr("This is **Markdown**\u200B"),
+			Title:   github.Ptr("<script>alert(1)</script>can't \"quote\" AT&T\u200B"),
+			Body:    github.Ptr("<script>alert(1)</script>This is **Markdown**\u200B"),
 			State:   github.Ptr("open"),
 			HTMLURL: github.Ptr("https://github.com/owner/repo/issues/123"),
 			User: &github.User{
@@ -6200,8 +6200,8 @@ func Test_GetSubIssues(t *testing.T) {
 				if i < len(tc.expectedSubIssues) {
 					assert.Equal(t, *tc.expectedSubIssues[i].Number, *subIssue.Number)
 					if i == 0 {
-						assert.Empty(t, *subIssue.Title)
-						assert.Equal(t, "This is **Markdown**", *subIssue.Body)
+						assert.Equal(t, "can't \"quote\" AT&T", *subIssue.Title)
+						assert.Equal(t, "<script>alert(1)</script>This is **Markdown**", *subIssue.Body)
 					} else {
 						assert.Equal(t, *tc.expectedSubIssues[i].Title, *subIssue.Title)
 					}
@@ -6657,8 +6657,8 @@ func Test_RemoveSubIssue(t *testing.T) {
 	// Setup mock issue for success case (matches GitHub API response format - the updated parent issue)
 	mockIssue := &github.Issue{
 		Number:  github.Ptr(42),
-		Title:   github.Ptr("<int>\u200B"),
-		Body:    github.Ptr("This is **Markdown**\u200B"),
+		Title:   github.Ptr("<script>alert(1)</script>can't \"quote\" AT&T\u200B"),
+		Body:    github.Ptr("<script>alert(1)</script>This is **Markdown**\u200B"),
 		State:   github.Ptr("open"),
 		HTMLURL: github.Ptr("https://github.com/owner/repo/issues/42"),
 		User: &github.User{
@@ -6836,8 +6836,8 @@ func Test_RemoveSubIssue(t *testing.T) {
 			err = json.Unmarshal([]byte(textContent.Text), &returnedIssue)
 			require.NoError(t, err)
 			assert.Equal(t, *tc.expectedIssue.Number, *returnedIssue.Number)
-			assert.Empty(t, *returnedIssue.Title)
-			assert.Equal(t, "This is **Markdown**", *returnedIssue.Body)
+			assert.Equal(t, "can't \"quote\" AT&T", *returnedIssue.Title)
+			assert.Equal(t, "<script>alert(1)</script>This is **Markdown**", *returnedIssue.Body)
 			assert.Equal(t, *tc.expectedIssue.State, *returnedIssue.State)
 			assert.Equal(t, *tc.expectedIssue.HTMLURL, *returnedIssue.HTMLURL)
 			assert.Equal(t, *tc.expectedIssue.User.Login, *returnedIssue.User.Login)
@@ -6865,8 +6865,8 @@ func Test_ReprioritizeSubIssue(t *testing.T) {
 	// Setup mock issue for success case (matches GitHub API response format - the updated parent issue)
 	mockIssue := &github.Issue{
 		Number:  github.Ptr(42),
-		Title:   github.Ptr("<int>\u200B"),
-		Body:    github.Ptr("This is **Markdown**\u200B"),
+		Title:   github.Ptr("<script>alert(1)</script>ca
```

**File**: `pkg/github/minimal_types.go` (modified, +7/-7)
```diff
@@ -204,7 +204,7 @@ type MinimalDiscussionComment struct {
 func newMinimalDiscussionComment(id string, body string, isAnswer bool) MinimalDiscussionComment {
 	return MinimalDiscussionComment{
 		ID:       id,
-		Body:     sanitize.Sanitize(body),
+		Body:     sanitize.Content(body),
 		IsAnswer: isAnswer,
 	}
 }
@@ -1015,7 +1015,7 @@ func convertToMinimalIssuesResponseWithoutFieldValues(fragment issueQueryFragmen
 func convertToMinimalIssueComment(comment *github.IssueComment) MinimalIssueComment {
 	m := MinimalIssueComment{
 		ID:                comment.GetID(),
-		Body:              sanitize.Sanitize(comment.GetBody()),
+		Body:              sanitize.Content(comment.GetBody()),
 		HTMLURL:           comment.GetHTMLURL(),
 		User:              convertToMinimalUser(comment.GetUser()),
 		AuthorAssociation: comment.GetAuthorAssociation(),
@@ -1064,7 +1064,7 @@ func convertToMinimalFileContentResponse(resp *github.RepositoryContentResponse)
 
 	m.Commit = &MinimalFileCommit{
 		SHA:     resp.Commit.GetSHA(),
-		Message: sanitize.Sanitize(resp.Commit.GetMessage()),
+		Message: sanitize.Content(resp.Commit.GetMessage()),
 		HTMLURL: resp.Commit.GetHTMLURL(),
 	}
 
@@ -1794,7 +1794,7 @@ func newMinimalCommitFromCore(sha, htmlURL string, commit *github.Commit, author
 
 	if commit != nil {
 		minimalCommit.Commit = &MinimalCommitInfo{
-			Message: sanitize.Sanitize(commit.GetMessage()),
+			Message: sanitize.Content(commit.GetMessage()),
 		}
 
 		if commit.Author != nil {
@@ -2000,7 +2000,7 @@ func convertToMinimalPullRequestCommits(commits []*github.RepositoryCommit) []Mi
 		}
 
 		if commit.Commit != nil {
-			minimalCommit.Message = sanitize.Sanitize(commit.Commit.GetMessage())
+			minimalCommit.Message = sanitize.Content(commit.Commit.GetMessage())
 			minimalCommit.Author = convertToMinimalCommitAuthor(commit.Commit.Author)
 		}
 
@@ -2095,7 +2095,7 @@ func convertToMinimalWorkflowRun(workflowRun *github.WorkflowRun) MinimalWorkflo
 
 	if headCommit := workflowRun.GetHeadCommit(); headCommit != nil && headCommit.GetMessage() != "" {
 		minimalRun.HeadCommit = &MinimalWorkflowRunHeadCommit{
-			Message: sanitize.Sanitize(headCommit.GetMessage()),
+			Message: sanitize.Content(headCommit.GetMessage()),
 		}
 	}
 
@@ -2280,7 +2280,7 @@ func convertToMinimalReviewThread(thread reviewThreadNode) MinimalReviewThread {
 
 func convertToMinimalReviewComment(c reviewCommentNode) MinimalReviewComment {
 	m := MinimalReviewComment{
-		Body:    sanitize.Sanitize(string(c.Body)),
+		Body:    sanitize.Content(string(c.Body)),
 		Path:    string(c.Path),
 		Author:  string(c.Author.Login),
 		HTMLURL: c.URL.String(),
```

**File**: `pkg/github/repositories.go` (modified, +15/-1)
```diff
@@ -2233,6 +2233,7 @@ func GetLatestRelease(t translations.TranslationHelperFunc) inventory.ServerTool
 				return ghErrors.NewGitHubAPIStatusErrorResponse(ctx, "failed to get latest release", resp, body), nil, nil
 			}
 
+			sanitizeReleaseNameAndBody(release)
 			r, err := json.Marshal(release)
 			if err != nil {
 				return nil, nil, fmt.Errorf("failed to marshal response: %w", err)
@@ -2319,6 +2320,7 @@ func GetReleaseByTag(t translations.TranslationHelperFunc) inventory.ServerTool
 				return ghErrors.NewGitHubAPIStatusErrorResponse(ctx, "failed to get release by tag", resp, body), nil, nil
 			}
 
+			sanitizeReleaseNameAndBody(release)
 			r, err := json.Marshal(release)
 			if err != nil {
 				return nil, nil, fmt.Errorf("failed to marshal response: %w", err)
@@ -2338,6 +2340,18 @@ func GetReleaseByTag(t translations.TranslationHelperFunc) inventory.ServerTool
 	)
 }
 
+func sanitizeReleaseNameAndBody(release *github.RepositoryRelease) {
+	if release == nil {
+		return
+	}
+	if release.Name != nil {
+		release.Name = github.Ptr(sanitize.PlainText(*release.Name))
+	}
+	if release.Body != nil {
+		release.Body = github.Ptr(sanitize.Content(*release.Body))
+	}
+}
+
 // ListStarredRepositories creates a tool to list starred repositories for the authenticated user or a specified user.
 func ListStarredRepositories(t translations.TranslationHelperFunc) inventory.ServerTool {
 	return NewTool(
@@ -2981,7 +2995,7 @@ func GetFileBlame(t translations.TranslationHelperFunc) inventory.ServerTool {
 					SHA: sha,
 					// Sanitized after truncation so the headline is cut at the author's real
 					// first line break rather than one introduced by sanitization.
-					MessageHeadline: sanitize.Content(headline),
+					MessageHeadline: sanitize.PlainText(headline),
 					CommittedDate:   r.Commit.CommittedDate.Format("2006-01-02T15:04:05Z"),
 					Author: BlameAuthor{
 						Name:  string(r.Commit.Author.Name),
```

**File**: `pkg/github/repositories_test.go` (modified, +9/-9)
```diff
@@ -4854,8 +4854,8 @@ func Test_GetLatestRelease(t *testing.T) {
 	mockRelease := &github.RepositoryRelease{
 		ID:      1,
 		TagName: "v1.0.0",
-		Name:    github.Ptr("First Release"),
-		Body:    github.Ptr("<details>Notes</details>\u200B"),
+		Name:    github.Ptr("<script>alert(1)</script>can't \"quote\" AT&T\u200B"),
+		Body:    github.Ptr("<script>alert(1)</script><details>Notes</details>\u200B"),
 	}
 
 	tests := []struct {
@@ -4923,8 +4923,8 @@ func Test_GetLatestRelease(t *testing.T) {
 			err = json.Unmarshal([]byte(textContent.Text), &returnedRelease)
 			require.NoError(t, err)
 			assert.Equal(t, tc.expectedResult.TagName, returnedRelease.TagName)
-			assert.Equal(t, "First Release", *returnedRelease.Name)
-			assert.Equal(t, "<details>Notes</details>", *returnedRelease.Body)
+			assert.Equal(t, "can't \"quote\" AT&T", *returnedRelease.Name)
+			assert.Equal(t, "<script>alert(1)</script><details>Notes</details>", *returnedRelease.Body)
 		})
 	}
 }
@@ -4947,8 +4947,8 @@ func Test_GetReleaseByTag(t *testing.T) {
 	mockRelease := &github.RepositoryRelease{
 		ID:      1,
 		TagName: "v1.0.0",
-		Name:    github.Ptr("Release v1.0.0"),
-		Body:    github.Ptr("<details>Notes</details>\u200B"),
+		Name:    github.Ptr("<script>alert(1)</script>can't \"quote\" AT&T\u200B"),
+		Body:    github.Ptr("<script>alert(1)</script><details>Notes</details>\u200B"),
 		Assets: []*github.ReleaseAsset{
 			{
 				ID:   github.Ptr(int64(1)),
@@ -5088,9 +5088,9 @@ func Test_GetReleaseByTag(t *testing.T) {
 
 			assert.Equal(t, tc.expectedResult.ID, returnedRelease.ID)
 			assert.Equal(t, tc.expectedResult.TagName, returnedRelease.TagName)
-			assert.Equal(t, *tc.expectedResult.Name, *returnedRelease.Name)
+			assert.Equal(t, "can't \"quote\" AT&T", *returnedRelease.Name)
 			if tc.expectedResult.Body != nil {
-				assert.Equal(t, "<details>Notes</details>", *returnedRelease.Body)
+				assert.Equal(t, "<script>alert(1)</script><details>Notes</details>", *returnedRelease.Body)
 			}
 			if len(tc.expectedResult.Assets) > 0 {
 				require.Len(t, returnedRelease.Assets, len(tc.expectedResult.Assets))
@@ -6203,7 +6203,7 @@ func Test_GetFileBlame(t *testing.T) {
 				var br BlameResult
 				require.NoError(t, json.Unmarshal([]byte(result), &br))
 				require.Contains(t, br.Commits, "badc0ffee0000")
-				assert.Equal(t, sanitizedContentText, br.Commits["badc0ffee0000"].MessageHeadline)
+				assert.Equal(t, sanitizedText, br.Commits["badc0ffee0000"].MessageHeadline)
 				assert.NotContains(t, result, "<script>")
 				assert.NotContains(t, result, "Long body that should not appear")
 			},
```

---

### Incident Patch 3: `25f11e62` (2026-09-03)
**Commit Message**: fix(sanitize): preserve Markdown body fidelity on read surfaces (#3177)

* fix: preserve Markdown content in GitHub responses

Route body-bearing response fields through the fidelity-preserving content path while retaining strict title handling and remove only unconditional invisible characters. Cover direct and converter read-modify-write surfaces for issues, releases, comments, discussions, projects, and commits.

Refs #2202, #3165

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>

Copilot-Session: 69c5ab30-9815-4c07-8385-11a206e68f66

* chore: regenerate license files

Auto-generated by license-check workflow

---------

Co-authored-by: github-actions[bot] <github-actions[bot]@users.noreply.github.com>
Copilot-Session: 69c5ab30-9815-4c07-8385-11a206e68f66

**File**: `pkg/github/discussions.go` (modified, +1/-1)
```diff
@@ -362,7 +362,7 @@ func GetDiscussion(t translations.TranslationHelperFunc) inventory.ServerTool {
 			response := map[string]any{
 				"number":     int(d.Number),
 				"title":      sanitize.PlainText(string(d.Title)),
-				"body":       sanitize.Sanitize(string(d.Body)),
+				"body":       sanitize.Content(string(d.Body)),
 				"url":        string(d.URL),
 				"closed":     bool(d.Closed),
 				"isAnswered": bool(d.IsAnswered),
```

**File**: `pkg/github/discussions_test.go` (modified, +1/-1)
```diff
@@ -571,7 +571,7 @@ func Test_GetDiscussion(t *testing.T) {
 			expected: map[string]any{
 				"number":     float64(1),
 				"title":      sanitizedText,
-				"body":       sanitizedText,
+				"body":       sanitizedContentText,
 				"url":        "https://github.com/owner/repo/discussions/1",
 				"closed":     false,
 				"isAnswered": false,
```

**File**: `pkg/github/find_duplicate_test.go` (modified, +0/-1)
```diff
@@ -166,7 +166,6 @@ func Test_FindDuplicate_SanitizesIssueTitle(t *testing.T) {
 	require.NoError(t, json.Unmarshal([]byte(text.Text), &candidates))
 	require.Len(t, candidates, 1)
 	assert.Equal(t, sanitizedText, candidates[0].Issue.Title)
-	assert.NotContains(t, text.Text, "<script>")
 }
 
 func Test_FindDuplicate_OmitsUnsetParams(t *testing.T) {
```

**File**: `pkg/github/issues.go` (modified, +19/-1)
```diff
@@ -1118,6 +1118,9 @@ func GetSubIssues(ctx context.Context, client *github.Client, deps ToolDependenc
 		subIssues = filteredSubIssues
 	}
 
+	for _, subIssue := range subIssues {
+		sanitizeSubIssueTitleAndBody(subIssue)
+	}
 	r, err := json.Marshal(subIssues)
 	if err != nil {
 		return nil, fmt.Errorf("failed to marshal response: %w", err)
@@ -1708,6 +1711,7 @@ func AddSubIssue(ctx context.Context, client *github.Client, owner string, repo
 		return ghErrors.NewGitHubAPIStatusErrorResponse(ctx, "failed to add sub-issue", resp, body), nil
 	}
 
+	sanitizeSubIssueTitleAndBody(subIssue)
 	r, err := json.Marshal(subIssue)
 	if err != nil {
 		return nil, fmt.Errorf("failed to marshal response: %w", err)
@@ -1739,6 +1743,7 @@ func RemoveSubIssue(ctx context.Context, client *github.Client, owner string, re
 		return ghErrors.NewGitHubAPIStatusErrorResponse(ctx, "failed to remove sub-issue", resp, body), nil
 	}
 
+	sanitizeSubIssueTitleAndBody(subIssue)
 	r, err := json.Marshal(subIssue)
 	if err != nil {
 		return nil, fmt.Errorf("failed to marshal response: %w", err)
@@ -1788,6 +1793,7 @@ func ReprioritizeSubIssue(ctx context.Context, client *github.Client, owner stri
 		return ghErrors.NewGitHubAPIStatusErrorResponse(ctx, "failed to reprioritize sub-issue", resp, body), nil
 	}
 
+	sanitizeSubIssueTitleAndBody(subIssue)
 	r, err := json.Marshal(subIssue)
 	if err != nil {
 		return nil, fmt.Errorf("failed to marshal response: %w", err)
@@ -1998,7 +2004,19 @@ func sanitizeIssueTitleAndBody(issue *github.Issue) {
 		issue.Title = github.Ptr(sanitize.PlainText(*issue.Title))
 	}
 	if issue.Body != nil {
-		issue.Body = github.Ptr(sanitize.Sanitize(*issue.Body))
+		issue.Body = github.Ptr(sanitize.Content(*issue.Body))
+	}
+}
+
+func sanitizeSubIssueTitleAndBody(issue *github.SubIssue) {
+	if issue == nil {
+		return
+	}
+	if issue.Title != nil {
+		issue.Title = github.Ptr(sanitize.Sanitize(*issue.Title))
+	}
+	if issue.Body != nil {
+		issue.Body = github.Ptr(sanitize.Content(*issue.Body))
 	}
 }
 
```

**File**: `pkg/github/issues_test.go` (modified, +21/-16)
```diff
@@ -5774,8 +5774,8 @@ func Test_AddSubIssue(t *testing.T) {
 	// Setup mock issue for success case (matches GitHub API response format)
 	mockIssue := &github.Issue{
 		Number:  github.Ptr(42),
-		Title:   github.Ptr("Parent Issue"),
-		Body:    github.Ptr("This is the parent issue with a sub-issue"),
+		Title:   github.Ptr("<int>\u200B"),
+		Body:    github.Ptr("This is **Markdown**\u200B"),
 		State:   github.Ptr("open"),
 		HTMLURL: github.Ptr("https://github.com/owner/repo/issues/42"),
 		User: &github.User{
@@ -5970,8 +5970,8 @@ func Test_AddSubIssue(t *testing.T) {
 			err = json.Unmarshal([]byte(textContent.Text), &returnedIssue)
 			require.NoError(t, err)
 			assert.Equal(t, *tc.expectedIssue.Number, *returnedIssue.Number)
-			assert.Equal(t, *tc.expectedIssue.Title, *returnedIssue.Title)
-			assert.Equal(t, *tc.expectedIssue.Body, *returnedIssue.Body)
+			assert.Empty(t, *returnedIssue.Title)
+			assert.Equal(t, "This is **Markdown**", *returnedIssue.Body)
 			assert.Equal(t, *tc.expectedIssue.State, *returnedIssue.State)
 			assert.Equal(t, *tc.expectedIssue.HTMLURL, *returnedIssue.HTMLURL)
 			assert.Equal(t, *tc.expectedIssue.User.Login, *returnedIssue.User.Login)
@@ -5999,8 +5999,8 @@ func Test_GetSubIssues(t *testing.T) {
 	mockSubIssues := []*github.Issue{
 		{
 			Number:  github.Ptr(123),
-			Title:   github.Ptr("Sub-issue 1"),
-			Body:    github.Ptr("This is the first sub-issue"),
+			Title:   github.Ptr("<int>\u200B"),
+			Body:    github.Ptr("This is **Markdown**\u200B"),
 			State:   github.Ptr("open"),
 			HTMLURL: github.Ptr("https://github.com/owner/repo/issues/123"),
 			User: &github.User{
@@ -6199,12 +6199,17 @@ func Test_GetSubIssues(t *testing.T) {
 			for i, subIssue := range returnedSubIssues {
 				if i < len(tc.expectedSubIssues) {
 					assert.Equal(t, *tc.expectedSubIssues[i].Number, *subIssue.Number)
-					assert.Equal(t, *tc.expectedSubIssues[i].Title, *subIssue.Title)
+					if i == 0 {
+						assert.Empty(t, *subIssue.Title)
+						assert.Equal(t, "This is **Markdown**", *subIssue.Body)
+					} else {
+						assert.Equal(t, *tc.expectedSubIssues[i].Title, *subIssue.Title)
+					}
 					assert.Equal(t, *tc.expectedSubIssues[i].State, *subIssue.State)
 					assert.Equal(t, *tc.expectedSubIssues[i].HTMLURL, *subIssue.HTMLURL)
 					assert.Equal(t, *tc.expectedSubIssues[i].User.Login, *subIssue.User.Login)
 
-					if tc.expectedSubIssues[i].Body != nil {
+					if i != 0 && tc.expectedSubIssues[i].Body != nil {
 						assert.Equal(t, *tc.expectedSubIssues[i].Body, *subIssue.Body)
 					}
 				}
@@ -6652,8 +6657,8 @@ func Test_RemoveSubIssue(t *testing.T) {
 	// Setup mock issue for success case (matches GitHub API response format - the updated parent issue)
 	mockIssue := &github.Issue{
 		Number:  github.Ptr(42),
-		Title:   github.Ptr("Parent Issue"),
-		Body:    github.Ptr("This is the parent issue after sub-issue removal"),
+		Title:   github.Ptr("<int>\u200B"),
+		Body:    github.Ptr("This is **Markdown**\u200B"),
 		State:   github.Ptr("open"),
 		HTMLURL: github.Ptr("https://github.com/owner/repo/issues/42"),
 		User: &github.User{
@@ -6831,8 +6836,8 @@ func Test_RemoveSubIssue(t *testing.T) {
 			err = json.Unmarshal([]byte(textContent.Text), &returnedIssue)
 			require.NoError(t, err)
 			assert.Equal(t, *tc.expectedIssue.Number, *returnedIssue.Number)
-			assert.Equal(t, *tc.expectedIssue.Title, *returnedIssue.Title)
-			assert.Equal(t, *tc.expectedIssue.Body, *returnedIssue.Body)
+			assert.Empty(t, *returnedIssue.Title)
+			assert.Equal(t, "This is **Markdown**", *returnedIssue.Body)
 			assert.Equal(t, *tc.expectedIssue.State, *returnedIssue.State)
 			assert.Equal(t, *tc.expectedIssue.HTMLURL, *returnedIssue.HTMLURL)
 			assert.Equal(t, *tc.expectedIssue.User.Login, *returnedIssue.User.Login)
@@ -6860,8 +6865,8 @@ func Test_ReprioritizeSubIssue(t *testing.T) {
 	// Setup mock issue for success case (matches GitHub API response format - the updated parent issue)
 	mockIssue := &g
```

---

### Incident Patch 4: `f2cbc12e` (2026-09-03)
**Commit Message**: fix(sanitize): preserve plain-text title characters (#3216)

Add an entity-aware plain-text sanitizer for titles, release names, headlines, and validation text while keeping encoded markup inert and Markdown body handling unchanged.

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>

**File**: `pkg/errors/error.go` (modified, +1/-2)
```diff
@@ -256,8 +256,7 @@ func formatGitHubValidationDetail(validationErr github.Error) string {
 }
 
 func sanitizeGitHubValidationText(value string) string {
-	// Tool errors are plain text; keep quoted branch patterns readable.
-	sanitized := strings.ReplaceAll(sanitize.Sanitize(value), "&#39;", "'")
+	sanitized := sanitize.PlainText(value)
 	return strings.Join(strings.Fields(sanitized), " ")
 }
 
```

**File**: `pkg/errors/error_test.go` (modified, +4/-3)
```diff
@@ -703,13 +703,13 @@ func TestNewGitHubAPIErrorResponse_ValidationMessages(t *testing.T) {
 
 		originalErr := &github.ErrorResponse{
 			Response: response,
-			Message:  "Validation <script>secret-script</script>Failed\u202e",
+			Message:  "Validation <script>secret-script</script>Failed\u202e for AT&T",
 			Errors: []github.Error{
 				{
 					Resource: "GitRef",
 					Field:    "ref",
 					Code:     "custom",
-					Message:  "ref name does not match the required pattern 'feature/*'\u202e",
+					Message:  `ref name does not match the required pattern 'feature/*' or "release/*"` + "\u202e",
 				},
 			},
 			DocumentationURL: "https://docs.github.test/private?token=secret-doc-token",
@@ -724,7 +724,8 @@ func TestNewGitHubAPIErrorResponse_ValidationMessages(t *testing.T) {
 		)
 
 		text := requireErrorText(t, result)
-		assert.Equal(t, "failed to create branch: Validation Failed\nGitRef.ref (custom): ref name does not match the required pattern 'feature/*'", text)
+		assert.Equal(t, `failed to create branch: Validation Failed for AT&T
+GitRef.ref (custom): ref name does not match the required pattern 'feature/*' or "release/*"`, text)
 		assert.NotContains(t, text, "create ref")
 		assert.NotContains(t, text, "https://")
 		assert.NotContains(t, text, "secret-")
```

**File**: `pkg/github/discussions.go` (modified, +2/-2)
```diff
@@ -100,7 +100,7 @@ type WithCategoryNoOrder struct {
 func fragmentToDiscussion(fragment NodeFragment) *github.Discussion {
 	return &github.Discussion{
 		Number:    github.Ptr(int(fragment.Number)),
-		Title:     github.Ptr(sanitize.Sanitize(string(fragment.Title))),
+		Title:     github.Ptr(sanitize.PlainText(string(fragment.Title))),
 		HTMLURL:   github.Ptr(string(fragment.URL)),
 		CreatedAt: &github.Timestamp{Time: fragment.CreatedAt.Time},
 		UpdatedAt: &github.Timestamp{Time: fragment.UpdatedAt.Time},
@@ -361,7 +361,7 @@ func GetDiscussion(t translations.TranslationHelperFunc) inventory.ServerTool {
 			// like ListDiscussions and GetDiscussionComments).
 			response := map[string]any{
 				"number":     int(d.Number),
-				"title":      sanitize.Sanitize(string(d.Title)),
+				"title":      sanitize.PlainText(string(d.Title)),
 				"body":       sanitize.Sanitize(string(d.Body)),
 				"url":        string(d.URL),
 				"closed":     bool(d.Closed),
```

**File**: `pkg/github/issues.go` (modified, +2/-2)
```diff
@@ -1194,7 +1194,7 @@ func GetIssueParent(ctx context.Context, client *githubv4.Client, deps ToolDepen
 	return MarshalledTextResult(map[string]any{
 		"parent": map[string]any{
 			"number":     int(parent.Number),
-			"title":      sanitize.Sanitize(string(parent.Title)),
+			"title":      sanitize.PlainText(string(parent.Title)),
 			"state":      string(parent.State),
 			"url":        string(parent.URL),
 			"repository": string(parent.Repository.NameWithOwner),
@@ -1995,7 +1995,7 @@ func sanitizeIssueTitleAndBody(issue *github.Issue) {
 		return
 	}
 	if issue.Title != nil {
-		issue.Title = github.Ptr(sanitize.Sanitize(*issue.Title))
+		issue.Title = github.Ptr(sanitize.PlainText(*issue.Title))
 	}
 	if issue.Body != nil {
 		issue.Body = github.Ptr(sanitize.Sanitize(*issue.Body))
```

**File**: `pkg/github/minimal_types.go` (modified, +11/-11)
```diff
@@ -622,7 +622,7 @@ type MinimalPullRequestRef struct {
 func newMinimalPullRequestRef(number int, title, state, url, repository string) MinimalPullRequestRef {
 	return MinimalPullRequestRef{
 		Number:     number,
-		Title:      sanitize.Sanitize(title),
+		Title:      sanitize.PlainText(title),
 		State:      state,
 		URL:        url,
 		Repository: repository,
@@ -646,7 +646,7 @@ type MinimalIssueRef struct {
 func newMinimalIssueRef(number int, title, state, url, repository string) MinimalIssueRef {
 	return MinimalIssueRef{
 		Number:     number,
-		Title:      sanitize.Sanitize(title),
+		Title:      sanitize.PlainText(title),
 		State:      state,
 		URL:        url,
 		Repository: repository,
@@ -814,7 +814,7 @@ func convertToMinimalPullRequestReview(review *github.PullRequestReview) Minimal
 func convertToMinimalIssue(issue *github.Issue) MinimalIssue {
 	m := MinimalIssue{
 		Number:            issue.GetNumber(),
-		Title:             sanitize.Sanitize(issue.GetTitle()),
+		Title:             sanitize.PlainText(issue.GetTitle()),
 		Body:              sanitize.Sanitize(issue.GetBody()),
 		State:             issue.GetState(),
 		StateReason:       issue.GetStateReason(),
@@ -925,7 +925,7 @@ func fragmentToMinimalIssue(fragment IssueFragment) MinimalIssue {
 func fragmentWithoutFieldValuesToMinimalIssue(fragment issueFragmentWithoutFieldValues) MinimalIssue {
 	m := MinimalIssue{
 		Number:    int(fragment.Number),
-		Title:     sanitize.Sanitize(string(fragment.Title)),
+		Title:     sanitize.PlainText(string(fragment.Title)),
 		Body:      sanitize.Sanitize(string(fragment.Body)),
 		State:     string(fragment.State),
 		Comments:  int(fragment.Comments.TotalCount),
@@ -1084,7 +1084,7 @@ func convertToMinimalFileContentResponse(resp *github.RepositoryContentResponse)
 func convertToMinimalPullRequest(pr *github.PullRequest) MinimalPullRequest {
 	m := MinimalPullRequest{
 		Number:         pr.GetNumber(),
-		Title:          sanitize.Sanitize(pr.GetTitle()),
+		Title:          sanitize.PlainText(pr.GetTitle()),
 		Body:           sanitize.Sanitize(pr.GetBody()),
 		State:          pr.GetState(),
 		Draft:          pr.GetDraft(),
@@ -1279,7 +1279,7 @@ func convertIssueToMinimalProjectItemContent(issue *github.Issue) *MinimalProjec
 		ID:          issue.GetID(),
 		NodeID:      issue.GetNodeID(),
 		Number:      issue.GetNumber(),
-		Title:       sanitize.Sanitize(issue.GetTitle()),
+		Title:       sanitize.PlainText(issue.GetTitle()),
 		State:       issue.GetState(),
 		StateReason: issue.GetStateReason(),
 		HTMLURL:     issue.GetHTMLURL(),
@@ -1316,7 +1316,7 @@ func convertPullRequestToMinimalProjectItemContent(pr *github.PullRequest) *Mini
 		ID:         pr.GetID(),
 		NodeID:     pr.GetNodeID(),
 		Number:     pr.GetNumber(),
-		Title:      sanitize.Sanitize(pr.GetTitle()),
+		Title:      sanitize.PlainText(pr.GetTitle()),
 		State:      pr.GetState(),
 		HTMLURL:    pr.GetHTMLURL(),
 		Repository: pullRequestRepositoryFullName(pr),
@@ -1353,7 +1353,7 @@ func convertDraftIssueToMinimalProjectItemContent(draftIssue *github.ProjectV2Dr
 	m := &MinimalProjectItemContent{
 		ID:        draftIssue.GetID(),
 		NodeID:    draftIssue.GetNodeID(),
-		Title:     sanitize.Sanitize(draftIssue.GetTitle()),
+		Title:     sanitize.PlainText(draftIssue.GetTitle()),
 		CreatedAt: formatProjectTimestamp(draftIssue.CreatedAt),
 		UpdatedAt: formatProjectTimestamp(draftIssue.UpdatedAt),
 	}
@@ -1612,7 +1612,7 @@ func minimalProjectPullRequestRefFromPullRequest(pr *github.PullRequest) minimal
 	}
 	return minimalProjectPullRequestRef{
 		Number:     pr.GetNumber(),
-		Title:      sanitize.Sanitize(pr.GetTitle()),
+		Title:      sanitize.PlainText(pr.GetTitle()),
 		State:      pr.GetState(),
 		HTMLURL:    pr.GetHTMLURL(),
 		Repository: pullRequestRepositoryFullName(pr),
@@ -1634,7 +1634,7 @@ func minimalProjectPullRequestRefFromMap(value map[string]any) minimalProjectPul
 
 	return minimalProjectPullRequestRef{
 		Number:     int
```

---

### Incident Patch 5: `12d16ed0` (2026-09-01)
**Commit Message**: fix(http): allow projected MCP headers in preflights (#3167)

* fix(http): allow projected MCP headers in preflights

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>

* chore: regenerate license files

Auto-generated by license-check workflow

* fix(http): bound projected preflight headers

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>

---------

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>
Co-authored-by: github-actions[bot] <github-actions[bot]@users.noreply.github.com>

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -19,6 +19,7 @@ require (
 	github.com/spf13/viper v1.21.0
 	github.com/stretchr/testify v1.12.1
 	github.com/yosida95/uritemplate/v3 v3.0.2
+	golang.org/x/net v0.55.0
 	golang.org/x/oauth2 v0.36.0
 )
 
@@ -38,7 +39,6 @@ require (
 	github.com/stretchr/objx v0.5.3 // indirect
 	github.com/subosito/gotenv v1.6.0 // indirect
 	go.yaml.in/yaml/v3 v3.0.5 // indirect
-	golang.org/x/net v0.55.0 // indirect
 	golang.org/x/sync v0.20.0 // indirect
 	golang.org/x/sys v0.45.0 // indirect
 	golang.org/x/text v0.37.0 // indirect
```

**File**: `pkg/http/headers/headers.go` (modified, +8/-0)
```diff
@@ -41,6 +41,14 @@ const (
 
 	// MCPMethodHeader mirrors the JSON-RPC method for request routing.
 	MCPMethodHeader = "Mcp-Method"
+	// MCPNameHeader identifies the requested MCP primitive.
+	MCPNameHeader = "Mcp-Name"
+	// MCPParamHeaderPrefix prefixes request headers projected from MCP parameters.
+	MCPParamHeaderPrefix = "Mcp-Param-"
+	// MCPParamOwnerHeader carries the projected owner parameter.
+	MCPParamOwnerHeader = MCPParamHeaderPrefix + "owner"
+	// MCPParamRepoHeader carries the projected repo parameter.
+	MCPParamRepoHeader = MCPParamHeaderPrefix + "repo"
 	// MCPReadOnlyHeader indicates whether the MCP is in read-only mode.
 	MCPReadOnlyHeader = "X-MCP-Readonly"
 	// MCPToolsetsHeader is a comma-separated list of MCP toolsets that the request is for.
```

**File**: `pkg/http/middleware/cors.go` (modified, +69/-15)
```diff
@@ -2,42 +2,96 @@ package middleware
 
 import (
 	"net/http"
+	"sort"
 	"strings"
 
 	"github.com/github/github-mcp-server/pkg/http/headers"
+	"golang.org/x/net/http/httpguts"
 )
 
+const maxCORSProjectedRequestHeaders = 64
+
+var corsAllowedRequestHeaders = []string{
+	headers.ContentTypeHeader,
+	"Mcp-Session-Id",
+	"Mcp-Protocol-Version",
+	headers.MCPMethodHeader,
+	headers.MCPNameHeader,
+	"Last-Event-ID",
+	headers.AuthorizationHeader,
+	headers.MCPReadOnlyHeader,
+	headers.MCPToolsetsHeader,
+	headers.MCPToolsHeader,
+	headers.MCPExcludeToolsHeader,
+	headers.MCPFeaturesHeader,
+	headers.MCPLockdownHeader,
+	headers.MCPInsidersHeader,
+	headers.MCPParamOwnerHeader,
+	headers.MCPParamRepoHeader,
+}
+
 // SetCorsHeaders is middleware that sets CORS headers to allow browser-based
 // MCP clients to connect from any origin. This is safe because the server
 // authenticates via bearer tokens (not cookies), so cross-origin requests
 // cannot exploit ambient credentials.
 func SetCorsHeaders(h http.Handler) http.Handler {
-	allowHeaders := strings.Join([]string{
-		"Content-Type",
-		"Mcp-Session-Id",
-		"Mcp-Protocol-Version",
-		"Last-Event-ID",
-		headers.AuthorizationHeader,
-		headers.MCPReadOnlyHeader,
-		headers.MCPToolsetsHeader,
-		headers.MCPToolsHeader,
-		headers.MCPExcludeToolsHeader,
-		headers.MCPFeaturesHeader,
-		headers.MCPLockdownHeader,
-		headers.MCPInsidersHeader,
-	}, ", ")
+	fixedAllowHeaders := strings.Join(corsAllowedRequestHeaders, ", ")
 
 	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
 		w.Header().Set("Access-Control-Allow-Origin", "*")
 		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
 		w.Header().Set("Access-Control-Max-Age", "86400")
 		w.Header().Add("Access-Control-Expose-Headers", "Mcp-Session-Id, WWW-Authenticate")
-		w.Header().Set("Access-Control-Allow-Headers", allowHeaders)
+		w.Header().Set("Access-Control-Allow-Headers", fixedAllowHeaders)
 
 		if r.Method == http.MethodOptions {
+			w.Header().Set("Access-Control-Allow-Headers", corsPreflightAllowedRequestHeaders(r.Header))
 			w.WriteHeader(http.StatusOK)
 			return
 		}
 		h.ServeHTTP(w, r)
 	})
 }
+
+// corsPreflightAllowedRequestHeaders reflects validated projected arguments because CORS has no prefix wildcard.
+func corsPreflightAllowedRequestHeaders(requestHeaders http.Header) string {
+	allowed := make([]string, 0, len(corsAllowedRequestHeaders))
+	allowed = append(allowed, corsAllowedRequestHeaders...)
+
+	seen := make(map[string]struct{}, len(allowed))
+	for _, header := range allowed {
+		seen[strings.ToLower(header)] = struct{}{}
+	}
+
+	prefix := strings.ToLower(headers.MCPParamHeaderPrefix)
+	projected := make([]string, 0, maxCORSProjectedRequestHeaders)
+requestedHeaders:
+	for _, value := range requestHeaders.Values("Access-Control-Request-Headers") {
+		for header := range strings.SplitSeq(value, ",") {
+			header = strings.TrimSpace(header)
+			if !httpguts.ValidHeaderFieldName(header) {
+				continue
+			}
+
+			key := strings.ToLower(header)
+			if !strings.HasPrefix(key, prefix) || len(key) == len(prefix) {
+				continue
+			}
+			if _, ok := seen[key]; ok {
+				continue
+			}
+
+			seen[key] = struct{}{}
+			projected = append(projected, key)
+			if len(projected) == maxCORSProjectedRequestHeaders {
+				break requestedHeaders
+			}
+		}
+	}
+
+	sort.Strings(projected)
+	for _, header := range projected {
+		allowed = append(allowed, http.CanonicalHeaderKey(header))
+	}
+	return strings.Join(allowed, ", ")
+}
```

**File**: `pkg/http/middleware/cors_test.go` (modified, +120/-40)
```diff
@@ -1,61 +1,141 @@
 package middleware_test
 
 import (
+	"fmt"
 	"net/http"
 	"net/http/httptest"
 	"strings"
 	"testing"
 
 	"github.com/github/github-mcp-server/pkg/http/middleware"
 	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
 )
 
-func TestSetCorsHeaders(t *testing.T) {
+const fixedAllowedRequestHeaders = "Content-Type, Mcp-Session-Id, Mcp-Protocol-Version, Mcp-Method, Mcp-Name, Last-Event-ID, Authorization, X-MCP-Readonly, X-MCP-Toolsets, X-MCP-Tools, X-MCP-Exclude-Tools, X-MCP-Features, X-MCP-Lockdown, X-MCP-Insiders, Mcp-Param-owner, Mcp-Param-repo"
+
+func TestSetCorsHeadersPreflight(t *testing.T) {
+	tests := []struct {
+		name                   string
+		requestedHeadersValues []string
+		expectedAllowedHeaders string
+	}{
+		{
+			name: "current MCP request headers",
+			requestedHeadersValues: []string{
+				"authorization, content-type, mcp-protocol-version, mcp-method, mcp-name, mcp-param-owner, mcp-param-repo",
+			},
+			expectedAllowedHeaders: fixedAllowedRequestHeaders,
+		},
+		{
+			name:                   "future projected parameter",
+			requestedHeadersValues: []string{"Mcp-Param-region"},
+			expectedAllowedHeaders: fixedAllowedRequestHeaders + ", Mcp-Param-Region",
+		},
+		{
+			name: "mixed case duplicates across values",
+			requestedHeadersValues: []string{
+				"mCp-PaRaM-ReGiOn, MCP-PARAM-ZONE",
+				"MCP-PARAM-REGION, mcp-param-zone",
+			},
+			expectedAllowedHeaders: fixedAllowedRequestHeaders + ", Mcp-Param-Region, Mcp-Param-Zone",
+		},
+		{
+			name: "invalid unrelated bare and lookalike names",
+			requestedHeadersValues: []string{
+				"Mcp-Param-, X-Evil, XMcp-Param-region, Mcp_Param-region, Mcp-Param-\x00region, Mcp-Param-bad name",
+			},
+			expectedAllowedHeaders: fixedAllowedRequestHeaders,
+		},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			innerCalled := false
+			handler := middleware.SetCorsHeaders(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
+				innerCalled = true
+			}))
+			req := httptest.NewRequest(http.MethodOptions, "/", nil)
+			req.Header.Set("Origin", "https://confer.to")
+			req.Header.Set("Access-Control-Request-Method", http.MethodPost)
+			for _, value := range tt.requestedHeadersValues {
+				req.Header.Add("Access-Control-Request-Headers", value)
+			}
+			rr := httptest.NewRecorder()
+
+			handler.ServeHTTP(rr, req)
+
+			assert.Equal(t, http.StatusOK, rr.Code)
+			assert.False(t, innerCalled)
+			assert.Equal(t, "*", rr.Header().Get("Access-Control-Allow-Origin"))
+			assert.Empty(t, rr.Header().Get("Access-Control-Allow-Credentials"))
+			assert.Equal(t, "GET, POST, DELETE, OPTIONS", rr.Header().Get("Access-Control-Allow-Methods"))
+			assert.Equal(t, "86400", rr.Header().Get("Access-Control-Max-Age"))
+			assert.Equal(t, tt.expectedAllowedHeaders, rr.Header().Get("Access-Control-Allow-Headers"))
+			assert.Equal(t, "Mcp-Session-Id, WWW-Authenticate", rr.Header().Get("Access-Control-Expose-Headers"))
+			assert.NotContains(t, rr.Header().Get("Access-Control-Expose-Headers"), "Mcp-Param-")
+		})
+	}
+}
+
+func TestSetCorsHeadersPreflightBoundsProjectedHeaders(t *testing.T) {
+	const (
+		maxProjectedHeaders = 64
+		requestedHeaders    = 1024
+	)
+
+	requested := make([]string, 0, requestedHeaders*2)
+	expected := strings.Split(fixedAllowedRequestHeaders, ", ")
+	for i := range requestedHeaders {
+		header := fmt.Sprintf("mcp-param-%04d", i)
+		requested = append(requested, header, strings.ToUpper(header))
+		if i < maxProjectedHeaders {
+			expected = append(expected, http.CanonicalHeaderKey(header))
+		}
+	}
+	requestedValue := strings.Join(requested, ", ")
+
+	handler := middleware.SetCorsHeaders(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
+		t.Fatal("preflight reached the inner handler")
+	}))
+	req := httptest.NewRequest(http.MethodOptions, "/", nil)
+	req.Header.Set("Access-Control-Request-Headers", requestedValue)
+	rr := httptest.NewRecorder()
+
+	handler.S
```

**File**: `pkg/http/server_test.go` (modified, +22/-19)
```diff
@@ -106,26 +106,29 @@ func TestHTTPRouterCORSContract(t *testing.T) {
 	)
 
 	tests := []struct {
-		name              string
-		method            string
-		path              string
-		expectedStatus    int
-		expectChallenge   bool
-		expectAllowHeader bool
+		name            string
+		method          string
+		path            string
+		requestHeaders  string
+		expectedStatus  int
+		expectChallenge bool
+		expectedAllow   []string
 	}{
 		{
-			name:              "MCP preflight",
-			method:            http.MethodOptions,
-			path:              "/",
-			expectedStatus:    http.StatusOK,
-			expectAllowHeader: true,
+			name:           "MCP preflight",
+			method:         http.MethodOptions,
+			path:           "/",
+			requestHeaders: "content-type, mcp-method, mcp-name, mcp-param-owner, mcp-param-region",
+			expectedStatus: http.StatusOK,
+			expectedAllow:  []string{"Content-Type", "Mcp-Method", "Mcp-Name", "Mcp-Param-owner", "Mcp-Param-Region"},
 		},
 		{
-			name:              "metadata preflight",
-			method:            http.MethodOptions,
-			path:              "/metadata",
-			expectedStatus:    http.StatusOK,
-			expectAllowHeader: true,
+			name:           "metadata preflight",
+			method:         http.MethodOptions,
+			path:           "/metadata",
+			requestHeaders: "content-type",
+			expectedStatus: http.StatusOK,
+			expectedAllow:  []string{"Content-Type"},
 		},
 		{
 			name:            "authentication challenge",
@@ -166,7 +169,7 @@ func TestHTTPRouterCORSContract(t *testing.T) {
 			req.Header.Set("Origin", "https://confer.to")
 			if tt.method == http.MethodOptions {
 				req.Header.Set("Access-Control-Request-Method", http.MethodPost)
-				req.Header.Set("Access-Control-Request-Headers", "content-type")
+				req.Header.Set("Access-Control-Request-Headers", tt.requestHeaders)
 			}
 
 			rec := httptest.NewRecorder()
@@ -177,8 +180,8 @@ func TestHTTPRouterCORSContract(t *testing.T) {
 			assert.Empty(t, rec.Header().Get("Access-Control-Allow-Credentials"))
 			assert.Contains(t, rec.Header().Get("Access-Control-Expose-Headers"), "Mcp-Session-Id")
 			assert.Contains(t, rec.Header().Get("Access-Control-Expose-Headers"), "WWW-Authenticate")
-			if tt.expectAllowHeader {
-				assert.Contains(t, rec.Header().Get("Access-Control-Allow-Headers"), "Content-Type")
+			for _, header := range tt.expectedAllow {
+				assert.Contains(t, rec.Header().Get("Access-Control-Allow-Headers"), header)
 			}
 			if tt.expectChallenge {
 				assert.Equal(t,
```

---

### Incident Patch 6: `7b6646c3` (2026-09-01)
**Commit Message**: fix(issues): report silently dropped labels (#3195)

Compare requested labels with the authoritative issue returned by create and update writes, and return a precise partial-failure result when GitHub omits them.

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>

**File**: `pkg/github/issues.go` (modified, +56/-0)
```diff
@@ -2941,6 +2941,50 @@ func resolveIssueTypeID(ctx context.Context, client *github.Client, owner, repo,
 	return "", resp, fmt.Errorf("issue type %q was not found in %s/%s", issueTypeName, owner, repo)
 }
 
+func unappliedIssueLabelsError(requested []string, issue *github.Issue) error {
+	applied := make([]string, 0, len(issue.Labels))
+	for _, label := range issue.Labels {
+		if label != nil {
+			applied = append(applied, label.GetName())
+		}
+	}
+
+	missing := issueLabelDifference(requested, applied)
+	unexpected := issueLabelDifference(applied, requested)
+	if len(missing) == 0 && len(unexpected) == 0 {
+		return nil
+	}
+
+	return fmt.Errorf(
+		"requested=%q, applied=%q, missing=%q, unexpected=%q, issue_url=%q; the caller may lack AddLabelsToLabelable permission",
+		requested,
+		applied,
+		missing,
+		unexpected,
+		issue.GetHTMLURL(),
+	)
+}
+
+func issueLabelDifference(labels, other []string) []string {
+	var difference []string
+	for _, label := range labels {
+		if containsIssueLabel(other, label) || containsIssueLabel(difference, label) {
+			continue
+		}
+		difference = append(difference, label)
+	}
+	return difference
+}
+
+func containsIssueLabel(labels []string, target string) bool {
+	for _, label := range labels {
+		if strings.EqualFold(label, target) {
+			return true
+		}
+	}
+	return false
+}
+
 func CreateIssue(ctx context.Context, client *github.Client, owner string, repo string, title string, body string, assignees []string, labels []string, milestoneNum int, issueType string, issueFieldValues []*github.IssueRequestFieldValue) (*mcp.CallToolResult, error) {
 	if title == "" {
 		return utils.NewToolResultError("missing required parameter: title"), nil
@@ -2981,6 +3025,12 @@ func CreateIssue(ctx context.Context, client *github.Client, owner string, repo
 		return ghErrors.NewGitHubAPIStatusErrorResponse(ctx, "failed to create issue", resp, body), nil
 	}
 
+	if len(labels) > 0 {
+		if err := unappliedIssueLabelsError(labels, issue); err != nil {
+			return ghErrors.NewGitHubAPIErrorResponse(ctx, "issue created but requested labels were not fully applied", resp, err), nil
+		}
+	}
+
 	// Return minimal response with just essential information
 	minimalResponse := MinimalResponse{
 		ID:  fmt.Sprintf("%d", issue.GetID()),
@@ -3206,6 +3256,12 @@ func UpdateIssue(ctx context.Context, client *github.Client, gqlClient *githubv4
 		}
 	}
 
+	if updateOptions.LabelsProvided {
+		if err := unappliedIssueLabelsError(labels, updatedIssue); err != nil {
+			return ghErrors.NewGitHubAPIErrorResponse(ctx, "issue updated but requested labels were not fully applied", resp, err), nil
+		}
+	}
+
 	// Return minimal response with just essential information
 	minimalResponse := MinimalResponse{
 		ID:  fmt.Sprintf("%d", updatedIssue.GetID()),
```

**File**: `pkg/github/issues_test.go` (modified, +106/-0)
```diff
@@ -2090,6 +2090,112 @@ func Test_CreateIssue(t *testing.T) {
 	}
 }
 
+func TestIssueWriteReportsUnappliedLabels(t *testing.T) {
+	tests := []struct {
+		name               string
+		method             string
+		requestedLabels    []string
+		appliedLabels      []string
+		expectedMissing    string
+		expectedUnexpected string
+	}{
+		{
+			name:               "create reports partially applied labels",
+			method:             "create",
+			requestedLabels:    []string{"bug", "enhancement"},
+			appliedLabels:      []string{"bug"},
+			expectedMissing:    `missing=["enhancement"]`,
+			expectedUnexpected: "unexpected=[]",
+		},
+		{
+			name:               "update reports silently dropped labels",
+			method:             "update",
+			requestedLabels:    []string{"enhancement"},
+			appliedLabels:      []string{"existing"},
+			expectedMissing:    `missing=["enhancement"]`,
+			expectedUnexpected: `unexpected=["existing"]`,
+		},
+		{
+			name:               "update reports labels that were not cleared",
+			method:             "update",
+			requestedLabels:    []string{},
+			appliedLabels:      []string{"existing"},
+			expectedMissing:    "missing=[]",
+			expectedUnexpected: `unexpected=["existing"]`,
+		},
+	}
+
+	for _, tc := range tests {
+		t.Run(tc.name, func(t *testing.T) {
+			responseLabels := make([]*github.Label, 0, len(tc.appliedLabels))
+			for _, label := range tc.appliedLabels {
+				responseLabels = append(responseLabels, &github.Label{Name: label})
+			}
+			responseIssue := &github.Issue{
+				ID:      github.Ptr(int64(123)),
+				Number:  github.Ptr(123),
+				HTMLURL: github.Ptr("https://github.com/owner/repo/issues/123"),
+				Labels:  responseLabels,
+			}
+
+			endpoint := PostReposIssuesByOwnerByRepo
+			status := http.StatusCreated
+			if tc.method == "update" {
+				endpoint = PatchReposIssuesByOwnerByRepoByIssueNumber
+				status = http.StatusOK
+			}
+			restHTTPClient := MockHTTPClientWithHandlers(map[string]http.HandlerFunc{
+				endpoint: mockResponse(t, status, responseIssue),
+			})
+			restRequests := &requestCountingTransport{inner: restHTTPClient.Transport}
+			restHTTPClient.Transport = restRequests
+
+			gqlHTTPClient := githubv4mock.NewMockedHTTPClient()
+			gqlRequests := &requestCountingTransport{inner: gqlHTTPClient.Transport}
+			gqlHTTPClient.Transport = gqlRequests
+
+			requestLabels := make([]any, len(tc.requestedLabels))
+			for i, label := range tc.requestedLabels {
+				requestLabels[i] = label
+			}
+			requestArgs := map[string]any{
+				"method": tc.method,
+				"owner":  "owner",
+				"repo":   "repo",
+				"labels": requestLabels,
+			}
+			if tc.method == "create" {
+				requestArgs["title"] = "Test issue"
+			} else {
+				requestArgs["issue_number"] = float64(123)
+			}
+
+			deps := BaseDeps{
+				Client:    mustNewGHClient(t, restHTTPClient),
+				GQLClient: githubv4.NewClient(gqlHTTPClient),
+			}
+			serverTool := IssueWrite(translations.NullTranslationHelper)
+			handler := serverTool.Handler(deps)
+			request := createMCPRequest(requestArgs)
+
+			result, err := handler(ContextWithDeps(context.Background(), deps), &request)
+			require.NoError(t, err)
+			require.True(t, result.IsError)
+			assert.Equal(t, 1, restRequests.count, "label verification must use the write response without a readback")
+			assert.Zero(t, gqlRequests.count, "label verification must not make a GraphQL readback")
+
+			resultText := getErrorResult(t, result).Text
+			assert.Contains(t, resultText, "issue "+tc.method+"d but requested labels were not fully applied")
+			assert.Contains(t, resultText, fmt.Sprintf("requested=%q", tc.requestedLabels))
+			assert.Contains(t, resultText, fmt.Sprintf("applied=%q", tc.appliedLabels))
+			assert.Contains(t, resultText, tc.expectedMissing)
+			assert.Contains(t, resultText, tc.expectedUnexpected)
+			assert.Contains(t, resultText, `issue_url="https://github.com/owner/repo/issues/123"`)
+			assert.Contains(t, resultText, "AddLabelsToLabelable permi
```

---

### Incident Patch 7: `4ee45940` (2026-09-01)
**Commit Message**: Fix e2e harness compilation against go-github v89 and go-sdk v1.7 (#3187)

* Fix e2e harness compilation against go-github v89 and go-sdk v1.7

The e2e test package no longer compiled under --tags e2e because it
lagged behind two dependency migrations:

- go-github v89: NewClient now returns (*Client, error) and
  WithEnterpriseURLs moved from a *Client method to a
  ClientOptionsFunc. Update getRESTClient and the inline cleanup
  call sites, and drop the trailing nil options arg from
  ListReviewers.

- go-sdk v1.7: ghmcp.NewMCPServer(MCPServerConfig) was replaced by
  ghmcp.NewStdioMCPServer(ctx, github.MCPServerConfig). Update the
  in-process setupMCPClient branch accordingly, supplying the required
  Logger and Version fields.

* fix(e2e): align client host resolution

Reuse the server API host resolver so GHEC REST and upload clients target the correct subdomains. Add token-free coverage for host URL resolution and the in-process stdio server lifecycle.

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>

---------

Co-authored-by: ppoffice <8849362+ppoffice@users.noreply.github.com>
Co-authored-by: Sam Morrow <sammorrowdrums@github.com>
Co-authored-by: 

**File**: `e2e/e2e_test.go` (modified, +114/-15)
```diff
@@ -6,6 +6,7 @@ import (
 	"context"
 	"encoding/json"
 	"fmt"
+	"log/slog"
 	"net/http"
 	"os"
 	"os/exec"
@@ -18,6 +19,7 @@ import (
 	"github.com/github/github-mcp-server/internal/ghmcp"
 	"github.com/github/github-mcp-server/pkg/github"
 	"github.com/github/github-mcp-server/pkg/translations"
+	"github.com/github/github-mcp-server/pkg/utils"
 	gogithub "github.com/google/go-github/v89/github"
 	"github.com/modelcontextprotocol/go-sdk/mcp"
 	"github.com/stretchr/testify/require"
@@ -62,21 +64,116 @@ func getE2EHost() string {
 }
 
 func getRESTClient(t *testing.T) *gogithub.Client {
-	// Get token and ensure Docker image is built
-	token := getE2EToken(t)
+	ghClient, err := newRESTClient(getE2EToken(t), getE2EHost())
+	require.NoError(t, err, "expected to create GitHub client successfully")
 
-	// Create a new GitHub client with the token
-	ghClient := gogithub.NewClient(nil).WithAuthToken(token)
+	return ghClient
+}
 
-	if host := getE2EHost(); host != "" && host != "https://github.com" {
-		var err error
-		// Currently this works for GHEC because the API is exposed at the api subdomain and the path prefix
-		// but it would be preferable to extract the host parsing from the main server logic, and use it here.
-		ghClient, err = ghClient.WithEnterpriseURLs(host, host)
-		require.NoError(t, err, "expected to create GitHub client with host")
+func newRESTClient(token, host string) (*gogithub.Client, error) {
+	apiHost, err := utils.NewAPIHost(host)
+	if err != nil {
+		return nil, fmt.Errorf("failed to parse API host: %w", err)
 	}
 
-	return ghClient
+	restURL, err := apiHost.BaseRESTURL(context.Background())
+	if err != nil {
+		return nil, fmt.Errorf("failed to get base REST URL: %w", err)
+	}
+
+	uploadURL, err := apiHost.UploadURL(context.Background())
+	if err != nil {
+		return nil, fmt.Errorf("failed to get upload URL: %w", err)
+	}
+
+	return gogithub.NewClient(
+		gogithub.WithAuthToken(token),
+		gogithub.WithEnterpriseURLs(restURL.String(), uploadURL.String()),
+	)
+}
+
+func TestRESTClientURLs(t *testing.T) {
+	t.Parallel()
+
+	tests := []struct {
+		name          string
+		host          string
+		wantBaseURL   string
+		wantUploadURL string
+	}{
+		{
+			name:          "dotcom default",
+			wantBaseURL:   "https://api.github.com/",
+			wantUploadURL: "https://uploads.github.com/",
+		},
+		{
+			name:          "dotcom explicit",
+			host:          "https://github.com",
+			wantBaseURL:   "https://api.github.com/",
+			wantUploadURL: "https://uploads.github.com/",
+		},
+		{
+			name:          "GHEC",
+			host:          "https://example.ghe.com",
+			wantBaseURL:   "https://api.example.ghe.com/",
+			wantUploadURL: "https://uploads.example.ghe.com/",
+		},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			t.Parallel()
+
+			client, err := newRESTClient("test-token", tt.host)
+			require.NoError(t, err)
+			require.Equal(t, tt.wantBaseURL, client.BaseURL())
+			require.Equal(t, tt.wantUploadURL, client.UploadURL())
+		})
+	}
+}
+
+func TestInProcessStdioServer(t *testing.T) {
+	t.Parallel()
+
+	ctx, cancel := context.WithCancel(context.Background())
+	t.Cleanup(cancel)
+
+	server, err := ghmcp.NewStdioMCPServer(ctx, github.MCPServerConfig{
+		Version:         "e2e-test",
+		Token:           "test-token",
+		EnabledToolsets: []string{"context"},
+		Translator:      translations.NullTranslationHelper,
+		Logger:          slog.New(slog.DiscardHandler),
+	})
+	require.NoError(t, err)
+
+	serverTransport, clientTransport := mcp.NewInMemoryTransports()
+	serverErr := make(chan error, 1)
+	go func() {
+		serverErr <- server.Run(ctx, serverTransport)
+	}()
+
+	client := mcp.NewClient(&mcp.Implementation{
+		Name:    "e2e-test-client",
+		Version: "0.0.1",
+	}, nil)
+	session, err := client.Connect(ctx, clientTransport, nil)
+	require.NoError(t, err)
+	t.Cleanup(func() { _ = session.Close() })
+
+	tools, err := session.ListTools(ctx, nil)
+	require.NoError(t, err)
+	require.True(t, slices.Cont
```

---

### Incident Patch 8: `198bc16b` (2026-09-01)
**Commit Message**: fix: allow public_repo for public contribution tools (#3140)

* fix: allow public_repo for contribution tools

* test: tighten public repo scope coverage

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>

* fix: separate public repo visibility from OAuth scopes

Keep public_repo as a fixed-token visibility capability while requiring repo for per-call OAuth challenges. Challenge only missing scopes for workflow pushes.

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>

---------

Co-authored-by: Paulcake <171492698+paulcakeface@users.noreply.github.com>
Co-authored-by: Sam Morrow <sammorrowdrums@github.com>
Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>

**File**: `pkg/github/issues.go` (modified, +2/-2)
```diff
@@ -1403,7 +1403,7 @@ func AddIssueComment(t translations.TranslationHelperFunc) inventory.ServerTool
 				Required: []string{"owner", "repo", "issue_number"},
 			},
 		},
-		scopes.RequireAll(scopes.Repo),
+		publicRepositoryWriteScopeAccess(),
 		func(ctx context.Context, deps ToolDependencies, _ *mcp.CallToolRequest, args map[string]any) (*mcp.CallToolResult, any, error) {
 			owner, err := RequiredParam[string](args, "owner")
 			if err != nil {
@@ -2524,7 +2524,7 @@ Options are:
 				Required: []string{"method", "owner", "repo"},
 			},
 		},
-		scopes.RequireAll(scopes.Repo),
+		publicRepositoryWriteScopeAccess(),
 		func(ctx context.Context, deps ToolDependencies, req *mcp.CallToolRequest, args map[string]any) (*mcp.CallToolResult, any, error) {
 			method, err := RequiredParam[string](args, "method")
 			if err != nil {
```

**File**: `pkg/github/public_repo_scopes_test.go` (added, +103/-0)
```diff
@@ -0,0 +1,103 @@
+package github
+
+import (
+	"testing"
+
+	"github.com/github/github-mcp-server/pkg/inventory"
+	"github.com/github/github-mcp-server/pkg/scopes"
+	"github.com/github/github-mcp-server/pkg/translations"
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+)
+
+func TestPublicRepoContributionToolScopeAccess(t *testing.T) {
+	t.Parallel()
+
+	tools := []struct {
+		name string
+		tool inventory.ServerTool
+	}{
+		{name: "fork_repository", tool: ForkRepository(translations.NullTranslationHelper)},
+		{name: "create_branch", tool: CreateBranch(translations.NullTranslationHelper)},
+		{name: "create_pull_request", tool: CreatePullRequest(translations.NullTranslationHelper)},
+		{name: "issue_write", tool: IssueWrite(translations.NullTranslationHelper)},
+		{name: "add_issue_comment", tool: AddIssueComment(translations.NullTranslationHelper)},
+	}
+
+	for _, tt := range tools {
+		t.Run(tt.name, func(t *testing.T) {
+			assert.Equal(t, []string{string(scopes.Repo)}, tt.tool.ScopeAccess.Scopes)
+			require.NotNil(t, tt.tool.ScopeAccess.Visible)
+			assert.False(t, tt.tool.ScopeAccess.Visible(nil))
+			assert.True(t, tt.tool.ScopeAccess.Visible([]string{string(scopes.PublicRepo)}))
+			assert.True(t, tt.tool.ScopeAccess.Visible([]string{string(scopes.Repo)}))
+
+			require.NotNil(t, tt.tool.ScopeAccess.Challenge)
+			assert.Equal(t, []string{string(scopes.Repo)}, tt.tool.ScopeAccess.Challenge(nil, nil))
+			assert.Equal(t, []string{string(scopes.Repo)}, tt.tool.ScopeAccess.Challenge(nil, []string{string(scopes.PublicRepo)}))
+			assert.Empty(t, tt.tool.ScopeAccess.Challenge(nil, []string{string(scopes.Repo)}))
+		})
+	}
+}
+
+func TestPublicRepoContributionToolsVisibleToPATs(t *testing.T) {
+	t.Parallel()
+
+	tools := []inventory.ServerTool{
+		ForkRepository(translations.NullTranslationHelper),
+		CreateBranch(translations.NullTranslationHelper),
+		PushFiles(translations.NullTranslationHelper),
+		CreatePullRequest(translations.NullTranslationHelper),
+		IssueWrite(translations.NullTranslationHelper),
+		AddIssueComment(translations.NullTranslationHelper),
+	}
+
+	tests := []struct {
+		name        string
+		tokenScopes []string
+		wantVisible bool
+	}{
+		{name: "no scopes"},
+		{name: "public_repo", tokenScopes: []string{string(scopes.PublicRepo)}, wantVisible: true},
+		{name: "repo", tokenScopes: []string{string(scopes.Repo)}, wantVisible: true},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			filter := CreateToolScopeFilter(tt.tokenScopes)
+			for i := range tools {
+				included, err := filter(t.Context(), &tools[i])
+				require.NoError(t, err)
+				assert.Equal(t, tt.wantVisible, included, tools[i].Tool.Name)
+			}
+		})
+	}
+}
+
+func TestPushFilesOAuthScopeChallenges(t *testing.T) {
+	t.Parallel()
+
+	tool := PushFiles(translations.NullTranslationHelper)
+	regularFiles := map[string]any{
+		"files": []any{map[string]any{"path": "README.md"}},
+	}
+	workflowFiles := map[string]any{
+		"files": []any{map[string]any{"path": ".github/workflows/ci.yml"}},
+	}
+
+	assert.Equal(t, []string{string(scopes.Repo), string(scopes.Workflow)}, tool.ScopeAccess.Scopes)
+	require.NotNil(t, tool.ScopeAccess.Visible)
+	assert.True(t, tool.ScopeAccess.Visible([]string{string(scopes.PublicRepo)}))
+	assert.True(t, tool.ScopeAccess.Visible([]string{string(scopes.Repo)}))
+
+	assert.Equal(t, []string{string(scopes.Repo)}, tool.ScopeAccess.Challenge(regularFiles, nil))
+	assert.Equal(t, []string{string(scopes.Repo)}, tool.ScopeAccess.Challenge(regularFiles, []string{string(scopes.PublicRepo)}))
+	assert.Empty(t, tool.ScopeAccess.Challenge(regularFiles, []string{string(scopes.Repo)}))
+
+	assert.Equal(t, []string{string(scopes.Repo), string(scopes.Workflow)}, tool.ScopeAccess.Challenge(workflowFiles, nil))
+	assert.Equal(t, []string{string(scopes.Repo), string(scopes.Workflow)}, tool.ScopeAccess.Challenge(workflowFiles, []string{string(scopes.PublicRepo)}))
+	assert.Equal(
```

**File**: `pkg/github/pullrequests.go` (modified, +1/-1)
```diff
@@ -706,7 +706,7 @@ func CreatePullRequest(t translations.TranslationHelperFunc) inventory.ServerToo
 				Required: []string{"owner", "repo", "title", "head", "base"},
 			},
 		},
-		scopes.RequireAll(scopes.Repo),
+		publicRepositoryWriteScopeAccess(),
 		func(ctx context.Context, deps ToolDependencies, req *mcp.CallToolRequest, args map[string]any) (*mcp.CallToolResult, any, error) {
 			owner, err := RequiredParam[string](args, "owner")
 			if err != nil {
```

**File**: `pkg/github/repositories.go` (modified, +3/-3)
```diff
@@ -1232,7 +1232,7 @@ func ForkRepository(t translations.TranslationHelperFunc) inventory.ServerTool {
 				Required: []string{"owner", "repo"},
 			},
 		},
-		scopes.RequireAll(scopes.Repo),
+		publicRepositoryWriteScopeAccess(),
 		func(ctx context.Context, deps ToolDependencies, _ *mcp.CallToolRequest, args map[string]any) (*mcp.CallToolResult, any, error) {
 			owner, err := RequiredParam[string](args, "owner")
 			if err != nil {
@@ -1529,7 +1529,7 @@ func CreateBranch(t translations.TranslationHelperFunc) inventory.ServerTool {
 				Required: []string{"owner", "repo", "branch"},
 			},
 		},
-		scopes.RequireAll(scopes.Repo),
+		publicRepositoryWriteScopeAccess(),
 		func(ctx context.Context, deps ToolDependencies, _ *mcp.CallToolRequest, args map[string]any) (*mcp.CallToolResult, any, error) {
 			owner, err := RequiredParam[string](args, "owner")
 			if err != nil {
@@ -1661,7 +1661,7 @@ func PushFiles(t translations.TranslationHelperFunc) inventory.ServerTool {
 				Required: []string{"owner", "repo", "branch", "files", "message"},
 			},
 		},
-		scopes.RequireAll(scopes.Repo),
+		publicRepositoryWriteScopeAccess(),
 		func(ctx context.Context, deps ToolDependencies, _ *mcp.CallToolRequest, args map[string]any) (*mcp.CallToolResult, any, error) {
 			owner, err := RequiredParam[string](args, "owner")
 			if err != nil {
```

**File**: `pkg/github/repository_path.go` (modified, +7/-3)
```diff
@@ -75,8 +75,12 @@ func workflowScopeChallengeForFiles(arguments map[string]any, activeScopes []str
 			containsWorkflow = true
 		}
 	}
-	if containsWorkflow {
-		return scopes.ChallengeAll(activeScopes, scopes.Repo, scopes.Workflow)
+	var challenge []string
+	if !scopes.HasAll(activeScopes, scopes.Repo) {
+		challenge = append(challenge, string(scopes.Repo))
 	}
-	return scopes.ChallengeAll(activeScopes, scopes.Repo)
+	if containsWorkflow && !scopes.HasAll(activeScopes, scopes.Workflow) {
+		challenge = append(challenge, string(scopes.Workflow))
+	}
+	return challenge
 }
```

---

### Incident Patch 9: `5a3c558b` (2026-09-01)
**Commit Message**: fix(repos): give create_or_update_file callers a SHA they can actually get (#3131)

* fix(repos): give create_or_update_file callers a SHA they can actually get

The create_or_update_file tool description and both of its SHA errors told
the caller to run `git rev-parse <branch>:<path>`. The caller is an MCP
client talking to the GitHub API, and the same description tells it not to
use this tool for local file operations, so it has no working tree to run
that command against.

Point the description at get_file_contents instead, which returns the blob
SHA over the API. In the already-exists error the server has just fetched
the file, so return that SHA directly rather than asking for a round trip.
The stale-SHA error already interpolates the current SHA, so it only needed
the impossible instruction removed.

* fix(repos): stop disclosing the blob SHA when no sha was supplied

The already-exists path is reached only when the caller sent no sha, so
it has not read the file. Returning the current blob SHA there let it
overwrite content it never saw on the next call, which is the race the
SHA gate exists to prevent. Send the caller to get_file_contents for the
path and ref instead, so ob

**File**: `README.md` (modified, +1/-1)
```diff
@@ -1272,7 +1272,7 @@ The following sets of tools are available:
   - `owner`: Repository owner (username or organization) (string, required)
   - `path`: Path where to create/update the file (string, required)
   - `repo`: Repository name (string, required)
-  - `sha`: The blob SHA of the file being replaced. Required if the file already exists. (string, optional)
+  - `sha`: The blob SHA of the file being replaced. Required if the file already exists. Retrieve it with get_file_contents using the same owner, repo, and path, with ref set to this tool's branch value. (string, optional)
 
 - **create_repository** - Create repository
   - **OAuth Challenge Scopes**: `repo`
```

**File**: `docs/feature-flags.md` (modified, +1/-1)
```diff
@@ -357,7 +357,7 @@ runtime behavior (such as output formatting) won't appear here.
 ### `thread_resolution_reason`
 
 - **pull_request_review_write** - Write operations (create, submit, delete) on pull request reviews
-  - **Required OAuth Scopes**: `repo`
+  - **OAuth Challenge Scopes**: `repo`
   - `body`: Review comment text (string, optional)
   - `commitID`: SHA of commit to review (string, optional)
   - `event`: Review action to perform. (string, optional)
```

**File**: `pkg/github/__toolsnaps__/create_or_update_file.snap` (modified, +2/-2)
```diff
@@ -4,7 +4,7 @@
     "readOnlyHint": false,
     "title": "Create or update file"
   },
-  "description": "Create or update a single file in a GitHub repository. \nIf updating, you should provide the SHA of the file you want to update. Use this tool to create or update a file in a GitHub repository remotely; do not use it for local file operations.\n\nIn order to obtain the SHA of original file version before updating, use the following git command:\ngit rev-parse \u003cbranch\u003e:\u003cpath to file\u003e\n\nSHA MUST be provided for existing file updates.\n",
+  "description": "Create or update a single file in a GitHub repository. \nIf updating, you should provide the SHA of the file you want to update. Use this tool to create or update a file in a GitHub repository remotely; do not use it for local file operations.\n\nTo obtain the current blob SHA before updating, call the get_file_contents tool with the same owner, repo, and path, and set its ref parameter to this tool's branch value. The first text result reports the blob SHA for the requested path.\n\nSHA MUST be provided for existing file updates.\n",
   "inputSchema": {
     "properties": {
       "allow_symlink_write": {
@@ -37,7 +37,7 @@
         "type": "string"
       },
       "sha": {
-        "description": "The blob SHA of the file being replaced. Required if the file already exists.",
+        "description": "The blob SHA of the file being replaced. Required if the file already exists. Retrieve it with get_file_contents using the same owner, repo, and path, with ref set to this tool's branch value.",
         "type": "string"
       }
     },
```

**File**: `pkg/github/repositories.go` (modified, +10/-7)
```diff
@@ -412,8 +412,7 @@ func CreateOrUpdateFile(t translations.TranslationHelperFunc) inventory.ServerTo
 			Description: t("TOOL_CREATE_OR_UPDATE_FILE_DESCRIPTION", `Create or update a single file in a GitHub repository. 
 If updating, you should provide the SHA of the file you want to update. Use this tool to create or update a file in a GitHub repository remotely; do not use it for local file operations.
 
-In order to obtain the SHA of original file version before updating, use the following git command:
-git rev-parse <branch>:<path to file>
+To obtain the current blob SHA before updating, call the get_file_contents tool with the same owner, repo, and path, and set its ref parameter to this tool's branch value. The first text result reports the blob SHA for the requested path.
 
 SHA MUST be provided for existing file updates.
 `),
@@ -450,7 +449,7 @@ SHA MUST be provided for existing file updates.
 					},
 					"sha": {
 						Type:        "string",
-						Description: "The blob SHA of the file being replaced. Required if the file already exists.",
+						Description: "The blob SHA of the file being replaced. Required if the file already exists. Retrieve it with get_file_contents using the same owner, repo, and path, with ref set to this tool's branch value.",
 					},
 					"allow_symlink_write": {
 						Type:        "boolean",
@@ -551,8 +550,10 @@ SHA MUST be provided for existing file updates.
 					if currentSHA != sha {
 						return utils.NewToolResultError(fmt.Sprintf(
 							"SHA mismatch: provided SHA %s is stale. Current file SHA is %s. "+
-								"Pull the latest changes and use git rev-parse %s:%s to get the current SHA.",
-							sha, currentSHA, branch, path)), nil, nil
+								"The file changed since you read it. Call get_file_contents with owner=%q, repo=%q, path=%q, and ref=%q; "+
+								"its first text result reports the blob SHA for the requested path. "+
+								"Rebuild your content against what it returns, and retry with the sha parameter set to the SHA that call reports.",
+							sha, currentSHA, owner, repo, path, branch)), nil, nil
 					}
 					if !allowSymlinkWrite {
 						if existingFile.GetType() == "symlink" {
@@ -596,8 +597,10 @@ SHA MUST be provided for existing file updates.
 					// File exists but no SHA was provided - reject to prevent blind overwrites
 					return utils.NewToolResultError(fmt.Sprintf(
 						"File already exists at %s. You must provide the current file's SHA when updating. "+
-							"Use git rev-parse %s:%s to get the blob SHA, then retry with the sha parameter.",
-						path, branch, path)), nil, nil
+							"Call get_file_contents with owner=%q, repo=%q, path=%q, and ref=%q to read the file you are about to overwrite; "+
+							"its first text result reports the blob SHA for the requested path. "+
+							"Then retry with the sha parameter set to the blob SHA that call reports.",
+						path, owner, repo, path, branch)), nil, nil
 				}
 				// If file not found, no previous SHA needed (new file creation)
 			}
```

**File**: `pkg/github/repositories_test.go` (modified, +95/-13)
```diff
@@ -170,6 +170,7 @@ func Test_GetFileContents(t *testing.T) {
 				Text:     "# Test Repository\n\nThis is a test repository.",
 				MIMEType: "text/plain; charset=utf-8",
 			},
+			expectedMsg: "SHA: " + gitBlobSHA(mockRawContent),
 		},
 		{
 			name: "successful binary file content fetch (PNG)",
@@ -625,6 +626,7 @@ func Test_GetFileContents_SymlinkDisclosure(t *testing.T) {
 			metadata := repositoryPathMetadataFromResult(t, result)
 			assert.Equal(t, "symlink", metadata.Type)
 			assert.Equal(t, "docs/link", metadata.Path)
+			assert.Equal(t, linkSHA, metadata.SHA)
 			assert.Equal(t, target, metadata.Target)
 			assert.Equal(t, "target/"+tc.name, metadata.ResolvedTargetPath)
 			assert.Equal(t, "dereferenced_target", metadata.Content)
@@ -649,6 +651,7 @@ func Test_GetFileContents_SymlinkDisclosure(t *testing.T) {
 		require.False(t, result.IsError)
 		assert.Equal(t, 1, requests)
 		metadata := repositoryPathMetadataFromResult(t, result)
+		assert.Equal(t, gitBlobSHA([]byte(target)), metadata.SHA)
 		assert.Equal(t, target, metadata.Target)
 		assert.Empty(t, metadata.ResolvedTargetPath)
 		assert.Equal(t, "not_returned", metadata.Content)
@@ -2057,6 +2060,9 @@ func Test_CreateOrUpdateFile(t *testing.T) {
 
 	assert.Equal(t, "create_or_update_file", tool.Name)
 	assert.NotEmpty(t, tool.Description)
+	assert.NotContains(t, tool.Description, "git rev-parse")
+	assert.Contains(t, tool.Description, "get_file_contents")
+	assert.Contains(t, tool.Description, "set its ref parameter to this tool's branch value")
 	assert.Contains(t, schema.Properties, "owner")
 	assert.Contains(t, schema.Properties, "repo")
 	assert.Contains(t, schema.Properties, "path")
@@ -2065,6 +2071,7 @@ func Test_CreateOrUpdateFile(t *testing.T) {
 	assert.Contains(t, schema.Properties, "branch")
 	assert.Contains(t, schema.Properties, "sha")
 	assert.Contains(t, schema.Properties, "allow_symlink_write")
+	assert.Contains(t, schema.Properties["sha"].Description, "with ref set to this tool's branch value")
 	assert.ElementsMatch(t, schema.Required, []string{"owner", "repo", "path", "content", "message", "branch"})
 
 	// Setup mock file content response
@@ -2135,6 +2142,7 @@ func Test_CreateOrUpdateFile(t *testing.T) {
 		expectedContent      *github.RepositoryContentResponse
 		expectedErrMsg       string
 		expectedErrMsgs      []string
+		unexpectedErrMsgs    []string
 		expectedRequestCount int
 	}{
 		{
@@ -2449,26 +2457,60 @@ func Test_CreateOrUpdateFile(t *testing.T) {
 		{
 			name: "sha validation - stale sha detected",
 			mockedClient: MockHTTPClientWithHandlers(map[string]http.HandlerFunc{
-				"GET /repos/owner/repo/contents/docs/example.md": mockResponse(t, http.StatusOK, &github.RepositoryContent{
-					SHA:  github.Ptr("newsha999888"),
-					Type: github.Ptr("file"),
+				"GET /repos/owner/repo/contents/docs/example.md": expectQueryParams(t, map[string]string{
+					"ref": "main",
+				}).andThen(mockResponse(t, http.StatusOK, &github.RepositoryContent{
+					SHA:    github.Ptr(symlinkSHA),
+					Type:   github.Ptr("symlink"),
+					Target: github.Ptr(string(symlinkTarget)),
+				})),
+				"GET /repos/{owner}/{repo}/contents/{path:.*}": expectQueryParams(t, map[string]string{
+					"ref": "main",
+				}).andThen(mockResponse(t, http.StatusOK, &github.RepositoryContent{
+					SHA:    github.Ptr(symlinkSHA),
+					Type:   github.Ptr("symlink"),
+					Target: github.Ptr(string(symlinkTarget)),
+				})),
+			}),
+			requestArgs: map[string]any{
+				"owner":   "owner",
+				"repo":    "repo",
+				"path":    "docs/example.md",
+				"content": "# Updated Example\n\nThis file has been updated.",
+				"message": "Update example file",
+				"branch":  "main",
+				"sha":     "oldsha123456",
+			},
+			expectError: true,
+			expectedErrMsgs: []string{
+				"SHA mismatch: provided SHA oldsha123456 is stale. Current file SHA is " + symlinkSHA,
+				`Call get_file_contents with owner="owner", repo="repo", path="docs/example.md", and ref="main"`,
+				
```

---

### Incident Patch 10: `f0baf1c8` (2026-08-25)
**Commit Message**: fix(auth): validate reviewer scope arguments

Defer OAuth challenges to normal handler validation when ui_get reviewer calls omit or malform the repository argument.

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>

**File**: `pkg/github/tool_scopes.go` (modified, +4/-1)
```diff
@@ -46,7 +46,10 @@ func uiGetScopeAccess() inventory.ScopeAccess {
 				return scopes.ChallengeAll(activeScopes, scopes.ReadOrg)
 			}
 			if method == "reviewers" {
-				return scopes.ChallengeAll(activeScopes, scopes.Repo, scopes.ReadOrg)
+				if repo, ok := arguments["repo"].(string); ok && repo != "" {
+					return scopes.ChallengeAll(activeScopes, scopes.Repo, scopes.ReadOrg)
+				}
+				return nil
 			}
 			switch method {
 			case "labels", "assignees", "milestones", "branches", "issue_fields":
```

**File**: `pkg/github/tool_scopes_test.go` (modified, +19/-1)
```diff
@@ -66,6 +66,20 @@ func TestConditionalToolScopeChecks(t *testing.T) {
 			allowed:    []string{"repo", "read:org"},
 			disallowed: []string{"repo"},
 		},
+		{
+			name:       "ui reviewers method without repository defers to validation",
+			tool:       UIGet(translations.NullTranslationHelper),
+			arguments:  map[string]any{"method": "reviewers", "owner": "octo"},
+			allowed:    nil,
+			disallowed: nil,
+		},
+		{
+			name:       "ui reviewers method with malformed repository defers to validation",
+			tool:       UIGet(translations.NullTranslationHelper),
+			arguments:  map[string]any{"method": "reviewers", "owner": "octo", "repo": 123},
+			allowed:    nil,
+			disallowed: nil,
+		},
 	}
 
 	for _, tt := range tests {
@@ -74,7 +88,11 @@ func TestConditionalToolScopeChecks(t *testing.T) {
 			assert.True(t, tt.tool.ScopeAccess.Dynamic)
 			assert.Equal(t, []string{"repo", "read:org"}, tt.tool.ScopeAccess.Scopes)
 			assert.Empty(t, tt.tool.ScopeAccess.Challenge(tt.arguments, tt.allowed))
-			assert.NotEmpty(t, tt.tool.ScopeAccess.Challenge(tt.arguments, tt.disallowed))
+			if tt.disallowed == nil {
+				assert.Empty(t, tt.tool.ScopeAccess.Challenge(tt.arguments, nil))
+			} else {
+				assert.NotEmpty(t, tt.tool.ScopeAccess.Challenge(tt.arguments, tt.disallowed))
+			}
 			assert.True(t, tt.tool.ScopeAccess.Visible(nil))
 		})
 	}
```

#### Recent Merged Pull Requests:
- **PR #3353** (closed): fix: Fix PR review tools (except `create_pull_request_review` which works already) when authenticated with a GitHub App installation token (S2S) (@Copilot)
- **PR #3333** (closed): Carry merge_commit_sha through to MinimalPullRequest (@sean-park-funda)
- **PR #3332** (closed): Reject pull_request_read pagination the method cannot honour (@sean-park-funda)
- **PR #3320** (closed): build(deps): bump github/codeql-action from 4.37.9 to 4.38.1 (@dependabot[bot])
- **PR #3305** (closed): feat: add diagnostic tool and rate limit transport wrapper (@dineshA43354)
- **PR #3304** (closed): Update dependencies including fast-uri, browserslist, and golang (@parvezmosharafvu)
- **PR #3285** (2026-09-16): feat: add `remove_issue_reaction`, `remove_issue_comment_reaction ` and `remove_pull_request_review_comment_reaction` tools to the granular issues and pull requests toolsets (@timrogers)
- **PR #3284** (2026-09-15): feat: add update_issue_comment tool (@timrogers)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
