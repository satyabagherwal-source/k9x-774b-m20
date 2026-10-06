# Forensic Learning Record (Deep Inspection): tw93/Mole

> **Canonical Artifact**: `07_PROJECT_LEARNING/tw93-mole-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/tw93/Mole](https://github.com/tw93/Mole))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:22:30.346Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tw93/Mole`
- **Description**: 🐹 Clean, uninstall, analyze, optimize, and monitor your Mac. Free open-source CLI, plus a native Mac app.
- **Primary Language / Ecosystem**: Shell
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 69372 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cmd/analyze/cache.go`
```
//go:build darwin

package main

import (
	"container/heap"
	"context"
	"encoding/gob"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/cespare/xxhash/v2"
)

// cacheSchemaVersion is bumped whenever directory-size semantics change so
// stale on-disk cache entries are rejected instead of silently reused.
// v2: analyze deduplicates hardlinked files to match `du`.
// v3: ordinary Parallels VM storage is included instead of skipped by name.
// v4: incomplete scans are no longer authoritative directory measurements.
// v5: entries record their scan state, so a partial result lost only to
// permission denials can be cached and still reads as partial.
// v6: deletions invalidate ancestor totals and overview measurements.
// v7: Library overview totals count cross-directory hardlinks once again.
const cacheSchemaVersion = 7

type overviewSizeSnapshot struct {
	Size          int64     `json:"size"`
	Partial       bool      `json:"partial,omitempty"`
	Updated       time.Time `json:"updated"`
	SchemaVersion int       `json:"schema_version"`
}

var (
	overviewSnapshotMu     sync.Mutex
	overviewSnapshotCache  map[string]overviewSizeSnapshot
	overviewSnapshotLoaded bool
)

func snapshotFromModel(m model) historyEntry {
	return historyEntry{
		Path:          m.path,
		State:         m.scanState,
		Entries:       slices.Clone(m.entries),
		LargeFiles:    slices.Clone(m.largeFiles),
		TotalSize:     m.totalSize,
		TotalFiles:    m.totalFiles,
		Selected:      m.selected,
		EntryOffset:   m.offset,
		LargeSelected: m.largeSelected,
		LargeOffset:   m.largeOffset,
		NeedsRefresh:  m.viewNeedsRefresh || m.scanning || (m.scanState != scanComplete && m.scanTransient),
		IsOverview:    m.isOverview,
	}
}

func filterNonEmptyEntries(entries []dirEntry) []dirEntry {
	filtered := make([]dirEntry, 0, len(entries))
	for _, entry := range entries {
		if entry.Size > 0 || entry.State != scanComplete {
			filtered = append(filtered, entry)
		}
	}
	return filtered
}

func historyEntryFromScanResult(path string, result scanResult, previous historyEntry, needsRefresh bool) historyEntry {
	entry := historyEntry{
		Path:          path,
		State:         result.State,
		Entries:       slices.Clone(result.Entries),
		LargeFiles:    slices.Clone(result.LargeFiles),
		TotalSize:     result.TotalSize,
		TotalFiles:    result.TotalFiles,
		Selected:      previous.Selected,
		EntryOffset:   previous.EntryOffset,
		LargeSelected: previous.LargeSelected,
		LargeOffset:   previous.LargeOffset,
		NeedsRefresh:  needsRefresh || !result.persistable(),
		IsOverview:    previous.IsOverview,
	}
	return entry
}

func ensureOverviewSnapshotCacheLocked() error {
	if overviewSnapshotLoaded {
		return nil
	}
	storePath, err := getOverviewSizeStorePath()
	if err != nil {
		return err
	}
	data, err := os.ReadFile(storePath)
	if err != nil {
		if os.IsNotExist(err) {
			overviewSnapshotCache = make(map[string]overviewSizeSnapshot)
			overviewSnapshotLoaded = true
			return nil
		}
		return err
	}
	if len(data) == 0 {
		overviewSnapshotCache = make(map[string]overviewSizeSnapshot)
		overviewSnapshotLoaded = true
		return nil
	}
	var snapshots map[string]overviewSizeSnapshot
	if err := json.Unmarshal(data, &snapshots); err != nil || snapshots == nil {
		backupPath := storePath + ".corrupt"
		_ = os.Rename(storePath, backupPath)
		overviewSnapshotCache = make(map[string]overviewSizeSnapshot)
		overviewSnapshotLoaded = true
		return nil
	}
	// Drop what the loader would refuse anyway. Snapshots were only ever added,
	// so without this every directory ever browsed stayed in the file forever,
	// and each save re-serialized all of them.
	now := time.Now()
	for path, snapshot := range snapshots {
		if snapshot.SchemaVersion != cacheSchemaVersion || snapshot.Size <= 0 || now.Sub(snapshot.Updated) >= overviewCacheTTL {
			delete(snapshots, path)
		}
	}
	overviewSnapshotCache = snapshots
	overviewSnapshotLoaded = true
	return nil
}

func getOverviewSizeStorePath() (string, error) {
	cacheDir, err := getCacheDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(cacheDir, overviewCacheFile), nil
}

func loadStoredOverviewSize(path string) (int64, error) {
	size, _, err := loadStoredOverviewMeasurement(path)
	return size, err
}

func loadStoredOverviewMeasurement(path string) (int64, scanState, error) {
	if path == "" {
		return 0, scanComplete, fmt.Errorf("empty path")
	}
	overviewSnapshotMu.Lock()
	defer overviewSnapshotMu.Unlock()
	if err := ensureOverviewSnapshotCacheLocked(); err != nil {
		return 0, scanComplete, err
	}
	if overviewSnapshotCache == nil {
		return 0, scanComplete, fmt.Errorf("snapshot cache unavailable")
	}
	if snapshot, ok := overviewSnapshotCache[path]; ok && snapshot.Size > 0 {
		if time.Since(snapshot.Updated) < overviewCacheTTL {
			if snapshot.Partial {
				return snapshot.Size, scanPartial, nil
			}
			return snapshot.Size, scanComplete, nil
		}
		return 0, scanComplete, fmt.Errorf("snapshot expired")
	}
	return 0, scanComplete, fmt.Errorf("snapshot not found")
}

func storeOverviewSize(path string, size int64) error {
	return storeOverviewMeasurement(path, size, false)
}

// storeOverviewMeasurement records a size; partial marks one that is missing
// only folders the terminal is not allowed to read.
func storeOverviewMeasurement(path string, size int64, partial bool) error {
	if path == "" || size <= 0 {
		return fmt.Errorf("invalid overview size")
	}
	overviewSnapshotMu.Lock()
	defer overviewSnapshotMu.Unlock()
	if err := ensureOverviewSnapshotCacheLocked(); err != nil {
		return err
	}
	if overviewSnapshotCache == nil {
		overviewSnapshotCache = make(map[string]overviewSizeSnapshot)
	}
	// Re-measuring a directory usually returns the size already on record, and
	// every save re-serializes and rewrites the entire store. Skip the write
	// while the recorded value still stands; the timestamp is only refreshed
	// often enough to keep a live entry from aging out.
	if existing, ok := overviewSnapshotCache[path]; ok && existing.Size == size && existing.Partial == partial &&
		time.Since(existing.Updated) < overviewCacheTTL/overviewRefreshDivisor {
		return nil
	}
	overviewSnapshotCache[path] = overviewSizeSnapshot{
		Size:          size,
		Partial:       partial,
		Updated:       time.Now(),
		SchemaVersion: cacheSchemaVersion,
	}
	evictOverviewSnapshotsLocked()
	return persistOverviewSnapshotLocked()
}

// evictOverviewSnapshotsLocked keeps the store bounded by dropping the oldest
// snapshots once it outgrows the cap, in one pass down to the low-water mark so
// eviction does not run on every subsequent save.
func evictOverviewSnapshotsLocked() {
	if len(overviewSnapshotCache) <= overviewCacheMaxEntries ||
		overviewCacheKeepEntries >= len(overviewSnapshotCache) {
		return
	}
	type agedSnapshot struct {
		path    string
		updated time.Time
	}
	aged := make([]agedSnapshot, 0, len(overviewSnapshotCache))
	for path, snapshot := range overviewSnapshotCache {
		aged = append(aged, agedSnapshot{path: path, updated: snapshot.Updated})
	}
	slices.SortFunc(aged, func(a, b agedSnapshot) int { return a.updated.Compare(b.updated) })
	for _, entry := range aged[:len(aged)-overviewCacheKeepEntries] {
		delete(overviewSnapshotCache, entry.path)
	}
}

func persistOverviewSnapshotLocked() error {
	storePath, err := getOverviewSizeStorePath()
	if err != nil {
		return err
	}
	// No indentation: nothing reads this by eye, and the padding was a third of
	// a file rewritten on every save.
	data, err := json.Marshal(overviewSnapshotCache)
	if err != nil {
		return err
	}
	// A uniquely named temp file, so two analyzers running at once cannot land
	// in each other's half-written store.
	tmp, err := os.CreateTemp(filepath.Dir(storePath), overviewCacheFile+".*.tmp")
	if err != nil {
		return err
	}
	tmpPath := tmp.Name()
	// Chmod through the handle, not the path: CreateTemp opens at 0600 and the
	// store has always been world-readable.
	if err := tmp.Chmod(0644); err != nil {
		tmp.Close() //nolint:errcheck
		_ = os.Remove(tmpPath)
		return err
	}
	if _, err := tmp.Write(data); err != nil {
		tmp.Close() //nolint:errcheck
		_ = os.Remove(tmpPath)
		return err
	}
	if err := tmp.Close(); err != nil {
		_ = os.Remove(tmpPath)
		return err
	}
	if err := os.Rename(tmpPath, storePath); err != nil {
		_ = os.Remove(tmpPath)
		return err
	}
	return nil
}

func loadOverviewCachedMeasurement(path string) (int64, scanState, error) {
	if path == "" {
		return 0, scanComplete, fmt.Errorf("empty path")
	}
	if snapshot, state, err := loadStoredOverviewMeasurement(path); err == nil {
		return snapshot, state, nil
	}
	cacheEntry, err := loadCacheFromDisk(path)
	if err != nil {
		return 0, scanComplete, err
	}
	_ = storeOverviewMeasurement(path, cacheEntry.TotalSize, cacheEntry.State != scanComplete)
	return cacheEntry.TotalSize, cacheEntry.State, nil
}

// moleCacheRoot is the single definition of the shared cache location; both
// accessors below build on it so the layout is stated once.
func moleCacheRoot(home string) string {
	return filepath.Join(home, ".cache", "mole")
}

// getMoleCacheRoot is the shared `~/.cache/mole` directory. The shell side
// keeps its own state files there, so nothing may be swept from it wholesale.
func getMoleCacheRoot() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return moleCacheRoot(home), nil
}

// resolvedCacheDir memoizes the analyzer cache directory together with the HOME
// it was derived from, so a test that repoints HOME still gets a fresh answer.
type resolvedCacheDir struct {
	home string
	dir  string
	err  error
}

var cachedAnalyzerDir atomic.Pointer[resolvedCacheDir]

// getCacheDir is the analyzer-owned subdirectory. Keeping analyzer entries out
// of the shared root is what lets the legacy sweep and the entry caps operate
// on a directory whose every file the analyzer owns.
//
// The MkdirAll r
```

### Core Architecture Module: `cmd/analyze/cleanable.go`
```
//go:build darwin

package main

import (
	"io"
	"os"
	"path/filepath"
	"strings"
)

const (
	cacheDirTagFileName  = "CACHEDIR.TAG"
	cacheDirTagSignature = "Signature: 8a477f597d28d172789f06886806bc55"
)

// isCleanableDir marks paths safe to delete manually (not handled by mo clean).
func isCleanableDir(path string) bool {
	if path == "" {
		return false
	}

	// Exclude paths mo clean already handles.
	if isHandledByMoClean(path) {
		return false
	}

	baseName := filepath.Base(path)

	// CACHEDIR.TAG marks the whole directory tree as regenerable cache.
	if hasValidCacheDirTag(path) {
		return true
	}

	// Project dependencies and build outputs are safe.
	if projectDependencyDirs[baseName] {
		return true
	}

	return false
}

func hasValidCacheDirTag(path string) bool {
	tagPath := filepath.Join(path, cacheDirTagFileName)
	info, err := os.Lstat(tagPath)
	if err != nil || !info.Mode().IsRegular() {
		return false
	}

	file, err := os.Open(tagPath)
	if err != nil {
		return false
	}
	defer func() {
		_ = file.Close()
	}()

	buf := make([]byte, len(cacheDirTagSignature))
	if _, err := io.ReadFull(file, buf); err != nil {
		return false
	}

	return string(buf) == cacheDirTagSignature
}

// isHandledByMoClean checks if a path is cleaned by mo clean.
func isHandledByMoClean(path string) bool {
	for _, fragment := range moCleanHandledPathFragments {
		if strings.Contains(path, fragment) {
			return true
		}
	}

	return false
}

var moCleanHandledPathFragments = []string{
	"/Library/Caches/",
	"/Library/Logs/",
	"/Library/Saved Application State/",
	"/.Trash/",
	"/Library/DiagnosticReports/",
}

// Project dependency and build directories.
var projectDependencyDirs = map[string]bool{
	// JavaScript/Node.
	"node_modules":     true,
	"bower_components": true,
	".yarn":            true,
	".pnpm-store":      true,

	// Python.
	"venv":               true,
	".venv":              true,
	"virtualenv":         true,
	"__pycache__":        true,
	".pytest_cache":      true,
	".mypy_cache":        true,
	".ruff_cache":        true,
	".tox":               true,
	".eggs":              true,
	"htmlcov":            true,
	".ipynb_checkpoints": true,

	// Ruby.
	"vendor":  true,
	".bundle": true,

	// Java/Kotlin/Scala.
	".gradle": true,
	"out":     true,

	// Build outputs.
	"build":         true,
	"dist":          true,
	"target":        true,
	".next":         true,
	".nuxt":         true,
	".output":       true,
	".parcel-cache": true,
	".turbo":        true,
	".vite":         true,
	".nx":           true,
	"coverage":      true,
	".coverage":     true,
	".nyc_output":   true,

	// Frontend framework outputs.
	".angular":    true,
	".svelte-kit": true,
	".astro":      true,
	".docusaurus": true,

	// Apple dev.
	"DerivedData": true,
	"Pods":        true,
	".build":      true,
	"Carthage":    true,
	".dart_tool":  true,

	// Other tools.
	".terraform": true,
}

```

### Core Architecture Module: `cmd/analyze/constants.go`
```
//go:build darwin

package main

import "time"

const (
	maxEntries    = 30
	maxLargeFiles = 20
	barWidth      = 24
	// Below this many columns a scanned path is too clipped to tell anything
	// apart, so it moves to its own row instead of sharing the status line.
	scanPathInlineMinWidth = 24
	spotlightMinFileSize   = 100 << 20
	largeFileWarmupMinSize = 1 << 20
	defaultViewport        = 12
	analyzerCacheTTL       = 7 * 24 * time.Hour
	overviewCacheTTL       = 7 * 24 * time.Hour
	overviewCacheFile      = "overview_sizes.json"
	duTimeout              = 30 * time.Second
	mdlsTimeout            = 5 * time.Second
	maxConcurrentOverview  = 8
	batchUpdateSize        = 100
	cacheModTimeGrace      = 30 * time.Minute
	staleCacheTTL          = 3 * 24 * time.Hour

	// Analyzer cache admission and eviction budget. A subtree is only worth a
	// cache file when rescanning it is actually expensive: on a dev machine's
	// 157k-entry cache the MEDIAN entry described a directory holding one file
	// and 98% held fewer than 100, so nearly every file spent a 4KB APFS block
	// plus an inode memoizing what a single readdir returns. Unbounded and
	// admission-free, that reached 1.88M files / 7.82GB for one user. The
	// thresholds keep the ~1.5% of entries that carry the reuse value; the
	// count/byte caps are the backstop for trees that clear them anyway.
	analyzerCacheDirName    = "analyzer"
	subdirCacheMinFiles     = 100
	subdirCacheMinSize      = 10 << 20
	analyzerCacheMaxEntries = 5000
	analyzerCacheMaxBytes   = 50 << 20
	cacheDirReadBatch       = 512
	legacySweepWorkers      = 4
	staleTempFileTTL        = time.Hour

	// Overview snapshot store budget. The store is one JSON file rewritten in
	// full on every save, so both its length and its save rate have to be held
	// down: the cap bounds the file, and the refresh divisor turns repeat
	// measurements of an unchanged directory into no-ops until the entry is
	// within 1/8 of the TTL of aging out.
	overviewCacheMaxEntries  = 1000
	overviewCacheKeepEntries = 900
	overviewRefreshDivisor   = 8

	// Worker pool limits. Deliberately conservative: the User Library scan
	// blocks many goroutines in syscalls on high-fan-out trees (Steam
	// workshop/temp, browser caches), and each blocked goroutine holds an
	// OS thread. Exceeding the per-user thread limit on macOS produces a
	// fatal "runtime: failed to create new OS thread" with no recovery.
	// Further reduced after #765: System Library (184GB, 261k files) with
	// deep permission checks can still exhaust threads at previous limits.
	minWorkers         = 2
	maxWorkers         = 12
	cpuMultiplier      = 1
	openCommandTimeout = 10 * time.Second
	scanSendTimeout    = 100 * time.Millisecond
	uiTickInterval     = 100 * time.Millisecond
)

var overviewDuIgnoreNames = map[string]bool{
	// iCloud Drive's FileProvider tree can block `du` for tens of seconds even
	// when most entries are cloud placeholders. Keep the overview responsive;
	// users can still drill into the folder explicitly when they need it.
	"Mobile Documents": true,
}

var foldDirs = map[string]bool{
	// VCS.
	".git": true,
	".svn": true,
	".hg":  true,

	// JavaScript/Node.
	"node_modules":                  true,
	".npm":                          true,
	"_npx":                          true,
	"_cacache":                      true,
	"_logs":                         true,
	"_locks":                        true,
	"_quick":                        true,
	"_libvips":                      true,
	"_prebuilds":                    true,
	"_update-notifier-last-checked": true,
	".yarn":                         true,
	".pnpm-store":                   true,
	".next":                         true,
	".nuxt":                         true,
	"bower_components":              true,
	".vite":                         true,
	".turbo":                        true,
	".parcel-cache":                 true,
	".nx":                           true,
	".rush":                         true,
	"tnpm":                          true,
	".tnpm":                         true,
	".bun":                          true,
	".deno":                         true,

	// Python.
	"__pycache__":   true,
	".pytest_cache": true,
	".mypy_cache":   true,
	".ruff_cache":   true,
	"venv":          true,
	".venv":         true,
	"virtualenv":    true,
	".tox":          true,
	"site-packages": true,
	".eggs":         true,
	"*.egg-info":    true,
	".pyenv":        true,
	".poetry":       true,
	".pip":          true,
	".pipx":         true,

	// Ruby/Go/PHP (vendor), Java/Kotlin/Scala/Rust (target).
	"vendor":        true,
	".bundle":       true,
	"gems":          true,
	".rbenv":        true,
	"target":        true,
	".gradle":       true,
	".m2":           true,
	".ivy2":         true,
	"out":           true,
	"pkg":           true,
	"composer.phar": true,
	".composer":     true,
	".cargo":        true,

	// Build outputs.
	"build":     true,
	"dist":      true,
	".output":   true,
	"coverage":  true,
	".coverage": true,

	// IDE.
	".idea":   true,
	".vscode": true,
	".vs":     true,
	".fleet":  true,

	// Cache directories.
	".cache":                  true,
	"__MACOSX":                true,
	".DS_Store":               true,
	".Trash":                  true,
	"Caches":                  true,
	".Spotlight-V100":         true,
	".fseventsd":              true,
	".DocumentRevisions-V100": true,
	".TemporaryItems":         true,
	"$RECYCLE.BIN":            true,
	".temp":                   true,
	".tmp":                    true,
	"_temp":                   true,
	"_tmp":                    true,
	".Homebrew":               true,
	".rustup":                 true,
	".sdkman":                 true,
	".nvm":                    true,

	// macOS.
	"Application Scripts":     true,
	"Saved Application State": true,

	// iCloud.
	"Mobile Documents": true,

	// Containers.
	".docker":     true,
	".containerd": true,

	// Mobile development.
	"Pods":        true,
	"DerivedData": true,
	".build":      true,
	"xcuserdata":  true,
	"Carthage":    true,
	".dart_tool":  true,

	// Web frameworks.
	".angular":    true,
	".svelte-kit": true,
	".astro":      true,
	".solid":      true,

	// Databases.
	".mysql":    true,
	".postgres": true,
	"mongodb":   true,

	// Other.
	".terraform": true,
	".vagrant":   true,
	"tmp":        true,
	"temp":       true,
}

var skipSystemDirs = map[string]bool{
	"dev":                     true,
	"tmp":                     true,
	"private":                 true,
	"cores":                   true,
	"net":                     true,
	"home":                    true,
	"System":                  true,
	"sbin":                    true,
	"bin":                     true,
	"etc":                     true,
	"var":                     true,
	"opt":                     false,
	"usr":                     false,
	"Volumes":                 true,
	"Network":                 true,
	".vol":                    true,
	".Spotlight-V100":         true,
	".fseventsd":              true,
	".DocumentRevisions-V100": true,
	".TemporaryItems":         true,
	".MobileBackups":          true,
}

var defaultSkipDirs = map[string]bool{
	"nfs":         true,
	"PHD":         true,
	"Permissions": true,

	// Virtualization/Container mounts (NFS, network filesystems).
	"OrbStack":        true, // OrbStack NFS mounts
	"Colima":          true, // Colima VM mounts
	"VMware Fusion":   true, // VMware Fusion VMs
	"VirtualBox VMs":  true, // VirtualBox VMs
	"Rancher Desktop": true, // Rancher Desktop mounts
	".lima":           true, // Lima VM mounts
	".colima":         true, // Colima config/mounts
	".orbstack":       true, // OrbStack config/mounts
}

var skipExtensions = map[string]bool{
	".go":     true,
	".js":     true,
	".ts":     true,
	".tsx":    true,
	".jsx":    true,
	".json":   true,
	".md":     true,
	".txt":    true,
	".yml":    true,
	".yaml":   true,
	".xml":    true,
	".html":   true,
	".css":    true,
	".scss":   true,
	".sass":   true,
	".less":   true,
	".py":     true,
	".rb":     true,
	".java":   true,
	".kt":     true,
	".rs":     true,
	".swift":  true,
	".m":      true,
	".mm":     true,
	".c":      true,
	".cpp":    true,
	".h":      true,
	".hpp":    true,
	".cs":     true,
	".sql":    true,
	".db":     true,
	".lock":   true,
	".gradle": true,
	".mjs":    true,
	".cjs":    true,
	".coffee": true,
	".dart":   true,
	".svelte": true,
	".vue":    true,
	".nim":    true,
	".hx":     true,
}

// Match the shell spinner's centered 2x2 shape in lib/core/ui.sh.
var spinnerFrames = []string{"⠖", "⠲", "⠴", "⠦"}

const (
	colorPurple     = "\033[0;35m"
	colorPurpleBold = "\033[1;35m"
	colorGray       = "\033[0;38;5;244m"
	colorRed        = "\033[0;31m"
	colorYellow     = "\033[0;33m"
	colorGreen      = "\033[0;32m"
	colorBlue       = "\033[0;34m"
	colorCyan       = "\033[0;36m"
	colorReset      = "\033[0m"
	colorBold       = "\033[1m"
)

```

### Core Architecture Module: `cmd/analyze/delete.go`
```
//go:build darwin

package main

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"os/user"
	"path/filepath"
	"slices"
	"sort"
	"strings"
	"sync/atomic"
	"syscall"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"golang.org/x/sys/unix"
)

const trashTimeout = 30 * time.Second

// trashBinary is Apple's own trash(8). It moves paths to the user Trash without
// involving Finder, which is what makes deletion work over SSH: the Finder
// AppleScript path raises a dialog on the physical machine that a remote user
// cannot answer, so the delete only ever times out (discussion #474).
//
// Invoked by absolute path rather than a PATH lookup so a "trash" shadowed
// earlier in the user's PATH can never receive a delete request. Arguments are
// always absolute paths, so no "--" separator is needed; passing one would make
// trash(8) report a missing file named "--" and exit non-zero even though it
// still trashed the real target, which would trigger a duplicate delete via the
// Finder fallback.
const trashBinary = "/usr/bin/trash"

func deletePathCmd(path string, counter *int64) tea.Cmd {
	return func() tea.Msg {
		count, err := trashPathWithProgress(path, counter)
		return deleteProgressMsg{
			done:  true,
			err:   err,
			count: count,
			path:  path,
		}
	}
}

// deleteMultiplePathsCmd moves paths to Trash and aggregates results.
func deleteMultiplePathsCmd(paths []string, counter *int64) tea.Cmd {
	return func() tea.Msg {
		var totalCount int64
		var errors []string
		var removedPaths []string

		// Process deeper paths first to avoid parent/child conflicts.
		pathsToDelete := append([]string(nil), paths...)
		sort.Slice(pathsToDelete, func(i, j int) bool {
			return strings.Count(pathsToDelete[i], string(filepath.Separator)) > strings.Count(pathsToDelete[j], string(filepath.Separator))
		})

		for _, path := range pathsToDelete {
			count, err := trashPathWithProgress(path, counter)
			totalCount += count
			if err != nil {
				if os.IsNotExist(err) {
					removedPaths = append(removedPaths, path)
					continue
				}
				errors = append(errors, err.Error())
				continue
			}
			removedPaths = append(removedPaths, path)
		}

		var resultErr error
		if len(errors) > 0 {
			resultErr = &multiDeleteError{errors: errors}
		}

		return deleteProgressMsg{
			done:         true,
			err:          resultErr,
			count:        totalCount,
			path:         "",
			removedPaths: removedPaths,
		}
	}
}

// multiDeleteError holds multiple deletion errors.
type multiDeleteError struct {
	errors []string
}

func (e *multiDeleteError) Error() string {
	if len(e.errors) == 1 {
		return e.errors[0]
	}
	return strings.Join(e.errors[:min(3, len(e.errors))], "; ")
}

// trashPathWithProgress moves one selected path to Trash and reports completion.
func trashPathWithProgress(root string, counter *int64) (int64, error) {
	// Verify path exists (use Lstat to handle broken symlinks).
	_, err := os.Lstat(root)
	if err != nil {
		return 0, err
	}

	// Trash moves one selected path as a unit. Recursively counting every file
	// first made large directory deletes appear hung before the move began.
	const count int64 = 1

	// Move through a headless Trash route, with Finder as the last compatibility fallback.
	if err := moveToTrash(root); err != nil {
		return 0, err
	}
	if counter != nil {
		atomic.AddInt64(counter, count)
	}

	return count, nil
}

// moveToTrash moves a file/directory to the user Trash. macOS 15+ ships
// trash(8); older supported systems use an atomic, no-overwrite move into the
// correct per-volume Trash. Finder is only the final compatibility fallback.
func moveToTrash(path string) error {
	// Validate raw input before Abs resolves ".." components away.
	if err := validateTrashTarget(path); err != nil {
		return err
	}

	absPath, err := filepath.Abs(path)
	if err != nil {
		return fmt.Errorf("failed to resolve path: %w", err)
	}

	// Validate resolved path as well (defense-in-depth).
	if err := validateTrashTarget(absPath); err != nil {
		return err
	}

	if trashErr := moveToTrashViaBinary(absPath); trashErr == nil {
		return nil
	}
	if filesystemErr := moveToTrashViaFilesystem(absPath); filesystemErr == nil {
		return nil
	}

	return moveToTrashViaFinder(absPath)
}

// moveToTrashViaBinary moves absPath to Trash using trash(8). Returns an error
// when the binary is missing so callers fall back to Finder.
func moveToTrashViaBinary(absPath string) error {
	if _, err := os.Stat(trashBinary); err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(context.Background(), trashTimeout)
	defer cancel()

	cmd := exec.CommandContext(ctx, trashBinary, absPath)
	output, err := cmd.CombinedOutput()
	if err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			return fmt.Errorf("timeout moving to Trash")
		}
		return fmt.Errorf("failed to move to Trash: %s", strings.TrimSpace(string(output)))
	}

	return nil
}

// moveToTrashViaFilesystem provides a headless path for macOS versions before
// trash(8). It uses renameatx_np(RENAME_EXCL), so a concurrent name collision
// can never overwrite an existing Trash item.
func moveToTrashViaFilesystem(absPath string) error {
	trashDir, err := trashDirectoryForPath(absPath)
	if err != nil {
		return err
	}

	base := filepath.Base(absPath)
	if base == "." || base == string(filepath.Separator) || base == "" {
		return fmt.Errorf("invalid Trash item name")
	}

	stamp := time.Now().UnixNano()
	for attempt := range 100 {
		name := base
		if attempt > 0 {
			name = fmt.Sprintf("%s.%d.%d.%d", base, stamp, os.Getpid(), attempt)
		}
		dest := filepath.Join(trashDir, name)
		err = unix.RenameatxNp(unix.AT_FDCWD, absPath, unix.AT_FDCWD, dest, unix.RENAME_EXCL)
		if err == nil {
			return nil
		}
		if err != syscall.EEXIST {
			return fmt.Errorf("failed to move to Trash: %w", err)
		}
	}

	return fmt.Errorf("failed to choose unique Trash destination for %s", absPath)
}

func trashDirectoryForPath(absPath string) (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("failed to resolve home directory: %w", err)
	}

	var pathFS, homeFS unix.Statfs_t
	if err := unix.Statfs(absPath, &pathFS); err != nil {
		return "", fmt.Errorf("failed to inspect target volume: %w", err)
	}
	if err := unix.Statfs(home, &homeFS); err != nil {
		return "", fmt.Errorf("failed to inspect home volume: %w", err)
	}

	if pathFS.Fsid == homeFS.Fsid {
		trashDir := filepath.Join(home, ".Trash")
		if err := ensureOwnedTrashDirectory(trashDir, true); err != nil {
			return "", err
		}
		return trashDir, nil
	}

	mountPoint := strings.TrimRight(string(pathFS.Mntonname[:]), "\x00")
	if mountPoint == "" {
		return "", fmt.Errorf("target volume has no mount point")
	}
	trashRoot := filepath.Join(mountPoint, ".Trashes")
	rootInfo, err := os.Lstat(trashRoot)
	if err != nil {
		return "", fmt.Errorf("volume Trash is unavailable: %w", err)
	}
	if rootInfo.Mode()&os.ModeSymlink != 0 || !rootInfo.IsDir() {
		return "", fmt.Errorf("volume Trash is not a normal directory")
	}

	trashDir := filepath.Join(trashRoot, fmt.Sprintf("%d", os.Getuid()))
	if err := ensureOwnedTrashDirectory(trashDir, true); err != nil {
		return "", err
	}
	return trashDir, nil
}

func ensureOwnedTrashDirectory(path string, create bool) error {
	info, err := os.Lstat(path)
	if os.IsNotExist(err) && create {
		if err := os.Mkdir(path, 0o700); err != nil {
			return fmt.Errorf("failed to create Trash directory: %w", err)
		}
		info, err = os.Lstat(path)
	}
	if err != nil {
		return fmt.Errorf("failed to inspect Trash directory: %w", err)
	}
	if info.Mode()&os.ModeSymlink != 0 || !info.IsDir() {
		return fmt.Errorf("trash path is not a normal directory")
	}

	stat, ok := info.Sys().(*syscall.Stat_t)
	if !ok || stat.Uid != uint32(os.Getuid()) {
		return fmt.Errorf("trash directory is not owned by the current user")
	}
	if info.Mode().Perm()&0o022 != 0 {
		return fmt.Errorf("trash directory is writable by another user")
	}
	return nil
}

// moveToTrashViaFinder remains as a last fallback for unusual volume layouts.
func moveToTrashViaFinder(absPath string) error {
	// Escape path for AppleScript (handle quotes and backslashes).
	escapedPath := strings.ReplaceAll(absPath, "\\", "\\\\")
	escapedPath = strings.ReplaceAll(escapedPath, "\"", "\\\"")

	script := fmt.Sprintf(`tell application "Finder" to delete POSIX file "%s"`, escapedPath)

	ctx, cancel := context.WithTimeout(context.Background(), trashTimeout)
	defer cancel()

	cmd := exec.CommandContext(ctx, "osascript", "-e", script)
	output, err := cmd.CombinedOutput()
	if err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			return fmt.Errorf("timeout moving to Trash")
		}
		return fmt.Errorf("failed to move to Trash: %s", strings.TrimSpace(string(output)))
	}

	return nil
}

func validateTrashTarget(path string) error {
	if err := validatePath(path); err != nil {
		return err
	}
	if isProtectedAnalyzeDeletePath(path) {
		return fmt.Errorf("protected path cannot be deleted: %s", path)
	}
	if resolvedPath, err := filepath.EvalSymlinks(path); err == nil && isProtectedAnalyzeDeletePath(resolvedPath) {
		return fmt.Errorf("protected path cannot be deleted: %s", path)
	}
	return nil
}

func isProtectedAnalyzeDeletePath(path string) bool {
	if path == "" {
		return false
	}

	cleanPath := filepath.Clean(path)

	// EDR / Darwin-cache protection is based on the absolute path and does not
	// depend on HOME, so check it first: an unset HOME must not let a Falcon
	// cache slip through (e.g. `env -u HOME mo analyze`).
	if isEndpointSecurityCachePath(cleanPath) {
		return true
	}
	if isCriticalAnalyzeDeletePath(cleanPath) {
		return true
	}

	homeRoots := protectedAnalyzeHomeRoots()
	if len(homeRoots) == 0 {
		return false
	}

	for _, homeRoot := range homeRoots {
		if cleanPath == homeRoot || isSameExistingPath(cleanPath, homeRoot) {
			return true
		}

		dockerDesktopState := filepath.Join(homeRoot, "Library", "Containers", "com.docker.docker")
		if cleanPath == dockerDesktopState
```

### Core Architecture Module: `cmd/analyze/format.go`
```
//go:build darwin

package main

import (
	"context"
	"errors"
	"fmt"
	"math"
	"os"
	"slices"
	"strings"
	"time"

	"github.com/tw93/mole/internal/units"
)

// Left-aligned block elements filling 1/8 through 7/8 of a cell, indexed by
// eighths. Index 0 is unused: no eighths means nothing to draw.
var subCellBlocks = [8]string{"", "▏", "▎", "▍", "▌", "▋", "▊", "▉"}

func displayPath(path string) string {
	home, err := os.UserHomeDir()
	if err != nil || home == "" {
		return path
	}
	if strings.HasPrefix(path, home) {
		return strings.Replace(path, home, "~", 1)
	}
	return path
}

// truncateMiddle trims the middle, keeping head and tail.
func truncateMiddle(s string, maxWidth int) string {
	runes := []rune(s)
	currentWidth := displayWidth(s)

	if currentWidth <= maxWidth {
		return s
	}

	if maxWidth < 10 {
		width := 0
		for i, r := range runes {
			width += runeWidth(r)
			if width > maxWidth {
				return string(runes[:i])
			}
		}
		return s
	}

	targetHeadWidth := (maxWidth - 3) / 3
	targetTailWidth := maxWidth - 3 - targetHeadWidth

	headWidth := 0
	headIdx := 0
	for i, r := range runes {
		w := runeWidth(r)
		if headWidth+w > targetHeadWidth {
			break
		}
		headWidth += w
		headIdx = i + 1
	}

	tailWidth := 0
	tailIdx := len(runes)
	for i, r := range slices.Backward(runes) {
		w := runeWidth(r)
		if tailWidth+w > targetTailWidth {
			break
		}
		tailWidth += w
		tailIdx = i
	}

	return string(runes[:headIdx]) + "..." + string(runes[tailIdx:])
}

func formatNumber(n int64) string {
	if n < 1000 {
		return fmt.Sprintf("%d", n)
	}
	if n < 1000000 {
		return fmt.Sprintf("%.1fk", float64(n)/1000)
	}
	return fmt.Sprintf("%.1fM", float64(n)/1000000)
}

func humanizeBytes(size int64) string {
	return units.BytesSI(size)
}

func formatPercent(percent float64, known bool) string {
	const width = 6
	if !known {
		return "  --  "
	}

	label := fmt.Sprintf("%.1f%%", percent)
	if percent > 0 && percent < 0.1 {
		label = "< 0.1%"
	}
	return fmt.Sprintf("%*s", width, label)
}

func coloredProgressBar(value, maxValue int64, percent float64) string {
	if value <= 0 || maxValue <= 0 {
		return strings.Repeat(" ", barWidth)
	}

	var barColor string
	if percent >= 50 {
		barColor = colorRed
	} else if percent >= 20 {
		barColor = colorYellow
	} else if percent >= 5 {
		barColor = colorBlue
	} else {
		barColor = colorGreen
	}

	// Length is measured in eighths of a cell throughout, so one ruler covers
	// the whole range. Mixing shaded blocks for the remainder with width blocks
	// below one cell made a 2.3% row look lighter than a 1.3% one, because the
	// two glyph families encode magnitude differently.
	//
	// The ratio is taken in float64 rather than scaling the byte count first:
	// value * barWidth * 8 overflows int64 at 42.7 PB and wraps negative, which
	// reaches strings.Repeat with a negative count and panics. float64 carries
	// far more precision than 192 distinct lengths need.
	eighths := max(int64(math.Round(float64(value)/float64(maxValue)*float64(barWidth)*8)), 0)
	full := int(eighths / 8)
	remainder := int(eighths % 8)
	if full >= barWidth {
		return barColor + strings.Repeat("█", barWidth) + colorReset
	}

	if full == 0 && remainder == 0 {
		// Under an eighth of a cell there is no honest length left to draw, but
		// the row still holds a real value and an empty column reads as a
		// rendering fault. A gray tick holds the place without competing with
		// the bars above it, which is what the old colored sliver did: stacked
		// down a long tail it formed a bright vertical rule over the least
		// significant rows.
		return colorGray + subCellBlocks[1] + strings.Repeat(" ", barWidth-1) + colorReset
	}

	var bar strings.Builder
	bar.WriteString(barColor)
	bar.WriteString(strings.Repeat("█", full))
	drawn := full
	if remainder > 0 {
		bar.WriteString(subCellBlocks[remainder])
		drawn++
	}
	bar.WriteString(strings.Repeat(" ", barWidth-drawn))
	bar.WriteString(colorReset)
	return bar.String()
}

// runeWidth returns display width for wide characters and emoji.
func runeWidth(r rune) int {
	if r >= 0x4E00 && r <= 0x9FFF || // CJK Unified Ideographs
		r >= 0x3400 && r <= 0x4DBF || // CJK Extension A
		r >= 0x20000 && r <= 0x2A6DF || // CJK Extension B
		r >= 0x2A700 && r <= 0x2B73F || // CJK Extension C
		r >= 0x2B740 && r <= 0x2B81F || // CJK Extension D
		r >= 0x2B820 && r <= 0x2CEAF || // CJK Extension E
		r >= 0x3040 && r <= 0x30FF || // Hiragana and Katakana
		r >= 0x31F0 && r <= 0x31FF || // Katakana Phonetic Extensions
		r >= 0xAC00 && r <= 0xD7AF || // Hangul Syllables
		r >= 0xFF00 && r <= 0xFFEF || // Fullwidth Forms
		r >= 0x1F300 && r <= 0x1F6FF || // Miscellaneous Symbols and Pictographs (includes Transport)
		r >= 0x1F900 && r <= 0x1F9FF || // Supplemental Symbols and Pictographs
		r >= 0x2600 && r <= 0x26FF || // Miscellaneous Symbols
		r >= 0x2700 && r <= 0x27BF || // Dingbats
		r >= 0xFE10 && r <= 0xFE1F || // Vertical Forms
		r >= 0x1F000 && r <= 0x1F02F { // Mahjong Tiles
		return 2
	}
	return 1
}

func displayWidth(s string) int {
	width := 0
	for _, r := range s {
		width += runeWidth(r)
	}
	return width
}

// calculateNameWidth computes name column width from terminal width.
func calculateNameWidth(termWidth int) int {
	const fixedWidth = 61
	available := termWidth - fixedWidth

	if available < 24 {
		return 24
	}
	if available > 60 {
		return 60
	}
	return available
}

func trimNameWithWidth(name string, maxWidth int) string {
	const (
		ellipsis      = "..."
		ellipsisWidth = 3
	)

	runes := []rune(name)
	widths := make([]int, len(runes))
	for i, r := range runes {
		widths[i] = runeWidth(r)
	}

	currentWidth := 0
	for i, w := range widths {
		if currentWidth+w > maxWidth {
			subWidth := currentWidth
			j := i
			for j > 0 && subWidth+ellipsisWidth > maxWidth {
				j--
				subWidth -= widths[j]
			}
			if j == 0 {
				return ellipsis
			}
			return string(runes[:j]) + ellipsis
		}
		currentWidth += w
	}

	return name
}

func padName(name string, targetWidth int) string {
	currentWidth := displayWidth(name)
	if currentWidth >= targetWidth {
		return name
	}
	return name + strings.Repeat(" ", targetWidth-currentWidth)
}

// formatUnusedTime formats time since last access.
func formatUnusedTime(lastAccess time.Time) string {
	if lastAccess.IsZero() {
		return ""
	}

	duration := time.Since(lastAccess)
	days := int(duration.Hours() / 24)

	if days < 90 {
		return ""
	}

	months := days / 30
	years := days / 365

	if years >= 2 {
		return fmt.Sprintf(">%dyr", years)
	} else if years >= 1 {
		return ">1yr"
	} else if months >= 3 {
		return fmt.Sprintf(">%dmo", months)
	}

	return ""
}

func measurementErrorReason(err error) string {
	switch {
	case errors.Is(err, context.DeadlineExceeded):
		return "timed out"
	case errors.Is(err, context.Canceled):
		return "cancelled"
	case isPermissionFailure(err):
		return "access denied"
	}
	var duFailure *duError
	if errors.As(err, &duFailure) && duFailure.reason != "" {
		return duFailure.reason
	}
	if pathFailure, ok := errors.AsType[*os.PathError](err); ok {
		return pathFailure.Err.Error()
	}
	return "read error"
}

// Partial sizes are measured bytes, so '+' marks that additional bytes may be
// missing. An unavailable measurement must never look like a measured zero.
func measuredSizeLabel(size int64, state scanState) string {
	if state == scanUnavailable || (state == scanPartial && size == 0) {
		return "unknown"
	}
	label := humanizeBytes(size)
	if state == scanPartial {
		label += "+"
	}
	return label
}

func scanSummary(size int64, state scanState) string {
	if state != scanComplete {
		return "Partial scan · " + measuredSizeLabel(size, state)
	}
	return "Scanned " + humanizeBytes(size)
}

```

### Core Architecture Module: `cmd/analyze/heap.go`
```
//go:build darwin

package main

// entryHeap is a min-heap of dirEntry used to keep Top N largest entries.
type entryHeap []dirEntry

func (h entryHeap) Len() int           { return len(h) }
func (h entryHeap) Less(i, j int) bool { return h[i].Size < h[j].Size }
func (h entryHeap) Swap(i, j int)      { h[i], h[j] = h[j], h[i] }

func (h *entryHeap) Push(x any) {
	*h = append(*h, x.(dirEntry))
}

func (h *entryHeap) Pop() any {
	old := *h
	n := len(old)
	x := old[n-1]
	*h = old[0 : n-1]
	return x
}

// largeFileHeap is a min-heap for fileEntry.
type largeFileHeap []fileEntry

func (h largeFileHeap) Len() int           { return len(h) }
func (h largeFileHeap) Less(i, j int) bool { return h[i].Size < h[j].Size }
func (h largeFileHeap) Swap(i, j int)      { h[i], h[j] = h[j], h[i] }

func (h *largeFileHeap) Push(x any) {
	*h = append(*h, x.(fileEntry))
}

func (h *largeFileHeap) Pop() any {
	old := *h
	n := len(old)
	x := old[n-1]
	*h = old[0 : n-1]
	return x
}

```

### Core Architecture Module: `cmd/analyze/insights.go`
```
//go:build darwin

package main

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// createInsightEntries returns the list of hidden-space insight entries
// to show in the overview screen alongside the standard directory entries.
func createInsightEntries() []dirEntry {
	home := os.Getenv("HOME")
	if home == "" {
		return nil
	}

	var entries []dirEntry

	// iOS Backups: ~/Library/Application Support/MobileSync/Backup
	backupPath := filepath.Join(home, "Library", "Application Support", "MobileSync", "Backup")
	if info, err := os.Stat(backupPath); err == nil && info.IsDir() {
		entries = append(entries, dirEntry{
			Name:  "iOS Backups",
			Path:  backupPath,
			IsDir: true,
			Size:  -1,
		})
	}

	// Old Downloads: ~/Downloads (files older than 90 days)
	downloadsPath := filepath.Join(home, "Downloads")
	if info, err := os.Stat(downloadsPath); err == nil && info.IsDir() {
		entries = append(entries, dirEntry{
			Name:  "Old Downloads (90d+)",
			Path:  downloadsPath,
			IsDir: true,
			Size:  -1,
		})
	}

	// Cleanable paths: things mo clean can remove or the user can safely delete.
	// System Caches (~Library/Caches) is intentionally omitted here because the
	// specific cache subdirectories below are already its children; listing both
	// would double-count the same bytes.
	cleanablePaths := []struct {
		name string
		path string
	}{
		// Universal (everyone has these)
		{"System Logs", filepath.Join(home, "Library", "Logs")},
		{"Homebrew Cache", filepath.Join(home, "Library", "Caches", "Homebrew")},

		// Developer-specific (only shown if path exists)
		{"Xcode DerivedData", filepath.Join(home, "Library", "Developer", "Xcode", "DerivedData")},
		{"Xcode Simulators", filepath.Join(home, "Library", "Developer", "CoreSimulator", "Devices")},
		{"Xcode Archives", filepath.Join(home, "Library", "Developer", "Xcode", "Archives")},
		{"Spotify Cache", filepath.Join(home, "Library", "Application Support", "Spotify", "PersistentCache")},
		{"JetBrains Cache", filepath.Join(home, "Library", "Caches", "JetBrains")},
		{"Docker Data", filepath.Join(home, "Library", "Containers", "com.docker.docker", "Data")},
		{"pip Cache", filepath.Join(home, "Library", "Caches", "pip")},
		{"uv Cache", filepath.Join(home, ".cache", "uv")},
		{"Gradle Cache", filepath.Join(home, ".gradle", "caches")},
		{"CocoaPods Cache", filepath.Join(home, "Library", "Caches", "CocoaPods")},
	}
	if matches, err := filepath.Glob(filepath.Join(home, "Library", "Group Containers", "*dev.orbstack", "data")); err == nil {
		for _, match := range matches {
			if info, statErr := os.Stat(match); statErr == nil && info.IsDir() {
				cleanablePaths = append(cleanablePaths, struct {
					name string
					path string
				}{"OrbStack Data", match})
				break
			}
		}
	}
	for _, c := range cleanablePaths {
		if info, err := os.Stat(c.path); err == nil && info.IsDir() {
			entries = append(entries, dirEntry{
				Name:  c.name,
				Path:  c.path,
				IsDir: true,
				Size:  -1,
			})
		}
	}

	return entries
}

// measureInsightSize measures the size of a path.
// Old Downloads is treated specially: only files older than 90 days are counted.
func measureInsightSize(ctx context.Context, path string) (int64, error) {
	return measureInsightSizeWithPublication(ctx, path, nil)
}

func measureInsightSizeWithPublication(ctx context.Context, path string, publication *scanPublication) (int64, error) {
	home := os.Getenv("HOME")

	if home != "" && path == filepath.Join(home, "Downloads") {
		return measureOldDownloads(ctx, path, 90)
	}

	return measureOverviewSizeWithPublication(ctx, path, publication)
}

// measureOldDownloads calculates total size of files in a directory
// that haven't been modified in the given number of days.
func measureOldDownloads(ctx context.Context, dir string, daysOld int) (int64, error) {
	ctx, cancel := context.WithTimeout(ctx, duTimeout)
	defer cancel()
	var failures scanFailures
	cutoff := time.Now().AddDate(0, 0, -daysOld)
	var total int64

	entries, err := os.ReadDir(dir)
	if err != nil {
		return 0, err
	}

	for _, entry := range entries {
		if ctx.Err() != nil {
			failures.record(ctx.Err())
			break
		}
		// Skip hidden files.
		if strings.HasPrefix(entry.Name(), ".") {
			continue
		}

		info, err := entry.Info()
		if err != nil {
			failures.record(err)
			continue
		}

		if info.ModTime().Before(cutoff) {
			if entry.IsDir() {
				// Use du for directories.
				size, err := getDirectorySizeFromDu(ctx, filepath.Join(dir, entry.Name()))
				failures.record(err)
				total += size
			} else {
				total += info.Size()
			}
		}
	}

	return total, failures.first
}

```

### Core Architecture Module: `cmd/analyze/json.go`
```
//go:build darwin

package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"sort"
	"sync"
	"sync/atomic"
	"time"
)

type jsonOutput struct {
	ScanStatus scanState       `json:"scan_status"`
	Path       string          `json:"path"`
	Overview   bool            `json:"overview"`
	Entries    []jsonEntry     `json:"entries"`
	LargeFiles []jsonFileEntry `json:"large_files,omitempty"`
	TotalSize  int64           `json:"total_size"`
	TotalFiles int64           `json:"total_files,omitempty"`
}

type jsonEntry struct {
	ScanStatus scanState `json:"scan_status"`
	Name       string    `json:"name"`
	Path       string    `json:"path"`
	Size       int64     `json:"size"`
	IsDir      bool      `json:"is_dir"`
	Insight    bool      `json:"insight,omitempty"`
	Cleanable  bool      `json:"cleanable,omitempty"`
	LastAccess string    `json:"last_access,omitempty"`
}

type jsonFileEntry struct {
	Name string `json:"name"`
	Path string `json:"path"`
	Size int64  `json:"size"`
}

func runJSONMode(path string, isOverview bool) {
	result := performScanForJSON(path, isOverview)

	encoder := json.NewEncoder(os.Stdout)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(result); err != nil {
		fmt.Fprintf(os.Stderr, "failed to encode JSON: %v\n", err)
		os.Exit(1)
	}
}

func performScanForJSON(path string, isOverview bool) jsonOutput {
	if isOverview {
		return performOverviewScanForJSON(path)
	}
	return performDirectoryScanForJSON(path)
}

func performDirectoryScanForJSON(path string) jsonOutput {
	var filesScanned, dirsScanned, bytesScanned int64
	currentPath := &atomic.Value{}
	currentPath.Store("")

	result, err := scanPathConcurrentAllEntries(context.Background(), path, &filesScanned, &dirsScanned, &bytesScanned, currentPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to scan directory: %v\n", err)
		os.Exit(1)
	}

	return jsonOutput{
		Path:       path,
		ScanStatus: result.State,
		Overview:   false,
		Entries:    jsonEntriesFromDirEntries(result.Entries, false, nil),
		LargeFiles: jsonFileEntriesFromFileEntries(result.LargeFiles),
		TotalSize:  result.TotalSize,
		TotalFiles: result.TotalFiles,
	}
}

func performOverviewScanForJSON(path string) jsonOutput {
	insightEntries := createInsightEntries()
	overviewEntries := createOverviewEntriesWithInsights(insightEntries)
	return performOverviewScanForJSONWithEntries(path, insightEntries, overviewEntries)
}

func performOverviewScanForJSONWithEntries(path string, insightEntries, overviewEntries []dirEntry) jsonOutput {
	insightPaths := make(map[string]bool, len(insightEntries))
	for _, insight := range insightEntries {
		insightPaths[insight.Path] = true
	}

	var totalSize int64
	entries := make([]dirEntry, 0, len(overviewEntries))
	for _, entry := range measureOverviewEntriesForJSON(overviewEntries, insightPaths) {
		// Match the TUI: omit scanned insight/tool entries that ended up empty.
		if entry.Size == 0 && entry.State == scanComplete {
			continue
		}
		totalSize += max(entry.Size, 0)
		entries = append(entries, entry)
	}

	sort.SliceStable(entries, func(i, j int) bool {
		return entries[i].Size > entries[j].Size
	})

	return jsonOutput{
		Path:       path,
		ScanStatus: entryScanState(entries),
		Overview:   true,
		Entries:    jsonEntriesFromDirEntries(entries, true, insightPaths),
		TotalSize:  totalSize,
	}
}

func measureOverviewEntriesForJSON(overviewEntries []dirEntry, insightPaths map[string]bool) []dirEntry {
	if len(overviewEntries) == 0 {
		return nil
	}

	type measurement struct {
		index int
		entry dirEntry
	}

	measured := make([]dirEntry, len(overviewEntries))
	sem := make(chan struct{}, maxConcurrentOverview)
	results := make(chan measurement, len(overviewEntries))

	var wg sync.WaitGroup
	for index, item := range overviewEntries {
		wg.Go(func() {
			sem <- struct{}{}
			defer func() { <-sem }()

			var (
				size int64
				err  error
			)

			if cached, state, cacheErr := loadOverviewCachedMeasurement(item.Path); cacheErr == nil && cached > 0 {
				size, item.State = cached, state
			} else {
				if insightPaths[item.Path] {
					size, err = measureInsightSize(context.Background(), item.Path)
				} else {
					size, err = measureOverviewSize(context.Background(), item.Path)
				}
				item.State = measurementState(size, err)
			}

			item.Size = size
			results <- measurement{index: index, entry: item}
		})
	}

	wg.Wait()
	close(results)

	for result := range results {
		measured[result.index] = result.entry
	}
	return measured
}

func jsonEntriesFromDirEntries(entries []dirEntry, isOverview bool, insightPaths map[string]bool) []jsonEntry {
	output := make([]jsonEntry, 0, len(entries))
	for _, entry := range entries {
		item := jsonEntry{
			Name:       entry.Name,
			ScanStatus: entry.State,
			Path:       entry.Path,
			Size:       entry.Size,
			IsDir:      entry.IsDir,
			Cleanable:  entry.IsDir && isCleanableDir(entry.Path),
		}

		if isOverview {
			item.Insight = insightPaths[entry.Path]
		}

		if !entry.LastAccess.IsZero() {
			item.LastAccess = entry.LastAccess.UTC().Format(time.RFC3339)
		}

		output = append(output, item)
	}
	return output
}

func jsonFileEntriesFromFileEntries(files []fileEntry) []jsonFileEntry {
	output := make([]jsonFileEntry, 0, len(files))
	for _, f := range files {
		output = append(output, jsonFileEntry(f))
	}
	return output
}

```

### Core Architecture Module: `cmd/analyze/live_config.go`
```
//go:build darwin

package main

import (
	"os"
	"strings"
)

const liveSortModeEnv = "MOLE_ANALYZE_LIVE_SORT"

func liveScanSortModeFromEnv() liveSortMode {
	switch strings.ToLower(strings.TrimSpace(os.Getenv(liveSortModeEnv))) {
	case "continuous":
		return liveSortContinuous
	default:
		return liveSortFreezeOnMove
	}
}

func nextLiveSortMode(mode liveSortMode) liveSortMode {
	if mode == liveSortContinuous {
		return liveSortFreezeOnMove
	}
	return liveSortContinuous
}

func liveSortModeLabel(mode liveSortMode) string {
	if mode == liveSortFreezeOnMove {
		return "freeze-on-move"
	}
	return "continuous"
}

```

### Core Architecture Module: `cmd/analyze/live_scan.go`
```
//go:build darwin

package main

import (
	"container/heap"
	"context"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"slices"
	"sort"
	"sync"
	"sync/atomic"
	"time"

	tea "github.com/charmbracelet/bubbletea"
)

var nextLiveScanID atomic.Int64

type liveScanTargetKind int

const (
	liveScanTargetDirectory liveScanTargetKind = iota + 1
	liveScanTargetFoldedDirectory
	liveScanTargetHomeLibrary
)

type liveScanTarget struct {
	name string
	path string
	kind liveScanTargetKind
}

// liveScanEventStream uses the scan publication boundary for event delivery.
// Progress is lossy and may use only the non-reserved portion of the buffer;
// one slot per target plus the final completion slot stays available.
type liveScanEventStream struct {
	publication   *scanPublication
	events        chan liveScanEventMsg
	requiredSlots int
	closed        bool
}

func newLiveScanEventStream(publication *scanPublication, targetCount int) *liveScanEventStream {
	return &liveScanEventStream{
		publication:   publication,
		events:        make(chan liveScanEventMsg, max(targetCount*4, 1)),
		requiredSlots: targetCount + 1,
	}
}

func (s *liveScanEventStream) cancel() {
	s.publication.cancel()
}

func (s *liveScanEventStream) publish(msg liveScanEventMsg) {
	_ = s.publication.commit(func() error {
		if s.closed {
			return nil
		}
		// Progress publication reserves enough capacity that every target can
		// emit one result or failure and the coordinator can emit completion.
		s.events <- msg
		return nil
	})
}

func (s *liveScanEventStream) publishProgress(msg liveScanEventMsg) {
	_ = s.publication.commit(func() error {
		if s.closed || len(s.events) >= cap(s.events)-s.requiredSlots {
			return nil
		}
		s.events <- msg
		return nil
	})
}

func (s *liveScanEventStream) close() {
	s.publication.finish(func() {
		if s.closed {
			return
		}
		s.closed = true
		close(s.events)
	})
}

func startLiveScanCmd(path string, filesScanned, dirsScanned, bytesScanned *int64, currentPath *atomic.Value) tea.Cmd {
	return startLiveScanCmdWithPolicy(path, filesScanned, dirsScanned, bytesScanned, currentPath, scanCacheReuse)
}

func startLiveScanCmdWithPolicy(path string, filesScanned, dirsScanned, bytesScanned *int64, currentPath *atomic.Value, cachePolicy scanCachePolicy) tea.Cmd {
	return func() tea.Msg {
		id := nextLiveScanID.Add(1)
		ctx, cancelContext := context.WithCancel(context.Background())

		limiter := newScanLimiter(0)
		initial, targets, err := readLiveScanInitialEntries(path, limiter)
		if err != nil {
			cancelContext()
			return liveScanStartMsg{id: id, path: path, err: err}
		}

		if initial.TotalFiles > 0 {
			atomic.AddInt64(filesScanned, initial.TotalFiles)
		}
		if initial.TotalSize > 0 {
			atomic.AddInt64(bytesScanned, initial.TotalSize)
		}

		publication := newScanPublication(ctx, cancelContext)
		stream := newLiveScanEventStream(publication, len(targets))
		go runLiveScan(ctx, id, path, initial, targets, limiter, filesScanned, dirsScanned, bytesScanned, currentPath, stream, cachePolicy)

		scanningPaths := make([]string, 0, len(targets))
		for _, target := range targets {
			scanningPaths = append(scanningPaths, target.path)
		}

		return liveScanStartMsg{
			state:         initial.State,
			id:            id,
			path:          path,
			entries:       initial.Entries,
			totalSize:     initial.TotalSize,
			totalFiles:    initial.TotalFiles,
			largeFiles:    initial.LargeFiles,
			scanningPaths: scanningPaths,
			events:        stream.events,
			cancel:        stream.cancel,
		}
	}
}

func readLiveScanInitialEntries(root string, limiter *scanLimiter) (scanResult, []liveScanTarget, error) {
	children, err := os.ReadDir(root)
	if err != nil {
		return scanResult{}, nil, err
	}
	if limiter == nil {
		limiter = newScanLimiter(len(children))
	}

	isRootDir := root == "/"
	home := os.Getenv("HOME")
	isHomeDir := home != "" && root == home

	entries := make([]dirEntry, 0, len(children))
	targets := make([]liveScanTarget, 0, len(children))
	largeFiles := make([]fileEntry, 0)
	var totalSize int64
	var totalFiles int64
	state := scanComplete
	transient := false

	for _, child := range children {
		fullPath := filepath.Join(root, child.Name())

		if child.Type()&fs.ModeSymlink != 0 {
			targetInfo, err := os.Stat(fullPath)
			isDir := false
			if err == nil && targetInfo.IsDir() {
				isDir = true
			}
			info, err := child.Info()
			if err != nil {
				state = scanPartial
				transient = transient || isTransientFailure(err)
				continue
			}
			size := getActualFileSize(fullPath, info)
			totalSize += size
			entries = append(entries, dirEntry{
				Name:       child.Name() + " →",
				Path:       fullPath,
				Size:       size,
				IsDir:      isDir,
				LastAccess: getLastAccessTimeFromInfo(info),
			})
			continue
		}

		if child.IsDir() {
			if defaultSkipDirs[child.Name()] {
				continue
			}
			if isRootDir && skipSystemDirs[child.Name()] {
				continue
			}

			targetKind := liveScanTargetDirectory
			if isHomeDir && child.Name() == "Library" {
				targetKind = liveScanTargetHomeLibrary
			} else if shouldFoldDirWithPath(child.Name(), fullPath) {
				targetKind = liveScanTargetFoldedDirectory
			}

			entries = append(entries, dirEntry{
				Name:  child.Name(),
				Path:  fullPath,
				Size:  -1,
				IsDir: true,
			})
			targets = append(targets, liveScanTarget{
				name: child.Name(),
				path: fullPath,
				kind: targetKind,
			})
			continue
		}

		info, err := child.Info()
		if err != nil {
			state = scanPartial
			transient = transient || isTransientFailure(err)
			continue
		}
		size, _ := countableFileSize(info, &limiter.seen)
		totalSize += size
		totalFiles++
		entries = append(entries, dirEntry{
			Name:       child.Name(),
			Path:       fullPath,
			Size:       size,
			IsDir:      false,
			LastAccess: getLastAccessTimeFromInfo(info),
		})
		if !shouldSkipFileForLargeTracking(fullPath) && size >= largeFileWarmupMinSize {
			largeFiles = append(largeFiles, fileEntry{Name: child.Name(), Path: fullPath, Size: size})
		}
	}

	sortDirEntriesBySize(entries)
	largeFiles = topLargeFiles(largeFiles)
	return scanResult{Entries: entries, TotalSize: totalSize, TotalFiles: totalFiles, LargeFiles: largeFiles, State: state, transientFailure: transient}, targets, nil
}

func runLiveScan(
	ctx context.Context,
	id int64,
	root string,
	initial scanResult,
	targets []liveScanTarget,
	limiter *scanLimiter,
	filesScanned, dirsScanned, bytesScanned *int64,
	currentPath *atomic.Value,
	stream *liveScanEventStream,
	cachePolicy scanCachePolicy,
) {
	defer stream.close()

	entriesByPath := make(map[string]dirEntry, len(initial.Entries))
	for _, entry := range initial.Entries {
		entriesByPath[entry.Path] = entry
	}

	var totalSize atomic.Int64
	var totalFiles atomic.Int64
	totalSize.Store(initial.TotalSize)
	totalFiles.Store(initial.TotalFiles)

	largeFileChan := make(chan fileEntry, maxLargeFiles*2)
	largeFileMinSize := int64(largeFileWarmupMinSize)
	largeFilesDone := make(chan []fileEntry, 1)
	go collectLiveLargeFiles(initial.LargeFiles, largeFileChan, &largeFileMinSize, largeFilesDone)

	var dedupedHardlink atomic.Bool
	var incomplete atomic.Bool
	var transient atomic.Bool
	incomplete.Store(initial.State != scanComplete)
	transient.Store(initial.transientFailure)
	var mu sync.Mutex
	var wg sync.WaitGroup

	for _, target := range targets {
		if ctx.Err() != nil {
			break
		}
		target := target
		scanTarget := func() {
			defer wg.Done()
			result, err := scanLiveTargetWithProgress(ctx, id, root, target, largeFileChan, limiter, currentPath, stream, cachePolicy)
			if err != nil && !errors.Is(err, context.Canceled) {
				incomplete.Store(true)
				if isTransientFailure(err) {
					transient.Store(true)
				}
				mu.Lock()
				entriesByPath[target.path] = dirEntry{Name: target.name, Path: target.path, IsDir: true, State: scanUnavailable}
				mu.Unlock()
				stream.publish(liveScanEventMsg{id: id, path: root, kind: liveScanFailed, entry: dirEntry{Name: target.name, Path: target.path, IsDir: true, State: scanUnavailable}, err: err})
				return
			}
			if ctx.Err() != nil {
				return
			}

			entry := dirEntry{
				Name:  target.name,
				Path:  target.path,
				Size:  result.TotalSize,
				State: result.State,
				IsDir: true,
			}
			mu.Lock()
			entriesByPath[target.path] = entry
			mu.Unlock()

			// The child result carries its own failure classification.
			if result.State != scanComplete {
				incomplete.Store(true)
			}
			if result.transientFailure {
				transient.Store(true)
			}
			totalSize.Add(result.TotalSize)
			if result.TotalFiles > 0 {
				totalFiles.Add(result.TotalFiles)
			}
			if result.dedupedHardlink {
				dedupedHardlink.Store(true)
			}
			atomic.AddInt64(dirsScanned, 1)
			if result.TotalFiles > 0 {
				atomic.AddInt64(filesScanned, result.TotalFiles)
			}
			if result.TotalSize > 0 {
				atomic.AddInt64(bytesScanned, result.TotalSize)
			}

			stream.publish(liveScanEventMsg{
				id:     id,
				path:   root,
				kind:   liveScanChildDone,
				entry:  entry,
				result: result,
			})
		}

		wg.Add(1)
		if limiter.tryAcquireEntry() {
			go func() {
				defer limiter.releaseEntry()
				scanTarget()
			}()
		} else {
			scanTarget()
		}
	}

	wg.Wait()
	close(largeFileChan)
	largeFiles := <-largeFilesDone

	if ctx.Err() != nil {
		return
	}

	mu.Lock()
	finalEntries := make([]dirEntry, 0, len(entriesByPath))
	for _, entry := range entriesByPath {
		finalEntries = append(finalEntries, entry)
	}
	mu.Unlock()
	sortDirEntriesBySize(finalEntries)
	if len(finalEntries) > maxEntries {
		finalEntries = finalEntries[:maxEntries]
	}

	state := scanComplete
	if incomplete.Load() {
		state = scanPartial
	}
	result := scanResult{
		State:            state,
		Entries:          finalEntries,
		LargeFiles:       largeFiles,
		TotalSize:        totalSize.Load(),
		TotalFiles:       totalFiles.Load(),
		dedupedHardlink:  dedupedHardlink.Load(),
		transientFailure: transient.Load(),
	}

	stream.publish(liveScanEventMsg{id: id, path: root, 
```

### Core Architecture Module: `cmd/analyze/main.go`
```
//go:build darwin

package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"sync/atomic"
	"syscall"
	"time"

	tea "github.com/charmbracelet/bubbletea"
)

var (
	jsonMode = flag.Bool("json", false, "output analysis as JSON instead of TUI")
)

// usageText is the help every other Mole subcommand prints by hand. The Go flag
// package would otherwise render "Usage of /usr/local/bin/analyze-go:", naming a
// bundled binary the user never typed, so the text is written out here instead.
const usageText = `Usage: mo analyze [OPTIONS] [PATH]

Explore disk usage. Without PATH, scans a machine-wide overview.

Options:
  --json          Output the analysis as JSON instead of the interactive TUI
  -h, --help      Show this help message

Examples:
  mo analyze                 Machine-wide overview
  mo analyze ~/Library       Scan one directory
  mo analyze --json /Volumes Machine-readable output
`

// parseArgs applies Mole's CLI conventions to the flag package: help goes to
// stdout and exits 0, and an unknown flag goes to stderr and exits 1 the way
// every bash subcommand does, rather than the flag package's stderr-and-2.
// It returns the exit code and whether main should keep running.
func parseArgs(args []string, stdout, stderr io.Writer) (int, bool) {
	flag.CommandLine.Init("mo analyze", flag.ContinueOnError)
	// Parse must not print: this function decides which stream each message
	// belongs on, and the default handler writes usage to stderr for both.
	flag.CommandLine.SetOutput(io.Discard)
	flag.CommandLine.Usage = func() {}

	err := flag.CommandLine.Parse(args)
	switch {
	case errors.Is(err, flag.ErrHelp):
		_, _ = fmt.Fprint(stdout, usageText)
		return 0, false
	case err != nil:
		_, _ = fmt.Fprintln(stderr, err)
		_, _ = fmt.Fprintln(stderr, "Use 'mo analyze --help' for usage information")
		return 1, false
	}
	return 0, true
}

func main() {
	if code, keepGoing := parseArgs(os.Args[1:], os.Stdout, os.Stderr); !keepGoing {
		os.Exit(code)
	}

	abs, isOverview, err := resolveScanTarget(os.Getenv("MO_ANALYZE_PATH"), flag.Args())
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	go pruneAnalyzerCache()
	if *jsonMode {
		runJSONMode(abs, isOverview)
	} else {
		runTUIMode(abs, isOverview)
	}
}

// resolveScanTarget decides which scan a given invocation asks for. Kept
// separate from main so the overview-vs-directory routing has a test that fails
// when it flips: an end-to-end overview scan measures the real /Applications
// and /Library, which cost 106s of a single CI test file's 134s.
func resolveScanTarget(envPath string, args []string) (string, bool, error) {
	target := envPath
	if target == "" && len(args) > 0 {
		target = args[0]
	}

	// No explicit target means the machine-wide overview, not the root
	// directory: "/" is only where the overview rows are anchored.
	if target == "" {
		return "/", true, nil
	}

	abs, err := filepath.Abs(target)
	if err != nil {
		return "", false, fmt.Errorf("cannot resolve %q: %v", target, err)
	}
	return abs, false, nil
}

func runTUIMode(path string, isOverview bool) {
	m := newModel(path, isOverview)
	defer m.cancelBackgroundCacheWrites(nil)
	// Warm overview cache only when the user opens a specific directory.
	// Overview mode already schedules the same measurements for the foreground UI;
	// running the prefetcher there doubles the du/io workload on cold start.
	if !isOverview {
		prefetchCtx, prefetchCancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer prefetchCancel()
		m.startOverviewPrefetch(prefetchCtx)
	}

	p := tea.NewProgram(m, tea.WithAltScreen())
	if _, err := p.Run(); err != nil {
		fmt.Fprintf(os.Stderr, "analyzer error: %v\n", err)
		os.Exit(1)
	}
}

func newModel(path string, isOverview bool) model {
	var filesScanned, dirsScanned, bytesScanned int64
	currentPath := &atomic.Value{}
	currentPath.Store("")
	var diskFreeBytes int64
	var stat syscall.Statfs_t
	if err := syscall.Statfs(path, &stat); err == nil {
		diskFreeBytes = int64(stat.Bavail) * int64(stat.Bsize)
	}

	m := model{
		path:                path,
		selected:            0,
		status:              "Preparing scan...",
		diskFree:            diskFreeBytes,
		scanning:            !isOverview,
		filesScanned:        &filesScanned,
		dirsScanned:         &dirsScanned,
		bytesScanned:        &bytesScanned,
		currentPath:         currentPath,
		showLargeFiles:      false,
		isOverview:          isOverview,
		cache:               make(map[string]historyEntry),
		overviewSizeCache:   make(map[string]int64),
		overviewScanningSet: make(map[string]*scanPublication),
		cachePublications:   make(map[string]*scanPublication),
		multiSelected:       make(map[string]bool),
		largeMultiSelected:  make(map[string]bool),
		liveSortMode:        liveScanSortModeFromEnv(),
		snapshotRunner:      runLocalSnapshotCommand,
	}

	if isOverview {
		m.scanning = false
		m.hydrateOverviewEntries()
		m.selected = 0
		m.offset = 0
		if nextPendingOverviewIndex(m.entries) >= 0 {
			m.overviewScanning = true
			m.status = "Checking system folders..."
		} else {
			m.status = "Ready"
		}
	}

	// Try to peek last total files for progress bar, even if cache is stale
	if !isOverview {
		if total, err := peekCacheTotalFiles(path); err == nil && total > 0 {
			m.lastTotalFiles = total
		}
	}

	return m
}

func createOverviewEntries() []dirEntry {
	return createOverviewEntriesWithInsights(createInsightEntries())
}

func createOverviewEntriesWithInsights(insightEntries []dirEntry) []dirEntry {
	home := os.Getenv("HOME")
	entries := []dirEntry{}

	// Separate Home and ~/Library to avoid double counting.
	if home != "" {
		entries = append(entries, dirEntry{Name: "Home", Path: home, IsDir: true, Size: -1})

		userLibrary := filepath.Join(home, "Library")
		if _, err := os.Stat(userLibrary); err == nil {
			// Renamed from "App Library" to "User Library" so it parallels
			// "System Library" (`/Library`) and is not confused with
			// `/Applications`. Path unchanged.
			entries = append(entries, dirEntry{Name: "User Library", Path: userLibrary, IsDir: true, Size: -1})
		}
	}

	entries = append(entries, systemOverviewRoots()...)

	// Hidden space insights: paths that silently accumulate disk usage.
	entries = append(entries, insightEntries...)

	return entries
}

func systemOverviewRoots() []dirEntry {
	return []dirEntry{
		{Name: "Applications", Path: "/Applications", IsDir: true, Size: -1},
		{Name: "System Library", Path: "/Library", IsDir: true, Size: -1},
	}
}

func sumKnownEntrySizes(entries []dirEntry) int64 {
	var total int64
	for _, entry := range entries {
		if entry.Size > 0 {
			total += entry.Size
		}
	}
	return total
}

func nextPendingOverviewIndex(entries []dirEntry) int {
	for i, entry := range entries {
		if entry.Size < 0 {
			return i
		}
	}
	return -1
}

func hasPendingOverviewEntries(entries []dirEntry) bool {
	for _, entry := range entries {
		if entry.Size < 0 {
			return true
		}
	}
	return false
}

func safeOpen(path string, reveal bool) error {
	if err := validatePath(path); err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), openCommandTimeout)
	defer cancel()
	args := []string{path}
	if reveal {
		args = []string{"-R", path}
	}
	return exec.CommandContext(ctx, "open", args...).Run()
}

// safePreview opens the file with the default macOS application.
func safePreview(path string) error {
	if err := validatePath(path); err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), openCommandTimeout)
	defer cancel()
	return exec.CommandContext(ctx, "open", path).Run()
}

```

### Core Architecture Module: `cmd/analyze/main_stub.go`
```
//go:build !darwin

package main

import (
	"fmt"
	"os"
)

func main() {
	fmt.Fprintln(os.Stderr, "analyze is only supported on macOS")
	os.Exit(1)
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1669** (2026-10-04): **[BUG] Leftovers cannot be removed in mole uninstall**
  *Symptoms*: ## Describe the bug  Whenever I try to uninstall any software, it always shows:  > Scanning files...xxx: some paths could not be read, so shared leftovers are left in place  Only the main executable file gets deleted.  ## Steps to reproduce  1. Run command: `mo uninstall` 2. Select an app 3. See error  ## Expected behavior  The main app file and all related leftovers can be scanned and removed.  ## Debug logs  Please run the command with `--debug` flag and paste the output here:  ```bash mo <command> --debug # Example: mo clean --debug ```  <details> <summary>Summary</summary>  ```text [DEBUG] Bundle id xxx is shared with a live sibling; removing only the selected app bundle for xxx ```  </details>  ## Environment  Paste the output of `mo --version` from the version used to reproduce the problem:  ```text Mole version 1.56.1 macOS: 27.0 Architecture: arm64 Kernel: 27.0.0 SIP: Enabled Disk Free: 180.27GB Install: Homebrew Shell: /bin/zsh ```
  **Post-Mortem & Fix Analysis**:
  > @junytang Thanks for sending the logs. Version 1.57.0 fixes the Time Machine snapshot scan failure that was keeping your app leftovers in place.  Run `mo update`, confirm `mo --version` shows 1.57.0 or newer, then try `mo uninstall` again. Please reopen this issue if the same warning remains. 

- **Issue #1660** (2026-10-03): **[Mac App Bug] 关于主界面风扇显示不完全的问题**
  *Symptoms*: ### Mole Mac app version  v1.16.0 (297)  ### macOS version  macOS 27.0.1  ### Mac model  _No response_  ### Affected area  Status  ### What happened?  界面显示转速的位置，显示不完全，好几个版本都是这样  <img width="265" height="185" alt="Image" src="https://github.com/user-attachments/assets/5f815b09-5df0-404e-99f1-7380cb3d475a" />  ### Steps to reproduce  主界面 状态页面默认显示  ### Expected behavior  将文字显示完全，(RPM)  ### Screenshots or safe logs  _No response_  ### Before submitting  - [x] I updated to the latest stable Mole Mac app, reopened it, and reproduced this problem (or this report explains why I cannot update). - [x] I did not include license keys, order numbers, or private data.
  **Post-Mortem & Fix Analysis**:
  > @VincentPhoton 抱歉转速单位一直显示不全，[1.16.0 Preview 300](https://mole.fit/Mole-preview-300.dmg) 已修复风扇卡片里 RPM 被截断的问题。  退出 Mole 后替换应用程序里的旧版，再打开状态页检查，如果同样的窗口大小下仍显示不全，在这里回复，我会重新打开这个 issue。 

- **Issue #1659** (2026-10-03): **[BUG] Stuck in "Finalizing list ..." in mole uninstall**
  *Symptoms*: ## Describe the bug  Stuck in "Finalizing list ..." in mole uninstall  ## Steps to reproduce  1. Run command: `mo uninstall` 2. Stuck in "Finalizing list ..."  ## Environment  Paste the output of `mo --version` from the version used to reproduce the problem:  ```text Mole version 1.56.1 macOS: 27.0 Architecture: arm64 Kernel: 27.0.0 SIP: Enabled Disk Free: 112.59GB Install: Homebrew Shell: /bin/bash ``` 
  **Post-Mortem & Fix Analysis**:
  > @junytang I haven't reproduced the hang with isolated application fixtures on Bash 3.2, including the active spinner and the conditional call used by interactive uninstall, so the cause is still unconfirmed.  In a second terminal while it is stuck, does this command return?  ```bash mo uninstall --list >/dev/null 2>&1; echo "exit=$?" ```  This uses the listing path without terminal progress output and does not uninstall anything. Just the exit code, or whether it also hangs, would help distinguish the scan from terminal progress/selection; no application inventory needs to be shared.  AI-assisted investigation. 
  > > [@junytang](https://github.com/junytang) I haven't reproduced the hang with isolated application fixtures on Bash 3.2, including the active spinner and the conditional call used by interactive uninstall, so the cause is still unconfirmed. >  > In a second terminal while it is stuck, does this command return? >  > mo uninstall --list >/dev/null 2>&1; echo "exit=$?" > This uses the listing path without terminal progress output and does not uninstall anything. Just the exit code, or whether it also hangs, would help distinguish the scan from terminal progress/selection; no application inventory needs to be shared. >  > AI-assisted investigation.  Thanks for the respond. The above command's return is "exit=0"
  > @junytang Thanks — `--list` returning 0 narrows this to the interactive path, but does not yet identify the spinner as the cause.  I also checked the current scan → load → selector path in a real pseudo-terminal on macOS/Bash 3.2, using one synthetic app and an isolated cache. The scan returned, the selector rendered, and Q cancelled with no selection. This is a negative reproduction, not proof that your hang is fixed. V1.56.1 is still the latest stable release.  Which terminal app are you using, and does Ctrl+C return to the prompt while “Finalizing list...” is stuck? That will help distinguish a blocked scan/child wait from terminal input or rendering. No app inventory or private paths are needed.  AI-assisted investigation. 

- **Issue #1650** (2026-10-03): **[Mac App Bug] Analyze: Rescanning entire disk does not refresh cached subdirectory views after external file deletion**
  *Symptoms*: ### Mole Mac app version  1.15.0 (294)  ### macOS version  27.0.0  ### Mac model  Mac16,10 (Apple M4)  ### Affected area  Analyze  ### What happened?  After performing a full disk scan in the **Analyze** module, I located a 22 GB file and permanently deleted it externally via Finder while keeping Mole open.   When I triggered a rescan/refresh of the entire disk from the root view, the top-level folder correctly reflected the 22 GB size reduction. However, when I clicked into that top-level folder and navigated down to the deleted file's parent directory, the view still displayed the stale folder size and listed the deleted 22 GB file. The deleted file only disappeared after I manually clicked the refresh button in the top-right corner within that specific subdirectory view.  ### Steps to reproduce  1. Open Mole and go to **Analyze** to scan the entire disk. 2. Navigate through the directory tree to locate a large file (e.g., 22 GB). 3. Keep Mole open, switch to **Finder**, and permanently delete that file. 4. Return to Mole's root disk view and rescan/refresh the entire disk. 5. Observe that the top-level directory size has decreased by 22 GB as expected. 6. Click into the top-level directory and drill down to the parent folder of the deleted file. 7. See that the parent folder still shows the old size and the deleted file is still listed (until manually clicking the top-right refresh button inside that folder view).  ### Expected behavior  I expected Mole to invalidate and u
  **Post-Mortem & Fix Analysis**:
  > @wbpluto Thanks for the clear steps, and sorry the deeper folders kept showing the file you had already deleted.  This is fixed in Preview 299. Refreshing a folder now also clears the saved results for every folder below it, so after a full rescan from the root view, drilling down shows current sizes without refreshing each folder again.  You can install it from https://mole.fit/Mole-preview.dmg. If a subfolder still lists a deleted file after a full rescan, reopen this issue. 

- **Issue #1647** (2026-09-30): **mo status: network rates are wrong when traffic goes through a virtual interface (utun*)**
  *Symptoms*: Environment - Mole 1.56.0 (Homebrew) - macOS 26 (Darwin 25.6.0), Apple Silicon  Description When the default route goes through a virtual interface like utun* (a VPN, a packet-tunnel network extension, WireGuard, and so on), mo status doesn't report network activity correctly. It only lists physical interfaces (en0, en4, en6…) and leaves out all utun* interfaces. For those it just shows a Proxy: TUN utun0+ label.  It gets worse when a tunnel network extension is active: macOS may count inbound packets only on the virtual interface. The physical interface then reports 0 received bytes, so Mole shows download = 0 all the time, even during heavy transfers.  Steps to reproduce 1. Connect to any VPN or tunnel that creates a utun* interface and sets it as the default route (route -n get default → interface: utunN). 2. Generate traffic, for example a large download. 3. Run mo status --json (or --watch).  Expected Network rates include the interface that actually carries the traffic, utunN here.  Actual utunN is missing and en0 shows rx_rate_mbs: 0:  "network": [   {"name": "en0", "rx_rate_mbs": 0, "tx_rate_mbs": 0.059, "ip": "10.x.x.x"},   {"name": "en4", "rx_rate_mbs": 0, "tx_rate_mbs": 0, "ip": ""},   {"name": "en6", "rx_rate_mbs": 0, "tx_rate_mbs": 0, "ip": ""} ], "proxy": {"enabled": true, "type": "TUN", "host": "utun0+"}  Kernel counters (netstat -ib) at the same time:  Name   Ipkts     Ibytes        Opkts    Obytes en0    0         0             3832524  1237606173 utunN  1827
  **Post-Mortem & Fix Analysis**:
  > @cookiemonsterq Thanks for reporting this. The IPv4 default-route tunnel is now included in nightly, and the network graph uses its rates without adding the same traffic from the physical interface. IPv6 and split-tunnel accounting are not covered by this change.  Your Homebrew installation follows stable releases. To try nightly separately, make sure Go is installed (`brew install go` if needed), then run:  ```sh installer=$(mktemp -t mole-install) curl -fsSL https://raw.githubusercontent.com/tw93/Mole/main/install.sh -o "$installer" &&   bash "$installer" main --prefix "$HOME/.local/bin" "$HOME/.local/bin/mo" status ```  Please reopen if download traffic still stays at zero with the tunnel as the IPv4 default route. 
  > It does work.  TY !   😎🤟

- **Issue #1645** (2026-09-29): **[BUG] opendesign 卸载不干净**
  *Symptoms*: mole 卸载 opendesign  <img width="1372" height="397" alt="Image" src="https://github.com/user-attachments/assets/19fd8220-43e5-42b0-b520-c8fcb15f1a8b" />

- **Issue #1634** (2026-10-01): **[Mac App Bug] 查看运行中的 ChatGPT 卸载文件时连续崩溃（AttributeGraph / SIGABRT，macOS 27）**
  *Symptoms*: ### Mole Mac app version  1.15.0 (294)  ### macOS version  27.0.0  ### Mac model  Mac17,9 (Apple M5 Pro)  ### Affected area  Uninstall  ### What happened?  在 Mole 的「软件 → 卸载」中选择 ChatGPT，只想查看它有哪些关联文件，并不准备真正卸载。当时 ChatGPT 仍在运行，Mole 随后报错退出；重新打开后再次遇到同样情况，共发生两次。未主动确认删除或卸载 ChatGPT。  两份 macOS 崩溃报告确认： - 第一次：2026-09-29 09:49:55 +08:00（启动于 09:44:57，运行约 298 秒）。 - 第二次：2026-09-29 09:50:37 +08:00（重新启动于 09:50:00，运行约 37 秒）。 - 两次均为主线程 EXC_CRASH (SIGABRT) / Abort trap: 6，顶部都经过 AttributeGraph 的 AG::precondition_failure → AG::data::table::grow_region。 - 系统日志在对应时刻均记录 com.apple.attributegraph 的 precondition failure；具体错误文本被系统隐去为 <private>。  初步定位：崩溃发生在 SwiftUI/AttributeGraph 构建或布局界面、分配图数据的路径。两份主线程堆栈分别有 508 / 429 帧，包含大量重复的 ModifiedElements / ViewList / sizeThatFits 调用。建议检查卸载文件预览及「应用仍在运行」相关界面的视图构建、状态更新或递归布局，以及 macOS 27 兼容性。此处是排查方向，尚不能证明是无限递归、内存泄漏或正在运行检测本身造成。  环境补充： - 当前显示为 ChatGPT 的应用：26.924.22138 (11645)，Bundle ID 为 com.openai.codex；安装来源未确认。它与另外安装的 ChatGPT Classic（com.openai.chat）不同。 - Mole 已安装版本、两份崩溃报告均为 1.15.0 (294)，与提交时官方 https://mole.fit/appcast.xml 最新版本一致，无更高版本可更新。两次崩溃之间已经重新启动 Mole。 - 本次排查仅检查日志和版本，没有再次尝试实际卸载，也没有终止 ChatGPT。  ### Steps to reproduce  1. 保持 ChatGPT 在运行。 2. 打开 Mole 1.15.0 (294)，进入「软件 → 卸载」。 3. 选择 ChatGPT，查看待卸载/关联文件（目的只是预览，不确认删除）。 4. 在目标应用仍运行的这个场景下，Mole 报错并退出。 5. 重新打开 Mole，再次执行同样的查看操作，又发生一次退出。  以上步骤根据实际使用情况整理；未保存报错弹窗的原文，也尚未对「目标应用退出后是否仍会崩溃」做对照测试。  ### Expected behavior  应能安全查看应用及关联文件；若目标应用正在运行，应正常显示提示并允许取消或继续查看，Mole 不应崩溃。只有在用户明确确认卸载后，才应关闭目标应用或删除文件。  ### Screenshots or safe logs  以下仅为脱敏后的
  **Post-Mortem & Fix Analysis**:
  > @marsxxl 谢谢反馈，这个崩溃已在当前 1.16.0 Preview（299）修复，大量关联文件会按组和分页展示，我已验证运行中的 ChatGPT 文件预览、展开和换页，无需退出或卸载 ChatGPT。  可以安装 [Preview 299](https://mole.fit/Mole-preview-299.dmg) 后重新查看关联文件，这条先关闭；如果仍出现崩溃，可以在这里补充反馈，我会继续排查。 

- **Issue #1624** (2026-09-28): **[BUG] mo uninstall fails with exit 1 during same-bundle scan on enterprise/restricted macOS (sudo blocked, scan fails before escalation)**
  *Symptoms*: ## Before submitting  - [x] I updated and reproduced the problem, or this report explains why I cannot update.  ## Describe the bug  In version 1.56.0, `mo uninstall` fails unconditionally during the live same-bundle scan step when executed on a restricted or enterprise-managed macOS machine (MDM / managed permissions / custom URL handlers).  Because `mo` explicitly disallows running via `sudo` (`Run Mole without sudo`), and the internal privilege escalation step happens **after** the scan phase, the tool enters a deadlock where the scan fails before requesting necessary access, completely blocking uninstallation.  ## Steps to reproduce  1. Run command: `mo uninstall` 2. Select any installed application (e.g., Google Chrome or Safe Exam Browser). 3. Proceed with uninstallation. 4. The scanner fails with `Could not verify whether other installs share... bundle id; nothing was removed` and exits with code 1.  ## Expected behavior  Scan failures (such as missing or unresolvable Bundle IDs, or restricted system index access) should log a warning instead of triggering a fatal `exit 1` error that cancels the entire uninstallation transaction. Alternatively, a flag like `--skip-scan` should be provided to bypass same-bundle checks.  ## Debug logs  <details> <summary>Debug output</summary>  ```text ---------------------------------------------------------------------- Mole Debug Session, 2026-09-28 08:44:16 ---------------------------------------------------------------------- User: 
  **Post-Mortem & Fix Analysis**:
  > @ilypopv Thanks for the detailed report and the debug log.  This is fixed in V1.56.1. When Mole cannot finish checking for other copies of an app, for example because package receipts or an app folder are unreadable on a managed Mac, it no longer stops the uninstall. It removes only the app you selected and leaves any shared leftovers in place, with a warning that says why. Mole still refuses to run under sudo on purpose, and no extra flag is needed.  The Homebrew update to 1.56.1 is in review now. Once it lands, run `brew upgrade mole` and retry `mo uninstall`. If it still fails, reopen this issue with the new `mo uninstall --debug` output. 

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

### Incident Patch 1: `8f7605fa` (2026-10-06)
**Commit Message**: fix(clean): name what timed out; a go clean timeout skips only that cache (#1691)

* fix(clean): name what timed out in the summary and mole.log

A cancelled `mo clean` only said "a scan or size check timed out (exit
124)", and no log recorded which step it was. Record the first label
offered while a cancellation unwinds (owner command or safe_clean
description, else the step name), show it in the summary, and write it
with its section to mole.log. Owner-command timeouts that the terminal
keeps quiet are logged there too.

* fix(clean): let a go clean timeout skip only that cache

Since #1628 an owner-command timeout in clean_tool_cache skips that one
tool, but clean_go_cache_root still cancelled every remaining section.
A timed-out `go clean` now prints "stopped (timed out)" for that cache
and the run continues; a signal still cancels.

**File**: `bin/clean.sh` (modified, +22/-3)
```diff
@@ -1148,6 +1148,7 @@ _safe_clean_impl() {
             fi
             MOLE_CLEAN_CANCEL_STATUS=$cleanup_interrupt_rc
             export MOLE_CLEAN_CANCEL_STATUS
+            _mole_note_clean_cancel_source "$description"
             return "$cleanup_interrupt_rc"
         fi
 
@@ -1370,6 +1371,7 @@ _safe_clean_impl() {
     if [[ $cleanup_interrupt_rc -ne 0 ]]; then
         MOLE_CLEAN_CANCEL_STATUS=$cleanup_interrupt_rc
         export MOLE_CLEAN_CANCEL_STATUS
+        _mole_note_clean_cancel_source "$description"
         return "$cleanup_interrupt_rc"
     fi
 
@@ -1439,6 +1441,8 @@ start_cleanup() {
     export MOLE_CURRENT_COMMAND="clean"
     MOLE_CLEAN_CANCEL_STATUS=0
     export MOLE_CLEAN_CANCEL_STATUS
+    MOLE_CLEAN_CANCEL_SOURCE=""
+    export MOLE_CLEAN_CANCEL_SOURCE
     MOLE_CLEAN_SIZING_TIMEOUTS=0
     export MOLE_CLEAN_SIZING_TIMEOUTS
     MOLE_CLEAN_REMOVAL_TIMEOUTS=0
@@ -1672,9 +1676,11 @@ perform_cleanup() {
         if mole_rc_timeout_or_signal "$step_rc"; then
             MOLE_CLEAN_CANCEL_STATUS=$step_rc
             export MOLE_CLEAN_CANCEL_STATUS
+            _mole_note_clean_cancel_source "$step_name"
             return "$step_rc"
         fi
         if mole_rc_timeout_or_signal "$pending_clean_cancel"; then
+            _mole_note_clean_cancel_source "$step_name"
             return "$pending_clean_cancel"
         fi
         if [[ "$required" == "true" && $step_rc -ne 0 ]]; then
@@ -1846,13 +1852,26 @@ perform_cleanup() {
 
     local -a summary_details=()
     if [[ $cleanup_cancel_rc -ne 0 ]]; then
+        local cancel_source=""
+        cancel_source=$(mole_terminal_safe_text "${MOLE_CLEAN_CANCEL_SOURCE:-}")
+        local cancel_reason=""
         if mole_rc_timeout "$cleanup_cancel_rc"; then
-            summary_details+=("${GRAY}${ICON_WARNING}${NC} Cancelled: a scan or size check timed out (exit 124). Remaining cleanup was skipped.")
+            if [[ -n "$cancel_source" ]]; then
+                cancel_reason="Cancelled: $cancel_source timed out (exit $cleanup_cancel_rc)."
+            else
+                cancel_reason="Cancelled: a scan or size check timed out (exit $cleanup_cancel_rc)."
+            fi
         elif [[ $cleanup_cancel_rc -ge 128 ]]; then
-            summary_details+=("${GRAY}${ICON_WARNING}${NC} Cancelled: a cleanup step was interrupted (exit $cleanup_cancel_rc). Remaining cleanup was skipped.")
+            if [[ -n "$cancel_source" ]]; then
+                cancel_reason="Cancelled: $cancel_source was interrupted (exit $cleanup_cancel_rc)."
+            else
+                cancel_reason="Cancelled: a cleanup step was interrupted (exit $cleanup_cancel_rc)."
+            fi
         else
-            summary_details+=("${GRAY}${ICON_WARNING}${NC} A required cleanup step failed (exit $cleanup_cancel_rc). Remaining cleanup was skipped.")
+            cancel_reason="A required cleanup step failed (exit $cleanup_cancel_rc)."
         fi
+        summary_details+=("${GRAY}${ICON_WARNING}${NC} $cancel_reason Remaining cleanup was skipped.")
+        log_warning_to_file "$cancel_reason Section: ${CURRENT_SECTION:-unknown}."
     fi
 
     # Emit one "Free space" line, with the measured delta in parentheses when
```

**File**: `lib/clean/dev.sh` (modified, +18/-3)
```diff
@@ -44,13 +44,17 @@ clean_tool_cache() {
             note_activity
         elif ! mole_rc_timeout_or_signal "$command_rc" || mole_rc_timeout "$command_rc"; then
             # Routine owner failures stay in diagnostics, without a success
-            # row or activity marker. A timeout here skips this one tool.
+            # row or activity marker. A timeout here skips this one tool, and
+            # mole.log names it so a slow tool is not left to guesswork.
             debug_log "$description: owner command exited $command_rc: $*"
+            if mole_rc_timeout "$command_rc"; then
+                log_warning_to_file "$description timed out and was skipped: $*"
+            fi
         else
             # Ctrl-C while the owner command holds the terminal reaches only
             # the child. Record it and hand it back so no later owner command
             # starts.
-            _mole_record_clean_cancellation "$command_rc"
+            _mole_record_clean_cancellation "$command_rc" "$description"
             return "$command_rc"
         fi
     else
@@ -993,7 +997,17 @@ clean_go_cache_root() {
         note_activity
         return 0
     fi
+    if mole_rc_timeout "$command_status"; then
+        # Like every other owner command (clean_tool_cache), a timed-out `go
+        # clean` skips this one cache instead of cancelling unrelated cleanup.
+        # Go may already have removed part of the root, so say it stopped.
+        echo -e "  ${GRAY}${ICON_WARNING}${NC} ${display_name} · stopped (timed out)"
+        note_activity
+        log_warning_to_file "$display_name timed out after ${MOLE_TIMEOUT_PKG_CLEANUP_SEC}s and was skipped: go clean $clean_flag $physical_root"
+        return 0
+    fi
     if mole_rc_timeout_or_signal "$command_status"; then
+        _mole_record_clean_cancellation "$command_status" "$display_name"
         return "$command_status"
     fi
 
@@ -5386,12 +5400,13 @@ _run_developer_cleanup_step() {
     "$@" || step_rc=$?
     debug_timer_end "developer cleanup step: $step_name" _perf_step_start
     if mole_rc_timeout_or_signal "$step_rc"; then
-        _mole_record_clean_cancellation "$step_rc"
+        _mole_record_clean_cancellation "$step_rc" "$step_name"
         return "$step_rc"
     fi
 
     pending_clean_cancel="${MOLE_CLEAN_CANCEL_STATUS:-0}"
     if mole_rc_timeout_or_signal "$pending_clean_cancel"; then
+        _mole_note_clean_cancel_source "$step_name"
         return "$pending_clean_cancel"
     fi
     [[ "$strict" == "true" && $step_rc -ne 0 ]] && return "$step_rc"
```

**File**: `lib/core/file_ops.sh` (modified, +15/-1)
```diff
@@ -1404,18 +1404,32 @@ _record_file_ops_dry_run_target() {
 # Preserve the first timeout or signal observed by a clean deletion sink. Some
 # older cleanup families intentionally treat ordinary item failures as
 # best-effort; this sticky status prevents those `|| true` paths from turning a
-# user interrupt into permission to continue deleting later targets.
+# user interrupt into permission to continue deleting later targets. An
+# optional label names what was running; see _mole_note_clean_cancel_source.
 _mole_record_clean_cancellation() {
     local status="$1"
+    local source="${2:-}"
     if [[ "${MOLE_CURRENT_COMMAND:-}" == "clean" ]] && mole_rc_timeout_or_signal "$status"; then
         local existing="${MOLE_CLEAN_CANCEL_STATUS:-0}"
         if ! mole_rc_timeout_or_signal "$existing"; then
             MOLE_CLEAN_CANCEL_STATUS=$status
             export MOLE_CLEAN_CANCEL_STATUS
         fi
+        _mole_note_clean_cancel_source "$source"
     fi
 }
 
+# Name what a clean cancellation came from, so the summary and mole.log can say
+# what timed out instead of only the exit status. A cancellation unwinds from
+# the innermost caller outward, so the first label wins and the step runners
+# only fill the gap when nothing deeper knew a better name.
+_mole_note_clean_cancel_source() {
+    local source="${1:-}"
+    [[ -n "$source" && -z "${MOLE_CLEAN_CANCEL_SOURCE:-}" ]] || return 0
+    MOLE_CLEAN_CANCEL_SOURCE="$source"
+    export MOLE_CLEAN_CANCEL_SOURCE
+}
+
 # Safe wrapper around rm -rf with validation
 safe_remove() {
     local path="$1"
```

**File**: `lib/core/log.sh` (modified, +11/-0)
```diff
@@ -150,6 +150,17 @@ log_warning() {
     fi
 }
 
+# Record a warning in mole.log without printing it, for diagnostics the
+# terminal deliberately stays quiet about, such as a skipped owner timeout.
+log_warning_to_file() {
+    local timestamp
+    timestamp=$(get_timestamp)
+    append_log_line "$LOG_FILE" "[$timestamp] WARNING: $1"
+    if [[ "${MO_DEBUG:-}" == "1" ]]; then
+        append_log_line "$DEBUG_LOG_FILE" "[$timestamp] WARNING: $1"
+    fi
+}
+
 # shellcheck disable=SC2329
 log_error() {
     echo -e "${YELLOW}${ICON_ERROR}${NC} $1" >&2
```

**File**: `tests/clean_dev_caches.bats` (modified, +66/-4)
```diff
@@ -2995,7 +2995,61 @@ EOF
     [[ "$output" == *"build=1 module=0"* ]]
 }
 
-@test "clean_dev_go propagates owner cleanup cancellation" {
+@test "clean_dev_go skips a timed-out owner cleanup without cancelling" {
+    # A timed-out `go clean` is an owner command timeout, so like every
+    # clean_tool_cache owner it skips this cache instead of stopping all later
+    # cleanup. The build cache still runs and mole.log names what timed out.
+    local module_root="$HOME/go-module-timeout"
+    local build_root="$HOME/go-build-timeout"
+    local trace="$HOME/go-clean-timeout.trace"
+    mkdir -p "$module_root" "$build_root"
+    rm -f "$trace" "$HOME/Library/Logs/mole/mole.log"
+
+    run env HOME="$HOME" PROJECT_ROOT="$PROJECT_ROOT" \
+        GO_MODULE_ROOT="$module_root" GO_BUILD_ROOT="$build_root" GO_TRACE="$trace" \
+        /bin/bash --noprofile --norc <<'EOF'
+set -euo pipefail
+source "$PROJECT_ROOT/lib/core/common.sh"
+source "$PROJECT_ROOT/lib/clean/dev.sh"
+DRY_RUN=false
+MOLE_CURRENT_COMMAND=clean
+MOLE_CLEAN_CANCEL_STATUS=0
+go() { :; }
+run_with_timeout() {
+    shift
+    if [[ "$1" == "go" && "$2" == "env" ]]; then
+        if [[ "$3" == "GOMODCACHE" ]]; then
+            printf '%s\n' "$GO_MODULE_ROOT"
+        else
+            printf '%s\n' "$GO_BUILD_ROOT"
+        fi
+        return 0
+    fi
+    printf '%s\n' "$*" >> "$GO_TRACE"
+    [[ "$*" == *"-modcache"* ]] && return 124
+    return 0
+}
+is_path_whitelisted() { return 1; }
+should_protect_path() { return 1; }
+go_cache_process_state() { return 1; }
+note_activity() { :; }
+clean_rc=0
+clean_dev_go || clean_rc=$?
+printf 'rc=%s\n' "$clean_rc"
+printf 'CANCEL=%s\n' "${MOLE_CLEAN_CANCEL_STATUS:-0}"
+EOF
+
+    [ "$status" -eq 0 ] || { echo "$output"; return 1; }
+    [[ "$output" == *"rc=0"* ]] || return 1
+    [[ "$output" == *"CANCEL=0"* ]] || return 1
+    [[ "$output" == *"Go module cache · stopped (timed out)"* ]] || return 1
+    grep -qFx "env GOCACHE=$build_root go clean -cache" "$trace" || return 1
+    grep -qF "Go module cache timed out after" "$HOME/Library/Logs/mole/mole.log" || return 1
+    rm -f "$trace"
+    rm -rf "$module_root" "$build_root"
+}
+
+@test "clean_dev_go propagates an interrupted owner cleanup" {
     local module_root="$HOME/go-module-cancel"
     mkdir -p "$module_root"
 
@@ -3005,14 +3059,16 @@ set -euo pipefail
 source "$PROJECT_ROOT/lib/core/common.sh"
 source "$PROJECT_ROOT/lib/clean/dev.sh"
 DRY_RUN=false
+MOLE_CURRENT_COMMAND=clean
+MOLE_CLEAN_CANCEL_STATUS=0
 go() { :; }
 run_with_timeout() {
     shift
     if [[ "$1" == "go" && "$2" == "env" ]]; then
         [[ "$3" == "GOMODCACHE" ]] && printf '%s\n' "$GO_MODULE_ROOT" || return 1
         return 0
     fi
-    return 124
+    return 130
 }
 is_path_whitelisted() { return 1; }
 should_protect_path() { return 1; }
@@ -3021,10 +3077,14 @@ note_activity() { :; }
 clean_rc=0
 clean_dev_go || clean_rc=$?
 printf 'rc=%s\n' "$clean_rc"
+printf 'CANCEL=%s\n' "${MOLE_CLEAN_CANCEL_STATUS:-0}"
+printf 'SOURCE=%s\n' "${MOLE_CLEAN_CANCEL_SOURCE:-}"
 EOF
 
     [ "$status" -eq 0 ] || { echo "$output"; return 1; }
-    [[ "$output" == *"rc=124"* ]] || return 1
+    [[ "$output" == *"rc=130"* ]] || return 1
+    [[ "$output" == *"CANCEL=130"* ]] || return 1
+    [[ "$output" == *"SOURCE=Go module cache"* ]] || return 1
     rm -rf "$module_root"
 }
 
@@ -3894,7 +3954,9 @@ EOF
     [[ "$output" != *"failing cache"* ]] || return 1
     [[ "$output" != *"slow cache"* ]] || return 1
     [[ "$output" == *"ACTIVITIES=1"* ]] || return 1
-    [[ "$output" == *"CANCEL=0"* ]]
+    [[ "$output" == *"CANCEL=0"* ]] || return 1
+    grep -qF "WARNING: slow cache timed out and was skipped: owner_timeout" \
+        "$HOME/Library/Logs/mole/mole.log"
 }
 
 @test "an interrupted owner command stops the next pnpm store before its probe or prune" {
```

**File**: `tests/clean_summary_cancel.bats` (modified, +40/-0)
```diff
@@ -96,6 +96,46 @@ EOF
     [[ "$output" == *"Remaining cleanup was skipped"* ]]
 }
 
+@test "a timeout names the cancelled step in the summary and mole.log" {
+    run_perform_cleanup_with 124
+
+    [ "$status" -eq 124 ] || { echo "$output"; return 1; }
+    [[ "$output" == *"Cancelled: clean_user_essentials timed out (exit 124)."* ]] || return 1
+    grep -qF "WARNING: Cancelled: clean_user_essentials timed out (exit 124). Section: User essentials." \
+        "$HOME/Library/Logs/mole/mole.log"
+}
+
+@test "the innermost cancellation label wins over the step name" {
+    run env HOME="$HOME" PROJECT_ROOT="$PROJECT_ROOT" \
+        /bin/bash --noprofile --norc << 'EOF'
+set -euo pipefail
+source "$PROJECT_ROOT/bin/clean.sh"
+for fn in clean_user_essentials clean_finder_metadata clean_app_caches \
+    clean_browsers run_cloud_and_office_cleanup clean_developer_tools \
+    clean_user_gui_applications clean_virtualization_tools \
+    clean_application_support_logs clean_orphaned_app_data \
+    clean_orphaned_system_services clean_orphaned_container_stubs \
+    show_user_launch_agent_hint_notice \
+    clean_apple_silicon_caches clean_cached_device_firmware \
+    clean_time_machine_failed_backups check_large_file_candidates \
+    show_project_artifact_hint_notice; do
+    eval "$fn() { return 0; }"
+done
+clean_app_caches() {
+    MOLE_CURRENT_COMMAND=clean
+    _mole_record_clean_cancellation 124 "Slow owner cache"
+    return 124
+}
+perform_cleanup
+EOF
+
+    [ "$status" -eq 124 ] || { echo "$output"; return 1; }
+    [[ "$output" == *"Cancelled: Slow owner cache timed out (exit 124)."* ]] || return 1
+    [[ "$output" != *"clean_app_caches timed out"* ]] || return 1
+    grep -qF "WARNING: Cancelled: Slow owner cache timed out (exit 124). Section: App caches." \
+        "$HOME/Library/Logs/mole/mole.log"
+}
+
 @test "interrupted section (>=128) prints an interrupted summary" {
     run_perform_cleanup_with 130
 
```

---

### Incident Patch 2: `4ab50c73` (2026-10-06)
**Commit Message**: fix(clean): keep the DiagnosticReports directory when cleaning user logs (#1690)

`~/Library/Logs/*` matched DiagnosticReports as a whole directory and
removed it. macOS's crash-report helper cannot recreate it under its
sandbox, so later crash reports were dropped ("Destination unavailable").

Skip the directory itself and clean only the files inside it. Still a
single safe_clean call, so dry-run, Trash routing, whitelist and logging
are unchanged.

Fixes #1689

**File**: `lib/clean/user.sh` (modified, +9/-1)
```diff
@@ -231,7 +231,15 @@ clean_user_essentials() {
     fi
     stop_section_spinner
 
-    safe_clean ~/Library/Logs/* "User app logs"
+    # Keep the DiagnosticReports directory itself: macOS cannot recreate it
+    # under the sandbox, so removing it silently disables crash reporting (#1689).
+    local -a user_log_targets=()
+    local log_entry
+    for log_entry in ~/Library/Logs/* ~/Library/Logs/DiagnosticReports/*; do
+        [[ "$log_entry" == "$HOME/Library/Logs/DiagnosticReports" ]] && continue
+        user_log_targets+=("$log_entry")
+    done
+    safe_clean "${user_log_targets[@]}" "User app logs"
 
     if [[ "${MOLE_SKIP_TRASH_CLEANUP:-0}" != "1" ]]; then
         clean_trash
```

**File**: `tests/clean_user_core.bats` (modified, +25/-1)
```diff
@@ -164,7 +164,7 @@ source "$PROJECT_ROOT/lib/core/common.sh"
 source "$PROJECT_ROOT/lib/clean/user.sh"
 start_section_spinner() { :; }
 stop_section_spinner() { :; }
-safe_clean() { echo "SAFE:$2"; }
+safe_clean() { echo "SAFE:${!#}"; }
 clean_trash() { echo "TRASH"; }
 _clean_recent_items() { :; }
 _clean_mail_downloads() { :; }
@@ -489,6 +489,30 @@ EOF
     rm -rf "$test_home"
 }
 
+@test "clean_user_essentials keeps the DiagnosticReports directory (#1689)" {
+    local test_home="$HOME/diag-home"
+    mkdir -p "$test_home/Library/Logs/DiagnosticReports"
+    touch "$test_home/Library/Logs/DiagnosticReports/App.ips"
+
+    run env HOME="$test_home" PROJECT_ROOT="$PROJECT_ROOT" MOLE_TEST_NO_AUTH=1 \
+        /bin/bash --noprofile --norc <<'EOF'
+set -euo pipefail
+source "$PROJECT_ROOT/bin/clean.sh"
+DRY_RUN=false
+start_section_spinner() { :; }
+stop_section_spinner() { :; }
+clean_trash() { :; }
+_clean_recent_items() { :; }
+_clean_mail_downloads() { :; }
+clean_user_essentials
+EOF
+
+    [ "$status" -eq 0 ] || return 1
+    [[ -d "$test_home/Library/Logs/DiagnosticReports" ]] || return 1
+    [[ ! -e "$test_home/Library/Logs/DiagnosticReports/App.ips" ]] || return 1
+    rm -rf "$test_home"
+}
+
 @test "a custom whitelist still protects system caches, Poetry virtualenvs and the renv cache" {
     # clean_user_essentials sweeps every child of ~/Library/Caches, and
     # load_mole_whitelist replaces DEFAULT_WHITELIST_PATTERNS wholesale once a
```

---

### Incident Patch 3: `e3f2e3bd` (2026-10-05)
**Commit Message**: fix(analyze): count Library hardlinks once in overview

Use one du traversal for Library so hardlinks across child directories share an inode set. Invalidate cached totals from the parallel measurement and cover hardlink accounting and old cache schemas with regression tests.

**File**: `cmd/analyze/analyze_test.go` (modified, +5/-5)
```diff
@@ -4152,9 +4152,9 @@ func TestUnavailableEntryCannotBeSelectedForDeletion(t *testing.T) {
 	}
 }
 
-func TestSchemaFiveSizesAreRejectedByEveryLoader(t *testing.T) {
+func TestOldSchemaSizesAreRejectedByEveryLoader(t *testing.T) {
 	for _, loader := range []string{"fresh", "stale", "overview-gob", "overview-json"} {
-		for _, version := range []int{5, cacheSchemaVersion} {
+		for _, version := range []int{5, 6, cacheSchemaVersion} {
 			t.Run(fmt.Sprintf("%s/schema%d", loader, version), func(t *testing.T) {
 				home := t.TempDir()
 				t.Setenv("HOME", home)
@@ -4203,10 +4203,10 @@ func TestSchemaFiveSizesAreRejectedByEveryLoader(t *testing.T) {
 				case "overview-json":
 					_, _, err = loadStoredOverviewMeasurement(target)
 				}
-				if version == 5 && err == nil {
-					t.Fatal("schema 5 stale sizes were accepted")
+				if version <= 6 && err == nil {
+					t.Fatalf("schema %d stale sizes were accepted", version)
 				}
-				if version != 5 && err != nil {
+				if version > 6 && err != nil {
 					t.Fatalf("current schema rejected: %v", err)
 				}
 			})
```

**File**: `cmd/analyze/cache.go` (modified, +2/-1)
```diff
@@ -30,7 +30,8 @@ import (
 // v5: entries record their scan state, so a partial result lost only to
 // permission denials can be cached and still reads as partial.
 // v6: deletions invalidate ancestor totals and overview measurements.
-const cacheSchemaVersion = 6
+// v7: Library overview totals count cross-directory hardlinks once again.
+const cacheSchemaVersion = 7
 
 type overviewSizeSnapshot struct {
 	Size          int64     `json:"size"`
```

**File**: `cmd/analyze/scanner.go` (modified, +2/-16)
```diff
@@ -1055,14 +1055,6 @@ func getDirectorySizeFromDuWithExcludeAndIgnores(ctx context.Context, path strin
 		return kb * 1024, nil
 	}
 
-	// One serial du over ~/Library routinely outlives duTimeout, so measure it
-	// per child like Home. The ignored names must also be skipped as immediate
-	// children: du given an operand matching its own -I prints nothing, which
-	// runDuSize reports as a failure. Deeper matches still go through -I.
-	if excludePath == "" && isUserLibraryPath(path) {
-		return getDirectorySizeFromDuSkippingImmediateChild(ctx, path, "", ignoreNames, runDuSize)
-	}
-
 	// When excluding a path (e.g., ~/Library), subtract only that exact directory instead of ignoring every "Library"
 	if excludePath != "" {
 		if filepath.Dir(filepath.Clean(excludePath)) == filepath.Clean(path) {
@@ -1086,6 +1078,7 @@ func getDirectorySizeFromDuWithExcludeAndIgnores(ctx context.Context, path strin
 		return totalSize - excludeSize, nil
 	}
 
+	// Library needs one traversal so cross-directory hardlinks count once.
 	return runDuSize(path)
 }
 
@@ -1136,14 +1129,7 @@ func overviewIgnoreNamesForPath(path string) []string {
 	return ignoreNames
 }
 
-func isUserLibraryPath(path string) bool {
-	home := os.Getenv("HOME")
-	return home != "" && filepath.IsAbs(home) && filepath.Clean(path) == filepath.Join(home, "Library")
-}
-
-// overviewChildDuSem caps the per-child du processes that every overview
-// measurement shares, so measuring Home and ~/Library together runs no more
-// du processes than Home alone did with its own pool.
+// overviewChildDuSem caps concurrent per-child Home measurements.
 var overviewChildDuSem = make(chan struct{}, min(max(runtime.NumCPU()*2, 2), 8))
 
 // getDirectorySizeFromDuSkippingImmediateChild runs du once per immediate
```

**File**: `cmd/analyze/scanner_test.go` (modified, +35/-10)
```diff
@@ -9,7 +9,7 @@ import (
 	"os"
 	"os/exec"
 	"path/filepath"
-	"slices"
+	"strconv"
 	"strings"
 	"sync/atomic"
 	"testing"
@@ -83,7 +83,7 @@ func TestGetDirectorySizeFromDuSkippingImmediateChildDoesNotMeasureExcludedPath(
 	}
 }
 
-func TestGetDirectorySizeFromDuMeasuresUserLibraryPerChild(t *testing.T) {
+func TestGetDirectorySizeFromDuMeasuresUserLibraryInOneTraversal(t *testing.T) {
 	home := t.TempDir()
 	t.Setenv("HOME", home)
 	library := filepath.Join(home, "Library")
@@ -121,14 +121,8 @@ func TestGetDirectorySizeFromDuMeasuresUserLibraryPerChild(t *testing.T) {
 		t.Fatalf("read du operands: %v", err)
 	}
 	got := strings.Split(strings.TrimSpace(string(data)), "\n")
-	want := []string{
-		filepath.Join(library, "Application Support"),
-		filepath.Join(library, "Caches"),
-		filepath.Join(library, "Containers"),
-	}
-	slices.Sort(got)
-	if !slices.Equal(got, want) {
-		t.Fatalf("expected one du per child directory except Mobile Documents, got %q", got)
+	if len(got) != 1 || got[0] != library {
+		t.Fatalf("expected one Library traversal for shared hardlink accounting, got %q", got)
 	}
 }
 
@@ -437,3 +431,34 @@ func TestOverviewMeasurementStoresDenialOnlyPartial(t *testing.T) {
 		t.Fatalf("cancellation lost: %v", err)
 	}
 }
+
+func TestUserLibraryOverviewDeduplicatesHardlinks(t *testing.T) {
+	home := t.TempDir()
+	t.Setenv("HOME", home)
+	library := filepath.Join(home, "Library")
+	original := filepath.Join(library, "Application Support", "payload")
+	writeFileWithSize(t, original, 1024*1024)
+	for _, link := range []string{filepath.Join(library, "Caches", "payload"), filepath.Join(library, "top-link")} {
+		if err := os.MkdirAll(filepath.Dir(link), 0755); err != nil {
+			t.Fatal(err)
+		}
+		if err := os.Link(original, link); err != nil {
+			t.Fatal(err)
+		}
+	}
+	out, err := exec.Command("/usr/bin/du", "-skPx", library).Output()
+	if err != nil {
+		t.Fatal(err)
+	}
+	kb, err := strconv.ParseInt(strings.Fields(string(out))[0], 10, 64)
+	if err != nil {
+		t.Fatal(err)
+	}
+	got, err := getDirectorySizeFromDuWithExcludeAndIgnores(context.Background(), library, "", nil)
+	if err != nil {
+		t.Fatal(err)
+	}
+	if got != kb*1024 {
+		t.Fatalf("Library size = %d, single du = %d; hardlinks must count once", got, kb*1024)
+	}
+}
```

---

### Incident Patch 4: `5beaf0c9` (2026-10-05)
**Commit Message**: fix(optimize): skip DNS flush under an active VPN

Both DNS & Spotlight Check and Network Cache Refresh sent SIGHUP to
mDNSResponder with no VPN gate. VPN clients that watch DNS configuration,
such as WireGuard, read that as a network change and reconnect on every
optimize run; Mole Mac hit this with a paying user and dropped the task.

flush_dns_cache now asks has_active_vpn_interface first. An active VPN
skips the flush and reports skipped; an unknown VPN state also skips and
reports failed, matching Network Stack Refresh, since the probe could not
rule a VPN out. Dry-run previews the same decision. MOLE_DNS_FLUSHED is
still set only after a real or previewed flush, so the second task never
claims work the first one skipped.

SIGHUP purges the resolver cache without restarting the process, so the
"mDNSResponder restarted" lines are dropped.

A Mac with no default route (offline) used to read as "VPN state unknown"
and would now fail both DNS tasks, so a missing default route counts as no
VPN; other route errors stay unknown. The health JSON description no longer
says the task restarts mDNSResponder (contract hash updated, only that line
changed). The VPN probe tests now load comm

**File**: `lib/optimize/catalog.sh` (modified, +1/-1)
```diff
@@ -42,7 +42,7 @@ _optimize_catalog_register fix_broken_configs opt_fix_broken_configs \
     "Fix corrupted preferences files" true
 _optimize_catalog_register network_optimization opt_network_optimization \
     "Network Cache Refresh" "Network Cache Refresh" \
-    "Optimize DNS cache & restart mDNSResponder" true
+    "Refresh DNS cache" true
 _optimize_catalog_register sqlite_vacuum opt_sqlite_vacuum \
     "Database Optimization" "Database Optimization" \
     "Compress SQLite databases for Mail, Safari & Messages (skips if apps are running)" true
```

**File**: `lib/optimize/tasks.sh` (modified, +56/-19)
```diff
@@ -137,8 +137,13 @@ has_active_vpn_interface() {
     fi
     local route_output=""
     local route_status=0
-    route_output=$(LC_ALL=C run_with_timeout "$MOLE_TIMEOUT_SHORT_QUERY_SEC" route -n get default 2> /dev/null) || route_status=$?
+    route_output=$(LC_ALL=C run_with_timeout "$MOLE_TIMEOUT_SHORT_QUERY_SEC" route -n get default 2>&1) || route_status=$?
     if [[ $route_status -ne 0 ]]; then
+        # No default route at all (offline): no full-tunnel VPN can be
+        # routing traffic, so that is a known "none", not an unknown state.
+        if [[ "$route_output" == *"not in table"* ]]; then
+            return 1
+        fi
         return 2
     fi
     local default_iface
@@ -151,7 +156,21 @@ has_active_vpn_interface() {
     return 1
 }
 
+# Return 0 when the DNS cache was flushed (or would be in dry-run), 1 when the
+# flush failed or admin access is missing, 2 when an active VPN skipped it, and
+# 3 when the VPN state is unknown. SIGHUP makes mDNSResponder drop its cache,
+# and VPN clients that watch DNS configuration (WireGuard and similar) treat
+# that as a network change and reconnect. An unknown state also skips, like
+# opt_network_stack_optimize, because the probe could not rule a VPN out.
 flush_dns_cache() {
+    local vpn_status=0
+    has_active_vpn_interface || vpn_status=$?
+    case "$vpn_status" in
+        0) return 2 ;;
+        1) ;;
+        *) return 3 ;;
+    esac
+
     if [[ "${MOLE_DRY_RUN:-0}" == "1" ]]; then
         MOLE_DNS_FLUSHED=1
         return 0
@@ -176,11 +195,13 @@ opt_system_maintenance() {
         return 0
     fi
 
-    local dns_flushed="false"
-    if flush_dns_cache; then
-        opt_msg "DNS cache flushed"
-        dns_flushed="true"
-    fi
+    local dns_status=0
+    flush_dns_cache || dns_status=$?
+    case "$dns_status" in
+        0) opt_msg "DNS cache flushed" ;;
+        2) opt_msg "DNS cache flush skipped, active VPN detected" ;;
+        3) echo -e "  ${YELLOW}${ICON_WARNING}${NC} Failed to inspect active VPN state" ;;
+    esac
 
     local spotlight_status=""
     local spotlight_failed=0
@@ -195,8 +216,13 @@ opt_system_maintenance() {
 
     local applied=0
     local failed="$spotlight_failed"
-    [[ "$dns_flushed" == "true" ]] && applied=1 || failed=$((failed + 1))
-    optimize_task_result_from_counts "$applied" "$failed"
+    local skipped=0
+    case "$dns_status" in
+        0) applied=1 ;;
+        2) skipped=1 ;;
+        *) failed=$((failed + 1)) ;;
+    esac
+    optimize_task_result_from_counts "$applied" "$failed" "$skipped"
 }
 
 # Refresh Finder caches (QuickLook/icon services).
@@ -417,15 +443,14 @@ opt_fix_broken_configs() {
 # DNS cache refresh.
 opt_network_optimization() {
     if [[ "${MO_DEBUG:-}" == "1" ]]; then
-        debug_operation_start "Network Optimization" "Refresh DNS cache and restart mDNSResponder"
-        debug_operation_detail "Method" "Flush DNS cache via dscacheutil and killall mDNSResponder"
+        debug_operation_start "Network Optimization" "Refresh DNS cache"
+        debug_operation_detail "Method" "dscacheutil -flushcache, then SIGHUP to mDNSResponder (skipped under an active VPN)"
         debug_operation_detail "Expected outcome" "Faster DNS resolution, fixed network connectivity issues"
         debug_risk_level "LOW" "DNS cache is automatically rebuilt"
     fi
 
     if [[ "${MOLE_DNS_FLUSHED:-0}" == "1" ]]; then
         opt_msg "DNS cache already refreshed"
-        opt_msg "mDNSResponder already restarted"
         optimize_task_result "$MOLE_OPTIMIZE_OUTCOME_UNCHANGED"
         return 0
     fi
@@ -436,14 +461,26 @@ opt_network_optimization() {
         return 0
     fi
 
-    if flush_dns_cache; then
-        opt_msg "DNS cache refreshed"
-        opt_msg "mDNSResponder restarted"
-        optimize_task_result "$MOLE_OPTIMIZE_OUTCOME_APPLIED"
-    else
-        echo -e "  ${YELLOW}${ICON_WARNING}${NC} Failed to refresh DNS cache"
-        optimize_task_result "$MOLE_OPTIMIZE_OUTCOME_FAILED"
-    fi
+    local dns_status=0
+    flush_dns_cache || dns_status=$?
+    case "$dns_status" in
+        0)
+            opt_msg "DNS cache refreshed"
+            optimize_task_result "$MOLE_OPTIMIZE_OUTCOME_APPLIED"
+            ;;
+        2)
+            opt_msg "DNS cache refresh skipped, active VPN detected"
+            optimize_task_result "$MOLE_OPTIMIZE_OUTCOME_SKIPPED"
+            ;;
+        3)
+            echo -e "  ${YELLOW}${ICON_WARNING}${NC} Failed to inspect active VPN state"
+            optimize_task_result "$MOLE_OPTIMIZE_OUTCOME_FAILED"
+            ;;
+        *)
+            echo -e "  ${YELLOW}${ICON_WARNING}${NC} Failed to refresh DNS cache"
+            optimize_task_result "$MOLE_OPTIMIZE_OUTCOME_FAILED"
+            ;;
+    esac
 }
 
 # Quarantine database cleanup (Gatekeeper download history).
```

**File**: `tests/optimize.bats` (modified, +140/-3)
```diff
@@ -115,7 +115,94 @@ EOF
 
 	[ "$status" -eq 0 ]
 	[[ "$output" == *"DNS cache refreshed"* ]] || return 1
-	[[ "$output" == *"mDNSResponder restarted"* ]]
+	[[ "$output" != *"mDNSResponder"* ]]
+}
+
+@test "DNS flush is skipped in both optimize tasks while a VPN is active" {
+	run env HOME="$HOME" PROJECT_ROOT="$PROJECT_ROOT" MOLE_ASSUME_VPN_ACTIVE=1 MOLE_OPTIMIZE_SUDO_AVAILABLE=true MOLE_DRY_RUN=0 /bin/bash --noprofile --norc <<'EOF'
+set -euo pipefail
+source "$PROJECT_ROOT/lib/core/common.sh"
+source "$PROJECT_ROOT/lib/optimize/tasks.sh"
+unset MOLE_TEST_NO_AUTH MOLE_TEST_MODE
+sudo() { echo "UNEXPECTED_SUDO:$*"; return 0; }
+mdutil() { echo "Indexing enabled."; }
+
+execute_optimization system_maintenance
+execute_optimization network_optimization
+[[ "$(optimize_outcome_count skipped)" == "2" ]] || exit 1
+[[ "$(optimize_outcome_count applied)" == "0" ]] || exit 1
+[[ "$(optimize_outcome_count failed)" == "0" ]] || exit 1
+[[ "${MOLE_DNS_FLUSHED:-0}" == "0" ]] || exit 1
+EOF
+
+	[[ "$status" -eq 0 ]] || { echo "$output"; return 1; }
+	[[ "$output" == *"DNS cache flush skipped, active VPN detected"* ]] || return 1
+	[[ "$output" == *"DNS cache refresh skipped, active VPN detected"* ]] || return 1
+	[[ "$output" != *"UNEXPECTED_SUDO"* ]] || return 1
+	[[ "$output" != *"already refreshed"* ]]
+}
+
+@test "dry-run previews the VPN skip instead of a DNS flush" {
+	run env HOME="$HOME" PROJECT_ROOT="$PROJECT_ROOT" MOLE_ASSUME_VPN_ACTIVE=1 MOLE_DRY_RUN=1 /bin/bash --noprofile --norc <<'EOF'
+set -euo pipefail
+source "$PROJECT_ROOT/lib/core/common.sh"
+source "$PROJECT_ROOT/lib/optimize/tasks.sh"
+mdutil() { echo "Indexing enabled."; }
+
+execute_optimization system_maintenance
+execute_optimization network_optimization
+[[ "$(optimize_outcome_count skipped)" == "2" ]] || exit 1
+EOF
+
+	[[ "$status" -eq 0 ]] || { echo "$output"; return 1; }
+	[[ "$output" == *"DNS cache flush skipped, active VPN detected"* ]] || return 1
+	[[ "$output" != *"DNS cache flushed"* ]] || return 1
+	[[ "$output" != *"DNS cache refreshed"* ]]
+}
+
+@test "DNS flush runs once without a VPN and the second task reports it unchanged" {
+	run env HOME="$HOME" PROJECT_ROOT="$PROJECT_ROOT" MOLE_ASSUME_VPN_ACTIVE=0 MOLE_OPTIMIZE_SUDO_AVAILABLE=true MOLE_DRY_RUN=0 /bin/bash --noprofile --norc <<'EOF'
+set -euo pipefail
+source "$PROJECT_ROOT/lib/core/common.sh"
+source "$PROJECT_ROOT/lib/optimize/tasks.sh"
+unset MOLE_TEST_NO_AUTH MOLE_TEST_MODE
+sudo() { echo "SUDO:$*"; return 0; }
+mdutil() { echo "Indexing enabled."; }
+
+execute_optimization system_maintenance
+execute_optimization network_optimization
+[[ "$(optimize_outcome_count applied)" == "1" ]] || exit 1
+[[ "$(optimize_outcome_count unchanged)" == "1" ]] || exit 1
+EOF
+
+	[[ "$status" -eq 0 ]] || { echo "$output"; return 1; }
+	[[ "$output" == *"SUDO:dscacheutil -flushcache"* ]] || return 1
+	[[ "$output" == *"SUDO:killall -HUP mDNSResponder"* ]] || return 1
+	[[ "$(grep -c 'SUDO:dscacheutil -flushcache' <<< "$output")" == "1" ]] || return 1
+	[[ "$output" == *"DNS cache flushed"* ]] || return 1
+	[[ "$output" == *"DNS cache already refreshed"* ]] || return 1
+	[[ "$output" != *"restarted"* ]]
+}
+
+@test "DNS flush fails closed when the VPN state cannot be determined" {
+	run env HOME="$HOME" PROJECT_ROOT="$PROJECT_ROOT" MOLE_OPTIMIZE_SUDO_AVAILABLE=true MOLE_DRY_RUN=0 /bin/bash --noprofile --norc <<'EOF'
+set -euo pipefail
+source "$PROJECT_ROOT/lib/core/common.sh"
+source "$PROJECT_ROOT/lib/optimize/tasks.sh"
+unset MOLE_TEST_NO_AUTH MOLE_TEST_MODE MOLE_ASSUME_VPN_ACTIVE
+has_active_vpn_interface() { return 2; }
+sudo() { echo "UNEXPECTED_SUDO:$*"; return 0; }
+mdutil() { echo "Indexing enabled."; }
+
+execute_optimization system_maintenance
+execute_optimization network_optimization
+[[ "$(optimize_outcome_count failed)" == "2" ]] || exit 1
+[[ "$(optimize_outcome_count applied)" == "0" ]] || exit 1
+EOF
+
+	[[ "$status" -eq 0 ]] || { echo "$output"; return 1; }
+	[[ "$(grep -c 'Failed to inspect active VPN state' <<< "$output")" == "2" ]] || return 1
+	[[ "$output" != *"UNEXPECTED_SUDO"* ]]
 }
 
 @test "fix_broken_preferences repairs only non-Apple preference plists" {
@@ -1802,7 +1889,9 @@ EOF
 @test "flush_dns_cache does not invoke sudo under MOLE_TEST_NO_AUTH" {
 	# Reproduces the reported regression: ad-hoc flush_dns_cache under test
 	# mode used to fall through optimize_sudo_available and reach `sudo dscacheutil`.
-	run env HOME="$HOME" PROJECT_ROOT="$PROJECT_ROOT" MOLE_TEST_NO_AUTH=1 /bin/bash --noprofile --norc <<'EOF'
+	# Pin "no VPN": on a host routing through utun the VPN gate would return
+	# first and this test would pass without reaching the sudo guard.
+	run env HOME="$HOME" PROJECT_ROOT="$PROJECT_ROOT" MOLE_TEST_NO_AUTH=1 MOLE_ASSUME_VPN_ACTIVE=0 /bin/bash --noprofile --norc <<'EOF'
 set -euo pipefail
 source "$PROJECT_ROOT/lib/core/common.sh"
 source "$PROJECT_ROOT/lib/optimize/tasks.sh"
@@ -1920,6 +2009,7 @@ EOF
 @test "has_active_vpn_interface respects M
```

**File**: `tests/optimize_catalog.bats` (modified, +2/-2)
```diff
@@ -84,7 +84,7 @@ system_maintenance|opt_system_maintenance|DNS & Spotlight Check|DNS & Spotlight
 cache_refresh|opt_cache_refresh|Finder Cache Refresh|Finder Cache Refresh|Refresh QuickLook thumbnails & icon services cache|true
 saved_state_cleanup|opt_saved_state_cleanup|App State Cleanup|App State Cleanup|Remove old saved application states (30+ days)|true
 fix_broken_configs|opt_fix_broken_configs|Broken Config Repair|Broken Config Repair|Fix corrupted preferences files|true
-network_optimization|opt_network_optimization|Network Cache Refresh|Network Cache Refresh|Optimize DNS cache & restart mDNSResponder|true
+network_optimization|opt_network_optimization|Network Cache Refresh|Network Cache Refresh|Refresh DNS cache|true
 sqlite_vacuum|opt_sqlite_vacuum|Database Optimization|Database Optimization|Compress SQLite databases for Mail, Safari & Messages (skips if apps are running)|true
 prevent_network_dsstore|opt_prevent_network_dsstore|Prevent Finder .DS_Store|Prevent Finder .DS_Store|Set a persistent Finder preference to stop writing .DS_Store on SMB/AFP/NFS and USB volumes|true
 legacy_overrides_audit|opt_legacy_overrides_audit|Legacy Overrides|Legacy Overrides|Remove hidden App Nap and disk-image verification overrides left by old tweak tools|true
@@ -148,7 +148,7 @@ contract_hash=$(
         shasum -a 256 |
         awk '{print $1}'
 )
-expected_hash="dc42553fcae1b1d1ebf768d3cfec6d8c0171140dd5a2a532ebacfee91d27146f"
+expected_hash="f90bfe44f54c07e7b2e5d257a392b92fb7b62a7581b2d8ded9499036330a8069"
 if [[ "$contract_hash" != "$expected_hash" ]]; then
     echo "health optimization contract hash: expected $expected_hash, got $contract_hash"
     exit 1
```

---

### Incident Patch 5: `0518facf` (2026-10-05)
**Commit Message**: fix(clean): preview every Trash item a real clean empties

The Trash dry run validated each item before sizing it and then let the
recorder apply should_protect_path again, without the #1517 top-level
Trash exemption the real sink uses, so items such as input method plists
were emptied for real but missing from the preview count. Validate once
after sizing with the sink's own predicate and mark the record
prevalidated. A validation timeout or signal now stops the step like any
other cancellation instead of silently skipping the item.

**File**: `lib/clean/user.sh` (modified, +17/-2)
```diff
@@ -61,8 +61,7 @@ clean_trash() {
                 [[ -e "$trash_item" ]] || continue
                 if is_path_whitelisted "$trash_item" 2> /dev/null ||
                     (declare -f holds_compiled_model_cache > /dev/null 2>&1 &&
-                        holds_compiled_model_cache "$trash_item" 2> /dev/null) ||
-                    ! validate_path_for_deletion "$trash_item" 2> /dev/null; then
+                        holds_compiled_model_cache "$trash_item" 2> /dev/null); then
                     continue
                 fi
                 local trash_item_kb
@@ -71,7 +70,23 @@ clean_trash() {
                 [[ $size_rc -eq 0 ]] || _mole_record_clean_cancellation "$size_rc"
                 [[ $size_rc -eq 0 ]] || return "$size_rc"
                 [[ "$trash_item_kb" =~ ^[0-9]+$ ]] || trash_item_kb=0
+                if (declare -f holds_compiled_model_cache > /dev/null 2>&1 &&
+                    holds_compiled_model_cache "$trash_item" 2> /dev/null); then
+                    continue
+                fi
+                # Same final predicate as the real sink, including the #1517
+                # top-level Trash exemption, run after sizing so live-owner and
+                # SQLite state is current. The recorder then skips its own
+                # should_protect_path pass, which lacks that exemption.
+                local validate_rc=0
+                validate_path_for_deletion "$trash_item" 2> /dev/null || validate_rc=$?
+                if mole_rc_timeout_or_signal "$validate_rc"; then
+                    _mole_record_clean_cancellation "$validate_rc"
+                    return "$validate_rc"
+                fi
+                [[ $validate_rc -eq 0 ]] || continue
                 if declare -f record_dry_run_cleanup_target > /dev/null 2>&1; then
+                    local _MOLE_DRY_RUN_TARGET_PREVALIDATED=true
                     record_dry_run_cleanup_target "$trash_item" "$trash_item_kb" 1 true || continue
                 fi
                 preview_count=$((preview_count + 1))
```

**File**: `tests/clean_user_core.bats` (modified, +66/-0)
```diff
@@ -688,6 +688,72 @@ EOF
     [[ ! -d "$HOME/.Trash/Input Methods" ]]
 }
 
+@test "clean_trash dry run previews protected-name Trash items real mode empties (#1517)" {
+    rm -rf "$HOME/.Trash" # SAFE: reset this test's temporary HOME fixture before populating it
+    mkdir -p "$HOME/.Trash/Input Methods"
+    touch "$HOME/.Trash/com.sogou.inputmethod.sogou.plist"
+    touch "$HOME/.Trash/com.tencent.inputmethod.QQInput.plist"
+
+    run env HOME="$HOME" PROJECT_ROOT="$PROJECT_ROOT" /bin/bash --noprofile --norc << 'EOF'
+set -euo pipefail
+source "$PROJECT_ROOT/lib/core/common.sh"
+source "$PROJECT_ROOT/lib/clean/user.sh"
+eval "$(awk '/^register_dry_run_cleanup_target\(\)/,/^}/' "$PROJECT_ROOT/bin/clean.sh")"
+eval "$(awk '/^record_dry_run_cleanup_target\(\)/,/^}/' "$PROJECT_ROOT/bin/clean.sh")"
+append_dry_run_cleanup_target() { :; }
+CLEAN_PREVIEW_LEDGER_FILE="$HOME/.ledger"
+: > "$CLEAN_PREVIEW_LEDGER_FILE"
+DRY_RUN=true
+stop_section_spinner() { :; }
+note_activity() { :; }
+is_path_whitelisted() { return 1; }
+clean_trash
+EOF
+
+    rm -rf "$HOME/.Trash" "$HOME/.ledger" # SAFE: test fixture HOME
+    [ "$status" -eq 0 ] || {
+        echo "$output"
+        return 1
+    }
+    [[ "$output" == *"Trash · would empty, 3 items"* ]]
+}
+
+@test "clean_trash dry run stops when the final Trash validation times out" {
+    rm -rf "$HOME/.Trash" # SAFE: reset this test's temporary HOME fixture before populating it
+    mkdir -p "$HOME/.Trash"
+    touch "$HOME/.Trash/one.tmp" "$HOME/.Trash/two.tmp"
+
+    run env HOME="$HOME" PROJECT_ROOT="$PROJECT_ROOT" MOLE_CURRENT_COMMAND=clean /bin/bash --noprofile --norc << 'EOF'
+set -euo pipefail
+source "$PROJECT_ROOT/lib/core/common.sh"
+source "$PROJECT_ROOT/lib/clean/user.sh"
+DRY_RUN=true
+stop_section_spinner() { :; }
+note_activity() { :; }
+is_path_whitelisted() { return 1; }
+validate_path_for_deletion() {
+    echo "VALIDATE:$1"
+    return 124
+}
+record_dry_run_cleanup_target() { echo "UNEXPECTED_RECORD:$1"; }
+rc=0
+clean_trash || rc=$?
+printf 'RC=%s CANCEL=%s\n' "$rc" "${MOLE_CLEAN_CANCEL_STATUS:-0}"
+EOF
+
+    rm -rf "$HOME/.Trash" # SAFE: test fixture HOME
+    [ "$status" -eq 0 ] || {
+        echo "$output"
+        return 1
+    }
+    [[ "$output" == *"RC=124 CANCEL=124"* ]] || return 1
+    [[ "$output" != *"UNEXPECTED_RECORD"* ]] || return 1
+    [[ "$output" != *"would empty"* ]] || return 1
+    local validate_calls
+    validate_calls=$(grep -c '^VALIDATE:' <<< "$output" || true)
+    [ "$validate_calls" -eq 1 ]
+}
+
 @test "clean_user_essentials keeps Mole runtime logs while cleaning other user logs" {
     mkdir -p "$HOME/Library/Logs/mole"
     mkdir -p "$HOME/Library/Logs/OtherApp"
```

---

### Incident Patch 6: `a55b82a1` (2026-10-05)
**Commit Message**: perf(core): inline the protection glob in its hot loops

should_protect_path and should_protect_data called bundle_matches_pattern
once per pattern per path, hundreds of thousands of function calls in one
clean. The loops now run the same unquoted case-sensitive glob test
inline, with the empty-pattern guard, so every verdict is unchanged
(identical over 269 real ~/Library paths). AGENTS.md notes that quoting
the right-hand side would turn wildcard protections into exact matches.
About 3 s of a clean dry run.

**File**: `AGENTS.md` (modified, +1/-1)
```diff
@@ -108,7 +108,7 @@ Public docs and examples should prefer the installed `mo` command. Use `./mole`
 - `WORKLOG.md` is an untracked cross-session handoff ledger and is never committed. Durable rules go into this file or a skill; release and queue evidence belongs in the release notes and issue threads. A tracked copy was removed in `0123a42a`, came back with the V1.57.0 triage, and went stale within two days, publishing unsent-email and private-diagnostic bookkeeping.
 - Check `should_protect_path()` before adding cleanup behavior.
 - Check app protection helpers before adding app cache, uninstall, or leftover cleanup behavior.
-- Bundle protection matching is case-sensitive glob (`bundle_matches_pattern`), and macOS system bundles report inconsistent casing across releases (macOS 26 ships `com.apple.bootcampassistant` alongside the older `com.apple.BootCampAssistant`). When the monthly bundle drift audit reports gaps, add the exact IDs as the audit printed them, and check the runtime blanket `com.apple.*` guard before rating the gap's severity. The audit workflow's issue path requires the `bundle-drift` label to exist in the repo.
+- Bundle protection matching is case-sensitive glob (`bundle_matches_pattern`; the hot loops in `should_protect_path` and `should_protect_data` inline the same `[[ -n "$pattern" && "$x" == $pattern ]]` test, and quoting that right-hand side silently turns every wildcard protection into an exact match), and macOS system bundles report inconsistent casing across releases (macOS 26 ships `com.apple.bootcampassistant` alongside the older `com.apple.BootCampAssistant`). When the monthly bundle drift audit reports gaps, add the exact IDs as the audit printed them, and check the runtime blanket `com.apple.*` guard before rating the gap's severity. The audit workflow's issue path requires the `bundle-drift` label to exist in the repo.
 - **A new cleanup target needs measured value and an explicit non-target list.** State bytes actually reclaimable on a real app version, not just the target's total footprint; name sibling directories excluded as user data and prove protection covers every reachable cleanup path. "It looks like a cache" is not evidence, and zero measured value stays out of scope. An encrypted or opaque index cannot prove a directory is unreferenced, so exclude it. A third-party owner command is still a deletion sink: the supported release must expose every mutated root machine-readably, dry-run and real mode must share one candidate plan, downstream traversal must enforce no-follow physical containment, and partial failures must be observable. Selective prune and dependency-store GC additionally require one lock or generation protocol across the complete mutation. A documented whole-cache reset may omit a shared lock only when the root contains no authored, session, installed, or toolchain state and interruption is equivalent to an ordinary cache miss. Unless the owner explicitly guarantees safe same-machine concurrent use, rebind a tri-state owner-process guard at the command boundary. Mole still validates and whitelists lexical and physical roots, rebinds their identities at the sink, propagates timeout or signal cancellation, and never falls back to direct deletion.
 - **Classify cleanup by recovery contract, not by directory name or download cost.** Re-downloading is a real cost but not an automatic veto when the user explicitly runs `clean`: Go's module cache is owner-documented, machine-resolvable, and independently whitelistable, so it is reset through `go clean -modcache`. Directly consumed or mixed-state stores still stay: `registry/src`, Cargo `git`, `$DENO_DIR`, `~/.ivy2/cache`, `~/.m2/repository`, `~/.nuget/packages`, `~/.cabal/packages`, and `~/.cpan/sources`. Cargo's compressed `registry/cache` is redundant with extracted sources, while Cargo 1.88+ owns age-aware GC for sources and git dependencies. Downloaded model and experiment roots (`~/.cache/huggingface`, `~/.cache/torch`, `~/.cache/tensorflow`, `~/.cache/wandb`) and toolchain payloads (`~/.sbt/boot`, `~/.sbt/launchers`, `~/.stack/programs`) stay off the blanket delete path. `DENO_DIR` is review-only because the owner command removes the entire root, including origin storage and downloaded runtime payloads. A default whitelist row is not protection once the user saves a custom file, so fix the delete path itself and remove whitelist inventory entries for targets Mole no longer deletes.
 - Keep AI-tool cache cleanup conservative. Claude Code, opencode, Copilot CLI, Zed, Warp, Ghostty, and similar developer tools may have active versions, config, credentials, or session state that must not be removed accidentally.
```

**File**: `lib/core/app_protection.sh` (modified, +10/-5)
```diff
@@ -231,7 +231,8 @@ should_protect_data() {
         com.tencent.* | com.sogou.* | com.baidu.* | com.googlecode.* | im.rime.*)
             # These might have wildcards, check detailed list
             for pattern in "${DATA_PROTECTED_BUNDLES[@]}"; do
-                if bundle_matches_pattern "$bundle_id" "$pattern"; then
+                # shellcheck disable=SC2053 # unquoted RHS is the glob, as in bundle_matches_pattern
+                if [[ -n "$pattern" && "$bundle_id" == $pattern ]]; then
                     return 0
                 fi
             done
@@ -241,7 +242,8 @@ should_protect_data() {
 
     # Fallback: check against the full DATA_PROTECTED_BUNDLES list
     for pattern in "${DATA_PROTECTED_BUNDLES[@]}"; do
-        if bundle_matches_pattern "$bundle_id" "$pattern"; then
+        # shellcheck disable=SC2053 # unquoted RHS is the glob, as in bundle_matches_pattern
+        if [[ -n "$pattern" && "$bundle_id" == $pattern ]]; then
             return 0
         fi
     done
@@ -581,20 +583,23 @@ should_protect_path() {
         if [[ "${MOLE_UNINSTALL_MODE:-0}" == "1" ]]; then
             # Uninstall mode: first check if it's an uninstallable Apple app
             for pattern in "${APPLE_UNINSTALLABLE_APPS[@]}"; do
-                if bundle_matches_pattern "$path" "$pattern"; then
+                # shellcheck disable=SC2053 # unquoted RHS is the glob, as in bundle_matches_pattern
+                if [[ -n "$pattern" && "$path" == $pattern ]]; then
                     return 1 # Can be uninstalled
                 fi
             done
             # Then check system-critical components
             for pattern in "${SYSTEM_CRITICAL_BUNDLES[@]}"; do
-                if bundle_matches_pattern "$path" "$pattern"; then
+                # shellcheck disable=SC2053 # unquoted RHS is the glob, as in bundle_matches_pattern
+                if [[ -n "$pattern" && "$path" == $pattern ]]; then
                     return 0
                 fi
             done
         else
             # Normal mode (cleanup): protect both system-critical and data-protected bundles
             for pattern in "${SYSTEM_CRITICAL_BUNDLES[@]}" "${DATA_PROTECTED_BUNDLES[@]}"; do
-                if bundle_matches_pattern "$path" "$pattern"; then
+                # shellcheck disable=SC2053 # unquoted RHS is the glob, as in bundle_matches_pattern
+                if [[ -n "$pattern" && "$path" == $pattern ]]; then
                     return 0
                 fi
             done
```

**File**: `tests/uninstall_safety.bats` (modified, +41/-0)
```diff
@@ -946,3 +946,44 @@ EOF
 		return 1
 	}
 }
+
+@test "protection pattern loops match globs inline, without a per-pattern call" {
+	# should_protect_path and should_protect_data run once per candidate across
+	# hundreds of patterns, so each loop tests the glob inline instead of
+	# calling bundle_matches_pattern. The verdicts pin that the unquoted RHS
+	# is still a glob: quoting it would turn a wildcard row such as
+	# *wireguard* into an exact-string match and drop the protection.
+	run env HOME="$HOME" PROJECT_ROOT="$PROJECT_ROOT" /bin/bash --noprofile --norc <<'EOF'
+set -euo pipefail
+source "$PROJECT_ROOT/lib/core/common.sh"
+calls="$HOME/bundle-match-calls"
+: >"$calls"
+bundle_matches_pattern() {
+    printf '.' >>"$calls"
+    [[ -z "$2" ]] && return 1
+    # shellcheck disable=SC2053 # unquoted RHS is the glob
+    [[ "$1" == $2 ]]
+}
+verdict() { if "$@"; then echo "$*=protected"; else echo "$*=open"; fi; }
+verdict should_protect_data "com.sogou.inputmethod.pinyin"
+verdict should_protect_data "com.sogou.cloud"
+verdict should_protect_data "im.rime.squirrel"
+verdict should_protect_data "org.example.wireguard-ui"
+verdict should_protect_data "org.example.plain"
+verdict should_protect_path "$HOME/Library/Caches/org.example.wireguard-ui/data"
+verdict should_protect_path "$HOME/Library/Caches/org.example.plain/data"
+MOLE_UNINSTALL_MODE=1 verdict should_protect_path "com.apple.loginitems.agent"
+MOLE_UNINSTALL_MODE=1 verdict should_protect_path "$HOME/Library/Caches/org.example.plain/data"
+echo "calls=$(wc -c <"$calls" | tr -d ' ')"
+EOF
+	[ "$status" -eq 0 ] || return 1
+	[[ "$output" == *"should_protect_data com.sogou.inputmethod.pinyin=protected"* ]] || return 1
+	[[ "$output" == *"should_protect_data com.sogou.cloud=open"* ]] || return 1
+	[[ "$output" == *"should_protect_data im.rime.squirrel=protected"* ]] || return 1
+	[[ "$output" == *"should_protect_data org.example.wireguard-ui=protected"* ]] || return 1
+	[[ "$output" == *"should_protect_data org.example.plain=open"* ]] || return 1
+	[[ "$output" == *"org.example.wireguard-ui/data=protected"* ]] || return 1
+	[[ "$output" == *"should_protect_path com.apple.loginitems.agent=protected"* ]] || return 1
+	[[ "$output" == *"org.example.plain/data=open"*"org.example.plain/data=open"* ]] || return 1
+	[[ "${lines[${#lines[@]} - 1]}" == "calls=0" ]]
+}
```

---

### Incident Patch 7: `3b94520d` (2026-10-05)
**Commit Message**: perf(core): throttle progress from the shell clock instead of date

update_progress_if_needed forked date on every call to decide whether a
second had passed, and clean calls it for every scanned item. Anchor one
epoch reading per shell and add $SECONDS, which gives the same integer
clock without a process. About 0.8 s of a clean dry run.

**File**: `lib/core/base.sh` (modified, +7/-3)
```diff
@@ -1419,9 +1419,13 @@ update_progress_if_needed() {
     local last_update_var="$3" # Name of variable holding last update time
     local interval="${4:-2}"   # Default: update every 2 seconds
 
-    # Get current time
-    local current_time
-    current_time=$(get_epoch_seconds)
+    # Get current time. Callers tick once per item, so anchor $SECONDS to the
+    # epoch once per shell instead of forking date on every call; the sum is
+    # the same epoch that callers seed the last update time with.
+    if [[ ! "${_MOLE_PROGRESS_EPOCH_BASE:-}" =~ ^[0-9]+$ ]]; then
+        _MOLE_PROGRESS_EPOCH_BASE=$(($(get_epoch_seconds) - SECONDS))
+    fi
+    local current_time=$((_MOLE_PROGRESS_EPOCH_BASE + SECONDS))
 
     # Get last update time from variable
     local last_time
```

**File**: `tests/core_common.bats` (modified, +21/-0)
```diff
@@ -1068,6 +1068,27 @@ EOF
     [[ "$raw_content" == *"PID_STABLE"* ]] || { cat -v "$raw"; return 1; }
 }
 
+@test "update_progress_if_needed reads the epoch clock once per shell" {
+    local calls="$HOME/epoch-calls"
+    local spins="$HOME/spinner-text"
+    # shellcheck disable=SC2016  # inner bash expands these from its environment
+    run env PROJECT_ROOT="$PROJECT_ROOT" CALLS="$calls" SPINS="$spins" \
+        /bin/bash --noprofile --norc -c '
+            source "$PROJECT_ROOT/lib/core/common.sh"
+            get_epoch_seconds() { printf "x\n" >> "$CALLS"; echo 1000000; }
+            start_section_spinner() { printf "%s\n" "$1" >> "$SPINS"; }
+            last_tick=0
+            for i in 1 2 3 4 5 6 7 8 9 10; do
+                update_progress_if_needed "$i" 10 last_tick 60 || true
+            done
+            echo "last_tick=$last_tick"
+        '
+    [ "$status" -eq 0 ]
+    [[ "$(wc -l < "$calls" | tr -d ' ')" == "1" ]] || return 1
+    [[ "$(cat "$spins")" == "Scanning items... 1/10" ]] || return 1
+    [[ "$output" == "last_tick=1000000" || "$output" == "last_tick=1000001" ]]
+}
+
 @test "safe_clear_lines emits the same erase sequence per line to the target device" {
     local out="$HOME/clear-lines.out"
     run /bin/bash --noprofile --norc -c \
```

---

### Incident Patch 8: `ad93511a` (2026-10-05)
**Commit Message**: perf(clean): prune build outputs from the project cache scan

The project cache scan walked Rust target/, SwiftPM .build/, .gradle,
Xcode Index.noindex and npm _cacache trees, none of which hold a cache
this step cleans. On a real ~/www they were half of the 60k directories
visited, so on a busy disk the scan crossed its 6 s timeout and the
whole root was skipped, leaving its Python bytecode caches uncleaned in
about half of runs. Pruning them takes the walk from 3.0 s to 0.8 s with
the same matches, and three dry runs no longer skip the root.

**File**: `lib/clean/caches.sh` (modified, +5/-1)
```diff
@@ -366,9 +366,13 @@ scan_project_cache_root() {
     [[ -d "$root" ]] || return 0
     : > "$output_file"
 
+    # Build outputs and package stores (target, .build, .gradle, Index.noindex,
+    # _cacache) never hold a project cache worth cleaning, but on a typical
+    # projects folder they can be half of the directories walked, enough to push
+    # the scan past its timeout on a busy disk and skip the whole root.
     local -a find_args=(
         find -P "$root" -maxdepth 9 -mount
-        "(" -name "Library" -o -name ".Trash" -o -name "node_modules" -o -name ".git" -o -name ".svn" -o -name ".hg" -o -name ".venv" -o -name "venv" -o -name ".pnpm-store" -o -name ".fvm" -o -name "DerivedData" -o -name "Pods" -o -name "miniconda3" -o -name "anaconda3" -o -name "miniforge3" -o -name "mambaforge" -o -name "site-packages" ")"
+        "(" -name "Library" -o -name ".Trash" -o -name "node_modules" -o -name ".git" -o -name ".svn" -o -name ".hg" -o -name ".venv" -o -name "venv" -o -name ".pnpm-store" -o -name ".fvm" -o -name "DerivedData" -o -name "Pods" -o -name "miniconda3" -o -name "anaconda3" -o -name "miniforge3" -o -name "mambaforge" -o -name "site-packages" -o -name "target" -o -name ".build" -o -name ".gradle" -o -name "Index.noindex" -o -name "_cacache" ")"
         -prune -o
         -type d
         "(" -name ".next" -o -name "__pycache__" -o -name ".dart_tool" ")"
```

**File**: `tests/clean_system_caches.bats` (modified, +30/-0)
```diff
@@ -1233,6 +1233,36 @@ EOF
     rm -rf "$HOME/Projects" "$output_file"
 }
 
+@test "scan_project_cache_root prunes build outputs and package stores" {
+    local name
+    for name in target .build .gradle Index.noindex _cacache; do
+        mkdir -p "$HOME/Projects/app/$name/sub/__pycache__"
+        touch "$HOME/Projects/app/$name/sub/__pycache__/mod.pyc"
+    done
+    mkdir -p "$HOME/Projects/app/__pycache__"
+    touch "$HOME/Projects/app/pyproject.toml"
+    touch "$HOME/Projects/app/__pycache__/mod.pyc"
+
+    local output_file
+    output_file=$(mktemp)
+
+    run env HOME="$HOME" PROJECT_ROOT="$PROJECT_ROOT" /bin/bash --noprofile --norc <<EOF
+set -euo pipefail
+source "\$PROJECT_ROOT/lib/core/common.sh"
+source "\$PROJECT_ROOT/lib/clean/caches.sh"
+run_with_timeout() { shift; "\$@"; }
+scan_project_cache_root "$HOME/Projects" "$output_file"
+cat "$output_file"
+EOF
+    [ "$status" -eq 0 ]
+    [[ "$output" == *"app/__pycache__"* ]] || return 1
+    for name in target .build .gradle Index.noindex _cacache; do
+        [[ "$output" != *"/$name/"* ]] || return 1
+    done
+
+    rm -rf "$HOME/Projects" "$output_file"
+}
+
 @test "clean_project_caches excludes Library and Trash directories" {
     mkdir -p "$HOME/Library/.next/cache"
     mkdir -p "$HOME/.Trash/.next/cache"
```

---

### Incident Patch 9: `ad524824` (2026-10-05)
**Commit Message**: perf(core): answer is_root_user from EUID

is_root_user forked id -u on every call, about 185 times in one traced
mo clean. EUID holds the same value in the shell; id stays as the
fallback when EUID is unset.

**File**: `lib/core/base.sh` (modified, +3/-1)
```diff
@@ -694,8 +694,10 @@ get_optimal_parallel_jobs() {
 # User Context Utilities
 # ============================================================================
 
+# EUID answers the same question as id -u without a subprocess; clean asks
+# it for many targets.
 is_root_user() {
-    [[ "$(id -u)" == "0" ]]
+    [[ "${EUID:-$(id -u)}" == "0" ]]
 }
 
 get_invoking_uid() {
```

**File**: `tests/core_common.bats` (modified, +16/-0)
```diff
@@ -501,6 +501,22 @@ EOF
     [ "$output" = OK ]
 }
 
+@test "is_root_user answers from EUID without forking id" {
+    run /bin/bash --noprofile --norc << 'EOF'
+source "$PROJECT_ROOT/lib/core/common.sh"
+id() { echo called >> "$HOME/id-calls"; command id "$@"; }
+rc=0
+is_root_user || rc=$?
+expected=1
+[[ "$(command id -u)" == "0" ]] && expected=0
+[[ $rc -eq $expected ]] || { echo "RC=$rc EXPECTED=$expected"; exit 1; }
+[[ ! -e "$HOME/id-calls" ]] || { echo "FORKED_ID"; exit 1; }
+echo OK
+EOF
+    [ "$status" -eq 0 ] || { echo "$output"; return 1; }
+    [ "$output" = OK ]
+}
+
 @test "is_critical_system_component ignores case and leaves nocasematch as it was" {
     run /bin/bash --noprofile --norc << 'EOF'
 source "$PROJECT_ROOT/lib/core/common.sh"
```

---

### Incident Patch 10: `6e793654` (2026-10-05)
**Commit Message**: perf(clean): stop forking per candidate in hot clean loops

A traced mo clean spent over a thousand subprocesses on string work: a tr
per candidate in is_critical_system_component and the Application Support
log loop, and a basename per project in the artifact hint scan. Match the
critical-component patterns with nocasematch, lowercase ASCII with shell
substitutions that produce the same bytes as LC_ALL=C tr, and take names
with parameter expansion. A dry run on one Mac went from about 42 s to
38 s with the same rows.

**File**: `lib/clean/apps.sh` (modified, +2/-2)
```diff
@@ -459,7 +459,7 @@ is_bundle_orphaned() {
 
     # 2. Fast path: check sensitive data patterns (in-memory, instant)
     local bundle_lower
-    bundle_lower=$(echo "$bundle_id" | LC_ALL=C tr '[:upper:]' '[:lower:]')
+    mole_ascii_lowercase bundle_lower "$bundle_id"
     for pattern in "${ORPHAN_NEVER_DELETE_PATTERNS[@]}"; do
         # shellcheck disable=SC2053
         if [[ "$bundle_lower" == $pattern ]]; then
@@ -814,7 +814,7 @@ clean_orphaned_app_data() {
                     if [[ $iteration_count -gt $MOLE_MAX_ORPHAN_ITERATIONS ]]; then
                         break
                     fi
-                    local bundle_id=$(basename "$match")
+                    local bundle_id="${match##*/}"
                     bundle_id="${bundle_id%.savedState}"
                     bundle_id="${bundle_id%.binarycookies}"
                     bundle_id="${bundle_id%.plist}"
```

**File**: `lib/clean/hints.sh` (modified, +4/-4)
```diff
@@ -296,8 +296,8 @@ probe_project_artifact_hints() {
             fi
             [[ -d "$project_dir" ]] || continue
 
-            local project_name
-            project_name=$(basename "$project_dir")
+            local project_name="${project_dir%/}"
+            project_name="${project_name##*/}"
             [[ "$project_name" == .* ]] && continue
 
             if [[ $root_projects_scanned -ge $max_projects_per_root ]]; then
@@ -350,8 +350,8 @@ probe_project_artifact_hints() {
                 fi
                 [[ -d "$nested_dir" ]] || continue
 
-                local nested_name
-                nested_name=$(basename "$nested_dir")
+                local nested_name="${nested_dir%/}"
+                nested_name="${nested_name##*/}"
                 [[ "$nested_name" == .* ]] && continue
 
                 case "$nested_name" in
```

**File**: `lib/clean/user.sh` (modified, +1/-1)
```diff
@@ -2261,7 +2261,7 @@ clean_application_support_logs() {
             is_protected=true
         else
             local app_name_lower
-            app_name_lower=$(echo "$app_name" | LC_ALL=C tr '[:upper:]' '[:lower:]')
+            mole_ascii_lowercase app_name_lower "$app_name"
             if should_protect_data "$app_name_lower"; then
                 is_protected=true
             fi
```

**File**: `lib/core/app_protection.sh` (modified, +15/-9)
```diff
@@ -47,22 +47,28 @@ xcode_build_tooling_process_state() {
     return 1
 }
 
-# Centralized check for critical system components (case-insensitive)
+# Centralized check for critical system components (case-insensitive).
+# nocasematch instead of a lowercasing tr: clean asks this once per
+# candidate, so a subprocess here cost seconds per run.
 is_critical_system_component() {
     local token="$1"
     [[ -z "$token" ]] && return 1
 
-    local lower
-    lower=$(echo "$token" | LC_ALL=C tr '[:upper:]' '[:lower:]')
-
-    case "$lower" in
+    local restore_nocasematch=false
+    if ! shopt -q nocasematch; then
+        shopt -s nocasematch
+        restore_nocasematch=true
+    fi
+    local critical=1
+    case "$token" in
         *backgroundtaskmanagement* | *loginitems* | *systempreferences* | *systemsettings* | *settings* | *preferences* | *controlcenter* | *biometrickit* | *sfl* | *tcc*)
-            return 0
-            ;;
-        *)
-            return 1
+            critical=0
             ;;
     esac
+    if [[ "$restore_nocasematch" == "true" ]]; then
+        shopt -u nocasematch
+    fi
+    return "$critical"
 }
 
 # Check if bundle ID matches pattern (glob support)
```

**File**: `lib/core/base.sh` (modified, +34/-0)
```diff
@@ -617,6 +617,40 @@ mole_filter_nested_paths() {
 # Wait in the owning shell so Bash 3.2 can reap any completed scan worker.
 # The first argument names a caller variable receiving the completed PID;
 # the return status belongs to that worker, or to an interrupted polling sleep.
+# Lowercase ASCII letters into the variable named by $1, the same bytes
+# `LC_ALL=C tr '[:upper:]' '[:lower:]'` produces, without a subprocess:
+# hot loops call this once per candidate, and each tr cost a fork.
+mole_ascii_lowercase() {
+    local _lowercase_value="${2:-}"
+    _lowercase_value=${_lowercase_value//A/a}
+    _lowercase_value=${_lowercase_value//B/b}
+    _lowercase_value=${_lowercase_value//C/c}
+    _lowercase_value=${_lowercase_value//D/d}
+    _lowercase_value=${_lowercase_value//E/e}
+    _lowercase_value=${_lowercase_value//F/f}
+    _lowercase_value=${_lowercase_value//G/g}
+    _lowercase_value=${_lowercase_value//H/h}
+    _lowercase_value=${_lowercase_value//I/i}
+    _lowercase_value=${_lowercase_value//J/j}
+    _lowercase_value=${_lowercase_value//K/k}
+    _lowercase_value=${_lowercase_value//L/l}
+    _lowercase_value=${_lowercase_value//M/m}
+    _lowercase_value=${_lowercase_value//N/n}
+    _lowercase_value=${_lowercase_value//O/o}
+    _lowercase_value=${_lowercase_value//P/p}
+    _lowercase_value=${_lowercase_value//Q/q}
+    _lowercase_value=${_lowercase_value//R/r}
+    _lowercase_value=${_lowercase_value//S/s}
+    _lowercase_value=${_lowercase_value//T/t}
+    _lowercase_value=${_lowercase_value//U/u}
+    _lowercase_value=${_lowercase_value//V/v}
+    _lowercase_value=${_lowercase_value//W/w}
+    _lowercase_value=${_lowercase_value//X/x}
+    _lowercase_value=${_lowercase_value//Y/y}
+    _lowercase_value=${_lowercase_value//Z/z}
+    printf -v "$1" '%s' "$_lowercase_value"
+}
+
 mole_wait_for_any_worker() {
     local _wait_output_name="$1"
     shift
```

**File**: `tests/core_common.bats` (modified, +42/-0)
```diff
@@ -478,6 +478,48 @@ PY
     [ "$status" -eq 0 ]
 }
 
+@test "mole_ascii_lowercase matches LC_ALL=C tr byte for byte" {
+    run /bin/bash --noprofile --norc << 'EOF'
+source "$PROJECT_ROOT/lib/core/common.sh"
+while IFS= read -r sample; do
+    expected=$(printf '%s' "$sample" | LC_ALL=C tr '[:upper:]' '[:lower:]')
+    actual=""
+    mole_ascii_lowercase actual "$sample"
+    [[ "$actual" == "$expected" ]] || { printf 'MISMATCH [%s] [%s] [%s]\n' "$sample" "$actual" "$expected"; exit 1; }
+done << 'SAMPLES'
+com.Apple.SystemSettings
+Zed Nightly
+ÄÖÜ Café ÉCOLE
+微信 WeChat
+[A-Z]*?{Glob}
+  Leading And Trailing  
+
+SAMPLES
+echo OK
+EOF
+    [ "$status" -eq 0 ] || { echo "$output"; return 1; }
+    [ "$output" = OK ]
+}
+
+@test "is_critical_system_component ignores case and leaves nocasematch as it was" {
+    run /bin/bash --noprofile --norc << 'EOF'
+source "$PROJECT_ROOT/lib/core/common.sh"
+for token in com.apple.SystemSettings "System Preferences" LoginItems com.apple.TCC ControlCenter; do
+    is_critical_system_component "$token" || { echo "MISSED $token"; exit 1; }
+done
+for token in com.example.app Slack "Visual Studio Code"; do
+    ! is_critical_system_component "$token" || { echo "FLAGGED $token"; exit 1; }
+done
+shopt -q nocasematch && { echo "LEFT_ON"; exit 1; }
+shopt -s nocasematch
+is_critical_system_component "LoginItems" || exit 1
+shopt -q nocasematch || { echo "TURNED_OFF"; exit 1; }
+echo OK
+EOF
+    [ "$status" -eq 0 ] || { echo "$output"; return 1; }
+    [ "$output" = OK ]
+}
+
 @test "bytes_to_human converts byte counts into readable units" {
     output="$(
         HOME="$HOME" /bin/bash --noprofile --norc << 'EOF'
```

---

### Incident Patch 11: `3ad8a2fd` (2026-10-05)
**Commit Message**: fix(update): point Homebrew nightly requests at the formula's main build

mo update --nightly on a Homebrew install told users to reinstall via the
script, but install.sh exits while Homebrew owns mole, so the advice led
nowhere. The core formula's head builds main, so suggest
`brew uninstall mole && brew install --HEAD mole` instead.

**File**: `lib/manage/update.sh` (modified, +3/-1)
```diff
@@ -1024,7 +1024,9 @@ update_mole() (
         if [[ "$nightly_update" == "true" ]]; then
             local review_icon="${ICON_REVIEW:-⊙}"
             log_error "Nightly update is only available for script installations. Homebrew installs follow stable releases."
-            printf '%s Reinstall via script to use: mo update --nightly\n' "$review_icon"
+            # install.sh exits while Homebrew owns mole; the formula's head
+            # builds main, so stay on Homebrew to try it.
+            printf '%s To try main: brew uninstall mole && brew install --HEAD mole\n' "$review_icon"
             exit 1
         fi
         update_via_homebrew "$VERSION"
```

**File**: `tests/update.bats` (modified, +24/-0)
```diff
@@ -926,6 +926,30 @@ EOF
 	grep -q '^upgrade mole$' "$brew_log"
 }
 
+@test "mo update --nightly sends Homebrew installs to the formula's main build" {
+	local fake_brew_bin="$TEST_ROOT/homebrew/bin"
+	local fake_brew_mole="$TEST_ROOT/homebrew/Cellar/mole/9.9.9/bin/mole"
+	local brew_log="$TEST_ROOT/brew.log"
+
+	make_homebrew_shadow "$fake_brew_bin" "$fake_brew_mole"
+	: > "$brew_log"
+
+	run env \
+		HOME="$HOME" \
+		PATH="$fake_brew_bin:/usr/bin:/bin" \
+		BREW_LOG="$brew_log" \
+		"$fake_brew_bin/mo" update --nightly
+
+	[ "$status" -eq 1 ] || { echo "$output"; return 1; }
+	[[ "$output" == *"brew install --HEAD mole"* ]] || { echo "$output"; return 1; }
+	# The script install refuses while Homebrew owns mole.
+	[[ "$output" != *"via script"* ]] || { echo "$output"; return 1; }
+	if grep -q '^upgrade' "$brew_log"; then
+		cat "$brew_log"
+		return 1
+	fi
+}
+
 @test "Homebrew update bounds fallback installed-binary version probes" {
 	run env HOME="$HOME/bounded-homebrew-version" PROJECT_ROOT="$PROJECT_ROOT" /bin/bash --noprofile --norc << 'EOF'
 set -euo pipefail
```

---

### Incident Patch 12: `2e9d6da6` (2026-10-05)
**Commit Message**: fix(clean): keep a Flutter build/ that holds a nested repository

build/ is cleaned as Flutter output only because a .dart_tool sits beside
it, and a repository inside it, such as a plugin checkout or a vendored
package, is authored work the outer Git listing never sees: clean removed
it together with its .git. Look for a nested .git with one bounded find
first, and keep the folder when one is found or the scan cannot finish.

**File**: `lib/clean/caches.sh` (modified, +28/-1)
```diff
@@ -623,6 +623,28 @@ project_cache_git_status() {
     return 2
 }
 
+# build/ counts as Flutter output by convention only, and a repository inside
+# it (a plugin checkout, a vendored package) is authored work the outer Git
+# listing never sees. 0 keeps the folder, 1 clears it, a signal propagates;
+# a scan that cannot finish keeps the folder.
+_project_cache_holds_nested_repo() {
+    local dir="$1"
+    local found="" scan_rc=0
+    found=$(run_with_timeout "$MOLE_TIMEOUT_MEDIUM_PROBE_SEC" find -P "$dir" -mindepth 1 -name .git -print -quit 2> /dev/null) || scan_rc=$?
+    [[ $scan_rc -gt 128 ]] && return "$scan_rc"
+    local reason=""
+    if [[ $scan_rc -ne 0 ]]; then
+        reason="nested repository check incomplete"
+    elif [[ -n "$found" ]]; then
+        reason="holds a nested git repository"
+    else
+        return 1
+    fi
+    debug_log "Keeping project cache, $reason: $dir"
+    log_operation "clean" "SKIPPED" "$dir" "$reason"
+    return 0
+}
+
 project_cache_has_tracked_files() {
     local cache_path="$1"
     local tracked_rc=0
@@ -752,7 +774,12 @@ _process_project_cache_matches_indexed() {
                     clean_project_cache_target "$cache_dir" "Flutter build cache (.dart_tool)" || return $?
                     local build_dir="$(dirname "$cache_dir")/build"
                     if [[ -d "$build_dir" ]]; then
-                        clean_project_cache_target "$build_dir" "Flutter build cache (build/)" || return $?
+                        local nested_rc=0
+                        _project_cache_holds_nested_repo "$build_dir" || nested_rc=$?
+                        [[ $nested_rc -gt 128 ]] && return "$nested_rc"
+                        if [[ $nested_rc -eq 1 ]]; then
+                            clean_project_cache_target "$build_dir" "Flutter build cache (build/)" || return $?
+                        fi
                     fi
                 fi
                 ;;
```

**File**: `tests/clean_system_caches.bats` (modified, +48/-0)
```diff
@@ -728,6 +728,54 @@ EOF
     rm -rf "$HOME/Projects" "$HOME/Other"
 }
 
+@test "clean_project_caches keeps a Flutter build/ that holds a nested repository" {
+    run env HOME="$HOME" PROJECT_ROOT="$PROJECT_ROOT" /bin/bash --noprofile --norc <<'EOF'
+set -euo pipefail
+source "$PROJECT_ROOT/lib/core/common.sh"
+source "$PROJECT_ROOT/lib/clean/caches.sh"
+app="$HOME/Projects/app"
+mkdir -p "$app/.dart_tool" "$app/build/plugins/local_plugin/lib"
+touch "$app/pubspec.yaml" "$app/.dart_tool/state" "$app/build/plugins/local_plugin/lib/main.dart"
+git init -q "$app"
+git init -q "$app/build/plugins/local_plugin"
+DRY_RUN=false
+clean_project_caches
+[[ ! -e "$app/.dart_tool" ]] || exit 11
+[[ -d "$app/build/plugins/local_plugin/.git" ]] || exit 12
+[[ -f "$app/build/plugins/local_plugin/lib/main.dart" ]] || exit 13
+EOF
+    [ "$status" -eq 0 ] || { echo "$output"; return 1; }
+
+    rm -rf "$HOME/Projects"
+}
+
+@test "clean_project_caches keeps a Flutter build/ whose nested repository check cannot finish" {
+    run env HOME="$HOME" PROJECT_ROOT="$PROJECT_ROOT" /bin/bash --noprofile --norc <<'EOF'
+set -euo pipefail
+source "$PROJECT_ROOT/lib/core/common.sh"
+source "$PROJECT_ROOT/lib/clean/caches.sh"
+app="$HOME/Projects/app"
+mkdir -p "$app/.dart_tool" "$app/build"
+touch "$app/pubspec.yaml" "$app/.dart_tool/state" "$app/build/out.bin"
+git init -q "$app"
+eval "real_$(declare -f run_with_timeout)"
+run_with_timeout() {
+    # Only the nested-repository probe times out; discovery still runs.
+    if [[ "$2" == find && "$*" == *"-mindepth 1 -name .git -print -quit"* ]]; then
+        return 124
+    fi
+    real_run_with_timeout "$@"
+}
+DRY_RUN=false
+clean_project_caches
+[[ ! -e "$app/.dart_tool" ]] || exit 11
+[[ -f "$app/build/out.bin" ]] || exit 12
+EOF
+    [ "$status" -eq 0 ] || { echo "$output"; return 1; }
+
+    rm -rf "$HOME/Projects"
+}
+
 @test "project cache index gives no free pass to a path it never saw" {
     run env HOME="$HOME" PROJECT_ROOT="$PROJECT_ROOT" /bin/bash --noprofile --norc <<'EOF'
 set -euo pipefail
```

---

### Incident Patch 13: `d929d156` (2026-10-05)
**Commit Message**: fix(clean): keep project caches that Git tracks (#1686)

mo clean found project caches by name (__pycache__, .dart_tool, the
Flutter build/ beside it, .next/cache) and removed them even when Git
tracked files inside, such as bytecode committed by mistake or a test
fixture under .dart_tool. Keep any such cache, and keep it when Git
cannot answer.

Clean asks Git once per repository: candidates are grouped by repository
and one bounded ls-files listing, under a deadline shared by the whole
step, is matched against all of them, so a tree with hundreds of caches
costs about the same as before. A failed or late listing, git's own
fatal exit, a name Git normalizes differently, a linked .next/cache or
build/, and any path the listing never saw are kept. Purge's
tracked-content probe shares the same Git invocation.

**File**: `lib/clean/caches.sh` (modified, +228/-2)
```diff
@@ -449,13 +449,208 @@ project_cache_group_root() {
     printf '%s\n' "$scan_root"
 }
 
+# Project caches are found by name only. Keep any that Git tracks, such as a
+# committed test fixture under .dart_tool or bytecode checked in by mistake,
+# and keep them when Git could not answer.
+#
+# process_project_cache_matches asks Git once per repository and records each
+# candidate as T (tracked), U (unknown) or C (clear), one per line, held here
+# with a leading and trailing newline so a lookup needs no extra process. One
+# bounded probe per cache cost about 120 ms each, which a repository with
+# hundreds of __pycache__ folders turned into minutes.
+_project_cache_git_index=""
+
+# Printable ASCII only, judged bytewise whatever the caller's locale.
+_project_cache_path_is_ascii() {
+    local LC_ALL=C
+    [[ "$1" != *[![:print:]]* ]]
+}
+
+# Build the index for every candidate a matches file will reach. All Git
+# listings share one deadline; a repository that cannot be listed in time, or
+# whose listing fails, marks its candidates unknown. Signals propagate.
+project_cache_build_git_index() {
+    local matches_file="$1"
+    local index_file="$2"
+    local deadline="$3"
+    local work_dir=""
+    : > "$index_file" || return 1
+    work_dir=$(create_temp_dir) || return 1
+
+    local -a logical_roots=() physical_roots=()
+    local record_root="" cache_dir="" candidate="" physical="" repo="" i
+    local candidates_file="$work_dir/candidates"
+    : > "$candidates_file"
+    while IFS=$'\t' read -r record_root cache_dir; do
+        [[ -n "$record_root" && -n "$cache_dir" ]] || continue
+        # find -P never follows links below its root, so only the record root
+        # can carry an alias; resolve it once and keep each suffix as found.
+        local root_physical=""
+        for ((i = 0; i < ${#logical_roots[@]}; i++)); do
+            if [[ "${logical_roots[$i]}" == "$record_root" ]]; then
+                root_physical="${physical_roots[$i]}"
+                break
+            fi
+        done
+        if [[ -z "$root_physical" ]]; then
+            root_physical=$(cd "$record_root" 2> /dev/null && /bin/pwd -P) || root_physical="?"
+            logical_roots+=("$record_root")
+            physical_roots+=("$root_physical")
+        fi
+        local -a candidates=()
+        case "${cache_dir##*/}" in
+            ".next")
+                # A linked cache folder puts its children in another tree that
+                # this repository cannot answer for; keep all of them.
+                if [[ -L "$cache_dir/cache" ]]; then
+                    for candidate in "$cache_dir/cache"/*; do
+                        printf 'U%s\n' "$candidate" >> "$index_file"
+                    done
+                    continue
+                fi
+                for candidate in "$cache_dir/cache"/*; do
+                    [[ -e "$candidate" || -L "$candidate" ]] && candidates+=("$candidate")
+                done
+                ;;
+            "__pycache__") candidates=("$cache_dir") ;;
+            ".dart_tool")
+                candidates=("$cache_dir")
+                if [[ -L "$(dirname "$cache_dir")/build" ]]; then
+                    printf 'U%s\n' "$(dirname "$cache_dir")/build" >> "$index_file"
+                elif [[ -d "$(dirname "$cache_dir")/build" ]]; then
+                    candidates+=("$(dirname "$cache_dir")/build")
+                fi
+                ;;
+        esac
+        for candidate in "${candidates[@]+"${candidates[@]}"}"; do
+            if [[ "$root_physical" == "?" || "$candidate" != "$record_root"/* ]]; then
+                printf 'U%s\n' "$candidate" >> "$index_file"
+                continue
+            fi
+            physical="$root_physical/${candidate#"$record_root"/}"
+            if mole_find_git_repo_root "$physical"; then
+                repo="$MOLE_GIT_REPO_ROOT"
+                if [[ "$repo" == "$physical" ]]; then
+                    # A cache folder that is its own repository is not a cache.
+                    printf 'U%s\n' "$candidate" >> "$index_file"
+                    continue
+                fi
+                local rel="${physical#"$repo"/}"
+                if ! _project_cache_path_is_ascii "$rel"; then
+                    # Git lists macOS names precomposed while the disk may keep
+                    # them decomposed, so bytes cannot be compared. Let Git
+                    # normalize this one directory; a file stays unknown.
+                    local probe_rc=2
+                    if [[ -d "$candidate" && ! -L "$candidate" ]]; then
+                        probe_rc=0
+                        mole_path_has_git_tracked_files "$candidate" "$deadline" || probe_rc=$?
+                    fi
+                    case "$probe_rc" in
+                        0) printf 'T%s\n' "$candidate" >> "$index_file" ;;
+                        1) printf 'C%s\n' "$candidate" >> "$index_file" ;;
+                        *) printf 'U%s\n' "$candid
```

**File**: `lib/clean/project.sh` (modified, +3/-16)
```diff
@@ -509,7 +509,6 @@ purge_artifact_has_authored_content() {
     local probe_timeout=""
     [[ -d "$path" ]] || return 1
     # A configured root can cross a symlink before reaching the candidate.
-    # Git ancestry must follow the actual repository, not the alias spelling.
     path=$(cd "$path" 2> /dev/null && /bin/pwd -P) || return 2
     local evidence=""
     # Do not follow links or read key contents. This walks the whole artifact
@@ -520,21 +519,9 @@ purge_artifact_has_authored_content() {
         \( -name .git -o -name '*-keypair.json' \) -print -quit 2> /dev/null) || return 2
     [[ -z "$evidence" ]] || return 0
 
-    local ancestor="$path"
-    while [[ "$ancestor" != "/" && -n "$ancestor" ]]; do
-        if [[ -e "$ancestor/.git" || -L "$ancestor/.git" ]]; then
-            # Ignore inherited Git routing; inspect this directory's own repo.
-            probe_timeout=$(_mole_timeout_with_deadline "$MOLE_TIMEOUT_HINT_SCAN_SEC" "$deadline") || return 2
-            evidence=$(run_with_timeout "$probe_timeout" \
-                env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE -u GIT_COMMON_DIR \
-                GIT_OPTIONAL_LOCKS=0 GIT_LITERAL_PATHSPECS=1 \
-                git -c core.fsmonitor=false --git-dir="$ancestor/.git" --work-tree="$ancestor" -C "$path" ls-files -- . 2> /dev/null) || return 2
-            [[ -n "$evidence" ]]
-            return $?
-        fi
-        ancestor="${ancestor%/*}"
-    done
-    return 1
+    local tracked_rc=0
+    mole_path_has_git_tracked_files "$path" "$deadline" || tracked_rc=$?
+    return "$tracked_rc"
 }
 
 # Set by is_protected_purge_artifact: true when the verdict came from an
```

**File**: `lib/clean/purge_shared.sh` (modified, +56/-0)
```diff
@@ -164,6 +164,62 @@ mole_purge_is_project_root() {
     return 1
 }
 
+# The repository that owns a physical path: the nearest ancestor holding .git
+# (a directory, or a file for linked worktrees and submodules). Sets
+# MOLE_GIT_REPO_ROOT without a subshell, for callers that ask per candidate.
+mole_find_git_repo_root() {
+    local ancestor="${1%/}"
+    MOLE_GIT_REPO_ROOT=""
+    while [[ "$ancestor" != "/" && -n "$ancestor" ]]; do
+        if [[ -e "$ancestor/.git" || -L "$ancestor/.git" ]]; then
+            MOLE_GIT_REPO_ROOT="$ancestor"
+            return 0
+        fi
+        ancestor="${ancestor%/*}"
+    done
+    return 1
+}
+
+mole_git_repo_root() {
+    mole_find_git_repo_root "$1" || return 1
+    printf '%s\n' "$MOLE_GIT_REPO_ROOT"
+}
+
+# Run a bounded `git ls-files` in a repository from directory $3. Inherited Git
+# routing is ignored so the repository's own index answers, fsmonitor hooks
+# never run, and pathspecs stay literal. Returns git's or the timeout's status.
+mole_git_ls_files() {
+    local repo="$1"
+    local deadline="$2"
+    local dir="$3"
+    shift 3
+    local probe_timeout=""
+    probe_timeout=$(_mole_timeout_with_deadline "$MOLE_TIMEOUT_HINT_SCAN_SEC" "$deadline") || return 124
+    run_with_timeout "$probe_timeout" \
+        env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE -u GIT_COMMON_DIR \
+        GIT_OPTIONAL_LOCKS=0 GIT_LITERAL_PATHSPECS=1 \
+        git -c core.fsmonitor=false --git-dir="$repo/.git" --work-tree="$repo" -C "$dir" ls-files "$@" 2> /dev/null
+}
+
+# Whether Git tracks files below a directory, asked of the repository that owns
+# it. Names do not prove a directory is disposable: build/ can hold tracked
+# source and a cache-named folder a committed fixture. Returns 0 when Git tracks
+# files there, 1 when no repository owns the path or it tracks nothing there,
+# and 2 when the probe timed out or failed.
+mole_path_has_git_tracked_files() {
+    local path="${1%/}"
+    local deadline="${2:-}"
+    local evidence="" repo=""
+    [[ -d "$path" ]] || return 1
+    # A configured root can cross a symlink before reaching the candidate.
+    # Git ancestry must follow the actual repository, not the alias spelling.
+    path=$(cd "$path" 2> /dev/null && /bin/pwd -P) || return 2
+    repo=$(mole_git_repo_root "$path") || return 1
+    evidence=$(mole_git_ls_files "$repo" "$deadline" "$path" -- .) || return 2
+    [[ -n "$evidence" ]] && return 0
+    return 1
+}
+
 mole_dir_has_cachedir_tag() {
     local dir="$1"
     local tag="$dir/$MOLE_CACHEDIR_TAG_NAME"
```

**File**: `tests/clean_system_caches.bats` (modified, +213/-0)
```diff
@@ -533,6 +533,219 @@ EOF
     rm -rf "$HOME/Projects" "$HOME/export.txt"
 }
 
+@test "clean_project_caches keeps project caches that Git tracks" {
+    run env HOME="$HOME" PROJECT_ROOT="$PROJECT_ROOT" /bin/bash --noprofile --norc <<'EOF'
+set -euo pipefail
+source "$PROJECT_ROOT/lib/core/common.sh"
+source "$PROJECT_ROOT/lib/clean/caches.sh"
+repo="$HOME/Projects/repo"
+mkdir -p "$repo/py/pkg/__pycache__" "$repo/py/committed/__pycache__" \
+    "$repo/app/.dart_tool" "$repo/app/build" "$repo/app/test/fixtures/.dart_tool"
+touch "$repo/py/pyproject.toml" "$repo/app/pubspec.yaml"
+touch "$repo/py/pkg/__pycache__/local.pyc" "$repo/py/committed/__pycache__/committed.pyc"
+touch "$repo/app/.dart_tool/state" "$repo/app/build/output"
+printf '{}' > "$repo/app/test/fixtures/.dart_tool/package_config.json"
+git init -q "$repo"
+git -C "$repo" add -f py/committed/__pycache__/committed.pyc app/test/fixtures/.dart_tool/package_config.json
+DRY_RUN=false
+clean_project_caches
+[[ ! -e "$repo/py/pkg/__pycache__" ]] || exit 11
+[[ -f "$repo/py/committed/__pycache__/committed.pyc" ]] || exit 12
+[[ ! -e "$repo/app/.dart_tool" ]] || exit 13
+[[ ! -e "$repo/app/build" ]] || exit 14
+[[ -f "$repo/app/test/fixtures/.dart_tool/package_config.json" ]] || exit 15
+EOF
+    [ "$status" -eq 0 ]
+
+    rm -rf "$HOME/Projects"
+}
+
+@test "clean_project_caches keeps a project cache whose Git listing cannot finish" {
+    run env HOME="$HOME" PROJECT_ROOT="$PROJECT_ROOT" /bin/bash --noprofile --norc <<'EOF'
+set -euo pipefail
+source "$PROJECT_ROOT/lib/core/common.sh"
+source "$PROJECT_ROOT/lib/clean/caches.sh"
+mkdir -p "$HOME/Projects/app/.dart_tool" "$HOME/Projects/py/pkg/__pycache__"
+touch "$HOME/Projects/app/pubspec.yaml" "$HOME/Projects/py/pyproject.toml"
+touch "$HOME/Projects/py/pkg/__pycache__/module.pyc"
+git init -q "$HOME/Projects"
+mole_git_ls_files() { return 124; }
+log_operation() { printf 'LOG:%s|%s\n' "$3" "$4" >> "$HOME/oplog"; }
+DRY_RUN=false
+clean_project_caches
+[[ -d "$HOME/Projects/app/.dart_tool" ]] || exit 11
+[[ -f "$HOME/Projects/py/pkg/__pycache__/module.pyc" ]] || exit 12
+grep -q 'git status unknown' "$HOME/oplog" || exit 13
+! grep -q 'tracked by git' "$HOME/oplog" || exit 14
+EOF
+    [ "$status" -eq 0 ] || { echo "$output"; return 1; }
+
+    rm -rf "$HOME/Projects"
+}
+
+@test "clean_project_caches asks Git once per repository" {
+    run env HOME="$HOME" PROJECT_ROOT="$PROJECT_ROOT" /bin/bash --noprofile --norc <<'EOF'
+set -euo pipefail
+source "$PROJECT_ROOT/lib/core/common.sh"
+source "$PROJECT_ROOT/lib/clean/caches.sh"
+repo="$HOME/Projects/mono"
+for pkg in a b c d e f; do
+    mkdir -p "$repo/svc/$pkg/__pycache__"
+    touch "$repo/svc/$pkg/__pycache__/m.pyc"
+done
+touch "$repo/svc/pyproject.toml"
+git init -q "$repo"
+git -C "$repo" add -f svc/c/__pycache__/m.pyc
+eval "real_$(declare -f mole_git_ls_files)"
+mole_git_ls_files() { printf 'call\n' >> "$HOME/ls-files.calls"; real_mole_git_ls_files "$@"; }
+DRY_RUN=false
+clean_project_caches
+[[ "$(wc -l < "$HOME/ls-files.calls" | tr -d ' ')" == 1 ]] || { cat "$HOME/ls-files.calls"; exit 11; }
+[[ -f "$repo/svc/c/__pycache__/m.pyc" ]] || exit 12
+for pkg in a b d e f; do
+    [[ ! -e "$repo/svc/$pkg/__pycache__" ]] || exit 13
+done
+EOF
+    [ "$status" -eq 0 ] || { echo "$output"; return 1; }
+
+    rm -rf "$HOME/Projects"
+}
+
+@test "clean_project_caches keeps tracked Next.js cache files and Flutter build beside a kept .dart_tool" {
+    run env HOME="$HOME" PROJECT_ROOT="$PROJECT_ROOT" /bin/bash --noprofile --norc <<'EOF'
+set -euo pipefail
+source "$PROJECT_ROOT/lib/core/common.sh"
+source "$PROJECT_ROOT/lib/clean/caches.sh"
+repo="$HOME/Projects/site"
+mkdir -p "$repo/web/.next/cache/images" "$repo/flutter/.dart_tool" "$repo/flutter/build"
+touch "$repo/web/package.json" "$repo/flutter/pubspec.yaml"
+printf 'pinned' > "$repo/web/.next/cache/fixture.json"
+touch "$repo/web/.next/cache/images/a.webp" "$repo/flutter/build/out.bin"
+printf '{}' > "$repo/flutter/.dart_tool/package_config.json"
+git init -q "$repo"
+git -C "$repo" add -f web/.next/cache/fixture.json flutter/.dart_tool/package_config.json
+DRY_RUN=false
+clean_project_caches
+# A tracked file directly under .next/cache stays; its untracked sibling goes.
+[[ -f "$repo/web/.next/cache/fixture.json" ]] || exit 11
+[[ ! -e "$repo/web/.next/cache/images" ]] || exit 12
+# build/ is Flutter output only beside a disposable .dart_tool.
+[[ -f "$repo/flutter/.dart_tool/package_config.json" ]] || exit 13
+[[ -f "$repo/flutter/build/out.bin" ]] || exit 14
+EOF
+    [ "$status" -eq 0 ] || { echo "$output"; return 1; }
+
+    rm -rf "$HOME/Projects"
+}
+
+@test "clean_project_caches stops on a signal during the Git listing" {
+    run env HOME="$HOME" PROJECT_ROOT="$PROJECT_ROOT" /bin/bash --noprofile --norc <<'EOF'
+set -uo pipefail
+source "$PROJECT_ROOT/lib/core/common.sh"
+source "$PROJECT_ROOT/lib/clean/caches.sh"
+mkdir -p "$HOME/Projects/py/pkg/__pycache__"
+touch "$HOME/Projects/
```

---

### Incident Patch 14: `19f14e40` (2026-10-05)
**Commit Message**: fix: keep one analyze animation loop across entry points

The refill guard alone left raw tick starts in refresh, navigation, and deletion paths, while Init updated only a model copy. Initialize through Update and route every entry point through the shared guard so fast completions and repeated actions cannot create extra loops.

Cover initialization, active and idle transitions, navigation, deletion, and restart behavior with entry-point regression tests verified against the old code.

**File**: `cmd/analyze/analyze_test.go` (modified, +161/-0)
```diff
@@ -10,6 +10,8 @@ import (
 	"fmt"
 	"os"
 	"path/filepath"
+	"reflect"
+	"runtime"
 	"slices"
 	"strings"
 	"sync/atomic"
@@ -4280,6 +4282,165 @@ func TestOverviewRefillsKeepOneTickLoop(t *testing.T) {
 	}
 }
 
+// Inspect dispatch without running scan, snapshot, or deletion commands. The
+// positive control below pins Bubble Tea's tick and batch command identities.
+func scheduledTickCount(t *testing.T, cmd tea.Cmd) int {
+	t.Helper()
+	if cmd == nil {
+		return 0
+	}
+	name := runtime.FuncForPC(reflect.ValueOf(cmd).Pointer()).Name()
+	if strings.Contains(name, ".Tick.") {
+		return 1
+	}
+	if strings.Contains(name, ".compactCmds[") {
+		batch, ok := cmd().(tea.BatchMsg)
+		if !ok {
+			t.Fatalf("batch command returned an unexpected message: %s", name)
+		}
+		count := 0
+		for _, sub := range batch {
+			count += scheduledTickCount(t, sub)
+		}
+		return count
+	}
+	return 0
+}
+
+func newTickLoopTestModel(t *testing.T, overview bool) model {
+	t.Helper()
+	t.Setenv("HOME", t.TempDir())
+	resetOverviewSnapshotForTest()
+	t.Cleanup(resetOverviewSnapshotForTest)
+	m := newModel(filepath.Join(t.TempDir(), "missing"), false)
+	m.isOverview = overview
+	if overview {
+		m.path = "/"
+	}
+	m.scanning = !overview
+	for i := range maxConcurrentOverview + 3 {
+		m.entries = append(m.entries, dirEntry{
+			Name: fmt.Sprintf("fixture-%d", i), Path: filepath.Join(os.Getenv("HOME"), fmt.Sprintf("missing-%d", i)),
+			IsDir: true, Size: -1,
+		})
+	}
+	return m
+}
+
+func TestTickLoopEntrypoints(t *testing.T) {
+	if got := scheduledTickCount(t, tea.Batch(tickCmd(), tea.Batch(tickCmd(), nil))); got != 2 {
+		t.Fatalf("tick counter positive control = %d, want 2", got)
+	}
+
+	for _, overview := range []bool{false, true} {
+		t.Run(fmt.Sprintf("init overview=%t", overview), func(t *testing.T) {
+			m := newTickLoopTestModel(t, overview)
+			defer func() { m.cancelOverviewScans(nil); m.cancelBackgroundCacheWrites(nil) }()
+			msg := m.Init()()
+			var cmd tea.Cmd
+			if batch, ok := msg.(tea.BatchMsg); ok {
+				cmd = tea.Batch(batch...)
+			} else {
+				updated, next := m.Update(msg)
+				m, cmd = updated.(model), next
+			}
+			if got := scheduledTickCount(t, cmd); got != 1 || !m.tickRunning {
+				t.Fatalf("initial ticks=%d, retained running=%t; want one retained loop", got, m.tickRunning)
+			}
+			if overview {
+				path := m.entries[0].Path
+				updated, refill := m.Update(overviewSizeMsg{Path: path, Size: 1, publication: m.overviewScanningSet[path]})
+				m = updated.(model)
+				if got := scheduledTickCount(t, refill); got != 0 {
+					t.Fatalf("completion before the first tick added %d loops", got)
+				}
+			}
+		})
+	}
+
+	cases := []struct {
+		name  string
+		setup func(*model)
+		msg   tea.Msg
+	}{
+		{"overview refresh", func(m *model) { m.isOverview, m.path = true, "/" }, tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'r'}}},
+		{"directory refresh", func(m *model) {}, tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'r'}}},
+		{"return to pending overview", func(m *model) {}, tea.KeyMsg{Type: tea.KeyEsc}},
+		{"return to full overview", func(m *model) {
+			m.isOverview, m.path = true, "/"
+			m.scheduleOverviewScans()
+			m.isOverview, m.path = false, "/fixture"
+		}, tea.KeyMsg{Type: tea.KeyEsc}},
+		{"history overview", func(m *model) {
+			m.isOverview, m.path = true, "/"
+			m.scheduleOverviewScans()
+			m.history = []historyEntry{{Path: "/", IsOverview: true, Entries: m.entries}}
+			m.isOverview, m.path = false, "/fixture"
+		}, tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'b'}}},
+		{"stale history", func(m *model) {
+			m.history = []historyEntry{{Path: "/fixture/parent", NeedsRefresh: true}}
+		}, tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'b'}}},
+		{"enter directory", func(m *model) {}, tea.KeyMsg{Type: tea.KeyEnter}},
+		{"enter stale directory", func(m *model) {
+			m.cache[m.entries[0].Path] = historyEntry{NeedsRefresh: true}
+		}, tea.KeyMsg{Type: tea.KeyEnter}},
+		{"stale scan result", func(m *model) {}, scanResultMsg{stale: true}},
+		{"single delete", func(m *model) {
+			m.deleteConfirm, m.deleteTarget = true, &m.entries[0]
+		}, tea.KeyMsg{Type: tea.KeyEnter}},
+		{"batch delete", func(m *model) {
+			m.deleteConfirm = true
+			m.multiSelected = map[string]bool{m.entries[0].Path: true, m.entries[1].Path: true}
+		}, tea.KeyMsg{Type: tea.KeyEnter}},
+		{"scan after delete", func(m *model) { m.deleting = true }, deleteProgressMsg{done: true, path: "/fixture/removed"}},
+	}
+	for _, tc := range cases {
+		for _, running := range []bool{false, true} {
+			t.Run(fmt.Sprintf("%s running=%t", tc.name, running), func(t *testing.T) {
+				m := newTickLoopTestModel(t, false)
+				defer func() { m.cancelOverviewScans(nil); m.cancelBackgroundCacheWrites(nil) }()
+				tc.setup(&m)
+				m.tickRunning = running
+				updated, cmd := m.Update(tc.msg)
+				m = updated.(model)
+				want := 1
+				if running {
+					want = 0
+				}
+				if got := scheduledTickCount(t, cmd); got != want || !m.tickRunning {
```

**File**: `cmd/analyze/model.go` (modified, +2/-0)
```diff
@@ -192,6 +192,8 @@ type overviewSizeMsg struct {
 	Err         error
 }
 
+type initializeMsg struct{}
+
 type tickMsg time.Time
 
 type deleteProgressMsg struct {
```

**File**: `cmd/analyze/update.go` (modified, +34/-16)
```diff
@@ -76,10 +76,11 @@ func (m *model) scheduleOverviewScans() tea.Cmd {
 }
 
 func (m model) Init() tea.Cmd {
-	if m.inOverviewMode() {
-		return tea.Batch(m.scheduleOverviewScans(), m.detectLocalSnapshotsCmd())
+	// Init receives a copy. Start work through Update so the running model
+	// retains the tick guard before any scan completion can refill the queue.
+	return func() tea.Msg {
+		return initializeMsg{}
 	}
-	return tea.Batch(m.scanCmd(m.path), tickCmd())
 }
 
 func (m model) scanCmd(path string) tea.Cmd {
@@ -133,8 +134,8 @@ func tickCmd() tea.Cmd {
 
 // startTick arms the animation loop only when none is running. Each loop
 // re-arms itself while work remains, so a second one would double the
-// spinner speed; overview refills start scans one at a time and must not
-// add a loop per completion.
+// spinner speed. Every scan, navigation, and deletion entry point shares
+// this guard, including overview refills before the first tick arrives.
 func (m *model) startTick() tea.Cmd {
 	if m.tickRunning {
 		return nil
@@ -302,6 +303,14 @@ func (m *model) selectEntryPath(path string) {
 
 func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
 	switch msg := msg.(type) {
+	case initializeMsg:
+		var cmd tea.Cmd
+		if m.inOverviewMode() {
+			cmd = tea.Batch(m.scheduleOverviewScans(), m.detectLocalSnapshotsCmd())
+		} else {
+			cmd = tea.Batch(m.scanCmd(m.path), m.startTick())
+		}
+		return m, cmd
 	case tea.KeyMsg:
 		return m.updateKey(msg)
 	case tea.WindowSizeMsg:
@@ -364,7 +373,8 @@ func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
 				if m.currentPath != nil {
 					m.currentPath.Store("")
 				}
-				return m, tea.Batch(m.scanCmd(m.path), tickCmd())
+				cmd := tea.Batch(m.scanCmd(m.path), m.startTick())
+				return m, cmd
 			}
 			if msg.err != nil {
 				m.status = fmt.Sprintf("Failed to delete: %v", msg.err)
@@ -429,7 +439,8 @@ func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
 			if m.currentPath != nil {
 				m.currentPath.Store("")
 			}
-			return m, tea.Batch(m.scanFreshCmd(m.path), tickCmd())
+			cmd := tea.Batch(m.scanFreshCmd(m.path), m.startTick())
+			return m, cmd
 		}
 
 		m.status = scanSummary(m.totalSize, m.scanState)
@@ -613,11 +624,13 @@ func (m model) updateKey(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
 			if len(pathsToDelete) == 1 {
 				targetPath := pathsToDelete[0]
 				m.status = fmt.Sprintf("Deleting %s...", filepath.Base(targetPath))
-				return m, tea.Batch(deletePathCmd(targetPath, m.deleteCount), tickCmd())
+				cmd := tea.Batch(deletePathCmd(targetPath, m.deleteCount), m.startTick())
+				return m, cmd
 			}
 
 			m.status = fmt.Sprintf("Deleting %d items...", len(pathsToDelete))
-			return m, tea.Batch(deleteMultiplePathsCmd(pathsToDelete, m.deleteCount), tickCmd())
+			cmd := tea.Batch(deleteMultiplePathsCmd(pathsToDelete, m.deleteCount), m.startTick())
+			return m, cmd
 		case "esc", "q":
 			m.status = "Cancelled"
 			m.deleteConfirm = false
@@ -738,7 +751,8 @@ func (m model) updateKey(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
 			m.status = "Refreshing..."
 			m.overviewScanning = true
 			m.snapshotProbeID++
-			return m, tea.Batch(m.scheduleOverviewScans(), m.detectLocalSnapshotsCmd(), tickCmd())
+			cmd := tea.Batch(m.scheduleOverviewScans(), m.detectLocalSnapshotsCmd(), m.startTick())
+			return m, cmd
 		}
 
 		m.cancelOverviewScans([]string{m.path})
@@ -755,7 +769,8 @@ func (m model) updateKey(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
 		if m.currentPath != nil {
 			m.currentPath.Store("")
 		}
-		return m, tea.Batch(m.scanBypassingCacheCmd(m.path), tickCmd())
+		cmd := tea.Batch(m.scanBypassingCacheCmd(m.path), m.startTick())
+		return m, cmd
 	case "t", "T":
 		if m.scanning {
 			m.status = "Top files are available after the scan finishes"
@@ -1180,7 +1195,8 @@ func (m model) goBack() (tea.Model, tea.Cmd) {
 		if m.currentPath != nil {
 			m.currentPath.Store("")
 		}
-		return m, tea.Batch(m.scanFreshCmd(m.path), tickCmd())
+		cmd := tea.Batch(m.scanFreshCmd(m.path), m.startTick())
+		return m, cmd
 	}
 	m.status = scanSummary(m.totalSize, m.scanState)
 	m.scanning = false
@@ -1210,12 +1226,12 @@ func (m *model) switchToOverviewMode() tea.Cmd {
 	if cmd == nil {
 		if m.overviewScanning {
 			m.status = "Checking system folders..."
-			return tea.Batch(m.detectLocalSnapshotsCmd(), tickCmd())
+			return tea.Batch(m.detectLocalSnapshotsCmd(), m.startTick())
 		}
 		m.status = "Ready"
 		return m.detectLocalSnapshotsCmd()
 	}
-	return tea.Batch(cmd, m.detectLocalSnapshotsCmd(), tickCmd())
+	return tea.Batch(cmd, m.detectLocalSnapshotsCmd(), m.startTick())
 }
 
 func (m model) enterSelectedDir() (tea.Model, tea.Cmd) {
@@ -1282,7 +1298,8 @@ func (m model) enterSelectedDir() (tea.Model, tea.Cmd) {
 				if m.totalFiles > 0 {
 					m.lastTotalFiles = m.totalFiles
 				}
-				return m, tea.Batch(m.scanFreshCmd(m.path), tickCmd())
+				cmd := tea.Batch(m.scanFreshCmd(m.path), m.startTick())
+				return m, cmd
 			}
 			m.status = fmt.Sprintf(
```

---

### Incident Patch 15: `6aa93263` (2026-10-05)
**Commit Message**: fix(analyze): keep one spinner loop while overview scans refill

Refilling one overview slot per completed scan also armed a new tick loop
each time, and every loop re-arms itself while work remains, so the spinner
sped up with each finished row: five loops for twelve rows where V1.57.0
had two. Arm a loop only when none is running and track it from the tick
handler.

**File**: `cmd/analyze/analyze_test.go` (modified, +49/-3)
```diff
@@ -4237,6 +4237,49 @@ func TestOverviewScanRefillsOnlyAvailableSlots(t *testing.T) {
 	}
 }
 
+// countTickMsgs runs cmd and every command it batches, counting the tick
+// loops it would start. Scan commands for missing fixture paths return fast.
+func countTickMsgs(t *testing.T, cmd tea.Cmd) int {
+	t.Helper()
+	if cmd == nil {
+		return 0
+	}
+	switch msg := cmd().(type) {
+	case tickMsg:
+		return 1
+	case tea.BatchMsg:
+		total := 0
+		for _, sub := range msg {
+			total += countTickMsgs(t, sub)
+		}
+		return total
+	default:
+		return 0
+	}
+}
+
+func TestOverviewRefillsKeepOneTickLoop(t *testing.T) {
+	m := model{path: "/", isOverview: true}
+	for i := range maxConcurrentOverview + 4 {
+		m.entries = append(m.entries, dirEntry{Path: fmt.Sprintf("/nonexistent-mole-fixture/%d", i), Size: -1})
+	}
+	t.Cleanup(func() { m.cancelOverviewScans(nil) })
+	if got := countTickMsgs(t, m.scheduleOverviewScans()); got != 1 {
+		t.Fatalf("initial dispatch started %d tick loops, want 1", got)
+	}
+	// Each completion refills one slot. The running loop keeps the spinner
+	// moving, so a refill that also armed a loop would speed it up per row.
+	for i := range 4 {
+		completed := m.entries[i].Path
+		m.entries[i].Size = 1
+		m.overviewScanningSet[completed].cancel()
+		delete(m.overviewScanningSet, completed)
+		if got := countTickMsgs(t, m.scheduleOverviewScans()); got != 0 {
+			t.Fatalf("refill %d started %d extra tick loops", i+1, got)
+		}
+	}
+}
+
 func TestSwitchToOverviewKeepsFullBudgetScanning(t *testing.T) {
 	t.Setenv("HOME", t.TempDir())
 	resetOverviewSnapshotForTest()
@@ -4273,10 +4316,11 @@ func TestGoBackToOverviewRestartsFullBudgetTick(t *testing.T) {
 	m.path = "/fixture/completed"
 	m.status = "Loaded folder"
 	m.scanning = false
-	_, cmd := m.Update(tickMsg{})
+	stopped, cmd := m.Update(tickMsg{})
 	if cmd != nil {
 		t.Fatal("completed drill-down must stop its tick chain")
 	}
+	m = stopped.(model)
 	updated, cmd := m.goBack()
 	got := updated.(model)
 	if cmd == nil || !got.overviewScanning || got.status == "Loaded folder" {
@@ -4389,7 +4433,9 @@ func TestDeleteCancelsOverviewPublicationBeforeInvalidation(t *testing.T) {
 	}
 	m.path, m.isOverview = "/", true
 	m.entries = []dirEntry{{Name: "Project", Path: root, IsDir: true, Size: -1}, {Name: "Applications", Path: sibling, IsDir: true, Size: -1}}
-	newBatch := m.scheduleOverviewScans()().(tea.BatchMsg)
+	// The first dispatch's tick loop is still running, so this refill is the
+	// scan command alone rather than a batch with another tick.
+	newScan := m.scheduleOverviewScans()
 	newPublication := m.overviewScanningSet[root]
 	if newPublication == nil || newPublication == oldPublication {
 		t.Fatal("replacement scan missing")
@@ -4402,7 +4448,7 @@ func TestDeleteCancelsOverviewPublicationBeforeInvalidation(t *testing.T) {
 	if _, ok := m.overviewSizeCache[root]; ok {
 		t.Fatal("old message restored an in-memory size")
 	}
-	fresh := newBatch[0]().(overviewSizeMsg)
+	fresh := newScan().(overviewSizeMsg)
 	updated, _ = m.Update(fresh)
 	m = updated.(model)
 	if fresh.Err != nil || m.overviewSizeCache[root] != 4096 {
```

**File**: `cmd/analyze/model.go` (modified, +1/-0)
```diff
@@ -215,6 +215,7 @@ type model struct {
 	totalSize           int64
 	scanning            bool
 	spinner             int
+	tickRunning         bool // one tickCmd loop is already re-arming itself
 	filesScanned        *int64
 	dirsScanned         *int64
 	bytesScanned        *int64
```

**File**: `cmd/analyze/update.go` (modified, +16/-2)
```diff
@@ -71,7 +71,7 @@ func (m *model) scheduleOverviewScans() tea.Cmd {
 		}
 	}
 
-	cmds = append(cmds, tickCmd())
+	cmds = append(cmds, m.startTick())
 	return tea.Batch(cmds...)
 }
 
@@ -131,6 +131,18 @@ func tickCmd() tea.Cmd {
 	})
 }
 
+// startTick arms the animation loop only when none is running. Each loop
+// re-arms itself while work remains, so a second one would double the
+// spinner speed; overview refills start scans one at a time and must not
+// add a loop per completion.
+func (m *model) startTick() tea.Cmd {
+	if m.tickRunning {
+		return nil
+	}
+	m.tickRunning = true
+	return tickCmd()
+}
+
 func (m *model) cancelLiveScan() {
 	if m.liveScanCancel != nil {
 		m.liveScanCancel()
@@ -551,8 +563,10 @@ func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
 					m.status = fmt.Sprintf("Moving to Trash... %s items", formatNumber(count))
 				}
 			}
+			m.tickRunning = true
 			return m, tickCmd()
 		}
+		m.tickRunning = false
 		return m, nil
 	default:
 		return m, nil
@@ -1147,7 +1161,7 @@ func (m model) goBack() (tea.Model, tea.Cmd) {
 			cmd := m.scheduleOverviewScans()
 			if cmd == nil && m.overviewScanning {
 				m.status = "Checking system folders..."
-				cmd = tickCmd()
+				cmd = m.startTick()
 			}
 			return m, cmd
 		}
```

#### Recent Merged Pull Requests:
- **PR #1691** (2026-10-06): fix(clean): name what timed out; a go clean timeout skips only that cache (@HaraldNordgren)
- **PR #1690** (2026-10-06): fix(clean): keep the DiagnosticReports directory when cleaning user logs (@md786-dotcom)
- **PR #1688** (2026-10-06): Keep operation history tied to each run (@M-Hassan-Raza)
- **PR #1686** (2026-10-05): fix(clean): keep project caches that Git tracks (@cdeil)
- **PR #1683** (2026-10-05): test: isolate cleanup process probes and strengthen Xcode guards (@Yuxin-Qiao)
- **PR #1682** (2026-10-05): test: isolate Mail and remaining batch uninstall fixtures (@Yuxin-Qiao)
- **PR #1681** (2026-10-04): test(uninstall): isolate batch fixtures from host inventory (@Yuxin-Qiao)
- **PR #1680** (2026-10-04): fix(purge): share root scan deadline with content probes (@Yuxin-Qiao)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
