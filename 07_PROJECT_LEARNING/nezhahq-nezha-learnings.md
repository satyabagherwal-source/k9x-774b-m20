> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/nezhahq-nezha-learnings.md`  
> **Source**: github ([https://github.com/nezhahq/nezha](https://github.com/nezhahq/nezha))  
> **Source Version**: `22f2184e`  
> **License**: WTFPL  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-22T04:29:02.656Z  
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
> **Harvest Timestamp**: 2026-11-22T04:29:02.651Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `nezhahq/nezha`
- **Description**: :trollface: Self-hosted, lightweight server and website monitoring and O&M tool
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 10425 stars

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

### Incident Patch 1: `c9339e68` (2026-11-21)
**Commit Message**: fix: remove the user deletion deadlock and reject a second connection to a stream

Deleting a user cleaned up its servers while holding the user lock, taking
the alerts lock and the server list lock. The alert check and monitor result
handling take those first and the user lock second, so the two sides waited
for each other forever and every Agent login hung with them. The cleanup now
runs after the user lock is released.

A second WebSocket opened with the same session ID replaced the first user
connection and started a second pair of relay goroutines over one buffer; a
large Agent frame then indexed past the slice and took the dashboard down.
A stream now accepts one user connection.

Co-authored-by: naiba/CloudCode <[REDACTED_EMAIL]>

**File**: `service/rpc/io_stream_duplicate_user_test.go` (added, +36/-0)
```diff
@@ -0,0 +1,36 @@
+package rpc
+
+import (
+	"errors"
+	"testing"
+)
+
+// A second WebSocket opened with the same session ID used to replace the first
+// connection and start a second pair of relay goroutines over the same buffer.
+// A large Agent frame then indexed past the slice and took the whole dashboard
+// process down.
+func TestUserConnectedRejectsASecondConnectionToTheSameStream(t *testing.T) {
+	handler := NewNezhaHandler()
+	const streamID = "11111111-1111-1111-1111-111111111111"
+	handler.CreateStream(streamID, 100, 0)
+	first, second := newPipeReadWriter(), newPipeReadWriter()
+	defer first.Close()
+	defer second.Close()
+
+	if err := handler.UserConnected(streamID, first); err != nil {
+		t.Fatalf("first connection: %v", err)
+	}
+	err := handler.UserConnected(streamID, second)
+
+	if !errors.Is(err, ErrUserStreamAlreadyConnected) {
+		t.Fatalf("second connection err = %v, want ErrUserStreamAlreadyConnected", err)
+	}
+	stream, getErr := handler.GetStream(streamID)
+	if getErr != nil {
+		t.Fatalf("GetStream: %v", getErr)
+	}
+	attached, _ := handler.streamEndpoints(stream)
+	if attached != first {
+		t.Fatal("the second connection replaced the first one")
+	}
+}
```

**File**: `service/rpc/io_stream_registry.go` (modified, +10/-0)
```diff
@@ -7,6 +7,9 @@ import (
 
 var ErrAgentStreamAlreadyConnected = errors.New("agent stream already connected")
 
+// ErrUserStreamAlreadyConnected is returned when a stream already has its user connection.
+var ErrUserStreamAlreadyConnected = errors.New("user stream already connected")
+
 func (s *NezhaHandler) IsStreamAuthorizedForAgent(streamId string, agentServerID uint64) bool {
 	s.ioStreamMutex.RLock()
 	defer s.ioStreamMutex.RUnlock()
@@ -55,6 +58,13 @@ func (s *NezhaHandler) UserConnected(streamId string, userIo io.ReadWriteCloser)
 		s.ioStreamMutex.Unlock()
 		return errors.New("stream not found")
 	}
+	// 一条流只能附着一个用户连接。覆盖已有连接的话，同一个会话 ID 再连一次就会
+	// 让 StartStream 再起一对中继协程，两对协程并发读同一个缓冲区，切片越界后
+	// 整个面板进程退出。
+	if stream.userIo != nil {
+		s.ioStreamMutex.Unlock()
+		return ErrUserStreamAlreadyConnected
+	}
 	stream.userIo = userIo
 	s.ioStreamMutex.Unlock()
 	stream.userIoChOnce.Do(func() { close(stream.userIoConnectCh) })
```

**File**: `service/singleton/user.go` (modified, +29/-17)
```diff
@@ -100,6 +100,34 @@ func OnUserDelete(id []uint64, errorFunc func(string, ...any) error) error {
 		}
 	}()
 
+	// 被删用户名下服务器的内存清理同样要等 UserLock 释放之后再做（defer 后进先出，
+	// 这一段在下面的 UserLock.Unlock 之后执行）。这些清理要拿告警锁和服务器列表锁，
+	// 而告警检查、监控结果处理是先拿那些锁再读 UserLock：在 UserLock 里面去拿，
+	// 两边就会互相等待，UserLock 永不释放，所有 agent 认证跟着卡死，只能重启面板。
+	var deletedServers []uint64
+	defer func() {
+		if len(deletedServers) == 0 {
+			return
+		}
+		AlertsLock.Lock()
+		for _, sid := range deletedServers {
+			for _, alert := range Alerts {
+				if AlertsCycleTransferStatsStore[alert.ID] != nil {
+					delete(AlertsCycleTransferStatsStore[alert.ID].ServerName, sid)
+					delete(AlertsCycleTransferStatsStore[alert.ID].Transfer, sid)
+					delete(AlertsCycleTransferStatsStore[alert.ID].NextUpdate, sid)
+				}
+			}
+		}
+		AlertsLock.Unlock()
+		// Cancel pending transfers before ServerShared drops the
+		// in-memory entry: same ordering rationale as batchDeleteServer.
+		if ServerTransferShared != nil {
+			ServerTransferShared.OnServersDeleted(deletedServers)
+		}
+		ServerShared.Delete(deletedServers)
+	}()
+
 	if len(id) < 1 {
 		return Localizer.ErrorT("user id not specified")
 	}
@@ -169,23 +197,7 @@ func OnUserDelete(id []uint64, errorFunc func(string, ...any) error) error {
 		}
 
 		if server {
-			AlertsLock.Lock()
-			for _, sid := range servers {
-				for _, alert := range Alerts {
-					if AlertsCycleTransferStatsStore[alert.ID] != nil {
-						delete(AlertsCycleTransferStatsStore[alert.ID].ServerName, sid)
-						delete(AlertsCycleTransferStatsStore[alert.ID].Transfer, sid)
-						delete(AlertsCycleTransferStatsStore[alert.ID].NextUpdate, sid)
-					}
-				}
-			}
-			AlertsLock.Unlock()
-			// Cancel pending transfers before ServerShared drops the
-			// in-memory entry: same ordering rationale as batchDeleteServer.
-			if ServerTransferShared != nil {
-				ServerTransferShared.OnServersDeleted(servers)
-			}
-			ServerShared.Delete(servers)
+			deletedServers = append(deletedServers, servers...)
 		}
 
 		secret := UserInfoMap[uid].AgentSecret
```

**File**: `service/singleton/user_delete_lock_order_test.go` (added, +64/-0)
```diff
@@ -0,0 +1,64 @@
+package singleton
+
+import (
+	"testing"
+	"time"
+
+	"github.com/stretchr/testify/require"
+
+	"github.com/nezhahq/nezha/model"
+)
+
+// The alert check holds the alerts lock and then reads the user table for every
+// server; handling a monitor result takes the server list lock first. Deleting
+// a user took those locks while it still held the user lock, so the two sides
+// waited for each other forever and every Agent login hung with them.
+func TestOnUserDeleteDoesNotHoldUserLockWhileWaitingForTheAlertsLock(t *testing.T) {
+	_, cleanup := setupOnUserDeleteFixture(t)
+	defer cleanup()
+	const user = uint64(100)
+	const serverID = uint64(1)
+	seedServerForTransfer(t, serverID, user)
+	require.NoError(t, DB.AutoMigrate(&model.User{}))
+	require.NoError(t, DB.Create(&model.User{Common: model.Common{ID: user}, Username: "alice", AgentSecret: "alice-secret"}).Error)
+	UserLock.Lock()
+	UserInfoMap[user] = model.UserInfo{Role: model.RoleMember, Username: "alice", AgentSecret: "alice-secret"}
+	UserLock.Unlock()
+
+	// An alert check is in flight.
+	AlertsLock.RLock()
+	alertCheckFinished := false
+	defer func() {
+		if !alertCheckFinished {
+			AlertsLock.RUnlock()
+		}
+	}()
+	done := make(chan error, 1)
+	go func() {
+		done <- OnUserDelete([]uint64{user}, func(string, ...any) error { return nil })
+	}()
+
+	// The check reaches its user lookup once the user is gone from the table.
+	awaitWhileUnregistering(t, func() bool {
+		_, known := lookupServerOwner(user)
+		return !known
+	}, "the alert check's user lookup is blocked behind the deletion: both sides wait for each other")
+	select {
+	case err := <-done:
+		t.Fatalf("OnUserDelete returned %v while the alert check still held the alerts lock", err)
+	case <-time.After(50 * time.Millisecond):
+	}
+	_, stillListed := ServerShared.Get(serverID)
+	require.True(t, stillListed, "test setup: the server is removed only after the alert check lets go")
+
+	AlertsLock.RUnlock()
+	alertCheckFinished = true
+	select {
+	case err := <-done:
+		require.NoError(t, err)
+	case <-time.After(5 * time.Second):
+		t.Fatal("OnUserDelete did not finish after the alert check released the alerts lock")
+	}
+	_, listed := ServerShared.Get(serverID)
+	require.False(t, listed, "the deleted user's server must be removed from the server list")
+}
```

---

### Incident Patch 2: `84cd474c` (2026-11-21)
**Commit Message**: fix: bound task notifications and release the statistics lock on panic

Scheduled task notifications were sent from one goroutine per reported result
with no limit, each holding the result text for as long as a slow webhook
takes. A task stream now sends at most four at a time and sends the rest from
its own receive loop, which slows only the Agent that floods.

The cycle transfer statistics lock was released without defer inside a
function that recovers panics, so one panic during evaluation left it held
and hung every later evaluation and the /service endpoint.

The concurrency test now drives the real evaluator and the truncation test
cuts inside a multi-byte character; both passed before with the guarded code
removed.

Co-authored-by: naiba/CloudCode <[REDACTED_EMAIL]>

**File**: `service/rpc/nezha.go` (modified, +31/-4)
```diff
@@ -54,6 +54,26 @@ func truncateTaskResultText(text string) string {
 	return text[:keep] + taskResultTruncatedSuffix
 }
 
+// maxPendingTaskNotificationsPerStream 是一条 agent 任务流上同时在发的通知数上限。
+const maxPendingTaskNotificationsPerStream = 4
+
+// dispatchTaskNotification 异步发送一条通知，但同一条任务流上最多同时发
+// cap(pending) 条；名额用完后在调用方（这条流的接收循环）里同步发送。
+// 结果上报的频率由 agent 决定：不设上限的话，一台 agent 连续上报失败结果就能
+// 堆出任意多个各持有 64KiB 文本、最长挂 10 分钟的协程。超额时只让这台 agent
+// 自己的接收循环慢下来，不丢通知，也不影响其他 agent。
+func dispatchTaskNotification(pending chan struct{}, send func()) {
+	select {
+	case pending <- struct{}{}:
+		go func() {
+			defer func() { <-pending }()
+			send()
+		}()
+	default:
+		send()
+	}
+}
+
 type NezhaHandler struct {
 	Auth                   *authHandler
 	ioStreams              map[string]*ioStreamContext
@@ -151,6 +171,7 @@ func (s *NezhaHandler) RequestTask(stream pb.NezhaService_RequestTaskServer) err
 	// Returning the handler cancels the real gRPC stream and wakes a blocked Send.
 	// A single receiver allows the handler to observe send-side failure while Recv waits.
 	failed := server.TaskStreamFailure(stream)
+	pendingTaskNotifications := make(chan struct{}, maxPendingTaskNotificationsPerStream)
 	type taskReception struct {
 		result *pb.TaskResult
 		err    error
@@ -219,12 +240,18 @@ func (s *NezhaHandler) RequestTask(stream pb.NezhaService_RequestTaskServer) err
 				// 通知必须异步发：webhook 最长会等 10 分钟，同步发送会把这台 agent 的
 				// 接收循环卡住，期间它的探测结果和 MCP 调用结果都收不进来。
 				if cr.PushSuccessful && result.GetSuccessful() {
-					go singleton.NotificationShared.SendNotification(cr.NotificationGroupID, fmt.Sprintf("[%s] %s, %s\n%s", singleton.Localizer.T("Scheduled Task Executed Successfully"),
-						cr.Name, server.Name, result.GetData()), "", &curServer)
+					message := fmt.Sprintf("[%s] %s, %s\n%s", singleton.Localizer.T("Scheduled Task Executed Successfully"),
+						cr.Name, server.Name, result.GetData())
+					dispatchTaskNotification(pendingTaskNotifications, func() {
+						singleton.NotificationShared.SendNotification(cr.NotificationGroupID, message, "", &curServer)
+					})
 				}
 				if !result.GetSuccessful() {
-					go singleton.NotificationShared.SendNotification(cr.NotificationGroupID, fmt.Sprintf("[%s] %s, %s\n%s", singleton.Localizer.T("Scheduled Task Executed Failed"),
-						cr.Name, server.Name, result.GetData()), "", &curServer)
+					message := fmt.Sprintf("[%s] %s, %s\n%s", singleton.Localizer.T("Scheduled Task Executed Failed"),
+						cr.Name, server.Name, result.GetData())
+					dispatchTaskNotification(pendingTaskNotifications, func() {
+						singleton.NotificationShared.SendNotification(cr.NotificationGroupID, message, "", &curServer)
+					})
 				}
 				singleton.DB.Model(cr).Updates(model.Cron{
 					LastExecutedAt: time.Now().Add(time.Second * -1 * time.Duration(result.GetDelay())),
```

**File**: `service/rpc/request_task_result_size_test.go` (modified, +12/-3)
```diff
@@ -16,13 +16,22 @@ func TestTruncateTaskResultTextKeepsShortOutputAndCutsOnRuneBoundary(t *testing.
 		t.Fatal("output at the limit must be kept unchanged")
 	}
 
-	// "界" is three bytes; the limit is not a multiple of three once one ASCII
-	// byte is put in front, so a plain byte cut would split a character.
-	oversized := "a" + strings.Repeat("界", maxTaskResultTextBytes)
+	// "界" is three bytes. With two ASCII bytes in front the limit falls inside a
+	// character (the limit minus two is not a multiple of three), so a plain byte
+	// cut would split it. One byte in front would not: the limit minus one is.
+	const asciiPrefix = "ab"
+	if (maxTaskResultTextBytes-len(asciiPrefix))%len("界") == 0 {
+		t.Fatal("test setup: the limit must fall inside a multi-byte character")
+	}
+	oversized := asciiPrefix + strings.Repeat("界", maxTaskResultTextBytes)
 	got := truncateTaskResultText(oversized)
 	if !utf8.ValidString(got) {
 		t.Fatal("truncated output is not valid UTF-8")
 	}
+	kept := strings.TrimSuffix(got, taskResultTruncatedSuffix)
+	if len(kept) >= maxTaskResultTextBytes || len(kept) < maxTaskResultTextBytes-len("界") {
+		t.Fatalf("kept %d bytes, want the last whole character below the %d byte limit", len(kept), maxTaskResultTextBytes)
+	}
 	if !strings.HasSuffix(got, taskResultTruncatedSuffix) {
 		t.Fatal("truncated output does not say it was truncated")
 	}
```

**File**: `service/rpc/task_notification_dispatch_test.go` (added, +72/-0)
```diff
@@ -0,0 +1,72 @@
+package rpc
+
+import (
+	"sync/atomic"
+	"testing"
+	"time"
+)
+
+// The Agent decides how often it reports results. Every failed scheduled task
+// used to start its own notification goroutine, each holding the result text
+// for as long as a slow webhook takes, with no limit.
+func TestDispatchTaskNotificationBoundsConcurrentSendsAndThenAppliesBackPressure(t *testing.T) {
+	pending := make(chan struct{}, maxPendingTaskNotificationsPerStream)
+	release := make(chan struct{})
+	var sending, finished atomic.Int32
+	slowWebhook := func() {
+		sending.Add(1)
+		<-release
+		finished.Add(1)
+	}
+
+	for range maxPendingTaskNotificationsPerStream {
+		returned := make(chan struct{})
+		go func() {
+			dispatchTaskNotification(pending, slowWebhook)
+			close(returned)
+		}()
+		select {
+		case <-returned:
+		case <-time.After(5 * time.Second):
+			t.Fatal("a notification within the limit blocked the receive loop")
+		}
+	}
+
+	overLimitReturned := make(chan struct{})
+	go func() {
+		dispatchTaskNotification(pending, slowWebhook)
+		close(overLimitReturned)
+	}()
+	deadline := time.Now().Add(5 * time.Second)
+	for sending.Load() != maxPendingTaskNotificationsPerStream+1 {
+		if time.Now().After(deadline) {
+			t.Fatalf("%d notifications started, want every one of them to be sent", sending.Load())
+		}
+		time.Sleep(time.Millisecond)
+	}
+	select {
+	case <-overLimitReturned:
+		t.Fatal("a notification over the limit returned while its webhook was still pending: nothing bounds the goroutines")
+	case <-time.After(50 * time.Millisecond):
+	}
+
+	close(release)
+	select {
+	case <-overLimitReturned:
+	case <-time.After(5 * time.Second):
+		t.Fatal("the over-limit notification never finished")
+	}
+	for finished.Load() != maxPendingTaskNotificationsPerStream+1 {
+		if time.Now().After(deadline) {
+			t.Fatalf("%d notifications finished, want all %d", finished.Load(), maxPendingTaskNotificationsPerStream+1)
+		}
+		time.Sleep(time.Millisecond)
+	}
+	// Every slot is free again for the next results.
+	for len(pending) != 0 {
+		if time.Now().After(deadline) {
+			t.Fatalf("%d notification slots still taken after every send finished", len(pending))
+		}
+		time.Sleep(time.Millisecond)
+	}
+}
```

**File**: `service/singleton/alertsentinel.go` (modified, +7/-3)
```diff
@@ -362,9 +362,13 @@ func checkStatusForServer(alert *model.AlertRule, server *model.Server) {
 	}
 	// 评估周期流量规则会改写统计里的 map，而这里和读取方都只持有 AlertsLock 的读锁，
 	// 必须另外互斥（见 cycleTransferStatsMu）。
-	cycleTransferStatsMu.Lock()
-	point, known := alert.SnapshotStatusWithRuntime(AlertsCycleTransferStatsStore[alert.ID], server, runtime, DB)
-	cycleTransferStatsMu.Unlock()
+	// 解锁必须用 defer：本函数开头会 recover 评估过程中的 panic，不用 defer 的话
+	// 一次 panic 就让这把锁永远不释放，之后所有规则评估和 /service 接口全部卡死。
+	point, known := func() ([]bool, bool) {
+		cycleTransferStatsMu.Lock()
+		defer cycleTransferStatsMu.Unlock()
+		return alert.SnapshotStatusWithRuntime(AlertsCycleTransferStatsStore[alert.ID], server, runtime, DB)
+	}()
 	if !known {
 		alertsStore[alert.ID][server.ID] = nil
 		return
```

**File**: `service/singleton/cycle_transfer_stats_concurrency_test.go` (modified, +83/-20)
```diff
@@ -8,48 +8,111 @@ import (
 	"github.com/nezhahq/nezha/model"
 )
 
+func cycleTransferRuleFixture(t *testing.T, stats *model.CycleTransferStats) (*model.AlertRule, *model.Server) {
+	t.Helper()
+	t.Cleanup(setupTestDB(t))
+	if err := DB.AutoMigrate(model.Transfer{}); err != nil {
+		t.Fatalf("migrate transfer table: %v", err)
+	}
+	previousStore, previousPrev, previousLast, previousCycle := alertsStore, alertsPrevState, alertsLastMetricSeq, AlertsCycleTransferStatsStore
+	t.Cleanup(func() {
+		alertsStore, alertsPrevState, alertsLastMetricSeq, AlertsCycleTransferStatsStore = previousStore, previousPrev, previousLast, previousCycle
+	})
+	alertsStore = map[uint64]map[uint64][]model.TimedAlertPoint{1: {1: nil}}
+	alertsPrevState = map[uint64]map[uint64]uint8{1: {}}
+	alertsLastMetricSeq = map[uint64]map[uint64]uint64{1: {}}
+	AlertsCycleTransferStatsStore = map[uint64]*model.CycleTransferStats{1: stats}
+
+	cycleStart := time.Now().Add(-time.Hour)
+	alert := &model.AlertRule{
+		Common: model.Common{ID: 1},
+		Rules: []*model.Rule{{
+			Type: "transfer_all_cycle", Max: 1 << 40, CycleStart: &cycleStart, CycleInterval: 1, CycleUnit: "day", Cover: model.RuleCoverAll,
+		}},
+	}
+	server := &model.Server{Common: model.Common{ID: 1}, Name: "server"}
+	model.InitServer(server)
+	return alert, server
+}
+
 // The alert evaluator rewrites the per-server maps of a cycle transfer rule
 // while the public /service endpoint reads them. Run with -race: an unguarded
 // read is reported here, and in production it aborts the dashboard process.
+// The writer is the real evaluator, so removing its lock fails this test.
 func TestCopyCycleTransferStatsIsSafeAgainstTheAlertEvaluator(t *testing.T) {
-	previous := AlertsCycleTransferStatsStore
-	t.Cleanup(func() { AlertsCycleTransferStatsStore = previous })
-	AlertsCycleTransferStatsStore = map[uint64]*model.CycleTransferStats{
-		1: {Name: "monthly", ServerName: map[uint64]string{}, Transfer: map[uint64]uint64{}, NextUpdate: map[uint64]time.Time{}},
-	}
+	stats := &model.CycleTransferStats{Name: "monthly", ServerName: map[uint64]string{}, Transfer: map[uint64]uint64{}, NextUpdate: map[uint64]time.Time{}}
+	alert, server := cycleTransferRuleFixture(t, stats)
+	lease := server.AttachStateStream(alertTestStateStream{})
 
+	const rounds = 300
 	var evaluator sync.WaitGroup
 	evaluator.Add(1)
 	go func() {
 		defer evaluator.Done()
-		for round := uint64(0); round < 2000; round++ {
-			// What checkStatusForServer does while it evaluates a rule.
+		for round := uint64(1); round <= rounds; round++ {
+			if !lease.UpdateState(&model.HostState{NetInTransfer: round, NetOutTransfer: round}, time.Now()) {
+				t.Error("state update rejected")
+				return
+			}
+			// The rule skips evaluation until its next check time; clear it so
+			// every round writes the statistics.
+			alert.Rules[0].NextTransferAt = nil
 			AlertsLock.RLock()
-			cycleTransferStatsMu.Lock()
-			stats := AlertsCycleTransferStatsStore[1]
-			stats.ServerName[round%50] = "server"
-			stats.Transfer[round%50] = round
-			stats.NextUpdate[round%50] = time.Now()
-			cycleTransferStatsMu.Unlock()
+			checkStatusForServer(alert, server)
 			AlertsLock.RUnlock()
 		}
 	}()
-	for round := 0; round < 2000; round++ {
-		for _, stats := range CopyCycleTransferStats() {
-			for serverID := range stats.Transfer {
-				_ = stats.ServerName[serverID]
+	for round := 0; round < rounds; round++ {
+		for _, copied := range CopyCycleTransferStats() {
+			for serverID := range copied.Transfer {
+				_ = copied.ServerName[serverID]
 			}
 		}
 	}
 	evaluator.Wait()
 
+	// The first report is the baseline the cycle counts from.
+	if got, want := stats.Transfer[1], uint64(2*(rounds-1)); got != want {
+		t.Fatalf("the evaluator recorded %d transferred bytes, want %d: it did not write the statistics every round", got, want)
+	}
 	// The copy must not share maps with the store: callers filter it per viewer.
 	copied := CopyCycleTransferStats()
 	copied[1].Transfer[999] = 1
-	if _, leaked := AlertsCycleTransferStatsStore[1].Transfer[999]; leaked {
+	if _, leaked := stats.Transfer[999]; leaked {
 		t.Fatal("the returned statistics share a map with the store")
 	}
-	if len(copied[1].Transfer) != 51 || copied[1].Name != "monthly" {
-		t.Fatalf("copy = %d transfer entries, name %q; want the 50 written entries plus the probe and the rule name", len(copied[1].Transfer), copied[1].Name)
+	if copied[1].Name != "monthly" || copied[1].ServerName[1] != "server" {
+		t.Fatalf("copy = name %q, server name %q; want the rule name and the evaluated server", copied[1].Name, copied[1].ServerName[1])
+	}
+}
+
+// checkStatusForServer recovers panics. A panic while it held the statistics
+// lock used to leave the lock taken for good, hanging every later evaluation
+// and the public /service endpoint.
+func TestCycleTransferStatsLockIsReleasedWhenEvaluationPanics(t *testing.T) {
+	// Statistics without maps make the evaluator panic when it records the result.

```

---

### Incident Patch 3: `c2e23ad7` (2026-11-21)
**Commit Message**: fix: stop DDNS record loss, a /service crash and oversized agent results

DDNS: a server's address is kept in memory only and is empty after a
dashboard restart or while the agent is offline. Saving the server in
that window started an update with no address, which the updater treats
as "delete the record", removing the A and AAAA records of a healthy
server. An update is no longer started while the address is unknown.

/service: the alert evaluator writes the per-server maps of cycle
transfer rules while the public /service endpoint reads them, both under
a read lock. Go aborts the process on a concurrent map read and write.
The maps now have their own mutex and the endpoint works on a copy.

Agent results: the output of scheduled tasks and service monitors was
stored and forwarded at whatever size the agent sent, up to megabytes
per message. It is now cut to 64 KiB. Scheduled-task notifications are
sent in the background so a slow webhook no longer blocks the agent's
result stream.

Workflows: release, sync-code and sync-release declare the token
permissions they need; yq is pinned and checksum-verified, swag is
pinned to the version CI uses, and the GitLab sync action is pinned 

**File**: `.github/workflows/release.yml` (modified, +16/-2)
```diff
@@ -7,6 +7,11 @@ on:
     branches:
       - dev
 
+# 仓库的默认 workflow 权限是可写。构建会执行第三方主题的下载脚本和大量依赖代码，
+# 默认只给读权限，发版和推镜像的 job 再各自申请需要的那一项。
+permissions:
+  contents: read
+
 jobs:
   build:
     strategy:
@@ -28,7 +33,10 @@ jobs:
       - name: Install dependencies
         run: |
           apt update && apt install unzip curl -y
-          wget https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64 -O /usr/bin/yq
+          # 固定版本并校验摘要：这个二进制随后就在发版构建里执行，
+          # 不能跟着上游的 latest 走。
+          wget https://github.com/mikefarah/yq/releases/download/v4.54.3/yq_linux_amd64 -O /usr/bin/yq
+          echo "129534601871538efe0ba4c5e62a34fb1d5f469bcb975c4fddeb467d82974973  /usr/bin/yq" | sha256sum -c -
           chmod +x /usr/bin/yq
 
       - run: git config --global --add safe.directory /__w/nezha/nezha
@@ -53,7 +61,7 @@ jobs:
 
       - name: generate swagger docs
         run: |
-          go install github.com/swaggo/swag/cmd/swag@latest
+          go install github.com/swaggo/swag/cmd/swag@v1.16.6
           swag init --pd -d cmd/dashboard -g main.go -o cmd/dashboard/docs
           go mod tidy
 
@@ -130,6 +138,9 @@ jobs:
     if: github.event_name == 'push' && contains(github.ref, 'refs/tags/')
     needs: build
     name: Release
+    permissions:
+      contents: write # 创建 release、上传产物
+      actions: write # 触发镜像站同步 workflow
     steps:
       - name: Download artifacts
         uses: actions/download-artifact@v8
@@ -177,6 +188,9 @@ jobs:
     if: github.event_name == 'push'
     needs: build
     name: Release Docker images
+    permissions:
+      contents: read
+      packages: write # 推送 GHCR 镜像
     steps:
       - uses: actions/checkout@v7.0.1
 
```

**File**: `.github/workflows/sync-code-atomgit.yml` (modified, +7/-1)
```diff
@@ -4,12 +4,18 @@ on:
   push:
     branches: [master]
 
+# 仓库的默认 workflow 权限是可写；同步只需要读代码，显式收紧。
+permissions:
+  contents: read
+
 jobs:
   sync-code-to-atomgit:
     runs-on: ubuntu-latest
     steps:
       - uses: actions/checkout@v7.0.1
-      - uses: adambirds/sync-github-to-gitlab-action@v1.1.0
+      # 这个第三方 action 会拿到镜像仓库的 SSH 私钥，固定到提交 SHA，
+      # tag 被改写时不会跟着执行新代码。
+      - uses: adambirds/sync-github-to-gitlab-action@654ee4b668b2746fe8367c7c3c254b6575ee1bab # v1.1.0
         with:
           destination_repository: git@atomgit.com:naiba/nezha-dashboard.git
           destination_branch_name: master
```

**File**: `.github/workflows/sync-code.yml` (modified, +7/-1)
```diff
@@ -4,12 +4,18 @@ on:
   push:
     branches: [master]
 
+# 仓库的默认 workflow 权限是可写；同步只需要读代码，显式收紧。
+permissions:
+  contents: read
+
 jobs:
   sync-to-jihulab:
     runs-on: ubuntu-latest
     steps:
       - uses: actions/checkout@v7.0.1
-      - uses: adambirds/sync-github-to-gitlab-action@v1.1.0
+      # 这个第三方 action 会拿到镜像仓库的 SSH 私钥，固定到提交 SHA，
+      # tag 被改写时不会跟着执行新代码。
+      - uses: adambirds/sync-github-to-gitlab-action@654ee4b668b2746fe8367c7c3c254b6575ee1bab # v1.1.0
         with:
           destination_repository: git@gitee.com:naibahq/nezha.git
           destination_branch_name: master
```

**File**: `.github/workflows/sync-release-atomgit.yml` (modified, +4/-0)
```diff
@@ -3,6 +3,10 @@ name: Sync Release to AtomGit
 on:
   workflow_dispatch:
 
+# 仓库的默认 workflow 权限是可写；同步只需要读代码，显式收紧。
+permissions:
+  contents: read
+
 jobs:
   sync-release-to-atomgit:
     runs-on: ubuntu-latest
```

**File**: `.github/workflows/sync-release.yml` (modified, +4/-0)
```diff
@@ -3,6 +3,10 @@ name: Sync Release to Gitee
 on:
   workflow_dispatch:
     
+# 仓库的默认 workflow 权限是可写；同步只需要读代码，显式收紧。
+permissions:
+  contents: read
+
 jobs:
   sync-release-to-gitee:
     runs-on: ubuntu-latest
```

**File**: `cmd/dashboard/controller/nat_update_ownership_test.go` (added, +50/-0)
```diff
@@ -0,0 +1,50 @@
+package controller
+
+import (
+	"strconv"
+	"testing"
+
+	"github.com/gin-gonic/gin"
+	"github.com/stretchr/testify/require"
+
+	"github.com/nezhahq/nezha/model"
+	"github.com/nezhahq/nezha/service/singleton"
+)
+
+// updateNAT checks two owners: the target server and the NAT profile being
+// edited. Only the first one was covered; with the profile check removed a
+// member could re-point another member's tunnel at a server of their own and
+// every test stayed green.
+func TestUpdateNATRejectsProfileOwnedByAnotherMember(t *testing.T) {
+	defer setupTenancyTest(t)()
+	oldConf, oldNAT, oldUsers := singleton.Conf, singleton.NATShared, singleton.UserInfoMap
+	defer func() { singleton.Conf, singleton.NATShared, singleton.UserInfoMap = oldConf, oldNAT, oldUsers }()
+	singleton.UserInfoMap = map[uint64]model.UserInfo{10: {Role: model.RoleMember}, 20: {Role: model.RoleMember}}
+	singleton.Conf = &singleton.ConfigClass{Config: &model.Config{ConfigDashboard: model.ConfigDashboard{DashboardHost: "panel.example.invalid"}, NATMemberDomains: []string{"victim.example.invalid"}}}
+	require.NoError(t, singleton.DB.AutoMigrate(&model.NAT{}))
+	singleton.NATShared = singleton.NewNATClass()
+	singleton.ServerShared.InsertForTest(&model.Server{Common: model.Common{ID: 1, UserID: 10}, Name: "victim-server"})
+	singleton.ServerShared.InsertForTest(&model.Server{Common: model.Common{ID: 2, UserID: 20}, Name: "attacker-server"})
+
+	victimProfileID, err := createNAT(ctxAsMemberWithBody(10, map[string]any{"name": "victim-tunnel", "enabled": true, "server_id": 1, "host": "203.0.113.7:80", "domain": "victim.example.invalid"}))
+	require.NoError(t, err)
+
+	hijack := ctxAsMemberWithBody(20, map[string]any{"name": "victim-tunnel", "enabled": true, "server_id": 2, "host": "203.0.113.9:80", "domain": "victim.example.invalid"})
+	hijack.Params = gin.Params{{Key: "id", Value: strconv.FormatUint(victimProfileID, 10)}}
+	_, err = updateNAT(hijack)
+
+	require.Error(t, err, "a member must not edit another member's NAT profile")
+	var stored model.NAT
+	require.NoError(t, singleton.DB.First(&stored, victimProfileID).Error)
+	require.Equal(t, uint64(1), stored.ServerID, "the profile must still point at its owner's server")
+	require.Equal(t, "203.0.113.7:80", stored.Host)
+	routed := singleton.NATShared.GetNATConfigByDomain("victim.example.invalid")
+	require.NotNil(t, routed)
+	require.Equal(t, uint64(1), routed.ServerID, "live routing must still use the owner's server")
+
+	// Control: the owner can still edit it.
+	ownerEdit := ctxAsMemberWithBody(10, map[string]any{"name": "victim-tunnel", "enabled": true, "server_id": 1, "host": "203.0.113.8:80", "domain": "victim.example.invalid"})
+	ownerEdit.Params = gin.Params{{Key: "id", Value: strconv.FormatUint(victimProfileID, 10)}}
+	_, err = updateNAT(ownerEdit)
+	require.NoError(t, err)
+}
```

**File**: `cmd/dashboard/controller/service.go` (modified, +1/-5)
```diff
@@ -27,13 +27,9 @@ import (
 // @Router /service [get]
 func showService(c *gin.Context) (*model.ServiceResponse, error) {
 	res, err, _ := requestGroup.Do(serviceResponseCacheKey(c), func() (any, error) {
-		singleton.AlertsLock.RLock()
-		defer singleton.AlertsLock.RUnlock()
 		stats := filterServiceStatsForViewer(c, singleton.ServiceSentinelShared.CopyStats())
-		var cycleTransferStats map[uint64]model.CycleTransferStats
-		copier.Copy(&cycleTransferStats, singleton.AlertsCycleTransferStatsStore)
 		return []any{
-			stats, filterCycleTransferStatsForViewer(c, cycleTransferStats),
+			stats, filterCycleTransferStatsForViewer(c, singleton.CopyCycleTransferStats()),
 		}, nil
 	})
 	if err != nil {
```

**File**: `service/rpc/nezha.go` (modified, +30/-2)
```diff
@@ -7,6 +7,7 @@ import (
 	"log"
 	"sync"
 	"time"
+	"unicode/utf8"
 
 	"github.com/jinzhu/copier"
 	"github.com/nezhahq/nezha/pkg/tsdb"
@@ -34,6 +35,25 @@ const maxConfigReportBytes = 64 * 1024
 // a report, or a failure reason, longer than maxConfigReportBytes.
 var ErrConfigReportTooLarge = errors.New("agent config report too large")
 
+// maxTaskResultTextBytes bounds the Agent-chosen output of scheduled tasks and
+// service monitors. Both are meant for a human to read in a notification.
+const maxTaskResultTextBytes = 64 * 1024
+
+const taskResultTruncatedSuffix = "\n...(truncated)"
+
+// truncateTaskResultText cuts oversized output on a rune boundary so the kept
+// part stays valid UTF-8 for JSON and the database.
+func truncateTaskResultText(text string) string {
+	if len(text) <= maxTaskResultTextBytes {
+		return text
+	}
+	keep := maxTaskResultTextBytes
+	for keep > 0 && !utf8.RuneStart(text[keep]) {
+		keep--
+	}
+	return text[:keep] + taskResultTruncatedSuffix
+}
+
 type NezhaHandler struct {
 	Auth                   *authHandler
 	ioStreams              map[string]*ioStreamContext
@@ -181,6 +201,12 @@ func (s *NezhaHandler) RequestTask(stream pb.NezhaService_RequestTaskServer) err
 		if result != nil {
 			result.Delay = float32(model.FiniteStateValue(float64(result.Delay)))
 		}
+		// Scheduled-task and service-monitor results end up in notification
+		// bodies, monitor history and the service API. The agent chooses their
+		// length, so an agent could push megabytes per message into all three.
+		if result.GetType() == model.TaskTypeCommand || model.IsServiceSentinelNeeded(result.GetType()) {
+			result.Data = truncateTaskResultText(result.GetData())
+		}
 		switch result.GetType() {
 		case model.TaskTypeCommand:
 			// 处理上报的计划任务
@@ -190,12 +216,14 @@ func (s *NezhaHandler) RequestTask(stream pb.NezhaService_RequestTaskServer) err
 				// 保存当前服务器状态信息
 				var curServer model.Server
 				copier.Copy(&curServer, server)
+				// 通知必须异步发：webhook 最长会等 10 分钟，同步发送会把这台 agent 的
+				// 接收循环卡住，期间它的探测结果和 MCP 调用结果都收不进来。
 				if cr.PushSuccessful && result.GetSuccessful() {
-					singleton.NotificationShared.SendNotification(cr.NotificationGroupID, fmt.Sprintf("[%s] %s, %s\n%s", singleton.Localizer.T("Scheduled Task Executed Successfully"),
+					go singleton.NotificationShared.SendNotification(cr.NotificationGroupID, fmt.Sprintf("[%s] %s, %s\n%s", singleton.Localizer.T("Scheduled Task Executed Successfully"),
 						cr.Name, server.Name, result.GetData()), "", &curServer)
 				}
 				if !result.GetSuccessful() {
-					singleton.NotificationShared.SendNotification(cr.NotificationGroupID, fmt.Sprintf("[%s] %s, %s\n%s", singleton.Localizer.T("Scheduled Task Executed Failed"),
+					go singleton.NotificationShared.SendNotification(cr.NotificationGroupID, fmt.Sprintf("[%s] %s, %s\n%s", singleton.Localizer.T("Scheduled Task Executed Failed"),
 						cr.Name, server.Name, result.GetData()), "", &curServer)
 				}
 				singleton.DB.Model(cr).Updates(model.Cron{
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

## X. remove the user deletion deadlock and reject a second connection to a stream

**RULE**:
When implementing operations in `service/rpc/io_stream_duplicate_user_test.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in nezhahq/nezha. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c9339e68`: remove the user deletion deadlock and reject a second connection to a stream. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `service/rpc/io_stream_duplicate_user_test.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
package rpc

import (
	"errors"
	"testing"
)

// A second WebSocket opened with the same session ID used to replace the first
// connection and start a second pair of relay goroutines over the same buffer.
// A large Agent frame then indexed past the slice and took the whole dashboard
// process down.
func TestUserConnectedRejectsASecondConnectionToTheSameStream(t *testing.T) {
	handler := NewNezhaHandler()
	const streamID = "11111111-1111-1111-1111-111111111111"
	handler.CreateStream(streamID, 100, 0)
	first, second := newPipeReadWriter(), newPipeReadWriter()
	defer first.Close()
	defer second.Close()

	if err := handler.UserConnected(streamID, first); err != nil {
		t.Fatalf("first connection: %v", err)
	}
	err := handler.UserConnected(streamID, second)

	if !errors.Is(err, ErrUserStreamAlreadyConnected) {
		t.Fatalf("second connection err = %v, want ErrUserStreamAlreadyConnected", err)
	}
	stream, getErr := handler.GetStream(streamID)
	if getErr != nil {
		t.Fatalf("GetStream: %v", getErr)
	}
	attached, _ := handler.streamEndpoints(stream)
	if attached != first {
		t.Fatal("the second connection replaced the first one")
	}
}
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `c9339e68` are properly handled with clean fallback behavior.
