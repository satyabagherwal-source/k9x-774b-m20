# Agent Contract: Agent Contract: tw93/mole Autonomous Specialist Persona

<!-- PROVENANCE_START
{
  "source_repository": "tw93/mole",
  "source_url": "https://github.com/tw93/mole",
  "source_version": "historical-head",
  "license": "OPEN_HARVEST",
  "timestamp": "2026-11-13T00:00:00.000Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "unknown",
  "canonical_classification": "agent_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [tw93/mole](https://github.com/tw93/mole) (Revision: `historical`).  
> **License**: OPEN_HARVEST | **Timestamp**: `2026-11-13T00:00:00.000Z`  
> **Learning ID**: `unknown`


## 1. Agent Role & Persona Contract
- **Role Identifier**: `tw93-mole-specialist`
- **Governing Capability**: Autonomous execution and domain-specialized problem resolution.
- **Trust Boundary**: Reads and modifies only authorized workspace resources.

## 2. Operational Capabilities
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/tw93-mole-learnings.md`  
> **Source**: github ([https://github.com/tw93/Mole](https://github.com/tw93/Mole))  
> **Source Version**: `d9181d3b`  
> **License**: GPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-11T16:05:02.349Z  
> **Learning ID**: `learn-github-tw93-mole`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): tw93/Mole

> **Canonical Artifact**: `07_PROJECT_LEARNING/tw93-mole-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/tw93/Mole](https://github.com/tw93/Mole))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-11T16:05:02.059Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tw93/Mole`
- **Description**: 🐹 Open-source Mac and PC cleaner. Keep your machine clean, light, and running like new. Fast CLI, plus native Mac and Windows apps.
- **Primary Language / Ecosystem**: Shell
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 74633 stars

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
// v8: APFS clones that share every block count once, so v7 totals can be inflated.
// v9: mixed clone/hardlink groups deduplicate together; bounded lists use path ties.
// v10: shortened directory listings must refresh before they are browsed.
const cacheSchemaVersion = 10

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
		if snapshot.SchemaVersion != cacheSchemaVersion || snapshot.Size <= 0 || !stampWithin(now, snapshot.Updated, overviewCacheTTL) {
			delete(snapshots, path)
		}
	}
	overviewSnapshotCache = snapshots
	overviewSnapshotLoaded = true
	return nil
}

// stampWithin reports whether a stored wall-clock stamp is inside its freshness
// window. A stamp from the future (the system clock was set back) has a
// negative age and reads as expired, so a stale answer is not kept until the
// clock catches up.
func stampWithin(now, stamp time.Time, window time.Duration) bool {
	age := now.Sub(stamp)
	return age >= 0 && age < window
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
		if stampWithin(time.Now(), snapshot.Updated, overviewCacheTTL) {
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
		stampWithin(time.Now(), existing.Updated, overviewCacheTTL/overviewRefreshDivisor) {
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
func getMo
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

### Core Architecture Module: `cmd/analyze/clone_darwin.go`
```
//go:build darwin

package main

import (
	"encoding/binary"
	"unsafe"

	"golang.org/x/sys/unix"
)

// Extended common attributes (sys/attr.h). With FSOPT_ATTR_CMN_EXTENDED they
// travel in the fork group of the attribute list, not in commonattr: asked for
// there, the kernel quietly answers with the plain common attributes (text
// encoding and creation time) and nothing says so.
const (
	attrCmnextCloneID  uint32 = 0x00000100
	attrCmnextExtFlags uint32 = 0x00000200
	efSharesAllBlocks  uint64 = 0x00000040
)

type attrList struct {
	bitmapCount uint16
	reserved    uint16
	commonAttr  uint32
	volAttr     uint32
	dirAttr     uint32
	fileAttr    uint32
	forkAttr    uint32
}

// cloneIdentity reports an APFS file's clone id and whether it still shares
// every block with another file. ok is false when the volume cannot say
// (no clone tracking, a network share) or the path cannot be read, and the
// caller then sizes the file the plain way.
func cloneIdentity(path string) (cloneID uint64, sharesAll bool, ok bool) {
	p, err := unix.BytePtrFromString(path)
	if err != nil {
		return 0, false, false
	}
	list := attrList{
		bitmapCount: unix.ATTR_BIT_MAP_COUNT,
		forkAttr:    attrCmnextCloneID | attrCmnextExtFlags,
	}
	// Reply: u32 length, then the clone id and the extended flags, both u64.
	var buf [20]byte
	_, _, errno := unix.Syscall6(unix.SYS_GETATTRLIST, //nolint:gosec,staticcheck // x/sys has no getattrlist wrapper; the buffers outlive the call
		uintptr(unsafe.Pointer(p)), uintptr(unsafe.Pointer(&list)), //nolint:gosec // see above
		uintptr(unsafe.Pointer(&buf[0])), uintptr(len(buf)), //nolint:gosec // see above
		uintptr(unix.FSOPT_NOFOLLOW|unix.FSOPT_ATTR_CMN_EXTENDED), 0)
	if errno != 0 || binary.LittleEndian.Uint32(buf[0:4]) < uint32(len(buf)) {
		return 0, false, false
	}
	return binary.LittleEndian.Uint64(buf[4:12]), binary.LittleEndian.Uint64(buf[12:20])&efSharesAllBlocks != 0, true
}

```

### Core Architecture Module: `cmd/analyze/clone_other.go`
```
//go:build !darwin

package main

// cloneIdentity has no answer off macOS; files are sized the plain way.
func cloneIdentity(string) (cloneID uint64, sharesAll bool, ok bool) {
	return 0, false, false
}

```

### Core Architecture Module: `cmd/analyze/constants.go`
```
//go:build darwin

package main

import "time"

const (
	// Bound cached and recursive summaries, not the browsed directory listing.
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
	mdlsTimeout            = 5 * time.Second
	duExitWait             = 500 * time.Millisecond
	maxConcurrentOverview  = 8
	batchUpdateSize        = 100
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

func deletePathCmd(path string, counter *int64, audit *deleteAudit) tea.Cmd {
	return func() tea.Msg {
		audit.begin()
		count, err := trashPathWithProgress(path, counter)
		audit.record(path, err)
		audit.end()
		return deleteProgressMsg{
			done:       true,
			err:        err,
			count:      count,
			path:       path,
			logWarning: audit.warning(),
		}
	}
}

// deleteMultiplePathsCmd moves paths to Trash and aggregates results.
func deleteMultiplePathsCmd(paths []string, counter *int64, audit *deleteAudit) tea.Cmd {
	return func() tea.Msg {
		var totalCount int64
		var errors []string
		var removedPaths []string
		audit.begin()

		// Process deeper paths first to avoid parent/child conflicts.
		pathsToDelete := append([]string(nil), paths...)
		sort.Slice(pathsToDelete, func(i, j int) bool {
			return strings.Count(pathsToDelete[i], string(filepath.Separator)) > strings.Count(pathsToDelete[j], string(filepath.Separator))
		})

		for _, path := range pathsToDelete {
			count, err := trashPathWithProgress(path, counter)
			audit.record(path, err)
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
		audit.end()

		return deleteProgressMsg{
			done:         true,
			err:          resultErr,
			count:        totalCount,
			path:         "",
			removedPaths: removedPaths,
			logWarning:   audit.warning(),
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

	for _, homeRoot := r
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
	"strings"
	"time"

	"github.com/charmbracelet/x/ansi"

	"github.com/tw93/mole/internal/units"
)

// Left-aligned block elements filling 1/8 through 7/8 of a cell, indexed by
// eighths. Index 0 is unused: no eighths means nothing to draw.
var subCellBlocks = [8]string{"", "▏", "▎", "▍", "▌", "▋", "▊", "▉"}

func displayPath(path string) string {
	home, err := os.UserHomeDir()
	home = strings.TrimSuffix(home, "/")
	if err != nil || home == "" {
		return path
	}
	if path == home {
		return "~"
	}
	if rest, ok := strings.CutPrefix(path, home+"/"); ok {
		return "~/" + rest
	}
	return path
}

// truncateMiddle trims the middle, keeping head and tail.
func truncateMiddle(s string, maxWidth int) string {
	maxWidth = max(0, maxWidth)
	width := displayWidth(s)
	if width <= maxWidth {
		return s
	}
	if maxWidth < 10 {
		return ansi.Truncate(s, maxWidth, "")
	}
	head := (maxWidth - 3) / 3
	tail := maxWidth - 3 - head
	// TruncateLeft keeps a wide grapheme that straddles the cut, so an odd tail
	// over CJK or flags would overshoot the budget by one cell; cut once more.
	cut := width - tail
	right := ansi.TruncateLeft(s, cut, "")
	for displayWidth(right) > tail {
		cut++
		right = ansi.TruncateLeft(s, cut, "")
	}
	return ansi.Truncate(s, head, "") + "..." + right
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

// Width and truncation share the terminal library's grapheme rules, including
// combining accents, halfwidth kana, CJK punctuation and joined emoji.
func displayWidth(s string) int { return ansi.StringWidth(s) }

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

// sizeColumn fills the 10-column size field with the partial marker in its
// own last column, so units line up whether or not a row is partial.
func sizeColumn(label string) string {
	if trimmed, partial := strings.CutSuffix(label, "+"); partial {
		return fmt.Sprintf("%9s+", trimmed)
	}
	return fmt.Sprintf("%9s ", label)
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

// sizePathBefore is the ordering shared by selection and rendering.
func sizePathBefore(size int64, path string, otherSize int64, otherPath string) bool {
	if size != otherSize {
		return size > otherSize
	}
	return path < otherPath
}

func (h entryHeap) Len() int { return len(h) }

// The heap evicts its smallest item first. Equal sizes fall back to the path
// (the later path goes first), so the surviving rows and their pop order do
// not depend on which worker finished first.
func (h entryHeap) Less(i, j int) bool {
	return sizePathBefore(h[j].Size, h[j].Path, h[i].Size, h[i].Path)
}
func (h entryHeap) Swap(i, j int) { h[i], h[j] = h[j], h[i] }

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

func (h largeFileHeap) Len() int { return len(h) }
func (h largeFileHeap) Less(i, j int) bool {
	return sizePathBefore(h[j].Size, h[j].Path, h[i].Size, h[i].Path)
}
func (h largeFileHeap) Swap(i, j int) { h[i], h[j] = h[j], h[i] }

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
	ctx, cancel := context.WithTimeout(ctx, overviewDuTimeout)
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
				size, err := getDirectorySizeFromDuWithExcludeAndIgnores(ctx, filepath.Join(dir, entry.Name()), "", nil, overviewDuTimeout)
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

	sortDirEntriesBySize(entries)

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
				ctx, cancel := context.WithTimeout(context.Background(), duTimeout)
				defer cancel()
				if insightPaths[item.Path] {
					size, err = measureInsightSize(ctx, item.Path)
				} else {
					size, err = measureOverviewSize(ctx, item.Path)
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
- **Issue #1956** (2026-11-09): **[BUG] Analyze overview reports `unknown` when directory scans exceed the 30-second timeout**
  *Symptoms*: ## Describe the bug  `mo analyze` reports `unknown` sizes for `Applications` and `User Library`, despite both directories being readable and measurable with `/usr/bin/du`.  The likely cause is the hardcoded 30-second `duTimeout` in [`cmd/analyze/constants.go`](https://github.com/tw93/Mole/blob/main/cmd/analyze/constants.go).  ## Steps to reproduce  1. Run `mo analyze`. 2. Observe `unknown` sizes for `Applications` and `User Library`. 3. Measure the directories directly: ```swift /usr/bin/time -p /usr/bin/du -skPx "$HOME/Library" /usr/bin/time -p /usr/bin/du -skPx /Applications ```  Results on my machine:  | Directory    | Size (KiB)  | Wall time | | ------------ | ----------- | --------- | | User Library | 188,924,628 | 33.64s    | | Applications | 57,714,556  | 22.49s    |  The User Library scan exceeds Mole's timeout even when run independently. Applications completes within 30 seconds independently, but may exceed the limit when competing with Mole's other concurrent overview scans.  ## Relevant implementation history  - [Commit 749ed22](https://github.com/tw93/Mole/commit/749ed2230bf4350982a5b76b749a56d79647d0e1) reduced the timeout from 60 to 30 seconds to fail faster and fall back to concurrent scanning. - [Commit d04453f](https://github.com/tw93/Mole/commit/d04453f190ddf03a3fe4f9e15c0733d0ec280e32) changed fallback behavior to respect the original deadline. Once that deadline expires, the fallback no longer runs. - [Commit d382692](https://github.com/tw93/Mole/commit/d

- **Issue #1944** (2026-11-08): **状态栏 GPU 无法实时刷新**
  *Symptoms*: ### Mole Mac app version  1.19.1 (366)  ### macOS version  26.7.1 (Tahoe)  ### Mac model  MacBookPro16,1 (Intel(R) Core(TM) i9-9980HK CPU @ 2.40GHz)  ### Affected area  Status  ### What happened?  状态栏的 GPU 状态无法实时刷新，具体表现：Mole 随系统启动，状态栏的 GPU 值显示为横线，点击状态栏，此时状态栏获取到与弹出层一样的 GPU 数值，然后就不再更新，直到再次手动点击状态栏图标。  ### Steps to reproduce  1. Mole 随系统启动，状态栏的 GPU 值显示为横线。 2. 点击状态栏，此时状态栏获取到与弹出层一样的 GPU 数值。 3. GPU 数值不再更新，直到再次手动点击状态栏图标。  ### Expected behavior  GPU 数值可以像其他参数一样可以实时刷新。  ### Screenshots or safe logs  录屏是 Bug 的具体表现行为 https://github.com/user-attachments/assets/d3a254fb-623f-490f-819e-f67147370c42  截图是系统环境，希望对定位问题有所帮助  <img width="321" height="422" alt="Image" src="https://github.com/user-attachments/assets/473c945c-7248-4ee4-b1c8-80bcebee9e6b" />  ### Before submitting  - [x] I updated to the latest stable Mole Mac app, reopened it, and reproduced this problem (or this report explains why I cannot update). - [x] I did not include license keys, order numbers, or private data.

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

### Incident Patch 1: `77aa5a28` (2026-11-11)
**Commit Message**: fix(clean): prove a LaunchAgent path missing by ENOENT, not by test -e

[[ -e ]] reads a denied lookup as missing: under a sandbox denying
~/Library/Mail/V10, an existing agent there was judged gone and dropped its
claim, and TCC denials behave the same way. Absence is now proven by the
errno: /usr/bin/stat under LC_ALL=C must fail with "No such file or
directory", and anything else (EPERM, EACCES, a timeout) keeps the claim.
BSD stat ships in every macOS base system, while perl is a deprecated
runtime. The probe runs under run_with_timeout before any builtin test
touches the path, so a stale NFS or autofs path cannot block the scan.
The nearest existing ancestor must also list (/bin/ls -f) rather than
merely carry the search bit.

Verified: new bats case in clean_apps.bats. It fails on the previous
apps.sh ("lost claim com.example.listless", a wx-only folder). Separate
mutations each fail it: no listing check (listless), errno ignored
(denied, run under sandbox-exec), timeout not treated as doubt
(slowprobe). Passes under /bin/bash 3.2.

Rollback: git revert this commit.

**File**: `lib/clean/apps.sh` (modified, +15/-1)
```diff
@@ -353,6 +353,16 @@ _mole_launch_agent_path_provably_missing() {
             "$lower_home/$folder" | "$lower_home/$folder"/*) return 1 ;;
         esac
     done
+    # [[ -e ]] reads a denied lookup (a TCC or sandbox EPERM) as missing, so
+    # absence is proven by the errno itself. BSD stat is in every macOS base
+    # system (perl is a deprecated runtime) and reports through strerror, fixed
+    # English under LC_ALL=C; only ENOENT counts. The timeout keeps a stale NFS
+    # or autofs path from blocking the scan, and it runs before any builtin
+    # test touches the path.
+    local stat_error="" stat_rc=0
+    stat_error=$(run_with_timeout "$MOLE_TIMEOUT_QUICK_DETECT_SEC" /usr/bin/env LC_ALL=C \
+        /usr/bin/stat -f %N -- "$path" 2>&1 > /dev/null < /dev/null) || stat_rc=$?
+    [[ $stat_rc -eq 1 && "$stat_error" == *": No such file or directory" ]] || return 1
     local prefix="" component="" rest="${path#/}"
     while [[ -n "$rest" ]]; do
         component="${rest%%/*}"
@@ -369,7 +379,11 @@ _mole_launch_agent_path_provably_missing() {
     local parent="${path%/*}"
     while [[ "$parent" == /* ]]; do
         if [[ -e "$parent" ]]; then
-            [[ -d "$parent" && -x "$parent" ]]
+            [[ -d "$parent" && -x "$parent" ]] || return 1
+            # The nearest existing folder must really list, not only carry the
+            # Unix search bit.
+            run_with_timeout "$MOLE_TIMEOUT_QUICK_DETECT_SEC" /bin/ls -f -- "$parent" \
+                > /dev/null 2>&1 < /dev/null
             return
         fi
         parent="${parent%/*}"
```

**File**: `tests/clean_apps.bats` (modified, +53/-0)
```diff
@@ -495,6 +495,59 @@ _assert_launch_agent_claims() {
     _assert_launch_agent_claims keep com.example.slashhome
 }
 
+@test "scan_installed_apps proves a LaunchAgent path missing by its errno, not by test -e" {
+    local agent_home="$HOME/agent-errno"
+    [[ ! -d "$agent_home" ]] || chmod -R u+rwx "$agent_home"
+    rm -rf "$agent_home"
+    mkdir -p "$agent_home/Library/LaunchAgents" "$agent_home/Library/Mail/V10" "$agent_home/listless"
+    printf '#!/bin/sh\n' > "$agent_home/Library/Mail/V10/agent"
+    chmod +x "$agent_home/Library/Mail/V10/agent"
+    local AGENT_DIR="$agent_home/Library/LaunchAgents"
+    _write_launch_agent_fixture com.example.control "$agent_home/opt/gone"
+    _write_launch_agent_fixture com.example.listless "$agent_home/listless/gone/agent"
+    chmod 311 "$agent_home/listless"
+    _scan_launch_agent_claims "$agent_home"
+    chmod 755 "$agent_home/listless"
+    [ "$status" -eq 0 ] || { echo "$output"; return 1; }
+    _assert_launch_agent_claims drop com.example.control
+    _assert_launch_agent_claims keep com.example.listless
+
+    # A stat probe that times out (a stale NFS or autofs path) keeps the claim.
+    rm -f "$agent_home/.cache/mole/installed_apps_cache"
+    _write_launch_agent_fixture com.example.slowprobe "$agent_home/slow/gone/agent"
+    cat > "$agent_home/preamble.sh" <<'SH'
+run_with_timeout() {
+    shift
+    case " $* " in *" /usr/bin/stat "*) return 124 ;; esac
+    "$@"
+}
+SH
+    _scan_launch_agent_claims "$agent_home" MOLE_TEST_PREAMBLE="$agent_home/preamble.sh"
+    [ "$status" -eq 0 ] || { echo "$output"; return 1; }
+    _assert_launch_agent_claims keep com.example.slowprobe com.example.control
+
+    # A lookup the sandbox denies (as TCC does) is EPERM, not ENOENT.
+    if ! command -v sandbox-exec > /dev/null 2>&1 ||
+        ! sandbox-exec -p '(version 1)(allow default)' /usr/bin/true 2> /dev/null; then
+        skip "sandbox-exec unavailable"
+    fi
+    rm -f "$agent_home/.cache/mole/installed_apps_cache"
+    _write_launch_agent_fixture com.example.denied "$agent_home/Library/Mail/V10/agent"
+    printf '(version 1)\n(allow default)\n(deny file-read-metadata file-read-data (subpath "%s"))\n' \
+        "$agent_home/Library/Mail/V10" > "$agent_home/deny.sb"
+    run sandbox-exec -f "$agent_home/deny.sb" env HOME="$agent_home" PROJECT_ROOT="$PROJECT_ROOT" \
+        MOLE_TEST_MODE=1 /bin/bash --noprofile --norc <<'EOF'
+set -euo pipefail
+source "$PROJECT_ROOT/lib/core/common.sh"
+source "$PROJECT_ROOT/lib/clean/apps.sh"
+debug_log() { :; }
+scan_installed_apps "$HOME/installed.txt"
+cat "$HOME/installed.txt"
+EOF
+    [ "$status" -eq 0 ] || { echo "$output"; return 1; }
+    _assert_launch_agent_claims keep com.example.denied
+}
+
 @test "scan_installed_apps drops the claim of a LaunchAgent whose job provably cannot run" {
     local agent_home="$HOME/agent-dead"
     rm -rf "$agent_home"
```

---

### Incident Patch 2: `6bb932a6` (2026-11-11)
**Commit Message**: fix(clean): run no tmutil while a network share is mounted

Every tmutil verb opens each mounted volume as it starts, and macOS charges
that access to the calling process. In the Mac app this raised "access
files on a network volume" during a Clean scan when an SMB share was
mounted and Full Disk Access was missing, so the app runs no tmutil from a
scan while a non-local volume is mounted. The CLI runs tmutil
listlocalsnapshots / from the Large files snapshot row and from
clean_local_snapshots (with its tmutil status probe), which the same
prompt would charge to the terminal. That was not reproduced here: nothing
was mounted and TCC was not changed.

mole_network_volume_mounted reads /sbin/mount with no arguments, the
kernel's cached getmntinfo(MNT_NOWAIT) table, and treats any entry without
the local flag as a network volume, except autofs trigger nodes. Options
are taken after the last " (" so a mount point with parentheses parses. An
unreadable or unparsable table also skips: the rows are report-only, so a
skip costs one row and prints nothing. clean_time_machine_failed_backups
keeps its tmutil calls, because a network Time Machine destination is
itself such a mount.

Verified: 

**File**: `.claude/rules/clean.md` (modified, +1/-0)
```diff
@@ -51,6 +51,7 @@ Developer and toolchain caches in `lib/clean/dev.sh` also follow `.claude/rules/
 - Chrome / Edge / Brave old-version cleanup is one table-driven helper (`_clean_chromium_old_versions`) plus three thin public wrappers; the wrapper names are the test surface, so keep them. `clean_edge_updater_old_versions` is deliberately NOT part of it: it prunes staged updater payloads strictly older than the installed Edge (falling back to keep-latest by `sort -V` when the installed version is unreadable), has no `Current` symlink, and never escalates to a sudo removal, so folding it in would silently change its semantics.
 - Large-files review rows share `_large_candidate_size_kb`: a du exit of 1 means some entry was unreadable and still carries a usable total, while a timeout never does. The E5RT row passes `exact` and drops a status-1 total, because #1631 promised incomplete measurements are never shown as a complete size. Tighten a new row's evidence at that row, not in the shared helper; the compiled-model row once made the helper strict and hid an 11.78GB `Simulator data` row. Locked by `large files keeps a du total that skipped unreadable entries` and `large files skips an E5RT total that missed unreadable entries (#1631)` in `tests/clean_user_core.bats`.
 - The fixed rows are measured ahead of the report by a pool of at most four workers under one shared deadline (`_large_prefetch_queue_rows`), and the worktree container search runs beside it; a new fixed row belongs in that list too, or it is measured inline after the pool and adds its full time. `large files queue lists every fixed HOME row the report measures` in `tests/clean_user_core.bats` reads every literal `$HOME` row out of the report source and fails when the queue misses one. The Docker Desktop data row stays queued unconditionally, because whether the report skips it depends on the later `docker system df` probe. That probe runs only on a local engine (`.claude/rules/clean-dev.md`), once, and its row reads `Images 931.5MB, 859.1MB reclaimable`: types and reclaimable figures under 1MB are left out.
+- The snapshot rows (`check_large_file_candidates`, and `clean_local_snapshots` with its `tmutil status` probe) run no `tmutil` while any volume without the `local` flag is mounted (`mole_network_volume_mounted` in `lib/clean/snapshots.sh`); the rows are then absent, with no skip line. Every tmutil verb opens each mounted volume, and the Mac app raised "access files on a network volume" from its scan with an SMB share mounted and no Full Disk Access (2026-11-10); the CLI's call would be charged to the terminal the same way (not reproduced on the CLI). The table is `/sbin/mount` with no arguments, which reads the cached `getmntinfo(MNT_NOWAIT)` table and touches no volume (the same flags the Mac app reads with `getfsstat(MNT_NOWAIT)`); the options are taken after the LAST ` (` so a mount point holding parentheses parses, and `autofs` trigger nodes (`/System/Volumes/Data/home`) do not count. An unreadable or unparsable table also skips (report-only rows, so skipping costs nothing; the Mac app fails open there). `clean_time_machine_failed_backups` keeps its `tmutil` calls: a network Time Machine destination is itself such a mount, and skipping would stop that cleanup for every NAS-backup user. Tests stub `_mole_mount_table`. Locked by `mole_network_volume_mounted reads the local flag of every mount table entry`, `clean_local_snapshots runs no tmutil while a network share is mounted` and `large files lists snapshots with only local volumes and runs no tmutil beside a network share` in `tests/clean_system_maintenance.bats`.
 - The generic Application Support sweep (`clean_application_support_logs`) skips an app folder whose `SingletonLock` (Chromium and Electron write `<host>-<pid>` there while running) names a live pid or cannot be read, and checks again before each cache folder; it cleared Code Cache and GPUCache under running Docker Desktop, VS Code and T3 Code before. A stale lock left by a crash, and apps with no lock, keep the old behaviour. Locked by `clean_application_support_logs keeps caches of a running Electron app` in `tests/clean_user_core.bats`.
 - Browser signing-clone probes must preserve signal statuses through process checks, metadata, open-handle checks, snapshots, and final guards. A timeout keeps the clone; an interrupt stops later candidates and system cleanup stages. Locked by `tests/browser_clones.bats`, where each snapshot guard has its own case except the two uid ownership checks (a differently owned fixture needs root) and the root-prefix check.
 - **Leaked automation browsers are identified by a `playwright_chromiumdev_profile` browser root with ppid 1, never by the playwright-cli daemon.** The daemon is spawned detached, so ppid 1 is its normal state for the life of an active session; matching it kills a live session. A profile directory is stale only when `pgrep -f` returns exactly 1; any other status is an unknown
```

**File**: `lib/clean/snapshots.sh` (modified, +38/-0)
```diff
@@ -57,3 +57,41 @@ mole_local_snapshot_rows() {
             "from $(mole_join_names "${owners[@]}"), deleted files keep using space until removed"
     fi
 }
+
+# The kernel's mount table as /sbin/mount prints it. With no arguments it
+# reads getmntinfo(MNT_NOWAIT), the cached table, and touches no volume.
+_mole_mount_table() {
+    run_with_timeout "$MOLE_TIMEOUT_QUICK_DETECT_SEC" /sbin/mount < /dev/null 2> /dev/null
+}
+
+# Every tmutil verb opens each mounted volume as it starts, and macOS charges
+# that access to the calling process: with a network share mounted and no Full
+# Disk Access, the Mac app raised "access files on a network volume" from its
+# scan, and the CLI's call would be charged to the terminal the same way. So
+# the snapshot rows run no tmutil while a volume without the "local" flag
+# (SMB, NFS, AFP, WebDAV, a FUSE share) is mounted; an autofs trigger node
+# such as /System/Volumes/Data/home is no mount of its own. Returns 0 when such
+# a volume is mounted or the table cannot be read or parsed (the rows are
+# report-only, so skipping costs nothing), 1 when every entry is local, and a
+# signal status as is.
+mole_network_volume_mounted() {
+    local table="" rc=0
+    table=$(_mole_mount_table) || rc=$?
+    if mole_rc_signal "$rc"; then
+        return "$rc"
+    fi
+    [[ $rc -eq 0 && -n "$table" ]] || return 0
+    local line="" options=""
+    while IFS= read -r line; do
+        [[ -n "$line" ]] || continue
+        [[ "$line" == *" ("*")" ]] || return 0
+        options="${line##* (}"
+        options="${options%)}"
+        [[ "${options%%,*}" != "autofs" ]] || continue
+        case ", $options," in
+            *", local,"*) continue ;;
+        esac
+        return 0
+    done <<< "$table"
+    return 1
+}
```

**File**: `lib/clean/system.sh` (modified, +5/-0)
```diff
@@ -1431,6 +1431,11 @@ clean_local_snapshots() {
     if ! command -v tmutil > /dev/null 2>&1; then
         return 0
     fi
+    # No tmutil while a network share is mounted (see mole_network_volume_mounted).
+    local network_mount_rc=0
+    mole_network_volume_mounted || network_mount_rc=$?
+    mole_rc_signal "$network_mount_rc" && return "$network_mount_rc"
+    [[ $network_mount_rc -eq 1 ]] || return 0
     # The Time Machine row needs Time Machine configured and idle; snapshots
     # from other backup apps are listed either way (#1916).
     local include_tm=false
```

**File**: `lib/clean/user.sh` (modified, +9/-1)
```diff
@@ -3665,7 +3665,15 @@ _check_large_file_candidates_body() {
 
     _report_large_or_stop "macOS updates cache" "$HOME/Library/Updates" || return $?
 
-    if [[ "${SYSTEM_CLEAN:-false}" != "true" ]] && command -v tmutil > /dev/null 2>&1; then
+    local network_mount_rc=0
+    [[ "${SYSTEM_CLEAN:-false}" == "true" ]] || mole_network_volume_mounted || network_mount_rc=$?
+    if mole_rc_signal "$network_mount_rc"; then
+        _mole_record_clean_cancellation "$network_mount_rc"
+        stop_section_spinner
+        return "$network_mount_rc"
+    fi
+    if [[ "${SYSTEM_CLEAN:-false}" != "true" && $network_mount_rc -eq 1 ]] &&
+        command -v tmutil > /dev/null 2>&1; then
         # Snapshots from other backup apps exist without Time Machine (#1916).
         local snapshot_include_tm=false snapshot_list snapshot_rows=""
         if defaults read /Library/Preferences/com.apple.TimeMachine AutoBackup 2> /dev/null | grep -qE '^[01]$'; then
```

**File**: `tests/clean_system_maintenance.bats` (modified, +121/-0)
```diff
@@ -601,6 +601,7 @@ EOF
 set -euo pipefail
 source "$PROJECT_ROOT/lib/core/common.sh"
 source "$PROJECT_ROOT/lib/clean/system.sh"
+_mole_mount_table() { echo "/dev/disk3s1s1 on / (apfs, local, journaled)"; }
 
 defaults() { echo "1"; }
 
@@ -628,6 +629,7 @@ EOF
 set -euo pipefail
 source "$PROJECT_ROOT/lib/core/common.sh"
 source "$PROJECT_ROOT/lib/clean/system.sh"
+_mole_mount_table() { echo "/dev/disk3s1s1 on / (apfs, local, journaled)"; }
 
 defaults() { echo "1"; }
 
@@ -650,6 +652,7 @@ EOF
 set -euo pipefail
 source "$PROJECT_ROOT/lib/core/common.sh"
 source "$PROJECT_ROOT/lib/clean/system.sh"
+_mole_mount_table() { echo "/dev/disk3s1s1 on / (apfs, local, journaled)"; }
 
 defaults() { return 1; }
 run_with_timeout() {
@@ -682,6 +685,7 @@ EOF
 set -euo pipefail
 source "$PROJECT_ROOT/lib/core/common.sh"
 source "$PROJECT_ROOT/lib/clean/system.sh"
+_mole_mount_table() { echo "/dev/disk3s1s1 on / (apfs, local, journaled)"; }
 
 defaults() { echo "1"; }
 run_with_timeout() {
@@ -708,6 +712,7 @@ EOF
 set -euo pipefail
 source "$PROJECT_ROOT/lib/core/common.sh"
 source "$PROJECT_ROOT/lib/clean/system.sh"
+_mole_mount_table() { echo "/dev/disk3s1s1 on / (apfs, local, journaled)"; }
 
 defaults() { echo "1"; }
 run_with_timeout() {
@@ -736,6 +741,7 @@ EOF
 set -euo pipefail
 source "$PROJECT_ROOT/lib/core/common.sh"
 source "$PROJECT_ROOT/lib/clean/system.sh"
+_mole_mount_table() { echo "/dev/disk3s1s1 on / (apfs, local, journaled)"; }
 
 defaults() { echo "1"; }
 run_with_timeout() {
@@ -762,6 +768,7 @@ EOF
 set -euo pipefail
 source "$PROJECT_ROOT/lib/core/common.sh"
 source "$PROJECT_ROOT/lib/clean/system.sh"
+_mole_mount_table() { echo "/dev/disk3s1s1 on / (apfs, local, journaled)"; }
 
 defaults() { echo "1"; }
 run_with_timeout() { echo "UNEXPECTED_LISTING"; }
@@ -780,6 +787,120 @@ EOF
     [[ "$output" != *"UNEXPECTED_LISTING"* ]] || { echo "$output"; return 1; }
 }
 
+@test "mole_network_volume_mounted reads the local flag of every mount table entry" {
+    run /bin/bash --noprofile --norc << 'EOF'
+set -euo pipefail
+source "$PROJECT_ROOT/lib/core/common.sh"
+source "$PROJECT_ROOT/lib/clean/snapshots.sh"
+
+LOCAL_TABLE='/dev/disk3s1s1 on / (apfs, sealed, local, read-only, journaled)
+devfs on /dev (devfs, local, nobrowse)
+map auto_home on /System/Volumes/Data/home (autofs, automounted, nobrowse)
+/dev/disk5s1 on /Volumes/Disk (with) parens (apfs, local, nodev, nosuid, journaled)
+devices -- file:///Users/me/Library/Containers/x/Data/ on /Users/me/DeviceFS (devicefs, local, nodev, nosuid, noowners, fskit, mounted by me)'
+verdict() {
+    local rc=0
+    mole_network_volume_mounted || rc=$?
+    echo "$1=$rc"
+}
+TABLE="$LOCAL_TABLE"
+TABLE_RC=0
+_mole_mount_table() { printf '%s\n' "$TABLE"; return "$TABLE_RC"; }
+verdict local
+TABLE="$LOCAL_TABLE"$'\n''//me@192.168.1.2/share on /Volumes/share (smbfs, nodev, nosuid, mounted by me)'
+verdict smb
+TABLE="$LOCAL_TABLE"$'\n''nas:/export on /Volumes/export (nfs, asynchronous)'
+verdict nfs
+TABLE="$LOCAL_TABLE"$'\n''//me@nas/share on /Volumes/share (apfs, local, copy) (smbfs, nodev, nosuid, mounted by me)'
+verdict smbparen
+TABLE="something this parser does not know"
+verdict unknown
+TABLE=""
+verdict empty
+TABLE="$LOCAL_TABLE"
+TABLE_RC=124
+verdict timeout
+TABLE_RC=130
+verdict signal
+EOF
+
+    [ "$status" -eq 0 ] || { echo "$output"; return 1; }
+    local expected
+    for expected in local=1 smb=0 nfs=0 smbparen=0 unknown=0 empty=0 timeout=0 signal=130; do
+        [[ "$output" == *"$expected"* ]] || { echo "missing $expected"; echo "$output"; return 1; }
+    done
+}
+
+@test "clean_local_snapshots runs no tmutil while a network share is mounted" {
+    run /bin/bash --noprofile --norc << 'EOF'
+set -euo pipefail
+source "$PROJECT_ROOT/lib/core/common.sh"
+source "$PROJECT_ROOT/lib/clean/system.sh"
+_mole_mount_table() {
+    printf '%s\n' '/dev/disk3s1s1 on / (apfs, local, journaled)' \
+        '//me@nas/share on /Volumes/share (smbfs, nodev, nosuid, mounted by me)'
+}
+
+defaults() { echo "1"; }
+run_with_timeout() { echo "UNEXPECTED_TMUTIL:$*"; }
+tmutil() { echo "UNEXPECTED_TMUTIL:$*"; }
+start_section_spinner(){ echo "SPINNER:$1"; }
+stop_section_spinner(){ :; }
+note_activity(){ :; }
+tm_is_running(){ echo "UNEXPECTED_TM_PROBE"; return 1; }
+
+clean_local_snapshots
+EOF
+
+    [ "$status" -eq 0 ] || { echo "$output"; return 1; }
+    [ -z "$output" ] || { echo "$output"; return 1; }
+}
+
+@test "large files lists snapshots with only local volumes and runs no tmutil beside a network share" {
+    local review_home="$HOME/large-review-network-share"
+    mkdir -p "$review_home"
+
+    local mounts
+    for mounts in local share; do
+        rm -f "$review_home/tmutil.calls"
+        run env HOME="$review_home" PROJECT_ROOT="$PROJECT_ROOT" MOUNTS="$mounts" \
+            /bin/bash --noprofile --norc << 'EOF'
+set -euo pipefail
+source "$PROJECT_ROOT/lib/core/common.sh"
+source "$PROJECT_ROOT/lib/clean/user.sh"
+start_section_spinner() { :
```

**File**: `tests/clean_user_core.bats` (modified, +2/-0)
```diff
@@ -3939,6 +3939,7 @@ EOF
 set -euo pipefail
 source "$PROJECT_ROOT/lib/core/common.sh"
 source "$PROJECT_ROOT/lib/clean/user.sh"
+_mole_mount_table() { echo "/dev/disk3s1s1 on / (apfs, local, journaled)"; }
 start_section_spinner() { :; }
 stop_section_spinner() { :; }
 note_activity() { :; }
@@ -3965,6 +3966,7 @@ EOF
 set -euo pipefail
 source "$PROJECT_ROOT/lib/core/common.sh"
 source "$PROJECT_ROOT/lib/clean/user.sh"
+_mole_mount_table() { echo "/dev/disk3s1s1 on / (apfs, local, journaled)"; }
 start_section_spinner() { :; }
 stop_section_spinner() { :; }
 note_activity() { :; }
```

---

### Incident Patch 3: `f5b4bba3` (2026-11-11)
**Commit Message**: fix(optimize): read and write Spotlight rules in com.apple.Spotlight

The orphan-rule task asked defaults for com.apple.spotlight. cfprefsd keys
domains by the exact string even on a case-insensitive volume, so while
Spotlight holds com.apple.Spotlight the lowercase read finds no
EnabledPreferenceRules and the task reports the rules clean while orphans
remain, and a lowercase write reaches the shared plist but never Spotlight.
The Mac app fixed the same defect on 2026-11-10.

Measured on this Mac (case-insensitive APFS) with a throwaway domain held
open by a long-lived NSUserDefaults client: a read in the other case
returned "Could not find key" for a value the client had written (twice);
a write in the other case updated the one shared file while the client kept
its old value; an exact-case write reached the client within a second. With
no live client both spellings agree, which is why it went unnoticed. The
domain, its plist path and every defaults read, write and delete now use
Spotlight's own case.

Verified: the new test fails on the old code (read and write go to
com.apple.spotlight) and passes now; optimize.bats Spotlight tests pass;
check.sh --no-format passes;
full ./scrip

**File**: `.claude/rules/optimize.md` (modified, +1/-0)
```diff
@@ -12,6 +12,7 @@ paths:
 - Preference repair and optimize cleanup must skip protected and whitelisted plists before attempting removal.
 - Broken-preference repair lints through `/usr/bin/plutil` (`_mole_plutil_lint`), never a PATH-provided `plutil`, and an unreadable preference file is unknown, not corrupt: retain it with a `SKIPPED` reason instead of removing it. Locked by `fix_broken_preferences keeps an unreadable plist and still removes a readable broken one` and `fix_broken_preferences keeps valid plists when a broken plutil shadows the system one` in `tests/optimize.bats`.
 - Spotlight orphan-rule optimization must parse a complete typed snapshot before resolving apps and recheck the snapshot immediately before writing. A failed indexed plist read is not evidence that the array ended. Locked by `tests/optimize.bats`.
+- Spotlight's preferences domain is `com.apple.Spotlight`, spelled exactly, for every `defaults` read, write and delete and for the plist path. cfprefsd keys domains by the exact string even on a case-insensitive volume: measured 2026-11-11 with a throwaway domain held open by a long-lived NSUserDefaults client, a read in the other case found no key the client had written, and a write in the other case reached the shared file but never the client, while the exact case reached it within a second. The lowercase spelling made the gate report the rules clean while Spotlight held them, the same defect Mole Mac fixed on 2026-11-10. Locked by `Spotlight rules are read and written in the domain Spotlight itself uses`. Open: the snapshot reads the plist file, which can lag what cfprefsd holds (the file read `<dict/>` while the client's value sat in cfprefsd); `defaults export com.apple.Spotlight -` would read the live domain.
 - The CoreDuet WAL/SHM rule is a Critical Safety Rule in `AGENTS.md`.
 - Notification database cleanup refreshes only `gui/$UID/com.apple.notificationcenterui.agent` through the fixed `/bin/launchctl kill SIGTERM` command, bounded by the existing medium timeout. The system plist `/System/Library/LaunchAgents/com.apple.notificationcenterui.plist` names that service and its `/System/Library/CoreServices/NotificationCenter.app` executable. Never use `killall NotificationCenter` or a path-check-then-PID-kill fallback: a same-named third-party process matches the former, and PID reuse remains between the latter's check and signal. launchd owns the service instance; missing, stopped or refused services do not undo successful SQL cleanup. Dry runs send no signal. Locked by `notification refresh targets only its current-user launchd service`, `notification refresh never falls back to name killing after launchd refusal` and `notification cleanup dry run never refreshes the service` in `tests/optimize_db.bats`.
 - DNS refresh likewise signals a launchd service, never `sudo killall -HUP mDNSResponder`. Read `Label` only from `/System/Library/LaunchDaemons/com.apple.mDNSResponder.plist` through `/usr/bin/plutil`, accept only `com.apple.mDNSResponder` or `com.apple.mDNSResponder.reloaded` (the latter is the live label on macOS 26), then retain sudo for `launchctl kill SIGHUP system/<label>`. An unreadable or unrecognized label fails before either cache mutation. macOS 27 refuses `launchctl kill` on this service to every caller, root included (`Not privileged to signal service.`, #1867): after that one launchctl message, and only then, Mole retries once as the service account, `sudo -u _mdnsresponder /usr/bin/killall -u _mdnsresponder -HUP mDNSResponder` (proposed and verified on 27.2 in #1867): the kernel lets that account signal only processes it owns, and `-u` narrows the match to them, so a same-named process elsewhere cannot be reached, which is what ruled out root `killall` and the PID route, both still never used. If that retry also fails the task is skipped with its reason, not failed; any other launchctl failure stays a failure with no retry. VPN, dry-run and authorization gates remain before the plist read. Locked by the four `DNS refresh` service-target/refusal/retry tests in `tests/optimize.bats`.
```

**File**: `lib/optimize/tasks.sh` (modified, +5/-2)
```diff
@@ -978,11 +978,14 @@ opt_spotlight_index_optimize() {
 
 # Remove orphaned Spotlight search-rule entries.
 # Uninstalling an app (especially Mac App Store apps that synced via iCloud)
-# can leave its bundle id behind in com.apple.spotlight EnabledPreferenceRules,
+# can leave its bundle id behind in com.apple.Spotlight EnabledPreferenceRules,
 # showing up as a dead row in System Settings > Spotlight (#1000). macOS never
 # prunes these, so we drop entries whose app is no longer installed.
+# The domain is spelled in Spotlight's own case: cfprefsd keys domains by the
+# exact string, so while Spotlight holds com.apple.Spotlight a lowercase read
+# finds no rules and a lowercase write reaches the file but never Spotlight.
 opt_prune_spotlight_orphan_rules() {
-    local domain="com.apple.spotlight"
+    local domain="com.apple.Spotlight"
     local plist="$HOME/Library/Preferences/${domain}.plist"
 
     if ! defaults read "$domain" EnabledPreferenceRules &> /dev/null; then
```

**File**: `tests/optimize.bats` (modified, +41/-7)
```diff
@@ -1017,7 +1017,7 @@ EOF
 set -euo pipefail
 source "$PROJECT_ROOT/lib/core/common.sh"
 source "$PROJECT_ROOT/lib/optimize/tasks.sh"
-PLIST="$HOME/Library/Preferences/com.apple.spotlight.plist"
+PLIST="$HOME/Library/Preferences/com.apple.Spotlight.plist"
 mkdir -p "$(dirname "$PLIST")"
 rm -f "$PLIST"
 /usr/libexec/PlistBuddy \
@@ -1054,7 +1054,7 @@ EOF
 set -euo pipefail
 source "$PROJECT_ROOT/lib/core/common.sh"
 source "$PROJECT_ROOT/lib/optimize/tasks.sh"
-PLIST="$HOME/Library/Preferences/com.apple.spotlight.plist"
+PLIST="$HOME/Library/Preferences/com.apple.Spotlight.plist"
 mkdir -p "$(dirname "$PLIST")"
 rm -f "$PLIST"
 /usr/libexec/PlistBuddy \
@@ -1094,7 +1094,7 @@ EOF
 set -euo pipefail
 source "$PROJECT_ROOT/lib/core/common.sh"
 source "$PROJECT_ROOT/lib/optimize/tasks.sh"
-PLIST="$HOME/Library/Preferences/com.apple.spotlight.plist"
+PLIST="$HOME/Library/Preferences/com.apple.Spotlight.plist"
 mkdir -p "$(dirname "$PLIST")"
 rm -f "$PLIST"
 /usr/libexec/PlistBuddy \
@@ -1123,7 +1123,7 @@ EOF
 set -euo pipefail
 source "$PROJECT_ROOT/lib/core/common.sh"
 source "$PROJECT_ROOT/lib/optimize/tasks.sh"
-PLIST="$HOME/Library/Preferences/com.apple.spotlight.plist"
+PLIST="$HOME/Library/Preferences/com.apple.Spotlight.plist"
 mkdir -p "$(dirname "$PLIST")"
 rm -f "$PLIST"
 /usr/libexec/PlistBuddy \
@@ -1152,7 +1152,7 @@ EOF
 set -euo pipefail
 source "$PROJECT_ROOT/lib/core/common.sh"
 source "$PROJECT_ROOT/lib/optimize/tasks.sh"
-PLIST="$HOME/Library/Preferences/com.apple.spotlight.plist"
+PLIST="$HOME/Library/Preferences/com.apple.Spotlight.plist"
 mkdir -p "$(dirname "$PLIST")"
 rm -f "$PLIST"
 /usr/libexec/PlistBuddy \
@@ -1182,7 +1182,7 @@ EOF
 set -euo pipefail
 source "$PROJECT_ROOT/lib/core/common.sh"
 source "$PROJECT_ROOT/lib/optimize/tasks.sh"
-PLIST="$HOME/Library/Preferences/com.apple.spotlight.plist"
+PLIST="$HOME/Library/Preferences/com.apple.Spotlight.plist"
 mkdir -p "${PLIST%/*}"
 printf '%s' '<plist version="1.0"><dict><key>EnabledPreferenceRules</key><array><string>com.missing.App</string><string>com.apple.Safari</string></array></dict></plist>' > "$PLIST"
 defaults() { case "$1" in read) return 0;; *) echo "UNEXPECTED_WRITE $*";; esac; }
@@ -1207,7 +1207,7 @@ EOF
 set -euo pipefail
 source "$PROJECT_ROOT/lib/core/common.sh"
 source "$PROJECT_ROOT/lib/optimize/tasks.sh"
-PLIST="$HOME/Library/Preferences/com.apple.spotlight.plist"
+PLIST="$HOME/Library/Preferences/com.apple.Spotlight.plist"
 mkdir -p "${PLIST%/*}"
 printf '%s' '<plist version="1.0"><dict><key>EnabledPreferenceRules</key><array><string>com.missing.App</string><dict><key>protected</key><true/></dict></array></dict></plist>' > "$PLIST"
 defaults() { case "$1" in read) return 0;; *) echo "UNEXPECTED_WRITE $*";; esac; }
@@ -1218,6 +1218,40 @@ EOF
     [[ "$output" != *"UNEXPECTED_WRITE"* ]] || return 1
 }
 
+@test "Spotlight rules are read and written in the domain Spotlight itself uses" {
+	# cfprefsd keys domains by exact string: while Spotlight holds
+	# com.apple.Spotlight, com.apple.spotlight reads no rules and a write to it
+	# never reaches Spotlight, even on a case-insensitive volume.
+	for keep in some none; do
+		run env HOME="$HOME" PROJECT_ROOT="$PROJECT_ROOT" KEEP="$keep" /bin/bash --noprofile --norc <<'EOF'
+set -euo pipefail
+source "$PROJECT_ROOT/lib/core/common.sh"
+source "$PROJECT_ROOT/lib/optimize/tasks.sh"
+PLIST="$HOME/Library/Preferences/com.apple.Spotlight.plist"
+mkdir -p "${PLIST%/*}"
+rm -f "$PLIST"
+/usr/libexec/PlistBuddy -c "Add :EnabledPreferenceRules array" "$PLIST" >/dev/null 2>&1
+[[ "$KEEP" == none ]] || /usr/libexec/PlistBuddy -c "Add :EnabledPreferenceRules:0 string System.iphoneApps" "$PLIST" >/dev/null 2>&1
+/usr/libexec/PlistBuddy -c "Add :EnabledPreferenceRules: string com.gone.App" "$PLIST" >/dev/null 2>&1
+: > "$HOME/defaults-calls"
+# Recorded in a file: the read's output goes to /dev/null.
+defaults() { echo "DEFAULTS_DOMAIN: $1 $2" >> "$HOME/defaults-calls"; }
+bundle_has_installed_app() { return 1; }
+execute_optimization spotlight_orphan_rules_cleanup
+cat "$HOME/defaults-calls"
+EOF
+		[ "$status" -eq 0 ] || { echo "$output"; return 1; }
+		[[ "$output" == *"Removed 1 orphan"* ]] || { echo "$output"; return 1; }
+		[[ "$output" == *"DEFAULTS_DOMAIN: read com.apple.Spotlight"* ]] || { echo "$output"; return 1; }
+		if [[ "$keep" == none ]]; then
+			[[ "$output" == *"DEFAULTS_DOMAIN: delete com.apple.Spotlight"* ]] || { echo "$output"; return 1; }
+		else
+			[[ "$output" == *"DEFAULTS_DOMAIN: write com.apple.Spotlight"* ]] || { echo "$output"; return 1; }
+		fi
+		[[ "$output" != *"com.apple.spotlight"* ]] || { echo "$output"; return 1; }
+	done
+}
+
 @test "opt_spotlight_index_optimize reports optimal when probes are fast" {
 	run env HOME="$HOME" PROJECT_ROOT="$PROJECT_ROOT" /bin/bash --noprofile --norc <<'EOF'
 set -euo pipefail
```

#### Recent Merged Pull Requests:
- **PR #1968** (2026-11-10): fix(status): read Bluetooth connection state from the group headers (@viniciusdsandrade)
- **PR #1966** (2026-11-10): fix(clean): continue external cleanup when metadata file sizing fails (@viniciusdsandrade)
- **PR #1964** (2026-11-10): fix(status): read the memory pressure level from the kernel (@viniciusdsandrade)
- **PR #1958** (2026-11-09): fix(purge): protect artifacts with open files or active build processes (@baryon)
- **PR #1955** (2026-11-09): fix(purge): decompose packaged SwiftPM scratch dirs into build outputs (@baryon)
- **PR #1954** (closed): fix(purge): use default paths for empty or comment-only configuration (@viniciusdsandrade)

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

## X. clean): prove a LaunchAgent path missing by ENOENT, not by test -e

**RULE**:
When implementing operations in `lib/clean/apps.sh`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in tw93/Mole. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `77aa5a28`: clean): prove a LaunchAgent path missing by ENOENT, not by test -e. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Shell data structures, boundary deserialization, API parsing, or resource lifecycles matching `lib/clean/apps.sh`.

**VERIFIED IMPLEMENTATION PATTERN**:
```shell
// Verified production-grade fix pattern:
    # [[ -e ]] reads a denied lookup (a TCC or sandbox EPERM) as missing, so
    # absence is proven by the errno itself. BSD stat is in every macOS base
    # system (perl is a deprecated runtime) and reports through strerror, fixed
    # English under LC_ALL=C; only ENOENT counts. The timeout keeps a stale NFS
    # or autofs path from blocking the scan, and it runs before any builtin
    # test touches the path.
    local stat_error="" stat_rc=0
    stat_error=$(run_with_timeout "$MOLE_TIMEOUT_QUICK_DETECT_SEC" /usr/bin/env LC_ALL=C \
        /usr/bin/stat -f %N -- "$path" 2>&1 > /dev/null < /dev/null) || stat_rc=$?
    [[ $stat_rc -eq 1 && "$stat_error" == *": No such file or directory" ]] || return 1
            [[ -d "$parent" && -x "$parent" ]] || return 1
            # The nearest existing folder must really list, not only carry the
            # Unix search bit.
            run_with_timeout "$MOLE_TIMEOUT_QUICK_DETECT_SEC" /bin/ls -f -- "$parent" \
                > /dev/null 2>&1 < /dev/null
```

**NEGATIVE CONSTRAINT**:
```shell
// Anti-pattern to NEVER write (induced failure mode):
            [[ -d "$parent" && -x "$parent" ]]
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `77aa5a28` are properly handled with clean fallback behavior.


## 3. Decision Protocol & Boundary Restrictions
- Must NOT delete canonical verification records without authorization.
- Must execute independent read-back verification after every mutation.
