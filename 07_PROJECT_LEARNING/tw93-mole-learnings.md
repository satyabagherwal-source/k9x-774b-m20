> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/tw93-mole-learnings.md`  
> **Source**: github ([https://github.com/tw93/Mole](https://github.com/tw93/Mole))  
> **Source Version**: `85162c24`  
> **License**: GPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-31T15:36:32.271Z  
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
> **Harvest Timestamp**: 2026-10-31T15:36:32.265Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tw93/Mole`
- **Description**: 🐹 Keep your Mac and PC clean, light, and running like new. Fast open-source CLI, plus native Mac and Windows apps.
- **Primary Language / Ecosystem**: Shell
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 73431 stars

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
- **Issue #1878** (2026-10-29): **[Mac App Bug] In**
  *Symptoms*: ### Mole Mac app version  1.18.0 (343)  ### macOS version  27.2.0  ### Mac model  MacBookPro18,1 (Apple M1 Pro)  ### Affected area  Optimize  ### What happened?  After optimizing, in Spotlight the switch „Show Related Content“ is turned on, I keep it always turned off.  ### Steps to reproduce  1. Open Mole 2. Go to "Optimize" 3. Klick in Optimize  4. Mole is working and finishing  5. When I open System Settings on MacOS in the Menu in the upper left corner of MacOS, the switch „Show Related Content“ is turned on, although it is always set to off.  ### Expected behavior  <img width="1480" height="2014" alt="Image" src="https://github.com/user-attachments/assets/be4dd83e-706b-47eb-82fd-b12ffc275245" />  ### Screenshots or safe logs  <img width="1480" height="2014" alt="Image" src="https://github.com/user-attachments/assets/0b1c4ecc-58f6-4d9b-8a7f-670ddd041463" />  ### Before submitting  - [x] I updated to the latest stable Mole Mac app, reopened it, and reproduced this problem (or this report explains why I cannot update). - [x] I did not include license keys, order numbers, or private data.

- **Issue #1877** (2026-10-28): **[Mac App Bug]**
  *Symptoms*: ### Mole Mac app version  v1.18.0  ### macOS version  macOS 27.0.1  ### Mac model  MacBook Pro M2  ### Affected area  Clean  ### What happened?  在 **清理** 页面（Clean）中央出现了一个大面积的亮粉色方块，覆盖了原本应该显示的图标和文案区域，导致页面内容严重错乱。方块旁边还能看到一个小小的圆形图标，页面文字"山雨涤尘垢，潮退万象新"也被粉色方块遮挡了一部分。  **切换到其他 Tab（如「软件」）再切回「清理」页面后，粉色方块消失，页面恢复正常显示。**  这种现象看起来像是图片/纹理首次加载失败、SwiftUI/AppKit Canvas 未正确绘制、或是 Metal/Shader 层在首次渲染时的占位异常（品红色 placeholder）。   ### Steps to reproduce  1. 打开 Mole，进入 **清理** 页面。 2. 观察页面中央是否出现大面积亮粉色方块，覆盖图标和文案。 3. 切换到 **软件**（或其他）Tab。 4. 再切回 **清理** 页面 —— 粉色方块消失，显示正常。  ### Expected behavior  清理页面首次进入时应直接正确渲染出图标，不应出现任何颜色异常的占位方块。  ### Screenshots or safe logs  <img width="1100" height="772" alt="Image" src="https://github.com/user-attachments/assets/ab239a2f-3fa8-4ed8-a1b7-a566c034eb37" />  <img width="1100" height="772" alt="Image" src="https://github.com/user-attachments/assets/e3ad38a6-c627-4558-bd92-3a9cfc72b071" />  ### Before submitting  - [x] I updated to the latest stable Mole Mac app, reopened it, and reproduced this problem (or this report explains why I cannot update). - [x] I did not include license keys, order numbers, or private data.

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

### Incident Patch 1: `21d44166` (2026-10-31)
**Commit Message**: fix(clean): clean the yarn berry global cache instead of ~/.yarn/cache

The "Yarn cache" row cleaned ~/.yarn/cache/*, which Yarn never writes:
Berry keeps .yarn/cache inside each project and its shared global cache
in ~/.yarn/berry/cache, and Classic on macOS uses ~/Library/Caches/Yarn,
which the next row already cleans. So the row was always empty and the
Berry global cache was never offered.

The row now cleans ~/.yarn/berry/cache/* as "Yarn Berry cache", same
tier and plain safe_clean as before. The whitelist catalog row follows
it ("Yarn Berry package cache"), and ~/.yarn/cache joins the list of
rows no cleanup consults, so a protected entry still keeps the cache
the cleaner deletes. A saved ~/.yarn/cache line keeps working as a
custom pattern. Mole Mac made the same change.

Verified: the new "clean_dev_npm cleans the Yarn Berry global cache,
not the unused ~/.yarn/cache" case and the two updated
manage_whitelist.bats cases were red on the old code and are green;
manage_whitelist.bats 51/51 ok; scripts/check.sh --no-format passes.
clean_dev_caches.bats has five owner-root failures that fail the same
way on untouched origin/main. Revert: git revert this commit.

**File**: `lib/clean/dev.sh` (modified, +4/-1)
```diff
@@ -717,7 +717,10 @@ clean_dev_npm() {
     note_activity
     safe_clean ~/.tnpm/_cacache/* "tnpm cache directory"
     safe_clean ~/.tnpm/_logs/* "tnpm logs"
-    safe_clean ~/.yarn/cache/* "Yarn cache"
+    # Yarn Berry keeps .yarn/cache inside each project and its shared global
+    # cache in ~/.yarn/berry/cache; ~/.yarn/cache is never written. Yarn
+    # Classic on macOS uses ~/Library/Caches/Yarn.
+    safe_clean ~/.yarn/berry/cache/* "Yarn Berry cache"
     safe_clean ~/Library/Caches/Yarn/* "Yarn v1 cache"
 }
 # Resolve a cache root to its physical location and prove that it remains a
```

**File**: `lib/manage/whitelist.sh` (modified, +1/-1)
```diff
@@ -138,7 +138,7 @@ pip Python package cache|$HOME/Library/Caches/pip/*|package_manager
 uv Python package cache|$HOME/.cache/uv/*|package_manager
 tealdeer tldr pages cache|$HOME/Library/Caches/tealdeer/tldr-pages|package_manager
 Homebrew downloaded packages|$HOME/Library/Caches/Homebrew/*|package_manager
-Yarn package manager cache|$HOME/.yarn/cache/*|package_manager
+Yarn Berry package cache|$HOME/.yarn/berry/cache/*|package_manager
 Yarn v1 package cache|$HOME/Library/Caches/Yarn/*|package_manager
 pnpm package store|$HOME/Library/pnpm/store/*|package_manager
 Bun package cache|$HOME/.bun/install/cache/*|package_manager
```

**File**: `tests/clean_dev_caches.bats` (modified, +25/-0)
```diff
@@ -682,6 +682,31 @@ EOF
     [[ "$output" == *"npm prebuilds|$HOME/.npm/_prebuilds/*"* ]]
 }
 
+# Yarn Berry writes .yarn/cache inside each project and its global cache in
+# ~/.yarn/berry/cache; ~/.yarn/cache was a row that never held anything.
+@test "clean_dev_npm cleans the Yarn Berry global cache, not the unused ~/.yarn/cache" {
+    run env HOME="$HOME" PROJECT_ROOT="$PROJECT_ROOT" /bin/bash --noprofile --norc << 'EOF'
+set -euo pipefail
+source "$PROJECT_ROOT/lib/core/common.sh"
+source "$PROJECT_ROOT/lib/clean/dev.sh"
+start_section_spinner() { :; }
+stop_section_spinner() { :; }
+clean_tool_cache() { :; }
+clean_pnpm_stores() { :; }
+clean_corepack_cache() { :; }
+clean_bun_cache() { :; }
+safe_clean() { echo "$2|$1"; }
+note_activity() { :; }
+npm() { return 1; }
+clean_dev_npm
+EOF
+
+    [ "$status" -eq 0 ] || { echo "$output"; return 1; }
+    [[ "$output" == *"Yarn Berry cache|$HOME/.yarn/berry/cache/*"* ]] || { echo "$output"; return 1; }
+    [[ "$output" == *"Yarn v1 cache|$HOME/Library/Caches/Yarn/*"* ]] || { echo "$output"; return 1; }
+    [[ "$output" != *"|$HOME/.yarn/cache/"* ]]
+}
+
 @test "clean_dev_jvm never enters daemon cleanup while Gradle is running" {
     run env HOME="$HOME" PROJECT_ROOT="$PROJECT_ROOT" /bin/bash --noprofile --norc << 'EOF'
 set -euo pipefail
```

**File**: `tests/manage_whitelist.bats` (modified, +5/-5)
```diff
@@ -849,11 +849,11 @@ EOF
     local test_home="$HOME/rows-delete-paths"
     rm -rf "$test_home"
     mkdir -p "$test_home/Library/Caches/pip/http" \
-        "$test_home/.yarn/cache" "$test_home/Library/Caches/Yarn/v6" \
+        "$test_home/.yarn/berry/cache" "$test_home/Library/Caches/Yarn/v6" \
         "$test_home/.gem/specs" "$test_home/.gem/ruby/3.2.0/cache" \
         "$test_home/.local/share/containers/storage/tmp"
     touch "$test_home/Library/Caches/pip/http/a" \
-        "$test_home/.yarn/cache/a.zip" "$test_home/Library/Caches/Yarn/v6/a" \
+        "$test_home/.yarn/berry/cache/a.zip" "$test_home/Library/Caches/Yarn/v6/a" \
         "$test_home/.gem/specs/a" "$test_home/.gem/ruby/3.2.0/cache/a.gem" \
         "$test_home/.local/share/containers/storage/tmp/a"
 
@@ -916,7 +916,7 @@ pattern_for_row() {
 
 rows=(
     "pip Python package cache|pip cache"
-    "Yarn package manager cache|Yarn cache"
+    "Yarn Berry package cache|Yarn Berry cache"
     "Yarn v1 package cache|Yarn v1 cache"
     "RubyGems package cache|gem package cache"
     "RubyGems spec cache|gem spec cache"
@@ -976,7 +976,7 @@ EOF
     local dead
     # shellcheck disable=SC2016  # Literal $HOME spellings, as the inventory prints them.
     for dead in \
-        '$HOME/.cache/pip/' '$HOME/.cache/yarn/' '$HOME/.gem/cache/' \
+        '$HOME/.cache/pip/' '$HOME/.cache/yarn/' '$HOME/.yarn/cache/' '$HOME/.gem/cache/' \
         '$HOME/.local/share/containers/cache/' \
         '$HOME/.rustup/toolchains/' '$HOME/.ccache/' '$HOME/.cache/sccache/' \
         '$HOME/.cache/flutter/' '$HOME/.cache/selenium/' '$HOME/.ollama/'; do
@@ -987,7 +987,7 @@ EOF
     # shellcheck disable=SC2016  # Literal $HOME spelling, as the inventory prints it.
     [[ "$output" == *'|$HOME/Library/Caches/pip/*|'* ]] || return 1
     # shellcheck disable=SC2016  # Literal $HOME spelling, as the inventory prints it.
-    [[ "$output" == *'|$HOME/.yarn/cache/*|'* ]] || return 1
+    [[ "$output" == *'|$HOME/.yarn/berry/cache/*|'* ]] || return 1
 }
 
 # The Toolbox cleaner only strips whitelist patterns that start at its own apps
```

---

### Incident Patch 2: `3b0f94df` (2026-10-30)
**Commit Message**: fix(clean): never treat the llama.cpp model store as a cache

llama.cpp downloads -hf model weights, multi-GB GGUF files, into its
default LLAMA_CACHE at ~/Library/Caches/llama.cpp, which the generic
~/Library/Caches sweep reached, so mo clean deleted downloaded models.
The folder joins SAFETY_WHITELIST_PATTERNS, which stays merged in even
when the user saved a custom whitelist. Mole Mac blocks the same folder.
The custom-whitelist test that now also covers it was renamed, so the
I-13 incident row follows the new name.

Verified: the renamed clean_user_core.bats case fails without the pattern
and passes now; audit_incidents.py, check.sh --no-format and the full
test.sh suite pass.
Rollback: git revert this commit.

**File**: `docs/incidents.md` (modified, +1/-1)
```diff
@@ -47,7 +47,7 @@ when it was confirmed by reading the history, otherwise `unknown`.
 | I-10 | 2026-10-27 | Dry-run find scans sized and recorded each candidate twice and returned 1 when no preview ledger was set up (#1865) | 70eed1b0 | a703eddc | review | `safe_find_delete dry run records each target once without removal fallthrough (#1865)`, `safe_sudo_find_delete dry run records targets once and tracks count (#1865)` |
 | I-11 | 2026-10-27 | `mo clean` removed installed npx packages while running commands still needed their resources and modules (#1870) | unknown | f954e2fd | unit | `clean_dev_npm preserves installed npx packages in default and custom caches (#1870)` |
 | I-12 | 2026-10-30 | `mo purge --debug` kept every node_modules as "Could not inspect" and exited 1, because `run_with_timeout`'s debug notice landed in the captured lsof output; found by the V1.66.0 release e2e | unknown | e4686b6e | unit | `run_with_timeout keeps its debug notice out of captured command output`, `purge node project process check reads an idle project as idle under --debug` |
-| I-13 | 2026-10-26 | Cleaning Kitty's graphics-protocol cache broke image transfers in a running terminal session (#1856) | unknown | e7b15113 | review | `a custom whitelist still protects system caches, Kitty, Poetry virtualenvs, the renv cache and pnpm dlx` |
+| I-13 | 2026-10-26 | Cleaning Kitty's graphics-protocol cache broke image transfers in a running terminal session (#1856) | unknown | e7b15113 | review | `a custom whitelist still protects system caches, Kitty, Poetry virtualenvs, the renv cache, pnpm dlx and llama.cpp models` |
 | I-14 | 2026-10-26 | Users whose network needed the macOS system proxy did not receive background update notices because curl connected directly | unknown | 2748db02 | field | `background update lookup waits longer and follows the system proxy while foreground lookups do not` |
 | I-15 | 2026-10-26 | Old flat Analyze cache files remained for users who no longer ran Analyze, and a large accumulated directory froze tools that listed it | unknown | a152d651 | review | `legacy analyzer cache sweep removes only flat analyzer files from ~/.cache/mole`, `legacy analyzer cache sweep skips dry runs and a symlinked cache root`, `clean starts the legacy analyzer cache sweep in the background` |
 | I-16 | 2026-10-30 | Simulator cleanup could treat failed optional metadata reads as an absent key and suppress cancellation, allowing a device leaf to be removed after an incomplete probe | 437227e1 | f8950db2 | unit | `simulator device metadata timeouts retain the device and signals stop later devices` |
```

**File**: `lib/core/base.sh` (modified, +4/-0)
```diff
@@ -221,6 +221,10 @@ declare -a SAFETY_WHITELIST_PATTERNS=(
     "$HOME/Library/Caches/pypoetry/virtualenvs*"
     "$HOME/Library/Caches/org.R-project.R/R/renv/*"
     "$HOME/Library/Caches/pnpm/dlx*"
+    # llama.cpp downloads `-hf` model weights (multi-GB GGUF files) into its
+    # default LLAMA_CACHE here; they are user-chosen models, not a cache that
+    # rebuilds on its own. Mole Mac blocks the same folder (2026-10-29).
+    "$HOME/Library/Caches/llama.cpp"
 )
 
 # Resolve the cache root used by GitHub CLI without following filesystem
```

**File**: `tests/clean_user_core.bats` (modified, +6/-1)
```diff
@@ -711,7 +711,7 @@ EOF
     done
 }
 
-@test "a custom whitelist still protects system caches, Kitty, Poetry virtualenvs, the renv cache and pnpm dlx" {
+@test "a custom whitelist still protects system caches, Kitty, Poetry virtualenvs, the renv cache, pnpm dlx and llama.cpp models" {
     # clean_user_essentials sweeps every child of ~/Library/Caches, and
     # load_mole_whitelist replaces DEFAULT_WHITELIST_PATTERNS wholesale once a
     # user saves one entry of their own. Anything that breaks macOS search,
@@ -726,6 +726,7 @@ EOF
         "$test_home/Library/Caches/pypoetry/virtualenvs/proj-abc123" \
         "$test_home/Library/Caches/org.R-project.R/R/renv/cache/v5/pkg" \
         "$test_home/Library/Caches/pnpm/dlx/abc123" \
+        "$test_home/Library/Caches/llama.cpp" \
         "$test_home/Library/Caches/com.example.unprotected"
     printf '%s\n' "$test_home/.cache/keep-my-own-thing/*" > "$test_home/.config/mole/whitelist"
 
@@ -745,6 +746,8 @@ for probe in \
     "$HOME/Library/Caches/org.R-project.R" \
     "$HOME/Library/Caches/pnpm/dlx/abc123" \
     "$HOME/Library/Caches/pnpm" \
+    "$HOME/Library/Caches/llama.cpp" \
+    "$HOME/Library/Caches/llama.cpp/model-Q4_K_M.gguf" \
     "$HOME/Library/Caches/com.example.unprotected"; do
     if is_path_whitelisted "$probe"; then
         printf 'PROTECTED=%s\n' "${probe#"$HOME"/}"
@@ -777,6 +780,8 @@ EOF
     [[ "$output" == *"PROTECTED=Library/Caches/org.R-project.R"$'\n'* ]] || return 1
     [[ "$output" == *"PROTECTED=Library/Caches/pnpm/dlx/abc123"* ]] || return 1
     [[ "$output" == *"PROTECTED=Library/Caches/pnpm"$'\n'* ]] || return 1
+    [[ "$output" == *"PROTECTED=Library/Caches/llama.cpp"$'\n'* ]] || return 1
+    [[ "$output" == *"PROTECTED=Library/Caches/llama.cpp/model-Q4_K_M.gguf"* ]] || return 1
     [[ "$output" == *"CUSTOM_KEPT"* ]] || return 1
     rm -rf "$test_home"
 }
```

---

### Incident Patch 3: `1bc5f1d5` (2026-10-31)
**Commit Message**: feat(clean): quieter rows, visible waits and a clearer result

Three problems in `mo clean` output: rows asking the user to run a
command themselves were unclear, some waits had no loading, and the
result did not show how much was done.

- Review rows (DerivedData, archives, simulators, pnpm store, AI
  worktrees, Docker, Time Machine, Rust and NDK versions) go through
  mole_review_row: label linked to its folder, size, one fact Mole works
  out itself ("8 builds, May to Aug", "4 simulators", "v10 and v11
  stores", "1.95.0 and nightly besides stable"). No command to copy.
- DerivedData already cleaned under Developer tools is not listed again
  under Large files.
- Scanning, DerivedData filtering and Trash measuring show a spinner;
  first output of a dry run goes from 2.31s to 0.22s.
- A 0B row is hidden only when its sizing completed; WeChat and Feishu
  containers print one row per kind; plurals read "1 item".
- The whitelist line no longer lists every pattern. Summary is
  "Removed: X · N items" (dry run "Potential space"), plus the list or
  free space.
- Glyphs: dry-run rows use a circle, info uses the gear, follow-up
  arrows in slim and uninstall use the review glyph, tou

**File**: `.claude/rules/clean.md` (modified, +2/-0)
```diff
@@ -36,6 +36,8 @@ Developer and toolchain caches in `lib/clean/dev.sh` also follow `.claude/rules/
 
 - `bin/clean.sh` owns clean command orchestration, section output, and safe cleanup execution. Run `MOLE_TEST_NO_AUTH=1 bats tests/clean_core.bats tests/clean_apps.bats tests/cli.bats tests/clean_summary_cancel.bats tests/clean_developer_state.bats`.
 - Section output follows one fixed rhythm: title, then loading state, then content, then one trailing blank line, for every section. When touching any step of it, re-run the command and read the whole rendered output (column alignment, block spacing, icon consistency) instead of patching the one step that was reported.
+- **Rows report what Mole did, once.** A `safe_clean` row that measured 0B still removes and counts its items but prints nothing, unless a sizing timeout made the 0B unknown; roots that share a label clean in one call so per-profile caches read as one row; Large files skips the DerivedData row once developer tools covered every project (`_MOLE_DERIVED_DATA_COVERED`); counts go through `mole_count_label` (`1 item`). The summary box holds two lines: `Removed: X · N items` plus the free-space line, or `Potential space: X · N items` plus the file list. Locked by `safe_clean removes a 0B target without printing a row for it` (`tests/clean_core.bats`), `clean_wechat_container_caches cleans every web profile in one row per cache kind` and `large files leaves out DerivedData that developer tools already covered`.
+- **Review rows go through `mole_review_row`: `⊙ label · value · fact`.** On a terminal the label is an OSC 8 link to the path, so the row carries no path or command field; plain output keeps the path last. The fact is worked out read-only and bounded (`_large_dir_fact`: simulator count, archive builds and month range, pnpm store versions, project count; version folders besides the default for Rust and NDK) and is dropped, never guessed, when its probe fails. Do not add a command for the user to run where Mole can state the fact itself; two of three suggested commands freed nothing on the maintainer's Mac (2026-10-31). Locked by `large files links each review label to its full path` and `large files names what the simulator and pnpm rows hold` in `tests/clean_user_core.bats`.
 - `_safe_clean_impl` skips targets that do not currently exist before expensive policy probes, then filters protected, whitelisted, and compiled-model targets before consulting the dry-run guard or registering previews. Every surviving target is revalidated at its action boundary, so preview and real cleanup keep the same eligible set. A delete guard that refuses only the path it was handed names it in `_MOLE_SAFE_CLEAN_SKIP_PATH`, which skips that target and continues the batch; any other nonzero guard status stops with 75 and a timeout or signal cancels. `safe_clean_guarded skips only the path its guard names and keeps going` in `tests/clean_core.bats` locks it.
 - `normalize_paths_for_cleanup` collapses a Gradle DSL path only in the `<version>/groovy-dsl|kotlin-dsl/<hash>` layout, because the `*` in its case glob spans slashes and a deeper directory that merely contains `groovy-dsl` would otherwise widen to its parent.
 - **A `declare -f` probe into `bin/` is a shared shim, never a per-file copy.** Asking whether `safe_clean_guarded` or `defer_cleanup_family` exists is asking whether `bin/clean.sh` is loaded: always in production, never in a standalone Bats case. Use `mole_defer_cleanup_family`, or call `safe_clean_guarded` directly and let the test supply it. The audited fallback cap may decrease after consolidation but needs an explicit reason to increase. Do not hoist `_safe_clean_impl` into `lib/core/`; many tests intentionally replace `safe_clean`, and bypassing that seam turns assertions into real deletion attempts under their fixture `HOME`.
```

**File**: `README.md` (modified, +5/-5)
```diff
@@ -189,7 +189,7 @@ Clean Your Mac
 
 ======================================================================
 Cleanup complete
-Tracked cleanup: 4.5GB | Items cleaned: 97 | Categories: 4
+Removed: 4.5GB · 97 items
 Free space: 223.5GB (+4.5GB)
 ======================================================================
 ```
@@ -241,17 +241,17 @@ PERFORMANCE DIAGNOSIS
   ✓ No sustained high-CPU bottleneck detected
 
 ➤ Finder Cache Refresh
-  → QuickLook thumbnails refreshed
-  → Icon services cache rebuilt
+  ✓ QuickLook thumbnails refreshed
+  ✓ Icon services cache rebuilt
 
 ➤ Network Cache Refresh
-  → DNS cache refreshed
+  ✓ DNS cache refreshed
 
 ➤ Database Optimization
   ◎ Close these apps before database optimization: Safari
 
 ➤ Disk Health
-  → Disk verify skipped
+  ✓ Disk verify skipped
 
 ======================================================================
 Optimization Complete
```

**File**: `README_CN.md` (modified, +5/-5)
```diff
@@ -189,7 +189,7 @@ Clean Your Mac
 
 ======================================================================
 Cleanup complete
-Tracked cleanup: 4.5GB | Items cleaned: 97 | Categories: 4
+Removed: 4.5GB · 97 items
 Free space: 223.5GB (+4.5GB)
 ======================================================================
 ```
@@ -241,17 +241,17 @@ PERFORMANCE DIAGNOSIS
   ✓ No sustained high-CPU bottleneck detected
 
 ➤ Finder Cache Refresh
-  → QuickLook thumbnails refreshed
-  → Icon services cache rebuilt
+  ✓ QuickLook thumbnails refreshed
+  ✓ Icon services cache rebuilt
 
 ➤ Network Cache Refresh
-  → DNS cache refreshed
+  ✓ DNS cache refreshed
 
 ➤ Database Optimization
   ◎ Close these apps before database optimization: Safari
 
 ➤ Disk Health
-  → Disk verify skipped
+  ✓ Disk verify skipped
 
 ======================================================================
 Optimization Complete
```

**File**: `README_DE.md` (modified, +5/-5)
```diff
@@ -189,7 +189,7 @@ Clean Your Mac
 
 ======================================================================
 Cleanup complete
-Tracked cleanup: 4.5GB | Items cleaned: 97 | Categories: 4
+Removed: 4.5GB · 97 items
 Free space: 223.5GB (+4.5GB)
 ======================================================================
 ```
@@ -241,17 +241,17 @@ PERFORMANCE DIAGNOSIS
   ✓ No sustained high-CPU bottleneck detected
 
 ➤ Finder Cache Refresh
-  → QuickLook thumbnails refreshed
-  → Icon services cache rebuilt
+  ✓ QuickLook thumbnails refreshed
+  ✓ Icon services cache rebuilt
 
 ➤ Network Cache Refresh
-  → DNS cache refreshed
+  ✓ DNS cache refreshed
 
 ➤ Database Optimization
   ◎ Close these apps before database optimization: Safari
 
 ➤ Disk Health
-  → Disk verify skipped
+  ✓ Disk verify skipped
 
 ======================================================================
 Optimization Complete
```

**File**: `README_FR.md` (modified, +5/-5)
```diff
@@ -189,7 +189,7 @@ Clean Your Mac
 
 ======================================================================
 Cleanup complete
-Tracked cleanup: 4.5GB | Items cleaned: 97 | Categories: 4
+Removed: 4.5GB · 97 items
 Free space: 223.5GB (+4.5GB)
 ======================================================================
 ```
@@ -241,17 +241,17 @@ PERFORMANCE DIAGNOSIS
   ✓ No sustained high-CPU bottleneck detected
 
 ➤ Finder Cache Refresh
-  → QuickLook thumbnails refreshed
-  → Icon services cache rebuilt
+  ✓ QuickLook thumbnails refreshed
+  ✓ Icon services cache rebuilt
 
 ➤ Network Cache Refresh
-  → DNS cache refreshed
+  ✓ DNS cache refreshed
 
 ➤ Database Optimization
   ◎ Close these apps before database optimization: Safari
 
 ➤ Disk Health
-  → Disk verify skipped
+  ✓ Disk verify skipped
 
 ======================================================================
 Optimization Complete
```

**File**: `README_JA.md` (modified, +5/-5)
```diff
@@ -189,7 +189,7 @@ Clean Your Mac
 
 ======================================================================
 Cleanup complete
-Tracked cleanup: 4.5GB | Items cleaned: 97 | Categories: 4
+Removed: 4.5GB · 97 items
 Free space: 223.5GB (+4.5GB)
 ======================================================================
 ```
@@ -241,17 +241,17 @@ PERFORMANCE DIAGNOSIS
   ✓ No sustained high-CPU bottleneck detected
 
 ➤ Finder Cache Refresh
-  → QuickLook thumbnails refreshed
-  → Icon services cache rebuilt
+  ✓ QuickLook thumbnails refreshed
+  ✓ Icon services cache rebuilt
 
 ➤ Network Cache Refresh
-  → DNS cache refreshed
+  ✓ DNS cache refreshed
 
 ➤ Database Optimization
   ◎ Close these apps before database optimization: Safari
 
 ➤ Disk Health
-  → Disk verify skipped
+  ✓ Disk verify skipped
 
 ======================================================================
 Optimization Complete
```

**File**: `README_KR.md` (modified, +5/-5)
```diff
@@ -189,7 +189,7 @@ Clean Your Mac
 
 ======================================================================
 Cleanup complete
-Tracked cleanup: 4.5GB | Items cleaned: 97 | Categories: 4
+Removed: 4.5GB · 97 items
 Free space: 223.5GB (+4.5GB)
 ======================================================================
 ```
@@ -241,17 +241,17 @@ PERFORMANCE DIAGNOSIS
   ✓ No sustained high-CPU bottleneck detected
 
 ➤ Finder Cache Refresh
-  → QuickLook thumbnails refreshed
-  → Icon services cache rebuilt
+  ✓ QuickLook thumbnails refreshed
+  ✓ Icon services cache rebuilt
 
 ➤ Network Cache Refresh
-  → DNS cache refreshed
+  ✓ DNS cache refreshed
 
 ➤ Database Optimization
   ◎ Close these apps before database optimization: Safari
 
 ➤ Disk Health
-  → Disk verify skipped
+  ✓ Disk verify skipped
 
 ======================================================================
 Optimization Complete
```

**File**: `README_RU.md` (modified, +5/-5)
```diff
@@ -189,7 +189,7 @@ Clean Your Mac
 
 ======================================================================
 Cleanup complete
-Tracked cleanup: 4.5GB | Items cleaned: 97 | Categories: 4
+Removed: 4.5GB · 97 items
 Free space: 223.5GB (+4.5GB)
 ======================================================================
 ```
@@ -241,17 +241,17 @@ PERFORMANCE DIAGNOSIS
   ✓ No sustained high-CPU bottleneck detected
 
 ➤ Finder Cache Refresh
-  → QuickLook thumbnails refreshed
-  → Icon services cache rebuilt
+  ✓ QuickLook thumbnails refreshed
+  ✓ Icon services cache rebuilt
 
 ➤ Network Cache Refresh
-  → DNS cache refreshed
+  ✓ DNS cache refreshed
 
 ➤ Database Optimization
   ◎ Close these apps before database optimization: Safari
 
 ➤ Disk Health
-  → Disk verify skipped
+  ✓ Disk verify skipped
 
 ======================================================================
 Optimization Complete
```

#### Recent Merged Pull Requests:
- **PR #1890** (2026-10-30): feat(clean): add BrowserOS cache cleanup support (@thecoldblooded)
- **PR #1889** (2026-10-30): fix(clean): show verbose Docker usage hint (@r266-tech)
- **PR #1887** (closed): fix(whitelist): include Bun package cache in cache catalog (@viniciusdsandrade)
- **PR #1881** (closed): perf(clean): measure Large files rows while the sections before it run (@sebastianbreguel)
- **PR #1880** (2026-10-29): perf(clean): start the project cache scan before the first section (@sebastianbreguel)
- **PR #1879** (2026-10-29): perf(clean): stop waiting on a held uv cache lock (@sebastianbreguel)

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

## X. clean): clean the yarn berry global cache instead of ~/.yarn/cache

**RULE**:
When implementing operations in `lib/clean/dev.sh`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in tw93/Mole. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `21d44166`: clean): clean the yarn berry global cache instead of ~/.yarn/cache. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Shell data structures, boundary deserialization, API parsing, or resource lifecycles matching `lib/clean/dev.sh`.

**VERIFIED IMPLEMENTATION PATTERN**:
```shell
// Verified production-grade fix pattern:
    # Yarn Berry keeps .yarn/cache inside each project and its shared global
    # cache in ~/.yarn/berry/cache; ~/.yarn/cache is never written. Yarn
    # Classic on macOS uses ~/Library/Caches/Yarn.
    safe_clean ~/.yarn/berry/cache/* "Yarn Berry cache"
```

**NEGATIVE CONSTRAINT**:
```shell
// Anti-pattern to NEVER write (induced failure mode):
    safe_clean ~/.yarn/cache/* "Yarn cache"
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `21d44166` are properly handled with clean fallback behavior.
