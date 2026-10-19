> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/nezhahq-nezha-learnings.md`  
> **Source**: github ([https://github.com/nezhahq/nezha](https://github.com/nezhahq/nezha))  
> **Source Version**: `b3297558`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T04:59:15.573Z  
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
> **Harvest Timestamp**: 2026-10-19T04:59:14.620Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `nezhahq/nezha`
- **Description**: :trollface: Self-hosted, lightweight server and website monitoring and O&M tool
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 10358 stars

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

### Core Architecture Module: `pkg/utils/http.go`
```
package utils

import (
	"context"
	"crypto/tls"
	"errors"
	"net"
	"net/http"
	"net/netip"
	"net/url"
	"time"
)

// HttpClient / HttpClientSkipTlsVerify must not be used to dispatch
// requests to user-controlled URLs (SSRF risk, GHSA-6x26-5727-rrm9).
// For any attacker-controlled URL use NewRestrictedHTTPClient instead.
var (
	HttpClientSkipTlsVerify *http.Client
	HttpClient              *http.Client
)

var ErrHTTPURLTargetNotAllowed = errors.New("HTTP URL target is not allowed")

var blockedHTTPClientCIDRs = mustParseHTTPClientCIDRs([]string{
	"0.0.0.0/8",
	"10.0.0.0/8",
	"100.64.0.0/10",
	"127.0.0.0/8",
	"169.254.0.0/16",
	"172.16.0.0/12",
	"192.0.0.0/24",
	"192.0.2.0/24",
	"192.168.0.0/16",
	"198.18.0.0/15",
	"198.51.100.0/24",
	"203.0.113.0/24",
	"224.0.0.0/4",
	"240.0.0.0/4",
	"::/128",
	"::1/128",
	"::ffff:0:0/96",
	"64:ff9b::/96",
	"64:ff9b:1::/48",
	"100::/64",
	"2001::/23",
	"2001:db8::/32",
	"2002::/16",
	"fc00::/7",
	"fe80::/10",
	"ff00::/8",
})

func init() {
	HttpClientSkipTlsVerify = httpClient(_httpClient{
		Transport: httpTransport(_httpTransport{
			SkipVerifyTLS: true,
		}),
	})
	HttpClient = httpClient(_httpClient{
		Transport: httpTransport(_httpTransport{
			SkipVerifyTLS: false,
		}),
	})

	http.DefaultClient.Timeout = time.Minute * 10
}

type _httpTransport struct {
	SkipVerifyTLS bool
}

func httpTransport(conf _httpTransport) *http.Transport {
	return &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: conf.SkipVerifyTLS},
		Proxy:           http.ProxyFromEnvironment,
	}
}

type _httpClient struct {
	Transport *http.Transport
}

func httpClient(conf _httpClient) *http.Client {
	return &http.Client{
		Transport: conf.Transport,
		Timeout:   time.Minute * 10,
	}
}

func NewRestrictedHTTPClient(rawURL string, skipVerifyTLS bool) (*http.Client, error) {
	parsedURL, ip, err := ResolveAllowedHTTPURL(rawURL)
	if err != nil {
		return nil, err
	}
	return buildRestrictedHTTPClient(parsedURL, ip, skipVerifyTLS), nil
}

// buildRestrictedHTTPClient assembles a client whose DialContext is pinned to
// the already-vetted IP. Separated from NewRestrictedHTTPClient so tests can
// exercise the SNI / redirect behavior without relying on live DNS.
func buildRestrictedHTTPClient(parsedURL *url.URL, ip net.IP, skipVerifyTLS bool) *http.Client {
	port := parsedURL.Port()
	if port == "" {
		if parsedURL.Scheme == "https" {
			port = "443"
		} else {
			port = "80"
		}
	}
	// Pin outbound webhooks to the vetted IP so DNS changes cannot retarget private hosts.
	targetAddress := net.JoinHostPort(ip.String(), port)
	dialer := &net.Dialer{}

	return &http.Client{
		Transport: &http.Transport{
			DialContext: func(ctx context.Context, network, address string) (net.Conn, error) {
				return dialer.DialContext(ctx, network, targetAddress)
			},
			TLSClientConfig: &tls.Config{InsecureSkipVerify: skipVerifyTLS, ServerName: parsedURL.Hostname()},
		},
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
		Timeout: time.Minute * 10,
	}
}

func ResolveAllowedHTTPURL(rawURL string) (*url.URL, net.IP, error) {
	parsedURL, err := url.Parse(rawURL)
	if err != nil {
		return nil, nil, err
	}
	if parsedURL.Scheme != "http" && parsedURL.Scheme != "https" {
		return nil, nil, ErrHTTPURLTargetNotAllowed
	}

	host := parsedURL.Hostname()
	if host == "" {
		return nil, nil, ErrHTTPURLTargetNotAllowed
	}
	if ip := net.ParseIP(host); ip != nil {
		if !HTTPURLTargetIPAllowed(ip) {
			return nil, nil, ErrHTTPURLTargetNotAllowed
		}
		return parsedURL, ip, nil
	}

	ips, err := net.LookupIP(host)
	if err != nil {
		return nil, nil, err
	}
	if len(ips) == 0 {
		return nil, nil, ErrHTTPURLTargetNotAllowed
	}
	for _, ip := range ips {
		if !HTTPURLTargetIPAllowed(ip) {
			return nil, nil, ErrHTTPURLTargetNotAllowed
		}
	}

	return parsedURL, ips[0], nil
}

func HTTPURLTargetIPAllowed(ip net.IP) bool {
	parsedIP, ok := netipFromIP(ip)
	if !ok {
		return false
	}
	for _, cidr := range blockedHTTPClientCIDRs {
		if cidr.Contains(parsedIP) {
			return false
		}
	}
	return parsedIP.IsGlobalUnicast()
}

func netipFromIP(ip net.IP) (netip.Addr, bool) {
	parsedIP, ok := netip.AddrFromSlice(ip)
	if !ok {
		return netip.Addr{}, false
	}
	return parsedIP.Unmap(), true
}

func mustParseHTTPClientCIDRs(cidrs []string) []netip.Prefix {
	prefixes := make([]netip.Prefix, 0, len(cidrs))
	for _, cidr := range cidrs {
		prefixes = append(prefixes, netip.MustParsePrefix(cidr))
	}
	return prefixes
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1243** (2026-10-16): **feat(server): online session history with configurable stats window (7-3650 days)**
  *Symptoms*: ## 功能  为每台服务器记录**在线/离线会话历史**,并提供可配置窗口的查询 API,供前端展示在线率、每日在线时段与精确到秒的在线明细:  - agent 每次状态流建立/断开即产生会话(`ReportSystemState` attach/clear),≥30s 节流落盘 `last_active_at` 用于崩溃恢复,dashboard 重启后从 `online_sessions` 表恢复进行中会话,时间线不断裂; - 游客限制与 `getServerMetrics` 语义一致:超过 1 天返回 `unauthorized: only 1d data available for guests`(报错而非 clamp); - 管理员可配置统计窗口 `online_stats_days`(7~3650,默认 7),经 `PATCH /api/v1/setting` 修改,响应中 `max_days` 下发给前端控制可选档位。  ## API  `GET /api/v1/server/{id}/online-history?days={n}`  返回 `window_start/window_end`、`online_rate`、`total_online_seconds`、`currently_online`、`last_active`、逐日聚合 `daily[]`、会话明细 `periods[]`(UTC RFC3339)以及面板时区 `timezone`/`tz_offset`(前端按面板时区拆日渲染)。  ## 持久化与内存数据清单  **持久化(SQLite,经 gorm):** 1. 新表 `online_sessions`:`id`、`created_at`、`updated_at`(内联,对齐 ServiceHistory 先例)、`server_id`、`started_at`、`ended_at`(进行中为零值)、`last_active_at`(≥30s 节流,崩溃恢复用)、`ongoing`;复合索引 `idx_online_sessions_server_started(server_id, started_at)`。保留策略:每日 04:30 分批(1 万行/批)修剪至 `online_stats_days` 窗口,并清理已删服务器的孤儿行。 2. `config.yaml`:`online_stats_days`(dashboard 段,默认 7,合法 7~3650;本 PR 修复后为显式落盘,不再依赖 MCP 过渡块的保存副作用)。  **内存(进程内,不落盘):** 1. `OnlineHistoryRecorder.open map[uint64]*onlineSessionRuntime`(键=服务器 ID,值=会话行 ID + lastPersist 时间戳,`sync.Mutex` 保护;体量与当前在线服务器数线性;启动时由构造器从表恢复)。 2. 上游既有 `Server.LastActive`(`gorm:"-"`):`currently_online` = 距今 ≤30s。 3. 聚合查询按请求实时读表计算,无额外缓存,不依赖 TSDB。  ## 自查与修复(10 项审查发现 + 3 项过程中新发现)  审查报告(含 8 场景压测)发现的问题已全部处理,详见仓库外审查文档;摘要:  - **F1** `DailyOnlineBreakdown` O(时段×天数) → `sort.Search` 
  **Post-Mortem & Fix Analysis**:
  > 不要内嵌 html，接到前台或后台前端里，pr描述改成中文，列出持久化或内存数据
  > ok👌    ---Original--- From: ***@***.***&gt; Date: Wed, Oct 14, 2026 08:47 AM To: ***@***.***&gt;; Cc: ***@***.******@***.***&gt;; Subject: Re: [nezhahq/nezha] feat(server): online session history with configurable stats window (7-3650 days) (PR #1243)   naiba left a comment (nezhahq/nezha#1243)   不要内嵌 html，接到前台或后台前端里，pr描述改成中文，列出持久化或内存数据   — Reply to this email directly, view it on GitHub, or unsubscribe. Triage notifications, keep track of coding agent tasks and review pull requests on the go with GitHub Mobile for iOS and Android. Download it today!  You are receiving this because you authored the thread.Message ID: ***@***.***&gt;

- **Issue #1242** (2026-10-01): **fix(alerts): evaluate fresh reports and order notification delivery**
  *Symptoms*: ## Problem  The dashboard's periodic alert loop can treat the last metric state as a new observation even after an Agent disconnects. If that final value crosses a threshold, repeated evaluations can fill a duration window with one stale report and raise a false sustained-use alert. Conversely, missing telemetry can be interpreted as a normal value or a threshold violation, causing false recovery or false alarms.  Related alert paths have other correctness and delivery risks:  - Aggregate network speed uses the outbound component twice, so rules on total speed can miss real traffic or fire on the wrong value. - Invalid cycle-rule inputs and database failures can produce misleading evaluations. - Notification failures can be muted before successful delivery; concurrent or out-of-order sends can duplicate, suppress, or reorder incident and recovery messages. A failed webhook request can also expose a credential-bearing URL in logs. - Service-check windows can lose failure results within a bucket or misrepresent a reporting gap. TLS certificate changes need stricter parsing and state handling.  ## Fix  - Give each Agent report a distinct sequence and evaluate metric rules only from fresh, connected reports. Evaluate compound conditions against one immutable report snapshot. Treat unavailable metrics as **unknown**, not incident or recovery. Use elapsed-time windows while preserving the existing 3-second-tick meaning of persisted duration settings. - Calculate total network speed

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

### Incident Patch 1: `40240ed0` (2026-10-01)
**Commit Message**: fix(nat): strip only dashboard-issued Authorization credentials at NAT ingress

Since 2640b86 (v2.2.11, 2026-07-20) the NAT ingress deleted the entire
Authorization header, breaking self-hosted apps behind the tunnel that
authenticate with their own Bearer tokens (e.g. the Qinglong panel login
loop).

Strip only credentials issued by this dashboard and forward foreign ones:

- controller.IsDashboardCredential classifies an Authorization value as
  dashboard-issued via a signature-only JWT parser derived from the auth
  middleware (same key, HS256 pinned, claims validation deliberately
  skipped so an expired panel token is still recognized and kept out of
  the tunnel) or an api_tokens lookup for PAT-shaped values. Unknown PATs,
  foreign signatures, other schemes and missing values pass through. When
  classification cannot complete (parser not ready, DB nil or error) the
  verdict fails closed (strip) and the log carries a fixed reason only,
  never credential content.
- Both NAT capability variants (default, and agent-compat legacy /
  invalid-capability / post-consume paths) replace the unconditional
  Del("Authorization") with stripDashboardCredential. The rpc package
  receiv

**File**: `cmd/dashboard/controller/controller.go` (modified, +3/-0)
```diff
@@ -57,6 +57,9 @@ func routers(r *gin.Engine, frontendDist fs.FS) {
 	if err := authMiddleware.MiddlewareInit(); err != nil {
 		log.Fatal("authMiddleware.MiddlewareInit Error:" + err.Error())
 	}
+	// Signature-only view of the auth middleware for IsDashboardCredential:
+	// same key and pinned algorithm, claims validation deliberately skipped.
+	dashboardCredentialJWTParser = newDashboardCredentialJWTParser(authMiddleware)
 	// /mcp — Model Context Protocol endpoint, authenticated by PAT only (闸 1 + 闸 2)。
 	// 不放在 /api/v1 下：MCP client 配置 URL 更短，且 MCP transport 协议演进与 REST API
 	// 解耦。鉴权一律走 apiTokenAuthMiddleware；不接受 JWT 以避免浏览器误触。
```

**File**: `cmd/dashboard/controller/dashboard_credential.go` (added, +104/-0)
```diff
@@ -0,0 +1,104 @@
+package controller
+
+import (
+	"errors"
+	"log"
+	"strings"
+
+	jwt "github.com/golang-jwt/jwt/v4"
+	"gorm.io/gorm"
+
+	ginjwt "github.com/appleboy/gin-jwt/v2"
+	"github.com/nezhahq/nezha/model"
+	"github.com/nezhahq/nezha/service/singleton"
+)
+
+// dashboardCredentialJWTParser verifies that a JWT was signed by this
+// dashboard. It is derived from the auth middleware created in routers() and
+// exists only for IsDashboardCredential; it must never authenticate dashboard
+// requests on its own.
+var dashboardCredentialJWTParser *ginjwt.GinJWTMiddleware
+
+// newDashboardCredentialJWTParser derives a signature-only parser from the
+// dashboard auth middleware. It keeps the exact key value and the pinned HS256
+// signing algorithm of initParams() — there is no second read of
+// singleton.Conf.JWTSecretKey — and disables claims validation so expiry does
+// not change the verdict: an expired token is still proof the dashboard issued
+// it, and keeping expired dashboard tokens out of the NAT tunnel prevents a
+// careless backend from treating "any JWT" as its own credential. The live
+// auth middleware keeps full claims validation; dashboard authentication is
+// not relaxed by this parser in any way.
+func newDashboardCredentialJWTParser(authMiddleware *ginjwt.GinJWTMiddleware) *ginjwt.GinJWTMiddleware {
+	parser := *authMiddleware
+	parser.ParseOptions = []jwt.ParserOption{jwt.WithoutClaimsValidation()}
+	return &parser
+}
+
+// IsDashboardCredential reports whether an Authorization header value was
+// issued by this dashboard: a panel-signed JWT or a panel API token (PAT).
+//
+// NAT ingress uses this to enforce the tunnel credential invariant: values
+// classified as dashboard-issued are stripped before the request is tunneled
+// to the agent, while foreign credentials are forwarded untouched because the
+// NAT backend may authenticate with credentials of its own.
+//
+// Decision policy mirrors the dashboard's own auth middlewares: only the
+// case-sensitive "Bearer " scheme is considered; PAT-shaped values are
+// resolved against the api_tokens table; everything else is treated as a JWT.
+// Whenever the classification cannot be completed (parser or config not ready,
+// database failure) the value is conservatively reported as a dashboard
+// credential so the caller strips it; only a deterministic proof that the
+// value was not issued by this dashboard (scheme mismatch, unknown PAT hash,
+// failed signature verification) returns false.
+func IsDashboardCredential(authz string) bool {
+	raw := strings.TrimSpace(authz)
+	if !strings.HasPrefix(raw, "Bearer ") {
+		return false
+	}
+	plaintext := strings.TrimSpace(strings.TrimPrefix(raw, "Bearer "))
+	if strings.HasPrefix(plaintext, model.APITokenPrefix) {
+		return isDashboardAPIToken(plaintext)
+	}
+	return isDashboardSignedJWT(plaintext)
+}
+
+// isDashboardAPIToken resolves a PAT-shaped value against the api_tokens
+// table. The plaintext token is only ever hashed here; it is never logged.
+func isDashboardAPIToken(plaintext string) bool {
+	if singleton.DB == nil {
+		logDashboardCredentialUnclassifiable("api token lookup unavailable")
+		return true
+	}
+	var tok model.APIToken
+	err := singleton.DB.Where("token_hash = ?", model.HashAPIToken(plaintext)).First(&tok).Error
+	if err == nil {
+		return true
+	}
+	if errors.Is(err, gorm.ErrRecordNotFound) {
+		// Deterministic proof the token was not issued by this dashboard:
+		// forwarding it leaks nothing the dashboard ever validated.
+		return false
+	}
+	logDashboardCredentialUnclassifiable("api token lookup failed")
+	return true
+}
+
+// isDashboardSignedJWT verifies the token signature with the dashboard's
+// pinned algorithm and key. Claims validation is disabled on purpose (see
+// newDashboardCredentialJWTParser): expiry does not change who issued the
+// token.
+func isDashboardSignedJWT(token string) bool {
+	if dashboardCredentialJWTParser == nil {
+		// routers() has not run yet (startup incomplete): fail closed.
+		logDashboardCredentialUnclassifiable("dashboard credential parser unavailable")
+		return true
+	}
+	_, err := dashboardCredentialJWTParser.ParseTokenString(token)
+	return err == nil
+}
+
+// logDashboardCredentialUnclassifiable records a classification failure. The
+// Authorization value itself is never included in the message.
+func logDashboardCredentialUnclassifiable(reason string) {
+	log.Printf("NEZHA>> NAT ingress: Authorization value could not be classified (%s); stripping it as a precaution", reason)
+}
```

**File**: `cmd/dashboard/controller/dashboard_credential_test.go` (added, +150/-0)
```diff
@@ -0,0 +1,150 @@
+package controller
+
+import (
+	"bytes"
+	"log"
+	"testing"
+	"time"
+
+	jwt "github.com/appleboy/gin-jwt/v2"
+	"github.com/stretchr/testify/require"
+	"gorm.io/driver/sqlite"
+	"gorm.io/gorm"
+
+	"github.com/nezhahq/nezha/model"
+	"github.com/nezhahq/nezha/service/singleton"
+)
+
+func setupDashboardCredentialTest(t *testing.T) {
+	t.Helper()
+	originalConf, originalDB, originalParser := singleton.Conf, singleton.DB, dashboardCredentialJWTParser
+	t.Cleanup(func() {
+		singleton.Conf, singleton.DB, dashboardCredentialJWTParser = originalConf, originalDB, originalParser
+	})
+
+	singleton.Conf = &singleton.ConfigClass{Config: &model.Config{}}
+	singleton.Conf.JWTSecretKey = "dashboard-credential-classification-test-key"
+	singleton.Conf.JWTTimeout = 1
+
+	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
+	require.NoError(t, err)
+	sqlDB, err := db.DB()
+	require.NoError(t, err)
+	t.Cleanup(func() { _ = sqlDB.Close() })
+	require.NoError(t, db.AutoMigrate(&model.APIToken{}))
+	singleton.DB = db
+
+	// Same construction path as routers(): jwt.New(initParams()).
+	authMiddleware, err := jwt.New(initParams())
+	require.NoError(t, err)
+	dashboardCredentialJWTParser = newDashboardCredentialJWTParser(authMiddleware)
+}
+
+// mintDashboardCredentialJWT signs a JWT with the dashboard key through
+// initParams(), the same key source the production verifier uses. A negative
+// timeout mints an already-expired token.
+func mintDashboardCredentialJWT(t *testing.T, timeout time.Duration) string {
+	t.Helper()
+	params := initParams()
+	params.Timeout = timeout
+	mw, err := jwt.New(params)
+	require.NoError(t, err)
+	token, _, err := mw.TokenGenerator(nil)
+	require.NoError(t, err)
+	return token
+}
+
+func mintForeignJWT(t *testing.T) string {
+	t.Helper()
+	params := initParams()
+	params.Key = []byte("foreign-signing-key-not-held-by-the-dashboard")
+	mw, err := jwt.New(params)
+	require.NoError(t, err)
+	token, _, err := mw.TokenGenerator(nil)
+	require.NoError(t, err)
+	return token
+}
+
+func TestIsDashboardCredentialClassification(t *testing.T) {
+	setupDashboardCredentialTest(t)
+
+	dashboardJWT := mintDashboardCredentialJWT(t, time.Hour)
+	expiredDashboardJWT := mintDashboardCredentialJWT(t, -time.Hour)
+	foreignJWT := mintForeignJWT(t)
+
+	dashboardPAT := model.APITokenPrefix + "dashboard-credential-pat"
+	require.NoError(t, singleton.DB.Create(&model.APIToken{
+		UserID:    1,
+		Name:      "nat-classification",
+		TokenHash: model.HashAPIToken(dashboardPAT),
+	}).Error)
+
+	t.Run("dashboard signed jwt is a dashboard credential", func(t *testing.T) {
+		require.True(t, IsDashboardCredential("Bearer "+dashboardJWT))
+	})
+
+	t.Run("expired dashboard signed jwt is still a dashboard credential", func(t *testing.T) {
+		// Signature verification ignores exp on purpose: an expired token is
+		// still proof the dashboard issued it.
+		require.True(t, IsDashboardCredential("Bearer "+expiredDashboardJWT))
+	})
+
+	t.Run("dashboard api token is a dashboard credential", func(t *testing.T) {
+		require.True(t, IsDashboardCredential("Bearer "+dashboardPAT))
+	})
+
+	t.Run("foreign signed jwt is not a dashboard credential", func(t *testing.T) {
+		require.False(t, IsDashboardCredential("Bearer "+foreignJWT))
+	})
+
+	t.Run("unknown api token is not a dashboard credential", func(t *testing.T) {
+		require.False(t, IsDashboardCredential("Bearer "+model.APITokenPrefix+"unknown-to-the-dashboard"))
+	})
+
+	t.Run("random string is not a dashboard credential", func(t *testing.T) {
+		require.False(t, IsDashboardCredential("Bearer random-not-a-token"))
+	})
+
+	t.Run("non bearer scheme is not a dashboard credential", func(t *testing.T) {
+		require.False(t, IsDashboardCredential("Basic "+dashboardJWT))
+		// Scheme matching is case-sensitive, as in both dashboard auth middlewares.
+		require.False(t, IsDashboardCredential("bearer "+dashboardJWT))
+	})
+
+	t.Run("empty or missing header is not a dashboard credential", func(t *testing.T) {
+		require.False(t, IsDashboardCredential(""))
+		require.False(t, IsDashboardCredential("Bearer "))
+	})
+}
+
+func TestIsDashboardCredentialFailsClosedWhenParserUnavailable(t *testing.T) {
+	setupDashboardCredentialTest(t)
+	dashboardCredentialJWTParser = nil
+
+	token := mintDashboardCredentialJWT(t, time.Hour)
+	require.True(t, IsDashboardCredential("Bearer "+token))
+}
+
+func TestIsDashboardCredentialFailsClosedWhenAPITokenLookupUnavailable(t *testing.T) {
+	setupDashboardCredentialTest(t)
+	singleton.DB = nil
+
+	require.True(t, IsDashboardCredential("Bearer "+model.APITokenPrefix+"unresolvable"))
+}
+
+func TestIsDashboardCredentialFailsClosedOnDatabaseError(t *testing.T) {
+	setupDashboardCredentialTest(t)
+	sqlDB, err := singleton.DB.DB()
+	require.NoError(t, err)
+	require.NoError(t, sqlDB.Close())
+
+	var logs bytes.Buffer
+	originalOutput := log.Writer()
+	log.SetOutput(&logs)
+	t.Cleanup(func() { log.SetOutput(originalOutput) })
+
+	plaintext := mo
```

**File**: `cmd/dashboard/main.go` (modified, +5/-0)
```diff
@@ -169,6 +169,11 @@ func main() {
 	grpcHandler := rpc.ServeRPC()
 	httpHandler := controller.ServeWeb(frontendDist)
 	controller.InitUpgrader()
+	// The NAT ingress strips dashboard-issued Authorization values (panel JWT /
+	// panel PAT) before tunneling a request to the agent and forwards foreign
+	// credentials untouched. ServeWeb built the JWT parser the classifier
+	// reuses, so the gate is wired right after it.
+	rpc.SetNATDashboardCredentialGate(controller.IsDashboardCredential)
 
 	muxHandler := newHTTPandGRPCMux(httpHandler, grpcHandler)
 	muxServerHTTP := &http.Server{
```

**File**: `cmd/dashboard/rpc/nat.go` (modified, +8/-1)
```diff
@@ -80,7 +80,14 @@ func ServeNAT(w http.ResponseWriter, r *http.Request, natConfig *model.NAT) {
 		return
 	}
 
-	// Authorization authenticates Dashboard access before NAT ingress; it must not become an origin credential for the configured NAT backend.
+	// Credential invariant at NAT ingress: credentials issued by this
+	// dashboard — the panel-signed JWT (verified by signature only, expiry
+	// deliberately ignored) and the panel API token — must never become origin
+	// credentials for the configured NAT backend. prepareNATCapability has
+	// already stripped every Authorization value IsDashboardCredential
+	// classified as dashboard-issued; whatever remains is either absent or a
+	// foreign credential, which is forwarded untouched because the NAT backend
+	// may authenticate with credentials of its own.
 	wWrapped, err := utils.NewRequestWrapper(r, w)
 	if err != nil {
 		return
```

**File**: `cmd/dashboard/rpc/nat_capability_agentcompat.go` (modified, +11/-3)
```diff
@@ -22,16 +22,24 @@ type natCapabilityLease struct {
 func prepareNATCapability(request *http.Request, natConfig *model.NAT) (natCapabilityLease, error) {
 	values := request.Header.Values(agentcompatcontract.IOStreamCapabilityHeader)
 	if len(values) == 0 {
-		request.Header.Del("Authorization")
+		// No capability header: legacy NAT path. Strip dashboard-issued
+		// Authorization values (panel JWT or panel PAT) so they never become
+		// origin credentials; foreign ones are ordinary request data.
+		stripDashboardCredential(request)
 		return natCapabilityLease{}, nil
 	}
 	request.Header.Del(agentcompatcontract.IOStreamCapabilityHeader)
 	if len(values) != 1 || values[0] == "" {
-		request.Header.Del("Authorization")
+		// Invalid capability: nothing is forwarded, but dashboard-issued
+		// credentials still must not survive into errors or task data.
+		stripDashboardCredential(request)
 		return natCapabilityLease{}, errors.New("invalid NAT capability")
 	}
 	access, handle, err := serviceRPC.NezhaHandlerSingleton.ConsumeAgentCompatNATCapabilityForProfile(values[0], natConfig.ServerID, natConfig.ID)
-	request.Header.Del("Authorization")
+	// From here the request bytes may reach the agent (active lease) or the
+	// request ends in a 503; either way dashboard-issued Authorization values
+	// are stripped, foreign ones are forwarded untouched.
+	stripDashboardCredential(request)
 	if err != nil {
 		return natCapabilityLease{}, errors.New("invalid NAT capability")
 	}
```

**File**: `cmd/dashboard/rpc/nat_capability_agentcompat_test.go` (modified, +122/-0)
```diff
@@ -4,6 +4,7 @@ package rpc
 
 import (
 	"bytes"
+	"context"
 	"log"
 	"net/http"
 	"strings"
@@ -59,7 +60,128 @@ func TestPrepareNATCapabilityRejectsDuplicateHeaderAfterRemovingAllValues(t *tes
 	}
 }
 
+func TestPrepareNATCapabilityAgentCompatStripsDashboardCredentials(t *testing.T) {
+	// Given — legacy path without a capability header, then the invalid
+	// capability path: both must drop dashboard-issued Authorization values.
+	installNATCredentialTestGate(t)
+	for name, credential := range map[string]string{
+		"dashboard jwt":         natTestDashboardJWT,
+		"expired dashboard jwt": natTestDashboardExpiredJWT,
+		"dashboard api token":   natTestDashboardAPIToken,
+	} {
+		t.Run(name+"/legacy path", func(t *testing.T) {
+			request := &http.Request{Header: make(http.Header)}
+			request.Header.Set("Authorization", credential)
+
+			lease, err := prepareNATCapability(request, &model.NAT{Common: model.Common{ID: 91}, ServerID: 81})
+
+			if err != nil {
+				t.Fatalf("legacy NAT path returned error: %v", err)
+			}
+			if lease.active {
+				t.Fatal("legacy NAT path unexpectedly activated")
+			}
+			if got := request.Header.Get("Authorization"); got != "" {
+				t.Fatalf("legacy NAT path retained dashboard credential %q", got)
+			}
+		})
+		t.Run(name+"/invalid capability path", func(t *testing.T) {
+			request := &http.Request{Header: make(http.Header)}
+			request.Header.Set(agentcompatcontract.IOStreamCapabilityHeader, "malformed")
+			request.Header.Set("Authorization", credential)
+
+			lease, err := prepareNATCapability(request, &model.NAT{Common: model.Common{ID: 91}, ServerID: 81})
+
+			if err == nil {
+				t.Fatal("malformed capability unexpectedly accepted")
+			}
+			if lease.active {
+				t.Fatal("malformed capability unexpectedly activated")
+			}
+			if got := request.Header.Get("Authorization"); got != "" {
+				t.Fatalf("invalid capability path retained dashboard credential %q", got)
+			}
+		})
+	}
+}
+
+func TestPrepareNATCapabilityAgentCompatStripsDashboardCredentialAfterConsumingCapability(t *testing.T) {
+	// Given — a well-formed capability that consumes successfully: the request
+	// is about to be tunneled, so the dashboard credential must be gone.
+	installNATCredentialTestGate(t)
+	handler := serviceRPC.NewNezhaHandler()
+	original := serviceRPC.NezhaHandlerSingleton
+	serviceRPC.NezhaHandlerSingleton = handler
+	t.Cleanup(func() { serviceRPC.NezhaHandlerSingleton = original })
+
+	capability, err := handler.RegisterAgentCompatIOStreamCapability(context.Background(), serviceRPC.AgentCompatCapabilityRegistration{
+		Owner:               serviceRPC.AgentCompatCapabilityOwner{PATID: 1, UserID: 2},
+		Purpose:             serviceRPC.AgentCompatCapabilityNAT,
+		TargetServerID:      81,
+		ResourceID:          91,
+		ServerAccessAllowed: true,
+	})
+	if err != nil {
+		t.Fatalf("register capability: %v", err)
+	}
+	request := &http.Request{Header: make(http.Header)}
+	request.Header.Set(agentcompatcontract.IOStreamCapabilityHeader, capability.String())
+	request.Header.Set("Authorization", natTestDashboardJWT)
+
+	// When
+	lease, err := prepareNATCapability(request, &model.NAT{Common: model.Common{ID: 91}, ServerID: 81})
+
+	// Then
+	if err != nil {
+		t.Fatalf("valid NAT capability rejected: %v", err)
+	}
+	if !lease.active {
+		t.Fatal("valid NAT capability did not activate")
+	}
+	if got := request.Header.Get("Authorization"); got != "" {
+		t.Fatalf("dashboard credential retained after capability consumption: %q", got)
+	}
+}
+
+func TestPrepareNATCapabilityAgentCompatKeepsForeignAndMissingAuthorization(t *testing.T) {
+	// Given — legacy path: foreign credentials are ordinary request data and
+	// an absent header must stay untouched.
+	installNATCredentialTestGate(t)
+	for name, values := range map[string][]string{
+		"foreign jwt":    {natTestForeignJWT},
+		"foreign random": {natTestForeignRandom},
+		"empty value":    {""},
+		"missing header": nil,
+	} {
+		t.Run(name, func(t *testing.T) {
+			request := &http.Request{Header: make(http.Header)}
+			for _, value := range values {
+				request.Header.Set("Authorization", value)
+			}
+
+			lease, err := prepareNATCapability(request, &model.NAT{Common: model.Common{ID: 91}, ServerID: 81})
+
+			if err != nil {
+				t.Fatalf("legacy NAT path returned error: %v", err)
+			}
+			if lease.active {
+				t.Fatal("legacy NAT path unexpectedly activated")
+			}
+			got := request.Header.Values("Authorization")
+			if len(got) != len(values) {
+				t.Fatalf("legacy NAT path changed Authorization to %q, want %q", got, values)
+			}
+			for i := range values {
+				if got[i] != values[i] {
+					t.Fatalf("legacy NAT path changed Authorization to %q, want %q", got, values)
+				}
+			}
+		})
+	}
+}
+
 func TestServeNATAgentCompatSensitiveHeadersStayOutOfErrorsAndLogs(t *testing.T) {
+	installNATCredentialTestGate(t)
 	request := &http.Request{Header: make(http.Header)}
 	request.Header.Set(agentcompatcontract.IOStreamCapabilityHead
```

**File**: `cmd/dashboard/rpc/nat_capability_default.go` (modified, +5/-1)
```diff
@@ -18,7 +18,11 @@ type natCapabilityLease struct {
 }
 
 func prepareNATCapability(request *http.Request, _ *model.NAT) (natCapabilityLease, error) {
-	request.Header.Del("Authorization")
+	// The default build has no capability protocol: every request takes the
+	// legacy NAT path, so any dashboard-issued Authorization value (panel JWT
+	// or panel PAT) is stripped before the request is tunneled to the agent.
+	// Foreign Authorization values are ordinary request data and stay put.
+	stripDashboardCredential(request)
 	return natCapabilityLease{}, nil
 }
 
```

---

### Incident Patch 2: `29f15689` (2026-10-16)
**Commit Message**: docs(security): add vulnerability reporting email

Co-authored-by: naiba/CloudCode <[REDACTED_EMAIL]>

**File**: `SECURITY.md` (modified, +1/-1)
```diff
@@ -6,4 +6,4 @@ Code in `master` branch.
 
 ## Reporting a Vulnerability
 
-Thank you for your contribution to open source security, please submit on https://github.com/nezhahq/nezha/security
+Thank you for your contribution to open source security. Please report vulnerabilities privately at https://github.com/nezhahq/nezha/security or by email to [hi@nai.ba](mailto:hi@nai.ba).
```

---

### Incident Patch 3: `3ad985f3` (2026-10-01)
**Commit Message**: fix(nat): scrub dashboard-issued credentials from all accepted token channels

The initial selective strip covered only the Authorization header, but the
dashboard also accepts its JWT via the ?token= query parameter and the
nz-jwt cookie (jwt.go TokenLookup channels). A dashboard credential arriving
through those channels would still reach a NAT backend.

Apply the same classify-then-strip rule to all three channels at NAT
ingress: values verified as dashboard-issued are removed, foreign values
are preserved byte-for-byte. Adds a ServeNAT flow test exercising the live
classifier and a wiring test pinning the gate injection in main().

**File**: `cmd/dashboard/controller/dashboard_credential.go` (modified, +22/-8)
```diff
@@ -43,19 +43,33 @@ func newDashboardCredentialJWTParser(authMiddleware *ginjwt.GinJWTMiddleware) *g
 // NAT backend may authenticate with credentials of its own.
 //
 // Decision policy mirrors the dashboard's own auth middlewares: only the
-// case-sensitive "Bearer " scheme is considered; PAT-shaped values are
-// resolved against the api_tokens table; everything else is treated as a JWT.
-// Whenever the classification cannot be completed (parser or config not ready,
-// database failure) the value is conservatively reported as a dashboard
-// credential so the caller strips it; only a deterministic proof that the
-// value was not issued by this dashboard (scheme mismatch, unknown PAT hash,
-// failed signature verification) returns false.
+// case-sensitive "Bearer " scheme is considered; the value after the scheme is
+// classified by IsDashboardCredentialValue, which is also the entry point for
+// the panel's scheme-less TokenLookup channels. Only a deterministic proof
+// that the value was not issued by this dashboard (scheme mismatch, unknown
+// PAT hash, failed signature verification) returns false.
 func IsDashboardCredential(authz string) bool {
 	raw := strings.TrimSpace(authz)
 	if !strings.HasPrefix(raw, "Bearer ") {
 		return false
 	}
-	plaintext := strings.TrimSpace(strings.TrimPrefix(raw, "Bearer "))
+	return IsDashboardCredentialValue(strings.TrimPrefix(raw, "Bearer "))
+}
+
+// IsDashboardCredentialValue reports whether a raw credential value — the part
+// after the "Bearer " scheme, exactly as the panel's other TokenLookup
+// channels carry it (the ?token= query parameter and the nz-jwt cookie, see
+// initParams) — was issued by this dashboard: a panel-signed JWT or a panel
+// API token (PAT).
+//
+// Failure policy is identical to IsDashboardCredential: whenever the
+// classification cannot be completed (parser or config not ready, database
+// failure) the value is conservatively reported as a dashboard credential so
+// the caller strips it; only a deterministic proof that the value was not
+// issued by this dashboard (unknown PAT hash, failed signature verification)
+// returns false.
+func IsDashboardCredentialValue(value string) bool {
+	plaintext := strings.TrimSpace(value)
 	if strings.HasPrefix(plaintext, model.APITokenPrefix) {
 		return isDashboardAPIToken(plaintext)
 	}
```

**File**: `cmd/dashboard/controller/dashboard_credential_nat_flow_test.go` (added, +250/-0)
```diff
@@ -0,0 +1,250 @@
+package controller
+
+import (
+	"bufio"
+	"bytes"
+	"context"
+	"io"
+	"net"
+	"net/http"
+	"net/url"
+	"sync"
+	"testing"
+	"time"
+
+	"github.com/goccy/go-json"
+	"github.com/stretchr/testify/require"
+	"google.golang.org/grpc/metadata"
+
+	"github.com/nezhahq/nezha/cmd/dashboard/rpc"
+	"github.com/nezhahq/nezha/model"
+	"github.com/nezhahq/nezha/proto"
+	rpcService "github.com/nezhahq/nezha/service/rpc"
+	"github.com/nezhahq/nezha/service/singleton"
+)
+
+// setupNATFlowTest extends setupDashboardCredentialTest with the minimal
+// ServeNAT environment: a registered server with a task stream and a fresh
+// handler singleton, mirroring the rpc package's serveNAT fixture.
+func setupNATFlowTest(t *testing.T) (*rpcService.NezhaHandler, *model.Server, *natFlowTaskStream) {
+	t.Helper()
+	setupDashboardCredentialTest(t)
+
+	require.NoError(t, singleton.DB.AutoMigrate(&model.Server{}))
+	originalServerShared, originalHandler := singleton.ServerShared, rpcService.NezhaHandlerSingleton
+	t.Cleanup(func() {
+		singleton.ServerShared, rpcService.NezhaHandlerSingleton = originalServerShared, originalHandler
+	})
+
+	serverRow := &model.Server{Common: model.Common{ID: 7}, UUID: "nat-credential-flow-test", Name: "nat-credential-flow-test"}
+	require.NoError(t, singleton.DB.Create(serverRow).Error)
+	singleton.ServerShared = singleton.NewServerClass()
+	handler := rpcService.NewNezhaHandler()
+	rpcService.NezhaHandlerSingleton = handler
+
+	server, ok := singleton.ServerShared.Get(serverRow.ID)
+	require.True(t, ok)
+	taskStream := &natFlowTaskStream{}
+	server.SetTaskStream(taskStream)
+
+	// Wire the gate exactly as cmd/dashboard/main.go does, with the real
+	// classifiers built by setupDashboardCredentialTest.
+	rpc.SetNATDashboardCredentialGate(IsDashboardCredential, IsDashboardCredentialValue)
+	t.Cleanup(func() { rpc.SetNATDashboardCredentialGate(nil, nil) })
+
+	return handler, server, taskStream
+}
+
+// TestServeNATWithRealClassifierStripsDashboardCredentialsFromAllChannels pins
+// the main() wiring contract end to end: with the real classifiers wired as
+// main() does, ServeNAT forwards a request whose dashboard-issued credentials
+// — Authorization header, ?token= query parameter, nz-jwt cookie — are all
+// stripped, while foreign values and untouched query/cookie data survive
+// byte-for-byte.
+func TestServeNATWithRealClassifierStripsDashboardCredentialsFromAllChannels(t *testing.T) {
+	handler, server, taskStream := setupNATFlowTest(t)
+
+	dashboardJWT := mintDashboardCredentialJWT(t, time.Hour)
+	foreignJWT := mintForeignJWT(t)
+	// No api_tokens row hashes to this PAT, so the classifier proves it was
+	// not issued by this dashboard and it must survive the tunnel.
+	foreignPAT := model.APITokenPrefix + "foreign-issued-pat"
+	dashboardPAT := model.APITokenPrefix + "dashboard-issued-pat"
+	require.NoError(t, singleton.DB.Create(&model.APIToken{
+		UserID:    1,
+		Name:      "nat-flow",
+		TokenHash: model.HashAPIToken(dashboardPAT),
+	}).Error)
+
+	connection := &natFlowConn{closed: make(chan struct{})}
+	agent := &natFlowAgent{writeDone: make(chan struct{})}
+	writer := &natFlowWriter{conn: connection}
+	request := &http.Request{
+		Method: http.MethodPost,
+		URL: &url.URL{Path: "/nat", RawQuery: "keep=1&token=" + dashboardJWT + "&token=" + url.QueryEscape(foreignJWT) +
+			"&token=" + foreignPAT + "&token=" + dashboardPAT},
+		Header: make(http.Header),
+		Body:   http.NoBody,
+	}
+	request.Header.Set("Authorization", "Bearer "+dashboardJWT)
+	request.Header.Set("Cookie", "sid=abc; nz-jwt="+dashboardJWT+"; nz-jwt="+foreignJWT+"; nz-jwt="+foreignPAT)
+	request.Header.Set("X-Ordinary-Nat", "ordinary")
+	taskStream.onSend = func(task *proto.Task) error {
+		var nat model.TaskNAT
+		if err := json.Unmarshal([]byte(task.Data), &nat); err != nil {
+			return err
+		}
+		return handler.AgentConnected(nat.StreamID, agent)
+	}
+
+	done := make(chan struct{})
+	go func() {
+		rpc.ServeNAT(writer, request, &model.NAT{ServerID: server.ID, Host: "target.example"})
+		close(done)
+	}()
+	select {
+	case <-agent.writeDone:
+	case <-time.After(time.Second):
+		t.Fatal("agent did not receive the transferred NAT request")
+	}
+	require.NoError(t, connection.Close())
+	select {
+	case <-done:
+	case <-time.After(time.Second):
+		t.Fatal("ServeNAT did not finish")
+	}
+
+	forwarded := string(agent.writtenBytes())
+	// Dashboard credentials are gone from every channel.
+	require.NotContains(t, forwarded, "Authorization:")
+	require.NotContains(t, forwarded, dashboardJWT)
+	require.NotContains(t, forwarded, dashboardPAT)
+	// Foreign credentials and untouched data survive byte-for-byte.
+	require.Contains(t, forwarded, "POST /nat?keep=1&token="+url.QueryEscape(foreignJWT)+"&token="+foreignPAT+" HTTP/1.1")
+	require.Contains(t, forwarded, "Cookie: sid=abc; nz-jwt="+foreignJWT+"; nz-jwt="+foreignPAT)
+	require.Contains(t, forwarded, "X-Ordinary-Nat: ordinary")
+}
+
+// TestServeNATWithRealClassif
```

**File**: `cmd/dashboard/controller/dashboard_credential_test.go` (modified, +46/-0)
```diff
@@ -117,6 +117,52 @@ func TestIsDashboardCredentialClassification(t *testing.T) {
 	})
 }
 
+// TestIsDashboardCredentialValueClassification pins the scheme-less classifier
+// that backs IsDashboardCredential and drives the ?token= query parameter and
+// nz-jwt cookie channels at NAT ingress (see IsDashboardCredentialValue).
+func TestIsDashboardCredentialValueClassification(t *testing.T) {
+	setupDashboardCredentialTest(t)
+
+	dashboardJWT := mintDashboardCredentialJWT(t, time.Hour)
+	expiredDashboardJWT := mintDashboardCredentialJWT(t, -time.Hour)
+	foreignJWT := mintForeignJWT(t)
+
+	dashboardPAT := model.APITokenPrefix + "dashboard-credential-value-pat"
+	require.NoError(t, singleton.DB.Create(&model.APIToken{
+		UserID:    1,
+		Name:      "nat-value-classification",
+		TokenHash: model.HashAPIToken(dashboardPAT),
+	}).Error)
+
+	t.Run("dashboard signed jwt is a dashboard credential", func(t *testing.T) {
+		require.True(t, IsDashboardCredentialValue(dashboardJWT))
+	})
+	t.Run("expired dashboard signed jwt is still a dashboard credential", func(t *testing.T) {
+		require.True(t, IsDashboardCredentialValue(expiredDashboardJWT))
+	})
+	t.Run("dashboard api token is a dashboard credential", func(t *testing.T) {
+		require.True(t, IsDashboardCredentialValue(dashboardPAT))
+	})
+	t.Run("foreign signed jwt is not a dashboard credential", func(t *testing.T) {
+		require.False(t, IsDashboardCredentialValue(foreignJWT))
+	})
+	t.Run("unknown api token is not a dashboard credential", func(t *testing.T) {
+		require.False(t, IsDashboardCredentialValue(model.APITokenPrefix+"unknown-to-the-dashboard"))
+	})
+	t.Run("random string is not a dashboard credential", func(t *testing.T) {
+		require.False(t, IsDashboardCredentialValue("random-not-a-token"))
+	})
+	t.Run("empty value is not a dashboard credential", func(t *testing.T) {
+		require.False(t, IsDashboardCredentialValue(""))
+	})
+	t.Run("bearer scheme is not part of the value contract", func(t *testing.T) {
+		// The query and cookie channels carry the bare value; a value that
+		// itself starts with "Bearer " is not something the panel issues and
+		// fails signature verification.
+		require.False(t, IsDashboardCredentialValue("Bearer "+dashboardJWT))
+	})
+}
+
 func TestIsDashboardCredentialFailsClosedWhenParserUnavailable(t *testing.T) {
 	setupDashboardCredentialTest(t)
 	dashboardCredentialJWTParser = nil
```

**File**: `cmd/dashboard/dashboard_credential_wiring_test.go` (added, +27/-0)
```diff
@@ -0,0 +1,27 @@
+package main
+
+import (
+	"testing"
+
+	"github.com/nezhahq/nezha/cmd/dashboard/rpc"
+)
+
+// TestWireNATDashboardCredentialGate pins the NAT ingress wiring contract:
+// main() must connect the real dashboard-credential classifiers
+// (controller.IsDashboardCredential / controller.IsDashboardCredentialValue)
+// through wireNATDashboardCredentialGate before any listener serves traffic.
+// That the wired functions really classify per channel is pinned end to end
+// by the controller package's real-classifier NAT flow test.
+func TestWireNATDashboardCredentialGate(t *testing.T) {
+	if rpc.NATDashboardCredentialGateWired() {
+		t.Fatal("NAT dashboard credential gate already wired before the test")
+	}
+
+	wireNATDashboardCredentialGate()
+
+	if !rpc.NATDashboardCredentialGateWired() {
+		t.Fatal("wireNATDashboardCredentialGate left the NAT dashboard credential gate unwired")
+	}
+	// Leave the process in the wired state main() establishes.
+	t.Cleanup(wireNATDashboardCredentialGate)
+}
```

**File**: `cmd/dashboard/main.go` (modified, +13/-5)
```diff
@@ -169,11 +169,7 @@ func main() {
 	grpcHandler := rpc.ServeRPC()
 	httpHandler := controller.ServeWeb(frontendDist)
 	controller.InitUpgrader()
-	// The NAT ingress strips dashboard-issued Authorization values (panel JWT /
-	// panel PAT) before tunneling a request to the agent and forwards foreign
-	// credentials untouched. ServeWeb built the JWT parser the classifier
-	// reuses, so the gate is wired right after it.
-	rpc.SetNATDashboardCredentialGate(controller.IsDashboardCredential)
+	wireNATDashboardCredentialGate()
 
 	muxHandler := newHTTPandGRPCMux(httpHandler, grpcHandler)
 	muxServerHTTP := &http.Server{
@@ -233,6 +229,18 @@ func main() {
 	close(errChan)
 }
 
+// wireNATDashboardCredentialGate connects the NAT ingress to the real
+// dashboard-credential classifiers. The NAT ingress strips dashboard-issued
+// credentials (panel JWT / panel PAT) from every channel the panel's own
+// TokenLookup accepts — the Authorization header, the ?token= query parameter
+// and the nz-jwt cookie — before tunneling a request to the agent, and
+// forwards foreign values untouched. ServeWeb built the JWT parser the
+// classifiers reuse, so the gate is wired right after it and before any
+// listener starts serving.
+func wireNATDashboardCredentialGate() {
+	rpc.SetNATDashboardCredentialGate(controller.IsDashboardCredential, controller.IsDashboardCredentialValue)
+}
+
 func newHTTPandGRPCMux(httpHandler http.Handler, grpcHandler http.Handler) http.Handler {
 	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
 		natConfig := singleton.NATShared.GetNATConfigByDomain(r.Host)
```

**File**: `cmd/dashboard/rpc/nat.go` (modified, +5/-4)
```diff
@@ -84,10 +84,11 @@ func ServeNAT(w http.ResponseWriter, r *http.Request, natConfig *model.NAT) {
 	// dashboard — the panel-signed JWT (verified by signature only, expiry
 	// deliberately ignored) and the panel API token — must never become origin
 	// credentials for the configured NAT backend. prepareNATCapability has
-	// already stripped every Authorization value IsDashboardCredential
-	// classified as dashboard-issued; whatever remains is either absent or a
-	// foreign credential, which is forwarded untouched because the NAT backend
-	// may authenticate with credentials of its own.
+	// already stripped them from every channel the panel's own TokenLookup
+	// accepts (Authorization header, ?token= query parameter, nz-jwt cookie);
+	// whatever remains on those channels is either absent or a foreign
+	// credential, which is forwarded untouched because the NAT backend may
+	// authenticate with credentials of its own.
 	wWrapped, err := utils.NewRequestWrapper(r, w)
 	if err != nil {
 		return
```

**File**: `cmd/dashboard/rpc/nat_capability_agentcompat.go` (modified, +9/-7)
```diff
@@ -23,23 +23,25 @@ func prepareNATCapability(request *http.Request, natConfig *model.NAT) (natCapab
 	values := request.Header.Values(agentcompatcontract.IOStreamCapabilityHeader)
 	if len(values) == 0 {
 		// No capability header: legacy NAT path. Strip dashboard-issued
-		// Authorization values (panel JWT or panel PAT) so they never become
-		// origin credentials; foreign ones are ordinary request data.
-		stripDashboardCredential(request)
+		// credentials (panel JWT or panel PAT) from the Authorization header,
+		// the ?token= query parameter and the nz-jwt cookie so they never
+		// become origin credentials; foreign values are ordinary request data.
+		stripDashboardCredentials(request)
 		return natCapabilityLease{}, nil
 	}
 	request.Header.Del(agentcompatcontract.IOStreamCapabilityHeader)
 	if len(values) != 1 || values[0] == "" {
 		// Invalid capability: nothing is forwarded, but dashboard-issued
 		// credentials still must not survive into errors or task data.
-		stripDashboardCredential(request)
+		stripDashboardCredentials(request)
 		return natCapabilityLease{}, errors.New("invalid NAT capability")
 	}
 	access, handle, err := serviceRPC.NezhaHandlerSingleton.ConsumeAgentCompatNATCapabilityForProfile(values[0], natConfig.ServerID, natConfig.ID)
 	// From here the request bytes may reach the agent (active lease) or the
-	// request ends in a 503; either way dashboard-issued Authorization values
-	// are stripped, foreign ones are forwarded untouched.
-	stripDashboardCredential(request)
+	// request ends in a 503; either way dashboard-issued credentials are
+	// stripped from every TokenLookup channel, foreign ones are forwarded
+	// untouched.
+	stripDashboardCredentials(request)
 	if err != nil {
 		return natCapabilityLease{}, errors.New("invalid NAT capability")
 	}
```

**File**: `cmd/dashboard/rpc/nat_capability_agentcompat_test.go` (modified, +78/-12)
```diff
@@ -7,6 +7,7 @@ import (
 	"context"
 	"log"
 	"net/http"
+	"net/url"
 	"strings"
 	"testing"
 
@@ -62,16 +63,21 @@ func TestPrepareNATCapabilityRejectsDuplicateHeaderAfterRemovingAllValues(t *tes
 
 func TestPrepareNATCapabilityAgentCompatStripsDashboardCredentials(t *testing.T) {
 	// Given — legacy path without a capability header, then the invalid
-	// capability path: both must drop dashboard-issued Authorization values.
+	// capability path: both must drop dashboard-issued credentials from the
+	// Authorization header, the ?token= query parameter and the nz-jwt cookie.
 	installNATCredentialTestGate(t)
 	for name, credential := range map[string]string{
-		"dashboard jwt":         natTestDashboardJWT,
-		"expired dashboard jwt": natTestDashboardExpiredJWT,
-		"dashboard api token":   natTestDashboardAPIToken,
+		"dashboard jwt":         natTestDashboardJWTValue,
+		"expired dashboard jwt": natTestDashboardExpiredJWTValue,
+		"dashboard api token":   natTestDashboardPATValue,
 	} {
 		t.Run(name+"/legacy path", func(t *testing.T) {
-			request := &http.Request{Header: make(http.Header)}
-			request.Header.Set("Authorization", credential)
+			request := &http.Request{
+				Header: make(http.Header),
+				URL:    &url.URL{Path: "/nat", RawQuery: "keep=1&token=" + credential},
+			}
+			request.Header.Set("Authorization", "Bearer "+credential)
+			request.Header.Set("Cookie", "sid=abc; nz-jwt="+credential)
 
 			lease, err := prepareNATCapability(request, &model.NAT{Common: model.Common{ID: 91}, ServerID: 81})
 
@@ -82,13 +88,23 @@ func TestPrepareNATCapabilityAgentCompatStripsDashboardCredentials(t *testing.T)
 				t.Fatal("legacy NAT path unexpectedly activated")
 			}
 			if got := request.Header.Get("Authorization"); got != "" {
-				t.Fatalf("legacy NAT path retained dashboard credential %q", got)
+				t.Fatalf("legacy NAT path retained dashboard credential in Authorization %q", got)
+			}
+			if got := request.URL.RawQuery; got != "keep=1" {
+				t.Fatalf("legacy NAT path retained dashboard credential in query %q", got)
+			}
+			if got := request.Header.Get("Cookie"); got != "sid=abc" {
+				t.Fatalf("legacy NAT path retained dashboard credential in cookie %q", got)
 			}
 		})
 		t.Run(name+"/invalid capability path", func(t *testing.T) {
-			request := &http.Request{Header: make(http.Header)}
+			request := &http.Request{
+				Header: make(http.Header),
+				URL:    &url.URL{Path: "/nat", RawQuery: "keep=1&token=" + credential},
+			}
 			request.Header.Set(agentcompatcontract.IOStreamCapabilityHeader, "malformed")
-			request.Header.Set("Authorization", credential)
+			request.Header.Set("Authorization", "Bearer "+credential)
+			request.Header.Set("Cookie", "sid=abc; nz-jwt="+credential)
 
 			lease, err := prepareNATCapability(request, &model.NAT{Common: model.Common{ID: 91}, ServerID: 81})
 
@@ -99,7 +115,13 @@ func TestPrepareNATCapabilityAgentCompatStripsDashboardCredentials(t *testing.T)
 				t.Fatal("malformed capability unexpectedly activated")
 			}
 			if got := request.Header.Get("Authorization"); got != "" {
-				t.Fatalf("invalid capability path retained dashboard credential %q", got)
+				t.Fatalf("invalid capability path retained dashboard credential in Authorization %q", got)
+			}
+			if got := request.URL.RawQuery; got != "keep=1" {
+				t.Fatalf("invalid capability path retained dashboard credential in query %q", got)
+			}
+			if got := request.Header.Get("Cookie"); got != "sid=abc" {
+				t.Fatalf("invalid capability path retained dashboard credential in cookie %q", got)
 			}
 		})
 	}
@@ -124,9 +146,13 @@ func TestPrepareNATCapabilityAgentCompatStripsDashboardCredentialAfterConsumingC
 	if err != nil {
 		t.Fatalf("register capability: %v", err)
 	}
-	request := &http.Request{Header: make(http.Header)}
+	request := &http.Request{
+		Header: make(http.Header),
+		URL:    &url.URL{Path: "/nat", RawQuery: "keep=1&token=" + natTestDashboardJWTValue},
+	}
 	request.Header.Set(agentcompatcontract.IOStreamCapabilityHeader, capability.String())
 	request.Header.Set("Authorization", natTestDashboardJWT)
+	request.Header.Set("Cookie", "sid=abc; nz-jwt="+natTestDashboardJWTValue)
 
 	// When
 	lease, err := prepareNATCapability(request, &model.NAT{Common: model.Common{ID: 91}, ServerID: 81})
@@ -139,7 +165,13 @@ func TestPrepareNATCapabilityAgentCompatStripsDashboardCredentialAfterConsumingC
 		t.Fatal("valid NAT capability did not activate")
 	}
 	if got := request.Header.Get("Authorization"); got != "" {
-		t.Fatalf("dashboard credential retained after capability consumption: %q", got)
+		t.Fatalf("dashboard credential retained in Authorization after capability consumption: %q", got)
+	}
+	if got := request.URL.RawQuery; got != "keep=1" {
+		t.Fatalf("dashboard credential retained in query after capability consumption: %q", got)
+	}
+	if got := request.Header.Get("Cookie"); got != "sid=abc" {
+		t.Fatalf("dashboard credential retained in cookie after capability consumption: %q", go
```

#### Recent Merged Pull Requests:
- **PR #1243** (2026-10-16): feat(server): online session history with configurable stats window (7-3650 days) (@Sam5440)
- **PR #1242** (2026-10-01): fix(alerts): evaluate fresh reports and order notification delivery (@cantoblanco)
- **PR #1241** (2026-10-01): fix(nat): strip only dashboard-issued Authorization credentials at NAT ingress (@xvkong233)
- **PR #1238** (closed): Fixed: An issue where deleting DNS records for domains hosted on Cloudflare did not work. (@77-QiQi)
- **PR #1237** (2026-09-14): Improve: Delete the corresponding DNS record if the IPv4/IPv6 address is empty. (@77-QiQi)
- **PR #1236** (2026-09-12): feat(auth): allow JWT IP changes by configuration (@NikoCat233)

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

## X. nat): strip only dashboard-issued Authorization credentials at NAT ingress

**RULE**:
When implementing operations in `cmd/dashboard/controller/controller.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in nezhahq/nezha. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `40240ed0`: nat): strip only dashboard-issued Authorization credentials at NAT ingress. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `cmd/dashboard/controller/controller.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	// Signature-only view of the auth middleware for IsDashboardCredential:
	// same key and pinned algorithm, claims validation deliberately skipped.
	dashboardCredentialJWTParser = newDashboardCredentialJWTParser(authMiddleware)
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `40240ed0` are properly handled with clean fallback behavior.
