# Verification Protocol: Verification Protocol: Empirical Defect Shield for tw93-mole-learnings

<!-- PROVENANCE_START
{
  "source_repository": "tw93-mole-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-22T11:48:02.765Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-tw93-mole-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [tw93-mole-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-22T11:48:02.765Z`  
> **Learning ID**: `LEARN-EVO-tw93-mole-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `tw93-mole-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/tw93-mole-learnings.md`  
> **Source**: github ([https://github.com/tw93/Mole](https://github.com/tw93/Mole))  
> **Source Version**: `d3b743e0`  
> **License**: GPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-22T11:47:49.545Z  
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
> **Harvest Timestamp**: 2026-11-22T11:47:49.539Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tw93/Mole`
- **Description**: 🐹 Open-source Mac and PC cleaner. Keep your machine clean, light, and running like new. Fast CLI, plus native Mac and Windows apps.
- **Primary Language / Ecosystem**: Shell
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 75830 stars

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
	if isSessionSocketFolderPath(cleanPath) || isTempSocketPath(cleanPath) {
		return true
	}
	if isLibraryHeadF
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
- **Issue #2039** (2026-11-20): **[BUG] `mo clean --dry-run` silently omits Xcode/Simulator cleanup that the real run then performs (~48GB)**
  *Symptoms*: ## Before submitting  - [x] This report explains why I cannot reproduce on the same data: I ran it from a source checkout of current `main` (1.73.0, commit `7966afdd`), and the real run already removed the affected items, so the same preview can't be repeated on this Mac.  ## Describe the bug  `mo clean --dry-run` showed no Xcode DerivedData, iOS DeviceSupport, Simulator device data, Interface Builder cache or Xcode build products rows. `clean-list.txt` from that preview had zero paths under `Xcode/DerivedData`, `iOS DeviceSupport` or `IB Support`. DerivedData appeared only as a `⊙` review row under Large files, which reads as "not removed".  I approved the cleanup from that preview. About two minutes later, `mo clean` removed all of the following, none of which the preview listed:  | Row in real run | Size | |---|---| | Xcode DerivedData · 45 projects | 29.71GB | | iOS DeviceSupport · removed 2 old versions | 13.83GB | | Simulator device data · 30 items | 4.25GB | | Xcode Interface Builder cache | 394.9MB | | Clang module cache | 61.1MB | | Xcode build products · 51 items | 893KB |  Everything removed is rebuildable, and nothing ran while Xcode was active, so this is not an unsafe-deletion report. The problem is that the preview showed less than the real run then removed, with no notice, so the preview could not be trusted as the full list of what would be deleted.  **Likely cause (from reading the source; not confirmed with `--debug`):** each of these steps is gated on `xco

- **Issue #2026** (2026-11-18): **[Mac App Bug] Clean screen reports $1 of Mac Storage message after run**
  *Symptoms*: ### Mole Mac app version  1.20.1  ### macOS version  27.3 Beta (26C5047e) (Also happened on released 27.2.1 build  ### Mac model  Mac mini M6  ### Affected area  Clean  ### What happened?  After running the Clean feature and completing the cleanup, Mole reports the success and the space/items freed, but also shows an odd "$1 of Mac storage" line that looks out of place?  ### Steps to reproduce  1. Open Mole 2. Select Clean and perform a scan 3. Select one or more items to clean 4. Wait for Clean to complete 5. Observe results screen  ### Expected behavior  Results page is displayed with size and quantity of cleaned items displayed correctly.  ### Screenshots or safe logs  <img width="1548" height="1000" alt="image" src="https://github.com/user-attachments/assets/8a530247-84d7-415c-8185-ca87d6b4d161" />  ### Before submitting  - [x] I updated to the latest stable Mole Mac app, reopened it, and reproduced this problem (or this report explains why I cannot update). - [x] I did not include license keys, order numbers, or private data.

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

### Incident Patch 1: `5d795f30` (2026-11-22)
**Commit Message**: fix(clean): keep sudo sinks' preview rows out of the ownership refusal

72e63f39 put the user-level ownership refusal into
record_dry_run_cleanup_target, but safe_sudo_remove, safe_sudo_find_delete
and other sudo sinks preview through that same recorder and remove
root-owned items themselves. A dry run therefore dropped their rows (any
root-owned entry under the sticky /Library/Caches, /private/var/log,
DiagnosticReports) while the real run still removed them: the preview
showed less than the run. Found by an independent safety review before
anything was pushed.

The refusal now sits only where the run's sink is safe_remove: safe_remove
itself (unchanged) and the two preview record calls in _safe_clean_impl.
Also covers the in-loop SingletonLock recheck of eb86d3d3 with a browser
that starts from the delete guard, which no test reached before.

Verified: record_dry_run_cleanup_target still records a root-owned item for
a sudo sink is red on the previous clean.sh; the safe_clean ownership case
is still red with the _safe_clean_impl half disabled; the Service Worker
case is red with the in-loop recheck removed; clean_core, clean_system_caches,
core_safe_functions, file_ops_mole_delet

**File**: `.claude/rules/core.md` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ paths:
 ## `lib/core/file_ops.sh` and `lib/core/base.sh`
 
 - `lib/core/file_ops.sh` owns the deletion funnel, Trash/permanent routing, operation-log outcomes, size accounting, and last-mile path validation. `lib/core/base.sh` owns shared shell primitives and source-order-sensitive section helpers. Keep policy in the existing protection helpers rather than adding a second delete path. Run `MOLE_TEST_NO_AUTH=1 bats tests/file_ops_mole_delete.bats tests/file_ops_size.bats tests/file_ops_safe_remove_symlink.bats tests/user_file_ops.bats tests/core_safe_functions.bats tests/history.bats`.
-- `safe_remove` is a plain `rm` as the invoking user, so `_mole_user_sink_refuses_on_ownership` refuses an item another user owns that this user cannot unlink (folder not writable or sticky, or a folder item not writable), logging `SKIPPED ... (owned by another user)` instead of a `FAILED` row on every clean, and `record_dry_run_cleanup_target` asks the same function so the preview never lists it (Mole Mac I-314, `CacheScanner.userSinkRefusesOnOwnership`). Links and runs as root are never refused here. Locked by `safe_clean neither lists nor removes an item another user owns that this user cannot unlink` in `tests/clean_core.bats`, red with either half removed.
+- `safe_remove` is a plain `rm` as the invoking user, so `_mole_user_sink_refuses_on_ownership` refuses an item another user owns that this user cannot unlink (folder not writable or sticky, or a folder item not writable), logging `SKIPPED ... (owned by another user)` instead of a `FAILED` row on every clean, and `_safe_clean_impl` asks the same function before recording its preview, so the preview never lists it (Mole Mac I-314, `CacheScanner.userSinkRefusesOnOwnership`). Links and runs as root are never refused here. Never put this check in `record_dry_run_cleanup_target`: `safe_sudo_remove`, `safe_sudo_find_delete` and other sudo sinks preview through it and remove root-owned items themselves, so their rows would vanish from the dry run. Locked by `safe_clean neither lists nor removes an item another user owns that this user cannot unlink` (red with either half removed) and `record_dry_run_cleanup_target still records a root-owned item for a sudo sink` in `tests/clean_core.bats`.
 - Both find/delete helpers preserve signal statuses in the clean cancellation marker, including scan, sizing, preview and privileged preflight failures; a prior cancellation stops them before further work. Read-only scan or sizing timeouts stay local and never set that marker. A signal from `validate_path_for_deletion` must stop the privileged scan loop and discard its accumulated removal batch, not become an ordinary refusal via `if ! ...; then continue`; a validator timeout still skips only its target. Locked by the `preserves scan signals`, `preserves dry-run sizing signals`, `read-only timeouts remain local`, `preserves preview validation signals`, `stops before work after sticky cancellation`, `stops accumulated batches on validation signals` and `validation timeout skips only its target` cases in `tests/core_safe_functions.bats`.
 - `validate_path_for_deletion` refuses every path when `should_protect_path` is not defined (a caller that sourced `file_ops.sh` without `app_protection.sh`), logging `protection rules not loaded`; it never skips the protection check. Every product entrypoint loads both through `common.sh`. Locked by `validate_path_for_deletion refuses every path when protection rules are not loaded` and `safe_find_delete keeps files when app protection is not loaded` in `tests/core_safe_functions.bats`.
 - **A stored timestamp from the future is expired, not fresh.** A freshness or throttle window (`now - stamp < ttl`, `find -mmin -N`) accepts a negative age, so after a clock correction a cache or a daily stamp stays valid until the clock catches up and the work it gates is skipped. Cache and throttle checks treat a negative age as expired; an age check that decides whether to delete or list an old item keeps a future-dated one, the safe direction. Locked by `brew_cleanup_ran_recently treats a stamp from the future as expired` in `tests/clean_system_maintenance.bats`, `Darwin temp root prune lists again when its stamp is from the future` in `tests/user_file_ops.bats`, `cached app metadata stamped in the future is refreshed, a recent stamp is not` and `a receipt cache stamped in the future is rebuilt, a recent one answers` in `tests/uninstall_scan_bash32.bats`, and `TestStampWithinTreatsFutureStampAsExpired` in `cmd/analyze/cache_clock_test.go`.
```

**File**: `bin/clean.sh` (modified, +17/-10)
```diff
@@ -241,12 +241,6 @@ record_dry_run_cleanup_target() {
     if [[ "${MOLE_CURRENT_COMMAND:-}" == "clean" ]] && mole_rc_timeout_or_signal "$pending_clean_cancel"; then
         return "$pending_clean_cancel"
     fi
-    # The real sink refuses an item another user owns that this user cannot
-    # unlink, so the preview does not list it either (safe_remove).
-    if declare -f _mole_user_sink_refuses_on_ownership > /dev/null 2>&1 &&
-        _mole_user_sink_refuses_on_ownership "$path"; then
-        return 1
-    fi
     if [[ "${_MOLE_DRY_RUN_TARGET_PREVALIDATED:-false}" != "true" ]]; then
         if declare -f should_protect_path > /dev/null 2>&1 && should_protect_path "$path" 2> /dev/null; then
             return 1
@@ -1349,8 +1343,13 @@ _safe_clean_impl() {
                             fi
                         fi
                         action_rc=0
-                        record_dry_run_cleanup_target \
-                            "$path" "$size" 1 true || action_rc=$?
+                        # Same ownership refusal as safe_remove, the run's sink.
+                        if _mole_user_sink_refuses_on_ownership "$path"; then
+                            action_rc=1
+                        else
+                            record_dry_run_cleanup_target \
+                                "$path" "$size" 1 true || action_rc=$?
+                        fi
                         if mole_rc_timeout_or_signal "$action_rc"; then
                             cleanup_interrupt_rc=$action_rc
                             break
@@ -1477,8 +1476,16 @@ _safe_clean_impl() {
                         fi
                     fi
                     action_rc=0
-                    record_dry_run_cleanup_target \
-                        "$path" "$size_kb" 1 true || action_rc=$?
+                    # This preview's run removes through safe_remove, which
+                    # refuses an item another user owns that this user cannot
+                    # unlink, so the preview leaves it out too. Sudo sinks
+                    # record through the same function and keep their rows.
+                    if _mole_user_sink_refuses_on_ownership "$path"; then
+                        action_rc=1
+                    else
+                        record_dry_run_cleanup_target \
+                            "$path" "$size_kb" 1 true || action_rc=$?
+                    fi
                     if mole_rc_timeout_or_signal "$action_rc"; then
                         cleanup_interrupt_rc=$action_rc
                         break
```

**File**: `lib/core/file_ops.sh` (modified, +5/-3)
```diff
@@ -1520,9 +1520,11 @@ _mole_note_clean_cancel_source() {
 # This sink is a plain rm as the invoking user. An item another user owns
 # (root's leftovers from `sudo gem`, `sudo npm`, `sudo bundle`) fails there
 # unless this user can still unlink it: its folder is writable and not sticky,
-# and a folder item is itself writable. The preview asks the same question
-# (record_dry_run_cleanup_target), so a row the run would refuse on every
-# clean is never listed (Mole Mac CacheScanner.userSinkRefusesOnOwnership).
+# and a folder item is itself writable. safe_remove asks before its dry-run
+# return and _safe_clean_impl before recording its preview, so a row the run
+# would refuse on every clean is never listed (Mole Mac
+# CacheScanner.userSinkRefusesOnOwnership). Never ask it for a sudo sink,
+# which removes root-owned items itself.
 # A link is unlinked in its folder whoever owns it, so it is never refused here.
 _mole_path_owned_by_current_user() {
     [[ -O "$1" ]]
```

**File**: `tests/clean_core.bats` (modified, +30/-0)
```diff
@@ -251,6 +251,36 @@ EOF
     rm -rf "$HOME/.bundle"
 }
 
+@test "record_dry_run_cleanup_target still records a root-owned item for a sudo sink" {
+    # safe_sudo_remove and safe_sudo_find_delete preview through this recorder
+    # and remove root-owned items themselves; the user-level ownership refusal
+    # must not hide their rows (/Library/Caches is sticky, /private/var/log is
+    # not writable by the user).
+    local logs="$HOME/root-owned-logs"
+    mkdir -p "$logs"
+    printf 'x' > "$logs/install.log"
+    chmod 555 "$logs"
+
+    run env HOME="$HOME" PROJECT_ROOT="$PROJECT_ROOT" MOLE_TEST_MODE=1 LOGS="$logs" \
+        /bin/bash --noprofile --norc << 'EOF'
+set -euo pipefail
+source "$PROJECT_ROOT/lib/core/common.sh"
+source "$PROJECT_ROOT/bin/clean.sh"
+export MOLE_DRY_RUN=1
+_mole_path_owned_by_current_user() { [[ "$1" != "$LOGS/"* && -O "$1" ]]; }
+register_dry_run_cleanup_target() { :; }
+append_dry_run_cleanup_target() { echo "RECORDED=$1"; }
+_mole_user_sink_refuses_on_ownership "$LOGS/install.log" && echo "USER_SINK_REFUSES"
+record_dry_run_cleanup_target "$LOGS/install.log" 1 1 true
+EOF
+    chmod 755 "$logs"
+    rm -rf "$logs"
+
+    [ "$status" -eq 0 ] || { echo "$output"; return 1; }
+    [[ "$output" == *"USER_SINK_REFUSES"* ]] || { echo "$output"; return 1; }
+    [[ "$output" == *"RECORDED=$logs/install.log"* ]] || { echo "$output"; return 1; }
+}
+
 @test "safe_clean keeps the row when a size could not be read" {
     local base="$HOME/safe_clean_unsized"
     mkdir -p "$base/one" "$base/two"
```

**File**: `tests/clean_system_caches.bats` (modified, +7/-0)
```diff
@@ -377,12 +377,19 @@ ln -sfn "$(hostname)-99999999" "$support/Stale/Browser/SingletonLock"
 for root in "Vivaldi" "Google/Chrome" "Vendor/Product/User Data" "Stale/Browser"; do
     clean_service_worker_cache Test "$support/$root/Default/Service Worker/CacheStorage"
 done
+# A browser that starts after the walk began: the guard runs after sizing,
+# just before the removal, and the lock check after it must hold the store.
+mkdir -p "$support/Late/Browser/Default/Service Worker/CacheStorage/origin/cache"
+rm -f "$support/Late/Browser/SingletonLock"
+start_late_browser() { ln -sfn "$(hostname)-$$" "$support/Late/Browser/SingletonLock"; }
+clean_service_worker_cache Test "$support/Late/Browser/Default/Service Worker/CacheStorage" start_late_browser
 EOF
         [ "$status" -eq 0 ] || { echo "$output"; return 1; }
         local support="$sw_home/Library/Application Support"
         [[ "$output" != *"=$support/Vivaldi/"* ]] || { echo "$output"; return 1; }
         [[ "$output" != *"=$support/Google/Chrome/"* ]] || { echo "$output"; return 1; }
         [[ "$output" != *"=$support/Vendor/Product/User Data/"* ]] || { echo "$output"; return 1; }
+        [[ "$output" != *"=$support/Late/Browser/"* ]] || { echo "$output"; return 1; }
         [[ "$output" == *"=$support/Stale/Browser/Default/Service Worker/CacheStorage/origin/cache"* ]] || { echo "$output"; return 1; }
     done
     rm -rf "$sw_home"
```

---

### Incident Patch 2: `72e63f39` (2026-11-22)
**Commit Message**: fix(clean): do not list or retry items another user owns and cannot unlink

safe_remove deletes with a plain rm as the invoking user. A cache root left
by `sudo bundle`, `sudo gem` or `sudo npm` (root-owned entries in a folder
the user cannot write) was listed by mo clean --dry-run with its size, then
failed on every real run with a FAILED (permission denied) row. Mole Mac met
the same shape (I-314: a root-owned ~/.bundle/cache refused 16 times) and now
asks the sink's own ownership preflight at scan time (2c7957058).

_mole_user_sink_refuses_on_ownership answers for the CLI's sink: an item
another user owns is refused unless its folder is writable and not sticky
and, for a folder item, the item itself is writable (the same movable test
Mole Mac uses). safe_remove logs SKIPPED (owned by another user) instead of
attempting the rm, and record_dry_run_cleanup_target asks the same function,
so the preview no longer lists what the run refuses. Links and runs as root
are never refused. Only refusals the rm would hit anyway are added.

Verified: the new Bats case is red on the old code (dry run listed "Ruby
Bundler cache · 2 items, 45KB"), and red again with only the safe_remove
half disa

**File**: `.claude/rules/core.md` (modified, +1/-0)
```diff
@@ -18,6 +18,7 @@ paths:
 ## `lib/core/file_ops.sh` and `lib/core/base.sh`
 
 - `lib/core/file_ops.sh` owns the deletion funnel, Trash/permanent routing, operation-log outcomes, size accounting, and last-mile path validation. `lib/core/base.sh` owns shared shell primitives and source-order-sensitive section helpers. Keep policy in the existing protection helpers rather than adding a second delete path. Run `MOLE_TEST_NO_AUTH=1 bats tests/file_ops_mole_delete.bats tests/file_ops_size.bats tests/file_ops_safe_remove_symlink.bats tests/user_file_ops.bats tests/core_safe_functions.bats tests/history.bats`.
+- `safe_remove` is a plain `rm` as the invoking user, so `_mole_user_sink_refuses_on_ownership` refuses an item another user owns that this user cannot unlink (folder not writable or sticky, or a folder item not writable), logging `SKIPPED ... (owned by another user)` instead of a `FAILED` row on every clean, and `record_dry_run_cleanup_target` asks the same function so the preview never lists it (Mole Mac I-314, `CacheScanner.userSinkRefusesOnOwnership`). Links and runs as root are never refused here. Locked by `safe_clean neither lists nor removes an item another user owns that this user cannot unlink` in `tests/clean_core.bats`, red with either half removed.
 - Both find/delete helpers preserve signal statuses in the clean cancellation marker, including scan, sizing, preview and privileged preflight failures; a prior cancellation stops them before further work. Read-only scan or sizing timeouts stay local and never set that marker. A signal from `validate_path_for_deletion` must stop the privileged scan loop and discard its accumulated removal batch, not become an ordinary refusal via `if ! ...; then continue`; a validator timeout still skips only its target. Locked by the `preserves scan signals`, `preserves dry-run sizing signals`, `read-only timeouts remain local`, `preserves preview validation signals`, `stops before work after sticky cancellation`, `stops accumulated batches on validation signals` and `validation timeout skips only its target` cases in `tests/core_safe_functions.bats`.
 - `validate_path_for_deletion` refuses every path when `should_protect_path` is not defined (a caller that sourced `file_ops.sh` without `app_protection.sh`), logging `protection rules not loaded`; it never skips the protection check. Every product entrypoint loads both through `common.sh`. Locked by `validate_path_for_deletion refuses every path when protection rules are not loaded` and `safe_find_delete keeps files when app protection is not loaded` in `tests/core_safe_functions.bats`.
 - **A stored timestamp from the future is expired, not fresh.** A freshness or throttle window (`now - stamp < ttl`, `find -mmin -N`) accepts a negative age, so after a clock correction a cache or a daily stamp stays valid until the clock catches up and the work it gates is skipped. Cache and throttle checks treat a negative age as expired; an age check that decides whether to delete or list an old item keeps a future-dated one, the safe direction. Locked by `brew_cleanup_ran_recently treats a stamp from the future as expired` in `tests/clean_system_maintenance.bats`, `Darwin temp root prune lists again when its stamp is from the future` in `tests/user_file_ops.bats`, `cached app metadata stamped in the future is refreshed, a recent stamp is not` and `a receipt cache stamped in the future is rebuilt, a recent one answers` in `tests/uninstall_scan_bash32.bats`, and `TestStampWithinTreatsFutureStampAsExpired` in `cmd/analyze/cache_clock_test.go`.
```

**File**: `bin/clean.sh` (modified, +6/-0)
```diff
@@ -241,6 +241,12 @@ record_dry_run_cleanup_target() {
     if [[ "${MOLE_CURRENT_COMMAND:-}" == "clean" ]] && mole_rc_timeout_or_signal "$pending_clean_cancel"; then
         return "$pending_clean_cancel"
     fi
+    # The real sink refuses an item another user owns that this user cannot
+    # unlink, so the preview does not list it either (safe_remove).
+    if declare -f _mole_user_sink_refuses_on_ownership > /dev/null 2>&1 &&
+        _mole_user_sink_refuses_on_ownership "$path"; then
+        return 1
+    fi
     if [[ "${_MOLE_DRY_RUN_TARGET_PREVALIDATED:-false}" != "true" ]]; then
         if declare -f should_protect_path > /dev/null 2>&1 && should_protect_path "$path" 2> /dev/null; then
             return 1
```

**File**: `lib/core/file_ops.sh` (modified, +30/-0)
```diff
@@ -1475,6 +1475,29 @@ _mole_note_clean_cancel_source() {
 }
 
 # Safe wrapper around rm -rf with validation
+# This sink is a plain rm as the invoking user. An item another user owns
+# (root's leftovers from `sudo gem`, `sudo npm`, `sudo bundle`) fails there
+# unless this user can still unlink it: its folder is writable and not sticky,
+# and a folder item is itself writable. The preview asks the same question
+# (record_dry_run_cleanup_target), so a row the run would refuse on every
+# clean is never listed (Mole Mac CacheScanner.userSinkRefusesOnOwnership).
+# A link is unlinked in its folder whoever owns it, so it is never refused here.
+_mole_path_owned_by_current_user() {
+    [[ -O "$1" ]]
+}
+
+_mole_user_sink_refuses_on_ownership() {
+    local path="$1"
+    [[ ${EUID:-0} -ne 0 ]] || return 1
+    [[ -e "$path" && ! -L "$path" ]] || return 1
+    _mole_path_owned_by_current_user "$path" && return 1
+    local parent="${path%/*}"
+    [[ -n "$parent" ]] || parent=/
+    [[ -d "$parent" && -w "$parent" && ! -k "$parent" ]] || return 0
+    [[ ! -d "$path" || -w "$path" ]] || return 0
+    return 1
+}
+
 safe_remove() {
     local path="$1"
     local silent="${2:-false}"
@@ -1545,6 +1568,13 @@ safe_remove() {
         return 0
     fi
 
+    # Before the dry-run return, so a preview never lists what the run refuses.
+    if _mole_user_sink_refuses_on_ownership "$path"; then
+        debug_log "Skipped removal of an item another user owns: $path"
+        log_operation "${MOLE_CURRENT_COMMAND:-clean}" "SKIPPED" "$path" "owned by another user"
+        return 1
+    fi
+
     # Keep preview eligibility identical to real cleanup. This first check
     # rejects an already-present compiled model cache before the dry-run return;
     # the final-sink check below still catches one created during size probing.
```

**File**: `tests/clean_core.bats` (modified, +43/-0)
```diff
@@ -208,6 +208,49 @@ EOF
     rm -rf "$base"
 }
 
+@test "safe_clean neither lists nor removes an item another user owns that this user cannot unlink" {
+    local cache="$HOME/.bundle/cache"
+    mkdir -p "$cache/sub"
+    head -c 40000 /dev/zero > "$cache/rake-13.gem"
+    printf 'x' > "$cache/sub/file"
+    chmod 555 "$cache"
+    rm -f "$HOME/Library/Logs/mole/operations.log"
+
+    local mode
+    for mode in dry real; do
+        run env HOME="$HOME" PROJECT_ROOT="$PROJECT_ROOT" MOLE_TEST_MODE=1 MODE="$mode" \
+            /bin/bash --noprofile --norc << 'EOF'
+set -euo pipefail
+source "$PROJECT_ROOT/lib/core/common.sh"
+source "$PROJECT_ROOT/bin/clean.sh"
+if [[ "$MODE" == dry ]]; then DRY_RUN=true; export MOLE_DRY_RUN=1; else DRY_RUN=false; export MOLE_DRY_RUN=0; fi
+MOLE_CURRENT_COMMAND=clean
+files_cleaned=0
+total_size_cleaned=0
+total_items=0
+start_section_spinner() { :; }
+stop_section_spinner() { :; }
+start_inline_spinner() { :; }
+stop_inline_spinner() { :; }
+# A fixture cannot be chowned to root without sudo; the cache's entries
+# answer as another user's, the way `sudo bundle` leaves them.
+_mole_path_owned_by_current_user() { [[ "$1" != "$HOME/.bundle/cache/"* && -O "$1" ]]; }
+safe_clean "$HOME"/.bundle/cache/* "Ruby Bundler cache"
+echo "MODE=$MODE FILES=$files_cleaned"
+EOF
+        [ "$status" -eq 0 ] || { chmod 755 "$cache"; echo "$output"; return 1; }
+        [[ "$output" != *"Ruby Bundler cache"* ]] || { chmod 755 "$cache"; echo "$output"; return 1; }
+        [[ "$output" == *"MODE=$mode FILES=0"* ]] || { chmod 755 "$cache"; echo "$output"; return 1; }
+    done
+    chmod 755 "$cache"
+
+    local log="$HOME/Library/Logs/mole/operations.log"
+    [ "$(grep -c 'SKIPPED .*\.bundle/cache/.*(owned by another user)' "$log")" -eq 2 ] || { cat "$log"; return 1; }
+    ! grep -q 'FAILED' "$log" || { cat "$log"; return 1; }
+    [[ -f "$cache/rake-13.gem" && -f "$cache/sub/file" ]] || return 1
+    rm -rf "$HOME/.bundle"
+}
+
 @test "safe_clean keeps the row when a size could not be read" {
     local base="$HOME/safe_clean_unsized"
     mkdir -p "$base/one" "$base/two"
```

---

### Incident Patch 3: `153d9b47` (2026-11-22)
**Commit Message**: fix(clean): log completed owner cache cleanups before sizing (#2067)

A TERM delivered during the size recount could leave a successful owner
cleanup out of operations.log. Write the existing REMOVED entry as soon
as the shared cache helper, Go, or Tart reports success.

Exercise the clean shell TERM handler in both new regression tests with
isolated fake owner commands.

**File**: `lib/clean/dev.sh` (modified, +9/-11)
```diff
@@ -100,6 +100,10 @@ clean_tool_cache() {
         fi
         [[ $size_rc -eq 0 ]] || size_before_kb=""
         "$@" > /dev/null 2>&1 || command_rc=$?
+        # Record a successful owner cleanup before result sizing can be interrupted.
+        if [[ $command_rc -eq 0 && "${1:-}" != ":" ]]; then
+            log_operation "${MOLE_CURRENT_COMMAND:-clean}" "REMOVED" "${cache_path:-$description}" "owner command: $description"
+        fi
         local freed_kb=0 after_rc=0
         if [[ $command_rc -eq 0 && -n "$size_before_kb" ]]; then
             local size_after_kb=0
@@ -122,13 +126,7 @@ clean_tool_cache() {
                 echo -e "  ${GREEN}${ICON_SUCCESS}${NC} $description"
             fi
             note_activity
-            # The owner command changed the Mac, so it gets an operations.log
-            # row like every other sink. A ":" placeholder changed nothing.
-            if [[ "${1:-}" != ":" ]]; then
-                log_operation "${MOLE_CURRENT_COMMAND:-clean}" "REMOVED" "${cache_path:-$description}" "owner command: $description"
-            fi
-            # Ctrl-C while measuring the result reaches only the measuring
-            # child; the command already ran, so record it, then stop.
+            # Preserve an interruption reported by the sizing child.
             if mole_rc_signal "$after_rc"; then
                 _mole_record_clean_cancellation "$after_rc" "$description"
                 return "$after_rc"
@@ -1159,6 +1157,10 @@ clean_go_cache_root() {
         "$lexical_parent" "$lexical_parent_id" "$lexical_target_id" \
         "$physical_parent" "$physical_parent_id" "$physical_target_id" \
         "$cache_kind" "$clean_flag" "$DRY_RUN" || command_status=$?
+    # Record the completed cleanup before measuring the remaining cache.
+    if [[ "$DRY_RUN" != "true" && $command_status -eq 0 ]]; then
+        log_operation "${MOLE_CURRENT_COMMAND:-clean}" "REMOVED" "$cache_root" "owner command: $display_name"
+    fi
     local after_rc=0
     if [[ "$DRY_RUN" != "true" && $command_status -eq 0 && -n "$size_before_kb" ]]; then
         local size_after_kb=0
@@ -1184,10 +1186,6 @@ clean_go_cache_root() {
             echo -e "  ${GREEN}${ICON_SUCCESS}${NC} $display_name"
         fi
         note_activity
-        # A dry run ran `go clean -n`, which changes nothing.
-        if [[ "$DRY_RUN" != "true" ]]; then
-            log_operation "${MOLE_CURRENT_COMMAND:-clean}" "REMOVED" "$cache_root" "owner command: $display_name"
-        fi
         if mole_rc_signal "$after_rc"; then
             _mole_record_clean_cancellation "$after_rc" "$display_name"
             return "$after_rc"
```

**File**: `lib/clean/user.sh` (modified, +4/-3)
```diff
@@ -2586,6 +2586,10 @@ clean_tart_caches() {
         return 0
     fi
 
+    # The prune already ran, so log it before a signal during the recount
+    # stops the run.
+    log_operation "${MOLE_CURRENT_COMMAND:-clean}" "REMOVED" "$cache_root" "owner command: Tart caches"
+
     local reclaimed_kb=0
     local reclaimed_known=false
     local post_rc=0
@@ -2607,9 +2611,6 @@ clean_tart_caches() {
         echo -e "  ${GREEN}${ICON_SUCCESS}${NC} Tart caches · pruned"
     fi
     note_activity
-    # The prune already ran, so log it before a signal during the recount
-    # stops the run.
-    log_operation "${MOLE_CURRENT_COMMAND:-clean}" "REMOVED" "$cache_root" "owner command: Tart caches"
     if [[ $post_rc -ne 0 ]]; then
         mole_item_size_continues "$post_rc" || return $?
     fi
```

**File**: `tests/clean_dev_caches.bats` (modified, +51/-0)
```diff
@@ -5469,6 +5469,57 @@ EOF
     [[ "$output" == *"RC=130 CANCEL=130"* ]] || { echo "$output"; return 1; }
 }
 
+@test "completed owner cache cleanups stay logged when result sizing is interrupted" {
+    local route description case_home op_log rows
+    local failures=0
+    for route in shared go; do
+        description="Fixture cache"
+        [[ "$route" != go ]] || description="Go build cache"
+        case_home="$BATS_TEST_TMPDIR/$route-after-size"
+        mkdir -p "$case_home/go-build-fixture"
+        run env HOME="$case_home" PROJECT_ROOT="$PROJECT_ROOT" SUDO_USER= \
+            MOLE_TEST_NO_AUTH=1 MOLE_DRY_RUN=0 MO_NO_OPLOG=0 \
+            OWNER_ROUTE="$route" OWNER_DESCRIPTION="$description" /bin/bash --noprofile --norc <<'EOF'
+set -euo pipefail
+source "$PROJECT_ROOT/bin/clean.sh"
+[[ "$MOLE_USER_HOME" == "$HOME" && "$DRY_RUN" == false ]] || exit 90
+
+fake_owner_cleanup() {
+    printf 'owner succeeded\n' >> "$HOME/owner.trace"
+    : > "$HOME/owner-complete"
+}
+_run_go_cache_clean_bound() { fake_owner_cleanup; }
+_owner_cache_size_kb() {
+    if [[ -f "$HOME/owner-complete" ]]; then
+        printf 'result sizing started\n' >> "$HOME/owner.trace"
+        # Bash's $$ still names this fixture's clean shell inside $(...).
+        kill -TERM "$$"
+        printf '4\n'
+    else
+        printf '16\n'
+    fi
+}
+if [[ "$OWNER_ROUTE" == go ]]; then
+    clean_go_cache_root "$HOME/go-build-fixture" GOCACHE -cache "$OWNER_DESCRIPTION"
+else
+    clean_tool_cache "$OWNER_DESCRIPTION" "$HOME/go-build-fixture" fake_owner_cleanup
+fi
+EOF
+        [ "$status" -eq 143 ] || { printf '%s exited %s\n%s\n' "$route" "$status" "$output"; return 1; }
+        [[ "$(cat "$case_home/owner.trace")" == $'owner succeeded\nresult sizing started' ]] || return 1
+        op_log="$case_home/Library/Logs/mole/operations.log"
+        rows=0
+        if [[ -f "$op_log" ]]; then
+            rows=$(grep -Fc "REMOVED $case_home/go-build-fixture (owner command: $description)" "$op_log") || true
+        fi
+        if [[ "$rows" -ne 1 ]]; then
+            printf '%s wrote %s REMOVED rows, expected 1\n' "$route" "$rows"
+            failures=1
+        fi
+    done
+    [ "$failures" -eq 0 ]
+}
+
 @test "clean_dev_go stops when measuring a cleaned Go cache is interrupted" {
     local module_root="$HOME/go-module-after"
     local build_root="$HOME/go-build-after"
```

**File**: `tests/clean_misc.bats` (modified, +32/-0)
```diff
@@ -200,6 +200,38 @@ EOF
     [[ "$output" != *"OPLOG:"* ]] || { echo "$output"; return 1; }
 }
 
+@test "clean_tart_caches keeps the prune log when TERM interrupts post-prune sizing" {
+    local case_home="$BATS_TEST_TMPDIR/tart-oplog"
+    mkdir -p "$case_home/.tart/cache/OCIs"
+    # shellcheck disable=SC2016  # Body is written to the fake script verbatim.
+    mole_test_fake_command tart 'printf "%s\n" "$*" > "$HOME/tart-pruned"'
+
+    run env HOME="$case_home" PROJECT_ROOT="$PROJECT_ROOT" MOLE_CURRENT_COMMAND=clean \
+        MOLE_DRY_RUN=0 MO_NO_OPLOG=0 /bin/bash --noprofile --norc << 'EOF'
+source "$PROJECT_ROOT/bin/clean.sh"
+CLEAN_STATUS_ON_SUCCESS=done
+mole_report_program_status() { printf 'clean status: %s\n' "$1"; }
+pgrep() { return 1; }
+is_path_whitelisted() { return 1; }
+get_path_size_kb() {
+    if [[ -f "$HOME/tart-pruned" ]]; then
+        # Inside the sizing subshell, $$ still names the shell with the TERM trap.
+        kill -TERM "$$" || return $?
+    fi
+    echo 1024
+}
+clean_tart_caches
+EOF
+
+    [ "$status" -eq 143 ] || { printf 'Expected exit 143, got %s\n%s\n' "$status" "$output"; return 1; }
+    [[ "$output" == *"clean status: idle"* ]] || { echo "$output"; return 1; }
+    [ "$(< "$case_home/tart-pruned")" = "prune --entries caches --older-than 30" ] || return 1
+
+    local oplog="$case_home/Library/Logs/mole/operations.log"
+    [ "$(wc -l < "$oplog")" -eq 1 ] || { echo "Expected one operation log row"; cat "$oplog"; return 1; }
+    [[ "$(< "$oplog")" == *"] [clean] REMOVED $case_home/.tart/cache (owner command: Tart caches)" ]]
+}
+
 @test "clean_tart_caches stops when the native prune is interrupted" {
     # Ctrl-C while `tart prune` holds the terminal reaches only the child. A
     # signal stops cleanup before the size recount; a plain failure or a
```

#### Recent Merged Pull Requests:
- **PR #2073** (2026-11-22): perf(slim): start each Gatekeeper check as soon as its app is planned (@sebastianbreguel)
- **PR #2070** (2026-11-22): perf(core): remove tree entries without provider calls (@b84330808)
- **PR #2069** (2026-11-22): fix(clean): preserve Unicode filename suffixes in the spinner (@Yuxin-Qiao)
- **PR #2067** (2026-11-22): fix(clean): log completed owner cache cleanups before sizing (@Yuxin-Qiao)
- **PR #2065** (2026-11-22): perf(analyze): reuse the full directory listing (@po-et)
- **PR #2063** (2026-11-21): fix(clean): log completed simctl cleanup before recount (@Yuxin-Qiao)

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

## X. clean): keep sudo sinks' preview rows out of the ownership refusal

**RULE**:
When implementing operations in `.claude/rules/core.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in tw93/Mole. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `5d795f30`: clean): keep sudo sinks' preview rows out of the ownership refusal. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Shell data structures, boundary deserialization, API parsing, or resource lifecycles matching `.claude/rules/core.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```shell
// Verified production-grade fix pattern:
- `safe_remove` is a plain `rm` as the invoking user, so `_mole_user_sink_refuses_on_ownership` refuses an item another user owns that this user cannot unlink (folder not writable or sticky, or a folder item not writable), logging `SKIPPED ... (owned by another user)` instead of a `FAILED` row on every clean, and `_safe_clean_impl` asks the same function before recording its preview, so the preview never lists it (Mole Mac I-314, `CacheScanner.userSinkRefusesOnOwnership`). Links and runs as root are never refused here. Never put this check in `record_dry_run_cleanup_target`: `safe_sudo_remove`, `safe_sudo_find_delete` and other sudo sinks preview through it and remove root-owned items themselves, so their rows would vanish from the dry run. Locked by `safe_clean neither lists nor removes an item another user owns that this user cannot unlink` (red with either half removed) and `record_dry_run_cleanup_target still records a root-owned item for a sudo sink` in `tests/clean_core.bats`.
```

**NEGATIVE CONSTRAINT**:
```shell
// Induced defect failure mode:
- `safe_remove` is a plain `rm` as the invoking user, so `_mole_user_sink_refuses_on_ownership` refuses an item another user owns that this user cannot unlink (folder not writable or sticky, or a folder item not writable), logging `SKIPPED ... (owned by another user)` instead of a `FAILED` row on every clean, and `record_dry_run_cleanup_target` asks the same function so the preview never lists it (Mole Mac I-314, `CacheScanner.userSinkRefusesOnOwnership`). Links and runs as root are never refused here. Locked by `safe_clean neither lists nor removes an item another user owns that this user cannot unlink` in `tests/clean_core.bats`, red with either half removed.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `5d795f30` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
