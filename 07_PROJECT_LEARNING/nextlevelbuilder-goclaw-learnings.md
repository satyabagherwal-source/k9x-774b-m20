# Forensic Learning Record (Deep Inspection): nextlevelbuilder/goclaw

> **Canonical Artifact**: `07_PROJECT_LEARNING/nextlevelbuilder-goclaw-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/nextlevelbuilder/goclaw](https://github.com/nextlevelbuilder/goclaw))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:02:45.411Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `nextlevelbuilder/goclaw`
- **Description**: GoClaw - GoClaw is OpenClaw rebuilt in Go — with multi-tenant isolation, 5-layer security, and native concurrency. Deploy AI agent teams at scale without compromising on safety.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 3639 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cmd/gateway_announce_queue.go`
```
package cmd

import (
	"context"
	"fmt"
	"log/slog"
	"path/filepath"
	"strings"

	"github.com/google/uuid"

	"github.com/nextlevelbuilder/goclaw/internal/agent"
	"github.com/nextlevelbuilder/goclaw/internal/bus"
	"github.com/nextlevelbuilder/goclaw/internal/channels"
	"github.com/nextlevelbuilder/goclaw/internal/config"
	orch "github.com/nextlevelbuilder/goclaw/internal/orchestration"
	"github.com/nextlevelbuilder/goclaw/internal/scheduler"
	"github.com/nextlevelbuilder/goclaw/internal/store"
	"github.com/nextlevelbuilder/goclaw/internal/tools"
)

// announceEntry holds one teammate completion result waiting to be announced.
type announceEntry struct {
	MemberAgent       string // agent key (e.g. "researcher")
	MemberDisplayName string // display name (e.g. "Nhà Nghiên Cứu"), empty if not set
	Content           string
	Media             []agent.MediaResult
}

// teamAnnounceQueue uses BatchQueue for producer-consumer synchronization.
var teamAnnounceQueue orch.BatchQueue[announceEntry]

// enqueueAnnounce adds a result to the queue. Returns isProcessor.
// If isProcessor=true, the caller must run processAnnounceLoop.
func enqueueAnnounce(key string, entry announceEntry) bool {
	return teamAnnounceQueue.Enqueue(key, entry)
}

// announceRouting holds the shared routing info captured by the first goroutine.
type announceRouting struct {
	LeadAgent      string
	LeadSessionKey string
	OrigChannel    string
	OrigChatID     string
	OrigPeerKind   string
	OrigLocalKey   string
	OriginUserID   string
	// OriginSenderID and OriginRole carry the real acting human's identity
	// from the original team-task dispatch. Without them, the Lead's session
	// resumes from this re-ingress with an empty SenderID, which then fails
	// CheckFileWriterPermission / CheckCronPermission in group contexts
	// ("system context cannot write files in group chats"). The subagent
	// announce queue (subagentAnnounceRouting) already carries these fields
	// — this keeps the team-task announce queue at parity. (#915 follow-up)
	OriginSenderID   string
	OriginRole       string
	TeamID           string
	TeamWorkspace    string
	OriginTraceID    string
	ParentTraceID    uuid.UUID
	ParentRootSpanID uuid.UUID
	OutMeta          map[string]string
}

// processAnnounceLoop drains entries, builds merged announce, schedules to leader.
// Loops until queue is empty.
func processAnnounceLoop(
	ctx context.Context,
	r announceRouting,
	sched *scheduler.Scheduler,
	msgBus *bus.MessageBus,
	teamStore store.TeamStore,
	postTurn tools.PostTurnProcessor,
	cfg *config.Config,
	channelMgr *channels.Manager,
) {
	for {
		entries := teamAnnounceQueue.Drain(r.LeadSessionKey)
		if len(entries) == 0 {
			if teamAnnounceQueue.TryFinish(r.LeadSessionKey) {
				return
			}
			continue // entries arrived between drain and tryFinish
		}

		// Build task board snapshot (latest state, after all completions in this batch).
		snapshot := ""
		if r.TeamID != "" && r.OriginTraceID != "" {
			if teamUUID, err := uuid.Parse(r.TeamID); err == nil {
				snapshot = buildTaskBoardSnapshot(ctx, teamStore, teamUUID, r.OrigChatID, r.OriginTraceID)
			}
		}

		content := buildMergedAnnounceContent(entries, snapshot, r.TeamWorkspace)

		req := agent.RunRequest{
			SessionKey: r.LeadSessionKey,
			Message:    content,
			Channel:    r.OrigChannel,
			ChatTitle:  resolveGroupDisplayTitle(ctx, channelMgr, r.OrigChannel, r.OrigChatID, r.OrigPeerKind, ""),
			ChatID:     r.OrigChatID,
			PeerKind:   r.OrigPeerKind,
			LocalKey:   r.OrigLocalKey,
			UserID:     r.OriginUserID,
			// SenderID + Role propagate the original human acting through this
			// team-task announce. loop_context.injectContext gates WithSenderID
			// on req.SenderID being non-empty, so missing them silently strips
			// the Lead's identity on resume — and group-scoped permission
			// checks then deny write_file etc. (#915 follow-up)
			SenderID:         r.OriginSenderID,
			Role:             r.OriginRole,
			RunID:            fmt.Sprintf("teammate-announce-%s-%d", r.LeadAgent, len(entries)),
			RunKind:          "announce",
			HideInput:        true,
			Stream:           false,
			TeamID:           r.TeamID,
			ParentTraceID:    r.ParentTraceID,
			ParentRootSpanID: r.ParentRootSpanID,
		}
		// Collect all media from entries.
		for _, e := range entries {
			for _, mr := range e.Media {
				req.ForwardMedia = append(req.ForwardMedia, bus.MediaFile{
					Path:     mr.Path,
					MimeType: mr.ContentType,
					Filename: filepath.Base(mr.Path), // preserve sanitized stem from producer
				})
			}
		}
		// WS channel has no outbound media handler — deliver via ContentSuffix.
		if r.OrigChannel == "ws" && len(req.ForwardMedia) > 0 {
			req.ContentSuffix = mediaToMarkdownFromPaths(req.ForwardMedia, cfg)
			req.ForwardMedia = nil
		}

		// Process batch in closure so defer is scoped per iteration (panic safety).
		func() {
			ptd := tools.NewPendingTeamDispatch()
			defer ptd.ReleaseTeamLock()
			schedCtx := tools.WithPendingTeamDispatch(ctx, ptd)
			outCh := sched.Schedule(schedCtx, scheduler.LaneSubagent, req)
			outcome := <-outCh

			ptd.ReleaseTeamLock()
			if postTurn != nil {
				for tid, tIDs := range ptd.Drain() {
					if err := postTurn.ProcessPendingTasks(ctx, tid, tIDs); err != nil {
						slog.Warn("post_turn(announce): failed", "team_id", tid, "error", err)
					}
				}
			}

			if outcome.Err != nil {
				slog.Error("teammate announce: lead run failed", "error", outcome.Err, "batch_size", len(entries))
			} else {
				isSilent := outcome.Result.Content == "" || agent.IsSilentReply(outcome.Result.Content)
				if !(isSilent && len(outcome.Result.Media) == 0) {
					out := outcome.Result.Content
					if isSilent {
						out = ""
					}
					outMsg := bus.OutboundMessage{
						Channel:  r.OrigChannel,
						ChatID:   r.OrigChatID,
						Content:  out,
						Metadata: r.OutMeta,
					}
					appendMediaToOutbound(&outMsg, outcome.Result.Media)
					msgBus.PublishOutbound(outMsg)
				}
			}

			slog.Info("teammate announce: batch processed",
				"batch_size", len(entries), "session", r.LeadSessionKey)
		}()

		// Loop back — tryFinish at top will exit when queue is truly empty.
	}
}

// memberLabel returns a display-friendly name for announce messages.
func memberLabel(e announceEntry) string {
	if e.MemberDisplayName != "" {
		return fmt.Sprintf("%s (%s)", e.MemberDisplayName, e.MemberAgent)
	}
	return e.MemberAgent
}

// buildMergedAnnounceContent creates the announce message for one or more completed/failed tasks.
func buildMergedAnnounceContent(entries []announceEntry, taskBoardSnapshot, teamWorkspace string) string {
	var sb strings.Builder

	if len(entries) == 1 {
		e := entries[0]
		label := memberLabel(e)
		if strings.HasPrefix(e.Content, "[FAILED]") {
			fmt.Fprintf(&sb, "[System Message] Team member %q failed to complete task.\n\nError: %s", label, strings.TrimPrefix(e.Content, "[FAILED] "))
			sb.WriteString("\n\nInform the user about the failure. You may suggest retrying with team_tasks(action=\"retry\", task_id=\"...\") if appropriate.")
		} else {
			fmt.Fprintf(&sb, "[System Message] Team member %q completed task.\n\nResult:\n%s", label, e.Content)
		}
	} else {
		// Count successes vs failures for header.
		var failed, succeeded int
		for _, e := range entries {
			if strings.HasPrefix(e.Content, "[FAILED]") {
				failed++
			} else {
				succeeded++
			}
		}
		if failed > 0 && succeeded > 0 {
			fmt.Fprintf(&sb, "[System Message] %d task(s) completed, %d task(s) failed.\n", succeeded, failed)
		} else if failed > 0 {
			fmt.Fprintf(&sb, "[System Message] %d task(s) failed.\n", failed)
		} else {
			fmt.Fprintf(&sb, "[System Message] %d team tasks completed.\n", succeeded)
		}
		for _, e := range entries {
			label := memberLabel(e)
			if strings.HasPrefix(e.Content, "[FAILED]") {
				fmt.Fprintf(&sb, "\n--- FAILED: %q ---\nError: %s\n", label, strings.TrimPrefix(e.Content, "[FAILED] "))
			} else {
				fmt.Fprintf(&sb, "\n--- Result from %q ---\n%s\n", label, e.Content)
			}
		}
		if failed > 0 {
			sb.WriteString("\nFor failed tasks, you may suggest retrying with team_tasks(action=\"retry\", task_id=\"...\").")
		}
	}

	if taskBoardSnapshot != "" {
		sb.WriteString("\n\n")
		sb.WriteString(taskBoardSnapshot)
	}

	// Batch-aware prompting: guide leader to summarize vs acknowledge.
	allDone := strings.Contains(taskBoardSnapshot, "All ") && strings.Contains(taskBoardSnapshot, " completed")
	if allDone {
		sb.WriteString("\n\nAll tasks in this batch are completed. Present a comprehensive summary of ALL results to the user.")
	} else if taskBoardSnapshot != "" {
		sb.WriteString("\n\nSome tasks are still in progress. Briefly acknowledge this result (1-2 sentences). A full summary will come when all tasks complete.")
	} else {
		sb.WriteString("\n\nPresent this result to the user.")
	}

	sb.WriteString(" Any media files are forwarded automatically. Do NOT search for files — the results above contain all relevant information.")

	if teamWorkspace != "" {
		fmt.Fprintf(&sb, "\n[Team workspace: %s — use read_file/list_files to access shared files]", teamWorkspace)
	}

	return sb.String()
}

```

### Core Architecture Module: `cmd/gateway_hooks.go`
```
package cmd

import (
	"os"
	"time"

	"github.com/nextlevelbuilder/goclaw/internal/config"
	"github.com/nextlevelbuilder/goclaw/internal/edition"
	"github.com/nextlevelbuilder/goclaw/internal/hooks"
	"github.com/nextlevelbuilder/goclaw/internal/hooks/budget"
	hookhandlers "github.com/nextlevelbuilder/goclaw/internal/hooks/handlers"
	"github.com/nextlevelbuilder/goclaw/internal/providers"
	"github.com/nextlevelbuilder/goclaw/internal/security"
	"github.com/nextlevelbuilder/goclaw/internal/store"
	"github.com/nextlevelbuilder/goclaw/internal/store/pg"
	usagecaps "github.com/nextlevelbuilder/goclaw/internal/usage/caps"
)

// sharedHookHandlers is populated by wireExtras so the gateway.go router
// wiring can reuse the same handler instances for the `hooks.test` runner.
// nil when hook store is absent (hooks disabled).
var sharedHookHandlers map[hooks.HandlerType]hooks.Handler

// buildHookHandlers constructs the production handler map used by both the
// dispatcher (sync + async chain) and the `hooks.test` test runner. Keeping
// this factory single-source ensures test-panel behavior mirrors production.
//
// Budget wiring (C1 fix): the PromptHandler receives a budget.Store bound
// to pg.NewPGHookBudget so token spend is atomically deducted per tenant.
// When the DB handle is unavailable, budget falls back to nil (Lite desktop).
func buildHookHandlers(stores *store.Stores, providerReg *providers.Registry, hooksCfg config.HooksConfig, usageCapSvc *usagecaps.Service) map[hooks.HandlerType]hooks.Handler {
	encryptKey := os.Getenv("GOCLAW_ENCRYPTION_KEY")

	var budgetStore *budget.Store
	if stores != nil && stores.DB != nil {
		budgetStore = budget.New(pg.NewPGHookBudget(stores.DB), nil)
	}

	promptHandler := &hookhandlers.PromptHandler{
		Resolver:     hookhandlers.NewRegistryResolver(providerReg, stores.SystemConfigs),
		Budget:       budgetStore,
		UsageCaps:    usageCapSvc,
		DefaultModel: "haiku",
	}

	// ScriptHandler: bounded by cfg.Hooks caps; zero values fall back to
	// handler defaults (10 / 3 / 500). Safe for concurrent reuse across
	// dispatcher + hooks.test runner (each Execute allocates its own runtime).
	scriptHandler := hookhandlers.NewScriptHandler(
		hooksCfg.ScriptConcurrency,
		hooksCfg.ScriptPerTenantConcurrency,
		hooksCfg.ScriptCacheSize,
	)

	return map[hooks.HandlerType]hooks.Handler{
		hooks.HandlerCommand: &hookhandlers.CommandHandler{Edition: edition.Current()},
		hooks.HandlerHTTP: &hookhandlers.HTTPHandler{
			EncryptKey: encryptKey,
			Client:     security.NewSafeClient(10 * time.Second),
		},
		hooks.HandlerPrompt: promptHandler,
		hooks.HandlerScript: scriptHandler,
	}
}

```

### Core Architecture Module: `cmd/gateway_lifecycle.go`
```
package cmd

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"strings"
	"time"

	"github.com/nextlevelbuilder/goclaw/internal/bus"
	"github.com/nextlevelbuilder/goclaw/internal/cache"
	"github.com/nextlevelbuilder/goclaw/internal/channels"
	"github.com/nextlevelbuilder/goclaw/internal/channels/bitrix24"
	"github.com/nextlevelbuilder/goclaw/internal/config"
	"github.com/nextlevelbuilder/goclaw/internal/edition"
	"github.com/nextlevelbuilder/goclaw/internal/heartbeat"
	"github.com/nextlevelbuilder/goclaw/internal/orchestration"
	"github.com/nextlevelbuilder/goclaw/internal/sandbox"
	"github.com/nextlevelbuilder/goclaw/internal/scheduler"
	"github.com/nextlevelbuilder/goclaw/internal/security"
	"github.com/nextlevelbuilder/goclaw/internal/store"
	"github.com/nextlevelbuilder/goclaw/internal/tasks"
	"github.com/nextlevelbuilder/goclaw/internal/tools"
	"github.com/nextlevelbuilder/goclaw/internal/webhooks"
	"github.com/nextlevelbuilder/goclaw/pkg/protocol"
)

// lifecycleDeps bundles the extra parameters needed by runLifecycle that are not in gatewayDeps.
type lifecycleDeps struct {
	sched             *scheduler.Scheduler
	heartbeatTicker   *heartbeat.Ticker
	quotaChecker      *channels.QuotaChecker
	webFetchTool      *tools.WebFetchTool
	ttsTool           *tools.TtsTool
	sandboxMgr        sandbox.Manager
	postTurn          tools.PostTurnProcessor
	subagentMgr       *tools.SubagentManager
	childRunAdmission *orchestration.ChildRunAdmission
	consumerTeamStore store.TeamStore
	auditCh           chan bus.AuditEventPayload
	sigCh             chan os.Signal
	terminateProcess  func(int)
}

func drainChildRunsWithRetry(
	admission *orchestration.ChildRunAdmission,
	firstTimeout time.Duration,
	retryTimeout time.Duration,
) error {
	if admission == nil {
		return nil
	}
	for attempt, timeout := range []time.Duration{firstTimeout, retryTimeout} {
		drainCtx, drainCancel := context.WithTimeout(context.Background(), timeout)
		err := admission.Close(drainCtx)
		drainCancel()
		if err == nil {
			return nil
		}
		slog.Error("gateway: child-run drain attempt failed",
			"attempt", attempt+1, "timeout", timeout, "error", err)
	}
	return fmt.Errorf("%w after retry", orchestration.ErrChildRunDrainTimeout)
}

func drainSubagentManagerWithRetry(
	manager *tools.SubagentManager,
	firstTimeout time.Duration,
	retryTimeout time.Duration,
) error {
	if manager == nil {
		return nil
	}
	for attempt, timeout := range []time.Duration{firstTimeout, retryTimeout} {
		drainCtx, drainCancel := context.WithTimeout(context.Background(), timeout)
		err := manager.CloseContext(drainCtx)
		drainCancel()
		if err == nil {
			return nil
		}
		slog.Error("gateway: subagent lifecycle drain attempt failed",
			"attempt", attempt+1, "timeout", timeout, "error", err)
	}
	return fmt.Errorf("%w after retry", tools.ErrSubagentLifecycleDrainTimeout)
}

func drainDelegateToolWithRetry(
	tool interface{ CloseContext(context.Context) error },
	firstTimeout time.Duration,
	retryTimeout time.Duration,
) error {
	for attempt, timeout := range []time.Duration{firstTimeout, retryTimeout} {
		drainCtx, drainCancel := context.WithTimeout(context.Background(), timeout)
		err := tool.CloseContext(drainCtx)
		drainCancel()
		if err == nil {
			return nil
		}
		slog.Error("gateway: delegate completion drain attempt failed",
			"attempt", attempt+1, "timeout", timeout, "error", err)
	}
	return fmt.Errorf("delegate completion drain failed after retry")
}

// runLifecycle wires config-reload subscribers, starts consumers, task recovery,
// the signal handler goroutine, and finally starts the gateway server.
// This is the last phase of runGateway() — called after all setup is complete.
func (d *gatewayDeps) runLifecycle(
	ctx context.Context,
	cancel context.CancelFunc,
	deps lifecycleDeps,
) {
	// Reload quota config on config changes via pub/sub.
	if deps.quotaChecker != nil {
		d.msgBus.Subscribe("quota-config-reload", func(evt bus.Event) {
			if evt.Name != bus.TopicConfigChanged {
				return
			}
			updatedCfg, ok := evt.Payload.(*config.Config)
			if !ok || updatedCfg.Gateway.Quota == nil {
				return
			}
			config.MergeChannelGroupQuotas(updatedCfg)
			deps.quotaChecker.UpdateConfig(*updatedCfg.Gateway.Quota)
			slog.Info("quota config reloaded via pub/sub")
		})
	}

	// Reload cron default timezone on config changes via pub/sub.
	d.msgBus.Subscribe("cron-config-reload", func(evt bus.Event) {
		if evt.Name != bus.TopicConfigChanged {
			return
		}
		updatedCfg, ok := evt.Payload.(*config.Config)
		if !ok {
			return
		}
		d.pgStores.Cron.SetDefaultTimezone(updatedCfg.Cron.DefaultTimezone)
	})

	// Reload web_fetch domain policy on config changes via pub/sub.
	d.msgBus.Subscribe("webfetch-config-reload", func(evt bus.Event) {
		if evt.Name != bus.TopicConfigChanged {
			return
		}
		updatedCfg, ok := evt.Payload.(*config.Config)
		if !ok {
			return
		}
		deps.webFetchTool.UpdatePolicy(updatedCfg.Tools.WebFetch.Policy, updatedCfg.Tools.WebFetch.AllowedDomains, updatedCfg.Tools.WebFetch.BlockedDomains)
	})

	// Reload global shell deny-group toggles on config changes via pub/sub
	// so /config edits apply without a process restart.
	subscribeShellDenyGroupsReload(d.msgBus, d.toolsReg)
	var providerStore store.ProviderStore
	var mcpStore store.MCPServerStore
	if d.pgStores != nil {
		providerStore = d.pgStores.Providers
		mcpStore = d.pgStores.MCP
	}
	subscribeProviderShellDenyGroupsReload(d.msgBus, d.providerRegistry, providerStore, mcpStore)

	// Reload TTS providers on config changes via pub/sub.
	d.msgBus.Subscribe("tts-config-reload", func(evt bus.Event) {
		if evt.Name != bus.TopicConfigChanged {
			return
		}
		updatedCfg, ok := evt.Payload.(*config.Config)
		if !ok {
			return
		}
		if d.pgStores.ConfigSecrets != nil {
			// Use master tenant context to load global TTS secrets
			masterCtx := store.WithTenantID(context.Background(), store.MasterTenantID)
			if secrets, err := d.pgStores.ConfigSecrets.GetAll(masterCtx); err == nil && len(secrets) > 0 {
				updatedCfg.ApplyDBSecrets(secrets)
			}
		}
		newMgr := setupTTS(updatedCfg)
		if newMgr == nil {
			return
		}
		deps.ttsTool.UpdateManager(newMgr)
		if d.ttsHandler != nil {
			d.ttsHandler.UpdateManager(newMgr)
		}
		slog.Info("tts config reloaded", "provider", newMgr.PrimaryProvider(), "auto", string(newMgr.AutoMode()))
	})

	// Note: vault enrichment provider is resolved per-tenant at runtime,
	// no hot-reload handler needed here

	// Log orphaned providers on agent deletion. Auto-delete is unsafe because
	// providers can be referenced by heartbeats (FK), OAuth tokens, media chains.
	d.msgBus.Subscribe("agent-deleted-provider-log", func(evt bus.Event) {
		if evt.Name != bus.TopicAgentDeleted {
			return
		}
		payload, ok := evt.Payload.(bus.AgentDeletedPayload)
		if !ok || payload.Provider == "" {
			return
		}
		slog.Info("agent deleted, provider may be orphaned — verify via UI",
			"agent", payload.AgentKey, "provider", payload.Provider)
	})

	// Contact collector: auto-collect user info from channels with in-memory dedup cache.
	var contactCollector *store.ContactCollector
	if d.pgStores.Contacts != nil {
		contactCollector = store.NewContactCollector(d.pgStores.Contacts, cache.NewInMemoryCache[bool]())
		d.channelMgr.SetContactCollector(contactCollector)
	}

	go consumeInboundMessages(ctx, d.msgBus, d.agentRouter, d.cfg, deps.sched, d.channelMgr, deps.consumerTeamStore, d.pgStores.AgentLinks, deps.quotaChecker, d.pgStores.Sessions, d.pgStores.Agents, contactCollector, deps.postTurn, deps.subagentMgr, d.usageCapSvc, d.providerRegistry, d.teamWorkEmbedder)

	// Webhook callback worker — delivers async webhook_calls rows to receiver callback_url.
	// Runs in both editions: Standard (PG, concurrency=4) and Lite (SQLite, concurrency=1).
	// sqliteonly: single callback worker — SQLite lacks SKIP LOCKED; BEGIN IMMEDIATE serializes.
	var webhookWorkerCancel context.CancelFunc
	if d.pgStores != nil &&
		d.pgStores.WebhookCalls != nil &&
		d.pgStores.Webhooks != nil &&
		d.pgStores.Tenants != nil &&
		d.agentRouter != nil {
		workerConcurrency := 4
		if edition.Current().IsLimited() {
			// sqliteonly: single callback worker — SQLite lacks SKIP LOCKED; BEGIN IMMEDIATE serializes.
			workerConcurrency = 1
		}
		ww := webhooks.NewWebhookWorker(
			d.pgStores.WebhookCalls,
			d.pgStores.Webhooks,
			d.pgStores.Tenants,
			d.agentRouter,
			nil, // limiter: created internally with default per-tenant cap (4)
			webhooks.WorkerConfig{
				WorkerConcurrency:    workerConcurrency,
				PerTenantConcurrency: 4,
				AsyncAgentTimeout:    webhooks.ResolveTimeoutSec(d.cfg.Gateway.WebhookAsyncTimeoutSec),
				Stream:               webhooks.ResolveStream(d.cfg.Gateway.WebhookStream),
			},
		)
		// K6: decrypt raw secret for outbound HMAC signing using the same key as inbound verify.
		ww.SetEncKey(os.Getenv("GOCLAW_ENCRYPTION_KEY"))
		var workerCtx context.Context
		workerCtx, webhookWorkerCancel = context.WithCancel(ctx)
		go ww.Run(workerCtx)
	}

	// Task recovery ticker: re-dispatches stale/pending team tasks on startup and periodically.
	var taskTicker *tasks.TaskTicker
	if d.pgStores.Teams != nil {
		taskTicker = tasks.NewTaskTicker(d.pgStores.Teams, d.pgStores.Agents, d.msgBus, d.cfg.Gateway.TaskRecoveryIntervalSec)
		taskTicker.Start()
	}

	go func() {
		sig := <-deps.sigCh
		slog.Info("graceful shutdown initiated", "signal", sig)

		// Broadcast shutdown event
		d.server.BroadcastEvent(*protocol.NewEvent(protocol.EventShutdown, nil))

		// Close child-run intake first. A drain timeout must terminate without
		// unwinding runGateway defers under a still-live child callback.
		if deps.childRunAdmission != nil {
			if err := drainChildRunsWithRetry(deps.childRunAdmission, 30*time.Second, 5*time.Second); err != nil {
				slog.Error("gateway: terminating after child-run drain failure", "error", err)
				terminate := deps.terminateProcess
				if terminate == nil {
					terminate = os.Exit
				}
				terminate(1)
				return

```

### Core Architecture Module: `cmd/gateway_lifecycle_shell_deny_groups.go`
```
package cmd

import (
	"context"
	"log/slog"

	"github.com/nextlevelbuilder/goclaw/internal/bus"
	"github.com/nextlevelbuilder/goclaw/internal/config"
	"github.com/nextlevelbuilder/goclaw/internal/providers"
	"github.com/nextlevelbuilder/goclaw/internal/store"
	"github.com/nextlevelbuilder/goclaw/internal/tools"
)

// subscribeShellDenyGroupsReload wires pub/sub so global shell deny-group
// toggles applied via the /config page take effect without a process restart.
// Extracted from runLifecycle to make the dispatch path unit-testable
// (the regression coverage missing from the original PR #1005 attempt).
func subscribeShellDenyGroupsReload(msgBus *bus.MessageBus, toolsReg *tools.Registry) {
	msgBus.Subscribe("shell-deny-groups-config-reload", func(evt bus.Event) {
		if evt.Name != bus.TopicConfigChanged {
			return
		}
		updatedCfg, ok := evt.Payload.(*config.Config)
		if !ok {
			return
		}
		snapshot := updatedCfg.Clone()
		execTool, ok := toolsReg.Get("exec")
		if !ok {
			return
		}
		et, ok := execTool.(*tools.ExecTool)
		if !ok {
			return
		}
		et.SetGlobalShellDenyGroups(snapshot.Tools.ShellDenyGroups)
		et.SetCommandKeywordAllowlist(snapshot.Tools.CommandKeywordAllowlist)
		slog.Info("shell deny groups reloaded via pub/sub",
			"groups", len(snapshot.Tools.ShellDenyGroups),
			"command_keyword_allowlist_rules", len(snapshot.Tools.CommandKeywordAllowlist),
		)
	})
}

func subscribeProviderShellDenyGroupsReload(msgBus *bus.MessageBus, providerReg *providers.Registry, provStore store.ProviderStore, mcpStore store.MCPServerStore) {
	if msgBus == nil || providerReg == nil {
		return
	}
	msgBus.Subscribe("shell-deny-provider-policy-reload", func(evt bus.Event) {
		if evt.Name != bus.TopicConfigChanged {
			return
		}
		updatedCfg, ok := evt.Payload.(*config.Config)
		if !ok {
			return
		}
		reloadShellDenyProviderPolicies(providerReg, provStore, mcpStore, updatedCfg)
	})
}

func reloadShellDenyProviderPolicies(providerReg *providers.Registry, provStore store.ProviderStore, mcpStore store.MCPServerStore, cfg *config.Config) {
	if providerReg == nil || cfg == nil {
		return
	}
	snapshot := cfg.Clone()
	registerClaudeCLIFromConfig(providerReg, snapshot)
	if snapshot.Providers.ACP.Binary != "" {
		registerACPFromConfig(providerReg, snapshot.Providers.ACP, snapshot.ShellDenyGroupsSnapshot())
	}
	if provStore == nil {
		return
	}
	dbProviders, err := provStore.ListAllProviders(context.Background())
	if err != nil {
		slog.Warn("shell deny provider policy reload: failed to load providers from DB", "error", err)
		return
	}
	gatewayAddr := loopbackAddr(snapshot.Gateway.Host, snapshot.Gateway.Port)
	for _, p := range dbProviders {
		if !p.Enabled {
			continue
		}
		switch p.ProviderType {
		case store.ProviderClaudeCLI:
			registerClaudeCLIFromDB(providerReg, p, gatewayAddr, snapshot.Gateway.Token, mcpStore, snapshot)
		case store.ProviderACP:
			registerACPFromDB(providerReg, p, snapshot.ShellDenyGroupsSnapshot())
		}
	}
}

```

### Core Architecture Module: `cmd/gateway_subagent_announce_queue.go`
```
package cmd

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"

	"github.com/nextlevelbuilder/goclaw/internal/agent"
	"github.com/nextlevelbuilder/goclaw/internal/bus"
	"github.com/nextlevelbuilder/goclaw/internal/channels"
	"github.com/nextlevelbuilder/goclaw/internal/config"
	orch "github.com/nextlevelbuilder/goclaw/internal/orchestration"
	"github.com/nextlevelbuilder/goclaw/internal/scheduler"
	"github.com/nextlevelbuilder/goclaw/internal/store"
	"github.com/nextlevelbuilder/goclaw/internal/tools"
	"github.com/nextlevelbuilder/goclaw/pkg/protocol"
)

// makeDelegateAnnounceCallback returns the batch callback used by tools.NewAnnounceQueue.
// Extracted from runGateway to keep the main function concise.
func makeDelegateAnnounceCallback(
	subagentMgr *tools.SubagentManager,
	msgBus *bus.MessageBus,
) func(sessionKey string, items []tools.AnnounceQueueItem, meta tools.AnnounceMetadata) {
	return func(sessionKey string, items []tools.AnnounceQueueItem, meta tools.AnnounceMetadata) {
		roster := subagentMgr.RosterForParent(tools.TaskScope{
			TenantID: meta.OriginTenantID, RootAgentID: meta.RootAgentID, RootAgentKey: meta.ParentAgent,
		})
		content := tools.FormatBatchedAnnounce(items, roster)
		senderID := fmt.Sprintf("subagent:batch-%d", len(items))
		label := items[0].Label
		if len(items) > 1 {
			label = fmt.Sprintf("%d tasks", len(items))
		}
		batchMeta := map[string]string{
			tools.MetaOriginChannel:       meta.OriginChannel,
			tools.MetaOriginPeerKind:      meta.OriginPeerKind,
			tools.MetaParentAgent:         meta.ParentAgent,
			tools.MetaSubagentRootAgentID: meta.RootAgentID.String(),
			tools.MetaSubagentLabel:       label,
			tools.MetaOriginTraceID:       meta.OriginTraceID,
			tools.MetaOriginRootSpanID:    meta.OriginRootSpanID,
		}
		if meta.OriginLocalKey != "" {
			batchMeta[tools.MetaOriginLocalKey] = meta.OriginLocalKey
		}
		if meta.OriginSessionKey != "" {
			batchMeta[tools.MetaOriginSessionKey] = meta.OriginSessionKey
		}
		if meta.OriginSenderID != "" {
			batchMeta[tools.MetaOriginSenderID] = meta.OriginSenderID
		}
		if meta.OriginRole != "" {
			batchMeta[tools.MetaOriginRole] = meta.OriginRole
		}
		if meta.OriginUserID != "" {
			batchMeta[tools.MetaOriginUserID] = meta.OriginUserID
		}
		// Collect media from all items in the batch.
		var batchMedia []bus.MediaFile
		for _, item := range items {
			batchMedia = append(batchMedia, item.Media...)
		}
		// Notify clients that leader is processing team results
		// (bridges UI gap between last task.completed and announce run.started).
		bus.BroadcastForTenant(msgBus, protocol.EventTeamLeaderProcessing, meta.OriginTenantID, map[string]any{
			"agentId": meta.ParentAgent,
			"tasks":   len(items),
		})

		delivered := tools.PublishAsyncCompletion(context.Background(), msgBus, bus.InboundMessage{
			Channel:  "system",
			SenderID: senderID,
			ChatID:   meta.OriginChatID,
			Content:  content,
			UserID:   meta.OriginUserID,
			TenantID: meta.OriginTenantID,
			Metadata: batchMeta,
			Media:    batchMedia,
		})
		for _, item := range items {
			if !item.DurablyPersisted {
				slog.Error("subagent.batch_announce_without_durable_terminal",
					"task_id", item.SubagentID,
					"completion_id", item.CompletionID,
					"root_agent_id", meta.RootAgentID,
					"delivered", delivered,
				)
				continue
			}
			subagentMgr.UpdateAnnouncementStatus(
				store.WithTenantID(context.Background(), meta.OriginTenantID),
				meta.RootAgentID,
				item.CompletionID,
				delivered,
			)
		}
		if !delivered {
			slog.Warn("subagent.batch_announce_deferred_to_ledger",
				"root_agent_id", meta.RootAgentID,
				"batch_size", len(items),
				"reason", "inbound_bus_full",
			)
		}
	}
}

// subagentAnnounceEntry holds one subagent completion result waiting to be announced.
type subagentAnnounceEntry struct {
	Label        string
	Status       string // "completed", "failed", "cancelled"
	Content      string
	Media        []bus.MediaFile
	InputTokens  int64
	OutputTokens int64
	Runtime      time.Duration
	Iterations   int
}

// subagentAnnounceRouting holds shared routing info captured by the first enqueue.
type subagentAnnounceRouting struct {
	QueueKey         string    // tenant/root/session/topic/user/authority-scoped key
	SessionKey       string    // original session key (no tenant prefix) for RunRequest
	TenantID         uuid.UUID // preserved for tenant-scoped scheduling
	OrigChannel      string
	OrigChannelType  string
	OrigChatID       string
	OrigPeerKind     string
	OrigLocalKey     string
	UserID           string
	SenderID         string // real acting sender (preserves permission attribution through re-ingress, #915)
	Role             string // caller's RBAC role; bypasses per-user grants for admin/operator/owner (#915)
	ParentAgent      string
	RootAgentID      uuid.UUID
	ParentTraceID    uuid.UUID
	ParentRootSpanID uuid.UUID
	OutMeta          map[string]string
}

// subagentAnnounceQueue uses BatchQueue for producer-consumer synchronization.
var subagentAnnounceQueue orch.BatchQueue[subagentAnnounceEntry]

// enqueueSubagentAnnounce adds a result to the queue. Returns isProcessor.
func enqueueSubagentAnnounce(key string, entry subagentAnnounceEntry) bool {
	return subagentAnnounceQueue.Enqueue(key, entry)
}

// processSubagentAnnounceLoop drains entries, builds merged announce, schedules to parent.
func processSubagentAnnounceLoop(
	ctx context.Context,
	r subagentAnnounceRouting,
	roster tools.SubagentRoster,
	subagentMgr *tools.SubagentManager,
	sched *scheduler.Scheduler,
	msgBus *bus.MessageBus,
	cfg *config.Config,
	channelMgr *channels.Manager,
) {
	// Ensure tenant scope is always set for the scheduler.
	if r.TenantID != uuid.Nil {
		ctx = store.WithTenantID(ctx, r.TenantID)
	}

	for {
		select {
		case <-ctx.Done():
			subagentAnnounceQueue.TryFinish(r.QueueKey)
			return
		default:
		}

		entries := subagentAnnounceQueue.Drain(r.QueueKey)
		if len(entries) == 0 {
			if subagentAnnounceQueue.TryFinish(r.QueueKey) {
				return
			}
			// Brief sleep to avoid tight spin when entries arrive between drain and tryFinish.
			time.Sleep(50 * time.Millisecond)
			continue
		}

		// Refresh roster each iteration for up-to-date task statuses.
		roster = subagentMgr.RosterForParent(tools.TaskScope{
			TenantID: r.TenantID, RootAgentID: r.RootAgentID, RootAgentKey: r.ParentAgent,
		})
		content := buildMergedSubagentAnnounce(entries, roster)

		// Collect media from all entries.
		var fwdMedia []bus.MediaFile
		for _, e := range entries {
			fwdMedia = append(fwdMedia, e.Media...)
		}
		contentSuffix := ""
		if r.OrigChannel == "ws" && len(fwdMedia) > 0 {
			contentSuffix = mediaToMarkdownFromPaths(fwdMedia, cfg)
			fwdMedia = nil
		}

		req := agent.RunRequest{
			SessionKey:       r.SessionKey,
			Message:          content,
			ForwardMedia:     fwdMedia,
			ContentSuffix:    contentSuffix,
			Channel:          r.OrigChannel,
			ChannelType:      r.OrigChannelType,
			ChatID:           r.OrigChatID,
			ChatTitle:        resolveGroupDisplayTitle(ctx, channelMgr, r.OrigChannel, r.OrigChatID, r.OrigPeerKind, ""),
			PeerKind:         r.OrigPeerKind,
			LocalKey:         r.OrigLocalKey,
			UserID:           r.UserID,
			SenderID:         r.SenderID, // preserves real acting sender for permission checks (#915)
			Role:             r.Role,     // preserves RBAC role for admin bypass in group writes (#915)
			RunID:            fmt.Sprintf("subagent-announce-%s-%d", r.ParentAgent, len(entries)),
			RunKind:          "announce",
			HideInput:        true,
			Stream:           false,
			ParentTraceID:    r.ParentTraceID,
			ParentRootSpanID: r.ParentRootSpanID,
		}

		outCh := sched.Schedule(ctx, scheduler.LaneSubagent, req)
		outcome := <-outCh

		if outcome.Err != nil {
			if !errors.Is(outcome.Err, context.Canceled) {
				slog.Error("subagent announce: lead run failed", "error", outcome.Err, "batch_size", len(entries))
				errContent := formatAgentError(outcome.Err)
				if isExternalChannel(r.OrigChannelType) {
					slog.Info("subagent announce: suppressed error for external channel",
						"channel", r.OrigChannel, "type", r.OrigChannelType)
					errContent = ""
				}
				msgBus.PublishOutbound(bus.OutboundMessage{
					Channel:  r.OrigChannel,
					ChatID:   r.OrigChatID,
					Content:  errContent,
					Metadata: r.OutMeta,
				})
			}
		} else {
			isSilent := outcome.Result.Content == "" || agent.IsSilentReply(outcome.Result.Content)
			if !(isSilent && len(outcome.Result.Media) == 0) {
				out := outcome.Result.Content
				if isSilent {
					out = ""
				}
				outMsg := bus.OutboundMessage{
					Channel:  r.OrigChannel,
					ChatID:   r.OrigChatID,
					Content:  out,
					Metadata: r.OutMeta,
				}
				appendMediaToOutbound(&outMsg, outcome.Result.Media)
				msgBus.PublishOutbound(outMsg)
			}
		}

		slog.Info("subagent announce: batch processed",
			"batch_size", len(entries), "session", r.SessionKey)
	}
}

```

### Core Architecture Module: `cmd/skills_lifecycle_cmd.go`
```
package cmd

import (
	"fmt"
	"net/http"
	"net/url"

	"github.com/spf13/cobra"
)

var (
	skillsGatewayDo      = gatewayHTTPDo
	skillsGatewayDelete  = gatewayHTTPDelete
	skillsRequireGateway = requireRunningGatewayHTTP
)

func skillsDepsCmd() *cobra.Command {
	cmd := &cobra.Command{Use: "deps", Short: "Scan, check, and install skill dependencies"}
	cmd.AddCommand(skillsDepsReadCmd("status", http.MethodGet, "Show dependency status"))
	cmd.AddCommand(skillsDepsReadCmd("scan", http.MethodPost, "Scan dependency declarations"))
	cmd.AddCommand(skillsDepsReadCmd("check", http.MethodPost, "Check dependency availability"))
	cmd.AddCommand(skillsDepsInstallCmd())
	return cmd
}

func skillsDepsReadCmd(name, method, short string) *cobra.Command {
	var jsonOutput bool
	cmd := &cobra.Command{
		Use:   name + " [skill-id-or-path]",
		Short: short,
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if pathExists(args[0]) {
				return runLocalSkillDepsStatus(cmd.OutOrStdout(), args[0], jsonOutput)
			}
			skillsRequireGateway()
			path := "/v1/skills/" + url.PathEscape(args[0]) + "/dependencies"
			if method == http.MethodPost {
				path += "/" + name
			}
			return runSkillsGateway(cmd.OutOrStdout(), method, path, nil, jsonOutput)
		},
	}
	cmd.Flags().BoolVar(&jsonOutput, "json", false, "output as JSON")
	return cmd
}

func skillsDepsInstallCmd() *cobra.Command {
	var jsonOutput bool
	cmd := &cobra.Command{
		Use:   "install [skill-id]",
		Short: "Install missing dependencies for a managed skill",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			skillsRequireGateway()
			path := "/v1/skills/" + url.PathEscape(args[0]) + "/dependencies/install"
			return runSkillsGateway(cmd.OutOrStdout(), http.MethodPost, path, nil, jsonOutput)
		},
	}
	cmd.Flags().BoolVar(&jsonOutput, "json", false, "output as JSON")
	return cmd
}

func skillsAccessCmd() *cobra.Command {
	cmd := &cobra.Command{Use: "access", Short: "Manage skill access mode and effective access"}
	cmd.AddCommand(skillsAccessGetCmd())
	cmd.AddCommand(skillsAccessSetCmd())
	cmd.AddCommand(skillsAccessEffectiveCmd())
	return cmd
}

func skillsAccessGetCmd() *cobra.Command {
	var jsonOutput bool
	cmd := &cobra.Command{
		Use:   "get [skill-id]",
		Short: "Show skill access mode and grants",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			skillsRequireGateway()
			path := "/v1/skills/" + url.PathEscape(args[0]) + "/access"
			return runSkillsGateway(cmd.OutOrStdout(), http.MethodGet, path, nil, jsonOutput)
		},
	}
	cmd.Flags().BoolVar(&jsonOutput, "json", false, "output as JSON")
	return cmd
}

func skillsAccessSetCmd() *cobra.Command {
	var mode string
	var jsonOutput bool
	cmd := &cobra.Command{
		Use:   "set [skill-id]",
		Short: "Set skill access mode",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if mode == "" {
				return fmt.Errorf("--mode is required")
			}
			skillsRequireGateway()
			path := "/v1/skills/" + url.PathEscape(args[0]) + "/access"
			return runSkillsGateway(cmd.OutOrStdout(), http.MethodPatch, path, map[string]any{"mode": mode}, jsonOutput)
		},
	}
	cmd.Flags().StringVar(&mode, "mode", "", "access mode: private, internal, public")
	cmd.Flags().BoolVar(&jsonOutput, "json", false, "output as JSON")
	return cmd
}

func skillsAccessEffectiveCmd() *cobra.Command {
	var agentID, userID string
	var jsonOutput bool
	cmd := &cobra.Command{
		Use:   "effective [skill-id]",
		Short: "Inspect effective access for an agent and user",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if agentID == "" || userID == "" {
				return fmt.Errorf("--agent and --user are required")
			}
			skillsRequireGateway()
			values := url.Values{"agent_id": {agentID}, "user_id": {userID}}
			path := "/v1/skills/access/effective"
			if len(args) == 1 {
				path = "/v1/skills/" + url.PathEscape(args[0]) + "/access/effective"
			}
			return runSkillsGateway(cmd.OutOrStdout(), http.MethodGet, path+"?"+values.Encode(), nil, jsonOutput)
		},
	}
	cmd.Flags().StringVar(&agentID, "agent", "", "agent ID")
	cmd.Flags().StringVar(&userID, "user", "", "user ID")
	cmd.Flags().BoolVar(&jsonOutput, "json", false, "output as JSON")
	return cmd
}

func skillsGrantCmd() *cobra.Command {
	cmd := &cobra.Command{Use: "grant", Short: "Grant skill access"}
	cmd.AddCommand(skillsGrantAgentCmd())
	cmd.AddCommand(skillsGrantUserCmd())
	return cmd
}

func skillsGrantAgentCmd() *cobra.Command {
	var canManage, jsonOutput bool
	var pinnedVersion int
	cmd := &cobra.Command{
		Use:   "agent [skill-id] [agent-id]",
		Short: "Grant a skill to an agent",
		Args:  cobra.ExactArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			skillsRequireGateway()
			body := map[string]any{"agent_id": args[1]}
			if canManage {
				body["can_manage"] = true
			}
			if pinnedVersion > 0 {
				body["pinned_version"] = pinnedVersion
			}
			path := "/v1/skills/" + url.PathEscape(args[0]) + "/grants/agents"
			return runSkillsGateway(cmd.OutOrStdout(), http.MethodPost, path, body, jsonOutput)
		},
	}
	cmd.Flags().BoolVar(&canManage, "can-manage", false, "grant manage permission")
	cmd.Flags().IntVar(&pinnedVersion, "pinned-version", 0, "pin a specific skill version")
	cmd.Flags().BoolVar(&jsonOutput, "json", false, "output as JSON")
	return cmd
}

```

### Core Architecture Module: `cmd/skills_lifecycle_helpers.go`
```
package cmd

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"

	"github.com/spf13/cobra"

	"github.com/nextlevelbuilder/goclaw/internal/skills"
)

func skillsGrantUserCmd() *cobra.Command {
	var jsonOutput bool
	cmd := &cobra.Command{
		Use:   "user [skill-id] [user-id]",
		Short: "Grant a skill to a user",
		Args:  cobra.ExactArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			skillsRequireGateway()
			path := "/v1/skills/" + url.PathEscape(args[0]) + "/grants/users"
			return runSkillsGateway(cmd.OutOrStdout(), http.MethodPost, path, map[string]any{"user_id": args[1]}, jsonOutput)
		},
	}
	cmd.Flags().BoolVar(&jsonOutput, "json", false, "output as JSON")
	return cmd
}

func skillsRevokeCmd() *cobra.Command {
	cmd := &cobra.Command{Use: "revoke", Short: "Revoke skill access"}
	cmd.AddCommand(skillsRevokeAgentCmd())
	cmd.AddCommand(skillsRevokeUserCmd())
	return cmd
}

func skillsRevokeAgentCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "agent [skill-id] [agent-id]",
		Short: "Revoke a skill from an agent",
		Args:  cobra.ExactArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			skillsRequireGateway()
			path := "/v1/skills/" + url.PathEscape(args[0]) + "/grants/agents/" + url.PathEscape(args[1])
			return runSkillsGatewayDelete(cmd.OutOrStdout(), path)
		},
	}
}

func skillsRevokeUserCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "user [skill-id] [user-id]",
		Short: "Revoke a skill from a user",
		Args:  cobra.ExactArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			skillsRequireGateway()
			path := "/v1/skills/" + url.PathEscape(args[0]) + "/grants/users/" + url.PathEscape(args[1])
			return runSkillsGatewayDelete(cmd.OutOrStdout(), path)
		},
	}
}

func runSkillsGateway(w io.Writer, method, path string, body any, jsonOutput bool) error {
	resp, err := skillsGatewayDo(method, path, body)
	if err != nil {
		return err
	}
	if jsonOutput {
		return writePrettyJSON(w, resp)
	}
	if ok, _ := resp["ok"].(bool); ok {
		_, _ = fmt.Fprintln(w, "ok")
		return nil
	}
	return writePrettyJSON(w, resp)
}

func runSkillsGatewayDelete(w io.Writer, path string) error {
	if err := skillsGatewayDelete(path); err != nil {
		return err
	}
	_, _ = fmt.Fprintln(w, "ok")
	return nil
}

func runLocalSkillDepsStatus(w io.Writer, target string, jsonOutput bool) error {
	dir := target
	if filepath.Base(target) == "SKILL.md" {
		dir = filepath.Dir(target)
	}
	manifest := skills.ScanSkillDeps(dir)
	ok, missing := skills.CheckSkillDeps(manifest)
	resp := map[string]any{
		"skill":         map[string]any{"path": dir},
		"ok":            ok,
		"status":        localDepsStatus(ok),
		"manifest":      manifest,
		"missing":       missing,
		"missing_count": len(missing),
	}
	if jsonOutput {
		return writePrettyJSON(w, resp)
	}
	if ok {
		_, _ = fmt.Fprintln(w, "all deps satisfied")
		return nil
	}
	_, _ = fmt.Fprintf(w, "missing dependencies: %s\n", skills.FormatMissing(missing))
	return nil
}

func writePrettyJSON(w io.Writer, v any) error {
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return err
	}
	_, err = fmt.Fprintln(w, string(data))
	return err
}

func pathExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func localDepsStatus(ok bool) string {
	if ok {
		return "ok"
	}
	return "missing"
}

```

### Core Architecture Module: `internal/agent/loop.go`
```
package agent

import (
	"log/slog"
	"strings"
	"time"

	"github.com/nextlevelbuilder/goclaw/internal/providers"
	"github.com/nextlevelbuilder/goclaw/internal/tools"
)

// runLoop (v2 agent iteration loop) was removed in the v3 force migration.
// All agents now use the v3 pipeline (runViaPipeline in loop_pipeline_adapter.go).
// Shared helpers below are still used by v3 pipeline callbacks.

// indexedResult holds the output of a single parallel tool execution, preserving
// the original call index so results can be sorted back into deterministic order.
type indexedResult struct {
	idx          int
	tc           providers.ToolCall
	registryName string
	result       *tools.Result
	argsJSON     string
	spanStart    time.Time
}

// resolveToolCallName strips the configured tool call prefix from a name
// returned by the model, returning the original registry name.
// Example: prefix "proxy_" + model calls "proxy_exec" → returns "exec".
func (l *Loop) resolveToolCallName(name string) string {
	if l.agentToolPolicy != nil && l.agentToolPolicy.ToolCallPrefix != "" {
		return tools.StripToolPrefix(l.agentToolPolicy.ToolCallPrefix, name)
	}
	return name
}

func (l *Loop) parallelEligibleToolCall(tc providers.ToolCall) bool {
	name := l.resolveToolCallName(tc.Name)
	switch {
	case name == "exec", name == "bash", name == "wait":
		return false
	case strings.HasPrefix(name, "mcp_"):
		return false
	case l.registry == nil:
		return false
	}
	tool, ok := l.registry.Get(name)
	if !ok {
		return false
	}

	meta := l.registry.GetMetadata(tool.Name())
	return meta.IsReadOnly() &&
		!meta.HasCapability(tools.CapMutating) &&
		!meta.HasCapability(tools.CapAsync) &&
		!meta.HasCapability(tools.CapMCPBridged)
}

// normalizeToolCall rewrites malformed MCP pseudo-calls that some models emit
// as `exec` with `{action:"mcp_xxx", code|command:"..."}`.
// We recover the intended MCP tool name from `action` and map payload to MCP
// schema (`code`) before registry lookup.
func (l *Loop) normalizeToolCall(tc providers.ToolCall) providers.ToolCall {
	if tc.Name != "exec" || len(tc.Arguments) == 0 {
		return tc
	}
	action, _ := tc.Arguments["action"].(string)
	if !strings.HasPrefix(action, "mcp_") {
		return tc
	}

	normalized := tc
	normalized.Name = action
	args := map[string]any{}
	if code, ok := tc.Arguments["code"]; ok {
		args["code"] = code
	} else if command, ok := tc.Arguments["command"]; ok {
		// Legacy prompt snippets sometimes place JS code in `command`.
		args["code"] = command
	}
	if len(args) == 0 {
		for k, v := range tc.Arguments {
			if k != "action" {
				args[k] = v
			}
		}
	}
	normalized.Arguments = args
	slog.Warn("tool call normalized from exec to mcp tool",
		"agent", l.id, "from", tc.Name, "to", normalized.Name)
	return normalized
}

func hasParseErrors(calls []providers.ToolCall) bool {
	for _, tc := range calls {
		if tc.ParseError != "" {
			return true
		}
	}
	return false
}

func truncateToolArgs(args map[string]any, maxLen int) map[string]any {
	out := make(map[string]any, len(args))
	for k, v := range args {
		if s, ok := v.(string); ok && len(s) > maxLen {
			out[k] = truncateStr(s, maxLen)
		} else {
			out[k] = v
		}
	}
	return out
}

```

### Core Architecture Module: `internal/agent/loop_compact.go`
```
package agent

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/nextlevelbuilder/goclaw/internal/providers"
)

// compactionSummaryPrompt is the structured summarization instruction used by both
// mid-loop compaction and background summarization. Matching OpenClaw TS compaction.ts
// MERGE_SUMMARIES_INSTRUCTIONS + IDENTIFIER_PRESERVATION_INSTRUCTIONS.
const compactionSummaryPrompt = `Summarize this conversation concisely for the AI agent to resume work.

MUST PRESERVE:
- Active tasks and their current status (in-progress, blocked, pending)
- Pending subagent tasks (IDs, labels, statuses) — agent needs to know what is still running
- Pending team task results awaiting delivery (task IDs, assignees, statuses)
- Any "waiting for..." state — do NOT drop expectations of future results
- Batch operation progress (e.g., "5/17 items completed")
- The last thing the user requested and what was being done about it
- Decisions made and their rationale
- TODOs, open questions, and constraints
- Any commitments or follow-ups promised

IDENTIFIER PRESERVATION:
Preserve all opaque identifiers exactly as written (no shortening or reconstruction),
including UUIDs, hashes, IDs, tokens, API keys, hostnames, IPs, ports, URLs, and file names.

PRIORITIZE recent context over older history. The agent needs to know
what it was doing, not just what was discussed.

Conversation to summarize:

`

const defaultCompactionTimeout = 120 * time.Second

const (
	maxCompactionChunks      = 16
	maxCompactionMergeLevels = 3
	defaultCompactionShare   = 0.85
)

func (l *Loop) compactionTimeout() time.Duration {
	if l.compactionCfg != nil && l.compactionCfg.TimeoutSeconds > 0 {
		return time.Duration(l.compactionCfg.TimeoutSeconds) * time.Second
	}
	return defaultCompactionTimeout
}

// compactMessagesInPlace summarizes the first ~70% of messages into a condensed
// summary, keeping the last ~30% intact. Operates purely on the local messages
// slice — no session state touched, no locks needed.
// Returns nil on failure (caller keeps original messages).
func (l *Loop) compactMessagesInPlace(ctx context.Context, messages []providers.Message) []providers.Message {
	if len(messages) < 6 {
		return nil
	}

	// Resolve keepCount from compaction config (same defaults as maybeSummarize).
	keepCount := 4
	if l.compactionCfg != nil && l.compactionCfg.KeepLastMessages > 0 {
		keepCount = l.compactionCfg.KeepLastMessages
	}
	// Ensure we keep at least 30% of messages.
	if minKeep := len(messages) * 3 / 10; minKeep > keepCount {
		keepCount = minKeep
	}

	splitIdx := len(messages) - keepCount

	// Walk backward from splitIdx to find a clean boundary —
	// avoid splitting tool_use → tool_result pairs.
	for splitIdx > 0 {
		m := messages[splitIdx]
		if m.Role == "tool" || (m.Role == "assistant" && len(m.ToolCalls) > 0) {
			splitIdx--
			continue
		}
		break
	}
	if splitIdx <= 1 {
		return nil
	}

	toSummarize := messages[:splitIdx]
	timeout := l.compactionTimeout()
	sctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	inputCap := l.compactionInputCap()
	if inputCap <= 0 {
		slog.Warn("mid_loop_compaction_failed", "agent", l.id, "error", "context_window_unresolved")
		return nil
	}
	units := buildCompactionUnits(toSummarize)
	summaryContent, chunkCount, err := l.summarizeCompactionUnits(sctx, units, inputCap, 1)
	if err != nil {
		slog.Warn("mid_loop_compaction_failed", "agent", l.id, "timeout_seconds", int(timeout/time.Second), "error", err)
		return nil
	}
	slog.Info("compact_budget",
		"path", "mid-loop",
		"agent", l.id,
		"in_tokens", l.estimateSummaryInputTokens(toSummarize),
		"input_cap_tokens", inputCap,
		"chunks", chunkCount,
		"timeout_seconds", int(timeout/time.Second),
	)

	// Collect MediaRefs from compacted messages (keep up to 30 most recent).
	const maxPreservedMediaRefs = 30
	var preservedRefs []providers.MediaRef
	for i := len(toSummarize) - 1; i >= 0 && len(preservedRefs) < maxPreservedMediaRefs; i-- {
		for _, ref := range toSummarize[i].MediaRefs {
			preservedRefs = append(preservedRefs, ref)
			if len(preservedRefs) >= maxPreservedMediaRefs {
				break
			}
		}
	}

	summary := providers.Message{
		Role:      "user",
		Content:   "[Summary of earlier conversation]\n" + summaryContent,
		MediaRefs: preservedRefs,
	}
	result := make([]providers.Message, 0, 1+keepCount)
	result = append(result, summary)
	result = append(result, messages[splitIdx:]...)

	slog.Info("mid_loop_compacted",
		"agent", l.id,
		"original_msgs", len(messages),
		"summarized", splitIdx,
		"kept", len(result))

	return result
}

func (l *Loop) compactionInputCap() int {
	contextWindow := l.resolveEffectiveContextWindow()
	if contextWindow <= 0 {
		return 0
	}
	maxTokens := l.effectiveMaxTokens()
	hardInputCap := contextWindow - maxTokens
	share := defaultCompactionShare
	if l.compactionCfg != nil && l.compactionCfg.MaxRequestShare > 0 && l.compactionCfg.MaxRequestShare <= 1 {
		share = l.compactionCfg.MaxRequestShare
	}
	softTarget := int(float64(contextWindow)*share) - maxTokens
	return min(hardInputCap, softTarget)
}

func buildCompactionUnits(messages []providers.Message) []string {
	units := make([]string, 0, len(messages))
	for i := 0; i < len(messages); {
		end := i + 1
		if messages[i].Role == "assistant" && len(messages[i].ToolCalls) > 0 {
			for end < len(messages) && messages[end].Role == "tool" {
				end++
			}
		}
		if text := renderCompactionMessages(messages[i:end]); text != "" {
			units = append(units, text)
		}
		i = end
	}
	return units
}

func renderCompactionMessages(messages []providers.Message) string {
	var sb strings.Builder
	for _, m := range messages {
		switch m.Role {
		case "user":
			fmt.Fprintf(&sb, "user: %s\n", m.Content)
		case "assistant":
			if content := SanitizeAssistantContent(m.Content); content != "" {
				fmt.Fprintf(&sb, "assistant: %s\n", content)
			}
			// Tool calls carry the assistant's intent (which tool, what args);
			// dropping them loses the "why" behind each tool result below.
			for _, tc := range m.ToolCalls {
				if args, err := json.Marshal(tc.Arguments); err == nil && len(tc.Arguments) > 0 {
					fmt.Fprintf(&sb, "assistant tool call %s(%s)\n", tc.Name, string(args))
				} else {
					fmt.Fprintf(&sb, "assistant tool call %s()\n", tc.Name)
				}
			}
		case "tool":
			// Tool results hold the technical payload the summary must retain
			// (search hits, file contents, API responses). buildCompactionUnits
			// groups these with their assistant tool_call; the previous renderer
			// silently dropped them, erasing the data before summarization.
			if m.Content != "" {
				fmt.Fprintf(&sb, "tool result: %s\n", m.Content)
			}
		}
	}
	return sb.String()
}

func (l *Loop) summarizeCompactionUnits(ctx context.Context, units []string, inputCap, level int) (string, int, error) {
	if len(units) == 0 {
		return "", 0, fmt.Errorf("no compactable conversation content")
	}
	chunks, err := l.packCompactionChunks(units, inputCap)
	if err != nil {
		return "", 0, err
	}
	if len(chunks) > maxCompactionChunks {
		return "", 0, fmt.Errorf("compaction chunk limit exceeded: chunks=%d limit=%d", len(chunks), maxCompactionChunks)
	}

	summaries := make([]string, 0, len(chunks))
	for i, chunk := range chunks {
		inputTokens := l.estimateCompactionRequestTokens(chunk)
		if inputTokens > inputCap {
			return "", 0, fmt.Errorf("compaction chunk exceeds input cap: chunk=%d input=%d cap=%d", i, inputTokens, inputCap)
		}
		outputTokens := dynamicSummaryMax(inputTokens)
		slog.Debug("compact_chunk_budget",
			"path", "mid-loop",
			"agent", l.id,
			"level", level,
			"chunk", i+1,
			"chunks", len(chunks),
			"in_tokens", inputTokens,
			"out_tokens", outputTokens,
			"input_cap_tokens", inputCap,
		)
		resp, callErr := l.callInternalLLMWithUsage(ctx, providers.ChatRequest{
			Messages: []providers.Message{{Role: "user", Content: compactionSummaryPrompt + chunk}},
			Model:    l.model,
			Options:  map[string]any{"max_tokens": outputTokens, "temperature": 0.3},
		}, "mid-loop-compaction")
		if callErr != nil {
			return "", 0, callErr
		}
		summary := SanitizeAssistantContent(resp.Content)
		if strings.TrimSpace(summary) == "" {
			return "", 0, fmt.Errorf("compaction returned empty summary")
		}
		summaries = append(summaries, summary)
	}
	if len(summaries) == 1 {
		return summaries[0], len(chunks), nil
	}
	if level >= maxCompactionMergeLevels {
		return "", 0, fmt.Errorf("compaction merge level exceeded: level=%d limit=%d", level, maxCompactionMergeLevels)
	}

	mergeUnits := make([]string, len(summaries))
	for i, summary := range summaries {
		mergeUnits[i] = fmt.Sprintf("partial summary %d: %s\n", i+1, summary)
	}
	merged, mergeChunks, mergeErr := l.summarizeCompactionUnits(ctx, mergeUnits, inputCap, level+1)
	return merged, len(chunks) + mergeChunks, mergeErr
}

func (l *Loop) packCompactionChunks(units []string, inputCap int) ([]string, error) {
	var chunks []string
	var current strings.Builder
	flush := func() {
		if current.Len() == 0 {
			return
		}
		chunks = append(chunks, current.String())
		current.Reset()
	}

	for _, unit := range units {
		parts, err := l.splitCompactionUnit(unit, inputCap)
		if err != nil {
			return nil, err
		}
		for _, part := range parts {
			candidate := current.String() + part
			if current.Len() > 0 && l.estimateCompactionRequestTokens(candidate) > inputCap {
				flush()
				candidate = part
			}
			if l.estimateCompactionRequestTokens(candidate) > inputCap {
				return nil, fmt.Errorf("atomic compaction unit exceeds input cap")
			}
			current.WriteString(part)
			if len(chunks) >= maxCompactionChunks {
				return nil, fmt.Errorf("compaction chunk limit exceeded: limit=%d", maxCompactionChunks)
			}
		}
	}
	flush()
	return chunks, nil
}

func (l *Loop) splitCompactionUnit(unit string, inputCap int) ([]string, error) {
	if l.estimateCompactionRequestTokens(unit) <= inputCap {
		return []string{unit}, nil
	}
	words := strings.Fields(unit)
	if le
```

### Core Architecture Module: `internal/agent/loop_context.go`
```
package agent

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"strings"

	"github.com/google/uuid"

	"github.com/nextlevelbuilder/goclaw/internal/bootstrap"
	"github.com/nextlevelbuilder/goclaw/internal/config"
	"github.com/nextlevelbuilder/goclaw/internal/store"
	"github.com/nextlevelbuilder/goclaw/internal/tools"
	"github.com/nextlevelbuilder/goclaw/internal/workspace"
)

// contextSetupResult holds the outputs of injectContext that are needed by the main loop.
type contextSetupResult struct {
	ctx                  context.Context
	resolvedTeamSettings json.RawMessage
}

// injectContext enriches the context with agent, tenant, user, workspace, and tool-level
// values needed by the agent loop and tool execution. Also runs input guard and message
// truncation. Returns error only if input guard blocks the message.
func (l *Loop) injectContext(ctx context.Context, req *RunRequest) (contextSetupResult, error) {
	isArtifactDelegation := req.RunKind == "delegate"

	// A nested run must not inherit filesystem, Team, media, or delegation
	// authority from its caller. Install explicit empty values before resolving
	// this run's own scope.
	ctx = store.WithRunContext(ctx, nil)
	ctx = tools.WithToolWorkspace(ctx, "")
	ctx = tools.WithToolTeamWorkspace(ctx, "")
	ctx = tools.WithToolTeamRoot(ctx, "")
	ctx = tools.WithToolTeamID(ctx, "")
	ctx = tools.WithTeamTaskID(ctx, "")
	ctx = tools.WithLeaderAgentID(ctx, "")
	ctx = tools.WithTenantAllowedPaths(ctx, nil)
	ctx = tools.WithWorkspaceChannel(ctx, "")
	ctx = tools.WithWorkspaceChatID(ctx, "")
	ctx = tools.WithDelegationID(ctx, "")
	ctx = tools.WithDelegationArtifactInputs(ctx, "")
	ctx = tools.WithRunKind(ctx, "")
	ctx = tools.WithRunMediaPaths(ctx, nil)
	ctx = tools.WithRunMediaNames(ctx, nil)
	ctx = tools.WithMediaImages(ctx, nil)
	ctx = tools.WithMediaImageRefs(ctx, nil)
	ctx = tools.WithMediaDocRefs(ctx, nil)
	ctx = tools.WithMediaAudioRefs(ctx, nil)
	ctx = tools.WithMediaVideoRefs(ctx, nil)

	// Inject agent UUID + key into context for tool routing
	if l.agentUUID != uuid.Nil {
		ctx = store.WithAgentID(ctx, l.agentUUID)
	}
	if l.id != "" {
		ctx = store.WithAgentKey(ctx, l.id)
	}
	// Inject tenant into context for tool-level tenant scoping (spawn, MCP, etc.)
	if l.tenantID != uuid.Nil {
		ctx = store.WithTenantID(ctx, l.tenantID)
	}
	// Propagate the configured agent budget to every nested model call.
	ctx = store.WithAgentContextWindow(ctx, l.contextWindow)
	ctx = store.WithAgentMaxTokens(ctx, l.effectiveMaxTokens())
	// Inject user ID into context for per-user scoping (memory, context files, etc.)
	if req.UserID != "" {
		ctx = store.WithUserID(ctx, req.UserID)
	}
	// Resolve merged tenant user identity for credential lookups.
	// Keeps UserID unchanged (session/workspace scoping) but sets a separate
	// CredentialUserID for SecureCLI, MCP, and other per-user features.
	if l.userResolver != nil && req.UserID != "" && store.ExplicitCredentialUserIDFromContext(ctx) == "" {
		credUserID := l.resolveCredentialUserID(ctx, *req)
		if credUserID != "" && credUserID != req.UserID {
			ctx = store.WithCredentialUserID(ctx, credUserID)
		}
	}
	// Inject agent type into context for interceptor routing
	if l.agentType != "" {
		ctx = store.WithAgentType(ctx, l.agentType)
	}
	// Inject self-evolve flag for predefined agents that can update SOUL.md
	if l.selfEvolve {
		ctx = store.WithSelfEvolve(ctx, true)
	}
	// Inject original sender ID for group file writer permission checks
	if req.SenderID != "" {
		ctx = store.WithSenderID(ctx, req.SenderID)
	}
	// Inject sender display name for bootstrap auto-contact
	if req.SenderName != "" {
		ctx = store.WithSenderName(ctx, req.SenderName)
	}
	// Inject caller role so RBAC-aware permission checks (CheckFileWriterPermission,
	// CheckCronPermission) can bypass per-user grants for authenticated admins
	// dispatched from dashboard or other trusted sources (#915).
	if req.Role != "" {
		ctx = store.WithRole(ctx, req.Role)
	}
	// Inject global + per-agent builtin tool settings (tier 1+3).
	// Media/provider-chain tools read the merged view via BuiltinToolSettingsFromCtx.
	if l.builtinToolSettings != nil {
		ctx = tools.WithBuiltinToolSettings(ctx, l.builtinToolSettings)
	}
	// Inject tenant-layer tool settings (tier 2). Merge with per-agent happens
	// at read time — per-agent still wins at tool-name level.
	if l.tenantToolSettings != nil {
		ctx = tools.WithTenantToolSettings(ctx, l.tenantToolSettings)
	}
	// Inject tenant-specific allowed paths for filesystem tools.
	if !isArtifactDelegation && len(l.tenantAllowedPaths) > 0 {
		ctx = tools.WithTenantAllowedPaths(ctx, l.tenantAllowedPaths)
	}
	// Inject channel type into context for tools (e.g. message tool needs it for Zalo group routing)
	if req.ChannelType != "" {
		ctx = tools.WithToolChannelType(ctx, req.ChannelType)
	}
	if len(req.TelegramManagerPermissions) > 0 {
		ctx = tools.WithTelegramManagerPermissions(ctx, req.TelegramManagerPermissions)
	}
	// Inject per-agent overrides from DB so tools honor per-agent settings.
	if l.restrictToWs != nil {
		ctx = tools.WithRestrictToWorkspace(ctx, *l.restrictToWs)
	}
	if l.subagentsCfg != nil {
		ctx = tools.WithSubagentConfig(ctx, l.subagentsCfg)
	}
	// Pass the agent's model and provider so subagents inherit the correct combo.
	if l.model != "" {
		ctx = tools.WithParentModel(ctx, l.model)
	}
	if l.provider != nil {
		ctx = tools.WithParentProvider(ctx, l.provider.Name())
	}
	if l.memoryCfg != nil {
		ctx = tools.WithMemoryConfig(ctx, l.memoryCfg)
	}
	var waitToolCfg *config.WaitToolPolicy
	if l.agentToolPolicy != nil && l.agentToolPolicy.Wait != nil {
		waitToolCfg = l.agentToolPolicy.Wait
		ctx = tools.WithWaitToolConfig(ctx, waitToolCfg)
	}
	if l.agentToolPolicy != nil && l.agentToolPolicy.RateLimitPerHour > 0 {
		ctx = tools.WithToolRateLimitOverride(ctx, l.agentToolPolicy.RateLimitPerHour)
	}
	if l.sandboxCfg != nil {
		ctx = tools.WithSandboxConfig(ctx, l.sandboxCfg)
	}
	if l.shellDenyGroups != nil {
		ctx = store.WithShellDenyGroups(ctx, l.shellDenyGroups)
	}

	// Workspace scope propagation (delegation origin → workspace tools).
	if req.WorkspaceChannel != "" {
		ctx = tools.WithWorkspaceChannel(ctx, req.WorkspaceChannel)
	}
	// WorkspaceChatID drives vault chat_id isolation in isolated teams. Callers
	// that don't set it explicitly fall back to req.ChatID — the chat segment
	// used for workspace path layering — so the vault filter activates uniformly
	// across every RunRequest entry point (WS direct, HTTP, cron, subagent).
	effectiveWorkspaceChatID := req.WorkspaceChatID
	if effectiveWorkspaceChatID == "" {
		effectiveWorkspaceChatID = req.ChatID
	}
	if effectiveWorkspaceChatID != "" {
		ctx = tools.WithWorkspaceChatID(ctx, effectiveWorkspaceChatID)
	}
	if req.TeamTaskID != "" {
		ctx = tools.WithTeamTaskID(ctx, req.TeamTaskID)
	}
	if req.DelegationID != "" {
		ctx = tools.WithDelegationID(ctx, req.DelegationID)
	}
	if req.RunKind != "" {
		ctx = tools.WithRunKind(ctx, req.RunKind)
	}

	// --- Per-user setup: file seeding + workspace resolution ---
	// Uses userSetups sync.Map to track both concerns atomically per user.
	// Seeding must run before buildMessages→resolveContextFiles reads context files.
	// Team sessions skip seeding: members process tasks from leader, not end-user onboarding.
	isTeamSession := bootstrap.IsTeamSession(req.SessionKey)
	channelMeta := l.buildChannelMeta(req)
	setup := l.getOrCreateUserSetup(ctx, req.UserID, req.Channel, isTeamSession, channelMeta)

	// Workspace resolution (layered pipeline).
	// Layer order: tenant → team → project (future) → user/chat
	// Two entry modes: solo agent (base = l.workspace) or team context (base = l.dataDir).
	// Result is always a single folder set via WithToolWorkspace.
	if !isArtifactDelegation && l.workspace != "" && req.UserID != "" {
		ws := setup.workspace
		if ws == "" {
			ws = l.workspace
		}
		// Apply user isolation layer via pipeline.
		shared := l.shouldShareWorkspace(req.UserID, req.PeerKind)
		if shared {
			ctx = store.WithSharedContext(ctx)
		}
		effectiveWorkspace := tools.ResolveWorkspace(ws,
			tools.UserChatLayer(tools.SanitizePathSegment(req.UserID), shared),
		)
		if l.shouldShareMemory() {
			ctx = store.WithSharedMemory(ctx)
		}
		if l.shouldShareKnowledgeGraph() {
			ctx = store.WithSharedKG(ctx)
		}
		if l.shouldShareSessions() {
			ctx = store.WithSharedSessions(ctx)
		}
		if err := os.MkdirAll(effectiveWorkspace, 0755); err != nil {
			// Stale stored workspace (e.g. Docker-era /app/workspace/ on bare-metal host)
			// would propagate as cmd.Dir into exec tools, where Linux's clone+chdir+execve
			// failure surfaces as a misleading "fork/exec PATH: no such file or directory"
			// — same message users would see for a missing binary. Fall back to the system
			// default workspace (already created at startup) so tools keep working while
			// the warning surfaces the data drift for operators.
			slog.Warn("failed to create user workspace directory; falling back to system default",
				"workspace", effectiveWorkspace, "fallback", l.workspace, "user", req.UserID, "error", err)
			effectiveWorkspace = l.workspace
		}
		ctx = tools.WithToolWorkspace(ctx, effectiveWorkspace)
	} else if !isArtifactDelegation && l.workspace != "" {
		ctx = tools.WithToolWorkspace(ctx, l.workspace)
	}

	if isArtifactDelegation {
		if req.TeamWorkspace != "" ||
			!validateDelegationArtifactWorkspace(req.DelegationID, req.DelegateInputsPath, req.DelegateOutputsPath) {
			return contextSetupResult{}, fmt.Errorf("invalid delegation artifact workspace")
		}
		ctx = tools.WithDelegationArtifactInputs(ctx, req.DelegateInputsPath)
		ctx = tools.WithToolWorkspace(ctx, req.DelegateOutputsPath)
		// A delegated lead is otherwise the only team agent running without its
		// own team in context, leaving the team's deliverables unreadable to it
		// (#1535). Read allowance only: the active workspace set above stays the
		// exchange outputs directory, a
```

### Core Architecture Module: `internal/agent/loop_finalize.go`
```
package agent

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"log/slog"

	"github.com/nextlevelbuilder/goclaw/internal/bootstrap"
	"github.com/nextlevelbuilder/goclaw/internal/eventbus"
	"github.com/nextlevelbuilder/goclaw/internal/i18n"
	"github.com/nextlevelbuilder/goclaw/internal/providers"
	"github.com/nextlevelbuilder/goclaw/internal/store"
)

// isUserFilePopulated checks if USER.md has been filled with actual user data
// beyond the blank template. The template has "- **Name:**\n" with no value.
func isUserFilePopulated(content string) bool {
	trimmed := strings.TrimSpace(content)
	if trimmed == "" {
		return false
	}
	// Template markers: "**Name:**" followed by newline (no value) or just whitespace
	for line := range strings.SplitSeq(content, "\n") {
		line = strings.TrimSpace(line)
		if line == "- **Name:**" || line == "**Name:**" {
			return false // name field still empty
		}
	}
	return true
}

// finalizeRun performs post-loop processing: sanitization, media dedup, session flush,
// bootstrap cleanup, and builds the final RunResult.
func (l *Loop) finalizeRun(
	ctx context.Context,
	rs *runState,
	req *RunRequest,
	history []providers.Message,
	hadBootstrap bool,
	toolTiming ToolTimingMap,
) *RunResult {
	// Extract MEDIA:<path> tokens the LLM echoed in its final response
	// BEFORE sanitize strips them. Covers cases where a tool returned its
	// artifact via the ForLLM MEDIA: prefix but the agent relayed it as plain
	// text (e.g. PDF from exec/weasyprint, TTS mp3 paths the LLM quotes back).
	if extracted := extractMediaFromContent(rs.finalContent, l.mediaEgressRoots(ctx)); len(extracted) > 0 {
		rs.mediaResults = append(rs.mediaResults, extracted...)
	}

	// 5. Full sanitization pipeline (matching TS extractAssistantText + sanitizeUserFacingText)
	rs.finalContent = SanitizeAssistantContent(rs.finalContent)

	// 6. Handle NO_REPLY: save to session for context but mark as silent.
	isSilent := IsSilentReply(rs.finalContent)

	// 5b. Skill evolution: postscript suggestion after complex tasks.
	if l.skillEvolve && l.skillNudgeInterval > 0 &&
		rs.totalToolCalls >= l.skillNudgeInterval &&
		rs.finalContent != "" && !isSilent && !rs.skillPostscriptSent {
		rs.skillPostscriptSent = true
		locale := store.LocaleFromContext(ctx)
		rs.finalContent += "\n\n---\n_" + i18n.T(locale, i18n.MsgSkillNudgePostscript) + "_"
	}

	// 7. Fallback only when there is no other deliverable output. Media-only
	// runs must remain media-only instead of gaining a visible caption. Use a
	// meaningful localized message instead of the old meaningless "...".
	hasDeliverableOutput := len(rs.mediaResults) > 0 ||
		len(req.ForwardMedia) > 0 ||
		req.ContentSuffix != ""
	if rs.finalContent == "" && !hasDeliverableOutput {
		rs.finalContent = i18n.T(store.LocaleFromContext(ctx), i18n.MsgEmptyReplyFallback)
	}

	// Append content suffix (e.g. image markdown for WS) before saving to session.
	// Dedup by basename: skip suffix lines whose file already appears in the agent's text.
	if req.ContentSuffix != "" {
		rs.finalContent += deduplicateMediaSuffix(rs.finalContent, req.ContentSuffix)
	}

	// Collect forwarded media + dedup + populate sizes BEFORE saving to session,
	// so we can attach output MediaRefs to the assistant message for history reload.
	for _, mf := range req.ForwardMedia {
		ct := mf.MimeType
		if ct == "" {
			ct = mimeFromExt(filepath.Ext(mf.Path))
		}
		rs.mediaResults = append(rs.mediaResults, MediaResult{Path: mf.Path, ContentType: ct})
	}
	rs.mediaResults = deduplicateMedia(rs.mediaResults)
	for i := range rs.mediaResults {
		if rs.mediaResults[i].Size == 0 {
			if info, err := os.Stat(rs.mediaResults[i].Path); err == nil {
				rs.mediaResults[i].Size = info.Size()
			}
		}
	}

	// Build final assistant message with output media refs for history persistence.
	assistantMsg := providers.Message{
		Role:     "assistant",
		Content:  rs.finalContent,
		Thinking: rs.finalThinking,
	}
	for _, mr := range rs.mediaResults {
		kind := "document"
		if strings.HasPrefix(mr.ContentType, "image/") {
			kind = "image"
		} else if strings.HasPrefix(mr.ContentType, "audio/") {
			kind = "audio"
		} else if strings.HasPrefix(mr.ContentType, "video/") {
			kind = "video"
		}
		assistantMsg.MediaRefs = append(assistantMsg.MediaRefs, providers.MediaRef{
			ID:       filepath.Base(mr.Path),
			MimeType: mr.ContentType,
			Kind:     kind,
			Path:     mr.Path,
		})
	}
	rs.pendingMsgs = append(rs.pendingMsgs, assistantMsg)

	// Bootstrap nudge: if model didn't call write_file on turn 2+, inject reminder
	// into session history so the next turn sees it.
	if hadBootstrap && l.bootstrapCleanup != nil {
		nudgeUserTurns := 1
		for _, m := range history {
			if m.Role == "user" {
				nudgeUserTurns++
			}
		}
		if !rs.bootstrapWriteDetected && nudgeUserTurns >= 2 && nudgeUserTurns < bootstrapAutoCleanupTurns {
			rs.pendingMsgs = append(rs.pendingMsgs, providers.Message{
				Role:    "user",
				Content: "[System] You haven't completed onboarding yet. Please update USER.md with the user's details and clear BOOTSTRAP.md as instructed.",
			})
		}
	}

	// Bootstrap auto-cleanup: after enough conversation turns, remove BOOTSTRAP.md.
	// If USER.md is still the blank template, inject a reminder so the agent fills it.
	// Must run BEFORE session flush so the nudge message is persisted to history.
	if hadBootstrap && l.bootstrapCleanup != nil {
		userTurns := 1 // current user message
		for _, m := range history {
			if m.Role == "user" {
				userTurns++
			}
		}
		if userTurns >= bootstrapAutoCleanupTurns {
			if cleanErr := l.bootstrapCleanup(ctx, l.agentUUID, req.UserID); cleanErr != nil {
				slog.Warn("bootstrap auto-cleanup failed", "error", cleanErr, "agent", l.id, "user", req.UserID)
			} else {
				slog.Info("bootstrap auto-cleanup completed", "agent", l.id, "user", req.UserID, "turns", userTurns)
				// Check if USER.md is still the blank template — nudge agent to fill it
				if l.contextFileLoader != nil {
					files := l.contextFileLoader(ctx, l.agentUUID, req.UserID, l.agentType)
					for _, f := range files {
						if f.Path == bootstrap.UserFile && !isUserFilePopulated(f.Content) {
							rs.pendingMsgs = append(rs.pendingMsgs, providers.Message{
								Role:    "user",
								Content: "[System] You completed onboarding but USER.md is still empty. Please update USER.md with the user's name and details from this conversation using write_file.",
							})
							break
						}
					}
				}
			}
		}
	}

	// Flush all buffered messages to session atomically.
	for _, msg := range rs.pendingMsgs {
		l.sessions.AddMessage(ctx, req.SessionKey, msg)
	}

	// Persist adaptive tool timing to session metadata.
	if serialized := toolTiming.Serialize(); serialized != "" {
		l.sessions.SetSessionMetadata(ctx, req.SessionKey, map[string]string{"tool_timing": serialized})
	}

	// Write session metadata (matching TS session entry updates)
	l.sessions.UpdateMetadata(ctx, req.SessionKey, l.model, l.provider.Name(), req.Channel)
	l.sessions.AccumulateTokens(ctx, req.SessionKey, int64(rs.totalUsage.PromptTokens), int64(rs.totalUsage.CompletionTokens))

	// Calibrate token estimation using the last LLM request, not the total run.
	if rs.lastUsage.PromptTokens > 0 && rs.lastUsageMsgCount > 0 {
		l.sessions.SetLastPromptTokens(ctx, req.SessionKey, rs.lastUsage.PromptTokens, rs.lastUsageMsgCount)
	}

	l.sessions.Save(ctx, req.SessionKey)

	// 8. Metadata Stripping: Clean internal [[...]] tags for user-facing content
	rs.finalContent = StripMessageDirectives(rs.finalContent)
	if isSilent {
		slog.Info("agent loop: NO_REPLY detected, suppressing delivery",
			"agent", l.id, "session", req.SessionKey)
		rs.finalContent = ""
		if req.ContentSuffix != "" {
			rs.finalContent = deduplicateMediaSuffix("", req.ContentSuffix)
		}
	}

	// 9. Maybe summarize
	// Legacy v2 path has no mid-loop pressure signal (that lives in v3 RunState.Prune),
	// so pass false — this preserves the original baseline-threshold behavior here.
	l.maybeSummarize(ctx, req.SessionKey, false)

	// V3: emit session.completed for consolidation pipeline (episodic → semantic → dreaming)
	if l.domainBus != nil {
		// Bug C parity: include count in SourceID so the eventbus dedup key advances
		// per compaction cycle (matches the v3 adapter emit path). This path is
		// currently disabled (FinalizeStage owns finalization) but kept in sync.
		finalizeCount := l.sessions.GetCompactionCount(ctx, req.SessionKey)
		l.domainBus.Publish(eventbus.DomainEvent{
			Type:     eventbus.EventSessionCompleted,
			TenantID: l.tenantID.String(),
			AgentID:  l.agentUUID.String(),
			UserID:   req.UserID,
			SourceID: fmt.Sprintf("%s:%d", req.SessionKey, finalizeCount),
			Payload: &eventbus.SessionCompletedPayload{
				SessionKey:      req.SessionKey,
				MessageCount:    len(history) + len(rs.pendingMsgs),
				TokensUsed:      rs.totalUsage.PromptTokens + rs.totalUsage.CompletionTokens,
				CompactionCount: finalizeCount,
			},
		})
	}

	var lastUsage *providers.Usage
	if rs.lastUsage.PromptTokens > 0 || rs.lastUsage.CompletionTokens > 0 || rs.lastUsage.TotalTokens > 0 {
		lastUsage = &rs.lastUsage
	}

	return &RunResult{
		Content:        rs.finalContent,
		Thinking:       rs.finalThinking,
		RunID:          req.RunID,
		Iterations:     rs.iteration,
		Usage:          &rs.totalUsage,
		LastUsage:      lastUsage,
		Media:          rs.mediaResults,
		Deliverables:   rs.deliverables,
		BlockReplies:   rs.blockReplies,
		LastBlockReply: rs.lastBlockReply,
		LoopKilled:     rs.loopKilled,
	}
}

```

### Core Architecture Module: `internal/agent/loop_history.go`
```
package agent

import (
	"context"
	"fmt"
	"log/slog"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
	"github.com/nextlevelbuilder/goclaw/internal/bootstrap"
	"github.com/nextlevelbuilder/goclaw/internal/edition"
	"github.com/nextlevelbuilder/goclaw/internal/providers"
	"github.com/nextlevelbuilder/goclaw/internal/store"
	"github.com/nextlevelbuilder/goclaw/internal/tools"
)

// buildMessages constructs the full message list for an LLM request.
// Returns the messages and whether BOOTSTRAP.md was present in context files
// (used by the caller for auto-cleanup without an extra DB roundtrip).
func (l *Loop) buildMessages(ctx context.Context, history []providers.Message, summary, userMessage, extraSystemPrompt, sessionKey, channel, channelType, bitrixPortalDomain, chatTitle, chatID, peerKind, userID, senderName string, historyLimit int, skillFilter []string, lightContext bool, telegramManagerPermissions []string) ([]providers.Message, bool) {
	var messages []providers.Message

	// Build system prompt — 3-layer mode resolution: runtime > auto-detect > config
	mode := resolvePromptMode("", sessionKey, l.promptMode)

	_, hasSpawn := l.tools.Get("spawn")
	_, hasTeamTools := l.tools.Get("team_tasks")
	_, hasSkillSearch := l.tools.Get("skill_search")
	_, hasSkillManage := l.tools.Get("skill_manage")
	_, hasMCPToolSearch := l.tools.Get("mcp_tool_search")
	_, hasKG := l.tools.Get("knowledge_graph_search")
	_, hasMemoryExpand := l.tools.Get("memory_expand")

	// Per-user workspace: show the user's subdirectory in the system prompt.
	// Uses cached workspace from userSetups (includes channel isolation).
	// When workspace sharing is enabled, show the base workspace without user subfolder.
	promptWorkspace := l.workspace
	if l.agentUUID != uuid.Nil && userID != "" && l.workspace != "" {
		shared := l.shouldShareWorkspace(userID, peerKind)
		baseWs := l.workspace
		if val, ok := l.userSetups.Load(userID); ok {
			if ws := val.(*userSetup).workspace; ws != "" {
				baseWs = ws
			}
		}
		promptWorkspace = tools.ResolveWorkspace(baseWs,
			tools.UserChatLayer(tools.SanitizePathSegment(userID), shared),
		)
	}
	if tools.IsDelegationArtifactRun(ctx) {
		promptWorkspace = "."
		const artifactGuidance = "Delegation workspace: write outputs using ordinary relative paths in the current workspace. Read staged inputs only through inputs/... . Files are returned to the caller only after runtime validation and publication."
		if extraSystemPrompt != "" {
			extraSystemPrompt += "\n\n"
		}
		extraSystemPrompt += artifactGuidance
	}

	// Resolve context files once — also detect BOOTSTRAP.md presence.
	// lightContext: skip loading context files, only inject ExtraSystemPrompt (heartbeat checklist).
	var contextFiles []bootstrap.ContextFile
	if !lightContext {
		contextFiles = l.resolveContextFiles(ctx, userID)

		// Fallback: if DB seeding failed (e.g. SQLITE_BUSY) but we have
		// in-memory embedded templates, merge them so the first turn still
		// gets bootstrap onboarding. Only applies when DB returned no user files.
		if val, ok := l.userSetups.Load(userID); ok {
			if fb := val.(*userSetup).fallbackBootstrap; len(fb) > 0 {
				contextFiles = l.mergeContextFallback(contextFiles, fb)
				// Clear after first use — next turn should read from DB.
				val.(*userSetup).fallbackBootstrap = nil
			}
		}
	}
	hadBootstrap := false
	for _, cf := range contextFiles {
		if cf.Path == bootstrap.BootstrapFile {
			hadBootstrap = true
			break
		}
	}

	// Bootstrap mode: only direct user DMs need onboarding.
	// System sessions (group, team, subagent, cron, heartbeat) skip bootstrap
	// to prevent the model from getting distracted by onboarding instructions.
	isSystemSession := peerKind == "group" ||
		bootstrap.IsTeamSession(sessionKey) ||
		bootstrap.IsSubagentSession(sessionKey) ||
		bootstrap.IsCronSession(sessionKey) ||
		bootstrap.IsHeartbeatSession(sessionKey)
	if hadBootstrap && isSystemSession {
		filtered := make([]bootstrap.ContextFile, 0, len(contextFiles))
		for _, cf := range contextFiles {
			if cf.Path != bootstrap.BootstrapFile {
				filtered = append(filtered, cf)
			}
		}
		contextFiles = filtered
		hadBootstrap = false
	}

	// Bootstrap auto-contact: inject known sender info from channel metadata.
	// DM only — group chats have permission checks and multiple senders.
	if hadBootstrap && peerKind == "direct" {
		if senderName := store.SenderNameFromContext(ctx); senderName != "" {
			hint := fmt.Sprintf("Known user info (from %s): Name=%q\nTimezone: not yet known. When the user mentions times, schedules, or reminders, ask for their timezone and update USER.md.", channelType, senderName)
			if extraSystemPrompt != "" {
				extraSystemPrompt += "\n\n"
			}
			extraSystemPrompt += hint
		}
	}

	// Group writer restrictions: filter context files + inject prompt
	if l.configPermStore != nil && (strings.HasPrefix(userID, "group:") || strings.HasPrefix(userID, "guild:")) {
		senderID := store.SenderIDFromContext(ctx)
		writerPrompt, filtered := l.buildGroupWriterPrompt(ctx, userID, senderID, contextFiles)
		contextFiles = filtered
		if writerPrompt != "" {
			if extraSystemPrompt != "" {
				extraSystemPrompt += "\n\n"
			}
			extraSystemPrompt += writerPrompt
		}
	}

	slashReq := &RunRequest{
		SessionKey: sessionKey,
		UserID:     userID,
		SenderID:   store.SenderIDFromContext(ctx),
		Channel:    channel,
		ChatID:     chatID,
		PeerKind:   peerKind,
	}
	userMessage, extraSystemPrompt, skillFilter = l.applySkillSlashCommand(ctx, slashReq, userMessage, extraSystemPrompt, skillFilter)

	// Build tool list, filtering out skill_manage when skill_evolve is off.
	// Also applies ChannelAware filtering so channel-specific tools don't
	// appear in ## Tooling when the current channel doesn't support them.
	toolNames := l.filteredToolNamesForChannel(channelType, telegramManagerPermissions)
	if !l.skillEvolve {
		filtered := toolNames[:0:0]
		for _, n := range toolNames {
			if n != "skill_manage" {
				filtered = append(filtered, n)
			}
		}
		toolNames = filtered
	}
	// Exclude tool aliases from the system prompt tool list.
	// Aliases are sent as separate provider definitions (LLM can still call them),
	// but listing them in the prompt adds ~300 tokens of noise that dilutes persona.
	if l.tools != nil {
		aliasSet := l.tools.Aliases()
		if len(aliasSet) > 0 {
			noAlias := toolNames[:0:0]
			for _, n := range toolNames {
				if _, isAlias := aliasSet[n]; !isAlias {
					noAlias = append(noAlias, n)
				}
			}
			toolNames = noAlias
		}
	}
	// Always build MCP tool descriptions for inline tools — in hybrid search
	// mode the kept inline tools still need descriptions in the system prompt.
	// A-G1 fix (260512): scope MCP descriptions to the calling actor's available
	// tools. Otherwise lookupMCPDescFromUserTools surfaces descriptions from
	// any user's cache → LLM sees tools it can't actually call (executeToolForActor
	// scoped to actorUserID returns "tool not found"). Compute actor via
	// CredentialUserID (merged tenant_user identity) to match the cache key
	// used by getUserMCPTools. Fall back to resolveActorUserID for channels
	// without merge resolution.
	actorUserID := store.CredentialUserIDFromContext(ctx)
	if actorUserID == "" {
		actorUserID = resolveActorUserID(userID, store.SenderIDFromContext(ctx), peerKind, channelType)
	}
	mcpToolDescs := l.buildMCPToolDescs(toolNames, actorUserID)

	// Bootstrap DM mode: only restrict tools for open agents (identity being created).
	// Predefined agents keep full capabilities — BOOTSTRAP.md guides behavior.
	if hadBootstrap && l.agentType != store.AgentTypePredefined {
		toolNames = filterBootstrapTools(toolNames)
		mcpToolDescs = nil
	}

	// Determine whether to inject team context into the system prompt.
	// Team context (TEAM.md, workspace section, members roster) is injected when:
	//   - This is a team-dispatched session (team: prefix), OR
	//   - Agent is the lead of a team AND this is an inbound (non-dispatch) session.
	// Member-only agents in inbound chat get spawn section instead of team context.
	isTeamDispatch := bootstrap.IsTeamSession(sessionKey)
	injectTeamContext := isTeamDispatch || (hasTeamTools && l.isTeamLead)

	// Filter TEAM.md from context files when team context should not be injected
	// (i.e. member-only agent in inbound chat — spawn section applies instead).
	if !injectTeamContext {
		filtered := make([]bootstrap.ContextFile, 0, len(contextFiles))
		for _, cf := range contextFiles {
			if cf.Path != bootstrap.TeamFile {
				filtered = append(filtered, cf)
			}
		}
		contextFiles = filtered
	}

	// Mode-aware context file filtering: each mode loads different files.
	if allowlist := bootstrap.ModeAllowlist(string(mode)); allowlist != nil {
		filtered := make([]bootstrap.ContextFile, 0, len(contextFiles))
		for _, cf := range contextFiles {
			if allowlist[cf.Path] {
				filtered = append(filtered, cf)
			}
		}
		contextFiles = filtered
	}

	// Resolve team members so agent knows who to assign tasks to.
	// Only resolve when team context is active — avoids unnecessary DB query for member-only inbound chats.
	var teamMembers []store.TeamMemberData
	if injectTeamContext && hasTeamTools && l.teamStore != nil && l.agentUUID != uuid.Nil {
		if team, _ := l.teamStore.GetTeamForAgent(ctx, l.agentUUID); team != nil {
			teamMembers, _ = l.teamStore.ListMembers(ctx, team.ID)
		}
	}

	systemPrompt := BuildSystemPrompt(SystemPromptConfig{
		AgentID:                l.id,
		AgentUUID:              l.agentUUID.String(),
		DisplayName:            l.displayName,
		Model:                  l.model,
		Workspace:              promptWorkspace,
		Channel:                channel,
		ChannelType:            channelType,
		BitrixPortalDomain:     bitrixPortalDomain,
		ChatID:                 chatID,
		ChatTitle:              chatTitle,
		PeerKind:               peerKind,
		OwnerIDs:               l.ownerIDs,
		SenderID:               store.SenderIDFromContext(ctx),
		SenderName:  
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

- **Issue #1550** (2026-10-03): **[Bug] Xoá agent thất bại — unique index uq_vault_docs_agent_team_scope_path va chạm khi orphan vault docs sang scope shared**
  *Symptoms*: # [Bug] Xoá agent thất bại — unique index `uq_vault_docs_agent_team_scope_path` va chạm khi orphan vault docs sang scope `shared`  ## Mô tả vấn đề  Khi xoá một agent có vault documents, RPC `agents.delete` trả về lỗi 500:  ``` Error deleting agent: gateway error (500): failed to delete agent: internal error ```  Log gateway:  ``` level=ERROR msg=agents.delete id=019e5e1c-…-18d288d10167   error="ERROR: duplicate key value violates unique constraint          \"uq_vault_docs_agent_team_scope_path\" (SQLSTATE 23505)" ```  Agent không thể xoá được bằng bất kỳ đường nào (Web UI, CLI `goclaw agent delete --force`, RPC). Toàn bộ transaction bị rollback.  Đây là **hệ quả trực tiếp của cách fix #1077** (orphan vault docs sang `scope='shared'` thay vì `personal`). Fix đó giải quyết được CHECK constraint 23514, nhưng đẩy mọi doc mồ côi vào chung một không gian khoá và tạo ra va chạm UNIQUE 23505.  ## Nguyên nhân gốc  Ba thay đổi trong `migrations/000046_vault_nullable_agent_id.up.sql` kết hợp lại tạo ra va chạm không thể tránh:  ``` DELETE FROM agents WHERE id = $1   ↓ (2) FK: vault_documents.agent_id … ON DELETE SET NULL   → PostgreSQL SET agent_id = NULL   ↓ (4) Trigger trg_vault_docs_agent_null_scope:   → NEW.scope := 'shared'   ↓ (3) UNIQUE INDEX uq_vault_docs_agent_team_scope_path:   (tenant_id, COALESCE(agent_id,'000…0'), COALESCE(team_id,'000…0'), scope, path)   → agent_id NULL bị COALESCE về CÙNG một sentinel   → mọi doc mồ côi của MỌI agent đã xoá đều rơi vào cùng key space   ↓ 
  **Post-Mortem & Fix Analysis**:
  > Cảm ơn @aaron-tsar đã báo cáo chi tiết. Phân tích root cause rất rõ ràng — va chạm UNIQUE index khi orphan vault docs sang scope 'shared' là hệ quả trực tiếp của fix #1077.  Đã xác nhận đây là bug P2-medium với cơ chế tái hiện rõ ràng. Đề xuất phương án 1 (namespace theo agent cũ) vì bảo toàn dữ liệu đúng như chủ đích ban đầu của #1077.  Cần maintainer review và chọn phương án fix. Workaround tạm thời: xoá vault documents trước khi xoá agent.
  > I will take this issue. Please assign it to me.  The problem seems to be with the unique index `uq_vault_docs_agent_team_scope_path`. When an agent is deleted, orphaned vault documents are moved to the 'shared' scope, causing a unique constraint violation. I will first inspect the `migrations/000046_vault_nullable_agent_id.up.sql` file. Specifically, I will look at the COALESCE function in the unique index and the trigger that changes the scope. A potential fix could involve adjusting the logic to ensure unique keys for orphaned documents, possibly by modifying the sentinel values or the trigger conditions. 
  > Maintainer follow-up: the report remains confirmed against current `dev`. Migration `000046_vault_nullable_agent_id.up.sql` still combines `ON DELETE SET NULL`, the null-to-`shared` trigger, and the tenant-wide COALESCE unique index, so identical paths from two deleted agent scopes collide exactly as described. No linked fix PR exists.nn@Kaustubh1235: please open a **draft PR against `dev`** before changing the migration. Keep it narrowly focused on preserving orphaned documents without a shared-path collision, include an upgrade migration for existing rows/indexes, and add an integration regression that deletes two agents with the same vault path in one tenant. Preserve team/tenant scope behavior and document any re-index or path-compatibility consequences.nnThe temporary workaround remains deleting or safely re-pathing that agent's vault documents before deletion.nn*Maintainer follow-up by github-maintain cron-safe automation*

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

### Incident Patch 1: `28afa5b6` (2026-10-04)
**Commit Message**: fix(ui+http): timezone validator + system-configs 404 noise (#1173)

* fix(ui+http): timezone validator + system-configs 404 noise

Two small quick-fixes:

1. Timezone save rejected with "Invalid timezone" toast even when the
   user picked a valid IANA name from the dropdown. Root cause:
   isValidIanaTimezone built a Set from Intl.supportedValuesOf() then
   canonicalized each name via Intl.DateTimeFormat(...).resolvedOptions().
   Across browser/OS combos this drops or remaps some names (e.g.
   Asia/Saigon ↔ Asia/Ho_Chi_Minh varies — only one ends up in the
   rebuilt Set, depending on the browser's tz database revision).
   When the user's stored value happens to be the absent form, save
   fails. Replace with direct Intl.DateTimeFormat try/catch — the
   canonical IANA validation path; accepts every name the browser
   understands, deprecated aliases included.

2. /v1/system-configs/{key} returned 404 for missing alert keys. The
   frontend (background-error-banner.tsx) already handles this silently
   via .catch — but Chrome logs the 404 to the console regardless.
   The polled alert key (alert.background.provider_error) legitimately
   doesn't exist most of the time, so the

**File**: `internal/http/system_configs.go` (modified, +5/-3)
```diff
@@ -3,6 +3,7 @@ package http
 import (
 	"context"
 	"encoding/json"
+	"errors"
 	"net/http"
 	"regexp"
 
@@ -54,12 +55,13 @@ func (h *SystemConfigsHandler) handleList(w http.ResponseWriter, r *http.Request
 }
 
 func (h *SystemConfigsHandler) handleGet(w http.ResponseWriter, r *http.Request) {
-	locale := extractLocale(r)
 	key := r.PathValue("key")
 	val, err := h.store.Get(r.Context(), key)
 	if err != nil {
-		writeJSON(w, http.StatusNotFound, map[string]string{"error": i18n.T(locale, i18n.MsgNotFound, "config", key)})
-		return
+		if !errors.Is(err, store.ErrSystemConfigNotFound) {
+			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
+			return
+		}
 	}
 	writeJSON(w, http.StatusOK, map[string]string{"key": key, "value": val})
 }
```

**File**: `internal/http/system_configs_test.go` (added, +71/-0)
```diff
@@ -0,0 +1,71 @@
+package http
+
+import (
+	"context"
+	"encoding/json"
+	"errors"
+	stdhttp "net/http"
+	"net/http/httptest"
+	"strings"
+	"testing"
+
+	"github.com/nextlevelbuilder/goclaw/internal/store"
+)
+
+type systemConfigStoreStub struct {
+	getValue string
+	getErr   error
+}
+
+func (s systemConfigStoreStub) Get(context.Context, string) (string, error) {
+	return s.getValue, s.getErr
+}
+
+func (systemConfigStoreStub) Set(context.Context, string, string) error {
+	return nil
+}
+
+func (systemConfigStoreStub) Delete(context.Context, string) error {
+	return nil
+}
+
+func (systemConfigStoreStub) List(context.Context) (map[string]string, error) {
+	return nil, nil
+}
+
+func TestSystemConfigsHandleGetMissingKeyReturnsEmptyValue(t *testing.T) {
+	h := NewSystemConfigsHandler(systemConfigStoreStub{getErr: store.ErrSystemConfigNotFound}, nil)
+	req := httptest.NewRequest(stdhttp.MethodGet, "/v1/system-configs/alert.background.provider_error", nil)
+	req.SetPathValue("key", "alert.background.provider_error")
+	rec := httptest.NewRecorder()
+
+	h.handleGet(rec, req)
+
+	if rec.Code != stdhttp.StatusOK {
+		t.Fatalf("status = %d, want %d", rec.Code, stdhttp.StatusOK)
+	}
+
+	var got map[string]string
+	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
+		t.Fatalf("decode response: %v", err)
+	}
+	if got["key"] != "alert.background.provider_error" || got["value"] != "" {
+		t.Fatalf("response = %#v", got)
+	}
+}
+
+func TestSystemConfigsHandleGetStoreErrorReturnsServerError(t *testing.T) {
+	h := NewSystemConfigsHandler(systemConfigStoreStub{getErr: errors.New("system config get: tenant_id required")}, nil)
+	req := httptest.NewRequest(stdhttp.MethodGet, "/v1/system-configs/background.provider", nil)
+	req.SetPathValue("key", "background.provider")
+	rec := httptest.NewRecorder()
+
+	h.handleGet(rec, req)
+
+	if rec.Code != stdhttp.StatusInternalServerError {
+		t.Fatalf("status = %d, want %d", rec.Code, stdhttp.StatusInternalServerError)
+	}
+	if !strings.Contains(rec.Body.String(), "tenant_id required") {
+		t.Fatalf("response body = %q", rec.Body.String())
+	}
+}
```

**File**: `internal/store/pg/system_configs.go` (modified, +1/-1)
```diff
@@ -46,7 +46,7 @@ func (s *PGSystemConfigStore) Get(ctx context.Context, key string) (string, erro
 		return "", fmt.Errorf("system config get: %w", err)
 	}
 
-	return "", fmt.Errorf("system config not found: %s", key)
+	return "", fmt.Errorf("%w: %s", store.ErrSystemConfigNotFound, key)
 }
 
 func (s *PGSystemConfigStore) Set(ctx context.Context, key, value string) error {
```

**File**: `internal/store/sqlitestore/system-configs.go` (modified, +3/-1)
```diff
@@ -9,6 +9,8 @@ import (
 	"fmt"
 	"log/slog"
 	"time"
+
+	"github.com/nextlevelbuilder/goclaw/internal/store"
 )
 
 // SQLiteSystemConfigStore implements store.SystemConfigStore backed by SQLite.
@@ -36,7 +38,7 @@ func (s *SQLiteSystemConfigStore) Get(ctx context.Context, key string) (string,
 		return val, nil
 	}
 	if errors.Is(err, sql.ErrNoRows) {
-		return "", fmt.Errorf("system config not found: %s", key)
+		return "", fmt.Errorf("%w: %s", store.ErrSystemConfigNotFound, key)
 	}
 	return "", fmt.Errorf("system config get: %w", err)
 }
```

**File**: `internal/store/system_config_store.go` (modified, +6/-1)
```diff
@@ -1,6 +1,11 @@
 package store
 
-import "context"
+import (
+	"context"
+	"errors"
+)
+
+var ErrSystemConfigNotFound = errors.New("system config not found")
 
 // SystemConfigStore manages per-tenant configuration settings.
 // Non-secret, plain-text key-value pairs. Use ConfigSecretsStore for secrets.
```

**File**: `ui/web/src/lib/timezone-utils.ts` (modified, +11/-6)
```diff
@@ -78,12 +78,17 @@ export function getAllIanaTimezones(): TzOption[] {
   return _cachedTimezones;
 }
 
-let _cachedTzSet: Set<string> | undefined;
-
-/** Check if a value is a valid IANA timezone from the dynamic list. */
+/** Validate via Intl directly — accepts canonical + deprecated aliases that
+ * the browser's tz database knows (e.g. Asia/Saigon ↔ Asia/Ho_Chi_Minh).
+ * The earlier Set-based check rejected names whose canonical form differed
+ * from the user's stored value across browser/OS combos.
+ */
 export function isValidIanaTimezone(tz: string): boolean {
-  if (!_cachedTzSet) {
-    _cachedTzSet = new Set(getAllIanaTimezones().map((t) => t.value));
+  if (!tz) return false;
+  try {
+    new Intl.DateTimeFormat("en-US", { timeZone: tz });
+    return true;
+  } catch {
+    return false;
   }
-  return _cachedTzSet.has(tz);
 }
```

---

### Incident Patch 2: `08470a81` (2026-10-03)
**Commit Message**: Merge pull request #1583 from Kaustubh1235/fix/1550-vault-orphan-provenance

Fix agent deletion failing on an orphaned vault path collision

**File**: `internal/gateway/methods/agents_delete.go` (modified, +9/-0)
```diff
@@ -47,6 +47,15 @@ func (m *AgentsMethods) handleDelete(ctx context.Context, client *gateway.Client
 		}
 
 		if err := m.agentStore.Delete(ctx, ag.ID); err != nil {
+			// A UNIQUE violation here is the vault-document orphan collision of #1550:
+			// the FK sets agent_id to NULL, the scope trigger moves the row to 'shared',
+			// and before migration 000099 every orphan in a tenant shared one key, so a
+			// path another deleted owner already orphaned aborts the whole delete. Name
+			// that cause instead of surfacing the raw SQLSTATE as an internal error.
+			if isDuplicateKeyErr(err) {
+				client.SendResponse(protocol.NewErrorResponse(req.ID, protocol.ErrInternal, i18n.T(locale, i18n.MsgAgentDeleteVaultConflict)))
+				return
+			}
 			client.SendResponse(protocol.NewErrorResponse(req.ID, protocol.ErrInternal, i18n.T(locale, i18n.MsgFailedToDelete, "agent", fmt.Sprintf("%v", err))))
 			return
 		}
```

**File**: `internal/i18n/catalog_en.go` (modified, +2/-0)
```diff
@@ -19,6 +19,8 @@ func init() {
 		MsgFailedToDelete:   "failed to delete %s: %s",
 		MsgFailedToSave:     "failed to save %s: %s",
 		MsgInvalidUpdates:   "invalid updates",
+		// Vault orphan collision on agent delete (#1550)
+		MsgAgentDeleteVaultConflict: "failed to delete agent: a vault document of this agent is at a path another deleted owner already orphaned; delete or re-path this agent's vault documents first, or upgrade to schema version 99 or later",
 
 		// Agent
 		MsgAgentNotFound:                       "agent not found: %s",
```

**File**: `internal/i18n/catalog_ko.go` (modified, +2/-0)
```diff
@@ -19,6 +19,8 @@ func init() {
 		MsgFailedToDelete:   "%s 삭제에 실패했습니다: %s",
 		MsgFailedToSave:     "%s 저장에 실패했습니다: %s",
 		MsgInvalidUpdates:   "잘못된 업데이트",
+		// TODO(i18n): translate to ko
+		MsgAgentDeleteVaultConflict: "failed to delete agent: a vault document of this agent is at a path another deleted owner already orphaned; delete or re-path this agent's vault documents first, or upgrade to schema version 99 or later",
 
 		// Agent
 		MsgAgentNotFound:       "에이전트를 찾을 수 없습니다: %s",
```

**File**: `internal/i18n/catalog_ru.go` (modified, +2/-0)
```diff
@@ -19,6 +19,8 @@ func init() {
 		MsgFailedToDelete:   "не удалось удалить %s: %s",
 		MsgFailedToSave:     "не удалось сохранить %s: %s",
 		MsgInvalidUpdates:   "неверные обновления",
+		// TODO(i18n): translate to ru
+		MsgAgentDeleteVaultConflict: "failed to delete agent: a vault document of this agent is at a path another deleted owner already orphaned; delete or re-path this agent's vault documents first, or upgrade to schema version 99 or later",
 
 		// Agent
 		MsgAgentNotFound:                       "агент не найден: %s",
```

**File**: `internal/i18n/catalog_vi.go` (modified, +2/-0)
```diff
@@ -19,6 +19,8 @@ func init() {
 		MsgFailedToDelete:   "không thể xóa %s: %s",
 		MsgFailedToSave:     "không thể lưu %s: %s",
 		MsgInvalidUpdates:   "cập nhật không hợp lệ",
+		// TODO(i18n): translate to vi
+		MsgAgentDeleteVaultConflict: "failed to delete agent: a vault document of this agent is at a path another deleted owner already orphaned; delete or re-path this agent's vault documents first, or upgrade to schema version 99 or later",
 
 		// Agent
 		MsgAgentNotFound:                       "không tìm thấy agent: %s",
```

**File**: `internal/i18n/catalog_zh.go` (modified, +2/-0)
```diff
@@ -19,6 +19,8 @@ func init() {
 		MsgFailedToDelete:   "删除 %s 失败：%s",
 		MsgFailedToSave:     "保存 %s 失败：%s",
 		MsgInvalidUpdates:   "更新内容无效",
+		// TODO(i18n): translate to zh
+		MsgAgentDeleteVaultConflict: "failed to delete agent: a vault document of this agent is at a path another deleted owner already orphaned; delete or re-path this agent's vault documents first, or upgrade to schema version 99 or later",
 
 		// Agent
 		MsgAgentNotFound:                       "未找到Agent：%s",
```

**File**: `internal/i18n/keys.go` (modified, +4/-0)
```diff
@@ -21,6 +21,10 @@ const (
 	MsgFailedToSave     = "error.failed_to_save"    // "failed to save %s: %s"
 	MsgInvalidUpdates   = "error.invalid_updates"   // "invalid updates"
 
+	// Agent deletion blocked by the vault orphan collision of #1550. Fixed by migration
+	// 000099; kept for installations still on an earlier schema version.
+	MsgAgentDeleteVaultConflict = "error.agent_delete_vault_conflict"
+
 	// --- Agent ---
 	MsgAgentNotFound                       = "error.agent_not_found"       // "agent not found: %s"
 	MsgCannotDeleteDefault                 = "error.cannot_delete_default" // "cannot delete the default agent"
```

**File**: `internal/store/pg/vault_documents.go` (modified, +5/-1)
```diff
@@ -123,7 +123,11 @@ func (s *PGVaultStore) UpsertDocument(ctx context.Context, doc *store.VaultDocum
 		INSERT INTO vault_documents
 			(id, tenant_id, agent_id, team_id, chat_id, scope, custom_scope, path, title, doc_type, content_hash, summary, embedding, metadata, created_at, updated_at)
 		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $15)
-		ON CONFLICT (tenant_id, COALESCE(agent_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(team_id, '00000000-0000-0000-0000-000000000000'::uuid), scope, path) DO UPDATE SET
+		-- The conflict target must name uq_vault_docs_agent_team_scope_path exactly, including the
+		-- orphaned_from_id expression migration 000099 appended; a target Postgres cannot match an
+		-- index for is SQLSTATE 42P10 on every upsert. A live document carries a NULL there, so it
+		-- conflicts with other live documents and never with an orphan.
+		ON CONFLICT (tenant_id, COALESCE(agent_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(team_id, '00000000-0000-0000-0000-000000000000'::uuid), scope, path, COALESCE(orphaned_from_id, '00000000-0000-0000-0000-000000000000'::uuid)) DO UPDATE SET
 			title        = EXCLUDED.title,
 			doc_type     = EXCLUDED.doc_type,
 			content_hash = EXCLUDED.content_hash,
```

---

### Incident Patch 3: `f398344f` (2026-10-03)
**Commit Message**: feat(hooks): expose sender_id in lifecycle events and fix test dry-run cache (#1595)

- Expose SenderID and UserID on hooks.Event across pipeline stages (tool, context, observe, finalize)
- Expose senderId/sender_id and userId/user_id in script hook runtime sandbox (bindEvent)
- Support senderId/sender_id and userId/user_id in test event parser and sample payload
- Fix script compiler bytecode caching bug during dry-run tests by bypassing cache for uuid.Nil
- Capture ScriptResult (reason, stdout, updatedInput) in DispatcherTestRunner.RunTest

**File**: `internal/gateway/methods/hooks.go` (modified, +34/-3)
```diff
@@ -454,15 +454,46 @@ func parseTestEventParams(raw json.RawMessage, cfg *hooks.HookConfig) (hooks.Eve
 		return ev, nil
 	}
 	var sample struct {
-		ToolName  string         `json:"toolName"`
-		ToolInput map[string]any `json:"toolInput"`
-		RawInput  string         `json:"rawInput"`
+		ToolName      string         `json:"toolName"`
+		ToolInput     map[string]any `json:"toolInput"`
+		RawInput      string         `json:"rawInput"`
+		SenderID      string         `json:"senderId"`
+		SenderIDSnake string         `json:"sender_id"`
+		UserID        string         `json:"userId"`
+		UserIDSnake   string         `json:"user_id"`
 	}
 	if err := json.Unmarshal(raw, &sample); err != nil {
 		return ev, fmt.Errorf("invalid sampleEvent: %w", err)
 	}
 	ev.ToolName = sample.ToolName
 	ev.ToolInput = sample.ToolInput
 	ev.RawInput = sample.RawInput
+
+	senderID := sample.SenderID
+	if senderID == "" {
+		senderID = sample.SenderIDSnake
+	}
+	userID := sample.UserID
+	if userID == "" {
+		userID = sample.UserIDSnake
+	}
+	if sample.ToolInput != nil {
+		if senderID == "" {
+			if s, ok := sample.ToolInput["sender_id"].(string); ok && s != "" {
+				senderID = s
+			} else if s, ok := sample.ToolInput["senderId"].(string); ok && s != "" {
+				senderID = s
+			}
+		}
+		if userID == "" {
+			if u, ok := sample.ToolInput["user_id"].(string); ok && u != "" {
+				userID = u
+			} else if u, ok := sample.ToolInput["userId"].(string); ok && u != "" {
+				userID = u
+			}
+		}
+	}
+	ev.SenderID = senderID
+	ev.UserID = userID
 	return ev, nil
 }
```

**File**: `internal/gateway/methods/hooks_test_runner.go` (modified, +9/-3)
```diff
@@ -43,16 +43,22 @@ func (r *DispatcherTestRunner) RunTest(ctx context.Context, cfg hooks.HookConfig
 	if cfg.TimeoutMS > 0 {
 		timeout = time.Duration(cfg.TimeoutMS) * time.Millisecond
 	}
-	hctx, cancel := context.WithTimeout(ctx, timeout)
+
+	scriptRes := &hooks.ScriptResult{}
+	hctx := hooks.WithScriptResult(ctx, scriptRes)
+	hctx, cancel := context.WithTimeout(hctx, timeout)
 	defer cancel()
 
 	start := time.Now()
 	dec, err := h.Execute(hctx, cfg, ev)
 	durationMS := int(time.Since(start) / time.Millisecond)
 
 	res := HookTestResult{
-		Decision:   dec,
-		DurationMS: durationMS,
+		Decision:     dec,
+		Reason:       scriptRes.Reason,
+		DurationMS:   durationMS,
+		Stdout:       scriptRes.Stdout,
+		UpdatedInput: scriptRes.UpdatedInput,
 	}
 	if err != nil {
 		res.Error = err.Error()
```

**File**: `internal/gateway/methods/hooks_test_runner_test.go` (added, +123/-0)
```diff
@@ -0,0 +1,123 @@
+package methods
+
+import (
+	"context"
+	"encoding/json"
+	"testing"
+	"time"
+
+	"github.com/google/uuid"
+
+	"github.com/nextlevelbuilder/goclaw/internal/hooks"
+	hookhandlers "github.com/nextlevelbuilder/goclaw/internal/hooks/handlers"
+)
+
+func TestParseTestEventParams_SenderAndUser(t *testing.T) {
+	cfg := &hooks.HookConfig{
+		TenantID: uuid.New(),
+		Event:    hooks.EventPreToolUse,
+	}
+
+	t.Run("outer camelCase", func(t *testing.T) {
+		raw := json.RawMessage(`{"toolName":"bash","senderId":"alice","userId":"usr-1"}`)
+		ev, err := parseTestEventParams(raw, cfg)
+		if err != nil {
+			t.Fatalf("unexpected err: %v", err)
+		}
+		if ev.SenderID != "alice" {
+			t.Errorf("expected senderId alice, got %q", ev.SenderID)
+		}
+		if ev.UserID != "usr-1" {
+			t.Errorf("expected userId usr-1, got %q", ev.UserID)
+		}
+	})
+
+	t.Run("outer snake_case", func(t *testing.T) {
+		raw := json.RawMessage(`{"toolName":"bash","sender_id":"bob","user_id":"usr-2"}`)
+		ev, err := parseTestEventParams(raw, cfg)
+		if err != nil {
+			t.Fatalf("unexpected err: %v", err)
+		}
+		if ev.SenderID != "bob" {
+			t.Errorf("expected sender_id bob, got %q", ev.SenderID)
+		}
+		if ev.UserID != "usr-2" {
+			t.Errorf("expected user_id usr-2, got %q", ev.UserID)
+		}
+	})
+
+	t.Run("from toolInput", func(t *testing.T) {
+		raw := json.RawMessage(`{"toolName":"bash","toolInput":{"command":"ls","sender_id":"charlie","user_id":"usr-3"}}`)
+		ev, err := parseTestEventParams(raw, cfg)
+		if err != nil {
+			t.Fatalf("unexpected err: %v", err)
+		}
+		if ev.SenderID != "charlie" {
+			t.Errorf("expected sender_id charlie from toolInput, got %q", ev.SenderID)
+		}
+		if ev.UserID != "usr-3" {
+			t.Errorf("expected user_id usr-3 from toolInput, got %q", ev.UserID)
+		}
+	})
+
+	t.Run("outer takes precedence over toolInput", func(t *testing.T) {
+		raw := json.RawMessage(`{"toolName":"bash","sender_id":"outer-sender","toolInput":{"sender_id":"inner-sender"}}`)
+		ev, err := parseTestEventParams(raw, cfg)
+		if err != nil {
+			t.Fatalf("unexpected err: %v", err)
+		}
+		if ev.SenderID != "outer-sender" {
+			t.Errorf("expected outer sender_id, got %q", ev.SenderID)
+		}
+	})
+}
+
+func TestDispatcherTestRunner_RunTest_ScriptResultCaptured(t *testing.T) {
+	scriptHandler := hookhandlers.NewScriptHandler(2, 1, 16)
+	runner := NewDispatcherTestRunner(map[hooks.HandlerType]hooks.Handler{
+		hooks.HandlerScript: scriptHandler,
+	})
+
+	cfg := hooks.HookConfig{
+		ID:          uuid.Nil,
+		Version:     0,
+		HandlerType: hooks.HandlerScript,
+		Event:       hooks.EventPreToolUse,
+		TimeoutMS:   1000,
+		Config: map[string]any{
+			"source": `function handle(event) {
+				console.log("hello from test script");
+				return {
+					decision: "allow",
+					reason: "custom policy passed for " + event.senderId,
+					updatedInput: { modified: true }
+				};
+			}`,
+		},
+	}
+
+	ev := hooks.Event{
+		EventID:   "test-ev-1",
+		HookEvent: hooks.EventPreToolUse,
+		SenderID:  "dev-user",
+		UserID:    "u-123",
+	}
+
+	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
+	defer cancel()
+
+	res := runner.RunTest(ctx, cfg, ev)
+
+	if res.Decision != hooks.DecisionAllow {
+		t.Fatalf("expected DecisionAllow, got %v (err: %s)", res.Decision, res.Error)
+	}
+	if res.Reason != "custom policy passed for dev-user" {
+		t.Errorf("expected reason with dev-user, got %q", res.Reason)
+	}
+	if res.Stdout == "" {
+		t.Errorf("expected non-empty stdout, got %q", res.Stdout)
+	}
+	if res.UpdatedInput == nil || res.UpdatedInput["modified"] != true {
+		t.Errorf("expected updatedInput.modified = true, got %+v", res.UpdatedInput)
+	}
+}
```

**File**: `internal/hooks/handlers/script_runtime.go` (modified, +14/-4)
```diff
@@ -7,6 +7,7 @@ import (
 	"strings"
 
 	"github.com/dop251/goja"
+	"github.com/google/uuid"
 
 	"github.com/nextlevelbuilder/goclaw/internal/hooks"
 )
@@ -15,15 +16,20 @@ import (
 // version change. strict=true gives stronger semantics (assigning to an
 // undeclared variable throws instead of silently creating a global).
 func (h *ScriptHandler) compile(cfg hooks.HookConfig, source string) (*goja.Program, error) {
-	key := progCacheKey{ID: cfg.ID, Version: cfg.Version}
-	if prog, ok := h.progCache.Get(key); ok {
-		return prog, nil
+	if cfg.ID != uuid.Nil {
+		key := progCacheKey{ID: cfg.ID, Version: cfg.Version}
+		if prog, ok := h.progCache.Get(key); ok {
+			return prog, nil
+		}
 	}
 	prog, err := goja.Compile(cfg.ID.String(), source, true)
 	if err != nil {
 		return nil, fmt.Errorf("compile: %w", err)
 	}
-	h.progCache.Add(key, prog)
+	if cfg.ID != uuid.Nil {
+		key := progCacheKey{ID: cfg.ID, Version: cfg.Version}
+		h.progCache.Add(key, prog)
+	}
 	return prog, nil
 }
 
@@ -42,6 +48,10 @@ func bindEvent(rt *goja.Runtime, ev hooks.Event) error {
 		"sessionId": ev.SessionID,
 		"tenantId":  ev.TenantID.String(),
 		"agentId":   ev.AgentID.String(),
+		"senderId":  ev.SenderID,
+		"sender_id": ev.SenderID,
+		"userId":    ev.UserID,
+		"user_id":   ev.UserID,
 		"toolName":  ev.ToolName,
 		"toolInput": ev.ToolInput,
 		"rawInput":  ev.RawInput,
```

**File**: `internal/hooks/handlers/script_test.go` (modified, +60/-0)
```diff
@@ -263,3 +263,63 @@ func TestInvalidateHookDoesNotPanic(t *testing.T) {
 		t.Fatalf("post-invalidate err: %v", err)
 	}
 }
+
+func TestEventSenderIDAndUserID(t *testing.T) {
+	src := `function handle(event) {
+	  if (event.senderId !== "sender-123" || event.sender_id !== "sender-123") {
+	    return {decision: "block", reason: "bad sender"};
+	  }
+	  if (event.userId !== "user-456" || event.user_id !== "user-456") {
+	    return {decision: "block", reason: "bad user"};
+	  }
+	  return {decision: "allow", reason: "ok: " + event.senderId + ":" + event.userId};
+	}`
+	h := newTestHandler()
+	ev := mkEvent()
+	ev.SenderID = "sender-123"
+	ev.UserID = "user-456"
+	dec, err, res := runWithResult(t, h, mkCfg(src), ev, 500*time.Millisecond)
+	if err != nil {
+		t.Fatalf("unexpected err: %v", err)
+	}
+	if dec != hooks.DecisionAllow {
+		t.Fatalf("decision: got %v, reason: %s", dec, res.Reason)
+	}
+	if res.Reason != "ok: sender-123:user-456" {
+		t.Fatalf("reason mismatch: got %q", res.Reason)
+	}
+}
+
+func TestCompileCacheSkipsNilUUID(t *testing.T) {
+	h := newTestHandler()
+	// Dry-run test sets ID to uuid.Nil and Version to 0
+	cfg1 := hooks.HookConfig{
+		ID:          uuid.Nil,
+		Version:     0,
+		HandlerType: hooks.HandlerScript,
+		Config: map[string]any{
+			"source": `function handle(event) { return {decision: "allow", reason: "run-1"}; }`,
+		},
+	}
+	dec1, err1, res1 := runWithResult(t, h, cfg1, mkEvent(), 500*time.Millisecond)
+	if err1 != nil || dec1 != hooks.DecisionAllow || res1.Reason != "run-1" {
+		t.Fatalf("run 1 failed: dec=%v err=%v res=%+v", dec1, err1, res1)
+	}
+
+	// Change script source under the same uuid.Nil and Version 0
+	cfg2 := hooks.HookConfig{
+		ID:          uuid.Nil,
+		Version:     0,
+		HandlerType: hooks.HandlerScript,
+		Config: map[string]any{
+			"source": `function handle(event) { return {decision: "allow", reason: "run-2"}; }`,
+		},
+	}
+	dec2, err2, res2 := runWithResult(t, h, cfg2, mkEvent(), 500*time.Millisecond)
+	if err2 != nil || dec2 != hooks.DecisionAllow {
+		t.Fatalf("run 2 failed: dec=%v err=%v", dec2, err2)
+	}
+	if res2.Reason != "run-2" {
+		t.Fatalf("expected fresh compile with reason 'run-2', but got stale cached %q", res2.Reason)
+	}
+}
```

**File**: `internal/hooks/types.go` (modified, +2/-0)
```diff
@@ -221,6 +221,8 @@ type Event struct {
 	SessionID string
 	TenantID  uuid.UUID
 	AgentID   uuid.UUID
+	SenderID  string `json:"sender_id"`
+	UserID    string `json:"user_id"`
 	// ToolName is populated for PreToolUse/PostToolUse events.
 	ToolName string
 	// ToolInput is the raw tool arguments map for CEL evaluation.
```

**File**: `internal/pipeline/context_stage.go` (modified, +4/-0)
```diff
@@ -43,6 +43,8 @@ func (s *ContextStage) Execute(ctx context.Context, state *RunState) error {
 			SessionID: state.Input.SessionKey,
 			TenantID:  store.TenantIDFromContext(ctx),
 			AgentID:   store.AgentIDFromContext(ctx),
+			SenderID:  state.Input.SenderID,
+			UserID:    state.Input.UserID,
 			RawInput:  state.Input.Message,
 			HookEvent: hooks.EventSessionStart,
 		})
@@ -56,6 +58,8 @@ func (s *ContextStage) Execute(ctx context.Context, state *RunState) error {
 		SessionID: state.Input.SessionKey,
 		TenantID:  store.TenantIDFromContext(ctx),
 		AgentID:   store.AgentIDFromContext(ctx),
+		SenderID:  state.Input.SenderID,
+		UserID:    state.Input.UserID,
 		RawInput:  state.Input.Message,
 		HookEvent: hooks.EventUserPromptSubmit,
 	}); r.Decision == hooks.DecisionBlock {
```

**File**: `internal/pipeline/finalize_stage.go` (modified, +2/-0)
```diff
@@ -194,6 +194,8 @@ func (s *FinalizeStage) Execute(ctx context.Context, state *RunState) error {
 			SessionID: state.Input.SessionKey,
 			TenantID:  store.TenantIDFromContext(ctx),
 			AgentID:   store.AgentIDFromContext(ctx),
+			SenderID:  state.Input.SenderID,
+			UserID:    state.Input.UserID,
 			HookEvent: hooks.EventStop,
 		})
 	}
```

---

### Incident Patch 4: `0ab3c33d` (2026-10-02)
**Commit Message**: Merge pull request #1588 from filipenf/fix/anthropic-adaptive-thinking

fix(providers): use adaptive thinking for Claude Opus 4.7+ and Claude 5

**File**: `internal/providers/adapter_anthropic.go` (modified, +8/-5)
```diff
@@ -58,8 +58,9 @@ func (a *AnthropicAdapter) ToRequest(req ChatRequest) ([]byte, http.Header, erro
 	h.Set("x-api-key", a.provider.apiKey)
 	h.Set("anthropic-version", anthropicAPIVersion)
 
-	// Add beta header for interleaved thinking
-	if _, hasThinking := body["thinking"]; hasThinking {
+	// Legacy manual thinking still needs the interleaved-thinking beta header.
+	// Adaptive thinking (Claude 4.7+ / Claude 5) does not.
+	if anthropicManualThinking(body) {
 		h.Set("anthropic-beta", "interleaved-thinking-2025-05-14")
 	}
 
@@ -72,7 +73,9 @@ func (a *AnthropicAdapter) FromResponse(data []byte) (*ChatResponse, error) {
 	if err := json.Unmarshal(data, &resp); err != nil {
 		return nil, fmt.Errorf("anthropic adapter: decode: %w", err)
 	}
-	return a.provider.parseResponse(&resp), nil
+	result := a.provider.parseResponse(&resp)
+	preserveAnthropicToolContent(result, data)
+	return result, nil
 }
 
 // FromStreamChunk parses a single Anthropic SSE event payload.
@@ -98,8 +101,8 @@ func (a *AnthropicAdapter) FromStreamChunk(data []byte) (*StreamChunk, error) {
 			return &StreamChunk{Content: ev.Delta.Text}, nil
 		case "thinking_delta":
 			return &StreamChunk{Thinking: ev.Delta.Thinking}, nil
-		// input_json_delta and signature_delta are stateful (accumulate across chunks).
-		// Pipeline must track these externally; adapter only handles atomic deltas.
+			// input_json_delta and signature_delta are stateful (accumulate across chunks).
+			// Pipeline must track these externally; adapter only handles atomic deltas.
 		}
 
 	case "message_stop":
```

**File**: `internal/providers/adapter_anthropic_test.go` (modified, +147/-0)
```diff
@@ -159,6 +159,7 @@ func TestAnthropicAdapterToRequest_SkipsTemperatureForClaude46AndNewer(t *testin
 		"claude-opus-4-7-20260501",
 		"claude-opus-5",
 		"claude-sonnet-5",
+		"claude-sonnet-5-5",
 	} {
 		t.Run(model, func(t *testing.T) {
 			req := ChatRequest{
@@ -198,6 +199,114 @@ func TestAnthropicAdapterToRequest_SkipsTemperatureForClaude46AndNewer(t *testin
 	}
 }
 
+func TestAnthropicAdapterToRequest_AdaptiveThinkingForSonnet55(t *testing.T) {
+	adapter, _ := NewAnthropicAdapter(ProviderConfig{APIKey: "sk-test"})
+
+	req := ChatRequest{
+		Model:    "claude-sonnet-5-5",
+		Messages: []Message{{Role: "user", Content: "Think about this"}},
+		Options: map[string]any{
+			OptThinkingLevel: "high",
+			OptTemperature:   0.7,
+		},
+	}
+	data, headers, err := adapter.ToRequest(req)
+	if err != nil {
+		t.Fatal(err)
+	}
+	if headers.Get("anthropic-beta") != "" {
+		t.Errorf("adaptive thinking should not send anthropic-beta, got %q", headers.Get("anthropic-beta"))
+	}
+
+	var body map[string]any
+	if err := json.Unmarshal(data, &body); err != nil {
+		t.Fatal(err)
+	}
+	thinking, ok := body["thinking"].(map[string]any)
+	if !ok {
+		t.Fatal("expected thinking config in body")
+	}
+	if thinking["type"] != "adaptive" {
+		t.Errorf("thinking type = %v, want adaptive", thinking["type"])
+	}
+	if thinking["display"] != "summarized" {
+		t.Errorf("thinking display = %v, want summarized", thinking["display"])
+	}
+	if _, hasBudget := thinking["budget_tokens"]; hasBudget {
+		t.Error("adaptive thinking should not set budget_tokens")
+	}
+	output, ok := body["output_config"].(map[string]any)
+	if !ok || output["effort"] != "high" {
+		t.Errorf("output_config = %v, want effort=high", body["output_config"])
+	}
+	if _, hasTemp := body["temperature"]; hasTemp {
+		t.Error("temperature should be omitted for claude-sonnet-5-5")
+	}
+}
+
+func TestAnthropicAdapterToRequest_AdaptiveThinkingOmitsDisplayWhenStripped(t *testing.T) {
+	adapter, _ := NewAnthropicAdapter(ProviderConfig{APIKey: "sk-test"})
+
+	req := ChatRequest{
+		Model:    "claude-sonnet-5-5",
+		Messages: []Message{{Role: "user", Content: "Think about this"}},
+		Options: map[string]any{
+			OptThinkingLevel: "high",
+			OptStripThinking: true,
+		},
+	}
+	data, _, err := adapter.ToRequest(req)
+	if err != nil {
+		t.Fatal(err)
+	}
+	var body map[string]any
+	if err := json.Unmarshal(data, &body); err != nil {
+		t.Fatal(err)
+	}
+	thinking, ok := body["thinking"].(map[string]any)
+	if !ok {
+		t.Fatal("expected thinking config in body")
+	}
+	if thinking["display"] != "omitted" {
+		t.Errorf("thinking display = %v, want omitted", thinking["display"])
+	}
+}
+
+func TestAnthropicAdapterToRequest_DatedSonnet4KeepsManualThinking(t *testing.T) {
+	adapter, _ := NewAnthropicAdapter(ProviderConfig{APIKey: "sk-test"})
+
+	req := ChatRequest{
+		Model:    "claude-sonnet-4-20250514",
+		Messages: []Message{{Role: "user", Content: "Think about this"}},
+		Options:  map[string]any{OptThinkingLevel: "high"},
+	}
+	data, headers, err := adapter.ToRequest(req)
+	if err != nil {
+		t.Fatal(err)
+	}
+	if headers.Get("anthropic-beta") == "" {
+		t.Error("manual thinking should send the interleaved-thinking beta header")
+	}
+	var body map[string]any
+	if err := json.Unmarshal(data, &body); err != nil {
+		t.Fatal(err)
+	}
+	thinking, ok := body["thinking"].(map[string]any)
+	if !ok {
+		t.Fatal("expected thinking config in body")
+	}
+	if thinking["type"] != "enabled" {
+		t.Errorf("thinking type = %v, want enabled", thinking["type"])
+	}
+	if _, hasDisplay := thinking["display"]; hasDisplay {
+		t.Errorf("manual thinking should not set display, got %v", thinking["display"])
+	}
+	budget, _ := thinking["budget_tokens"].(float64)
+	if int(budget) != 32000 {
+		t.Errorf("thinking budget = %v, want 32000", budget)
+	}
+}
+
 func TestAnthropicAdapterFromResponse_ToolCalls(t *testing.T) {
 	adapter, _ := NewAnthropicAdapter(ProviderConfig{APIKey: "sk-test"})
 
@@ -232,6 +341,44 @@ func TestAnthropicAdapterFromResponse_ToolCalls(t *testing.T) {
 	}
 }
 
+func TestAnthropicAdapterFromResponse_EmptyThinkingFieldPreserved(t *testing.T) {
+	adapter, _ := NewAnthropicAdapter(ProviderConfig{APIKey: "sk-test"})
+
+	respJSON := `{
+		"content": [
+			{"type": "thinking", "thinking": "", "signature": "sig-empty"},
+			{"type": "tool_use", "id": "toolu_01", "name": "heartbeat_ok", "input": {}}
+		],
+		"stop_reason": "tool_use",
+		"usage": {"input_tokens": 10, "output_tokens": 5}
+	}`
+
+	resp, err := adapter.FromResponse([]byte(respJSON))
+	if err != nil {
+		t.Fatal(err)
+	}
+	if resp.RawAssistantContent == nil {
+		t.Fatal("expected RawAssistantContent for tool passback")
+	}
+	var blocks []map[string]any
+	if err := json.Unmarshal(resp.RawAssistantContent, &blocks); err != nil {
+		t.Fatal(err)
+	}
+	if len(blocks) != 2 {
+		t.Fatalf("blocks = %d, want 2", len(blocks))
+	}
+	thinking, ok := blocks[0]["thinking"]
+	if !ok {
+		t.Fatal("thinking field was dropped; Anthropic requires it
```

**File**: `internal/providers/anthropic.go` (modified, +32/-15)
```diff
@@ -50,7 +50,7 @@ type AnthropicProvider struct {
 	client       *http.Client
 	retryConfig  RetryConfig
 	middlewares  RequestMiddleware // composed middleware chain (nil = no-op)
-	registry     ModelRegistry    // model resolution registry (nil = skip)
+	registry     ModelRegistry     // model resolution registry (nil = skip)
 }
 
 // NewAnthropicProvider creates a new Anthropic provider.
@@ -145,12 +145,18 @@ func (p *AnthropicProvider) Chat(ctx context.Context, req ChatRequest) (*ChatRes
 		}
 		defer respBody.Close()
 
+		raw, err := io.ReadAll(respBody)
+		if err != nil {
+			return nil, fmt.Errorf("anthropic: read response: %w", err)
+		}
 		var parsed anthropicResponse
-		if err := json.NewDecoder(respBody).Decode(&parsed); err != nil {
+		if err := json.Unmarshal(raw, &parsed); err != nil {
 			return nil, fmt.Errorf("anthropic: decode response: %w", err)
 		}
 
-		return p.parseResponse(&parsed), nil
+		result := p.parseResponse(&parsed)
+		preserveAnthropicToolContent(result, raw)
+		return result, nil
 	})
 	// Drop user-visible reasoning after parsing for models flagged as leakers.
 	// Usage.ThinkingTokens and RawAssistantContent remain intact so billing
@@ -178,11 +184,10 @@ func (p *AnthropicProvider) doRequest(ctx context.Context, body any) (io.ReadClo
 	httpReq.Header.Set("x-api-key", p.apiKey)
 	httpReq.Header.Set("anthropic-version", anthropicAPIVersion)
 
-	// Add beta header for interleaved thinking when thinking is enabled
-	if bodyMap, ok := body.(map[string]any); ok {
-		if _, hasThinking := bodyMap["thinking"]; hasThinking {
-			httpReq.Header.Set("anthropic-beta", "interleaved-thinking-2025-05-14")
-		}
+	// Legacy manual thinking still needs the interleaved-thinking beta header.
+	// Adaptive thinking (Claude 4.7+ / Claude 5) does not.
+	if bodyMap, ok := body.(map[string]any); ok && anthropicManualThinking(bodyMap) {
+		httpReq.Header.Set("anthropic-beta", "interleaved-thinking-2025-05-14")
 	}
 
 	resp, err := p.client.Do(httpReq)
@@ -252,16 +257,28 @@ func (p *AnthropicProvider) parseResponse(resp *anthropicResponse) *ChatResponse
 		result.Usage.ThinkingTokens = thinkingChars / 4
 	}
 
-	// Preserve raw content blocks for tool use passback
-	if len(result.ToolCalls) > 0 {
-		if b, err := json.Marshal(resp.Content); err == nil {
-			result.RawAssistantContent = b
-		}
-	}
-
 	return result
 }
 
+// preserveAnthropicToolContent keeps the provider's content array for tool-loop
+// passback. Re-encoding anthropicContentBlock drops an empty thinking string
+// (json omitempty). Adaptive thinking returns that empty string, and the next
+// request fails with "thinking.thinking: Field required" when the field is absent.
+func preserveAnthropicToolContent(result *ChatResponse, raw []byte) {
+	if result == nil || len(result.ToolCalls) == 0 || len(raw) == 0 {
+		return
+	}
+	var envelope struct {
+		Content []json.RawMessage `json:"content"`
+	}
+	if err := json.Unmarshal(raw, &envelope); err != nil || len(envelope.Content) == 0 {
+		return
+	}
+	if b, err := json.Marshal(envelope.Content); err == nil {
+		result.RawAssistantContent = b
+	}
+}
+
 // --- Anthropic API types (internal) ---
 
 type anthropicResponse struct {
```

**File**: `internal/providers/anthropic_request.go` (modified, +96/-15)
```diff
@@ -36,15 +36,15 @@ func SplitSystemPromptForCache(content string) []map[string]any {
 
 // buildRawBlock reconstructs a complete content block from streaming data.
 // This is needed to preserve thinking blocks (with signatures) for tool use passback.
-func (p *AnthropicProvider) buildRawBlock(blockType string, result *ChatResponse, toolCallJSON map[int]string, _ int) json.RawMessage {
+func (p *AnthropicProvider) buildRawBlock(blockType string, result *ChatResponse, toolCallJSON map[int]string, thinkingText, thinkingSignature, redactedData string) json.RawMessage {
 	switch blockType {
 	case "thinking":
 		block := map[string]any{
 			"type":     "thinking",
-			"thinking": result.Thinking,
+			"thinking": thinkingText,
 		}
-		if result.ThinkingSignature != "" {
-			block["signature"] = result.ThinkingSignature
+		if thinkingSignature != "" {
+			block["signature"] = thinkingSignature
 		}
 		if b, err := json.Marshal(block); err == nil {
 			return b
@@ -78,10 +78,15 @@ func (p *AnthropicProvider) buildRawBlock(blockType string, result *ChatResponse
 			}
 		}
 	case "redacted_thinking":
-		// Pass through as-is (we don't have the encrypted data in streaming)
+		// The encrypted payload arrives on content_block_start and must be
+		// replayed unchanged. A block with only "type" is rejected on the
+		// next tool-result request.
 		block := map[string]any{
 			"type": "redacted_thinking",
 		}
+		if redactedData != "" {
+			block["data"] = redactedData
+		}
 		if b, err := json.Marshal(block); err == nil {
 			return b
 		}
@@ -224,18 +229,38 @@ func (p *AnthropicProvider) buildRequestBody(model string, req ChatRequest, stre
 		}
 	}
 
-	// Enable extended thinking if thinking_level is set
+	// Enable extended thinking if thinking_level is set.
+	// Claude Opus 4.7+ and Claude 5 reject thinking.type=enabled. Those models
+	// take thinking.type=adaptive plus output_config.effort.
 	if level, ok := req.Options[OptThinkingLevel].(string); ok && level != "" && level != "off" {
-		budget := anthropicThinkingBudget(level)
-		body["thinking"] = map[string]any{
-			"type":          "enabled",
-			"budget_tokens": budget,
-		}
-		// Anthropic requires no temperature when thinking is enabled
 		delete(body, "temperature")
-		// Ensure max_tokens accommodates thinking budget + response
-		if maxTok, ok := body["max_tokens"].(int); !ok || maxTok < budget+4096 {
-			body["max_tokens"] = budget + 8192
+		if anthropicUsesAdaptiveThinking(model) {
+			// display defaults to "omitted" on these models, which hides thinking
+			// text. "summarized" keeps the reasoning visible. OptStripThinking
+			// asks for the omitted form; the signature is still returned for
+			// tool-loop passback.
+			display := "summarized"
+			if strip, _ := req.Options[OptStripThinking].(bool); strip {
+				display = "omitted"
+			}
+			body["thinking"] = map[string]any{
+				"type":    "adaptive",
+				"display": display,
+			}
+			body["output_config"] = map[string]any{"effort": anthropicEffort(level)}
+			if maxTok, ok := body["max_tokens"].(int); !ok || maxTok < 16000 {
+				body["max_tokens"] = 16000
+			}
+		} else {
+			budget := anthropicThinkingBudget(level)
+			body["thinking"] = map[string]any{
+				"type":          "enabled",
+				"budget_tokens": budget,
+			}
+			// Ensure max_tokens accommodates thinking budget + response
+			if maxTok, ok := body["max_tokens"].(int); !ok || maxTok < budget+4096 {
+				body["max_tokens"] = budget + 8192
+			}
 		}
 	}
 
@@ -274,6 +299,62 @@ func anthropicSkipsTemperature(model string) bool {
 	return false
 }
 
+// anthropicUsesAdaptiveThinking reports models that reject thinking.type=enabled
+// and require thinking.type=adaptive. Opus 4.7+ and the Claude 5 family
+// (Sonnet 5, Opus 5, Fable, Mythos) return HTTP 400 for a manual budget.
+func anthropicUsesAdaptiveThinking(model string) bool {
+	m := strings.ToLower(model)
+	if strings.Contains(m, "claude-fable") || strings.Contains(m, "claude-mythos") {
+		return true
+	}
+	for _, family := range []string{"claude-opus-", "claude-sonnet-"} {
+		after, ok := strings.CutPrefix(m, family)
+		if !ok {
+			continue
+		}
+		majorPart, afterMajor, hasMinor := strings.Cut(after, "-")
+		major, err := strconv.Atoi(majorPart)
+		if err != nil {
+			continue
+		}
+		if major > 4 {
+			return true
+		}
+		if major != 4 || !hasMinor {
+			continue
+		}
+		minorPart, _, _ := strings.Cut(afterMajor, "-")
+		minor, err := strconv.Atoi(minorPart)
+		// Dated snapshots such as claude-sonnet-4-20250514 put an 8-digit
+		// date in this position. Those are pre-4.5 models and still use
+		// manual thinking.
+		if err == nil && minor >= 7 && minor < 100 {
+			return true
+		}
+	}
+	return false
+}
+
+// anthropicManualThinking reports whether the body uses legacy
+// thinking.type=enabled, which still needs the interleaved-thinking beta header.
+func anthropicManualThinking(body map[string]any) bool {
+	thinking, ok := body["thinking"].(map[string]any)
+	if !ok {
```

**File**: `internal/providers/anthropic_stream.go` (modified, +12/-1)
```diff
@@ -40,6 +40,12 @@ func (p *AnthropicProvider) ChatStream(ctx context.Context, req ChatRequest, onC
 	// Track thinking token count by accumulated chunk size
 	thinkingChars := 0
 	var thinkingSignature strings.Builder
+	// Per-block text and signature. content_block_stop runs before
+	// result.ThinkingSignature is assigned, and each thinking block needs its
+	// own signature for tool-loop passback.
+	var blockThinking strings.Builder
+	var blockSignature strings.Builder
+	var redactedData string
 
 	sse := NewSSEScanner(cb)
 	for sse.Next() {
@@ -65,6 +71,9 @@ func (p *AnthropicProvider) ChatStream(ctx context.Context, req ChatRequest, onC
 		case "content_block_start":
 			var ev anthropicContentBlockStartEvent
 			if err := json.Unmarshal([]byte(data), &ev); err == nil {
+				blockThinking.Reset()
+				blockSignature.Reset()
+				redactedData = ev.ContentBlock.Data
 				currentBlockType = ev.ContentBlock.Type
 				if ev.ContentBlock.Type == "tool_use" {
 					result.ToolCalls = append(result.ToolCalls, ToolCall{
@@ -90,6 +99,7 @@ func (p *AnthropicProvider) ChatStream(ctx context.Context, req ChatRequest, onC
 					// Always count raw thinking bytes for billing estimation
 					// below, even when stripping user-visible output.
 					thinkingChars += len(ev.Delta.Thinking)
+					blockThinking.WriteString(ev.Delta.Thinking)
 					if !stripThinking {
 						result.Thinking += ev.Delta.Thinking
 						if onChunk != nil {
@@ -102,6 +112,7 @@ func (p *AnthropicProvider) ChatStream(ctx context.Context, req ChatRequest, onC
 						toolCallJSON[idx] += ev.Delta.PartialJSON
 					}
 				case "signature_delta":
+					blockSignature.WriteString(ev.Delta.Signature)
 					thinkingSignature.WriteString(ev.Delta.Signature)
 				}
 			}
@@ -110,7 +121,7 @@ func (p *AnthropicProvider) ChatStream(ctx context.Context, req ChatRequest, onC
 			// Reconstruct the complete content block for RawAssistantContent
 			if len(rawContentBlocks) > 0 {
 				idx := len(rawContentBlocks) - 1
-				block := p.buildRawBlock(currentBlockType, result, toolCallJSON, idx)
+				block := p.buildRawBlock(currentBlockType, result, toolCallJSON, blockThinking.String(), blockSignature.String(), redactedData)
 				if block != nil {
 					rawContentBlocks[idx] = block
 				}
```

**File**: `internal/providers/anthropic_stream_test.go` (modified, +126/-0)
```diff
@@ -2,6 +2,7 @@ package providers
 
 import (
 	"context"
+	"encoding/json"
 	"errors"
 	"fmt"
 	"net/http"
@@ -175,3 +176,128 @@ func TestStreamChat_ThinkingSignature(t *testing.T) {
 		t.Errorf("Content = %q, want %q", result.Content, "answer")
 	}
 }
+
+// TestStreamChat_ThinkingSignaturePassback verifies that a streamed thinking
+// block keeps its signature in RawAssistantContent. Tool-loop follow-ups send
+// that block back, and Anthropic rejects it when the signature is missing.
+func TestStreamChat_ThinkingSignaturePassback(t *testing.T) {
+	events := []string{
+		"event: message_start\n",
+		`data: {"message":{"usage":{"input_tokens":10}}}` + "\n\n",
+
+		"event: content_block_start\n",
+		`data: {"index":0,"content_block":{"type":"thinking","thinking":""}}` + "\n\n",
+
+		"event: content_block_delta\n",
+		`data: {"index":0,"delta":{"type":"thinking_delta","thinking":"plan the call"}}` + "\n\n",
+
+		"event: content_block_delta\n",
+		`data: {"index":0,"delta":{"type":"signature_delta","signature":"sig-abc"}}` + "\n\n",
+
+		"event: content_block_stop\n",
+		"data: {}\n\n",
+
+		"event: content_block_start\n",
+		`data: {"index":1,"content_block":{"type":"tool_use","id":"toolu_01","name":"web_search"}}` + "\n\n",
+
+		"event: content_block_delta\n",
+		`data: {"index":1,"delta":{"type":"input_json_delta","partial_json":"{\"q\":\"x\"}"}}` + "\n\n",
+
+		"event: content_block_stop\n",
+		"data: {}\n\n",
+
+		"event: message_delta\n",
+		`data: {"delta":{"stop_reason":"tool_use"},"usage":{"output_tokens":20}}` + "\n\n",
+
+		"event: message_stop\n",
+		"data: {}\n\n",
+	}
+	server := newAnthropicSSEServer(t, events)
+	p := newTestAnthropicProvider(server.URL)
+
+	result, err := p.ChatStream(context.Background(), ChatRequest{
+		Model:    "claude-sonnet-5-5",
+		Messages: []Message{{Role: "user", Content: "hello"}},
+	}, nil)
+	if err != nil {
+		t.Fatalf("unexpected error: %v", err)
+	}
+	if len(result.ToolCalls) != 1 {
+		t.Fatalf("ToolCalls = %d, want 1", len(result.ToolCalls))
+	}
+	if result.RawAssistantContent == nil {
+		t.Fatal("expected RawAssistantContent for tool passback")
+	}
+
+	var blocks []map[string]any
+	if err := json.Unmarshal(result.RawAssistantContent, &blocks); err != nil {
+		t.Fatalf("decode RawAssistantContent: %v", err)
+	}
+	if len(blocks) != 2 {
+		t.Fatalf("blocks = %d, want 2", len(blocks))
+	}
+	if blocks[0]["type"] != "thinking" {
+		t.Fatalf("block 0 type = %v, want thinking", blocks[0]["type"])
+	}
+	if blocks[0]["thinking"] != "plan the call" {
+		t.Errorf("thinking = %v, want plan the call", blocks[0]["thinking"])
+	}
+	if blocks[0]["signature"] != "sig-abc" {
+		t.Errorf("signature = %v, want sig-abc", blocks[0]["signature"])
+	}
+}
+
+func TestStreamChat_RedactedThinkingPassback(t *testing.T) {
+	events := []string{
+		"event: message_start\n",
+		`data: {"message":{"usage":{"input_tokens":10}}}` + "\n\n",
+
+		"event: content_block_start\n",
+		`data: {"index":0,"content_block":{"type":"redacted_thinking","data":"encrypted-blob"}}` + "\n\n",
+
+		"event: content_block_stop\n",
+		"data: {}\n\n",
+
+		"event: content_block_start\n",
+		`data: {"index":1,"content_block":{"type":"tool_use","id":"toolu_01","name":"web_search"}}` + "\n\n",
+
+		"event: content_block_delta\n",
+		`data: {"index":1,"delta":{"type":"input_json_delta","partial_json":"{\"q\":\"x\"}"}}` + "\n\n",
+
+		"event: content_block_stop\n",
+		"data: {}\n\n",
+
+		"event: message_delta\n",
+		`data: {"delta":{"stop_reason":"tool_use"},"usage":{"output_tokens":8}}` + "\n\n",
+
+		"event: message_stop\n",
+		"data: {}\n\n",
+	}
+	server := newAnthropicSSEServer(t, events)
+	p := newTestAnthropicProvider(server.URL)
+
+	result, err := p.ChatStream(context.Background(), ChatRequest{
+		Model:    "claude-sonnet-5-5",
+		Messages: []Message{{Role: "user", Content: "hello"}},
+	}, nil)
+	if err != nil {
+		t.Fatalf("unexpected error: %v", err)
+	}
+	if result.RawAssistantContent == nil {
+		t.Fatal("expected RawAssistantContent for tool passback")
+	}
+
+	var blocks []map[string]any
+	if err := json.Unmarshal(result.RawAssistantContent, &blocks); err != nil {
+		t.Fatalf("decode RawAssistantContent: %v", err)
+	}
+	if len(blocks) != 2 {
+		t.Fatalf("blocks = %d, want 2", len(blocks))
+	}
+	if blocks[0]["type"] != "redacted_thinking" {
+		t.Fatalf("block 0 type = %v, want redacted_thinking", blocks[0]["type"])
+	}
+	if blocks[0]["data"] != "encrypted-blob" {
+		t.Errorf("data = %v, want encrypted-blob", blocks[0]["data"])
+	}
+}
```

---

### Incident Patch 5: `52ced371` (2026-09-30)
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

**File**: `Makefile` (modified, +2/-1)
```diff
@@ -1,5 +1,6 @@
 VERSION ?= $(shell git describe --tags --abbrev=0 --match "v[0-9]*" 2>/dev/null || echo dev)
-LDFLAGS  = -s -w -X github.com/nextlevelbuilder/goclaw/cmd.Version=$(VERSION)
+COMMIT_SHA ?= $(shell git rev-parse HEAD 2>/dev/null || echo unknown)
+LDFLAGS  = -s -w -X github.com/nextlevelbuilder/goclaw/cmd.Version=$(VERSION) -X github.com/nextlevelbuilder/goclaw/cmd.CommitSHA=$(COMMIT_SHA)
 BINARY   = goclaw
 
 .PHONY: build build-full build-tui run clean version up up-build down logs reset test vet check-web dev migrate setup ci desktop-dev desktop-build desktop-dmg test-hooks test-hooks-unit test-hooks-e2e test-hooks-chaos test-hooks-rbac test-hooks-tracing
```

**File**: `cmd/doctor.go` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@ func doctorCmd() *cobra.Command {
 
 func runDoctor() {
 	fmt.Println("goclaw doctor")
-	fmt.Printf("  Version:  %s (protocol %d)\n", Version, protocol.ProtocolVersion)
+	fmt.Printf("  Version:  %s%s (protocol %d)\n", Version, commitSuffix(), protocol.ProtocolVersion)
 	fmt.Printf("  OS:       %s/%s\n", runtime.GOOS, runtime.GOARCH)
 	fmt.Printf("  Go:       %s\n", runtime.Version())
 	fmt.Println()
```

**File**: `cmd/root.go` (modified, +16/-1)
```diff
@@ -12,6 +12,21 @@ import (
 // Version is set at build time via -ldflags "-X github.com/nextlevelbuilder/goclaw/cmd.Version=v1.0.0"
 var Version = "dev"
 
+// CommitSHA is set at build time via -ldflags "-X github.com/nextlevelbuilder/goclaw/cmd.CommitSHA=<sha>".
+// It records the exact source commit the binary was built from, so a running
+// image/binary can be lined up with a commit even when VCS metadata is
+// unavailable (e.g. Docker builds, where .git is excluded from the context).
+var CommitSHA = "unknown"
+
+// commitSuffix returns " (commit <sha>)" when CommitSHA was injected at build
+// time, so version/doctor/upgrade output can carry release provenance.
+func commitSuffix() string {
+	if CommitSHA == "" || CommitSHA == "unknown" {
+		return ""
+	}
+	return " (commit " + CommitSHA + ")"
+}
+
 var (
 	cfgFile string
 	verbose bool
@@ -64,7 +79,7 @@ func versionCmd() *cobra.Command {
 		Use:   "version",
 		Short: "Print version information",
 		Run: func(cmd *cobra.Command, args []string) {
-			fmt.Printf("goclaw %s (protocol %d)\n", Version, protocol.ProtocolVersion)
+			fmt.Printf("goclaw %s%s (protocol %d)\n", Version, commitSuffix(), protocol.ProtocolVersion)
 		},
 	}
 }
```

---

### Incident Patch 6: `8d8ca3d2` (2026-09-29)
**Commit Message**: fix(providers): keep empty thinking text on non-streaming tool passback

Heartbeat calls are not streamed. Re-encoding the response dropped an empty thinking string, so the next tool-result request failed with thinking.thinking: Field required.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `internal/providers/adapter_anthropic.go` (modified, +3/-1)
```diff
@@ -73,7 +73,9 @@ func (a *AnthropicAdapter) FromResponse(data []byte) (*ChatResponse, error) {
 	if err := json.Unmarshal(data, &resp); err != nil {
 		return nil, fmt.Errorf("anthropic adapter: decode: %w", err)
 	}
-	return a.provider.parseResponse(&resp), nil
+	result := a.provider.parseResponse(&resp)
+	preserveAnthropicToolContent(result, data)
+	return result, nil
 }
 
 // FromStreamChunk parses a single Anthropic SSE event payload.
```

**File**: `internal/providers/adapter_anthropic_test.go` (modified, +38/-0)
```diff
@@ -341,6 +341,44 @@ func TestAnthropicAdapterFromResponse_ToolCalls(t *testing.T) {
 	}
 }
 
+func TestAnthropicAdapterFromResponse_EmptyThinkingFieldPreserved(t *testing.T) {
+	adapter, _ := NewAnthropicAdapter(ProviderConfig{APIKey: "sk-test"})
+
+	respJSON := `{
+		"content": [
+			{"type": "thinking", "thinking": "", "signature": "sig-empty"},
+			{"type": "tool_use", "id": "toolu_01", "name": "heartbeat_ok", "input": {}}
+		],
+		"stop_reason": "tool_use",
+		"usage": {"input_tokens": 10, "output_tokens": 5}
+	}`
+
+	resp, err := adapter.FromResponse([]byte(respJSON))
+	if err != nil {
+		t.Fatal(err)
+	}
+	if resp.RawAssistantContent == nil {
+		t.Fatal("expected RawAssistantContent for tool passback")
+	}
+	var blocks []map[string]any
+	if err := json.Unmarshal(resp.RawAssistantContent, &blocks); err != nil {
+		t.Fatal(err)
+	}
+	if len(blocks) != 2 {
+		t.Fatalf("blocks = %d, want 2", len(blocks))
+	}
+	thinking, ok := blocks[0]["thinking"]
+	if !ok {
+		t.Fatal("thinking field was dropped; Anthropic requires it even when empty")
+	}
+	if thinking != "" {
+		t.Errorf("thinking = %v, want empty string", thinking)
+	}
+	if blocks[0]["signature"] != "sig-empty" {
+		t.Errorf("signature = %v, want sig-empty", blocks[0]["signature"])
+	}
+}
+
 func TestAnthropicAdapterFromResponse_ThinkingBlocks(t *testing.T) {
 	adapter, _ := NewAnthropicAdapter(ProviderConfig{APIKey: "sk-test"})
 
```

**File**: `internal/providers/anthropic.go` (modified, +27/-9)
```diff
@@ -145,12 +145,18 @@ func (p *AnthropicProvider) Chat(ctx context.Context, req ChatRequest) (*ChatRes
 		}
 		defer respBody.Close()
 
+		raw, err := io.ReadAll(respBody)
+		if err != nil {
+			return nil, fmt.Errorf("anthropic: read response: %w", err)
+		}
 		var parsed anthropicResponse
-		if err := json.NewDecoder(respBody).Decode(&parsed); err != nil {
+		if err := json.Unmarshal(raw, &parsed); err != nil {
 			return nil, fmt.Errorf("anthropic: decode response: %w", err)
 		}
 
-		return p.parseResponse(&parsed), nil
+		result := p.parseResponse(&parsed)
+		preserveAnthropicToolContent(result, raw)
+		return result, nil
 	})
 	// Drop user-visible reasoning after parsing for models flagged as leakers.
 	// Usage.ThinkingTokens and RawAssistantContent remain intact so billing
@@ -251,16 +257,28 @@ func (p *AnthropicProvider) parseResponse(resp *anthropicResponse) *ChatResponse
 		result.Usage.ThinkingTokens = thinkingChars / 4
 	}
 
-	// Preserve raw content blocks for tool use passback
-	if len(result.ToolCalls) > 0 {
-		if b, err := json.Marshal(resp.Content); err == nil {
-			result.RawAssistantContent = b
-		}
-	}
-
 	return result
 }
 
+// preserveAnthropicToolContent keeps the provider's content array for tool-loop
+// passback. Re-encoding anthropicContentBlock drops an empty thinking string
+// (json omitempty). Adaptive thinking returns that empty string, and the next
+// request fails with "thinking.thinking: Field required" when the field is absent.
+func preserveAnthropicToolContent(result *ChatResponse, raw []byte) {
+	if result == nil || len(result.ToolCalls) == 0 || len(raw) == 0 {
+		return
+	}
+	var envelope struct {
+		Content []json.RawMessage `json:"content"`
+	}
+	if err := json.Unmarshal(raw, &envelope); err != nil || len(envelope.Content) == 0 {
+		return
+	}
+	if b, err := json.Marshal(envelope.Content); err == nil {
+		result.RawAssistantContent = b
+	}
+}
+
 // --- Anthropic API types (internal) ---
 
 type anthropicResponse struct {
```

---

### Incident Patch 7: `64ae5972` (2026-09-29)
**Commit Message**: fix(providers): keep dated Claude 4 snapshots on manual thinking

claude-sonnet-4-20250514 was treated as Opus 4.7+ because the date was parsed as the minor version.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `internal/providers/adapter_anthropic_test.go` (modified, +35/-0)
```diff
@@ -272,6 +272,41 @@ func TestAnthropicAdapterToRequest_AdaptiveThinkingOmitsDisplayWhenStripped(t *t
 	}
 }
 
+func TestAnthropicAdapterToRequest_DatedSonnet4KeepsManualThinking(t *testing.T) {
+	adapter, _ := NewAnthropicAdapter(ProviderConfig{APIKey: "sk-test"})
+
+	req := ChatRequest{
+		Model:    "claude-sonnet-4-20250514",
+		Messages: []Message{{Role: "user", Content: "Think about this"}},
+		Options:  map[string]any{OptThinkingLevel: "high"},
+	}
+	data, headers, err := adapter.ToRequest(req)
+	if err != nil {
+		t.Fatal(err)
+	}
+	if headers.Get("anthropic-beta") == "" {
+		t.Error("manual thinking should send the interleaved-thinking beta header")
+	}
+	var body map[string]any
+	if err := json.Unmarshal(data, &body); err != nil {
+		t.Fatal(err)
+	}
+	thinking, ok := body["thinking"].(map[string]any)
+	if !ok {
+		t.Fatal("expected thinking config in body")
+	}
+	if thinking["type"] != "enabled" {
+		t.Errorf("thinking type = %v, want enabled", thinking["type"])
+	}
+	if _, hasDisplay := thinking["display"]; hasDisplay {
+		t.Errorf("manual thinking should not set display, got %v", thinking["display"])
+	}
+	budget, _ := thinking["budget_tokens"].(float64)
+	if int(budget) != 32000 {
+		t.Errorf("thinking budget = %v, want 32000", budget)
+	}
+}
+
 func TestAnthropicAdapterFromResponse_ToolCalls(t *testing.T) {
 	adapter, _ := NewAnthropicAdapter(ProviderConfig{APIKey: "sk-test"})
 
```

**File**: `internal/providers/anthropic_request.go` (modified, +4/-1)
```diff
@@ -325,7 +325,10 @@ func anthropicUsesAdaptiveThinking(model string) bool {
 		}
 		minorPart, _, _ := strings.Cut(afterMajor, "-")
 		minor, err := strconv.Atoi(minorPart)
-		if err == nil && minor >= 7 {
+		// Dated snapshots such as claude-sonnet-4-20250514 put an 8-digit
+		// date in this position. Those are pre-4.5 models and still use
+		// manual thinking.
+		if err == nil && minor >= 7 && minor < 100 {
 			return true
 		}
 	}
```

---

### Incident Patch 8: `cf482a39` (2026-09-29)
**Commit Message**: fix(providers): replay redacted thinking data on streamed tool calls

Claude 5 rejects a redacted_thinking block that is missing its encrypted data on the next tool-result request.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `internal/providers/anthropic_request.go` (modified, +7/-2)
```diff
@@ -36,7 +36,7 @@ func SplitSystemPromptForCache(content string) []map[string]any {
 
 // buildRawBlock reconstructs a complete content block from streaming data.
 // This is needed to preserve thinking blocks (with signatures) for tool use passback.
-func (p *AnthropicProvider) buildRawBlock(blockType string, result *ChatResponse, toolCallJSON map[int]string, thinkingText, thinkingSignature string) json.RawMessage {
+func (p *AnthropicProvider) buildRawBlock(blockType string, result *ChatResponse, toolCallJSON map[int]string, thinkingText, thinkingSignature, redactedData string) json.RawMessage {
 	switch blockType {
 	case "thinking":
 		block := map[string]any{
@@ -78,10 +78,15 @@ func (p *AnthropicProvider) buildRawBlock(blockType string, result *ChatResponse
 			}
 		}
 	case "redacted_thinking":
-		// Pass through as-is (we don't have the encrypted data in streaming)
+		// The encrypted payload arrives on content_block_start and must be
+		// replayed unchanged. A block with only "type" is rejected on the
+		// next tool-result request.
 		block := map[string]any{
 			"type": "redacted_thinking",
 		}
+		if redactedData != "" {
+			block["data"] = redactedData
+		}
 		if b, err := json.Marshal(block); err == nil {
 			return b
 		}
```

**File**: `internal/providers/anthropic_stream.go` (modified, +3/-1)
```diff
@@ -45,6 +45,7 @@ func (p *AnthropicProvider) ChatStream(ctx context.Context, req ChatRequest, onC
 	// own signature for tool-loop passback.
 	var blockThinking strings.Builder
 	var blockSignature strings.Builder
+	var redactedData string
 
 	sse := NewSSEScanner(cb)
 	for sse.Next() {
@@ -72,6 +73,7 @@ func (p *AnthropicProvider) ChatStream(ctx context.Context, req ChatRequest, onC
 			if err := json.Unmarshal([]byte(data), &ev); err == nil {
 				blockThinking.Reset()
 				blockSignature.Reset()
+				redactedData = ev.ContentBlock.Data
 				currentBlockType = ev.ContentBlock.Type
 				if ev.ContentBlock.Type == "tool_use" {
 					result.ToolCalls = append(result.ToolCalls, ToolCall{
@@ -119,7 +121,7 @@ func (p *AnthropicProvider) ChatStream(ctx context.Context, req ChatRequest, onC
 			// Reconstruct the complete content block for RawAssistantContent
 			if len(rawContentBlocks) > 0 {
 				idx := len(rawContentBlocks) - 1
-				block := p.buildRawBlock(currentBlockType, result, toolCallJSON, blockThinking.String(), blockSignature.String())
+				block := p.buildRawBlock(currentBlockType, result, toolCallJSON, blockThinking.String(), blockSignature.String(), redactedData)
 				if block != nil {
 					rawContentBlocks[idx] = block
 				}
```

**File**: `internal/providers/anthropic_stream_test.go` (modified, +55/-0)
```diff
@@ -246,3 +246,58 @@ func TestStreamChat_ThinkingSignaturePassback(t *testing.T) {
 		t.Errorf("signature = %v, want sig-abc", blocks[0]["signature"])
 	}
 }
+
+func TestStreamChat_RedactedThinkingPassback(t *testing.T) {
+	events := []string{
+		"event: message_start\n",
+		`data: {"message":{"usage":{"input_tokens":10}}}` + "\n\n",
+
+		"event: content_block_start\n",
+		`data: {"index":0,"content_block":{"type":"redacted_thinking","data":"encrypted-blob"}}` + "\n\n",
+
+		"event: content_block_stop\n",
+		"data: {}\n\n",
+
+		"event: content_block_start\n",
+		`data: {"index":1,"content_block":{"type":"tool_use","id":"toolu_01","name":"web_search"}}` + "\n\n",
+
+		"event: content_block_delta\n",
+		`data: {"index":1,"delta":{"type":"input_json_delta","partial_json":"{\"q\":\"x\"}"}}` + "\n\n",
+
+		"event: content_block_stop\n",
+		"data: {}\n\n",
+
+		"event: message_delta\n",
+		`data: {"delta":{"stop_reason":"tool_use"},"usage":{"output_tokens":8}}` + "\n\n",
+
+		"event: message_stop\n",
+		"data: {}\n\n",
+	}
+	server := newAnthropicSSEServer(t, events)
+	p := newTestAnthropicProvider(server.URL)
+
+	result, err := p.ChatStream(context.Background(), ChatRequest{
+		Model:    "claude-sonnet-5-5",
+		Messages: []Message{{Role: "user", Content: "hello"}},
+	}, nil)
+	if err != nil {
+		t.Fatalf("unexpected error: %v", err)
+	}
+	if result.RawAssistantContent == nil {
+		t.Fatal("expected RawAssistantContent for tool passback")
+	}
+
+	var blocks []map[string]any
+	if err := json.Unmarshal(result.RawAssistantContent, &blocks); err != nil {
+		t.Fatalf("decode RawAssistantContent: %v", err)
+	}
+	if len(blocks) != 2 {
+		t.Fatalf("blocks = %d, want 2", len(blocks))
+	}
+	if blocks[0]["type"] != "redacted_thinking" {
+		t.Fatalf("block 0 type = %v, want redacted_thinking", blocks[0]["type"])
+	}
+	if blocks[0]["data"] != "encrypted-blob" {
+		t.Errorf("data = %v, want encrypted-blob", blocks[0]["data"])
+	}
+}
```

---

### Incident Patch 9: `ac3aeee6` (2026-09-29)
**Commit Message**: fix(providers): keep adaptive thinking visible and replayable

Summarized display preserves thinking text, and streamed tool calls pass each thinking block back with its signature.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `internal/providers/adapter_anthropic_test.go` (modified, +31/-0)
```diff
@@ -229,6 +229,9 @@ func TestAnthropicAdapterToRequest_AdaptiveThinkingForSonnet55(t *testing.T) {
 	if thinking["type"] != "adaptive" {
 		t.Errorf("thinking type = %v, want adaptive", thinking["type"])
 	}
+	if thinking["display"] != "summarized" {
+		t.Errorf("thinking display = %v, want summarized", thinking["display"])
+	}
 	if _, hasBudget := thinking["budget_tokens"]; hasBudget {
 		t.Error("adaptive thinking should not set budget_tokens")
 	}
@@ -241,6 +244,34 @@ func TestAnthropicAdapterToRequest_AdaptiveThinkingForSonnet55(t *testing.T) {
 	}
 }
 
+func TestAnthropicAdapterToRequest_AdaptiveThinkingOmitsDisplayWhenStripped(t *testing.T) {
+	adapter, _ := NewAnthropicAdapter(ProviderConfig{APIKey: "sk-test"})
+
+	req := ChatRequest{
+		Model:    "claude-sonnet-5-5",
+		Messages: []Message{{Role: "user", Content: "Think about this"}},
+		Options: map[string]any{
+			OptThinkingLevel: "high",
+			OptStripThinking: true,
+		},
+	}
+	data, _, err := adapter.ToRequest(req)
+	if err != nil {
+		t.Fatal(err)
+	}
+	var body map[string]any
+	if err := json.Unmarshal(data, &body); err != nil {
+		t.Fatal(err)
+	}
+	thinking, ok := body["thinking"].(map[string]any)
+	if !ok {
+		t.Fatal("expected thinking config in body")
+	}
+	if thinking["display"] != "omitted" {
+		t.Errorf("thinking display = %v, want omitted", thinking["display"])
+	}
+}
+
 func TestAnthropicAdapterFromResponse_ToolCalls(t *testing.T) {
 	adapter, _ := NewAnthropicAdapter(ProviderConfig{APIKey: "sk-test"})
 
```

**File**: `internal/providers/anthropic_request.go` (modified, +16/-5)
```diff
@@ -36,15 +36,15 @@ func SplitSystemPromptForCache(content string) []map[string]any {
 
 // buildRawBlock reconstructs a complete content block from streaming data.
 // This is needed to preserve thinking blocks (with signatures) for tool use passback.
-func (p *AnthropicProvider) buildRawBlock(blockType string, result *ChatResponse, toolCallJSON map[int]string, _ int) json.RawMessage {
+func (p *AnthropicProvider) buildRawBlock(blockType string, result *ChatResponse, toolCallJSON map[int]string, thinkingText, thinkingSignature string) json.RawMessage {
 	switch blockType {
 	case "thinking":
 		block := map[string]any{
 			"type":     "thinking",
-			"thinking": result.Thinking,
+			"thinking": thinkingText,
 		}
-		if result.ThinkingSignature != "" {
-			block["signature"] = result.ThinkingSignature
+		if thinkingSignature != "" {
+			block["signature"] = thinkingSignature
 		}
 		if b, err := json.Marshal(block); err == nil {
 			return b
@@ -230,7 +230,18 @@ func (p *AnthropicProvider) buildRequestBody(model string, req ChatRequest, stre
 	if level, ok := req.Options[OptThinkingLevel].(string); ok && level != "" && level != "off" {
 		delete(body, "temperature")
 		if anthropicUsesAdaptiveThinking(model) {
-			body["thinking"] = map[string]any{"type": "adaptive"}
+			// display defaults to "omitted" on these models, which hides thinking
+			// text. "summarized" keeps the reasoning visible. OptStripThinking
+			// asks for the omitted form; the signature is still returned for
+			// tool-loop passback.
+			display := "summarized"
+			if strip, _ := req.Options[OptStripThinking].(bool); strip {
+				display = "omitted"
+			}
+			body["thinking"] = map[string]any{
+				"type":    "adaptive",
+				"display": display,
+			}
 			body["output_config"] = map[string]any{"effort": anthropicEffort(level)}
 			if maxTok, ok := body["max_tokens"].(int); !ok || maxTok < 16000 {
 				body["max_tokens"] = 16000
```

**File**: `internal/providers/anthropic_stream.go` (modified, +10/-1)
```diff
@@ -40,6 +40,11 @@ func (p *AnthropicProvider) ChatStream(ctx context.Context, req ChatRequest, onC
 	// Track thinking token count by accumulated chunk size
 	thinkingChars := 0
 	var thinkingSignature strings.Builder
+	// Per-block text and signature. content_block_stop runs before
+	// result.ThinkingSignature is assigned, and each thinking block needs its
+	// own signature for tool-loop passback.
+	var blockThinking strings.Builder
+	var blockSignature strings.Builder
 
 	sse := NewSSEScanner(cb)
 	for sse.Next() {
@@ -65,6 +70,8 @@ func (p *AnthropicProvider) ChatStream(ctx context.Context, req ChatRequest, onC
 		case "content_block_start":
 			var ev anthropicContentBlockStartEvent
 			if err := json.Unmarshal([]byte(data), &ev); err == nil {
+				blockThinking.Reset()
+				blockSignature.Reset()
 				currentBlockType = ev.ContentBlock.Type
 				if ev.ContentBlock.Type == "tool_use" {
 					result.ToolCalls = append(result.ToolCalls, ToolCall{
@@ -90,6 +97,7 @@ func (p *AnthropicProvider) ChatStream(ctx context.Context, req ChatRequest, onC
 					// Always count raw thinking bytes for billing estimation
 					// below, even when stripping user-visible output.
 					thinkingChars += len(ev.Delta.Thinking)
+					blockThinking.WriteString(ev.Delta.Thinking)
 					if !stripThinking {
 						result.Thinking += ev.Delta.Thinking
 						if onChunk != nil {
@@ -102,6 +110,7 @@ func (p *AnthropicProvider) ChatStream(ctx context.Context, req ChatRequest, onC
 						toolCallJSON[idx] += ev.Delta.PartialJSON
 					}
 				case "signature_delta":
+					blockSignature.WriteString(ev.Delta.Signature)
 					thinkingSignature.WriteString(ev.Delta.Signature)
 				}
 			}
@@ -110,7 +119,7 @@ func (p *AnthropicProvider) ChatStream(ctx context.Context, req ChatRequest, onC
 			// Reconstruct the complete content block for RawAssistantContent
 			if len(rawContentBlocks) > 0 {
 				idx := len(rawContentBlocks) - 1
-				block := p.buildRawBlock(currentBlockType, result, toolCallJSON, idx)
+				block := p.buildRawBlock(currentBlockType, result, toolCallJSON, blockThinking.String(), blockSignature.String())
 				if block != nil {
 					rawContentBlocks[idx] = block
 				}
```

**File**: `internal/providers/anthropic_stream_test.go` (modified, +71/-0)
```diff
@@ -2,6 +2,7 @@ package providers
 
 import (
 	"context"
+	"encoding/json"
 	"errors"
 	"fmt"
 	"net/http"
@@ -175,3 +176,73 @@ func TestStreamChat_ThinkingSignature(t *testing.T) {
 		t.Errorf("Content = %q, want %q", result.Content, "answer")
 	}
 }
+
+// TestStreamChat_ThinkingSignaturePassback verifies that a streamed thinking
+// block keeps its signature in RawAssistantContent. Tool-loop follow-ups send
+// that block back, and Anthropic rejects it when the signature is missing.
+func TestStreamChat_ThinkingSignaturePassback(t *testing.T) {
+	events := []string{
+		"event: message_start\n",
+		`data: {"message":{"usage":{"input_tokens":10}}}` + "\n\n",
+
+		"event: content_block_start\n",
+		`data: {"index":0,"content_block":{"type":"thinking","thinking":""}}` + "\n\n",
+
+		"event: content_block_delta\n",
+		`data: {"index":0,"delta":{"type":"thinking_delta","thinking":"plan the call"}}` + "\n\n",
+
+		"event: content_block_delta\n",
+		`data: {"index":0,"delta":{"type":"signature_delta","signature":"sig-abc"}}` + "\n\n",
+
+		"event: content_block_stop\n",
+		"data: {}\n\n",
+
+		"event: content_block_start\n",
+		`data: {"index":1,"content_block":{"type":"tool_use","id":"toolu_01","name":"web_search"}}` + "\n\n",
+
+		"event: content_block_delta\n",
+		`data: {"index":1,"delta":{"type":"input_json_delta","partial_json":"{\"q\":\"x\"}"}}` + "\n\n",
+
+		"event: content_block_stop\n",
+		"data: {}\n\n",
+
+		"event: message_delta\n",
+		`data: {"delta":{"stop_reason":"tool_use"},"usage":{"output_tokens":20}}` + "\n\n",
+
+		"event: message_stop\n",
+		"data: {}\n\n",
+	}
+	server := newAnthropicSSEServer(t, events)
+	p := newTestAnthropicProvider(server.URL)
+
+	result, err := p.ChatStream(context.Background(), ChatRequest{
+		Model:    "claude-sonnet-5-5",
+		Messages: []Message{{Role: "user", Content: "hello"}},
+	}, nil)
+	if err != nil {
+		t.Fatalf("unexpected error: %v", err)
+	}
+	if len(result.ToolCalls) != 1 {
+		t.Fatalf("ToolCalls = %d, want 1", len(result.ToolCalls))
+	}
+	if result.RawAssistantContent == nil {
+		t.Fatal("expected RawAssistantContent for tool passback")
+	}
+
+	var blocks []map[string]any
+	if err := json.Unmarshal(result.RawAssistantContent, &blocks); err != nil {
+		t.Fatalf("decode RawAssistantContent: %v", err)
+	}
+	if len(blocks) != 2 {
+		t.Fatalf("blocks = %d, want 2", len(blocks))
+	}
+	if blocks[0]["type"] != "thinking" {
+		t.Fatalf("block 0 type = %v, want thinking", blocks[0]["type"])
+	}
+	if blocks[0]["thinking"] != "plan the call" {
+		t.Errorf("thinking = %v, want plan the call", blocks[0]["thinking"])
+	}
+	if blocks[0]["signature"] != "sig-abc" {
+		t.Errorf("signature = %v, want sig-abc", blocks[0]["signature"])
+	}
+}
```

---

### Incident Patch 10: `bfe59ad3` (2026-09-29)
**Commit Message**: fix(providers): use adaptive thinking for Claude Opus 4.7+ and Claude 5

Those models reject thinking.type=enabled. Send thinking.type=adaptive and output_config.effort instead.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `internal/providers/adapter_anthropic.go` (modified, +5/-4)
```diff
@@ -58,8 +58,9 @@ func (a *AnthropicAdapter) ToRequest(req ChatRequest) ([]byte, http.Header, erro
 	h.Set("x-api-key", a.provider.apiKey)
 	h.Set("anthropic-version", anthropicAPIVersion)
 
-	// Add beta header for interleaved thinking
-	if _, hasThinking := body["thinking"]; hasThinking {
+	// Legacy manual thinking still needs the interleaved-thinking beta header.
+	// Adaptive thinking (Claude 4.7+ / Claude 5) does not.
+	if anthropicManualThinking(body) {
 		h.Set("anthropic-beta", "interleaved-thinking-2025-05-14")
 	}
 
@@ -98,8 +99,8 @@ func (a *AnthropicAdapter) FromStreamChunk(data []byte) (*StreamChunk, error) {
 			return &StreamChunk{Content: ev.Delta.Text}, nil
 		case "thinking_delta":
 			return &StreamChunk{Thinking: ev.Delta.Thinking}, nil
-		// input_json_delta and signature_delta are stateful (accumulate across chunks).
-		// Pipeline must track these externally; adapter only handles atomic deltas.
+			// input_json_delta and signature_delta are stateful (accumulate across chunks).
+			// Pipeline must track these externally; adapter only handles atomic deltas.
 		}
 
 	case "message_stop":
```

**File**: `internal/providers/adapter_anthropic_test.go` (modified, +43/-0)
```diff
@@ -159,6 +159,7 @@ func TestAnthropicAdapterToRequest_SkipsTemperatureForClaude46AndNewer(t *testin
 		"claude-opus-4-7-20260501",
 		"claude-opus-5",
 		"claude-sonnet-5",
+		"claude-sonnet-5-5",
 	} {
 		t.Run(model, func(t *testing.T) {
 			req := ChatRequest{
@@ -198,6 +199,48 @@ func TestAnthropicAdapterToRequest_SkipsTemperatureForClaude46AndNewer(t *testin
 	}
 }
 
+func TestAnthropicAdapterToRequest_AdaptiveThinkingForSonnet55(t *testing.T) {
+	adapter, _ := NewAnthropicAdapter(ProviderConfig{APIKey: "sk-test"})
+
+	req := ChatRequest{
+		Model:    "claude-sonnet-5-5",
+		Messages: []Message{{Role: "user", Content: "Think about this"}},
+		Options: map[string]any{
+			OptThinkingLevel: "high",
+			OptTemperature:   0.7,
+		},
+	}
+	data, headers, err := adapter.ToRequest(req)
+	if err != nil {
+		t.Fatal(err)
+	}
+	if headers.Get("anthropic-beta") != "" {
+		t.Errorf("adaptive thinking should not send anthropic-beta, got %q", headers.Get("anthropic-beta"))
+	}
+
+	var body map[string]any
+	if err := json.Unmarshal(data, &body); err != nil {
+		t.Fatal(err)
+	}
+	thinking, ok := body["thinking"].(map[string]any)
+	if !ok {
+		t.Fatal("expected thinking config in body")
+	}
+	if thinking["type"] != "adaptive" {
+		t.Errorf("thinking type = %v, want adaptive", thinking["type"])
+	}
+	if _, hasBudget := thinking["budget_tokens"]; hasBudget {
+		t.Error("adaptive thinking should not set budget_tokens")
+	}
+	output, ok := body["output_config"].(map[string]any)
+	if !ok || output["effort"] != "high" {
+		t.Errorf("output_config = %v, want effort=high", body["output_config"])
+	}
+	if _, hasTemp := body["temperature"]; hasTemp {
+		t.Error("temperature should be omitted for claude-sonnet-5-5")
+	}
+}
+
 func TestAnthropicAdapterFromResponse_ToolCalls(t *testing.T) {
 	adapter, _ := NewAnthropicAdapter(ProviderConfig{APIKey: "sk-test"})
 
```

**File**: `internal/providers/anthropic.go` (modified, +5/-6)
```diff
@@ -50,7 +50,7 @@ type AnthropicProvider struct {
 	client       *http.Client
 	retryConfig  RetryConfig
 	middlewares  RequestMiddleware // composed middleware chain (nil = no-op)
-	registry     ModelRegistry    // model resolution registry (nil = skip)
+	registry     ModelRegistry     // model resolution registry (nil = skip)
 }
 
 // NewAnthropicProvider creates a new Anthropic provider.
@@ -178,11 +178,10 @@ func (p *AnthropicProvider) doRequest(ctx context.Context, body any) (io.ReadClo
 	httpReq.Header.Set("x-api-key", p.apiKey)
 	httpReq.Header.Set("anthropic-version", anthropicAPIVersion)
 
-	// Add beta header for interleaved thinking when thinking is enabled
-	if bodyMap, ok := body.(map[string]any); ok {
-		if _, hasThinking := bodyMap["thinking"]; hasThinking {
-			httpReq.Header.Set("anthropic-beta", "interleaved-thinking-2025-05-14")
-		}
+	// Legacy manual thinking still needs the interleaved-thinking beta header.
+	// Adaptive thinking (Claude 4.7+ / Claude 5) does not.
+	if bodyMap, ok := body.(map[string]any); ok && anthropicManualThinking(bodyMap) {
+		httpReq.Header.Set("anthropic-beta", "interleaved-thinking-2025-05-14")
 	}
 
 	resp, err := p.client.Do(httpReq)
```

**File**: `internal/providers/anthropic_request.go` (modified, +72/-10)
```diff
@@ -224,18 +224,27 @@ func (p *AnthropicProvider) buildRequestBody(model string, req ChatRequest, stre
 		}
 	}
 
-	// Enable extended thinking if thinking_level is set
+	// Enable extended thinking if thinking_level is set.
+	// Claude Opus 4.7+ and Claude 5 reject thinking.type=enabled. Those models
+	// take thinking.type=adaptive plus output_config.effort.
 	if level, ok := req.Options[OptThinkingLevel].(string); ok && level != "" && level != "off" {
-		budget := anthropicThinkingBudget(level)
-		body["thinking"] = map[string]any{
-			"type":          "enabled",
-			"budget_tokens": budget,
-		}
-		// Anthropic requires no temperature when thinking is enabled
 		delete(body, "temperature")
-		// Ensure max_tokens accommodates thinking budget + response
-		if maxTok, ok := body["max_tokens"].(int); !ok || maxTok < budget+4096 {
-			body["max_tokens"] = budget + 8192
+		if anthropicUsesAdaptiveThinking(model) {
+			body["thinking"] = map[string]any{"type": "adaptive"}
+			body["output_config"] = map[string]any{"effort": anthropicEffort(level)}
+			if maxTok, ok := body["max_tokens"].(int); !ok || maxTok < 16000 {
+				body["max_tokens"] = 16000
+			}
+		} else {
+			budget := anthropicThinkingBudget(level)
+			body["thinking"] = map[string]any{
+				"type":          "enabled",
+				"budget_tokens": budget,
+			}
+			// Ensure max_tokens accommodates thinking budget + response
+			if maxTok, ok := body["max_tokens"].(int); !ok || maxTok < budget+4096 {
+				body["max_tokens"] = budget + 8192
+			}
 		}
 	}
 
@@ -274,6 +283,59 @@ func anthropicSkipsTemperature(model string) bool {
 	return false
 }
 
+// anthropicUsesAdaptiveThinking reports models that reject thinking.type=enabled
+// and require thinking.type=adaptive. Opus 4.7+ and the Claude 5 family
+// (Sonnet 5, Opus 5, Fable, Mythos) return HTTP 400 for a manual budget.
+func anthropicUsesAdaptiveThinking(model string) bool {
+	m := strings.ToLower(model)
+	if strings.Contains(m, "claude-fable") || strings.Contains(m, "claude-mythos") {
+		return true
+	}
+	for _, family := range []string{"claude-opus-", "claude-sonnet-"} {
+		after, ok := strings.CutPrefix(m, family)
+		if !ok {
+			continue
+		}
+		majorPart, afterMajor, hasMinor := strings.Cut(after, "-")
+		major, err := strconv.Atoi(majorPart)
+		if err != nil {
+			continue
+		}
+		if major > 4 {
+			return true
+		}
+		if major != 4 || !hasMinor {
+			continue
+		}
+		minorPart, _, _ := strings.Cut(afterMajor, "-")
+		minor, err := strconv.Atoi(minorPart)
+		if err == nil && minor >= 7 {
+			return true
+		}
+	}
+	return false
+}
+
+// anthropicManualThinking reports whether the body uses legacy
+// thinking.type=enabled, which still needs the interleaved-thinking beta header.
+func anthropicManualThinking(body map[string]any) bool {
+	thinking, ok := body["thinking"].(map[string]any)
+	if !ok {
+		return false
+	}
+	typ, _ := thinking["type"].(string)
+	return typ == "enabled"
+}
+
+func anthropicEffort(level string) string {
+	switch level {
+	case "low", "medium", "high", "xhigh", "max":
+		return level
+	default:
+		return "high"
+	}
+}
+
 // anthropicThinkingBudget maps a thinking level to a token budget.
 func anthropicThinkingBudget(level string) int {
 	switch level {
```

---

### Incident Patch 11: `3f90057c` (2026-09-29)
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

**File**: `internal/agent/loop_context_budget_stop_test.go` (added, +130/-0)
```diff
@@ -0,0 +1,130 @@
+package agent
+
+import (
+	"context"
+	"encoding/json"
+	"sync"
+	"testing"
+	"time"
+
+	"github.com/google/uuid"
+
+	"github.com/nextlevelbuilder/goclaw/internal/pipeline"
+	"github.com/nextlevelbuilder/goclaw/internal/providers"
+	"github.com/nextlevelbuilder/goclaw/internal/store"
+	"github.com/nextlevelbuilder/goclaw/internal/tracing"
+)
+
+// spanCaptureStore records spans and span updates flushed by a tracing.Collector.
+type spanCaptureStore struct {
+	store.TracingStore
+
+	mu      sync.Mutex
+	spans   []store.SpanData
+	updates map[uuid.UUID]map[string]any
+}
+
+func (c *spanCaptureStore) BatchCreateSpans(_ context.Context, spans []store.SpanData) error {
+	c.mu.Lock()
+	defer c.mu.Unlock()
+	c.spans = append(c.spans, spans...)
+	return nil
+}
+
+func (c *spanCaptureStore) UpdateSpan(_ context.Context, spanID uuid.UUID, updates map[string]any) error {
+	c.mu.Lock()
+	defer c.mu.Unlock()
+	if c.updates == nil {
+		c.updates = map[uuid.UUID]map[string]any{}
+	}
+	c.updates[spanID] = updates
+	return nil
+}
+
+func (c *spanCaptureStore) BatchUpdateTraceAggregates(context.Context, uuid.UUID) error { return nil }
+func (c *spanCaptureStore) DeleteTracesOlderThan(context.Context, time.Time) (int64, error) {
+	return 0, nil
+}
+func (c *spanCaptureStore) RecoverStaleRunningTraces(context.Context, time.Time) (int64, error) {
+	return 0, nil
+}
+
+func newCaptureCtx(t *testing.T) (context.Context, *tracing.Collector, *spanCaptureStore) {
+	t.Helper()
+	cs := &spanCaptureStore{}
+	c := tracing.NewCollector(cs)
+	c.Start()
+	ctx := tracing.WithCollector(context.Background(), c)
+	ctx = tracing.WithTraceID(ctx, uuid.New())
+	return ctx, c, cs
+}
+
+func TestConvertRunResult_CopiesStopReason(t *testing.T) {
+	t.Parallel()
+	got := convertRunResult(&pipeline.RunResult{Content: "notice", StopReason: "final request context budget exceeded"})
+	if got.StopReason != "final request context budget exceeded" {
+		t.Fatalf("StopReason = %q, want it copied from the pipeline result", got.StopReason)
+	}
+}
+
+func TestRunTraceStatus(t *testing.T) {
+	t.Parallel()
+	status, errMsg := runTraceStatus(&RunResult{StopReason: "context budget exceeded"})
+	if status != store.TraceStatusError || errMsg != "context budget exceeded" {
+		t.Errorf("stopped run: got (%q, %q), want (%q, reason)", status, errMsg, store.TraceStatusError)
+	}
+	status, errMsg = runTraceStatus(&RunResult{Content: "answer"})
+	if status != store.TraceStatusCompleted || errMsg != "" {
+		t.Errorf("normal run: got (%q, %q), want (%q, \"\")", status, errMsg, store.TraceStatusCompleted)
+	}
+	if status, _ = runTraceStatus(nil); status != store.TraceStatusCompleted {
+		t.Errorf("nil result: got %q, want %q", status, store.TraceStatusCompleted)
+	}
+}
+
+func TestEmitAgentSpanEnd_StoppedRunMarksSpanError(t *testing.T) {
+	t.Parallel()
+	ctx, c, cs := newCaptureCtx(t)
+	spanID := uuid.New()
+
+	(&Loop{}).emitAgentSpanEnd(ctx, spanID, time.Now(), &RunResult{Content: "notice", StopReason: "context budget exceeded"}, nil)
+	c.Stop()
+
+	cs.mu.Lock()
+	defer cs.mu.Unlock()
+	updates := cs.updates[spanID]
+	if updates["status"] != store.SpanStatusError {
+		t.Errorf("status = %v, want %q", updates["status"], store.SpanStatusError)
+	}
+	if updates["error"] != "context budget exceeded" {
+		t.Errorf("error = %v, want the stop reason", updates["error"])
+	}
+	if updates["output_preview"] != "notice" {
+		t.Errorf("output_preview = %v, want the delivered notice", updates["output_preview"])
+	}
+}
+
+func TestMakeCompactMessages_EmitsCompactionSpan(t *testing.T) {
+	t.Parallel()
+	ctx, c, cs := newCaptureCtx(t)
+	history := []providers.Message{{Role: "user", Content: "compare pages"}}
+	for _, id := range []string{"c1", "c2", "c3"} {
+		history = append(history,
+			providers.Message{Role: "assistant", ToolCalls: []providers.ToolCall{{ID: id, Name: "read_file"}}},
+			providers.Message{Role: "tool", ToolCallID: id, Content: "result"},
+		)
+	}
+
+	_, _ = (&Loop{}).makeCompactMessages(nil)(ctx, history, "test-model")
+	c.Stop()
+
+	cs.mu.Lock()
+	defer cs.mu.Unlock()
+	if len(cs.spans) != 1 || cs.spans[0].Name != "mid_loop_compaction" {
+		t.Fatalf("spans = %+v, want one mid_loop_compaction span", cs.spans)
+	}
+	var meta map[string]any
+	if err := json.Unmarshal(cs.spans[0].Metadata, &meta); err != nil || meta["outcome"] != "not_compacted" {
+		t.Errorf("metadata = %s, want outcome=not_compacted", cs.spans[0].Metadata)
+	}
+}
```

**File**: `internal/agent/loop_pipeline_adapter.go` (modified, +1/-0)
```diff
@@ -310,6 +310,7 @@ func convertRunResult(pr *pipeline.RunResult) *RunResult {
 		LastBlockReply: pr.LastBlockReply,
 		LoopKilled:     pr.LoopKilled,
 		Calls:          pr.Calls,
+		StopReason:     pr.StopReason,
 	}
 }
 
```

**File**: `internal/agent/loop_pipeline_callbacks.go` (modified, +12/-1)
```diff
@@ -20,6 +20,7 @@ import (
 	"github.com/nextlevelbuilder/goclaw/internal/providers"
 	"github.com/nextlevelbuilder/goclaw/internal/store"
 	"github.com/nextlevelbuilder/goclaw/internal/tools"
+	"github.com/nextlevelbuilder/goclaw/internal/tracing"
 	usagecaps "github.com/nextlevelbuilder/goclaw/internal/usage/caps"
 	"github.com/nextlevelbuilder/goclaw/internal/workspace"
 	"github.com/nextlevelbuilder/goclaw/pkg/protocol"
@@ -689,9 +690,19 @@ func (l *Loop) makePruneMessages() func(msgs []providers.Message, budget int) ([
 
 func (l *Loop) makeCompactMessages(req *RunRequest) func(ctx context.Context, msgs []providers.Message, model string) ([]providers.Message, error) {
 	return func(ctx context.Context, msgs []providers.Message, model string) ([]providers.Message, error) {
+		start := time.Now().UTC()
 		compacted := l.compactMessagesInPlace(ctx, msgs)
+		outcome := "compacted"
+		if compacted == nil {
+			outcome = "not_compacted"
+		}
+		tracing.EmitEventSpan(ctx, "mid_loop_compaction", start, nil, map[string]any{
+			"outcome":         outcome,
+			"input_messages":  len(msgs),
+			"output_messages": len(compacted),
+		})
 		if compacted == nil {
-			return msgs, nil // compaction failed, return original
+			return nil, pipeline.ErrNotCompacted
 		}
 		// Stamp session metadata with the compaction timestamp so operators
 		// can diagnose compaction cadence without a dedicated column. Stored
```

---

### Incident Patch 12: `4e99816a` (2026-09-29)
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

### Incident Patch 13: `a1913f81` (2026-09-28)
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
+	if resp.Error == nil || resp.Error.Code != protocol.ErrUnauthorized {
+		t.Fatalf("unauthenticated tenants.create: want unauthorized, got error=%v reached=%v", resp.Error, reached[protocol.MethodTenantsCreate])
+	}
+}
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

### Incident Patch 14: `ccae22ea` (2026-09-27)
**Commit Message**: Fix agent deletion failing on an orphaned vault path collision

vault_documents.agent_id and team_id are FKs with ON DELETE SET NULL, and the
scope triggers move a row whose owner is gone to scope='shared'. The
scope-consistency CHECK requires scope='shared' to carry both ids NULL, and
uq_vault_docs_agent_team_scope_path COALESCEs both to one sentinel, so every
orphan in a tenant landed on the key

    (tenant_id, sentinel, sentinel, 'shared', path)

which made path unique per tenant for orphans. Deleting an owner whose document
sat at a path an earlier deleted owner had already orphaned aborted the whole
delete with SQLSTATE 23505, inside the FK's own UPDATE, and the agent could then
not be deleted by any route.

Orphans reach 'shared' from two triggers, not one: the agent trigger from
migration 000046 and the team trigger from 000089, the fix for #1077. Because
the CHECK forces both ids NULL either way, both produce the same key, so two
deleted teams collide exactly as two deleted agents do, and a deleted agent
collides with a deleted team. Namespacing by the former agent alone would have
closed one of the three.

Migration 000099 records the owner a document lost in orphaned_fro

**File**: `internal/gateway/methods/agents_delete.go` (modified, +11/-1)
```diff
@@ -47,7 +47,17 @@ func (m *AgentsMethods) handleDelete(ctx context.Context, client *gateway.Client
 		}
 
 		if err := m.agentStore.Delete(ctx, ag.ID); err != nil {
-			client.SendResponse(protocol.NewErrorResponse(req.ID, protocol.ErrInternal, i18n.T(locale, i18n.MsgFailedToDelete, "agent", fmt.Sprintf("%v", err))))
+			// A UNIQUE violation here is the vault-document orphan collision of #1550:
+			// the FK sets agent_id to NULL, the scope trigger moves the row to 'shared',
+			// and before migration 000099 every orphan in a tenant shared one key, so a
+			// path another deleted owner already orphaned aborts the whole delete. Say
+			// that instead of surfacing the raw SQLSTATE as an internal error.
+			detail := fmt.Sprintf("%v", err)
+			if isDuplicateKeyErr(err) {
+				detail = "a vault document of this agent collides with one already orphaned at the same path; " +
+					"delete or re-path the agent's vault documents first, or upgrade past schema version 99"
+			}
+			client.SendResponse(protocol.NewErrorResponse(req.ID, protocol.ErrInternal, i18n.T(locale, i18n.MsgFailedToDelete, "agent", detail)))
 			return
 		}
 
```

**File**: `internal/upgrade/version.go` (modified, +1/-1)
```diff
@@ -2,4 +2,4 @@ package upgrade
 
 // RequiredSchemaVersion is the schema migration version this binary requires.
 // Bump this whenever adding a new SQL migration file.
-const RequiredSchemaVersion uint = 98
+const RequiredSchemaVersion uint = 99
```

**File**: `migrations/000099_vault_orphan_provenance.down.sql` (added, +51/-0)
```diff
@@ -0,0 +1,51 @@
+-- Revert 000099: restore the trigger bodies and the index from before provenance existed.
+--
+-- Reverting reintroduces the #1550 collision, so any tenant holding two orphans of
+-- different owners at one path has rows the old index cannot accept. Those rows are
+-- re-pathed under a per-row prefix first, keeping the documents rather than deleting
+-- them; the original path stays recoverable from the prefix.
+
+CREATE OR REPLACE FUNCTION vault_docs_agent_null_scope_fix()
+RETURNS TRIGGER AS $$
+BEGIN
+    IF NEW.agent_id IS NULL AND OLD.agent_id IS NOT NULL AND NEW.team_id IS NULL THEN
+        NEW.scope := 'shared';
+    END IF;
+    RETURN NEW;
+END;
+$$ LANGUAGE plpgsql;
+
+CREATE OR REPLACE FUNCTION vault_docs_team_null_scope_fix()
+RETURNS TRIGGER AS $$
+BEGIN
+    IF NEW.team_id IS NULL AND OLD.team_id IS NOT NULL AND OLD.scope = 'team' THEN
+        NEW.scope := CASE WHEN NEW.agent_id IS NOT NULL THEN 'personal' ELSE 'shared' END;
+    END IF;
+    RETURN NEW;
+END;
+$$ LANGUAGE plpgsql;
+
+-- Keep the newest orphan per (tenant_id, path) at its path; move the rest aside so the
+-- old index can be created UNIQUE again.
+WITH ranked AS (
+    SELECT id,
+           row_number() OVER (PARTITION BY tenant_id, path ORDER BY updated_at DESC, id) AS rn
+      FROM vault_documents
+     WHERE agent_id IS NULL AND team_id IS NULL AND scope = 'shared'
+)
+UPDATE vault_documents AS v
+   SET path = '_orphan/' || v.id || '/' || v.path
+  FROM ranked
+ WHERE ranked.id = v.id AND ranked.rn > 1;
+
+DROP INDEX IF EXISTS uq_vault_docs_agent_team_scope_path;
+CREATE UNIQUE INDEX uq_vault_docs_agent_team_scope_path
+    ON vault_documents (
+        tenant_id,
+        COALESCE(agent_id, '00000000-0000-0000-0000-000000000000'),
+        COALESCE(team_id, '00000000-0000-0000-0000-000000000000'),
+        scope,
+        path
+    );
+
+ALTER TABLE vault_documents DROP COLUMN IF EXISTS orphaned_from_id;
```

**File**: `migrations/000099_vault_orphan_provenance.up.sql` (added, +87/-0)
```diff
@@ -0,0 +1,87 @@
+-- Fix issue #1550: deleting an agent fails when another deleted owner already
+-- orphaned a document at the same path.
+--
+-- vault_documents.agent_id is a FK with ON DELETE SET NULL. When it becomes NULL,
+-- trg_vault_docs_agent_null_scope sets scope='shared'. The scope-consistency CHECK
+-- (migration 000055/000056) requires scope='shared' to carry agent_id IS NULL AND
+-- team_id IS NULL, and uq_vault_docs_agent_team_scope_path COALESCEs both nullable
+-- columns to the same sentinel. Every orphan in a tenant therefore lands on the key
+--   (tenant_id, sentinel, sentinel, 'shared', path)
+-- which makes path unique per tenant for orphans, and the second delete that orphans
+-- the same path aborts with SQLSTATE 23505 inside the FK's own UPDATE.
+--
+-- Orphans arrive from two directions, so both are covered here:
+--   trg_vault_docs_agent_null_scope (000046) -- agent deleted, no team  -> 'shared'
+--   vault_docs_team_null_scope_fix  (000089) -- team deleted, no agent  -> 'shared'
+-- Before this migration, two deleted teams collide the same way two deleted agents do,
+-- and a deleted agent collides with a deleted team.
+--
+-- The fix records which owner the document lost and includes that in the unique index,
+-- so two orphans of different owners no longer share a key. path is left untouched:
+-- nothing that already refers to a document path breaks, and re-pathing would be
+-- ambiguous for a document that has been orphaned once already.
+
+-- 1. Provenance. Deliberately one neutral column rather than a typed pair: it holds the
+--    former agent id, the former team id, or -- for rows orphaned before this migration,
+--    whose owner is no longer recorded anywhere -- the document's own id. No FK, because
+--    the row it names is the one being deleted.
+ALTER TABLE vault_documents ADD COLUMN IF NOT EXISTS orphaned_from_id uuid;
+
+COMMENT ON COLUMN vault_documents.orphaned_from_id IS
+    'The owner this document lost: former agent_id, former team_id, or the row id for '
+    'documents orphaned before migration 000099. NULL while the document still has an owner. '
+    'Part of uq_vault_docs_agent_team_scope_path so two orphans cannot share a key.';
+
+-- 2. Backfill before the index is rebuilt, so it can be created UNIQUE in one step with no
+--    cleanup pass. The current index already admits at most one scope='shared' row per
+--    (tenant_id, path), so no two existing orphans collide; the row id is a deterministic,
+--    row-derived discriminator. A shared reserved sentinel is deliberately avoided: it would
+--    reproduce the shape being fixed here and could collide with a real provenance value later.
+UPDATE vault_documents
+   SET orphaned_from_id = id
+ WHERE orphaned_from_id IS NULL
+   AND agent_id IS NULL
+   AND team_id IS NULL
+   AND scope = 'shared';
+
+-- 3. Rebuild the unique index with provenance appended. Appended rather than inserted so the
+--    leading (tenant_id, agent_id, team_id, scope, path) prefix is unchanged and existing
+--    lookups keep the same index support.
+DROP INDEX IF EXISTS uq_vault_docs_agent_team_scope_path;
+CREATE UNIQUE INDEX uq_vault_docs_agent_team_scope_path
+    ON vault_documents (
+        tenant_id,
+        COALESCE(agent_id, '00000000-0000-0000-0000-000000000000'),
+        COALESCE(team_id, '00000000-0000-0000-0000-000000000000'),
+        scope,
+        path,
+        COALESCE(orphaned_from_id, '00000000-0000-0000-0000-000000000000')
+    );
+
+-- 4. Both triggers record the owner they drop. Conditions are otherwise unchanged: the agent
+--    function keeps its 000046 condition, the team function keeps the OLD.scope='team' guard
+--    and the personal/shared split from 000089, and provenance is written only on the branch
+--    that reaches 'shared', since the other branch keeps an owner.
+CREATE OR REPLACE FUNCTION vault_docs_agent_null_scope_fix()
+RETURNS TRIGGER AS $$
+BEGIN
+    IF NEW.agent_id IS NULL AND OLD.agent_id IS NOT NULL AND NEW.team_id IS NULL THEN
+        NEW.scope := 'shared';
+        NEW.orphaned_from_id := OLD.agent_id;
+    END IF;
+    RETURN NEW;
+END;
+$$ LANGUAGE plpgsql;
+
+CREATE OR REPLACE FUNCTION vault_docs_team_null_scope_fix()
+RETURNS TRIGGER AS $$
+BEGIN
+    IF NEW.team_id IS NULL AND OLD.team_id IS NOT NULL AND OLD.scope = 'team' THEN
+        NEW.scope := CASE WHEN NEW.agent_id IS NOT NULL THEN 'personal' ELSE 'shared' END;
+        IF NEW.agent_id IS NULL THEN
+            NEW.orphaned_from_id := OLD.team_id;
+        END IF;
+    END IF;
+    RETURN NEW;
+END;
+$$ LANGUAGE plpgsql;
```

**File**: `tests/integration/v3_vault_orphan_collision_test.go` (added, +179/-0)
```diff
@@ -0,0 +1,179 @@
+//go:build integration
+
+package integration
+
+import (
+	"database/sql"
+	"testing"
+
+	"github.com/google/uuid"
+)
+
+// TestStoreVault_OrphanCollision is the regression for #1550.
+//
+// vault_documents.agent_id and team_id are FKs with ON DELETE SET NULL, and the scope
+// triggers move a row whose owner is gone to scope='shared'. The scope-consistency CHECK
+// requires scope='shared' to carry both ids NULL, and before migration 000099 the unique
+// index COALESCEd both to one sentinel, so every orphan in a tenant shared the key
+// (tenant_id, sentinel, sentinel, 'shared', path). Deleting a second owner that had a
+// document at a path some earlier deleted owner already orphaned aborted the whole
+// delete with SQLSTATE 23505, and the agent could then not be deleted by any route.
+//
+// Orphans reach 'shared' from both the agent trigger (000046) and the team trigger
+// (000089), so all three pairings are covered here. Migration 000099 records the lost
+// owner in orphaned_from_id and includes it in the index; the documents are preserved
+// at their original path.
+func TestStoreVault_OrphanCollision(t *testing.T) {
+	db := testDB(t)
+	tenantID, _ := seedTenantAgent(t, db)
+	suffix := uuid.New().String()[:8]
+
+	t.Run("two_agents_same_path", func(t *testing.T) {
+		path := "orphan-collision/agents-" + suffix + ".md"
+		first := seedAgentIn(t, db, tenantID)
+		second := seedAgentIn(t, db, tenantID)
+		insertAgentDoc(t, db, tenantID, first, path)
+		insertAgentDoc(t, db, tenantID, second, path)
+
+		deleteAgent(t, db, first)  // orphans the first document
+		deleteAgent(t, db, second) // aborted with 23505 before 000099
+
+		assertOrphans(t, db, tenantID, path, 2)
+	})
+
+	t.Run("two_teams_same_path", func(t *testing.T) {
+		// Not covered by the #1077 fix: the team trigger also lands on scope='shared'.
+		path := "orphan-collision/teams-" + suffix + ".md"
+		lead := seedAgentIn(t, db, tenantID)
+		first := seedTeamIn(t, db, tenantID, lead)
+		second := seedTeamIn(t, db, tenantID, lead)
+		insertTeamDoc(t, db, tenantID, first, path)
+		insertTeamDoc(t, db, tenantID, second, path)
+
+		deleteTeam(t, db, first)
+		deleteTeam(t, db, second)
+
+		assertOrphans(t, db, tenantID, path, 2)
+	})
+
+	t.Run("agent_and_team_same_path", func(t *testing.T) {
+		path := "orphan-collision/mixed-" + suffix + ".md"
+		agentID := seedAgentIn(t, db, tenantID)
+		lead := seedAgentIn(t, db, tenantID)
+		teamID := seedTeamIn(t, db, tenantID, lead)
+		insertAgentDoc(t, db, tenantID, agentID, path)
+		insertTeamDoc(t, db, tenantID, teamID, path)
+
+		deleteAgent(t, db, agentID)
+		deleteTeam(t, db, teamID)
+
+		assertOrphans(t, db, tenantID, path, 2)
+	})
+
+	t.Run("live_uniqueness_is_unchanged", func(t *testing.T) {
+		// The index still rejects two live documents of one owner at one path.
+		path := "orphan-collision/live-" + suffix + ".md"
+		agentID := seedAgentIn(t, db, tenantID)
+		insertAgentDoc(t, db, tenantID, agentID, path)
+		_, err := db.Exec(
+			`INSERT INTO vault_documents (id, tenant_id, agent_id, scope, path, title, doc_type, content_hash)
+			 VALUES ($1, $2, $3, 'personal', $4, 'dup', 'note', 'h')`,
+			uuid.New(), tenantID, agentID, path)
+		if err == nil {
+			t.Fatal("a second live document at the same path for one agent was accepted")
+		}
+	})
+}
+
+// assertOrphans checks that want documents sit at path as orphans, each carrying a
+// distinct provenance, and that none of them was moved or dropped.
+func assertOrphans(t *testing.T, db *sql.DB, tenantID uuid.UUID, path string, want int) {
+	t.Helper()
+	var total, withProvenance, distinct int
+	err := db.QueryRow(
+		`SELECT count(*), count(orphaned_from_id), count(DISTINCT orphaned_from_id)
+		   FROM vault_documents
+		  WHERE tenant_id = $1 AND path = $2 AND scope = 'shared'
+		    AND agent_id IS NULL AND team_id IS NULL`,
+		tenantID, path).Scan(&total, &withProvenance, &distinct)
+	if err != nil {
+		t.Fatalf("count orphans: %v", err)
+	}
+	if total != want {
+		t.Fatalf("orphans at %s = %d, want %d", path, total, want)
+	}
+	if withProvenance != want {
+		t.Fatalf("orphans carrying provenance = %d, want %d", withProvenance, want)
+	}
+	if distinct != want {
+		t.Fatalf("distinct provenance values = %d, want %d", distinct, want)
+	}
+}
+
+func seedAgentIn(t *testing.T, db *sql.DB, tenantID uuid.UUID) uuid.UUID {
+	t.Helper()
+	id := uuid.New()
+	_, err := db.Exec(
+		`INSERT INTO agents (id, tenant_id, agent_key, agent_type, status, provider, model, owner_id)
+		 VALUES ($1, $2, $3, 'predefined', 'active', 'test', 'test-model', 'test-owner')`,
+		id, tenantID, "orphan-"+id.String()[:8])
+	if err != nil {
+		t.Fatalf("seed agent: %v", err)
+	}
+	t.Cleanup(func() { db.Exec(`DELETE FROM agents WHERE id = $1`, id) })
+	return id
+}
+
+func seedTeamIn(t *testing.T, db *sql.DB, tenantID, leadAgentID uuid.UUID) uuid.UUID {
+	t.Helper()
+	id := uuid.New()
+	_, err := db.Exec(
+		`INSERT INTO agent_teams (id, tenant_id, name, lea
```

---

### Incident Patch 15: `cbb72ccd` (2026-09-27)
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
+		return nil, fmt.Errorf("vault.list_needing_body_index: %w", err)
+	}
+	return vaultDocRowsToDocs(rows), nil
+}
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
 
-	if agentID != nil {
+// append adds the filters to q. Columns are unqualified; that works for the
+// chunk joins too because none of them exist on vault_document_chunks.
+func (f vaultSearchScope) append(q string, args []any, p int) (string, []any, int) {
+	if f.agentID != nil {
 		q += fmt.Sprintf(" AND (agent_id = $%d OR agent_id IS NULL)", p)
-		args = append(args, *agentID)
+		args = append(args, *f.agentID)
 		p++
 	}
-
-	q, args, p = tf.append(q, args, p)
-	q, args, p = cf.append(q, args, p)
-
-	if scope != "" {
+	q, args, p = f.team.append(q, args, p)
+	q, args, p = f.chat.append(q, args, p)
+	if f.scope != "" {
 		q += fmt.Sprintf(" AND scope = $%d", p)
-		args = append(args, scope)
+		args = append(args, f.scope)
 		p++
 	}
-	if len(docTypes) > 0 {
+	if len(f.docTypes) > 0 {
 		q += fmt.Sprintf(" AND doc_type = ANY($%d)", p)
-		args = append(args, pqStringArray(docTypes))
+		args = append(args, pqStringArray(f.docTypes))
 		p++
 	}
+	return q, args, p
+}
 
-	q += fmt.Sprintf("
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

**File**: `internal/store/vault_store.go` (modified, +15/-0)
```diff
@@ -67,6 +67,14 @@ type VaultSearchOptions struct {
 	MinScore   float64  // default 0.0
 }
 
+// VaultChunk is one piece of a vault document body, indexed for search.
+type VaultChunk struct {
+	Index     int
+	StartLine int
+	EndLine   int
+	Text      string
+}
+
 // VaultListOptions configures a list query for vault documents.
 type VaultListOptions struct {
 	TeamID   *string  // nil = no filter, ptr-to-empty = personal (NULL team_id), ptr-to-uuid = specific team
@@ -150,6 +158,13 @@ type VaultStore interface {
 	// FindSimilarDocs finds documents with similar embeddings to the given docID.
 	// Returns top-N neighbors excluding the source doc. Score = cosine similarity.
 	FindSimilarDocs(ctx context.Context, tenantID, agentID, docID string, limit int) ([]VaultSearchResult, error)
+	// ReplaceDocumentChunks swaps the indexed body chunks of a document and
+	// embeds them. It is a no-op when the chunks were already built from
+	// contentHash, so unchanged files are not re-embedded.
+	ReplaceDocumentChunks(ctx context.Context, tenantID, docID, contentHash string, chunks []VaultChunk) error
+	// ListDocsNeedingBodyIndex returns text documents whose body chunks are
+	// missing or were built from an older content_hash.
+	ListDocsNeedingBodyIndex(ctx context.Context, tenantID string, limit int) ([]VaultDocument, error)
 	// BatchFindByDelegationIDs returns vault docs sharing any of the given
 	// delegation_ids in their metadata, keyed by delegation_id. Each
 	// delegation's bucket is capped at `limit` (ordered by created_at DESC).
```

**File**: `internal/upgrade/version.go` (modified, +1/-1)
```diff
@@ -2,4 +2,4 @@ package upgrade
 
 // RequiredSchemaVersion is the schema migration version this binary requires.
 // Bump this whenever adding a new SQL migration file.
-const RequiredSchemaVersion uint = 97
+const RequiredSchemaVersion uint = 98
```

**File**: `internal/vault/body_index.go` (added, +84/-0)
```diff
@@ -0,0 +1,84 @@
+package vault
+
+import (
+	"context"
+	"log/slog"
+	"os"
+	"path/filepath"
+	"strings"
+	"sync"
+
+	"github.com/nextlevelbuilder/goclaw/internal/memory"
+	"github.com/nextlevelbuilder/goclaw/internal/store"
+)
+
+const (
+	// Same defaults as memory chunks.
+	vaultBodyChunkLen     = 1000
+	vaultBodyChunkOverlap = 200
+	// SHORTCUT: bodies past 2 MiB are indexed only up to the cap. Stream the
+	// file into chunks if people start keeping large exports in the vault.
+	vaultBodyMaxBytes = 2 << 20
+)
+
+// chunkBody splits a file body into search chunks. Postgres TEXT rejects NUL
+// bytes and invalid UTF-8, and a cut at vaultBodyMaxBytes can land mid-rune.
+func chunkBody(raw []byte) []store.VaultChunk {
+	if len(raw) > vaultBodyMaxBytes {
+		raw = raw[:vaultBodyMaxBytes]
+	}
+	text := strings.ToValidUTF8(strings.ReplaceAll(string(raw), "\x00", ""), "")
+	parts := memory.ChunkText(text, vaultBodyChunkLen, vaultBodyChunkOverlap)
+	chunks := make([]store.VaultChunk, len(parts))
+	for i, p := range parts {
+		chunks[i] = store.VaultChunk{Index: i, StartLine: p.StartLine, EndLine: p.EndLine, Text: p.Text}
+	}
+	return chunks
+}
+
+// indexBody rebuilds the body chunks of one text document from its workspace
+// file. The store skips the write when the chunks already match contentHash.
+// Failures are logged here; the error only tells the caller to retry later.
+func indexBody(ctx context.Context, vs store.VaultStore, tenantID, docID, contentHash, fullPath string) error {
+	raw, err := os.ReadFile(fullPath)
+	if err != nil {
+		slog.Warn("vault.body_index: read_file", "path", fullPath, "err", err)
+		return err
+	}
+	if err := vs.ReplaceDocumentChunks(ctx, tenantID, docID, contentHash, chunkBody(raw)); err != nil {
+		slog.Warn("vault.body_index: replace_chunks", "doc", docID, "err", err)
+		return err
+	}
+	return nil
+}
+
+// bodyIndexRuns keeps one IndexStaleBodies pass per tenant.
+var bodyIndexRuns sync.Map
+
+// IndexStaleBodies chunks every text document whose body index is missing or
+// older than its content. Docs indexed before chunking existed are never sent
+// to the enrich worker again because their summary is already set, so rescan
+// calls this to backfill them. No LLM calls: only reads and embeddings.
+// Returns false when a pass for the tenant is already running.
+func IndexStaleBodies(ctx context.Context, vs store.VaultStore, tenantID, workspace string) bool {
+	if _, running := bodyIndexRuns.LoadOrStore(tenantID, struct{}{}); running {
+		return false
+	}
+	defer bodyIndexRuns.Delete(tenantID)
+
+	docs, err := vs.ListDocsNeedingBodyIndex(ctx, tenantID, 0)
+	if err != nil {
+		slog.Warn("vault.body_index: list", "tenant", tenantID, "err", err)
+		return true
+	}
+	for _, doc := range docs {
+		if ctx.Err() != nil {
+			return true
+		}
+		_ = indexBody(ctx, vs, tenantID, doc.ID, doc.ContentHash, filepath.Join(workspace, doc.Path))
+	}
+	if len(docs) > 0 {
+		slog.Info("vault.body_index: backfilled", "tenant", tenantID, "count", len(docs))
+	}
+	return true
+}
```

#### Recent Merged Pull Requests:
- **PR #1595** (2026-10-03): feat(hooks): expose sender_id in lifecycle events and fix test dry-run cache (@fdkgenie)
- **PR #1590** (2026-09-30): fix(build): embed commit SHA for release provenance (#1571 part 2) (@fcy222fcy)
- **PR #1588** (2026-10-02): fix(providers): use adaptive thinking for Claude Opus 4.7+ and Claude 5 (@filipenf)
- **PR #1587** (2026-09-29): fix(pipeline): stop aborting runs on heuristic context budget estimates (@thotam)
- **PR #1586** (2026-09-29): fix(channels): deliver NO_REPLY placeholder cleanup signal to channels (@fcy222fcy)
- **PR #1585** (2026-09-28): docs: add Requesty to the README provider list (@Thibaultjaigu)
- **PR #1584** (2026-09-28): fix(gateway): admit operator.provision keys on tenants.create and ten… (@fcy222fcy)
- **PR #1583** (2026-10-03): Fix agent deletion failing on an orphaned vault path collision (@Kaustubh1235)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
