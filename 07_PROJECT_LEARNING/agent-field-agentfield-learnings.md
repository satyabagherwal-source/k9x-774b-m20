> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/agent-field-agentfield-learnings.md`  
> **Source**: github ([https://github.com/Agent-Field/agentfield](https://github.com/Agent-Field/agentfield))  
> **Source Version**: `522cc8b7`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-12T06:26:58.118Z  
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
> **Harvest Timestamp**: 2026-11-12T06:26:57.958Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Agent-Field/agentfield`
- **Description**: Build, run and scale AI agents like API and microservices
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2653 stars

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

### Incident Patch 1: `186f695c` (2026-11-10)
**Commit Message**: fix(storage): create the relay and approval tables with the schema, never cache a failed create (#1177)

The three tables #1174 added (execution_relay, run_owners, execution_approval_questions) were created lazily with CREATE TABLE IF NOT EXISTS. On Postgres two first uses raced on pg_type_typname_nsp_index, and the store cached the error, so run ownership and relay writes stayed broken until a restart; ordinary executions also ran DDL on every call.

The tables are now created at startup in autoMigrateSchema for SQLite and Postgres. The remaining guard serializes creation per db, caches only success, runs no DDL in steady state, and treats a concurrent create by another process as success.

Proved by the existing-deployments smoke suite (15/15 on main plus this change).

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `control-plane/internal/storage/approval_question.go` (modified, +16/-22)
```diff
@@ -6,7 +6,6 @@ import (
 	"encoding/json"
 	"errors"
 	"fmt"
-	"sync"
 	"time"
 
 	"github.com/Agent-Field/agentfield/control-plane/pkg/types"
@@ -20,35 +19,30 @@ import (
 // read what they approve, so the control plane now keeps the question beside
 // the approval — its kind, a one-line title, the full markdown body (a plan)
 // and the option labels — keyed by (execution_id, approval_request_id), one
-// row per round. It lives in its own table, created lazily like the relay's,
-// so the workflow_executions column lists and their migrations stay as they
-// were.
+// row per round. It lives in its own table, created with the schema alongside
+// the relay's, so the workflow_executions column lists and their migrations
+// stay as they were.
 
-var approvalQuestionTableOnce sync.Map // *sqlDatabase → error
-
-func (ls *LocalStorage) approvalQuestionTable(ctx context.Context) error {
-	if v, ok := approvalQuestionTableOnce.Load(ls.db); ok {
-		if v == nil {
-			return nil
-		}
-		return v.(error)
-	}
-	_, err := ls.db.ExecContext(ctx, `CREATE TABLE IF NOT EXISTS execution_approval_questions (
+var approvalQuestionsSchemaTable = guardedSchemaTable{
+	name: "execution_approval_questions",
+	ddl: `CREATE TABLE IF NOT EXISTS execution_approval_questions (
 		execution_id TEXT NOT NULL,
 		approval_request_id TEXT NOT NULL,
 		kind TEXT NOT NULL,
 		question TEXT,
 		body TEXT,
 		options TEXT,
 		recorded_at TIMESTAMP NOT NULL,
-		PRIMARY KEY (execution_id, approval_request_id))`)
-	if err != nil {
-		err = fmt.Errorf("create execution_approval_questions: %w", err)
-		approvalQuestionTableOnce.Store(ls.db, err)
-		return err
-	}
-	approvalQuestionTableOnce.Store(ls.db, nil)
-	return nil
+		PRIMARY KEY (execution_id, approval_request_id))`,
+	existsQuery: `SELECT 1 FROM execution_approval_questions LIMIT 0`,
+}
+
+// approvalQuestionTable ensures execution_approval_questions exists. THESE
+// TABLES ARE CREATED WITH THE SCHEMA, NOT ON FIRST USE; this guard catches
+// stores built without autoMigrateSchema, serializes creation per db, and
+// caches only success — A FAILED CREATE IS NEVER CACHED.
+func (ls *LocalStorage) approvalQuestionTable(ctx context.Context) error {
+	return ls.ensureSchemaTable(ctx, approvalQuestionsSchemaTable)
 }
 
 // PutApprovalQuestion keeps q for one approval round. A round asked twice
```

**File**: `control-plane/internal/storage/approval_question_test.go` (modified, +4/-4)
```diff
@@ -92,10 +92,10 @@ func TestApprovalQuestionStorage_S8_PutGetUpdateSeparateRoundsAndUnknown(t *test
 }
 
 // Contract S9: execution_approval_questions is created lazily on the first call
-// to a fresh store without a schema migration, and surfaces errors when the
+// to a store constructed without autoMigrateSchema, and surfaces errors when the
 // context or database is closed.
 func TestApprovalQuestionStorage_S9_LazyTableCreationWithoutMigration(t *testing.T) {
-	ls, ctx := setupLocalStorage(t)
+	ls, ctx := newUnmigratedLocalStorage(t)
 
 	var before int
 	err := ls.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'execution_approval_questions'`).Scan(&before)
@@ -122,8 +122,8 @@ func TestApprovalQuestionStorage_S9_LazyTableCreationWithoutMigration(t *testing
 	_, err = ls.GetApprovalQuestion(cancelledCtx, "exec-lazy", "apr-lazy")
 	require.Error(t, err)
 
-	// A closed fresh store surfaces and remembers the lazy DDL error on its db handle.
-	closedLS, closedCtx := setupLocalStorage(t)
+	// A closed unmigrated store surfaces the lazy DDL error on its db handle.
+	closedLS, closedCtx := newUnmigratedLocalStorage(t)
 	require.NoError(t, closedLS.Close(closedCtx))
 	require.Error(t, closedLS.PutApprovalQuestion(closedCtx, types.ApprovalQuestion{
 		ExecutionID:       "exec-closed",
```

**File**: `control-plane/internal/storage/migrations.go` (modified, +97/-0)
```diff
@@ -2,7 +2,10 @@ package storage
 
 import (
 	"context"
+	"errors"
 	"fmt"
+
+	"github.com/jackc/pgx/v5/pgconn"
 )
 
 // migrateAgentNodesCompositePK recreates the agent_nodes table with a composite
@@ -244,5 +247,99 @@ func (ls *LocalStorage) autoMigrateSchema(ctx context.Context) error {
 		return fmt.Errorf("failed to auto-migrate schema: %w", err)
 	}
 
+	// THESE TABLES ARE CREATED WITH THE SCHEMA, NOT ON FIRST USE. Running the
+	// same guarded DDL helpers here creates execution_relay, run_owners, and
+	// execution_approval_questions at startup for both SQLite and PostgreSQL
+	// and marks ls.db ready so steady-state operations issue no DDL.
+	if err := ls.ensureRelayAndApprovalTables(ctx); err != nil {
+		return fmt.Errorf("failed to ensure relay and approval tables: %w", err)
+	}
+
+	return nil
+}
+
+type guardedSchemaTable struct {
+	name        string
+	ddl         string
+	existsQuery string
+}
+
+func (ls *LocalStorage) ensureRelayAndApprovalTables(ctx context.Context) error {
+	if err := ls.relayTable(ctx); err != nil {
+		return err
+	}
+	if err := ls.runOwnerTable(ctx); err != nil {
+		return err
+	}
+	return ls.approvalQuestionTable(ctx)
+}
+
+// ensureSchemaTable creates t on ls.db if it has not yet been confirmed on
+// this database handle.
+//
+// THESE TABLES ARE CREATED WITH THE SCHEMA, NOT ON FIRST USE, via
+// autoMigrateSchema; this guard remains only so stores constructed in tests
+// without autoMigrateSchema still work on first call. Creation is serialized
+// per *sqlDatabase with tableCreateMu so goroutines in one process never race
+// CREATE TABLE IF NOT EXISTS. A FAILED CREATE IS NEVER CACHED: tablesCreated
+// records only confirmed tables, so a transient failure is retried on the next
+// call instead of breaking the store until restart. On PostgreSQL, another
+// process running CREATE TABLE IF NOT EXISTS at the same moment can trip
+// pg_type_typname_nsp_index (SQLSTATE 23505) or pg_class (SQLSTATE 42P07); if
+// the table is present afterward, that peer finished creating it and the guard
+// records success.
+func (ls *LocalStorage) ensureSchemaTable(ctx context.Context, t guardedSchemaTable) error {
+	if ls == nil || ls.db == nil || ls.db.DB == nil {
+		return fmt.Errorf("create %s: sql database is not initialized", t.name)
+	}
+	if _, ok := ls.db.tablesCreated.Load(t.name); ok {
+		return nil
+	}
+
+	ls.db.tableCreateMu.Lock()
+	defer ls.db.tableCreateMu.Unlock()
+
+	if _, ok := ls.db.tablesCreated.Load(t.name); ok {
+		return nil
+	}
+
+	if _, err := ls.db.ExecContext(ctx, t.ddl); err != nil {
+		if ls.isPostgresMode() && isPostgresConcurrentTableCreateError(err) && ls.tableExistsAfterRace(ctx, t) {
+			ls.db.tablesCreated.Store(t.name, struct{}{})
+			return nil
+		}
+		return fmt.Errorf("create %s: %w", t.name, err)
+	}
+
+	ls.db.tablesCreated.Store(t.name, struct{}{})
 	return nil
 }
+
+func (ls *LocalStorage) isPostgresMode() bool {
+	return ls != nil && (ls.mode == "postgres" || ls.db.Mode() == "postgres")
+}
+
+func isPostgresConcurrentTableCreateError(err error) bool {
+	if err == nil {
+		return false
+	}
+	var pgErr *pgconn.PgError
+	if errors.As(err, &pgErr) {
+		return pgErr.Code == "23505" || pgErr.Code == "42P07"
+	}
+	var stateErr interface{ SQLState() string }
+	if errors.As(err, &stateErr) {
+		code := stateErr.SQLState()
+		return code == "23505" || code == "42P07"
+	}
+	return false
+}
+
+func (ls *LocalStorage) tableExistsAfterRace(ctx context.Context, t guardedSchemaTable) bool {
+	rows, err := ls.db.QueryContext(ctx, t.existsQuery)
+	if err != nil {
+		return false
+	}
+	defer rows.Close()
+	return rows.Err() == nil
+}
```

**File**: `control-plane/internal/storage/relay.go` (modified, +26/-29)
```diff
@@ -6,7 +6,6 @@ import (
 	"encoding/json"
 	"errors"
 	"fmt"
-	"sync"
 	"time"
 )
 
@@ -35,29 +34,24 @@ type RelayEntry struct {
 	At   time.Time       `json:"at"`
 }
 
-var relayTableOnce sync.Map // *sqlDatabase → error
-
-func (ls *LocalStorage) relayTable(ctx context.Context) error {
-	if v, ok := relayTableOnce.Load(ls.db); ok {
-		if v == nil {
-			return nil
-		}
-		return v.(error)
-	}
-	_, err := ls.db.ExecContext(ctx, `CREATE TABLE IF NOT EXISTS execution_relay (
+var executionRelaySchemaTable = guardedSchemaTable{
+	name: "execution_relay",
+	ddl: `CREATE TABLE IF NOT EXISTS execution_relay (
 		execution_id TEXT NOT NULL,
 		seq BIGINT NOT NULL,
 		kind TEXT NOT NULL,
 		data TEXT,
 		recorded_at TIMESTAMP NOT NULL,
-		PRIMARY KEY (execution_id, seq))`)
-	if err != nil {
-		err = fmt.Errorf("create execution_relay: %w", err)
-		relayTableOnce.Store(ls.db, err)
-		return err
-	}
-	relayTableOnce.Store(ls.db, nil)
-	return nil
+		PRIMARY KEY (execution_id, seq))`,
+	existsQuery: `SELECT 1 FROM execution_relay LIMIT 0`,
+}
+
+// relayTable ensures execution_relay exists. THESE TABLES ARE CREATED WITH THE
+// SCHEMA, NOT ON FIRST USE; this guard catches stores built without
+// autoMigrateSchema, serializes creation per db, and caches only success —
+// A FAILED CREATE IS NEVER CACHED.
+func (ls *LocalStorage) relayTable(ctx context.Context) error {
+	return ls.ensureSchemaTable(ctx, executionRelaySchemaTable)
 }
 
 // RelayPut holds entries for executionID. A seq already held is ignored. It
@@ -183,18 +177,21 @@ func (ls *LocalStorage) RelayExecutions(ctx context.Context) ([]string, error) {
 // carries the header again cannot move a run to another subscriber. This is
 // control data, like the execution tree itself, so it is durable.
 
-func (ls *LocalStorage) runOwnerTable(ctx context.Context) error {
-	if err := ls.relayTable(ctx); err != nil {
-		return err
-	}
-	_, err := ls.db.ExecContext(ctx, `CREATE TABLE IF NOT EXISTS run_owners (
+var runOwnersSchemaTable = guardedSchemaTable{
+	name: "run_owners",
+	ddl: `CREATE TABLE IF NOT EXISTS run_owners (
 		run_id TEXT PRIMARY KEY,
 		owner_node_id TEXT NOT NULL,
-		created_at TIMESTAMP NOT NULL)`)
-	if err != nil {
-		return fmt.Errorf("create run_owners: %w", err)
-	}
-	return nil
+		created_at TIMESTAMP NOT NULL)`,
+	existsQuery: `SELECT 1 FROM run_owners LIMIT 0`,
+}
+
+// runOwnerTable ensures run_owners exists without issuing DDL on steady-state
+// lookups (such as lookupRunWatched on ordinary executions). THESE TABLES ARE
+// CREATED WITH THE SCHEMA, NOT ON FIRST USE, and A FAILED CREATE IS NEVER
+// CACHED.
+func (ls *LocalStorage) runOwnerTable(ctx context.Context) error {
+	return ls.ensureSchemaTable(ctx, runOwnersSchemaTable)
 }
 
 // SetRunOwner records owner for runID unless the run already has one.
```

**File**: `control-plane/internal/storage/relay_storage_test.go` (modified, +5/-5)
```diff
@@ -299,10 +299,10 @@ func TestRelayStorage_S7_RunsOwnedByScopingAndSinceFilter(t *testing.T) {
 }
 
 // Contract S9: Both execution_relay and run_owners are created lazily on first
-// use of a fresh store without needing a schema migration, and propagate database
+// use of a store constructed without autoMigrateSchema, and propagate database
 // errors when the context or store is closed.
 func TestRelayStorage_S9_LazyTableCreationWithoutMigration(t *testing.T) {
-	ls, ctx := setupLocalStorage(t)
+	ls, ctx := newUnmigratedLocalStorage(t)
 
 	tableExists := func(s *LocalStorage, name string) bool {
 		var count int
@@ -311,7 +311,7 @@ func TestRelayStorage_S9_LazyTableCreationWithoutMigration(t *testing.T) {
 		return count == 1
 	}
 
-	// Neither table exists right after Initialize and migrations finish.
+	// Neither table exists on a store that skipped schema migration.
 	require.False(t, tableExists(ls, "execution_relay"))
 	require.False(t, tableExists(ls, "run_owners"))
 
@@ -348,8 +348,8 @@ func TestRelayStorage_S9_LazyTableCreationWithoutMigration(t *testing.T) {
 	_, err = ls.RunsOwnedBy(cancelledCtx, "owner-c", time.Now())
 	require.Error(t, err)
 
-	// A closed fresh store surfaces and remembers the lazy DDL error on its db handle.
-	closedLS, closedCtx := setupLocalStorage(t)
+	// A closed unmigrated store surfaces the lazy DDL error on its db handle.
+	closedLS, closedCtx := newUnmigratedLocalStorage(t)
 	require.NoError(t, closedLS.Close(closedCtx))
 	_, err = closedLS.RelayPut(closedCtx, "exec-closed", []RelayEntry{{Seq: 1, Kind: "k"}})
 	require.Error(t, err)
```

**File**: `control-plane/internal/storage/relay_table_race_test.go` (added, +781/-0)
```diff
@@ -0,0 +1,781 @@
+package storage
+
+import (
+	"context"
+	"database/sql"
+	"database/sql/driver"
+	"encoding/json"
+	"errors"
+	"fmt"
+	"path/filepath"
+	"strings"
+	"sync"
+	"testing"
+
+	"github.com/Agent-Field/agentfield/control-plane/pkg/types"
+	"github.com/jackc/pgx/v5/pgconn"
+	sqlite3 "github.com/mattn/go-sqlite3"
+	"github.com/stretchr/testify/require"
+)
+
+// newUnmigratedLocalStorage constructs a SQLite-backed LocalStorage that skips
+// Initialize and autoMigrateSchema so tests can exercise the lazy-creation guard.
+func newUnmigratedLocalStorage(t *testing.T) (*LocalStorage, context.Context) {
+	t.Helper()
+	ctx := context.Background()
+	dsn := fmt.Sprintf("%s?_journal_mode=WAL&_synchronous=NORMAL&_busy_timeout=60000&_txlock=immediate",
+		filepath.Join(t.TempDir(), "unmigrated.db"))
+	rawDB, err := sql.Open("sqlite3", dsn)
+	require.NoError(t, err)
+	t.Cleanup(func() { _ = rawDB.Close() })
+	return &LocalStorage{
+		db:   newSQLDatabase(rawDB, "local"),
+		mode: "local",
+	}, ctx
+}
+
+type sqlHookFunc func(inner driver.Conn, query string) error
+
+type interceptingDriver struct{}
+
+func (interceptingDriver) Open(string) (driver.Conn, error) {
+	return nil, errors.New("use sql.OpenDB with interceptingConnector")
+}
+
+type interceptingConnector struct {
+	dsn     string
+	mu      sync.Mutex
+	hook    sqlHookFunc
+	queries []string
+}
+
+func newInterceptingSQLiteDB(t *testing.T, mode string) (*sql.DB, *interceptingConnector, *LocalStorage) {
+	t.Helper()
+	dsn := fmt.Sprintf("%s?_journal_mode=WAL&_synchronous=NORMAL&_busy_timeout=60000&_txlock=immediate",
+		filepath.Join(t.TempDir(), "intercepted.db"))
+	conn := &interceptingConnector{dsn: dsn}
+	rawDB := sql.OpenDB(conn)
+	rawDB.SetMaxOpenConns(1)
+	t.Cleanup(func() { _ = rawDB.Close() })
+	ls := &LocalStorage{
+		db:   newSQLDatabase(rawDB, mode),
+		mode: mode,
+	}
+	return rawDB, conn, ls
+}
+
+func (c *interceptingConnector) Driver() driver.Driver {
+	return interceptingDriver{}
+}
+
+func (c *interceptingConnector) Connect(context.Context) (driver.Conn, error) {
+	rawConn, err := (&sqlite3.SQLiteDriver{}).Open(c.dsn)
+	if err != nil {
+		return nil, err
+	}
+	return &interceptingConn{inner: rawConn, parent: c}, nil
+}
+
+func (c *interceptingConnector) setHook(hook sqlHookFunc) {
+	c.mu.Lock()
+	c.hook = hook
+	c.mu.Unlock()
+}
+
+func (c *interceptingConnector) resetQueries() {
+	c.mu.Lock()
+	c.queries = nil
+	c.mu.Unlock()
+}
+
+func (c *interceptingConnector) recordedQueries() []string {
+	c.mu.Lock()
+	defer c.mu.Unlock()
+	out := make([]string, len(c.queries))
+	copy(out, c.queries)
+	return out
+}
+
+func (c *interceptingConnector) intercept(inner driver.Conn, query string) error {
+	c.mu.Lock()
+	c.queries = append(c.queries, query)
+	hook := c.hook
+	c.mu.Unlock()
+	if hook != nil {
+		return hook(inner, query)
+	}
+	return nil
+}
+
+type interceptingConn struct {
+	inner  driver.Conn
+	parent *interceptingConnector
+}
+
+func (c *interceptingConn) Prepare(query string) (driver.Stmt, error) {
+	if err := c.parent.intercept(c.inner, query); err != nil {
+		return nil, err
+	}
+	return c.inner.Prepare(query)
+}
+
+func (c *interceptingConn) PrepareContext(ctx context.Context, query string) (driver.Stmt, error) {
+	if err := ctx.Err(); err != nil {
+		return nil, err
+	}
+	if err := c.parent.intercept(c.inner, query); err != nil {
+		return nil, err
+	}
+	if pc, ok := c.inner.(driver.ConnPrepareContext); ok {
+		return pc.PrepareContext(ctx, query)
+	}
+	return c.inner.Prepare(query)
+}
+
+func (c *interceptingConn) Close() error {
+	return c.inner.Close()
+}
+
+func (c *interceptingConn) Begin() (driver.Tx, error) {
+	return c.inner.Begin()
+}
+
+func (c *interceptingConn) BeginTx(ctx context.Context, opts driver.TxOptions) (driver.Tx, error) {
+	if bt, ok := c.inner.(driver.ConnBeginTx); ok {
+		return bt.BeginTx(ctx, opts)
+	}
+	return c.inner.Begin()
+}
+
+func (c *interceptingConn) CheckNamedValue(nv *driver.NamedValue) error {
+	if nvc, ok := c.inner.(driver.NamedValueChecker); ok {
+		return nvc.CheckNamedValue(nv)
+	}
+	return driver.ErrSkip
+}
+
+func countCreateTableQueries(queries []string) int {
+	n := 0
+	for _, q := range queries {
+		if strings.Contains(strings.ToUpper(q), "CREATE TABLE") {
+			n++
+		}
+	}
+	return n
+}
+
+// Contract R1: A fresh store built the normal way (with autoMigrateSchema) has
+// execution_relay, run_owners, and execution_approval_questions before any
+// relay, owner, or approval call.
+func TestRelayTable_R1_StartupMigrationCreatesAllThreeTables(t *testing.T) {
+	ls, ctx := setupLocalStorage(t)
+
+	for _, table := range []string{
+		"execution_relay",
+		"run_owners",
+		"execution_approval_questions",
+	} {
+		var count int
+		err := ls.db.QueryRowContext(ctx,
+			`SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?`, table,
+		).Scan(&count)
+		require.NoError(t, err)
+		require.Equal(t, 1, count, "table %s must exist right after startup schema migration", table)

```

**File**: `control-plane/internal/storage/sql_helpers.go` (modified, +4/-1)
```diff
@@ -4,13 +4,16 @@ import (
 	"context"
 	"database/sql"
 	"fmt"
+	"sync"
 
 	"github.com/jmoiron/sqlx"
 )
 
 type sqlDatabase struct {
 	*sql.DB
-	mode string
+	mode          string
+	tableCreateMu sync.Mutex
+	tablesCreated sync.Map // table name (string) -> struct{}{}
 }
 
 func newSQLDatabase(db *sql.DB, mode string) *sqlDatabase {
```

---

### Incident Patch 2: `bcef6b54` (2026-11-10)
**Commit Message**: fix(sdk): return an error to the model for malformed tool-call arguments (#1168)

* fix(sdk): return an error to the model for malformed tool-call arguments

When an LLM tool call carried invalid or truncated JSON arguments, both the
Python and Go SDKs silently replaced them with {} and still executed the
tool, so the tool ran with missing/default inputs and the model never learned
its call was broken. Report the parse error back as a tool message (like the
existing missing-"arguments" case) and skip execution. An empty arguments
string is still accepted as "no arguments", since some providers send that for
parameterless tools.

* style(sdk): format malformed-arguments assertion

Signed-off-by: Alex Castillo <[REDACTED_EMAIL]>

* test(sdk): update error-path tests for invalid tool-call arguments

Invalid arguments no longer create a tool-call record, so assert on the
tool error message fed back to the model instead of trace.calls.

---------

Signed-off-by: Alex Castillo <[REDACTED_EMAIL]>

**File**: `sdk/go/ai/tool_calling.go` (modified, +21/-1)
```diff
@@ -271,8 +271,28 @@ func (c *Client) ExecuteToolCallLoopResult(
 			trace.TotalToolCalls = totalCalls
 
 			var args map[string]interface{}
-			if err := json.Unmarshal([]byte(tc.Function.Arguments), &args); err != nil {
+			if strings.TrimSpace(tc.Function.Arguments) == "" {
+				// Some providers send "" for tools that take no arguments.
 				args = map[string]interface{}{}
+			} else if err := json.Unmarshal([]byte(tc.Function.Arguments), &args); err != nil || args == nil {
+				// Malformed or truncated arguments: do not run the tool with
+				// empty args; report the error so the model can retry.
+				if err == nil {
+					err = fmt.Errorf("arguments must be a JSON object")
+				}
+				invalidMsg := Message{
+					Role: "tool",
+					Content: []ContentPart{{Type: "text", Text: encodeToolContent(map[string]string{
+						"error": fmt.Sprintf("Tool call to '%s' has invalid or truncated JSON arguments (%v). Please retry with valid JSON arguments.", tc.Function.Name, err),
+					})}},
+					ToolCallID: tc.ID,
+				}
+				loopMessages = append(loopMessages, invalidMsg)
+				trace.Messages = append(trace.Messages, TracedMessage{
+					Message: invalidMsg,
+					Source:  TraceSourceToolError,
+				})
+				continue
 			}
 			toolName := unsanitizeToolName(tc.Function.Name)
 
```

**File**: `sdk/go/ai/tool_calling_loop_test.go` (modified, +60/-4)
```diff
@@ -96,7 +96,7 @@ func TestExecuteToolCallLoop_CompletesAfterToolResponse(t *testing.T) {
 	assert.Equal(t, map[string]interface{}{"status": "open"}, trace.Calls[0].Result)
 }
 
-func TestExecuteToolCallLoop_RecordsToolErrorsAndMalformedArguments(t *testing.T) {
+func TestExecuteToolCallLoop_RecordsToolErrors(t *testing.T) {
 	var requestCount atomic.Int32
 	client := newToolLoopClient(t, func(w http.ResponseWriter, r *http.Request) {
 		count := requestCount.Add(1)
@@ -106,9 +106,9 @@ func TestExecuteToolCallLoop_RecordsToolErrorsAndMalformedArguments(t *testing.T
 					Message: Message{
 						Role: "assistant",
 						ToolCalls: []ToolCall{{
-							ID:   "call-2",
-							Type: "function",
-							Function: ToolCallFunction{Name: "lookup", Arguments: `{bad json`},
+							ID:       "call-2",
+							Type:     "function",
+							Function: ToolCallFunction{Name: "lookup", Arguments: ``},
 						}},
 					},
 					FinishReason: "tool_calls",
@@ -152,6 +152,62 @@ func TestExecuteToolCallLoop_RecordsToolErrorsAndMalformedArguments(t *testing.T
 	assert.Empty(t, trace.Calls[0].Arguments)
 }
 
+func TestExecuteToolCallLoop_MalformedArgumentsAreNotExecuted(t *testing.T) {
+	var requestCount atomic.Int32
+	client := newToolLoopClient(t, func(w http.ResponseWriter, r *http.Request) {
+		count := requestCount.Add(1)
+		if count == 1 {
+			require.NoError(t, json.NewEncoder(w).Encode(Response{
+				Choices: []Choice{{
+					Message: Message{
+						Role: "assistant",
+						ToolCalls: []ToolCall{{
+							ID:       "call-3",
+							Type:     "function",
+							Function: ToolCallFunction{Name: "lookup", Arguments: `{"query": "trunca`},
+						}},
+					},
+					FinishReason: "tool_calls",
+				}},
+			}))
+			return
+		}
+
+		var req Request
+		require.NoError(t, json.NewDecoder(r.Body).Decode(&req))
+		require.Len(t, req.Messages, 3)
+		assert.Equal(t, "tool", req.Messages[2].Role)
+		assert.Equal(t, "call-3", req.Messages[2].ToolCallID)
+		assert.Contains(t, req.Messages[2].Content[0].Text, "invalid or truncated JSON arguments")
+		require.NoError(t, json.NewEncoder(w).Encode(Response{
+			Choices: []Choice{{
+				Message: Message{
+					Role:    "assistant",
+					Content: []ContentPart{{Type: "text", Text: "retry later"}},
+				},
+				FinishReason: "stop",
+			}},
+		}))
+	})
+
+	called := false
+	resp, trace, err := client.ExecuteToolCallLoop(
+		context.Background(),
+		[]Message{{Role: "user", Content: []ContentPart{{Type: "text", Text: "Lookup"}}}},
+		[]ToolDefinition{{Type: "function", Function: ToolFunction{Name: "lookup", Parameters: map[string]interface{}{"type": "object"}}}},
+		ToolCallConfig{MaxTurns: 3, MaxToolCalls: 2},
+		func(_ context.Context, _ string, _ map[string]interface{}) (map[string]interface{}, error) {
+			called = true
+			return map[string]interface{}{}, nil
+		},
+	)
+
+	require.NoError(t, err)
+	assert.Equal(t, "retry later", resp.Text())
+	assert.False(t, called, "tool must not run with malformed arguments")
+	assert.Empty(t, trace.Calls)
+}
+
 func TestSimpleAndStructuredAIAndResponseHelpers(t *testing.T) {
 	var requestCount atomic.Int32
 	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
```

**File**: `sdk/python/agentfield/tool_calling.py` (modified, +24/-3)
```diff
@@ -546,9 +546,30 @@ async def execute_tool_call_loop(
                 )
                 continue
             try:
-                func_args = json.loads(raw_args)
-            except (json.JSONDecodeError, TypeError):
-                func_args = {}
+                # Some providers send "" for tools that take no arguments.
+                func_args = json.loads(raw_args) if raw_args.strip() else {}
+                if not isinstance(func_args, dict):
+                    raise TypeError("tool arguments must be a JSON object")
+            except (json.JSONDecodeError, TypeError, AttributeError) as e:
+                # Malformed or truncated arguments: do not run the tool with
+                # empty args; report the error so the model can retry.
+                log_warn(f"Invalid JSON arguments for tool call '{func_name}': {e}")
+                invalid_args_message = {
+                    "role": "tool",
+                    "tool_call_id": tc.id,
+                    "content": json.dumps(
+                        {
+                            "error": f"Tool call to '{func_name}' has invalid or truncated JSON arguments ({e}). Please retry with valid JSON arguments."
+                        }
+                    ),
+                }
+                messages.append(invalid_args_message)
+                trace.messages.append(
+                    TracedMessage(
+                        message=invalid_args_message, source=TRACE_SOURCE_TOOL_ERROR
+                    )
+                )
+                continue
 
             record = ToolCallRecord(
                 tool_name=func_name,
```

**File**: `sdk/python/tests/test_tool_calling.py` (modified, +69/-0)
```diff
@@ -456,6 +456,75 @@ async def mock_completion(params):
             == "Tool call to 'sentiment_agent.analyze' is missing the 'arguments' field. Please retry with valid JSON arguments."
         )
 
+    @pytest.mark.asyncio
+    @pytest.mark.parametrize("bad_args", ['{"text": "trunca', "not json", "[1, 2]"])
+    async def test_malformed_arguments_are_not_executed(self, bad_args):
+        agent = make_mock_agent()
+        agent.call = AsyncMock(return_value={"result": "ok"})
+
+        messages = [{"role": "user", "content": "test"}]
+        tools = capabilities_to_tool_schemas([make_reasoner()])
+        config = ToolCallConfig(max_turns=5)
+
+        tool_resp = make_llm_response(tool_calls=[make_tool_call(arguments=bad_args)])
+        final_resp = make_llm_response(content="Please retry")
+        call_count = 0
+
+        async def mock_completion(params):
+            nonlocal call_count
+            call_count += 1
+            return tool_resp if call_count == 1 else final_resp
+
+        resp, trace = await execute_tool_call_loop(
+            agent=agent,
+            messages=messages,
+            tools=tools,
+            config=config,
+            needs_lazy_hydration=False,
+            litellm_params={"model": "openai/gpt-4"},
+            make_completion=mock_completion,
+        )
+
+        agent.call.assert_not_called()
+        assert trace.calls == []
+        tool_messages = [m for m in messages if m.get("role") == "tool"]
+        assert len(tool_messages) == 1
+        assert (
+            "invalid or truncated JSON arguments"
+            in json.loads(tool_messages[0]["content"])["error"]
+        )
+
+    @pytest.mark.asyncio
+    async def test_empty_string_arguments_run_with_no_args(self):
+        agent = make_mock_agent()
+        agent.call = AsyncMock(return_value={"result": "ok"})
+
+        messages = [{"role": "user", "content": "test"}]
+        tools = capabilities_to_tool_schemas([make_reasoner()])
+        config = ToolCallConfig(max_turns=5)
+
+        tool_resp = make_llm_response(tool_calls=[make_tool_call(arguments="")])
+        final_resp = make_llm_response(content="Done")
+        call_count = 0
+
+        async def mock_completion(params):
+            nonlocal call_count
+            call_count += 1
+            return tool_resp if call_count == 1 else final_resp
+
+        await execute_tool_call_loop(
+            agent=agent,
+            messages=messages,
+            tools=tools,
+            config=config,
+            needs_lazy_hydration=False,
+            litellm_params={"model": "openai/gpt-4"},
+            make_completion=mock_completion,
+        )
+
+        agent.call.assert_awaited_once()
+        assert agent.call.await_args.kwargs == {}
+
     @pytest.mark.asyncio
     async def test_max_tool_calls_limit(self):
         agent = make_mock_agent()
```

**File**: `sdk/python/tests/test_tool_calling_error_paths.py` (modified, +6/-4)
```diff
@@ -129,12 +129,13 @@ async def test_invalid_argument_type_is_reported_and_loop_continues():
     )
 
     assert trace.total_tool_calls == 1
-    assert trace.calls[0].error is not None
-    assert "mapping" in trace.calls[0].error
+    # Invalid arguments are reported to the model without creating a call record.
+    assert trace.calls == []
     assert agent.call.await_count == 0
     tool_messages = [m for m in messages if m.get("role") == "tool"]
     assert len(tool_messages) == 1
-    assert "error" in json.loads(tool_messages[0]["content"])
+    error = json.loads(tool_messages[0]["content"])["error"]
+    assert "JSON object" in error
 
 
 @pytest.mark.asyncio
@@ -164,11 +165,12 @@ async def test_mixed_valid_and_invalid_tool_calls_in_single_turn():
     )
 
     assert trace.total_tool_calls == 2
+    assert len(trace.calls) == 1
     assert trace.calls[0].result == {"echoed": "hi"}
-    assert trace.calls[1].error is not None
     agent.call.assert_awaited_once_with("utility.echo", text="hi")
     tool_messages = [m for m in messages if m.get("role") == "tool"]
     assert len(tool_messages) == 2
+    assert "invalid" in json.loads(tool_messages[1]["content"])["error"]
 
 
 @pytest.mark.asyncio
```

---

### Incident Patch 3: `8a2f0ef1` (2026-11-11)
**Commit Message**: Merge pull request #1179 from Agent-Field/fix/offline-node-keeps-executions-main

control-plane: an offline node keeps its executions until it comes back

**File**: `control-plane/config/agentfield.yaml` (modified, +4/-0)
```diff
@@ -13,6 +13,10 @@ agentfield:
     batch_size: 200
     preserve_recent_duration: 1h
     stale_execution_timeout: 10m
+    # A node registered with metadata.custom.holds_executions_offline: true has
+    # its quiet executions held (not timed out) while it is offline, until it
+    # comes back or this ceiling passes.
+    offline_hold_ceiling: 168h
     # max_retries only rewinds stale workflow rows to pending; no dispatcher
     # re-enqueues them, so do not rely on it for execution retries.
     max_retries: 0
```

**File**: `control-plane/internal/config/config.go` (modified, +13/-0)
```diff
@@ -291,8 +291,17 @@ type ExecutionCleanupConfig struct {
 	MaxRetries             int           `yaml:"max_retries" mapstructure:"max_retries" default:"0"`
 	RetryBackoff           time.Duration `yaml:"retry_backoff" mapstructure:"retry_backoff" default:"30s"`
 	PayloadOrphanGrace     time.Duration `yaml:"payload_orphan_grace" mapstructure:"payload_orphan_grace"`
+	// OfflineHoldCeiling is how long an execution may be held for an opted-in
+	// node that is offline (metadata.custom.holds_executions_offline) before
+	// it is failed anyway, so nothing waits forever on a node that never
+	// returns. Zero or less is the default, DefaultOfflineHoldCeiling.
+	OfflineHoldCeiling time.Duration `yaml:"offline_hold_ceiling" mapstructure:"offline_hold_ceiling" default:"168h"`
 }
 
+// DefaultOfflineHoldCeiling is a week: a laptop asleep over a long weekend
+// still finds its work waiting.
+const DefaultOfflineHoldCeiling = 7 * 24 * time.Hour
+
 // UnmarshalYAML records whether enabled was explicitly configured, including
 // the otherwise indistinguishable enabled: false value.
 func (c *ExecutionCleanupConfig) UnmarshalYAML(node *yaml.Node) error {
@@ -678,6 +687,9 @@ func ApplyDefaults(cfg *Config) {
 	if cleanup.PayloadOrphanGrace <= 0 {
 		cleanup.PayloadOrphanGrace = time.Hour
 	}
+	if cleanup.OfflineHoldCeiling <= 0 {
+		cleanup.OfflineHoldCeiling = DefaultOfflineHoldCeiling
+	}
 	if !cfg.AgentField.ExecutionQueue.agentCallTimeoutSet && cfg.AgentField.ExecutionQueue.AgentCallTimeout == 0 {
 		cfg.AgentField.ExecutionQueue.AgentCallTimeout = DefaultAgentCallTimeout
 	}
@@ -942,6 +954,7 @@ func ApplyEnvOverrides(cfg *Config) {
 	applyIntEnv("AGENTFIELD_EXECUTION_CLEANUP_BATCH_SIZE", &cfg.AgentField.ExecutionCleanup.BatchSize)
 	applyDurationEnv("AGENTFIELD_EXECUTION_PRESERVE_RECENT", &cfg.AgentField.ExecutionCleanup.PreserveRecentDuration)
 	applyDurationEnv("AGENTFIELD_PAYLOAD_ORPHAN_GRACE", &cfg.AgentField.ExecutionCleanup.PayloadOrphanGrace)
+	applyDurationEnv("AGENTFIELD_EXECUTION_OFFLINE_HOLD_CEILING", &cfg.AgentField.ExecutionCleanup.OfflineHoldCeiling)
 	applyDurationEnv("AGENTFIELD_AGENT_CALL_TIMEOUT", &cfg.AgentField.ExecutionQueue.AgentCallTimeout)
 	if val := os.Getenv("AGENTFIELD_EXECUTION_MAX_RETRIES"); val != "" {
 		if i, err := strconv.Atoi(val); err == nil {
```

**File**: `control-plane/internal/config/execution_cleanup_contract_test.go` (modified, +15/-0)
```diff
@@ -104,3 +104,18 @@ func TestExecutionCleanupNonPositiveIntervalIsClamped(t *testing.T) {
 		})
 	}
 }
+
+func TestExecutionCleanupOfflineHoldCeilingDefaultAndEnvOverride(t *testing.T) {
+	cfg := Config{}
+	ApplyDefaults(&cfg)
+	require.Equal(t, DefaultOfflineHoldCeiling, cfg.AgentField.ExecutionCleanup.OfflineHoldCeiling)
+
+	t.Setenv("AGENTFIELD_EXECUTION_OFFLINE_HOLD_CEILING", "48h")
+	ApplyEnvOverrides(&cfg)
+	require.Equal(t, 48*time.Hour, cfg.AgentField.ExecutionCleanup.OfflineHoldCeiling)
+
+	t.Setenv("AGENTFIELD_EXECUTION_OFFLINE_HOLD_CEILING", "not-a-duration")
+	ApplyEnvOverrides(&cfg)
+	require.Equal(t, 48*time.Hour, cfg.AgentField.ExecutionCleanup.OfflineHoldCeiling)
+}
+
```

**File**: `control-plane/internal/handlers/execution_cleanup.go` (modified, +9/-0)
```diff
@@ -31,6 +31,11 @@ type ExecutionCleanupService struct {
 	// first-pass branch of cleanupLoop is reachable without a 30s sleep.
 	initialDelay time.Duration
 
+	// offlineAfter is how long after its last heartbeat an opted-in node is
+	// judged offline and its quiet executions held (offline_hold.go). Zero is
+	// DefaultLeaseTTL: a node that let its lease lapse.
+	offlineAfter time.Duration
+
 	// Metrics
 	totalCleaned    int64
 	lastCleanupTime time.Time
@@ -159,6 +164,10 @@ func (ecs *ExecutionCleanupService) performCleanup(ctx context.Context) {
 	payloadURIListErrors := 0
 	effectiveRetention := storage.EffectiveExecutionRetention(ecs.config.RetentionPeriod, ecs.config.PreserveRecentDuration)
 	if ecs.config.StaleExecutionTimeout > 0 {
+		// Hold the work of opted-in nodes that are offline before anything
+		// below can time it out or rewind it.
+		ecs.holdOfflineNodes(cleanupCtx)
+
 		// Retry eligible workflow executions before marking anything as timed out
 		if ecs.config.MaxRetries > 0 {
 			retriedIDs, err := ecs.storage.RetryStaleWorkflowExecutions(
```

**File**: `control-plane/internal/handlers/nodes_rest.go` (modified, +5/-0)
```diff
@@ -135,12 +135,17 @@ func NodeStatusLeaseHandler(storageProvider storage.StorageProvider, statusManag
 			presenceManager.Touch(nodeID, agent.Version, now)
 		}
 
+		// Settle what was held while the node was away before touching: a
+		// held execution it lists carries on, one it does not was lost.
+		released, lost := ResolveOfflineHolds(ctx, storageProvider, nodeID, payload.Inflight)
 		touched := TouchInflightExecutions(ctx, storageProvider, nodeID, payload.Inflight)
 
 		c.JSON(http.StatusOK, gin.H{
 			"lease_seconds":      int(leaseTTL.Seconds()),
 			"next_lease_renewal": now.Add(leaseTTL).Format(time.RFC3339),
 			"inflight_touched":   touched,
+			"held_released":      released,
+			"held_lost":          lost,
 		})
 	}
 }
```

**File**: `control-plane/internal/handlers/offline_hold.go` (added, +194/-0)
```diff
@@ -0,0 +1,194 @@
+package handlers
+
+import (
+	"context"
+	"fmt"
+	"strings"
+	"time"
+
+	"github.com/Agent-Field/agentfield/control-plane/internal/config"
+	"github.com/Agent-Field/agentfield/control-plane/internal/logger"
+	"github.com/Agent-Field/agentfield/control-plane/internal/storage"
+	"github.com/Agent-Field/agentfield/control-plane/pkg/types"
+)
+
+// ── A NODE THAT GOES AWAY DOES NOT LOSE ITS WORK BY BEING AWAY ───────────────
+//
+// A node that registers with metadata.custom.holds_executions_offline = true
+// (the codeaf factory, on a laptop that sleeps) promises two things: its work
+// survives it being offline, and on its first lease back it lists every
+// execution it still holds as inflight. In exchange the stale sweep does not
+// time those executions out while it is away. Instead each cleanup pass, before
+// the sweeps run, marks the quiet executions of an opted-in, registered,
+// offline node as held (storage/offline_hold.go), and the sweeps skip them.
+//
+// A hold ends in one of four ways, and only the first keeps the execution:
+//   - the node's lease lists it as inflight: released, it carries on;
+//   - the node's lease does not list it: failed, the node came back without it;
+//   - the node is no longer registered: failed, there is nobody to come back;
+//   - the hold outlives offline_hold_ceiling: failed, nothing waits forever.
+//
+// A node that did not opt in is untouched: its executions are reaped by the
+// stale sweep exactly as before.
+
+// offlineHolder is the storage the offline hold needs. LocalStorage serves it
+// for SQLite and Postgres alike; a store without it simply never holds.
+type offlineHolder interface {
+	HoldOfflineNodeExecutions(ctx context.Context, agentNodeID string, staleAfter time.Duration, limit int) (int, error)
+	ListHeldExecutions(ctx context.Context, agentNodeID string) ([]storage.HeldExecution, error)
+	ReleaseHeldExecutions(ctx context.Context, agentNodeID string, ids []string) (int, error)
+	FailHeldExecutions(ctx context.Context, ids []string, reason, message string) (int, error)
+}
+
+// nodeLostExecutionMessage is the error a held execution fails with when its
+// node comes back without it.
+func nodeLostExecutionMessage(nodeID string) string {
+	return fmt.Sprintf("node %s came back without this execution: it was lost while the node was offline", nodeID)
+}
+
+// ResolveOfflineHolds settles every execution held for nodeID against the
+// inflight list of the lease that just arrived: a listed one is released and
+// carries on, an unlisted one is failed as lost. It returns how many of each.
+// A node with nothing held costs one indexed query.
+func ResolveOfflineHolds(ctx context.Context, store any, nodeID string, inflight []string) (released, lost int) {
+	holder, ok := store.(offlineHolder)
+	if !ok {
+		return 0, 0
+	}
+	held, err := holder.ListHeldExecutions(ctx, nodeID)
+	if err != nil {
+		logger.Logger.Warn().Err(err).Str("node_id", nodeID).Msg("lease: could not read held executions")
+		return 0, 0
+	}
+	if len(held) == 0 {
+		return 0, 0
+	}
+	listed := make(map[string]struct{}, len(inflight))
+	for _, id := range inflight {
+		listed[strings.TrimSpace(id)] = struct{}{}
+	}
+	var keep, drop []string
+	for _, h := range held {
+		if _, ok := listed[h.ExecutionID]; ok {
+			keep = append(keep, h.ExecutionID)
+		} else {
+			drop = append(drop, h.ExecutionID)
+		}
+	}
+	if released, err = holder.ReleaseHeldExecutions(ctx, nodeID, keep); err != nil {
+		logger.Logger.Warn().Err(err).Str("node_id", nodeID).Msg("lease: could not release held executions")
+	}
+	if lost, err = holder.FailHeldExecutions(ctx, drop, types.ExecutionReasonNodeLostExecution, nodeLostExecutionMessage(nodeID)); err != nil {
+		logger.Logger.Warn().Err(err).Str("node_id", nodeID).Msg("lease: could not fail lost executions")
+	}
+	if released > 0 || lost > 0 {
+		logger.Logger.Info().Str("node_id", nodeID).Int("released", released).Int("lost", lost).Msg("lease: node back; held executions settled")
+	}
+	return released, lost
+}
+
+// holdOfflineNodes is the cleanup pass's first step when the stale sweep is
+// on: it ends the holds that can no longer be honoured and holds the quiet
+// executions of every opted-in node that is offline now, so the sweeps that
+// follow skip them.
+func (ecs *ExecutionCleanupService) holdOfflineNodes(ctx context.Context) {
+	holder, ok := ecs.storage.(offlineHolder)
+	if !ok {
+		return
+	}
+	agents, err := ecs.storage.ListAgents(ctx, types.AgentFilters{})
+	if err != nil {
+		// Without the node list nothing can be judged; leave every hold as it
+		// is. The sweep that follows still skips held rows.
+		logger.Logger.Warn().Err(err).Msg("offline hold: could not list nodes")
+		return
+	}
+	// One node may be registered under several versions; it is opted in when
+	// any of them is, and its last word is the latest heartbeat of any.
+	type nodeState struct {
+		optedIn  bool
+		lastSeen time.Time
+	}
+	nodes := map[str
```

**File**: `control-plane/internal/handlers/offline_hold_test.go` (added, +415/-0)
```diff
@@ -0,0 +1,415 @@
+package handlers
+
+import (
+	"bytes"
+	"context"
+	"encoding/json"
+	"errors"
+	"net/http"
+	"net/http/httptest"
+	"testing"
+	"time"
+
+	"github.com/Agent-Field/agentfield/control-plane/internal/config"
+	"github.com/Agent-Field/agentfield/control-plane/internal/services"
+	"github.com/Agent-Field/agentfield/control-plane/internal/storage"
+	"github.com/Agent-Field/agentfield/control-plane/pkg/types"
+	"github.com/gin-gonic/gin"
+	"github.com/stretchr/testify/require"
+)
+
+// The stale window these tests run the sweep with. CreateExecutionRecord
+// stamps updated_at itself, so an execution is made quiet by waiting past the
+// window rather than by backdating it (as TestLeaseInflightKeepsExecutionsAlive
+// does).
+const holdStale = 300 * time.Millisecond
+
+func waitPastStale() { time.Sleep(holdStale + 150*time.Millisecond) }
+
+// offlineHoldWorld is a control plane with one node that went to sleep an
+// hour ago while it was running exec_<node>.
+type offlineHoldWorld struct {
+	t     *testing.T
+	ctx   context.Context
+	store storage.StorageProvider
+	sweep *ExecutionCleanupService
+	lease *gin.Engine
+}
+
+func newOfflineHoldWorld(t *testing.T, ceiling time.Duration) *offlineHoldWorld {
+	t.Helper()
+	gin.SetMode(gin.TestMode)
+	store, ctx := setupTestStorage(t)
+	lease := gin.New()
+	lease.PATCH("/nodes/:node_id/status", NodeStatusLeaseHandler(store, nil, nil, nil, time.Minute))
+	lease.PUT("/executions/:execution_id/status", UpdateExecutionStatusHandler(store, services.NopPayloadStore{}, nil, time.Second))
+	sweep := NewExecutionCleanupService(store, config.ExecutionCleanupConfig{
+		Enabled: true, StaleExecutionTimeout: holdStale, BatchSize: 100, OfflineHoldCeiling: ceiling,
+	})
+	return &offlineHoldWorld{t: t, ctx: ctx, store: store, sweep: sweep, lease: lease}
+}
+
+// node registers id, opted in to the hold or not, last heard from an hour
+// ago, holding one running execution (both tables) named exec_<id>.
+func (w *offlineHoldWorld) node(id string, optedIn bool) string {
+	w.t.Helper()
+	agent := &types.AgentNode{ID: id, Version: "1", LifecycleStatus: types.AgentStatusReady}
+	if optedIn {
+		agent.Metadata.Custom = map[string]interface{}{types.AgentMetadataHoldsExecutionsOffline: true}
+	}
+	require.NoError(w.t, w.store.RegisterAgent(w.ctx, agent))
+	require.NoError(w.t, w.store.UpdateAgentHeartbeat(w.ctx, id, "1", time.Now().UTC().Add(-time.Hour)))
+	exec := "exec_" + id
+	now := time.Now().UTC()
+	require.NoError(w.t, w.store.CreateExecutionRecord(w.ctx, &types.Execution{
+		ExecutionID: exec, RunID: "run_" + id, AgentNodeID: id, NodeID: id, ReasonerID: "intake",
+		Status: types.ExecutionStatusRunning, StartedAt: now, CreatedAt: now, UpdatedAt: now,
+	}))
+	require.NoError(w.t, w.store.StoreWorkflowExecution(w.ctx, &types.WorkflowExecution{
+		WorkflowID: "run_" + id, ExecutionID: exec, AgentFieldRequestID: "req_" + id,
+		AgentNodeID: id, ReasonerID: "intake", Status: types.ExecutionStatusRunning,
+		StartedAt: now, CreatedAt: now, UpdatedAt: now, WorkflowTags: []string{},
+		InputData: json.RawMessage("{}"), OutputData: json.RawMessage("{}"),
+	}))
+	return exec
+}
+
+// leaseFrom sends node's lease listing inflight and answers the body.
+func (w *offlineHoldWorld) leaseFrom(node string, inflight ...string) map[string]any {
+	w.t.Helper()
+	if inflight == nil {
+		inflight = []string{}
+	}
+	raw, _ := json.Marshal(map[string]any{"phase": "ready", "version": "1", "inflight": inflight})
+	req := httptest.NewRequest(http.MethodPatch, "/nodes/"+node+"/status", bytes.NewReader(raw))
+	req.Header.Set("Content-Type", "application/json")
+	rec := httptest.NewRecorder()
+	w.lease.ServeHTTP(rec, req)
+	require.Equal(w.t, http.StatusOK, rec.Code, rec.Body.String())
+	var body map[string]any
+	require.NoError(w.t, json.Unmarshal(rec.Body.Bytes(), &body))
+	return body
+}
+
+func (w *offlineHoldWorld) exec(id string) *types.Execution {
+	w.t.Helper()
+	e, err := w.store.GetExecutionRecord(w.ctx, id)
+	require.NoError(w.t, err)
+	return e
+}
+
+func (w *offlineHoldWorld) workflowStatus(id string) string {
+	w.t.Helper()
+	wf, err := w.store.GetWorkflowExecution(w.ctx, id)
+	require.NoError(w.t, err)
+	return wf.Status
+}
+
+func reasonOf(e *types.Execution) string {
+	if e.StatusReason == nil {
+		return ""
+	}
+	return *e.StatusReason
+}
+
+func errorOf(e *types.Execution) string {
+	if e.ErrorMessage == nil {
+		return ""
+	}
+	return *e.ErrorMessage
+}
+
+// A NODE ASLEEP PAST THE STALE TIMEOUT STILL HOLDS ITS WORK. The opted-in
+// laptop's execution stays running through any number of sweeps, on both
+// tables, marked node_offline; the node that did not opt in is timed out by
+// the same sweep exactly as before.
+func TestOfflineNodeKeepsItsExecutionPastTheStaleTimeout(t *testing.T) {
+	w := newOfflineHoldWorld(t, time.Hour)
+	laptop := w.node("laptop", true)
+	server := w.node("server", false)
+	waitPastStale()
+
+	w.sweep.performCleanup(w.ctx)
+	waitPastStale()
+	w.sw
```

**File**: `control-plane/internal/server/config_db.go` (modified, +3/-0)
```diff
@@ -81,6 +81,9 @@ func mergeDBConfig(target, dbCfg *config.Config) {
 	if dbCfg.AgentField.ExecutionCleanup.StaleExecutionTimeout != 0 {
 		target.AgentField.ExecutionCleanup.StaleExecutionTimeout = dbCfg.AgentField.ExecutionCleanup.StaleExecutionTimeout
 	}
+	if dbCfg.AgentField.ExecutionCleanup.OfflineHoldCeiling != 0 {
+		target.AgentField.ExecutionCleanup.OfflineHoldCeiling = dbCfg.AgentField.ExecutionCleanup.OfflineHoldCeiling
+	}
 	// Enabled is a bool — only override if cleanup config is present in DB at all
 	if dbCfg.AgentField.ExecutionCleanup.RetentionPeriod != 0 || dbCfg.AgentField.ExecutionCleanup.CleanupInterval != 0 {
 		target.AgentField.ExecutionCleanup.Enabled = dbCfg.AgentField.ExecutionCleanup.Enabled
```

#### Recent Merged Pull Requests:
- **PR #1179** (2026-11-11): control-plane: an offline node keeps its executions until it comes back (@AbirAbbas)
- **PR #1178** (2026-11-10): control-plane: an offline node keeps its executions until it comes back (@santoshkumarradha)
- **PR #1177** (2026-11-10): fix(storage): create the relay and approval tables with the schema, never cache a failed create (@AbirAbbas)
- **PR #1176** (2026-11-09): ci: move macOS jobs from macos-14 to macos-15 (@AbirAbbas)
- **PR #1174** (2026-11-09): WorkAF harness watch: node link, relay pipe and steer, streamed only for owned runs (@AbirAbbas)
- **PR #1172** (closed): perf(control-plane): fast Runs list and run page under live traffic (@santoshkumarradha)

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

## X. storage): create the relay and approval tables with the schema, never cache a fa

**RULE**:
When implementing operations in `control-plane/internal/storage/approval_question.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Agent-Field/agentfield. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `186f695c`: storage): create the relay and approval tables with the schema, never cache a failed create (#1177). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `control-plane/internal/storage/approval_question.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
// row per round. It lives in its own table, created with the schema alongside
// the relay's, so the workflow_executions column lists and their migrations
// stay as they were.
var approvalQuestionsSchemaTable = guardedSchemaTable{
	name: "execution_approval_questions",
	ddl: `CREATE TABLE IF NOT EXISTS execution_approval_questions (
		PRIMARY KEY (execution_id, approval_request_id))`,
	existsQuery: `SELECT 1 FROM execution_approval_questions LIMIT 0`,
}

// approvalQuestionTable ensures execution_approval_questions exists. THESE
// TABLES ARE CREATED WITH THE SCHEMA, NOT ON FIRST USE; this guard catches
// stores built without autoMigrateSchema, serializes creation per db, and
// caches only success — A FAILED CREATE IS NEVER CACHED.
func (ls *LocalStorage) approvalQuestionTable(ctx context.Context) error {
	return ls.ensureSchemaTable(ctx, approvalQuestionsSchemaTable)
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
	"sync"
// row per round. It lives in its own table, created lazily like the relay's,
// so the workflow_executions column lists and their migrations stay as they
// were.
var approvalQuestionTableOnce sync.Map // *sqlDatabase → error

func (ls *LocalStorage) approvalQuestionTable(ctx context.Context) error {
	if v, ok := approvalQuestionTableOnce.Load(ls.db); ok {
		if v == nil {
			return nil
		}
		return v.(error)
	}
	_, err := ls.db.ExecContext(ctx, `CREATE TABLE IF NOT EXISTS execution_approval_questions (
		PRIMARY KEY (execution_id, approval_request_id))`)
	if err != nil {
		err = fmt.Errorf("create execution_approval_questions: %w", err)
		approvalQuestionTableOnce.Store(ls.db, err)
		return err
	}
	approvalQuestionTableOnce.Store(ls.db, nil)
	return nil
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `186f695c` are properly handled with clean fallback behavior.
