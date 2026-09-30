# Forensic Learning Record (Deep Inspection): tw93/Mole

> **Canonical Artifact**: `07_PROJECT_LEARNING/tw93-mole-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/tw93/Mole](https://github.com/tw93/Mole))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:36:32.483Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tw93/Mole`
- **Description**: 🐹 Clean, uninstall, analyze, optimize, and monitor your Mac. Free open-source CLI, plus a native Mac app.
- **Primary Language / Ecosystem**: Shell
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 68865 stars

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
const cacheSchemaVersion = 6

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
		tm
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

// moveToTrashViaFinder remain
```

### Core Architecture Module: `cmd/analyze/format.go`
```
//go:build darwin

package main

import (
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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1647** (2026-09-30): **mo status: network rates are wrong when traffic goes through a virtual interface (utun*)**
  *Symptoms*: Environment - Mole 1.56.0 (Homebrew) - macOS 26 (Darwin 25.6.0), Apple Silicon  Description When the default route goes through a virtual interface like utun* (a VPN, a packet-tunnel network extension, WireGuard, and so on), mo status doesn't report network activity correctly. It only lists physical interfaces (en0, en4, en6…) and leaves out all utun* interfaces. For those it just shows a Proxy: TUN utun0+ label.  It gets worse when a tunnel network extension is active: macOS may count inbound packets only on the virtual interface. The physical interface then reports 0 received bytes, so Mole shows download = 0 all the time, even during heavy transfers.  Steps to reproduce 1. Connect to any VPN or tunnel that creates a utun* interface and sets it as the default route (route -n get default → interface: utunN). 2. Generate traffic, for example a large download. 3. Run mo status --json (or --watch).  Expected Network rates include the interface that actually carries the traffic, utunN here.  Actual utunN is missing and en0 shows rx_rate_mbs: 0:  "network": [   {"name": "en0", "rx_rate_mbs": 0, "tx_rate_mbs": 0.059, "ip": "10.x.x.x"},   {"name": "en4", "rx_rate_mbs": 0, "tx_rate_mbs": 0, "ip": ""},   {"name": "en6", "rx_rate_mbs": 0, "tx_rate_mbs": 0, "ip": ""} ], "proxy": {"enabled": true, "type": "TUN", "host": "utun0+"}  Kernel counters (netstat -ib) at the same time:  Name   Ipkts     Ibytes        Opkts    Obytes en0    0         0             3832524  1237606173 utunN  1827
  **Post-Mortem & Fix Analysis**:
  > @cookiemonsterq Thanks for reporting this. The IPv4 default-route tunnel is now included in nightly, and the network graph uses its rates without adding the same traffic from the physical interface. IPv6 and split-tunnel accounting are not covered by this change.  Your Homebrew installation follows stable releases. To try nightly separately, make sure Go is installed (`brew install go` if needed), then run:  ```sh installer=$(mktemp -t mole-install) curl -fsSL https://raw.githubusercontent.com/tw93/Mole/main/install.sh -o "$installer" &&   bash "$installer" main --prefix "$HOME/.local/bin" "$HOME/.local/bin/mo" status ```  Please reopen if download traffic still stays at zero with the tunnel as the IPv4 default route. 

- **Issue #1645** (2026-09-29): **[BUG] opendesign 卸载不干净**
  *Symptoms*: mole 卸载 opendesign  <img width="1372" height="397" alt="Image" src="https://github.com/user-attachments/assets/19fd8220-43e5-42b0-b520-c8fcb15f1a8b" />

- **Issue #1624** (2026-09-28): **[BUG] mo uninstall fails with exit 1 during same-bundle scan on enterprise/restricted macOS (sudo blocked, scan fails before escalation)**
  *Symptoms*: ## Before submitting  - [x] I updated and reproduced the problem, or this report explains why I cannot update.  ## Describe the bug  In version 1.56.0, `mo uninstall` fails unconditionally during the live same-bundle scan step when executed on a restricted or enterprise-managed macOS machine (MDM / managed permissions / custom URL handlers).  Because `mo` explicitly disallows running via `sudo` (`Run Mole without sudo`), and the internal privilege escalation step happens **after** the scan phase, the tool enters a deadlock where the scan fails before requesting necessary access, completely blocking uninstallation.  ## Steps to reproduce  1. Run command: `mo uninstall` 2. Select any installed application (e.g., Google Chrome or Safe Exam Browser). 3. Proceed with uninstallation. 4. The scanner fails with `Could not verify whether other installs share... bundle id; nothing was removed` and exits with code 1.  ## Expected behavior  Scan failures (such as missing or unresolvable Bundle IDs, or restricted system index access) should log a warning instead of triggering a fatal `exit 1` error that cancels the entire uninstallation transaction. Alternatively, a flag like `--skip-scan` should be provided to bypass same-bundle checks.  ## Debug logs  <details> <summary>Debug output</summary>  ```text ---------------------------------------------------------------------- Mole Debug Session, 2026-09-28 08:44:16 ---------------------------------------------------------------------- User: 
  **Post-Mortem & Fix Analysis**:
  > @ilypopv Thanks for the detailed report and the debug log.  This is fixed in V1.56.1. When Mole cannot finish checking for other copies of an app, for example because package receipts or an app folder are unreadable on a managed Mac, it no longer stops the uninstall. It removes only the app you selected and leaves any shared leftovers in place, with a warning that says why. Mole still refuses to run under sudo on purpose, and no extra flag is needed.  The Homebrew update to 1.56.1 is in review now. Once it lands, run `brew upgrade mole` and retry `mo uninstall`. If it still fails, reopen this issue with the new `mo uninstall --debug` output. 

- **Issue #1620** (2026-09-27): **[Mac App Bug] 卸载应用后 Dock 最近使用区域出现多余图标残留**
  *Symptoms*: ### Mole Mac app version  1.15.0 (294)  ### macOS version  27.2.0  ### Mac model  Mac14,2 (Apple M2)  ### Affected area  Uninstall  ### What happened?  我使用 OnyX 调整过 Dock 中「最近使用的应用程序」的显示数量。系统默认数量为 3 个，我将其修改为 5 个。  在最新版本中发现一个小问题：卸载应用程序之后，Dock 的最近使用区域会残留两个多余的应用图标。如果恢复系统默认的 3 个，则不会出现这个现象。  这个问题可能比较少见，因为大多数用户应该不会修改 Dock 最近使用应用的数量。不过我还是想反馈一下，主要是因为在之前的版本中，即使将这个数量调整为 5 个，卸载应用后也不会出现多余 Dock 图标残留的情况。  ### Steps to reproduce  卸载程序后出现。  ### Expected behavior  这个问题可能比较少见，因为大多数用户应该不会修改 Dock 最近使用应用的数量。不过我还是想反馈一下，主要是因为在之前的版本中，即使将这个数量调整为 5 个，卸载应用后也不会出现多余 Dock 图标残留的情况。  这个问题对正常使用基本没有影响，我认为优先级很低，只是作为一个边缘场景反馈。如果开发者有时间，希望可以排查一下相关逻辑。  感谢。  ### Screenshots or safe logs  _No response_  ### Before submitting  - [x] I updated to the latest stable Mole Mac app, reopened it, and reproduced this problem (or this report explains why I cannot update). - [x] I did not include license keys, order numbers, or private data.
  **Post-Mortem & Fix Analysis**:
  > <img width="59" height="218" alt="Image" src="https://github.com/user-attachments/assets/6b552f6e-3b9a-4c52-a070-43318efd44d2" />
  > @WangXinyubeta11 感谢反馈，截图里多出来的两个是 Dock 最近使用列表里 Mole 自己的重复记录，卸载完成后 Mole 会让 Dock 重新加载一次，这些重复的记录就一起显示了出来。  现在卸载后整理 Dock 时，最近使用区域里同一个 App 只保留一项，你固定在 Dock 上的图标不受影响，这个修复已经在 Mac App 代码里，会跟下一个版本一起发布，之前那条命令不用再跑了。  眼下多出来的图标可以右键选「选项 > 从程序坞中移除」去掉，更新到下个版本后如果还出现，直接在这里回复我就好。 
  > 开发者您好，  这个问题应该是我更改了 dock 最近程序显示数量导致的。 默认三个的情况下是不会出现的。  Last login: Sun Sep 27 14:28:15 on ttys000 ***@***.*** ~ % defaults read com.apple.dock recent-apps | grep -E '"bundle-identifier"|_CFURLString" =' | sed "s|$HOME|~|g"             "bundle-identifier" = "com.apple.ActivityMonitor";                 "_CFURLString" = "file:///System/Applications/Utilities/Activity%20Monitor.app/";             "bundle-identifier" = "com.apple.Terminal";                 "_CFURLString" = "file:///System/Applications/Utilities/Terminal.app/";             "bundle-identifier" = "com.tw93.MoleApp";                 "_CFURLString" = "file:///Applications/Mole.app/";             "bundle-identifier" = "com.tw93.MoleApp";                 "_CFURLString" = "file:///Applications/Mole.app/";             "bundle-identifier" = "com.tw93.MoleApp";                 "_CFURLString" = "file:///Applications/Mole.app/"; ***@***.*** ~ %    祝好，   Kind Regards,   ——— Xinyu Wang (王新宇)   Mobile: +86 186 6905 

- **Issue #1614** (2026-09-23): **[Mac App Bug]  与其他 mihomo 系 TUN 应用（如 Clash Verge）同时全局接管时路由冲突，且退出后残留路由」**
  *Symptoms*: ### Mole Mac app version  v1.14.0  ### macOS version  macOS 27  ### Mac model  MacBook Pro M3 Pro  ### Affected area  Optimize  ### What happened?  Mole 与 Clash Verge 等同样是 mihomo 内核的全局 TUN 应用同时运行时，谁先启动谁抢到全网段路由，后启动的一方 TUN 静默失效；且 Mole 退出后路由和 utun 接口没有被清理，残留路由会继续阻塞其他应用的 TUN，只能手动 sudo route delete 清理。  ### Steps to reproduce  复现步骤     1. 同时安装 Mole（增强/全局模式）和 Clash Verge（服务模式 + TUN 模式），均设为开机启动    2. 重启 Mac，让 Mole 先于 Clash 内核启动（本例：Mole 9:47 启动，Clash 内核在其后启动）    3. 观察 Clash 内核日志：Start TUN listening error: configure tun interface: add route: 1.0.0.0/8: file exists，TUN 创建中止；Clash 界面却显示 TUN 已开启    4. 此时系统里所有不走系统代理的流量全部由 Mole 接管，用户感知为「另一个代理软件失效」     手动复现：先启动 Mole，再启动任意 mihomo TUN 内核（verge-mihomo -f 配置）必现。     证据     Mole 运行时安装的路由（即标准 mihomo auto-route 全覆盖路由集）：     ```      1/8      28.0.0.1  UGSc  utun4      2/7      28.0.0.1  UGSc  utun4      4/6      28.0.0.1  UGSc  utun4      8/5      28.0.0.1  UGSc  utun4      16/4     28.0.0.1  UGSc  utun4      32/3     28.0.0.1  UGSc  utun4      64/2     28.0.0.1  UGSc  utun4      128.0/1  28.0.0.1  UGSc  utun4      （utun4: inet 28.0.0.1 --> 28.0.0.1 netmask 0xfffffffc）    ```     后启动的 mihomo 内核报错（root 也一样）：     ```      level=error msg="Start TUN listening error: configure tun interface: add route: 1.0.0.0/8: file exists"    ```     mihomo 将首个路由冲突视为致命错误，整个 TUN 栈中止。     关联问题：退出后残留     正常退出 Mole（App 进程已结束）后，上述 9 条路由和 utun4 接口仍然残留（接口 UP、路由指向已死的 28.0.0.1），其他应用随后再启动 TUN 依然 file exists，只能手动清理：     ```bash      sudo sh -c 'for r in 1.0.0.0/8 2.0.0.0/7 4.
  **Post-Mortem & Fix Analysis**:
  > @hutengqi 感谢反馈，我核对了 Mole 1.14.0 的发布代码和权限，Mole 不包含 mihomo/TUN 内核、Network Extension 权限或写入、删除路由的实现，`utun` 只用于读取网络状态，systemhelper 也不管理隧道和路由。你上传的日志只记录了独立 mihomo 进程遇到的路由冲突，没有证据表明这些路由由 Mole 创建，因此这个问题不属于 Mole，请检查当时运行的代理或 VPN 进程及其启动项。 
  > 实在抱歉，这是 我 和 KIMI K2.8 的错误，今天又排查了一遍，确定是 Clash Verge 2.5.5 的问题，下面是 KIMI Code 的回复：  查清楚了。作者是对的，昨天我判断成“Mole 冲突”是错的，真正的病根在 Clash Verge Rev 自己身上：9 月 23 日上午的静默自动更新（2.5.2 → 2.5.5）把它的服务模式搞乱了，导致同时存在两个 mihomo 核心进程互相抢端口和 TUN 路由——你上    传的日志里那个“遇到路由冲突的独立 mihomo 进程”，冲突对端是另一个 mihomo，不是 Mole。     昨天（09-23）的完整时间线     本地日志都在 ~/Library/Application Support/io.github.clash-verge-rev.clash-verge-rev/logs/，证据链如下：     1. 09:48 2.5.2 正常运行（服务模式：root 下的 verge-mihomo + TUN）。同时静默更新器开始下载 v2.5.5，09:54 下载完。    2. 10:04 退出装更新，但退出不干净：日志里明确有 重置系统代理超时，继续退出，退出码 1。    3. 10:19 2.5.5 首次启动即异常：service IPC is unavailable: IPC path unavailable: No such file or directory——新版连不上特权助手服务，服务检测失败。    4. 10:20 强制重装服务后核心启动（session generation 1）。    5. 10:34–10:35 反复重启，出现 Service no longer tracks a core for this owner ... mixed proxy port 7897 is unattributed——Verge 自己丢了核心的归属记录。    6. 10:36:08（关键证据）一个用户态 sidecar mihomo 启动时报错：Start Mixed(http+socks) server error: listen tcp :7897: bind: address already in use。7897 是 mihomo 的 mixed 端口——当时必然

- **Issue #1609** (2026-09-23): **[Mac App Bug]**
  *Symptoms*: ### Mole Mac app version  1.15.0 (286)  ### macOS version  27.2.0  ### Mac model  Mac14,2 (Apple M2)  ### Affected area  Clean  ### What happened?  开发者您好：  我在使用 Mole 清理系统时发现一个可能需要调整清理规则的问题。  Mole 以「卸载残留」扫描到  /Library/Audio/Apple Loops/Apple/Final Cut Pro Sound Effects/  在我的 Mac 上，这部分内容大约占用 463 MB。  但这些文件删除后，macOS 的「软件更新」会重新检测到缺失的 Final Cut Pro 补充内容，并再次提供相关更新/安装提示，要求重新下载安装。系统设置角标会一直有红色角标显示。  ### Steps to reproduce  卸载残留  ### Expected behavior  因此建议考虑将：  /Library/Audio/Apple Loops/Apple/Final Cut Pro Sound Effects/   默认排除。  虽然程序已经提示「需确认」或永不清理，但对于这种可能造成重新下载的并非「残留」的内容，是否下次更新可以直接排除，有些小白用户可能会觉得比较麻烦。  或者至少在删除前明确提示：这是 Final Cut Pro 的官方附加内容，删除后可能会再次出现在 macOS 软件更新中并被要求重新安装。  这样可以避免用户把它误认为单纯的缓存或无用文件。  ### Screenshots or safe logs  _No response_  ### Before submitting  - [x] I am using the latest Mole Mac app build available from https://mole.fit. - [x] I did not include license keys, order numbers, or private data.
  **Post-Mortem & Fix Analysis**:
  > @WangXinyubeta11 已经修复，Mole 现在会保留 Final Cut Pro 的补充音效内容，不再把 `/Library/Audio/Apple Loops/Apple/Final Cut Pro Sound Effects/` 列为可清理的卸载残留。  修复已进入 Preview 287，辛苦下载 https://mole.fit/Mole-preview.dmg 再扫描一次，如果仍然出现这条，欢迎重新打开问题告诉我。 

- **Issue #1598** (2026-09-22): **[Mac App Bug] Homebrew cask update issue**
  *Symptoms*: ### Mole Mac app version  V1.14.0  ### macOS version  macOS 27.0  ### Mac model  MacBook Pro M3 Pro  ### Affected area  Download / update  ### What happened?  Update in Mole shown Citrix Workspace (Homebrew): 26.09.0→26.09.0.17  <img width="2186" height="544" alt="Image" src="https://github.com/user-attachments/assets/85f21638-5e93-4e98-91e3-bde11ddc0a6a" />  brew info citrix-workspace shows version 26.09.0.17 installed:  <img width="1270" height="598" alt="Image" src="https://github.com/user-attachments/assets/664c2ee6-a5d9-4f29-85cc-fe36cbb3e69f" />    ### Steps to reproduce  1. Open Mole 2. Go to Apps, Updates 3. Check for updates  ### Expected behavior  Update should not be visible. Also, if you select update, it says: > Still showing as available after recheck  <img width="2180" height="526" alt="Image" src="https://github.com/user-attachments/assets/bf90a8c1-9051-4c93-8428-23ed87073b57" />  ### Screenshots or safe logs  _No response_  ### Before submitting  - [x] I am using the latest Mole Mac app build available from https://mole.fit. - [x] I did not include license keys, order numbers, or private data.
  **Post-Mortem & Fix Analysis**:
  > @BlazGoricar Thanks for reporting this. The false Citrix Workspace update prompt is fixed in Preview build 285.  Download [the latest Preview](https://mole.fit/Mole-preview.dmg), replace Mole, and check for updates again. Citrix 26.09.0.17 should no longer appear as an available update when that version is already installed. I am closing this as fixed; please reopen it if the prompt still appears. 
  > @tw93 Thank you for your reply. I downloaded the Preview build 285 and can confirm that the issue has been fixed.

- **Issue #1596** (2026-09-23): **[Mac App Bug] It can not detect a app installed with pkg file. such as Tailscale client.**
  *Symptoms*: ### Mole Mac app version  1.14.0  ### macOS version  macOS 27  ### Mac model  MacBook Pro M5  ### Affected area  Uninstall  ### What happened?  I installed Tailscale client with pkg file. I can't uninstall it with Mole. I can't find the Tailscale app in Mole.  ### Steps to reproduce  1. Download Tailscale app in its official website. 2. Install the pkg. 3. Open Mole try to uninstall it. 4. It can not found Tailescale app.  ### Expected behavior  I expect to uninstall Tailscale app with Mole.  ### Actual behavior  It didn't show it in software list.  ### Screenshots or safe logs  _No response_  ### Before submitting  - [x] I am using the latest Mole Mac app build available from https://mole.fit. - [x] I did not include license keys, order numbers, or private data.
  **Post-Mortem & Fix Analysis**:
  > @lolieatcat Sorry Tailscale is missing from the list. Could you run this diagnostic command in Terminal so I can check why Mole is not detecting it?  ```sh curl -fsSL 'https://mole.fit/downloads/Mole-Diagnose.command' | bash ```  When it finishes, email the zip it creates on your Desktop to hi@mole.fit with #1596 in the subject. I will use it to investigate the missing entry. 
  > @lolieatcat thanks for the report. The current Preview revalidates the installed-app list whenever you return to Software, so a PKG-installed app such as `/Applications/Tailscale.app` is picked up instead of remaining hidden behind an older cached list.  Please try Preview 287 from https://mole.fit/Mole-preview.dmg and reopen this issue if Tailscale still does not appear. 

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

### Incident Patch 1: `c430bac6` (2026-09-30)
**Commit Message**: fix(clean): keep probe timeouts from cancelling unrelated cleanup (#1656)

Retain targets when shared handle or Codex staging probes cannot establish whether they are idle, while allowing unrelated cleanup to continue. Preserve interruption and deletion-timeout cancellation, and cover visibility, final guards, dry-run previews, and subsequent cleanup in regression tests.

**File**: `AGENTS.md` (modified, +1/-1)
```diff
@@ -118,7 +118,7 @@ Public docs and examples should prefer the installed `mo` command. Use `./mole`
 - Sudo gates must not treat typed password characters as "skip". Only an explicit skip key should skip privileged cleanup; direct typed input must proceed into the real sudo prompt and have a regression test.
 - Long cleanup scans need both an overall wall-clock budget and inner-loop checkpoints. A timed-out producer must not feed partial output into a deletion loop: materialize only completed scans, discard results on nonzero status, and propagate timeout/failure instead of reporting success. Probe and action must use the same pattern, type, age, and depth. If a project/artifact scan times out, degrade to partial or skipped-slow-scan output instead of appearing hung.
 - Orphan leftover `mdfind` / size timeouts fail closed for that item and must not cancel later `mo clean` sections. A leftover sink timeout stays sticky. Locked by the `#1584` cases in `tests/clean_apps.bats`.
-- SQLite open-handle probe timeouts mean unknown: retain the database family without cancelling unrelated cleanup. Signal interruptions and deletion timeouts still cancel. Preserve cancellation statuses through uninstall validation and both Trash batch sinks, stop before later candidates, and keep the completed-path ledger intact. The shared SQLite probe owns this distinction for validation, final-sink, cache-directory, and dry-run callers; locked by the `#1595` cases in `tests/core_safe_functions.bats`.
+- Read-only exact-path, SQLite, container-cache, Codex staging, and complete-visibility probe timeouts mean unknown: retain the target or database family without cancelling unrelated cleanup. Signal interruptions and deletion timeouts still cancel. Preserve cancellation statuses through uninstall validation and both Trash batch sinks, stop before later candidates, and keep the completed-path ledger intact. The shared handle probes own this distinction for validation, final-sink, cache-directory, and dry-run callers, including a partially consumed shared deadline; locked by the `#1595` and `#1653` cases in `tests/core_safe_functions.bats`.
 - **Join simulator data on `runtimeIdentifier` from `-j` output, never on a printed runtime name.** The two listings title the same runtime differently, so a name join offers `simctl runtime delete` for a runtime its simulators still bind (story in `.claude/skills/bugs/references/shell-and-test-pitfalls.md` section 7). A reclaim recommendation additionally needs `state: Ready`, `deletable: true`, and exactly one installed image serving that identifier, because the device list cannot say which of two images its devices belong to. Locked by the `#1505` test in `tests/clean_orphaned_runtimes.bats`.
 - **Every simctl read goes through `_run_simctl`.** `clean_dev_mobile` pins its probe count in `tests/dev_extended.bats`; a raw `run_with_timeout ... xcrun simctl` bypasses the stub, so added probes stay invisible to that assertion instead of being weighed by it.
 - System-service orphan scans must parse plist `Program` / `ProgramArguments` values as absolute paths only. Use non-interactive sudo for unreadable root-owned plists when needed, reject PlistBuddy error text as data, and keep CI tests on `/Library/LaunchDaemons` rather than relying on `/Library/PrivilegedHelperTools`.
```

**File**: `lib/clean/dev.sh` (modified, +2/-0)
```diff
@@ -4144,6 +4144,8 @@ codex_sparkle_staging_has_open_files() {
         lsof_rc=$?
     fi
 
+    # An inconclusive read keeps this staging root without cancelling other cleanup.
+    mole_rc_timeout "$lsof_rc" && return 2
     if mole_rc_timeout_or_signal "$lsof_rc"; then
         return "$lsof_rc"
     fi
```

**File**: `lib/core/file_ops.sh` (modified, +13/-10)
```diff
@@ -631,16 +631,7 @@ _mole_sqlite_database_in_use() {
     # empty array is an unbound-variable error under set -u.
     [[ ${#family[@]} -gt 0 ]] || return 1
 
-    local handle_rc=0
-    _mole_paths_have_open_handle "${family[@]}" || handle_rc=$?
-    if mole_rc_timeout "$handle_rc"; then
-        # A read-only handle probe that timed out proves neither idle nor live.
-        # Keep this family without cancelling unrelated cleanup (#1595).
-        # Signals and deletion timeouts retain their cancellation semantics.
-        debug_log "SQLite handle probe timed out, keeping database: $path"
-        return 2
-    fi
-    return "$handle_rc"
+    _mole_paths_have_open_handle "${family[@]}"
 }
 
 _mole_user_cache_sqlite_has_open_handle() {
@@ -711,6 +702,8 @@ _mole_complete_lsof_mode() {
     local records=""
     local probe_rc=0
     records=$(run_with_timeout "$probe_timeout" lsof -F pu -p 1 < /dev/null 2>&1) || probe_rc=$?
+    # A timed-out read proves nothing: retain this item, continue other cleanup.
+    mole_rc_timeout "$probe_rc" && return 2
     if mole_rc_timeout_or_signal "$probe_rc"; then
         return "$probe_rc"
     fi
@@ -733,6 +726,8 @@ _mole_complete_lsof_mode() {
     records=""
     probe_rc=0
     records=$(run_with_timeout "$probe_timeout" sudo -n lsof -F pu -p 1 < /dev/null 2>&1) || probe_rc=$?
+    # A timed-out read proves nothing: retain this item, continue other cleanup.
+    mole_rc_timeout "$probe_rc" && return 2
     if mole_rc_timeout_or_signal "$probe_rc"; then
         return "$probe_rc"
     fi
@@ -778,6 +773,10 @@ _mole_paths_have_open_handle() {
     # flag meant to explain the run was quietly changing it.
     open_records=$(MO_DEBUG=0 _mole_run_complete_lsof "$MOLE_TIMEOUT_QUICK_DETECT_SEC" \
         -F n -- "$@" 2>&1) || lsof_rc=$?
+    if mole_rc_timeout "$lsof_rc"; then
+        # An incomplete read-only probe is unknown, not a run cancellation.
+        return 2
+    fi
     if mole_rc_timeout_or_signal "$lsof_rc"; then
         return "$lsof_rc"
     fi
@@ -842,6 +841,10 @@ _mole_container_cache_has_open_handle() {
             -F pfn -- "$path" 2>&1) || lsof_rc=$?
     fi
 
+    if mole_rc_timeout "$lsof_rc"; then
+        # An incomplete read-only probe is unknown, not a run cancellation.
+        return 2
+    fi
     if mole_rc_timeout_or_signal "$lsof_rc"; then
         return "$lsof_rc"
     fi
```

**File**: `tests/clean_dev_caches.bats` (modified, +40/-1)
```diff
@@ -1767,7 +1767,7 @@ EOF
 
     [ "$status" -eq 0 ]
     [[ "$output" == *"skipped (open-file check unavailable)"* ]] || return 1
-    [[ "$output" == *"CANCEL=124"* ]] || return 1
+    [[ "$output" == *"CANCEL=0"* ]] || return 1
     [[ "$output" != *"SAFE_CLEAN:"* ]] || return 1
 
     run env HOME="$HOME" PROJECT_ROOT="$PROJECT_ROOT" DRY_RUN=true /bin/bash --noprofile --norc << 'EOF'
@@ -3870,3 +3870,42 @@ EOF
         [[ "$output" == *"CANCEL=0"* ]] || return 1
     done
 }
+
+@test "Codex staging query timeout keeps the target without cancelling later cleanup (#1653)" {
+    run env HOME="$HOME" PROJECT_ROOT="$PROJECT_ROOT" /bin/bash --noprofile --norc <<'EOF'
+set -euo pipefail
+source "$PROJECT_ROOT/lib/core/common.sh"
+source "$PROJECT_ROOT/lib/clean/dev.sh"
+_MOLE_COMPLETE_LSOF_MODE=direct
+_MOLE_CODEX_STAGING_ROOT="$HOME/Library/Caches/com.openai.codex/staging"
+mkdir -p "$_MOLE_CODEX_STAGING_ROOT"
+target="$_MOLE_CODEX_STAGING_ROOT/payload"
+printf 'keep' > "$target"
+_codex_staging_entry_is_still_stale() { return 0; }
+codex_desktop_process_state() { return 1; }
+codex_sparkle_updater_running() { return 1; }
+lsof() { return "$scripted_rc"; }
+run_with_timeout() { shift; "$@"; }
+MOLE_CURRENT_COMMAND=clean
+for scripted_rc in 124 130 143; do
+    MOLE_CLEAN_CANCEL_STATUS=0
+    probe_rc=0
+    codex_sparkle_staging_has_open_files "$_MOLE_CODEX_STAGING_ROOT" || probe_rc=$?
+    guard_rc=0
+    _codex_staging_delete_guard_allows || guard_rc=$?
+    [[ $guard_rc -ne 0 ]] || safe_remove "$target" true 1
+    next="$HOME/later-$scripted_rc.log"
+    printf 'later' > "$next"
+    next_rc=0
+    safe_remove "$next" true 1 || next_rc=$?
+    printf 'STATUS=%s PROBE=%s GUARD=%s CANCEL=%s NEXT=%s\n' "$scripted_rc" "$probe_rc" "$guard_rc" "$MOLE_CLEAN_CANCEL_STATUS" "$next_rc"
+    [[ -f "$target" ]] || exit 1
+    if [[ "$scripted_rc" == 124 ]]; then
+        [[ $probe_rc -eq 2 && $guard_rc -ne 0 && $MOLE_CLEAN_CANCEL_STATUS -eq 0 && $next_rc -eq 0 && ! -e "$next" ]] || exit 1
+    else
+        [[ $probe_rc -eq $scripted_rc && $guard_rc -ne 0 && $MOLE_CLEAN_CANCEL_STATUS -eq $scripted_rc && $next_rc -eq $scripted_rc && -f "$next" ]] || exit 1
+    fi
+done
+EOF
+    [ "$status" -eq 0 ] || { echo "$output"; return 1; }
+}
```

**File**: `tests/core_safe_functions.bats` (modified, +162/-5)
```diff
@@ -25,6 +25,95 @@ teardown() {
     rm -rf "$TEST_DIR"
 }
 
+# Exercise production guards and sinks with only lsof's response scripted.
+# Each case gets a separate home, and the later ordinary file is independently
+# removable, so a preserved file cannot mask a sticky-cancellation regression.
+check_handle_probe_outcome() {
+    local kind="$1" scripted_rc="$2" stage="$3" dry_run="${4:-0}"
+    local fixture="$TEST_DIR/probe-$kind-$scripted_rc-$stage-$dry_run"
+    mkdir -p "$fixture"
+    run env HOME="$fixture" PROJECT_ROOT="$PROJECT_ROOT" kind="$kind" \
+        scripted_rc="$scripted_rc" stage="$stage" MOLE_DRY_RUN="$dry_run" \
+        /bin/bash --noprofile --norc <<'EOF'
+set -euo pipefail
+source "$PROJECT_ROOT/bin/clean.sh"
+[[ "$MOLE_DRY_RUN" == 0 ]] || DRY_RUN=true
+case "$kind" in
+    download) target="$HOME/Downloads/first.crdownload" ;;
+    container) target="$HOME/Library/Containers/com.example.Probe/Data/Library/Caches/First" ;;
+    group) target="$HOME/Library/Group Containers/TEAM.com.example.probe/Library/Caches/first.log" ;;
+esac
+mkdir -p "$(dirname "$target")"
+if [[ "$kind" == container ]]; then
+    mkdir -p "$target"
+    printf 'keep\n' > "$target/state"
+else
+    printf 'keep\n' > "$target"
+fi
+next="$HOME/next.log"
+printf 'later\n' > "$next"
+: > "$HOME/probes"
+: > "$HOME/sinks"
+: > "$HOME/previews"
+MOLE_CURRENT_COMMAND=clean
+MOLE_CLEAN_CANCEL_STATUS=0
+_mole_user_cache_owner_process_state() { return 1; }
+[[ "$stage" == visibility ]] || _MOLE_COMPLETE_LSOF_MODE=direct
+lsof() {
+    printf '%s\n' "$*" >> "$HOME/probes"
+    # Return a genuinely idle result until sizing completes in the final case.
+    if [[ "$stage" == final && ! -f "$HOME/sized" ]]; then
+        return 1
+    fi
+    return "$scripted_rc"
+}
+run_with_timeout() { shift; "$@"; }
+oplog_enabled() { return 0; }
+get_path_size_kb() { touch "$HOME/sized"; printf '1\n'; }
+rm() {
+    printf '%s\n' "$*" >> "$HOME/sinks"
+    command rm "$@" # SAFE: production safe_remove validates isolated fixture paths before this mock
+}
+register_dry_run_cleanup_target() { printf '%s\n' "$*" >> "$HOME/previews"; }
+first_rc=0
+safe_remove "$target" true || first_rc=$?
+second_rc=0
+safe_remove "$next" true 1 || second_rc=$?
+printf 'CASE=%s/%s/%s DRY=%s\n' "$kind" "$scripted_rc" "$stage" "$MOLE_DRY_RUN"
+printf 'FIRST=%s SECOND=%s CANCEL=%s TARGET=%s NEXT=%s\n' \
+    "$first_rc" "$second_rc" "$MOLE_CLEAN_CANCEL_STATUS" \
+    "$(test -e "$target" && echo kept || echo removed)" \
+    "$(test -e "$next" && echo kept || echo removed)"
+[[ -s "$HOME/probes" ]] || exit 1
+if [[ "$stage" == visibility ]]; then
+    grep -q -- '-F pu -p 1' "$HOME/probes" || exit 1
+else
+    grep -qF -- "$target" "$HOME/probes" || exit 1
+fi
+if [[ "$stage" == final ]]; then
+    [[ -f "$HOME/sized" ]] || exit 1
+fi
+if [[ "$MOLE_DRY_RUN" == 1 ]]; then
+    [[ ! -s "$HOME/sinks" ]] || exit 1
+    grep -qF -- "$next" "$HOME/previews" || exit 1
+    if grep -qF -- "$target" "$HOME/previews"; then exit 1; fi
+elif [[ "$scripted_rc" == 124 ]]; then
+    grep -qF -- "$next" "$HOME/sinks" || exit 1
+    if grep -qF -- "$target" "$HOME/sinks"; then exit 1; fi
+else
+    [[ ! -s "$HOME/sinks" ]] || exit 1
+fi
+EOF
+    [ "$status" -eq 0 ] || { echo "$output"; return 1; }
+    if [[ "$scripted_rc" == 124 ]]; then
+        local next_state=removed
+        [[ "$dry_run" == 0 ]] || next_state=kept
+        [[ "$output" == *"FIRST=1 SECOND=0 CANCEL=0 TARGET=kept NEXT=$next_state"* ]] || { echo "$output"; return 1; }
+    else
+        [[ "$output" == *"FIRST=$scripted_rc SECOND=$scripted_rc CANCEL=$scripted_rc TARGET=kept NEXT=kept"* ]] || { echo "$output"; return 1; }
+    fi
+}
+
 @test "validate_path_for_deletion rejects empty path" {
     run /bin/bash -c "source '$PROJECT_ROOT/lib/core/common.sh'; validate_path_for_deletion ''"
     [ "$status" -eq 1 ]
@@ -925,11 +1014,7 @@ validate_path_for_deletion "$cache_dir" || validation_rc=$?
 printf 'PROBE=%s RC=%s\n' "$pr
```

---

### Incident Patch 2: `df24cded` (2026-09-30)
**Commit Message**: fix(status): account for default-route tunnel traffic (#1648)

Use the IPv4 default-route tunnel for network card and history totals while retaining per-interface JSON counters. Bound route discovery to full samples so fast refreshes do not spawn commands.

**File**: `README.md` (modified, +2/-0)
```diff
@@ -252,6 +252,8 @@ Select a location to explore:
 
 `mo status` is a read-only dashboard for hardware, system pressure, disk activity, network traffic, power, and processes.
 
+When the IPv4 default route uses a tunnel, network graphs use that interface’s rates to avoid counting the same traffic again on its physical carrier. JSON retains per-interface rates, including the routed tunnel; idle non-default tunnels stay hidden.
+
 ```text
 $ mo status
 
```

**File**: `cmd/status/metrics.go` (modified, +19/-17)
```diff
@@ -173,10 +173,11 @@ type DiskStatus struct {
 }
 
 type NetworkStatus struct {
-	Name      string  `json:"name"`
-	RxRateMBs float64 `json:"rx_rate_mbs"`
-	TxRateMBs float64 `json:"tx_rate_mbs"`
-	IP        string  `json:"ip"`
+	defaultTunnel bool    // Sample-local routing hint; not part of the JSON contract.
+	Name          string  `json:"name"`
+	RxRateMBs     float64 `json:"rx_rate_mbs"`
+	TxRateMBs     float64 `json:"tx_rate_mbs"`
+	IP            string  `json:"ip"`
 }
 
 // NetworkHistory holds the global network usage history.
@@ -242,18 +243,19 @@ type Collector struct {
 	lastBT   []BluetoothDevice
 
 	// Fast metrics (1s).
-	prevNet        map[string]net.IOCountersStat
-	lastNetAt      time.Time
-	rxHistoryBuf   *RingBuffer
-	txHistoryBuf   *RingBuffer
-	lastNetIPAt    time.Time
-	cachedNetIPs   map[string]string
-	lastGPUAt      time.Time
-	cachedGPU      []GPUStatus
-	lastGPUUsageAt time.Time
-	cachedGPUUsage float64
-	prevDiskIO     disk.IOCountersStat
-	lastDiskAt     time.Time
+	prevNet             map[string]net.IOCountersStat
+	lastNetAt           time.Time
+	rxHistoryBuf        *RingBuffer
+	txHistoryBuf        *RingBuffer
+	lastNetIPAt         time.Time
+	cachedNetIPs        map[string]string
+	defaultNetInterface string
+	lastGPUAt           time.Time
+	cachedGPU           []GPUStatus
+	lastGPUUsageAt      time.Time
+	cachedGPUUsage      float64
+	prevDiskIO          disk.IOCountersStat
+	lastDiskAt          time.Time
 
 	watchMu           sync.Mutex
 	processWatch      ProcessWatchConfig
@@ -457,7 +459,7 @@ func (c *Collector) collectFull() (MetricsSnapshot, error) {
 			return nil
 		},
 		func() (err error) { collected.diskIO = c.collectDiskIO(now); return nil },
-		func() (err error) { collected.netStats = c.collectNetwork(now); return nil },
+		func() (err error) { collected.netStats = c.collectNetworkFull(now); return nil },
 		func() error {
 			collected.proxyStats = collectProxy()
 			next.proxy = collected.proxyStats
```

**File**: `cmd/status/metrics_network.go` (modified, +58/-10)
```diff
@@ -43,6 +43,12 @@ func (c *Collector) primeNetworkCounters(now time.Time) {
 	}
 }
 
+// Only full collection may spawn commands; fast frames reuse the latest route.
+func (c *Collector) collectNetworkFull(now time.Time) []NetworkStatus {
+	c.defaultNetInterface = defaultRouteInterface()
+	return c.collectNetwork(now)
+}
+
 func (c *Collector) collectNetwork(now time.Time) []NetworkStatus {
 	if c.prevNet == nil {
 		c.prevNet = make(map[string]net.IOCountersStat)
@@ -65,6 +71,7 @@ func (c *Collector) collectNetwork(now time.Time) []NetworkStatus {
 
 	// Map interface IPs.
 	ifAddrs := c.getInterfaceIPsCached(now)
+	defaultInterface := c.defaultNetInterface
 
 	if c.lastNetAt.IsZero() {
 		c.lastNetAt = now
@@ -80,7 +87,7 @@ func (c *Collector) collectNetwork(now time.Time) []NetworkStatus {
 
 	var result []NetworkStatus
 	for _, cur := range stats {
-		if isNoiseInterface(cur.Name) {
+		if (isNoiseInterface(cur.Name) || isTunnelInterface(cur.Name)) && cur.Name != defaultInterface {
 			continue
 		}
 		prev, ok := c.prevNet[cur.Name]
@@ -90,10 +97,11 @@ func (c *Collector) collectNetwork(now time.Time) []NetworkStatus {
 		rx := float64(counterDelta(cur.BytesRecv, prev.BytesRecv)) / 1024.0 / 1024.0 / elapsed
 		tx := float64(counterDelta(cur.BytesSent, prev.BytesSent)) / 1024.0 / 1024.0 / elapsed
 		result = append(result, NetworkStatus{
-			Name:      cur.Name,
-			RxRateMBs: rx,
-			TxRateMBs: tx,
-			IP:        ifAddrs[cur.Name],
+			Name:          cur.Name,
+			RxRateMBs:     rx,
+			TxRateMBs:     tx,
+			IP:            ifAddrs[cur.Name],
+			defaultTunnel: cur.Name == defaultInterface && isTunnelInterface(cur.Name),
 		})
 	}
 
@@ -103,17 +111,17 @@ func (c *Collector) collectNetwork(now time.Time) []NetworkStatus {
 	}
 
 	sort.Slice(result, func(i, j int) bool {
+		// Keep the routed tunnel visible even when its physical carrier is busier.
+		if result[i].defaultTunnel != result[j].defaultTunnel {
+			return result[i].defaultTunnel
+		}
 		return result[i].RxRateMBs+result[i].TxRateMBs > result[j].RxRateMBs+result[j].TxRateMBs
 	})
 	if len(result) > 3 {
 		result = result[:3]
 	}
 
-	var totalRx, totalTx float64
-	for _, r := range result {
-		totalRx += r.RxRateMBs
-		totalTx += r.TxRateMBs
-	}
+	totalRx, totalTx := networkTotals(result)
 
 	// Update history using the global/aggregated stats
 	c.rxHistoryBuf.Add(totalRx)
@@ -122,6 +130,46 @@ func (c *Collector) collectNetwork(now time.Time) []NetworkStatus {
 	return result
 }
 
+// The IPv4 default route identifies the active tunnel without guessing from
+// cumulative bytes on idle system tunnels. A failed probe keeps physical rates.
+func defaultRouteInterface() string {
+	ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
+	defer cancel()
+	out, err := runCmd(ctx, "route", "-n", "get", "default")
+	if err != nil {
+		return ""
+	}
+	for line := range strings.Lines(out) {
+		key, value, ok := strings.Cut(strings.TrimSpace(line), ":")
+		if ok && key == "interface" {
+			return strings.TrimSpace(value)
+		}
+	}
+	return ""
+}
+
+func isTunnelInterface(name string) bool {
+	for _, prefix := range []string{"utun", "tun", "ipsec", "ppp"} {
+		if strings.HasPrefix(name, prefix) {
+			return true
+		}
+	}
+	return false
+}
+
+// Tunnel and carrier counters describe overlapping traffic. Keep both as
+// interface rows, but use the routed tunnel for the card and history totals.
+func networkTotals(stats []NetworkStatus) (rx, tx float64) {
+	for _, n := range stats {
+		if n.defaultTunnel {
+			return n.RxRateMBs, n.TxRateMBs
+		}
+		rx += n.RxRateMBs
+		tx += n.TxRateMBs
+	}
+	return rx, tx
+}
+
 func (c *Collector) getInterfaceIPsCached(now time.Time) map[string]string {
 	if c.cachedNetIPs != nil && now.Sub(c.lastNetIPAt) < networkIPCacheTTL {
 		return c.cachedNetIPs
```

**File**: `cmd/status/metrics_network_test.go` (modified, +86/-0)
```diff
@@ -1,7 +1,9 @@
 package main
 
 import (
+	"context"
 	"encoding/json"
+	"errors"
 	"strings"
 	"testing"
 	"time"
@@ -226,3 +228,87 @@ func TestTunnelHintDoesNotExpandProxyJSONContract(t *testing.T) {
 		t.Fatalf("proxy JSON contract changed: got %s, want %s", encoded, want)
 	}
 }
+
+func TestCollectNetworkDefaultTunnel(t *testing.T) {
+	originalIO, originalRun := ioCountersFunc, runCmd
+	t.Cleanup(func() { ioCountersFunc, runCmd = originalIO, originalRun })
+	const mb = 1024 * 1024
+	now := time.Now()
+	route := "utun4"
+	routeErr := false
+	runCmd = func(ctx context.Context, name string, args ...string) (string, error) {
+		if name != "route" || strings.Join(args, " ") != "-n get default" {
+			t.Fatalf("unexpected probe %s %v", name, args)
+		}
+		if _, ok := ctx.Deadline(); !ok {
+			t.Fatal("route probe has no deadline")
+		}
+		if routeErr {
+			return "", errors.New("no default route")
+		}
+		return "   route to: default\n  interface: " + route + "\n      flags: <UP,GATEWAY>\n", nil
+	}
+	names := []string{"en0", "en4", "en6", "utun4", "ppp0", "ipsec0", "utun9"}
+	counters := make([]gopsutilnet.IOCountersStat, len(names))
+	for i, name := range names {
+		counters[i] = gopsutilnet.IOCountersStat{Name: name, BytesRecv: 100 * mb, BytesSent: 100 * mb}
+	}
+	ioCountersFunc = func(bool) ([]gopsutilnet.IOCountersStat, error) {
+		return append([]gopsutilnet.IOCountersStat(nil), counters...), nil
+	}
+	c := &Collector{prevNet: make(map[string]gopsutilnet.IOCountersStat), cachedNetIPs: map[string]string{"en0": "192.0.2.1"}, lastNetIPAt: now}
+	c.primeNetworkCounters(now)
+	for _, step := range []struct {
+		route  string
+		fail   bool
+		wantRx float64
+	}{
+		{"utun4", false, 2}, {"ppp0", false, 3}, {"ipsec0", false, 4}, {"en0", false, 30}, {"utun4", true, 30},
+	} {
+		route, routeErr = step.route, step.fail
+		for i := range counters {
+			rate := uint64(10)
+			if i >= 3 {
+				rate = uint64(i - 1)
+			}
+			counters[i].BytesRecv += rate * mb
+			counters[i].BytesSent += mb
+		}
+		now = now.Add(time.Second)
+		got := c.collectNetworkFull(now)
+		wantTunnel := route != "en0" && !routeErr
+		found := false
+		for _, n := range got {
+			if !strings.HasPrefix(n.Name, "en") {
+				if !wantTunnel || n.Name != route {
+					t.Fatalf("unexpected idle/non-default tunnel: %+v", got)
+				}
+				found = true
+			}
+		}
+		if found != wantTunnel {
+			t.Fatalf("default route %s missing from counters: %+v", route, got)
+		}
+		rx := c.rxHistoryBuf.Slice()
+		if rx[len(rx)-1] != step.wantRx {
+			t.Fatalf("route %s: history = %v, want %v", route, rx, step.wantRx)
+		}
+		card := renderNetworkCard(got, NetworkHistory{}, ProxyStatus{}, 40)
+		if !strings.Contains(card.lines[0], formatRate(step.wantRx)) {
+			t.Fatalf("card and history disagree: %v", card.lines)
+		}
+		encoded, err := json.Marshal(got)
+		if err != nil {
+			t.Fatal(err)
+		}
+		var rows []map[string]any
+		if err := json.Unmarshal(encoded, &rows); err != nil {
+			t.Fatal(err)
+		}
+		for _, row := range rows {
+			if len(row) != 4 {
+				t.Fatalf("network JSON shape changed: %s", encoded)
+			}
+		}
+	}
+}
```

**File**: `cmd/status/view.go` (modified, +1/-3)
```diff
@@ -721,12 +721,10 @@ func miniBar(percent float64) string {
 
 func renderNetworkCard(netStats []NetworkStatus, history NetworkHistory, proxy ProxyStatus, cardWidth int) cardData {
 	var lines []string
-	var totalRx, totalTx float64
+	totalRx, totalTx := networkTotals(netStats)
 	var primaryIP string
 
 	for _, n := range netStats {
-		totalRx += n.RxRateMBs
-		totalTx += n.TxRateMBs
 		if primaryIP == "" && n.IP != "" && n.Name == "en0" {
 			primaryIP = n.IP
 		}
```

---

### Incident Patch 3: `519cfa48` (2026-09-30)
**Commit Message**: test: serialize cleanup fixtures with short subprocess budgets

Parallel workers can exhaust one-second safety fixture budgets before the mocked action starts. Run these files with the existing timing-sensitive group without relaxing assertions or production timeouts.

**File**: `scripts/test.sh` (modified, +5/-3)
```diff
@@ -268,7 +268,9 @@ if command -v bats > /dev/null 2>&1 && [ -d "tests" ]; then
     fi
 
     # Some test files include wall-clock timing assertions that are skewed by
-    # CPU contention from parallel test workers. When parallel mode is active,
+    # CPU contention from parallel test workers. Safety/optimize fixtures also
+    # use 1-2s subprocess budgets that must reach their mocked action first.
+    # When parallel mode is active,
     # split them out to run sequentially after the parallel batch completes.
     _sequential_files=()
     if [[ ${#bats_opts[@]} -gt 0 ]]; then
@@ -277,14 +279,14 @@ if command -v bats > /dev/null 2>&1 && [ -d "tests" ]; then
         if [[ ${#_all[@]} -eq 1 && -d "${_all[0]}" ]]; then
             while IFS= read -r _f; do
                 case "$_f" in
-                    *core_performance.bats | *regression.bats) _sequential_files+=("$_f") ;;
+                    *core_performance.bats | *regression.bats | *core_safe_functions.bats | *optimize.bats) _sequential_files+=("$_f") ;;
                     *) _rest+=("$_f") ;;
                 esac
             done < <(find "${_all[0]}" -type f -name '*.bats' | sort)
         else
             for _f in "${_all[@]}"; do
                 case "$_f" in
-                    *core_performance.bats | *regression.bats) _sequential_files+=("$_f") ;;
+                    *core_performance.bats | *regression.bats | *core_safe_functions.bats | *optimize.bats) _sequential_files+=("$_f") ;;
                     *) _rest+=("$_f") ;;
                 esac
             done
```

---

### Incident Patch 4: `8d49b365` (2026-09-30)
**Commit Message**: fix(uninstall): identify denied Finder automation

Surface the actual Apple Events permission when Finder returns -1743, even after another privacy warning. Stop the spinner and avoid a second generic hint that points to unrelated permissions.

**File**: `lib/core/file_ops.sh` (modified, +7/-0)
```diff
@@ -2709,6 +2709,13 @@ APPLESCRIPT
     if [[ $finder_rc -ne 0 ]]; then
         debug_log "Finder failed to move application to Trash (exit $finder_rc): $path: $finder_output"
         mole_rc_timeout_or_signal "$finder_rc" && return "$finder_rc"
+        if [[ "$finder_output" == *"(-1743)"* && -z "${_MOLE_FINDER_AUTOMATION_WARNED:-}" ]]; then
+            _MOLE_FINDER_AUTOMATION_WARNED=1
+            _MOLE_PRIVACY_DENIED_WARNED=1
+            export _MOLE_PRIVACY_DENIED_WARNED
+            declare -F stop_inline_spinner > /dev/null && stop_inline_spinner
+            printf 'Error: macOS blocked Finder automation. Allow your terminal app to control Finder in System Settings > Privacy & Security > Automation, then retry.\n' >&2
+        fi
         return 1
     elif [[ -e "$path" || -L "$path" ]]; then
         debug_log "Finder returned success but the application remains: $path"
```

**File**: `tests/file_ops_mole_delete.bats` (modified, +11/-2)
```diff
@@ -1585,9 +1585,10 @@ EOF
 }
 
 
-@test "Finder failure records stderr and the actual exit status" {
+@test "Finder automation denial names the permission and records the actual error (#1644)" {
     run_finder_result_fixture 1
-    [[ "$output" == "RC=1" ]] || return 1
+    [[ "$output" == *"Privacy & Security > Automation"* ]] || return 1
+    [[ "$output" == *"RC=1"* ]] || return 1
     [[ -d "$SANDBOX/FinderFixture.app" ]] || return 1
     local diagnostic
     diagnostic=$(cat "$SANDBOX/finder-debug.log")
@@ -1716,3 +1717,11 @@ EOF
     done
     [ "$failures" -eq 0 ]
 }
+
+@test "Finder Automation denial is explained after an earlier generic privacy refusal (#1644)" {
+    export _MOLE_PRIVACY_DENIED_WARNED=1
+    run_finder_result_fixture 1
+    [[ "$output" == *"Privacy & Security > Automation"* ]] || return 1
+    [[ "$output" == *"RC=1"* ]] || return 1
+    [[ -d "$SANDBOX/FinderFixture.app" ]] || return 1
+}
```

---

### Incident Patch 5: `07fcc562` (2026-09-30)
**Commit Message**: fix(clean): restore editor VSIX download cache targets

The live editor cleaner lost the VS Code and Cursor package cache targets during dispatch refactoring. Restore those download caches while keeping installed extensions and settings outside these targets.

**File**: `lib/clean/app_caches.sh` (modified, +2/-1)
```diff
@@ -441,7 +441,8 @@ clean_editor_obsolete_extensions() {
 clean_code_editors() {
     safe_clean ~/Library/Application\ Support/Code/logs/* "VS Code logs"
     safe_clean ~/Library/Application\ Support/Code/Cache/* "VS Code cache"
-    safe_clean ~/Library/Application\ Support/Code/CachedExtensions/* "VS Code extension cache"
+    safe_clean ~/Library/Application\ Support/Code/CachedExtensionVSIXs/* "VS Code extension cache"
+    safe_clean ~/Library/Application\ Support/Cursor/CachedExtensionVSIXs/* "Cursor extension cache"
     safe_clean ~/Library/Application\ Support/Code/CachedData/* "VS Code data cache"
     safe_clean ~/Library/Application\ Support/Code/WebStorage/*/CacheStorage/* "VS Code webview cache"
     safe_clean ~/Library/Caches/com.sublimetext.*/* "Sublime Text cache"
```

**File**: `tests/clean_app_caches.bats` (modified, +23/-0)
```diff
@@ -2931,3 +2931,26 @@ EOF
     [[ "$output" == *"CLEAN:$ext_root/remove-true"* ]] || return 1
     [[ "$output" != *"CLEAN:$ext_root/keep-"* ]] || return 1
 }
+
+@test "code editor VSIX download caches stay separate from installed extensions (#1654)" {
+    mkdir -p "$HOME/.vscode/extensions/keep-active-1654"
+    touch "$HOME/.vscode/extensions/keep-active-1654/package.json"
+    for editor in Code Cursor; do
+        mkdir -p "$HOME/Library/Application Support/$editor/CachedExtensionVSIXs"
+        mkdir -p "$HOME/Library/Application Support/$editor/User"
+        touch "$HOME/Library/Application Support/$editor/CachedExtensionVSIXs/example.vsix"
+        touch "$HOME/Library/Application Support/$editor/User/settings.json"
+    done
+    run env HOME="$HOME" PROJECT_ROOT="$PROJECT_ROOT" /bin/bash --noprofile --norc <<'EOF'
+set -euo pipefail
+source "$PROJECT_ROOT/lib/core/common.sh"
+source "$PROJECT_ROOT/lib/clean/app_caches.sh"
+safe_clean() { printf 'CLEAN:%s\n' "$1"; }
+clean_code_editors
+EOF
+    [ "$status" -eq 0 ] || return 1
+    [[ "$output" == *"Code/CachedExtensionVSIXs/example.vsix"* ]] || return 1
+    [[ "$output" == *"Cursor/CachedExtensionVSIXs/example.vsix"* ]] || return 1
+    [[ "$output" != *"/User/"* ]] || return 1
+    [[ "$output" != *"/.vscode/extensions/keep-active-1654"* ]] || return 1
+}
```

---

### Incident Patch 6: `1d9057ad` (2026-09-29)
**Commit Message**: test: isolate cleanup fixtures and support serial runs

Keep outcome and deadline tests independent of host inventory and scheduler timing while asserting the actual probe sequence. Support one-job Bats runs and record receipt failure stages without weakening production timeouts.

**File**: `scripts/test.sh` (modified, +3/-1)
```diff
@@ -249,7 +249,9 @@ if command -v bats > /dev/null 2>&1 && [ -d "tests" ]; then
         # --no-parallelize-within-files ensures each test file's tests run
         # sequentially (they share a $HOME set by setup_file and are not safe
         # to run concurrently). Parallelism is only across files.
-        bats_opts+=("--jobs" "$_jobs" "--no-parallelize-within-files")
+        if [[ $_jobs -gt 1 ]]; then
+            bats_opts+=("--jobs" "$_jobs" "--no-parallelize-within-files")
+        fi
         unset _ncpu _jobs
     fi
     if [[ "${MOLE_TEST_TIMING:-0}" == "1" ]]; then
```

**File**: `tests/clean_automation_browsers.bats` (modified, +10/-0)
```diff
@@ -54,6 +54,13 @@ set -euo pipefail
 source "$PROJECT_ROOT/lib/core/common.sh"
 source "$PROJECT_ROOT/lib/clean/dev.sh"
 DRY_RUN="$DRY"
+# These cases exercise process identity, not timeout backend scheduling.
+# Keep the real ps fixtures and PID rebind checks behind the same call boundary.
+run_with_timeout() {
+    [[ $# -ge 2 && "$1" == "$MOLE_TIMEOUT_QUICK_DETECT_SEC" && "$2" == ps ]] || return 99
+    shift
+    "$@"
+}
 kill() { printf 'KILL %s\n' "$*" >> "$TRACE"; return 0; }
 sleep() { :; }
 safe_clean() {
@@ -74,8 +81,10 @@ EOF
 @test "does not signal a PID replaced between discovery and TERM" {
     make_process_stubs
     : > "$HOME/kill.trace"
+    : > "$HOME/ps.trace"
     cat > "$HOME/bin/ps" <<'SCRIPT'
 #!/bin/bash
+printf '%s\n' "$*" >> "$HOME/ps.trace"
 if [[ "$1" == "-Ao" ]]; then
     printf '%s\n' '  902     1 01-20:00:00 Tue Sep  1 02:03:04 2026 /Applications/Chrome.app/x --user-data-dir=/tmp/playwright_chromiumdev_profile-old'
 else
@@ -86,6 +95,7 @@ SCRIPT
 
     run_cleanup false
     [ "$status" -eq 0 ] || { echo "$output"; return 1; }
+    [[ "$(cat "$HOME/ps.trace")" == $'-Ao pid=,ppid=,etime=,lstart=,command= -ww\n-p 902 -o pid=,ppid=,etime=,lstart=,command= -ww' ]] || { cat "$HOME/ps.trace"; return 1; }
     [[ "$output" == *"stopped 0 processes"* ]] || { echo "$output"; return 1; }
     [ ! -s "$HOME/kill.trace" ] || { cat "$HOME/kill.trace"; return 1; }
 }
```

**File**: `tests/clean_system_maintenance.bats` (modified, +34/-17)
```diff
@@ -35,35 +35,46 @@ mock_run_with_timeout_skipping_var_folders() {
 }
 export -f mock_run_with_timeout_skipping_var_folders
 
-@test "materialize_completed_system_scan discards a timed-out partial prefix" {
-    local slow_scan="$HOME/partial-system-scan.sh"
+@test "materialize_completed_system_scan discards every failed producer prefix" {
+    local producer="$HOME/partial-system-scan.sh"
     local trace="$HOME/partial-system-scan.trace"
-    cat > "$slow_scan" <<'SCRIPT'
+    cat > "$producer" <<'SCRIPT'
 #!/bin/bash
-printf 'started\n' >> "$SYSTEM_SCAN_TRACE"
+printf 'started:%s\n' "$PRODUCER_RC" >> "$SYSTEM_SCAN_TRACE"
 printf 'partial\0'
-exec sleep 4
+exit "$PRODUCER_RC"
 SCRIPT
-    chmod +x "$slow_scan"
+    chmod +x "$producer"
 
-    run env HOME="$HOME" PROJECT_ROOT="$PROJECT_ROOT" SLOW_SCAN="$slow_scan" \
-        SYSTEM_SCAN_TRACE="$trace" \
-        /bin/bash --noprofile --norc <<'SCRIPT'
+    local code
+    for code in 124 1 130; do
+        : > "$trace"
+        run env HOME="$HOME" PROJECT_ROOT="$PROJECT_ROOT" PRODUCER="$producer" \
+            SYSTEM_SCAN_TRACE="$trace" PRODUCER_RC="$code" \
+            /bin/bash --noprofile --norc <<'SCRIPT'
 set -euo pipefail
 source "$PROJECT_ROOT/lib/core/common.sh"
 source "$PROJECT_ROOT/lib/clean/system.sh"
+# The timeout backend has its own real-clock tests. This case exercises the
+# materializer's command boundary and complete-output contract deterministically.
+run_with_timeout() {
+    [[ $# -eq 2 && "$1" == 5 && "$2" == "$PRODUCER" ]] || return 99
+    shift
+    "$@"
+}
 scan_file=$(create_temp_file)
 rc=0
-materialize_completed_system_scan "$scan_file" 1 "$SLOW_SCAN" || rc=$?
+materialize_completed_system_scan "$scan_file" 5 "$PRODUCER" || rc=$?
 printf 'RC=%s\n' "$rc"
 printf 'BYTES=%s\n' "$(wc -c < "$scan_file" | tr -d ' ')"
 rm -f -- "$scan_file"
 SCRIPT
 
-    [ "$status" -eq 0 ]
-    [[ "$output" == *"RC=124"* ]] || return 1
-    [[ "$(< "$trace")" == "started" ]] || return 1
-    [[ "$output" == *"BYTES=0"* ]]
+        [ "$status" -eq 0 ] || { echo "$output"; return 1; }
+        [[ "$output" == *"RC=$code"* ]] || return 1
+        [[ "$(< "$trace")" == "started:$code" ]] || return 1
+        [[ "$output" == *"BYTES=0"* ]] || return 1
+    done
 }
 
 @test "materialize_completed_system_scan preserves NUL-delimited paths with newlines" {
@@ -79,16 +90,22 @@ SCRIPT
 set -euo pipefail
 source "$PROJECT_ROOT/lib/core/common.sh"
 source "$PROJECT_ROOT/lib/clean/system.sh"
+run_with_timeout() {
+    [[ $# -eq 2 && "$1" == 5 && "$2" == "$PRODUCER" ]] || return 99
+    shift
+    "$@"
+}
 scan_file=$(create_temp_file)
-materialize_completed_system_scan "$scan_file" 1 "$PRODUCER"
+materialize_completed_system_scan "$scan_file" 5 "$PRODUCER"
 record=""
-IFS= read -r -d '' record < "$scan_file" || true
+IFS= read -r -d '' record < "$scan_file" || exit 1
 [[ "$record" == $'/Volumes/Backup/line\nbreak.inProgress' ]] || exit 1
+[[ "$(wc -c < "$scan_file" | tr -d ' ')" == 38 ]] || exit 1
 printf 'PRESERVED\n'
 rm -f -- "$scan_file"
 SCRIPT
 
-    [ "$status" -eq 0 ] || return 1
+    [ "$status" -eq 0 ] || { echo "$output"; return 1; }
     [[ "$output" == "PRESERVED" ]]
 }
 
```

**File**: `tests/installer_zip.bats` (modified, +16/-6)
```diff
@@ -409,19 +409,29 @@ EOF
     export INSTALLER_TRACE="$BATS_TEST_TMPDIR/archive-trace"
     # shellcheck disable=SC2016 # Expanded by the fake command at execution time.
     mole_test_fake_command fd 'printf "%s\0" "$HOME/Downloads/first.zip" "$HOME/Downloads/second.zip" "$HOME/Downloads/third.zip"'
-    # shellcheck disable=SC2016 # Expanded by the fake command at execution time.
-    mole_test_fake_command zipinfo 'printf "%s\n" "$2" >> "$INSTALLER_TRACE"; sleep 3; printf "Installer.app/\n"'
+    mole_test_fake_command zipinfo 'printf "Installer.app/\n"'
     # shellcheck disable=SC2016 # The child shell evaluates this script.
     run env MOLE_TIMEOUT_DISK_VERIFY_SEC=6 MOLE_TIMEOUT_SHORT_QUERY_SEC=7 /bin/bash --noprofile --norc -c '
         export MOLE_TEST_MODE=1
         source "$1"
+        # Isolate cumulative deadline arithmetic from shell startup and scheduling.
+        # Unsetting SECONDS removes its automatic clock before assigning test time.
+        unset SECONDS
+        SECONDS=0
+        run_with_timeout() {
+            local duration="$1"
+            shift
+            if [[ "$1" == zipinfo ]]; then
+                printf "%s %s\n" "$duration" "${3##*/}" >> "$INSTALLER_TRACE"
+                SECONDS=$((SECONDS + 3))
+            fi
+            "$@"
+        }
         rc=0
         scan_installers_in_path "$HOME/Downloads" > "$2" || rc=$?
         mole_rc_timeout "$rc" || exit 1
-        [[ ! -s "$2" && $SECONDS -lt 9 ]] || exit 1
-        grep -q first.zip "$INSTALLER_TRACE" || exit 1
-        grep -q second.zip "$INSTALLER_TRACE" || exit 1
-        ! grep -q third.zip "$INSTALLER_TRACE" || exit 1
+        [[ ! -s "$2" && $SECONDS -eq 6 ]] || exit 1
+        [[ "$(cat "$INSTALLER_TRACE")" == "$(printf "6 first.zip\n3 second.zip")" ]] || exit 1
     ' bash "$PROJECT_ROOT/bin/installer.sh" "$BATS_TEST_TMPDIR/scan-output"
     [ "$status" -eq 0 ]
 }
```

**File**: `tests/optimize_probe_outcomes.bats` (modified, +30/-6)
```diff
@@ -267,26 +267,37 @@ set -euo pipefail
 source "$PROJECT_ROOT/lib/core/common.sh"
 source "$PROJECT_ROOT/lib/optimize/tasks.sh"
 unset MOLE_TEST_NO_AUTH MOLE_TEST_MODE
+mkdir -p "$HOME"
+: > "$HOME/audit.trace"
+# This outcome test needs a completed inventory, not the host's installed apps.
+_login_item_build_app_inventory() {
+    [[ $# -eq 2 && -f "$1" && "$2" =~ ^[0-9]+$ ]] || return 99
+    : > "$1"
+    printf 'inventory\n' >> "$HOME/audit.trace"
+}
+run_with_timeout() { printf 'unexpected probe:%s\n' "$*" >> "$HOME/audit.trace"; return 99; }
 
 _login_items_snapshot() {
     printf 'Confirmed Missing\t\nUnknown Item\t\n'
 }
 _login_item_app_exists() {
+    printf 'resolver:%s\n' "$1" >> "$HOME/audit.trace"
     case "$1" in
         "Confirmed Missing") return 1 ;;
         *) return 124 ;;
     esac
 }
 
 execute_optimization login_items_audit
+[[ "$(cat "$HOME/audit.trace")" == $'inventory\nresolver:Confirmed Missing\nresolver:Unknown Item' ]] || { cat "$HOME/audit.trace"; exit 1; }
 printf 'FAILED=%s ATTENTION=%s\n' \
     "$(optimize_outcome_count failed)" "$(optimize_outcome_count attention)"
 EOF
 
 	[[ "$status" -eq 0 ]] || { echo "$output"; return 1; }
-	[[ "$output" == *"Login items audit incomplete"* ]] || return 1
-	[[ "$output" == *"FAILED=1 ATTENTION=0"* ]] || return 1
-	[[ "$output" != *"Broken login item"* ]] || return 1
+	[[ "$output" == *"Login items audit incomplete"* ]] || { echo "$output"; return 1; }
+	[[ "$output" == *"FAILED=1 ATTENTION=0"* ]] || { echo "$output"; return 1; }
+	[[ "$output" != *"Broken login item"* ]] || { echo "$output"; return 1; }
 }
 
 @test "login item audit still reports conclusively absent items" {
@@ -295,18 +306,31 @@ set -euo pipefail
 source "$PROJECT_ROOT/lib/core/common.sh"
 source "$PROJECT_ROOT/lib/optimize/tasks.sh"
 unset MOLE_TEST_NO_AUTH MOLE_TEST_MODE
+mkdir -p "$HOME"
+: > "$HOME/audit.trace"
+# This outcome test needs a completed inventory, not the host's installed apps.
+_login_item_build_app_inventory() {
+    [[ $# -eq 2 && -f "$1" && "$2" =~ ^[0-9]+$ ]] || return 99
+    : > "$1"
+    printf 'inventory\n' >> "$HOME/audit.trace"
+}
+run_with_timeout() { printf 'unexpected probe:%s\n' "$*" >> "$HOME/audit.trace"; return 99; }
 
 _login_items_snapshot() { printf 'Confirmed Missing\t\n'; }
-_login_item_app_exists() { return 1; }
+_login_item_app_exists() {
+    printf 'resolver:%s\n' "$1" >> "$HOME/audit.trace"
+    return 1
+}
 
 execute_optimization login_items_audit
+[[ "$(cat "$HOME/audit.trace")" == $'inventory\nresolver:Confirmed Missing' ]] || { cat "$HOME/audit.trace"; exit 1; }
 printf 'FAILED=%s ATTENTION=%s\n' \
     "$(optimize_outcome_count failed)" "$(optimize_outcome_count attention)"
 EOF
 
 	[[ "$status" -eq 0 ]] || { echo "$output"; return 1; }
-	[[ "$output" == *"Broken login item: Confirmed Missing"* ]] || return 1
-	[[ "$output" == *"FAILED=0 ATTENTION=1"* ]] || return 1
+	[[ "$output" == *"Broken login item: Confirmed Missing"* ]] || { echo "$output"; return 1; }
+	[[ "$output" == *"FAILED=0 ATTENTION=1"* ]] || { echo "$output"; return 1; }
 }
 
 @test "login item audit reuses one fallback app inventory" {
```

---

### Incident Patch 7: `29b2f22e` (2026-09-29)
**Commit Message**: fix: preserve cancellation through uninstall guards and Trash batches

Stop later candidates when validation or a Trash move is interrupted, while preserving completed-path accounting and clearing bound identities. Document the preview and asynchronous cache invariants verified during the final review.

**File**: `AGENTS.md` (modified, +3/-3)
```diff
@@ -95,7 +95,7 @@ Public docs and examples should prefer the installed `mo` command. Use `./mole`
 - **A gate that refuses must name which cause it hit and what to run next.** `acquire_install_lock` reports stable reasons through `INSTALL_LOCK_FAILURE`; unsafe-ancestor variants use `INSTALL_LOCK_UNSAFE_ANCESTOR_REASON`. Preserve one factual cause line plus one cause-specific next action, keep a new earlier gate at least as actionable as the failure it replaces, and pin reason-code routing rather than catch-all prose. Source-invariant tests skip comments and fail when they match zero intended code sites. `tests/install_checksum.bats` pins the branches; incident examples and test traps live in `.claude/skills/bugs/references/test-validity-and-refusal-diagnostics.md`.
 - The `mo update` self-heal fallback (`_update_self_heal_reinstall`) streams install.sh from `main` straight into bash with no local temp files, because a broken installed bootstrap cannot fix itself (#1297). Assert stable success against the installed binary's bounded version response, never installer output, and keep `install.sh`'s own `--version` / `--help` verification probes bounded. Nightly success additionally requires a per-attempt install receipt; pin the source archive to the resolved commit when HEAD is known, and never reuse an older `COMMIT_HASH` when it is not. Install and update are single-flight per install directory through one target-adjacent mutex: prefer absolute `/usr/bin/lockf`; where it is absent (#1348), fall back to an atomic `mkdir` in the lock directory, reclaimed only against proof the recorded owner is gone (dead pid, or a live pid whose start time no longer matches). A lock command that *runs and refuses* is contention, a platform that never had one is not, and only a system with neither primitive is turned away. Do not build the lock wrapper as a shell array. Locked by `tests/update.bats` and `tests/install_checksum.bats`; the V1.47.1, #1297, and #1348 history is in `.claude/skills/bugs/references/shell-and-test-pitfalls.md` section 4.
 - **Never machine-parse `plutil -p`.** Its output is documented as unstable: booleans print differently across macOS releases, and nesting is invisible, so a nested key reads as a top-level one. Read the XML from `plutil -convert xml1` instead and compare tags for equality (plutil spells an empty container `<dict/>`, which a prefix match counts as an opening tag and desyncs the depth). Decode `&amp;` last, since a key holding the literal text `&lt;` arrives escaped twice. Locked by the `#1512` cases in `tests/clean_app_caches.bats`, which must stay on the macos-14/15 compatibility job; the regression story is in `.claude/skills/bugs/references/shell-and-test-pitfalls.md` section 7.
-- **`_MOLE_COMPLETE_LSOF_MODE` is memoized and has no reset, so never probe it before the sudo session exists.** The first call to `_mole_complete_lsof_mode` caches `direct`, `sudo` or `unknown` for the rest of the process and every later call short-circuits on it. `start_cleanup` in `bin/clean.sh` settles sudo before any cleanup step, and `lib/uninstall/batch.sh` runs `ensure_sudo_session` before `_batch_execute_removals`; that ordering is load-bearing. Do not probe during the uninstall preview, which runs before that gate. If a preview ever needs the answer, clear the memo after `ensure_sudo_session` succeeds, not just read it earlier. Why the preview probe was rejected is in `.claude/skills/bugs/references/deletion-evidence-and-final-sink.md` section 2.
+- **`_MOLE_COMPLETE_LSOF_MODE` is memoized and has no reset, so never probe it before the sudo session exists.** The first call to `_mole_complete_lsof_mode` caches `direct`, `sudo` or `unknown` for the rest of the process and every later call short-circuits on it. `start_cleanup` in `bin/clean.sh` settles sudo before any cleanup step, and `lib/uninstall/batch.sh` runs `ensure_sudo_session` before `_batch_execute_removals`; that ordering is load-bearing. Do not probe dur
```

**File**: `lib/core/file_ops.sh` (modified, +14/-3)
```diff
@@ -2349,7 +2349,15 @@ mole_delete() {
     # up front to avoid a no-op Trash move followed by a validation failure.
     # The rejection itself is recorded in the forensic log so audit trails
     # can distinguish refused-by-policy from never-attempted.
-    if ! validate_path_for_deletion "$path"; then
+    local validation_rc=0
+    validate_path_for_deletion "$path" || validation_rc=$?
+    if mole_rc_timeout_or_signal "$validation_rc"; then
+        local validation_status="interrupted"
+        mole_rc_timeout "$validation_rc" && validation_status="timed-out"
+        _mole_delete_log "$mode" "unknown" "$validation_status" "$path"
+        return "$validation_rc"
+    fi
+    if [[ $validation_rc -ne 0 ]]; then
         _mole_delete_log "$mode" "0" "rejected" "$path"
         return 1
     fi
@@ -3224,9 +3232,9 @@ _mole_move_to_trash_batch() {
                 "$p" \
                 "${expected_parents[$index]}" \
                 "${expected_parent_ids[$index]}" \
-                "${expected_target_ids[$index]}" || return 1
+                "${expected_target_ids[$index]}" || return $?
             dest="$MOLE_TEST_TRASH_DIR/$(basename "$p").$$.${ts}.$RANDOM"
-            /bin/mv "$p" "$dest" 2> /dev/null || return 1
+            /bin/mv "$p" "$dest" 2> /dev/null || return $?
             _MOLE_TRASH_BATCH_MOVED_PATHS+=("$p")
         done
         return 0
@@ -3254,18 +3262,21 @@ _mole_move_to_trash_batch() {
         _MOLE_TRASH_MOVE_EXPECTED_PARENT="${expected_parents[$index]}"
         _MOLE_TRASH_MOVE_EXPECTED_PARENT_ID="${expected_parent_ids[$index]}"
         _MOLE_TRASH_MOVE_EXPECTED_TARGET_ID="${expected_target_ids[$index]}"
+        local move_rc=0
         if _mole_move_path_to_user_trash "$p" false \
             "${expected_parents[$index]}" \
             "${expected_parent_ids[$index]}" \
             "${expected_target_ids[$index]}"; then
             _MOLE_TRASH_BATCH_MOVED_PATHS+=("$p")
         else
+            move_rc=$?
             failed=1
         fi
         _MOLE_TRASH_MOVE_EXPECTED_PATH=""
         _MOLE_TRASH_MOVE_EXPECTED_PARENT=""
         _MOLE_TRASH_MOVE_EXPECTED_PARENT_ID=""
         _MOLE_TRASH_MOVE_EXPECTED_TARGET_ID=""
+        mole_rc_timeout_or_signal "$move_rc" && return "$move_rc"
     done
     [[ $failed -eq 0 ]]
 }
```

**File**: `lib/uninstall/batch.sh` (modified, +4/-3)
```diff
@@ -596,9 +596,10 @@ remove_file_list() {
     while IFS= read -r file; do
         [[ -n "$file" && -e "$file" ]] || continue
 
-        if ! validate_path_for_deletion "$file"; then
-            continue
-        fi
+        local validation_rc=0
+        validate_path_for_deletion "$file" || validation_rc=$?
+        mole_rc_timeout_or_signal "$validation_rc" && return "$validation_rc"
+        [[ $validation_rc -eq 0 ]] || continue
 
         local launch_agent=false
         local launch_agent_identity=""
```

**File**: `tests/file_ops_mole_delete.bats` (modified, +80/-0)
```diff
@@ -1636,3 +1636,83 @@ EOF
     [ "$status" -eq 0 ] || { echo "$output"; return 1; }
     [[ "$output" == "RC=1" ]]
 }
+
+
+@test "mole_delete preserves validation cancellation status" {
+    local probe_rc failures=0
+    for probe_rc in 1 124 130; do
+        run env PROJECT_ROOT="$PROJECT_ROOT" PROBE_RC="$probe_rc" /bin/bash --noprofile --norc <<'EOF'
+set -euo pipefail
+source "$PROJECT_ROOT/lib/core/common.sh"
+export MOLE_CURRENT_COMMAND=uninstall
+victim="$SANDBOX/validation-victim"
+mkdir -p "$victim"
+validate_path_for_deletion() { return "$PROBE_RC"; }
+get_path_size_kb() { echo UNEXPECTED_SIZE_PROBE; return 97; }
+rc=0
+mole_delete "$victim" false || rc=$?
+[[ $rc -eq $PROBE_RC && -d "$victim" ]] || exit 1
+case "$PROBE_RC" in
+    1) reason=rejected ;;
+    124) reason=timed-out ;;
+    130) reason=interrupted ;;
+esac
+grep -q "$(printf '\t%s\t' "$reason")" "$MOLE_DELETE_LOG" || exit 1
+EOF
+        [ "$status" -eq 0 ] || { echo "probe=$probe_rc: $output"; failures=$((failures + 1)); }
+        [[ "$output" != *UNEXPECTED_SIZE_PROBE* ]] || return 1
+    done
+    [ "$failures" -eq 0 ]
+}
+
+@test "Trash batch preserves cancellation and completed paths at both sinks" {
+    local probe_rc sink failures=0
+    for sink in direct test-trash; do
+        for probe_rc in 1 124 130; do
+            run env PROJECT_ROOT="$PROJECT_ROOT" PROBE_RC="$probe_rc" SINK="$sink" /bin/bash --noprofile --norc <<'EOF'
+set -euo pipefail
+source "$PROJECT_ROOT/lib/core/common.sh"
+export MOLE_CURRENT_COMMAND=uninstall
+fixture="$SANDBOX/batch-$SINK-$PROBE_RC"
+mkdir -p "$fixture/first" "$fixture/second" "$fixture/third"
+first="$fixture/first"
+second="$fixture/second"
+third="$fixture/third"
+if [[ "$SINK" == direct ]]; then
+    unset MOLE_TEST_TRASH_DIR
+    MOLE_TEST_NO_AUTH=0
+    _mole_move_path_to_user_trash() {
+        printf '%s\n' "$1" >> "$fixture/trace"
+        [[ "$1" == "$second" ]] && return "$PROBE_RC"
+        rmdir "$1"
+    }
+else
+    MOLE_TEST_TRASH_DIR="$fixture/Trash"
+    _mole_trash_target_still_safe() {
+        printf '%s\n' "$1" >> "$fixture/trace"
+        [[ "$1" == "$second" ]] && return "$PROBE_RC"
+        return 0
+    }
+fi
+rc=0
+_mole_move_to_trash_batch "$first" "$second" "$third" || rc=$?
+[[ $rc -eq $PROBE_RC ]] || exit 1
+[[ ! -e "$first" && -d "$second" ]] || exit 1
+[[ "${_MOLE_TRASH_BATCH_MOVED_PATHS[0]}" == "$first" ]] || exit 1
+grep -Fxq "$first" "$fixture/trace" || exit 1
+grep -Fxq "$second" "$fixture/trace" || exit 1
+if [[ "$SINK" == direct && $PROBE_RC -eq 1 ]]; then
+    [[ ! -e "$third" && ${#_MOLE_TRASH_BATCH_MOVED_PATHS[@]} -eq 2 ]] || exit 1
+    grep -Fxq "$third" "$fixture/trace" || exit 1
+else
+    [[ -d "$third" && ${#_MOLE_TRASH_BATCH_MOVED_PATHS[@]} -eq 1 ]] || exit 1
+    ! grep -Fxq "$third" "$fixture/trace" || exit 1
+fi
+[[ -z "$_MOLE_TRASH_MOVE_EXPECTED_PATH" && -z "$_MOLE_TRASH_MOVE_EXPECTED_PARENT" &&
+    -z "$_MOLE_TRASH_MOVE_EXPECTED_PARENT_ID" && -z "$_MOLE_TRASH_MOVE_EXPECTED_TARGET_ID" ]] || exit 1
+EOF
+            [ "$status" -eq 0 ] || { echo "sink=$sink probe=$probe_rc: $output"; failures=$((failures + 1)); }
+        done
+    done
+    [ "$failures" -eq 0 ]
+}
```

**File**: `tests/uninstall_remove_file_list.bats` (modified, +35/-0)
```diff
@@ -766,3 +766,38 @@ collect
 SCRIPT
     [ "$status" -eq 0 ] || { echo "$output"; return 1; }
 }
+
+
+@test "remove_file_list propagates validation cancellation before later candidates" {
+    local probe_rc failures=0
+    for probe_rc in 1 124 130; do
+        run env PROJECT_ROOT="$PROJECT_ROOT" PROBE_RC="$probe_rc" /bin/bash --noprofile --norc <<'EOF'
+set -euo pipefail
+source "$PROJECT_ROOT/lib/core/common.sh"
+source "$PROJECT_ROOT/lib/uninstall/batch.sh"
+export MOLE_CURRENT_COMMAND=uninstall
+first="$HOME/first"
+second="$HOME/second"
+mkdir -p "$first" "$second"
+validate_path_for_deletion() {
+    printf '%s\n' "$1" >> "$HOME/probed-$PROBE_RC"
+    [[ "$1" == "$first" ]] && return "$PROBE_RC"
+    return 0
+}
+_mole_move_to_trash_batch() { printf '%s\n' "$@" > "$HOME/moved-$PROBE_RC"; }
+rc=0
+remove_file_list "$first"$'\n'"$second" false || rc=$?
+grep -Fxq "$first" "$HOME/probed-$PROBE_RC" || exit 1
+if [[ $PROBE_RC -eq 1 ]]; then
+    [[ $rc -eq 0 ]] || exit 1
+    grep -Fxq "$second" "$HOME/moved-$PROBE_RC" || exit 1
+else
+    [[ $rc -eq $PROBE_RC ]] || exit 1
+    ! grep -Fxq "$second" "$HOME/probed-$PROBE_RC" || exit 1
+    [[ ! -e "$HOME/moved-$PROBE_RC" ]] || exit 1
+fi
+EOF
+        [ "$status" -eq 0 ] || { echo "probe=$probe_rc: $output"; failures=$((failures + 1)); }
+    done
+    [ "$failures" -eq 0 ]
+}
```

---

### Incident Patch 8: `cf64030a` (2026-09-29)
**Commit Message**: fix: expose Finder Trash failures without guessing permissions

Preserve Finder stderr and exit status in debug diagnostics, distinguish an incomplete move, and give factual manual Trash guidance when macOS refuses access. Keep refusal and cancellation boundaries unchanged.

**File**: `lib/core/file_ops.sh` (modified, +13/-8)
```diff
@@ -2502,7 +2502,7 @@ mole_delete() {
                 _MOLE_PRIVACY_DENIED_WARNED=1
                 export _MOLE_PRIVACY_DENIED_WARNED
                 declare -F stop_inline_spinner > /dev/null && stop_inline_spinner
-                printf 'Error: macOS could not authorize Trash access. Review App Management, App Data, or Full Disk Access for your terminal in System Settings, then retry.\n' >&2
+                printf 'Error: macOS denied Trash access. Try moving the item to Trash in Finder. Run with --debug for details.\n' >&2
             fi
             debug_log "macOS privacy permission denied while moving to Trash: $path"
             return "$MOLE_ERR_PRIVACY_DENIED"
@@ -2686,19 +2686,24 @@ _mole_move_app_to_trash_via_finder() {
         "$expected_file_sha256" "$expected_absent_path" \
         "$expected_parent" "$expected_parent_id" "$expected_target_id" || return $?
 
-    run_with_timeout "$MOLE_TIMEOUT_DISK_VERIFY_SEC" osascript - "$path" > /dev/null 2>&1 << 'APPLESCRIPT' || finder_rc=$?
+    local finder_output=""
+    finder_output=$(
+        run_with_timeout "$MOLE_TIMEOUT_DISK_VERIFY_SEC" osascript - "$path" 2>&1 > /dev/null << 'APPLESCRIPT'
 on run argv
     set p to POSIX file (item 1 of argv)
     tell application "Finder"
         delete p
     end tell
 end run
 APPLESCRIPT
+    ) || finder_rc=$?
 
-    if mole_rc_timeout_or_signal "$finder_rc"; then
-        return "$finder_rc"
-    elif [[ $finder_rc -ne 0 ]] || [[ -e "$path" || -L "$path" ]]; then
-        debug_log "Finder failed to move application to Trash: $path"
+    if [[ $finder_rc -ne 0 ]]; then
+        debug_log "Finder failed to move application to Trash (exit $finder_rc): $path: $finder_output"
+        mole_rc_timeout_or_signal "$finder_rc" && return "$finder_rc"
+        return 1
+    elif [[ -e "$path" || -L "$path" ]]; then
+        debug_log "Finder returned success but the application remains: $path"
         return 1
     fi
 
@@ -4035,8 +4040,8 @@ diagnose_removal_failure() {
             reason="protected by Mole safety rules"
             ;;
         "$MOLE_ERR_PRIVACY_DENIED")
-            reason="macOS could not authorize Trash access"
-            suggestion="Review App Management, App Data, or Full Disk Access for your terminal in System Settings"
+            reason="macOS denied Trash access"
+            suggestion="Try moving the item to Trash in Finder. Run with --debug for details"
             ;;
         "$MOLE_ERR_MUTABLE_PARENT")
             reason="Mole cannot safely use elevated deletion below a user-writable parent"
```

**File**: `lib/uninstall/batch.sh` (modified, +5/-1)
```diff
@@ -2265,7 +2265,11 @@ _batch_execute_removals() {
                     "$expected_app_identity" || removal_rc=$?
                 mole_rc_timeout_or_signal "$removal_rc" && return "$removal_rc"
                 if [[ $removal_rc -ne 0 ]]; then
-                    if [[ ! -w "$(dirname "$app_path")" ]]; then
+                    if [[ $removal_rc -eq $MOLE_ERR_PRIVACY_DENIED ]]; then
+                        local diagnosis
+                        diagnosis=$(diagnose_removal_failure "$removal_rc" "$app_name")
+                        IFS='|' read -r reason suggestion <<< "$diagnosis"
+                    elif [[ ! -w "$(dirname "$app_path")" ]]; then
                         reason="parent directory not writable"
                     else
                         reason="remove failed, check permissions"
```

**File**: `tests/file_ops_mole_delete.bats` (modified, +95/-4)
```diff
@@ -34,6 +34,42 @@ source "$PROJECT_ROOT/lib/core/common.sh"
 EOF
 }
 
+# Exercise the real result handling with only a sandboxed AppleScript fixture.
+run_finder_result_fixture() {
+    mkdir -p "$SANDBOX/FinderFixture.app"
+    run env PROJECT_ROOT="$PROJECT_ROOT" FIXTURE_RC="$1" FIXTURE_MOVE="${2:-0}" /bin/bash --noprofile --norc <<'EOF'
+set -euo pipefail
+source "$PROJECT_ROOT/lib/core/common.sh"
+fixture="$SANDBOX/FinderFixture.app"
+_mole_path_is_application_bundle() { [[ "$1" == "$fixture" ]]; }
+_mole_trash_target_still_safe() { [[ "$1" == "$fixture" ]]; }
+_mole_owned_path_still_valid() { [[ "$1" == "$fixture" ]]; }
+debug_log() { printf '%s\n' "$*" >> "$SANDBOX/finder-debug.log"; }
+run_with_timeout() {
+    [[ $# -eq 4 && "$1" == "$MOLE_TIMEOUT_DISK_VERIFY_SEC" && "$2" == osascript && "$3" == - && "$4" == "$fixture" ]] || return 97
+    shift
+    "$@"
+}
+osascript() {
+    [[ $# -eq 2 && "$1" == - && "$2" == "$fixture" ]] || return 98
+    cat > "$SANDBOX/finder-script"
+    printf 'FINDER_STDOUT_MUST_STAY_HIDDEN\n'
+    printf 'Finder fixture diagnostic (-1743)\n' >&2
+    if [[ "$FIXTURE_MOVE" == 1 ]]; then
+        mv "$fixture" "$SANDBOX/MovedFixture.app"
+    fi
+    return "$FIXTURE_RC"
+}
+rc=0
+_mole_move_app_to_trash_via_finder "$fixture" || rc=$?
+printf 'RC=%s\n' "$rc"
+EOF
+    [ "$status" -eq 0 ] || { echo "$output"; return 1; }
+    [[ "$output" != *"FINDER_STDOUT_MUST_STAY_HIDDEN"* ]] || return 1
+    [[ "$output" != *"Finder fixture diagnostic"* ]] || return 1
+    [[ -s "$SANDBOX/finder-script" ]]
+}
+
 @test "mole_delete defaults to permanent mode and removes the target" {
     local victim="$SANDBOX/victim"
     mkdir -p "$victim"
@@ -719,7 +755,8 @@ EOF
 
     [ "$status" -eq 0 ]
     [[ -d "$victim" ]] || return 1
-    [[ "$output" == *"App Management, App Data, or Full Disk Access"* ]] || return 1
+    [[ "$output" == *"Try moving the item to Trash in Finder. Run with --debug for details"* ]] || return 1
+    [[ "$output" != *"Full Disk Access"* ]] || return 1
     [[ "$output" != *"Touch ID"* ]] || return 1
     [[ "$output" == *"RC=14"* ]] || return 1
     [[ ! -s "$trace" ]] || return 1
@@ -795,15 +832,16 @@ EOF
     [[ "$output" == *"refusing permanent delete"* ]]
 }
 
-@test "privacy denial diagnosis recommends terminal privacy access, not Touch ID" {
+@test "privacy denial diagnosis offers Finder and debug without guessing a permission pane" {
     run /bin/bash --noprofile --norc <<EOF
 $(prelude)
 diagnose_removal_failure "\$MOLE_ERR_PRIVACY_DENIED" "Microsoft Word"
 EOF
 
     [ "$status" -eq 0 ]
-    [[ "$output" == *"macOS could not authorize Trash access"* ]] || return 1
-    [[ "$output" == *"App Management, App Data, or Full Disk Access"* ]] || return 1
+    [[ "$output" == *"macOS denied Trash access"* ]] || return 1
+    [[ "$output" == *"Try moving the item to Trash in Finder. Run with --debug for details"* ]] || return 1
+    [[ "$output" != *"Full Disk Access"* ]] || return 1
     [[ "$output" != *"touchid"* ]] || return 1
     [[ "$output" != *"Touch ID"* ]]
 }
@@ -1545,3 +1583,56 @@ EOF
     # Nothing privileged may run against a symlinked root.
     [[ ! -s "$trace" ]]
 }
+
+
+@test "Finder failure records stderr and the actual exit status" {
+    run_finder_result_fixture 1
+    [[ "$output" == "RC=1" ]] || return 1
+    [[ -d "$SANDBOX/FinderFixture.app" ]] || return 1
+    local diagnostic
+    diagnostic=$(cat "$SANDBOX/finder-debug.log")
+    [[ "$diagnostic" == *"(exit 1)"* ]] || return 1
+    [[ "$diagnostic" == *"Finder fixture diagnostic (-1743)"* ]] || return 1
+    [[ "$diagnostic" != *"FINDER_STDOUT_MUST_STAY_HIDDEN"* ]]
+}
+
+@test "Finder success with a surviving app is diagnosed as an incomplete move" {
+    run_finder_result_fixture 0
+    [[ "$output" == "RC=1" ]] || return 1
+    [[ -d "$SANDBOX/FinderFixture.app" ]] || return 1
+    [[ "$(cat "$SANDBOX/finder-debug.log")" == *"Finder returned success but the application remains:"* ]]
+}
+
+@test "Find
```

**File**: `tests/uninstall.bats` (modified, +42/-0)
```diff
@@ -4815,3 +4815,45 @@ SCRIPT
     [[ "$output" == *"Kept (app may be active): ~/Library/Caches/com.example.Shared"* ]] || return 1
     [[ "$output" == *"Could not remove: ~/Library/Caches/com.example.Shared"* ]] || return 1
 }
+
+
+@test "nonprivileged batch privacy denial retains the app and offers factual next steps" {
+    run env HOME="$HOME" PROJECT_ROOT="$PROJECT_ROOT" /bin/bash --noprofile --norc <<'SCRIPT'
+set -euo pipefail
+source "$PROJECT_ROOT/lib/core/common.sh"
+source "$PROJECT_ROOT/lib/uninstall/batch.sh"
+mkdir -p "$HOME/Applications/Denied.app"
+app="$HOME/Applications/Denied.app"
+stop_launch_services() { :; }
+unregister_app_bundle() { :; }
+mole_delete() {
+    [[ "$1" == "$app" && "$2" == false ]] || return 99
+    printf 'denied\n' > "$HOME/delete-called"
+    return "$MOLE_ERR_PRIVACY_DENIED"
+}
+remove_file_list() { printf 'unexpected leftovers\n' > "$HOME/leftovers-called"; return 99; }
+app_details=("Denied|$app|unknown|0|||false|false|false|||||guard_login|$(_batch_selected_app_identity "$app")|unknown||missing")
+success_count=0
+failed_count=0
+brew_apps_removed=0
+failed_items=()
+success_items=()
+success_dock_targets=()
+system_extension_warning_apps=()
+review_only_system_leftovers=()
+review_only_system_leftover_keys=()
+running_at_uninstall_apps=()
+total_size_freed=0
+files_cleaned=0
+total_items=0
+_batch_execute_removals
+[[ $success_count -eq 0 && $failed_count -eq 1 ]] || exit 1
+[[ -d "$app" && -s "$HOME/delete-called" && ! -e "$HOME/leftovers-called" ]] || exit 1
+printf 'FAILURE=%s\n' "${failed_items[0]}"
+SCRIPT
+    [ "$status" -eq 0 ] || { echo "$output"; return 1; }
+    [[ "$output" == *"macOS denied Trash access"* ]] || return 1
+    [[ "$output" == *"Try moving the item to Trash in Finder. Run with --debug for details"* ]] || return 1
+    [[ "$output" != *"check permissions"* ]] || return 1
+    [[ "$output" != *"Full Disk Access"* ]]
+}
```

---

### Incident Patch 9: `d67d6d8a` (2026-09-29)
**Commit Message**: fix: report worktree containers once without cancelling cleanup

Deduplicate physical worktree containers and keep a slow size probe from cancelling unrelated cleanup. Include the Codex worktree container and separate review rows from spinner output without recommending deletion.

**File**: `lib/clean/user.sh` (modified, +70/-14)
```diff
@@ -2,6 +2,10 @@
 # User Data Cleanup Module
 set -euo pipefail
 
+_mole_user_module_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
+# shellcheck disable=SC1090
+source "$_mole_user_module_dir/purge_shared.sh"
+
 _user_process_delete_guard_allows() {
     mole_clean_process_guard "$_MOLE_USER_PROCESS_GUARD_PROBE" "$_MOLE_USER_PROCESS_GUARD_FAMILY started"
 }
@@ -2615,9 +2619,9 @@ jetbrains_stale_version_dirs() {
         '
 }
 
-# AI coding agents (Claude Code and similar) create full checkouts under
-# <project>/.claude/worktrees/ that accumulate silently across repos. Report
-# only, same 1GB bar as other large candidates; removal stays a manual
+# AI coding agents create full checkouts that accumulate silently: Claude Code
+# under <project>/.claude/worktrees/, the Codex app under ~/.codex/worktrees/.
+# Report only, same 1GB bar as other large candidates; removal stays a manual
 # `git worktree remove` decision because a worktree may hold agent work.
 report_agent_worktree_candidates() {
     local threshold_kb=$((1024 * 1024)) # 1GB
@@ -2626,21 +2630,73 @@ report_agent_worktree_candidates() {
         "$HOME/GitHub" "$HOME/Workspace" "$HOME/Repos"
         "$HOME/Development" "$HOME/www" "$HOME/src"
     )
-    local root container size_kb size_rc
+
+    _report_agent_worktree_container() {
+        local container="$1"
+        local size_kb size_rc=0
+        size_kb=$(get_path_size_kb "$container" 2> /dev/null) || size_rc=$?
+        # Review rows never cancel the rest of clean on a size timeout (#1576):
+        # a container holding many full checkouts can outlast the size budget.
+        # Signals still stop the run so Ctrl-C stays sticky.
+        if [[ $size_rc -ge 128 ]]; then
+            _mole_record_clean_cancellation "$size_rc"
+            return "$size_rc"
+        fi
+        [[ $size_rc -eq 0 ]] || return 0
+        [[ "$size_kb" =~ ^[0-9]+$ ]] || size_kb=0
+        [[ "$size_kb" -ge "$threshold_kb" ]] || return 0
+        # The caller's "Scanning large files..." spinner is still running;
+        # printing over it glues the row onto the spinner frame.
+        stop_section_spinner
+        echo -e "  ${YELLOW}${ICON_REVIEW}${NC} AI agent worktrees · ${GREEN}$(bytes_to_human "$((size_kb * 1024))")${NC} · ${GRAY}$(format_path_link "$container")${NC}"
+        note_activity
+        start_section_spinner "Scanning large files..."
+    }
+
+    local container rc=0
+    # The Codex app keeps every worktree under one fixed container outside
+    # any project root, so the find below never reaches it.
+    container="$HOME/.codex/worktrees"
+    if [[ -d "$container" && ! -L "$container" ]]; then
+        _report_agent_worktree_container "$container" || rc=$?
+    fi
+
+    # ~/code and ~/Code are one directory on case-insensitive APFS, and a root
+    # may be a symlink to another. Scan each physical root once, or every
+    # container is reported twice (same class as #590 and #1416). A root can
+    # also sit inside another one, so containers are deduplicated as well.
+    local -a scanned_roots=() reported_containers=()
+    local root physical_root scanned already_scanned
     for root in "${roots[@]}"; do
+        [[ $rc -eq 0 ]] || break
         [[ -d "$root" ]] || continue
+        physical_root=$(mole_purge_resolve_path_case "$root")
+        already_scanned=false
+        for scanned in "${scanned_roots[@]+"${scanned_roots[@]}"}"; do
+            if [[ "$scanned" == "$physical_root" ]]; then
+                already_scanned=true
+                break
+            fi
+        done
+        [[ "$already_scanned" == "false" ]] || continue
+        scanned_roots+=("$physical_root")
         while IFS= read -r -d '' container; do
-            size_rc=0
-            size_kb=$(get_path_size_kb "$container" 2> /dev/null) || size_rc=$?
-            [[ $size_rc -eq 0 ]] || _mole_record_clean_cancellation "$size_rc"
-            [[ $size_rc -eq 0 ]] || return "$size_rc"
-            [[ "$size_kb" =~ ^
```

**File**: `tests/clean_dev_caches.bats` (modified, +82/-0)
```diff
@@ -3197,6 +3197,88 @@ EOF
     [ -z "$output" ]
 }
 
+# Each case below gets its own HOME: they assert exact row counts, and the
+# shared file HOME already holds other worktree fixtures.
+_worktree_hint_run() {
+    run env HOME="$1" PROJECT_ROOT="$PROJECT_ROOT" MOLE_CURRENT_COMMAND=clean \
+        SIZE_STUB_RC="${2:-0}" /bin/bash --noprofile --norc << 'EOF'
+set -euo pipefail
+source "$PROJECT_ROOT/lib/core/common.sh"
+source "$PROJECT_ROOT/lib/clean/user.sh"
+note_activity() { :; }
+run_with_timeout() { shift; "$@"; }
+get_path_size_kb() {
+    [[ "$SIZE_STUB_RC" == "0" ]] || return "$SIZE_STUB_RC"
+    echo "2097152"
+}
+rc=0
+report_agent_worktree_candidates || rc=$?
+printf 'RC=%s CANCEL=%s\n' "$rc" "${MOLE_CLEAN_CANCEL_STATUS:-none}"
+EOF
+}
+
+@test "report_agent_worktree_candidates reports a case-variant root once" {
+    local test_home="$HOME/wt-case-home"
+    mkdir -p "$test_home/code/proj/.claude/worktrees/wt-one"
+    # ~/Code only aliases ~/code on a case-insensitive volume.
+    [[ -d "$test_home/Code" ]] || skip "case-sensitive filesystem"
+
+    _worktree_hint_run "$test_home"
+
+    [ "$status" -eq 0 ] || return 1
+    local rows
+    rows=$(grep -c "AI agent worktrees" <<< "$output" || true)
+    [ "$rows" -eq 1 ]
+}
+
+@test "report_agent_worktree_candidates reports a container once when one root links into another" {
+    local test_home="$HOME/wt-link-home"
+    mkdir -p "$test_home/code/sub/proj/.claude/worktrees/wt-one"
+    ln -s "$test_home/code/sub" "$test_home/dev"
+
+    _worktree_hint_run "$test_home"
+
+    [ "$status" -eq 0 ] || return 1
+    local rows
+    rows=$(grep -c "AI agent worktrees" <<< "$output" || true)
+    [ "$rows" -eq 1 ]
+}
+
+@test "report_agent_worktree_candidates reports the Codex worktree container" {
+    local test_home="$HOME/wt-codex-home"
+    mkdir -p "$test_home/.codex/worktrees/topic/repo"
+    echo "data" > "$test_home/.codex/worktrees/topic/repo/file"
+
+    _worktree_hint_run "$test_home"
+
+    [ "$status" -eq 0 ] || return 1
+    [[ "$output" == *"AI agent worktrees"*".codex/worktrees"* ]] || return 1
+    # Report only: the worktree must still exist afterwards.
+    [ -f "$test_home/.codex/worktrees/topic/repo/file" ]
+}
+
+@test "report_agent_worktree_candidates skips a row on a size timeout without cancelling clean" {
+    local test_home="$HOME/wt-timeout-home"
+    mkdir -p "$test_home/code/proj/.claude/worktrees/wt-one"
+
+    _worktree_hint_run "$test_home" 124
+
+    [ "$status" -eq 0 ] || return 1
+    [[ "$output" != *"AI agent worktrees"* ]] || return 1
+    [[ "$output" == *"RC=0 CANCEL=none"* ]]
+}
+
+@test "report_agent_worktree_candidates keeps a size signal sticky" {
+    local test_home="$HOME/wt-signal-home"
+    mkdir -p "$test_home/code/proj/.claude/worktrees/wt-one"
+
+    _worktree_hint_run "$test_home" 130
+
+    [ "$status" -eq 0 ] || return 1
+    [[ "$output" != *"AI agent worktrees"* ]] || return 1
+    [[ "$output" == *"RC=130 CANCEL=130"* ]]
+}
+
 _codex_version_plist() {
 	mkdir -p "$(dirname "$1")"
 	local bundle_id="${3:-com.openai.codex}"
```

---

### Incident Patch 10: `9de8dc78` (2026-09-29)
**Commit Message**: fix: keep overlapping history sessions apart

Attribute overlapping command operations to their own open sessions and sort by start time with marker order as the tie-breaker. Preserve markerless installer boundaries and the existing log format.

**File**: `lib/core/history.sh` (modified, +155/-7)
```diff
@@ -30,6 +30,7 @@ declare -a HISTORY_SESSION_REBUILT=()
 declare -a HISTORY_SESSION_OTHER=()
 declare -a HISTORY_SESSION_OPERATIONS=()
 declare -a HISTORY_SESSION_FAILED_TASKS=()
+declare -a HISTORY_SESSION_START_SEQ=()
 
 declare -a HISTORY_DELETE_TIMESTAMPS=()
 declare -a HISTORY_DELETE_MODES=()
@@ -50,6 +51,9 @@ HISTORY_ACTIVE_REBUILT=0
 HISTORY_ACTIVE_OTHER=0
 HISTORY_ACTIVE_OPERATIONS=0
 HISTORY_ACTIVE_FAILED_TASKS=0
+HISTORY_ACTIVE_MARKED=0
+HISTORY_ACTIVE_START_SEQ=0
+HISTORY_START_SEQ_COUNTER=0
 
 history_operations_log_file() {
     printf '%s\n' "${MOLE_OPERATIONS_LOG:-${OPERATIONS_LOG_FILE:-$HOME/Library/Logs/mole/operations.log}}"
@@ -119,19 +123,159 @@ history_reset_active_session() {
     HISTORY_ACTIVE_OTHER=0
     HISTORY_ACTIVE_OPERATIONS=0
     HISTORY_ACTIVE_FAILED_TASKS=0
+    HISTORY_ACTIVE_MARKED=0
+    HISTORY_ACTIVE_START_SEQ=0
+}
+
+# Sessions of different commands can overlap in one log: a `mo purge` started
+# while `mo clean` still runs writes its markers between clean's operation
+# lines. Every operation line names its command, so keep at most one open
+# session per command and route each line to that command's session instead
+# of whichever marker came last. Open sessions of other commands wait here,
+# one record per session, fields separated by \x1f. Only sessions opened by a
+# start marker are kept open this way: commands that log without markers
+# (installer) still end at the next marker, as before.
+declare -a HISTORY_PARKED_SESSIONS=()
+
+history_park_active_session() {
+    [[ -n "$HISTORY_ACTIVE_COMMAND" ]] || return 0
+    local sep=$'\x1f'
+    HISTORY_PARKED_SESSIONS+=("${HISTORY_ACTIVE_COMMAND}${sep}${HISTORY_ACTIVE_STARTED_AT}${sep}${HISTORY_ACTIVE_ENDED_AT}${sep}${HISTORY_ACTIVE_ITEMS}${sep}${HISTORY_ACTIVE_SIZE}${sep}${HISTORY_ACTIVE_REMOVED}${sep}${HISTORY_ACTIVE_TRASHED}${sep}${HISTORY_ACTIVE_SKIPPED}${sep}${HISTORY_ACTIVE_FAILED}${sep}${HISTORY_ACTIVE_REBUILT}${sep}${HISTORY_ACTIVE_OTHER}${sep}${HISTORY_ACTIVE_OPERATIONS}${sep}${HISTORY_ACTIVE_FAILED_TASKS}${sep}${HISTORY_ACTIVE_START_SEQ}${sep}${HISTORY_ACTIVE_MARKED}")
+    history_reset_active_session
+}
+
+# Make the open session of <command> the active one. Returns 1 when that
+# command has no open session; the previously active session stays parked.
+history_activate_command_session() {
+    local command="$1"
+    [[ "$HISTORY_ACTIVE_COMMAND" == "$command" ]] && return 0
+
+    history_park_active_session
+
+    local -a remaining=()
+    local record found=""
+    for record in "${HISTORY_PARKED_SESSIONS[@]+"${HISTORY_PARKED_SESSIONS[@]}"}"; do
+        if [[ -z "$found" && "${record%%$'\x1f'*}" == "$command" ]]; then
+            found="$record"
+        else
+            remaining+=("$record")
+        fi
+    done
+    HISTORY_PARKED_SESSIONS=("${remaining[@]+"${remaining[@]}"}")
+    [[ -n "$found" ]] || return 1
+
+    IFS=$'\x1f' read -r HISTORY_ACTIVE_COMMAND HISTORY_ACTIVE_STARTED_AT \
+        HISTORY_ACTIVE_ENDED_AT HISTORY_ACTIVE_ITEMS HISTORY_ACTIVE_SIZE \
+        HISTORY_ACTIVE_REMOVED HISTORY_ACTIVE_TRASHED HISTORY_ACTIVE_SKIPPED \
+        HISTORY_ACTIVE_FAILED HISTORY_ACTIVE_REBUILT HISTORY_ACTIVE_OTHER \
+        HISTORY_ACTIVE_OPERATIONS HISTORY_ACTIVE_FAILED_TASKS \
+        HISTORY_ACTIVE_START_SEQ HISTORY_ACTIVE_MARKED <<< "$found"
+    return 0
+}
+
+# Close sessions that no start marker opened, except the one of <command>.
+history_finish_unmarked_sessions() {
+    local keep_command="${1:-}"
+    if [[ -n "$HISTORY_ACTIVE_COMMAND" && "$HISTORY_ACTIVE_MARKED" != "1" &&
+        "$HISTORY_ACTIVE_COMMAND" != "$keep_command" ]]; then
+        history_finish_session
+    fi
+    local -a unmarked=()
+    local record command
+    for record in "${HISTORY_PARKED_SESSIONS[@]+"${HISTORY_PARKED_SESSIONS[@]}"}"; do
+        [[ "${record##*$'\x1f'}" == "1" ]] && continue
+        [[ "${record%%$'\x1f'*}" == "$keep_command" ]] && continue
+        unmarked+=("${record%%$'\x1f'*}")
+    done
+    for com
```

**File**: `tests/history.bats` (modified, +80/-0)
```diff
@@ -170,6 +170,86 @@ EOF
     [[ "$output" != *"malformed summary items"* ]]
 }
 
+@test "mo history attributes interleaved sessions of different commands by command" {
+    # A dry-run purge started while a real clean was still running.
+    cat > "$HOME/Library/Logs/mole/operations.log" <<'EOF'
+# ========== clean session started at 2026-05-24 10:00:00 ==========
+[2026-05-24 10:00:01] [clean] REMOVED /tmp/one (1KB)
+# ========== purge session started at 2026-05-24 10:01:00 ==========
+[2026-05-24 10:01:01] [clean] REMOVED /tmp/two (1KB)
+[2026-05-24 10:01:02] [clean] REMOVED /tmp/three (1KB)
+# ========== purge session ended at 2026-05-24 10:02:00, 4 items, 8KB ==========
+[2026-05-24 10:03:00] [clean] REMOVED /tmp/four (1KB)
+# ========== clean session ended at 2026-05-24 10:04:00, 4 items, 4KB ==========
+# ========== uninstall session started at 2026-05-24 11:00:00 ==========
+[2026-05-24 11:00:01] [uninstall] TRASHED /tmp/Old.app (1KB)
+EOF
+
+    run env HOME="$HOME" "$PROJECT_ROOT/mole" history --json
+    [ "$status" -eq 0 ] || return 1
+
+    printf '%s\n' "$output" | python3 -c '
+import json
+import sys
+
+sessions = json.load(sys.stdin)["sessions"]
+assert [s["command"] for s in sessions] == ["uninstall", "purge", "clean"], sessions
+uninstall, purge, clean = sessions
+assert purge["actions"]["removed"] == 0, purge
+assert clean["actions"]["removed"] == 4, clean
+assert uninstall["actions"]["trashed"] == 1, uninstall
+'
+}
+
+@test "mo history orders sessions started in the same second by their markers" {
+    cat > "$HOME/Library/Logs/mole/operations.log" <<'EOF'
+# ========== clean session started at 2026-05-24 10:00:00 ==========
+# ========== purge session started at 2026-05-24 10:00:00 ==========
+[2026-05-24 10:00:01] [purge] REMOVED /tmp/build (1KB)
+# ========== purge session ended at 2026-05-24 10:00:02, 1 items, 1KB ==========
+[2026-05-24 10:00:03] [clean] REMOVED /tmp/cache (1KB)
+# ========== clean session ended at 2026-05-24 10:00:04, 1 items, 1KB ==========
+EOF
+
+    run env HOME="$HOME" "$PROJECT_ROOT/mole" history --json
+    [ "$status" -eq 0 ] || return 1
+
+    printf '%s\n' "$output" | python3 -c '
+import json
+import sys
+
+sessions = json.load(sys.stdin)["sessions"]
+assert [s["command"] for s in sessions] == ["purge", "clean"], sessions
+assert sessions[0]["actions"]["removed"] == 1, sessions[0]
+assert sessions[1]["actions"]["removed"] == 1, sessions[1]
+'
+}
+
+@test "mo history still ends marker-less installer runs at the next session marker" {
+    # mo installer logs operation lines but writes no session markers.
+    cat > "$HOME/Library/Logs/mole/operations.log" <<'EOF'
+[2026-05-02 10:00:01] [installer] TRASHED /tmp/first.dmg (1KB)
+# ========== clean session started at 2026-05-05 10:00:00 ==========
+[2026-05-05 10:00:01] [clean] REMOVED /tmp/cache (1KB)
+# ========== clean session ended at 2026-05-05 10:01:00, 1 items, 1KB ==========
+[2026-05-10 10:00:01] [installer] TRASHED /tmp/second.dmg (1KB)
+EOF
+
+    run env HOME="$HOME" "$PROJECT_ROOT/mole" history --json
+    [ "$status" -eq 0 ] || return 1
+
+    printf '%s\n' "$output" | python3 -c '
+import json
+import sys
+
+sessions = json.load(sys.stdin)["sessions"]
+assert [s["command"] for s in sessions] == ["installer", "clean", "installer"], sessions
+assert sessions[0]["started_at"] == "2026-05-10 10:00:01", sessions[0]
+assert sessions[0]["actions"]["trashed"] == 1, sessions[0]
+assert sessions[2]["actions"]["trashed"] == 1, sessions[2]
+'
+}
+
 @test "mo history does not create logs when none exist" {
     rm -rf "$HOME/Library"
 
```

#### Recent Merged Pull Requests:
- **PR #1656** (2026-09-30): fix(clean): keep probe timeouts from cancelling unrelated cleanup (@r266-tech)
- **PR #1648** (2026-09-30): fix(status): account for default-route tunnel traffic (@r266-tech)
- **PR #1646** (2026-09-29): fix(uninstall): subtract partial leftover size after du errors (@r266-tech)
- **PR #1642** (2026-09-29): test: make negated assertions able to fail and audit them (@hmate9)
- **PR #1641** (2026-09-29): fix(clean): keep app caches when pgrep cannot tell (@hmate9)
- **PR #1640** (2026-09-29): fix(analyze): stop showing old sizes as current after changes or deletes (@hmate9)
- **PR #1639** (2026-09-29): fix(ui): keep caller cleanup and interrupt handlers across menus (@hmate9)
- **PR #1638** (2026-09-29): fix(install): keep the spinner animating under errexit (@hmate9)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
