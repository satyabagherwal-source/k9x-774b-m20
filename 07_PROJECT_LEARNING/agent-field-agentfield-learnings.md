# Forensic Learning Record (Deep Inspection): Agent-Field/agentfield

> **Canonical Artifact**: `07_PROJECT_LEARNING/agent-field-agentfield-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Agent-Field/agentfield](https://github.com/Agent-Field/agentfield))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:15:08.167Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Agent-Field/agentfield`
- **Description**: Build, run and scale AI agents like API and microservices
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2605 stars

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

### Core Architecture Module: `control-plane/internal/core/services/package_service.go`
```
// agentfield/internal/core/services/package_service.go
package services

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/Agent-Field/agentfield/control-plane/internal/core/domain"
	"github.com/Agent-Field/agentfield/control-plane/internal/core/interfaces"
	"github.com/Agent-Field/agentfield/control-plane/internal/packages"
	"github.com/fatih/color"
	"gopkg.in/yaml.v3"
)

// DefaultPackageService implements the PackageService interface
type DefaultPackageService struct {
	registryStorage       interfaces.RegistryStorage
	fileSystem            interfaces.FileSystemAdapter
	agentfieldHome        string
	stopForReinstall      func(string) (packages.ReinstallState, error)
	restartAfterReinstall func(string, packages.ReinstallState) error
}

// NewPackageService creates a new package service instance
func NewPackageService(
	registryStorage interfaces.RegistryStorage,
	fileSystem interfaces.FileSystemAdapter,
	agentfieldHome string,
) interfaces.PackageService {
	return &DefaultPackageService{
		registryStorage: registryStorage,
		fileSystem:      fileSystem,
		agentfieldHome:  agentfieldHome,
	}
}

// InstallPackage installs a package from the given source
func (ps *DefaultPackageService) InstallPackage(source string, options domain.InstallOptions) error {
	_, err := ps.InstallPackageWithResult(source, options)
	return err
}

// InstallPackageWithResult installs a package and reports the package name
// selected by the installer. For superseded packages this is the final
// successor, including when it replaces an existing package under the same
// name.
func (ps *DefaultPackageService) InstallPackageWithResult(source string, options domain.InstallOptions) (string, error) {
	installedName, err := ps.installOne(source, options)
	if err != nil {
		return "", err
	}

	// The --path selector targets a subdirectory of THIS source only. Node
	// dependencies are their own installable sources, so never carry the selector
	// into recursive dependency installs.
	depOptions := options
	depOptions.Path = ""
	depOptions.ExpectedPackageName = ""
	depOptions.BeforeReplace = nil
	if err := ps.installNodeDependencies(installedName, depOptions, map[string]bool{installedName: true}); err != nil {
		return "", err
	}
	return installedName, nil
}

// installOne installs a single package from a git URL or local path.
func (ps *DefaultPackageService) installOne(source string, options domain.InstallOptions) (string, error) {
	// Check if it's a Git URL (GitHub, GitLab, Bitbucket, etc.)
	if packages.IsGitURL(source) {
		installer := &packages.GitInstaller{
			AgentFieldHome: ps.agentfieldHome,
			Verbose:        options.Verbose,
			Subdir:         options.Path,
			ExpectedName:   options.ExpectedPackageName,
			BeforeReplace:  options.BeforeReplace,
		}
		if err := installer.InstallFromGit(source, options.Force); err != nil {
			return "", err
		}
		return installer.InstalledName(), nil
	}

	// Handle local package installation
	return ps.installLocalPackageWithName(source, options.Path, options.Force, options.Verbose)
}

// installedNames returns the set of currently-installed package names.
func (ps *DefaultPackageService) installedNames() map[string]bool {
	names := map[string]bool{}
	registry, err := ps.loadRegistryDirect()
	if err != nil {
		return names
	}
	for name := range registry.Installed {
		names[name] = true
	}
	return names
}

// installNodeDependencies installs the node-to-node dependencies declared by
// packageName, recursively.
//
// `visited` holds every package this install pass has already walked, and it is
// what terminates a dependency cycle. The already-installed check below cannot
// do that on its own: it only knows a dependency's name for `af://registry/…`
// refs, and a forced install — which every update is — reinstalls whatever is
// already there. So a cycle expressed with bare git URLs or local paths has
// nothing else stopping it.
func (ps *DefaultPackageService) installNodeDependencies(packageName string, options domain.InstallOptions, visited map[string]bool) error {
	registry, err := ps.loadRegistryDirect()
	if err != nil {
		return nil // base install already succeeded; don't fail on dep discovery
	}

	for name, pkg := range registry.Installed {
		if name != packageName {
			continue
		}
		metadata, err := packages.ParsePackageMetadata(pkg.Path)
		if err != nil {
			continue
		}
		for _, dep := range metadata.Dependencies.Nodes {
			depSource, depName := resolveNodeRef(dep)
			if depName != "" && ps.isPackageInstalled(depName) {
				continue // already present — also handles cycles
			}
			fmt.Printf("\n%s Installing node dependency: %s\n", ps.blue("→"), dep)
			installedName, err := ps.installOne(depSource, options)
			if err != nil {
				fmt.Printf("%s Failed to install node dependency %s: %v\n", ps.statusError(), dep, err)
				continue
			}
			if visited[installedName] {
				continue // a cycle: this pass has already walked that package
			}
			visited[installedName] = true
			// Recurse for the dependency's own node deps.
			if err := ps.installNodeDependencies(installedName, options, visited); err != nil {
				return err
			}
		}
	}
	return nil
}

// resolveNodeRef maps a node dependency reference to an installable source and,
// when known, the resulting package name. Supported forms:
//
//	af://registry/<name>[@version]  -> https://github.com/Agent-Field/<name>
//	https://github.com/org/repo      -> used as-is
//	<git url> / <local path>         -> used as-is
func resolveNodeRef(ref string) (source string, name string) {
	const afPrefix = "af://registry/"
	if strings.HasPrefix(ref, afPrefix) {
		spec := strings.TrimPrefix(ref, afPrefix)
		if at := strings.Index(spec, "@"); at >= 0 {
			spec = spec[:at] // drop version constraint (not yet enforced)
		}
		spec = strings.TrimSuffix(spec, "/")
		return "https://github.com/Agent-Field/" + spec, spec
	}
	return ref, ""
}

// installLocalPackage installs a package from a local source path. When subdir is
// non-empty (the --path selector) the package root is resolved to
// <sourcePath>/<subdir>, which must contain an agentfield-package.yaml; that
// subdirectory is what gets validated, copied, and installed. Resolution happens
// before any copy or registry mutation, so a bad selector fails cleanly.
func (ps *DefaultPackageService) installLocalPackage(sourcePath string, subdir string, force bool, verbose bool) error {
	_, err := ps.installLocalPackageWithName(sourcePath, subdir, force, verbose)
	return err
}

func (ps *DefaultPackageService) installLocalPackageWithName(sourcePath string, subdir string, force bool, verbose bool) (string, error) {
	if strings.TrimSpace(subdir) != "" {
		resolved, err := packages.ResolvePackageSubdir(sourcePath, subdir)
		if err != nil {
			return "", err
		}
		sourcePath = resolved
	}

	// Get package name first for better messaging
	metadata, err := ps.parsePackageMetadata(sourcePath)
	if err != nil {
		return "", fmt.Errorf("failed to parse package metadata: %w", err)
	}

	fmt.Printf("Installing %s...\n", metadata.Name)

	// 1. Validate source package
	spinner := ps.newSpinner("Validating package structure")
	spinner.Start()
	if err := ps.validatePackage(sourcePath); err != nil {
		spinner.Error("Package validation failed")
		return "", fmt.Errorf("package validation failed: %w", err)
	}
	spinner.Success("Package structure validated")

	// 2. Check if already installed
	replacing := ps.isPackageInstalled(metadata.Name)
	if !force && replacing {
		return "", fmt.Errorf("package %s already installed (use --force to reinstall)", metadata.Name)
	}
	reinstallState := packages.ReinstallState{}
	if force && replacing {
		stop := ps.stopForReinstall
		if stop == nil {
			stop = func(name string) (packages.ReinstallState, error) {
				return packages.StopPackageForReinstall(context.Background(), ps.agentfieldHome, name)
			}
		}
		reinstallState, err = stop(metadata.Name)
		if err != nil {
			return "", fmt.Errorf("failed to stop %s before reinstall: %w", metadata.Name, err)
		}
	}

	// 3. Copy package to global location
	destPath := filepath.Join(ps.agentfieldHome, "packages", metadata.Name)
	spinner = ps.newSpinner("Setting up environment")
	spinner.Start()
	if err := ps.copyPackage(sourcePath, destPath); err != nil {
		spinner.Error("Failed to copy package")
		return "", fmt.Errorf("failed to copy package: %w", err)
	}
	spinner.Success("Environment configured")

	// 4. Install dependencies
	spinner = ps.newSpinner("Installing dependencies")
	spinner.Start()
	if err := ps.installDependencies(destPath, metadata); err != nil {
		spinner.Error("Failed to install dependencies")
		return "", fmt.Errorf("failed to install dependencies: %w", err)
	}
	spinner.Success("Dependencies installed")

	// 5. Update installation registry
	if err := ps.updateRegistry(metadata, sourcePath, destPath); err != nil {
		return "", fmt.Errorf("failed to update registry: %w", err)
	}
	if reinstallState.WasRunning {
		restart := ps.restartAfterReinstall
		if restart == nil {
			restart = func(name string, state packages.ReinstallState) error {
				return packages.RestartPackageAfterReinstall(ps.agentfieldHome, name, state)
			}
		}
		if err := restart(metadata.Name, reinstallState); err != nil {
			return "", fmt.Errorf("failed to restart %s after reinstall: %w", metadata.Name, err)
		}
	}

	fmt.Printf("%s Installed %s v%s\n", ps.green(ps.statusSuccess()), ps.bold(metadata.Name), ps.gray(metadata.Version))
	fmt.Printf("  %s %s\n", ps.gray("Location:"), destPath)

	// 6. Check for required environment variables and provide guidance
	ps.checkEnvironmentVariables(metadata)

	fmt.Printf("\n%s %s\n", ps.blue("→"), ps.bold(fmt.Sprintf("Run: af run %s", metadata.Name)))

	return metadata.Name, nil
}

// UninstallPackage removes an installed package
func (ps *DefaultPackageService) UninstallPackage(name string) error {
	return ps.uninstallPackage(name, false) // Default to non-force
}

// uninstallPackage remove
```

### Core Architecture Module: `control-plane/internal/core/services/server_url.go`
```
package services

import "os"

// resolveServerURL returns the control plane URL from env vars or default.
func resolveServerURL() string {
	if v := os.Getenv("AGENTFIELD_SERVER"); v != "" {
		return v
	}
	if v := os.Getenv("AGENTFIELD_SERVER_URL"); v != "" {
		return v
	}
	return "http://localhost:8080"
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1094** (2026-10-03): **test(sdk): verify Windows batch probe end-to-end and harden cmd.exe branch**
  *Symptoms*: Real Windows verification for `batchProbeInvocation` plus batch-path hardening. This supersedes the never-merged Windows test prepared for PR #1075, whose fix branch was overtaken by the environment-token template that landed on main in a different change.  ## Real Windows verification  A new win32-only end-to-end test in `sdk/typescript/tests/harness_doctor.test.ts`:  - Creates a directory whose name contains a space under the OS temp dir and writes a real `probe.cmd` inside it that echoes a unique marker, its own path, and its arguments. - Resolves the shim through `PATH`/`PATHEXT` using the actual `findExecutable` (via a `codex.cmd` shim that forwards to `probe.cmd`). - Calls `harnessDoctor`, which invokes `defaultVersionProbe`, exercising the real `batchProbeInvocation` path with the actual `execFile` (mock passthrough to `vi.importActual`, restored after) — so `cmd.exe` genuinely executes with `/d /v:off /s /c` and the fixed `%AGENTFIELD_PROBE_ARG_*%` token template. - Asserts the marker, the full spaced path, and the `--version` argument come back, and the health result is `usable: true` with no `version_probe_failed` issue. - Skipped on non-Windows hosts, so Linux CI is unaffected.  A narrow `windows-latest` Node 20 job in `.github/workflows/sdk-typescript.yml` runs only `tests/harness_doctor.test.ts` and is wired into the existing required-checks aggregate.  ## Batch-path hardening  - `defaultVersionProbe` batch and non-batch paths now use explicit, separate `execFile
  **Post-Mortem & Fix Analysis**:
  > ## Performance  | SDK | Memory | Δ | Latency | Δ | Tests | Status | |-----|--------|---|---------|---|-------|--------| | TS | 352 B | - | 1.57 µs | -21% | ✓ | ✓ |  ✓ No regressions detected 
  > ## 📊 Coverage gate  Thresholds from [`.coverage-gate.toml`](../../.coverage-gate.toml): per-surface ≥ **84%**, aggregate ≥ **85%**, max per-surface regression ≤ **1.0 pp**, max aggregate regression ≤ **0.50 pp**.  | Surface | Current | Baseline | Δ | | | --- | ---: | ---: | ---: | :---: | | `control-plane` | 87.90% | 87.40% | ↑ +0.50 pp | 🟡 | | `sdk-go` | 93.30% | 92.00% | ↑ +1.30 pp | 🟢 | | `sdk-python` | 94.72% | 93.73% | ↑ +0.99 pp | 🟢 | | `sdk-typescript` | 91.86% | 90.42% | ↑ +1.44 pp | 🟢 | | `web-ui` | 84.77% | 84.79% | ↓ -0.02 pp | 🟡 | | **aggregate** | **85.92%** | **85.75%** | **↑ +0.17 pp** | 🟡 |  ### ✅ Gate passed  No surface regressed past the allowed threshold and the aggregate stayed above the floor.  <!-- Sticky Pull Request Commentcoverage-gate -->
  > ## 📐 Patch coverage gate  Threshold: **80%** on lines this PR touches vs `origin/main` (from `.coverage-gate.toml:thresholds.min_patch`).  | Surface | Touched lines | Patch coverage | Status | | --- | ---: | ---: | :---: | | `control-plane` | 0 | — | ➖ no changes | | `sdk-go` | 0 | — | ➖ no changes | | `sdk-python` | 0 | — | ➖ no changes | | `sdk-typescript` | 17 | **88.00%** | ✅ | | `web-ui` | 0 | — | ➖ no changes |  ### ✅ Patch gate passed  Every surface whose lines were touched by this PR has patch coverage at or above the threshold.  <!-- Sticky Pull Request Commentpatch-coverage-gate -->

- **Issue #1075** (2026-09-29): **fix(sdk): probe harness binaries as argv, not a cmd.exe command string**
  *Symptoms*: Fixes CodeQL alerts 60, 61, 62 on `sdk/typescript/src/harness/availability.ts`, without opening #63 in their place.  ## What changed  `defaultVersionProbe` runs `<binary> --version` for `harnessDoctor()`. Node refuses to spawn `.cmd`/`.bat` without a shell (CVE-2024-27980), so on Windows those shims go through `cmd.exe`.  - **Original (main):** a quoted `cmd.exe /d /s /c ""<path>" "--version""` line. It was safe from injection, but it concatenated the resolved path into the command string, which is what CodeQL flagged. A `%VAR%` in a path was also expanded. - **Earlier heads of this PR:** `cmd.exe /d /c <path> --version` as separate argv elements. This cleared #60–#62 but raised #63, and it let cmd.exe re-parse the path. **A directory named `paren) & echo PWNED2 (x` ran the injected command.** Paths containing `&`, `^` or `;,=` failed the probe. - **Now (2a6ed6b0):** the `/c` line is a fixed template, `""%AGENTFIELD_PROBE_ARG_0%" "%AGENTFIELD_PROBE_ARG_1%""`. The path and args are set in the child's environment. cmd.exe expands each variable once, after it has split the line, so every metacharacter in the path stays literal. No path data reaches the command string. `/v:off` keeps `!` literal. The non-batch path (`execFile(bin, args)`) is unchanged.  ## Verification  Real `cmd.exe` (Windows 11 26200, Node 22.0.0), via each version's actual `harnessDoctor` bundled with esbuild, against a `.cmd` shim in each directory:  | shim directory | main | previous head 5711218 | this head
  **Post-Mortem & Fix Analysis**:
  > ## Performance  | SDK | Memory | Δ | Latency | Δ | Tests | Status | |-----|--------|---|---------|---|-------|--------| | TS | 346 B | -1% | 1.90 µs | -5% | ✓ | ✓ |  ✓ No regressions detected 
  > ## 📊 Coverage gate  Thresholds from [`.coverage-gate.toml`](../../.coverage-gate.toml): per-surface ≥ **84%**, aggregate ≥ **85%**, max per-surface regression ≤ **1.0 pp**, max aggregate regression ≤ **0.50 pp**.  | Surface | Current | Baseline | Δ | | | --- | ---: | ---: | ---: | :---: | | `control-plane` | 87.90% | 87.40% | ↑ +0.50 pp | 🟡 | | `sdk-go` | 93.30% | 92.00% | ↑ +1.30 pp | 🟢 | | `sdk-python` | 94.72% | 93.73% | ↑ +0.99 pp | 🟢 | | `sdk-typescript` | 91.84% | 90.42% | ↑ +1.42 pp | 🟢 | | `web-ui` | 84.76% | 84.79% | ↓ -0.03 pp | 🟡 | | **aggregate** | **85.92%** | **85.75%** | **↑ +0.17 pp** | 🟡 |  ### ✅ Gate passed  No surface regressed past the allowed threshold and the aggregate stayed above the floor.  <!-- Sticky Pull Request Commentcoverage-gate -->
  > ## 📐 Patch coverage gate  Threshold: **80%** on lines this PR touches vs `origin/main` (from `.coverage-gate.toml:thresholds.min_patch`).  | Surface | Touched lines | Patch coverage | Status | | --- | ---: | ---: | :---: | | `control-plane` | 0 | — | ➖ no changes | | `sdk-go` | 0 | — | ➖ no changes | | `sdk-python` | 0 | — | ➖ no changes | | `sdk-typescript` | 8 | **100.00%** | ✅ | | `web-ui` | 0 | — | ➖ no changes |  ### ✅ Patch gate passed  Every surface whose lines were touched by this PR has patch coverage at or above the threshold.  <!-- Sticky Pull Request Commentpatch-coverage-gate -->

- **Issue #1059** (2026-09-21): **Stale execution reaper times out a parent right after its child completes**
  *Symptoms*: ## Summary  The stale execution reaper can mark a running parent execution as timed out in the short gap between its child finishing and the parent reporting its own result. The parent's later success callback is then rejected with HTTP 409 because the execution is already terminal.  ## How it happens  1. A parent execution calls a child and waits. While it waits, the parent's own `updated_at` does not change. 2. `MarkStaleExecutions` and `MarkStaleWorkflowExecutions` skip a stale parent only while it has a child in `running`, `pending` or `queued` (plus `waiting` for workflows):    ```sql    AND NOT EXISTS (        SELECT 1 FROM executions c        WHERE c.parent_execution_id = e.execution_id          AND c.status IN ('running', 'pending', 'queued')    )    ``` 3. When the child posts `succeeded`, that guard disappears at once. Nothing refreshes the parent's activity time. 4. The parent needs some time, measured at roughly 50–600 ms, to receive the child result and post its own status. 5. If the cleanup tick lands in that window and the parent's `updated_at` is older than the stale threshold, the parent and its workflow are set to `timeout` with `execution timed out (no activity)`. 6. The parent's real `succeeded` callback gets a 409.  Code: `control-plane/internal/storage/execution_records.go`, `MarkStaleExecutions` and `MarkStaleWorkflowExecutions`.  #1046 (`78215f17`) doesn't cover this. That fix protects a workflow whose own execution activity clock advances. Here the pa
  **Post-Mortem & Fix Analysis**:
  > ## Triage  **Classification:** bug ✓ **Suggested labels:** bug  **Likely affected files:** - ./reasoners/webhook_router.py (matched: out, out, out, out) - ./.env.example (matched: example) - ./main.py (matched: main)  ---  _Triage by github-buddy_  <!-- github-buddy:triage:v1 -->
  > Hi. I would like to work on this. Is this issue available for me to pick up?

- **Issue #1047** (2026-09-19): **bug: workflow stale-sweeper reaps active executions on a frozen clock**
  *Symptoms*: ## Report  The workflow cleanup query reads `workflow_executions.updated_at`, while heartbeat and status writes update `executions.updated_at`. During a leaf wait, the execution timestamp moves and the workflow timestamp stays old. The cleanup query can therefore reap a workflow whose paired execution is still active.  We saw this in four coder runs. Each was reaped 10 to 13 minutes after starting on a 10-minute fuse. Heartbeats were arriving every 90 seconds. One run was reaped 57 seconds after its latest heartbeat. File commits continued after the reap, and the late completion updates returned HTTP 409 because the records were already terminal.  [#1040](https://github.com/Agent-Field/agentfield/issues/1040) is related, but the cause differs. That issue involved timezone comparison. This issue involves the workflow timestamp remaining unchanged during a leaf wait.  ## Proposed change  When a workflow has a paired active execution, require both activity timestamps to be older than the stale cutoff before reaping it. Recent activity on either row should keep the workflow alive. A workflow with no paired active execution should retain the existing cleanup behavior.  ## Working implementation  [#1046](https://github.com/Agent-Field/agentfield/pull/1046) implements the query-side version of this proposal. It joins the workflow row to its paired active execution, compares both `COALESCE` activity timestamps with the cutoff, and keeps the existing terminal-state synchronization.  T
  **Post-Mortem & Fix Analysis**:
  > ## Triage  **Classification:** bug ✓ **Suggested labels:** bug  **Likely affected files:** - ./reasoners/helpers.py (matched: per)  ---  _Triage by github-buddy_  <!-- github-buddy:triage:v1 -->
  > Fixed and merged upstream, closing this.  - #1046 changes the workflow reaper to consult the execution activity clock instead of the frozen workflow timestamp. - #1051, merged 2026-09-18, rebinds the transactional prepares and guards the stale retry path. - #1062, merged 2026-09-19, mirrors the reaper parent/child and approval guards into the retry path.  The four reaped coder runs in the report were 10 to 13 minutes into a 10 minute fuse with heartbeats arriving every 90 seconds, which is the frozen-clock path #1046 removes. Reopen if the same pattern shows up on a current build.

- **Issue #1040** (2026-09-06): **[Control Plane] SQLite cleanup can time out fresh executions with non-UTC timestamps**
  *Symptoms*:    ## Summary     When AgentField uses local SQLite storage on a host with a non-UTC timezone, the execution-cleanup reaper can mark a fresh, active execution as timed out.     The affected rows contain timestamps with a local timezone offset, while the cleanup cutoff is generated in  UTC. SQLite can compare these timestamp values lexicographically as text instead of comparing the represented  instants.     ## Observed behavior     A disposable SWE-AF planning run on AgentField `v0.1.138-rc.9` was marked with:     ```text    execution timed out (no activity)  ```   The configured stale timeout was 30 minutes, but the execution was marked timed out approximately 108 seconds  after it started. Later successful status callbacks were rejected with HTTP 409 because the execution had already  become terminal.   Example values from the affected path:   ```text    stored updated_at: 2026-09-03 06:52:18.193275-05:00    UTC equivalent:    2026-09-03 11:52:18.193275Z    cleanup cutoff:    2026-09-03 11:24:05+00:00  ```   The stored timestamp is newer than the cutoff by instant, so it should not be considered stale. However, the  textual comparison evaluates incorrectly:   ```sql    SELECT      '2026-09-03 06:52:18.193275-05:00'      <=      '2026-09-03 11:24:05+00:00';    -- 1     SELECT      julianday('2026-09-03 06:52:18.193275-05:00')      <=      julianday('2026-09-03 11:24:05+00:00');    -- 0  ```   ## Likely cause   The stale-selection queries use:   ```sql    COALESCE(updated_at,
  **Post-Mortem & Fix Analysis**:
  > ## Triage  **Classification:** bug ✓ **Suggested labels:** bug  **Likely affected files:** - ./reasoners/webhook_router.py (matched: out, out, out, out, reasoner) - ./.env.example (matched: example) - ./reasoners/models.py (matched: reasoner) - ./reasoners/__init__.py (matched: reasoner) - ./reasoners/conversational.py (matched: reasoner)  ---  _Triage by github-buddy_  <!-- github-buddy:triage:v1 -->

- **Issue #1034** (2026-09-09): **[Python SDK] Trouble with cross agent pydantic (un)marshalling**
  *Symptoms*: ## Describe the bug  <!-- A clear and concise description of what the bug is. --> Sometimes complex pydantic models in reasoners and skills and multiple arguments can cause the inputs paramters to become a simple `dict`, forcing pydantic model coercion.   And a side note: sometimes the parameters being put inside `TYPE_CHECK` blocks also builds properly but crash during deployment.   ## Steps to reproduce  Using parameters like:   - `item: PydanticModel1 | PydanticModel2 | None = None` - `items: list[PydanticModel1] | list[PydanticModel2] | None = None` - `maybe_empty_sequence: Sequence[PydanticModel1 | None] = []`  In most cases, those fall through and crash during runtime. Nested JSON under the `input` can cause this as well.   Using the new RUFF 0.16 UP rules might have to do with this since it prefers using `list[model] | None` instead of `Optional[List[model]]` on newer python versions  ## Expected behavior  <!-- Describe what you expected to happen. --> Inputs and outputs always recursively validate if they are a pydantic model, inputs are ensured to be an instance of the model / dataclass. Outputs survives roundrip losslessly    ## Screenshots / Logs  <!-- If applicable, add screenshots or logs to help explain the problem. -->  ## Environment  - Control plane version: 0.1.127 - SDK version (if applicable): 0.1.130 - Deployment environment (local, docker, kubernetes, etc.):  ## Additional context  <!-- Add any other context about the problem here. --> Another side note:
  **Post-Mortem & Fix Analysis**:
  > ## Triage  **Classification:** bug ✓ **Suggested labels:** bug  **Likely affected files:** - ./reasoners/models.py (matched: models, reasoners, model, model, model) - ./reasoners/helpers.py (matched: reasoners, help) - ./cla-signatures.json (matched: json) - ./reasoners/__init__.py (matched: reasoners) - ./reasoners/conversational.py (matched: reasoners)  ---  _Triage by github-buddy_  <!-- github-buddy:triage:v1 -->

- **Issue #987** (2026-09-21): **[Control Plane] Kubernetes new deployments causes every in-flight run to fail and never recover**
  *Symptoms*: ## Describe the bug  <!-- A clear and concise description of what the bug is. --> When there's a reasoner that is acting like an orchestrator, and can take 5-10 minutes to complete, it has a high chance of destroying the entire run (which is composed by multiple reasoners and skills) with the "in-flight reasoner cannot be revived" error.  The only workaround is to re-run the same entrypoint reasoner with the same inputs and start again. Happily, when this is done, the run will blast through until the step where it got killed due the persisted intermediary steps and the 1h cache that is enabled.  ## Steps to reproduce  1. Go to '...' 2. Run '...' 3. See error  ## Expected behavior  <!-- Describe what you expected to happen. -->  When a reasoner or skill gets killed, there should be a way to restart the root run, keeping the same execution ID so the external consumers don't need to implement any sort of retries or re-submission.  It's a trade-off for the immutability and deterministic behavior that is expected when you call the same reasoner with the same input, but generates different execution / run IDS, should be an opt-in flag  ## Screenshots / Logs  <!-- If applicable, add screenshots or logs to help explain the problem. -->  ## Environment  - Control plane version: 0.1.127 - SDK version (if applicable): Python SDK - Deployment environment (local, docker, kubernetes, etc.): Kubernetes  ## Additional context  <!-- Add any other context about the problem here. --> 
  **Post-Mortem & Fix Analysis**:
  > ## Triage  **Classification:** bug ✓ **Suggested labels:** bug  **Likely affected files:** - ./reasoners/helpers.py (matched: reasoner, reasoners, reasoner, reasoner, reasoner, reasoner, help) - ./reasoners/models.py (matched: reasoner, reasoners, reasoner, reasoner, reasoner, reasoner) - ./reasoners/__init__.py (matched: reasoner, reasoners, reasoner, reasoner, reasoner, reasoner) - ./reasoners/conversational.py (matched: reasoner, reasoners, reasoner, reasoner, reasoner, reasoner) - ./reasoners/repo_config.py (matched: reasoner, reasoners, reasoner, reasoner, reasoner, reasoner)  ---  _Triage by github-buddy_  <!-- github-buddy:triage:v1 -->
  > Where this stands after v0.1.137 (released yesterday):  The root cause is fixed. Re-registration used to synchronously fail every non-terminal execution for the agent id, so under `maxSurge` the new pod killed the old pod's still-running work. Now executions carry the `instance_id` that dispatched them, the reap is scoped to the departing instance and deferred by `AGENTFIELD_AGENT_DRAIN_GRACE` (default 60s) — a completion arriving inside that window wins — and dispatch to a pod that just announced shutdown is held for `AGENTFIELD_AGENT_RESTART_GRACE` and retried on the replacement instead of 503ing (#1004). All three SDKs drain in-flight reasoners under `AGENTFIELD_SHUTDOWN_TIMEOUT` (#1000, #1006), and `af server` itself drains on SIGTERM (#1010, #1011).  Two things you need to set for 5–10 minute orchestrators, because the defaults are sized for short reasoners: - `AGENTFIELD_AGENT_DRAIN_GRACE` ≥ the longest reasoner you want to protect (e.g. `15m`). The reap fires that long after the
  > Yes agree on all 3 @AbirAbbas GTG 

- **Issue #986** (2026-09-21): **[Control Plane] Execution queue doesn't behave like a queue**
  *Symptoms*: ## Describe the bug  <!-- A clear and concise description of what the bug is. -->  When the max parallel executions are reached, any new exec async request will hard fail instead of returning an execution ID and queueing it to be executed. This forces to use an external queueing solution (Redis / Durable) just for making sure a burst of 300 requests don't bring everything down, which happens quite often and the AF CP get's killed and the pod is evicted then restarted.  ## Steps to reproduce  1. Go to '...' 2. Run '...' 3. See error  ## Expected behavior  <!-- Describe what you expected to happen. -->  ## Screenshots / Logs  <!-- If applicable, add screenshots or logs to help explain the problem. -->  ## Environment  - Control plane version: 0.1.127 - SDK version (if applicable): - Deployment environment (local, docker, kubernetes, etc.): Kubernetes  ## Additional context  <!-- Add any other context about the problem here. --> 
  **Post-Mortem & Fix Analysis**:
  > ## Triage  **Classification:** bug ✓ **Suggested labels:** bug  **Likely affected files:** - ./reasoners/helpers.py (matched: help)  ---  _Triage by github-buddy_  <!-- github-buddy:triage:v1 -->
  > Shipping state, then the design question.  v0.1.137 (#1001) fixes the part that was making bursts destructive: a rejected async execute no longer writes anything — the per-agent gate and the queue check run before the payload blob and the two execution rows — 429 and 503 carry `Retry-After` plus a `retry_after` field, the async pool drains on shutdown (queued and in-flight jobs get a terminal `control_plane_shutdown` instead of staying `running` forever), and workers default to `max(NumCPU, 16)` with a 1024-deep queue, so ~1040 async executions are admitted before the first 503 — a much larger window than 0.1.127 had. Knobs: `AGENTFIELD_EXEC_ASYNC_WORKERS`, `AGENTFIELD_EXEC_ASYNC_QUEUE_CAPACITY`, `AGENTFIELD_MAX_EXECUTE_BODY_BYTES`. One thing worth setting now: `AGENTFIELD_MAX_CONCURRENT_PER_AGENT` (default 0 = unlimited), because with it unset the burst lands in your agent pod rather than at the control plane.  #1033 finishes the contract: the sync, restart and MCP lanes also gate bef
  > @pocesar Thanks !   Yes, I would prioritize bounded rejections first as immediate work and lets add a milestone for queue, actually potentially letting us even add priority and other scheduling ideas in modular way to control at constrained time which gets pulled in. @AbirAbbas can you scope a rough milestone for this? 

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

### Incident Patch 1: `5df74966` (2026-10-01)
**Commit Message**: fix(events): cache non-duplicate status events so A→B→A flips are not dropped (#1079)

**File**: `control-plane/internal/events/node_events.go` (modified, +24/-6)
```diff
@@ -263,6 +263,10 @@ func (bus *NodeEventBus) shouldFilterEvent(event NodeEvent) bool {
 	return false
 }
 
+// nodePresenceCacheKey is the deduplication cache key prefix shared by
+// NodeOnline and NodeOffline events.
+const nodePresenceCacheKey = "node_presence"
+
 // lastEventCache stores recent events for deduplication
 var lastEventCache = make(map[string]NodeEvent)
 var lastEventCacheMutex sync.RWMutex
@@ -283,8 +287,13 @@ func (bus *NodeEventBus) isDuplicateStatusEvent(event NodeEvent) bool {
 		return false
 	}
 
-	// Create cache key
+	// Create cache key. Online and offline share one key per node, so going
+	// offline and back online inside the window is compared against the
+	// offline event rather than the earlier online one.
 	cacheKey := fmt.Sprintf("%s:%s", event.Type, event.NodeID)
+	if event.Type == NodeOnline || event.Type == NodeOffline {
+		cacheKey = fmt.Sprintf("%s:%s", nodePresenceCacheKey, event.NodeID)
+	}
 
 	lastEventCacheMutex.Lock()
 	defer lastEventCacheMutex.Unlock()
@@ -293,15 +302,24 @@ func (bus *NodeEventBus) isDuplicateStatusEvent(event NodeEvent) bool {
 	if lastEvent, exists := lastEventCache[cacheKey]; exists {
 		// Check if events are too close in time (within 1 second)
 		if time.Since(lastEvent.Timestamp) < 1*time.Second {
-			// For status events, also check if the actual status changed
-			if event.Type == NodeUnifiedStatusChanged || event.Type == NodeStatusUpdated || event.Type == NodeHealthChanged {
-				return bus.compareStatusEventData(lastEvent, event)
+			switch event.Type {
+			case NodeUnifiedStatusChanged, NodeStatusUpdated, NodeHealthChanged:
+				// For status events, also check if the actual status changed
+				if bus.compareStatusEventData(lastEvent, event) {
+					return true
+				}
+			case NodeOnline, NodeOffline:
+				if lastEvent.Type == event.Type {
+					return true
+				}
+			default:
+				return true // Other events are considered duplicates if within 1 second
 			}
-			return true // Other events are considered duplicates if within 1 second
 		}
 	}
 
-	// Cache this event
+	// Cache this event, including a changed status inside the window, so the
+	// next event is compared against the status subscribers last received.
 	lastEventCache[cacheKey] = event
 
 	// Clean up old cache entries (keep only last 50 per event type)
```

**File**: `control-plane/internal/events/node_events_dedupe_test.go` (modified, +67/-0)
```diff
@@ -151,6 +151,73 @@ func TestNodeEventBusDuplicateStatusEvent(t *testing.T) {
 	})
 }
 
+func TestNodeEventBusDuplicateStatusEventFlipBack(t *testing.T) {
+	// A status that flips and flips back inside the window must not be
+	// compared against the first status, or the flip back is dropped and
+	// subscribers are left on the intermediate status.
+	for _, eventType := range []NodeEventType{NodeStatusUpdated, NodeHealthChanged} {
+		t.Run(string(eventType), func(t *testing.T) {
+			resetNodeEventTestState(t)
+			bus := GlobalNodeEventBus
+
+			for _, status := range []string{"active", "inactive", "active"} {
+				event := NodeEvent{Type: eventType, NodeID: "node-flip", Status: status, Timestamp: time.Now()}
+				require.False(t, bus.isDuplicateStatusEvent(event), "status %q was filtered", status)
+			}
+
+			repeat := NodeEvent{Type: eventType, NodeID: "node-flip", Status: "active", Timestamp: time.Now()}
+			require.True(t, bus.isDuplicateStatusEvent(repeat))
+		})
+	}
+
+	t.Run("online and offline", func(t *testing.T) {
+		resetNodeEventTestState(t)
+		bus := GlobalNodeEventBus
+
+		for _, eventType := range []NodeEventType{NodeOnline, NodeOffline, NodeOnline} {
+			event := NodeEvent{Type: eventType, NodeID: "node-flip", Timestamp: time.Now()}
+			require.False(t, bus.isDuplicateStatusEvent(event), "%s was filtered", eventType)
+		}
+
+		repeat := NodeEvent{Type: NodeOnline, NodeID: "node-flip", Timestamp: time.Now()}
+		require.True(t, bus.isDuplicateStatusEvent(repeat))
+	})
+
+	t.Run("other status events keep the one second window", func(t *testing.T) {
+		resetNodeEventTestState(t)
+		bus := GlobalNodeEventBus
+
+		first := NodeEvent{Type: NodeStateTransition, NodeID: "node-flip", Status: "running", Timestamp: time.Now()}
+		require.False(t, bus.isDuplicateStatusEvent(first))
+
+		second := first
+		second.Timestamp = time.Now()
+		require.True(t, bus.isDuplicateStatusEvent(second))
+	})
+}
+
+func TestPublishDeliversOnlineAfterQuickOfflineFlap(t *testing.T) {
+	resetNodeEventTestState(t)
+
+	ch := GlobalNodeEventBus.Subscribe("flap-test")
+	defer GlobalNodeEventBus.Unsubscribe("flap-test")
+
+	PublishNodeOnline("node-flap", nil)
+	PublishNodeHealthChanged("node-flap", "active", nil)
+	PublishNodeOffline("node-flap", nil)
+	PublishNodeHealthChanged("node-flap", "inactive", nil)
+	PublishNodeOnline("node-flap", nil)
+	PublishNodeHealthChanged("node-flap", "active", nil)
+
+	var got []string
+	for i := 0; i < 6; i++ {
+		event := receiveNodeEvent(t, ch)
+		got = append(got, string(event.Type)+":"+event.Status)
+	}
+	require.Equal(t, "node_online:online", got[4], got)
+	require.Equal(t, "node_health_changed:active", got[5], got)
+}
+
 func TestNodeEventBusCleanupEventCache(t *testing.T) {
 	resetNodeEventTestState(t)
 
```

---

### Incident Patch 2: `4a87b1ca` (2026-10-01)
**Commit Message**: fix(sdk/go): stop retrying execution status callbacks on non-retryable 4xx (#1081)

**File**: `sdk/go/agent/agent.go` (modified, +7/-0)
```diff
@@ -1801,6 +1801,13 @@ func (a *Agent) postExecutionStatus(ctx context.Context, callbackURL string, pay
 				return nil
 			}
 			lastErr = fmt.Errorf("status update returned %d", resp.StatusCode)
+			if !isTransientPollStatus(resp.StatusCode) {
+				// A client error such as 404 (unknown execution) or 409
+				// (terminal status conflict) will not change on a resend,
+				// so fail fast instead of backing off.
+				cancel()
+				return lastErr
+			}
 		}
 		cancel()
 		if attempt < 4 {
```

**File**: `sdk/go/agent/post_execution_status_test.go` (added, +76/-0)
```diff
@@ -0,0 +1,76 @@
+package agent
+
+import (
+	"context"
+	"fmt"
+	"io"
+	"log"
+	"net/http"
+	"net/http/httptest"
+	"sync/atomic"
+	"testing"
+	"time"
+
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+)
+
+func newStatusCallbackAgent(client *http.Client) *Agent {
+	return &Agent{
+		cfg:        Config{Token: "token-123"},
+		httpClient: client,
+		logger:     log.New(io.Discard, "", 0),
+	}
+}
+
+func TestPostExecutionStatusDoesNotRetryNonRetryableClientErrors(t *testing.T) {
+	// The control plane answers 400 for a bad payload, 404 for an unknown
+	// execution and 409 for a conflicting terminal status. Sending the same
+	// callback again cannot succeed, so it must fail after one attempt instead
+	// of retrying for about 15s.
+	for _, code := range []int{
+		http.StatusBadRequest,
+		http.StatusUnauthorized,
+		http.StatusForbidden,
+		http.StatusNotFound,
+		http.StatusConflict,
+	} {
+		t.Run(fmt.Sprint(code), func(t *testing.T) {
+			var attempts atomic.Int32
+			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+				attempts.Add(1)
+				http.Error(w, http.StatusText(code), code)
+			}))
+			defer server.Close()
+
+			start := time.Now()
+			err := newStatusCallbackAgent(server.Client()).postExecutionStatus(context.Background(), server.URL, []byte(`{"status":"succeeded"}`))
+
+			require.Error(t, err)
+			assert.Contains(t, err.Error(), fmt.Sprint(code))
+			assert.Equal(t, int32(1), attempts.Load())
+			assert.Less(t, time.Since(start), 500*time.Millisecond)
+		})
+	}
+}
+
+func TestPostExecutionStatusRetriesTransientClientErrors(t *testing.T) {
+	for _, code := range []int{http.StatusRequestTimeout, http.StatusTooManyRequests} {
+		t.Run(fmt.Sprint(code), func(t *testing.T) {
+			var attempts atomic.Int32
+			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+				if attempts.Add(1) == 1 {
+					http.Error(w, http.StatusText(code), code)
+					return
+				}
+				w.WriteHeader(http.StatusNoContent)
+			}))
+			defer server.Close()
+
+			err := newStatusCallbackAgent(server.Client()).postExecutionStatus(context.Background(), server.URL, []byte(`{"status":"succeeded"}`))
+
+			require.NoError(t, err)
+			assert.Equal(t, int32(2), attempts.Load())
+		})
+	}
+}
```

---

### Incident Patch 3: `e447e0b2` (2026-10-01)
**Commit Message**: fix(control-plane): return 404 for status callbacks on unknown executions (#1080)

**File**: `control-plane/internal/handlers/execute.go` (modified, +10/-1)
```diff
@@ -634,6 +634,11 @@ func (c *executionController) handleBatchStatus(ctx *gin.Context) {
 // like a server fault.
 var errTerminalStatusConflict = errors.New("terminal status conflict")
 
+// errExecutionNotFound marks a callback for an execution the store does not
+// have. Storage hands the updater a nil execution rather than an error for an
+// unknown ID, so the handler relies on this to answer 404 instead of 500.
+var errExecutionNotFound = errors.New("execution not found")
+
 func (c *executionController) handleStatusUpdate(ctx *gin.Context) {
 	reqCtx := ctx.Request.Context()
 	executionID := ctx.Param("execution_id")
@@ -675,7 +680,7 @@ func (c *executionController) handleStatusUpdate(ctx *gin.Context) {
 	updated, err := c.store.UpdateExecutionRecord(reqCtx, executionID, func(current *types.Execution) (*types.Execution, error) {
 		terminalNoop = false
 		if current == nil {
-			return nil, fmt.Errorf("execution %s not found", executionID)
+			return nil, fmt.Errorf("execution %s: %w", executionID, errExecutionNotFound)
 		}
 
 		// Guard: executions in "waiting" state can only transition to
@@ -792,6 +797,10 @@ func (c *executionController) handleStatusUpdate(ctx *gin.Context) {
 			ctx.JSON(http.StatusConflict, gin.H{"error": fmt.Sprintf("failed to update execution: %v", err)})
 			return
 		}
+		if errors.Is(err, errExecutionNotFound) {
+			ctx.JSON(http.StatusNotFound, gin.H{"error": "execution not found"})
+			return
+		}
 		ctx.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to update execution: %v", err)})
 		return
 	}
```

**File**: `control-plane/internal/handlers/execute_status_update_test.go` (modified, +22/-0)
```diff
@@ -372,6 +372,28 @@ func TestUpdateExecutionStatusHandler_NotFound(t *testing.T) {
 	}
 }
 
+func TestUpdateExecutionStatusHandler_UnknownExecutionIsNotFoundWithLocalStorage(t *testing.T) {
+	gin.SetMode(gin.TestMode)
+	// The real storage hands the updater a nil execution for an unknown ID
+	// instead of returning an error, so this goes through the same path as a
+	// deployed control plane.
+	store, _ := setupTestStorage(t)
+	payloads := services.NewFilePayloadStore(t.TempDir())
+
+	router := gin.New()
+	router.PUT("/api/v1/executions/:execution_id/status", UpdateExecutionStatusHandler(store, payloads, nil, 90*time.Second))
+
+	req := httptest.NewRequest(http.MethodPut, "/api/v1/executions/exec-does-not-exist/status", strings.NewReader(`{"status": "succeeded"}`))
+	req.Header.Set("Content-Type", "application/json")
+	resp := httptest.NewRecorder()
+	router.ServeHTTP(resp, req)
+
+	require.Equal(t, http.StatusNotFound, resp.Code, resp.Body.String())
+	var errorResp map[string]interface{}
+	require.NoError(t, json.Unmarshal(resp.Body.Bytes(), &errorResp))
+	require.Contains(t, strings.ToLower(errorResp["error"].(string)), "not found")
+}
+
 func TestUpdateExecutionStatusHandler_ProgressUpdate(t *testing.T) {
 	gin.SetMode(gin.TestMode)
 
```

---

### Incident Patch 4: `e960677b` (2026-10-01)
**Commit Message**: fix(sdk/python): parse AGENTFIELD_ASYNC boolean flags with the repo's env vocabulary (#1082)

AsyncConfig.from_environment() read all five boolean feature flags with
`lambda x: x.lower() == "true"`. Four of those fields default to True, so the
only values that could be expressed were "true" and "false": setting
AGENTFIELD_ASYNC_ENABLE_RESULT_CACHING=1 -- or =yes, or =on -- evaluated to
False and silently disabled result caching, the opposite of what the value says.
The same inversion applied to enable_async_execution, enable_batch_polling and
fallback_to_sync, and it reaches users by default because both Agent (agent.py:846)
and AgentFieldClient (client.py:182) build their async_config from
from_environment() when none is passed.

The lambda also never raises, so get_env_var's `except (ValueError, TypeError):
return default_value` fallback is unreachable for booleans and an unparseable
value overrides the field with False instead of leaving the default. PR #714,
which wired this into the client default, documents the intended contract:
from_environment() "only overrides fields when the corresponding env var is set
(falling back to the default on unparseable values)".

Use the vocab

**File**: `sdk/python/agentfield/async_config.py` (modified, +26/-5)
```diff
@@ -8,6 +8,23 @@
 from dataclasses import dataclass
 import os
 
+# Default-on flags opt out with a falsey value, matching log_writer._queue_enabled,
+# logger._stdout_mirror_enabled, node_logs.logs_enabled and
+# openrouter_attribution.attribution_enabled. Default-off flags opt in with a truthy
+# one, matching litellm_observability._TRUE_VALUES. Either way a value outside the
+# vocabulary leaves the field at its default, which is what from_environment()
+# promises for unparseable input.
+_FALSE_VALUES = ("0", "false", "no", "off")
+_TRUE_VALUES = ("1", "true", "yes", "on")
+
+
+def _env_flag_default_on(value: str) -> bool:
+    return value.strip().lower() not in _FALSE_VALUES
+
+
+def _env_flag_default_off(value: str) -> bool:
+    return value.strip().lower() in _TRUE_VALUES
+
 
 @dataclass
 class AsyncConfig:
@@ -97,6 +114,10 @@ def from_environment(cls) -> "AsyncConfig":
         - AGENTFIELD_ASYNC_MAX_EXECUTION_TIMEOUT=1800
         - AGENTFIELD_ASYNC_BATCH_SIZE=50
 
+        Boolean flags take the usual shell vocabulary: a flag that defaults to
+        true is turned off with 0/false/no/off, and one that defaults to false is
+        turned on with 1/true/yes/on. Any other value leaves the default in place.
+
         Returns:
             AsyncConfig instance with values from environment variables
         """
@@ -163,25 +184,25 @@ def get_env_var(name: str, default_value, converter=None):
         config.enable_async_execution = get_env_var(
             "enable_async_execution",
             config.enable_async_execution,
-            lambda x: x.lower() == "true",
+            _env_flag_default_on,
         )
         config.enable_batch_polling = get_env_var(
             "enable_batch_polling",
             config.enable_batch_polling,
-            lambda x: x.lower() == "true",
+            _env_flag_default_on,
         )
         config.enable_result_caching = get_env_var(
             "enable_result_caching",
             config.enable_result_caching,
-            lambda x: x.lower() == "true",
+            _env_flag_default_on,
         )
         config.fallback_to_sync = get_env_var(
-            "fallback_to_sync", config.fallback_to_sync, lambda x: x.lower() == "true"
+            "fallback_to_sync", config.fallback_to_sync, _env_flag_default_on
         )
         config.enable_event_stream = get_env_var(
             "enable_event_stream",
             config.enable_event_stream,
-            lambda x: x.lower() == "true",
+            _env_flag_default_off,
         )
         config.event_stream_path = get_env_var(
             "event_stream_path", config.event_stream_path
```

**File**: `sdk/python/tests/test_async_config.py` (modified, +87/-0)
```diff
@@ -1,3 +1,5 @@
+import pytest
+
 from agentfield.async_config import AsyncConfig
 from agentfield.client import AgentFieldClient
 
@@ -70,3 +72,88 @@ def test_client_keeps_explicit_async_config(monkeypatch):
     client = AgentFieldClient(async_config=explicit_config)
 
     assert client.async_config is explicit_config
+
+
+# The four flags below default to True, so an environment variable has to be able
+# to turn them *off*. The package already settles this shape for default-on env
+# flags: log_writer._queue_enabled, logger._stdout_mirror_enabled,
+# node_logs.logs_enabled and openrouter_attribution.attribution_enabled all treat
+# ("0", "false", "no", "off") as the opt-out vocabulary and everything else as
+# "keep the default".
+DEFAULT_ON_FLAGS = [
+    ("AGENTFIELD_ASYNC_ENABLE_ASYNC_EXECUTION", "enable_async_execution"),
+    ("AGENTFIELD_ASYNC_ENABLE_BATCH_POLLING", "enable_batch_polling"),
+    ("AGENTFIELD_ASYNC_ENABLE_RESULT_CACHING", "enable_result_caching"),
+    ("AGENTFIELD_ASYNC_FALLBACK_TO_SYNC", "fallback_to_sync"),
+]
+
+TRUTHY_VALUES = ["1", "true", "TRUE", "yes", "on", " true "]
+FALSEY_VALUES = ["0", "false", "FALSE", "no", "off", " false "]
+UNPARSEABLE_VALUES = ["maybe", "", "2"]
+
+EVENT_STREAM_ENV = "AGENTFIELD_ASYNC_ENABLE_EVENT_STREAM"
+
+
+@pytest.mark.parametrize("env_name,field", DEFAULT_ON_FLAGS)
+@pytest.mark.parametrize("value", TRUTHY_VALUES)
+def test_default_on_flag_accepts_conventional_truthy_values(
+    monkeypatch, env_name, field, value
+):
+    """`=1`/`=yes`/`=on` must not silently disable a default-on feature."""
+    monkeypatch.setenv(env_name, value)
+
+    assert getattr(AsyncConfig.from_environment(), field) is True
+
+
+@pytest.mark.parametrize("env_name,field", DEFAULT_ON_FLAGS)
+@pytest.mark.parametrize("value", FALSEY_VALUES)
+def test_default_on_flag_still_opts_out(monkeypatch, env_name, field, value):
+    """The opt-out vocabulary that already works keeps working."""
+    monkeypatch.setenv(env_name, value)
+
+    assert getattr(AsyncConfig.from_environment(), field) is False
+
+
+@pytest.mark.parametrize("env_name,field", DEFAULT_ON_FLAGS)
+@pytest.mark.parametrize("value", UNPARSEABLE_VALUES)
+def test_default_on_flag_falls_back_to_default_when_unparseable(
+    monkeypatch, env_name, field, value
+):
+    """A value that means nothing must leave the field at its default.
+
+    This is the contract PR #714 states for from_environment(): it "only
+    overrides fields when the corresponding env var is set (falling back to the
+    default on unparseable values)". The float and int converters honour that
+    through get_env_var's except clause; a boolean converter that never raises
+    has to honour it through its vocabulary instead.
+    """
+    monkeypatch.setenv(env_name, value)
+
+    expected = getattr(AsyncConfig(), field)
+    assert getattr(AsyncConfig.from_environment(), field) is expected
+
+
+@pytest.mark.parametrize("value", TRUTHY_VALUES)
+def test_event_stream_opts_in_with_truthy_values(monkeypatch, value):
+    """enable_event_stream defaults to False, so it needs the opt-in vocabulary."""
+    monkeypatch.setenv(EVENT_STREAM_ENV, value)
+
+    assert AsyncConfig.from_environment().enable_event_stream is True
+
+
+@pytest.mark.parametrize("value", FALSEY_VALUES + UNPARSEABLE_VALUES)
+def test_event_stream_stays_off_for_falsey_or_unparseable(monkeypatch, value):
+    monkeypatch.setenv(EVENT_STREAM_ENV, value)
+
+    assert AsyncConfig.from_environment().enable_event_stream is False
+
+
+def test_boolean_env_flags_reach_the_client_default(monkeypatch):
+    """The public path: AgentFieldClient() with no explicit async_config."""
+    monkeypatch.setenv("AGENTFIELD_ASYNC_ENABLE_RESULT_CACHING", "1")
+    monkeypatch.setenv("AGENTFIELD_ASYNC_ENABLE_EVENT_STREAM", "yes")
+
+    client = AgentFieldClient()
+
+    assert client.async_config.enable_result_caching is True
+    assert client.async_config.enable_event_stream is True
```

---

### Incident Patch 5: `b675e2d4` (2026-10-01)
**Commit Message**: fix(sdk/python): keep rate limiter jitter off the global random state (#1078)

_calculate_backoff_delay called random.seed(self._container_seed + attempt)
before drawing jitter, which reseeds the module-level generator shared by the
whole host process. Every rate-limit retry therefore reset the application's
random stream to a value derived from HOSTNAME and the pid, so all later
random.random()/choice()/shuffle()/sample() calls in the process returned a
repeatable sequence instead of continuing the stream the caller seeded.

It also degraded the SDK's own jitter: rate_limiter.py is the only module that
seeds the global generator, but client.py:1295 (_next_poll_interval) and
harness/_runner.py:415 and :423 (transient-error backoff) draw from it, so one
rate-limited LLM call made their poll intervals and backoff delays a
deterministic function of the container seed -- identical across containers
that share a hostname/pid shape, which is exactly the synchronisation jitter
exists to prevent.

Draw from a private random.Random instance instead. The returned jitter is
bit-identical (verified across 240 seed/attempt/range combinations by
comparing float.hex()), because CPython's module-l

**File**: `sdk/python/agentfield/rate_limiter.py` (modified, +6/-3)
```diff
@@ -146,10 +146,13 @@ def _calculate_backoff_delay(
             base_delay = min(self.base_delay * (2**attempt), self.max_delay)
 
         # Add container-specific jitter to distribute load
-        # Use container seed to ensure consistent but distributed jitter
-        random.seed(self._container_seed + attempt)
+        # Use container seed to ensure consistent but distributed jitter.
+        # Seeded on a private Random instance, never on the module-level one:
+        # random.seed() here would overwrite the host process's random stream
+        # on every retry.
+        rng = random.Random(self._container_seed + attempt)
         jitter_range = base_delay * self.jitter_factor
-        jitter = random.uniform(-jitter_range, jitter_range)
+        jitter = rng.uniform(-jitter_range, jitter_range)
 
         # Ensure minimum delay and apply jitter
         delay = max(0.1, base_delay + jitter)
```

**File**: `sdk/python/tests/test_rate_limiter_core.py` (modified, +48/-0)
```diff
@@ -97,6 +97,54 @@ def test_calculate_backoff_applies_jitter_and_max_cap():
     assert delay == pytest.approx(expected_delay)
 
 
+@pytest.mark.unit
+def test_calculate_backoff_leaves_global_random_state_alone():
+    """A backoff must not hijack the host process's global random stream."""
+    limiter = StatelessRateLimiter(base_delay=0.5, jitter_factor=0.3, max_delay=1.0)
+    limiter._container_seed = 42
+
+    random.seed(20260929)
+    untouched = [random.random() for _ in range(3)]
+
+    random.seed(20260929)
+    limiter._calculate_backoff_delay(4)
+    after_backoff = [random.random() for _ in range(3)]
+
+    assert after_backoff == untouched
+
+
+@pytest.mark.unit
+@pytest.mark.asyncio
+async def test_execute_with_retry_leaves_global_random_state_alone(monkeypatch):
+    """The public retry path keeps caller randomness intact across attempts."""
+    limiter = StatelessRateLimiter(max_retries=2, base_delay=0.01, jitter_factor=0.25)
+    limiter._container_seed = 7
+    sleeps = []
+
+    async def fake_sleep(delay):
+        sleeps.append(delay)
+
+    monkeypatch.setattr("agentfield.rate_limiter.asyncio.sleep", fake_sleep)
+
+    attempts = {"count": 0}
+
+    async def flaky_call():
+        attempts["count"] += 1
+        if attempts["count"] < 3:
+            raise DummyHTTPError()
+        return "ok"
+
+    random.seed(1234)
+    untouched = [random.random() for _ in range(3)]
+
+    random.seed(1234)
+    result = await limiter.execute_with_retry(flaky_call)
+
+    assert result == "ok"
+    assert len(sleeps) == 2
+    assert [random.random() for _ in range(3)] == untouched
+
+
 @pytest.mark.unit
 def test_extract_retry_after_uses_attribute_fallback():
     limiter = StatelessRateLimiter()
```

---

### Incident Patch 6: `bf118593` (2026-09-29)
**Commit Message**: fix(sdk): probe harness binaries as argv, not a cmd.exe command string (#1075)

* fix(sdk): probe harness binaries as argv, not cmd.exe /c

CodeQL alerts 60, 61, and 62 flag defaultVersionProbe for building a
cmd.exe /c command line from a resolved binary path. Pass that path as
an execFile argv element instead. PATHEXT resolution is unchanged.

Assisted-by: CodeAF (grok-4.7)
Co-Authored-By: CodeAF <[REDACTED_EMAIL]>

* fix(sdk): run Windows batch probes as separate cmd.exe argv

Node rejects execFile of a .cmd or .bat (CVE-2024-27980). Keep cmd.exe
as the interpreter for those shims only, and pass /d, /s, /c, the
resolved path, and the version args as separate argv elements.

Assisted-by: CodeAF (grok-4.7)
Co-Authored-By: CodeAF <[REDACTED_EMAIL]>

* fix(sdk): drop cmd /s from the Windows batch version probe

Node quotes an argv element that contains spaces. cmd /s then strips the
outer quotes of the whole line and splits C:\Program Files\.... Pass
/d /c and the resolved path as separate argv elements, with no /s and
no joined command string.

Assisted-by: CodeAF (grok-4.7)
Co-Authored-By: CodeAF <[REDACTED_EMAIL]>

* fix(sdk): pass Windows batch probe paths through the child env


**File**: `sdk/typescript/src/harness/availability.ts` (modified, +34/-11)
```diff
@@ -195,26 +195,49 @@ function isWindowsBatchFile(command: string): boolean {
     && WINDOWS_BATCH_EXTENSIONS.has(path.extname(command).toLowerCase());
 }
 
-/** Quote one token for a `cmd.exe /s /c` line; the whole line gets outer quotes. */
-function quoteCmdToken(value: string): string {
-  return `"${value.replace(/"/g, '""')}"`;
+const BATCH_PROBE_ENV_PREFIX = 'AGENTFIELD_PROBE_ARG_';
+
+/**
+ * Build a `cmd.exe` invocation for a `.cmd`/`.bat` shim. Node refuses to spawn
+ * batch files without a shell (CVE-2024-27980), so they have to go through
+ * cmd.exe. The `/c` line is a fixed template of `%VAR%` references; the path
+ * and arguments travel in the child's environment. cmd.exe expands each
+ * variable once, after it has split the line, and the template quotes every
+ * reference, so `&`, `^`, `(`, `%` and spaces in a path stay literal. Passing
+ * the path as a bare argv element instead breaks on `&` and `(x86)` because
+ * cmd.exe without `/s` drops the quotes Node adds.
+ */
+function batchProbeInvocation(command: string[]): {
+  file: string;
+  args: string[];
+  env: NodeJS.ProcessEnv;
+} {
+  const env: NodeJS.ProcessEnv = { ...process.env };
+  const tokens = command.map((value, index) => {
+    const name = `${BATCH_PROBE_ENV_PREFIX}${index}`;
+    env[name] = value;
+    return `"%${name}%"`;
+  });
+  return {
+    file: process.env.ComSpec ?? 'cmd.exe',
+    // /s strips only the outermost quote pair, leaving each "%VAR%" quoted.
+    // /v:off keeps ! in a path literal even if delayed expansion is enabled.
+    args: ['/d', '/v:off', '/s', '/c', `"${tokens.join(' ')}"`],
+    env,
+  };
 }
 
 async function defaultVersionProbe(command: string[]): Promise<string> {
   const { execFile } = await import('node:child_process');
   return new Promise((resolve, reject) => {
-    // Node refuses to spawn batch files without a shell (CVE-2024-27980), so
-    // Windows .cmd/.bat shims run through cmd.exe. The /s outer-quote form
-    // keeps resolved paths containing spaces intact.
     const batch = isWindowsBatchFile(command[0]);
-    const file = batch ? (process.env.ComSpec ?? 'cmd.exe') : command[0];
-    const args = batch
-      ? ['/d', '/s', '/c', `"${command.map(quoteCmdToken).join(' ')}"`]
-      : command.slice(1);
+    const { file, args, env } = batch
+      ? batchProbeInvocation(command)
+      : { file: command[0], args: command.slice(1), env: process.env };
     execFile(
       file,
       args,
-      { timeout: 2_000, windowsHide: true, windowsVerbatimArguments: batch },
+      { timeout: 2_000, windowsHide: true, windowsVerbatimArguments: batch, env },
       (error, stdout, stderr) => {
         if (error) {
           reject(error);
```

**File**: `sdk/typescript/tests/harness_doctor.test.ts` (modified, +19/-4)
```diff
@@ -207,21 +207,36 @@ describe('harness provider availability', () => {
     expect(health).toMatchObject({ version: 'opencode 1.0.0', usable: true, issues: [] });
   });
 
-  it('routes Windows batch shims through cmd.exe for the default version probe', async () => {
+  it('keeps a Windows batch shim path out of the cmd.exe command line', async () => {
+    // Locks the invocation contract only. The mock does not execute cmd.exe.
     const platform = Object.getOwnPropertyDescriptor(process, 'platform');
     Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
     mockExecFileOutput('codex-cli 9.9.9\n');
+    const shim = 'C:\\Program Files (x86)\\R&D ^%x%!\\npm\\codex.cmd';
 
     try {
       const [health] = await harnessDoctor(['codex'], {
         env: {},
-        resolveBinary: () => 'C:\\Program Files\\npm\\codex.cmd',
+        resolveBinary: () => shim,
       });
 
       expect(execFileMock).toHaveBeenCalledWith(
         process.env.ComSpec ?? 'cmd.exe',
-        ['/d', '/s', '/c', '""C:\\Program Files\\npm\\codex.cmd" "--version""'],
-        expect.objectContaining({ windowsHide: true, windowsVerbatimArguments: true }),
+        [
+          '/d',
+          '/v:off',
+          '/s',
+          '/c',
+          '""%AGENTFIELD_PROBE_ARG_0%" "%AGENTFIELD_PROBE_ARG_1%""',
+        ],
+        expect.objectContaining({
+          windowsHide: true,
+          windowsVerbatimArguments: true,
+          env: expect.objectContaining({
+            AGENTFIELD_PROBE_ARG_0: shim,
+            AGENTFIELD_PROBE_ARG_1: '--version',
+          }),
+        }),
         expect.any(Function)
       );
       expect(health).toMatchObject({ version: 'codex-cli 9.9.9', usable: true, issues: [] });
```

---

### Incident Patch 7: `8805c960` (2026-09-25)
**Commit Message**: fix(sdk/python): skip schema output dir for schema-free harness runs (#1072)

HarnessRunner.run() allocated the per-run .agentfield-out-* directory
before dispatching the provider even when schema is None. That directory
only ever holds .agentfield_output.json (#684, #891), and every consumer
of it is already inside an `if schema is not None` guard, so a text-only
run paid a filesystem write it never read back. When the project root
could not accept one — a read-only mount, an immutable CI workspace — a
plain permission_mode="plan" call failed during setup, before the coding
agent was invoked at all.

Allocate the directory only for schema-bearing runs. Their per-run
isolation and cleanup are unchanged, so concurrent runs sharing one cwd
still cannot overwrite or delete each other's output.

Refs #684, #891

**File**: `sdk/python/agentfield/harness/_runner.py` (modified, +12/-9)
```diff
@@ -294,15 +294,18 @@ async def run(
         # project_dir, or cwd when project_dir is unset. Besides keeping the file
         # inside the agent root, this prevents concurrent runs sharing one cwd
         # from overwriting or deleting each other's fixed output filename.
-        resolved_project_dir = options.get("project_dir")
-        if isinstance(resolved_project_dir, str) and resolved_project_dir:
-            base_dir = resolved_project_dir
-        else:
-            base_dir = resolved_cwd
-        os.makedirs(base_dir, exist_ok=True)
-        temp_output_dir: Optional[str] = tempfile.mkdtemp(
-            prefix=".agentfield-out-", dir=base_dir
-        )
+        # A schema-free run never writes or reads that file, so it must not need
+        # a writable root either: allocating one unconditionally aborted
+        # text-only permission_mode="plan" dispatches before the provider ran.
+        temp_output_dir: Optional[str] = None
+        if schema is not None:
+            resolved_project_dir = options.get("project_dir")
+            if isinstance(resolved_project_dir, str) and resolved_project_dir:
+                base_dir = resolved_project_dir
+            else:
+                base_dir = resolved_cwd
+            os.makedirs(base_dir, exist_ok=True)
+            temp_output_dir = tempfile.mkdtemp(prefix=".agentfield-out-", dir=base_dir)
         output_dir = temp_output_dir
 
         # schema_mode selects how the agent is asked to produce the output:
```

**File**: `sdk/python/tests/test_harness_runner.py` (modified, +33/-0)
```diff
@@ -240,6 +240,39 @@ async def test_run_without_schema_returns_plain_harness_result(tmp_path):
     assert result.session_id == "sess-1"
 
 
+@pytest.mark.asyncio
+async def test_run_without_schema_does_not_require_writable_project_dir(tmp_path):
+    """A schema-free run must reach the provider without allocating artifacts.
+
+    The per-run ``.agentfield-out-*`` directory only exists to hold the schema
+    output file (#684, #891). Allocating it unconditionally aborted a text-only
+    ``permission_mode="plan"`` run during setup, before the provider was ever
+    dispatched, whenever the project root could not be written to.
+    """
+    blocker = tmp_path / "blocker.txt"
+    blocker.write_text("not a directory", encoding="utf-8")
+    # Cannot be created on any platform: its parent is a regular file.
+    unwritable_root = blocker / "project"
+
+    provider = MockProvider([RawResult(result="plan text")])
+    runner = HarnessRunner()
+
+    with patch("agentfield.harness._runner.build_provider", return_value=provider):
+        result = await runner.run(
+            "hello",
+            provider="codex",
+            permission_mode="plan",
+            cwd=str(tmp_path),
+            project_dir=str(unwritable_root),
+        )
+
+    assert provider.call_count == 1, "schema-free run must dispatch the provider"
+    assert result.is_error is False
+    assert result.result == "plan text"
+    assert result.parsed is None
+    assert list(tmp_path.glob(".agentfield-out-*")) == []
+
+
 @pytest.mark.asyncio
 async def test_run_with_schema_injects_prompt_suffix_and_parses_output(tmp_path):
     provider = FileWritingProvider(json.dumps({"name": "ok", "count": 1}))
```

---

### Incident Patch 8: `2f41660b` (2026-09-21)
**Commit Message**: fix(control-plane): don't reap a parent whose child just finished (#1059) (#1063)

* fix(control-plane): don't reap a parent whose child just finished

Closes #1059. The stale reaper could time out a running parent in the
brief window (~50-600ms) between its child reaching a terminal state and
the parent posting its own result. The parent's own updated_at does not
move while it waits on the child, and the existing guard only skipped a
parent while it had a non-terminal child. The moment the child posted
succeeded, the guard vanished and nothing refreshed the parent's clock,
so the reaper could mark the parent (and its workflow) timeout, and the
parent's real success callback was then rejected with HTTP 409.

Fix (issue's Option 1, query-contained): in MarkStaleExecutions and
MarkStaleWorkflowExecutions, also skip a parent when a child reached a
terminal state after the cutoff (COALESCE(c.completed_at, c.updated_at)
> cutoff). A child that finished long before the cutoff no longer
shields the parent, so genuinely stuck parents are still reaped and
orphan cleanup keeps working.

Timeout children are excluded from the shield (c.status != 'timeout'):
the reaper's own kills set a recent

**File**: `control-plane/internal/storage/execution_records.go` (modified, +79/-15)
```diff
@@ -31,6 +31,23 @@ func (ls *LocalStorage) staleTimestampExpr(col string) string {
 	return "julianday(" + col + ")"
 }
 
+// childTerminalRecencyExpr returns an expression for "the later of a child's
+// control-plane record time (updated_at) and its agent-reported completion
+// time (completed_at)". completed_at is stored verbatim from the agent, so on a
+// skewed agent clock or a callback that took a while to land it can already be
+// older than the cutoff at the moment the control plane writes the terminal row
+// (issue #1059 review). updated_at is the control plane's own write clock, so
+// taking the maximum shields the parent whenever EITHER clock says the child
+// finished after the cutoff. On the executions table a terminal row's
+// updated_at is frozen (terminal->terminal is rejected), so this cannot shield
+// indefinitely.
+func (ls *LocalStorage) childTerminalRecencyExpr() string {
+	if ls.requireSQLDB().Mode() == "postgres" {
+		return "GREATEST(COALESCE(c.completed_at, c.updated_at), COALESCE(c.updated_at, c.completed_at))"
+	}
+	return "MAX(julianday(COALESCE(c.completed_at, c.updated_at)), julianday(COALESCE(c.updated_at, c.completed_at)))"
+}
+
 // maxNodesForDepthCalc caps the number of executions for which we compute DAG depth to avoid heavy queries.
 const maxNodesForDepthCalc = 1000
 
@@ -1180,11 +1197,17 @@ func parseTimeString(value string) (time.Time, error) {
 // non-terminal child are skipped. A parent's own updated_at stops moving while
 // it waits, so without this a long child call — one agent doing many minutes of
 // work in a single request — reaps its whole ancestor chain even though real
-// work is happening. Deliberately no recency test on the child: the chain
-// unwinds bottom-up instead. If work genuinely stops, the leaf goes stale and
-// is reaped first, which makes its parent childless and eligible on the next
-// sweep, and so on up. Nothing is stuck forever; it just takes one sweep per
-// level.
+// work is happening.
+//
+// A child that reached a terminal state after the cutoff also shields its parent
+// for one stale window, covering the brief gap between a child reporting success
+// and the parent posting its own result (issue #1059). timeout children are
+// excluded from this so the reaper's own kills cannot perpetuate a shield.
+// Consequence: a non-timeout child that just finished delays its parent's reap
+// by up to one stale window, so the bottom-up chain unwind can take a stale
+// window per level rather than a single sweep. Nothing is stuck forever — a
+// child that finished before the cutoff no longer shields, so the chain always
+// drains.
 // The conditional UPDATE re-evaluates the staleness predicates so a row that
 // gains activity after selection is left alone.
 func (ls *LocalStorage) MarkStaleExecutions(ctx context.Context, staleAfter time.Duration, limit int) (int, error) {
@@ -1205,6 +1228,14 @@ func (ls *LocalStorage) markStaleExecutions(ctx context.Context, staleAfter time
 	tsExpr := ls.staleTimestampExpr("COALESCE(updated_at, created_at, started_at)")
 	executionUpdateTSExpr := ls.staleTimestampExpr("COALESCE(e.updated_at, e.created_at, e.started_at)")
 	cutoffExpr := ls.staleTimestampExpr("?")
+	// A child that reached a terminal state after the cutoff also shields its
+	// parent. When a child finishes, the parent needs a brief window (~50-600ms)
+	// to receive the result and post its own status; the parent's own updated_at
+	// does not move while it waits. Without this the reaper can time the parent
+	// out in that window, and the parent's real success callback then gets a 409.
+	// A child that finished long before the cutoff no longer shields the parent,
+	// so a genuinely stuck parent is still reaped (see issue #1059).
+	childRecencyTSExpr := ls.childTerminalRecencyExpr()
 	rows, err := db.QueryContext(ctx, `
 		SELECT execution_id, started_at
 		FROM executions e
@@ -1213,10 +1244,13 @@ func (ls *LocalStorage) markStaleExecutions(ctx context.Context, staleAfter time
 		  AND NOT EXISTS (
 		      SELECT 1 FROM executions c
 		      WHERE c.parent_execution_id = e.execution_id
-		        AND c.status IN ('running', 'pending', 'queued')
+		        AND (
+		            c.status IN ('running', 'pending', 'queued')
+		            OR (c.status != 'timeout' AND `+childRecencyTSExpr+` > `+cutoffExpr+`)
+		        )
 		  )
 		ORDER BY `+tsExpr+` ASC
-		LIMIT ?`, cutoff, limit)
+		LIMIT ?`, cutoff, cutoff, limit)
 	if err != nil {
 		return 0, fmt.Errorf("query stale executions: %w", err)
 	}
@@ -1264,7 +1298,10 @@ func (ls *LocalStorage) markStaleExecutions(ctx context.Context, staleAfter time
 		  AND NOT EXISTS (
 		      SELECT 1 FROM executions c
 		      WHERE c.parent_execution_id = e.execution_id
-		        AND c.status IN ('running', 'pending', 'queued')
+		        AND (
+		            c.status IN ('running', 'pending', 'queued')
+		            OR (c.status != 'timeout' AND `+childRecencyTSExpr+` > `+cutoffExpr+`
```

**File**: `control-plane/internal/storage/retry_stale_test.go` (modified, +35/-2)
```diff
@@ -669,15 +669,17 @@ func TestRetryStaleWorkflowExecutions_TerminalChildDoesNotShieldParent(t *testin
 	backdateExecutionUpdatedAt(t, ls, "executions", parentID, staleAt)
 
 	const childID = "exec-retry-terminal-child"
-	childWorkflow := retryTestWorkflow(childID, now)
+	// The child finished long before the cutoff (staleAt), so it is not live
+	// work and must not shield its stale parent from the retry sweep.
+	childWorkflow := retryTestWorkflow(childID, staleAt)
 	childWorkflow.Status = "succeeded"
 	childWorkflow.ParentExecutionID = strPtr(parentID)
 	require.NoError(t, ls.StoreWorkflowExecution(ctx, childWorkflow))
 
 	retried, err := ls.RetryStaleWorkflowExecutions(ctx, 30*time.Minute, 3, 100)
 	require.NoError(t, err)
 	require.Equal(t, []string{parentID}, retried,
-		"a terminal child is not live work and must not shield its stale parent")
+		"a long-finished terminal child is not live work and must not shield its stale parent")
 
 	parent, err := ls.GetWorkflowExecution(ctx, parentID)
 	require.NoError(t, err)
@@ -693,6 +695,37 @@ func TestRetryStaleWorkflowExecutions_TerminalChildDoesNotShieldParent(t *testin
 	require.Equal(t, "succeeded", child.Status, "the terminal child must stay terminal")
 }
 
+// TestRetryStaleWorkflowExecutions_RecentlyFinishedChildShieldsParent guards
+// the retry half of issue #1059: the retry sweep runs before both reapers when
+// max_retries > 0, so without the recent-terminal-child shield it resets a
+// live parent to pending in the brief window between a child reporting success
+// and the parent posting its own result.
+func TestRetryStaleWorkflowExecutions_RecentlyFinishedChildShieldsParent(t *testing.T) {
+	ls, ctx := setupRetryTestStorage(t)
+	now := time.Now().UTC()
+	staleAt := now.Add(-2 * time.Hour)
+
+	const parentID = "exec-retry-parent-recent-child"
+	require.NoError(t, ls.StoreWorkflowExecution(ctx, retryTestWorkflow(parentID, staleAt)))
+	require.NoError(t, ls.CreateExecutionRecord(ctx, retryTestExecution(parentID, staleAt)))
+	backdateExecutionUpdatedAt(t, ls, "executions", parentID, staleAt)
+
+	const childID = "exec-retry-recent-child"
+	childWorkflow := retryTestWorkflow(childID, now) // just succeeded
+	childWorkflow.Status = "succeeded"
+	childWorkflow.ParentExecutionID = strPtr(parentID)
+	require.NoError(t, ls.StoreWorkflowExecution(ctx, childWorkflow))
+
+	retried, err := ls.RetryStaleWorkflowExecutions(ctx, 30*time.Minute, 3, 100)
+	require.NoError(t, err)
+	require.Empty(t, retried, "parent must not be retried while its child only just finished")
+
+	parent, err := ls.GetWorkflowExecution(ctx, parentID)
+	require.NoError(t, err)
+	require.Equal(t, "running", parent.Status)
+	require.Equal(t, 0, parent.RetryCount)
+}
+
 // TestRetryStaleWorkflowExecutions_BatchReportsOnlyMovedCandidates covers the
 // batch accounting contract: when one sweep selects several stale candidates
 // and only some of them lose their paired execution to a heartbeat between the
```

**File**: `control-plane/internal/storage/stale_execution_parent_test.go` (modified, +155/-4)
```diff
@@ -96,10 +96,10 @@ func TestMarkStaleExecutions_UnwindsChainBottomUp(t *testing.T) {
 	require.Equal(t, "timeout", executionStatus(t, ls, "exec-build"))
 }
 
-// TestMarkStaleExecutions_TerminalChildDoesNotShieldParent: only a
-// *non-terminal* child protects a parent. A finished child must not keep a
-// genuinely stuck parent alive.
-func TestMarkStaleExecutions_TerminalChildDoesNotShieldParent(t *testing.T) {
+// TestMarkStaleExecutions_LongFinishedChildDoesNotShieldParent: a child that
+// reached a terminal state *before* the cutoff no longer protects a genuinely
+// stuck parent, so orphan cleanup keeps working (issue #1059 acceptance).
+func TestMarkStaleExecutions_LongFinishedChildDoesNotShieldParent(t *testing.T) {
 	ls, ctx := setupTestLocalStorage(t)
 	now := time.Now().UTC()
 
@@ -115,6 +115,10 @@ func TestMarkStaleExecutions_TerminalChildDoesNotShieldParent(t *testing.T) {
 		ParentExecutionID: strPtr("exec-build"),
 	}
 	require.NoError(t, ls.CreateExecutionRecord(ctx, done))
+	// The child finished an hour ago — well before the 30-minute cutoff — so it
+	// must not shield the stuck parent. CreateExecutionRecord stamps updated_at
+	// at "now", so backdate it to make the completion genuinely old.
+	backdateExecutionUpdatedAt(t, ls, "executions", "exec-done", now.Add(-time.Hour))
 
 	reaped, err := ls.MarkStaleExecutions(ctx, 30*time.Minute, 100)
 	require.NoError(t, err)
@@ -123,6 +127,63 @@ func TestMarkStaleExecutions_TerminalChildDoesNotShieldParent(t *testing.T) {
 	require.Equal(t, "succeeded", executionStatus(t, ls, "exec-done"), "terminal child untouched")
 }
 
+// TestMarkStaleExecutions_RecentlyFinishedChildShieldsParent guards issue #1059:
+// a child that reached a terminal state *after* the cutoff protects its parent
+// during the brief window between the child reporting success and the parent
+// posting its own result. Without this the parent is timed out mid-flight and
+// its real success callback is rejected with HTTP 409.
+func TestMarkStaleExecutions_RecentlyFinishedChildShieldsParent(t *testing.T) {
+	ls, ctx := setupTestLocalStorage(t)
+	now := time.Now().UTC()
+
+	// Parent is stale by its own clock (idle 1h while it waited on the child).
+	newRunningExecution(t, ls, "exec-build", "", time.Hour)
+	// Child just succeeded (updated_at ~= now, well after the 30-minute cutoff).
+	done := &types.Execution{
+		ExecutionID:       "exec-done",
+		RunID:             "run-parented",
+		AgentNodeID:       "agent-1",
+		ReasonerID:        "reasoner-1",
+		NodeID:            "node-1",
+		Status:            "succeeded",
+		StartedAt:         now.Add(-2 * time.Hour),
+		ParentExecutionID: strPtr("exec-build"),
+	}
+	require.NoError(t, ls.CreateExecutionRecord(ctx, done))
+
+	reaped, err := ls.MarkStaleExecutions(ctx, 30*time.Minute, 100)
+	require.NoError(t, err)
+	require.Equal(t, 0, reaped, "parent must survive while its child only just finished")
+	require.Equal(t, "running", executionStatus(t, ls, "exec-build"))
+}
+
+// TestMarkStaleExecutions_TimeoutChildDoesNotShieldParent: a child the reaper
+// itself timed out must not shield its parent, even though its timeout is
+// recent — otherwise a reaped leaf would keep its stuck ancestor alive and the
+// bottom-up unwind (one level per sweep) would stall.
+func TestMarkStaleExecutions_TimeoutChildDoesNotShieldParent(t *testing.T) {
+	ls, ctx := setupTestLocalStorage(t)
+	now := time.Now().UTC()
+
+	newRunningExecution(t, ls, "exec-build", "", time.Hour)
+	timedOut := &types.Execution{
+		ExecutionID:       "exec-timeout",
+		RunID:             "run-parented",
+		AgentNodeID:       "agent-1",
+		ReasonerID:        "reasoner-1",
+		NodeID:            "node-1",
+		Status:            "timeout",
+		StartedAt:         now.Add(-2 * time.Hour),
+		ParentExecutionID: strPtr("exec-build"),
+	}
+	require.NoError(t, ls.CreateExecutionRecord(ctx, timedOut))
+
+	reaped, err := ls.MarkStaleExecutions(ctx, 30*time.Minute, 100)
+	require.NoError(t, err)
+	require.Equal(t, 1, reaped)
+	require.Equal(t, "timeout", executionStatus(t, ls, "exec-build"))
+}
+
 // TestMarkStaleExecutions_UnrelatedStuckExecutionStillReaped: the new skip is
 // scoped to actual parents — an unrelated stuck execution is still collected in
 // the same sweep as a protected chain.
@@ -139,3 +200,93 @@ func TestMarkStaleExecutions_UnrelatedStuckExecutionStillReaped(t *testing.T) {
 	require.Equal(t, "timeout", executionStatus(t, ls, "exec-orphan"))
 	require.Equal(t, "running", executionStatus(t, ls, "exec-build"))
 }
+
+// workflowStatus returns the current status of a workflow_executions row.
+func workflowStatus(t *testing.T, ls *LocalStorage, id string) string {
+	t.Helper()
+	wf, err := ls.GetWorkflowExecution(t.Context(), id)
+	require.NoError(t, err)
+	return wf.Status
+}
+
+// TestMarkStaleWorkflowExecutions_RecentlyFinishedChildShieldsParent is the
+// workflow-table half of the issue #1059 fix: a parent workflow that is stale
+// by its own clock must not be reaped
```

---

### Incident Patch 9: `00c8844e` (2026-09-21)
**Commit Message**: fix(sdk/python): stop the structured log stdout write from blocking the event loop (#1066)

* feat(sdk/python): add a bounded, non-blocking stdout writer for log lines

A single daemon thread drains a bounded FIFO of (stream, line) pairs.
Deferral only engages where it can help — the caller is on a running event
loop and the destination has a real file descriptor — so synchronous callers
and in-memory captures keep writing inline and stay immediately visible.

Under back-pressure the queue discards its oldest pending lines instead of
blocking the producer, and the writer emits one log.dropped record per
destination naming the count, so loss is never silent. An atexit drain
bounded by AGENTFIELD_LOG_QUEUE_FLUSH_SECONDS covers normal shutdown, and an
at-fork hook gives the child fresh state.

Refs #985

Co-Authored-By: Claude Opus 5 (1M context) <[REDACTED_EMAIL]>

* fix(sdk/python): stop the structured log mirror from blocking the event loop

_emit_structured_record printed inline on the calling thread, which in an
agent node is the event loop, into the _TeeTextIO wrapper over a real pipe.
A consumer that stops draining that pipe froze the whole loop for the
duration — heartbeats, i

**File**: `docs/ENVIRONMENT_VARIABLES.md` (modified, +3/-0)
```diff
@@ -200,6 +200,9 @@ AGENTFIELD_CONNECTOR_CAP_DID_MANAGEMENT=false
 
 - `AGENTFIELD_LOGS_ENABLED` (default: `true`): Enables Python, Go, and TypeScript agent-node stdout/stderr capture and the `/agentfield/v1/logs` endpoint. This controls capture, not control-plane execution-log dispatch.
 - `AGENTFIELD_LOG_STDOUT` (read by Python, Go, and TypeScript; default: on): Controls whether structured execution records are mirrored to stdout as JSON. Set to `0`, `false`, `no`, or `off` (case-insensitive, surrounding whitespace ignored) to suppress the mirror; control-plane dispatch continues unchanged for records carrying an execution ID. Any other value — including `1`, `true`, `yes`, an unset variable and a set-but-empty one — keeps the mirror on, so a typo cannot silently drop log output. All three SDKs skip control-plane dispatch for a record with no execution id, so such records are stdout-only and disabling the mirror drops them entirely. Because the node-log ring behind `GET /agentfield/v1/logs` is fed by the process's captured stdout, disabling the mirror also removes structured records from that ring.
+- `AGENTFIELD_LOG_QUEUE` (Python only; default: on): Defers SDK logger writes to a dedicated writer when logging from a running event loop to stdout backed by a real file descriptor. Set to `0`, `false`, `no`, or `off` (case-insensitive, surrounding whitespace ignored) to restore inline synchronous writes; any other value, including an unset or set-but-empty value, keeps deferral enabled. Calls outside a running event loop and writes to captures such as `StringIO` remain inline unless an SDK log backlog already exists. Structured and human-readable SDK logger lines share the FIFO and retain their relative order, but ordering between those lines and a user's own bare `print()` calls is not guaranteed.
+- `AGENTFIELD_LOG_QUEUE_SIZE` (Python only; default: `1024` lines): Maximum number of pending SDK logger lines. Integers below 1 are clamped to 1 and non-integers use the default. When stdout back-pressure fills the queue, the oldest pending lines are discarded without blocking the producer; once a later line can be written to the same output destination, a structured `log.dropped` warning reports the number discarded for that destination.
+- `AGENTFIELD_LOG_QUEUE_FLUSH_SECONDS` (Python only; default: `2.0` seconds): Bounds the interpreter-exit wait for pending SDK logger lines. Negative values are clamped to zero; invalid and non-finite values use the default. A permanently stalled stdout therefore cannot hang normal interpreter shutdown. `os._exit()` bypasses Python's exit handlers and this flush; use `AGENTFIELD_LOG_QUEUE=false` when a process requires inline writes before such an exit.
 - `AGENTFIELD_LOG_TRUNCATE` (Python default: `200` characters): Truncates human-readable plain log messages and visible plain-log payloads. It does not truncate structured records.
 - `AGENTFIELD_LOG_PAYLOADS` (Python default: `false`): Shows payloads in human-readable plain logs when `true`. Structured execution attributes are unaffected.
 - `AGENTFIELD_LOG_MAX_LINE_BYTES` (default: `16384`): Maximum process-log line size in bytes. Python clamps every integer below 256 (including zero and negatives) to 256; Go and TypeScript instead reject values below 256 and use the 16384-byte default. Python and Go reject non-integers, while TypeScript prefix-parses them (`512abc` becomes `512`). Thus a value of `100` yields an effective cap of 256 in Python and 16384 in Go and TypeScript: in those two SDKs there is no minimum, only a rejection *upward* to the default, so asking for a smaller cap silently gives you a 64x larger one. In Python this cap applies both to the stdout/stderr tee feeding `/agentfield/v1/logs` and to structured-mirror elision; the mirror elides attributes, then the message or entire record as needed so the complete JSON envelope remains valid JSON within the cap.
```

**File**: `sdk/python/README.md` (modified, +1/-0)
```diff
@@ -187,6 +187,7 @@ for mount layout, `call_local`, error behavior, and limitations.
 ## Logging
 
 - `AGENTFIELD_LOG_STDOUT` controls the on-by-default structured JSON mirror. Set it to `0`, `false`, `no`, or `off` to disable the mirror; execution-scoped records still dispatch to the control plane.
+- `AGENTFIELD_LOG_QUEUE` controls the Python SDK's bounded stdout writer queue. It is enabled by default for real-fd writes made from a running event loop; see the environment-variable reference for queue sizing, overflow, shutdown, and opt-out details.
 - `AGENTFIELD_LOG_MAX_LINE_BYTES` defaults to 16384 bytes and clamps any integer below 256 to 256. It limits both captured stdout/stderr lines and structured-mirror records; non-integers use the default.
 - `AGENTFIELD_LOGS_ENABLED` controls stdout/stderr capture and the node logs endpoint only, not control-plane execution-log dispatch.
 - `AGENTFIELD_LOG_LEVEL` controls human-readable Python SDK logging and defaults to `WARNING`.
```

**File**: `sdk/python/agentfield/log_writer.py` (added, +302/-0)
```diff
@@ -0,0 +1,302 @@
+"""Bounded, non-blocking stdout writer for SDK log lines."""
+
+from __future__ import annotations
+
+import asyncio
+import atexit
+import json
+import math
+import os
+import queue
+import sys
+import threading
+import time
+from datetime import datetime, timezone
+from typing import Any, Dict, Optional, TextIO, Tuple, cast
+
+
+_DEFAULT_QUEUE_SIZE = 1024
+_DEFAULT_FLUSH_SECONDS = 2.0
+_FALSE_VALUES = ("0", "false", "no", "off")
+
+_state_lock = threading.Lock()
+_queue: "queue.Queue[Optional[Tuple[TextIO, str]]]" = queue.Queue(
+    maxsize=_DEFAULT_QUEUE_SIZE
+)
+_worker: Optional[threading.Thread] = None
+_dropped: Dict[TextIO, int] = {}
+_active = False
+
+
+def _queue_enabled() -> bool:
+    value = os.getenv("AGENTFIELD_LOG_QUEUE", "true").strip().lower()
+    return value not in _FALSE_VALUES
+
+
+def _queue_size() -> int:
+    raw = os.getenv("AGENTFIELD_LOG_QUEUE_SIZE", str(_DEFAULT_QUEUE_SIZE))
+    try:
+        return max(1, int(raw, 10))
+    except ValueError:
+        return _DEFAULT_QUEUE_SIZE
+
+
+def _flush_seconds() -> float:
+    raw = os.getenv("AGENTFIELD_LOG_QUEUE_FLUSH_SECONDS", str(_DEFAULT_FLUSH_SECONDS))
+    try:
+        value = float(raw)
+    except ValueError:
+        return _DEFAULT_FLUSH_SECONDS
+    if not math.isfinite(value):
+        return _DEFAULT_FLUSH_SECONDS
+    return max(0.0, value)
+
+
+def _has_real_fileno(stream: TextIO) -> bool:
+    try:
+        return isinstance(stream.fileno(), int)
+    except Exception:
+        return False
+
+
+def _has_running_loop() -> bool:
+    try:
+        asyncio.get_running_loop()
+    except RuntimeError:
+        return False
+    return True
+
+
+def _write_line(stream: TextIO, line: str) -> bool:
+    try:
+        stream.write(line + "\n")
+        stream.flush()
+    except Exception:
+        return False
+    return True
+
+
+def _drop_marker(count: int) -> str:
+    timestamp = (
+        datetime.now(timezone.utc)
+        .isoformat(timespec="milliseconds")
+        .replace("+00:00", "Z")
+    )
+    return json.dumps(
+        {
+            "ts": timestamp,
+            "level": "warning",
+            "source": "sdk.python.logger",
+            "event_type": "log.dropped",
+            "message": (f"dropped {count} structured log lines (stdout back-pressure)"),
+            "attributes": {"dropped": count},
+            "system_generated": True,
+        },
+        separators=(",", ":"),
+    )
+
+
+def _worker_main(
+    work_queue: "queue.Queue[Optional[Tuple[TextIO, str]]]",
+) -> None:
+    global _active, _worker
+
+    current = threading.current_thread()
+    try:
+        while True:
+            item = work_queue.get()
+            if item is None:
+                work_queue.task_done()
+                return
+
+            stream, line = item
+            dropped = 0
+            with _state_lock:
+                _active = True
+                dropped = _dropped.pop(stream, 0)
+
+            try:
+                if dropped and not _write_line(stream, _drop_marker(dropped)):
+                    with _state_lock:
+                        _dropped[stream] = _dropped.get(stream, 0) + dropped
+                _write_line(stream, line)
+            except Exception:
+                # The worker is deliberately immortal for ordinary failures.
+                pass
+            finally:
+                with _state_lock:
+                    _active = False
+                work_queue.task_done()
+    except Exception:
+        # Queue and marker failures must not escape the daemon thread either.
+        pass
+    finally:
+        with _state_lock:
+            _active = False
+            if _worker is current:
+                _worker = None
+
+
+def _start_worker_locked(
+    work_queue: "queue.Queue[Optional[Tuple[TextIO, str]]]",
+) -> bool:
+    global _worker
+
+    if _worker is not None and _worker.is_alive():
+        return True
+
+    worker = threading.Thread(
+        target=_worker_main,
+        args=(work_queue,),
+        name="agentfield-log-writer",
+        daemon=True,
+    )
+    _worker = worker
+    try:
+        worker.start()
+    except Exception:
+        _worker = None
+        return False
+    return True
+
+
+def _refresh_queue_locked() -> None:
+    global _queue
+
+    configured_size = _queue_size()
+    worker_alive = _worker is not None and _worker.is_alive()
+    if (
+        not worker_alive
+        and _queue.unfinished_tasks == 0
+        and _queue.maxsize != configured_size
+    ):
+        _queue = queue.Queue(maxsize=configured_size)
+
+
+def emit_line(line: str, stream: Optional[TextIO] = None) -> None:
+    """Write one line, deferring real-fd writes made from an event loop."""
+    resolved_stream = stream if stream is not None else cast(TextIO, sys.stdout)
+    if not _queue_enabled() or not _has_real_fileno(resolved_stream):
+        _write_line(resolved_stream, line)
+        return
+
+    running_loop = _has_running_loop()

```

**File**: `sdk/python/agentfield/logger.py` (modified, +37/-4)
```diff
@@ -11,12 +11,12 @@
 import json
 import logging
 import os
-import sys
 import threading
 from datetime import datetime, timezone
 from enum import Enum
 from typing import TYPE_CHECKING, Any, Dict, Optional
 
+from . import log_writer
 from .execution_context import ExecutionContext, get_current_context
 
 if TYPE_CHECKING:
@@ -44,13 +44,46 @@ class LogLevel(Enum):
     ERROR = "ERROR"
 
 
+class _UncontendedHandlerLock:
+    """A no-op stand-in for ``logging.Handler``'s serialization lock.
+
+    ``Handler.handle()`` holds that lock across ``emit()``. A synchronous
+    thread blocked inline on a stalled stdout would therefore hold it for the
+    length of the stall and block an event-loop caller before it ever reached
+    the bounded writer — the exact stall this module exists to remove. The
+    writer serializes stdout itself, so the handler needs no lock of its own.
+
+    ``None`` is not usable here: Python 3.13 changed ``handle()`` from
+    ``acquire()``/``release()`` (which skip a falsy lock) to ``with
+    self.lock:``, which raises ``TypeError`` on ``None``.
+    """
+
+    def acquire(self, blocking: bool = True, timeout: float = -1) -> bool:
+        return True
+
+    def release(self) -> None:
+        pass
+
+    def __enter__(self) -> "_UncontendedHandlerLock":
+        return self
+
+    def __exit__(self, *exc_info: Any) -> bool:
+        return False
+
+    def _at_fork_reinit(self) -> None:
+        pass
+
+
 class _DynamicStdoutHandler(logging.Handler):
     """A handler that resolves stdout at emit time so a later tee sees logs."""
 
+    def createLock(self) -> None:
+        """Let the shared writer serialize without blocking event-loop callers."""
+        self.lock = _UncontendedHandlerLock()  # type: ignore[assignment]
+
     def emit(self, record: logging.LogRecord) -> None:
         try:
-            sys.stdout.write(self.format(record) + self.terminator)
-            sys.stdout.flush()
+            log_writer.emit_line(self.format(record))
         except Exception:
             # Logging is always best-effort and must not fail SDK callers.
             self.handleError(record)
@@ -192,7 +225,7 @@ def _emit_structured_record(self, record: Dict[str, Any]) -> Dict[str, Any]:
         try:
             if self._stdout_mirror_enabled():
                 line = self._bounded_mirror_line(record)
-                print(line, file=sys.stdout, flush=True)
+                log_writer.emit_line(line)
         except Exception:
             # Broken stdout and capture-ring contention must never affect execution.
             pass
```

**File**: `sdk/python/agentfield/node_logs.py` (modified, +30/-3)
```diff
@@ -211,6 +211,7 @@ def isatty(self) -> bool:
 
 _global_ring: Optional[ProcessLogRing] = None
 _tee_installed = False
+_installed_tees: List[_TeeTextIO] = []
 
 
 def logs_enabled() -> bool:
@@ -243,16 +244,42 @@ def get_ring() -> ProcessLogRing:
 
 def install_stdio_tee() -> None:
     """Replace sys.stdout/sys.stderr with tees into the process log ring."""
-    global _tee_installed
+    global _installed_tees, _tee_installed
     if _tee_installed or not logs_enabled():
         return
     ring = get_ring()
     ml = max_line_bytes()
-    sys.stdout = _TeeTextIO("stdout", cast(TextIO, sys.__stdout__), ring, ml)
-    sys.stderr = _TeeTextIO("stderr", cast(TextIO, sys.__stderr__), ring, ml)
+    stdout_tee = _TeeTextIO("stdout", cast(TextIO, sys.__stdout__), ring, ml)
+    stderr_tee = _TeeTextIO("stderr", cast(TextIO, sys.__stderr__), ring, ml)
+    _installed_tees = [stdout_tee, stderr_tee]
+    sys.stdout = stdout_tee
+    sys.stderr = stderr_tee
     _tee_installed = True
 
 
+def _after_fork_child() -> None:
+    """Replace locks whose owning threads do not survive into a fork child."""
+    global _follow_lock, _follow_queues
+
+    rings: List[ProcessLogRing] = []
+    for tee in _installed_tees:
+        tee._write_lock = threading.Lock()
+        tee._buf = ""
+        if all(tee._ring is not ring for ring in rings):
+            rings.append(tee._ring)
+    if _global_ring is not None and all(_global_ring is not ring for ring in rings):
+        rings.append(_global_ring)
+    for ring in rings:
+        ring._lock = threading.Lock()
+
+    _follow_lock = threading.Lock()
+    _follow_queues = []
+
+
+if hasattr(os, "register_at_fork"):
+    os.register_at_fork(after_in_child=_after_fork_child)
+
+
 def verify_internal_bearer(authorization_header: Optional[str]) -> bool:
     token = os.getenv("AGENTFIELD_AUTHORIZATION_INTERNAL_TOKEN", "").strip()
     if not token:
```

**File**: `sdk/python/tests/test_log_writer.py` (added, +571/-0)
```diff
@@ -0,0 +1,571 @@
+import asyncio
+import io
+import json
+import os
+import tempfile
+import threading
+from typing import TextIO
+
+import pytest
+
+from agentfield import log_writer
+from agentfield.logger import AgentFieldLogger
+
+
+@pytest.fixture(autouse=True)
+def reset_log_writer(monkeypatch):
+    log_writer.shutdown(1.0)
+    monkeypatch.delenv("AGENTFIELD_LOG_QUEUE", raising=False)
+    monkeypatch.delenv("AGENTFIELD_LOG_QUEUE_SIZE", raising=False)
+    monkeypatch.delenv("AGENTFIELD_LOG_QUEUE_FLUSH_SECONDS", raising=False)
+    try:
+        yield
+    finally:
+        log_writer.shutdown(1.0)
+
+
+def _emit_deferred(*lines: str, stream: TextIO) -> None:
+    async def emit() -> None:
+        for line in lines:
+            log_writer.emit_line(line, stream)
+        await asyncio.sleep(0)
+
+    asyncio.run(emit())
+
+
+class _BlockingStream:
+    def __init__(self, stream: TextIO) -> None:
+        self.stream = stream
+        self.started = threading.Event()
+        self.release = threading.Event()
+
+    def fileno(self) -> int:
+        return self.stream.fileno()
+
+    def write(self, value: str) -> int:
+        if not self.started.is_set():
+            self.started.set()
+            if not self.release.wait(2.0):
+                raise TimeoutError("test stream was not released")
+        return self.stream.write(value)
+
+    def flush(self) -> None:
+        self.stream.flush()
+
+
+class _BrokenStream:
+    def __init__(self, fd: int) -> None:
+        self.fd = fd
+
+    def fileno(self) -> int:
+        return self.fd
+
+    def write(self, value: str) -> int:
+        raise BrokenPipeError("closed")
+
+    def flush(self) -> None:
+        raise BrokenPipeError("closed")
+
+
+class _WriteStartedStream:
+    def __init__(self, stream: TextIO) -> None:
+        self.stream = stream
+        self.started = threading.Event()
+
+    def fileno(self) -> int:
+        return self.stream.fileno()
+
+    def write(self, value: str) -> int:
+        self.started.set()
+        return self.stream.write(value)
+
+    def flush(self) -> None:
+        self.stream.flush()
+
+
+class _MarkerFailingStream(_BlockingStream):
+    def __init__(self, stream: TextIO) -> None:
+        super().__init__(stream)
+        self.marker_failed = False
+
+    def write(self, value: str) -> int:
+        if not self.started.is_set():
+            self.started.set()
+            if not self.release.wait(2.0):
+                raise TimeoutError("test stream was not released")
+        if '"event_type":"log.dropped"' in value and not self.marker_failed:
+            self.marker_failed = True
+            raise BrokenPipeError("first marker write fails")
+        return self.stream.write(value)
+
+
+class _RecordingStream:
+    def __init__(self, stream: TextIO) -> None:
+        self.stream = stream
+        self.writes: list[str] = []
+        self.flushes = 0
+
+    def fileno(self) -> int:
+        return self.stream.fileno()
+
+    def write(self, value: str) -> int:
+        self.writes.append(value)
+        return self.stream.write(value)
+
+    def flush(self) -> None:
+        self.flushes += 1
+        self.stream.flush()
+
+
+@pytest.mark.unit
+def test_full_pipe_does_not_stall_event_loop():
+    # C1: a blocked real stdout fd cannot block producers or the event loop.
+    read_fd, write_fd = os.pipe()
+    os.set_blocking(write_fd, False)
+    while True:
+        try:
+            os.write(write_fd, b"x" * 65536)
+        except BlockingIOError:
+            break
+    os.set_blocking(write_fd, True)
+    stream = os.fdopen(write_fd, "w", buffering=1, encoding="utf-8")
+
+    async def emit_with_watchdog() -> tuple[float, float]:
+        loop = asyncio.get_running_loop()
+        started = loop.time()
+        worst_lag = 0.0
+
+        async def watchdog() -> None:
+            nonlocal worst_lag
+            target = loop.time()
+            for _ in range(5):
+                target += 0.01
+                await asyncio.sleep(max(0.0, target - loop.time()))
+                worst_lag = max(worst_lag, loop.time() - target)
+
+        async def producer() -> None:
+            for index in range(32):
+                log_writer.emit_line(f"queued-{index}", stream)
+            await asyncio.sleep(0)
+
+        await asyncio.gather(producer(), watchdog())
+        return loop.time() - started, worst_lag
+
+    elapsed, worst_lag = asyncio.run(emit_with_watchdog())
+    assert log_writer.flush(0.01) is False
+
+    output = bytearray()
+
+    def drain() -> None:
+        while b"queued-31\n" not in output:
+            chunk = os.read(read_fd, 65536)
+            if not chunk:
+                return
+            output.extend(chunk)
+
+    reader = threading.Thread(target=drain, daemon=True)
+    reader.start()
+    try:
+        assert log_writer.flush(2.0) is True
+        reader.join(2.0)
+        assert not reader.is_alive()
+    finally:
+        stream.close()
+        os.close(read_
```

**File**: `sdk/python/tests/test_logger.py` (modified, +69/-13)
```diff
@@ -1,6 +1,9 @@
+import asyncio
 import io
 import json
 import logging
+import sys
+import tempfile
 import threading
 import time
 from unittest.mock import Mock
@@ -17,6 +20,59 @@
 )
 
 
+@pytest.mark.unit
+def test_structured_record_from_loop_is_deferred_until_writer_drains(monkeypatch):
+    class BlockingStream:
+        def __init__(self, stream):
+            self.stream = stream
+            self.started = threading.Event()
+            self.release = threading.Event()
+
+        def fileno(self):
+            return self.stream.fileno()
+
+        def write(self, value):
+            self.started.set()
+            assert self.release.wait(2.0)
+            return self.stream.write(value)
+
+        def flush(self):
+            self.stream.flush()
+
+    monkeypatch.delenv("AGENTFIELD_LOG_STDOUT", raising=False)
+    with tempfile.TemporaryFile(mode="w+", encoding="utf-8") as target:
+        stream = BlockingStream(target)
+        with monkeypatch.context() as context:
+            context.setattr("sys.stdout", stream)
+            logger = AgentFieldLogger("structured.stdout.writer")
+
+            async def emit() -> None:
+                logger._emit_structured_record({"event_type": "test"})
+
+            asyncio.run(emit())
+            assert stream.started.wait(1.0)
+            target.seek(0)
+            assert target.read() == ""
+
+            stream.release.set()
+            assert logger_module.log_writer.flush(1.0) is True
+
+        target.seek(0)
+        assert json.loads(target.read()) == {"event_type": "test"}
+
+
+@pytest.mark.unit
+def test_structured_record_disabled_does_not_call_log_writer(monkeypatch):
+    emit_line = Mock()
+    monkeypatch.setenv("AGENTFIELD_LOG_STDOUT", "false")
+    monkeypatch.setattr(logger_module.log_writer, "emit_line", emit_line)
+    logger = AgentFieldLogger("structured.stdout.writer-disabled")
+
+    logger._emit_structured_record({"event_type": "test"})
+
+    emit_line.assert_not_called()
+
+
 @pytest.mark.unit
 def test_structured_stdout_can_be_disabled(monkeypatch, capsys):
     monkeypatch.setenv("AGENTFIELD_LOG_STDOUT", "false")
@@ -287,7 +343,7 @@ def test_structured_mirror_is_bounded_valid_json_and_cp_receives_full_record(
 ):
     monkeypatch.setenv("AGENTFIELD_LOG_MAX_LINE_BYTES", "512")
     stream = io.StringIO()
-    monkeypatch.setattr(logger_module.sys, "stdout", stream)
+    monkeypatch.setattr(sys, "stdout", stream)
     logger = AgentFieldLogger("bounded-structured")
     dispatch = Mock()
     monkeypatch.setattr(logger, "_dispatch_to_cp", dispatch)
@@ -317,7 +373,7 @@ def test_structured_mirror_is_bounded_valid_json_and_cp_receives_full_record(
 def test_structured_mirror_elides_oversized_message(monkeypatch):
     monkeypatch.setenv("AGENTFIELD_LOG_MAX_LINE_BYTES", "512")
     stream = io.StringIO()
-    monkeypatch.setattr(logger_module.sys, "stdout", stream)
+    monkeypatch.setattr(sys, "stdout", stream)
 
     AgentFieldLogger("oversized-message").log_execution(
         "λ" * 4000, event_type="test.oversized-message"
@@ -333,7 +389,7 @@ def test_structured_mirror_elides_oversized_message(monkeypatch):
 def test_structured_mirror_elides_oversized_non_dict_attributes(monkeypatch):
     monkeypatch.setenv("AGENTFIELD_LOG_MAX_LINE_BYTES", "512")
     stream = io.StringIO()
-    monkeypatch.setattr(logger_module.sys, "stdout", stream)
+    monkeypatch.setattr(sys, "stdout", stream)
     logger = AgentFieldLogger("non-dict-attributes")
     record = logger._build_execution_record(
         message="kept", level="INFO", event_type="test.non-dict"
@@ -351,7 +407,7 @@ def test_structured_mirror_elides_oversized_non_dict_attributes(monkeypatch):
 @pytest.mark.unit
 def test_structured_mirror_many_large_attributes_stays_fast(monkeypatch):
     monkeypatch.setenv("AGENTFIELD_LOG_MAX_LINE_BYTES", "4000")
-    monkeypatch.setattr(logger_module.sys, "stdout", io.StringIO())
+    monkeypatch.setattr(sys, "stdout", io.StringIO())
     attributes = {f"key-{index}": "x" * 50_000 for index in range(200)}
 
     start = time.perf_counter()
@@ -368,7 +424,7 @@ def test_structured_mirror_serializes_large_string_payload_at_most_once(monkeypa
     budget = 16384
     monkeypatch.setenv("AGENTFIELD_LOG_MAX_LINE_BYTES", str(budget))
     stream = io.StringIO()
-    monkeypatch.setattr(logger_module.sys, "stdout", stream)
+    monkeypatch.setattr(sys, "stdout", stream)
     calls = []
     real_dumps = logger_module.json.dumps
 
@@ -416,7 +472,7 @@ def __len__(self):
 
     monkeypatch.setenv("AGENTFIELD_LOG_MAX_LINE_BYTES", "16384")
     stream = io.StringIO()
-    monkeypatch.setattr(logger_module.sys, "stdout", stream)
+    monkeypatch.setattr(sys, "stdout", stream)
     record = {
         "message": "bounded",
         "attributes": {
@@ -440,7 +496,7 @@ def __len__(self):
 def test_structured_mirror_non_string_attribute_keys_have_exact_sizes(monkeypatch):
     monkeypatch.setenv("AGENTFIELD_LOG_MAX_LINE_BYTES", "512")
     stream = io.
```

**File**: `sdk/python/tests/test_node_logs.py` (modified, +79/-0)
```diff
@@ -7,9 +7,11 @@
 import asyncio
 import io
 import json
+import os
 import queue
 import sys
 import threading
+import time
 
 import pytest
 
@@ -338,6 +340,83 @@ async def test_async_idle_follower_cancels_without_a_log_or_worker_thread(monkey
 
 
 class TestTeeTextIO:
+    @pytest.mark.skipif(not hasattr(os, "fork"), reason="requires os.fork")
+    def test_fork_child_resets_tee_ring_and_follower_locks(self, monkeypatch):
+        import agentfield.node_logs as nl
+
+        ring = ProcessLogRing(max_bytes=1024 * 1024)
+        tee = _TeeTextIO("stdout", io.StringIO(), ring, max_line_bytes=1024)
+        tee._buf = "parent-partial"
+        monkeypatch.setattr(nl, "_global_ring", ring)
+        monkeypatch.setattr(nl, "_installed_tees", [tee])
+        monkeypatch.setattr(nl, "_follow_queues", [queue.Queue()])
+
+        old_tee_lock = tee._write_lock
+        old_ring_lock = ring._lock
+        old_follow_lock = nl._follow_lock
+        holding = threading.Event()
+        release = threading.Event()
+
+        def hold_tee_lock() -> None:
+            with old_tee_lock:
+                holding.set()
+                release.wait(5.0)
+
+        holder = threading.Thread(target=hold_tee_lock, daemon=True)
+        holder.start()
+        assert holding.wait(1.0)
+
+        read_fd, write_fd = os.pipe()
+        pid = os.fork()
+        if pid == 0:  # pragma: no cover - assertions happen in the parent
+            os.close(read_fd)
+            child_result = b"error"
+            child_exit = 1
+            try:
+                locks_reset = (
+                    tee._write_lock is not old_tee_lock
+                    and ring._lock is not old_ring_lock
+                    and nl._follow_lock is not old_follow_lock
+                    and nl._follow_queues == []
+                    and tee._buf == ""
+                )
+                if locks_reset:
+                    tee.write("child-line\n")
+                    locks_reset = ring.tail(1)[0].line == "child-line"
+                child_result = b"ok" if locks_reset else b"not-reset"
+                child_exit = 0 if locks_reset else 1
+            except BaseException:
+                pass
+            try:
+                os.write(write_fd, child_result)
+            finally:
+                os.close(write_fd)
+                os._exit(child_exit)
+
+        os.close(write_fd)
+        release.set()
+        holder.join(1.0)
+        assert not holder.is_alive()
+
+        deadline = time.monotonic() + 3.0
+        status = None
+        while status is None and time.monotonic() < deadline:
+            waited_pid, waited_status = os.waitpid(pid, os.WNOHANG)
+            if waited_pid == pid:
+                status = waited_status
+                break
+            time.sleep(0.01)
+        if status is None:
+            os.kill(pid, 9)
+            os.waitpid(pid, 0)
+            os.close(read_fd)
+            pytest.fail("fork child deadlocked on an inherited tee lock")
+
+        child_result = os.read(read_fd, 64)
+        os.close(read_fd)
+        assert os.waitstatus_to_exitcode(status) == 0
+        assert child_result == b"ok"
+
     def test_concurrent_complete_lines_are_not_interleaved_or_duplicated(self):
         original = io.StringIO()
         ring = ProcessLogRing(max_bytes=16 * 1024 * 1024)
```

---

### Incident Patch 10: `c5407ca1` (2026-09-19)
**Commit Message**: fix(storage): mirror reaper parent/child and approval guards in stale retry (#1062)

* issue/reaper-retry-child-guard: mirror reaper parent/child and approval guards in stale retry

* chore(reaper-retry-child-guard): checkpoint uncommitted issue work

**File**: `control-plane/internal/storage/execution_records.go` (modified, +12/-0)
```diff
@@ -1605,6 +1605,12 @@ func (ls *LocalStorage) retryStaleWorkflowExecutions(ctx context.Context, staleA
 		  AND w.retry_count < ?
 		  AND `+workflowTSExpr+` <= `+cutoffExpr+`
 		  AND (e.execution_id IS NULL OR `+executionTSExpr+` <= `+cutoffExpr+`)
+		  AND COALESCE(w.approval_status, '') != 'pending'
+		  AND NOT EXISTS (
+		      SELECT 1 FROM workflow_executions c
+		      WHERE c.parent_execution_id = w.execution_id
+		        AND c.status IN ('running', 'pending', 'queued', 'waiting')
+		  )
 		ORDER BY `+workflowTSExpr+` ASC
 		LIMIT ?`, maxRetries, cutoff, cutoff, limit)
 	if err != nil {
@@ -1666,6 +1672,12 @@ func (ls *LocalStorage) retryStaleWorkflowExecutions(ctx context.Context, staleA
 		            AND e.status IN ('running', 'pending', 'queued', 'waiting')
 		            AND `+executionTSExpr+` <= `+cutoffExpr+`
 		      )
+		  )
+		  AND COALESCE(w.approval_status, '') != 'pending'
+		  AND NOT EXISTS (
+		      SELECT 1 FROM workflow_executions c
+		      WHERE c.parent_execution_id = w.execution_id
+		        AND c.status IN ('running', 'pending', 'queued', 'waiting')
 		  )`)
 	if err != nil {
 		return nil, fmt.Errorf("prepare retry statement: %w", err)
```

**File**: `control-plane/internal/storage/retry_stale_test.go` (modified, +154/-0)
```diff
@@ -539,6 +539,160 @@ func TestRetryStaleWorkflowExecutions_TerminalPairedExecutionStillRetried(t *tes
 		"the terminal execution half must keep its committed timestamp")
 }
 
+// TestStaleParentWithLiveChildIsSparedByReaperAndRetry is the regression for
+// the reaper's parent/child guard leaking into the retry sweep: a parent whose
+// own workflow and execution clocks are stale while it waits on a live child
+// must be spared by MarkStaleWorkflowExecutions and, equally, by
+// RetryStaleWorkflowExecutions. Without the child guard in the retry, the
+// parent is reset to pending and its paired execution is dragged back to
+// pending while the child is still working.
+func TestStaleParentWithLiveChildIsSparedByReaperAndRetry(t *testing.T) {
+	ls, ctx := setupRetryTestStorage(t)
+	now := time.Now().UTC()
+	staleAt := now.Add(-2 * time.Hour)
+
+	// Parent: both clocks are two hours stale, so absent the child guard it is
+	// a candidate for both sweeps.
+	const parentID = "exec-parent-live-child"
+	require.NoError(t, ls.StoreWorkflowExecution(ctx, retryTestWorkflow(parentID, staleAt)))
+	require.NoError(t, ls.CreateExecutionRecord(ctx, retryTestExecution(parentID, staleAt)))
+	backdateExecutionUpdatedAt(t, ls, "executions", parentID, staleAt)
+
+	// Child: created now, still running, and parented to the parent. Its
+	// activity is what must shield the parent.
+	const childID = "exec-child-live"
+	childWorkflow := retryTestWorkflow(childID, now)
+	childWorkflow.ParentExecutionID = strPtr(parentID)
+	require.NoError(t, ls.StoreWorkflowExecution(ctx, childWorkflow))
+
+	childExecution := retryTestExecution(childID, now)
+	childExecution.ParentExecutionID = strPtr(parentID)
+	require.NoError(t, ls.CreateExecutionRecord(ctx, childExecution))
+
+	parentBefore, err := ls.GetWorkflowExecution(ctx, parentID)
+	require.NoError(t, err)
+	childBefore, err := ls.GetWorkflowExecution(ctx, childID)
+	require.NoError(t, err)
+	childExecutionBefore, err := ls.GetExecutionRecord(ctx, childID)
+	require.NoError(t, err)
+
+	reaped, err := ls.MarkStaleWorkflowExecutions(ctx, 30*time.Minute, 100)
+	require.NoError(t, err)
+	require.Equal(t, 0, reaped, "a live child must shield its parent from the reaper")
+
+	retried, err := ls.RetryStaleWorkflowExecutions(ctx, 30*time.Minute, 3, 100)
+	require.NoError(t, err)
+	require.Empty(t, retried, "a live child must shield its parent from the retry sweep")
+
+	parent, err := ls.GetWorkflowExecution(ctx, parentID)
+	require.NoError(t, err)
+	require.Equal(t, "running", parent.Status)
+	require.Equal(t, 0, parent.RetryCount)
+	require.Nil(t, parent.ErrorMessage)
+	require.Nil(t, parent.CompletedAt)
+	require.True(t, parent.UpdatedAt.Equal(parentBefore.UpdatedAt),
+		"the parent must keep its committed updated_at")
+
+	parentExecution, err := ls.GetExecutionRecord(ctx, parentID)
+	require.NoError(t, err)
+	require.Equal(t, "running", parentExecution.Status)
+
+	child, err := ls.GetWorkflowExecution(ctx, childID)
+	require.NoError(t, err)
+	require.Equal(t, "running", child.Status)
+	require.Equal(t, 0, child.RetryCount)
+	require.Nil(t, child.CompletedAt)
+	require.True(t, child.UpdatedAt.Equal(childBefore.UpdatedAt), "the child must be untouched")
+
+	childExecutionAfter, err := ls.GetExecutionRecord(ctx, childID)
+	require.NoError(t, err)
+	require.Equal(t, "running", childExecutionAfter.Status)
+	require.True(t, childExecutionAfter.UpdatedAt.Equal(childExecutionBefore.UpdatedAt),
+		"the child execution must be untouched")
+}
+
+// TestRetryStaleWorkflowExecutions_ApprovalStatusGuard pins the approval half
+// of the mirrored guard pair: a stale workflow whose approval is still pending
+// must be spared by the retry sweep exactly as the reaper spares it, while a
+// stale workflow whose approval has been decided ('approved') remains a valid
+// retry candidate. Every other fixture in this file has a NULL approval_status
+// and is retried, which already covers the empty-string COALESCE branch.
+func TestRetryStaleWorkflowExecutions_ApprovalStatusGuard(t *testing.T) {
+	ls, ctx := setupRetryTestStorage(t)
+	now := time.Now().UTC()
+	staleAt := now.Add(-2 * time.Hour)
+
+	pending := retryTestWorkflow("exec-retry-approval-pending", staleAt)
+	pending.ApprovalStatus = strPtr("pending")
+	require.NoError(t, ls.StoreWorkflowExecution(ctx, pending))
+
+	approved := retryTestWorkflow("exec-retry-approval-approved", staleAt)
+	approved.ApprovalStatus = strPtr("approved")
+	require.NoError(t, ls.StoreWorkflowExecution(ctx, approved))
+
+	pendingBefore, err := ls.GetWorkflowExecution(ctx, pending.ExecutionID)
+	require.NoError(t, err)
+
+	retried, err := ls.RetryStaleWorkflowExecutions(ctx, 30*time.Minute, 3, 100)
+	require.NoError(t, err)
+	require.Equal(t, []string{approved.ExecutionID}, retried,
+		"only the decided-approval workflow may be retried; the pending one must be spared")
+
+	pendingAfter, err := ls.GetWorkflowExecution(ctx, pending.ExecutionID)
+	require.NoError(t, err)
+	require.Eq
```

---

### Incident Patch 11: `44d1022a` (2026-09-18)
**Commit Message**: fix(security): close open Dependabot vulnerability alerts (#1055)

* fix(security): close open Dependabot vulnerability alerts

Bump vulnerable dependencies across the monorepo to patched releases:

- next 15.5.25 + sharp 0.35.4 (rag evaluation UI RCE / libheif)
- js-yaml 4.3.2 (empty merge-source CPU DoS)
- fast-uri 3.1.7 (host confusion / SSRF)
- google.golang.org/grpc v1.83.2 (xDS authority DoS)
- browserslist 4.28.9 + baseline-browser-mapping 2.11.23
- hono 4.13.7 (toSSG path traversal)
- qs 6.16.0 (arrayLimit / isBuffer DoS)
- vitest / @vitest/mocker 4.1.11 (redirect mock path traversal)

Regenerated affected npm/pnpm lockfiles and go.sum.

Co-authored-by: Santosh kumar <[REDACTED_EMAIL]>

* fix(security): regenerate npm lockfiles for npm ci sync

Full npm install (not package-lock-only) so control-plane web client
and desktop locks include all transitive deps required by npm ci.

Co-authored-by: Santosh kumar <[REDACTED_EMAIL]>

* fix(security): close remaining Dependabot alerts

- @humanfs/node 0.16.8 (pnpm lock still had 0.16.7 symlink copy)
- postcss-selector-parser 6.1.4 (pnpm lock still had 6.1.2 AST DoS)
- @ai-sdk/provider-utils 4.0.51 including v5/v6 aliases (resource 

**File**: `control-plane/go.mod` (modified, +7/-7)
```diff
@@ -28,10 +28,10 @@ require (
 	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.43.0
 	go.opentelemetry.io/otel/sdk v1.44.0
 	go.opentelemetry.io/otel/trace v1.44.0
-	golang.org/x/crypto v0.52.0
-	golang.org/x/term v0.43.0
+	golang.org/x/crypto v0.55.0
+	golang.org/x/term v0.45.0
 	golang.org/x/time v0.15.0
-	google.golang.org/grpc v1.83.1
+	google.golang.org/grpc v1.83.2
 	google.golang.org/protobuf v1.36.11
 	gopkg.in/yaml.v3 v3.0.1
 	gorm.io/driver/postgres v1.5.11
@@ -109,10 +109,10 @@ require (
 	go.uber.org/atomic v1.9.0 // indirect
 	go.uber.org/multierr v1.9.0 // indirect
 	golang.org/x/arch v0.15.0 // indirect
-	golang.org/x/net v0.55.0 // indirect
-	golang.org/x/sync v0.20.0 // indirect
-	golang.org/x/sys v0.45.0 // indirect
-	golang.org/x/text v0.37.0 // indirect
+	golang.org/x/net v0.58.0 // indirect
+	golang.org/x/sync v0.22.0 // indirect
+	golang.org/x/sys v0.47.0 // indirect
+	golang.org/x/text v0.41.0 // indirect
 	google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa // indirect
 	google.golang.org/genproto/googleapis/rpc v0.0.0-20260526163538-3dc84a4a5aaa // indirect
 	modernc.org/gc/v3 v3.0.0-20240107210532-573471604cb6 // indirect
```

**File**: `control-plane/go.sum` (modified, +18/-18)
```diff
@@ -240,38 +240,38 @@ go.uber.org/multierr v1.9.0 h1:7fIwc/ZtS0q++VgcfqFDxSBZVv/Xo49/SYnDFupUwlI=
 go.uber.org/multierr v1.9.0/go.mod h1:X2jQV1h+kxSjClGpnseKVIxpmcjrj7MNnI0bnlfKTVQ=
 golang.org/x/arch v0.15.0 h1:QtOrQd0bTUnhNVNndMpLHNWrDmYzZ2KDqSrEymqInZw=
 golang.org/x/arch v0.15.0/go.mod h1:JmwW7aLIoRUKgaTzhkiEFxvcEiQGyOg9BMonBJUS7EE=
-golang.org/x/crypto v0.52.0 h1:RMs7fP2rXdep0CftQlK8Uf+kibLm7qkCcradZWYz988=
-golang.org/x/crypto v0.52.0/go.mod h1:1QgfPxDqh0T2M/elOJtp9RvuR95kVjir0e6/BvEmGbc=
+golang.org/x/crypto v0.55.0 h1:+KWHjbgOaAQ66dh/YlkZKHlz9ZUlq61AFirAR9ntP8M=
+golang.org/x/crypto v0.55.0/go.mod h1:uq0V9dE/fzQuJtbnL+2EhWOE63vo164FY8xqEnV9xis=
 golang.org/x/exp v0.0.0-20231108232855-2478ac86f678 h1:mchzmB1XO2pMaKFRqk/+MV3mgGG96aqaPXaMifQU47w=
 golang.org/x/exp v0.0.0-20231108232855-2478ac86f678/go.mod h1:zk2irFbV9DP96SEBUUAy67IdHUaZuSnrz1n472HUCLE=
-golang.org/x/mod v0.35.0 h1:Ww1D637e6Pg+Zb2KrWfHQUnH2dQRLBQyAtpr/haaJeM=
-golang.org/x/mod v0.35.0/go.mod h1:+GwiRhIInF8wPm+4AoT6L0FA1QWAad3OMdTRx4tFYlU=
-golang.org/x/net v0.55.0 h1:bcvxaJn3e1U6InsFWt1JUq1aSjnRxLzT2rtD2KfkDF8=
-golang.org/x/net v0.55.0/go.mod h1:L5U2KuzuOe1lY7Z+aWVIKK6qEeJXnXV9yzGA+WCHJww=
-golang.org/x/sync v0.20.0 h1:e0PTpb7pjO8GAtTs2dQ6jYa5BWYlMuX047Dco/pItO4=
-golang.org/x/sync v0.20.0/go.mod h1:9xrNwdLfx4jkKbNva9FpL6vEN7evnE43NNNJQ2LF3+0=
+golang.org/x/mod v0.38.0 h1:MECBjubtXD7yj4HrhIUcywNaGeNVUdfVnxmPajOk4yk=
+golang.org/x/mod v0.38.0/go.mod h1:V6Xz0pq8TQ3dGqVQ1FVHuelZpAL0uNhSkk9ogYP3c40=
+golang.org/x/net v0.58.0 h1:ynWG7rqYi4ccpTEuPZ2QGWHktVEM9DMCj9yzDE0Q7To=
+golang.org/x/net v0.58.0/go.mod h1:YwCddHnFlT7eLQqVprV19OnhLGtc5xOKgE0RyqgfWAU=
+golang.org/x/sync v0.22.0 h1:SZjpbeLmrCk4xhRSZFNZW5gFUeCeFgjekvI/+gfScek=
+golang.org/x/sync v0.22.0/go.mod h1:9xrNwdLfx4jkKbNva9FpL6vEN7evnE43NNNJQ2LF3+0=
 golang.org/x/sys v0.0.0-20210809222454-d867a43fc93e/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
 golang.org/x/sys v0.0.0-20220811171246-fbc7d0a398ab/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
 golang.org/x/sys v0.6.0/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
 golang.org/x/sys v0.12.0/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
-golang.org/x/sys v0.45.0 h1:dO4czNzziLiiXplLQgBCEpCvXQ3dnkn0SdaZSYdQ+FY=
-golang.org/x/sys v0.45.0/go.mod h1:4GL1E5IUh+htKOUEOaiffhrAeqysfVGipDYzABqnCmw=
-golang.org/x/term v0.43.0 h1:S4RLU2sB31O/NCl+zFN9Aru9A/Cq2aqKpTZJ6B+DwT4=
-golang.org/x/term v0.43.0/go.mod h1:lrhlHNdQJHO+1qVYiHfFKVuVioJIheAc3fBSMFYEIsk=
-golang.org/x/text v0.37.0 h1:Cqjiwd9eSg8e0QAkyCaQTNHFIIzWtidPahFWR83rTrc=
-golang.org/x/text v0.37.0/go.mod h1:a5sjxXGs9hsn/AJVwuElvCAo9v8QYLzvavO5z2PiM38=
+golang.org/x/sys v0.47.0 h1:o7XGOvZQCADBQQ4Y7VNq2dRWQR7JmOUW8Kxx4ZsNgWs=
+golang.org/x/sys v0.47.0/go.mod h1:4GL1E5IUh+htKOUEOaiffhrAeqysfVGipDYzABqnCmw=
+golang.org/x/term v0.45.0 h1:NwWyBmoJCbfTHpxrWoZ9C6/VxOf7ic219I8xZZFdrf0=
+golang.org/x/term v0.45.0/go.mod h1:9aqxs0blBcrm/n0L9QW0aRVD+ktan8ssZromtqJC43w=
+golang.org/x/text v0.41.0 h1:vz/seA0lnX87Othu2f/0L24RcgrXD9/YFTSuGjj3rH8=
+golang.org/x/text v0.41.0/go.mod h1:jvf1O8ajNzZqhSrQBPbutR/EB83Cc0CFrezNQIwbb5M=
 golang.org/x/time v0.15.0 h1:bbrp8t3bGUeFOx08pvsMYRTCVSMk89u4tKbNOZbp88U=
 golang.org/x/time v0.15.0/go.mod h1:Y4YMaQmXwGQZoFaVFk4YpCt4FLQMYKZe9oeV/f4MSno=
-golang.org/x/tools v0.44.0 h1:UP4ajHPIcuMjT1GqzDWRlalUEoY+uzoZKnhOjbIPD2c=
-golang.org/x/tools v0.44.0/go.mod h1:KA0AfVErSdxRZIsOVipbv3rQhVXTnlU6UhKxHd1seDI=
+golang.org/x/tools v0.48.0 h1:3+hClM1aLL5mjMKm5ovokw9epgRXPuu2tILgismM6RE=
+golang.org/x/tools v0.48.0/go.mod h1:08xX0orndb/F7jJxGDicx061tyd5pcMto75YMAXr6lk=
 gonum.org/v1/gonum v0.17.0 h1:VbpOemQlsSMrYmn7T2OUvQ4dqxQXU+ouZFQsZOx50z4=
 gonum.org/v1/gonum v0.17.0/go.mod h1:El3tOrEuMpv2UdMrbNlKEh9vd86bmQ6vqIcDwxEOc1E=
 google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa h1:Kjn0N0tCrDgiAFW+lGO4JZ3ck44CehvJQMAwj9QF0G8=
 google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa/go.mod h1:q4lMZS6kskjT5HvCPrnnypcDPVJqT/f4nfxmkE7gryY=
 google.golang.org/genproto/googleapis/rpc v0.0.0-20260526163538-3dc84a4a5aaa h1:mZHHdPZl0dbGHCflZgAq/Q468DWVFcU2whhB2KAo8fk=
 google.golang.org/genproto/googleapis/rpc v0.0.0-20260526163538-3dc84a4a5aaa/go.mod h1:4Hqkh8ycfw05ld/3BWL7rJOSfebL2Q+DVDeRgYgxUU8=
-google.golang.org/grpc v1.83.1 h1:HIO0+BEtBP6soyqvqC8sNUjZ7bTs+0hFQuFF+RAy++Y=
-google.golang.org/grpc v1.83.1/go.mod h1:kDyl6SKsiHKt0uylY5gtn5cEjkrIOhQOGDgIc4JGwzQ=
+google.golang.org/grpc v1.83.2 h1:EManeRomTObA0BU7I8vXgg/78uE5MJ9M8B39EX2WscU=
+google.golang.org/grpc v1.83.2/go.mod h1:YPI1hK3kDked6iHvgX3tR0y+nX/qpMFKhPgFsokw1S8=
 google.golang.org/protobuf v1.36.11 h1:fV6ZwhNocDyBLK0dj+fg8ektcVegBBuEolpbTQyBNVE=
 google.golang.org/protobuf v1.36.11/go.mod h1:HTf+CrKn2C3g5S8VImy6tdcUvCska2kB7j23XfzDpco=
 gopkg.in/check.v1 v0.0.0-20161208181325-20d25e280405/go.mod h1:Co6ibVJAznAaIkqp8huTwlJQCZ016jof/cbN4VW5Yz0=
```

**File**: `control-plane/web/client/package-lock.json` (modified, +87/-79)
```diff
@@ -64,7 +64,7 @@
                 "@types/react": "^19.1.2",
                 "@types/react-dom": "^19.1.2",
                 "@vitejs/plugin-react": "^6.0.1",
-                "@vitest/coverage-v8": "^4.1.8",
+                "@vitest/coverage-v8": "^4.1.11",
                 "autoprefixer": "^10.4.21",
                 "eslint": "^9.25.0",
                 "eslint-plugin-react-hooks": "^5.2.0",
@@ -77,7 +77,7 @@
                 "typescript": "~5.8.3",
                 "typescript-eslint": "^8.30.1",
                 "vite": "^8.0.16",
-                "vitest": "^4.1.8"
+                "vitest": "^4.1.11"
             }
         },
         "node_modules/@adobe/css-tools": {
@@ -482,17 +482,17 @@
             }
         },
         "node_modules/@deck.gl/widgets": {
-            "version": "9.2.2",
-            "resolved": "https://registry.npmjs.org/@deck.gl/widgets/-/widgets-9.2.2.tgz",
-            "integrity": "sha512-CuXRMHlLU+3YJjbicxp84BtIks4dLVXm2txIwUQPHqZ99zSI30SQgnhHUOJi5tJMODLD26HaQaZo0Jp3Z+sRbQ==",
+            "version": "9.2.11",
+            "resolved": "https://registry.npmjs.org/@deck.gl/widgets/-/widgets-9.2.11.tgz",
+            "integrity": "sha512-90HWlQPsiRyTPWR4aYfLwnYDrJdHG2mqCzRcyMUKewWBNQLu4upB//l4ewIkUeXXCzAprjjVeRnNb7wdYj2CXQ==",
             "license": "MIT",
             "peer": true,
             "dependencies": {
                 "preact": "^10.17.0"
             },
             "peerDependencies": {
                 "@deck.gl/core": "~9.2.0",
-                "@luma.gl/core": "~9.2.2"
+                "@luma.gl/core": "~9.2.6"
             }
         },
         "node_modules/@emnapi/core": {
@@ -1366,9 +1366,9 @@
             "license": "MIT"
         },
         "node_modules/@luma.gl/core": {
-            "version": "9.2.4",
-            "resolved": "https://registry.npmjs.org/@luma.gl/core/-/core-9.2.4.tgz",
-            "integrity": "sha512-oYuHlpvd4e6E4hre7I7gnmCtcTDdpgREnumgjcPTe8VVsimnYM2P+vBqdOE7AUlOHDS8r//7YxM2bFvlDkcM8w==",
+            "version": "9.2.6",
+            "resolved": "https://registry.npmjs.org/@luma.gl/core/-/core-9.2.6.tgz",
+            "integrity": "sha512-d8KcH8ZZcjDAodSN/G2nueA9YE2X8kMz7Q0OxDGpCww6to1MZXM3Ydate/Jqsb5DDKVgUF6yD6RL8P5jOki9Yw==",
             "license": "MIT",
             "dependencies": {
                 "@math.gl/types": "^4.1.0",
@@ -3508,9 +3508,9 @@
             }
         },
         "node_modules/@testing-library/dom": {
-            "version": "10.4.1",
-            "resolved": "https://registry.npmjs.org/@testing-library/dom/-/dom-10.4.1.tgz",
-            "integrity": "sha512-o4PXJQidqJl82ckFaXUeoAW+XysPLauYI43Abki5hABd853iMhitooc6znOnczgbTYmEP6U6/y1ZyKAIsvMKGg==",
+            "version": "10.4.2",
+            "resolved": "https://registry.npmjs.org/@testing-library/dom/-/dom-10.4.2.tgz",
+            "integrity": "sha512-yzr2S9HyAIdhz2/6qHgbs665Q7PKVcDF05vsOlHPxG1mo36gKVesdYVeDLnXgfjJ03CrKRk08knc6+E/9m8v2Q==",
             "dev": true,
             "license": "MIT",
             "peer": true,
@@ -4149,14 +4149,14 @@
             }
         },
         "node_modules/@vitest/coverage-v8": {
-            "version": "4.1.8",
-            "resolved": "https://registry.npmjs.org/@vitest/coverage-v8/-/coverage-v8-4.1.8.tgz",
-            "integrity": "sha512-lt3kovsyHwYe00wq4D1ti0Z974fWj4NLp6siqiyEufUpyFwK9Yhi7rBhac9JL5aA0zoMrJqc4vYPZRUnI7l7nw==",
+            "version": "4.1.11",
+            "resolved": "https://registry.npmjs.org/@vitest/coverage-v8/-/coverage-v8-4.1.11.tgz",
+            "integrity": "sha512-8MVGEFnJIcdGjcbfKmeq8z0pZHH0JlVtoVZH9Q/qwUp6wyFnEJUBMrw9DCaj+ra3vShGmhavjalMIhPNxZAUcw==",
             "dev": true,
             "license": "MIT",
             "dependencies": {
                 "@bcoe/v8-coverage": "^1.0.2",
-                "@vitest/utils": "4.1.8",
+                "@vitest/utils": "4.1.11",
                 "ast-v8-to-istanbul": "^1.0.0",
                 "istanbul-lib-coverage": "^3.2.2",
                 "istanbul-lib-report": "^3.0.1",
@@ -4170,8 +4170,8 @@
                 "url": "https://opencollective.com/vitest"
             },
             "peerDependencies": {
-                "@vitest/browser": "4.1.8",
-                "vitest": "4.1.8"
+                "@vitest/browser": "4.1.11",
+                "vitest": "4.1.11"
             },
             "peerDependenciesMeta": {
                 "@vitest/browser": {
@@ -4180,16 +4180,16 @@
             }
         },
         "node_modules/@vitest/expect": {
-            "version": "4.1.8",
-            "resolved": "https://registry.npmjs.org/@vitest/expect/-/expect-4.1.8.tgz",
-            "integrity": "sha512-h3nDO677RDLEGlBxyQ5CW8RlMThSKSRLUePLOx09gNIWRL40edgA1GCZSZgf1W55MFAG6/Sw14KeaAnqv0NKdQ==",
+            "version": "4.1.11",
+            "resolved": "https://registry.npmjs.org/@vitest/expect/-/expect-4.1.11.tgz",
+            "integrity": "sha512-VX2x5vNJXET47KAFzwERI+KRMtTTCSWTfSMKsW7JsUsXV4psq++e3DvZpuTDOpHcxytiDs6p2nhVb2tVDi
```

**File**: `control-plane/web/client/package.json` (modified, +14/-6)
```diff
@@ -69,7 +69,7 @@
         "@types/react": "^19.1.2",
         "@types/react-dom": "^19.1.2",
         "@vitejs/plugin-react": "^6.0.1",
-        "@vitest/coverage-v8": "^4.1.8",
+        "@vitest/coverage-v8": "^4.1.11",
         "autoprefixer": "^10.4.21",
         "eslint": "^9.25.0",
         "eslint-plugin-react-hooks": "^5.2.0",
@@ -82,26 +82,34 @@
         "typescript": "~5.8.3",
         "typescript-eslint": "^8.30.1",
         "vite": "^8.0.16",
-        "vitest": "^4.1.8"
+        "vitest": "^4.1.11"
     },
     "overrides": {
-        "js-yaml": "4.3.1",
+        "js-yaml": "4.3.2",
+        "browserslist": "4.28.9",
+        "baseline-browser-mapping": "2.11.23",
         "nanoid": "3.3.18",
         "esbuild": "0.28.1",
         "ws": "8.21.0",
         "brace-expansion@1": "1.1.18",
         "brace-expansion@2": "2.1.4",
-        "postcss": "$postcss"
+        "postcss": "$postcss",
+        "@humanfs/node": "0.16.8",
+        "postcss-selector-parser": "6.1.4"
     },
     "pnpm": {
         "overrides": {
-            "js-yaml": "4.3.1",
+            "js-yaml": "4.3.2",
+            "browserslist": "4.28.9",
+            "baseline-browser-mapping": "2.11.23",
             "nanoid": "3.3.18",
             "esbuild": "0.28.1",
             "ws": "8.21.0",
             "brace-expansion@1": "1.1.18",
             "brace-expansion@2": "2.1.4",
-            "postcss": "8.5.25"
+            "postcss": "8.5.25",
+            "@humanfs/node": "0.16.8",
+            "postcss-selector-parser": "6.1.4"
         }
     }
 }
```

**File**: `control-plane/web/client/pnpm-lock.yaml` (modified, +361/-334)
```diff
@@ -4,6 +4,19 @@ settings:
   autoInstallPeers: true
   excludeLinksFromLockfile: false
 
+overrides:
+  js-yaml: 4.3.2
+  browserslist: 4.28.9
+  baseline-browser-mapping: 2.11.23
+  nanoid: 3.3.18
+  esbuild: 0.28.1
+  ws: 8.21.0
+  brace-expansion@1: 1.1.18
+  brace-expansion@2: 2.1.4
+  postcss: 8.5.25
+  '@humanfs/node': 0.16.8
+  postcss-selector-parser: 6.1.4
+
 importers:
 
   .:
@@ -13,7 +26,7 @@ importers:
         version: 4.0.0(@hookform/resolvers@3.10.0(react-hook-form@7.72.1(react@19.2.8)))(react-hook-form@7.72.1(react@19.2.8))(react@19.2.8)
       '@autoform/shadcn':
         specifier: ^1.0.1
-        version: 1.0.1(@types/react-dom@19.1.9(@types/react@19.1.13))(@types/react@19.1.13)(jiti@1.21.7)(postcss@8.5.25)(react-dom@19.2.8(react@19.2.8))(react@19.2.8)(supports-color@7.2.0)(tailwindcss@3.4.17)(typescript@5.8.3)(yaml@2.8.3)
+        version: 1.0.1(@types/react-dom@19.1.9(@types/react@19.1.13))(@types/react@19.1.13)(jiti@1.21.7)(postcss@8.5.25)(react-dom@19.2.8(react@19.2.8))(react@19.2.8)(tailwindcss@3.4.17)(typescript@5.8.3)(yaml@2.8.3)
       '@autoform/zod':
         specifier: ^5.0.0
         version: 5.0.0(zod@4.3.6)
@@ -121,7 +134,7 @@ importers:
         version: 5.6.0(react@19.2.8)
       react-markdown:
         specifier: ^10.1.0
-        version: 10.1.0(@types/react@19.1.13)(react@19.2.8)(supports-color@7.2.0)
+        version: 10.1.0(@types/react@19.1.13)(react@19.2.8)
       react-router:
         specifier: ^8.3.0
         version: 8.3.0(react-dom@19.2.8(react@19.2.8))(react@19.2.8)
@@ -130,7 +143,7 @@ importers:
         version: 2.15.4(react-dom@19.2.8(react@19.2.8))(react@19.2.8)
       remark-gfm:
         specifier: ^4.0.1
-        version: 4.0.1(supports-color@7.2.0)
+        version: 4.0.1
       sonner:
         specifier: ^2.0.7
         version: 2.0.7(react-dom@19.2.8(react@19.2.8))(react@19.2.8)
@@ -170,30 +183,30 @@ importers:
         version: 19.1.9(@types/react@19.1.13)
       '@vitejs/plugin-react':
         specifier: ^6.0.1
-        version: 6.0.1(vite@8.0.16(@types/node@24.5.2)(esbuild@0.27.7)(jiti@1.21.7)(yaml@2.8.3))
+        version: 6.0.1(vite@8.0.16(@types/node@24.5.2)(esbuild@0.28.1)(jiti@1.21.7)(yaml@2.8.3))
       '@vitest/coverage-v8':
-        specifier: ^4.1.8
-        version: 4.1.8(vitest@4.1.8)
+        specifier: ^4.1.11
+        version: 4.1.11(vitest@4.1.11)
       autoprefixer:
         specifier: ^10.4.21
         version: 10.4.21(postcss@8.5.25)
       eslint:
         specifier: ^9.25.0
-        version: 9.36.0(jiti@1.21.7)(supports-color@7.2.0)
+        version: 9.36.0(jiti@1.21.7)
       eslint-plugin-react-hooks:
         specifier: ^5.2.0
-        version: 5.2.0(eslint@9.36.0(jiti@1.21.7)(supports-color@7.2.0))
+        version: 5.2.0(eslint@9.36.0(jiti@1.21.7))
       eslint-plugin-react-refresh:
         specifier: ^0.4.19
-        version: 0.4.20(eslint@9.36.0(jiti@1.21.7)(supports-color@7.2.0))
+        version: 0.4.20(eslint@9.36.0(jiti@1.21.7))
       globals:
         specifier: ^16.0.0
         version: 16.4.0
       jsdom:
         specifier: ^26.1.0
-        version: 26.1.0(supports-color@7.2.0)
+        version: 26.1.0
       postcss:
-        specifier: ^8.5.25
+        specifier: 8.5.25
         version: 8.5.25
       tailwindcss:
         specifier: ^3.4.17
@@ -206,13 +219,13 @@ importers:
         version: 5.8.3
       typescript-eslint:
         specifier: ^8.30.1
-        version: 8.44.0(eslint@9.36.0(jiti@1.21.7)(supports-color@7.2.0))(supports-color@7.2.0)(typescript@5.8.3)
+        version: 8.44.0(eslint@9.36.0(jiti@1.21.7))(typescript@5.8.3)
       vite:
         specifier: ^8.0.16
-        version: 8.0.16(@types/node@24.5.2)(esbuild@0.27.7)(jiti@1.21.7)(yaml@2.8.3)
+        version: 8.0.16(@types/node@24.5.2)(esbuild@0.28.1)(jiti@1.21.7)(yaml@2.8.3)
       vitest:
-        specifier: ^4.1.8
-        version: 4.1.8(@types/node@24.5.2)(@vitest/coverage-v8@4.1.8)(jsdom@26.1.0(supports-color@7.2.0))(vite@8.0.16(@types/node@24.5.2)(esbuild@0.27.7)(jiti@1.21.7)(yaml@2.8.3))
+        specifier: ^4.1.11
+        version: 4.1.11(@types/node@24.5.2)(@vitest/coverage-v8@4.1.11)(jsdom@26.1.0)(vite@8.0.16(@types/node@24.5.2)(esbuild@0.28.1)(jiti@1.21.7)(yaml@2.8.3))
 
 packages:
 
@@ -345,158 +358,158 @@ packages:
   '@emnapi/wasi-threads@1.2.1':
     resolution: {integrity: sha512-uTII7OYF+/Mes/MrcIOYp5yOtSMLBWSIoLPpcgwipoiKbli6k322tcoFsxoIIxPDqW01SQGAgko4EzZi2BNv2w==}
 
-  '@esbuild/aix-ppc64@0.27.7':
-    resolution: {integrity: sha512-EKX3Qwmhz1eMdEJokhALr0YiD0lhQNwDqkPYyPhiSwKrh7/4KRjQc04sZ8db+5DVVnZ1LmbNDI1uAMPEUBnQPg==}
+  '@esbuild/aix-ppc64@0.28.1':
+    resolution: {integrity: sha512-Svl7tq8k/08+p6CXPpRjQ1fKX+1odH/BQbb48fV6fj3CWHhsoIOoY87w1oHXm0qEpkIK3ZfVgp0hed3XBXzXMQ==}
     engines: {node: '>=18'}
     cpu: [ppc64]
     os: [aix]
 
-  '@esbuild/android-arm64@0.27.7':
-    resolution: {integrity: sha512-62dPZHpIXzvChfvfLJow3q5dDtiNMkwiRzPylSCfriLvZeq0a1bWChrGx/BbUbPwOrsWKMn8idSllklzBy+dgQ==}
+  '@esbuild/andro
```

**File**: `desktop/package-lock.json` (modified, +156/-224)
```diff
@@ -9,7 +9,7 @@
       "version": "0.1.0",
       "dependencies": {
         "@lobehub/icons-static-svg": "^1.94.0",
-        "js-yaml": "^4.3.1",
+        "js-yaml": "^4.3.2",
         "motion": "^12.42.2"
       },
       "devDependencies": {
@@ -25,7 +25,7 @@
         "react-dom": "^18.3.1",
         "typescript": "^5.7.2",
         "vite": "^6.0.5",
-        "vitest": "^3.0.5"
+        "vitest": "4.1.11"
       }
     },
     "node_modules/@babel/code-frame": {
@@ -747,9 +747,9 @@
       }
     },
     "node_modules/@electron/windows-sign/node_modules/fs-extra": {
-      "version": "11.3.6",
-      "resolved": "https://registry.npmjs.org/fs-extra/-/fs-extra-11.3.6.tgz",
-      "integrity": "sha512-w8ZNZr2mKIc7qeNaQ9AVPT1+iFaI+Avd4xudVOvdDJ8VytREi1Ft5Ih7hd9jjehod8vAM5GMsfQ/TpPf4EyoEA==",
+      "version": "11.4.0",
+      "resolved": "https://registry.npmjs.org/fs-extra/-/fs-extra-11.4.0.tgz",
+      "integrity": "sha512-EQsFzMUJkCKGr1ePqlYADkIUmHW1s3ZXr5Yqy6wbGrfUCphpl2maM/kyOIRA2HpP3AaFQTZXD4ldjek+nccddA==",
       "dev": true,
       "license": "MIT",
       "optional": true,
@@ -1814,6 +1814,13 @@
         "url": "https://github.com/sindresorhus/is?sponsor=1"
       }
     },
+    "node_modules/@standard-schema/spec": {
+      "version": "1.1.0",
+      "resolved": "https://registry.npmjs.org/@standard-schema/spec/-/spec-1.1.0.tgz",
+      "integrity": "sha512-l2aFy5jALhniG5HgqrD6jXLi/rUWrKvqN/qJx6yoJsgKhblVd+iqqU4RCXavm/jPityDo5TCvKMnpjKnOriy0w==",
+      "dev": true,
+      "license": "MIT"
+    },
     "node_modules/@szmarczak/http-timer": {
       "version": "4.0.6",
       "resolved": "https://registry.npmjs.org/@szmarczak/http-timer/-/http-timer-4.0.6.tgz",
@@ -2029,39 +2036,40 @@
       }
     },
     "node_modules/@vitest/expect": {
-      "version": "3.2.7",
-      "resolved": "https://registry.npmjs.org/@vitest/expect/-/expect-3.2.7.tgz",
-      "integrity": "sha512-E8eBXaKibuvH2pSZErOjdVb5vF4PbKYcrnluBTYxEk1l/VhhwZg1kZQsdtjq+CsF5CFydf2Rdkz7jDHKSisi3w==",
+      "version": "4.1.11",
+      "resolved": "https://registry.npmjs.org/@vitest/expect/-/expect-4.1.11.tgz",
+      "integrity": "sha512-VX2x5vNJXET47KAFzwERI+KRMtTTCSWTfSMKsW7JsUsXV4psq++e3DvZpuTDOpHcxytiDs6p2nhVb2tVDiiUYw==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
+        "@standard-schema/spec": "^1.1.0",
         "@types/chai": "^5.2.2",
-        "@vitest/spy": "3.2.7",
-        "@vitest/utils": "3.2.7",
-        "chai": "^5.2.0",
-        "tinyrainbow": "^2.0.0"
+        "@vitest/spy": "4.1.11",
+        "@vitest/utils": "4.1.11",
+        "chai": "^6.2.2",
+        "tinyrainbow": "^3.1.0"
       },
       "funding": {
         "url": "https://opencollective.com/vitest"
       }
     },
     "node_modules/@vitest/mocker": {
-      "version": "3.2.7",
-      "resolved": "https://registry.npmjs.org/@vitest/mocker/-/mocker-3.2.7.tgz",
-      "integrity": "sha512-Trr0hYO9CM3Wj6ksWHRhK9IZpIY6wTMO5u/MqXurMxT57sWBaOPEtP3Oq60ihZuh5JsiagKfz95OcxdEP6dBrA==",
+      "version": "4.1.11",
+      "resolved": "https://registry.npmjs.org/@vitest/mocker/-/mocker-4.1.11.tgz",
+      "integrity": "sha512-2XJVD55d1o5AZous5CCGKS74g/riOj9odEt2bQpCVZeblHyHdnMeFl4jl0XjU21stf4mbjUkew2eXQZt65g5CQ==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
-        "@vitest/spy": "3.2.7",
+        "@vitest/spy": "4.1.11",
         "estree-walker": "^3.0.3",
-        "magic-string": "^0.30.17"
+        "magic-string": "^0.30.21"
       },
       "funding": {
         "url": "https://opencollective.com/vitest"
       },
       "peerDependencies": {
         "msw": "^2.4.9",
-        "vite": "^5.0.0 || ^6.0.0 || ^7.0.0-0"
+        "vite": "^6.0.0 || ^7.0.0 || ^8.0.0"
       },
       "peerDependenciesMeta": {
         "msw": {
@@ -2073,71 +2081,68 @@
       }
     },
     "node_modules/@vitest/pretty-format": {
-      "version": "3.2.7",
-      "resolved": "https://registry.npmjs.org/@vitest/pretty-format/-/pretty-format-3.2.7.tgz",
-      "integrity": "sha512-KUHlwqVu0sRlhCdyPdQ/wBoTfRahjUky1MubOmYw9fWfIZy1gNoHpuaaQBPAaMaVYdQYHJLurzj8ECCj5OwTqA==",
+      "version": "4.1.11",
+      "resolved": "https://registry.npmjs.org/@vitest/pretty-format/-/pretty-format-4.1.11.tgz",
+      "integrity": "sha512-yiZzPbGTS9Sr/JpFl8zHrcIkAofNbFV6k21vIgQN/cY/oxZeXhJv5sc/MBJ5jFKWmWs+oJHw0UXLZjmf931+Vw==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
-        "tinyrainbow": "^2.0.0"
+        "tinyrainbow": "^3.1.0"
       },
       "funding": {
         "url": "https://opencollective.com/vitest"
       }
     },
     "node_modules/@vitest/runner": {
-      "version": "3.2.7",
-      "resolved": "https://registry.npmjs.org/@vitest/runner/-/runner-3.2.7.tgz",
-      "integrity": "sha512-sB9y4ovltoQP+WaUPwmSxO9WIg9Ig694Di5PalVPsYHklAdE027mehpWF2SQSVq+k6sFgaivbTjTJwZLSHbedA==",
+      "version": "4.1.11",
+      "resolved": "https://registry.npmjs.org/@vitest/runner/-/runner-4.1.11.tgz",
+      "integrity": "sha
```

**File**: `desktop/package.json` (modified, +3/-3)
```diff
@@ -75,7 +75,7 @@
   },
   "dependencies": {
     "@lobehub/icons-static-svg": "^1.94.0",
-    "js-yaml": "^4.3.1",
+    "js-yaml": "^4.3.2",
     "motion": "^12.42.2"
   },
   "devDependencies": {
@@ -91,10 +91,10 @@
     "react-dom": "^18.3.1",
     "typescript": "^5.7.2",
     "vite": "^6.0.5",
-    "vitest": "^3.0.5"
+    "vitest": "4.1.11"
   },
   "overrides": {
-    "fast-uri": "3.1.5",
+    "fast-uri": "3.1.7",
     "nanoid": "3.3.18",
     "postcss": "8.5.25",
     "undici": "6.28.0",
```

**File**: `examples/benchmarks/100k-scale/mastra-bench/package-lock.json` (modified, +35/-24)
```diff
@@ -45,9 +45,9 @@
       }
     },
     "node_modules/@ai-sdk/provider": {
-      "version": "3.0.10",
-      "resolved": "https://registry.npmjs.org/@ai-sdk/provider/-/provider-3.0.10.tgz",
-      "integrity": "sha512-Q3BZ27qfpYqnCYGvE3vt+Qi6LGOF9R5Nmzn+9JoM1lCRsD9mYaIhfJLkSunN48nfGXJ6n+XNV0J/XVpqGQl7Dw==",
+      "version": "3.0.16",
+      "resolved": "https://registry.npmjs.org/@ai-sdk/provider/-/provider-3.0.16.tgz",
+      "integrity": "sha512-9Av6kg0t/IN/dcYAAmEJ4B9OPhcEJqwSR+GfHEA8olRkindXpUHadc3p3cyvgFUQFTVm1G5thtsmgZ9yVb2w3A==",
       "license": "Apache-2.0",
       "dependencies": {
         "json-schema": "^0.4.0"
@@ -58,35 +58,37 @@
     },
     "node_modules/@ai-sdk/provider-utils-v5": {
       "name": "@ai-sdk/provider-utils",
-      "version": "4.0.27",
-      "resolved": "https://registry.npmjs.org/@ai-sdk/provider-utils/-/provider-utils-4.0.27.tgz",
-      "integrity": "sha512-ubkAJ+xODouwtmN1tYlvTPphH1hPOBfZaEQe8U7skGvFAnIRs9PPpsq57bC2+Ky/MB4yzhd6YOsxTAx9sGpazw==",
+      "version": "4.0.51",
+      "resolved": "https://registry.npmjs.org/@ai-sdk/provider-utils/-/provider-utils-4.0.51.tgz",
+      "integrity": "sha512-ukLTs9x1Xm6lxSIwbJIxYQxbZHmVeIczNntARZrBcOa6pjdBhqeZnATNnJMHa7M9dZ8Ji5NJbpKpvz7o5XyBtg==",
       "license": "Apache-2.0",
       "dependencies": {
-        "@ai-sdk/provider": "3.0.10",
+        "@ai-sdk/provider": "3.0.16",
         "@standard-schema/spec": "^1.1.0",
-        "eventsource-parser": "^3.0.8"
+        "eventsource-parser": "^3.0.8",
+        "undici": "^6.28.0"
       },
       "engines": {
-        "node": ">=18"
+        "node": ">=18.17"
       },
       "peerDependencies": {
         "zod": "^3.25.76 || ^4.1.8"
       }
     },
     "node_modules/@ai-sdk/provider-utils-v6": {
       "name": "@ai-sdk/provider-utils",
-      "version": "4.0.27",
-      "resolved": "https://registry.npmjs.org/@ai-sdk/provider-utils/-/provider-utils-4.0.27.tgz",
-      "integrity": "sha512-ubkAJ+xODouwtmN1tYlvTPphH1hPOBfZaEQe8U7skGvFAnIRs9PPpsq57bC2+Ky/MB4yzhd6YOsxTAx9sGpazw==",
+      "version": "4.0.51",
+      "resolved": "https://registry.npmjs.org/@ai-sdk/provider-utils/-/provider-utils-4.0.51.tgz",
+      "integrity": "sha512-ukLTs9x1Xm6lxSIwbJIxYQxbZHmVeIczNntARZrBcOa6pjdBhqeZnATNnJMHa7M9dZ8Ji5NJbpKpvz7o5XyBtg==",
       "license": "Apache-2.0",
       "dependencies": {
-        "@ai-sdk/provider": "3.0.10",
+        "@ai-sdk/provider": "3.0.16",
         "@standard-schema/spec": "^1.1.0",
-        "eventsource-parser": "^3.0.8"
+        "eventsource-parser": "^3.0.8",
+        "undici": "^6.28.0"
       },
       "engines": {
-        "node": ">=18"
+        "node": ">=18.17"
       },
       "peerDependencies": {
         "zod": "^3.25.76 || ^4.1.8"
@@ -1429,9 +1431,9 @@
       "license": "MIT"
     },
     "node_modules/fast-uri": {
-      "version": "3.1.5",
-      "resolved": "https://registry.npmjs.org/fast-uri/-/fast-uri-3.1.5.tgz",
-      "integrity": "sha512-gHwA1O9LDIcKunMKhObS/HimwtehO1nPUECKAu5TpKgaO19fcWEl4bliWe1jWxVFvIXztJjjQ4L8XQ1EU9f7Jw==",
+      "version": "3.1.7",
+      "resolved": "https://registry.npmjs.org/fast-uri/-/fast-uri-3.1.7.tgz",
+      "integrity": "sha512-dOvZVzjdZdz7phd9v6jCbwxrBW3fK6n8Rc0CtdmM4bumzMnxywBYhuph6J819RRw/ku+rLbelwfMunktuzVVHg==",
       "funding": [
         {
           "type": "github",
@@ -1636,9 +1638,9 @@
       }
     },
     "node_modules/hono": {
-      "version": "4.12.34",
-      "resolved": "https://registry.npmjs.org/hono/-/hono-4.12.34.tgz",
-      "integrity": "sha512-GqXJqY/xJkJmuloTrnV1ZEXG3fqte+VjkUqoRNZXcrUidiUOP4fMSIHHY4tsqZBK++kVyWmt/AAfSUuy57/eSA==",
+      "version": "4.13.7",
+      "resolved": "https://registry.npmjs.org/hono/-/hono-4.13.7.tgz",
+      "integrity": "sha512-c8/gF9ac8Y78/agExVocyLevgR+JlpNB444Py0FSX8pJoPdYUfUzRcXtYEYGwt6l19qIlVZPN5Mfsw9jFShmQQ==",
       "license": "MIT",
       "engines": {
         "node": ">=16.9.0"
@@ -1801,9 +1803,9 @@
       }
     },
     "node_modules/js-yaml": {
-      "version": "4.3.1",
-      "resolved": "https://registry.npmjs.org/js-yaml/-/js-yaml-4.3.1.tgz",
-      "integrity": "sha512-CY6crGq313MX8GkwvB7tzgp99vjQxY1++5y10/BKN/GUfHqWaOGQMNZkBvqSzsZKWk/ijwHlWzzkLulsGHhjWQ==",
+      "version": "4.3.2",
+      "resolved": "https://registry.npmjs.org/js-yaml/-/js-yaml-4.3.2.tgz",
+      "integrity": "sha512-SFNOvSJ+Dgf/9An904Yx+CgSlIPCkIpao4qo51lpee25TIRejdH3rhR4EZMGoNx3/TP3O+wzWuiTFl4sqbltzA==",
       "funding": [
         {
           "type": "github",
@@ -3325,6 +3327,15 @@
         "url": "https://opencollective.com/express"
       }
     },
+    "node_modules/undici": {
+      "version": "6.28.1",
+      "resolved": "https://registry.npmjs.org/undici/-/undici-6.28.1.tgz",
+      "integrity": "sha512-zWpdTVD54H48CIybL0rWQ3ukpb9d23wM7eH5RtfdmeP70cWHNjtfo7P4vZX+5CoDcO53J4Pu5uXp7lNfjc6DRA==",
+      "license": "MIT",
+      "engines": {
+        "node": ">=18.17"
+      }
+    },
     "node_modules/undici-types": {
       "version": "6.21.0",
       "r
```

---

### Incident Patch 12: `887a3b99` (2026-09-18)
**Commit Message**: fix(storage): rebind postgres tx prepares and guard stale retries (#1051)

* fix(storage): rebind transactional prepares and guard stale retries

* test(storage): verify stale reapers against live PostgreSQL

Adds connection-backed PostgreSQL coverage for the transactional prepare
rebinding and the paired-execution staleness guard:

- reproduce the pre-fix failure at the SQL level (SQLSTATE 42601)
- assert the reaper UPDATE statements reach the driver rebound to $n
- drive MarkStaleExecutions, MarkStaleWorkflowExecutions and
  RetryStaleWorkflowExecutions end to end so a row stale on both clocks is
  reaped while a workflow whose paired execution is still fresh survives
- cover the guard's status filter (a terminal paired execution does not
  shield a stale workflow)

Live tests are gated on POSTGRES_TEST_URL, refuse non-loopback hosts, and
create a throwaway database per test.

* fix(storage): recheck execution staleness between retry statements

RetryStaleWorkflowExecutions repeated the activity predicate in its
workflow UPDATE, but the paired execution UPDATE still only rechecked
status. A heartbeat committing between the two statements was
overwritten, dragging a live execution

**File**: `control-plane/internal/storage/coverage_misc_helpers_test.go` (modified, +114/-0)
```diff
@@ -3,8 +3,10 @@ package storage
 import (
 	"context"
 	"database/sql"
+	"database/sql/driver"
 	"errors"
 	"path/filepath"
+	"sync"
 	"testing"
 
 	"github.com/Agent-Field/agentfield/control-plane/pkg/types"
@@ -17,11 +19,123 @@ type testRollbacker struct {
 	rollbacks int
 }
 
+type prepareCaptureState struct {
+	mu      sync.Mutex
+	queries []string
+}
+
+type prepareCaptureConnector struct {
+	state *prepareCaptureState
+}
+
+type prepareCaptureDriver struct{}
+
+type prepareCaptureConn struct {
+	state *prepareCaptureState
+}
+
+type prepareCaptureTx struct{}
+
+type prepareCaptureStmt struct{}
+
+func (prepareCaptureConnector) Driver() driver.Driver {
+	return prepareCaptureDriver{}
+}
+
+func (c prepareCaptureConnector) Connect(context.Context) (driver.Conn, error) {
+	return &prepareCaptureConn{state: c.state}, nil
+}
+
+func (prepareCaptureDriver) Open(string) (driver.Conn, error) {
+	return nil, errors.New("prepare capture driver requires a connector")
+}
+
+func (c *prepareCaptureConn) recordPrepare(query string) driver.Stmt {
+	c.state.mu.Lock()
+	c.state.queries = append(c.state.queries, query)
+	c.state.mu.Unlock()
+	return prepareCaptureStmt{}
+}
+
+func (c *prepareCaptureConn) Prepare(query string) (driver.Stmt, error) {
+	return c.recordPrepare(query), nil
+}
+
+func (c *prepareCaptureConn) PrepareContext(_ context.Context, query string) (driver.Stmt, error) {
+	return c.recordPrepare(query), nil
+}
+
+func (*prepareCaptureConn) Close() error { return nil }
+
+func (*prepareCaptureConn) Begin() (driver.Tx, error) {
+	return prepareCaptureTx{}, nil
+}
+
+func (prepareCaptureTx) Commit() error   { return nil }
+func (prepareCaptureTx) Rollback() error { return nil }
+
+func (prepareCaptureStmt) Close() error  { return nil }
+func (prepareCaptureStmt) NumInput() int { return -1 }
+func (prepareCaptureStmt) Exec([]driver.Value) (driver.Result, error) {
+	return driver.RowsAffected(0), nil
+}
+func (prepareCaptureStmt) Query([]driver.Value) (driver.Rows, error) {
+	return nil, errors.New("prepare capture query not supported")
+}
+
+func (s *prepareCaptureState) preparedQueries() []string {
+	s.mu.Lock()
+	defer s.mu.Unlock()
+	return append([]string(nil), s.queries...)
+}
+
 func (r *testRollbacker) Rollback() error {
 	r.rollbacks++
 	return r.err
 }
 
+func TestSQLTxPrepareRebindsByMode(t *testing.T) {
+	tests := []struct {
+		name string
+		mode string
+		want []string
+	}{
+		{
+			name: "postgres",
+			mode: "postgres",
+			want: []string{"SELECT $1", "UPDATE items SET name = $1"},
+		},
+		{
+			name: "sqlite",
+			mode: "local",
+			want: []string{"SELECT ?", "UPDATE items SET name = ?"},
+		},
+	}
+
+	for _, test := range tests {
+		t.Run(test.name, func(t *testing.T) {
+			state := &prepareCaptureState{}
+			rawDB := sql.OpenDB(prepareCaptureConnector{state: state})
+			t.Cleanup(func() { _ = rawDB.Close() })
+
+			rawTx, err := rawDB.Begin()
+			require.NoError(t, err)
+			tx := newSQLTx(rawTx, test.mode)
+
+			stmt, err := tx.PrepareContext(context.Background(), "SELECT ?")
+			require.NoError(t, err)
+			require.NoError(t, stmt.Close())
+
+			stmt, err = tx.Prepare("UPDATE items SET name = ?")
+			require.NoError(t, err)
+			require.NoError(t, stmt.Close())
+			require.NoError(t, tx.Rollback())
+
+			require.Equal(t, test.want, state.preparedQueries())
+		})
+	}
+}
+
 func TestStorageHelperCoverage(t *testing.T) {
 	t.Run("error types format messages", func(t *testing.T) {
 		require.Equal(
```

**File**: `control-plane/internal/storage/execution_records.go` (modified, +106/-15)
```diff
@@ -1573,8 +1573,15 @@ func (ls *LocalStorage) markAgentExecutionsOrphaned(ctx context.Context, agentNo
 
 // RetryStaleWorkflowExecutions finds stale workflow executions that haven't exceeded
 // maxRetries and resets both workflow_executions and executions back to "pending"
-// so the paired records stay in sync for the retry path.
+// so the paired records stay in sync for the retry path. The candidate predicates
+// are repeated in both conditional updates, so activity after selection — including
+// a heartbeat landing between the workflow and execution statements — prevents a retry.
+// A candidate is only committed and reported as retried when both records move.
 func (ls *LocalStorage) RetryStaleWorkflowExecutions(ctx context.Context, staleAfter time.Duration, maxRetries int, limit int) ([]string, error) {
+	return ls.retryStaleWorkflowExecutions(ctx, staleAfter, maxRetries, limit, nil)
+}
+
+func (ls *LocalStorage) retryStaleWorkflowExecutions(ctx context.Context, staleAfter time.Duration, maxRetries int, limit int, afterCandidateSelection func()) ([]string, error) {
 	if limit <= 0 || maxRetries <= 0 {
 		return nil, nil
 	}
@@ -1584,17 +1591,22 @@ func (ls *LocalStorage) RetryStaleWorkflowExecutions(ctx context.Context, staleA
 
 	cutoff := time.Now().UTC().Add(-staleAfter)
 	db := ls.requireSQLDB()
-	tsExpr := ls.staleTimestampExpr("COALESCE(updated_at, created_at, started_at)")
+	workflowTSExpr := ls.staleTimestampExpr("COALESCE(w.updated_at, w.created_at, w.started_at)")
+	executionTSExpr := ls.staleTimestampExpr("COALESCE(e.updated_at, e.created_at, e.started_at)")
 	cutoffExpr := ls.staleTimestampExpr("?")
 
 	rows, err := db.QueryContext(ctx, `
-		SELECT execution_id
-		FROM workflow_executions
-		WHERE status IN ('running', 'pending', 'queued')
-		  AND retry_count < ?
-		  AND `+tsExpr+` <= `+cutoffExpr+`
-		ORDER BY `+tsExpr+` ASC
-		LIMIT ?`, maxRetries, cutoff, limit)
+		SELECT w.execution_id
+		FROM workflow_executions w
+		LEFT JOIN executions e
+		  ON e.execution_id = w.execution_id
+		 AND e.status IN ('running', 'pending', 'queued', 'waiting')
+		WHERE w.status IN ('running', 'pending', 'queued')
+		  AND w.retry_count < ?
+		  AND `+workflowTSExpr+` <= `+cutoffExpr+`
+		  AND (e.execution_id IS NULL OR `+executionTSExpr+` <= `+cutoffExpr+`)
+		ORDER BY `+workflowTSExpr+` ASC
+		LIMIT ?`, maxRetries, cutoff, cutoff, limit)
 	if err != nil {
 		return nil, fmt.Errorf("query retriable workflow executions: %w", err)
 	}
@@ -1616,6 +1628,12 @@ func (ls *LocalStorage) RetryStaleWorkflowExecutions(ctx context.Context, staleA
 		return nil, nil
 	}
 
+	// Package tests use this seam to make the candidate-selection-to-update
+	// interleaving deterministic; production callers leave it nil.
+	if afterCandidateSelection != nil {
+		afterCandidateSelection()
+	}
+
 	tx, err := db.BeginTx(ctx, nil)
 	if err != nil {
 		return nil, fmt.Errorf("begin retry transaction: %w", err)
@@ -1626,34 +1644,68 @@ func (ls *LocalStorage) RetryStaleWorkflowExecutions(ctx context.Context, staleA
 	retryReason := "auto-retry after stale timeout"
 
 	workflowStmt, err := tx.PrepareContext(ctx, `
-		UPDATE workflow_executions
+		UPDATE workflow_executions AS w
 		SET status = 'pending',
 		    retry_count = retry_count + 1,
 		    error_message = ?,
 		    completed_at = NULL,
 		    updated_at = ?
-		WHERE execution_id = ? AND status IN ('running', 'pending', 'queued')`)
+		WHERE w.execution_id = ?
+		  AND w.status IN ('running', 'pending', 'queued')
+		  AND w.retry_count < ?
+		  AND `+workflowTSExpr+` <= `+cutoffExpr+`
+		  AND (
+		      NOT EXISTS (
+		          SELECT 1 FROM executions e
+		          WHERE e.execution_id = w.execution_id
+		            AND e.status IN ('running', 'pending', 'queued', 'waiting')
+		      )
+		      OR EXISTS (
+		          SELECT 1 FROM executions e
+		          WHERE e.execution_id = w.execution_id
+		            AND e.status IN ('running', 'pending', 'queued', 'waiting')
+		            AND `+executionTSExpr+` <= `+cutoffExpr+`
+		      )
+		  )`)
 	if err != nil {
 		return nil, fmt.Errorf("prepare retry statement: %w", err)
 	}
 	defer workflowStmt.Close()
 
+	// The execution update repeats the staleness predicate: a heartbeat can
+	// land between the workflow guard above and this statement, and the fresh
+	// execution must not be dragged back to pending.
 	executionStmt, err := tx.PrepareContext(ctx, `
-		UPDATE executions
+		UPDATE executions AS e
 		SET status = 'pending',
 		    error_message = ?,
 		    completed_at = NULL,
 		    duration_ms = NULL,
 		    updated_at = ?
-		WHERE execution_id = ? AND status IN ('running', 'pending', 'queued')`)
+		WHERE e.execution_id = ?
+		  AND e.status IN ('running', 'pending', 'queued')
+		  AND `+executionTSExpr+` <= `+cutoffExpr)
 	if err != nil {
 		return nil, fmt.Errorf("prepare execution retry statement: %w", err)
 	}
 	defer executionStmt.Close()
 
+	// Each candidate is wrapped in a savepoint so it can be undone
```

**File**: `control-plane/internal/storage/postgres_stale_reaper_live_test.go` (added, +668/-0)
```diff
@@ -0,0 +1,668 @@
+package storage
+
+import (
+	"context"
+	"database/sql"
+	"database/sql/driver"
+	"encoding/json"
+	"fmt"
+	"net"
+	"os"
+	"strings"
+	"sync"
+	"testing"
+	"time"
+
+	"github.com/Agent-Field/agentfield/control-plane/pkg/types"
+	"github.com/jackc/pgx/v5"
+	"github.com/jackc/pgx/v5/pgconn"
+	"github.com/jackc/pgx/v5/stdlib"
+	"github.com/stretchr/testify/require"
+)
+
+// These tests exercise the stale reapers against a real PostgreSQL server.
+// They are gated on POSTGRES_TEST_URL, the same variable the rest of the
+// storage suite uses, and connect only to a loopback host. Each test creates
+// its own throwaway database so rows never leak between tests.
+
+// livePostgresConnConfig reads POSTGRES_TEST_URL and refuses anything that is
+// not a loopback server, so a stray staging DSN can never be touched.
+func livePostgresConnConfig(t *testing.T) *pgx.ConnConfig {
+	t.Helper()
+
+	dsn := strings.TrimSpace(os.Getenv("POSTGRES_TEST_URL"))
+	if dsn == "" {
+		t.Skip("POSTGRES_TEST_URL not set, skipping live postgres tests")
+	}
+
+	cfg, err := pgx.ParseConfig(dsn)
+	require.NoError(t, err, "parse POSTGRES_TEST_URL")
+
+	host := cfg.Host
+	if host == "" {
+		host = "localhost"
+	}
+	ip := net.ParseIP(host)
+	require.Truef(t,
+		strings.EqualFold(host, "localhost") || (ip != nil && ip.IsLoopback()),
+		"live postgres tests refuse non-loopback host %q", host)
+	return cfg
+}
+
+// livePostgresStorage spins up an isolated database on the live server and
+// returns a Postgres-backed LocalStorage pointed at it.
+func livePostgresStorage(t *testing.T) (*LocalStorage, context.Context) {
+	t.Helper()
+
+	cfg := livePostgresConnConfig(t)
+	ctx := context.Background()
+
+	dbName := fmt.Sprintf("af_reaper_live_%d_%d", time.Now().UnixNano(), os.Getpid())
+
+	admin, err := sql.Open("pgx", cfg.ConnString())
+	require.NoError(t, err)
+	_, err = admin.ExecContext(ctx, "CREATE DATABASE "+dbName)
+	_ = admin.Close()
+	require.NoError(t, err, "create throwaway database %s", dbName)
+
+	t.Cleanup(func() {
+		drop, dropErr := sql.Open("pgx", cfg.ConnString())
+		if dropErr != nil {
+			return
+		}
+		defer drop.Close()
+		_, _ = drop.ExecContext(context.Background(), "DROP DATABASE IF EXISTS "+dbName+" WITH (FORCE)")
+	})
+
+	storageCfg := StorageConfig{
+		Mode: "postgres",
+		Postgres: PostgresStorageConfig{
+			Host:     cfg.Host,
+			Port:     int(cfg.Port),
+			User:     cfg.User,
+			Password: cfg.Password,
+			Database: dbName,
+			SSLMode:  "disable",
+		},
+	}
+	ls := NewPostgresStorage(PostgresStorageConfig{})
+	require.NoError(t, ls.Initialize(ctx, storageCfg), "initialize postgres storage")
+	t.Cleanup(func() { _ = ls.Close(context.Background()) })
+
+	return ls, ctx
+}
+
+// preparedSQLRecorder wraps a real PostgreSQL connector and records every SQL
+// string handed to the driver's prepare path. That string is the post-rebind
+// text, so it is the exact statement PostgreSQL would parse.
+type preparedSQLRecorder struct {
+	inner driver.Connector
+	mu    sync.Mutex
+	sql   []string
+}
+
+func (r *preparedSQLRecorder) record(query string) {
+	r.mu.Lock()
+	r.sql = append(r.sql, query)
+	r.mu.Unlock()
+}
+
+func (r *preparedSQLRecorder) prepared() []string {
+	r.mu.Lock()
+	defer r.mu.Unlock()
+	return append([]string(nil), r.sql...)
+}
+
+func (r *preparedSQLRecorder) Connect(ctx context.Context) (driver.Conn, error) {
+	conn, err := r.inner.Connect(ctx)
+	if err != nil {
+		return nil, err
+	}
+	return &recordingConn{Conn: conn, recorder: r}, nil
+}
+
+func (r *preparedSQLRecorder) Driver() driver.Driver { return recordingDriver{recorder: r} }
+
+type recordingDriver struct{ recorder *preparedSQLRecorder }
+
+func (d recordingDriver) Open(string) (driver.Conn, error) {
+	return d.recorder.Connect(context.Background())
+}
+
+type recordingConn struct {
+	driver.Conn
+	recorder *preparedSQLRecorder
+}
+
+func (c *recordingConn) Prepare(query string) (driver.Stmt, error) {
+	c.recorder.record(query)
+	return c.Conn.Prepare(query)
+}
+
+func (c *recordingConn) PrepareContext(ctx context.Context, query string) (driver.Stmt, error) {
+	c.recorder.record(query)
+	if pc, ok := c.Conn.(driver.ConnPrepareContext); ok {
+		return pc.PrepareContext(ctx, query)
+	}
+	return c.Conn.Prepare(query)
+}
+
+func (c *recordingConn) BeginTx(ctx context.Context, opts driver.TxOptions) (driver.Tx, error) {
+	if b, ok := c.Conn.(driver.ConnBeginTx); ok {
+		return b.BeginTx(ctx, opts)
+	}
+	return c.Conn.Begin()
+}
+
+// livePreparedRecorder opens a recorder-backed *sql.DB for the same throwaway
+// database as ls and swaps it in, returning a restore func.
+func livePreparedRecorder(t *testing.T, cfg *pgx.ConnConfig) (*preparedSQLRecorder, *sql.DB) {
+	t.Helper()
+	connector := stdlib.GetConnector(*cfg)
+	recorder := &preparedSQLRecorder{inner: connector}
+	db := sql.OpenDB(recorder)
+	return recorder, db
+}
+
+func liveConfigForDatabase(t *testing.T, dbName string) *pgx.ConnConfig {
+	t.Helper()
+	cfg := livePostgre
```

**File**: `control-plane/internal/storage/retry_stale_test.go` (modified, +663/-0)
```diff
@@ -3,6 +3,7 @@ package storage
 import (
 	"context"
 	"encoding/json"
+	"fmt"
 	"path/filepath"
 	"strings"
 	"testing"
@@ -13,6 +14,98 @@ import (
 	"github.com/stretchr/testify/require"
 )
 
+// Interleaving inventory for RetryStaleWorkflowExecutions.
+//
+// A candidate is a workflow row W and its paired execution row E. The sweep
+// selects candidates and then, inside one transaction, updates W and then E
+// with each candidate wrapped in a savepoint. The windows are:
+//
+//  1. Activity lands on E before selection. E is no longer stale, the selection
+//     predicate drops the candidate, and neither row moves. Covered by
+//     TestRetryStaleWorkflowExecutions_ExecutionActivityProtectsWorkflow and
+//     TestRetryStaleWorkflowExecutions_FreshNonUTCTimestampNotRetried.
+//  2. Activity lands on W before selection. W is no longer stale, the selection
+//     predicate drops the candidate. Covered by TestRetryStaleWorkflowExecutions
+//     (fresh workflow fixture).
+//  3. Activity lands on W or E after selection but before the transaction's
+//     first statement. The workflow UPDATE repeats the selection predicates, so
+//     it matches zero rows and the candidate is skipped without a savepoint.
+//     Covered by ..._ActivityAfterSelectionSkipsUpdate (E) and
+//     ..._WorkflowActivityAfterSelectionSkipsUpdate (W).
+//  4. Activity lands on E after the workflow UPDATE and before the execution
+//     UPDATE. The execution UPDATE matches zero rows, the recheck sees an
+//     active execution that is no longer stale, and the whole candidate is
+//     rolled back to its savepoint: W untouched, retry_count unchanged, id
+//     absent from the returned set, and E keeps the fresh heartbeat. Covered by
+//     ..._HeartbeatBetweenStatementsSparesExecution on SQLite and live
+//     PostgreSQL, and at batch level by ..._BatchReportsOnlyMovedCandidates.
+//  5. E becomes terminal or waiting between selection and the execution UPDATE.
+//     No running/pending/queued paired record is left, so the pre-existing
+//     workflow-only recovery path applies: only W moves and E is never
+//     modified. Terminal is covered by ..._TerminalPairedExecutionStillRetried;
+//     the waiting variant reaches the same branch because the execution UPDATE
+//     deliberately excludes 'waiting' (see commit c73dc4d1). Treating a
+//     terminal execution as "no live work" is the documented contract that the
+//     fix preserves.
+//  6. A heartbeat on E lands after the execution UPDATE but before commit. The
+//     update holds E's row lock on PostgreSQL, so the heartbeat serialises
+//     behind the commit and applies to the pending row from outside the call;
+//     the call cannot lose a heartbeat it has not yet observed.
+//  7. A statement fails or the context is cancelled mid-batch. defer
+//     rollbackTx discards every candidate, so no half-moved pair can survive;
+//     the returned error is authoritative over the returned ids. The invariant
+//     is "nothing commits", so it needs no interleaving proof beyond the
+//     deferred rollback.
+//
+// MarkStaleWorkflowExecutions has a different shape: once its workflow guard
+// has passed, its workflow UPDATE and its executions sync UPDATE both run, and
+// the sync UPDATE carries no staleness predicate. A heartbeat that lands
+// between the two statements is therefore overwritten by the sync, leaving
+// both rows terminal together. The pair never splits (the consistency property
+// this inventory tracks); the lost heartbeat is a pre-existing false-positive
+// window in the reaper's sync mirror, unchanged by the retry fix and out of
+// scope here.
+//
+// Helpers shared by the regressions below.
+
+// retryTestWorkflow builds a stale-eligible workflow row whose timestamps are
+// exactly the supplied instant so tests can assert that a skipped candidate
+// keeps its committed updated_at.
+func retryTestWorkflow(id string, updatedAt time.Time) *types.WorkflowExecution {
+	return &types.WorkflowExecution{
+		WorkflowID:          "wf-" + id,
+		ExecutionID:         id,
+		AgentFieldRequestID: "req-" + id,
+		AgentNodeID:         "agent-retry",
+		ReasonerID:          "reasoner-retry",
+		Status:              "running",
+		StartedAt:           updatedAt,
+		InputData:           json.RawMessage(`{}`),
+		OutputData:          json.RawMessage(`{}`),
+		RetryCount:          0,
+		CreatedAt:           updatedAt,
+		UpdatedAt:           updatedAt,
+	}
+}
+
+// retryTestExecution builds the paired legacy row. CreateExecutionRecord
+// stamps created_at/updated_at to now, so callers backdate updated_at when the
+// fixture must look stale.
+func retryTestExecution(id string, startedAt time.Time) *types.Execution {
+	return &types.Execution{
+		ExecutionID:  id,
+		RunID:        "run-" + id,
+		AgentNodeID:  "agent-retry",
+		ReasonerID:   "reasoner-retry",
+		NodeID:       "agent-retry",
+		Status:       "running",
+		StartedAt:    startedAt,
+		CreatedAt
```

**File**: `control-plane/internal/storage/sql_helpers.go` (modified, +11/-0)
```diff
@@ -150,3 +150,14 @@ func (tx *sqlTx) QueryRowContext(ctx context.Context, query string, args ...inte
 func (tx *sqlTx) QueryRow(query string, args ...interface{}) *sql.Row {
 	return tx.Tx.QueryRow(tx.rebind(query), args...)
 }
+
+// Both preparation methods must rebind here: callers can use either the
+// context-aware or deprecated API, and the embedded *sql.Tx methods would
+// otherwise send ? placeholders directly to PostgreSQL.
+func (tx *sqlTx) PrepareContext(ctx context.Context, query string) (*sql.Stmt, error) {
+	return tx.Tx.PrepareContext(ctx, tx.rebind(query))
+}
+
+func (tx *sqlTx) Prepare(query string) (*sql.Stmt, error) {
+	return tx.Tx.Prepare(tx.rebind(query))
+}
```

---

### Incident Patch 13: `7a1714e5` (2026-09-18)
**Commit Message**: fix(sdk/go): return isolated session definitions (#1044)

* fix(sdk/go): return isolated session definitions

* fix(sdk/go): distinguish overlapping slice views

**File**: `sdk/go/agent/session.go` (modified, +99/-1)
```diff
@@ -1,5 +1,7 @@
 package agent
 
+import "reflect"
+
 type SessionDefinition struct {
 	Name          string         `json:"name"`
 	Provider      string         `json:"provider"`
@@ -107,7 +109,103 @@ func (a *Agent) RegisterSession(name string, provider string, transport string,
 func (a *Agent) SessionDefinitions() []SessionDefinition {
 	sessions := make([]SessionDefinition, 0, len(a.sessions))
 	for _, session := range a.sessions {
-		sessions = append(sessions, session)
+		sessions = append(sessions, cloneSessionDefinition(session))
 	}
 	return sessions
 }
+
+func cloneSessionDefinition(session SessionDefinition) SessionDefinition {
+	cloned := session
+	cloned.Modalities = append([]string(nil), session.Modalities...)
+	cloned.Tools = append([]string(nil), session.Tools...)
+	cloned.Tags = append([]string(nil), session.Tags...)
+	cloned.ProposedTags = append([]string(nil), session.ProposedTags...)
+	cloned.ApprovedTags = append([]string(nil), session.ApprovedTags...)
+	cloned.Metadata = cloneSessionMetadata(session.Metadata)
+	if session.TurnDetection != nil {
+		config := *session.TurnDetection
+		config.Threshold = cloneSessionPointer(config.Threshold)
+		config.PrefixPaddingMS = cloneSessionPointer(config.PrefixPaddingMS)
+		config.SilenceDurationMS = cloneSessionPointer(config.SilenceDurationMS)
+		config.CreateResponse = cloneSessionPointer(config.CreateResponse)
+		config.InterruptResponse = cloneSessionPointer(config.InterruptResponse)
+		cloned.TurnDetection = &config
+	}
+	return cloned
+}
+
+func cloneSessionPointer[T any](value *T) *T {
+	if value == nil {
+		return nil
+	}
+	cloned := *value
+	return &cloned
+}
+
+type sessionMetadataCopyReference struct {
+	kind   reflect.Kind
+	typeOf reflect.Type
+	ptr    uintptr
+	length int
+	cap    int
+}
+
+// cloneSessionMetadata recursively copies maps and slices stored in metadata.
+// It keeps a copy of each encountered reference so cyclic metadata remains
+// detached without recursing forever. Other kinds are returned unchanged.
+func cloneSessionMetadata(metadata map[string]any) map[string]any {
+	if metadata == nil {
+		return nil
+	}
+	return cloneSessionMetadataValue(
+		reflect.ValueOf(metadata),
+		make(map[sessionMetadataCopyReference]reflect.Value),
+	).Interface().(map[string]any)
+}
+
+func cloneSessionMetadataValue(value reflect.Value, copied map[sessionMetadataCopyReference]reflect.Value) reflect.Value {
+	switch value.Kind() {
+	case reflect.Interface:
+		if value.IsNil() {
+			return reflect.Zero(value.Type())
+		}
+		cloned := cloneSessionMetadataValue(value.Elem(), copied)
+		result := reflect.New(value.Type()).Elem()
+		result.Set(cloned)
+		return result
+	case reflect.Map:
+		if value.IsNil() {
+			return reflect.Zero(value.Type())
+		}
+		ref := sessionMetadataCopyReference{kind: value.Kind(), typeOf: value.Type(), ptr: value.Pointer()}
+		if existing, found := copied[ref]; found {
+			return existing
+		}
+		result := reflect.MakeMapWithSize(value.Type(), value.Len())
+		copied[ref] = result
+		iter := value.MapRange()
+		for iter.Next() {
+			result.SetMapIndex(iter.Key(), cloneSessionMetadataValue(iter.Value(), copied))
+		}
+		return result
+	case reflect.Slice:
+		if value.IsNil() {
+			return reflect.Zero(value.Type())
+		}
+		ref := sessionMetadataCopyReference{
+			kind: value.Kind(), typeOf: value.Type(), ptr: value.Pointer(),
+			length: value.Len(), cap: value.Cap(),
+		}
+		if existing, found := copied[ref]; found {
+			return existing
+		}
+		result := reflect.MakeSlice(value.Type(), value.Len(), value.Len())
+		copied[ref] = result
+		for i := 0; i < value.Len(); i++ {
+			result.Index(i).Set(cloneSessionMetadataValue(value.Index(i), copied))
+		}
+		return result
+	default:
+		return value
+	}
+}
```

**File**: `sdk/go/agent/session_test.go` (modified, +150/-0)
```diff
@@ -6,6 +6,63 @@ import (
 	"testing"
 )
 
+func TestAgentSessionDefinitionsDetachesTurnDetection(t *testing.T) {
+	for _, tc := range []struct {
+		name, provider, transport string
+		config                    *TurnDetection
+	}{
+		{name: "defaults", provider: "openai", transport: "webrtc"},
+		{name: "explicit zero and false", provider: "openai", transport: "websocket", config: &TurnDetection{
+			Type: "server_vad", Threshold: turnDetectionTestPtr(0.0),
+			PrefixPaddingMS: turnDetectionTestPtr(0), SilenceDurationMS: turnDetectionTestPtr(0),
+			CreateResponse: turnDetectionTestPtr(false), InterruptResponse: turnDetectionTestPtr(false),
+		}},
+		{name: "semantic", provider: "openai", transport: "webrtc", config: &TurnDetection{Type: "semantic_vad", Eagerness: "low"}},
+		{name: "no turn detection", provider: "openrouter", transport: "audio_turns"},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			a, err := New(Config{NodeID: "support", Version: "v1"})
+			if err != nil {
+				t.Fatal(err)
+			}
+			var opts []SessionOption
+			if tc.config != nil {
+				opts = append(opts, WithSessionTurnDetection(*tc.config))
+			}
+			if err := a.RegisterSession("voice", tc.provider, tc.transport, opts...); err != nil {
+				t.Fatal(err)
+			}
+			want, err := json.Marshal(a.sessions["voice"].TurnDetection)
+			if err != nil {
+				t.Fatal(err)
+			}
+			snapshot := a.SessionDefinitions()[0]
+			if config := snapshot.TurnDetection; config != nil {
+				config.Type = "mutated"
+				config.Eagerness = "mutated"
+				if config.Threshold != nil {
+					*config.Threshold = 1
+				}
+				if config.PrefixPaddingMS != nil {
+					*config.PrefixPaddingMS = 999
+				}
+				if config.SilenceDurationMS != nil {
+					*config.SilenceDurationMS = 999
+				}
+				*config.CreateResponse = !*config.CreateResponse
+				*config.InterruptResponse = !*config.InterruptResponse
+			}
+			got, err := json.Marshal(a.SessionDefinitions()[0].TurnDetection)
+			if err != nil {
+				t.Fatal(err)
+			}
+			if string(got) != string(want) {
+				t.Fatalf("snapshot mutation changed registered session: got %s, want %s", got, want)
+			}
+		})
+	}
+}
+
 func TestAgentRegisterSessionStoresExplicitDefinition(t *testing.T) {
 	a, err := New(Config{NodeID: "support", Version: "v1"})
 	if err != nil {
@@ -50,6 +107,99 @@ func TestAgentRegisterSessionRejectsInvalidTransport(t *testing.T) {
 	}
 }
 
+func TestAgentSessionDefinitionsReturnsDefensiveSnapshots(t *testing.T) {
+	a, err := New(Config{NodeID: "support", Version: "v1"})
+	if err != nil {
+		t.Fatalf("New returned error: %v", err)
+	}
+
+	metadata := map[string]any{
+		"origin": "registry",
+		"nested": map[string]any{
+			"labels": []any{"original", map[string]any{"owner": "support"}},
+		},
+		"typedLabels": []string{"voice"},
+	}
+	if err := a.RegisterSession(
+		"voice",
+		"openai",
+		"webrtc",
+		WithSessionModalities("audio"),
+		WithSessionTools("support.resolve_voice_turn"),
+		WithSessionTags("voice"),
+		WithSessionMetadata(metadata),
+	); err != nil {
+		t.Fatalf("RegisterSession returned error: %v", err)
+	}
+	registered := a.sessions["voice"]
+	registered.ApprovedTags = []string{"approved"}
+	a.sessions["voice"] = registered
+
+	snapshot := a.SessionDefinitions()
+	snapshot[0].Tools[0] = "mutated-tool"
+	snapshot[0].Modalities[0] = "mutated-modality"
+	snapshot[0].Tags[0] = "mutated-tag"
+	snapshot[0].ProposedTags[0] = "mutated-proposed-tag"
+	snapshot[0].ApprovedTags[0] = "mutated-approved-tag"
+	snapshot[0].Metadata["origin"] = "mutated-origin"
+	nested := snapshot[0].Metadata["nested"].(map[string]any)
+	labels := nested["labels"].([]any)
+	labels[0] = "mutated-label"
+	labels[1].(map[string]any)["owner"] = "mutated-owner"
+	snapshot[0].Metadata["typedLabels"].([]string)[0] = "mutated-typed-label"
+
+	secondSnapshot := a.SessionDefinitions()
+	session := secondSnapshot[0]
+	if session.Tools[0] != "support.resolve_voice_turn" {
+		t.Errorf("tools = %#v, want original values", session.Tools)
+	}
+	if session.Modalities[0] != "audio" {
+		t.Errorf("modalities = %#v, want original values", session.Modalities)
+	}
+	if session.Tags[0] != "voice" || session.ProposedTags[0] != "voice" || session.ApprovedTags[0] != "approved" {
+		t.Errorf("tags = %#v proposed=%#v approved=%#v, want original values", session.Tags, session.ProposedTags, session.ApprovedTags)
+	}
+	if session.Metadata["origin"] != "registry" {
+		t.Errorf("metadata origin = %#v, want registry", session.Metadata["origin"])
+	}
+	gotNested := session.Metadata["nested"].(map[string]any)
+	gotLabels := gotNested["labels"].([]any)
+	if gotLabels[0] != "original" || gotLabels[1].(map[string]any)["owner"] != "support" {
+		t.Errorf("nested metadata = %#v, want original values", gotNested)
+	}
+	if session.Metadata["typedLabels"].([]string)[0] != "voice" {
+		t.Errorf("typed metadata slice = %#v, want original values", session.Metadata["typedLabels"])
+	}
+}
+
+func TestAgentSessionDefinitionsPreservesOverlappingSliceLengths(t *test
```

---

### Incident Patch 14: `9e692298` (2026-09-15)
**Commit Message**: fix(sessions): expose turn detection and barge-in configuration across SDKs (#1056)

* fix(sessions): expose validated turn detection across SDKs

Signed-off-by: WANG Qingmin <[REDACTED_EMAIL]>

* test(sessions): cover config parsing and invalid offer targets

Signed-off-by: WANG Qingmin <[REDACTED_EMAIL]>

---------

Signed-off-by: WANG Qingmin <[REDACTED_EMAIL]>

**File**: `control-plane/internal/cli/session.go` (modified, +5/-0)
```diff
@@ -31,6 +31,7 @@ type sessionToolOptions struct {
 }
 
 type sessionOfferOptions struct {
+	target       string
 	provider     string
 	transport    string
 	sdpSource    string
@@ -113,6 +114,7 @@ func newSessionOfferCommand() *cobra.Command {
 	}
 	cmd.Flags().StringVar(&opts.provider, "provider", "", "Explicit session provider")
 	cmd.Flags().StringVar(&opts.transport, "transport", "", "Explicit session transport")
+	cmd.Flags().StringVar(&opts.target, "target", "", "Registered <node>.<session> whose turn detection settings to use")
 	cmd.Flags().StringVar(&opts.sdpSource, "sdp", "", "SDP offer as inline text, @path, or - for stdin; defaults to stdin")
 	cmd.Flags().StringVarP(&opts.outputFormat, "output", "o", "raw", "Output format: raw, json, pretty, yaml")
 	return cmd
@@ -133,6 +135,9 @@ func runSessionOffer(ctx context.Context, sessionID string, opts *sessionOfferOp
 	if strings.TrimSpace(opts.transport) != "" {
 		values.Set("transport", opts.transport)
 	}
+	if strings.TrimSpace(opts.target) != "" {
+		values.Set("target", opts.target)
+	}
 	path := "/api/v1/session-instances/" + url.PathEscape(sessionID) + "/realtime-offer"
 	if encoded := values.Encode(); encoded != "" {
 		path += "?" + encoded
```

**File**: `control-plane/internal/cli/session_test.go` (modified, +2/-0)
```diff
@@ -77,6 +77,7 @@ func TestRunSessionOfferPostsSDPAndWritesRawAnswer(t *testing.T) {
 		require.Equal(t, "/api/v1/session-instances/sess-1/realtime-offer", r.URL.Path)
 		require.Equal(t, "openai", r.URL.Query().Get("provider"))
 		require.Equal(t, "webrtc", r.URL.Query().Get("transport"))
+		require.Equal(t, "support.voice", r.URL.Query().Get("target"))
 		gotContentType = r.Header.Get("Content-Type")
 		gotAPIKey = r.Header.Get("X-API-Key")
 		body, err := io.ReadAll(r.Body)
@@ -90,6 +91,7 @@ func TestRunSessionOfferPostsSDPAndWritesRawAnswer(t *testing.T) {
 	var stdout bytes.Buffer
 	err := runSessionOffer(context.Background(), "sess-1", &sessionOfferOptions{
 		provider:     "openai",
+		target:       "support.voice",
 		transport:    "webrtc",
 		sdpSource:    "v=0\r\noffer\r\n",
 		outputFormat: "raw",
```

**File**: `control-plane/internal/handlers/sessions.go` (modified, +68/-18)
```diff
@@ -77,29 +77,48 @@ func StartSessionHandler(store storage.StorageProvider) gin.HandlerFunc {
 			return
 		}
 
+		turnDetection, err := types.ParseSessionTurnDetection(capability.Provider, capability.Transport, definition.TurnDetection)
+		if err != nil {
+			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
+			return
+		}
+
 		sessionID := "sess_" + time.Now().UTC().Format("20060102_150405") + "_" + shortRandom()
 		model := firstNonEmptySession(req.Model, definition.Model)
 		voice := firstNonEmptySession(req.Voice, definition.Voice)
+		// The offer endpoint is stateless. Carry the registered target in its
+		// returned URL so the next request can resolve and validate its config.
+		offerQuery := url.Values{
+			"target":    {nodeID + "." + sessionName},
+			"provider":  {capability.Provider},
+			"transport": {capability.Transport},
+		}
+		if model != "" {
+			offerQuery.Set("model", model)
+		}
+		if voice != "" {
+			offerQuery.Set("voice", voice)
+		}
 		c.JSON(http.StatusCreated, gin.H{
-			"session_id":   sessionID,
-			"target":       nodeID + "." + sessionName,
-			"provider":     capability.Provider,
-			"transport":    capability.Transport,
-			"model":        model,
-			"voice":        voice,
-			"modalities":   definition.Modalities,
-			"tags":         definition.ApprovedTags,
-			"tool_targets": sessionToolTargets(nodeID, definition.Tools),
-			"offer_url":    fmt.Sprintf("/api/v1/session-instances/%s/realtime-offer", url.PathEscape(sessionID)),
-			"tool_url":     fmt.Sprintf("/api/v1/session-instances/%s/tools/{tool}", url.PathEscape(sessionID)),
-			"created_at":   time.Now().UTC().Format(time.RFC3339Nano),
+			"turn_detection": turnDetection,
+			"session_id":     sessionID,
+			"target":         nodeID + "." + sessionName,
+			"provider":       capability.Provider,
+			"transport":      capability.Transport,
+			"model":          model,
+			"voice":          voice,
+			"modalities":     definition.Modalities,
+			"tags":           definition.ApprovedTags,
+			"tool_targets":   sessionToolTargets(nodeID, definition.Tools),
+			"offer_url":      fmt.Sprintf("/api/v1/session-instances/%s/realtime-offer", url.PathEscape(sessionID)) + "?" + offerQuery.Encode(),
+			"tool_url":       fmt.Sprintf("/api/v1/session-instances/%s/tools/{tool}", url.PathEscape(sessionID)),
+			"created_at":     time.Now().UTC().Format(time.RFC3339Nano),
 		})
 	}
 }
 
 func SessionRealtimeOfferHandler(store storage.StorageProvider) gin.HandlerFunc {
 	return func(c *gin.Context) {
-		_ = store
 		provider := strings.TrimSpace(c.Query("provider"))
 		transport := strings.TrimSpace(c.Query("transport"))
 		if provider == "" || transport == "" {
@@ -120,6 +139,33 @@ func SessionRealtimeOfferHandler(store storage.StorageProvider) gin.HandlerFunc
 			c.JSON(http.StatusBadRequest, gin.H{"error": "webrtc realtime offers currently require provider=openai"})
 			return
 		}
+		var rawTurnDetection json.RawMessage
+		model, voice := c.Query("model"), c.Query("voice")
+		if _, supplied := c.Request.URL.Query()["target"]; supplied {
+			target := c.Query("target")
+			nodeID, sessionName, ok := splitSessionTarget(target)
+			if !ok {
+				c.JSON(http.StatusBadRequest, gin.H{"error": "session target must be <node>.<session>"})
+				return
+			}
+			definition, found := lookupSessionDefinition(c, store, nodeID, sessionName)
+			if !found {
+				return
+			}
+			if types.NormalizeSessionTransportValue(definition.Provider) != "openai" ||
+				types.NormalizeSessionTransportValue(definition.Transport) != "webrtc" {
+				c.JSON(http.StatusBadRequest, gin.H{"error": "registered session must use provider=openai transport=webrtc for realtime offers"})
+				return
+			}
+			rawTurnDetection = definition.TurnDetection
+			model = firstNonEmptySession(model, definition.Model)
+			voice = firstNonEmptySession(voice, definition.Voice)
+		}
+		turnDetection, err := types.ParseSessionTurnDetection("openai", "webrtc", rawTurnDetection)
+		if err != nil {
+			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
+			return
+		}
 		if strings.TrimSpace(os.Getenv("OPENAI_API_KEY")) == "" {
 			c.JSON(http.StatusBadGateway, gin.H{"error": "OPENAI_API_KEY is required for provider=openai transport=webrtc"})
 			return
@@ -133,8 +179,9 @@ func SessionRealtimeOfferHandler(store storage.StorageProvider) gin.HandlerFunc
 			c.Request.Context(),
 			sessionPathID(c),
 			string(sdp),
-			firstNonEmptySession(c.Query("model"), "gpt-realtime-2"),
-			firstNonEmptySession(c.Query("voice"), "marin"),
+			firstNonEmptySession(model, "gpt-realtime-2"),
+			firstNonEmptySession(voice, "marin"),
+			turnDetection,
 		)
 		if err != nil {
 			c.JSON(http.StatusBadGateway, gin.H{
@@ -269,7 +316,7 @@ func sessionToolTargets(nodeID string, tools []string) map[string]string {
 	return targets
 }
 
-func createOpenAIRealtimeCall(ctx context.Context, sessionID string, sdp string, model string, voice string) (string, error) {
+func createOpenAIRealtime
```

**File**: `control-plane/internal/handlers/sessions_test.go` (modified, +161/-0)
```diff
@@ -6,6 +6,7 @@ import (
 	"io"
 	"net/http"
 	"net/http/httptest"
+	"net/url"
 	"strings"
 	"testing"
 	"time"
@@ -277,6 +278,10 @@ func TestSessionRealtimeOfferHandlerCallsRealtimeProvider(t *testing.T) {
 	require.Len(t, gotSafetyID, 32)
 	require.Contains(t, gotSession, `"model":"gpt-test"`)
 	require.Contains(t, gotSession, `"voice":"cedar"`)
+	var config map[string]interface{}
+	require.NoError(t, json.Unmarshal([]byte(gotSession), &config))
+	input := config["audio"].(map[string]interface{})["input"].(map[string]interface{})
+	require.Equal(t, true, input["turn_detection"].(map[string]interface{})["interrupt_response"])
 }
 
 func TestSessionRealtimeOfferHandlerSurfacesProviderErrors(t *testing.T) {
@@ -403,3 +408,159 @@ func sessionTestAgent() *types.AgentNode {
 		}},
 	}
 }
+
+// Exercise the complete metadata -> start -> offer -> provider boundary, rather
+// than just checking that a new field exists in the registration response.
+func TestSessionTurnDetectionReachesProvider(t *testing.T) {
+	gin.SetMode(gin.TestMode)
+	t.Setenv("OPENAI_API_KEY", "test-key")
+	original := http.DefaultClient.Transport
+	t.Cleanup(func() { http.DefaultClient.Transport = original })
+	for _, tc := range []struct{ name, config, expected string }{
+		{"legacy defaults", "", `{"type":"server_vad","threshold":0.5,"prefix_padding_ms":300,"silence_duration_ms":500,"create_response":true,"interrupt_response":true}`},
+		{"custom server", `{"type":"server_vad","threshold":0,"prefix_padding_ms":0,"silence_duration_ms":750,"create_response":false,"interrupt_response":false}`, `{"type":"server_vad","threshold":0,"prefix_padding_ms":0,"silence_duration_ms":750,"create_response":false,"interrupt_response":false}`},
+		{"semantic", `{"type":"semantic_vad","eagerness":"low"}`, `{"type":"semantic_vad","eagerness":"low","create_response":true,"interrupt_response":true}`},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			agent := sessionTestAgent()
+			raw := agent.Metadata.Custom["sessions"].([]interface{})[0].(map[string]interface{})
+			raw["model"], raw["voice"] = "gpt-vad-test", "cedar"
+			if tc.config != "" {
+				raw["turn_detection"] = json.RawMessage(tc.config)
+			}
+			store := &nodeRESTStorageStub{agent: agent}
+			router := gin.New()
+			router.POST("/api/v1/session-targets/:target/start", StartSessionHandler(store))
+			router.POST("/api/v1/session-instances/:session_id/realtime-offer", SessionRealtimeOfferHandler(store))
+			start := httptest.NewRecorder()
+			router.ServeHTTP(start, httptest.NewRequest(http.MethodPost, "/api/v1/session-targets/support.voice/start", strings.NewReader(`{}`)))
+			require.Equal(t, http.StatusCreated, start.Code, start.Body.String())
+			var result struct {
+				OfferURL      string          `json:"offer_url"`
+				TurnDetection json.RawMessage `json:"turn_detection"`
+			}
+			require.NoError(t, json.Unmarshal(start.Body.Bytes(), &result))
+			require.JSONEq(t, tc.expected, string(result.TurnDetection))
+			calls := 0
+			http.DefaultClient.Transport = roundTripFunc(func(req *http.Request) (*http.Response, error) {
+				calls++
+				require.NoError(t, req.ParseMultipartForm(1<<20))
+				require.Equal(t, "v=0\r\noffer\r\n", req.FormValue("sdp"))
+				var config struct {
+					Model string `json:"model"`
+					Audio struct {
+						Output struct {
+							Voice string `json:"voice"`
+						} `json:"output"`
+						Input struct {
+							TurnDetection json.RawMessage `json:"turn_detection"`
+						} `json:"input"`
+					} `json:"audio"`
+				}
+				require.NoError(t, json.Unmarshal([]byte(req.FormValue("session")), &config))
+				require.JSONEq(t, tc.expected, string(config.Audio.Input.TurnDetection))
+				require.Equal(t, "gpt-vad-test", config.Model)
+				require.Equal(t, "cedar", config.Audio.Output.Voice)
+				return &http.Response{StatusCode: http.StatusOK, Header: make(http.Header), Body: io.NopCloser(strings.NewReader("answer"))}, nil
+			})
+			if tc.name == "semantic" {
+				// CLI offers identify the target without repeating model/voice.
+				offerURL, err := url.Parse(result.OfferURL)
+				require.NoError(t, err)
+				query := offerURL.Query()
+				query.Del("model")
+				query.Del("voice")
+				offerURL.RawQuery = query.Encode()
+				result.OfferURL = offerURL.String()
+			}
+			offer := httptest.NewRecorder()
+			router.ServeHTTP(offer, httptest.NewRequest(http.MethodPost, result.OfferURL, strings.NewReader("v=0\r\noffer\r\n")))
+			require.Equal(t, http.StatusOK, offer.Code, offer.Body.String())
+			require.Equal(t, 1, calls)
+		})
+	}
+}
+
+func TestStartSessionRejectsInvalidTurnDetection(t *testing.T) {
+	for _, config := range []string{
+		`{}`, `{"Type":"server_vad"}`, `{"type":"semantic_vad","eagerness":""}`, `{"type":"client_vad"}`, `{"type":"server_vad","threshold":2}`,
+		`{"type":"server_vad","silence_duration_ms":-1}`, `{"type":"server_vad","prefix_padding_ms":1.5}`,
+		`{"type":"server_vad","create_response":"false"}`, `{"type":"server_vad","interrupt_response":nu
```

**File**: `control-plane/pkg/types/session_turn_detection.go` (added, +120/-0)
```diff
@@ -0,0 +1,120 @@
+package types
+
+import (
+	"bytes"
+	"encoding/json"
+	"fmt"
+	"math"
+)
+
+// TurnDetection configures OpenAI Realtime input audio. Nil options use defaults.
+// Pointer fields preserve explicit false and zero values during JSON serialization.
+type TurnDetection struct {
+	Type              string   `json:"type"`
+	Threshold         *float64 `json:"threshold,omitempty"`
+	PrefixPaddingMS   *int     `json:"prefix_padding_ms,omitempty"`
+	SilenceDurationMS *int     `json:"silence_duration_ms,omitempty"`
+	CreateResponse    *bool    `json:"create_response,omitempty"`
+	InterruptResponse *bool    `json:"interrupt_response,omitempty"`
+	Eagerness         string   `json:"eagerness,omitempty"`
+}
+
+// NormalizeTurnDetection validates options and returns an independent config with
+// automatic responses and barge-in enabled unless explicitly disabled.
+func NormalizeTurnDetection(provider, transport string, config *TurnDetection) (*TurnDetection, error) {
+	if provider != "openai" || (transport != "webrtc" && transport != "websocket") {
+		if config != nil {
+			return nil, fmt.Errorf("turn_detection requires provider=openai and transport=webrtc or websocket")
+		}
+		return nil, nil
+	}
+	result := TurnDetection{Type: "server_vad"}
+	if config != nil {
+		result = *config
+	}
+	switch result.Type {
+	case "server_vad":
+		if result.Eagerness != "" {
+			return nil, fmt.Errorf("turn_detection.eagerness is unsupported for server_vad")
+		}
+		threshold := 0.5
+		if result.Threshold != nil {
+			threshold = *result.Threshold
+		}
+		if math.IsNaN(threshold) || math.IsInf(threshold, 0) || threshold < 0 || threshold > 1 {
+			return nil, fmt.Errorf("turn_detection.threshold must be a finite number between 0 and 1")
+		}
+		padding, silence := 300, 500
+		if result.PrefixPaddingMS != nil {
+			padding = *result.PrefixPaddingMS
+		}
+		if result.SilenceDurationMS != nil {
+			silence = *result.SilenceDurationMS
+		}
+		if padding < 0 || silence < 0 {
+			return nil, fmt.Errorf("turn_detection durations must be non-negative integers")
+		}
+		result.Threshold, result.PrefixPaddingMS, result.SilenceDurationMS = &threshold, &padding, &silence
+	case "semantic_vad":
+		if result.Threshold != nil || result.PrefixPaddingMS != nil || result.SilenceDurationMS != nil {
+			return nil, fmt.Errorf("turn_detection threshold and durations are unsupported for semantic_vad")
+		}
+		if result.Eagerness == "" {
+			result.Eagerness = "auto"
+		}
+		switch result.Eagerness {
+		case "auto", "low", "medium", "high":
+		default:
+			return nil, fmt.Errorf("turn_detection.eagerness must be auto, low, medium, or high")
+		}
+	default:
+		return nil, fmt.Errorf("turn_detection.type must be server_vad or semantic_vad")
+	}
+	create, interrupt := true, true
+	if result.CreateResponse != nil {
+		create = *result.CreateResponse
+	}
+	if result.InterruptResponse != nil {
+		interrupt = *result.InterruptResponse
+	}
+	result.CreateResponse, result.InterruptResponse = &create, &interrupt
+	return &result, nil
+}
+
+// ParseSessionTurnDetection validates untrusted registration metadata before any
+// provider request. Raw JSON preserves unknown fields so they cannot be ignored.
+func ParseSessionTurnDetection(provider, transport string, raw json.RawMessage) (*TurnDetection, error) {
+	raw = bytes.TrimSpace(raw)
+	if len(raw) == 0 || bytes.Equal(raw, []byte("null")) {
+		return NormalizeTurnDetection(provider, transport, nil)
+	}
+	var fields map[string]json.RawMessage
+	if err := json.Unmarshal(raw, &fields); err != nil {
+		return nil, fmt.Errorf("turn_detection must be an object: %w", err)
+	}
+	var config TurnDetection
+	decoder := json.NewDecoder(bytes.NewReader(raw))
+	decoder.DisallowUnknownFields()
+	if err := decoder.Decode(&config); err != nil {
+		return nil, fmt.Errorf("invalid turn_detection: %w", err)
+	}
+	for key, value := range fields {
+		switch key {
+		case "type", "threshold", "prefix_padding_ms", "silence_duration_ms", "create_response", "interrupt_response", "eagerness":
+		default:
+			return nil, fmt.Errorf("unknown turn_detection field %q", key)
+		}
+		if bytes.Equal(bytes.TrimSpace(value), []byte("null")) {
+			return nil, fmt.Errorf("turn_detection.%s must not be null", key)
+		}
+	}
+	if _, ok := fields["eagerness"]; ok {
+		if config.Type != "semantic_vad" {
+			return nil, fmt.Errorf("turn_detection.eagerness is unsupported for %s", config.Type)
+		}
+		if config.Eagerness == "" {
+			return nil, fmt.Errorf("turn_detection.eagerness must be auto, low, medium, or high")
+		}
+	}
+	return NormalizeTurnDetection(provider, transport, &config)
+}
```

**File**: `control-plane/pkg/types/session_turn_detection_test.go` (added, +124/-0)
```diff
@@ -0,0 +1,124 @@
+package types
+
+import (
+	"encoding/json"
+	"math"
+	"strings"
+	"testing"
+)
+
+func turnDetectionTestPtr[T any](v T) *T { return &v }
+
+func TestNormalizeTurnDetectionDefaultsAndOverrides(t *testing.T) {
+	for _, transport := range []string{"webrtc", "websocket"} {
+		config, err := NormalizeTurnDetection("openai", transport, nil)
+		if err != nil {
+			t.Fatal(err)
+		}
+		if config.Type != "server_vad" || *config.Threshold != 0.5 || *config.PrefixPaddingMS != 300 ||
+			*config.SilenceDurationMS != 500 || !*config.CreateResponse || !*config.InterruptResponse {
+			t.Fatalf("unexpected defaults: %+v", config)
+		}
+	}
+	input := &TurnDetection{Type: "server_vad", Threshold: turnDetectionTestPtr(0.0),
+		PrefixPaddingMS: turnDetectionTestPtr(0), SilenceDurationMS: turnDetectionTestPtr(750),
+		CreateResponse: turnDetectionTestPtr(false), InterruptResponse: turnDetectionTestPtr(false)}
+	config, err := NormalizeTurnDetection("openai", "webrtc", input)
+	if err != nil {
+		t.Fatal(err)
+	}
+	*input.Threshold = 1
+	*input.InterruptResponse = true
+	serialized, err := json.Marshal(config)
+	if err != nil {
+		t.Fatal(err)
+	}
+	expected := `{"type":"server_vad","threshold":0,"prefix_padding_ms":0,"silence_duration_ms":750,"create_response":false,"interrupt_response":false}`
+	if string(serialized) != expected {
+		t.Fatalf("got %s, want %s", serialized, expected)
+	}
+	semantic, err := NormalizeTurnDetection("openai", "webrtc", &TurnDetection{Type: "semantic_vad"})
+	if err != nil {
+		t.Fatal(err)
+	}
+	serialized, err = json.Marshal(semantic)
+	if err != nil {
+		t.Fatal(err)
+	}
+	expected = `{"type":"semantic_vad","create_response":true,"interrupt_response":true,"eagerness":"auto"}`
+	if string(serialized) != expected {
+		t.Fatalf("got %s, want %s", serialized, expected)
+	}
+}
+
+func TestNormalizeTurnDetectionRejectsInvalidOptions(t *testing.T) {
+	for _, input := range []TurnDetection{
+		{}, {Type: "client_vad"},
+		{Type: "server_vad", Threshold: turnDetectionTestPtr(1.1)},
+		{Type: "server_vad", Threshold: turnDetectionTestPtr(math.NaN())},
+		{Type: "server_vad", Threshold: turnDetectionTestPtr(math.Inf(1))},
+		{Type: "server_vad", PrefixPaddingMS: turnDetectionTestPtr(-1)},
+		{Type: "server_vad", SilenceDurationMS: turnDetectionTestPtr(-1)},
+		{Type: "server_vad", Eagerness: "low"},
+		{Type: "semantic_vad", Threshold: turnDetectionTestPtr(0.0)},
+		{Type: "semantic_vad", PrefixPaddingMS: turnDetectionTestPtr(0)},
+		{Type: "semantic_vad", SilenceDurationMS: turnDetectionTestPtr(0)},
+		{Type: "semantic_vad", Eagerness: "urgent"},
+	} {
+		if _, err := NormalizeTurnDetection("openai", "webrtc", &input); err == nil {
+			t.Fatalf("accepted invalid config: %+v", input)
+		}
+	}
+	if _, err := NormalizeTurnDetection("openrouter", "audio_turns", &TurnDetection{Type: "server_vad"}); err == nil {
+		t.Fatal("accepted VAD for openrouter")
+	}
+	if config, err := NormalizeTurnDetection("openrouter", "audio_turns", nil); err != nil || config != nil {
+		t.Fatalf("changed openrouter defaults: %+v, %v", config, err)
+	}
+}
+
+func TestParseSessionTurnDetection(t *testing.T) {
+	for _, tc := range []struct {
+		name, provider, transport, raw, expected, wantError string
+	}{
+		{name: "omitted", provider: "openai", transport: "webrtc", expected: `{"type":"server_vad","threshold":0.5,"prefix_padding_ms":300,"silence_duration_ms":500,"create_response":true,"interrupt_response":true}`},
+		{name: "null", provider: "openai", transport: "webrtc", raw: " null ", expected: `{"type":"server_vad","threshold":0.5,"prefix_padding_ms":300,"silence_duration_ms":500,"create_response":true,"interrupt_response":true}`},
+		{name: "server explicit zero and false", provider: "openai", transport: "webrtc", raw: `{"type":"server_vad","threshold":0,"prefix_padding_ms":0,"silence_duration_ms":0,"create_response":false,"interrupt_response":false}`, expected: `{"type":"server_vad","threshold":0,"prefix_padding_ms":0,"silence_duration_ms":0,"create_response":false,"interrupt_response":false}`},
+		{name: "semantic", provider: "openai", transport: "websocket", raw: `{"type":"semantic_vad","eagerness":"low"}`, expected: `{"type":"semantic_vad","create_response":true,"interrupt_response":true,"eagerness":"low"}`},
+		{name: "other provider omitted", provider: "openrouter", transport: "audio_turns", expected: `null`},
+		{name: "other provider configured", provider: "openrouter", transport: "audio_turns", raw: `{"type":"server_vad"}`, wantError: "requires provider=openai"},
+		{name: "malformed JSON", provider: "openai", transport: "webrtc", raw: `{`, wantError: "must be an object"},
+		{name: "array", provider: "openai", transport: "webrtc", raw: `[]`, wantError: "must be an object"},
+		{name: "missing type", provider: "openai", transport: "webrtc", raw: `{}`, wantError: "turn_detection.type"},
+		{name: "unknown field", provider: "openai", transport: "webrtc", raw: `{"type":"server_vad","typo":true}`, wantErr
```

**File**: `control-plane/pkg/types/types.go` (modified, +13/-11)
```diff
@@ -248,17 +248,19 @@ type SkillDefinition struct {
 
 // SessionDefinition defines a realtime session ingress provided by an agent node.
 type SessionDefinition struct {
-	Name         string                 `json:"name"`
-	Provider     string                 `json:"provider"`
-	Transport    string                 `json:"transport"`
-	Model        string                 `json:"model,omitempty"`
-	Modalities   []string               `json:"modalities,omitempty"`
-	Voice        string                 `json:"voice,omitempty"`
-	Tools        []string               `json:"tools,omitempty"`
-	Metadata     map[string]interface{} `json:"metadata,omitempty"`
-	Tags         []string               `json:"tags,omitempty"`
-	ProposedTags []string               `json:"proposed_tags,omitempty"`
-	ApprovedTags []string               `json:"approved_tags,omitempty"`
+	// Keep raw options until validation so unknown or malformed fields are rejected explicitly.
+	TurnDetection json.RawMessage        `json:"turn_detection,omitempty"`
+	Name          string                 `json:"name"`
+	Provider      string                 `json:"provider"`
+	Transport     string                 `json:"transport"`
+	Model         string                 `json:"model,omitempty"`
+	Modalities    []string               `json:"modalities,omitempty"`
+	Voice         string                 `json:"voice,omitempty"`
+	Tools         []string               `json:"tools,omitempty"`
+	Metadata      map[string]interface{} `json:"metadata,omitempty"`
+	Tags          []string               `json:"tags,omitempty"`
+	ProposedTags  []string               `json:"proposed_tags,omitempty"`
+	ApprovedTags  []string               `json:"approved_tags,omitempty"`
 }
 
 // HydrateAgentSessions copies session definitions from metadata.custom.sessions
```

**File**: `docs/session-turn-detection.md` (added, +134/-0)
```diff
@@ -0,0 +1,134 @@
+# Session turn detection and interruption
+
+OpenAI sessions accept `turn_detection` in Python and TypeScript, and
+`WithSessionTurnDetection` in Go. It is supported with explicit
+`provider="openai"` and `transport="webrtc"` or `"websocket"`. Supplying it for
+OpenRouter `audio_turns` is an error; AgentField does not switch providers or
+transports.
+
+Omitting the configuration enables interruptible server VAD:
+
+```json
+{
+  "type": "server_vad",
+  "threshold": 0.5,
+  "prefix_padding_ms": 300,
+  "silence_duration_ms": 500,
+  "create_response": true,
+  "interrupt_response": true
+}
+```
+
+These defaults also apply to older OpenAI registrations without this field.
+An explicitly supplied object must specify `type`. Missing optional fields use
+mode-specific defaults; explicit `false` and `0` are preserved.
+
+## Python
+
+```python
+from agentfield import Agent
+
+app = Agent("support")
+
+@app.session(
+    "voice",
+    provider="openai",
+    transport="webrtc",
+    turn_detection={
+        "type": "server_vad",
+        "threshold": 0.6,
+        "silence_duration_ms": 700,
+        "interrupt_response": True,
+    },
+)
+async def voice(session):
+    pass
+```
+
+`ServerVAD`, `SemanticVAD`, and the `TurnDetection` union are exported for type
+annotations. The decorator validates the dictionary when the session is declared.
+
+## TypeScript
+
+```typescript
+import { Agent } from '@agentfield/sdk';
+
+const app = new Agent({ nodeId: 'support' });
+app.session('voice', {
+  provider: 'openai',
+  transport: 'webrtc',
+  turn_detection: {
+    type: 'semantic_vad',
+    eagerness: 'low',
+    interrupt_response: true
+  }
+}, async (session) => {});
+```
+
+`TurnDetection` is an exported discriminated union. Runtime validation also
+rejects invalid values supplied by JavaScript or external configuration.
+
+## Go
+
+```go
+interrupt := false
+silence := 700
+err := app.RegisterSession("voice", "openai", "webrtc",
+    agent.WithSessionTurnDetection(agent.TurnDetection{
+        Type:              "server_vad",
+        SilenceDurationMS: &silence,
+        InterruptResponse: &interrupt,
+    }),
+)
+```
+
+Optional numeric and boolean fields are pointers so an unset field can be
+distinguished from an explicit zero or false. `RegisterSession` returns a
+validation error before updating the registry.
+
+## Supported options
+
+| Option | Modes | Default | Validation |
+| --- | --- | --- | --- |
+| `type` | Both | `server_vad` when config is omitted | `server_vad` or `semantic_vad`; required in an explicit object |
+| `threshold` | Server | `0.5` | Finite number from 0 to 1 |
+| `prefix_padding_ms` | Server | `300` | Non-negative integer milliseconds |
+| `silence_duration_ms` | Server | `500` | Non-negative integer milliseconds |
+| `eagerness` | Semantic | `auto` | `auto`, `low`, `medium`, or `high` |
+| `create_response` | Both | `true` | Boolean; automatically respond after a detected turn |
+| `interrupt_response` | Both | `true` | Boolean; interrupt an ongoing response when speech starts |
+
+Server-only fields cannot be supplied with semantic VAD, and `eagerness` cannot
+be supplied with server VAD. Unknown fields, invalid values, and null field values
+are rejected. Setting both response flags to `false` keeps speech detection
+active while leaving response creation and cancellation to the client.
+
+## Control-plane connection
+
+Start the registered session with
+`POST /api/v1/session-targets/<node>.<session>/start`, then POST the raw SDP offer
+to the returned `offer_url` with `Content-Type: application/sdp`. Preserve its
+query parameters: they identify the registered target, provider, transport,
+model, and voice. The start response also includes the resolved `turn_detection`.
+
+The offer endpoint re-reads the registered target and validates its configuration
+before contacting OpenAI. It sends the resolved options under
+`session.audio.input.turn_detection` in the multipart session configuration.
+This is a stateless lookup, so a registration change between start and offer is
+reflected when the offer is submitted. There is no session database migration.
+
+The CLI can select the same registered configuration:
+
+```sh
+agentfield session offer <session_id> --provider openai --transport webrtc \
+  --target support.voice --sdp @offer.sdp
+```
+
+Legacy direct offers without a target keep working and use the interruptible
+server-VAD defaults. Clients constructing offer URLs themselves must include
+`target=<node>.<session>` to use author-defined settings. The existing offer
+endpoint remains WebRTC-only; accepting WebSocket registration metadata does
+not add a WebSocket connection adapter.
+
+See [OpenAI's VAD guide](https://developers.openai.com/api/docs/guides/realtime-vad)
+for the provider's turn detection and interruption behavior.
```

---

### Incident Patch 15: `10aa43c0` (2026-09-10)
**Commit Message**: fix(go-sdk): make harness schema path tests OS-portable (#1049)

TestOutputPath and TestSchemaPath asserted hardcoded Unix path
separators (/tmp/...), so they failed on Windows where filepath.Join
produces backslash separators. Assert against filepath.Join with the
existing filename constants so the expected value is computed the same
way the production code computes it.

Go SDK CI runs only on ubuntu-latest, so these failures surfaced only
in local Windows development. The change is a no-op on Linux (Join
yields the identical string) and a fix on Windows.

**File**: `sdk/go/harness/schema_test.go` (modified, +3/-3)
```diff
@@ -11,12 +11,12 @@ import (
 )
 
 func TestOutputPath(t *testing.T) {
-	assert.Equal(t, "/tmp/.agentfield_output.json", OutputPath("/tmp"))
-	assert.Equal(t, "foo/.agentfield_output.json", OutputPath("foo"))
+	assert.Equal(t, filepath.Join("/tmp", outputFilename), OutputPath("/tmp"))
+	assert.Equal(t, filepath.Join("foo", outputFilename), OutputPath("foo"))
 }
 
 func TestSchemaPath(t *testing.T) {
-	assert.Equal(t, "/tmp/.agentfield_schema.json", SchemaPath("/tmp"))
+	assert.Equal(t, filepath.Join("/tmp", schemaFilename), SchemaPath("/tmp"))
 }
 
 func TestBuildPromptSuffix_SmallSchema(t *testing.T) {
```

#### Recent Merged Pull Requests:
- **PR #1096** (2026-10-05): Telemetry updates (@santoshkumarradha)
- **PR #1094** (2026-10-03): test(sdk): verify Windows batch probe end-to-end and harden cmd.exe branch (@santoshkumarradha)
- **PR #1085** (2026-10-01): chore(deps): bump the uv group across 1 directory with 2 updates (@dependabot[bot])
- **PR #1084** (2026-10-01): chore(deps): bump the npm_and_yarn group across 2 directories with 2 updates (@dependabot[bot])
- **PR #1083** (2026-10-01): chore(deps): bump pyjwt from 2.13.0 to 2.15.0 in /sdk/python in the uv group across 1 directory (@dependabot[bot])
- **PR #1082** (2026-10-01): fix(sdk/python): parse AGENTFIELD_ASYNC boolean flags with the repo's env vocabulary (@remote-controlled-man)
- **PR #1081** (2026-10-01): fix(sdk/go): stop retrying execution status callbacks on non-retryable 4xx (@Bdysj)
- **PR #1080** (2026-10-01): fix(control-plane): return 404 for status callbacks on unknown executions (@Bdysj)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
