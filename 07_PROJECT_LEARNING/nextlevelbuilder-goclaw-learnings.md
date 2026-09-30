# Forensic Learning Record (Deep Inspection): nextlevelbuilder/goclaw

> **Canonical Artifact**: `07_PROJECT_LEARNING/nextlevelbuilder-goclaw-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/nextlevelbuilder/goclaw](https://github.com/nextlevelbuilder/goclaw))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:13:23.430Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `nextlevelbuilder/goclaw`
- **Description**: GoClaw - GoClaw is OpenClaw rebuilt in Go — with multi-tenant isolation, 5-layer security, and native concurrency. Deploy AI agent teams at scale without compromising on safety.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 3634 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cmd/agent.go`
```
package cmd

import (
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"text/tabwriter"

	"github.com/spf13/cobra"
)

func agentCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "agent",
		Short: "Manage agents — add, list, delete",
	}
	cmd.AddCommand(agentListCmd())
	cmd.AddCommand(agentAddCmd())
	cmd.AddCommand(agentDeleteCmd())
	cmd.AddCommand(agentChatCmd())
	return cmd
}

// --- agent list ---

// httpAgent is the CLI-side representation of an agent from the HTTP API.
type httpAgent struct {
	ID          string `json:"id"`
	AgentKey    string `json:"agent_key"`
	DisplayName string `json:"display_name"`
	AgentType   string `json:"agent_type"`
	Provider    string `json:"provider"`
	Model       string `json:"model"`
	Status      string `json:"status"`
	IsDefault   bool   `json:"is_default"`
}

func agentListCmd() *cobra.Command {
	var jsonOutput bool
	var agentType string
	cmd := &cobra.Command{
		Use:   "list",
		Short: "List all agents (requires running gateway)",
		Run: func(cmd *cobra.Command, args []string) {
			requireRunningGatewayHTTP()
			runAgentList(jsonOutput, agentType)
		},
	}
	cmd.Flags().BoolVar(&jsonOutput, "json", false, "output as JSON")
	cmd.Flags().StringVar(&agentType, "type", "", "filter by agent type (open|predefined)")
	return cmd
}

func runAgentList(jsonOutput bool, agentType string) {
	path := "/v1/agents"
	resp, err := gatewayHTTPGet(path)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}

	// Parse agents array from response
	raw, _ := json.Marshal(resp["agents"])
	var agents []httpAgent
	if err := json.Unmarshal(raw, &agents); err != nil {
		fmt.Fprintf(os.Stderr, "Error parsing agent list: %v\n", err)
		os.Exit(1)
	}

	// Apply type filter
	if agentType != "" {
		var filtered []httpAgent
		for _, a := range agents {
			if a.AgentType == agentType {
				filtered = append(filtered, a)
			}
		}
		agents = filtered
	}

	if jsonOutput {
		data, _ := json.MarshalIndent(agents, "", "  ")
		fmt.Println(string(data))
		return
	}

	if len(agents) == 0 {
		fmt.Println("No agents found.")
		return
	}

	w := tabwriter.NewWriter(os.Stdout, 0, 4, 2, ' ', 0)
	fmt.Fprintln(w, "KEY\tDISPLAY NAME\tTYPE\tPROVIDER\tMODEL\tSTATUS")
	for _, a := range agents {
		fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%s\t%s\n",
			a.AgentKey, a.DisplayName, a.AgentType, a.Provider, a.Model, a.Status)
	}
	w.Flush()
}

// --- agent add ---

func agentAddCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "add",
		Short: "Add a new agent (interactive, requires running gateway)",
		Run: func(cmd *cobra.Command, args []string) {
			requireRunningGatewayHTTP()
			runAgentAdd()
		},
	}
}

// httpProvider is the CLI-side representation of a provider from the HTTP API.
type httpProvider struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	ProviderType string `json:"provider_type"`
	Enabled      bool   `json:"enabled"`
}

// httpProviderModel is a model entry from a provider's model list.
type httpProviderModel struct {
	ID   string `json:"id"`
	Name string `json:"name,omitempty"`
}

func runAgentAdd() {
	fmt.Println("── Add New Agent ──")
	fmt.Println()

	// Step 1: Agent key
	agentKey, err := promptString("Agent key (slug)", "e.g. coder, researcher, assistant", "")
	if err != nil || agentKey == "" {
		fmt.Println("Cancelled.")
		return
	}

	// Step 2: Display name
	displayName, err := promptString("Display name", "", agentKey)
	if err != nil {
		fmt.Println("Cancelled.")
		return
	}

	// Step 3: Agent type
	typeOptions := []SelectOption[string]{
		{"Open (per-user context)", "open"},
		{"Predefined (shared context)", "predefined"},
	}
	agentType, err := promptSelect("Agent type", typeOptions, 0)
	if err != nil {
		fmt.Println("Cancelled.")
		return
	}

	// Step 4: Provider (fetched from gateway)
	providers, err := fetchProviders()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error fetching providers: %v\n", err)
		os.Exit(1)
	}
	if len(providers) == 0 {
		fmt.Println("No providers configured. Run 'goclaw providers add' first.")
		return
	}

	providerOptions := make([]SelectOption[string], len(providers))
	for i, p := range providers {
		label := fmt.Sprintf("%s (%s)", p.Name, p.ProviderType)
		providerOptions[i] = SelectOption[string]{Label: label, Value: p.ID}
	}
	providerID, err := promptSelect("Provider", providerOptions, 0)
	if err != nil {
		fmt.Println("Cancelled.")
		return
	}

	// Step 5: Model (fetched from selected provider)
	model, err := selectModel(providerID)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}

	// Create agent via HTTP API
	body := map[string]any{
		"agent_key":    agentKey,
		"display_name": displayName,
		"agent_type":   agentType,
		"provider":     findProviderType(providers, providerID),
		"model":        model,
	}

	_, err = gatewayHTTPPost("/v1/agents", body)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error creating agent: %v\n", err)
		os.Exit(1)
	}

	fmt.Println()
	fmt.Printf("Agent %q created successfully.\n", agentKey)
	fmt.Printf("  Type:     %s\n", agentType)
	fmt.Printf("  Model:    %s\n", model)
}

// fetchProviders returns the list of providers from the gateway.
func fetchProviders() ([]httpProvider, error) {
	resp, err := gatewayHTTPGet("/v1/providers")
	if err != nil {
		return nil, err
	}
	raw, _ := json.Marshal(resp["providers"])
	var providers []httpProvider
	if err := json.Unmarshal(raw, &providers); err != nil {
		return nil, fmt.Errorf("parse providers: %w", err)
	}
	return providers, nil
}

// selectModel fetches models from a provider and prompts the user to pick one.
func selectModel(providerID string) (string, error) {
	resp, err := gatewayHTTPGet("/v1/providers/" + url.PathEscape(providerID) + "/models")
	if err != nil {
		// Fallback: manual model input if provider doesn't support model listing
		model, promptErr := promptString("Model name", "e.g. claude-sonnet-4-20250514", "")
		if promptErr != nil || model == "" {
			return "", fmt.Errorf("cancelled")
		}
		return model, nil
	}

	raw, _ := json.Marshal(resp["models"])
	var models []httpProviderModel
	if err := json.Unmarshal(raw, &models); err != nil || len(models) == 0 {
		// Fallback to manual input
		model, promptErr := promptString("Model name", "e.g. claude-sonnet-4-20250514", "")
		if promptErr != nil || model == "" {
			return "", fmt.Errorf("cancelled")
		}
		return model, nil
	}

	options := make([]SelectOption[string], len(models))
	for i, m := range models {
		label := m.ID
		if m.Name != "" && m.Name != m.ID {
			label = fmt.Sprintf("%s (%s)", m.ID, m.Name)
		}
		options[i] = SelectOption[string]{Label: label, Value: m.ID}
	}

	selected, err := promptSelect("Model", options, 0)
	if err != nil {
		return "", fmt.Errorf("cancelled")
	}
	return selected, nil
}

// findProviderType returns the provider_type for a given provider ID.
func findProviderType(providers []httpProvider, id string) string {
	for _, p := range providers {
		if p.ID == id {
			return p.ProviderType
		}
	}
	return ""
}

// --- agent delete ---

func agentDeleteCmd() *cobra.Command {
	var force bool
	cmd := &cobra.Command{
		Use:   "delete <agent-id>",
		Short: "Delete an agent (requires running gateway)",
		Args:  cobra.ExactArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			requireRunningGatewayHTTP()
			runAgentDelete(args[0], force)
		},
	}
	cmd.Flags().BoolVar(&force, "force", false, "skip confirmation")
	return cmd
}

func runAgentDelete(agentID string, force bool) {
	if !force {
		confirmed, err := promptConfirm(fmt.Sprintf("Delete agent %q?", agentID), false)
		if err != nil || !confirmed {
			fmt.Println("Cancelled.")
			return
		}
	}

	if err := gatewayHTTPDelete("/v1/agents/" + url.PathEscape(agentID)); err != nil {
		fmt.Fprintf(os.Stderr, "Error deleting agent: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Agent %q deleted.\n", agentID)
}

```

### Core Architecture Module: `cmd/agent_chat.go`
```
package cmd

import (
	"fmt"
	"net"
	"os"
	"time"

	"github.com/spf13/cobra"

	"github.com/nextlevelbuilder/goclaw/internal/config"
	"github.com/nextlevelbuilder/goclaw/internal/sessions"
)

func agentChatCmd() *cobra.Command {
	var (
		agentName  string
		message    string
		sessionKey string
	)

	cmd := &cobra.Command{
		Use:   "chat",
		Short: "Chat with an agent interactively or send a one-shot message",
		Long: `Chat with an agent via the running gateway (WebSocket client mode).

Examples:
  goclaw agent chat                          # Interactive REPL
  goclaw agent chat --name coder             # Chat with "coder" agent
  goclaw agent chat -m "What time is it?"    # One-shot message
  goclaw agent chat -s my-session            # Continue a session`,
		Run: func(cmd *cobra.Command, args []string) {
			runAgentChat(agentName, message, sessionKey)
		},
	}

	cmd.Flags().StringVarP(&agentName, "name", "n", "default", "agent name")
	cmd.Flags().StringVarP(&message, "message", "m", "", "one-shot message (omit for interactive mode)")
	cmd.Flags().StringVarP(&sessionKey, "session", "s", "", "session key (default: auto-generated)")

	return cmd
}

func runAgentChat(agentName, message, sessionKey string) {
	cfgPath := resolveConfigPath()
	cfg, err := config.Load(cfgPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error loading config: %v\n", err)
		os.Exit(1)
	}

	// Default session key
	if sessionKey == "" {
		sessionKey = sessions.BuildSessionKey(agentName, "cli", sessions.PeerDirect, "local")
	}

	// Try client mode first (connect to running gateway)
	host := cfg.Gateway.Host
	if host == "0.0.0.0" {
		host = "127.0.0.1"
	}
	addr := fmt.Sprintf("%s:%d", host, cfg.Gateway.Port)

	if !isGatewayRunning(addr) {
		fmt.Fprintln(os.Stderr, "Error: the gateway must be running for this command.")
		fmt.Fprintln(os.Stderr, "Start it first:  goclaw")
		os.Exit(1)
	}

	fmt.Fprintf(os.Stderr, "Connected to gateway at %s\n", addr)
	runClientMode(cfg, addr, agentName, message, sessionKey)
}

// --- Gateway detection ---

func isGatewayRunning(addr string) bool {
	conn, err := net.DialTimeout("tcp", addr, 2*time.Second)
	if err != nil {
		return false
	}
	conn.Close()
	return true
}

```

### Core Architecture Module: `cmd/agent_chat_client.go`
```
package cmd

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"

	"github.com/nextlevelbuilder/goclaw/internal/config"
	"github.com/nextlevelbuilder/goclaw/internal/sessions"
	"github.com/nextlevelbuilder/goclaw/pkg/protocol"
)

func runClientMode(cfg *config.Config, addr, agentName, message, sessionKey string) {
	wsURL := fmt.Sprintf("ws://%s/ws", addr)

	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		fmt.Fprintf(os.Stderr, "WebSocket connect failed: %v\n", err)
		os.Exit(1)
	}
	defer conn.Close()

	// Authenticate
	if err := wsConnect(conn, cfg.Gateway.Token); err != nil {
		fmt.Fprintf(os.Stderr, "Gateway auth failed: %v\n", err)
		os.Exit(1)
	}

	agentCfg := cfg.ResolveAgent(agentName)

	if message != "" {
		// One-shot mode
		resp, err := wsChatSend(conn, agentName, sessionKey, message)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(1)
		}
		fmt.Println(resp)
		return
	}

	// Interactive REPL
	fmt.Fprintf(os.Stderr, "\nGoClaw Interactive Chat (agent: %s, model: %s)\n", agentName, agentCfg.Model)
	fmt.Fprintf(os.Stderr, "Session: %s\n", sessionKey)
	fmt.Fprintf(os.Stderr, "Type \"exit\" to quit, \"/new\" for new session\n\n")

	scanner := bufio.NewScanner(os.Stdin)
	for {
		fmt.Fprint(os.Stderr, "You: ")
		if !scanner.Scan() {
			break
		}
		input := strings.TrimSpace(scanner.Text())
		if input == "" {
			continue
		}
		if input == "exit" || input == "quit" {
			fmt.Fprintln(os.Stderr, "Goodbye!")
			return
		}
		if input == "/new" {
			sessionKey = sessions.BuildSessionKey(agentName, "cli", sessions.PeerDirect, uuid.NewString()[:8])
			fmt.Fprintf(os.Stderr, "New session: %s\n\n", sessionKey)
			continue
		}

		resp, err := wsChatSend(conn, agentName, sessionKey, input)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n\n", err)
			continue
		}
		fmt.Printf("\n%s\n\n", resp)
	}
	if err := scanner.Err(); err != nil {
		fmt.Fprintf(os.Stderr, "Input error: %v\n", err)
		os.Exit(1)
	}
}

// wsConnect sends the connect RPC and waits for auth response.
func wsConnect(conn *websocket.Conn, token string) error {
	params := map[string]string{}
	userId := os.Getenv("GOCLAW_USER_ID")
	if userId == "" { userId = "system" }
	params["user_id"] = userId
	if token != "" {
		params["token"] = token
	}
	paramsJSON, _ := json.Marshal(params)

	reqFrame := protocol.RequestFrame{
		Type:   protocol.FrameTypeRequest,
		ID:     "connect-1",
		Method: protocol.MethodConnect,
		Params: paramsJSON,
	}

	if err := conn.WriteJSON(reqFrame); err != nil {
		return fmt.Errorf("send connect: %w", err)
	}

	var resp protocol.ResponseFrame
	if err := conn.ReadJSON(&resp); err != nil {
		return fmt.Errorf("read connect response: %w", err)
	}
	if !resp.OK {
		if resp.Error != nil {
			return fmt.Errorf("connect rejected: %s", resp.Error.Message)
		}
		return fmt.Errorf("connect rejected")
	}

	return nil
}

// wsChatSend sends a chat.send RPC and waits for the response,
// displaying events (tool calls, chunks) in real-time.
func wsChatSend(conn *websocket.Conn, agentID, sessionKey, message string) (string, error) {
	reqID := uuid.NewString()[:8]
	params, _ := json.Marshal(map[string]any{
		"message":    message,
		"agentId":    agentID,
		"sessionKey": sessionKey,
		"stream":     true,
	})

	reqFrame := protocol.RequestFrame{
		Type:   protocol.FrameTypeRequest,
		ID:     reqID,
		Method: protocol.MethodChatSend,
		Params: params,
	}

	if err := conn.WriteJSON(reqFrame); err != nil {
		return "", fmt.Errorf("send chat: %w", err)
	}

	// Read frames until we get our response
	var finalContent string
	for {
		_, rawMsg, err := conn.ReadMessage()
		if err != nil {
			return "", fmt.Errorf("read: %w", err)
		}

		frameType, _ := protocol.ParseFrameType(rawMsg)

		switch frameType {
		case protocol.FrameTypeResponse:
			var resp protocol.ResponseFrame
			if err := json.Unmarshal(rawMsg, &resp); err != nil {
				continue
			}
			if resp.ID != reqID {
				continue // response for a different request
			}
			if !resp.OK {
				if resp.Error != nil {
					return "", fmt.Errorf("agent error: %s", resp.Error.Message)
				}
				return "", fmt.Errorf("agent error (unknown)")
			}
			// Extract content from payload
			if payload, ok := resp.Payload.(map[string]any); ok {
				if content, ok := payload["content"].(string); ok && content != "" {
					finalContent = content
				}
			}
			return finalContent, nil

		case protocol.FrameTypeEvent:
			var evt protocol.EventFrame
			if err := json.Unmarshal(rawMsg, &evt); err != nil {
				continue
			}
			handleCLIEvent(evt)
		}
	}
}

// handleCLIEvent displays agent events in the terminal.
func handleCLIEvent(evt protocol.EventFrame) {
	payload, ok := evt.Payload.(map[string]any)
	if !ok {
		return
	}

	evtType, _ := payload["type"].(string)

	switch evt.Event {
	case protocol.EventAgent:
		switch evtType {
		case protocol.AgentEventToolCall:
			if p, ok := payload["payload"].(map[string]any); ok {
				name, _ := p["toolName"].(string)
				if name == "" {
					name, _ = p["name"].(string)
				}
				fmt.Fprintf(os.Stderr, "  [tool] %s\n", name)
			}
		case protocol.AgentEventToolResult:
			if p, ok := payload["payload"].(map[string]any); ok {
				isErr, _ := p["is_error"].(bool)
				name, _ := p["toolName"].(string)
				if name == "" {
					name, _ = p["name"].(string)
				}
				if isErr {
					fmt.Fprintf(os.Stderr, "  [tool] %s -> error\n", name)
				}
			}
		}

	case protocol.EventChat:
		switch evtType {
		case protocol.ChatEventChunk:
			if content, ok := payload["content"].(string); ok {
				fmt.Print(content)
			}
		}
	}
}

```

### Core Architecture Module: `cmd/auth.go`
```
package cmd

import (
	"fmt"
	"net/url"
	"strings"

	"github.com/nextlevelbuilder/goclaw/internal/oauth"
	"github.com/spf13/cobra"
)

func authCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "auth",
		Short: "Authenticate named ChatGPT OAuth accounts",
		Long:  "Manage ChatGPT OAuth authentication via the running gateway. Requires the gateway to be running.",
	}
	cmd.AddCommand(authStatusCmd())
	cmd.AddCommand(authLogoutCmd())
	return cmd
}

// gatewayRequest sends an authenticated request to the running gateway.
// Delegates to the shared HTTP client in gateway_http_client.go.
func gatewayRequest(method, path string) (map[string]any, error) {
	return gatewayHTTPDo(method, path, nil)
}

func authStatusCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "status [provider]",
		Short: "Show OAuth authentication status",
		Long:  "Check if a named ChatGPT OAuth account is authenticated on the running gateway.",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			provider := resolveOAuthProviderArg(args)
			result, err := gatewayRequest("GET", fmt.Sprintf("/v1/auth/chatgpt/%s/status", url.PathEscape(provider)))
			if err != nil {
				return err
			}

			if auth, _ := result["authenticated"].(bool); auth {
				name, _ := result["provider_name"].(string)
				if name == "" {
					name = provider
				}
				fmt.Printf("ChatGPT OAuth account: active (alias: %s)\n", name)
				fmt.Printf("Use model prefix '%s/' in agent config (e.g. %s/gpt-5.5).\n", name, name)
			} else {
				fmt.Printf("No ChatGPT OAuth tokens found for alias '%s'.\n", provider)
				fmt.Println("Use the web UI to authenticate this ChatGPT OAuth account.")
			}
			return nil
		},
	}
}

func authLogoutCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "logout [provider]",
		Short: "Disconnect stored ChatGPT OAuth tokens",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			provider := resolveOAuthProviderArg(args)
			_, err := gatewayRequest("POST", fmt.Sprintf("/v1/auth/chatgpt/%s/logout", url.PathEscape(provider)))
			if err != nil {
				return err
			}

			fmt.Printf("ChatGPT OAuth account disconnected for alias '%s'.\n", provider)
			return nil
		},
	}
}

func resolveOAuthProviderArg(args []string) string {
	if len(args) == 0 {
		return oauth.DefaultProviderName
	}
	provider := strings.TrimSpace(args[0])
	if provider == "" || provider == "openai" {
		return oauth.DefaultProviderName
	}
	return provider
}

```

### Core Architecture Module: `cmd/backup.go`
```
package cmd

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/spf13/cobra"

	"github.com/nextlevelbuilder/goclaw/internal/backup"
	"github.com/nextlevelbuilder/goclaw/internal/config"
	"github.com/nextlevelbuilder/goclaw/internal/store/pg"
)

func backupCmd() *cobra.Command {
	var (
		outputPath   string
		excludeDB    bool
		excludeFiles bool
		uploadS3     bool
	)

	cmd := &cobra.Command{
		Use:   "backup",
		Short: "Create a full system backup (database + filesystem)",
		Long:  "Produces a .tar.gz archive containing a pg_dump of the database and all workspace/data files.",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := config.Load(resolveConfigPath())
			if err != nil {
				return fmt.Errorf("load config: %w", err)
			}

			dsn := cfg.Database.PostgresDSN

			if outputPath == "" {
				ts := time.Now().UTC().Format("20060102-150405")
				outputPath = fmt.Sprintf("./backup-%s.tar.gz", ts)
			}

			fmt.Printf("Starting backup → %s\n", outputPath)
			if excludeDB {
				fmt.Println("  database: excluded")
			}
			if excludeFiles {
				fmt.Println("  filesystem: excluded")
			}

			opts := backup.Options{
				DSN:           dsn,
				DataDir:       cfg.ResolvedDataDir(),
				WorkspacePath: cfg.WorkspacePath(),
				OutputPath:    outputPath,
				CreatedBy:     "cli",
				GoclawVersion: Version,
				ExcludeDB:     excludeDB,
				ExcludeFiles:  excludeFiles,
				ProgressFn: func(phase, detail string) {
					fmt.Printf("  [%s] %s\n", phase, detail)
				},
			}

			manifest, err := backup.Run(cmd.Context(), opts)
			if err != nil {
				return fmt.Errorf("backup failed: %w", err)
			}

			fmt.Printf("\nBackup complete: %s\n", outputPath)
			fmt.Printf("  schema version : %d\n", manifest.SchemaVersion)
			fmt.Printf("  database size  : %d MB\n", manifest.Stats.DatabaseSizeBytes>>20)
			fmt.Printf("  filesystem     : %d files, %d MB\n",
				manifest.Stats.FilesystemFiles,
				manifest.Stats.FilesystemBytes>>20,
			)
			fmt.Printf("  total          : %d MB\n", manifest.Stats.TotalBytes>>20)

			if uploadS3 {
				if err := uploadBackupToS3(cmd.Context(), cfg, outputPath, Version); err != nil {
					fmt.Fprintf(os.Stderr, "\nS3 upload failed: %v\n", err)
					return err
				}
			}

			return nil
		},
	}

	cmd.Flags().StringVarP(&outputPath, "output", "o", "", "output path for .tar.gz (default: ./backup-<timestamp>.tar.gz)")
	cmd.Flags().BoolVar(&excludeDB, "exclude-db", false, "skip database dump (filesystem only)")
	cmd.Flags().BoolVar(&excludeFiles, "exclude-files", false, "skip filesystem archive (database only)")
	cmd.Flags().BoolVar(&uploadS3, "upload-s3", false, "upload backup to S3 after creation (requires s3 config in config_secrets)")

	return cmd
}

// uploadBackupToS3 loads S3 config from the database and uploads the archive.
func uploadBackupToS3(ctx context.Context, cfg *config.Config, archivePath, version string) error {
	if cfg.Database.PostgresDSN == "" {
		return fmt.Errorf("postgres DSN not configured; set GOCLAW_POSTGRES_DSN")
	}
	db, err := sql.Open("pgx", cfg.Database.PostgresDSN)
	if err != nil {
		return fmt.Errorf("open db: %w", err)
	}
	defer db.Close()

	encKey := os.Getenv("GOCLAW_ENCRYPTION_KEY")
	secrets := pg.NewPGConfigSecretsStore(db, encKey)
	s3cfg, err := backup.LoadS3Config(ctx, secrets)
	if err != nil {
		return fmt.Errorf("load s3 config: %w", err)
	}
	if s3cfg == nil {
		return fmt.Errorf("s3 not configured — run: goclaw s3-config set")
	}

	client, err := backup.NewS3Client(s3cfg)
	if err != nil {
		return fmt.Errorf("create s3 client: %w", err)
	}

	f, err := os.Open(archivePath)
	if err != nil {
		return fmt.Errorf("open archive: %w", err)
	}
	defer f.Close()

	info, err := f.Stat()
	if err != nil {
		return fmt.Errorf("stat archive: %w", err)
	}

	ts := time.Now().UTC().Format("20060102-150405")
	key := fmt.Sprintf("backup-%s-v%s.tar.gz", ts, version)
	if version == "" {
		key = fmt.Sprintf("backup-%s.tar.gz", ts)
	}

	fmt.Printf("\nUploading to S3: %s/%s ...\n", s3cfg.Bucket, key)
	if err := client.Upload(ctx, key, f, info.Size()); err != nil {
		return err
	}
	fmt.Printf("S3 upload complete: s3://%s/%s%s\n", s3cfg.Bucket, s3cfg.Prefix, key)
	return nil
}

```

### Core Architecture Module: `cmd/bitrix_portal.go`
```
package cmd

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/google/uuid"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/spf13/cobra"

	"github.com/nextlevelbuilder/goclaw/internal/channels/bitrix24"
	"github.com/nextlevelbuilder/goclaw/internal/store"
	"github.com/nextlevelbuilder/goclaw/internal/store/pg"
)

// bitrixPortalCmd wires `goclaw bitrix-portal ...` — direct-DB management of
// `bitrix_portals` rows. It seeds the portal row required before an operator
// runs the OAuth install flow at `/bitrix24/install`.
//
// Writes go through PGBitrixPortalStore so GOCLAW_ENCRYPTION_KEY is applied
// to the credentials column the same way the runtime would. Reads via `list`
// deliberately don't print secrets — credentials stay encrypted at rest, and
// a debug tool dumping them would be a regression.
func bitrixPortalCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "bitrix-portal",
		Short: "Manage Bitrix24 portals (direct DB access; postgres only)",
		Long: `Manage Bitrix24 portal rows in the database.

GoClaw expects a ` + "`bitrix_portals`" + ` row to exist before an operator runs the
OAuth install flow at ` + "`/bitrix24/install`" + `. This command seeds that row without
requiring SQL access to the database.`,
	}
	cmd.AddCommand(bitrixPortalCreateCmd())
	cmd.AddCommand(bitrixPortalListCmd())
	cmd.AddCommand(bitrixPortalUpdateCredentialsCmd())
	cmd.AddCommand(bitrixPortalSetPublicURLCmd())
	return cmd
}

// bitrixPortalUpdateCredentialsCmd swaps client_id/client_secret on an
// existing portal row. Used when rotating client_secret OR migrating from
// local app to marketplace app on the same Bitrix24 portal — the row stays
// (so channel configs keep working by name) but OAuth identity changes.
//
// Side effect: the existing OAuth state token is invalidated by default
// because it was minted against the OLD client_id/secret and will fail
// to refresh against new credentials. Pass --keep-state to skip that.
// After update, the portal admin must visit the install URL to obtain
// new tokens against the new credentials.
func bitrixPortalUpdateCredentialsCmd() *cobra.Command {
	var (
		tenantID     string
		name         string
		clientID     string
		clientSecret string
		keepState    bool
	)
	cmd := &cobra.Command{
		Use:   "update-credentials",
		Short: "Replace client_id/client_secret on an existing portal row",
		Long: `Update OAuth credentials on an existing bitrix_portals row.

Use this when rotating client_secret or migrating from local app to
marketplace app. The OAuth state token is cleared by default (state from
old credentials cannot refresh under new client_id/secret); pass
--keep-state only if rotating the secret of the SAME application.`,
		RunE: func(cmd *cobra.Command, args []string) error {
			if strings.TrimSpace(tenantID) == "" || strings.TrimSpace(name) == "" ||
				strings.TrimSpace(clientID) == "" || strings.TrimSpace(clientSecret) == "" {
				return fmt.Errorf("--tenant-id, --name, --client-id, --client-secret are all required")
			}
			tid, err := uuid.Parse(tenantID)
			if err != nil {
				return fmt.Errorf("invalid --tenant-id: %w", err)
			}

			dsn, err := resolveDSN()
			if err != nil {
				return err
			}
			db, err := sql.Open("pgx", dsn)
			if err != nil {
				return fmt.Errorf("open db: %w", err)
			}
			defer db.Close()
			if err := db.PingContext(cmd.Context()); err != nil {
				return fmt.Errorf("ping db: %w", err)
			}

			encKey := os.Getenv("GOCLAW_ENCRYPTION_KEY")
			if encKey == "" {
				fmt.Fprintln(os.Stderr, "WARNING: GOCLAW_ENCRYPTION_KEY is not set — credentials will be stored UNENCRYPTED")
			}

			creds := store.BitrixPortalCredentials{
				ClientID:     clientID,
				ClientSecret: clientSecret,
			}
			credsJSON, err := json.Marshal(creds)
			if err != nil {
				return fmt.Errorf("marshal credentials: %w", err)
			}

			portalStore := pg.NewPGBitrixPortalStore(db, encKey)
			if err := portalStore.UpdateCredentials(cmd.Context(), tid, name, credsJSON); err != nil {
				return fmt.Errorf("update credentials: %w", err)
			}
			if !keepState {
				if err := portalStore.UpdateState(cmd.Context(), tid, name, nil); err != nil {
					return fmt.Errorf("clear state: %w", err)
				}
			}

			fmt.Printf("Updated bitrix_portals row:\n")
			fmt.Printf("  tenant_id: %s\n", tid)
			fmt.Printf("  name:      %s\n", name)
			if !keepState {
				fmt.Printf("  state:     cleared (admin must reinstall to mint new tokens)\n")
			} else {
				fmt.Printf("  state:     kept (only valid if rotating same-app secret)\n")
			}
			fmt.Printf("\nNext step — have the portal admin visit:\n")
			fmt.Printf("  https://<public_url>/bitrix24/install?state=%s:%s\n", tid, name)
			return nil
		},
	}
	cmd.Flags().StringVar(&tenantID, "tenant-id", "", "Tenant UUID this portal belongs to (required)")
	cmd.Flags().StringVar(&name, "name", "", "Portal name to update (required)")
	cmd.Flags().StringVar(&clientID, "client-id", "", "New Bitrix24 application client_id (required)")
	cmd.Flags().StringVar(&clientSecret, "client-secret", "", "New Bitrix24 application client_secret (required)")
	cmd.Flags().BoolVar(&keepState, "keep-state", false, "Keep existing OAuth state token (only safe when rotating secret of SAME application)")
	return cmd
}

func bitrixPortalCreateCmd() *cobra.Command {
	var (
		tenantID     string
		name         string
		domain       string
		clientID     string
		clientSecret string
	)
	cmd := &cobra.Command{
		Use:   "create",
		Short: "Create a bitrix_portals row with client_id/client_secret",
		Long: `Create a new Bitrix24 portal registration.

After the row exists, direct the portal admin to
` + "`https://<public_url>/bitrix24/install?state=<tenant_id>:<name>`" + `
to authorize the app — the install handler writes the OAuth token into the
` + "`state`" + ` column of this same row.`,
		RunE: func(cmd *cobra.Command, args []string) error {
			if strings.TrimSpace(tenantID) == "" || strings.TrimSpace(name) == "" ||
				strings.TrimSpace(domain) == "" || strings.TrimSpace(clientID) == "" ||
				strings.TrimSpace(clientSecret) == "" {
				return fmt.Errorf("--tenant-id, --name, --domain, --client-id, --client-secret are all required")
			}
			tid, err := uuid.Parse(tenantID)
			if err != nil {
				return fmt.Errorf("invalid --tenant-id: %w", err)
			}
			// Strip protocol + trailing slash from domain; Bitrix24 identifies
			// the portal by bare host (e.g. `tamgiac.bitrix24.com`).
			dom := normalizeBitrixDomain(domain)

			dsn, err := resolveDSN()
			if err != nil {
				return err
			}
			db, err := sql.Open("pgx", dsn)
			if err != nil {
				return fmt.Errorf("open db: %w", err)
			}
			defer db.Close()
			if err := db.PingContext(cmd.Context()); err != nil {
				return fmt.Errorf("ping db: %w", err)
			}

			encKey := os.Getenv("GOCLAW_ENCRYPTION_KEY")
			if encKey == "" {
				// Not fatal — pg store passes plaintext through when the key is
				// empty — but the runtime gateway would also run unencrypted,
				// which is almost never what a production deploy wants. Warn
				// loud so the operator notices instead of silently storing
				// client_secret as cleartext.
				fmt.Fprintln(os.Stderr, "WARNING: GOCLAW_ENCRYPTION_KEY is not set — credentials will be stored UNENCRYPTED")
			}

			creds := store.BitrixPortalCredentials{
				ClientID:     clientID,
				ClientSecret: clientSecret,
			}
			credsJSON, err := json.Marshal(creds)
			if err != nil {
				return fmt.Errorf("marshal credentials: %w", err)
			}

			portalStore := pg.NewPGBitrixPortalStore(db, encKey)
			data := &store.BitrixPortalData{
				TenantID:    tid,
				Name:        name,
				Domain:      dom,
				Credentials: credsJSON,
				// State stays empty — it's populated by /bitrix24/install
				// after the portal admin authorizes the app.
			}
			if err := portalStore.Create(cmd.Context(), data); err != nil {
				return fmt.Errorf("create portal: %w", err)
			}

			fmt.Printf("Created bitrix_portals row:\n")
			fmt.P
```

### Core Architecture Module: `cmd/browser_cookie_provider.go`
```
package cmd

import (
	"context"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/go-rod/rod/lib/proto"
	"github.com/google/uuid"

	"github.com/nextlevelbuilder/goclaw/internal/store"
	"github.com/nextlevelbuilder/goclaw/pkg/browser"
)

type storeBrowserCookieProvider struct {
	cookies store.BrowserCookieStore
}

func newStoreBrowserCookieProvider(cookies store.BrowserCookieStore) browser.CookieProvider {
	if cookies == nil {
		return nil
	}
	return &storeBrowserCookieProvider{cookies: cookies}
}

func (p *storeBrowserCookieProvider) CookiesForURL(ctx context.Context, scope browser.BrowserScope, targetURL string) ([]*proto.NetworkCookieParam, error) {
	u, err := url.Parse(targetURL)
	if err != nil {
		return nil, fmt.Errorf("parse target url: %w", err)
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return nil, nil
	}
	storeScope, err := browserScopeToCookieScope(scope)
	if err != nil {
		return nil, err
	}
	cookies, err := p.cookies.List(ctx, storeScope, store.BrowserCookieFilter{})
	if err != nil {
		return nil, err
	}

	host := strings.ToLower(u.Hostname())
	path := u.EscapedPath()
	if path == "" {
		path = "/"
	}
	now := time.Now().UTC()
	params := make([]*proto.NetworkCookieParam, 0, len(cookies))
	for _, c := range cookies {
		if !browserCookieMatchesURL(c, host, path, now) {
			continue
		}
		param := &proto.NetworkCookieParam{
			Name:     c.Name,
			Value:    c.Value,
			URL:      targetURL,
			Path:     c.Path,
			Secure:   c.Secure,
			HTTPOnly: c.HTTPOnly,
			SameSite: browserCookieSameSite(c.SameSite),
		}
		if strings.HasPrefix(c.Domain, ".") {
			param.Domain = c.Domain
		}
		if c.ExpiresAt != nil {
			param.Expires = proto.TimeSinceEpoch(float64(c.ExpiresAt.Unix()))
		}
		params = append(params, param)
	}
	return params, nil
}

func browserScopeToCookieScope(scope browser.BrowserScope) (store.BrowserCookieScope, error) {
	tenantID := store.MasterTenantID
	if strings.TrimSpace(scope.TenantID) != "" {
		parsed, err := uuid.Parse(strings.TrimSpace(scope.TenantID))
		if err != nil {
			return store.BrowserCookieScope{}, fmt.Errorf("invalid browser tenant scope: %w", err)
		}
		tenantID = parsed
	}
	cookieScope := store.BrowserCookieScope{
		TenantID: tenantID,
		UserID:   strings.TrimSpace(scope.UserID),
		AgentID:  strings.TrimSpace(scope.AgentID),
	}
	if err := cookieScope.Validate(); err != nil {
		return store.BrowserCookieScope{}, err
	}
	return cookieScope, nil
}

func browserCookieMatchesURL(c store.BrowserCookie, host, requestPath string, now time.Time) bool {
	domain := strings.ToLower(strings.TrimSpace(c.Domain))
	if domain == "" {
		return false
	}
	if c.ExpiresAt != nil && !c.ExpiresAt.After(now) {
		return false
	}
	hostOnly := !strings.HasPrefix(domain, ".")
	matchDomain := strings.TrimPrefix(domain, ".")
	if hostOnly {
		if host != matchDomain {
			return false
		}
	} else if host != matchDomain && !strings.HasSuffix(host, "."+matchDomain) {
		return false
	}
	cookiePath := c.Path
	if cookiePath == "" {
		cookiePath = "/"
	}
	return requestPath == cookiePath || strings.HasPrefix(requestPath, strings.TrimRight(cookiePath, "/")+"/")
}

func browserCookieSameSite(value string) proto.NetworkCookieSameSite {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "strict":
		return proto.NetworkCookieSameSiteStrict
	case "lax":
		return proto.NetworkCookieSameSiteLax
	case "none", "no_restriction", "no-restriction":
		return proto.NetworkCookieSameSiteNone
	default:
		return ""
	}
}

```

### Core Architecture Module: `cmd/channels_cmd.go`
```
package cmd

import (
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"text/tabwriter"

	"github.com/spf13/cobra"
)

func channelsCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "channels",
		Short: "Manage messaging channels (requires running gateway)",
	}
	cmd.AddCommand(channelsListCmd())
	cmd.AddCommand(channelsAddCmd())
	cmd.AddCommand(channelsDeleteCmd())
	return cmd
}

// httpChannelInstance is the CLI-side representation of a channel instance from the HTTP API.
type httpChannelInstance struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	ChannelType string `json:"channel_type"`
	AgentID     string `json:"agent_id"`
	Enabled     bool   `json:"enabled"`
	Status      string `json:"status"`
}

func channelsListCmd() *cobra.Command {
	var jsonOutput bool
	cmd := &cobra.Command{
		Use:   "list",
		Short: "List channel instances",
		Run: func(cmd *cobra.Command, args []string) {
			requireRunningGatewayHTTP()

			resp, err := gatewayHTTPGet("/v1/channels/instances")
			if err != nil {
				fmt.Fprintf(os.Stderr, "Error: %v\n", err)
				os.Exit(1)
			}

			raw, _ := json.Marshal(resp["instances"])
			var instances []httpChannelInstance
			if err := json.Unmarshal(raw, &instances); err != nil {
				fmt.Fprintf(os.Stderr, "Error parsing response: %v\n", err)
				os.Exit(1)
			}

			if jsonOutput {
				data, _ := json.MarshalIndent(instances, "", "  ")
				fmt.Println(string(data))
				return
			}

			if len(instances) == 0 {
				fmt.Println("No channel instances configured.")
				return
			}

			tw := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
			fmt.Fprintf(tw, "ID\tNAME\tTYPE\tENABLED\tSTATUS\n")
			for _, inst := range instances {
				fmt.Fprintf(tw, "%s\t%s\t%s\t%v\t%s\n",
					inst.ID, inst.Name, inst.ChannelType, inst.Enabled, inst.Status)
			}
			tw.Flush()
		},
	}
	cmd.Flags().BoolVar(&jsonOutput, "json", false, "output as JSON")
	return cmd
}

func channelsAddCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "add",
		Short: "Add a new channel instance (interactive)",
		Run: func(cmd *cobra.Command, args []string) {
			requireRunningGatewayHTTP()
			runChannelsAdd()
		},
	}
}

func runChannelsAdd() {
	fmt.Println("── Add Channel Instance ──")
	fmt.Println()

	// Step 1: Channel type
	typeOptions := []SelectOption[string]{
		{"Telegram", "telegram"},
		{"Discord", "discord"},
		{"Slack", "slack"},
	}
	channelType, err := promptSelect("Channel type", typeOptions, 0)
	if err != nil {
		fmt.Println("Cancelled.")
		return
	}

	// Step 2: Name
	name, err := promptString("Instance name", "e.g. my-telegram-bot", channelType+"-bot")
	if err != nil {
		fmt.Println("Cancelled.")
		return
	}

	// Step 3: Credentials per type
	creds := map[string]string{}
	switch channelType {
	case "telegram":
		token, err := promptPassword("Bot token", "from @BotFather")
		if err != nil || token == "" {
			fmt.Println("Cancelled.")
			return
		}
		creds["token"] = token
	case "discord":
		token, err := promptPassword("Bot token", "from Discord Developer Portal")
		if err != nil || token == "" {
			fmt.Println("Cancelled.")
			return
		}
		creds["token"] = token
	case "slack":
		token, err := promptPassword("Bot token", "xoxb-...")
		if err != nil || token == "" {
			fmt.Println("Cancelled.")
			return
		}
		creds["token"] = token
		secret, err := promptPassword("Signing secret", "from Slack app settings")
		if err != nil || secret == "" {
			fmt.Println("Cancelled.")
			return
		}
		creds["signing_secret"] = secret
	}

	// Step 4: Bind to agent
	agents, err := fetchAgentList()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error fetching agents: %v\n", err)
		os.Exit(1)
	}
	if len(agents) == 0 {
		fmt.Println("No agents found. Create an agent first with 'goclaw agent add'.")
		return
	}

	agentOptions := make([]SelectOption[string], len(agents))
	for i, a := range agents {
		agentOptions[i] = SelectOption[string]{
			Label: fmt.Sprintf("%s (%s)", a.AgentKey, a.DisplayName),
			Value: a.ID,
		}
	}
	agentID, err := promptSelect("Bind to agent", agentOptions, 0)
	if err != nil {
		fmt.Println("Cancelled.")
		return
	}

	// Create via HTTP API
	body := map[string]any{
		"name":         name,
		"channel_type": channelType,
		"agent_id":     agentID,
		"enabled":      true,
		"credentials":  creds,
	}

	_, err = gatewayHTTPPost("/v1/channels/instances", body)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error creating channel: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("\nChannel %q (%s) created and bound to agent.\n", name, channelType)
	fmt.Println("Note: For Zalo, Feishu, WhatsApp — use the Web Dashboard.")
}

func channelsDeleteCmd() *cobra.Command {
	var force bool
	cmd := &cobra.Command{
		Use:   "delete <id>",
		Short: "Delete a channel instance",
		Args:  cobra.ExactArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			requireRunningGatewayHTTP()
			if !force {
				confirmed, err := promptConfirm(fmt.Sprintf("Delete channel %q?", args[0]), false)
				if err != nil || !confirmed {
					fmt.Println("Cancelled.")
					return
				}
			}
			if err := gatewayHTTPDelete("/v1/channels/instances/" + url.PathEscape(args[0])); err != nil {
				fmt.Fprintf(os.Stderr, "Error: %v\n", err)
				os.Exit(1)
			}
			fmt.Printf("Channel %q deleted.\n", args[0])
		},
	}
	cmd.Flags().BoolVar(&force, "force", false, "skip confirmation")
	return cmd
}

// fetchAgentList returns agents from the gateway for use in selection prompts.
func fetchAgentList() ([]httpAgent, error) {
	resp, err := gatewayHTTPGet("/v1/agents")
	if err != nil {
		return nil, err
	}
	raw, _ := json.Marshal(resp["agents"])
	var agents []httpAgent
	if err := json.Unmarshal(raw, &agents); err != nil {
		return nil, fmt.Errorf("parse agents: %w", err)
	}
	return agents, nil
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1569** (2026-09-21): **Agent create: background summoning silently overwrites context files written right after create**
  *Symptoms*: ## Summary  Creating a predefined agent with an `agent_description` starts summoning in a background goroutine. It finishes ~10-20 seconds **after** the create response and writes `SOUL.md`, `IDENTITY.md`, `CAPABILITIES.md` and the agent `frontmatter`.  A client that manages agents as code writes its own context files through `agents.files.set` as soon as create returns. Summoning lands afterwards and replaces them. Nothing fails: no error from the API, nothing in the gateway logs, and the agent quietly runs on generated text instead of the committed role.  ## Steps to reproduce  1. `POST /v1/agents` with `agent_type: predefined` and a non-empty `agent_description`. 2. As soon as it returns `201`, write your own `CAPABILITIES.md` via `agents.files.set`. 3. Wait ~20 seconds, then read it back (or `GET /v1/agents/{key}/system-prompt-preview`).  ## Expected  Either the write wins, or the API gives the client a way to say "I bring my own files, do not summon".  ## Actual  The file contains the summoner's generated template, and `frontmatter` is the generated one too. Real timeline from our gateway (`v3.15.0-beta.212`), where an agent was created and its role written in the same second:  ``` 08:02:56  POST /v1/agents            -> 201, status=summoning 08:02:56  agents.files.set CAPABILITIES.md   (our role, 5262 chars) 08:02:56  summoning: calling LLM     provider=litellm prompt_len=9077 08:03:09  summoning: raw LLM response length=14421 08:03:09  summoning: completed ```  The rol
  **Post-Mortem & Fix Analysis**:
  > Confirmed on `main` (`549c81fd`). Thank you for the precise timeline — it made this quick to trace.  **Why it happens**  `handleCreate` sets `status = summoning` for a predefined agent with a description and then starts the work with `go h.summoner.SummonAgent(...)` (`internal/http/agents.go`). That goroutine writes the files later:  - single-call path: `s.storeFiles(ctx, agentID, tenantID, files)` followed by `s.finishSummon(ctx, agentID, tenantID, files[bootstrap.IdentityFile], files[frontmatterKey], description)` — `internal/http/summoner.go` - fallback path: `SetAgentContextFile(...)` for SOUL.md / CAPABILITIES.md / IDENTITY.md, then the same `finishSummon`  The first-call path stores every file the model returned without consulting the per-file "already generated" check (`isGenerated`), so a client's own `CAPABILITIES.md` written right after create is replaced — matching your `08:02:56 → 08:03:09` log. The `frontmatter` is written by `finishSummon` in the same window.  **Triage** 

- **Issue #1554** (2026-09-27): **Vault search misses documents because tsv/embedding are built from a lossy auto-summary, not full content**
  *Symptoms*: ## Summary  When a document is ingested into the Knowledge Vault (via workspace rescan, or the "Upload to Knowledge Vault" dialog), the `tsv` full-text-search column — and very likely the embedding used for semantic search — is generated from an auto-summary of the document rather than from its raw content.  When the source document lists several specific named items (e.g. product/room variants, each with its own name and price), the auto-summary generalizes them (e.g. "lists room rates including 6 categories") instead of naming each one. As a result, `vault_search` for one of those specific names never returns the document — even though `vault_read` on the same document (once located by some other means) returns the full original content correctly, and the document's `agent_id`/`scope`/`embedding` are all otherwise set up correctly.  ## Repro steps  1. Ingest a markdown document into the Vault whose body contains a table of several named line items (e.g. 5–6 product/room variants, each with a distinct name and price), where those names do not appear in the document's title or opening paragraph. 2. Confirm in `vault_documents` that the row has the expected `agent_id` (or `NULL` for shared scope) and `embedding IS NOT NULL`. 3. Inspect the `tsv` column for that row — the specific line-item names are absent from it. 4. Call `vault_search` with a query containing one of those specific names — 0 results, even with no `scope` filter and even when phrasing the query with terms that
  **Post-Mortem & Fix Analysis**:
  > ## Maintainer Triage  **Verdict: confirmed bug — accept, P2-medium.**  ### Code evidence  The reporter's analysis is correct. I verified the ingestion pipeline:  1. **`tsv` column** (`migrations/000042_vault_tsv_summary.up.sql`): Generated stored column from `title || path || summary` — the `summary` field is LLM-generated compressed text, not the full document content.  2. **Embedding** (`internal/store/pg/vault_documents.go:93-103`): Built from `title + path + summary` — same lossy source.  3. **No full content stored**: The `vault_documents` table has no `content` or `full_content` column. Only `summary` is persisted after ingestion. The original document content is discarded after summarization.  4. **`enrich_worker.go`**: The batch summarization phase (`vault.batch_summarize`) compresses document content via LLM before embedding. Specific terms that don't survive summarization are permanently lost from the search index.  ### Impact  This affects any document where the most specifi
  > Thanks for the fast triage and the detailed root-cause confirmation — that matches what I found while digging in.  ## Workaround we're running with in the meantime  Since documents uploaded via "Upload to Knowledge Vault" (and via workspace rescan) are also written as real files on the workspace filesystem, we changed our agent's tool priority away from `vault_search`/`vault_read` and toward `list_files` + `read_file` directly against the document's actual path. That fully bypasses the lossy `tsv`/embedding index and reliably returns the full original content. Verified end-to-end with two different agents on our tenant — works every time, whereas `vault_search` never once returned the right document for the same queries, even after fixing ownership/scope and even after renaming a test document so the specific term appeared in its title (see below).  ## A second, compounding issue found while testing  Independent of the summary-vs-full-content problem: `ftsSearch` builds the query with 
  > Thanks for the detailed follow-up — this is valuable additional evidence.  ## Acknowledged: second compounding bug in FTS query construction  The `plainto_tsquery` AND-matching behavior you identified is a real, independent defect that compounds the summary-vs-full-content problem:  1. **Bug #1 (original):** `tsv`/`embedding` built from lossy summary, not full content → specific terms absent from index 2. **Bug #2 (new):** `ftsSearch` uses `plainto_tsquery` which ANDs every token including fillers → even when `tsv` contains the right terms, natural-language queries fail because non-content words aren't present  Your repro confirms the failure mode: even after renaming a document so the specific term appeared in the title (part of `title || path || summary`), the query still didn't match because other words in the sentence weren't in the `tsv`.  ## Updated scope  The fix now needs to address both layers:  1. **Index layer (preferred):** Store full content (or chunks), build `tsv` from f

- **Issue #1545** (2026-09-07): **delegate has no way to list your own delegations, so one mistyped UUID makes a completed result permanently unreachable**
  *Symptoms*: Sibling of #1527, #1529, #1532 and #1535 — same area, but this one is about recovery rather than a broken path.  ### Summary  `delegate` persists every delegation durably, but the only way to read a result back is `action: "get"` with the exact delegation UUID. There is no way to list your own delegations. The UUID reaches the caller once, as text in a tool result, and the model has to carry it forward by hand. When it mistypes one character the result becomes permanently unreachable — even though it is sitting in the database, complete.  ### Evidence  One production session, a lead delegating to another agent. Two distinct corruption modes, both from the calling model transcribing the id:  ``` created  b1bc9f93-3169-4680-92ce-d64c6e6a7d0a get      b1bc9f93-3169-4680-92ce-d64c6e6a3d0a   -> "delegation result not found"   (x3) ```  One character: `7d0a` became `3d0a`. And earlier in the same session:  ``` created  8087e514-904e-4c37-8c18-30d5f19c0b9b created  3fd46117-8339-45c3-9a3c-8ddf99c83ea1 get      3fd46117-8339-45c3-9a3c-8ddf99c0b9b   -> "delegation_id must be a valid UUID" ```  The tail of the *first* delegation spliced onto the prefix of the second.  After three failed `get` calls the loop guard fires ("called 3 times with the same arguments and identical results"), the agent gives up and spawns a subagent to try to recover the work by itself. From the user's side the delegation simply never answers.  The delegated work had in fact completed and written its deliverabl
  **Post-Mortem & Fix Analysis**:
  > ## Maintainer triage  **Bug confirmed.** The `delegate` tool only exposes `delegate` and `get` actions (`delegate_tool.go` Parameters enum). There is no `list` action, while `spawn` supports `list`/`wait`/`cancel`. The asymmetry is real and the failure mode is reproducible.  ### Code evidence  - `executeGetCompletion` (`delegate_completion_ledger.go`) resolves by `tenantID` + `fromAgentID` only — no session predicate. The issue correctly identifies this as the same class of leak as #1525, weaker in practice (caller must know an unguessable UUID) but architecturally inconsistent. - `createDelegateCompletion` persists `SessionKey`, so scoping `list` by session costs a predicate, not a schema change. - `SubagentTaskData` already carries `TenantID`, `RootAgentID`, `ParentAgentKey`, and `SessionKey` — all the fields needed for a properly scoped list.  ### Recommendation: accept  The fix is small, high-value, and the design direction is sound. The suggestion to scope `list` by tenant + agent
  > Thanks — answering the `get` question, and then reopening one of my own assumptions, because your question exposed a hole in what I proposed.  ### On scoping `get` by session: I would not  I do not think the current `get` is a leak, and I would leave it alone.  The defect in #1525 is **enumeration**: `list` in one chat returns another chat's tasks, including the first 60 characters of their text, to a caller that knew nothing beforehand. That is what makes it P1 — no prior knowledge required, and the payload is content.  `get` is **access by an unguessable handle**. A caller must already hold a v4 UUID; there is no way to walk the space and nothing is disclosed without one. Different property, and I would not treat holding a capability token as a boundary violation.  There is also a concrete cost. Fetching a result by an id kept from earlier — after a deliberate session reset, or from a different chat with the same agent — works today and is used deliberately. A session predicate on `g
  > Settled on the origin chat, and I want to record why, because the deciding reason is a product one rather than a security one.  ### The chat is the unit of visibility  A delegation belongs to the conversation it was raised in, and we do not want it to travel out of that conversation. Work started in a team chat should stay visible in that team chat — not surface later in someone's DM with the same agent. That is a deliberate refusal, not a limitation we are working around: the history should be available where it began, to the people who were there when it began.  Session is the wrong unit because it is an implementation detail of one stretch of conversation, not of the conversation. Agent is too wide, and widening to it is exactly the defect in #1525.  ### The reset case falls out for free  The chat also happens to solve the failure this issue is about. Deferring long work, clearing the session and context, then coming back to ask for status is ordinary use here — the clean context is

- **Issue #1544** (2026-09-25): **[Docs] Zalo OA channel: sai nguồn lấy token và sai cơ chế xác thực webhook**
  *Symptoms*: ## Tóm tắt  Trang https://docs.goclaw.sh/channels/zalo-oa mô tả sai **nguồn lấy token** và sai **cơ chế xác thực webhook**. Người dùng làm theo sẽ đi vào ngõ cụt ngay từ bước đầu.  Nguyên nhân gốc: tài liệu mô tả kênh này như thể nó dùng **Zalo OA Open API**, trong khi code thực tế dùng **Zalo Bot API** — hai sản phẩm khác hẳn nhau.  ## Lỗi 1 — Sai hoàn toàn cách lấy token  Docs hiện viết:  > 1. Visit https://oa.zalo.me > 2. Create an Official Account (requires a Zalo phone number) > 3. Configure your OA with name, avatar, and cover photo > 4. Navigate to "Settings" → "API" → "Bot API" > 5. Generate an API key  Không có đường dẫn nào như vậy. Quy trình đúng (https://bot.zapps.me/docs/create-bot/):  1. Mở **app Zalo** → tìm OA **Zalo Bot Manager** 2. Trong cửa sổ chat chọn **Tạo bot** → mở mini app **Zalo Bot Creator** 3. Nhập tên bot, **bắt buộc prefix `Bot`** (vd `Bot MyShop`) 4. **Bot Token được gửi qua tin nhắn Zalo** cho tài khoản của bạn  Điểm quan trọng docs đang làm người dùng hiểu sai: **không cần sở hữu Zalo OA**. Docs hiện dựng ra một rào cản không tồn tại (phải tạo OA, cấu hình avatar/cover) trong khi thực tế chỉ cần tài khoản Zalo cá nhân.  Cũng cần bổ sung: Zalo Bot Creator đang **beta, giới hạn 3 bot/tài khoản** — ảnh hưởng trực tiếp tới số channel instance dựng được trên một tài khoản Zalo.  ## Lỗi 2 — Sai cơ chế xác thực webhook  Docs hiện viết:  > Zalo sends HMAC signatures in the `X-Zalo-Signature` header for verification.  Sai. Zalo Bot API (https://bot.zap
  **Post-Mortem & Fix Analysis**:
  > I'll work on this. Could you assign it to me?  I'll fix the docs to match the current code and add a short note so this does not rot again. 
  > ## Maintainer Triage  **Verdict: confirmed bug — accept, P3-low.**  The issue correctly identifies that the Zalo OA channel documentation describes the wrong API product. The code uses **Zalo Bot API** (bot.zapps.me), not **Zalo OA Open API** (developers.zalo.me).  ### Evidence checked  - Issue body with detailed comparison table between Zalo Bot vs Zalo OA - Code references to `internal/channels/zalo/` implementation - Zalo Bot API docs confirm the token/webhook mechanisms described in the issue  ### Scope  This is a documentation fix, not a code change:  1. **Primary fix**: Update `docs.goclaw.sh/channels/zalo-oa` to describe Zalo Bot API correctly 2. **Secondary**: Review `docs/05-channels-messaging.md` for similar inconsistencies 3. **Optional**: Consider renaming UI labels from "Zalo OA" to "Zalo Bot" (keep `zalo_oa` type string for backward compatibility)  ### Implementation  The issue author has provided comprehensive references and a clear remediation plan. This is ready for im
  > Closed via merged PR #1572 (docs: clarify Zalo Bot API integration). The in-repo documentation has been updated to reflect Zalo Bot API via long polling.

- **Issue #1535** (2026-09-09): **A delegated team lead cannot return the team's files: send_file and message are refused, and the artifact outputs dir is unreachable**
  *Symptoms*: Sibling of #1527 and #1529 — same theme, that a delegated team lead is a second-class citizen, but a different failure with no code overlap.  ### Summary  A team lead reached through `delegate` cannot hand the team's output back to the user by any route. `send_file` and `message` both refuse outright inside a delegation artifact run, and the sanctioned alternative — staging the file into the delegation `outputs/` directory — is unreachable because the lead can neither read the team workspace nor shell out to copy from it.  The work completes, the file sits in the team workspace, and the user gets nothing.  ### Evidence  One user request, all three routes tried by the lead in a single run:  ``` tool call  agent=brain tool=send_file args_len=161 tool error agent=brain tool=send_file error="delegation files are published only after the delegated run completes" tool call  agent=brain tool=send_file args_len=146 tool error agent=brain tool=send_file error="delegation files are published only after the delegated run completes"  tool error agent=brain tool=read_file error="access denied: path outside workspace" WARN security.path_escape path=/app/workspace/teams/<team-id>/system/review-....md  tool error agent=brain tool=exec error="delegated artifact exec requires an active sandbox manager                                         and sandbox key; host execution is not allowed" ```  The contrast is decisive: **the same agent, the same file, addressed directly instead of through `dele
  **Post-Mortem & Fix Analysis**:
  > 🤖 **github-maintain triage (cron-safe)**  **Verdict: accept / high value — confirmed design-context defect.**  The report identifies two complementary containment failures in the delegated-lead path: 1. `send_file`/`message` deliberately reject delegation artifact runs, and 2. the delegated agent-link run does not carry `TeamWorkspace`, unlike team-member runs, so the lead cannot read or stage its own team's artifact through the sanctioned `outputs/` route.  The stated evidence includes exact tool failures and relevant code paths; the proposed second direction is the stronger architectural fit: populate the delegated lead's `TeamWorkspace` from its resolved team context, then retain normal artifact publication. The narrower `send_file` exception could bypass the deliberately hermetic exchange and creates a less clear multi-team authorization boundary.  **Recommended implementation scope** - Populate `RunRequest.TeamWorkspace` in the delegated agent-link path only when a single, author

- **Issue #1532** (2026-08-31): **Team member runs are never streamed, so long generations die on "http2: timeout awaiting response headers"**
  *Symptoms*: ### Summary  `handleTeammateMessage` pins `Stream: false`, so every team member run — coder, reviewer, researcher — issues a non-streamed provider call. There is no setting that changes this.  On a slow reasoning model that means the connection stays silent for the entire generation while the provider buffers the full response, and the request eventually dies:  ``` iter 0 think: llm call: litellm: request failed:   Post "https://litellm.yatul.ru/v1/chat/completions": http2: timeout awaiting response headers ```  The same model, same provider, same prompt size is fine on an ordinary channel run, because those stream by default.  ### Reproduction  1. Give a team member a task whose answer takes minutes to generate — e.g. "write a complete single-file HTML game", with the agent's `max_tokens` raised enough to actually fit it. 2. The member run makes one non-streamed call and hangs. 3. After ~15 minutes the run fails with `timeout awaiting response headers`, `tool_call_count=0`, `total_output_tokens=0`. Nothing was produced and nothing indicates why to the user.  ### Evidence  Before, on the same task and model (`openrouter/stealth/ox-alpha` via a LiteLLM proxy):  ``` 17:35:35 → 17:50:36   one LLM span, ~15 minutes status=error  tools=0  out_tok=0 iter 0 think: llm call: ... http2: timeout awaiting response headers ```  After flipping this run to streamed, the identical task on the identical model:  ``` coder: completed  iterations=18  tools=22  out_tok=22432  duration=570s snake
  **Post-Mortem & Fix Analysis**:
  > ## Maintainer triagenn**Verdict: confirmed regression — accept, medium priority.**nnThe report identifies a concrete scheduler contract: `handleTeammateMessage` hardcoded `RunRequest.Stream=false`, unlike normal channel runs where streaming is enabled by default. For slow reasoning providers, that can leave the HTTP request without response headers long enough to hit `ResponseHeaderTimeout`; streaming changes transport liveness without changing the final `RunResult` task outcome.nn**Evidence checked**n- #1532 reproduction and before/after production evidence.n- Linked PR #1533: one-file, focused change from `Stream:false` to `Stream:true`.n- The teammate consumer path retains its final-result handling after scheduling; there is no duplicate tracked remediation found.nn**Maintainer action:** requested a focused regression test in #1533 to lock the scheduling contract and verify that streamed chunks still do not become incremental user delivery on this internal path. Once that test lands
  > ## Maintainer follow-up  The linked remediation PR #1533 now includes the requested regression coverage (`TestHandleTeammateMessageSchedulesStreamedRun`) for both streaming liveness and absence of channel chunk delivery. The remaining gate is repository state: GitHub reports `CHANGES_REQUESTED` and `BLOCKED` despite the contributor update, with no current check rollup.  No duplicate remediation was found. This issue remains confirmed and should stay open until #1533 receives re-review, CI/check status is available, and mergeability is restored.  *Posted by github-maintain cron-safe automation — 2026-08-29T04:10:14Z*

- **Issue #1529** (2026-09-09): **Team task results never reach the caller when the lead is reached via delegate: notifications routed to the internal "delegate" channel are dropped**
  *Symptoms*: Sibling of #1527 — same underlying assumption, that a delegation context is a routable channel. #1527 is about tasks never leaving `pending`; this one is about tasks that *do* run, whose results never make it back. The two do not overlap in code and need separate fixes.  ### Summary  A team task created by a lead that was reached through `delegate` records `"delegate"` as its routing channel. `"delegate"` is an internal delivery channel with no registered channel handler, so every outbound message the lead later produces about that task — completion summaries, blocker escalations, stale notifications — is dropped by the outbound dispatcher and the caller never learns anything.  The delegatee's *first* answer still arrives, because it travels back as the delegation result rather than through a channel. Everything the lead says after the delegation has closed is lost.  ### Reproduction  1. Agent A (personal assistant) delegates to agent B, the lead of a team. 2. B creates team tasks and answers "started" — A receives this. 3. Members run, complete, or get blocked. B is woken by the teammate announce and composes a real answer. 4. That answer is dropped: `unknown channel for outbound message channel=delegate`. A is never told anything and keeps waiting.  ### Evidence  One session, 16 dropped outbound messages on `channel=delegate` (plus 2 on `channel=http`):  ``` 16:11:39  INFO teammate announce: batch processed  session=delegate:019f4566:brain:e7ee9913-... 16:11:39  WARN unknow
  **Post-Mortem & Fix Analysis**:
  > ## Maintainer triage  **Verdict: confirmed regression — accept, high value.**  The reported routing failure is corroborated by the current `dev` code path:  - delegated agent-link runs intentionally set the delivery channel to `delegate` while preserving the caller origin in `WorkspaceChannel` / `WorkspaceChatID`; - `team_tasks.create` currently persists `ToolChannelFromCtx` / `ToolChatIDFromCtx` on new tasks, so it records the internal `delegate` delivery channel rather than the preserved origin; - outbound dispatch deliberately drops messages for an unregistered channel, which makes later task completion and blocker notifications undeliverable.  A focused remediation already exists in PR #1530. The intended fix should prefer the workspace-origin channel and chat ID only when present, retain existing fallback behavior for ordinary runs, and include regression coverage for delegated lead task completion plus a guard that unrelated origins cannot receive the notification.  **Merge gates

- **Issue #1527** (2026-08-31): **Team tasks created by a delegated lead are never dispatched; team_tasks list then deadlocks**
  *Symptoms*: ### Summary  When a team lead agent is reached through `delegate` (async, the default), every team task it creates stays `pending` forever and is never dispatched, so the team never starts work. As a side effect the per-`(team, chat)` create lock is leaked, and the next `team_tasks` `list`/`search` for that pair blocks for the remaining lifetime of the process.  Both symptoms have the same cause: a detached child run inherits the caller's `PendingTeamDispatch`, but it executes *after* the caller's turn has already drained it.  ### Reproduction  1. Agent A (personal assistant, `foxy`) is the one the user talks to. Agent B (`brain`) is the lead of a team with members `coder` / `researcher` / `reviewer`. 2. Ask A for something that A routes to B via `delegate` (default `mode: "async"`). 3. B plans, calls `team_tasks(action="create", assignee="coder", ...)`, replies "pipeline started". 4. Nothing happens. No `team_tasks.dispatch: sent task to agent`, no member session, task stays `pending`. 5. Later, `team_tasks(action="list")` in the same chat never returns.  ### Evidence  Two independent incidents on `v3.15.0-beta.196`, one over Telegram and one over the web dashboard. In both the lead created its tasks *after* the caller's turn had finished:  ``` 15:11:34  v3.run.completed agent=foxy          <- caller turn ends, drain fires (empty) 15:11:44  tool call agent=brain tool=team_tasks   (search) 15:12:05  tool call agent=brain tool=team_tasks   (create -> coder, pending) 15:12:35  
  **Post-Mortem & Fix Analysis**:
  > Filed #1529 as a sibling: same underlying assumption that a delegation context is a routable channel, but a distinct defect with no code overlap.  - This issue (#1527, fixed by #1528): tasks created by a delegated lead never leave `pending` — the post-turn dispatch tracker's lifetime. - #1529: tasks that *do* run, whose results never make it back — `team_tasks_create.go` stamps the task with the internal `"delegate"` delivery channel, so every later notification about it is dropped by the outbound dispatcher.  With #1528 applied, the dispatch half works: members are dispatched, run, and dependent tasks unblock. #1529 is what remains — the caller still learns nothing, including blocker escalations.
  > One more in the same family, for the record: #1535 — a delegated team lead cannot return the team's files at all. `send_file` and `message` refuse outright inside a delegation artifact run, and the artifact `outputs/` dir is unreachable because the lead has neither the team workspace in context nor `exec`.  Running tally of the same underlying theme, that a delegated team lead is a second-class citizen:  - #1527 / #1528 — tasks never dispatched - #1529 / #1530 — results and escalations never routed back - #1535 — deliverables cannot be handed to the user  (#1532 / #1533 is adjacent but separate: teammate runs not streaming.)
  > Gentle nudge — this one seems to have slipped past triage while its siblings were picked up:  | | verdict | labels | |---|---|---| | #1529 | confirmed regression, accept, high value | bug, P2-medium, area:teams | | #1532 | confirmed regression, accept | — | | #1535 | accept, high value | bug, P2-medium, area:teams | | **this one** | — | — |  No new information to add, just flagging that it is the root of that family: until tasks are dispatched at all, the routing fix in #1530 and the delivery fix in #1537 have nothing to act on.  PR #1528 is mergeable and carries a regression test (`TestAsyncSpawnDispatchesTeamTasksCreatedAfterParentTurnEnded`) that fails on `dev` with "team task was never dispatched (child ran = true)" and passes with the change.

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

### Incident Patch 1: `52ced371` (2026-09-30)
**Commit Message**: fix(build): embed commit SHA for release provenance (#1571 part 2) (#1590)

* fix(build): embed commit SHA for release provenance (#1571 part 2)

Docker builds exclude .git via .dockerignore, so buildvcs cannot read
VCS metadata and published images carry no commit information. A running
image cannot be lined up with the source commit it was built from.

Embed cmd.CommitSHA at link time (maintainer-endorsed option 2) and
surface it in goclaw version output:

- cmd: add CommitSHA var, print commit in version cmd when injected
- Makefile: pass git rev-parse HEAD via LDFLAGS
- Dockerfile: accept COMMIT_SHA build arg (default unknown)
- docker-compose.yml: pass GOCLAW_COMMIT_SHA through as build arg
- release workflows: inject github.sha into release and dev-beta builds

Backward compatible: binaries built without the flag keep the existing
version output format.

* fix(build): pass COMMIT_SHA to docker image builds, surface it in doctor/upgrade

Review follow-up for PR #1590:

- Add COMMIT_SHA=${{ github.sha }} to the build-args of every
  docker/build-push-action step (release.yaml, dev-beta-release.yaml,
  release-beta.yaml, fork-image.yaml) so published images — the
  artifact issu

**File**: `.github/workflows/dev-beta-release.yaml` (modified, +3/-2)
```diff
@@ -149,7 +149,7 @@ jobs:
           VERSION: ${{ needs.beta_version.outputs.tag }}
         run: |
           CGO_ENABLED=0 go build -tags embedui \
-            -ldflags="-s -w -X github.com/nextlevelbuilder/goclaw/cmd.Version=${VERSION}" \
+            -ldflags="-s -w -X github.com/nextlevelbuilder/goclaw/cmd.Version=${VERSION} -X github.com/nextlevelbuilder/goclaw/cmd.CommitSHA=${{ github.sha }}" \
             -o goclaw .
           tar -czf "goclaw-${VERSION}-linux-amd64.tar.gz" goclaw migrations/ skills/
 
@@ -197,7 +197,7 @@ jobs:
           VERSION: ${{ needs.beta_version.outputs.tag }}
         run: |
           CGO_ENABLED=0 go build -tags embedui \
-            -ldflags="-s -w -X github.com/nextlevelbuilder/goclaw/cmd.Version=${VERSION}" \
+            -ldflags="-s -w -X github.com/nextlevelbuilder/goclaw/cmd.Version=${VERSION} -X github.com/nextlevelbuilder/goclaw/cmd.CommitSHA=${{ github.sha }}" \
             -o goclaw .
           tar -czf "goclaw-${VERSION}-${{ matrix.goos }}-${{ matrix.goarch }}.tar.gz" goclaw migrations/ skills/
 
@@ -352,6 +352,7 @@ jobs:
             ENABLE_FULL_SKILLS=${{ matrix.enable_full_skills }}
             ENABLE_MEDIA_PROBES=${{ matrix.enable_media_probes }}
             VERSION=${{ needs.beta_version.outputs.tag }}
+            COMMIT_SHA=${{ github.sha }}
           cache-from: type=gha,scope=dev-beta-${{ matrix.variant }}
           cache-to: type=gha,mode=max,scope=dev-beta-${{ matrix.variant }}
 
```

**File**: `.github/workflows/fork-image.yaml` (modified, +1/-0)
```diff
@@ -49,5 +49,6 @@ jobs:
             ENABLE_OTEL=false
             ENABLE_FULL_SKILLS=false
             VERSION=fork-dev
+            COMMIT_SHA=${{ github.sha }}
           cache-from: type=gha
           cache-to: type=gha,mode=max
```

**File**: `.github/workflows/release-beta.yaml` (modified, +1/-0)
```diff
@@ -153,5 +153,6 @@ jobs:
             ENABLE_FULL_SKILLS=${{ matrix.enable_full_skills }}
             ENABLE_MEDIA_PROBES=${{ matrix.enable_media_probes }}
             VERSION=${{ github.ref_name }}
+            COMMIT_SHA=${{ github.sha }}
           cache-from: type=gha,scope=beta-${{ matrix.variant }}
           cache-to: type=gha,mode=max,scope=beta-${{ matrix.variant }}
```

**File**: `.github/workflows/release.yaml` (modified, +2/-1)
```diff
@@ -104,7 +104,7 @@ jobs:
           VERSION: v${{ needs.release.outputs.version }}
         run: |
           CGO_ENABLED=0 go build -tags embedui \
-            -ldflags="-s -w -X github.com/nextlevelbuilder/goclaw/cmd.Version=${VERSION}" \
+            -ldflags="-s -w -X github.com/nextlevelbuilder/goclaw/cmd.Version=${VERSION} -X github.com/nextlevelbuilder/goclaw/cmd.CommitSHA=${{ github.sha }}" \
             -o goclaw .
           tar -czf "goclaw-${{ needs.release.outputs.version }}-${{ matrix.goos }}-${{ matrix.goarch }}.tar.gz" goclaw migrations/ skills/
 
@@ -228,6 +228,7 @@ jobs:
             ENABLE_FULL_SKILLS=${{ matrix.enable_full_skills }}
             ENABLE_MEDIA_PROBES=${{ matrix.enable_media_probes }}
             VERSION=v${{ needs.release.outputs.version }}
+            COMMIT_SHA=${{ github.sha }}
           cache-from: type=gha,scope=release-${{ matrix.variant }}
           cache-to: type=gha,mode=max,scope=release-${{ matrix.variant }}
           provenance: false
```

**File**: `Dockerfile` (modified, +3/-1)
```diff
@@ -41,13 +41,15 @@ ARG ENABLE_TSNET=false
 ARG ENABLE_REDIS=false
 ARG ENABLE_EMBEDUI=false
 ARG VERSION=
+ARG COMMIT_SHA=
 
 # Copy web UI dist — from web-builder when ENABLE_EMBEDUI=true, empty dir otherwise.
 COPY --from=web-dist /app/dist /src/internal/webui/dist
 
 RUN set -eux; \
     if [ -z "$VERSION" ] && [ -f VERSION ]; then VERSION=$(cat VERSION); fi; \
     if [ -z "$VERSION" ]; then VERSION="dev"; fi; \
+    if [ -z "$COMMIT_SHA" ]; then COMMIT_SHA="unknown"; fi; \
     TAGS=""; \
     if [ "$ENABLE_EMBEDUI" = "true" ]; then TAGS="embedui"; fi; \
     if [ "$ENABLE_OTEL" = "true" ]; then \
@@ -61,7 +63,7 @@ RUN set -eux; \
     fi; \
     if [ -n "$TAGS" ]; then TAGS="-tags $TAGS"; fi; \
     CGO_ENABLED=0 GOOS=linux \
-    go build -ldflags="-s -w -X github.com/nextlevelbuilder/goclaw/cmd.Version=${VERSION}" \
+    go build -ldflags="-s -w -X github.com/nextlevelbuilder/goclaw/cmd.Version=${VERSION} -X github.com/nextlevelbuilder/goclaw/cmd.CommitSHA=${COMMIT_SHA}" \
     ${TAGS} -o /out/goclaw . && \
     CGO_ENABLED=0 GOOS=linux \
     go build -ldflags="-s -w" -o /out/pkg-helper ./cmd/pkg-helper
```

---

### Incident Patch 2: `3f90057c` (2026-09-29)
**Commit Message**: fix(pipeline): stop aborting runs on heuristic context budget estimates (#1587)

Runs on models without a registered tokenizer (e.g. 9router brand models)
ended with the generic "Agent couldn't generate a response" fallback even
though the real request used about 55% of the context window.

PruneStage counted history with TokenCounter, which falls back to a
chars/2 heuristic for unregistered models and overcounted about 1.8x.
Once over budget it ran memory flush (~35s, invisible in traces), then
mid-loop compaction, which cannot summarize a history made only of tool
call/result pairs. The callback reported the untouched history as
compacted, PruneStage still saw it over budget and returned AbortRun
before any LLM call, and FinalizeStage replaced the empty reply with the
fallback.

- PruneStage and ContextStage overhead count with the request guard's
  BudgetCounter. PruneStage no longer controls loop flow; the final
  request guard in ThinkStage decides.
- CompactMessages returns ErrNotCompacted when history is unchanged.
  Callers stop counting it as a compaction and do not retry it in the
  same run, while post-run summarization still sees the pressure.
- When the guard exhausts 

**File**: `cmd/gateway_consumer_post_turn.go` (modified, +5/-4)
```diff
@@ -129,18 +129,19 @@ func resolveTeamTaskOutcome(
 
 	// Smart post-turn decision based on action flags.
 	// Only error, completed/escalated, and reviewed block auto-complete.
+	runFailure := outcome.Failure()
 	switch {
-	case outcome.Err != nil:
-		// Agent errored → auto-fail.
-		if err := deps.TeamStore.FailTask(ctx, meta.TaskID, meta.TeamID, outcome.Err.Error()); err != nil {
+	case runFailure != nil:
+		// Agent errored or the pipeline stopped the run → auto-fail.
+		if err := deps.TeamStore.FailTask(ctx, meta.TaskID, meta.TeamID, runFailure.Error()); err != nil {
 			slog.Warn("auto-complete: FailTask error", "task_id", meta.TaskID, "error", err)
 		} else {
 			bus.BroadcastForTenant(deps.MsgBus, protocol.EventTeamTaskFailed, store.TenantIDFromContext(ctx), tools.BuildTaskEventPayload(
 				meta.TeamID.String(), meta.TaskID.String(),
 				store.TeamTaskStatusFailed,
 				"agent", toAgent,
 				tools.WithTaskInfo(taskNumber, taskSubject),
-				tools.WithReason(outcome.Err.Error()),
+				tools.WithReason(runFailure.Error()),
 				tools.WithChannel(taskChannel),
 				tools.WithChatID(taskChatID),
 				tools.WithPeerKind(taskPeerKind),
```

**File**: `cmd/gateway_cron.go` (modified, +2/-2)
```diff
@@ -191,8 +191,8 @@ func makeCronJobHandler(sched *scheduler.Scheduler, msgBus *bus.MessageBus, cfg
 		case <-cronCtx.Done():
 			return nil, fmt.Errorf("cron job %s timed out after %s", job.Name, jobTimeout)
 		}
-		if outcome.Err != nil {
-			return nil, outcome.Err
+		if err := outcome.Failure(); err != nil {
+			return nil, err
 		}
 
 		result := outcome.Result
```

**File**: `cmd/gateway_cron_test.go` (modified, +40/-0)
```diff
@@ -3,6 +3,7 @@ package cmd
 import (
 	"context"
 	"fmt"
+	"strings"
 	"testing"
 	"time"
 
@@ -235,6 +236,45 @@ func TestCronJobHandlerSuppressesNoReplyDelivery(t *testing.T) {
 	}
 }
 
+// A run stopped by the context budget guard is a failed cron run: record the
+// error and do not deliver the "start a new session" notice to the channel.
+func TestCronJobHandler_PipelineStopIsFailure(t *testing.T) {
+	mb := bus.New()
+	defer mb.Close()
+
+	sched := scheduler.NewScheduler(
+		scheduler.DefaultLanes(),
+		scheduler.QueueConfig{Mode: scheduler.QueueModeQueue, Cap: 1, Drop: scheduler.DropOld, MaxConcurrent: 1},
+		func(context.Context, agent.RunRequest) (*agent.RunResult, error) {
+			return &agent.RunResult{Content: "context budget notice", StopReason: "final request context budget exceeded"}, nil
+		},
+	)
+	defer sched.Stop()
+
+	handler := makeCronJobHandler(sched, mb, &config.Config{}, nil, nil, nil, nil, nil, nil)
+	_, err := handler(&store.CronJob{
+		ID:             uuid.NewString(),
+		TenantID:       uuid.New(),
+		Name:           "daily-report",
+		AgentID:        "reporter",
+		UserID:         "user-1",
+		Stateless:      true,
+		Deliver:        true,
+		DeliverChannel: "telegram",
+		DeliverTo:      "chat-1",
+		Payload:        store.CronPayload{Kind: "agent_turn", Message: "daily report"},
+	})
+	if err == nil || !strings.Contains(err.Error(), "context budget exceeded") {
+		t.Fatalf("handler error = %v, want the pipeline stop reason", err)
+	}
+
+	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
+	defer cancel()
+	if got, ok := mb.SubscribeOutbound(ctx); ok {
+		t.Fatalf("unexpected outbound message: %#v", got)
+	}
+}
+
 // fakeCronSessionStore records Reset calls. The embedded nil SessionStore
 // satisfies the interface; the cron handler only calls Reset/Save.
 type fakeCronSessionStore struct {
```

**File**: `docs/01-agent-loop.md` (modified, +12/-9)
```diff
@@ -64,12 +64,13 @@ Finalize (runs once, uses background context if cancelled)
 - Call LLM, record span with token counts
 - Emit `chunk` events (streaming) or single response
 
-**PruneStage** (opt-in via `contextPruning.mode: "cache-ttl"`)
-- Estimate token ratio vs context window
-- If >= 25%, run soft trim pass (keep first/last 3000 chars, replace middle with "...")
+**PruneStage** (pruning enabled by default; disable with `contextPruning.mode: "off"`)
+- Count history with the same `BudgetCounter` as ThinkStage's request guard
+- If >= 30%, run soft trim pass (keep first/last 3000 chars, replace middle with "...")
 - If >= 50%, run hard clear pass (replace with placeholder)
 - Run sanitizeHistory to fix broken tool_use/tool_result pairs after prune
 - Trigger memory flush (synchronous) if compaction threshold exceeded
+- Never stops the run: if compaction cannot bring history under budget, ThinkStage's request guard decides
 
 **ToolStage**
 - Execute single tool sequentially (no goroutine overhead)
@@ -430,13 +431,13 @@ Repairs tool message pairing that may have been broken by truncation or compacti
 
 ## 6. Context Pruning
 
-Context pruning reduces oversized tool results using a 2-pass algorithm. **It is opt-in** — configure `contextPruning.mode: "cache-ttl"` to enable. When disabled (default), zero overhead. Owned by PruneStage in the agent pipeline.
+Context pruning reduces oversized tool results using a 2-pass algorithm. **It is enabled by default** (an unset `contextPruning.mode` prunes like `"cache-ttl"`, without the prompt-cache TTL gate); set `contextPruning.mode: "off"` to disable it with zero overhead. Owned by PruneStage in the agent pipeline.
 
 ```mermaid
 flowchart TD
     START[Check mode == cache-ttl?] --> GATE{Mode enabled?}
     GATE -->|No| SKIP[No pruning - zero overhead]
-    GATE -->|Yes| CHECK{Ratio >= softTrimRatio 0.25?}
+    GATE -->|Yes| CHECK{Ratio >= softTrimRatio 0.3?}
     CHECK -->|No| DONE[No pruning needed]
     CHECK -->|Yes| PASS1
 
@@ -451,12 +452,12 @@ flowchart TD
 
 ### Configuration
 
-Enable pruning by setting `contextPruning.mode` in agent defaults:
+Disable pruning by setting `contextPruning.mode` in agent defaults (per-agent `context_pruning` overrides it):
 
 ```json5
 agents: {
   defaults: {
-    contextPruning: { mode: "cache-ttl" }
+    contextPruning: { mode: "off" }
   }
 }
 ```
@@ -465,9 +466,9 @@ agents: {
 
 | Parameter | Default | Description |
 |-----------|---------|-------------|
-| `mode` | `""` (disabled) | `""` or `"off"` = disabled; `"cache-ttl"` = enabled |
+| `mode` | `""` (enabled) | `""` or `"cache-ttl"` = enabled; `"off"` = disabled |
 | `keepLastAssistants` | 3 | Number of recent assistant messages protected from pruning |
-| `softTrimRatio` | 0.25 | Token ratio threshold to trigger Pass 1 |
+| `softTrimRatio` | 0.3 | Token ratio threshold to trigger Pass 1 |
 | `hardClearRatio` | 0.5 | Token ratio threshold to trigger Pass 2 |
 | `minPrunableToolChars` | 50,000 | Minimum tool result length eligible for hard clear |
 
@@ -495,6 +496,8 @@ Trigger: Once per run, inside the iteration loop (between LLM calls)
 Output: In-memory messages replaced with [summary] + [recent 4 messages]
 ```
 
+If there is no clean split point (for example the history is only tool call/result pairs), compaction returns `ErrNotCompacted` and nothing is recorded as compacted. When the final request still exceeds the budget after every reduction step (prune, compact, shrink memory), ThinkStage stops the run with the localized `chat.context_budget_exceeded` notice instead of an error: the run's tool results are still persisted, and the trace is marked `error` with the stop reason. Memory flush and compaction attempts appear in the trace as `memory_flush` and `mid_loop_compaction` event spans.
+
 ### Post-Run Compaction (After Completion)
 
 When the session history exceeds thresholds **after** a run completes, the session is compacted in the background.
```

**File**: `internal/agent/loop_compact_not_compacted_test.go` (added, +33/-0)
```diff
@@ -0,0 +1,33 @@
+package agent
+
+import (
+	"context"
+	"errors"
+	"testing"
+
+	"github.com/nextlevelbuilder/goclaw/internal/pipeline"
+	"github.com/nextlevelbuilder/goclaw/internal/providers"
+)
+
+// A run made only of tool call/result pairs has no clean split point, so
+// compaction cannot summarize anything and must say so explicitly.
+func TestMakeCompactMessages_NoCleanBoundary_ReturnsErrNotCompacted(t *testing.T) {
+	t.Parallel()
+	history := []providers.Message{{Role: "user", Content: "compare pages"}}
+	for _, id := range []string{"c1", "c2", "c3"} {
+		history = append(history,
+			providers.Message{Role: "assistant", ToolCalls: []providers.ToolCall{{ID: id, Name: "read_file"}}},
+			providers.Message{Role: "tool", ToolCallID: id, Content: "result"},
+		)
+	}
+
+	compact := (&Loop{}).makeCompactMessages(nil)
+	got, err := compact(context.Background(), history, "test-model")
+
+	if !errors.Is(err, pipeline.ErrNotCompacted) {
+		t.Fatalf("err = %v, want pipeline.ErrNotCompacted", err)
+	}
+	if got != nil {
+		t.Fatalf("got %d messages, want nil when nothing was compacted", len(got))
+	}
+}
```

---

### Incident Patch 3: `4e99816a` (2026-09-29)
**Commit Message**: fix(channels): deliver NO_REPLY placeholder cleanup signal to channels (#1586)

The agent loop signals silent replies (NO_REPLY, cancelled runs, suppressed
errors) by publishing an outbound message with empty content plus the inbound
routing metadata (placeholder_key / local_key). Slack, Telegram and Discord
each implement an empty-content branch in Send() that deletes their streamed
'Thinking...' placeholder — the partial draft left visible in the thread when
delivery is suppressed.

deliverOutbound skipped every text-only empty outbound, so that cleanup
signal never reached channel.Send and the stray partial draft stayed
published (issue #1475). Pass the signal through when placeholder routing
metadata is present; keep skipping bare empty messages so channels without
an empty-content branch never render empty bubbles.

Fixes #1475

**File**: `internal/channels/dispatch.go` (modified, +10/-1)
```diff
@@ -148,7 +148,16 @@ func (m *Manager) deliverOutbound(ctx context.Context, msg bus.OutboundMessage)
 	msg.Media = kept
 
 	// If only media was in this message and every file is gone, skip entirely.
-	if len(msg.Media) == 0 && msg.Content == "" {
+	// Exception: empty content carrying placeholder routing metadata is the
+	// agent loop's NO_REPLY / silent-reply cleanup signal — channels such as
+	// Slack, Telegram and Discord implement an empty-content branch in Send()
+	// that deletes their streamed "Thinking..." placeholder. Dropping the
+	// message here leaves the partial streamed draft visible in the thread
+	// (issue #1475). Messages without that metadata are not cleanup signals
+	// and stay skipped so channels without an empty-content branch never
+	// render empty bubbles.
+	if len(msg.Media) == 0 && msg.Content == "" &&
+		msg.Metadata["placeholder_key"] == "" && msg.Metadata["local_key"] == "" {
 		return
 	}
 
```

**File**: `internal/channels/dispatch_test.go` (modified, +52/-0)
```diff
@@ -83,3 +83,55 @@ func TestHandleSendFailure_NonForwardTextOnlyDropped(t *testing.T) {
 		t.Fatalf("expected no notice sent for non-forward text-only failure, got: %+v", ch.lastMsg)
 	}
 }
+
+// Issue #1475: the agent loop signals NO_REPLY / silent replies by publishing
+// an outbound message with empty content plus the inbound routing metadata
+// (placeholder_key / local_key). Slack, Telegram and Discord implement an
+// empty-content branch in Send() that deletes the streamed "Thinking..."
+// placeholder — the stray partial draft left behind when delivery is
+// suppressed. deliverOutbound must not drop these cleanup signals before
+// they reach the channel.
+func TestDeliverOutbound_EmptyContentWithPlaceholderMetaReachesSend(t *testing.T) {
+	t.Parallel()
+
+	mgr := NewManager(bus.New())
+	ch := newMockChannel("slack-main", TypeSlack)
+	mgr.channels["slack-main"] = ch
+
+	msg := bus.OutboundMessage{
+		Channel: "slack-main",
+		ChatID:  "C012345",
+		Content: "",
+		Metadata: map[string]string{
+			"placeholder_key": "C012345:thread:1727500000.000100",
+			"local_key":       "C012345:thread:1727500000.000100",
+		},
+	}
+
+	mgr.deliverOutbound(context.Background(), msg)
+
+	if ch.lastMsg.Content != "" || ch.lastMsg.ChatID != "C012345" {
+		t.Fatal("empty-content cleanup signal with placeholder metadata was dropped before reaching channel.Send — stray partial draft is never deleted (issue #1475)")
+	}
+}
+
+// The media-gone skip must keep working for empty messages that carry no
+// placeholder routing metadata: those are NOT cleanup signals, and delivering
+// them would make channels without an empty-content branch render empty bubbles.
+func TestDeliverOutbound_EmptyContentWithoutMetaStillSkipped(t *testing.T) {
+	t.Parallel()
+
+	mgr := NewManager(bus.New())
+	ch := newMockChannel("feishu-main", TypeFeishu)
+	mgr.channels["feishu-main"] = ch
+
+	mgr.deliverOutbound(context.Background(), bus.OutboundMessage{
+		Channel: "feishu-main",
+		ChatID:  "oc_1",
+		Content: "",
+	})
+
+	if ch.lastMsg.ChatID != "" {
+		t.Fatalf("empty content without routing metadata should be skipped, got: %+v", ch.lastMsg)
+	}
+}
```

---

### Incident Patch 4: `a1913f81` (2026-09-28)
**Commit Message**: fix(gateway): admit operator.provision keys on tenants.create and ten… (#1584)

* fix(gateway): admit operator.provision keys on tenants.create and tenants.users.add

The CVE #866 fail-closed hardening regressed operator.provision: the
role-only router check maps provision-only API keys to viewer and
rejects tenants.create / tenants.users.add with 'requires admin role',
even though the tenant handlers explicitly admit ScopeProvision on
exactly those two methods (issue #1524).

Restore the intended least-privilege provisioning path without any role
promotion: the router now allows credentials carrying ScopeProvision on
exactly the two tenant-provisioning RPCs (permissions.IsProvisionMethod).
Every other admin/write surface stays denied, and viewers without the
provision scope gain nothing.

Regression tests (internal/gateway/router_test.go) prove:
- provision-only succeeds on tenants.create and tenants.users.add
- provision-only stays denied on tenants.update and agents.create
- plain viewers stay denied on the provisioning methods
- unauthenticated clients stay denied

* refactor(gateway): route provisionScopeAllowed through permissions.HasProvisionScope

Address review feedback on

**File**: `internal/gateway/router.go` (modified, +17/-1)
```diff
@@ -67,7 +67,16 @@ func (r *MethodRouter) Handle(ctx context.Context, client *Client, req *protocol
 	// Permission check: skip for connect, health, and browser pairing status (used by unauthenticated clients)
 	if req.Method != protocol.MethodConnect && req.Method != protocol.MethodHealth && req.Method != protocol.MethodBrowserPairingStatus {
 		if pe := r.server.policyEngine; pe != nil {
-			if !pe.CanAccess(client.role, req.Method) {
+			// provisionScopeAllowed implements the narrow method-scoped
+			// exception for operator.provision credentials (issue #1524, a
+			// regression from the CVE #866 fail-closed hardening). The tenant
+			// handlers already admit ScopeProvision on tenants.create and
+			// tenants.users.add, but the role-only check below maps
+			// provision-only keys to viewer and rejects them before the
+			// handler runs. The exception grants exactly those two methods to
+			// credentials carrying ScopeProvision — no role promotion, and
+			// every other admin/write surface stays denied.
+			if !pe.CanAccess(client.role, req.Method) && !provisionScopeAllowed(client, req.Method) {
 				required := permissions.MethodRole(req.Method)
 				slog.Warn("security.permission_denied",
 					"method", req.Method,
@@ -121,6 +130,13 @@ func (r *MethodRouter) registerDefaults() {
 	r.Register(protocol.MethodStatus, r.handleStatus)
 }
 
+// provisionScopeAllowed reports whether a client carrying the operator.provision
+// scope may call the given method. True only for the two tenant-provisioning
+// RPCs — see permissions.IsProvisionMethod.
+func provisionScopeAllowed(c *Client, method string) bool {
+	return permissions.HasProvisionScope(c.scopes) && permissions.IsProvisionMethod(method)
+}
+
 // --- Built-in handlers ---
 
 func (r *MethodRouter) handleConnect(ctx context.Context, client *Client, req *protocol.RequestFrame) {
```

**File**: `internal/gateway/router_test.go` (modified, +89/-0)
```diff
@@ -6,6 +6,8 @@ import (
 	"testing"
 	"time"
 
+	"github.com/google/uuid"
+
 	"github.com/nextlevelbuilder/goclaw/internal/config"
 	"github.com/nextlevelbuilder/goclaw/internal/permissions"
 	"github.com/nextlevelbuilder/goclaw/pkg/protocol"
@@ -62,3 +64,90 @@ func TestHandleConnectAllowsExplicitInsecureNoTokenOptIn(t *testing.T) {
 		t.Fatalf("role = %q, want operator", client.role)
 	}
 }
+
+// callMethod dispatches method through the router and returns the response frame.
+func callMethod(t *testing.T, server *Server, client *Client, method string) *protocol.ResponseFrame {
+	t.Helper()
+	req := &protocol.RequestFrame{ID: "req-" + method, Method: method}
+	server.router.Handle(context.Background(), client, req)
+	select {
+	case raw := <-client.send:
+		var resp protocol.ResponseFrame
+		if err := json.Unmarshal(raw, &resp); err != nil {
+			t.Fatalf("unmarshal response: %v", err)
+		}
+		return &resp
+	case <-time.After(500 * time.Millisecond):
+		t.Fatalf("expected a response frame for %s", method)
+		return nil
+	}
+}
+
+// TestRouterProvisionScopeTenantMethods covers the narrow method-scoped
+// exception for operator.provision credentials (issue #1524): provision-only
+// API keys are admitted on exactly tenants.create and tenants.users.add —
+// the two methods the tenant handlers already gate on ScopeProvision — while
+// every other admin/write surface stays denied and plain viewers gain nothing.
+func TestRouterProvisionScopeTenantMethods(t *testing.T) {
+	cfg := config.Default()
+	cfg.Gateway.Host = "127.0.0.1"
+	cfg.Gateway.Token = "test-token"
+
+	server := NewServer(cfg, nil, nil, nil)
+	server.SetPolicyEngine(permissions.NewPolicyEngine(nil))
+
+	reached := map[string]bool{}
+	for _, method := range []string{
+		protocol.MethodTenantsCreate,
+		protocol.MethodTenantsUsersAdd,
+		protocol.MethodTenantsUpdate,
+		protocol.MethodAgentsCreate,
+	} {
+		m := method
+		server.router.Register(m, func(ctx context.Context, c *Client, req *protocol.RequestFrame) {
+			reached[m] = true
+			c.SendResponse(protocol.NewOKResponse(req.ID, map[string]any{"ok": true}))
+		})
+	}
+
+	// Provision-only API key: RoleFromScopes maps it to viewer; scopes carry
+	// operator.provision (as the WS connect path would set them).
+	prov, _ := NewCapturingTestClient(permissions.RoleViewer, uuid.Nil, "provisioner", 8)
+	prov.scopes = []permissions.Scope{permissions.ScopeProvision}
+
+	// 1) Provision-only succeeds on the two tenant-provisioning methods.
+	for _, method := range []string{protocol.MethodTenantsCreate, protocol.MethodTenantsUsersAdd} {
+		resp := callMethod(t, server, prov, method)
+		if resp.Error != nil {
+			t.Fatalf("provision-only %s: unexpected error %v (code %s)", method, resp.Error.Message, resp.Error.Code)
+		}
+		if !reached[method] {
+			t.Fatalf("provision-only %s: handler never invoked", method)
+		}
+	}
+
+	// 2) Provision-only remains denied on other admin/write surfaces.
+	for _, method := range []string{protocol.MethodTenantsUpdate, protocol.MethodAgentsCreate} {
+		resp := callMethod(t, server, prov, method)
+		if resp.Error == nil || resp.Error.Code != protocol.ErrUnauthorized {
+			t.Fatalf("provision-only %s: want unauthorized, got error=%v reached=%v", method, resp.Error, reached[method])
+		}
+	}
+
+	// 3) A viewer WITHOUT the provision scope still cannot reach the two
+	// tenant-provisioning methods.
+	viewer, _ := NewCapturingTestClient(permissions.RoleViewer, uuid.Nil, "viewer", 8)
+	for _, method := range []string{protocol.MethodTenantsCreate, protocol.MethodTenantsUsersAdd} {
+		resp := callMethod(t, server, viewer, method)
+		if resp.Error == nil || resp.Error.Code != protocol.ErrUnauthorized {
+			t.Fatalf("plain viewer %s: want unauthorized, got error=%v reached=%v", method, resp.Error, reached[method])
+		}
+	}
+
+	// 4) An unauthenticated client stays denied.
+	anon, _ := NewCapturingTestClient("", uuid.Nil, "", 8)
+	resp := callMethod(t, server, anon, protocol.MethodTenantsCreate)
+	if re
```

**File**: `internal/permissions/policy.go` (modified, +18/-0)
```diff
@@ -168,6 +168,24 @@ func RoleFromScopes(scopes []Scope) Role {
 	return RoleViewer
 }
 
+// IsProvisionMethod reports whether method is one of the tenant-provisioning
+// RPCs that ScopeProvision exists to grant (issue #1524). ScopeProvision is a
+// least-privilege scope for automated tenant onboarding: it admits exactly
+// these two methods and nothing else — never a role promotion or a broad
+// admin bypass.
+func IsProvisionMethod(method string) bool {
+	switch method {
+	case protocol.MethodTenantsCreate, protocol.MethodTenantsUsersAdd:
+		return true
+	}
+	return false
+}
+
+// HasProvisionScope reports whether scopes include ScopeProvision.
+func HasProvisionScope(scopes []Scope) bool {
+	return slices.Contains(scopes, ScopeProvision)
+}
+
 // MethodRole returns the minimum role required for a given RPC method.
 //
 // Policy is fail-closed (default-deny): methods absent from every allowlist
```

**File**: `internal/permissions/policy_test.go` (modified, +39/-0)
```diff
@@ -91,6 +91,45 @@ func TestRoleFromScopes(t *testing.T) {
 	}
 }
 
+// TestIsProvisionMethod covers the ScopeProvision method allowlist (issue #1524):
+// exactly tenants.create and tenants.users.add, nothing else.
+func TestIsProvisionMethod(t *testing.T) {
+	allowed := []string{protocol.MethodTenantsCreate, protocol.MethodTenantsUsersAdd}
+	for _, method := range allowed {
+		if !IsProvisionMethod(method) {
+			t.Fatalf("IsProvisionMethod(%q) = false, want true", method)
+		}
+	}
+	denied := []string{
+		protocol.MethodTenantsUpdate,
+		protocol.MethodTenantsUsersRemove,
+		protocol.MethodAgentsCreate,
+		protocol.MethodAPIKeysCreate,
+		protocol.MethodConfigApply,
+		"tenants.nonexistent",
+	}
+	for _, method := range denied {
+		if IsProvisionMethod(method) {
+			t.Fatalf("IsProvisionMethod(%q) = true, want false", method)
+		}
+	}
+}
+
+func TestHasProvisionScope(t *testing.T) {
+	if !HasProvisionScope([]Scope{ScopeProvision}) {
+		t.Fatal("HasProvisionScope([operator.provision]) = false, want true")
+	}
+	if !HasProvisionScope([]Scope{ScopeRead, ScopeProvision}) {
+		t.Fatal("HasProvisionScope([operator.read operator.provision]) = false, want true")
+	}
+	if HasProvisionScope(nil) {
+		t.Fatal("HasProvisionScope(nil) = true, want false")
+	}
+	if HasProvisionScope([]Scope{ScopeAdmin}) {
+		t.Fatal("HasProvisionScope([operator.admin]) = true, want false")
+	}
+}
+
 // --- CanAccess: role-based method access ---
 
 func TestCanAccess_AdminMethods(t *testing.T) {
```

---

### Incident Patch 5: `cbb72ccd` (2026-09-27)
**Commit Message**: Merge pull request #1582 from modelpath-dev/fix/1554-vault-body-search

fix(vault): search document bodies and match any query word (#1554)

**File**: `docs/24-knowledge-vault.md` (modified, +17/-3)
```diff
@@ -86,7 +86,8 @@ Document registry: metadata pointers. Content lives on filesystem; registry hold
 | `doc_type` | TEXT | context, memory, note, skill, episodic |
 | `content_hash` | TEXT | SHA-256 of file content (detects changes) |
 | `embedding` | vector(1536) | pgvector: semantic similarity |
-| `tsv` | tsvector | Generated: FTS index on title+path |
+| `tsv` | tsvector | Generated: FTS index on title+path+summary |
+| `body_indexed_hash` | TEXT | `content_hash` the body chunks were built from (NULL = not chunked yet) |
 | `metadata` | JSONB | Optional custom fields |
 | `created_at`, `updated_at` | TIMESTAMPTZ | Timestamps |
 | **Unique constraint** | (agent_id, scope, path) | One doc per path per scope |
@@ -99,6 +100,19 @@ Document registry: metadata pointers. Content lives on filesystem; registry hold
 - `idx_vault_docs_embedding` — HNSW vector (semantic search)
 - `idx_vault_docs_tsv` — GIN FTS index (keyword search)
 
+### vault_document_chunks
+
+The body of each text document, split into ~1000-char chunks (200-char overlap), so search reaches content that the auto-summary leaves out. The enrich worker rebuilds the chunks from the workspace file whenever `content_hash` moves past `body_indexed_hash`. `POST /v1/vault/rescan` also backfills docs that have no chunks yet. Media and `document` types are not chunked.
+
+| Column | Type | Notes |
+|--------|------|-------|
+| `document_id` | UUID | Parent doc (cascade delete) |
+| `chunk_index` | INT | Position in the body |
+| `start_line`, `end_line` | INT | Line range in the file |
+| `text` | TEXT | Chunk content |
+| `embedding` | vector(1536) | Only the first 64 chunks of a doc are embedded |
+| `tsv` | tsvector | Generated: FTS on `text` ('simple' config) |
+
 ### vault_links
 
 Bidirectional links between documents (wikilinks, explicit references).
@@ -192,8 +206,8 @@ Hybrid search integrates vault FTS, vector embeddings, episodic memory, and know
 
 `VaultStore.Search(ctx, opts VaultSearchOptions)` on single vault:
 
-- **FTS**: PostgreSQL `plainto_tsquery()` on tsv (title+path keywords)
-- **Vector**: pgvector cosine similarity on embedding (semantic)
+- **FTS**: matches any query word (OR), so natural-language questions work; docs matching more words rank higher. Runs on the doc `tsv` and on body chunks, and a doc scores by its best hit
+- **Vector**: pgvector cosine similarity on the doc embedding and on chunk embeddings, best hit per doc
 - **Combined scoring**: Normalize each method's scores (0–1), then apply query-time weights
 - **Results:** Top N documents with score
 
```

**File**: `internal/http/vault_handlers.go` (modified, +5/-0)
```diff
@@ -218,6 +218,11 @@ func (h *VaultHandler) handleRescan(w http.ResponseWriter, r *http.Request) {
 		}
 	}
 
+	// Backfill body chunks for docs indexed before chunking existed, or whose
+	// file changed without the chunks catching up. Detached from the request
+	// so a big vault is not cut off by the rescan timeout.
+	go vault.IndexStaleBodies(context.WithoutCancel(r.Context()), h.store, tenantID, wsPath)
+
 	if h.enrichProgress != nil && total > 0 {
 		h.enrichProgress.Start(total, store.TenantIDFromContext(r.Context()))
 	}
```

**File**: `internal/store/pg/vault_chunks.go` (added, +121/-0)
```diff
@@ -0,0 +1,121 @@
+package pg
+
+import (
+	"context"
+	"database/sql"
+	"errors"
+	"fmt"
+	"log/slog"
+
+	"github.com/google/uuid"
+
+	"github.com/nextlevelbuilder/goclaw/internal/store"
+)
+
+// vaultMaxEmbeddedChunks caps how many chunks of one document get an embedding.
+// Every chunk is still full-text indexed; chunks past the cap only lack a vector.
+const vaultMaxEmbeddedChunks = 64
+
+// ReplaceDocumentChunks swaps the body chunks of a document and embeds them.
+// No-op when the stored chunks were already built from contentHash.
+func (s *PGVaultStore) ReplaceDocumentChunks(ctx context.Context, tenantID, docID, contentHash string, chunks []store.VaultChunk) error {
+	tid, err := parseUUID(tenantID)
+	if err != nil {
+		return fmt.Errorf("vault replace chunks: tenant: %w", err)
+	}
+	did, err := parseUUID(docID)
+	if err != nil {
+		return fmt.Errorf("vault replace chunks: doc: %w", err)
+	}
+
+	var indexedHash sql.NullString
+	err = s.db.QueryRowContext(ctx,
+		`SELECT body_indexed_hash FROM vault_documents WHERE id = $1 AND tenant_id = $2`,
+		did, tid,
+	).Scan(&indexedHash)
+	if err != nil {
+		return fmt.Errorf("vault replace chunks: fetch doc: %w", err)
+	}
+	if indexedHash.Valid && indexedHash.String == contentHash {
+		return nil
+	}
+
+	// Embed outside the transaction; a failed embed still leaves the chunks
+	// searchable by keyword.
+	embeddings := make([]*string, len(chunks))
+	if s.embProvider != nil && len(chunks) > 0 {
+		n := min(len(chunks), vaultMaxEmbeddedChunks)
+		texts := make([]string, n)
+		for i := range n {
+			texts[i] = chunks[i].Text
+		}
+		vecs, embErr := s.embProvider.Embed(ctx, texts)
+		if embErr != nil {
+			slog.Warn("vault.chunks: embed", "doc", docID, "err", embErr)
+		}
+		for i := range min(len(vecs), n) {
+			v := vectorToString(vecs[i])
+			embeddings[i] = &v
+		}
+	}
+
+	tx, err := s.db.BeginTx(ctx, nil)
+	if err != nil {
+		return fmt.Errorf("vault replace chunks: begin: %w", err)
+	}
+	defer tx.Rollback()
+
+	if _, err := tx.ExecContext(ctx,
+		`DELETE FROM vault_document_chunks WHERE document_id = $1 AND tenant_id = $2`, did, tid,
+	); err != nil {
+		return fmt.Errorf("vault replace chunks: delete: %w", err)
+	}
+	for i, c := range chunks {
+		if _, err := tx.ExecContext(ctx, `
+			INSERT INTO vault_document_chunks
+				(id, tenant_id, document_id, chunk_index, start_line, end_line, text, embedding)
+			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
+			uuid.Must(uuid.NewV7()), tid, did, c.Index, c.StartLine, c.EndLine, c.Text, embeddings[i],
+		); err != nil {
+			return fmt.Errorf("vault replace chunks: insert: %w", err)
+		}
+	}
+	res, err := tx.ExecContext(ctx,
+		`UPDATE vault_documents SET body_indexed_hash = $1 WHERE id = $2 AND tenant_id = $3`,
+		contentHash, did, tid,
+	)
+	if err != nil {
+		return fmt.Errorf("vault replace chunks: mark indexed: %w", err)
+	}
+	if n, _ := res.RowsAffected(); n == 0 {
+		return errors.New("vault replace chunks: document deleted")
+	}
+	return tx.Commit()
+}
+
+// ListDocsNeedingBodyIndex returns text documents whose chunks are missing or stale.
+// Media and binary documents are skipped: they have no text body to index.
+func (s *PGVaultStore) ListDocsNeedingBodyIndex(ctx context.Context, tenantID string, limit int) ([]store.VaultDocument, error) {
+	tid, err := parseUUID(tenantID)
+	if err != nil {
+		return nil, fmt.Errorf("vault list needing body index: tenant: %w", err)
+	}
+
+	q := `SELECT id, tenant_id, agent_id, team_id, chat_id, scope, custom_scope, path, path_basename, title, doc_type,
+			content_hash, summary, metadata, created_at, updated_at
+		FROM vault_documents
+		WHERE tenant_id = $1 AND doc_type NOT IN ('media', 'document')
+			AND body_indexed_hash IS DISTINCT FROM content_hash
+		ORDER BY created_at ASC`
+	args := []any{tid}
+	if limit > 0 {
+		q += " LIMIT $2"
+		args = append(args, limit)
+	}
+
+	var rows []vaultDocRow
+	if err := pkgSqlxDB.SelectContext(ctx, &rows, q, args...); err != nil {
+		return nil, fmt.
```

**File**: `internal/store/pg/vault_documents.go` (modified, +112/-54)
```diff
@@ -440,7 +440,7 @@ func (s *PGVaultStore) UpdateHash(ctx context.Context, tenantID, id, newHash str
 // UpdateSummaryAndReembed updates summary and re-generates embedding from title+path+summary.
 // UpdateSummaryAndReembed and FindSimilarDocs moved to vault_documents_enrichment.go.
 
-// Search performs hybrid FTS + vector search on vault_documents.
+// Search performs hybrid FTS + vector search on vault documents and their body chunks.
 func (s *PGVaultStore) Search(ctx context.Context, opts store.VaultSearchOptions) ([]store.VaultSearchResult, error) {
 	tid, err := parseUUID(opts.TenantID)
 	if err != nil {
@@ -451,18 +451,22 @@ func (s *PGVaultStore) Search(ctx context.Context, opts store.VaultSearchOptions
 		return nil, fmt.Errorf("vault search: agent: %w", err)
 	}
 
-	// Build team filter for search sub-queries.
-	tf := buildSearchTeamFilter(opts.TeamID, opts.TeamIDs)
-	// Chat-scope filter (applies only when team is isolated + chat_id non-nil/non-empty).
-	cf := buildSearchChatFilter(opts.ChatID, opts.TeamIsolated)
+	f := vaultSearchScope{
+		agentID: aid,
+		team:    buildSearchTeamFilter(opts.TeamID, opts.TeamIDs),
+		// Chat-scope filter (applies only when team is isolated + chat_id non-nil/non-empty).
+		chat:     buildSearchChatFilter(opts.ChatID, opts.TeamIsolated),
+		scope:    opts.Scope,
+		docTypes: opts.DocTypes,
+	}
 
 	maxResults := opts.MaxResults
 	if maxResults <= 0 {
 		maxResults = 10
 	}
 
 	// FTS search
-	ftsResults, err := s.ftsSearch(ctx, opts.Query, tid, aid, tf, cf, opts.Scope, opts.DocTypes, maxResults*2)
+	ftsResults, err := s.ftsSearch(ctx, opts.Query, tid, f, maxResults*2)
 	if err != nil {
 		return nil, err
 	}
@@ -473,7 +477,7 @@ func (s *PGVaultStore) Search(ctx context.Context, opts store.VaultSearchOptions
 		vecs, embErr := s.embProvider.Embed(ctx, []string{opts.Query})
 		if embErr == nil && len(vecs) > 0 {
 			var vecErr error
-			vecResults, vecErr = s.vectorSearch(ctx, vecs[0], tid, aid, tf, cf, opts.Scope, opts.DocTypes, maxResults*2)
+			vecResults, vecErr = s.vectorSearch(ctx, vecs[0], tid, f, maxResults*2)
 			if vecErr != nil {
 				slog.Debug("vault.vector_search_fallback", "err", vecErr)
 				vecResults = nil
@@ -569,35 +573,55 @@ func (cf searchChatFilter) append(q string, args []any, p int) (string, []any, i
 	return q, args, p
 }
 
-func (s *PGVaultStore) ftsSearch(ctx context.Context, query string, tenantID uuid.UUID, agentID *uuid.UUID, tf searchTeamFilter, cf searchChatFilter, scope string, docTypes []string, limit int) ([]store.VaultSearchResult, error) {
-	q := `SELECT id, tenant_id, agent_id, team_id, chat_id, scope, custom_scope, path, path_basename, title, doc_type, content_hash, summary, metadata, created_at, updated_at,
-			ts_rank(tsv, plainto_tsquery('simple', $1)) AS score
-		FROM vault_documents
-		WHERE tenant_id = $2 AND tsv @@ plainto_tsquery('simple', $1)`
-	args := []any{query, tenantID}
-	p := 3
+// vaultAnyTermQuery matches docs containing any word of $1. plainto_tsquery
+// ANDs every word, and the 'simple' config keeps filler words like "what" or
+// "the", so a plain question never matched anything. Lexemes come out of
+// plainto_tsquery already quoted and never contain spaces, so swapping the
+// operators is safe. ts_rank still puts docs matching more words first.
+const vaultAnyTermQuery = `replace(plainto_tsquery('simple', $1)::text, ' & ', ' | ')::tsquery`
+
+// vaultDocCols is the vault_documents column list scanned into vaultDocRow,
+// qualified for queries that join the chunks table.
+const vaultDocCols = `d.id, d.tenant_id, d.agent_id, d.team_id, d.chat_id, d.scope, d.custom_scope, d.path, d.path_basename,
+	d.title, d.doc_type, d.content_hash, d.summary, d.metadata, d.created_at, d.updated_at`
+
+// vaultSearchScope holds the visibility filters shared by every search sub-query.
+type vaultSearchScope struct {
+	agentID  *uuid.UUID
+	team     searchTeamFilter
+	chat     searchChatFilter
+	scope    string
+	docTypes []string
+}
 
-	i
```

**File**: `internal/store/sqlitestore/vault_documents.go` (modified, +10/-0)
```diff
@@ -345,6 +345,16 @@ func (s *SQLiteVaultStore) FindSimilarDocs(ctx context.Context, tenantID, agentI
 	return nil, nil
 }
 
+// ReplaceDocumentChunks is a no-op in SQLite (search is LIKE on title/path, no FTS).
+func (s *SQLiteVaultStore) ReplaceDocumentChunks(ctx context.Context, tenantID, docID, contentHash string, chunks []store.VaultChunk) error {
+	return nil
+}
+
+// ListDocsNeedingBodyIndex is a no-op in SQLite (body chunks are not stored).
+func (s *SQLiteVaultStore) ListDocsNeedingBodyIndex(ctx context.Context, tenantID string, limit int) ([]store.VaultDocument, error) {
+	return nil, nil
+}
+
 // Search performs LIKE-based search on vault documents (no FTS/vector in lite).
 func (s *SQLiteVaultStore) Search(ctx context.Context, opts store.VaultSearchOptions) ([]store.VaultSearchResult, error) {
 	query := opts.Query
```

---

### Incident Patch 6: `77f4fdd7` (2026-09-27)
**Commit Message**: fix(vault): retry body indexing after a failed attempt

The enrich worker recorded a doc in its dedup map even when writing its
body chunks failed, so the next event with the same content hash was
skipped and the doc stayed without chunks until a manual rescan.

indexBody now returns its error and processChunk leaves those docs out of
the dedup map, so the next event for the same hash tries again. Docs whose
chunks were written are still deduplicated as before.

**File**: `internal/vault/body_index.go` (modified, +6/-3)
```diff
@@ -38,15 +38,18 @@ func chunkBody(raw []byte) []store.VaultChunk {
 
 // indexBody rebuilds the body chunks of one text document from its workspace
 // file. The store skips the write when the chunks already match contentHash.
-func indexBody(ctx context.Context, vs store.VaultStore, tenantID, docID, contentHash, fullPath string) {
+// Failures are logged here; the error only tells the caller to retry later.
+func indexBody(ctx context.Context, vs store.VaultStore, tenantID, docID, contentHash, fullPath string) error {
 	raw, err := os.ReadFile(fullPath)
 	if err != nil {
 		slog.Warn("vault.body_index: read_file", "path", fullPath, "err", err)
-		return
+		return err
 	}
 	if err := vs.ReplaceDocumentChunks(ctx, tenantID, docID, contentHash, chunkBody(raw)); err != nil {
 		slog.Warn("vault.body_index: replace_chunks", "doc", docID, "err", err)
+		return err
 	}
+	return nil
 }
 
 // bodyIndexRuns keeps one IndexStaleBodies pass per tenant.
@@ -72,7 +75,7 @@ func IndexStaleBodies(ctx context.Context, vs store.VaultStore, tenantID, worksp
 		if ctx.Err() != nil {
 			return true
 		}
-		indexBody(ctx, vs, tenantID, doc.ID, doc.ContentHash, filepath.Join(workspace, doc.Path))
+		_ = indexBody(ctx, vs, tenantID, doc.ID, doc.ContentHash, filepath.Join(workspace, doc.Path))
 	}
 	if len(docs) > 0 {
 		slog.Info("vault.body_index: backfilled", "tenant", tenantID, "count", len(docs))
```

**File**: `internal/vault/enrich_body_retry_test.go` (added, +107/-0)
```diff
@@ -0,0 +1,107 @@
+package vault
+
+import (
+	"context"
+	"errors"
+	"os"
+	"path/filepath"
+	"sync"
+	"testing"
+
+	"github.com/google/uuid"
+	"github.com/nextlevelbuilder/goclaw/internal/eventbus"
+	"github.com/nextlevelbuilder/goclaw/internal/providers"
+	"github.com/nextlevelbuilder/goclaw/internal/store"
+	"golang.org/x/sync/semaphore"
+)
+
+// fakeVaultStoreBodyRetry fails ReplaceDocumentChunks a set number of times,
+// then stores the chunks. Everything else the enrich pipeline touches is a no-op.
+type fakeVaultStoreBodyRetry struct {
+	store.VaultStore
+	doc       store.VaultDocument
+	failsLeft int
+	calls     int
+	chunks    []store.VaultChunk
+}
+
+func (f *fakeVaultStoreBodyRetry) GetDocumentsByIDs(ctx context.Context, tenantID string, ids []string) ([]store.VaultDocument, error) {
+	return []store.VaultDocument{f.doc}, nil
+}
+
+func (f *fakeVaultStoreBodyRetry) ReplaceDocumentChunks(ctx context.Context, tenantID, docID, contentHash string, chunks []store.VaultChunk) error {
+	f.calls++
+	if f.failsLeft > 0 {
+		f.failsLeft--
+		return errors.New("connection reset")
+	}
+	f.chunks = chunks
+	return nil
+}
+
+func (f *fakeVaultStoreBodyRetry) UpdateSummaryAndReembed(ctx context.Context, tenantID, docID, summary string) error {
+	return nil
+}
+
+func (f *fakeVaultStoreBodyRetry) FindSimilarDocs(ctx context.Context, tenantID, agentID, docID string, limit int) ([]store.VaultSearchResult, error) {
+	return nil, nil
+}
+
+func (f *fakeVaultStoreBodyRetry) GetDocumentByID(ctx context.Context, tenantID, id string) (*store.VaultDocument, error) {
+	return nil, errors.New("not needed")
+}
+
+// A transient body-index failure must not mark the doc as processed, or the
+// next event with the same hash is dropped and the doc never gets chunks.
+func TestEnrichWorker_RetriesBodyIndexAfterFailure(t *testing.T) {
+	ws := t.TempDir()
+	if err := os.WriteFile(filepath.Join(ws, "prices.md"), []byte("Deluxe Ocean Suite 4,200,000\n"), 0o644); err != nil {
+		t.Fatal(err)
+	}
+	tenantID := providers.MasterTenantID.String()
+	docID := uuid.NewString()
+	fs := &fakeVaultStoreBodyRetry{
+		doc: store.VaultDocument{
+			ID: docID, TenantID: tenantID, Path: "prices.md", DocType: "note",
+			ContentHash: "h1", Summary: "Hotel room rates.",
+		},
+		failsLeft: 1,
+	}
+	reg := providers.NewRegistry(nil)
+	reg.Register(&mockClassifyProvider{})
+	w := &EnrichWorker{
+		vault:       fs,
+		registry:    reg,
+		dedup:       make(map[string]string),
+		sem:         semaphore.NewWeighted(enrichMaxConcurrent),
+		progress:    NewEnrichProgress(nil),
+		cancelFuncs: &sync.Map{},
+	}
+	event := eventbus.DomainEvent{Payload: eventbus.VaultDocUpsertedPayload{
+		DocID: docID, TenantID: tenantID, Path: "prices.md", ContentHash: "h1", Workspace: ws,
+	}}
+
+	ctx := context.Background()
+	if err := w.Handle(ctx, event); err != nil {
+		t.Fatalf("first Handle: %v", err)
+	}
+	if fs.chunks != nil {
+		t.Fatal("chunks written although ReplaceDocumentChunks failed")
+	}
+
+	// Same event again, e.g. the next file save or sync tick.
+	if err := w.Handle(ctx, event); err != nil {
+		t.Fatalf("second Handle: %v", err)
+	}
+	if len(fs.chunks) != 1 || fs.chunks[0].Text != "Deluxe Ocean Suite 4,200,000" {
+		t.Fatalf("chunks after replay = %+v, want the file body", fs.chunks)
+	}
+
+	// Once indexed, the dedup gate applies again.
+	if err := w.Handle(ctx, event); err != nil {
+		t.Fatalf("third Handle: %v", err)
+	}
+	if fs.calls != 2 {
+		t.Fatalf("ReplaceDocumentChunks calls = %d, want 2", fs.calls)
+	}
+}
```

**File**: `internal/vault/enrich_worker.go` (modified, +10/-2)
```diff
@@ -324,9 +324,15 @@ func (w *EnrichWorker) processChunk(ctx context.Context, items []eventbus.VaultD
 	}
 
 	// Body chunks need no LLM, so they are indexed even without a provider.
+	// Docs whose body failed to index are kept out of the dedup map below,
+	// otherwise the next event for the same hash would be skipped and the
+	// doc would stay without chunks until someone runs a rescan.
+	bodyFailed := make(map[string]bool)
 	for _, item := range pending {
 		if doc := docMap[item.DocID]; doc != nil && doc.DocType != "media" && doc.DocType != "document" {
-			indexBody(ctx, w.vault, tenantID, item.DocID, item.ContentHash, filepath.Join(item.Workspace, item.Path))
+			if err := indexBody(ctx, w.vault, tenantID, item.DocID, item.ContentHash, filepath.Join(item.Workspace, item.Path)); err != nil {
+				bodyFailed[item.DocID] = true
+			}
 		}
 	}
 
@@ -454,7 +460,9 @@ func (w *EnrichWorker) processChunk(ctx context.Context, items []eventbus.VaultD
 
 	// Phase 4 — Record dedup + wikilinks.
 	for _, r := range embedded {
-		w.recordDedup(r.payload.DocID, r.payload.ContentHash)
+		if !bodyFailed[r.payload.DocID] {
+			w.recordDedup(r.payload.DocID, r.payload.ContentHash)
+		}
 		w.syncWikilinks(ctx, r.payload)
 	}
 }
```

---

### Incident Patch 7: `65dbbcfd` (2026-09-27)
**Commit Message**: fix(vault): search document bodies and match any query word (#1554)

vault_search only indexed title + path + the auto-summary, and the summary
is written from the first 3000 runes of the file. Anything the summary left
out (room names, prices, codes) could never be found. On top of that the
FTS query used plainto_tsquery, which ANDs every word, so a normal question
like "what is the price of the Deluxe Ocean Suite?" matched nothing even when
the key words were indexed.

- Add vault_document_chunks (migration 98): the file body split into
  chunks with their own tsvector and embedding. body_indexed_hash on
  vault_documents records which content_hash the chunks came from, so
  unchanged files are not re-chunked or re-embedded.
- The enrich worker rebuilds chunks when a file changes. This needs no LLM,
  so it runs even when no provider is configured.
- Rescan backfills chunks for docs indexed before this change, since they
  already have a summary and never go back through the worker.
- FTS matches any query word; ts_rank still ranks docs with more matching
  words first. Both FTS and vector search look at the doc and its chunks
  and score each doc by its best hit.

SQLite is unch

**File**: `docs/24-knowledge-vault.md` (modified, +17/-3)
```diff
@@ -86,7 +86,8 @@ Document registry: metadata pointers. Content lives on filesystem; registry hold
 | `doc_type` | TEXT | context, memory, note, skill, episodic |
 | `content_hash` | TEXT | SHA-256 of file content (detects changes) |
 | `embedding` | vector(1536) | pgvector: semantic similarity |
-| `tsv` | tsvector | Generated: FTS index on title+path |
+| `tsv` | tsvector | Generated: FTS index on title+path+summary |
+| `body_indexed_hash` | TEXT | `content_hash` the body chunks were built from (NULL = not chunked yet) |
 | `metadata` | JSONB | Optional custom fields |
 | `created_at`, `updated_at` | TIMESTAMPTZ | Timestamps |
 | **Unique constraint** | (agent_id, scope, path) | One doc per path per scope |
@@ -99,6 +100,19 @@ Document registry: metadata pointers. Content lives on filesystem; registry hold
 - `idx_vault_docs_embedding` — HNSW vector (semantic search)
 - `idx_vault_docs_tsv` — GIN FTS index (keyword search)
 
+### vault_document_chunks
+
+The body of each text document, split into ~1000-char chunks (200-char overlap), so search reaches content that the auto-summary leaves out. The enrich worker rebuilds the chunks from the workspace file whenever `content_hash` moves past `body_indexed_hash`. `POST /v1/vault/rescan` also backfills docs that have no chunks yet. Media and `document` types are not chunked.
+
+| Column | Type | Notes |
+|--------|------|-------|
+| `document_id` | UUID | Parent doc (cascade delete) |
+| `chunk_index` | INT | Position in the body |
+| `start_line`, `end_line` | INT | Line range in the file |
+| `text` | TEXT | Chunk content |
+| `embedding` | vector(1536) | Only the first 64 chunks of a doc are embedded |
+| `tsv` | tsvector | Generated: FTS on `text` ('simple' config) |
+
 ### vault_links
 
 Bidirectional links between documents (wikilinks, explicit references).
@@ -192,8 +206,8 @@ Hybrid search integrates vault FTS, vector embeddings, episodic memory, and know
 
 `VaultStore.Search(ctx, opts VaultSearchOptions)` on single vault:
 
-- **FTS**: PostgreSQL `plainto_tsquery()` on tsv (title+path keywords)
-- **Vector**: pgvector cosine similarity on embedding (semantic)
+- **FTS**: matches any query word (OR), so natural-language questions work; docs matching more words rank higher. Runs on the doc `tsv` and on body chunks, and a doc scores by its best hit
+- **Vector**: pgvector cosine similarity on the doc embedding and on chunk embeddings, best hit per doc
 - **Combined scoring**: Normalize each method's scores (0–1), then apply query-time weights
 - **Results:** Top N documents with score
 
```

**File**: `internal/http/vault_handlers.go` (modified, +5/-0)
```diff
@@ -218,6 +218,11 @@ func (h *VaultHandler) handleRescan(w http.ResponseWriter, r *http.Request) {
 		}
 	}
 
+	// Backfill body chunks for docs indexed before chunking existed, or whose
+	// file changed without the chunks catching up. Detached from the request
+	// so a big vault is not cut off by the rescan timeout.
+	go vault.IndexStaleBodies(context.WithoutCancel(r.Context()), h.store, tenantID, wsPath)
+
 	if h.enrichProgress != nil && total > 0 {
 		h.enrichProgress.Start(total, store.TenantIDFromContext(r.Context()))
 	}
```

**File**: `internal/store/pg/vault_chunks.go` (added, +121/-0)
```diff
@@ -0,0 +1,121 @@
+package pg
+
+import (
+	"context"
+	"database/sql"
+	"errors"
+	"fmt"
+	"log/slog"
+
+	"github.com/google/uuid"
+
+	"github.com/nextlevelbuilder/goclaw/internal/store"
+)
+
+// vaultMaxEmbeddedChunks caps how many chunks of one document get an embedding.
+// Every chunk is still full-text indexed; chunks past the cap only lack a vector.
+const vaultMaxEmbeddedChunks = 64
+
+// ReplaceDocumentChunks swaps the body chunks of a document and embeds them.
+// No-op when the stored chunks were already built from contentHash.
+func (s *PGVaultStore) ReplaceDocumentChunks(ctx context.Context, tenantID, docID, contentHash string, chunks []store.VaultChunk) error {
+	tid, err := parseUUID(tenantID)
+	if err != nil {
+		return fmt.Errorf("vault replace chunks: tenant: %w", err)
+	}
+	did, err := parseUUID(docID)
+	if err != nil {
+		return fmt.Errorf("vault replace chunks: doc: %w", err)
+	}
+
+	var indexedHash sql.NullString
+	err = s.db.QueryRowContext(ctx,
+		`SELECT body_indexed_hash FROM vault_documents WHERE id = $1 AND tenant_id = $2`,
+		did, tid,
+	).Scan(&indexedHash)
+	if err != nil {
+		return fmt.Errorf("vault replace chunks: fetch doc: %w", err)
+	}
+	if indexedHash.Valid && indexedHash.String == contentHash {
+		return nil
+	}
+
+	// Embed outside the transaction; a failed embed still leaves the chunks
+	// searchable by keyword.
+	embeddings := make([]*string, len(chunks))
+	if s.embProvider != nil && len(chunks) > 0 {
+		n := min(len(chunks), vaultMaxEmbeddedChunks)
+		texts := make([]string, n)
+		for i := range n {
+			texts[i] = chunks[i].Text
+		}
+		vecs, embErr := s.embProvider.Embed(ctx, texts)
+		if embErr != nil {
+			slog.Warn("vault.chunks: embed", "doc", docID, "err", embErr)
+		}
+		for i := range min(len(vecs), n) {
+			v := vectorToString(vecs[i])
+			embeddings[i] = &v
+		}
+	}
+
+	tx, err := s.db.BeginTx(ctx, nil)
+	if err != nil {
+		return fmt.Errorf("vault replace chunks: begin: %w", err)
+	}
+	defer tx.Rollback()
+
+	if _, err := tx.ExecContext(ctx,
+		`DELETE FROM vault_document_chunks WHERE document_id = $1 AND tenant_id = $2`, did, tid,
+	); err != nil {
+		return fmt.Errorf("vault replace chunks: delete: %w", err)
+	}
+	for i, c := range chunks {
+		if _, err := tx.ExecContext(ctx, `
+			INSERT INTO vault_document_chunks
+				(id, tenant_id, document_id, chunk_index, start_line, end_line, text, embedding)
+			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
+			uuid.Must(uuid.NewV7()), tid, did, c.Index, c.StartLine, c.EndLine, c.Text, embeddings[i],
+		); err != nil {
+			return fmt.Errorf("vault replace chunks: insert: %w", err)
+		}
+	}
+	res, err := tx.ExecContext(ctx,
+		`UPDATE vault_documents SET body_indexed_hash = $1 WHERE id = $2 AND tenant_id = $3`,
+		contentHash, did, tid,
+	)
+	if err != nil {
+		return fmt.Errorf("vault replace chunks: mark indexed: %w", err)
+	}
+	if n, _ := res.RowsAffected(); n == 0 {
+		return errors.New("vault replace chunks: document deleted")
+	}
+	return tx.Commit()
+}
+
+// ListDocsNeedingBodyIndex returns text documents whose chunks are missing or stale.
+// Media and binary documents are skipped: they have no text body to index.
+func (s *PGVaultStore) ListDocsNeedingBodyIndex(ctx context.Context, tenantID string, limit int) ([]store.VaultDocument, error) {
+	tid, err := parseUUID(tenantID)
+	if err != nil {
+		return nil, fmt.Errorf("vault list needing body index: tenant: %w", err)
+	}
+
+	q := `SELECT id, tenant_id, agent_id, team_id, chat_id, scope, custom_scope, path, path_basename, title, doc_type,
+			content_hash, summary, metadata, created_at, updated_at
+		FROM vault_documents
+		WHERE tenant_id = $1 AND doc_type NOT IN ('media', 'document')
+			AND body_indexed_hash IS DISTINCT FROM content_hash
+		ORDER BY created_at ASC`
+	args := []any{tid}
+	if limit > 0 {
+		q += " LIMIT $2"
+		args = append(args, limit)
+	}
+
+	var rows []vaultDocRow
+	if err := pkgSqlxDB.SelectContext(ctx, &rows, q, args...); err != nil {
+		return nil, fmt.
```

**File**: `internal/store/pg/vault_documents.go` (modified, +112/-54)
```diff
@@ -440,7 +440,7 @@ func (s *PGVaultStore) UpdateHash(ctx context.Context, tenantID, id, newHash str
 // UpdateSummaryAndReembed updates summary and re-generates embedding from title+path+summary.
 // UpdateSummaryAndReembed and FindSimilarDocs moved to vault_documents_enrichment.go.
 
-// Search performs hybrid FTS + vector search on vault_documents.
+// Search performs hybrid FTS + vector search on vault documents and their body chunks.
 func (s *PGVaultStore) Search(ctx context.Context, opts store.VaultSearchOptions) ([]store.VaultSearchResult, error) {
 	tid, err := parseUUID(opts.TenantID)
 	if err != nil {
@@ -451,18 +451,22 @@ func (s *PGVaultStore) Search(ctx context.Context, opts store.VaultSearchOptions
 		return nil, fmt.Errorf("vault search: agent: %w", err)
 	}
 
-	// Build team filter for search sub-queries.
-	tf := buildSearchTeamFilter(opts.TeamID, opts.TeamIDs)
-	// Chat-scope filter (applies only when team is isolated + chat_id non-nil/non-empty).
-	cf := buildSearchChatFilter(opts.ChatID, opts.TeamIsolated)
+	f := vaultSearchScope{
+		agentID: aid,
+		team:    buildSearchTeamFilter(opts.TeamID, opts.TeamIDs),
+		// Chat-scope filter (applies only when team is isolated + chat_id non-nil/non-empty).
+		chat:     buildSearchChatFilter(opts.ChatID, opts.TeamIsolated),
+		scope:    opts.Scope,
+		docTypes: opts.DocTypes,
+	}
 
 	maxResults := opts.MaxResults
 	if maxResults <= 0 {
 		maxResults = 10
 	}
 
 	// FTS search
-	ftsResults, err := s.ftsSearch(ctx, opts.Query, tid, aid, tf, cf, opts.Scope, opts.DocTypes, maxResults*2)
+	ftsResults, err := s.ftsSearch(ctx, opts.Query, tid, f, maxResults*2)
 	if err != nil {
 		return nil, err
 	}
@@ -473,7 +477,7 @@ func (s *PGVaultStore) Search(ctx context.Context, opts store.VaultSearchOptions
 		vecs, embErr := s.embProvider.Embed(ctx, []string{opts.Query})
 		if embErr == nil && len(vecs) > 0 {
 			var vecErr error
-			vecResults, vecErr = s.vectorSearch(ctx, vecs[0], tid, aid, tf, cf, opts.Scope, opts.DocTypes, maxResults*2)
+			vecResults, vecErr = s.vectorSearch(ctx, vecs[0], tid, f, maxResults*2)
 			if vecErr != nil {
 				slog.Debug("vault.vector_search_fallback", "err", vecErr)
 				vecResults = nil
@@ -569,35 +573,55 @@ func (cf searchChatFilter) append(q string, args []any, p int) (string, []any, i
 	return q, args, p
 }
 
-func (s *PGVaultStore) ftsSearch(ctx context.Context, query string, tenantID uuid.UUID, agentID *uuid.UUID, tf searchTeamFilter, cf searchChatFilter, scope string, docTypes []string, limit int) ([]store.VaultSearchResult, error) {
-	q := `SELECT id, tenant_id, agent_id, team_id, chat_id, scope, custom_scope, path, path_basename, title, doc_type, content_hash, summary, metadata, created_at, updated_at,
-			ts_rank(tsv, plainto_tsquery('simple', $1)) AS score
-		FROM vault_documents
-		WHERE tenant_id = $2 AND tsv @@ plainto_tsquery('simple', $1)`
-	args := []any{query, tenantID}
-	p := 3
+// vaultAnyTermQuery matches docs containing any word of $1. plainto_tsquery
+// ANDs every word, and the 'simple' config keeps filler words like "what" or
+// "the", so a plain question never matched anything. Lexemes come out of
+// plainto_tsquery already quoted and never contain spaces, so swapping the
+// operators is safe. ts_rank still puts docs matching more words first.
+const vaultAnyTermQuery = `replace(plainto_tsquery('simple', $1)::text, ' & ', ' | ')::tsquery`
+
+// vaultDocCols is the vault_documents column list scanned into vaultDocRow,
+// qualified for queries that join the chunks table.
+const vaultDocCols = `d.id, d.tenant_id, d.agent_id, d.team_id, d.chat_id, d.scope, d.custom_scope, d.path, d.path_basename,
+	d.title, d.doc_type, d.content_hash, d.summary, d.metadata, d.created_at, d.updated_at`
+
+// vaultSearchScope holds the visibility filters shared by every search sub-query.
+type vaultSearchScope struct {
+	agentID  *uuid.UUID
+	team     searchTeamFilter
+	chat     searchChatFilter
+	scope    string
+	docTypes []string
+}
 
-	i
```

**File**: `internal/store/sqlitestore/vault_documents.go` (modified, +10/-0)
```diff
@@ -345,6 +345,16 @@ func (s *SQLiteVaultStore) FindSimilarDocs(ctx context.Context, tenantID, agentI
 	return nil, nil
 }
 
+// ReplaceDocumentChunks is a no-op in SQLite (search is LIKE on title/path, no FTS).
+func (s *SQLiteVaultStore) ReplaceDocumentChunks(ctx context.Context, tenantID, docID, contentHash string, chunks []store.VaultChunk) error {
+	return nil
+}
+
+// ListDocsNeedingBodyIndex is a no-op in SQLite (body chunks are not stored).
+func (s *SQLiteVaultStore) ListDocsNeedingBodyIndex(ctx context.Context, tenantID string, limit int) ([]store.VaultDocument, error) {
+	return nil, nil
+}
+
 // Search performs LIKE-based search on vault documents (no FTS/vector in lite).
 func (s *SQLiteVaultStore) Search(ctx context.Context, opts store.VaultSearchOptions) ([]store.VaultSearchResult, error) {
 	query := opts.Query
```

---

### Incident Patch 8: `c48feda3` (2026-09-27)
**Commit Message**: Merge pull request #1581 from fcy222fcy/fix/acp-provider-url-validation-1481

fix(http): restore ACP executable-path validation, bypass SSRF URL ch…

**File**: `internal/http/providers.go` (modified, +22/-1)
```diff
@@ -439,9 +439,10 @@ func normalizeOllamaAPIBase(p *store.LLMProviderData) {
 // localURLProviderTypes are provider types that legitimately run on localhost.
 // They are restricted to an explicit localhost allowlist
 // rather than skipping SSRF validation entirely.
+// ACP is intentionally excluded: its api_base carries an executable command/path,
+// not a URL (see issue #1481).
 var localURLProviderTypes = map[string]bool{
 	store.ProviderOllama: true,
-	store.ProviderACP:    true,
 }
 
 // allowedLocalHosts are the only hosts permitted for local provider types.
@@ -508,6 +509,9 @@ func validateProviderURL(rawURL string, providerType string) error {
 	if providerType == store.ProviderClaudeCLI {
 		return validateClaudeCLIExecutablePath(rawURL)
 	}
+	if providerType == store.ProviderACP {
+		return validateACPExecutablePath(rawURL)
+	}
 	u, err := url.Parse(rawURL)
 	if err != nil {
 		return fmt.Errorf("invalid URL: %w", err)
@@ -595,6 +599,23 @@ func validateClaudeCLIExecutablePath(path string) error {
 	return fmt.Errorf("Claude CLI api_base must be %q or an absolute executable path, got %q", "claude", path)
 }
 
+// validateACPExecutablePath validates that api_base for ACP providers carries a
+// command or absolute executable path, not a URL. This mirrors the runtime
+// registration logic in cmd/gateway_providers.go.
+func validateACPExecutablePath(path string) error {
+	if strings.Contains(path, "\x00") {
+		return fmt.Errorf("ACP binary path cannot contain NUL byte")
+	}
+	if _, err := url.ParseRequestURI(path); err == nil && strings.Contains(path, "://") {
+		return fmt.Errorf("ACP api_base must be an executable path or command, got URL %q", path)
+	}
+	// Keep parity with registerACPFromDB: built-in command names or absolute paths.
+	if path == "claude" || path == "codex" || path == "gemini" || filepath.IsAbs(path) {
+		return nil
+	}
+	return fmt.Errorf("ACP api_base must be %q, %q, %q, or an absolute executable path, got %q", "claude", "codex", "gemini", path)
+}
+
 // --- Provider CRUD ---
 
 func (h *ProvidersHandler) handleListProviders(w http.ResponseWriter, r *http.Request) {
```

**File**: `internal/http/providers_test.go` (modified, +173/-0)
```diff
@@ -554,6 +554,179 @@ func TestProvidersHandlerUpdateAllowsClaudeCLIExecutablePath(t *testing.T) {
 	}
 }
 
+// TestProvidersHandlerCreateAllowsACPExecutablePath guards the fix for issue #1481:
+// ACP provider api_base is an executable command/path, not a URL, and must not be
+// rejected by the SSRF URL validator.
+func TestProvidersHandlerCreateAllowsACPExecutablePath(t *testing.T) {
+	token := setupProvidersAdminToken(t)
+	providerStore := newMockProviderStore()
+	handler := NewProvidersHandler(providerStore, newMockSecretsStore(), nil, "")
+	mux := http.NewServeMux()
+	handler.RegisterRoutes(mux)
+
+	body := map[string]any{
+		"name":          "acp-gemini",
+		"provider_type": store.ProviderACP,
+		"api_base":      writeFakeClaudeBinary(t), // any absolute path is acceptable
+		"enabled":       true,
+	}
+	rawBody, err := json.Marshal(body)
+	if err != nil {
+		t.Fatalf("Marshal() error = %v", err)
+	}
+
+	req := httptest.NewRequest(http.MethodPost, "/v1/providers", bytes.NewReader(rawBody))
+	req.Header.Set("Authorization", "Bearer "+token)
+	w := httptest.NewRecorder()
+	mux.ServeHTTP(w, req)
+
+	if w.Code != http.StatusCreated {
+		t.Fatalf("status code = %d, want %d, body=%s", w.Code, http.StatusCreated, w.Body.String())
+	}
+	if got := providerStore.providers["acp-gemini"].APIBase; got == "" || !filepath.IsAbs(got) {
+		t.Fatalf("stored ACP api_base = %q, want absolute executable path", got)
+	}
+}
+
+// TestProvidersHandlerCreateAllowsEmptyACPBinary confirms that an empty api_base
+// is accepted at create time; the runtime path may fall back to config/env.
+func TestProvidersHandlerCreateAllowsEmptyACPBinary(t *testing.T) {
+	token := setupProvidersAdminToken(t)
+	providerStore := newMockProviderStore()
+	handler := NewProvidersHandler(providerStore, newMockSecretsStore(), nil, "")
+	mux := http.NewServeMux()
+	handler.RegisterRoutes(mux)
+
+	body := map[string]any{
+		"name":          "acp-empty",
+		"provider_type": store.ProviderACP,
+		"enabled":       true,
+	}
+	rawBody, err := json.Marshal(body)
+	if err != nil {
+		t.Fatalf("Marshal() error = %v", err)
+	}
+
+	req := httptest.NewRequest(http.MethodPost, "/v1/providers", bytes.NewReader(rawBody))
+	req.Header.Set("Authorization", "Bearer "+token)
+	w := httptest.NewRecorder()
+	mux.ServeHTTP(w, req)
+
+	if w.Code != http.StatusCreated {
+		t.Fatalf("status code = %d, want %d, body=%s", w.Code, http.StatusCreated, w.Body.String())
+	}
+}
+
+// TestProvidersHandlerCreateRejectsACPURL ensures ACP api_base cannot be a URL
+// (it must be an executable path/command).
+func TestProvidersHandlerCreateRejectsACPURL(t *testing.T) {
+	token := setupProvidersAdminToken(t)
+	providerStore := newMockProviderStore()
+	handler := NewProvidersHandler(providerStore, newMockSecretsStore(), nil, "")
+	mux := http.NewServeMux()
+	handler.RegisterRoutes(mux)
+
+	body := map[string]any{
+		"name":          "acp-url",
+		"provider_type": store.ProviderACP,
+		"api_base":      "http://127.0.0.1:9090",
+		"enabled":       true,
+	}
+	rawBody, err := json.Marshal(body)
+	if err != nil {
+		t.Fatalf("Marshal() error = %v", err)
+	}
+
+	req := httptest.NewRequest(http.MethodPost, "/v1/providers", bytes.NewReader(rawBody))
+	req.Header.Set("Authorization", "Bearer "+token)
+	w := httptest.NewRecorder()
+	mux.ServeHTTP(w, req)
+
+	if w.Code != http.StatusBadRequest {
+		t.Fatalf("status code = %d, want %d, body=%s", w.Code, http.StatusBadRequest, w.Body.String())
+	}
+}
+
+// TestProvidersHandlerUpdateAllowsACPExecutablePath guards update-time validation
+// for ACP providers.
+func TestProvidersHandlerUpdateAllowsACPExecutablePath(t *testing.T) {
+	token := setupProvidersAdminToken(t)
+	providerStore := newMockProviderStore()
+	provider := &store.LLMProviderData{
+		BaseModel:    store.BaseModel{ID: uuid.New()},
+		Name:         "acp-local",
+		ProviderType: store.ProviderACP,
+		APIBase:      "gemini",
+		Enabled:      true,
+	}
+	if err := providerStore.CreateProvider(context.Backgrou
```

**File**: `internal/http/providers_url_validate_test.go` (modified, +42/-11)
```diff
@@ -67,22 +67,29 @@ func TestValidateProviderURL(t *testing.T) {
 		{"public HTTPS", "https://api.openai.com/v1", "openai_compat", false},
 		{"public HTTP", "http://legit-provider.com/v1", "openai_compat", false},
 
-		// --- Scheme check: unconditional for ALL types including local ---
+		// --- Scheme check: unconditional for URL-based types ---
 		{"file scheme remote", "file:///etc/passwd", "openai_compat", true},
 		{"gopher scheme remote", "gopher://internal:25", "openai_compat", true},
 		{"file scheme ollama", "file:///etc/passwd", "ollama", true},       // H-1: scheme enforced even for local types
-		{"gopher scheme acp", "gopher://localhost:25", "acp", true},        // H-1: scheme enforced even for local types
 		{"file scheme claude_cli", "file:///bin/bash", "claude_cli", true}, // H-1: scheme enforced for URL-like Claude CLI values
 
 		// --- Local type: allowlist-only ---
 		{"ollama localhost", "http://localhost:11434/v1", "ollama", false},
 		{"ollama 127.0.0.1", "http://127.0.0.1:11434/v1", "ollama", false},
 		{"ollama ::1", "http://[::1]:11434/v1", "ollama", false},
 		{"ollama host.docker.internal", "http://host.docker.internal:11434/v1", "ollama", false},
-		{"acp 127.0.0.1", "http://127.0.0.1:9090", "acp", false},
 		{"claude_cli command name", "claude", "claude_cli", false},
 		{"claude_cli absolute path", absClaudePath, "claude_cli", false},
 
+		// --- ACP: executable path / command, not a URL (issue #1481) ---
+		{"acp empty", "", "acp", false},
+		{"acp built-in gemini", "gemini", "acp", false},
+		{"acp built-in claude", "claude", "acp", false},
+		{"acp built-in codex", "codex", "acp", false},
+		{"acp URL rejected", "http://127.0.0.1:9090", "acp", true},
+		{"acp private URL rejected", "http://10.0.0.1:8080/v1", "acp", true},
+		{"acp relative rejected", "relative/acp", "acp", true},
+
 		// Local type with non-localhost hosts → blocked
 		{"ollama 169.254.169.254", "http://169.254.169.254/latest/meta-data/", "ollama", true},
 		{"ollama private IP", "http://10.0.0.5:11434/v1", "ollama", true},
@@ -91,7 +98,6 @@ func TestValidateProviderURL(t *testing.T) {
 		{"ollama link-local", "http://169.254.1.1:8080/v1", "ollama", true},
 		{"ollama .internal", "http://redis.internal:6379/v1", "ollama", true},
 		{"ollama gcp metadata", "http://metadata.google.internal/computeMetadata/v1/", "ollama", true},
-		{"acp private", "http://10.0.0.1:8080/v1", "acp", true},
 
 		// --- Remote type literal blocked IPs ---
 		{"remote localhost", "http://localhost:8080", "openai_compat", true},
@@ -189,7 +195,6 @@ func TestValidateProviderURL_LocalTypesIgnoreAllowPrivateFlag(t *testing.T) {
 		{"http://ollama:11434/v1", "ollama"},
 		{"http://host.lan:11434/v1", "ollama"},
 		{"http://10.0.0.5:11434/v1", "ollama"},
-		{"http://acp-sidecar:9090", "acp"},
 	}
 	for _, c := range cases {
 		if err := validateProviderURL(c.url, c.providerType); err == nil {
@@ -209,7 +214,6 @@ func TestValidateProviderURL_LocalTypeSchemeEnforced(t *testing.T) {
 	}{
 		{"file:///etc/passwd", "ollama"},
 		{"gopher://localhost:25", "ollama"},
-		{"file:///etc/passwd", "acp"},
 	}
 	for _, c := range cases {
 		err := validateProviderURL(c.url, c.providerType)
@@ -275,8 +279,6 @@ func TestValidateProviderURL_LocalTypeAllowedHosts(t *testing.T) {
 		{"http://127.0.0.1:11434/v1", "ollama"},
 		{"http://[::1]:11434/v1", "ollama"},
 		{"http://host.docker.internal:11434/v1", "ollama"},
-		{"http://localhost:9090", "acp"},
-		{"http://127.0.0.1:9090", "acp"},
 	}
 	for _, a := range allowed {
 		if err := validateProviderURL(a.url, a.providerType); err != nil {
@@ -314,6 +316,38 @@ func TestValidateProviderURL_ClaudeCLIExecutablePath(t *testing.T) {
 	}
 }
 
+func TestValidateProviderURL_ACPExecutablePath(t *testing.T) {
+	saveAndRestoreGlobals(t)
+	absBinary := filepath.Join(t.TempDir(), "gemini")
+
+	allowed := []string{
+		"",
+		"claude",
+		"codex",
+		"gemini",
+		absBinary,
+		filepath.Join(t.TempDir(), "Gemini.app", "Contents", "MacOS",
```

---

### Incident Patch 9: `6063d975` (2026-09-27)
**Commit Message**: fix(http): restore ACP executable-path validation, bypass SSRF URL check (#1481)

ACP providers use api_base to store an executable command/path, not a URL.
A previous SSRF-hardening refactor incorrectly classified ACP as a local-URL
provider type, causing create/update to reject valid ACP configs with
"provider URL must use http or https scheme".

Changes:
- Remove ProviderACP from localURLProviderTypes.
- Add validateACPExecutablePath mirroring the runtime registration logic in
cmd/gateway_providers.go (allows empty, claude/codex/gemini, or absolute path;
rejects URLs and relative paths).
- Route ACP through the new validator inside validateProviderURL.
- Add unit tests for validateACPExecutablePath.
- Update existing local-type tests that assumed ACP was URL-based.
- Add create/update HTTP handler regression tests for ACP binary, empty binary,
and URL rejection.

Bug-first verification: without the fix, ACP api_base values like "gemini" or
absolute paths fail URL validation, while URLs are incorrectly accepted; with
the fix the behavior is reversed to match the intended executable-path model.

Fixes nextlevelbuilder/goclaw#1481.

**File**: `internal/http/providers.go` (modified, +22/-1)
```diff
@@ -439,9 +439,10 @@ func normalizeOllamaAPIBase(p *store.LLMProviderData) {
 // localURLProviderTypes are provider types that legitimately run on localhost.
 // They are restricted to an explicit localhost allowlist
 // rather than skipping SSRF validation entirely.
+// ACP is intentionally excluded: its api_base carries an executable command/path,
+// not a URL (see issue #1481).
 var localURLProviderTypes = map[string]bool{
 	store.ProviderOllama: true,
-	store.ProviderACP:    true,
 }
 
 // allowedLocalHosts are the only hosts permitted for local provider types.
@@ -508,6 +509,9 @@ func validateProviderURL(rawURL string, providerType string) error {
 	if providerType == store.ProviderClaudeCLI {
 		return validateClaudeCLIExecutablePath(rawURL)
 	}
+	if providerType == store.ProviderACP {
+		return validateACPExecutablePath(rawURL)
+	}
 	u, err := url.Parse(rawURL)
 	if err != nil {
 		return fmt.Errorf("invalid URL: %w", err)
@@ -595,6 +599,23 @@ func validateClaudeCLIExecutablePath(path string) error {
 	return fmt.Errorf("Claude CLI api_base must be %q or an absolute executable path, got %q", "claude", path)
 }
 
+// validateACPExecutablePath validates that api_base for ACP providers carries a
+// command or absolute executable path, not a URL. This mirrors the runtime
+// registration logic in cmd/gateway_providers.go.
+func validateACPExecutablePath(path string) error {
+	if strings.Contains(path, "\x00") {
+		return fmt.Errorf("ACP binary path cannot contain NUL byte")
+	}
+	if _, err := url.ParseRequestURI(path); err == nil && strings.Contains(path, "://") {
+		return fmt.Errorf("ACP api_base must be an executable path or command, got URL %q", path)
+	}
+	// Keep parity with registerACPFromDB: built-in command names or absolute paths.
+	if path == "claude" || path == "codex" || path == "gemini" || filepath.IsAbs(path) {
+		return nil
+	}
+	return fmt.Errorf("ACP api_base must be %q, %q, %q, or an absolute executable path, got %q", "claude", "codex", "gemini", path)
+}
+
 // --- Provider CRUD ---
 
 func (h *ProvidersHandler) handleListProviders(w http.ResponseWriter, r *http.Request) {
```

**File**: `internal/http/providers_test.go` (modified, +173/-0)
```diff
@@ -554,6 +554,179 @@ func TestProvidersHandlerUpdateAllowsClaudeCLIExecutablePath(t *testing.T) {
 	}
 }
 
+// TestProvidersHandlerCreateAllowsACPExecutablePath guards the fix for issue #1481:
+// ACP provider api_base is an executable command/path, not a URL, and must not be
+// rejected by the SSRF URL validator.
+func TestProvidersHandlerCreateAllowsACPExecutablePath(t *testing.T) {
+	token := setupProvidersAdminToken(t)
+	providerStore := newMockProviderStore()
+	handler := NewProvidersHandler(providerStore, newMockSecretsStore(), nil, "")
+	mux := http.NewServeMux()
+	handler.RegisterRoutes(mux)
+
+	body := map[string]any{
+		"name":          "acp-gemini",
+		"provider_type": store.ProviderACP,
+		"api_base":      writeFakeClaudeBinary(t), // any absolute path is acceptable
+		"enabled":       true,
+	}
+	rawBody, err := json.Marshal(body)
+	if err != nil {
+		t.Fatalf("Marshal() error = %v", err)
+	}
+
+	req := httptest.NewRequest(http.MethodPost, "/v1/providers", bytes.NewReader(rawBody))
+	req.Header.Set("Authorization", "Bearer "+token)
+	w := httptest.NewRecorder()
+	mux.ServeHTTP(w, req)
+
+	if w.Code != http.StatusCreated {
+		t.Fatalf("status code = %d, want %d, body=%s", w.Code, http.StatusCreated, w.Body.String())
+	}
+	if got := providerStore.providers["acp-gemini"].APIBase; got == "" || !filepath.IsAbs(got) {
+		t.Fatalf("stored ACP api_base = %q, want absolute executable path", got)
+	}
+}
+
+// TestProvidersHandlerCreateAllowsEmptyACPBinary confirms that an empty api_base
+// is accepted at create time; the runtime path may fall back to config/env.
+func TestProvidersHandlerCreateAllowsEmptyACPBinary(t *testing.T) {
+	token := setupProvidersAdminToken(t)
+	providerStore := newMockProviderStore()
+	handler := NewProvidersHandler(providerStore, newMockSecretsStore(), nil, "")
+	mux := http.NewServeMux()
+	handler.RegisterRoutes(mux)
+
+	body := map[string]any{
+		"name":          "acp-empty",
+		"provider_type": store.ProviderACP,
+		"enabled":       true,
+	}
+	rawBody, err := json.Marshal(body)
+	if err != nil {
+		t.Fatalf("Marshal() error = %v", err)
+	}
+
+	req := httptest.NewRequest(http.MethodPost, "/v1/providers", bytes.NewReader(rawBody))
+	req.Header.Set("Authorization", "Bearer "+token)
+	w := httptest.NewRecorder()
+	mux.ServeHTTP(w, req)
+
+	if w.Code != http.StatusCreated {
+		t.Fatalf("status code = %d, want %d, body=%s", w.Code, http.StatusCreated, w.Body.String())
+	}
+}
+
+// TestProvidersHandlerCreateRejectsACPURL ensures ACP api_base cannot be a URL
+// (it must be an executable path/command).
+func TestProvidersHandlerCreateRejectsACPURL(t *testing.T) {
+	token := setupProvidersAdminToken(t)
+	providerStore := newMockProviderStore()
+	handler := NewProvidersHandler(providerStore, newMockSecretsStore(), nil, "")
+	mux := http.NewServeMux()
+	handler.RegisterRoutes(mux)
+
+	body := map[string]any{
+		"name":          "acp-url",
+		"provider_type": store.ProviderACP,
+		"api_base":      "http://127.0.0.1:9090",
+		"enabled":       true,
+	}
+	rawBody, err := json.Marshal(body)
+	if err != nil {
+		t.Fatalf("Marshal() error = %v", err)
+	}
+
+	req := httptest.NewRequest(http.MethodPost, "/v1/providers", bytes.NewReader(rawBody))
+	req.Header.Set("Authorization", "Bearer "+token)
+	w := httptest.NewRecorder()
+	mux.ServeHTTP(w, req)
+
+	if w.Code != http.StatusBadRequest {
+		t.Fatalf("status code = %d, want %d, body=%s", w.Code, http.StatusBadRequest, w.Body.String())
+	}
+}
+
+// TestProvidersHandlerUpdateAllowsACPExecutablePath guards update-time validation
+// for ACP providers.
+func TestProvidersHandlerUpdateAllowsACPExecutablePath(t *testing.T) {
+	token := setupProvidersAdminToken(t)
+	providerStore := newMockProviderStore()
+	provider := &store.LLMProviderData{
+		BaseModel:    store.BaseModel{ID: uuid.New()},
+		Name:         "acp-local",
+		ProviderType: store.ProviderACP,
+		APIBase:      "gemini",
+		Enabled:      true,
+	}
+	if err := providerStore.CreateProvider(context.Backgrou
```

**File**: `internal/http/providers_url_validate_test.go` (modified, +42/-11)
```diff
@@ -67,22 +67,29 @@ func TestValidateProviderURL(t *testing.T) {
 		{"public HTTPS", "https://api.openai.com/v1", "openai_compat", false},
 		{"public HTTP", "http://legit-provider.com/v1", "openai_compat", false},
 
-		// --- Scheme check: unconditional for ALL types including local ---
+		// --- Scheme check: unconditional for URL-based types ---
 		{"file scheme remote", "file:///etc/passwd", "openai_compat", true},
 		{"gopher scheme remote", "gopher://internal:25", "openai_compat", true},
 		{"file scheme ollama", "file:///etc/passwd", "ollama", true},       // H-1: scheme enforced even for local types
-		{"gopher scheme acp", "gopher://localhost:25", "acp", true},        // H-1: scheme enforced even for local types
 		{"file scheme claude_cli", "file:///bin/bash", "claude_cli", true}, // H-1: scheme enforced for URL-like Claude CLI values
 
 		// --- Local type: allowlist-only ---
 		{"ollama localhost", "http://localhost:11434/v1", "ollama", false},
 		{"ollama 127.0.0.1", "http://127.0.0.1:11434/v1", "ollama", false},
 		{"ollama ::1", "http://[::1]:11434/v1", "ollama", false},
 		{"ollama host.docker.internal", "http://host.docker.internal:11434/v1", "ollama", false},
-		{"acp 127.0.0.1", "http://127.0.0.1:9090", "acp", false},
 		{"claude_cli command name", "claude", "claude_cli", false},
 		{"claude_cli absolute path", absClaudePath, "claude_cli", false},
 
+		// --- ACP: executable path / command, not a URL (issue #1481) ---
+		{"acp empty", "", "acp", false},
+		{"acp built-in gemini", "gemini", "acp", false},
+		{"acp built-in claude", "claude", "acp", false},
+		{"acp built-in codex", "codex", "acp", false},
+		{"acp URL rejected", "http://127.0.0.1:9090", "acp", true},
+		{"acp private URL rejected", "http://10.0.0.1:8080/v1", "acp", true},
+		{"acp relative rejected", "relative/acp", "acp", true},
+
 		// Local type with non-localhost hosts → blocked
 		{"ollama 169.254.169.254", "http://169.254.169.254/latest/meta-data/", "ollama", true},
 		{"ollama private IP", "http://10.0.0.5:11434/v1", "ollama", true},
@@ -91,7 +98,6 @@ func TestValidateProviderURL(t *testing.T) {
 		{"ollama link-local", "http://169.254.1.1:8080/v1", "ollama", true},
 		{"ollama .internal", "http://redis.internal:6379/v1", "ollama", true},
 		{"ollama gcp metadata", "http://metadata.google.internal/computeMetadata/v1/", "ollama", true},
-		{"acp private", "http://10.0.0.1:8080/v1", "acp", true},
 
 		// --- Remote type literal blocked IPs ---
 		{"remote localhost", "http://localhost:8080", "openai_compat", true},
@@ -189,7 +195,6 @@ func TestValidateProviderURL_LocalTypesIgnoreAllowPrivateFlag(t *testing.T) {
 		{"http://ollama:11434/v1", "ollama"},
 		{"http://host.lan:11434/v1", "ollama"},
 		{"http://10.0.0.5:11434/v1", "ollama"},
-		{"http://acp-sidecar:9090", "acp"},
 	}
 	for _, c := range cases {
 		if err := validateProviderURL(c.url, c.providerType); err == nil {
@@ -209,7 +214,6 @@ func TestValidateProviderURL_LocalTypeSchemeEnforced(t *testing.T) {
 	}{
 		{"file:///etc/passwd", "ollama"},
 		{"gopher://localhost:25", "ollama"},
-		{"file:///etc/passwd", "acp"},
 	}
 	for _, c := range cases {
 		err := validateProviderURL(c.url, c.providerType)
@@ -275,8 +279,6 @@ func TestValidateProviderURL_LocalTypeAllowedHosts(t *testing.T) {
 		{"http://127.0.0.1:11434/v1", "ollama"},
 		{"http://[::1]:11434/v1", "ollama"},
 		{"http://host.docker.internal:11434/v1", "ollama"},
-		{"http://localhost:9090", "acp"},
-		{"http://127.0.0.1:9090", "acp"},
 	}
 	for _, a := range allowed {
 		if err := validateProviderURL(a.url, a.providerType); err != nil {
@@ -314,6 +316,38 @@ func TestValidateProviderURL_ClaudeCLIExecutablePath(t *testing.T) {
 	}
 }
 
+func TestValidateProviderURL_ACPExecutablePath(t *testing.T) {
+	saveAndRestoreGlobals(t)
+	absBinary := filepath.Join(t.TempDir(), "gemini")
+
+	allowed := []string{
+		"",
+		"claude",
+		"codex",
+		"gemini",
+		absBinary,
+		filepath.Join(t.TempDir(), "Gemini.app", "Contents", "MacOS",
```

---

### Incident Patch 10: `16ba6a5a` (2026-09-26)
**Commit Message**: Merge pull request #1580 from fcy222fcy/fix/forward-port-wikilink-dedup-1473

fix(vault): deduplicate wikilinks before batch INSERT to prevent SQLS…

**File**: `internal/vault/links.go` (modified, +15/-0)
```diff
@@ -101,6 +101,15 @@ func SyncDocLinks(ctx context.Context, vs store.VaultStore, doc *store.VaultDocu
 	}
 
 	// Resolve all wikilinks, then batch-create links in a single call.
+	// Deduplicate by (FromDocID, ToDocID, LinkType) to prevent PostgreSQL
+	// "ON CONFLICT DO UPDATE command cannot affect row a second time" (SQLSTATE 21000)
+	// when the same target appears multiple times in the document.
+	type linkKey struct {
+		fromDocID string
+		toDocID   string
+		linkType  string
+	}
+	seen := make(map[linkKey]int) // key → index in links slice
 	var links []store.VaultLink
 	for _, m := range matches {
 		target, err := ResolveWikilinkTarget(ctx, vs, m.Target, tenantID, agentID)
@@ -112,6 +121,12 @@ func SyncDocLinks(ctx context.Context, vs store.VaultStore, doc *store.VaultDocu
 			slog.Debug("vault.link_unresolved", "target", m.Target)
 			continue
 		}
+		k := linkKey{fromDocID: doc.ID, toDocID: target.ID, linkType: "wikilink"}
+		if idx, ok := seen[k]; ok {
+			links[idx].Context += " | " + m.Context
+			continue
+		}
+		seen[k] = len(links)
 		links = append(links, store.VaultLink{
 			FromDocID: doc.ID,
 			ToDocID:   target.ID,
```

**File**: `internal/vault/links_test.go` (added, +122/-0)
```diff
@@ -0,0 +1,122 @@
+package vault
+
+import (
+	"context"
+	"sync"
+	"testing"
+
+	"github.com/nextlevelbuilder/goclaw/internal/store"
+)
+
+type fakeVaultStoreLinks struct {
+	store.VaultStore
+	mu          sync.Mutex
+	docsByPath  map[string]*store.VaultDocument
+	created     []store.VaultLink
+	deletedType bool
+}
+
+func (f *fakeVaultStoreLinks) GetDocument(_ context.Context, _, _, path string) (*store.VaultDocument, error) {
+	f.mu.Lock()
+	defer f.mu.Unlock()
+	if doc, ok := f.docsByPath[path]; ok {
+		return doc, nil
+	}
+	return nil, nil
+}
+
+func (f *fakeVaultStoreLinks) GetDocumentByBasename(_ context.Context, _, _, basename string) (*store.VaultDocument, error) {
+	f.mu.Lock()
+	defer f.mu.Unlock()
+	for _, doc := range f.docsByPath {
+		if doc.Path == basename || doc.Title == basename {
+			return doc, nil
+		}
+	}
+	return nil, nil
+}
+
+func (f *fakeVaultStoreLinks) DeleteDocLinksByType(_ context.Context, _, _, _ string) error {
+	f.mu.Lock()
+	defer f.mu.Unlock()
+	f.deletedType = true
+	return nil
+}
+
+func (f *fakeVaultStoreLinks) CreateLinks(_ context.Context, links []store.VaultLink) error {
+	f.mu.Lock()
+	defer f.mu.Unlock()
+	f.created = append(f.created, links...)
+	return nil
+}
+
+func TestSyncDocLinks_DeduplicatesSameTarget(t *testing.T) {
+	targetDoc := &store.VaultDocument{ID: "target-id-1", Title: "products", Path: "products.md"}
+	sourceDoc := &store.VaultDocument{ID: "source-id-1", Title: "notes", Path: "notes.md"}
+
+	fake := &fakeVaultStoreLinks{
+		docsByPath: map[string]*store.VaultDocument{
+			"products":   targetDoc,
+			"products.md": targetDoc,
+		},
+	}
+
+	content := "First mention [[products]] here and later [[products]] again."
+
+	err := SyncDocLinks(context.Background(), fake, sourceDoc, content, "tenant-1", "agent-1")
+	if err != nil {
+		t.Fatalf("SyncDocLinks() error = %v", err)
+	}
+
+	if len(fake.created) != 1 {
+		t.Fatalf("expected 1 deduplicated link, got %d", len(fake.created))
+	}
+
+	link := fake.created[0]
+	if link.FromDocID != sourceDoc.ID {
+		t.Errorf("FromDocID = %q, want %q", link.FromDocID, sourceDoc.ID)
+	}
+	if link.ToDocID != targetDoc.ID {
+		t.Errorf("ToDocID = %q, want %q", link.ToDocID, targetDoc.ID)
+	}
+	if link.LinkType != "wikilink" {
+		t.Errorf("LinkType = %q, want %q", link.LinkType, "wikilink")
+	}
+}
+
+func TestSyncDocLinks_PreservesDistinctTargets(t *testing.T) {
+	targetA := &store.VaultDocument{ID: "target-a", Title: "alpha", Path: "alpha.md"}
+	targetB := &store.VaultDocument{ID: "target-b", Title: "beta", Path: "beta.md"}
+	sourceDoc := &store.VaultDocument{ID: "source-id-2", Title: "notes", Path: "notes.md"}
+
+	fake := &fakeVaultStoreLinks{
+		docsByPath: map[string]*store.VaultDocument{
+			"alpha":   targetA,
+			"alpha.md": targetA,
+			"beta":    targetB,
+			"beta.md":  targetB,
+		},
+	}
+
+	content := "See [[alpha]] and [[beta]] and [[alpha]] again."
+
+	err := SyncDocLinks(context.Background(), fake, sourceDoc, content, "tenant-1", "agent-1")
+	if err != nil {
+		t.Fatalf("SyncDocLinks() error = %v", err)
+	}
+
+	if len(fake.created) != 2 {
+		t.Fatalf("expected 2 links (alpha + beta), got %d", len(fake.created))
+	}
+
+	targetIDs := map[string]bool{}
+	for _, l := range fake.created {
+		targetIDs[l.ToDocID] = true
+	}
+	if !targetIDs["target-a"] {
+		t.Error("missing link to target-a (alpha)")
+	}
+	if !targetIDs["target-b"] {
+		t.Error("missing link to target-b (beta)")
+	}
+}
```

#### Recent Merged Pull Requests:
- **PR #1590** (2026-09-30): fix(build): embed commit SHA for release provenance (#1571 part 2) (@fcy222fcy)
- **PR #1587** (2026-09-29): fix(pipeline): stop aborting runs on heuristic context budget estimates (@thotam)
- **PR #1586** (2026-09-29): fix(channels): deliver NO_REPLY placeholder cleanup signal to channels (@fcy222fcy)
- **PR #1585** (2026-09-28): docs: add Requesty to the README provider list (@Thibaultjaigu)
- **PR #1584** (2026-09-28): fix(gateway): admit operator.provision keys on tenants.create and ten… (@fcy222fcy)
- **PR #1582** (2026-09-27): fix(vault): search document bodies and match any query word (#1554) (@modelpath-dev)
- **PR #1581** (2026-09-27): fix(http): restore ACP executable-path validation, bypass SSRF URL ch… (@fcy222fcy)
- **PR #1580** (2026-09-26): fix(vault): deduplicate wikilinks before batch INSERT to prevent SQLS… (@fcy222fcy)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
