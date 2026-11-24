# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: Agent-Field/agentfield Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "Agent-Field/agentfield",
  "source_url": "https://github.com/Agent-Field/agentfield",
  "source_version": "1b3c68a3",
  "license": "Apache-2.0",
  "timestamp": "2026-11-24T03:14:23.064Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-agent-field-agentfield",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [Agent-Field/agentfield](https://github.com/Agent-Field/agentfield) (Revision: `1b3c68a3`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-24T03:14:23.064Z`  
> **Learning ID**: `learn-github-agent-field-agentfield`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: G (Architecture Intelligence), I (Content & Information Intelligence), F (Design Intelligence), K (Quality & Verification Intelligence), D (Research & Knowledge Intelligence), M (Feedback & Evolution Intelligence), L (Deployment & Operations Intelligence), A (Human & Need Intelligence), J (Search & Distribution Intelligence)
- **Confidence Rating**: 54%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from Agent-Field/agentfield:

# Forensic Learning Record (Deep Inspection): Agent-Field/agentfield

> **Canonical Artifact**: `07_PROJECT_LEARNING/agent-field-agentfield-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Agent-Field/agentfield](https://github.com/Agent-Field/agentfield))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-24T03:14:21.567Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Agent-Field/agentfield`
- **Description**: Build, run and scale AI agents like API and microservices
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2667 stars

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

### Incident Patch 1: `dc802dcb` (2026-11-23)
**Commit Message**: fix(sdk-python): record token usage for every tool-calling turn in ai(tools=...) (#1221)

* fix(sdk-python): record token usage for every tool-calling turn in ai(tools=...)

The tool-calling path of AgentAI.ai() returned before the cost-tracker
recording used by the plain completion path, so ai(tools=...) never
contributed tokens or cost to the tracker. Record usage per LLM turn
inside the tool-loop completion callback.

* test(sdk-python): cover cache tokens and missing usage in tool-loop turns

Both rate-limit-retry and direct paths of the per-turn recorder are
exercised, so every line added by the usage-recording fix is covered.

Co-Authored-By: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

* fix(sdk-python): never fail a tool-loop turn on a usage-tracker error

Recording is an observation side effect, like the stream path. Without the
guard, a tracker error (for example a lock timeout) would turn a successful
completion into an exception, which the tool loop never did before it
recorded usage.

Co-Authored-By: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

---------

Co-authored-by: Abir Abbas <[REDACTED_EMAIL]>
Co-authored-by: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

**File**: `sdk/python/agentfield/agent_ai.py` (modified, +58/-2)
```diff
@@ -987,8 +987,64 @@ async def _call_with_fallbacks():
 
                 if final_config.enable_rate_limit_retry:
                     rate_limiter = self._get_rate_limiter()
-                    return await rate_limiter.execute_with_retry(_call_with_fallbacks)
-                return await _call_with_fallbacks()
+                    turn_resp = await rate_limiter.execute_with_retry(
+                        _call_with_fallbacks
+                    )
+                else:
+                    turn_resp = await _call_with_fallbacks()
+                try:
+                    _record_tool_turn_usage(turn_resp, params)
+                except Exception as e:
+                    # Usage accounting is an observation side effect: it must
+                    # never fail a completion that already succeeded.
+                    log_debug(f"Tool loop: usage recording failed: {e}")
+                return turn_resp
+
+            def _record_tool_turn_usage(turn_resp, params):
+                """Record token usage for one LLM turn of the tool loop."""
+                from agentfield.cost_tracker import (
+                    derive_provider,
+                    get_current_cost_tracker,
+                )
+                from .multimodal_response import detect_multimodal_response
+                from .usage_routing import routing_provider
+
+                tracker = get_current_cost_tracker() or getattr(
+                    self.agent, "cost_tracker", None
+                )
+                if tracker is None:
+                    return
+                requested_model = params.get("model", final_config.model)
+                provider = derive_provider(requested_model)
+                route = routing_provider(provider, params.get("api_base"))
+                usage = detect_multimodal_response(turn_resp)
+                if not usage.usage:
+                    tracker.record(
+                        model=requested_model,
+                        provider=provider,
+                        routing_provider=route,
+                        usage_status="missing",
+                    )
+                    return
+                from agentfield.execution_context import get_current_context
+
+                ctx = get_current_context()
+                tracker.record(
+                    model=getattr(turn_resp, "model", "") or requested_model,
+                    provider=provider,
+                    routing_provider=route,
+                    prompt_tokens=usage.usage.get("prompt_tokens", 0),
+                    completion_tokens=usage.usage.get("completion_tokens", 0),
+                    total_tokens=usage.usage.get("total_tokens", 0),
+                    cost_usd=usage.cost_usd,
+                    reasoner_name=ctx.reasoner_name if ctx else None,
+                    source="llm",
+                    cache_read_tokens=usage.usage.get("cache_read_tokens", 0),
+                    cache_creation_tokens=usage.usage.get(
+                        "cache_creation_tokens", 0
+                    ),
+                    cost_source=usage.cost_source,
+                )
 
             resp, trace = await execute_tool_call_loop(
                 agent=self.agent,
```

**File**: `sdk/python/tests/test_agent_ai_comprehensive.py` (modified, +174/-0)
```diff
@@ -529,3 +529,177 @@ async def test_ai_system_and_user_prompts(monkeypatch, agent_with_ai):
     assert len(messages) >= 2
     assert any(msg.get("role") == "system" for msg in messages)
     assert any(msg.get("role") == "user" for msg in messages)
+
+
+@pytest.mark.asyncio
+async def test_ai_tool_loop_records_usage_per_turn(monkeypatch, agent_with_ai):
+    """Every LLM turn of the tool-calling loop is recorded in the cost tracker."""
+    from agentfield.cost_tracker import CostTracker
+
+    agent_with_ai.cost_tracker = CostTracker()
+    litellm_module = setup_litellm_stub(monkeypatch)
+
+    def chat(content, tool_calls, usage):
+        return SimpleNamespace(
+            model="gpt-4",
+            usage=usage,
+            choices=[
+                SimpleNamespace(
+                    message=SimpleNamespace(
+                        content=content,
+                        audio=None,
+                        tool_calls=tool_calls,
+                        model_dump=lambda: {
+                            "role": "assistant",
+                            "content": content,
+                        },
+                    )
+                )
+            ],
+        )
+
+    tool_call = SimpleNamespace(
+        id="call_1",
+        function=SimpleNamespace(name="lookup", arguments="{}"),
+    )
+    litellm_module.acompletion.side_effect = [
+        chat(
+            None,
+            [tool_call],
+            {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15},
+        ),
+        chat(
+            "done",
+            None,
+            {"prompt_tokens": 20, "completion_tokens": 7, "total_tokens": 27},
+        ),
+    ]
+    agent_with_ai.call = AsyncMock(return_value={"ok": True})
+
+    ai = AgentAI(agent_with_ai)
+    tools = [
+        {
+            "type": "function",
+            "function": {
+                "name": "lookup",
+                "description": "d",
+                "parameters": {"type": "object", "properties": {}},
+            },
+        }
+    ]
+    await ai.ai("question", tools=tools)
+
+    summary = agent_with_ai.cost_tracker.serialize()
+    assert len(summary["entries"]) == 2
+    assert summary["total_tokens"] == 42
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("rate_limit_retry", [True, False])
+async def test_ai_tool_loop_records_cache_tokens_and_missing_usage(
+    monkeypatch, agent_with_ai, rate_limit_retry
+):
+    """Tool-loop turns keep prompt-cache counts, and a turn whose provider
+    reported no usage is flagged as missing rather than silently dropped."""
+    from agentfield.cost_tracker import CostTracker
+
+    agent_with_ai.cost_tracker = CostTracker()
+    agent_with_ai.ai_config.enable_rate_limit_retry = rate_limit_retry
+    litellm_module = setup_litellm_stub(monkeypatch)
+
+    def chat(content, tool_calls, usage):
+        return SimpleNamespace(
+            model="gpt-4",
+            usage=usage,
+            choices=[
+                SimpleNamespace(
+                    message=SimpleNamespace(
+                        content=content,
+                        audio=None,
+                        tool_calls=tool_calls,
+                        model_dump=lambda: {"role": "assistant", "content": content},
+                    )
+                )
+            ],
+        )
+
+    tool_call = SimpleNamespace(
+        id="call_1", function=SimpleNamespace(name="lookup", arguments="{}")
+    )
+    litellm_module.acompletion.side_effect = [
+        chat(
+            None,
+            [tool_call],
+            {
+                "prompt_tokens": 10,
+                "completion_tokens": 5,
+                "total_tokens": 15,
+                "cache_read_input_tokens": 4,
+                "cache_creation_input_tokens": 2,
+            },
+        ),
+        chat("done", None, None),
+    ]
+    agent_with_ai.call = AsyncMock(return_value={"ok": True})
+
+    tools = [
+        {
+            "type": "function",
+            "function": {
+                "name": "lookup",
+                "description": "d",
+                "parameters": {"type": "object", "properties": {}},
+            },
+        }
+    ]
+    await AgentAI(agent_with_ai).ai("question", tools=tools)
+
+    entries = agent_with_ai.cost_tracker.serialize()["entries"]
+    assert len(entries) == 2
+    assert entries[0]["cache_read_tokens"] == 4
+    assert entries[0]["cache_creation_tokens"] == 2
+    assert entries[1]["usage_status"] == "missing"
+
+
+@pytest.mark.asyncio
+async def test_ai_tool_loop_survives_usage_tracker_failure(monkeypatch, agent_with_ai):
+    """A broken cost tracker must not fail a tool-loop completion that succeeded."""
+
+    class _BrokenTracker:
+        def record(self, **kwargs):
+            raise RuntimeError("tracker down")
+
+    agent_with_ai.cost_tracker = _BrokenTracker()
+    litellm_module = setup_litellm_stub(monkeypatch)
+    usage = {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens
```

---

### Incident Patch 2: `961af5f1` (2026-11-23)
**Commit Message**: fix(tray): reduce endpoint-security false positives on macOS (#1236)

* Separate macOS tray setup from server startup

* Sign and notarize standalone macOS tray binaries

* fix(tray): remove the staged tray copy when the packaged app takes over

Older Desktop builds and install.sh copied the tray helper to
~/.agentfield/bin/af-tray. Once the tray runs from the signed Desktop app that
copy is an unreferenced executable in a hidden folder, which is exactly what
endpoint-security tools quarantine. Delete it when Desktop adopts or hides the
tray, but never while a tray job still names it and never the running program.

af service uninstall now also removes the session tray plist and the staged
copy, so an uninstall leaves no launchd job or helper behind.

Co-authored-by: ZeroPoint95 <[REDACTED_EMAIL]>
Co-Authored-By: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

* fix(install): stop stripping the macOS quarantine attribute

curl never sets com.apple.quarantine on what it downloads, so the three
xattr -d calls removed nothing, and a script that clears that attribute looks
like Gatekeeper evasion to endpoint-security tools. The release binaries are
Developer ID signed and notarized, so macOS acc

**File**: `.github/workflows/control-plane.yml` (modified, +8/-0)
```diff
@@ -141,6 +141,14 @@ jobs:
           go build ./cmd/af-tray/
           go vet ./cmd/af-tray/
 
+      # The tray's install, upgrade and login-item paths are darwin-only code
+      # that the Linux jobs cannot execute. These tests drive them against a stub
+      # launchctl, and check that Service Management can see the bundled login
+      # agent from inside an app bundle.
+      - name: Test the macOS tray lifecycle
+        working-directory: control-plane
+        run: go test -count=1 ./cmd/af-tray/ ./internal/launchdsvc/
+
   # Summary job that depends on all critical checks
   required-checks:
     name: All Required Checks Passed
```

**File**: `.github/workflows/desktop.yml` (modified, +34/-0)
```diff
@@ -64,11 +64,45 @@ jobs:
           else
             printf 'stub' > vendor/af
           fi
+          if [ "$RUNNER_OS" = "macOS" ]; then
+            # af-tray lands in Contents/MacOS, where it is signed as code, so the
+            # stub has to be a real Mach-O binary rather than a text file.
+            printf 'int main(void) { return 0; }\n' > "$RUNNER_TEMP/af-tray-stub.c"
+            cc -o vendor/af-tray "$RUNNER_TEMP/af-tray-stub.c"
+          fi
 
       - name: Package (unsigned, unpacked)
         working-directory: desktop
         run: npm run dist:dir
 
+      # The tray helper must ship inside the app, with the one bundled login
+      # agent that Service Management registers. Without them the app falls back
+      # to copying the helper into a second bundle, which is the install pattern
+      # endpoint-security tools flag as malware persistence.
+      - name: Check the packaged tray layout (macOS)
+        if: runner.os == 'macOS'
+        working-directory: desktop
+        run: |
+          set -euo pipefail
+          shopt -s nullglob
+          apps=(release/mac*/*.app)
+          if [ ${#apps[@]} -ne 1 ]; then
+            echo "expected one packed .app under desktop/release, found: ${apps[*]:-nothing}" >&2
+            exit 1
+          fi
+          app="${apps[0]}"
+          test -x "$app/Contents/MacOS/af-tray"
+          agents=("$app"/Contents/Library/LaunchAgents/*.plist)
+          if [ ${#agents[@]} -ne 1 ] || [ "$(basename "${agents[0]}")" != "ai.agentfield.tray.login.plist" ]; then
+            echo "expected exactly ai.agentfield.tray.login.plist, found: ${agents[*]:-nothing}" >&2
+            exit 1
+          fi
+          plutil -lint "${agents[0]}"
+          # BundleProgram is resolved against the app bundle, so it must name the helper.
+          test "$(plutil -extract BundleProgram raw -o - "${agents[0]}")" = "Contents/MacOS/af-tray"
+          # The ad-hoc signature must seal the helper and the plist like any other code.
+          codesign --verify --deep --strict --verbose=2 "$app"
+
   # Manual-dispatch-only: prove the macOS signing/notarization secrets work
   # without cutting a release. Imports the Developer ID cert into a keychain
   # (the same thing electron-builder does with CSC_LINK) and authenticates
```

**File**: `.github/workflows/release.yml` (modified, +134/-0)
```diff
@@ -300,6 +300,118 @@ jobs:
           echo "=== Flattened dist/ directory ==="
           ls -lah dist/agentfield-* 2>/dev/null || echo "No binaries found"
 
+      # The standalone macOS binaries are signed with the same Developer ID as the
+      # Desktop app, with the hardened runtime and a secure timestamp, and are
+      # notarized. Both are launched by the user's login session (the tray, and the
+      # control plane under launchd), and an ad-hoc or unsigned executable that runs
+      # at login is what endpoint-security tools quarantine. This runs before the
+      # publish job computes checksums, so the published sums match what ships.
+      #
+      # Production releases refuse to ship unsigned binaries. Staging degrades to a
+      # warning like the Desktop installer step below.
+      - name: Sign and notarize standalone macOS binaries
+        if: matrix.label == 'darwin'
+        shell: bash
+        env:
+          CSC_LINK: ${{ secrets.CSC_LINK }}
+          CSC_KEY_PASSWORD: ${{ secrets.CSC_KEY_PASSWORD }}
+          APPLE_ID: ${{ secrets.APPLE_ID }}
+          APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
+          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
+          RELEASE_ENVIRONMENT: ${{ needs.prepare.outputs.environment }}
+        run: |
+          set -euo pipefail
+
+          if [[ -z "$CSC_LINK" || -z "$CSC_KEY_PASSWORD" || -z "$APPLE_ID" || \
+                -z "$APPLE_APP_SPECIFIC_PASSWORD" || -z "$APPLE_TEAM_ID" ]]; then
+            if [[ "$RELEASE_ENVIRONMENT" == "production" ]]; then
+              echo "::error::Production macOS binaries require the Developer ID and Apple notarization secrets"
+              exit 1
+            fi
+            echo "::warning::signing/notarization secrets incomplete; the standalone macOS binaries stay unsigned"
+            exit 0
+          fi
+
+          # name:identifier pairs. The identifier is what macOS shows for the item
+          # in Login Items and in security prompts.
+          targets=(
+            "dist/agentfield-tray-darwin-amd64:ai.agentfield.tray"
+            "dist/agentfield-tray-darwin-arm64:ai.agentfield.tray"
+            "dist/agentfield-darwin-amd64:ai.agentfield.cli"
+            "dist/agentfield-darwin-arm64:ai.agentfield.cli"
+          )
+          binaries=()
+          for target in "${targets[@]}"; do
+            binary="${target%%:*}"
+            if [[ ! -f "$binary" ]]; then
+              echo "::error::Missing standalone macOS binary: $binary"
+              exit 1
+            fi
+            binaries+=("$binary")
+          done
+
+          signing_dir="$(mktemp -d "$RUNNER_TEMP/af-signing.XXXXXX")"
+          keychain="$signing_dir/signing.keychain-db"
+          trap 'security delete-keychain "$keychain" >/dev/null 2>&1 || true; rm -rf -- "$signing_dir"' EXIT
+          keychain_password="$(openssl rand -hex 32)"
+
+          printf '%s' "$CSC_LINK" | base64 --decode > "$signing_dir/cert.p12"
+          security create-keychain -p "$keychain_password" "$keychain"
+          security unlock-keychain -p "$keychain_password" "$keychain"
+          security import "$signing_dir/cert.p12" -k "$keychain" \
+            -P "$CSC_KEY_PASSWORD" -T /usr/bin/codesign
+          security set-key-partition-list -S apple-tool:,apple: -s -k "$keychain_password" "$keychain" >/dev/null
+
+          # Include the temporary keychain when codesign resolves the certificate chain.
+          # Deleting the keychain removes its entry from the search list.
+          existing_keychains="$(security list-keychains -d user | sed -E 's/^[[:space:]]*"//; s/"$//')"
+          keychains=("$keychain")
+          while IFS= read -r entry; do
+            if [[ -n "$entry" ]]; then keychains+=("$entry"); fi
+          done <<< "$existing_keychains"
+          security list-keychains -d user -s "${keychains[@]}"
+
+          requirement="=anchor apple generic and certificate leaf[field.1.2.840.113635.100.6.1.13] exists and certificate leaf[subject.OU] = \"$APPLE_TEAM_ID\""
+          for target in "${targets[@]}"; do
+            binary="${target%%:*}"
+            identifier="${target##*:}"
+            codesign --force --sign 'Developer ID Application:' --keychain "$keychain" \
+              --identifier "$identifier" --options runtime --timestamp "$binary"
+            codesign --verify --strict --test-requirement "$requirement" --verbose=2 "$binary"
+            # Notarization below rejects a binary without the hardened runtime or
+            # a secure timestamp, so those flags are enforced by Apple, not here.
+          done
+
+          # The ZIP is for Apple only. Raw Mach-O binaries get online tickets
+          # and keep their existing release asset names and download format.
+          archive="$signing_dir/af-binaries.zip"
+          zip -jq "$archive" "${binaries[@]}"
+          notary_auth=(--apple-id "$APPLE_ID" --password "$APPLE_APP_SPECIFIC_PASSWORD" --team-id "$APPLE_TEA
```

**File**: `README.md` (modified, +8/-4)
```diff
@@ -54,10 +54,14 @@ The provider name `aforge` remains an alias; set `AFORGE_BIN` and select
 `$AGENTFIELD_HOME/codeaf`. See [harness providers](docs/harness-providers.md)
 for binary overrides, mirror/skip switches, and telemetry controls.
 
-On macOS the installer also registers the control plane to start at login (under
-launchd) and adds a menu-bar icon. Stop it with `af service stop` or the menu-bar
-icon — a plain `kill` looks like a crash and it restarts. `af service status`
-shows health and in-flight work; install with `--no-tray` to skip this entirely.
+On macOS the installer does not register anything to run at login. Add the
+optional menu-bar icon with `--with-tray`; it registers one login job for the
+icon, and the icon's **Control plane → Start at login** switch decides whether
+the control plane starts at login as well. A machine that already has the icon
+keeps it and is updated in place (`--no-tray` skips that). When launchd
+supervises the control plane, stop it with `af service stop` or the menu-bar icon
+— a plain `kill` looks like a crash and it restarts. `af service status` shows
+health and in-flight work.
 
 Then in your coding agent, paste any spec with /agentfield :
 
```

**File**: `control-plane/cmd/af-tray/assets_darwin.go` (modified, +0/-5)
```diff
@@ -12,8 +12,3 @@ var iconActive []byte
 
 //go:embed assets/icon_inactive.png
 var iconInactive []byte
-
-// appIconICNS is written into the generated .app bundle's Resources on macOS.
-//
-//go:embed assets/appicon.icns
-var appIconICNS []byte
```

**File**: `control-plane/cmd/af-tray/claude_quota_darwin.go` (modified, +11/-0)
```diff
@@ -16,6 +16,12 @@ import (
 // STRICT contract (see shared.go): read-only. We never write to the Keychain,
 // and the token is only ever handed to fetchClaudeQuota, which sends it to
 // api.anthropic.com and nowhere else. It is never logged or persisted.
+//
+// OPT-IN ONLY. This reads a credential that belongs to another application, so
+// the caller must have checked claudeUsageEnabled() first: the tray never runs
+// `security find-generic-password` until the user has turned "Show Claude usage
+// limits" on. Endpoint-security tools treat an unprompted Keychain read by a
+// background helper as credential theft, and they are right to.
 
 // readClaudeCodeToken reads the OAuth access token that Claude Code stores in
 // the macOS login Keychain under the "Claude Code-credentials" generic-password
@@ -54,6 +60,11 @@ const claudeUsageURL = "https://api.anthropic.com/api/oauth/usage"
 // It returns a zero (OK=false) claudeQuota whenever anything is unavailable, so
 // the caller can render nothing without special-casing.
 func fetchClaudeQuotaNow() claudeQuota {
+	// The one door to the Keychain read: without the user's opt-in this
+	// returns before any `security` process is spawned.
+	if !claudeUsageEnabled() {
+		return claudeQuota{}
+	}
 	token := readClaudeCodeToken()
 	if token == "" {
 		return claudeQuota{}
```

**File**: `control-plane/cmd/af-tray/claude_quota_darwin_test.go` (added, +47/-0)
```diff
@@ -0,0 +1,47 @@
+//go:build darwin
+
+package main
+
+import (
+	"os"
+	"path/filepath"
+	"testing"
+)
+
+// Contract: the tray reads the Claude Code login from the Keychain only after
+// the user has turned "Show Claude usage limits" on. Before that no `security`
+// process is started at all, because an unprompted Keychain read by a background
+// helper is what endpoint-security tools treat as credential theft.
+func TestKeychainIsNotReadUntilTheUserOptsIn(t *testing.T) {
+	root := t.TempDir()
+	t.Setenv("HOME", root)
+	bin := filepath.Join(root, "bin")
+	marker := filepath.Join(root, "security-ran")
+	mustWriteTrayFixture(t, filepath.Join(bin, "security"), "#!/bin/sh\necho \"$@\" >> \""+marker+"\"\nexit 1\n")
+	t.Setenv("PATH", bin+":/usr/bin:/bin")
+
+	ran := func() bool {
+		_, err := os.Stat(marker)
+		return err == nil
+	}
+
+	if q := fetchClaudeQuotaNow(); q.OK || ran() {
+		t.Fatalf("default: quota=%+v, security ran=%v; want no Keychain read", q, ran())
+	}
+	if err := setClaudeUsageEnabled(true); err != nil {
+		t.Fatal(err)
+	}
+	fetchClaudeQuotaNow()
+	if !ran() {
+		t.Fatal("opted in: the Keychain was never consulted")
+	}
+	if err := setClaudeUsageEnabled(false); err != nil {
+		t.Fatal(err)
+	}
+	if err := os.Remove(marker); err != nil {
+		t.Fatal(err)
+	}
+	if q := fetchClaudeQuotaNow(); q.OK || ran() {
+		t.Fatalf("opted back out: quota=%+v, security ran=%v; want no Keychain read", q, ran())
+	}
+}
```

**File**: `control-plane/cmd/af-tray/desktop_install_darwin.go` (added, +350/-0)
```diff
@@ -0,0 +1,350 @@
+//go:build darwin
+
+package main
+
+import (
+	"bytes"
+	"errors"
+	"fmt"
+	"html"
+	"os"
+	"os/exec"
+	"path/filepath"
+	"strings"
+	"syscall"
+	"time"
+
+	"github.com/Agent-Field/agentfield/control-plane/internal/launchdsvc"
+)
+
+const desktopLoginLabel = "ai.agentfield.tray.login"
+
+func desktopMarkerPath() string { return filepath.Join(agentfieldDir(), "desktop-tray") }
+func traySessionPath() string   { return filepath.Join(agentfieldDir(), "tray-session.plist") }
+
+// Both installers manage the same per-user tray. Serialize the transition across
+// processes, including a CLI update that overlaps with Desktop startup.
+func withTrayLock(apply func() error) error {
+	if err := os.MkdirAll(logsDir(), 0o755); err != nil {
+		return err
+	}
+	lock, err := os.OpenFile(filepath.Join(agentfieldDir(), "tray.lock"), os.O_CREATE|os.O_RDWR, 0o600)
+	if err != nil {
+		return err
+	}
+	defer lock.Close()
+	if err := syscall.Flock(int(lock.Fd()), syscall.LOCK_EX); err != nil {
+		return err
+	}
+	return apply()
+}
+
+// stagedTrayPath is the copy of the helper that older Desktop builds and the
+// installer left in ~/.agentfield/bin. A tray that runs from the signed Desktop
+// app has no use for it, and an unreferenced executable in a hidden folder is
+// exactly what endpoint-security tools quarantine.
+func stagedTrayPath() string { return filepath.Join(binDir(), "af-tray") }
+
+// removeStagedTray deletes the staged copy once no tray job names it. It never
+// follows a link, never deletes the program that is running, and leaves the copy
+// alone while a job still points at it (the CLI-installed tray runs from it).
+func removeStagedTray(program string) error {
+	staged := stagedTrayPath()
+	if staged == program {
+		return nil
+	}
+	info, err := os.Lstat(staged)
+	if errors.Is(err, os.ErrNotExist) {
+		return nil
+	}
+	if err != nil || !info.Mode().IsRegular() {
+		return err
+	}
+	for _, job := range []string{trayPlistPath(), traySessionPath()} {
+		data, err := os.ReadFile(job)
+		if err != nil {
+			continue
+		}
+		if html.UnescapeString(launchdsvc.ParsePlistOwner(data).Program) == staged {
+			return nil
+		}
+	}
+	return removeIfPresent(staged)
+}
+
+func desktopOwnsTray() bool {
+	data, err := os.ReadFile(desktopMarkerPath())
+	if err != nil {
+		return false
+	}
+	program, _, _ := strings.Cut(string(data), "\n")
+	info, err := os.Stat(program)
+	return err == nil && info.Mode().IsRegular()
+}
+
+// A native login job can start while a session tray is still shutting down.
+func lockTrayProcess() (*os.File, error) {
+	if err := os.MkdirAll(agentfieldDir(), 0o755); err != nil {
+		return nil, err
+	}
+	lock, err := os.OpenFile(filepath.Join(agentfieldDir(), "tray-running.lock"), os.O_CREATE|os.O_RDWR, 0o600)
+	if err != nil {
+		return nil, err
+	}
+	if err := syscall.Flock(int(lock.Fd()), syscall.LOCK_EX|syscall.LOCK_NB); err != nil {
+		lock.Close()
+		if errors.Is(err, syscall.EWOULDBLOCK) {
+			return nil, nil
+		}
+		return nil, err
+	}
+	return lock, nil
+}
+
+func installDesktop() error {
+	return withTrayLock(func() error {
+		if desktopOwnsTray() {
+			fmt.Println("The tray is managed by AgentField Desktop.")
+			return nil
+		}
+		program, err := os.Executable()
+		if err != nil {
+			return err
+		}
+		if err := installTrayAgent(trayPlistPath(), program); err != nil {
+			return err
+		}
+		if err := launchdsvc.RemoveLegacyTrayBundle(home()); err != nil {
+			return err
+		}
+		fmt.Println("AgentField tray installed. Look for the icon in your menu bar.")
+		return nil
+	})
+}
+
+func uninstallDesktop() error {
+	return withTrayLock(func() error {
+		if desktopOwnsTray() {
+			return fmt.Errorf("hide the tray in AgentField Desktop settings")
+		}
+		if err := removeTrayAgent(trayPlistPath()); err != nil {
+			return err
+		}
+		return launchdsvc.RemoveLegacyTrayBundle(home())
+	})
+}
+
+func syncDesktopTray(visible bool, login string) error {
+	program, err := os.Executable()
+	if err != nil {
+		return err
+	}
+	return withTrayLock(func() error { return syncPackagedTray(program, visible, login) })
+}
+
+func syncPackagedTray(program string, visible bool, login string) error {
+	native := desktopLoginStatus()
+	legacy, err := readTrayAgent(trayPlistPath())
+	if err != nil {
+		return err
+	}
+	atLogin := login == "login" || login == "auto" && (native.registered() || len(legacy) > 0 && legacyTrayAtLogin())
+	digest, ok := launchdsvc.FileSHA256(program)
+	if !ok {
+		return fmt.Errorf("could not fingerprint the bundled tray at %s", program)
+	}
+	previous, _ := os.ReadFile(desktopMarkerPath())
+	marker := []byte(program + "\n" + digest + "\n")
+	if !visible {
+		if err := setDesktopLogin(native, false); err != nil {
+			return err
+		}
+		if err := removeTrayAgent(traySessionPath()); err != nil {
+			return err
+		}
+		if err := removeTrayAgent(trayPlistPath()); err != nil {
+			return err
+		}
+		if err := launchdsvc.RemoveLegacyTrayBundle(home()); err != nil {
+			return
```

---

### Incident Patch 3: `cb7f77ee` (2026-11-23)
**Commit Message**: fix(sdk-go): panic on nil skill in IncludeRouter and name the handler (#1233)

**File**: `sdk/go/agent/agent_invariant_test.go` (modified, +2/-2)
```diff
@@ -231,9 +231,9 @@ func TestInvariant_Agent_LocalCallIsolation(t *testing.T) {
 // registering a nil handler panics immediately rather than silently storing it.
 func TestInvariant_Agent_NilHandlerPanics(t *testing.T) {
 	a := makeMinimalAgent(t)
-	assert.Panics(t, func() {
+	assert.PanicsWithValue(t, `agentfield: reasoner "bad": nil handler`, func() {
 		a.RegisterReasoner("bad", nil)
-	}, "registering nil handler must panic")
+	}, "registering nil handler must panic and name the reasoner")
 }
 
 // TestInvariant_Agent_ExecuteUnknownReasoner returns a non-nil error.
```

**File**: `sdk/go/agent/agent_register.go` (modified, +9/-3)
```diff
@@ -2,13 +2,19 @@ package agent
 
 import (
 	"encoding/json"
-	"errors"
+	"fmt"
 )
 
+// nilHandlerError reports a nil handler for the reasoner or skill called name,
+// so the offender can be found in an agent with many routers.
+func nilHandlerError(kind, name string) error {
+	return fmt.Errorf("agentfield: %s %q: nil handler", kind, name)
+}
+
 // RegisterReasoner makes a handler available at /reasoners/{name}.
 func (a *Agent) RegisterReasoner(name string, handler HandlerFunc, opts ...ReasonerOption) {
 	if handler == nil {
-		panic("nil handler supplied")
+		panic(nilHandlerError("reasoner", name).Error())
 	}
 
 	meta := &Reasoner{
@@ -50,7 +56,7 @@ func (a *Agent) RegisterReasoner(name string, handler HandlerFunc, opts ...Reaso
 // RegisterSkill makes a deterministic handler available at /skills/{name}.
 func (a *Agent) RegisterSkill(name string, handler HandlerFunc, opts ...ReasonerOption) error {
 	if handler == nil {
-		return errors.New("nil handler supplied")
+		return nilHandlerError("skill", name)
 	}
 
 	meta := &Reasoner{
```

**File**: `sdk/go/agent/router.go` (modified, +5/-1)
```diff
@@ -172,7 +172,11 @@ func (r *Router) flatten(prefix string, inheritedTags []string) []routerHandlerE
 func (a *Agent) IncludeRouter(router *Router, opts RouterOptions) {
 	for _, e := range router.flatten(opts.Prefix, opts.Tags) {
 		if e.skill {
-			a.RegisterSkill(e.name, e.handler, e.opts...)
+			// IncludeRouter has no error return, so a rejected skill panics like
+			// the reasoner branch below instead of silently going missing.
+			if err := a.RegisterSkill(e.name, e.handler, e.opts...); err != nil {
+				panic(err.Error())
+			}
 			continue
 		}
 		a.RegisterReasoner(e.name, e.handler, e.opts...)
```

**File**: `sdk/go/agent/router_test.go` (modified, +34/-0)
```diff
@@ -300,3 +300,37 @@ func TestRouter_IssueExample(t *testing.T) {
 	mustNotExecute(t, b, "users.get-profile")
 	mustNotExecute(t, b, "orders.create")
 }
+
+// A nil handler on a router must fail loudly when the router is mounted, for
+// skills as well as reasoners, and the message must name the mounted handler.
+func TestRouter_NilHandlerPanicsOnMount(t *testing.T) {
+	tests := []struct {
+		name     string
+		register func(*agent.Router)
+		want     string
+	}{
+		{
+			name:     "skill",
+			register: func(r *agent.Router) { r.RegisterSkill("lookup", nil) },
+			want:     `agentfield: skill "orders.lookup": nil handler`,
+		},
+		{
+			name:     "reasoner",
+			register: func(r *agent.Router) { r.RegisterReasoner("lookup", nil) },
+			want:     `agentfield: reasoner "orders.lookup": nil handler`,
+		},
+	}
+	for _, tc := range tests {
+		t.Run(tc.name, func(t *testing.T) {
+			r := agent.NewRouter()
+			tc.register(r)
+
+			defer func() {
+				if got := recover(); got != tc.want {
+					t.Fatalf("IncludeRouter panic = %v, want %q", got, tc.want)
+				}
+			}()
+			newTestAgent(t).IncludeRouter(r, agent.RouterOptions{Prefix: "orders"})
+		})
+	}
+}
```

**File**: `sdk/go/agent/skill_registration_additional_test.go` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@ func TestRegisterSkill_HTTPDiscoveryAndLocalExecution(t *testing.T) {
 	})
 	require.NoError(t, err)
 
-	require.Error(t, a.RegisterSkill("bad", nil))
+	require.EqualError(t, a.RegisterSkill("bad", nil), `agentfield: skill "bad": nil handler`)
 	require.NoError(t, a.RegisterSkill("add", func(ctx context.Context, input map[string]any) (any, error) {
 		return map[string]any{"ok": input["ok"]}, nil
 	}, WithReasonerTags("deterministic"), WithRequireRealtimeValidation()))
```

#### Recent Merged Pull Requests:
- **PR #1240** (2026-11-23): fix(desktop): extract deploy-engine zips with tar.exe so the Windows installer builds again (@AbirAbbas)
- **PR #1238** (2026-11-23): feat: generic app link (owner proof, provider-agnostic live watch and steer, contract doc) (@AbirAbbas)
- **PR #1236** (2026-11-23): fix(tray): reduce endpoint-security false positives on macOS (@AbirAbbas)
- **PR #1233** (2026-11-23): fix(sdk-go): panic on nil skill in IncludeRouter and name the handler (@Aditya-Tripuraneni)
- **PR #1232** (2026-11-23): docs: fix broken relative links in examples and SDK READMEs (@radasanuflorin)
- **PR #1230** (2026-11-22): docs(skills): add agentfield-sdk, a reference skill for coding agents (@santoshkumarradha)

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

## X. sdk-python): record token usage for every tool-calling turn in ai(tools=...)

**RULE**:
When implementing operations in `sdk/python/agentfield/agent_ai.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Agent-Field/agentfield. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `dc802dcb`: sdk-python): record token usage for every tool-calling turn in ai(tools=...). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `sdk/python/agentfield/agent_ai.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
                    turn_resp = await rate_limiter.execute_with_retry(
                        _call_with_fallbacks
                    )
                else:
                    turn_resp = await _call_with_fallbacks()
                try:
                    _record_tool_turn_usage(turn_resp, params)
                except Exception as e:
                    # Usage accounting is an observation side effect: it must
                    # never fail a completion that already succeeded.
                    log_debug(f"Tool loop: usage recording failed: {e}")
                return turn_resp

            def _record_tool_turn_usage(turn_resp, params):
                """Record token usage for one LLM turn of the tool loop."""
                from agentfield.cost_tracker import (
                    derive_provider,
                    get_current_cost_tracker,
                )
                from .multimodal_response import detect_multimodal_response
                from .usage_routing import routing_provider

                tracker = get_current_cost_tracker() or getattr(
                    self.agent, "cost_tracker", None
                )
                if tracker is None:
 
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
                    return await rate_limiter.execute_with_retry(_call_with_fallbacks)
                return await _call_with_fallbacks()
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `dc802dcb` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
