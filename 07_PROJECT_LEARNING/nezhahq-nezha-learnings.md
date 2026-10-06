# Forensic Learning Record (Deep Inspection): nezhahq/nezha

> **Canonical Artifact**: `07_PROJECT_LEARNING/nezhahq-nezha-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/nezhahq/nezha](https://github.com/nezhahq/nezha))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:02:59.255Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `nezhahq/nezha`
- **Description**: :trollface: Self-hosted, lightweight server and website monitoring and O&M tool
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 10349 stars

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

### Core Architecture Module: `pkg/utils/koanf.go`
```
package utils

import (
	"encoding"
	"reflect"

	"github.com/go-viper/mapstructure/v2"
	"sigs.k8s.io/yaml"
)

// TextUnmarshalerHookFunc is a fixed version of mapstructure.TextUnmarshallerHookFunc.
// This hook allows to additionally unmarshal text into custom string types that implement the encoding.Text(Un)Marshaler interface(s).
func TextUnmarshalerHookFunc() mapstructure.DecodeHookFuncType {
	return func(
		f reflect.Type,
		t reflect.Type,
		data any,
	) (any, error) {
		if f.Kind() != reflect.String {
			return data, nil
		}
		result := reflect.New(t).Interface()
		unmarshaller, ok := result.(encoding.TextUnmarshaler)
		if !ok {
			return data, nil
		}

		// default text representation is the actual value of the `from` string
		var (
			dataVal = reflect.ValueOf(data)
			text    = []byte(dataVal.String())
		)
		if f.Kind() == t.Kind() {
			// source and target are of underlying type string
			var (
				err    error
				ptrVal = reflect.New(dataVal.Type())
			)
			if !ptrVal.Elem().CanSet() {
				// cannot set, skip, this should not happen
				if err := unmarshaller.UnmarshalText(text); err != nil {
					return nil, err
				}
				return result, nil
			}
			ptrVal.Elem().Set(dataVal)

			// We need to assert that both, the value type and the pointer type
			// do (not) implement the TextMarshaller interface before proceeding and simply
			// using the string value of the string type.
			// it might be the case that the internal string representation differs from
			// the (un)marshalled string.

			for _, v := range []reflect.Value{dataVal, ptrVal} {
				if marshaller, ok := v.Interface().(encoding.TextMarshaler); ok {
					text, err = marshaller.MarshalText()
					if err != nil {
						return nil, err
					}
					break
				}
			}
		}

		// text is either the source string's value or the source string type's marshaled value
		// which may differ from its internal string value.
		if err := unmarshaller.UnmarshalText(text); err != nil {
			return nil, err
		}
		return result, nil
	}
}

// KubeYAML implements a YAML parser.
type KubeYAML struct{}

// Unmarshal parses the given YAML bytes.
func (p *KubeYAML) Unmarshal(b []byte) (map[string]any, error) {
	var out map[string]any
	if err := yaml.Unmarshal(b, &out); err != nil {
		return nil, err
	}

	return out, nil
}

// Marshal marshals the given config map to YAML bytes.
func (p *KubeYAML) Marshal(o map[string]any) ([]byte, error) {
	return yaml.Marshal(o)
}

```

### Core Architecture Module: `pkg/utils/request_wrapper.go`
```
package utils

import (
	"bytes"
	"errors"
	"io"
	"net"
	"net/http"
	"sync"
)

var _ io.ReadWriteCloser = (*RequestWrapper)(nil)

type RequestWrapper struct {
	req    *http.Request
	reader *bytes.Buffer
	writer net.Conn

	closeOnce sync.Once
	closeInit sync.Once
	closeDone chan struct{}
	closeErr  error
}

func NewRequestWrapper(req *http.Request, writer http.ResponseWriter) (*RequestWrapper, error) {
	hj, ok := writer.(http.Hijacker)
	if !ok {
		return nil, errors.New("http server does not support hijacking")
	}
	conn, _, err := hj.Hijack()
	if err != nil {
		return nil, err
	}
	buf := bytes.NewBuffer(nil)
	if err = req.Write(buf); err != nil {
		var bodyErr error
		if req.Body != nil {
			bodyErr = req.Body.Close()
		}
		return nil, errors.Join(err, bodyErr, conn.Close())
	}
	return &RequestWrapper{
		req:       req,
		reader:    buf,
		writer:    conn,
		closeDone: make(chan struct{}),
	}, nil
}

func (rw *RequestWrapper) Read(p []byte) (int, error) {
	count, err := rw.reader.Read(p)
	if err == nil {
		return count, nil
	}
	if err != io.EOF {
		return count, err
	}
	// request 数据读完之后等待客户端断开连接或 grpc 超时
	return rw.writer.Read(p)
}

func (rw *RequestWrapper) Write(p []byte) (int, error) {
	return rw.writer.Write(p)
}

func (rw *RequestWrapper) Close() error {
	rw.closeInit.Do(func() {
		rw.closeDone = make(chan struct{})
	})
	rw.closeOnce.Do(func() {
		var bodyErr error
		if rw.req.Body != nil {
			bodyErr = rw.req.Body.Close()
		}
		rw.closeErr = errors.Join(bodyErr, rw.writer.Close())
		close(rw.closeDone)
	})
	<-rw.closeDone
	return rw.closeErr
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1242** (2026-10-01): **fix(alerts): evaluate fresh reports and order notification delivery**
  *Symptoms*: ## Problem  The dashboard's periodic alert loop can treat the last metric state as a new observation even after an Agent disconnects. If that final value crosses a threshold, repeated evaluations can fill a duration window with one stale report and raise a false sustained-use alert. Conversely, missing telemetry can be interpreted as a normal value or a threshold violation, causing false recovery or false alarms.  Related alert paths have other correctness and delivery risks:  - Aggregate network speed uses the outbound component twice, so rules on total speed can miss real traffic or fire on the wrong value. - Invalid cycle-rule inputs and database failures can produce misleading evaluations. - Notification failures can be muted before successful delivery; concurrent or out-of-order sends can duplicate, suppress, or reorder incident and recovery messages. A failed webhook request can also expose a credential-bearing URL in logs. - Service-check windows can lose failure results within a bucket or misrepresent a reporting gap. TLS certificate changes need stricter parsing and state handling.  ## Fix  - Give each Agent report a distinct sequence and evaluate metric rules only from fresh, connected reports. Evaluate compound conditions against one immutable report snapshot. Treat unavailable metrics as **unknown**, not incident or recovery. Use elapsed-time windows while preserving the existing 3-second-tick meaning of persisted duration settings. - Calculate total network speed

- **Issue #1241** (2026-10-01): **fix(nat): strip only dashboard-issued Authorization credentials at NAT ingress**
  *Symptoms*: ## Problem  Since commit 2640b86 (v2.2.11, 2026-07-20), the NAT ingress deletes the **entire** `Authorization` header before tunneling a request to the agent. Self-hosted apps behind an NAT tunnel that authenticate with their own Bearer tokens break — e.g. a Qinglong panel behind a tunnel enters a login loop: login succeeds (token issued), the next request carries `Authorization: Bearer <ql-token>`, the dashboard deletes it, the backend answers `401 No authorization token was found`, and the frontend bounces back to the login page.  The deletion protects a real invariant — a dashboard credential must never become a NAT backend's credential — but deleting the whole header also destroys third-party credentials that the dashboard never issued.  ## Invariant & design  Same invariant, sharper predicate: **strip only dashboard-issued credentials; forward everything else untouched.** No new configuration, no API/DB/frontend changes.  `controller.IsDashboardCredential` classifies an `Authorization` value as dashboard-issued via:  - **JWT signature-only verification**, using a parser derived from the auth middleware's own configuration (same key instance as `initParams`, algorithm pinned by the keyfunc, `ParseOptions=WithoutClaimsValidation`). Expiry is deliberately ignored for the *ownership* question: an expired but dashboard-signed token is still a dashboard credential and is stripped — this is the conservative direction, because a sloppy backend that accepts any JWT would otherwis

- **Issue #1238** (2026-09-15): **Fixed: An issue where deleting DNS records for domains hosted on Cloudflare did not work.**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > The workaround has been updated.  However The DDNS deletion function(Cloudflare): For cloudflare, requiring a record_id is a non-negotiable security boundary.
  > To make the required direction explicit: **please stop implementing the Cloudflare workaround in Nezha and open an upstream PR in `libdns/cloudflare` first. This Nezha-side provider special case will not be accepted.**\n\nRequired sequence:\n1. Open a PR against `github.com/libdns/cloudflare` that makes `DeleteRecords` honor the libdns wildcard contract for an empty record value (resolve Cloudflare record IDs internally by Name+Type), with subdomain and apex tests.\n2. Get that provider change merged and available as a version/commit that Nezha can consume.\n3. Update only the `libdns/cloudflare` dependency in this PR, while keeping Nezha on its existing provider-agnostic `RecordDeleter` path.\n4. Remove all `Cloudflare Special` branches, the process-global cache, and the no-op Cloudflare-specific logging from Nezha.\n\nCloudflare requiring an ID for its DELETE endpoint does not justify this code in Nezha: the provider already owns the ID lookup inside its `DeleteRecords` implementatio
  > ok

- **Issue #1237** (2026-09-14): **Improve: Delete the corresponding DNS record if the IPv4/IPv6 address is empty.**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > Updated.
  > Updated.
  > Updated.

- **Issue #1236** (2026-09-12): **feat(auth): allow JWT IP changes by configuration**
  *Symptoms*: ## Summary  Add the `allow_jwt_ip_change` configuration option to permit browser login JWT sessions to continue when the client IP changes.  Some users access the dashboard through proxies whose exit IP can change frequently. With strict IP-bound JWT sessions, every IP change invalidates the session and repeatedly logs the user out.  This option lets each operator decide whether to trade some session-binding security for a more stable login experience:  - Default remains `false`, preserving strict IP-bound session behavior. - When enabled, valid JWT sessions remain usable after proxy or network IP changes. - Expose the option through the admin settings API, preserving its value for partial PATCH requests.  ## Tests  - `go test ./model` - Added JWT session coverage for both the default reject behavior and enabled allow behavior. - Added configuration and settings-form decoding coverage.

- **Issue #1235** (2026-09-12): **feat: surface GPU memory in host state**
  *Symptoms*: Closes #1217  - Add `State_GPU` message to the proto with utilization and memory fields - Add `HostState.GPUs`, converted in both `PB()` and `PB2State()` - Keep the existing `gpu` field populated so agents on the official build keep working  Design follows the note in nezhahq/agent#51 that this should go through the proto rather than an extra field. `State_GPU` is index-aligned with `Host.gpu`, matching the `gpu` field it supersedes.  The agent side is a companion PR in nezhahq/agent. Frontend rendering needs a small change in hamster1963/nezha-dash-v2 as well; without it the new field is simply ignored.  Verified against a live panel: an agent built from the companion branch reports `{"utilization":0,"memory_used":1937,"memory_total":6144}` over the websocket, and the other five hosts running the official agent stayed connected throughout — the change only adds a field.  `nezha_grpc.pb.go` is untouched since the service is unchanged. Regenerated with protoc-gen-go v1.34.2 / protoc v5.29.3 to match the existing headers.

- **Issue #1232** (2026-09-11): **请求需求**
  *Symptoms*: ### 运行环境  docker  ### Nezha 版本  v2.3.6  ### 描述问题  如果某服务器挂了，或者网络原因掉线了一段时间，现在查看记录很难分辨那个时间段出问题，希望能从网络、cpu等指标中能体现。  或者加一个在线状态的指标  ### 复现步骤  看上述  ### 配置信息  <details></details>   ### 附加信息  <details></details>   ### 验证  - [x] 我确认这是一个 nezha (哪吒面板) 的问题。 - [x] 我已经搜索了 Issues，并确认该问题之前没有被反馈过。

- **Issue #1231** (2026-08-17): **improve: ddns**
  *Symptoms*: 

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

### Incident Patch 1: `8328047a` (2026-10-01)
**Commit Message**: fix(alerts): evaluate fresh reports and order notification delivery (#1242)

* fix(alerts): evaluate fresh reports and make notification transitions reliable

* fix(alerts): identify equal-timestamp reports by sequence

* fix(alerts): preserve notification transition semantics

---------

Co-authored-by: naiba <[REDACTED_EMAIL]>

**File**: `cmd/dashboard/controller/alertrule.go` (modified, +6/-0)
```diff
@@ -178,6 +178,9 @@ func validateRule(c *gin.Context, r *model.AlertRule) error {
 			if !rule.IsSupportedType() {
 				return singleton.Localizer.ErrorT("unsupported rule type")
 			}
+			if !rule.HasSafeThresholds() {
+				return singleton.Localizer.ErrorT("invalid rule thresholds")
+			}
 			switch rule.Cover {
 			case model.RuleCoverAll, model.RuleCoverIgnoreAll:
 			default:
@@ -192,6 +195,9 @@ func validateRule(c *gin.Context, r *model.AlertRule) error {
 					return singleton.Localizer.ErrorT("duration is too large")
 				}
 			} else {
+				if !rule.HasSafeCycleUnit() {
+					return singleton.Localizer.ErrorT("invalid cycle unit")
+				}
 				if rule.CycleInterval < 1 {
 					return singleton.Localizer.ErrorT("cycle_interval need to be at least 1")
 				}
```

**File**: `model/alert_evaluation_test.go` (added, +205/-0)
```diff
@@ -0,0 +1,205 @@
+package model
+
+import (
+	"math"
+	"testing"
+	"time"
+
+	"gorm.io/driver/sqlite"
+	"gorm.io/gorm"
+)
+
+func TestAlertEvaluationDistinguishesUnknownFromBreach(t *testing.T) {
+	server := &Server{Common: Common{ID: 1}}
+	rule := &Rule{Type: "cpu", Max: 80, Cover: RuleCoverAll}
+	if passed, known := rule.Evaluate(nil, server, nil); !passed || known {
+		t.Fatalf("missing state = (%v, %v), want unknown", passed, known)
+	}
+	lease := server.AttachStateStream(runtimeOwnershipStream{})
+	if !lease.UpdateState(&HostState{CPU: 99}, time.Now()) {
+		t.Fatal("state update rejected")
+	}
+	if passed, known := rule.Evaluate(nil, server, nil); passed || !known {
+		t.Fatalf("fresh high CPU = (%v, %v), want known breach", passed, known)
+	}
+	if !lease.Clear() {
+		t.Fatal("stream clear rejected")
+	}
+	// The raw metric remains available for historical display. The sentinel
+	// enforces freshness and must not count this value after disconnect.
+	if !server.RuntimeSnapshot().LastActive.IsZero() {
+		t.Fatal("disconnect did not clear online visibility")
+	}
+}
+
+func newCycleTestDB(t *testing.T, migrate bool) *gorm.DB {
+	t.Helper()
+	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
+	if err != nil {
+		t.Fatal(err)
+	}
+	if migrate {
+		if err := db.AutoMigrate(&Transfer{}); err != nil {
+			t.Fatal(err)
+		}
+	}
+	return db
+}
+
+func newCycleTestStats() *CycleTransferStats {
+	return &CycleTransferStats{
+		ServerName: make(map[uint64]string),
+		Transfer:   make(map[uint64]uint64),
+		NextUpdate: make(map[uint64]time.Time),
+	}
+}
+
+func TestCycleRuleRejectsInvalidConfiguration(t *testing.T) {
+	start := time.Now().Add(-time.Hour)
+	rule := &Rule{Type: "transfer_out_cycle", CycleStart: &start, CycleInterval: 1, CycleUnit: "hour", Max: 100}
+	if !rule.HasSafeCycleConfiguration() {
+		t.Fatal("normal hourly cycle rejected")
+	}
+	for _, tc := range []struct {
+		name   string
+		mutate func(*Rule)
+	}{
+		{"unknown unit", func(r *Rule) { r.CycleUnit = "fortnight" }},
+		{"negative limit", func(r *Rule) { r.Max = -1 }},
+		{"NaN limit", func(r *Rule) { r.Max = math.NaN() }},
+		{"reversed limits", func(r *Rule) { r.Min, r.Max = 200, 100 }},
+		{"future start", func(r *Rule) { future := time.Now().Add(time.Hour); r.CycleStart = &future }},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			copy := *rule
+			tc.mutate(&copy)
+			if copy.HasSafeCycleConfiguration() {
+				t.Fatal("unsafe cycle accepted")
+			}
+		})
+	}
+}
+
+func TestCycleBoundsUseOneClockAtBoundary(t *testing.T) {
+	start := time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC)
+	rule := &Rule{Type: "transfer_out_cycle", CycleStart: &start, CycleInterval: 1, CycleUnit: "hour", Max: 100}
+	before := start.Add(59*time.Minute + 59*time.Second)
+	from, to := rule.transferDurationBounds(before)
+	if !from.Equal(start) || !to.Equal(start.Add(time.Hour)) {
+		t.Fatalf("before boundary = %v..%v", from, to)
+	}
+	from, to = rule.transferDurationBounds(start.Add(time.Hour))
+	if !from.Equal(start.Add(time.Hour)) || !to.Equal(start.Add(2*time.Hour)) {
+		t.Fatalf("at boundary = %v..%v", from, to)
+	}
+}
+
+func TestCycleQueryFailureIsUnknownAndDoesNotCache(t *testing.T) {
+	start := time.Now().Add(-time.Hour)
+	rule := &Rule{Type: "transfer_out_cycle", CycleStart: &start, CycleInterval: 1, CycleUnit: "hour", Max: 50}
+	server := &Server{Common: Common{ID: 1}, State: &HostState{}}
+	passed, known := rule.Evaluate(newCycleTestStats(), server, newCycleTestDB(t, false))
+	if !passed || known || len(rule.NextTransferAt) != 0 {
+		t.Fatalf("SQL error yielded passed=%v known=%v cache=%v", passed, known, rule.NextTransferAt)
+	}
+}
+
+func TestCycleQueryExcludesFutureRowsAndHandlesMinOnly(t *testing.T) {
+	start := time.Now().Add(-90 * time.Minute)
+	db := newCycleTestDB(t, true)
+	server := &Server{Common: Common{ID: 1}, State: &HostState{}}
+	for _, row := range []Transfer{
+		{Common: Common{CreatedAt: time.Now().Add(-time.Minute)}, ServerID: 1, Out: 10},
+		{Common: Common{CreatedAt: time.Now().Add(10 * time.Minute)}, ServerID: 1, Out: 100},
+	} {
+		if err := db.Create(&row).Error; err != nil {
+			t.Fatal(err)
+		}
+	}
+	rule := &Rule{Type: "transfer_out_cycle", CycleStart: &start, CycleInterval: 1, CycleUnit: "hour", Max: 50}
+	stats := newCycleTestStats()
+	passed, known := rule.Evaluate(stats, server, db)
+	if !passed || !known || stats.Transfer[1] != 10 {
+		t.Fatalf("future row included: passed=%v known=%v amount=%d", passed, known, stats.Transfer[1])
+	}
+	minOnly := &Rule{Type: "transfer_out_cycle", CycleStart: &start, CycleInterval: 1, CycleUnit: "hour", Min: 20}
+	passed, known = minOnly.Evaluate(newCycleTestStats(), server, db)
+	if passed || !known {
+		t.Fatalf("min-only cycle = (%v,%v), want known breach", passed, known)
+	}
+}
+
+func TestAlertEvaluationAllNetworkSpeedUsesBothDirections(t *testing.T) {
+	for _, tc := range []struct {
+		name    string
+		in, out uint64
+		breach  bool
+	}{
+		{
```

**File**: `model/alert_timed_test.go` (added, +104/-0)
```diff
@@ -0,0 +1,104 @@
+package model
+
+import (
+	"testing"
+	"time"
+)
+
+func timedRule(kind string, duration uint64) *AlertRule {
+	return &AlertRule{Rules: []*Rule{{Type: kind, Duration: duration, Max: 80, Cover: RuleCoverAll}}}
+}
+
+func timedPoints(start time.Time, values []bool, spacing time.Duration) []TimedAlertPoint {
+	points := make([]TimedAlertPoint, len(values))
+	for i, value := range values {
+		points[i] = TimedAlertPoint{At: start.Add(time.Duration(i) * spacing), Values: []bool{value}}
+	}
+	return points
+}
+
+func TestTimedAlertNeedsElapsedWindowAndDistinctReports(t *testing.T) {
+	start := time.Unix(1_700_000_000, 0)
+	rule := timedRule("cpu", 5)
+	points := timedPoints(start, []bool{false, false, false, false}, AlertSampleInterval)
+	if known, _ := rule.CheckTimed(points, points[len(points)-1].At); known {
+		t.Fatal("four reports decided a five-tick window")
+	}
+	points = append(points, TimedAlertPoint{At: start.Add(12 * time.Second), Values: []bool{false}})
+	if known, passed := rule.CheckTimed(points, points[len(points)-1].At); !known || passed {
+		t.Fatalf("complete high-CPU window: known=%v passed=%v", known, passed)
+	}
+	// Repeating the same observation does not advance wall-clock coverage.
+	if known, _ := rule.CheckTimed(points, start.Add(30*time.Second)); known {
+		t.Fatal("stale sample created a new complete window")
+	}
+}
+
+func TestTimedAlertGapIsUnknownAndCannotResolve(t *testing.T) {
+	start := time.Unix(1_700_000_000, 0)
+	rule := timedRule("cpu", 5)
+	points := []TimedAlertPoint{
+		{At: start, Values: []bool{false}},
+		{At: start.Add(30 * time.Second), Values: []bool{true}},
+	}
+	if known, _ := rule.CheckTimed(points, start.Add(30*time.Second)); known {
+		t.Fatal("telemetry gap must not be interpreted as healthy")
+	}
+}
+
+func TestTimedAlertIrregularReportsUseElapsedTime(t *testing.T) {
+	start := time.Unix(1_700_000_000, 0)
+	rule := timedRule("cpu", 6)
+	points := timedPoints(start, []bool{false, false, false, false}, 5*time.Second)
+	if known, passed := rule.CheckTimed(points, start.Add(15*time.Second)); !known || passed {
+		t.Fatalf("irregular reports cover the wall-clock window: known=%v passed=%v", known, passed)
+	}
+}
+
+func TestTimedAlertExactSeventyPercentIsNotIncident(t *testing.T) {
+	start := time.Unix(1_700_000_000, 0)
+	rule := timedRule("cpu", 10)
+	values := []bool{false, false, false, false, false, false, false, true, true, true}
+	points := timedPoints(start, values, AlertSampleInterval)
+	if known, passed := rule.CheckTimed(points, points[len(points)-1].At); !known || !passed {
+		t.Fatalf("70%% failed is below the >70%% trigger: known=%v passed=%v", known, passed)
+	}
+}
+
+func TestTimedAlertTenTickWindowDoesNotDecideAtNine(t *testing.T) {
+	start := time.Unix(1_700_000_000, 0)
+	rule := timedRule("cpu", 10)
+	points := timedPoints(start, []bool{false, false, false, false, false, false, false, false, false}, AlertSampleInterval)
+	if known, _ := rule.CheckTimed(points, points[len(points)-1].At); known {
+		t.Fatal("nine reports decided a ten-tick window one tick early")
+	}
+	points = append(points, TimedAlertPoint{At: start.Add(27 * time.Second), Values: []bool{false}})
+	if known, passed := rule.CheckTimed(points, points[len(points)-1].At); !known || passed {
+		t.Fatalf("full ten-tick breach: known=%v passed=%v", known, passed)
+	}
+}
+
+func TestTimedOfflineRequiresSustainedAbsence(t *testing.T) {
+	start := time.Unix(1_700_000_000, 0)
+	rule := timedRule("offline", 5)
+	points := timedPoints(start, []bool{false, false, false, false, false}, AlertSampleInterval)
+	if known, passed := rule.CheckTimed(points, points[len(points)-1].At); !known || passed {
+		t.Fatalf("continuous offline interval: known=%v passed=%v", known, passed)
+	}
+	points = append(points, TimedAlertPoint{At: start.Add(15 * time.Second), Values: []bool{true}})
+	if known, passed := rule.CheckTimed(points, points[len(points)-1].At); !known || !passed {
+		t.Fatalf("online observation should resolve offline: known=%v passed=%v", known, passed)
+	}
+}
+
+func TestTimedCompoundRuleWaitsForAllKnown(t *testing.T) {
+	start := time.Unix(1_700_000_000, 0)
+	rule := &AlertRule{Rules: []*Rule{
+		{Type: "cpu", Duration: 5, Max: 80, Cover: RuleCoverAll},
+		{Type: "memory", Duration: 5, Max: 80, Cover: RuleCoverAll},
+	}}
+	points := timedPoints(start, []bool{false, false, false, false, false}, AlertSampleInterval)
+	if known, _ := rule.CheckTimed(points, points[len(points)-1].At); known {
+		t.Fatal("missing second condition treated as decisive")
+	}
+}
```

**File**: `model/alertrule.go` (modified, +147/-2)
```diff
@@ -2,12 +2,134 @@ package model
 
 import (
 	"slices"
+	"time"
 
 	"github.com/gin-gonic/gin"
 	"github.com/goccy/go-json"
 	"gorm.io/gorm"
 )
 
+const (
+	AlertSampleInterval = 3 * time.Second
+	AlertSampleMaxAge   = 6 * time.Second
+)
+
+// TimedAlertPoint records one distinct observation. Its timestamp is the
+// dashboard receipt time of the Agent report, or the sentinel tick for an
+// offline-only rule.
+type TimedAlertPoint struct {
+	At     time.Time
+	Values []bool
+}
+
+// CheckTimed evaluates the legacy Duration as Duration * 3 seconds, avoiding
+// both repeated stale samples and cadence-dependent early incidents. Unknown
+// coverage cannot create an incident or a recovery.
+func (r *AlertRule) CheckTimed(points []TimedAlertPoint, now time.Time) (known, passed bool) {
+	if r == nil || len(r.Rules) == 0 {
+		return false, false
+	}
+	allFailed := true
+	for index, rule := range r.Rules {
+		if rule == nil || !rule.IsSupportedType() {
+			return false, false
+		}
+		ruleKnown, rulePassed := rule.checkTimed(points, index, now)
+		if !ruleKnown {
+			return false, false
+		}
+		if rulePassed {
+			allFailed = false
+		}
+	}
+	return true, !allFailed
+}
+
+func (rule *Rule) checkTimed(points []TimedAlertPoint, index int, now time.Time) (known, passed bool) {
+	if len(points) == 0 {
+		return false, false
+	}
+	if rule.IsTransferDurationRule() {
+		last := points[len(points)-1]
+		if index >= len(last.Values) || now.Sub(last.At) > AlertSampleMaxAge {
+			return false, false
+		}
+		return true, last.Values[index]
+	}
+	window := time.Duration(rule.Duration) * AlertSampleInterval
+	if window <= 0 {
+		return false, false
+	}
+	end := now.Add(AlertSampleInterval) // the current observation represents one tick
+	start := end.Add(-window)
+	if points[0].At.After(start) {
+		return false, false // the configured wall-clock window has not elapsed
+	}
+	var covered, failed time.Duration
+	for i, point := range points {
+		if index >= len(point.Values) {
+			return false, false
+		}
+		segmentStart := point.At
+		if start.After(segmentStart) {
+			segmentStart = start
+		}
+		segmentEnd := point.At.Add(AlertSampleMaxAge)
+		if end.Before(segmentEnd) {
+			segmentEnd = end
+		}
+		if i+1 < len(points) {
+			if points[i+1].At.Before(segmentEnd) {
+				segmentEnd = points[i+1].At
+			}
+		} else {
+			if tickEnd := point.At.Add(AlertSampleInterval); tickEnd.Before(segmentEnd) {
+				segmentEnd = tickEnd
+			}
+		}
+		if !segmentEnd.After(segmentStart) {
+			continue
+		}
+		span := segmentEnd.Sub(segmentStart)
+		covered += span
+		if !point.Values[index] {
+			failed += span
+		}
+	}
+	if covered < window-window/10 {
+		return false, false
+	}
+	if rule.IsOfflineRule() {
+		if covered-failed >= AlertSampleInterval {
+			return true, true
+		}
+		if failed >= window-AlertSampleInterval && covered >= window-AlertSampleInterval {
+			return true, false
+		}
+		return false, false
+	}
+	if float64(failed) > float64(window)*0.70 {
+		return true, false
+	}
+	if float64(failed+window-covered) <= float64(window)*0.70 {
+		return true, true
+	}
+	return false, false
+}
+
+func (r *AlertRule) TimedRetention() time.Duration {
+	longest := AlertSampleMaxAge
+	for _, rule := range r.Rules {
+		if rule == nil || rule.IsTransferDurationRule() {
+			continue
+		}
+		if duration, ok := rule.DurationInt(); ok {
+			longest = max(longest, time.Duration(duration)*AlertSampleInterval+AlertSampleMaxAge)
+		}
+	}
+	return longest
+}
+
 const (
 	ModeAlwaysTrigger  = 0
 	ModeOnetimeTrigger = 1
@@ -75,6 +197,9 @@ func (r *AlertRule) IsSafeToEvaluate() bool {
 		if rule == nil || !rule.IsSupportedType() {
 			return false
 		}
+		if !rule.HasSafeThresholds() {
+			return false
+		}
 		switch rule.Cover {
 		case RuleCoverAll, RuleCoverIgnoreAll:
 		default:
@@ -152,18 +277,38 @@ func (r *AlertRule) HasPermission(ctx *gin.Context) bool {
 
 // Snapshot 对传入的Server进行该报警规则下所有type的检查 返回每项检查结果
 func (r *AlertRule) Snapshot(cycleTransferStats *CycleTransferStats, server *Server, db *gorm.DB) []bool {
+	point, _ := r.SnapshotStatus(cycleTransferStats, server, db)
+	return point
+}
+
+// SnapshotStatus preserves the distinction between a healthy measurement and
+// telemetry that is unavailable. A compound alert cannot be decided while any
+// of its applicable conditions is unknown.
+func (r *AlertRule) SnapshotStatus(cycleTransferStats *CycleTransferStats, server *Server, db *gorm.DB) ([]bool, bool) {
+	if server == nil {
+		return nil, false
+	}
+	return r.SnapshotStatusWithRuntime(cycleTransferStats, server, server.RuntimeSnapshot(), db)
+}
+
+// SnapshotStatusWithRuntime uses one immutable report for every condition.
+func (r *AlertRule) SnapshotStatusWithRuntime(cycleTransferStats *CycleTransferStats, server *Server, runtime RuntimeSnapshot, db *gorm.DB) ([]bool, bool) {
 	point := make([]bool, len(r.Rules))
+	known := true
 
 	for i, rule := range r.Rules {
 		if rule == nil || !rule.IsSupportedType() {
 			// Invalid persisted rules 
```

**File**: `model/notification.go` (modified, +52/-50)
```diff
@@ -180,63 +180,65 @@ func (ns *NotificationServerBundle) replaceParamsInString(str string, message st
 
 	if ns.Server != nil {
 		runtime := ns.Server.RuntimeSnapshot()
-		if runtime.State == nil || runtime.Host == nil {
-			return str
-		}
-		state := runtime.State
-		host := runtime.Host
 		replacements = append(replacements,
 			"#SERVER.NAME#", mod(ns.Server.Name),
 			"#SERVER.ID#", mod(fmt.Sprintf("%d", ns.Server.ID)),
-
-			// Converted metrics
-			"#SERVER.CPU#", mod(ns.formatUsage(false, state.CPU)),
-			"#SERVER.MEM#", mod(ns.formatUsage(true, float64(state.MemUsed)/float64(host.MemTotal))),
-			"#SERVER.SWAP#", mod(ns.formatUsage(true, float64(state.SwapUsed)/float64(host.SwapTotal))),
-			"#SERVER.DISK#", mod(ns.formatUsage(true, float64(state.DiskUsed)/float64(host.DiskTotal))),
-			"#SERVER.SPEEDIN#", mod(fmt.Sprintf("%s/s", ns.formatSize(state.NetInSpeed))),
-			"#SERVER.SPEEDOUT#", mod(fmt.Sprintf("%s/s", ns.formatSize(state.NetOutSpeed))),
-			"#SERVER.TRANSFERIN#", mod(ns.formatSize(state.NetInTransfer)),
-			"#SERVER.TRANSFEROUT#", mod(ns.formatSize(state.NetOutTransfer)),
-
-			// Raw metrics
-			"#SERVER.CPUUSED#", mod(fmt.Sprintf("%f", state.CPU)),
-			"#SERVER.MEMUSED#", mod(fmt.Sprintf("%d", state.MemUsed)),
-			"#SERVER.SWAPUSED#", mod(fmt.Sprintf("%d", state.SwapUsed)),
-			"#SERVER.DISKUSED#", mod(fmt.Sprintf("%d", state.DiskUsed)),
-			"#SERVER.MEMTOTAL#", mod(fmt.Sprintf("%d", host.MemTotal)),
-			"#SERVER.SWAPTOTAL#", mod(fmt.Sprintf("%d", host.SwapTotal)),
-			"#SERVER.DISKTOTAL#", mod(fmt.Sprintf("%d", host.DiskTotal)),
-			"#SERVER.NETINSPEED#", mod(fmt.Sprintf("%d", state.NetInSpeed)),
-			"#SERVER.NETOUTSPEED#", mod(fmt.Sprintf("%d", state.NetOutSpeed)),
-			"#SERVER.NETINTRANSFER#", mod(fmt.Sprintf("%d", state.NetInTransfer)),
-			"#SERVER.NETOUTTRANSFER#", mod(fmt.Sprintf("%d", state.NetOutTransfer)),
-			"#SERVER.LOAD1#", mod(fmt.Sprintf("%f", state.Load1)),
-			"#SERVER.LOAD5#", mod(fmt.Sprintf("%f", state.Load5)),
-			"#SERVER.LOAD15#", mod(fmt.Sprintf("%f", state.Load15)),
-			"#SERVER.TCPCONNCOUNT#", mod(fmt.Sprintf("%d", state.TcpConnCount)),
-			"#SERVER.UDPCONNCOUNT#", mod(fmt.Sprintf("%d", state.UdpConnCount)),
 		)
+		if runtime.State != nil && runtime.Host != nil {
+			state := runtime.State
+			host := runtime.Host
+			replacements = append(replacements,
+				// Converted metrics
+				"#SERVER.CPU#", mod(ns.formatUsage(false, state.CPU)),
+				"#SERVER.MEM#", mod(ns.formatUsage(true, float64(state.MemUsed)/float64(host.MemTotal))),
+				"#SERVER.SWAP#", mod(ns.formatUsage(true, float64(state.SwapUsed)/float64(host.SwapTotal))),
+				"#SERVER.DISK#", mod(ns.formatUsage(true, float64(state.DiskUsed)/float64(host.DiskTotal))),
+				"#SERVER.SPEEDIN#", mod(fmt.Sprintf("%s/s", ns.formatSize(state.NetInSpeed))),
+				"#SERVER.SPEEDOUT#", mod(fmt.Sprintf("%s/s", ns.formatSize(state.NetOutSpeed))),
+				"#SERVER.TRANSFERIN#", mod(ns.formatSize(state.NetInTransfer)),
+				"#SERVER.TRANSFEROUT#", mod(ns.formatSize(state.NetOutTransfer)),
+
+				// Raw metrics
+				"#SERVER.CPUUSED#", mod(fmt.Sprintf("%f", state.CPU)),
+				"#SERVER.MEMUSED#", mod(fmt.Sprintf("%d", state.MemUsed)),
+				"#SERVER.SWAPUSED#", mod(fmt.Sprintf("%d", state.SwapUsed)),
+				"#SERVER.DISKUSED#", mod(fmt.Sprintf("%d", state.DiskUsed)),
+				"#SERVER.MEMTOTAL#", mod(fmt.Sprintf("%d", host.MemTotal)),
+				"#SERVER.SWAPTOTAL#", mod(fmt.Sprintf("%d", host.SwapTotal)),
+				"#SERVER.DISKTOTAL#", mod(fmt.Sprintf("%d", host.DiskTotal)),
+				"#SERVER.NETINSPEED#", mod(fmt.Sprintf("%d", state.NetInSpeed)),
+				"#SERVER.NETOUTSPEED#", mod(fmt.Sprintf("%d", state.NetOutSpeed)),
+				"#SERVER.NETINTRANSFER#", mod(fmt.Sprintf("%d", state.NetInTransfer)),
+				"#SERVER.NETOUTTRANSFER#", mod(fmt.Sprintf("%d", state.NetOutTransfer)),
+				"#SERVER.LOAD1#", mod(fmt.Sprintf("%f", state.Load1)),
+				"#SERVER.LOAD5#", mod(fmt.Sprintf("%f", state.Load5)),
+				"#SERVER.LOAD15#", mod(fmt.Sprintf("%f", state.Load15)),
+				"#SERVER.TCPCONNCOUNT#", mod(fmt.Sprintf("%d", state.TcpConnCount)),
+				"#SERVER.UDPCONNCOUNT#", mod(fmt.Sprintf("%d", state.UdpConnCount)),
+			)
+		}
 
 		var ipv4, ipv6, validIP string
-		ip := ns.Server.GeoIP.IP
-		if ip.IPv4Addr != "" && ip.IPv6Addr != "" {
-			ipv4 = ip.IPv4Addr
-			ipv6 = ip.IPv6Addr
-			validIP = ipv4
-		} else if ip.IPv4Addr != "" {
-			ipv4 = ip.IPv4Addr
-			validIP = ipv4
-		} else {
-			ipv6 = ip.IPv6Addr
-			validIP = ipv6
+		if ns.Server.GeoIP != nil {
+			ip := ns.Server.GeoIP.IP
+			if ip.IPv4Addr != "" && ip.IPv6Addr != "" {
+				ipv4 = ip.IPv4Addr
+				ipv6 = ip.IPv6Addr
+				validIP = ipv4
+			} else if ip.IPv4Addr != "" {
+				ipv4 = ip.IPv4Addr
+				validIP = ipv4
+			} else {
+				ipv6 = ip.IPv6Addr
+				validIP = ipv6
+			}
+
+			replacements = append(replacements,
+				"#SERVER.IP#", mod(validIP),
+				"#SERVER.IPV4#", mod(ipv4),
+				"#SERVER.IPV6#", mod(ipv6),
+			)
 		}
-
-		replacements = append(replacements,
-			"#SERVER.IP#", mod(validIP),
-			
```

**File**: `model/rule.go` (modified, +140/-100)
```diff
@@ -1,6 +1,8 @@
 package model
 
 import (
+	"log"
+	"math"
 	"slices"
 	"strings"
 	"time"
@@ -90,36 +92,80 @@ func (u *Rule) DurationInt() (duration int, ok bool) {
 // which is the documented legacy spelling for hours.
 func (u *Rule) HasSafeCycleConfiguration() bool {
 	return u != nil && u.IsTransferDurationRule() && u.CycleStart != nil &&
-		u.CycleInterval > 0 && u.CycleInterval <= MaxAlertRuleCycleInterval
+		!u.CycleStart.After(time.Now()) && u.CycleInterval > 0 && u.CycleInterval <= MaxAlertRuleCycleInterval &&
+		u.HasSafeThresholds() && u.HasSafeCycleUnit()
 }
 
-// Snapshot 未通过规则返回 false, 通过返回 true
+func (u *Rule) HasSafeCycleUnit() bool {
+	if u == nil {
+		return false
+	}
+	switch strings.ToLower(u.CycleUnit) {
+	case "", "hour", "day", "week", "month", "year":
+		return true
+	default:
+		return false
+	}
+}
+
+func (u *Rule) HasSafeThresholds() bool {
+	if u == nil || math.IsNaN(u.Min) || math.IsNaN(u.Max) || math.IsInf(u.Min, 0) || math.IsInf(u.Max, 0) || u.Min < 0 || u.Max < 0 {
+		return false
+	}
+	return u.Min == 0 || u.Max == 0 || u.Min <= u.Max
+}
+
+// Snapshot is retained for callers which only need a boolean result. The alert
+// sentinel uses Evaluate so missing telemetry is not mistaken for a breach.
 func (u *Rule) Snapshot(cycleTransferStats *CycleTransferStats, server *Server, db *gorm.DB) bool {
+	passed, _ := u.Evaluate(cycleTransferStats, server, db)
+	return passed
+}
+
+// Evaluate returns known=false when a metric cannot be evaluated from the
+// current report. Unknown must neither trigger nor resolve an incident.
+func (u *Rule) Evaluate(cycleTransferStats *CycleTransferStats, server *Server, db *gorm.DB) (passed, known bool) {
+	if server == nil {
+		return true, false
+	}
+	return u.EvaluateRuntime(cycleTransferStats, server, server.RuntimeSnapshot(), db)
+}
+
+// EvaluateRuntime evaluates all conditions against the same immutable Agent
+// report. Callers evaluating a compound rule must share this snapshot.
+func (u *Rule) EvaluateRuntime(cycleTransferStats *CycleTransferStats, server *Server, runtime RuntimeSnapshot, db *gorm.DB) (passed, known bool) {
 	if u == nil || server == nil || !u.IsSupportedType() {
-		return true
+		return true, false
 	}
 	if u.IsTransferDurationRule() && (!u.HasSafeCycleConfiguration() || cycleTransferStats == nil) {
-		return true
+		return true, false
 	}
 
 	// 监控全部但是排除了此服务器
 	if u.Cover == RuleCoverAll && u.Ignore[server.ID] {
-		return true
+		return true, true
 	}
 	// 忽略全部但是指定监控了此服务器
 	if u.Cover == RuleCoverIgnoreAll && !u.Ignore[server.ID] {
-		return true
+		return true, true
 	}
 
+	evalNow := time.Now()
+	var cycleStart, cycleEnd time.Time
+	if u.IsTransferDurationRule() {
+		cycleStart, cycleEnd = u.transferDurationBounds(evalNow)
+	}
 	// 循环区间流量检测 · 短期无需重复检测
-	if u.IsTransferDurationRule() && u.NextTransferAt[server.ID].After(time.Now()) {
-		return u.LastCycleStatus[server.ID]
+	if u.IsTransferDurationRule() && u.NextTransferAt[server.ID].After(evalNow) {
+		return u.LastCycleStatus[server.ID], true
 	}
 
 	var src float64
-	runtime := server.RuntimeSnapshot()
+	if u.IsOfflineRule() {
+		return !runtime.LastActive.IsZero() && time.Since(runtime.LastActive) <= 6*time.Second, true
+	}
 	if runtime.State == nil {
-		return false
+		return true, false
 	}
 	state := runtime.State
 
@@ -128,61 +174,82 @@ func (u *Rule) Snapshot(cycleTransferStats *CycleTransferStats, server *Server,
 		src = float64(state.CPU)
 	case "gpu", "gpu_max":
 		if len(state.GPU) == 0 {
-			return true
+			return true, false
 		}
 		src = slices.Max(state.GPU)
 	case "memory":
 		if runtime.Host == nil {
-			return false
+			return true, false
+		}
+		if runtime.Host.MemTotal == 0 {
+			return true, false
 		}
 		src = percentage(state.MemUsed, runtime.Host.MemTotal)
 	case "swap":
 		if runtime.Host == nil {
-			return false
+			return true, false
+		}
+		if runtime.Host.SwapTotal == 0 {
+			return true, false
 		}
 		src = percentage(state.SwapUsed, runtime.Host.SwapTotal)
 	case "disk":
 		if runtime.Host == nil {
-			return false
+			return true, false
+		}
+		if runtime.Host.DiskTotal == 0 {
+			return true, false
 		}
 		src = percentage(state.DiskUsed, runtime.Host.DiskTotal)
 	case "net_in_speed":
 		src = float64(state.NetInSpeed)
 	case "net_out_speed":
 		src = float64(state.NetOutSpeed)
 	case "net_all_speed":
-		src = float64(state.NetOutSpeed + state.NetOutSpeed)
+		src = float64(state.NetInSpeed) + float64(state.NetOutSpeed)
 	case "transfer_in":
 		src = float64(state.NetInTransfer)
 	case "transfer_out":
 		src = float64(state.NetOutTransfer)
 	case "transfer_all":
 		src = float64(state.NetOutTransfer + state.NetInTransfer)
-	case "offline":
-		if runtime.LastActive.IsZero() {
-			src = 0
-		} else {
-			src = float64(runtime.LastActive.Unix())
-		}
 	case "transfer_in_cycle":
+		if db == nil {
+			return true, false
+		}
 		src = float64(utils.SubUintChecked(state.NetInTransfer, runtime.PrevTransferInSnapshot))
 		if u.CycleInterv
```

**File**: `model/server.go` (modified, +14/-10)
```diff
@@ -16,6 +16,7 @@ import (
 )
 
 var runtimeHolderInitMu sync.Mutex
+var nextServerReportSequence atomic.Uint64
 
 type Server struct {
 	Common
@@ -73,15 +74,16 @@ type taskStreamHolder struct {
 }
 
 type serverRuntimeHolder struct {
-	mu         sync.Mutex
-	canonical  *Server
-	stream     pb.NezhaService_ReportSystemStateServer
-	generation uint64
-	state      *HostState
-	host       *Host
-	lastActive time.Time
-	prevIn     uint64
-	prevOut    uint64
+	mu             sync.Mutex
+	canonical      *Server
+	stream         pb.NezhaService_ReportSystemStateServer
+	generation     uint64
+	state          *HostState
+	host           *Host
+	lastActive     time.Time
+	reportSequence uint64
+	prevIn         uint64
+	prevOut        uint64
 }
 
 type StateStreamLease struct {
@@ -204,6 +206,7 @@ func (lease StateStreamLease) updateState(receiver *Server, state *HostState, la
 			return false
 		}
 	}
+	lease.holder.reportSequence = nextServerReportSequence.Add(1)
 	return true
 }
 
@@ -334,6 +337,7 @@ type RuntimeSnapshot struct {
 	State                   *HostState
 	Host                    *Host
 	LastActive              time.Time
+	ReportSequence          uint64
 	PrevTransferInSnapshot  uint64
 	PrevTransferOutSnapshot uint64
 }
@@ -360,7 +364,7 @@ func (s *Server) RuntimeSnapshot() RuntimeSnapshot {
 			holder.host = cloneHost(s.Host)
 		}
 	}
-	return RuntimeSnapshot{State: cloneHostState(holder.state), Host: cloneHost(holder.host), LastActive: holder.lastActive, PrevTransferInSnapshot: holder.prevIn, PrevTransferOutSnapshot: holder.prevOut}
+	return RuntimeSnapshot{State: cloneHostState(holder.state), Host: cloneHost(holder.host), LastActive: holder.lastActive, ReportSequence: holder.reportSequence, PrevTransferInSnapshot: holder.prevIn, PrevTransferOutSnapshot: holder.prevOut}
 }
 
 func (s *Server) SetTransferSnapshots(inbound, outbound uint64) bool {
```

**File**: `service/singleton/alertsentinel.go` (modified, +184/-27)
```diff
@@ -4,6 +4,7 @@ import (
 	"fmt"
 	"log"
 	"sync"
+	"sync/atomic"
 	"time"
 
 	"github.com/jinzhu/copier"
@@ -26,11 +27,122 @@ type NotificationHistory struct {
 var (
 	AlertsLock                    sync.RWMutex
 	Alerts                        []*model.AlertRule
-	alertsStore                   map[uint64]map[uint64][][]bool       // [alert_id][server_id] -> [timeTick][ruleId] 时间点对应的rule的检查结果
-	alertsPrevState               map[uint64]map[uint64]uint8          // [alert_id][server_id] -> 对应报警规则的上一次报警状态
-	AlertsCycleTransferStatsStore map[uint64]*model.CycleTransferStats // [alert_id] -> 对应报警规则的周期流量统计
+	alertsStore                   map[uint64]map[uint64][]model.TimedAlertPoint // distinct reports per alert/server
+	alertsPrevState               map[uint64]map[uint64]uint8                   // [alert_id][server_id] -> 对应报警规则的上一次报警状态
+	alertsLastMetricSeq           map[uint64]map[uint64]uint64                  // last distinct Agent metric report per alert/server
+	AlertsCycleTransferStatsStore map[uint64]*model.CycleTransferStats          // [alert_id] -> 对应报警规则的周期流量统计
+	alertDeliveryMu               sync.Mutex
+	alertDeliveries               map[uint64]map[uint64]*alertDeliveryEntry
+	alertEventSequence            atomic.Uint64
 )
 
+type alertDeliveryEntry struct {
+	cancel chan struct{}
+	done   chan struct{}
+	sendMu *sync.Mutex
+}
+
+type alertDeliveryPhase uint8
+
+const (
+	alertDeliveryIncident alertDeliveryPhase = iota
+	alertDeliveryRecovery
+)
+
+func cancelAlertDeliveries(alertID uint64) {
+	alertDeliveryMu.Lock()
+	defer alertDeliveryMu.Unlock()
+	for _, entry := range alertDeliveries[alertID] {
+		close(entry.cancel)
+	}
+	delete(alertDeliveries, alertID)
+}
+
+func cancelAlertDeliveriesForServers(serverIDs []uint64) {
+	alertDeliveryMu.Lock()
+	defer alertDeliveryMu.Unlock()
+	for alertID, byServer := range alertDeliveries {
+		for _, serverID := range serverIDs {
+			if entry := byServer[serverID]; entry != nil {
+				close(entry.cancel)
+				delete(byServer, serverID)
+			}
+		}
+		if len(byServer) == 0 {
+			delete(alertDeliveries, alertID)
+		}
+	}
+}
+
+func runAlertDelivery(cancel <-chan struct{}, send func() bool, always bool, retryDelay time.Duration) {
+	for {
+		select {
+		case <-cancel:
+			return
+		default:
+		}
+		delivered := send()
+		if delivered && !always {
+			return
+		}
+		delay := retryDelay
+		if delivered {
+			delay = firstNotificationDelay
+		}
+		timer := time.NewTimer(delay)
+		select {
+		case <-cancel:
+			timer.Stop()
+			return
+		case <-timer.C:
+		}
+	}
+}
+
+func startAlertDelivery(alert *model.AlertRule, server *model.Server, message, muteLabel string, phase alertDeliveryPhase) {
+	// A mute entry belongs to one transition, not all later incidents of the
+	// same phase. Concurrent in-flight sends may finish after a recovery.
+	muteLabel = fmt.Sprintf("%s:event-%d", muteLabel, alertEventSequence.Add(1))
+	alertDeliveryMu.Lock()
+	if alertDeliveries == nil {
+		alertDeliveries = make(map[uint64]map[uint64]*alertDeliveryEntry)
+	}
+	if alertDeliveries[alert.ID] == nil {
+		alertDeliveries[alert.ID] = make(map[uint64]*alertDeliveryEntry)
+	}
+	sendMu := new(sync.Mutex)
+	if old := alertDeliveries[alert.ID][server.ID]; old != nil {
+		close(old.cancel)
+		sendMu = old.sendMu
+	}
+	entry := &alertDeliveryEntry{cancel: make(chan struct{}), done: make(chan struct{}), sendMu: sendMu}
+	alertDeliveries[alert.ID][server.ID] = entry
+	alertDeliveryMu.Unlock()
+
+	groupID := alert.NotificationGroupID
+	always := phase == alertDeliveryIncident && alert.TriggerMode == model.ModeAlwaysTrigger
+	go func() {
+		defer close(entry.done)
+		runAlertDelivery(entry.cancel, func() bool {
+			// Serialize incident/recovery delivery for this alert/server pair.
+			// A recovery can cancel a pending incident, but never overtake an
+			// already-running network request.
+			entry.sendMu.Lock()
+			defer entry.sendMu.Unlock()
+			select {
+			case <-entry.cancel:
+				return true
+			default:
+			}
+			return NotificationShared.SendNotification(groupID, message, muteLabel, server)
+		}, always, 30*time.Second)
+	}()
+}
+
+func shouldRunAlertFailTasks(triggerMode uint8, newIncident bool) bool {
+	return newIncident || triggerMode == model.ModeAlwaysTrigger
+}
+
 // addCycleTransferStatsInfo 向AlertsCycleTransferStatsStore中添加周期流量报警统计信息
 func addCycleTransferStatsInfo(alert *model.AlertRule) {
 	if alert == nil || !alert.Enabled() || !alert.IsSafeToEvaluate() {
@@ -59,8 +171,17 @@ func addCycleTransferStatsInfo(alert *model.AlertRule) {
 
 // AlertSentinelStart 报警器启动
 func AlertSentinelStart() {
-	alertsStore = make(map[uint64]map[uint64][][]bool)
+	alertDeliveryMu.Lock()
+	for _, byServer := range alertDeliveries {
+		for _, entry := range byServer {
+			close(entry.cancel)
+		}
+	}
+	alertDeliveries = make(map[uint64]map[uint64]*alertDeliveryEntry)
+	alertDeliveryMu.Unlock()
+	alertsStore = make(map[uint64]map[uint64][]model.TimedAlertPoint)
 	alertsPrevState = make(map[uint64]map[uin
```

---

### Incident Patch 2: `1420dd45` (2026-10-01)
**Commit Message**: fix(nat): bound dashboard credential classification

**File**: `cmd/dashboard/controller/dashboard_credential.go` (modified, +67/-23)
```diff
@@ -1,12 +1,13 @@
 package controller
 
 import (
-	"errors"
+	"context"
 	"log"
 	"strings"
 
 	jwt "github.com/golang-jwt/jwt/v4"
 	"gorm.io/gorm"
+	"gorm.io/gorm/logger"
 
 	ginjwt "github.com/appleboy/gin-jwt/v2"
 	"github.com/nezhahq/nezha/model"
@@ -15,8 +16,8 @@ import (
 
 // dashboardCredentialJWTParser verifies that a JWT was signed by this
 // dashboard. It is derived from the auth middleware created in routers() and
-// exists only for IsDashboardCredential; it must never authenticate dashboard
-// requests on its own.
+// exists only for dashboard-credential classification; it must never
+// authenticate dashboard requests on its own.
 var dashboardCredentialJWTParser *ginjwt.GinJWTMiddleware
 
 // newDashboardCredentialJWTParser derives a signature-only parser from the
@@ -69,32 +70,75 @@ func IsDashboardCredential(authz string) bool {
 // issued by this dashboard (unknown PAT hash, failed signature verification)
 // returns false.
 func IsDashboardCredentialValue(value string) bool {
-	plaintext := strings.TrimSpace(value)
-	if strings.HasPrefix(plaintext, model.APITokenPrefix) {
-		return isDashboardAPIToken(plaintext)
+	classified := ClassifyDashboardCredentialValues(context.Background(), []string{value})
+	if len(classified) != 1 {
+		return true
 	}
-	return isDashboardSignedJWT(plaintext)
+	return classified[0]
 }
 
-// isDashboardAPIToken resolves a PAT-shaped value against the api_tokens
-// table. The plaintext token is only ever hashed here; it is never logged.
-func isDashboardAPIToken(plaintext string) bool {
+// ClassifyDashboardCredentialValues classifies a bounded request batch. JWTs
+// are checked independently, while all PAT-shaped values are hashed and
+// resolved with one silent IN query. This prevents attacker-controlled NAT
+// query parameters or cookies from amplifying one HTTP request into thousands
+// of SQLite queries and record-not-found log entries.
+func ClassifyDashboardCredentialValues(ctx context.Context, values []string) []bool {
+	if ctx == nil {
+		ctx = context.Background()
+	}
+	results := make([]bool, len(values))
+	patIndexes := make(map[string][]int)
+	for i, value := range values {
+		plaintext := strings.TrimSpace(value)
+		if strings.HasPrefix(plaintext, model.APITokenPrefix) {
+			hash := model.HashAPIToken(plaintext)
+			patIndexes[hash] = append(patIndexes[hash], i)
+			continue
+		}
+		results[i] = isDashboardSignedJWT(plaintext)
+	}
+	if len(patIndexes) == 0 {
+		return results
+	}
 	if singleton.DB == nil {
 		logDashboardCredentialUnclassifiable("api token lookup unavailable")
-		return true
+		for _, indexes := range patIndexes {
+			for _, i := range indexes {
+				results[i] = true
+			}
+		}
+		return results
 	}
-	var tok model.APIToken
-	err := singleton.DB.Where("token_hash = ?", model.HashAPIToken(plaintext)).First(&tok).Error
-	if err == nil {
-		return true
+
+	hashes := make([]string, 0, len(patIndexes))
+	for hash := range patIndexes {
+		hashes = append(hashes, hash)
 	}
-	if errors.Is(err, gorm.ErrRecordNotFound) {
-		// Deterministic proof the token was not issued by this dashboard:
-		// forwarding it leaks nothing the dashboard ever validated.
-		return false
+	type tokenHashRow struct {
+		TokenHash string
+	}
+	var rows []tokenHashRow
+	err := singleton.DB.WithContext(ctx).
+		Session(&gorm.Session{Logger: logger.Discard}).
+		Model(&model.APIToken{}).
+		Select("token_hash").
+		Where("token_hash IN ?", hashes).
+		Find(&rows).Error
+	if err != nil {
+		logDashboardCredentialUnclassifiable("api token lookup failed")
+		for _, indexes := range patIndexes {
+			for _, i := range indexes {
+				results[i] = true
+			}
+		}
+		return results
+	}
+	for _, row := range rows {
+		for _, i := range patIndexes[row.TokenHash] {
+			results[i] = true
+		}
 	}
-	logDashboardCredentialUnclassifiable("api token lookup failed")
-	return true
+	return results
 }
 
 // isDashboardSignedJWT verifies the token signature with the dashboard's
@@ -112,7 +156,7 @@ func isDashboardSignedJWT(token string) bool {
 }
 
 // logDashboardCredentialUnclassifiable records a classification failure. The
-// Authorization value itself is never included in the message.
+// credential value itself is never included in the message.
 func logDashboardCredentialUnclassifiable(reason string) {
-	log.Printf("NEZHA>> NAT ingress: Authorization value could not be classified (%s); stripping it as a precaution", reason)
+	log.Printf("NEZHA>> NAT ingress: credential value could not be classified (%s); stripping it as a precaution", reason)
 }
```

**File**: `cmd/dashboard/controller/dashboard_credential_nat_flow_test.go` (modified, +2/-2)
```diff
@@ -49,8 +49,8 @@ func setupNATFlowTest(t *testing.T) (*rpcService.NezhaHandler, *model.Server, *n
 
 	// Wire the gate exactly as cmd/dashboard/main.go does, with the real
 	// classifiers built by setupDashboardCredentialTest.
-	rpc.SetNATDashboardCredentialGate(IsDashboardCredential, IsDashboardCredentialValue)
-	t.Cleanup(func() { rpc.SetNATDashboardCredentialGate(nil, nil) })
+	rpc.SetNATDashboardCredentialGate(ClassifyDashboardCredentialValues)
+	t.Cleanup(func() { rpc.SetNATDashboardCredentialGate(nil) })
 
 	return handler, server, taskStream
 }
```

**File**: `cmd/dashboard/controller/dashboard_credential_test.go` (modified, +30/-0)
```diff
@@ -2,6 +2,7 @@ package controller
 
 import (
 	"bytes"
+	"context"
 	"log"
 	"testing"
 	"time"
@@ -163,6 +164,35 @@ func TestIsDashboardCredentialValueClassification(t *testing.T) {
 	})
 }
 
+func TestClassifyDashboardCredentialValuesBatchesPATLookup(t *testing.T) {
+	setupDashboardCredentialTest(t)
+
+	dashboardPAT := model.APITokenPrefix + "dashboard-batch-pat"
+	require.NoError(t, singleton.DB.Create(&model.APIToken{
+		UserID:    1,
+		Name:      "nat-batch-classification",
+		TokenHash: model.HashAPIToken(dashboardPAT),
+	}).Error)
+
+	queryCount := 0
+	const callbackName = "test:count-dashboard-credential-batch-query"
+	require.NoError(t, singleton.DB.Callback().Query().Before("gorm:query").Register(callbackName, func(*gorm.DB) {
+		queryCount++
+	}))
+	t.Cleanup(func() { singleton.DB.Callback().Query().Remove(callbackName) })
+
+	values := []string{
+		dashboardPAT,
+		model.APITokenPrefix + "unknown-one",
+		dashboardPAT,
+		model.APITokenPrefix + "unknown-two",
+	}
+	classified := ClassifyDashboardCredentialValues(context.Background(), values)
+
+	require.Equal(t, []bool{true, false, true, false}, classified)
+	require.Equal(t, 1, queryCount, "all PAT hashes in one request must use one database query")
+}
+
 func TestIsDashboardCredentialFailsClosedWhenParserUnavailable(t *testing.T) {
 	setupDashboardCredentialTest(t)
 	dashboardCredentialJWTParser = nil
```

**File**: `cmd/dashboard/dashboard_credential_wiring_test.go` (modified, +2/-2)
```diff
@@ -7,8 +7,8 @@ import (
 )
 
 // TestWireNATDashboardCredentialGate pins the NAT ingress wiring contract:
-// main() must connect the real dashboard-credential classifiers
-// (controller.IsDashboardCredential / controller.IsDashboardCredentialValue)
+// main() must connect the real batched dashboard-credential classifier
+// (controller.ClassifyDashboardCredentialValues)
 // through wireNATDashboardCredentialGate before any listener serves traffic.
 // That the wired functions really classify per channel is pinned end to end
 // by the controller package's real-classifier NAT flow test.
```

**File**: `cmd/dashboard/main.go` (modified, +2/-2)
```diff
@@ -235,10 +235,10 @@ func main() {
 // TokenLookup accepts — the Authorization header, the ?token= query parameter
 // and the nz-jwt cookie — before tunneling a request to the agent, and
 // forwards foreign values untouched. ServeWeb built the JWT parser the
-// classifiers reuse, so the gate is wired right after it and before any
+// classifier reuses, so the gate is wired right after it and before any
 // listener starts serving.
 func wireNATDashboardCredentialGate() {
-	rpc.SetNATDashboardCredentialGate(controller.IsDashboardCredential, controller.IsDashboardCredentialValue)
+	rpc.SetNATDashboardCredentialGate(controller.ClassifyDashboardCredentialValues)
 }
 
 func newHTTPandGRPCMux(httpHandler http.Handler, grpcHandler http.Handler) http.Handler {
```

**File**: `cmd/dashboard/rpc/nat_credential.go` (modified, +163/-43)
```diff
@@ -1,9 +1,11 @@
 package rpc
 
 import (
+	"context"
 	"net/http"
 	"net/url"
 	"strings"
+	"sync"
 )
 
 // Channel names of the panel's own TokenLookup (controller/jwt.go
@@ -14,37 +16,42 @@ import (
 const (
 	natDashboardJWTCookieName     = "nz-jwt"
 	natDashboardJWTQueryParameter = "token"
+	// Keep credential classification work constant even when an unauthenticated
+	// NAT request contains thousands of token parameters or cookies. Values
+	// beyond this per-request budget fail closed and are stripped.
+	maxNATDashboardCredentialValues = 16
 )
 
 var (
-	// natDashboardAuthorizationGate classifies an Authorization header value
-	// (case-sensitive "Bearer " scheme included) as a credential issued by
-	// this dashboard.
-	natDashboardAuthorizationGate func(authz string) bool
-	// natDashboardCredentialValueGate classifies a raw credential value — the
-	// part after the "Bearer " scheme, exactly as the ?token= query parameter
-	// and the nz-jwt cookie carry it — as a credential issued by this
-	// dashboard.
-	natDashboardCredentialValueGate func(value string) bool
+	natDashboardCredentialGateMu sync.RWMutex
+	// natDashboardCredentialValueGate classifies a bounded batch of raw
+	// credential values. Batching lets the controller resolve all PAT hashes in
+	// one query instead of turning attacker-controlled query/cookie fan-out into
+	// one database query per value.
+	natDashboardCredentialValueGate func(ctx context.Context, values []string) []bool
 )
 
-// SetNATDashboardCredentialGate wires the dashboard-credential classifiers
+// SetNATDashboardCredentialGate wires the dashboard-credential classifier
 // used by the NAT ingress. main() injects
-// controller.IsDashboardCredential and controller.IsDashboardCredentialValue;
+// controller.ClassifyDashboardCredentialValues;
 // the setter keeps the rpc package free of a dependency on the controller
 // package, the same pattern as SetReceiptGateListener and
 // SetMCPKillSwitchObserver. A nil function fails closed: every value on that
 // channel is then treated as dashboard-issued and stripped.
-func SetNATDashboardCredentialGate(authorizationClass func(authz string) bool, valueClass func(value string) bool) {
-	natDashboardAuthorizationGate = authorizationClass
+func SetNATDashboardCredentialGate(valueClass func(ctx context.Context, values []string) []bool) {
+	natDashboardCredentialGateMu.Lock()
 	natDashboardCredentialValueGate = valueClass
+	natDashboardCredentialGateMu.Unlock()
 }
 
 // NATDashboardCredentialGateWired reports whether the dashboard-credential
-// classifiers have been wired. It exists so the main() wiring contract can be
+// classifier has been wired. It exists so the main() wiring contract can be
 // pinned by a test.
 func NATDashboardCredentialGateWired() bool {
-	return natDashboardAuthorizationGate != nil && natDashboardCredentialValueGate != nil
+	natDashboardCredentialGateMu.RLock()
+	wired := natDashboardCredentialValueGate != nil
+	natDashboardCredentialGateMu.RUnlock()
+	return wired
 }
 
 // stripDashboardCredentials removes credentials issued by this dashboard from
@@ -55,15 +62,103 @@ func NATDashboardCredentialGateWired() bool {
 // backend may authenticate with credentials of its own, and this dashboard
 // must not make policy for them.
 func stripDashboardCredentials(request *http.Request) {
-	stripDashboardAuthorizationHeader(request)
-	stripDashboardCredentialQuery(request)
-	stripDashboardCredentialCookie(request)
+	classification := classifyNATDashboardCredentialValues(request)
+	stripDashboardAuthorizationHeader(request, classification)
+	stripDashboardCredentialQuery(request, classification)
+	stripDashboardCredentialCookie(request, classification)
+}
+
+type natDashboardCredentialClassification struct {
+	wired   bool
+	limited bool
+	issued  map[string]bool
+}
+
+func (c natDashboardCredentialClassification) isDashboardCredential(value string) bool {
+	if !c.wired {
+		return true
+	}
+	if issued, ok := c.issued[value]; ok {
+		return issued
+	}
+	// Only candidate values collected from this request reach this method. A
+	// missing result therefore means the distinct-value budget was exceeded;
+	// fail closed so a dashboard credential cannot be hidden after junk values.
+	return c.limited
+}
+
+func classifyNATDashboardCredentialValues(request *http.Request) natDashboardCredentialClassification {
+	natDashboardCredentialGateMu.RLock()
+	gate := natDashboardCredentialValueGate
+	natDashboardCredentialGateMu.RUnlock()
+	classification := natDashboardCredentialClassification{
+		wired:  gate != nil,
+		issued: make(map[string]bool),
+	}
+	if gate == nil {
+		return classification
+	}
+
+	values, limited := collectNATDashboardCredentialValues(request)
+	classification.limited = limited
+	results := gate(request.Context(), values)
+	if len(results) != len(values) {
+		// A broken classifier must not turn into credential forwarding.
+		for _, value := range values {
+			classification.issued[value] = tru
```

**File**: `cmd/dashboard/rpc/nat_credential_test.go` (modified, +72/-23)
```diff
@@ -1,8 +1,11 @@
 package rpc
 
 import (
+	"context"
+	"fmt"
 	"net/http"
 	"net/url"
+	"strings"
 	"testing"
 
 	"github.com/nezhahq/nezha/model"
@@ -35,27 +38,21 @@ const (
 // is foreign.
 func installNATCredentialTestGate(t *testing.T) {
 	t.Helper()
-	originalAuthorization := natDashboardAuthorizationGate
-	originalValue := natDashboardCredentialValueGate
-	natDashboardAuthorizationGate = func(authz string) bool {
-		switch authz {
-		case natTestDashboardJWT, natTestDashboardExpiredJWT, natTestDashboardAPIToken:
-			return true
-		default:
-			return false
+	natDashboardCredentialGateMu.RLock()
+	original := natDashboardCredentialValueGate
+	natDashboardCredentialGateMu.RUnlock()
+	SetNATDashboardCredentialGate(func(_ context.Context, values []string) []bool {
+		results := make([]bool, len(values))
+		for i, value := range values {
+			switch value {
+			case natTestDashboardJWTValue, natTestDashboardExpiredJWTValue, natTestDashboardPATValue:
+				results[i] = true
+			}
 		}
-	}
-	natDashboardCredentialValueGate = func(value string) bool {
-		switch value {
-		case natTestDashboardJWTValue, natTestDashboardExpiredJWTValue, natTestDashboardPATValue:
-			return true
-		default:
-			return false
-		}
-	}
+		return results
+	})
 	t.Cleanup(func() {
-		natDashboardAuthorizationGate = originalAuthorization
-		natDashboardCredentialValueGate = originalValue
+		SetNATDashboardCredentialGate(original)
 	})
 }
 
@@ -119,17 +116,69 @@ func TestStripDashboardCredentialsCookieChannelQuotedValue(t *testing.T) {
 	}
 }
 
+func TestStripDashboardCredentialsCookieChannelEscapedValue(t *testing.T) {
+	// Gin's cookie TokenLookup URL-decodes the value before JWT validation.
+	// NAT must classify the same decoded value or an encoded dashboard JWT can
+	// be accepted by the panel and then leak unchanged to the backend.
+	installNATCredentialTestGate(t)
+	request := &http.Request{Header: make(http.Header)}
+	escaped := strings.ReplaceAll(natTestDashboardJWTValue, "-", "%2D")
+	request.Header.Set("Cookie", "nz-jwt="+escaped+"; sid=abc")
+
+	stripDashboardCredentials(request)
+
+	if got := request.Header.Get("Cookie"); got != "sid=abc" {
+		t.Fatalf("cookie channel kept %q, want escaped dashboard token dropped", got)
+	}
+}
+
+func TestStripDashboardCredentialsDeduplicatesAndBoundsClassification(t *testing.T) {
+	natDashboardCredentialGateMu.RLock()
+	original := natDashboardCredentialValueGate
+	natDashboardCredentialGateMu.RUnlock()
+	t.Cleanup(func() { SetNATDashboardCredentialGate(original) })
+
+	classifiedValues := 0
+	gateCalls := 0
+	SetNATDashboardCredentialGate(func(_ context.Context, values []string) []bool {
+		gateCalls++
+		classifiedValues += len(values)
+		return make([]bool, len(values))
+	})
+
+	query := make(url.Values)
+	for range 100 {
+		query.Add("token", model.APITokenPrefix+"same-value")
+	}
+	for i := range 100 {
+		query.Add("token", fmt.Sprintf("%sunique-%d", model.APITokenPrefix, i))
+	}
+	request := &http.Request{Header: make(http.Header), URL: &url.URL{RawQuery: query.Encode()}}
+
+	stripDashboardCredentials(request)
+
+	if gateCalls != 1 {
+		t.Fatalf("classifier called %d times, want one batched call", gateCalls)
+	}
+	if classifiedValues > maxNATDashboardCredentialValues {
+		t.Fatalf("classified %d credential values, want at most %d per request", classifiedValues, maxNATDashboardCredentialValues)
+	}
+	if strings.Contains(request.URL.RawQuery, model.APITokenPrefix+"unique-99") {
+		t.Fatal("credential beyond the classification budget survived; overflow must fail closed")
+	}
+}
+
 func TestPrepareNATCapabilityFailsClosedWithoutGate(t *testing.T) {
 	// Given — unwired gates: every value on every channel is treated as
 	// dashboard-issued and stripped, foreign ones included.
-	SetNATDashboardCredentialGate(nil, nil)
-	t.Cleanup(func() { SetNATDashboardCredentialGate(nil, nil) })
+	SetNATDashboardCredentialGate(nil)
+	t.Cleanup(func() { SetNATDashboardCredentialGate(nil) })
 	request := &http.Request{
 		Header: make(http.Header),
-		URL:    &url.URL{Path: "/nat", RawQuery: "keep=1&token=" + natTestForeignJWTValue},
+		URL:    &url.URL{Path: "/nat", RawQuery: "keep=1&token=" + natTestForeignJWTValue + "&token=%ZZ"},
 	}
 	request.Header.Set("Authorization", natTestForeignRandom)
-	request.Header.Set("Cookie", "sid=abc; nz-jwt="+natTestForeignJWTValue)
+	request.Header.Set("Cookie", "sid=abc; nz-jwt="+natTestForeignJWTValue+"; nz-jwt=%ZZ")
 
 	// When
 	lease, err := prepareNATCapability(request, &model.NAT{Common: model.Common{ID: 91}, ServerID: 81})
```

---

### Incident Patch 3: `b71188f1` (2026-10-01)
**Commit Message**: Merge pull request #1241 from xvkong233/fix/nat-selective-authorization-strip

fix(nat): strip only dashboard-issued Authorization credentials at NAT ingress

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

**File**: `cmd/dashboard/controller/dashboard_credential.go` (added, +118/-0)
```diff
@@ -0,0 +1,118 @@
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
+// case-sensitive "Bearer " scheme is considered; the value after the scheme is
+// classified by IsDashboardCredentialValue, which is also the entry point for
+// the panel's scheme-less TokenLookup channels. Only a deterministic proof
+// that the value was not issued by this dashboard (scheme mismatch, unknown
+// PAT hash, failed signature verification) returns false.
+func IsDashboardCredential(authz string) bool {
+	raw := strings.TrimSpace(authz)
+	if !strings.HasPrefix(raw, "Bearer ") {
+		return false
+	}
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
+// logDashboardCredentialUnclassifiable records a classifica
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

**File**: `cmd/dashboard/controller/dashboard_credential_test.go` (added, +196/-0)
```diff
@@ -0,0 +1,196 @@
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
+		require.True(t, IsDashboardC
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

**File**: `cmd/dashboard/main.go` (modified, +13/-0)
```diff
@@ -169,6 +169,7 @@ func main() {
 	grpcHandler := rpc.ServeRPC()
 	httpHandler := controller.ServeWeb(frontendDist)
 	controller.InitUpgrader()
+	wireNATDashboardCredentialGate()
 
 	muxHandler := newHTTPandGRPCMux(httpHandler, grpcHandler)
 	muxServerHTTP := &http.Server{
@@ -228,6 +229,18 @@ func main() {
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

**File**: `cmd/dashboard/rpc/nat.go` (modified, +9/-1)
```diff
@@ -80,7 +80,15 @@ func ServeNAT(w http.ResponseWriter, r *http.Request, natConfig *model.NAT) {
 		return
 	}
 
-	// Authorization authenticates Dashboard access before NAT ingress; it must not become an origin credential for the configured NAT backend.
+	// Credential invariant at NAT ingress: credentials issued by this
+	// dashboard — the panel-signed JWT (verified by signature only, expiry
+	// deliberately ignored) and the panel API token — must never become origin
+	// credentials for the configured NAT backend. prepareNATCapability has
+	// already stripped them from every channel the panel's own TokenLookup
+	// accepts (Authorization header, ?token= query parameter, nz-jwt cookie);
+	// whatever remains on those channels is either absent or a foreign
+	// credential, which is forwarded untouched because the NAT backend may
+	// authenticate with credentials of its own.
 	wWrapped, err := utils.NewRequestWrapper(r, w)
 	if err != nil {
 		return
```

**File**: `cmd/dashboard/rpc/nat_capability_agentcompat.go` (modified, +13/-3)
```diff
@@ -22,16 +22,26 @@ type natCapabilityLease struct {
 func prepareNATCapability(request *http.Request, natConfig *model.NAT) (natCapabilityLease, error) {
 	values := request.Header.Values(agentcompatcontract.IOStreamCapabilityHeader)
 	if len(values) == 0 {
-		request.Header.Del("Authorization")
+		// No capability header: legacy NAT path. Strip dashboard-issued
+		// credentials (panel JWT or panel PAT) from the Authorization header,
+		// the ?token= query parameter and the nz-jwt cookie so they never
+		// become origin credentials; foreign values are ordinary request data.
+		stripDashboardCredentials(request)
 		return natCapabilityLease{}, nil
 	}
 	request.Header.Del(agentcompatcontract.IOStreamCapabilityHeader)
 	if len(values) != 1 || values[0] == "" {
-		request.Header.Del("Authorization")
+		// Invalid capability: nothing is forwarded, but dashboard-issued
+		// credentials still must not survive into errors or task data.
+		stripDashboardCredentials(request)
 		return natCapabilityLease{}, errors.New("invalid NAT capability")
 	}
 	access, handle, err := serviceRPC.NezhaHandlerSingleton.ConsumeAgentCompatNATCapabilityForProfile(values[0], natConfig.ServerID, natConfig.ID)
-	request.Header.Del("Authorization")
+	// From here the request bytes may reach the agent (active lease) or the
+	// request ends in a 503; either way dashboard-issued credentials are
+	// stripped from every TokenLookup channel, foreign ones are forwarded
+	// untouched.
+	stripDashboardCredentials(request)
 	if err != nil {
 		return natCapabilityLease{}, errors.New("invalid NAT capability")
 	}
```

---

### Incident Patch 4: `3ad985f3` (2026-10-01)
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

---

### Incident Patch 5: `40240ed0` (2026-10-01)
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

### Incident Patch 6: `36b742a7` (2026-10-01)
**Commit Message**: fix: harden dashboard security boundaries

**File**: `cmd/dashboard/controller/credential_redaction_test.go` (modified, +29/-15)
```diff
@@ -109,12 +109,14 @@ func TestListDDNS_RedactsCredentials(t *testing.T) {
 	defer setupTenancyTest(t)()
 
 	p := model.DDNSProfile{
-		Common:         model.Common{UserID: 10},
-		Name:           "cf",
-		Provider:       "cloudflare",
-		AccessID:       "id",
-		AccessSecret:   "super-secret-token",
-		WebhookHeaders: `{"Authorization":"Bearer xxx"}`,
+		Common:             model.Common{UserID: 10},
+		Name:               "cf",
+		Provider:           "cloudflare",
+		AccessID:           "id",
+		AccessSecret:       "super-secret-token",
+		WebhookURL:         "https://ddns.example/update?token=embedded-secret",
+		WebhookRequestBody: `{"token":"embedded-secret"}`,
+		WebhookHeaders:     `{"Authorization":"Bearer xxx"}`,
 	}
 	require.NoError(t, singleton.DB.Create(&p).Error)
 	singleton.DDNSShared.InsertForTest(&p)
@@ -124,12 +126,18 @@ func TestListDDNS_RedactsCredentials(t *testing.T) {
 	require.NoError(t, err)
 	require.Len(t, out, 1)
 	require.Empty(t, out[0].AccessSecret, "access_secret must be redacted in list response")
+	require.Empty(t, out[0].WebhookURL, "webhook_url must be redacted in list response")
+	require.Empty(t, out[0].WebhookRequestBody, "webhook_request_body must be redacted in list response")
 	require.Empty(t, out[0].WebhookHeaders, "webhook_headers must be redacted in list response")
 	require.Equal(t, "id", out[0].AccessID, "non-secret fields must be preserved")
 
 	var stored model.DDNSProfile
 	require.NoError(t, singleton.DB.First(&stored, p.ID).Error)
 	require.Equal(t, "super-secret-token", stored.AccessSecret, "redaction must not mutate stored data")
+	require.Equal(t, "https://ddns.example/update?token=embedded-secret", stored.WebhookURL,
+		"redaction must not mutate stored webhook URL")
+	require.Equal(t, `{"token":"embedded-secret"}`, stored.WebhookRequestBody,
+		"redaction must not mutate stored webhook body")
 }
 
 func TestListNotification_RedactsCredentials(t *testing.T) {
@@ -164,14 +172,15 @@ func TestUpdateDDNS_EmptySecretPreservesStored(t *testing.T) {
 	defer setupTenancyTest(t)()
 
 	existing := model.DDNSProfile{
-		Common:         model.Common{UserID: 10},
-		Name:           "cf",
-		Provider:       "webhook",
-		AccessID:       "id",
-		AccessSecret:   "keep-me",
-		WebhookURL:     "http://127.0.0.1/",
-		WebhookMethod:  1,
-		WebhookHeaders: `{"X-Token":"keep-header"}`,
+		Common:             model.Common{UserID: 10},
+		Name:               "cf",
+		Provider:           "webhook",
+		AccessID:           "id",
+		AccessSecret:       "keep-me",
+		WebhookURL:         "http://127.0.0.1/",
+		WebhookRequestBody: `{"X-Token":"keep-body"}`,
+		WebhookMethod:      1,
+		WebhookHeaders:     `{"X-Token":"keep-header"}`,
 	}
 	require.NoError(t, singleton.DB.Create(&existing).Error)
 	singleton.DDNSShared.InsertForTest(&existing)
@@ -181,10 +190,11 @@ func TestUpdateDDNS_EmptySecretPreservesStored(t *testing.T) {
 		"provider":             "webhook",
 		"access_id":            "id",
 		"access_secret":        "",
-		"webhook_url":          "http://127.0.0.1/",
+		"webhook_url":          "",
 		"webhook_method":       1,
 		"webhook_request_type": 1,
 		"webhook_headers":      "",
+		"webhook_request_body": "",
 		"max_retries":          3,
 	})
 	c.Params = gin.Params{{Key: "id", Value: itoa(existing.ID)}}
@@ -197,6 +207,10 @@ func TestUpdateDDNS_EmptySecretPreservesStored(t *testing.T) {
 	require.Equal(t, "keep-me", after.AccessSecret, "empty submitted secret must preserve stored value")
 	require.Equal(t, `{"X-Token":"keep-header"}`, after.WebhookHeaders,
 		"empty submitted headers must preserve stored value")
+	require.Equal(t, "http://127.0.0.1/", after.WebhookURL,
+		"empty submitted webhook URL must preserve stored value")
+	require.Equal(t, `{"X-Token":"keep-body"}`, after.WebhookRequestBody,
+		"empty submitted webhook body must preserve stored value")
 }
 
 func TestUpdateDDNS_NonEmptySecretOverwrites(t *testing.T) {
```

**File**: `cmd/dashboard/controller/ddns.go` (modified, +8/-2)
```diff
@@ -34,6 +34,8 @@ func listDDNS(c *gin.Context) ([]*model.DDNSProfile, error) {
 	// 不影响 singleton 内原始数据。
 	for _, p := range ddnsProfiles {
 		p.AccessSecret = ""
+		p.WebhookURL = ""
+		p.WebhookRequestBody = ""
 		p.WebhookHeaders = ""
 	}
 
@@ -144,10 +146,8 @@ func updateDDNS(c *gin.Context) (any, error) {
 	p.Provider = df.Provider
 	p.Domains = df.Domains
 	p.AccessID = df.AccessID
-	p.WebhookURL = df.WebhookURL
 	p.WebhookMethod = df.WebhookMethod
 	p.WebhookRequestType = df.WebhookRequestType
-	p.WebhookRequestBody = df.WebhookRequestBody
 
 	// 凭据在列表接口已脱敏，前端无法回填；空值视为"不修改"，保留旧值避免误清空。
 	if df.AccessSecret != "" {
@@ -156,6 +156,12 @@ func updateDDNS(c *gin.Context) (any, error) {
 	if df.WebhookHeaders != "" {
 		p.WebhookHeaders = df.WebhookHeaders
 	}
+	if df.WebhookURL != "" {
+		p.WebhookURL = df.WebhookURL
+	}
+	if df.WebhookRequestBody != "" {
+		p.WebhookRequestBody = df.WebhookRequestBody
+	}
 
 	for n, domain := range p.Domains {
 		// IDN to ASCII
```

**File**: `cmd/dashboard/controller/fm.go` (modified, +14/-0)
```diff
@@ -15,6 +15,19 @@ import (
 	"github.com/nezhahq/nezha/service/singleton"
 )
 
+// The official file-manager client uploads in 1 MiB WebSocket messages. Cap
+// each complete message at that protocol boundary so gorilla/websocket cannot
+// buffer an attacker-sized frame before the IO stream relay sees it.
+const fileManagerWebSocketInputLimit int64 = 1024 * 1024
+
+type websocketReadLimiter interface {
+	SetReadLimit(limit int64)
+}
+
+func limitFileManagerWebSocketInput(conn websocketReadLimiter) {
+	conn.SetReadLimit(fileManagerWebSocketInputLimit)
+}
+
 // Create FM session
 // @Summary Create FM session
 // @Description Create an "attached" FM. It is advised to only call this within a terminal session.
@@ -99,6 +112,7 @@ func fmStream(c *gin.Context) (any, error) {
 	if err != nil {
 		return nil, newWsError("%v", err)
 	}
+	limitFileManagerWebSocketInput(wsConn)
 	conn := websocketx.NewConn(wsConn)
 	pingTransport := newWebsocketPingTransport(conn, wsConn.Close)
 	stopPing := startWebsocketPingTicker(c.Request.Context(), time.Second*10, pingTransport)
```

**File**: `cmd/dashboard/controller/mcp_test.go` (modified, +6/-1)
```diff
@@ -39,7 +39,12 @@ func setupMCPTest(t *testing.T) (func(), uint64) {
 	require.NoError(t, err)
 	require.NoError(t, db.AutoMigrate(&model.User{}, &model.APIToken{}, &model.MCPAuditLog{}, &model.Server{}, &model.WAF{}))
 	singleton.DB = db
-	singleton.Conf = &singleton.ConfigClass{Config: &model.Config{JWTTimeout: 1}}
+	singleton.Conf = &singleton.ConfigClass{Config: &model.Config{
+		JWTTimeout: 1,
+		ConfigDashboard: model.ConfigDashboard{
+			DashboardHost: "example.com",
+		},
+	}}
 	singleton.Conf.SetMCPEnabled(true)
 
 	user := model.User{Common: model.Common{ID: 100}, Username: "alice", Role: model.RoleMember}
```

**File**: `cmd/dashboard/controller/mcp_transfer.go` (modified, +38/-7)
```diff
@@ -13,6 +13,7 @@ import (
 	"io"
 	"math"
 	"net/http"
+	"net/url"
 	"strconv"
 	"strings"
 	"sync"
@@ -91,6 +92,37 @@ var (
 	transferSecretVal string
 )
 
+var errMCPTransferHostNotConfigured = errors.New("MCP transfer URL host is not an operator-declared dashboard host")
+
+// mcpTransferURLBase never reflects an untrusted request Host into a bearer
+// transfer URL. DashboardHost is the canonical public authority; deployments
+// that intentionally serve multiple names must declare them as reserved hosts.
+func mcpTransferURLBase(c *gin.Context) (string, error) {
+	if c == nil || c.Request == nil || singleton.Conf == nil {
+		return "", errMCPTransferHostNotConfigured
+	}
+
+	requestHost := strings.TrimSpace(c.Request.Host)
+	host := strings.TrimSpace(singleton.Conf.DashboardHost)
+	if host == "" {
+		if !singleton.IsReservedDashboardHost(requestHost) {
+			return "", errMCPTransferHostNotConfigured
+		}
+		host = requestHost
+	}
+
+	parsed, err := url.Parse("//" + host)
+	if err != nil || parsed.Host == "" || parsed.Host != host || parsed.User != nil || parsed.Path != "" || parsed.RawQuery != "" || parsed.Fragment != "" {
+		return "", errMCPTransferHostNotConfigured
+	}
+
+	scheme := "https"
+	if c.Request.TLS == nil && c.Request.Header.Get("X-Forwarded-Proto") != "https" {
+		scheme = "http"
+	}
+	return scheme + "://" + host, nil
+}
+
 // transferHMACSecret 返回进程内随机生成的 HMAC key。
 // 这是有意设计：transferEntries 本身也只活在内存 sync.Map 里，dashboard
 // 重启等价于全部 token 失效；让 secret 也随进程随机，可以避免“secret 来自
@@ -315,6 +347,10 @@ func mintTransferTool(c *gin.Context, serverID uint64, path string, ttlSeconds i
 	if err := validateTransferPath(path); err != nil {
 		return nil, err
 	}
+	baseURL, err := mcpTransferURLBase(c)
+	if err != nil {
+		return nil, err
+	}
 	ttl := time.Duration(ttlSeconds) * time.Second
 	if ttl <= 0 {
 		ttl = transferTokenTTLDefault
@@ -348,14 +384,9 @@ func mintTransferTool(c *gin.Context, serverID uint64, path string, ttlSeconds i
 	if err != nil {
 		return nil, err
 	}
-	scheme := "https"
-	if c.Request.TLS == nil && c.Request.Header.Get("X-Forwarded-Proto") != "https" {
-		scheme = "http"
-	}
-	host := c.Request.Host
-	url := fmt.Sprintf("%s://%s/mcp/%s/%s", scheme, host, dir, t)
+	transferURL := fmt.Sprintf("%s/mcp/%s/%s", baseURL, dir, t)
 	return map[string]any{
-		"url":        url,
+		"url":        transferURL,
 		"method":     map[transferDirection]string{transferDirDownload: "GET", transferDirUpload: "POST"}[dir],
 		"expires_at": entry.ExpiresAt,
 	}, nil
```

**File**: `cmd/dashboard/controller/mcp_transfer_host_test.go` (added, +80/-0)
```diff
@@ -0,0 +1,80 @@
+package controller
+
+import (
+	"net/http"
+	"testing"
+
+	"github.com/stretchr/testify/require"
+
+	"github.com/nezhahq/nezha/model"
+	"github.com/nezhahq/nezha/service/singleton"
+)
+
+func TestMCPTransferURLPinsUntrustedRequestHostToDashboardHost(t *testing.T) {
+	cleanup, uid := setupMCPTest(t)
+	defer cleanup()
+	PurgeTransferEntries()
+	t.Cleanup(func() { PurgeTransferEntries() })
+	tok, _ := mkToken(t, uid, []string{model.ScopeServerRead}, nil)
+
+	c, _ := mcpCallCtx(t, tok, uid, nil)
+	c.Request.Host = "attacker.example"
+	c.Request.Header.Set("X-Forwarded-Proto", "https")
+
+	out, err := mintTransferTool(c, 7, "/srv/file", 60, transferDirDownload, transferEntry{})
+	require.NoError(t, err)
+	result := out.(map[string]any)
+	require.Contains(t, result["url"], "https://example.com/mcp/download/")
+	require.NotContains(t, result["url"], "attacker.example")
+}
+
+func TestMCPTransferURLRejectsUntrustedHostWithoutCanonicalHost(t *testing.T) {
+	cleanup, uid := setupMCPTest(t)
+	defer cleanup()
+	PurgeTransferEntries()
+	t.Cleanup(func() { PurgeTransferEntries() })
+	tok, _ := mkToken(t, uid, []string{model.ScopeServerRead}, nil)
+	singleton.Conf.DashboardHost = ""
+	singleton.Conf.InstallHost = ""
+	singleton.Conf.ListenHost = ""
+	singleton.Conf.ReservedHosts = ""
+
+	c, _ := mcpCallCtx(t, tok, uid, nil)
+	c.Request = c.Request.Clone(c.Request.Context())
+	c.Request.Method = http.MethodPost
+	c.Request.Host = "attacker.example"
+
+	_, err := mintTransferTool(c, 7, "/srv/file", 60, transferDirDownload, transferEntry{})
+	require.ErrorIs(t, err, errMCPTransferHostNotConfigured)
+	entries := 0
+	transferEntries.Range(func(_, _ any) bool {
+		entries++
+		return true
+	})
+	require.Zero(t, entries, "host validation must happen before a bearer transfer token is minted")
+}
+
+func TestMCPTransferURLAllowsOperatorReservedHost(t *testing.T) {
+	cleanup, _ := setupMCPTest(t)
+	defer cleanup()
+	singleton.Conf.DashboardHost = ""
+	singleton.Conf.ReservedHosts = "mcp.example.com"
+
+	c, _ := mcpCallCtx(t, nil, 0, nil)
+	c.Request.Host = "mcp.example.com"
+	c.Request.Header.Set("X-Forwarded-Proto", "https")
+
+	base, err := mcpTransferURLBase(c)
+	require.NoError(t, err)
+	require.Equal(t, "https://mcp.example.com", base)
+}
+
+func TestMCPTransferURLRejectsMalformedConfiguredHost(t *testing.T) {
+	cleanup, _ := setupMCPTest(t)
+	defer cleanup()
+	singleton.Conf.DashboardHost = "https://example.com/path"
+
+	c, _ := mcpCallCtx(t, nil, 0, nil)
+	_, err := mcpTransferURLBase(c)
+	require.ErrorIs(t, err, errMCPTransferHostNotConfigured)
+}
```

**File**: `cmd/dashboard/controller/server.go` (modified, +12/-13)
```diff
@@ -236,10 +236,9 @@ func getServerConfig(c *gin.Context) (string, error) {
 	}
 
 	s, ok := singleton.ServerShared.Get(id)
-	if !ok {
-		return "", nil
-	}
-	if !s.HasPermission(c) {
+	// Foreign and unknown IDs deliberately share one response so sequential
+	// server IDs cannot be enumerated across tenants.
+	if !ok || !s.HasPermission(c) || !patAllowsServer(c, id) {
 		return "", singleton.Localizer.ErrorT("permission denied")
 	}
 	if s.GetTaskStream() == nil {
@@ -293,16 +292,16 @@ func setServerConfig(c *gin.Context) (*model.ServerTaskResponse, error) {
 	slist := singleton.ServerShared.GetList()
 	servers := make([]*model.Server, 0, len(configForm.Servers))
 	for _, sid := range configForm.Servers {
-		if s, ok := slist[sid]; ok {
-			if !s.HasPermission(c) {
-				return nil, singleton.Localizer.ErrorT("permission denied")
-			}
-			if s.GetTaskStream() == nil {
-				resp.Offline = append(resp.Offline, s.ID)
-				continue
-			}
-			servers = append(servers, s)
+		s, ok := slist[sid]
+		// Match getServerConfig: do not reveal whether a denied ID exists.
+		if !ok || !s.HasPermission(c) || !patAllowsServer(c, sid) {
+			return nil, singleton.Localizer.ErrorT("permission denied")
+		}
+		if s.GetTaskStream() == nil {
+			resp.Offline = append(resp.Offline, s.ID)
+			continue
 		}
+		servers = append(servers, s)
 	}
 
 	var wg sync.WaitGroup
```

**File**: `cmd/dashboard/controller/server_config_oracle_test.go` (added, +54/-0)
```diff
@@ -0,0 +1,54 @@
+package controller
+
+import (
+	"net/http"
+	"testing"
+
+	"github.com/gin-gonic/gin"
+	"github.com/stretchr/testify/require"
+
+	"github.com/nezhahq/nezha/model"
+	"github.com/nezhahq/nezha/service/singleton"
+)
+
+func TestGetServerConfigForeignAndUnknownIDsAreIndistinguishable(t *testing.T) {
+	cleanup, _ := setupMCPTest(t)
+	defer cleanup()
+	require.NoError(t, singleton.DB.Create(&model.User{Common: model.Common{ID: 200}, Username: "bob", Role: model.RoleMember}).Error)
+	tok, _ := mkToken(t, 200, []string{model.ScopeServerRead}, nil)
+
+	probe := func(id string) error {
+		c, _ := patRequestCtx(t, tok, 200, http.MethodGet, "/api/v1/server/config/"+id, nil)
+		c.Params = gin.Params{{Key: "id", Value: id}}
+		_, err := getServerConfig(c)
+		return err
+	}
+
+	foreignErr := probe("7")
+	unknownErr := probe("999999")
+	require.Error(t, foreignErr)
+	require.Error(t, unknownErr)
+	require.Equal(t, foreignErr.Error(), unknownErr.Error())
+}
+
+func TestSetServerConfigForeignAndUnknownIDsAreIndistinguishable(t *testing.T) {
+	cleanup, _ := setupMCPTest(t)
+	defer cleanup()
+	require.NoError(t, singleton.DB.Create(&model.User{Common: model.Common{ID: 200}, Username: "bob", Role: model.RoleMember}).Error)
+	tok, _ := mkToken(t, 200, []string{model.ScopeServerWrite}, nil)
+
+	probe := func(id uint64) error {
+		c, _ := patRequestCtx(t, tok, 200, http.MethodPost, "/api/v1/server/config", model.ServerConfigForm{
+			Servers: []uint64{id},
+			Config:  "{}",
+		})
+		_, err := setServerConfig(c)
+		return err
+	}
+
+	foreignErr := probe(7)
+	unknownErr := probe(999999)
+	require.Error(t, foreignErr)
+	require.Error(t, unknownErr)
+	require.Equal(t, foreignErr.Error(), unknownErr.Error())
+}
```

---

### Incident Patch 7: `9dab6a50` (2026-09-19)
**Commit Message**: fix: harden notification cache synchronization

**File**: `cmd/dashboard/controller/notification.go` (modified, +6/-0)
```diff
@@ -1,6 +1,7 @@
 package controller
 
 import (
+	"net/http"
 	"slices"
 	"strconv"
 
@@ -12,6 +13,8 @@ import (
 	"github.com/nezhahq/nezha/service/singleton"
 )
 
+const notificationBatchDeleteMaxBodyBytes = 1 << 20
+
 // List notification
 // @Summary List notification
 // @Security BearerAuth
@@ -174,6 +177,9 @@ func updateNotification(c *gin.Context) (any, error) {
 // @Router /batch-delete/notification [post]
 func batchDeleteNotification(c *gin.Context) (any, error) {
 	var n []uint64
+	if c.Request != nil && c.Request.Body != nil {
+		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, notificationBatchDeleteMaxBodyBytes)
+	}
 	if err := c.ShouldBindJSON(&n); err != nil {
 		return nil, err
 	}
```

**File**: `cmd/dashboard/controller/notification_body_limit_test.go` (added, +25/-0)
```diff
@@ -0,0 +1,25 @@
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
+)
+
+func TestBatchDeleteNotificationCapsRequestBody(t *testing.T) {
+	body := append(bytes.Repeat([]byte{' '}, notificationBatchDeleteMaxBodyBytes+1), '[', ']')
+	req := httptest.NewRequest(http.MethodPost, "/api/v1/batch-delete/notification", bytes.NewReader(body))
+	req.Header.Set("Content-Type", "application/json")
+	w := httptest.NewRecorder()
+	c, _ := gin.CreateTestContext(w)
+	c.Request = req
+
+	_, err := batchDeleteNotification(c)
+	if err == nil || !strings.Contains(err.Error(), "request body too large") {
+		t.Fatalf("oversized request body was not rejected by MaxBytesReader: %v", err)
+	}
+}
```

**File**: `service/singleton/notification.go` (modified, +67/-54)
```diff
@@ -81,92 +81,99 @@ func NewNotificationClass() *NotificationClass {
 }
 
 func (c *NotificationClass) Update(n *model.Notification) {
-	c.listMu.Lock()
+	func() {
+		c.listMu.Lock()
+		defer c.listMu.Unlock()
 
-	_, ok := c.list[n.ID]
-	c.list[n.ID] = n
+		_, ok := c.list[n.ID]
+		c.list[n.ID] = n
+		if !ok {
+			return
+		}
 
-	if ok {
-		if gids, ok := c.idToGroupList[n.ID]; ok {
-			for gid := range gids {
-				c.groupToIDList[gid][n.ID] = n
+		gids := c.idToGroupList[n.ID]
+		for gid := range gids {
+			group, exists := c.groupToIDList[gid]
+			if !exists {
+				delete(gids, gid)
+				continue
 			}
+			group[n.ID] = n
 		}
-	}
-
-	c.listMu.Unlock()
+		if len(gids) == 0 {
+			delete(c.idToGroupList, n.ID)
+		}
+	}()
 	c.sortList()
 }
 
 func (c *NotificationClass) UpdateGroup(ng *model.NotificationGroup, ngn []uint64) {
 	c.groupMu.Lock()
 	defer c.groupMu.Unlock()
 
-	_, ok := c.groupList[ng.ID]
 	c.groupList[ng.ID] = ng.Name
 
 	c.listMu.Lock()
 	defer c.listMu.Unlock()
-	if !ok {
-		c.groupToIDList[ng.ID] = make(map[uint64]*model.Notification, len(ngn))
-		for _, n := range ngn {
-			if c.idToGroupList[n] == nil {
-				c.idToGroupList[n] = make(map[uint64]struct{})
-			}
-			c.idToGroupList[n][ng.ID] = struct{}{}
-			c.groupToIDList[ng.ID][n] = c.list[n]
+
+	oldList := c.groupToIDList[ng.ID]
+	newList := make(map[uint64]*model.Notification, len(ngn))
+	for _, nid := range ngn {
+		n, ok := c.list[nid]
+		if !ok {
+			continue
 		}
-	} else {
-		oldList := make(map[uint64]struct{})
-		for nid := range c.groupToIDList[ng.ID] {
-			oldList[nid] = struct{}{}
+		newList[nid] = n
+		if c.idToGroupList[nid] == nil {
+			c.idToGroupList[nid] = make(map[uint64]struct{})
 		}
+		c.idToGroupList[nid][ng.ID] = struct{}{}
+	}
 
-		c.groupToIDList[ng.ID] = make(map[uint64]*model.Notification)
-		for _, nid := range ngn {
-			c.groupToIDList[ng.ID][nid] = c.list[nid]
-			if c.idToGroupList[nid] == nil {
-				c.idToGroupList[nid] = make(map[uint64]struct{})
-			}
-			c.idToGroupList[nid][ng.ID] = struct{}{}
+	for oldID := range oldList {
+		if _, ok := newList[oldID]; ok {
+			continue
 		}
-
-		for oldID := range oldList {
-			if _, ok := c.groupToIDList[ng.ID][oldID]; !ok {
-				delete(c.groupToIDList[oldID], ng.ID)
-				if len(c.idToGroupList[oldID]) == 0 {
-					delete(c.idToGroupList, oldID)
-				}
-			}
+		delete(c.idToGroupList[oldID], ng.ID)
+		if len(c.idToGroupList[oldID]) == 0 {
+			delete(c.idToGroupList, oldID)
 		}
 	}
+	c.groupToIDList[ng.ID] = newList
 }
 
 func (c *NotificationClass) Delete(idList []uint64) {
-	c.listMu.Lock()
-
-	for _, id := range idList {
-		delete(c.list, id)
-		// 如果绑定了通知组才删除
-		if gids, ok := c.idToGroupList[id]; ok {
-			for gid := range gids {
-				delete(c.groupToIDList[gid], id)
+	func() {
+		c.listMu.Lock()
+		defer c.listMu.Unlock()
+
+		for _, id := range idList {
+			delete(c.list, id)
+			// 如果绑定了通知组才删除
+			if gids, ok := c.idToGroupList[id]; ok {
+				for gid := range gids {
+					delete(c.groupToIDList[gid], id)
+				}
 				delete(c.idToGroupList, id)
 			}
 		}
-	}
-
-	c.listMu.Unlock()
+	}()
 	c.sortList()
 }
 
 func (c *NotificationClass) DeleteGroup(gids []uint64) {
-	c.listMu.Lock()
-	defer c.listMu.Unlock()
 	c.groupMu.Lock()
 	defer c.groupMu.Unlock()
+	c.listMu.Lock()
+	defer c.listMu.Unlock()
 
 	for _, gid := range gids {
+		for nid := range c.groupToIDList[gid] {
+			delete(c.idToGroupList[nid], gid)
+			if len(c.idToGroupList[nid]) == 0 {
+				delete(c.idToGroupList, nid)
+			}
+		}
 		delete(c.groupList, gid)
 		delete(c.groupToIDList, gid)
 	}
@@ -234,13 +241,19 @@ func (c *NotificationClass) SendNotification(notificationGroupID uint64, desc st
 			return
 		}
 	}
-	// 向该通知方式组的所有通知方式发出通知
+	// Copy the group under the lock. Webhook delivery can take minutes and must
+	// not block notification or notification-group updates while it is in flight.
 	c.listMu.RLock()
-	defer c.listMu.RUnlock()
+	notifications := make([]*model.Notification, 0, len(c.groupToIDList[notificationGroupID]))
 	for _, n := range c.groupToIDList[notificationGroupID] {
+		notifications = append(notifications, n)
+	}
+	c.listMu.RUnlock()
+
+	for _, n := range notifications {
 		log.Printf("NEZHA>> Try to notify %s", n.Name)
 	}
-	for _, n := range c.groupToIDList[notificationGroupID] {
+	for _, n := range notifications {
 		ns := model.NotificationServerBundle{
 			Notification: n,
 			Server:       nil,
```

**File**: `service/singleton/notification_test.go` (added, +126/-0)
```diff
@@ -0,0 +1,126 @@
+package singleton
+
+import (
+	"testing"
+	"time"
+
+	"github.com/nezhahq/nezha/model"
+)
+
+func newNotificationClassWithItems(items ...*model.Notification) *NotificationClass {
+	nc := NewEmptyNotificationClassForTest()
+	for _, item := range items {
+		nc.InsertForTest(item)
+	}
+	return nc
+}
+
+func TestNotificationClassDeleteGroupCleansReverseIndex(t *testing.T) {
+	n := &model.Notification{Common: model.Common{ID: 1, UserID: 2}, Name: "hook"}
+	nc := newNotificationClassWithItems(n)
+	group := &model.NotificationGroup{Common: model.Common{ID: 10, UserID: 2}, Name: "group"}
+	nc.UpdateGroup(group, []uint64{n.ID})
+
+	nc.DeleteGroup([]uint64{group.ID})
+
+	if _, ok := nc.groupToIDList[group.ID]; ok {
+		t.Fatalf("forward index still contains deleted group %d", group.ID)
+	}
+	if groups, ok := nc.idToGroupList[n.ID]; ok {
+		if _, stale := groups[group.ID]; stale {
+			t.Fatalf("reverse index for notification %d still contains deleted group %d", n.ID, group.ID)
+		}
+	}
+}
+
+func TestNotificationClassUpdateGroupCleansRemovedMembership(t *testing.T) {
+	first := &model.Notification{Common: model.Common{ID: 1, UserID: 2}, Name: "first"}
+	second := &model.Notification{Common: model.Common{ID: 2, UserID: 2}, Name: "second"}
+	nc := newNotificationClassWithItems(first, second)
+	group := &model.NotificationGroup{Common: model.Common{ID: 10, UserID: 2}, Name: "group"}
+	nc.UpdateGroup(group, []uint64{first.ID, second.ID})
+
+	nc.UpdateGroup(group, []uint64{second.ID})
+
+	if groups, ok := nc.idToGroupList[first.ID]; ok {
+		if _, stale := groups[group.ID]; stale {
+			t.Fatalf("reverse index for notification %d still contains group %d", first.ID, group.ID)
+		}
+	}
+	if _, ok := nc.idToGroupList[second.ID][group.ID]; !ok {
+		t.Fatalf("reverse index lost retained membership of notification %d in group %d", second.ID, group.ID)
+	}
+}
+
+func TestNotificationClassUpdateRepairsOrphanedReverseIndex(t *testing.T) {
+	n := &model.Notification{Common: model.Common{ID: 1, UserID: 2}, Name: "hook"}
+	nc := newNotificationClassWithItems(n)
+	nc.idToGroupList[n.ID] = map[uint64]struct{}{99: {}}
+
+	n.Name = "updated"
+	nc.Update(n)
+
+	if groups, ok := nc.idToGroupList[n.ID]; ok && len(groups) != 0 {
+		t.Fatalf("orphaned reverse memberships were not removed: %v", groups)
+	}
+}
+
+func TestNotificationClassGroupMutationsDoNotDeadlock(t *testing.T) {
+	nc := NewEmptyNotificationClassForTest()
+	nc.listMu.RLock()
+	readLockHeld := true
+	defer func() {
+		if readLockHeld {
+			nc.listMu.RUnlock()
+		}
+	}()
+
+	deleteDone := make(chan struct{})
+	go func() {
+		nc.DeleteGroup([]uint64{10})
+		close(deleteDone)
+	}()
+
+	deadline := time.Now().Add(2 * time.Second)
+	for nc.listMu.TryRLock() {
+		nc.listMu.RUnlock()
+		if time.Now().After(deadline) {
+			t.Fatal("DeleteGroup did not queue for listMu")
+		}
+		time.Sleep(time.Millisecond)
+	}
+
+	updateDone := make(chan struct{})
+	go func() {
+		nc.UpdateGroup(&model.NotificationGroup{
+			Common: model.Common{ID: 10, UserID: 2},
+			Name:   "group",
+		}, nil)
+		close(updateDone)
+	}()
+
+	deadline = time.Now().Add(2 * time.Second)
+	for nc.groupMu.TryLock() {
+		nc.groupMu.Unlock()
+		if time.Now().After(deadline) {
+			t.Fatal("neither group mutation acquired groupMu")
+		}
+		time.Sleep(time.Millisecond)
+	}
+
+	nc.listMu.RUnlock()
+	readLockHeld = false
+
+	timer := time.NewTimer(2 * time.Second)
+	defer timer.Stop()
+	for deleteDone != nil || updateDone != nil {
+		select {
+		case <-deleteDone:
+			deleteDone = nil
+		case <-updateDone:
+			updateDone = nil
+		case <-timer.C:
+			t.Fatal("concurrent UpdateGroup and DeleteGroup deadlocked")
+		}
+	}
+}
```

---

### Incident Patch 8: `06d38777` (2026-09-13)
**Commit Message**: fix(tsdb): survive low disk space

**File**: `pkg/tsdb/disk_guard_test.go` (added, +124/-0)
```diff
@@ -0,0 +1,124 @@
+package tsdb
+
+import (
+	"path/filepath"
+	"sync/atomic"
+	"testing"
+	"time"
+
+	"github.com/VictoriaMetrics/VictoriaMetrics/lib/storage"
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+)
+
+type testReadOnlyChecker struct {
+	value atomic.Bool
+}
+
+func (c *testReadOnlyChecker) IsReadOnly() bool {
+	return c.value.Load()
+}
+
+func newDiskGuardTestDB(t *testing.T) *TSDB {
+	t.Helper()
+	db, err := Open(&Config{
+		DataPath:           filepath.Join(t.TempDir(), "tsdb"),
+		RetentionDays:      1,
+		MinFreeDiskSpaceGB: 1,
+		DedupInterval:      time.Second,
+	})
+	require.NoError(t, err)
+	t.Cleanup(func() { require.NoError(t, db.Close()) })
+	return db
+}
+
+func bufferedRows(w *bufferedWriter) int {
+	w.mu.Lock()
+	defer w.mu.Unlock()
+	return len(w.buffer)
+}
+
+func TestReadOnlyStorageDropsWritesAndKeepsQueriesAvailable(t *testing.T) {
+	db := newDiskGuardTestDB(t)
+	checker := &testReadOnlyChecker{}
+	db.readOnly = checker
+	originalAddRows := db.addRowsFn
+	var addRowsCalls atomic.Int32
+	db.addRowsFn = func(rows []storage.MetricRow, precisionBits uint8) {
+		addRowsCalls.Add(1)
+		originalAddRows(rows, precisionBits)
+	}
+
+	firstTimestamp := time.Now().Add(-time.Minute)
+	require.NoError(t, db.WriteServerMetrics(&ServerMetrics{
+		ServerID:  1,
+		Timestamp: firstTimestamp,
+		CPU:       10,
+	}))
+	db.Flush()
+	require.Equal(t, int32(1), addRowsCalls.Load())
+
+	before, err := db.QueryServerMetrics(1, MetricServerCPU, Period1Day)
+	require.NoError(t, err)
+	require.NotEmpty(t, before)
+
+	checker.value.Store(true)
+	require.NoError(t, db.WriteServerMetrics(&ServerMetrics{
+		ServerID:  1,
+		Timestamp: firstTimestamp.Add(2 * time.Second),
+		CPU:       20,
+	}))
+	assert.True(t, db.WritesPaused())
+	assert.Zero(t, bufferedRows(db.writer), "read-only writes must not accumulate in memory")
+	assert.Equal(t, int32(1), addRowsCalls.Load(), "read-only samples must not reach VictoriaMetrics")
+
+	afterDrop, err := db.QueryServerMetrics(1, MetricServerCPU, Period1Day)
+	require.NoError(t, err)
+	assert.Equal(t, before, afterDrop, "read-only mode must preserve existing query access")
+
+	checker.value.Store(false)
+	require.NoError(t, db.WriteServerMetrics(&ServerMetrics{
+		ServerID:  1,
+		Timestamp: firstTimestamp.Add(4 * time.Second),
+		CPU:       30,
+	}))
+	db.Flush()
+	assert.False(t, db.WritesPaused())
+	assert.Equal(t, int32(2), addRowsCalls.Load(), "writes must resume after storage leaves read-only mode")
+}
+
+func TestDiskFullAddRowsPanicPausesWrites(t *testing.T) {
+	db := newDiskGuardTestDB(t)
+	db.addRowsFn = func([]storage.MetricRow, uint8) {
+		panic("write data: no space left on device")
+	}
+
+	require.NoError(t, db.WriteServerMetrics(&ServerMetrics{
+		ServerID:  1,
+		Timestamp: time.Now(),
+		CPU:       10,
+	}))
+	assert.NotPanics(t, db.Flush)
+	assert.True(t, db.WritesPaused())
+
+	require.NoError(t, db.WriteServerMetrics(&ServerMetrics{
+		ServerID:  1,
+		Timestamp: time.Now().Add(time.Second),
+		CPU:       20,
+	}))
+	assert.Zero(t, bufferedRows(db.writer))
+}
+
+func TestNonDiskStoragePanicIsNotHidden(t *testing.T) {
+	db := newDiskGuardTestDB(t)
+	db.addRowsFn = func([]storage.MetricRow, uint8) {
+		panic("storage invariant failed")
+	}
+
+	require.NoError(t, db.WriteServerMetrics(&ServerMetrics{
+		ServerID:  1,
+		Timestamp: time.Now(),
+		CPU:       10,
+	}))
+	assert.PanicsWithValue(t, "storage invariant failed", db.Flush)
+}
```

**File**: `pkg/tsdb/maintenance.go` (modified, +4/-1)
```diff
@@ -10,8 +10,11 @@ func (db *TSDB) Maintenance() {
 	if db.closed {
 		return
 	}
+	if !db.acceptsWrites() {
+		return
+	}
 
 	log.Println("NEZHA>> TSDB starting maintenance (flush)...")
-	db.storage.DebugFlush()
+	db.debugFlushSafely()
 	log.Println("NEZHA>> TSDB maintenance completed")
 }
```

**File**: `pkg/tsdb/tsdb.go` (modified, +123/-5)
```diff
@@ -1,15 +1,26 @@
 package tsdb
 
 import (
+	"errors"
 	"fmt"
 	"log"
 	"path/filepath"
+	"strings"
 	"sync"
+	"sync/atomic"
 	"time"
 
 	"github.com/VictoriaMetrics/VictoriaMetrics/lib/storage"
 )
 
+// ErrDiskFull is returned when VictoriaMetrics cannot initialize because the
+// filesystem containing the TSDB has run out of space.
+var ErrDiskFull = errors.New("TSDB disk is full")
+
+type readOnlyChecker interface {
+	IsReadOnly() bool
+}
+
 // TSDB 封装 VictoriaMetrics 存储
 type TSDB struct {
 	storage *storage.Storage
@@ -18,6 +29,13 @@ type TSDB struct {
 	closed  bool
 
 	writer *bufferedWriter
+
+	readOnly     readOnlyChecker
+	addRowsFn    func([]storage.MetricRow, uint8)
+	debugFlushFn func()
+
+	readOnlyObserved atomic.Bool
+	diskFullPaused   atomic.Bool
 }
 
 // InitGlobalSettings 初始化 VictoriaMetrics 包级别的全局设置。
@@ -35,7 +53,18 @@ func InitGlobalSettings(config *Config) {
 }
 
 // Open 打开或创建 TSDB 存储
-func Open(config *Config) (*TSDB, error) {
+func Open(config *Config) (db *TSDB, err error) {
+	defer func() {
+		if recovered := recover(); recovered != nil {
+			if diskErr := diskFullPanicError(recovered); diskErr != nil {
+				db = nil
+				err = diskErr
+				return
+			}
+			panic(recovered)
+		}
+	}()
+
 	if config == nil {
 		config = DefaultConfig()
 	}
@@ -59,9 +88,12 @@ func Open(config *Config) (*TSDB, error) {
 
 	stor := storage.MustOpenStorage(dataPath, opts)
 
-	db := &TSDB{
-		storage: stor,
-		config:  config,
+	db = &TSDB{
+		storage:      stor,
+		config:       config,
+		readOnly:     stor,
+		addRowsFn:    stor.AddRows,
+		debugFlushFn: stor.DebugFlush,
 	}
 
 	db.writer = newBufferedWriter(db, config.WriteBufferSize, config.WriteBufferFlushInterval)
@@ -72,6 +104,86 @@ func Open(config *Config) (*TSDB, error) {
 	return db, nil
 }
 
+func diskFullPanicError(recovered any) error {
+	message := strings.ToLower(fmt.Sprint(recovered))
+	for _, marker := range []string{
+		"no space left on device",
+		"disk quota exceeded",
+		"not enough space on the disk",
+	} {
+		if strings.Contains(message, marker) {
+			return fmt.Errorf("%w: %v", ErrDiskFull, recovered)
+		}
+	}
+	return nil
+}
+
+// WritesPaused reports whether new samples are currently being discarded.
+// Queries remain available while VictoriaMetrics is in read-only mode.
+func (db *TSDB) WritesPaused() bool {
+	if db.diskFullPaused.Load() {
+		return true
+	}
+	return db.readOnly != nil && db.readOnly.IsReadOnly()
+}
+
+func (db *TSDB) acceptsWrites() bool {
+	if db.diskFullPaused.Load() {
+		return false
+	}
+
+	readOnly := db.readOnly != nil && db.readOnly.IsReadOnly()
+	if readOnly {
+		if db.readOnlyObserved.CompareAndSwap(false, true) {
+			log.Println("NEZHA>> TSDB writes paused because free disk space is below the configured limit; dashboard, queries, and alerts remain available")
+		}
+		return false
+	}
+
+	if db.readOnlyObserved.CompareAndSwap(true, false) {
+		log.Println("NEZHA>> TSDB writes resumed after free disk space recovered")
+	}
+	return true
+}
+
+func (db *TSDB) pauseWritesAfterDiskFull(recovered any) {
+	if db.diskFullPaused.CompareAndSwap(false, true) {
+		log.Printf("NEZHA>> TSDB disk is full; disabling TSDB writes until dashboard restart while keeping dashboard, queries, and alerts running: %v", recovered)
+	}
+}
+
+func (db *TSDB) addRowsSafely(rows []storage.MetricRow) {
+	if len(rows) == 0 || !db.acceptsWrites() {
+		return
+	}
+
+	defer func() {
+		if recovered := recover(); recovered != nil {
+			if diskFullPanicError(recovered) == nil {
+				panic(recovered)
+			}
+			db.pauseWritesAfterDiskFull(recovered)
+		}
+	}()
+	db.addRowsFn(rows, 64)
+}
+
+func (db *TSDB) debugFlushSafely() {
+	if !db.acceptsWrites() {
+		return
+	}
+
+	defer func() {
+		if recovered := recover(); recovered != nil {
+			if diskFullPanicError(recovered) == nil {
+				panic(recovered)
+			}
+			db.pauseWritesAfterDiskFull(recovered)
+		}
+	}()
+	db.debugFlushFn()
+}
+
 // Close 关闭 TSDB 存储
 func (db *TSDB) Close() error {
 	db.mu.Lock()
@@ -110,8 +222,14 @@ func (db *TSDB) IsClosed() bool {
 
 // Flush 强制刷盘（主要用于测试）
 func (db *TSDB) Flush() {
+	db.mu.RLock()
+	defer db.mu.RUnlock()
+	if db.closed {
+		return
+	}
+
 	if db.writer != nil {
 		db.writer.flush()
 	}
-	db.storage.DebugFlush()
+	db.debugFlushSafely()
 }
```

**File**: `pkg/tsdb/writer.go` (modified, +17/-6)
```diff
@@ -47,18 +47,29 @@ func (w *bufferedWriter) flushLoop() {
 }
 
 func (w *bufferedWriter) write(rows []storage.MetricRow) {
+	if !w.db.acceptsWrites() {
+		w.discard()
+		return
+	}
+
 	w.mu.Lock()
 	w.buffer = append(w.buffer, rows...)
 	if len(w.buffer) >= w.maxSize {
 		rows := w.buffer
 		w.buffer = make([]storage.MetricRow, 0, w.maxSize)
 		w.mu.Unlock()
-		w.db.storage.AddRows(rows, 64)
+		w.db.addRowsSafely(rows)
 		return
 	}
 	w.mu.Unlock()
 }
 
+func (w *bufferedWriter) discard() {
+	w.mu.Lock()
+	w.buffer = make([]storage.MetricRow, 0, w.maxSize)
+	w.mu.Unlock()
+}
+
 func (w *bufferedWriter) flush() {
 	w.mu.Lock()
 	if len(w.buffer) == 0 {
@@ -69,7 +80,7 @@ func (w *bufferedWriter) flush() {
 	w.buffer = make([]storage.MetricRow, 0, w.maxSize)
 	w.mu.Unlock()
 
-	w.db.storage.AddRows(rows, 64)
+	w.db.addRowsSafely(rows)
 }
 
 func (w *bufferedWriter) stop() {
@@ -171,7 +182,7 @@ func (db *TSDB) WriteServerMetrics(m *ServerMetrics) error {
 	if db.writer != nil {
 		db.writer.write(rows)
 	} else {
-		db.storage.AddRows(rows, 64)
+		db.addRowsSafely(rows)
 	}
 	return nil
 }
@@ -200,7 +211,7 @@ func (db *TSDB) WriteServiceMetrics(m *ServiceMetrics) error {
 	if db.writer != nil {
 		db.writer.write(rows)
 	} else {
-		db.storage.AddRows(rows, 64)
+		db.addRowsSafely(rows)
 	}
 	return nil
 }
@@ -265,7 +276,7 @@ func (db *TSDB) WriteBatchServerMetrics(metrics []*ServerMetrics) error {
 	if db.writer != nil {
 		db.writer.write(rows)
 	} else {
-		db.storage.AddRows(rows, 64)
+		db.addRowsSafely(rows)
 	}
 	return nil
 }
@@ -295,7 +306,7 @@ func (db *TSDB) WriteBatchServiceMetrics(metrics []*ServiceMetrics) error {
 	if db.writer != nil {
 		db.writer.write(rows)
 	} else {
-		db.storage.AddRows(rows, 64)
+		db.addRowsSafely(rows)
 	}
 	return nil
 }
```

**File**: `service/singleton/tsdb.go` (modified, +15/-2)
```diff
@@ -1,6 +1,7 @@
 package singleton
 
 import (
+	"errors"
 	"log"
 	"time"
 
@@ -10,6 +11,8 @@ import (
 
 var TSDBShared *tsdb.TSDB
 
+var openTSDB = tsdb.Open
+
 func InitTSDB() error {
 	config := &tsdb.Config{
 		RetentionDays:      30,
@@ -44,11 +47,21 @@ func InitTSDB() error {
 		return nil
 	}
 
-	var err error
-	TSDBShared, err = tsdb.Open(config)
+	TSDBShared = nil
+	db, err := openTSDB(config)
 	if err != nil {
+		if errors.Is(err, tsdb.ErrDiskFull) {
+			log.Printf("NEZHA>> Warning: TSDB is unavailable because its disk is full; dashboard and alerts will continue without TSDB writes: %v", err)
+			if DB != nil {
+				if migrateErr := DB.AutoMigrate(model.ServiceHistory{}); migrateErr != nil {
+					log.Printf("NEZHA>> Warning: failed to prepare SQLite service history fallback: %v", migrateErr)
+				}
+			}
+			return nil
+		}
 		return err
 	}
+	TSDBShared = db
 
 	log.Println("NEZHA>> TSDB initialized successfully")
 
```

**File**: `service/singleton/tsdb_disk_guard_test.go` (added, +58/-0)
```diff
@@ -0,0 +1,58 @@
+package singleton
+
+import (
+	"fmt"
+	"testing"
+
+	"github.com/stretchr/testify/require"
+
+	"github.com/nezhahq/nezha/model"
+	"github.com/nezhahq/nezha/pkg/tsdb"
+)
+
+func TestInitTSDBContinuesWhenDiskIsFull(t *testing.T) {
+	originalConf := Conf
+	originalDB := DB
+	originalShared := TSDBShared
+	originalOpen := openTSDB
+	t.Cleanup(func() {
+		Conf = originalConf
+		DB = originalDB
+		TSDBShared = originalShared
+		openTSDB = originalOpen
+	})
+
+	Conf = &ConfigClass{Config: &model.Config{
+		TSDB: model.TSDBConf{DataPath: "/full/tsdb"},
+	}}
+	DB = nil
+	TSDBShared = nil
+	openTSDB = func(*tsdb.Config) (*tsdb.TSDB, error) {
+		return nil, fmt.Errorf("open failed: %w", tsdb.ErrDiskFull)
+	}
+
+	require.NoError(t, InitTSDB())
+	require.Nil(t, TSDBShared)
+}
+
+func TestInitTSDBStillReturnsNonDiskErrors(t *testing.T) {
+	originalConf := Conf
+	originalShared := TSDBShared
+	originalOpen := openTSDB
+	t.Cleanup(func() {
+		Conf = originalConf
+		TSDBShared = originalShared
+		openTSDB = originalOpen
+	})
+
+	Conf = &ConfigClass{Config: &model.Config{
+		TSDB: model.TSDBConf{DataPath: "/broken/tsdb"},
+	}}
+	TSDBShared = nil
+	openTSDB = func(*tsdb.Config) (*tsdb.TSDB, error) {
+		return nil, fmt.Errorf("permission denied")
+	}
+
+	require.ErrorContains(t, InitTSDB(), "permission denied")
+	require.Nil(t, TSDBShared)
+}
```

---

### Incident Patch 9: `f3666777` (2026-09-12)
**Commit Message**: feat: surface GPU memory in host state (#1235)

- Add State_GPU message to the proto with utilization and memory fields
- Add HostState.GPUs with conversion in both PB() and PB2State()
- Keep the existing gpu field populated so older agents keep working

Regenerated with protoc-gen-go v1.34.2 / protoc v5.29.3 to match the
existing files; nezha_grpc.pb.go is untouched since the service is
unchanged.

Closes #1217

**File**: `model/host.go` (modified, +30/-0)
```diff
@@ -35,9 +35,28 @@ type HostState struct {
 	ProcessCount   uint64              `json:"process_count,omitempty"`
 	Temperatures   []SensorTemperature `json:"temperatures,omitempty"`
 	GPU            []float64           `json:"gpu,omitempty"`
+	GPUs           []GPUStat           `json:"gpus,omitempty"`
+}
+
+// GPUStat carries per-card figures, index-aligned with Host.GPU. Memory is in
+// MiB and stays zero for vendors that do not report it, so MemoryTotal == 0
+// means "unknown" rather than "no memory".
+type GPUStat struct {
+	Utilization float64 `json:"utilization"`
+	MemoryUsed  uint64  `json:"memory_used,omitempty"`
+	MemoryTotal uint64  `json:"memory_total,omitempty"`
 }
 
 func (s *HostState) PB() *pb.State {
+	gs := make([]*pb.State_GPU, 0, len(s.GPUs))
+	for _, g := range s.GPUs {
+		gs = append(gs, &pb.State_GPU{
+			Utilization: g.Utilization,
+			MemoryUsed:  g.MemoryUsed,
+			MemoryTotal: g.MemoryTotal,
+		})
+	}
+
 	var ts []*pb.State_SensorTemperature
 	for _, t := range s.Temperatures {
 		ts = append(ts, &pb.State_SensorTemperature{
@@ -64,10 +83,20 @@ func (s *HostState) PB() *pb.State {
 		ProcessCount:   s.ProcessCount,
 		Temperatures:   ts,
 		Gpu:            s.GPU,
+		Gpus:           gs,
 	}
 }
 
 func PB2State(s *pb.State) HostState {
+	var gs []GPUStat
+	for _, g := range s.GetGpus() {
+		gs = append(gs, GPUStat{
+			Utilization: g.GetUtilization(),
+			MemoryUsed:  g.GetMemoryUsed(),
+			MemoryTotal: g.GetMemoryTotal(),
+		})
+	}
+
 	var ts []SensorTemperature
 	for _, t := range s.GetTemperatures() {
 		ts = append(ts, SensorTemperature{
@@ -93,6 +122,7 @@ func PB2State(s *pb.State) HostState {
 		UdpConnCount:   s.GetUdpConnCount(),
 		ProcessCount:   s.GetProcessCount(),
 		Temperatures:   ts,
+		GPUs:           gs,
 		GPU:            s.GetGpu(),
 	}
 }
```

**File**: `proto/nezha.pb.go` (modified, +216/-119)
```diff
@@ -169,6 +169,7 @@ type State struct {
 	ProcessCount   uint64                     `protobuf:"varint,15,opt,name=process_count,json=processCount,proto3" json:"process_count,omitempty"`
 	Temperatures   []*State_SensorTemperature `protobuf:"bytes,16,rep,name=temperatures,proto3" json:"temperatures,omitempty"`
 	Gpu            []float64                  `protobuf:"fixed64,17,rep,packed,name=gpu,proto3" json:"gpu,omitempty"`
+	Gpus           []*State_GPU               `protobuf:"bytes,18,rep,name=gpus,proto3" json:"gpus,omitempty"`
 }
 
 func (x *State) Reset() {
@@ -322,6 +323,79 @@ func (x *State) GetGpu() []float64 {
 	return nil
 }
 
+func (x *State) GetGpus() []*State_GPU {
+	if x != nil {
+		return x.Gpus
+	}
+	return nil
+}
+
+// State_GPU carries per-card figures. Index-aligned with Host.gpu, matching
+// the existing `gpu` field it supersedes; that field stays populated so older
+// dashboards keep working.
+type State_GPU struct {
+	state         protoimpl.MessageState
+	sizeCache     protoimpl.SizeCache
+	unknownFields protoimpl.UnknownFields
+
+	Utilization float64 `protobuf:"fixed64,1,opt,name=utilization,proto3" json:"utilization,omitempty"`
+	MemoryUsed  uint64  `protobuf:"varint,2,opt,name=memory_used,json=memoryUsed,proto3" json:"memory_used,omitempty"`
+	MemoryTotal uint64  `protobuf:"varint,3,opt,name=memory_total,json=memoryTotal,proto3" json:"memory_total,omitempty"`
+}
+
+func (x *State_GPU) Reset() {
+	*x = State_GPU{}
+	if protoimpl.UnsafeEnabled {
+		mi := &file_proto_nezha_proto_msgTypes[2]
+		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
+		ms.StoreMessageInfo(mi)
+	}
+}
+
+func (x *State_GPU) String() string {
+	return protoimpl.X.MessageStringOf(x)
+}
+
+func (*State_GPU) ProtoMessage() {}
+
+func (x *State_GPU) ProtoReflect() protoreflect.Message {
+	mi := &file_proto_nezha_proto_msgTypes[2]
+	if protoimpl.UnsafeEnabled && x != nil {
+		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
+		if ms.LoadMessageInfo() == nil {
+			ms.StoreMessageInfo(mi)
+		}
+		return ms
+	}
+	return mi.MessageOf(x)
+}
+
+// Deprecated: Use State_GPU.ProtoReflect.Descriptor instead.
+func (*State_GPU) Descriptor() ([]byte, []int) {
+	return file_proto_nezha_proto_rawDescGZIP(), []int{2}
+}
+
+func (x *State_GPU) GetUtilization() float64 {
+	if x != nil {
+		return x.Utilization
+	}
+	return 0
+}
+
+func (x *State_GPU) GetMemoryUsed() uint64 {
+	if x != nil {
+		return x.MemoryUsed
+	}
+	return 0
+}
+
+func (x *State_GPU) GetMemoryTotal() uint64 {
+	if x != nil {
+		return x.MemoryTotal
+	}
+	return 0
+}
+
 type State_SensorTemperature struct {
 	state         protoimpl.MessageState
 	sizeCache     protoimpl.SizeCache
@@ -334,7 +408,7 @@ type State_SensorTemperature struct {
 func (x *State_SensorTemperature) Reset() {
 	*x = State_SensorTemperature{}
 	if protoimpl.UnsafeEnabled {
-		mi := &file_proto_nezha_proto_msgTypes[2]
+		mi := &file_proto_nezha_proto_msgTypes[3]
 		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
 		ms.StoreMessageInfo(mi)
 	}
@@ -347,7 +421,7 @@ func (x *State_SensorTemperature) String() string {
 func (*State_SensorTemperature) ProtoMessage() {}
 
 func (x *State_SensorTemperature) ProtoReflect() protoreflect.Message {
-	mi := &file_proto_nezha_proto_msgTypes[2]
+	mi := &file_proto_nezha_proto_msgTypes[3]
 	if protoimpl.UnsafeEnabled && x != nil {
 		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
 		if ms.LoadMessageInfo() == nil {
@@ -360,7 +434,7 @@ func (x *State_SensorTemperature) ProtoReflect() protoreflect.Message {
 
 // Deprecated: Use State_SensorTemperature.ProtoReflect.Descriptor instead.
 func (*State_SensorTemperature) Descriptor() ([]byte, []int) {
-	return file_proto_nezha_proto_rawDescGZIP(), []int{2}
+	return file_proto_nezha_proto_rawDescGZIP(), []int{3}
 }
 
 func (x *State_SensorTemperature) GetName() string {
@@ -390,7 +464,7 @@ type Task struct {
 func (x *Task) Reset() {
 	*x = Task{}
 	if protoimpl.UnsafeEnabled {
-		mi := &file_proto_nezha_proto_msgTypes[3]
+		mi := &file_proto_nezha_proto_msgTypes[4]
 		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
 		ms.StoreMessageInfo(mi)
 	}
@@ -403,7 +477,7 @@ func (x *Task) String() string {
 func (*Task) ProtoMessage() {}
 
 func (x *Task) ProtoReflect() protoreflect.Message {
-	mi := &file_proto_nezha_proto_msgTypes[3]
+	mi := &file_proto_nezha_proto_msgTypes[4]
 	if protoimpl.UnsafeEnabled && x != nil {
 		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
 		if ms.LoadMessageInfo() == nil {
@@ -416,7 +490,7 @@ func (x *Task) ProtoReflect() protoreflect.Message {
 
 // Deprecated: Use Task.ProtoReflect.Descriptor instead.
 func (*Task) Descriptor() ([]byte, []int) {
-	return file_proto_nezha_proto_rawDescGZIP(), []int{3}
+	return file_proto_nezha_proto_rawDescGZIP(), []int{4}
 }
 
 func (x *Task) GetId() uint64 {
@@ -455,7 +529,7 @@ type TaskResult struct {
 func (x *TaskResult) Reset() {
 	*x = TaskResult{}
 	if protoimpl.UnsafeEnabled {
-		mi := &file_proto_nezha_pr
```

**File**: `proto/nezha.proto` (modified, +10/-0)
```diff
@@ -44,6 +44,16 @@ message State {
   uint64 process_count = 15;
   repeated State_SensorTemperature temperatures = 16;
   repeated double gpu = 17;
+  repeated State_GPU gpus = 18;
+}
+
+// State_GPU carries per-card figures. Index-aligned with Host.gpu, matching
+// the existing `gpu` field it supersedes; that field stays populated so older
+// dashboards keep working.
+message State_GPU {
+  double utilization = 1;
+  uint64 memory_used = 2;
+  uint64 memory_total = 3;
 }
 
 message State_SensorTemperature {
```

---

### Incident Patch 10: `19daf4ad` (2026-09-02)
**Commit Message**: fix(alert): prevent persisted rule crash loops

**File**: `cmd/dashboard/controller/alertrule.go` (modified, +12/-0)
```diff
@@ -172,6 +172,12 @@ func validateRule(c *gin.Context, r *model.AlertRule) error {
 	}
 	if len(r.Rules) > 0 {
 		for _, rule := range r.Rules {
+			if rule == nil {
+				return singleton.Localizer.ErrorT("rule is not set")
+			}
+			if !rule.IsSupportedType() {
+				return singleton.Localizer.ErrorT("unsupported rule type")
+			}
 			switch rule.Cover {
 			case model.RuleCoverAll, model.RuleCoverIgnoreAll:
 			default:
@@ -182,10 +188,16 @@ func validateRule(c *gin.Context, r *model.AlertRule) error {
 				if rule.Duration < 3 {
 					return singleton.Localizer.ErrorT("duration need to be at least 3")
 				}
+				if rule.Duration > model.MaxAlertRuleDuration {
+					return singleton.Localizer.ErrorT("duration is too large")
+				}
 			} else {
 				if rule.CycleInterval < 1 {
 					return singleton.Localizer.ErrorT("cycle_interval need to be at least 1")
 				}
+				if rule.CycleInterval > model.MaxAlertRuleCycleInterval {
+					return singleton.Localizer.ErrorT("cycle_interval is too large")
+				}
 				if rule.CycleStart == nil {
 					return singleton.Localizer.ErrorT("cycle_start is not set")
 				}
```

**File**: `cmd/dashboard/controller/alertrule_security_test.go` (added, +67/-0)
```diff
@@ -0,0 +1,67 @@
+package controller
+
+import (
+	"math"
+	"testing"
+	"time"
+
+	"github.com/stretchr/testify/require"
+
+	"github.com/nezhahq/nezha/model"
+)
+
+func TestValidateRuleRejectsCrashPayloadsFromMember(t *testing.T) {
+	ctx := newMemberValidationContext(t)
+	cycleStart := time.Now().Add(-time.Hour)
+	tests := []struct {
+		name string
+		rule *model.Rule
+	}{
+		{
+			name: "unknown rule type",
+			rule: &model.Rule{Type: "attacker_controlled", Duration: 3, Cover: model.RuleCoverAll},
+		},
+		{
+			name: "duration overflows int",
+			rule: &model.Rule{Type: "offline", Duration: math.MaxUint64, Cover: model.RuleCoverAll},
+		},
+		{
+			name: "cycle interval overflows int",
+			rule: &model.Rule{
+				Type:          "transfer_in_cycle",
+				CycleStart:    &cycleStart,
+				CycleInterval: math.MaxUint64,
+				Cover:         model.RuleCoverAll,
+			},
+		},
+		{
+			name: "nil rule",
+			rule: nil,
+		},
+	}
+
+	for _, test := range tests {
+		t.Run(test.name, func(t *testing.T) {
+			alert := &model.AlertRule{
+				Common: model.Common{UserID: 200},
+				Name:   "security regression",
+				Rules:  []*model.Rule{test.rule},
+			}
+			require.Error(t, validateRule(ctx, alert))
+		})
+	}
+}
+
+func TestValidateRuleAcceptsSafeDurationBoundary(t *testing.T) {
+	ctx := newMemberValidationContext(t)
+	alert := &model.AlertRule{
+		Common: model.Common{UserID: 200},
+		Name:   "duration boundary",
+		Rules: []*model.Rule{{
+			Type:     "offline",
+			Duration: model.MaxAlertRuleDuration,
+			Cover:    model.RuleCoverAll,
+		}},
+	}
+	require.NoError(t, validateRule(ctx, alert))
+}
```

**File**: `model/alertrule.go` (modified, +66/-13)
```diff
@@ -64,6 +64,36 @@ func (r *AlertRule) Enabled() bool {
 	return r.Enable != nil && *r.Enable
 }
 
+// IsSafeToEvaluate validates persisted rule data before it reaches the alert
+// goroutine. API validation protects new writes; this second boundary protects
+// upgrades from malformed or deliberately poisoned rows already in the DB.
+func (r *AlertRule) IsSafeToEvaluate() bool {
+	if r == nil || len(r.Rules) == 0 {
+		return false
+	}
+	for _, rule := range r.Rules {
+		if rule == nil || !rule.IsSupportedType() {
+			return false
+		}
+		switch rule.Cover {
+		case RuleCoverAll, RuleCoverIgnoreAll:
+		default:
+			return false
+		}
+		if rule.IsTransferDurationRule() {
+			if !rule.HasSafeCycleConfiguration() {
+				return false
+			}
+			continue
+		}
+		duration, ok := rule.DurationInt()
+		if !ok || duration < 3 {
+			return false
+		}
+	}
+	return true
+}
+
 // HasPermission extends the default owner/admin check with PAT
 // server_ids whitelist enforcement. AlertRule.Snapshot fans out across
 // every owner-visible server filtered only by Rule.Ignore semantics
@@ -125,6 +155,12 @@ func (r *AlertRule) Snapshot(cycleTransferStats *CycleTransferStats, server *Ser
 	point := make([]bool, len(r.Rules))
 
 	for i, rule := range r.Rules {
+		if rule == nil || !rule.IsSupportedType() {
+			// Invalid persisted rules are ignored instead of being interpreted as
+			// a failed condition or allowed to panic the sentinel.
+			point[i] = true
+			continue
+		}
 		point[i] = rule.Snapshot(cycleTransferStats, server, db)
 	}
 	return point
@@ -134,10 +170,14 @@ func (r *AlertRule) Snapshot(cycleTransferStats *CycleTransferStats, server *Ser
 func (r *AlertRule) Check(points [][]bool) (int, bool) {
 	var hasPassedRule bool
 	durations := make([]int, len(r.Rules))
+	validRules := 0
 
 	for ruleIndex, rule := range r.Rules {
-		duration := int(rule.Duration)
+		if rule == nil || !rule.IsSupportedType() {
+			continue
+		}
 		if rule.IsTransferDurationRule() {
+			validRules++
 			// 循环区间流量报警
 			if durations[ruleIndex] < 1 {
 				durations[ruleIndex] = 1
@@ -146,18 +186,29 @@ func (r *AlertRule) Check(points [][]bool) (int, bool) {
 				continue
 			}
 			// 只要最后一次检查超出了规则范围 就认为检查未通过
-			if len(points) > 0 && points[len(points)-1][ruleIndex] {
-				hasPassedRule = true
+			if len(points) > 0 {
+				lastPoint := points[len(points)-1]
+				if ruleIndex >= len(lastPoint) || lastPoint[ruleIndex] {
+					hasPassedRule = true
+				}
 			}
-		} else if rule.IsOfflineRule() {
+			continue
+		}
+
+		duration, ok := rule.DurationInt()
+		if !ok || duration <= 0 {
+			continue
+		}
+		validRules++
+		if rule.IsOfflineRule() {
 			// 离线报警，检查直到最后一次在线的离线采样点是否大于 duration
 			if hasPassedRule = boundCheck(len(points), duration, hasPassedRule); hasPassedRule {
 				continue
 			}
 			var fail int
 			for _, point := range slices.Backward(points[len(points)-duration:]) {
 				fail++
-				if point[ruleIndex] {
+				if ruleIndex >= len(point) || point[ruleIndex] {
 					hasPassedRule = true
 					break
 				}
@@ -168,11 +219,7 @@ func (r *AlertRule) Check(points [][]bool) (int, bool) {
 			// 常规报警
 			// duration<=0 是无意义的规则（持续 0 秒）：直接跳过该规则，
 			// 既不污染 hasPassedRule（否则会连带跳过同一 alert 里其它有效
-			// 规则），也避免下方 fail*100/total 在 total=0 时整数除零 panic
-			// —— checkStatus 无 recover，一次 panic 会拖垮整个告警 goroutine。
-			if duration <= 0 {
-				continue
-			}
+			// 规则），也避免下方百分比计算在 total=0 时除零。
 			if hasPassedRule = boundCheck(len(points), duration, hasPassedRule); hasPassedRule {
 				continue
 			}
@@ -181,17 +228,20 @@ func (r *AlertRule) Check(points [][]bool) (int, bool) {
 			}
 			total, fail := duration, 0
 			for timeTick := len(points) - duration; timeTick < len(points); timeTick++ {
-				if !points[timeTick][ruleIndex] {
+				if ruleIndex >= len(points[timeTick]) || !points[timeTick][ruleIndex] {
 					fail++
 				}
 			}
 			// 当70%以上的采样点未通过规则判断时 才认为当前检查未通过
-			if fail*100/total <= 70 {
+			if float64(fail)*100/float64(total) <= 70 {
 				hasPassedRule = true
 			}
 		}
 	}
 
+	if validRules == 0 {
+		return 0, true
+	}
 	// 仅当所有检查均未通过时 才触发告警
 	return slices.Max(durations), hasPassedRule
 }
@@ -205,10 +255,13 @@ func (r *AlertRule) Check(points [][]bool) (int, bool) {
 func (r *AlertRule) RetentionWindow() int {
 	window := 0
 	for _, rule := range r.Rules {
+		if rule == nil || !rule.IsSupportedType() {
+			continue
+		}
 		var need int
 		if rule.IsTransferDurationRule() {
 			need = 1
-		} else if d := int(rule.Duration); d > 0 {
+		} else if d, ok := rule.DurationInt(); ok && d > 0 {
 			need = d
 		}
 		if need > window {
```

**File**: `model/alertrule_security_test.go` (added, +123/-0)
```diff
@@ -0,0 +1,123 @@
+package model
+
+import (
+	"math"
+	"testing"
+	"time"
+)
+
+func TestRuleSnapshotIgnoresEmptyMetricSamples(t *testing.T) {
+	tests := []struct {
+		name      string
+		ruleType  string
+		hostState *HostState
+	}{
+		{
+			name:      "GPU list is empty",
+			ruleType:  "gpu_max",
+			hostState: &HostState{},
+		},
+		{
+			name:     "all temperature samples are filtered",
+			ruleType: "temperature_max",
+			hostState: &HostState{Temperatures: []SensorTemperature{
+				{Name: "coretemp", Temperature: 0},
+			}},
+		},
+	}
+
+	for _, test := range tests {
+		t.Run(test.name, func(t *testing.T) {
+			server := &Server{Common: Common{ID: 1}, State: test.hostState, Host: &Host{}}
+			rule := &Rule{Type: test.ruleType, Max: 1, Duration: 3, Cover: RuleCoverAll}
+
+			defer func() {
+				if recovered := recover(); recovered != nil {
+					t.Fatalf("Snapshot panicked for missing metric data: %v", recovered)
+				}
+			}()
+			if passed := rule.Snapshot(nil, server, nil); !passed {
+				t.Fatal("missing metric data must be ignored instead of treated as a failed threshold")
+			}
+		})
+	}
+}
+
+func TestAlertRuleCheckRejectsOverflowingPersistedDuration(t *testing.T) {
+	rule := &AlertRule{Rules: []*Rule{{
+		Type:     "offline",
+		Duration: math.MaxUint64,
+		Cover:    RuleCoverAll,
+	}}}
+
+	defer func() {
+		if recovered := recover(); recovered != nil {
+			t.Fatalf("Check panicked after uint64-to-int overflow: %v", recovered)
+		}
+	}()
+	duration, passed := rule.Check([][]bool{{false}})
+	if duration != 0 || !passed {
+		t.Fatalf("invalid persisted duration must be ignored safely, got duration=%d passed=%v", duration, passed)
+	}
+	if window := rule.RetentionWindow(); window != 0 {
+		t.Fatalf("invalid persisted duration must not create a retention window, got %d", window)
+	}
+}
+
+func TestAlertRulePersistedDataSafety(t *testing.T) {
+	cycleStart := time.Now().Add(-time.Hour)
+	tests := []struct {
+		name string
+		rule *AlertRule
+		want bool
+	}{
+		{
+			name: "normal rule",
+			rule: &AlertRule{Rules: []*Rule{{
+				Type: "cpu", Duration: 3, Cover: RuleCoverAll,
+			}}},
+			want: true,
+		},
+		{
+			name: "normal cycle rule",
+			rule: &AlertRule{Rules: []*Rule{{
+				Type: "transfer_in_cycle", CycleStart: &cycleStart, CycleInterval: 1, Cover: RuleCoverAll,
+			}}},
+			want: true,
+		},
+		{
+			name: "unknown type",
+			rule: &AlertRule{Rules: []*Rule{{
+				Type: "attacker_controlled", Duration: 3, Cover: RuleCoverAll,
+			}}},
+		},
+		{
+			name: "overflowing duration",
+			rule: &AlertRule{Rules: []*Rule{{
+				Type: "offline", Duration: math.MaxUint64, Cover: RuleCoverAll,
+			}}},
+		},
+		{
+			name: "cycle without start",
+			rule: &AlertRule{Rules: []*Rule{{
+				Type: "transfer_in_cycle", CycleInterval: 1, Cover: RuleCoverAll,
+			}}},
+		},
+		{
+			name: "nil rule",
+			rule: &AlertRule{Rules: []*Rule{nil}},
+		},
+		{
+			name: "empty rule list",
+			rule: &AlertRule{},
+		},
+	}
+
+	for _, test := range tests {
+		t.Run(test.name, func(t *testing.T) {
+			if got := test.rule.IsSafeToEvaluate(); got != test.want {
+				t.Fatalf("IsSafeToEvaluate()=%v, want %v", got, test.want)
+			}
+		})
+	}
+}
```

**File**: `model/alertrule_test.go` (modified, +16/-4)
```diff
@@ -26,7 +26,7 @@ func testCycleRules(t *testing.T) {
 			rule: &AlertRule{
 				Rules: []*Rule{
 					{
-						Type: "_cycle",
+						Type: "transfer_in_cycle",
 					},
 				},
 			},
@@ -39,7 +39,7 @@ func testCycleRules(t *testing.T) {
 			rule: &AlertRule{
 				Rules: []*Rule{
 					{
-						Type: "_cycle",
+						Type: "transfer_in_cycle",
 					},
 				},
 			},
@@ -130,6 +130,7 @@ func testGeneralRules(t *testing.T) {
 			rule: &AlertRule{
 				Rules: []*Rule{
 					{
+						Type:     "cpu",
 						Duration: 10,
 					},
 				},
@@ -143,6 +144,7 @@ func testGeneralRules(t *testing.T) {
 			rule: &AlertRule{
 				Rules: []*Rule{
 					{
+						Type:     "cpu",
 						Duration: 10,
 					},
 				},
@@ -156,6 +158,7 @@ func testGeneralRules(t *testing.T) {
 			rule: &AlertRule{
 				Rules: []*Rule{
 					{
+						Type:     "cpu",
 						Duration: 10,
 					},
 				},
@@ -169,6 +172,7 @@ func testGeneralRules(t *testing.T) {
 			rule: &AlertRule{
 				Rules: []*Rule{
 					{
+						Type:     "cpu",
 						Duration: 10,
 					},
 				},
@@ -182,6 +186,7 @@ func testGeneralRules(t *testing.T) {
 			rule: &AlertRule{
 				Rules: []*Rule{
 					{
+						Type:     "cpu",
 						Duration: 10,
 					},
 				},
@@ -210,6 +215,7 @@ func testCombinedRules(t *testing.T) {
 						Duration: 10,
 					},
 					{
+						Type:     "cpu",
 						Duration: 10,
 					},
 				},
@@ -227,6 +233,7 @@ func testCombinedRules(t *testing.T) {
 						Duration: 10,
 					},
 					{
+						Type:     "cpu",
 						Duration: 10,
 					},
 				},
@@ -240,6 +247,7 @@ func testCombinedRules(t *testing.T) {
 			rule: &AlertRule{
 				Rules: []*Rule{
 					{
+						Type:     "cpu",
 						Duration: 10,
 					},
 					{
@@ -257,9 +265,11 @@ func testCombinedRules(t *testing.T) {
 			rule: &AlertRule{
 				Rules: []*Rule{
 					{
+						Type:     "cpu",
 						Duration: 10,
 					},
 					{
+						Type:     "memory",
 						Duration: 30,
 					},
 				},
@@ -273,9 +283,11 @@ func testCombinedRules(t *testing.T) {
 			rule: &AlertRule{
 				Rules: []*Rule{
 					{
+						Type:     "cpu",
 						Duration: 10,
 					},
 					{
+						Type:     "memory",
 						Duration: 30,
 					},
 				},
@@ -416,7 +428,7 @@ func TestAlertRule_RetentionWindow(t *testing.T) {
 		{"zero duration only", &AlertRule{Rules: []*Rule{{Type: "cpu", Duration: 0}}}, 0},
 		{"mixed picks max", &AlertRule{Rules: []*Rule{{Type: "cpu", Duration: 0}, {Type: "cpu", Duration: 7}}}, 7},
 		{"offline keeps Duration", &AlertRule{Rules: []*Rule{{Type: "offline", Duration: 30}}}, 30},
-		{"cycle looks back one", &AlertRule{Rules: []*Rule{{Type: "net_in_speed_cycle"}}}, 1},
+		{"cycle looks back one", &AlertRule{Rules: []*Rule{{Type: "transfer_in_cycle"}}}, 1},
 	}
 	for _, c := range cases {
 		if got := c.rule.RetentionWindow(); got != c.want {
@@ -469,7 +481,7 @@ func TestAlertRule_CombinedRuleAccumulatesSamples(t *testing.T) {
 	}{
 		{"general3+general10", &AlertRule{Rules: []*Rule{{Type: "cpu", Duration: 3}, {Type: "memory", Duration: 10}}}, []bool{false, false}, 9, 10},
 		{"offline5+general10", &AlertRule{Rules: []*Rule{{Type: "offline", Duration: 5}, {Type: "cpu", Duration: 10}}}, []bool{false, false}, 9, 10},
-		{"transfer+general8", &AlertRule{Rules: []*Rule{{Type: "net_in_speed_cycle"}, {Type: "cpu", Duration: 8}}}, []bool{false, false}, 7, 8},
+		{"transfer+general8", &AlertRule{Rules: []*Rule{{Type: "transfer_in_cycle"}, {Type: "cpu", Duration: 8}}}, []bool{false, false}, 7, 8},
 		{"offline3+offline12", &AlertRule{Rules: []*Rule{{Type: "offline", Duration: 3}, {Type: "offline", Duration: 12}}}, []bool{false, false}, 11, 12},
 	}
 	for _, c := range cases {
```

**File**: `model/rule.go` (modified, +79/-10)
```diff
@@ -15,12 +15,23 @@ const (
 	RuleCoverIgnoreAll
 )
 
+// MaxAlertRuleDuration is the largest duration that can be converted to int
+// on every architecture supported by Go. Alert rules are persisted as uint64,
+// but their sampling windows use int indexes; keeping the public bound at
+// MaxInt32 prevents a crafted value from wrapping during that conversion.
+const MaxAlertRuleDuration uint64 = 1<<31 - 1
+
+// MaxAlertRuleCycleInterval also leaves room for the largest integer
+// multiplication performed by the calendar helpers (weeks become 7*interval)
+// on 32-bit targets.
+const MaxAlertRuleCycleInterval uint64 = (1<<31 - 1) / 7
+
 type NResult struct {
 	N uint64
 }
 
 type Rule struct {
-	// 指标类型，cpu、memory、swap、disk、net_in_speed、net_out_speed
+	// 指标类型，cpu、gpu/gpu_max、memory、swap、disk、net_in_speed、net_out_speed
 	// net_all_speed、transfer_in、transfer_out、transfer_all、offline
 	// transfer_in_cycle、transfer_out_cycle、transfer_all_cycle
 	Type          string          `json:"type"`
@@ -45,8 +56,52 @@ func percentage(used, total uint64) float64 {
 	return float64(used) * 100 / float64(total)
 }
 
+// IsSupportedType reports whether the rule type has an evaluator. Keep this
+// list in lockstep with Snapshot's switch so untrusted strings cannot enter the
+// persisted alert pipeline and silently acquire fallback semantics.
+func (u *Rule) IsSupportedType() bool {
+	if u == nil {
+		return false
+	}
+	switch u.Type {
+	case "cpu", "gpu", "gpu_max", "memory", "swap", "disk",
+		"net_in_speed", "net_out_speed", "net_all_speed",
+		"transfer_in", "transfer_out", "transfer_all", "offline",
+		"transfer_in_cycle", "transfer_out_cycle", "transfer_all_cycle",
+		"load1", "load5", "load15", "tcp_conn_count", "udp_conn_count",
+		"process_count", "temperature_max":
+		return true
+	default:
+		return false
+	}
+}
+
+// DurationInt converts the persisted duration without allowing uint64-to-int
+// truncation. Callers must handle ok=false as an invalid rule.
+func (u *Rule) DurationInt() (duration int, ok bool) {
+	if u == nil || u.Duration > MaxAlertRuleDuration {
+		return 0, false
+	}
+	return int(u.Duration), true
+}
+
+// HasSafeCycleConfiguration guards every value that the cycle evaluator later
+// converts or dereferences. It intentionally does not reject an empty unit,
+// which is the documented legacy spelling for hours.
+func (u *Rule) HasSafeCycleConfiguration() bool {
+	return u != nil && u.IsTransferDurationRule() && u.CycleStart != nil &&
+		u.CycleInterval > 0 && u.CycleInterval <= MaxAlertRuleCycleInterval
+}
+
 // Snapshot 未通过规则返回 false, 通过返回 true
 func (u *Rule) Snapshot(cycleTransferStats *CycleTransferStats, server *Server, db *gorm.DB) bool {
+	if u == nil || server == nil || !u.IsSupportedType() {
+		return true
+	}
+	if u.IsTransferDurationRule() && (!u.HasSafeCycleConfiguration() || cycleTransferStats == nil) {
+		return true
+	}
+
 	// 监控全部但是排除了此服务器
 	if u.Cover == RuleCoverAll && u.Ignore[server.ID] {
 		return true
@@ -71,7 +126,10 @@ func (u *Rule) Snapshot(cycleTransferStats *CycleTransferStats, server *Server,
 	switch u.Type {
 	case "cpu":
 		src = float64(state.CPU)
-	case "gpu_max":
+	case "gpu", "gpu_max":
+		if len(state.GPU) == 0 {
+			return true
+		}
 		src = slices.Max(state.GPU)
 	case "memory":
 		if runtime.Host == nil {
@@ -141,14 +199,17 @@ func (u *Rule) Snapshot(cycleTransferStats *CycleTransferStats, server *Server,
 		src = float64(state.ProcessCount)
 	case "temperature_max":
 		var temp []float64
-		if state.Temperatures != nil {
-			for _, tempStat := range state.Temperatures {
-				if tempStat.Temperature != 0 {
-					temp = append(temp, tempStat.Temperature)
-				}
+		for _, tempStat := range state.Temperatures {
+			if tempStat.Temperature != 0 {
+				temp = append(temp, tempStat.Temperature)
 			}
-			src = slices.Max(temp)
 		}
+		if len(temp) == 0 {
+			return true
+		}
+		src = slices.Max(temp)
+	default:
+		return true
 	}
 
 	// 循环区间流量检测 · 更新下次需要检测时间
@@ -187,11 +248,19 @@ func (u *Rule) Snapshot(cycleTransferStats *CycleTransferStats, server *Server,
 
 // IsTransferDurationRule 判断该规则是否属于周期流量规则 属于则返回true
 func (u *Rule) IsTransferDurationRule() bool {
-	return strings.HasSuffix(u.Type, "_cycle")
+	if u == nil {
+		return false
+	}
+	switch u.Type {
+	case "transfer_in_cycle", "transfer_out_cycle", "transfer_all_cycle":
+		return true
+	default:
+		return false
+	}
 }
 
 func (u *Rule) IsOfflineRule() bool {
-	return u.Type == "offline"
+	return u != nil && u.Type == "offline"
 }
 
 // GetTransferDurationStart 获取周期流量的起始时间
```

**File**: `service/singleton/alertsentinel.go` (modified, +66/-44)
```diff
@@ -33,7 +33,7 @@ var (
 
 // addCycleTransferStatsInfo 向AlertsCycleTransferStatsStore中添加周期流量报警统计信息
 func addCycleTransferStatsInfo(alert *model.AlertRule) {
-	if !alert.Enabled() {
+	if alert == nil || !alert.Enabled() || !alert.IsSafeToEvaluate() {
 		return
 	}
 	for _, rule := range alert.Rules {
@@ -67,8 +67,16 @@ func AlertSentinelStart() {
 		panic(err)
 	}
 	for _, alert := range Alerts {
+		if alert == nil {
+			log.Printf("NEZHA>> Skipping invalid nil alert rule loaded from database")
+			continue
+		}
 		alertsStore[alert.ID] = make(map[uint64][][]bool)
 		alertsPrevState[alert.ID] = make(map[uint64]uint8)
+		if !alert.IsSafeToEvaluate() {
+			log.Printf("NEZHA>> Skipping invalid alert rule %d loaded from database", alert.ID)
+			continue
+		}
 		addCycleTransferStatsInfo(alert)
 	}
 	AlertsLock.Unlock()
@@ -136,7 +144,7 @@ func checkStatus() {
 
 	for _, alert := range Alerts {
 		// 跳过未启用
-		if !alert.Enabled() {
+		if alert == nil || !alert.Enabled() || !alert.IsSafeToEvaluate() {
 			continue
 		}
 		for _, server := range m {
@@ -152,48 +160,62 @@ func checkStatus() {
 			if alert.UserID != server.GetUserID() && !role.IsAdmin() {
 				continue
 			}
-			alertsStore[alert.ID][server.ID] = append(alertsStore[alert.
-				ID][server.ID], alert.Snapshot(AlertsCycleTransferStatsStore[alert.ID], server, DB))
-			// 发送通知，分为触发报警和恢复通知
-			_, passed := alert.Check(alertsStore[alert.ID][server.ID])
-			// 保存当前服务器状态信息
-			curServer := model.Server{}
-			copier.Copy(&curServer, server)
-
-			// 本次未通过检查
-			if !passed {
-				// 始终触发模式或上次检查不为失败时触发报警（跳过单次触发+上次失败的情况）
-				if alert.TriggerMode == model.ModeAlwaysTrigger || alertsPrevState[alert.ID][server.ID] != _RuleCheckFail {
-					alertsPrevState[alert.ID][server.ID] = _RuleCheckFail
-					message := fmt.Sprintf("[%s] %s(%s) %s", Localizer.T("Incident"),
-						server.Name, IPDesensitize(server.GeoIP.IP.Join()), alert.Name)
-					go CronShared.SendTriggerTasks(alert.FailTriggerTasks, curServer.ID, alert.UserID)
-					go NotificationShared.SendNotification(alert.NotificationGroupID, message, NotificationMuteLabel.ServerIncident(server.ID, alert.ID), &curServer)
-					// 清除恢复通知的静音缓存
-					NotificationShared.UnMuteNotification(alert.NotificationGroupID, NotificationMuteLabel.ServerIncidentResolved(server.ID, alert.ID))
-				}
-			} else {
-				// 本次通过检查但上一次的状态为失败，则发送恢复通知
-				if alertsPrevState[alert.ID][server.ID] == _RuleCheckFail {
-					message := fmt.Sprintf("[%s] %s(%s) %s", Localizer.T("Resolved"),
-						server.Name, IPDesensitize(server.GeoIP.IP.Join()), alert.Name)
-					go CronShared.SendTriggerTasks(alert.RecoverTriggerTasks, curServer.ID, alert.UserID)
-					go NotificationShared.SendNotification(alert.NotificationGroupID, message, NotificationMuteLabel.ServerIncidentResolved(server.ID, alert.ID), &curServer)
-					// 清除失败通知的静音缓存
-					NotificationShared.UnMuteNotification(alert.NotificationGroupID, NotificationMuteLabel.ServerIncident(server.ID, alert.ID))
-				}
-				alertsPrevState[alert.ID][server.ID] = _RuleCheckPass
-			}
-			// 清理旧数据：保留窗口由规则定义决定（各规则 Duration 的最大值），
-			// 而非 Check 的判定结果。window==0 表示没有任何有效规则需要回看历史
-			// （例如全部 Duration<=0），此时清空采样避免切片无限增长。
-			window := alert.RetentionWindow()
-			samples := alertsStore[alert.ID][server.ID]
-			if window <= 0 {
-				alertsStore[alert.ID][server.ID] = samples[:0]
-			} else if window < len(samples) {
-				alertsStore[alert.ID][server.ID] = samples[len(samples)-window:]
-			}
+			checkStatusForServer(alert, server)
+		}
+	}
+}
+
+// checkStatusForServer isolates each alert/server evaluation. Input validation
+// and model-level guards handle known malformed states; this recovery boundary
+// ensures an unexpected evaluator panic cannot terminate the dashboard process
+// or prevent unrelated servers from being checked on the same tick.
+func checkStatusForServer(alert *model.AlertRule, server *model.Server) {
+	defer func() {
+		if recovered := recover(); recovered != nil {
+			log.Printf("NEZHA>> Recovered panic evaluating alert rule %d for server %d: %v", alert.ID, server.ID, recovered)
+		}
+	}()
+
+	alertsStore[alert.ID][server.ID] = append(alertsStore[alert.
+		ID][server.ID], alert.Snapshot(AlertsCycleTransferStatsStore[alert.ID], server, DB))
+	// 发送通知，分为触发报警和恢复通知
+	_, passed := alert.Check(alertsStore[alert.ID][server.ID])
+	// 保存当前服务器状态信息
+	curServer := model.Server{}
+	copier.Copy(&curServer, server)
+
+	// 本次未通过检查
+	if !passed {
+		// 始终触发模式或上次检查不为失败时触发报警（跳过单次触发+上次失败的情况）
+		if alert.TriggerMode == model.ModeAlwaysTrigger || alertsPrevState[alert.ID][server.ID] != _RuleCheckFail {
+			alertsPrevState[alert.ID][server.ID] = _RuleCheckFail
+			message := fmt.Sprintf("[%s] %s(%s) %s", Localizer.T("Incident"),
+				server.Name, IPDesensitize(server.GeoIP.IP.Join()), alert.Name)
+			go CronShared.SendTriggerTasks(alert.FailTriggerTasks, curServer.ID, alert.UserID)
+			go NotificationShared.SendNotification(alert.NotificationGroupID, message, NotificationMuteLabel.ServerIncident(server.ID,
```

**File**: `service/singleton/alertsentinel_test.go` (modified, +50/-0)
```diff
@@ -117,3 +117,53 @@ func TestCheckStatus_SampleMemoryBounded(t *testing.T) {
 		t.Fatalf("sample capacity grew unbounded: peak cap %d exceeds 4x window %d", peakCap, duration*4)
 	}
 }
+
+func TestCheckStatusForServerRecoversUnexpectedEvaluatorPanic(t *testing.T) {
+	originalStore := alertsStore
+	originalPrevState := alertsPrevState
+	originalCycleStore := AlertsCycleTransferStatsStore
+	alertsStore = map[uint64]map[uint64][][]bool{}
+	alertsPrevState = map[uint64]map[uint64]uint8{}
+	AlertsCycleTransferStatsStore = map[uint64]*model.CycleTransferStats{}
+	t.Cleanup(func() {
+		alertsStore = originalStore
+		alertsPrevState = originalPrevState
+		AlertsCycleTransferStatsStore = originalCycleStore
+	})
+
+	enabled := true
+	alert := &model.AlertRule{
+		Common: model.Common{ID: 77, UserID: 2},
+		Enable: &enabled,
+		Rules:  []*model.Rule{{Type: "cpu", Duration: 3, Cover: model.RuleCoverAll}},
+	}
+	server := &model.Server{Common: model.Common{ID: 1, UserID: 2}}
+	model.InitServer(server)
+
+	// The deliberately missing alertsStore[alert.ID] map panics at assignment
+	// after evaluation. The per-alert/server recovery boundary must contain it.
+	checkStatusForServer(alert, server)
+}
+
+func TestAddCycleTransferStatsSkipsPoisonedPersistedRule(t *testing.T) {
+	original := AlertsCycleTransferStatsStore
+	AlertsCycleTransferStatsStore = map[uint64]*model.CycleTransferStats{}
+	t.Cleanup(func() { AlertsCycleTransferStatsStore = original })
+
+	enabled := true
+	alert := &model.AlertRule{
+		Common: model.Common{ID: 88},
+		Enable: &enabled,
+		Rules: []*model.Rule{{
+			Type:          "transfer_in_cycle",
+			CycleInterval: 1,
+			Cover:         model.RuleCoverAll,
+			// CycleStart intentionally nil, as it may be in a poisoned legacy DB row.
+		}},
+	}
+
+	addCycleTransferStatsInfo(alert)
+	if _, exists := AlertsCycleTransferStatsStore[alert.ID]; exists {
+		t.Fatal("invalid persisted cycle rule must not be scheduled")
+	}
+}
```

---

### Incident Patch 11: `38824dbc` (2026-08-15)
**Commit Message**: fix(security): restrict service monitors to probe tasks

**File**: `cmd/dashboard/controller/oauth2.go` (modified, +5/-2)
```diff
@@ -26,8 +26,11 @@ import (
 // code to their own origin and bind the victim's identity. A request Host is
 // trusted only when it is an operator-declared dashboard host (the same
 // allowlist that guards NAT routing). Otherwise the redirect is pinned to the
-// operator-declared DashboardHost; when DashboardHost is empty the operator has
-// not pinned a dashboard origin, so the request Host is passed through.
+// operator-declared DashboardHost. Empty DashboardHost intentionally retains
+// dynamic/multi-domain deployments by passing through request Host; those
+// deployments must validate Host at their trusted proxy and register exact
+// redirect URIs at the OAuth provider. GHSA-rf68-8gjr-36q7 documents this
+// configuration boundary and must be updated if this compatibility changes.
 func getRedirectURL(c *gin.Context) string {
 	scheme := "http://"
 	referer := c.Request.Referer()
```

**File**: `cmd/dashboard/controller/permission_matrix_test.go` (modified, +2/-2)
```diff
@@ -261,8 +261,8 @@ func TestShowServiceFiltersCycleTransferStatsLikeServerList(t *testing.T) {
 	assert.NoError(t, singleton.DB.Create(&model.Server{Common: model.Common{ID: 3, UserID: 200}, Name: "hidden member server", UUID: "hidden-member-server", HideForGuest: true}).Error)
 	singleton.ServerShared = singleton.NewServerClass()
 
-	assert.NoError(t, singleton.DB.Create(&model.Service{Common: model.Common{ID: 10, UserID: 1}, Name: "shown service"}).Error)
-	assert.NoError(t, singleton.DB.Create(&model.Service{Common: model.Common{ID: 11, UserID: 1}, Name: "hidden service", HideForGuest: true}).Error)
+	assert.NoError(t, singleton.DB.Create(&model.Service{Common: model.Common{ID: 10, UserID: 1}, Name: "shown service", Type: model.TaskTypeTCPPing}).Error)
+	assert.NoError(t, singleton.DB.Create(&model.Service{Common: model.Common{ID: 11, UserID: 1}, Name: "hidden service", Type: model.TaskTypeTCPPing, HideForGuest: true}).Error)
 
 	originalServiceSentinel := singleton.ServiceSentinelShared
 	serviceSentinel, err := singleton.NewServiceSentinel(make(chan *model.Service, 2))
```

**File**: `cmd/dashboard/controller/service.go` (modified, +6/-0)
```diff
@@ -484,6 +484,9 @@ func createService(c *gin.Context) (uint64, error) {
 	if err := c.ShouldBindJSON(&mf); err != nil {
 		return 0, err
 	}
+	if err := model.ValidateServiceMonitorType(uint64(mf.Type)); err != nil {
+		return 0, err
+	}
 
 	if !isValidServiceCover(mf.Cover) {
 		return 0, singleton.Localizer.ErrorT("permission denied")
@@ -548,6 +551,9 @@ func updateService(c *gin.Context) (any, error) {
 	if err := c.ShouldBindJSON(&mf); err != nil {
 		return nil, err
 	}
+	if err := model.ValidateServiceMonitorType(uint64(mf.Type)); err != nil {
+		return nil, err
+	}
 
 	if !isValidServiceCover(mf.Cover) {
 		return nil, singleton.Localizer.ErrorT("permission denied")
```

**File**: `cmd/dashboard/controller/service_type_security_test.go` (added, +91/-0)
```diff
@@ -0,0 +1,91 @@
+package controller
+
+import (
+	"bytes"
+	"encoding/json"
+	"fmt"
+	"net/http"
+	"net/http/httptest"
+	"testing"
+
+	"github.com/gin-gonic/gin"
+	"github.com/stretchr/testify/require"
+
+	"github.com/nezhahq/nezha/model"
+	"github.com/nezhahq/nezha/service/singleton"
+)
+
+func serviceTypeSecurityRouter() *gin.Engine {
+	gin.SetMode(gin.TestMode)
+	r := gin.New()
+	r.Use(func(c *gin.Context) {
+		setAuthUser(c, 100, model.RoleMember)
+		c.Next()
+	})
+	r.POST("/api/v1/service", commonHandler(createService))
+	r.PATCH("/api/v1/service/:id", commonHandler(updateService))
+	return r
+}
+
+func serviceTypeSecurityBody(taskType uint8) []byte {
+	body, _ := json.Marshal(model.ServiceForm{
+		Name:        "service-type-security",
+		Target:      "example.invalid:443",
+		Type:        taskType,
+		Cover:       model.ServiceCoverIgnoreAll,
+		SkipServers: map[uint64]bool{1: true},
+		Duration:    30,
+	})
+	return body
+}
+
+func TestCreateServiceRejectsNonProbeTaskTypes(t *testing.T) {
+	setupCoverPATFixture(t)
+	r := serviceTypeSecurityRouter()
+
+	for _, taskType := range []uint8{0, model.TaskTypeCommand, model.TaskTypeApplyConfig, model.TaskTypeExec, 255} {
+		w := httptest.NewRecorder()
+		req := httptest.NewRequest(http.MethodPost, "/api/v1/service", bytes.NewReader(serviceTypeSecurityBody(taskType)))
+		req.Header.Set("Content-Type", "application/json")
+		r.ServeHTTP(w, req)
+
+		success, errMsg := decodeCommonResponseError(t, w.Body.Bytes())
+		require.False(t, success, "type %d must be rejected", taskType)
+		require.Contains(t, errMsg, "invalid service monitor type")
+	}
+
+	var count int64
+	require.NoError(t, singleton.DB.Model(&model.Service{}).Count(&count).Error)
+	require.Zero(t, count, "rejected task types must not reach persistence")
+}
+
+func TestUpdateServiceRejectsNonProbeTaskTypes(t *testing.T) {
+	setupCoverPATFixture(t)
+	r := serviceTypeSecurityRouter()
+	service := &model.Service{
+		Common:      model.Common{UserID: 100},
+		Name:        "valid-service",
+		Target:      "example.invalid:443",
+		Type:        model.TaskTypeTCPPing,
+		Cover:       model.ServiceCoverIgnoreAll,
+		SkipServers: map[uint64]bool{1: true},
+		Duration:    30,
+	}
+	require.NoError(t, singleton.DB.Create(service).Error)
+
+	for _, taskType := range []uint8{model.TaskTypeCommand, model.TaskTypeApplyConfig, model.TaskTypeExec, 255} {
+		w := httptest.NewRecorder()
+		path := fmt.Sprintf("/api/v1/service/%d", service.ID)
+		req := httptest.NewRequest(http.MethodPatch, path, bytes.NewReader(serviceTypeSecurityBody(taskType)))
+		req.Header.Set("Content-Type", "application/json")
+		r.ServeHTTP(w, req)
+
+		success, errMsg := decodeCommonResponseError(t, w.Body.Bytes())
+		require.False(t, success, "type %d must be rejected", taskType)
+		require.Contains(t, errMsg, "invalid service monitor type")
+
+		var persisted model.Service
+		require.NoError(t, singleton.DB.First(&persisted, service.ID).Error)
+		require.Equal(t, uint8(model.TaskTypeTCPPing), persisted.Type)
+	}
+}
```

**File**: `cmd/dashboard/main.go` (modified, +6/-0)
```diff
@@ -46,6 +46,12 @@ func initSystem(bus chan<- *model.Service) error {
 	if err := singleton.DB.Model(&model.User{}).Count(&usersCount).Error; err != nil {
 		return err
 	}
+	// Backward-compatible bootstrap state: existing installers and recovery
+	// procedures expect the first login on an empty database to be admin/admin.
+	// This is not a permanent credential or an authentication-bypass fallback;
+	// operators must complete initialization and change it before exposing the
+	// Dashboard. Replacing it requires a coordinated installer/migration flow so
+	// existing unattended installations are not locked out.
 	if usersCount == 0 {
 		hash, err := bcrypt.GenerateFromPassword([]byte("admin"), bcrypt.DefaultCost)
 		if err != nil {
```

**File**: `cmd/dashboard/rpc/service_dispatch.go` (modified, +13/-2)
```diff
@@ -14,6 +14,17 @@ func DispatchTask(serviceSentinelDispatchBus <-chan *model.Service) {
 		if task == nil {
 			continue
 		}
+		if err := model.ValidateServiceMonitorType(uint64(task.Type)); err != nil {
+			// Defense in depth for stale database rows and future internal callers:
+			// Service.Type shares its integer namespace with command/config tasks.
+			log.Printf("NEZHA>> DispatchTask rejected service %d: %v", task.ID, err)
+			continue
+		}
+		probe := task.PB()
+		if probe == nil {
+			log.Printf("NEZHA>> DispatchTask rejected service %d: invalid probe", task.ID)
+			continue
+		}
 
 		switch task.Cover {
 		case model.ServiceCoverIgnoreAll:
@@ -29,7 +40,7 @@ func DispatchTask(serviceSentinelDispatchBus <-chan *model.Service) {
 				if !canSendTaskToServer(task, server) {
 					continue
 				}
-				if err := server.SendTask(task.PB()); err != nil && !errors.Is(err, model.ErrTaskStreamOffline) {
+				if err := server.SendTask(probe); err != nil && !errors.Is(err, model.ErrTaskStreamOffline) {
 					log.Printf("NEZHA>> DispatchTask send error (server=%d): %v", id, err)
 				}
 			}
@@ -41,7 +52,7 @@ func DispatchTask(serviceSentinelDispatchBus <-chan *model.Service) {
 				if !canSendTaskToServer(task, server) {
 					continue
 				}
-				if err := server.SendTask(task.PB()); err != nil && !errors.Is(err, model.ErrTaskStreamOffline) {
+				if err := server.SendTask(probe); err != nil && !errors.Is(err, model.ErrTaskStreamOffline) {
 					log.Printf("NEZHA>> DispatchTask send error (server=%d): %v", id, err)
 				}
 			}
```

**File**: `cmd/dashboard/rpc/service_dispatch_type_security_test.go` (added, +59/-0)
```diff
@@ -0,0 +1,59 @@
+package rpc
+
+import (
+	"testing"
+
+	"github.com/stretchr/testify/require"
+
+	"github.com/nezhahq/nezha/model"
+	"github.com/nezhahq/nezha/service/singleton"
+)
+
+func TestDispatchTaskSendsOnlyProbeTypes(t *testing.T) {
+	originalServerShared := singleton.ServerShared
+	originalUserInfo := singleton.UserInfoMap
+	t.Cleanup(func() {
+		singleton.ServerShared = originalServerShared
+		singleton.UserLock.Lock()
+		singleton.UserInfoMap = originalUserInfo
+		singleton.UserLock.Unlock()
+	})
+
+	server := &model.Server{Common: model.Common{ID: 1, UserID: 100}}
+	stream := &serveNATTaskStream{}
+	server.SetTaskStream(stream)
+	serverShared := singleton.NewEmptyServerClassForTest()
+	serverShared.InsertForTest(server)
+	singleton.ServerShared = serverShared
+	singleton.UserLock.Lock()
+	singleton.UserInfoMap = map[uint64]model.UserInfo{100: {Role: model.RoleMember}}
+	singleton.UserLock.Unlock()
+
+	bus := make(chan *model.Service, 8)
+	done := make(chan struct{})
+	go func() {
+		DispatchTask(bus)
+		close(done)
+	}()
+	for _, taskType := range []uint8{model.TaskTypeCommand, model.TaskTypeApplyConfig, model.TaskTypeExec, 255} {
+		bus <- &model.Service{
+			Common:      model.Common{ID: uint64(taskType), UserID: 100},
+			Type:        taskType,
+			Cover:       model.ServiceCoverIgnoreAll,
+			SkipServers: map[uint64]bool{1: true},
+		}
+	}
+	bus <- &model.Service{
+		Common:      model.Common{ID: 1000, UserID: 100},
+		Type:        model.TaskTypeTCPPing,
+		Target:      "example.invalid:443",
+		Cover:       model.ServiceCoverIgnoreAll,
+		SkipServers: map[uint64]bool{1: true},
+	}
+	close(bus)
+	<-done
+
+	require.Len(t, stream.sent, 1)
+	require.Equal(t, uint64(model.TaskTypeTCPPing), stream.sent[0].GetType())
+	require.Equal(t, uint64(1000), stream.sent[0].GetId())
+}
```

**File**: `model/config.go` (modified, +6/-1)
```diff
@@ -43,7 +43,12 @@ type ConfigForGuests struct {
 
 type ConfigDashboard struct {
 	InstallHost string `koanf:"install_host" json:"install_host,omitempty"`
-	AgentTLS    bool   `koanf:"tls" json:"tls,omitempty"` // 用于前端判断生成的安装命令是否启用 TLS
+	// AgentTLS controls the transport emitted by Agent installation commands.
+	// false intentionally supports trusted private networks and does not provide
+	// Dashboard peer authentication; Internet-facing control planes must use
+	// verified TLS. Changing this compatibility default belongs in the installer
+	// migration path, not in the gRPC task authorization model.
+	AgentTLS bool `koanf:"tls" json:"tls,omitempty"`
 
 	// DashboardHost 是 dashboard 对外访问的主机名，专用于 OAuth2 回调地址。
 	// 它与 InstallHost（agent 连接用主机名）解耦：两者可以是不同域名。
```

---

### Incident Patch 12: `c3c165c1` (2026-08-12)
**Commit Message**: fix(terminal): bound websocket input frames

**File**: `cmd/dashboard/controller/terminal.go` (modified, +6/-0)
```diff
@@ -14,6 +14,11 @@ import (
 	"github.com/nezhahq/nezha/service/singleton"
 )
 
+// Allow the frontend's 512 KiB clipboard payload plus xterm's bracketed-paste
+// control bytes, while keeping the complete tagged message below the 1 MiB
+// IO stream relay buffer.
+const terminalWebSocketInputLimit int64 = 512*1024 + 64
+
 // Create web ssh terminal
 // @Summary Create web ssh terminal
 // @Description Create web ssh terminal
@@ -100,6 +105,7 @@ func terminalStream(c *gin.Context) (any, error) {
 	if err != nil {
 		return nil, newWsError("%v", err)
 	}
+	wsConn.SetReadLimit(terminalWebSocketInputLimit)
 	conn := websocketx.NewConn(wsConn)
 	pingTransport := newWebsocketPingTransport(conn, wsConn.Close)
 	stopPing := startWebsocketPingTicker(c.Request.Context(), time.Second*10, pingTransport)
```

**File**: `cmd/dashboard/controller/terminal_input_limit_test.go` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+package controller
+
+import "testing"
+
+func TestTerminalWebSocketInputLimitAllowsBoundedPaste(t *testing.T) {
+	if terminalWebSocketInputLimit != 512*1024+64 {
+		t.Fatalf("terminal WebSocket input limit = %d, want 512 KiB plus control-byte allowance", terminalWebSocketInputLimit)
+	}
+}
```

**File**: `service/singleton/frontend-templates.yaml` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
   name: "OfficialAdmin"
   repository: "https://github.com/nezhahq/admin-frontend"
   author: "nezhahq"
-  version: "v2.3.2"
+  version: "v2.3.3"
   is_admin: true
   is_official: true
 - path: "user-dist"
```

---

### Incident Patch 13: `d1fcde8e` (2026-08-11)
**Commit Message**: fix(security): block IPv6 transition ranges for webhooks

**File**: `pkg/utils/http.go` (modified, +2/-0)
```diff
@@ -40,9 +40,11 @@ var blockedHTTPClientCIDRs = mustParseHTTPClientCIDRs([]string{
 	"::1/128",
 	"::ffff:0:0/96",
 	"64:ff9b::/96",
+	"64:ff9b:1::/48",
 	"100::/64",
 	"2001::/23",
 	"2001:db8::/32",
+	"2002::/16",
 	"fc00::/7",
 	"fe80::/10",
 	"ff00::/8",
```

**File**: `pkg/utils/http_test.go` (modified, +42/-0)
```diff
@@ -1,13 +1,55 @@
 package utils
 
 import (
+	"errors"
 	"net"
 	"net/http"
 	"net/url"
 	"testing"
 	"time"
 )
 
+func TestHTTPURLTargetIPAllowed(t *testing.T) {
+	tests := []struct {
+		name    string
+		address string
+		allowed bool
+	}{
+		{name: "public IPv4", address: "1.1.1.1", allowed: true},
+		{name: "public IPv6", address: "2606:4700:4700::1111", allowed: true},
+		{name: "well-known NAT64", address: "64:ff9b::a9fe:a9fe", allowed: false},
+		{name: "local-use NAT64", address: "64:ff9b:1::a9fe:a9fe", allowed: false},
+		{name: "6to4 public IPv4 embedding", address: "2002:0101:0101::1", allowed: false},
+		{name: "6to4 link-local IPv4 embedding", address: "2002:a9fe:a9fe::1", allowed: false},
+	}
+
+	for _, test := range tests {
+		t.Run(test.name, func(t *testing.T) {
+			ip := net.ParseIP(test.address)
+			if ip == nil {
+				t.Fatalf("ParseIP(%q) returned nil", test.address)
+			}
+			if got := HTTPURLTargetIPAllowed(ip); got != test.allowed {
+				t.Fatalf("HTTPURLTargetIPAllowed(%q) = %t, want %t", test.address, got, test.allowed)
+			}
+		})
+	}
+}
+
+func TestResolveAllowedHTTPURLRejectsSpecialIPv6Literals(t *testing.T) {
+	for _, rawURL := range []string{
+		"http://[64:ff9b:1::a9fe:a9fe]/metadata",
+		"http://[2002:a9fe:a9fe::1]/metadata",
+	} {
+		t.Run(rawURL, func(t *testing.T) {
+			_, _, err := ResolveAllowedHTTPURL(rawURL)
+			if !errors.Is(err, ErrHTTPURLTargetNotAllowed) {
+				t.Fatalf("ResolveAllowedHTTPURL(%q) error = %v, want %v", rawURL, err, ErrHTTPURLTargetNotAllowed)
+			}
+		})
+	}
+}
+
 func TestBuildRestrictedHTTPClientPreservesHostnameAsTLSServerName(t *testing.T) {
 	// Construct a hostname URL paired with an arbitrary public IP so we exercise
 	// the SNI preservation path without depending on live DNS in unit tests.
```

---

### Incident Patch 14: `c6082abc` (2026-08-11)
**Commit Message**: fix: 修复空周期流量规则列表导致流量历史清理失效 (#1226)

* fix: prevent unbounded transfer history growth

* fix: preserve transfer history on alert load errors

* test: close transfer cleanup database

---------

Co-authored-by: naiba <[REDACTED_EMAIL]>

**File**: `service/singleton/clean_monitor_history_test.go` (added, +57/-0)
```diff
@@ -0,0 +1,57 @@
+package singleton
+
+import (
+	"path/filepath"
+	"testing"
+
+	"github.com/stretchr/testify/require"
+	"gorm.io/gorm"
+
+	"github.com/nezhahq/nezha/model"
+)
+
+func setupCleanMonitorHistoryTestDB(t *testing.T) {
+	t.Helper()
+
+	previousDB := DB
+	var err error
+	DB, err = gorm.Open(openSQLiteDialector(filepath.Join(t.TempDir(), "dashboard.sqlite")), &gorm.Config{})
+	require.NoError(t, err)
+	sqlDB, err := DB.DB()
+	require.NoError(t, err)
+	t.Cleanup(func() {
+		DB = previousDB
+		if err := sqlDB.Close(); err != nil {
+			t.Errorf("close transfer cleanup test database: %v", err)
+		}
+	})
+
+	require.NoError(t, DB.AutoMigrate(&model.Server{}, &model.Transfer{}, &model.AlertRule{}))
+	require.NoError(t, DB.Exec("INSERT INTO servers (id, name, uuid) VALUES (1, 'server', 'clean-monitor-history-test')").Error)
+}
+
+func TestCleanMonitorHistoryWithoutRulesDeletesAllTransfers(t *testing.T) {
+	setupCleanMonitorHistoryTestDB(t)
+	require.NoError(t, DB.Create(&model.Transfer{ServerID: 1, In: 1}).Error)
+
+	CleanMonitorHistory()
+
+	var count int64
+	require.NoError(t, DB.Model(&model.Transfer{}).Count(&count).Error)
+	require.Zero(t, count)
+}
+
+func TestCleanMonitorHistoryPreservesTransfersWhenAlertRulesCannotBeLoaded(t *testing.T) {
+	setupCleanMonitorHistoryTestDB(t)
+	require.NoError(t, DB.Create(&model.Transfer{ServerID: 1, In: 1}).Error)
+	require.NoError(t, DB.Exec("INSERT INTO alert_rules (id, name, rules_raw, fail_trigger_tasks_raw, recover_trigger_tasks_raw) VALUES (1, 'broken', '{', '[]', '[]')").Error)
+
+	var alerts []model.AlertRule
+	require.Error(t, DB.Find(&alerts).Error, "precondition: malformed rules_raw must fail AlertRule.AfterFind")
+
+	CleanMonitorHistory()
+
+	var count int64
+	require.NoError(t, DB.Model(&model.Transfer{}).Count(&count).Error)
+	require.EqualValues(t, 1, count)
+}
```

**File**: `service/singleton/singleton.go` (modified, +12/-1)
```diff
@@ -160,7 +160,10 @@ func CleanMonitorHistory() {
 	specialServerKeep := make(map[uint64]time.Time)
 	var specialServerIDs []uint64
 	var alerts []model.AlertRule
-	DB.Find(&alerts)
+	if err := DB.Find(&alerts).Error; err != nil {
+		log.Printf("NEZHA>> Failed to load alert rules while cleaning transfer history: %v", err)
+		return
+	}
 	for _, alert := range alerts {
 		for _, rule := range alert.Rules {
 			// 是不是流量记录规则
@@ -188,6 +191,14 @@ func CleanMonitorHistory() {
 	for id, couldRemove := range specialServerKeep {
 		DB.Unscoped().Delete(&model.Transfer{}, "server_id = ? AND datetime(`created_at`) < datetime(?)", id, couldRemove)
 	}
+	if len(specialServerIDs) == 0 {
+		if allServerKeep.IsZero() {
+			DB.Unscoped().Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&model.Transfer{})
+		} else {
+			DB.Unscoped().Delete(&model.Transfer{}, "datetime(`created_at`) < datetime(?)", allServerKeep)
+		}
+		return
+	}
 	if allServerKeep.IsZero() {
 		DB.Unscoped().Delete(&model.Transfer{}, "server_id NOT IN (?)", specialServerIDs)
 	} else {
```

---

### Incident Patch 15: `71e2cbcf` (2026-08-07)
**Commit Message**: Fixes broken Star History chart

This new provider revives the OG service that's being killed by Github

**File**: `README.md` (modified, +1/-1)
```diff
@@ -117,4 +117,4 @@ add your theme to [service/singleton/frontend-templates.yaml](service/singleton/
 
 ## Star History
 
-[![Star History Chart](https://api.star-history.com/svg?repos=nezhahq/nezha&type=Timeline)](https://star-history.com/#nezhahq/nezha&Timeline)
+[![Star History Chart](https://star-history.dera.page/svg?repos=nezhahq/nezha&type=Timeline)](https://star-history.dera.page/#nezhahq/nezha&Timeline)
```

#### Recent Merged Pull Requests:
- **PR #1242** (2026-10-01): fix(alerts): evaluate fresh reports and order notification delivery (@cantoblanco)
- **PR #1241** (2026-10-01): fix(nat): strip only dashboard-issued Authorization credentials at NAT ingress (@xvkong233)
- **PR #1238** (closed): Fixed: An issue where deleting DNS records for domains hosted on Cloudflare did not work. (@77-QiQi)
- **PR #1237** (2026-09-14): Improve: Delete the corresponding DNS record if the IPv4/IPv6 address is empty. (@77-QiQi)
- **PR #1236** (2026-09-12): feat(auth): allow JWT IP changes by configuration (@NikoCat233)
- **PR #1235** (2026-09-12): feat: surface GPU memory in host state (@ryrenz)
- **PR #1231** (2026-08-17): improve: ddns (@77-QiQi)
- **PR #1229** (closed): feat.主题强兼（强行兼容）komari (@preauthn1)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
