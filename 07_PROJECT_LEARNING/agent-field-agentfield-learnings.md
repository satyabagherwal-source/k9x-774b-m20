> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/agent-field-agentfield-learnings.md`  
> **Source**: github ([https://github.com/Agent-Field/agentfield](https://github.com/Agent-Field/agentfield))  
> **Source Version**: `7d4fd1fa`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-27T14:36:38.780Z  
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
> **Harvest Timestamp**: 2026-10-27T14:36:38.773Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Agent-Field/agentfield`
- **Description**: Build, run and scale AI agents like API and microservices
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2624 stars

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

### Incident Patch 1: `7306a0eb` (2026-10-27)
**Commit Message**: fix(control-plane): return 503 for transient storage errors during DID resolution (#1087) (#1124)

ResolveDID collapsed any GetDIDDocument error into a notFound resolution
result with a nil error, so a genuine missing DID and a transient DB
failure were indistinguishable. Both flowed through VerifyDIDOwnership
and the DID auth middleware as a 401. Since #1081 the Go SDK treats 401
as non-retryable, so a momentary storage blip now drops the status
callback instead of being retried away.

- storage: add ErrDIDDocumentNotFound sentinel and wrap sql.ErrNoRows
  with it in GetDIDDocument (message is unchanged, so no string-match
  breakage).
- services: ResolveDID maps to notFound only for ErrDIDDocumentNotFound;
  any other storage error propagates wrapped in a new retryable
  ErrDIDResolutionUnavailable sentinel. IsDIDRevoked uses errors.Is
  against the same sentinel instead of brittle string matching.
- middleware: return 503 (did_resolution_unavailable) when verification
  fails with ErrDIDResolutionUnavailable, otherwise keep the existing
  401.

Genuine not-found, revoked, invalid-document and signature-verification
failures still return 401; only transient storage errors become 

**File**: `control-plane/internal/server/middleware/did_auth.go` (modified, +10/-0)
```diff
@@ -6,6 +6,7 @@ import (
 	"crypto/sha256"
 	"encoding/base64"
 	"encoding/hex"
+	"errors"
 	"fmt"
 	"io"
 	"net/http"
@@ -15,6 +16,7 @@ import (
 	"time"
 
 	"github.com/Agent-Field/agentfield/control-plane/internal/logger"
+	"github.com/Agent-Field/agentfield/control-plane/internal/services"
 	"github.com/gin-gonic/gin"
 )
 
@@ -281,6 +283,14 @@ func DIDAuthMiddleware(didService DIDWebServiceInterface, config DIDAuthConfig)
 		)
 
 		if err != nil {
+			if errors.Is(err, services.ErrDIDResolutionUnavailable) {
+				logger.Logger.Warn().Err(err).Str("caller_did", callerDID).Msg("DID resolution temporarily unavailable")
+				c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{
+					"error":   "did_resolution_unavailable",
+					"message": "DID resolution is temporarily unavailable, retry shortly",
+				})
+				return
+			}
 			logger.Logger.Warn().Err(err).Str("caller_did", callerDID).Msg("DID signature verification error")
 			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
 				"error":   "verification_error",
```

**File**: `control-plane/internal/server/middleware/did_auth_test.go` (modified, +24/-0)
```diff
@@ -13,6 +13,7 @@ import (
 	"testing"
 	"time"
 
+	"github.com/Agent-Field/agentfield/control-plane/internal/services"
 	"github.com/gin-gonic/gin"
 	"github.com/stretchr/testify/assert"
 )
@@ -202,6 +203,29 @@ func TestDIDAuth_VerificationError(t *testing.T) {
 	assert.Contains(t, w.Body.String(), "verification_error")
 }
 
+func TestDIDAuth_TransientResolutionError(t *testing.T) {
+	resetReplayCache()
+	svc := &mockDIDService{
+		verifyFunc: func(_ context.Context, _ string, _ []byte, _ []byte) (bool, error) {
+			// A transient storage failure during resolution surfaces as the
+			// retryable sentinel rather than a plain verification failure.
+			return false, fmt.Errorf("failed to resolve DID: %w", services.ErrDIDResolutionUnavailable)
+		},
+	}
+	router := newDIDAuthRouter(svc, DIDAuthConfig{Enabled: true})
+
+	req := httptest.NewRequest(http.MethodPost, "/execute/agent.func", strings.NewReader("{}"))
+	req.Header.Set("X-Caller-DID", "did:web:example.com:agents:test")
+	req.Header.Set("X-DID-Signature", uniqueSig())
+	req.Header.Set("X-DID-Timestamp", fmt.Sprintf("%d", time.Now().Unix()))
+	w := httptest.NewRecorder()
+	router.ServeHTTP(w, req)
+
+	// Transient storage errors must be retryable, not reported as auth failure.
+	assert.Equal(t, http.StatusServiceUnavailable, w.Code)
+	assert.Contains(t, w.Body.String(), "did_resolution_unavailable")
+}
+
 func TestDIDAuth_InvalidSignature(t *testing.T) {
 	resetReplayCache()
 	svc := &mockDIDService{
```

**File**: `control-plane/internal/services/did_web_service.go` (modified, +22/-9)
```diff
@@ -5,14 +5,22 @@ import (
 	"crypto/ed25519"
 	"encoding/base64"
 	"encoding/json"
+	"errors"
 	"fmt"
 	"strings"
 	"time"
 
 	"github.com/Agent-Field/agentfield/control-plane/internal/logger"
+	"github.com/Agent-Field/agentfield/control-plane/internal/storage"
 	"github.com/Agent-Field/agentfield/control-plane/pkg/types"
 )
 
+// ErrDIDResolutionUnavailable indicates a DID could not be resolved because of
+// a transient storage failure rather than a genuine missing or revoked record.
+// Callers (e.g. the DID auth middleware) should treat it as retryable and
+// return a 503 instead of a 401.
+var ErrDIDResolutionUnavailable = errors.New("DID resolution temporarily unavailable")
+
 // DIDWebService handles did:web generation, storage, and resolution.
 type DIDWebService struct {
 	domain     string
@@ -129,11 +137,17 @@ func (s *DIDWebService) ResolveDID(ctx context.Context, did string) (*types.DIDR
 	// Get the DID document record
 	record, err := s.storage.GetDIDDocument(ctx, did)
 	if err != nil {
-		return &types.DIDResolutionResult{
-			DIDResolutionMetadata: types.DIDResolutionMetadata{
-				Error: "notFound",
-			},
-		}, nil
+		// A genuine missing record resolves to "notFound"; any other storage
+		// failure is transient and must propagate so callers can retry rather
+		// than mistake a DB blip for an unknown DID.
+		if errors.Is(err, storage.ErrDIDDocumentNotFound) {
+			return &types.DIDResolutionResult{
+				DIDResolutionMetadata: types.DIDResolutionMetadata{
+					Error: "notFound",
+				},
+			}, nil
+		}
+		return nil, fmt.Errorf("%w: %w", ErrDIDResolutionUnavailable, err)
 	}
 
 	// Check if revoked
@@ -195,10 +209,9 @@ func (s *DIDWebService) RevokeDID(ctx context.Context, did string) error {
 func (s *DIDWebService) IsDIDRevoked(ctx context.Context, did string) bool {
 	record, err := s.storage.GetDIDDocument(ctx, did)
 	if err != nil {
-		// Check if this is a "not found" error vs a real storage failure.
-		// Not found means the DID was never registered — treat as not revoked.
-		// Any other error (DB timeout, connection failure) — fail closed.
-		if strings.Contains(err.Error(), "not found") || strings.Contains(err.Error(), "no rows") {
+		// Not found means the DID was never registered - treat as not revoked.
+		// Any other error (DB timeout, connection failure) - fail closed.
+		if errors.Is(err, storage.ErrDIDDocumentNotFound) {
 			return false
 		}
 		logger.Logger.Warn().Err(err).Str("did", did).Msg("Storage error checking DID revocation, failing closed")
```

**File**: `control-plane/internal/services/did_web_service_additional_test.go` (modified, +15/-3)
```diff
@@ -7,9 +7,11 @@ import (
 	"encoding/base64"
 	"encoding/json"
 	"errors"
+	"fmt"
 	"testing"
 	"time"
 
+	storagepkg "github.com/Agent-Field/agentfield/control-plane/internal/storage"
 	"github.com/Agent-Field/agentfield/control-plane/pkg/types"
 	"github.com/stretchr/testify/require"
 )
@@ -73,7 +75,7 @@ func TestDIDWebServiceDocumentLifecycleAndResolution(t *testing.T) {
 		require.Equal(t, "example.com", service.GetDomain())
 	})
 
-	t.Run("storage failures and malformed payloads return DID resolution metadata", func(t *testing.T) {
+	t.Run("genuine missing, revoked and malformed records map to resolution metadata; transient errors propagate", func(t *testing.T) {
 		now := time.Now().UTC()
 		service := NewDIDWebService("example.com", nil, &didWebStorageWithErrors{
 			didWebStorageStub: didWebStorageStub{
@@ -95,7 +97,10 @@ func TestDIDWebServiceDocumentLifecycleAndResolution(t *testing.T) {
 					},
 				},
 				errByDID: map[string]error{
-					"did:web:example.com:agents:missing": errors.New("not found"),
+					// A genuine missing record surfaces the storage not-found sentinel.
+					"did:web:example.com:agents:missing": fmt.Errorf("%w: did:web:example.com:agents:missing", storagepkg.ErrDIDDocumentNotFound),
+					// A transient failure is a different, non-sentinel error.
+					"did:web:example.com:agents:flaky": errors.New("connection reset by peer"),
 				},
 			},
 		})
@@ -104,6 +109,13 @@ func TestDIDWebServiceDocumentLifecycleAndResolution(t *testing.T) {
 		require.NoError(t, err)
 		require.Equal(t, "notFound", missing.DIDResolutionMetadata.Error)
 
+		// Transient storage errors must not be masked as notFound; they propagate
+		// as a retryable resolution error so the middleware can answer 503.
+		flaky, err := service.ResolveDID(context.Background(), "did:web:example.com:agents:flaky")
+		require.Error(t, err)
+		require.Nil(t, flaky)
+		require.ErrorIs(t, err, ErrDIDResolutionUnavailable)
+
 		revoked, err := service.ResolveDID(context.Background(), "did:web:example.com:agents:revoked")
 		require.NoError(t, err)
 		require.Equal(t, "deactivated", revoked.DIDResolutionMetadata.Error)
@@ -184,7 +196,7 @@ func TestDIDWebServiceGetOrCreateAndRevocationPaths(t *testing.T) {
 					},
 				},
 				errByDID: map[string]error{
-					"did:web:example.com:agents:missing": errors.New("not found"),
+					"did:web:example.com:agents:missing": fmt.Errorf("%w: did:web:example.com:agents:missing", storagepkg.ErrDIDDocumentNotFound),
 					"did:web:example.com:agents:error":   errors.New("database unavailable"),
 				},
 			},
```

**File**: `control-plane/internal/services/did_web_service_test.go` (modified, +4/-3)
```diff
@@ -5,9 +5,10 @@ package services
 
 import (
 	"context"
-	"errors"
+	"fmt"
 	"testing"
 
+	"github.com/Agent-Field/agentfield/control-plane/internal/storage"
 	"github.com/Agent-Field/agentfield/control-plane/pkg/types"
 	"github.com/stretchr/testify/require"
 )
@@ -32,7 +33,7 @@ func (s *didWebStorageStub) GetDIDDocument(_ context.Context, did string) (*type
 	if record, ok := s.docsByDID[did]; ok {
 		return record, nil
 	}
-	return nil, errors.New("not found")
+	return nil, fmt.Errorf("%w: %s", storage.ErrDIDDocumentNotFound, did)
 }
 
 func (s *didWebStorageStub) GetDIDDocumentByAgentID(_ context.Context, agentID string) (*types.DIDDocumentRecord, error) {
@@ -41,7 +42,7 @@ func (s *didWebStorageStub) GetDIDDocumentByAgentID(_ context.Context, agentID s
 			return record, nil
 		}
 	}
-	return nil, errors.New("not found")
+	return nil, fmt.Errorf("%w: %s", storage.ErrDIDDocumentNotFound, agentID)
 }
 
 func (s *didWebStorageStub) RevokeDIDDocument(_ context.Context, _ string) error {
```

**File**: `control-plane/internal/storage/local_did.go` (modified, +5/-0)
```diff
@@ -24,6 +24,11 @@ var ErrDIDAllocationConflict = errors.New("DID allocation conflict")
 // ErrDIDNodeAlreadyRegistered means another active identity owns the node or component name.
 var ErrDIDNodeAlreadyRegistered = errors.New("DID node or component already registered")
 
+// ErrDIDDocumentNotFound means no DID document exists for the requested DID.
+// It lets callers distinguish a genuine missing record from a transient
+// storage failure, so a momentary DB error is not reported as "not found".
+var ErrDIDDocumentNotFound = errors.New("DID document not found")
+
 const didPostgresLockTimeout = "15s"
 
 func isSQLiteContention(err error) bool {
```

**File**: `control-plane/internal/storage/local_events.go` (modified, +1/-1)
```diff
@@ -743,7 +743,7 @@ func (ls *LocalStorage) GetDIDDocument(ctx context.Context, did string) (*types.
 	)
 	if err != nil {
 		if err == sql.ErrNoRows {
-			return nil, fmt.Errorf("DID document not found: %s", did)
+			return nil, fmt.Errorf("%w: %s", ErrDIDDocumentNotFound, did)
 		}
 		return nil, fmt.Errorf("failed to get DID document: %w", err)
 	}
```

---

### Incident Patch 2: `d26f52da` (2026-10-27)
**Commit Message**: fix(sdk): log the CodeAF missing-key warning once, and count the harness config's env (#1132)

Agent construction and call-time refusal now share one warning per process in the Python, Go and TypeScript SDKs, and the construction check reads the same effective environment the harness calls use (the process environment overlaid with the harness config's env map). This removes the double warning for keyless agents, the false warning when the key is only in the config's env, and the missed warning when that env blanks a process key. Refusals and keyed calls are unchanged.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `control-plane/internal/skillkit/skill_data/agentfield/references/primitives-snapshot.md` (modified, +5/-3)
```diff
@@ -200,9 +200,11 @@ Harness provider 'codeaf' needs a model key and none is configured. Set OPENROUT
 The check honors per-call environment overrides, compatible `OPENAI_API_KEY`
 credentials (an `sk-or-` key or a custom base URL), saved profile `api_key` or
 `model_sources`, and connected-provider credential files. Unreadable/malformed
-profiles permit execution conservatively. Refusal warns once per process; an
-Agent with an explicit harness config resolving to CodeAF also warns once at
-construction without failing. Legacy aforge pins are unchanged.
+profiles permit execution conservatively. The warning is logged once per process —
+at construction for an Agent with a CodeAF harness config and no key (counting
+the config's `env`), otherwise at the first refused call. Construction never
+fails; every refused call still fails with the not-configured error. Legacy
+aforge pins are unchanged.
 
 **Harness availability gate** — DO NOT use unless ALL true:
 
```

**File**: `docs/harness-providers.md` (modified, +4/-3)
```diff
@@ -57,9 +57,10 @@ Harness provider 'codeaf' needs a model key and none is configured. Set OPENROUT
 The error remains catchable as the SDK's unavailable-provider error (Python and
 TypeScript expose `HarnessProviderNotConfigured`; Go uses
 `ProviderUnavailableError` with `NotConfigured: true`). It identifies `codeaf`
-and lists `OPENROUTER_API_KEY` as missing. Refused calls log a warning once per
-process. An Agent with an explicit harness config resolving to CodeAF also warns
-once at construction; construction continues normally.
+and lists `OPENROUTER_API_KEY` as missing. The warning is logged once per process —
+at construction for an Agent with a CodeAF harness config and no key (counting
+the config's `env`), otherwise at the first refused call. Construction continues
+normally; every refused call still fails with the not-configured error.
 
 The check uses the effective child environment, including per-call `env`
 overrides and the SDK's default `CODEAF_HOME`. It accepts `OPENROUTER_API_KEY`,
```

**File**: `sdk/codeaf-auth-contract.json` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 {
-  "contract": "Shared CodeAF model-key preflight contract for the Python, Go and TypeScript SDKs. K1: with no credential CodeAF could use, a CodeAF harness call fails with the not-configured error before resolving, downloading or launching CodeAF. K2: the first refusal in a process logs the warning once. K3: with a credential the call is unchanged. K4: the check mirrors CodeAF's key ladder against the effective child environment (the cases below). K5: legacy aforge pins are unchanged. K6: an Agent whose harness config resolves to CodeAF warns once at construction when no credential is visible. K7: all three SDKs share these strings and cases. Paths in cases are replaced with isolated temporary directories; a null file means an unreadable entry.",
+  "contract": "Shared CodeAF model-key preflight contract for the Python, Go and TypeScript SDKs. K1: with no credential CodeAF could use, a CodeAF harness call fails with the not-configured error before resolving, downloading or launching CodeAF. K2: a process logs the warning at most once in total — at Agent construction or at the first refusal, whichever comes first; every refused call still fails with the not-configured error. K3: with a credential the call is unchanged. K4: the check mirrors CodeAF's key ladder against the effective child environment (the cases below). K5: legacy aforge pins are unchanged. K6: an Agent whose harness config resolves to CodeAF warns at construction when the effective environment its harness calls will use (the process environment overlaid with the config's env map) has no credential; construction never fails. K7: all three SDKs share these strings and cases. Paths in cases are replaced with isolated temporary directories; a null file means an unreadable entry.",
   "refusal": "Harness provider 'codeaf' needs a model key and none is configured. Set OPENROUTER_API_KEY (https://openrouter.ai/keys), or choose another harness provider with the provider option or AGENTFIELD_HARNESS_PROVIDER.",
   "warning": "CodeAF is the harness provider and no model key is configured, so harness calls will fail. Set OPENROUTER_API_KEY (https://openrouter.ai/keys), or choose another harness provider with the provider option or AGENTFIELD_HARNESS_PROVIDER.",
   "cases": [
```

**File**: `sdk/go/agent/harness.go` (modified, +2/-5)
```diff
@@ -2,20 +2,17 @@ package agent
 
 import (
 	"context"
-	"sync"
 
 	"github.com/Agent-Field/agentfield/sdk/go/harness"
 )
 
-var codeAFConfigWarning sync.Once
-
 func warnCodeAFConfiguration(cfg Config) {
 	if cfg.HarnessConfig == nil {
 		return
 	}
 	provider, _ := harness.BuildProvider(cfg.HarnessConfig.Provider, cfg.HarnessConfig.BinPath)
-	if _, ok := provider.(*harness.CodeAFProvider); ok && !harness.CodeAFHasCredentials(harness.Options{}) {
-		codeAFConfigWarning.Do(func() { cfg.Logger.Print("WARNING " + harness.CodeAFMissingKeyWarning) })
+	if _, ok := provider.(*harness.CodeAFProvider); ok && !harness.CodeAFHasCredentials(harness.Options{Env: cfg.HarnessConfig.Env}) {
+		harness.WarnCodeAFMissingKeyOnce(func(message string) { cfg.Logger.Print("WARNING " + message) })
 	}
 }
 
```

**File**: `sdk/go/agent/harness_auth_test.go` (modified, +200/-18)
```diff
@@ -2,25 +2,93 @@ package agent
 
 import (
 	"bytes"
+	"context"
 	"encoding/json"
+	"errors"
+	"fmt"
 	"log"
+	"net/http"
 	"os"
+	"os/exec"
 	"path/filepath"
+	"regexp"
 	"strings"
-	"sync"
 	"testing"
 
+	"github.com/Agent-Field/agentfield/sdk/go/harness"
 	"github.com/stretchr/testify/assert"
 	"github.com/stretchr/testify/require"
 )
 
-func TestCodeAFK6ConstructionWarning(t *testing.T) {
+type codeAFAgentAuthContract struct {
+	Warning string `json:"warning"`
+	Refusal string `json:"refusal"`
+	Cases   []struct {
+		Name    string             `json:"name"`
+		Allow   bool               `json:"allow"`
+		Env     map[string]string  `json:"env"`
+		Overlay map[string]string  `json:"overlay"`
+		Files   map[string]*string `json:"files"`
+	} `json:"cases"`
+}
+
+func readCodeAFAgentAuthContract(t *testing.T) codeAFAgentAuthContract {
+	t.Helper()
 	data, err := os.ReadFile("../../codeaf-auth-contract.json")
 	require.NoError(t, err)
-	var contract struct {
-		Warning string `json:"warning"`
-	}
+	var contract codeAFAgentAuthContract
 	require.NoError(t, json.Unmarshal(data, &contract))
+	return contract
+}
+
+// A fresh process gives each Agent test an unspent harness warning budget
+// without exporting a production API solely to reset sync.Once in tests.
+func runCodeAFAuthInFreshProcess(t *testing.T) bool {
+	t.Helper()
+	if os.Getenv("AGENTFIELD_TEST_CODEAF_AUTH_PROCESS") == t.Name() {
+		return false
+	}
+	command := exec.Command(os.Args[0], "-test.run=^"+regexp.QuoteMeta(t.Name())+"$", "-test.count=1")
+	command.Env = append(os.Environ(), "AGENTFIELD_TEST_CODEAF_AUTH_PROCESS="+t.Name())
+	output, err := command.CombinedOutput()
+	require.NoError(t, err, "%s", output)
+	return true
+}
+
+type codeAFAgentNoDownload struct{ t *testing.T }
+
+func (transport codeAFAgentNoDownload) RoundTrip(*http.Request) (*http.Response, error) {
+	transport.t.Error("download attempted")
+	return nil, errors.New("downloads forbidden by CodeAF auth tests")
+}
+
+func isolateCodeAFAgentAuth(t *testing.T) (string, *bytes.Buffer) {
+	t.Helper()
+	for _, entry := range os.Environ() {
+		key, _, _ := strings.Cut(entry, "=")
+		if strings.HasPrefix(key, "CODEAF_") || strings.HasPrefix(key, "AFORGE_") || strings.HasPrefix(key, "AGENTFIELD_") || key == "OPENROUTER_API_KEY" || key == "OPENAI_API_KEY" {
+			t.Setenv(key, "")
+			require.NoError(t, os.Unsetenv(key))
+		}
+	}
+	directory := t.TempDir()
+	t.Setenv("HOME", filepath.Join(directory, "home"))
+	t.Setenv("PATH", directory)
+	t.Setenv("AGENTFIELD_HOME", filepath.Join(directory, "agentfield"))
+	t.Setenv("CODEAF_TELEMETRY", "off")
+	var output bytes.Buffer
+	previousWriter, previousTransport := log.Writer(), http.DefaultTransport
+	log.SetOutput(&output)
+	http.DefaultTransport = codeAFAgentNoDownload{t}
+	t.Cleanup(func() {
+		log.SetOutput(previousWriter)
+		http.DefaultTransport = previousTransport
+	})
+	return directory, &output
+}
+
+func TestCodeAFK6ConstructionWarning(t *testing.T) {
+	contract := readCodeAFAgentAuthContract(t)
 	for _, tc := range []struct {
 		name, provider, envProvider, key string
 		configured, legacy, warn         bool
@@ -36,25 +104,16 @@ func TestCodeAFK6ConstructionWarning(t *testing.T) {
 		{name: "env-other", envProvider: "claude-code", configured: true},
 	} {
 		t.Run(tc.name, func(t *testing.T) {
-			for _, entry := range os.Environ() {
-				key, _, _ := strings.Cut(entry, "=")
-				if strings.HasPrefix(key, "CODEAF_") || strings.HasPrefix(key, "AFORGE_") || strings.HasPrefix(key, "AGENTFIELD_") || key == "OPENROUTER_API_KEY" || key == "OPENAI_API_KEY" {
-					t.Setenv(key, "")
-					require.NoError(t, os.Unsetenv(key))
-				}
+			if runCodeAFAuthInFreshProcess(t) {
+				return
 			}
-			directory := t.TempDir()
-			t.Setenv("HOME", filepath.Join(directory, "home"))
-			t.Setenv("AGENTFIELD_HOME", filepath.Join(directory, "agentfield"))
-			t.Setenv("CODEAF_TELEMETRY", "off")
+			_, output := isolateCodeAFAgentAuth(t)
 			t.Setenv("OPENROUTER_API_KEY", tc.key)
 			t.Setenv("AGENTFIELD_HARNESS_PROVIDER", tc.envProvider)
 			if tc.legacy {
 				t.Setenv("AFORGE_BIN", "/fake/legacy")
 			}
-			codeAFConfigWarning = sync.Once{}
-			var output bytes.Buffer
-			cfg := Config{NodeID: "auth-test", Version: "1", Logger: log.New(&output, "", 0)}
+			cfg := Config{NodeID: "auth-test", Version: "1", Logger: log.New(output, "", 0)}
 			if tc.configured {
 				cfg.HarnessConfig = &HarnessConfig{Provider: tc.provider}
 			}
@@ -70,3 +129,126 @@ func TestCodeAFK6ConstructionWarning(t *testing.T) {
 		})
 	}
 }
+
+func codeAFAgentFakeBinary(t *testing.T, directory string) (string, string) {
+	t.Helper()
+	binary, marker := filepath.Join(directory, "fake-codeaf"), filepath.Join(directory, "ran")
+	require.NoError(t, os.WriteFile(binary, []byte(fmt.Sprintf("#!/bin/sh\n/bin/cat >/dev/null\nprintf ran > '%s'\nprintf '%%s\\n' '{\"ok\":true,\"stop\":\"done\",\"answer\":\"answer\"}'\n", marker)), 0o755))
+	return binary, marker
+}
+
+func TestCodeAFW1SharedP
```

**File**: `sdk/go/harness/codeaf.go` (modified, +7/-1)
```diff
@@ -34,6 +34,12 @@ var (
 	codeAFMissingKeyOnce sync.Once
 )
 
+// WarnCodeAFMissingKeyOnce shares one process-wide warning budget between Agent
+// construction and refused calls, using the caller's warning logger.
+func WarnCodeAFMissingKeyOnce(warn func(string)) {
+	codeAFMissingKeyOnce.Do(func() { warn(CodeAFMissingKeyWarning) })
+}
+
 // CodeAFProvider invokes CodeAF's canonical headless exec or do protocol.
 // Binary discovery and managed installation happen lazily on first execution.
 // When CodeAF is unavailable it can delegate to the unchanged legacy adapter.
@@ -274,7 +280,7 @@ func (p *CodeAFProvider) Execute(ctx context.Context, prompt string, options Opt
 		override = options.BinPath
 	}
 	if !CodeAFHasCredentials(options) {
-		codeAFMissingKeyOnce.Do(func() { log.Print("WARNING " + CodeAFMissingKeyWarning) })
+		WarnCodeAFMissingKeyOnce(func(message string) { log.Print("WARNING " + message) })
 		binary := firstNonEmpty(override, os.Getenv("CODEAF_BIN"), "codeaf")
 		return nil, &ProviderUnavailableError{
 			Provider: ProviderCodeAF, Binary: binary, InstallCommand: providerSpecs[ProviderCodeAF].InstallCommand,
```

**File**: `sdk/go/harness/codeaf_auth_test.go` (modified, +4/-3)
```diff
@@ -82,11 +82,12 @@ func assertAuthRefusal(t *testing.T, err error, contract authContract) {
 	assert.ErrorIs(t, err, ErrProviderUnavailable)
 	assert.Equal(t, contract.Refusal, err.Error())
 	assert.Equal(t, ProviderCodeAF, unavailable.Provider)
+	assert.True(t, unavailable.NotConfigured)
 	assert.Equal(t, []string{"OPENROUTER_API_KEY"}, unavailable.MissingAuthEnv)
 	assert.Equal(t, "af codeaf ensure", unavailable.InstallCommand)
 }
 
-func TestCodeAFK1K3K4K7SharedKeyLadder(t *testing.T) {
+func TestCodeAFW4K1K3K4K7SharedKeyLadder(t *testing.T) {
 	contract := readAuthContract(t)
 	for _, tc := range contract.Cases {
 		t.Run(tc.Name, func(t *testing.T) {
@@ -135,7 +136,7 @@ func TestCodeAFK1K3K4K7SharedKeyLadder(t *testing.T) {
 	}
 }
 
-func TestCodeAFK1K2BeforeResolution(t *testing.T) {
+func TestCodeAFW2K1K2BeforeResolution(t *testing.T) {
 	contract := readAuthContract(t)
 	for _, provider := range []string{"", "codeaf", "aforge"} {
 		for _, pin := range []string{"automatic", "env", "option"} {
@@ -157,7 +158,7 @@ func TestCodeAFK1K2BeforeResolution(t *testing.T) {
 				if pin == "option" {
 					opts.BinPath = binary
 				}
-				for call := 0; call < 2; call++ {
+				for call := 0; call < 3; call++ {
 					_, err := p.Execute(context.Background(), "task", opts)
 					assertAuthRefusal(t, err, contract)
 				}
```

**File**: `sdk/python/agentfield/harness/providers/codeaf.py` (modified, +15/-11)
```diff
@@ -44,8 +44,14 @@
     "Set OPENROUTER_API_KEY (https://openrouter.ai/keys), or choose another "
     "harness provider with the provider option or AGENTFIELD_HARNESS_PROVIDER."
 )
-_missing_key_logged = False
-_construction_warning_logged = False
+_missing_key_warned = False
+
+
+def _warn_missing_key_once() -> None:
+    global _missing_key_warned
+    if not _missing_key_warned:
+        _missing_key_warned = True
+        logger.warning(CODEAF_MISSING_KEY_WARNING)
 
 
 def _max_concurrent() -> int:
@@ -223,7 +229,6 @@ def warn_codeaf_configuration(config: HarnessConfig) -> None:
 def _warn_codeaf_configuration(config: HarnessConfig) -> None:
     from agentfield.harness.providers._factory import resolve_execution_provider
 
-    global _construction_warning_logged
     provider = resolve_execution_provider(config)
     if provider not in {"codeaf", "aforge"}:
         return
@@ -232,10 +237,12 @@ def _warn_codeaf_configuration(config: HarnessConfig) -> None:
         or os.environ.get("AFORGE_BIN", "").strip()
     ):
         return
-    environment = {**os.environ, **_child_environment({}, None)}
-    if not _has_model_key(environment) and not _construction_warning_logged:
-        _construction_warning_logged = True
-        logger.warning(CODEAF_MISSING_KEY_WARNING)
+    environment = {
+        **os.environ,
+        **_child_environment({"env": dict(config.env or {})}, None),
+    }
+    if not _has_model_key(environment):
+        _warn_missing_key_once()
 
 
 class CodeafProvider:
@@ -273,7 +280,6 @@ async def _resolve_automatic(cls) -> tuple[str | None, str, str | None]:
             cls._resolution_task = None
 
     async def execute(self, prompt: str, options: dict[str, object]) -> RawResult:
-        global _missing_key_logged
         started = time.monotonic()
         timeout = int(os.environ.get("AGENTFIELD_HARNESS_TIMEOUT_SECONDS", "1800"))
         deadline = started + timeout
@@ -283,9 +289,7 @@ async def execute(self, prompt: str, options: dict[str, object]) -> RawResult:
             return await AforgeProvider(legacy_pin).execute(prompt, options)
         environment = {**os.environ, **_child_environment(options, None)}
         if not _has_model_key(environment):
-            if not _missing_key_logged:
-                _missing_key_logged = True
-                logger.warning(CODEAF_MISSING_KEY_WARNING)
+            _warn_missing_key_once()
             raise HarnessProviderNotConfigured(
                 binary=self._bin or os.environ.get("CODEAF_BIN") or "codeaf"
             )
```

---

### Incident Patch 3: `27bc3a13` (2026-10-26)
**Commit Message**: fix(sdk): fail fast with a clear message when the CodeAF harness has no model key (#1130)

When CodeAF (the default harness provider) has no model key it could use, the Python, Go and TypeScript SDKs now refuse the call before resolving, downloading or launching CodeAF, with a message that names OPENROUTER_API_KEY and how to pick another provider (HarnessProviderNotConfigured / ProviderUnavailableError{NotConfigured}), and warn once per process and at Agent construction. The check mirrors CodeAF's own key ladder and lets the call through whenever it cannot be sure. Keyless launches no longer reach CodeAF, so they stop being counted as failed CodeAF sessions.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `control-plane/internal/skillkit/skill_data/agentfield/references/primitives-snapshot.md` (modified, +15/-0)
```diff
@@ -189,6 +189,21 @@ caller leaves the shared download running. Doctor checks unpinned `aforge`
 against CodeAF read-only, including its version, then falls back to legacy
 aforge; a pin checks only the pinned binary.
 
+CodeAF harness calls fail fast before binary resolution, download or launch when
+no model credential is visible, including with an explicit binary. The SDK's
+unavailable-provider error carries this exact message:
+
+```text
+Harness provider 'codeaf' needs a model key and none is configured. Set OPENROUTER_API_KEY (https://openrouter.ai/keys), or choose another harness provider with the provider option or AGENTFIELD_HARNESS_PROVIDER.
+```
+
+The check honors per-call environment overrides, compatible `OPENAI_API_KEY`
+credentials (an `sk-or-` key or a custom base URL), saved profile `api_key` or
+`model_sources`, and connected-provider credential files. Unreadable/malformed
+profiles permit execution conservatively. Refusal warns once per process; an
+Agent with an explicit harness config resolving to CodeAF also warns once at
+construction without failing. Legacy aforge pins are unchanged.
+
 **Harness availability gate** — DO NOT use unless ALL true:
 
 1. `af doctor` reports `recommendation.harness_usable: true` AND lists the chosen provider.
```

**File**: `docs/ENVIRONMENT_VARIABLES.md` (modified, +11/-0)
```diff
@@ -22,6 +22,17 @@ CLI/skill/package installs, node launch and Desktop provision it best-effort.
 The Python-agent, Go-agent and cloud control-plane images ship CodeAF at
 `/usr/local/bin/codeaf`, failing their build if download or verification fails.
 
+SDK harness calls with no model credential fail before binary resolution,
+download or launch, with this message:
+
+```text
+Harness provider 'codeaf' needs a model key and none is configured. Set OPENROUTER_API_KEY (https://openrouter.ai/keys), or choose another harness provider with the provider option or AGENTFIELD_HARNESS_PROVIDER.
+```
+
+The check honors the effective child environment and saved/connected profile
+credentials. See the [credential contract](harness-providers.md#default-codeaf)
+for the key ladder and once-per-process warnings.
+
 - `AGENTFIELD_HARNESS_PROVIDER`: Explicit SDK provider config wins over this
   variable; blank values are ignored; the built-in default is `codeaf`.
 - `AGENTFIELD_CODEAF_BASE_URL`: Full release directory override, version included;
```

**File**: `docs/harness-providers.md` (modified, +28/-0)
```diff
@@ -47,6 +47,34 @@ result, err := agent.Harness(ctx, task, schema, &dest, harness.Options{Cwd: repo
 const result = await app.harness(task, { schema });
 ```
 
+Without a model credential, Python, Go and TypeScript harness calls fail before
+resolving, downloading or launching CodeAF, including with an explicit binary:
+
+```text
+Harness provider 'codeaf' needs a model key and none is configured. Set OPENROUTER_API_KEY (https://openrouter.ai/keys), or choose another harness provider with the provider option or AGENTFIELD_HARNESS_PROVIDER.
+```
+
+The error remains catchable as the SDK's unavailable-provider error (Python and
+TypeScript expose `HarnessProviderNotConfigured`; Go uses
+`ProviderUnavailableError` with `NotConfigured: true`). It identifies `codeaf`
+and lists `OPENROUTER_API_KEY` as missing. Refused calls log a warning once per
+process. An Agent with an explicit harness config resolving to CodeAF also warns
+once at construction; construction continues normally.
+
+The check uses the effective child environment, including per-call `env`
+overrides and the SDK's default `CODEAF_HOME`. It accepts `OPENROUTER_API_KEY`,
+an `OPENAI_API_KEY` starting with `sk-or-`, or another `OPENAI_API_KEY` with a
+custom `CODEAF_BASE_URL` (falling back to `AFORGE_BASE_URL`). Ordinary OpenAI keys
+are not accepted for the OpenRouter host. Whitespace-only values are empty.
+The profile directory is the first non-empty `CODEAF_PROFILE_DIR`,
+`AFORGE_PROFILE_DIR`, child `CODEAF_HOME`, or `AFORGE_HOME`; when none is set, or
+one is whitespace only, the call is allowed and CodeAF decides.
+A saved `api_key` or non-empty `model_sources` array/object in its `config.json`
+also permits execution. Unreadable or malformed profile configs and existing
+`credentials.json` or `codex.json` permit execution conservatively, so connected
+providers and sign-ins can supply their credentials. Legacy aforge pins keep
+their existing behavior.
+
 The default model is `~deepseek/deepseek-v4-flash-latest`. Pass `model=` to change
 it; the SDK strips one leading `openrouter/` before invoking CodeAF.
 
```

**File**: `sdk/codeaf-auth-contract.json` (added, +423/-0)
```diff
@@ -0,0 +1,423 @@
+{
+  "contract": "Shared CodeAF model-key preflight contract for the Python, Go and TypeScript SDKs. K1: with no credential CodeAF could use, a CodeAF harness call fails with the not-configured error before resolving, downloading or launching CodeAF. K2: the first refusal in a process logs the warning once. K3: with a credential the call is unchanged. K4: the check mirrors CodeAF's key ladder against the effective child environment (the cases below). K5: legacy aforge pins are unchanged. K6: an Agent whose harness config resolves to CodeAF warns once at construction when no credential is visible. K7: all three SDKs share these strings and cases. Paths in cases are replaced with isolated temporary directories; a null file means an unreadable entry.",
+  "refusal": "Harness provider 'codeaf' needs a model key and none is configured. Set OPENROUTER_API_KEY (https://openrouter.ai/keys), or choose another harness provider with the provider option or AGENTFIELD_HARNESS_PROVIDER.",
+  "warning": "CodeAF is the harness provider and no model key is configured, so harness calls will fail. Set OPENROUTER_API_KEY (https://openrouter.ai/keys), or choose another harness provider with the provider option or AGENTFIELD_HARNESS_PROVIDER.",
+  "cases": [
+    {
+      "name": "no-key",
+      "allow": false,
+      "env": {},
+      "overlay": {},
+      "files": {}
+    },
+    {
+      "name": "process-key",
+      "allow": true,
+      "env": {
+        "OPENROUTER_API_KEY": " process-key "
+      },
+      "overlay": {},
+      "files": {}
+    },
+    {
+      "name": "overlay-key",
+      "allow": true,
+      "env": {},
+      "overlay": {
+        "OPENROUTER_API_KEY": " overlay-key "
+      },
+      "files": {}
+    },
+    {
+      "name": "whitespace-key",
+      "allow": false,
+      "env": {
+        "OPENROUTER_API_KEY": " \t\n"
+      },
+      "overlay": {},
+      "files": {}
+    },
+    {
+      "name": "overlay-clears-key",
+      "allow": false,
+      "env": {
+        "OPENROUTER_API_KEY": "process-key"
+      },
+      "overlay": {
+        "OPENROUTER_API_KEY": ""
+      },
+      "files": {}
+    },
+    {
+      "name": "openai-router-key",
+      "allow": true,
+      "env": {
+        "OPENAI_API_KEY": " sk-or-v1-x "
+      },
+      "overlay": {},
+      "files": {}
+    },
+    {
+      "name": "openai-custom-endpoint",
+      "allow": true,
+      "env": {
+        "OPENAI_API_KEY": "sk-proj-x",
+        "CODEAF_BASE_URL": "http://127.0.0.1:11434/v1"
+      },
+      "overlay": {},
+      "files": {}
+    },
+    {
+      "name": "openai-legacy-endpoint",
+      "allow": true,
+      "env": {
+        "OPENAI_API_KEY": "sk-proj-x",
+        "AFORGE_BASE_URL": "http://127.0.0.1:11434/v1"
+      },
+      "overlay": {},
+      "files": {}
+    },
+    {
+      "name": "openai-empty-base-fallback",
+      "allow": true,
+      "env": {
+        "OPENAI_API_KEY": "sk-proj-x",
+        "CODEAF_BASE_URL": "",
+        "AFORGE_BASE_URL": "localhost:11434/v1"
+      },
+      "overlay": {},
+      "files": {}
+    },
+    {
+      "name": "openai-whitespace-base-fallback",
+      "allow": true,
+      "env": {
+        "OPENAI_API_KEY": "sk-proj-x",
+        "CODEAF_BASE_URL": " \t",
+        "AFORGE_BASE_URL": "localhost:11434/v1"
+      },
+      "overlay": {},
+      "files": {}
+    },
+    {
+      "name": "openai-without-base",
+      "allow": false,
+      "env": {
+        "OPENAI_API_KEY": "sk-proj-x"
+      },
+      "overlay": {},
+      "files": {}
+    },
+    {
+      "name": "openai-router-base",
+      "allow": false,
+      "env": {
+        "OPENAI_API_KEY": "sk-proj-x",
+        "CODEAF_BASE_URL": "https://openrouter.ai/api/v1"
+      },
+      "overlay": {},
+      "files": {}
+    },
+    {
+      "name": "openai-router-normalized-host",
+      "allow": false,
+      "env": {
+        "OPENAI_API_KEY": "sk-proj-x",
+        "CODEAF_BASE_URL": "WWW.OpenRouter.AI.:443/other"
+      },
+      "overlay": {},
+      "files": {}
+    },
+    {
+      "name": "base-precedence",
+      "allow": false,
+      "env": {
+        "OPENAI_API_KEY": "sk-proj-x",
+        "CODEAF_BASE_URL": "//openrouter.ai/v1",
+        "AFORGE_BASE_URL": "localhost:11434"
+      },
+      "overlay": {},
+      "files": {}
+    },
+    {
+      "name": "unparseable-custom-base",
+      "allow": true,
+      "env": {
+        "OPENAI_API_KEY": "sk-proj-x",
+        "CODEAF_BASE_URL": "http://[broken"
+      },
+      "overlay": {},
+      "files": {}
+    },
+    {
+      "name": "empty-openai-custom-base",
+      "allow": false,
+      "env": {
+        "OPENAI_API_KEY": " \t",
+        "CODEAF_BASE_URL": "localhost:11434"
+      },
+      "overlay": {},
+      "files": {}
+    },
+    {
+      "name": "profile-api-key",
+      "allow": true,
+      "env": {},
+      "overlay": {},
+      "files": {
+        "$STATE/config.json": "{\"api_key\":\" saved-key \"}"
+      }
+    },
+    {
+    
```

**File**: `sdk/go/agent/agent.go` (modified, +1/-0)
```diff
@@ -622,6 +622,7 @@ func New(cfg Config) (*Agent, error) {
 	if cfg.Logger == nil {
 		cfg.Logger = log.New(os.Stdout, "[agent] ", log.LstdFlags)
 	}
+	warnCodeAFConfiguration(cfg)
 
 	if cfg.CallTimeout <= 0 {
 		cfg.CallTimeout = 15 * time.Second
```

**File**: `sdk/go/agent/harness.go` (modified, +13/-0)
```diff
@@ -2,10 +2,23 @@ package agent
 
 import (
 	"context"
+	"sync"
 
 	"github.com/Agent-Field/agentfield/sdk/go/harness"
 )
 
+var codeAFConfigWarning sync.Once
+
+func warnCodeAFConfiguration(cfg Config) {
+	if cfg.HarnessConfig == nil {
+		return
+	}
+	provider, _ := harness.BuildProvider(cfg.HarnessConfig.Provider, cfg.HarnessConfig.BinPath)
+	if _, ok := provider.(*harness.CodeAFProvider); ok && !harness.CodeAFHasCredentials(harness.Options{}) {
+		codeAFConfigWarning.Do(func() { cfg.Logger.Print("WARNING " + harness.CodeAFMissingKeyWarning) })
+	}
+}
+
 // harness.go integrates the harness package with the Agent struct,
 // providing lazy initialization and a convenience Harness() method.
 // HarnessConfig configures the default harness runner for the agent.
```

**File**: `sdk/go/agent/harness_auth_test.go` (added, +72/-0)
```diff
@@ -0,0 +1,72 @@
+package agent
+
+import (
+	"bytes"
+	"encoding/json"
+	"log"
+	"os"
+	"path/filepath"
+	"strings"
+	"sync"
+	"testing"
+
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+)
+
+func TestCodeAFK6ConstructionWarning(t *testing.T) {
+	data, err := os.ReadFile("../../codeaf-auth-contract.json")
+	require.NoError(t, err)
+	var contract struct {
+		Warning string `json:"warning"`
+	}
+	require.NoError(t, json.Unmarshal(data, &contract))
+	for _, tc := range []struct {
+		name, provider, envProvider, key string
+		configured, legacy, warn         bool
+	}{
+		{name: "default", configured: true, warn: true},
+		{name: "explicit", provider: "codeaf", configured: true, warn: true},
+		{name: "alias", provider: "aforge", configured: true, warn: true},
+		{name: "key", provider: "codeaf", key: "key", configured: true},
+		{name: "other", provider: "claude-code", configured: true},
+		{name: "no-config"},
+		{name: "legacy", provider: "aforge", configured: true, legacy: true},
+		{name: "env-codeaf", envProvider: "codeaf", configured: true, warn: true},
+		{name: "env-other", envProvider: "claude-code", configured: true},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			for _, entry := range os.Environ() {
+				key, _, _ := strings.Cut(entry, "=")
+				if strings.HasPrefix(key, "CODEAF_") || strings.HasPrefix(key, "AFORGE_") || strings.HasPrefix(key, "AGENTFIELD_") || key == "OPENROUTER_API_KEY" || key == "OPENAI_API_KEY" {
+					t.Setenv(key, "")
+					require.NoError(t, os.Unsetenv(key))
+				}
+			}
+			directory := t.TempDir()
+			t.Setenv("HOME", filepath.Join(directory, "home"))
+			t.Setenv("AGENTFIELD_HOME", filepath.Join(directory, "agentfield"))
+			t.Setenv("CODEAF_TELEMETRY", "off")
+			t.Setenv("OPENROUTER_API_KEY", tc.key)
+			t.Setenv("AGENTFIELD_HARNESS_PROVIDER", tc.envProvider)
+			if tc.legacy {
+				t.Setenv("AFORGE_BIN", "/fake/legacy")
+			}
+			codeAFConfigWarning = sync.Once{}
+			var output bytes.Buffer
+			cfg := Config{NodeID: "auth-test", Version: "1", Logger: log.New(&output, "", 0)}
+			if tc.configured {
+				cfg.HarnessConfig = &HarnessConfig{Provider: tc.provider}
+			}
+			for i := 0; i < 2; i++ {
+				_, err := New(cfg)
+				require.NoError(t, err)
+			}
+			expected := 0
+			if tc.warn {
+				expected = 1
+			}
+			assert.Equal(t, expected, strings.Count(output.String(), contract.Warning))
+		})
+	}
+}
```

**File**: `sdk/go/agent/harness_test.go` (modified, +6/-0)
```diff
@@ -115,6 +115,9 @@ func TestHarnessRunner_ConcurrentAccess(t *testing.T) {
 }
 
 func TestHarness_ErrorWithoutProvider(t *testing.T) {
+	t.Setenv("OPENROUTER_API_KEY", "test-codeaf-key")
+	t.Setenv("HOME", t.TempDir())
+	t.Setenv("AGENTFIELD_HOME", t.TempDir())
 	// With no provider configured, Harness() defaults to codeaf and reaches
 	// provider execution. A missing binary may fail, but provider resolution does not.
 	t.Setenv(harness.ProviderEnvVar, "")
@@ -211,6 +214,9 @@ func TestHarnessDoctor_UnknownProviderIsAnError(t *testing.T) {
 }
 
 func TestHarnessDefaultCodeAFRecordsUsage(t *testing.T) {
+	t.Setenv("OPENROUTER_API_KEY", "test-codeaf-key")
+	t.Setenv("HOME", t.TempDir())
+	t.Setenv("AFORGE_BIN", "")
 	t.Setenv(harness.ProviderEnvVar, "")
 	t.Setenv("AGENTFIELD_HOME", t.TempDir())
 	path := filepath.Join(t.TempDir(), "codeaf")
```

#### Recent Merged Pull Requests:
- **PR #1132** (2026-10-27): fix(sdk): log the CodeAF missing-key warning once, and count the harness config's env (@AbirAbbas)
- **PR #1131** (2026-10-27): chore(deps): bump certifi from 2026.2.25 to 2026.10.18 in /sdk/python in the uv group across 1 directory (@dependabot[bot])
- **PR #1130** (2026-10-26): fix(sdk): fail fast with a clear message when the CodeAF harness has no model key (@AbirAbbas)
- **PR #1128** (2026-10-24): Make CodeAF the default harness, installed automatically with AgentField (@AbirAbbas)
- **PR #1127** (2026-10-26): chore(deps): bump the uv group across 1 directory with 3 updates (@dependabot[bot])
- **PR #1126** (2026-10-26): fix(sdk/typescript): stop retrying permanent status callbacks (@ShryukGrandhi)

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

## X. control-plane): return 503 for transient storage errors during DID resolution (#

**RULE**:
When implementing operations in `control-plane/internal/server/middleware/did_auth.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Agent-Field/agentfield. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `7306a0eb`: control-plane): return 503 for transient storage errors during DID resolution (#1087) (#1124). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `control-plane/internal/server/middleware/did_auth.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	"errors"
	"github.com/Agent-Field/agentfield/control-plane/internal/services"
			if errors.Is(err, services.ErrDIDResolutionUnavailable) {
				logger.Logger.Warn().Err(err).Str("caller_did", callerDID).Msg("DID resolution temporarily unavailable")
				c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{
					"error":   "did_resolution_unavailable",
					"message": "DID resolution is temporarily unavailable, retry shortly",
				})
				return
			}
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `7306a0eb` are properly handled with clean fallback behavior.
