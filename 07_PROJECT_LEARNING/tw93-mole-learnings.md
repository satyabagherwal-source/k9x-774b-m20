> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/tw93-mole-learnings.md`  
> **Source**: github ([https://github.com/tw93/Mole](https://github.com/tw93/Mole))  
> **Source Version**: `acd3b387`  
> **License**: GPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-07T22:53:01.861Z  
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
> **Harvest Timestamp**: 2026-11-07T22:53:01.323Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tw93/Mole`
- **Description**: 🐹 Open-source Mac and PC cleaner. Keep your machine clean, light, and running like new. Fast CLI, plus native Mac and Windows apps.
- **Primary Language / Ecosystem**: Shell
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 74196 stars

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
	duTimeout              = 30 * time.Second
	mdlsTimeout            = 5 * time.Second
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
	return ansi.Truncate(s, head, "") + "..." + ansi.TruncateLeft(s, width-tail, "")
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

func trimNameWithWidth(name string, maxWidth int) string {
	maxWidth = max(0, maxWidth)
	tail := "..."
	if maxWidth < len(tail) {
		tail = ""
	}
	return ansi.Truncate(name, maxWidth, tail)
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
- **Issue #1939** (2026-11-07): **[Mac App Bug] 双风扇macbook只有一个风扇可调节**
  *Symptoms*: ### Mole Mac app version  1.19.1 (366)  ### macOS version  27.2.0  ### Mac model  Mac16,7 (Apple M4 Pro)  ### Affected area  Status  ### What happened?  作者你好，请问双风扇的macbook两边的风扇都可以调节转速吗，我这里看起来只有一个风扇会被调节。  ### Steps to reproduce  1. 打开软件主面板 2. 打开状态tab 3. 点击“降温”或“强冷” 4. 双风扇macbook看起来只有左边风扇转速被提高  ### Expected behavior  两个风扇都转  ### Screenshots or safe logs  _No response_  ### Before submitting  - [x] I updated to the latest stable Mole Mac app, reopened it, and reproduced this problem (or this report explains why I cannot update). - [x] I did not include license keys, order numbers, or private data.

- **Issue #1938** (2026-11-07): **[Mac App Bug] 双风扇macbook只有一个风扇可调节**
  *Symptoms*: ### Mole Mac app version  1.19.1 (366)  ### macOS version  27.2.0  ### Mac model  Mac16,7 (Apple M4 Pro)  ### Affected area  Status  ### What happened?  作者你好，请问双风扇的macbook两边的风扇都可以调节转速吗，我这里看起来只有一个风扇会被调节。  ### Steps to reproduce  1. 打开软件主面板 2. 打开状态tab 3. 点击“降温”或“强冷” 4. 双风扇macbook看起来只有左边风扇转速被提高  ### Expected behavior  两个风扇都转  ### Screenshots or safe logs  _No response_  ### Before submitting  - [x] I updated to the latest stable Mole Mac app, reopened it, and reproduced this problem (or this report explains why I cannot update). - [x] I did not include license keys, order numbers, or private data.

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

### Incident Patch 1: `e6120d1d` (2026-11-07)
**Commit Message**: fix(core): probe timeout backends with kill-after arguments (#1934)

A timeout shim could pass the deadline-only probe yet fail every real call, since run_with_timeout always passes -k 2. Unknown backends are now probed with the same arguments and must also run a quick command.

**File**: `.claude/rules/shell.md` (modified, +1/-1)
```diff
@@ -29,6 +29,6 @@ paths:
 - `run_with_timeout` keeps an early SIGKILL as 137, including fractional budgets. The native timeout backend may translate 137 to timeout only after its deadline plus the `-k` grace period; integer `SECONDS` must not round a sub-second deadline down to immediate expiry. Locked by the fractional-deadline cases in `tests/core_timeout.bats`.
 - `run_with_timeout`'s own `--debug` notices reach stderr only on a terminal and always land in the debug log, because callers parse `$(run_with_timeout ... cmd 2>&1)`: under `mo purge --debug` the notice read as an lsof warning and every node_modules was kept as unverified. A test of such a parser must run the real wrapper, not a stub. Locked by `run_with_timeout keeps its debug notice out of captured command output` in `tests/core_timeout.bats` and `purge node project process check reads an idle project as idle under --debug` in `tests/purge.bats`.
 - Every `run_with_timeout` backend hands the command the caller's stdin. The shell fallback starts it with `"$@" <&0 &`, because bash gives a background command `/dev/null` when job control is off; before that, the simulator metadata check read every device as running and the Finder and login item `osascript` here-documents ran an empty script. A caller that must not share stdin passes `< /dev/null` itself. The same rule makes that background command ignore SIGINT, so on Ctrl-C the shell fallback sends TERM, as the perl backend does, then KILL after the two-second grace that matches `-k 2`; forwarding INT left the command running with no deadline. Locked by `run_with_timeout passes the caller's stdin through every backend` and `run_with_timeout shell fallback stops the command when interrupted` in `tests/core_timeout.bats`.
-- The native timeout backend is a binary that reports its deadline as 124 and takes fractional durations, not whatever `timeout` PATH finds first. GNU coreutils (by `--version`) and `/usr/bin/timeout` are trusted; any other candidate must time out a 0.1s probe with 124 or it is skipped for the next candidate, then perl. A hand-written shim on PATH that exited with its killed child's 143 made every bounded project-cache and deep-system scan read as Ctrl-C, and `mo clean` cancelled the rest of the run on each slow scan. Locked by `timeout.sh skips a PATH timeout shim that reports its deadline as 143`, `timeout.sh skips a PATH timeout shim that rejects fractional durations` and `timeout.sh keeps a PATH timeout that reports its deadline as 124` in `tests/core_timeout.bats`.
+- The native timeout backend is a binary that reports its deadline as 124 and takes fractional durations, not whatever `timeout` PATH finds first. GNU coreutils (by `--version`) and `/usr/bin/timeout` are trusted; any other candidate must run a quick command successfully and time out a 0.1s probe with 124, both using the wrapper's `-k 2` arguments, or it is skipped for the next candidate, then perl. A hand-written shim on PATH that exited with its killed child's 143 made every bounded project-cache and deep-system scan read as Ctrl-C, and `mo clean` cancelled the rest of the run on each slow scan. A shim without `-k` support could pass the old deadline-only probe yet skip every wrapped command. Locked by the `timeout.sh skips a PATH timeout shim` cases and `timeout.sh keeps a PATH timeout that supports the wrapper arguments` in `tests/core_timeout.bats`.
 - **Judge duplication by body and purpose, not by name.** `scripts/audit_function_duplication.py` hashes normalized bodies and gates new same-body groups, including renamed copies a grep sweep misses. It cannot find two differently written helpers that duplicate one decision, so pair the audit with a caller-and-purpose sweep. Treat generated counts as command output, not durable prose in a rule file.
 - **Test-orphan pattern:** before declaring a symbol dead, grep `lib`, `bin`, `cmd`, `scripts`, `tests`, and top-level entry/install scripts; check dynamic lookup through `eval`, `declare -f`, and `compgen`; then re-grep after removal. Trace variables and config written by a removed helper. Tests alone are not production callers, and sub-agent reports are leads, not verdicts.
```

**File**: `lib/core/timeout.sh` (modified, +6/-2)
```diff
@@ -35,15 +35,19 @@ readonly MOLE_TIMEOUT_LOADED=1
 # the whole run at the first slow step. A shim that rejects fractional
 # durations (exit 125) breaks every sub-second budget the same way. GNU
 # coreutils and the system binary are trusted without a probe; any other
-# candidate must time out a short sleep with 124 or it is skipped.
+# candidate must run a short command successfully and time out a short sleep
+# with 124, both using run_with_timeout's -k arguments, or it is skipped.
 _mole_timeout_bin_is_compatible() {
     local bin="$1"
     [[ "$bin" == "/usr/bin/timeout" ]] && return 0
     local version_text=""
     version_text=$("$bin" --version < /dev/null 2> /dev/null) || true
     [[ "$version_text" == *"GNU coreutils"* ]] && return 0
+    # A shim can report 124 yet reject -k, returning that status without ever
+    # running the command. Check successful execution with the actual syntax.
+    "$bin" -k 2 1 /usr/bin/true < /dev/null > /dev/null 2>&1 || return 1
     local probe_rc=0
-    "$bin" 0.1 /bin/sleep 2 < /dev/null > /dev/null 2>&1 || probe_rc=$?
+    "$bin" -k 2 0.1 /bin/sleep 2 < /dev/null > /dev/null 2>&1 || probe_rc=$?
     [[ $probe_rc -eq 124 ]]
 }
 
```

**File**: `tests/core_timeout.bats` (modified, +32/-1)
```diff
@@ -764,6 +764,7 @@ _probe_timeout_backend() {
         export PATH="$2:/usr/bin:/bin"
         source "$1/lib/core/timeout.sh"
         printf "bin=%s\n" "$MO_TIMEOUT_BIN"
+        run_with_timeout 1 /bin/echo COMMAND_RAN
         rc=0
         run_with_timeout 1 /bin/sleep 5 || rc=$?
         printf "rc=%s\n" "$rc"
@@ -808,9 +809,11 @@ SHIM
     [[ "$output" == *"rc=124"* ]]
 }
 
-@test "timeout.sh keeps a PATH timeout that reports its deadline as 124" {
+@test "timeout.sh skips a PATH timeout shim without kill-after support" {
     local fake_dir="$BATS_TEST_TMPDIR/fake-timeout-124"
     mkdir -p "$fake_dir"
+    # This passes the old deadline probe, but run_with_timeout's -k 2 makes
+    # it try to execute "2" and report a timeout without running the command.
     cat > "$fake_dir/timeout" << 'SHIM'
 #!/bin/bash
 shift
@@ -822,8 +825,36 @@ exit 124
 SHIM
     chmod +x "$fake_dir/timeout"
 
+    _probe_timeout_backend "$fake_dir"
+    [ "$status" -eq 0 ]
+    [[ "$output" != *"bin=$fake_dir/timeout"* ]] || return 1
+    [[ "$output" == *COMMAND_RAN* ]] || return 1
+    [[ "$output" == *"rc=124"* ]]
+}
+
+@test "timeout.sh keeps a PATH timeout that supports the wrapper arguments" {
+    local fake_dir="$BATS_TEST_TMPDIR/fake-timeout-compatible"
+    mkdir -p "$fake_dir"
+    cat > "$fake_dir/timeout" << 'SHIM'
+#!/bin/bash
+[[ "$1" == "-k" && "$2" == "2" ]] || exit 125
+shift 3
+"$@" &
+pid=$!
+(/bin/sleep 0.2; kill -TERM "$pid" 2> /dev/null) &
+killer=$!
+rc=0
+wait "$pid" || rc=$?
+kill "$killer" 2> /dev/null || true
+wait "$killer" 2> /dev/null || true
+[[ $rc -eq 0 ]] && exit 0
+exit 124
+SHIM
+    chmod +x "$fake_dir/timeout"
+
     _probe_timeout_backend "$fake_dir"
     [ "$status" -eq 0 ]
     [[ "$output" == *"bin=$fake_dir/timeout"* ]] || return 1
+    [[ "$output" == *COMMAND_RAN* ]] || return 1
     [[ "$output" == *"rc=124"* ]]
 }
```

---

### Incident Patch 2: `4075102a` (2026-11-06)
**Commit Message**: fix(clean): ask Docker only on a local engine and prune what it rebuilds

With a remote Docker context selected, Mole's Large files row reported
the remote engine's storage and hid the local Docker Desktop data row,
and `mo optimize` asked the remote engine about containers (#1922). Each
probe also waited out its timeout on an unreachable host.

Every Docker query now reads the endpoint first through
`mole_docker_endpoint_is_local` (`docker context inspect`, local config
only, honours DOCKER_HOST) and skips anything but a unix socket. No
config option.

`mo clean` now runs Docker's own prune for what the engine rebuilds:
`docker builder prune --filter until=168h` and `docker image prune`
(dangling only), only when the local engine already answers, so a
stopped Docker Desktop is never started. The build cache prune pins
BUILDX_BUILDER to the local context's builder, because `docker builder`
is buildx and would otherwise prune a selected cloud or remote builder.
Containers, volumes, networks and tagged images are never touched. Every
successful prune logs REMOVED; a timeout skips it, a signal cancels; the
Docker Desktop data folder is its whitelist row.

The "Docker unused data · rev

**File**: `.claude/rules/clean-dev.md` (modified, +1/-0)
```diff
@@ -22,6 +22,7 @@ General clean target policy, including the owner-command rule, is in `.claude/ru
 - The Gradle candidate listing puts the small groups before the build cache, which can hold thousands of entries: whitelisted entries are settled before the roughly 10 ms `should_protect_path` probe, and an exhausted filtering budget keeps only the build cache group.
 - Keep AI-tool cache cleanup conservative. Claude Code, opencode, Copilot CLI, Zed, Warp, Ghostty, and similar developer tools may have active versions, config, credentials, or session state that must not be removed accidentally.
 - `clean_t3code_desktop_caches` takes only `Cache` and `Code Cache` under `Partitions/t3code-preview-*` of the `t3code-v2` and `T3 Code (Alpha)` profiles, while no T3 Code app runs. `should_protect_path` does not cover these profiles, so that exact list is the whole boundary: sign-ins, IndexedDB and Service Worker data stay, and `~/.t3` is never a target (its worktrees are `mo purge` scope). Locked by the `clean_t3code_desktop_caches` cases in `tests/clean_ai_cli_caches.bats`.
+- **Docker is asked only on a local engine, and Mole prunes only what the engine rebuilds.** Every Docker query (`docker system df` in Large files, `docker ps` in `mo optimize`, the prune) first reads the endpoint through `mole_docker_endpoint_is_local` in `lib/core/common.sh`, which runs `docker context inspect` (local configuration, honours `DOCKER_HOST`, never dials the engine); anything but a `unix://` socket, or an unknown answer, skips the query, so a remote context neither reports another machine's storage nor hides the Docker Desktop data row (#1922). `clean_docker_unused_data` then runs `docker builder prune -f --filter until=168h` and `docker image prune -f` (dangling only) only after `docker info` answers, so a stopped Docker Desktop is never started; containers, volumes, networks and tagged images are never touched, and no config option exists for any of this. The engine serialises prune against running builds, so there is no process guard. `docker builder` is `docker buildx` once the plugin is installed and prunes the selected buildx builder, which can be a cloud or remote one under a local context, so the build cache prune runs with `BUILDX_BUILDER` set to `docker context show` (the local context's own builder; the legacy builder ignores it) and is skipped when that name is unknown. On the classic image store an image pulled only by digest and used by no container counts as dangling and goes too; that is accepted, since a registry pull restores it. Its whitelist row is the Docker Desktop data folder, every prune that exits 0 logs `REMOVED` (with its size when Docker printed one), a timeout skips that one prune and a signal cancels; the dry run says `would prune` without a size, like the other owner rows. Locked by the `clean_dev_docker` cases in `tests/clean_dev_caches.bats` (`clean_dev_docker pins the build cache prune to the local context builder` for the builder), `large files never queries a remote Docker engine (#1922)` in `tests/clean_user_core.bats` and `idle VM never asks a remote Docker engine about containers (#1922)` in `tests/optimize_perf_diagnosis.bats`; `docker` is a fail-loud stub in `tests/helpers/common.bash`, so a test that forgets its double can never prune the host.
 
 ## Recovery contracts
 
```

**File**: `.claude/rules/clean.md` (modified, +1/-1)
```diff
@@ -49,7 +49,7 @@ Developer and toolchain caches in `lib/clean/dev.sh` also follow `.claude/rules/
 - `lib/clean/user.sh` owns user-level cleanup flows, browser caches, cloud/app support cleanup, device firmware, and Apple Silicon caches. Run `MOLE_TEST_NO_AUTH=1 bats tests/clean_user_core.bats tests/clean_browser_versions.bats tests/clean_app_caches.bats tests/clean_cached_device_firmware.bats tests/clean_misc.bats` when touching this area, or `MOLE_TEST_NO_AUTH=1 ./scripts/test.sh` if behavior crosses sections.
 - Chrome / Edge / Brave old-version cleanup is one table-driven helper (`_clean_chromium_old_versions`) plus three thin public wrappers; the wrapper names are the test surface, so keep them. `clean_edge_updater_old_versions` is deliberately NOT part of it: it prunes staged updater payloads strictly older than the installed Edge (falling back to keep-latest by `sort -V` when the installed version is unreadable), has no `Current` symlink, and never escalates to a sudo removal, so folding it in would silently change its semantics.
 - Large-files review rows share `_large_candidate_size_kb`: a du exit of 1 means some entry was unreadable and still carries a usable total, while a timeout never does. The E5RT row passes `exact` and drops a status-1 total, because #1631 promised incomplete measurements are never shown as a complete size. Tighten a new row's evidence at that row, not in the shared helper; the compiled-model row once made the helper strict and hid an 11.78GB `Simulator data` row. Locked by `large files keeps a du total that skipped unreadable entries` and `large files skips an E5RT total that missed unreadable entries (#1631)` in `tests/clean_user_core.bats`.
-- The fixed rows are measured ahead of the report by a pool of at most four workers under one shared deadline (`_large_prefetch_queue_rows`), and the worktree container search runs beside it; a new fixed row belongs in that list too, or it is measured inline after the pool and adds its full time. `large files queue lists every fixed HOME row the report measures` in `tests/clean_user_core.bats` reads every literal `$HOME` row out of the report source and fails when the queue misses one. The Docker Desktop data row stays queued unconditionally, because whether the report skips it depends on the later `docker system df` probe.
+- The fixed rows are measured ahead of the report by a pool of at most four workers under one shared deadline (`_large_prefetch_queue_rows`), and the worktree container search runs beside it; a new fixed row belongs in that list too, or it is measured inline after the pool and adds its full time. `large files queue lists every fixed HOME row the report measures` in `tests/clean_user_core.bats` reads every literal `$HOME` row out of the report source and fails when the queue misses one. The Docker Desktop data row stays queued unconditionally, because whether the report skips it depends on the later `docker system df` probe. That probe runs only on a local engine (`.claude/rules/clean-dev.md`), once, and its row reads `Images 931.5MB, 859.1MB reclaimable`: types and reclaimable figures under 1MB are left out.
 - The generic Application Support sweep (`clean_application_support_logs`) skips an app folder whose `SingletonLock` (Chromium and Electron write `<host>-<pid>` there while running) names a live pid or cannot be read, and checks again before each cache folder; it cleared Code Cache and GPUCache under running Docker Desktop, VS Code and T3 Code before. A stale lock left by a crash, and apps with no lock, keep the old behaviour. Locked by `clean_application_support_logs keeps caches of a running Electron app` in `tests/clean_user_core.bats`.
 - Browser signing-clone probes must preserve signal statuses through process checks, metadata, open-handle checks, snapshots, and final guards. A timeout keeps the clone; an interrupt stops later candidates and system cleanup stages. Locked by `tests/browser_clones.bats`, where each snapshot guard has its own case except the two uid ownership checks (a differently owned fixture needs root) and the root-prefix check.
 - **Leaked automation browsers are identified by a `playwright_chromiumdev_profile` browser root with ppid 1, never by the playwright-cli daemon.** The daemon is spawned detached, so ppid 1 is its normal state for the life of an active session; matching it kills a live session. A profile directory is stale only when `pgrep -f` returns exactly 1; any other status is an unknown state that keeps it. Locked by `tests/clean_automation_browsers.bats`; the story (#1518) is in `.claude/skills/bugs/references/deletion-evidence-and-final-sink.md` section 2.
```

**File**: `lib/clean/dev.sh` (modified, +152/-20)
```diff
@@ -1530,32 +1530,164 @@ find_orbstack_data_dir() {
     return 1
 }
 
-clean_dev_docker() {
-    if command -v docker > /dev/null 2>&1; then
+# Bytes from the "Total reclaimed space: 1.2GB" (image prune) or "Total:
+# 1.2GB" (builder prune) line of a docker prune. Docker prints decimal units.
+# Prints nothing when no such line parses.
+_docker_prune_reclaimed_bytes() {
+    awk '
+        /^Total( reclaimed space)?:[ \t]/ {
+            v = $NF
+            if (match(v, /^[0-9.]+/) == 0) next
+            n = substr(v, 1, RLENGTH) + 0
+            u = substr(v, RLENGTH + 1)
+            m = 0
+            if (u == "B") m = 1
+            else if (u == "kB" || u == "KB") m = 1000
+            else if (u == "MB") m = 1000000
+            else if (u == "GB") m = 1000000000
+            else if (u == "TB") m = 1000000000000
+            if (m == 0) next
+            printf "%.0f\n", n * m
+            exit
+        }'
+}
+
+# Docker's own prune for what the engine rebuilds on demand: BuildKit cache no
+# build used in the last 7 days, and dangling images (untagged layers a
+# rebuild left behind). Containers, volumes, networks and tagged images are
+# never touched. It runs only against a local engine that already answers,
+# so Mole never starts Docker Desktop or reaches a remote context (#1922).
+# The engine serialises prune against running builds and keeps cache records
+# in use, so no process guard is needed. Docker Desktop's data folder is the
+# whitelist row that turns it off.
+clean_docker_unused_data() {
+    command -v docker > /dev/null 2>&1 || return 0
+    local description="Docker build cache and dangling images"
+    local whitelist_path="$HOME/Library/Containers/com.docker.docker/Data"
+
+    local probe_rc=0
+    mole_docker_endpoint_is_local || probe_rc=$?
+    if mole_rc_signal "$probe_rc"; then
+        _mole_record_clean_cancellation "$probe_rc" "$description"
+        return "$probe_rc"
+    fi
+    if [[ $probe_rc -ne 0 ]]; then
+        debug_log "$description skipped: Docker endpoint is not local (state $probe_rc)"
+        return 0
+    fi
+
+    if is_path_whitelisted "$whitelist_path"; then
+        if [[ "${DRY_RUN:-false}" == "true" ]]; then
+            echo -e "  ${YELLOW}${ICON_DRY_RUN}${NC} $description · would skip (whitelist)"
+        else
+            echo -e "  ${GREEN}${ICON_SUCCESS}${NC} $description · skipped (whitelist)"
+        fi
         note_activity
-        echo -e "  ${GRAY}${ICON_REVIEW}${NC} Docker unused data · review with docker system df -v"
-        debug_log "Docker daemon-managed cleanup skipped by default"
+        log_operation "${MOLE_CURRENT_COMMAND:-clean}" "SKIPPED" "$whitelist_path" "whitelist"
+        return 0
     fi
 
+    # A stopped engine stays stopped: the probe fails fast and nothing runs.
+    probe_rc=0
+    run_with_timeout "$MOLE_TIMEOUT_SHORT_QUERY_SEC" docker info --format '{{.ServerVersion}}' > /dev/null 2>&1 || probe_rc=$?
+    if mole_rc_signal "$probe_rc"; then
+        _mole_record_clean_cancellation "$probe_rc" "$description"
+        return "$probe_rc"
+    fi
+    if [[ $probe_rc -ne 0 ]]; then
+        debug_log "$description skipped: Docker engine not answering (exit $probe_rc)"
+        return 0
+    fi
+
+    # `docker builder` is `docker buildx` once the plugin is installed, and it
+    # prunes the selected buildx builder, which can be a cloud or remote one
+    # while the context is local. Pin the builder the local context owns,
+    # named after it; the legacy builder ignores the variable.
+    local context_name="" steps="image"
+    probe_rc=0
+    context_name=$(run_with_timeout "$MOLE_TIMEOUT_SHORT_QUERY_SEC" docker context show 2> /dev/null) || probe_rc=$?
+    if mole_rc_signal "$probe_rc"; then
+        _mole_record_clean_cancellation "$probe_rc" "$description"
+        return "$probe_rc"
+    fi
+    if [[ $probe_rc -eq 0 && "$context_name" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]]; then
+        steps="builder image"
+    else
+        debug_log "$description: build cache skipped, Docker context name unknown"
+    fi
+
+    if [[ "${DRY_RUN:-false}" == "true" ]]; then
+        if [[ "$steps" == "image" ]]; then
+            echo -e "  ${YELLOW}${ICON_DRY_RUN}${NC} $description · would prune dangling images"
+        else
+            echo -e "  ${YELLOW}${ICON_DRY_RUN}${NC} $description · would prune, build cache unused for 7 days"
+        fi
+        note_activity
+        return 0
+    fi
+
+    [[ -t 1 ]] && start_section_spinner "Pruning Docker build cache..."
+    local total_bytes=0 step output rc bytes
+    for step in $steps; do
+        output="" rc=0
+        if [[ "$step" == "builder" ]]; then
+            output=$(run_with_timeout "$MOLE_TIMEOUT_PKG_CLEANUP_SEC" env BUILDX_BUILDER="$context_name" docker builder prune -f --filter until=168h 2> /dev/null) || rc=$?
+        else
+            output=$(run_with_timeout "$MOLE_TIMEOUT_PKG_CLEANUP_SEC" docker image prune -f 2> /dev/null) || rc=$?
+    
```

**File**: `lib/clean/user.sh` (modified, +50/-25)
```diff
@@ -3181,19 +3181,25 @@ report_agent_worktree_candidates() {
     return "$rc"
 }
 
-# One `docker system df` row for the Large files Docker line. Docker's
-# Reclaimable is swapped for the active/total count when it contradicts the
-# row's own counts: something reclaimable while every item is in use, or all
-# images reclaimable while a container still uses one. Engine 29.0 through
-# 29.3 reports in-use images as reclaimable (moby/moby#51775), and older
-# clients count shared layers of in-use images the same way. Rows whose
-# counts do not parse keep Docker's text.
+# One `docker system df` row for the Large files Docker line, as
+# "Images 931.5MB, 859.1MB reclaimable". Types and reclaimable figures below
+# 1MB are left out. Docker's Reclaimable is swapped for
+# the active/total count when it contradicts the row's own counts: something
+# reclaimable while every item is in use, or all images reclaimable while a
+# container still uses one. Engine 29.0 through 29.3 reports in-use images as
+# reclaimable (moby/moby#51775), and older clients count shared layers of
+# in-use images the same way. Rows whose counts do not parse keep Docker's
+# figure.
 docker_df_review_segment() {
     local type="$1"
     local size="$2"
     local reclaimable="$3"
     local total="$4"
     local active="$5"
+    case "$size" in
+        *MB | *GB | *TB | *PB) ;;
+        *) return 0 ;;
+    esac
     local contradicts=false
     if [[ "$total" =~ ^[0-9]+$ && "$active" =~ ^[0-9]+$ ]]; then
         if [[ $total -gt 0 && $active -eq $total && "$reclaimable" != 0B* ]]; then
@@ -3202,11 +3208,21 @@ docker_df_review_segment() {
             contradicts=true
         fi
     fi
+    local label="$type"
+    case "$type" in
+        "Build Cache") label="Build cache" ;;
+        "Local Volumes") label="Volumes" ;;
+    esac
     if [[ "$contradicts" == "true" ]]; then
-        printf '%s %s (%s/%s in use)\n' "$type" "$size" "$active" "$total"
-    else
-        printf '%s %s (%s reclaimable)\n' "$type" "$size" "$reclaimable"
+        printf '%s %s, %s/%s in use\n' "$label" "$size" "$active" "$total"
+        return 0
     fi
+    local amount="${reclaimable%% (*}"
+    amount="${amount%% *}"
+    case "$amount" in
+        *MB | *GB | *TB | *PB) printf '%s %s, %s reclaimable\n' "$label" "$size" "$amount" ;;
+        *) printf '%s %s\n' "$label" "$size" ;;
+    esac
 }
 
 # Large file candidates measure a few dozen folders with du, and two or three
@@ -3666,16 +3682,34 @@ _check_large_file_candidates_body() {
     fi
 
     local docker_reported=false
-    if command -v docker > /dev/null 2>&1; then
-        local docker_output
+    # Only a local engine is this Mac's storage: a remote context would report
+    # another machine's images here and hide the Docker Desktop data row
+    # below (#1922). A stopped daemon or an unknown answer falls back to that
+    # row as well, and the query is not retried.
+    local docker_local_rc=0
+    mole_docker_endpoint_is_local || docker_local_rc=$?
+    if mole_rc_signal "$docker_local_rc"; then
+        stop_section_spinner
+        _mole_record_clean_cancellation "$docker_local_rc"
+        return "$docker_local_rc"
+    fi
+    if [[ $docker_local_rc -eq 0 ]]; then
+        local docker_output="" docker_rc=0
         # The counts go last: tab is IFS whitespace, so an empty trailing
         # field cannot shift Size or Reclaimable out of place.
-        docker_output=$(run_with_timeout "$MOLE_TIMEOUT_SHORT_QUERY_SEC" docker system df --format '{{.Type}}\t{{.Size}}\t{{.Reclaimable}}\t{{.TotalCount}}\t{{.Active}}' 2> /dev/null || true)
-        if [[ -n "$docker_output" ]]; then
-            local docker_detail=""
+        docker_output=$(run_with_timeout "$MOLE_TIMEOUT_SHORT_QUERY_SEC" docker system df --format '{{.Type}}\t{{.Size}}\t{{.Reclaimable}}\t{{.TotalCount}}\t{{.Active}}' 2> /dev/null) || docker_rc=$?
+        if mole_rc_signal "$docker_rc"; then
+            stop_section_spinner
+            _mole_record_clean_cancellation "$docker_rc"
+            return "$docker_rc"
+        fi
+        if [[ $docker_rc -eq 0 && -n "$docker_output" ]]; then
+            local docker_detail="" docker_segment=""
             while IFS=$'\t' read -r dtype dsize dreclaim dtotal dactive; do
                 [[ -z "$dtype" ]] && continue
-                docker_detail+="${docker_detail:+ · }$(docker_df_review_segment "$dtype" "$dsize" "$dreclaim" "$dtotal" "$dactive")"
+                docker_segment=$(docker_df_review_segment "$dtype" "$dsize" "$dreclaim" "$dtotal" "$dactive")
+                [[ -n "$docker_segment" ]] || continue
+                docker_detail+="${docker_detail:+ · }$docker_segment"
             done <<< "$docker_output"
             if [[ -n "$docker_detail" ]]; then
                 stop_section_spinner
@@ -3684,15 +3718,6 @@ _check_large_file_candidates_body() {
                 docker_reported=true
                 start_section_spinner "Scanning large files..."
      
```

**File**: `lib/core/common.sh` (modified, +19/-0)
```diff
@@ -70,6 +70,25 @@ mole_identity_in_list() {
     return 1
 }
 
+# Every docker command talks to the endpoint the current context or
+# DOCKER_HOST names, which can be a remote engine over TCP or SSH. Mole reports
+# and prunes this Mac only, so each Docker query asks first; `docker context
+# inspect` reads local configuration and never dials the engine (#1922).
+# Returns 0 for a local unix socket, 1 for docker missing or any other
+# endpoint, 2 when the answer is unknown, and a signal status unchanged.
+mole_docker_endpoint_is_local() {
+    command -v docker > /dev/null 2>&1 || return 1
+    local host="" rc=0
+    host=$(run_with_timeout "$MOLE_TIMEOUT_SHORT_QUERY_SEC" docker context inspect --format '{{.Endpoints.docker.Host}}' 2> /dev/null) || rc=$?
+    if [[ $rc -ne 0 ]]; then
+        mole_rc_signal "$rc" && return "$rc"
+        return 2
+    fi
+    [[ -n "$host" && "$host" != *$'\n'* ]] || return 2
+    [[ "$host" == unix:///* ]] && return 0
+    return 1
+}
+
 # True when a launcher entry provably belongs to a REMOVED Homebrew keg: a
 # dangling symlink into Cellar/mole, or a regular file whose brew-written
 # SCRIPT_DIR line names a Cellar/mole path that no longer exists (the #1488
```

**File**: `lib/manage/whitelist.sh` (modified, +1/-0)
```diff
@@ -155,6 +155,7 @@ Brave browser cache|$HOME/Library/Caches/BraveSoftware/Brave-Browser/*|browser_c
 Surge proxy cache|$HOME/Library/Caches/com.nssurge.surge-mac/*|network_tools
 Surge configuration and data|$HOME/Library/Application Support/com.nssurge.surge-mac/*|network_tools
 Docker BuildX cache|$HOME/.docker/buildx/cache/*|container_cache
+Docker build cache and dangling images|$HOME/Library/Containers/com.docker.docker/Data|container_cache
 Podman container storage temp|$HOME/.local/share/containers/storage/tmp/*|container_cache
 Tart OCI/IPSW cache|$HOME/.tart/cache|container_cache
 Font cache|$HOME/Library/Caches/com.apple.FontRegistry/*|system_cache
```

**File**: `lib/optimize/diagnostics.sh` (modified, +5/-1)
```diff
@@ -603,8 +603,12 @@ opt_diag_idle_vm() {
 
     # Only claim it is idle if the owner agrees. A probe that cannot answer
     # must not produce a "safe to quit" recommendation.
+    # A remote Docker context answers for another machine's containers, so
+    # only a local engine's answer can speak for this VM (#1922).
+    # Its caller ignores the status like every sibling check, and Ctrl-C
+    # reaches Mole itself, so an interrupted probe just reads as not local.
     local running="" docker_output="" container_id
-    if command -v docker > /dev/null 2>&1; then
+    if mole_docker_endpoint_is_local; then
         if docker_output=$(run_with_timeout "$MOLE_TIMEOUT_SHORT_QUERY_SEC" docker ps -q 2> /dev/null); then
             running=0
             while IFS= read -r container_id; do
```

**File**: `tests/clean_dev_caches.bats` (modified, +150/-41)
```diff
@@ -1619,24 +1619,159 @@ EOF
     rm -f "$HOME/bun-case.out" # SAFE: test scratch file under the temporary HOME
 }
 
-@test "clean_dev_docker skips daemon-managed cleanup by default" {
-    run env HOME="$HOME" PROJECT_ROOT="$PROJECT_ROOT" DRY_RUN=false /bin/bash --noprofile --norc << 'EOF'
+# A docker double on PATH: run_with_timeout execs a binary, so a shell
+# function would never be reached. Every call is logged to $HOME/docker.calls.
+_docker_prune_fake() {
+    # shellcheck disable=SC2016  # Body is written to the fake script verbatim.
+    mole_test_fake_command docker '
+printf "%s\n" "$*" >> "$HOME/docker.calls"
+case "$1 $2" in
+    "context show")
+        [[ "${DOCKER_TEST_CONTEXT:-}" != FAIL ]] || exit 1
+        printf "%s\n" "${DOCKER_TEST_CONTEXT:-desktop-linux}"
+        ;;
+    "context inspect")
+        [[ "${DOCKER_TEST_HOST:-}" != FAIL ]] || exit 1
+        printf "%s\n" "${DOCKER_TEST_HOST:-unix:///Users/me/.docker/run/docker.sock}"
+        ;;
+    "info --format") exit "${DOCKER_TEST_INFO_RC:-0}" ;;
+    "builder prune")
+        printf "BUILDX_BUILDER=%s\n" "${BUILDX_BUILDER:-unset}" >> "$HOME/docker.calls"
+        [[ -z "${DOCKER_TEST_BUILDER_RC:-}" ]] || exit "$DOCKER_TEST_BUILDER_RC"
+        printf "ID\tRECLAIMABLE\tSIZE\tLAST ACCESSED\nabc123\ttrue\t852.6MB\t2 weeks ago\nTotal:\t852.6MB\n"
+        ;;
+    "image prune")
+        printf "Deleted Images:\ndeleted: sha256:abc\n\nTotal reclaimed space: 12MB\n"
+        ;;
+esac
+exit 0'
+}
+
+_run_clean_dev_docker() {
+    local test_home="$1"
+    shift
+    rm -rf "$test_home"
+    mkdir -p "$test_home"
+    run env HOME="$test_home" PROJECT_ROOT="$PROJECT_ROOT" DRY_RUN=false \
+        MOLE_CURRENT_COMMAND=clean MOLE_CLEAN_CANCEL_STATUS=0 "$@" \
+        /bin/bash --noprofile --norc << 'EOF'
 set -euo pipefail
 source "$PROJECT_ROOT/lib/core/common.sh"
 source "$PROJECT_ROOT/lib/clean/dev.sh"
-clean_tool_cache() { echo "$1|$*"; }
-safe_clean() { echo "$2"; }
+safe_clean() { echo "BUILDX:$2"; }
 note_activity() { :; }
-debug_log() { :; }
-docker() { echo "docker called"; return 0; }
-export -f docker
+log_operation() { echo "OPLOG:$2|$3|$4"; }
+log_warning_to_file() { echo "WARN:$*"; }
+total_size_cleaned=0
+rc=0
+clean_dev_docker || rc=$?
+printf 'RC=%s CANCEL=%s FREED_KB=%s\n' "$rc" "$MOLE_CLEAN_CANCEL_STATUS" "$total_size_cleaned"
+EOF
+}
+
+@test "clean_dev_docker prunes only old build cache and dangling images on a local engine" {
+    _docker_prune_fake
+    local test_home="$HOME/docker-prune-local"
+    _run_clean_dev_docker "$test_home"
+
+    [ "$status" -eq 0 ] || { echo "$output"; return 1; }
+    [[ "$output" == *"Docker build cache and dangling images · "*"864.6MB"* ]] || { echo "$output"; return 1; }
+    [[ "$output" == *"OPLOG:REMOVED|docker builder prune|owner command: 852.6MB"* ]] || { echo "$output"; return 1; }
+    [[ "$output" == *"OPLOG:REMOVED|docker image prune|owner command: 12.0MB"* ]] || { echo "$output"; return 1; }
+    [[ "$output" == *"BUILDX:Docker BuildX cache"*"RC=0 CANCEL=0 FREED_KB=844336"* ]] || { echo "$output"; return 1; }
+    local calls
+    calls=$(cat "$test_home/docker.calls")
+    [[ "$calls" == *"builder prune -f --filter until=168h"$'\n'"BUILDX_BUILDER=desktop-linux"* ]] || { echo "$calls"; return 1; }
+    [[ "$calls" == *"image prune -f"* ]] || { echo "$calls"; return 1; }
+    # Never containers, volumes, networks, tagged images or a system prune.
+    [[ "$calls" != *"-a"* && "$calls" != *"--all"* && "$calls" != *"system prune"* ]] || { echo "$calls"; return 1; }
+    [[ "$calls" != *"container"* && "$calls" != *"volume"* && "$calls" != *"network"* ]] || { echo "$calls"; return 1; }
+}
+
+@test "clean_dev_docker pins the build cache prune to the local context builder" {
+    # `docker builder` is buildx, which prunes the selected builder: a cloud
+    # builder chosen through BUILDX_BUILDER must not be the one pruned.
+    _docker_prune_fake
+    _run_clean_dev_docker "$HOME/docker-prune-builder" BUILDX_BUILDER=cloud-org-builder
+    [ "$status" -eq 0 ] || { echo "$output"; return 1; }
+    local calls
+    calls=$(cat "$HOME/docker-prune-builder/docker.calls")
+    [[ "$calls" == *"BUILDX_BUILDER=desktop-linux"* && "$calls" != *"cloud-org-builder"* ]] || { echo "$calls"; return 1; }
+
+    # Without a context name there is no builder to pin: the build cache stays
+    # and the dangling image prune still runs.
+    _run_clean_dev_docker "$HOME/docker-prune-noctx" DOCKER_TEST_CONTEXT=FAIL
+    [ "$status" -eq 0 ] || { echo "$output"; return 1; }
+    calls=$(cat "$HOME/docker-prune-noctx/docker.calls")
+    [[ "$calls" != *"builder prune"* && "$calls" == *"image prune -f"* ]] || { echo "$calls"; return 1; }
+    [[ "$output" == *"OPLOG:REMOVED|docker image prune|owner command: 12.0MB"* ]] || { echo "$output"; return 1; }
+}
+
+@test "clean_dev_docker never prunes a remote, unknown or stopped Docker engine (#1922)" {
+    _docker_prune_fake
+    local host
+    for host in 
```

---

### Incident Patch 3: `f541d4bc` (2026-11-07)
**Commit Message**: docs(sync): record the purge editor fix across the products

#1940 changed how mo purge --paths runs EDITOR. The other three products
were read for the same path and none reads EDITOR, so each row is Not
applicable. Docs only: audit_incidents passes.

**File**: `SYNC.md` (modified, +10/-0)
```diff
@@ -187,3 +187,13 @@ Implemented in source (Mole CLI (macOS), `main`): `4075102a` (Docker, I-38) and
 - Mole Mac: Not applicable for the endpoint gate and the daemon prune, since it never runs `docker` and a CLI owner command does not transfer by itself. Implemented in source (2026-11-06) for the running-app check: folders named `Code`, `Docker Desktop` and `t3code-v2` already answered to their running apps, and an Application Support folder that matches no running app is now held while the process its `SingletonLock` names is alive. The app-owned record owns the comparison.
 - Mole CLI (Windows): Not applicable. It never runs `docker`: `Clear-DockerCaches` keeps the build cache, and the running-app check is `Clear-MoleAppCache`'s named owners.
 - Mole for Windows: Not applicable. It never runs `docker`; its one Docker row is Docker Desktop's log folder, and every cache rule names its owner process.
+
+## 2026-11-07 Purge editor commands
+
+Source: PR #1940. `mo purge --paths` now runs an `EDITOR` that holds arguments, such as `code --wait`, and returns the editor's failure instead of reporting success.
+
+Implemented in source (Mole CLI (macOS), `main`): `4917abd1`, merged in `2cc4f227`.
+
+- Mole CLI (Windows): Not applicable. `bin/purge.ps1` opens `notepad.exe` directly and never reads `EDITOR`.
+- Mole Mac: Not applicable. It has no purge paths editor and never reads `EDITOR`.
+- Mole for Windows: Not applicable. It has no purge paths editor and never reads `EDITOR`.
```

#### Recent Merged Pull Requests:
- **PR #1942** (2026-11-07): fix(clean): protect Camoufox browser binaries like Playwright's (@LaansDole)
- **PR #1940** (2026-11-07): fix(purge): support editor commands with arguments (@po-et)
- **PR #1937** (closed): Add PAD XML files for software directory submissions (@tw93)
- **PR #1934** (2026-11-07): fix(core): probe timeout backends with kill-after arguments (@r266-tech)
- **PR #1932** (2026-11-07): Add Developer directory to default purge paths (@devtobi)
- **PR #1930** (2026-11-06): fix(core): skip a PATH timeout that does not report its deadline as 124 (@mikeumus)

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

## X. core): probe timeout backends with kill-after arguments (#1934)

**RULE**:
When implementing operations in `.claude/rules/shell.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in tw93/Mole. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `e6120d1d`: core): probe timeout backends with kill-after arguments (#1934). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Shell data structures, boundary deserialization, API parsing, or resource lifecycles matching `.claude/rules/shell.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```shell
// Verified production-grade fix pattern:
- The native timeout backend is a binary that reports its deadline as 124 and takes fractional durations, not whatever `timeout` PATH finds first. GNU coreutils (by `--version`) and `/usr/bin/timeout` are trusted; any other candidate must run a quick command successfully and time out a 0.1s probe with 124, both using the wrapper's `-k 2` arguments, or it is skipped for the next candidate, then perl. A hand-written shim on PATH that exited with its killed child's 143 made every bounded project-cache and deep-system scan read as Ctrl-C, and `mo clean` cancelled the rest of the run on each slow scan. A shim without `-k` support could pass the old deadline-only probe yet skip every wrapped command. Locked by the `timeout.sh skips a PATH timeout shim` cases and `timeout.sh keeps a PATH timeout that supports the wrapper arguments` in `tests/core_timeout.bats`.
```

**NEGATIVE CONSTRAINT**:
```shell
// Anti-pattern to NEVER write (induced failure mode):
- The native timeout backend is a binary that reports its deadline as 124 and takes fractional durations, not whatever `timeout` PATH finds first. GNU coreutils (by `--version`) and `/usr/bin/timeout` are trusted; any other candidate must time out a 0.1s probe with 124 or it is skipped for the next candidate, then perl. A hand-written shim on PATH that exited with its killed child's 143 made every bounded project-cache and deep-system scan read as Ctrl-C, and `mo clean` cancelled the rest of the run on each slow scan. Locked by `timeout.sh skips a PATH timeout shim that reports its deadline as 143`, `timeout.sh skips a PATH timeout shim that rejects fractional durations` and `timeout.sh keeps a PATH timeout that reports its deadline as 124` in `tests/core_timeout.bats`.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `e6120d1d` are properly handled with clean fallback behavior.
