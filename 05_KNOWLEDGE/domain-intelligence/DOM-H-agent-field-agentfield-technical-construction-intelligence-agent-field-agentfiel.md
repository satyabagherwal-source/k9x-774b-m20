# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: Agent-Field/agentfield Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "Agent-Field/agentfield",
  "source_url": "https://github.com/Agent-Field/agentfield",
  "source_version": "7205812b",
  "license": "Apache-2.0",
  "timestamp": "2026-11-14T15:49:37.929Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-agent-field-agentfield",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [Agent-Field/agentfield](https://github.com/Agent-Field/agentfield) (Revision: `7205812b`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-14T15:49:37.929Z`  
> **Learning ID**: `learn-github-agent-field-agentfield`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: K (Quality & Verification Intelligence), G (Architecture Intelligence), F (Design Intelligence), D (Research & Knowledge Intelligence), I (Content & Information Intelligence), M (Feedback & Evolution Intelligence), L (Deployment & Operations Intelligence), A (Human & Need Intelligence), B (Product Intelligence), J (Search & Distribution Intelligence)
- **Confidence Rating**: 75%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from Agent-Field/agentfield:

# Forensic Learning Record (Deep Inspection): Agent-Field/agentfield

> **Canonical Artifact**: `07_PROJECT_LEARNING/agent-field-agentfield-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Agent-Field/agentfield](https://github.com/Agent-Field/agentfield))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-14T15:49:36.833Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Agent-Field/agentfield`
- **Description**: Build, run and scale AI agents like API and microservices
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2656 stars

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

### Incident Patch 1: `0145089a` (2026-11-13)
**Commit Message**: fix(python): finish harness cleanup before propagating cancellation (#1180)

* fix(python): finish harness cleanup before propagating cancellation

* fix(python): retain harness cleanup during loop shutdown

* test(python): respect cancellation message version contract

**File**: `sdk/python/agentfield/harness/_cli.py` (modified, +38/-14)
```diff
@@ -250,7 +250,9 @@ async def _wait_process_exit(
     """
     try:
         return await asyncio.wait_for(proc.wait(), timeout=_PROC_EXIT_GRACE_SECONDS)
-    except (asyncio.TimeoutError, TimeoutError):
+    except (asyncio.TimeoutError, TimeoutError, asyncio.CancelledError):
+        # Loop shutdown cancels the cleanup task too. Finish the same bounded
+        # kill/poll fallback; run_cli still propagates the caller's cancellation.
         pass
     # The notification may have landed while we grace-waited (in which case
     # the transport finalizer may already have dropped its Popen reference —
@@ -267,7 +269,11 @@ async def _wait_process_exit(
         returncode = popen.poll()
         if returncode is not None:
             return returncode
-        await asyncio.sleep(0.1)
+        try:
+            await asyncio.sleep(0.1)
+        except asyncio.CancelledError:
+            # Do not restart the polling budget when shutdown cancels again.
+            pass
     return proc.returncode
 
 
@@ -402,18 +408,36 @@ def _kill_group() -> None:
                     break
                 # Spurious wakeup (progress reset the idle window): loop again.
     finally:
-        if not completed:
-            # Timeout, cancellation, or an internal error: stop the child so
-            # nothing keeps running and the exit wait below can conclude.
-            # (Previously only the timeout paths killed; a cancelled run_cli
-            # left the child running and awaited its natural exit.)
-            _kill_group()
-        drain.cancel()
-        try:
-            await drain
-        except BaseException:
-            pass
-        fallback_returncode = await _wait_process_exit(proc, _kill_group)
+
+        async def cleanup() -> Optional[int]:
+            if not completed:
+                _kill_group()
+            drain.cancel()
+            try:
+                await drain
+            except BaseException:
+                pass
+            return await _wait_process_exit(proc, _kill_group)
+
+        # Pipe EOF does not mean the child has exited. Keep ownership until
+        # the bounded exit wait finishes, even if cancellation arrives here
+        # or is repeated while cleanup is already running.
+        cleanup_task = asyncio.create_task(cleanup())
+        cleanup_cancelled: Optional[asyncio.CancelledError] = None
+        while True:
+            try:
+                fallback_returncode = await asyncio.shield(cleanup_task)
+                break
+            except asyncio.CancelledError as exc:
+                if cleanup_cancelled is None:
+                    cleanup_cancelled = exc
+                    _kill_group()
+                if cleanup_task.cancelled():
+                    # Shutdown can cancel a task before its coroutine starts.
+                    fallback_returncode = await _wait_process_exit(proc, _kill_group)
+                    break
+        if cleanup_cancelled is not None:
+            raise cleanup_cancelled
 
     if idle_timed_out:
         raise TimeoutError(
```

**File**: `sdk/python/tests/test_harness_cli.py` (modified, +146/-0)
```diff
@@ -218,6 +218,152 @@ async def never_ready(_n):
     process.kill.assert_called()
 
 
+@pytest.mark.asyncio
+@pytest.mark.parametrize("repeat_cancel", [False, True])
+async def test_run_cli_cancellation_after_pipe_eof_reaps_child(
+    monkeypatch, repeat_cancel
+):
+    """Cancellation must still own the child after its output pipes close."""
+    create_process = asyncio.create_subprocess_exec
+    waiting_for_exit = asyncio.Event()
+    reaped = asyncio.Event()
+    release_wait = asyncio.Event()
+    process = None
+
+    async def spawn(*args, **kwargs):
+        nonlocal process
+        process = await create_process(*args, **kwargs)
+        wait = process.wait
+
+        async def observed_wait():
+            waiting_for_exit.set()
+            result = await wait()
+            reaped.set()
+            if repeat_cancel:
+                await release_wait.wait()
+            return result
+
+        process.wait = observed_wait
+        return process
+
+    monkeypatch.setattr(asyncio, "create_subprocess_exec", spawn)
+    task = asyncio.create_task(
+        run_cli(
+            [
+                sys.executable,
+                "-c",
+                "import os, time; os.close(1); os.close(2); time.sleep(60)",
+            ],
+            timeout=30,
+            idle_seconds=0,
+        )
+    )
+    try:
+        await asyncio.wait_for(waiting_for_exit.wait(), timeout=5)
+        task.cancel("stop after EOF")
+        if repeat_cancel:
+            await asyncio.wait_for(reaped.wait(), timeout=2)
+            task.cancel("stop again")
+            await asyncio.sleep(0)
+            assert not task.done()
+            release_wait.set()
+        with pytest.raises(asyncio.CancelledError) as cancelled:
+            await asyncio.wait_for(task, timeout=2)
+        # Task cancellation messages reach awaiters starting with Python 3.11.
+        if sys.version_info >= (3, 11):
+            assert str(cancelled.value) == "stop after EOF"
+        assert process is not None
+        assert process.returncode is not None
+    finally:
+        release_wait.set()
+        if not task.done():
+            task.cancel()
+            await asyncio.gather(task, return_exceptions=True)
+        if process is not None and process.returncode is None:
+            process.kill()
+            await process.wait()
+
+
+@pytest.mark.asyncio
+async def test_run_cli_returns_exit_status_after_pipe_eof():
+    stdout, stderr, returncode = await run_cli(
+        [
+            sys.executable,
+            "-c",
+            "import os, sys, time; print('done', flush=True); "
+            "os.close(1); os.close(2); time.sleep(0.05); sys.exit(7)",
+        ],
+        timeout=2,
+        idle_seconds=0,
+    )
+    assert (stdout, stderr, returncode) == ("done\n", "", 7)
+
+
+def test_run_cli_reaps_child_during_event_loop_shutdown(monkeypatch):
+    """asyncio.run cancels the runner and any cleanup tasks together."""
+    create_process = asyncio.create_subprocess_exec
+    process = None
+    runner = None
+    observed = {}
+
+    class ObservedPolicy(asyncio.DefaultEventLoopPolicy):
+        def new_event_loop(self):
+            loop = super().new_event_loop()
+            close = loop.close
+
+            def observed_close():
+                try:
+                    if process is not None:
+                        observed["child_alive"] = process.returncode is None
+                        observed["runner_cancelled"] = runner.cancelled()
+                        if process.returncode is None:
+                            process.kill()
+                            loop.run_until_complete(process.wait())
+                finally:
+                    close()
+
+            loop.close = observed_close
+            return loop
+
+    async def main():
+        nonlocal runner
+        waiting_for_exit = asyncio.Event()
+
+        async def spawn(*args, **kwargs):
+            nonlocal process
+            process = await create_process(*args, **kwargs)
+            wait = process.wait
+
+            async def observed_wait():
+                waiting_for_exit.set()
+                return await wait()
+
+            process.wait = observed_wait
+            return process
+
+        monkeypatch.setattr(asyncio, "create_subprocess_exec", spawn)
+        runner = asyncio.create_task(
+            run_cli(
+                [
+                    sys.executable,
+                    "-c",
+                    "import os, time; os.close(1); os.close(2); time.sleep(60)",
+                ],
+                timeout=30,
+                idle_seconds=0,
+            )
+        )
+        await asyncio.wait_for(waiting_for_exit.wait(), timeout=5)
+
+    policy = asyncio.get_event_loop_policy()
+    asyncio.set_event_loop_policy(ObservedPolicy())
+    try:
+        asyncio.run(main())
+    finally:
+        asyncio.set_event_loop_policy(policy)
+    assert observed == {"child_alive": False, "runner_cancelled": True}
```

---

### Incident Patch 2: `c148bb54` (2026-11-14)
**Commit Message**: fix(python): enforce total timeout while awaiting approval (#1198)

* fix(python): enforce total timeout while awaiting approval

Signed-off-by: Steven Huang <[REDACTED_EMAIL]>

* fix(python): preserve approval wait cancellation on supported runtimes

Signed-off-by: Steven Huang <[REDACTED_EMAIL]>

* style(python): format approval polling additions

Signed-off-by: Steven Huang <[REDACTED_EMAIL]>

---------

Signed-off-by: Steven Huang <[REDACTED_EMAIL]>

**File**: `sdk/python/agentfield/client.py` (modified, +37/-18)
```diff
@@ -2167,7 +2167,8 @@ async def wait_for_approval(
             execution_id: Execution ID to wait for.
             poll_interval: Initial polling interval in seconds.
             max_interval: Maximum polling interval in seconds.
-            timeout: Total timeout in seconds (None = wait indefinitely).
+            timeout: Total timeout including polling delays and requests, in seconds
+                (None = wait indefinitely).
 
         Returns:
             ApprovalStatusResponse with the final approval status (approved/rejected/expired).
@@ -2176,29 +2177,47 @@ async def wait_for_approval(
             AgentFieldClientError: If polling encounters a non-retryable error.
             ExecutionTimeoutError: If timeout is reached.
         """
-        start_time = time.time()
-        interval = poll_interval
-        backoff_factor = 2.0
 
-        while True:
-            if timeout is not None and (time.time() - start_time) >= timeout:
-                raise ExecutionTimeoutError(
-                    f"Approval for execution {execution_id} timed out after {timeout}s"
-                )
+        async def poll() -> ApprovalStatusResponse:
+            interval = poll_interval
+            backoff_factor = 2.0
 
-            await asyncio.sleep(interval)
+            while True:
+                await asyncio.sleep(interval)
+
+                try:
+                    result = await self.get_approval_status(execution_id)
+                except AgentFieldClientError:
+                    # Transient failure — back off and retry
+                    interval = min(interval * backoff_factor, max_interval)
+                    continue
+
+                if result.status != "pending":
+                    return result
 
-            try:
-                result = await self.get_approval_status(execution_id)
-            except AgentFieldClientError:
-                # Transient failure — back off and retry
                 interval = min(interval * backoff_factor, max_interval)
-                continue
 
-            if result.status != "pending":
-                return result
+        if timeout is None:
+            return await poll()
+
+        timeout_message = (
+            f"Approval for execution {execution_id} timed out after {timeout}s"
+        )
+        if timeout <= 0:
+            raise ExecutionTimeoutError(timeout_message)
 
-            interval = min(interval * backoff_factor, max_interval)
+        loop = asyncio.get_running_loop()
+        deadline = loop.time() + timeout
+        polling = asyncio.create_task(poll())
+        try:
+            done, _ = await asyncio.wait({polling}, timeout=timeout)
+            if not done or loop.time() >= deadline:
+                raise ExecutionTimeoutError(timeout_message)
+            return polling.result()
+        finally:
+            if not polling.done():
+                polling.cancel()
+            await asyncio.gather(polling, return_exceptions=True)
 
     async def post_execution_logs(
         self,
```

**File**: `sdk/python/tests/test_approval.py` (modified, +1/-12)
```diff
@@ -188,20 +188,9 @@ async def no_sleep(_: float) -> None:
 
 
 @pytest.mark.asyncio
-async def test_wait_for_approval_times_out(
-    client: AgentFieldClient, monkeypatch: pytest.MonkeyPatch
-):
-    import agentfield.client as client_module
-
+async def test_wait_for_approval_times_out(client: AgentFieldClient):
     client.get_approval_status = AsyncMock(return_value=ApprovalStatusResponse(status="pending"))
 
-    async def no_sleep(_: float) -> None:
-        return None
-
-    times = iter([0.0, 0.02, 0.06])
-    monkeypatch.setattr("agentfield.client.asyncio.sleep", no_sleep)
-    monkeypatch.setattr(client_module.time, "time", lambda: next(times))
-
     with pytest.raises(ExecutionTimeoutError, match="timed out"):
         await client.wait_for_approval(
             EXECUTION_ID,
```

**File**: `sdk/python/tests/test_approval_timeout.py` (added, +215/-0)
```diff
@@ -0,0 +1,215 @@
+"""Approval polling deadlines through the public client API."""
+
+import asyncio
+from unittest.mock import AsyncMock
+
+import httpx
+import pytest
+import respx
+
+from agentfield.client import AgentFieldClient
+from agentfield.exceptions import ExecutionTimeoutError
+
+
+@pytest.fixture
+def router():
+    return respx.MockRouter(assert_all_mocked=True)
+
+
+@pytest.fixture
+async def client(router, monkeypatch):
+    client = AgentFieldClient(base_url="https://control-plane.test")
+    client.caller_agent_id = "test-node"
+    async with httpx.AsyncClient(
+        transport=httpx.MockTransport(router.async_handler)
+    ) as http_client:
+        monkeypatch.setattr(
+            client, "get_async_http_client", AsyncMock(return_value=http_client)
+        )
+        yield client
+    await client.aclose()
+
+
+@pytest.mark.asyncio
+async def test_timeout_interrupts_initial_poll_delay(client, router):
+    route = router.get(
+        "https://control-plane.test/api/v1/agents/test-node/executions/exec-1/approval-status"
+    ).respond(200, json={"status": "approved"})
+
+    with pytest.raises(ExecutionTimeoutError, match="exec-1 timed out after 0.01s"):
+        await asyncio.wait_for(
+            client.wait_for_approval("exec-1", poll_interval=1, timeout=0.01),
+            timeout=0.5,
+        )
+
+    assert not route.called
+
+
+@pytest.mark.asyncio
+async def test_timeout_cancels_in_flight_status_request(client, router):
+    started = asyncio.Event()
+    cancelled = asyncio.Event()
+
+    async def slow_response(request):
+        started.set()
+        try:
+            await asyncio.Event().wait()
+        finally:
+            await asyncio.sleep(0)
+            cancelled.set()
+
+    router.get(
+        "https://control-plane.test/api/v1/agents/test-node/executions/exec-1/approval-status"
+    ).mock(side_effect=slow_response)
+
+    with pytest.raises(ExecutionTimeoutError, match="timed out"):
+        await asyncio.wait_for(
+            client.wait_for_approval("exec-1", poll_interval=0, timeout=0.05),
+            timeout=0.5,
+        )
+
+    assert started.is_set()
+    assert cancelled.is_set()
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("first_status", [200, 503])
+async def test_timeout_interrupts_pending_or_error_backoff(
+    client, router, first_status
+):
+    route = router.get(
+        "https://control-plane.test/api/v1/agents/test-node/executions/exec-1/approval-status"
+    ).mock(
+        side_effect=[
+            httpx.Response(first_status, json={"status": "pending"}),
+            httpx.Response(200, json={"status": "approved"}),
+        ]
+    )
+
+    with pytest.raises(ExecutionTimeoutError, match="timed out"):
+        await asyncio.wait_for(
+            client.wait_for_approval("exec-1", poll_interval=0.05, timeout=0.08),
+            timeout=0.5,
+        )
+
+    assert route.call_count <= 1
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("timeout", [0, -1])
+async def test_elapsed_deadline_does_not_poll(client, router, timeout):
+    route = router.get(
+        "https://control-plane.test/api/v1/agents/test-node/executions/exec-1/approval-status"
+    ).respond(200, json={"status": "approved"})
+
+    with pytest.raises(ExecutionTimeoutError, match="timed out"):
+        await client.wait_for_approval("exec-1", poll_interval=0, timeout=timeout)
+
+    assert not route.called
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("timeout", [None, 1])
+@pytest.mark.parametrize(
+    "status", ["approved", "rejected", "expired", "request_changes"]
+)
+async def test_resolved_status_before_deadline_is_unchanged(
+    client, router, timeout, status
+):
+    route = router.get(
+        "https://control-plane.test/api/v1/agents/test-node/executions/exec-1/approval-status"
+    ).respond(200, json={"status": status, "feedback": "human response"})
+
+    result = await asyncio.wait_for(
+        client.wait_for_approval("exec-1", poll_interval=0, timeout=timeout),
+        timeout=0.5,
+    )
+
+    assert result.status == status
+    assert result.feedback == "human response"
+    assert route.call_count == 1
+
+
+@pytest.mark.asyncio
+async def test_caller_cancellation_cleans_up_status_request(client, router):
+    started = asyncio.Event()
+    cancelled = asyncio.Event()
+
+    async def slow_response(request):
+        started.set()
+        try:
+            await asyncio.Event().wait()
+        finally:
+            cancelled.set()
+
+    router.get(
+        "https://control-plane.test/api/v1/agents/test-node/executions/exec-1/approval-status"
+    ).mock(side_effect=slow_response)
+    task = asyncio.create_task(
+        client.wait_for_approval("exec-1", poll_interval=0, timeout=10)
+    )
+    try:
+        await asyncio.wait_for(started.wait(), timeout=0.5)
+        task.cancel()
+        with pytest.raises(asyncio.CancelledError):
+            await task
+        assert cancelled.is_set()
+    finally:
+        ta
```

**File**: `sdk/python/tests/test_client_laser_push.py` (modified, +1/-6)
```diff
@@ -765,7 +765,6 @@ async def test_approval_helpers_and_wait_for_approval(client, monkeypatch):
     async def fake_sleep(_):
         return None
 
-    times = iter([0.0, 0.0, 1.0, 2.0, 3.0])
     responses = [
         AgentFieldClientError("transient"),
         SimpleNamespace(status="pending"),
@@ -779,17 +778,13 @@ async def fake_get_status(execution_id):
         return result
 
     monkeypatch.setattr(client_mod.asyncio, "sleep", fake_sleep)
-    monkeypatch.setattr(client_mod.time, "time", lambda: next(times))
     monkeypatch.setattr(client, "get_approval_status", fake_get_status)
 
     waited = await client.wait_for_approval("exec-2", poll_interval=0.1, max_interval=0.2, timeout=5.0)
     assert waited.status == "approved"
 
-    times_timeout = iter([0.0, 10.0])
-    monkeypatch.setattr(client_mod.time, "time", lambda: next(times_timeout))
-
     with pytest.raises(ExecutionTimeoutError, match="timed out"):
-        await client.wait_for_approval("exec-3", poll_interval=0.1, timeout=1.0)
+        await client.wait_for_approval("exec-3", poll_interval=0.1, timeout=0)
 
 
 @pytest.mark.asyncio
```

---

### Incident Patch 3: `fef65a5c` (2026-11-14)
**Commit Message**: fix(sdk/go): surface in-stream error events from StreamComplete (#1194)

An SSE data event of the form {"error":{...}} was unmarshalled into an
empty StreamChunk and yielded as a normal chunk, so the caller never saw
the provider failure. Return it as an error so it reaches errCh.

Co-authored-by: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

**File**: `sdk/go/ai/client.go` (modified, +30/-0)
```diff
@@ -404,6 +404,12 @@ func (d *SSEDecoder) Decode() (StreamChunk, error) {
 				if err := json.Unmarshal([]byte(jsonData), &chunk); err != nil {
 					continue // Skip malformed chunks
 				}
+				// Providers (e.g. OpenRouter) report mid-stream failures as a
+				// {"error":{...}} data event on an HTTP 200 stream. Surface it
+				// instead of yielding an empty chunk.
+				if streamErr := parseStreamError([]byte(jsonData)); streamErr != nil {
+					return StreamChunk{}, streamErr
+				}
 				chunk.normalizeNativeCost()
 
 				return chunk, nil
@@ -427,6 +433,30 @@ func (d *SSEDecoder) Decode() (StreamChunk, error) {
 	}
 }
 
+// parseStreamError returns an error when an SSE data payload is an in-stream
+// {"error":{...}} event, or nil for ordinary chunks.
+func parseStreamError(data []byte) error {
+	var probe struct {
+		Error *struct {
+			Message string          `json:"message"`
+			Type    string          `json:"type"`
+			Code    json.RawMessage `json:"code"`
+		} `json:"error"`
+	}
+	if err := json.Unmarshal(data, &probe); err != nil || probe.Error == nil {
+		return nil
+	}
+	msg := probe.Error.Message
+	if msg == "" {
+		msg = "unknown error"
+	}
+	code := strings.Trim(string(probe.Error.Code), `"`)
+	if code != "" && code != "null" {
+		return fmt.Errorf("stream error (code %s): %s", code, msg)
+	}
+	return fmt.Errorf("stream error: %s", msg)
+}
+
 // Convenience functions for common patterns
 
 // SimpleAI makes a simple AI call with just a prompt.
```

**File**: `sdk/go/ai/client_test.go` (modified, +41/-0)
```diff
@@ -799,3 +799,44 @@ func TestSSEDecoder_CRLFAndNoSpaceDataField(t *testing.T) {
 		})
 	}
 }
+
+func TestSSEDecoder_InStreamError(t *testing.T) {
+	input := "data: {\"id\":\"a\"}\n\n" +
+		"data: {\"error\":{\"message\":\"upstream overloaded\",\"code\":429}}\n\n" +
+		"data: [DONE]\n\n"
+	decoder := NewSSEDecoder(strings.NewReader(input))
+
+	if chunk, err := decoder.Decode(); err != nil || chunk.ID != "a" {
+		t.Fatalf("expected first chunk a, got %+v err=%v", chunk, err)
+	}
+	_, err := decoder.Decode()
+	if err == nil || err == io.EOF {
+		t.Fatalf("expected in-stream error, got %v", err)
+	}
+	if !strings.Contains(err.Error(), "upstream overloaded") {
+		t.Fatalf("error should carry provider message, got %q", err.Error())
+	}
+}
+
+func TestStreamComplete_InStreamErrorReachesErrCh(t *testing.T) {
+	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+		w.Header().Set("Content-Type", "text/event-stream")
+		fmt.Fprint(w, "data: {\"error\":{\"message\":\"boom\",\"type\":\"server_error\"}}\n\n")
+	}))
+	defer server.Close()
+
+	client, err := NewClient(&Config{APIKey: "k", BaseURL: server.URL, Model: "m"})
+	if err != nil {
+		t.Fatal(err)
+	}
+	chunks, errs := client.StreamComplete(context.Background(), "hi")
+	for range chunks {
+	}
+	var got error
+	for e := range errs {
+		got = e
+	}
+	if got == nil || !strings.Contains(got.Error(), "boom") {
+		t.Fatalf("expected stream error containing boom, got %v", got)
+	}
+}
```

#### Recent Merged Pull Requests:
- **PR #1198** (2026-11-14): fix(python): enforce total timeout while awaiting approval (@remote-controlled-man)
- **PR #1197** (2026-11-14): fix(go-sdk): parse data fields in SSE events (@remote-controlled-man)
- **PR #1194** (2026-11-14): fix(sdk/go): surface in-stream error events from StreamComplete (@pcbeingused333)
- **PR #1193** (2026-11-13): fix(sdk-typescript): omit temperature for models that reject it (@pcbeingused333)
- **PR #1192** (2026-11-13): fix(memory): honor legacy vector delete body scope (@remote-controlled-man)
- **PR #1189** (2026-11-13): fix(sdk-ts): keep memory scope ids with their own scope (@remote-controlled-man)

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

## X. python): finish harness cleanup before propagating cancellation

**RULE**:
When implementing operations in `sdk/python/agentfield/harness/_cli.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Agent-Field/agentfield. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `0145089a`: python): finish harness cleanup before propagating cancellation. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `sdk/python/agentfield/harness/_cli.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
    except (asyncio.TimeoutError, TimeoutError, asyncio.CancelledError):
        # Loop shutdown cancels the cleanup task too. Finish the same bounded
        # kill/poll fallback; run_cli still propagates the caller's cancellation.
        try:
            await asyncio.sleep(0.1)
        except asyncio.CancelledError:
            # Do not restart the polling budget when shutdown cancels again.
            pass

        async def cleanup() -> Optional[int]:
            if not completed:
                _kill_group()
            drain.cancel()
            try:
                await drain
            except BaseException:
                pass
            return await _wait_process_exit(proc, _kill_group)

        # Pipe EOF does not mean the child has exited. Keep ownership until
        # the bounded exit wait finishes, even if cancellation arrives here
        # or is repeated while cleanup is already running.
        cleanup_task = asyncio.create_task(cleanup())
        cleanup_cancelled: Optional[asyncio.CancelledError] = None
        while True:
            try:
                fallback_returncode = await asyncio.shield(cleanup_task)
                break
            except asy
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
    except (asyncio.TimeoutError, TimeoutError):
        await asyncio.sleep(0.1)
        if not completed:
            # Timeout, cancellation, or an internal error: stop the child so
            # nothing keeps running and the exit wait below can conclude.
            # (Previously only the timeout paths killed; a cancelled run_cli
            # left the child running and awaited its natural exit.)
            _kill_group()
        drain.cancel()
        try:
            await drain
        except BaseException:
            pass
        fallback_returncode = await _wait_process_exit(proc, _kill_group)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `0145089a` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
