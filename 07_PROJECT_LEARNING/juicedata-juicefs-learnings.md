# Forensic Learning Record (Deep Inspection): juicedata/juicefs

> **Canonical Artifact**: `07_PROJECT_LEARNING/juicedata-juicefs-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/juicedata/juicefs](https://github.com/juicedata/juicefs))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:29:24.409Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `juicedata/juicefs`
- **Description**: JuiceFS is a distributed POSIX file system built on top of Redis and S3.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: package.json, go.mod, README.md
- **Stars / Engagement**: 14497 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `pkg/chunk/disk_cache_state.go`
```
/*
 * JuiceFS, Copyright 2024 Juicedata, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package chunk

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"sync/atomic"
	"time"
)

var (
	numIOErrToUnstable         uint32  = 3                // from normal to unstable
	minIOSuccToNormal          uint32  = 60               // from unstable to normal
	maxIOErrPercentageToNormal float64 = 0                // from unstable to normal
	maxDurToDown                       = 30 * time.Minute // from unstable to down
	maxConcurrencyForUnstable  int64   = 10
	tickDurForNormal                   = 1 * time.Minute
	tickDurForUnstable                 = 1 * time.Minute

	probeDur  = 500 * time.Millisecond
	probeDir  = "probe"
	probeData = []byte{1, 2, 3}
	probeBuff = make([]byte, 3)
)

var (
	errCacheDown       = errors.New("cache down")
	errUnstableCoLimit = fmt.Errorf("exceed concurrency %d limit for unstable disk cache", maxConcurrencyForUnstable)
)

var diskStateNames = map[int]string{
	dcUnknown:   "unknown",
	dcNormal:    "normal",
	dcUnstable:  "unstable",
	dcDown:      "down",
	dcUnchanged: "unchanged",
}

const (
	dcUnknown = iota
	dcNormal
	dcUnstable
	dcDown
	dcUnchanged
)

const (
	eventUnknown = iota
	eventToNormal
	eventToUnstable
	eventToDown
)

// dcState disk cache state
type dcState interface {
	init(cs *diskCache)
	tick()
	stop()
	state() int
	checkCacheOp() error
	beforeCacheOp()
	afterCacheOp()
	onIOErr()
	onIOSucc()
}

type baseDC struct {
	cache  *diskCache
	stopCh chan struct{}
}

func newDCState(state int, cs *diskCache) dcState {
	var s dcState
	switch state {
	case dcNormal:
		s = &normalDC{}
	case dcUnstable:
		s = &unstableDC{}
	case dcDown:
		s = &downDC{}
	case dcUnchanged:
		s = &unchangedDC{}
	}
	s.init(cs)
	s.tick()
	return s
}

func (dc *baseDC) init(cs *diskCache) {
	dc.cache = cs
	dc.stopCh = make(chan struct{})
}

func (dc *baseDC) stop() {
	close(dc.stopCh)
}
func (dc *baseDC) onIOErr()            {}
func (dc *baseDC) onIOSucc()           {}
func (dc *baseDC) state() int          { return dcUnknown }
func (dc *baseDC) tick()               {}
func (dc *baseDC) checkCacheOp() error { return nil }
func (dc *baseDC) beforeCacheOp()      {}
func (dc *baseDC) afterCacheOp()       {}

type unchangedDC struct {
	baseDC
}

func (dc *unchangedDC) state() int { return dcUnchanged }

type normalDC struct {
	baseDC
	ioErrCnt uint32
}

func (dc *normalDC) state() int { return dcNormal }

func (dc *normalDC) init(cs *diskCache) {
	dc.baseDC.init(cs)
	_ = os.RemoveAll(dc.cache.cachePath(probeDir))
}

func (dc *normalDC) tick() {
	go func() {
		for {
			select {
			case <-dc.stopCh:
				return
			case <-time.After(tickDurForNormal):
				atomic.StoreUint32(&dc.ioErrCnt, 0)
			}
		}
	}()
}

func (dc *normalDC) onIOErr() {
	cnt := atomic.AddUint32(&dc.ioErrCnt, 1)
	if cnt >= uint32(numIOErrToUnstable) {
		dc.cache.event(eventToUnstable)
	}
}

type unstableDC struct {
	baseDC
	startTime time.Time
	ioErrCnt  uint32
	ioCnt     uint32

	concurrency atomic.Int64
}

func (dc *unstableDC) state() int { return dcUnstable }

func (dc *unstableDC) init(cs *diskCache) {
	dc.baseDC.init(cs)
	dc.startTime = time.Now()
}

func (dc *unstableDC) onIOErr() {
	atomic.AddUint32(&dc.ioCnt, 1)
	atomic.AddUint32(&dc.ioErrCnt, 1)
}

func (dc *unstableDC) onIOSucc() {
	atomic.AddUint32(&dc.ioCnt, 1)
}

func probeCacheKey(id, size int) string {
	return fmt.Sprintf("%s/%02X/%v/%v_%v_%v", probeDir, id%256, id/1000/1000, id, 0, size)
}

func (dc *unstableDC) tick() {
	go dc.probe()
	go func() {
		ticker := time.NewTicker(tickDurForUnstable)
		defer ticker.Stop()

		for {
			select {
			case <-dc.stopCh:
				return
			case <-ticker.C:
				errCnt, ioCnt := atomic.LoadUint32(&dc.ioErrCnt), atomic.LoadUint32(&dc.ioCnt)
				if ioCnt >= minIOSuccToNormal && float64(errCnt)/float64(ioCnt) <= maxIOErrPercentageToNormal {
					dc.cache.event(eventToNormal)
				} else if time.Since(dc.startTime) >= maxDurToDown {
					dc.cache.event(eventToDown)
				} else {
					atomic.StoreUint32(&dc.ioErrCnt, 0)
					atomic.StoreUint32(&dc.ioCnt, 0)
				}
			}
		}
	}()
}

func (dc *unstableDC) probe() {
	page := NewPage(probeData)
	defer page.Release()
	cnt := 0

	for {
		select {
		case <-dc.stopCh:
			return
		default:
			cnt++
			start := time.Now()
			dc.doProbe(probeCacheKey(cnt, len(probeData)), page)
			diff := probeDur - time.Since(start)
			if diff > 0 {
				time.Sleep(diff)
			}
		}
	}
}

func (dc *unstableDC) doProbe(key string, page *Page) {
	dc.cache.cache(key, page, true, false)
	reader, err := dc.cache.load(key)
	if err != nil {
		return
	}
	defer reader.Close()
	_, _ = reader.ReadAt(probeBuff, 0)
	dc.cache.remove(key, false)
}

func (dc *unstableDC) beforeCacheOp() { dc.concurrency.Add(1) }
func (dc *unstableDC) afterCacheOp()  { dc.concurrency.Add(-1) }

func (dc *unstableDC) checkCacheOp() error {
	if dc.concurrency.Load() >= maxConcurrencyForUnstable {
		return errUnstableCoLimit
	}
	return nil
}

type downDC struct {
	baseDC
}

func (dc *downDC) state() int          { return dcDown }
func (dc *downDC) checkCacheOp() error { return errCacheDown }

func (cache *diskCache) event(eventType int) {
	cache.stateLock.Lock()
	defer cache.stateLock.Unlock()
	state := cache.state.state()
	switch state {
	case dcNormal:
		if eventType == eventToUnstable {
			cache.state.stop()
			cache.state = newDCState(dcUnstable, cache)
		}
	case dcUnstable:
		switch eventType {
		case eventToNormal:
			cache.state.stop()
			cache.state = newDCState(dcNormal, cache)
		case eventToDown:
			cache.state.stop()
			cache.state = newDCState(dcDown, cache)
		}
	}
	logger.Infof("disk cache %s state change from %s to %s", cache.dir, diskStateNames[state], diskStateNames[cache.state.state()])
}

func getEnvs() {
	if os.Getenv("JFS_MAX_IO_DURATION") != "" {
		dur, err := time.ParseDuration(os.Getenv("JFS_MAX_IO_DURATION"))
		if err != nil {
			logger.Errorf("parse JFS_MAX_IO_DURATION error: %v", err)
		} else {
			maxIODur = dur
		}
		logger.Infof("set maxIODur to %v", maxIODur)
	}
	if os.Getenv("JFS_MAX_IO_ERR_PERCENTAGE") != "" {
		percentage, err := strconv.ParseFloat(os.Getenv("JFS_MAX_IO_ERR_PERCENTAGE"), 64)
		if err != nil {
			logger.Errorf("parse JFS_MAX_IO_ERR_PERCENTAGE error: %v", err)
		} else {
			maxIOErrPercentageToNormal = percentage
		}
		logger.Infof("set maxIOErrPercentageToNormal to %f", maxIOErrPercentageToNormal)
	}
	if os.Getenv("JFS_MAX_DURATION_TO_DOWN") != "" {
		dur, err := time.ParseDuration(os.Getenv("JFS_MAX_DURATION_TO_DOWN"))
		if err != nil {
			logger.Errorf("parse JFS_MAX_DURATION_TO_DOWN error: %v", err)
		} else {
			maxDurToDown = dur
		}
		logger.Infof("set maxDurToDown to %v", maxDurToDown)
	}
	if os.Getenv("JFS_MAX_CONCURRENCY_FOR_UNSTABLE") != "" {
		co, err := strconv.ParseInt(os.Getenv("JFS_MAX_CONCURRENCY_FOR_UNSTABLE"), 10, 64)
		if err != nil {
			logger.Errorf("parse JFS_MAX_CONCURRENCY_FOR_UNSTABLE error: %v", err)
		} else {
			maxConcurrencyForUnstable = co
		}
		logger.Infof("set maxConcurrencyForUnstable to %d", maxConcurrencyForUnstable)
	}
}

```

### Core Architecture Module: `pkg/chunk/utils_darwin.go`
```
/*
 * JuiceFS, Copyright 2020 Juicedata, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package chunk

import (
	"os"
	"syscall"
	"time"
)

func getAtime(fi os.FileInfo) time.Time {
	if sst, ok := fi.Sys().(*syscall.Stat_t); ok {
		return time.Unix(sst.Atimespec.Unix())
	} else {
		return fi.ModTime()
	}
}

func dropOSCache(r ReadCloser) {}

```

### Core Architecture Module: `pkg/chunk/utils_linux.go`
```
/*
 * JuiceFS, Copyright 2020 Juicedata, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package chunk

import (
	"os"
	"syscall"
	"time"

	"golang.org/x/sys/unix"
)

func getAtime(fi os.FileInfo) time.Time {
	if sst, ok := fi.Sys().(*syscall.Stat_t); ok {
		return time.Unix(sst.Atim.Unix())
	}
	return fi.ModTime()
}

func dropOSCache(r ReadCloser) {
	if cf, ok := r.(*cacheFile); ok {
		_ = unix.Fadvise(int(cf.Fd()), 0, 0, unix.FADV_DONTNEED)
	} else if f, ok := r.(*os.File); ok {
		_ = unix.Fadvise(int(f.Fd()), 0, 0, unix.FADV_DONTNEED)
	}
}

```

### Core Architecture Module: `pkg/chunk/utils_unix.go`
```
//go:build !windows
// +build !windows

/*
 * JuiceFS, Copyright 2020 Juicedata, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package chunk

import (
	"os"
	"syscall"
)

func getNlink(fi os.FileInfo) int {
	if sst, ok := fi.Sys().(*syscall.Stat_t); ok {
		return int(sst.Nlink)
	}
	return 1
}

func getDiskUsage(path string) (uint64, uint64, uint64, uint64) {
	var stat syscall.Statfs_t
	if err := syscall.Statfs(path, &stat); err == nil {
		return stat.Blocks * uint64(stat.Bsize), stat.Bavail * uint64(stat.Bsize), stat.Files, stat.Ffree
	} else {
		logger.Warnf("statfs %s: %s", path, err)
		return 1, 1, 1, 1
	}
}

func changeMode(dir string, st os.FileInfo, mode os.FileMode) {
	sst := st.Sys().(*syscall.Stat_t)
	if os.Getuid() == int(sst.Uid) {
		_ = os.Chmod(dir, mode)
	}
}

func inRootVolume(dir string) bool {
	dstat, err := os.Stat(dir)
	if err != nil {
		logger.Warnf("stat `%s`: %s", dir, err.Error())
		return false
	}
	rstat, err := os.Stat("/")
	if err != nil {
		logger.Warnf("stat `/`: %s", err.Error())
		return false
	}
	return dstat.Sys().(*syscall.Stat_t).Dev == rstat.Sys().(*syscall.Stat_t).Dev
}

```

### Core Architecture Module: `pkg/chunk/utils_windows.go`
```
/*
 * JuiceFS, Copyright 2020 Juicedata, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package chunk

import (
	"os"
	"syscall"
	"time"

	sys "golang.org/x/sys/windows"
)

func getAtime(fi os.FileInfo) time.Time {
	stat, ok := fi.Sys().(*syscall.Win32FileAttributeData)
	if ok {
		return time.Unix(0, stat.LastAccessTime.Nanoseconds())
	} else {
		return time.Unix(0, 0)
	}
}

func dropOSCache(r ReadCloser) {}

func getNlink(fi os.FileInfo) int {
	return 1
}

func getDiskUsage(path string) (uint64, uint64, uint64, uint64) {
	var freeBytes, total, totalFree uint64
	err := sys.GetDiskFreeSpaceEx(sys.StringToUTF16Ptr(path), &freeBytes, &total, &totalFree)
	if err != nil {
		logger.Errorf("GetDiskFreeSpaceEx %s: %s", path, err.Error())
		return 1, 1, 1, 1
	}
	return total, freeBytes, 1, 1
}

func changeMode(dir string, st os.FileInfo, mode os.FileMode) {}

func inRootVolume(dir string) bool { return false }

```

### Core Architecture Module: `pkg/fuse/utils.go`
```
/*
 * JuiceFS, Copyright 2020 Juicedata, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package fuse

import (
	"github.com/juicedata/juicefs/pkg/meta"

	"github.com/hanwen/go-fuse/v2/fuse"
)

func attrToStat(inode Ino, attr *Attr, out *fuse.Attr) {
	out.Ino = uint64(inode)
	out.Uid = attr.Uid
	out.Gid = attr.Gid
	out.Mode = attr.SMode()
	out.Nlink = attr.Nlink
	out.Atime = uint64(attr.Atime)
	out.Atimensec = attr.Atimensec
	out.Mtime = uint64(attr.Mtime)
	out.Mtimensec = attr.Mtimensec
	out.Ctime = uint64(attr.Ctime)
	out.Ctimensec = attr.Ctimensec

	var size, blocks uint64
	switch attr.Typ {
	case meta.TypeDirectory:
		fallthrough
	case meta.TypeSymlink:
		fallthrough
	case meta.TypeFile:
		size = attr.Length
		blocks = (size + 511) / 512
	case meta.TypeBlockDev:
		fallthrough
	case meta.TypeCharDev:
		out.Rdev = attr.Rdev
	}
	out.Size = size
	out.Blocks = blocks
	setBlksize(out, 0x10000)
}

```

### Core Architecture Module: `pkg/meta/utils.go`
```
/*
 * JuiceFS, Copyright 2021 Juicedata, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package meta

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"path"
	"runtime"
	"runtime/debug"
	"sort"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	"github.com/juicedata/juicefs/pkg/utils"
	"github.com/redis/go-redis/v9"
)

const (
	aclCounter      = "aclMaxId"
	usedSpace       = "usedSpace"
	totalInodes     = "totalInodes"
	legacySessions  = "sessions"
	krbTokenCounter = "krbTokenMaxId"
)

var counterNames = []string{usedSpace, totalInodes, "nextInode", "nextChunk", "nextSession", "nextTrash"}

const (
	// fallocate
	fallocKeepSize  = 0x01
	fallocPunchHole = 0x02
	// RESERVED: fallocNoHideStale   = 0x04
	fallocCollapesRange = 0x08
	fallocZeroRange     = 0x10
	fallocInsertRange   = 0x20
)
const (
	// clone mode
	CLONE_MODE_CAN_OVERWRITE      = 0x01
	CLONE_MODE_PRESERVE_ATTR      = 0x02
	CLONE_MODE_PRESERVE_HARDLINKS = 0x08

	// clone concurrency
	CLONE_DEFAULT_CONCURRENCY = 4

	// atime mode
	NoAtime     = "noatime"
	RelAtime    = "relatime"
	StrictAtime = "strictatime"
)

const (
	MODE_MASK_R = 0b100
	MODE_MASK_W = 0b010
	MODE_MASK_X = 0b001
)

type msgCallbacks struct {
	sync.Mutex
	callbacks map[uint32]MsgCallback
}

type freeID struct {
	next  uint64
	maxid uint64
}

var logger = utils.GetLogger("juicefs")

type queryMap struct {
	*url.Values
}

func (qm *queryMap) duration(key, originalKey string, d time.Duration) time.Duration {
	val := qm.Get(key)
	if val == "" {
		oVal := qm.Get(originalKey)
		if oVal == "" {
			return d
		}
		val = oVal
	}

	qm.Del(key)
	if dur, err := time.ParseDuration(val); err == nil {
		return dur
	} else {
		logger.Warnf("Parse duration %s for key %s: %s", val, key, err)
		return d
	}
}

func (qm *queryMap) getInt(key, originalKey string, defaultValue int) int {
	val := qm.Get(key)
	if val == "" {
		oVal := qm.Get(originalKey)
		if oVal == "" {
			return defaultValue
		}
		val = oVal
	}

	qm.Del(key)
	if i, err := strconv.ParseInt(val, 10, 32); err == nil {
		return int(i)
	} else {
		logger.Warnf("Parse int %s for key %s: %s", val, key, err)
		return defaultValue
	}
}

func (qm *queryMap) pop(key string) string {
	defer qm.Del(key)
	return qm.Get(key)
}

func errno(err error) syscall.Errno {
	if err == nil {
		return 0
	}
	if errors.Is(err, context.Canceled) || strings.Contains(err.Error(), context.Canceled.Error()) { // TiKV stringifies context cancellation in some error paths
		return syscall.EINTR
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return syscall.ETIMEDOUT
	}
	if eno, ok := err.(syscall.Errno); ok {
		return eno
	}
	if err == redis.Nil {
		return syscall.ENOENT
	}
	if strings.HasPrefix(err.Error(), "OOM") {
		return syscall.ENOSPC
	}
	logger.Errorf("error: %s\n%s", err, debug.Stack())
	return syscall.EIO
}

func accessMode(attr *Attr, uid uint32, gids []uint32) uint8 {
	if uid == 0 {
		return 0x7
	}
	mode := attr.Mode
	if uid == attr.Uid {
		return uint8(mode>>6) & 7
	}
	for _, gid := range gids {
		if gid == attr.Gid {
			return uint8(mode>>3) & 7
		}
	}
	return uint8(mode & 7)
}

func align4K(length uint64) int64 {
	if length == 0 {
		return 1 << 12
	}
	return int64((((length - 1) >> 12) + 1) << 12)
}

type plockRecord struct {
	Type  uint32
	Pid   uint32
	Start uint64
	End   uint64
}

type ownerKey struct {
	Sid   uint64
	Owner uint64
}

type PLockItem struct {
	ownerKey
	plockRecord
}

type FLockItem struct {
	ownerKey
	Type string
}

func parseOwnerKey(key string) (*ownerKey, error) {
	pair := strings.Split(key, "_")
	if len(pair) != 2 {
		return nil, fmt.Errorf("invalid owner key: %s", key)
	}
	sid, err := strconv.ParseUint(pair[0], 10, 64)
	if err != nil {
		return nil, err
	}
	owner, err := strconv.ParseUint(pair[1], 16, 64)
	if err != nil {
		return nil, err
	}
	return &ownerKey{sid, owner}, nil
}

func loadLocks(d []byte) []plockRecord {
	var ls []plockRecord
	rb := utils.FromBuffer(d)
	for rb.HasMore() {
		ls = append(ls, plockRecord{rb.Get32(), rb.Get32(), rb.Get64(), rb.Get64()})
	}
	return ls
}

func dumpLocks(ls []plockRecord) []byte {
	wb := utils.NewBuffer(uint32(len(ls)) * 24)
	for _, l := range ls {
		wb.Put32(l.Type)
		wb.Put32(l.Pid)
		wb.Put64(l.Start)
		wb.Put64(l.End)
	}
	return wb.Bytes()
}

func updateLocks(ls []plockRecord, nl plockRecord) []plockRecord {
	// ls is ordered by l.start without overlap
	size := len(ls)
	for i := 0; i < size && nl.Start <= nl.End; i++ {
		l := ls[i]
		if nl.Start < l.Start && nl.End >= l.Start {
			// split nl
			ls = append(ls, nl)
			ls[len(ls)-1].End = l.Start - 1
			nl.Start = l.Start
		}
		if nl.Start > l.Start && nl.Start <= l.End {
			// split l
			l.End = nl.Start - 1
			ls = append(ls, l)
			ls[i].Start = nl.Start
			l = ls[i]
		}
		if nl.Start == l.Start {
			ls[i].Type = nl.Type // update l
			ls[i].Pid = nl.Pid
			if l.End > nl.End {
				// split l
				ls[i].End = nl.End
				l.Start = nl.End + 1
				ls = append(ls, l)
			}
			nl.Start = ls[i].End + 1
		}
	}
	if nl.Start <= nl.End {
		ls = append(ls, nl)
	}
	sort.Slice(ls, func(i, j int) bool { return ls[i].Start < ls[j].Start })
	for i := 0; i < len(ls); {
		if ls[i].Type == F_UNLCK || ls[i].Start > ls[i].End {
			// remove empty one
			copy(ls[i:], ls[i+1:])
			ls = ls[:len(ls)-1]
		} else {
			if i+1 < len(ls) && ls[i].Type == ls[i+1].Type && ls[i].Pid == ls[i+1].Pid && ls[i].End+1 == ls[i+1].Start {
				// combine continuous range
				ls[i].End = ls[i+1].End
				ls[i+1].Start = ls[i+1].End + 1
			}
			i++
		}
	}
	return ls
}

func (m *baseMeta) emptyDir(ctx Context, inode Ino, skipCheckTrash bool, count *uint64, concurrent chan int) syscall.Errno {
	for {
		var entries []*Entry
		if st := m.en.doReaddir(ctx, inode, 0, &entries, 10000); st != 0 && st != syscall.ENOENT {
			return st
		}
		if len(entries) == 0 {
			return 0
		}
		if st := m.Access(ctx, inode, MODE_MASK_W|MODE_MASK_X, nil); st != 0 {
			return st
		}
		var wg sync.WaitGroup
		var statusOnce sync.Once
		var status syscall.Errno
		var nonDirEntries []*Entry
		for i, e := range entries {
			if e.Attr.Typ == TypeDirectory {
				select {
				case concurrent <- 1:
					wg.Add(1)
					go func(child Ino, name string) {
						defer wg.Done()
						st := m.emptyEntry(ctx, inode, name, child, skipCheckTrash, count, concurrent)
						if st != 0 && st != syscall.ENOENT {
							statusOnce.Do(func() { status = st })
						}
						<-concurrent
					}(e.Inode, string(e.Name))
				default:
					if st := m.emptyEntry(ctx, inode, string(e.Name), e.Inode, skipCheckTrash, count, concurrent); st != 0 && st != syscall.ENOENT {
						ctx.Cancel()
						wg.Wait()
						return st
					}
				}
			} else {
				nonDirEntries = append(nonDirEntries, e)
			}
			if ctx.Canceled() {
				wg.Wait()
				return syscall.EINTR
			}
			entries[i] = nil // release memory
		}
		wg.Wait()

		if status == 0 {
			status = m.BatchUnlink(ctx, inode, nonDirEntries, count, skipCheckTrash)
		}

		if status != 0 || inode == TrashInode { // try only once for .trash
			return status
		}
	}
}

func (m *baseMeta) emptyEntry(ctx Context, parent Ino, name string, inode Ino, skipCheckTrash bool, count *uint64, concurrent chan int) syscall.Errno {
	if ctx.Canceled() {
		return syscall.EINTR
	}
	st := m.emptyDir(ctx, inode, skipCheckTrash, count, concurrent)
	if st == 0 && !inode.IsTrash() {
		st = m.Rmdir(ctx, parent, name, skipCheckTrash)
		if st == syscall.ENOTEMPTY {
			// redo when concurrent conflict may happen
			st = m.emptyEntry(ctx, parent, name, inode, skipCheckTrash, count, concurrent)
		} else if count != nil {
			atomic.AddUint64(count, 1)
		}
	}
	return st
}

func (m *baseMeta) Remove(ctx Context, parent Ino, name string, skipTrash bool, numThreads int, count *uint64) syscall.Errno {
	parent = m.checkRoot(parent)
	if st := m.Access(ctx, parent, MODE_MASK_W|MODE_MASK_X, nil); st != 0 {
		return st
	}
	var inode Ino
	var attr Attr
	if st := m.Lookup(ctx, parent, name, &inode, &attr, false); st != 0 {
		return st
	}
	if attr.Typ != TypeDirectory {
		if count != nil {
			atomic.AddUint64(count, 1)
		}
		return m.Unlink(ctx, parent, name, skipTrash)
	}
	if numThreads <= 0 {
		logger.Infof("invalid threads number %d , auto adjust to %d", numThreads, RmrDefaultThreads)
		numThreads = RmrDefaultThreads
	} else if numThreads > 255 {
		logger.Infof("threads number %d too large, auto adjust to 255 .", numThreads)
		numThreads = 255
	}
	logger.Debugf("Start emptyEntry with %d concurrent threads .", numThreads)
	concurrent := make(chan int, numThreads)
	return m.emptyEntry(ctx, parent, name, inode, skipTrash, count, concurrent)
}

func (m *baseMeta) GetSummary(ctx Context, inode Ino, summary *Summary, recursive bool, strict bool) syscall.Errno {
	var attr Attr
	if st := m.GetAttr(ctx, inode, &attr); st != 0 {
		return st
	}
	if attr.Typ != TypeDirectory {
		summary.Files++
		summary.Size += uint64(align4K(attr.Length))
		if attr.Typ == TypeFile {
			summary.Length += attr.Length
		}
		return 0
	}
	summary.Dirs++
	summary.Size += uint64(align4K(0))
	concurrent := make(chan struct{}, 50)
	inode = m.checkRoot(inode)
	return m.getDirSummary(ctx, inode, summary, recursive, strict, concurrent, nil)
}

func (m *baseMeta) getDirSummary(ctx Context, inode Ino, summary *Summary, recursive bool, strict bool, concurrent chan struct{}, updateProgress func(count uint64, bytes uint64)) syscall.Errno {
	var entries []*Entry
	var err syscall.Errno
	format := m.getFormat()
	if strict || !format.DirStats {
		err = m.en.doReaddi
```

### Core Architecture Module: `pkg/meta/utils_darwin.go`
```
package meta

import (
	"syscall"

	sys "golang.org/x/sys/unix"
)

const ENOATTR = syscall.ENOATTR
const (
	F_UNLCK = syscall.F_UNLCK
	F_RDLCK = syscall.F_RDLCK
	F_WRLCK = syscall.F_WRLCK
)

const (
	XattrCreateOrReplace = 0
	XattrCreate          = sys.XATTR_CREATE
	XattrReplace         = sys.XATTR_REPLACE
)

```

### Core Architecture Module: `pkg/meta/utils_linux.go`
```
package meta

import (
	"syscall"

	sys "golang.org/x/sys/unix"
)

const ENOATTR = syscall.ENODATA
const (
	F_UNLCK = syscall.F_UNLCK
	F_RDLCK = syscall.F_RDLCK
	F_WRLCK = syscall.F_WRLCK
)

const (
	XattrCreateOrReplace = 0
	XattrCreate          = sys.XATTR_CREATE
	XattrReplace         = sys.XATTR_REPLACE
)

```

### Core Architecture Module: `pkg/meta/utils_windows.go`
```
/*
 * JuiceFS, Copyright 2021 Juicedata, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package meta

import "syscall"

const ENOATTR = syscall.ENODATA

const (
	F_UNLCK = 1
	F_RDLCK = 2
	F_WRLCK = 3
)

const (
	XattrCreateOrReplace = 0
	XattrCreate          = 1
	XattrReplace         = 2
)

```

### Core Architecture Module: `pkg/utils/alloc.go`
```
/*
 * JuiceFS, Copyright 2020 Juicedata, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package utils

import (
	"fmt"
	"math/bits"
	"runtime"
	"sync"
	"sync/atomic"
	"time"
)

var used int64

// Alloc returns size bytes memory from Go heap.
func Alloc(size int) []byte {
	b := Alloc0(size)
	atomic.AddInt64(&used, int64(cap(b)))
	return b
}

// Alloc returns size bytes memory from Go heap.
func Alloc0(size int) []byte {
	zeros := PowerOf2(size)
	b := *pools[zeros].Get().(*[]byte)
	if cap(b) < size {
		panic(fmt.Sprintf("%d < %d", cap(b), size))
	}
	return b[:size]
}

// Free returns memory to Go heap.
func Free(b []byte) {
	// buf could be zero length
	atomic.AddInt64(&used, -int64(cap(b)))
	Free0(b)
}

// Free returns memory to Go heap.
func Free0(b []byte) {
	// buf could be zero length
	pools[PowerOf2(cap(b))].Put(&b)
}

// AllocMemory returns the allocated memory
func AllocMemory() int64 {
	return atomic.LoadInt64(&used)
}

var pools []*sync.Pool

// PowerOf2 returns the smallest power of 2 that is >= s
func PowerOf2(s int) int {
	if s <= 0 {
		return 0
	}
	// Find position of the most significant bit (MSB)
	return bits.Len(uint(s - 1))
}

func init() {
	pools = make([]*sync.Pool, 34) // 1 - 8G
	for i := 0; i < 34; i++ {
		func(bits int) {
			pools[i] = &sync.Pool{
				New: func() interface{} {
					b := make([]byte, 1<<bits)
					return &b
				},
			}
		}(i)
	}
	go func() {
		for {
			time.Sleep(time.Minute * 10)
			runtime.GC()
		}
	}()
}

```

### Core Architecture Module: `pkg/utils/buffer.go`
```
/*
 * JuiceFS, Copyright 2020 Juicedata, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package utils

import (
	"encoding/binary"
	"unsafe"
)

// Buffer is a buffer to read/write integers.
type Buffer struct {
	endian binary.ByteOrder
	off    int
	buf    []byte
}

// NewBuffer returns a buffer with sz number of bytes.
func NewBuffer(sz uint32) *Buffer {
	return FromBuffer(make([]byte, sz))
}

// ReadBuffer utility to create *Buffer from slice of bytes
func ReadBuffer(buf []byte) *Buffer {
	return FromBuffer(buf)
}

// FromBuffer utility to create *Buffer
func FromBuffer(buf []byte) *Buffer {
	return &Buffer{binary.BigEndian, 0, buf}
}

// Len returns length of buffer
func (b *Buffer) Len() int {
	return len(b.buf)
}

// HasMore checks if offset is less than length
func (b *Buffer) HasMore() bool {
	return b.off < len(b.buf)
}

// Left returns number of bytes after offset
func (b *Buffer) Left() int {
	return len(b.buf) - b.off
}

// Seek seeks or sets offset to `p`
func (b *Buffer) Seek(p int) {
	b.off = p
}

func (b *Buffer) Offset() int {
	return b.off
}

// Buffer returns
func (b *Buffer) Buffer() []byte {
	return b.buf[b.off:]
}

// Put8 appends uint8 to Buffer
func (b *Buffer) Put8(v uint8) {
	b.buf[b.off] = v
	b.off++
}

// Get8 returns uint8
func (b *Buffer) Get8() uint8 {
	v := b.buf[b.off]
	b.off++
	return v
}

// Put16 appends uint16 to Buffer
func (b *Buffer) Put16(v uint16) {
	b.endian.PutUint16(b.buf[b.off:b.off+2], v)
	b.off += 2
}

// Get16 returns uint16
func (b *Buffer) Get16() uint16 {
	v := b.endian.Uint16(b.buf[b.off : b.off+2])
	b.off += 2
	return v
}

// Put32 appends uint32 to Buffer
func (b *Buffer) Put32(v uint32) {
	b.endian.PutUint32(b.buf[b.off:b.off+4], v)
	b.off += 4
}

// Get32 returns uint32
func (b *Buffer) Get32() uint32 {
	v := b.endian.Uint32(b.buf[b.off : b.off+4])
	b.off += 4
	return v
}

// Put64 appends uint64 to Buffer
func (b *Buffer) Put64(v uint64) {
	b.endian.PutUint64(b.buf[b.off:b.off+8], v)
	b.off += 8
}

// Get64 returns uint64
func (b *Buffer) Get64() uint64 {
	v := b.endian.Uint64(b.buf[b.off : b.off+8])
	b.off += 8
	return v
}

// Put appends slice of byte to Buffer
func (b *Buffer) Put(v []byte) {
	l := len(v)
	copy(b.buf[b.off:b.off+l], v)
	b.off += l
}

// Get returns `l` bytes from offset
func (b *Buffer) Get(l int) []byte {
	b.off += l
	return b.buf[b.off-l : b.off]
}

// SetBytes initializes the Buffer with BigEndian ordering
func (b *Buffer) SetBytes(buf []byte) {
	b.endian = binary.BigEndian
	b.off = 0
	b.buf = buf
}

// Bytes returns the bytes
func (b *Buffer) Bytes() []byte {
	return b.buf
}

var NativeEndian binary.ByteOrder

// NewNativeBuffer utility to create *Buffer of given size with nativeEndian
func NewNativeBuffer(buf []byte) *Buffer {
	return &Buffer{NativeEndian, 0, buf}
}

func init() {
	buf := [2]byte{}
	*(*uint16)(unsafe.Pointer(&buf[0])) = uint16(0xABCD)

	switch buf {
	case [2]byte{0xCD, 0xAB}:
		NativeEndian = binary.LittleEndian
	case [2]byte{0xAB, 0xCD}:
		NativeEndian = binary.BigEndian
	default:
		panic("Could not determine native endianness.")
	}
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #7594** (2026-09-29): **chunk: skip staging enqueue when writeback is disabled**
  *Symptoms*: Remounting without `--writeback` still discovers staged blocks, but currently enqueues them even though no upload workers are running. Skip enqueueing when writeback is disabled while preserving the existing scan log, staging metrics, and staged files.  Extend `TestStoreAsync` to cover both writeback modes, including forced upload callbacks and successful recovery when writeback is enabled.  close #7589. This change does not enable recovery uploads without `--writeback`.  Validation: - The new non-writeback regression fails before the fix; both modes pass after the fix (`go test ./pkg/chunk -run '^TestStoreAsync$' -count=1`, Go 1.25.10). - Full chunk suite passed: `go test -gcflags=all="-N -l" ./pkg/chunk -count=1` (Go 1.25.10). - `make test.pkg` could not complete because this macOS environment lacks `glusterfs-api`. 
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/juicedata/juicefs/pull/7594?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=juicedata) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 35.40%. Comparing base ([`bd2ccf2`](https://app.codecov.io/gh/juicedata/juicefs/commit/bd2ccf2cbcf00480f9153b8d98260e8ca74b1a6b?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=juicedata)) to head ([`ee0a956`](https://app.codecov.io/gh/juicedata/juicefs/commit/ee0a956995eed797afcc07f434a438ec4d919b85?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=juicedata)). :warning: Report is 3 commits behind head on main.  <details><summary>Additional details and impacted files</summary>    ```diff @@             Coverage Diff             @@ ##  

- **Issue #7593** (2026-09-29): **CI: clean previous mounts before ACL metadata reset**
  *Symptoms*: The preceding config test leaves `/jfs` mounted, while the ACL setup only unmounts `/tmp/jfs` before resetting the shared metadata database. CI logs show the old client accessing the database during this reset.  Call `cleanup_test_mounts` before the reset to stop leftover mounts.  failed CI: https://github.com/juicedata/juicefs/actions/runs/36480788215

- **Issue #7592** (2026-09-29): **object/sftp: pipeline write requests in Put**
  *Symptoms*: ref: https://github.com/juicedata/jfs/issues/3862 close https://github.com/juicedata/juicefs/issues/6358  ## Problem  `juicefs sync` uploads to an `sftp://` destination are slow on any link with latency. `sftpStore.Put` goes through `sftp.File.ReadFrom` without concurrent writes, so every 32KiB write request waits for its response before the next one is sent. Throughput per file is capped at about 32KiB / RTT (≈2.8 MiB/s at 10ms, ≈0.6 MiB/s at 50ms).  ## Change  - Temporary-file uploads (the default) use `(*sftp.File).ReadFromWithConcurrency(in, 0)`. It fills each 32KiB packet before sending and keeps up to 64 writes in flight, whether or not the source size is known and however small the source reads are. The concurrency is scoped to this call; the client-wide `UseConcurrentWrites` option stays off. - `--inplace` uploads remain sequential. A concurrent failure could leave holes in a file that already has its full length, and `sync` compares by size by default, so the next run would skip that corrupt file. - Memory per active upload: one reused 32KiB buffer plus 64 short-lived worker goroutines. The unused 1MiB `bufPool` buffer is no longer taken.  ## Benchmark  Real `juicefs sync` to OpenSSH 8.9 `sftp-server`, with RTT added by netem, 128MiB per case, default 10 threads.  | RTT | Source | main | this PR | |---|---|---|---| | 10ms | local file, 1 × 128MiB | 2.8 MiB/s | 76 MiB/s | | 10ms | S3 over HTTPS, 1 × 128MiB | 2.8 MiB/s | 75 MiB/s | | 10ms | S3 over HTTPS, 32 × 4MiB | 1

- **Issue #7591** (2026-09-29): **CI: exclude clone summary COST by column name**
  *Symptoms*: https://github.com/juicedata/juicefs/actions/runs/36480788215

- **Issue #7589** (2026-09-29): **Blocks staged by a writeback mount are never uploaded after remounting without --writeback**
  *Symptoms*: **What happened**:  Blocks staged by a `--writeback` mount are never uploaded once the same cache directory is mounted again without `--writeback`. They stay in `rawstaging/` and in `juicefs_staging_blocks` for as long as that mount runs, and nothing is logged. A later mount with `--writeback` uploads them at once.  **What you expected to happen**:  Either the mount uploads the staged blocks it finds, or it refuses to start (or warns loudly) when it finds staged blocks it will not upload.  **How to reproduce it (as minimally and precisely as possible)**:  With any object store and metadata engine (here MinIO and Redis):  ```sh META=redis://redis:6379/1 juicefs format --storage minio --bucket http://minio:9000/jfs \   --access-key minioadmin --secret-key minioadmin "$META" myjfs  juicefs mount -d --writeback --upload-delay 600s --cache-dir /var/jfsCache "$META" /mnt/jfs for i in $(seq 20); do dd if=/dev/urandom of=/mnt/jfs/f$i bs=1M count=1 status=none; done; sync juicefs umount /mnt/jfs  juicefs mount -d --cache-dir /var/jfsCache "$META" /mnt/jfs      # no --writeback sleep 180 find /var/jfsCache -path '*/rawstaging/*' -type f | wc -l       # 20 grep juicefs_staging_blocks /mnt/jfs/.stats                     # 20 juicefs umount /mnt/jfs                                         # bucket: no new object  juicefs mount -d --writeback --upload-delay 0 --cache-dir /var/jfsCache "$META" /mnt/jfs sleep 5 find /var/jfsCache -path '*/rawstaging/*' -type f | wc -l       # 0, the 20 block
  **Post-Mortem & Fix Analysis**:
  > There is already a log message for this: ```golang logger.Infof("Found %d staging blocks (%s) in %s with %s", count, humanize.IBytes(usage)...) ``` However, we can remove the logic that enqueues them in uploader.

- **Issue #7588** (2026-09-28): **CI: force version-limit recovery in config test**
  *Symptoms*: After the test sets `max-client-version` to `1.0.1`, the current client is correctly refused when it tries to restore the limit without `--force`.  Assert that the unforced update is rejected, then explicitly force the test's recovery update before mounting again.  Validation: `bash -n` and a real CLI check with a disposable SQLite volume: the unforced update fails without changing the stored maximum, and the forced update succeeds. The Linux mount portion remains for CI. 

- **Issue #7587** (2026-09-28): **CI: account for SQL rewind in changelog tests**
  *Symptoms*: SQL changelog scans rewind to catch transactions that commit out of ID order (#7522). The command test still assumes that every returned version is greater than `--from` and that `--from=0` never replays older entries, so MySQL fails with `version 1 is not greater than 1`.  Keep the strict assertions for Redis and SQLite, allow rewind output for the other backends, and require the expected resumed and newly created file operations. Document the SQL rewind window and consumer deduplication requirements.  Validation: `bash -n`, ShellCheck, and shell fixtures executing the existing test function. The fixtures reproduce both pre-fix failures, pass with the fix, and reject missing operations and unexpected Redis/SQLite replay. Full Linux/FUSE integration remains for CI. 

- **Issue #7586** (2026-09-28): **CI: ignore summary duration in dump/load benchmark**
  *Symptoms*: This fixes a `dump_load_bench` failure introduced by #7552. The new `COST` column contains scan duration, which varies between runs and causes the full CSV row comparison to fail even when size and entry counts match. The comparison now excludes `COST`.  https://github.com/juicedata/juicefs/actions/runs/36343560540

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

### Incident Patch 1: `f38c0ce4` (2026-09-29)
**Commit Message**: test: build sftp tests only without the nosftp tag (#7580)

Signed-off-by: Git'Fellow <[REDACTED_EMAIL]>

**File**: `.github/workflows/verify.yml` (modified, +4/-0)
```diff
@@ -92,6 +92,10 @@ jobs:
           make juicefs.lite
           ./juicefs.lite version
 
+      - name: vet nosftp
+        timeout-minutes: 10
+        run: go vet -tags nosftp ./pkg/object/
+
       - name: build windows
         timeout-minutes: 10
         run: make juicefs.exe
```

**File**: `pkg/object/filesystem_test.go` (modified, +0/-11)
```diff
@@ -52,17 +52,6 @@ func TestDisk2(t *testing.T) {
 	testFileSystem(t, s)
 }
 
-func TestSftp2(t *testing.T) { //skip mutate
-	if os.Getenv("SFTP_HOST") == "" {
-		t.SkipNow()
-	}
-	sftp, err := newSftp(os.Getenv("SFTP_HOST"), os.Getenv("SFTP_USER"), os.Getenv("SFTP_PASS"), "")
-	if err != nil {
-		t.Fatalf("sftp: %s", err)
-	}
-	testFileSystem(t, sftp)
-}
-
 func TestCifs2(t *testing.T) { //skip mutate
 	if os.Getenv("CIFS_ADDR") == "" {
 		fmt.Println("skip CIFS test")
```

**File**: `pkg/object/object_storage_test.go` (modified, +7/-146)
```diff
@@ -154,6 +154,7 @@ func testStorage(t *testing.T, s ObjectStorage) {
 	}
 	prefix := "unit-test/"
 	s = WithPrefix(s, prefix)
+	defer s.Delete(ctx, "") // the prefix directory on file systems
 	defer func() {
 		if err := s.Delete(ctx, "test"); err != nil {
 			t.Fatalf("delete failed: %s", err)
@@ -324,7 +325,12 @@ func testStorage(t *testing.T, s ObjectStorage) {
 	if err := s.Put(ctx, "a1", bytes.NewReader(br)); err != nil {
 		t.Fatalf("PUT failed: %s", err.Error())
 	}
-	defer s.Delete(ctx, "a/b/c/d/e/f")
+	defer func() {
+		// file systems create the parent directories implicitly
+		for _, k := range []string{"a/b/c/d/e/f", "a/b/c/d/e/", "a/b/c/d/", "a/b/c/", "a/b/"} {
+			_ = s.Delete(ctx, k)
+		}
+	}()
 	if err := s.Put(ctx, "a/b/c/d/e/f", bytes.NewReader(br)); err != nil {
 		t.Fatalf("PUT failed: %s", err.Error())
 	}
@@ -838,151 +844,6 @@ func TestBOS(t *testing.T) { //skip mutate
 	testStorage(t, b)
 }
 
-func TestSftp(t *testing.T) { //skip mutate
-	if os.Getenv("SFTP_HOST") == "" {
-		t.SkipNow()
-	}
-	b, _ := newSftp(os.Getenv("SFTP_HOST"), os.Getenv("SFTP_USER"), os.Getenv("SFTP_PASS"), "")
-	testStorage(t, b)
-}
-
-func TestParseSftpEndpoint(t *testing.T) {
-	tests := []struct {
-		name               string
-		endpoint           string
-		wantHost, wantPort string
-		wantRoot           string
-		wantErr            string
-	}{
-		{
-			name:     "default port with timestamp colons",
-			endpoint: "host:/path/T05:53:21",
-			wantHost: "host",
-			wantPort: "22",
-			wantRoot: "/path/T05:53:21",
-		},
-		{
-			name:     "explicit port with timestamp colons",
-			endpoint: "host:2022:/path/T05:53:21",
-			wantHost: "host",
-			wantPort: "2022",
-			wantRoot: "/path/T05:53:21",
-		},
-		{
-			name:     "IPv6 explicit port with timestamp colons",
-			endpoint: "[2001:db8::1]:2022:/path/T05:53:21",
-			wantHost: "2001:db8::1",
-			wantPort: "2022",
-			wantRoot: "/path/T05:53:21",
-		},
-		{
-			name:     "IPv6 default port with timestamp colons",
-			endpoint: "[2001:db8::1]:/path/T05:53:21",
-			wantHost: "2001:db8::1",
-			wantPort: "22",
-			wantRoot: "/path/T05:53:21",
-		},
-		{
-			name:     "relative path remains supported",
-			endpoint: "host:backup/path",
-			wantHost: "host",
-			wantPort: "22",
-			wantRoot: "backup/path",
-		},
-		{
-			name:     "relative path with timestamp colons",
-			endpoint: "host:T05:53:21",
-			wantHost: "host",
-			wantPort: "22",
-			wantRoot: "T05:53:21",
-		},
-		{
-			name:     "relative path with ISO timestamp colons",
-			endpoint: "host:2026-07-23T05:53:21",
-			wantHost: "host",
-			wantPort: "22",
-			wantRoot: "2026-07-23T05:53:21",
-		},
-		{
-			name:     "explicit port with relative path",
-			endpoint: "host:2022:backup/path",
-			wantHost: "host",
-			wantPort: "2022",
-			wantRoot: "backup/path",
-		},
-		{
-			name:     "relative path with symbols",
-			endpoint: "host:!@#$%^&*()_+-=[]{}|;,.<>?",
-			wantHost: "host",
-			wantPort: "22",
-			wantRoot: "!@#$%^&*()_+-=[]{}|;,.<>?",
-		},
-		{
-			name:     "relative path starts with colon",
-			endpoint: "host::backup/path",
-			wantHost: "host",
-			wantPort: "22",
-			wantRoot: ":backup/path",
-		},
-		{
-			name:     "numeric relative path",
-			endpoint: "host:2022",
-			wantHost: "host",
-			wantPort: "22",
-			wantRoot: "2022",
-		},
-		{
-			name:     "empty path",
-			endpoint: "host:",
-			wantErr:  "missing path",
-		},
-		{
-			name:     "explicit port with empty path",
-			endpoint: "host:2022:",
-			wantErr:  "missing path",
-		},
-		{
-			name:     "IPv6 default port with empty path",
-			endpoint: "[2001:db8::1]:",
-			wantErr:  "missing path",
-		},
-		{
-			name:     "missing port path separator",
-			endpoint: "host:2022/path",
-			wantErr:  "missing colon between port and path",
-		},
-		{
-			name:     "IPv6 missing port path separator",
-			endpoint: "[2001:db8::1]:2022/path",
-			wantErr:  "missing colon between port and path",
-		},
-		{
-			name:     "console endpoint missing port path separator",
-			endpoint: "172.28.39.219:22/root/bak/jfs-console-dump-2026-07-23T05:53:21.json.gz.gpg",
-			wantErr:  "missing colon between port and path",
-		},
-	}
-
-	for _, test := range tests {
-		t.Run(test.name, func(t *testing.T) {
-			host, port, root, err := parseSftpEndpoint(test.endpoint)
-			if test.wantErr != "" {
-				if err == nil || !strings.Contains(err.Error(), test.wantErr) {
-					t.Fatalf("parseSftpEndpoint(%q) error = %v, want error containing %q", test.endpoint, err, test.wantErr)
-				}
-				return
-			}
-			if err != nil {
-				t.Fatal(err)
-			}
-			if host != test.wantHost || port != test.wantPort || root != test.wantRoot {
-				t.Fatalf("parseSftpEndpoint(%q) = (%q, %q, %q), want (%q, %q, %q)",
-					test.endpoint, host, port, root, test.wantHost, test.wantPort, test.wantRoot)
-			}
-		})
-	}
-}
-
 func TestOBS(t *testing.T) { //skip mutate
 	if os.Getenv("HWCLOUD_ACCESS_KEY") == "" {
 		t.SkipNow()
```

**File**: `pkg/object/sftp_test.go` (added, +187/-0)
```diff
@@ -0,0 +1,187 @@
+//go:build !nosftp
+// +build !nosftp
+
+/*
+ * JuiceFS, Copyright 2026 Juicedata, Inc.
+ *
+ * Licensed under the Apache License, Version 2.0 (the "License");
+ * you may not use this file except in compliance with the License.
+ * You may obtain a copy of the License at
+ *
+ *     http://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ */
+
+package object
+
+import (
+	"context"
+	"errors"
+	"os"
+	"strings"
+	"testing"
+)
+
+func TestSftp(t *testing.T) { //skip mutate
+	if os.Getenv("SFTP_HOST") == "" {
+		t.SkipNow()
+	}
+	b, _ := newSftp(os.Getenv("SFTP_HOST"), os.Getenv("SFTP_USER"), os.Getenv("SFTP_PASS"), "")
+	testStorage(t, b)
+	if _, err := b.Head(context.Background(), "unit-test/"); !errors.Is(err, os.ErrNotExist) {
+		t.Fatalf("testStorage left unit-test/ behind: %v", err)
+	}
+}
+
+func TestSftp2(t *testing.T) { //skip mutate
+	if os.Getenv("SFTP_HOST") == "" {
+		t.SkipNow()
+	}
+	sftp, err := newSftp(os.Getenv("SFTP_HOST"), os.Getenv("SFTP_USER"), os.Getenv("SFTP_PASS"), "")
+	if err != nil {
+		t.Fatalf("sftp: %s", err)
+	}
+	testFileSystem(t, sftp)
+}
+
+func TestParseSftpEndpoint(t *testing.T) {
+	tests := []struct {
+		name               string
+		endpoint           string
+		wantHost, wantPort string
+		wantRoot           string
+		wantErr            string
+	}{
+		{
+			name:     "default port with timestamp colons",
+			endpoint: "host:/path/T05:53:21",
+			wantHost: "host",
+			wantPort: "22",
+			wantRoot: "/path/T05:53:21",
+		},
+		{
+			name:     "explicit port with timestamp colons",
+			endpoint: "host:2022:/path/T05:53:21",
+			wantHost: "host",
+			wantPort: "2022",
+			wantRoot: "/path/T05:53:21",
+		},
+		{
+			name:     "IPv6 explicit port with timestamp colons",
+			endpoint: "[2001:db8::1]:2022:/path/T05:53:21",
+			wantHost: "2001:db8::1",
+			wantPort: "2022",
+			wantRoot: "/path/T05:53:21",
+		},
+		{
+			name:     "IPv6 default port with timestamp colons",
+			endpoint: "[2001:db8::1]:/path/T05:53:21",
+			wantHost: "2001:db8::1",
+			wantPort: "22",
+			wantRoot: "/path/T05:53:21",
+		},
+		{
+			name:     "relative path remains supported",
+			endpoint: "host:backup/path",
+			wantHost: "host",
+			wantPort: "22",
+			wantRoot: "backup/path",
+		},
+		{
+			name:     "relative path with timestamp colons",
+			endpoint: "host:T05:53:21",
+			wantHost: "host",
+			wantPort: "22",
+			wantRoot: "T05:53:21",
+		},
+		{
+			name:     "relative path with ISO timestamp colons",
+			endpoint: "host:2026-07-23T05:53:21",
+			wantHost: "host",
+			wantPort: "22",
+			wantRoot: "2026-07-23T05:53:21",
+		},
+		{
+			name:     "explicit port with relative path",
+			endpoint: "host:2022:backup/path",
+			wantHost: "host",
+			wantPort: "2022",
+			wantRoot: "backup/path",
+		},
+		{
+			name:     "relative path with symbols",
+			endpoint: "host:!@#$%^&*()_+-=[]{}|;,.<>?",
+			wantHost: "host",
+			wantPort: "22",
+			wantRoot: "!@#$%^&*()_+-=[]{}|;,.<>?",
+		},
+		{
+			name:     "relative path starts with colon",
+			endpoint: "host::backup/path",
+			wantHost: "host",
+			wantPort: "22",
+			wantRoot: ":backup/path",
+		},
+		{
+			name:     "numeric relative path",
+			endpoint: "host:2022",
+			wantHost: "host",
+			wantPort: "22",
+			wantRoot: "2022",
+		},
+		{
+			name:     "empty path",
+			endpoint: "host:",
+			wantErr:  "missing path",
+		},
+		{
+			name:     "explicit port with empty path",
+			endpoint: "host:2022:",
+			wantErr:  "missing path",
+		},
+		{
+			name:     "IPv6 default port with empty path",
+			endpoint: "[2001:db8::1]:",
+			wantErr:  "missing path",
+		},
+		{
+			name:     "missing port path separator",
+			endpoint: "host:2022/path",
+			wantErr:  "missing colon between port and path",
+		},
+		{
+			name:     "IPv6 missing port path separator",
+			endpoint: "[2001:db8::1]:2022/path",
+			wantErr:  "missing colon between port and path",
+		},
+		{
+			name:     "console endpoint missing port path separator",
+			endpoint: "172.28.39.219:22/root/bak/jfs-console-dump-2026-07-23T05:53:21.json.gz.gpg",
+			wantErr:  "missing colon between port and path",
+		},
+	}
+
+	for _, test := range tests {
+		t.Run(test.name, func(t *testing.T) {
+			host, port, root, err := parseSftpEndpoint(test.endpoint)
+			if test.wantErr != "" {
+				if err == nil || !strings.Contains(err.Error(), test.wantErr) {
+					t.Fatalf("parseSftpEndpoint(%q) error = %v, want error containing %q", test.endpoint, err, test.wantErr)
+				}
+				return
+			}
+			if err != nil {
+				t.Fatal(err)
+			}
+			if host != test.wantHost || port != test.wantPort || root != test.wantRoot {
+				t.Fatalf("parseSftpEndpoint(%q) = (%q, %q, %q), want (%q,
```

---

### Incident Patch 2: `7ca76c6e` (2026-09-29)
**Commit Message**: test(object): fix data race on err in multipart upload test (#7581)

Signed-off-by: Git'Fellow <[REDACTED_EMAIL]>

**File**: `pkg/object/object_storage_test.go` (modified, +1/-0)
```diff
@@ -561,6 +561,7 @@ func testStorage(t *testing.T, s ObjectStorage) {
 					<-pool
 					wg.Done()
 				}()
+				var err error
 				parts[num-1], err = s.UploadPart(ctx, k, upload.UploadID, num, content[num-1])
 				if err != nil {
 					errCh <- fmt.Errorf("multipart upload error: %v", err)
```

---

### Incident Patch 3: `9b4f37df` (2026-09-28)
**Commit Message**: CI: build pinned MinIO images from official release binaries (#7584)

Signed-off-by: miyang <[REDACTED_EMAIL]>

**File**: `.github/scripts/chaos/minio.yaml` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ spec:
     spec:
       containers:
       - name: minio
-        image: quay.io/minio/minio
+        image: chenyunhui/minio@sha256:a1a8bd4ac40ad7881a245bab97323e18f971e4d4cba2c2007ec1bedd21cbaba2
         resources:
           limits:
             memory: "500Mi"
```

**File**: `.github/scripts/command/Dockerfile.minio-old` (modified, +3/-2)
```diff
@@ -1,5 +1,6 @@
-# Package the official binary of the original reference server, without rebuilding it.
+# Package an official release binary, keeping the original reference server as the default.
 FROM scratch
 ARG TARGETARCH
-ADD --chmod=755 https://github.com/minio/minio/releases/download/RELEASE.2021-04-22T15-44-28Z/minio.linux-${TARGETARCH}.RELEASE.2021-04-22T15-44-28Z /minio
+ARG MINIO_VERSION=RELEASE.2021-04-22T15-44-28Z
+ADD --chmod=755 https://github.com/minio/minio/releases/download/${MINIO_VERSION}/minio.linux-${TARGETARCH}.${MINIO_VERSION} /minio
 ENTRYPOINT ["/minio"]
```

**File**: `.github/scripts/command/dump_load.sh` (modified, +1/-1)
```diff
@@ -40,7 +40,7 @@ if ! docker ps | grep -q minio; then
             -e "MINIO_SECRET_KEY=minioadmin" \
             -v /tmp/data:/data \
             -v /tmp/config:/root/.minio \
-            quay.io/minio/minio server /data
+            chenyunhui/minio@sha256:a1a8bd4ac40ad7881a245bab97323e18f971e4d4cba2c2007ec1bedd21cbaba2 server /data
 fi
 [[ ! -f /usr/local/bin/mc ]] && .github/scripts/download_mc.sh linux-amd64 /usr/local/bin/mc && chmod +x /usr/local/bin/mc
 sleep 3s
```

**File**: `.github/scripts/command/dump_load_cross_meta.sh` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ if ! docker ps | grep -q minio; then
             -e "MINIO_SECRET_KEY=minioadmin" \
             -v /tmp/data:/data \
             -v /tmp/config:/root/.minio \
-            quay.io/minio/minio server /data
+            chenyunhui/minio@sha256:a1a8bd4ac40ad7881a245bab97323e18f971e4d4cba2c2007ec1bedd21cbaba2 server /data
 fi
 [[ ! -f /usr/local/bin/mc ]] && .github/scripts/download_mc.sh linux-amd64 /usr/local/bin/mc && chmod +x /usr/local/bin/mc
 sleep 3s
```

**File**: `.github/scripts/prepare_db.sh` (modified, +2/-1)
```diff
@@ -61,7 +61,8 @@ install_keydb() {
 }
 
 install_minio() {
-    docker run -d -p 9000:9000 -p 9001:9001 -e "MINIO_ROOT_USER=testUser" -e "MINIO_ROOT_PASSWORD=testUserPassword" quay.io/minio/minio:RELEASE.2022-01-25T19-56-04Z server /data --console-address ":9001"
+    docker build --build-arg MINIO_VERSION=RELEASE.2022-01-25T19-56-04Z -t juicefs/minio-test:RELEASE.2022-01-25T19-56-04Z -f .github/scripts/command/Dockerfile.minio-old .
+    docker run -d -p 9000:9000 -p 9001:9001 -e "MINIO_ROOT_USER=testUser" -e "MINIO_ROOT_PASSWORD=testUserPassword" juicefs/minio-test:RELEASE.2022-01-25T19-56-04Z server /data --console-address ":9001"
     go install github.com/minio/mc@RELEASE.2022-01-07T06-01-38Z && mc alias set local http://127.0.0.1:9000 testUser testUserPassword && mc mb local/testbucket
 }
 
```

**File**: `.github/scripts/start_meta_engine.sh` (modified, +2/-2)
```diff
@@ -319,13 +319,13 @@ start_meta_engine(){
     fi
     
     if [ "$storage" == "minio" ]; then
-        if ! docker ps | grep "minio/minio"; then
+        if ! docker ps | grep "chenyunhui/minio"; then
             docker run -d -p 9000:9000 --name minio \
                 -e "MINIO_ACCESS_KEY=minioadmin" \
                 -e "MINIO_SECRET_KEY=minioadmin" \
                 -v /tmp/data:/data \
                 -v /tmp/config:/root/.minio \
-                quay.io/minio/minio server /data
+                chenyunhui/minio@sha256:a1a8bd4ac40ad7881a245bab97323e18f971e4d4cba2c2007ec1bedd21cbaba2 server /data
             sleep 3s
         fi
         [ ! -x mc ] && .github/scripts/download_mc.sh linux-amd64 ./mc && chmod +x mc
```

**File**: `.github/scripts/sync/sync_cluster.sh` (modified, +2/-2)
```diff
@@ -57,13 +57,13 @@ configure_redis_for_cluster(){
 }
 
 start_minio(){
-    if ! docker ps | grep "minio/minio"; then
+    if ! docker ps | grep "chenyunhui/minio"; then
         docker run -d -p 9000:9000 --name minio \
                 -e "MINIO_ACCESS_KEY=minioadmin" \
                 -e "MINIO_SECRET_KEY=minioadmin" \
                 -v /tmp/data:/data \
                 -v /tmp/config:/root/.minio \
-                quay.io/minio/minio server /data
+                chenyunhui/minio@sha256:a1a8bd4ac40ad7881a245bab97323e18f971e4d4cba2c2007ec1bedd21cbaba2 server /data
         sleep 3s
     fi
     [ ! -x mc ] && .github/scripts/download_mc.sh linux-amd64 ./mc && chmod +x mc
```

**File**: `.github/workflows/mutate-test.yml` (modified, +2/-1)
```diff
@@ -152,7 +152,8 @@ jobs:
       - name: Prepare Database
         timeout-minutes: 10
         run: |
-          docker run -d -p 9000:9000 -p 9001:9001 -e "MINIO_ROOT_USER=testUser" -e "MINIO_ROOT_PASSWORD=testUserPassword" quay.io/minio/minio:RELEASE.2022-01-25T19-56-04Z server /data --console-address ":9001"
+          docker build --build-arg MINIO_VERSION=RELEASE.2022-01-25T19-56-04Z -t juicefs/minio-test:RELEASE.2022-01-25T19-56-04Z -f .github/scripts/command/Dockerfile.minio-old .
+          docker run -d -p 9000:9000 -p 9001:9001 -e "MINIO_ROOT_USER=testUser" -e "MINIO_ROOT_PASSWORD=testUserPassword" juicefs/minio-test:RELEASE.2022-01-25T19-56-04Z server /data --console-address ":9001"
           go install github.com/minio/mc@RELEASE.2022-01-07T06-01-38Z && mc alias set local http://127.0.0.1:9000 testUser testUserPassword && mc mb local/testbucket
           make
           # sudo make -C fstests setup
```

---

### Incident Patch 4: `7cbb3dfe` (2026-09-28)
**Commit Message**: CI: fix pysdk failed (#7585)

Signed-off-by: miyang <[REDACTED_EMAIL]>

**File**: `sdk/python/juicefs/juicefs/juicefs.py` (modified, +1/-1)
```diff
@@ -433,7 +433,7 @@ def parseSummary(entry, removefields):
                 for v in entry["Children"]:
                     parseSummary(v, removefields)
 
-        parseSummary(res, ["Inode"])
+        parseSummary(res, ["Inode", "Duration"])
         self.lib.free(buf)
         return res
 
```

---

### Incident Patch 5: `b2489c35` (2026-09-22)
**Commit Message**: meta: fix nlink of cloned directory without recounting (#7570)

**File**: `pkg/meta/base.go` (modified, +10/-14)
```diff
@@ -128,7 +128,7 @@ type engine interface {
 	doRename(ctx Context, parentSrc Ino, nameSrc string, parentDst Ino, nameDst string, flags uint32, inode, tinode *Ino, attr, tattr *Attr) syscall.Errno
 	doSetXattr(ctx Context, inode Ino, name string, value []byte, flags uint32) syscall.Errno
 	doRemoveXattr(ctx Context, inode Ino, name string) syscall.Errno
-	doRepair(ctx Context, inode Ino, attr *Attr) syscall.Errno
+	doRepair(ctx Context, inode Ino, attr *Attr, trustNlink bool) syscall.Errno
 	doTouchAtime(ctx Context, inode Ino, attr *Attr, ts time.Time) (bool, error)
 	doRead(ctx Context, inode Ino, indx uint32) ([]*slice, syscall.Errno)
 	doList(ctx Context, inode Ino) ([]*slice, syscall.Errno)
@@ -2660,7 +2660,7 @@ func (m *baseMeta) Check(ctx Context, fpath string, opt *CheckOpt) error {
 							attr.Ctime = now
 							attr.Length = 4 << 10
 						}
-						if st1 := m.en.doRepair(ctx, inode, attr); st1 == 0 || st1 == syscall.ENOENT {
+						if st1 := m.en.doRepair(ctx, inode, attr, false); st1 == 0 || st1 == syscall.ENOENT {
 							logger.Debugf("Path %s (inode %d) is successfully repaired", path, inode)
 						} else {
 							hasError = true
@@ -3452,9 +3452,6 @@ func (m *baseMeta) cloneEntry(ctx Context, srcIno Ino, parent Ino, name string,
 	if attr.Typ != TypeDirectory {
 		return 0
 	}
-	if eno = m.Access(ctx, srcIno, MODE_MASK_R|MODE_MASK_X, &attr); eno != 0 {
-		return eno
-	}
 	// Use DirHandler for batch processing to avoid loading all entries at once
 	handler, eno := m.NewDirHandler(ctx, srcIno, true, nil)
 	if eno == syscall.ENOENT {
@@ -3469,21 +3466,20 @@ func (m *baseMeta) cloneEntry(ctx Context, srcIno Ino, parent Ino, name string,
 	defer cloneCtx.Cancel()
 
 	var g errgroup.Group
-	var skipped uint32
+	nlink := uint32(2)
 
 	cloneChild := func(e *Entry) syscall.Errno {
 		childEno := m.cloneEntry(cloneCtx, e.Inode, ino, string(e.Name), nil, cmode, cumask, count, false, concurrent)
 		if childEno == syscall.ENOENT {
 			logger.Warnf("ignore deleted %s in dir %d", string(e.Name), srcIno)
-			if e.Attr.Typ == TypeDirectory {
-				atomic.AddUint32(&skipped, 1)
-			}
 			return 0
 		}
 		if childEno != 0 {
 			cloneCtx.Cancel()
+			return childEno
 		}
-		return childEno
+		atomic.AddUint32(&nlink, 1)
+		return 0
 	}
 
 	offset := 0
@@ -3555,10 +3551,10 @@ func (m *baseMeta) cloneEntry(ctx Context, srcIno Ino, parent Ino, name string,
 		eno = syscall.EINTR
 	}
 
-	if eno == 0 && skipped > 0 {
-		attr.Nlink -= skipped
-		if eno := m.en.doRepair(ctx, ino, &attr); eno != 0 {
-			logger.Warnf("fix nlink of %d: %s", ino, eno)
+	if eno == 0 && nlink != attr.Nlink {
+		attr.Nlink = nlink
+		if st := m.en.doRepair(ctx, ino, &attr, true); st != 0 {
+			logger.Warnf("fix nlink of %d: %s", ino, st)
 		}
 	}
 	return eno
```

**File**: `pkg/meta/base_test.go` (modified, +22/-0)
```diff
@@ -3444,6 +3444,28 @@ func testCheckAndRepair(t *testing.T, m Meta) {
 			t.Fatalf("d4Inode  attr: %+v", *dirAttr)
 		}
 	}
+
+	// doRepair should keep the given nlink when trustNlink is set
+	var before Attr
+	if st := m.GetAttr(Background(), d4Inode, &before); st != 0 {
+		t.Fatalf("getattr: %s", st)
+	}
+	fixed := before
+	fixed.Nlink = before.Nlink + 5
+	if st := m.getBase().en.doRepair(Background(), d4Inode, &fixed, true); st != 0 {
+		t.Fatalf("repair nlink of d4Inode: %s", st)
+	}
+	var after Attr
+	if st := m.GetAttr(Background(), d4Inode, &after); st != 0 {
+		t.Fatalf("getattr: %s", st)
+	}
+	if after.Nlink != before.Nlink+5 {
+		t.Fatalf("d4Inode nlink should be %d, but got %d", before.Nlink+5, after.Nlink)
+	}
+	after.Nlink = before.Nlink
+	if after != before {
+		t.Fatalf("d4Inode attr should not be changed: %+v -> %+v", before, after)
+	}
 }
 
 func testDirStat(t *testing.T, m Meta) {
```

**File**: `pkg/meta/redis.go` (modified, +18/-12)
```diff
@@ -4264,20 +4264,22 @@ func (m *redisMeta) scanPendingFiles(ctx Context, scan pendingFileScan) error {
 	return nil
 }
 
-func (m *redisMeta) doRepair(ctx Context, inode Ino, attr *Attr) syscall.Errno {
+func (m *redisMeta) doRepair(ctx Context, inode Ino, attr *Attr, trustNlink bool) syscall.Errno {
 	return errno(m.txn(ctx, func(tx *redis.Tx) error {
-		attr.Nlink = 2
-		vals, err := tx.HGetAll(ctx, m.entryKey(inode)).Result()
-		if err != nil {
-			return err
-		}
-		for _, v := range vals {
-			typ, _ := m.parseEntry([]byte(v))
-			if typ == TypeDirectory {
-				attr.Nlink++
+		if !trustNlink {
+			attr.Nlink = 2
+			vals, err := tx.HGetAll(ctx, m.entryKey(inode)).Result()
+			if err != nil {
+				return err
+			}
+			for _, v := range vals {
+				typ, _ := m.parseEntry([]byte(v))
+				if typ == TypeDirectory {
+					attr.Nlink++
+				}
 			}
 		}
-		_, err = tx.TxPipelined(ctx, func(pipe redis.Pipeliner) error {
+		_, err := tx.TxPipelined(ctx, func(pipe redis.Pipeliner) error {
 			pipe.Set(ctx, m.inodeKey(inode), m.marshal(attr), 0)
 			m.genLog(ctx, pipe, time.Now(), "REPAIRDIR(%d,%s)", inode, attr.logFields())
 			return nil
@@ -5460,7 +5462,11 @@ func (m *redisMeta) doCloneEntry(ctx Context, srcIno Ino, parent Ino, name strin
 			m.genLog(ctx, p, now, "CLONE(%d,%d,%s,%d,%d,%d,%t,%d,%d):%d", srcIno, parent, logEncode2(name), ino, cmode, cumask, top, ctx.Uid(), ctx.Gid(), ino)
 			return nil
 		})
-		return err
+		if err != nil {
+			return err
+		}
+		*originAttr = attr
+		return nil
 	}, m.inodeKey(srcIno), m.xattrKey(srcIno)))
 }
 
```

**File**: `pkg/meta/sql.go` (modified, +12/-11)
```diff
@@ -4256,7 +4256,7 @@ func (m *dbMeta) scanPendingFiles(ctx Context, scan pendingFileScan) error {
 	return nil
 }
 
-func (m *dbMeta) doRepair(ctx Context, inode Ino, attr *Attr) syscall.Errno {
+func (m *dbMeta) doRepair(ctx Context, inode Ino, attr *Attr, trustNlink bool) syscall.Errno {
 	n := &node{
 		Inode:  inode,
 		Type:   attr.Typ,
@@ -4271,14 +4271,16 @@ func (m *dbMeta) doRepair(ctx Context, inode Ino, attr *Attr) syscall.Errno {
 	n.setMtime(attr.Mtime*1e9 + int64(attr.Mtimensec))
 	n.setCtime(attr.Ctime*1e9 + int64(attr.Ctimensec))
 	return errno(m.txn(func(s *xorm.Session) error {
-		n.Nlink = 2
-		var rows []edge
-		if err := s.Find(&rows, &edge{Parent: inode}); err != nil {
-			return err
-		}
-		for _, row := range rows {
-			if row.Type == TypeDirectory {
-				n.Nlink++
+		if !trustNlink {
+			n.Nlink = 2
+			var rows []edge
+			if err := s.Find(&rows, &edge{Parent: inode}); err != nil {
+				return err
+			}
+			for _, row := range rows {
+				if row.Type == TypeDirectory {
+					n.Nlink++
+				}
 			}
 		}
 		ok, err := s.ForUpdate().Get(&node{Inode: inode})
@@ -5594,9 +5596,8 @@ func (m *dbMeta) doCloneEntry(ctx Context, srcIno Ino, parent Ino, name string,
 			if err := mustInsert(s, &sym); err != nil {
 				return err
 			}
-			m.genLog(ctx, s, now.UnixNano(), "CLONE(%d,%d,%s,%d,%d,%d,%t,%d,%d):%d", srcIno, parent, logEncode2(name), ino, cmode, cumask, top, ctx.Uid(), ctx.Gid(), ino)
-			return nil
 		}
+		m.parseAttr(&n, attr)
 		m.genLog(ctx, s, now.UnixNano(), "CLONE(%d,%d,%s,%d,%d,%d,%t,%d,%d):%d", srcIno, parent, logEncode2(name), ino, cmode, cumask, top, ctx.Uid(), ctx.Gid(), ino)
 		return nil
 	}, srcIno))
```

**File**: `pkg/meta/tkv.go` (modified, +12/-9)
```diff
@@ -3399,17 +3399,19 @@ func (m *kvMeta) scanPendingFiles(ctx Context, scan pendingFileScan) error {
 	return scanErr
 }
 
-func (m *kvMeta) doRepair(ctx Context, inode Ino, attr *Attr) syscall.Errno {
+func (m *kvMeta) doRepair(ctx Context, inode Ino, attr *Attr, trustNlink bool) syscall.Errno {
 	prefix := m.entryKey(inode, "")
 	return errno(m.txn(ctx, func(tx *kvTxn) error {
-		attr.Nlink = 2
-		tx.scan(prefix, nextKey(prefix), false, func(k, v []byte) bool {
-			typ, _ := m.parseEntry(v)
-			if typ == TypeDirectory {
-				attr.Nlink++
-			}
-			return true
-		})
+		if !trustNlink {
+			attr.Nlink = 2
+			tx.scan(prefix, nextKey(prefix), false, func(k, v []byte) bool {
+				typ, _ := m.parseEntry(v)
+				if typ == TypeDirectory {
+					attr.Nlink++
+				}
+				return true
+			})
+		}
 		tx.set(m.inodeKey(inode), m.marshal(attr))
 		m.genLog(tx, time.Now(), "REPAIRDIR(%d,%s)", inode, attr.logFields())
 		return nil
@@ -4554,6 +4556,7 @@ func (m *kvMeta) doCloneEntry(ctx Context, srcIno Ino, parent Ino, name string,
 		case TypeSymlink:
 			tx.set(m.symKey(ino), tx.get(m.symKey(srcIno)))
 		}
+		*originAttr = attr
 		m.genLog(tx, now, "CLONE(%d,%d,%s,%d,%d,%d,%t,%d,%d):%d", srcIno, parent, logEncode2(name), ino, cmode, cumask, top, ctx.Uid(), ctx.Gid(), ino)
 		return nil
 	}, srcIno))
```

---

### Incident Patch 6: `ae895658` (2026-09-21)
**Commit Message**: deps: update minio to require signed x-amz headers (#7562)

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -346,7 +346,7 @@ require (
 	xorm.io/builder v0.3.13 // indirect
 )
 
-replace github.com/minio/minio v0.0.0-20210206053228-97fe57bba92c => github.com/juicedata/minio v0.0.0-20260515071949-69a6cfc9da65
+replace github.com/minio/minio v0.0.0-20210206053228-97fe57bba92c => github.com/juicedata/minio v0.0.0-20260915033819-47296b1b89b0
 
 replace github.com/hanwen/go-fuse/v2 v2.1.1-0.20210611132105-24a1dfe6b4f8 => github.com/juicedata/go-fuse/v2 v2.1.1-0.20260819084346-22b3157c2d7f
 
```

**File**: `go.sum` (modified, +2/-2)
```diff
@@ -503,8 +503,8 @@ github.com/juicedata/golang-lru/v2 v2.0.8-0.20251126062551-1b321869f904 h1:oNtkL
 github.com/juicedata/golang-lru/v2 v2.0.8-0.20251126062551-1b321869f904/go.mod h1:qnbgnNzfydwuHjSCApF4bdul+tZ8T3y1MkZG/OFczLA=
 github.com/juicedata/huaweicloud-sdk-go-obs v3.22.12-0.20230228031208-386e87b5c091+incompatible h1:2/ttSmYoX+QMegpNyAJR0Y6aHcVk57F7RJit5xN2T/s=
 github.com/juicedata/huaweicloud-sdk-go-obs v3.22.12-0.20230228031208-386e87b5c091+incompatible/go.mod h1:Ukwa8ffRQLV6QRwpqGioPjn2Wnf7TBDA4DbennDOqHE=
-github.com/juicedata/minio v0.0.0-20260515071949-69a6cfc9da65 h1:u+3ehBnL0r3uQloSRQ6QlY2vffBptFSSN6EeCJqgirE=
-github.com/juicedata/minio v0.0.0-20260515071949-69a6cfc9da65/go.mod h1:1/4WHQKDOsWA1dd3ADrq9IE/jtFec9MHLy656kIXjNg=
+github.com/juicedata/minio v0.0.0-20260915033819-47296b1b89b0 h1:EH7fo8uJT/gHAsR9TEGpKCfwP30w8i1NYPy1CgH7PRo=
+github.com/juicedata/minio v0.0.0-20260915033819-47296b1b89b0/go.mod h1:1/4WHQKDOsWA1dd3ADrq9IE/jtFec9MHLy656kIXjNg=
 github.com/juicedata/mpb/v7 v7.0.4-0.20231024073412-2b8d31be510b h1:0/6suPNZnrOlRlBaU/Bnitu8HiKkkLSzQhHbwQ9AysM=
 github.com/juicedata/mpb/v7 v7.0.4-0.20231024073412-2b8d31be510b/go.mod h1:NXGsfPGx6G2JssqvEcULtDqUrxuuYs4llpv8W6ZUpzk=
 github.com/juicedata/xorm v1.4.2-0.20260909084754-f6c8d2b84ec2 h1:j1Ngfz6mtEA8YUhhN3ULLz9UNprl5HLv0SKxsN5cvEY=
```

---

### Incident Patch 7: `51c657c7` (2026-09-21)
**Commit Message**: chunk: fix zstd decompression overwriting adjacent slices (#7556)

Co-authored-by: Claude <[REDACTED_EMAIL]>
Co-authored-by: jiefenghuang <[REDACTED_EMAIL]>

**File**: `pkg/compress/compress.go` (modified, +14/-4)
```diff
@@ -92,14 +92,24 @@ func (n ZStandard) Compress(dst, src []byte) (int, error) {
 
 // Decompress using Zstd
 func (n ZStandard) Decompress(dst, src []byte) (int, error) {
-	d, err := zstd.Decompress(dst, src)
+	if len(src) == 0 {
+		return 0, fmt.Errorf("decompress an empty input")
+	}
+	// Use DecompressInto to limit writes to len(dst), not cap(dst).
+	out := dst
+	if len(out) == 0 {
+		// libzstd needs a non-empty output, even for an empty frame
+		var scratch [1]byte
+		out = scratch[:]
+	}
+	written, err := zstd.DecompressInto(out, src)
 	if err != nil {
 		return 0, err
 	}
-	if len(d) > 0 && len(dst) > 0 && &d[0] != &dst[0] {
-		return 0, fmt.Errorf("buffer too short: %d < %d", len(dst), len(d))
+	if written > len(dst) {
+		return 0, fmt.Errorf("buffer too short: %d < %d", len(dst), written)
 	}
-	return len(d), err
+	return written, nil
 }
 
 // LZ4 implements Compressor using LZ4 library
```

**File**: `pkg/compress/compress_test.go` (modified, +64/-0)
```diff
@@ -17,7 +17,10 @@
 package compress
 
 import (
+	"bytes"
+	"fmt"
 	"io"
+	"math/rand"
 	"os"
 	"testing"
 )
@@ -149,3 +152,64 @@ func BenchmarkCompressCLZ4(b *testing.B) {
 func BenchmarkCompressNone(b *testing.B) {
 	benchmarkCompress(b, NewCompressor("none"))
 }
+
+// A block is often decompressed into a sub-slice of a larger buffer: the
+// reader serves one read-ahead buffer to several slices of a chunk at once,
+// handing each of them a Page.Slice of it. Decompression must stay inside the
+// requested output, or it corrupts the data of whatever shares that buffer.
+func TestDecompressStaysInsideDst(t *testing.T) {
+	// > 128 KiB of literal-heavy but compressible data (random hex with a
+	// repeating prefix), so zstd stages a whole block of literals inside the
+	// spare room after the output
+	r := rand.New(rand.NewSource(1))
+	var b bytes.Buffer
+	for b.Len() < 262005 {
+		fmt.Fprintf(&b, "%016x%016x\t%d\tsome/shared/prefix/dir/file-%d\n",
+			r.Uint64(), r.Uint64(), r.Intn(1<<20), b.Len())
+	}
+	data := b.Bytes()[:262005]
+
+	// a slice in the middle of a chunk is decompressed at a non-zero offset,
+	// with neighbours on both sides
+	for _, off := range []int{0, 4096} {
+		for _, algr := range []string{"zstd", "lz4"} {
+			c := NewCompressor(algr)
+			buf := make([]byte, c.CompressBound(len(data)))
+			n, err := c.Compress(buf, data)
+			if err != nil {
+				t.Fatalf("%s compress: %s", algr, err)
+			}
+			const guard = 1 << 20
+			big := make([]byte, off+len(data)+guard)
+			for i := range big {
+				big[i] = 0xA5
+			}
+			dst := big[off : off+len(data)]
+			if _, err = c.Decompress(dst, buf[:n]); err != nil {
+				t.Fatalf("%s decompress at offset %d: %s", algr, off, err)
+			}
+			if !bytes.Equal(dst, data) {
+				t.Fatalf("%s at offset %d: decompressed data differs", algr, off)
+			}
+			checkUntouched(t, algr, off, "before", big[:off])
+			checkUntouched(t, algr, off, "after", big[off+len(data):])
+		}
+	}
+}
+
+func checkUntouched(t *testing.T, algr string, off int, where string, neighbour []byte) {
+	t.Helper()
+	dirty, first := 0, -1
+	for i, b := range neighbour {
+		if b != 0xA5 {
+			if first < 0 {
+				first = i
+			}
+			dirty++
+		}
+	}
+	if dirty > 0 {
+		t.Fatalf("%s at offset %d: wrote %d bytes %s the requested output, first at %d",
+			algr, off, dirty, where, first)
+	}
+}
```

---

### Incident Patch 8: `99935945` (2026-09-16)
**Commit Message**: meta: rebuild counters from load binary backup records (#7538)

Co-authored-by: jiefenghuang <[REDACTED_EMAIL]>
Signed-off-by: Xuhui zhang <[REDACTED_EMAIL]>
Signed-off-by: jiefenghuang <[REDACTED_EMAIL]>

**File**: `pkg/meta/backup.go` (modified, +76/-2)
```diff
@@ -419,8 +419,9 @@ func dumpResult(ctx context.Context, ch chan<- *dumpedResult, res *dumpedResult)
 }
 
 type LoadOption struct {
-	Threads  int
-	Progress func(name string, cnt int)
+	Threads         int
+	Progress        func(name string, cnt int)
+	rebuildCounters bool // set by prepareLoad, redis doesn't rebuild counters for now
 }
 
 func (opt *LoadOption) check() {
@@ -429,6 +430,79 @@ func (opt *LoadOption) check() {
 	}
 }
 
+func (c *DumpedCounters) updateFromSegment(seg *BakSegment, others *[]*pb.Counter) bool {
+	recordInode := func(inode uint64) {
+		if Ino(inode) < TrashInode {
+			c.NextInode = max(c.NextInode, int64(inode)+1)
+		} else {
+			c.NextTrash = max(c.NextTrash, int64(Ino(inode)-TrashInode))
+		}
+	}
+	switch seg.typ {
+	case segTypeCounter:
+		for _, counter := range seg.val.(*pb.Batch).Counters {
+			switch counter.Key {
+			case "nextInode":
+				c.NextInode = max(c.NextInode, counter.Value)
+			case "nextChunk":
+				c.NextChunk = max(c.NextChunk, counter.Value)
+			case "nextSession":
+				c.NextSession = max(c.NextSession, counter.Value)
+			case "nextTrash":
+				c.NextTrash = max(c.NextTrash, counter.Value)
+			case usedSpace, totalInodes:
+			default:
+				*others = append(*others, counter)
+			}
+		}
+		return true
+	case segTypeNode:
+		var attr Attr
+		for _, node := range seg.val.(*pb.Batch).Nodes {
+			recordInode(node.Inode)
+			if Ino(node.Inode) != RootInode && Ino(node.Inode) != TrashInode {
+				attr.Unmarshal(node.Data)
+				c.UsedSpace += align4K(attr.Length)
+				c.UsedInodes++
+			}
+		}
+	case segTypeChunk:
+		for _, chunk := range seg.val.(*pb.Batch).Chunks {
+			recordInode(chunk.Inode)
+			for _, s := range readSliceBuf(chunk.Slices) {
+				c.NextChunk = max(c.NextChunk, int64(s.id)+1)
+			}
+		}
+	case segTypeSliceRef:
+		for _, ref := range seg.val.(*pb.Batch).SliceRefs {
+			c.NextChunk = max(c.NextChunk, int64(ref.Id)+1)
+		}
+	case segTypeSustained:
+		for _, sustained := range seg.val.(*pb.Batch).Sustained {
+			c.NextSession = max(c.NextSession, int64(sustained.Sid))
+			for _, inode := range sustained.Inodes {
+				recordInode(inode)
+			}
+		}
+	case segTypeDelFile:
+		for _, file := range seg.val.(*pb.Batch).Delfiles {
+			recordInode(file.Inode)
+		}
+	}
+	return false
+}
+
+func (c *DumpedCounters) toBatch(others []*pb.Counter) *pb.Batch {
+	return &pb.Batch{Counters: append(others,
+		&pb.Counter{Key: usedSpace, Value: c.UsedSpace},
+		&pb.Counter{Key: totalInodes, Value: c.UsedInodes},
+		&pb.Counter{Key: "nextInode", Value: c.NextInode},
+		&pb.Counter{Key: "nextChunk", Value: c.NextChunk},
+		&pb.Counter{Key: "nextSession", Value: c.NextSession},
+		&pb.Counter{Key: "nextTrash", Value: c.NextTrash},
+	)}
+}
+
 // transaction
 
 type txSessionKey struct{}
```

**File**: `pkg/meta/base.go` (modified, +26/-7)
```diff
@@ -37,6 +37,7 @@ import (
 	"time"
 
 	aclAPI "github.com/juicedata/juicefs/pkg/acl"
+	"github.com/juicedata/juicefs/pkg/meta/pb"
 	"github.com/juicedata/juicefs/pkg/object"
 	"github.com/juicedata/juicefs/pkg/utils"
 	"github.com/juicedata/juicefs/pkg/version"
@@ -4082,11 +4083,30 @@ func (m *baseMeta) LoadMetaV2(ctx Context, r io.Reader, opt *LoadOption) error {
 		go workerFunc(ctx, taskCh)
 	}
 
+	loaded := DumpedCounters{NextInode: 2, NextChunk: 1}
+	var counters []*pb.Counter
 	bak := &BakFormat{}
+
+	sendTask := func(t *task, name string, num int) bool {
+		select {
+		case <-ctx.Done():
+			return false
+		case taskCh <- t:
+			if opt.Progress != nil {
+				opt.Progress(name, num)
+			}
+			return true
+		}
+	}
+
 	for {
 		seg, err := bak.ReadSegment(r)
 		if err != nil {
 			if errors.Is(err, errBakEOF) {
+				if opt.rebuildCounters {
+					batch := loaded.toBatch(counters)
+					sendTask(&task{segTypeCounter, batch}, SegType2Name[segTypeCounter], len(batch.Counters))
+				}
 				close(taskCh)
 				break
 			}
@@ -4095,16 +4115,15 @@ func (m *baseMeta) LoadMetaV2(ctx Context, r io.Reader, opt *LoadOption) error {
 			return err
 		}
 
-		select {
-		case <-ctx.Done():
+		if opt.rebuildCounters && loaded.updateFromSegment(seg, &counters) {
+			continue
+		}
+
+		if !sendTask(&task{int(seg.typ), seg.val}, seg.Name(), int(seg.num())) {
 			wg.Wait()
 			return ctx.Err()
-		case taskCh <- &task{int(seg.typ), seg.val}:
-			if opt.Progress != nil {
-				opt.Progress(seg.Name(), int(seg.num()))
-			}
 		}
 	}
 	wg.Wait()
-	return nil
+	return ctx.Err()
 }
```

**File**: `pkg/meta/sql_bak.go` (modified, +1/-0)
```diff
@@ -904,6 +904,7 @@ func (m *dbMeta) insertRows(beans []interface{}) error {
 
 func (m *dbMeta) prepareLoad(ctx Context, opt *LoadOption) error {
 	opt.check()
+	opt.rebuildCounters = true
 	if err := m.checkAddr(); err != nil {
 		return err
 	}
```

**File**: `pkg/meta/tkv_bak.go` (modified, +26/-7)
```diff
@@ -706,6 +706,8 @@ func (m *kvMeta) LoadMetaV2(ctx Context, r io.Reader, opt *LoadOption) error {
 			if task == nil {
 				if err := m.insertKVs(ctx, pairs, opt.Threads); err != nil {
 					logger.Errorf("insert kvs failed: %v", err)
+					ctx.Cancel()
+					return
 				}
 
 				if maxAclId != 0 {
@@ -714,6 +716,8 @@ func (m *kvMeta) LoadMetaV2(ctx Context, r io.Reader, opt *LoadOption) error {
 						return nil
 					}); err != nil {
 						logger.Errorf("update maxAclId failed: %v", err)
+						ctx.Cancel()
+						return
 					}
 				}
 				break
@@ -762,29 +766,44 @@ func (m *kvMeta) LoadMetaV2(ctx Context, r io.Reader, opt *LoadOption) error {
 	wg.Add(1)
 	go workerFunc(ctx, taskCh)
 
+	loaded := DumpedCounters{NextInode: 2, NextChunk: 1}
+	var counters []*pb.Counter
 	bak := &BakFormat{}
+
+	sendTask := func(t *task, name string, num int) bool {
+		select {
+		case <-ctx.Done():
+			return false
+		case taskCh <- t:
+			if opt.Progress != nil {
+				opt.Progress(name, num)
+			}
+			return true
+		}
+	}
+
 	for {
 		seg, err := bak.ReadSegment(r)
 		if err != nil {
 			if errors.Is(err, errBakEOF) {
+				batch := loaded.toBatch(counters)
+				sendTask(&task{segTypeCounter, batch}, SegType2Name[segTypeCounter], len(batch.Counters))
 				close(taskCh)
 				break
 			}
 			ctx.Cancel()
 			wg.Wait()
 			return err
 		}
+		if loaded.updateFromSegment(seg, &counters) {
+			continue
+		}
 
-		select {
-		case <-ctx.Done():
+		if !sendTask(&task{int(seg.typ), seg.val}, seg.Name(), int(seg.num())) {
 			wg.Wait()
 			return ctx.Err()
-		case taskCh <- &task{int(seg.typ), seg.val}:
-			if opt.Progress != nil {
-				opt.Progress(seg.Name(), int(seg.num()))
-			}
 		}
 	}
 	wg.Wait()
-	return nil
+	return ctx.Err()
 }
```

---

### Incident Patch 9: `277570a3` (2026-09-15)
**Commit Message**: Revert "feat(gateway): support If-None-Match wildcard" (#7539)

**File**: `docs/en/administration/changelog.md` (modified, +0/-2)
```diff
@@ -93,8 +93,6 @@ Example:
 103: 1716440760.000000000|UNLINK(1,report.txt,0,false,true):1024|(3,90)
 ```
 
-Directory object updates made by the S3 Gateway use a single `SETDIRMARKER(inode,ctime,ctimensec,xattrs)` record. The operation sets the directory's atime and atimensec to zero and applies all listed extended attributes together. The `xattrs` argument is percent-escaped JSON: values are base64-encoded bytes, `null` removes an attribute, and omitted names remain unchanged. External consumers must handle this operation before processing changelogs from gateways that use atomic directory marker updates. The stored inode and xattr formats are unchanged.
-
 ## Notes and limitations {#notes}
 
 - The changelog is not a metadata backup. Use [metadata backup](metadata_dump_load.md) for backup and restore.
```

**File**: `docs/en/guide/gateway.md` (modified, +0/-8)
```diff
@@ -21,14 +21,6 @@ Common application scenarios for JuiceFS S3 Gateway include:
 - **Managing files in JuiceFS:** JuiceFS S3 Gateway provides a web-based file manager to manage files in JuiceFS directly from a browser.
 - **Cluster replication:** In scenarios requiring cross-cluster data replication, JuiceFS S3 Gateway serves as a unified data export for clusters. This avoids cross-region metadata access and enhances data transfer performance. For details, see [Sync across regions using JuiceFS S3 Gateway](../guide/sync.md#sync-across-region).
 
-## Conditional directory objects
-
-A zero-byte object whose key ends in `/` is represented by a directory with an explicit object marker. Uploading `prefix/child.txt` creates the parent directory, but does not create the S3 object `prefix/`.
-
-With the default `--head-dir=false`, a `PUT prefix/` or a zero-byte copy to `prefix/` with `If-None-Match: *` can create the marker on this existing directory. The gateway preserves the directory inode and children, and commits the marker and its managed extended attributes in one metadata transaction. Concurrent conditional creators have one winner; subsequent requests return `412 Precondition Failed` without changing the object.
-
-When `--head-dir` is enabled, implicit directories are exposed as existing objects, so the same conditional request returns `412`. Without the conditional header, a zero-byte copy to `prefix/` creates or overwrites the directory object while preserving existing children. Directory objects must have an empty body.
-
 ## Quick start
 
 JuiceFS S3 Gateway enables access to an existing JuiceFS volume. If you do not have one, follow the steps in this [guide](../getting-started/standalone.md) to create a JuiceFS file system.
```

**File**: `docs/zh_cn/administration/changelog.md` (modified, +0/-2)
```diff
@@ -93,8 +93,6 @@ VERSION: UNIX_SECONDS.NANOSECONDS|OPERATION(arguments)[:result]|(SESSION_ID,TXN_
 103: 1716440760.000000000|UNLINK(1,report.txt,0,false,true):1024|(3,90)
 ```
 
-S3 网关更新目录对象时使用单条 `SETDIRMARKER(inode,ctime,ctimensec,xattrs)` 记录。该操作将目录的 atime 和 atimensec 设为零，并一并更新列出的扩展属性。`xattrs` 参数为经过百分号转义的 JSON，属性值使用 base64 编码，`null` 表示删除，未列出的属性保持不变。外部消费者在处理使用原子目录标记更新的网关所产生的日志前，需要支持该操作。inode 和扩展属性的存储格式不变。
-
 ## 使用建议和限制 {#notes}
 
 - changelog 不是元数据备份。备份和恢复应使用[元数据备份](metadata_dump_load.md)。
```

**File**: `docs/zh_cn/guide/gateway.md` (modified, +0/-8)
```diff
@@ -21,14 +21,6 @@ JuiceFS S3 网关的常见的使用场景有：
 - **管理 JuiceFS 中的文件**：S3 网关提供了一个基于网页的文件管理器，可以在浏览器中管理 JuiceFS 中的文件；
 - **集群复制**：在跨集群复制数据的场景下，作为集群的统一数据出口，避免跨区访问元数据以提升数据传输性能，详见[「使用 S3 网关进行跨区域数据同步」](../guide/sync.md#sync-across-region)
 
-## 目录对象的条件写入
-
-键名以 `/` 结尾的零字节对象，在 JuiceFS 中由带有显式对象标记的目录表示。上传 `prefix/child.txt` 会自动创建父目录，但不会创建 S3 对象 `prefix/`。
-
-默认 `--head-dir=false` 时，可以通过带有 `If-None-Match: *` 的 `PUT prefix/` 或向 `prefix/` 复制零字节对象，为已有目录创建对象标记。网关保留目录 inode 和子文件，并在一次元数据事务中提交对象标记及相关扩展属性。并发条件创建只有一个请求成功，后续请求返回 `412 Precondition Failed`，且不会修改已有对象。
-
-启用 `--head-dir` 时，隐式目录也被视为已存在的对象，因此上述条件请求返回 `412`。不带条件头时，向 `prefix/` 复制零字节对象会创建或覆盖目录对象，并保留已有子文件。目录对象的请求体必须为空。
-
 ## 快速开始
 
 启动 S3 网关需要一个已经创建完毕的 JuiceFS 文件系统，如果尚不存在，请参考[文档](../getting-started/standalone.md)来创建。下方假定元数据引擎 URL 为 `redis://localhost:6379/1`。
```

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -346,7 +346,7 @@ require (
 	xorm.io/builder v0.3.13 // indirect
 )
 
-replace github.com/minio/minio v0.0.0-20210206053228-97fe57bba92c => github.com/juicedata/minio v0.0.0-20260910033240-f2266df40f17
+replace github.com/minio/minio v0.0.0-20210206053228-97fe57bba92c => github.com/juicedata/minio v0.0.0-20260515071949-69a6cfc9da65
 
 replace github.com/hanwen/go-fuse/v2 v2.1.1-0.20210611132105-24a1dfe6b4f8 => github.com/juicedata/go-fuse/v2 v2.1.1-0.20260819084346-22b3157c2d7f
 
```

**File**: `go.sum` (modified, +0/-2)
```diff
@@ -505,8 +505,6 @@ github.com/juicedata/huaweicloud-sdk-go-obs v3.22.12-0.20230228031208-386e87b5c0
 github.com/juicedata/huaweicloud-sdk-go-obs v3.22.12-0.20230228031208-386e87b5c091+incompatible/go.mod h1:Ukwa8ffRQLV6QRwpqGioPjn2Wnf7TBDA4DbennDOqHE=
 github.com/juicedata/minio v0.0.0-20260515071949-69a6cfc9da65 h1:u+3ehBnL0r3uQloSRQ6QlY2vffBptFSSN6EeCJqgirE=
 github.com/juicedata/minio v0.0.0-20260515071949-69a6cfc9da65/go.mod h1:1/4WHQKDOsWA1dd3ADrq9IE/jtFec9MHLy656kIXjNg=
-github.com/juicedata/minio v0.0.0-20260910033240-f2266df40f17 h1:PZFzmLxyPGwk/IKgLqr0SuO0P2MI9lq2dlmH0lIX2rQ=
-github.com/juicedata/minio v0.0.0-20260910033240-f2266df40f17/go.mod h1:1/4WHQKDOsWA1dd3ADrq9IE/jtFec9MHLy656kIXjNg=
 github.com/juicedata/mpb/v7 v7.0.4-0.20231024073412-2b8d31be510b h1:0/6suPNZnrOlRlBaU/Bnitu8HiKkkLSzQhHbwQ9AysM=
 github.com/juicedata/mpb/v7 v7.0.4-0.20231024073412-2b8d31be510b/go.mod h1:NXGsfPGx6G2JssqvEcULtDqUrxuuYs4llpv8W6ZUpzk=
 github.com/juicedata/xorm v1.4.2-0.20260909084754-f6c8d2b84ec2 h1:j1Ngfz6mtEA8YUhhN3ULLz9UNprl5HLv0SKxsN5cvEY=
```

**File**: `integration/Makefile` (modified, +2/-5)
```diff
@@ -2,11 +2,8 @@
 all: s3test webdav ioctl
 
 s3test:
-	@awscli_venv=$$(mktemp -d "$${TMPDIR:-/tmp}/juicefs-awscli.XXXXXX"); \
-	trap 'rm -rf "$$awscli_venv"' EXIT INT TERM; \
-	python3 -m venv "$$awscli_venv"; \
-	"$$awscli_venv/bin/pip" install awscli==1.44.73; \
-	PATH="$$awscli_venv/bin:$$PATH" bash s3gateway_test.sh
+	pip install awscli==1.27.153
+	bash s3gateway_test.sh
 
 webdav:
 	cd /home/travis/.m2/litmus-0.13 ; for i in "basic" "copymove" "http"; do sudo ./$${i} http://127.0.0.1:9009 root 1234; done
```

**File**: `integration/s3gateway_test.sh` (modified, +2/-409)
```diff
@@ -510,8 +510,8 @@ function test_list_objects() {
           test_function=${function}
           out=$($function)
           rv=$?
-          entry_count=$(echo "$out" | jq '((.Contents // []) | length) + ((.CommonPrefixes // []) | length)')
-          if [ $rv -eq 0 ] && [ "$entry_count" != "0" ]; then
+          output=$(echo "$out")
+          if [ $rv -eq 0 ] && [ "$output" != "" ]; then
               rv=1
               # since rv is 0, command passed, but didn't return expected value. In this case set the output
               out="list-objects with prefix is dir failed"
@@ -2163,409 +2163,6 @@ function test_object_tagging(){
     fi
     return $rv
 }
-
-function test_put_object_if_none_match() {
-    start_time=$(get_time)
-    test_function="put-object If-None-Match wildcard"
-    download_path="/tmp/juicefs-if-none-match-put-$$"
-
-    function="make_bucket"
-    bucket_name=$(make_bucket)
-    rv=$?
-    if [ $rv -ne 0 ]; then
-        out="${bucket_name}"
-    fi
-
-    if [ $rv -eq 0 ]; then
-        function="${AWS} s3api put-object --body ${MINT_DATA_DIR}/datafile-1-kB --bucket ${bucket_name} --key conditional-put --if-none-match '*'"
-        out=$(${AWS} s3api put-object --body "${MINT_DATA_DIR}/datafile-1-kB" --bucket "${bucket_name}" --key conditional-put --if-none-match '*' 2>&1)
-        rv=$?
-    fi
-
-    if [ $rv -eq 0 ]; then
-        function="${AWS} s3api put-object --body ${MINT_DATA_DIR}/datafile-1-b --bucket ${bucket_name} --key conditional-put --if-none-match '*'"
-        out=$(${AWS} s3api put-object --body "${MINT_DATA_DIR}/datafile-1-b" --bucket "${bucket_name}" --key conditional-put --if-none-match '*' 2>&1)
-        status=$?
-        if [ $status -eq 0 ] || [[ "$out" != *"PreconditionFailed"* ]]; then
-            rv=1
-            out="expected PreconditionFailed for existing object, got: ${out}"
-        fi
-    fi
-
-    if [ $rv -eq 0 ]; then
-        function="${AWS} s3api get-object --bucket ${bucket_name} --key conditional-put ${download_path}"
-        out=$(${AWS} s3api get-object --bucket "${bucket_name}" --key conditional-put "${download_path}" 2>&1)
-        rv=$?
-        if [ $rv -eq 0 ]; then
-            get_md5 "${download_path}"
-            if [ "$md5rt" != "$HASH_1_KB" ]; then
-                rv=1
-                out="failed conditional PUT changed the existing object"
-            fi
-        fi
-    fi
-
-    if [ $rv -eq 0 ]; then
-        function="${AWS} s3api put-object --bucket ${bucket_name} --key conditional-dir/ --if-none-match '*'"
-        out=$(${AWS} s3api put-object --bucket "${bucket_name}" --key conditional-dir/ --if-none-match '*' 2>&1)
-        rv=$?
-    fi
-
-    if [ $rv -eq 0 ]; then
-        out=$(${AWS} s3api put-object --bucket "${bucket_name}" --key conditional-dir/ --if-none-match '*' 2>&1)
-        status=$?
-        if [ $status -eq 0 ] || [[ "$out" != *"PreconditionFailed"* ]]; then
-            rv=1
-            out="expected PreconditionFailed for existing directory marker, got: ${out}"
-        fi
-    fi
-
-    if [ $rv -eq 0 ]; then
-        function="${AWS} s3api put-object --body ${MINT_DATA_DIR}/datafile-1-b --bucket ${bucket_name} --key conditional-implicit/child"
-        out=$(${AWS} s3api put-object --body "${MINT_DATA_DIR}/datafile-1-b" --bucket "${bucket_name}" --key conditional-implicit/child 2>&1)
-        rv=$?
-    fi
-
-    if [ $rv -eq 0 ]; then
-        function="${AWS} s3api put-object --bucket ${bucket_name} --key conditional-implicit/ --if-none-match '*'"
-        out=$(${AWS} s3api put-object --bucket "${bucket_name}" --key conditional-implicit/ --if-none-match '*' 2>&1)
-        status=$?
-        if [ $status -ne 0 ]; then
-            rv=1
-            out="expected successful conditional implicit directory promotion, got: ${out}"
-        fi
-    fi
-
-    if [ $rv -eq 0 ]; then
-        function="${AWS} s3api get-object --bucket ${bucket_name} --key conditional-implicit/child ${download_path}"
-        out=$(${AWS} s3api get-object --bucket "${bucket_name}" --key conditional-implicit/child "${download_path}" 2>&1)
-        rv=$?
-        if [ $rv -eq 0 ]; then
-            get_md5 "${MINT_DATA_DIR}/datafile-1-b"
-            expected_hash=$md5rt
-            get_md5 "${download_path}"
-            if [ "$md5rt" != "$expected_hash" ]; then
-                rv=1
-                out="conditional directory PUT changed the child"
-            fi
-        fi
-    fi
-
-    rm -f "${download_path}"
-    if [ $rv -eq 0 ]; then
-        out=$(delete_bucket "${bucket_name}")
-        rv=$?
-    else
-        ${AWS} s3 rb s3://"${bucket_name}" --force > /dev/null 2>&1
-    fi
-
-    if [ $rv -eq 0 ]; then
-        log_success "$(get_duration "$start_time")" "${test_function}"
-    else
-        log_failure "$(get_duration "$start_time")" "${function}" "${out}"
-    fi
-    return $rv
-}
-
-function test_copy_object_if_none_match() {
-    start_time=$(get_time)
-    test_function="copy-object If
```

---

### Incident Patch 10: `34b8f398` (2026-09-15)
**Commit Message**: chunk: exit the fallback watchdog after switching to memory cache (#7505)

Co-authored-by: jiefenghuang <[REDACTED_EMAIL]>

**File**: `pkg/chunk/cached_store.go` (modified, +12/-10)
```diff
@@ -879,17 +879,19 @@ func NewCachedStore(storage object.ObjectStorage, config Config, reg prometheus.
 		}
 	})
 
-	go func() {
-		for {
-			if store.bcache.isEmpty() {
-				logger.Warn("cache store is empty, use memory cache")
-				config.CacheSize = 100 << 20
-				config.CacheDir = "memory"
-				store.bcache = newMemStore(&config, store.bcache.getMetrics())
+	if mgr, ok := store.bcache.(*cacheManager); ok {
+		fallbackConfig := config
+		fallbackConfig.CacheSize = 100 << 20
+		fallbackConfig.CacheDir = "memory"
+
+		go func() {
+			for !mgr.isEmpty() {
+				time.Sleep(time.Second)
 			}
-			time.Sleep(time.Second)
-		}
-	}()
+			logger.Warn("cache store is empty, use memory cache")
+			store.bcache = newMemStore(&fallbackConfig, mgr.getMetrics())
+		}()
+	}
 
 	if !config.CacheEnabled() {
 		config.Prefetch = 0 // disable prefetch if cache is disabled
```

---

### Incident Patch 11: `b27b68a4` (2026-09-15)
**Commit Message**: chunk: restore metrics for range read timeouts (#7520)

Signed-off-by: Changxin Miao <[REDACTED_EMAIL]>

**File**: `pkg/chunk/cached_store.go` (modified, +4/-1)
```diff
@@ -742,7 +742,7 @@ func (store *cachedStore) loadRange(ctx context.Context, key string, page *Page,
 		res = tmp
 	}
 	logRequest("GET", key, fmt.Sprintf("RANGE(%d,%d) ", off, len(p)), res.reqID, err, used)
-	if errors.Is(err, context.Canceled) || errors.Is(err, utils.ErrFuncTimeout) {
+	if errors.Is(err, context.Canceled) {
 		return 0, err
 	}
 	store.objectDataBytes.WithLabelValues("GET", res.sc).Add(float64(res.n))
@@ -752,6 +752,9 @@ func (store *cachedStore) loadRange(ctx context.Context, key string, page *Page,
 		return res.n, nil
 	}
 	store.objectReqErrors.Add(1)
+	if errors.Is(err, utils.ErrFuncTimeout) {
+		return 0, err
+	}
 	// fall back to full read
 	return 0, errTryFullRead
 }
```

---

### Incident Patch 12: `30387489` (2026-09-14)
**Commit Message**: CI: fix the MinIO image address (#7536)

Signed-off-by: miyang <[REDACTED_EMAIL]>

**File**: `.github/scripts/cache.sh` (modified, +1/-1)
```diff
@@ -559,7 +559,7 @@ prepare_test()
     fi
     rm -rf /var/jfs/myjfs || true
     rm -rf /var/jfsCache/myjfs || true
-    [[ ! -f /usr/local/bin/mc ]] && wget -q https://dl.minio.io/client/mc/release/linux-amd64/mc -O /usr/local/bin/mc && chmod +x /usr/local/bin/mc
+    [[ ! -f /usr/local/bin/mc ]] && .github/scripts/download_mc.sh linux-amd64 /usr/local/bin/mc && chmod +x /usr/local/bin/mc
     mc alias set myminio http://localhost:9000 minioadmin minioadmin
     mc rm --force --recursive myminio/test || true
 }
```

**File**: `.github/scripts/chaos/minio.yaml` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ spec:
     spec:
       containers:
       - name: minio
-        image: minio/minio
+        image: quay.io/minio/minio
         resources:
           limits:
             memory: "500Mi"
```

**File**: `.github/scripts/command-win/gateway.sh` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ source .github/scripts/common/common_win.sh
 [[ -z "$META_URL" ]] && META_URL=redis://127.0.0.1:6379/1
 
 
-wget https://dl.min.io/client/mc/release/windows-amd64/archive/mc.RELEASE.2021-04-22T17-40-00Z -O mc.exe
+wget https://github.com/minio/mc/releases/download/RELEASE.2021-04-22T17-40-00Z/mc.windows-amd64.RELEASE.2021-04-22T17-40-00Z.exe -O mc.exe
 chmod +x mc.exe
 export MINIO_ROOT_USER=admin
 export MINIO_ROOT_PASSWORD=admin123
```

**File**: `.github/scripts/command/Dockerfile.minio-old` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+# Package the official binary of the original reference server, without rebuilding it.
+FROM scratch
+ARG TARGETARCH
+ADD --chmod=755 https://github.com/minio/minio/releases/download/RELEASE.2021-04-22T15-44-28Z/minio.linux-${TARGETARCH}.RELEASE.2021-04-22T15-44-28Z /minio
+ENTRYPOINT ["/minio"]
```

**File**: `.github/scripts/command/config.sh` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@ LEGACY_META_URL=$META_URL
 if [[ "$META" == "redis" ]]; then
     LEGACY_META_URL=${META_URL%%\?*}
 fi
-[ ! -x mc ] && wget -q https://dl.minio.io/client/mc/release/linux-amd64/mc && chmod +x mc
+[ ! -x mc ] && .github/scripts/download_mc.sh linux-amd64 ./mc && chmod +x mc
 
 download_juicefs_client(){
     version=$1
```

**File**: `.github/scripts/command/dump_load.sh` (modified, +2/-2)
```diff
@@ -40,9 +40,9 @@ if ! docker ps | grep -q minio; then
             -e "MINIO_SECRET_KEY=minioadmin" \
             -v /tmp/data:/data \
             -v /tmp/config:/root/.minio \
-            minio/minio server /data
+            quay.io/minio/minio server /data
 fi
-[[ ! -f /usr/local/bin/mc ]] && wget -q https://dl.minio.io/client/mc/release/linux-amd64/mc -O /usr/local/bin/mc && chmod +x /usr/local/bin/mc
+[[ ! -f /usr/local/bin/mc ]] && .github/scripts/download_mc.sh linux-amd64 /usr/local/bin/mc && chmod +x /usr/local/bin/mc
 sleep 3s
 mc alias set myminio http://localhost:9000 minioadmin minioadmin
 python3 -c "import xattr" || sudo pip install xattr
```

**File**: `.github/scripts/command/dump_load_cross_meta.sh` (modified, +2/-2)
```diff
@@ -22,9 +22,9 @@ if ! docker ps | grep -q minio; then
             -e "MINIO_SECRET_KEY=minioadmin" \
             -v /tmp/data:/data \
             -v /tmp/config:/root/.minio \
-            minio/minio server /data
+            quay.io/minio/minio server /data
 fi
-[[ ! -f /usr/local/bin/mc ]] && wget -q https://dl.minio.io/client/mc/release/linux-amd64/mc -O /usr/local/bin/mc && chmod +x /usr/local/bin/mc
+[[ ! -f /usr/local/bin/mc ]] && .github/scripts/download_mc.sh linux-amd64 /usr/local/bin/mc && chmod +x /usr/local/bin/mc
 sleep 3s
 mc alias set myminio http://localhost:9000 minioadmin minioadmin
 [[ ! -x random-test ]] && wget -q https://juicefs-com-static.oss-cn-shanghai.aliyuncs.com/random-test/random-test -O random-test && chmod +x random-test
```

**File**: `.github/scripts/command/format.sh` (modified, +1/-1)
```diff
@@ -102,7 +102,7 @@ ensure_mc_binary()
             os_arch="linux-amd64"
         fi
     fi
-    wget -q "https://dl.min.io/client/mc/release/${os_arch}/mc" -O ./mc
+    .github/scripts/download_mc.sh "$os_arch" ./mc
     chmod +x ./mc
 }
 
```

---

### Incident Patch 13: `43aa5003` (2026-09-07)
**Commit Message**: chunk: synchronize staging cleanup after timeout (#7517)

Signed-off-by: jiefenghuang <[REDACTED_EMAIL]>
Co-authored-by: jiefenghuang <[REDACTED_EMAIL]>

**File**: `pkg/chunk/cached_store.go` (modified, +15/-6)
```diff
@@ -410,19 +410,28 @@ func (s *wSlice) upload(indx int) {
 		}
 		ctx := context.WithValue(context.Background(), object.TierKey{}, s.tierID)
 		if s.writeback && blen < s.store.conf.WritebackThresholdSize {
-			stagingPath := "unknown"
-			stageFailed := false
 			block.Acquire()
+			const (
+				stagePending int32 = iota
+				stageSucceeded
+				stageAbandoned
+			)
+			stagingPath := "unknown"
+			var stageState atomic.Int32
+			stageState.Store(stagePending)
 			err := utils.WithTimeout(context.TODO(), func(context.Context) (err error) { // In case it hangs for more than 5 minutes(see fileWriter.flush), fallback to uploading directly to avoid `EIO`
 				defer block.Release()
-				stagingPath, err = s.store.bcache.stage(key, block.Data, s.tierID)
-				if err == nil && stageFailed { // upload thread already marked me as failed because of timeout
+				var stageErr error
+				stagingPath, stageErr = s.store.bcache.stage(key, block.Data, s.tierID)
+				if stageErr == nil && !stageState.CompareAndSwap(stagePending, stageSucceeded) {
 					_ = s.store.bcache.removeStage(key)
 				}
-				return err
+				return stageErr
 			}, s.store.conf.PutTimeout)
 			if err != nil {
-				stageFailed = true
+				if !stageState.CompareAndSwap(stagePending, stageAbandoned) {
+					_ = s.store.bcache.removeStage(key)
+				}
 				if !errors.Is(err, errStageConcurrency) {
 					s.store.stageBlockErrors.Add(1)
 					logger.Warnf("write %s to disk: %s, upload it directly", key, err)
```

**File**: `pkg/chunk/cached_store_test.go` (modified, +72/-0)
```diff
@@ -31,6 +31,7 @@ import (
 	"testing"
 	"time"
 
+	"github.com/juicedata/juicefs/pkg/compress"
 	"github.com/juicedata/juicefs/pkg/object"
 	"github.com/stretchr/testify/assert"
 	"github.com/stretchr/testify/require"
@@ -181,6 +182,77 @@ func TestStoreSmallBuffer(t *testing.T) {
 	testStore(t, store)
 }
 
+type blockingStageCache struct {
+	CacheManager
+	started chan struct{}
+	release chan struct{}
+	removed chan string
+}
+
+func (c *blockingStageCache) cache(string, *Page, bool, bool) {}
+
+func (c *blockingStageCache) stage(string, []byte, uint8) (string, error) {
+	close(c.started)
+	<-c.release
+	return "late-stage", nil
+}
+
+func (c *blockingStageCache) removeStage(key string) error {
+	c.removed <- key
+	return nil
+}
+
+func TestWritebackStageTimeoutRemovesLateStage(t *testing.T) {
+	mem, err := object.CreateStorage("mem", "", "", "", "")
+	require.NoError(t, err)
+	cache := &blockingStageCache{
+		started: make(chan struct{}),
+		release: make(chan struct{}),
+		removed: make(chan string, 1),
+	}
+	conf := defaultConf
+	conf.Compress = "lz4"
+	conf.PutTimeout = 20 * time.Millisecond
+	conf.Writeback = true
+	conf.WritebackThresholdSize = conf.BlockSize + 1
+	store := &cachedStore{
+		storage:       mem,
+		conf:          conf,
+		bcache:        cache,
+		currentUpload: make(chan struct{}, 1),
+		compressor:    compress.NewCompressor(conf.Compress),
+	}
+	store.initMetrics()
+
+	writer := store.NewWriter(123, 0)
+	data := []byte("late")
+	_, err = writer.WriteAt(data, 0)
+	require.NoError(t, err)
+	done := make(chan error, 1)
+	go func() { done <- writer.Finish(len(data)) }()
+
+	select {
+	case <-cache.started:
+	case <-time.After(time.Second):
+		t.Fatal("stage did not start")
+	}
+	timer := time.AfterFunc(5*conf.PutTimeout, func() { close(cache.release) })
+	defer timer.Stop()
+
+	select {
+	case err = <-done:
+		require.NoError(t, err)
+	case <-time.After(time.Second):
+		t.Fatal("direct upload did not finish after stage timeout")
+	}
+	select {
+	case key := <-cache.removed:
+		require.Equal(t, "chunks/0/0/123_0_4", key)
+	case <-time.After(time.Second):
+		t.Fatal("late stage was not removed")
+	}
+}
+
 func TestStoreAsync(t *testing.T) {
 	mem, _ := object.CreateStorage("mem", "", "", "", "")
 	conf := defaultConf
```

---

### Incident Patch 14: `00f05c90` (2026-09-07)
**Commit Message**: meta: prevent timeout callbacks from overwriting caller state in stat and getattr (#7516)

Signed-off-by: jiefenghuang <[REDACTED_EMAIL]>
Co-authored-by: jiefenghuang <[REDACTED_EMAIL]>

**File**: `pkg/meta/base.go` (modified, +14/-14)
```diff
@@ -1178,22 +1178,21 @@ func (m *baseMeta) StatFS(ctx Context, ino Ino, totalspace, availspace, iused, i
 
 func (m *baseMeta) statRootFs(ctx Context, totalspace, availspace, iused, iavail *uint64) syscall.Errno {
 	used, inodes := atomic.LoadInt64(&m.usedSpace), atomic.LoadInt64(&m.usedInodes)
-	var err error
 	if !m.conf.FastStatfs || used == unknownUsage || inodes == unknownUsage {
-		var remoteUsed int64 // using an additional variable here to ensure the assignment inside `utils.WithTimeout` does not change the `used` variable again after a timeout.
-		err = utils.WithTimeout(ctx, func(context.Context) error {
-			remoteUsed, err = m.en.getCounter(usedSpace)
-			return err
-		}, time.Millisecond*150)
-		if err == nil {
+		var remoteUsed int64 // avoid race
+		if err := utils.WithTimeout(ctx, func(context.Context) error {
+			var getErr error
+			remoteUsed, getErr = m.en.getCounter(usedSpace)
+			return getErr
+		}, time.Millisecond*150); err == nil {
 			used = remoteUsed
 		}
 		var remoteInodes int64
-		err = utils.WithTimeout(ctx, func(context.Context) error {
-			remoteInodes, err = m.en.getCounter(totalInodes)
-			return err
-		}, time.Millisecond*150)
-		if err == nil {
+		if err := utils.WithTimeout(ctx, func(context.Context) error {
+			var getErr error
+			remoteInodes, getErr = m.en.getCounter(totalInodes)
+			return getErr
+		}, time.Millisecond*150); err == nil {
 			inodes = remoteInodes
 		}
 	}
@@ -1454,11 +1453,12 @@ func (m *baseMeta) GetAttr(ctx Context, inode Ino, attr *Attr) syscall.Errno {
 	if inode == RootInode || inode == TrashInode {
 		// doGetAttr could overwrite the `attr` after timeout
 		var a Attr
+		var attrErr syscall.Errno
 		e := utils.WithTimeout(ctx, func(context.Context) error {
-			err = m.en.doGetAttr(ctx, inode, &a)
+			attrErr = m.en.doGetAttr(ctx, inode, &a)
 			return nil
 		}, time.Millisecond*300)
-		if e == nil && err == 0 {
+		if e == nil && attrErr == 0 {
 			*attr = a
 		} else {
 			err = 0
```

---

### Incident Patch 15: `4da0beda` (2026-09-03)
**Commit Message**: utils: avoid racing callback results in WithTimeout (#7503)

Co-authored-by: Copilot <[REDACTED_EMAIL]>

**File**: `pkg/utils/utils.go` (modified, +9/-12)
```diff
@@ -108,25 +108,22 @@ func FindLocalIPs(allowedInterfaces ...string) ([]net.IP, error) {
 }
 
 func WithTimeout(pCtx context.Context, f func(context.Context) error, timeout time.Duration) error {
-	var done = make(chan int, 1)
-	var t = time.NewTimer(timeout)
-	var err error
+	done := make(chan error, 1)
+	t := time.NewTimer(timeout)
 	ctx, cancel := context.WithCancel(pCtx)
+	defer cancel()
+	defer t.Stop()
 	go func() {
-		err = f(ctx)
-		done <- 1
+		done <- f(ctx)
 	}()
 	select {
 	case <-ctx.Done():
-		err = ctx.Err()
-		t.Stop()
-	case <-done:
-		t.Stop()
+		return ctx.Err()
+	case err := <-done:
+		return err
 	case <-t.C:
-		err = fmt.Errorf("timeout after %s: %w", timeout, ErrFuncTimeout)
+		return fmt.Errorf("timeout after %s: %w", timeout, ErrFuncTimeout)
 	}
-	cancel()
-	return err
 }
 
 func RemovePassword(uri string) string {
```

**File**: `pkg/utils/utils_test.go` (modified, +32/-0)
```diff
@@ -115,6 +115,38 @@ func TestTimeout(t *testing.T) {
 	}
 }
 
+func TestWithTimeoutCancelResultRace(t *testing.T) {
+	ctx, cancel := context.WithCancel(context.Background())
+	started := make(chan struct{})
+	release := make(chan struct{})
+	callbackReturning := make(chan struct{})
+
+	result := make(chan error, 1)
+	go func() {
+		result <- WithTimeout(ctx, func(ctx context.Context) error {
+			close(started)
+			<-ctx.Done()
+			<-release
+			// Let the cancellation branch return before publishing the callback result.
+			time.Sleep(10 * time.Millisecond)
+			close(callbackReturning)
+			return nil
+		}, time.Second)
+	}()
+
+	<-started
+	cancel()
+	close(release)
+	err := <-result
+	if err != context.Canceled {
+		t.Fatalf("canceled context should be returned: %s", err)
+	}
+
+	<-callbackReturning
+	// Give the callback goroutine time to publish its late result to the race detector.
+	time.Sleep(time.Millisecond)
+}
+
 func TestRemovePassword(t *testing.T) {
 	testCase := []struct {
 		uri      string
```

#### Recent Merged Pull Requests:
- **PR #7594** (2026-09-29): chunk: skip staging enqueue when writeback is disabled (@jiefenghuang)
- **PR #7593** (2026-09-29): CI: clean previous mounts before ACL metadata reset (@myangitzh)
- **PR #7592** (2026-09-29): object/sftp: pipeline write requests in Put (@jiefenghuang)
- **PR #7591** (2026-09-29): CI: exclude clone summary COST by column name (@myangitzh)
- **PR #7588** (2026-09-28): CI: force version-limit recovery in config test (@jiefenghuang)
- **PR #7587** (2026-09-28): CI: account for SQL rewind in changelog tests (@jiefenghuang)
- **PR #7586** (2026-09-28): CI: ignore summary duration in dump/load benchmark (@myangitzh)
- **PR #7585** (2026-09-28): CI: fix pysdk failed (@myangitzh)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
