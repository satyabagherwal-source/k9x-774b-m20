> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/tw93-mole-learnings.md`  
> **Source**: github ([https://github.com/tw93/Mole](https://github.com/tw93/Mole))  
> **Source Version**: `a6be7507`  
> **License**: GPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T08:48:52.643Z  
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
> **Harvest Timestamp**: 2026-10-19T08:48:52.202Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tw93/Mole`
- **Description**: 🐹 Keep your Mac and PC clean, light, and running like new. Fast open-source CLI, plus native Mac and Windows apps.
- **Primary Language / Ecosystem**: Shell
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 71447 stars

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
- **Issue #1761** (2026-10-17): **[Mac App Bug] 「App 快取與記錄」中部分 App 的快取大小顯示不正確**
  *Symptoms*: ### Mole Mac app version  1.17.0 (331)  ### macOS version  15.8.2 (Sequoia)  ### Mac model  Mac16,10 (Apple M4)  ### Affected area  Clean  ### What happened?  最近發現 Mole 在「清理」→「App 快取與記錄」功能中，似乎有部分位於 `~/Library/Caches/` 底下的 App 快取資料夾，無法正確顯示實際大小。  這次發現的例子是 **Clicker for Netflix**，這是一款已經停止維護，但目前仍可正常使用的第三方 Netflix 客戶端。  它的快取資料夾位於：  `~/Library/Caches/com.dbklabs.clicker-for-netflix`  由於這款 App 會儲存 Netflix 的影片快取，因此該資料夾經常累積數百 MB，甚至數 GB 的資料。  不過，從下方截圖可以看到：  - **Mole 顯示的快取大小：** 2.61 MB - **Finder 顯示的實際大小：** 63.9 MB（磁碟上 65.4 MB，共 619 個項目）  由於截圖前我已經手動清理過一次快取，因此這次資料夾的容量相對較小，但仍然能明顯看出兩者的差異。  比較奇怪的是，雖然 Mole 顯示的快取大小明顯偏小，但實際執行清理時，卻仍然會將該資料夾內的快取全部清除。  因此有點懷疑，目前 Mole 對於 `~/Library/Caches/` 底下部分資料夾的大小計算邏輯，是否存在某些問題，導致顯示的可清理容量與實際清理的資料量不一致？  目前還不確定是否有其他 App 也存在相同情況，只是 Clicker for Netflix 的快取通常比較大，因此這個問題特別容易被注意到。  ### Steps to reproduce  1. 使用 Clicker for Netflix 播放影片，產生一定容量的影片快取。 2. 透過 Finder 查看 `~/Library/Caches/com.dbklabs.clicker-for-netflix` 的實際資料夾大小。 3. 開啟 Mole，進入「清理」→「App 快取與記錄」。 4. 找到 `com.dbklabs.clicker-for-netflix`，比較 Mole 顯示的大小與 Finder 的結果。 5. 可以發現 Mole 顯示的容量明顯小於實際大小，但執行清理時仍會完全清除整個資料夾的快取。  ### Expected behavior  希望 Mole 能正確計算並顯示 App 快取資料夾的大小，讓「清理」功能中顯示的可清理容量，與實際執行清理時所刪除的資料量一致。  如果是部分特殊檔案類型或資料夾結構造成計算差異，也希望能協助確認是否有改善的空間。  ### Screenshots or safe logs  <img width="1166" height="334" alt="Image" src="https://github.com/user-attachments/assets/1b682b26-7a78-4293-a7c1-0449f17affb7" />  <img width="603" height="426" alt="Image" src="https://github.com/user-attachments/assets/777cfb17-0ac6-46ee-8ea

- **Issue #1760** (2026-10-17): **[Mac App Bug] Ability to change temps to Fahrenheit is missing?**
  *Symptoms*: ### Mole Mac app version  1.16.0  ### macOS version  27.0.1  ### Mac model  MacBook Pro M2  ### Affected area  Status  ### What happened?  For some reason after updating to the latest version 1.16.0, my temperatures in the Mac menu bar from Mole as well as within the GUI app only display in Celsius. I can't seem to be able to change that back to Fahrenheit.  ### Steps to reproduce  View temps anywhere within the app  ### Expected behavior  Expecting the temps to be displayed in Fahrenheit instead of Celsius  ### Screenshots or safe logs  _No response_  ### Before submitting  - [x] I updated to the latest stable Mole Mac app, reopened it, and reproduced this problem (or this report explains why I cannot update). - [x] I did not include license keys, order numbers, or private data.

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

### Incident Patch 1: `8b49a13a` (2026-10-18)
**Commit Message**: fix: block macOS e2e actions after prerequisite failure

Keep-going may continue independent checks but must not authorize installation or mutation after failed preparation, integrity checks or fixture actions. Exercise the real orchestration with mocks in the existing Bats suite.

**File**: `.claude/rules/tests.md` (modified, +2/-1)
```diff
@@ -2,6 +2,7 @@
 paths:
   - "tests/**"
   - "scripts/test.sh"
+  - "scripts/e2e_macos.py"
   - "scripts/audit_bats_assertions.py"
   - ".github/workflows/*.yml"
   - "cmd/**/*_test.go"
@@ -20,5 +21,5 @@ Suite-level rules (summary line, `$TERM`, cancelled CI runs, never piping into `
   - `scripts/audit_bats_assertions.py` enforces all of this from `check.sh` in test bodies and `run ... bash <<EOF` script bodies; mock function bodies, data heredocs and a computation without a comparison such as `(( n++ ))` are exempt.
   - Every guard test must be observed red against the pre-fix path and green after restoration. The complete vacuous-test and shared-`HOME` checklist lives in `.claude/skills/bugs/references/test-validity-and-refusal-diagnostics.md`.
 - Tests that intentionally replace `safe_clean` are a seam; see the `declare -f` shim rule in `.claude/rules/clean.md`.
-- `scripts/e2e_macos.py` is the real-Mac release run (`.claude/skills/release-flow/SKILL.md` pre-flight step 7), not a CI job: it needs a logged-in user session, network and the user's real `~/Downloads`. Its first run found two defects that every unit test missed, an analyze cache that ignored directory changes for 30 minutes and `--help` refused by `update` and `remove`, so when a step fails, read its transcript before loosening the step.
+- `scripts/e2e_macos.py` is the real-Mac release run (`.claude/skills/release-flow/SKILL.md` pre-flight step 7), not a CI job: it needs a logged-in user session, network and the user's real `~/Downloads`. Its first run found two defects that every unit test missed, an analyze cache that ignored directory changes for 30 minutes and `--help` refused by `update` and `remove`, so when a step fails, read its transcript before loosening the step. `--keep-going` permits only independent checks: failed build, download, integrity, install or launch steps cannot authorize dependent mutations, and a failed uninstall retains its installer. `tests/e2e_harness_test.py`, called from `tests/cli.bats`, locks this with mocked actions and network; it does not run the real fixture.
 - Release preflight requires Check/Validation/CodeQL/Nix success on the tagged SHA. CodeQL and Nix ignore docs-only pushes, so the gate allows those two to be absent only when every changed file is `docs/**` or `*.md` and the nearest code-changing ancestor has both runs green; every required workflow also accepts `workflow_dispatch` so a missing run has a recovery path. A cancelled run is still not evidence.
```

**File**: `scripts/e2e_macos.py` (modified, +19/-15)
```diff
@@ -170,11 +170,12 @@ def __init__(self, keep_going):
         self.leftovers = []
         self.failed = False
 
-    def step(self, name, func):
-        if self.failed and not self.keep_going:
-            self.steps.append({"name": name, "status": "skipped", "detail": "an earlier step failed"})
+    def step(self, name, func, ready=True):
+        if not ready or (self.failed and not self.keep_going):
+            detail = "a required step did not pass" if not ready else "an earlier step failed"
+            self.steps.append({"name": name, "status": "skipped", "detail": detail})
             print(f"  SKIP  {name}")
-            return
+            return False
         start = time.monotonic()
         try:
             detail = func() or ""
@@ -188,6 +189,7 @@ def step(self, name, func):
         seconds = round(time.monotonic() - start, 1)
         self.steps.append({"name": name, "status": status, "seconds": seconds, "detail": detail})
         print(f"  {'PASS' if status == 'passed' else 'FAIL'}  {name} ({seconds}s){': ' + detail if detail else ''}")
+        return status == "passed"
 
     def log(self, name):
         return self.dir / f"{len(self.steps) + 1:02d}-{name}.log"
@@ -506,27 +508,29 @@ def smoke(run):
 def main():
     parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
     parser.add_argument("--skip-build", action="store_true", help="use the existing bin/*-go builds")
-    parser.add_argument("--keep-going", action="store_true", help="run later steps after a failure")
+    parser.add_argument("--keep-going", action="store_true", help="continue independent checks after a failure")
     args = parser.parse_args()
     if platform.system() != "Darwin":
         sys.exit("macOS only")
     run = Run(args.keep_going)
     print(f"Mole e2e {run.id}, report in {run.dir}")
     try:
-        run.step("preflight", lambda: preflight(run))
+        ready = run.step("preflight", lambda: preflight(run))
     except Refused as exc:
         print(f"  REFUSED  {exc}")
         sys.exit(2)
     if not args.skip_build:
-        run.step("build", lambda: build(run))
-    run.step("download fixture", lambda: download(run))
-    run.step("install fixture", lambda: install(run))
-    run.step("launch fixture", lambda: launch(run))
-    run.step("mo uninstall", lambda: uninstall(run))
-    run.step("mo history", lambda: history(run))
-    run.step("mo installer --dry-run", lambda: installer(run))
-    run.step("mo analyze delete", lambda: analyze(run))
-    run.step("smoke commands", lambda: smoke(run))
+        ready = run.step("build", lambda: build(run), ready=ready)
+    # A failed digest or install is never permission for the next mutation,
+    # even with --keep-going. Keep the fixture when uninstall did not finish.
+    downloaded = run.step("download fixture", lambda: download(run), ready=ready)
+    installed = run.step("install fixture", lambda: install(run), ready=downloaded)
+    launched = run.step("launch fixture", lambda: launch(run), ready=installed)
+    removed = run.step("mo uninstall", lambda: uninstall(run), ready=launched)
+    run.step("mo history", lambda: history(run), ready=removed)
+    run.step("mo installer --dry-run", lambda: installer(run), ready=downloaded)
+    run.step("mo analyze delete", lambda: analyze(run), ready=removed)
+    run.step("smoke commands", lambda: smoke(run), ready=ready)
 
     leftover = [str(APP_PATH)] if APP_PATH.exists() else []
     leftover += fixture_traces()
```

**File**: `tests/cli.bats` (modified, +6/-0)
```diff
@@ -980,3 +980,9 @@ PY
 	run python3 "$PROJECT_ROOT/tests/main_menu_pty.py"
 	[ "$status" -eq 0 ] || { echo "$output"; return 1; }
 }
+
+@test "e2e harness keeps failed prerequisites from authorizing later mutations" {
+	command -v python3 >/dev/null 2>&1 || skip "python3 not available"
+	run env MOLE_TEST_NO_AUTH=1 PYTHONDONTWRITEBYTECODE=1 python3 "$PROJECT_ROOT/tests/e2e_harness_test.py"
+	[ "$status" -eq 0 ] || { echo "$output"; return 1; }
+}
```

**File**: `tests/e2e_harness_test.py` (added, +104/-0)
```diff
@@ -0,0 +1,104 @@
+"""Exercise release-run failure boundaries without using the host Mac."""
+
+from contextlib import ExitStack, redirect_stdout
+import importlib.util
+import io
+import json
+from pathlib import Path
+import tempfile
+import unittest
+from unittest.mock import patch
+
+
+SPEC = importlib.util.spec_from_file_location(
+    "e2e_macos", Path(__file__).resolve().parents[1] / "scripts/e2e_macos.py")
+E2E = importlib.util.module_from_spec(SPEC)
+SPEC.loader.exec_module(E2E)
+
+
+class DependencyTests(unittest.TestCase):
+    def run_candidate(self, failed=None, keep_going=True, skip_build=False, download_fixture=None):
+        with tempfile.TemporaryDirectory() as tmp, ExitStack() as stack:
+            root = Path(tmp)
+            run = object.__new__(E2E.Run)
+            run.id, run.dir = "fixture", root
+            run.keep_going, run.steps, run.failed = keep_going, [], False
+            run.dmg = None
+            run.token = "fixture"
+            calls = []
+            real_download = E2E.download
+            names = ("preflight", "build", "download", "install", "launch", "uninstall",
+                     "history", "installer", "analyze", "smoke")
+            for name in names:
+                def action(_run, name=name):
+                    calls.append(name)
+                    if name == "download" and download_fixture:
+                        return real_download(_run)
+                    if name == failed:
+                        raise E2E.StepFailed("injected failure: " + name)
+                stack.enter_context(patch.object(E2E, name, side_effect=action))
+            stack.enter_context(patch.object(E2E, "Run", return_value=run))
+            stack.enter_context(patch.object(E2E, "APP_PATH", root / "absent.app"))
+            stack.enter_context(patch.object(E2E, "fixture_traces", return_value=[]))
+            stack.enter_context(patch.object(E2E.platform, "system", return_value="Darwin"))
+            stack.enter_context(patch.object(E2E.subprocess, "run", side_effect=AssertionError("real process")))
+            stack.enter_context(patch.object(E2E.subprocess, "Popen", side_effect=AssertionError("real terminal")))
+            stack.enter_context(patch.object(E2E.urllib.request, "urlopen", side_effect=AssertionError("real network")))
+            if download_fixture:
+                (root / "Downloads").mkdir()
+                stack.enter_context(patch.object(E2E, "HOME", root))
+                asset = {"name": "fixture.dmg", "browser_download_url": "https://fixture.invalid/fixture.dmg",
+                         "digest": "sha256:" + "0" * 64}
+                response = io.BytesIO(json.dumps({"assets": [asset]}).encode())
+                payload = OSError("download interrupted") if download_fixture == "network" else io.BytesIO(b"unverified image")
+                stack.enter_context(patch.object(E2E.urllib.request, "urlopen", side_effect=[response, payload]))
+            argv = ["e2e"] + (["--keep-going"] if keep_going else []) + (["--skip-build"] if skip_build else [])
+            stack.enter_context(patch("sys.argv", argv))
+            with redirect_stdout(io.StringIO()), self.assertRaises(SystemExit) as exit_result:
+                E2E.main()
+            report = json.loads((root / "report.json").read_text())
+            self.assertEqual(exit_result.exception.code, 1 if failed else 0)
+            return calls, report["steps"]
+
+    def test_failed_prerequisites_block_dependent_actions_with_keep_going(self):
+        expected = {
+            "preflight": ["preflight"],
+            "build": ["preflight", "build"],
+            "download": ["preflight", "build", "download", "smoke"],
+            "install": ["preflight", "build", "download", "install", "installer", "smoke"],
+            "launch": ["preflight", "build", "download", "install", "launch", "installer", "smoke"],
+            "uninstall": ["preflight", "build", "download", "install", "launch", "uninstall", "installer", "smoke"],
+        }
+        for failed, wanted in expected.items():
+            with self.subTest(failed=failed):
+                calls, steps = self.run_candidate(failed)
+                self.assertEqual(calls, wanted)
+                self.assertIn("skipped", [step["status"] for step in steps])
+
+    def test_read_only_failure_keeps_independent_analyze_and_smoke(self):
+        calls, _ = self.run_candidate("installer")
+        self.assertEqual(calls[-3:], ["installer", "analyze", "smoke"])
+
+    def test_default_stops_after_first_failure(self):
+        calls, _ = self.run_candidate("download", keep_going=False)
+        self.assertEqual(calls, ["preflight", "build", "download"])
+
+    def test_failed_transfer_and_checksum_block_installation(self):
+        for failure in ("network", "checksum"):
+            with self.subTest(failure=failure):
+                calls, steps = self.run_candidate("download", download_fixture=failure)
+                self.
```

---

### Incident Patch 2: `e9fbcf8e` (2026-10-18)
**Commit Message**: fix: require confirmed roots before owner cache cleanup

Do not authorize owner commands from guessed defaults after failed cache-root probes. Check every configured Conda package root against the whitelist, preserve signal cancellation and retain data when discovery is incomplete.

**File**: `.claude/rules/clean-dev.md` (modified, +3/-0)
```diff
@@ -24,6 +24,9 @@ General clean target policy, including the owner-command rule, is in `.claude/ru
 
 ## Recovery contracts
 
+- uv, npm, pip and mise owner cache commands require a successful absolute-root query (or mise's explicit absolute `MISE_CACHE_DIR`). Failed, empty, relative or multiline answers skip that owner command; a signal still cancels. Never whitelist a guessed default and then let the owner mutate its separately configured root. Known npm default residuals keep their existing safe-clean guards. Locked by the four `owner cleanup requires a confirmed cache root` cases in `tests/clean_dev_caches.bats`.
+- Conda validates every `pkgs_dirs` entry from one successful `conda info --json` snapshot before running its owner cleanup. An absent, empty, invalid or partially readable list skips the command; any whitelisted root or descendant protects the entire command. Locked by `conda owner cleanup protects every configured package cache root` in `tests/clean_dev_caches.bats`.
+
 - **Classify cleanup by recovery contract, not by directory name or download cost.** Re-downloading is a real cost but not an automatic veto when the user explicitly runs `clean`: Go's module cache is owner-documented, machine-resolvable, and independently whitelistable, so it is reset through `go clean -modcache`.
 - Directly consumed or mixed-state stores still stay: `registry/src`, Cargo `git`, `$DENO_DIR`, `~/.ivy2/cache`, `~/.m2/repository`, `~/.nuget/packages`, `~/.cabal/packages`, and `~/.cpan/sources`. Cargo's compressed `registry/cache` is redundant with extracted sources, while Cargo 1.88+ owns age-aware GC for sources and git dependencies.
 - Downloaded model and experiment roots (`~/.cache/huggingface`, `~/.cache/torch`, `~/.cache/tensorflow`, `~/.cache/wandb`) and toolchain payloads (`~/.sbt/boot`, `~/.sbt/launchers`, `~/.stack/programs`) stay off the blanket delete path. `DENO_DIR` is review-only because the owner command removes the entire root, including origin storage and downloaded runtime payloads.
```

**File**: `lib/clean/dev.sh` (modified, +52/-24)
```diff
@@ -98,11 +98,13 @@ clean_corepack_cache() {
 clean_uv_cache() {
     local uv_cache_path="$HOME/.cache/uv"
     if command -v uv > /dev/null 2>&1 && run_with_timeout "$MOLE_TIMEOUT_QUICK_DETECT_SEC" uv --version > /dev/null 2>&1; then
-        local detected_cache
-        detected_cache=$(run_with_timeout "$MOLE_TIMEOUT_QUICK_DETECT_SEC" uv cache dir 2> /dev/null || true)
-        if [[ -n "$detected_cache" && "$detected_cache" == /* ]]; then
-            uv_cache_path="$detected_cache"
-        fi
+        local detected_cache cache_rc=0
+        detected_cache=$(run_with_timeout "$MOLE_TIMEOUT_QUICK_DETECT_SEC" uv cache dir 2> /dev/null) || cache_rc=$?
+        mole_rc_signal "$cache_rc" && return "$cache_rc"
+        # The owner may use a configured root. A failed lookup is not permission
+        # to check the default path and mutate a different one.
+        [[ $cache_rc -eq 0 && "$detected_cache" == /* && "$detected_cache" != *$'\n'* ]] || return 0
+        uv_cache_path="$detected_cache"
         clean_tool_cache "uv cache" "$uv_cache_path" run_with_timeout "$MOLE_TIMEOUT_PKG_CLEANUP_SEC" uv cache prune || return $?
     else
         safe_clean "$uv_cache_path"/* "uv cache"
@@ -295,9 +297,29 @@ clean_conda_metadata_caches() {
         return 0
     fi
 
-    local conda_cache_hint="$HOME/.conda/pkgs"
     if command -v conda > /dev/null 2>&1 && run_with_timeout "$MOLE_TIMEOUT_QUICK_DETECT_SEC" conda --version > /dev/null 2>&1; then
-        clean_tool_cache "conda index/tarball/log caches" "$conda_cache_hint" \
+        # Conda also cleans custom pkgs_dirs. Validate the complete owner
+        # snapshot before authorizing a command that can touch all of them.
+        local conda_info="" info_rc=0 root_count="" root="" i=0
+        conda_info=$(run_with_timeout "$MOLE_TIMEOUT_QUICK_DETECT_SEC" conda info --json 2> /dev/null) || info_rc=$?
+        mole_rc_signal "$info_rc" && return "$info_rc"
+        [[ $info_rc -eq 0 ]] || return 0
+        root_count=$(printf '%s' "$conda_info" | /usr/bin/plutil -extract pkgs_dirs raw -expect array -o - - 2> /dev/null) || return 0
+        [[ "$root_count" =~ ^[0-9]+$ && "$root_count" -gt 0 ]] || return 0
+        conda_pkg_roots=()
+        for ((i = 0; i < root_count; i++)); do
+            # Retain trailing newlines so malformed paths cannot become valid.
+            root=$(
+                printf '%s' "$conda_info" | /usr/bin/plutil -extract "pkgs_dirs.$i" raw -expect string -o - - 2> /dev/null || exit $?
+                printf '\001'
+            ) || return 0
+            root="${root%$'\001'}"
+            root="${root%$'\n'}"
+            [[ "$root" == /* && "$root" != *$'\n'* ]] || return 0
+            conda_pkg_roots+=("$root")
+        done
+        conda_cache_whitelisted "${conda_pkg_roots[@]}" && return 0
+        clean_tool_cache "conda index/tarball/log caches" "${conda_pkg_roots[0]}" \
             run_with_timeout "$MOLE_TIMEOUT_DISK_VERIFY_SEC" conda clean --yes --index-cache --tarballs --logfiles || return $?
         return 0
     fi
@@ -460,14 +482,18 @@ clean_dev_npm() {
 
     if command -v npm > /dev/null 2>&1; then
         start_section_spinner "Checking npm cache path..."
-        npm_cache_path=$(run_with_timeout "$MOLE_TIMEOUT_QUICK_DETECT_SEC" npm config get cache 2> /dev/null) || npm_cache_path=""
+        local npm_cache_rc=0
+        npm_cache_path=$(run_with_timeout "$MOLE_TIMEOUT_QUICK_DETECT_SEC" npm config get cache 2> /dev/null) || npm_cache_rc=$?
         stop_section_spinner
+        mole_rc_signal "$npm_cache_rc" && return "$npm_cache_rc"
 
-        if [[ -z "$npm_cache_path" || "$npm_cache_path" != /* ]]; then
+        if [[ $npm_cache_rc -eq 0 && "$npm_cache_path" == /* && "$npm_cache_path" != *$'\n'* ]]; then
+            clean_tool_cache "npm cache" "$npm_cache_path" run_with_timeout "$MOLE_TIMEOUT_PKG_CLEANUP_SEC" npm cache clean --force || return $?
+        else
+            # Known default residuals below retain their own safe-clean guards;
+            # do not run an owner command against an unresolved configured root.
             npm_cache_path="$npm_default_cache"
         fi
-
-        clean_tool_cache "npm cache" "$npm_cache_path" run_with_timeout "$MOLE_TIMEOUT_PKG_CLEANUP_SEC" npm cache clean --force || return $?
     fi
 
     # These residual directories are not removed by `npm cache clean --force`
@@ -801,12 +827,12 @@ clean_clang_module_cache() {
 clean_dev_python() {
     # Check pip3 is functional (not just macOS stub that triggers CLT install dialog)
     if command -v pip3 > /dev/null 2>&1 && run_with_timeout "$MOLE_TIMEOUT_QUICK_DETECT_SEC" pip3 --version > /dev/null 2>&1; then
-        local pip_cache_path
-        pip_cache_path=$(run_with_timeout "$MOLE_TIMEOUT_QUICK_DETECT_SEC" pip3 cache dir 2> /dev/null) || pip_cache_path=""
-        if [[ -z "$pip_cache_path" || "$pip_cache_path" != /* ]]; then
-            pip_cache_path="$HOME/Library/Caches/pip"
+        local pip_cache_path pi
```

**File**: `tests/clean_dev_caches.bats` (modified, +134/-0)
```diff
@@ -37,6 +37,68 @@ SCRIPT
     chmod +x "$HOME/bin/gh"
 }
 
+assert_owner_cleanup_requires_confirmed_root() {
+    local owner_tool="$1" owner_entry="$2"
+    run env HOME="$HOME" PROJECT_ROOT="$PROJECT_ROOT" PATH="/usr/bin:/bin" \
+        MOLE_TEST_NO_AUTH=1 OWNER_TOOL="$owner_tool" OWNER_ENTRY="$owner_entry" /bin/bash --noprofile --norc <<'EOF'
+set -euo pipefail
+source "$PROJECT_ROOT/lib/core/common.sh"
+source "$PROJECT_ROOT/lib/clean/dev.sh"
+DRY_RUN=false
+start_section_spinner() { :; }
+stop_section_spinner() { :; }
+note_activity() { :; }
+safe_clean() { :; }
+clean_pnpm_stores() { :; }
+clean_corepack_cache() { :; }
+clean_conda_metadata_caches() { :; }
+run_with_timeout() { shift; "$@"; }
+owner_stub() {
+    case "$*" in
+        --version) return 0 ;;
+        'cache dir' | 'cache path' | 'config get cache')
+            case "$probe_mode" in
+                failed) printf '%s\n' "$HOME/protected-owner"; return 1 ;;
+                timeout) return 124 ;;
+                signal) return 130 ;;
+                relative) echo relative-cache ;;
+                multiline) printf '%s\nextra\n' "$HOME/protected-owner" ;;
+                empty) return 0 ;;
+                *) printf '%s\n' "$HOME/protected-owner" ;;
+            esac ;;
+        'cache prune' | 'cache clean --force' | 'cache purge' | 'cache clear')
+            echo owner >> "$HOME/owner-root.trace" ;;
+        *) return 1 ;;
+    esac
+}
+eval "$OWNER_TOOL() { owner_stub \"\$@\"; }"
+if [[ "$OWNER_TOOL" == pip3 ]]; then clean_uv_cache() { :; }; fi
+unset MISE_CACHE_DIR
+export UV_CACHE_DIR="$HOME/protected-owner"
+for probe_mode in failed timeout signal relative multiline empty whitelisted known; do
+    MOLE_CLEAN_CANCEL_STATUS=0
+    WHITELIST_PATTERNS=("$HOME/protected-owner")
+    [[ "$probe_mode" != known && "$probe_mode" != failed ]] || WHITELIST_PATTERNS=()
+    : > "$HOME/owner-root.trace"
+    rc=0
+    "$OWNER_ENTRY" || rc=$?
+    if [[ "$probe_mode" == signal ]]; then
+        [[ "$rc" == 130 ]] || exit 1
+    else
+        [[ "$rc" == 0 ]] || exit 1
+    fi
+    if [[ "$probe_mode" == known ]]; then
+        [[ "$(cat "$HOME/owner-root.trace")" == owner ]] || exit 1
+    else
+        [[ ! -s "$HOME/owner-root.trace" ]] || { echo "UNEXPECTED:$probe_mode"; exit 1; }
+    fi
+done
+echo ROOT_GUARD_OK
+EOF
+    [ "$status" -eq 0 ] || { echo "$output"; return 1; }
+    [[ "$output" == *ROOT_GUARD_OK* ]] || return 1
+}
+
 @test "clean_github_cli_cache uses gh owner command for the default cache" {
     local trace="$HOME/gh-default.trace"
     mkdir -p "$HOME/.cache/gh"
@@ -4554,3 +4616,75 @@ EOF
     grep -qx 'PIP3:--version' "$trace"
 }
 
+
+@test "uv owner cleanup requires a confirmed cache root" {
+    assert_owner_cleanup_requires_confirmed_root uv clean_uv_cache
+}
+
+@test "npm owner cleanup requires a confirmed cache root" {
+    assert_owner_cleanup_requires_confirmed_root npm clean_dev_npm
+}
+
+@test "pip3 owner cleanup requires a confirmed cache root" {
+    assert_owner_cleanup_requires_confirmed_root pip3 clean_dev_python
+}
+
+@test "mise owner cleanup requires a confirmed cache root" {
+    assert_owner_cleanup_requires_confirmed_root mise clean_dev_mise
+}
+
+@test "conda owner cleanup protects every configured package cache root" {
+    run env HOME="$HOME" PROJECT_ROOT="$PROJECT_ROOT" MOLE_TEST_NO_AUTH=1 \
+        /bin/bash --noprofile --norc <<'EOF'
+set -euo pipefail
+source "$PROJECT_ROOT/lib/core/common.sh"
+source "$PROJECT_ROOT/lib/clean/dev.sh"
+run_with_timeout() { shift; "$@"; }
+note_activity() { :; }
+conda() {
+    case "$*" in
+        --version) return 0 ;;
+        'info --json')
+            case "$probe_mode" in
+                failed) return 1 ;;
+                timeout) return 124 ;;
+                signal) return 130 ;;
+                malformed) echo '{' ;;
+                missing) echo '{}' ;;
+                empty) echo '{"pkgs_dirs":[]}' ;;
+                itemtype) echo '{"pkgs_dirs":["/first",1]}' ;;
+                newline) printf '{"pkgs_dirs":["/first\\n"]}\n' ;;
+                single) printf '{"pkgs_dirs":["%s/first-cache"]}\n' "$HOME" ;;
+                wrongtype) echo '{"pkgs_dirs":"/unexpected"}' ;;
+                relative) echo '{"pkgs_dirs":["/first","relative"]}' ;;
+                *) printf '{"platform":"osx-arm64","active_prefix":null,"root_writable":true,"pkgs_dirs":["%s/first-cache","%s/custom-cache"],"envs":[]}\n' "$HOME" "$HOME" ;;
+            esac ;;
+        'clean --yes --index-cache --tarballs --logfiles') echo owner >> "$HOME/conda-root.trace" ;;
+        *) return 1 ;;
+    esac
+}
+for DRY_RUN in false true; do
+    for probe_mode in protected child failed timeout signal malformed missing empty itemtype newline wrongtype relative single known; do
+        WHITELIST_PATTERNS=()
+        [[ "$probe_mode" != protected ]] || WHITELIST_PATTERNS=("$HOME/custom-cache")
+        [[ "$probe_mode" != child ]] || WHITELIST_PATTERNS=("$HOME/custom-cac
```

---

### Incident Patch 3: `e6b94dc8` (2026-10-18)
**Commit Message**: fix(analyze): refresh a directory changed soon after its scan

A 30-minute mtime grace kept serving a directory's cached listing as
current, so a file downloaded after a scan stayed invisible and a deleted
one stayed listed until the window passed; a parent scan also folded the
outdated child total into its own. The comment already promised refusal
for any change. Drop the grace: the TUI still paints the old listing
immediately and refreshes behind it, and the rescan costs one level. The
change helper now bumps the mtime one minute after the scan, which the
old code fails.

**File**: `cmd/analyze/analyze_test.go` (modified, +5/-4)
```diff
@@ -3116,7 +3116,7 @@ func TestLoadCacheExpiresWhenDirectoryChanges(t *testing.T) {
 	if _, err := os.Stat(cachePath); err != nil {
 		t.Fatalf("stat cache: %v", err)
 	}
-	oldTime := time.Now().Add(-cacheModTimeGrace - time.Minute)
+	oldTime := time.Now().Add(-time.Hour)
 	if err := os.Chtimes(cachePath, oldTime, oldTime); err != nil {
 		t.Fatalf("chtimes cache: %v", err)
 	}
@@ -3151,11 +3151,12 @@ func TestLoadCacheExpiresWhenDirectoryChanges(t *testing.T) {
 	}
 }
 
-// setChangedAfterRecentScan runs save while dir's mtime is 2h old, then moves
-// the mtime to now: past the grace window, with the scan only just recorded.
+// setChangedAfterRecentScan runs save while dir's mtime is a minute old, then
+// moves the mtime to now: a file added or removed right after the scan, as when
+// a user downloads something and reopens analyze.
 func setChangedAfterRecentScan(t *testing.T, dir string, save func()) {
 	t.Helper()
-	old := time.Now().Add(-2 * time.Hour)
+	old := time.Now().Add(-time.Minute)
 	if err := os.Chtimes(dir, old, old); err != nil {
 		t.Fatalf("chtimes %s: %v", dir, err)
 	}
```

**File**: `cmd/analyze/cache.go` (modified, +1/-3)
```diff
@@ -638,9 +638,7 @@ func loadCacheFromDisk(path string) (*cacheEntry, error) {
 	// loadStaleCacheFromDisk and refreshes behind it, and the rescan reuses the
 	// unchanged subtrees below, so refusing costs one level, not a full scan.
 	if info.ModTime().After(entry.ModTime) {
-		if cacheModTimeGrace <= 0 || info.ModTime().Sub(entry.ModTime) > cacheModTimeGrace {
-			return nil, fmt.Errorf("cache expired: directory modified")
-		}
+		return nil, fmt.Errorf("cache expired: directory modified")
 	}
 
 	return entry, nil
```

**File**: `cmd/analyze/constants.go` (modified, +0/-1)
```diff
@@ -21,7 +21,6 @@ const (
 	mdlsTimeout            = 5 * time.Second
 	maxConcurrentOverview  = 8
 	batchUpdateSize        = 100
-	cacheModTimeGrace      = 30 * time.Minute
 	staleCacheTTL          = 3 * 24 * time.Hour
 
 	// Analyzer cache admission and eviction budget. A subtree is only worth a
```

#### Recent Merged Pull Requests:
- **PR #1776** (2026-10-19): fix(update): fall back to git release tags when stable API lookup fails (@viniciusdsandrade)
- **PR #1774** (2026-10-19): fix(uninstall): include fish configuration in reference scan (@viniciusdsandrade)
- **PR #1772** (2026-10-19): fix(purge): answer -h for usage and exit 0 (@viniciusdsandrade)
- **PR #1769** (2026-10-19): fix(whitelist): include all Xcode DeviceSupport platforms in cache whitelist (@viniciusdsandrade)
- **PR #1768** (2026-10-19): fix(clean): quote downloads directory path in incomplete downloads scan (@viniciusdsandrade)
- **PR #1767** (closed): fix(completion): enforce command boundary when detecting installed shell completion (@viniciusdsandrade)

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

## X. block macOS e2e actions after prerequisite failure

**RULE**:
When implementing operations in `.claude/rules/tests.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in tw93/Mole. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `8b49a13a`: block macOS e2e actions after prerequisite failure. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Shell data structures, boundary deserialization, API parsing, or resource lifecycles matching `.claude/rules/tests.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```shell
// Verified production-grade fix pattern:
  - "scripts/e2e_macos.py"
- `scripts/e2e_macos.py` is the real-Mac release run (`.claude/skills/release-flow/SKILL.md` pre-flight step 7), not a CI job: it needs a logged-in user session, network and the user's real `~/Downloads`. Its first run found two defects that every unit test missed, an analyze cache that ignored directory changes for 30 minutes and `--help` refused by `update` and `remove`, so when a step fails, read its transcript before loosening the step. `--keep-going` permits only independent checks: failed build, download, integrity, install or launch steps cannot authorize dependent mutations, and a failed uninstall retains its installer. `tests/e2e_harness_test.py`, called from `tests/cli.bats`, locks this with mocked actions and network; it does not run the real fixture.
```

**NEGATIVE CONSTRAINT**:
```shell
// Anti-pattern to NEVER write (induced failure mode):
- `scripts/e2e_macos.py` is the real-Mac release run (`.claude/skills/release-flow/SKILL.md` pre-flight step 7), not a CI job: it needs a logged-in user session, network and the user's real `~/Downloads`. Its first run found two defects that every unit test missed, an analyze cache that ignored directory changes for 30 minutes and `--help` refused by `update` and `remove`, so when a step fails, read its transcript before loosening the step.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `8b49a13a` are properly handled with clean fallback behavior.
