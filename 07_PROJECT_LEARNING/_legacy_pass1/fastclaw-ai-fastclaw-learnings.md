# Forensic Learning Record (Deep Inspection): fastclaw-ai/fastclaw

> **Canonical Artifact**: `07_PROJECT_LEARNING/fastclaw-ai-fastclaw-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/fastclaw-ai/fastclaw](https://github.com/fastclaw-ai/fastclaw))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:16:29.624Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `fastclaw-ai/fastclaw`
- **Description**: Multi-Agent Framework
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 1355 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cmd/fastclaw/cmd_admin.go`
```
package main

import (
	"context"
	"fmt"

	"github.com/spf13/cobra"

	"github.com/fastclaw-ai/fastclaw/internal/config"
	"github.com/fastclaw-ai/fastclaw/internal/store"
	"github.com/fastclaw-ai/fastclaw/internal/users"
)

// adminCmd groups the admin-only CLI operations: create users, reset
// passwords, grant roles. These bypass the HTTP API and write to the DB
// directly so an operator who's lost super_admin access can recover.
func adminCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "admin",
		Short: "Administrative DB operations (create user, reset password, grant role)",
	}
	cmd.AddCommand(adminCreateUserCmd())
	cmd.AddCommand(adminResetPasswordCmd())
	cmd.AddCommand(adminGrantRoleCmd())
	cmd.AddCommand(adminListUsersCmd())
	cmd.AddCommand(adminUpdateUserCmd())
	cmd.AddCommand(adminDeleteUserCmd())
	return cmd
}

func openStoreFromEnv() (store.Store, error) {
	env := config.LoadEnv()
	homeDir, _ := config.HomeDir()
	return store.New(&store.StorageConfig{
		Type:        store.StorageType(env.Storage.Type),
		DSN:         env.Storage.DSN,
		AutoMigrate: true,
	}, homeDir)
}

func adminCreateUserCmd() *cobra.Command {
	var username, email, password, displayName, role string
	cmd := &cobra.Command{
		Use:   "create-user",
		Short: "Create a new user account",
		RunE: func(cmd *cobra.Command, args []string) error {
			st, err := openStoreFromEnv()
			if err != nil {
				return err
			}
			defer st.Close()
			accts, err := users.NewAccounts(st)
			if err != nil {
				return err
			}
			if role == "" {
				role = users.RoleUser
			}
			acct, err := accts.Create(context.Background(), users.CreateInput{
				Username:    username,
				Email:       email,
				Password:    password,
				DisplayName: displayName,
				Role:        role,
			})
			if err != nil {
				return err
			}
			fmt.Printf("created user %s (%s) role=%s id=%s\n", acct.Username, acct.Email, acct.Role, acct.ID)
			return nil
		},
	}
	cmd.Flags().StringVar(&username, "username", "", "username (required)")
	cmd.Flags().StringVar(&email, "email", "", "email (required)")
	cmd.Flags().StringVar(&password, "password", "", "password (required)")
	cmd.Flags().StringVar(&displayName, "display-name", "", "display name")
	cmd.Flags().StringVar(&role, "role", "user", "'super_admin' or 'user'")
	cmd.MarkFlagRequired("username")
	cmd.MarkFlagRequired("email")
	cmd.MarkFlagRequired("password")
	return cmd
}

func adminResetPasswordCmd() *cobra.Command {
	var login, password string
	cmd := &cobra.Command{
		Use:   "reset-password",
		Short: "Reset a user's password by username or email",
		RunE: func(cmd *cobra.Command, args []string) error {
			st, err := openStoreFromEnv()
			if err != nil {
				return err
			}
			defer st.Close()
			accts, _ := users.NewAccounts(st)
			rec, err := st.GetUserByLogin(context.Background(), login)
			if err != nil {
				return err
			}
			if err := accts.SetPassword(context.Background(), rec.ID, password); err != nil {
				return err
			}
			fmt.Printf("password reset for %s\n", rec.Username)
			return nil
		},
	}
	cmd.Flags().StringVar(&login, "user", "", "username or email (required)")
	cmd.Flags().StringVar(&password, "password", "", "new password (required)")
	cmd.MarkFlagRequired("user")
	cmd.MarkFlagRequired("password")
	return cmd
}

func adminGrantRoleCmd() *cobra.Command {
	var login, role string
	cmd := &cobra.Command{
		Use:   "grant-role",
		Short: "Change a user's role",
		RunE: func(cmd *cobra.Command, args []string) error {
			st, err := openStoreFromEnv()
			if err != nil {
				return err
			}
			defer st.Close()
			accts, _ := users.NewAccounts(st)
			rec, err := st.GetUserByLogin(context.Background(), login)
			if err != nil {
				return err
			}
			if _, err := accts.Update(context.Background(), rec.ID, "", role, "", nil); err != nil {
				return err
			}
			fmt.Printf("role for %s set to %s\n", rec.Username, role)
			return nil
		},
	}
	cmd.Flags().StringVar(&login, "user", "", "username or email (required)")
	cmd.Flags().StringVar(&role, "role", "", "'super_admin' or 'user' (required)")
	cmd.MarkFlagRequired("user")
	cmd.MarkFlagRequired("role")
	return cmd
}

func adminListUsersCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "list-users",
		Short: "List all user accounts",
		RunE: func(cmd *cobra.Command, args []string) error {
			st, err := openStoreFromEnv()
			if err != nil {
				return err
			}
			defer st.Close()
			accts, _ := users.NewAccounts(st)
			list, err := accts.List(context.Background())
			if err != nil {
				return err
			}
			fmt.Printf("%-20s %-30s %-15s %-10s %s\n", "USERNAME", "EMAIL", "ROLE", "STATUS", "ID")
			for _, u := range list {
				fmt.Printf("%-20s %-30s %-15s %-10s %s\n", u.Username, u.Email, u.Role, u.Status, u.ID)
			}
			return nil
		},
	}
}

func adminUpdateUserCmd() *cobra.Command {
	var login, displayName, role, status string
	var quota int64
	var setQuota bool
	cmd := &cobra.Command{
		Use:   "update-user",
		Short: "Update a user's display name, role, status, or agent quota",
		RunE: func(cmd *cobra.Command, args []string) error {
			st, err := openStoreFromEnv()
			if err != nil {
				return err
			}
			defer st.Close()
			ctx := context.Background()
			accts, _ := users.NewAccounts(st)
			rec, err := st.GetUserByLogin(ctx, login)
			if err != nil {
				return err
			}
			var quotaPtr *int64
			if setQuota {
				quotaPtr = &quota
			}
			acct, err := accts.Update(ctx, rec.ID, displayName, role, status, quotaPtr)
			if err != nil {
				return err
			}
			fmt.Printf("updated user %s role=%s status=%s quota=%d id=%s\n", acct.Username, acct.Role, acct.Status, acct.AgentQuota, acct.ID)
			return nil
		},
	}
	cmd.Flags().StringVar(&login, "user", "", "username or email (required)")
	cmd.Flags().StringVar(&displayName, "display-name", "", "display name")
	cmd.Flags().StringVar(&role, "role", "", "'super_admin' or 'user'")
	cmd.Flags().StringVar(&status, "status", "", "'active' or 'disabled'")
	cmd.Flags().Int64Var(&quota, "agent-quota", 0, "agent quota; -1 for unlimited")
	cmd.Flags().BoolVar(&setQuota, "set-agent-quota", false, "write --agent-quota instead of leaving it unchanged")
	cmd.MarkFlagRequired("user")
	return cmd
}

func adminDeleteUserCmd() *cobra.Command {
	var login string
	cmd := &cobra.Command{
		Use:     "delete-user",
		Aliases: []string{"rm-user"},
		Short:   "Delete a user account",
		RunE: func(cmd *cobra.Command, args []string) error {
			st, err := openStoreFromEnv()
			if err != nil {
				return err
			}
			defer st.Close()
			ctx := context.Background()
			accts, _ := users.NewAccounts(st)
			rec, err := st.GetUserByLogin(ctx, login)
			if err != nil {
				return err
			}
			if err := accts.Delete(ctx, rec.ID); err != nil {
				return err
			}
			fmt.Printf("deleted user %s (%s)\n", rec.Username, rec.ID)
			return nil
		},
	}
	cmd.Flags().StringVar(&login, "user", "", "username or email (required)")
	cmd.MarkFlagRequired("user")
	return cmd
}

```

### Core Architecture Module: `cmd/fastclaw/cmd_agents.go`
```
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/spf13/cobra"

	"github.com/fastclaw-ai/fastclaw/internal/agentcli"
	"github.com/fastclaw-ai/fastclaw/internal/config"
	"github.com/fastclaw-ai/fastclaw/internal/daemon"
	"github.com/fastclaw-ai/fastclaw/internal/gateway"
)

// agentsCmd is a thin CLI front-end for the same agent CRUD the
// dashboard performs over HTTP. Every subcommand opens the operator's
// own store via openStoreFromEnv (defined in cmd_admin.go) and writes
// into the same tables the gateway reads. There is no separate
// "instance" concept — agents created here show up in the dashboard.
func agentsCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "agents",
		Short: "Create and manage agents from the command line",
	}
	addAgentsSubcommand(cmd, agentsListCmd())
	addAgentsSubcommand(cmd, agentsInitCmd())
	addAgentsSubcommand(cmd, agentsRemoveCmd())
	addAgentsSubcommand(cmd, agentsConfigCmd())
	addAgentsSubcommand(cmd, agentsDoctorCmd())
	addAgentsSubcommand(cmd, agentsFilesCmd())
	return cmd
}

// addAgentsSubcommand wires a child command and silences cobra's usage
// dump on every error throughout the agents tree.
func addAgentsSubcommand(parent, child *cobra.Command) {
	silenceTree(child)
	parent.AddCommand(child)
}

func silenceTree(cmd *cobra.Command) {
	cmd.SilenceUsage = true
	for _, sub := range cmd.Commands() {
		silenceTree(sub)
	}
}

// notifyGatewayReload signals the running gateway (if any) so it picks
// up store mutations the CLI just made. On Unix it sends SIGHUP to the
// daemon PID; the gateway's reload handler invalidates every cached
// UserSpace. On Windows it falls back to a hint, since SIGHUP isn't
// delivered there.
func notifyGatewayReload() {
	st, err := daemon.GetStatus()
	if err != nil || st == nil || !st.Running {
		return
	}
	if err := daemon.SignalReload(st.PID); err != nil {
		fmt.Fprintf(os.Stderr, "Note: gateway is running (PID %d) but reload signal failed: %v. Restart it with `fastclaw daemon restart` for changes to take effect.\n", st.PID, err)
		return
	}
	fmt.Fprintf(os.Stderr, "Reloaded gateway (PID %d).\n", st.PID)
}

// ensureGatewayRunning is the post-`agents init` hook that turns a fresh
// agent record into something the user can immediately chat with. If the
// gateway is already up, we send SIGHUP so it picks up the new agent.
// Otherwise we launch it in the background (same path as
// `fastclaw daemon start`) and print the URL.
func ensureGatewayRunning() {
	st, _ := daemon.GetStatus()
	if st != nil && st.Running {
		notifyGatewayReload()
		return
	}
	port := config.LoadEnv().Gateway.Port
	if port <= 0 {
		port = 18953
	}
	if err := daemon.Start(port); err != nil {
		fmt.Fprintf(os.Stderr, "Note: failed to auto-start gateway: %v. Start it with `fastclaw daemon start`.\n", err)
		return
	}
	fmt.Printf("URL:      http://localhost:%d\n", port)
}

func agentsListCmd() *cobra.Command {
	return &cobra.Command{
		Use:     "ls",
		Aliases: []string{"list"},
		Short:   "List agents in the operator's store",
		RunE: func(cmd *cobra.Command, args []string) error {
			st, err := openStoreFromEnv()
			if err != nil {
				return err
			}
			defer st.Close()
			agents, err := agentcli.List(context.Background(), st)
			if err != nil {
				return err
			}
			if len(agents) == 0 {
				fmt.Println("No agents.")
				return nil
			}
			fmt.Printf("%-30s %-22s %s\n", "NAME", "ID", "OWNER")
			for _, ag := range agents {
				fmt.Printf("%-30s %-22s %s\n", ag.Name, ag.ID, ag.UserID)
			}
			return nil
		},
	}
}

func agentsInitCmd() *cobra.Command {
	var opts agentcli.InitOptions
	cmd := &cobra.Command{
		Use:     "init <name>",
		Aliases: []string{"create", "new", "add"},
		Short:   "Create or update an agent in the operator's store",
		Args:    cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			st, err := openStoreFromEnv()
			if err != nil {
				return err
			}
			defer st.Close()
			ctx := context.Background()
			res, err := agentcli.Init(ctx, st, args[0], opts)
			if err != nil {
				return err
			}
			verb := "updated"
			if res.Created {
				verb = "created"
			}
			fmt.Printf("Agent %q %s\n", res.Agent.Name, verb)
			fmt.Printf("Agent ID: %s\n", res.Agent.ID)
			fmt.Printf("Owner:    %s\n", res.Agent.UserID)
			if res.ProviderSaved {
				fmt.Println("Provider: saved")
			}
			if res.ModelSaved {
				fmt.Println("Model:    saved (agent scope)")
			}
			if !res.ModelSaved {
				model, _ := agentcli.GetConfig(ctx, st, res.Agent.ID, "model")
				if model == nil || model == "" {
					fmt.Fprintln(os.Stderr, "Hint: no model is configured for this agent. Set one with:")
					fmt.Fprintf(os.Stderr, "  fastclaw agents config %s set model <provider>/<model>\n", res.Agent.Name)
				}
			}
			if res.OwnerCreated && res.GeneratedPassword != "" {
				fmt.Printf("Created user %q with password: %s\n", res.OwnerUsername, res.GeneratedPassword)
			}
			ensureGatewayRunning()
			return nil
		},
	}
	cmd.Flags().StringVar(&opts.AgentID, "id", "", "agent id (default: auto-generated; pass an existing agt_ id to update an agent created via the dashboard)")
	cmd.Flags().StringVar(&opts.Description, "description", "", "description for the agent")
	cmd.Flags().StringVar(&opts.Provider, "provider", "", "provider name, e.g. openai, openrouter, anthropic, ollama")
	cmd.Flags().StringVar(&opts.Model, "model", "", "default model, either <provider>/<model> or <model> with --provider")
	cmd.Flags().StringVar(&opts.APIKeyEnv, "api-key-env", "", "environment variable containing the provider API key")
	cmd.Flags().StringVar(&opts.APIBase, "api-base", "", "provider API base URL")
	cmd.Flags().StringVar(&opts.APIType, "api-type", "", "provider API type (default from provider preset)")
	cmd.Flags().StringVar(&opts.AuthType, "auth-type", "", "provider auth type (default from provider preset)")
	cmd.Flags().StringVar(&opts.Username, "username", "", `owner username (default: "admin")`)
	cmd.Flags().StringVar(&opts.Email, "email", "", "owner email when the user is being created")
	cmd.Flags().StringVar(&opts.Password, "password", "", "owner password when the user is being created (default: generate)")
	cmd.Flags().StringVar(&opts.DisplayName, "display-name", "", "admin display name")
	return cmd
}

func agentsRemoveCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:     "rm <name>",
		Aliases: []string{"remove"},
		Short:   "Remove an agent from the operator's store",
		Args:    cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			st, err := openStoreFromEnv()
			if err != nil {
				return err
			}
			defer st.Close()
			rec, err := agentcli.Remove(context.Background(), st, args[0])
			if err != nil {
				return err
			}
			fmt.Printf("Agent %q (%s) removed\n", rec.Name, rec.ID)
			notifyGatewayReload()
			return nil
		},
	}
	return cmd
}

// agentsDoctorCmd answers "is this agent actually able to do its job",
// which is a different question from "was it configured".
//
// Provisioning an agent touches several independent things — a record, a
// model, skills on disk, provider credentials for the tools those skills
// drive — and each one reports success on its own. The combination is
// what can be broken: an illustration agent whose skill installed
// perfectly and whose image_gen was never wired looks healthy in every
// individual check and produces nothing.
func agentsDoctorCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "doctor <name>",
		Short: "Check whether an agent is actually able to do its job",
		Long: `Report an agent's readiness: model configured, skills installed, and
whether the tools those skills declare they need are actually available.

Skills declare their requirements in SKILL.md frontmatter:

  metadata:
    fastclaw:
      requires:
        tools: [image_gen]
        bins: [ffmpeg]
        env: [SOME_API_KEY]

Exits non-zero when the agent is not ready, so it can gate a provisioning
script.`,
		Args: cobra.Exac
```

### Core Architecture Module: `cmd/fastclaw/cmd_apikey.go`
```
package main

import (
	"context"
	"fmt"

	"github.com/spf13/cobra"

	"github.com/fastclaw-ai/fastclaw/internal/users"
)

func apikeyCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "apikey",
		Short: "Manage API keys (create, list, delete, rotate)",
	}
	cmd.AddCommand(apikeyCreateCmd())
	cmd.AddCommand(apikeyListCmd())
	cmd.AddCommand(apikeyDeleteCmd())
	cmd.AddCommand(apikeyRotateCmd())
	return cmd
}

func apikeyCreateCmd() *cobra.Command {
	var name, keyType, owner string
	cmd := &cobra.Command{
		Use:   "create",
		Short: "Create a new API key",
		Long: `Create a new API key for the specified owner (or the first super_admin).

Key types:
  admin  — full platform access (only super_admin should own these)
  user   — scoped to owner's resources; supports X-Fastclaw-End-User for app_user provisioning
  agent  — locked to explicit agent list (requires --agents)`,
		RunE: func(cmd *cobra.Command, args []string) error {
			st, err := openStoreFromEnv()
			if err != nil {
				return err
			}
			defer st.Close()

			if owner == "" {
				accts, err := users.NewAccounts(st)
				if err != nil {
					return err
				}
				list, err := accts.List(context.Background())
				if err != nil {
					return err
				}
				for _, u := range list {
					if u.Role == users.RoleSuperAdmin {
						owner = u.ID
						break
					}
				}
				if owner == "" {
					return fmt.Errorf("no super_admin found; use --owner to specify user ID")
				}
			}

			ak, err := users.NewAPIKeys(st)
			if err != nil {
				return err
			}
			rec, token, err := ak.Create(context.Background(), owner, name, keyType, nil)
			if err != nil {
				return err
			}
			fmt.Printf("created apikey id=%s name=%s type=%s owner=%s\n", rec.ID, name, keyType, owner)
			fmt.Printf("token: %s\n", token)
			fmt.Println("(save this token now — it won't be shown again)")
			return nil
		},
	}
	cmd.Flags().StringVar(&name, "name", "", "key name (required)")
	cmd.Flags().StringVar(&keyType, "type", "user", "'admin', 'user', or 'agent'")
	cmd.Flags().StringVar(&owner, "owner", "", "owner user ID (defaults to first super_admin)")
	cmd.MarkFlagRequired("name")
	return cmd
}

func apikeyListCmd() *cobra.Command {
	var owner string
	cmd := &cobra.Command{
		Use:   "list",
		Short: "List API keys for a user",
		RunE: func(cmd *cobra.Command, args []string) error {
			st, err := openStoreFromEnv()
			if err != nil {
				return err
			}
			defer st.Close()

			if owner == "" {
				accts, err := users.NewAccounts(st)
				if err != nil {
					return err
				}
				list, err := accts.List(context.Background())
				if err != nil {
					return err
				}
				for _, u := range list {
					if u.Role == users.RoleSuperAdmin {
						owner = u.ID
						break
					}
				}
				if owner == "" {
					return fmt.Errorf("no super_admin found; use --owner to specify user ID")
				}
			}

			ak, err := users.NewAPIKeys(st)
			if err != nil {
				return err
			}
			keys, err := ak.List(context.Background(), owner)
			if err != nil {
				return err
			}
			if len(keys) == 0 {
				fmt.Println("no API keys found")
				return nil
			}
			fmt.Printf("%-36s %-20s %-10s %-10s %s\n", "ID", "NAME", "PREFIX", "TYPE", "CREATED")
			for _, k := range keys {
				fmt.Printf("%-36s %-20s %-10s %-10s %s\n",
					k.ID, k.Name, k.Key, k.Type, k.CreatedAt.Format("2006-01-02"))
			}
			return nil
		},
	}
	cmd.Flags().StringVar(&owner, "owner", "", "owner user ID (defaults to first super_admin)")
	return cmd
}

func apikeyDeleteCmd() *cobra.Command {
	var id string
	cmd := &cobra.Command{
		Use:   "delete",
		Short: "Delete an API key by ID",
		RunE: func(cmd *cobra.Command, args []string) error {
			st, err := openStoreFromEnv()
			if err != nil {
				return err
			}
			defer st.Close()
			ak, err := users.NewAPIKeys(st)
			if err != nil {
				return err
			}
			if err := ak.Delete(context.Background(), id); err != nil {
				return err
			}
			fmt.Printf("deleted apikey %s\n", id)
			return nil
		},
	}
	cmd.Flags().StringVar(&id, "id", "", "apikey ID (required)")
	cmd.MarkFlagRequired("id")
	return cmd
}

func apikeyRotateCmd() *cobra.Command {
	var id string
	cmd := &cobra.Command{
		Use:   "rotate",
		Short: "Rotate an API key (issue new token, invalidate old)",
		RunE: func(cmd *cobra.Command, args []string) error {
			st, err := openStoreFromEnv()
			if err != nil {
				return err
			}
			defer st.Close()
			ak, err := users.NewAPIKeys(st)
			if err != nil {
				return err
			}
			token, err := ak.Rotate(context.Background(), id)
			if err != nil {
				return err
			}
			fmt.Printf("rotated apikey %s\n", id)
			fmt.Printf("new token: %s\n", token)
			fmt.Println("(save this token now — it won't be shown again)")
			return nil
		},
	}
	cmd.Flags().StringVar(&id, "id", "", "apikey ID (required)")
	cmd.MarkFlagRequired("id")
	return cmd
}

```

### Core Architecture Module: `cmd/fastclaw/cmd_channels.go`
```
package main

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/spf13/cobra"

	"github.com/fastclaw-ai/fastclaw/internal/agentcli"
	"github.com/fastclaw-ai/fastclaw/internal/config"
	"github.com/fastclaw-ai/fastclaw/internal/store"
)

func channelsCmd() *cobra.Command {
	cmd := &cobra.Command{Use: "channels", Short: "Manage IM channel bindings"}
	cmd.AddCommand(channelsListCmd(), channelsConnectCmd(), channelsDeleteCmd())
	return cmd
}

func channelsListCmd() *cobra.Command {
	var agentName string
	cmd := &cobra.Command{
		Use:     "list",
		Aliases: []string{"ls"},
		Short:   "List channel bindings",
		RunE: func(cmd *cobra.Command, args []string) error {
			st, err := openStoreFromEnv()
			if err != nil {
				return err
			}
			defer st.Close()
			ctx := context.Background()
			var rows []store.ChannelRecord
			if agentName != "" {
				ag, err := agentcli.Resolve(ctx, st, agentName)
				if err != nil {
					return err
				}
				rows, err = st.ListChannels(ctx, ag.UserID, ag.ID)
			} else {
				rows, err = st.ListAllChannels(ctx)
			}
			if err != nil {
				return err
			}
			if len(rows) == 0 {
				fmt.Println("No channels.")
				return nil
			}
			fmt.Printf("%-24s %-10s %-20s %-22s %-22s %-8s %s\n", "ID", "TYPE", "ACCOUNT", "USER", "AGENT", "ENABLED", "UPDATED")
			for _, ch := range rows {
				fmt.Printf("%-24s %-10s %-20s %-22s %-22s %-8v %s\n",
					ch.ID, ch.Type, ch.AccountID, ch.UserID, ch.AgentID, ch.Enabled, ch.UpdatedAt.Format("2006-01-02 15:04"))
			}
			return nil
		},
	}
	cmd.Flags().StringVar(&agentName, "agent", "", "agent name or id")
	return cmd
}

func channelsConnectCmd() *cobra.Command {
	var agentName, typ, accountID, token, baseURL, userID, appSecret, verificationToken, encryptKey string
	var shared bool
	cmd := &cobra.Command{
		Use:   "connect",
		Short: "Create or update a channel binding",
		RunE: func(cmd *cobra.Command, args []string) error {
			st, err := openStoreFromEnv()
			if err != nil {
				return err
			}
			defer st.Close()
			ctx := context.Background()
			ag, err := agentcli.Resolve(ctx, st, agentName)
			if err != nil {
				return err
			}
			if typ == "" || accountID == "" {
				return fmt.Errorf("--type and --account are required")
			}
			cc := config.ChannelConfig{
				Enabled: true,
				Accounts: map[string]config.AccountConfig{
					accountID: {
						BotToken: token,
						BaseURL:  baseURL,
						UserID:   userID,
					},
				},
			}
			if typ == "feishu" {
				cc.Accounts[accountID] = config.AccountConfig{
					BotToken:   appSecret,
					UserID:     verificationToken,
					EncryptKey: encryptKey,
				}
			}
			data := channelConfigData(cc)
			ch := &store.ChannelRecord{
				ID:             "ch_" + typ + "_" + uuid.NewString(),
				UserID:         ag.UserID,
				AgentID:        ag.ID,
				Type:           typ,
				AccountID:      accountID,
				Enabled:        true,
				BotToken:       token,
				BaseURL:        baseURL,
				PlatformUserID: userID,
				SharedIdentity: shared,
				Data:           data,
			}
			if typ == "feishu" {
				ch.BotToken = appSecret
				ch.PlatformUserID = verificationToken
			}
			if err := st.SaveChannel(ctx, ch); err != nil {
				return err
			}
			fmt.Printf("Saved channel %s:%s for agent %s\n", typ, accountID, ag.ID)
			notifyGatewayReload()
			return nil
		},
	}
	cmd.Flags().StringVar(&agentName, "agent", "", "agent name or id (required)")
	cmd.Flags().StringVar(&typ, "type", "", "channel type: telegram, discord, slack, line, feishu")
	cmd.Flags().StringVar(&accountID, "account", "", "channel account id / bot username / app id (required)")
	cmd.Flags().StringVar(&token, "token", "", "bot token / access token")
	cmd.Flags().StringVar(&baseURL, "base-url", "", "optional base URL")
	cmd.Flags().StringVar(&userID, "user-id", "", "platform user id or secret field for some adapters")
	cmd.Flags().StringVar(&appSecret, "app-secret", "", "Feishu app secret")
	cmd.Flags().StringVar(&verificationToken, "verification-token", "", "Feishu verification token")
	cmd.Flags().StringVar(&encryptKey, "encrypt-key", "", "Feishu encrypt key")
	cmd.Flags().BoolVar(&shared, "shared-identity", false, "share owner identity across channels")
	_ = cmd.MarkFlagRequired("agent")
	return cmd
}

func channelsDeleteCmd() *cobra.Command {
	return &cobra.Command{
		Use:     "delete <id>",
		Aliases: []string{"rm"},
		Short:   "Delete a channel binding by id",
		Args:    cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			st, err := openStoreFromEnv()
			if err != nil {
				return err
			}
			defer st.Close()
			if err := st.DeleteChannel(context.Background(), args[0]); err != nil {
				return err
			}
			fmt.Printf("Deleted channel %s\n", args[0])
			notifyGatewayReload()
			return nil
		},
	}
}

func channelConfigData(c config.ChannelConfig) map[string]interface{} {
	blob, _ := json.Marshal(c)
	var m map[string]interface{}
	_ = json.Unmarshal(blob, &m)
	delete(m, "enabled")
	return m
}

```

### Core Architecture Module: `cmd/fastclaw/cmd_chat.go`
```
package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/spf13/cobra"

	"github.com/fastclaw-ai/fastclaw/internal/cliclient"
	"github.com/fastclaw-ai/fastclaw/internal/config"
	"github.com/fastclaw-ai/fastclaw/internal/daemon"
	"github.com/fastclaw-ai/fastclaw/internal/tui"
	"github.com/fastclaw-ai/fastclaw/internal/users"
)

type chatOptions struct {
	agentID      string
	session      string
	query        string
	baseURL      string
	apiKey       string
	continueLast bool
}

func chatCmd() *cobra.Command {
	var opts chatOptions
	cmd := &cobra.Command{
		Use:   "chat [message]",
		Short: "Chat with a FastClaw agent in the terminal",
		Args:  cobra.ArbitraryArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			if opts.query == "" && len(args) > 0 {
				opts.query = strings.Join(args, " ")
			}
			return runChat(cmd.Context(), opts)
		},
	}
	cmd.Flags().StringVarP(&opts.agentID, "agent", "a", "", "agent ID or name")
	cmd.Flags().StringVarP(&opts.session, "resume", "r", "", "resume a session by ID")
	cmd.Flags().BoolVarP(&opts.continueLast, "continue", "c", false, "continue the most recent session")
	cmd.Flags().StringVarP(&opts.query, "query", "q", "", "send one message and exit")
	cmd.Flags().StringVar(&opts.baseURL, "base-url", "", "gateway URL (default http://127.0.0.1:$FASTCLAW_PORT)")
	cmd.Flags().StringVar(&opts.apiKey, "api-key", "", "API key (or FASTCLAW_API_KEY)")
	return cmd
}

func isInteractiveTerminal(in, out *os.File) bool {
	inStat, inErr := in.Stat()
	outStat, outErr := out.Stat()
	return inErr == nil && outErr == nil && inStat.Mode()&os.ModeCharDevice != 0 && outStat.Mode()&os.ModeCharDevice != 0
}

func runChat(ctx context.Context, opts chatOptions) error {
	env := config.LoadEnv()
	port := env.Gateway.Port
	if port == 0 {
		port = 18953
	}
	localGateway := opts.baseURL == ""
	if opts.baseURL == "" {
		opts.baseURL = fmt.Sprintf("http://127.0.0.1:%d", port)
	}
	opts.baseURL = strings.TrimRight(opts.baseURL, "/")
	if opts.apiKey == "" {
		opts.apiKey = os.Getenv("FASTCLAW_API_KEY")
	}
	if opts.query == "" && !isInteractiveTerminal(os.Stdin, os.Stdout) {
		if data, err := io.ReadAll(os.Stdin); err == nil {
			opts.query = strings.TrimSpace(string(data))
		}
	}

	if localGateway {
		if err := ensureGateway(ctx, opts.baseURL, port); err != nil {
			return err
		}
	}
	if opts.apiKey == "" {
		if !localGateway {
			return errors.New("remote chat requires --api-key or FASTCLAW_API_KEY")
		}
		var err error
		opts.apiKey, err = ensureCLIToken(ctx)
		if err != nil {
			return err
		}
	}

	c := cliclient.New(opts.baseURL, opts.apiKey)
	agents, err := c.Agents(ctx)
	if err != nil {
		return fmt.Errorf("load agents: %w", err)
	}
	if len(agents) == 0 {
		return errors.New("no agents configured; create one with `fastclaw agents init <name>`")
	}
	agent, err := selectAgent(agents, opts.agentID)
	if err != nil {
		return err
	}
	resume := opts.session != ""
	if opts.continueLast && opts.session == "" {
		sessions, err := c.Sessions(ctx, agent.ID)
		if err != nil {
			return err
		}
		if len(sessions) > 0 {
			opts.session = sessions[0].ID
			resume = true
		}
	}
	if opts.session == "" {
		opts.session = cliclient.NewSessionID()
	}

	if opts.query != "" {
		return plainStream(ctx, c, agent.ID, opts.session, opts.query, os.Stdout)
	}
	if !isInteractiveTerminal(os.Stdin, os.Stdout) {
		return errors.New("interactive chat requires a terminal; use --query or pipe a message as an argument")
	}
	return tui.Run(tui.Options{
		Client:      c,
		Agent:       agent,
		Agents:      agents,
		SessionID:   opts.session,
		LoadHistory: resume,
		Version:     version,
	})
}

func ensureGateway(ctx context.Context, baseURL string, port int) error {
	if gatewayReady(ctx, baseURL) {
		warnVersionSkew(ctx, baseURL)
		return nil
	}
	st, _ := daemon.GetStatus()
	if st == nil || !st.Running {
		fmt.Fprintln(os.Stderr, "Starting FastClaw gateway…")
		if err := daemon.Start(port); err != nil {
			return err
		}
	}
	deadline := time.Now().Add(20 * time.Second)
	for time.Now().Before(deadline) {
		if gatewayReady(ctx, baseURL) {
			warnVersionSkew(ctx, baseURL)
			return nil
		}
		time.Sleep(200 * time.Millisecond)
	}
	return fmt.Errorf("gateway did not become ready at %s; check `fastclaw daemon logs`", baseURL)
}

// warnVersionSkew compares the running gateway's version against this
// CLI binary and warns when they differ. The chat client reuses any
// healthy gateway on the port, so after an upgrade or `make install`
// the daemon keeps serving the OLD code until restarted — without this
// check the only symptom is the agent reporting a stale version in
// conversation. Best-effort: any probe failure is silently ignored.
func warnVersionSkew(ctx context.Context, baseURL string) {
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, baseURL+"/api/status", nil)
	client := &http.Client{Timeout: time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return
	}
	defer resp.Body.Close()
	var st struct {
		Version string `json:"version"`
	}
	if json.NewDecoder(resp.Body).Decode(&st) != nil {
		return
	}
	if st.Version != "" && st.Version != version {
		fmt.Fprintf(os.Stderr, "⚠ gateway is running FastClaw %s but this CLI is %s — run `fastclaw daemon restart` to pick up the new binary\n", st.Version, version)
	}
}

func gatewayReady(ctx context.Context, baseURL string) bool {
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, baseURL+"/healthz", nil)
	client := &http.Client{Timeout: 500 * time.Millisecond}
	resp, err := client.Do(req)
	if err != nil {
		return false
	}
	resp.Body.Close()
	return resp.StatusCode == http.StatusOK
}

func ensureCLIToken(ctx context.Context) (string, error) {
	home, err := config.HomeDir()
	if err != nil {
		return "", err
	}
	path := filepath.Join(home, "cli-token")
	if data, err := os.ReadFile(path); err == nil && strings.TrimSpace(string(data)) != "" {
		return strings.TrimSpace(string(data)), nil
	}
	st, err := openStoreFromEnv()
	if err != nil {
		return "", err
	}
	defer st.Close()
	accounts, err := users.NewAccounts(st)
	if err != nil {
		return "", err
	}
	list, err := accounts.List(ctx)
	if err != nil {
		return "", err
	}
	owner := ""
	for _, account := range list {
		if account.Role == users.RoleSuperAdmin {
			owner = account.ID
			break
		}
	}
	if owner == "" {
		return "", errors.New("no super_admin found; finish FastClaw onboarding first")
	}
	keys, err := users.NewAPIKeys(st)
	if err != nil {
		return "", err
	}
	_, token, err := keys.Create(ctx, owner, "FastClaw terminal", users.APIKeyTypeUser, nil)
	if err != nil {
		return "", err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return "", fmt.Errorf("create terminal credential directory: %w", err)
	}
	if err := os.WriteFile(path, []byte(token+"\n"), 0o600); err != nil {
		return "", fmt.Errorf("save terminal credential: %w", err)
	}
	return token, nil
}

func selectAgent(agents []cliclient.Agent, wanted string) (cliclient.Agent, error) {
	if wanted == "" {
		// The API currently returns agents newest-first. The terminal's
		// implicit default is the user's first-created agent, independent of
		// the response ordering. Older servers may omit createdAt; preserve
		// their response order in that case.
		selected := agents[0]
		for _, agent := range agents[1:] {
			if !agent.CreatedAt.IsZero() && (selected.CreatedAt.IsZero() || agent.CreatedAt.Before(selected.CreatedAt)) {
				selected = agent
			}
		}
		return selected, nil
	}
	for _, agent := range agents {
		if agent.ID == wanted || strings.EqualFold(agent.Name, wanted) {
			return agent, nil
		}
	}
	return cliclient.Agent{}, fmt.Errorf("agent %q not found", wanted)
}

// plainStream renders one turn as line-oriented text: markdown-rendered
// when stdout is a terminal, clean plain text when piped. Used by the
// one-shot --query / stdin path; the interactive path uses internal/tui.
func plainS
```

### Core Architecture Module: `cmd/fastclaw/cmd_cron.go`
```
package main

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/spf13/cobra"

	"github.com/fastclaw-ai/fastclaw/internal/agentcli"
	"github.com/fastclaw-ai/fastclaw/internal/cron"
	"github.com/fastclaw-ai/fastclaw/internal/store"
)

func cronCmd() *cobra.Command {
	cmd := &cobra.Command{Use: "cron", Short: "Manage scheduled jobs"}
	cmd.AddCommand(cronListCmd(), cronCreateCmd(), cronEnableCmd(), cronDeleteCmd())
	return cmd
}

func cronListCmd() *cobra.Command {
	var agentName string
	cmd := &cobra.Command{
		Use:     "list",
		Aliases: []string{"ls"},
		Short:   "List scheduled jobs",
		RunE: func(cmd *cobra.Command, args []string) error {
			st, err := openStoreFromEnv()
			if err != nil {
				return err
			}
			defer st.Close()
			ctx := context.Background()
			var jobs []store.CronJobRecord
			if agentName != "" {
				ag, err := agentcli.Resolve(ctx, st, agentName)
				if err != nil {
					return err
				}
				jobs, err = st.ListCronJobsByAgent(ctx, ag.ID)
			} else {
				all, err := st.ListAllAgents(ctx)
				if err != nil {
					return err
				}
				for _, ag := range all {
					part, err := st.ListCronJobsByAgent(ctx, ag.ID)
					if err != nil {
						return err
					}
					jobs = append(jobs, part...)
				}
			}
			if err != nil {
				return err
			}
			if len(jobs) == 0 {
				fmt.Println("No cron jobs.")
				return nil
			}
			fmt.Printf("%-36s %-22s %-8s %-12s %-10s %-16s %-20s %s\n", "ID", "AGENT", "TYPE", "SCHEDULE", "ENABLED", "CHANNEL", "NEXT_RUN", "NAME")
			for _, j := range jobs {
				next := "-"
				if j.NextRun != nil {
					next = j.NextRun.Format("2006-01-02 15:04")
				}
				fmt.Printf("%-36s %-22s %-8s %-12s %-10v %-16s %-20s %s\n",
					j.ID, j.AgentID, j.Type, j.Schedule, j.Enabled, j.Channel+":"+j.AccountID, next, j.Name)
			}
			return nil
		},
	}
	cmd.Flags().StringVar(&agentName, "agent", "", "agent name or id")
	return cmd
}

func cronCreateCmd() *cobra.Command {
	var agentName, name, typ, schedule, message, channel, accountID, chatID, timezone, chatterID string
	cmd := &cobra.Command{
		Use:   "create",
		Short: "Create a scheduled job",
		RunE: func(cmd *cobra.Command, args []string) error {
			st, err := openStoreFromEnv()
			if err != nil {
				return err
			}
			defer st.Close()
			ctx := context.Background()
			ag, err := agentcli.Resolve(ctx, st, agentName)
			if err != nil {
				return err
			}
			if typ == "" {
				typ = "cron"
			}
			if timezone == "" {
				timezone = time.Local.String()
			}
			next := nextCronRun(typ, schedule, timezone)
			job := &store.CronJobRecord{
				ID:        uuid.NewString(),
				UserID:    ag.UserID,
				ChatterID: chatterID,
				AgentID:   ag.ID,
				Name:      name,
				Type:      typ,
				Schedule:  schedule,
				Message:   message,
				Channel:   channel,
				AccountID: accountID,
				ChatID:    chatID,
				Timezone:  timezone,
				Enabled:   true,
				NextRun:   &next,
			}
			if err := st.SaveCronJob(ctx, job); err != nil {
				return err
			}
			cron.NotifyJobCreated()
			fmt.Printf("Created cron job %s next_run=%s\n", job.ID, next.Format(time.RFC3339))
			notifyGatewayReload()
			return nil
		},
	}
	cmd.Flags().StringVar(&agentName, "agent", "", "agent name or id (required)")
	cmd.Flags().StringVar(&name, "name", "", "job name")
	cmd.Flags().StringVar(&typ, "type", "cron", "job type: once, interval, cron")
	cmd.Flags().StringVar(&schedule, "schedule", "", "schedule: RFC3339 for once, duration for interval, 5-field cron for cron")
	cmd.Flags().StringVar(&message, "message", "", "message to send to the agent")
	cmd.Flags().StringVar(&channel, "channel", "web", "target channel")
	cmd.Flags().StringVar(&accountID, "account", "", "target channel account id")
	cmd.Flags().StringVar(&chatID, "chat", "", "target chat id")
	cmd.Flags().StringVar(&timezone, "timezone", "Asia/Shanghai", "IANA timezone")
	cmd.Flags().StringVar(&chatterID, "chatter", "", "chatter (per-sender app_user) that owns this job; empty means owner/system-created")
	_ = cmd.MarkFlagRequired("agent")
	_ = cmd.MarkFlagRequired("schedule")
	_ = cmd.MarkFlagRequired("message")
	_ = cmd.MarkFlagRequired("chat")
	return cmd
}

func cronEnableCmd() *cobra.Command {
	var enabled bool
	cmd := &cobra.Command{
		Use:   "set-enabled <id>",
		Short: "Enable or disable a scheduled job",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			st, err := openStoreFromEnv()
			if err != nil {
				return err
			}
			defer st.Close()
			ctx := context.Background()
			job, err := st.GetCronJob(ctx, args[0])
			if err != nil {
				return err
			}
			job.Enabled = enabled
			if err := st.SaveCronJob(ctx, job); err != nil {
				return err
			}
			fmt.Printf("Set %s enabled=%v\n", job.ID, enabled)
			cron.NotifyJobCreated()
			notifyGatewayReload()
			return nil
		},
	}
	cmd.Flags().BoolVar(&enabled, "enabled", true, "enabled value")
	return cmd
}

func cronDeleteCmd() *cobra.Command {
	return &cobra.Command{
		Use:     "delete <id>",
		Aliases: []string{"rm"},
		Short:   "Delete a scheduled job",
		Args:    cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			st, err := openStoreFromEnv()
			if err != nil {
				return err
			}
			defer st.Close()
			if err := st.DeleteCronJob(context.Background(), args[0]); err != nil {
				return err
			}
			fmt.Printf("Deleted cron job %s\n", args[0])
			cron.NotifyJobCreated()
			notifyGatewayReload()
			return nil
		},
	}
}

func nextCronRun(typ, schedule, tz string) time.Time {
	now := time.Now()
	switch typ {
	case "once":
		if t, err := time.Parse(time.RFC3339, schedule); err == nil {
			return t
		}
	case "interval":
		if d, err := time.ParseDuration(schedule); err == nil {
			return now.Add(d)
		}
	case "cron":
		return cron.NextOccurrenceIn(schedule, now, cron.LocationOf(tz))
	}
	return now.Add(time.Minute)
}

```

### Core Architecture Module: `cmd/fastclaw/cmd_daemon.go`
```
package main

import (
	"fmt"
	"os"
	"os/exec"
	"time"

	"github.com/spf13/cobra"

	"github.com/fastclaw-ai/fastclaw/internal/daemon"
)

// daemonCmd handles daemon/service management subcommands.
func daemonCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "daemon",
		Short: "Manage the FastClaw gateway daemon",
	}
	cmd.AddCommand(daemonStartCmd())
	cmd.AddCommand(daemonStopCmd())
	cmd.AddCommand(daemonRestartCmd())
	cmd.AddCommand(daemonStatusCmd())
	cmd.AddCommand(daemonLogsCmd())
	cmd.AddCommand(daemonInstallCmd())
	cmd.AddCommand(daemonUninstallCmd())
	cmd.AddCommand(daemonRunCmd()) // internal, hidden
	return cmd
}

func daemonStartCmd() *cobra.Command {
	var port int
	cmd := &cobra.Command{
		Use:   "start",
		Short: "Start the gateway as a background daemon",
		RunE: func(cmd *cobra.Command, args []string) error {
			return daemon.Start(port)
		},
	}
	cmd.Flags().IntVar(&port, "port", 18953, "port for gateway")
	return cmd
}

func daemonStopCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "stop",
		Short: "Stop the running daemon",
		RunE: func(cmd *cobra.Command, args []string) error {
			return daemon.Stop()
		},
	}
}

func daemonRestartCmd() *cobra.Command {
	var port int
	cmd := &cobra.Command{
		Use:   "restart",
		Short: "Restart the daemon",
		RunE: func(cmd *cobra.Command, args []string) error {
			// Stop (ignore error if not running)
			_ = daemon.Stop()
			time.Sleep(500 * time.Millisecond)
			return daemon.Start(port)
		},
	}
	cmd.Flags().IntVar(&port, "port", 18953, "port for gateway")
	return cmd
}

func daemonStatusCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "status",
		Short: "Show daemon status",
		RunE: func(cmd *cobra.Command, args []string) error {
			st, err := daemon.GetStatus()
			if err != nil {
				return err
			}

			if !st.Running {
				fmt.Println("Status: stopped")
				return nil
			}

			fmt.Printf("Status: running\n")
			fmt.Printf("PID:    %d\n", st.PID)
			fmt.Printf("Uptime: %s\n", st.Uptime.Round(time.Second))

			_, logFile, _, _ := daemon.Paths()
			fmt.Printf("Logs:   %s\n", logFile)
			return nil
		},
	}
}

func daemonLogsCmd() *cobra.Command {
	return newLogsCmd("logs", "Show daemon log output")
}

// logCmd is the top-level `fastclaw log` shortcut for `daemon logs`,
// with `logs` as an alias so both spellings work.
func logCmd() *cobra.Command {
	cmd := newLogsCmd("log", "Show gateway daemon logs (shortcut for `daemon logs`)")
	cmd.Aliases = []string{"logs"}
	return cmd
}

// newLogsCmd builds the shared log-viewing command registered both as
// `fastclaw daemon logs` and the top-level `fastclaw log`.
func newLogsCmd(use, short string) *cobra.Command {
	var follow bool
	var lines int
	cmd := &cobra.Command{
		Use:   use,
		Short: short,
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			_, logFile, _, err := daemon.Paths()
			if err != nil {
				return err
			}

			if _, err := os.Stat(logFile); os.IsNotExist(err) {
				return fmt.Errorf("no log file found at %s", logFile)
			}

			tailArgs := []string{"-n", fmt.Sprintf("%d", lines)}
			if follow {
				tailArgs = append(tailArgs, "-f")
			}
			tailArgs = append(tailArgs, logFile)

			tailCmd := exec.Command("tail", tailArgs...)
			tailCmd.Stdout = os.Stdout
			tailCmd.Stderr = os.Stderr
			return tailCmd.Run()
		},
	}
	cmd.Flags().BoolVarP(&follow, "follow", "f", false, "Follow log output")
	cmd.Flags().IntVarP(&lines, "lines", "n", 50, "Number of lines to show")
	return cmd
}

func daemonInstallCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "install",
		Short: "Install FastClaw as an OS service (launchd/systemd)",
		RunE: func(cmd *cobra.Command, args []string) error {
			return daemon.Install()
		},
	}
}

func daemonUninstallCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "uninstall",
		Short: "Remove the FastClaw OS service",
		RunE: func(cmd *cobra.Command, args []string) error {
			return daemon.Uninstall()
		},
	}
}

// daemonRunCmd is the internal command used by 'daemon start' to run the auto-restart loop.
func daemonRunCmd() *cobra.Command {
	var port int
	cmd := &cobra.Command{
		Use:    "__run",
		Hidden: true,
		RunE: func(cmd *cobra.Command, args []string) error {
			return daemon.RunLoop(port)
		},
	}
	cmd.Flags().IntVar(&port, "port", 18953, "port for gateway")
	return cmd
}

```

### Core Architecture Module: `cmd/fastclaw/cmd_plugin.go`
```
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/spf13/cobra"

	"github.com/fastclaw-ai/fastclaw/internal/config"
	"github.com/fastclaw-ai/fastclaw/internal/plugin"
)

const hubRepo = "fastclaw-ai/fastclaw"

// pluginCmd handles plugin management subcommands.
func pluginCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:     "plugins",
		Aliases: []string{"plugin"},
		Short:   "Manage plugins",
	}
	cmd.AddCommand(pluginListCmd())
	cmd.AddCommand(pluginInstallCmd())
	cmd.AddCommand(pluginRemoveCmd())
	return cmd
}

func pluginListCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "list",
		Short: "List discovered plugins and their status",
		RunE: func(cmd *cobra.Command, args []string) error {
			homeDir, err := config.HomeDir()
			if err != nil {
				return err
			}

			paths := []string{filepath.Join(homeDir, "plugins")}

			mgr := plugin.NewManager(nil)
			if err := mgr.Discover(paths); err != nil {
				return err
			}

			plugins := mgr.Plugins()
			if len(plugins) == 0 {
				fmt.Println("No plugins found.")
				fmt.Println("Plugin directories:", paths)
				return nil
			}

			fmt.Printf("%-15s %-20s %-10s %-10s %s\n", "ID", "NAME", "TYPE", "VERSION", "DIR")
			for _, p := range plugins {
				enabledStr := "enabled"
				fmt.Printf("%-15s %-20s %-10s %-10s %s [%s]\n",
					p.Manifest.ID,
					p.Manifest.Name,
					p.Manifest.Type,
					p.Manifest.Version,
					p.Manifest.Dir,
					enabledStr,
				)
			}
			return nil
		},
	}
}

func pluginInstallCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "install <name|github-url|npm-package|path>",
		Short: "Install a plugin from FastClaw Hub, GitHub, npm, or local path",
		Long: `Install a plugin. The source is auto-detected:

  fastclaw plugins install telegram                        # FastClaw Hub
  fastclaw plugins install github.com/user/repo            # GitHub repo
  fastclaw plugins install @ollama/web-search              # npm plugin (bridged)
  fastclaw plugins install ./my-plugin                     # local directory`,
		Args: cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			source := args[0]

			homeDir, err := config.HomeDir()
			if err != nil {
				return err
			}
			pluginsDir := filepath.Join(homeDir, "plugins")

			switch {
			case isLocalPath(source):
				return installFromLocal(source, pluginsDir)
			case isGitHubRef(source):
				return installFromGitHub(source, pluginsDir)
			case isNpmPackage(source):
				return installFromNpm(source, pluginsDir)
			default:
				return installFromHub(source, pluginsDir)
			}
		},
	}
}

func isLocalPath(s string) bool {
	return strings.HasPrefix(s, "./") || strings.HasPrefix(s, "/") || strings.HasPrefix(s, "../")
}

func isGitHubRef(s string) bool {
	return strings.HasPrefix(s, "github.com/") || strings.HasPrefix(s, "https://github.com/")
}

func isNpmPackage(s string) bool {
	// @scope/package is always npm.
	return strings.HasPrefix(s, "@")
}

func installFromLocal(srcDir, pluginsDir string) error {
	manifestPath := filepath.Join(srcDir, "plugin.json")
	data, err := os.ReadFile(manifestPath)
	if err != nil {
		return fmt.Errorf("cannot read %s: %w", manifestPath, err)
	}

	var manifest struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(data, &manifest); err != nil {
		return fmt.Errorf("invalid plugin.json: %w", err)
	}
	if manifest.ID == "" {
		return fmt.Errorf("plugin.json missing 'id' field")
	}

	destDir := filepath.Join(pluginsDir, manifest.ID)
	os.RemoveAll(destDir)
	if err := os.MkdirAll(filepath.Dir(destDir), 0o755); err != nil {
		return err
	}

	cpCmd := exec.Command("cp", "-r", srcDir, destDir)
	if out, err := cpCmd.CombinedOutput(); err != nil {
		return fmt.Errorf("copy failed: %s: %w", string(out), err)
	}

	fmt.Printf("Plugin %q installed to %s\n", manifest.ID, destDir)
	return nil
}

func installFromGitHub(source, pluginsDir string) error {
	// Normalize URL
	repo := strings.TrimPrefix(source, "https://")
	repo = strings.TrimPrefix(repo, "github.com/")
	repo = strings.TrimSuffix(repo, ".git")
	repoURL := "https://github.com/" + repo

	// Clone to temp dir
	tmpDir, err := os.MkdirTemp("", "fastclaw-plugin-*")
	if err != nil {
		return err
	}
	defer os.RemoveAll(tmpDir)

	fmt.Printf("Cloning %s...\n", repoURL)
	cloneCmd := exec.Command("git", "clone", "--depth=1", repoURL, tmpDir)
	if out, err := cloneCmd.CombinedOutput(); err != nil {
		return fmt.Errorf("git clone failed: %s: %w", string(out), err)
	}

	return installFromLocal(tmpDir, pluginsDir)
}

func installFromHub(name, pluginsDir string) error {
	tmpDir, err := os.MkdirTemp("", "fastclaw-plugin-*")
	if err != nil {
		return err
	}
	defer os.RemoveAll(tmpDir)

	fmt.Printf("Installing %q from FastClaw Hub...\n", name)

	tarballURL := fmt.Sprintf("https://github.com/%s/archive/refs/heads/main.tar.gz", hubRepo)

	// Download tarball
	tarball := filepath.Join(tmpDir, "repo.tar.gz")
	dlCmd := exec.Command("curl", "-fsSL", "-o", tarball, tarballURL)
	if out, err := dlCmd.CombinedOutput(); err != nil {
		return fmt.Errorf("download failed: %s: %w", string(out), err)
	}

	// Extract full tarball
	extractDir := filepath.Join(tmpDir, "extract")
	if err := os.MkdirAll(extractDir, 0o755); err != nil {
		return err
	}
	tarCmd := exec.Command("tar", "-xzf", tarball, "-C", extractDir)
	if out, err := tarCmd.CombinedOutput(); err != nil {
		return fmt.Errorf("extract failed: %s: %w", string(out), err)
	}

	// Find top-level dir (name varies: fastclaw-main, fastclaw-v0.16.0, etc.)
	entries, _ := os.ReadDir(extractDir)
	if len(entries) == 0 {
		return fmt.Errorf("extract failed: empty archive")
	}
	pluginDir := filepath.Join(extractDir, entries[0].Name(), "plugins", name)
	if _, err := os.Stat(pluginDir); os.IsNotExist(err) {
		return fmt.Errorf("plugin %q not found in FastClaw Hub", name)
	}

	// Check if it has plugin.json (standard plugin) or is a utility
	if _, err := os.Stat(filepath.Join(pluginDir, "plugin.json")); err == nil {
		return installFromLocal(pluginDir, pluginsDir)
	}

	// No plugin.json — copy as utility (e.g. plugin-bridge)
	toolsDir := filepath.Join(filepath.Dir(pluginsDir), "tools")
	os.MkdirAll(toolsDir, 0o755)
	destDir := filepath.Join(toolsDir, name)
	os.RemoveAll(destDir)
	cpCmd := exec.Command("cp", "-r", pluginDir, destDir)
	if out, err := cpCmd.CombinedOutput(); err != nil {
		return fmt.Errorf("copy failed: %s: %w", string(out), err)
	}
	fmt.Printf("Installed %q to %s\n", name, destDir)
	return nil
}

func installFromNpm(pkg, pluginsDir string) error {
	homeDir := filepath.Dir(pluginsDir)

	// Derive plugin ID from package name
	pluginID := pkg
	if i := strings.LastIndex(pluginID, "/"); i >= 0 {
		pluginID = pluginID[i+1:]
	}
	pluginID = strings.TrimPrefix(pluginID, "fastclaw-")

	// 1. npm install to temp dir to inspect the package
	tmpDir, err := os.MkdirTemp("", "fastclaw-npm-*")
	if err != nil {
		return err
	}
	defer os.RemoveAll(tmpDir)

	fmt.Printf("Downloading %s...\n", pkg)
	npmCmd := exec.Command("npm", "install", "--production", pkg)
	npmCmd.Dir = tmpDir
	if out, err := npmCmd.CombinedOutput(); err != nil {
		return fmt.Errorf("npm install failed: %s: %w", string(out), err)
	}

	// 2. Check if it's a compatible plugin (supports fastclaw or openclaw plugin format)
	pkgDir := filepath.Join(tmpDir, "node_modules", pkg)
	isPlugin := false
	for _, marker := range []string{"fastclaw.plugin.json", "openclaw.plugin.json"} {
		if _, err := os.Stat(filepath.Join(pkgDir, marker)); err == nil {
			isPlugin = true
			break
		}
	}
	// Also check package.json for fastclaw/openclaw field
	if !isPlugin {
		if data, err := os.ReadFile(filepath.Join(pkgDir, "package.json")); err == nil {
			var pj map[string]json.RawMessage
			if json.Unmarshal(data, &pj) == nil {
				for _, key := range []string{"fastclaw", "openclaw"} {
					if _, ok := pj[key]; ok {
						isPlugin = true
						break
					}
				}
			}
		}
	}
	if !isPlugin {
		return fmt.Errorf("%s is not a compati
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #115** (2026-08-28): **fix: fall back to execCommand for clipboard on insecure origins**
  *Symptoms*: ## Problem  When the dashboard is reached over plain `http://` (LAN deployments behind a gateway, default self-hosted setups that are not localhost), **every copy button silently does nothing**: chat message copy, agent link copy, API key token copy, and the upgrade-command copy on the About page.  ## Root cause  The browser only exposes `navigator.clipboard` in secure contexts. Over plain HTTP it is `undefined`, and all six call sites used `navigator.clipboard.writeText` directly with no fallback, so the click either threw (swallowed by catch blocks) or crashed the handler.  ## Fix  Add `web/src/lib/clipboard.ts` exporting `copyText()`:  - uses the async Clipboard API when `navigator.clipboard` exists and the context is secure; - otherwise falls back to a hidden `<textarea>` + `document.execCommand('copy')`; - returns a boolean so callers only flash the "copied" state on success.  Route all six call sites through it (`chat/page.tsx`, `chat-screen.tsx`, `agents/page.tsx`, `agent-profile-panel.tsx`, `apikeys/page.tsx`, `settings/about/page.tsx`).  ## Verification  - `npx tsc --noEmit` passes. - Manual: dashboard over plain HTTP — chat message, agent link, token, and upgrade-command copy buttons now work; behavior over HTTPS/localhost is unchanged.

- **Issue #114** (2026-08-28): **fix: maintain Mcp-Session-Id across MCP HTTP requests**
  *Symptoms*: ## Problem  MCP servers that enforce sessions (several Streamable HTTP implementations) accept FastClaw's `initialize` but then reject every follow-up request:  ``` HTTP 400: Missing mcp-session-id header. Send an initialize request first. ```  The server ends up skipped and its tools are unavailable.  ## Root cause  `internal/mcp/http.go` never stores the `Mcp-Session-Id` response header returned by `initialize`, and never sends it back on subsequent requests.  ## Fix  - Capture `Mcp-Session-Id` from the response headers (first non-empty value wins, guarded by the existing mutex). - Replay it as a request header on every subsequent `sendRequest`.  ## Verification  Against a session-requiring MCP server: `tools/list` went from HTTP 400 to a normal tool list. `go build`/`go vet` on `internal/mcp` pass.  Supersedes part of the Streamable HTTP compatibility work in #113 (the two changes are independent; this PR branches off `dev` directly).

- **Issue #113** (2026-08-28): **fix: handle SSE responses and send Accept header in MCP HTTP client**
  *Symptoms*: ## Problem  Connecting FastClaw to MCP servers that use Streamable HTTP with SSE responses fails with:  - `parse response: invalid character 'e' looking for beginning of value`, or - `HTTP 406 Not Acceptable` from stricter servers.  Affected servers include any implementation that answers JSON-RPC over SSE frames.  ## Root cause  `internal/mcp/http.go` `sendRequest`:  1. It never sends `Accept: application/json, text/event-stream`, which the [Streamable HTTP transport spec](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports) requires clients to send — some servers reject the request with 406. 2. It unmarshals the response body as bare JSON, but the spec allows the server to return the JSON-RPC response as SSE frames (`event: message\ndata: {json}\n\n`). The leading `e` of `event:` breaks `json.Unmarshal`.  ## Fix  - Send the required `Accept` header. - When the response `Content-Type` is `text/event-stream`, extract the JSON-RPC payload from the last non-empty `data:` line (`extractSSEData`) before unmarshalling; plain-JSON responses keep the existing path and error text.  ## Verification  Against an SSE-responding MCP server (e.g. dbhub): connection went from failing at `initialize`/`tools/list` to a working tool list. `go build`/`go vet` on `internal/mcp` pass.  Fixes #117

- **Issue #112** (2026-08-28): **fix: accept SSE data lines without a space after the colon**
  *Symptoms*: ## Problem  When FastClaw is pointed at OpenAI/Anthropic-compatible streaming endpoints through an LLM gateway (DeepSeek, GLM, etc.), model replies are silently lost and the agent reports `model returned an empty response`.  ## Root cause  The SSE spec ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events#event_stream_format)) makes the single space after the `data:` field name **optional**. Many gateways emit `data:{...}` with no space, and all four stream parsers required the literal prefix `data: `, so every chunk was skipped and the assembled content ended up empty.  Affected parsers: - `internal/provider/openai.go` — `ChatStream` and `parseSSE` - `internal/provider/anthropic.go` — streaming loop and `parseSSE`  ## Fix  Accept `data:` with or without the trailing space in all four places and `TrimSpace` the payload:  ```go if !strings.HasPrefix(line, "data:") { 	continue } data := strings.TrimSpace(strings.TrimPrefix(line, "data:")) ```  ## Verification  - `curl -N` against the gateway confirmed it sends `data:{...}` without a space; chat responses are complete after the patch. - `go build ./internal/provider/` and `go test ./internal/provider/` pass.  Fixes #116

- **Issue #109** (2026-07-27): **Feat/wire spawn subagent**
  *Symptoms*: ### 改造目标和结果  FastClaw Web 原先虽然使用 `/api/chat/stream`，但 `HandleWebChatStream` 最终调用非流式 `HandleMessage`：工具进度走 SSE，DeepSeek 正文则在后端完整缓冲后一次性显示。本次已改成真正的 token streaming：  ```text DeepSeek SSE token → Provider StreamReader → 共享 Agent runTurn → ChatEvent content_delta → /api/chat/stream → Web 同一回答气泡持续增长 ```  流式与非流式入口现在复用同一套 ReAct Turn 内核；每个 ReAct round 只发起一次模型请求，不再存在最终轮先 `Chat`、再 `ChatStream` 重复生成的问题。  ### 后端核心改动  关键文件：  ```text fastclaw/internal/agent/loop.go fastclaw/internal/agent/events.go /fastclaw/internal/provider/provider.go /fastclaw/internal/provider/openai.go /fastclaw/internal/provider/anthropic.go /fastclaw/internal/session/manager.go /fastclaw/internal/setup/handlers.go /fastclaw/internal/api/openai.go ```  已完成：  1. `HandleMessage` 委托共享 `runTurn`，统一 session、hooks、PII、工具执行、PostTurn、媒体、错误和清理语义。 2. `runTurn` 每轮只调用一次 `Provider.ChatStream`，实时转发 token，并在流终止时读取完整 `Response` 判断 ToolCall 或最终回答。 3. `StreamReader` 增加同步安全的终态 `Result()` / `Complete()`；OpenAI-compatible 和 Anthropic Provider 的 `Chat`/`ChatStream` 共用同一套 SSE accumulator。 4. 完整保留 ToolCall、Thinking、Anthropic signature 和 `RawAssistant`，确保下一轮能够正确 replay。 5. ChatEvent 升级为 additive v2：新增 `content_delta`，并携带 `turnId`、`messageId`、`round`、`seq`。 6. 为兼容旧客户端，每轮仍双发一个 legacy `content` 完整快照；旧客户端忽略 delta，新客户端以快照校正内容。 7. `tool_call`/`tool_result` 使用相同 message/round 关联，工具结果继续严格按 ToolCall ID 配对。 8. 正常最终回答在完整 assistant 持久化并执行 session flush 后才发送 `done`。 9. SSE 请求重新继承 `r.Context()`；浏览器关闭连接或点击 Stop 会取消 P

- **Issue #104** (2026-07-21): **fix: before_model_call hook messages modification not taking effect (#103)**
  *Symptoms*: ## Problem  The `before_model_call` hook is designed to allow plugins to modify messages before sending to the LLM (e.g., mem0 injecting long-term memory). However, the modified messages were written to `hc.Messages` but never read back by the agent loop.  This caused plugins like mem0 (in `plugins/mem0/`) to silently fail—their modified messages were discarded and never sent to the LLM.  ## Changes  Added `messages = hcBefore.Messages` after `a.hooks.Run(ctx, hcBefore)` in: - `HandleMessage` (line ~2055) - `HandleMessageStream` (line ~2735)  ## Impact  - mem0 plugin now works correctly - No breaking changes to existing hooks  Fixes #103 

- **Issue #103** (2026-07-21): **Bug: before_model_call hook messages modification not taking effect**
  *Symptoms*: **Bug: `before_model_call` hook messages modification not taking effect**  The `before_model_call` hook is designed to allow plugins to modify messages before sending to the LLM (e.g., mem0 injecting long-term memory). However, the modified messages are written to `hc.Messages` but never read back by the agent loop.  **Code location**  `internal/agent/loop.go` around line 456-457 (`HandleMessage`) and similar in `HandleMessageStream`  **Current behavior**  ```go hcBefore := &HookContext{..., Messages: messages} a.hooks.Run(ctx, hcBefore)  // plugin modifies hc.Messages // BUG: messages variable NOT updated llmMessages := messages     // still uses original messages ```  **Expected behavior**  After `hooks.Run`, the `messages` variable should be updated from `hc.Messages` so that subsequent PII scrub and LLM call use the modified messages.  **Impact**  - mem0 plugin (shown in `plugins/mem0/`) does not actually inject memory into the request - Any sync `before_model_call` hook that modifies messages is silently ignored  **Proposed fix**  Add `messages = hcBefore.Messages` after `a.hooks.Run(ctx, hcBefore)` in both `HandleMessage` and `HandleMessageStream`.  **Checklist**  - [x] I have verified this with the mem0 example plugin - [x] I can submit a PR if this is accepted as a bug 

- **Issue #102** (2026-07-21): **fix(setup): resolve masked skill secrets to stored originals on confi…**
  *Symptoms*: ## Problem  `mergeSkillEntry` (internal/setup/handlers.go) was defined to protect stored skill secrets from masked write-backs, but it has **no call sites**. As a result, `POST /api/config` persists masked placeholders verbatim.  Repro:  1. In the dashboard, configure a skill with a secret (e.g. `API_KEY=real-secret-123456`) and save (POST /api/config). 2. The value is stored correctly: `SELECT data FROM configs WHERE name='skills.entries'` shows the real key. 3. Reopen the skill configure dialog — the UI now shows the masked value (`real****3456`) returned by GET /api/config. 4. Save again without touching the secret (or just toggle `enabled`). 5. The stored value is now the literal masked string — **the original secret is permanently lost**, and subsequent skill runs authenticate with `****`.  This affects both the global `skills.entries` row and per-agent `skills.agentEntries` rows. Note the same protection *is* wired for provider API keys and channel bot tokens (`isMaskedSecret` in handlers_scoped.go) — skill entries were simply missed.  ## Fix  Wire `mergeSkillEntry` into both write paths in `handleUpdateConfig`:  - **Global entries**: snapshot the stored `skills.entries` before the request body is unmarshalled over the merged config, then merge each request entry against the snapshot. - **Per-agent entries**: load the agent's existing row (new `loadAgentSkillEntries` helper, now also reused by `loadAgentSkillEntriesForUser`) and merge before persistin

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

### Incident Patch 1: `38340104` (2026-09-08)
**Commit Message**: fix chat navigation and history loading

**File**: `internal/setup/chat_history_pagination_test.go` (added, +37/-0)
```diff
@@ -0,0 +1,37 @@
+package setup
+
+import "testing"
+
+func TestPaginateChatHistoryKeepsTurnsWhole(t *testing.T) {
+	history := []map[string]any{
+		{"role": "user", "content": "one"},
+		{"role": "assistant", "content": "reply one"},
+		{"role": "user", "content": "two"},
+		{"role": "assistant", "toolCalls": []any{"call"}},
+		{"role": "tool", "content": "result"},
+		{"role": "assistant", "content": "reply two"},
+		{"role": "user", "content": "three"},
+		{"role": "assistant", "content": "reply three"},
+	}
+
+	latest, start, hasMore := paginateChatHistory(history, 3, len(history))
+	if start != 6 || !hasMore || len(latest) != 2 {
+		t.Fatalf("latest page = start %d, hasMore %v, len %d; want 6, true, 2", start, hasMore, len(latest))
+	}
+	if latest[0]["role"] != "user" {
+		t.Fatalf("latest page starts with %v; want user", latest[0]["role"])
+	}
+
+	older, olderStart, olderHasMore := paginateChatHistory(history, 3, start)
+	if olderStart != 2 || !olderHasMore || len(older) != 4 {
+		t.Fatalf("older page = start %d, hasMore %v, len %d; want 2, true, 4", olderStart, olderHasMore, len(older))
+	}
+	if older[0]["role"] != "user" || older[len(older)-1]["role"] != "assistant" {
+		t.Fatalf("older page did not preserve a complete turn: %#v", older)
+	}
+
+	oldest, oldestStart, oldestHasMore := paginateChatHistory(history, 3, olderStart)
+	if oldestStart != 0 || oldestHasMore || len(oldest) != 2 {
+		t.Fatalf("oldest page = start %d, hasMore %v, len %d; want 0, false, 2", oldestStart, oldestHasMore, len(oldest))
+	}
+}
```

**File**: `internal/setup/handlers.go` (modified, +39/-1)
```diff
@@ -1681,7 +1681,21 @@ func (s *Server) handleChatHistory(w http.ResponseWriter, r *http.Request) {
 		jsonResponse(w, http.StatusNotFound, map[string]any{"error": "agent not found"})
 		return
 	}
-	resp := map[string]any{"history": ag.WebChatHistory(sessionID)}
+	history := ag.WebChatHistory(sessionID)
+	historyStart := 0
+	hasMoreHistory := false
+	if limit, err := strconv.Atoi(r.URL.Query().Get("limit")); err == nil && limit > 0 {
+		before := len(history)
+		if value, parseErr := strconv.Atoi(r.URL.Query().Get("before")); parseErr == nil {
+			before = value
+		}
+		history, historyStart, hasMoreHistory = paginateChatHistory(history, limit, before)
+	}
+	resp := map[string]any{
+		"history":        history,
+		"historyStart":   historyStart,
+		"hasMoreHistory": hasMoreHistory,
+	}
 	// latestEventSeq is the resume cursor for /api/chat/subscribe — the
 	// client opens that endpoint with `since=<latestEventSeq>` so a
 	// fresh page load picks up only deltas it hasn't already rendered.
@@ -1699,6 +1713,30 @@ func (s *Server) handleChatHistory(w http.ResponseWriter, r *http.Request) {
 	jsonResponse(w, http.StatusOK, resp)
 }
 
+// paginateChatHistory returns one ascending page ending at before. The start
+// is aligned to a user message so an assistant tool-call followed by its tool
+// results is never split across two browser requests.
+func paginateChatHistory(history []map[string]any, limit, before int) ([]map[string]any, int, bool) {
+	limit = max(1, min(limit, 100))
+	before = max(0, min(before, len(history)))
+	start := max(0, before-limit)
+	aligned := false
+	for index := start; index < before; index++ {
+		role, _ := history[index]["role"].(string)
+		if role == "user" {
+			start = index
+			aligned = true
+			break
+		}
+	}
+	for !aligned && start > 0 {
+		start--
+		role, _ := history[start]["role"].(string)
+		aligned = role == "user"
+	}
+	return history[start:before], start, start > 0
+}
+
 func (s *Server) handleChatSessions(w http.ResponseWriter, r *http.Request) {
 	agentID := r.URL.Query().Get("agentId")
 	ag := s.resolveAgent(r, agentID)
```

**File**: `web/src/components/agent-access-gate.tsx` (modified, +16/-9)
```diff
@@ -5,6 +5,10 @@ import { usePathname } from "next/navigation";
 import { Bot } from "lucide-react";
 import { getAgentStatus } from "@/lib/api";
 import { useLocale } from "@/components/locale-provider";
+import {
+  hasRememberedAgentAccess,
+  rememberAgentAccess,
+} from "@/lib/agent-access-cache";
 
 // Pull the agent id straight from the URL. Under output:'export' the
 // HTML served for /agents/agt_xxx/chat/ is actually the prebuilt
@@ -42,30 +46,33 @@ export default function AgentAccessGate({
   const { tr } = useLocale();
   const pathname = usePathname();
   const agentId = agentIdFromPath(pathname);
-  const [state, setState] = useState<"checking" | "ok" | "denied">("checking");
+  const [results, setResults] = useState<Partial<Record<string, "ok" | "denied">>>({});
+  const state: "checking" | "ok" | "denied" =
+    !agentId || agentId === "default" || hasRememberedAgentAccess(agentId)
+      ? "ok"
+      : results[agentId] || "checking";
 
   useEffect(() => {
     // The "default" id is the prebuilt static-export placeholder, not
     // a real agent — skip the probe and let children render. The real
     // /agents/default/* route is super_admin's local-mode dashboard
     // which has its own server-side gating already.
-    if (!agentId || agentId === "default") {
-      setState("ok");
-      return;
-    }
+    if (!agentId || agentId === "default" || hasRememberedAgentAccess(agentId)) return;
     let aborted = false;
-    setState("checking");
     getAgentStatus(agentId)
       .then(({ status, agent }) => {
         if (aborted) return;
         if (status === 200 && agent) {
-          setState("ok");
+          rememberAgentAccess(agentId);
+          setResults((current) => ({ ...current, [agentId]: "ok" }));
           return;
         }
-        setState("denied");
+        setResults((current) => ({ ...current, [agentId]: "denied" }));
       })
       .catch(() => {
-        if (!aborted) setState("denied");
+        if (!aborted) {
+          setResults((current) => ({ ...current, [agentId]: "denied" }));
+        }
       });
     return () => {
       aborted = true;
```

**File**: `web/src/components/app-sidebar.tsx` (modified, +7/-1)
```diff
@@ -50,6 +50,7 @@ import {
   type StatusResponse,
 } from "@/lib/api";
 import { useLocale } from "@/components/locale-provider";
+import { rememberAgentAccess } from "@/lib/agent-access-cache";
 
 // Extract agent ID from pathname like /agents/default/chat/. The second
 // capture is an explicit allow-list of sub-routes so the bare /agents/
@@ -216,11 +217,13 @@ export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
   React.useEffect(() => {
     getAgents()
       .then((list) => {
+        rememberAgentAccess(list.map((agent) => agent.id));
         setAgents(
           list.map((a) => ({
             id: a.id,
             name: a.name,
             model: a.model,
+            description: a.description,
             avatarUrl: a.avatarUrl,
           })),
         );
@@ -256,6 +259,7 @@ export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
           return {
             id: agent.id,
             name: agent.name || agent.id,
+            description: agent.description,
             avatarUrl: agent.avatarUrl,
             preview: latest?.lastMessage || latest?.preview,
             updatedAt: latest?.lastMessageAt || latest?.updatedAt || latest?.createdAt,
@@ -279,6 +283,7 @@ export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
               agents.map((agent) => ({
                 id: agent.id,
                 name: agent.name || agent.id,
+                description: agent.description,
                 avatarUrl: agent.avatarUrl,
               })),
             );
@@ -307,11 +312,12 @@ export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
     getAgent(activeAgentId)
       .then((a) => {
         if (aborted || !a) return;
+        rememberAgentAccess(a.id);
         setAgents((prev) =>
           prev.some((x) => x.id === a.id)
             ? prev
             : [
-                { id: a.id, name: a.name, model: a.model, avatarUrl: a.avatarUrl },
+                { id: a.id, name: a.name, model: a.model, description: a.description, avatarUrl: a.avatarUrl },
                 ...prev,
               ],
         );
```

**File**: `web/src/components/chat-screen.tsx` (modified, +193/-28)
```diff
@@ -1,6 +1,6 @@
 "use client";
 
-import { useEffect, useState, useRef, useCallback, useMemo } from "react";
+import { useEffect, useState, useRef, useCallback, useMemo, useLayoutEffect } from "react";
 import { useRouter, usePathname, useSearchParams } from "next/navigation";
 import { useAgentIdFromURL } from "@/hooks/use-agent-id";
 import { Button } from "@/components/ui/button";
@@ -11,7 +11,7 @@ import { Input } from "@/components/ui/input";
 import { Textarea } from "@/components/ui/textarea";
 import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
 import { createProject, deleteChatSession, fileUrl, getAgent, getAgentKnowledgeFile, getChangedFiles, getChatHistoryWithCursor, getChatSessions, getChatTodo, getMe, getScopePreview, getScopePreviewLogs, getSessionHistory, listAgentFiles, listProjects, renameChatSession, restoreSessionHistory, revealAgentWorkspace, sendChatStream, steerChat, updateAgent, updateProject, uploadAgentFiles, getSkills, type AgentDetail, type ChatHistoryMessage, type ChatStreamEvent, type KnowledgeSource, type ProjectEntry, type ScopePreview, type SkillInfo, type TodoItem, type ToolResultMetadata, type WorkspaceFile, type WorkspaceHistoryEntry } from "@/lib/api";
-import { ArrowLeft, ArrowUp, BookOpen, Brain, Check, ChevronDown, ChevronRight, ChevronsRight, Clock, Code2, Copy, Download, Eye, ExternalLink, File, FileCode, FileText, Film, Folder, FolderOpen, FolderPlus, FolderSearch, Globe2, Image as ImageIcon, Link2, ListChecks, LockKeyhole, MoreHorizontal, Music, PanelLeftClose, PanelLeftOpen, PanelRight, Paperclip, Pencil, Plus, Puzzle, Radio, RefreshCw, RotateCcw, Settings, Share2, ShieldCheck, SlidersHorizontal, Sparkles, Square, SquarePen, Terminal, Trash2, Wrench, X } from "lucide-react";
+import { ArrowLeft, ArrowUp, BookOpen, Brain, Check, ChevronDown, ChevronRight, ChevronUp, ChevronsRight, Clock, Code2, Copy, Download, Eye, ExternalLink, File, FileCode, FileText, Film, Folder, FolderOpen, FolderPlus, FolderSearch, Globe2, Image as ImageIcon, Link2, ListChecks, LockKeyhole, MoreHorizontal, Music, PanelLeftClose, PanelLeftOpen, PanelRight, Paperclip, Pencil, Plus, Puzzle, Radio, RefreshCw, RotateCcw, Settings, Share2, ShieldCheck, SlidersHorizontal, Sparkles, Square, SquarePen, Terminal, Trash2, Wrench, X } from "lucide-react";
 import Link from "next/link";
 import { ChatMarkdown } from "@/components/chat-markdown";
 import type { AgentSettingsTab } from "@/components/agent-settings-dialog";
@@ -188,6 +188,7 @@ interface ChatMessage {
 // outbound text on this marker into separate platform messages; the
 // web UI renders one bubble per split chunk so the experience matches.
 const SPLIT_MARKER = "<|split|>";
+const CHAT_HISTORY_PAGE_SIZE = 20;
 
 // splitOnMarker breaks `s` on SPLIT_MARKER, trims each chunk, and
 // drops the empty ones. Used at render time so a streamed assistant
@@ -324,8 +325,9 @@ function namePastedImage(file: File, pasteId: number, index: number): File {
 }
 
 /** Convert raw history messages into UI ChatMessages, grouping tool calls with results. */
-function buildChatMessages(history: ChatHistoryMessage[]): ChatMessage[] {
+function buildChatMessages(history: ChatHistoryMessage[], historyOffset = 0): ChatMessage[] {
   const msgs: ChatMessage[] = [];
+  const historyId = (index: number) => historyOffset + index;
   let i = 0;
   while (i < history.length) {
     const h = history[i];
@@ -351,7 +353,7 @@ function buildChatMessages(history: ChatHistoryMessage[]): ChatMessage[] {
             channel: h.senderChannel,
           }
         : undefined;
-      msgs.push({ id: `h-${i}`, role: "user", content: h.content || "", timestamp: 0, attachments, sender });
+      msgs.push({ id: `h-${historyId(i)}`, role: "user", content: h.content || "", timestamp: 0, attachments, sender });
       i++;
     } else if (h.role === "assistant" && h.toolCalls && h.toolCalls.length > 0) {
       // Group: assistant tool_calls + following tool results + fin
```

---

### Incident Patch 2: `9f1e0e35` (2026-09-07)
**Commit Message**: fix chat sidebar recent session experience

**File**: `internal/session/manager.go` (modified, +51/-24)
```diff
@@ -683,8 +683,13 @@ type WebSession struct {
 	ProjectID string `json:"projectId,omitempty"`
 	Title     string `json:"title"`
 	Preview   string `json:"preview"`
-	CreatedAt int64  `json:"createdAt"` // unix ms
-	UpdatedAt int64  `json:"updatedAt"` // unix ms
+	// LastMessage is the most recent user-visible user/assistant message,
+	// independent of Preview (which intentionally remains the opening user
+	// turn and is used as the default conversation title).
+	LastMessage   string `json:"lastMessage,omitempty"`
+	LastMessageAt int64  `json:"lastMessageAt,omitempty"` // unix ms
+	CreatedAt     int64  `json:"createdAt"`               // unix ms
+	UpdatedAt     int64  `json:"updatedAt"`               // unix ms
 	// ThumbnailURL is the first image_url attached to the FIRST user
 	// turn of the session, surfaced so the sidebar can show "image +
 	// text" instead of just the text label for multimodal chats.
@@ -723,9 +728,12 @@ func (m *Manager) ListWebSessions() []WebSession {
 			continue
 		}
 
-		// Read first user message as preview
+		// Read the first user message as the conversation preview, while also
+		// tracking the latest user-visible message for contact-list summaries.
 		preview := ""
 		thumb := ""
+		lastMessage := ""
+		var lastMessageAt int64
 		fh, err := os.Open(f)
 		if err != nil {
 			continue
@@ -742,13 +750,19 @@ func (m *Manager) ListWebSessions() []WebSession {
 				Role         string                 `json:"role"`
 				Content      string                 `json:"content"`
 				ContentParts []provider.ContentPart `json:"content_parts"`
+				Timestamp    int64                  `json:"timestamp"`
+				Origin       string                 `json:"origin"`
 			}
-			if json.Unmarshal(scanner.Bytes(), &msg) != nil || msg.Role != "user" {
+			if json.Unmarshal(scanner.Bytes(), &msg) != nil || msg.Origin != provider.OriginUser {
 				continue
 			}
-			text := msg.Content
+			if msg.Role != "user" && msg.Role != "assistant" {
+				continue
+			}
+
+			text := strings.TrimSpace(msg.Content)
 			img := ""
-			if text == "" {
+			if msg.Role == "user" && text == "" {
 				var parts []string
 				for _, p := range msg.ContentParts {
 					if p.Type == "text" && p.Text != "" {
@@ -757,31 +771,42 @@ func (m *Manager) ListWebSessions() []WebSession {
 				}
 				text = strings.Join(parts, "\n")
 			}
-			text = provider.StripAttachedPrefix(text)
-			for _, p := range msg.ContentParts {
-				if p.Type == "image_url" && p.ImageURL != nil && p.ImageURL.URL != "" {
-					img = p.ImageURL.URL
-					break
+			if msg.Role == "user" {
+				text = provider.StripAttachedPrefix(text)
+				for _, p := range msg.ContentParts {
+					if p.Type == "image_url" && p.ImageURL != nil && p.ImageURL.URL != "" {
+						img = p.ImageURL.URL
+						break
+					}
 				}
 			}
 			if text == "" && img == "" {
 				continue
 			}
-			preview = text
-			if preview == "" {
-				preview = "[image]"
+
+			messagePreview := compactMessagePreview(text)
+			if messagePreview == "" {
+				messagePreview = "[image]"
 			}
-			if len(preview) > 100 {
-				preview = preview[:100] + "..."
+			lastMessage = messagePreview
+			lastMessageAt = msg.Timestamp
+
+			if msg.Role == "user" && preview == "" {
+				preview = messagePreview
+				thumb = img
 			}
-			thumb = img
-			break
 		}
 		fh.Close()
 
 		if preview == "" {
 			continue // skip empty sessions
 		}
+		if lastMessage == "" {
+			lastMessage = preview
+		}
+		if lastMessageAt == 0 {
+			lastMessageAt = info.ModTime().UnixMilli()
+		}
 
 		// Read title from metadata file, fallback to preview
 		title := m.readSessionTitle(sessionId)
@@ -793,12 +818,14 @@ func (m *Manager) ListWebSessions() []WebSession {
 		}
 
 		sessions = append(sessions, WebSession{
-			ID:           sessionId,
-			Title:        title,
-			Preview:      preview,
-			ThumbnailURL: thumb,
-			CreatedAt:    info.ModTime().UnixMilli(),
-			UpdatedAt:    info.ModTime().UnixMilli(),
+			ID:            sessionId,
+			Title:     
```

**File**: `internal/session/store_adapter.go` (modified, +56/-0)
```diff
@@ -325,6 +325,13 @@ func (a *StoreAdapter) BuildWebSession(ctx context.Context, m store.SessionMeta)
 	if preview == "" {
 		return nil
 	}
+	lastMessage, lastMessageAt := latestMessagePreview(source)
+	if lastMessage == "" {
+		lastMessage = preview
+	}
+	if lastMessageAt == 0 {
+		lastMessageAt = m.UpdatedAt.UnixMilli()
+	}
 	title := displaySessionTitle(m.Title, m.Key, m.ChatID, preview)
 	return &WebSession{
 		ID:            m.Key,
@@ -334,13 +341,62 @@ func (a *StoreAdapter) BuildWebSession(ctx context.Context, m store.SessionMeta)
 		ProjectID:     m.ProjectID,
 		Title:         title,
 		Preview:       preview,
+		LastMessage:   lastMessage,
+		LastMessageAt: lastMessageAt,
 		ThumbnailURL:  thumb,
 		CreatedAt:     m.UpdatedAt.UnixMilli(),
 		UpdatedAt:     m.UpdatedAt.UnixMilli(),
 		ChatterUserID: m.ChatterUserID,
 	}
 }
 
+// latestMessagePreview returns the newest user-visible message in a session
+// and the timestamp of that same message. Tool rows and runtime-injected
+// prompts are deliberately excluded so contact previews match chat history.
+func latestMessagePreview(source []store.SessionMessage) (string, int64) {
+	for i := len(source) - 1; i >= 0; i-- {
+		msg := source[i]
+		if msg.Origin != provider.OriginUser {
+			continue
+		}
+
+		var text string
+		switch msg.Role {
+		case "assistant":
+			text = msg.Content
+		case "user":
+			text = userText(msg)
+			if text == "" && userImage(msg) != "" {
+				text = "[image]"
+			}
+		default:
+			continue
+		}
+
+		text = compactMessagePreview(text)
+		if text == "" {
+			continue
+		}
+		var timestamp int64
+		if !msg.Timestamp.IsZero() {
+			timestamp = msg.Timestamp.UnixMilli()
+		}
+		return text, timestamp
+	}
+	return "", 0
+}
+
+// compactMessagePreview makes multi-line Markdown suitable for the single-line
+// contact row and caps the API payload without splitting UTF-8 characters.
+func compactMessagePreview(text string) string {
+	text = strings.Join(strings.Fields(text), " ")
+	runes := []rune(text)
+	if len(runes) > 100 {
+		return string(runes[:100]) + "..."
+	}
+	return text
+}
+
 // displaySessionTitle normalizes legacy rows that persisted the opaque
 // session_key as their title.  Treating that value as a real custom title
 // prevents the UI's otherwise-correct title -> preview -> id fallback from
```

**File**: `internal/session/store_adapter_test.go` (modified, +46/-1)
```diff
@@ -1,6 +1,11 @@
 package session
 
-import "testing"
+import (
+	"testing"
+	"time"
+
+	"github.com/fastclaw-ai/fastclaw/internal/store"
+)
 
 func TestDisplaySessionTitle(t *testing.T) {
 	tests := []struct {
@@ -68,3 +73,43 @@ func TestDisplaySessionTitle(t *testing.T) {
 		})
 	}
 }
+
+func TestLatestMessagePreviewUsesNewestVisibleExchangeAndMatchingTime(t *testing.T) {
+	first := time.Date(2026, 9, 7, 10, 0, 0, 0, time.UTC)
+	last := first.Add(2 * time.Minute)
+	messages := []store.SessionMessage{
+		{Role: "user", Content: "hello", Timestamp: first},
+		{Role: "tool", Content: "internal tool output", Timestamp: first.Add(time.Minute)},
+		{Role: "assistant", Content: "  first line\n\nsecond line  ", Timestamp: last},
+		{Role: "user", Content: "hidden goal prompt", Origin: "goal_context", Timestamp: last.Add(time.Minute)},
+	}
+
+	gotText, gotAt := latestMessagePreview(messages)
+	if gotText != "first line second line" {
+		t.Fatalf("latest message = %q, want %q", gotText, "first line second line")
+	}
+	if gotAt != last.UnixMilli() {
+		t.Fatalf("latest message timestamp = %d, want %d", gotAt, last.UnixMilli())
+	}
+}
+
+func TestLatestMessagePreviewFallsBackToImageUserTurn(t *testing.T) {
+	when := time.Date(2026, 9, 7, 10, 0, 0, 0, time.UTC)
+	messages := []store.SessionMessage{
+		{
+			Role: "user",
+			ContentParts: []map[string]any{
+				{"type": "image_url", "image_url": map[string]any{"url": "https://example.com/image.png"}},
+			},
+			Timestamp: when,
+		},
+	}
+
+	gotText, gotAt := latestMessagePreview(messages)
+	if gotText != "[image]" {
+		t.Fatalf("latest message = %q, want [image]", gotText)
+	}
+	if gotAt != when.UnixMilli() {
+		t.Fatalf("latest message timestamp = %d, want %d", gotAt, when.UnixMilli())
+	}
+}
```

**File**: `web/src/app/agents/[id]/chats/page.tsx` (modified, +6/-400)
```diff
@@ -1,402 +1,8 @@
-"use client";
-
-import { useEffect, useMemo, useState } from "react";
-import { useRouter } from "next/navigation";
-import {
-  MessagesSquare,
-  PencilIcon,
-  Trash2,
-  ChevronLeft,
-  ChevronRight,
-} from "lucide-react";
-import { Button } from "@/components/ui/button";
-import { Input } from "@/components/ui/input";
-import { Card, CardContent } from "@/components/ui/card";
-import {
-  Table,
-  TableBody,
-  TableCell,
-  TableHead,
-  TableHeader,
-  TableRow,
-} from "@/components/ui/table";
-import {
-  Dialog,
-  DialogContent,
-  DialogDescription,
-  DialogFooter,
-  DialogHeader,
-  DialogTitle,
-} from "@/components/ui/dialog";
-import {
-  AlertDialog,
-  AlertDialogAction,
-  AlertDialogCancel,
-  AlertDialogContent,
-  AlertDialogDescription,
-  AlertDialogFooter,
-  AlertDialogHeader,
-  AlertDialogTitle,
-} from "@/components/ui/alert-dialog";
-import { useAgentIdFromURL } from "@/hooks/use-agent-id";
-import { useAgentName } from "@/hooks/use-agent-name";
-import {
-  getChatSessions,
-  renameChatSession,
-  deleteChatSession,
-} from "@/lib/api";
-import { ChannelIcon, channelLabel } from "@/components/channel-icon";
-import { useLocale } from "@/components/locale-provider";
-
-type Session = {
-  id: string;
-  channel?: string;
-  accountId?: string;
-  chatId?: string;
-  title?: string;
-  preview: string;
-  thumbnailUrl?: string;
-  createdAt?: number;
-  updatedAt?: number;
-};
-
-const PAGE_SIZE = 20;
-
+// /agents/<aid>/chats — full conversation list in ChatScreen's right panel.
+// The parent agent layout owns the persistent ChatScreen instance; this file
+// only gives Next's static export a route to match. Keeping the route page
+// empty is important: browser-history navigation between /chats and
+// /chat/<session> must never leave a second page tree below the chat canvas.
 export default function AgentChatsPage() {
-  const { locale, tr } = useLocale();
-  const router = useRouter();
-  const agentId = useAgentIdFromURL();
-  const agentName = useAgentName(agentId);
-
-  const [sessions, setSessions] = useState<Session[]>([]);
-  const [error, setError] = useState("");
-  const [page, setPage] = useState(1);
-  const [editTarget, setEditTarget] = useState<Session | null>(null);
-  const [deleteTarget, setDeleteTarget] = useState<Session | null>(null);
-
-  async function refresh() {
-    if (!agentId) return;
-    setError("");
-    try {
-      const list = await getChatSessions(agentId);
-      setSessions(list);
-    } catch (e) {
-      setError(e instanceof Error ? e.message : tr("Failed to load chats", "加载对话失败"));
-    }
-  }
-  useEffect(() => {
-    refresh();
-    // eslint-disable-next-line react-hooks/exhaustive-deps
-  }, [agentId]);
-
-  // Server returns sessions in some order — sort by updatedAt desc here so
-  // the page is deterministic regardless of backend behavior.
-  const sorted = useMemo(
-    () =>
-      [...sessions].sort(
-        (a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0),
-      ),
-    [sessions],
-  );
-
-  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
-  // Clamp the page when sessions shrink below the previous count (e.g.
-  // after deleting the last row on the current page).
-  const safePage = Math.min(page, totalPages);
-  const pageStart = (safePage - 1) * PAGE_SIZE;
-  const pageRows = sorted.slice(pageStart, pageStart + PAGE_SIZE);
-
-  function broadcastChange() {
-    if (typeof window !== "undefined") {
-      window.dispatchEvent(
-        new CustomEvent("fastclaw:sessions-changed", {
-          detail: { agentId },
-        }),
-      );
-    }
-  }
-
-  return (
-    <div className="p-6 space-y-6 max-w-5xl mx-auto">
-      <div className="flex items-center justify-between">
-        <div>
-          <div className="flex items-center gap-2">
-            <MessagesSquare className="size-5 text-muted-foreground" />
-            <h2 className="text-2xl font-semibold tracking-tight">{tr("Chats"
```

**File**: `web/src/app/agents/[id]/layout-client.tsx` (modified, +5/-4)
```diff
@@ -5,7 +5,7 @@ import AgentAccessGate from "@/components/agent-access-gate";
 import { ChatScreen } from "@/components/chat-screen";
 
 // AgentLayoutClient owns the single ChatScreen instance for everything
-// under /agents/<id>/{chat,project}. Previously each chat route
+// under /agents/<id>/{chat,project,chats}. Previously each chat route
 // segment (chat/, chat/[session], project/[pid]) rendered its own
 // <ChatScreen/>, so navigating between sidebar links unmounted and
 // remounted the whole chat surface — losing scroll, blanking messages,
@@ -26,13 +26,14 @@ function isChatRoute(pathname: string, agentId: string): boolean {
   if (!agentId) return false;
   const base = `/agents/${agentId}`;
   if (pathname === base || pathname === `${base}/`) return true;
-  // Match `/chat` (with or without trailing segments) but NOT `/chats` —
-  // the chats list is a sibling route that must render on its own,
-  // without ChatScreen sitting underneath it.
+  // Keep legacy `/chats` URLs inside the persistent chat shell. The current
+  // UI expands recent conversations in place instead of navigating there.
   const tail = pathname.slice(base.length);
   return (
     tail === "/chat" ||
     tail.startsWith("/chat/") ||
+    tail === "/chats" ||
+    tail === "/chats/" ||
     tail === "/project" ||
     tail.startsWith("/project/")
   );
```

---

### Incident Patch 3: `3555f4e9` (2026-08-22)
**Commit Message**: fix: honor operator trust in agent prompts

**File**: `internal/agent/context.go` (modified, +16/-2)
```diff
@@ -132,8 +132,12 @@ func (cb *ContextBuilder) resolvedPromptMode() string {
 // Reads everything under the agent owner's bucket — equivalent to the
 // owner chatting with their own agent. For public-link callers that
 // need per-chatter USER.md + memory isolation, use BuildSystemPromptAs.
+// Trusted is false: the only production caller is the sub-agent path, and
+// sub-agent spawns are deliberately untrusted (their task text was
+// authored in an earlier turn whose chatter can't be verified here — see
+// Agent.isTrustedTurn).
 func (cb *ContextBuilder) BuildSystemPrompt() string {
-	return cb.BuildSystemPromptAs(cb.userID, cb.memory)
+	return cb.BuildSystemPromptAs(cb.userID, cb.memory, false)
 }
 
 // BuildSystemPromptAs is BuildSystemPrompt with explicit chatter identity.
@@ -144,12 +148,21 @@ func (cb *ContextBuilder) BuildSystemPrompt() string {
 // owner's bucket because those define what the agent IS, not who is
 // talking to it. Pass cb.userID / cb.memory to mimic legacy behavior.
 //
+// trusted is the turn's operator verdict (Agent.isTrustedTurn): the
+// chatter owns this agent / is a listed channel admin, or it's a
+// heartbeat. It is passed per call rather than stored on the builder
+// because one ContextBuilder serves every chatter of a shared agent —
+// stashing it as state would leak one chatter's privileges into the next
+// turn. Modules use it to tell the model outright whether host shell and
+// platform-management work are available, instead of leaving it to infer
+// authorization from an empty USER.md and refuse.
+//
 // The prompt is assembled from ordered modules defined in prompt_modules.go.
 // Each prompt mode (Agent / Chatbot / Customize) declares its own module
 // list, and identity files (SOUL.md / IDENTITY.md) are placed early in
 // every mode so the model internalizes "who it is" before operational
 // instructions.
-func (cb *ContextBuilder) BuildSystemPromptAs(chatterUID string, chatterMem *Memory) string {
+func (cb *ContextBuilder) BuildSystemPromptAs(chatterUID string, chatterMem *Memory, trusted bool) string {
 	if chatterUID == "" {
 		chatterUID = cb.userID
 	}
@@ -169,6 +182,7 @@ func (cb *ContextBuilder) BuildSystemPromptAs(chatterUID string, chatterMem *Mem
 		now:        now,
 		loc:        loc,
 		dateLine:   buildDateLine(now, tzExplicit),
+		trusted:    trusted,
 	}
 
 	var parts []string
```

**File**: `internal/agent/context_chatbot_test.go` (modified, +6/-6)
```diff
@@ -105,7 +105,7 @@ func TestChatbotPrompt_EmptyChatter(t *testing.T) {
 	cb := newChatbotBuilder(store)
 	chatterMem := cb.memory.WithUserID(chatterUID)
 
-	prompt := cb.BuildSystemPromptAs(chatterUID, chatterMem)
+	prompt := cb.BuildSystemPromptAs(chatterUID, chatterMem, false)
 
 	// Headers we depend on for the fingerprint log.
 	mustContain(t, prompt, "# SOUL.md")
@@ -139,7 +139,7 @@ func TestChatbotPrompt_PopulatedChatter(t *testing.T) {
 	cb := newChatbotBuilder(store)
 	chatterMem := cb.memory.WithUserID(chatterUID)
 
-	prompt := cb.BuildSystemPromptAs(chatterUID, chatterMem)
+	prompt := cb.BuildSystemPromptAs(chatterUID, chatterMem, false)
 
 	// Populated USER.md must show real content, not the placeholder.
 	mustContain(t, prompt, "Name: 品冠")
@@ -169,7 +169,7 @@ func TestChatbotPrompt_KnowledgeSourceIDsFollowUploadOrder(t *testing.T) {
 	store.put(testAgentID, ownerUID, "knowledge/bbb-pricing.md", "pricing body")
 	cb := newChatbotBuilder(store)
 
-	prompt := cb.BuildSystemPromptAs(chatterUID, cb.memory.WithUserID(chatterUID))
+	prompt := cb.BuildSystemPromptAs(chatterUID, cb.memory.WithUserID(chatterUID), false)
 
 	// Pinned KNOWLEDGE.md is K1, uploaded files follow in path order.
 	mustContain(t, prompt, "## [K1] KNOWLEDGE.md")
@@ -195,7 +195,7 @@ func TestChatbotPrompt_LargeKnowledgeSwitchesToIndexMode(t *testing.T) {
 	store.put(testAgentID, ownerUID, "knowledge/bbb-faq.md", "small faq body")
 	cb := newChatbotBuilder(store)
 
-	prompt := cb.BuildSystemPromptAs(chatterUID, cb.memory.WithUserID(chatterUID))
+	prompt := cb.BuildSystemPromptAs(chatterUID, cb.memory.WithUserID(chatterUID), false)
 
 	mustContain(t, prompt, `<agent_knowledge_base mode="index">`)
 	mustContain(t, prompt, "knowledge_search")
@@ -216,7 +216,7 @@ func TestChatbotPrompt_NoMemorySearchEscapeHatch(t *testing.T) {
 	store := newFakeMemoryStore()
 	cb := newChatbotBuilder(store)
 	chatterMem := cb.memory.WithUserID(chatterUID)
-	prompt := cb.BuildSystemPromptAs(chatterUID, chatterMem)
+	prompt := cb.BuildSystemPromptAs(chatterUID, chatterMem, false)
 
 	// memory_search must not appear in the chatbot prompt — it's a) not
 	// in the chatbot tool allowlist and b) we explicitly tell the model
@@ -238,7 +238,7 @@ func TestAgentMode_NoChatbotPersistenceInstructions(t *testing.T) {
 	cb.userID = ownerUID
 	// promptMode left empty → defaults to agent mode.
 
-	prompt := cb.BuildSystemPromptAs(chatterUID, mem.WithUserID(chatterUID))
+	prompt := cb.BuildSystemPromptAs(chatterUID, mem.WithUserID(chatterUID), false)
 
 	mustNotContain(t, prompt, "Remembering things across conversations")
 	mustNotContain(t, prompt, "You CAN remember chatters across sessions")
```

**File**: `internal/agent/loop.go` (modified, +11/-11)
```diff
@@ -64,14 +64,14 @@ type Agent struct {
 	// mode slash commands (/new /undo /retry /compact /model /personality).
 	// Keyed by channel name (e.g. "discord" → ["123...", "456..."]). Empty
 	// or absent → no gate, anyone can run the command (legacy default).
-	admins          map[string][]string
-	skillsCfg       config.SkillsConfig
-	globalSkillsCfg config.SkillsCfg
-	messageBus      *bus.MessageBus
-	subAgentSpawner tools.SubAgentSpawner
-	ftsStore        *store.FTSStore
-	piiScrubEnabled bool
-	memoryCfg       config.MemoryCfg
+	admins                  map[string][]string
+	skillsCfg               config.SkillsConfig
+	globalSkillsCfg         config.SkillsCfg
+	messageBus              *bus.MessageBus
+	subAgentSpawner         tools.SubAgentSpawner
+	ftsStore                *store.FTSStore
+	piiScrubEnabled         bool
+	memoryCfg               config.MemoryCfg
 	workspaceHistoryEnabled bool
 	history                 *workspace.History
 	// splitReplies is the per-agent multi-bubble toggle. Gates the
@@ -1750,7 +1750,7 @@ func (a *Agent) handlePlanMode(ctx context.Context, msg bus.InboundMessage) stri
 		return noProviderMsg
 	}
 
-	systemPrompt := a.ctxBuilder.BuildSystemPromptAs(chatterUID, a.memory.WithUserID(chatterUID))
+	systemPrompt := a.ctxBuilder.BuildSystemPromptAs(chatterUID, a.memory.WithUserID(chatterUID), a.isTrustedTurn(msg))
 	knowledgeMeta := knowledgeMetadata(extractKnowledgeCitationSources(systemPrompt))
 	a.logSystemPromptFingerprint(msg.Channel, msg.ChatID, chatterUID, systemPrompt)
 	// Tool catalog injection: plan mode passes tools=nil to the LLM so
@@ -2296,7 +2296,7 @@ func (a *Agent) HandleMessage(ctx context.Context, msg bus.InboundMessage) strin
 	a.hooks.Run(ctx, &HookContext{AgentName: a.name, Point: BeforeSystemPrompt, UserID: a.ownerUserID})
 
 	chatterMem := a.memory.WithUserID(chatterUID)
-	systemPrompt := a.ctxBuilder.BuildSystemPromptAs(chatterUID, chatterMem)
+	systemPrompt := a.ctxBuilder.BuildSystemPromptAs(chatterUID, chatterMem, a.isTrustedTurn(msg))
 	knowledgeMeta := knowledgeMetadata(extractKnowledgeCitationSources(systemPrompt))
 	a.logSystemPromptFingerprint(msg.Channel, msg.ChatID, chatterUID, systemPrompt)
 
@@ -3102,7 +3102,7 @@ func (a *Agent) HandleMessageStream(ctx context.Context, msg bus.InboundMessage)
 
 	a.hooks.Run(ctx, &HookContext{AgentName: a.name, Point: BeforeSystemPrompt, UserID: a.ownerUserID})
 	chatterMem := a.memory.WithUserID(chatterUID)
-	systemPrompt := a.ctxBuilder.BuildSystemPromptAs(chatterUID, chatterMem)
+	systemPrompt := a.ctxBuilder.BuildSystemPromptAs(chatterUID, chatterMem, a.isTrustedTurn(msg))
 	knowledgeMeta := knowledgeMetadata(extractKnowledgeCitationSources(systemPrompt))
 	a.logSystemPromptFingerprint(msg.Channel, msg.ChatID, chatterUID, systemPrompt)
 	a.hooks.Run(ctx, &HookContext{AgentName: a.name, Point: AfterSystemPrompt, UserID: a.ownerUserID})
```

**File**: `internal/agent/prompt_modules.go` (modified, +140/-15)
```diff
@@ -2,6 +2,8 @@ package agent
 
 import (
 	"fmt"
+	"os"
+	"path/filepath"
 	"runtime"
 	"strings"
 	"time"
@@ -38,6 +40,15 @@ type promptCtx struct {
 	now        time.Time
 	loc        *time.Location
 	dateLine   string // pre-rendered, shared across modules
+	// trusted mirrors Agent.isTrustedTurn for this turn: the chatter is
+	// the agent owner or a channel admin (or it's a heartbeat). The tool
+	// layer already enforces it via Registry.SetCallerIsAdmin; carrying
+	// it into the prompt is what stops the model from *self*-refusing
+	// operator work it is in fact authorized to do. Without this the
+	// model falls back to guessing from USER.md, and an empty USER.md
+	// reads as "unknown chatter" → it declines platform-management
+	// requests from the operator themselves.
+	trusted bool
 }
 
 // moduleEntry pairs a human-readable key with its builder function.
@@ -233,14 +244,12 @@ func modAgentIntro(p *promptCtx) string {
 	if buildinfo.IsHostedDeploy() {
 		fastclawLine = "FastClaw: hosted deployment. The chatter does NOT operate this runtime — if they ask about the version, upgrades, or installing/changing skills at the platform level, tell them those are administrator-controlled and offer to help with what's actually in your reach (config, skills you can author, files in the workspace)."
 	} else {
-		fastclawLine = fmt.Sprintf("FastClaw: %s (commit %s, built %s). Self-hosted install — the chatter is the operator.\n"+
+		fastclawLine = fmt.Sprintf("FastClaw: %s (commit %s, built %s). Self-hosted install.\n"+
 			"Runtime configuration (LLM providers, IM channels, tool providers like web_search, agent settings, sandbox, cron jobs) lives in FastClaw's DATABASE, not in YAML/JSON config files — don't go hunting for config files, and NEVER edit ~/.fastclaw/fastclaw.db directly. "+
-			"The management interface is the `fastclaw` CLI: `fastclaw provider` (LLM credentials), `fastclaw tools provider-set` / `category-set` (web_search & friends), `fastclaw channels`, `fastclaw agents config`, `fastclaw admin`, `fastclaw cron`, `fastclaw skill` — run any subcommand with --help to see flags. "+
-			"CLI writes persist to the database and hot-reload the running gateway, so no restart is needed. "+
-			"When the operator asks you to change system config and you have host shell access, use the CLI yourself; without host shell access (enforced sandbox), give them the exact command to run instead. "+
-			"Upgrades work the same way: `fastclaw upgrade` in a terminal (`fastclaw version` to verify), only run it yourself when explicitly asked and host shell access is available. "+
-			"Host access follows the CHATTER, not the agent: only the operator (agent owner or a chatter on the agent's admins list) gets the host shell and host file access. For any other chatter your exec calls run in the sandbox (or are refused when none is configured) and file tools are confined to the workspace — if a guest asks for host-side or platform-management work (creating agents, changing config), explain it's operator-only instead of retrying.",
-			buildinfo.Version, buildinfo.Commit, buildinfo.Date)
+			"The management interface is the `fastclaw` CLI: `fastclaw provider` (LLM credentials), `fastclaw tools provider-set` / `category-set` (web_search & friends), `fastclaw channels`, `fastclaw agents` (init / ls / config / rm), `fastclaw skill` (list / search / install), `fastclaw admin`, `fastclaw cron` — run any subcommand with --help to see flags. "+
+			"CLI writes persist to the database and hot-reload the running gateway, so no restart is needed.\n%s",
+			buildinfo.Version, buildinfo.Commit, buildinfo.Date,
+			operatorAccessLine(p.trusted, p.cb.sandboxEnabled))
 	}
 
 	return fmt.Sprintf(`You run on the FastClaw runtime. Your identity (name, role, personality)
@@ -293,6 +302,117 @@ USER.md, which grow over time and would lose context if rewritten in full.`,
 		runtime.GOOS, runtime.GOARCH, workdir, homeDesc)
 }
 
+// operatorAccessLine states, in t
```

**File**: `internal/agent/prompt_operator_test.go` (added, +117/-0)
```diff
@@ -0,0 +1,117 @@
+package agent
+
+import (
+	"testing"
+
+	"github.com/fastclaw-ai/fastclaw/internal/config"
+)
+
+// newOperatorBuilder builds an Agent-mode ContextBuilder with no identity
+// files at all — the exact state that used to make the model refuse
+// operator work: an empty USER.md read as "unknown chatter", so it
+// declined platform-management requests from the owner themselves.
+func newOperatorBuilder(t *testing.T) *ContextBuilder {
+	t.Helper()
+	// Self-hosted branch of modAgentIntro; the hosted branch has no
+	// operator concept at all.
+	t.Setenv("FASTCLAW_DEPLOY", "")
+	store := newFakeMemoryStore()
+	mem := NewMemoryWithStoreForUser("", store, ownerUID, testAgentID)
+	cb := NewContextBuilder("", mem, "")
+	cb.store = store
+	cb.agentID = testAgentID
+	cb.userID = ownerUID
+	cb.SetPromptMode(config.PromptModeAgent)
+	return cb
+}
+
+func TestAgentPrompt_TrustedTurnGrantsOperatorWork(t *testing.T) {
+	cb := newOperatorBuilder(t)
+
+	prompt := cb.BuildSystemPromptAs(ownerUID, cb.memory.WithUserID(ownerUID), true)
+
+	// The verdict must be stated, not left to inference from USER.md.
+	mustContain(t, prompt, "current chatter IS this agent's operator")
+	mustContain(t, prompt, "host shell")
+	// ...and the model must be told not to punt it back to the chatter.
+	mustContain(t, prompt, "do not ask them to run the command in their own terminal")
+
+	// Authorization is separated from identity: an empty USER.md still
+	// means "you don't know their name", and must not become a refusal.
+	mustContain(t, prompt, "Never let an empty USER.md turn into a refusal of operator work")
+
+	// The provisioning recipe — `agents config` alone was never enough to
+	// get the model to `agents init`.
+	mustContain(t, prompt, "fastclaw agents init")
+	mustContain(t, prompt, "fastclaw skill install --agent")
+	mustContain(t, prompt, "Without --agent the skill installs globally")
+
+	// The default agent equipping a DIFFERENT agent is the whole point;
+	// without this the model can read "this agent's private skills dir"
+	// as "only my own" and install into itself instead.
+	mustContain(t, prompt, "Installing into\n     an agent OTHER than yourself is normal")
+	mustContain(t, prompt, "Never install a skill into yourself as a substitute")
+
+	// The guest wording must not also be present — two contradictory
+	// branches in one prompt is what produced the original refusal.
+	mustNotContain(t, prompt, "is NOT this agent's operator")
+}
+
+func TestAgentPrompt_UntrustedTurnKeepsOperatorOnly(t *testing.T) {
+	cb := newOperatorBuilder(t)
+
+	prompt := cb.BuildSystemPromptAs(chatterUID, cb.memory.WithUserID(chatterUID), false)
+
+	mustContain(t, prompt, "current chatter is NOT this agent's operator")
+	mustContain(t, prompt, "operator-only")
+
+	// A guest must not be handed the provisioning recipe, nor the
+	// "run the CLI yourself" instruction.
+	mustNotContain(t, prompt, "fastclaw agents init")
+	mustNotContain(t, prompt, "current chatter IS this agent's operator")
+}
+
+// Being the operator grants authority, not a host shell. On an
+// enforced-sandbox build exec lands in the container, so the agent must
+// hand the commands over — claiming host access here would send it into
+// a loop of exec calls that never touch the real store.
+func TestAgentPrompt_EnforcedSandboxOperatorHandsOverCommands(t *testing.T) {
+	cb := newOperatorBuilder(t)
+	cb.sandboxEnabled = true
+
+	prompt := cb.BuildSystemPromptAs(ownerUID, cb.memory.WithUserID(ownerUID), true)
+
+	// Still recognized as the operator — the request is legitimate.
+	mustContain(t, prompt, "current chatter IS this agent's operator")
+	mustContain(t, prompt, `never answer one with "that's operator-only"`)
+	// ...but told plainly it cannot run the CLI itself.
+	mustContain(t, prompt, "you cannot run the")
+	mustContain(t, prompt, "paste into their own terminal")
+	// The host-access claim from the non-sandboxed branch must be absent.
+	mustNotContain(t, prompt, "has alr
```

---

### Incident Patch 4: `533a1382` (2026-07-27)
**Commit Message**: fix: stop check_agent green-lighting an agent with no skills

Second provisioning run, after 8318f7f: 2m17s instead of 20m39s, 18 tool
calls, no iteration cap. It still shipped a broken agent, and this time
the tool built to catch that said "ready".

check_agent reported "[--] skills: none installed" and then VERDICT:
ready, because only a missing model or an unmet skill requirement counted
as a problem - zero skills counted as nothing. The run had just been
asked to install a skill. Worse, the model noticed the contradiction,
decided the check "only scans registry metadata, it can't see the
directory I copied into", and overrode it. The check was right: the skill
had been hand-copied to agents/<id>/skills/, while agents read from
agents/<id>/agent/skills/.

So: zero skills no longer renders as an unqualified ready (it stays
non-fatal - a plain conversational agent legitimately has none), the
report names the exact directory it scanned so the finding cannot be
argued away, and check_agent takes expect_skills to turn "describe what
is there" into "confirm what was intended", which is the only version
that catches a skill written one directory too high.

Why it was hand-copied at all

**File**: `internal/agent/loop.go` (modified, +96/-0)
```diff
@@ -5,6 +5,7 @@ import (
 	"encoding/json"
 	"errors"
 	"fmt"
+	"io"
 	"log/slog"
 	"os"
 	"path/filepath"
@@ -2014,6 +2015,69 @@ func maybeInjectSoftDeadlineWarning(ctx context.Context, turnStart time.Time, me
 	return append(messages, warnMsg), true
 }
 
+// pendingTodoItems returns the unchecked items in this session's
+// todo.md, or nil when there is no todo file (the common case — most
+// turns never write one).
+//
+// Reads through the workspace store rather than the filesystem so it
+// sees the same bytes write_file wrote, in every deployment.
+func (a *Agent) pendingTodoItems(ctx context.Context) []string {
+	if a.workspaceStore == nil || a.agentID == "" || a.registry == nil {
+		return nil
+	}
+	rc, err := a.workspaceStore.Get(ctx, a.agentID, a.registry.ProjectID(), a.registry.SessionID(), "todo.md")
+	if err != nil {
+		return nil
+	}
+	defer rc.Close()
+	body, err := io.ReadAll(io.LimitReader(rc, 64<<10))
+	if err != nil {
+		return nil
+	}
+	return uncheckedTodoItems(string(body))
+}
+
+// uncheckedTodoItems parses the "- [ ] step" convention the UI renders.
+// Anything that isn't a checkbox line is prose and ignored, matching the
+// panel's own parser.
+func uncheckedTodoItems(body string) []string {
+	var out []string
+	for _, line := range strings.Split(body, "\n") {
+		trimmed := strings.TrimSpace(line)
+		if rest, ok := strings.CutPrefix(trimmed, "- [ ]"); ok {
+			if item := strings.TrimSpace(rest); item != "" {
+				out = append(out, item)
+			}
+		}
+	}
+	return out
+}
+
+// todoReconcileNudge asks for one more pass when a turn is about to end
+// with its own checklist still showing unfinished work.
+//
+// The checklist is a promise rendered in the UI, and it drifts for a
+// mundane reason: something goes wrong mid-turn, the model firefights,
+// and never returns to the file. What the user then sees is a reply
+// saying "all done" beside a progress panel reading 1/5 — and there is
+// no way to tell from the outside which one is lying.
+//
+// Fires at most once per turn, and accepts "I did not finish these" as a
+// valid resolution — leaving an item unchecked is correct when the work
+// genuinely did not happen. What is not acceptable is the mismatch.
+func todoReconcileNudge(pending []string) provider.Message {
+	return provider.Message{
+		Role: "system",
+		Content: fmt.Sprintf(
+			"Before this reply goes out: todo.md still has %d unchecked item(s) — %s. "+
+				"The user sees that checklist as a live progress panel next to your answer, so it must not contradict what you are about to say. "+
+				"Resolve it one of two ways: edit_file('todo.md', …) to flip the items you actually completed, "+
+				"or keep them unchecked and say plainly in your reply which steps did not get done and why. "+
+				"Do not claim the task is complete while its own checklist says otherwise.",
+			len(pending), strings.Join(pending, "; ")),
+	}
+}
+
 // softIterationFraction is the share of the tool-call budget left when
 // the wrap-up warning fires. 0.30 of 20 leaves 6 calls — enough to close
 // out a multi-step task (finish the current step, verify, report) but
@@ -2316,6 +2380,7 @@ func (a *Agent) HandleMessage(ctx context.Context, msg bus.InboundMessage) strin
 	turnStart := time.Now()
 	softDeadlineFired := false
 	iterBudgetWarned := false
+	todoReconciled := false
 
 	// replyParts accumulates every non-empty assistant text segment
 	// emitted across iterations (preamble lines before tool calls + the
@@ -2426,6 +2491,20 @@ func (a *Agent) HandleMessage(ctx context.Context, msg bus.InboundMessage) strin
 				return emptyMsg
 			}
 			asst := provider.Message{Role: "assistant", Content: resp.Content, Thinking: resp.Thinking, Metadata: knowledgeMeta, Timestamp: time.Now().UnixMilli(), RawAssistant: resp.RawAssistant}
+
+			// Reconcile the checklist BEFORE the answer is emitted — once
+			// the user has read "all done", a corrected todo panel is just
+			// a second contradiction. Firing once per turn bo
```

**File**: `internal/agent/loop_stall_test.go` (modified, +51/-0)
```diff
@@ -325,3 +325,54 @@ func TestCapReachedNudgeDemandsHonestyAboutTruncation(t *testing.T) {
 		}
 	}
 }
+
+// The checklist is rendered beside the answer, so the two must not
+// contradict each other. A turn that firefights a mid-turn failure and
+// never returns to todo.md ends with a reply saying "all done" next to a
+// panel reading 1/5, and nothing tells the user which is true.
+func TestUncheckedTodoItemsParsesTheUIConvention(t *testing.T) {
+	body := `- [x] 1. 创建新 agent (anthropic-art)
+- [ ] 2. 为新 agent 配置模型
+Some prose that is not a checkbox.
+  - [ ] 3. 安装 skill
+- [X] 4. 写入 IDENTITY.md
+- [ ]
+`
+	got := uncheckedTodoItems(body)
+	if len(got) != 2 {
+		t.Fatalf("expected 2 unchecked items, got %d: %v", len(got), got)
+	}
+	if got[0] != "2. 为新 agent 配置模型" || got[1] != "3. 安装 skill" {
+		t.Errorf("unexpected items: %v", got)
+	}
+	// Uppercase [X] counts as done, matching the panel's parser.
+	for _, item := range got {
+		if strings.Contains(item, "IDENTITY") {
+			t.Errorf("[X] should count as completed: %v", got)
+		}
+	}
+	if items := uncheckedTodoItems("- [x] all done\n"); len(items) != 0 {
+		t.Errorf("a fully checked list has nothing pending, got %v", items)
+	}
+	if items := uncheckedTodoItems("no checkboxes here"); len(items) != 0 {
+		t.Errorf("prose is not a checklist, got %v", items)
+	}
+}
+
+func TestTodoReconcileNudgeAllowsHonestIncompleteness(t *testing.T) {
+	msg := todoReconcileNudge([]string{"2. configure model", "5. verify"})
+	if msg.Role != "system" {
+		t.Fatalf("nudge role = %q", msg.Role)
+	}
+	if !strings.Contains(msg.Content, "2. configure model") || !strings.Contains(msg.Content, "5. verify") {
+		t.Errorf("nudge should name the pending items: %s", msg.Content)
+	}
+	// Leaving an item unchecked is legitimate when the work didn't
+	// happen — what's forbidden is the mismatch, not the incompleteness.
+	if !strings.Contains(msg.Content, "which steps did not get done") {
+		t.Errorf("nudge must accept an honest 'not done' resolution: %s", msg.Content)
+	}
+	if !strings.Contains(msg.Content, "Do not claim the task is complete") {
+		t.Errorf("nudge must forbid the contradiction: %s", msg.Content)
+	}
+}
```

**File**: `internal/agent/tools/agent_admin.go` (modified, +81/-11)
```diff
@@ -208,20 +208,27 @@ func RegisterAgentAdmin(r *Registry, deps AgentAdminDeps) {
 	r.Register(
 		"check_agent",
 		"Verify that an agent you own is actually able to do its job: model configured, skills installed, and the tools those skills declare they need actually available. "+
-			"Run this before reporting to the user that a newly provisioned agent is ready — installing a skill does NOT guarantee the agent can run it.",
+			"Run this before reporting to the user that a newly provisioned agent is ready — installing a skill does NOT guarantee the agent can run it. "+
+			"Always pass expect_skills listing the skills you installed this turn; without it the check can only describe what it finds, and a skill written to the wrong place looks identical to one that was never requested.",
 		map[string]interface{}{
 			"type": "object",
 			"properties": map[string]interface{}{
 				"agent": map[string]interface{}{
 					"type":        "string",
 					"description": "Target agent name or agt_ id.",
 				},
+				"expect_skills": map[string]interface{}{
+					"type":        "array",
+					"items":       map[string]interface{}{"type": "string"},
+					"description": "Skills that MUST be present, e.g. the ones you just installed. Any that are missing are reported as failures.",
+				},
 			},
 			"required": []string{"agent"},
 		},
 		func(ctx context.Context, raw json.RawMessage) (string, error) {
 			var p struct {
-				Agent string `json:"agent"`
+				Agent        string   `json:"agent"`
+				ExpectSkills []string `json:"expect_skills"`
 			}
 			if err := json.Unmarshal(raw, &p); err != nil {
 				return "", err
@@ -233,7 +240,7 @@ func RegisterAgentAdmin(r *Registry, deps AgentAdminDeps) {
 			if err != nil {
 				return "", err
 			}
-			return DiagnoseAgent(ctx, deps, rec.ID, rec.Name), nil
+			return DiagnoseAgent(ctx, deps, rec.ID, rec.Name, p.ExpectSkills...), nil
 		},
 	)
 }
@@ -269,7 +276,11 @@ func resolveOwnedAgent(ctx context.Context, deps AgentAdminDeps, ref string) (*s
 // exist and nothing ever checked. Every individual step succeeded; the
 // deliverable did not work. So this reports capability, and says
 // "unknown" where it cannot tell rather than implying health.
-func DiagnoseAgent(ctx context.Context, deps AgentAdminDeps, agentID, agentName string) string {
+// expectSkills names skills the caller believes it installed. Passing
+// them turns the check from "describe what's there" into "confirm what
+// was intended", which is the only version that catches a skill written
+// to the wrong directory.
+func DiagnoseAgent(ctx context.Context, deps AgentAdminDeps, agentID, agentName string, expectSkills ...string) string {
 	var b strings.Builder
 	problems := 0
 
@@ -285,9 +296,31 @@ func DiagnoseAgent(ctx context.Context, deps AgentAdminDeps, agentID, agentName
 		fmt.Fprintf(&b, "  [ok]   model: %s\n", modelStr)
 	}
 
+	// Always name the directory that was scanned. Without it the report
+	// is unfalsifiable prose, and a model that dislikes the answer can
+	// talk itself out of it — one did, deciding this check "only reads
+	// registry metadata" and overriding a correct "no skills found" that
+	// was pointing straight at a skill copied one directory too high.
+	skillRoot := agentSkillRoot(deps, agentID)
 	skills := discoverAgentSkills(deps, agentID)
 	if len(skills) == 0 {
-		b.WriteString("  [--]   skills: none installed in this agent's private scope\n")
+		fmt.Fprintf(&b, "  [--]   skills: none found in %s (this is the ONLY directory this agent loads private skills from)\n",
+			displayPath(skillRoot))
+	}
+
+	// A skill the caller expected but cannot find is a hard failure, and
+	// the most likely cause is that it was written somewhere the agent
+	// does not read.
+	for _, want := range expectSkills {
+		want = strings.TrimSpace(want)
+		if want == "" {
+			continue
+		}
+		if !hasSkillNamed(skills, want) {
+			problems++
+			fmt.Fprintf(&b, "  [FAIL] skill %s: expected but NOT present in %s — it wa
```

**File**: `internal/agent/tools/agent_admin_test.go` (modified, +76/-0)
```diff
@@ -220,3 +220,79 @@ func TestCreateAgentPinsOwnership(t *testing.T) {
 		t.Errorf("new agent owner = %q, want the calling account %q", rec.UserID, ownerID)
 	}
 }
+
+// TestDiagnoseAgentZeroSkillsIsNotAConfidentReady covers the case that
+// slipped through in the field: a provisioning run whose skill install
+// landed in the wrong directory, on a check that answered "ready".
+//
+// Zero skills is legitimate for a plain conversational agent, so this is
+// not a hard failure — but it must never read as an unqualified green
+// light, and the report has to name the directory it scanned so the
+// finding can't be argued away.
+func TestDiagnoseAgentZeroSkillsIsNotAConfidentReady(t *testing.T) {
+	st := newTestStore(t)
+	agentID, ownerID := seedAgent(t, st, "bare")
+	if err := agentcli.SetConfig(context.Background(), st, agentID, "model", "anthropic/claude-sonnet-5"); err != nil {
+		t.Fatal(err)
+	}
+	home := t.TempDir()
+	deps := AgentAdminDeps{
+		Store:        st,
+		OwnerUserID:  ownerID,
+		AgentHomeDir: func(string) (string, error) { return home, nil },
+		ToolAvailability: func(context.Context, string) (map[string]bool, error) {
+			return map[string]bool{}, nil
+		},
+	}
+
+	report := DiagnoseAgent(context.Background(), deps, agentID, "bare")
+	if strings.Contains(report, "VERDICT: ready.") {
+		t.Fatalf("zero skills must not render as an unqualified ready:\n%s", report)
+	}
+	if !strings.Contains(report, "did NOT land here") {
+		t.Errorf("report should flag a provisioning miss:\n%s", report)
+	}
+	if !strings.Contains(report, filepath.Join(home, "skills")) {
+		t.Errorf("report must name the scanned directory so it can be checked:\n%s", report)
+	}
+}
+
+// expect_skills turns the check from "describe what's there" into
+// "confirm what was intended" — the only version that catches a skill
+// written one directory too high.
+func TestDiagnoseAgentFailsOnMissingExpectedSkill(t *testing.T) {
+	st := newTestStore(t)
+	agentID, ownerID := seedAgent(t, st, "expects")
+	if err := agentcli.SetConfig(context.Background(), st, agentID, "model", "anthropic/claude-sonnet-5"); err != nil {
+		t.Fatal(err)
+	}
+	home := t.TempDir()
+	deps := AgentAdminDeps{
+		Store:        st,
+		OwnerUserID:  ownerID,
+		AgentHomeDir: func(string) (string, error) { return home, nil },
+		ToolAvailability: func(context.Context, string) (map[string]bool, error) {
+			return map[string]bool{"image_gen": true}, nil
+		},
+	}
+
+	report := DiagnoseAgent(context.Background(), deps, agentID, "expects", "anthropic-art")
+	if !strings.Contains(report, "VERDICT: NOT ready") {
+		t.Fatalf("a missing expected skill must fail the check:\n%s", report)
+	}
+	if !strings.Contains(report, "expected but NOT present") {
+		t.Errorf("report should say the skill was expected:\n%s", report)
+	}
+
+	// Now actually install it where the agent reads from.
+	writeSkill(t, home, "anthropic-art", "metadata:\n  fastclaw:\n    requires:\n      tools: [image_gen]\n")
+	report = DiagnoseAgent(context.Background(), deps, agentID, "expects", "anthropic-art")
+	if !strings.Contains(report, "VERDICT: ready.") {
+		t.Errorf("expected skill present and satisfied should be ready:\n%s", report)
+	}
+
+	// Case-insensitive, since folder names and typed names differ.
+	if r := DiagnoseAgent(context.Background(), deps, agentID, "expects", "Anthropic-Art"); !strings.Contains(r, "VERDICT: ready.") {
+		t.Errorf("expected-skill matching should be case-insensitive:\n%s", r)
+	}
+}
```

**File**: `internal/agent/tools/skill_install.go` (modified, +17/-5)
```diff
@@ -84,24 +84,36 @@ func RegisterSkillInstallForTarget(r *Registry, agentSkillsDir string, resolveTa
 
 	r.Register(
 		"install_skill",
-		"Install a skill into THIS agent's private skills directory. Tries skills.sh first, then clawhub.ai. If neither has it, returns a not-found error — at that point ask the user whether to build a custom skill with the skill-creator skill instead of retrying. Installed skills are scoped to this agent only; they do not affect other agents.",
+		"Install a skill into an agent's private skills directory. Tries skills.sh first, then clawhub.ai, or a GitHub repo when `repo` is set. "+
+			"If none has it, returns a not-found error — at that point ask the user whether to build a custom skill with the skill-creator skill instead of retrying. "+
+			"Installed skills are scoped to one agent; they do not affect other agents. "+
+			"This tool is the ONLY correct way to install a skill: it writes to the exact directory the target agent loads from. Never copy skill files into place by hand — "+
+			"the agent home layout is not what it looks like, and a hand-placed skill silently never loads.",
 		map[string]interface{}{
 			"type": "object",
 			"properties": map[string]interface{}{
 				"name": map[string]interface{}{
-					"type":        "string",
-					"description": "Skill name/slug (what you'd see listed on skills.sh or clawhub). For GitHub installs, use 'owner/repo' in the `repo` field instead.",
+					"type": "string",
+					"description": "Registry slug (skills.sh / clawhub). With `repo`, this is the skill FOLDER NAME inside that repo — " +
+						"omit it when the repo holds a single skill, even if the manifest sits in a subfolder like `skill/`, and the right directory is found automatically. " +
+						"Guessing a folder name that doesn't exist is the most common way this call fails.",
 				},
 				"repo": map[string]interface{}{
 					"type":        "string",
-					"description": "Optional: GitHub 'owner/repo' to install from a specific repo instead of the public registries. When set, `name` is the skill folder inside the repo (omit for whole-repo skills).",
+					"description": "GitHub 'owner/repo' to install from instead of the public registries. For a single-skill repo, pass ONLY this and leave `name` unset.",
 				},
 				"agent": map[string]interface{}{
 					"type":        "string",
 					"description": "Optional: install into ANOTHER agent you own (name or agt_ id) instead of this one. Use this after create_agent to equip the new agent.",
 				},
 			},
-			"required": []string{"name"},
+			// Deliberately no hard requirement: `name` alone (registry) and
+			// `repo` alone (whole-repo install) are both valid, and the
+			// handler rejects the empty case. Marking `name` required made
+			// whole-repo installs unreachable — the model had to invent a
+			// folder name, which 404'd, and it fell back to copying files by
+			// hand into a directory the agent does not read.
+			"required": []string{},
 		},
 		func(ctx context.Context, args json.RawMessage) (string, error) {
 			var params struct {
```

---

### Incident Patch 5: `e1be55e2` (2026-07-27)
**Commit Message**: fix: warn before the tool-call budget runs out, and disclose when it did

The 20-iteration cap is what actually truncated the provisioning session
analysed in 8318f7f, and it explains the ending better than the earlier
read did: the model was mid-thought about running a real end-to-end test
when the budget ran out, and the forced synthesis turned that into a
confident sign-off with a tick beside a step that never executed.

Three things were wrong, none of them the cap value itself.

No warning before the cliff. maybeInjectSoftDeadlineWarning has told the
model about the wall-clock budget since it shipped; the tool-call budget
- the one that actually fires - told it nothing. A turn that plans five
steps and is guillotined after four has no way to prioritise, and the
step it loses is always the last one, which is verification. Adds the
iteration analogue, firing with 30% of the budget left (6 calls of 20):
enough to finish and verify, not enough to start exploring again.

The forced-synthesis nudge optimised for the wrong thing. "Do not
apologize without delivering content" plus "the most complete
deliverable you can" reads as an instruction to sound finished. It now
also requires s

**File**: `internal/agent/loop.go` (modified, +93/-2)
```diff
@@ -2014,6 +2014,52 @@ func maybeInjectSoftDeadlineWarning(ctx context.Context, turnStart time.Time, me
 	return append(messages, warnMsg), true
 }
 
+// softIterationFraction is the share of the tool-call budget left when
+// the wrap-up warning fires. 0.30 of 20 leaves 6 calls — enough to close
+// out a multi-step task (finish the current step, verify, report) but
+// not enough to start a new line of exploration.
+const softIterationFraction = 0.30
+
+// maybeInjectIterationBudgetWarning is the tool-call analogue of
+// maybeInjectSoftDeadlineWarning.
+//
+// The wall-clock budget has warned the model since it shipped; the
+// iteration budget never did, and it is the one that actually fires. A
+// turn that plans five steps, spends its calls on the first four, and
+// gets guillotined mid-plan produces the worst possible artifact: the
+// forced synthesis reads as a confident completion report, because from
+// the model's point of view it never learned it was about to be cut off.
+// The verification step is what gets dropped — it is always last — so
+// the turn ends by claiming success it never checked.
+//
+// Warning early enough to act is the whole point: this fires with
+// softIterationFraction of the budget left, so the model can spend its
+// remaining calls finishing rather than exploring.
+func maybeInjectIterationBudgetWarning(ctx context.Context, used, max int, messages []provider.Message, alreadyFired bool) ([]provider.Message, bool) {
+	if alreadyFired || max <= 0 {
+		return messages, alreadyFired
+	}
+	remaining := max - used
+	if remaining <= 0 || float64(remaining) > float64(max)*softIterationFraction {
+		return messages, false
+	}
+	emitEvent(ctx, ChatEvent{Type: "status", Data: map[string]any{
+		"phase":                "wrap_up",
+		"remaining_tool_calls": remaining,
+	}})
+	warnMsg := provider.Message{
+		Role: "system",
+		Content: fmt.Sprintf(
+			"Tool budget warning: %d of %d tool calls used — about %d remain before this turn is cut off and "+
+				"a final answer is forced from whatever you have. Stop exploring and start closing out. "+
+				"Spend the remaining calls on finishing the task and on any verification you told the user you would do; "+
+				"verification is the step that gets lost when the budget runs out, and an unverified claim reported as "+
+				"done is worse than an honest 'not yet checked'. If you cannot finish, say plainly which steps did not run.",
+			used, max, remaining),
+	}
+	return append(messages, warnMsg), true
+}
+
 // runToolsWithProgress wraps executeToolsConcurrently with a ticker that
 // emits "tool_progress" events every toolProgressInterval while the
 // call is in flight, so a slow tool (sandbox exec, subagent delegate)
@@ -2269,6 +2315,7 @@ func (a *Agent) HandleMessage(ctx context.Context, msg bus.InboundMessage) strin
 	// turn run until it's hard-killed mid-request.
 	turnStart := time.Now()
 	softDeadlineFired := false
+	iterBudgetWarned := false
 
 	// replyParts accumulates every non-empty assistant text segment
 	// emitted across iterations (preamble lines before tool calls + the
@@ -2289,6 +2336,7 @@ func (a *Agent) HandleMessage(ctx context.Context, msg bus.InboundMessage) strin
 		)
 
 		messages, softDeadlineFired = maybeInjectSoftDeadlineWarning(ctx, turnStart, messages, softDeadlineFired)
+		messages, iterBudgetWarned = maybeInjectIterationBudgetWarning(ctx, i, a.maxToolIterations, messages, iterBudgetWarned)
 
 		// Hook: BeforeModelCall
 		hcBefore := &HookContext{AgentName: a.name, Point: BeforeModelCall, Messages: messages, Channel: msg.Channel, AccountID: msg.AccountID, ChatID: msg.ChatID, UserID: a.ownerUserID}
@@ -2655,6 +2703,7 @@ func (a *Agent) HandleMessage(ctx context.Context, msg bus.InboundMessage) strin
 		// badge attached.
 		finalContent = fmt.Sprintf("I've reached the maximum number of tool iterations (%d) and couldn't synthesize a final response. The work above represents what I gathered before hitting the limit.", a.max
```

**File**: `internal/agent/loop_stall_test.go` (modified, +95/-0)
```diff
@@ -230,3 +230,98 @@ func TestUpdateSameToolFailStreak(t *testing.T) {
 	})
 }
 
+
+// The tool-call budget is the limit that actually fires in practice, yet
+// it warned nobody until now — only the wall-clock budget did. A turn
+// that plans five steps and gets cut off after four ends by reporting
+// the fifth as done, because the model never learned it was running out.
+func TestMaybeInjectIterationBudgetWarning_FiresOnceNearTheCap(t *testing.T) {
+	ctx := context.Background()
+	base := []provider.Message{{Role: "user", Content: "go"}}
+
+	// 13 of 20 used: 7 left, above the 30% threshold — stay quiet.
+	got, fired := maybeInjectIterationBudgetWarning(ctx, 13, 20, base, false)
+	if fired || len(got) != len(base) {
+		t.Fatalf("must not fire while budget is comfortable (fired=%v, msgs=%d)", fired, len(got))
+	}
+
+	// 14 of 20: 6 left, exactly at 30% — warn.
+	got, fired = maybeInjectIterationBudgetWarning(ctx, 14, 20, base, false)
+	if !fired {
+		t.Fatal("expected the warning to fire with 30% of the budget left")
+	}
+	if len(got) != len(base)+1 {
+		t.Fatalf("expected one appended system message, got %d", len(got))
+	}
+	warn := got[len(got)-1]
+	if warn.Role != "system" {
+		t.Errorf("warning should be a system message, got role %q", warn.Role)
+	}
+	for _, want := range []string{"Tool budget warning", "verification"} {
+		if !strings.Contains(warn.Content, want) {
+			t.Errorf("warning missing %q: %s", want, warn.Content)
+		}
+	}
+
+	// Already fired — never append twice in one turn.
+	got2, fired2 := maybeInjectIterationBudgetWarning(ctx, 18, 20, got, true)
+	if !fired2 || len(got2) != len(got) {
+		t.Errorf("warning must fire at most once per turn")
+	}
+}
+
+// A budget already spent has nothing to warn about — the cap nudge takes
+// over at that point.
+func TestMaybeInjectIterationBudgetWarning_NoBudgetNoFire(t *testing.T) {
+	ctx := context.Background()
+	base := []provider.Message{{Role: "user", Content: "go"}}
+	if _, fired := maybeInjectIterationBudgetWarning(ctx, 20, 20, base, false); fired {
+		t.Error("must not fire when the budget is already exhausted")
+	}
+	if _, fired := maybeInjectIterationBudgetWarning(ctx, 0, 0, base, false); fired {
+		t.Error("must not fire when no cap is configured")
+	}
+}
+
+// The cap-reached banner is rendered by exactly one consumer — the web
+// chat UI. On every other channel the metadata is dropped, so without an
+// in-band notice a guillotined turn arrives looking like a finished,
+// confident answer.
+func TestIterationCapNoticeReachesNonWebChannels(t *testing.T) {
+	if notice := iterationCapNotice("web", 20); notice != "" {
+		t.Errorf("web renders its own badge; text notice would duplicate it: %q", notice)
+	}
+	for _, ch := range []string{"wechat", "discord", "feishu", "line", "api", ""} {
+		notice := iterationCapNotice(ch, 20)
+		if notice == "" {
+			t.Errorf("channel %q silently drops the cap metadata and needs an in-band notice", ch)
+			continue
+		}
+		if !strings.Contains(notice, "20") {
+			t.Errorf("notice for %q should name the limit: %q", ch, notice)
+		}
+		if !strings.Contains(notice, "not necessarily verified") {
+			t.Errorf("notice for %q should undercut completion claims: %q", ch, notice)
+		}
+	}
+}
+
+// The forced-synthesis nudge used to push purely toward "deliver
+// content", which is how a truncated turn produced a confident
+// completion report with a tick next to a step that never ran.
+func TestCapReachedNudgeDemandsHonestyAboutTruncation(t *testing.T) {
+	msg := capReachedNudge(20)
+	if msg.Role != "system" {
+		t.Fatalf("nudge role = %q", msg.Role)
+	}
+	for _, want := range []string{
+		"ran out of tool budget",
+		"did not run",
+		"unless a tool result",
+		"configured but not verified",
+	} {
+		if !strings.Contains(msg.Content, want) {
+			t.Errorf("nudge should require honesty about %q:\n%s", want, msg.Content)
+		}
+	}
+}
```

---

### Incident Patch 6: `8318f7f3` (2026-07-27)
**Commit Message**: fix: repair the tool path behind in-chat agent provisioning

Traced from a provisioning session that took 20m39s and signed off on an
agent that cannot do its job. 18m30s of that was one tool call; the
final answer reported four verified checks, none of which tested whether
the delivered agent worked.

exec: kill the process group, not just the shell

CommandContext's default Cancel kills `sh` alone. Grandchildren inherit
the CombinedOutput pipe, so Wait blocks until the last one exits: a
`find / | head` with a 120s deadline returned at 18m30s, when find
finished walking the filesystem. Reproduced exactly (1s deadline ->
30.011s return, `signal: killed`, grandchild output still delivered).
Adds setProcessGroup + group SIGKILL + WaitDelay, mirroring what
bash_session.go already does for backgrounded shells, and rewrites the
timeout error so it reads as a timeout instead of a crash.

web_fetch: extract the page, not the markup

A GitHub repo fetch returned ~80 blank lines. The read window (maxLen*3
= 30KB) ended inside a 100KB+ <head>, and stripHTML left <link>/<meta>/
inline <svg> behind as whitespace. The empty result was read as an
anti-bot block, which is what sent the session to

**File**: `cmd/fastclaw/cmd_agents.go` (modified, +50/-0)
```diff
@@ -5,12 +5,14 @@ import (
 	"encoding/json"
 	"fmt"
 	"os"
+	"strings"
 
 	"github.com/spf13/cobra"
 
 	"github.com/fastclaw-ai/fastclaw/internal/agentcli"
 	"github.com/fastclaw-ai/fastclaw/internal/config"
 	"github.com/fastclaw-ai/fastclaw/internal/daemon"
+	"github.com/fastclaw-ai/fastclaw/internal/gateway"
 )
 
 // agentsCmd is a thin CLI front-end for the same agent CRUD the
@@ -27,6 +29,7 @@ func agentsCmd() *cobra.Command {
 	addAgentsSubcommand(cmd, agentsInitCmd())
 	addAgentsSubcommand(cmd, agentsRemoveCmd())
 	addAgentsSubcommand(cmd, agentsConfigCmd())
+	addAgentsSubcommand(cmd, agentsDoctorCmd())
 	addAgentsSubcommand(cmd, agentsFilesCmd())
 	return cmd
 }
@@ -196,6 +199,53 @@ func agentsRemoveCmd() *cobra.Command {
 	return cmd
 }
 
+// agentsDoctorCmd answers "is this agent actually able to do its job",
+// which is a different question from "was it configured".
+//
+// Provisioning an agent touches several independent things — a record, a
+// model, skills on disk, provider credentials for the tools those skills
+// drive — and each one reports success on its own. The combination is
+// what can be broken: an illustration agent whose skill installed
+// perfectly and whose image_gen was never wired looks healthy in every
+// individual check and produces nothing.
+func agentsDoctorCmd() *cobra.Command {
+	return &cobra.Command{
+		Use:   "doctor <name>",
+		Short: "Check whether an agent is actually able to do its job",
+		Long: `Report an agent's readiness: model configured, skills installed, and
+whether the tools those skills declare they need are actually available.
+
+Skills declare their requirements in SKILL.md frontmatter:
+
+  metadata:
+    fastclaw:
+      requires:
+        tools: [image_gen]
+        bins: [ffmpeg]
+        env: [SOME_API_KEY]
+
+Exits non-zero when the agent is not ready, so it can gate a provisioning
+script.`,
+		Args: cobra.ExactArgs(1),
+		RunE: func(cmd *cobra.Command, args []string) error {
+			st, err := openStoreFromEnv()
+			if err != nil {
+				return err
+			}
+			defer st.Close()
+			report, err := gateway.DiagnoseAgent(context.Background(), st, args[0])
+			if err != nil {
+				return err
+			}
+			fmt.Print(report)
+			if strings.Contains(report, "VERDICT: NOT ready") {
+				return fmt.Errorf("agent is not ready")
+			}
+			return nil
+		},
+	}
+}
+
 func agentsConfigCmd() *cobra.Command {
 	return &cobra.Command{
 		Use:   "config <name> <get|set> [key] [value]",
```

**File**: `cmd/fastclaw/main.go` (modified, +31/-0)
```diff
@@ -7,6 +7,7 @@ import (
 	"os"
 	"os/exec"
 	"runtime"
+	"strings"
 
 	"github.com/spf13/cobra"
 
@@ -96,6 +97,19 @@ func main() {
 	rootCmd := &cobra.Command{
 		Use:   "fastclaw",
 		Short: "FastClaw - Multi-User AI Agent Platform",
+		// Long-running services (gateway, daemon) narrate at INFO; one-shot
+		// CLI commands must not. Every `fastclaw agents ls` was prefixing
+		// its output with two lines of storage/migration chatter, which is
+		// noise for a human and context pollution for an agent shelling out
+		// to us — eight CLI calls in one turn meant sixteen wasted lines,
+		// every one of them re-sent to the model on the next request.
+		//
+		// runGateway raises the level back to INFO for its own process.
+		PersistentPreRun: func(cmd *cobra.Command, args []string) {
+			slog.SetDefault(slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{
+				Level: cliLogLevel(),
+			})))
+		},
 		RunE: func(cmd *cobra.Command, args []string) error {
 			if isInteractiveTerminal(os.Stdin, os.Stdout) {
 				return runChat(cmd.Context(), chatOptions{})
@@ -130,6 +144,23 @@ func main() {
 	}
 }
 
+// cliLogLevel is the slog level for one-shot CLI commands: quiet by
+// default, opened up via FASTCLAW_LOG_LEVEL for debugging. Warnings and
+// errors still print, so nothing that needs the operator's attention is
+// suppressed — only the routine "here's what I'm doing" narration.
+func cliLogLevel() slog.Level {
+	switch strings.ToLower(strings.TrimSpace(os.Getenv("FASTCLAW_LOG_LEVEL"))) {
+	case "debug":
+		return slog.LevelDebug
+	case "info":
+		return slog.LevelInfo
+	case "error":
+		return slog.LevelError
+	default:
+		return slog.LevelWarn
+	}
+}
+
 func gatewayCmd() *cobra.Command {
 	var port int
 	cmd := &cobra.Command{
```

**File**: `internal/agent/bundled_skills/camoufox-cli/SKILL.md` (modified, +4/-0)
```diff
@@ -1,6 +1,10 @@
 ---
 name: camoufox-cli
 description: Anti-detect browser automation CLI & Skills for AI agents. Use when the user needs to interact with websites with bot detection, CAPTCHAs, or anti-bot blocks, including navigating pages, filling forms, clicking buttons, taking screenshots, extracting data, testing web apps, or automating any browser task that requires bypassing fingerprint checks.
+metadata:
+  fastclaw:
+    requires:
+      bins: [camoufox-cli]
 ---
 
 # Anti-Detect Browser Automation with camoufox-cli
```

**File**: `internal/agent/manager.go` (modified, +66/-0)
```diff
@@ -1,11 +1,14 @@
 package agent
 
 import (
+	"context"
 	"fmt"
 	"log/slog"
+	"path/filepath"
 	"strings"
 
 	"github.com/fastclaw-ai/fastclaw/internal/agent/tools"
+	"github.com/fastclaw-ai/fastclaw/internal/agentcli"
 	"github.com/fastclaw-ai/fastclaw/internal/bus"
 	"github.com/fastclaw-ai/fastclaw/internal/config"
 	"github.com/fastclaw-ai/fastclaw/internal/provider"
@@ -50,6 +53,29 @@ type managerOpts struct {
 	quotaStore      usage.QuotaStore
 	userID          string
 	globalSkillsCfg config.SkillsCfg
+	// toolAvailability answers "which tools would agent X have at
+	// runtime". Only the gateway can say — tool registration depends on
+	// per-agent provider credentials — so it is injected rather than
+	// derived here. Nil makes check_agent report tool status as
+	// unverified instead of guessing.
+	toolAvailability func(ctx context.Context, agentID string) (map[string]bool, error)
+	// onAgentChanged is invoked after in-chat provisioning mutates an
+	// agent, so a running gateway can reload rather than require a
+	// restart.
+	onAgentChanged func()
+}
+
+// WithToolAvailability supplies the capability probe behind check_agent.
+// Without it a freshly provisioned agent can be reported "configured"
+// while being unable to do the one thing its skill exists for.
+func WithToolAvailability(fn func(ctx context.Context, agentID string) (map[string]bool, error)) ManagerOption {
+	return func(o *managerOpts) { o.toolAvailability = fn }
+}
+
+// WithAgentChangeHook registers a callback fired after in-chat agent
+// provisioning, so the gateway can pick up the new/changed agent.
+func WithAgentChangeHook(fn func()) ManagerOption {
+	return func(o *managerOpts) { o.onAgentChanged = fn }
 }
 
 func WithSessionStore(st session.SessionStore) ManagerOption {
@@ -258,6 +284,46 @@ func (m *Manager) buildAgent(rc config.ResolvedAgent, prov provider.Provider, mb
 		// scope-prefs lookup, hence wired here and re-applied by
 		// ReloadWorkspaceFiles after every ctxBuilder rebuild.
 		ag.ctxBuilder.SetTimezoneResolver(ag.chatterLocation)
+
+		// In-chat provisioning. Goes through the same Go API as the CLI
+		// and the admin UI, so "set me up a new agent" behaves the same
+		// whether or not a sandbox is configured — the previous path
+		// (model composes `fastclaw ...`, exec runs it) only ever worked
+		// when exec reached the operator's host.
+		ownerID := rc.UserID
+		if ownerID == "" {
+			ownerID = m.uid
+		}
+		resolveTargetSkills := func(ctx context.Context, ref string) (string, error) {
+			rec, err := agentcli.Resolve(ctx, m.opts.dataStore, ref)
+			if err != nil {
+				return "", err
+			}
+			if rec.UserID != ownerID {
+				return "", fmt.Errorf("agent %q belongs to a different account — refusing to install into it", ref)
+			}
+			home, err := config.AgentHomeDir(rec.ID)
+			if err != nil {
+				return "", err
+			}
+			return filepath.Join(home, "skills"), nil
+		}
+		tools.RegisterAgentAdmin(ag.registry, tools.AgentAdminDeps{
+			Store:            m.opts.dataStore,
+			OwnerUserID:      ownerID,
+			AgentHomeDir:     config.AgentHomeDir,
+			ToolAvailability: m.opts.toolAvailability,
+			OnChanged:        m.opts.onAgentChanged,
+		})
+		// install_skill / search_skills were written but never registered —
+		// the tools existed as dead code, which is why provisioning had to
+		// shell out to the CLI in the first place.
+		tools.RegisterSkillInstallForTarget(
+			ag.registry,
+			filepath.Join(rc.Home, "skills"),
+			resolveTargetSkills,
+			func() { ag.refreshSkillsFromStore(m.uid) },
+		)
 	}
 	// Stamp agentID even when no workspaceStore is wired (single-user
 	// local mode), so usage metering can record per-agent rollups.
```

**File**: `internal/agent/prompt_modules.go` (modified, +33/-7)
```diff
@@ -873,7 +873,7 @@ conversational replies. todo.md is for plans the user wants to track,
 not chat overhead.`
 
 var toolDisciplineContent = `# Tool Use
-Four failure modes that cost rounds:
+Five failure modes that cost rounds:
 
 0. **Check Skills BEFORE improvising a multi-tool pipeline.** For any
    request that would otherwise need 3+ tool calls of stitched-
@@ -935,12 +935,17 @@ Four failure modes that cost rounds:
    failed URL within this turn, so swap source, not just the path.
 
    Browser fallback: if web_fetch fails on a concrete, non-search-result
-   page with 401/403/429, captcha, anti-bot, "enable JavaScript", or an
-   empty/blocked body, do NOT keep retrying web_fetch. Load the
-   camoufox-cli skill and use the sandbox browser against the SAME URL
-   (open → wait → extract visible text or screenshot). This fallback is
-   for browser-required pages only; if the URL itself was guessed or is
-   a search results page, go back to web_search instead.
+   page with 401/403/429, captcha, anti-bot, or "enable JavaScript", do
+   NOT keep retrying web_fetch. Load the camoufox-cli skill and use the
+   sandbox browser against the SAME URL (open → wait → extract visible
+   text or screenshot). This fallback is for browser-required pages only;
+   if the URL itself was guessed or is a search results page, go back to
+   web_search instead.
+   A thin or oddly-formatted result is NOT an anti-bot block. When
+   web_fetch reports that it extracted no readable text, it says so
+   explicitly and tells you what to do — follow that, and do not reach
+   for a browser. For GitHub specifically, raw.githubusercontent.com and
+   api.github.com give you the file contents directly and cost one round.
 
 2. **Stop when you have enough.** If web_search snippets already
    contain the specific facts the user asked about (dates, numbers,
@@ -962,6 +967,27 @@ Four failure modes that cost rounds:
    the dependent call next round. Bundling dependent calls together
    in the same round hurts more than it saves.
 
+4. **Never report a check you didn't run.** A ✅ / "verified" / "done"
+   in your final answer is a claim about a tool result you actually
+   received this turn. If you said you would test something and then
+   didn't, say that you didn't — an honest "configured but not tested"
+   is worth more than a green checklist that turns out to be false the
+   first time the user tries it.
+   Two specific traps:
+   - **Configured ≠ working.** Files on disk, a record created, a
+     config key set — these prove the write happened, not that the
+     thing functions. Installing a skill does not mean the agent can
+     run it: a skill's core tool (image_gen, web_search, tts) exists
+     only when that provider has credentials configured.
+   - **Don't narrate deliberation into the reply.** Planning what to
+     verify, second-guessing, "let me try X" — that's thinking, not
+     your answer. The user sees only the final message; make it the
+     conclusion, not the transcript.
+   When provisioning another agent (create_agent / install_skill /
+   configure_agent), finish with check_agent and report what it
+   actually said. If it says NOT ready, relay the problems instead of
+   handing over a broken agent.
+
 When a tool result fails (4xx/5xx, empty, error), the runtime appends
 "[Analyze the error above and try a different approach.]" — that
 means: switch source/strategy, do not just rotate URL components. If
```

---

### Incident Patch 7: `b35a50d0` (2026-07-24)
**Commit Message**: fix: harden binary upgrade and daemon process management

- replaceBinary: swap via temp file + rename instead of in-place
  overwrite; macOS caches code-signature validity per inode, so
  rewriting the existing file gets every subsequent launch SIGKILLed
  (Code Signature Invalid) even though codesign -vv passes. Rename
  also handles Windows, where a running exe can be renamed but not
  rewritten.
- upgrade: refuse to replace a from-source build (dev / -dirty /
  -N-g<sha>) with the release binary, which would silently downgrade;
  override with --force.
- WritePIDFile/RemovePIDFile: never clobber or delete a pidfile entry
  owned by a different live process — a second gateway losing the
  port-bind race used to erase the healthy instance's entry on exit,
  orphaning it from daemon stop/restart.
- daemon.Start: probe the port first and fail with a clear message
  when an untracked process (e.g. a foreground `fastclaw gateway`)
  already holds it, instead of crash-looping the gateway child.
- chat: warn on startup when the running gateway's version differs
  from the CLI binary, so a stale daemon after `make install` or
  `fastclaw upgrade` is visible instead of silently serving o

**File**: `cmd/fastclaw/cmd_chat.go` (modified, +28/-0)
```diff
@@ -2,6 +2,7 @@ package main
 
 import (
 	"context"
+	"encoding/json"
 	"errors"
 	"fmt"
 	"io"
@@ -138,6 +139,7 @@ func runChat(ctx context.Context, opts chatOptions) error {
 
 func ensureGateway(ctx context.Context, baseURL string, port int) error {
 	if gatewayReady(ctx, baseURL) {
+		warnVersionSkew(ctx, baseURL)
 		return nil
 	}
 	st, _ := daemon.GetStatus()
@@ -150,13 +152,39 @@ func ensureGateway(ctx context.Context, baseURL string, port int) error {
 	deadline := time.Now().Add(20 * time.Second)
 	for time.Now().Before(deadline) {
 		if gatewayReady(ctx, baseURL) {
+			warnVersionSkew(ctx, baseURL)
 			return nil
 		}
 		time.Sleep(200 * time.Millisecond)
 	}
 	return fmt.Errorf("gateway did not become ready at %s; check `fastclaw daemon logs`", baseURL)
 }
 
+// warnVersionSkew compares the running gateway's version against this
+// CLI binary and warns when they differ. The chat client reuses any
+// healthy gateway on the port, so after an upgrade or `make install`
+// the daemon keeps serving the OLD code until restarted — without this
+// check the only symptom is the agent reporting a stale version in
+// conversation. Best-effort: any probe failure is silently ignored.
+func warnVersionSkew(ctx context.Context, baseURL string) {
+	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, baseURL+"/api/status", nil)
+	client := &http.Client{Timeout: time.Second}
+	resp, err := client.Do(req)
+	if err != nil {
+		return
+	}
+	defer resp.Body.Close()
+	var st struct {
+		Version string `json:"version"`
+	}
+	if json.NewDecoder(resp.Body).Decode(&st) != nil {
+		return
+	}
+	if st.Version != "" && st.Version != version {
+		fmt.Fprintf(os.Stderr, "⚠ gateway is running FastClaw %s but this CLI is %s — run `fastclaw daemon restart` to pick up the new binary\n", st.Version, version)
+	}
+}
+
 func gatewayReady(ctx context.Context, baseURL string) bool {
 	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, baseURL+"/healthz", nil)
 	client := &http.Client{Timeout: 500 * time.Millisecond}
```

**File**: `cmd/fastclaw/cmd_version.go` (modified, +53/-4)
```diff
@@ -8,7 +8,9 @@ import (
 	"os"
 	"os/exec"
 	"path/filepath"
+	"regexp"
 	"runtime"
+	"strings"
 	"time"
 
 	"github.com/spf13/cobra"
@@ -31,17 +33,31 @@ func versionCmd() *cobra.Command {
 
 // upgradeCmd downloads and installs the latest release.
 func upgradeCmd() *cobra.Command {
-	return &cobra.Command{
+	var force bool
+	cmd := &cobra.Command{
 		Use:     "upgrade",
 		Aliases: []string{"update"},
 		Short:   "Upgrade FastClaw to the latest version",
 		RunE: func(cmd *cobra.Command, args []string) error {
-			return doUpgrade()
+			return doUpgrade(force)
 		},
 	}
+	cmd.Flags().BoolVar(&force, "force", false, "replace a from-source build with the release binary")
+	return cmd
+}
+
+// devBuildRE matches the `git describe` suffix of a from-source build
+// (e.g. v0.46.1-68-gcada95e): commits-ahead count plus g-prefixed SHA.
+var devBuildRE = regexp.MustCompile(`-\d+-g[0-9a-f]{7,}`)
+
+// isDevBuild reports whether v identifies a from-source build (plain
+// `go build`, or `make install` from a commit that isn't a release tag)
+// rather than a published release.
+func isDevBuild(v string) bool {
+	return v == "dev" || strings.HasSuffix(v, "-dirty") || devBuildRE.MatchString(v)
 }
 
-func doUpgrade() error {
+func doUpgrade(force bool) error {
 	const repo = "fastclaw-ai/fastclaw"
 	apiURL := fmt.Sprintf("https://api.github.com/repos/%s/releases/latest", repo)
 
@@ -75,6 +91,14 @@ func doUpgrade() error {
 		fmt.Printf("✅ Already up to date (%s)\n", version)
 		return nil
 	}
+
+	// A from-source build is usually AHEAD of the latest release; the
+	// tag-inequality check below can't tell newer from older, so without
+	// this guard `upgrade` silently downgrades a dev build.
+	if !force && isDevBuild(version) {
+		return fmt.Errorf("current binary %s is a from-source build; replacing it with release %s would likely be a downgrade.\nUse `make install` to update from source, or re-run with --force to install the release anyway", version, release.TagName)
+	}
+
 	fmt.Printf("📦 New version available: %s → %s\n", version, release.TagName)
 
 	// 3. Find the right asset for this platform
@@ -182,10 +206,35 @@ func doUpgrade() error {
 	return nil
 }
 
+// replaceBinary swaps dst for the binary at src via rename, never by
+// writing into the existing file: macOS caches code-signature validity
+// per inode, so an in-place overwrite leaves a stale cache entry and the
+// kernel SIGKILLs every subsequent launch even though `codesign -vv`
+// still passes. Renaming allocates a fresh inode and sidesteps the
+// cache; it is also the only way to replace a running exe on Windows,
+// which allows renaming but not rewriting.
 func replaceBinary(dst, src string) error {
 	srcData, err := os.ReadFile(src)
 	if err != nil {
 		return err
 	}
-	return os.WriteFile(dst, srcData, 0o755)
+	tmpNew := dst + ".new"
+	if err := os.WriteFile(tmpNew, srcData, 0o755); err != nil {
+		return err
+	}
+	old := dst + ".old"
+	os.Remove(old)
+	if err := os.Rename(dst, old); err != nil && !os.IsNotExist(err) {
+		os.Remove(tmpNew)
+		return err
+	}
+	if err := os.Rename(tmpNew, dst); err != nil {
+		os.Rename(old, dst)
+		os.Remove(tmpNew)
+		return err
+	}
+	// On Windows this fails while the old exe is still running; the
+	// leftover .old file is harmless and reclaimed on the next upgrade.
+	os.Remove(old)
+	return nil
 }
```

**File**: `internal/daemon/daemon.go` (modified, +34/-4)
```diff
@@ -3,6 +3,7 @@ package daemon
 import (
 	"errors"
 	"fmt"
+	"net"
 	"os"
 	"os/exec"
 	"path/filepath"
@@ -66,6 +67,16 @@ func Start(port int) error {
 		return fmt.Errorf("daemon already running (PID %d)", st.PID)
 	}
 
+	// The pidfile says nothing is running, but the port may still be
+	// held by a process we don't track (typically a foreground
+	// `fastclaw gateway` whose pidfile entry was lost). Starting the
+	// wrapper anyway would just crash-loop its gateway child on bind,
+	// so surface the conflict instead.
+	if conn, derr := net.DialTimeout("tcp", net.JoinHostPort("127.0.0.1", strconv.Itoa(port)), 500*time.Millisecond); derr == nil {
+		conn.Close()
+		return fmt.Errorf("port %d is already in use by a process the daemon does not manage (perhaps a foreground `fastclaw gateway`); stop it first: lsof -ti tcp:%d | xargs kill", port, port)
+	}
+
 	pidFile, logFile, logDir, err := Paths()
 	if err != nil {
 		return err
@@ -261,20 +272,39 @@ func Stop() error {
 }
 
 // WritePIDFile writes the current process PID. Called from runGateway.
+//
+// If the file already tracks a different LIVE process that is not our
+// parent, it is left untouched: a second gateway racing for a busy port
+// would otherwise clobber the healthy instance's entry and then delete
+// the file on its own exit, orphaning the running gateway from
+// `fastclaw daemon stop/restart`. The parent-pid exception keeps the
+// daemon flow intact — the wrapper (RunLoop) writes its own pid first
+// and the gateway child it spawns takes over the file, which is what
+// lets `daemon stop` signal the gateway directly.
 func WritePIDFile() error {
 	pidFile, _, _, err := Paths()
 	if err != nil {
 		return err
 	}
+	if pid, rerr := readPID(pidFile); rerr == nil &&
+		pid != os.Getpid() && pid != os.Getppid() && isProcessAlive(pid) {
+		return fmt.Errorf("pid file %s already tracks running process %d; not overwriting", pidFile, pid)
+	}
 	return writePID(pidFile, os.Getpid())
 }
 
-// RemovePIDFile removes the PID file. Called on clean shutdown.
+// RemovePIDFile removes the PID file, but only if it still records this
+// process — an exiting failed second instance must not delete the entry
+// of the healthy one. Called on clean shutdown.
 func RemovePIDFile() {
-	pidFile, _, _, _ := Paths()
-	if pidFile != "" {
-		os.Remove(pidFile)
+	pidFile, _, _, err := Paths()
+	if err != nil || pidFile == "" {
+		return
+	}
+	if pid, rerr := readPID(pidFile); rerr != nil || pid != os.Getpid() {
+		return
 	}
+	os.Remove(pidFile)
 }
 
 // SignalReload asks the gateway running at pid to reload its in-memory
```

---

### Incident Patch 8: `3c90638b` (2026-07-21)
**Commit Message**: Merge pull request #84 from cxhello/fix/delete-user-configs-column

fix(store): DeleteUser — configs has no user_id column, match scope_id

**File**: `internal/store/database.go` (modified, +7/-4)
```diff
@@ -2183,11 +2183,14 @@ func (d *DBStore) DeleteUser(ctx context.Context, id string) error {
 			return err
 		}
 	}
-	// Drop every config row owned by this user — both their own
-	// ('user_id=X, agent_id="') and any per-agent overrides they
-	// authored on someone else's agent ('user_id=X, agent_id=Y').
+	// Drop every config row owned by this user. configs has no user_id
+	// column — ownership lives in scope_id (scope="user" → scope_id=<uid>;
+	// per-user overrides authored on an agent → scope_id="<uid>/<agentID>").
+	// Mirror the agent-side delete above (scope_id = aid OR "%/"+aid) so we
+	// drop both this user's own rows and any overrides they authored.
 	if _, err := tx.ExecContext(ctx,
-		fmt.Sprintf("DELETE FROM configs WHERE user_id = %s", d.ph(1)), id); err != nil {
+		fmt.Sprintf("DELETE FROM configs WHERE scope_id = %s OR scope_id LIKE %s", d.ph(1), d.ph(2)),
+		id, id+"/%"); err != nil {
 		return err
 	}
 	if _, err := tx.ExecContext(ctx,
```

---

### Incident Patch 9: `a359b33a` (2026-07-21)
**Commit Message**: Merge pull request #86 from snowsword20/fix/cron-postgres-timezone

fix(cron): fire Postgres jobs on time by promoting time columns to timestamptz

**File**: `CHANGELOG.md` (added, +44/-0)
```diff
@@ -0,0 +1,44 @@
+# Changelog
+
+Notable changes to FastClaw. Items marked **BREAKING** require operator
+action on upgrade — read those notes before deploying.
+
+## [Unreleased]
+
+### Fixed
+
+- **Cron jobs fired ~hours late on Postgres when the server ran in a
+  non-UTC timezone.** The `cron_jobs` time columns were declared
+  `TIMESTAMP WITHOUT TIME ZONE`. A Go `time.Time` carrying a non-UTC
+  offset (e.g. `Asia/Shanghai`) was written with its offset silently
+  dropped, so a Beijing "09:00" job was stored as `09:00` and read back
+  as `09:00 UTC` = `17:00 Beijing` — firing 8h late (or, in the opposite
+  direction, never matching `next_run <= now()` at all). SQLite was
+  unaffected. The columns are now `TIMESTAMPTZ`, which preserves the
+  instant across write/read regardless of offset or session `TimeZone`.
+
+### BREAKING — cron schedule state is reset on upgrade (Postgres only)
+
+When a Postgres deployment runs the schema migration for the first time,
+**every existing row in `cron_jobs` is deleted.** This is deliberate:
+the stored `next_run` wall-clocks already carry the wrong timezone, so
+converting them would freeze the bug into the new column type. A clean
+reschedule is the correct recovery.
+
+- **What is lost:** pending scheduled jobs (recurring `cron`, `interval`,
+  and not-yet-fired `once` reminders).
+- **What is NOT lost:** chat history (`sessions`, `session_messages`),
+  agent identity files, provider/channel config — none of these are
+  touched.
+- **Operator action required:** after upgrading, any recurring schedule
+  a user relies on (e.g. "every day at 9am") must be recreated by asking
+  the agent again, or via the dashboard's Scheduler tab. The original
+  `create_cron_job` tool calls are still visible in chat history and can
+  serve as a reference for what to rebuild.
+- **Visibility:** the gateway logs a single
+  `level=WARN msg="resetting cron schedule state for timestamptz migration …"`
+  line with the row count before wiping, so operators can tell from the
+  upgrade log whether any jobs were affected.
+- **SQLite deployments:** unaffected — the migration is skipped entirely.
+- **Idempotent:** re-running the migration (e.g. on every daemon boot)
+  is a no-op once the columns are already `timestamptz`.
```

**File**: `internal/store/cron_pg_test.go` (added, +252/-0)
```diff
@@ -0,0 +1,252 @@
+package store
+
+import (
+	"context"
+	"database/sql"
+	"fmt"
+	"os"
+	"strings"
+	"testing"
+	"time"
+
+	_ "github.com/lib/pq"
+)
+
+// pgTestDSN is read from the environment to opt this test in. CI without a
+// Postgres instance skips; a developer running ./scripts/run-postgres.sh sets
+// it (the helper exports a matching DSN) to exercise the real backend.
+const pgTestDSNEnv = "FASTCLAW_TEST_PG_DSN"
+
+// openTestPG connects to the Postgres instance named by FASTCLAW_TEST_PG_DSN,
+// creates a uniquely-named throwaway database, and returns a migrated *DBStore
+// pointing at it plus a cleanup that drops the DB and closes the admin handle.
+// The fresh database means every test starts from a clean schema — the
+// timestamptz migration runs on CREATE TABLE + convert, exercising the same
+// path a brand-new install takes.
+func openTestPG(t *testing.T) (*DBStore, func()) {
+	t.Helper()
+	dsn := os.Getenv(pgTestDSNEnv)
+	if dsn == "" {
+		t.Skipf("%s not set — skipping Postgres integration test", pgTestDSNEnv)
+	}
+	// Connect to the maintenance DB (the DSN already targets a DB, but we need
+	// a server-level handle to CREATE the scratch database). Reuse the creds by
+	// rewriting the path to "postgres".
+	adminDSN := pgRewriteDB(dsn, "postgres")
+	admin, err := sql.Open("postgres", adminDSN)
+	if err != nil {
+		t.Fatalf("open admin conn: %v", err)
+	}
+	scratch := fmt.Sprintf("fc_test_%x", time.Now().UnixNano())
+	// DROP+CREATE: escape the identifier just in case, though the name is hex.
+	if _, err := admin.Exec(fmt.Sprintf(`DROP DATABASE IF EXISTS %q`, scratch)); err != nil {
+		admin.Close()
+		t.Fatalf("drop scratch db: %v", err)
+	}
+	if _, err := admin.Exec(fmt.Sprintf(`CREATE DATABASE %q`, scratch)); err != nil {
+		admin.Close()
+		t.Fatalf("create scratch db: %v", err)
+	}
+	storeDSN := pgRewriteDB(dsn, scratch)
+	st, err := NewDBStore("postgres", storeDSN)
+	if err != nil {
+		admin.Exec(fmt.Sprintf(`DROP DATABASE IF EXISTS %q`, scratch))
+		admin.Close()
+		t.Fatalf("open store: %v", err)
+	}
+	if err := st.Migrate(context.Background()); err != nil {
+		st.Close()
+		admin.Exec(fmt.Sprintf(`DROP DATABASE IF EXISTS %q`, scratch))
+		admin.Close()
+		t.Fatalf("migrate: %v", err)
+	}
+	cleanup := func() {
+		st.Close()
+		_, _ = admin.Exec(fmt.Sprintf(`DROP DATABASE IF EXISTS %q`, scratch))
+		admin.Close()
+	}
+	return st, cleanup
+}
+
+// pgRewriteDB returns a copy of a lib/pq DSN with the database path replaced
+// by newDB. It handles both the "postgres://…/dbname?…" URL form and the
+// "host=… dbname=…" keyword form. Used to retarget a connection at the
+// maintenance "postgres" DB or a per-test scratch DB.
+func pgRewriteDB(dsn, newDB string) string {
+	// URL form: scheme://user:pass@host:port/dbname?params
+	if i := strings.Index(dsn, "://"); i >= 0 {
+		pathStart := i + 3
+		// find start of path after the authority (first '/' after host[:port])
+		slash := strings.IndexByte(dsn[pathStart:], '/')
+		if slash < 0 {
+			return dsn + "/" + newDB
+		}
+		slash += pathStart
+		query := strings.IndexByte(dsn[slash+1:], '?')
+		if query < 0 {
+			return dsn[:slash+1] + newDB
+		}
+		return dsn[:slash+1] + newDB + dsn[slash+1+query:]
+	}
+	// Keyword form: replace dbname=… value (space-terminated).
+	if k := strings.Index(dsn, "dbname="); k >= 0 {
+		rest := dsn[k+len("dbname="):]
+		sp := strings.IndexByte(rest, ' ')
+		if sp < 0 {
+			return dsn[:k] + "dbname=" + newDB
+		}
+		return dsn[:k] + "dbname=" + newDB + rest[sp:]
+	}
+	return dsn + " dbname=" + newDB
+}
+
+// TestCronJobsPGTimestampTZ verifies the timezone fix on Postgres. The cron
+// schedule columns must be timestamptz so a Go time.Time carrying a non-UTC
+// offset survives the write/read round-trip as the exact same instant.
+//
+// This is the regression guard for the bug where a Beijing-time "09:00" job
+// was stored as 09:00 wall-clock and reinterpreted as 09:00 UTC = 17:00
+// Beijing, firing 8h late. Before the fix
```

**File**: `internal/store/database.go` (modified, +111/-0)
```diff
@@ -174,6 +174,13 @@ func (d *DBStore) Migrate(ctx context.Context) error {
 	if err := d.migrateConfigsDropLegacyColumns(ctx); err != nil {
 		return fmt.Errorf("migrate configs drop legacy columns: %w", err)
 	}
+	// Promote cron_jobs time columns to timestamptz. Runs last among the
+	// cron_jobs migrations so the table has its final column shape before
+	// the type conversion (ADD COLUMN works on any column type, so the
+	// earlier failure_count / user_id steps don't depend on this one).
+	if err := d.migrateCronJobsTimestampTZ(ctx); err != nil {
+		return fmt.Errorf("migrate cron_jobs timestamptz: %w", err)
+	}
 	return nil
 }
 
@@ -981,6 +988,110 @@ func (d *DBStore) migrateCronJobsFailureCount(ctx context.Context) error {
 	return nil
 }
 
+// migrateCronJobsTimestampTZ fixes the timezone bug on the cron schedule
+// columns. The time columns (next_run, last_run, locked_at, created_at)
+// were declared TIMESTAMP without time zone. lib/pq sends each Go
+// time.Time to the server carrying its original zone offset
+// ("2006-01-02 15:04:05.999999999Z07:00"), but a TIMESTAMP-without-tz
+// column silently drops the offset and keeps only the wall-clock text.
+// Reading it back yields a UTC instant whose wall-clock equals the
+// chatter's local wall-clock — so a "09:00 Asia/Shanghai" job is stored
+// as 09:00 and reinterpreted as 09:00 UTC = 17:00 Beijing, firing 8h
+// late. SQLite is unaffected (its driver stores the full instant).
+//
+// Fix: promote the columns to timestamptz. That type preserves the
+// instant across write/read regardless of offset or session TimeZone
+// (verified end-to-end against lib/pq). This is Postgres-only; SQLite
+// has no separate timestamptz type and already stores instants losslessly.
+//
+// Existing rows are wiped rather than converted: their stored
+// wall-clocks are wrong (offset already dropped), so any conversion
+// would just freeze the bug into the new type. Truncating is safe here
+// because cron rows are ephemeral schedule state, not history — the
+// scheduler rewrites next_run on every fire and deletes "once" rows
+// after firing, so a clean reschedule is the correct recovery and
+// cheaper than per-row guesswork.
+//
+// Idempotent: the probe on pg_catalog.format_type short-circuits once a
+// column is already timestamptz, so re-runs and fresh installs are no-ops.
+// On SQLite the tableHasColumnType probe returns (false, nil) and the
+// whole step is skipped.
+func (d *DBStore) migrateCronJobsTimestampTZ(ctx context.Context) error {
+	if d.dialect != "postgres" {
+		return nil
+	}
+	cols := []string{"next_run", "last_run", "locked_at", "created_at"}
+	needConvert := false
+	for _, col := range cols {
+		isTZ, err := d.columnIsTimestampTZ(ctx, "cron_jobs", col)
+		if err != nil {
+			return fmt.Errorf("probe cron_jobs.%s type: %w", col, err)
+		}
+		if !isTZ {
+			needConvert = true
+			break
+		}
+	}
+	if !needConvert {
+		return nil
+	}
+	// Count first so the upgrade is observable: a non-zero count tells an
+	// operator that existing schedule state is about to be wiped and must be
+	// recreated (see CHANGELOG). The count is logged before the TRUNCATE so
+	// it survives even if the type conversion that follows were to fail.
+	var wiping int
+	if err := d.db.QueryRowContext(ctx, `SELECT count(*) FROM cron_jobs`).Scan(&wiping); err != nil {
+		return fmt.Errorf("count cron_jobs before tz migration: %w", err)
+	}
+	if wiping > 0 {
+		slog.Warn("resetting cron schedule state for timestamptz migration — existing jobs must be recreated",
+			"rows", wiping,
+			"reason", "stored next_run values carry the pre-fix wrong timezone; see CHANGELOG")
+	}
+	// Wipe the schedule state in place, then widen the columns. Doing the
+	// DELETE before the ALTER means the type change is instant on an empty
+	// table (no heap rewrite), and there are no stale rows to convert.
+	if _, err := d.db.ExecContext(ctx, `TRUNCATE TABLE cron_jobs`); err != nil {
+		return fmt.Errorf("trun
```

---

### Incident Patch 10: `ce41d18f` (2026-07-21)
**Commit Message**: Merge pull request #95 from zengxishenggmail/fix/tool-fail-stall-timeout

Fix stall detection and error-context loss in the ReAct loop

**File**: `internal/agent/events.go` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ import (
 
 // ChatEvent represents a real-time event emitted during the agent ReAct loop.
 type ChatEvent struct {
-	Type string         `json:"type"` // "content", "content_delta", "tool_call", "tool_result", "steer", "error", "done", "turn_pending", "subagent_progress"
+	Type string         `json:"type"` // "content", "content_delta", "tool_call", "tool_result", "tool_progress", "status", "steer", "error", "done", "turn_pending", "subagent_progress"
 	Data map[string]any `json:"data,omitempty"`
 }
 
```

**File**: `internal/agent/loop.go` (modified, +262/-7)
```diff
@@ -1880,6 +1880,173 @@ func llmRetry(ctx context.Context, label string, fn func(context.Context) (*prov
 	return nil, lastErr
 }
 
+// sameToolFailStreakLimit and softDeadlineFraction gate the two stall-
+// prevention mechanisms added per fastclaw-timeout-error-root-cause-
+// analysis.md (P0.1 / P1). sameToolFailStreakLimit is intentionally
+// tighter than the pre-existing allFailedRounds/failedRoundsLimit (3):
+// "the same tool failed twice in a row, even with different arguments"
+// is a stronger unproductive-loop signal than "some tool in the round
+// failed", and should trip sooner. softDeadlineFraction leaves ~20% of
+// the turn's wall-time budget as headroom for one more full LLM
+// round-trip + response after the wrap-up nudge fires.
+const sameToolFailStreakLimit = 2
+const softDeadlineFraction = 0.20
+
+// toolProgressInterval is how often runToolsWithProgress emits a
+// "tool_progress" heartbeat while a tool-execution round is in flight.
+const toolProgressInterval = 8 * time.Second
+
+// sameToolFailStreakState is the running state for the P0.1 same-tool-
+// repeated-failure detector, threaded through updateSameToolFailStreak
+// across a turn's tool-result processing. Extracted into a small pure
+// struct + function (rather than three loose local vars mutated inline
+// in both HandleMessage and HandleMessageStream) specifically so the
+// counting/reset rules have one implementation and can be unit-tested
+// directly — see TestUpdateSameToolFailStreak in loop_stall_test.go.
+// Building a full fake-Provider/Agent harness to exercise this inline
+// would have required far more scaffolding than the pure-function
+// extraction costs.
+type sameToolFailStreakState struct {
+	streak          int
+	lastFailedTool  string
+	lastFailureText string
+}
+
+// updateSameToolFailStreak folds one tool-result's outcome into the
+// running streak and returns the updated state. failed should come
+// from isFailedToolResult; summary is the one-line failure description
+// to remember for buildFallbackReply (ignored when failed is false).
+//
+// Rules:
+//   - Same tool, still failing: streak increments.
+//   - A different tool starts failing: streak resets to 1, the
+//     tracked tool switches to this one.
+//   - The tool whose streak we're tracking now succeeds: streak resets
+//     to 0, tracked tool cleared.
+//   - Some other (not currently tracked) tool succeeds: no change —
+//     this call doesn't concern the tool we're tracking.
+func updateSameToolFailStreak(state sameToolFailStreakState, toolName string, failed bool, summary string) sameToolFailStreakState {
+	if failed {
+		if toolName == state.lastFailedTool {
+			state.streak++
+		} else {
+			state.streak = 1
+			state.lastFailedTool = toolName
+		}
+		state.lastFailureText = summary
+		return state
+	}
+	if toolName == state.lastFailedTool {
+		state.streak = 0
+		state.lastFailedTool = ""
+	}
+	return state
+}
+
+// buildFallbackReply assembles a context-aware message when a turn is
+// cut short by an error, instead of the old static string that
+// discarded every diagnostic clue the agent had already gathered.
+// Modeled on the pattern already used in subagent.go's DeadlineExceeded
+// handling (see runSubagentLoop) — that path already surfaces "ran out
+// of its N-minute wall-time budget" instead of a canned string; this
+// brings loop.go's two top-level paths (HandleMessage,
+// HandleMessageStream) up to the same standard.
+//
+// replyParts may be nil/empty (HandleMessageStream doesn't accumulate
+// reply text the way HandleMessage does) — handled gracefully.
+func buildFallbackReply(err error, replyParts []string, lastToolName, lastToolFailure string) string {
+	timedOut := errors.Is(err, context.DeadlineExceeded) || errors.Is(err, context.Canceled)
+	var sb strings.Builder
+	if len(replyParts) > 0 {
+		sb.WriteString(joinReplyParts(replyParts))
+		sb.WriteString("\n\n")
+	}
+	switch {
+	case timedOut && lastToolName != "":
+		fmt
```

**File**: `internal/agent/loop_stall_test.go` (added, +232/-0)
```diff
@@ -0,0 +1,232 @@
+package agent
+
+import (
+	"context"
+	"errors"
+	"strings"
+	"testing"
+	"time"
+
+	"github.com/fastclaw-ai/fastclaw/internal/provider"
+)
+
+// Tests for the P0.3 / P1 additions from fastclaw-timeout-error-root-
+// cause-analysis.md: buildFallbackReply (context-aware fallback instead
+// of a static string) and maybeInjectSoftDeadlineWarning (soft-deadline
+// heartbeat). Both are pure functions taking plain arguments, so they're
+// unit-tested directly without needing a full Agent/Provider harness.
+
+const staleGenericFallback = "Sorry, I encountered an error processing your request."
+
+func TestBuildFallbackReply_TimeoutWithKnownFailingTool(t *testing.T) {
+	got := buildFallbackReply(context.DeadlineExceeded, nil, "browser-use --doctor", "FAIL chrome running / FAIL daemon alive")
+	if got == staleGenericFallback {
+		t.Fatalf("expected a context-aware message, got the stale generic string")
+	}
+	if !strings.Contains(got, "browser-use --doctor") {
+		t.Errorf("expected the failing tool name in the reply, got %q", got)
+	}
+	if !strings.Contains(got, "FAIL chrome running") {
+		t.Errorf("expected the tool's failure summary in the reply, got %q", got)
+	}
+}
+
+func TestBuildFallbackReply_CanceledWithKnownFailingTool(t *testing.T) {
+	// context.Canceled must be treated the same as DeadlineExceeded —
+	// both are "timed out" from buildFallbackReply's perspective.
+	got := buildFallbackReply(context.Canceled, nil, "exec", "exit status 127: not found")
+	if got == staleGenericFallback {
+		t.Fatalf("expected a context-aware message, got the stale generic string")
+	}
+	if !strings.Contains(got, "exec") {
+		t.Errorf("expected the failing tool name in the reply, got %q", got)
+	}
+}
+
+func TestBuildFallbackReply_TimeoutWithoutKnownTool(t *testing.T) {
+	// Timed out before any tool failure was recorded (e.g. the very
+	// first LLM call in the turn hung) — no tool name to reference, but
+	// still must not be the stale generic string.
+	got := buildFallbackReply(context.DeadlineExceeded, nil, "", "")
+	if got == staleGenericFallback {
+		t.Fatalf("expected a distinct timeout message, got the stale generic string")
+	}
+	if !strings.Contains(strings.ToLower(got), "time") {
+		t.Errorf("expected the reply to mention running out of time, got %q", got)
+	}
+}
+
+func TestBuildFallbackReply_NonTimeoutErrorIncludesErrorText(t *testing.T) {
+	// A non-context error (e.g. a transient 5xx that exhausted retries)
+	// should surface the actual error, not a content-free static string.
+	err := errors.New("API error 402: Insufficient Balance")
+	got := buildFallbackReply(err, nil, "", "")
+	if got == staleGenericFallback {
+		t.Fatalf("expected the underlying error text, got the stale generic string")
+	}
+	if !strings.Contains(got, "Insufficient Balance") {
+		t.Errorf("expected the underlying error text in the reply, got %q", got)
+	}
+}
+
+func TestBuildFallbackReply_PreservesReplyPartsWhenPresent(t *testing.T) {
+	// HandleMessage accumulates replyParts across iterations; when a
+	// later iteration times out, any earlier assistant text already
+	// produced this turn should still reach the user instead of being
+	// discarded.
+	parts := []string{"Here's what I found so far: X and Y."}
+	got := buildFallbackReply(context.DeadlineExceeded, parts, "web_fetch", "connection refused")
+	if !strings.Contains(got, "Here's what I found so far: X and Y.") {
+		t.Errorf("expected prior reply parts to be preserved, got %q", got)
+	}
+}
+
+func TestBuildFallbackReply_NilReplyPartsIsSafe(t *testing.T) {
+	// HandleMessageStream doesn't accumulate replyParts at all and
+	// passes nil — must not panic and must not print anything for the
+	// (absent) prior content.
+	got := buildFallbackReply(context.DeadlineExceeded, nil, "exec", "boom")
+	if strings.Contains(got, "<nil>") {
+		t.Errorf("nil replyParts leaked into output: %q", got)
+	}
+}
+
+func TestMaybeInjectSoftDeadlineWarning_NoDeadlineNeverFires(t *testing.T) {
+	ct
```

#### Recent Merged Pull Requests:
- **PR #115** (closed): fix: fall back to execCommand for clipboard on insecure origins (@pengzh1)
- **PR #114** (closed): fix: maintain Mcp-Session-Id across MCP HTTP requests (@pengzh1)
- **PR #113** (closed): fix: handle SSE responses and send Accept header in MCP HTTP client (@pengzh1)
- **PR #112** (closed): fix: accept SSE data lines without a space after the colon (@pengzh1)
- **PR #109** (closed): Feat/wire spawn subagent (@M0yuW)
- **PR #104** (2026-07-21): fix: before_model_call hook messages modification not taking effect (#103) (@cxxCoolStar)
- **PR #102** (2026-07-21): fix(setup): resolve masked skill secrets to stored originals on confi… (@cxxCoolStar)
- **PR #101** (2026-07-21): feat(workspace): 会话级 workspace 版本历史（git 快照，可回滚） (@cxxCoolStar)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
