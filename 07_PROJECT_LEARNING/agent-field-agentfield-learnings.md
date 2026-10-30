> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/agent-field-agentfield-learnings.md`  
> **Source**: github ([https://github.com/Agent-Field/agentfield](https://github.com/Agent-Field/agentfield))  
> **Source Version**: `9fe15519`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-30T19:42:45.439Z  
> **Learning ID**: `learn-github-agent-field-agentfield`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): Agent-Field/agentfield

> **Canonical Artifact**: `07_PROJECT_LEARNING/agent-field-agentfield-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Agent-Field/agentfield](https://github.com/Agent-Field/agentfield))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-30T19:42:45.432Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Agent-Field/agentfield`
- **Description**: Build, run and scale AI agents like API and microservices
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2634 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `control-plane/cmd/af-tray/chart_render.go`
```
package main

// Text-free image renderer for the Usage submenu's 24h timeline: a compact bucket
// histogram, stacked by model. It is pure graphics (image/png only, no fonts, no
// systray/CGO), so it compiles and is unit-tested on Linux CI. The per-model /
// rollup / quota rows are NOT rendered here — they are native menu-item text
// titles set by the darwin tray, each paired (models, quota) with a compact bar
// image from charts.go's slotBarPNG. The darwin tray turns the PNG below into a
// full-width menu-item image via the vendored systray fork's SetImage.
//
// All geometry is expressed in OUTPUT pixels — the 2x-retina PNG the tray hands
// to SetImage — and multiplied by the supersample factor `ss` for the internal
// high-res buffer, which is then box-downsampled for crisp bar edges and gaps.

import (
	"image"
	"image/color"
	"math"
)

// ---- Usage submenu geometry (points) ---------------------------------------
//
// The design system: EVERY row in the Usage submenu carries a leading image of
// exactly the uniform SLOT size, so every native title starts at the same x. Rows
// with a graphic (model / quota) draw a compact bar inside the slot; rows without
// one (summary lines, section headers, rollups, footer) get a fully transparent
// spacer of the same size. The 24h histogram is the one wider, text-free graphic
// row; its left edge still aligns with the slot, and its first bucket lines up
// with the compact bars below. These constants live here (cross-platform) so the
// pure renderers, their tests, and the darwin tray all share one source of truth.
const (
	// Uniform leading slot every submenu row carries.
	usageSlotWidthPt  = 64
	usageSlotHeightPt = 12
	// Compact proportional bar drawn inside the slot (model / quota rows),
	// left-aligned and vertically centered.
	usageBarWidthPt  = 56
	usageBarHeightPt = 8
	// 24h histogram: a full row-content-width (slot + title area), text-free row.
	usageChartWidthPt  = 200
	usageChartHeightPt = 28
)

// ---- Bucket histogram ------------------------------------------------------

// histogram tuning, in OUTPUT pixels (2x retina).
const (
	histTopPadPx    = 3 // headroom above the tallest bar so it doesn't touch the top
	histGapPx       = 1 // gap between adjacent buckets
	histStubPx      = 1 // baseline stub height for empty buckets
	histMinNonEmpty = 2 // shortest a nonzero bucket ever draws, so a tiny value shows
)

// histStubColor is the neutral baseline stub for empty buckets — dim enough not
// to compete with the accent bars, present enough that the timeline reads as
// continuous rather than broken around a lone spike.
var histStubColor = color.NRGBA{grayOther.R, grayOther.G, grayOther.B, 0x59}

// histogramChartPNG renders the usage timeline as a compact bucket histogram: one
// thin vertical bar per bucket (with 1px gaps), each bar stacking its models
// bottom-up in the given hues (layers[0] at the bottom). Empty buckets keep a 1px
// baseline stub so the timeline reads as continuous, which makes a lone spike look
// like an event on a timeline rather than a broken chart. When series_by_model is
// absent the caller passes a single layer (single accent hue). layers are
// per-bucket token counts, all the same length; colors[i] tints layers[i]. It
// carries no text — the numbers live in the native menu titles around it.
func histogramChartPNG(layers [][]float64, colors []color.NRGBA, wPx, hPx int) []byte {
	if wPx <= 0 || hPx <= 0 {
		return nil
	}
	ss := barSupersample
	s := float64(ss)
	W, H := wPx*ss, hPx*ss
	hi := image.NewNRGBA(image.Rect(0, 0, W, H))

	// Plot region. The left edge is flush (x=0) so the first bucket lines up with
	// the compact model bars in the rows below; the baseline sits on the bottom
	// edge; only a little headroom is reserved at the top.
	plotTop := float64(histTopPadPx) * s
	plotBot := float64(H)
	if plotBot <= plotTop {
		plotTop = 0
	}
	plotH := plotBot - plotTop

	// Bucket count and the per-bucket stacked total.
	n := 0
	for _, l := range layers {
		if len(l) > n {
			n = len(l)
		}
	}
	if n == 0 {
		return encodePNG(downsample(hi, wPx, hPx, ss))
	}
	valueAt := func(li, i int) float64 {
		if li < 0 || li >= len(layers) || i < 0 || i >= len(layers[li]) {
			return 0
		}
		v := layers[li][i]
		if v < 0 {
			v = 0
		}
		return v
	}
	total := func(i int) float64 {
		sum := 0.0
		for li := range layers {
			sum += valueAt(li, i)
		}
		return sum
	}
	maxTotal := 0.0
	for i := 0; i < n; i++ {
		if t := total(i); t > maxTotal {
			maxTotal = t
		}
	}

	stubPx := float64(histStubPx) * s
	minNonEmpty := float64(histMinNonEmpty) * s
	gap := float64(histGapPx) * s
	bucketW := float64(W) / float64(n)

	fillRect := func(x0, x1, y0, y1 float64, c color.NRGBA) {
		xi0, xi1 := int(math.Round(x0)), int(math.Round(x1))
		yi0, yi1 := int(math.Round(y0)), int(math.Round(y1))
		for y := yi0; y < yi1; y++ {
			if y < 0 || y >= H {
				continue
			}
			for x := xi0; x < xi1; x++ {
				if x < 0 || x >= W {
					continue
				}
				blendPixel(hi, x, y, c, 1)
			}
		}
	}

	for i := 0; i < n; i++ {
		xL := float64(i) * bucketW
		xR := xL + bucketW - gap
		if xR <= xL {
			xR = xL + 1
		}

		t := total(i)
		if t <= 0 || maxTotal <= 0 {
			// Empty bucket: a 1px neutral stub on the baseline.
			fillRect(xL, xR, plotBot-stubPx, plotBot, histStubColor)
			continue
		}

		// Bar height for this bucket, floored so a tiny nonzero value still shows.
		barH := (t / maxTotal) * plotH
		if barH < minNonEmpty {
			barH = minNonEmpty
		}
		scale := barH / t // pixels per token for this bucket's stack

		bottom := plotBot
		for li := range layers {
			v := valueAt(li, i)
			if v <= 0 {
				continue
			}
			segH := v * scale
			top := bottom - segH
			if top < plotTop {
				top = plotTop
			}
			col := grayOther
			if li < len(colors) {
				col = colors[li]
			}
			fillRect(xL, xR, top, bottom, col)
			bottom = top
		}
	}

	return encodePNG(downsample(hi, wPx, hPx, ss))
}

```

### Core Architecture Module: `control-plane/internal/cli/utils.go`
```
package cli

import (
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/fatih/color"
)

// getAgentFieldHomeDir returns the AgentField home directory (~/.agentfield) and ensures it exists
func getAgentFieldHomeDir() string {
	if customHome := os.Getenv("AGENTFIELD_HOME"); customHome != "" {
		if err := os.MkdirAll(customHome, 0755); err != nil {
			PrintError(fmt.Sprintf("Failed to create AGENTFIELD_HOME directory: %v", err))
			os.Exit(1)
		}
		ensureSubdirs(customHome)
		return customHome
	}

	homeDir, err := os.UserHomeDir()
	if err != nil {
		PrintError(fmt.Sprintf("Failed to get user home directory: %v", err))
		os.Exit(1)
	}

	agentfieldHome := filepath.Join(homeDir, ".agentfield")

	// Ensure .agentfield directory exists
	if err := os.MkdirAll(agentfieldHome, 0755); err != nil {
		PrintError(fmt.Sprintf("Failed to create .agentfield directory: %v", err))
		os.Exit(1)
	}

	ensureSubdirs(agentfieldHome)

	return agentfieldHome
}

func ensureSubdirs(agentfieldHome string) {
	subdirs := []string{"packages", "logs", "config"}
	for _, subdir := range subdirs {
		if err := os.MkdirAll(filepath.Join(agentfieldHome, subdir), 0755); err != nil {
			PrintError(fmt.Sprintf("Failed to create %s directory: %v", subdir, err))
			os.Exit(1)
		}
	}
}

// Professional CLI status symbols
const (
	StatusSuccess = "✔" // Standardized
	StatusError   = "❗" // Standardized
	StatusWarning = "⚠" // Added
	StatusInfo    = "ℹ" // Added
	StatusArrow   = "→"
	StatusBullet  = "•"
)

// Spinner characters for progress indication
var spinnerChars = []string{"⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"}

// Color functions for professional output
var (
	Green  = color.New(color.FgGreen).SprintFunc()
	Red    = color.New(color.FgRed).SprintFunc()
	Yellow = color.New(color.FgYellow).SprintFunc()
	Blue   = color.New(color.FgBlue).SprintFunc()
	Cyan   = color.New(color.FgCyan).SprintFunc() // Added
	Gray   = color.New(color.FgHiBlack).SprintFunc()
	Bold   = color.New(color.Bold).SprintFunc()
)

// Spinner represents a CLI spinner for progress indication
type Spinner struct {
	message string
	active  bool
	mu      sync.Mutex
	done    chan bool
}

// NewSpinner creates a new spinner with the given message
func NewSpinner(message string) *Spinner {
	return &Spinner{
		message: message,
		done:    make(chan bool),
	}
}

// Start begins the spinner animation
func (s *Spinner) Start() {
	s.mu.Lock()
	s.active = true
	s.mu.Unlock()

	go func() {
		i := 0
		for {
			select {
			case <-s.done:
				return
			default:
				s.mu.Lock()
				if s.active {
					fmt.Printf("\r  %s %s", spinnerChars[i%len(spinnerChars)], s.message)
					i++
				}
				s.mu.Unlock()
				time.Sleep(100 * time.Millisecond)
			}
		}
	}()
}

// Stop stops the spinner and clears the line
func (s *Spinner) Stop() {
	s.mu.Lock()
	s.active = false
	s.mu.Unlock()
	s.done <- true
	fmt.Print("\r\033[K") // Clear the line
}

// Success stops the spinner and shows a success message
func (s *Spinner) Success(message string) {
	s.Stop()
	fmt.Printf("  %s %s\n", Green(StatusSuccess), message)
}

// Error stops the spinner and shows an error message
func (s *Spinner) Error(message string) {
	s.Stop()
	fmt.Printf("  %s %s\n", Red(StatusError), message)
}

// UpdateMessage updates the spinner message while it's running
func (s *Spinner) UpdateMessage(message string) {
	s.mu.Lock()
	s.message = message
	s.mu.Unlock()
}

// PrintSuccess prints a success message with checkmark
func PrintSuccess(message string) {
	fmt.Printf("%s %s\n", Green(StatusSuccess), message)
}

// PrintError prints an error message with cross mark
func PrintError(message string) {
	fmt.Printf("%s %s\n", Red(StatusError), message)
}

// PrintInfo prints an informational message with arrow
func PrintInfo(message string) {
	fmt.Printf("%s %s\n", Blue(StatusArrow), message)
}

// PrintWarning prints a warning message
func PrintWarning(message string) {
	fmt.Printf("%s %s\n", Yellow(StatusBullet), message)
}

// PrintHeader prints a header message in bold
func PrintHeader(message string) {
	fmt.Printf("%s\n", Bold(message))
}

// PrintSubheader prints a subheader message
func PrintSubheader(message string) {
	fmt.Printf("\n%s\n", message)
}

// PrintBullet prints a bullet point
func PrintBullet(message string) {
	fmt.Printf("  %s %s\n", Gray(StatusBullet), message)
}

```

### Core Architecture Module: `control-plane/internal/core/domain/models.go`
```
// agentfield/internal/core/domain/models.go
package domain

import "time"

// AgentNode represents a running agent instance
type AgentNode struct {
	ID              string            `json:"id"`
	Name            string            `json:"name"`
	Port            int               `json:"port"`
	PID             int               `json:"pid"`
	Status          string            `json:"status"`
	LifecycleStatus string            `json:"lifecycle_status"`
	StartedAt       time.Time         `json:"started_at"`
	Environment     map[string]string `json:"environment"`
	LogFile         string            `json:"log_file"`
}

// PackageMetadata represents package information
type PackageMetadata struct {
	Name        string `json:"name"`
	Version     string `json:"version"`
	Description string `json:"description"`
	Author      string `json:"author"`
	Path        string `json:"path"`
}

// InstallationSpec represents package installation configuration
type InstallationSpec struct {
	Source      string            `json:"source"`
	Destination string            `json:"destination"`
	Force       bool              `json:"force"`
	Environment map[string]string `json:"environment"`
}

// ProcessSpec represents process execution configuration
type ProcessSpec struct {
	Command     string            `json:"command"`
	Args        []string          `json:"args"`
	WorkingDir  string            `json:"working_dir"`
	Environment map[string]string `json:"environment"`
	LogFile     string            `json:"log_file"`
}

// InstallationRegistry tracks installed packages
type InstallationRegistry struct {
	Installed map[string]InstalledPackage `json:"installed"`
}

// InstalledPackage represents an installed package
type InstalledPackage struct {
	Name        string            `json:"name"`
	Version     string            `json:"version"`
	Path        string            `json:"path"`
	Environment map[string]string `json:"environment"`
	InstalledAt time.Time         `json:"installed_at"`
}

// AgentFieldConfig represents the AgentField configuration
type AgentFieldConfig struct {
	HomeDir     string            `json:"home_dir"`
	Environment map[string]string `json:"environment"`
}

// InstallOptions represents options for package installation
type InstallOptions struct {
	Force   bool `json:"force"`
	Verbose bool `json:"verbose"`
	// Path optionally selects a subdirectory within the source (git repo or local
	// directory) whose agentfield-package.yaml should be installed, letting one
	// repository ship multiple installable nodes. Empty means the default
	// root-first behavior. It applies only to the top-level source, never to
	// recursively-installed node dependencies.
	Path string `json:"path"`
	// ExpectedPackageName constrains unattended updates to an in-place package
	// name. Empty preserves interactive/user-initiated supersede behaviour.
	ExpectedPackageName string `json:"-"`
	// BeforeReplace is a git-install transaction boundary. It runs only after
	// the incoming tree and manifest have been validated, immediately before
	// the installed directory is stashed for replacement.
	BeforeReplace func() error `json:"-"`
}

// RunOptions represents options for running an agent
type RunOptions struct {
	Port   int  `json:"port"`
	Detach bool `json:"detach"`
	// PortIsPreference is reserved for automatic restore/update callers. A busy
	// preferred port may fall back to another port; a user-requested port must
	// fail instead of silently starting somewhere else.
	PortIsPreference bool `json:"-"`
}

// RunningAgent represents a currently running agent instance
type RunningAgent struct {
	Name      string    `json:"name"`
	PID       int       `json:"pid"`
	Port      int       `json:"port"`
	Status    string    `json:"status"`
	StartedAt time.Time `json:"started_at"`
	LogFile   string    `json:"log_file"`
}

// AgentStatus represents the status of an agent
type AgentStatus struct {
	Name      string    `json:"name"`
	IsRunning bool      `json:"is_running"`
	PID       int       `json:"pid"`
	Port      int       `json:"port"`
	Uptime    string    `json:"uptime"`
	LastSeen  time.Time `json:"last_seen"`
}

// DevOptions represents options for development mode
type DevOptions struct {
	Port       int  `json:"port"`
	AutoReload bool `json:"auto_reload"`
	Verbose    bool `json:"verbose"`
	WatchFiles bool `json:"watch_files"`
}

// DevStatus represents the status of development mode
type DevStatus struct {
	Path         string    `json:"path"`
	IsRunning    bool      `json:"is_running"`
	PID          int       `json:"pid"`
	Port         int       `json:"port"`
	StartedAt    time.Time `json:"started_at"`
	AutoReload   bool      `json:"auto_reload"`
	WatchedFiles []string  `json:"watched_files"`
}

```

### Core Architecture Module: `control-plane/internal/core/interfaces/agent_client.go`
```
package interfaces

import "context"

// AgentClient defines the interface for communicating with agent nodes
type AgentClient interface {
	// ShutdownAgent requests graceful shutdown of an agent node via HTTP
	ShutdownAgent(ctx context.Context, nodeID string, graceful bool, timeoutSeconds int) (*AgentShutdownResponse, error)

	// GetAgentStatus retrieves detailed status information from an agent node
	GetAgentStatus(ctx context.Context, nodeID string) (*AgentStatusResponse, error)
}

// AgentShutdownResponse represents the response from requesting agent shutdown
type AgentShutdownResponse struct {
	Status                string `json:"status"` // "shutting_down", "error"
	Graceful              bool   `json:"graceful"`
	TimeoutSeconds        int    `json:"timeout_seconds,omitempty"`
	EstimatedShutdownTime string `json:"estimated_shutdown_time,omitempty"`
	Message               string `json:"message"`
}

// AgentStatusResponse represents detailed status information from an agent
type AgentStatusResponse struct {
	Status        string                 `json:"status"`         // "running", "stopping", "error"
	Uptime        string                 `json:"uptime"`         // Human-readable uptime
	UptimeSeconds int                    `json:"uptime_seconds"` // Uptime in seconds
	PID           int                    `json:"pid"`            // Process ID
	Version       string                 `json:"version"`        // Agent version
	NodeID        string                 `json:"node_id"`        // Agent node ID
	LastActivity  string                 `json:"last_activity"`  // ISO timestamp
	Resources     map[string]interface{} `json:"resources"`      // Resource usage info
	Message       string                 `json:"message,omitempty"`
}

```

### Core Architecture Module: `control-plane/internal/core/interfaces/process.go`
```
package interfaces

// ProcessInfo holds information about a running process.
type ProcessInfo struct {
	PID     int
	Status  string // e.g., "running", "stopped", "error"
	Command string
	// Add other relevant fields like start time, CPU/memory usage, etc.
}

// ProcessConfig holds configuration for starting a new process.
type ProcessConfig struct {
	Command string   // The command to execute.
	Args    []string // Arguments for the command.
	Env     []string // Environment variables for the process (e.g., "KEY=VALUE").
	WorkDir string   // Working directory for the process.
	LogFile string   // Path to log file for stdout/stderr redirection.
	// Add other relevant fields like UID/GID, etc.
}

// ProcessManager defines the contract for managing system processes.
// This interface abstracts the underlying operations for starting, stopping,
// and monitoring processes, allowing for different implementations (e.g., local, Docker).
type ProcessManager interface {
	// Start initiates a new process based on the provided configuration.
	// It returns the PID of the started process or an error if the process
	// could not be started.
	Start(config ProcessConfig) (pid int, err error)

	// Stop terminates a process identified by its PID.
	// It should handle graceful termination if possible, and forceful termination
	// if necessary or specified.
	// Returns an error if the process cannot be stopped or is not found.
	Stop(pid int) error

	// Status retrieves the current status and information of a process
	// identified by its PID.
	// Returns ProcessInfo containing details about the process, or an error
	// if the status cannot be retrieved or the process is not found.
	Status(pid int) (ProcessInfo, error)

	// List retrieves information about all processes currently managed
	// or observable by this ProcessManager.
	// Returns a slice of ProcessInfo or an error.
	// List() ([]ProcessInfo, error) // Uncomment and implement if needed

	// Logs retrieves the recent logs for a process identified by its PID.
	// Parameters like `tailLines` could specify how much log to retrieve.
	// Returns the log content as a string or an error.
	// Logs(pid int, tailLines int) (string, error) // Uncomment and implement if needed
}

// PortManager defines the contract for managing network ports.
// This interface abstracts operations like finding free ports,
// checking availability, and managing reservations.
type PortManager interface {
	// FindFreePort searches for an available port, typically starting from a given port number.
	// Returns the first free port found or an error if no port is available in the search range.
	FindFreePort(startPort int) (int, error)

	// IsPortAvailable checks if a specific port is currently available (not in use).
	// Returns true if the port is available, false otherwise.
	IsPortAvailable(port int) bool

	// ReservePort attempts to mark a port as reserved for use by the application.
	// This is a logical reservation within the PortManager, not necessarily a system-level lock.
	// Returns an error if the port cannot be reserved (e.g., already in use or reserved).
	ReservePort(port int) error

	// ReleasePort marks a previously reserved port as available again.
	// Returns an error if the port was not found in the reserved list or cannot be released.
	ReleasePort(port int) error
}

```

### Core Architecture Module: `control-plane/internal/core/interfaces/services.go`
```
package interfaces

import (
	"github.com/Agent-Field/agentfield/control-plane/internal/core/domain"
)

// PackageService defines the contract for package management operations.
// This interface abstracts package installation, uninstallation, and listing operations.
type PackageService interface {
	// InstallPackage installs a package from the given source with specified options.
	// The source can be a local path, GitHub URL, or other supported package sources.
	// Returns an error if the installation fails.
	InstallPackage(source string, options domain.InstallOptions) error

	// UninstallPackage removes an installed package by name.
	// Returns an error if the package is not found or cannot be uninstalled.
	UninstallPackage(name string) error

	// ListInstalledPackages returns a list of all installed packages.
	// Returns an error if the package registry cannot be read.
	ListInstalledPackages() ([]domain.InstalledPackage, error)

	// GetPackageInfo retrieves detailed information about a specific installed package.
	// Returns an error if the package is not found.
	GetPackageInfo(name string) (*domain.InstalledPackage, error)
}

// AgentService defines the contract for agent management operations.
// This interface abstracts running, stopping, and monitoring agent instances.
type AgentService interface {
	// RunAgent starts an agent with the given name and options.
	// Returns information about the running agent or an error if startup fails.
	RunAgent(name string, options domain.RunOptions) (*domain.RunningAgent, error)

	// StopAgent stops a running agent by name.
	// Returns an error if the agent is not found or cannot be stopped.
	StopAgent(name string) error

	// GetAgentStatus retrieves the current status of an agent by name.
	// Returns an error if the agent is not found.
	GetAgentStatus(name string) (*domain.AgentStatus, error)

	// ListRunningAgents returns a list of all currently running agents.
	// Returns an error if the agent information cannot be retrieved.
	ListRunningAgents() ([]domain.RunningAgent, error)
}

// DevService defines the contract for development mode operations.
// This interface abstracts running agents in development mode with hot reloading.
type DevService interface {
	// RunInDevMode starts an agent in development mode from the given path.
	// Development mode typically includes features like hot reloading and verbose logging.
	// Returns an error if the development server cannot be started.
	RunInDevMode(path string, options domain.DevOptions) error

	// StopDevMode stops the development server for the given path.
	// Returns an error if no development server is running for the path.
	StopDevMode(path string) error

	// GetDevStatus retrieves the status of development mode for a given path.
	// Returns information about the running development server or an error.
	GetDevStatus(path string) (*domain.DevStatus, error)
}

```

### Core Architecture Module: `control-plane/internal/core/interfaces/storage.go`
```
// agentfield/internal/core/interfaces/storage.go
package interfaces

import "github.com/Agent-Field/agentfield/control-plane/internal/core/domain"

type FileSystemAdapter interface {
	ReadFile(path string) ([]byte, error)
	WriteFile(path string, data []byte) error
	Exists(path string) bool
	CreateDirectory(path string) error
	ListDirectory(path string) ([]string, error)
}

type RegistryStorage interface {
	LoadRegistry() (*domain.InstallationRegistry, error)
	SaveRegistry(registry *domain.InstallationRegistry) error
	GetPackage(name string) (*domain.InstalledPackage, error)
	SavePackage(name string, pkg *domain.InstalledPackage) error
}

type ConfigStorage interface {
	LoadAgentFieldConfig(path string) (*domain.AgentFieldConfig, error)
	SaveAgentFieldConfig(path string, config *domain.AgentFieldConfig) error
}

```

### Core Architecture Module: `control-plane/internal/core/services/agent_service.go`
```
// agentfield/internal/core/services/agent_service.go
package services

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/Agent-Field/agentfield/control-plane/internal/core/domain"
	"github.com/Agent-Field/agentfield/control-plane/internal/core/interfaces"
	"github.com/Agent-Field/agentfield/control-plane/internal/packages"
)

// DefaultAgentService implements the AgentService interface
type DefaultAgentService struct {
	processManager  interfaces.ProcessManager
	portManager     interfaces.PortManager
	registryStorage interfaces.RegistryStorage
	agentClient     interfaces.AgentClient
	agentfieldHome  string
	confirmation    packages.ProcessConfirmationPolicy
}

// NewAgentService creates a new agent service instance
func NewAgentService(
	processManager interfaces.ProcessManager,
	portManager interfaces.PortManager,
	registryStorage interfaces.RegistryStorage,
	agentClient interfaces.AgentClient,
	agentfieldHome string,
) interfaces.AgentService {
	return &DefaultAgentService{
		processManager:  processManager,
		portManager:     portManager,
		registryStorage: registryStorage,
		agentClient:     agentClient,
		agentfieldHome:  agentfieldHome,
	}
}

// RunAgent starts an installed agent
func (as *DefaultAgentService) RunAgent(name string, options domain.RunOptions) (*domain.RunningAgent, error) {
	return as.runAgentGuarded(name, options, map[string]bool{})
}

// runAgentGuarded starts a node; inProgress tracks nodes already being started
// in this dependency chain to break cycles.
func (as *DefaultAgentService) runAgentGuarded(name string, options domain.RunOptions, inProgress map[string]bool) (*domain.RunningAgent, error) {
	fmt.Printf("🚀 Launching agent node: %s\n", name)
	inProgress[name] = true

	// 1. Check if agent node is installed
	registry, err := as.loadRegistryDirect()
	if err != nil {
		return nil, fmt.Errorf("failed to load registry: %w", err)
	}

	// Try to find the agent with exact name first, then try normalized versions
	agentNode, actualName, exists := as.findAgentInRegistry(registry, name)
	if !exists {
		return nil, fmt.Errorf("agent node %s not installed", name)
	}

	// Use the actual name from registry for all subsequent operations
	name = actualName
	legacyDesiredState := agentNode.DesiredState == ""
	agentNode.EnsureDesiredState()

	// 2. Check current state and reconcile if needed
	actuallyRunning, wasReconciled := as.reconcileLifecycleProcessState(&agentNode, name)
	if wasReconciled || legacyDesiredState {
		// Save reconciled state
		if err := as.updateRegistryEntry(name, agentNode); err != nil {
			fmt.Printf("Warning: failed to save reconciled registry state: %v\n", err)
		}
	}

	// If actually running after reconciliation, return appropriate message
	if actuallyRunning {
		if agentNode.Runtime.Port == nil {
			agentNode.Status = "stopped"
			agentNode.Runtime.PID = nil
			agentNode.Runtime.StartedAt = nil
			agentNode.Runtime.BootID = ""
			agentNode.Runtime.StartTime = ""
			if err := as.updateRegistryEntry(name, agentNode); err != nil {
				return nil, fmt.Errorf("failed to reconcile running agent without a port: %w", err)
			}
		} else {
			return nil, fmt.Errorf("agent node %s is already running on port %d", name, *agentNode.Runtime.Port)
		}
	}

	// An explicit start is the user's intent to run. Record it before the
	// launch so a container replacement during or after this call restores
	// the node; a stop that lands while the node is still starting is written
	// after this point and wins, because updateRuntimeInfo never overrides
	// desired_state.
	if agentNode.DesiredState != packages.DesiredStateRunning {
		agentNode.DesiredState = packages.DesiredStateRunning
		if err := as.updateRegistryEntry(name, agentNode); err != nil {
			// Not fatal here: the runtime write after readiness reports an
			// unwritable registry with the error callers already handle.
			fmt.Printf("Warning: failed to record running intent for %s: %v\n", name, err)
		}
	}

	// Reserve a requested/preferred port before dependencies start. Otherwise
	// a dependency's FindFreePort can claim the node's restore/update port.
	var releasePort func()
	requestedPort := options.Port
	options.Port, releasePort, err = as.reserveRequestedPort(options.Port, options.PortIsPreference)
	if err != nil {
		return nil, err
	}
	defer releasePort()

	// 2b. Start declared node dependencies first while the requested node port
	// is reserved.
	as.startNodeDependencies(agentNode, inProgress, options)

	// 3. Allocate port
	fmt.Printf("🔍 Searching for available port...\n")
	port := options.Port
	if port == 0 {
		port, err = as.portManager.FindFreePort(8001)
		if err != nil {
			return nil, fmt.Errorf("failed to allocate port: %w", err)
		}
	}

	// 4-5. Start the process and wait for readiness. Automatically allocated and
	// internal preferred ports retry exactly once on a fresh port after a strict
	// bind conflict. Explicit user ports fail on the requested port.
	retryOnConflict := requestedPort <= 0 || options.PortIsPreference
	pid, port, startErr := as.startWithPortRetry(port, retryOnConflict, func(p int) (int, error, bool) {
		return as.attemptStart(agentNode, name, p)
	})
	if startErr != nil {
		// Surface the node's own log inline so the real traceback / exit reason
		// is visible without a separate `af logs` round-trip.
		as.printStartupFailureDiagnostics(agentNode, name)
		return nil, startErr
	}

	fmt.Printf("🧠 Agent node registered with AgentField Server\n")

	// 6. Update registry with runtime info. A node the registry cannot record
	// must not be left running: the next restore would start another copy
	// beside it (a full volume, for instance, fails every write).
	if err := as.updateRuntimeInfo(name, port, pid); err != nil {
		if stopErr := as.processManager.Stop(pid); stopErr != nil {
			fmt.Printf("Warning: could not stop unrecorded node %s (pid %d): %v\n", name, pid, stopErr)
		}
		return nil, fmt.Errorf("failed to update runtime info: %w", err)
	}

	// 7. Display agent node capabilities
	if err := as.displayCapabilities(agentNode, port); err != nil {
		fmt.Printf("⚠️  Could not fetch capabilities: %v\n", err)
	}

	fmt.Printf("\n💡 Agent node running in background (PID: %d)\n", pid)
	fmt.Printf("💡 View logs: af logs %s\n", name)
	fmt.Printf("💡 Stop agent node: af stop %s\n", name)

	// Convert to domain model and return
	runningAgent := as.convertToRunningAgent(agentNode)
	runningAgent.PID = pid
	runningAgent.Port = port
	runningAgent.StartedAt = time.Now()

	return &runningAgent, nil
}

func (as *DefaultAgentService) reserveRequestedPort(port int, allowFallback bool) (int, func(), error) {
	if port <= 0 {
		return port, func() {}, nil
	}
	if err := as.portManager.ReservePort(port); err != nil {
		if allowFallback {
			return 0, func() {}, nil
		}
		return 0, func() {}, fmt.Errorf("requested port %d is unavailable: %w", port, err)
	}
	return port, func() { _ = as.portManager.ReleasePort(port) }, nil
}

// attemptStart builds the process config, starts the node on the given port,
// and waits for it to answer its health check. On failure it stops the process
// and reports whether the failure was a strict-port bind conflict (detected
// from the node's own log), which the caller uses to decide on a fresh-port
// retry.
func (as *DefaultAgentService) attemptStart(agentNode packages.InstalledPackage, name string, port int) (pid int, err error, portConflict bool) {
	fmt.Printf("✅ Assigned port: %d\n", port)

	fmt.Printf("📡 Starting agent node process...\n")
	processConfig, err := as.buildProcessConfig(agentNode, port)
	if err != nil {
		return 0, err, false
	}
	pid, err = as.processManager.Start(processConfig)
	if err != nil {
		return 0, fmt.Errorf("failed to start agent node: %w", err), false
	}

	healthPath := "/health"
	expectedNodeID := name
	if metadata, err := packages.ParsePackageMetadata(agentNode.Path); err == nil {
		healthPath = metadata.HealthcheckPath()
		if metadata.AgentNode.NodeID != "" {
			expectedNodeID = metadata.AgentNode.NodeID
		}
	}

	if waitErr := as.waitForAgentNode(port, healthPath, expectedNodeID, nodeReadyTimeout()); waitErr != nil {
		// Read the log before killing so a strict-port exit is still visible.
		conflict := logIndicatesPortConflict(readLogTailLines(agentNode.Runtime.LogFile, 40))
		if stopErr := as.processManager.Stop(pid); stopErr != nil {
			return 0, fmt.Errorf("agent node failed to start: %w (additionally failed to stop process: %v)", waitErr, stopErr), conflict
		}
		return 0, fmt.Errorf("agent node failed to start: %w", waitErr), conflict
	}
	return pid, nil, false
}

// startWithPortRetry runs attemptFn on the initial port. When retryOnConflict
// is true (for an automatically allocated port), a strict-port conflict is
// retried exactly once on a fresh port. It returns the final pid, the port
// actually used, and any error.
func (as *DefaultAgentService) startWithPortRetry(initialPort int, retryOnConflict bool, attemptFn func(port int) (pid int, err error, portConflict bool)) (int, int, error) {
	port := initialPort
	pid, err, conflict := attemptFn(port)
	if err == nil || !conflict || !retryOnConflict {
		return pid, port, err
	}

	retryPort, rerr := as.freshRetryPort(port)
	if rerr != nil || retryPort == port {
		// No distinct fresh port to try — keep the original failure.
		return pid, port, err
	}

	fmt.Printf("⚠️  Port %d unavailable, retrying on a fresh port\n", port)
	pid, err, _ = attemptFn(retryPort)
	return pid, retryPort, err
}

// freshRetryPort excludes the port that just failed to bind, then asks the port
// manager for a new one, so the retry never reuses the conflicting port.
func (as *DefaultAgentService) freshRetryPort(failedPort int) (int, error) {
	_ = as.portManager.ReservePort(failedPort)
	return as.portManager.FindFreePort(8001)
}

// printStartupFailureDiagnostics prints the tail of the node's log so the real
// exit reason (traceback, bind err
```

### Core Architecture Module: `control-plane/internal/core/services/dev_service.go`
```
//go:build !windows

package services

import (
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/Agent-Field/agentfield/control-plane/internal/core/domain"
	"github.com/Agent-Field/agentfield/control-plane/internal/core/interfaces"
	"github.com/Agent-Field/agentfield/control-plane/internal/packages"
)

type DefaultDevService struct {
	processManager interfaces.ProcessManager
	portManager    interfaces.PortManager
	fileSystem     interfaces.FileSystemAdapter
}

var (
	absPathForDevMode = filepath.Abs
	agentPortStart    = 8001
	agentPortEnd      = 8999
)

func NewDevService(
	processManager interfaces.ProcessManager,
	portManager interfaces.PortManager,
	fileSystem interfaces.FileSystemAdapter,
) interfaces.DevService {
	return &DefaultDevService{
		processManager: processManager,
		portManager:    portManager,
		fileSystem:     fileSystem,
	}
}

func (ds *DefaultDevService) RunInDevMode(path string, options domain.DevOptions) error {
	// Convert to absolute path
	absPath, err := absPathForDevMode(path)
	if err != nil {
		return fmt.Errorf("failed to resolve path: %w", err)
	}

	// Check if agentfield.yaml exists
	agentfieldYamlPath := filepath.Join(absPath, "agentfield.yaml")
	if !ds.fileSystem.Exists(agentfieldYamlPath) {
		return fmt.Errorf("no agentfield.yaml found in %s", absPath)
	}

	return ds.runDev(absPath, options)
}

func (ds *DefaultDevService) StopDevMode(path string) error {
	// TODO: Implement dev mode stopping logic
	// This would involve tracking running dev processes and stopping them
	return fmt.Errorf("stop dev mode not yet implemented")
}

func (ds *DefaultDevService) GetDevStatus(path string) (*domain.DevStatus, error) {
	// TODO: Implement dev status retrieval
	// This would involve checking if a dev server is running for the given path
	return nil, fmt.Errorf("get dev status not yet implemented")
}

// runDev starts the agent package in development mode
func (ds *DefaultDevService) runDev(packagePath string, options domain.DevOptions) error {
	fmt.Printf("🔧 Development Mode: %s\n", packagePath)

	var agentCmd *exec.Cmd // Declare agentCmd here to be accessible in defer and signal handler

	// Setup signal handling to gracefully shut down
	sigs := make(chan os.Signal, 1)
	signal.Notify(sigs, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		sig := <-sigs
		fmt.Printf("\nReceived signal: %s. Initiating shutdown...\n", sig)
		// Attempt to gracefully terminate the agent process group
		if agentCmd != nil && agentCmd.Process != nil {
			// Send SIGINT to the process group. Negative PID sends to the group.
			if err := syscall.Kill(-agentCmd.Process.Pid, syscall.SIGINT); err != nil {
				// If group signal fails, try to kill the main process directly
				if errKill := agentCmd.Process.Kill(); errKill != nil {
					fmt.Printf("⚠️ Failed to kill agent process: %v\n", errKill)
				}
			}
		}
	}()

	// 1. Start agent process (let Python SDK choose its own port)
	fmt.Printf("📡 Starting agent process...\n")
	var agentStartErr error
	agentCmd, agentStartErr = ds.startDevProcess(packagePath, options.Port, options)
	if agentStartErr != nil {
		return fmt.Errorf("failed to start agent: %w", agentStartErr)
	}

	// 2. A requested dev port is authoritative and avoids probing a thousand
	// closed loopback ports. With no requested port, retain SDK auto-discovery.
	port := options.Port
	var discoverErr error
	if port > 0 {
		discoverErr = ds.waitForAgent(port, 120*time.Second)
	} else {
		port, discoverErr = ds.discoverAgentPort(120 * time.Second)
	}
	if discoverErr != nil {
		if agentCmd.Process != nil {
			_ = agentCmd.Process.Kill()
		}
		return fmt.Errorf("failed to discover agent port: %w", discoverErr)
	}

	fmt.Printf("✅ Agent ready on port %d\n", port)

	// 3. Display capabilities
	if err := ds.displayDevCapabilities(port); err != nil {
		fmt.Printf("⚠️  Could not fetch capabilities: %v\n", err)
	}

	// Always run in foreground for dev mode (no detach option)
	fmt.Printf("\n💡 Agent running in foreground\n")
	fmt.Printf("💡 Access at: http://localhost:%d\n", port)
	fmt.Printf("💡 Press Ctrl+C to stop\n\n")

	// Wait for process to complete
	if agentErr := agentCmd.Wait(); agentErr != nil {
		if exitErr, ok := agentErr.(*exec.ExitError); ok {
			if ws, ok := exitErr.Sys().(syscall.WaitStatus); ok {
				if ws.Signaled() && (ws.Signal() == syscall.SIGINT || ws.Signal() == syscall.SIGTERM) {
					fmt.Printf("Agent process terminated by signal: %s\n", ws.Signal())
				} else {
					fmt.Printf("Agent process exited with error: %v\n", agentErr)
				}
			} else {
				fmt.Printf("Agent process exited with error: %v\n", agentErr)
			}
		} else {
			fmt.Printf("Error waiting for agent process: %v\n", agentErr)
		}
	}

	return nil
}

// getFreePort finds an available port in the range 8001-8999.
//
//nolint:unused // retained for future dev-service enhancements
func (ds *DefaultDevService) getFreePort() (int, error) {
	// Use port manager if available, otherwise fall back to direct check
	if ds.portManager != nil {
		port, err := ds.portManager.FindFreePort(8001)
		if err != nil {
			return 0, fmt.Errorf("no free port available: %w", err)
		}
		return port, nil
	}

	// Fallback: direct port checking
	for port := agentPortStart; port <= agentPortEnd; port++ {
		if ds.isPortAvailable(port) {
			return port, nil
		}
	}
	return 0, fmt.Errorf("no free port available in range 8001-8999")
}

// isPortAvailable checks if a port is available.
//
//nolint:unused // retained for future dev-service enhancements
func (ds *DefaultDevService) isPortAvailable(port int) bool {
	// Use port manager if available, otherwise fall back to direct check
	if ds.portManager != nil {
		return ds.portManager.IsPortAvailable(port)
	}

	// Fallback: direct port checking
	conn, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", port))
	if err != nil {
		return false
	}
	conn.Close()
	return true
}

// startDevProcess starts the agent process in development mode
func (ds *DefaultDevService) startDevProcess(packagePath string, port int, options domain.DevOptions) (*exec.Cmd, error) {
	// Prepare environment variables
	env := os.Environ()
	// Only set PORT if it's a valid port (> 0), otherwise let Python agent choose its own port
	if port > 0 {
		env = append(env, fmt.Sprintf("PORT=%d", port))
	}
	env = append(env, fmt.Sprintf("AGENTFIELD_SERVER_URL=%s", resolveServerURL()))
	env = append(env, "AGENTFIELD_DEV_MODE=true")
	// Same contract as `af run`: pass the resolved API key through so the agent
	// can register against a control plane with authentication enabled.
	if key := packages.ResolveAPIKey(); key != "" {
		env = append(env, fmt.Sprintf("AGENTFIELD_API_KEY=%s", key))
	}

	// Load environment variables from package .env file
	if envVars, err := ds.loadDevEnvFile(packagePath); err == nil {
		for key, value := range envVars {
			env = append(env, fmt.Sprintf("%s=%s", key, value))
		}
		if options.Verbose {
			fmt.Printf("🔧 Loaded %d environment variables from .env file\n", len(envVars))
		}
	}

	// Prepare command - use virtual environment if available
	var pythonPath string
	venvPath := filepath.Join(packagePath, "venv")

	// Check if virtual environment exists
	if _, err := os.Stat(filepath.Join(venvPath, "bin", "python")); err == nil {
		pythonPath = filepath.Join(venvPath, "bin", "python")
		if options.Verbose {
			fmt.Printf("🐍 Using virtual environment: %s\n", venvPath)
		}
	} else if _, err := os.Stat(filepath.Join(venvPath, "Scripts", "python.exe")); err == nil {
		pythonPath = filepath.Join(venvPath, "Scripts", "python.exe") // Windows
		if options.Verbose {
			fmt.Printf("🐍 Using virtual environment: %s\n", venvPath)
		}
	} else {
		// Fallback to system python
		pythonPath = "python"
		if options.Verbose {
			fmt.Printf("⚠️  Virtual environment not found, using system Python\n")
		}
	}

	cmd := exec.Command(pythonPath, "main.py")
	cmd.Dir = packagePath
	cmd.Env = env

	// Show output in terminal for interactive mode
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	// Start process
	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("failed to start process: %w", err)
	}

	return cmd, nil
}

// discoverAgentPort discovers the port the agent actually chose by scanning common ports
func (ds *DefaultDevService) discoverAgentPort(timeout time.Duration) (int, error) {
	// Use the smaller of 2s and the total timeout for per-request deadlines,
	// so short timeouts (e.g., in tests) are actually respected.
	perReq := 2 * time.Second
	if timeout < perReq {
		perReq = timeout
	}
	client := packages.NewNodeHTTPClient(perReq)
	deadline := time.Now().Add(timeout)

	fmt.Printf("🔍 Discovering agent port...\n")

	checkCount := 0

	for time.Now().Before(deadline) {
		checkCount++

		for port := agentPortStart; port <= agentPortEnd; port++ {
			if time.Now().After(deadline) {
				break
			}
			resp, err := devNodeGet(client, fmt.Sprintf("http://127.0.0.1:%d/health", port))

			if err == nil && resp.StatusCode == 200 {
				resp.Body.Close()
				fmt.Printf("✅ Discovered agent on port %d after %d checks\n", port, checkCount)
				return port, nil
			}

			if resp != nil {
				resp.Body.Close()
			}
		}

		// Log progress every 20 checks to avoid spam
		if checkCount%20 == 0 {
			fmt.Printf("🔄 Port discovery attempt %d...\n", checkCount)
		}

		time.Sleep(500 * time.Millisecond)
	}

	return 0, fmt.Errorf("could not discover agent port within %v after %d attempts", timeout, checkCount)
}

// waitForAgent waits for the agent to become ready in dev mode.
func (ds *DefaultDevService) waitForAgent(port int, timeout time.Duration) error {
	client := packages.NewNodeHTTPClient(2 * time.Second)
	deadline := time.Now().Add(timeout)

	fmt.Printf("🔍 Waiting for agent to become ready on port %d...\n", port)

	lastError := ""
	checkCount := 0

	for time.Now().Before(deadline) {
		checkCount++
		resp, err := devNodeGet(client, fmt.Sprintf("http://127.0
```

### Core Architecture Module: `control-plane/internal/core/services/dev_service_windows.go`
```
//go:build windows

package services

import (
	"fmt"

	"github.com/Agent-Field/agentfield/control-plane/internal/core/domain"
	"github.com/Agent-Field/agentfield/control-plane/internal/core/interfaces"
)

// DefaultDevService is a stub for Windows builds.
type DefaultDevService struct{}

// NewDevService returns a stub implementation for Windows builds.
func NewDevService(
	processManager interfaces.ProcessManager,
	portManager interfaces.PortManager,
	fileSystem interfaces.FileSystemAdapter,
) interfaces.DevService {
	return &DefaultDevService{}
}

func (ds *DefaultDevService) RunInDevMode(path string, options domain.DevOptions) error {
	return fmt.Errorf("development mode is not supported on Windows yet")
}

func (ds *DefaultDevService) StopDevMode(path string) error {
	return fmt.Errorf("development mode is not supported on Windows yet")
}

func (ds *DefaultDevService) GetDevStatus(path string) (*domain.DevStatus, error) {
	return nil, fmt.Errorf("development mode is not supported on Windows yet")
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1094** (2026-10-03): **test(sdk): verify Windows batch probe end-to-end and harden cmd.exe branch**
  *Symptoms*: Real Windows verification for `batchProbeInvocation` plus batch-path hardening. This supersedes the never-merged Windows test prepared for PR #1075, whose fix branch was overtaken by the environment-token template that landed on main in a different change.  ## Real Windows verification  A new win32-only end-to-end test in `sdk/typescript/tests/harness_doctor.test.ts`:  - Creates a directory whose name contains a space under the OS temp dir and writes a real `probe.cmd` inside it that echoes a unique marker, its own path, and its arguments. - Resolves the shim through `PATH`/`PATHEXT` using the actual `findExecutable` (via a `codex.cmd` shim that forwards to `probe.cmd`). - Calls `harnessDoctor`, which invokes `defaultVersionProbe`, exercising the real `batchProbeInvocation` path with the actual `execFile` (mock passthrough to `vi.importActual`, restored after) — so `cmd.exe` genuinely executes with `/d /v:off /s /c` and the fixed `%AGENTFIELD_PROBE_ARG_*%` token template. - Asserts the marker, the full spaced path, and the `--version` argument come back, and the health result is `usable: true` with no `version_probe_failed` issue. - Skipped on non-Windows hosts, so Linux CI is unaffected.  A narrow `windows-latest` Node 20 job in `.github/workflows/sdk-typescript.yml` runs only `tests/harness_doctor.test.ts` and is wired into the existing required-checks aggregate.  ## Batch-path hardening  - `defaultVersionProbe` batch and non-batch paths now use explicit, separate `execFile

- **Issue #1089** (2026-10-20): **Python SDK: remaining env flags with strict boolean parsing**
  *Symptoms*: #1082 fixed `AsyncConfig.from_environment()` so the `AGENTFIELD_ASYNC_*` flags accept the same truthy/falsy vocabulary as the rest of the SDK (`1/true/yes/on`, `0/false/no/off`, unknown keeps the default). A few env flags still parse more strictly:  - `sdk/python/agentfield/logger.py` ~112/115/117: `AGENTFIELD_LOG_PAYLOADS`, `AGENTFIELD_LOG_TRACKING` and `AGENTFIELD_LOG_FIRE` use `== "true"`, so `=1` doesn't enable them. - `agent.py` ~183: the truthy set is `{"1","true","yes"}`, with no `"on"`. - `agent_server.py` ~757/792: `== "1"` and `== "true"`.  Also from the #1082 review: each `AsyncConfig` flag parser bakes in the field's built-in default, so a subclass that changes a default gets the wrong value for an unrecognised string. One parser that raises `ValueError` on unknown values, letting `get_env_var`'s existing fallback return the class's real default, would fix that. The #1082 author offered to follow up.  Small, low risk. Good first issue material. 

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

### Incident Patch 1: `fe6f9cb9` (2026-10-30)
**Commit Message**: fix(python): URL-encode memory subscription filters (#1137)

* fix(python): encode memory event subscription query parameters

* test(control-plane): drain MCP jobs before replacing shared state

* fix(build): format Go packages without recursive overlap

* chore: move validation fixes to focused pull requests

**File**: `sdk/python/agentfield/memory_events.py` (modified, +6/-5)
```diff
@@ -4,6 +4,7 @@
 from datetime import datetime
 from functools import wraps
 from typing import Any, Callable, Dict, List, Optional, Union
+from urllib.parse import urlencode
 
 import websockets
 
@@ -152,16 +153,16 @@ async def connect(
                 ws_url = f"{self.base_url}/api/v1/memory/events/ws"
 
                 # Add query parameters for server-side filtering
-                query_params = []
+                query_params = {}
                 if patterns:
-                    query_params.append(f"patterns={','.join(patterns)}")
+                    query_params["patterns"] = ",".join(patterns)
                 if scope:
-                    query_params.append(f"scope={scope}")
+                    query_params["scope"] = scope
                 if scope_id:
-                    query_params.append(f"scope_id={scope_id}")
+                    query_params["scope_id"] = scope_id
 
                 if query_params:
-                    ws_url += "?" + "&".join(query_params)
+                    ws_url += "?" + urlencode(query_params)
 
                 self.websocket = await asyncio.wait_for(
                     websockets.connect(ws_url, **{_HEADERS_KWARG: headers}),
```

**File**: `sdk/python/tests/test_memory_events.py` (modified, +32/-10)
```diff
@@ -1,6 +1,7 @@
 import asyncio
 import json
 from types import SimpleNamespace
+from urllib.parse import parse_qs, urlsplit
 
 import websockets
 
@@ -161,7 +162,18 @@ async def get(self, url, params=None, headers=None, timeout=None):
 
 
 @pytest.mark.asyncio
-async def test_memory_event_client_connect_builds_ws_url(monkeypatch):
+@pytest.mark.parametrize(
+    ("patterns", "scope", "scope_id"),
+    [
+        (["cart.*", "order.*"], "session", "abc"),
+        (["user+plan.*"], "actor", "alice+trial@example.com"),
+        (["cart&total.*", "issue#*"], "session", "team&env=prod#1"),
+        (["user preferences.*", "用户.*"], "workflow", "会话 + 1"),
+    ],
+)
+async def test_memory_event_client_connect_builds_ws_url(
+    monkeypatch, patterns, scope, scope_id
+):
     ctx = SimpleNamespace(to_headers=lambda: {"Authorization": "token"})
     client = MemoryEventClient("http://agentfield", ctx)
 
@@ -174,7 +186,9 @@ def __init__(self):
 
     async def fake_connect(url, **kwargs):
         record["url"] = url
-        record["headers"] = kwargs.get("additional_headers") or kwargs.get("extra_headers")
+        record["headers"] = kwargs.get("additional_headers") or kwargs.get(
+            "extra_headers"
+        )
         return DummyWebSocket()
 
     async def fake_listen(self):
@@ -183,15 +197,19 @@ async def fake_listen(self):
     monkeypatch.setattr("agentfield.memory_events.websockets.connect", fake_connect)
     monkeypatch.setattr(MemoryEventClient, "_listen", fake_listen, raising=False)
 
-    await client.connect(
-        patterns=["cart.*", "order.*"], scope="session", scope_id="abc"
-    )
+    await client.connect(patterns=patterns, scope=scope, scope_id=scope_id)
     await asyncio.sleep(0)
 
-    assert record["url"].startswith("ws://agentfield")
-    assert "patterns=cart.*,order.*" in record["url"]
-    assert "scope=session" in record["url"]
-    assert "scope_id=abc" in record["url"]
+    parsed_url = urlsplit(record["url"])
+    assert parsed_url.scheme == "ws"
+    assert parsed_url.netloc == "agentfield"
+    assert parsed_url.path == "/api/v1/memory/events/ws"
+    assert parsed_url.fragment == ""
+    assert parse_qs(parsed_url.query) == {
+        "patterns": [",".join(patterns)],
+        "scope": [scope],
+        "scope_id": [scope_id],
+    }
     assert record["headers"] == {"Authorization": "token"}
     assert listener_called.get("run") is True
 
@@ -225,6 +243,7 @@ def __init__(self):
 
     async def fake_connect(url, **kwargs):
         called_with.update(kwargs)
+        called_with["url"] = url
         return DummyWebSocket()
 
     monkeypatch.setattr("agentfield.memory_events.websockets.connect", fake_connect)
@@ -235,6 +254,7 @@ async def fake_connect(url, **kwargs):
 
     assert _HEADERS_KWARG in called_with
     assert called_with[_HEADERS_KWARG] == {"Authorization": "token"}
+    assert called_with["url"] == "ws://agentfield/api/v1/memory/events/ws"
 
 
 @pytest.mark.asyncio
@@ -260,7 +280,9 @@ async def fake_reconnect(self):
     # Give the background task a chance to start
     await asyncio.sleep(0.05)
 
-    assert reconnect_started.is_set(), "reconnect should have been started in background"
+    assert reconnect_started.is_set(), (
+        "reconnect should have been started in background"
+    )
     assert not client.is_listening
 
 
```

---

### Incident Patch 2: `db7d3dea` (2026-10-30)
**Commit Message**: fix(sdk/python): honor numeric Retry-After minimum waits (#1129)

* fix(sdk/python): honor numeric Retry-After waits

* style(sdk/python): normalize config field wrapping

* fix(sdk/python): cap honoured Retry-After waits at five minutes

Treating every finite Retry-After as a minimum let a provider
suspend each retry indefinitely: a 86400s hint made the default
five retries sleep five days, with no outer deadline on direct
Agent.ai calls. Honour hints up to max(rate_limit_max_delay, 300s)
and clamp anything larger to that ceiling, so jitter still never
retries before the (capped) cooldown.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

---------

Co-authored-by: Abir Abbas <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `sdk/python/agentfield/rate_limiter.py` (modified, +12/-5)
```diff
@@ -1,12 +1,16 @@
 import asyncio
 import hashlib
+import math
 import os
 import random
 import time
 from typing import Any, Optional
 from agentfield.logger import log_debug
 
 
+_MAX_RETRY_AFTER_SECONDS = 300.0
+
+
 class RateLimitError(Exception):
     """Custom exception for rate limit errors"""
 
@@ -138,9 +142,12 @@ def _calculate_backoff_delay(
         Returns:
             float: Delay in seconds
         """
-        # Use server-suggested delay if available and reasonable
-        if retry_after and retry_after <= self.max_delay:
-            base_delay = retry_after
+        # Honour server cooldowns up to the ceiling, even above the local
+        # exponential-backoff cap. Invalid hints use the normal backoff.
+        minimum_delay = 0.0
+        if retry_after is not None and math.isfinite(retry_after) and retry_after > 0:
+            base_delay = min(retry_after, max(self.max_delay, _MAX_RETRY_AFTER_SECONDS))
+            minimum_delay = base_delay
         else:
             # Exponential backoff: base_delay * (2 ^ attempt)
             base_delay = min(self.base_delay * (2**attempt), self.max_delay)
@@ -154,8 +161,8 @@ def _calculate_backoff_delay(
         jitter_range = base_delay * self.jitter_factor
         jitter = rng.uniform(-jitter_range, jitter_range)
 
-        # Ensure minimum delay and apply jitter
-        delay = max(0.1, base_delay + jitter)
+        # Negative jitter must not end the server's cooldown early.
+        delay = max(0.1, minimum_delay, base_delay + jitter)
 
         log_debug(
             f"Rate limit backoff: attempt={attempt}, base_delay={base_delay:.2f}s, jitter={jitter:.2f}s, total_delay={delay:.2f}s"
```

**File**: `sdk/python/agentfield/types.py` (modified, +7/-4)
```diff
@@ -349,10 +349,10 @@ class HarnessConfig(BaseModel):
     pi_bin: str = Field(default="pi", description="Path to Pi binary.")
     omp_bin: str = Field(default="omp", description="Path to OMP binary.")
     aforge_bin: str = Field(default="aforge", description="Path to aforge binary.")
-    codeaf_bin: Optional[str] = Field(default=None, description="Path to CodeAF binary.")
-    grok_bin: str = Field(
-        default="grok", description="Path to Grok Build CLI binary."
+    codeaf_bin: Optional[str] = Field(
+        default=None, description="Path to CodeAF binary."
     )
+    grok_bin: str = Field(default="grok", description="Path to Grok Build CLI binary.")
     schema_mode: str = Field(
         default="single",
         description=(
@@ -483,7 +483,10 @@ def image_model(self) -> str:
     )
     rate_limit_max_delay: float = Field(
         default=30.0,
-        description="Maximum delay for rate limit backoff in seconds.",
+        description=(
+            "Maximum base exponential backoff delay in seconds. A valid Retry-After "
+            "can require a longer wait, up to 5 minutes or this value if larger."
+        ),
     )
     rate_limit_jitter_factor: float = Field(
         default=0.25,
```

**File**: `sdk/python/tests/test_rate_limiter_core.py` (modified, +92/-0)
```diff
@@ -65,6 +65,98 @@ async def flaky_call():
     assert attempts["sleeps"][0] == pytest.approx(0.2)
 
 
+@pytest.mark.unit
+@pytest.mark.asyncio
+@pytest.mark.parametrize("retry_after", [10.0, 60.0])
+async def test_execute_with_retry_respects_server_wait(monkeypatch, retry_after):
+    limiter = StatelessRateLimiter(max_retries=1, max_delay=30.0, jitter_factor=0.25)
+    elapsed = 0.0
+    attempts = []
+
+    async def fake_sleep(delay):
+        nonlocal elapsed
+        elapsed += delay
+
+    async def rate_limited_call():
+        attempts.append(elapsed)
+        if len(attempts) == 1:
+            raise DummyHTTPError(retry_after=retry_after)
+        return "ok"
+
+    monkeypatch.setattr("agentfield.rate_limiter.asyncio.sleep", fake_sleep)
+    # Exercise the earliest retry the configured jitter can produce.
+    monkeypatch.setattr(random.Random, "uniform", lambda self, low, high: low)
+
+    assert await limiter.execute_with_retry(rate_limited_call) == "ok"
+    assert len(attempts) == 2
+    assert attempts[1] >= retry_after
+
+
+@pytest.mark.unit
+@pytest.mark.asyncio
+@pytest.mark.parametrize(
+    "max_delay, retry_after, jitter_end, expected_wait",
+    [
+        (30.0, 3600.0, "low", 300.0),
+        (30.0, 3600.0, "high", 375.0),
+        (600.0, 500.0, "low", 500.0),
+        (600.0, 3600.0, "low", 600.0),
+    ],
+)
+async def test_execute_with_retry_bounds_server_wait(
+    monkeypatch, max_delay, retry_after, jitter_end, expected_wait
+):
+    limiter = StatelessRateLimiter(
+        max_retries=1, max_delay=max_delay, jitter_factor=0.25
+    )
+    attempts = 0
+    sleeps = []
+
+    async def fake_sleep(delay):
+        sleeps.append(delay)
+
+    async def rate_limited_call():
+        nonlocal attempts
+        attempts += 1
+        if attempts == 1:
+            raise DummyHTTPError(retry_after=retry_after)
+        return "ok"
+
+    monkeypatch.setattr("agentfield.rate_limiter.asyncio.sleep", fake_sleep)
+    monkeypatch.setattr(
+        random.Random,
+        "uniform",
+        lambda self, low, high: low if jitter_end == "low" else high,
+    )
+
+    assert await limiter.execute_with_retry(rate_limited_call) == "ok"
+    assert sleeps == [pytest.approx(expected_wait)]
+
+
+@pytest.mark.unit
+@pytest.mark.asyncio
+@pytest.mark.parametrize("retry_after", [-1.0, float("nan"), float("inf")])
+async def test_execute_with_retry_ignores_invalid_server_wait(monkeypatch, retry_after):
+    limiter = StatelessRateLimiter(max_retries=1, base_delay=0.5, jitter_factor=0.0)
+    attempts = 0
+    sleeps = []
+
+    async def fake_sleep(delay):
+        sleeps.append(delay)
+
+    async def rate_limited_call():
+        nonlocal attempts
+        attempts += 1
+        if attempts == 1:
+            raise DummyHTTPError(retry_after=retry_after)
+        return "ok"
+
+    monkeypatch.setattr("agentfield.rate_limiter.asyncio.sleep", fake_sleep)
+
+    assert await limiter.execute_with_retry(rate_limited_call) == "ok"
+    assert sleeps == [0.5]
+
+
 @pytest.mark.unit
 @pytest.mark.asyncio
 async def test_execute_with_retry_gives_up(monkeypatch):
```

---

### Incident Patch 3: `72a32885` (2026-10-30)
**Commit Message**: fix(sdk/go): request usage on streamed completions from OpenAI endpoints (#1134)

* fix(sdk/go): request usage on streamed completions from OpenAI endpoints

StreamComplete never sent stream_options.include_usage, so against OpenAI
(and Azure OpenAI) the final chunk carried no usage and streamed calls
reported no token counts, even though StreamChunk.Usage documents that
field. Send include_usage on streaming requests to the endpoints that
already get the max_completion_tokens rewrite (OpenAI, Azure OpenAI,
OpenRouter); self-hosted servers keep the plain body.

Co-Authored-By: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

* docs(sdk/go): guard the AIStream example against the usage-only final chunk

Co-Authored-By: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

---------

Co-authored-by: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

**File**: `sdk/go/agent/agent.go` (modified, +3/-1)
```diff
@@ -2780,7 +2780,9 @@ func agentToolNameToInvocationTarget(name string) string {
 //
 //	chunks, errs := agent.AIStream(ctx, "Tell me a story")
 //	for chunk := range chunks {
-//	    fmt.Print(chunk.Choices[0].Delta.Content)
+//	    if len(chunk.Choices) > 0 {
+//	        fmt.Print(chunk.Choices[0].Delta.Content)
+//	    }
 //	}
 //	if err := <-errs; err != nil {
 //	    log.Fatal(err)
```

**File**: `sdk/go/ai/model_params.go` (modified, +9/-0)
```diff
@@ -99,6 +99,15 @@ func (c *Client) marshalRequest(req *Request) ([]byte, error) {
 		req.Usage = &RequestUsage{Include: true}
 	}
 
+	// OpenAI (and Azure OpenAI, OpenRouter) only report token usage on a
+	// stream when the request opts in with stream_options.include_usage.
+	// Self-hosted OpenAI-compatible servers may reject or drop the field, so
+	// it is limited to the same endpoints as the max_completion_tokens
+	// rewrite. Requests that already set StreamOptions are left alone.
+	if req.Stream && req.StreamOptions == nil && isVouchedRewriteEndpoint(c.config.BaseURL) {
+		req.StreamOptions = &StreamOptions{IncludeUsage: true}
+	}
+
 	model := req.Model
 	if model == "" {
 		model = c.config.Model
```

**File**: `sdk/go/ai/model_params_test.go` (modified, +94/-0)
```diff
@@ -607,3 +607,97 @@ func TestComplete_WireBody_UnknownHostKeepsMaxTokens(t *testing.T) {
 		t.Errorf("expected max_tokens=654, got %v", val)
 	}
 }
+
+func TestStreamComplete_WireBody_VouchedEndpointRequestsUsage(t *testing.T) {
+	// OpenAI only reports token usage on a stream when the request carries
+	// stream_options.include_usage; without it the final chunk has no usage.
+	cfg := &Config{
+		APIKey:  "test-key",
+		BaseURL: "https://api.openai.com/v1",
+		Model:   "gpt-5",
+	}
+
+	client, err := NewClient(cfg)
+	if err != nil {
+		t.Fatalf("NewClient error: %v", err)
+	}
+	rt := &recordingTransport{}
+	client.httpClient.Transport = rt
+
+	chunks, errs := client.StreamComplete(context.Background(), "hello")
+	for range chunks {
+	}
+	<-errs
+
+	var raw map[string]interface{}
+	if err := json.Unmarshal(rt.body, &raw); err != nil {
+		t.Fatalf("unmarshal captured body: %v", err)
+	}
+
+	opts, ok := raw["stream_options"].(map[string]interface{})
+	if !ok {
+		t.Fatalf("expected stream_options in the wire body for api.openai.com, got %s", rt.body)
+	}
+	if opts["include_usage"] != true {
+		t.Errorf("expected stream_options.include_usage=true, got %v", opts["include_usage"])
+	}
+}
+
+func TestStreamComplete_WireBody_UnknownHostOmitsStreamOptions(t *testing.T) {
+	// Self-hosted OpenAI-compatible servers (Ollama, LM Studio, llama.cpp)
+	// may reject or ignore unknown fields: they keep the plain stream body.
+	var captured []byte
+	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+		b, err := io.ReadAll(r.Body)
+		if err != nil {
+			http.Error(w, err.Error(), http.StatusInternalServerError)
+			return
+		}
+		captured = b
+		w.Header().Set("Content-Type", "text/event-stream")
+		_, _ = io.WriteString(w, "data: [DONE]\n\n")
+	}))
+	defer server.Close()
+
+	client, err := NewClient(&Config{APIKey: "test-key", BaseURL: server.URL, Model: "llama3"})
+	if err != nil {
+		t.Fatalf("NewClient error: %v", err)
+	}
+
+	chunks, errs := client.StreamComplete(context.Background(), "hello")
+	for range chunks {
+	}
+	if err := <-errs; err != nil {
+		t.Fatalf("StreamComplete error: %v", err)
+	}
+
+	var raw map[string]interface{}
+	if err := json.Unmarshal(captured, &raw); err != nil {
+		t.Fatalf("unmarshal captured body: %v", err)
+	}
+	if _, ok := raw["stream_options"]; ok {
+		t.Errorf("expected no stream_options for a self-hosted endpoint, got %s", captured)
+	}
+}
+
+func TestComplete_WireBody_NoStreamOptions(t *testing.T) {
+	// stream_options is only valid on a streaming request.
+	cfg := &Config{APIKey: "test-key", BaseURL: "https://api.openai.com/v1", Model: "gpt-5"}
+	client, err := NewClient(cfg)
+	if err != nil {
+		t.Fatalf("NewClient error: %v", err)
+	}
+	rt := &recordingTransport{}
+	client.httpClient.Transport = rt
+
+	if _, err := client.Complete(context.Background(), "hello"); err != nil {
+		t.Fatalf("Complete error: %v", err)
+	}
+	var raw map[string]interface{}
+	if err := json.Unmarshal(rt.body, &raw); err != nil {
+		t.Fatalf("unmarshal captured body: %v", err)
+	}
+	if _, ok := raw["stream_options"]; ok {
+		t.Errorf("expected no stream_options on a non-streaming request, got %s", rt.body)
+	}
+}
```

**File**: `sdk/go/ai/request.go` (modified, +10/-0)
```diff
@@ -46,6 +46,16 @@ type Request struct {
 	// object carry the native cost of the call; the client sets it
 	// automatically for OpenRouter requests.
 	Usage *RequestUsage `json:"usage,omitempty"`
+
+	// StreamOptions carries streaming-only options. The client sets
+	// include_usage for streaming requests to endpoints known to accept it
+	// (see isVouchedRewriteEndpoint), so the final chunk reports token usage.
+	StreamOptions *StreamOptions `json:"stream_options,omitempty"`
+}
+
+// StreamOptions is the request-body stream_options object (OpenAI shape).
+type StreamOptions struct {
+	IncludeUsage bool `json:"include_usage"`
 }
 
 // RequestUsage is the request-body usage accounting opt-in (OpenRouter shape).
```

#### Recent Merged Pull Requests:
- **PR #1141** (2026-10-30): fix(build): format Go packages without recursive overlap (@remote-controlled-man)
- **PR #1140** (2026-10-30): test(control-plane): drain accepted MCP work between tests (@remote-controlled-man)
- **PR #1138** (2026-10-30): chore(deps): bump msgpack from 1.2.1 to 1.2.3 in /sdk/python in the uv group across 1 directory (@dependabot[bot])
- **PR #1137** (2026-10-30): fix(python): URL-encode memory subscription filters (@remote-controlled-man)
- **PR #1136** (2026-10-29): fix(python): match memory subscription keys literally (@remote-controlled-man)
- **PR #1135** (2026-10-29): docs(readme): announce CodeAF with its DeepSWE benchmark (@oktaygoktas)

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

## X. python): URL-encode memory subscription filters (#1137)

**RULE**:
When implementing operations in `sdk/python/agentfield/memory_events.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Agent-Field/agentfield. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `fe6f9cb9`: python): URL-encode memory subscription filters (#1137). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `sdk/python/agentfield/memory_events.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
from urllib.parse import urlencode
                query_params = {}
                    query_params["patterns"] = ",".join(patterns)
                    query_params["scope"] = scope
                    query_params["scope_id"] = scope_id
                    ws_url += "?" + urlencode(query_params)
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
                query_params = []
                    query_params.append(f"patterns={','.join(patterns)}")
                    query_params.append(f"scope={scope}")
                    query_params.append(f"scope_id={scope_id}")
                    ws_url += "?" + "&".join(query_params)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `fe6f9cb9` are properly handled with clean fallback behavior.
