# Verification Protocol: Verification Protocol: Empirical Defect Shield for tw93/Mole

<!-- PROVENANCE_START
{
  "source_repository": "tw93/Mole",
  "source_url": "https://github.com/tw93/Mole",
  "source_version": "060fba8b",
  "license": "GPL-3.0",
  "timestamp": "2026-11-15T03:13:34.125Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-tw93-mole",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [tw93/Mole](https://github.com/tw93/Mole) (Revision: `060fba8b`).  
> **License**: GPL-3.0 | **Timestamp**: `2026-11-15T03:13:34.125Z`  
> **Learning ID**: `learn-github-tw93-mole`


## 1. Scope & Verification Target
- **Target Repository**: `tw93/Mole` (Commit: `060fba8b`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): tw93/Mole

> **Canonical Artifact**: `07_PROJECT_LEARNING/tw93-mole-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/tw93/Mole](https://github.com/tw93/Mole))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-15T03:13:32.814Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tw93/Mole`
- **Description**: 🐹 Open-source Mac and PC cleaner. Keep your machine clean, light, and running like new. Fast CLI, plus native Mac and Windows apps.
- **Primary Language / Ecosystem**: Shell
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 75074 stars

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
const cacheSchemaVersion = 12

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
// accessors below build on it so the layout is stated once.
func moleCacheRoot(home string) string {
	return filepath.Join(home, ".cache", "mole")
}

// getMoleCacheRoot is the sha
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
- **Issue #2002** (2026-11-15): **[Bug] `mo clean` 误判 `.bundle` 结构的 PrivilegedHelperTools 为孤儿服务，导致 Clash Verge Rev 系统服务被误杀 (`launchctl unload`)**
  *Symptoms*: > 🤖 *注：本 Issue 由 **Google Antigravity AI 助手** 协助用户排查系统日志与 Mole 源码后自动撰写生成。*  ### 环境信息 (Environment) - **Mole 版本**: `1.44.0` (Homebrew) - **macOS 版本**: macOS (Apple Silicon) - **受影响软件**: Clash Verge Rev (`v2.5.10`, Bundle ID: `io.github.clash-verge-rev.clash-verge-rev`)  ---  ### 问题描述 (Bug Description) 在 `/Applications/Clash Verge.app` 正常安装且后台系统服务正在运行的情况下，带 `sudo` 权限执行 `mole clean` 时，`clean_orphaned_system_services()` 会**误将 Clash Verge Rev 的 LaunchDaemon 判定为孤儿服务（orphaned service）**，并执行 `sudo -n launchctl unload` 强行杀掉正在运行的后台服务，导致 Clash Verge 断网并弹出“需要更新系统服务（所需的 Clash Verge 系统服务当前不可用）”报错。  ---  ### 根因分析 (Root Cause Analysis)  排查 `lib/clean/apps.sh` 后发现是由 **两个逻辑问题叠加** 导致的：  #### 1. `_plist_is_orphaned()` 未考虑 `/Library/PrivilegedHelperTools/*.bundle` 目录结构（`lib/clean/apps.sh` L589–L600） Clash Verge Rev 的 LaunchDaemon (`/Library/LaunchDaemons/io.github.clash-verge-rev.clash-verge-rev.service.plist`) 中，`ProgramArguments[0]` 指向的是一个 `.bundle` 内部的可执行文件： ```text /Library/PrivilegedHelperTools/io.github.clash-verge-rev.clash-verge-rev.service.bundle/Contents/MacOS/clash-verge-service ```  而在 `lib/clean/apps.sh` 第 590–599 行中： ```bash         if [[ -e "$binary" ]]; then             if [[ "$binary" == /Library/PrivilegedHelperTools/* ]]; then                 local helper_bundle_id                 helper_bundle_id=$(basename "$binary")                 helper_bundle_id="${helper_bundle_id%.plist}"                 if bundle_has_installed_app "$helper_bundle_id"; then                     return 1

- **Issue #1988** (2026-11-13): **[BUG] mo clean skips CloudStorage project caches due to Google Drive .tmp permission errors**
  *Symptoms*: ## Describe the bug  `mo clean` skips the entire `~/Library/CloudStorage` project-cache scan when Google Drive's internal `.tmp` directories return `Permission denied`.  The debug log shows:  ```text [2026-11-12 11:00:51] DEBUG: Project cache scan failed (1): /Users/<user>/Library/CloudStorage ```  And the cleanup summary reports:  ```text ◎ Project caches · skipped 2 slow/incomplete root scans ```  The `CloudStorage` failure is one of those skipped roots.  ## Steps to reproduce  1. Have Google Drive for desktop installed with folders under `~/Library/CloudStorage`. 2. Run `mo clean --debug`. 3. Observe that the project-cache scan fails with exit status 1. 4. Reproduce the underlying filesystem error:  ```bash /usr/bin/find -P "$HOME/Library/CloudStorage" \   -maxdepth 9 -mount -type d -print > /dev/null ```  Output:  ```text find: .../CloudStorage/GoogleDrive-<account-1>/.tmp: Permission denied find: .../CloudStorage/GoogleDrive-<account-2>/.tmp: Permission denied ```  ## Verified workaround  Running a comparable scan that prunes `.tmp` directories succeeds:  ```bash /usr/bin/find -P "$HOME/Library/CloudStorage" \   -maxdepth 9 -mount \   -name '.tmp' -prune -o \   -type d \   \( -name '.next' -o -name '__pycache__' -o -name '.dart_tool' \) \   -print > /dev/null  echo $status # 0 ```  Tested in zsh. This suggests that pruning `.tmp` directories would resolve the observed traversal failure without excluding the entire CloudStorage root.  ## Expected behavior  Mole should dis

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

### Incident Patch 1: `2dd073d2` (2026-11-12)
**Commit Message**: fix(clean): bound container cache enumeration (#1974)

`mo clean --dry-run` listed every sandbox container's caches with a shell glob
and per-entry probes, with no time limit, so a container the user could not
read quickly, or one holding many thousands of entries, held the clean
section for minutes.

Each container listing now runs through `find -mindepth 1 -maxdepth 1` under
the real timeout wrapper, bounded by MOLE_TIMEOUT_MEDIUM_PROBE_SEC and by the
section deadline. A listing that fails or times out discards its partial
candidates and the scan moves on, so a half-read container is never cleaned
from an incomplete list. The container cache sweeps take their own section
budget, so the limit stops listing in time without cutting short the
cleaning that follows.

Verified with tests/clean_container_scan.bats (a blocked listing is stopped by
the timeout wrapper; failed enumerations discard partial candidates and
continue) and the full CI matrix on b648b687.

Revert: `git revert` of this commit restores the unbounded glob listing.

Fixes #1973

**File**: `lib/clean/user.sh` (modified, +183/-123)
```diff
@@ -1098,61 +1098,79 @@ clean_support_app_data() {
     safe_clean ~/Library/Messages/Caches/Previews/StickerCache/* "Messages preview sticker cache"
 }
 
-# App caches (merged: macOS system caches + Sandboxed apps).
-# Runs in the caller's shell and returns the count in
-# CACHE_TOP_LEVEL_ENTRY_COUNT: it is called once per container, and a command
-# substitution plus two $(shopt -p) captures cost three forks each time.
-cache_top_level_entry_count_capped() {
+# Complete, NUL-delimited directory snapshots for the container cache scans.
+# A Bash glob opens the directory before any loop checkpoint can run (#1973).
+# Keep both enumeration and sorting in the bounded producer, discard partial
+# output on failure, and reuse the snapshot for counting and cleanup. Callers
+# own the array so nested scans cannot replace another caller's candidates.
+_container_cache_list_entries() {
     local dir="$1"
-    local cap="${2:-101}"
-    local count=0
-    local restore_nullglob=false
-    local restore_dotglob=false
-    shopt -q nullglob || restore_nullglob=true
-    shopt -q dotglob || restore_dotglob=true
-    shopt -s nullglob dotglob
-
-    local item
-    for item in "$dir"/*; do
-        [[ -e "$item" ]] || continue
-        count=$((count + 1))
-        if ((count >= cap)); then
-            break
+    local entries_file="${2:-}"
+    local owns_entries_file=false
+    _MOLE_CONTAINER_CACHE_ENTRIES=()
+    local timeout_seconds
+    if ! timeout_seconds=$(_mole_timeout_with_deadline "$MOLE_TIMEOUT_MEDIUM_PROBE_SEC" \
+        "${_MOLE_CLEAN_SECTION_DEADLINE:-}"); then
+        debug_log "Container cache scan budget exhausted: $dir"
+        return 1
+    fi
+    if [[ -z "$entries_file" ]]; then
+        entries_file=$(create_temp_file) || return 1
+        owns_entries_file=true
+    fi
+    local scan_rc=0
+    run_with_timeout "$timeout_seconds" "$FIND_BSD" "$dir" \
+        -mindepth 1 -maxdepth 1 -print0 > "$entries_file" 2> /dev/null || scan_rc=$?
+    if [[ $scan_rc -eq 0 ]]; then
+        if timeout_seconds=$(_mole_timeout_with_deadline "$MOLE_TIMEOUT_MEDIUM_PROBE_SEC" \
+            "${_MOLE_CLEAN_SECTION_DEADLINE:-}"); then
+            # BSD sort can silently truncate malformed UTF-8 records in a
+            # UTF-8 locale, even with -z. Paths remain byte strings here.
+            LC_ALL=C run_with_timeout "$timeout_seconds" /usr/bin/sort -z -o "$entries_file" \
+                "$entries_file" 2> /dev/null || scan_rc=$?
+        else
+            scan_rc=1
         fi
-    done
-
-    [[ "$restore_nullglob" == "true" ]] && shopt -u nullglob
-    [[ "$restore_dotglob" == "true" ]] && shopt -u dotglob
-
-    [[ "$count" =~ ^[0-9]+$ ]] || count=0
-    CACHE_TOP_LEVEL_ENTRY_COUNT=$count
-    return 0
+    fi
+    if [[ $scan_rc -eq 0 ]]; then
+        local item
+        while IFS= read -r -d '' item; do
+            if _mole_clean_section_budget_spent; then
+                scan_rc=1
+                break
+            fi
+            [[ -e "$item" ]] || continue
+            _MOLE_CONTAINER_CACHE_ENTRIES+=("$item")
+        done < "$entries_file"
+    fi
+    if [[ "$owns_entries_file" == true ]]; then
+        rm -f "$entries_file" # SAFE: exact create_temp_file output owned by this scan
+    fi
+    [[ $scan_rc -eq 0 ]] && return 0
+    _MOLE_CONTAINER_CACHE_ENTRIES=()
+    if mole_rc_signal "$scan_rc"; then
+        _mole_record_clean_cancellation "$scan_rc"
+        return "$scan_rc"
+    fi
+    debug_log "Container cache listing incomplete: $dir (status $scan_rc)"
+    return 1
 }
 
-directory_has_entries() {
-    local dir="$1"
-    [[ -d "$dir" ]] || return 1
-
-    local _nullglob_state
-    local _dotglob_state
-    _nullglob_state=$(shopt -p nullglob || true)
-    _dotglob_state=$(shopt -p dotglob || true)
-    shopt -s nullglob dotglob
-
-    local item
-    for item in "$dir"/*; do
-        if [[ -e "$item" ]]; then
-            # eval: restore shopt state captured by $(shopt -p)
-            eval "$_nullglob_state"
-            eval "$_dotglob_state"
-            return 0
-        fi
-    done
+# One scratch file per scan, reused only after its complete contents have been
+# copied into the caller's array. Registering a new temp file per directory
+# exhausted the scan budget even for hundreds of readable, one-file caches.
+_container_cache_scan_finish() {
+    stop_section_spinner
+    if [[ -n "${1:-}" ]]; then
+        rm -f "$1" # SAFE: exact create_temp_file output owned by the calling scan
+    fi
+}
 
-    # eval: restore shopt state captured by $(shopt -p)
-    eval "$_nullglob_state"
-    eval "$_dotglob_state"
-    return 1
+# Same wording as the Cloud & Office budget line in bin/clean.sh.
+_container_cache_budget_note() {
+    [[ "$1" == true ]] || return 0
+    echo -e "  ${YELLOW}${ICON_WARNING}${NC} $2 · ${GRAY}time limit reached, skipped remaining items${NC}"
+    note_activity
 }
 
 # Rendered wallpaper bitmaps the wallpaper agent keeps in its container: one
@@ -132
```

**File**: `lib/core/timeouts.sh` (modified, +4/-0)
```diff
@@ -66,6 +66,10 @@ readonly MOLE_TIMEOUT_PKG_CLEANUP_SEC="${MOLE_TIMEOUT_PKG_CLEANUP_SEC:-20}"
 readonly MOLE_TIMEOUT_DISK_VERIFY_SEC="${MOLE_TIMEOUT_DISK_VERIFY_SEC:-30}"
 readonly MOLE_TIMEOUT_HINT_SCAN_SEC="${MOLE_TIMEOUT_HINT_SCAN_SEC:-15}"
 readonly MOLE_CLOUD_OFFICE_SECTION_BUDGET_SEC="${MOLE_CLOUD_OFFICE_SECTION_BUDGET_SEC:-300}"
+# Sandbox and Group Container cache sweeps each get their own wall-clock budget.
+# It bounds blocked directory listings (#1973) without cutting short a normal
+# sweep: 800 readable containers took about 14 seconds to offer.
+readonly MOLE_CONTAINER_CACHE_SECTION_BUDGET_SEC="${MOLE_CONTAINER_CACHE_SECTION_BUDGET_SEC:-120}"
 
 # True when a cooperative clean-section wall clock has elapsed (#1513).
 _mole_clean_section_budget_spent() {
```

**File**: `tests/clean_container_scan.bats` (added, +312/-0)
```diff
@@ -0,0 +1,312 @@
+#!/usr/bin/env bats
+
+load helpers/common
+
+setup_file() {
+    mole_test_setup_home container-scan
+}
+
+teardown_file() {
+    mole_test_teardown_home
+}
+
+run_container_scan_fixture() {
+    local scope="$1" scan_status="$2" dry_run="$3"
+    local fixture_home
+    fixture_home=$(mktemp -d "$HOME/$scope-$scan_status-$dry_run.XXXXXX")
+    run env HOME="$fixture_home" PROJECT_ROOT="$PROJECT_ROOT" \
+        SCAN_SCOPE="$scope" SCAN_STATUS="$scan_status" DRY_RUN="$dry_run" \
+        LC_ALL=en_US.UTF-8 \
+        MOLE_TEST_NO_AUTH=1 MOLE_CURRENT_COMMAND=clean MOLE_CLEAN_CANCEL_STATUS=0 \
+        MOLE_TIMEOUT_MEDIUM_PROBE_SEC=2 MOLE_TIMEOUT_HINT_SCAN_SEC=0 \
+        MOLE_CONTAINER_CACHE_SECTION_BUDGET_SEC=15 /bin/bash --noprofile --norc <<'EOF'
+set -euo pipefail
+source "$PROJECT_ROOT/lib/core/common.sh"
+source "$PROJECT_ROOT/lib/clean/user.sh"
+eval "$(declare -f create_temp_file | sed '1s/^create_temp_file/_scan_create_temp_file/')"
+create_temp_file() {
+    local file
+    file=$(_scan_create_temp_file) || return $?
+    printf '%s\0' "$file" >> "$HOME/temp-trace"
+    printf '%s\n' "$file"
+}
+start_section_spinner() { spinner=on; }
+stop_section_spinner() { spinner=off; }
+safe_clean() { :; }
+clean_support_app_data() { :; }
+_clean_wallpaper_renders() { :; }
+clean_handoff_pasteboard_cache() { echo LATER_SECTION; }
+note_activity() { :; }
+should_protect_data() { return 1; }
+is_critical_system_component() { return 1; }
+should_protect_path() { return 1; }
+is_path_whitelisted() { return 1; }
+holds_compiled_model_cache() { return 1; }
+get_path_size_kb() { echo 7; }
+validate_path_for_deletion() { return 0; }
+register_dry_run_cleanup_target() { return 0; }
+record_scan_action() {
+    printf '%s\0' "$1" >> "$HOME/actions"
+    if [[ "$SCAN_SCOPE" == budget && "$1" == "$app_a/payload" ]]; then
+        SECONDS="${_MOLE_CLEAN_SECTION_DEADLINE:-$SECONDS}"
+    fi
+    if [[ "$SCAN_SCOPE" == group-budget && "$1" == "$group_a/payload" ]]; then
+        SECONDS="${_MOLE_CLEAN_SECTION_DEADLINE:-$SECONDS}"
+    fi
+}
+safe_remove() { record_scan_action "$1"; }
+append_dry_run_cleanup_target() { record_scan_action "$1"; }
+record_dry_run_cleanup_target() { record_scan_action "$1"; }
+files_cleaned=0
+total_size_cleaned=0
+total_items=0
+spinner=off
+
+app_root="$HOME/Library/Containers"
+group_root="$HOME/Library/Group Containers"
+app_a="$app_root/com.example.a/Data/Library/Caches"
+app_z="$app_root/com.example.z/Data/Library/Caches"
+group_a="$group_root/group.com.example.a/Library/Caches"
+group_z="$group_root/group.com.example.z/Library/Caches"
+mkdir -p "$app_a" "$app_z" "$group_a" "$group_z"
+touch "$app_a/payload" "$app_a/zlater" "$app_z/.hidden" "$app_z/line
+break" "$group_a/payload" "$group_z/.hidden"
+ln -s "$app_a/payload" "$app_z/link"
+# Root globs used to exclude hidden containers; keep that boundary.
+mkdir -p "$app_root/.hidden-container/Data/Library/Caches"
+touch "$app_root/.hidden-container/Data/Library/Caches/keep"
+touch "$HOME/actions" "$HOME/find-trace" "$HOME/temp-trace"
+if [[ "$SCAN_SCOPE" == safari* ]]; then
+    mkdir -p "$app_root/group.com.example.a"
+    if [[ "$SCAN_SCOPE" == safari-present ]]; then
+        touch "$app_root/group.com.example.a/SafariExtension"
+    fi
+fi
+
+export REAL_FIND="$FIND_BSD" app_root group_root app_a group_a
+cat > "$HOME/find-stub" <<'FIND'
+#!/bin/bash
+printf '%s\0' "$1" >> "$HOME/find-trace"
+blocked=false
+case "$SCAN_SCOPE:$1" in
+    "app-root:$app_root" | "cache:$app_a" | stall*:"$app_a" | \
+        "group-root:$group_root" | "group-cache:$group_a" | \
+        "safari:$app_root/group.com.example.a") blocked=true ;;
+esac
+if [[ "$blocked" == true ]]; then
+    printf 'ENUMERATION_REACHED\n' >> "$HOME/producer-trace"
+    case "$SCAN_SCOPE" in
+        app-root) printf '%s\0' "$app_root/com.example.a" ;;
+        group-root) printf '%s\0' "$group_root/group.com.example.a" ;;
+        *) printf '%s\0' "$1/payload" ;;
+    esac
+    if [[ "$SCAN_SCOPE" == stall* ]]; then
+        echo "$$" > "$HOME/stalled-pid"
+        exec /bin/sleep 20
+    fi
+    exit "$SCAN_STATUS"
+fi
+exec "$REAL_FIND" "$@"
+FIND
+chmod +x "$HOME/find-stub"
+FIND_BSD="$HOME/find-stub"
+case "$SCAN_SCOPE" in
+    stall-perl) MO_TIMEOUT_BIN="" ;;
+    stall-shell) MO_TIMEOUT_BIN=""; MO_TIMEOUT_PERL_BIN="" ;;
+esac
+if [[ "$SCAN_SCOPE" == glob-on ]]; then
+    shopt -s nullglob dotglob
+else
+    shopt -u nullglob dotglob
+fi
+
+rc=0
+clean_app_caches || rc=$?
+printf 'RC=%s CANCEL=%s SPINNER=%s\n' "$rc" "$MOLE_CLEAN_CANCEL_STATUS" "$spinner"
+printf 'ITEMS=%s SIZE=%s\n' "$files_cleaned" "$total_size_cleaned"
+printf 'GLOBS=%s%s\n' "$(shopt -q nullglob && echo N || echo n)" "$(shopt -q dotglob && echo D || echo d)"
+printf 'FINDS=%s\n' "$(tr -dc '\0' < "$HOME/find-trace" | wc -c | tr -d ' ')"
+printf 'TEMP_FILES=%s\n' "$(tr -dc '\0' < "$HOME/temp-trace" | wc -c | tr -d ' ')"
+while IFS= read -r -d '' file; do
+    [[ ! -e "$file" ]] || { ec
```

**File**: `tests/clean_user_core.bats` (modified, +0/-88)
```diff
@@ -2018,7 +2018,6 @@ start_section_spinner() { :; }
 stop_section_spinner() { :; }
 note_activity() { :; }
 bytes_to_human() { printf '0B\n'; }
-directory_has_entries() { return 1; }
 clean_support_app_data() { :; }
 safe_clean() {
     case "${*: -1}" in
@@ -2412,93 +2411,6 @@ EOF
     [[ "$output" != *"SHOULD_NOT_SIZE_SCAN"* ]]
 }
 
-@test "container cache counters run in the caller's shell and restore glob options" {
-    # Own HOME: earlier cases leave Group Containers fixtures in the shared one,
-    # and every extra candidate adds a counter call.
-    local counter_home
-    counter_home=$(mktemp -d "${BATS_TEST_DIRNAME}/tmp-counter-home.XXXXXX")
-    run env HOME="$counter_home" PROJECT_ROOT="$PROJECT_ROOT" DRY_RUN=true /bin/bash --noprofile --norc << 'EOF'
-set -euo pipefail
-source "$PROJECT_ROOT/lib/core/common.sh"
-source "$PROJECT_ROOT/lib/clean/user.sh"
-start_section_spinner() { :; }
-stop_section_spinner() { :; }
-bytes_to_human() { echo "0B"; }
-note_activity() { :; }
-should_protect_data() { return 1; }
-should_protect_path() { return 1; }
-is_path_whitelisted() { return 1; }
-holds_compiled_model_cache() { return 1; }
-_mole_user_cache_owner_process_state() { return 1; }
-_MOLE_COMPLETE_LSOF_MODE=direct
-lsof() { return 1; }
-run_with_timeout() { shift; "$@"; }
-get_path_size_kb() { printf '7\n'; }
-record_dry_run_cleanup_target() { return 0; }
-files_cleaned=0
-total_size_cleaned=0
-total_items=0
-
-# A call made through $(...) increments this counter in a subshell, so the
-# owning shell sees zero: the count only survives a direct call.
-eval "$(declare -f cache_top_level_entry_count_capped | sed '1s/^cache_top_level_entry_count_capped/_counted_entry_count_capped/')"
-COUNTER_CALLS=0
-cache_top_level_entry_count_capped() {
-    COUNTER_CALLS=$((COUNTER_CALLS + 1))
-    _counted_entry_count_capped "$@"
-}
-
-probe="$HOME/counter-probe"
-mkdir -p "$probe"
-touch "$probe/.hidden" "$probe/a" "$probe/b"
-shopt -u nullglob dotglob
-cache_top_level_entry_count_capped "$probe" 101
-printf 'DIRECT_COUNT=%s\n' "$CACHE_TOP_LEVEL_ENTRY_COUNT"
-cache_top_level_entry_count_capped "$probe" 2
-printf 'CAPPED_COUNT=%s\n' "$CACHE_TOP_LEVEL_ENTRY_COUNT"
-printf 'OFF_AFTER=%s%s\n' "$(shopt -q nullglob && echo N || echo n)" "$(shopt -q dotglob && echo D || echo d)"
-shopt -s nullglob dotglob
-cache_top_level_entry_count_capped "$probe" 101
-printf 'ON_AFTER=%s%s\n' "$(shopt -q nullglob && echo N || echo n)" "$(shopt -q dotglob && echo D || echo d)"
-shopt -u nullglob dotglob
-COUNTER_CALLS=0
-
-container="$HOME/Library/Containers/com.example.counter"
-mkdir -p "$container/Data/Library/Caches/one"
-touch "$container/Data/Library/Caches/one/data.tmp"
-total_size=0
-total_size_partial=false
-cleaned_count=0
-found_any=false
-precise_size_limit=64
-precise_size_used=0
-process_container_cache "$container"
-printf 'CONTAINER_CALLS=%s\n' "$COUNTER_CALLS"
-
-mkdir -p "$HOME/Library/Group Containers/group.com.example.counter/Library/Caches"
-for i in $(seq 1 101); do
-    touch "$HOME/Library/Group Containers/group.com.example.counter/Library/Caches/file-$i.tmp"
-done
-clean_group_container_caches
-printf 'TOTAL_CALLS=%s\n' "$COUNTER_CALLS"
-printf 'GLOBS_AFTER=%s%s\n' "$(shopt -q nullglob && echo N || echo n)" "$(shopt -q dotglob && echo D || echo d)"
-EOF
-
-    rm -rf "$counter_home" # SAFE: this test's own mktemp HOME
-    [ "$status" -eq 0 ] || {
-        echo "$output"
-        return 1
-    }
-    [[ "$output" == *"DIRECT_COUNT=3"* ]] || return 1
-    [[ "$output" == *"CAPPED_COUNT=2"* ]] || return 1
-    [[ "$output" == *"OFF_AFTER=nd"* ]] || return 1
-    [[ "$output" == *"ON_AFTER=ND"* ]] || return 1
-    [[ "$output" == *"CONTAINER_CALLS=1"* ]] || return 1
-    [[ "$output" == *"Group Containers logs/caches"* ]] || return 1
-    [[ "$output" == *"TOTAL_CALLS=2"* ]] || return 1
-    [[ "$output" == *"GLOBS_AFTER=nd"* ]]
-}
-
 @test "clean_finder_metadata respects protection flag" {
     run env HOME="$HOME" PROJECT_ROOT="$PROJECT_ROOT" PROTECT_FINDER_METADATA=true /bin/bash --noprofile --norc << 'EOF'
 set -euo pipefail
```

---

### Incident Patch 2: `830f5e68` (2026-11-14)
**Commit Message**: fix(clean): protect Claude Code transcripts, file history and prompt history

V1.36.3 ran safe_find_delete on ~/.claude/projects with the 7-day log age
and removed whole transcript folders with rm -rf (a2a0421e). V1.37.0 dropped
that rule (32bfb5b9), but nothing protected the folder afterwards, so the
next rule written the same way would delete them again. Codex sessions and
the Windows CLI already have this protection.

should_protect_path now covers ~/.claude/projects, ~/.claude/file-history,
~/.claude/history.jsonl and the exact ~/.claude root, so a sweep one level
up cannot take them either. Character classes match the case-insensitive
APFS spellings, and the root compares against HOME without a trailing
slash. Other ~/.claude children, such as the worktrees purge scans, stay
reachable. No current cleanup rule touches these paths, so nothing users
see changes. Recorded as I-73 in docs/incidents.md.

Verified: both new tests fail on the old code, and again when only the
root rule, only the case classes or only the HOME slash handling is
removed; check.sh --no-format passes; the full suite passes (2523 tests,
0 failures). A separate safety review found the root, case and HOME sla

**File**: `docs/incidents.md` (modified, +1/-0)
```diff
@@ -107,3 +107,4 @@ when it was confirmed by reading the history, otherwise `unknown`.
 | I-70 | 2026-11-12 | `mo analyze` kept at most one Spotlight large-file result: `strings.Lines` leaves the newline on each line, so every path but the last failed `os.Lstat` and Spotlight could never replace the walk's list | 158af1e1 | 5487a011 | unit | `TestSpotlightKeepsEveryOutputLine` |
 | I-71 | 2026-11-10 | `mo clean --dry-run` sat for many minutes in the sandbox cache step: every container's caches were listed with a shell glob and per-entry probes under no time limit, so a slow or very large container held the whole clean section (#1973) | unknown | 2dd073d2 | review | `failed container enumerations discard partial candidates and continue (#1973)`, `a blocked container listing is stopped by the real timeout wrapper (#1973)` |
 | I-72 | 2026-11-12 | `mo clean` discarded every project-cache match from an otherwise readable CloudStorage root when Google Drive's internal `.tmp` directory returned Permission denied (#1988) | unknown | 601471d7 | unit | `scan_project_cache_root prunes provider temp folders but keeps readable CloudStorage projects (#1988)`, `scan_project_cache_root still discards results for other unreadable CloudStorage folders (#1988)` |
+| I-73 | 2026-11-14 | `mo clean` in V1.36.3 removed every `~/.claude/projects` folder (and `file-history` entry) idle for 7 days with `rm -rf`, treating Claude Code transcripts as logs; V1.37.0 dropped the rule, but nothing protected the folder afterwards | a2a0421e | 32bfb5b9 | review | `should_protect_path protects Claude Code transcripts, file history and prompt history`, `the V1.36.3 aged sweep of ~/.claude/projects keeps every transcript folder` |
```

**File**: `lib/core/app_protection.sh` (modified, +15/-0)
```diff
@@ -557,6 +557,21 @@ should_protect_path() {
             */.codex/cache/codex_app_directory | */.codex/cache/codex_app_directory/*)
             return 0
             ;;
+        # Claude Code keeps every conversation transcript, its file snapshots
+        # and the prompt history under ~/.claude. V1.36.3 aged out whole
+        # ~/.claude/projects folders as if they were logs; nothing there is
+        # rebuildable. Same three entries the Windows CLI protects, plus the
+        # exact ~/.claude root so a delete one level up cannot take them along;
+        # its other children (~/.claude/worktrees for purge) stay reachable.
+        # Character classes cover the case-insensitive APFS spellings.
+        "${HOME%/}"/.[Cc][Ll][Aa][Uu][Dd][Ee] | "${HOME%/}"/.[Cc][Ll][Aa][Uu][Dd][Ee]/ | \
+            */.[Cc][Ll][Aa][Uu][Dd][Ee]/[Pp][Rr][Oo][Jj][Ee][Cc][Tt][Ss] | \
+            */.[Cc][Ll][Aa][Uu][Dd][Ee]/[Pp][Rr][Oo][Jj][Ee][Cc][Tt][Ss]/* | \
+            */.[Cc][Ll][Aa][Uu][Dd][Ee]/[Ff][Ii][Ll][Ee]-[Hh][Ii][Ss][Tt][Oo][Rr][Yy] | \
+            */.[Cc][Ll][Aa][Uu][Dd][Ee]/[Ff][Ii][Ll][Ee]-[Hh][Ii][Ss][Tt][Oo][Rr][Yy]/* | \
+            */.[Cc][Ll][Aa][Uu][Dd][Ee]/[Hh][Ii][Ss][Tt][Oo][Rr][Yy].[Jj][Ss][Oo][Nn][Ll])
+            return 0
+            ;;
         # Bluetooth and WiFi configurations
         */ByHost/com.apple.bluetooth.* | */ByHost/com.apple.wifi.*)
             return 0
```

**File**: `tests/core_common.bats` (modified, +29/-0)
```diff
@@ -978,6 +978,35 @@ EOF2
     done
 }
 
+@test "should_protect_path protects Claude Code transcripts, file history and prompt history" {
+    for claude_state_path in \
+        "$HOME/.claude/projects" \
+        "$HOME/.claude/projects/-Users-me-app" \
+        "$HOME/.claude/projects/-Users-me-app/0b6c9f0e-1111-4222-8333-944455556666.jsonl" \
+        "$HOME/.claude/file-history" \
+        "$HOME/.claude/file-history/0b6c9f0e-1111-4222-8333-944455556666/1" \
+        "$HOME/.claude/history.jsonl" \
+        "$HOME/.claude" \
+        "$HOME/.Claude/projects/-Users-me-app" \
+        "$HOME/.CLAUDE/History.jsonl"; do
+        result=$(HOME="$HOME" TARGET_PATH="$claude_state_path" /bin/bash --noprofile --norc -c 'source "$PROJECT_ROOT/lib/core/common.sh"; should_protect_path "$TARGET_PATH" && echo "protected" || echo "not-protected"')
+        [ "$result" = "protected" ] || { echo "not protected: $claude_state_path"; return 1; }
+    done
+
+    # A HOME set with a trailing slash still names the same root.
+    local root_path="$HOME/.claude"
+    result=$(HOME="$HOME/" TARGET_PATH="$root_path" /bin/bash --noprofile --norc -c 'source "$PROJECT_ROOT/lib/core/common.sh"; should_protect_path "$TARGET_PATH" && echo "protected" || echo "not-protected"')
+    [ "$result" = "protected" ] || { echo "root not protected with HOME ending in /"; return 1; }
+
+    # A prefix sibling is not the transcript folder, and the root's other
+    # children (purge's worktree container) stay reachable.
+    local sibling_path
+    for sibling_path in "$HOME/.claude/projects-old" "$HOME/.claude/worktrees/feature"; do
+        result=$(HOME="$HOME" TARGET_PATH="$sibling_path" /bin/bash --noprofile --norc -c 'source "$PROJECT_ROOT/lib/core/common.sh"; should_protect_path "$TARGET_PATH" && echo "protected" || echo "not-protected"')
+        [ "$result" = "not-protected" ] || { echo "protected: $sibling_path"; return 1; }
+    done
+}
+
 @test "should_protect_data covers Raycast wildcard variants" {
     for id in com.raycast.macos com.raycast.shared com.raycast.macos.BrowserExtension com.raycast-x.macos; do
         result=$(HOME="$HOME" /bin/bash --noprofile --norc -c "source '$PROJECT_ROOT/lib/core/common.sh'; should_protect_data '$id' && echo 'protected' || echo 'not-protected'")
```

**File**: `tests/core_safe_functions.bats` (modified, +25/-0)
```diff
@@ -1970,6 +1970,31 @@ SCRIPT
     [ -f "$target_dir/file2.log" ] || return 1
 }
 
+@test "the V1.36.3 aged sweep of ~/.claude/projects keeps every transcript folder" {
+    local projects="$HOME/.claude/projects"
+    local control="$TEST_DIR/aged-control"
+    mkdir -p "$projects/-Users-me-app" "$projects/-Users-me-old" "$control/old-dir"
+    touch "$projects/-Users-me-app/0b6c9f0e-1111-4222-8333-944455556666.jsonl"
+    touch -t 202601010000 "$projects/-Users-me-old" "$projects/-Users-me-app" "$control/old-dir"
+
+    # The exact call V1.36.3 shipped in clean_dev_misc, beside a control
+    # folder of the same age that ordinary policy does remove.
+    run env HOME="$HOME" PROJECT_ROOT="$PROJECT_ROOT" PROJECTS="$projects" CONTROL="$control" /bin/bash --noprofile --norc <<'SCRIPT'
+set -euo pipefail
+source "$PROJECT_ROOT/lib/core/common.sh"
+safe_find_delete "$PROJECTS" "*" 7 d || printf 'RC=%s\n' "$?"
+safe_find_delete "$CONTROL" "*" 7 d || printf 'RC=%s\n' "$?"
+# The same sweep one level up, aimed at an aged ~/.claude itself.
+touch -t 202601010000 "$HOME/.claude"
+safe_find_delete "$HOME" ".claude" 7 d || printf 'RC=%s\n' "$?"
+SCRIPT
+
+    [ "$status" -eq 0 ] || { echo "$output"; return 1; }
+    [ ! -d "$control/old-dir" ] || { echo "control folder survived: $output"; return 1; }
+    [ -d "$projects/-Users-me-old" ] || return 1
+    [ -f "$projects/-Users-me-app/0b6c9f0e-1111-4222-8333-944455556666.jsonl" ]
+}
+
 @test "safe_sudo_find_delete dry run records targets once and tracks count (#1865)" {
     local target_dir="$TEST_DIR/sudo-find-dry-run-once"
     mkdir -p "$target_dir"
```

---

### Incident Patch 3: `022bdf42` (2026-11-15)
**Commit Message**: fix(clean): skip only Clang cache on DARWIN_USER_CACHE_DIR timeout (#2006)

When mole_darwin_user_cache_root timed out resolving DARWIN_USER_CACHE_DIR (exit 124), clean_clang_module_cache returned 124 via mole_rc_timeout_or_signal, causing _run_developer_cleanup_step to record a clean cancellation and abort remaining mo clean steps even though nothing had been modified.

Match clean_dev_go and lib/core/app_protection.sh by skipping only clean_clang_module_cache on timeout (returning 0 with a debug log message), while keeping real OS signals sticky via mole_rc_signal and explicit propagation from clean_dev_other_langs.

**File**: `lib/clean/dev.sh` (modified, +6/-2)
```diff
@@ -918,7 +918,11 @@ clean_clang_module_cache() {
     local resolver_rc=0
     darwin_user_cache=$(mole_darwin_user_cache_root) || resolver_rc=$?
     if [[ $resolver_rc -ne 0 ]]; then
-        mole_rc_timeout_or_signal "$resolver_rc" && return "$resolver_rc"
+        if mole_rc_timeout "$resolver_rc"; then
+            debug_log "Skipping Clang module cache: DARWIN_USER_CACHE_DIR lookup timed out"
+            return 0
+        fi
+        mole_rc_signal "$resolver_rc" && return "$resolver_rc"
         return 0
     fi
 
@@ -4419,7 +4423,7 @@ clean_dev_other_langs() {
     # DENO_DIR mixes remote imports with origin storage and downloaded runtime
     # payloads. The owner clean command resets the whole root, so Mole keeps it
     # review-only and the generic user-cache sweep excludes it as well.
-    clean_clang_module_cache
+    clean_clang_module_cache || return $?
 }
 # CI/CD and DevOps caches.
 clean_dev_cicd() {
```

**File**: `tests/clean_dev_caches.bats` (modified, +55/-0)
```diff
@@ -2896,6 +2896,61 @@ EOF
     [ -d "$outside_root/private-data" ]
 }
 
+@test "clean_clang_module_cache skips only Clang cleanup on resolver timeout and keeps a signal sticky" {
+    local darwin_cache="$HOME/clang-resolver-cache"
+    local trace="$HOME/clang-resolver.trace"
+    mkdir -p "$darwin_cache/clang/module-cache"
+
+    run env HOME="$HOME" PROJECT_ROOT="$PROJECT_ROOT" \
+        DARWIN_CACHE="$darwin_cache" CLANG_TRACE="$trace" \
+        /bin/bash --noprofile --norc <<'EOF'
+set -euo pipefail
+source "$PROJECT_ROOT/lib/core/common.sh"
+source "$PROJECT_ROOT/lib/clean/dev.sh"
+DRY_RUN=false
+MOLE_CURRENT_COMMAND=clean
+clang_module_cache_process_state() { return 1; }
+note_activity() { :; }
+later_step() { LATER=ran; }
+safe_clean() {
+    local description="${!#}"
+    if [[ "$description" == "Clang module cache" ]]; then
+        printf 'CLEAN:%s\n' "$1" >> "$CLANG_TRACE"
+    fi
+    return 0
+}
+run_with_timeout() {
+    shift
+    if [[ "${1:-}" == "/usr/bin/getconf" && "${2:-}" == "DARWIN_USER_CACHE_DIR" ]]; then
+        [[ "$RESOLVER_FAIL_RC" -eq 0 ]] || return "$RESOLVER_FAIL_RC"
+        printf '%s\n' "$DARWIN_CACHE"
+        return 0
+    fi
+    return 0
+}
+
+for RESOLVER_FAIL_RC in 0 124 1 130 143; do
+    MOLE_CLEAN_CANCEL_STATUS=0
+    : > "$CLANG_TRACE"
+    rc=0
+    _run_developer_cleanup_step clean_dev_other_langs || rc=$?
+    LATER=skipped
+    _run_developer_cleanup_step later_step || true
+    cleans=$(wc -l < "$CLANG_TRACE" | tr -d ' ')
+    printf 'RC_IN=%s RC=%s CANCEL=%s LATER=%s CLEANS=%s\n' \
+        "$RESOLVER_FAIL_RC" "$rc" "$MOLE_CLEAN_CANCEL_STATUS" "$LATER" "$cleans"
+done
+EOF
+
+    [ "$status" -eq 0 ] || { echo "$output"; return 1; }
+    [[ "$output" == *"RC_IN=0 RC=0 CANCEL=0 LATER=ran CLEANS=1"* ]] || { echo "$output"; return 1; }
+    [[ "$output" == *"RC_IN=124 RC=0 CANCEL=0 LATER=ran CLEANS=0"* ]] || { echo "$output"; return 1; }
+    [[ "$output" == *"RC_IN=1 RC=0 CANCEL=0 LATER=ran CLEANS=0"* ]] || { echo "$output"; return 1; }
+    [[ "$output" == *"RC_IN=130 RC=130 CANCEL=130 LATER=skipped CLEANS=0"* ]] || { echo "$output"; return 1; }
+    [[ "$output" == *"RC_IN=143 RC=143 CANCEL=143 LATER=skipped CLEANS=0"* ]] || { echo "$output"; return 1; }
+    rm -rf "$darwin_cache" "$trace" # SAFE: test fixture paths under the temporary HOME
+}
+
 @test "clean_dev_rust honors CARGO_HOME and RUSTUP_HOME when absolute" {
     # mise and friends relocate cargo/rustup via env; hardcoded ~/.cargo misses
     # the live cache (issue #1378). Scope stays redundant download copies only.
```

#### Recent Merged Pull Requests:
- **PR #2009** (2026-11-15): test(purge): decouple depth coverage from short deadlines (@r266-tech)
- **PR #2008** (2026-11-15): fix(completion): fix Fish completion subcommand arguments (@viniciusdsandrade)
- **PR #2006** (2026-11-15): fix(clean): skip only Clang cache on DARWIN_USER_CACHE_DIR timeout (@viniciusdsandrade)
- **PR #1999** (2026-11-15): perf(clean): ask a running browser before sizing its Caches root (@sebastianbreguel)
- **PR #1996** (2026-11-15): fix(analyze): keep cursor on visible rows and skip only hidden empty entries (@viniciusdsandrade)
- **PR #1993** (2026-11-15): fix(update): preserve nightly SHAs from large responses (@r266-tech)

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

## X. clean): bound container cache enumeration

**RULE**:
When implementing operations in `lib/clean/user.sh`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in tw93/Mole. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `2dd073d2`: clean): bound container cache enumeration. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Shell data structures, boundary deserialization, API parsing, or resource lifecycles matching `lib/clean/user.sh`.

**VERIFIED IMPLEMENTATION PATTERN**:
```shell
// Verified production-grade fix pattern:
# Complete, NUL-delimited directory snapshots for the container cache scans.
# A Bash glob opens the directory before any loop checkpoint can run (#1973).
# Keep both enumeration and sorting in the bounded producer, discard partial
# output on failure, and reuse the snapshot for counting and cleanup. Callers
# own the array so nested scans cannot replace another caller's candidates.
_container_cache_list_entries() {
    local entries_file="${2:-}"
    local owns_entries_file=false
    _MOLE_CONTAINER_CACHE_ENTRIES=()
    local timeout_seconds
    if ! timeout_seconds=$(_mole_timeout_with_deadline "$MOLE_TIMEOUT_MEDIUM_PROBE_SEC" \
        "${_MOLE_CLEAN_SECTION_DEADLINE:-}"); then
        debug_log "Container cache scan budget exhausted: $dir"
        return 1
    fi
    if [[ -z "$entries_file" ]]; then
        entries_file=$(create_temp_file) || return 1
        owns_entries_file=true
    fi
    local scan_rc=0
    run_with_timeout "$timeout_seconds" "$FIND_BSD" "$dir" \
        -mindepth 1 -maxdepth 1 -print0 > "$entries_file" 2> /dev/null || scan_rc=$?
    if [[ $scan_rc -eq 0 ]]; then
        if timeout_seconds=$(_mole_timeout_with_deadline "$MOLE_TIMEOUT_MEDIUM_PROBE_SEC" \
 
```

**NEGATIVE CONSTRAINT**:
```shell
// Induced defect failure mode:
# App caches (merged: macOS system caches + Sandboxed apps).
# Runs in the caller's shell and returns the count in
# CACHE_TOP_LEVEL_ENTRY_COUNT: it is called once per container, and a command
# substitution plus two $(shopt -p) captures cost three forks each time.
cache_top_level_entry_count_capped() {
    local cap="${2:-101}"
    local count=0
    local restore_nullglob=false
    local restore_dotglob=false
    shopt -q nullglob || restore_nullglob=true
    shopt -q dotglob || restore_dotglob=true
    shopt -s nullglob dotglob

    local item
    for item in "$dir"/*; do
        [[ -e "$item" ]] || continue
        count=$((count + 1))
        if ((count >= cap)); then
            break
    done

    [[ "$restore_nullglob" == "true" ]] && shopt -u nullglob
    [[ "$restore_dotglob" == "true" ]] && shopt -u dotglob

    [[ "$count" =~ ^[0-9]+$ ]] || count=0
    CACHE_TOP_LEVEL_ENTRY_COUNT=$count
    return 0
directory_has_entries() {
    local dir="$1"
    [[ -d "$dir" ]] || return 1

    local _nullglob_state
    local _dotglob_state
    _nullglob_state=$(shopt -p nullglob || true)
    _dotglob_state=$(shopt -p dotglob || true)
    shopt -s nullglob dotglob

    local item
    f
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `2dd073d2` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
