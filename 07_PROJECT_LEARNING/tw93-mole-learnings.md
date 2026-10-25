> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/tw93-mole-learnings.md`  
> **Source**: github ([https://github.com/tw93/Mole](https://github.com/tw93/Mole))  
> **Source Version**: `6020bc9c`  
> **License**: GPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-25T13:08:14.451Z  
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
> **Harvest Timestamp**: 2026-10-25T13:08:13.282Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tw93/Mole`
- **Description**: 🐹 Keep your Mac and PC clean, light, and running like new. Fast open-source CLI, plus native Mac and Windows apps.
- **Primary Language / Ecosystem**: Shell
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 72809 stars

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

var cachedAnalyzerDir atomic.Pointer[resolv
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
- **Issue #1814** (2026-10-23): **[BUG] Incorrect "critical system path" preventing purging**
  *Symptoms*: ## Before submitting  - [x] I updated and reproduced the problem, or this report explains why I cannot update.  ## Describe the bug  I edited ~/.config/mole/purge_paths to add a directory outside my home directory: `/System/Volumes/Data/src`. That directory is also `/src` on my machine through /etc/synthetic.conf:  src     System/Volumes/Data/src  When I run `mo purge --yes`, it finds many directories to clean, but none of them succeed: ``` Cleaning /System/Volumes/Data/src/python/cpython/Lib/re/__pycache__...◎ Skipped /System/Volumes/Data/src/python/cpython/Lib/re/__pycache__ (final removal check failed; re-run mo purge to review it again) ``` I own these directories. `rm -rf /System/Volumes/Data/src/python/cpython/Lib/re/__pycache__` succeeds.  The debug log shows: `ERROR: Path validation failed: critical system path:`.  These are not critical system paths. Does mole think that because of the entry in /etc/synthetic.conf?  ## Environment  Paste the output of `mo --version` from the version used to reproduce the problem:  ```text % mo --version  Mole version 1.62.0 macOS: 26.7.1 Architecture: arm64 Kernel: 25.6.0 SIP: Enabled Disk Free: 189.29GB Install: Homebrew Shell: /bin/zsh ```

- **Issue #1813** (2026-10-24): **[Mac App Bug] Not showing MacOS App Store updates that are present.**
  *Symptoms*: ### Mole Mac app version  1.18.0 (340)  ### macOS version  27.2.0  ### Mac model  Mac16,5 (Apple M4 Max)  ### Affected area  Download / update  ### What happened?  Not showing MacOS Appt Store updates that are present.  ### Steps to reproduce  Apps tab- refresh, no population of updates from app store.  ### Expected behavior  I expected the apps needing update to show.  ### Screenshots or safe logs  <img width="1728" height="1117" alt="Image" src="https://github.com/user-attachments/assets/e5c43317-2421-4cc1-a6e6-46f9c43ab797" />  ### Before submitting  - [x] I updated to the latest stable Mole Mac app, reopened it, and reproduced this problem (or this report explains why I cannot update). - [x] I did not include license keys, order numbers, or private data.

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

### Incident Patch 1: `52c5a7fa` (2026-10-25)
**Commit Message**: fix(clean): protect active caches and measure reclaimable blocks

Keep live app caches and incomplete project recovery evidence out of automatic cleanup. Resolve Apple Git shims without opening an installer and use one conservative block estimate across cleanup paths.

**File**: `.claude/rules/core.md` (modified, +2/-1)
```diff
@@ -21,11 +21,12 @@ paths:
 - Both find/delete helpers preserve signal statuses in the clean cancellation marker, including scan, sizing, preview and privileged preflight failures; a prior cancellation stops them before further work. Read-only scan or sizing timeouts stay local and never set that marker. A signal from `validate_path_for_deletion` must stop the privileged scan loop and discard its accumulated removal batch, not become an ordinary refusal via `if ! ...; then continue`; a validator timeout still skips only its target. Locked by the `preserves scan signals`, `preserves dry-run sizing signals`, `read-only timeouts remain local`, `preserves preview validation signals`, `stops before work after sticky cancellation`, `stops accumulated batches on validation signals` and `validation timeout skips only its target` cases in `tests/core_safe_functions.bats`.
 - Trash batches may share stable invoking-user values, never destination ownership/mode or live source evidence. Keep operation and deletion logs synchronous; existing writable logs can skip repeated setup, but a missing log must be recreated. Shared nested-path filtering is literal and must keep parent coverage across prefix siblings; Gradle target normalization belongs only to clean.
 - Direct Trash moves, privileged staging moves, staging permission/ownership handoff and final user moves each use `run_with_timeout` with the existing disk-operation timeout. This bounds each command, not the whole uninstall phase. Keep identity/ownership checks immediately before the source move, preserve a staged payload on timeout and stop later candidates without losing the completed-path ledger. Never re-enter a privileged payload operation after the stage is handed to the user. Regression tests must reach the real mover with bounded fixture executables; a batch mock that adds its own timeout proves only status propagation. Locked by the `real direct Trash sink` cases in `tests/uninstall_timeout.bats` and `real privileged Trash sink` cases in `tests/file_ops_mole_delete.bats`.
-- **A cleanup total counts readable bytes, and only a timeout makes it a lower bound.** `du` exits 1 when it cannot list a folder, after printing everything it could read; a folder Mole cannot list it cannot remove either, so cleanup sizing passes `readable` to `get_path_size_kb` and takes that total. Uninstall keeps the strict default (#1404). Before this, six unavailable simulators holding 7.73GB were counted as 0 and the run printed `At least`, which read as a timeout that never happened. `mole_item_size_continues` marks the total partial only for a real timeout, a timeout names its path in the debug log, and the partial total prints as `3.27GB+`, the same form as the Build artifacts hint. Locked by `cleanup sizing counts the readable bytes of a folder with an unlistable child`, `only a sizing timeout marks the cleanup total as a lower bound` and `a sizing timeout names the item in the debug log` in `tests/file_ops_size.bats`.
+- **A cleanup total counts readable bytes, and only a timeout makes it a lower bound.** A folder Mole cannot list it cannot remove either, so cleanup sizing retains readable-file totals. `get_path_size_kb` still provides the `readable` mode for callers using `du`; uninstall keeps its strict default (#1404). Clean's `get_cleanup_path_size_kb` and its bulk path share `_cleanup_path_sizes_kb`: allocated file blocks, internal hardlinks counted once only when every link is inside that candidate, and uncompressed APFS private bytes where supported. Symlinks are not followed, directory metadata is excluded, compressed or unsupported private-size probes use allocated bytes, and timed-out bulk results are discarded. Separate candidates deliberately do not claim external hardlink blocks even when both are selected. Sparse files and fully shared clones must not report their logical lengths as freed; real fixtures in `tests/file_ops_size.bats` lock these cases. Before this, six unavailable simulators holding 7.73GB were counted as 0 and the run printed `At least`, which read as a timeout that never happened. `mole_item_size_continues` marks the total partial only for a real timeout, a timeout names its path in the debug log, and the partial total prints as `3.27GB+`, the same form as the Build artifacts hint. Locked by `cleanup sizing counts the readable bytes of a folder with an unlistable child`, `only a sizing timeout marks the cleanup total as a lower bound` and `a sizing timeout names the item in the debug log` in `tests/file_ops_size.bats`.
 - **Do not add a shell-side directory size cache.** APFS does not propagate mtime up the tree, so a parent directory's mtime is unchanged when a descendant grows or shrinks and the cache hands the user a stale reclaimable number. Measure every time; `get_path_size_kb` is already timeout-bounded. The uninstall preview side of this rule is in `.claude/rules/uninstall.md`.
 - `start_section` / `end_section` / `note_activity` have 
```

**File**: `.claude/rules/purge-installer.md` (modified, +2/-0)
```diff
@@ -19,6 +19,8 @@ paths:
 - Purge discovery skips dot-directory containers by design. Add each supported container, such as `~/.codex/worktrees`, explicitly to `MOLE_PURGE_DEFAULT_SEARCH_PATHS`; do not broaden discovery to all dot directories. The scan layer already handles hidden descendants once their parent container is known, while project roots deeper than the existing two-level probe remain intentionally out of scope.
 - **A purge target is never a container.** `is_project_container` rejects any basename in `MOLE_PURGE_TARGETS`, not a separately maintained list of package directories, so a stray `~/node_modules`, `vendor/`, or `Pods/` is never scanned as a set of project roots whose internal `dist/` and `build/` reach the delete list. A directory that legitimately shares an artifact name stays reachable by listing it in `~/.config/mole/purge_paths`, which bypasses discovery; do not add a flag for it. This one probe is the whole surface: the other three scan-root entry points in `lib/clean/project.sh` are the maintainer default list, the user config file, and the consumer of discovery. Locked by the two `#1459` tests in `tests/purge.bats`; the story is in `.claude/skills/bugs/references/deletion-evidence-and-final-sink.md` section 13.
 - **Purge candidate protection.** Purge candidates with deployment keypair files, nested Git repositories, or Git-tracked content are protected at discovery and immediately before deletion.
+  - `node_modules` also requires a readable project manifest, lockfile, and matching npm/pnpm/Yarn install record. Package files newer than that record remain protected, excluding the disposable top-level `.cache` directory. Running project cwd/arguments and incomplete process visibility preserve the candidate even after explicit recent selection. Keep the existing seven-day age threshold; install provenance is a separate condition. Locked by the `purge node_modules` and `purge node project process` tests.
+  - Never invoke Apple's `/usr/bin/git` shim to discover whether CLT is installed. Resolve the selected developer directory read-only and use its real Git executable; absent tools leave the content verdict unknown without opening an installation prompt. A non-shim Git selected through PATH keeps its existing behavior.
   - Use physical Git ancestry, a full-path `:(top,literal,icase)` pathspec from `mole_git_path_spec` (literal so glob characters match nothing else, case-blind because the default volume is case-insensitive and the index may keep another spelling of a renamed folder), inherited pathspec switches unset, and disabled fsmonitor hooks.
   - The content walk runs on the tree-walk budget (`MOLE_TIMEOUT_HINT_SCAN_SEC`), and a probe that times out or fails is status 2, not evidence: the candidate is kept, discovery passes it through, the review step prints `Could not inspect X; kept` and marks the run incomplete, and the sink still refuses it. Signals remain cancellation statuses through Git/find probes, protection predicates, workers, review, and the final sink; never collapse them into status 2 or a normal protected result. Never fold that state into a silent drop.
   - Discovery runs these probes in a pool of at most four per scan unit and publishes them in input order only after every probe finished; a missing result counts as unverified, and a scan cancelled during its last probes makes the filter return 130 with nothing written. `scan_purge_targets` writes the verified sidecar only when its caller names one as a third argument, and that caller removes it. The review before the menu reuses discovery's clean verdict from the same run and walks again only candidates without one; the recheck before removal and the final sink guard always probe afresh.
```

**File**: `bin/clean.sh` (modified, +63/-44)
```diff
@@ -745,28 +745,62 @@ normalize_paths_for_cleanup() {
     return 0
 }
 
+# Measure reclaimable file blocks, not logical lengths. Each root is independent:
+# links outside that root and shared clone blocks stay out of its estimate.
+# This is measurement only; the normal deletion guards still own eligibility.
+_cleanup_path_sizes_kb() {
+    # shellcheck disable=SC2016 # The single-quoted program contains Perl variables.
+    run_with_timeout "$MOLE_TIMEOUT_DISK_VERIFY_SEC" /usr/bin/perl -e '
+        use strict;
+        use warnings;
+        use File::Find;
+        use Fcntl qw(:mode);
+        sub private_bytes {
+            my ($path, $allocated) = @_;
+            # Darwin getattrlist: common FLAGS followed by extended PRIVATESIZE.
+            # FSOPT_NOFOLLOW | FSOPT_ATTR_CMN_EXTENDED. Unsupported filesystems
+            # retain allocated bytes; compressed resource forks do too.
+            my $attrs = pack("SSLLLLL", 5, 0, 0x80040000, 0, 0, 0, 8);
+            my $reply = "\0" x 36;
+            my $name = "$path\0";
+            return $allocated if syscall(220, $name, $attrs, $reply, 36, 0x21) != 0;
+            my ($length, $common, $volume, $dir, $file, $extended, $flags, $private) = unpack("L7Q", $reply);
+            return $allocated if $length < 36 || !($common & 0x40000) || !($extended & 8) || ($flags & 0x20);
+            return $private < $allocated ? $private : $allocated;
+        }
+        for my $root (@ARGV) {
+            my @root_stat = lstat($root);
+            if (!@root_stat || S_ISLNK($root_stat[2])) { print "0\n" or die $!; next; }
+            my %links;
+            my $bytes = 0;
+            my $visit = sub {
+                my $path = $_;
+                my @s = lstat($path);
+                return unless @s;
+                if ($s[0] != $root_stat[0]) { $File::Find::prune = 1; return; }
+                return unless S_ISREG($s[2]);
+                my $allocated = $s[12] * 512;
+                my $size = private_bytes($path, $allocated);
+                if ($s[3] > 1) {
+                    my $key = "$s[0]:$s[1]";
+                    $links{$key} ||= [0, $s[3], $size];
+                    $links{$key}[0]++;
+                } else { $bytes += $size; }
+            };
+            if (S_ISDIR($root_stat[2])) {
+                find({wanted => $visit, no_chdir => 1, follow => 0}, $root);
+            } else { local $_ = $root; $visit->(); }
+            for my $link (values %links) {
+                $bytes += $link->[2] if $link->[0] == $link->[1];
+            }
+            print(int(($bytes + 1023) / 1024), "\n") or die $!;
+        }
+    ' -- "$@" 2> /dev/null
+}
+
 # shellcheck disable=SC2329
 get_cleanup_path_size_kb() {
-    local path="$1"
-
-    # A plain file or a symlink is a single stat. Directories and the
-    # stat-unavailable case fall back to get_path_size_kb. For a regular file
-    # with a zero/invalid stat we also fall back; a symlink reports 0 directly.
-    if [[ -L "$path" || -f "$path" ]] && command -v stat > /dev/null 2>&1; then
-        local bytes
-        bytes=$("$STAT_BSD" -f%z "$path" 2> /dev/null || echo "0")
-        if [[ "$bytes" =~ ^[0-9]+$ && "$bytes" -gt 0 ]]; then
-            echo $(((bytes + 1023) / 1024))
-            return 0
-        fi
-        if [[ -L "$path" ]]; then
-            echo 0
-            return 0
-        fi
-    fi
-
-    # Cleanup totals count what can be freed: readable bytes (see get_path_size_kb).
-    get_path_size_kb "$path" "" readable
+    _cleanup_path_sizes_kb "$1"
 }
 
 # Classification helper for cleanup risk levels
@@ -1007,7 +1041,7 @@ _safe_clean_impl() {
             [[ -d "${existing_paths[i]}" ]] && ((dir_count++))
         done
 
-        # Heuristic: mostly files -> bulk stat is faster than per-file subshells.
+        # Mostly files share one measurement process instead of per-file subshells.
         if [[ $dir_count -lt 5 && ${#existing_paths[@]} -gt 20 ]]; then
             if [[ -t 1 && "$show_spinner" == "false" ]]; then
                 start_section_spinner "Scanning items..."
@@ -1018,8 +1052,7 @@ _safe_clean_impl() {
             local _bytes
             local bulk_stat_file="$temp_dir/bulk_stat"
             local bulk_stat_rc=0
-            run_with_timeout "$MOLE_TIMEOUT_DISK_VERIFY_SEC" \
-                "$STAT_BSD" -f%z "${existing_paths[@]}" < /dev/null \
+            _cleanup_path_sizes_kb "${existing_paths[@]}" < /dev/null \
                 > "$bulk_stat_file" 2> /dev/null || bulk_stat_rc=$?
             if [[ $bulk_stat_rc -ge 128 ]]; then
                 cleanup_interrupt_rc=$bulk_stat_rc
@@ -1028,9 +1061,15 @@ _safe_clean_impl() {
                 # must not cancel the delete set. Sizes are already 0 here.
                 MOLE_CLEAN_SIZING_TIMEOUTS=$((${MOLE_CLEAN_SIZING_TIMEOUTS:-0} + 1))
             fi
+            if [[ $bulk_stat_rc -ne 0 ]] || ! awk -v expected="${#existing_paths[@]}" '
+                !/^[0-9]+$/ { invalid = 1 }
+       
```

**File**: `lib/clean/app_caches.sh` (modified, +47/-34)
```diff
@@ -432,37 +432,50 @@ clean_editor_obsolete_extensions() {
         done < <(_mole_obsolete_extension_keys "$obsolete_file")
     done
 }
+# CodeBuddyExtension is shared by the CodeBuddy editors and WorkBuddy.
+# A closed editor alone does not establish that these caches are idle.
+_codebuddy_shared_cache_running() {
+    mole_pgrep_any -x 'CodeBuddy|CodeBuddy CN|WorkBuddy' \
+        -f '/(CodeBuddy( CN)?|WorkBuddy)[.]app/'
+}
+
 # Code editors.
 clean_code_editors() {
-    safe_clean ~/Library/Application\ Support/Code/logs/* "VS Code logs"
-    safe_clean ~/Library/Application\ Support/Code/Cache/* "VS Code cache"
-    safe_clean ~/Library/Application\ Support/Code/CachedExtensionVSIXs/* "VS Code extension cache"
-    safe_clean ~/Library/Application\ Support/Cursor/CachedExtensionVSIXs/* "Cursor extension cache"
-    safe_clean ~/Library/Application\ Support/Code/CachedData/* "VS Code data cache"
-    safe_clean ~/Library/Application\ Support/Code/WebStorage/*/CacheStorage/* "VS Code webview cache"
+    mole_safe_clean_app_cache "Visual Studio Code" ~/Library/Application\ Support/Code/logs/* "VS Code logs"
+    mole_safe_clean_app_cache "Visual Studio Code" ~/Library/Application\ Support/Code/Cache/* "VS Code cache"
+    mole_safe_clean_app_cache "Visual Studio Code" ~/Library/Application\ Support/Code/CachedExtensionVSIXs/* "VS Code extension cache"
+    mole_safe_clean_app_cache "Cursor" ~/Library/Application\ Support/Cursor/CachedExtensionVSIXs/* "Cursor extension cache"
+    mole_safe_clean_app_cache "Visual Studio Code" ~/Library/Application\ Support/Code/CachedData/* "VS Code data cache"
+    mole_safe_clean_app_cache "Visual Studio Code" ~/Library/Application\ Support/Code/WebStorage/*/CacheStorage/* "VS Code webview cache"
     safe_clean ~/Library/Caches/com.sublimetext.*/* "Sublime Text cache"
     safe_clean ~/Library/Caches/Zed/* "Zed cache"
     # Zed npm caches: node/cache (system-node scratch) and node/node-v*/cache
     # (per-version managed runtime, see #88); keep editor state under db/ untouched.
-    safe_clean ~/Library/Application\ Support/Zed/node/cache/* "Zed npm cache"
-    safe_clean ~/Library/Application\ Support/Zed/node/node-v*/cache/* "Zed npm cache"
+    mole_safe_clean_app_cache "Zed" ~/Library/Application\ Support/Zed/node/cache/* "Zed npm cache"
+    mole_safe_clean_app_cache "Zed" ~/Library/Application\ Support/Zed/node/node-v*/cache/* "Zed npm cache"
     safe_clean ~/Library/Logs/Zed/* "Zed logs"
     clean_editor_obsolete_extensions
-    # CodeBuddy Extension (VS Code fork, Electron)
+    # Shared desktop extension caches have more than one possible owner.
     if [[ -d ~/Library/Application\ Support/CodeBuddyExtension ]]; then
-        safe_clean ~/Library/Application\ Support/CodeBuddyExtension/Cache/* "CodeBuddy Extension cache"
-        safe_clean ~/Library/Application\ Support/CodeBuddyExtension/logs/* "CodeBuddy Extension logs"
+        local codebuddy_rc=0
+        _dev_safe_clean_process_guarded _codebuddy_shared_cache_running "CodeBuddy" "CodeBuddy Extension cache" \
+            ~/Library/Application\ Support/CodeBuddyExtension/Cache/* "CodeBuddy Extension cache" || codebuddy_rc=$?
+        [[ $codebuddy_rc -le 1 ]] || return "$codebuddy_rc"
+        codebuddy_rc=0
+        _dev_safe_clean_process_guarded _codebuddy_shared_cache_running "CodeBuddy" "CodeBuddy Extension logs" \
+            ~/Library/Application\ Support/CodeBuddyExtension/logs/* "CodeBuddy Extension logs" || codebuddy_rc=$?
+        [[ $codebuddy_rc -le 1 ]] || return "$codebuddy_rc"
     fi
     # CodeBuddy CN (VS Code fork, Electron)
     if [[ -d ~/Library/Application\ Support/CodeBuddy\ CN ]]; then
-        safe_clean ~/Library/Application\ Support/CodeBuddy\ CN/Cache/* "CodeBuddy CN cache"
-        safe_clean ~/Library/Application\ Support/CodeBuddy\ CN/CachedData/* "CodeBuddy CN cached data"
-        safe_clean ~/Library/Application\ Support/CodeBuddy\ CN/CachedExtensionVSIXs/* "CodeBuddy CN extension cache"
-        safe_clean ~/Library/Application\ Support/CodeBuddy\ CN/Code\ Cache/* "CodeBuddy CN code cache"
-        safe_clean ~/Library/Application\ Support/CodeBuddy\ CN/GPUCache/* "CodeBuddy CN GPU cache"
-        safe_clean ~/Library/Application\ Support/CodeBuddy\ CN/DawnGraphiteCache/* "CodeBuddy CN Dawn cache"
-        safe_clean ~/Library/Application\ Support/CodeBuddy\ CN/DawnWebGPUCache/* "CodeBuddy CN WebGPU cache"
-        safe_clean ~/Library/Application\ Support/CodeBuddy\ CN/logs/* "CodeBuddy CN logs"
+        mole_safe_clean_app_cache "CodeBuddy CN" ~/Library/Application\ Support/CodeBuddy\ CN/Cache/* "CodeBuddy CN cache"
+        mole_safe_clean_app_cache "CodeBuddy CN" ~/Library/Application\ Support/CodeBuddy\ CN/CachedData/* "CodeBuddy CN cached data"
+        mole_safe_clean_app_cache "CodeBuddy CN" ~/Library/Application\ Support/CodeBuddy\ CN/CachedExtensionVSIXs/* "CodeBuddy CN extension cache"
+        mole_safe_clean_app_cache "CodeBuddy CN" ~/Library/Applic
```

**File**: `lib/clean/dev.sh` (modified, +24/-77)
```diff
@@ -1767,59 +1767,6 @@ _xctest_devices_delete_guard_allows() {
     mole_clean_process_guard _xctest_devices_activity_state "Xcode, XCTest, or Simulator started"
 }
 
-_dev_process_delete_guard_allows() {
-    # safe_clean_guarded passes the leaf currently at its deletion boundary.
-    # Keep it in dynamic scope so compound probes such as the Cargo root guard
-    # can bind that exact object without changing ordinary process probes.
-    local _MOLE_DEV_GUARDED_PATH="${1:-}"
-    mole_clean_process_guard \
-        "$_MOLE_DEV_PROCESS_GUARD_PROBE" \
-        "$_MOLE_DEV_PROCESS_GUARD_FAMILY started" \
-        "${_MOLE_DEV_PROCESS_GUARD_UNKNOWN_REASON:-process state unknown}"
-}
-
-_dev_report_process_guard_stop() {
-    local display_name="$1"
-    local family="$2"
-    local reason="$3"
-
-    if [[ "$reason" == "process state unknown" || "$reason" == "process or cache path state unknown" ]]; then
-        echo -e "  ${GRAY}${ICON_WARNING}${NC} ${display_name} · stopped (${reason})"
-        note_activity
-    else
-        mole_defer_cleanup_family "$family"
-    fi
-}
-
-# Bind a tri-state process probe to safe_clean's post-size boundary. The local
-# guard state is intentionally dynamic so Bash 3.2 callbacks can read it.
-_dev_safe_clean_process_guarded() {
-    local probe="$1"
-    local family="$2"
-    local display_name="$3"
-    shift 3
-    local _MOLE_DEV_PROCESS_GUARD_PROBE="$probe"
-    local _MOLE_DEV_PROCESS_GUARD_FAMILY="$family"
-    local _MOLE_CLEAN_GUARD_REASON="${family} started"
-
-    if ! declare -f safe_clean_guarded > /dev/null 2>&1; then
-        if ! _dev_process_delete_guard_allows; then
-            _dev_report_process_guard_stop "$display_name" "$family" "$_MOLE_CLEAN_GUARD_REASON"
-            return 1
-        fi
-        safe_clean "$@"
-        return $?
-    fi
-
-    local guarded_rc=0
-    safe_clean_guarded _dev_process_delete_guard_allows "$@" || guarded_rc=$?
-    if [[ $guarded_rc -eq 75 ]]; then
-        _dev_report_process_guard_stop "$display_name" "$family" "$_MOLE_CLEAN_GUARD_REASON"
-        return 1
-    fi
-    return "$guarded_rc"
-}
-
 _dev_clean_service_worker_process_guarded() {
     local probe="$1"
     local family="$2"
@@ -5809,43 +5756,43 @@ clean_dev_misc() {
     safe_clean ~/Library/Caches/KSCrash/* "KSCrash reports"
     safe_clean ~/Library/Caches/com.crashlytics.data/* "Crashlytics data"
     if [[ -d ~/Library/Application\ Support/Antigravity ]]; then
-        safe_clean ~/Library/Application\ Support/Antigravity/Cache/* "Antigravity cache"
-        safe_clean ~/Library/Application\ Support/Antigravity/Code\ Cache/* "Antigravity code cache"
-        safe_clean ~/Library/Application\ Support/Antigravity/GPUCache/* "Antigravity GPU cache"
-        safe_clean ~/Library/Application\ Support/Antigravity/DawnGraphiteCache/* "Antigravity Dawn cache"
-        safe_clean ~/Library/Application\ Support/Antigravity/DawnWebGPUCache/* "Antigravity WebGPU cache"
+        mole_safe_clean_app_cache "Antigravity" ~/Library/Application\ Support/Antigravity/Cache/* "Antigravity cache"
+        mole_safe_clean_app_cache "Antigravity" ~/Library/Application\ Support/Antigravity/Code\ Cache/* "Antigravity code cache"
+        mole_safe_clean_app_cache "Antigravity" ~/Library/Application\ Support/Antigravity/GPUCache/* "Antigravity GPU cache"
+        mole_safe_clean_app_cache "Antigravity" ~/Library/Application\ Support/Antigravity/DawnGraphiteCache/* "Antigravity Dawn cache"
+        mole_safe_clean_app_cache "Antigravity" ~/Library/Application\ Support/Antigravity/DawnWebGPUCache/* "Antigravity WebGPU cache"
     fi
     # Antigravity browser profile caches (~/.gemini)
     clean_antigravity_caches
     # agent-browser's superseded Chrome for Testing builds (#1748)
     clean_agent_browser_old_chrome
     # Filo (Electron)
     if [[ -d ~/Library/Application\ Support/Filo ]]; then
-        safe_clean ~/Library/Application\ Support/Filo/production/Cache/* "Filo cache"
-        safe_clean ~/Library/Application\ Support/Filo/production/Code\ Cache/* "Filo code cache"
-        safe_clean ~/Library/Application\ Support/Filo/production/GPUCache/* "Filo GPU cache"
-        safe_clean ~/Library/Application\ Support/Filo/production/DawnGraphiteCache/* "Filo Dawn cache"
-        safe_clean ~/Library/Application\ Support/Filo/production/DawnWebGPUCache/* "Filo WebGPU cache"
+        mole_safe_clean_app_cache "Filo" ~/Library/Application\ Support/Filo/production/Cache/* "Filo cache"
+        mole_safe_clean_app_cache "Filo" ~/Library/Application\ Support/Filo/production/Code\ Cache/* "Filo code cache"
+        mole_safe_clean_app_cache "Filo" ~/Library/Application\ Support/Filo/production/GPUCache/* "Filo GPU cache"
+        mole_safe_clean_app_cache "Filo" ~/Library/Application\ Support/Filo/production/DawnGraphiteCache/* "Filo Dawn cache"
+        mole_safe_clean_app_cache "Filo" ~/Library/Application\ Support/Filo/production/DawnWebGPUCache/* "Filo WebGPU cache"
    
```

**File**: `lib/clean/project.sh` (modified, +64/-0)
```diff
@@ -531,6 +531,60 @@ purge_artifact_has_authored_content() {
 # unfinished content probe rather than evidence.
 PURGE_PROTECTION_UNVERIFIED=false
 
+# Returns the same tri-state as process probes. A project may be active with
+# no open file inside node_modules, for example a shell or dev server in cwd.
+purge_node_project_running() {
+    local project="$1" deadline="${2:-}" probe_timeout evidence rc=0 line saw_cwd=false
+    [[ "$project" == /* && ! "$project" =~ [[:cntrl:]] ]] || return 2
+    probe_timeout=$(_mole_timeout_with_deadline "$MOLE_TIMEOUT_HINT_SCAN_SEC" "$deadline") || return 2
+    evidence=$(run_with_timeout "$probe_timeout" /usr/sbin/lsof -nP -a -u "$(id -u)" -d cwd -Fn 2>&1) || rc=$?
+    [[ $rc -le 128 ]] || return "$rc"
+    [[ $rc -eq 0 && -n "$evidence" ]] || return 2
+    while IFS= read -r line; do
+        case "$line" in
+            "n$project" | "n$project/"*) return 0 ;;
+            n/*) saw_cwd=true ;;
+            p[0-9]* | fcwd) ;;
+            *) return 2 ;; # A warning or unavailable cwd makes visibility incomplete.
+        esac
+    done <<< "$evidence"
+    [[ "$saw_cwd" == true ]] || return 2
+    probe_timeout=$(_mole_timeout_with_deadline "$MOLE_TIMEOUT_HINT_SCAN_SEC" "$deadline") || return 2
+    rc=0
+    run_with_timeout "$probe_timeout" pgrep -f "$(_mole_regex_escape "$project")(/|[[:space:]]|$)" > /dev/null 2>&1 || rc=$?
+    [[ $rc -le 128 ]] || return "$rc"
+    [[ $rc -le 1 ]] || return 2
+    return "$rc"
+}
+
+# Lockfiles make reinstall possible; the package-manager record separates
+# installed files from later local edits. An incomplete probe is not proof.
+# This is independent of the existing seven-day activity/selection policy.
+purge_node_modules_is_protected() {
+    local path="$1" deadline="${2:-}" project marker="" pair lock record
+    local evidence probe_timeout rc=0
+    path=$(cd "$path" 2> /dev/null && /bin/pwd -P) || return 2
+    project="${path%/*}"
+    [[ -f "$project/package.json" && -r "$project/package.json" && ! -L "$project/package.json" ]] || return 0
+    for pair in 'package-lock.json:.package-lock.json' 'npm-shrinkwrap.json:.package-lock.json' 'pnpm-lock.yaml:.modules.yaml' 'yarn.lock:.yarn-integrity' 'yarn.lock:.yarn-state.yml'; do
+        lock="${pair%%:*}"
+        record="${pair#*:}"
+        if [[ -f "$project/$lock" && -r "$project/$lock" && ! -L "$project/$lock" &&
+            -f "$path/$record" && -r "$path/$record" && ! -L "$path/$record" ]]; then
+            marker="$path/$record"
+            break
+        fi
+    done
+    [[ -n "$marker" ]] || return 0
+    probe_timeout=$(_mole_timeout_with_deadline "$MOLE_TIMEOUT_HINT_SCAN_SEC" "$deadline") || return 2
+    evidence=$(run_with_timeout "$probe_timeout" /usr/bin/find "$path" \
+        -type d -path "$path/.cache" -prune -o -type f -newer "$marker" -print -quit 2> /dev/null) || rc=$?
+    [[ $rc -le 128 ]] || return "$rc"
+    [[ $rc -eq 0 ]] || return 2
+    [[ -z "$evidence" ]] || return 0
+    purge_node_project_running "$project" "$deadline"
+}
+
 is_protected_purge_artifact() {
     local path="${1%/}"
     local deadline="${2:-}"
@@ -547,6 +601,16 @@ is_protected_purge_artifact() {
     [[ $authored_rc -ne 0 ]] || return 0
 
     case "$base" in
+        node_modules)
+            local node_rc=0
+            purge_node_modules_is_protected "$path" "$deadline" || node_rc=$?
+            [[ $node_rc -le 128 ]] || return "$node_rc"
+            if [[ $node_rc -eq 2 ]]; then
+                PURGE_PROTECTION_UNVERIFIED=true
+                return 0
+            fi
+            return "$node_rc"
+            ;;
         bin)
             # Only allow purging bin/ when we can detect .NET context.
             if is_dotnet_bin_dir "$path"; then
```

**File**: `lib/clean/purge_shared.sh` (modified, +17/-1)
```diff
@@ -197,11 +197,27 @@ mole_git_ls_files() {
     shift 3
     local probe_timeout=""
     probe_timeout=$(_mole_timeout_with_deadline "$MOLE_TIMEOUT_HINT_SCAN_SEC" "$deadline") || return 124
+    local git_bin developer_dir probe_rc=0
+    git_bin=$(command -v git) || return 2
+    if [[ "$git_bin" == /usr/bin/git || "$git_bin" -ef /usr/bin/git ]]; then
+        # The Apple shim opens the CLT installer when tools are absent. Resolve
+        # the real binary without invoking either git or xcrun first.
+        developer_dir="${DEVELOPER_DIR:-}"
+        if [[ -z "$developer_dir" ]]; then
+            developer_dir=$(run_with_timeout "$probe_timeout" /usr/bin/xcode-select -p 2> /dev/null) || probe_rc=$?
+            [[ $probe_rc -le 128 ]] || return "$probe_rc"
+            [[ $probe_rc -eq 0 ]] || return 2
+        fi
+        [[ "$developer_dir" != *.app ]] || developer_dir="$developer_dir/Contents/Developer"
+        git_bin="$developer_dir/usr/bin/git"
+        [[ "$developer_dir" == /* && -x "$git_bin" && ! -L "$git_bin" ]] || return 2
+        probe_timeout=$(_mole_timeout_with_deadline "$MOLE_TIMEOUT_HINT_SCAN_SEC" "$deadline") || return 124
+    fi
     run_with_timeout "$probe_timeout" \
         env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE -u GIT_COMMON_DIR \
         -u GIT_LITERAL_PATHSPECS -u GIT_GLOB_PATHSPECS -u GIT_NOGLOB_PATHSPECS -u GIT_ICASE_PATHSPECS \
         GIT_OPTIONAL_LOCKS=0 \
-        git -c core.fsmonitor=false --git-dir="$repo/.git" --work-tree="$repo" -C "$dir" ls-files "$@" 2> /dev/null
+        "$git_bin" -c core.fsmonitor=false --git-dir="$repo/.git" --work-tree="$repo" -C "$dir" ls-files "$@" 2> /dev/null
 }
 
 # The pathspec for a physical path inside repository $1, set in
```

**File**: `lib/core/base.sh` (modified, +72/-0)
```diff
@@ -1737,6 +1737,78 @@ mole_clean_process_guard() {
     return 1
 }
 
+# Named Electron caches do not carry a reverse-DNS owner in their path.
+# Callers supply the exact app name, not an executable such as Electron that
+# unrelated apps share. Escape it before both process-name and bundle probes.
+_mole_named_app_cache_running() {
+    mole_pgrep_any -x "$_MOLE_NAMED_APP_CACHE_PATTERN" \
+        -f "/${_MOLE_NAMED_APP_CACHE_PATTERN}[.]app/"
+}
+
+_dev_process_delete_guard_allows() {
+    # safe_clean_guarded passes the leaf currently at its deletion boundary.
+    # Keep it in dynamic scope so compound probes such as the Cargo root guard
+    # can bind that exact object without changing ordinary process probes.
+    local _MOLE_DEV_GUARDED_PATH="${1:-}"
+    mole_clean_process_guard \
+        "$_MOLE_DEV_PROCESS_GUARD_PROBE" \
+        "$_MOLE_DEV_PROCESS_GUARD_FAMILY started" \
+        "${_MOLE_DEV_PROCESS_GUARD_UNKNOWN_REASON:-process state unknown}"
+}
+
+_dev_report_process_guard_stop() {
+    local display_name="$1"
+    local family="$2"
+    local reason="$3"
+
+    if [[ "$reason" == "process state unknown" || "$reason" == "process or cache path state unknown" ]]; then
+        echo -e "  ${GRAY}${ICON_WARNING}${NC} ${display_name} · stopped (${reason})"
+        note_activity
+    else
+        mole_defer_cleanup_family "$family"
+    fi
+}
+
+# Bind a tri-state process probe to safe_clean's post-size boundary. The local
+# guard state is intentionally dynamic so Bash 3.2 callbacks can read it.
+_dev_safe_clean_process_guarded() {
+    local probe="$1"
+    local family="$2"
+    local display_name="$3"
+    shift 3
+    local _MOLE_DEV_PROCESS_GUARD_PROBE="$probe"
+    local _MOLE_DEV_PROCESS_GUARD_FAMILY="$family"
+    local _MOLE_CLEAN_GUARD_REASON="${family} started"
+
+    if ! declare -f safe_clean_guarded > /dev/null 2>&1; then
+        if ! _dev_process_delete_guard_allows; then
+            _dev_report_process_guard_stop "$display_name" "$family" "$_MOLE_CLEAN_GUARD_REASON"
+            return 1
+        fi
+        safe_clean "$@"
+        return $?
+    fi
+
+    local guarded_rc=0
+    safe_clean_guarded _dev_process_delete_guard_allows "$@" || guarded_rc=$?
+    if [[ $guarded_rc -eq 75 ]]; then
+        _dev_report_process_guard_stop "$display_name" "$family" "$_MOLE_CLEAN_GUARD_REASON"
+        return 1
+    fi
+    return "$guarded_rc"
+}
+
+mole_safe_clean_app_cache() {
+    local owner="$1"
+    shift
+    local _MOLE_NAMED_APP_CACHE_PATTERN
+    _MOLE_NAMED_APP_CACHE_PATTERN=$(_mole_regex_escape "$owner")
+    local rc=0
+    _dev_safe_clean_process_guarded _mole_named_app_cache_running "$owner" "${*: -1}" "$@" || rc=$?
+    [[ $rc -gt 1 ]] || return 0
+    return "$rc"
+}
+
 # Report a guard refusal. An unknown process state is the user's problem to see
 # now (it means Mole could not tell, not that it found something running), so it
 # prints against the item. A known-running app is ordinary and goes to the
```

---

### Incident Patch 2: `530cc2b7` (2026-10-24)
**Commit Message**: fix(slim): skip files an outer seal hashes and apps gatekeeper rejects

ScreenFlow failed every run: its QuickLook plugin is signed, so its
executable was planned as a bundle main executable, but ScreenFlow's own
seal lists that file by hash2 and thinning it broke the app's signature.
Stash seals its dashboard app and system extension the same way. A file
any enclosing seal hashes as a plain file now stays untouched.

Unnotarized originals (Mole, Yado, Hina dev builds) were offered, copied
and refused after the fact. The scan now asks Gatekeeper about every
candidate at once and leaves out only explicit rejections; a timeout or
other error keeps the app listed for the copy check to decide.

**File**: `.claude/rules/slim.md` (modified, +3/-2)
```diff
@@ -10,7 +10,8 @@ paths:
 
 ## Scope
 
-- Only apps in `/Applications` and `~/Applications` or one plain folder below them such as `Utilities` (#1811, maintainer 2026-10-23), never a folder that is itself a bundle or a symlink and never deeper; apps owned by the invoking user with every file inside owned by them, in a writable folder, signed with a Developer ID (`Authority=Developer ID Application`, a 10-character Team ID). App Store (`_MASReceipt`), `com.apple.*`, ad-hoc and unsigned apps, `should_protect_from_uninstall` and official-uninstaller vendors, apps set to "Open using Rosetta" (`LSArchitecturesForX86_64` in the LaunchServices plist) and symlinks are out.
+- Only apps in `/Applications` and `~/Applications` or one plain folder below them such as `Utilities` (#1811, maintainer 2026-10-23), never a folder that is itself a bundle or a symlink and never deeper; apps owned by the invoking user with every file inside owned by them, in a writable folder, signed with a Developer ID (`Authority=Developer ID Application`, a 10-character Team ID). App Store (`_MASReceipt`), `com.apple.*`, ad-hoc and unsigned apps, originals Gatekeeper already rejects, `should_protect_from_uninstall` and official-uninstaller vendors, apps set to "Open using Rosetta" (`LSArchitecturesForX86_64` in the LaunchServices plist) and symlinks are out.
+- Gatekeeper is asked about every candidate original during the scan, all at once (about a second in total, against 0.2 to 1.4 s each in sequence), with a 20 s budget. Only an explicit rejection (`spctl` exit 3) leaves the app out, since its copy can never pass; a timeout or any other error is unknown and keeps the app listed for the copy check to decide. On 2026-10-24 unnotarized builds of Mole, Yado and Hina were offered, copied and then refused one by one. Locked by `slim leaves out apps Gatekeeper already rejects but keeps unknown answers` in `tests/slim.bats`.
 - No sudo, no helper, no new privilege. Root-owned apps stay out rather than prompting.
 - Running apps are listed (Stash and other menu bar apps are always running and would otherwise vanish without a reason) and refused when slimming starts and again right before the swap. The confirmation tags them `[Running]` so they can be quit before Enter instead of being discovered after the run.
 - Output follows `mo uninstall`: `◎ name , size` rows, a numbered `✓`/`◎` line per app when several are selected, and a summary that lists slimmed apps three per line and groups unchanged apps by reason (six running apps are one line plus one next action). Locked by `slim summary lists slimmed apps and groups kept apps by reason` in `tests/slim.bats`.
@@ -19,7 +20,7 @@ paths:
 
 ## What may be thinned
 
-A Mach-O is thinned only when it is its bundle's main executable (`Contents/MacOS/<CFBundleExecutable>`, or `Versions/<v>/<CFBundleExecutable>` of a framework) or a `files2` entry of the nearest `_CodeSignature/CodeResources` sealed by `cdhash`. Everything sealed by plain `hash2` is left alone, and the file scan never enters `Resources` or `_CodeSignature`. Signatures are per slice, so the arm64 slice keeps its cdhash and nothing is ever re-signed.
+A Mach-O is thinned only when it is its bundle's main executable (`Contents/MacOS/<CFBundleExecutable>`, or `Versions/<v>/<CFBundleExecutable>` of a framework) or a `files2` entry of the nearest `_CodeSignature/CodeResources` sealed by `cdhash`. Everything sealed by plain `hash2` is left alone, and the file scan never enters `Resources` or `_CodeSignature`. Either way, a file that any enclosing seal up to the app lists by plain hash stays too: ScreenFlow signs its QuickLook plugin, yet ScreenFlow's own seal lists `ScreenFlow.qlgenerator/Contents/MacOS/ScreenFlow` by `hash2`, so thinning the plugin's main executable failed the copy's deep strict verify; Stash seals `Stash Dashboard.app` and its system extension executable the same way. `slim_sealed_keys` therefore prints every `files2` key tagged `c` (cdhash) or `h` (anything else). Locked by `slim never thins an executable an enclosing seal lists as a plain file`. Signatures are per slice, so the arm64 slice keeps its cdhash and nothing is ever re-signed.
 
 Counterexample that set this rule: thinning every universal file outside `Resources` broke Claude's (Electron) seal, because `Electron Framework.framework/Versions/A/Libraries/libffmpeg.dylib` and `libvk_swiftshader.dylib` are sealed by hash. App Store appex and Squirrel's ShipIt behave the same.
 
```

**File**: `bin/slim.sh` (modified, +60/-20)
```diff
@@ -35,6 +35,8 @@ trap 'trap - EXIT; cleanup; exit 130' INT TERM
 readonly SLIM_EXIT_UNSUPPORTED=4
 # Signature and Gatekeeper checks read every file of a large app.
 readonly SLIM_VERIFY_TIMEOUT_SEC=180
+# Assessing an original during the scan; a slower answer counts as unknown.
+readonly SLIM_SCAN_GATEKEEPER_TIMEOUT_SEC=20
 SLIM_WORK_DIR=""
 
 # Scan results, one index per app.
@@ -185,10 +187,11 @@ slim_skip_reason() {
     return 0
 }
 
-# Print the files2 keys that CodeResources seals by cdhash (nested code with
-# its own signature). Keys sealed by hash2 are plain files: thinning one
-# breaks the bundle seal. Parses the XML form; plutil -p is not parseable.
-slim_cdhash_sealed_keys() {
+# Print "<c|h>\t<key>" for every files2 key in CodeResources: c when it is
+# sealed by cdhash (nested code with its own signature), h otherwise. A key
+# sealed by hash2 is a plain file: thinning one breaks the bundle seal.
+# Parses the XML form; plutil -p is not parseable.
+slim_sealed_keys() {
     local code_resources="$1"
     plutil -convert xml1 -o - "$code_resources" 2> /dev/null | awk '
         function decode(s) {
@@ -205,10 +208,10 @@ slim_cdhash_sealed_keys() {
             next
         }
         !in_files2 { next }
-        line == "<dict/>" { next }
+        line == "<dict/>" { if (depth == 1) print "h\t" decode(key); next }
         line == "<dict>" { depth++; if (depth == 2) { sealed = 0 }; next }
         line == "</dict>" {
-            if (depth == 2 && sealed) print decode(key)
+            if (depth == 2) print (sealed ? "c" : "h") "\t" decode(key)
             depth--
             if (depth == 0) exit
             next
@@ -331,6 +334,22 @@ slim_is_thin_arm() {
     [[ "$(od -An -v -tu1 -N 8 "$1" 2> /dev/null | tr -s ' \n' ' ')" == " 207 250 237 254 12 0 0 1 " ]]
 }
 
+# Set keys_file to the cached slim_sealed_keys output for a sealing root;
+# roots and root_keys belong to the calling slim_plan_app.
+slim_seal_keys_file() {
+    local root="$1" i
+    for ((i = 0; i < ${#roots[@]}; i++)); do
+        if [[ "${roots[i]}" == "$root" ]]; then
+            keys_file="${root_keys[i]}"
+            return 0
+        fi
+    done
+    keys_file=$(create_temp_file) || return 1
+    slim_sealed_keys "$root/_CodeSignature/CodeResources" > "$keys_file" || true
+    roots+=("$root")
+    root_keys+=("$keys_file")
+}
+
 # Write "<path relative to the app>\t<intel bytes>" for every file that can
 # be thinned without breaking a seal; print the total.
 slim_plan_app() {
@@ -342,23 +361,21 @@ slim_plan_app() {
     while IFS= read -r file; do
         local root
         root=$(slim_sealing_root "$file" "$app") || continue
-        local allowed=false
+        local allowed=false keys_file
         if slim_is_main_executable "$file" "$root"; then
             allowed=true
         else
-            local keys_file="" i
-            for ((i = 0; i < ${#roots[@]}; i++)); do
-                [[ "${roots[i]}" == "$root" ]] && keys_file="${root_keys[i]}"
-            done
-            if [[ -z "$keys_file" ]]; then
-                keys_file=$(create_temp_file) || return 1
-                slim_cdhash_sealed_keys "$root/_CodeSignature/CodeResources" > "$keys_file" || true
-                roots+=("$root")
-                root_keys+=("$keys_file")
-            fi
-            local rel="${file#"$root"/}"
-            grep -Fxq -- "$rel" "$keys_file" && allowed=true
+            slim_seal_keys_file "$root" || return 1
+            grep -Fxq -- "c"$'\t'"${file#"$root"/}" "$keys_file" && allowed=true
         fi
+        # An enclosing bundle may seal the same file by plain hash: ScreenFlow
+        # signs its QuickLook plugin but its own seal lists the plugin's
+        # executable as a file, so thinning that executable broke the app.
+        local outer="$root"
+        while [[ "$allowed" == true ]] && outer=$(slim_sealing_root "$outer" "$app"); do
+            slim_seal_keys_file "$outer" || return 1
+            grep -Fxq -- "h"$'\t'"${file#"$outer"/}" "$keys_file" && allowed=false
+        done
         [[ "$allowed" == true ]] || {
             debug_log "slim: keeping $file (sealed as a plain file)"
             continue
@@ -427,6 +444,29 @@ collect_slim_candidates() {
 
     [[ ${#unsorted[@]} -gt 0 ]] || return 1
 
+    # An original Gatekeeper already rejects (an unnotarized build) can never
+    # yield a copy that passes, so it is left out rather than offered and
+    # failed after a full copy. All candidates are assessed at once, about a
+    # second in total; only an explicit rejection (3) removes one.
+    local -a pids=() accepted=()
+    local entry i gk
+    for entry in "${unsorted[@]}"; do
+        app="${entry#*$'\t'}"
+        run_with_timeout "$SLIM_SCAN_GATEKEEPER_TIMEOUT_SEC" spctl --assess --type execute "${app%%$'\t'*}" > /dev/null 2>&1 < /dev/null &
+        pids+=("$!")
+    done
+    for ((i = 0; i < ${#unsorted[@]}; i++)); do
+        gk=0
+        wait "${pids[i]}" || gk=$?
+   
```

**File**: `tests/slim.bats` (modified, +55/-4)
```diff
@@ -144,6 +144,7 @@ slim_env() {
 		"$BATS_TEST_TMPDIR/elsewhere/Linked.app"
 	ln -s "$BATS_TEST_TMPDIR/elsewhere" "$APPS_ROOT/LinkedFolder"
 
+	mole_test_fake_command spctl 'exit 0'
 	run slim_env /bin/bash -c '
 		source "$1"
 		slim_skip_reason() { :; }
@@ -158,6 +159,55 @@ slim_env() {
 	[ "$output" = "$APPS_ROOT/Outer.app"$'\n'"$APPS_ROOT/Top.app"$'\n'"$APPS_ROOT/Utilities/Util.app" ]
 }
 
+@test "slim leaves out apps Gatekeeper already rejects but keeps unknown answers" {
+	mkdir -p "$APPS_ROOT/Notarized.app" "$APPS_ROOT/Unnotarized.app" "$APPS_ROOT/Offline.app"
+	mole_test_fake_command spctl 'case "$*" in *Unnotarized.app) exit 3 ;; *Offline.app) exit 1 ;; esac; exit 0'
+
+	run slim_env /bin/bash -c '
+		source "$1"
+		slim_skip_reason() { :; }
+		slim_signing_team() { echo ABCDE12345; }
+		slim_plan_app() { echo 1; }
+		mole_deletion_identity() { echo id; }
+		collect_slim_candidates || exit 8
+		printf "%s\n" "${SLIM_APP_PATHS[@]}" | sort
+	' bash "$PROJECT_ROOT/bin/slim.sh"
+
+	[ "$status" -eq 0 ] || { echo "$output"; return 1; }
+	[ "$output" = "$APPS_ROOT/Notarized.app"$'\n'"$APPS_ROOT/Offline.app" ]
+}
+
+@test "slim never thins an executable an enclosing seal lists as a plain file" {
+	[[ "$SLIM_HAVE_FAT_TOOLCHAIN" == "1" ]] || skip "needs clang and a developer directory"
+	local app="$APPS_ROOT/Outer.app"
+	local plugin="$app/Contents/Library/QuickLook/Plug.qlgenerator/Contents"
+	mkdir -p "$app/Contents/MacOS" "$app/Contents/_CodeSignature" "$plugin/MacOS" "$plugin/_CodeSignature"
+	cp "$FIXTURE_BIN_DIR/fat-exe" "$app/Contents/MacOS/Outer"
+	cp "$FIXTURE_BIN_DIR/fat-exe" "$plugin/MacOS/Plug"
+	plutil -create xml1 "$app/Contents/Info.plist"
+	plutil -insert CFBundleExecutable -string Outer "$app/Contents/Info.plist"
+	plutil -create xml1 "$plugin/Info.plist"
+	plutil -insert CFBundleExecutable -string Plug "$plugin/Info.plist"
+	printf 'plugin seal' > "$plugin/_CodeSignature/CodeResources"
+	printf 'outer seal' > "$app/Contents/_CodeSignature/CodeResources"
+
+	# ScreenFlow's shape: the plugin is signed, yet the app seals its
+	# executable by hash2, so thinning it breaks the app's own seal.
+	run slim_env /bin/bash -c '
+		source "$1"
+		app="$3"
+		slim_sealed_keys() {
+			[[ "$1" == "$app/Contents/_CodeSignature/CodeResources" ]] || return 0
+			printf "h\tLibrary/QuickLook/Plug.qlgenerator/Contents/MacOS/Plug\n"
+		}
+		slim_plan_app "$app" "$2" > /dev/null
+		cut -f1 "$2"
+	' bash "$PROJECT_ROOT/bin/slim.sh" "$BATS_TEST_TMPDIR/plan" "$app"
+
+	[ "$status" -eq 0 ] || { echo "$output"; return 1; }
+	[ "$output" = "Contents/MacOS/Outer" ]
+}
+
 @test "slim.sh rejects unknown options" {
 	run "$PROJECT_ROOT/bin/slim.sh" --unknown-option
 
@@ -250,7 +300,7 @@ slim_env() {
 	[[ "$(file -b "$app/Contents/MacOS/Fixture")" == "Mach-O 64-bit executable arm64" ]]
 }
 
-@test "slim_cdhash_sealed_keys lists only files2 entries sealed by cdhash" {
+@test "slim_sealed_keys marks which files2 entries are sealed by cdhash" {
 	local plist="$BATS_TEST_TMPDIR/CodeResources"
 	cat > "$plist" << 'PLIST'
 <?xml version="1.0" encoding="UTF-8"?>
@@ -299,11 +349,11 @@ PLIST
 	run /bin/bash -c '
 		export MOLE_TEST_MODE=1
 		source "$1"
-		slim_cdhash_sealed_keys "$2"
+		slim_sealed_keys "$2"
 	' bash "$PROJECT_ROOT/bin/slim.sh" "$plist"
 
 	[ "$status" -eq 0 ]
-	[ "$output" = $'Frameworks/Nested.framework\nHelpers/R&D tool' ]
+	[ "$output" = $'c\tFrameworks/Nested.framework\nc\tHelpers/R&D tool\nh\tLibraries/libffmpeg.dylib\nh\tResources/empty' ]
 }
 
 @test "slim_skip_reason keeps App Store, Apple, Rosetta and symlinked apps out" {
@@ -401,7 +451,8 @@ PLIST
 	local app before
 	app=$(make_fixture_app)
 	before=$(stat -f '%i' "$app/Contents/MacOS/Fixture")
-	mole_test_fake_command spctl 'exit 3'
+	# The original passes the scan; only the slimmed copy is rejected.
+	mole_test_fake_command spctl 'case "$*" in *"/apps/Fixture.app") exit 0 ;; esac; exit 3'
 
 	run slim_env MOLE_SLIM_TEST_HOST_ARM64=1 /bin/bash -c '
 		source "$1"
```

---

### Incident Patch 3: `c1630fa3` (2026-10-24)
**Commit Message**: fix(slim): align output with uninstall and flag running apps up front

The run ended with one "Kept X.app (reason)" line per app, so six running
apps took six lines and the slimmed apps were never named. The confirmation
now tags running apps so they can be quit before Enter, each app gets a
numbered result line like uninstall, and the summary lists slimmed apps
three per line and groups unchanged apps by reason with one next action.

**File**: `.claude/rules/slim.md` (modified, +2/-1)
```diff
@@ -12,7 +12,8 @@ paths:
 
 - Only apps in `/Applications` and `~/Applications` or one plain folder below them such as `Utilities` (#1811, maintainer 2026-10-23), never a folder that is itself a bundle or a symlink and never deeper; apps owned by the invoking user with every file inside owned by them, in a writable folder, signed with a Developer ID (`Authority=Developer ID Application`, a 10-character Team ID). App Store (`_MASReceipt`), `com.apple.*`, ad-hoc and unsigned apps, `should_protect_from_uninstall` and official-uninstaller vendors, apps set to "Open using Rosetta" (`LSArchitecturesForX86_64` in the LaunchServices plist) and symlinks are out.
 - No sudo, no helper, no new privilege. Root-owned apps stay out rather than prompting.
-- Running apps are listed (Stash and other menu bar apps are always running and would otherwise vanish without a reason) and refused when slimming starts and again right before the swap.
+- Running apps are listed (Stash and other menu bar apps are always running and would otherwise vanish without a reason) and refused when slimming starts and again right before the swap. The confirmation tags them `[Running]` so they can be quit before Enter instead of being discovered after the run.
+- Output follows `mo uninstall`: `◎ name , size` rows, a numbered `✓`/`◎` line per app when several are selected, and a summary that lists slimmed apps three per line and groups unchanged apps by reason (six running apps are one line plus one next action). Locked by `slim summary lists slimmed apps and groups kept apps by reason` in `tests/slim.bats`.
 - Without a terminal, or with `--dry-run`, it only lists. Nothing is preselected; no `--yes`, no flags beyond `--dry-run` and `--debug`. A failed confirmation read cancels rather than becoming Enter, locked by `slim confirmation requires a successful Enter read` in `tests/slim.bats`.
 - Interactive and read-only lists share a compact name column bounded by terminal width, reserving space for the selection marker and reclaimable size. Pass full, terminal-safe names separately to the shared selector so truncation never changes search or name order. Locked by the `slim rows fit`, `slim searches the full name` and `slim name sorting` cases in `tests/slim.bats`.
 
```

**File**: `bin/slim.sh` (modified, +86/-33)
```diff
@@ -48,7 +48,9 @@ SLIM_APP_PLANS=()
 total_slimmed=0
 total_freed_bytes=0
 total_failed=0
-SLIM_FAILURES=()
+SLIM_DONE_NAMES=()
+SLIM_FAILED_NAMES=()
+SLIM_FAILED_REASONS=()
 
 show_slim_help() {
     echo "Usage: mo slim [OPTIONS]"
@@ -177,7 +179,7 @@ slim_skip_reason() {
         return
     }
     if [[ "$check_running" == true ]] && slim_app_is_running "$app"; then
-        echo "running, quit it and retry"
+        echo "still running"
         return
     fi
     return 0
@@ -473,7 +475,9 @@ print_slim_list() {
 
 record_slim_failure() {
     local app="$1" reason="$2"
-    SLIM_FAILURES+=("${app##*/} ($reason)")
+    local name="${app##*/}"
+    SLIM_FAILED_NAMES+=("${name%.app}")
+    SLIM_FAILED_REASONS+=("$reason")
     total_failed=$((total_failed + 1))
     log_operation "$MOLE_CURRENT_COMMAND" "SKIPPED" "$app" "$reason"
 }
@@ -612,7 +616,7 @@ slim_one_app() {
     # The app may have started while the copy was checked.
     if slim_app_is_running "$app"; then
         slim_discard_stage "$stage"
-        record_slim_failure "$app" "running, quit it and retry"
+        record_slim_failure "$app" "still running"
         return 0
     fi
 
@@ -642,6 +646,7 @@ slim_one_app() {
 
     slim_discard_stage "$stage"
     total_slimmed=$((total_slimmed + 1))
+    SLIM_DONE_NAMES+=("${SLIM_APP_NAMES[index]}")
     total_freed_bytes=$((total_freed_bytes + bytes))
     log_operation "$MOLE_CURRENT_COMMAND" "REBUILT" "$app" "removed Intel code, $(bytes_to_human "$bytes")"
     return 0
@@ -675,58 +680,92 @@ select_slim_apps() {
 
 confirm_slim_selection() {
     local -a indices=("$@")
-    local idx total=0
-    echo -e "${PURPLE_BOLD}Apps to slim:${NC}"
+    local idx total=0 running=false tag
+    echo -e "\n${PURPLE_BOLD}Apps to slim:${NC}"
     for idx in "${indices[@]}"; do
-        printf '  %s%s%s %s %s, %s%s\n' "$GREEN" "$ICON_SUCCESS" "$NC" \
-            "$(mole_terminal_safe_text "${SLIM_APP_NAMES[idx]}")" "$GRAY" "$(bytes_to_human "${SLIM_APP_BYTES[idx]}")" "$NC"
+        tag=""
+        if slim_app_is_running "${SLIM_APP_PATHS[idx]}"; then
+            tag=" ${YELLOW}[Running]${NC}"
+            running=true
+        fi
+        printf '%b%s%b\n' "${BLUE}${ICON_CONFIRM}${NC} " "$(mole_terminal_safe_text "${SLIM_APP_NAMES[idx]}")" \
+            " ${GRAY}, $(bytes_to_human "${SLIM_APP_BYTES[idx]}")${NC}${tag}"
         total=$((total + SLIM_APP_BYTES[idx]))
     done
     echo ""
     echo -e "${GRAY}Originals move to the Trash. App updates bring the Intel code back.${NC}"
-    echo -ne "${PURPLE}${ICON_ARROW}${NC} Slim ${#indices[@]} apps, $(bytes_to_human "$total")  ${GREEN}Enter${NC} confirm, ${GRAY}ESC${NC} cancel: "
+    [[ "$running" == false ]] || echo -e "${GRAY}Running apps are skipped, quit them before you confirm.${NC}"
+    local app_text="apps"
+    [[ ${#indices[@]} -gt 1 ]] || app_text="app"
+    echo -ne "${PURPLE}${ICON_ARROW}${NC} Slim ${#indices[@]} ${app_text}, $(bytes_to_human "$total")  ${GREEN}Enter${NC} confirm, ${GRAY}ESC${NC} cancel: "
 
     local confirm
     if ! IFS= read -r -s -n1 confirm; then
         printf '\n'
         return 1
     fi
+    printf '\n'
     case "$confirm" in
-        "" | $'\n' | $'\r')
-            printf '\r\033[K\n'
-            return 0
-            ;;
+        "" | $'\n' | $'\r') return 0 ;;
     esac
     printf '\n'
     return 1
 }
 
+# Mirrors the uninstall summary: slimmed apps three per line, then the apps
+# left unchanged grouped by reason so six running apps read as one line.
 show_slim_summary() {
-    local heading="Apps slimmed"
     local -a details=()
-    if [[ "${MOLE_DRY_RUN:-0}" == "1" ]]; then
-        heading="Dry run complete - no changes made"
-    elif [[ $total_failed -gt 0 ]]; then
-        heading="Slimming incomplete"
-    fi
+    local i name
 
     if [[ $total_slimmed -gt 0 ]]; then
-        if [[ "${MOLE_DRY_RUN:-0}" == "1" ]]; then
-            details+=("Would slim ${GREEN}$total_slimmed${NC} apps, free ${GREEN}$(bytes_to_human "$total_freed_bytes")${NC}")
-        else
-            details+=("Slimmed ${GREEN}$total_slimmed${NC} apps, freed ${GREEN}$(bytes_to_human "$total_freed_bytes")${NC} once the Trash is emptied")
-        fi
-    else
-        details+=("No apps were slimmed")
+        local app_text="apps"
+        [[ $total_slimmed -gt 1 ]] || app_text="app"
+        local line="Slimmed ${total_slimmed} ${app_text}, freed ${GREEN}$(bytes_to_human "$total_freed_bytes")${NC}: "
+        for ((i = 0; i < ${#SLIM_DONE_NAMES[@]}; i++)); do
+            if ((i > 0 && i % 3 == 0)); then
+                details+=("$line")
+                line=""
+            elif ((i > 0)); then
+                line+=", "
+            fi
+            name=$(mole_terminal_safe_text "${SLIM_DONE_NAMES[i]}")
+            line+="${GREEN}${name//\\/\\\\}${NC}"
+        done
+        details+=("$line")
     fi
 
-    local failure
-    for failure in "${SLIM_FAILURES[@]+"${SLIM_FAILURES[@]}"}"; do
-        failure=$(mole_ter
```

**File**: `tests/slim.bats` (modified, +31/-9)
```diff
@@ -409,12 +409,12 @@ PLIST
 		slim_preflight || exit 9
 		collect_slim_candidates || exit 8
 		slim_one_app 0 || exit 7
-		echo "slimmed=$total_slimmed failed=${SLIM_FAILURES[*]}"
+		echo "slimmed=$total_slimmed failed=${SLIM_FAILED_NAMES[*]} (${SLIM_FAILED_REASONS[*]})"
 		ls "$SLIM_WORK_DIR"
 	' bash "$PROJECT_ROOT/bin/slim.sh"
 
 	[ "$status" -eq 0 ]
-	[[ "$output" == *"slimmed=0 failed=Fixture.app (Gatekeeper check failed)"* ]] || return 1
+	[[ "$output" == *"slimmed=0 failed=Fixture (Gatekeeper check failed)"* ]] || return 1
 	[[ "$output" != *"app."* ]] || return 1
 	[[ "$(stat -f '%i' "$app/Contents/MacOS/Fixture")" == "$before" ]] || return 1
 	[[ "$(lipo -archs "$app/Contents/MacOS/Fixture")" == *x86_64* ]] || return 1
@@ -472,12 +472,12 @@ exec /usr/bin/codesign \"\$@\""
 		slim_preflight || exit 9
 		collect_slim_candidates || exit 8
 		slim_one_app 0 || exit 7
-		echo "slimmed=$total_slimmed failed=${SLIM_FAILURES[*]}"
+		echo "slimmed=$total_slimmed failed=${SLIM_FAILED_NAMES[*]} (${SLIM_FAILED_REASONS[*]})"
 		ls "$SLIM_WORK_DIR"
 	' bash "$PROJECT_ROOT/bin/slim.sh"
 
 	[ "$status" -eq 0 ]
-	[[ "$output" == *"slimmed=0 failed=Fixture.app (code signature already invalid)"* ]] || return 1
+	[[ "$output" == *"slimmed=0 failed=Fixture (code signature already invalid)"* ]] || return 1
 	[[ "$output" != *"app."* ]] || return 1
 	[[ "$(lipo -archs "$app/Contents/MacOS/Fixture")" == *x86_64* ]] || return 1
 	[ -z "$(ls -A "$TRASH_DIR")" ]
@@ -573,12 +573,12 @@ exec /usr/bin/codesign \"\$@\""
 		collect_slim_candidates || exit 8
 		echo "listed=${#SLIM_APP_PATHS[@]}"
 		slim_one_app 0 || exit 7
-		echo "failed=${SLIM_FAILURES[*]}"
+		echo "failed=${SLIM_FAILED_NAMES[*]} (${SLIM_FAILED_REASONS[*]})"
 	' bash "$PROJECT_ROOT/bin/slim.sh"
 
 	[ "$status" -eq 0 ]
 	[[ "$output" == *"listed=1"* ]] || return 1
-	[[ "$output" == *"failed=Fixture.app (running, quit it and retry)"* ]] || return 1
+	[[ "$output" == *"failed=Fixture (still running)"* ]] || return 1
 	[[ "$(lipo -archs "$app/Contents/MacOS/Fixture")" == *x86_64* ]] || return 1
 	[ -z "$(ls -A "$TRASH_DIR")" ]
 }
@@ -599,28 +599,50 @@ exec /usr/bin/codesign \"\$@\""
 		slim_app_is_running() { [[ -e "$started_marker" ]]; }
 		slim_verify_copy() { touch "$started_marker"; }
 		slim_one_app 0 || exit 7
-		echo "failed=${SLIM_FAILURES[*]}"
+		echo "failed=${SLIM_FAILED_NAMES[*]} (${SLIM_FAILED_REASONS[*]})"
 	' bash "$PROJECT_ROOT/bin/slim.sh" "$BATS_TEST_TMPDIR/started"
 
 	[ "$status" -eq 0 ]
-	[[ "$output" == *"failed=Fixture.app (running, quit it and retry)"* ]] || return 1
+	[[ "$output" == *"failed=Fixture (still running)"* ]] || return 1
 	[[ "$(lipo -archs "$app/Contents/MacOS/Fixture")" == *x86_64* ]] || return 1
 	[ -z "$(ls -A "$TRASH_DIR")" ]
 }
 
 @test "slim confirmation requires a successful Enter read" {
 	run slim_env /bin/bash -c '
 		source "$1"
+		SLIM_APP_PATHS=("$2/Fixture.app")
 		SLIM_APP_NAMES=(Fixture)
 		SLIM_APP_BYTES=(1024)
 		if confirm_slim_selection 0 </dev/null; then echo EOF_CONFIRMED; fi
 		if confirm_slim_selection 0 < <(printf "\n"); then echo ENTER_CONFIRMED; fi
-	' bash "$PROJECT_ROOT/bin/slim.sh"
+	' bash "$PROJECT_ROOT/bin/slim.sh" "$BATS_TEST_TMPDIR"
 	[ "$status" -eq 0 ]
 	[[ "$output" != *EOF_CONFIRMED* ]] || return 1
 	[[ "$output" == *ENTER_CONFIRMED* ]]
 }
 
+@test "slim summary lists slimmed apps and groups kept apps by reason" {
+	run slim_env /bin/bash -c '
+		source "$1"
+		SLIM_DONE_NAMES=(Claude Sketch NetNewsWire MiaoYan)
+		total_slimmed=4
+		total_freed_bytes=1048576
+		SLIM_FAILED_NAMES=(Stash ScreenFlow Kaku)
+		SLIM_FAILED_REASONS=("still running" "code signature check failed" "still running")
+		total_failed=3
+		show_slim_summary | sed $'"'"'s/\033\\[[0-9;]*m//g'"'"'
+	' bash "$PROJECT_ROOT/bin/slim.sh"
+	[ "$status" -eq 0 ] || { echo "$output"; return 1; }
+	[[ "$output" == *"Slim incomplete"* ]] || return 1
+	[[ "$output" == *"Slimmed 4 apps, freed 1.0MB: Claude, Sketch, NetNewsWire"* ]] || return 1
+	[[ "$output" == *$'\nMiaoYan\n'* ]] || return 1
+	[[ "$output" == *"Still running: Stash, Kaku"* ]] || return 1
+	[[ "$output" == *"Code signature check failed: ScreenFlow"* ]] || return 1
+	[[ "$output" != *".app"* ]] || return 1
+	[ "$(grep -c "Still running" <<< "$output")" -eq 1 ]
+}
+
 @test "slim slice output never follows a pre-existing suffix symlink" {
 	[[ "$SLIM_HAVE_FAT_TOOLCHAIN" == "1" ]] || skip "needs clang and a developer directory"
 	local file="$BATS_TEST_TMPDIR/thin-me" outside="$BATS_TEST_TMPDIR/outside"
```

#### Recent Merged Pull Requests:
- **PR #1842** (2026-10-24): fix(optimize): accept -n as alias for --dry-run (@viniciusdsandrade)
- **PR #1840** (2026-10-24): fix(touchid): cancel when menu confirmation input closes (@viniciusdsandrade)
- **PR #1838** (2026-10-24): fix(completion): cancel when confirmation input closes (@viniciusdsandrade)
- **PR #1835** (2026-10-24): fix(clean): detect missing Full Disk Access by reading protected paths (@jkimdev)
- **PR #1833** (2026-10-24): fix(status): show the routed interface's IP in the network card (@lilu007-github)
- **PR #1830** (closed): test(perf): check get_file_size's fork count structurally, not by timing (@noah-qin)

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

## X. clean): protect active caches and measure reclaimable blocks

**RULE**:
When implementing operations in `.claude/rules/core.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in tw93/Mole. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `52c5a7fa`: clean): protect active caches and measure reclaimable blocks. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Shell data structures, boundary deserialization, API parsing, or resource lifecycles matching `.claude/rules/core.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```shell
// Verified production-grade fix pattern:
- **A cleanup total counts readable bytes, and only a timeout makes it a lower bound.** A folder Mole cannot list it cannot remove either, so cleanup sizing retains readable-file totals. `get_path_size_kb` still provides the `readable` mode for callers using `du`; uninstall keeps its strict default (#1404). Clean's `get_cleanup_path_size_kb` and its bulk path share `_cleanup_path_sizes_kb`: allocated file blocks, internal hardlinks counted once only when every link is inside that candidate, and uncompressed APFS private bytes where supported. Symlinks are not followed, directory metadata is excluded, compressed or unsupported private-size probes use allocated bytes, and timed-out bulk results are discarded. Separate candidates deliberately do not claim external hardlink blocks even when both are selected. Sparse files and fully shared clones must not report their logical lengths as freed; real fixtures in `tests/file_ops_size.bats` lock these cases. Before this, six unavailable simulators holding 7.73GB were counted as 0 and the run printed `At least`, which read as a timeout that never happened. `mole_item_size_continues` marks the total partial only for a real timeout, a timeout 
```

**NEGATIVE CONSTRAINT**:
```shell
// Anti-pattern to NEVER write (induced failure mode):
- **A cleanup total counts readable bytes, and only a timeout makes it a lower bound.** `du` exits 1 when it cannot list a folder, after printing everything it could read; a folder Mole cannot list it cannot remove either, so cleanup sizing passes `readable` to `get_path_size_kb` and takes that total. Uninstall keeps the strict default (#1404). Before this, six unavailable simulators holding 7.73GB were counted as 0 and the run printed `At least`, which read as a timeout that never happened. `mole_item_size_continues` marks the total partial only for a real timeout, a timeout names its path in the debug log, and the partial total prints as `3.27GB+`, the same form as the Build artifacts hint. Locked by `cleanup sizing counts the readable bytes of a folder with an unlistable child`, `only a sizing timeout marks the cleanup total as a lower bound` and `a sizing timeout names the item in the debug log` in `tests/file_ops_size.bats`.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `52c5a7fa` are properly handled with clean fallback behavior.
