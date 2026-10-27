> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/nezhahq-nezha-learnings.md`  
> **Source**: github ([https://github.com/nezhahq/nezha](https://github.com/nezhahq/nezha))  
> **Source Version**: `a6a16eab`  
> **License**: WTFPL  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-27T13:35:07.984Z  
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
> **Harvest Timestamp**: 2026-10-27T13:35:06.688Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `nezhahq/nezha`
- **Description**: :trollface: Self-hosted, lightweight server and website monitoring and O&M tool
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 10375 stars

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
- **Issue #1246** (2026-10-22): **Let readers deploy Nezha in one click from a new README section**
  *Symptoms*: I added a One-Click Deploy section to README.md, between User Guide and Contributing, with buttons for RepoCloud and Railway. This gives the community one-click access to deploy Nezha at two hosting providers. Railway: after deploying, copy OWNER_PASSWORD from the nezha service's variables and sign in as admin ([template page](https://railway.com/deploy/nezha)); that template is community-made, not part of this project. 
  **Post-Mortem & Fix Analysis**:
  > I don't like PaaS unless they become sponsor😄

- **Issue #1245** (2026-10-24): **perf(dashboard): 压缩并缓存静态资源，为轮询接口增加 ETag**
  *Symptoms*: ## 背景  dashboard 之前以未压缩方式提供静态资源，且没有任何缓存策略，导致每次页面跳转都要重新下载并校验完整资源包。两个前端界面还会定时轮询 `/api/v1/service` 和 `/api/v1/server`，每次轮询都返回完整快照，且不支持条件请求。  ## 改动  - 对静态资源按 `Accept-Encoding` 协商提供 brotli/gzip，编码结果按文件 mtime 缓存（`cmd/dashboard/controller/static_compress.go`）。 - 对带哈希的 `/assets/` 返回 `Cache-Control: immutable`，其余返回 `ETag` + `no-cache`，重复加载变为 304。 - 不再记录静态资源请求日志。 - 用按 viewer 加锁的 singleflight 合并并发的 `/api/v1/server` 快照（`cmd/dashboard/controller/controller.go`）。 - 为 `/api/v1/service` 与 `/api/v1/server` 增加 `ETag`/304 支持。 - 新增 `script/build-frontends.sh`，用于可复现的 dist 构建。  ## 说明  - `go.mod` 新增依赖 `github.com/andybalholm/brotli`。  ## 测试  `go test ./cmd/dashboard/controller/...` 覆盖编码协商以及 ETag / singleflight 路径（`static_compress_test.go`、`api_etag_test.go`）。
  **Post-Mortem & Fix Analysis**:
  > ### Code review  发现 4 个需要在合并前修复的问题：  1. **[P1] singleflight 共享的服务器切片会被权限过滤原地修改。** 合并的请求获得同一底层数组，随后 `filter` 使用 `slices.DeleteFunc` 删除无权限项并清零尾部。同一普通用户或受限 PAT 的并发请求仍持有原长度，可能对尾部 `nil` 调用 `HasPermission`，导致 panic/500；过滤与序列化之间也可能发生数据竞争。建议请求级克隆切片，或将完整的过滤与响应生成放入正确隔离、不可变的共享结果中，并增加真实并发响应测试。  https://github.com/nezhahq/nezha/blob/69c539e59161dae185148460e78284be0968ed45/cmd/dashboard/controller/server.go#L38-L54  2. **[P2] 压缩缓存没有按本地文件版本失效。** 缓存键只有模板根、来源、路径和编码，`modTime` 没有参与。运行期间更新同路径的 `index.html` 后，gzip/br 请求仍可能命中旧正文，响应 ETag 却来自新文件元数据。应将文件版本纳入缓存键，并测试同一路径内容更新后返回新正文。  https://github.com/nezhahq/nezha/blob/69c539e59161dae185148460e78284be0968ed45/cmd/dashboard/controller/static_compress.go#L150-L168  3. **[P2] 嵌入资源等长更新会复用旧 ETag。** 当前验证器只依赖文件名、长度和 mtime，而 `embed.FS` 的 mtime 为零。两次发布仅替换等长 chunk 哈希时，首页 ETag 不变，客户端可能收到错误的 304，继续使用引用旧资源的 HTML。建议采用内容摘要或构建版本，并覆盖同名、同长度、内容不同的升级场景。  https://github.com/nezhahq/nezha/blob/69c539e59161dae185148460e78284be0968ed45/cmd/dashboard/controller/static_compress.go#L177
  > 转向自建二开版本，本 PR 不再提交上游。

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

### Incident Patch 1: `7cd0371b` (2026-10-26)
**Commit Message**: security: close OAuth and agent control lifecycle regressions

Restore session-aware OAuth binding and read public authentication URLs from committed host policy snapshots. Keep MCP, configuration, upgrade and alert-command admission tied to actual transport sends, while allowing transfer rollback and reply processing to complete without circular lock waits.

Add authenticated-route, persistence rollback, transfer-result ordering and stalled-send regression coverage. Capture task identity before request contexts can be recycled.

Co-authored-by: naiba/CloudCode <[REDACTED_EMAIL]>

**File**: `cmd/dashboard/controller/controller.go` (modified, +2/-1)
```diff
@@ -87,10 +87,11 @@ func routers(r *gin.Engine, frontendDist fs.FS) {
 
 	api := r.Group("api/v1")
 	api.POST("/login", authMiddleware.LoginHandler)
-	api.GET("/oauth2/:provider", commonHandler(oauth2redirect))
 
 	fallbackAuthMw := fallbackAuthMiddleware(authMiddleware)
 	fallbackAuth := api.Group("", fallbackAuthMw)
+	// Binding needs the real JWT session; anonymous OAuth login remains available.
+	fallbackAuth.GET("/oauth2/:provider", commonHandler(oauth2redirect))
 	fallbackAuth.GET("/setting", commonHandler(listConfig))
 	fallbackAuth.GET("/oauth2/callback", commonHandler(oauth2callback(authMiddleware)))
 
```

**File**: `cmd/dashboard/controller/mcp_oauth.go` (modified, +2/-1)
```diff
@@ -53,7 +53,8 @@ func mcpOAuthIssuer() (string, error) {
 	if singleton.Conf == nil || !singleton.Conf.MCPEnabled() {
 		return "", errors.New("MCP is disabled")
 	}
-	host := singleton.Conf.DashboardHost
+	// Issuers must not observe a host before persistence succeeds or during rollback.
+	host := singleton.Conf.NATDomainPolicySnapshot().DashboardHost
 	u, err := url.Parse("https://" + host)
 	if err != nil || host == "" || u.Host != host || u.Hostname() == "" || u.User != nil || u.Path != "" || u.RawQuery != "" || u.Fragment != "" || strings.ContainsAny(host, "\\\r\n\t ") || singleton.Conf.JWTSecretKey == "" {
 		return "", errors.New("configure dashboard_host as the public HTTPS host before using MCP OAuth")
```

**File**: `cmd/dashboard/controller/mcp_transfer.go` (modified, +4/-2)
```diff
@@ -107,9 +107,11 @@ func mcpTransferURLBase(c *gin.Context) (string, error) {
 	}
 
 	requestHost := strings.TrimSpace(c.Request.Host)
-	host := strings.TrimSpace(singleton.Conf.DashboardHost)
+	// Bearer URLs must use only persisted host settings, including reservations.
+	policy := singleton.Conf.NATDomainPolicySnapshot()
+	host := strings.TrimSpace(policy.DashboardHost)
 	if host == "" {
-		if !singleton.IsReservedDashboardHost(requestHost) {
+		if !policy.IsReservedHost(requestHost) {
 			return "", errMCPTransferHostNotConfigured
 		}
 		host = requestHost
```

**File**: `cmd/dashboard/controller/oauth2.go` (modified, +6/-2)
```diff
@@ -39,8 +39,12 @@ func getRedirectURL(c *gin.Context) string {
 		scheme = "https://"
 	}
 	host := c.Request.Host
-	if !singleton.IsReservedDashboardHost(host) && singleton.Conf != nil && singleton.Conf.DashboardHost != "" {
-		host = singleton.Conf.DashboardHost
+	if singleton.Conf != nil {
+		// Check reservations and canonical host from one committed configuration.
+		policy := singleton.Conf.NATDomainPolicySnapshot()
+		if !policy.IsReservedHost(host) && policy.DashboardHost != "" {
+			host = policy.DashboardHost
+		}
 	}
 	return scheme + host + "/api/v1/oauth2/callback"
 }
```

**File**: `cmd/dashboard/controller/oauth_route_and_config_regression_test.go` (added, +161/-0)
```diff
@@ -0,0 +1,161 @@
+package controller
+
+import (
+	"encoding/json"
+	"errors"
+	"net/http"
+	"net/http/httptest"
+	"net/url"
+	"testing"
+	"time"
+
+	"github.com/gin-gonic/gin"
+	"github.com/nezhahq/nezha/model"
+	"github.com/nezhahq/nezha/service/singleton"
+	"github.com/patrickmn/go-cache"
+	"github.com/stretchr/testify/require"
+)
+
+func TestOAuthBindingThroughAuthenticatedDashboardRoute(t *testing.T) {
+	session := setupMCPOAuthSession(t)
+	previousCache := singleton.Cache
+	singleton.Cache = cache.New(time.Minute, time.Minute)
+	t.Cleanup(func() { singleton.Cache = previousCache })
+	singleton.Conf.Oauth2 = map[string]*model.Oauth2Config{"github": {ClientID: "dashboard", Endpoint: model.Oauth2Endpoint{AuthURL: "https://provider.example/authorize"}}}
+	for _, test := range []struct {
+		name, action     string
+		browser, success bool
+	}{
+		{"authenticated binding", "2", true, true},
+		{"anonymous binding", "2", false, false},
+		{"anonymous login", "1", false, true},
+	} {
+		t.Run(test.name, func(t *testing.T) {
+			response := session.request(t, http.MethodGet, "/api/v1/oauth2/github?type="+test.action, nil, test.browser)
+			var body struct {
+				Success bool                      `json:"success"`
+				Data    model.Oauth2LoginResponse `json:"data"`
+			}
+			require.NoError(t, json.Unmarshal(response.Body.Bytes(), &body))
+			require.Equal(t, test.success, body.Success, response.Body.String())
+			if !test.success {
+				require.Empty(t, response.Result().Cookies())
+				require.Empty(t, body.Data.Redirect)
+				return
+			}
+			redirect, err := url.Parse(body.Data.Redirect)
+			require.NoError(t, err)
+			require.Equal(t, "provider.example", redirect.Host)
+			var stateCookie *http.Cookie
+			for _, cookie := range response.Result().Cookies() {
+				if cookie.Name == "nz-o2s" {
+					stateCookie = cookie
+				}
+			}
+			require.NotNil(t, stateCookie)
+			cached, ok := singleton.Cache.Get(model.CacheKeyOauth2State + stateCookie.Value)
+			require.True(t, ok)
+			state := cached.(*model.Oauth2State)
+			require.Equal(t, redirect.Query().Get("state"), state.State)
+			require.Equal(t, "github", state.Provider)
+			if test.browser {
+				require.Equal(t, session.userID, state.UserID)
+				var stored model.JWTSession
+				require.NoError(t, singleton.DB.Where("key_id = ?", state.SessionID).First(&stored).Error)
+				require.Equal(t, session.userID, stored.UserID)
+				require.Equal(t, model.RTypeBind, state.Action)
+			} else {
+				require.Zero(t, state.UserID)
+				require.Empty(t, state.SessionID)
+				require.Equal(t, model.RTypeLogin, state.Action)
+			}
+		})
+	}
+}
+
+func TestPublicAuthenticationURLsWaitForConfigCommit(t *testing.T) {
+	for _, reader := range []string{"issuer", "transfer", "oauth callback"} {
+		for _, rollback := range []bool{false, true} {
+			name := reader + "/commit"
+			if rollback {
+				name = reader + "/rollback"
+			}
+			t.Run(name, func(t *testing.T) {
+				cleanup, _ := setupMCPTest(t)
+				defer cleanup()
+				singleton.Conf.JWTSecretKey = "configuration-commit-signing-key"
+				entered, finish := make(chan struct{}), make(chan struct{})
+				committed := make(chan error, 1)
+				persistenceError := errors.New("persistence failed")
+				go func() {
+					committed <- singleton.Conf.CommitNATDomainPolicy(model.SettingForm{DashboardHost: "new.example.com"}, func() error {
+						close(entered)
+						<-finish
+						if rollback {
+							return persistenceError
+						}
+						return nil
+					})
+				}()
+				<-entered
+				type outcome struct {
+					value string
+					err   error
+				}
+				started, result := make(chan struct{}), make(chan outcome, 1)
+				go func() {
+					c, _ := gin.CreateTestContext(httptest.NewRecorder())
+					c.Request = httptest.NewRequest(http.MethodGet, "https://untrusted.example/", nil)
+					c.Request.Header.Set("X-Forwarded-Proto", "https")
+					close(started)
+					var value string
+					var err error
+					switch reader {
+					case "issuer":
+						value, err = mcpOAuthIssuer()
+					case "transfer":
+						value, err = mcpTransferURLBase(c)
+					default:
+						value = getRedirectURL(c)
+					}
+					result <- outcome{value, err}
+				}()
+				<-started
+				var early *outcome
+				select {
+				case got := <-result:
+					early = &got
+				case <-time.After(50 * time.Millisecond):
+				}
+				close(finish)
+				err := <-committed
+				if rollback {
+					require.ErrorIs(t, err, persistenceError)
+				} else {
+					require.NoError(t, err)
+				}
+				var got outcome
+				if early != nil {
+					got = *early
+					t.Error("authentication URL read uncommitted configuration")
+				} else {
+					select {
+					case got = <-result:
+					case <-time.After(time.Second):
+						t.Fatal("configuration reader did not resume")
+					}
+				}
+				require.NoError(t, got.err)
+				host := "new.example.com"
+				if rollback {
+					host = "example.com"
+				}
+				want := "https://" + host
+				if reader == "oauth callback" {
+				
```

**File**: `cmd/dashboard/controller/server.go` (modified, +13/-15)
```diff
@@ -200,9 +200,11 @@ func forceUpdateServer(c *gin.Context) (*model.ServerTaskResponse, error) {
 			continue
 		}
 		if server.GetTaskStream() != nil {
-			if err := server.SendTask(&pb.Task{
+			// Upgrade is a control operation too; recheck ownership and pending
+			// transitions at the actual send, including timeout cleanup.
+			if err := server.SendTaskGuarded(&pb.Task{
 				Type: model.TaskTypeUpgrade,
-			}); err != nil {
+			}, serverTaskAdmission(c, sid)); err != nil {
 				if errors.Is(err, model.ErrTaskStreamOffline) {
 					forceUpdateResp.Offline = append(forceUpdateResp.Offline, sid)
 				} else {
@@ -245,26 +247,28 @@ func getServerConfig(c *gin.Context) (string, error) {
 	if controlErr != nil {
 		return "", controlErr
 	}
-	defer releaseControl()
+	releaseControl() // Waiting for ConfigCache must not block ownership rollback.
 	if s.GetTaskStream() == nil {
 		return "", nil
 	}
 
-	if err := s.SendTask(&pb.Task{
+	if err := s.SendTaskGuarded(&pb.Task{
 		Type: model.TaskTypeReportConfig,
-	}); err != nil {
+	}, serverTaskAdmission(c, id)); err != nil {
 		if errors.Is(err, model.ErrTaskStreamOffline) {
 			return "", nil
 		}
 		return "", err
 	}
 
 	timeout := time.NewTimer(time.Second * 10)
+	defer timeout.Stop()
 	select {
+	case <-c.Request.Context().Done():
+		return "", c.Request.Context().Err()
 	case <-timeout.C:
 		return "", singleton.Localizer.ErrorT("operation timeout")
 	case data := <-s.ConfigCache:
-		timeout.Stop()
 		switch data := data.(type) {
 		case string:
 			return data, nil
@@ -330,15 +334,9 @@ func setServerConfig(c *gin.Context) (*model.ServerTaskResponse, error) {
 					respMu.Unlock()
 					continue
 				}
-				releaseControl, controlErr := beginServerControl(c, s.ID)
-				if controlErr != nil {
-					respMu.Lock()
-					resp.Failure = append(resp.Failure, s.ID)
-					respMu.Unlock()
-					continue
-				}
-				sendErr := s.SendTask(task)
-				releaseControl()
+				// The transport can still be sending after its deadline returns.
+				// Keep ownership admission with the actual Send, not the HTTP call.
+				sendErr := s.SendTaskGuarded(task, serverTaskAdmission(c, s.ID))
 				if err := sendErr; err != nil {
 					respMu.Lock()
 					if errors.Is(err, model.ErrTaskStreamOffline) {
```

**File**: `cmd/dashboard/controller/server_config_lease_regression_test.go` (added, +134/-0)
```diff
@@ -0,0 +1,134 @@
+package controller
+
+import (
+	"context"
+	"testing"
+	"time"
+
+	"github.com/gin-gonic/gin"
+	"github.com/nezhahq/nezha/model"
+	pb "github.com/nezhahq/nezha/proto"
+	"github.com/nezhahq/nezha/service/singleton"
+	"github.com/stretchr/testify/require"
+)
+
+type configurationLeaseTaskStream struct {
+	pb.NezhaService_RequestTaskServer
+	sent   chan *pb.Task
+	resume chan struct{}
+}
+
+func (s *configurationLeaseTaskStream) Context() context.Context { return context.Background() }
+func (s *configurationLeaseTaskStream) Send(task *pb.Task) error {
+	if task.Type == model.TaskTypeServerTransferApply {
+		return nil
+	}
+	s.sent <- task
+	if s.resume != nil {
+		<-s.resume
+	}
+	return nil
+}
+
+func setupConfigurationLeaseTransfer(t *testing.T) (*model.Server, uint64) {
+	t.Helper()
+	cleanup := setupRetryServerTransferFixture(t)
+	previousConf, previousLoc := singleton.Conf, singleton.Loc
+	singleton.Conf = &singleton.ConfigClass{Config: &model.Config{}}
+	singleton.Loc = time.UTC
+	t.Cleanup(func() { cleanup(); singleton.Conf, singleton.Loc = previousConf, previousLoc })
+	db, err := singleton.DB.DB()
+	require.NoError(t, err)
+	db.SetMaxOpenConns(1)
+	t.Cleanup(func() { db.Close() })
+	seedServer(t, 1, 100)
+	transferID := seedPendingTransfer(t, 1, 100, 200, 100)
+	server, ok := singleton.ServerShared.Get(1)
+	require.True(t, ok)
+	return server, transferID
+}
+
+func TestServerConfigReadReleasesControlBeforeWaitingForReply(t *testing.T) {
+	server, transferID := setupConfigurationLeaseTransfer(t)
+	stream := &configurationLeaseTaskStream{sent: make(chan *pb.Task, 1)}
+	server.SetTaskStream(stream)
+	c := ctxAs(1, model.RoleAdmin)
+	c.Params = gin.Params{{Key: "id", Value: "1"}}
+	type outcome struct {
+		data string
+		err  error
+	}
+	done := make(chan outcome, 1)
+	go func() { data, err := getServerConfig(c); done <- outcome{data, err} }()
+	require.Equal(t, uint64(model.TaskTypeReportConfig), (<-stream.sent).Type)
+	rollback := make(chan error, 1)
+	go func() {
+		_, err := singleton.ServerTransferShared.MarkFailed(transferID, "agent rejected transfer")
+		rollback <- err
+		server.ConfigCache <- "agent configuration"
+	}()
+	var got outcome
+	select {
+	case got = <-done:
+	case <-time.After(time.Second):
+		t.Error("configuration read blocked rollback while waiting for its reply")
+		server.ConfigCache <- "cleanup configuration"
+		got = <-done
+	}
+	require.NoError(t, <-rollback)
+	require.NoError(t, got.err)
+	require.Equal(t, "agent configuration", got.data)
+	require.Equal(t, uint64(100), server.GetUserID())
+}
+
+func TestServerConfigWriteKeepsControlUntilTimedOutSendReturns(t *testing.T) {
+	server, transferID := setupConfigurationLeaseTransfer(t)
+	stream := &configurationLeaseTaskStream{sent: make(chan *pb.Task, 1), resume: make(chan struct{})}
+	server.SetTaskStream(stream)
+	c := ctxAs(1, model.RoleAdmin)
+	bindJSON(c, model.ServerConfigForm{Servers: []uint64{1}, Config: `{"debug":true}`})
+	type outcome struct {
+		response *model.ServerTaskResponse
+		err      error
+	}
+	done := make(chan outcome, 1)
+	go func() { response, err := setServerConfig(c); done <- outcome{response, err} }()
+	task := <-stream.sent
+	require.Equal(t, uint64(model.TaskTypeApplyConfig), task.Type)
+	require.Equal(t, `{"debug":true}`, task.Data)
+	got := <-done
+	require.NoError(t, got.err)
+	require.Equal(t, []uint64{1}, got.response.Failure)
+	require.Empty(t, got.response.Success)
+	rollback := make(chan error, 1)
+	go func() {
+		_, err := singleton.ServerTransferShared.MarkFailed(transferID, "agent rejected transfer")
+		rollback <- err
+	}()
+	var early bool
+	select {
+	case err := <-rollback:
+		require.NoError(t, err)
+		early = true
+	case <-time.After(100 * time.Millisecond):
+	}
+	close(stream.resume)
+	if !early {
+		require.NoError(t, <-rollback)
+	}
+	require.False(t, early, "ownership changed while the old configuration was still being sent")
+	require.Equal(t, uint64(100), server.GetUserID())
+}
+
+func TestForceUpdateRejectsPendingTransferOwner(t *testing.T) {
+	server, _ := setupConfigurationLeaseTransfer(t)
+	stream := &configurationLeaseTaskStream{sent: make(chan *pb.Task, 1)}
+	server.SetTaskStream(stream)
+	c := ctxAs(200, model.RoleMember)
+	bindJSON(c, []uint64{server.ID})
+	response, err := forceUpdateServer(c)
+	require.NoError(t, err)
+	require.Empty(t, response.Success)
+	require.Equal(t, []uint64{server.ID}, response.Failure)
+	require.Empty(t, stream.sent, "the pending destination must not dispatch an Agent upgrade")
+}
```

**File**: `cmd/dashboard/controller/server_control.go` (modified, +17/-3)
```diff
@@ -7,11 +7,25 @@ import (
 )
 
 func beginServerControl(c *gin.Context, serverID uint64) (func(), error) {
+	return serverTaskAdmission(c, serverID)()
+}
+
+// Capture request identity before sending: a timed-out Send can outlive Gin's
+// request context. Its final admission must not read a recycled *gin.Context.
+func serverTaskAdmission(c *gin.Context, serverID uint64) func() (func(), error) {
 	user, ok := c.Get(model.CtxKeyAuthorizedUser)
 	if !ok || !patAllowsServer(c, serverID) {
-		return nil, singleton.Localizer.ErrorT("permission denied")
+		err := singleton.Localizer.ErrorT("permission denied")
+		return func() (func(), error) { return nil, err }
 	}
 	caller := user.(*model.User)
-	release, _, err := singleton.BeginServerControl(serverID, caller.ID, caller.Role.IsAdmin())
-	return release, err
+	userID, admin := caller.ID, caller.Role.IsAdmin()
+	ctx := c.Request.Context()
+	return func() (func(), error) {
+		if err := ctx.Err(); err != nil {
+			return nil, err
+		}
+		release, _, err := singleton.BeginServerControl(serverID, userID, admin)
+		return release, err
+	}
 }
```

---

### Incident Patch 2: `027bfcf6` (2026-10-26)
**Commit Message**: security: enforce dashboard authorization and resource boundaries

Harden tenant permissions, transfer admission, authentication and bounded request handling. Add member NAT domain settings, migration guidance and regression coverage.

Co-authored-by: naiba/CloudCode <[REDACTED_EMAIL]>

**File**: `cmd/dashboard/controller/access_log.go` (added, +43/-0)
```diff
@@ -0,0 +1,43 @@
+package controller
+
+import (
+	"fmt"
+	"github.com/gin-gonic/gin"
+	"log"
+	"net/http"
+	"net/url"
+	"strings"
+)
+
+func credentialFreeRequestPath(path string) string {
+	parsed, err := url.ParseRequestURI(path)
+	if err != nil {
+		return "[invalid request path]"
+	}
+	path = parsed.Path // Never log query values: JWT, OAuth codes and state can all appear here.
+	for _, prefix := range []string{"/mcp/download/", "/mcp/upload/"} {
+		if strings.HasPrefix(path, prefix) {
+			return prefix + "[redacted]"
+		}
+	}
+	return path
+}
+
+func dashboardRequestLogger() gin.HandlerFunc {
+	return gin.LoggerWithFormatter(func(entry gin.LogFormatterParams) string {
+		return fmt.Sprintf("[GIN] %s | %d | %s | %q | %s %q\n", entry.TimeStamp.Format("2006/01/02 15:04:05"), entry.StatusCode, entry.Latency, entry.ClientIP, entry.Method, credentialFreeRequestPath(entry.Path))
+	})
+}
+
+func dashboardRecovery() gin.HandlerFunc {
+	return func(c *gin.Context) {
+		defer func() {
+			if recover() != nil {
+				// Gin's default recovery dumps the request, including cookie and URL credentials.
+				log.Printf("NEZHA>> recovered request panic: %s %q", c.Request.Method, credentialFreeRequestPath(c.Request.URL.RequestURI()))
+				c.AbortWithStatus(http.StatusInternalServerError)
+			}
+		}()
+		c.Next()
+	}
+}
```

**File**: `cmd/dashboard/controller/access_log_test.go` (added, +29/-0)
```diff
@@ -0,0 +1,29 @@
+package controller
+
+import (
+	"bytes"
+	"net/http/httptest"
+	"testing"
+
+	"github.com/gin-gonic/gin"
+	"github.com/stretchr/testify/require"
+)
+
+func TestAccessLogOmitsCredentialURLs(t *testing.T) {
+	var output bytes.Buffer
+	original := gin.DefaultWriter
+	gin.DefaultWriter = &output
+	defer func() { gin.DefaultWriter = original }()
+	router := gin.New()
+	router.Use(dashboardRequestLogger())
+	router.GET("/ws", func(c *gin.Context) { c.Status(204) })
+	router.GET("/mcp/download/:token", func(c *gin.Context) { c.Status(204) })
+	for _, path := range []string{"/ws?token=synthetic-session-credential", "/mcp/download/synthetic-transfer-credential?query=sensitive"} {
+		router.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest("GET", path, nil))
+	}
+	require.NotContains(t, output.String(), "synthetic-session-credential")
+	require.NotContains(t, output.String(), "synthetic-transfer-credential")
+	require.NotContains(t, output.String(), "query=sensitive")
+	require.Contains(t, output.String(), "/ws")
+	require.Contains(t, output.String(), "/mcp/download/")
+}
```

**File**: `cmd/dashboard/controller/agentcompat_capability_nat_test.go` (modified, +5/-0)
```diff
@@ -18,6 +18,11 @@ import (
 func TestAgentcompatNATCapabilityUsesExactCurrentProfilePermission(t *testing.T) {
 	cleanup, userID := setupMCPTest(t)
 	t.Cleanup(cleanup)
+	oldUsers := singleton.UserInfoMap
+	singleton.UserInfoMap = map[uint64]model.UserInfo{userID: {Role: model.RoleMember}, 999: {Role: model.RoleMember}}
+	t.Cleanup(func() { singleton.UserInfoMap = oldUsers })
+	singleton.Conf.DashboardHost = "panel.example"
+	singleton.Conf.NATMemberDomains = []string{"private-profile.example", "foreign-profile.example"}
 	handler := rpc.NewNezhaHandler()
 	originalHandler := rpc.NezhaHandlerSingleton
 	originalNAT := singleton.NATShared
```

**File**: `cmd/dashboard/controller/alertrule.go` (modified, +3/-0)
```diff
@@ -195,6 +195,9 @@ func validateRule(c *gin.Context, r *model.AlertRule) error {
 					return singleton.Localizer.ErrorT("duration is too large")
 				}
 			} else {
+				if rule.CycleStart != nil && rule.CycleStart.Year() < 2000 {
+					return singleton.Localizer.ErrorT("cycle_start must be in year 2000 or later")
+				}
 				if !rule.HasSafeCycleUnit() {
 					return singleton.Localizer.ErrorT("invalid cycle unit")
 				}
```

**File**: `cmd/dashboard/controller/controller.go` (modified, +2/-1)
```diff
@@ -29,7 +29,8 @@ import (
 
 func ServeWeb(frontendDist fs.FS) http.Handler {
 	gin.SetMode(gin.ReleaseMode)
-	r := gin.Default()
+	r := gin.New()
+	r.Use(dashboardRequestLogger(), dashboardRecovery())
 
 	if singleton.Conf.Debug {
 		gin.SetMode(gin.DebugMode)
```

**File**: `cmd/dashboard/controller/cron.go` (modified, +35/-2)
```diff
@@ -3,6 +3,7 @@ package controller
 import (
 	"slices"
 	"strconv"
+	"sync/atomic"
 
 	"github.com/gin-gonic/gin"
 	"github.com/jinzhu/copier"
@@ -43,6 +44,11 @@ func listCron(c *gin.Context) ([]*model.Cron, error) {
 // @Success 200 {object} model.CommonResponse[uint64]
 // @Router /cron [post]
 func createCron(c *gin.Context) (uint64, error) {
+	// Scheduled commands execute autonomously; write scope cannot imply execution.
+	if tok := APITokenFromContext(c); tok != nil && !tok.HasScope(model.ScopeCronExec) {
+		return 0, singleton.Localizer.ErrorT("permission denied")
+	}
+
 	var cf model.CronForm
 	var cr model.Cron
 
@@ -81,17 +87,28 @@ func createCron(c *gin.Context) (uint64, error) {
 	}
 
 	var err error
+	var committed atomic.Bool
 	if cf.TaskType == model.CronTypeCronTask {
-		if cr.CronJobID, err = singleton.CronShared.AddFunc(cr.Scheduler, singleton.CronTrigger(&cr)); err != nil {
+		if cr.CronJobID, err = singleton.CronShared.AddFunc(cr.Scheduler, func() {
+			// Scheduler callbacks must not observe an uncommitted row or its mutable ID.
+			if committed.Load() {
+				singleton.CronTrigger(&cr)()
+			}
+		}); err != nil {
 			return 0, err
 		}
 	}
 
 	if err = singleton.DB.Create(&cr).Error; err != nil {
+		// Registration is provisional until persistence succeeds.
+		if cr.CronJobID != 0 {
+			singleton.CronShared.Remove(cr.CronJobID)
+		}
 		return 0, newGormError("%v", err)
 	}
 
 	singleton.CronShared.Update(&cr)
+	committed.Store(true)
 	return cr.ID, nil
 }
 
@@ -108,6 +125,11 @@ func createCron(c *gin.Context) (uint64, error) {
 // @Success 200 {object} model.CommonResponse[any]
 // @Router /cron/{id} [patch]
 func updateCron(c *gin.Context) (any, error) {
+	// Scheduled commands execute autonomously; write scope cannot imply execution.
+	if tok := APITokenFromContext(c); tok != nil && !tok.HasScope(model.ScopeCronExec) {
+		return nil, singleton.Localizer.ErrorT("permission denied")
+	}
+
 	idStr := c.Param("id")
 	id, err := strconv.ParseUint(idStr, 10, 64)
 	if err != nil {
@@ -157,18 +179,29 @@ func updateCron(c *gin.Context) (any, error) {
 		return nil, singleton.Localizer.ErrorT("scheduled tasks cannot be triggered by alarms")
 	}
 
+	var committed atomic.Bool
+	cr.CronJobID = 0 // Only remove the newly registered job on failure, never the prior live job.
 	// 对于计划任务类型，需要更新CronJob
 	if cf.TaskType == model.CronTypeCronTask {
-		if cr.CronJobID, err = singleton.CronShared.AddFunc(cr.Scheduler, singleton.CronTrigger(&cr)); err != nil {
+		if cr.CronJobID, err = singleton.CronShared.AddFunc(cr.Scheduler, func() {
+			// Scheduler callbacks must not observe an uncommitted row or its mutable ID.
+			if committed.Load() {
+				singleton.CronTrigger(&cr)()
+			}
+		}); err != nil {
 			return nil, err
 		}
 	}
 
 	if err = singleton.DB.Save(&cr).Error; err != nil {
+		if cr.CronJobID != 0 {
+			singleton.CronShared.Remove(cr.CronJobID)
+		}
 		return nil, newGormError("%v", err)
 	}
 
 	singleton.CronShared.Update(&cr)
+	committed.Store(true)
 	return nil, nil
 }
 
```

**File**: `cmd/dashboard/controller/cron_service_cover_pat_test.go` (modified, +7/-0)
```diff
@@ -124,6 +124,7 @@ func TestCreateCron_RejectsCoverAllForServerLimitedPAT(t *testing.T) {
 	setupCoverPATFixture(t)
 
 	tok := &model.APIToken{ID: 17, UserID: 100}
+	tok.SetScopes([]string{model.ScopeCronWrite, model.ScopeCronExec})
 	tok.SetServerIDs([]uint64{1})
 
 	r := coverPATRouter(t, tok, commonHandler(createCron))
@@ -161,6 +162,7 @@ func TestCreateCron_RejectsCoverIgnoreAllWithEmptyServersForLimitedPAT(t *testin
 	setupCoverPATFixture(t)
 
 	tok := &model.APIToken{ID: 18, UserID: 100}
+	tok.SetScopes([]string{model.ScopeCronWrite, model.ScopeCronExec})
 	tok.SetServerIDs([]uint64{1})
 
 	r := coverPATRouter(t, tok, commonHandler(createCron))
@@ -195,6 +197,7 @@ func TestCreateService_AllowsCoverIgnoreAllEmptySkipForLimitedPAT(t *testing.T)
 	setupCoverPATFixture(t)
 
 	tok := &model.APIToken{ID: 21, UserID: 100}
+	tok.SetScopes([]string{model.ScopeCronWrite, model.ScopeCronExec})
 	tok.SetServerIDs([]uint64{1})
 
 	r := coverPATRouter(t, tok, commonHandler(createService))
@@ -220,6 +223,7 @@ func TestCreateService_RejectsCoverAllForServerLimitedPAT(t *testing.T) {
 	setupCoverPATFixture(t)
 
 	tok := &model.APIToken{ID: 19, UserID: 100}
+	tok.SetScopes([]string{model.ScopeCronWrite, model.ScopeCronExec})
 	tok.SetServerIDs([]uint64{1})
 
 	r := coverPATRouter(t, tok, commonHandler(createService))
@@ -256,6 +260,7 @@ func TestCreateCron_RejectsCoverAllWithDenyListCoveringOnlyWhitelistedServers(t
 	setupCoverPATFixture(t)
 
 	tok := &model.APIToken{ID: 31, UserID: 100}
+	tok.SetScopes([]string{model.ScopeCronWrite, model.ScopeCronExec})
 	tok.SetServerIDs([]uint64{1})
 
 	r := coverPATRouter(t, tok, commonHandler(createCron))
@@ -292,6 +297,7 @@ func TestCreateCron_AllowsCoverAllWhenDenyListCoversAllNonWhitelistedServers(t *
 	setupCoverPATFixture(t)
 
 	tok := &model.APIToken{ID: 41, UserID: 100}
+	tok.SetScopes([]string{model.ScopeCronWrite, model.ScopeCronExec})
 	tok.SetServerIDs([]uint64{1})
 
 	r := coverPATRouter(t, tok, commonHandler(createCron))
@@ -321,6 +327,7 @@ func TestCreateService_RejectsCoverAllWithSkipListCoveringOnlyWhitelistedServers
 	setupCoverPATFixture(t)
 
 	tok := &model.APIToken{ID: 32, UserID: 100}
+	tok.SetScopes([]string{model.ScopeCronWrite, model.ScopeCronExec})
 	tok.SetServerIDs([]uint64{1})
 
 	r := coverPATRouter(t, tok, commonHandler(createService))
```

**File**: `cmd/dashboard/controller/dashboard_credential_nat_flow_test.go` (modified, +10/-4)
```diff
@@ -31,12 +31,15 @@ func setupNATFlowTest(t *testing.T) (*rpcService.NezhaHandler, *model.Server, *n
 	setupDashboardCredentialTest(t)
 
 	require.NoError(t, singleton.DB.AutoMigrate(&model.Server{}))
+	originalUsers := singleton.UserInfoMap
+	singleton.UserInfoMap = map[uint64]model.UserInfo{1: {Role: model.RoleAdmin}}
 	originalServerShared, originalHandler := singleton.ServerShared, rpcService.NezhaHandlerSingleton
 	t.Cleanup(func() {
+		singleton.UserInfoMap = originalUsers
 		singleton.ServerShared, rpcService.NezhaHandlerSingleton = originalServerShared, originalHandler
 	})
 
-	serverRow := &model.Server{Common: model.Common{ID: 7}, UUID: "nat-credential-flow-test", Name: "nat-credential-flow-test"}
+	serverRow := &model.Server{Common: model.Common{ID: 7, UserID: 1}, UUID: "nat-credential-flow-test", Name: "nat-credential-flow-test"}
 	require.NoError(t, singleton.DB.Create(serverRow).Error)
 	singleton.ServerShared = singleton.NewServerClass()
 	handler := rpcService.NewNezhaHandler()
@@ -103,7 +106,7 @@ func TestServeNATWithRealClassifierStripsDashboardCredentialsFromAllChannels(t *
 
 			done := make(chan struct{})
 			go func() {
-				rpc.ServeNAT(writer, request, &model.NAT{ServerID: server.ID, Host: "target.example"})
+				rpc.ServeNAT(writer, request, &model.NAT{Common: model.Common{UserID: 1}, ServerID: server.ID, Host: "target.example"})
 				close(done)
 			}()
 			select {
@@ -161,7 +164,7 @@ func TestServeNATWithRealClassifierKeepsForeignCredentials(t *testing.T) {
 
 	done := make(chan struct{})
 	go func() {
-		rpc.ServeNAT(writer, request, &model.NAT{ServerID: server.ID, Host: "target.example"})
+		rpc.ServeNAT(writer, request, &model.NAT{Common: model.Common{UserID: 1}, ServerID: server.ID, Host: "target.example"})
 		close(done)
 	}()
 	select {
@@ -242,7 +245,10 @@ type natFlowAgent struct {
 	once      sync.Once
 }
 
-func (agent *natFlowAgent) Read([]byte) (int, error) { return 0, io.EOF }
+func (agent *natFlowAgent) Read([]byte) (int, error) {
+	<-agent.writeDone
+	return 0, io.EOF
+}
 func (agent *natFlowAgent) Write(data []byte) (int, error) {
 	agent.mu.Lock()
 	agent.written.Write(data)
```

#### Recent Merged Pull Requests:
- **PR #1246** (closed): Let readers deploy Nezha in one click from a new README section (@cosark)
- **PR #1245** (closed): perf(dashboard): 压缩并缓存静态资源，为轮询接口增加 ETag (@CyL-Cly)
- **PR #1243** (2026-10-16): feat(server): online session history with configurable stats window (7-3650 days) (@Sam5440)
- **PR #1242** (2026-10-01): fix(alerts): evaluate fresh reports and order notification delivery (@cantoblanco)
- **PR #1241** (2026-10-01): fix(nat): strip only dashboard-issued Authorization credentials at NAT ingress (@xvkong233)
- **PR #1238** (closed): Fixed: An issue where deleting DNS records for domains hosted on Cloudflare did not work. (@77-QiQi)

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

## X. security: close OAuth and agent control lifecycle regressions

**RULE**:
When implementing operations in `cmd/dashboard/controller/controller.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in nezhahq/nezha. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `7cd0371b`: security: close OAuth and agent control lifecycle regressions. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `cmd/dashboard/controller/controller.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	// Binding needs the real JWT session; anonymous OAuth login remains available.
	fallbackAuth.GET("/oauth2/:provider", commonHandler(oauth2redirect))
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
	api.GET("/oauth2/:provider", commonHandler(oauth2redirect))
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `7cd0371b` are properly handled with clean fallback behavior.
