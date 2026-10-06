# Forensic Learning Record (Deep Inspection): txn2/kubefwd

> **Canonical Artifact**: `07_PROJECT_LEARNING/txn2-kubefwd-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/txn2/kubefwd](https://github.com/txn2/kubefwd))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:59:49.849Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `txn2/kubefwd`
- **Description**: Bulk port forwarding Kubernetes services for local development.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 4173 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `pkg/fwdtui/state/history.go`
```
package state

import (
	"sync"
)

// ForwardHistory stores rate history samples for a single port forward
type ForwardHistory struct {
	RateIn  []float64
	RateOut []float64
	maxSize int
}

// RateHistory stores rate history for all port forwards
type RateHistory struct {
	mu       sync.RWMutex
	forwards map[string]*ForwardHistory
	maxSize  int
}

// NewRateHistory creates a new rate history store with specified max samples
func NewRateHistory(maxSize int) *RateHistory {
	if maxSize <= 0 {
		maxSize = 60 // Default to 60 seconds of history
	}
	return &RateHistory{
		forwards: make(map[string]*ForwardHistory),
		maxSize:  maxSize,
	}
}

// AddSample adds a rate sample for a forward
func (h *RateHistory) AddSample(forwardKey string, rateIn, rateOut float64) {
	h.mu.Lock()
	defer h.mu.Unlock()

	fh, exists := h.forwards[forwardKey]
	if !exists {
		fh = &ForwardHistory{
			RateIn:  make([]float64, 0, h.maxSize),
			RateOut: make([]float64, 0, h.maxSize),
			maxSize: h.maxSize,
		}
		h.forwards[forwardKey] = fh
	}

	// Append new sample
	fh.RateIn = append(fh.RateIn, rateIn)
	fh.RateOut = append(fh.RateOut, rateOut)

	// Trim if exceeding max size
	if len(fh.RateIn) > fh.maxSize {
		fh.RateIn = fh.RateIn[len(fh.RateIn)-fh.maxSize:]
	}
	if len(fh.RateOut) > fh.maxSize {
		fh.RateOut = fh.RateOut[len(fh.RateOut)-fh.maxSize:]
	}
}

// GetHistory returns the last 'count' rate samples for a forward
// Returns copies to prevent concurrent modification issues
func (h *RateHistory) GetHistory(forwardKey string, count int) (rateIn, rateOut []float64) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	fh, exists := h.forwards[forwardKey]
	if !exists {
		return nil, nil
	}

	// Calculate start index for requested count
	startIn := 0
	if len(fh.RateIn) > count {
		startIn = len(fh.RateIn) - count
	}
	startOut := 0
	if len(fh.RateOut) > count {
		startOut = len(fh.RateOut) - count
	}

	// Create copies
	rateIn = make([]float64, len(fh.RateIn)-startIn)
	copy(rateIn, fh.RateIn[startIn:])

	rateOut = make([]float64, len(fh.RateOut)-startOut)
	copy(rateOut, fh.RateOut[startOut:])

	return rateIn, rateOut
}

// GetAllHistory returns the full history for a forward
func (h *RateHistory) GetAllHistory(forwardKey string) (rateIn, rateOut []float64) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	fh, exists := h.forwards[forwardKey]
	if !exists {
		return nil, nil
	}

	// Create copies
	rateIn = make([]float64, len(fh.RateIn))
	copy(rateIn, fh.RateIn)

	rateOut = make([]float64, len(fh.RateOut))
	copy(rateOut, fh.RateOut)

	return rateIn, rateOut
}

// Remove removes history for a forward
func (h *RateHistory) Remove(forwardKey string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.forwards, forwardKey)
}

// Clear removes all history
func (h *RateHistory) Clear() {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.forwards = make(map[string]*ForwardHistory)
}

// Size returns the number of forwards being tracked
func (h *RateHistory) Size() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.forwards)
}

```

### Core Architecture Module: `pkg/fwdtui/state/snapshot.go`
```
package state

import (
	"time"
)

// ForwardStatus represents the status of a port forward
type ForwardStatus int

const (
	StatusPending ForwardStatus = iota
	StatusConnecting
	StatusActive
	StatusError
	StatusStopping
)

// String returns a string representation of the status
func (s ForwardStatus) String() string {
	switch s {
	case StatusPending:
		return "Pending"
	case StatusConnecting:
		return "Connecting"
	case StatusActive:
		return "Active"
	case StatusError:
		return "Error"
	case StatusStopping:
		return "Stopping"
	default:
		return "Unknown"
	}
}

// ForwardSnapshot represents an immutable snapshot of a port forward for TUI rendering
type ForwardSnapshot struct {
	// Identification
	Key         string // unique key: "service.namespace.context.podname.localport"
	ServiceKey  string // "service.namespace.context" (display name for TUI)
	RegistryKey string // "realservice.namespace.context" (for registry lookup)

	// Service info
	ServiceName string
	Namespace   string
	Context     string
	Headless    bool

	// Pod info
	PodName       string
	ContainerName string // container that owns the forwarded port

	// Network info
	LocalIP   string
	LocalPort string
	PodPort   string
	Hostnames []string

	// Status
	Status     ForwardStatus
	Error      string
	StartedAt  time.Time
	LastActive time.Time

	// Bandwidth metrics
	BytesIn    uint64
	BytesOut   uint64
	RateIn     float64 // bytes/sec instantaneous
	RateOut    float64 // bytes/sec instantaneous
	AvgRateIn  float64 // bytes/sec 10-second average
	AvgRateOut float64 // bytes/sec 10-second average
}

// PrimaryHostname returns the shortest hostname or service name if no hostnames
func (f *ForwardSnapshot) PrimaryHostname() string {
	if len(f.Hostnames) == 0 {
		return f.ServiceName
	}
	shortest := f.Hostnames[0]
	for _, h := range f.Hostnames[1:] {
		if len(h) < len(shortest) {
			shortest = h
		}
	}
	return shortest
}

// LocalAddress returns the local IP:Port string
func (f *ForwardSnapshot) LocalAddress() string {
	return f.LocalIP + ":" + f.LocalPort
}

// ServiceSnapshot aggregates all port forwards for a service
type ServiceSnapshot struct {
	// Identification
	Key         string // "service.namespace.context"
	ServiceName string
	Namespace   string
	Context     string
	Headless    bool

	// Aggregated metrics
	TotalBytesIn  uint64
	TotalBytesOut uint64
	TotalRateIn   float64
	TotalRateOut  float64
	ActiveCount   int
	ErrorCount    int

	// Port forwards
	PortForwards []ForwardSnapshot
}

// LogEntry represents a log message for TUI display
type LogEntry struct {
	Timestamp time.Time
	Level     string
	Message   string
	Color     string // tview color tag
}

// SummaryStats provides overall statistics for the status bar
type SummaryStats struct {
	TotalServices  int
	ActiveServices int
	TotalForwards  int
	ActiveForwards int
	ErrorCount     int
	TotalBytesIn   uint64
	TotalBytesOut  uint64
	TotalRateIn    float64
	TotalRateOut   float64
	LastUpdated    time.Time
}

```

### Core Architecture Module: `pkg/fwdtui/state/store.go`
```
package state

import (
	"sort"
	"strings"
	"sync"
	"time"
)

// Maximum allocation limit for logs (CodeQL CWE-770 compliance)
const maxLogsAllocation = 10000

// boundedSize returns size bounded to limit for memory safety
func boundedSize(size, limit int) int {
	if size <= 0 {
		return 0
	}
	if size > limit {
		return limit
	}
	return size
}

// Store maintains the current state of all forwards for TUI rendering
type Store struct {
	mu       sync.RWMutex
	forwards map[string]*ForwardSnapshot // keyed by "service.namespace.context.podname"
	services map[string]*ServiceSnapshot // keyed by "service.namespace.context"

	// Blocked namespaces - prevents race condition where port forward events
	// arrive after namespace removal. Key format: "namespace.context"
	blockedNamespaces map[string]struct{}

	// Display options
	filter    string
	sortField string
	sortAsc   bool

	// Log buffer
	logs       []LogEntry
	maxLogSize int
}

// NewStore creates a new state store
func NewStore(maxLogSize int) *Store {
	if maxLogSize <= 0 {
		maxLogSize = 1000
	}
	return &Store{
		forwards:          make(map[string]*ForwardSnapshot),
		services:          make(map[string]*ServiceSnapshot),
		blockedNamespaces: make(map[string]struct{}),
		filter:            "",
		sortField:         "hostname",
		sortAsc:           true,
		logs:              make([]LogEntry, 0, maxLogSize),
		maxLogSize:        maxLogSize,
	}
}

// AddForward adds or updates a forward in the store
func (s *Store) AddForward(snapshot ForwardSnapshot) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Check if this namespace is blocked (recently removed)
	// This prevents race condition where port forward events arrive after namespace removal
	nsKey := snapshot.Namespace + "." + snapshot.Context
	if _, blocked := s.blockedNamespaces[nsKey]; blocked {
		return // Silently ignore updates for blocked namespaces
	}

	s.forwards[snapshot.Key] = &snapshot

	// Update or create service aggregate
	if svc, ok := s.services[snapshot.ServiceKey]; ok {
		s.updateServiceAggregate(svc)
	} else {
		s.services[snapshot.ServiceKey] = &ServiceSnapshot{
			Key:         snapshot.ServiceKey,
			ServiceName: snapshot.ServiceName,
			Namespace:   snapshot.Namespace,
			Context:     snapshot.Context,
			Headless:    snapshot.Headless,
		}
		s.updateServiceAggregate(s.services[snapshot.ServiceKey])
	}
}

// RemoveForward removes a forward from the store
func (s *Store) RemoveForward(key string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if fwd, ok := s.forwards[key]; ok {
		serviceKey := fwd.ServiceKey
		delete(s.forwards, key)

		// Update service aggregate
		if svc, ok := s.services[serviceKey]; ok {
			s.updateServiceAggregate(svc)
			// Remove service if no forwards left
			if len(svc.PortForwards) == 0 {
				delete(s.services, serviceKey)
			}
		}
	}
}

// UpdateMetrics updates bandwidth metrics for a forward
func (s *Store) UpdateMetrics(key string, bytesIn, bytesOut uint64, rateIn, rateOut, avgRateIn, avgRateOut float64) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if fwd, ok := s.forwards[key]; ok {
		fwd.BytesIn = bytesIn
		fwd.BytesOut = bytesOut
		fwd.RateIn = rateIn
		fwd.RateOut = rateOut
		fwd.AvgRateIn = avgRateIn
		fwd.AvgRateOut = avgRateOut
		fwd.LastActive = time.Now()

		// Update service aggregate
		if svc, ok := s.services[fwd.ServiceKey]; ok {
			s.updateServiceAggregate(svc)
		}
	}
}

// UpdateStatus updates the status of a forward
func (s *Store) UpdateStatus(key string, status ForwardStatus, errorMsg string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if fwd, ok := s.forwards[key]; ok {
		fwd.Status = status
		fwd.Error = errorMsg

		// Update service aggregate
		if svc, ok := s.services[fwd.ServiceKey]; ok {
			s.updateServiceAggregate(svc)
		}
	}
}

// updateServiceAggregate recalculates service-level aggregates
// Must be called with lock held
func (s *Store) updateServiceAggregate(svc *ServiceSnapshot) {
	svc.PortForwards = make([]ForwardSnapshot, 0)
	svc.TotalBytesIn = 0
	svc.TotalBytesOut = 0
	svc.TotalRateIn = 0
	svc.TotalRateOut = 0
	svc.ActiveCount = 0
	svc.ErrorCount = 0

	for _, fwd := range s.forwards {
		if fwd.ServiceKey == svc.Key {
			svc.PortForwards = append(svc.PortForwards, *fwd)
			svc.TotalBytesIn += fwd.BytesIn
			svc.TotalBytesOut += fwd.BytesOut
			svc.TotalRateIn += fwd.RateIn
			svc.TotalRateOut += fwd.RateOut
			if fwd.Status == StatusActive {
				svc.ActiveCount++
			}
			if fwd.Status == StatusError {
				svc.ErrorCount++
			}
		}
	}
}

// GetFiltered returns forwards matching the current filter, sorted
func (s *Store) GetFiltered() []ForwardSnapshot {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]ForwardSnapshot, 0, len(s.forwards))

	for _, fwd := range s.forwards {
		if s.matchesFilter(fwd) {
			result = append(result, *fwd)
		}
	}

	s.sortForwards(result)
	return result
}

// GetServices returns all services with their forwards
func (s *Store) GetServices() []ServiceSnapshot {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]ServiceSnapshot, 0, len(s.services))
	for _, svc := range s.services {
		result = append(result, *svc)
	}

	// Sort by service name
	sort.Slice(result, func(i, j int) bool {
		return result[i].ServiceName < result[j].ServiceName
	})

	return result
}

// GetSummary returns overall statistics
func (s *Store) GetSummary() SummaryStats {
	s.mu.RLock()
	defer s.mu.RUnlock()

	stats := SummaryStats{
		TotalServices: len(s.services),
		TotalForwards: len(s.forwards),
		LastUpdated:   time.Now(),
	}

	for _, svc := range s.services {
		if svc.ActiveCount > 0 {
			stats.ActiveServices++
		}
	}

	for _, fwd := range s.forwards {
		if fwd.Status == StatusActive {
			stats.ActiveForwards++
		}
		if fwd.Status == StatusError {
			stats.ErrorCount++
		}
		stats.TotalBytesIn += fwd.BytesIn
		stats.TotalBytesOut += fwd.BytesOut
		stats.TotalRateIn += fwd.RateIn
		stats.TotalRateOut += fwd.RateOut
	}

	return stats
}

// SetFilter sets the current filter text
func (s *Store) SetFilter(filter string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.filter = strings.ToLower(filter)
}

// GetFilter returns the current filter text
func (s *Store) GetFilter() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.filter
}

// SetSort sets the sort field and direction
func (s *Store) SetSort(field string, ascending bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.sortField = field
	s.sortAsc = ascending
}

// matchesFilter checks if a forward matches the current filter
// Must be called with lock held
func (s *Store) matchesFilter(fwd *ForwardSnapshot) bool {
	if s.filter == "" {
		return true
	}

	// Check hostnames
	for _, h := range fwd.Hostnames {
		if strings.Contains(strings.ToLower(h), s.filter) {
			return true
		}
	}

	// Check service name
	if strings.Contains(strings.ToLower(fwd.ServiceName), s.filter) {
		return true
	}

	// Check namespace
	if strings.Contains(strings.ToLower(fwd.Namespace), s.filter) {
		return true
	}

	// Check pod name
	if strings.Contains(strings.ToLower(fwd.PodName), s.filter) {
		return true
	}

	return false
}

// compareStrings returns -1 if a < b, 1 if a > b, 0 if equal
func compareStrings(a, b string) int {
	if a < b {
		return -1
	}
	if a > b {
		return 1
	}
	return 0
}

// compareInts returns -1 if a < b, 1 if a > b, 0 if equal
func compareInts[T ~int | ~int32 | ~int64 | ~uint32](a, b T) int {
	if a < b {
		return -1
	}
	if a > b {
		return 1
	}
	return 0
}

// compareFloats returns -1 if a < b, 1 if a > b, 0 if equal
func compareFloats(a, b float64) int {
	if a < b {
		return -1
	}
	if a > b {
		return 1
	}
	return 0
}

// compareForwardsByField compares two forwards by the given field
func compareForwardsByField(a, b *ForwardSnapshot, field string) int {
	switch field {
	case "hostname":
		return compareStrings(a.PrimaryHostname(), b.PrimaryHostname())
	case "namespace":
		return compareStrings(a.Namespace, b.Namespace)
	case "service":
		return compareStrings(a.ServiceName, b.ServiceName)
	case "status":
		return compareInts(a.Status, b.Status)
	case "rateIn":
		return compareFloats(a.RateIn, b.RateIn)
	case "rateOut":
		return compareFloats(a.RateOut, b.RateOut)
	default:
		return compareStrings(a.PrimaryHostname(), b.PrimaryHostname())
	}
}

// sortForwards sorts forwards based on current sort settings
// Must be called with lock held
func (s *Store) sortForwards(forwards []ForwardSnapshot) {
	sort.Slice(forwards, func(i, j int) bool {
		cmp := compareForwardsByField(&forwards[i], &forwards[j], s.sortField)

		// Tiebreaker: sort by port for stable ordering
		if cmp == 0 {
			cmp = compareStrings(forwards[i].LocalPort, forwards[j].LocalPort)
		}

		if s.sortAsc {
			return cmp < 0
		}
		return cmp > 0
	})
}

// AddLog adds a log entry to the buffer
func (s *Store) AddLog(entry LogEntry) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.logs = append(s.logs, entry)
	// Trim if exceeding max size
	if len(s.logs) > s.maxLogSize {
		s.logs = s.logs[len(s.logs)-s.maxLogSize:]
	}
}

// GetLogs returns recent log entries
func (s *Store) GetLogs(count int) []LogEntry {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if count <= 0 || count > len(s.logs) {
		count = len(s.logs)
	}

	// Explicit upper bound for memory safety (CodeQL CWE-770)
	allocSize := boundedSize(count, maxLogsAllocation)
	if allocSize == 0 {
		return nil
	}

	start := len(s.logs) - allocSize
	if start < 0 {
		start = 0
	}

	result := make([]LogEntry, allocSize)
	copy(result, s.logs[start:])
	return result
}

// Count returns the total number of forwards
func (s *Store) Count() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.forwards)
}

// ServiceCount returns the total number of services
func (s *Store) ServiceCount() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.services)
}

// GetForward returns a forward by key, or nil if not found
func (s *Store) GetForward(key string) *ForwardSnapshot {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if fwd, ok := s.forwards[key]; ok {
		// Return a copy to prevent concurrent modification
		snapshot := *fwd
		return &snapsho
```

### Core Architecture Module: `pkg/utils/interface.go`
```
package utils

// RootChecker determines if the process has administrative privileges.
// This interface allows mocking root checks for testing.
type RootChecker interface {
	// CheckRoot returns true if the current process has root/admin privileges.
	CheckRoot() (bool, error)
}

// defaultRootChecker is the production implementation
// that uses OS-specific commands to check privileges.
// The CheckRoot method is implemented in platform-specific files.
type defaultRootChecker struct{}

// Checker is the package-level RootChecker used by the application.
// Replace this with a mock for testing.
var Checker RootChecker = &defaultRootChecker{}

// SetChecker replaces the current RootChecker (for testing).
func SetChecker(c RootChecker) {
	Checker = c
}

// ResetChecker restores the default RootChecker.
func ResetChecker() {
	Checker = &defaultRootChecker{}
}

```

### Core Architecture Module: `pkg/utils/mock_checker.go`
```
package utils

import "sync"

// MockRootChecker is a test double for RootChecker.
// It allows configuring return values and tracks calls.
type MockRootChecker struct {
	mu sync.Mutex

	// IsRoot determines what CheckRoot returns
	IsRoot bool

	// Err is the error to return from CheckRoot
	Err error

	// CallCount tracks how many times CheckRoot was called
	CallCount int
}

// NewMockRootChecker creates a mock that returns isRoot with no error
func NewMockRootChecker(isRoot bool) *MockRootChecker {
	return &MockRootChecker{IsRoot: isRoot}
}

// CheckRoot implements RootChecker.
func (m *MockRootChecker) CheckRoot() (bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.CallCount++
	return m.IsRoot, m.Err
}

// GetCallCount returns the number of times CheckRoot was called
func (m *MockRootChecker) GetCallCount() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.CallCount
}

// Reset clears the call count and restores default values
func (m *MockRootChecker) Reset() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.CallCount = 0
	m.IsRoot = false
	m.Err = nil
}

```

### Core Architecture Module: `pkg/utils/root.go`
```
//go:build !windows

package utils

import (
	"os/exec"
	"strconv"
)

// CheckRoot determines if we have administrative privileges.
// This function delegates to the package-level Checker for testability.
func CheckRoot() (bool, error) {
	return Checker.CheckRoot()
}

// CheckRoot implements RootChecker for defaultRootChecker on Unix systems.
func (d *defaultRootChecker) CheckRoot() (bool, error) {
	cmd := exec.Command("id", "-u")

	output, err := cmd.Output()
	if err != nil {
		return false, err
	}

	i, err := strconv.Atoi(string(output[:len(output)-1]))
	if err != nil {
		return false, err
	}

	if i == 0 {
		return true, nil
	}

	return false, nil
}

```

### Core Architecture Module: `pkg/utils/root_windows.go`
```
//go:build windows

/*
Copyright 2018 Craig Johnston <cjimti@gmail.com>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
package utils

import (
	"github.com/pkg/errors"
	"golang.org/x/sys/windows"
)

// CheckRoot determines if we have administrative privileges.
// This function delegates to the package-level Checker for testability.
func CheckRoot() (bool, error) {
	return Checker.CheckRoot()
}

// CheckRoot implements RootChecker for defaultRootChecker on Windows.
// Ref: https://coolaj86.com/articles/golang-and-windows-and-admins-oh-my/
func (d *defaultRootChecker) CheckRoot() (bool, error) {
	var sid *windows.SID

	// Although this looks scary, it is directly copied from the
	// official windows documentation. The Go API for this is a
	// direct wrap around the official C++ API.
	// See https://docs.microsoft.com/en-us/windows/desktop/api/securitybaseapi/nf-securitybaseapi-checktokenmembership
	err := windows.AllocateAndInitializeSid(
		&windows.SECURITY_NT_AUTHORITY,
		2,
		windows.SECURITY_BUILTIN_DOMAIN_RID,
		windows.DOMAIN_ALIAS_RID_ADMINS,
		0, 0, 0, 0, 0, 0,
		&sid)
	if err != nil {
		return false, errors.Errorf("sid error: %s", err)
	}

	// This appears to cast a null pointer so I'm not sure why this
	// works, but this guy says it does and it Works for Me™:
	// https://github.com/golang/go/issues/28804#issuecomment-438838144
	token := windows.Token(0)

	member, err := token.IsMember(sid)
	if err != nil {
		return false, errors.Errorf("token membership error: %s", err)
	}

	return member, nil
}

```

### Core Architecture Module: `cmd/kubefwd/kubefwd.go`
```
package main

import (
	"bytes"
	"fmt"
	"io"
	"os"
	"regexp"
	"strings"

	log "github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
	"github.com/txn2/kubefwd/cmd/kubefwd/mcp"
	"github.com/txn2/kubefwd/cmd/kubefwd/services"
	"k8s.io/klog/v2"
)

var globalUsage = `Bulk forward Kubernetes services for local development.

Each forwarded service gets its own unique loopback IP (127.x.x.x), allowing
multiple services to use the same port simultaneously. Service names are added
to /etc/hosts for transparent access using cluster service names.

Modes:
  Idle Mode:    Run without -n/--namespace; API enabled, no namespaces forwarded
  Namespace:    Forward all services from specified namespace(s)
  All:          Forward services from all namespaces (--all-namespaces)

The REST API (http://kubefwd.internal/) is auto-enabled in idle mode and allows
adding/removing namespaces and services dynamically.

Subcommands:
  mcp           Start MCP server for AI assistant integration (no sudo needed)
  version       Show version information`
var Version = "0.0.0"

// KlogWriter captures klog output and reformats it through logrus
type KlogWriter struct{}

// throttleRegex matches k8s client-side throttling messages
var throttleRegex = regexp.MustCompile(`Waited for ([\d.]+)s due to client-side throttling`)

func (w *KlogWriter) Write(p []byte) (n int, err error) {
	msg := strings.TrimSpace(string(p))

	// Skip empty lines and trace detail lines
	if msg == "" || strings.HasPrefix(msg, "Trace[") {
		return len(p), nil
	}

	// Extract and reformat throttling messages
	if matches := throttleRegex.FindStringSubmatch(msg); len(matches) > 1 {
		log.Warnf("K8s API throttled: waited %ss", matches[1])
		return len(p), nil
	}

	// Skip trace headers and request noise
	if strings.Contains(msg, "trace.go:") || strings.Contains(msg, "request.go:") {
		return len(p), nil
	}

	// Skip generic "lost connection" messages (lack useful context)
	if strings.Contains(msg, "lost connection to pod") {
		return len(p), nil
	}

	// Log any other unexpected klog messages at debug level
	log.Debugf("k8s: %s", msg)

	return len(p), nil
}

func init() {
	// Redirect k8s client-go klog output through our formatter
	klog.InitFlags(nil)
	klog.SetOutput(&KlogWriter{})
	klog.LogToStderr(false)

	// quiet version
	args := os.Args[1:]
	if len(args) == 2 && args[0] == "version" && args[1] == "quiet" {
		fmt.Println(Version)
		os.Exit(0)
	}

	log.SetOutput(&LogOutputSplitter{})
	if len(args) > 0 && (args[0] == "completion" || args[0] == "__complete" || args[0] == "mcp") {
		log.SetOutput(io.Discard)
	}
}

func newRootCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "kubefwd",
		Short: "Expose Kubernetes services for local development.",
		Example: `  sudo kubefwd                      # Idle mode (API enabled, no namespaces)
  sudo kubefwd --tui                # Idle mode with TUI
  sudo kubefwd -n myapp             # Forward services from 'myapp' namespace
  sudo kubefwd -n ns1 -n ns2        # Forward from multiple namespaces
  sudo kubefwd -A                   # Forward from all namespaces
  sudo kubefwd -n myapp -l app=web  # Filter by label selector
  kubefwd mcp                       # Start MCP server for AI integration
  kubefwd version                   # Show version`,

		Long: globalUsage,
	}

	versionCmd := &cobra.Command{
		Use:   "version",
		Short: "Print the version of Kubefwd",
		Example: " kubefwd version\n" +
			" kubefwd version quiet\n",
		Long: ``,
		Run: func(_ *cobra.Command, _ []string) {
			fmt.Printf("Kubefwd version: %s\nhttps://kubefwd.com\n", Version)
		},
	}

	// Pass version to services package for TUI header
	services.Version = Version

	// Pass version to mcp package
	mcp.Version = Version

	cmd.AddCommand(versionCmd, services.Cmd, mcp.Cmd)

	return cmd
}

type LogOutputSplitter struct{}

func (splitter *LogOutputSplitter) Write(p []byte) (n int, err error) {
	if bytes.Contains(p, []byte("level=error")) || bytes.Contains(p, []byte("level=warn")) {
		return os.Stderr.Write(p)
	}
	return os.Stdout.Write(p)
}

// isTUIMode checks if --tui flag is present in args
func isTUIMode() bool {
	for _, arg := range os.Args {
		if arg == "--tui" {
			return true
		}
	}
	return false
}

// isMCPMode checks if running the mcp subcommand
func isMCPMode() bool {
	for _, arg := range os.Args[1:] {
		if arg == "mcp" {
			return true
		}
		// Stop at first non-flag argument
		if !strings.HasPrefix(arg, "-") {
			break
		}
	}
	return false
}

// isKnownSubcommand checks if arg is a known subcommand
func isKnownSubcommand(arg string) bool {
	knownCommands := map[string]bool{
		"services": true, "svcs": true, "svc": true,
		"version": true, "mcp": true,
		"help": true, "completion": true, "__complete": true,
	}
	return knownCommands[arg]
}

func main() {
	log.SetFormatter(&log.TextFormatter{
		FullTimestamp:   true,
		ForceColors:     true,
		TimestampFormat: "15:04:05",
	})

	// If no subcommand provided, default to "svc" (services command)
	// This enables `sudo -E kubefwd` to work directly as idle mode
	args := os.Args[1:]
	if len(args) == 0 || (len(args) > 0 && !isKnownSubcommand(args[0])) {
		// No args, or first arg is a flag/unknown - prepend "svc"
		os.Args = append([]string{os.Args[0], "svc"}, args...)
	}

	// Only print banner in non-TUI, non-MCP mode
	if !isTUIMode() && !isMCPMode() {
		log.Print(` _          _           __             _`)
		log.Print(`| | ___   _| |__   ___ / _|_      ____| |`)
		log.Print(`| |/ / | | | '_ \ / _ \ |_\ \ /\ / / _  |`)
		log.Print(`|   <| |_| | |_) |  __/  _|\ V  V / (_| |`)
		log.Print(`|_|\_\\__,_|_.__/ \___|_|   \_/\_/ \__,_|`)
		log.Print("")
		log.Printf("Version %s", Version)
		log.Print("https://kubefwd.com")
		log.Print("")
	}

	cmd := newRootCmd()

	if err := cmd.Execute(); err != nil {
		os.Exit(1)
	}
}

```

### Core Architecture Module: `cmd/kubefwd/mcp/mcp.go`
```
// Package mcp provides the MCP (Model Context Protocol) subcommand for kubefwd.
// This command starts an MCP server that connects to a running kubefwd REST API,
// allowing AI assistants like Claude to interact with kubefwd without requiring sudo.
package mcp

import (
	"fmt"
	"os"

	log "github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
	"github.com/txn2/kubefwd/pkg/fwdapi/types"
	"github.com/txn2/kubefwd/pkg/fwdmcp"
)

var (
	apiURL string
	apiKey string
	verbose bool
)

// Version is set by the main package
var Version string

func init() {
	Cmd.Flags().StringVar(&apiURL, "api-url", "http://kubefwd.internal/api", "URL of the kubefwd REST API")
	Cmd.Flags().StringVar(&apiKey, "api-key", "", "API key for authentication (env: KUBEFWD_API_KEY)")
	Cmd.Flags().BoolVarP(&verbose, "verbose", "v", false, "Verbose output")
}

// Cmd is the MCP subcommand
var Cmd = &cobra.Command{
	Use:   "mcp",
	Short: "Start MCP server (connects to kubefwd REST API)",
	Long: `Start an MCP (Model Context Protocol) server that connects to a running
kubefwd instance via its REST API.

Architecture:
  ┌─────────────┐    stdio     ┌─────────────┐    HTTP      ┌─────────────┐
  │  AI Client  │ ←──────────→ │ kubefwd mcp │ ←──────────→ │   kubefwd   │
  │ (Claude,etc)│   MCP proto  │  (bridge)   │ REST API     │ (with sudo) │
  └─────────────┘              └─────────────┘              └─────────────┘

Why two processes?
  - kubefwd needs sudo for /etc/hosts and network interfaces
  - MCP clients spawn MCP servers as child processes (no sudo possible)
  - So 'kubefwd mcp' runs without sudo and talks to kubefwd via REST API

This command does NOT require sudo and can be spawned by Claude Code, Cursor,
or other MCP-compatible AI assistants.

Prerequisites:
  1. Start kubefwd in a separate terminal (requires sudo):
     sudo -E kubefwd              # Idle mode with API auto-enabled
     sudo -E kubefwd -n default   # Forward namespace (API auto-enabled)

  2. Configure your MCP client (e.g., Claude Code):
     {
       "mcpServers": {
         "kubefwd": {
           "command": "kubefwd",
           "args": ["mcp"]
         }
       }
     }

The MCP server provides developer-focused tools for:
  - Adding/removing namespaces to forward dynamically
  - Adding/removing individual services to forward
  - Discovering available Kubernetes namespaces and services
  - Getting connection info (hostnames, IPs, ports, env vars)
  - Finding forwarded services by name or port
  - Listing and inspecting forwarded services
  - Viewing metrics and logs
  - Triggering reconnections and syncs
  - Diagnosing errors`,
	Example: `  # Start MCP server (connects to kubefwd API at http://kubefwd.internal/api)
  kubefwd mcp

  # Connect to a custom API URL
  kubefwd mcp --api-url http://localhost:8080/api

  # With verbose logging (logs go to stderr, not interfering with stdio MCP)
  kubefwd mcp --verbose`,
	Run: runMCP,
}

func runMCP(_ *cobra.Command, _ []string) {
	// Configure logging to stderr (stdout is used for MCP stdio transport)
	log.SetOutput(os.Stderr)
	if verbose {
		log.SetLevel(log.DebugLevel)
	} else {
		log.SetLevel(log.WarnLevel)
	}

	if apiKey != "" {
		if err := os.Setenv("KUBEFWD_API_KEY", apiKey); err != nil {
			log.Warnf("Failed to set KUBEFWD_API_KEY: %v", err)
		}
	}

	log.Infof("Starting kubefwd MCP server (version %s)", Version)
	log.Infof("Connecting to REST API at: %s", apiURL)

	// Initialize MCP server first so tools are registered for discovery
	// (allows Smithery and other registries to introspect capabilities)
	server := fwdmcp.Init(Version)

	// Check API connection - if unavailable, tools will return helpful errors
	apiAvailable := false
	if err := verifyAPIConnection(apiURL); err != nil {
		log.Warnf("Cannot connect to kubefwd API at %s: %v", apiURL, err)
		log.Warn("MCP server will start but tools require kubefwd to be running.")
		log.Warn("Start kubefwd in another terminal with: sudo -E kubefwd")
	} else {
		log.Info("API connection verified")
		apiAvailable = true
	}

	// Only set up HTTP adapters if API is available
	// If not available, providers stay nil and handlers return helpful instructions
	if apiAvailable {
		// Create HTTP-based adapters
		stateReader := fwdmcp.NewStateReaderHTTP(apiURL)
		metricsProvider := fwdmcp.NewMetricsProviderHTTP(apiURL)
		serviceController := fwdmcp.NewServiceControllerHTTP(apiURL)
		diagnosticsProvider := fwdmcp.NewDiagnosticsProviderHTTP(apiURL)
		managerInfo := fwdmcp.NewManagerInfoHTTP(apiURL)

		// Create CRUD HTTP adapters for developer-focused tools
		namespaceController := fwdmcp.NewNamespaceControllerHTTP(apiURL)
		serviceCRUD := fwdmcp.NewServiceCRUDHTTP(apiURL)
		k8sDiscovery := fwdmcp.NewKubernetesDiscoveryHTTP(apiURL)
		connectionInfo := fwdmcp.NewConnectionInfoProviderHTTP(apiURL)

		// Create enhanced HTTP adapters for AI-optimized tools
		analysisProvider := fwdmcp.NewAnalysisProviderHTTP(apiURL)
		httpTrafficProvider := fwdmcp.NewHTTPTrafficProviderHTTP(apiURL)
		historyProvider := fwdmcp.NewHistoryProviderHTTP(apiURL)

		server.SetStateReader(stateReader)
		server.SetMetricsProvider(metricsProvider)
		server.SetServiceController(serviceController)
		server.SetDiagnosticsProvider(diagnosticsProvider)
		server.SetManagerInfo(func() types.ManagerInfo {
			return managerInfo
		})

		// Set CRUD controllers for developer-focused tools
		server.SetNamespaceController(namespaceController)
		server.SetServiceCRUD(serviceCRUD)
		server.SetKubernetesDiscovery(k8sDiscovery)
		server.SetConnectionInfoProvider(connectionInfo)

		// Set enhanced providers for AI-optimized tools
		server.SetAnalysisProvider(analysisProvider)
		server.SetHTTPTrafficProvider(httpTrafficProvider)
		server.SetHistoryProvider(historyProvider)
	}

	log.Info("MCP server initialized, starting stdio transport...")

	// Run stdio server (blocks until client disconnects)
	if err := server.ServeStdio(); err != nil {
		log.Errorf("MCP server error: %v", err)
		os.Exit(1)
	}

	log.Info("MCP server stopped")
}

// verifyAPIConnection checks if the kubefwd API is reachable
func verifyAPIConnection(baseURL string) error {
	client := fwdmcp.NewHTTPClient(baseURL)

	var resp struct {
		Status string `json:"status"`
	}

	// Try to hit the health endpoint
	if err := client.Get("/health", &resp); err != nil {
		return fmt.Errorf("health check failed: %w", err)
	}

	return nil
}

```

### Core Architecture Module: `cmd/kubefwd/services/services.go`
```
package services

import (
	"context"
	"fmt"
	"io"
	"os"
	"os/signal"
	"runtime"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/txn2/kubefwd/pkg/fwdapi"
	"github.com/txn2/kubefwd/pkg/fwdapi/types"
	"github.com/txn2/kubefwd/pkg/fwdcfg"
	"github.com/txn2/kubefwd/pkg/fwdhost"
	"github.com/txn2/kubefwd/pkg/fwdmetrics"
	"github.com/txn2/kubefwd/pkg/fwdns"
	"github.com/txn2/kubefwd/pkg/fwdport"
	"github.com/txn2/kubefwd/pkg/fwdsvcregistry"
	"github.com/txn2/kubefwd/pkg/fwdtui"
	"github.com/txn2/kubefwd/pkg/fwdtui/events"
	"github.com/txn2/kubefwd/pkg/fwdtui/state"
	"github.com/txn2/kubefwd/pkg/fwdtui/styles"
	"github.com/txn2/kubefwd/pkg/utils"
	"github.com/txn2/txeh"

	log "github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
	authorizationv1 "k8s.io/api/authorization/v1"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	utilRuntime "k8s.io/apimachinery/pkg/util/runtime"
	"k8s.io/client-go/kubernetes"
	_ "k8s.io/client-go/plugin/pkg/client/auth"
	clientcmdapi "k8s.io/client-go/tools/clientcmd/api"
)

// cmdline arguments
var namespaces []string
var contexts []string
var verbose bool
var domain string
var mappings []string
var isAllNs bool
var fwdConfigurationPath string
var fwdReservations []string
var timeout int
var hostsPath string
var refreshHostsBackup bool
var purgeStaleIps bool
var resyncInterval time.Duration
var retryInterval time.Duration
var tuiMode bool
var apiMode bool
var autoReconnect bool
var themeOverride string

// Version is set by the main package
var Version string

// defaultHostsPath returns the OS-appropriate hosts file path
func defaultHostsPath() string {
	if runtime.GOOS == "windows" {
		return `C:\Windows\System32\drivers\etc\hosts`
	}
	return "/etc/hosts"
}

func init() {
	// override error output from k8s.io/apimachinery/pkg/util/runtime
	utilRuntime.ErrorHandlers[0] = func(_ context.Context, err error, _ string, _ ...interface{}) {
		// "broken pipe" see: https://github.com/kubernetes/kubernetes/issues/74551
		log.Errorf("Runtime: %s", err.Error())
	}

	Cmd.Flags().StringP("kubeconfig", "c", "", "absolute path to a kubectl config file")
	Cmd.Flags().StringSliceVarP(&contexts, "context", "x", []string{}, "specify a context to override the current context")
	Cmd.Flags().StringSliceVarP(&namespaces, "namespace", "n", []string{}, "Specify a namespace. Specify multiple namespaces by duplicating this argument.")
	Cmd.Flags().StringP("selector", "l", "", "Selector (label query) to filter on; supports '=', '==', and '!=' (e.g. -l key1=value1,key2=value2).")
	Cmd.Flags().StringP("field-selector", "f", "", "Field selector to filter on; supports '=', '==', and '!=' (e.g. -f metadata.name=service-name).")
	Cmd.Flags().BoolVarP(&verbose, "verbose", "v", false, "Verbose output.")
	Cmd.Flags().StringVarP(&domain, "domain", "d", "", "Append a pseudo domain name to generated host names.")
	Cmd.Flags().StringSliceVarP(&mappings, "mapping", "m", []string{}, "Specify a port mapping. Specify multiple mapping by duplicating this argument.")
	Cmd.Flags().BoolVarP(&isAllNs, "all-namespaces", "A", false, "Enable --all-namespaces option like kubectl.")
	Cmd.Flags().StringSliceVarP(&fwdReservations, "reserve", "r", []string{}, "Specify an IP reservation. Specify multiple reservations by duplicating this argument.")
	Cmd.Flags().StringVarP(&fwdConfigurationPath, "fwd-conf", "z", "", "Define an IP reservation configuration")
	Cmd.Flags().IntVarP(&timeout, "timeout", "t", 300, "Specify a timeout seconds for the port forwarding.")
	Cmd.Flags().StringVar(&hostsPath, "hosts-path", defaultHostsPath(), "Hosts file path.")
	Cmd.Flags().BoolVarP(&refreshHostsBackup, "refresh-backup", "b", false, "Create a fresh hosts backup, replacing any existing backup.")
	Cmd.Flags().BoolVarP(&purgeStaleIps, "purge-stale-ips", "p", false, "Remove stale kubefwd host entries (IPs in 127.1.27.1 - 127.255.255.255 range) before starting.")
	Cmd.Flags().DurationVar(&resyncInterval, "resync-interval", 5*time.Minute, "Interval for forced service resync (e.g., 1m, 5m, 30s)")
	Cmd.Flags().DurationVar(&retryInterval, "retry-interval", 10*time.Second, "Retry interval when no pods found for a service (e.g., 5s, 10s, 30s)")
	Cmd.Flags().BoolVar(&tuiMode, "tui", false, "Enable terminal user interface mode for interactive service monitoring")
	Cmd.Flags().BoolVar(&apiMode, "api", false, "Enable REST API server on http://kubefwd.internal/api for automation and monitoring")
	Cmd.Flags().BoolVarP(&autoReconnect, "auto-reconnect", "a", false, "Automatically reconnect when port forwards are lost (exponential backoff: 1s to 5min). Defaults to true in TUI/API mode.")
	Cmd.Flags().StringVar(&themeOverride, "theme", "", "Color theme for TUI: 'light' or 'dark' (auto-detected if not set, env: KUBEFWD_THEME)")
}

var Cmd = &cobra.Command{
	Use:     "services",
	Aliases: []string{"svcs", "svc"},
	Short:   "Forward services",
	Long: `Forward multiple Kubernetes services from one or more namespaces.

Idle Mode:
  When run without specifying namespaces (-n) or --all-namespaces, kubefwd starts
  in idle mode. The REST API is automatically enabled and kubefwd waits for
  namespaces and services to be added via API calls. This is useful for:
  - Running kubefwd as a background daemon
  - AI/MCP integration where all operations are API-driven
  - Dynamic environments where namespaces are not known at startup

  In idle mode, auto-reconnect (-a) is also enabled by default.`,
	Example: "  sudo kubefwd                          # Idle mode with API\n" +
		"  sudo kubefwd --tui                    # Idle mode with TUI\n" +
		"  sudo kubefwd -n the-project           # Forward from namespace\n" +
		"  sudo kubefwd -n the-project --tui     # With TUI\n" +
		"  sudo kubefwd -n the-project -l app=api\n" +
		"  sudo kubefwd -n default -n other-ns   # Multiple namespaces\n" +
		"  sudo kubefwd --all-namespaces         # All namespaces",
	Run: runCmd,
}

// setAllNamespace Form V1Core get all namespace
func setAllNamespace(clientSet kubernetes.Interface, options metav1.ListOptions, namespaces *[]string) {
	nsList, err := clientSet.CoreV1().Namespaces().List(context.TODO(), options)
	if err != nil {
		log.Fatalf("Error get all namespaces by CoreV1: %s\n", err.Error())
	}
	if nsList == nil {
		log.Warn("No namespaces returned.")
		return
	}

	for _, ns := range nsList.Items {
		*namespaces = append(*namespaces, ns.Name)
	}
}

// checkConnection tests if you can connect to the cluster in your config,
// and if you have the necessary permissions to use kubefwd.
func checkConnection(clientSet kubernetes.Interface, namespaces []string) error {
	// Check simple connectivity: can you connect to the api server
	_, err := clientSet.Discovery().ServerVersion()
	if err != nil {
		return err
	}

	// Check RBAC permissions for each of the requested namespaces
	requiredPermissions := []authorizationv1.ResourceAttributes{
		{Verb: "list", Resource: "pods"}, {Verb: "get", Resource: "pods"}, {Verb: "watch", Resource: "pods"},
		{Verb: "get", Resource: "services"},
	}
	for _, namespace := range namespaces {
		for _, perm := range requiredPermissions {
			perm.Namespace = namespace
			var accessReview = &authorizationv1.SelfSubjectAccessReview{
				Spec: authorizationv1.SelfSubjectAccessReviewSpec{
					ResourceAttributes: &perm,
				},
			}
			accessReview, err = clientSet.AuthorizationV1().SelfSubjectAccessReviews().Create(context.TODO(), accessReview, metav1.CreateOptions{})
			if err != nil {
				return err
			}
			if !accessReview.Status.Allowed {
				return fmt.Errorf("missing RBAC permission: %v", perm)
			}
		}
	}

	return nil
}

// validateEnvironment checks root privileges and hosts file
func validateEnvironment() bool {
	hasRoot, err := utils.CheckRoot()
	if !hasRoot {
		log.Errorf(`
This program requires superuser privileges to run. These
privileges are required to add IP address aliases to your
loopback interface. Superuser privileges are also needed
to listen on low port numbers for these IP addresses.

Try:
 - sudo -E kubefwd services (Unix)
 - Running a shell with administrator rights (Windows)

`)
		if err != nil {
			log.Fatalf("Root check failure: %s", err.Error())
		}
		return false
	}

	if _, err = os.Stat(hostsPath); err != nil {
		log.Fatalf("Hosts path does not exist: %s", hostsPath)
	}
	return true
}

// detectAndConfigureIdleMode detects idle mode and configures flags
func detectAndConfigureIdleMode(cmd *cobra.Command) bool {
	idleMode := len(namespaces) == 0 && !isAllNs
	if idleMode {
		if !cmd.Flags().Changed("api") {
			apiMode = true
		}
		if !cmd.Flags().Changed("auto-reconnect") {
			autoReconnect = true
		}
		log.Println("Starting in idle mode - API enabled, waiting for namespaces/services via API")
	}
	return idleMode
}

// initializeTUIMode sets up TUI mode if enabled
func initializeTUIMode(cmd *cobra.Command) {
	if !tuiMode {
		return
	}
	fwdtui.Version = Version
	fwdtui.Enable()
	fwdmetrics.GetRegistry().Start()
	if !cmd.Flags().Changed("auto-reconnect") {
		autoReconnect = true
	}
}

// initializeAPIMode sets up API mode if enabled
func initializeAPIMode(cmd *cobra.Command) {
	if !apiMode {
		return
	}
	fwdapi.Enable()
	if !cmd.Flags().Changed("auto-reconnect") {
		autoReconnect = true
	}
}

// setupHostsFile initializes and backs up the hosts file
func setupHostsFile() *txeh.Hosts {
	hostFile, err := txeh.NewHosts(&txeh.HostsConfig{
		ReadFilePath:    hostsPath,
		WriteFilePath:   hostsPath,
		MaxHostsPerLine: 0,
	})
	if err != nil {
		log.Fatalf("HostFile error: %s", err.Error())
	}

	log.Printf("Loaded hosts file %s\n", hostFile.ReadFilePath)

	msg, err := fwdhost.BackupHostFile(hostFile, refreshHostsBackup)
	if err != nil {
		log.Fatalf("Error backing up hostfile: %s\n", err.Error())
	}
	log.Printf("HostFile management: %s", msg)

	handleStaleIPs(hostFile)
	return hostFile
}

// handleStaleIPs purges or reports stale IP entries
func handleStaleIPs(hostFile *txeh.Hosts) {
	if purgeStaleIps {
		count, err := fwdhost.PurgeStaleIps(host
```

### Core Architecture Module: `pkg/fwdapi/adapters.go`
```
package fwdapi

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"

	"github.com/txn2/kubefwd/pkg/fwdapi/types"
	"github.com/txn2/kubefwd/pkg/fwdcfg"
	"github.com/txn2/kubefwd/pkg/fwdmetrics"
	"github.com/txn2/kubefwd/pkg/fwdns"
	"github.com/txn2/kubefwd/pkg/fwdsvcregistry"
	"github.com/txn2/kubefwd/pkg/fwdtui"
	"github.com/txn2/kubefwd/pkg/fwdtui/events"
	"github.com/txn2/kubefwd/pkg/fwdtui/state"
)

// StateReaderAdapter adapts state.Store to the StateReader interface
type StateReaderAdapter struct {
	getStore func() *state.Store
}

// NewStateReaderAdapter creates a new StateReaderAdapter
func NewStateReaderAdapter(getStore func() *state.Store) *StateReaderAdapter {
	return &StateReaderAdapter{getStore: getStore}
}

func (a *StateReaderAdapter) GetServices() []state.ServiceSnapshot {
	if store := a.getStore(); store != nil {
		return store.GetServices()
	}
	return nil
}

func (a *StateReaderAdapter) GetService(key string) *state.ServiceSnapshot {
	if store := a.getStore(); store != nil {
		return store.GetService(key)
	}
	return nil
}

func (a *StateReaderAdapter) GetSummary() state.SummaryStats {
	if store := a.getStore(); store != nil {
		return store.GetSummary()
	}
	return state.SummaryStats{}
}

func (a *StateReaderAdapter) GetFiltered() []state.ForwardSnapshot {
	if store := a.getStore(); store != nil {
		return store.GetFiltered()
	}
	return nil
}

func (a *StateReaderAdapter) GetForward(key string) *state.ForwardSnapshot {
	if store := a.getStore(); store != nil {
		return store.GetForward(key)
	}
	return nil
}

func (a *StateReaderAdapter) GetLogs(count int) []state.LogEntry {
	if store := a.getStore(); store != nil {
		return store.GetLogs(count)
	}
	return nil
}

func (a *StateReaderAdapter) Count() int {
	if store := a.getStore(); store != nil {
		return store.Count()
	}
	return 0
}

func (a *StateReaderAdapter) ServiceCount() int {
	if store := a.getStore(); store != nil {
		return store.ServiceCount()
	}
	return 0
}

// MetricsProviderAdapter adapts fwdmetrics.Registry to the MetricsProvider interface
type MetricsProviderAdapter struct {
	registry *fwdmetrics.Registry
}

// NewMetricsProviderAdapter creates a new MetricsProviderAdapter
func NewMetricsProviderAdapter(registry *fwdmetrics.Registry) *MetricsProviderAdapter {
	return &MetricsProviderAdapter{registry: registry}
}

func (a *MetricsProviderAdapter) GetAllSnapshots() []fwdmetrics.ServiceSnapshot {
	if a.registry != nil {
		return a.registry.GetAllSnapshots()
	}
	return nil
}

func (a *MetricsProviderAdapter) GetServiceSnapshot(key string) *fwdmetrics.ServiceSnapshot {
	if a.registry != nil {
		return a.registry.GetServiceSnapshot(key)
	}
	return nil
}

func (a *MetricsProviderAdapter) GetTotals() (bytesIn, bytesOut uint64, rateIn, rateOut float64) {
	if a.registry != nil {
		return a.registry.GetTotals()
	}
	return 0, 0, 0, 0
}

func (a *MetricsProviderAdapter) ServiceCount() int {
	if a.registry != nil {
		return a.registry.ServiceCount()
	}
	return 0
}

func (a *MetricsProviderAdapter) PortForwardCount() int {
	if a.registry != nil {
		return a.registry.PortForwardCount()
	}
	return 0
}

// ServiceControllerAdapter adapts fwdsvcregistry to the ServiceController interface
type ServiceControllerAdapter struct {
	getStore func() *state.Store
}

// NewServiceControllerAdapter creates a new ServiceControllerAdapter
func NewServiceControllerAdapter(getStore func() *state.Store) *ServiceControllerAdapter {
	return &ServiceControllerAdapter{getStore: getStore}
}

func (a *ServiceControllerAdapter) Reconnect(key string) error {
	svc := fwdsvcregistry.Get(key)
	if svc == nil {
		return fmt.Errorf("service not found: %s", key)
	}
	go svc.ForceReconnect()
	return nil
}

func (a *ServiceControllerAdapter) ReconnectAll() int {
	store := a.getStore()
	if store == nil {
		return 0
	}

	forwards := store.GetFiltered()

	// Collect unique registry keys with errors
	erroredServices := make(map[string]bool)
	for _, fwd := range forwards {
		if fwd.Status == state.StatusError {
			key := fwd.RegistryKey
			if key == "" {
				key = fwd.ServiceKey
			}
			erroredServices[key] = true
		}
	}

	// Trigger reconnection for each errored service
	count := 0
	for registryKey := range erroredServices {
		if svcfwd := fwdsvcregistry.Get(registryKey); svcfwd != nil {
			go svcfwd.ForceReconnect()
			count++
		}
	}

	return count
}

func (a *ServiceControllerAdapter) Sync(key string, force bool) error {
	svc := fwdsvcregistry.Get(key)
	if svc == nil {
		return fmt.Errorf("service not found: %s", key)
	}
	go svc.SyncPodForwards(force)
	return nil
}

// EventStreamerAdapter adapts events.Bus to the EventStreamer interface
type EventStreamerAdapter struct {
	getEventBus func() *events.Bus
	subscribers map[<-chan events.Event]func()
	mu          sync.Mutex
}

// NewEventStreamerAdapter creates a new EventStreamerAdapter
func NewEventStreamerAdapter(getEventBus func() *events.Bus) *EventStreamerAdapter {
	return &EventStreamerAdapter{
		getEventBus: getEventBus,
		subscribers: make(map[<-chan events.Event]func()),
	}
}

func (a *EventStreamerAdapter) Subscribe() (<-chan events.Event, func()) {
	bus := a.getEventBus()
	if bus == nil {
		// Return a closed channel if bus is not available
		ch := make(chan events.Event)
		close(ch)
		return ch, func() {}
	}

	ch := make(chan events.Event, 100)

	// Subscribe to all events from the bus
	bus.SubscribeAll(func(e events.Event) {
		select {
		case ch <- e:
		default:
			// Buffer full, drop event
		}
	})

	a.mu.Lock()
	cancel := func() {
		a.mu.Lock()
		delete(a.subscribers, ch)
		a.mu.Unlock()
		close(ch)
	}
	a.subscribers[ch] = cancel
	a.mu.Unlock()

	return ch, cancel
}

func (a *EventStreamerAdapter) SubscribeType(eventType events.EventType) (<-chan events.Event, func()) {
	bus := a.getEventBus()
	if bus == nil {
		// Return a closed channel if bus is not available
		ch := make(chan events.Event)
		close(ch)
		return ch, func() {}
	}

	ch := make(chan events.Event, 100)

	// Subscribe to specific event type
	bus.Subscribe(eventType, func(e events.Event) {
		select {
		case ch <- e:
		default:
			// Buffer full, drop event
		}
	})

	a.mu.Lock()
	cancel := func() {
		a.mu.Lock()
		delete(a.subscribers, ch)
		a.mu.Unlock()
		close(ch)
	}
	a.subscribers[ch] = cancel
	a.mu.Unlock()

	return ch, cancel
}

// DiagnosticsProviderAdapter provides diagnostic information
type DiagnosticsProviderAdapter struct {
	getStore   func() *state.Store
	getManager func() types.ManagerInfo
}

// NewDiagnosticsProviderAdapter creates a new DiagnosticsProviderAdapter
func NewDiagnosticsProviderAdapter(getStore func() *state.Store, getManager func() types.ManagerInfo) *DiagnosticsProviderAdapter {
	return &DiagnosticsProviderAdapter{
		getStore:   getStore,
		getManager: getManager,
	}
}

func (a *DiagnosticsProviderAdapter) GetSummary() types.DiagnosticSummary {
	store := a.getStore()
	if store == nil {
		return types.DiagnosticSummary{
			Status:    "unknown",
			Timestamp: time.Now(),
		}
	}

	summary := store.GetSummary()
	services := store.GetServices()

	// Calculate service counts by status
	var active, errored, partial, pending int
	for _, svc := range services {
		switch {
		case svc.ActiveCount > 0 && svc.ErrorCount == 0:
			active++
		case svc.ErrorCount > 0 && svc.ActiveCount == 0:
			errored++
		case svc.ErrorCount > 0 && svc.ActiveCount > 0:
			partial++
		default:
			pending++
		}
	}

	// Determine overall status
	status := "healthy"
	if summary.ErrorCount > 0 {
		status = "degraded"
		if summary.ErrorCount > summary.ActiveServices {
			status = "unhealthy"
		}
	}

	uptime := ""
	version := ""
	if manager := a.getManager(); manager != nil {
		uptime = manager.Uptime().String()
		version = manager.Version()
	}

	// Collect current errors
	errors := a.GetErrors(10)

	// Generate recommendations
	var recommendations []string
	if errored > 0 {
		recommendations = append(recommendations, fmt.Sprintf("Reconnect %d services in error state", errored))
	}
	if partial > 0 {
		recommendations = append(recommendations, fmt.Sprintf("Investigate %d services with partial availability", partial))
	}

	return types.DiagnosticSummary{
		Status:    status,
		Timestamp: time.Now(),
		Uptime:    uptime,
		Version:   version,
		Services: types.ServicesSummaryDiag{
			Total:   summary.TotalServices,
			Active:  active,
			Error:   errored,
			Partial: partial,
			Pending: pending,
		},
		Network:         a.GetNetworkStatus(),
		Errors:          errors,
		Recommendations: recommendations,
	}
}

func (a *DiagnosticsProviderAdapter) GetServiceDiagnostic(key string) (*types.ServiceDiagnostic, error) {
	store := a.getStore()
	if store == nil {
		return nil, fmt.Errorf("state not available")
	}

	svc := store.GetService(key)
	if svc == nil {
		return nil, fmt.Errorf("service not found: %s", key)
	}

	// Calculate status
	var status string
	switch {
	case svc.ActiveCount > 0 && svc.ErrorCount == 0:
		status = "active"
	case svc.ErrorCount > 0 && svc.ActiveCount == 0:
		status = "error"
	case svc.ErrorCount > 0 && svc.ActiveCount > 0:
		status = "partial"
	default:
		status = "pending"
	}

	// Get reconnect state from registry
	reconnectState := types.ReconnectState{}
	syncState := types.SyncState{}
	if svcFwd := fwdsvcregistry.Get(key); svcFwd != nil {
		// Try to get reconnect state (if the method exists)
		reconnectState.AutoReconnectEnabled = true // Assume enabled if TUI is active
	}

	// Build forward diagnostics
	forwards := make([]types.ForwardDiagnostic, len(svc.PortForwards))
	for i, fwd := range svc.PortForwards {
		fwdDiag, _ := a.buildForwardDiagnostic(&fwd)
		forwards[i] = fwdDiag
	}

	// Collect error history from forwards
	var errorHistory []types.ErrorDetail
	for _, fwd := range svc.PortForwards {
		if fwd.Error != "" {
			errorHistory = append(errorHistory, types.ErrorDetail{
				Timestamp:   time.Now(),
				Component:   "connection",
		
```

### Core Architecture Module: `pkg/fwdapi/handlers/analyze.go`
```
package handlers

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/txn2/kubefwd/pkg/fwdapi/types"
	"github.com/txn2/kubefwd/pkg/fwdtui/state"
)

// AnalyzeHandler handles AI-optimized analysis endpoints
type AnalyzeHandler struct {
	stateReader    types.StateReader
	diagnostics    types.DiagnosticsProvider
	getManagerInfo func() types.ManagerInfo
}

// NewAnalyzeHandler creates a new analyze handler
func NewAnalyzeHandler(stateReader types.StateReader, diagnostics types.DiagnosticsProvider, getManagerInfo func() types.ManagerInfo) *AnalyzeHandler {
	return &AnalyzeHandler{
		stateReader:    stateReader,
		diagnostics:    diagnostics,
		getManagerInfo: getManagerInfo,
	}
}

// StatusResponse is a quick AI-friendly status
type StatusResponse struct {
	Status     string `json:"status"`     // "ok", "issues", "error"
	Message    string `json:"message"`    // Human-readable summary
	ErrorCount int    `json:"errorCount"` // Number of current errors
	Uptime     string `json:"uptime,omitempty"`
}

// Status returns a quick status for AI consumption
// GET /v1/status
func (h *AnalyzeHandler) Status(c *gin.Context) {
	if h.stateReader == nil {
		c.JSON(http.StatusServiceUnavailable, types.Response{
			Success: false,
			Error: &types.ErrorInfo{
				Code:    "NOT_READY",
				Message: "State reader not available",
			},
		})
		return
	}

	summary := h.stateReader.GetSummary()

	status := "ok"
	var message string

	switch {
	case summary.ErrorCount == 0 && summary.ActiveServices > 0:
		message = fmt.Sprintf("All %d services healthy, %d active forwards",
			summary.ActiveServices, summary.ActiveForwards)
	case summary.ErrorCount > 0 && summary.ActiveServices > summary.ErrorCount:
		status = "issues"
		message = fmt.Sprintf("%d of %d services have issues, %d errors",
			summary.ErrorCount, summary.TotalServices, summary.ErrorCount)
	case summary.ErrorCount > 0:
		status = "error"
		message = fmt.Sprintf("%d services with errors, only %d active",
			summary.ErrorCount, summary.ActiveServices)
	default:
		message = "No services currently forwarded"
	}

	uptime := ""
	if h.getManagerInfo != nil {
		if mgr := h.getManagerInfo(); mgr != nil {
			uptime = mgr.Uptime().Round(time.Second).String()
		}
	}

	response := StatusResponse{
		Status:     status,
		Message:    message,
		ErrorCount: summary.ErrorCount,
		Uptime:     uptime,
	}

	c.JSON(http.StatusOK, types.Response{
		Success: true,
		Data:    response,
		Meta: &types.MetaInfo{
			Timestamp: time.Now(),
		},
	})
}

// AnalysisResponse provides full analysis for AI
type AnalysisResponse struct {
	Status           string             `json:"status"`
	Summary          string             `json:"summary"`
	Issues           []Issue            `json:"issues,omitempty"`
	Recommendations  []Recommendation   `json:"recommendations,omitempty"`
	SuggestedActions []ActionSuggestion `json:"suggestedActions,omitempty"`
	Stats            AnalysisStats      `json:"stats"`
}

// Issue represents a detected problem
type Issue struct {
	Severity   string `json:"severity"`  // "critical", "high", "medium", "low"
	Component  string `json:"component"` // "service", "forward", "network"
	ServiceKey string `json:"serviceKey,omitempty"`
	PodName    string `json:"podName,omitempty"`
	Message    string `json:"message"`
	ErrorType  string `json:"errorType,omitempty"`
}

// Recommendation provides actionable advice
type Recommendation struct {
	Priority string `json:"priority"` // "high", "medium", "low"
	Category string `json:"category"` // "performance", "reliability", "configuration"
	Message  string `json:"message"`
}

// ActionSuggestion provides API actions to fix issues
type ActionSuggestion struct {
	Action   string `json:"action"` // "reconnect", "sync", "reconnect_all"
	Target   string `json:"target"` // service key or "all"
	Reason   string `json:"reason"`
	Endpoint string `json:"endpoint"` // POST /v1/services/:key/reconnect
	Method   string `json:"method"`   // POST
}

// AnalysisStats provides statistics
type AnalysisStats struct {
	TotalServices   int    `json:"totalServices"`
	ActiveServices  int    `json:"activeServices"`
	ErroredServices int    `json:"erroredServices"`
	TotalForwards   int    `json:"totalForwards"`
	ActiveForwards  int    `json:"activeForwards"`
	TotalBytesIn    uint64 `json:"totalBytesIn"`
	TotalBytesOut   uint64 `json:"totalBytesOut"`
	Uptime          string `json:"uptime,omitempty"`
}

// errorClassification holds error type and severity
type errorClassification struct {
	errorType string
	severity  string
}

// classifyError classifies an error message into type and severity
func classifyError(errMsg string) errorClassification {
	errLower := strings.ToLower(errMsg)
	switch {
	case strings.Contains(errLower, "connection refused"):
		return errorClassification{"connection_refused", "high"}
	case strings.Contains(errLower, "timeout"):
		return errorClassification{"timeout", "high"}
	case strings.Contains(errLower, "not found"):
		return errorClassification{"pod_not_found", "critical"}
	case strings.Contains(errLower, "broken pipe"):
		return errorClassification{"broken_pipe", "high"}
	default:
		return errorClassification{"unknown", "high"}
	}
}

// buildIssues collects issues from services
func (h *AnalyzeHandler) buildIssues(services []state.ServiceSnapshot) ([]Issue, []string, map[string]int) {
	var issues []Issue
	var erroredServiceKeys []string
	errorTypes := make(map[string]int)

	for _, svc := range services {
		if svc.ErrorCount == 0 {
			continue
		}
		erroredServiceKeys = append(erroredServiceKeys, svc.Key)
		for _, fwd := range svc.PortForwards {
			if fwd.Error == "" {
				continue
			}
			class := classifyError(fwd.Error)
			errorTypes[class.errorType]++
			issues = append(issues, Issue{
				Severity:   class.severity,
				Component:  "forward",
				ServiceKey: svc.Key,
				PodName:    fwd.PodName,
				Message:    fwd.Error,
				ErrorType:  class.errorType,
			})
		}
	}
	return issues, erroredServiceKeys, errorTypes
}

// buildRecommendations generates recommendations based on error analysis
func buildRecommendations(erroredCount int, errorTypes map[string]int, noTraffic bool) []Recommendation {
	var recs []Recommendation

	if erroredCount > 3 {
		recs = append(recs, Recommendation{
			Priority: "high",
			Category: "reliability",
			Message:  fmt.Sprintf("Multiple services (%d) have errors. Consider using reconnect_all to attempt bulk recovery.", erroredCount),
		})
	}
	if errorTypes["pod_not_found"] > 0 {
		recs = append(recs, Recommendation{
			Priority: "high",
			Category: "reliability",
			Message:  "Some pods are missing. Use sync to rediscover pods or check if deployments are healthy.",
		})
	}
	if errorTypes["connection_refused"] > 0 {
		recs = append(recs, Recommendation{
			Priority: "medium",
			Category: "reliability",
			Message:  "Connection refused errors indicate pods may not be ready. Check readiness probes and pod logs.",
		})
	}
	if errorTypes["timeout"] > 0 {
		recs = append(recs, Recommendation{
			Priority: "medium",
			Category: "configuration",
			Message:  "Timeout errors may indicate network policies blocking traffic. Review network policies.",
		})
	}
	if noTraffic {
		recs = append(recs, Recommendation{
			Priority: "low",
			Category: "performance",
			Message:  "No traffic detected. Verify applications are sending requests through forwarded services.",
		})
	}
	return recs
}

// buildActions generates suggested actions based on issues
func buildActions(erroredServiceKeys []string, issues []Issue) []ActionSuggestion {
	var actions []ActionSuggestion

	if len(erroredServiceKeys) > 5 {
		actions = append(actions, ActionSuggestion{
			Action:   "reconnect_all",
			Target:   "all",
			Reason:   fmt.Sprintf("Bulk reconnect %d errored services", len(erroredServiceKeys)),
			Endpoint: "/v1/services/reconnect",
			Method:   "POST",
		})
	} else {
		for _, key := range erroredServiceKeys {
			actions = append(actions, ActionSuggestion{
				Action:   "reconnect",
				Target:   key,
				Reason:   "Service has errors, attempt reconnection",
				Endpoint: fmt.Sprintf("/v1/services/%s/reconnect", key),
				Method:   "POST",
			})
		}
	}

	for _, issue := range issues {
		if issue.ErrorType == "pod_not_found" {
			actions = append(actions, ActionSuggestion{
				Action:   "sync",
				Target:   issue.ServiceKey,
				Reason:   "Pod not found, sync to rediscover pods",
				Endpoint: fmt.Sprintf("/v1/services/%s/sync", issue.ServiceKey),
				Method:   "POST",
			})
			break
		}
	}

	if len(actions) > 10 {
		return actions[:10]
	}
	return actions
}

// determineStatus returns the overall health status
func determineStatus(summary state.SummaryStats) string {
	if summary.ErrorCount == 0 {
		return "healthy"
	}
	if summary.ErrorCount > summary.ActiveServices {
		return "unhealthy"
	}
	return "degraded"
}

// buildSummaryMessage creates a human-readable summary
func buildSummaryMessage(summary state.SummaryStats) string {
	var parts []string
	if summary.ActiveServices > 0 {
		parts = append(parts, fmt.Sprintf("%d active services", summary.ActiveServices))
	}
	if summary.ErrorCount > 0 {
		parts = append(parts, fmt.Sprintf("%d errors", summary.ErrorCount))
	}
	if len(parts) == 0 {
		return "No services currently forwarded"
	}
	return strings.Join(parts, ", ")
}

// getUptime retrieves the uptime string from manager info
func (h *AnalyzeHandler) getUptime() string {
	if h.getManagerInfo == nil {
		return ""
	}
	if mgr := h.getManagerInfo(); mgr != nil {
		return mgr.Uptime().Round(time.Second).String()
	}
	return ""
}

// Analyze returns full analysis for AI consumption
// GET /v1/analyze
func (h *AnalyzeHandler) Analyze(c *gin.Context) {
	if h.stateReader == nil {
		c.JSON(http.StatusServiceUnavailable, types.Response{
			Success: false,
			Error: &types.ErrorInfo{
				Code:    "NOT_READY",
				Message: "State reader not available",
			},
		})
		return
	}

	summary := h.stateReader.GetSummary()
	services := h.
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #509** (2026-05-29): **Auto-reconnect leaves multi-port services in unrecoverable zombie state after TCP RST**
  *Symptoms*: ### kubefwd version  1.25.14  ### Kubernetes version  Client: v1.34.2, Server: Client: v1.34.2  ### Operating System  macOS (Apple Silicon)  ### Bug Description  **Expected behavior:**   When a port-forwarded service experiences a TCP RST on one of its ports (e.g., due to [kubernetes/kubernetes#111825](https://github.com/kubernetes/kubernetes/issues/111825) in kubectl 1.23.6+), kubefwd's auto-reconnect (`-a`) should re-establish forwards for all of the service's ports, restore `/etc/hosts` entries, and return the service to a healthy, traffic-flowing state — without requiring a kubefwd process restart.   **Actual behavior:**   Multi-port services enter an **unrecoverable zombie state** after one port's connection is reset. Specifically:   1. RST on one port causes the underlying kubelet port-forward listener to die (upstream bug [kubernetes/kubernetes#111825](https://github.com/kubernetes/kubernetes/issues/111825), still unfixed in client v1.34.2). 2. The corresponding goroutine in `LoopPodsToForward` logs `PortForward error ... lost connection to pod` and cleans up only its own entry from the `PortForwards` map. The other port's entry remains. 3. All `/etc/hosts` entries for the service are removed by the per-port disconnect cleanup (12 hostname variants in my case). 4. `scheduleReconnect` fires, waits the backoff, calls `SyncPodForwards(true)` — logs show `currentForwards=1, Found 1 eligible pods`. 5. `LoopPodsToForward` skips creating new forwards because of the stale map 

- **Issue #390** (2026-02-04): **Connecting to Wireguard DNS is broken since 1.23.0**
  *Symptoms*: ### kubefwd version  1.25.9  ### Kubernetes version  Client Version: v1.34.1 Kustomize Version: v5.7.1 Server Version: v1.34.3+k3s1  ### Operating System  Windows  ### Bug Description  My Kubernetes Cluster is behind a Wireguard VPN with a custom DNS configured in the Wireguard config. On Version 1.22.4, everything is working as expected.   After upgrading to any version past that (1.23.0+), I can no longer connect to my cluster. I would assume this project started doing some DNS server gymnastics instead of looking up naming properly like any other software does.  The error message shows the IP of my normal DNS server (that's listed under my normal network interface) (10.251.137.88:53) instead of the WireGuard one, so I think that should confirm my theory.   Tools like kubectl work just fine.  ### Steps to Reproduce  - Be on Windows - Have Wireguard VPN connected with a custom DNS server configured - Try to connect - Fail.  ### Verbose Logs  ```shell kubefwd svc -n redacted-dev -v INFO[14:16:16]  _          _           __             _ INFO[14:16:16] | | ___   _| |__   ___ / _|_      ____| | INFO[14:16:16] | |/ / | | | '_ \ / _ \ |_\ \ /\ / / _  | INFO[14:16:16] |   <| |_| | |_) |  __/  _|\ V  V / (_| | INFO[14:16:16] |_|\_\\__,_|_.__/ \___|_|   \_/\_/ \__,_| INFO[14:16:16] INFO[14:16:16] Version 1.25.9 INFO[14:16:16] https://kubefwd.com INFO[14:16:16] INFO[14:16:16] Press [Ctrl-C] to stop forwarding. INFO[14:16:16] 'cat C:\Windows\System32\drivers\etc\hosts' to see all host
  **Post-Mortem & Fix Analysis**:
  > Just saw that 1.23.0 disabled CGO, I think that might be the problem
  > Building a binary with: set CGO_ENABLED=1 go build -o kubefwd.exe ./cmd/kubefwd/kubefwd.go  works again
  > @davidmayr,   Good catch on the CGO connection. However, a few clarifications, kubefwd doesn't do DNS lookups for the services it forwards, it writes `/etc/hosts` entries, that's its central feature.   > I would assume this project started doing some DNS server gymnastics instead of looking up naming properly like any other software does.  The DNS lookup in your error is the Kubernetes client library resolving your cluster's API server hostname. So this affects connecting to the cluster, not the service forwarding.  You're right that CGO is the factor, but I've been building with `CGO_ENABLED=0` since 2020 for static binaries.  **What changed in v1.23.0 was the Go version from 1.18 to 1.24.**  Go's pure-Go DNS resolver (used when CGO is disabled) behaves differently in newer versions on Windows. It doesn't respect per-adapter DNS settings like VPN-specific DNS servers. It takes a simplified lookup path that bypasses Windows DNS routing rules.  Another quick workaround is to use the IP 

- **Issue #325** (2025-12-28): **kubefwd_checksums.txt.pem asset missing**
  *Symptoms*: ### kubefwd version  N/A  ### Kubernetes version  N/A  ### Operating System  Linux (Ubuntu/Debian)  ### Bug Description  From https://github.com/txn2/kubefwd/releases/tag/v1.24.0  > All release checksums are now signed using Cosign with keyless signing (OIDC identity). Users can verify downloads: > ``` >cosign verify-blob --signature kubefwd_checksums.txt.sig \ >  --certificate kubefwd_checksums.txt.pem \ >  --certificate-oidc-issuer https://token.actions.githubusercontent.com \ >  --certificate-identity-regexp 'https://github.com/txn2/kubefwd/.*' \ >  kubefwd_checksums.txt >```  I'm not sure where to find `kubefwd_checksums.txt.pem` though, it is not in release assets. The .sig is there.  ### Steps to Reproduce  https://github.com/txn2/kubefwd/releases/tag/v1.24.0  ### Verbose Logs  ```shell  ```  ### Configuration  ```yaml  ```  ### Checklist  - [x] I have searched existing issues to ensure this bug hasn't already been reported - [ ] I am running kubefwd with `sudo -E` to preserve environment variables
  **Post-Mortem & Fix Analysis**:
  > @scop thanks! Fixed and released https://github.com/txn2/kubefwd/releases/tag/v1.24.1

- **Issue #278** (2025-12-20): **Panic: index out of range**
  *Symptoms*: Hi! I got an unusual error today: ``` ... INFO[18:23:30] Port-Forward:      127.1.28.46 kafka-cluster-kafka-external-bootstrap.project-staging:9094 to pod kafka-cluster-kafka-0:9094 panic: runtime error: index out of range [116] with length 116  goroutine 494 [running]: github.com/txn2/txeh.(*Hosts).AddHost(0x14000695950, {0x140003f8f10, 0xa}, {0x140002dec80?, 0x140005e9b48?})  github.com/txn2/txeh@v1.3.0/txeh.go:235 +0x500 github.com/txn2/kubefwd/pkg/fwdport.(*PortForwardOpts).addHost(0x140005f5080, {0x140002dec80, 0x40})  github.com/txn2/kubefwd/pkg/fwdport/fwdport.go:252 +0x11c github.com/txn2/kubefwd/pkg/fwdport.(*PortForwardOpts).addHost(0x140005f5080, {0x140002dea00, 0x40})  github.com/txn2/kubefwd/pkg/fwdport/fwdport.go:256 +0x164 github.com/txn2/kubefwd/pkg/fwdport.(*PortForwardOpts).AddHosts(0x140005f5080)  github.com/txn2/kubefwd/pkg/fwdport/fwdport.go:306 +0x2ac github.com/txn2/kubefwd/pkg/fwdport.(*PortForwardOpts).PortForward(0x140005f5080)  github.com/txn2/kubefwd/pkg/fwdport/fwdport.go:160 +0x284 github.com/txn2/kubefwd/pkg/fwdservice.(*ServiceFWD).LoopPodsToForward.func1()  github.com/txn2/kubefwd/pkg/fwdservice/fwdservice.go:333 +0x38 created by github.com/txn2/kubefwd/pkg/fwdservice.(*ServiceFWD).LoopPodsToForward  github.com/txn2/kubefwd/pkg/fwdservice/fwdservice.go:331 +0xb14 ```  OS: ``` ProductName: macOS ProductVersion: 12.3 BuildVersion: 21E230 ```  `kubefwd version`: ``` ... INFO[19:04:36] Version 1.22.5 INFO[19:04:36
  **Post-Mortem & Fix Analysis**:
  > Show u are kube.yaml and some yaml configuation . 
  > This panic is occurring in the `txeh` library (v1.3.0) which kubefwd uses for hosts file management. kubefwd is currently using an outdated version of txeh from 2019.  Several bug fixes have been made to txeh since then, including fixes for parsing edge cases that likely cause this panic.  The fix is to update the txeh dependency from v1.3.0 to v1.5.4. I'll include this in an upcoming release.
  > Fixed in 5ee69c14737bb33d073e9ac74c586d80e3b51fb9 - upgraded txeh from v1.3.0 to v1.7.0 which includes the fix for this index out of range panic in AddHost.

- **Issue #213** (2025-12-19): **SIGSEGV when kubefwd is provided with malformed reserve parameter**
  *Symptoms*: When using the `-r` command line option, kubefwd will SIGSEGV if the reserve string is malformed - specifically if a parameter is provided, but the colon is omitted. It fails gracefully if the parameter is not provided, or if it is provided, but with an invalid ip address.   Reproduce with: `kubefwd svc -r foo`  ``` INFO[18:28:52]  _          _           __             _ INFO[18:28:52] | | ___   _| |__   ___ / _|_      ____| | INFO[18:28:52] | |/ / | | | '_ \ / _ \ |_\ \ /\ / / _  | INFO[18:28:52] |   <| |_| | |_) |  __/  _|\ V  V / (_| | INFO[18:28:52] |_|\_\\__,_|_.__/ \___|_|   \_/\_/ \__,_| INFO[18:28:52] INFO[18:28:52] Version 1.22.0 INFO[18:28:52] https://github.com/txn2/kubefwd INFO[18:28:52] INFO[18:28:52] Press [Ctrl-C] to stop forwarding. INFO[18:28:52] 'cat /etc/hosts' to see all host entries. INFO[18:28:52] Loaded hosts file /etc/hosts INFO[18:28:52] HostFile management: Original hosts backup already exists at /Users/<snip>/hosts.original INFO[18:28:52] Using namespace <...snip> from current context <...snip>. INFO[18:28:52] Successfully connected context: <...snip> panic: runtime error: invalid memory address or nil pointer dereference [signal SIGSEGV: segmentation violation code=0x1 addr=0x10 pc=0x1dbb177]  goroutine 97 [running]: github.com/txn2/kubefwd/pkg/fwdIp.blockNonLoopbackIPs(0x2c894c0) 	github.com/txn2/kubefwd/pkg/fwdIp/fwdIp.go:197 +0x97 github.com/txn2/kubefwd/pkg/fwdIp.validateForwardConfiguration(0x1f27880) 	github.com/tx
  **Post-Mortem & Fix Analysis**:
  > @mccaig looks like it needs a little more validation. Thanks for the report
  > Fixed in v1.23.0. This release includes improved error handling throughout the codebase:  - Invalid reservation formats now log a warning instead of crashing - Replaced `panic()` and `os.Exit()` calls with proper error returns - Added bounds checking for IP allocation  Malformed `-r` parameters will now fail gracefully with a helpful error message.  See release notes: https://github.com/txn2/kubefwd/releases/tag/v1.23.0

- **Issue #155** (2020-11-07): **`standard_init_linux.go:211: exec**
  *Symptoms*: Hi,  I'm getting  `standard_init_linux.go:211: exec user process caused "no such file or directory"`  trying to run `txn2/kubefwd`  what am I missing? 

- **Issue #136** (2020-09-02): **Problem using multiple clusters/contexts**
  *Symptoms*: When connecting to two clusters, e.g.  ``` sudo kubefwd services \        -n elasticsearch \        -n kubernetes-dashboard \        -n kube-system \        -n prometheus \        -l "k8s-app in (alertmanager,elasticsearch,grafana,kibana,kubernetes-dashboard,prometheus)" \        -x "staging" \        -x "production" ```  It seems to be assigning the same domain suffix to both contexts, and then failing to listen on the ports due to conflicts with itself:  ``` INFO[23:37:10]  _          _           __             _      INFO[23:37:10] | | ___   _| |__   ___ / _|_      ____| |     INFO[23:37:10] | |/ / | | | '_ \ / _ \ |_\ \ /\ / / _  |     INFO[23:37:10] |   <| |_| | |_) |  __/  _|\ V  V / (_| |     INFO[23:37:10] |_|\_\\__,_|_.__/ \___|_|   \_/\_/ \__,_|     INFO[23:37:10]                                               INFO[23:37:10] Version 1.14.0                                INFO[23:37:10] https://github.com/txn2/kubefwd               INFO[23:37:10]                                               INFO[23:37:10] Press [Ctrl-C] to stop forwarding.            INFO[23:37:10] 'cat /etc/hosts' to see all host entries.     INFO[23:37:10] Loaded hosts file /etc/hosts                  INFO[23:37:10] Hostfile management: Original hosts backup already exists at /home/ubuntu/hosts.original  INFO[23:37:10] Succesfully connected context: staging  INFO[23:37:10] Namespaces to forward: [elasticsearch formative kubernetes-dashboard kube-system prometheus yugaby
  **Post-Mortem & Fix Analysis**:
  > This feature broke after 1.7.4. I'll try to get fix in for a new release next month. 

- **Issue #133** (2020-10-27): **headless svc forwarding behaviour changed for sts with single pod**
  *Symptoms*: We noticed that kubefwd 14.x behaves differently for forwarding headless services forwarding to a single sts container  ``` apiVersion: v1 kind: Service metadata:   name: kafka-headless-svc spec:   ports:     - port: 9092       name: broker   clusterIP: None   selector:     app: kafka-sts ```  ``` apiVersion: apps/v1beta1 kind: StatefulSet metadata:   name: kafka-sts   labels:     app: kafka-sts spec:   serviceName: kafka-headless-svc   podManagementPolicy: OrderedReady   replicas: 1   updateStrategy:     type: RollingUpdate   template:     metadata:       labels:         app: kafka-sts     spec:       containers:       - name: kafka-sts         image: "confluentinc/cp-kafka:5.0.1"         imagePullPolicy: "IfNotPresent"         ports:         - containerPort: 9092           name: kafka                 env:         - name: POD_IP           valueFrom:             fieldRef:               fieldPath: status.podIP         - name: HOST_IP           valueFrom:             fieldRef:               fieldPath: status.hostIP         - name: "KAFKA_LISTENER_SECURITY_PROTOCOL_MAP"           value: "PLAINTEXT:PLAINTEXT,EXTERNAL:PLAINTEXT"             command:         - sh         - -exc         - |           export KAFKA_BROKER_ID=${HOSTNAME##*-}            export KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://kafka-sts-${HOSTNAME##*-}.kafka-headless-svc:9092,EXTERNAL://${HOST_IP}:$((31090 + ${KAFKA_BROKER_ID})) && \           exec /etc/conf
  **Post-Mortem & Fix Analysis**:
  > This is a bug introduced in 1.14. The last few contributions have caused some issues I need to unwind. I am scheduling some time to work on this in the next two weeks.   Thank you for raising this issue.
  > fix in #134  @onmomo 
  > @calmkart @cjimti thanks a lot and keep it up!

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

### Incident Patch 1: `10533ebd` (2026-07-27)
**Commit Message**: security: bump x/text, x/net, x/crypto to clear remaining vulnerabilities (#563)

Follow-up to #560. Merging that PR completed the integration module's
go.sum, which had been a one-line stub. Dependabot could then see the
module's real transitive graph for the first time and raised 13 alerts
for golang.org/x/crypto v0.51.0 (patched in 0.52.0). The vulnerabilities
predated #560; the stub go.sum was hiding them from every scanner.

Root module:
  golang.org/x/text  v0.37.0 -> v0.39.0  (GO-2026-5970)
  golang.org/x/net   v0.55.0 -> v0.56.0  (GO-2026-5942)
  golang.org/x/crypto v0.52.0 -> v0.53.0
  golang.org/x/term  v0.43.0 -> v0.44.0  (pulled in by the above)

GO-2026-5970 is the only vulnerability in this cleanup that was actually
reachable from production code. govulncheck traced it to:

  pkg/fwdmcp/httpclient.go:156:26: fwdmcp.HTTPClient.Delete calls
  http.Client.Do, which eventually calls norm.Form.Bytes

Neither Dependabot nor the earlier docker/docker alerts surfaced it; it
came from the OSSF Scorecard code-scanning alert's vulnerability list.

test/integration module:
  golang.org/x/crypto v0.51.0 -> v0.53.0
  golang.org/x/sys    v0.45.0 -> v0.46.0

GO-2026-5932 (golang.org/

**File**: `go.mod` (modified, +4/-4)
```diff
@@ -102,12 +102,12 @@ require (
 	go.yaml.in/yaml/v2 v2.4.3 // indirect
 	go.yaml.in/yaml/v3 v3.0.4 // indirect
 	golang.org/x/arch v0.22.0 // indirect
-	golang.org/x/crypto v0.52.0 // indirect
-	golang.org/x/net v0.55.0 // indirect
+	golang.org/x/crypto v0.53.0 // indirect
+	golang.org/x/net v0.56.0 // indirect
 	golang.org/x/oauth2 v0.35.0 // indirect
 	golang.org/x/sync v0.21.0 // indirect
-	golang.org/x/term v0.43.0 // indirect
-	golang.org/x/text v0.37.0 // indirect
+	golang.org/x/term v0.44.0 // indirect
+	golang.org/x/text v0.39.0 // indirect
 	golang.org/x/time v0.14.0 // indirect
 	google.golang.org/protobuf v1.36.12-0.20260120151049-f2248ac996af // indirect
 	gopkg.in/evanphx/json-patch.v4 v4.13.0 // indirect
```

**File**: `go.sum` (modified, +12/-12)
```diff
@@ -236,14 +236,14 @@ go.yaml.in/yaml/v3 v3.0.4 h1:tfq32ie2Jv2UxXFdLJdh3jXuOzWiL1fo0bu/FbuKpbc=
 go.yaml.in/yaml/v3 v3.0.4/go.mod h1:DhzuOOF2ATzADvBadXxruRBLzYTpT36CKvDb3+aBEFg=
 golang.org/x/arch v0.22.0 h1:c/Zle32i5ttqRXjdLyyHZESLD/bB90DCU1g9l/0YBDI=
 golang.org/x/arch v0.22.0/go.mod h1:dNHoOeKiyja7GTvF9NJS1l3Z2yntpQNzgrjh1cU103A=
-golang.org/x/crypto v0.52.0 h1:RMs7fP2rXdep0CftQlK8Uf+kibLm7qkCcradZWYz988=
-golang.org/x/crypto v0.52.0/go.mod h1:1QgfPxDqh0T2M/elOJtp9RvuR95kVjir0e6/BvEmGbc=
+golang.org/x/crypto v0.53.0 h1:QZ4Muo8THX6CizN2vPPd5fBGHyogrdK9fG4wLPFUsto=
+golang.org/x/crypto v0.53.0/go.mod h1:DNLU434OwVakk9PzuwV8w62mAJpRJL3vsgcfp4Qnsio=
 golang.org/x/exp v0.0.0-20231006140011-7918f672742d h1:jtJma62tbqLibJ5sFQz8bKtEM8rJBtfilJ2qTU199MI=
 golang.org/x/exp v0.0.0-20231006140011-7918f672742d/go.mod h1:ldy0pHrwJyGW56pPQzzkH36rKxoZW1tw7ZJpeKx+hdo=
-golang.org/x/mod v0.35.0 h1:Ww1D637e6Pg+Zb2KrWfHQUnH2dQRLBQyAtpr/haaJeM=
-golang.org/x/mod v0.35.0/go.mod h1:+GwiRhIInF8wPm+4AoT6L0FA1QWAad3OMdTRx4tFYlU=
-golang.org/x/net v0.55.0 h1:bcvxaJn3e1U6InsFWt1JUq1aSjnRxLzT2rtD2KfkDF8=
-golang.org/x/net v0.55.0/go.mod h1:L5U2KuzuOe1lY7Z+aWVIKK6qEeJXnXV9yzGA+WCHJww=
+golang.org/x/mod v0.37.0 h1:vF1DjpVEshcIqoEaauuHebaLk1O1forxjxBaVn884JQ=
+golang.org/x/mod v0.37.0/go.mod h1:m8S8VeM9r4dzDwjrKO0a1sZP3YjeMamRRlD+fmR2Q/0=
+golang.org/x/net v0.56.0 h1:Rw8j/hFzGvJUZwNBXnAtf5sVDVt+65SK2C7IxCxZt5o=
+golang.org/x/net v0.56.0/go.mod h1:D3Ku6r+V6JROoZK144D2XfMHFcMq/0zSfLelVTCFKec=
 golang.org/x/oauth2 v0.35.0 h1:Mv2mzuHuZuY2+bkyWXIHMfhNdJAdwW3FuWeCPYN5GVQ=
 golang.org/x/oauth2 v0.35.0/go.mod h1:lzm5WQJQwKZ3nwavOZ3IS5Aulzxi68dUSgRHujetwEA=
 golang.org/x/sync v0.21.0 h1:HLII4xRRTtCRkxYp4HNFF0Js/Og6q2i++KXbg0gHCwM=
@@ -252,14 +252,14 @@ golang.org/x/sys v0.0.0-20210616094352-59db8d763f22/go.mod h1:oPkhp1MJrh7nUepCBc
 golang.org/x/sys v0.6.0/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
 golang.org/x/sys v0.47.0 h1:o7XGOvZQCADBQQ4Y7VNq2dRWQR7JmOUW8Kxx4ZsNgWs=
 golang.org/x/sys v0.47.0/go.mod h1:4GL1E5IUh+htKOUEOaiffhrAeqysfVGipDYzABqnCmw=
-golang.org/x/term v0.43.0 h1:S4RLU2sB31O/NCl+zFN9Aru9A/Cq2aqKpTZJ6B+DwT4=
-golang.org/x/term v0.43.0/go.mod h1:lrhlHNdQJHO+1qVYiHfFKVuVioJIheAc3fBSMFYEIsk=
-golang.org/x/text v0.37.0 h1:Cqjiwd9eSg8e0QAkyCaQTNHFIIzWtidPahFWR83rTrc=
-golang.org/x/text v0.37.0/go.mod h1:a5sjxXGs9hsn/AJVwuElvCAo9v8QYLzvavO5z2PiM38=
+golang.org/x/term v0.44.0 h1:0rLvDRCtNj0gZkyIXhCyOb2OAzEhLVqc4B+hrsBhrmc=
+golang.org/x/term v0.44.0/go.mod h1:7ze4MdzUzLXpSAoFP1H0bOI9aXDqveSvatT5vKcFh2Y=
+golang.org/x/text v0.39.0 h1:UbZz4pLOvn600D6Oh6GGEI6VAmndrEBLv8/6BEXzyus=
+golang.org/x/text v0.39.0/go.mod h1:3UwRclnC2g0TU9x8PZiyfOajCd1zaUNHF9cvqcQZ+ZM=
 golang.org/x/time v0.14.0 h1:MRx4UaLrDotUKUdCIqzPC48t1Y9hANFKIRpNx+Te8PI=
 golang.org/x/time v0.14.0/go.mod h1:eL/Oa2bBBK0TkX57Fyni+NgnyQQN4LitPmob2Hjnqw4=
-golang.org/x/tools v0.44.0 h1:UP4ajHPIcuMjT1GqzDWRlalUEoY+uzoZKnhOjbIPD2c=
-golang.org/x/tools v0.44.0/go.mod h1:KA0AfVErSdxRZIsOVipbv3rQhVXTnlU6UhKxHd1seDI=
+golang.org/x/tools v0.47.0 h1:7Kn5x/d1svx/PzryTsqeoZN4TZwqeH5pGWjefhLi/1Q=
+golang.org/x/tools v0.47.0/go.mod h1:dFHnyTvFWY212G+h7ZY4Vsp/K3U4/7W9TyVaAul8uCA=
 google.golang.org/protobuf v1.36.12-0.20260120151049-f2248ac996af h1:+5/Sw3GsDNlEmu7TfklWKPdQ0Ykja5VEmq2i817+jbI=
 google.golang.org/protobuf v1.36.12-0.20260120151049-f2248ac996af/go.mod h1:HTf+CrKn2C3g5S8VImy6tdcUvCska2kB7j23XfzDpco=
 gopkg.in/check.v1 v0.0.0-20161208181325-20d25e280405/go.mod h1:Co6ibVJAznAaIkqp8huTwlJQCZ016jof/cbN4VW5Yz0=
```

**File**: `test/integration/go.mod` (modified, +2/-2)
```diff
@@ -54,7 +54,7 @@ require (
 	go.opentelemetry.io/otel v1.41.0 // indirect
 	go.opentelemetry.io/otel/metric v1.41.0 // indirect
 	go.opentelemetry.io/otel/trace v1.41.0 // indirect
-	golang.org/x/crypto v0.52.0 // indirect
-	golang.org/x/sys v0.45.0 // indirect
+	golang.org/x/crypto v0.53.0 // indirect
+	golang.org/x/sys v0.46.0 // indirect
 	gopkg.in/yaml.v3 v3.0.1 // indirect
 )
```

**File**: `test/integration/go.sum` (modified, +6/-6)
```diff
@@ -114,15 +114,15 @@ go.opentelemetry.io/otel/sdk/metric v1.35.0 h1:1RriWBmCKgkeHEhM7a2uMjMUfP7MsOF5J
 go.opentelemetry.io/otel/sdk/metric v1.35.0/go.mod h1:is6XYCUMpcKi+ZsOvfluY5YstFnhW0BidkR+gL+qN+w=
 go.opentelemetry.io/otel/trace v1.41.0 h1:Vbk2co6bhj8L59ZJ6/xFTskY+tGAbOnCtQGVVa9TIN0=
 go.opentelemetry.io/otel/trace v1.41.0/go.mod h1:U1NU4ULCoxeDKc09yCWdWe+3QoyweJcISEVa1RBzOis=
-golang.org/x/crypto v0.52.0 h1:RMs7fP2rXdep0CftQlK8Uf+kibLm7qkCcradZWYz988=
-golang.org/x/crypto v0.52.0/go.mod h1:1QgfPxDqh0T2M/elOJtp9RvuR95kVjir0e6/BvEmGbc=
+golang.org/x/crypto v0.53.0 h1:QZ4Muo8THX6CizN2vPPd5fBGHyogrdK9fG4wLPFUsto=
+golang.org/x/crypto v0.53.0/go.mod h1:DNLU434OwVakk9PzuwV8w62mAJpRJL3vsgcfp4Qnsio=
 golang.org/x/sys v0.0.0-20190916202348-b4ddaad3f8a3/go.mod h1:h1NjWce9XRLGQEsW7wpKNCjG9DtNlClVuFLEZdDNbEs=
 golang.org/x/sys v0.0.0-20201204225414-ed752295db88/go.mod h1:h1NjWce9XRLGQEsW7wpKNCjG9DtNlClVuFLEZdDNbEs=
 golang.org/x/sys v0.0.0-20210616094352-59db8d763f22/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
-golang.org/x/sys v0.45.0 h1:dO4czNzziLiiXplLQgBCEpCvXQ3dnkn0SdaZSYdQ+FY=
-golang.org/x/sys v0.45.0/go.mod h1:4GL1E5IUh+htKOUEOaiffhrAeqysfVGipDYzABqnCmw=
-golang.org/x/term v0.43.0 h1:S4RLU2sB31O/NCl+zFN9Aru9A/Cq2aqKpTZJ6B+DwT4=
-golang.org/x/term v0.43.0/go.mod h1:lrhlHNdQJHO+1qVYiHfFKVuVioJIheAc3fBSMFYEIsk=
+golang.org/x/sys v0.46.0 h1:noSf2Fq6F8DBgS+LysIkx7rIExoNHJsxOAtPp4rthXw=
+golang.org/x/sys v0.46.0/go.mod h1:4GL1E5IUh+htKOUEOaiffhrAeqysfVGipDYzABqnCmw=
+golang.org/x/term v0.44.0 h1:0rLvDRCtNj0gZkyIXhCyOb2OAzEhLVqc4B+hrsBhrmc=
+golang.org/x/term v0.44.0/go.mod h1:7ze4MdzUzLXpSAoFP1H0bOI9aXDqveSvatT5vKcFh2Y=
 golang.org/x/xerrors v0.0.0-20191204190536-9bdfabe68543/go.mod h1:I/5z698sn9Ka8TeJc9MKroUUfqBBauWjQqLJ2OPfmY0=
 gopkg.in/check.v1 v0.0.0-20161208181325-20d25e280405/go.mod h1:Co6ibVJAznAaIkqp8huTwlJQCZ016jof/cbN4VW5Yz0=
 gopkg.in/check.v1 v1.0.0-20201130134442-10cb98267c6c h1:Hei/4ADfdWqJk1ZMxUNpqntNwaWcugrBjAiHlqqRiVk=
```

---

### Incident Patch 2: `e779c0e6` (2026-07-24)
**Commit Message**: security: resolve all open Dependabot alerts (#560)

Five Go alerts (GHSA-rg2x-37c3-w2rh, GHSA-vp62-88p7-qqf5,
GHSA-x86f-5xw2-fm2r, GHSA-x744-4wpc-v9h2, GHSA-pxq6-2prw-chj9) all
flagged github.com/docker/docker in the test/integration module. That
module path is capped at v28.5.2+incompatible, so no patched release
exists on it -- the fixes landed under the renamed moby module paths.

testcontainers-go v0.42.0 dropped github.com/docker/docker in favor of
the github.com/moby/moby/api and /client submodules, which none of the
advisories cover. Bumping testcontainers-go to v0.43.0 and repointing
the container types import removes the flagged module from the graph
entirely.

Also drops the unused api/types/network import and fills in the
integration module's incomplete go.sum, which was missing entries for
every direct dependency -- `go vet -tags=integration ./...` failed to
build before this change and passes now.

Pygments 2.19.2 -> 2.20.0 in .github/requirements-docs.txt fixes the
ReDoS advisory (GHSA-5239-wwwm-4pmq). Hashes taken from PyPI and
verified with a --require-hashes install.

**File**: `.github/requirements-docs.txt` (modified, +3/-3)
```diff
@@ -287,9 +287,9 @@ platformdirs==4.5.1 \
     --hash=sha256:61d5cdcc6065745cdd94f0f878977f8de9437be93de97c1c12f853c9c0cdcbda \
     --hash=sha256:d03afa3963c806a9bed9d5125c8f4cb2fdaf74a55ab60e5d59b3fde758104d31
     # via mkdocs-get-deps
-pygments==2.19.2 \
-    --hash=sha256:636cb2477cec7f8952536970bc533bc43743542f70392ae026374600add5b887 \
-    --hash=sha256:86540386c03d588bb81d44bc3928634ff26449851e99741617ecb9037ee5ec0b
+pygments==2.20.0 \
+    --hash=sha256:6757cd03768053ff99f3039c1a36d6c0aa0b263438fcab17520b30a303a82b5f \
+    --hash=sha256:81a9e26dd42fd28a23a2d169d86d7ac03b46e2f8b59ed4698fb4785f946d0176
     # via mkdocs-material
 pymdown-extensions==10.21.3 \
     --hash=sha256:72cfcf55f07aea0d4af2c4f11dd4e52466ddfb1bb819673146398e0bd3a77354 \
```

**File**: `test/integration/container_helpers.go` (modified, +1/-2)
```diff
@@ -12,8 +12,7 @@ import (
 	"testing"
 	"time"
 
-	"github.com/docker/docker/api/types/container"
-	"github.com/docker/docker/api/types/network"
+	"github.com/moby/moby/api/types/container"
 	"github.com/testcontainers/testcontainers-go"
 	"github.com/testcontainers/testcontainers-go/wait"
 )
```

**File**: `test/integration/go.mod` (modified, +55/-3)
```diff
@@ -1,8 +1,60 @@
 module github.com/txn2/kubefwd/test/integration
 
-go 1.24.0
+go 1.25.0
 
 require (
-	github.com/docker/docker v28.5.1+incompatible
-	github.com/testcontainers/testcontainers-go v0.40.0
+	github.com/moby/moby/api v1.54.2
+	github.com/testcontainers/testcontainers-go v0.43.0
+)
+
+require (
+	dario.cat/mergo v1.0.2 // indirect
+	github.com/Azure/go-ansiterm v0.0.0-20250102033503-faa5f7b0171c // indirect
+	github.com/Microsoft/go-winio v0.6.2 // indirect
+	github.com/cenkalti/backoff/v4 v4.3.0 // indirect
+	github.com/cespare/xxhash/v2 v2.3.0 // indirect
+	github.com/containerd/errdefs v1.0.0 // indirect
+	github.com/containerd/errdefs/pkg v0.3.0 // indirect
+	github.com/containerd/log v0.1.0 // indirect
+	github.com/containerd/platforms v0.2.1 // indirect
+	github.com/cpuguy83/dockercfg v0.3.2 // indirect
+	github.com/davecgh/go-spew v1.1.1 // indirect
+	github.com/distribution/reference v0.6.0 // indirect
+	github.com/docker/go-connections v0.6.0 // indirect
+	github.com/docker/go-units v0.5.0 // indirect
+	github.com/ebitengine/purego v0.10.0 // indirect
+	github.com/felixge/httpsnoop v1.0.4 // indirect
+	github.com/go-logr/logr v1.4.3 // indirect
+	github.com/go-logr/stdr v1.2.2 // indirect
+	github.com/go-ole/go-ole v1.2.6 // indirect
+	github.com/google/uuid v1.6.0 // indirect
+	github.com/klauspost/compress v1.18.5 // indirect
+	github.com/lufia/plan9stats v0.0.0-20211012122336-39d0f177ccd0 // indirect
+	github.com/magiconair/properties v1.8.10 // indirect
+	github.com/moby/docker-image-spec v1.3.1 // indirect
+	github.com/moby/go-archive v0.2.0 // indirect
+	github.com/moby/moby/client v0.4.0 // indirect
+	github.com/moby/patternmatcher v0.6.1 // indirect
+	github.com/moby/sys/sequential v0.6.0 // indirect
+	github.com/moby/sys/user v0.4.0 // indirect
+	github.com/moby/sys/userns v0.1.0 // indirect
+	github.com/moby/term v0.5.2 // indirect
+	github.com/opencontainers/go-digest v1.0.0 // indirect
+	github.com/opencontainers/image-spec v1.1.1 // indirect
+	github.com/pmezard/go-difflib v1.0.0 // indirect
+	github.com/power-devops/perfstat v0.0.0-20240221224432-82ca36839d55 // indirect
+	github.com/shirou/gopsutil/v4 v4.26.5 // indirect
+	github.com/sirupsen/logrus v1.9.4 // indirect
+	github.com/stretchr/testify v1.11.1 // indirect
+	github.com/tklauser/go-sysconf v0.3.16 // indirect
+	github.com/tklauser/numcpus v0.11.0 // indirect
+	github.com/yusufpapurcu/wmi v1.2.4 // indirect
+	go.opentelemetry.io/auto/sdk v1.2.1 // indirect
+	go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.60.0 // indirect
+	go.opentelemetry.io/otel v1.41.0 // indirect
+	go.opentelemetry.io/otel/metric v1.41.0 // indirect
+	go.opentelemetry.io/otel/trace v1.41.0 // indirect
+	golang.org/x/crypto v0.51.0 // indirect
+	golang.org/x/sys v0.45.0 // indirect
+	gopkg.in/yaml.v3 v3.0.1 // indirect
 )
```

**File**: `test/integration/go.sum` (modified, +135/-2)
```diff
@@ -1,2 +1,135 @@
-github.com/docker/docker v28.5.1+incompatible/go.mod h1:eEKB0N0r5NX/I1kEveEz05bcu8tLC/8azJZsviup8Sk=
-github.com/testcontainers/testcontainers-go v0.40.0/go.mod h1:FSXV5KQtX2HAMlm7U3APNyLkkap35zNLxukw9oBi/MY=
+dario.cat/mergo v1.0.2 h1:85+piFYR1tMbRrLcDwR18y4UKJ3aH1Tbzi24VRW1TK8=
+dario.cat/mergo v1.0.2/go.mod h1:E/hbnu0NxMFBjpMIE34DRGLWqDy0g5FuKDhCb31ngxA=
+github.com/AdaLogics/go-fuzz-headers v0.0.0-20240806141605-e8a1dd7889d6 h1:He8afgbRMd7mFxO99hRNu+6tazq8nFF9lIwo9JFroBk=
+github.com/AdaLogics/go-fuzz-headers v0.0.0-20240806141605-e8a1dd7889d6/go.mod h1:8o94RPi1/7XTJvwPpRSzSUedZrtlirdB3r9Z20bi2f8=
+github.com/Azure/go-ansiterm v0.0.0-20250102033503-faa5f7b0171c h1:udKWzYgxTojEKWjV8V+WSxDXJ4NFATAsZjh8iIbsQIg=
+github.com/Azure/go-ansiterm v0.0.0-20250102033503-faa5f7b0171c/go.mod h1:xomTg63KZ2rFqZQzSB4Vz2SUXa1BpHTVz9L5PTmPC4E=
+github.com/Microsoft/go-winio v0.6.2 h1:F2VQgta7ecxGYO8k3ZZz3RS8fVIXVxONVUPlNERoyfY=
+github.com/Microsoft/go-winio v0.6.2/go.mod h1:yd8OoFMLzJbo9gZq8j5qaps8bJ9aShtEA8Ipt1oGCvU=
+github.com/cenkalti/backoff/v4 v4.3.0 h1:MyRJ/UdXutAwSAT+s3wNd7MfTIcy71VQueUuFK343L8=
+github.com/cenkalti/backoff/v4 v4.3.0/go.mod h1:Y3VNntkOUPxTVeUxJ/G5vcM//AlwfmyYozVcomhLiZE=
+github.com/cespare/xxhash/v2 v2.3.0 h1:UL815xU9SqsFlibzuggzjXhog7bL6oX9BbNZnL2UFvs=
+github.com/cespare/xxhash/v2 v2.3.0/go.mod h1:VGX0DQ3Q6kWi7AoAeZDth3/j3BFtOZR5XLFGgcrjCOs=
+github.com/containerd/errdefs v1.0.0 h1:tg5yIfIlQIrxYtu9ajqY42W3lpS19XqdxRQeEwYG8PI=
+github.com/containerd/errdefs v1.0.0/go.mod h1:+YBYIdtsnF4Iw6nWZhJcqGSg/dwvV7tyJ/kCkyJ2k+M=
+github.com/containerd/errdefs/pkg v0.3.0 h1:9IKJ06FvyNlexW690DXuQNx2KA2cUJXx151Xdx3ZPPE=
+github.com/containerd/errdefs/pkg v0.3.0/go.mod h1:NJw6s9HwNuRhnjJhM7pylWwMyAkmCQvQ4GpJHEqRLVk=
+github.com/containerd/log v0.1.0 h1:TCJt7ioM2cr/tfR8GPbGf9/VRAX8D2B4PjzCpfX540I=
+github.com/containerd/log v0.1.0/go.mod h1:VRRf09a7mHDIRezVKTRCrOq78v577GXq3bSa3EhrzVo=
+github.com/containerd/platforms v0.2.1 h1:zvwtM3rz2YHPQsF2CHYM8+KtB5dvhISiXh5ZpSBQv6A=
+github.com/containerd/platforms v0.2.1/go.mod h1:XHCb+2/hzowdiut9rkudds9bE5yJ7npe7dG/wG+uFPw=
+github.com/cpuguy83/dockercfg v0.3.2 h1:DlJTyZGBDlXqUZ2Dk2Q3xHs/FtnooJJVaad2S9GKorA=
+github.com/cpuguy83/dockercfg v0.3.2/go.mod h1:sugsbF4//dDlL/i+S+rtpIWp+5h0BHJHfjj5/jFyUJc=
+github.com/creack/pty v1.1.24 h1:bJrF4RRfyJnbTJqzRLHzcGaZK1NeM5kTC9jGgovnR1s=
+github.com/creack/pty v1.1.24/go.mod h1:08sCNb52WyoAwi2QDyzUCTgcvVFhUzewun7wtTfvcwE=
+github.com/davecgh/go-spew v1.1.1 h1:vj9j/u1bqnvCEfJOwUhtlOARqs3+rkHYY13jYWTU97c=
+github.com/davecgh/go-spew v1.1.1/go.mod h1:J7Y8YcW2NihsgmVo/mv3lAwl/skON4iLHjSsI+c5H38=
+github.com/distribution/reference v0.6.0 h1:0IXCQ5g4/QMHHkarYzh5l+u8T3t73zM5QvfrDyIgxBk=
+github.com/distribution/reference v0.6.0/go.mod h1:BbU0aIcezP1/5jX/8MP0YiH4SdvB5Y4f/wlDRiLyi3E=
+github.com/docker/go-connections v0.6.0 h1:LlMG9azAe1TqfR7sO+NJttz1gy6KO7VJBh+pMmjSD94=
+github.com/docker/go-connections v0.6.0/go.mod h1:AahvXYshr6JgfUJGdDCs2b5EZG/vmaMAntpSFH5BFKE=
+github.com/docker/go-units v0.5.0 h1:69rxXcBk27SvSaaxTtLh/8llcHD8vYHT7WSdRZ/jvr4=
+github.com/docker/go-units v0.5.0/go.mod h1:fgPhTUdO+D/Jk86RDLlptpiXQzgHJF7gydDDbaIK4Dk=
+github.com/ebitengine/purego v0.10.0 h1:QIw4xfpWT6GWTzaW5XEKy3HXoqrJGx1ijYHzTF0/ISU=
+github.com/ebitengine/purego v0.10.0/go.mod h1:iIjxzd6CiRiOG0UyXP+V1+jWqUXVjPKLAI0mRfJZTmQ=
+github.com/felixge/httpsnoop v1.0.4 h1:NFTV2Zj1bL4mc9sqWACXbQFVBBg2W3GPvqp8/ESS2Wg=
+github.com/felixge/httpsnoop v1.0.4/go.mod h1:m8KPJKqk1gH5J9DgRY2ASl2lWCfGKXixSwevea8zH2U=
+github.com/go-logr/logr v1.2.2/go.mod h1:jdQByPbusPIv2/zmleS9BjJVeZ6kBagPoEUsqbVz/1A=
+github.com/go-logr/logr v1.4.3 h1:CjnDlHq8ikf6E492q6eKboGOC0T8CDaOvkHCIg8idEI=
+github.com/go-logr/logr v1.4.3/go.mod h1:9T104GzyrTigFIr8wt5mBrctHMim0Nb2HLGrmQ40KvY=
+github.com/go-logr/stdr v1.2.2 h1:hSWxHoqTgW2S2qGc0LTAI563KZ5YKYRhT3MFKZMbjag=
+github.com/go-logr/stdr v1.2.2/go.mod h1:mMo/vtBO5dYbehREoey6XUKy/eSumjCCveDpRre4VKE=
+github.com/go-ole/go-ole v1.2.6 h1:/Fpf6oFPoeFik9ty7siob0G6Ke8QvQEuVcuChpwXzpY=
+github.com/go-ole/go-ole v1.2.6/go.mod h1:pprOEPIfldk/42T2oK7lQ4v4JSDwmV0As9GaiUsvbm0=
+github.com/google/go-cmp v0.5.6/go.mod h1:v8dTdLbMG2kIc/vJvl+f65V22dbkXbowE6jgT/gNBxE=
+github.com/google/go-cmp v0.7.0 h1:wk8382ETsv4JYUZwIsn6YpYiWiBsYLSJiTsyBybVuN8=
+github.com/google/go-cmp v0.7.0/go.mod h1:pXiqmnSA92OHEEa9HXL2W4E7lf9JzCmGVUdgjX3N/iU=
+github.com/google/uuid v1.6.0 h1:NIvaJDMOsjHA8n1jAhLSgzrAzy1Hgr+hNrb57e+94F0=
+github.com/google/uuid v1.6.0/go.mod h1:TIyPZe4MgqvfeYDBFedMoGGpEw/LqOeaOT+nhxU+yHo=
+github.com/klauspost/compress v1.18.5 h1:/h1gH5Ce+VWNLSWqPzOVn6XBO+vJbCNGvjoaGBFW2IE=
+github.com/klauspost/compress v1.18.5/go.mod h1:cwPg85FWrGar70rWktvGQj8/hthj3wpl0PGDogxkrSQ=
+github.com/kr/pretty v0.3.1 h1:flRD4NNwYAUpkphVc1HcthR4KEIFJ65n8Mw5qdRn3LE=
+github.com/kr/pretty v0.3.1/go.mod h1:hoEshYVHaxMs3cyo3Yncou5ZscifuDolrwPKZanG3xk=
+github.com/kr/text v0.2.0 h1:5Nx0Ya0ZqY2ygV366QzturHI13Jq95ApcVaJBhpS+AY=
+github.com/kr/text v0.2.0/go.mod h
```

---

### Incident Patch 3: `2640c27d` (2026-07-10)
**Commit Message**: ci: bump docker/setup-buildx-action from 4.1.0 to 4.2.0 (#543)

Bumps [docker/setup-buildx-action](https://github.com/docker/setup-buildx-action) from 4.1.0 to 4.2.0.
- [Release notes](https://github.com/docker/setup-buildx-action/releases)
- [Commits](https://github.com/docker/setup-buildx-action/compare/d7f5e7f509e45cec5c76c4d5afdd7de93d0b3df5...bb05f3f5519dd87d3ba754cc423b652a5edd6d2c)

---
updated-dependencies:
- dependency-name: docker/setup-buildx-action
  dependency-version: 4.2.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
Co-authored-by: Craig Johnston <[REDACTED_EMAIL]>

**File**: `.github/workflows/release.yml` (modified, +1/-1)
```diff
@@ -40,7 +40,7 @@ jobs:
         uses: docker/setup-qemu-action@06116385d9baf250c9f4dcb4858b16962ea869c3 # v4.1.0
 
       - name: Set up Docker Buildx
-        uses: docker/setup-buildx-action@d7f5e7f509e45cec5c76c4d5afdd7de93d0b3df5 # v4.1.0
+        uses: docker/setup-buildx-action@bb05f3f5519dd87d3ba754cc423b652a5edd6d2c # v4.2.0
 
       - name: Login to Docker Hub
         uses: docker/login-action@af1e73f918a031802d376d3c8bbc3fe56130a9b0 # v4.4.0
```

---

### Incident Patch 4: `c0cdb98f` (2026-07-04)
**Commit Message**: ci: use actions/attest instead of -build-provenance (#537)

Ref https://github.com/actions/attest-build-provenance#usage

> As of version 4, actions/attest-build-provenance is simply a wrapper
> on top of [actions/attest](https://github.com/actions/attest).
> Existing applications may continue to use the attest-build-provenance
> action, but new implementations should use actions/attest instead.

**File**: `.github/workflows/release.yml` (modified, +2/-2)
```diff
@@ -101,7 +101,7 @@ jobs:
           cd dist
           # Find all release artifacts and generate sha256 checksums.
           # Using find to avoid glob expansion issues when files don't exist.
-          # The checksums file feeds actions/attest-build-provenance below.
+          # The checksums file feeds actions/attest below.
           find . -type f \( -name "*.tar.gz" -o -name "*.zip" -o -name "*.mcpb" \) -exec sha256sum {} \; > /tmp/checksums.txt
           if [ -s /tmp/checksums.txt ]; then
             echo "Checksums generated:"
@@ -121,7 +121,7 @@ jobs:
         # This action is actively maintained and Node 24-based. Attestations are
         # stored in GitHub's attestation API; verify with:
         #   gh attestation verify <artifact> --repo txn2/kubefwd
-        uses: actions/attest-build-provenance@0f67c3f4856b2e3261c31976d6725780e5e4c373 # v4.1.1
+        uses: actions/attest@a1948c3f048ba23858d222213b7c278aabede763 # v4.1.1
         with:
           subject-checksums: /tmp/checksums.txt
 
```

**File**: `SECURITY.md` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ cosign verify-blob \
 
 ### SLSA Provenance
 
-Releases include [SLSA](https://slsa.dev) build provenance attestations generated by GitHub's [attest-build-provenance](https://github.com/actions/attest-build-provenance) action. This provides a verifiable record that artifacts were built from this repository using the documented build process. Verify an artifact with the GitHub CLI:
+Releases include [SLSA](https://slsa.dev) build provenance attestations generated by GitHub's [attest](https://github.com/actions/attest) action. This provides a verifiable record that artifacts were built from this repository using the documented build process. Verify an artifact with the GitHub CLI:
 
 ```bash
 # Download a release artifact, then verify its provenance attestation
```

---

### Incident Patch 5: `47dc322d` (2026-07-01)
**Commit Message**: ci: bump actions/attest-build-provenance from 4.1.0 to 4.1.1 (#533)

Bumps [actions/attest-build-provenance](https://github.com/actions/attest-build-provenance) from 4.1.0 to 4.1.1.
- [Release notes](https://github.com/actions/attest-build-provenance/releases)
- [Changelog](https://github.com/actions/attest-build-provenance/blob/main/RELEASE.md)
- [Commits](https://github.com/actions/attest-build-provenance/compare/a2bbfa25375fe432b6a289bc6b6cd05ecd0c4c32...0f67c3f4856b2e3261c31976d6725780e5e4c373)

---
updated-dependencies:
- dependency-name: actions/attest-build-provenance
  dependency-version: 4.1.1
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
Co-authored-by: Craig Johnston <[REDACTED_EMAIL]>

**File**: `.github/workflows/release.yml` (modified, +1/-1)
```diff
@@ -121,7 +121,7 @@ jobs:
         # This action is actively maintained and Node 24-based. Attestations are
         # stored in GitHub's attestation API; verify with:
         #   gh attestation verify <artifact> --repo txn2/kubefwd
-        uses: actions/attest-build-provenance@a2bbfa25375fe432b6a289bc6b6cd05ecd0c4c32 # v4.1.0
+        uses: actions/attest-build-provenance@0f67c3f4856b2e3261c31976d6725780e5e4c373 # v4.1.1
         with:
           subject-checksums: /tmp/checksums.txt
 
```

---

### Incident Patch 6: `3f136362` (2026-06-20)
**Commit Message**: ci: fix SLSA provenance via GitHub-native attestation (#528) (#529)

The standalone provenance job called the SLSA reusable workflow
(generator_generic_slsa3.yml) pinned to v2.0.0, which ships Node 20
actions that GitHub now force-migrates to Node 24. That migration broke
the generator's internal steps (exit 127, missing 'path' input), failing
the provenance job on every release since v1.25.12.

Replace it with GitHub's actively-maintained, Node 24-based
actions/attest-build-provenance, run as a step inside the existing
release job (which already has id-token: write and attestations: write).
The hash step now emits a plain sha256sum checksums file consumed via
subject-checksums.

- release.yml: drop the broken provenance job and unused hashes output;
  add the attestation step; rename the checksum step.
- dependabot.yml: remove the now-dead slsa-github-generator ignore.
- SECURITY.md: document verification via 'gh attestation verify'.

Attestations are stored in GitHub's attestation API rather than attached
as a release asset; verify with:
  gh attestation verify <artifact> --repo txn2/kubefwd

**File**: `.github/dependabot.yml` (modified, +0/-7)
```diff
@@ -21,13 +21,6 @@ updates:
     labels:
       - "dependencies"
       - "github-actions"
-    ignore:
-      # SLSA generator v2.1.x has a privacy-check false positive that halts
-      # provenance generation on public repos. Pinned to v2.0.0 in
-      # release.yml. See issue #471. Drop this ignore once upstream ships
-      # a fix (slsa-framework/slsa-github-generator#4493).
-      - dependency-name: "slsa-framework/slsa-github-generator"
-        versions: ["2.1.x"]
 
   # Docker
   - package-ecosystem: "docker"
```

**File**: `.github/workflows/release.yml` (modified, +24/-25)
```diff
@@ -15,8 +15,6 @@ jobs:
       packages: write
       id-token: write  # Required for keyless signing with Cosign and SLSA provenance
       attestations: write  # Required for GitHub attestations
-    outputs:
-      hashes: ${{ steps.hash.outputs.hashes }}
     steps:
       - name: Checkout
         uses: actions/checkout@df4cb1c069e1874edd31b4311f1884172cec0e10 # v6.0.3
@@ -97,20 +95,36 @@ jobs:
           GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
         run: gh release edit "$GITHUB_REF_NAME" --draft=false
 
-      - name: Generate artifact hashes
+      - name: Generate artifact checksums
         id: hash
         run: |
           cd dist
-          # Find all release artifacts and generate hashes
-          # Using find to avoid glob expansion issues when files don't exist
-          find . -type f \( -name "*.tar.gz" -o -name "*.zip" -o -name "*.mcpb" \) -exec sha256sum {} \; > /tmp/hashes.txt
-          if [ -s /tmp/hashes.txt ]; then
-            cat /tmp/hashes.txt | base64 -w0 > /tmp/hashes_b64.txt
-            echo "hashes=$(cat /tmp/hashes_b64.txt)" >> "$GITHUB_OUTPUT"
+          # Find all release artifacts and generate sha256 checksums.
+          # Using find to avoid glob expansion issues when files don't exist.
+          # The checksums file feeds actions/attest-build-provenance below.
+          find . -type f \( -name "*.tar.gz" -o -name "*.zip" -o -name "*.mcpb" \) -exec sha256sum {} \; > /tmp/checksums.txt
+          if [ -s /tmp/checksums.txt ]; then
+            echo "Checksums generated:"
+            cat /tmp/checksums.txt
+            echo "has_artifacts=true" >> "$GITHUB_OUTPUT"
           else
-            echo "No artifacts found for hashing"
+            echo "No artifacts found for checksums"
+            echo "has_artifacts=false" >> "$GITHUB_OUTPUT"
           fi
 
+      - name: Attest build provenance (SLSA)
+        if: steps.hash.outputs.has_artifacts == 'true'
+        # GitHub-native build provenance attestation. Replaces the SLSA
+        # reusable workflow (generator_generic_slsa3.yml), which was pinned to
+        # v2.0.0 and broke under the runner's Node 20 -> 24 migration (see #528,
+        # superseding the v2.1.0 privacy-check workaround tracked in #471).
+        # This action is actively maintained and Node 24-based. Attestations are
+        # stored in GitHub's attestation API; verify with:
+        #   gh attestation verify <artifact> --repo txn2/kubefwd
+        uses: actions/attest-build-provenance@a2bbfa25375fe432b6a289bc6b6cd05ecd0c4c32 # v4.1.0
+        with:
+          subject-checksums: /tmp/checksums.txt
+
       - name: Install mcp-publisher
         run: |
           curl -L "https://github.com/modelcontextprotocol/registry/releases/latest/download/mcp-publisher_linux_amd64.tar.gz" | tar xz
@@ -179,18 +193,3 @@ jobs:
 
           # Publish the server to the MCP registry
           mcp-publisher publish
-
-  provenance:
-    needs: [release]
-    if: needs.release.outputs.hashes != ''
-    permissions:
-      actions: read
-      id-token: write
-      contents: write
-    # Pinned to v2.0.0 due to false-positive privacy-check halt in v2.1.0
-    # (slsa-framework/slsa-github-generator#4493). See issue #471.
-    # Re-evaluate when an upstream fix lands.
-    uses: slsa-framework/slsa-github-generator/.github/workflows/generator_generic_slsa3.yml@5a775b367a56d5bd118a224a811bba288150a563 # v2.0.0
-    with:
-      base64-subjects: "${{ needs.release.outputs.hashes }}"
-      upload-assets: true
```

**File**: `SECURITY.md` (modified, +6/-1)
```diff
@@ -28,7 +28,12 @@ cosign verify-blob \
 
 ### SLSA Provenance
 
-Releases include [SLSA Level 3](https://slsa.dev) provenance attestations generated by the official SLSA GitHub generator. This provides a verifiable record that artifacts were built from this repository using the documented build process.
+Releases include [SLSA](https://slsa.dev) build provenance attestations generated by GitHub's [attest-build-provenance](https://github.com/actions/attest-build-provenance) action. This provides a verifiable record that artifacts were built from this repository using the documented build process. Verify an artifact with the GitHub CLI:
+
+```bash
+# Download a release artifact, then verify its provenance attestation
+gh attestation verify kubefwd_{VERSION}_linux_amd64.tar.gz --repo txn2/kubefwd
+```
 
 ### Software Bill of Materials (SBOM)
 
```

---

### Incident Patch 7: `e2ccf10f` (2026-06-20)
**Commit Message**: tui: migrate from Charm v1 to Charm v2 libraries (#517) (#527)

Move the entire TUI from the v1 Charm libraries to their v2 equivalents
so the bubble-table dependency can advance past v0.21.0 (which switched
to the v2 type system).

Dependencies:
- github.com/charmbracelet/bubbletea -> charm.land/bubbletea/v2
- github.com/charmbracelet/lipgloss   -> charm.land/lipgloss/v2
- github.com/charmbracelet/bubbles    -> charm.land/bubbles/v2
- github.com/evertras/bubble-table    v0.19.2 -> v0.22.3

API changes:
- View() now returns tea.View; alt-screen and mouse mode move from the
  removed tea.WithAltScreen/tea.WithMouseCellMotion program options to
  the AltScreen and MouseMode fields on the returned tea.View.
- tea.KeyMsg is now an interface; all handlers switch on the concrete
  tea.KeyPressMsg (including browse and help modals).
- tea.MouseMsg is now an interface; the single handler is split into
  tea.MouseWheelMsg and tea.MouseClickMsg paths, with button constants
  renamed (MouseButtonWheelUp -> MouseWheelUp, MouseButtonLeft ->
  MouseLeft, etc.).
- lipgloss.Color is now a function returning image/color.Color; the
  styles color() helper returns image/color.Color accordingly. The
 

**File**: `go.mod` (modified, +14/-19)
```diff
@@ -3,14 +3,13 @@ module github.com/txn2/kubefwd
 go 1.26.0
 
 require (
+	charm.land/bubbles/v2 v2.1.0
+	charm.land/bubbletea/v2 v2.0.7
+	charm.land/lipgloss/v2 v2.0.4
 	github.com/bep/debounce v1.2.1
-	github.com/charmbracelet/bubbles v1.0.0
-	github.com/charmbracelet/bubbletea v1.3.10
-	github.com/charmbracelet/lipgloss v1.1.0
-	github.com/evertras/bubble-table v0.19.2
+	github.com/evertras/bubble-table v0.22.3
 	github.com/gin-gonic/gin v1.12.0
 	github.com/modelcontextprotocol/go-sdk v1.6.1
-	github.com/muesli/termenv v0.16.0
 	github.com/pkg/errors v0.9.1
 	github.com/sirupsen/logrus v1.9.4
 	github.com/spf13/cobra v1.10.2
@@ -30,23 +29,22 @@ require (
 	github.com/Azure/go-ansiterm v0.0.0-20230124172434-306776ec8161 // indirect
 	github.com/MakeNowJust/heredoc v1.0.0 // indirect
 	github.com/atotto/clipboard v0.1.4 // indirect
-	github.com/aymanbagabas/go-osc52/v2 v2.0.1 // indirect
 	github.com/blang/semver/v4 v4.0.0 // indirect
 	github.com/bytedance/gopkg v0.1.3 // indirect
 	github.com/bytedance/sonic v1.15.0 // indirect
 	github.com/bytedance/sonic/loader v0.5.0 // indirect
 	github.com/chai2010/gettext-go v1.0.2 // indirect
-	github.com/charmbracelet/colorprofile v0.4.1 // indirect
-	github.com/charmbracelet/x/ansi v0.11.6 // indirect
-	github.com/charmbracelet/x/cellbuf v0.0.15 // indirect
+	github.com/charmbracelet/colorprofile v0.4.3 // indirect
+	github.com/charmbracelet/ultraviolet v0.0.0-20260525132238-948f4557a654 // indirect
+	github.com/charmbracelet/x/ansi v0.11.7 // indirect
 	github.com/charmbracelet/x/term v0.2.2 // indirect
-	github.com/clipperhouse/displaywidth v0.9.0 // indirect
-	github.com/clipperhouse/stringish v0.1.1 // indirect
-	github.com/clipperhouse/uax29/v2 v2.5.0 // indirect
+	github.com/charmbracelet/x/termios v0.1.1 // indirect
+	github.com/charmbracelet/x/windows v0.2.2 // indirect
+	github.com/clipperhouse/displaywidth v0.11.0 // indirect
+	github.com/clipperhouse/uax29/v2 v2.7.0 // indirect
 	github.com/cloudwego/base64x v0.1.6 // indirect
 	github.com/davecgh/go-spew v1.1.2-0.20180830191138-d8f796af33cc // indirect
 	github.com/emicklei/go-restful/v3 v3.13.0 // indirect
-	github.com/erikgeiser/coninput v0.0.0-20211004153227-1c3628e74d0f // indirect
 	github.com/exponent-io/jsonpath v0.0.0-20210407135951-1de76d718b3f // indirect
 	github.com/fxamacker/cbor/v2 v2.9.0 // indirect
 	github.com/gabriel-vasile/mimetype v1.4.12 // indirect
@@ -72,20 +70,17 @@ require (
 	github.com/klauspost/cpuid/v2 v2.3.0 // indirect
 	github.com/leodido/go-urn v1.4.0 // indirect
 	github.com/liggitt/tabwriter v0.0.0-20181228230101-89fcab3d43de // indirect
-	github.com/lucasb-eyer/go-colorful v1.3.0 // indirect
+	github.com/lucasb-eyer/go-colorful v1.4.0 // indirect
 	github.com/mailru/easyjson v0.7.7 // indirect
 	github.com/mattn/go-isatty v0.0.20 // indirect
-	github.com/mattn/go-localereader v0.0.1 // indirect
-	github.com/mattn/go-runewidth v0.0.19 // indirect
+	github.com/mattn/go-runewidth v0.0.23 // indirect
 	github.com/mitchellh/go-wordwrap v1.0.1 // indirect
 	github.com/moby/spdystream v0.5.1 // indirect
 	github.com/moby/term v0.5.0 // indirect
 	github.com/modern-go/concurrent v0.0.0-20180306012644-bacd9c7ef1dd // indirect
 	github.com/modern-go/reflect2 v1.0.3-0.20250322232337-35a7c28c31ee // indirect
 	github.com/monochromegane/go-gitignore v0.0.0-20200626010858-205db1a8cc00 // indirect
-	github.com/muesli/ansi v0.0.0-20230316100256-276c6243b2f6 // indirect
 	github.com/muesli/cancelreader v0.2.2 // indirect
-	github.com/muesli/reflow v0.3.0 // indirect
 	github.com/munnerz/goautoneg v0.0.0-20191010083416-a7dc8b61c822 // indirect
 	github.com/pelletier/go-toml/v2 v2.2.4 // indirect
 	github.com/peterbourgon/diskv v2.0.1+incompatible // indirect
@@ -110,7 +105,7 @@ require (
 	golang.org/x/crypto v0.48.0 // indirect
 	golang.org/x/net v0.51.0 // indirect
 	golang.org/x/oauth2 v0.35.0 // indirect
-	golang.org/x/sync v0.19.0 // indirect
+	golang.org/x/sync v0.20.0 // indirect
 	golang.org/x/term v0.40.0 // indirect
 	golang.org/x/text v0.34.0 // indirect
 	golang.org/x/time v0.14.0 // indirect
```

**File**: `go.sum` (modified, +32/-42)
```diff
@@ -1,3 +1,9 @@
+charm.land/bubbles/v2 v2.1.0 h1:YSnNh5cPYlYjPxRrzs5VEn3vwhtEn3jVGRBT3M7/I0g=
+charm.land/bubbles/v2 v2.1.0/go.mod h1:l97h4hym2hvWBVfmJDtrEHHCtkIKeTEb3TTJ4ZOB3wY=
+charm.land/bubbletea/v2 v2.0.7 h1:7qw2tTAVar7m7klOPBYfTB0mniv/RuexsYwMRNxSeL0=
+charm.land/bubbletea/v2 v2.0.7/go.mod h1:DGW2q8gvzHnOpMpZTORs0aySVHCox5C+2Svk0fci1qs=
+charm.land/lipgloss/v2 v2.0.4 h1:lcPeVtcp23SNra7lHy8iYE4UC2aIipVQ47sbGyyxR5Q=
+charm.land/lipgloss/v2 v2.0.4/go.mod h1:0653x8epbZSzdDfO/XPS1a/uYPOBeSsCssOpJOqDzik=
 github.com/Azure/go-ansiterm v0.0.0-20230124172434-306776ec8161 h1:L/gRVlceqvL25UVaW/CKtUDjefjrs0SPonmDGUVOYP0=
 github.com/Azure/go-ansiterm v0.0.0-20230124172434-306776ec8161/go.mod h1:xomTg63KZ2rFqZQzSB4Vz2SUXa1BpHTVz9L5PTmPC4E=
 github.com/MakeNowJust/heredoc v1.0.0 h1:cXCdzVdstXyiTqTvfqk9SDHpKNjxuom+DOlyEeQ4pzQ=
@@ -8,8 +14,8 @@ github.com/armon/go-socks5 v0.0.0-20160902184237-e75332964ef5 h1:0CwZNZbxp69SHPd
 github.com/armon/go-socks5 v0.0.0-20160902184237-e75332964ef5/go.mod h1:wHh0iHkYZB8zMSxRWpUBQtwG5a7fFgvEO+odwuTv2gs=
 github.com/atotto/clipboard v0.1.4 h1:EH0zSVneZPSuFR11BlR9YppQTVDbh5+16AmcJi4g1z4=
 github.com/atotto/clipboard v0.1.4/go.mod h1:ZY9tmq7sm5xIbd9bOK4onWV4S6X0u6GY7Vn0Yu86PYI=
-github.com/aymanbagabas/go-osc52/v2 v2.0.1 h1:HwpRHbFMcZLEVr42D4p7XBqjyuxQH5SMiErDT4WkJ2k=
-github.com/aymanbagabas/go-osc52/v2 v2.0.1/go.mod h1:uYgXzlJ7ZpABp8OJ+exZzJJhRNQ2ASbcXHWsFqH8hp8=
+github.com/aymanbagabas/go-udiff v0.4.1 h1:OEIrQ8maEeDBXQDoGCbbTTXYJMYRCRO1fnodZ12Gv5o=
+github.com/aymanbagabas/go-udiff v0.4.1/go.mod h1:0L9PGwj20lrtmEMeyw4WKJ/TMyDtvAoK9bf2u/mNo3w=
 github.com/bep/debounce v1.2.1 h1:v67fRdBA9UQu2NhLFXrSg0Brw7CexQekrBwDMM8bzeY=
 github.com/bep/debounce v1.2.1/go.mod h1:H8yggRPQKLUhUoqrJC1bO2xNya7vanpDl7xR3ISbCJ0=
 github.com/blang/semver/v4 v4.0.0 h1:1PFHFE6yCCTv8C1TeyNNarDzntLi7wMI5i/pzqYIsAM=
@@ -22,26 +28,24 @@ github.com/bytedance/sonic/loader v0.5.0 h1:gXH3KVnatgY7loH5/TkeVyXPfESoqSBSBEiD
 github.com/bytedance/sonic/loader v0.5.0/go.mod h1:AR4NYCk5DdzZizZ5djGqQ92eEhCCcdf5x77udYiSJRo=
 github.com/chai2010/gettext-go v1.0.2 h1:1Lwwip6Q2QGsAdl/ZKPCwTe9fe0CjlUbqj5bFNSjIRk=
 github.com/chai2010/gettext-go v1.0.2/go.mod h1:y+wnP2cHYaVj19NZhYKAwEMH2CI1gNHeQQ+5AjwawxA=
-github.com/charmbracelet/bubbles v1.0.0 h1:12J8/ak/uCZEMQ6KU7pcfwceyjLlWsDLAxB5fXonfvc=
-github.com/charmbracelet/bubbles v1.0.0/go.mod h1:9d/Zd5GdnauMI5ivUIVisuEm3ave1XwXtD1ckyV6r3E=
-github.com/charmbracelet/bubbletea v1.3.10 h1:otUDHWMMzQSB0Pkc87rm691KZ3SWa4KUlvF9nRvCICw=
-github.com/charmbracelet/bubbletea v1.3.10/go.mod h1:ORQfo0fk8U+po9VaNvnV95UPWA1BitP1E0N6xJPlHr4=
-github.com/charmbracelet/colorprofile v0.4.1 h1:a1lO03qTrSIRaK8c3JRxJDZOvhvIeSco3ej+ngLk1kk=
-github.com/charmbracelet/colorprofile v0.4.1/go.mod h1:U1d9Dljmdf9DLegaJ0nGZNJvoXAhayhmidOdcBwAvKk=
-github.com/charmbracelet/lipgloss v1.1.0 h1:vYXsiLHVkK7fp74RkV7b2kq9+zDLoEU4MZoFqR/noCY=
-github.com/charmbracelet/lipgloss v1.1.0/go.mod h1:/6Q8FR2o+kj8rz4Dq0zQc3vYf7X+B0binUUBwA0aL30=
-github.com/charmbracelet/x/ansi v0.11.6 h1:GhV21SiDz/45W9AnV2R61xZMRri5NlLnl6CVF7ihZW8=
-github.com/charmbracelet/x/ansi v0.11.6/go.mod h1:2JNYLgQUsyqaiLovhU2Rv/pb8r6ydXKS3NIttu3VGZQ=
-github.com/charmbracelet/x/cellbuf v0.0.15 h1:ur3pZy0o6z/R7EylET877CBxaiE1Sp1GMxoFPAIztPI=
-github.com/charmbracelet/x/cellbuf v0.0.15/go.mod h1:J1YVbR7MUuEGIFPCaaZ96KDl5NoS0DAWkskup+mOY+Q=
+github.com/charmbracelet/colorprofile v0.4.3 h1:QPa1IWkYI+AOB+fE+mg/5/4HRMZcaXex9t5KX76i20Q=
+github.com/charmbracelet/colorprofile v0.4.3/go.mod h1:/zT4BhpD5aGFpqQQqw7a+VtHCzu+zrQtt1zhMt9mR4Q=
+github.com/charmbracelet/ultraviolet v0.0.0-20260525132238-948f4557a654 h1:FpSYhY28ucg9ZRr+2wj67FAQ0Ey5yiK0072PmRDJNek=
+github.com/charmbracelet/ultraviolet v0.0.0-20260525132238-948f4557a654/go.mod h1:hFpumms29Smx3LStRfku8vcCTBe1Kq8aCXtHUJa3mjY=
+github.com/charmbracelet/x/ansi v0.11.7 h1:kzv1kJvjg2S3r9KHo8hDdHFQLEqn4RBCb39dAYC84jI=
+github.com/charmbracelet/x/ansi v0.11.7/go.mod h1:9qGpnAVYz+8ACONkZBUWPtL7lulP9No6p1epAihUZwQ=
+github.com/charmbracelet/x/exp/golden v0.0.0-20250806222409-83e3a29d542f h1:pk6gmGpCE7F3FcjaOEKYriCvpmIN4+6OS/RD0vm4uIA=
+github.com/charmbracelet/x/exp/golden v0.0.0-20250806222409-83e3a29d542f/go.mod h1:IfZAMTHB6XkZSeXUqriemErjAWCCzT0LwjKFYCZyw0I=
 github.com/charmbracelet/x/term v0.2.2 h1:xVRT/S2ZcKdhhOuSP4t5cLi5o+JxklsoEObBSgfgZRk=
 github.com/charmbracelet/x/term v0.2.2/go.mod h1:kF8CY5RddLWrsgVwpw4kAa6TESp6EB5y3uxGLeCqzAI=
-github.com/clipperhouse/displaywidth v0.9.0 h1:Qb4KOhYwRiN3viMv1v/3cTBlz3AcAZX3+y9OLhMtAtA=
-github.com/clipperhouse/displaywidth v0.9.0/go.mod h1:aCAAqTlh4GIVkhQnJpbL0T/WfcrJXHcj8C0yjYcjOZA=
-github.com/clipperhouse/stringish v0.1.1 h1:+NSqMOr3GR6k1FdRhhnXrLfztGzuG+VuFDfatpWHKCs=
-github.com/clipperhouse/stringish v0.1.1/go.mod h1:v/WhFtE1q0ovMta2+m+UbpZ+2/HEXNWYXQgCt4hdOzA=
-github.com/clipperhouse/uax29/v2 v2.5.0 h1:x7T0T4eTHDONxFJsL94uKNKPHrclyFI0lm7+w94cO8U=
-github.com/clipperhouse/uax29/v2 v2.5.0/go.mod h1:Wn1g7MK6OoeDT0vL+Q0SQLDz/KpfsVRgg6W7ihQeh4g=
+github.com
```

**File**: `pkg/fwdtui/commands.go` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ package fwdtui
 import (
 	"time"
 
-	tea "github.com/charmbracelet/bubbletea"
+	tea "charm.land/bubbletea/v2"
 	"github.com/sirupsen/logrus"
 	"github.com/txn2/kubefwd/pkg/fwdmetrics"
 	"github.com/txn2/kubefwd/pkg/fwdtui/events"
```

**File**: `pkg/fwdtui/components/browse.go` (modified, +7/-7)
```diff
@@ -4,8 +4,8 @@ import (
 	"fmt"
 	"strings"
 
-	tea "github.com/charmbracelet/bubbletea"
-	"github.com/charmbracelet/lipgloss"
+	tea "charm.land/bubbletea/v2"
+	"charm.land/lipgloss/v2"
 	"github.com/txn2/kubefwd/pkg/fwdapi/types"
 	"github.com/txn2/kubefwd/pkg/fwdtui/styles"
 )
@@ -147,7 +147,7 @@ func (m *BrowseModel) Init() tea.Cmd {
 // Update handles messages for the browse modal
 func (m *BrowseModel) Update(msg tea.Msg) (BrowseModel, tea.Cmd) {
 	switch msg := msg.(type) {
-	case tea.KeyMsg:
+	case tea.KeyPressMsg:
 		return m.handleKeyMsg(msg)
 
 	case BrowseContextsLoadedMsg:
@@ -209,7 +209,7 @@ func (m *BrowseModel) Update(msg tea.Msg) (BrowseModel, tea.Cmd) {
 }
 
 // handleKeyMsg handles keyboard input
-func (m *BrowseModel) handleKeyMsg(msg tea.KeyMsg) (BrowseModel, tea.Cmd) {
+func (m *BrowseModel) handleKeyMsg(msg tea.KeyPressMsg) (BrowseModel, tea.Cmd) {
 	// Always allow 'q' to close the modal, even during loading
 	if msg.String() == "q" {
 		m.Hide()
@@ -245,7 +245,7 @@ func (m *BrowseModel) handleKeyMsg(msg tea.KeyMsg) (BrowseModel, tea.Cmd) {
 }
 
 // handleNamespacesViewKey handles keys in namespaces view
-func (m *BrowseModel) handleNamespacesViewKey(msg tea.KeyMsg) (BrowseModel, tea.Cmd) {
+func (m *BrowseModel) handleNamespacesViewKey(msg tea.KeyPressMsg) (BrowseModel, tea.Cmd) {
 	switch msg.String() {
 	case "q", "esc", "f":
 		m.Hide()
@@ -301,7 +301,7 @@ func (m *BrowseModel) handleNamespacesViewKey(msg tea.KeyMsg) (BrowseModel, tea.
 }
 
 // handleContextsViewKey handles keys in contexts view
-func (m *BrowseModel) handleContextsViewKey(msg tea.KeyMsg) (BrowseModel, tea.Cmd) {
+func (m *BrowseModel) handleContextsViewKey(msg tea.KeyPressMsg) (BrowseModel, tea.Cmd) {
 	switch msg.String() {
 	case "q":
 		m.Hide()
@@ -345,7 +345,7 @@ func (m *BrowseModel) handleContextsViewKey(msg tea.KeyMsg) (BrowseModel, tea.Cm
 }
 
 // handleServicesViewKey handles keys in services view
-func (m *BrowseModel) handleServicesViewKey(msg tea.KeyMsg) (BrowseModel, tea.Cmd) {
+func (m *BrowseModel) handleServicesViewKey(msg tea.KeyPressMsg) (BrowseModel, tea.Cmd) {
 	switch msg.String() {
 	case "q":
 		m.Hide()
```

**File**: `pkg/fwdtui/components/browse_test.go` (modified, +44/-3)
```diff
@@ -4,7 +4,7 @@ import (
 	"strings"
 	"testing"
 
-	tea "github.com/charmbracelet/bubbletea"
+	tea "charm.land/bubbletea/v2"
 	"github.com/txn2/kubefwd/pkg/fwdapi/types"
 )
 
@@ -167,8 +167,49 @@ func createBrowseModelWithData() BrowseModel {
 	return m
 }
 
-func keyMsg(key string) tea.KeyMsg {
-	return tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune(key)}
+// keyMsg builds a Bubble Tea v2 key-press message whose String() matches the
+// given keystroke (e.g. "j", "tab", "enter", "esc", "ctrl+u", "/").
+func keyMsg(key string) tea.KeyPressMsg {
+	switch key {
+	case "tab":
+		return tea.KeyPressMsg{Code: tea.KeyTab}
+	case "shift+tab":
+		return tea.KeyPressMsg{Code: tea.KeyTab, Mod: tea.ModShift}
+	case "enter":
+		return tea.KeyPressMsg{Code: tea.KeyEnter}
+	case "esc", "escape":
+		return tea.KeyPressMsg{Code: tea.KeyEscape}
+	case "up":
+		return tea.KeyPressMsg{Code: tea.KeyUp}
+	case "down":
+		return tea.KeyPressMsg{Code: tea.KeyDown}
+	case "left":
+		return tea.KeyPressMsg{Code: tea.KeyLeft}
+	case "right":
+		return tea.KeyPressMsg{Code: tea.KeyRight}
+	case "home":
+		return tea.KeyPressMsg{Code: tea.KeyHome}
+	case "end":
+		return tea.KeyPressMsg{Code: tea.KeyEnd}
+	case "pgup":
+		return tea.KeyPressMsg{Code: tea.KeyPgUp}
+	case "pgdown":
+		return tea.KeyPressMsg{Code: tea.KeyPgDown}
+	case "backspace":
+		return tea.KeyPressMsg{Code: tea.KeyBackspace}
+	case "space":
+		return tea.KeyPressMsg{Code: tea.KeySpace}
+	}
+	// ctrl+<x> chords, e.g. "ctrl+u".
+	if strings.HasPrefix(key, "ctrl+") && len([]rune(key)) == 6 {
+		return tea.KeyPressMsg{Code: rune(key[5]), Mod: tea.ModCtrl}
+	}
+	// Single printable rune.
+	if r := []rune(key); len(r) == 1 {
+		return tea.KeyPressMsg{Code: r[0], Text: key}
+	}
+	// Fallback: treat as literal text input.
+	return tea.KeyPressMsg{Text: key}
 }
 
 // =============================================================================
```

**File**: `pkg/fwdtui/components/components_test.go` (modified, +82/-82)
```diff
@@ -6,7 +6,7 @@ import (
 	"testing"
 	"time"
 
-	tea "github.com/charmbracelet/bubbletea"
+	tea "charm.land/bubbletea/v2"
 	"github.com/sirupsen/logrus"
 	"github.com/txn2/kubefwd/pkg/fwdtui/state"
 )
@@ -199,7 +199,7 @@ func TestHelpModel_CloseWithEscape(t *testing.T) {
 	m.Show()
 
 	// Send escape key
-	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyEscape})
+	updated, _ := m.Update(keyMsg("esc"))
 	m = updated
 
 	if m.IsVisible() {
@@ -212,7 +212,7 @@ func TestHelpModel_CloseWithQ(t *testing.T) {
 	m.Show()
 
 	// Send 'q' key
-	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("q")})
+	updated, _ := m.Update(keyMsg("q"))
 	m = updated
 
 	if m.IsVisible() {
@@ -225,7 +225,7 @@ func TestHelpModel_CloseWithQuestionMark(t *testing.T) {
 	m.Show()
 
 	// Send '?' key
-	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("?")})
+	updated, _ := m.Update(keyMsg("?"))
 	m = updated
 
 	if m.IsVisible() {
@@ -497,7 +497,7 @@ func TestLogsModel_NavigationDisablesAutoFollow(t *testing.T) {
 	}
 
 	// Press 'k' (scroll up) - should disable auto-follow
-	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("k")})
+	updated, _ := m.Update(keyMsg("k"))
 	m = updated
 
 	view := m.View()
@@ -581,7 +581,7 @@ func TestLogsModel_VimNavigation(t *testing.T) {
 	}
 
 	// Test 'G' goes to bottom and enables auto-follow
-	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("G")})
+	updated, _ := m.Update(keyMsg("G"))
 	m = updated
 
 	view := m.View()
@@ -612,7 +612,7 @@ func TestServicesModel_FilterModeActivation(t *testing.T) {
 	m.Refresh()
 
 	// Press '/' to activate filter mode
-	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("/")})
+	updated, _ := m.Update(keyMsg("/"))
 	m = updated
 
 	if !m.IsFiltering() {
@@ -626,15 +626,15 @@ func TestServicesModel_FilterInput(t *testing.T) {
 	m.Refresh()
 
 	// Activate filter mode
-	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("/")})
+	updated, _ := m.Update(keyMsg("/"))
 	m = updated
 
 	// Type some filter text
-	updated, _ = m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("s")})
+	updated, _ = m.Update(keyMsg("s"))
 	m = updated
-	updated, _ = m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("v")})
+	updated, _ = m.Update(keyMsg("v"))
 	m = updated
-	updated, _ = m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("c")})
+	updated, _ = m.Update(keyMsg("c"))
 	m = updated
 
 	view := m.View()
@@ -649,11 +649,11 @@ func TestServicesModel_FilterEscape(t *testing.T) {
 	m.Refresh()
 
 	// Activate filter mode
-	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("/")})
+	updated, _ := m.Update(keyMsg("/"))
 	m = updated
 
 	// Press escape to exit filter mode
-	updated, _ = m.Update(tea.KeyMsg{Type: tea.KeyEscape})
+	updated, _ = m.Update(keyMsg("esc"))
 	m = updated
 
 	if m.IsFiltering() {
@@ -672,7 +672,7 @@ func TestServicesModel_BandwidthToggle(t *testing.T) {
 	hasBandwidth1 := strings.Contains(view1, "Rate In") || strings.Contains(view1, "Total In")
 
 	// Toggle bandwidth with 'b'
-	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("b")})
+	updated, _ := m.Update(keyMsg("b"))
 	m = updated
 
 	// Get updated view
@@ -695,7 +695,7 @@ func TestServicesModel_CompactViewToggle(t *testing.T) {
 	view1 := m.View()
 
 	// Toggle compact view with 'c'
-	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("c")})
+	updated, _ := m.Update(keyMsg("c"))
 	m = updated
 
 	// Get updated view
@@ -891,23 +891,23 @@ func TestDetailModel_TabSwitching(t *testing.T) {
 	}
 
 	// Press tab to go to HTTP
-	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyTab})
+	updated, _ := m.Update(keyMsg("tab"))
 	m = updated
 
 	if m.GetCurrentTab() != TabHTTP {
 		t.Errorf("Expected tab to be HTTP (1) after Tab, got %d", m.GetCurrentTab())
 	}
 
 	// Press tab again to go to Logs
-	updated, _ = m.Update(tea.KeyMsg{Type: tea.KeyTab})
+	updated, _ = m.Update(keyMsg("tab"))
 	m = updated
 
 	if m.GetCurrentTab() != TabLogs {
 		t.Errorf("Expected tab to be Logs (2) after second Tab, got %d", m.GetCurrentTab())
 	}
 
 	// Press tab again to wrap to Info
-	updated, _ = m.Update(tea.KeyMsg{Type: tea.KeyTab})
+	updated, _ = m.Update(keyMsg("tab"))
 	m = updated
 
 	if m.GetCurrentTab() != TabInfo {
@@ -922,7 +922,7 @@ func TestDetailModel_TabSwitchingWithShiftTab(t *testing.T) {
 	m.SetSize(80, 40)
 
 	// Press shift+tab to go backwards
-	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyShiftTab})
+	updated, _ := m.Update(keyMsg("shift+tab"))
 	m = updated
 
 	if m.GetCurrentTab() != TabLogs {
@@ -942,7 +942,7 @@ func TestDetailModel_TabSwitchingWithArrows(t *testing.T) {
 	}
 
 	// Press right arrow - use KeyRight type
-	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyRight})
+	updated, _ := m.Update(keyMsg("right"))
 	m = updated
 
 	if m.GetCurrentTab() != TabHTTP {
@@ -1069,7 +1069,7 @@ func TestDetailModel_CloseWithEscape(t *testing.T) {
 
```

**File**: `pkg/fwdtui/components/detail.go` (modified, +12/-12)
```diff
@@ -9,9 +9,9 @@ import (
 	"strings"
 	"time"
 
-	"github.com/charmbracelet/bubbles/viewport"
-	tea "github.com/charmbracelet/bubbletea"
-	"github.com/charmbracelet/lipgloss"
+	"charm.land/bubbles/v2/viewport"
+	tea "charm.land/bubbletea/v2"
+	"charm.land/lipgloss/v2"
 	"github.com/txn2/kubefwd/pkg/fwdtui/state"
 	"github.com/txn2/kubefwd/pkg/fwdtui/styles"
 )
@@ -143,8 +143,8 @@ func (m *DetailModel) SetSize(width, height int) {
 
 	// Resize logs viewport if ready
 	if m.logsViewportReady {
-		m.logsViewport.Width = m.getLogsViewportWidth()
-		m.logsViewport.Height = m.getLogsViewportHeight()
+		m.logsViewport.SetWidth(m.getLogsViewportWidth())
+		m.logsViewport.SetHeight(m.getLogsViewportHeight())
 		m.updateLogsViewportContent()
 	}
 }
@@ -248,7 +248,7 @@ func (m *DetailModel) initLogsViewport() {
 	if m.logsViewportReady {
 		return
 	}
-	m.logsViewport = viewport.New(m.getLogsViewportWidth(), m.getLogsViewportHeight())
+	m.logsViewport = viewport.New(viewport.WithWidth(m.getLogsViewportWidth()), viewport.WithHeight(m.getLogsViewportHeight()))
 	m.logsViewport.MouseWheelEnabled = true
 	m.logsViewportReady = true
 	m.updateLogsViewportContent()
@@ -505,7 +505,7 @@ func (m *DetailModel) handleHomeEnd(key string) (DetailModel, tea.Cmd) {
 }
 
 // handleKeyMsg handles all keyboard input
-func (m *DetailModel) handleKeyMsg(msg tea.KeyMsg) (DetailModel, tea.Cmd) {
+func (m *DetailModel) handleKeyMsg(msg tea.KeyPressMsg) (DetailModel, tea.Cmd) {
 	key := msg.String()
 
 	// Number keys 1-9 for copying connect strings
@@ -535,16 +535,16 @@ func (m *DetailModel) handleKeyMsg(msg tea.KeyMsg) (DetailModel, tea.Cmd) {
 }
 
 // handleMouseMsg handles mouse input
-func (m *DetailModel) handleMouseMsg(msg tea.MouseMsg) (DetailModel, tea.Cmd) {
+func (m *DetailModel) handleMouseMsg(msg tea.MouseWheelMsg) (DetailModel, tea.Cmd) {
 	switch msg.Button {
-	case tea.MouseButtonWheelUp:
+	case tea.MouseWheelUp:
 		if m.currentTab == TabHTTP {
 			m.handleHTTPScroll(-3)
 			return *m, nil
 		} else if m.currentTab == TabLogs && m.logsViewportReady {
 			m.logsAutoFollow = false
 		}
-	case tea.MouseButtonWheelDown:
+	case tea.MouseWheelDown:
 		if m.currentTab == TabHTTP {
 			m.handleHTTPScroll(3)
 			return *m, nil
@@ -564,11 +564,11 @@ func (m *DetailModel) Update(msg tea.Msg) (DetailModel, tea.Cmd) {
 		return m.handlePodLogLine(msg.Line)
 	case PodLogsErrorMsg:
 		return m.handlePodLogsError(msg.Error)
-	case tea.KeyMsg:
+	case tea.KeyPressMsg:
 		return m.handleKeyMsg(msg)
 	case tea.WindowSizeMsg:
 		m.SetSize(msg.Width, msg.Height)
-	case tea.MouseMsg:
+	case tea.MouseWheelMsg:
 		return m.handleMouseMsg(msg)
 	}
 
```

**File**: `pkg/fwdtui/components/header.go` (modified, +2/-2)
```diff
@@ -4,8 +4,8 @@ import (
 	"fmt"
 	"strings"
 
-	tea "github.com/charmbracelet/bubbletea"
-	"github.com/charmbracelet/lipgloss"
+	tea "charm.land/bubbletea/v2"
+	"charm.land/lipgloss/v2"
 	"github.com/txn2/kubefwd/pkg/fwdtui/styles"
 )
 
```

---

### Incident Patch 8: `8ded4dde` (2026-06-03)
**Commit Message**: deps: bump github.com/quic-go/quic-go (#511)

Bumps the go_modules group with 1 update in the / directory: [github.com/quic-go/quic-go](https://github.com/quic-go/quic-go).


Updates `github.com/quic-go/quic-go` from 0.59.0 to 0.59.1
- [Release notes](https://github.com/quic-go/quic-go/releases)
- [Commits](https://github.com/quic-go/quic-go/compare/v0.59.0...v0.59.1)

---
updated-dependencies:
- dependency-name: github.com/quic-go/quic-go
  dependency-version: 0.59.1
  dependency-type: indirect
  dependency-group: go_modules
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -91,7 +91,7 @@ require (
 	github.com/peterbourgon/diskv v2.0.1+incompatible // indirect
 	github.com/pmezard/go-difflib v1.0.1-0.20181226105442-5d4384ee4fb2 // indirect
 	github.com/quic-go/qpack v0.6.0 // indirect
-	github.com/quic-go/quic-go v0.59.0 // indirect
+	github.com/quic-go/quic-go v0.59.1 // indirect
 	github.com/rivo/uniseg v0.4.7 // indirect
 	github.com/russross/blackfriday/v2 v2.1.0 // indirect
 	github.com/segmentio/asm v1.1.3 // indirect
```

**File**: `go.sum` (modified, +2/-2)
```diff
@@ -182,8 +182,8 @@ github.com/pmezard/go-difflib v1.0.1-0.20181226105442-5d4384ee4fb2 h1:Jamvg5psRI
 github.com/pmezard/go-difflib v1.0.1-0.20181226105442-5d4384ee4fb2/go.mod h1:iKH77koFhYxTK1pcRnkKkqfTogsbg7gZNVY4sRDYZ/4=
 github.com/quic-go/qpack v0.6.0 h1:g7W+BMYynC1LbYLSqRt8PBg5Tgwxn214ZZR34VIOjz8=
 github.com/quic-go/qpack v0.6.0/go.mod h1:lUpLKChi8njB4ty2bFLX2x4gzDqXwUpaO1DP9qMDZII=
-github.com/quic-go/quic-go v0.59.0 h1:OLJkp1Mlm/aS7dpKgTc6cnpynnD2Xg7C1pwL6vy/SAw=
-github.com/quic-go/quic-go v0.59.0/go.mod h1:upnsH4Ju1YkqpLXC305eW3yDZ4NfnNbmQRCMWS58IKU=
+github.com/quic-go/quic-go v0.59.1 h1:0Gmua0HW1Tv7ANR7hUYwRyD0MG5OJfgvYSZasGZzBic=
+github.com/quic-go/quic-go v0.59.1/go.mod h1:upnsH4Ju1YkqpLXC305eW3yDZ4NfnNbmQRCMWS58IKU=
 github.com/rivo/uniseg v0.1.0/go.mod h1:J6wj4VEh+S6ZtnVlnTBMWIodfgj8LQOQFoIToxlJtxc=
 github.com/rivo/uniseg v0.2.0/go.mod h1:J6wj4VEh+S6ZtnVlnTBMWIodfgj8LQOQFoIToxlJtxc=
 github.com/rivo/uniseg v0.4.7 h1:WUdvkW8uEhrYfLC4ZzdpI2ztxP1I582+49Oc5Mq64VQ=
```

---

### Incident Patch 9: `fd564d92` (2026-05-29)
**Commit Message**: fix: restore dead ports on multi-port service reconnect (#509) (#510)

* build: write verify sentinel for the pre-commit review gate

The local pre-commit gate (~/.claude/hooks/review-gate.sh) requires
`make verify` to record the working-tree diff hash to
.claude/.last-verify-passed on success, but the verify target never
wrote it, so the gate could never be satisfied. Add a write-verify-sentinel
step that records the same hash the gate computes. .claude is gitignored,
so writing the sentinel does not alter the diff.

* fix: restore dead ports on multi-port service reconnect (#509)

A multi-port normal service could enter an unrecoverable zombie state
after one port's connection was reset (e.g. the TCP RST behavior of
kubernetes/kubernetes#111825 that kills a single port's kubelet
listener). Auto-reconnect re-ran SyncPodForwards, found the pod, but
never recreated the dead port or restored its /etc/hosts entries.

Root cause is in syncNormalService: it tracked a single forward KEY to
keep (one port) and skipped LoopPodsToForward entirely whenever any
forward for the pod still existed. The surviving port's map entry caused
the dead port to be skipped forever. This also degraded heal

**File**: `Makefile` (modified, +14/-0)
```diff
@@ -22,9 +22,23 @@ GO ?= go
 
 .PHONY: verify
 verify: check-go-version tidy-check lint test build validate-actions patch-coverage
+	@$(MAKE) --no-print-directory write-verify-sentinel
 	@echo ""
 	@echo "==> verify: all checks passed"
 
+# Record that verify passed against the current working-tree diff. The
+# pre-commit review gate (~/.claude/hooks/review-gate.sh) reads this
+# sentinel and must find the same diff hash it computes, otherwise it
+# blocks the commit. The hash must match the gate's:
+#   { git diff --cached HEAD; git diff; } | shasum -a 256 | cut -c1-16
+# .claude is gitignored, so writing the sentinel does not alter the diff.
+.PHONY: write-verify-sentinel
+write-verify-sentinel:
+	@if git rev-parse --git-dir >/dev/null 2>&1; then \
+	  mkdir -p .claude; \
+	  { git diff --cached HEAD; git diff; } | shasum -a 256 | cut -c1-16 > .claude/.last-verify-passed; \
+	fi
+
 .PHONY: check-go-version
 check-go-version:
 	@have=$$($(GO) env GOVERSION | sed 's/^go//'); \
```

**File**: `pkg/fwdservice/fwdservice.go` (modified, +37/-9)
```diff
@@ -375,12 +375,15 @@ func (svcFwd *ServiceFWD) podStillEligible(podName string, k8sPods []v1.Pod) boo
 	return false
 }
 
-// findKeyToKeep finds a forward key for a pod that is still eligible
-func (svcFwd *ServiceFWD) findKeyToKeep(k8sPods []v1.Pod) string {
+// findPodNameToKeep finds the name of a currently-forwarded pod that is still
+// eligible. For a normal service we forward exactly one pod (all of its ports),
+// so this identifies which pod we should keep forwarding to. Returns "" if none
+// of the currently-forwarded pods are still eligible.
+func (svcFwd *ServiceFWD) findPodNameToKeep(k8sPods []v1.Pod) string {
 	forwards := svcFwd.getForwardInfos()
 	for _, fwd := range forwards {
 		if svcFwd.podStillEligible(fwd.podName, k8sPods) {
-			return fwd.key
+			return fwd.podName
 		}
 	}
 	return ""
@@ -392,21 +395,46 @@ func (svcFwd *ServiceFWD) syncHeadlessService(k8sPods []v1.Pod) {
 	svcFwd.LoopPodsToForward(k8sPods, true)
 }
 
-// syncNormalService syncs forwards for a normal (non-headless) service
+// syncNormalService syncs forwards for a normal (non-headless) service.
+//
+// A normal service forwards a single pod, but that pod may expose multiple
+// ports, each tracked as a separate entry in PortForwards (key:
+// "service.podname.localport"). We therefore reason in terms of the pod NAME to
+// keep, not a single forward key: all forwards belonging to the kept pod must be
+// preserved, and forwards belonging to any other pod removed.
+//
+// Crucially, we always (re)invoke LoopPodsToForward for the kept pod so that any
+// of its ports that are not currently forwarded get re-established.
+// LoopPodsToForward skips ports that already exist, so this is a no-op for a
+// fully-healthy pod, but it recovers a multi-port service when a single port's
+// connection was reset and torn down independently (e.g. the TCP RST behavior of
+// kubernetes/kubernetes#111825). Without this, the surviving port's map entry
+// caused the dead port (and the service's /etc/hosts entries) to never be
+// restored, leaving the service in an unrecoverable zombie state (issue #509).
 func (svcFwd *ServiceFWD) syncNormalService(k8sPods []v1.Pod) {
-	keyToKeep := svcFwd.findKeyToKeep(k8sPods)
+	podNameToKeep := svcFwd.findPodNameToKeep(k8sPods)
 
-	// Remove forwards for pods we're not keeping
+	// Remove forwards belonging to any pod other than the one we're keeping.
 	forwards := svcFwd.getForwardInfos()
 	for _, fwd := range forwards {
-		if fwd.key != keyToKeep {
+		if fwd.podName != podNameToKeep {
 			svcFwd.RemoveServicePod(fwd.key)
 		}
 	}
 
-	// Start new forward if needed
-	if keyToKeep == "" {
+	if podNameToKeep == "" {
+		// No good pod is currently forwarded - start forwarding the first eligible pod.
 		svcFwd.LoopPodsToForward([]v1.Pod{k8sPods[0]}, false)
+		return
+	}
+
+	// Already forwarding a good pod. Ensure ALL of its ports are forwarded,
+	// re-establishing any that were torn down independently.
+	for i := range k8sPods {
+		if k8sPods[i].Name == podNameToKeep {
+			svcFwd.LoopPodsToForward([]v1.Pod{k8sPods[i]}, false)
+			return
+		}
 	}
 }
 
```

**File**: `pkg/fwdservice/fwdservice_test.go` (modified, +165/-0)
```diff
@@ -722,6 +722,171 @@ func TestSyncPodForwards_RemovesStoppedPods_FullKeyFormat(t *testing.T) {
 	}
 }
 
+// TestSyncPodForwards_MultiPort_RestoresDeadPort is a regression test for issue #509.
+//
+// A multi-port normal service can lose one port's forward independently (e.g. the
+// TCP RST behavior of kubernetes/kubernetes#111825 tears down a single port's
+// listener). Auto-reconnect re-runs SyncPodForwards, which must re-establish the
+// missing port while keeping the surviving one. Previously syncNormalService kept
+// only a single forward KEY for the pod and skipped LoopPodsToForward entirely
+// when any forward existed, so the dead port was never recreated and the service
+// was stuck in an unrecoverable zombie state.
+//
+//goland:noinspection DuplicatedCode
+func TestSyncPodForwards_MultiPort_RestoresDeadPort(t *testing.T) {
+	cleanup := setupMockInterface()
+	defer cleanup()
+
+	restClient, restCleanup := setupMockRESTClient()
+	defer restCleanup()
+
+	namespace := "default"
+	labels := map[string]string{"app": "test"}
+
+	runningPod := createTestPod("running-pod", namespace, v1.PodRunning, labels)
+	clientset := fake.NewClientset(runningPod)
+
+	// Two-port service: port A (80) and port B (9100).
+	svc := createTestService("test-svc", namespace, []v1.ServicePort{
+		{Port: 80, TargetPort: intstr.FromInt32(8080), Protocol: v1.ProtocolTCP},
+		{Port: 9100, TargetPort: intstr.FromInt32(9100), Protocol: v1.ProtocolTCP},
+	}, false)
+
+	hosts, err := txeh.NewHosts(&txeh.HostsConfig{})
+	if err != nil {
+		t.Fatalf("Failed to create txeh.Hosts: %v", err)
+	}
+	hostFile := &fwdport.HostFileWithLock{Hosts: hosts}
+
+	debouncer := &mockDebouncer{immediate: true}
+
+	svcFwd := &ServiceFWD{
+		ClientSet:            clientset,
+		Svc:                  svc,
+		PodLabelSelector:     "app=test",
+		Headless:             false,
+		Context:              "test-context",
+		Namespace:            namespace,
+		PortForwards:         make(map[string]*fwdport.PortForwardOpts),
+		NamespaceServiceLock: &sync.Mutex{},
+		Hostfile:             hostFile,
+		SyncDebouncer:        debouncer.debounce,
+		LastSyncedAt:         time.Now().Add(-10 * time.Minute),
+		RESTClient:           restClient,
+	}
+
+	// Simulate the state after port A (80) was reset and cleaned up: only port B
+	// (9100) remains in the map, pointing at a still-eligible pod.
+	survivingPort := &fwdport.PortForwardOpts{
+		PodName:        "running-pod",
+		Service:        "test-svc",
+		LocalPort:      "9100",
+		Namespace:      namespace,
+		Context:        "test-context",
+		ManualStopChan: make(chan struct{}),
+		DoneChan:       make(chan struct{}),
+	}
+	svcFwd.PortForwards["test-svc.running-pod.9100"] = survivingPort
+
+	// Auto-reconnect re-runs the sync.
+	svcFwd.SyncPodForwards(true)
+
+	// Give goroutines time to register the recreated forward.
+	time.Sleep(200 * time.Millisecond)
+
+	svcFwd.NamespaceServiceLock.Lock()
+	_, hasPortA := svcFwd.PortForwards["test-svc.running-pod.80"]
+	_, hasPortB := svcFwd.PortForwards["test-svc.running-pod.9100"]
+	count := len(svcFwd.PortForwards)
+	svcFwd.NamespaceServiceLock.Unlock()
+
+	if !hasPortB {
+		t.Error("Surviving port 9100 should have been kept, but it was removed")
+	}
+	if !hasPortA {
+		t.Error("Dead port 80 should have been re-established by SyncPodForwards, but it is missing. " +
+			"This is a regression of issue #509 (multi-port service stuck in zombie state after a single port's RST).")
+	}
+	if count != 2 {
+		t.Errorf("Expected 2 forwards (both ports of the pod), got %d", count)
+	}
+}
+
+// TestSyncPodForwards_MultiPort_HealthyResyncKeepsAllPorts verifies that a routine
+// resync of a healthy multi-port service does not drop ports. Regression test for
+// the broader bug behind issue #509: syncNormalService used to keep only a single
+// forward key and remove the rest, so a multi-port service would degrade to one
+// port on the first forced resync.
+//
+//goland:noinspection DuplicatedCode
+func TestSyncPodForwards_MultiPort_HealthyResyncKeepsAllPorts(t *testing.T) {
+	cleanup := setupMockInterface()
+	defer cleanup()
+
+	restClient, restCleanup := setupMockRESTClient()
+	defer restCleanup()
+
+	namespace := "default"
+	labels := map[string]string{"app": "test"}
+
+	runningPod := createTestPod("running-pod", namespace, v1.PodRunning, labels)
+	clientset := fake.NewClientset(runningPod)
+
+	svc := createTestService("test-svc", namespace, []v1.ServicePort{
+		{Port: 80, TargetPort: intstr.FromInt32(8080), Protocol: v1.ProtocolTCP},
+		{Port: 9100, TargetPort: intstr.FromInt32(9100), Protocol: v1.ProtocolTCP},
+	}, false)
+
+	hosts, err := txeh.NewHosts(&txeh.HostsConfig{})
+	if err != nil {
+		t.Fatalf("Failed to create txeh.Hosts: %v", err)
+	}
+	hostFile := &fwdport.HostFileWithLock{Hosts: hosts}
+
+	debouncer := &mockDebouncer{immediate: true}
+
+	svcFwd := &ServiceFWD{
+		ClientSet:            clientset,
+		Svc:                  svc,
+		PodLabelSelector:     "app=test",
+		Headle
```

**File**: `test/integration/multiport_reconnect_test.go` (added, +148/-0)
```diff
@@ -0,0 +1,148 @@
+//go:build integration
+// +build integration
+
+package integration
+
+import (
+	"fmt"
+	"io"
+	"net/http"
+	"regexp"
+	"strings"
+	"testing"
+	"time"
+)
+
+// apiBase is the kubefwd REST API base URL. The API server binds a
+// dedicated loopback IP (see pkg/fwdapi/manager.go: APIIP/APIPort) and is
+// enabled with --api.
+const apiBase = "http://127.2.27.1/api"
+
+// TestMultiPortReconnect is the end-to-end regression test for issue #509.
+//
+// A multi-port normal service must keep ALL of its ports forwarded across a
+// resync. Previously syncNormalService kept a single forward key and dropped
+// the rest, so a resync (the path auto-reconnect drives after a single port's
+// connection is reset) left the service unable to recover the dropped port and
+// removed its shared /etc/hosts entry.
+//
+// Reproducing the exact upstream RST trigger (kubernetes/kubernetes#111825) is
+// not deterministic, so this test drives the same code path deterministically:
+// it forces a resync via the REST API (POST /v1/services/:key/sync?force=true,
+// which calls SyncPodForwards(true)) and asserts every port still serves
+// afterwards. On the pre-fix code this forced sync stopped one port and removed
+// the `multiport` hostname, breaking both ports.
+//
+//goland:noinspection DuplicatedCode
+func TestMultiPortReconnect(t *testing.T) {
+	requiresSudo(t)
+	requiresKindCluster(t)
+
+	// Use a known API key so the test can authenticate. startKubefwd copies
+	// os.Environ() into the child process, so set it before starting.
+	const apiKey = "kubefwd-integration-test-key"
+	t.Setenv("KUBEFWD_API_KEY", apiKey)
+
+	// Start kubefwd with auto-reconnect and the REST API enabled.
+	cmd := startKubefwd(t, "svc", "-n", "test-multiport", "-a", "--api", "-v")
+	defer stopKubefwd(t, cmd)
+
+	t.Log("Waiting for initial forwarding to stabilize...")
+	time.Sleep(10 * time.Second)
+
+	// Both ports must serve before we do anything.
+	assertPortServes(t, "http://multiport:80/", "ok-80", "before resync")
+	assertPortServes(t, "http://multiport:8080/", "ok-8080", "before resync")
+	t.Log("✓ Both ports serving before resync")
+
+	// Discover the registry key for the multiport service via the API.
+	key := discoverServiceKey(t, apiKey, "multiport.test-multiport.")
+	t.Logf("Service key: %s", key)
+
+	// Force a resync — the exact code path auto-reconnect drives. On pre-fix
+	// code this drops one port and removes the shared hostname.
+	t.Log("Forcing resync via API...")
+	forceSync(t, apiKey, key)
+
+	// Give the async SyncPodForwards time to run.
+	time.Sleep(8 * time.Second)
+
+	// The crux of #509: after the resync BOTH ports must still serve.
+	assertPortServes(t, "http://multiport:80/", "ok-80", "after resync (#509)")
+	assertPortServes(t, "http://multiport:8080/", "ok-8080", "after resync (#509)")
+	t.Log("✓ Both ports still serving after resync — #509 fixed")
+}
+
+// assertPortServes fails the test if the URL does not return HTTP 200 with the
+// expected body substring. A removed /etc/hosts entry surfaces here as a DNS
+// lookup failure.
+func assertPortServes(t *testing.T, url, wantBody, phase string) {
+	t.Helper()
+
+	resp, err := httpGet(url, 5, 1*time.Second)
+	if err != nil {
+		t.Fatalf("[%s] %s did not respond: %v", phase, url, err)
+	}
+	defer resp.Body.Close()
+
+	body, _ := io.ReadAll(resp.Body)
+	if resp.StatusCode != http.StatusOK {
+		t.Fatalf("[%s] %s returned HTTP %d (expected 200)", phase, url, resp.StatusCode)
+	}
+	if !strings.Contains(string(body), wantBody) {
+		t.Fatalf("[%s] %s body %q does not contain %q", phase, url, string(body), wantBody)
+	}
+}
+
+// discoverServiceKey queries the API service list and returns the first
+// registry key with the given prefix.
+func discoverServiceKey(t *testing.T, apiKey, prefix string) string {
+	t.Helper()
+
+	req, err := http.NewRequest(http.MethodGet, apiBase+"/v1/services", nil)
+	if err != nil {
+		t.Fatalf("failed to build services request: %v", err)
+	}
+	req.Header.Set("Authorization", "Bearer "+apiKey)
+
+	resp, err := http.DefaultClient.Do(req)
+	if err != nil {
+		t.Fatalf("failed to list services via API: %v", err)
+	}
+	defer resp.Body.Close()
+
+	body, _ := io.ReadAll(resp.Body)
+	if resp.StatusCode != http.StatusOK {
+		t.Fatalf("services list returned HTTP %d: %s", resp.StatusCode, string(body))
+	}
+
+	re := regexp.MustCompile(regexp.QuoteMeta(prefix) + `[A-Za-z0-9._-]+`)
+	key := re.FindString(string(body))
+	if key == "" {
+		t.Fatalf("no service key with prefix %q found in API response: %s", prefix, string(body))
+	}
+	return key
+}
+
+// forceSync issues a forced resync for the given service key.
+func forceSync(t *testing.T, apiKey, key string) {
+	t.Helper()
+
+	url := fmt.Sprintf("%s/v1/services/%s/sync?force=true", apiBase, key)
+	req, err := http.NewRequest(http.MethodPost, url, nil)
+	if err != nil {
+		t.Fatalf("failed to build sync request: %v", err)
+	}
+	req.Header.Set("Authorization", "Bearer "+apiKey)
+
+	resp, e
```

**File**: `test/manifests/multiport-service.yaml` (added, +80/-0)
```diff
@@ -0,0 +1,80 @@
+apiVersion: v1
+kind: Namespace
+metadata:
+  name: test-multiport
+---
+# Single nginx serving two ports (80 and 8080) so one pod backs a
+# multi-port service. Used by the #509 reconnect regression test, which
+# verifies a forced resync keeps every port of the service forwarded.
+apiVersion: v1
+kind: ConfigMap
+metadata:
+  name: multiport-nginx
+  namespace: test-multiport
+data:
+  nginx.conf: |
+    events {}
+    http {
+      server {
+        listen 80;
+        location / { return 200 'ok-80\n'; }
+      }
+      server {
+        listen 8080;
+        location / { return 200 'ok-8080\n'; }
+      }
+    }
+---
+apiVersion: v1
+kind: Service
+metadata:
+  name: multiport
+  namespace: test-multiport
+spec:
+  selector:
+    app: multiport
+  ports:
+    - name: http
+      port: 80
+      targetPort: 80
+    - name: http-alt
+      port: 8080
+      targetPort: 8080
+  type: ClusterIP
+---
+apiVersion: apps/v1
+kind: Deployment
+metadata:
+  name: multiport
+  namespace: test-multiport
+spec:
+  replicas: 1
+  selector:
+    matchLabels:
+      app: multiport
+  template:
+    metadata:
+      labels:
+        app: multiport
+    spec:
+      containers:
+        - name: nginx
+          image: nginx:alpine
+          ports:
+            - containerPort: 80
+            - containerPort: 8080
+          volumeMounts:
+            - name: conf
+              mountPath: /etc/nginx/nginx.conf
+              subPath: nginx.conf
+          resources:
+            requests:
+              cpu: 50m
+              memory: 16Mi
+            limits:
+              cpu: 100m
+              memory: 32Mi
+      volumes:
+        - name: conf
+          configMap:
+            name: multiport-nginx
```

---

### Incident Patch 10: `6c42ce8c` (2026-05-29)
**Commit Message**: ci: bump docker/setup-buildx-action from 4.0.0 to 4.1.0 (#505)

Bumps [docker/setup-buildx-action](https://github.com/docker/setup-buildx-action) from 4.0.0 to 4.1.0.
- [Release notes](https://github.com/docker/setup-buildx-action/releases)
- [Commits](https://github.com/docker/setup-buildx-action/compare/4d04d5d9486b7bd6fa91e7baf45bbb4f8b9deedd...d7f5e7f509e45cec5c76c4d5afdd7de93d0b3df5)

---
updated-dependencies:
- dependency-name: docker/setup-buildx-action
  dependency-version: 4.1.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
Co-authored-by: Craig Johnston <[REDACTED_EMAIL]>

**File**: `.github/workflows/release.yml` (modified, +1/-1)
```diff
@@ -42,7 +42,7 @@ jobs:
         uses: docker/setup-qemu-action@ce360397dd3f832beb865e1373c09c0e9f86d70a # v4.0.0
 
       - name: Set up Docker Buildx
-        uses: docker/setup-buildx-action@4d04d5d9486b7bd6fa91e7baf45bbb4f8b9deedd # v4.0.0
+        uses: docker/setup-buildx-action@d7f5e7f509e45cec5c76c4d5afdd7de93d0b3df5 # v4.1.0
 
       - name: Login to Docker Hub
         uses: docker/login-action@650006c6eb7dba73a995cc03b0b2d7f5ca915bee # v4.2.0
```

---

### Incident Patch 11: `e74f6b47` (2026-04-27)
**Commit Message**: docs: PR #473 review fixes + local DESIGN.md adoption record (#474)

* docs: address PR #473 review findings

Fixes the issues surfaced in the post-merge code review of the txn2
re-skin.

- Scope every homepage component class under .page--home (.hero__*,
  .section, .section__*, .flagship*, .terminal*, .stack*, .coda*,
  .ticker*, .dropcap, .outline). Without scoping, any inner-page
  markdown using class="terminal" or class="section" inherited
  homepage display styling.
- Rename .footer (and __rule, __inner, __col, __label, __text,
  __links, __mono, __base) to .home-footer to remove the global
  collision risk and the dead .page--home + .footer adjacent-sibling
  selector.
- Lower body::before / body::after (grain, vignette) from z-index 100
  to z-index 1 so the rail (z 50) and skiplink (z 200) are no longer
  darkened by the vignette.
- Add @supports not selector(:has(*)) fallback so headings with inline
  code still get mono+signal treatment on Firefox <121 / Safari <15.4.
- Guard the rail/footer UTC-clock IIFE with window.__kubefwdClock so
  Material's navigation.instant rehydration does not register a fresh
  setInterval handle on each navigation.
- Add Mermaid theming via

**File**: `DESIGN.md` (added, +243/-0)
```diff
@@ -0,0 +1,243 @@
+---
+version: alpha
+spec: https://github.com/google-labs-code/design.md
+name: kubefwd-docs
+description: Local design adoption record for the kubefwd.com documentation site. References txn2/www DESIGN.md as the canonical visual identity for tokens, typography, components, copyright voice, and accessibility rules. Records only the decisions and MkDocs Material learnings that the canonical does not cover.
+upstream:
+  design: https://github.com/txn2/www/blob/master/DESIGN.md
+  tokens: https://github.com/txn2/www/blob/master/tokens.json
+adoption: token-alignment
+stack:
+  generator: MkDocs
+  theme: Material for MkDocs
+  templates: docs/overrides/
+  styles: docs/stylesheets/extra.css
+---
+
+## What is canonical
+
+The canonical visual identity for txn2 lives in [`txn2/www/DESIGN.md`](https://github.com/txn2/www/blob/master/DESIGN.md) with tokens in [`txn2/www/tokens.json`](https://github.com/txn2/www/blob/master/tokens.json). This file defers to those for everything below. If a value here disagrees with upstream, upstream wins.
+
+| Concern              | Source of truth |
+|----------------------|-----------------|
+| Color palette        | upstream `tokens.json` `color.*` |
+| Typography stack     | upstream `tokens.json` `font.*` |
+| Type scale           | upstream `DESIGN.md` Typography table |
+| Spacing / measure    | upstream `tokens.json` `size.*` |
+| Component contracts  | upstream `DESIGN.md` Components |
+| Voice / copy rules   | upstream `DESIGN.md` Voice and Copy |
+| Accessibility rules  | upstream `DESIGN.md` Do's and Don'ts |
+| Mermaid theme        | upstream `DESIGN.md` `mcp__card--feature` block |
+
+Tokens are mirrored as CSS custom properties in `docs/stylesheets/extra.css` `:root`. They are duplicated for runtime use, not as a divergence point. When upstream changes a token, update the value in `extra.css` and ship.
+
+## Adoption level: token alignment
+
+Per the upstream downstream contract, three levels are valid:
+
+1. Reference. Link to upstream, no visual changes.
+2. Token alignment. Keep MkDocs Material, re-skin via `extra.css` against upstream tokens.
+3. Full re-skin. Replace MkDocs Material with custom layouts.
+
+kubefwd runs at **level 2**. The site keeps Material's instant nav, search, sidebar, version selector, code copy, and content extensions. The visual layer is replaced. The homepage is a custom Material template that takes over `block header`, `block container`, and `block footer` for full-bleed treatment.
+
+## File map
+
+| Path | Role |
+|------|------|
+| `mkdocs.yml`                   | Single dark `slate` palette. `font: false` so CSS loads the upstream Google Fonts URL with trimmed axes. |
+| `docs/index.md`                | Stub front matter with `template: home.html`. All homepage HTML lives in the template. |
+| `docs/overrides/main.html`     | Adds the upstream Google Fonts `<link>` plus OG and Twitter meta. Inherited by every page. |
+| `docs/overrides/home.html`     | Custom homepage template. Overrides `block header` (rail), `block tabs` (empty), `block container` (page--home shell with hero, sections, flagship cards, stack, coda), `block footer` (home-footer). |
+| `docs/stylesheets/extra.css`   | All design rules. Two halves: homepage components scoped under `.page--home`, and Material chrome restyle for inner pages via `[data-md-color-scheme="slate"]` variable overrides. |
+
+## Project-specific components
+
+Components ported from upstream verbatim, with kubefwd content:
+
+- `.rail` (replaces Material `.md-header` on the homepage). Brand links to `./`. Live UTC clock in meta. txn2.com link in meta as `part of <em class="serif">txn2</em> ↗`.
+- `.hero` with three Fraunces rows (kubefwd / kubernetes / port forwards.).
+- `.section`, `.section__index`, `.section__title`.
+- `.flagship__card`. Two cards: `--kubefwd` (TUI mode demo) and a second variant for the API + MCP surfaces. Top accent line animates on hover per upstream spec.
+- `.terminal`, `.terminal__bar`, `.terminal__body` with `.t-prompt`, `.t-ok`, `.t-mute` classes. The only block with shadow.
+- `.stack`, `.stack__row`. Each row links to a real anchor in the docs (architecture/#ip-allocation, advanced-usage/#custom-hosts-file-path, user-guide/#auto-reconnect, user-guide/#interface-overview, api-reference/, mcp-integration/).
+- `.coda` and `.home-footer` (renamed from upstream `.footer` to avoid collision with markdown that uses `class="footer"`; see Learning #5).
+
+Components from upstream **not used** here, with reason:
+
+- `.mcp__card--feature` and the MCP grid. kubefwd is a single project, not an MCP catalog.
+- The `mcp-data-platform` mermaid hero. Not relevant.
+- The 5-column footer's `sponsors / craig` columns. The kubefwd home-footer has `about / docs / interfaces / code / txn2 / org` columns instead, since this site is project-scoped.
+
+Custom additions specific to kubefwd:
+
+- `home-footer__col--meta` includes a `txn2 / org` panel that backlinks t
```

**File**: `docs/overrides/home.html` (modified, +33/-24)
```diff
@@ -301,53 +301,54 @@ <h2 class="section__title">
 </main>
 {% endblock %}
 
-{# Custom homepage footer replaces Material's. #}
+{# Custom homepage footer replaces Material's. Class names prefixed
+   home-footer to avoid global collision with markdown class="footer". #}
 {% block footer %}
-<footer class="footer">
-  <div class="footer__rule" aria-hidden="true"></div>
-  <div class="footer__inner">
-    <div class="footer__col">
-      <p class="footer__label">about</p>
-      <p class="footer__text">A bulk Kubernetes service port-forwarder by <a href="https://imti.co">Craig Johnston</a>, part of the <a href="https://txn2.com">txn2</a> open source organization, sponsored by <a href="https://deasil.works">Deasil Works, Inc.</a> and <a href="https://plexara.io">Plexara</a>.</p>
+<footer class="home-footer">
+  <div class="home-footer__rule" aria-hidden="true"></div>
+  <div class="home-footer__inner">
+    <div class="home-footer__col">
+      <p class="home-footer__label">about</p>
+      <p class="home-footer__text">A bulk Kubernetes service port-forwarder by <a href="https://imti.co">Craig Johnston</a>, part of the <a href="https://txn2.com">txn2</a> open source organization, sponsored by <a href="https://deasil.works">Deasil Works, Inc.</a> and <a href="https://plexara.io">Plexara</a>.</p>
     </div>
-    <div class="footer__col">
-      <p class="footer__label">docs</p>
-      <ul class="footer__links">
+    <div class="home-footer__col">
+      <p class="home-footer__label">docs</p>
+      <ul class="home-footer__links">
         <li><a href="getting-started/">getting started</a></li>
         <li><a href="user-guide/">user guide</a></li>
         <li><a href="configuration/">configuration</a></li>
         <li><a href="advanced-usage/">advanced usage</a></li>
         <li><a href="troubleshooting/">troubleshooting</a></li>
       </ul>
     </div>
-    <div class="footer__col">
-      <p class="footer__label">interfaces</p>
-      <ul class="footer__links">
+    <div class="home-footer__col">
+      <p class="home-footer__label">interfaces</p>
+      <ul class="home-footer__links">
         <li><a href="api-reference/">rest api</a></li>
         <li><a href="mcp-integration/">mcp integration</a></li>
         <li><a href="architecture/">architecture</a></li>
         <li><a href="comparison/">comparison</a></li>
       </ul>
     </div>
-    <div class="footer__col">
-      <p class="footer__label">code</p>
-      <ul class="footer__links">
+    <div class="home-footer__col">
+      <p class="home-footer__label">code</p>
+      <ul class="home-footer__links">
         <li><a href="https://github.com/txn2/kubefwd">github.com/txn2/kubefwd</a></li>
         <li><a href="https://github.com/txn2/kubefwd/releases">releases</a></li>
         <li><a href="https://hub.docker.com/r/txn2/kubefwd">docker hub</a></li>
         <li><a href="https://github.com/txn2/kubefwd/issues">issues</a></li>
       </ul>
     </div>
-    <div class="footer__col footer__col--meta">
-      <p class="footer__label">txn2 / org</p>
-      <p class="footer__text"><a href="https://txn2.com">txn2.com&nbsp;↗</a><br>
-      <span class="footer__links__sub">canonical home of the txn2 open source organization</span></p>
-      <p class="footer__mono">apache 2.0 license <span class="dot">·</span> <span data-clock>·· UTC</span></p>
+    <div class="home-footer__col home-footer__col--meta">
+      <p class="home-footer__label">txn2 / org</p>
+      <p class="home-footer__text"><a href="https://txn2.com">txn2.com&nbsp;↗</a><br>
+      <span class="home-footer__links__sub">canonical home of the txn2 open source organization</span></p>
+      <p class="home-footer__mono">apache 2.0 license <span class="dot">·</span> <span data-clock>·· UTC</span></p>
     </div>
   </div>
-  <div class="footer__base">
+  <div class="home-footer__base">
     <p>© 2017-2026 · <a href="https://txn2.com">txn2</a> · kubefwd released under Apache 2.0.</p>
-    <p class="footer__base__tag"><a href="https://txn2.com">design · txn2.com&nbsp;↗</a></p>
+    <p class="home-footer__base__tag"><a href="https://txn2.com">design · txn2.com&nbsp;↗</a></p>
   </div>
 </footer>
 {% endblock %}
@@ -356,7 +357,14 @@ <h2 class="section__title">
 {{ super() }}
 <script>
   // Live UTC clock for rail/footer.
+  // Guarded against duplicate registration: Material's instant-nav rehydrates
+  // the body on every navigation back to the homepage; without this guard a
+  // fresh setInterval handle leaks each visit.
   (function () {
+    if (window.__kubefwdClock) {
+      window.__kubefwdClock.tick();
+      return;
+    }
     function tick() {
       var now = new Date();
       var hh = String(now.getUTCHours()).padStart(2, '0');
@@ -367,7 +375,8 @@ <h2 class="section__title">
       });
     }
     tick();
-    setInterval(tick, 30 * 1000);
+    var handle = setInterval(tick, 30 * 1000);
+    window.__kubefwdClock = { tick: tick, handle: handle };
   })();
 </script>
 {% endblock %}
```

**File**: `docs/stylesheets/extra.css` (modified, +189/-111)
```diff
@@ -91,6 +91,35 @@
   --md-shadow-z1: 0 1px 0 rgba(255,255,255,0.02);
   --md-shadow-z2: 0 1px 0 rgba(255,255,255,0.02);
   --md-shadow-z3: 0 1px 0 rgba(255,255,255,0.02);
+
+  /* Mermaid theme variables consumed by MkDocs Material's
+     Mermaid integration. Mirrors the txn2 DESIGN.md Mermaid block. */
+  --md-mermaid-font-family:                 var(--mono);
+  --md-mermaid-edge-color:                  var(--mute);
+  --md-mermaid-node-bg-color:               var(--ink-3);
+  --md-mermaid-node-fg-color:               var(--paper);
+  --md-mermaid-label-bg-color:              var(--ink-3);
+  --md-mermaid-label-fg-color:              var(--paper);
+  --md-mermaid-sequence-actor-bg-color:     var(--ink-3);
+  --md-mermaid-sequence-actor-fg-color:     var(--paper);
+  --md-mermaid-sequence-actor-border-color: var(--rule-2);
+  --md-mermaid-sequence-actor-line-color:   var(--rule-2);
+  --md-mermaid-sequence-actorman-bg-color:  var(--ink-3);
+  --md-mermaid-sequence-actorman-line-color: var(--mute);
+  --md-mermaid-sequence-box-bg-color:       var(--ink-2);
+  --md-mermaid-sequence-box-fg-color:       var(--paper);
+  --md-mermaid-sequence-label-bg-color:     var(--ink-2);
+  --md-mermaid-sequence-label-fg-color:     var(--mute);
+  --md-mermaid-sequence-loop-bg-color:      var(--ink-2);
+  --md-mermaid-sequence-loop-fg-color:      var(--paper);
+  --md-mermaid-sequence-loop-border-color:  var(--rule-2);
+  --md-mermaid-sequence-message-fg-color:   var(--paper-dim);
+  --md-mermaid-sequence-message-line-color: var(--mute);
+  --md-mermaid-sequence-note-bg-color:      var(--ink-2);
+  --md-mermaid-sequence-note-fg-color:      var(--paper);
+  --md-mermaid-sequence-note-border-color:  var(--signal);
+  --md-mermaid-sequence-number-bg-color:    var(--signal);
+  --md-mermaid-sequence-number-fg-color:    var(--ink);
 }
 
 /* ──────────────────────────────────────────────────────────────
@@ -153,6 +182,10 @@ em.serif { font-family: var(--serif); font-style: italic; font-weight: 400; }
 
 /* ──────────────────────────────────────────────────────────────
    FILM GRAIN + VIGNETTE / fixed viewport overlays, page-wide
+   z-index 1: above the page background, below the rail (z 50),
+   skiplink (z 200), and any interactive Material chrome. The
+   grain uses overlay blend so it stays subtle even over text;
+   the vignette only dims the corners.
    ────────────────────────────────────────────────────────────── */
 
 body::before,
@@ -161,7 +194,7 @@ body::after {
   position: fixed;
   inset: 0;
   pointer-events: none;
-  z-index: 100;
+  z-index: 1;
 }
 body::before {
   opacity: .08;
@@ -339,6 +372,8 @@ a.rail__brand:focus-visible { outline-offset: 4px; }
 
 /* ──────────────────────────────────────────────────────────────
    HERO
+   All rules scoped under .page--home so component classes never
+   leak into Material-rendered inner pages.
    ────────────────────────────────────────────────────────────── */
 
 .page--home .hero {
@@ -348,7 +383,7 @@ a.rail__brand:focus-visible { outline-offset: 4px; }
   margin: 0 auto;
 }
 
-.hero__stamp {
+.page--home .hero__stamp {
   position: absolute;
   top: clamp(40px, 8vh, 90px);
   right: var(--gutter);
@@ -362,10 +397,10 @@ a.rail__brand:focus-visible { outline-offset: 4px; }
   padding-right: 14px;
   animation: rise 1.1s .1s both ease-out;
 }
-.hero__stamp__line { line-height: 1.7; }
-.hero__stamp__line--ok { color: var(--signal); }
+.page--home .hero__stamp__line { line-height: 1.7; }
+.page--home .hero__stamp__line--ok { color: var(--signal); }
 
-.hero__display {
+.page--home .hero__display {
   font-family: var(--serif);
   font-weight: 300;
   font-size: clamp(60px, 12.5vw, 220px);
@@ -374,32 +409,32 @@ a.rail__brand:focus-visible { outline-offset: 4px; }
   margin-bottom: 56px;
   font-variation-settings: "opsz" 144;
 }
-.hero__row {
+.page--home .hero__row {
   display: flex; align-items: baseline; gap: clamp(12px, 2vw, 36px);
   flex-wrap: wrap;
 }
-.hero__row--1 { animation: rise 1.1s .25s both ease-out; }
-.hero__row--2 {
+.page--home .hero__row--1 { animation: rise 1.1s .25s both ease-out; }
+.page--home .hero__row--2 {
   padding-left: clamp(40px, 14vw, 240px);
   animation: rise 1.1s .4s both ease-out;
 }
-.hero__row--3 {
+.page--home .hero__row--3 {
   padding-left: clamp(20px, 6vw, 100px);
   animation: rise 1.1s .55s both ease-out;
 }
-.hero__row em.serif {
+.page--home .hero__row em.serif {
   font-style: italic;
   color: var(--paper);
   font-variation-settings: "opsz" 144;
 }
-.outline {
+.page--home .outline {
   -webkit-text-stroke: 1.5px var(--paper);
   color: transparent;
   font-style: normal;
   font-weight: 400;
   font-family: var(--serif);
 }
-.hero__chip {
+.page--home .hero__chip {
   font-family: var(--mono);
   font-size: 13px;
   letter-spacing: 0.04em;
@@ -414,7 +449,7 @@ a.rail__brand:focus-visible { outline-offset: 4px; }
   white-space: nowrap;
 }
 
-.hero__intro {
+.page--home .hero__intro {
   display: grid;
   grid-template
```

---

### Incident Patch 12: `5eab2dcc` (2026-04-22)
**Commit Message**: ci: fix MCP Registry publish step (fileSha256 field name) (#470)

* ci: use correct MCP schema field name in server.json

The MCP registry schema requires camelCase `fileSha256`, but server.json
used snake_case `file_sha256`, so every Release workflow since v1.25.1
failed at the Publish to MCP Registry step. Those failures prompted a
re-run of the v1.25.13 release, which produced new (non-reproducible)
Go binaries and left the homebrew-tap formula pinned to the old hashes,
breaking `brew install txn2/tap/kubefwd` (txn2/homebrew-tap#5).

Also add a validation step that runs the JSON Schema plus an explicit
MCPB contract check (every mcpb package must have a 64-hex fileSha256)
so this class of regression fails loudly before publish.

* ci: use pipx run for check-jsonschema

Swap the pip install for `pipx run`, which is preinstalled on
ubuntu-latest runners and sidesteps PEP 668 externally-managed-env
issues. Removes the only install-time failure mode in the validation
step, so a transient pip regression can't knock the release workflow
into a failed state that tempts a destructive re-run.

**File**: `.github/workflows/release.yml` (modified, +33/-0)
```diff
@@ -139,6 +139,39 @@ jobs:
           echo "Updated server.json:"
           cat server.json
 
+      - name: Validate server.json against MCP schema
+        run: |
+          # JSON Schema validation (types, formats, top-level required fields).
+          # pipx is preinstalled on ubuntu-latest; `pipx run` isolates the tool
+          # in its own venv, sidestepping PEP 668 externally-managed-env issues.
+          pipx run check-jsonschema \
+            --schemafile "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json" \
+            server.json
+          # MCPB contract: every mcpb package must have a real fileSha256.
+          # The base schema does not enforce this (it's documented-only), so
+          # we check explicitly. Catches wrong field name (file_sha256 vs
+          # fileSha256) and unreplaced PLACEHOLDER_SHA256 values.
+          python3 - <<'PY'
+          import json, re, sys
+          data = json.load(open('server.json'))
+          errors = []
+          for i, pkg in enumerate(data.get('packages', [])):
+              if pkg.get('registryType') != 'mcpb':
+                  continue
+              h = pkg.get('fileSha256')
+              if not h or not re.fullmatch(r'[a-f0-9]{64}', h):
+                  errors.append(
+                      f"packages[{i}] ({pkg.get('identifier','?')}): "
+                      f"missing/invalid fileSha256 (got {h!r})"
+                  )
+          if errors:
+              print('server.json MCPB validation failed:', file=sys.stderr)
+              for e in errors:
+                  print(f'  - {e}', file=sys.stderr)
+              sys.exit(1)
+          print('server.json OK: all mcpb packages have valid fileSha256')
+          PY
+
       - name: Publish to MCP Registry
         run: |
           # Login using GitHub OIDC (id-token: write permission required)
```

**File**: `server.json` (modified, +3/-3)
```diff
@@ -11,23 +11,23 @@
     {
       "registryType": "mcpb",
       "identifier": "https://github.com/txn2/kubefwd/releases/download/v0.0.0/kubefwd-0.0.0-darwin-arm64.mcpb",
-      "file_sha256": "PLACEHOLDER_SHA256",
+      "fileSha256": "PLACEHOLDER_SHA256",
       "transport": {
         "type": "stdio"
       }
     },
     {
       "registryType": "mcpb",
       "identifier": "https://github.com/txn2/kubefwd/releases/download/v0.0.0/kubefwd-0.0.0-darwin-amd64.mcpb",
-      "file_sha256": "PLACEHOLDER_SHA256",
+      "fileSha256": "PLACEHOLDER_SHA256",
       "transport": {
         "type": "stdio"
       }
     },
     {
       "registryType": "mcpb",
       "identifier": "https://github.com/txn2/kubefwd/releases/download/v0.0.0/kubefwd-0.0.0-windows-amd64.mcpb",
-      "file_sha256": "PLACEHOLDER_SHA256",
+      "fileSha256": "PLACEHOLDER_SHA256",
       "transport": {
         "type": "stdio"
       }
```

---

### Incident Patch 13: `4201e041` (2026-03-29)
**Commit Message**: Add Wayland clipboard support (wl-copy) for TUI copy feature (#446)

Refactor copyToClipboard to use a table-driven candidate list with
environment-aware ordering. When WAYLAND_DISPLAY is set, wl-copy is
preferred over X11 tools; otherwise X11 tools are tried first.

Closes #445

**File**: `pkg/fwdtui/components/detail.go` (modified, +32/-7)
```diff
@@ -2,6 +2,7 @@ package components
 
 import (
 	"fmt"
+	"os"
 	"os/exec"
 	"runtime"
 	"strconv"
@@ -650,22 +651,46 @@ func (m *DetailModel) getConnectStrings() []string {
 func copyToClipboard(text string) bool {
 	var cmd *exec.Cmd
 
+	type clipboardCmd struct {
+		name string
+		args []string
+	}
+
+	var candidates []clipboardCmd
+
 	switch runtime.GOOS {
 	case "darwin":
-		cmd = exec.Command("pbcopy")
+		candidates = []clipboardCmd{{"pbcopy", nil}}
 	case "linux":
-		// Try xclip first, then xsel
-		if _, err := exec.LookPath("xclip"); err == nil {
-			cmd = exec.Command("xclip", "-selection", "clipboard")
-		} else if _, err := exec.LookPath("xsel"); err == nil {
-			cmd = exec.Command("xsel", "--clipboard", "--input")
+		// Prefer Wayland-native tool when running under Wayland,
+		// fall back to X11 tools otherwise.
+		if os.Getenv("WAYLAND_DISPLAY") != "" {
+			candidates = []clipboardCmd{
+				{"wl-copy", nil},
+				{"xclip", []string{"-selection", "clipboard"}},
+				{"xsel", []string{"--clipboard", "--input"}},
+			}
 		} else {
-			return false
+			candidates = []clipboardCmd{
+				{"xclip", []string{"-selection", "clipboard"}},
+				{"xsel", []string{"--clipboard", "--input"}},
+				{"wl-copy", nil},
+			}
 		}
 	default:
 		return false
 	}
 
+	for _, c := range candidates {
+		if _, err := exec.LookPath(c.name); err == nil {
+			cmd = exec.Command(c.name, c.args...)
+			break
+		}
+	}
+	if cmd == nil {
+		return false
+	}
+
 	pipe, err := cmd.StdinPipe()
 	if err != nil {
 		return false
```

---

### Incident Patch 14: `03c9e584` (2026-03-11)
**Commit Message**: ci: bump docker/setup-buildx-action from 3.12.0 to 4.0.0 (#425)

Bumps [docker/setup-buildx-action](https://github.com/docker/setup-buildx-action) from 3.12.0 to 4.0.0.
- [Release notes](https://github.com/docker/setup-buildx-action/releases)
- [Commits](https://github.com/docker/setup-buildx-action/compare/8d2750c68a42422c14e847fe6c8ac0403b4cbd6f...4d04d5d9486b7bd6fa91e7baf45bbb4f8b9deedd)

---
updated-dependencies:
- dependency-name: docker/setup-buildx-action
  dependency-version: 4.0.0
  dependency-type: direct:production
  update-type: version-update:semver-major
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
Co-authored-by: Craig Johnston <[REDACTED_EMAIL]>

**File**: `.github/workflows/release.yml` (modified, +1/-1)
```diff
@@ -42,7 +42,7 @@ jobs:
         uses: docker/setup-qemu-action@c7c53464625b32c7a7e944ae62b3e17d2b600130 # v3.7.0
 
       - name: Set up Docker Buildx
-        uses: docker/setup-buildx-action@8d2750c68a42422c14e847fe6c8ac0403b4cbd6f # v3.12.0
+        uses: docker/setup-buildx-action@4d04d5d9486b7bd6fa91e7baf45bbb4f8b9deedd # v4.0.0
 
       - name: Login to Docker Hub
         uses: docker/login-action@c94ce9fb468520275223c153574b00df6fe4bcc9 # v3.7.0
```

#### Recent Merged Pull Requests:
- **PR #602** (2026-10-03): ci/deps: roll up open Dependabot updates (@cjimti)
- **PR #601** (closed): ci: bump github/codeql-action/upload-sarif from 4.37.9 to 4.38.0 (@dependabot[bot])
- **PR #600** (closed): ci: bump github/codeql-action/init from 4.37.9 to 4.38.0 (@dependabot[bot])
- **PR #599** (closed): ci: bump actions/deploy-pages from 5.0.0 to 5.0.1 (@dependabot[bot])
- **PR #598** (closed): ci: bump github/codeql-action/analyze from 4.37.9 to 4.38.0 (@dependabot[bot])
- **PR #597** (closed): ci: bump docker/setup-buildx-action from 4.2.0 to 4.3.0 (@dependabot[bot])
- **PR #596** (closed): deps: bump github.com/sirupsen/logrus from 1.9.4 to 1.10.2 (@dependabot[bot])
- **PR #595** (closed): deps: bump charm.land/lipgloss/v2 from 2.0.5 to 2.0.6 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
