# Domain G — Architecture Intelligence: Architecture Intelligence: nezhahq-nezha-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "nezhahq-nezha-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-19T01:06:11.540Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-nezhahq-nezha-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [nezhahq-nezha-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-19T01:06:11.540Z`  
> **Learning ID**: `LEARN-EVO-nezhahq-nezha-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain G (Architecture Intelligence)
- **Secondary Corroborating Domains**: H (Technical Construction Intelligence), M (Feedback & Evolution Intelligence), D (Research & Knowledge Intelligence), K (Quality & Verification Intelligence), I (Content & Information Intelligence), J (Search & Distribution Intelligence), L (Deployment & Operations Intelligence)
- **Confidence Rating**: 64%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from nezhahq-nezha-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/nezhahq-nezha-learnings.md`  
> **Source**: github ([https://github.com/nezhahq/nezha](https://github.com/nezhahq/nezha))  
> **Source Version**: `8bcaf092`  
> **License**: WTFPL  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-19T01:06:01.890Z  
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
> **Harvest Timestamp**: 2026-11-19T01:06:01.885Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `nezhahq/nezha`
- **Description**: :trollface: Self-hosted, lightweight server and website monitoring and O&M tool
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 10420 stars

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
				return nil, fmt.Errorf("failed to update a domain: %s. Cause by: %v", provider.domain, err)
			}
			resp, err := client.Do(req)
			if err != nil {
				return nil, fmt.Errorf("failed to update a domain: %s. Cause by: %v", provider.domain, err)
			}
			_, _ = io.Copy(io.Discard, resp.Body)
			resp.Body.Close()
		default:
			return nil, fmt.Errorf("unsupported record type: %T", rec)
		}
	}

	return recs, nil
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

	headers, err := utils.GjsonIter(
		provider.formatWebhookString(provider.DDNSProfile.WebhookHeaders))
	if err != nil {
		return nil, nil, err
	}

	req, err := http.NewRequestWithContext(ctx, requestTypes[provider.DDNSProfile.WebhookMethod], u.String(), strings.NewReader(body))
	if err != nil {
		return nil, nil, err
	}

	provider.setContentType(req)

	for k, v := range headers {
		req.Header.Set(k, v)
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
			vals[n] = provider.formatWebhookString(v)
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
		return provider.formatWebhookString(provider.DDNSProfile.WebhookRequestBody), nil
	case requestTypeForm:
		data, err := utils.GjsonIter(provider.DDNSProfile.WebhookRequestBody)
		if err != nil {
			return "", err
		}
		params := url.Values{}
		for k, v := range data {
			params.Add(k, provider.formatWebhookString(v))
		}
		return params.Encode(), nil
	default:
		return "", errors.New("request type not supported")
	}
}

func (provider *Provider) formatWebhookString(s string) string {
	r := strings.NewReplacer(
		"#ip#", provider.ipAddr,
		"#domain#", provider.domain,
		"#type#", provider.ipType,
		"#record#", provider.recordType,
		"#access_id#", provider.DDNSProfile.AccessID,
		"#access_secret#", provider.DDNSProfile.AccessSecret,
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

### Core Architecture Module: `pkg/utils/gjson.go`
```
package utils

import (
	"errors"
	"iter"

	"github.com/tidwall/gjson"
)

var (
	ErrGjsonWrongType = errors.New("wrong type")
)

var emptyIterator = func(yield func(string, string) bool) {}

func GjsonIter(json string) (iter.Seq2[string, string], error) {
	if json == "" {
		return emptyIterator, nil
	}

	result := gjson.Parse(json)
	if !result.IsObject() {
		return nil, ErrGjsonWrongType
	}

	return ConvertSeq2(result.ForEach, func(k, v gjson.Result) (string, string) {
		return k.String(), v.String()
	}), nil
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

### Incident Patch 1: `8bcaf092` (2026-11-18)
**Commit Message**: security: bound persisted resource reference collections

Members could inflate JSON reference collections that are persisted,
re-parsed in AfterFind, kept in memory, copied on every list request
and fanned out at runtime (GHSA-8fgr-wx8p-v6q7):

- skip_servers / alert rule ignore: false entries were never checked
- ddns_profiles, trigger tasks, cron servers: duplicate IDs passed the
  existence checks, making UpdateDDNS spawn one outbound DNS update per
  duplicate and SendTriggerTasks fire the same cron repeatedly
- nonexistent server / cron IDs in allow-sets passed class.CheckPermission
- override_ddns_domains was not validated at all
- DDNS domains and alert sub-rules had no count limit
- /api/v1 request bodies had no size limit

Normalize every collection before permission checks (dedupe, drop false
entries, drop unknown IDs from allow-sets, keep deny-sets strict), apply
IDN validation and limits to override domains, cap domains per profile
and sub-rules per alert rule, limit /api/v1 bodies to 1 MiB, and
normalize again in AfterFind so already-persisted bloat is collapsed on
load.

Co-authored-by: naiba/CloudCode <[REDACTED_EMAIL]>

**File**: `cmd/dashboard/controller/alertrule.go` (modified, +4/-0)
```diff
@@ -170,6 +170,10 @@ func validateRule(c *gin.Context, r *model.AlertRule) error {
 	if !r.HasPermission(c) {
 		return singleton.Localizer.ErrorT("permission denied")
 	}
+	// 规范化必须先于 trigger task 权限校验（GHSA-8fgr-wx8p-v6q7）。
+	if err := normalizeAlertRuleReferences(r); err != nil {
+		return err
+	}
 	if len(r.Rules) > 0 {
 		for _, rule := range r.Rules {
 			if rule == nil {
```

**File**: `cmd/dashboard/controller/controller.go` (modified, +3/-1)
```diff
@@ -85,7 +85,9 @@ func routers(r *gin.Engine, frontendDist fs.FS) {
 	r.POST("/mcp/upload/:token", mcpOriginGuard(), transferUploadHandler)
 	registerAgentcompatRoutes(r)
 
-	api := r.Group("api/v1")
+	// 所有 /api/v1 请求体统一限长：ShouldBindJSON 会完整读取请求体
+	// （GHSA-8fgr-wx8p-v6q7）。
+	api := r.Group("api/v1", restRequestBodyLimitMiddleware(restAPIRequestMaxBodyBytes))
 	api.POST("/login", authMiddleware.LoginHandler)
 
 	fallbackAuthMw := fallbackAuthMiddleware(authMiddleware)
```

**File**: `cmd/dashboard/controller/cron.go` (modified, +4/-0)
```diff
@@ -55,6 +55,8 @@ func createCron(c *gin.Context) (uint64, error) {
 	if err := c.ShouldBindJSON(&cf); err != nil {
 		return 0, err
 	}
+	// 见 resource_reference_limits.go（GHSA-8fgr-wx8p-v6q7）。
+	cf.Servers = normalizeCronServers(cf.Cover, cf.Servers)
 
 	if !isValidCronCover(cf.Cover) {
 		return 0, singleton.Localizer.ErrorT("permission denied")
@@ -140,6 +142,8 @@ func updateCron(c *gin.Context) (any, error) {
 	if err := c.ShouldBindJSON(&cf); err != nil {
 		return 0, err
 	}
+	// 见 resource_reference_limits.go（GHSA-8fgr-wx8p-v6q7）。
+	cf.Servers = normalizeCronServers(cf.Cover, cf.Servers)
 
 	if !isValidCronCover(cf.Cover) {
 		return nil, singleton.Localizer.ErrorT("permission denied")
```

**File**: `cmd/dashboard/controller/ddns.go` (modified, +10/-15)
```diff
@@ -6,7 +6,6 @@ import (
 
 	"github.com/gin-gonic/gin"
 	"github.com/jinzhu/copier"
-	"golang.org/x/net/idna"
 
 	"github.com/nezhahq/nezha/model"
 	"github.com/nezhahq/nezha/service/singleton"
@@ -82,14 +81,12 @@ func createDDNS(c *gin.Context) (uint64, error) {
 	p.WebhookRequestBody = df.WebhookRequestBody
 	p.WebhookHeaders = df.WebhookHeaders
 
-	for n, domain := range p.Domains {
-		// IDN to ASCII
-		domainValid, domainErr := idna.Lookup.ToASCII(domain)
-		if domainErr != nil {
-			return 0, singleton.Localizer.ErrorT("error parsing %s: %v", domain, domainErr)
-		}
-		p.Domains[n] = domainValid
+	// IDN→ASCII、去重并限制数量（GHSA-8fgr-wx8p-v6q7）。
+	domains, err := normalizeDDNSDomains(p.Domains)
+	if err != nil {
+		return 0, err
 	}
+	p.Domains = domains
 
 	if err := singleton.DB.Create(&p).Error; err != nil {
 		return 0, newGormError("%v", err)
@@ -163,14 +160,12 @@ func updateDDNS(c *gin.Context) (any, error) {
 		p.WebhookRequestBody = df.WebhookRequestBody
 	}
 
-	for n, domain := range p.Domains {
-		// IDN to ASCII
-		domainValid, domainErr := idna.Lookup.ToASCII(domain)
-		if domainErr != nil {
-			return nil, singleton.Localizer.ErrorT("error parsing %s: %v", domain, domainErr)
-		}
-		p.Domains[n] = domainValid
+	// IDN→ASCII、去重并限制数量（GHSA-8fgr-wx8p-v6q7）。
+	domains, err := normalizeDDNSDomains(p.Domains)
+	if err != nil {
+		return nil, err
 	}
+	p.Domains = domains
 
 	if err = singleton.DB.Save(&p).Error; err != nil {
 		return nil, newGormError("%v", err)
```

**File**: `cmd/dashboard/controller/resource_reference_limits.go` (added, +158/-0)
```diff
@@ -0,0 +1,158 @@
+package controller
+
+import (
+	"net/http"
+
+	"github.com/gin-gonic/gin"
+	"golang.org/x/net/idna"
+
+	"github.com/nezhahq/nezha/model"
+	"github.com/nezhahq/nezha/service/singleton"
+)
+
+// 写入侧的资源引用规范化与上限（GHSA-8fgr-wx8p-v6q7）。
+//
+// 低权限成员曾可以用以下方式把落库 JSON 撑到任意大小：
+//   - 值为 false 的 skip_servers / rule.ignore 条目（权限校验只看 true）
+//   - 重复的 ddns_profiles / trigger task / cron servers ID（存在性校验不去重）
+//   - 不存在的 server / cron ID（通用 class.CheckPermission 跳过缺失 ID）
+//   - 完全未校验的 override_ddns_domains、无数量上限的 domains / rules
+//
+// 规范化必须发生在权限校验之前，后续校验与落库都基于规范化后的集合，
+// 这样集合大小被真实对象数量约束，而不是被请求体大小约束。
+
+const (
+	// restAPIRequestMaxBodyBytes 是 /api/v1 下所有请求体的上限。最大的合法
+	// 请求是管理员的自定义代码设置，远小于该值。
+	restAPIRequestMaxBodyBytes = 1 << 20
+	// maxDomainsPerDDNSProfile 同时约束 DDNS profile 的 domains 与 server 的
+	// 单个 profile 覆盖域名列表；每个域名都会触发一次外部 DNS 更新。
+	maxDomainsPerDDNSProfile = 256
+	// maxRulesPerAlertRule 约束单条告警的子规则数；每个上报样本都会为每条
+	// 子规则保存一份数据并逐条求值。
+	maxRulesPerAlertRule = 64
+)
+
+// restRequestBodyLimitMiddleware 在 handler 解析请求体前装上 MaxBytesReader。
+// 必须挂在路由组上：gin 的 ShouldBindJSON 会完整读取请求体。
+func restRequestBodyLimitMiddleware(maxBytes int64) gin.HandlerFunc {
+	return func(c *gin.Context) {
+		if c.Request.Body != nil && c.Request.Body != http.NoBody {
+			c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBytes)
+		}
+		c.Next()
+	}
+}
+
+// existingServerIDs 去重并丢弃不存在的 server。仅用于 allow-set 语义的集合：
+// 不存在的 server 不会被调度，丢弃它们不改变行为。deny-set 语义的集合由
+// denyListOwnedByCaller 严格要求存在，不走这里。
+func existingServerIDs(ids []uint64) []uint64 {
+	ids = model.UniqueIDs(ids)
+	if ids == nil {
+		return nil
+	}
+	existing := make([]uint64, 0, len(ids))
+	for _, id := range ids {
+		if s, ok := singleton.ServerShared.Get(id); ok && s != nil {
+			existing = append(existing, id)
+		}
+	}
+	return existing
+}
+
+func existingServerIDSet(set map[uint64]bool) map[uint64]bool {
+	enabled := model.EnabledIDSet(set)
+	for id := range enabled {
+		if s, ok := singleton.ServerShared.Get(id); !ok || s == nil {
+			delete(enabled, id)
+		}
+	}
+	return enabled
+}
+
+// existingCronIDs 去重并丢弃不存在的 cron：SendTriggerTasks 本就跳过缺失 ID。
+func existingCronIDs(ids []uint64) []uint64 {
+	ids = model.UniqueIDs(ids)
+	if ids == nil {
+		return nil
+	}
+	existing := make([]uint64, 0, len(ids))
+	for _, id := range ids {
+		if cr, ok := singleton.CronShared.Get(id); ok && cr != nil {
+			existing = append(existing, id)
+		}
+	}
+	return existing
+}
+
+// normalizeDDNSDomains 做 IDN→ASCII、去重并限制数量。
+func normalizeDDNSDomains(domains []string) ([]string, error) {
+	if len(domains) > maxDomainsPerDDNSProfile {
+		return nil, singleton.Localizer.ErrorT("too many domains, at most %d", maxDomainsPerDDNSProfile)
+	}
+	if domains == nil {
+		return nil, nil
+	}
+	seen := make(map[string]struct{}, len(domains))
+	normalized := make([]string, 0, len(domains))
+	for _, domain := range domains {
+		ascii, err := idna.Lookup.ToASCII(domain)
+		if err != nil {
+			return nil, singleton.Localizer.ErrorT("error parsing %s: %v", domain, err)
+		}
+		if _, ok := seen[ascii]; ok {
+			continue
+		}
+		seen[ascii] = struct{}{}
+		normalized = append(normalized, ascii)
+	}
+	return normalized, nil
+}
+
+// normalizeOverrideDDNSDomains 只保留已绑定 profile 的覆盖域名，并按 profile
+// 域名同样的规则校验。此前该字段完全未校验，绕过了 createDDNS 的 IDN 校验。
+func normalizeOverrideDDNSDomains(overrides map[uint64][]string, profiles []uint64) (map[uint64][]string, error) {
+	pruned := model.PruneOverrideDDNSDomains(overrides, profiles)
+	for id, domains := range pruned {
+		normalized, err := normalizeDDNSDomains(domains)
+		if err != nil {
+			return nil, err
+		}
+		pruned[id] = normalized
+	}
+	return pruned, nil
+}
+
+func normalizeServiceReferences(m *model.Service) {
+	if m.Cover == model.ServiceCoverIgnoreAll {
+		m.SkipServers = existingServerIDSet(m.SkipServers)
+	} else {
+		// CoverAll 的 deny-set 由 denyListOwnedByCaller 要求每个 ID 存在。
+		m.SkipServers = model.EnabledIDSet(m.SkipServers)
+	}
+	m.FailTriggerTasks = existingCronIDs(m.FailTriggerTasks)
+	m.RecoverTriggerTasks = existingCronIDs(m.RecoverTriggerTasks)
+}
+
+func normalizeAlertRuleReferences(r *model.AlertRule) error {
+	if len(r.Rules) > maxRulesPerAlertRule {
+		return singleton.Localizer.ErrorT("too many rules, at most %d", maxRulesPerAlertRule)
+	}
+	for _, rule := range r.Rules {
+		if rule != nil && rule.Ignore != nil {
+			rule.Ignore = existingServerIDSet(rule.Ignore)
+		}
+	}
+	r.FailTriggerTasks = existingCronIDs(r.FailTriggerTasks)
+	r.RecoverTriggerTasks = existingCronIDs(r.RecoverTriggerTasks)
+	return nil
+}
+
+func normalizeCronServers(cover uint8, servers []uint64) []uint64 {
+	if cover == model.CronCoverAll {
+		// deny-set：存在性由 checkCronServerListPermission 严格校验。
+		return model.UniqueIDs(servers)
+	}
+	return existingServerIDs(servers)
+}
```

**File**: `cmd/dashboard/controller/resource_reference_limits_test.go` (added, +253/-0)
```diff
@@ -0,0 +1,253 @@
+package controller
+
+import (
+	"bytes"
+	"net/http"
+	"net/http/httptest"
+	"strings"
+	"testing"
+
+	"github.com/gin-gonic/gin"
+	"github.com/stretchr/testify/require"
+
+	"github.com/nezhahq/nezha/model"
+	"github.com/nezhahq/nezha/service/singleton"
+)
+
+// 回归测试：GHSA-8fgr-wx8p-v6q7。低权限成员不能再把落库的引用集合撑到
+// 超出真实对象数量的大小。
+
+func insertTriggerCronForReferenceLimitTest(t *testing.T, id uint64) {
+	t.Helper()
+	cr := &model.Cron{Name: "trigger", TaskType: model.CronTypeTriggerTask, Cover: model.CronCoverAlertTrigger}
+	cr.ID = id
+	cr.UserID = 100
+	singleton.CronShared.Update(cr)
+}
+
+func TestReferenceLimits_ServiceSkipServersDropsFalseAndMissingEntries(t *testing.T) {
+	setupCoverPATFixture(t)
+	skip := map[uint64]bool{1: true, 424242: true}
+	for i := uint64(1000); i < 51000; i++ {
+		skip[i] = false
+	}
+	c := ctxAsMemberWithBody(100, model.ServiceForm{Name: "svc", Target: "example.invalid:443", Type: model.TaskTypeTCPPing, Cover: model.ServiceCoverIgnoreAll, SkipServers: skip, Duration: 30})
+	id, err := createService(c)
+	require.NoError(t, err)
+
+	var row model.Service
+	require.NoError(t, singleton.DB.First(&row, id).Error)
+	require.Equal(t, map[uint64]bool{1: true}, row.SkipServers)
+	require.JSONEq(t, `{"1":true}`, row.SkipServersRaw)
+
+	live, ok := singleton.ServiceSentinelShared.Get(id)
+	require.True(t, ok)
+	require.Equal(t, map[uint64]bool{1: true}, live.SkipServers, "in-memory copy must be normalized too")
+}
+
+func TestReferenceLimits_ServiceCoverAllDenySetKeepsStrictExistenceCheck(t *testing.T) {
+	setupCoverPATFixture(t)
+	c := ctxAsMemberWithBody(100, model.ServiceForm{Name: "svc", Target: "example.invalid:443", Type: model.TaskTypeTCPPing, Cover: model.ServiceCoverAll, SkipServers: map[uint64]bool{1: true, 424242: true}, Duration: 30})
+	_, err := createService(c)
+	require.Error(t, err, "a deny-set must not silently drop unknown servers")
+}
+
+func TestReferenceLimits_ServiceTriggerTasksDeduplicatedAndMissingDropped(t *testing.T) {
+	setupCoverPATFixture(t)
+	insertTriggerCronForReferenceLimitTest(t, 5)
+	tasks := []uint64{5}
+	for i := 0; i < 50000; i++ {
+		tasks = append(tasks, 5, uint64(900000+i))
+	}
+	c := ctxAsMemberWithBody(100, model.ServiceForm{Name: "svc", Target: "example.invalid:443", Type: model.TaskTypeTCPPing, Cover: model.ServiceCoverIgnoreAll, SkipServers: map[uint64]bool{1: true}, Duration: 30, FailTriggerTasks: tasks, RecoverTriggerTasks: tasks})
+	id, err := createService(c)
+	require.NoError(t, err)
+
+	var row model.Service
+	require.NoError(t, singleton.DB.First(&row, id).Error)
+	require.Equal(t, []uint64{5}, row.FailTriggerTasks)
+	require.Equal(t, []uint64{5}, row.RecoverTriggerTasks)
+	require.Equal(t, "[5]", row.FailTriggerTasksRaw)
+}
+
+func setupServerDDNSReferenceTest(t *testing.T) {
+	t.Helper()
+	setupCoverPATFixture(t)
+	require.NoError(t, singleton.DB.AutoMigrate(&model.DDNSProfile{}))
+	originalDDNS := singleton.DDNSShared
+	singleton.DDNSShared = singleton.NewEmptyDDNSClassForTest()
+	t.Cleanup(func() { singleton.DDNSShared = originalDDNS })
+	for _, id := range []uint64{7, 8} {
+		p := &model.DDNSProfile{}
+		p.ID = id
+		p.SetUserID(100)
+		singleton.DDNSShared.InsertForTest(p)
+	}
+	srv := model.Server{Name: "s"}
+	srv.ID = 1
+	srv.UserID = 100
+	require.NoError(t, singleton.DB.Create(&srv).Error)
+}
+
+func updateServerAsMember(t *testing.T, form model.ServerForm) error {
+	t.Helper()
+	c := ctxAsMemberWithBody(100, form)
+	c.Params = gin.Params{{Key: "id", Value: "1"}}
+	_, err := updateServer(c)
+	return err
+}
+
+func TestReferenceLimits_ServerDDNSProfilesDeduplicatedPreservingOrder(t *testing.T) {
+	setupServerDDNSReferenceTest(t)
+	profiles := []uint64{8, 7}
+	for i := 0; i < 100000; i++ {
+		profiles = append(profiles, 7, 8)
+	}
+	unbound := map[uint64][]string{7: {"a.example", "a.example", "b.example"}}
+	for i := uint64(1000); i < 6000; i++ {
+		unbound[i] = []string{"x.example"}
+	}
+	require.NoError(t, updateServerAsMember(t, model.ServerForm{Name: "s", DDNSProfiles: profiles, OverrideDDNSDomains: unbound}))
+
+	var row model.Server
+	require.NoError(t, singleton.DB.First(&row, 1).Error)
+	require.Equal(t, []uint64{8, 7}, row.DDNSProfiles)
+	require.Equal(t, "[8,7]", row.DDNSProfilesRaw)
+	require.Equal(t, map[uint64][]string{7: {"a.example", "b.example"}}, row.OverrideDDNSDomains, "only bound profiles keep overrides")
+
+	live, ok := singleton.ServerShared.Get(1)
+	require.True(t, ok)
+	require.Equal(t, []uint64{8, 7}, live.DDNSProfiles)
+}
+
+func TestReferenceLimits_ServerOverrideDomainsValidated(t *testing.T) {
+	setupServerDDNSReferenceTest(t)
+	err := updateServerAsMember(t, model.ServerForm{Name: "s", DDNSProfiles: []uint64{7}, OverrideDDNSDomains: map[uint64][]string{7: {"bad domain\n"}}})
+	require.Error(t, err, "override domains must pass the same IDN validation as profile domains")
+
+	tooMany := make([]string, maxDomainsPerDDNSProfile+1)
+	for i := range tooMany {
+		tooMany[i] = "d" + itoa(uint64
```

**File**: `cmd/dashboard/controller/server.go` (modified, +10/-0)
```diff
@@ -63,6 +63,14 @@ func updateServer(c *gin.Context) (any, error) {
 	if err := c.ShouldBindJSON(&sf); err != nil {
 		return nil, err
 	}
+	// DDNSShared.CheckPermission 不去重；重复 ID 会让 UpdateDDNS 重复外呼
+	// （GHSA-8fgr-wx8p-v6q7）。必须在权限校验前规范化。
+	sf.DDNSProfiles = model.UniqueIDs(sf.DDNSProfiles)
+	overrideDomains, err := normalizeOverrideDDNSDomains(sf.OverrideDDNSDomains, sf.DDNSProfiles)
+	if err != nil {
+		return nil, err
+	}
+	sf.OverrideDDNSDomains = overrideDomains
 
 	if !singleton.DDNSShared.CheckPermission(c, slices.Values(sf.DDNSProfiles)) {
 		return nil, singleton.Localizer.ErrorT("permission denied")
@@ -296,6 +304,8 @@ func setServerConfig(c *gin.Context) (*model.ServerTaskResponse, error) {
 	if err := c.ShouldBindJSON(&configForm); err != nil {
 		return nil, err
 	}
+	// 重复 ID 会向同一 agent 重复下发配置。
+	configForm.Servers = model.UniqueIDs(configForm.Servers)
 
 	var resp model.ServerTaskResponse
 	slist := singleton.ServerShared.GetList()
```

**File**: `cmd/dashboard/controller/service.go` (modified, +2/-0)
```diff
@@ -513,6 +513,7 @@ func createService(c *gin.Context) (uint64, error) {
 	m.RecoverTriggerTasks = mf.RecoverTriggerTasks
 	m.FailTriggerTasks = mf.FailTriggerTasks
 
+	normalizeServiceReferences(&m)
 	if err := validateServers(c, &m); err != nil {
 		return 0, err
 	}
@@ -585,6 +586,7 @@ func updateService(c *gin.Context) (any, error) {
 	m.RecoverTriggerTasks = mf.RecoverTriggerTasks
 	m.FailTriggerTasks = mf.FailTriggerTasks
 
+	normalizeServiceReferences(&m)
 	if err := validateServers(c, &m); err != nil {
 		return 0, err
 	}
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

## X. security: bound persisted resource reference collections

**RULE**:
When implementing operations in `cmd/dashboard/controller/alertrule.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in nezhahq/nezha. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `8bcaf092`: security: bound persisted resource reference collections. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `cmd/dashboard/controller/alertrule.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	// 规范化必须先于 trigger task 权限校验（GHSA-8fgr-wx8p-v6q7）。
	if err := normalizeAlertRuleReferences(r); err != nil {
		return err
	}
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `8bcaf092` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
