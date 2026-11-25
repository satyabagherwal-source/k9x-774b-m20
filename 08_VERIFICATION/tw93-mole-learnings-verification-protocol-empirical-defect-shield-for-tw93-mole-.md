# Verification Protocol: Verification Protocol: Empirical Defect Shield for tw93-mole-learnings

<!-- PROVENANCE_START
{
  "source_repository": "tw93-mole-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-25T01:09:25.681Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-tw93-mole-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [tw93-mole-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-25T01:09:25.681Z`  
> **Learning ID**: `LEARN-EVO-tw93-mole-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `tw93-mole-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/tw93-mole-learnings.md`  
> **Source**: github ([https://github.com/tw93/Mole](https://github.com/tw93/Mole))  
> **Source Version**: `ee710b48`  
> **License**: GPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-25T01:09:18.232Z  
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
> **Harvest Timestamp**: 2026-11-25T01:09:18.121Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tw93/Mole`
- **Description**: 🐹 Open-source Mac and PC cleaner. Keep your machine clean, light, and running like new. Fast CLI, plus native Mac and Windows apps.
- **Primary Language / Ecosystem**: Shell
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 76088 stars

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
- **Issue #2081** (2026-11-23): **[Mac App ] 建议增加系统代理设置**
  *Symptoms*: ### Mole Mac app version  1.20.1 (376)  ### macOS version  15.5.0 (Sequoia)  ### Mac model  MacBookPro18,4 (Apple M1 Max)  ### Affected area  Other  ### What happened?  无法更新一些通过Homebrew安装的插件  ### Steps to reproduce  无法更新  ### Expected behavior  建议增加系统代理入口，因为某些原因无法使用VPN软件，目前是通过Docker跑Mihomo裸核的方式，希望能给Mole单独设置代理从而无痛更新外部软件和一些需要依赖外部网络的需求  ### Screenshots or safe logs  _No response_  ### Before submitting  - [x] I updated to the latest stable Mole Mac app, reopened it, and reproduced this problem (or this report explains why I cannot update). - [x] I did not include license keys, order numbers, or private data.

- **Issue #2039** (2026-11-20): **[BUG] `mo clean --dry-run` silently omits Xcode/Simulator cleanup that the real run then performs (~48GB)**
  *Symptoms*: ## Before submitting  - [x] This report explains why I cannot reproduce on the same data: I ran it from a source checkout of current `main` (1.73.0, commit `7966afdd`), and the real run already removed the affected items, so the same preview can't be repeated on this Mac.  ## Describe the bug  `mo clean --dry-run` showed no Xcode DerivedData, iOS DeviceSupport, Simulator device data, Interface Builder cache or Xcode build products rows. `clean-list.txt` from that preview had zero paths under `Xcode/DerivedData`, `iOS DeviceSupport` or `IB Support`. DerivedData appeared only as a `⊙` review row under Large files, which reads as "not removed".  I approved the cleanup from that preview. About two minutes later, `mo clean` removed all of the following, none of which the preview listed:  | Row in real run | Size | |---|---| | Xcode DerivedData · 45 projects | 29.71GB | | iOS DeviceSupport · removed 2 old versions | 13.83GB | | Simulator device data · 30 items | 4.25GB | | Xcode Interface Builder cache | 394.9MB | | Clang module cache | 61.1MB | | Xcode build products · 51 items | 893KB |  Everything removed is rebuildable, and nothing ran while Xcode was active, so this is not an unsafe-deletion report. The problem is that the preview showed less than the real run then removed, with no notice, so the preview could not be trusted as the full list of what would be deleted.  **Likely cause (from reading the source; not confirmed with `--debug`):** each of these steps is gated on `xco

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

### Incident Patch 1: `fae04a5a` (2026-11-23)
**Commit Message**: fix(clean): show and count the aged log sweeps in preview and real runs

Why: safe_find_delete removed matches quietly. The preview still added
them to Potential space, but showed no row, and a real run removed them
without counting them, so the preview promised bytes the real run never
reported and nothing on screen named what went. On the maintainer's Mac
this was nine Cursor Agent worker logs, 61 MB, after #2077.

safe_find_delete takes an optional row label. With one, the completed
matches go through safe_clean, which shows the row, counts it, records
the preview and applies the protection and whitelist checks. The three
clean callers pass "Cursor Agent logs", "Cursor Agent worker logs" and
"Crash reporter data". Unlabeled calls behave as before.

Verified: the new Bats case fails on the old file_ops.sh (0 files, 0
rows in both modes) and passes now; check.sh --no-format and the full
suite pass. Mole CLI (Linux) has no safe_find_delete caller.

Rollback: git revert this commit; the sweeps go back to removing quietly.

**File**: `.claude/rules/core.md` (modified, +1/-0)
```diff
@@ -19,6 +19,7 @@ paths:
 
 - `lib/core/file_ops.sh` owns the deletion funnel, Trash/permanent routing, operation-log outcomes, size accounting, and last-mile path validation. `lib/core/base.sh` owns shared shell primitives and source-order-sensitive section helpers. Keep policy in the existing protection helpers rather than adding a second delete path. Run `MOLE_TEST_NO_AUTH=1 bats tests/file_ops_mole_delete.bats tests/file_ops_size.bats tests/file_ops_safe_remove_symlink.bats tests/user_file_ops.bats tests/core_safe_functions.bats tests/history.bats`.
 - `safe_remove` is a plain `rm` as the invoking user, so `_mole_user_sink_refuses_on_ownership` refuses an item another user owns that this user cannot unlink (folder not writable or sticky, or a folder item not writable), logging `SKIPPED ... (owned by another user)` instead of a `FAILED` row on every clean, and `_safe_clean_impl` asks the same function before recording its preview, so the preview never lists it (Mole Mac I-314, `CacheScanner.userSinkRefusesOnOwnership`). Links and runs as root are never refused here. Never put this check in `record_dry_run_cleanup_target`: `safe_sudo_remove`, `safe_sudo_find_delete` and other sudo sinks preview through it and remove root-owned items themselves, so their rows would vanish from the dry run. The preview half covers `safe_clean` only: about twenty user-level cleaners that record their own preview and remove through `safe_remove` (`clean_trash`, `clean_application_support_logs`, `safe_find_delete` and others) still list such an item and then log it `SKIPPED`, which over-lists but never deletes more than shown; moving them onto one user-sink recorder is open in `SYNC.md`. Locked by `safe_clean neither lists nor removes an item another user owns that this user cannot unlink` (red with either half removed), `safe_clean leaves out of the preview many files another user owns in one folder` (the batched-sizing branch) and `record_dry_run_cleanup_target still records a root-owned item for a sudo sink` (direct and through `safe_sudo_remove`) in `tests/clean_core.bats`.
+- A clean sweep through `safe_find_delete` passes its fifth argument, a row label: with one, the completed matches go through `safe_clean`, so the preview and a real run both show the row and count it in the total. Without a label no row is shown, the preview still adds the matches to Potential space and a real run removes them without counting them, so the preview promised bytes the real run never reported (the Cursor Agent worker logs, 61 MB on the maintainer's Mac, 2026-11-23). Locked by `a labeled safe_find_delete shows one row and counts it in the preview and a real run` in `tests/core_safe_functions.bats`.
 - Both find/delete helpers preserve signal statuses in the clean cancellation marker, including scan, sizing, preview and privileged preflight failures; a prior cancellation stops them before further work. Read-only scan or sizing timeouts stay local and never set that marker. A signal from `validate_path_for_deletion` must stop the privileged scan loop and discard its accumulated removal batch, not become an ordinary refusal via `if ! ...; then continue`; a validator timeout still skips only its target. Locked by the `preserves scan signals`, `preserves dry-run sizing signals`, `read-only timeouts remain local`, `preserves preview validation signals`, `stops before work after sticky cancellation`, `stops accumulated batches on validation signals` and `validation timeout skips only its target` cases in `tests/core_safe_functions.bats`.
 - `validate_path_for_deletion` refuses every path when `should_protect_path` is not defined (a caller that sourced `file_ops.sh` without `app_protection.sh`), logging `protection rules not loaded`; it never skips the protection check. Every product entrypoint loads both through `common.sh`. Locked by `validate_path_for_deletion refuses every path when protection rules are not loaded` and `safe_find_delete keeps files when app protection is not loaded` in `tests/core_safe_functions.bats`.
 - **A stored timestamp from the future is expired, not fresh.** A freshness or throttle window (`now - stamp < ttl`, `find -mmin -N`) accepts a negative age, so after a clock correction a cache or a daily stamp stays valid until the clock catches up and the work it gates is skipped. Cache and throttle checks treat a negative age as expired; an age check that decides whether to delete or list an old item keeps a future-dated one, the safe direction. Locked by `brew_cleanup_ran_recently treats a stamp from the future as expired` in `tests/clean_system_maintenance.bats`, `Darwin temp root prune lists again when its stamp is from the future` in `tests/user_file_ops.bats`, `cached app metadata stamped in the future is refreshed, a recent stamp is not` and `a receipt cache stamped in the future is rebuilt, a recent one answers` in `tests/uninstall_scan_bash32.bats`, and `TestStampWithinTreatsFutureStampAsExpired` in `cmd/analyze/cac
```

**File**: `lib/clean/dev.sh` (modified, +2/-2)
```diff
@@ -6351,15 +6351,15 @@ clean_dev_misc() {
     # Cursor Agent session logs (versions cleaned separately in clean_dev_ai_agents)
     if [[ -d "$HOME/.local/share/cursor-agent" ]]; then
         local cursor_logs_rc=0
-        safe_find_delete "$HOME/.local/share/cursor-agent" "*.log" "$MOLE_LOG_AGE_DAYS" "f" || cursor_logs_rc=$?
+        safe_find_delete "$HOME/.local/share/cursor-agent" "*.log" "$MOLE_LOG_AGE_DAYS" "f" "Cursor Agent logs" || cursor_logs_rc=$?
         if mole_rc_signal "$cursor_logs_rc"; then
             return "$cursor_logs_rc"
         fi
     fi
     local cursor_worker_dir="$HOME/Library/Application Support/Cursor/User/globalStorage/anysphere.cursor-agent-worker"
     if [[ -d "$cursor_worker_dir" && ! -L "$cursor_worker_dir" ]]; then
         local cursor_worker_logs_rc=0
-        safe_find_delete "$cursor_worker_dir" "cursor-agent-worker-*.log" "$MOLE_LOG_AGE_DAYS" "f" || cursor_worker_logs_rc=$?
+        safe_find_delete "$cursor_worker_dir" "cursor-agent-worker-*.log" "$MOLE_LOG_AGE_DAYS" "f" "Cursor Agent worker logs" || cursor_worker_logs_rc=$?
         if mole_rc_signal "$cursor_worker_logs_rc"; then
             return "$cursor_worker_logs_rc"
         fi
```

**File**: `lib/clean/user.sh` (modified, +1/-1)
```diff
@@ -1088,7 +1088,7 @@ clean_support_app_data() {
     local crash_reporter_dir="$HOME/Library/Application Support/CrashReporter"
     if [[ -d "$crash_reporter_dir" && ! -L "$crash_reporter_dir" ]]; then
         local crash_reporter_rc=0
-        safe_find_delete "$crash_reporter_dir" "*" "$support_age_days" "f" || crash_reporter_rc=$?
+        safe_find_delete "$crash_reporter_dir" "*" "$support_age_days" "f" "Crash reporter data" || crash_reporter_rc=$?
         if mole_rc_signal "$crash_reporter_rc"; then
             return "$crash_reporter_rc"
         fi
```

**File**: `lib/core/file_ops.sh` (modified, +16/-1)
```diff
@@ -3539,12 +3539,16 @@ _mole_delete_log() {
 # Safe Find and Delete Operations
 # ============================================================================
 
-# Safe file discovery and deletion with depth and age limits
+# Safe file discovery and deletion with depth and age limits. With a label,
+# the completed matches go through safe_clean, so the preview and a real run
+# both show one row and count it in the total. Without one no row is shown,
+# the preview still counts the matches and a real run does not.
 safe_find_delete() {
     local base_dir="$1"
     local pattern="$2"
     local age_days="${3:-7}"
     local type_filter="${4:-f}"
+    local label="${5:-}"
 
     local pending_clean_cancel="${MOLE_CLEAN_CANCEL_STATUS:-0}"
     if [[ "${MOLE_CURRENT_COMMAND:-}" == "clean" ]] && mole_rc_timeout_or_signal "$pending_clean_cancel"; then
@@ -3598,6 +3602,17 @@ safe_find_delete() {
 
     # Iterate only a completed result set so a timeout cannot authorize
     # deletion of the partial prefix.
+    if [[ -n "$label" ]] && declare -f safe_clean > /dev/null 2>&1; then
+        local -a labeled_matches=()
+        while IFS= read -r -d '' match; do
+            labeled_matches+=("$match")
+        done < "$scan_file"
+        rm -f -- "$scan_file" 2> /dev/null || true # SAFE: exact tracked temp file created above
+        [[ ${#labeled_matches[@]} -gt 0 ]] || return 0
+        local labeled_rc=0
+        safe_clean "${labeled_matches[@]}" "$label" || labeled_rc=$?
+        return "$labeled_rc"
+    fi
     # Per-caller whitelist gates were missed in past releases (see #710, #724,
     # #738, #744, #757); enforcing here makes the protection structural so
     # new clean_* functions get whitelist enforcement for free.
```

**File**: `tests/core_safe_functions.bats` (modified, +35/-0)
```diff
@@ -1984,6 +1984,41 @@ SCRIPT
     [ -f "$target_dir/file2.log" ] || return 1
 }
 
+@test "a labeled safe_find_delete shows one row and counts it in the preview and a real run" {
+    local target_dir="$TEST_DIR/find-labeled"
+    mkdir -p "$target_dir"
+    printf 'old log\n' > "$target_dir/a.log"
+    printf 'old log\n' > "$target_dir/b.log"
+    printf 'new log\n' > "$target_dir/new.log"
+    touch -t 202601010000 "$target_dir/a.log" "$target_dir/b.log"
+
+    local mode
+    for mode in dry real; do
+        run env HOME="$HOME" PROJECT_ROOT="$PROJECT_ROOT" TARGET_DIR="$target_dir" MODE="$mode" /bin/bash --noprofile --norc <<'SCRIPT'
+set -euo pipefail
+source "$PROJECT_ROOT/lib/core/common.sh"
+source "$PROJECT_ROOT/bin/clean.sh"
+if [[ "$MODE" == dry ]]; then
+    export MOLE_DRY_RUN=1
+    DRY_RUN=true
+fi
+safe_remove() { printf 'REMOVE:%s\n' "${1##*/}"; }
+rc=0
+safe_find_delete "$TARGET_DIR" "*.log" 7 f "Old test logs" || rc=$?
+printf 'RC=%s FILES=%s ROWS=%s\n' "$rc" "$files_cleaned" "$total_items"
+SCRIPT
+        [ "$status" -eq 0 ] || { echo "$output"; return 1; }
+        [[ "$output" == *"Old test logs"* ]] || { echo "$output"; return 1; }
+        [[ "$output" == *"RC=0 FILES=2 ROWS=1"* ]] || { echo "$output"; return 1; }
+        [[ "$output" != *"REMOVE:new.log"* ]] || return 1
+        if [[ "$mode" == dry ]]; then
+            [[ "$output" != *"REMOVE:"* ]] || return 1
+        else
+            [[ "$output" == *"REMOVE:a.log"* && "$output" == *"REMOVE:b.log"* ]] || { echo "$output"; return 1; }
+        fi
+    done
+}
+
 @test "the V1.36.3 aged sweep of ~/.claude/projects keeps every transcript folder" {
     local projects="$HOME/.claude/projects"
     local control="$TEST_DIR/aged-control"
```

---

### Incident Patch 2: `f3804188` (2026-11-23)
**Commit Message**: fix(clean): show each Electron app's caches as one row

VS Code, Cursor, CodeBuddy CN, Qoder, Claude, Antigravity, Filo,
mihomo-party, legacy Microsoft Teams, Vesktop, Figma and Codex Desktop
cleaned each cache or log folder in its own call, so one app printed up
to nine rows (Cursor cache, cached data, code cache, GPU cache, Dawn
cache, logs and more), and Zed printed two rows with the same label.

Pass every folder of an app to one mole_safe_clean_app_cache call (or
the Codex guarded helper) under one "<App> cache" label. The target set,
glob spellings and symlink refusals are unchanged; the delete guard still
rechecks the owner before every item, and a running or unknown owner now
stops the whole app at once instead of folder by folder.

The Codex row test and the I-108 catcher are renamed to the one-row form.

Verified: new call-count assertions fail on the old code (Cursor,
CodeBuddy CN, Teams, Zed, Figma, Vesktop and the Codex preview) and pass
now; the full MOLE_TEST_NO_AUTH=1 ./scripts/test.sh and check.sh
--no-format pass; a real-HOME preview shows VS Code as one 24.0MB row
where it showed two. Independent review found no safety issue and three
test and wording gaps, fixed

**File**: `.claude/rules/clean.md` (modified, +1/-1)
```diff
@@ -38,7 +38,7 @@ Developer and toolchain caches in `lib/clean/dev.sh` also follow `.claude/rules/
 
 - `bin/clean.sh` owns clean command orchestration, section output, and safe cleanup execution. Run `MOLE_TEST_NO_AUTH=1 bats tests/clean_core.bats tests/clean_apps.bats tests/cli.bats tests/clean_summary_cancel.bats tests/clean_developer_state.bats`.
 - Section output follows one fixed rhythm: title, then loading state, then content, then one trailing blank line, for every section. When touching any step of it, re-run the command and read the whole rendered output (column alignment, block spacing, icon consistency) instead of patching the one step that was reported.
-- **Rows report what Mole did, once.** A `safe_clean` row that measured 0B still removes and counts its items but prints nothing, unless a sizing timeout made the 0B unknown; roots that share a label clean in one call so per-profile caches read as one row; Large files skips the DerivedData row once developer tools covered every project (`_MOLE_DERIVED_DATA_COVERED`); counts go through `mole_count_label` (`1 item`). The summary box holds two lines: `Removed: X · N items` plus the free-space line, or `Potential space: X · N items` plus the file list. Locked by `safe_clean removes a 0B target without printing a row for it` (`tests/clean_core.bats`), `clean_wechat_container_caches cleans every web profile in one row per cache kind`, `clean_codex_desktop_caches previews one row per cache kind across every partition` (`tests/clean_ai_cli_caches.bats`) and `large files leaves out DerivedData that developer tools already covered`.
+- **Rows report what Mole did, once.** A `safe_clean` row that measured 0B still removes and counts its items but prints nothing, unless a sizing timeout made the 0B unknown; roots that share a label clean in one call so per-profile caches read as one row, and an app's cache and log folders (an Electron app's Cache, Code Cache, GPUCache, Dawn caches and logs, every Codex partition) go through one `mole_safe_clean_app_cache` call with one `<App> cache` label, so a well-used editor reads as one line; the delete guard still rechecks the owner before every item, and a running or unknown owner now stops the whole app at once; Large files skips the DerivedData row once developer tools covered every project (`_MOLE_DERIVED_DATA_COVERED`); counts go through `mole_count_label` (`1 item`). The summary box holds two lines: `Removed: X · N items` plus the free-space line, or `Potential space: X · N items` plus the file list. Locked by `safe_clean removes a 0B target without printing a row for it` (`tests/clean_core.bats`), `clean_wechat_container_caches cleans every web profile in one row per cache kind`, `clean_codex_desktop_caches previews one row across every profile and partition` (`tests/clean_ai_cli_caches.bats`), `clean_code_editors includes Cursor caches when directory exists` and `large files leaves out DerivedData that developer tools already covered`.
 - **Review rows go through `mole_review_row`: `⊙ label · value · fact`.** On a terminal the label is an OSC 8 link to the path, so the row carries no path or command field; plain output keeps the path last. The fact is worked out read-only and bounded (`_large_dir_fact`: simulator count, archive builds and month range, pnpm store versions, project count; version folders besides the default for Rust and NDK) and is dropped, never guessed, when its probe fails. Do not add a command for the user to run where Mole can state the fact itself; two of three suggested commands freed nothing on the maintainer's Mac (2026-10-31). Locked by `large files links each review label to its full path` and `large files names what the simulator and pnpm rows hold` in `tests/clean_user_core.bats`.
 - `_safe_clean_impl` skips targets that do not currently exist before expensive policy probes, then filters protected, whitelisted, and compiled-model targets before consulting the dry-run guard or registering previews. Every surviving target is revalidated at its action boundary, so preview and real cleanup keep the same eligible set. A delete guard that refuses only the path it was handed names it in `_MOLE_SAFE_CLEAN_SKIP_PATH`, which skips that target and continues the batch; any other nonzero guard status stops with 75 and a timeout or signal cancels. `safe_clean_guarded skips only the path its guard names and keeps going` in `tests/clean_core.bats` locks it.
 - `normalize_paths_for_cleanup` collapses a Gradle DSL path only in the `<version>/groovy-dsl|kotlin-dsl/<hash>` layout, because the `*` in its case glob spans slashes and a deeper directory that merely contains `groovy-dsl` would otherwise widen to its parent.
```

**File**: `docs/incidents.md` (modified, +1/-1)
```diff
@@ -142,4 +142,4 @@ when it was confirmed by reading the history, otherwise `unknown`.
 | I-105 | 2026-11-22 | Saving the clean or optimize whitelist truncated the file first and wrote patterns one by one, so a write that failed part-way (full disk, I/O error) left a partial list that the next run trusted as complete, and the lost patterns stopped protecting anything (#2079) | unknown | f6ed27937 | review | `save_whitelist_patterns keeps the previous list when a write fails` |
 | I-106 | 2026-11-22 | `mo purge` that found nothing, was cancelled or failed its scan never wrote the end marker, so `mo history` showed the finished run as never ended (#2080) | unknown | 65eebec66 | review | `purge ends its run when nothing is purged` |
 | I-107 | 2026-11-23 | `mo clean` removed aged Cursor Agent logs and CrashReporter files without a row: the preview added them to Potential space while a real run never counted them, so the preview promised more than the run reported (61 MB of Cursor Agent worker logs on the maintainer's Mac) | unknown | fae04a5a | review | `a labeled safe_find_delete shows one row and counts it in the preview and a real run` |
-| I-108 | 2026-11-23 | `mo clean` printed one "Codex Desktop Cache" row per Codex profile and webview partition, so the preview repeated the same label three times on a plain install and two more for every MCP app sandbox | fb180654 | 24e42862 | review | `clean_codex_desktop_caches previews one row per cache kind across every partition` |
+| I-108 | 2026-11-23 | `mo clean` printed one "Codex Desktop Cache" row per Codex profile and webview partition, so the preview repeated the same label three times on a plain install and two more for every MCP app sandbox | fb180654 | 24e42862 | review | `clean_codex_desktop_caches previews one row across every profile and partition` |
```

**File**: `lib/clean/app_caches.sh` (modified, +84/-65)
```diff
@@ -620,17 +620,24 @@ _codebuddy_shared_cache_running() {
 
 # Code editors.
 clean_code_editors() {
-    mole_safe_clean_app_cache "Visual Studio Code" ~/Library/Application\ Support/Code/logs/* "VS Code logs"
-    mole_safe_clean_app_cache "Visual Studio Code" ~/Library/Application\ Support/Code/Cache/* "VS Code cache"
-    mole_safe_clean_app_cache "Visual Studio Code" ~/Library/Application\ Support/Code/CachedExtensionVSIXs/* "VS Code extension cache"
-    mole_safe_clean_app_cache "Visual Studio Code" ~/Library/Application\ Support/Code/CachedData/* "VS Code data cache"
-    mole_safe_clean_app_cache "Visual Studio Code" ~/Library/Application\ Support/Code/WebStorage/*/CacheStorage/* "VS Code webview cache"
+    # Each Electron editor's cache and log folders go through one call, so a
+    # well-used editor reads as one line, not nine. Every item is still
+    # rechecked before removal, and a running owner stops the whole app.
+    mole_safe_clean_app_cache "Visual Studio Code" \
+        ~/Library/Application\ Support/Code/logs/* \
+        ~/Library/Application\ Support/Code/Cache/* \
+        ~/Library/Application\ Support/Code/CachedExtensionVSIXs/* \
+        ~/Library/Application\ Support/Code/CachedData/* \
+        ~/Library/Application\ Support/Code/WebStorage/*/CacheStorage/* \
+        "VS Code cache"
     safe_clean ~/Library/Caches/com.sublimetext.*/* "Sublime Text cache"
     safe_clean ~/Library/Caches/Zed/* "Zed cache"
     # Zed npm caches: node/cache (system-node scratch) and node/node-v*/cache
     # (per-version managed runtime, see #88); keep editor state under db/ untouched.
-    mole_safe_clean_app_cache "Zed" ~/Library/Application\ Support/Zed/node/cache/* "Zed npm cache"
-    mole_safe_clean_app_cache "Zed" ~/Library/Application\ Support/Zed/node/node-v*/cache/* "Zed npm cache"
+    mole_safe_clean_app_cache "Zed" \
+        ~/Library/Application\ Support/Zed/node/cache/* \
+        ~/Library/Application\ Support/Zed/node/node-v*/cache/* \
+        "Zed npm cache"
     safe_clean ~/Library/Logs/Zed/* "Zed logs"
     clean_editor_obsolete_extensions
     # Shared desktop extension caches have more than one possible owner.
@@ -646,26 +653,30 @@ clean_code_editors() {
     fi
     # CodeBuddy CN (VS Code fork, Electron)
     if [[ -d ~/Library/Application\ Support/CodeBuddy\ CN ]]; then
-        mole_safe_clean_app_cache "CodeBuddy CN" ~/Library/Application\ Support/CodeBuddy\ CN/Cache/* "CodeBuddy CN cache"
-        mole_safe_clean_app_cache "CodeBuddy CN" ~/Library/Application\ Support/CodeBuddy\ CN/CachedData/* "CodeBuddy CN cached data"
-        mole_safe_clean_app_cache "CodeBuddy CN" ~/Library/Application\ Support/CodeBuddy\ CN/CachedExtensionVSIXs/* "CodeBuddy CN extension cache"
-        mole_safe_clean_app_cache "CodeBuddy CN" ~/Library/Application\ Support/CodeBuddy\ CN/Code\ Cache/* "CodeBuddy CN code cache"
-        mole_safe_clean_app_cache "CodeBuddy CN" ~/Library/Application\ Support/CodeBuddy\ CN/GPUCache/* "CodeBuddy CN GPU cache"
-        mole_safe_clean_app_cache "CodeBuddy CN" ~/Library/Application\ Support/CodeBuddy\ CN/DawnGraphiteCache/* "CodeBuddy CN Dawn cache"
-        mole_safe_clean_app_cache "CodeBuddy CN" ~/Library/Application\ Support/CodeBuddy\ CN/DawnWebGPUCache/* "CodeBuddy CN WebGPU cache"
-        mole_safe_clean_app_cache "CodeBuddy CN" ~/Library/Application\ Support/CodeBuddy\ CN/logs/* "CodeBuddy CN logs"
+        mole_safe_clean_app_cache "CodeBuddy CN" \
+            ~/Library/Application\ Support/CodeBuddy\ CN/Cache/* \
+            ~/Library/Application\ Support/CodeBuddy\ CN/CachedData/* \
+            ~/Library/Application\ Support/CodeBuddy\ CN/CachedExtensionVSIXs/* \
+            ~/Library/Application\ Support/CodeBuddy\ CN/Code\ Cache/* \
+            ~/Library/Application\ Support/CodeBuddy\ CN/GPUCache/* \
+            ~/Library/Application\ Support/CodeBuddy\ CN/DawnGraphiteCache/* \
+            ~/Library/Application\ Support/CodeBuddy\ CN/DawnWebGPUCache/* \
+            ~/Library/Application\ Support/CodeBuddy\ CN/logs/* \
+            "CodeBuddy CN cache"
     fi
     # Cursor (VS Code fork, Electron)
     if [[ -d ~/Library/Application\ Support/Cursor ]]; then
-        mole_safe_clean_app_cache "Cursor" ~/Library/Application\ Support/Cursor/Cache/* "Cursor cache"
-        mole_safe_clean_app_cache "Cursor" ~/Library/Application\ Support/Cursor/CachedData/* "Cursor cached data"
-        mole_safe_clean_app_cache "Cursor" ~/Library/Application\ Support/Cursor/CachedExtensionVSIXs/* "Cursor extension cache"
-        mole_safe_clean_app_cache "Cursor" ~/Library/Application\ Support/Cursor/Code\ Cache/* "Cursor code cache"
-        mole_safe_clean_app_cache "Cursor" ~/Library/Application\ Support/Cursor/GPUCache/* "Cursor GPU cache"
-        mole_safe_clean_app_cache "Cursor" ~/Library/Application\ Support/Cursor/DawnGraphiteCache/* "Cursor Dawn cache"
-        mole_safe_clean_app_cache "Cursor" ~/Library/Application\ Support/Cu
```

**File**: `lib/clean/dev.sh` (modified, +40/-45)
```diff
@@ -4696,28 +4696,23 @@ clean_codex_desktop_caches() {
     else
         profiles+=("$cache_root/Default/Partitions/codex-browser-app")
     fi
-    # Every profile and partition shares one row per cache kind, so a Mac
-    # with many MCP sandboxes still reads as two rows, not one per partition.
+    # Every profile and partition shares one row, so a Mac with many MCP
+    # sandboxes still reads as one Codex Desktop line, not one per partition.
     local -a cache_targets=()
-    local -a code_cache_targets=()
     local profile leaf physical_leaf
     for profile in "${profiles[@]}"; do
         for leaf in "Cache" "Code Cache"; do
             physical_leaf=""
             if physical_leaf=$(codex_staging_physical_path "$profile/$leaf" "$cache_root" any); then
                 if mole_cleanup_targets_exist "$physical_leaf"/*; then
-                    if [[ "$leaf" == "Cache" ]]; then
-                        cache_targets+=("$physical_leaf"/*)
-                    else
-                        code_cache_targets+=("$physical_leaf"/*)
-                    fi
+                    cache_targets+=("$physical_leaf"/*)
                 fi
             else
                 debug_log "Codex Desktop cache leaf skipped: $profile/$leaf"
             fi
         done
     done
-    [[ ${#cache_targets[@]} -gt 0 || ${#code_cache_targets[@]} -gt 0 ]] || return 0
+    [[ ${#cache_targets[@]} -gt 0 ]] || return 0
 
     local process_state=0
     codex_desktop_process_state || process_state=$?
@@ -4731,18 +4726,10 @@ clean_codex_desktop_caches() {
         return 0
     fi
 
-    if [[ ${#cache_targets[@]} -gt 0 ]]; then
-        _codex_desktop_safe_clean_guarded \
-            "Codex Desktop caches" \
-            "${cache_targets[@]}" \
-            "Codex Desktop Cache" || return 0
-    fi
-    if [[ ${#code_cache_targets[@]} -gt 0 ]]; then
-        _codex_desktop_safe_clean_guarded \
-            "Codex Desktop caches" \
-            "${code_cache_targets[@]}" \
-            "Codex Desktop Code Cache" || return 0
-    fi
+    _codex_desktop_safe_clean_guarded \
+        "Codex Desktop caches" \
+        "${cache_targets[@]}" \
+        "Codex Desktop cache" || return 0
 }
 
 codex_sparkle_updater_running() {
@@ -6304,43 +6291,51 @@ clean_dev_misc() {
     safe_clean ~/Library/Caches/KSCrash/* "KSCrash reports"
     safe_clean ~/Library/Caches/com.crashlytics.data/* "Crashlytics data"
     if [[ -d ~/Library/Application\ Support/Antigravity ]]; then
-        mole_safe_clean_app_cache "Antigravity" ~/Library/Application\ Support/Antigravity/Cache/* "Antigravity cache"
-        mole_safe_clean_app_cache "Antigravity" ~/Library/Application\ Support/Antigravity/Code\ Cache/* "Antigravity code cache"
-        mole_safe_clean_app_cache "Antigravity" ~/Library/Application\ Support/Antigravity/GPUCache/* "Antigravity GPU cache"
-        mole_safe_clean_app_cache "Antigravity" ~/Library/Application\ Support/Antigravity/DawnGraphiteCache/* "Antigravity Dawn cache"
-        mole_safe_clean_app_cache "Antigravity" ~/Library/Application\ Support/Antigravity/DawnWebGPUCache/* "Antigravity WebGPU cache"
+        mole_safe_clean_app_cache "Antigravity" \
+            ~/Library/Application\ Support/Antigravity/Cache/* \
+            ~/Library/Application\ Support/Antigravity/Code\ Cache/* \
+            ~/Library/Application\ Support/Antigravity/GPUCache/* \
+            ~/Library/Application\ Support/Antigravity/DawnGraphiteCache/* \
+            ~/Library/Application\ Support/Antigravity/DawnWebGPUCache/* \
+            "Antigravity cache"
     fi
     # Antigravity browser profile caches (~/.gemini)
     clean_antigravity_caches
     # agent-browser's superseded Chrome for Testing builds (#1748)
     clean_agent_browser_old_chrome
     # Filo (Electron)
     if [[ -d ~/Library/Application\ Support/Filo ]]; then
-        mole_safe_clean_app_cache "Filo" ~/Library/Application\ Support/Filo/production/Cache/* "Filo cache"
-        mole_safe_clean_app_cache "Filo" ~/Library/Application\ Support/Filo/production/Code\ Cache/* "Filo code cache"
-        mole_safe_clean_app_cache "Filo" ~/Library/Application\ Support/Filo/production/GPUCache/* "Filo GPU cache"
-        mole_safe_clean_app_cache "Filo" ~/Library/Application\ Support/Filo/production/DawnGraphiteCache/* "Filo Dawn cache"
-        mole_safe_clean_app_cache "Filo" ~/Library/Application\ Support/Filo/production/DawnWebGPUCache/* "Filo WebGPU cache"
+        mole_safe_clean_app_cache "Filo" \
+            ~/Library/Application\ Support/Filo/production/Cache/* \
+            ~/Library/Application\ Support/Filo/production/Code\ Cache/* \
+            ~/Library/Application\ Support/Filo/production/GPUCache/* \
+            ~/Library/Application\ Support/Filo/production/DawnGraphiteCache/* \
+            ~/Library/Application\ Support/Filo/production/DawnWebGPUCache/* \
+            "Filo cache"
     fi
     # Claude (Electron)
     if [[ -d ~/Library/Application\ Support/Claude
```

**File**: `tests/clean_ai_cli_caches.bats` (modified, +5/-5)
```diff
@@ -158,7 +158,7 @@ EOF
     assert_output_not_contains "STILL_PRESENT:"
 }
 
-@test "clean_codex_desktop_caches previews one row per cache kind across every partition" {
+@test "clean_codex_desktop_caches previews one row across every profile and partition" {
     run env HOME="$HOME/codex-cache-rows" PROJECT_ROOT="$PROJECT_ROOT" MOLE_TEST_NO_AUTH=1 /bin/bash --noprofile --norc << 'EOF'
 set -euo pipefail
 cache_root="$HOME/Library/Caches/Codex"
@@ -178,15 +178,15 @@ pgrep() { return 1; }
 DRY_RUN=true
 MOLE_DRY_RUN=1
 rows=$(clean_codex_desktop_caches 2>&1)
-printf 'ROWS_CACHE=%s;\n' "$(printf '%s\n' "$rows" | grep -c 'Codex Desktop Cache' || true)"
-printf 'ROWS_CODE_CACHE=%s;\n' "$(printf '%s\n' "$rows" | grep -c 'Codex Desktop Code Cache' || true)"
+printf 'ROWS=%s;\n' "$(printf '%s\n' "$rows" | grep -c 'Codex Desktop' || true)"
+printf 'ITEMS=%s;\n' "$(printf '%s\n' "$rows" | grep -c '10 items' || true)"
 remaining=$(find "$cache_root" -name entry.bin | wc -l | tr -d ' ')
 printf 'REMAINING=%s\n' "$remaining"
 EOF
 
     assert_run_success
-    assert_output_contains "ROWS_CACHE=1;"
-    assert_output_contains "ROWS_CODE_CACHE=1;"
+    assert_output_contains "ROWS=1;"
+    assert_output_contains "ITEMS=1;"
     assert_output_contains "REMAINING=10"
 }
 
```

**File**: `tests/clean_app_caches.bats` (modified, +69/-24)
```diff
@@ -939,14 +939,16 @@ EOF
 set -euo pipefail
 source "$PROJECT_ROOT/lib/core/common.sh"
 source "$PROJECT_ROOT/lib/clean/app_caches.sh"
-safe_clean() { echo "$2"; }
+safe_clean() { echo "${!#}"; }
 pgrep() { return 1; }
 clean_design_tools
 EOF
 
     [ "$status" -eq 0 ]
     [[ "$output" == *"Sketch cache"* ]] || return 1
-    [[ "$output" == *"Figma cache"* ]]
+    [[ "$output" == *"Figma cache"* ]] || return 1
+    # Desktop, agent and profile caches are one Figma row.
+    [[ "$(grep -c '^Figma' <<< "$output")" == 1 ]]
 }
 
 @test "clean_figma_desktop_caches targets all profile cache leaves and preserves state" {
@@ -992,7 +994,7 @@ EOF
     [[ "$output" == *"CLEAN:$pbase/GPUCache/data_0"* ]] || return 1
     [[ "$output" == *"CLEAN:$pbase/DawnGraphiteCache/data_0"* ]] || return 1
     [[ "$output" == *"CLEAN:$pbase/DawnWebGPUCache/data_0"* ]] || return 1
-    [[ "$output" == *"CLEAN:Figma desktop cache"* ]] || return 1
+    [[ "$output" == *"CLEAN:Figma cache"* ]] || return 1
     [[ "$output" != *"Cookies"* ]] || return 1
     [[ "$output" != *"Local Storage"* ]] || return 1
     [[ "$output" != *"IndexedDB"* ]] || return 1
@@ -1251,13 +1253,14 @@ mkdir -p ~/Library/Application\ Support/Microsoft/Teams
 source "$PROJECT_ROOT/lib/core/common.sh"
 source "$PROJECT_ROOT/lib/clean/app_caches.sh"
 pgrep() { return 1; }
-safe_clean() { echo "$2"; }
+safe_clean() { local label="${!#}" target; echo "CALL:$label"; for target in "${@:1:$#-1}"; do echo "CLEAN:$target|$label"; done; }
 clean_communication_apps
 EOF
 
     [ "$status" -eq 0 ]
-    [[ "$output" == *"Microsoft Teams legacy cache"* ]] || return 1
-    [[ "$output" == *"Microsoft Teams legacy logs"* ]]
+    [[ "$output" == *"/Microsoft/Teams/Cache/"*"|Microsoft Teams legacy cache"* ]] || return 1
+    [[ "$output" == *"/Microsoft/Teams/logs/"*"|Microsoft Teams legacy cache"* ]] || return 1
+    [[ "$(grep -c '^CALL:Microsoft Teams legacy' <<< "$output")" == 1 ]]
 }
 
 @test "clean_communication_apps cleans Vesktop session caches only while Vesktop is not running" {
@@ -1818,7 +1821,7 @@ EOF
 set -euo pipefail
 source "$PROJECT_ROOT/lib/core/common.sh"
 source "$PROJECT_ROOT/lib/clean/app_caches.sh"
-safe_clean() { echo "CLEAN:$1|$2"; }
+safe_clean() { local label="${!#}" target; echo "CALL:$label"; for target in "${@:1:$#-1}"; do echo "CLEAN:$target|$label"; done; }
 clean_code_editors
 EOF
 
@@ -1829,6 +1832,8 @@ EOF
     [[ "$output" != *"$HOME/Library/Application Support/Zed/db"* ]] || return 1
     [[ "$output" != *"node-v24.11.0-darwin-arm64/bin"* ]] || return 1
     [[ "$output" == *"Zed logs"* ]] || return 1
+    [[ "$(grep -c '^CALL:Zed npm cache' <<< "$output")" == 1 ]] || return 1
+    [[ "$(grep -c '^CALL:VS Code cache' <<< "$output")" == 1 ]]
 }
 
 @test "clean_code_editors includes VS Code WebStorage CacheStorage only" {
@@ -1841,12 +1846,12 @@ set -euo pipefail
 source "$PROJECT_ROOT/lib/core/common.sh"
 source "$PROJECT_ROOT/lib/clean/app_caches.sh"
 pgrep() { return 1; }
-safe_clean() { echo "CLEAN:$1|$2"; }
+safe_clean() { local label="${!#}" target; echo "CALL:$label"; for target in "${@:1:$#-1}"; do echo "CLEAN:$target|$label"; done; }
 clean_code_editors
 EOF
 
     [ "$status" -eq 0 ]
-    [[ "$output" == *"CLEAN:$HOME/Library/Application Support/Code/WebStorage/29/CacheStorage/uuid-1|VS Code webview cache"* ]] || return 1
+    [[ "$output" == *"CLEAN:$HOME/Library/Application Support/Code/WebStorage/29/CacheStorage/uuid-1|VS Code cache"* ]] || return 1
     [[ "$output" != *"Local Storage"* ]] || return 1
     [[ "$output" != *"QuotaManager"* ]]
 }
@@ -2211,14 +2216,15 @@ EOF
 set -euo pipefail
 source "$PROJECT_ROOT/lib/core/common.sh"
 source "$PROJECT_ROOT/lib/clean/app_caches.sh"
-safe_clean() { echo "$2"; }
+safe_clean() { local label="${!#}" target; echo "CALL:$label"; for target in "${@:1:$#-1}"; do echo "CLEAN:$target|$label"; done; }
 clean_code_editors
 EOF
 
     [ "$status" -eq 0 ]
-    [[ "$output" == *"CodeBuddy CN cache"* ]] || return 1
-    [[ "$output" == *"CodeBuddy CN logs"* ]] || return 1
-    [[ "$output" == *"CodeBuddy CN GPU cache"* ]]
+    [[ "$output" == *"/CodeBuddy CN/Cache/"*"|CodeBuddy CN cache"* ]] || return 1
+    [[ "$output" == *"/CodeBuddy CN/logs/"*"|CodeBuddy CN cache"* ]] || return 1
+    [[ "$output" == *"/CodeBuddy CN/GPUCache/"*"|CodeBuddy CN cache"* ]] || return 1
+    [[ "$(grep -c '^CALL:CodeBuddy CN' <<< "$output")" == 1 ]]
 }
 
 @test "clean_code_editors skips CodeBuddy when directories are absent" {
@@ -2236,27 +2242,66 @@ EOF
     [[ "$output" != *"CodeBuddy"* ]]
 }
 
+@test "Electron app caches clean in one call per app" {
+    local case_home="$HOME/one-call-per-app"
+    local app_support="$case_home/Library/Application Support"
+    mkdir -p "$app_support/vesktop/sessionData/Cache" "$app_support/mihomo-party/Cache" \
+        "$app_support/Antigravity/Cache" "$app_support/Filo/production/Cache" \
+        "$app_support/Claude/Cache" "$app_support/Qoder/Cache"
+
+    run env HOME=
```

---

### Incident Patch 3: `8b1c08d5` (2026-11-23)
**Commit Message**: fix(clean): leave the Figma cache to its process-guarded row

clean_dev_misc also cleaned ~/Library/Caches/com.figma.Desktop/* with a
plain safe_clean. Developer tools run before GUI apps in bin/clean.sh, so
that copy cleared the cache while Figma ran, ahead of the Figma process
check that clean_figma_desktop_caches applies to the same folder.

Remove the duplicate; clean_design_tools still cleans it, deferring while
Figma runs. No release shipped the guarded copy, so the behaviour every
released version had (cleaned while running) ends here.

Verified: the new clean_dev_misc case fails with the line present and
passes without it; the full MOLE_TEST_NO_AUTH=1 ./scripts/test.sh and
check.sh --no-format pass.

Rollback: git revert this commit.

**File**: `lib/clean/dev.sh` (modified, +0/-1)
```diff
@@ -6299,7 +6299,6 @@ clean_agent_browser_old_chrome() {
 clean_dev_misc() {
     safe_clean ~/Library/Caches/com.unity3d.*/* "Unity cache"
     safe_clean ~/Library/Caches/com.mongodb.compass/* "MongoDB Compass cache"
-    safe_clean ~/Library/Caches/com.figma.Desktop/* "Figma cache"
     safe_clean ~/Library/Caches/com.github.GitHubDesktop/* "GitHub Desktop cache"
     safe_clean ~/Library/Caches/SentryCrash/* "Sentry crash reports"
     safe_clean ~/Library/Caches/KSCrash/* "KSCrash reports"
```

**File**: `tests/clean_ai_cli_caches.bats` (modified, +27/-0)
```diff
@@ -841,6 +841,33 @@ EOF
     assert_output_contains "ANTIGRAVITY_CALLED"
 }
 
+@test "clean_dev_misc leaves the Figma cache to the guarded design tools row" {
+    mkdir -p "$HOME/Library/Caches/com.figma.Desktop"
+    touch "$HOME/Library/Caches/com.figma.Desktop/cache.bin"
+    run env HOME="$HOME" PROJECT_ROOT="$PROJECT_ROOT" /bin/bash --noprofile --norc << 'EOF'
+set -euo pipefail
+source "$PROJECT_ROOT/lib/core/common.sh"
+source "$PROJECT_ROOT/lib/clean/dev.sh"
+safe_clean() { printf 'CLEAN:%s\n' "$@"; }
+safe_find_delete() { :; }
+clean_service_worker_cache() { :; }
+clean_codex_runtimes() { :; }
+clean_codex_desktop_staging() { :; }
+clean_codex_desktop_caches() { :; }
+note_activity() { :; }
+clean_codex_cli() { :; }
+clean_antigravity_caches() { :; }
+clean_dev_misc
+echo "DEV_MISC_DONE"
+EOF
+
+    assert_run_success
+    assert_output_contains "DEV_MISC_DONE"
+    # Developer tools run before GUI apps, so an unguarded copy here would
+    # clear the cache while Figma runs, ahead of the process check.
+    assert_output_not_contains "com.figma.Desktop"
+}
+
 @test "clean_dev_ai_agents reaps stale Claude Desktop bundled versions when active version is known" {
     local claude_support="$HOME/Library/Application Support/Claude"
     mkdir -p "$claude_support/claude-code/2.1.140" "$claude_support/claude-code/2.1.142" "$claude_support/claude-code/2.1.150"
```

#### Recent Merged Pull Requests:
- **PR #2100** (2026-11-24): chore(deps): bump the github-actions group with 4 updates (@dependabot[bot])
- **PR #2099** (2026-11-24): chore(deps): bump github.com/charmbracelet/x/ansi from 0.11.9 to 0.11.10 (@dependabot[bot])
- **PR #2098** (closed): fix(clean): count and report privileged system sweeps in run totals (@Yuxin-Qiao)
- **PR #2097** (2026-11-24): fix(clean): keep kubectl credential plugin caches in ~/.kube/cache (@viniciusdsandrade)
- **PR #2095** (2026-11-24): fix(clean): leave a running Chromium browser's cache out of the user cache sweep (@viniciusdsandrade)
- **PR #2093** (2026-11-24): fix(clean): count the System section's privileged sweeps in the run total (@viniciusdsandrade)

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

## X. clean): show and count the aged log sweeps in preview and real runs

**RULE**:
When implementing operations in `.claude/rules/core.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in tw93/Mole. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `fae04a5a`: clean): show and count the aged log sweeps in preview and real runs. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Shell data structures, boundary deserialization, API parsing, or resource lifecycles matching `.claude/rules/core.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```shell
// Verified production-grade fix pattern:
- A clean sweep through `safe_find_delete` passes its fifth argument, a row label: with one, the completed matches go through `safe_clean`, so the preview and a real run both show the row and count it in the total. Without a label no row is shown, the preview still adds the matches to Potential space and a real run removes them without counting them, so the preview promised bytes the real run never reported (the Cursor Agent worker logs, 61 MB on the maintainer's Mac, 2026-11-23). Locked by `a labeled safe_find_delete shows one row and counts it in the preview and a real run` in `tests/core_safe_functions.bats`.
```

**NEGATIVE CONSTRAINT**:
```shell
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `fae04a5a` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
