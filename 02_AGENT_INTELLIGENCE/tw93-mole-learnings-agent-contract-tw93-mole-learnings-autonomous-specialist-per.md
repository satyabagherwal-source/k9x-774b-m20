# Agent Contract: Agent Contract: tw93-mole-learnings Autonomous Specialist Persona

<!-- PROVENANCE_START
{
  "source_repository": "tw93-mole-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-19T10:16:29.028Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-tw93-mole-learnings",
  "canonical_classification": "agent_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [tw93-mole-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-19T10:16:29.028Z`  
> **Learning ID**: `LEARN-EVO-tw93-mole-learnings`


## 1. Agent Role & Persona Contract
- **Role Identifier**: `tw93-mole-learnings-specialist`
- **Governing Capability**: Autonomous execution and domain-specialized problem resolution.
- **Trust Boundary**: Reads and modifies only authorized workspace resources.

## 2. Operational Capabilities
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/tw93-mole-learnings.md`  
> **Source**: github ([https://github.com/tw93/Mole](https://github.com/tw93/Mole))  
> **Source Version**: `7966afdd`  
> **License**: GPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-19T10:15:43.833Z  
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
> **Harvest Timestamp**: 2026-11-19T10:15:43.828Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tw93/Mole`
- **Description**: 🐹 Open-source Mac and PC cleaner. Keep your machine clean, light, and running like new. Fast CLI, plus native Mac and Windows apps.
- **Primary Language / Ecosystem**: Shell
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 75569 stars

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
// v11: the overview leaves CloudStorage out of the User Library total.
// v12: traversal stops at mount points, so v11 totals can include mounted volumes.
// v13: the Home and old-Downloads overview totals stop at mount points too.
// v14: Home totals deduplicate hardlinks across immediate children.
const cacheSchemaVersion = 14

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
		if !entry.hiddenWhenEmpty() {
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
// accessors below build on it so t
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
	// File Provider domains (Dropbox, Google Drive, OneDrive, Proton Drive)
	// hold cloud-only folders too, and walking them asks the provider to
	// materialize each listing. Mole Mac turns materialization off for the
	// same walk (17143ac4c); the overview skips them like Mobile Documents.
	"CloudStorage": true,
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
	if isLibraryHeadFolder(cleanPath, "/Library") {
		return true
	}

	homeRoots := protectedAnalyzeHomeRoots()

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
	// Compare against the threshold the label rounds to, not the raw count:
	// 999,950 printed with one decimal in thousands is "1000.0k", which
	// should read as the next unit, the same way units.BytesSI steps up.
	if n < 999950 {
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
	rootDevice := scanDeviceOf(dir)

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
				// du -x on a mount point measures the mounted volume, which
				// is not part of Downloads.
				if rootDevice.isOtherDevice(filepath.Join(dir, entry.Name()), info) {
					continue
				}
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
- **Issue #2026** (2026-11-18): **[Mac App Bug] Clean screen reports $1 of Mac Storage message after run**
  *Symptoms*: ### Mole Mac app version  1.20.1  ### macOS version  27.3 Beta (26C5047e) (Also happened on released 27.2.1 build  ### Mac model  Mac mini M6  ### Affected area  Clean  ### What happened?  After running the Clean feature and completing the cleanup, Mole reports the success and the space/items freed, but also shows an odd "$1 of Mac storage" line that looks out of place?  ### Steps to reproduce  1. Open Mole 2. Select Clean and perform a scan 3. Select one or more items to clean 4. Wait for Clean to complete 5. Observe results screen  ### Expected behavior  Results page is displayed with size and quantity of cleaned items displayed correctly.  ### Screenshots or safe logs  <img width="1548" height="1000" alt="image" src="https://github.com/user-attachments/assets/8a530247-84d7-415c-8185-ca87d6b4d161" />  ### Before submitting  - [x] I updated to the latest stable Mole Mac app, reopened it, and reproduced this problem (or this report explains why I cannot update). - [x] I did not include license keys, order numbers, or private data.

- **Issue #2024** (2026-11-18): **[Mac App Bug]**
  *Symptoms*: ### Mole Mac app version  1.20.1 (376)  ### macOS version  27.2.1  ### Mac model  Mac16,8 (Apple M4 Pro)  ### Affected area  Status  ### What happened?  I'm raising this issue again as the previous case was closed. Within the Status tab, all of the cores show in the colour green but I understand there should be a difference in colour between the efficiency and performance cores. I have a MacBook Pro M4 Pro with 12 cores. Please can you look into this issue. Thanks   ### Steps to reproduce  Open Mole and go to the Status tab.  ### Expected behavior  I expect the CPU core types to be in different colours.  ### Screenshots or safe logs  <img width="529" height="360" alt="Mole CPU Cores" src="https://github.com/user-attachments/assets/8c6a672c-9cb7-4599-b4ea-d5dcb34c8176" />  ### Before submitting  - [x] I updated to the latest stable Mole Mac app, reopened it, and reproduced this problem (or this report explains why I cannot update). - [x] I did not include license keys, order numbers, or private data.

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

### Incident Patch 1: `4ae277c0` (2026-11-18)
**Commit Message**: docs(incidents): record I-79 to I-84 for the fixes since V1.72.0

Six defects reported against the published release were fixed without a
ledger row: the Alfred helper app plist (#2028), per-item sizing failures
cancelling clean (#1997), optimize task timeouts stopping the run (#2003),
the Clang cache resolver timeout (#2005), fish completion for the
completion subcommand (#2007) and analyze cursor navigation over hidden
rows (#1995). Causes are taken from each issue's own analysis.

Verified: scripts/audit_incidents.py (84 rows).

**File**: `docs/incidents.md` (modified, +6/-0)
```diff
@@ -113,3 +113,9 @@ when it was confirmed by reading the history, otherwise `unknown`.
 | I-76 | 2026-11-14 | `mo clean` never removed idleassetsd's aborted Aerial wallpaper downloads: the cleanup reused the 7-day temp-file age, but that directory is emptied at every restart, so the young partial files that fill the disk and drive a jetsam loop always passed (#1994) | 30ae9787 | 3b56a6fa | review | `safe_sudo_find_delete minute ages remove only files idle that long, at scan and recheck (#1994)` |
 | I-77 | 2026-11-15 | Analyze Home overview counted one file twice when hard links crossed immediate children or the Home root, because each child had an independent du and direct files were added separately | unknown | 3c4f01d8 | unit | `TestHomeOverviewDeduplicatesHardlinks`, `TestHomeOverviewPreservesPartialDuTotal`, `TestHomeOverviewDoesNotFollowTopLevelSymlinks` |
 | I-78 | 2026-11-17 | `mo uninstall` on Alfred 4 never offered `Application Support/Alfred`: discovery tried only the file name "Alfred 4", while the app writes under its CFBundleName "Alfred", and the family checks did not treat a trailing release number as the same product (#2027) | unknown | c7523ef1 | write-time | `find_app_files takes a numbered app's folders under its CFBundleName (#2027)`, `uninstall of a numbered app offers its CFBundleName data folder (#2027)`, `uninstall of a numbered app keeps the data folder a differently identified build still uses (#2027)` |
+| I-79 | 2026-11-17 | `mo uninstall` on Alfred 4 left `com.runningwithcrayons.Alfred-Preferences.plist` behind: embedded helper bundle ids were read only under `Contents/Library/LoginItems/`, and Alfred ships its settings app under `Contents/Preferences/` (#2027, #2028) | unknown | c47ea46e | write-time | `embedded bundle ids include a helper app under Contents/Preferences (#2027)` |
+| I-80 | 2026-11-14 | A per-item size probe that failed without a signal, in old browser and updater cleanup, device firmware, Tart caches and the Handoff pasteboard, returned its status and cancelled the whole `mo clean` run instead of only leaving that item unsized (#1997) | unknown | fa6bbea9 | review | `old browser and updater cleanup continues on non-signal size failure and stops on signal`, `clean_tart_caches tolerates non-signal size failures before and after prune` |
+| I-81 | 2026-11-14 | `mo optimize` stopped every later task when one task's sizing, scan or plist-read probe timed out, because cache refresh, saved state, launch agent and shared file list handlers passed status 124 up to the run (#2003) | unknown | 97f66d63 | review | `cache refresh sizing timeouts finish the run while removal timeouts and signals still cancel`, `saved state and shared file list scan timeouts fail only their task without a new message` |
+| I-82 | 2026-11-14 | A timed-out `getconf DARWIN_USER_CACHE_DIR` lookup in Clang module cache cleanup cancelled the rest of `mo clean` instead of skipping that one section (#2005) | unknown | 022bdf42 | review | `clean_clang_module_cache skips only Clang cleanup on resolver timeout and keeps a signal sticky` |
+| I-83 | 2026-11-14 | `mo completion fish` never offered bash, zsh or fish after `mo completion`: each generated rule carried two `-n` conditions, the second overwriting the first, and the helper read the root command instead of the subcommand (#2007) | unknown | bfcf20ae | unit | `completion fish completes shell names only under completion subcommand` |
+| I-84 | 2026-11-14 | `mo analyze` moved the cursor onto hidden empty rows and skipped over unavailable rows, because key navigation tested `Size == 0` instead of the renderer's hidden-when-empty rule (#1995) | unknown | 060fba8b | unit | `TestCursorNavigationSkipsHiddenEdgesAndStopsOnUnavailableRows`, `TestOverviewSelectionAvoidsHiddenRowsAndEnterIgnoresThem` |
```

---

### Incident Patch 2: `c7523ef1` (2026-11-18)
**Commit Message**: fix(uninstall): find a numbered app's data under its CFBundleName (#2027)

Alfred 4.app writes to Application Support/Alfred, the name in its own
Info.plist, but discovery only tried "Alfred 4", so that 45 MB folder was
never offered. find_app_files now drops a trailing release number when the
bundle's CFBundleName is exactly the shorter name and not a common word; a
file name alone still proves nothing. The helper-app plist half of #2027
landed in #2028.

Alfred 4 and 5 can be installed side by side and share that folder, so the
family checks now treat a trailing number like a channel suffix: the
find_app_files family filter and the batch sibling strip both read
"Alfred 5" as the same product and keep the shared folders. Both only
narrow what is removed.

Verified: the new find_app_files and batch cases fail on the old code and
on each guard removed in turn (CFBundleName check, common-name filter,
family suffix, batch strip); uninstall suites 437/437, full
MOLE_TEST_NO_AUTH=1 ./scripts/test.sh passed, check.sh --no-format exit 0.

Rollback: git revert this commit; no persisted state or cache changes.

**File**: `lib/core/app_protection.sh` (modified, +19/-2)
```diff
@@ -1296,9 +1296,11 @@ _mole_app_family_sibling_installed() {
     return 1
 }
 
-# The base name an app's family shares: "Zed Nightly" and "Zed" are both "Zed".
+# The base name an app's family shares: "Zed Nightly" and "Zed" are both "Zed",
+# and so are "Alfred 4" and "Alfred 5" (#2027). This list only narrows what an
+# uninstall takes, so a release number counts without bundle evidence.
 _mole_app_family_suffixes="Nightly|Beta|Alpha|Dev|Canary|Preview|Insider|Edge|Stable|Release|RC|LTS"
-_mole_app_family_suffixes+="|Developer Edition|Technology Preview"
+_mole_app_family_suffixes+="|Developer Edition|Technology Preview|[0-9]+"
 
 # Print the lowercase name leaves ("zed", "zed-nightly"...) of the family that
 # another installed build still uses, or nothing when no other build is
@@ -1368,6 +1370,21 @@ find_app_files() {
     if [[ "$app_name" =~ ^(.+)[[:space:]]+(${version_suffixes})$ ]]; then
         base_name="${BASH_REMATCH[1]}"
     fi
+    # "Alfred 4.app" writes to "Application Support/Alfred", its CFBundleName
+    # (#2027). A trailing release number is dropped only when the bundle itself
+    # names the shorter product; a file name alone proves nothing.
+    if [[ "$base_name" == "$app_name" && -n "$app_path" &&
+        "$app_name" =~ ^(.+)[[:space:]]+[0-9]+$ ]]; then
+        local numbered_base="${BASH_REMATCH[1]}" bundle_short_name=""
+        if [[ -f "$app_path/Contents/Info.plist" ]]; then
+            bundle_short_name=$(/usr/bin/plutil -extract CFBundleName raw \
+                "$app_path/Contents/Info.plist" 2> /dev/null) || bundle_short_name=""
+        fi
+        if [[ "$bundle_short_name" == "$numbered_base" ]] &&
+            ! _mole_uninstall_is_common_app_name "$numbered_base"; then
+            base_name="$numbered_base"
+        fi
+    fi
     local base_lowercase=$(echo "$base_name" | /usr/bin/tr '[:upper:]' '[:lower:]') # "Zed" -> "zed"
 
     # Only use bundle_id in literal paths or find patterns after reverse-DNS
```

**File**: `lib/uninstall/batch.sh` (modified, +4/-1)
```diff
@@ -1868,7 +1868,10 @@ _uninstall_strip_version_suffix_into() {
     local _strip_value="$2"
     local version_suffixes="Nightly|Beta|Alpha|Dev|Canary|Preview|Insider|Edge|Stable|Release|RC|LTS"
     version_suffixes+="|Developer Edition|Technology Preview"
-    if [[ "$_strip_value" =~ ^(.+)[[:space:]]+(${version_suffixes})$ ]]; then
+    # A trailing release number too ("Alfred 4" is "Alfred", #2027). Broader
+    # than find_app_files, which also wants CFBundleName to agree, because here
+    # a wider match only keeps more of a survivor's data.
+    if [[ "$_strip_value" =~ ^(.+)[[:space:]]+(${version_suffixes}|[0-9]+)$ ]]; then
         _strip_value="${BASH_REMATCH[1]}"
     fi
     printf -v "$1" '%s' "$_strip_value"
```

**File**: `tests/uninstall.bats` (modified, +65/-0)
```diff
@@ -872,6 +872,71 @@ fi
 EOF
 }
 
+# Alfred 4.app writes to Application Support/Alfred, its CFBundleName (#2027).
+run_numbered_app_batch() {
+    local survivor="$1"
+    local fixture_home
+    fixture_home=$(mktemp -d "$HOME/numbered-fixture.XXXXXX")
+    local plist='<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict><key>CFBundleIdentifier</key><string>%s</string><key>CFBundleName</key><string>Alfred</string></dict></plist>'
+    mkdir -p "$fixture_home/Applications/Alfred 4.app/Contents" \
+        "$fixture_home/Library/Application Support/Alfred"
+    # shellcheck disable=SC2059 # The fixture plist is the format string.
+    printf "$plist" com.runningwithcrayons.Alfred > "$fixture_home/Applications/Alfred 4.app/Contents/Info.plist"
+    touch "$fixture_home/Library/Application Support/Alfred/prefs.plist"
+    if [[ "$survivor" == yes ]]; then
+        # Another root and another bundle id, so only the batch family check sees it.
+        mkdir -p "$fixture_home/OtherApps/Alfred 5.app/Contents"
+        # shellcheck disable=SC2059 # The fixture plist is the format string.
+        printf "$plist" com.runningwithcrayons.Alfred5 > "$fixture_home/OtherApps/Alfred 5.app/Contents/Info.plist"
+    fi
+
+    run env HOME="$fixture_home" PROJECT_ROOT="$PROJECT_ROOT" \
+        /bin/bash --noprofile --norc << 'EOF'
+set -euo pipefail
+source "$PROJECT_ROOT/lib/core/common.sh"
+source "$PROJECT_ROOT/lib/uninstall/batch.sh"
+source "$PROJECT_ROOT/tests/helpers/uninstall.bash"
+mole_test_isolate_uninstall_inventory
+_MOLE_UNINSTALL_LIVE_APP_ROOTS+=("$HOME/OtherApps")
+brew() { :; }
+export MOLE_DELETE_MODE=trash
+export MOLE_TEST_TRASH_DIR="$HOME/test-trash" MOLE_TEST_NO_AUTH=1
+request_sudo_access() { return 0; }
+start_inline_spinner() { :; }
+stop_inline_spinner() { :; }
+enter_alt_screen() { :; }
+leave_alt_screen() { :; }
+hide_cursor() { :; }
+show_cursor() { :; }
+remove_apps_from_dock() { :; }
+drain_pending_input() { :; }
+pgrep() { return 1; }
+pkill() { return 0; }
+sudo() { return 0; }
+
+selected_apps=("0|$HOME/Applications/Alfred 4.app|Alfred 4|com.runningwithcrayons.Alfred|0|Never")
+files_cleaned=0
+total_items=0
+total_size_cleaned=0
+MOLE_UNINSTALL_WITH_DATA=1
+printf '\n' | MOLE_TEST_MODE=1 batch_uninstall_applications
+[[ ! -d "$HOME/Applications/Alfred 4.app" ]] || { echo "app kept"; exit 1; }
+if [[ -e "$HOME/Library/Application Support/Alfred" ]]; then echo "ALFRED_DATA=kept"; else echo "ALFRED_DATA=removed"; fi
+EOF
+}
+
+@test "uninstall of a numbered app offers its CFBundleName data folder (#2027)" {
+    run_numbered_app_batch no
+    [ "$status" -eq 0 ] || { printf 'exit status: %s\n%s\n' "$status" "$output"; return 1; }
+    [[ "$output" == *"ALFRED_DATA=removed"* ]] || { printf '%s\n' "$output"; return 1; }
+}
+
+@test "uninstall of a numbered app keeps the data folder a differently identified build still uses (#2027)" {
+    run_numbered_app_batch yes
+    [ "$status" -eq 0 ] || { printf 'exit status: %s\n%s\n' "$status" "$output"; return 1; }
+    [[ "$output" == *"ALFRED_DATA=kept"* ]] || { printf '%s\n' "$output"; return 1; }
+}
+
 @test "uninstall --with-data preselects personal data and Enter removes it" {
     run_with_data_batch enter
     [ "$status" -eq 0 ] || {
```

**File**: `tests/uninstall_naming_variants.bats` (modified, +46/-0)
```diff
@@ -605,6 +605,52 @@ EOF
     [[ "$result" == *".config/zed"* ]]
 }
 
+_naming_write_bundle_name() {
+    mkdir -p "$1/Contents"
+    printf '<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0"><dict><key>CFBundleName</key><string>%s</string></dict></plist>\n' "$2" > "$1/Contents/Info.plist"
+}
+
+@test "find_app_files takes a numbered app's folders under its CFBundleName (#2027)" {
+    local app="$HOME/apps/Alfred 4.app"
+    _naming_write_bundle_name "$app" "Alfred"
+    mkdir -p "$HOME/Library/Application Support/Alfred"
+
+    result=$(MOLE_TEST_MODE=1 MOLE_TEST_APP_FAMILY_ROOT="$HOME/apps" find_app_files com.runningwithcrayons.Alfred "Alfred 4" "$app")
+    [[ "$result" == *"/Application Support/Alfred"* ]]
+}
+
+@test "find_app_files keeps a numbered app's short-name folder without CFBundleName agreeing (#2027)" {
+    local app="$HOME/apps/Studio 3.app"
+    mkdir -p "$HOME/Library/Application Support/Studio"
+
+    _naming_write_bundle_name "$app" "Studio 3"
+    result=$(MOLE_TEST_MODE=1 MOLE_TEST_APP_FAMILY_ROOT="$HOME/apps" find_app_files com.example.studio3 "Studio 3" "$app")
+    [[ "$result" != *"/Application Support/Studio"* ]] || return 1
+
+    rm -f "$app/Contents/Info.plist"
+    result=$(MOLE_TEST_MODE=1 MOLE_TEST_APP_FAMILY_ROOT="$HOME/apps" find_app_files com.example.studio3 "Studio 3" "$app")
+    [[ "$result" != *"/Application Support/Studio"* ]]
+}
+
+@test "find_app_files never derives a common word from a numbered app's CFBundleName (#2027)" {
+    local app="$HOME/apps/Helper 2.app"
+    _naming_write_bundle_name "$app" "Helper"
+    mkdir -p "$HOME/Library/Application Support/Helper"
+
+    result=$(MOLE_TEST_MODE=1 MOLE_TEST_APP_FAMILY_ROOT="$HOME/apps" find_app_files com.example.helper2 "Helper 2" "$app")
+    [[ "$result" != *"/Application Support/Helper"* ]]
+}
+
+@test "find_app_files leaves Alfred's folder to Alfred 5 while it is installed (#2027)" {
+    local app="$HOME/apps/Alfred 4.app"
+    _naming_write_bundle_name "$app" "Alfred"
+    _naming_write_bundle_name "$HOME/apps/Alfred 5.app" "Alfred"
+    mkdir -p "$HOME/Library/Application Support/Alfred"
+
+    result=$(MOLE_TEST_MODE=1 MOLE_TEST_APP_FAMILY_ROOT="$HOME/apps" find_app_files com.runningwithcrayons.Alfred4 "Alfred 4" "$app")
+    [[ "$result" != *"/Application Support/Alfred"* ]]
+}
+
 @test "find_shared_app_paths reaches a localized short name's folder through the bundle product token" {
     local shared="$HOME/Shared"
     mkdir -p "$shared/UURemote" "$shared/UURemote Data" "$shared/UUPlayer" "$shared/Other"
```

**File**: `tests/uninstall_safety.bats` (modified, +2/-0)
```diff
@@ -1458,6 +1458,7 @@ verdict same_id_any_case com.Foo.Bar COM.FOO.BAR /A/Foo.app /A/Other.app
 verdict channel_name_any_case com.a.x com.b.y "/A/Zed Nightly.app" /A/ZED.app
 verdict suffix_strip_is_case_sensitive com.a.x com.b.y "/A/Zed nightly.app" /A/Zed.app
 verdict unrelated com.a.x com.b.y /A/Alpha.app /A/Beta.app
+verdict release_number_name com.a.x com.b.y "/A/Alfred 4.app" "/A/Alfred 5.app"
 verdict one_letter_names com.a.x com.b.y /A/X.app /A/x.app
 rc=0
 uninstall_live_bundle_has_other_install com.example.selected "$selected" || rc=$?
@@ -1481,6 +1482,7 @@ EOF
     [[ "$output" == *"channel_name_any_case=shared"* ]] || { echo "$output"; return 1; }
     [[ "$output" == *"suffix_strip_is_case_sensitive=open"* ]] || { echo "$output"; return 1; }
     [[ "$output" == *"unrelated=open"* && "$output" == *"one_letter_names=open"* ]] || { echo "$output"; return 1; }
+    [[ "$output" == *"release_number_name=shared"* ]] || { echo "$output"; return 1; }
     [[ "$output" == *"scan_rc=1"* && "$output" == *"rows_rc=1"* && "$output" == *"names=[]"* ]] || { echo "$output"; return 1; }
     [[ "$output" == *"scan_with_sibling_rc=0"* ]] || { echo "$output"; return 1; }
     [[ "$output" == *"tr_execs=0"* ]] || { echo "$output"; return 1; }
```

---

### Incident Patch 3: `1041c3ae` (2026-11-19)
**Commit Message**: fix(clean): skip dataless project artifact directories (#2035)

The Project artifacts hint in mo clean checked paths inside every child of
a configured purge root. When a child was an online-only iCloud package,
that stat() waited on the File Provider and the scan deadline could not
interrupt it (#2034). Prune dataless directories with BSD find before
looking inside them at the root, project, nested and artifact levels, and
keep the previous scan when find does not know the flag.

Fixes #2034.

**File**: `docs/incidents.md` (modified, +1/-0)
```diff
@@ -120,3 +120,4 @@ when it was confirmed by reading the history, otherwise `unknown`.
 | I-83 | 2026-11-14 | `mo completion fish` never offered bash, zsh or fish after `mo completion`: each generated rule carried two `-n` conditions, the second overwriting the first, and the helper read the root command instead of the subcommand (#2007) | unknown | bfcf20ae | unit | `completion fish completes shell names only under completion subcommand` |
 | I-84 | 2026-11-14 | `mo analyze` moved the cursor onto hidden empty rows and skipped over unavailable rows, because key navigation tested `Size == 0` instead of the renderer's hidden-when-empty rule (#1995) | unknown | 060fba8b | unit | `TestCursorNavigationSkipsHiddenEdgesAndStopsOnUnavailableRows`, `TestOverviewSelectionAvoidsHiddenRowsAndEnterIgnoresThem` |
 | I-85 | 2026-11-19 | `mo analyze` wrote a deletion that rounds to a full unit as `1000KB` or `1000.0MB` in operations.log and the `mo history` session line, while deletions.log showed `1.0MB` for the same file, because the Go size formatter never picked up the shell formatter's step-up (#2036) | unknown | c4a99749 | write-time | `TestLogSizeTextMatchesShellBytesToHuman` |
+| I-86 | 2026-11-19 | `mo clean` stalled at Project artifacts when a synchronous child lookup entered a dataless iCloud project folder (#2034) | unknown | 3d4f767f | unit | `project artifact hints skip dataless directories at every depth (#2034)` |
```

**File**: `lib/clean/hints.sh` (modified, +81/-54)
```diff
@@ -7,26 +7,6 @@ mole_hints_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
 # shellcheck disable=SC1090
 source "$mole_hints_dir/purge_shared.sh"
 
-# Quick reminder probe for project build artifacts handled by `mo purge`.
-# Designed to be very fast: shallow directory checks only, no deep find scans.
-# shellcheck disable=SC2329
-load_quick_purge_hint_paths() {
-    local config_file="$HOME/.config/mole/purge_paths"
-    local -a paths=()
-
-    while IFS= read -r line; do
-        [[ -n "$line" ]] && paths+=("$line")
-    done < <(mole_purge_read_paths_config "$config_file" 2> /dev/null)
-
-    if [[ ${#paths[@]} -eq 0 ]]; then
-        paths=("${MOLE_PURGE_DEFAULT_SEARCH_PATHS[@]}")
-    fi
-
-    if [[ ${#paths[@]} -gt 0 ]]; then
-        printf '%s\n' "${paths[@]}"
-    fi
-}
-
 # shellcheck disable=SC2329
 hint_get_path_size_kb_with_timeout() {
     local path="$1"
@@ -54,19 +34,38 @@ hint_get_path_size_kb_with_timeout() {
     printf '%s\n' "$size_kb"
 }
 
+# shellcheck disable=SC2329
+hint_find_local_dirs() {
+    local timeout_seconds="$1" skip_dataless="$2" print_arg="$3"
+    shift 3
+
+    local -a prune=()
+    if [[ "$skip_dataless" == true ]]; then
+        prune=(-type d -flags +dataless -prune -o)
+    fi
+    run_with_timeout "$timeout_seconds" "$FIND_BSD" "$@" ${prune[@]+"${prune[@]}"} \
+        -type d "$print_arg" < /dev/null 2> /dev/null
+}
+
+# Follow a configured root or artifact symlink just as [[ -d ]] does.
+# shellcheck disable=SC2329
+hint_is_local_dir() {
+    local path="$1" timeout_seconds="$2" skip_dataless="$3"
+    local found
+    found=$(hint_find_local_dirs "$timeout_seconds" "$skip_dataless" -print -H -f "$path" -- -maxdepth 0) || return $?
+    [[ -n "$found" ]]
+}
+
 # shellcheck disable=SC2329
 hint_collect_child_dirs_with_timeout() {
     local parent="$1"
     local output_file="$2"
     local timeout_seconds="${3:-1}"
+    local skip_dataless="${4:-false}"
 
-    [[ -d "$parent" ]] || return 1
-    : > "$output_file" || return 1
-
-    # 1s: shallow directory listing should be near-instant on healthy local
-    # paths. Slow/cloud-backed roots are skipped so `mo clean` never appears
-    # stuck while rendering this non-destructive hint.
-    run_with_timeout "$timeout_seconds" "$FIND_BSD" "$parent" -mindepth 1 -maxdepth 1 -type d -print0 > "$output_file" 2> /dev/null
+    # Keep online-only children out of the list before the caller checks paths
+    # inside them. Skip a listing that stalls on a cloud or network root.
+    hint_find_local_dirs "$timeout_seconds" "$skip_dataless" -print0 "$parent" -mindepth 1 -maxdepth 1 > "$output_file"
 }
 
 # shellcheck disable=SC2329
@@ -187,10 +186,34 @@ record_project_artifact_hint() {
 }
 
 # shellcheck disable=SC2329
-is_quick_purge_project_root() {
-    mole_purge_is_project_root "$1"
+hint_record_project_dir_artifacts() {
+    local directory="$1" skip_dataless="$2" scan_deadline="$3"
+    shift 3
+    local target_name candidate probe_rc
+
+    for target_name in "$@"; do
+        if [[ $SECONDS -ge $scan_deadline ]]; then
+            PROJECT_ARTIFACT_HINT_TRUNCATED=true
+            PROJECT_ARTIFACT_HINT_SCAN_SKIPPED=true
+            break
+        fi
+        candidate="$directory/$target_name"
+        [[ -d "$candidate" ]] || continue
+        if [[ "$skip_dataless" == true ]]; then
+            # du would enter a dataless artifact even if its parent is local.
+            probe_rc=0
+            hint_is_local_dir "$candidate" 1 true || probe_rc=$?
+            if mole_rc_timeout "$probe_rc"; then
+                PROJECT_ARTIFACT_HINT_TRUNCATED=true
+                PROJECT_ARTIFACT_HINT_SCAN_SKIPPED=true
+            fi
+            [[ $probe_rc -eq 0 ]] || continue
+        fi
+        record_project_artifact_hint "$candidate"
+    done
 }
 
+# Shallow, read-only reminder for build artifacts handled by `mo purge`.
 # shellcheck disable=SC2329
 probe_project_artifact_hints() {
     PROJECT_ARTIFACT_HINT_DETECTED=false
@@ -222,11 +245,21 @@ probe_project_artifact_hints() {
     done < <(mole_purge_quick_hint_target_names)
 
     local -a scan_roots=()
+    local configured_roots=true
     while IFS= read -r path; do
         [[ -n "$path" ]] && scan_roots+=("$path")
-    done < <(load_quick_purge_hint_paths)
+    done < <(mole_purge_read_paths_config "$HOME/.config/mole/purge_paths" literal 2> /dev/null)
+    if [[ ${#scan_roots[@]} -eq 0 ]]; then
+        scan_roots=("${MOLE_PURGE_DEFAULT_SEARCH_PATHS[@]}")
+        configured_roots=false
+    fi
 
-    [[ ${#scan_roots[@]} -eq 0 ]] && return 0
+    # As in purge, keep scanning on macOS versions whose find lacks dataless.
+    local skip_dataless=false
+    if [[ $SECONDS -lt $scan_deadline ]] &&
+        run_with_timeout "$list_timeout_seconds" "$FIND_BSD" / -maxdepth 0 -flags +dataless < /dev/null > /dev/null 2>&1; then
+        skip_dataless=true
+    fi
 
     # Fairness: avoid one very large root exhausting the entire scan budget.
     if [[ $max_pr
```

**File**: `lib/clean/purge_shared.sh` (modified, +5/-1)
```diff
@@ -348,6 +348,7 @@ mole_purge_resolve_path_case() {
 
 mole_purge_read_paths_config() {
     local config_file="${1:-$HOME/.config/mole/purge_paths}"
+    local path_mode="${2:-resolved}"
     [[ -f "$config_file" ]] || return 0
 
     local line
@@ -356,7 +357,10 @@ mole_purge_read_paths_config() {
         line="${line%"${line##*[![:space:]]}"}"
         [[ -z "$line" || "$line" =~ ^# ]] && continue
         line="${line/#\~/$HOME}"
-        line=$(mole_purge_resolve_path_case "$line")
+        # The read-only hint checks the dataless flag before entering a root.
+        if [[ "$path_mode" != literal ]]; then
+            line=$(mole_purge_resolve_path_case "$line")
+        fi
         printf '%s\n' "$line"
     done < "$config_file"
 }
```

**File**: `tests/clean_hints.bats` (modified, +51/-0)
```diff
@@ -48,6 +48,57 @@ EOT1
     [[ "$output" != *"/bin"* ]]
 }
 
+@test "project artifact hints skip dataless directories at every depth (#2034)" {
+    local root="$HOME/Documents"
+    local offline_root="$HOME/OnlineOnly"
+    mkdir -p "$offline_root/target" "$root/OnlineOnly/target" \
+        "$root/workspace/OnlineOnly/target" "$root/workspace/Local Project/node_modules" \
+        "$root/workspace/build" "$root/workspace/dist"
+    touch "$offline_root/package.json" "$root/workspace/package.json"
+    ln -s "$root" "$HOME/Documents alias"
+    printf '%s\n' "$offline_root" "$HOME/Documents alias" > "$HOME/.config/mole/purge_paths"
+
+    run env HOME="$HOME" PROJECT_ROOT="$PROJECT_ROOT" /bin/bash --noprofile --norc << 'EOF'
+set -euo pipefail
+source "$PROJECT_ROOT/lib/core/common.sh"
+source "$PROJECT_ROOT/lib/clean/hints.sh"
+FIND_BSD=find
+run_with_timeout() { shift; "$@"; }
+cd() {
+    if [[ "$1" == "$HOME/OnlineOnly" ]]; then
+        : > "$HOME/entered-placeholder"
+    fi
+    builtin cd "$@"
+}
+# Use BSD find's actual expression and traversal. Ordinary fixtures cannot
+# carry the File Provider flag, so give the flag predicate fixture matches.
+find() {
+    local -a args=()
+    while [[ $# -gt 0 ]]; do
+        if [[ "$1" == "-flags" && "$2" == "+dataless" ]]; then
+            args+=(\( -name OnlineOnly -o -path "$HOME/Documents/workspace/build" \))
+            shift 2
+        else
+            args+=("$1")
+            shift
+        fi
+    done
+    /usr/bin/find "${args[@]}"
+}
+probe_project_artifact_hints
+printf 'count=%s\n' "$PROJECT_ARTIFACT_HINT_COUNT"
+printf 'skipped=%s\n' "$PROJECT_ARTIFACT_HINT_SCAN_SKIPPED"
+printf 'example=%s\n' "${PROJECT_ARTIFACT_HINT_EXAMPLES[@]}"
+EOF
+
+    [ "$status" -eq 0 ] || { echo "$output"; return 1; }
+    [[ "$output" == *"count=2"$'\n'* ]] || { echo "$output"; return 1; }
+    [ ! -e "$HOME/entered-placeholder" ]
+    [[ "$output" == *"skipped=false"* ]] || return 1
+    [[ "$output" == *"example=~/Documents/workspace/dist"* ]] || return 1
+    [[ "$output" == *"example=~/Documents/workspace/Local Project/node_modules"* ]]
+}
+
 @test "show_project_artifact_hint_notice renders sampled summary" {
     run env HOME="$HOME" PROJECT_ROOT="$PROJECT_ROOT" /bin/bash --noprofile --norc << 'EOT2'
 set -euo pipefail
```

**File**: `tests/purge_config_paths.bats` (modified, +1/-1)
```diff
@@ -224,7 +224,7 @@ EOF
     run env HOME="$HOME" MOLE_TEST_MODE=1 MOLE_TEST_NO_AUTH=1 /bin/bash --noprofile --norc -c "
         source '$PROJECT_ROOT/bin/clean.sh'
         discover_project_cache_roots > /dev/null
-        load_quick_purge_hint_paths > /dev/null
+        probe_project_artifact_hints > /dev/null
         echo finished
     "
 
```

#### Recent Merged Pull Requests:
- **PR #2038** (2026-11-19): test(purge): send TERM after activity probes start (@r266-tech)
- **PR #2037** (2026-11-19): docs(readme): add Brazilian Portuguese translation (@goul4rt)
- **PR #2036** (2026-11-19): fix(analyze): step up the logged size when it rounds to 1000KB or 1000.0MB (@Dev-next-gen)
- **PR #2035** (2026-11-19): fix(clean): skip dataless project artifact directories (@r266-tech)
- **PR #2033** (2026-11-19): perf(core): attach tree walk snapshots without Add-Member (@b84330808)
- **PR #2032** (2026-11-19): feat(clean): clean Postman partition HTTP and code caches (@valentynapolienova)

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

## X. docs(incidents): record I-79 to I-84 for the fixes since V1.72.0

**RULE**:
When implementing operations in `docs/incidents.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in tw93/Mole. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `4ae277c0`: docs(incidents): record I-79 to I-84 for the fixes since V1.72.0. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Shell data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/incidents.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```shell
// Verified production-grade fix pattern:
| I-79 | 2026-11-17 | `mo uninstall` on Alfred 4 left `com.runningwithcrayons.Alfred-Preferences.plist` behind: embedded helper bundle ids were read only under `Contents/Library/LoginItems/`, and Alfred ships its settings app under `Contents/Preferences/` (#2027, #2028) | unknown | c47ea46e | write-time | `embedded bundle ids include a helper app under Contents/Preferences (#2027)` |
| I-80 | 2026-11-14 | A per-item size probe that failed without a signal, in old browser and updater cleanup, device firmware, Tart caches and the Handoff pasteboard, returned its status and cancelled the whole `mo clean` run instead of only leaving that item unsized (#1997) | unknown | fa6bbea9 | review | `old browser and updater cleanup continues on non-signal size failure and stops on signal`, `clean_tart_caches tolerates non-signal size failures before and after prune` |
| I-81 | 2026-11-14 | `mo optimize` stopped every later task when one task's sizing, scan or plist-read probe timed out, because cache refresh, saved state, launch agent and shared file list handlers passed status 124 up to the run (#2003) | unknown | 97f66d63 | review | `cache refresh sizing timeouts finish the run while removal t
```

**NEGATIVE CONSTRAINT**:
```shell
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `4ae277c0` are properly handled with clean fallback behavior.


## 3. Decision Protocol & Boundary Restrictions
- Must NOT delete canonical verification records without authorization.
- Must execute independent read-back verification after every mutation.
