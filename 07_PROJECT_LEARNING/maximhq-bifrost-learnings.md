# Forensic Learning Record (Deep Inspection): maximhq/bifrost

> **Canonical Artifact**: `07_PROJECT_LEARNING/maximhq-bifrost-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/maximhq/bifrost](https://github.com/maximhq/bifrost))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:39:56.422Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `maximhq/bifrost`
- **Description**: Fastest enterprise AI gateway (50x faster than LiteLLM) with adaptive load balancer, cluster mode, guardrails, 1000+ models support & <100 µs overhead at 5k RPS.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 8475 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cli/internal/agentapi/client.go`
```
// Package agentapi provides typed access to user-scoped Enterprise agent APIs.
package agentapi

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/maximhq/bifrost/cli/internal/client"
)

// Client calls Enterprise agent endpoints through the shared authenticated transport.
type Client struct {
	transport *client.Client
}

// New creates a typed agent API client that inherits token refresh behavior.
func New(transport *client.Client) *Client {
	return &Client{transport: transport}
}

// ListVirtualKeys returns the active virtual keys assigned to the signed-in user.
func (c *Client) ListVirtualKeys(ctx context.Context) (VirtualKeyListResponse, error) {
	var result VirtualKeyListResponse
	if c == nil || c.transport == nil {
		return result, fmt.Errorf("agent API client is unavailable")
	}
	response, err := c.transport.Do(ctx, client.Request{Path: "/api/agent/virtual-keys", Auth: client.AuthAgent})
	if err != nil {
		return result, err
	}
	if err := json.Unmarshal(response.Body, &result); err != nil {
		return result, fmt.Errorf("decode assigned virtual keys: %w", err)
	}
	return result, nil
}

// GetUsageSummary returns the signed-in user's budgets, rate limits, and rankings.
func (c *Client) GetUsageSummary(ctx context.Context) (UsageSummaryResponse, error) {
	var result UsageSummaryResponse
	if c == nil || c.transport == nil {
		return result, fmt.Errorf("agent API client is unavailable")
	}
	response, err := c.transport.Do(ctx, client.Request{Path: "/api/agent/usage-summary", Auth: client.AuthAgent})
	if err != nil {
		return result, err
	}
	if err := json.Unmarshal(response.Body, &result); err != nil {
		return result, fmt.Errorf("decode usage summary: %w", err)
	}
	return result, nil
}

```

### Core Architecture Module: `cli/internal/agentapi/types.go`
```
package agentapi

import "time"

// VirtualKeyListResponse is the user-scoped assigned-key response.
type VirtualKeyListResponse struct {
	VirtualKeys          []VirtualKey `json:"virtual_keys"`
	SelectedVirtualKeyID string       `json:"selected_virtual_key_id"`
	ForcedVirtualKeyID   string       `json:"forced_virtual_key_id"`
}

// VirtualKey describes a selectable key without containing its secret value.
type VirtualKey struct {
	ID              string   `json:"id"`
	Name            string   `json:"name"`
	Description     string   `json:"description,omitempty"`
	IsActive        bool     `json:"is_active"`
	Providers       []string `json:"providers"`
	Budgets         []Budget `json:"budgets"`
	BudgetLimit     float64  `json:"budget_limit"`
	BudgetConsumed  float64  `json:"budget_consumed"`
	BudgetAvailable float64  `json:"budget_available"`
}

// Budget describes one budget attached to an assigned virtual key.
type Budget struct {
	ID              string    `json:"id"`
	BudgetLimit     float64   `json:"budget_limit"`
	BudgetConsumed  float64   `json:"budget_consumed"`
	BudgetAvailable float64   `json:"budget_available"`
	ResetDuration   string    `json:"reset_duration"`
	LastReset       time.Time `json:"last_reset"`
}

// UsageSummaryResponse is the user-scoped budget and usage response.
type UsageSummaryResponse struct {
	Budgets     []UsageBudget    `json:"budgets"`
	RateLimits  []UsageRateLimit `json:"rate_limits"`
	Budget      UsageBudget      `json:"budget"`
	TopModels   []UsageRow       `json:"top_models"`
	TopApps     []UsageRow       `json:"top_apps"`
	GeneratedAt time.Time        `json:"generated_at"`
	Window      UsageWindow      `json:"window"`
}

// UsageLimitSource identifies the access profile and scope that owns a limit.
type UsageLimitSource struct {
	AccessProfileID   uint   `json:"access_profile_id,omitempty"`
	AccessProfileName string `json:"access_profile_name,omitempty"`
	Scope             string `json:"scope,omitempty"`
	Provider          string `json:"provider,omitempty"`
	Model             string `json:"model,omitempty"`
}

// UsageBudget describes one monetary budget visible to the current user.
type UsageBudget struct {
	UsageLimitSource
	ID            string     `json:"id,omitempty"`
	ResetDuration string     `json:"reset_duration,omitempty"`
	Used          float64    `json:"used"`
	Limit         float64    `json:"limit"`
	Available     float64    `json:"available"`
	ResetAt       *time.Time `json:"reset_at,omitempty"`
}

// UsageRateLimit keeps token and request counters independent.
type UsageRateLimit struct {
	UsageLimitSource
	ID       string            `json:"id"`
	Tokens   *UsageRateCounter `json:"tokens,omitempty"`
	Requests *UsageRateCounter `json:"requests,omitempty"`
}

// UsageRateCounter retains exact integer counts from the gateway response.
type UsageRateCounter struct {
	Used          int64      `json:"used"`
	Limit         int64      `json:"limit"`
	Available     int64      `json:"available"`
	ResetDuration string     `json:"reset_duration"`
	ResetAt       *time.Time `json:"reset_at,omitempty"`
}

// UsageRow describes one ranked model or application.
type UsageRow struct {
	Label         string  `json:"label"`
	Provider      string  `json:"provider,omitempty"`
	TotalRequests int64   `json:"total_requests"`
	TotalTokens   int64   `json:"total_tokens"`
	TotalCost     float64 `json:"total_cost"`
}

// UsageWindow describes the log interval used for usage rankings.
type UsageWindow struct {
	Start *time.Time `json:"start,omitempty"`
	End   *time.Time `json:"end,omitempty"`
}

```

### Core Architecture Module: `cli/internal/apis/models.go`
```
package apis

import (
	"fmt"
	"net/url"
	"sort"
	"strings"

	"github.com/bytedance/sonic"
)

// Model represents a single model entry returned by the /v1/models API.
type Model struct {
	ID string `json:"id"`
}

type listModelsResp struct {
	Data []Model `json:"data"`
}

// NormalizeBaseURL trims whitespace and trailing slashes from a base URL.
func NormalizeBaseURL(raw string) string {
	raw = strings.TrimSpace(raw)
	raw = strings.TrimSuffix(raw, "/")
	return raw
}

// BuildEndpoint joins a base URL with a path suffix, returning the full endpoint URL.
func BuildEndpoint(baseURL, suffix string) (string, error) {
	baseURL = NormalizeBaseURL(baseURL)
	u, err := url.Parse(baseURL)
	if err != nil {
		return "", fmt.Errorf("invalid base url: %w", err)
	}
	if u.Scheme == "" || u.Host == "" {
		return "", fmt.Errorf("invalid base url %q", baseURL)
	}
	u.Path = strings.TrimSuffix(u.Path, "/") + suffix
	return u.String(), nil
}

// ParseModels returns the sorted, de-duplicated model IDs from /v1/models.
func ParseModels(body []byte) ([]string, error) {
	var parsed listModelsResp
	if err := sonic.Unmarshal(body, &parsed); err != nil {
		return nil, fmt.Errorf("parse model response: %w", err)
	}

	set := map[string]struct{}{}
	for _, m := range parsed.Data {
		id := strings.TrimSpace(m.ID)
		if id == "" {
			continue
		}
		set[id] = struct{}{}
	}
	models := make([]string, 0, len(set))
	for m := range set {
		models = append(models, m)
	}
	sort.Strings(models)
	return models, nil
}

```

### Core Architecture Module: `cli/internal/app/app.go`
```
package app

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/maximhq/bifrost/cli/internal/apis"
	"github.com/maximhq/bifrost/cli/internal/browserauth"
	"github.com/maximhq/bifrost/cli/internal/client"
	"github.com/maximhq/bifrost/cli/internal/config"
	"github.com/maximhq/bifrost/cli/internal/harness"
	"github.com/maximhq/bifrost/cli/internal/installer"
	"github.com/maximhq/bifrost/cli/internal/mcp"
	"github.com/maximhq/bifrost/cli/internal/runtime"
	"github.com/maximhq/bifrost/cli/internal/secrets"
	"github.com/maximhq/bifrost/cli/internal/sessionauth"
	"github.com/maximhq/bifrost/cli/internal/ui/logo"
	"github.com/maximhq/bifrost/cli/internal/ui/tui"
	"github.com/maximhq/bifrost/cli/internal/update"
	"golang.org/x/term"
)

// Options holds the CLI flags and build metadata passed to the application.
type Options struct {
	Version  string
	Commit   string
	NoResume bool
	Tabs     bool
	Config   string
	Worktree string
}

// App is the main Bifrost CLI application. It manages configuration, state,
// and the interactive TUI loop for selecting and launching harnesses.
type App struct {
	in      io.Reader
	out     io.Writer
	errOut  io.Writer
	opts    Options
	state   *config.State
	cfgFile *config.FileConfig
	// sessionStore and httpClient are injectable seams for the SSO-backed model
	// discovery path; production uses the OS keyring and default HTTP transport.
	sessionStore sessionauth.SessionStore
	httpClient   *http.Client
	openBrowser  func(string) error

	statePath    string
	configPath   string
	configSource string
	bootHeader   string
}

// New creates a new App instance with the given I/O streams and options.
func New(in io.Reader, out, errOut io.Writer, opts Options) *App {
	return &App{
		in:     in,
		out:    out,
		errOut: errOut,
		opts:   opts,
	}
}

// Run starts the interactive TUI loop. It loads config and state, then presents
// the chooser, launches the selected harness with native terminal passthrough
// by default, and returns to the chooser when the harness exits. Tabs remains
// available as an opt-in compatibility mode.
func (a *App) Run(ctx context.Context) error {
	if err := a.loadStateAndConfig(); err != nil {
		return err
	}

	updateCh := update.CheckInBackground(a.opts.Version, a.statePath)

	activeProfile := a.getOrCreateProfile()
	if activeProfile == nil {
		return errors.New("failed to initialize profile")
	}

	vk, err := secrets.GetVirtualKey(activeProfile.ID)
	if err != nil {
		fmt.Fprintf(a.errOut, "warning: %v\n", err)
	}
	if vk == "" && a.cfgFile != nil && strings.TrimSpace(a.cfgFile.VirtualKey) != "" {
		if err := secrets.SetVirtualKey(activeProfile.ID, strings.TrimSpace(a.cfgFile.VirtualKey)); err == nil {
			vk = strings.TrimSpace(a.cfgFile.VirtualKey)
			a.cfgFile.VirtualKey = ""
			if a.configPath != "" {
				if err := config.SaveConfig(a.configPath, a.cfgFile); err != nil {
					fmt.Fprintf(a.errOut, "warning: save config after key migration: %v\n", err)
				}
			}
		} else {
			fmt.Fprintf(a.errOut, "warning: %v\n", err)
		}
	}

	selection := a.state.Selections[activeProfile.ID]
	if a.opts.NoResume {
		selection = config.Selection{}
	}

	// Seed defaults from config if state has no selection
	if a.cfgFile != nil {
		if selection.Harness == "" {
			selection.Harness = strings.TrimSpace(a.cfgFile.DefaultHarness)
		}
		if selection.Model == "" {
			selection.Model = strings.TrimSpace(a.cfgFile.DefaultModel)
		}
	}

	worktree := strings.TrimSpace(a.opts.Worktree)
	var updateVersion string
	enterpriseSSOAvailability := make(map[string]bool)
	enterpriseSSOChecked := make(map[string]bool)
	resolveEnterpriseSSOAvailability := func(checkCtx context.Context, baseURL string) bool {
		baseURL = strings.TrimSpace(baseURL)
		if enterpriseSSOChecked[baseURL] {
			return enterpriseSSOAvailability[baseURL]
		}
		available := a.enterpriseSSOAvailable(checkCtx, baseURL)
		enterpriseSSOChecked[baseURL] = true
		enterpriseSSOAvailability[baseURL] = available
		return available
	}

	// chooseAndPrepare runs the chooser TUI, handles installation flows,
	// persists state, and returns a launch spec. Loops internally until
	// the user picks a valid harness or quits.
	chooseAndPrepare := func(chooserCtx context.Context, notify func(runtime.TabNoticeLevel, string), tabBarLine func() string, stdinReader io.Reader, msg string, isAfterSession bool, seed *runtime.LaunchSpec) (*runtime.LaunchSpec, error) {
		seedApplied := false
		for {
			harnesses := a.harnessOptions()
			baseURL := activeProfile.BaseURL
			currentVK := vk
			currentSelection := selection
			currentWorktree := worktree
			if seed != nil && !seedApplied {
				baseURL = seed.BaseURL
				currentVK = seed.VirtualKey
				currentSelection.Harness = seed.Harness.ID
				currentSelection.Model = seed.Model
				currentWorktree = seed.Worktree
				seedApplied = true
			}
			enterpriseSSOAvailable := resolveEnterpriseSSOAvailability(chooserCtx, baseURL)
			agentToken, tokenErr := a.agentSessionStore().Get(activeProfile.ID, secrets.AgentToken)
			if tokenErr != nil {
				_, _ = fmt.Fprintf(a.errOut, "warning: load Enterprise SSO session: %v\n", tokenErr)
			}
			agentIdentity := ""
			if strings.TrimSpace(agentToken) != "" {
				identity, identityErr := sessionauth.StoredUserLabel(a.agentSessionStore(), activeProfile.ID)
				if identityErr != nil {
					_, _ = fmt.Fprintf(a.errOut, "warning: load Enterprise SSO identity: %v\n", identityErr)
				} else {
					agentIdentity = identity
				}
			}

			reservedRows := 0
			if tabBarLine != nil {
				reservedRows = 1
			}
			choice, err := tui.RunChooser(tui.ChooserConfig{
				Version:                a.opts.Version,
				Commit:                 a.opts.Commit,
				ConfigSrc:              a.configSource,
				Message:                msg,
				UpdateVersion:          updateVersion,
				BaseURL:                baseURL,
				VirtualKey:             currentVK,
				EnterpriseSSOAvailable: enterpriseSSOAvailable,
				AgentSignedIn: strings.TrimSpace(agentToken) != "" &&
					strings.TrimSpace(baseURL) == strings.TrimSpace(activeProfile.BaseURL),
				AgentIdentity: agentIdentity,
				Harness:       currentSelection.Harness,
				Model:         currentSelection.Model,
				Worktree:      currentWorktree,
				AfterSession:  isAfterSession,
				ReservedRows:  reservedRows,
				Harnesses:     harnesses,
				TabBarLine:    tabBarLine,
				FetchModels: func(fetchCtx context.Context, requestedBaseURL, requestedVirtualKey string) ([]string, error) {
					return a.listModels(fetchCtx, activeProfile.ID, activeProfile.BaseURL, requestedBaseURL, requestedVirtualKey)
				},
				Input: stdinReader,
				Notify: func(message string, isError bool) {
					level := runtime.TabNoticeInfo
					if isError {
						level = runtime.TabNoticeError
					}
					if notify != nil {
						notify(level, message)
					}
				},
			})
			if err != nil {
				return nil, err
			}
			if choice.BackToTabs {
				return nil, runtime.ErrBackToTabs
			}
			if choice.UpdateRequested {
				return nil, runtime.ErrUpdateRequested
			}
			if choice.Quit {
				return nil, nil
			}

			previousBaseURL := strings.TrimSpace(activeProfile.BaseURL)
			newBaseURL := strings.TrimSpace(choice.BaseURL)
			if newBaseURL != previousBaseURL {
				// A session belongs to the origin where it was issued. Revoke it
				// against the old gateway and clear local state before persisting
				// the edited URL, so a later chooser cycle cannot reuse it.
				if logoutErr := a.updateProfileBaseURL(ctx, activeProfile, newBaseURL); logoutErr != nil {
					var revocationErr *sessionauth.RevocationError
					if !errors.As(logoutErr, &revocationErr) {
						msg = "Could not change gateway URL: " + logoutErr.Error()
						isAfterSession = false
						continue
					}
					_, _ = fmt.Fprintf(a.errOut, "warning: %v\n", logoutErr)
				}
			} else {
				activeProfile.BaseURL = newBaseURL
			}
			selection.Harness = strings.TrimSpace(choice.Harness)
			selection.Model = strings.Tri
```

### Core Architecture Module: `cli/internal/app/reexec_unix.go`
```
//go:build !windows

package app

import "syscall"

// reexecSelf replaces the current process with the updated binary.
// On Unix, this uses execve(2) via syscall.Exec.
func reexecSelf(execPath string, args []string, env []string) error {
	return syscall.Exec(execPath, args, env)
}

```

### Core Architecture Module: `cli/internal/app/reexec_windows.go`
```
//go:build windows

package app

import "fmt"

// reexecSelf on Windows cannot replace the running process (syscall.Exec is a
// stub that returns EWINDOWS). Instead, inform the user to restart manually.
func reexecSelf(_ string, _ []string, _ []string) error {
	fmt.Println("Updated successfully. Please restart bifrost.")
	return nil
}

```

### Core Architecture Module: `cli/internal/browserauth/browserauth.go`
```
// Package browserauth implements Enterprise browser SSO for the Bifrost CLI.
package browserauth

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os/exec"
	"runtime"
	"strings"
	"time"

	"github.com/maximhq/bifrost/cli/internal/client"
)

const (
	clientID               = "bifrost-agent"
	callbackPath           = "/callback"
	defaultLoginWait       = 5 * time.Minute
	defaultExchangeTimeout = 30 * time.Second
	defaultShutdownTimeout = 2 * time.Second
	maxResponseBytes       = 1 << 20
)

const signInCompletePage = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Bifrost CLI sign-in complete</title>
<style>
:root { color-scheme: light dark; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; background: #f6f7f8; color: #111827; }
main { width: min(576px, 100%); padding: 32px; text-align: center; background: #fff; border: 1px solid #dfe3e8; border-radius: 4px; }
.icon { width: 48px; height: 48px; margin: 0 auto 20px; display: grid; place-items: center; border-radius: 50%; background: #e7f4ef; color: #087f5b; }
.icon svg { width: 24px; height: 24px; }
h1 { margin: 0; font-size: 20px; line-height: 28px; font-weight: 600; letter-spacing: -.025em; }
p { margin: 8px 0 0; color: #6b7280; font-size: 14px; line-height: 20px; }
@media (max-width: 639px) {
  body { padding: 12px; }
  main { padding: 16px; }
}
@media (prefers-color-scheme: dark) {
  body { background: #151719; color: #f9fafb; }
  main { background: #1f2225; border-color: #34383d; box-shadow: none; }
  .icon { background: #123b31; color: #55d6a9; }
  p { color: #a9afb8; }
}
</style>
</head>
<body><main><div class="icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg></div><h1>Bifrost CLI sign-in complete</h1><p>You can close this window</p></main></body>
</html>`

// User is the Enterprise identity returned after browser authentication.
type User struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
}

// TokenResponse contains the opaque agent credentials issued to the CLI.
type TokenResponse struct {
	AccessToken          string `json:"agent_access_token"`
	RefreshToken         string `json:"refresh_token"`
	ExpiresIn            int    `json:"expires_in"`
	RefreshExpiresIn     int    `json:"refresh_expires_in"`
	User                 User   `json:"user"`
	SelectedVirtualKeyID string `json:"selected_virtual_key_id"`
	ForcedVirtualKeyID   string `json:"forced_virtual_key_id"`
}

// Status describes the browser authentication capability of a gateway.
type Status struct {
	IdPConfigured         bool  `json:"idp_configured"`
	VirtualKeyAuthEnabled *bool `json:"virtual_key_auth_enabled"`
}

// Client performs the native browser authentication flow against one gateway.
type Client struct {
	BaseURL         string
	HTTPClient      *http.Client
	UserAgent       string
	Version         string
	DeviceName      string
	HardwareID      string
	CallbackWait    time.Duration
	exchangeTimeout time.Duration
	shutdownTimeout time.Duration
	OpenBrowser     func(string) error
	Authorization   func(string)
	Warning         func(error)
}

// callbackResult carries one validated callback response back to SignIn.
type callbackResult struct {
	response TokenResponse
	err      error
}

// CheckStatus discovers whether the gateway supports Enterprise browser SSO.
func (c *Client) CheckStatus(ctx context.Context) (Status, error) {
	var status Status
	if err := c.doJSON(ctx, http.MethodGet, "/api/agent/auth/status", nil, &status); err != nil {
		return status, err
	}
	return status, nil
}

// SignIn opens the browser and exchanges a loopback callback code using PKCE.
func (c *Client) SignIn(ctx context.Context, noBrowser bool) (TokenResponse, error) {
	var response TokenResponse
	status, err := c.CheckStatus(ctx)
	if err != nil {
		return response, fmt.Errorf("discover browser sign-in: %w", err)
	}
	if !status.IdPConfigured {
		return response, errors.New("browser SSO is not enabled on this gateway")
	}

	verifier, err := randomValue(32)
	if err != nil {
		return response, fmt.Errorf("create PKCE verifier: %w", err)
	}
	state, err := randomValue(32)
	if err != nil {
		return response, fmt.Errorf("create login state: %w", err)
	}
	challengeBytes := sha256.Sum256([]byte(verifier))
	challenge := base64.RawURLEncoding.EncodeToString(challengeBytes[:])

	listener, err := net.Listen("tcp4", "127.0.0.1:0")
	if err != nil {
		return response, fmt.Errorf("listen for browser callback: %w", err)
	}
	defer listener.Close()
	redirectURI := "http://" + listener.Addr().String() + callbackPath
	deviceName := strings.TrimSpace(c.DeviceName)
	if deviceName == "" {
		deviceName = "Bifrost CLI"
	}
	resultChannel := make(chan callbackResult, 1)
	server := callbackServer(state, resultChannel, func(code string) (TokenResponse, error) {
		payload := map[string]string{
			"code": code, "code_verifier": verifier, "redirect_uri": redirectURI,
			"platform": runtime.GOOS, "agent_version": c.Version, "device_name": deviceName,
			"hardware_id": strings.TrimSpace(c.HardwareID),
		}
		var exchanged TokenResponse
		exchangeTimeout := c.exchangeTimeout
		if exchangeTimeout <= 0 {
			exchangeTimeout = defaultExchangeTimeout
		}
		exchangeCtx, cancelExchange := context.WithTimeout(ctx, exchangeTimeout)
		defer cancelExchange()
		if exchangeErr := c.doJSON(exchangeCtx, http.MethodPost, "/api/agent/auth/token", payload, &exchanged); exchangeErr != nil {
			return TokenResponse{}, fmt.Errorf("exchange browser authorization code: %w", exchangeErr)
		}
		if strings.TrimSpace(exchanged.AccessToken) == "" || strings.TrimSpace(exchanged.RefreshToken) == "" {
			return TokenResponse{}, errors.New("gateway returned an incomplete CLI session")
		}
		return exchanged, nil
	})
	go func() {
		_ = server.Serve(listener)
	}()
	defer func() {
		shutdownTimeout := c.shutdownTimeout
		if shutdownTimeout <= 0 {
			shutdownTimeout = defaultShutdownTimeout
		}
		shutdownCtx, cancelShutdown := context.WithTimeout(context.Background(), shutdownTimeout)
		defer cancelShutdown()
		if shutdownErr := server.Shutdown(shutdownCtx); shutdownErr != nil {
			_ = server.Close()
		}
	}()

	authorizeURL, err := c.authorizationURL(redirectURI, state, challenge)
	if err != nil {
		return response, err
	}
	if c.Authorization != nil {
		c.Authorization(authorizeURL)
	}
	if !noBrowser {
		opener := c.OpenBrowser
		if opener == nil {
			opener = openBrowser
		}
		if err := opener(authorizeURL); err != nil {
			if c.Warning != nil {
				c.Warning(fmt.Errorf("could not open the browser automatically: %w", err))
			}
		}
	}

	wait := c.CallbackWait
	if wait <= 0 {
		wait = defaultLoginWait
	}
	timer := time.NewTimer(wait)
	defer timer.Stop()
	var callback callbackResult
	select {
	case <-ctx.Done():
		return response, ctx.Err()
	case <-timer.C:
		return response, errors.New("timed out waiting for browser sign-in")
	case callback = <-resultChannel:
	}
	if callback.err != nil {
		return response, callback.err
	}
	return callback.response, nil
}

// Refresh rotates an Enterprise agent session using its refresh token.
func (c *Client) Refresh(ctx context.Context, refreshToken string) (TokenResponse, error) {
	var response TokenResponse
	if strings.TrimSpace(refreshToken) == "" {
		return response, errors.New("no Enterprise SSO refresh token is stored")
	}
	if err := c.doJSON(ctx, http.MethodPost, "/api/agent/auth/refresh", map[string]string{"refresh_token": refreshToken}, &response); err != nil {
		return response, err
	}
	if str
```

### Core Architecture Module: `cli/internal/client/client.go`
```
// Package client provides the shared HTTP transport used by CLI commands.
package client

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/maximhq/bifrost/cli/internal/secrets"
)

const (
	maxResponseBytes        = 64 << 20
	maxErrorDisplayBytes    = 1024
	agentVirtualKeyIDHeader = "x-bf-agent-vk-id"
	agentIdentityHeader     = "X-Bifrost-Agent"
	appIdentityHeader       = "X-Bf-App"
	agentAuthRejectedHeader = "x-bf-agent-auth"
)

var agentPolicyRejectionMarkers = []string{"virtual_key_not_found", "virtual_key_required"}

// AuthMode controls which stored credential is attached to a request.
type AuthMode int

const (
	// AuthAuto chooses management auth for /api paths and inference auth otherwise.
	AuthAuto AuthMode = iota
	// AuthNone suppresses all stored credentials.
	AuthNone
	// AuthManagement attaches a management API key or session token.
	AuthManagement
	// AuthInference prefers Enterprise SSO and falls back to a configured virtual key.
	AuthInference
	// AuthAgent attaches the Enterprise browser SSO agent token.
	AuthAgent
)

// Credentials contains the credentials available for one gateway context.
type Credentials struct {
	VirtualKey        string
	ManagementKey     string
	SessionToken      string
	AgentToken        string
	AgentVirtualKeyID string
}

// Request describes one gateway request.
type Request struct {
	Method  string
	Path    string
	Query   url.Values
	Headers http.Header
	Body    []byte
	Auth    AuthMode
}

// Response contains the materialized gateway response.
type Response struct {
	StatusCode int
	Header     http.Header
	Body       []byte
}

// APIError represents a non-successful response from the gateway.
type APIError struct {
	Method     string
	URL        string
	StatusCode int
	Header     http.Header
	Body       string
}

// Error formats a concise gateway error without exposing request credentials.
func (e *APIError) Error() string {
	body := truncateErrorBody(strings.TrimSpace(e.Body))
	if body == "" {
		return fmt.Sprintf("%s %s returned HTTP %d", e.Method, e.URL, e.StatusCode)
	}
	return fmt.Sprintf("%s %s returned HTTP %d: %s", e.Method, e.URL, e.StatusCode, body)
}

func truncateErrorBody(body string) string {
	if len(body) <= maxErrorDisplayBytes {
		return body
	}
	prefix := body[:maxErrorDisplayBytes]
	for len(prefix) > 0 && !utf8.ValidString(prefix) {
		prefix = prefix[:len(prefix)-1]
	}
	return fmt.Sprintf("%s… (truncated; %d bytes total)", prefix, len(body))
}

// Client performs authenticated requests against one Bifrost gateway.
type Client struct {
	BaseURL     string
	HTTPClient  *http.Client
	DebugWriter io.Writer
	UserAgent   string
	// HeaderTimeout bounds receipt of response headers. Streaming response
	// bodies are governed only by their request context after headers arrive.
	HeaderTimeout time.Duration
	// RefreshAgentToken rotates a stale Enterprise browser SSO token after an auth rejection.
	RefreshAgentToken  func(context.Context, string) (string, error)
	credentialsMu      sync.RWMutex
	credentials        Credentials
	refreshMu          sync.Mutex
	streamClientMu     sync.Mutex
	streamClient       *http.Client
	streamClientSource *http.Client
}

// New constructs a client with conservative defaults.
func New(baseURL string, credentials Credentials, timeout time.Duration) *Client {
	if timeout <= 0 {
		timeout = 30 * time.Second
	}
	return &Client{
		BaseURL:       strings.TrimSpace(baseURL),
		HTTPClient:    &http.Client{Timeout: timeout, CheckRedirect: rejectInsecureRedirect},
		UserAgent:     "bifrost-cli/dev",
		HeaderTimeout: timeout,
		credentials:   credentials,
	}
}

// rejectInsecureRedirect blocks a redirect that changes scheme or host.
// Go's default client only strips the Authorization and Cookie-family
// headers, and only when a redirect changes host — a custom header this
// client sends, such as x-bf-vk (the virtual key), is always forwarded
// regardless of host or scheme. So both a same-host HTTPS to HTTP downgrade
// and a same-scheme cross-host redirect would otherwise leak a credential:
// the former over a plaintext connection, the latter to an arbitrary origin.
// A same-host HTTPS-to-HTTP redirect is allowed only for loopback development
// endpoints; changing hosts is never allowed, including redirects to loopback.
func rejectInsecureRedirect(req *http.Request, via []*http.Request) error {
	if len(via) == 0 {
		return nil
	}
	previous := via[len(via)-1].URL
	if !strings.EqualFold(previous.Hostname(), req.URL.Hostname()) {
		return fmt.Errorf("refusing to follow redirect to a different host: %s", req.URL)
	}
	if previous.Scheme == "https" && req.URL.Scheme != "https" && !isLoopbackHost(req.URL.Hostname()) {
		return fmt.Errorf("refusing to follow HTTPS to %s redirect to %s", req.URL.Scheme, req.URL)
	}
	return nil
}

// isLoopbackHost reports whether host refers to the local machine.
func isLoopbackHost(host string) bool {
	if strings.EqualFold(host, "localhost") {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

// CredentialsSnapshot returns a consistent copy of the client's current credentials.
func (c *Client) CredentialsSnapshot() Credentials {
	c.credentialsMu.RLock()
	defer c.credentialsMu.RUnlock()
	return c.credentials
}

// SetAgentToken replaces the in-memory Enterprise bearer after login or refresh.
func (c *Client) SetAgentToken(token string) {
	c.credentialsMu.Lock()
	c.credentials.AgentToken = token
	c.credentialsMu.Unlock()
}

// SetSessionToken replaces the in-memory dashboard session after password login.
func (c *Client) SetSessionToken(token string) {
	c.credentialsMu.Lock()
	c.credentials.SessionToken = token
	c.credentialsMu.Unlock()
}

// SetAgentVirtualKeyID replaces the non-secret assigned-key routing selection.
func (c *Client) SetAgentVirtualKeyID(id string) {
	c.credentialsMu.Lock()
	c.credentials.AgentVirtualKeyID = id
	c.credentialsMu.Unlock()
}

// Do executes a request and returns an APIError for non-2xx status codes.
func (c *Client) Do(ctx context.Context, input Request) (*Response, error) {
	usedAgentToken := strings.TrimSpace(c.CredentialsSnapshot().AgentToken)
	result, err := c.do(ctx, input)
	refresh, refreshErr := c.refreshRejectedAgent(ctx, input, err, usedAgentToken)
	if refreshErr != nil {
		return result, refreshErr
	}
	if !refresh {
		return result, err
	}
	return c.do(ctx, input)
}

// do executes one request attempt without automatic authentication recovery.
func (c *Client) do(ctx context.Context, input Request) (*Response, error) {
	req, err := c.buildRequest(ctx, input)
	if err != nil {
		return nil, err
	}
	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request gateway: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, maxResponseBytes+1))
	if err != nil {
		return nil, fmt.Errorf("read gateway response: %w", err)
	}
	if len(body) > maxResponseBytes {
		return nil, fmt.Errorf("gateway response exceeds %d bytes", maxResponseBytes)
	}
	if c.DebugWriter != nil {
		if _, err := fmt.Fprintf(c.DebugWriter, "< HTTP %d (%d bytes)\n", resp.StatusCode, len(body)); err != nil {
			return nil, err
		}
	}
	result := &Response{StatusCode: resp.StatusCode, Header: resp.Header.Clone(), Body: body}
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return result, &APIError{Method: req.Method, URL: req.URL.String(), StatusCode: resp.StatusCode, Header: resp.Header.Clone(), Body: string(body)}
	}
	return result, nil
}

// shouldRefreshAgent reports whether a failed request used a refreshable agent token.
func (c *Client) shouldRefreshAgent(input Request, err error, usedAgentToken string) bool {
	if c.RefreshAgentToken == nil || !strings.HasPrefix(usedAgentToken, secrets.AgentAccessTokenPrefix) {
		return false
	}
	mode := ResolveAuthMode(input.Auth, input.Path)
	if input.Headers.Get("Authorization") != "
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #7701** (2026-09-30): **[Bug]: Bedrock: GPT-6 Sol/Luna reject temperature/top_p at every reasoning effort (including "none"), and Bifrost does not strip them**
  *Symptoms*:  ### Prerequisites - [x] I have searched existing issues and discussions to avoid duplicates. The nearest is #5323, which strips on the OpenAI/Azure paths only. - [x] I am using the latest version (or have tested against main/nightly). I reproduced on `transports/v2.2.3` and checked the code on `dev` @ `bf515003d`.  ### Description Requests to OpenAI GPT-6 Sol or Luna on the **Bedrock** provider fail with HTTP 400 whenever the caller sends `temperature` or `top_p`. This happens at every `reasoning_effort`, including `"none"`. Bifrost already strips these fields for the same models on the OpenAI/Azure paths, using `samplingParamUnsupported`. The Bedrock Converse builders copy them through unconditionally.  This is stricter than OpenAI first-party, which only asks callers to drop `temperature`/`top_p` "when reasoning effort is not `none`". On Bedrock, both fields are rejected even with `reasoning.effort: "none"`.  Many SDKs and eval tools send `temperature` by default, so these models are unusable through Bifrost from those clients unless every caller changes its code.  ### Steps to reproduce Configure a Bedrock provider key with access to the `global.openai.gpt-6-luna` cross-region profile. Then:  ```sh # 400 curl -s http://localhost:8080/v1/chat/completions -H "Content-Type: application/json" \   -d '{"model":"bedrock/global.openai.gpt-6-luna","max_tokens":32,"temperature":0.2,"reasoning_effort":"none",        "messages":[{"role":"user","content":"Reply OK."}]}'  # 200 (same 
  **Post-Mortem & Fix Analysis**:
  > @DudiPeretz-Orca updated the datasheet, can you force once (Models > Model Settings > Force Sync Now).

- **Issue #7694** (2026-09-30): **[Bug]: Gemini rejects tool results that contain `$ref` — JSON-object tool output is forwarded as structured function_response.response**
  *Symptoms*: ### Prerequisites  - [x] I have searched existing issues and discussions to avoid duplicates - [x] I am using the latest version (or have tested against main/nightly)  ### Description  When a `role: "tool"` message is sent to a Gemini model through `/v1/chat/completions`, and its content is a valid JSON object, Bifrost sends that object as-is as Gemini's `function_response.response`. The code is in `core/providers/gemini/utils.go`, under "Try to use raw JSON if it's a valid JSON object".  Gemini's multimodal function responses treat any `{"$ref": "<name>"}` inside `function_response.response` as a pointer to a `display_name` in `function_response.parts`. Tool output often contains `$ref` for ordinary reasons, such as an OpenAPI spec or a JSON Schema. Gemini then rejects the whole request with a 400.  A text tool result that happens to be JSON gets a different meaning at the provider. When the content is not valid JSON, Bifrost wraps it as `{"content": "<string>"}`, and the request succeeds.  ### Steps to reproduce  1. Send this request to `/v1/chat/completions` with `model: "gemini/gemini-flash-latest"`:  ```json {   "model": "gemini/gemini-flash-latest",   "max_tokens": 20,   "messages": [     { "role": "user", "content": "Fetch the spec, then reply ok." },     { "role": "assistant", "content": null, "tool_calls": [       { "id": "c1", "type": "function", "function": { "name": "bash", "arguments": "{\"command\":\"cat spec.json\"}" } }     ] },     { "role": "tool", "tool_cal
  **Post-Mortem & Fix Analysis**:
  > This was already fixed I guess - checking if this is a regression 

- **Issue #7661** (2026-09-29): **[Bug]: Reasoning Parameters renders an unlabeled 0 for `reasoning.max_tokens`**
  *Symptoms*: ### Prerequisites  - [x] I have searched existing issues and discussions to avoid duplicates - [x] I am using the latest version (or have tested against main/nightly)  ### Description  When a log entry contains `params.reasoning.max_tokens: 0`, the Logs detail view displays an unlabeled `0` after the Effort field.  The value `0` can be intentional for some providers and should be displayed with its corresponding `Max Tokens` label.  ### Steps to reproduce  1. Create or select a log entry whose request parameters include:     ```    {      "reasoning": {        "effort": "low",        "max_tokens": 0      }    }    ``` 2. Open **Logs**. 3. Open the corresponding log detail. 4. Select **More details**. 5. Expand **Reasoning Parameters**. 6. Observe the value after the Effort field.  <img width="1608" height="228" alt="Image" src="https://github.com/user-attachments/assets/4e6d7bd4-1b3b-48f8-b7cc-6b80aa99f590" />  ### Expected behavior  The UI displays: Max Tokens   0  ### Actual behavior  The UI displays an unlabeled `0` after the Effort field.  ### Affected area(s)  UI (React)  ### Version  latest  ### Environment  ```text  ```  ### Relevant logs/output  ```shell  ```  ### Regression?  _No response_  ### Severity  Low (minor issue or cosmetic)

- **Issue #7649** (2026-09-29): **[Bug]: Bedrock provider drops extended-thinking token count (`output_tokens_details.thinking_tokens`) that AWS returns**
  *Symptoms*: ### Prerequisites - [x] I have searched existing issues and discussions to avoid duplicates - [x] I have tested against `main`  (Note: #5397 (merged) and #4984 add reasoning-token tracking for the **Anthropic** provider only — both touch `core/providers/anthropic/` exclusively — so they do not address this Bedrock-provider drop.)  ### Description  When an extended-thinking request is routed to a Claude model on Bedrock's **adaptive** thinking API (e.g. Claude Sonnet 5) through Bifrost, the response `usage` omits the reasoning/thinking token breakdown.  AWS Bedrock `InvokeModel` returns `usage.output_tokens_details.thinking_tokens` with a real count for these models. The **same request through Bifrost** returns that field absent (`null`/`0`). The thinking tokens are still generated and billed inside `output_tokens` (a signed `thinking` block is present in the response) — only the breakdown is lost, so any cost-attribution or dashboard that separates thinking from answer tokens under-reports thinking as zero.  This is **Bedrock-provider-specific**. The Anthropic provider carries the count correctly: `ConvertAnthropicUsageToBifrostUsage` maps Anthropic's `ThinkingTokens` → `OutputTokensDetails.ReasoningTokens`. But `BedrockTokenUsage` (`core/providers/bedrock/types.go`) has **no** reasoning field, so the count is dropped at unmarshal, and every Bedrock→Bifrost usage conversion (non-stream, and the streaming `message_start`/`message_delta` maps in `core/providers/bedrock/invoke.g

- **Issue #7613** (2026-09-28): **[Bug]: Bedrock Converse drops cache_control on file/document content blocks**
  *Symptoms*: ### Description  On the Bedrock Converse route, `cache_control` on a file/document content block is silently dropped. No `cachePoint` is emitted after the `document` block, so the document is never cached and is billed as fresh input on every request.  Text and image blocks already handle this: `convertContentBlock` appends a separate `CachePoint` block after them when `CacheControl` is set ([text case](https://github.com/maximhq/bifrost/blob/ed40d135e4dceef2a25a943744999ce96c2baaef/core/providers/bedrock/utils.go#L1695-L1701)). The file case returns only the `Document` block and never reads `block.CacheControl` ([file case](https://github.com/maximhq/bifrost/blob/ed40d135e4dceef2a25a943744999ce96c2baaef/core/providers/bedrock/utils.go#L1726-L1746)).  ### Steps to reproduce  1. Send a chat completion through Bifrost to a Bedrock Claude model (e.g. `bedrock/claude-opus-4-7`) with a user message whose last content block is a file/PDF carrying `"cache_control": {"type": "ephemeral"}`:    ```json    {"role": "user", "content": [      {"type": "text", "text": "Summarise the attached document."},      {"type": "file", "file": {"filename": "a.pdf", "file_data": "data:application/pdf;base64,..."},       "cache_control": {"type": "ephemeral"}}    ]}    ``` 2. Send the same request again. 3. Inspect the Converse request body and `usage` on the second response.  ### Expected behavior  A `{"cachePoint": {"type": "default"}}` block follows the `document` block, as it does for text and ima

- **Issue #7601** (2026-09-29): **[Bug]: /v1/responses for Anthropic and Gemini omits status and does not signal max_output_tokens truncation**
  *Symptoms*: ### Prerequisites  - [x] I have searched existing issues and discussions to avoid duplicates - [x] I am using the latest version (or have tested against main/nightly)  ### Description  On `/v1/responses`, requests routed to the direct `anthropic/*` and `gemini/*` providers return a response with **no `status`**, and a turn truncated by `max_output_tokens` is indistinguishable from a complete one:  - `response.status` is unset (OpenAI sets `"completed"` or `"incomplete"`); - `response.incomplete_details` is unset on truncation (OpenAI sets `{"reason": "max_output_tokens"}`); - the streaming terminal event is `response.completed` even when the output was truncated (OpenAI emits `response.incomplete`).  The same routes on `/v1/chat/completions` report `finish_reason: "length"` correctly, so the information is available to Bifrost. OpenAI routes on the same gateway follow the contract.  Consumers written against the Responses contract must either reject these terminals (a missing status is not "completed") or accept them and silently treat truncated output as complete, including half-written tool-call arguments.  #4679 reported the same defect for Bedrock (fixed); this is the same contract gap on the direct `anthropic` and `gemini` providers.  ### Steps to reproduce  Any client, `store: false`:  ```json POST /v1/responses {"model": "<route>", "input": [{"role": "user", "content": "Write a 400-word essay about the history of Rome."}], "max_output_tokens": 40, "stream": false} ``` 

- **Issue #7581** (2026-09-28): **[Bug]: Complexity Router: fails to find provider config unless provider name is all-lowercase**
  *Symptoms*: ### Prerequisites  - [x] I have searched existing issues and discussions to avoid duplicates - [x] I am using the latest version (or have tested against main/nightly)  ### Description  Using a custom model provider (DeepInfra) for the Complexity Router's semantic classifier, the provider lookup fails unless the provider name is all-lowercase. Even when it's correctly defined in Model Providers with a matching (but differently-cased) name.  ### Steps to reproduce  1. Add a custom provider with a name containing uppercase, e.g. DeepInfra-Embeddings. 2. Choose it in Complexity Router > Embedding configuration. 3. Check warmup status or logs. 4. Warmup fails  ### Expected behavior  Should display "Classified ready" checkmark  ### Actual behavior  Fails to get provider config if provider name is not all-lowercase  ### Affected area(s)  UI (React), Core (Go)  ### Version  v2.2.3  ### Environment  ```text Running in docker: - Docker version 29.8.1, build 4a63305 - Container: maximhq/bifrost:latest (v2.2.3, only basic env vars set) - Container: postgres:18-alpine - Browser: Chrome 151.0.7922.170 on Mac OS 15.5 ```  ### Relevant logs/output  ```shell {"level":"error","time":"2026-09-25T20:27:28Z","message":"[Governance] Semantic complexity warmup failed: detect semantic embedding dimension: failed to generate embedding: {\"is_bifrost_error\":false,\"error\":{\"error\":\"failed to get config for provider deepinfra-embeddings: not found\",\"message\":\"failed to get config for provider 

- **Issue #7572** (2026-09-29): **PUT /api/providers/{provider}/keys/{key_id}: partial update silently wipes key value and weight (destructive merge default)**
  *Symptoms*: ## Summary  A **partial** key update via `PUT /api/providers/{provider}/keys/{key_id}` (e.g. a payload containing only `models`) silently resets fields omitted from the payload to their zero values: the key's `value` is **emptied** and `weight` is reset to **0**. For an API-keyed provider this immediately breaks all traffic on that key (upstream 401s), and nothing in the request is rejected — the update returns 200 with the merged key.  Observed on **v2.2.2** (provider: sgl, key with a stored 64-char API value and weight 1):  1. `PUT …/keys/{id}` with body `{"models": ["m1", "m2"], "sgl_key_config": {"url": "…"}}` → 200 2. Resulting key: `value` empty, `weight` 0 — the key's own health check then reports `list_models_failed: provider API error: Unauthorized` 3. Restoring the value with a second PUT (full payload) recovered the key.  ## Why  `mergeUpdatedKey` (`transports/bifrost-http/handlers/provider_keys.go`, ~L448) starts from the incoming struct (`mergedKey := updateKey`) and only restores a stored secret when the incoming value is the **masked placeholder** (the UI's masked-preview round-trip). An *absent* field unmarshals to a zero value and overwrites the stored value — i.e. "field omitted" is treated as "explicitly cleared" rather than "preserve". The "Key value must not be empty" guard in `updateProviderKey` did not reject this update in the observed case (zero-value `SecretVar`).  ## Suggested fix  - **Preferred:** true patch semantics — distinguish "absent" from "e

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

### Incident Patch 1: `e1edeb26` (2026-09-30)
**Commit Message**: fix: include server instructions in on-demand MCP tool refresh (#7519)

## Summary

`RefreshClientTools` previously re-listed tools over the live connection but never re-read the server's `instructions` field, which `tools/list` cannot carry. An operator editing instructions upstream without restarting the server would get back only half of what they asked for — tools refreshed, instructions silently stale. This PR fixes that by performing a throwaway handshake after a successful tool re-list to pick up the current `instructions` and install them if they changed.

## Changes

- Added `refreshServerInstructions` to `MCPManager`: opens a throwaway connection after a sticky-client tool refresh, reads the `initialize` response's `instructions`, and calls `writeBackInstructions` to install them. Skipped for STDIO and in-process transports where a second subprocess would read stale on-disk config rather than the running server's state.
- Added `writeBackInstructions`: installs a re-read instructions string without touching tools, respects the `connGeneration` staleness guard (drops the result if the connection was replaced during the read), and fires the change callback only on a genuine

**File**: `core/internal/mcptests/connect_ping_listtools_test.go` (modified, +65/-0)
```diff
@@ -3,9 +3,11 @@ package mcptests
 import (
 	"context"
 	"fmt"
+	"net/http"
 	"os"
 	"os/exec"
 	"path/filepath"
+	"strings"
 	"testing"
 	"time"
 
@@ -848,3 +850,66 @@ func TestServerInstructions_DoNotDisturbToolDiscoveryOrExecution(t *testing.T) {
 	require.NotNil(t, result.Content.ContentStr)
 	assert.Contains(t, *result.Content.ContentStr, "LOOPCHECK")
 }
+
+// setUpstreamInstructions changes what the fixture's next handshake returns.
+func setUpstreamInstructions(t *testing.T, mcpURL, text string) {
+	t.Helper()
+	controlURL := strings.TrimSuffix(mcpURL, "/mcp") + "/set-instructions"
+	// Bounded so a stalled fixture handler fails this one test instead of hanging the
+	// package until the outer go test timeout.
+	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
+	defer cancel()
+	req, err := http.NewRequestWithContext(ctx, http.MethodPost, controlURL, strings.NewReader(text))
+	require.NoError(t, err)
+	resp, err := http.DefaultClient.Do(req)
+	require.NoError(t, err)
+	defer func() { _ = resp.Body.Close() }()
+	require.Equal(t, http.StatusNoContent, resp.StatusCode)
+}
+
+// The regression test for the bug this path exists to fix: RefreshClientTools is the
+// operator's "pick up what I changed upstream", and for a sticky client it re-lists
+// tools over the live connection — which cannot carry `instructions`. Before the fix
+// it refreshed only half of what it had rediscovered, silently.
+func TestRefreshClientTools_PicksUpChangedInstructions(t *testing.T) {
+	t.Parallel()
+
+	url := startInstructionsServer(t, "sticky", "Original rule: check permissions first.")
+	cfg := GetSampleHTTPClientConfig(url)
+	cfg.ID, cfg.Name = "sticky_id", "sticky"
+	manager := setupMCPManager(t, cfg)
+	ctx := createTestContext()
+
+	require.Contains(t, manager.GetAggregatedServerInstructions(ctx), "Original rule")
+
+	// The upstream edits its instructions in place — no restart, so Bifrost's
+	// connection survives and nothing tells it anything changed.
+	setUpstreamInstructions(t, url, "Revised rule: never echo secrets.")
+
+	// Tools are unchanged, so a tools-only refresh would report success and leave the
+	// stale text in place. That is exactly the failure this pins.
+	_, err := manager.RefreshClientTools(ctx, cfg.ID)
+	require.NoError(t, err)
+
+	got := manager.GetAggregatedServerInstructions(ctx)
+	assert.Contains(t, got, "Revised rule: never echo secrets.")
+	assert.NotContains(t, got, "Original rule")
+}
+
+// The same refresh must leave a client whose upstream did not change untouched, so
+// the persist seam and the hosted /mcp resync are not re-triggered on every press.
+func TestRefreshClientTools_UnchangedInstructionsStayPut(t *testing.T) {
+	t.Parallel()
+
+	url := startInstructionsServer(t, "steady", "Steady rule: nothing changes.")
+	cfg := GetSampleHTTPClientConfig(url)
+	cfg.ID, cfg.Name = "steady_id", "steady"
+	manager := setupMCPManager(t, cfg)
+	ctx := createTestContext()
+
+	before := manager.GetAggregatedServerInstructions(ctx)
+	_, err := manager.RefreshClientTools(ctx, cfg.ID)
+	require.NoError(t, err)
+
+	assert.Equal(t, before, manager.GetAggregatedServerInstructions(ctx))
+}
```

**File**: `core/mcp/clientmanager.go` (modified, +77/-2)
```diff
@@ -513,6 +513,72 @@ func (m *MCPManager) writeBackDiscoveredTools(clientID string, connGeneration ui
 	return true
 }
 
+// refreshServerInstructions re-reads clientID's initialize `instructions` over a
+// throwaway connection and installs them. Reports whether the read succeeded.
+//
+// Needs its own handshake because tools/list cannot carry the field. Not called on
+// the periodic check: MCP has no instructions-changed notification and treats the
+// field as fixed for a session, so a real change arrives as a restart (reconnect
+// re-reads it) or an operator edit (which is what triggers this).
+//
+// Skipped for STDIO/in-process: a second subprocess would read the current on-disk
+// config and report instructions the running one does not match.
+//
+// Best-effort. The caller already listed tools over the live connection, so a failed
+// read here is not a connection failure.
+func (m *MCPManager) refreshServerInstructions(ctx context.Context, config *schemas.MCPClientConfig, clientID string, connGeneration uint64) bool {
+	if config == nil {
+		return false
+	}
+	if config.ConnectionType != schemas.MCPConnectionTypeHTTP && config.ConnectionType != schemas.MCPConnectionTypeSSE {
+		return false
+	}
+
+	attemptCtx, cancel := context.WithTimeout(ctx, MCPClientConnectionEstablishTimeout)
+	defer cancel()
+
+	// Discovery also lists tools; only the instructions are taken, since the caller's
+	// own path is authoritative for tools and two writers could disagree.
+	_, _, instructions, err := m.performAdminToolDiscovery(attemptCtx, config)
+	if err != nil {
+		m.logger.Debug("%s Instructions refresh failed for %s: %v — keeping the installed text", MCPLogPrefix, config.Name, err)
+		return false
+	}
+
+	m.writeBackInstructions(clientID, connGeneration, instructions)
+	return true
+}
+
+// writeBackInstructions installs a re-read `instructions` string without touching
+// tools — the two arrive on different paths for a sticky client. Same connGeneration
+// staleness rule as writeBackDiscoveredTools. Fires the change callback only on a
+// genuine change, passing the tool set through so the hash sees instructions alone.
+func (m *MCPManager) writeBackInstructions(clientID string, connGeneration uint64, instructions string) {
+	m.mu.Lock()
+	clientState, exists := m.clientMap[clientID]
+	if !exists {
+		m.mu.Unlock()
+		return
+	}
+	if clientState.ConnGeneration != connGeneration {
+		m.mu.Unlock()
+		m.logger.Debug("%s Skipping instructions write-back for %s: connection was replaced during the read", MCPLogPrefix, clientID)
+		return
+	}
+	if clientState.ServerInstructions == instructions {
+		m.mu.Unlock()
+		return
+	}
+	clientState.ServerInstructions = instructions
+	fire := m.toolsChangedCallback(clientState, clientID, clientState.ToolMap, clientState.ToolNameMapping, instructions)
+	m.mu.Unlock()
+
+	// Fired outside the lock — see toolsChangeCallback's field doc.
+	if fire != nil {
+		fire()
+	}
+}
+
 // installedToolCount reports how many tools clientID is currently serving.
 // Used when a discovery is dropped as stale: the caller's own result describes
 // a tool set that was never installed, so the live map is the honest answer.
@@ -617,6 +683,9 @@ func (m *MCPManager) RefreshClientTools(ctx context.Context, clientID string) (i
 			// client is still serving whatever that reconnect discovered.
 			return m.installedToolCount(clientID), nil
 		}
+		// tools/list cannot see instructions, and an operator refreshing after editing
+		// them upstream would otherwise get back only half of what they asked for.
+		m.refreshServerInstructions(ctx, config, clientID, connGeneration)
 		return len(tools), nil
 
 	case m.credStore.RequiresPerCallConnection(config):
@@ -1251,7 +1320,13 @@ func (m *MCPManager) performAdminToolDiscovery(ctx context.Context, config *sche
 	if err != nil {
 		return nil, nil, "", fmt.Errorf("failed to resolve admin credential: %w", err)
 	}
-	switch config.AuthType {
+	// Empty AuthType is "headers" 
```

**File**: `core/mcp/instructions_test.go` (modified, +76/-0)
```diff
@@ -269,3 +269,79 @@ func TestAggregateServerInstructionsEscapesClientNameAttribute(t *testing.T) {
 	assert.Contains(t, got, `<mcp_server name="we&quot;ird&amp;&lt;name&gt;">`)
 	assert.Equal(t, 1, strings.Count(got, "</mcp_server>"))
 }
+
+// Instructions write-back, used by the on-demand refresh.
+
+func TestWriteBackInstructionsReplacesAndFiresCallback(t *testing.T) {
+	m := NewMCPManager(context.Background(), schemas.MCPConfig{}, nil, &MockLogger{}, nil)
+	config := &schemas.MCPClientConfig{ID: "c", Name: "c", ToolsToExecute: []string{"*"}}
+	m.mu.Lock()
+	m.clientMap[config.ID] = &schemas.MCPClientState{
+		Name: config.Name, ExecutionConfig: config,
+		ToolMap:            map[string]schemas.ChatTool{"c-echo": {Type: "function"}},
+		ServerInstructions: "v1",
+	}
+	m.mu.Unlock()
+
+	var seen []string
+	m.SetToolsChangeCallback(func(_, _ string, _ map[string]schemas.ChatTool, _ map[string]string, instructions string) {
+		seen = append(seen, instructions)
+	})
+
+	m.writeBackInstructions(config.ID, 0, "v2")
+
+	m.mu.RLock()
+	got := m.clientMap[config.ID].ServerInstructions
+	m.mu.RUnlock()
+	assert.Equal(t, "v2", got)
+	assert.Equal(t, []string{"v2"}, seen, "a changed text must reach the persist seam")
+}
+
+// An operator can press refresh repeatedly; an unchanged text must not re-persist.
+func TestWriteBackInstructionsNoOpWhenUnchanged(t *testing.T) {
+	m := NewMCPManager(context.Background(), schemas.MCPConfig{}, nil, &MockLogger{}, nil)
+	config := &schemas.MCPClientConfig{ID: "c", Name: "c"}
+	m.mu.Lock()
+	m.clientMap[config.ID] = &schemas.MCPClientState{
+		Name: config.Name, ExecutionConfig: config,
+		ToolMap: map[string]schemas.ChatTool{}, ServerInstructions: "same",
+	}
+	m.mu.Unlock()
+
+	fired := false
+	m.SetToolsChangeCallback(func(_, _ string, _ map[string]schemas.ChatTool, _ map[string]string, _ string) { fired = true })
+
+	m.writeBackInstructions(config.ID, 0, "same")
+
+	assert.False(t, fired, "an unchanged refresh must not re-trigger persist or resync")
+}
+
+// A reconnect during the read makes the result describe a connection that is gone.
+func TestWriteBackInstructionsDropsStaleGeneration(t *testing.T) {
+	m := NewMCPManager(context.Background(), schemas.MCPConfig{}, nil, &MockLogger{}, nil)
+	config := &schemas.MCPClientConfig{ID: "c", Name: "c"}
+	m.mu.Lock()
+	m.clientMap[config.ID] = &schemas.MCPClientState{
+		Name: config.Name, ExecutionConfig: config,
+		ToolMap: map[string]schemas.ChatTool{}, ServerInstructions: "installed", ConnGeneration: 7,
+	}
+	m.mu.Unlock()
+
+	m.writeBackInstructions(config.ID, 3, "from-a-replaced-connection")
+
+	m.mu.RLock()
+	defer m.mu.RUnlock()
+	assert.Equal(t, "installed", m.clientMap[config.ID].ServerInstructions)
+}
+
+// A second STDIO subprocess would read the current config, not the running one's.
+func TestRefreshServerInstructionsSkipsNonRemoteTransports(t *testing.T) {
+	m := NewMCPManager(context.Background(), schemas.MCPConfig{}, nil, &MockLogger{}, nil)
+	for _, connType := range []schemas.MCPConnectionType{schemas.MCPConnectionTypeSTDIO, schemas.MCPConnectionTypeInProcess} {
+		t.Run(string(connType), func(t *testing.T) {
+			ok := m.refreshServerInstructions(context.Background(),
+				&schemas.MCPClientConfig{ID: "x", Name: "x", ConnectionType: connType}, "x", 0)
+			assert.False(t, ok, "must not attempt a handshake for %s", connType)
+		})
+	}
+}
```

**File**: `docs/mcp/connecting-to-servers.mdx` (modified, +2/-0)
```diff
@@ -1081,6 +1081,8 @@ Unlike reconnect, this applies to **every** client type. A sticky client is re-l
 
 The freshly discovered set is persisted and the hosted `/mcp` surface is re-synced automatically, exactly as for a periodic sync. Rediscovering an unchanged tool set writes nothing.
 
+A refresh also re-reads the server's `instructions` (see [Server Instructions](/mcp/overview#server-instructions)). `tools/list` cannot carry that field, so for a sticky HTTP or SSE client this costs one extra handshake. It is the only way to pick up instructions an operator edited upstream without restarting the server: MCP has no change notification for them, and a healthy sticky client never re-handshakes on its own. STDIO clients are skipped — Bifrost owns the subprocess, so its instructions cannot change without a reconnect.
+
 <Note>
 Returns `400` when the client is in a state where discovery is meaningless: `disabled` (enable it first), `needs_reauth` (reauthorize it first), or `pending_verification` (complete the one-time admin verification instead — refreshing a client awaiting that flow would bypass it). Returns `404` if no client is registered under that ID.
 </Note>
```

**File**: `docs/openapi/paths/management/mcp.yaml` (modified, +6/-0)
```diff
@@ -409,6 +409,12 @@ client-refresh-tools:
 
       The freshly discovered set is persisted and the hosted /mcp surface is
       re-synced automatically, exactly as for every other discovery path.
+      A refresh also re-reads the server's instructions, which costs one extra
+      handshake for a sticky http or sse client because tools/list cannot
+      carry that field. STDIO clients are skipped: Bifrost owns the
+      subprocess, so its instructions cannot change without a reconnect. This
+      is the only way to pick up instructions edited upstream without
+      restarting, since MCP defines no change notification for them.
       Rejected with 400 when the client is not in a state where discovery
       means anything: disabled (enable it first), needs_reauth (reauthorize
       it first), or still pending_verification (complete the one-time admin
```

---

### Incident Patch 2: `556020c2` (2026-09-30)
**Commit Message**: feat: add downstream-extensible logs registry for routing panel, labelled metadata filters, and reserved key prefixes; hide all load-balancer metadata keys from filter sidebar and detail grid (#7734)

## Summary

Introduces a runtime registry for downstream builds to extend the Logs page without modifying OSS code. It also tightens the rule for which metadata keys are hidden from the filter sidebar and the log sheet's Metadata grid: every key under `LoadBalancerMetadataPrefix` is now hidden entirely (previously only specific keys like `v`, `excluded_providers`, and `excluded_keys` were hidden while enum-valued decision keys were kept visible).

## Changes

- **Backend (`rdb.go`):** Replaced the explicit allowlist of load-balancer metadata keys in `metadataSystemKeys` with a new `isMetadataSystemKey` function that hides every key under `schemas.LoadBalancerMetadataPrefix` via a prefix check, rather than enumerating individual keys. The corresponding test is updated to assert that only caller-owned keys (`tenant`) survive.

- **Frontend registry (`ui/lib/registries/logs.tsx`):** New module exposing a runtime registry with three extension points:
  - `registerLogRoutingPanel` / `getLo

**File**: `framework/logstore/metadatasystemkeys_test.go` (modified, +7/-11)
```diff
@@ -9,24 +9,20 @@ import (
 	"github.com/stretchr/testify/require"
 )
 
-// TestGetDistinctMetadataKeysHidesLoadBalancerSystemKeys checks that the load balancer's
-// schema-version and exclusion-list keys stay out of the filter sidebar while its enum-valued
-// decision keys, and ordinary caller keys, remain visible.
-func TestGetDistinctMetadataKeysHidesLoadBalancerSystemKeys(t *testing.T) {
+// TestGetDistinctMetadataKeysHidesLoadBalancerKeys checks that no key under
+// schemas.LoadBalancerMetadataPrefix reaches the metadata filter or the metadata columns, whatever
+// the key: they are the router's own record of an attempt, not caller metadata. Ordinary caller
+// keys stay.
+func TestGetDistinctMetadataKeysHidesLoadBalancerKeys(t *testing.T) {
 	store := newTestSQLiteStore(t)
 	defer store.Close(context.Background())
 	prefix := schemas.LoadBalancerMetadataPrefix
 	now := time.Now().UTC()
 	insertLogWithMetadata(t, store, "lb-keys",
-		`{"tenant":"acme","`+prefix+`decision":"pinned_rerouted","`+prefix+`v":"1","`+prefix+`excluded_providers":"groq:failed","`+prefix+`excluded_keys":"k1:rate_limit"}`,
+		`{"tenant":"acme","`+prefix+`decision":"pinned_rerouted","`+prefix+`route_state":"healthy","`+prefix+`v":"1","`+prefix+`excluded_providers":"groq:failed","`+prefix+`excluded_keys":"k1:rate_limit"}`,
 		now.Add(-time.Second))
 
 	keys, err := store.GetDistinctMetadataKeys(context.Background(), 100, "")
 	require.NoError(t, err)
-	require.Contains(t, keys, "tenant")
-	require.Contains(t, keys, prefix+"decision")
-	require.Equal(t, []string{"pinned_rerouted"}, keys[prefix+"decision"])
-	for _, hidden := range []string{prefix + "v", prefix + "excluded_providers", prefix + "excluded_keys"} {
-		require.NotContains(t, keys, hidden)
-	}
+	require.Equal(t, map[string][]string{"tenant": {"acme"}}, keys)
 }
```

**File**: `framework/logstore/rdb.go` (modified, +10/-8)
```diff
@@ -4668,14 +4668,16 @@ func (s *RDBLogStore) ListUserAgentMappings(ctx context.Context, activeOnly bool
 }
 
 // metadataSystemKeys are metadata keys added by the system that should be excluded from filter data.
-// The load balancer's schema-version and exclusion-list keys are hidden because they are either
-// constant or high-cardinality; its enum-valued decision keys stay visible so operators can filter
-// on them.
 var metadataSystemKeys = map[string]struct{}{
-	"isAsyncRequest":                                          {},
-	schemas.LoadBalancerMetadataPrefix + "v":                  {},
-	schemas.LoadBalancerMetadataPrefix + "excluded_providers": {},
-	schemas.LoadBalancerMetadataPrefix + "excluded_keys":      {},
+	"isAsyncRequest": {},
+}
+
+// isMetadataSystemKey reports whether a metadata key is the system's rather than the caller's, and
+// so stays out of the filter data. Every key under schemas.LoadBalancerMetadataPrefix is: it is
+// the router's own record of an attempt, not caller metadata.
+func isMetadataSystemKey(key string) bool {
+	_, isSystem := metadataSystemKeys[key]
+	return isSystem || strings.HasPrefix(key, schemas.LoadBalancerMetadataPrefix)
 }
 
 const (
@@ -4717,7 +4719,7 @@ func (s *RDBLogStore) GetDistinctMetadataKeys(ctx context.Context, limit int, qu
 			continue
 		}
 		for key, val := range parsed {
-			if _, isSystem := metadataSystemKeys[key]; isSystem {
+			if isMetadataSystemKey(key) {
 				continue
 			}
 			if !isValidMetadataKey(key) {
```

**File**: `ui/app/_fallbacks/enterprise/lib/registrations/logs.ts` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+// OSS-build fallback for the Logs page registrations.
+//
+// Side-effect imports of this module from OSS code (the log sheet and the logs filter sidebar)
+// compile to a no-op when the @enterprise alias resolves to _fallbacks/. A downstream build
+// replaces this module with one that registers its Logs page additions.
+export {};
\ No newline at end of file
```

**File**: `ui/app/workspace/logs/sheets/logDetailView.tsx` (modified, +8/-34)
```diff
@@ -42,6 +42,7 @@ import {
 	RoutingEngineUsedLabels,
 	Status,
 } from "@/lib/constants/logs";
+import { getLogRoutingPanel } from "@/lib/registries/logs";
 import { useGetLogsQuery, useGetProvidersQuery, useGetUserAgentMappingsQuery } from "@/lib/store";
 import { COMPLEXITY_MECHANISM_LABELS } from "@/lib/types/complexityRouter";
 import { BatchRequestCounts, ContentBlock, LLMUsage, LogEntry, OverheadBucket, ResponsesMessage } from "@/lib/types/logs";
@@ -53,6 +54,7 @@ import { applyRedactionMapping, applyRedactionMappingToValue, hasRedactionMappin
 import { extractResponsesItemPayload, summarizeResponsesToolCall } from "@/lib/utils/responsesItems";
 import { isJson } from "@/lib/utils/validation";
 import { RbacOperation, RbacResource, useRbac } from "@enterprise/lib";
+import "@enterprise/lib/registrations/logs";
 import { Link } from "@tanstack/react-router";
 import { addMilliseconds, format } from "date-fns";
 import { AlertCircle, ChevronDown, Clipboard, Copy, Download, Loader2, MoreVertical, Trash2, Wrench, X } from "lucide-react";
@@ -75,6 +77,7 @@ import {
 	isClientToolCallItem,
 	nextSessionLookupStart,
 	isResponsesToolCallItem,
+	isShownMetadataKey,
 	parseRoutingDecisionLine,
 	pickNextSessionLog,
 	resolveRawJsonNoticeState,
@@ -1288,6 +1291,8 @@ export function LogDetailView({
 	const detectedAppLabel = detectedApp ? logAppDisplayName(detectedApp, log.user_agent) : "";
 	const showTabs = !isContainer;
 	const complexityRouting = deriveComplexityRouting(log);
+	// A downstream build can draw its own routing record at the top of the Routing tab.
+	const RoutingPanel = getLogRoutingPanel();
 	const isPassthrough = isPassthroughOperation(log.object);
 	const isRealtimeTurn = log.object === "realtime.turn";
 	const isRealtimeTranscription =
@@ -2811,46 +2816,14 @@ export function LogDetailView({
 					{!isContainer &&
 						!isPassthrough &&
 						log.metadata &&
-						Object.keys(log.metadata).filter((k) => {
-							if (k === "isAsyncRequest") return false;
-							if (
-								isRealtimeTurn &&
-								[
-									"realtime_session_id",
-									"provider_session_id",
-									"realtime_source",
-									"realtime_event_type",
-									"realtime_transport",
-									"realtime_voice",
-									"realtime",
-								].includes(k)
-							)
-								return false;
-							return true;
-						}).length > 0 && (
+						Object.keys(log.metadata).some((k) => isShownMetadataKey(k, isRealtimeTurn)) && (
 							<>
 								<DottedSeparator />
 								<div className="space-y-4">
 									<BlockHeader title="Metadata" />
 									<div className="grid w-full grid-cols-1 items-start justify-between gap-4 md:grid-cols-3">
 										{Object.entries(log.metadata)
-											.filter(([key]) => {
-												if (key === "isAsyncRequest") return false;
-												if (
-													isRealtimeTurn &&
-													[
-														"realtime_session_id",
-														"provider_session_id",
-														"realtime_source",
-														"realtime_event_type",
-														"realtime_transport",
-														"realtime_voice",
-														"realtime",
-													].includes(key)
-												)
-													return false;
-												return true;
-											})
+											.filter(([key]) => isShownMetadataKey(key, isRealtimeTurn))
 											.map(([key, value]) => (
 												<LogEntryDetailsView key={key} className="w-full" label={key} value={String(value)} />
 											))}
@@ -3805,6 +3778,7 @@ export function LogDetailView({
 				</TabsContent>
 
 				<TabsContent value="routing" className="space-y-3">
+					{RoutingPanel && <RoutingPanel log={log} />}
 					{log.attempt_trail && log.attempt_trail.length > 1 && (
 						<CollapsibleBox
 							title={`Attempt Trail (${log.attempt_trail.length} attempts)`}
```

**File**: `ui/app/workspace/logs/sheets/logDetailView.utils.test.ts` (modified, +25/-0)
```diff
@@ -1,10 +1,12 @@
+import { registerReservedMetadataPrefix } from "@/lib/registries/logs";
 import { describe, expect, it } from "vitest";
 import {
 	extractProviderErrorMessage,
 	hasNoToolArguments,
 	isClientToolCallItem,
 	nextSessionLookupStart,
 	isResponsesToolCallItem,
+	isShownMetadataKey,
 	parseRoutingDecisionLine,
 	pickNextSessionLog,
 	resolveRawJsonNoticeState,
@@ -257,4 +259,27 @@ describe("nextSessionLookupStart", () => {
 	it("keeps a timestamp it cannot parse as it is", () => {
 		expect(nextSessionLookupStart("not a time")).toBe("not a time");
 	});
+});
+describe("isShownMetadataKey", () => {
+	it("shows the caller's own keys", () => {
+		expect(isShownMetadataKey("team", false)).toBe(true);
+		expect(isShownMetadataKey("team", true)).toBe(true);
+	});
+
+	it("hides the async marker", () => {
+		expect(isShownMetadataKey("isAsyncRequest", false)).toBe(false);
+	});
+
+	it("hides a realtime turn's own keys only on a realtime turn, which shows them in its header", () => {
+		expect(isShownMetadataKey("realtime_voice", true)).toBe(false);
+		expect(isShownMetadataKey("realtime_voice", false)).toBe(true);
+	});
+
+	it("hides every key under a reserved prefix, which a registered panel shows its own way", () => {
+		registerReservedMetadataPrefix("ext_");
+		for (const key of ["ext_v", "ext_decision", "ext_some_future_key"]) {
+			expect(isShownMetadataKey(key, false)).toBe(false);
+		}
+		expect(isShownMetadataKey("extra", false)).toBe(true);
+	});
 });
\ No newline at end of file
```

---

### Incident Patch 3: `e84292ca` (2026-09-30)
**Commit Message**: fix: remove wrapper padding from adaptive routing page and add `LoadBalancerHistory` cache tag (#7645)

## Summary

Removes unnecessary padding wrapper from the Adaptive Routing page so its layout is consistent with other full-height dashboard pages (logs, alert history), and registers a new `LoadBalancerHistory` cache tag in the base API.

## Changes

- Stripped the `<div>` wrapper with padding classes from `AdaptiveRoutingPage`, rendering `AdaptiveRoutingView` directly. The view manages its own full-height shell with a filter sidebar, so the extra padding was redundant and inconsistent with sibling pages.
- Added `LoadBalancerHistory` as a tag type in `baseApi` to support cache invalidation for load balancer history endpoints.

## Type of change

- [ ] Bug fix
- [ ] Feature
- [x] Refactor
- [ ] Documentation
- [ ] Chore/CI

## Affected areas

- [ ] Core (Go)
- [ ] Transports (HTTP)
- [ ] Providers/Integrations
- [ ] Plugins
- [x] UI (React)
- [ ] Docs

## How to test

1. Navigate to the Adaptive Routing page in the workspace.
2. Verify the layout renders correctly with no extra padding, matching the appearance of the logs and alert history pages.
3. Confirm the filter sidebar and

**File**: `ui/app/workspace/adaptive-routing/page.tsx` (modified, +3/-5)
```diff
@@ -1,9 +1,7 @@
 import AdaptiveRoutingView from "@enterprise/components/adaptive-routing/adaptiveRoutingView";
 
+// The dashboard lays out its own full-height shell (filter sidebar beside the panel), as the logs
+// and alert history pages do, so the page adds no padding of its own.
 export default function AdaptiveRoutingPage() {
-	return (
-		<div className="no-padding-parent mx-auto w-full p-4">
-			<AdaptiveRoutingView />
-		</div>
-	);
+	return <AdaptiveRoutingView />;
 }
\ No newline at end of file
```

**File**: `ui/lib/store/apis/baseApi.ts` (modified, +1/-0)
```diff
@@ -181,6 +181,7 @@ export const baseApi = createApi({
 		"UserGovernance",
 		"LargePayloadConfig",
 		"LoadBalancerConfig",
+		"LoadBalancerHistory",
 		"Folders",
 		"Prompts",
 		"Versions",
```

---

### Incident Patch 4: `566157d5` (2026-09-30)
**Commit Message**: fixes access profile summary UI (#7642)

**File**: `tests/e2e/features/virtual-keys/pages/virtual-keys.page.ts` (modified, +13/-0)
```diff
@@ -631,6 +631,19 @@ export class VirtualKeysPage extends BasePage {
     await this.openVirtualKeyEditor(name);
   }
 
+  /**
+   * Expand a provider config card in the open sheet and return its collapsed
+   * "Access & rate limits" summary.
+   */
+  async getProviderAccessSummary(index: number): Promise<Locator> {
+    const summary = this.page.getByTestId(`vk-access-summary-${index}`);
+    if (!(await summary.isVisible().catch(() => false))) {
+      await this.page.getByTestId(`vk-provider-header-${index}`).click();
+    }
+    await expect(summary).toBeVisible({ timeout: 5000 });
+    return summary;
+  }
+
   /**
    * Pick the key's content-logging choice in the open sheet
    */
```

**File**: `tests/e2e/features/virtual-keys/virtual-keys.spec.ts` (modified, +47/-0)
```diff
@@ -868,6 +868,53 @@ test.describe('Provider Management', () => {
     await virtualKeysPage.closeSheet()
   })
 
+  test('should reflect blocked models in the collapsed access summary', async ({ virtualKeysPage, request }) => {
+    const vkName = `Blocked Models Summary VK ${Date.now()}`
+    await virtualKeysApi.create(request, {
+      name: vkName,
+      is_active: true,
+      provider_configs: [
+        {
+          provider: 'openai',
+          allowed_models: ['*'],
+          blacklisted_models: ['gpt-4o', 'gpt-4o-mini'],
+          key_ids: ['*'],
+        },
+      ],
+    })
+    providerVKs.push(vkName)
+
+    await virtualKeysPage.goto()
+    await virtualKeysPage.viewVirtualKey(vkName)
+
+    const summary = await virtualKeysPage.getProviderAccessSummary(0)
+    await expect(summary).toContainText('All models · 2 models blocked')
+  })
+
+  test('should summarize a blocked wildcard as all models blocked', async ({ virtualKeysPage, request }) => {
+    const vkName = `Blocked Wildcard Summary VK ${Date.now()}`
+    await virtualKeysApi.create(request, {
+      name: vkName,
+      is_active: true,
+      provider_configs: [
+        {
+          provider: 'openai',
+          allowed_models: ['*'],
+          blacklisted_models: ['*'],
+          key_ids: ['*'],
+        },
+      ],
+    })
+    providerVKs.push(vkName)
+
+    await virtualKeysPage.goto()
+    await virtualKeysPage.viewVirtualKey(vkName)
+
+    const summary = await virtualKeysPage.getProviderAccessSummary(0)
+    await expect(summary).toContainText('All models blocked')
+    await expect(summary).not.toContainText('All models ·')
+  })
+
   test('should update provider-specific budget', async ({ virtualKeysPage }) => {
     // Create a virtual key with budget
     const vkName = `Provider Budget VK ${Date.now()}`
```

**File**: `ui/components/modelAccess/utils.test.ts` (modified, +14/-0)
```diff
@@ -6,6 +6,7 @@ import {
 	replaceModels,
 	resolveWildcardSelection,
 	splitModelAccess,
+	summarizeGrantModelAccess,
 	summarizeModelAccess,
 	validateModelRegex,
 } from "./utils";
@@ -91,6 +92,19 @@ describe("summaries and placeholders", () => {
 		expect(summarizeModelAccess(["regex:x", "regex:y"], "block")).toBe("2 patterns");
 	});
 
+	it("reflects blocked models in the combined grant summary (#7634)", () => {
+		expect(summarizeGrantModelAccess(["*"], [])).toBe("All models");
+		expect(summarizeGrantModelAccess(["*"], ["a", "b"])).toBe("All models · 2 models blocked");
+		expect(summarizeGrantModelAccess(["*"], ["a", "regex:^x"])).toBe("All models · 1 model, 1 pattern blocked");
+		expect(summarizeGrantModelAccess(["a", "b", "c"], ["a"])).toBe("3 models · 1 model blocked");
+		// The block list wins over the allow list, so a blocked "*" denies everything.
+		expect(summarizeGrantModelAccess(["*"], ["*"])).toBe("All models blocked");
+		expect(summarizeGrantModelAccess(["a"], ["*"])).toBe("All models blocked");
+		// An empty allow list already denies everything; the block list adds nothing.
+		expect(summarizeGrantModelAccess([], ["a"])).toBe("Deny all");
+		expect(summarizeGrantModelAccess(["*"], undefined)).toBe("All models");
+	});
+
 	it("keeps the placeholder wording per mode", () => {
 		expect(modelAccessPlaceholder(["*"], "allow")).toBe("All models allowed");
 		expect(modelAccessPlaceholder([], "allow")).toBe("No models (deny all)");
```

**File**: `ui/components/modelAccess/utils.ts` (modified, +15/-0)
```diff
@@ -113,6 +113,21 @@ export function summarizeModelAccess(list: readonly string[] | undefined | null,
 	return parts.join(", ");
 }
 
+/**
+ * Collapsed summary for a grant's allow and block sides together. The block list
+ * wins over the allow list, so a blocked "*" denies everything, and an empty
+ * allow list already denies everything whatever is blocked.
+ */
+export function summarizeGrantModelAccess(
+	allowed: readonly string[] | undefined | null,
+	blocked: readonly string[] | undefined | null,
+): string {
+	if (isWildcardList(blocked)) return summarizeModelAccess(blocked, "block");
+	const allowSummary = summarizeModelAccess(allowed, "allow");
+	if ((allowed ?? []).length === 0 || (blocked ?? []).length === 0) return allowSummary;
+	return `${allowSummary} · ${summarizeModelAccess(blocked, "block")} blocked`;
+}
+
 /** Placeholder for the picker control, mirroring the wording each surface used before. */
 export function modelAccessPlaceholder(list: readonly string[] | undefined | null, mode: ModelAccessMode): string {
 	const { models, patterns } = splitModelAccess(list);
```

**File**: `ui/components/ui/providerConfigCard.tsx` (modified, +4/-3)
```diff
@@ -1,5 +1,5 @@
 import { AsyncMultiSelect } from "@/components/ui/asyncMultiselect";
-import { ModelAccessSelector, summarizeModelAccess } from "@/components/modelAccess";
+import { ModelAccessSelector, summarizeGrantModelAccess } from "@/components/modelAccess";
 import { Label } from "@/components/ui/label";
 import { ModelSelector } from "@/components/ui/modelSelector";
 import MultiBudgetLines, { BudgetLineEntry } from "@/components/ui/multibudgets";
@@ -203,7 +203,7 @@ export function ProviderConfigCard({
 		: value.keyIds.length > 0
 			? `${value.keyIds.length} key${value.keyIds.length > 1 ? "s" : ""}`
 			: "No keys";
-	const modelsSummary = summarizeModelAccess(value.allowedModels, "allow");
+	const modelsSummary = summarizeGrantModelAccess(value.allowedModels, value.blacklistedModels);
 	const hasRl = value.rateLimit?.token_max_limit != null || value.rateLimit?.request_max_limit != null;
 	const rlSummary = hasRl ? "Rate limits set" : "No rate limits";
 
@@ -214,6 +214,7 @@ export function ProviderConfigCard({
 				role="button"
 				tabIndex={0}
 				onClick={toggleOpen}
+				data-testid={`${tid}-provider-header-${index}`}
 				onKeyDown={(e) => {
 					if (e.key === "Enter" || e.key === " ") {
 						e.preventDefault();
@@ -518,7 +519,7 @@ export function ProviderConfigCard({
 					>
 						<span className="text-muted-foreground/50 text-sm">└</span>
 						<span className="text-muted-foreground text-sm font-medium whitespace-nowrap">Access & rate limits</span>
-						<span className="text-muted-foreground/60 min-w-0 flex-1 truncate text-sm">
+						<span className="text-muted-foreground/60 min-w-0 flex-1 truncate text-sm" data-testid={`${tid}-access-summary-${index}`}>
 							{keysSummary} · {modelsSummary} · {rlSummary}
 						</span>
 						<ChevronDown className={cn("text-muted-foreground/60 h-3.5 w-3.5 shrink-0 transition-transform", accessOpen && "rotate-180")} />
```

---

### Incident Patch 5: `84896e3d` (2026-09-30)
**Commit Message**: feat: add `BifrostContextKeyLoadBalancerAttempt` and `LoadBalancerMetadataPrefix` to propagate enterprise load balancer routing decisions into log metadata, with system-key filtering and `cluster_node_id` composite index (#7456)

## Summary

Introduces a dedicated context key and metadata prefix for the enterprise load balancer plugin to record per-attempt routing decisions, and wires those decisions into the logging plugin so they are persisted on every log row. A caller-supplied header spelling the same prefixed key is always overwritten by the load balancer's value, preventing spoofing.

## Changes

- Added `BifrostContextKeyLoadBalancerAttempt` context key to carry the load balancer's flat, string-valued routing decision for the current attempt.
- Added `LoadBalancerMetadataPrefix` (`bifrost_alb_`) to namespace all load balancer metadata keys, ensuring they cannot collide with or be spoofed by caller-supplied headers.
- Added `mergeLoadBalancerMetadata` in the logging plugin, called at `PostLLMHook` time (after key selection has stamped its decision), which folds only prefixed keys from the attempt context into the log row's metadata, with load balancer values taking precedence

**File**: `core/schemas/bifrost.go` (modified, +7/-0)
```diff
@@ -440,6 +440,7 @@ const (
 	BifrostContextKeyCompatDroppedParams                 BifrostContextKey = "bifrost-compat-dropped-params"              // []string (set by compat plugin) - params stripped from the request because the model catalog did not allowlist them; read back in PostLLMHook to populate extra_fields.dropped_compat_plugin_params
 	BifrostContextKeyAttemptTrail                        BifrostContextKey = "bifrost-attempt-trail"                      // []KeyAttemptRecord (set by bifrost - DO NOT SET THIS MANUALLY) - per-attempt key selection history
 	BifrostContextKeyDimensions                          BifrostContextKey = "bifrost-dimensions"                         // map[string]string (set by HTTP transport from x-bf-dim-* headers) BifrostContextKeyDimensions holds per-request key/value dimensions supplied via x-bf-dim-<key> request headers. These dimensions are forwarded to internal logs (as metadata)
+	BifrostContextKeyLoadBalancerAttempt                 BifrostContextKey = "bifrost-lb-attempt"                         // map[string]string (set by the enterprise load balancer plugin - DO NOT SET THIS MANUALLY) - flat, string-valued routing decision for the current attempt, every key prefixed with LoadBalancerMetadataPrefix; the logging plugin merges it into the log row's metadata, and a key-selection decision overwrites the previous attempt's value on the shared context
 	IsAPIKeyAuthContextKey                               BifrostContextKey = "is_api_key_auth"
 	IsLocalAdminContextKey                               BifrostContextKey = "is_local_admin"                // bool (set by auth middleware when password-based auth succeeds - local admin user bypasses RBAC)
 	BifrostContextKeyAuthBypassed                        BifrostContextKey = "bifrost-auth-bypassed"         // bool (set by auth middleware ONLY when dashboard/admin auth is unconfigured or disabled and the request was let through without any credential check - distinct from IsLocalAdminContextKey, which is also set on genuinely authenticated sessions; handlers gating especially dangerous capabilities (e.g. native plugin/subprocess loading) should check this, not IsLocalAdminContextKey)
@@ -499,6 +500,12 @@ const (
 	RoutingEngineCore = "core"
 )
 
+// LoadBalancerMetadataPrefix prefixes every key the enterprise load balancer records under
+// BifrostContextKeyLoadBalancerAttempt. The logging plugin gives keys with this prefix precedence
+// over caller-supplied metadata of the same name, so a caller header can never masquerade as a
+// routing decision.
+const LoadBalancerMetadataPrefix = "bifrost_alb_"
+
 // KeyAttemptRecord captures the outcome of a single request attempt within executeRequestWithRetries.
 // One record is appended per attempt regardless of whether the key changed between attempts.
 //
```

**File**: `core/utils.go` (modified, +2/-0)
```diff
@@ -340,6 +340,7 @@ func clearCtxForFallback(ctx *schemas.BifrostContext) {
 	ctx.ClearValue(schemas.BifrostContextKeyGovernanceIncludeOnlyKeys)
 	ctx.ClearValue(schemas.BifrostContextKeyChangeRequestType)
 	ctx.ClearValue(schemas.BifrostContextKeyAttemptTrail)
+	ctx.ClearValue(schemas.BifrostContextKeyLoadBalancerAttempt)
 	ctx.ClearValue(schemas.BifrostContextKeyStreamEndIndicator)
 	ctx.ClearValue(schemas.BifrostContextKeyConnectionClosed)
 	ctx.ClearValue(schemas.BifrostContextKeyStreamBodyExhausted)
@@ -414,6 +415,7 @@ func ClearContextForInternalRequest(ctx *schemas.BifrostContext) {
 	ctx.ClearValue(schemas.BifrostContextKeyAPIKeyName)
 	ctx.ClearValue(schemas.BifrostContextKeyDirectKey)
 	ctx.ClearValue(schemas.BifrostContextKeySkipKeySelection)
+	ctx.ClearValue(schemas.BifrostContextKeyLoadBalancerAttempt)
 	// Body transport.
 	ctx.ClearValue(schemas.BifrostContextKeyUseRawRequestBody)
 	ctx.ClearValue(schemas.BifrostContextKeyRawRequestBodyTextRewriter)
```

**File**: `core/utils_test.go` (modified, +2/-0)
```diff
@@ -394,6 +394,8 @@ func TestClearCtxForFallback(t *testing.T) {
 		// Set by the Bedrock InvokeModel stream path; a fallback to a plain-SSE
 		// provider must not inherit the AWS event-stream reader (#6825).
 		schemas.BifrostContextKeySSEReaderFactory,
+		// The load balancer's record of the attempt that just failed.
+		schemas.BifrostContextKeyLoadBalancerAttempt,
 	}
 	// The next attempt resolves its own limits, which needs the same credential and caller.
 	preserved := []schemas.BifrostContextKey{
```

**File**: `framework/logstore/metadatasystemkeys_test.go` (added, +32/-0)
```diff
@@ -0,0 +1,32 @@
+package logstore
+
+import (
+	"context"
+	"testing"
+	"time"
+
+	"github.com/maximhq/bifrost/core/schemas"
+	"github.com/stretchr/testify/require"
+)
+
+// TestGetDistinctMetadataKeysHidesLoadBalancerSystemKeys checks that the load balancer's
+// schema-version and exclusion-list keys stay out of the filter sidebar while its enum-valued
+// decision keys, and ordinary caller keys, remain visible.
+func TestGetDistinctMetadataKeysHidesLoadBalancerSystemKeys(t *testing.T) {
+	store := newTestSQLiteStore(t)
+	defer store.Close(context.Background())
+	prefix := schemas.LoadBalancerMetadataPrefix
+	now := time.Now().UTC()
+	insertLogWithMetadata(t, store, "lb-keys",
+		`{"tenant":"acme","`+prefix+`decision":"pinned_rerouted","`+prefix+`v":"1","`+prefix+`excluded_providers":"groq:failed","`+prefix+`excluded_keys":"k1:rate_limit"}`,
+		now.Add(-time.Second))
+
+	keys, err := store.GetDistinctMetadataKeys(context.Background(), 100, "")
+	require.NoError(t, err)
+	require.Contains(t, keys, "tenant")
+	require.Contains(t, keys, prefix+"decision")
+	require.Equal(t, []string{"pinned_rerouted"}, keys[prefix+"decision"])
+	for _, hidden := range []string{prefix + "v", prefix + "excluded_providers", prefix + "excluded_keys"} {
+		require.NotContains(t, keys, hidden)
+	}
+}
```

**File**: `framework/logstore/migrations_test.go` (modified, +22/-0)
```diff
@@ -4,6 +4,8 @@ import (
 	"context"
 	"fmt"
 	"path/filepath"
+	"regexp"
+	"strings"
 	"testing"
 	"time"
 
@@ -528,6 +530,26 @@ func TestPerformanceIndexesCoverProjectIDs(t *testing.T) {
 	assert.Equal(t, "mcp_tool_logs", tables["idx_mcp_logs_project_id"])
 }
 
+// TestPerformanceIndexesHaveNoDuplicateColumns keeps the background builder from building the
+// same index twice under two names: a second index on the same columns costs a full build on
+// every upgraded deployment and a write on every insert, and the planner still picks one. A
+// partial index counts as a duplicate of a full one on the same columns, since an equality
+// filter on the column already implies its IS NOT NULL predicate.
+func TestPerformanceIndexesHaveNoDuplicateColumns(t *testing.T) {
+	onColumns := regexp.MustCompile(`(?i)\bON\s+(\w+)\s*(USING\s+\w+\s*)?\(([^)]*)\)`)
+	seen := map[string]string{}
+	for _, idx := range performanceIndexes {
+		match := onColumns.FindStringSubmatch(idx.sql)
+		require.NotNil(t, match, "cannot read the columns of %s from %q", idx.name, idx.sql)
+		key := strings.ToLower(strings.TrimSpace(match[1]+" "+strings.TrimSpace(match[2])) + "(" + strings.Join(strings.Fields(match[3]), " ") + ")")
+		if other, ok := seen[key]; ok {
+			t.Errorf("%s and %s both index %s", other, idx.name, key)
+			continue
+		}
+		seen[key] = idx.name
+	}
+}
+
 // TestMigrationAddMCPGovernanceSnapshots verifies the attribution columns are
 // additive, idempotent, and leave rows written before them intact — those rows
 // keep their bare ids, which is the accepted cost of not rewriting history.
```

---

### Incident Patch 6: `97f64c97` (2026-09-30)
**Commit Message**: fix(warp): nudges oown traffic hint and whose keys a ranking covers (#7746)

## Summary

Briefly explain the purpose of this PR and the problem it solves.

## Changes

- What was changed and why
- Any notable design decisions or trade-offs

## Type of change

- [ ] Bug fix
- [ ] Feature
- [ ] Refactor
- [ ] Documentation
- [ ] Chore/CI

## Affected areas

- [ ] Core (Go)
- [ ] Transports (HTTP)
- [ ] Providers/Integrations
- [ ] Plugins
- [ ] UI (React)
- [ ] Docs

## How to test

Describe the steps to validate this change. Include commands and expected outcomes.

```sh
# Core/Transports
go version
go test ./...

# UI
cd ui
pnpm i || npm i
pnpm test || npm test
pnpm build || npm run build
```

If adding new configs or environment variables, document them here.

## Screenshots/Recordings

If UI changes, add before/after screenshots or short clips.

## Breaking changes

- [ ] Yes
- [ ] No

If yes, describe impact and migration instructions.

## Related issues

Link related issues and discussions. Example: Closes #123

## Security considerations

Note any security implications (auth, secrets, PII, sandboxing, etc.).

## Checklist

- [ ] I read `docs/contributing/README.md` and followe

**File**: `framework/warp/agent.go` (modified, +22/-15)
```diff
@@ -602,7 +602,7 @@ func (a *Agent) Run(ctx context.Context, messages []schemas.ResponsesMessage, ou
 			// which discarded every step before it.
 			if !finalNudged {
 				finalNudged = true
-				nudge := userNudge("This is your final step and no tools are available now. Write your answer from the results above: lead with what you found, then say plainly what you could not check.")
+				nudge := loopNudge("This is your final step and no tools are available now. Write your answer from the results above: lead with what you found, then say plainly what you could not check.")
 				conversation = append(conversation, nudge)
 				conversationTokens += estimateMessageTokens(nudge)
 			}
@@ -656,7 +656,7 @@ func (a *Agent) Run(ctx context.Context, messages []schemas.ResponsesMessage, ou
 				return
 			}
 			emptyRetried = true
-			nudge := userNudge("Your last reply was empty. Continue: call a tool if you still need data and tools are available, otherwise write your answer from the results above.")
+			nudge := loopNudge("Your last reply was empty. Continue: call a tool if you still need data and tools are available, otherwise write your answer from the results above.")
 			conversation = append(conversation, nudge)
 			conversationTokens += estimateMessageTokens(nudge)
 			iteration--
@@ -700,7 +700,7 @@ func (a *Agent) Run(ctx context.Context, messages []schemas.ResponsesMessage, ou
 			// Sent back once, so the model draws it properly or says why not.
 			if droppedCharts > 0 && !finalStep && !chartRedirected && iteration+1 < a.maxIterations {
 				chartRedirected = true
-				nudge := userNudge(droppedChartRedirect)
+				nudge := loopNudge(droppedChartRedirect)
 				conversation = append(conversation, nudge)
 				conversationTokens += estimateMessageTokens(nudge)
 				continue
@@ -1112,28 +1112,35 @@ func endsWithProseQuestion(text string) bool {
 	return strings.HasSuffix(text, "?") && !strings.Contains(text, "```warp-scope")
 }
 
-// unsupportedReplyRedirect is the one-time nudge sent back for a reply that
-// called no tool, or that asked in prose after one did. It rides as a user
-// message because it is feedback on the last reply, not a standing
-// instruction.
-// userNudge builds a user-role message from the loop itself: feedback on the
+// loopNudge builds a message from the loop itself: feedback on the
 // conversation so far rather than a standing instruction, which is why it rides
 // in the transcript and not in the system prompt.
-func userNudge(content string) schemas.ResponsesMessage {
+//
+// It rides as a developer message, not a user one. These nudges are not the
+// person's words, and a reasoning model that was handed the no-data redirect
+// as a user turn - "if it declines ... give the same reply again" - read it as
+// someone trying to steer it, refused it ("I can't help with instructions
+// about how to respond"), and that refusal reached the screen as the answer.
+// The developer role is the application speaking, which is what this is.
+// Every provider converter carries it: OpenAI as is, Anthropic and Bedrock as
+// an in-place system turn, Gemini as a user turn.
+func loopNudge(content string) schemas.ResponsesMessage {
 	itemType := schemas.ResponsesMessageTypeMessage
-	role := schemas.ResponsesInputMessageRoleUser
+	role := schemas.ResponsesInputMessageRoleDeveloper
 	return schemas.ResponsesMessage{Type: &itemType, Role: &role, Content: &schemas.ResponsesMessageContent{ContentStr: &content}}
 }
 
+// unsupportedReplyRedirect is the one-time nudge sent back for a reply that
+// called no tool, or that asked in prose after one did. It rides as a
+// developer message, like every loopNudge, because it is feedback on the last
+// reply from the loop rather than anything the person said.
 func unsupportedReplyRedirect(calledTool, describedFilterSpace bool) schemas.ResponsesMessage {
-	itemType := schemas.ResponsesMessageTypeMessage
-	role := schemas.ResponsesInputMessageRoleUser
 	content := "That r
```

**File**: `framework/warp/agent_test.go` (modified, +60/-3)
```diff
@@ -1286,7 +1286,7 @@ func TestWarpAgentFinalStepAnswersPartially(t *testing.T) {
 	// it with an empty end_turn - seven steps of research thrown away.
 	closing := model.lastInput[len(model.lastInput)-1]
 	require.NotNil(t, closing.Role, "the final request must not end on a tool result")
-	require.Equal(t, schemas.ResponsesInputMessageRoleUser, *closing.Role)
+	require.Equal(t, schemas.ResponsesInputMessageRoleDeveloper, *closing.Role)
 	require.Contains(t, *closing.Content.ContentStr, "final step")
 	last := events[len(events)-1]
 	require.Equal(t, EventDone, last.Type)
@@ -1752,7 +1752,7 @@ func TestWarpAgentRedirectAfterFilterSpaceDoesNotAskForItAgain(t *testing.T) {
 	require.Equal(t, 3, model.calls)
 	var redirect string
 	for _, item := range model.lastInput {
-		if item.Role != nil && *item.Role == schemas.ResponsesInputMessageRoleUser && item.Content != nil && item.Content.ContentStr != nil {
+		if item.Role != nil && *item.Role == schemas.ResponsesInputMessageRoleDeveloper && item.Content != nil && item.Content.ContentStr != nil {
 			redirect = *item.Content.ContentStr
 		}
 	}
@@ -1846,7 +1846,7 @@ func TestWarpAgentAsksAgainAfterAnEmptyReply(t *testing.T) {
 		require.Equal(t, "17 requests failed.", events[len(events)-2].Delta)
 		nudge := model.lastInput[len(model.lastInput)-1]
 		require.NotNil(t, nudge.Role)
-		require.Equal(t, schemas.ResponsesInputMessageRoleUser, *nudge.Role)
+		require.Equal(t, schemas.ResponsesInputMessageRoleDeveloper, *nudge.Role)
 		require.Contains(t, *nudge.Content.ContentStr, "empty")
 		for _, item := range model.lastInput {
 			if item.Role != nil && *item.Role == schemas.ResponsesInputMessageRoleAssistant && item.Content != nil && item.Content.ContentStr != nil {
@@ -1990,6 +1990,63 @@ func TestWarpVirtualKeySettingsStayInScope(t *testing.T) {
 	}
 }
 
+// The loop's nudges rode as user messages. A reasoning model read the no-data
+// redirect - a user turn full of "if it declines ... give the same reply
+// again" - as someone trying to steer it, refused it ("I can't help with
+// instructions about how to respond"), and that refusal streamed to the screen
+// as the answer. The nudges are the loop's own feedback, not the person's
+// words, so they ride as developer messages: what the model treats as the
+// application speaking. Every provider converter carries the role - OpenAI as
+// is, Anthropic and Bedrock as an in-place system turn, Gemini as user.
+func TestWarpLoopNudgesRideAsDeveloperMessages(t *testing.T) {
+	for _, described := range []bool{false, true} {
+		for _, called := range []bool{false, true} {
+			redirect := unsupportedReplyRedirect(called, described)
+			require.NotNil(t, redirect.Role)
+			require.Equal(t, schemas.ResponsesInputMessageRoleDeveloper, *redirect.Role, "called=%v described=%v", called, described)
+		}
+	}
+	nudge := loopNudge("Your last reply was empty.")
+	require.NotNil(t, nudge.Role)
+	require.Equal(t, schemas.ResponsesInputMessageRoleDeveloper, *nudge.Role)
+}
+
+// "Which virtual key should I look up?" was asked of an identified caller, and
+// the option "My own traffic" carried the hint "self" - which came back as the
+// word "self", was searched for as a name, matched nothing, and ended in "I
+// couldn't find a virtual key associated with your account". The schema said a
+// hint is "the value you want back" and nothing said what that value is for
+// the person's own traffic. It is their caller_user_id from
+// describe_filter_space, and the schema, the guidance and the redirect that
+// tells the model to offer that option all say so.
+func TestWarpOwnTrafficOptionCarriesTheCallerID(t *testing.T) {
+	require.Contains(t, AskUserSchema, "caller_user_id")
+	require.Contains(t, QuestionGuidance, "caller_user_id")
+	for _, described := range []bool{false, true} {
+		redirect := *unsupportedReplyRedirect(false, described).Content.ContentStr
+		require.Contains(t, redirect, "caller_user_id", "described=%v", described)
+	}
+}
+
+// "whats
```

**File**: `framework/warp/flows.go` (modified, +13/-3)
```diff
@@ -967,11 +967,21 @@ func queryUsageByTool() Tool {
 			if err != nil {
 				return nil, fmt.Errorf("%s rankings failed: %w", dimension, err)
 			}
-			return noteRequestTypes(setRankingLogsLink(map[string]any{
+			scope := scopeNote(filters, deps.scope)
+			out := map[string]any{
 				"rankings": linkDimensionRankings(result, filters, dimension),
-				"scope":    scopeNote(filters, deps.scope),
+				"scope":    scope,
 				"window":   resolvedWindow(filters),
-			}, result, filters, dimension), filters), nil
+			}
+			// A key ranking takes no default scope (rankingScope), so for an
+			// identified caller it ranks everyone's keys - and "whats my vk" was
+			// answered from its top row: "your traffic is associated with the
+			// virtual key X". Said here, with the id to copy, rather than left to
+			// the scope tag the model read past.
+			if dimension == logstore.RankingDimensionVirtualKey && deps.scope.HasIdentity && scope == "all" {
+				out["guidance"] = fmt.Sprintf("These are the keys everyone you may see used, not the person asking: a row here is not their key. For the keys their own requests used, call again with user_ids: [%q].", deps.scope.UserID)
+			}
+			return noteRequestTypes(setRankingLogsLink(out, result, filters, dimension), filters), nil
 		},
 	}
 }
```

**File**: `framework/warp/prompt.go` (modified, +1/-0)
```diff
@@ -64,6 +64,7 @@ Whose traffic the question is about:
 - Call describe_filter_space when the question does not say whose traffic it means. It tells you whether the person asking is identified and what teams, customers, business units and virtual keys actually have traffic.
 - When the person asking is identified, their own traffic is the default and queries are scoped to it automatically. Say so in your answer, and mention that naming a team, customer or business unit widens it. The exception is a ranking across users, teams, customers, business units, projects or virtual keys - query_usage_by or a bar chart grouped by one of them. Ranking one person's traffic by user ranks one person, so these cover everyone the person asking may see, and their scope tag is "all".
 - When nobody is identified there is no sensible default, and you must ask before querying - but call describe_filter_space first, so the choices you offer are ones that actually have traffic. Never claim there are several traffic sources without having looked. Call ask_user rather than asking in prose or writing the choices out as a list in your answer - only ask_user renders as something the person can click. ask_user accepts at most 8 options, counting a "whole deployment" option, so list only one dimension's values - teams, customers or business units, never a mix - narrowed to fit using any wording already in the question. If the question gives no hint which of team, customer or business unit it means, ask that first and only list that one dimension's values once they answer. Asking one short question beats answering the wrong one.
+- "What's my virtual key", "which key am I on": no tool reads who a key belongs to, so answer from traffic. Do not ask which key - that is the question. Call query_usage_by with dimension virtual_key and user_ids set to the caller_user_id describe_filter_space returned, over the last 30 days unless the person named a window, and report every key their requests used, "Unassigned" included, with the window - a different window can give a different list, so say which one you looked at. A virtual_key ranking without user_ids ranks everyone's keys, and its top row is not the person's key.
 - If the person clearly means the whole deployment ("across everyone", "all customers"), or picks "whole deployment" from ask_user, pass scope: "all" in filters - without it an identified caller's query is narrowed to their own traffic. That widens the question, not the permission: the result covers everything the person asking may see and no more.
 - Every result carries a compact "scope" tag rather than a sentence: "self" means scoped to the person asking - say so, and mention that naming a team, customer or business unit widens it. "named" means scoped to whatever you filtered by - state which dimensions. "all" means everything the person asking may see, which is not necessarily the whole deployment - say so plainly, since it is rarely what someone means by "we". A number whose scope goes unstated is worse than no number, because it looks correct.
 - A tool that returns an error is telling you how to fix the call. Read it and retry rather than giving up or guessing.
```

**File**: `framework/warp/question.go` (modified, +2/-1)
```diff
@@ -77,7 +77,7 @@ const AskUserSchema = `{
         "type": "object",
         "properties": {
           "label": {"type": "string", "description": "What the person reads, e.g. 'Last 7 days'."},
-          "hint": {"type": "string", "description": "The value you want back, e.g. '-7d' or a team id. Keep it short."}
+          "hint": {"type": "string", "description": "The value you want back, e.g. '-7d', a team id, or - for the person's own traffic - the caller_user_id describe_filter_space returned. Keep it short."}
         },
         "required": ["label"]
       }
@@ -204,6 +204,7 @@ Asking before you answer:
 - These rules apply only to a question you are going to answer from the data. A message outside what you cover is declined without asking anything (see "Staying on topic").
 - Two things decide a metric answer: which time range, and whose traffic. If the question does not say, ask with ` + AskUserTool + ` rather than choosing for them. A number computed over the wrong window or the wrong scope is not a smaller answer, it is a different one.
 - Offer options they can pick. For a time range that is usually: Last 24 hours (-24h), Last 7 days (-7d), Last 30 days (-30d), and a custom range. For scope, use what describe_filter_space reported - the teams, customers or business units that actually have traffic.
+- An option's hint is what comes back to you, so it must be something a tool accepts. For the person's own traffic that is the caller_user_id describe_filter_space returned, which you then pass as user_ids - never a word like "self" or "mine", which no tool understands and a search for it finds nothing.
 - "This week", "last week", "this month" and "last month" do not settle the window. Each can mean the calendar period (Monday until now, the 1st until now, or the whole week or month before it) or a rolling one (the last 7 or 30 days), and early in a week or month the two are several times apart. Ask which, offering Last 7 days (-7d) and This calendar week (since Monday) for a week, or Last 30 days (-30d) and This calendar month (since the 1st) for a month - for a comparison, the rolling period against the one before it, or the calendar period so far against all of the previous one. Do not ask when the wording already decides it - "the last 7 days", "the past week", "since Monday", "week to date", "this calendar week", "the last 30 days", "the past month", "month to date", "in August" - or when the person already chose earlier in this conversation.
 - Ask about one thing at a time. If both the window and the scope are missing, ask the window first, then the scope once they answer.
 - Do not ask when you already know. An identified caller's own traffic is the default scope, and a question that names a period ("yesterday", "on sept 3rd") has already told you the window - a week or a month being the exception below.
```

---

### Incident Patch 7: `39ab1dcd` (2026-09-30)
**Commit Message**: fix(warp): links that cannot open are no longer clickable (#7736)

## Summary

When a model refuses to use root-relative links and instead writes placeholder URLs like `https://.../` or bare schemes like `https://`, those links were passing through the sanitizer as foreign hosts and becoming clickable — even though they lead nowhere. This PR makes the link sanitizer detect and unlink any target that cannot actually open in a browser.

## Changes

- Added `openableHost` to validate that a URL's hostname is either a real IP address or dot-separated labels of letters, digits, and hyphens. Placeholder hostnames like `...` and `…` fail this check and cause the link to be unlinked.
- Empty link targets now return `linkInvented` (unlinked) instead of `linkUntouched` (kept as-is).
- A bare scheme with nothing after it (e.g. `https://`) is now explicitly unlinked.
- Links where a model placed an invented domain in front of the dashboard's own `/workspace/logs` path (e.g. `https://your-domain.com/workspace/logs?...`) are now treated as dashboard links rather than foreign ones — repaired to root-relative if the query is valid, unlinked if not.
- The prompt instruction was extended to explicit

**File**: `framework/warp/links.go` (modified, +59/-8)
```diff
@@ -3,11 +3,13 @@ package warp
 import (
 	"encoding/json"
 	"fmt"
+	"net"
 	"net/url"
 	"regexp"
 	"slices"
 	"strconv"
 	"strings"
+	"unicode"
 
 	"github.com/maximhq/bifrost/framework/logstore"
 )
@@ -84,8 +86,10 @@ var linkTitle = regexp.MustCompile(`\s+["'(].*$`)
 // link whose query a tool issued becomes the issued link; any other link to the
 // Logs page gets its path repaired and its query kept; a link into the
 // dashboard that no tool could have returned loses its target and keeps its
-// text. External links are left alone. issued may be nil, which skips only the
-// first of those.
+// text, and so does a link that cannot open at all - a placeholder such as
+// "https://.../", a bare scheme, an empty target. A link that cannot work must
+// not be clickable. External links to a real host are left alone. issued may
+// be nil, which skips only the first of those.
 func sanitizeAnswerLinks(answer string, issued issuedLinks) string {
 	answer = fencedIssueLink.ReplaceAllString(answer, "[Request this in Bifrost's issue tracker]($1)\n")
 	matches := markdownLink.FindAllStringSubmatchIndex(answer, -1)
@@ -127,9 +131,14 @@ const (
 // resolveLinkTarget decides what one link target becomes.
 //
 // "workspace" and "logs" as a host are the path's own segments, reinterpreted
-// by a model that wanted a domain, so those count as the dashboard. Any other
-// host is somebody else's site unless the query is one a tool issued: a
-// genuinely external "https://example.com/logs" is left alone.
+// by a model that wanted a domain, so those count as the dashboard, and so
+// does any host in front of the dashboard's own "/workspace/logs" path: a
+// model that will not write a root-relative link puts a domain it made up
+// there, and the link only opens once the domain is gone. A host that is not
+// a hostname at all - the "..." of a "https://.../" placeholder - is a link
+// that cannot open, and is unlinked. Any other host is somebody else's site
+// unless the query is one a tool issued: a genuinely external
+// "https://example.com/logs" is left alone.
 func resolveLinkTarget(target string, issued issuedLinks) (string, linkVerdict) {
 	raw := strings.TrimSpace(target)
 	raw = strings.TrimSuffix(strings.TrimPrefix(raw, "<"), ">")
@@ -138,21 +147,39 @@ func resolveLinkTarget(target string, issued issuedLinks) (string, linkVerdict)
 	raw = strings.ReplaceAll(raw, "&amp;", "&")
 	// A space the model decoded back out of a search term.
 	raw = strings.ReplaceAll(raw, " ", "+")
-	if raw == "" || strings.HasPrefix(raw, "#") {
+	if raw == "" {
+		return "", linkInvented
+	}
+	if strings.HasPrefix(raw, "#") {
 		return "", linkUntouched
 	}
 	parsed, err := url.Parse(raw)
-	if err != nil || (parsed.Scheme != "" && parsed.Host == "") {
-		// Unparseable, or a scheme with no host (mailto:, tel:).
+	if err != nil {
+		return "", linkInvented
+	}
+	if parsed.Scheme != "" && parsed.Host == "" {
+		if parsed.Opaque == "" && parsed.Path == "" {
+			// "https://" with nothing after it.
+			return "", linkInvented
+		}
+		// A scheme with no host (mailto:, tel:).
 		return "", linkUntouched
 	}
 	host := strings.ToLower(parsed.Host)
 	foreign := host != "" && host != "workspace" && host != "logs"
+	if foreign && !openableHost(parsed.Hostname()) {
+		return "", linkInvented
+	}
 
 	segments := strings.FieldsFunc(parsed.Path, func(r rune) bool { return r == '/' })
 	if !foreign && host != "" {
 		segments = append([]string{host}, segments...)
 	}
+	if n := len(segments); foreign && n >= 2 && segments[n-2] == "workspace" && segments[n-1] == "logs" {
+		// The dashboard's own path behind an invented domain.
+		foreign = false
+		segments = segments[n-2:]
+	}
 	key, parseable := canonicalQuery(parsed.RawQuery)
 
 	if foreign {
@@ -184,6 +211,30 @@ func resolveLinkTarget(target string, issued issuedLinks) (string, linkVerdict)
 	return logsViewPath + "?" + parsed.RawQuery, linkRewritten
 }
 
+// openableHost reports whether a host is one a browse
```

**File**: `framework/warp/links_test.go` (modified, +28/-0)
```diff
@@ -974,3 +974,31 @@ func TestWarpChartLinkPerMetric(t *testing.T) {
 		}
 	}
 }
+
+// A link that cannot open must not be clickable. On a deployed instance the
+// model refused the tools' root-relative links as "relative, not complete
+// URLs" and linked the ranking rows to "https://.../" instead; the sanitizer
+// read "..." as a foreign host and let the placeholder through. The same goes
+// for a scheme with nothing after it, an empty target, and an invented domain
+// in front of the dashboard's own path: none of those lead anywhere, so each
+// keeps its text and loses its target. An invented domain whose query the
+// Logs page can honour is repaired to the root-relative link instead.
+func TestWarpSanitizeAnswerLinksUnlinksPlaceholders(t *testing.T) {
+	cases := map[string]string{
+		"[akshay](https://.../)":             "akshay",
+		"[akshay](https://...)":              "akshay",
+		"[akshay](https://…/workspace/logs)": "akshay",
+		"[akshay](https://)":                 "akshay",
+		"[akshay]()":                         "akshay",
+		"[akshay](https://your-domain.com/workspace/logs?nonsense=1)":                          "akshay",
+		"[akshay](https://your-domain.com/workspace/logs?user_ids=u1&start_time=1&end_time=2)": "[akshay](/workspace/logs?user_ids=u1&start_time=1&end_time=2)",
+		"[akshay](https://dashboard/workspace/logs)":                                           "[akshay](/workspace/logs)",
+		// A real host stays a link, even one nobody asked for.
+		"[docs](https://docs.getbifrost.ai/warp)": "[docs](https://docs.getbifrost.ai/warp)",
+		"[local](http://localhost:8080/health)":   "[local](http://localhost:8080/health)",
+		"[ip](http://10.0.0.1:8080/health)":       "[ip](http://10.0.0.1:8080/health)",
+	}
+	for input, want := range cases {
+		require.Equal(t, want, sanitizeAnswerLinks(input, nil), "input: %s", input)
+	}
+}
```

**File**: `framework/warp/prompt.go` (modified, +1/-0)
```diff
@@ -94,6 +94,7 @@ Linking to the dashboard:
 - A result that reports a success rate may also carry a "failures_link", narrowed to the failed requests. When you report a failure or error rate, or talk about the failures, link to failures_link rather than logs_link - logs_link on such a result opens every request, not the failures.
 - A result filtered by error_types, error_codes or status_codes carries no logs_link, because the Logs page cannot show that set. Link the individual rows instead, and do not substitute a wider link.
 - Never invent a link. Use only the link and logs_link values the tools returned, exactly as given. A link that leads nowhere is worse than no link.
+- Those values are root-relative paths ("/workspace/logs?..."). That is their complete form: the dashboard opens them on whatever domain it is served from, which you do not know. Do not add a scheme or a domain, and never stand in a placeholder such as "https://.../" - a link you cannot complete is a row you leave unlinked, without remarking on it.
 
 What you can and cannot do:
 
```

---

### Incident Patch 8: `19ecdb51` (2026-09-30)
**Commit Message**: dependabot fixes (#7744)

## Summary

Briefly explain the purpose of this PR and the problem it solves.

## Changes

- What was changed and why
- Any notable design decisions or trade-offs

## Type of change

- [ ] Bug fix
- [ ] Feature
- [ ] Refactor
- [ ] Documentation
- [ ] Chore/CI

## Affected areas

- [ ] Core (Go)
- [ ] Transports (HTTP)
- [ ] Providers/Integrations
- [ ] Plugins
- [ ] UI (React)
- [ ] Docs

## How to test

Describe the steps to validate this change. Include commands and expected outcomes.

```sh
# Core/Transports
go version
go test ./...

# UI
cd ui
pnpm i || npm i
pnpm test || npm test
pnpm build || npm run build
```

If adding new configs or environment variables, document them here.

## Screenshots/Recordings

If UI changes, add before/after screenshots or short clips.

## Breaking changes

- [ ] Yes
- [ ] No

If yes, describe impact and migration instructions.

## Related issues

Link related issues and discussions. Example: Closes #123

## Security considerations

Note any security implications (auth, secrets, PII, sandboxing, etc.).

## Checklist

- [ ] I read `docs/contributing/README.md` and followed the guidelines
- [ ] I added/updated tests where 

**File**: `.github/workflows/tools/package-lock.json` (modified, +6/-6)
```diff
@@ -909,9 +909,9 @@
       "license": "ISC"
     },
     "node_modules/ip-address": {
-      "version": "10.5.0",
-      "resolved": "https://registry.npmjs.org/ip-address/-/ip-address-10.5.0.tgz",
-      "integrity": "sha512-R5SnVLJmgYYvf2F2ZgwSBnelz5G4q5AxIC277GDfUaNbrZKNANcBC7RHqYYePlszf4kBolVkJauG0ZjHHFh55g==",
+      "version": "10.7.2",
+      "resolved": "https://registry.npmjs.org/ip-address/-/ip-address-10.7.2.tgz",
+      "integrity": "sha512-7H/2gFSIitxc0hG3nOI1glS8QLo/EHBFFLk8vEUjXY/xu0AdL8jZ9U1IzO2PUm0d2D/ofQcAifb0g6OBkt8U7w==",
       "license": "MIT",
       "engines": {
         "node": ">= 12"
@@ -1194,9 +1194,9 @@
       }
     },
     "node_modules/moment": {
-      "version": "2.30.1",
-      "resolved": "https://registry.npmjs.org/moment/-/moment-2.30.1.tgz",
-      "integrity": "sha512-uEmtNhbDOrWPFS+hdjFCBfy9f2YoyzRpwcl+DqpC6taX21FzsTLQVbMV/W7PzNSX6x/bhC1zA3c2UQ5NzH6how==",
+      "version": "2.31.0",
+      "resolved": "https://registry.npmjs.org/moment/-/moment-2.31.0.tgz",
+      "integrity": "sha512-0acOTfMiWOheYS4eoWb80yYMb/JLvVv9SHbs2PehaDzfUG0Bw855SKyk0IKTnPGa5+U2bmi3W68l1+sGLX/pvw==",
       "license": "MIT",
       "engines": {
         "node": "*"
```

**File**: `examples/mcps/edge-case-server/package-lock.json` (modified, +3/-3)
```diff
@@ -481,9 +481,9 @@
       "license": "MIT"
     },
     "node_modules/fast-uri": {
-      "version": "3.1.7",
-      "resolved": "https://registry.npmjs.org/fast-uri/-/fast-uri-3.1.7.tgz",
-      "integrity": "sha512-dOvZVzjdZdz7phd9v6jCbwxrBW3fK6n8Rc0CtdmM4bumzMnxywBYhuph6J819RRw/ku+rLbelwfMunktuzVVHg==",
+      "version": "3.1.8",
+      "resolved": "https://registry.npmjs.org/fast-uri/-/fast-uri-3.1.8.tgz",
+      "integrity": "sha512-GZMtZUTNRpOVIECoXwLNZS5xUGE+mVNbTB8h/7Rwh2TFWcBQiPzTgyZi05BF9UMZKkLJv8XBRJTlU7zg8+ZfMg==",
       "funding": [
         {
           "type": "github",
```

**File**: `examples/mcps/edge-case-server/package.json` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@
     "typescript": "5.3.3"
   },
   "overrides": {
-    "fast-uri": "3.1.7",
+    "fast-uri": "3.1.8",
     "hono": "4.13.5",
     "@hono/node-server": "2.0.10"
   }
```

**File**: `examples/mcps/error-test-server/package-lock.json` (modified, +3/-3)
```diff
@@ -481,9 +481,9 @@
       "license": "MIT"
     },
     "node_modules/fast-uri": {
-      "version": "3.1.7",
-      "resolved": "https://registry.npmjs.org/fast-uri/-/fast-uri-3.1.7.tgz",
-      "integrity": "sha512-dOvZVzjdZdz7phd9v6jCbwxrBW3fK6n8Rc0CtdmM4bumzMnxywBYhuph6J819RRw/ku+rLbelwfMunktuzVVHg==",
+      "version": "3.1.8",
+      "resolved": "https://registry.npmjs.org/fast-uri/-/fast-uri-3.1.8.tgz",
+      "integrity": "sha512-GZMtZUTNRpOVIECoXwLNZS5xUGE+mVNbTB8h/7Rwh2TFWcBQiPzTgyZi05BF9UMZKkLJv8XBRJTlU7zg8+ZfMg==",
       "funding": [
         {
           "type": "github",
```

**File**: `examples/mcps/error-test-server/package.json` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@
     "typescript": "5.3.3"
   },
   "overrides": {
-    "fast-uri": "3.1.7",
+    "fast-uri": "3.1.8",
     "hono": "4.13.5",
     "@hono/node-server": "2.0.10"
   }
```

---

### Incident Patch 9: `ec081ef5` (2026-09-30)
**Commit Message**: fix(ui): seed chart containers with a positive initial dimension (#7594)

* fix(ui): give every chart container a zero floor so Recharts stops warning

ResponsiveContainer measures its parent before layout has sized it, reads -1
for both axes and logs "The width(-1) and height(-1) of chart should be greater
than 0" several times per page load. Every chart mounts the same way, so every
one of them can warn.

* fix(ui): seed chart containers with a positive initial dimension

The previous commit passed minWidth={0} and minHeight={0}. Both were no-ops.
recharts 3.8.1 already defaults minWidth to 0, and neither prop reaches the
warning predicate: ResponsiveContainer.js:144 tests calculatedWidth > 0 ||
calculatedHeight > 0, and minWidth and minHeight appear only as format
arguments inside the message.

calculateChartDimensions returns containerWidth for a percentage width, and
containerWidth is seeded from initialDimension, which defaults to -1. Pass
initialDimension={{ width: 1, height: 1 }} so the first render carries a
positive dimension and the predicate holds before ResizeObserver measures.

A 1x1 first frame is not a visible change: with the -1 default,
isAcceptableSize rejects th

**File**: `ui/app/pprof/page.tsx` (modified, +2/-2)
```diff
@@ -900,7 +900,7 @@ export default function PprofPage() {
 								<span className="text-sm text-zinc-500">(last 5 min)</span>
 							</div>
 							<div className="h-64">
-								<ResponsiveContainer width="100%" height="100%">
+								<ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
 									<AreaChart data={cpuChartData}>
 										<defs>
 											<linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
@@ -981,7 +981,7 @@ export default function PprofPage() {
 								<span className="text-sm text-zinc-500">(last 5 min)</span>
 							</div>
 							<div className="h-64">
-								<ResponsiveContainer width="100%" height="100%">
+								<ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
 									<AreaChart data={memoryChartData}>
 										<defs>
 											<linearGradient id="allocGradient" x1="0" y1="0" x2="0" y2="1">
```

**File**: `ui/app/workspace/dashboard/components/charts/chartErrorBoundary.tsx` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ import { BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from "rech
 // Empty chart placeholder when data fails to render
 function EmptyChart() {
 	return (
-		<ResponsiveContainer width="100%" height="100%">
+		<ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
 			<BarChart
 				data={[
 					{ name: "", value: 0 },
```

**File**: `ui/app/workspace/dashboard/components/charts/costChart.tsx` (modified, +1/-1)
```diff
@@ -123,7 +123,7 @@ function CostChartImpl({ data, chartType, startTime, endTime, selectedModel }: C
 
 	return (
 		<ChartErrorBoundary resetKey={`${startTime}-${endTime}-${chartData.length}-${selectedModel}`}>
-			<ResponsiveContainer width="100%" height="100%">
+			<ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
 				{chartType === "bar" ? (
 					<BarChart {...commonProps} barCategoryGap={1}>
 						<CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-zinc-200 dark:stroke-zinc-700" />
```

**File**: `ui/app/workspace/dashboard/components/charts/externalCacheTokenMeterChart.tsx` (modified, +1/-1)
```diff
@@ -46,7 +46,7 @@ function ExternalCacheTokenMeterChartImpl({ data }: ExternalCacheTokenMeterChart
 					{!hasData && <div className="text-muted-foreground flex h-full items-center justify-center text-sm">No data available</div>}
 					{hasData && gaugeGeometry && (
 						<>
-							<ResponsiveContainer width="100%" height="100%">
+							<ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
 								<PieChart>
 									<Pie
 										data={valueData}
```

**File**: `ui/app/workspace/dashboard/components/charts/latencyChart.tsx` (modified, +1/-1)
```diff
@@ -84,7 +84,7 @@ function LatencyChartImpl({ data, chartType, startTime, endTime }: LatencyChartP
 
 	return (
 		<ChartErrorBoundary resetKey={`${startTime}-${endTime}-${chartData.length}`}>
-			<ResponsiveContainer width="100%" height="100%">
+			<ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
 				{chartType === "bar" ? (
 					<BarChart {...commonProps} barCategoryGap={1}>
 						<CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-zinc-200 dark:stroke-zinc-700" />
```

---

### Incident Patch 10: `f9bc38a1` (2026-09-30)
**Commit Message**: fix: gemini rejecting tools with $ref (#7713)

## Summary

Fixes a 400 error from Gemini when tool output contains a `$ref` key anywhere in its JSON structure. Gemini interprets `{"$ref": "<name>"}` inside `function_response.response` as a pointer to a multimodal part in `function_response.parts`, and rejects the request with `"does not match to a display_name in the function_response.parts"` when no such part exists. Since JSON Schema and OpenAPI tool output routinely uses `$ref`, any agent session that returned a spec or schema fragment would break for the remainder of the conversation.

## Changes

- Introduced `containsJSONRefKey` in `utils.go` to recursively scan a JSON value for any object carrying a `"$ref"` key, with a fast-path byte scan for the `"ref"` substring before invoking the full walk.
- Introduced `geminiFunctionOutputValue` to centralize the decision: embed tool output as raw JSON only when it is a valid JSON object **and** contains no `$ref` key at any depth; otherwise forward it as an opaque string.
- Applied `geminiFunctionOutputValue` in `convertResponsesMessagesToGeminiContents` (Responses API path) across all three output forms: string output, content-block

**File**: `core/providers/gemini/chat_test.go` (modified, +112/-0)
```diff
@@ -9,6 +9,7 @@ import (
 	schemas "github.com/maximhq/bifrost/core/schemas"
 	"github.com/stretchr/testify/assert"
 	"github.com/stretchr/testify/require"
+	"github.com/tidwall/gjson"
 )
 
 // Gemini image-generation models (e.g. gemini-2.5-flash-image) return the
@@ -433,3 +434,114 @@ func TestToGeminiChatCompletionRequest_NMapsToCandidateCount(t *testing.T) {
 		}
 	}
 }
+
+// chatToolResultHasRefKey reports whether any object at any depth of raw has a "$ref" key.
+// Gemini reads {"$ref": "<displayName>"} inside function_response.response as a pointer to
+// a multimodal part, so a caller's JSON Schema / OpenAPI tool output must never reach the
+// wire with one (#7694).
+func chatToolResultHasRefKey(raw []byte) bool {
+	var found bool
+	var walk func(v gjson.Result)
+	walk = func(v gjson.Result) {
+		v.ForEach(func(key, value gjson.Result) bool {
+			if v.IsObject() && key.String() == "$ref" {
+				found = true
+				return false
+			}
+			if value.IsObject() || value.IsArray() {
+				walk(value)
+			}
+			return !found
+		})
+	}
+	walk(gjson.ParseBytes(raw))
+	return found
+}
+
+// TestToGeminiChatCompletionRequest_ToolResultRefKeyStaysOpaque pins that a role:"tool"
+// message whose content is a JSON object containing a "$ref" key anywhere is sent to
+// Gemini as opaque string content ({"content": "<verbatim text>"}), never as a structured
+// function_response.response. Gemini reserves "$ref" there for multimodal part references
+// and rejects the request with 400 "does not match to a display_name in the
+// function_response.parts" otherwise (#7694). Tool output without "$ref" keeps the
+// structured fast path.
+func TestToGeminiChatCompletionRequest_ToolResultRefKeyStaysOpaque(t *testing.T) {
+	const refOutput = `{"schema":{"$ref":"#/components/schemas/SOM_computer_post_response"}}`
+	const plainOutput = `{"temperature":22,"condition":"sunny"}`
+
+	build := func(content *schemas.ChatMessageContent) *schemas.BifrostChatRequest {
+		return &schemas.BifrostChatRequest{
+			Provider: schemas.Gemini,
+			Model:    "gemini-flash-latest",
+			Input: []schemas.ChatMessage{
+				{
+					Role:    schemas.ChatMessageRoleUser,
+					Content: &schemas.ChatMessageContent{ContentStr: schemas.Ptr("Fetch the spec, then reply ok.")},
+				},
+				{
+					Role: schemas.ChatMessageRoleAssistant,
+					ChatAssistantMessage: &schemas.ChatAssistantMessage{
+						ToolCalls: []schemas.ChatAssistantMessageToolCall{{
+							ID:   schemas.Ptr("c1"),
+							Type: schemas.Ptr("function"),
+							Function: schemas.ChatAssistantMessageToolCallFunction{
+								Name:      schemas.Ptr("bash"),
+								Arguments: `{"command":"cat spec.json"}`,
+							},
+						}},
+					},
+				},
+				{
+					Role:            schemas.ChatMessageRoleTool,
+					ChatToolMessage: &schemas.ChatToolMessage{ToolCallID: schemas.Ptr("c1")},
+					Content:         content,
+				},
+			},
+		}
+	}
+
+	functionResponse := func(t *testing.T, req *schemas.BifrostChatRequest) []byte {
+		t.Helper()
+		out, err := gemini.ToGeminiChatCompletionRequest(nil, req)
+		require.NoError(t, err)
+		require.Len(t, out.Contents, 3)
+		require.Len(t, out.Contents[2].Parts, 1)
+		require.NotNil(t, out.Contents[2].Parts[0].FunctionResponse)
+		return out.Contents[2].Parts[0].FunctionResponse.Response
+	}
+
+	t.Run("string content with nested $ref is wrapped as opaque text", func(t *testing.T) {
+		resp := functionResponse(t, build(&schemas.ChatMessageContent{ContentStr: schemas.Ptr(refOutput)}))
+		assert.False(t, chatToolResultHasRefKey(resp), "function_response.response must not carry a $ref key: %s", resp)
+		assert.Equal(t, refOutput, gjson.GetBytes(resp, "content").String(), "tool text must survive verbatim under \"content\"")
+	})
+
+	t.Run("text block content with nested $ref is wrapped as opaque text", func(t *testing.T) {
+		resp := functionResponse(t, build(&schemas.ChatMessageContent{ContentBlocks: []schemas.ChatContentBlock{{
+			Type: schemas.ChatContentBlockTypeText,
+			T
```

**File**: `core/providers/gemini/responses.go` (modified, +3/-18)
```diff
@@ -4718,12 +4718,7 @@ func convertResponsesMessagesToGeminiContents(messages []schemas.ResponsesMessag
 
 					// Extract output from ResponsesToolMessage.Output
 					if msg.ResponsesToolMessage.Output != nil && msg.ResponsesToolMessage.Output.ResponsesToolCallOutputStr != nil {
-						output := *msg.ResponsesToolMessage.Output.ResponsesToolCallOutputStr
-						if json.Valid([]byte(output)) {
-							responseMap["output"] = json.RawMessage(output)
-						} else {
-							responseMap["output"] = output
-						}
+						responseMap["output"] = geminiFunctionOutputValue(*msg.ResponsesToolMessage.Output.ResponsesToolCallOutputStr)
 					} else if msg.ResponsesToolMessage.Output != nil && msg.ResponsesToolMessage.Output.ResponsesFunctionToolCallOutputBlocks != nil {
 						// Handle structured output blocks (e.g. from the OpenAI/Anthropic Responses API
 						// format where output is an array of content blocks like
@@ -4770,12 +4765,7 @@ func convertResponsesMessagesToGeminiContents(messages []schemas.ResponsesMessag
 							}
 						}
 						if len(textParts) > 0 {
-							combined := strings.Join(textParts, "\n")
-							if json.Valid([]byte(combined)) {
-								responseMap["output"] = json.RawMessage(combined)
-							} else {
-								responseMap["output"] = combined
-							}
+							responseMap["output"] = geminiFunctionOutputValue(strings.Join(textParts, "\n"))
 						} else if len(funcMediaParts) > 0 {
 							// Media-only result: the content lives in parts. We intentionally emit
 							// {"output": ""} rather than leaving response as {} — an empty object would
@@ -4786,12 +4776,7 @@ func convertResponsesMessagesToGeminiContents(messages []schemas.ResponsesMessag
 						}
 					} else if msg.Content != nil && msg.Content.ContentStr != nil {
 						// Fallback to Content.ContentStr for backward compatibility
-						output := *msg.Content.ContentStr
-						if json.Valid([]byte(output)) {
-							responseMap["output"] = json.RawMessage(output)
-						} else {
-							responseMap["output"] = output
-						}
+						responseMap["output"] = geminiFunctionOutputValue(*msg.Content.ContentStr)
 					}
 
 					// Prefer the declared tool name; fallback to callIDToName lookup, then raw CallID
```

**File**: `core/providers/gemini/responses_test.go` (modified, +126/-0)
```diff
@@ -11,6 +11,7 @@ import (
 
 	"github.com/maximhq/bifrost/core/internal/memtest"
 	"github.com/maximhq/bifrost/core/schemas"
+	"github.com/tidwall/gjson"
 	"github.com/valyala/fasthttp"
 )
 
@@ -319,3 +320,128 @@ func TestGeminiResponsesStreamContentlessFinishReasonReachesTerminal(t *testing.
 	assertGeminiResponsesStatus(t, terminal.Response.Status, terminal.Response.IncompleteDetails,
 		schemas.ResponsesResponseStatusIncomplete, schemas.ResponsesResponseIncompleteReasonMaxOutputTokens)
 }
+
+// responsesToolOutputHasRefKey reports whether any object at any depth of raw has a "$ref"
+// key. Gemini reads {"$ref": "<displayName>"} inside function_response.response as a pointer
+// to a multimodal part (#7694).
+func responsesToolOutputHasRefKey(raw []byte) bool {
+	var found bool
+	var walk func(v gjson.Result)
+	walk = func(v gjson.Result) {
+		v.ForEach(func(key, value gjson.Result) bool {
+			if v.IsObject() && key.String() == "$ref" {
+				found = true
+				return false
+			}
+			if value.IsObject() || value.IsArray() {
+				walk(value)
+			}
+			return !found
+		})
+	}
+	walk(gjson.ParseBytes(raw))
+	return found
+}
+
+// TestConvertResponsesMessagesToGeminiContents_FunctionOutputRefKeyStaysOpaque pins the
+// Responses API twin of #7694: a function_call_output whose text is a JSON object holding a
+// "$ref" key anywhere must reach Gemini as an opaque string under "output", not embedded as
+// raw JSON, for both the string form and the content-block form of the output. Output without
+// "$ref" keeps the structured embedding.
+func TestConvertResponsesMessagesToGeminiContents_FunctionOutputRefKeyStaysOpaque(t *testing.T) {
+	const refOutput = `{"schema":{"$ref":"#/components/schemas/SOM_computer_post_response"}}`
+	const plainOutput = `{"temperature":22,"condition":"sunny"}`
+
+	build := func(output *schemas.ResponsesToolMessageOutputStruct) []schemas.ResponsesMessage {
+		return []schemas.ResponsesMessage{
+			{
+				Role:    schemas.Ptr(schemas.ResponsesInputMessageRoleUser),
+				Type:    schemas.Ptr(schemas.ResponsesMessageTypeMessage),
+				Content: &schemas.ResponsesMessageContent{ContentStr: schemas.Ptr("Fetch the spec, then reply ok.")},
+			},
+			{
+				Type: schemas.Ptr(schemas.ResponsesMessageTypeFunctionCall),
+				ResponsesToolMessage: &schemas.ResponsesToolMessage{
+					CallID:    schemas.Ptr("c1"),
+					Name:      schemas.Ptr("bash"),
+					Arguments: schemas.Ptr(`{"command":"cat spec.json"}`),
+				},
+			},
+			{
+				Type: schemas.Ptr(schemas.ResponsesMessageTypeFunctionCallOutput),
+				ResponsesToolMessage: &schemas.ResponsesToolMessage{
+					CallID: schemas.Ptr("c1"),
+					Name:   schemas.Ptr("bash"),
+					Output: output,
+				},
+			},
+		}
+	}
+
+	functionResponse := func(t *testing.T, msgs []schemas.ResponsesMessage) []byte {
+		t.Helper()
+		contents, _, err := convertResponsesMessagesToGeminiContents(msgs, "gemini-flash-latest", schemas.Gemini)
+		if err != nil {
+			t.Fatalf("convert: %v", err)
+		}
+		for _, c := range contents {
+			for _, p := range c.Parts {
+				if p.FunctionResponse != nil {
+					return p.FunctionResponse.Response
+				}
+			}
+		}
+		t.Fatal("no functionResponse part produced")
+		return nil
+	}
+
+	t.Run("string output with nested $ref is wrapped as opaque text", func(t *testing.T) {
+		resp := functionResponse(t, build(&schemas.ResponsesToolMessageOutputStruct{
+			ResponsesToolCallOutputStr: schemas.Ptr(refOutput),
+		}))
+		if responsesToolOutputHasRefKey(resp) {
+			t.Errorf("function_response.response must not carry a $ref key: %s", resp)
+		}
+		if got := gjson.GetBytes(resp, "output"); got.Type != gjson.String || got.String() != refOutput {
+			t.Errorf("tool text must survive verbatim as a string under \"output\", got %s", resp)
+		}
+	})
+
+	t.Run("text block output with nested $ref is wrapped as opaque text", func(t *testing.T) {
+		resp := functionResponse(t, build(&schemas.ResponsesToolMessageOutputStruct{
+			ResponsesFunctionToolCallOutputBlocks: 
```

**File**: `core/providers/gemini/utils.go` (modified, +44/-4)
```diff
@@ -2174,14 +2174,15 @@ func convertBifrostMessagesToGemini(messages []schemas.ChatMessage, allowedImage
 				}
 			}
 
-			// Try to use raw JSON if it's a valid JSON object (Gemini requires Struct/object)
+			// Try to use raw JSON if it's a valid JSON object (Gemini requires Struct/object).
+			// An object carrying a "$ref" key anywhere is wrapped instead: see containsJSONRefKey.
 			if contentStr != "" {
 				var buf bytes.Buffer
-				if err := json.Compact(&buf, []byte(contentStr)); err == nil && buf.Len() > 0 && buf.Bytes()[0] == '{' {
-					// Valid JSON object — use raw bytes directly
+				if err := json.Compact(&buf, []byte(contentStr)); err == nil && buf.Len() > 0 && buf.Bytes()[0] == '{' && !containsJSONRefKey(buf.Bytes()) {
+					// Valid JSON object without reserved keys — use raw bytes directly
 					responseData = json.RawMessage(buf.Bytes())
 				} else {
-					// Not valid JSON or not an object — wrap to preserve content
+					// Not valid JSON, not an object, or holds "$ref" — wrap to preserve content
 					responseData, _ = providerUtils.MarshalSorted(map[string]any{
 						"content": contentStr,
 					})
@@ -3045,6 +3046,45 @@ func extractSchemaMapFromResponseFormat(responseFormat *interface{}) interface{}
 	return nil
 }
 
+// containsJSONRefKey reports whether any object nested anywhere in raw carries a "$ref" key.
+//
+// Gemini reads {"$ref": "<displayName>"} inside function_response.response as a pointer to a
+// multimodal part in function_response.parts and rejects the whole request with 400 ("does not
+// match to a display_name") when no such part exists. Tool output uses "$ref" for ordinary
+// reasons (JSON Schema, OpenAPI), so the converters send such a result as opaque text instead of
+// a structured object (#7694). There is deliberately no byte-level pre-check: JSON lets any
+// character of a key be written as a \uXXXX escape, and only the parser walk, which compares the
+// unescaped key, catches every spelling.
+func containsJSONRefKey(raw []byte) bool {
+	found := false
+	var walk func(v gjson.Result)
+	walk = func(v gjson.Result) {
+		isObject := v.IsObject()
+		v.ForEach(func(key, value gjson.Result) bool {
+			if isObject && key.String() == "$ref" {
+				found = true
+				return false
+			}
+			if value.IsObject() || value.IsArray() {
+				walk(value)
+			}
+			return !found
+		})
+	}
+	walk(gjson.ParseBytes(raw))
+	return found
+}
+
+// geminiFunctionOutputValue returns a function result for embedding under a key of
+// function_response.response: raw JSON when output is valid JSON with no "$ref" key at any
+// depth, otherwise the string itself so Gemini treats it as opaque text (#7694).
+func geminiFunctionOutputValue(output string) any {
+	if json.Valid([]byte(output)) && !containsJSONRefKey([]byte(output)) {
+		return json.RawMessage(output)
+	}
+	return output
+}
+
 // extractFunctionResponseOutput extracts the output text from a FunctionResponse.
 // It first tries to extract the "output" field if present, otherwise marshals the entire response.
 // Returns an empty string if the response is nil or extraction fails.
```

**File**: `tests/e2e/api/collections/provider-harness.json` (modified, +180/-0)
```diff
@@ -177564,6 +177564,186 @@
           "name": "[EXPECT-400] openai openai/gpt-5-mini /v1/chat/completions conflicting reasoning_effort high vs reasoning.effort low still rejected - #7659"
         }
       ]
+    },
+    {
+      "name": "128. Gemini tool result with $ref key stays opaque (#7694)",
+      "description": "Issue #7694: a role:\"tool\" message (or Responses function_call_output) whose content is a JSON object was forwarded to Gemini verbatim as function_response.response. Gemini 3+ reads any nested {\"$ref\": \"<name>\"} in that object as a pointer to a display_name in function_response.parts and rejects the request with 400 \"The referenced name ... does not match to a display_name in the function_response.parts\". JSON Schema / OpenAPI tool output uses $ref routinely, so any agent session that cats a spec broke for the rest of the conversation. Fix: core/providers/gemini (convertBifrostMessagesToGemini, convertResponsesMessagesToGeminiContents) sends a JSON tool result as opaque string content whenever any nested object carries a $ref key, on both the Gemini Developer API and Vertex. Each case pins: the pre-fix error substring is absent, HTTP 200, and a normal completion shape.",
+      "item": [
+        {
+          "name": "gemini gemini/gemini-3.7-flash /v1/chat/completions tool result JSON with nested $ref stays opaque -> 200 (non-streaming) - #7694",
+          "event": [
+            {
+              "listen": "test",
+              "script": {
+                "type": "text/javascript",
+                "exec": [
+                  "pm.test('gemini/gemini-3.7-flash tool result containing $ref is not read as a part reference - #7694', function () {",
+                  "  pm.expect(pm.response.text(), 'pre-fix signature present: ' + pm.response.text()).to.not.include('does not match to a display_name');",
+                  "  pm.expect(pm.response.code, 'failed: ' + pm.response.text()).to.equal(200);",
+                  "  var j = pm.response.json();",
+                  "  pm.expect(j.choices && j.choices.length, 'no choices: ' + pm.response.text()).to.be.above(0);",
+                  "  pm.expect(j.choices[0].message, 'no message: ' + pm.response.text()).to.be.an('object');",
+                  "});"
+                ]
+              }
+            }
+          ],
+          "request": {
+            "method": "POST",
+            "header": [
+              {
+                "key": "Content-Type",
+                "value": "application/json"
+              }
+            ],
+            "body": {
+              "mode": "raw",
+              "raw": "{\"model\":\"gemini/gemini-3.7-flash\",\"max_tokens\":20,\"messages\":[{\"role\":\"user\",\"content\":\"Fetch the spec, then reply ok.\"},{\"role\":\"assistant\",\"content\":null,\"tool_calls\":[{\"id\":\"c1\",\"type\":\"function\",\"function\":{\"name\":\"bash\",\"arguments\":\"{\\\"command\\\":\\\"cat spec.json\\\"}\"}}]},{\"role\":\"tool\",\"tool_call_id\":\"c1\",\"content\":\"{\\\"schema\\\":{\\\"$ref\\\":\\\"#/components/schemas/SOM_computer_post_response\\\"}}\"}],\"tools\":[{\"type\":\"function\",\"function\":{\"name\":\"bash\",\"description\":\"run\",\"parameters\":{\"type\":\"object\",\"properties\":{\"command\":{\"type\":\"string\"}},\"required\":[\"command\"]}}}]}"
+            },
+            "url": {
+              "raw": "{{baseUrl}}/v1/chat/completions",
+              "host": [
+                "{{baseUrl}}"
+              ],
+              "path": [
+                "v1",
+                "chat",
+                "completions"
+              ]
+            }
+          }
+        },
+        {
+          "name": "gemini gemini/gemini-3.7-flash /v1/chat/completions tool result JSON with nested $ref stays opaque -> 200 (streaming) - #7694",
+          "event": [
+            {
+              "listen": "test",
+              "script": {
+                "type": "text/javascript",
+                "exec": [
+                  "pm.test('gemi
```

#### Recent Merged Pull Requests:
- **PR #7770** (closed): fixes: Bifrost ignores "store": false in additionalModelRequestFields on the Bedrock Converse route (@akshaydeo)
- **PR #7757** (2026-09-30): feat(warp): feature flag on by default (@kohlivrinda)
- **PR #7756** (2026-09-30): feat(warp): themes related questions sample logs instead of using semantic search (@kohlivrinda)
- **PR #7755** (2026-09-30): docs: add A10 Guardrails provider integration docs (@Madhuvod)
- **PR #7752** (2026-09-30): feat(warp): an unrestricted caller's questions cover the whole deployment (@kohlivrinda)
- **PR #7750** (2026-09-30): feat(warp): read a key and a person the way the dashboard does (@kohlivrinda)
- **PR #7749** (2026-09-30): docs: updated docs for jev router (@Madhuvod)
- **PR #7747** (closed): feat(warp): read a ket and a person the way the dashboard does (@kohlivrinda)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
