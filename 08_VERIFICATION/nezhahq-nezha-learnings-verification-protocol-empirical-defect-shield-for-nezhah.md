# Verification Protocol: Verification Protocol: Empirical Defect Shield for nezhahq-nezha-learnings

<!-- PROVENANCE_START
{
  "source_repository": "nezhahq-nezha-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-20T17:58:50.065Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-nezhahq-nezha-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [nezhahq-nezha-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-20T17:58:50.065Z`  
> **Learning ID**: `LEARN-EVO-nezhahq-nezha-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `nezhahq-nezha-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/nezhahq-nezha-learnings.md`  
> **Source**: github ([https://github.com/nezhahq/nezha](https://github.com/nezhahq/nezha))  
> **Source Version**: `76b07b58`  
> **License**: WTFPL  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-20T17:58:45.685Z  
> **Learning ID**: `learn-github-nezhahq-nezha`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): nezhahq/nezha

> **Canonical Artifact**: `07_PROJECT_LEARNING/nezhahq-nezha-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/nezhahq/nezha](https://github.com/nezhahq/nezha))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-20T17:53:45.042Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `nezhahq/nezha`
- **Description**: :trollface: Self-hosted, lightweight server and website monitoring and O&M tool
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 10419 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cmd/dashboard/controller/mcp_transfer_lifecycle.go`
```
package controller

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"sync"
	"time"

	"github.com/hashicorp/go-uuid"

	"github.com/nezhahq/nezha/model"
	pb "github.com/nezhahq/nezha/proto"
	"github.com/nezhahq/nezha/service/rpc"
	"github.com/nezhahq/nezha/service/singleton"
)

// openFsTransferStream owns the task-to-agent IOStream lifecycle. The returned
// cleanup is safe for concurrent callers and shares ownership with cancellation.
func openFsTransferStream(ctx context.Context, serverID uint64, req *model.FsTransferRequest) (io.ReadWriteCloser, func(), error) {
	if singleton.Conf == nil || !singleton.Conf.MCPEnabled() {
		return nil, func() {}, errors.New("MCP is disabled by the dashboard administrator")
	}
	server, _ := singleton.ServerShared.Get(serverID)
	if server == nil || server.GetTaskStream() == nil {
		return nil, func() {}, errors.New("server offline")
	}
	releaseControl, controlErr := singleton.BeginServerControlFromContext(ctx, serverID)
	if controlErr != nil {
		return nil, func() {}, controlErr
	}
	var controlOnce sync.Once
	releaseAdmission := func() { controlOnce.Do(releaseControl) }
	defer releaseAdmission()
	handler := rpc.NezhaHandlerSingleton

	streamID, err := uuid.GenerateUUID()
	if err != nil {
		return nil, func() {}, err
	}
	req.StreamID = streamID
	if err := handler.CreateStreamWithPurpose(streamID, 0, serverID, rpc.PurposeMCPTransfer); err != nil {
		return nil, func() {}, err
	}
	var cleanupOnce sync.Once
	cleanup := func() { cleanupOnce.Do(func() { _ = handler.CloseStream(streamID) }) }

	body, err := json.Marshal(req)
	if err != nil {
		cleanup()
		return nil, func() {}, err
	}
	// The stream is owned by cleanup until the caller receives it; every failure path releases it.
	if singleton.Conf == nil || !singleton.Conf.MCPEnabled() {
		cleanup()
		return nil, func() {}, errors.New("MCP is disabled by the dashboard administrator")
	}
	if err := ctx.Err(); err != nil {
		cleanup()
		return nil, func() {}, err
	}
	if err := server.SendTask(&pb.Task{Type: model.TaskTypeFsTransfer, Data: string(body)}); err != nil {
		cleanup()
		if errors.Is(err, model.ErrTaskStreamOffline) {
			return nil, func() {}, errors.New("server offline")
		}
		return nil, func() {}, err
	}

	releaseAdmission() // Registered streams are now covered by ownership revocation.
	agentStream, ok := handler.WaitForAgent(ctx, streamID, 30*time.Second)
	if !ok {
		cleanup()
		return nil, func() {}, errors.New("agent did not attach within 30s")
	}

	watcherDone := make(chan struct{})
	var watcherOnce sync.Once
	go func() {
		select {
		case <-ctx.Done():
			cleanup()
		case <-watcherDone:
		}
	}()
	wrappedCleanup := func() {
		watcherOnce.Do(func() { close(watcherDone) })
		cleanup()
	}
	return agentStream, wrappedCleanup, nil
}

```

### Core Architecture Module: `integration/agentcompat/internal/agent/process_lifecycle.go`
```
//go:build linux

package agent

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"syscall"
	"time"

	processharness "github.com/nezhahq/nezha/integration/agentcompat/internal/process"
)

type ProcessIdentity struct {
	Generation     uint64
	PID            int
	ProcessGroupID int
}

type ProcessTransition struct {
	Previous ProcessIdentity
	Current  ProcessIdentity
}

type processGeneration struct {
	supervisor *processharness.Supervisor
	identity   ProcessIdentity
	record     processharness.CleanupRecord
}

func (agent *Agent) RuntimeIdentity() ProcessIdentity {
	agent.processMu.Lock()
	defer agent.processMu.Unlock()
	if agent.currentProcess == nil {
		return ProcessIdentity{}
	}
	return agent.currentProcess.identity
}

func (agent *Agent) StartProcess(ctx context.Context) (ProcessTransition, error) {
	agent.processMu.Lock()
	defer agent.processMu.Unlock()
	if agent.closed {
		return ProcessTransition{}, errors.New("agent is closed")
	}
	if agent.currentProcess != nil {
		return ProcessTransition{}, errors.New("agent process is already running")
	}
	agent.generation++
	logFile, err := agent.workspace.Log(fmt.Sprintf("agent-%s-generation-%d", strings.ReplaceAll(agent.uuid, "-", ""), agent.generation))
	if err != nil {
		return ProcessTransition{}, err
	}
	agent.logPath = logFile.Name()
	newSupervisor := processharness.NewSupervisor
	if agent.startConfig.newSupervisor != nil {
		newSupervisor = agent.startConfig.newSupervisor
	}
	supervisor := newSupervisor(ctx, processharness.Spec{
		Name: "agent", Path: agent.binaryPath, Args: []string{"-c", agent.configPath}, Env: agent.environment,
		Stdout: logFile, Stderr: logFile, MaxLogBytes: agentMaxLogBytes,
		TerminateTimeout: agentStopTimeout, KillTimeout: agentKillTimeout,
		Credential: agent.startConfig.Credential,
	})
	if err := supervisor.Start(); err != nil {
		return ProcessTransition{}, err
	}
	identity := ProcessIdentity{Generation: agent.generation, PID: supervisor.PID(), ProcessGroupID: supervisor.ProcessGroupID()}
	generation := &processGeneration{supervisor: supervisor, identity: identity, record: supervisor.CleanupRecord()}
	// Register the started generation before post-start setup so failures remain cleanup-owned.
	agent.currentProcess = generation
	agent.supervisor = supervisor
	agent.processes = append(agent.processes, generation)
	if err := agent.trackPID(identity.PID); err != nil {
		return agent.rollbackStartedProcess(ctx, generation, err)
	}
	if err := agent.trackProcessGroup(identity.ProcessGroupID); err != nil {
		return agent.rollbackStartedProcess(ctx, generation, err)
	}
	previous := ProcessIdentity{}
	return ProcessTransition{Previous: previous, Current: identity}, nil
}

func (agent *Agent) rollbackStartedProcess(ctx context.Context, generation *processGeneration, trackingErr error) (ProcessTransition, error) {
	agent.currentProcess = nil
	agent.supervisor = nil
	rollbackContext, cancel := context.WithTimeout(context.WithoutCancel(ctx), 15*time.Second)
	defer cancel()
	rollbackErr := generation.supervisor.Stop(rollbackContext)
	generation.record = generation.supervisor.CleanupRecord()
	return ProcessTransition{}, errors.Join(trackingErr, rollbackErr)
}

func (agent *Agent) StopProcess(ctx context.Context) (ProcessTransition, error) {
	agent.processMu.Lock()
	process := agent.currentProcess
	if process == nil {
		agent.processMu.Unlock()
		return ProcessTransition{}, errors.New("agent process is not running")
	}
	agent.currentProcess = nil
	agent.supervisor = nil
	agent.processMu.Unlock()
	if err := process.supervisor.Stop(ctx); err != nil {
		return ProcessTransition{Previous: process.identity}, fmt.Errorf("stop agent process: %w", err)
	}
	process.record = process.supervisor.CleanupRecord()
	return ProcessTransition{Previous: process.identity}, nil
}

func (agent *Agent) RestartProcess(ctx context.Context) (ProcessTransition, error) {
	stopped, err := agent.StopProcess(ctx)
	if err != nil {
		return stopped, err
	}
	started, err := agent.StartProcess(ctx)
	if err != nil {
		return ProcessTransition{Previous: stopped.Previous}, err
	}
	return ProcessTransition{Previous: stopped.Previous, Current: started.Current}, nil
}

func (agent *Agent) Restart(ctx context.Context) error {
	_, err := agent.RestartProcess(ctx)
	return err
}

func (agent *Agent) Close(ctx context.Context) error {
	agent.processMu.Lock()
	agent.closed = true
	agent.processMu.Unlock()
	return agent.Stop(ctx)
}

func (agent *Agent) closeProcesses(ctx context.Context) error {
	agent.processMu.Lock()
	processes := append([]*processGeneration(nil), agent.processes...)
	agent.processMu.Unlock()
	var cleanupError error
	for _, process := range processes {
		stopContext, cancel := context.WithTimeout(ctx, 15*time.Second)
		cleanupError = errors.Join(cleanupError, process.supervisor.Stop(stopContext))
		cancel()
		process.record = process.supervisor.CleanupRecord()
	}
	return cleanupError
}

func (agent *Agent) processesQuiescent() bool {
	agent.processMu.Lock()
	processes := append([]*processGeneration(nil), agent.processes...)
	agent.processMu.Unlock()
	for _, process := range processes {
		select {
		case <-process.supervisor.Exited():
		default:
			return false
		}
		err := syscall.Kill(-process.identity.ProcessGroupID, 0)
		if err == nil || errors.Is(err, syscall.EPERM) {
			return false
		}
		if !errors.Is(err, syscall.ESRCH) {
			return false
		}
	}
	return true
}

```

### Core Architecture Module: `integration/agentcompat/internal/client/io_stream_state.go`
```
package client

import (
	"context"
	"net/http"
)

type IOStreamState struct {
	Count      int    `json:"count"`
	Generation uint64 `json:"generation"`
}

type IOStreamStateExpectation struct {
	ExpectedCount   *int   `json:"expected_count,omitempty"`
	PresentStreamID string `json:"present_stream_id,omitempty"`
	AbsentStreamID  string `json:"absent_stream_id,omitempty"`
}

func ExpectedIOStreamCount(count int) *int {
	return &count
}

func (client *Client) IOStreamState(ctx context.Context) (IOStreamState, error) {
	return DoREST[struct{}, IOStreamState](ctx, client, RESTRequest[struct{}]{Method: http.MethodGet, Path: "/agentcompat/io-stream-state"})
}

func (client *Client) WaitForIOStreamState(ctx context.Context, expectation IOStreamStateExpectation) (IOStreamState, error) {
	return DoREST[IOStreamStateExpectation, IOStreamState](ctx, client, RESTRequest[IOStreamStateExpectation]{Method: http.MethodPost, Path: "/agentcompat/io-stream-state", Body: &expectation})
}

```

### Core Architecture Module: `integration/agentcompat/internal/dashboard/lifecycle.go`
```
//go:build linux

package dashboard

import (
	"context"
	"errors"
	"fmt"

	"github.com/nezhahq/nezha/integration/agentcompat/internal/client"
	processharness "github.com/nezhahq/nezha/integration/agentcompat/internal/process"
)

func (dashboard *Dashboard) StopProcess(ctx context.Context) (RuntimeIdentity, error) {
	dashboard.lifecycleMu.Lock()
	defer dashboard.lifecycleMu.Unlock()
	dashboard.stateMu.Lock()
	process := dashboard.currentProcess
	dashboard.currentProcess = nil
	dashboard.supervisor = nil
	dashboard.stateMu.Unlock()
	if process == nil {
		return RuntimeIdentity{}, errors.New("dashboard process is not running")
	}
	if process.receiptConn != nil {
		_ = process.receiptConn.Close()
	}
	if process.httpTransport != nil {
		process.httpTransport.CloseIdleConnections()
	}
	if process.tlsTransport != nil {
		process.tlsTransport.CloseIdleConnections()
	}
	if err := process.supervisor.Stop(ctx); err != nil {
		return process.identity, fmt.Errorf("stop dashboard process: %w", err)
	}
	process.record = process.supervisor.CleanupRecord()
	return process.identity, nil
}

func (dashboard *Dashboard) StartProcess(ctx context.Context) (RuntimeIdentity, error) {
	dashboard.lifecycleMu.Lock()
	defer dashboard.lifecycleMu.Unlock()
	dashboard.stateMu.Lock()
	if dashboard.currentProcess != nil {
		dashboard.stateMu.Unlock()
		return RuntimeIdentity{}, errors.New("dashboard process is already running")
	}
	dashboard.generation++
	generation := dashboard.generation
	dashboard.stateMu.Unlock()
	dashboard.receiptMu.Lock()
	dashboard.receiptAccepted = false
	dashboard.receiptAcceptedCount = 0
	dashboard.receiptGeneration = 0
	dashboard.receiptMu.Unlock()
	process, err := dashboard.startGeneration(ctx, generation)
	if err != nil {
		return RuntimeIdentity{}, err
	}
	dashboard.stateMu.Lock()
	dashboard.currentProcess = process
	dashboard.supervisor = process.supervisor
	dashboard.processes = append(dashboard.processes, process)
	dashboard.stateMu.Unlock()
	return process.identity, nil
}

func (dashboard *Dashboard) FixtureIdentity() FixtureIdentity {
	identity := FixtureIdentity{WorkspaceRoot: dashboard.workspace.Root(), ConfigPath: dashboard.configPath, DatabasePath: dashboard.databasePath, BinaryPath: dashboard.binaryPath}
	if dashboard.httpListener != nil {
		identity.HTTP = dashboard.httpListener.Identity()
	}
	if dashboard.receiptListener != nil {
		identity.Receipt = dashboard.receiptListener.Identity()
	}
	if dashboard.httpsListener != nil {
		identity.HTTPS = dashboard.httpsListener.Identity()
	}
	return identity
}

func (dashboard *Dashboard) RuntimeIdentity() RuntimeIdentity {
	dashboard.stateMu.Lock()
	defer dashboard.stateMu.Unlock()
	if dashboard.currentProcess == nil {
		return RuntimeIdentity{}
	}
	return dashboard.currentProcess.identity
}

func (dashboard *Dashboard) Restart(ctx context.Context) error {
	if _, err := dashboard.StopProcess(ctx); err != nil {
		return err
	}
	_, err := dashboard.StartProcess(ctx)
	return err
}

func (dashboard *Dashboard) cleanupOnCancellation(ctx context.Context) {
	select {
	case <-ctx.Done():
		dashboard.cleanupOnce.Do(func() { go dashboard.cleanup(context.WithoutCancel(ctx)) })
	case <-dashboard.cleanupDone:
	}
}

func (dashboard *Dashboard) cleanup(ctx context.Context) {
	defer close(dashboard.cleanupDone)
	var stopError error
	cleanupReceipt := dashboard.cleanupProcesses(ctx, &stopError)
	if err := dashboard.workspace.Close(); err != nil {
		stopError = errors.Join(stopError, fmt.Errorf("close dashboard workspace: %w", err))
		cleanupReceipt = processharness.NewCleanupReceipt(append(cleanupReceipt.Processes, processharness.CleanupRecord{Name: "dashboard-workspace", Error: client.Redact(err.Error())}))
	}
	dashboard.cleanupMu.Lock()
	dashboard.cleanupError = stopError
	dashboard.cleanupReceipt = cleanupReceipt
	dashboard.cleanupMu.Unlock()
}

func (dashboard *Dashboard) cleanupProcesses(ctx context.Context, stopError *error) processharness.CleanupReceipt {
	cleanupReceipt := processharness.CleanupReceipt{}
	dashboard.stateMu.Lock()
	processes := append([]*dashboardGeneration(nil), dashboard.processes...)
	legacySupervisor := dashboard.supervisor
	dashboard.stateMu.Unlock()
	if len(processes) == 0 && legacySupervisor != nil {
		if err := legacySupervisor.Stop(ctx); err != nil {
			*stopError = errors.Join(*stopError, fmt.Errorf("stop dashboard process: %w", err))
		}
		return processharness.NewCleanupReceipt([]processharness.CleanupRecord{legacySupervisor.CleanupRecord()})
	}
	for _, process := range processes {
		if process.receiptConn != nil {
			_ = process.receiptConn.Close()
		}
		if process.httpTransport != nil {
			process.httpTransport.CloseIdleConnections()
		}
		if process.tlsTransport != nil {
			process.tlsTransport.CloseIdleConnections()
		}
		stopContext, cancel := context.WithTimeout(ctx, failedStartCleanupTimeout)
		if err := process.supervisor.Stop(stopContext); err != nil {
			*stopError = errors.Join(*stopError, fmt.Errorf("stop dashboard process: %w", err))
		}
		cancel()
		process.record = process.supervisor.CleanupRecord()
		if process.record.Forced {
			*stopError = errors.Join(*stopError, errors.New("dashboard required forced SIGKILL cleanup"))
		}
		cleanupReceipt.Processes = append(cleanupReceipt.Processes, process.record)
	}
	return processharness.NewCleanupReceipt(cleanupReceipt.Processes)
}

```

### Core Architecture Module: `integration/agentcompat/internal/dashboard/receipt_lifecycle.go`
```
//go:build linux

package dashboard

import (
	"context"
	"errors"
	"fmt"
)

func (dashboard *Dashboard) MCPReceiptCursor() MCPReceiptCursor {
	dashboard.eventMu.RLock()
	defer dashboard.eventMu.RUnlock()
	return MCPReceiptCursor{Sequence: dashboard.mcpReceiptSequence}
}

func (dashboard *Dashboard) MCPReceiptEventsAfter(cursor MCPReceiptCursor) []MCPReceiptEvent {
	dashboard.eventMu.RLock()
	defer dashboard.eventMu.RUnlock()
	events := make([]MCPReceiptEvent, 0, len(dashboard.mcpReceiptEvents))
	for _, event := range dashboard.mcpReceiptEvents {
		if event.Sequence > cursor.Sequence {
			events = append(events, event)
		}
	}
	return events
}

func (dashboard *Dashboard) WaitForMCPReceiptPairs(ctx context.Context, cursor MCPReceiptCursor, expectations []MCPReceiptExpectation) ([]MCPReceiptPair, error) {
	if len(expectations) == 0 {
		return nil, errors.New("MCP receipt expectations are empty")
	}
	for {
		dashboard.eventMu.RLock()
		notify, closed := dashboard.eventNotify, dashboard.eventClosed
		events := append([]MCPReceiptEvent(nil), dashboard.mcpReceiptEvents...)
		dashboard.eventMu.RUnlock()
		pairs, complete, err := matchMCPReceiptPairs(events, cursor, expectations)
		if err != nil {
			return nil, err
		}
		if complete {
			return pairs, nil
		}
		if closed {
			return nil, ErrReceiptGateClosed
		}
		select {
		case <-notify:
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}
}

func matchMCPReceiptPairs(events []MCPReceiptEvent, cursor MCPReceiptCursor, expectations []MCPReceiptExpectation) ([]MCPReceiptPair, bool, error) {
	pairs := make([]MCPReceiptPair, len(expectations))
	matched := make(map[uint64]int, len(expectations))
	for _, event := range events {
		if event.Sequence <= cursor.Sequence {
			continue
		}
		index, exists := matched[event.TaskID]
		if !exists {
			if event.Kind != MCPReceiptTask || len(matched) >= len(expectations) {
				return nil, false, fmt.Errorf("unexpected MCP receipt event after cursor: %+v", event)
			}
			index = len(matched)
			expectation := expectations[index]
			if event.ServerID != expectation.ServerID || event.TaskType != expectation.TaskType {
				return nil, false, fmt.Errorf("MCP task receipt mismatch at index %d: %+v", index, event)
			}
			matched[event.TaskID] = index
			pairs[index].Task = event
			continue
		}
		if event.Kind != MCPReceiptResult || pairs[index].Result.TaskID != 0 {
			return nil, false, fmt.Errorf("MCP task ID %d was received more than once", event.TaskID)
		}
		if event.ServerID != pairs[index].Task.ServerID || event.TaskType != pairs[index].Task.TaskType || event.GateGeneration != pairs[index].Task.GateGeneration || event.DashboardGeneration != pairs[index].Task.DashboardGeneration {
			return nil, false, fmt.Errorf("MCP result receipt does not match task: task=%+v result=%+v", pairs[index].Task, event)
		}
		pairs[index].Result = event
	}
	if len(matched) != len(expectations) {
		return nil, false, nil
	}
	for _, pair := range pairs {
		if pair.Result.TaskID == 0 {
			return nil, false, nil
		}
	}
	return pairs, true, nil
}

```

### Core Architecture Module: `pkg/ddns/webhook/webhook.go`
```
package webhook

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	"github.com/libdns/libdns"
	"github.com/nezhahq/nezha/model"
	"github.com/nezhahq/nezha/pkg/utils"
)

const (
	_ = iota
	methodGET
	methodPOST
	methodPATCH
	methodDELETE
	methodPUT
)

const (
	_ = iota
	requestTypeJSON
	requestTypeForm
)

var requestTypes = map[uint8]string{
	methodGET:    "GET",
	methodPOST:   "POST",
	methodPATCH:  "PATCH",
	methodDELETE: "DELETE",
	methodPUT:    "PUT",
}

var errInvalidURL = errors.New("invalid webhook URL")

// Internal use
type Provider struct {
	ipAddr     string
	ipType     string
	recordType string
	domain     string

	DDNSProfile *model.DDNSProfile
}

func (provider *Provider) SetRecords(ctx context.Context, zone string,
	recs []libdns.Record) ([]libdns.Record, error) {
	for _, rec := range recs {
		switch rec.(type) {
		case libdns.Address:
			rr := rec.RR()
			provider.recordType = rr.Type
			provider.ipType = recordToIPType(provider.recordType)
			provider.ipAddr = rr.Data
			provider.domain = fmt.Sprintf("%s.%s", rr.Name, strings.TrimSuffix(zone, "."))

			// WebhookURL is attacker-controlled (GHSA-6x26-5727-rrm9); the request and
			// the client are paired so URL validation and DialContext pinning are driven
			// by a single DNS resolution. Do not swap the client for utils.HttpClient.
			req, client, err := provider.prepareRequest(ctx)
			if err != nil {
				return nil, fmt.Errorf("failed to update a domain: %s. Cause by: %v", provider.domain, withoutRequestURL(err))
			}
			resp, err := client.Do(req)
			if err != nil {
				return nil, fmt.Errorf("failed to update a domain: %s. Cause by: %v", provider.domain, withoutRequestURL(err))
			}
			_, _ = io.Copy(io.Discard, resp.Body)
			resp.Body.Close()
		default:
			return nil, fmt.Errorf("unsupported record type: %T", rec)
		}
	}

	return recs, nil
}

// withoutRequestURL strips the request URL from net/url and net/http errors.
// The webhook URL is a stored credential (tokens in path or query, with
// #access_id# / #access_secret# already expanded) and the DDNS worker writes
// the error returned by SetRecords to the dashboard log.
func withoutRequestURL(err error) error {
	var urlErr *url.Error
	if !errors.As(err, &urlErr) {
		return err
	}
	if urlErr.Op == "parse" {
		// The cause quotes pieces of the URL as well (a bad escape, or part
		// of an unescaped password taken for a port).
		return errInvalidURL
	}
	return fmt.Errorf("%s: %w", urlErr.Op, urlErr.Err)
}

func (provider *Provider) prepareRequest(ctx context.Context) (*http.Request, *http.Client, error) {
	u, err := provider.reqUrl()
	if err != nil {
		return nil, nil, err
	}
	// Single SSRF check + dial pin; the returned client must be used by callers
	// so the dialer's pinned IP and the validated URL stay in sync.
	client, err := utils.NewRestrictedHTTPClient(u.String(), false)
	if err != nil {
		return nil, nil, err
	}

	body, err := provider.reqBody()
	if err != nil {
		return nil, nil, err
	}

	// Parse the template before expanding the placeholders, so that a value
	// cannot add or replace headers.
	headers, err := utils.GjsonIter(strings.TrimSpace(provider.DDNSProfile.WebhookHeaders))
	if err != nil {
		return nil, nil, err
	}

	req, err := http.NewRequestWithContext(ctx, requestTypes[provider.DDNSProfile.WebhookMethod], u.String(), strings.NewReader(body))
	if err != nil {
		return nil, nil, err
	}

	provider.setContentType(req)

	for k, v := range headers {
		req.Header.Set(provider.formatWebhookString(k, nil), provider.formatWebhookString(v, nil))
	}

	return req, client, nil
}

func (provider *Provider) setContentType(req *http.Request) {
	if provider.DDNSProfile.WebhookMethod == methodGET {
		return
	}
	if provider.DDNSProfile.WebhookRequestType == requestTypeForm {
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	} else {
		req.Header.Set("Content-Type", "application/json")
	}
}

func (provider *Provider) reqUrl() (*url.URL, error) {
	formattedUrl := strings.ReplaceAll(provider.DDNSProfile.WebhookURL, "#", "%23")

	u, err := url.Parse(formattedUrl)
	if err != nil {
		return nil, err
	}

	// Only handle queries here
	q := u.Query()
	for p, vals := range q {
		for n, v := range vals {
			vals[n] = provider.formatWebhookString(v, nil)
		}
		q[p] = vals
	}

	u.RawQuery = q.Encode()
	return u, nil
}

func (provider *Provider) reqBody() (string, error) {
	if provider.DDNSProfile.WebhookMethod == methodGET ||
		provider.DDNSProfile.WebhookMethod == methodDELETE {
		return "", nil
	}

	switch provider.DDNSProfile.WebhookRequestType {
	case requestTypeJSON:
		return provider.formatWebhookString(provider.DDNSProfile.WebhookRequestBody, func(v string) string {
			vBytes, _ := json.Marshal(v)
			return string(vBytes)[1 : len(vBytes)-1]
		}), nil
	case requestTypeForm:
		data, err := utils.GjsonIter(provider.DDNSProfile.WebhookRequestBody)
		if err != nil {
			return "", err
		}
		params := url.Values{}
		for k, v := range data {
			params.Add(k, provider.formatWebhookString(v, nil))
		}
		return params.Encode(), nil
	default:
		return "", errors.New("request type not supported")
	}
}

// formatWebhookString expands the placeholders in s. The values are not
// written by the author of the template (#domain# may be a server's DDNS
// domain override), so mod must encode them for the syntax s is written in;
// it may be nil only if the caller encodes the result as a whole.
func (provider *Provider) formatWebhookString(s string, mod func(string) string) string {
	if mod == nil {
		mod = func(v string) string { return v }
	}

	r := strings.NewReplacer(
		"#ip#", mod(provider.ipAddr),
		"#domain#", mod(provider.domain),
		"#type#", mod(provider.ipType),
		"#record#", mod(provider.recordType),
		"#access_id#", mod(provider.DDNSProfile.AccessID),
		"#access_secret#", mod(provider.DDNSProfile.AccessSecret),
		"\r", "",
	)

	result := r.Replace(strings.TrimSpace(s))
	return result
}

func recordToIPType(record string) string {
	switch record {
	case "A":
		return "ipv4"
	case "AAAA":
		return "ipv6"
	default:
		return ""
	}
}

```

### Core Architecture Module: `pkg/utils/bearer_credential.go`
```
package utils

import "strings"

// BearerCredential extracts a bearer token using HTTP's case-insensitive
// authentication scheme rules. Authentication and NAT credential filtering
// must use the same parser so a valid credential cannot bypass stripping.
func BearerCredential(header string) string {
	scheme, credential, ok := strings.Cut(strings.TrimSpace(header), " ")
	if !ok || !strings.EqualFold(scheme, "Bearer") {
		return ""
	}
	return strings.TrimSpace(credential)
}

```

### Core Architecture Module: `pkg/utils/bytes.go`
```
package utils

import (
	"fmt"
	"math"
)

// https://github.com/dustin/go-humanize/blob/master/bytes.go

func logn(n, b float64) float64 {
	return math.Log(n) / math.Log(b)
}

func countDigits(n int64) int {
	digits := 0
	for n != 0 {
		n /= 10
		digits += 1
	}
	return digits
}

func humanateBytes(s uint64, base float64, minDigits int, sizes []string) string {
	if s < 10 {
		return fmt.Sprintf("%d B", s)
	}
	e := math.Floor(logn(float64(s), base))
	suffix := sizes[min(len(sizes)-1, int(e))] // #nosec G602
	rounding := math.Pow10(minDigits - 1)
	val := math.Floor(float64(s)/math.Pow(base, e)*rounding+0.5) / rounding
	ff := "%%.%df %%s"
	digits := max(minDigits-countDigits(int64(val)), 0)
	f := fmt.Sprintf(ff, digits)
	return fmt.Sprintf(f, val, suffix)
}

func Bytes(s uint64) string {
	sizes := []string{"B", "kB", "MB", "GB", "TB", "PB", "EB"}
	return humanateBytes(s, 1024, 2, sizes)
}

```

### Core Architecture Module: `pkg/utils/file.go`
```
package utils

import "os"

// RestrictFileToOwner removes group and other access from a file that holds
// secrets. The permission passed to os.WriteFile / os.OpenFile (and SQLite's
// own 0644) is only used when the file gets created, so a file that already
// exists keeps its mode unless it is changed explicitly.
func RestrictFileToOwner(path string) error {
	info, err := os.Stat(path)
	if err != nil {
		return err
	}
	perm := info.Mode().Perm()
	if perm&0077 == 0 {
		return nil
	}
	return os.Chmod(path, perm&^0077)
}

```

### Core Architecture Module: `pkg/utils/gin_writer_wrapper.go`
```
package utils

import "github.com/gin-gonic/gin"

type GinCustomWriter struct {
	gin.ResponseWriter

	customCode int
}

func NewGinCustomWriter(c *gin.Context, code int) *GinCustomWriter {
	return &GinCustomWriter{
		ResponseWriter: c.Writer,
		customCode:     code,
	}
}

func (w *GinCustomWriter) WriteHeader(code int) {
	w.ResponseWriter.WriteHeader(w.customCode)
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1245** (2026-10-24): **perf(dashboard): 压缩并缓存静态资源，为轮询接口增加 ETag**
  *Symptoms*: ## 背景  dashboard 之前以未压缩方式提供静态资源，且没有任何缓存策略，导致每次页面跳转都要重新下载并校验完整资源包。两个前端界面还会定时轮询 `/api/v1/service` 和 `/api/v1/server`，每次轮询都返回完整快照，且不支持条件请求。  ## 改动  - 对静态资源按 `Accept-Encoding` 协商提供 brotli/gzip，编码结果按文件 mtime 缓存（`cmd/dashboard/controller/static_compress.go`）。 - 对带哈希的 `/assets/` 返回 `Cache-Control: immutable`，其余返回 `ETag` + `no-cache`，重复加载变为 304。 - 不再记录静态资源请求日志。 - 用按 viewer 加锁的 singleflight 合并并发的 `/api/v1/server` 快照（`cmd/dashboard/controller/controller.go`）。 - 为 `/api/v1/service` 与 `/api/v1/server` 增加 `ETag`/304 支持。 - 新增 `script/build-frontends.sh`，用于可复现的 dist 构建。  ## 说明  - `go.mod` 新增依赖 `github.com/andybalholm/brotli`。  ## 测试  `go test ./cmd/dashboard/controller/...` 覆盖编码协商以及 ETag / singleflight 路径（`static_compress_test.go`、`api_etag_test.go`）。
  **Post-Mortem & Fix Analysis**:
  > ### Code review  发现 4 个需要在合并前修复的问题：  1. **[P1] singleflight 共享的服务器切片会被权限过滤原地修改。** 合并的请求获得同一底层数组，随后 `filter` 使用 `slices.DeleteFunc` 删除无权限项并清零尾部。同一普通用户或受限 PAT 的并发请求仍持有原长度，可能对尾部 `nil` 调用 `HasPermission`，导致 panic/500；过滤与序列化之间也可能发生数据竞争。建议请求级克隆切片，或将完整的过滤与响应生成放入正确隔离、不可变的共享结果中，并增加真实并发响应测试。  https://github.com/nezhahq/nezha/blob/69c539e59161dae185148460e78284be0968ed45/cmd/dashboard/controller/server.go#L38-L54  2. **[P2] 压缩缓存没有按本地文件版本失效。** 缓存键只有模板根、来源、路径和编码，`modTime` 没有参与。运行期间更新同路径的 `index.html` 后，gzip/br 请求仍可能命中旧正文，响应 ETag 却来自新文件元数据。应将文件版本纳入缓存键，并测试同一路径内容更新后返回新正文。  https://github.com/nezhahq/nezha/blob/69c539e59161dae185148460e78284be0968ed45/cmd/dashboard/controller/static_compress.go#L150-L168  3. **[P2] 嵌入资源等长更新会复用旧 ETag。** 当前验证器只依赖文件名、长度和 mtime，而 `embed.FS` 的 mtime 为零。两次发布仅替换等长 chunk 哈希时，首页 ETag 不变，客户端可能收到错误的 304，继续使用引用旧资源的 HTML。建议采用内容摘要或构建版本，并覆盖同名、同长度、内容不同的升级场景。  https://github.com/nezhahq/nezha/blob/69c539e59161dae185148460e78284be0968ed45/cmd/dashboard/controller/static_compress.go#L177
  > 转向自建二开版本，本 PR 不再提交上游。

- **Issue #1243** (2026-10-16): **feat(server): online session history with configurable stats window (7-3650 days)**
  *Symptoms*: ## 功能  为每台服务器记录**在线/离线会话历史**,并提供可配置窗口的查询 API,供前端展示在线率、每日在线时段与精确到秒的在线明细:  - agent 每次状态流建立/断开即产生会话(`ReportSystemState` attach/clear),≥30s 节流落盘 `last_active_at` 用于崩溃恢复,dashboard 重启后从 `online_sessions` 表恢复进行中会话,时间线不断裂; - 游客限制与 `getServerMetrics` 语义一致:超过 1 天返回 `unauthorized: only 1d data available for guests`(报错而非 clamp); - 管理员可配置统计窗口 `online_stats_days`(7~3650,默认 7),经 `PATCH /api/v1/setting` 修改,响应中 `max_days` 下发给前端控制可选档位。  ## API  `GET /api/v1/server/{id}/online-history?days={n}`  返回 `window_start/window_end`、`online_rate`、`total_online_seconds`、`currently_online`、`last_active`、逐日聚合 `daily[]`、会话明细 `periods[]`(UTC RFC3339)以及面板时区 `timezone`/`tz_offset`(前端按面板时区拆日渲染)。  ## 持久化与内存数据清单  **持久化(SQLite,经 gorm):** 1. 新表 `online_sessions`:`id`、`created_at`、`updated_at`(内联,对齐 ServiceHistory 先例)、`server_id`、`started_at`、`ended_at`(进行中为零值)、`last_active_at`(≥30s 节流,崩溃恢复用)、`ongoing`;复合索引 `idx_online_sessions_server_started(server_id, started_at)`。保留策略:每日 04:30 分批(1 万行/批)修剪至 `online_stats_days` 窗口,并清理已删服务器的孤儿行。 2. `config.yaml`:`online_stats_days`(dashboard 段,默认 7,合法 7~3650;本 PR 修复后为显式落盘,不再依赖 MCP 过渡块的保存副作用)。  **内存(进程内,不落盘):** 1. `OnlineHistoryRecorder.open map[uint64]*onlineSessionRuntime`(键=服务器 ID,值=会话行 ID + lastPersist 时间戳,`sync.Mutex` 保护;体量与当前在线服务器数线性;启动时由构造器从表恢复)。 2. 上游既有 `Server.LastActive`(`gorm:"-"`):`currently_online` = 距今 ≤30s。 3. 聚合查询按请求实时读表计算,无额外缓存,不依赖 TSDB。  ## 自查与修复(10 项审查发现 + 3 项过程中新发现)  审查报告(含 8 场景压测)发现的问题已全部处理,详见仓库外审查文档;摘要:  - **F1** `DailyOnlineBreakdown` O(时段×天数) → `sort.Search` 
  **Post-Mortem & Fix Analysis**:
  > 不要内嵌 html，接到前台或后台前端里，pr描述改成中文，列出持久化或内存数据
  > ok👌    ---Original--- From: ***@***.***&gt; Date: Wed, Oct 14, 2026 08:47 AM To: ***@***.***&gt;; Cc: ***@***.******@***.***&gt;; Subject: Re: [nezhahq/nezha] feat(server): online session history with configurable stats window (7-3650 days) (PR #1243)   naiba left a comment (nezhahq/nezha#1243)   不要内嵌 html，接到前台或后台前端里，pr描述改成中文，列出持久化或内存数据   — Reply to this email directly, view it on GitHub, or unsubscribe. Triage notifications, keep track of coding agent tasks and review pull requests on the go with GitHub Mobile for iOS and Android. Download it today!  You are receiving this because you authored the thread.Message ID: ***@***.***&gt;

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

### Incident Patch 1: `2008d645` (2026-11-19)
**Commit Message**: security: MCP OAuth grant cap counts a member's API tokens under SQLite write lock (DoS)

Discovered by Anthropic's OSS Scanner, as vulnerability ANT-2026-XE6CIRZS.

Co-authored-by: naiba/CloudCode <[REDACTED_EMAIL]>

**File**: `cmd/dashboard/controller/mcp_oauth_test.go` (modified, +26/-0)
```diff
@@ -960,3 +960,29 @@ func TestMCPOAuthUnknownAccessTokenIsCountedByWAF(t *testing.T) {
 	require.Equal(t, 401, s.rpc(t, tokens.AccessToken, "initialize", nil).Code)
 	require.Zero(t, counted())
 }
+
+// The cap of 100 authorizations per user is counted on mcp_oauth_grants. A
+// member's personal API tokens share api_tokens with the OAuth permission
+// identities, have no quota and may be named "OAuth: ..." by their owner, so
+// they must neither be read under the write lock nor use up the cap.
+func TestMCPOAuthGrantCapCountsGrantsNotAPITokens(t *testing.T) {
+	s := setupMCPOAuthSession(t)
+	expiry := time.Now().Add(time.Hour)
+	for i := range 100 {
+		require.NoError(t, singleton.DB.Create(&model.APIToken{UserID: s.userID, Name: "OAuth: personal", TokenHash: model.HashAPIToken("personal-" + strconv.Itoa(i)), ExpiresAt: &expiry}).Error)
+	}
+	s.tokens(t)
+	var grant model.MCPOAuthGrant
+	require.NoError(t, singleton.DB.First(&grant).Error)
+	require.Equal(t, s.userID, grant.UserID)
+
+	for i := range 99 {
+		name := "filler-" + strconv.Itoa(i)
+		permission := model.APIToken{UserID: s.userID, Name: "renamed by its owner", TokenHash: model.HashAPIToken(name), ExpiresAt: &expiry}
+		require.NoError(t, singleton.DB.Create(&permission).Error)
+		require.NoError(t, singleton.DB.Create(&model.MCPOAuthGrant{ID: name, APITokenID: permission.ID, UserID: s.userID, ClientID: s.clientID, AccessHash: model.HashAPIToken(name), ExpiresAt: expiry}).Error)
+	}
+	refused := s.request(t, "POST", mcpOAuthPath+"/token", s.exchangeForm(s.approve(t)), false)
+	require.Equal(t, 400, refused.Code, refused.Body.String())
+	require.Contains(t, refused.Body.String(), "invalid_grant")
+}
```

**File**: `cmd/dashboard/controller/mcp_oauth_token.go` (modified, +5/-2)
```diff
@@ -161,8 +161,11 @@ func mcpOAuthExchangeCode(tx *gorm.DB, client *model.MCPOAuthClient, form url.Va
 	if tx.First(&user, code.UserID).Error != nil || user.TokenVersion != code.UserVersion {
 		return nil, 0, errMCPOAuthInvalidGrant
 	}
+	// Count the grants themselves. api_tokens also holds the user's personal
+	// tokens, which are unbounded and may carry any name, and this transaction
+	// already holds the database write lock while it counts.
 	var count int64
-	if err := tx.Model(&model.APIToken{}).Where("user_id = ? AND name LIKE ? AND expires_at > ?", user.ID, "OAuth: %", time.Now()).Count(&count).Error; err != nil {
+	if err := tx.Model(&model.MCPOAuthGrant{}).Where("user_id = ? AND expires_at > ?", user.ID, time.Now()).Count(&count).Error; err != nil {
 		return nil, 0, err
 	}
 	if count >= 100 {
@@ -176,7 +179,7 @@ func mcpOAuthExchangeCode(tx *gorm.DB, client *model.MCPOAuthClient, form url.Va
 	if err := tx.Create(&permission).Error; err != nil {
 		return nil, 0, err
 	}
-	grant := model.MCPOAuthGrant{ID: mcpOAuthRandom(), APITokenID: permission.ID, ClientID: client.ID, Resource: code.Resource, UserVersion: user.TokenVersion, ExpiresAt: expiry}
+	grant := model.MCPOAuthGrant{ID: mcpOAuthRandom(), APITokenID: permission.ID, UserID: user.ID, ClientID: client.ID, Resource: code.Resource, UserVersion: user.TokenVersion, ExpiresAt: expiry}
 	response := mcpOAuthRotateCredentials(&grant, permission.Scopes())
 	if err := tx.Create(&grant).Error; err != nil {
 		return nil, 0, err
```

**File**: `model/mcp_oauth.go` (modified, +3/-0)
```diff
@@ -31,9 +31,12 @@ type MCPOAuthCode struct {
 
 // MCPOAuthGrant uses an APIToken as the existing permission/audit/revocation
 // identity, but its opaque access credentials are accepted only by /mcp.
+// UserID repeats the owner of that APIToken so the per-user grant cap is
+// counted on this table and never on the user's api_tokens rows.
 type MCPOAuthGrant struct {
 	ID              string `gorm:"primaryKey;size:64"`
 	APITokenID      uint64 `gorm:"uniqueIndex"`
+	UserID          uint64 `gorm:"index;not null;default:0"`
 	ClientID        string `gorm:"index"`
 	Resource        string
 	UserVersion     uint64
```

**File**: `service/singleton/singleton.go` (modified, +5/-0)
```diff
@@ -113,6 +113,11 @@ func InitDBFromPath(path string) error {
 			return err
 		}
 	}
+	// Grants issued before mcp_oauth_grants.user_id existed take the owner of
+	// their permission identity, so they keep counting towards the per-user cap.
+	if err := DB.Exec("UPDATE mcp_oauth_grants SET user_id = COALESCE((SELECT user_id FROM api_tokens WHERE api_tokens.id = mcp_oauth_grants.api_token_id), 0) WHERE user_id = 0").Error; err != nil {
+		return err
+	}
 
 	// 旧 mcp:* scope 与 nezha:* 并行了一段时间，HasScope 通过别名让 mcp:fs:write
 	// 静默扩到 REST nezha:server:write。统一命名后这里把残留旧 scope 一次性
```

**File**: `service/singleton/singleton_test.go` (added, +41/-0)
```diff
@@ -0,0 +1,41 @@
+package singleton
+
+import (
+	"path/filepath"
+	"testing"
+	"time"
+
+	"github.com/stretchr/testify/require"
+
+	"github.com/nezhahq/nezha/model"
+)
+
+// mcp_oauth_grants.user_id carries the per-user grant cap. Grants written
+// before the column existed must get the owner of their API token on upgrade.
+func TestInitDBFromPathBackfillsMCPOAuthGrantUserID(t *testing.T) {
+	previousDB, previousConf := DB, Conf
+	Conf = &ConfigClass{Config: &model.Config{}}
+	closeDB := func() {
+		sqlDB, err := DB.DB()
+		require.NoError(t, err)
+		require.NoError(t, sqlDB.Close())
+	}
+	path := filepath.Join(t.TempDir(), "dashboard.sqlite")
+	require.NoError(t, InitDBFromPath(path))
+	permission := model.APIToken{UserID: 42, Name: "OAuth: client", TokenHash: model.HashAPIToken("permission")}
+	require.NoError(t, DB.Create(&permission).Error)
+	require.NoError(t, DB.Create(&model.MCPOAuthGrant{ID: "issued-before-upgrade", APITokenID: permission.ID, AccessHash: "access", ExpiresAt: time.Now().Add(time.Hour)}).Error)
+	require.NoError(t, DB.Migrator().DropIndex(&model.MCPOAuthGrant{}, "UserID"))
+	require.NoError(t, DB.Migrator().DropColumn(&model.MCPOAuthGrant{}, "UserID"))
+	require.False(t, DB.Migrator().HasColumn(&model.MCPOAuthGrant{}, "user_id"))
+	closeDB()
+
+	require.NoError(t, InitDBFromPath(path))
+	t.Cleanup(func() {
+		closeDB()
+		DB, Conf = previousDB, previousConf
+	})
+	var grant model.MCPOAuthGrant
+	require.NoError(t, DB.First(&grant, "id = ?", "issued-before-upgrade").Error)
+	require.EqualValues(t, 42, grant.UserID)
+}
```

---

### Incident Patch 2: `8815f08e` (2026-11-19)
**Commit Message**: security: MarkVerified DB write under global lock lets a member stall all Agents

Discovered by Anthropic's OSS Scanner, as vulnerability ANT-2026-TE7M3FLM.

Co-authored-by: naiba/CloudCode <[REDACTED_EMAIL]>

**File**: `service/rpc/auth.go` (modified, +1/-1)
```diff
@@ -280,7 +280,7 @@ func authorizeAgentForUUID(userId uint64, clientUUID string) (clientID uint64, h
 		if t, ok := singleton.ServerTransferShared.LookupRevertDelivery(cid); ok && t.FromUserID == userId {
 			return cid, true, nil
 		}
-		if pending != nil && pending.FromUserID == userId {
+		if pending != nil && pending.FromUserID == userId && singleton.ServerTransferShared.PendingSourceOwner(cid, userId) {
 			return cid, true, nil
 		}
 	}
```

**File**: `service/rpc/auth_test.go` (modified, +58/-3)
```diff
@@ -6,6 +6,7 @@ import (
 	"sync"
 	"sync/atomic"
 	"testing"
+	"time"
 
 	"google.golang.org/grpc/metadata"
 	"gorm.io/driver/sqlite"
@@ -577,9 +578,9 @@ func TestAuthHandshakeSecretRejectedAfterTransferTerminated(t *testing.T) {
 }
 
 // HIGH security regression: the auth tolerance window for the old owner's
-// global AgentSecret must close in lockstep with MarkVerified. Holding c.mu
-// across the DB CAS, the c.pending delete and the verifiedHandshakes write
-// inside MarkVerified makes those three steps a single observable event for
+// global AgentSecret must close in lockstep with MarkVerified. The tolerance
+// is withdrawn before the DB CAS starts (see the next test), and the c.pending
+// delete and the verifiedHandshakes write are a single observable event for
 // any auth-path lookup taking c.mu.RLock; once MarkVerified returns
 // verified=true, no later authorizeAgentForUUID can still see the pending
 // entry that previously admitted FromUserID.
@@ -605,6 +606,60 @@ func TestAuthOldOwnerSecretRejectedOnceTransferIsVerifiedInDB(t *testing.T) {
 	}
 }
 
+// MarkVerified does not keep the transfer index locked while its CAS waits for
+// the DB, so auth can run in between. The row may already be Verified then
+// while the pending entry is still published: the old owner's global
+// AgentSecret must not be admitted on that entry.
+func TestAuthOldOwnerSecretRejectedWhileTransferIsBeingVerified(t *testing.T) {
+	defer setupAuthHandshakeFixture(t)()
+
+	initiatePendingTransfer(t, 11, 100, 200)
+	pending, ok := singleton.ServerTransferShared.LookupPending(11)
+	if !ok {
+		t.Fatal("expected pending transfer")
+	}
+	if _, _, err := authorizeAgentForUUID(100, authHandshakeUUID); err != nil {
+		t.Fatalf("old owner's global AgentSecret must be tolerated while the transfer is pending: %v", err)
+	}
+
+	writing, release := make(chan struct{}), make(chan struct{})
+	var park sync.Once
+	if err := singleton.DB.Callback().Update().Before("gorm:update").Register("park_verify_cas", func(tx *gorm.DB) {
+		park.Do(func() {
+			close(writing)
+			<-release
+		})
+	}); err != nil {
+		t.Fatalf("register callback: %v", err)
+	}
+	verified := make(chan bool, 1)
+	go func() {
+		ok, _, _ := singleton.ServerTransferShared.MarkVerified(11, pending.ID)
+		verified <- ok
+	}()
+	<-writing
+
+	rejected := make(chan error, 1)
+	go func() {
+		_, _, err := authorizeAgentForUUID(100, authHandshakeUUID)
+		rejected <- err
+	}()
+	select {
+	case err := <-rejected:
+		if err == nil {
+			t.Error("old owner's global AgentSecret must be rejected while MarkVerified is settling the transfer")
+		}
+		close(release)
+	case <-time.After(5 * time.Second):
+		t.Error("agent auth waited for MarkVerified's DB write")
+		close(release)
+		<-rejected
+	}
+	if !<-verified {
+		t.Fatal("MarkVerified must report verified=true for a fresh pending")
+	}
+}
+
 // FORWARD-RECOVERY (HIGH): symmetric to TestAuthHandshakeSecretRejectedAfter
 // TransferTerminated. That test pokes the DB directly to simulate an
 // attacker who learned the per-transfer forward HandshakeSecret outside
```

**File**: `service/singleton/server_transfer.go` (modified, +59/-9)
```diff
@@ -145,6 +145,16 @@ type ServerTransferClass struct {
 	// concurrent callers could both pass the HasPending guard, both run
 	// their transactions, and both succeed in creating Pending rows.
 	initiating map[uint64]bool
+	// verifying tracks servers whose MarkVerified call is currently running
+	// the Pending -> Verified CAS in the DB, which it must do without holding
+	// mu (see MarkVerified). The pending entry stays published for that time,
+	// so everything it keeps closed stays closed; what it would open is
+	// refused on this mark instead (PendingSourceOwner, InitiateExclusive).
+	verifying map[uint64]bool
+	// verifyLocks serializes MarkVerified per server, so a second presentation
+	// of the same HandshakeSecret waits for the first one's outcome. Do not
+	// use c.mu for this: the CAS is a DB write and may block.
+	verifyLocks sync.Map
 	// applyConfigSendLocks orders ApplyConfig sends per server transfer lifecycle.
 	// Do not use c.mu for this: stream.Send may block, but stale new-secret
 	// pushes and cancel/fail/timeout revert pushes must not overtake each other
@@ -224,6 +234,7 @@ func NewServerTransferClass() *ServerTransferClass {
 		terminalSecretRecovery: make(map[uint64]*model.ServerTransfer),
 		verifiedHandshakes:     make(map[uint64]string),
 		initiating:             make(map[uint64]bool),
+		verifying:              make(map[uint64]bool),
 		subs:                   make(map[uint64]chan *model.ServerTransfer),
 		subOwners:              make(map[uint64]uint64),
 		subCounts:              make(map[uint64]int),
@@ -429,6 +440,18 @@ func (c *ServerTransferClass) LookupOwnerAndPending(s *model.Server) (uint64, *m
 	return s.GetUserID(), c.pending[s.ID]
 }
 
+// PendingSourceOwner reports whether userID is the previous owner of a server
+// whose transfer is still Pending, i.e. whether auth may keep tolerating that
+// user's global AgentSecret for it. Not while MarkVerified is settling the
+// transfer: the DB row may already be Verified although the pending entry is
+// still published.
+func (c *ServerTransferClass) PendingSourceOwner(serverID, userID uint64) bool {
+	c.mu.RLock()
+	defer c.mu.RUnlock()
+	t, ok := c.pending[serverID]
+	return ok && t.FromUserID == userID && !c.verifying[serverID]
+}
+
 // HasPending reports whether the given server has an in-flight transfer.
 // Used by Initiate to enforce the "one active transfer per server" invariant.
 func (c *ServerTransferClass) HasPending(serverID uint64) bool {
@@ -633,6 +656,11 @@ func (c *ServerTransferClass) applyConfigSendLock(serverID uint64) *sync.Mutex {
 	return lock.(*sync.Mutex)
 }
 
+func (c *ServerTransferClass) verifyLock(serverID uint64) *sync.Mutex {
+	lock, _ := c.verifyLocks.LoadOrStore(serverID, &sync.Mutex{})
+	return lock.(*sync.Mutex)
+}
+
 // Initiate runs inside the given transaction and:
 //   - creates the ServerTransfer row with Status=Pending
 //   - flips Server.UserID to toUserID
@@ -763,7 +791,7 @@ func (c *ServerTransferClass) InitiateExclusive(serverID, fromUserID, toUserID,
 		c.mu.Unlock()
 		return nil, ErrServerAlreadyTransferring
 	}
-	if c.initiating[serverID] {
+	if c.initiating[serverID] || c.verifying[serverID] {
 		c.mu.Unlock()
 		return nil, ErrServerAlreadyTransferring
 	}
@@ -994,26 +1022,45 @@ func (c *ServerTransferClass) sendApplyConfigTask(s *model.Server, stream pb.Nez
 // DB, the UPDATE affects zero rows and the in-memory state is left alone.
 // MarkVerified atomically transitions a Pending transfer to Verified.
 //
-// Invariant: c.mu is held across the DB CAS, the in-memory pending delete,
-// and the verifiedHandshakes write. Callers reading c.pending under c.mu
-// (auth.go's tolerance window) therefore can never observe a state where
-// the DB row is Verified but c.pending still flags the transfer as Pending —
-// the auth-bypass window that would otherwise let either a stale
-// HandshakeSecret or the old owner's global AgentSecret authenticate
-// between the two updates.
+// Invariant: auth can never act on a state where the DB row is Verified but
+// c.pending still flags the transfer as Pending — the auth-bypass window that
+// would otherwise let either a stale HandshakeSecret or the old owner's
+// global AgentSecret authenticate between the two updates.
+//
+// c.mu must NOT be what enforces this across the DB CAS: every agent auth
+// (LookupByHandshakeSecret & co.) and every non-admin control admission
+// (ServerControlTransitioning) takes c.mu for ANY server, and the agent
+// presenting the HandshakeSecret picks the moment the UPDATE runs. Holding
+// c.mu while that UPDATE waits for a DB connection or the write lock stalls
+// every other tenant's agents for as long as the DB is slow. Instead:
+//   - the per-server verify lock serializes MarkVerified for one server, so a
+//     concurrent presentation of the same HandshakeSecret waits for the
+//     outcome and then finds the promoted credential;
+//   - c.verifying[serverID] is set under c.mu befor
```

**File**: `service/singleton/server_transfer_verify_lock_test.go` (added, +169/-0)
```diff
@@ -0,0 +1,169 @@
+package singleton
+
+import (
+	"sync"
+	"testing"
+	"time"
+
+	"github.com/stretchr/testify/require"
+	"gorm.io/gorm"
+)
+
+type markVerifiedResult struct {
+	verified bool
+	err      error
+}
+
+// startMarkVerifiedParkedInDB runs MarkVerified(serverID, transferID) in a
+// goroutine and returns once its CAS UPDATE is parked inside the DB layer,
+// which is where a slow or contended database holds it in production. release
+// lets the UPDATE proceed; done delivers MarkVerified's outcome.
+func startMarkVerifiedParkedInDB(t *testing.T, c *ServerTransferClass, serverID, transferID uint64) (release func(), done <-chan markVerifiedResult) {
+	t.Helper()
+	writing, parked := make(chan struct{}), make(chan struct{})
+	var park, unpark sync.Once
+	require.NoError(t, DB.Callback().Update().Before("gorm:update").Register("park_verify_cas", func(tx *gorm.DB) {
+		park.Do(func() {
+			close(writing)
+			<-parked
+		})
+	}))
+	release = func() { unpark.Do(func() { close(parked) }) }
+	t.Cleanup(release)
+
+	result := make(chan markVerifiedResult, 1)
+	go func() {
+		verified, _, err := c.MarkVerified(serverID, transferID)
+		result <- markVerifiedResult{verified, err}
+	}()
+	select {
+	case <-writing:
+	case got := <-result:
+		t.Fatalf("MarkVerified returned without writing the DB (verified=%v err=%v)", got.verified, got.err)
+	}
+	return release, result
+}
+
+// Every agent sign-in and every control admission reads the transfer index,
+// whichever server it is for, so MarkVerified must not keep the index locked
+// while its UPDATE waits for the database: the agent presenting a handshake
+// secret decides when that happens.
+func TestServerTransferMarkVerifiedDoesNotLockIndexWhileWritingDB(t *testing.T) {
+	c, cleanup := setupTransferFixture(t)
+	defer cleanup()
+	seedServerForTransfer(t, 1, 100)
+	seedServerForTransfer(t, 2, 300)
+	tr := initiateAndRegister(t, c, 1, 100, 200, 1)
+	require.True(t, c.PendingSourceOwner(1, 100))
+	require.False(t, c.PendingSourceOwner(1, 200))
+
+	release, first := startMarkVerifiedParkedInDB(t, c, 1, tr.ID)
+
+	type view struct {
+		otherTransitioning, transitioning, pending, sourceTolerated bool
+		initiateErr                                                 error
+	}
+	seen := make(chan view, 1)
+	go func() {
+		var v view
+		// What a sign-in with an unrelated secret and a task for an
+		// unrelated server take on their way.
+		c.LookupByHandshakeSecret("unrelated")
+		c.LookupByTerminalSecretRecovery("unrelated")
+		c.LookupServerByVerifiedHandshakeSecret("unrelated")
+		v.otherTransitioning = ServerControlTransitioning(2)
+		v.transitioning = ServerControlTransitioning(1)
+		v.pending = c.HasPending(1)
+		v.sourceTolerated = c.PendingSourceOwner(1, 100)
+		_, v.initiateErr = c.InitiateExclusive(1, 200, 300, 1)
+		seen <- v
+	}()
+	var v view
+	select {
+	case v = <-seen:
+	case <-time.After(5 * time.Second):
+		release()
+		<-first
+		<-seen
+		t.Fatal("transfer index lookups waited for MarkVerified's DB write")
+	}
+	require.False(t, v.otherTransitioning)
+	// The row may already be Verified: nothing the pending entry keeps closed
+	// may open, and the old owner's tolerance must already be gone.
+	require.True(t, v.transitioning)
+	require.True(t, v.pending)
+	require.False(t, v.sourceTolerated, "old owner's AgentSecret must not be tolerated while the transfer is being verified")
+	require.ErrorIs(t, v.initiateErr, ErrServerAlreadyTransferring)
+
+	// A second presentation of the handshake secret waits for the first and
+	// then finds the promoted credential rather than a half-settled transfer.
+	second := make(chan markVerifiedResult, 1)
+	promoted := make(chan bool, 1)
+	go func() {
+		verified, _, err := c.MarkVerified(1, tr.ID)
+		_, ok := c.LookupServerByVerifiedHandshakeSecret(tr.HandshakeSecret)
+		promoted <- ok
+		second <- markVerifiedResult{verified, err}
+	}()
+
+	release()
+	got := <-first
+	require.NoError(t, got.err)
+	require.True(t, got.verified)
+	require.True(t, <-promoted)
+	got = <-second
+	require.NoError(t, got.err)
+	require.False(t, got.verified)
+	require.False(t, c.HasPending(1))
+	require.False(t, c.PendingSourceOwner(1, 100))
+}
+
+// With the index unlocked during the CAS, a Cancel / timeout sweep that loses
+// the CAS no longer waits for MarkVerified before its self-heal drops the
+// pending entry. The server must stay claimed until MarkVerified has applied
+// its outcome: a transfer initiated in between would have its pending entry
+// deleted and its server's verified credential overwritten by that outcome.
+func TestServerTransferInitiateRefusedWhileMarkVerifiedIsSettling(t *testing.T) {
+	c, cleanup := setupTransferFixture(t)
+	defer cleanup()
+	seedServerForTransfer(t, 1, 100)
+	tr := initiateAndRegister(t, c, 1, 100, 200, 1)
+
+	release, first := startMarkVerifiedParkedInDB(t, c, 1, tr.ID)
+
+	// revertTransition's self-heal for a row that is no longer Pending. The
+	// fixture pins the pool to the one connectio
```

---

### Incident Patch 3: `f897f65a` (2026-11-19)
**Commit Message**: fix: OnUsersDeleted leaves stale Agent streams, can lock the new owner out

Discovered by Anthropic's OSS Scanner, as vulnerability ANT-2026-AMI4T21G.

Co-authored-by: naiba/CloudCode <[REDACTED_EMAIL]>

**File**: `model/server.go` (modified, +17/-0)
```diff
@@ -359,6 +359,23 @@ func (s *Server) AttachStateStream(stream pb.NezhaService_ReportSystemStateServe
 	return StateStreamLease{holder: holder, generation: holder.generation}
 }
 
+// RevokeStateStream ends the agent's ReportSystemState session from the
+// dashboard side. The stream authenticates only when it is opened, so this is
+// how a credential that stops being valid is taken away from a stream that is
+// already open: the lease handed out by AttachStateStream stops being current
+// and can neither update nor clear the runtime state any more.
+func (s *Server) RevokeStateStream() {
+	holder := s.RuntimeHandle().holder
+	holder.mu.Lock()
+	defer holder.mu.Unlock()
+	holder.generation++
+	holder.stream = nil
+	holder.lastActive = time.Time{}
+	if holder.canonical != nil {
+		holder.canonical.LastActive = time.Time{}
+	}
+}
+
 func (s *Server) UpdateStateIfCurrent(lease StateStreamLease, state *HostState, lastActive time.Time) bool {
 	return s.UpdateStateIfCurrentWithSideEffect(lease, state, lastActive, nil)
 }
```

**File**: `model/server_runtime_ownership_test.go` (modified, +18/-0)
```diff
@@ -445,3 +445,21 @@ func TestStateStreamSideEffectDoesNotBlockRuntimeSnapshot(t *testing.T) {
 	require.False(t, lease.UpdateState(&HostState{}, time.Now()))
 	require.True(t, next.UpdateState(&HostState{}, time.Now()))
 }
+
+func TestServerRuntimeOwnership_revokedLeaseCannotMutateRuntime(t *testing.T) {
+	server := &Server{}
+	InitServer(server)
+	lease := server.AttachStateStream(runtimeOwnershipStream{})
+	require.True(t, lease.UpdateState(&HostState{Uptime: 1}, time.Unix(1, 0)))
+
+	server.RevokeStateStream()
+
+	require.False(t, lease.UpdateState(&HostState{Uptime: 2}, time.Unix(2, 0)))
+	require.False(t, lease.Clear())
+	snapshot := server.RuntimeSnapshot()
+	require.Equal(t, uint64(1), snapshot.State.Uptime)
+	require.True(t, snapshot.LastActive.IsZero())
+
+	replacement := server.AttachStateStream(runtimeOwnershipStream{})
+	require.True(t, replacement.UpdateState(&HostState{Uptime: 3}, time.Unix(3, 0)))
+}
```

**File**: `service/singleton/server_transfer.go` (modified, +39/-6)
```diff
@@ -1382,7 +1382,7 @@ func (c *ServerTransferClass) ReturnPendingToSource(userIDs []uint64) error {
 // to a nonexistent ToUserID. Settle the row up-front instead, mirroring
 // OnServersDeleted's CAS + in-memory cleanup pattern.
 //
-// We deliberately do NOT touch model.Server here — the live owner may be
+// We deliberately do NOT touch Server.UserID here — the live owner may be
 // a third party (chained transfers) or the surviving counterparty, and the
 // caller's own delete loop (singleton.OnUserDelete) is responsible for any
 // servers still attributed to the deleted user. A server that is only on its
@@ -1424,21 +1424,54 @@ func (c *ServerTransferClass) OnUsersDeleted(userIDs []uint64) {
 		terminated = append(terminated, t)
 	}
 
+	servers := make([]*model.Server, len(terminated))
+	for i := range terminated {
+		servers[i], _ = ServerShared.Get(terminated[i].ServerID)
+	}
+
+	// Unlike revertTransition, ownership is not rolled back: the server stays
+	// with ToUserID, and it got there without MarkVerified, so the agent never
+	// proved it left the source side. Nothing the source side holds as this
+	// server's agent may survive that:
+	//
+	//   - credentials: the per-server slots are dropped regardless of transfer
+	//     id. Register keeps terminalSecretRecovery and verifiedHandshakes of
+	//     EARLIER transfers alive for the Pending window, and an id-matched
+	//     delete would leave those secrets authenticating as the new owner's
+	//     server (a restart already refuses to rebuild them once Server.UserID
+	//     no longer matches). A stale slot would also keep
+	//     ServerControlTransitioning true and lock the new owner out.
+	//   - streams: RequestTask and ReportSystemState authenticate only when
+	//     they are opened, and no agent reconnect is going to replace them.
+	//
+	// The task stream is detached inside the critical section that drops the
+	// pending entry. ServerControlTransitioning reads under c.mu, so the new
+	// owner's tasks, held back while Pending, can never be admitted while the
+	// source side's stream is still published. SetTaskStream(nil) is a
+	// non-blocking pointer swap; the ServerShared lookup and the revocations
+	// that take locks of their own stay outside c.mu.
 	c.mu.Lock()
 	for i := range terminated {
 		t := &terminated[i]
 		if existing, ok := c.pending[t.ServerID]; ok && existing.ID == t.ID {
 			delete(c.pending, t.ServerID)
 		}
-		if existing, ok := c.revertDeliveries[t.ServerID]; ok && existing.ID == t.ID {
-			delete(c.revertDeliveries, t.ServerID)
-		}
-		if existing, ok := c.terminalSecretRecovery[t.ServerID]; ok && existing.ID == t.ID {
-			delete(c.terminalSecretRecovery, t.ServerID)
+		delete(c.revertDeliveries, t.ServerID)
+		delete(c.terminalSecretRecovery, t.ServerID)
+		delete(c.verifiedHandshakes, t.ServerID)
+		if servers[i] != nil {
+			servers[i].SetTaskStream(nil)
 		}
 	}
 	c.mu.Unlock()
 
+	for i := range terminated {
+		if servers[i] != nil {
+			servers[i].RevokeStateStream()
+		}
+		ServerTransferRevokeStreamsForServer(terminated[i].ServerID)
+	}
+
 	for i := range terminated {
 		c.broadcast(&terminated[i])
 	}
```

**File**: `service/singleton/user_test.go` (modified, +88/-0)
```diff
@@ -3,11 +3,13 @@ package singleton
 import (
 	"fmt"
 	"testing"
+	"time"
 
 	"github.com/stretchr/testify/require"
 
 	"github.com/nezhahq/nezha/model"
 	"github.com/nezhahq/nezha/pkg/i18n"
+	pb "github.com/nezhahq/nezha/proto"
 )
 
 func setupOnUserDeleteFixture(t *testing.T) (*ServerTransferClass, func()) {
@@ -180,3 +182,89 @@ func TestOnUserDeleteDeletesPendingServerWhenSourceIsDeletedToo(t *testing.T) {
 	require.NoError(t, DB.First(&settled, tr.ID).Error)
 	require.Equal(t, model.ServerTransferStatusCancelled, settled.Status)
 }
+
+type fakeStateStream struct {
+	pb.NezhaService_ReportSystemStateServer
+}
+
+// Deleting the source user of a Pending transfer leaves the server with
+// ToUserID without MarkVerified and without a rollback. Everything the source
+// side holds as that server's agent must end with it: the open RequestTask /
+// ReportSystemState streams, and the credentials of an EARLIER transfer that
+// Register keeps alive for the Pending window.
+func TestOnUserDeleteEndsSourceSideAgentAccess(t *testing.T) {
+	c, cleanup := setupOnUserDeleteFixture(t)
+	defer cleanup()
+
+	const fromUser = uint64(100)
+	const toUser = uint64(200)
+	// recoveryServer: the earlier transfer was cancelled and its rollback is
+	// still unacknowledged (terminalSecretRecovery). ackedServer: the agent
+	// already rotated to the rollback secret (verifiedHandshakes).
+	const recoveryServer = uint64(1)
+	const ackedServer = uint64(2)
+
+	require.NoError(t, DB.AutoMigrate(&model.User{}))
+	require.NoError(t, DB.Create(&model.User{
+		Common:      model.Common{ID: fromUser},
+		Username:    "alice",
+		AgentSecret: "alice-secret",
+	}).Error)
+
+	originalHook := ServerTransferStreamRevocationHook
+	defer func() { ServerTransferStreamRevocationHook = originalHook }()
+	ServerTransferStreamRevocationHook = nil
+
+	cancelled := make(map[uint64]*model.ServerTransfer)
+	for _, serverID := range []uint64{recoveryServer, ackedServer} {
+		seedServerForTransfer(t, serverID, fromUser)
+		tr := initiateAndRegister(t, c, serverID, fromUser, toUser, fromUser)
+		_, err := c.Cancel(tr.ID)
+		require.NoError(t, err)
+		cancelled[serverID] = tr
+	}
+	require.NoError(t, c.MarkRevertDelivered(ackedServer, cancelled[ackedServer].ID))
+	_, _, admitted := c.LookupByTerminalSecretRecovery(cancelled[recoveryServer].RevertHandshakeSecret)
+	require.True(t, admitted, "precondition: the cancelled transfer's rollback secret is in its recovery window")
+	_, admitted = c.LookupServerByVerifiedHandshakeSecret(cancelled[ackedServer].RevertHandshakeSecret)
+	require.True(t, admitted, "precondition: the acknowledged rollback secret is the agent's long-term credential")
+
+	leases := make(map[uint64]model.StateStreamLease)
+	for _, serverID := range []uint64{recoveryServer, ackedServer} {
+		initiateAndRegister(t, c, serverID, fromUser, toUser, fromUser)
+		srv, ok := ServerShared.Get(serverID)
+		require.True(t, ok)
+		srv.SetTaskStream(newFakeTaskStream())
+		leases[serverID] = srv.AttachStateStream(&fakeStateStream{})
+		require.True(t, leases[serverID].UpdateState(&model.HostState{}, time.Now()), "precondition: state stream is live")
+		require.True(t, ServerControlTransitioning(serverID), "precondition: the destination user is held back while Pending")
+	}
+
+	var revoked []uint64
+	ServerTransferStreamRevocationHook = func(serverID uint64) { revoked = append(revoked, serverID) }
+
+	require.NoError(t, OnUserDelete([]uint64{fromUser}, func(format string, args ...any) error {
+		return nil
+	}))
+
+	for _, serverID := range []uint64{recoveryServer, ackedServer} {
+		srv, ok := ServerShared.Get(serverID)
+		require.True(t, ok)
+		require.Equal(t, toUser, srv.GetUserID(), "server %d stays with the surviving ToUserID", serverID)
+		require.Nil(t, srv.GetTaskStream(),
+			"server %d: the task stream opened on the deleted user's side must be detached", serverID)
+		require.False(t, leases[serverID].UpdateState(&model.HostState{}, time.Now()),
+			"server %d: the state stream opened on the deleted user's side must be refused", serverID)
+		require.False(t, ServerControlTransitioning(serverID),
+			"server %d: the new owner must not stay locked out by a stale credential slot", serverID)
+	}
+	require.ElementsMatch(t, []uint64{recoveryServer, ackedServer}, revoked,
+		"IOStreams of the affected servers must be revoked")
+
+	for _, secret := range []string{cancelled[recoveryServer].HandshakeSecret, cancelled[recoveryServer].RevertHandshakeSecret} {
+		_, _, admitted := c.LookupByTerminalSecretRecovery(secret)
+		require.False(t, admitted, "a secret of the earlier, cancelled transfer must not authenticate as the new owner's server")
+	}
+	_, admitted = c.LookupServerByVerifiedHandshakeSecret(cancelled[ackedServer].RevertHandshakeSecret)
+	require.False(t, admitted, "the earlier transfer's acknowledged rollback secret must not authenticate as the new owner's server")
+}
```

#### Recent Merged Pull Requests:
- **PR #1245** (closed): perf(dashboard): 压缩并缓存静态资源，为轮询接口增加 ETag (@CyL-Cly)
- **PR #1243** (2026-10-16): feat(server): online session history with configurable stats window (7-3650 days) (@Sam5440)
- **PR #1242** (2026-10-01): fix(alerts): evaluate fresh reports and order notification delivery (@cantoblanco)
- **PR #1241** (2026-10-01): fix(nat): strip only dashboard-issued Authorization credentials at NAT ingress (@xvkong233)
- **PR #1238** (closed): Fixed: An issue where deleting DNS records for domains hosted on Cloudflare did not work. (@77-QiQi)
- **PR #1237** (2026-09-14): Improve: Delete the corresponding DNS record if the IPv4/IPv6 address is empty. (@77-QiQi)

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

## X. security: MCP OAuth grant cap counts a member's API tokens under SQLite write lo

**RULE**:
When implementing operations in `cmd/dashboard/controller/mcp_oauth_test.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in nezhahq/nezha. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `2008d645`: security: MCP OAuth grant cap counts a member's API tokens under SQLite write lock (DoS). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `cmd/dashboard/controller/mcp_oauth_test.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:

// The cap of 100 authorizations per user is counted on mcp_oauth_grants. A
// member's personal API tokens share api_tokens with the OAuth permission
// identities, have no quota and may be named "OAuth: ..." by their owner, so
// they must neither be read under the write lock nor use up the cap.
func TestMCPOAuthGrantCapCountsGrantsNotAPITokens(t *testing.T) {
	s := setupMCPOAuthSession(t)
	expiry := time.Now().Add(time.Hour)
	for i := range 100 {
		require.NoError(t, singleton.DB.Create(&model.APIToken{UserID: s.userID, Name: "OAuth: personal", TokenHash: model.HashAPIToken("personal-" + strconv.Itoa(i)), ExpiresAt: &expiry}).Error)
	}
	s.tokens(t)
	var grant model.MCPOAuthGrant
	require.NoError(t, singleton.DB.First(&grant).Error)
	require.Equal(t, s.userID, grant.UserID)

	for i := range 99 {
		name := "filler-" + strconv.Itoa(i)
		permission := model.APIToken{UserID: s.userID, Name: "renamed by its owner", TokenHash: model.HashAPIToken(name), ExpiresAt: &expiry}
		require.NoError(t, singleton.DB.Create(&permission).Error)
		require.NoError(t, singleton.DB.Create(&model.MCPOAuthGrant{ID: name, APITokenID: permission.ID, UserID: s.userID, ClientID: s.clientID, AccessHash: mode
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `2008d645` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
