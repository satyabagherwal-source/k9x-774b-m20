# Agent Contract: Agent Contract: tw93-mole-learnings Autonomous Specialist Persona

<!-- PROVENANCE_START
{
  "source_repository": "tw93-mole-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-18T07:14:16.583Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-tw93-mole-learnings",
  "canonical_classification": "agent_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [tw93-mole-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-18T07:14:16.583Z`  
> **Learning ID**: `LEARN-EVO-tw93-mole-learnings`


## 1. Agent Role & Persona Contract
- **Role Identifier**: `tw93-mole-learnings-specialist`
- **Governing Capability**: Autonomous execution and domain-specialized problem resolution.
- **Trust Boundary**: Reads and modifies only authorized workspace resources.

## 2. Operational Capabilities
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/tw93-mole-learnings.md`  
> **Source**: github ([https://github.com/tw93/Mole](https://github.com/tw93/Mole))  
> **Source Version**: `a381d561`  
> **License**: GPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-18T07:14:02.515Z  
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
> **Harvest Timestamp**: 2026-11-18T07:14:02.509Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tw93/Mole`
- **Description**: 🐹 Open-source Mac and PC cleaner. Keep your machine clean, light, and running like new. Fast CLI, plus native Mac and Windows apps.
- **Primary Language / Ecosystem**: Shell
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 75432 stars

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

### Incident Patch 1: `97f66d63` (2026-11-15)
**Commit Message**: fix(optimize): keep task probe and removal timeouts scoped to each task (#2004)

* fix(optimize): keep task probe and removal timeouts scoped to each task

Several optimize task handlers in lib/optimize/tasks.sh still returned timeout status 124 via mole_rc_timeout_or_signal, aborting execute_optimization before optimize_task_finish and stopping bin/optimize.sh before remaining optimize tasks ran.

Keep 124 timeouts local to opt_existing_path_size_kb, opt_cache_refresh, opt_saved_state_cleanup, opt_launch_agents_cleanup, and opt_shared_file_list_repair so each task records its outcome (failed on timed-out scan/removal/probe, or size 0 on timed-out size probe) and subsequent tasks still execute, while continuing to propagate real OS signals checked with mole_rc_signal.

* fix(optimize): keep removal timeouts cancelling and add no new output

Probe, scan and plist-read timeouts stay scoped to their task as the original commit made them. A removal that times out still stops the run, the same contract every Mole removal sink follows, and timeouts are counted through the existing failure lines and the summary's failed count instead of four new warning lines (AGENTS.md keeps per-item tim

**File**: `lib/optimize/tasks.sh` (modified, +51/-27)
```diff
@@ -53,7 +53,7 @@ opt_existing_path_size_kb() {
     local size_kb=0
     local size_rc=0
     size_kb=$(get_path_size_kb "$path" 2> /dev/null) || size_rc=$?
-    mole_rc_timeout_or_signal "$size_rc" && return "$size_rc"
+    mole_rc_signal "$size_rc" && return "$size_rc"
     [[ $size_rc -eq 0 ]] || size_kb=0
     opt_numeric_kb "$size_kb"
 }
@@ -253,7 +253,7 @@ opt_cache_refresh() {
         local size_kb=0
         local size_rc=0
         size_kb=$(opt_existing_path_size_kb "$target_path") || size_rc=$?
-        mole_rc_timeout_or_signal "$size_rc" && return "$size_rc"
+        mole_rc_signal "$size_rc" && return "$size_rc"
         [[ $size_rc -eq 0 ]] || size_kb=0
         removable_targets+=("$target_path")
         removable_sizes+=("$size_kb")
@@ -341,7 +341,8 @@ opt_saved_state_cleanup() {
             > "$scan_file" 2> /dev/null || scan_rc=$?
         if [[ $scan_rc -ne 0 ]]; then
             : > "$scan_file" || true
-            mole_rc_timeout_or_signal "$scan_rc" && return "$scan_rc"
+            # A scan timeout fails only this task; a signal still cancels.
+            mole_rc_signal "$scan_rc" && return "$scan_rc"
             echo -e "  ${YELLOW}${ICON_WARNING}${NC} Failed to scan old saved states"
             scan_failed=1
         fi
@@ -1242,6 +1243,7 @@ opt_launch_agents_cleanup() {
     fi
 
     local broken_count=0
+    local timed_out_count=0
 
     for plist in "$agents_dir"/*.plist; do
         [[ -f "$plist" ]] || continue
@@ -1251,13 +1253,21 @@ opt_launch_agents_cleanup() {
         binary=$(run_with_timeout "$MOLE_TIMEOUT_QUICK_DETECT_SEC" \
             /usr/libexec/PlistBuddy -c "Print :Program" \
             "$plist" 2> /dev/null) || plist_rc=$?
-        mole_rc_timeout_or_signal "$plist_rc" && return "$plist_rc"
+        mole_rc_signal "$plist_rc" && return "$plist_rc"
+        if mole_rc_timeout "$plist_rc"; then
+            timed_out_count=$((timed_out_count + 1))
+            continue
+        fi
         if [[ -z "$binary" ]]; then
             plist_rc=0
             binary=$(run_with_timeout "$MOLE_TIMEOUT_QUICK_DETECT_SEC" \
                 /usr/libexec/PlistBuddy -c "Print :ProgramArguments:0" \
                 "$plist" 2> /dev/null) || plist_rc=$?
-            mole_rc_timeout_or_signal "$plist_rc" && return "$plist_rc"
+            mole_rc_signal "$plist_rc" && return "$plist_rc"
+            if mole_rc_timeout "$plist_rc"; then
+                timed_out_count=$((timed_out_count + 1))
+                continue
+            fi
         fi
 
         # Only an absolute path that is genuinely missing counts as broken.
@@ -1271,7 +1281,7 @@ opt_launch_agents_cleanup() {
             label=$(run_with_timeout "$MOLE_TIMEOUT_QUICK_DETECT_SEC" \
                 /usr/libexec/PlistBuddy -c "Print :Label" \
                 "$plist" 2> /dev/null) || plist_rc=$?
-            mole_rc_timeout_or_signal "$plist_rc" && return "$plist_rc"
+            mole_rc_signal "$plist_rc" && return "$plist_rc"
             [[ -n "$label" ]] || label="$(basename "$plist" .plist)"
             # Label and Program come from a third-party plist, so escape
             # sequences in them must not reach the terminal.
@@ -1281,13 +1291,21 @@ opt_launch_agents_cleanup() {
         fi
     done
 
-    if [[ $broken_count -eq 0 ]]; then
+    # A plist that could not be read in time is unknown: it is never called
+    # healthy, and the task counts as failed in the summary line.
+    if [[ $broken_count -eq 0 && $timed_out_count -eq 0 ]]; then
         opt_msg "Launch Agents all healthy"
         optimize_task_result "$MOLE_OPTIMIZE_OUTCOME_UNCHANGED"
         return 0
     fi
 
-    echo -e "  ${YELLOW}${ICON_WARNING}${NC} $broken_count Launch Agent(s) point at a missing program · left in ~/Library/LaunchAgents"
+    if [[ $broken_count -gt 0 ]]; then
+        echo -e "  ${YELLOW}${ICON_WARNING}${NC} $broken_count Launch Agent(s) point at a missing program · left in ~/Library/LaunchAgents"
+    fi
+    if [[ $timed_out_count -gt 0 ]]; then
+        optimize_task_result "$MOLE_OPTIMIZE_OUTCOME_FAILED"
+        return 0
+    fi
     optimize_task_result "$MOLE_OPTIMIZE_OUTCOME_ATTENTION"
 }
 
@@ -1371,27 +1389,33 @@ opt_shared_file_list_repair() {
         > "$scan_file" 2> "${scan_err_file:-/dev/null}" || scan_rc=$?
     if [[ $scan_rc -ne 0 ]]; then
         : > "$scan_file" || true
-        mole_rc_timeout_or_signal "$scan_rc" && return "$scan_rc"
-        # Permission-only errors make the scan unavailable. Mixed errors or
-        # an unreadable diagnostic keep the ordinary failed outcome.
-        local permission_only=false
-        if [[ -n "$scan_err_file" && -s "$scan_err_file" ]]; then
-            local permission_pattern='(Permission denied|Operation not permitted)( \(os error [0-9]+\))?\.?$'
-            local permission_scan_rc=0
-            grep -Ev -e "$permission_pattern" -e '^$' "$scan_err_file" \
-                > /dev/null || permission_scan_rc=$?
-            if [[ $per
```

**File**: `tests/optimize_probe_outcomes.bats` (modified, +138/-0)
```diff
@@ -563,3 +563,141 @@ EOF
 
 	[[ "$status" -eq 0 ]] || { echo "$output"; return 1; }
 }
+
+@test "cache refresh sizing timeouts finish the run while removal timeouts and signals still cancel" {
+	run env HOME="$TEST_HOME/cache-timeout" PROJECT_ROOT="$PROJECT_ROOT" /bin/bash --noprofile --norc <<'EOF'
+set -euo pipefail
+source "$PROJECT_ROOT/lib/core/common.sh"
+source "$PROJECT_ROOT/lib/optimize/tasks.sh"
+
+mkdir -p "$HOME/Library/Caches/com.apple.QuickLook.thumbnailcache" "$HOME/Library/Caches/com.apple.iconservices"
+touch "$HOME/Library/Caches/com.apple.QuickLook.thumbnailcache/test.db" "$HOME/Library/Caches/com.apple.iconservices/item"
+
+qlmanage() { return 0; }
+should_protect_path() { return 1; }
+get_path_size_kb() { return 124; }
+safe_remove() { printf '%s\n' "$1" >> "$HOME/remove.trace"; return 0; }
+
+# A size probe that times out is unknown: the targets are still refreshed and
+# the next task runs.
+execute_optimization cache_refresh
+execute_optimization saved_state_cleanup
+[[ "$(optimize_outcome_total)" == "2" ]] || exit 1
+[[ "$(optimize_outcome_count failed)" == "0" ]] || exit 1
+[[ "${OPTIMIZE_CACHE_CLEANED_KB:-missing}" == "0" ]] || exit 1
+[[ "$(wc -l < "$HOME/remove.trace" | tr -d ' ')" == "2" ]] || exit 1
+
+# A removal that times out stops the run, as every removal sink does.
+for removal_rc in 124 130; do
+    optimize_outcomes_reset
+    mkdir -p "$HOME/Library/Caches/com.apple.QuickLook.thumbnailcache"
+    touch "$HOME/Library/Caches/com.apple.QuickLook.thumbnailcache/test.db"
+    eval "safe_remove() { return $removal_rc; }"
+    optimize_task_start
+    rc=0
+    opt_cache_refresh || rc=$?
+    [[ "$rc" -eq "$removal_rc" ]] || exit 1
+done
+EOF
+
+	[[ "$status" -eq 0 ]] || { echo "$output"; return 1; }
+	[[ "$output" == *"App saved states optimized"* ]] || return 1
+	[[ "$output" != *"imed out"* ]]
+}
+
+@test "saved state and shared file list scan timeouts fail only their task without a new message" {
+	run env HOME="$TEST_HOME/scan-remove-timeout" PROJECT_ROOT="$PROJECT_ROOT" /bin/bash --noprofile --norc <<'EOF'
+set -euo pipefail
+source "$PROJECT_ROOT/lib/core/common.sh"
+source "$PROJECT_ROOT/lib/optimize/tasks.sh"
+
+saved="$HOME/Library/Saved Application State/Slow.savedState"
+corrupt_sfl="$HOME/Library/Application Support/com.apple.sharedfilelist/Slow.sfl3"
+mkdir -p "$saved" "${corrupt_sfl%/*}"
+touch "$corrupt_sfl"
+should_protect_path() { return 1; }
+plutil() { return 1; }
+
+run_with_timeout() { return 124; }
+execute_optimization saved_state_cleanup
+execute_optimization shared_file_list_repair
+execute_optimization launch_agents_cleanup
+[[ "$(optimize_outcome_total)" == "3" ]] || exit 1
+[[ "$(optimize_outcome_count failed)" == "2" ]] || exit 1
+[[ "$(optimize_outcome_count unchanged)" == "1" ]] || exit 1
+
+run_with_timeout() {
+    shift
+    case "$*" in
+        *"Saved Application State"*) printf '%s\0' "$saved" ;;
+        *) printf '%s\0' "$corrupt_sfl" ;;
+    esac
+}
+for removal_rc in 124 130; do
+    optimize_outcomes_reset
+    eval "safe_remove() { return $removal_rc; }"
+    optimize_task_start
+    rc=0
+    opt_shared_file_list_repair || rc=$?
+    [[ "$rc" -eq "$removal_rc" ]] || exit 1
+done
+EOF
+
+	[[ "$status" -eq 0 ]] || { echo "$output"; return 1; }
+	[[ "$output" == *"Failed to scan old saved states"* ]] || return 1
+	[[ "$output" == *"Failed to scan shared file lists"* ]] || return 1
+	[[ "$output" == *"Launch Agents all healthy"* ]] || return 1
+	[[ "$output" != *"App saved states optimized"* ]] || return 1
+	[[ "$output" != *"Shared file lists all healthy"* ]] || return 1
+	[[ "$output" != *"imed out"* ]]
+}
+
+@test "launch agents cleanup counts a timed-out plist as failed, finishes the run, and propagates signals" {
+	run env HOME="$TEST_HOME/launch-agents-timeout" PROJECT_ROOT="$PROJECT_ROOT" /bin/bash --noprofile --norc <<'EOF'
+set -euo pipefail
+source "$PROJECT_ROOT/lib/core/common.sh"
+source "$PROJECT_ROOT/lib/optimize/tasks.sh"
+
+agents_dir="$HOME/Library/LaunchAgents"
+mkdir -p "$agents_dir"
+touch "$agents_dir/com.test.slow.plist" "$agents_dir/com.test.broken.plist"
+
+run_with_timeout() {
+    if [[ "$*" == *"com.test.slow.plist"* ]]; then
+        printf '%s\n' "$*" >> "$HOME/slow-calls.trace"
+        return 124
+    fi
+    case "$*" in
+        *"Print :ProgramArguments:0"*) return 1 ;;
+        *"Print :Program"*) printf '/nonexistent/missing_agent_binary\n' ;;
+        *"Print :Label"*) printf 'com.test.broken\n' ;;
+    esac
+}
+
+execute_optimization launch_agents_cleanup
+execute_optimization saved_state_cleanup
+[[ "$(optimize_outcome_total)" == "2" ]] || exit 1
+[[ "$(optimize_outcome_count failed)" == "1" ]] || exit 1
+[[ "$(optimize_outcome_count unchanged)" == "1" ]] || exit 1
+[[ "$(wc -l < "$HOME/slow-calls.trace" | tr -d ' ')" == "1" ]] || exit 1
+
+# Only the slow plist left: never reported healthy, still failed.
+rm "$agents_dir/com.test.broken.plist"
+optimize_outcomes_reset
+execute_optimization l
```

---

### Incident Patch 2: `fa6bbea9` (2026-11-15)
**Commit Message**: fix(clean): keep per-item and Tart sizing failures from cancelling clean (#1998)

* fix(clean): keep per-item and Tart sizing failures from cancelling clean

* fix(clean): keep Python cache timeout gate intact and stabilize pasteboard test

* fix(clean): print no size on the Tart dry-run row when sizing fails

A failed measurement shows no size on the other dry-run rows (dev.sh would-clean rows), so the Tart row drops the new '(size unknown)' suffix instead of introducing a second convention. Verified with the Tart cases in tests/clean_misc.bats; the new negative assertion fails with the suffix restored.

---------

Co-authored-by: Tw93 <[REDACTED_EMAIL]>

**File**: `lib/clean/user.sh` (modified, +62/-39)
```diff
@@ -713,10 +713,11 @@ _clean_chromium_old_versions() {
             fi
             local size_kb=""
             local size_rc=0
-            size_kb=$(get_path_size_kb "$dir") || size_rc=$?
-            [[ $size_rc -eq 0 ]] || _mole_record_clean_cancellation "$size_rc"
-            [[ $size_rc -eq 0 ]] || return "$size_rc"
-            size_kb="${size_kb:-0}"
+            size_kb=$(get_path_size_kb "$dir" "" readable 2> /dev/null) || size_rc=$?
+            mole_item_size_continues "$size_rc" || return $?
+            local size_known=true
+            [[ $size_rc -eq 0 && "$size_kb" =~ ^[0-9]+$ ]] || size_kb=0
+            mole_rc_timeout "$size_rc" && size_known=false
             process_state=0
             "$running_probe" || process_state=$?
             if [[ $process_state -ne 1 ]]; then
@@ -727,7 +728,7 @@ _clean_chromium_old_versions() {
 
             if [[ "$DRY_RUN" == "true" ]]; then
                 if declare -f record_dry_run_cleanup_target > /dev/null 2>&1; then
-                    record_dry_run_cleanup_target "$dir" "$size_kb" 1 true || continue
+                    record_dry_run_cleanup_target "$dir" "$size_kb" 1 "$size_known" || continue
                 fi
                 total_size=$((total_size + size_kb))
                 cleaned_count=$((cleaned_count + 1))
@@ -995,10 +996,11 @@ clean_edge_updater_old_versions() {
     for dir in "${cleanable_dirs[@]}"; do
         local size_kb=""
         local size_rc=0
-        size_kb=$(get_path_size_kb "$dir") || size_rc=$?
-        [[ $size_rc -eq 0 ]] || _mole_record_clean_cancellation "$size_rc"
-        [[ $size_rc -eq 0 ]] || return "$size_rc"
-        size_kb="${size_kb:-0}"
+        size_kb=$(get_path_size_kb "$dir" "" readable 2> /dev/null) || size_rc=$?
+        mole_item_size_continues "$size_rc" || return $?
+        local size_known=true
+        [[ $size_rc -eq 0 && "$size_kb" =~ ^[0-9]+$ ]] || size_kb=0
+        mole_rc_timeout "$size_rc" && size_known=false
         process_state=0
         is_microsoft_edge_running || process_state=$?
         if [[ $process_state -ne 1 ]]; then
@@ -1008,7 +1010,7 @@ clean_edge_updater_old_versions() {
         fi
         if [[ "$DRY_RUN" == "true" ]]; then
             if declare -f record_dry_run_cleanup_target > /dev/null 2>&1; then
-                record_dry_run_cleanup_target "$dir" "$size_kb" 1 true || continue
+                record_dry_run_cleanup_target "$dir" "$size_kb" 1 "$size_known" || continue
             fi
             total_size=$((total_size + size_kb))
             cleaned_count=$((cleaned_count + 1))
@@ -1429,19 +1431,20 @@ clean_handoff_pasteboard_cache() {
         fi
         local item_kb=""
         local size_rc=0
-        item_kb=$(get_path_size_kb "$item" 2> /dev/null) || size_rc=$?
-        [[ $size_rc -eq 0 ]] || _mole_record_clean_cancellation "$size_rc"
-        [[ $size_rc -eq 0 ]] || return "$size_rc"
-        [[ "$item_kb" =~ ^[0-9]+$ ]] || item_kb=0
+        item_kb=$(get_path_size_kb "$item" "" readable 2> /dev/null) || size_rc=$?
+        mole_item_size_continues "$size_rc" || return $?
+        local size_known=true
+        [[ $size_rc -eq 0 && "$item_kb" =~ ^[0-9]+$ ]] || item_kb=0
+        mole_rc_timeout "$size_rc" && size_known=false
         if [[ "$DRY_RUN" == "true" ]]; then
             if declare -f record_dry_run_cleanup_target > /dev/null 2>&1; then
-                record_dry_run_cleanup_target "$item" "$item_kb" 1 true || continue
+                record_dry_run_cleanup_target "$item" "$item_kb" 1 "$size_known" || continue
             fi
             cleaned_count=$((cleaned_count + 1))
             total_kb=$((total_kb + item_kb))
             continue
         fi
-        if safe_remove "$item" true 2> /dev/null; then
+        if safe_remove "$item" true "$item_kb" 2> /dev/null; then
             cleaned_count=$((cleaned_count + 1))
             total_kb=$((total_kb + item_kb))
         fi
@@ -2498,13 +2501,16 @@ clean_tart_caches() {
     [[ -d "$cache_root" ]] || return 0
     command -v tart > /dev/null 2>&1 || return 0
 
-    local cache_size_kb=0
+    local cache_size_kb=""
     local size_rc=0
-    cache_size_kb=$(get_path_size_kb "$cache_root" 2> /dev/null) || size_rc=$?
-    [[ $size_rc -eq 0 ]] || _mole_record_clean_cancellation "$size_rc"
-    [[ $size_rc -eq 0 ]] || return "$size_rc"
-    [[ "$cache_size_kb" =~ ^[0-9]+$ ]] || cache_size_kb=0
-    [[ "$cache_size_kb" -gt 0 ]] || return 0
+    cache_size_kb=$(get_path_size_kb "$cache_root" "" readable 2> /dev/null) || size_rc=$?
+    if [[ $size_rc -eq 0 ]]; then
+        [[ "$cache_size_kb" =~ ^[0-9]+$ ]] || cache_size_kb=0
+        [[ "$cache_size_kb" -gt 0 ]] || return 0
+    else
+        mole_item_size_continues "$size_rc" || return $?
+        cache_size_kb=""
+    fi
 
     if is_path_whitelisted "$cache_root"; then
         if [[ "${DRY_RUN:-false}" == "true" ]]; then
@@ -2528,10 +2534,14 @@ clean_tart_caches() {
         return 0
     fi
 
-    local cache_size
```

**File**: `tests/clean_browser_versions.bats` (modified, +68/-0)
```diff
@@ -852,3 +852,71 @@ EOF
     [[ "$output" == *"BROWSER_RC:124 CANCEL:124"* ]] || return 1
     [[ "$output" != *"UNEXPECTED_EDGE_CLEAN"* ]]
 }
+
+@test "old browser and updater cleanup continues on non-signal size failure and stops on signal" {
+    local target size_rc case_home want_timeouts want_known
+    for target in chrome edge_updater; do
+        for size_rc in 1 124 130; do
+            case_home="$BATS_TEST_TMPDIR/browser-size-$target-$size_rc"
+            mkdir -p "$case_home"
+
+            run env HOME="$case_home" PROJECT_ROOT="$PROJECT_ROOT" TARGET="$target" SIZE_RC="$size_rc" \
+                DRY_RUN=true MOLE_CURRENT_COMMAND=clean MOLE_CLEAN_CANCEL_STATUS=0 MOLE_CLEAN_SIZING_TIMEOUTS=0 \
+                /bin/bash --noprofile --norc << 'EOF'
+set -euo pipefail
+source "$PROJECT_ROOT/lib/core/common.sh"
+source "$PROJECT_ROOT/lib/clean/user.sh"
+pgrep() { return 1; }
+plutil() { return 1; }
+is_path_whitelisted() { return 1; }
+note_activity() { :; }
+debug_log() { :; }
+get_path_size_kb() {
+    if [[ "$1" == *"117.0"* ]]; then
+        return "$SIZE_RC"
+    fi
+    echo 10
+}
+record_dry_run_cleanup_target() {
+    printf '%s|%s\n' "$1" "$4" >> "$HOME/preview"
+}
+files_cleaned=0
+total_size_cleaned=0
+total_items=0
+rc=0
+if [[ "$TARGET" == "chrome" ]]; then
+    versions_dir="$HOME/Applications/Google Chrome.app/Contents/Frameworks/Google Chrome Framework.framework/Versions"
+    mkdir -p "$versions_dir/117.0" "$versions_dir/118.0" "$versions_dir/119.0"
+    ln -s "119.0" "$versions_dir/Current"
+    touch -t 202401010000 "$versions_dir/117.0" "$versions_dir/118.0"
+    touch -t 202402010000 "$versions_dir/119.0"
+    export MOLE_CHROME_APP_PATHS="$HOME/Applications/Google Chrome.app"
+    clean_chrome_old_versions || rc=$?
+else
+    updater_dir="$HOME/Library/Application Support/Microsoft/EdgeUpdater/apps/msedge-stable"
+    mkdir -p "$updater_dir/117.0" "$updater_dir/118.0" "$updater_dir/119.0"
+    clean_edge_updater_old_versions || rc=$?
+fi
+printf 'RC=%s CANCEL=%s TIMEOUTS=%s CLEANED=%s\n' "$rc" "${MOLE_CLEAN_CANCEL_STATUS:-0}" "${MOLE_CLEAN_SIZING_TIMEOUTS:-0}" "$files_cleaned"
+EOF
+
+            [ "$status" -eq 0 ] || { echo "$target/$size_rc: $output"; return 1; }
+            if [[ "$size_rc" -eq 130 ]]; then
+                [[ "$output" == *"RC=130 CANCEL=130"* ]] || { echo "$output"; return 1; }
+                [[ "$output" == *"CLEANED=0"* ]] || { echo "$output"; return 1; }
+                [ ! -e "$case_home/preview" ] || return 1
+            else
+                want_timeouts=0
+                want_known=true
+                if [[ "$size_rc" -eq 124 ]]; then
+                    want_timeouts=1
+                    want_known=false
+                fi
+                [[ "$output" == *"RC=0 CANCEL=0 TIMEOUTS=$want_timeouts"* ]] || { echo "$output"; return 1; }
+                [[ "$output" == *"CLEANED=2"* ]] || { echo "$output"; return 1; }
+                grep -q "117.0|$want_known$" "$case_home/preview" || return 1
+                grep -q "118.0|true$" "$case_home/preview" || return 1
+            fi
+        done
+    done
+}
```

**File**: `tests/clean_cached_device_firmware.bats` (modified, +67/-0)
```diff
@@ -486,3 +486,70 @@ clean_cached_device_firmware
 EOF
     [ "$status" -eq 0 ]
 }
+
+@test "clean_cached_device_firmware continues on non-signal size failure and stops on signal" {
+    local size_rc mode case_home want_timeouts want_known
+    for size_rc in 1 124 130; do
+        for mode in dry real; do
+            case_home="$BATS_TEST_TMPDIR/fw-size-$size_rc-$mode"
+            mkdir -p "$case_home/Library/iTunes/iPhone Software Updates" "$case_home/Library/iTunes/Apple TV Software Updates"
+            printf firmware > "$case_home/Library/iTunes/iPhone Software Updates/first.ipsw"
+            printf firmware > "$case_home/Library/iTunes/Apple TV Software Updates/later.ipsw"
+
+            run env HOME="$case_home" PROJECT_ROOT="$PROJECT_ROOT" SIZE_RC="$size_rc" MODE="$mode" \
+                MOLE_CURRENT_COMMAND=clean MOLE_CLEAN_CANCEL_STATUS=0 MOLE_CLEAN_SIZING_TIMEOUTS=0 \
+                /bin/bash --noprofile --norc << 'EOF'
+set -euo pipefail
+source "$PROJECT_ROOT/lib/core/common.sh"
+source "$PROJECT_ROOT/lib/clean/user.sh"
+if [[ "$MODE" == "dry" ]]; then
+    DRY_RUN=true
+else
+    DRY_RUN=false
+fi
+note_activity() { :; }
+is_path_whitelisted() { return 1; }
+_mole_paths_have_open_handle() { return 1; }
+get_path_size_kb() {
+    if [[ "$1" == *"first.ipsw" ]]; then
+        return "$SIZE_RC"
+    fi
+    echo 10
+}
+record_dry_run_cleanup_target() {
+    printf '%s|%s\n' "$1" "$4" >> "$HOME/preview"
+}
+files_cleaned=0
+total_size_cleaned=0
+total_items=0
+rc=0
+clean_cached_device_firmware || rc=$?
+printf 'RC=%s CANCEL=%s TIMEOUTS=%s CLEANED=%s\n' "$rc" "${MOLE_CLEAN_CANCEL_STATUS:-0}" "${MOLE_CLEAN_SIZING_TIMEOUTS:-0}" "$files_cleaned"
+EOF
+
+            [ "$status" -eq 0 ] || { echo "$size_rc/$mode: $output"; return 1; }
+            if [[ "$size_rc" -eq 130 ]]; then
+                [[ "$output" == *"RC=130 CANCEL=130"* ]] || { echo "$output"; return 1; }
+                [[ "$output" == *"CLEANED=0"* ]] || { echo "$output"; return 1; }
+                [ ! -e "$case_home/preview" ] || return 1
+                [ -f "$case_home/Library/iTunes/iPhone Software Updates/first.ipsw" ] || return 1
+                [ -f "$case_home/Library/iTunes/Apple TV Software Updates/later.ipsw" ] || return 1
+            else
+                want_timeouts=0
+                want_known=true
+                if [[ "$size_rc" -eq 124 ]]; then
+                    want_timeouts=1
+                    want_known=false
+                fi
+                [[ "$output" == *"RC=0 CANCEL=0 TIMEOUTS=$want_timeouts"* ]] || { echo "$output"; return 1; }
+                if [[ "$mode" == "dry" ]]; then
+                    grep -Fxq "$case_home/Library/iTunes/iPhone Software Updates/first.ipsw|$want_known" "$case_home/preview" || return 1
+                    grep -Fxq "$case_home/Library/iTunes/Apple TV Software Updates/later.ipsw|true" "$case_home/preview" || return 1
+                else
+                    [ ! -e "$case_home/Library/iTunes/iPhone Software Updates/first.ipsw" ] || return 1
+                    [ ! -e "$case_home/Library/iTunes/Apple TV Software Updates/later.ipsw" ] || return 1
+                fi
+            fi
+        done
+    done
+}
```

**File**: `tests/clean_misc.bats` (modified, +68/-0)
```diff
@@ -338,6 +338,74 @@ EOF
     [ -z "$output" ] || return 1
 }
 
+@test "clean_tart_caches tolerates non-signal size failures before and after prune" {
+    local phase size_rc case_home want_timeouts
+    for size_rc in 1 124 130; do
+        for phase in dry pre post; do
+            case_home="$BATS_TEST_TMPDIR/tart-$phase-$size_rc"
+            mkdir -p "$case_home/.tart/cache/OCIs"
+
+            run env HOME="$case_home" PROJECT_ROOT="$PROJECT_ROOT" PHASE="$phase" SIZE_RC="$size_rc" \
+                MOLE_CURRENT_COMMAND=clean MOLE_CLEAN_CANCEL_STATUS=0 MOLE_CLEAN_SIZING_TIMEOUTS=0 \
+                /bin/bash --noprofile --norc << 'EOF'
+set -euo pipefail
+source "$PROJECT_ROOT/lib/core/common.sh"
+source "$PROJECT_ROOT/lib/clean/user.sh"
+if [[ "$PHASE" == "dry" ]]; then
+    DRY_RUN=true
+else
+    DRY_RUN=false
+fi
+start_section_spinner() { :; }
+stop_section_spinner() { :; }
+note_activity() { :; }
+debug_log() { :; }
+pgrep() { return 1; }
+is_path_whitelisted() { return 1; }
+bytes_to_human() { echo "4MB"; }
+run_with_timeout() { shift; "$@"; }
+tart() { : > "$HOME/tart-called"; return 0; }
+get_path_size_kb() {
+    if [[ "$PHASE" == "post" && ! -e "$HOME/tart-called" ]]; then
+        echo 4096
+        return 0
+    fi
+    return "$SIZE_RC"
+}
+rc=0
+clean_tart_caches || rc=$?
+printf 'RC=%s CANCEL=%s TIMEOUTS=%s\n' "$rc" "${MOLE_CLEAN_CANCEL_STATUS:-0}" "${MOLE_CLEAN_SIZING_TIMEOUTS:-0}"
+EOF
+
+            [ "$status" -eq 0 ] || { echo "$phase/$size_rc: $output"; return 1; }
+            if [[ "$size_rc" -eq 130 ]]; then
+                [[ "$output" == *"RC=130 CANCEL=130"* ]] || { echo "$output"; return 1; }
+                if [[ "$phase" != "post" ]]; then
+                    [ ! -e "$case_home/tart-called" ] || return 1
+                else
+                    [ -e "$case_home/tart-called" ] || return 1
+                    [[ "$output" == *"Tart caches · pruned"* ]] || { echo "$output"; return 1; }
+                fi
+            else
+                want_timeouts=0
+                if [[ "$size_rc" -eq 124 ]]; then
+                    want_timeouts=1
+                fi
+                [[ "$output" == *"RC=0 CANCEL=0 TIMEOUTS=$want_timeouts"* ]] || { echo "$output"; return 1; }
+                if [[ "$phase" == "dry" ]]; then
+                    [[ "$output" == *"would prune items older than 30 days"* ]] || { echo "$output"; return 1; }
+                    [[ "$output" != *"size unknown"* ]] || { echo "$output"; return 1; }
+                    [ ! -e "$case_home/tart-called" ] || return 1
+                else
+                    [ -e "$case_home/tart-called" ] || return 1
+                    [[ "$output" == *"Tart caches · pruned"* ]] || { echo "$output"; return 1; }
+                    [[ "$output" != *"reclaimed"* ]] || { echo "$output"; return 1; }
+                fi
+            fi
+        done
+    done
+}
+
 @test "clean_note_apps calls expected caches" {
     run env HOME="$HOME" PROJECT_ROOT="$PROJECT_ROOT" /bin/bash --noprofile --norc << 'EOF'
 set -euo pipefail
```

**File**: `tests/clean_user_core.bats` (modified, +80/-0)
```diff
@@ -5051,3 +5051,83 @@ EOF
     [[ "$test_part" == *"PATHS:$HOME/override/Brave.app"* ]] || return 1
     [[ "$test_part" == *"VOLUMES:$HOME/override/volumes"* ]]
 }
+
+@test "clean_handoff_pasteboard_cache continues on non-signal size failure and stops on signal" {
+    local size_rc mode case_home pb want_timeouts want_known first_target second_target
+    for size_rc in 1 124 130; do
+        for mode in dry real; do
+            case_home="$BATS_TEST_TMPDIR/pb-size-$size_rc-$mode"
+            pb="$case_home/Library/Group Containers/group.com.apple.coreservices.useractivityd/shared-pasteboard"
+            mkdir -p "$pb/stale-a" "$pb/stale-b"
+            echo "payload" > "$pb/stale-a/data"
+            echo "payload" > "$pb/stale-b/data"
+            touch -t 202001010000 "$pb/stale-a" "$pb/stale-b"
+
+            run env HOME="$case_home" PROJECT_ROOT="$PROJECT_ROOT" SIZE_RC="$size_rc" MODE="$mode" \
+                MOLE_CURRENT_COMMAND=clean MOLE_CLEAN_CANCEL_STATUS=0 MOLE_CLEAN_SIZING_TIMEOUTS=0 \
+                /bin/bash --noprofile --norc << 'EOF'
+set -euo pipefail
+source "$PROJECT_ROOT/lib/core/common.sh"
+source "$PROJECT_ROOT/lib/clean/user.sh"
+if [[ "$MODE" == "dry" ]]; then
+    DRY_RUN=true
+else
+    DRY_RUN=false
+fi
+note_activity() { :; }
+is_path_whitelisted() { return 1; }
+get_path_size_kb() {
+    local first=""
+    if [[ ! -e "$HOME/first-target" ]]; then
+        printf '%s\n' "$1" > "$HOME/first-target"
+    fi
+    IFS= read -r first < "$HOME/first-target" || true
+    if [[ "$1" == "$first" ]]; then
+        return "$SIZE_RC"
+    fi
+    echo 4
+}
+record_dry_run_cleanup_target() {
+    printf '%s|%s\n' "$1" "$4" >> "$HOME/preview"
+}
+files_cleaned=0
+total_size_cleaned=0
+total_items=0
+rc=0
+clean_handoff_pasteboard_cache || rc=$?
+printf 'RC=%s CANCEL=%s TIMEOUTS=%s CLEANED=%s\n' "$rc" "${MOLE_CLEAN_CANCEL_STATUS:-0}" "${MOLE_CLEAN_SIZING_TIMEOUTS:-0}" "$files_cleaned"
+EOF
+
+            [ "$status" -eq 0 ] || { echo "$size_rc/$mode: $output"; return 1; }
+            if [[ "$size_rc" -eq 130 ]]; then
+                [[ "$output" == *"RC=130 CANCEL=130"* ]] || { echo "$output"; return 1; }
+                [[ "$output" == *"CLEANED=0"* ]] || { echo "$output"; return 1; }
+                [ ! -e "$case_home/preview" ] || return 1
+                [ -e "$pb/stale-a" ] || return 1
+                [ -e "$pb/stale-b" ] || return 1
+            else
+                want_timeouts=0
+                want_known=true
+                if [[ "$size_rc" -eq 124 ]]; then
+                    want_timeouts=1
+                    want_known=false
+                fi
+                [[ "$output" == *"RC=0 CANCEL=0 TIMEOUTS=$want_timeouts"* ]] || { echo "$output"; return 1; }
+                [[ "$output" == *"CLEANED=2"* ]] || { echo "$output"; return 1; }
+                [ -f "$case_home/first-target" ] || return 1
+                IFS= read -r first_target < "$case_home/first-target" || true
+                second_target="$pb/stale-b"
+                if [[ "$first_target" == "$pb/stale-b" ]]; then
+                    second_target="$pb/stale-a"
+                fi
+                if [[ "$mode" == "dry" ]]; then
+                    grep -Fxq "$first_target|$want_known" "$case_home/preview" || return 1
+                    grep -Fxq "$second_target|true" "$case_home/preview" || return 1
+                else
+                    [ ! -e "$pb/stale-a" ] || return 1
+                    [ ! -e "$pb/stale-b" ] || return 1
+                fi
+            fi
+        done
+    done
+}
```

---

### Incident Patch 3: `3b56a6fa` (2026-11-15)
**Commit Message**: fix(clean): clear idleassetsd temp files only after an hour idle (#1994)

The idleassetsd Aerial temp cleanup reused the 7-day MOLE_TEMP_FILE_AGE_DAYS
gate, but that directory is emptied at restart, so the files a user hits are
young and the gate never fired, leaving a jetsam loop of partially downloaded
wallpapers. safe_sudo_find_delete now also accepts an age of <N>m minutes,
applied both in the find scan (-mmin) and in the privileged worker's per-file
recheck, and the idleassetsd call passes 60m. A day count keeps -mtime; any
other value is rejected.

Verified: new "safe_sudo_find_delete minute ages remove only files idle that
long, at scan and recheck (#1994)" red with the worker on -mtime, the
idleassetsd stub asserts :60m, check.sh --no-format and the full suite pass.

Rollback: git revert this commit; the idleassetsd call returns to the 7-day
gate and safe_sudo_find_delete to day ages only.

**File**: `lib/clean/system.sh` (modified, +5/-3)
```diff
@@ -719,8 +719,10 @@ clean_deep_system() {
     # scan: macOS buries the bytes in the opaque "System Data" bucket, and a
     # stuck (re)download can leave hundreds of GB of ~1GB CFNetworkDownload_*.tmp
     # files behind (#1253). Scope the removal to the idleassetsd temp dir and to
-    # that exact aborted-download name, older than the temp-file retention
-    # window, so an in-progress download (recent mtime) is never touched. macOS
+    # that exact aborted-download name, untouched for an hour, so an in-progress
+    # download (recent mtime) is never touched. A day-based window never fired:
+    # macOS empties the temp dir at every restart and a jetsam kill loop writes
+    # a fresh ~1GB file every few minutes, so no file lives a week (#1994). macOS
     # re-fetches assets on demand, so the removal is non-destructive. The locator
     # needs sudo because the whole tree is root-owned; safe_sudo_find_delete then
     # re-applies the shared protection and whitelist gates per file.
@@ -745,7 +747,7 @@ clean_deep_system() {
                 fi
                 local idle_tmp_rc=0
                 safe_sudo_find_delete "$idle_tmp_dir" "CFNetworkDownload_*.tmp" \
-                    "$MOLE_TEMP_FILE_AGE_DAYS" "f" "5" "$system_cleanup_deadline" || idle_tmp_rc=$?
+                    "60m" "f" "5" "$system_cleanup_deadline" || idle_tmp_rc=$?
                 if [[ $idle_tmp_rc -ge 128 ]]; then
                     idle_tmp_status=$idle_tmp_rc
                     break
```

**File**: `lib/core/file_ops.sh` (modified, +19/-10)
```diff
@@ -3623,8 +3623,16 @@ safe_sudo_find_delete() {
         log_error "Invalid type filter: $type_filter, must be 'f' or 'd'"
         return 1
     fi
-    if [[ ! "$age_days" =~ ^[0-9]+$ ]]; then
-        log_error "Invalid age: $age_days, must be a non-negative integer"
+    # Age is whole days, or whole minutes written as `<N>m` for a target whose
+    # files never live a day (#1994). Scan and the per-file recheck below use
+    # the same find test.
+    local age_test="-mtime"
+    local age_value="$age_days"
+    if [[ "$age_days" =~ ^([0-9]+)m$ ]]; then
+        age_test="-mmin"
+        age_value="${BASH_REMATCH[1]}"
+    elif [[ ! "$age_days" =~ ^[0-9]+$ ]]; then
+        log_error "Invalid age: $age_days, must be a non-negative integer of days or <N>m minutes"
         return 1
     fi
     if [[ ! "$max_depth" =~ ^[1-5]$ ]]; then
@@ -3749,7 +3757,7 @@ safe_sudo_find_delete() {
         return "$link_rc"
     fi
 
-    debug_log "Finding, sudo, in $base_dir: $pattern, age: ${age_days}d, type: $type_filter"
+    debug_log "Finding, sudo, in $base_dir: $pattern, age: $age_test +$age_value, type: $type_filter"
 
     local find_args=("-maxdepth" "$max_depth")
     local match_all_names=false
@@ -3774,8 +3782,8 @@ safe_sudo_find_delete() {
         fi
     fi
     find_args+=("-type" "$type_filter")
-    if [[ "$age_days" -gt 0 ]]; then
-        find_args+=("-mtime" "+$age_days")
+    if [[ "$age_value" -gt 0 ]]; then
+        find_args+=("$age_test" "+$age_value")
     fi
 
     # Materialize the completed scan before deleting anything. Process
@@ -3978,8 +3986,9 @@ safe_sudo_find_delete() {
                 _mole_bounded_sudo "$batch_timeout" \
                     -n xargs -0 /bin/sh -c '
                         stat_tool=$1
-                        age_days=$2
-                        shift 2
+                        age_test=$2
+                        age_value=$3
+                        shift 3
                         for record do
                             dev=${record%%:*}
                             rest=${record#*:}
@@ -3988,8 +3997,8 @@ safe_sudo_find_delete() {
                             mtime=${rest%%:*}
                             path=${rest#*:}
                             expected=$dev:$ino:$mtime
-                            if [ "$age_days" -gt 0 ]; then
-                                actual=$(/usr/bin/find "$path" -maxdepth 0 -type f -mtime "+$age_days" \
+                            if [ "$age_value" -gt 0 ]; then
+                                actual=$(/usr/bin/find "$path" -maxdepth 0 -type f "$age_test" "+$age_value" \
                                     -exec "$stat_tool" -f%d:%i:%m {} \; 2>/dev/null) || continue
                             else
                                 actual=$($stat_tool -f%d:%i:%m "$path" 2>/dev/null) || continue
@@ -3998,7 +4007,7 @@ safe_sudo_find_delete() {
                             /bin/rm -f -- "$path" || exit 1
                             printf "%s\0" "$path"
                         done
-                    ' sh "$STAT_BSD" "$age_days" > "$batch_result_file" 2> /dev/null || batch_rc=$?
+                    ' sh "$STAT_BSD" "$age_test" "$age_value" > "$batch_result_file" 2> /dev/null || batch_rc=$?
 
             local batch_ts=""
             local batch_command=""
```

**File**: `tests/clean_system_maintenance.bats` (modified, +4/-2)
```diff
@@ -373,7 +373,7 @@ sudo() {
     return 0
 }
 safe_sudo_find_delete() {
-    echo "safe_sudo_find_delete:$1:$2" >> "$CALL_LOG"
+    echo "safe_sudo_find_delete:$1:$2:$3" >> "$CALL_LOG"
     if [[ "$1" == "$IDLE_DIR" ]]; then
         MOLE_SAFE_SUDO_FIND_DELETE_COUNT=1
     else
@@ -397,7 +397,9 @@ EOF
     [ "$status" -eq 0 ]
     # Scoped to the idleassetsd temp dir and the aborted-download name only:
     # never a bare CFNetworkDownload_*.tmp sweep across all of /private/var/folders.
-    [[ "$output" == *"safe_sudo_find_delete:/private/var/folders/zz/abcdef/T/com.apple.idleassetsd:CFNetworkDownload_*.tmp"* ]] || return 1
+    # An hour idle, not the day-based temp window: the folder empties at every
+    # restart, so its files never live a week (#1994).
+    [[ "$output" == *"safe_sudo_find_delete:/private/var/folders/zz/abcdef/T/com.apple.idleassetsd:CFNetworkDownload_*.tmp:60m"* ]] || return 1
     [[ "$output" == *"SUCCESS:Stale wallpaper downloads"* ]] || return 1
 }
 
```

**File**: `tests/core_safe_functions.bats` (modified, +49/-0)
```diff
@@ -2768,6 +2768,55 @@ SCRIPT
     [[ "$output" != *"REMOVED $target_file"* ]]
 }
 
+@test "safe_sudo_find_delete minute ages remove only files idle that long, at scan and recheck (#1994)" {
+    local target_dir="$TEST_DIR/sudo-minute-age-target"
+    local idle_file="$target_dir/CFNetworkDownload_idle.tmp"
+    local fresh_file="$target_dir/CFNetworkDownload_fresh.tmp"
+    mkdir -p "$target_dir"
+    touch "$idle_file" "$fresh_file"
+    touch -t "$(/bin/date -v-2H '+%Y%m%d%H%M.%S')" "$idle_file"
+    touch -t "$(/bin/date -v-10M '+%Y%m%d%H%M.%S')" "$fresh_file"
+
+    run env HOME="$HOME" PROJECT_ROOT="$PROJECT_ROOT" TARGET_DIR="$target_dir" \
+        MOLE_TEST_MODE=0 MOLE_TEST_NO_AUTH=0 /bin/bash --noprofile --norc <<'SCRIPT'
+set -euo pipefail
+source "$PROJECT_ROOT/lib/core/common.sh"
+_mole_privileged_path_has_mutable_ancestor() { return 1; }
+sudo() {
+    [[ "${1:-}" == "-n" ]] && shift
+    case "${1:-}" in
+        true) return 0 ;;
+        test)
+            shift
+            command test "$@"
+            ;;
+        find)
+            shift
+            command find "$@"
+            ;;
+        xargs)
+            shift
+            command xargs "$@"
+            ;;
+        *) "$@" ;;
+    esac
+}
+rc=0
+safe_sudo_find_delete "$TARGET_DIR" "CFNetworkDownload_*.tmp" "60m" "f" "1" || rc=$?
+printf 'RC=%s\nCOUNT=%s\n' "$rc" "${MOLE_SAFE_SUDO_FIND_DELETE_COUNT:-unset}"
+bad=0
+safe_sudo_find_delete "$TARGET_DIR" "CFNetworkDownload_*.tmp" "60x" "f" "1" 2> /dev/null || bad=$?
+printf 'BAD=%s\n' "$bad"
+SCRIPT
+
+    [ "$status" -eq 0 ] || { echo "$output"; return 1; }
+    [[ "$output" == *"RC=0"* ]] || { echo "$output"; return 1; }
+    [[ "$output" == *"COUNT=1"* ]] || { echo "$output"; return 1; }
+    [[ "$output" == *"BAD=1"* ]] || { echo "$output"; return 1; }
+    [[ ! -e "$idle_file" ]] || return 1
+    [[ -e "$fresh_file" ]]
+}
+
 @test "safe_sudo_find_delete keeps a path replaced after identity capture" {
     local target_dir="$TEST_DIR/sudo-identity-replace-target"
     local target_file="$target_dir/old.log"
```

#### Recent Merged Pull Requests:
- **PR #2028** (2026-11-18): fix(uninstall): include helper apps under Contents/Preferences (@sebastianbreguel)
- **PR #2022** (closed): fix(mo): preserve smart single quotes in the Windows launcher (@r266-tech)
- **PR #2015** (2026-11-16): perf(analyze): keep NTFS file identities as one bit per MFT record (@tw93)
- **PR #2014** (2026-11-16): fix(analyze): deduplicate Home hard links across children (@r266-tech)
- **PR #2012** (2026-11-16): fix(analyze): count NTFS hard links once per scan (@luojiyin1987)
- **PR #2010** (closed): feat: GTK window and Ubuntu tools for Mole CLI (Linux) (@KoukeNeko)

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

## X. optimize): keep task probe and removal timeouts scoped to each task

**RULE**:
When implementing operations in `lib/optimize/tasks.sh`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in tw93/Mole. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `97f66d63`: optimize): keep task probe and removal timeouts scoped to each task. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Shell data structures, boundary deserialization, API parsing, or resource lifecycles matching `lib/optimize/tasks.sh`.

**VERIFIED IMPLEMENTATION PATTERN**:
```shell
// Verified production-grade fix pattern:
    mole_rc_signal "$size_rc" && return "$size_rc"
        mole_rc_signal "$size_rc" && return "$size_rc"
            # A scan timeout fails only this task; a signal still cancels.
            mole_rc_signal "$scan_rc" && return "$scan_rc"
    local timed_out_count=0
        mole_rc_signal "$plist_rc" && return "$plist_rc"
        if mole_rc_timeout "$plist_rc"; then
            timed_out_count=$((timed_out_count + 1))
            continue
        fi
            mole_rc_signal "$plist_rc" && return "$plist_rc"
            if mole_rc_timeout "$plist_rc"; then
                timed_out_count=$((timed_out_count + 1))
                continue
            fi
            mole_rc_signal "$plist_rc" && return "$plist_rc"
    # A plist that could not be read in time is unknown: it is never called
    # healthy, and the task counts as failed in the summary line.
    if [[ $broken_count -eq 0 && $timed_out_count -eq 0 ]]; then
    if [[ $broken_count -gt 0 ]]; then
        echo -e "  ${YELLOW}${ICON_WARNING}${NC} $broken_count Launch Agent(s) point at a missing program · left in ~/Library/LaunchAgents"
    fi
    if [[ $timed_out_count -gt 0 ]]; then
        optimize_task_result "$MOLE_OPTIMI
```

**NEGATIVE CONSTRAINT**:
```shell
// Induced defect failure mode:
    mole_rc_timeout_or_signal "$size_rc" && return "$size_rc"
        mole_rc_timeout_or_signal "$size_rc" && return "$size_rc"
            mole_rc_timeout_or_signal "$scan_rc" && return "$scan_rc"
        mole_rc_timeout_or_signal "$plist_rc" && return "$plist_rc"
            mole_rc_timeout_or_signal "$plist_rc" && return "$plist_rc"
            mole_rc_timeout_or_signal "$plist_rc" && return "$plist_rc"
    if [[ $broken_count -eq 0 ]]; then
    echo -e "  ${YELLOW}${ICON_WARNING}${NC} $broken_count Launch Agent(s) point at a missing program · left in ~/Library/LaunchAgents"
        mole_rc_timeout_or_signal "$scan_rc" && return "$scan_rc"
        # Permission-only errors make the scan unavailable. Mixed errors or
        # an unreadable diagnostic keep the ordinary failed outcome.
        local permission_only=false
        if [[ -n "$scan_err_file" && -s "$scan_err_file" ]]; then
            local permission_pattern='(Permission denied|Operation not permitted)( \(os error [0-9]+\))?\.?$'
            local permission_scan_rc=0
            grep -Ev -e "$permission_pattern" -e '^$' "$scan_err_file" \
                > /dev/null || permission_scan_rc=$?
            if [[ $per
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `97f66d63` are properly handled with clean fallback behavior.


## 3. Decision Protocol & Boundary Restrictions
- Must NOT delete canonical verification records without authorization.
- Must execute independent read-back verification after every mutation.
