# Forensic Learning Record (Deep Inspection): etcd-io/etcd

> **Canonical Artifact**: `07_PROJECT_LEARNING/etcd-io-etcd-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/etcd-io/etcd](https://github.com/etcd-io/etcd))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:53:57.406Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `etcd-io/etcd`
- **Description**: Distributed reliable key-value store for the most critical data of a distributed system
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 52327 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `api/etcdserverpb/util.go`
```
// Copyright 2026 The etcd Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package etcdserverpb

import "google.golang.org/protobuf/proto"

// Clone returns a deep copy of h, or an empty ResponseHeader if h is nil.
func (h *ResponseHeader) Clone() *ResponseHeader {
	if h == nil {
		return &ResponseHeader{}
	}
	return proto.Clone(h).(*ResponseHeader)
}

```

### Core Architecture Module: `client/pkg/fileutil/dir_unix.go`
```
// Copyright 2016 The etcd Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

//go:build !windows

package fileutil

import "os"

const (
	// PrivateDirMode grants owner to make/remove files inside the directory.
	PrivateDirMode = 0o700
)

// OpenDir opens a directory for syncing.
func OpenDir(path string) (*os.File, error) { return os.Open(path) }

```

### Core Architecture Module: `client/pkg/fileutil/dir_windows.go`
```
// Copyright 2016 The etcd Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

//go:build windows

package fileutil

import (
	"os"
	"syscall"
)

const (
	// PrivateDirMode grants owner to make/remove files inside the directory.
	PrivateDirMode = 0o777
)

// OpenDir opens a directory in windows with write access for syncing.
func OpenDir(path string) (*os.File, error) {
	fd, err := openDir(path)
	if err != nil {
		return nil, err
	}
	return os.NewFile(uintptr(fd), path), nil
}

func openDir(path string) (fd syscall.Handle, err error) {
	if len(path) == 0 {
		return syscall.InvalidHandle, syscall.ERROR_FILE_NOT_FOUND
	}
	pathp, err := syscall.UTF16PtrFromString(path)
	if err != nil {
		return syscall.InvalidHandle, err
	}
	access := uint32(syscall.GENERIC_READ | syscall.GENERIC_WRITE)
	sharemode := uint32(syscall.FILE_SHARE_READ | syscall.FILE_SHARE_WRITE)
	createmode := uint32(syscall.OPEN_EXISTING)
	fl := uint32(syscall.FILE_FLAG_BACKUP_SEMANTICS)
	return syscall.CreateFile(pathp, access, sharemode, nil, createmode, fl, 0)
}

```

### Core Architecture Module: `client/pkg/fileutil/doc.go`
```
// Copyright 2018 The etcd Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Package fileutil implements utility functions related to files and paths.
package fileutil

```

### Core Architecture Module: `client/pkg/fileutil/filereader.go`
```
// Copyright 2022 The etcd Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package fileutil

import (
	"bufio"
	"io"
	"io/fs"
	"os"
)

// FileReader is a wrapper of io.Reader. It also provides file info.
type FileReader interface {
	io.Reader
	FileInfo() (fs.FileInfo, error)
}

type fileReader struct {
	*os.File
}

func NewFileReader(f *os.File) FileReader {
	return &fileReader{f}
}

func (fr *fileReader) FileInfo() (fs.FileInfo, error) {
	return fr.Stat()
}

// FileBufReader is a wrapper of bufio.Reader. It also provides file info.
type FileBufReader struct {
	*bufio.Reader
	fi fs.FileInfo
}

func NewFileBufReader(fr FileReader) *FileBufReader {
	bufReader := bufio.NewReader(fr)
	fi, err := fr.FileInfo()
	if err != nil {
		// This should never happen.
		panic(err)
	}
	return &FileBufReader{bufReader, fi}
}

func (fbr *FileBufReader) FileInfo() fs.FileInfo {
	return fbr.fi
}

```

### Core Architecture Module: `client/pkg/fileutil/fileutil.go`
```
// Copyright 2015 The etcd Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package fileutil

import (
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"

	"go.uber.org/zap"

	"go.etcd.io/etcd/client/pkg/v3/verify"
)

const (
	// PrivateFileMode grants owner to read/write a file.
	PrivateFileMode = 0o600
)

// IsDirWriteable checks if dir is writable by writing and removing a file
// to dir. It returns nil if dir is writable.
func IsDirWriteable(dir string) error {
	f, err := filepath.Abs(filepath.Join(dir, ".touch"))
	if err != nil {
		return err
	}
	if err := os.WriteFile(f, []byte(""), PrivateFileMode); err != nil {
		return err
	}
	return os.Remove(f)
}

// TouchDirAll is similar to os.MkdirAll. It creates directories with 0700 permission if any directory
// does not exists. TouchDirAll also ensures the given directory is writable.
func TouchDirAll(lg *zap.Logger, dir string) error {
	verify.Assert(lg != nil, "nil log isn't allowed")
	// If path is already a directory, MkdirAll does nothing and returns nil, so,
	// first check if dir exists with an expected permission mode.
	if Exist(dir) {
		err := CheckDirPermission(dir, PrivateDirMode)
		if err != nil {
			lg.Warn("check file permission", zap.Error(err))
		}
	} else {
		err := os.MkdirAll(dir, PrivateDirMode)
		if err != nil {
			// if mkdirAll("a/text") and "text" is not
			// a directory, this will return syscall.ENOTDIR
			return err
		}
	}

	return IsDirWriteable(dir)
}

// CreateDirAll is similar to TouchDirAll but returns error
// if the deepest directory was not empty.
func CreateDirAll(lg *zap.Logger, dir string) error {
	err := TouchDirAll(lg, dir)
	if err == nil {
		var ns []string
		ns, err = ReadDir(dir)
		if err != nil {
			return err
		}
		if len(ns) != 0 {
			err = fmt.Errorf("expected %q to be empty, got %q", dir, ns)
		}
	}
	return err
}

// Exist returns true if a file or directory exists.
func Exist(name string) bool {
	_, err := os.Stat(name)
	return err == nil
}

// DirEmpty returns true if a directory empty and can access.
func DirEmpty(name string) bool {
	ns, err := ReadDir(name)
	return len(ns) == 0 && err == nil
}

// ZeroToEnd zeros a file starting from SEEK_CUR to its SEEK_END. May temporarily
// shorten the length of the file.
func ZeroToEnd(f *os.File) error {
	// TODO: support FALLOC_FL_ZERO_RANGE
	off, err := f.Seek(0, io.SeekCurrent)
	if err != nil {
		return err
	}
	lenf, lerr := f.Seek(0, io.SeekEnd)
	if lerr != nil {
		return lerr
	}
	if err = f.Truncate(off); err != nil {
		return err
	}
	// make sure blocks remain allocated
	if err = Preallocate(f, lenf, true); err != nil {
		return err
	}
	_, err = f.Seek(off, io.SeekStart)
	return err
}

// CheckDirPermission checks permission on an existing dir.
// Returns error if dir is empty or exist with a different permission than specified.
func CheckDirPermission(dir string, perm os.FileMode) error {
	if !Exist(dir) {
		return fmt.Errorf("directory %q empty, cannot check permission", dir)
	}
	// check the existing permission on the directory
	dirInfo, err := os.Stat(dir)
	if err != nil {
		return err
	}
	dirMode := dirInfo.Mode().Perm()
	if dirMode != perm {
		err = fmt.Errorf("directory %q exist, but the permission is %q. The recommended permission is %q to prevent possible unprivileged access to the data", dir, dirInfo.Mode(), os.FileMode(PrivateDirMode))
		return err
	}
	return nil
}

// RemoveMatchFile deletes file if matchFunc is true on an existing dir
// Returns error if the dir does not exist or remove file fail
func RemoveMatchFile(lg *zap.Logger, dir string, matchFunc func(fileName string) bool) error {
	if lg == nil {
		lg = zap.NewNop()
	}
	if !Exist(dir) {
		return fmt.Errorf("directory %s does not exist", dir)
	}
	fileNames, err := ReadDir(dir)
	if err != nil {
		return err
	}
	var removeFailedFiles []string
	for _, fileName := range fileNames {
		if matchFunc(fileName) {
			file := filepath.Join(dir, fileName)
			if err = os.Remove(file); err != nil {
				removeFailedFiles = append(removeFailedFiles, fileName)
				lg.Error("remove file failed",
					zap.String("file", file),
					zap.Error(err))
			}
		}
	}
	if len(removeFailedFiles) != 0 {
		return fmt.Errorf("remove file(s) %v error", removeFailedFiles)
	}
	return nil
}

// ListFiles lists files if matchFunc is true on an existing dir
// Returns error if the dir does not exist
func ListFiles(dir string, matchFunc func(fileName string) bool) ([]string, error) {
	var files []string
	err := filepath.Walk(dir, func(path string, info fs.FileInfo, err error) error {
		if matchFunc(path) {
			files = append(files, path)
		}
		return nil
	})
	return files, err
}

```

### Core Architecture Module: `client/pkg/fileutil/lock.go`
```
// Copyright 2016 The etcd Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package fileutil

import (
	"errors"
	"os"
)

var ErrLocked = errors.New("fileutil: file already locked")

type LockedFile struct{ *os.File }

```

### Core Architecture Module: `client/pkg/fileutil/lock_flock.go`
```
// Copyright 2016 The etcd Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

//go:build !windows && !plan9 && !solaris

package fileutil

import (
	"errors"
	"os"
	"syscall"
)

func flockTryLockFile(path string, flag int, perm os.FileMode) (*LockedFile, error) {
	f, err := os.OpenFile(path, flag, perm)
	if err != nil {
		return nil, err
	}
	if err = syscall.Flock(int(f.Fd()), syscall.LOCK_EX|syscall.LOCK_NB); err != nil {
		f.Close()
		if errors.Is(err, syscall.EWOULDBLOCK) {
			err = ErrLocked
		}
		return nil, err
	}
	return &LockedFile{f}, nil
}

func flockLockFile(path string, flag int, perm os.FileMode) (*LockedFile, error) {
	f, err := os.OpenFile(path, flag, perm)
	if err != nil {
		return nil, err
	}
	if err = syscall.Flock(int(f.Fd()), syscall.LOCK_EX); err != nil {
		f.Close()
		return nil, err
	}
	return &LockedFile{f}, err
}

```

### Core Architecture Module: `client/pkg/fileutil/lock_linux.go`
```
// Copyright 2016 The etcd Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

//go:build linux

package fileutil

import (
	"errors"
	"fmt"
	"io"
	"os"
	"syscall"

	"golang.org/x/sys/unix"
)

// This used to call syscall.Flock() but that call fails with EBADF on NFS.
// An alternative is lockf() which works on NFS but that call lets a process lock
// the same file twice. Instead, use Linux's non-standard open file descriptor
// locks which will block if the process already holds the file lock.

var (
	wrlck = syscall.Flock_t{
		Type:   syscall.F_WRLCK,
		Whence: int16(io.SeekStart),
		Start:  0,
		Len:    0,
	}

	linuxTryLockFile = flockTryLockFile
	linuxLockFile    = flockLockFile
)

func init() {
	// use open file descriptor locks if the system supports it
	getlk := syscall.Flock_t{Type: syscall.F_RDLCK}
	if err := syscall.FcntlFlock(0, unix.F_OFD_GETLK, &getlk); err == nil {
		linuxTryLockFile = ofdTryLockFile
		linuxLockFile = ofdLockFile
	}
}

func TryLockFile(path string, flag int, perm os.FileMode) (*LockedFile, error) {
	return linuxTryLockFile(path, flag, perm)
}

func ofdTryLockFile(path string, flag int, perm os.FileMode) (*LockedFile, error) {
	f, err := os.OpenFile(path, flag, perm)
	if err != nil {
		return nil, fmt.Errorf("ofdTryLockFile failed to open %q (%w)", path, err)
	}

	flock := wrlck
	if err = syscall.FcntlFlock(f.Fd(), unix.F_OFD_SETLK, &flock); err != nil {
		f.Close()
		if errors.Is(err, syscall.EWOULDBLOCK) {
			err = ErrLocked
		}
		return nil, err
	}
	return &LockedFile{f}, nil
}

func LockFile(path string, flag int, perm os.FileMode) (*LockedFile, error) {
	return linuxLockFile(path, flag, perm)
}

func ofdLockFile(path string, flag int, perm os.FileMode) (*LockedFile, error) {
	f, err := os.OpenFile(path, flag, perm)
	if err != nil {
		return nil, fmt.Errorf("ofdLockFile failed to open %q (%w)", path, err)
	}

	flock := wrlck
	err = syscall.FcntlFlock(f.Fd(), unix.F_OFD_SETLKW, &flock)
	if err != nil {
		f.Close()
		return nil, err
	}
	return &LockedFile{f}, nil
}

```

### Core Architecture Module: `client/pkg/fileutil/lock_plan9.go`
```
// Copyright 2015 The etcd Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package fileutil

import (
	"os"
	"syscall"
	"time"
)

func TryLockFile(path string, flag int, perm os.FileMode) (*LockedFile, error) {
	if err := os.Chmod(path, syscall.DMEXCL|PrivateFileMode); err != nil {
		return nil, err
	}
	f, err := os.Open(path, flag, perm)
	if err != nil {
		return nil, ErrLocked
	}
	return &LockedFile{f}, nil
}

func LockFile(path string, flag int, perm os.FileMode) (*LockedFile, error) {
	if err := os.Chmod(path, syscall.DMEXCL|PrivateFileMode); err != nil {
		return nil, err
	}
	for {
		f, err := os.OpenFile(path, flag, perm)
		if err == nil {
			return &LockedFile{f}, nil
		}
		time.Sleep(10 * time.Millisecond)
	}
}

```

### Core Architecture Module: `client/pkg/fileutil/lock_solaris.go`
```
// Copyright 2015 The etcd Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

//go:build solaris

package fileutil

import (
	"os"
	"syscall"
)

func TryLockFile(path string, flag int, perm os.FileMode) (*LockedFile, error) {
	var lock syscall.Flock_t
	lock.Start = 0
	lock.Len = 0
	lock.Pid = 0
	lock.Type = syscall.F_WRLCK
	lock.Whence = 0
	lock.Pid = 0
	f, err := os.OpenFile(path, flag, perm)
	if err != nil {
		return nil, err
	}
	if err := syscall.FcntlFlock(f.Fd(), syscall.F_SETLK, &lock); err != nil {
		f.Close()
		if err == syscall.EAGAIN {
			err = ErrLocked
		}
		return nil, err
	}
	return &LockedFile{f}, nil
}

func LockFile(path string, flag int, perm os.FileMode) (*LockedFile, error) {
	var lock syscall.Flock_t
	lock.Start = 0
	lock.Len = 0
	lock.Pid = 0
	lock.Type = syscall.F_WRLCK
	lock.Whence = 0
	f, err := os.OpenFile(path, flag, perm)
	if err != nil {
		return nil, err
	}
	if err = syscall.FcntlFlock(f.Fd(), syscall.F_SETLKW, &lock); err != nil {
		f.Close()
		return nil, err
	}
	return &LockedFile{f}, nil
}

```

### Core Architecture Module: `client/pkg/fileutil/lock_unix.go`
```
// Copyright 2015 The etcd Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

//go:build !windows && !plan9 && !solaris && !linux

package fileutil

import (
	"os"
)

func TryLockFile(path string, flag int, perm os.FileMode) (*LockedFile, error) {
	return flockTryLockFile(path, flag, perm)
}

func LockFile(path string, flag int, perm os.FileMode) (*LockedFile, error) {
	return flockLockFile(path, flag, perm)
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #22531** (2026-10-05): **CHANGELOG(3.7,3.8): add NewJournalWriter deprecation and removal entries**
  *Symptoms*: Adds the changelog entries for deprecating and removing `logutil.NewJournalWriter`:  - `v3.7.3`: deprecated by #22530 on `release-3.7`. - `v3.8.0`: removed by #22502, so that `client/pkg/v3` no longer depends on `github.com/coreos/go-systemd/v22`.  AI usage: yes, AI tooling helped draft this change and description; the author reviewed and verified all of it. 
  **Post-Mortem & Fix Analysis**:
  > let's also add an item for changelog 3.8
  > ## [Codecov](https://app.codecov.io/gh/etcd-io/etcd/pull/22531?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=etcd-io) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 73.03%. Comparing base ([`91703b3`](https://app.codecov.io/gh/etcd-io/etcd/commit/91703b3d47f3208f9095f77f765c27cc1510ce9a?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=etcd-io)) to head ([`22585e0`](https://app.codecov.io/gh/etcd-io/etcd/commit/22585e0fb890141b0152fe543e0c833c44d0192c?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=etcd-io)). :warning: Report is 2 commits behind head on main.  <details><summary>Additional details and impacted files</summary>   [see 25 files with indirect coverage changes](https://app.codecov.io/gh/etcd-
  > [APPROVALNOTIFIER] This PR is **APPROVED**  This pull-request has been approved by: *<a href="https://github.com/etcd-io/etcd/pull/22531#pullrequestreview-5418053421" title="Approved">ahrtr</a>*, *<a href="https://github.com/etcd-io/etcd/pull/22531#" title="Author self-approved">dims</a>*  The full list of commands accepted by this bot can be found [here](https://go.k8s.io/bot-commands?repo=etcd-io%2Fetcd).  The pull request process is described [here](https://git.k8s.io/community/contributors/guide/owners.md#the-code-review-process)  <details > Needs approval from an approver in each of these files:  - ~~[OWNERS](https://github.com/etcd-io/etcd/blob/main/OWNERS)~~ [ahrtr]  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":[]} -->

- **Issue #22530** (2026-10-05): **[release-3.7] client/pkg: deprecate logutil.NewJournalWriter**
  *Symptoms*: Follow-up requested in https://github.com/etcd-io/etcd/pull/22502#discussion_r4134986304.  `logutil.NewJournalWriter` is the only user of `github.com/coreos/go-systemd/v22` in the `client/pkg/v3` module. Its only caller is the server's `--log-outputs=systemd/journal` sink in `server/embed`. #22502 moves the writer into `server/embed` and removes the exported function in v3.8, so that client packages no longer carry go-systemd in their module graph.  This PR marks the function as deprecated in 3.7, so that users get a staticcheck (SA1019) warning before the removal. The server call site in `server/embed/config_logging_journal_unix.go` keeps using it until v3.8, with a `nolint` comment.  No behavior change. The `CHANGELOG-3.7.md` entry on `main` follows in a separate PR.  AI usage: yes, AI tooling helped draft this change and description; the author reviewed and verified all of it. 
  **Post-Mortem & Fix Analysis**:
  > cc @ahrtr 
  > [APPROVALNOTIFIER] This PR is **APPROVED**  This pull-request has been approved by: *<a href="https://github.com/etcd-io/etcd/pull/22530#pullrequestreview-5416366483" title="Approved">ahrtr</a>*, *<a href="https://github.com/etcd-io/etcd/pull/22530#" title="Author self-approved">dims</a>*  The full list of commands accepted by this bot can be found [here](https://go.k8s.io/bot-commands?repo=etcd-io%2Fetcd).  The pull request process is described [here](https://git.k8s.io/community/contributors/guide/owners.md#the-code-review-process)  <details > Needs approval from an approver in each of these files:  - ~~[OWNERS](https://github.com/etcd-io/etcd/blob/release-3.7/OWNERS)~~ [ahrtr]  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":[]} -->
  > ## [Codecov](https://app.codecov.io/gh/etcd-io/etcd/pull/22530?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=etcd-io) Report :x: Patch coverage is `0%` with `1 line` in your changes missing coverage. Please review. :white_check_mark: Project coverage is 69.73%. Comparing base ([`68c065e`](https://app.codecov.io/gh/etcd-io/etcd/commit/68c065e562994b89e333e77b039ad066f933c586?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=etcd-io)) to head ([`4061804`](https://app.codecov.io/gh/etcd-io/etcd/commit/406180439ffd057f0561baa0599d13d7558d9642?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=etcd-io)).  | [Files with missing lines](https://app.codecov.io/gh/etcd-io/etcd/pull/22530?dropdown=coverage&src=pr&el=tree&utm_medium=referral&utm_source=github&utm_content=comment&utm_campai

- **Issue #22523** (2026-10-04): **cli: enforce context timeouts in lease commands**
  *Symptoms*: Commands within the lease module were utilizing ` context.TODO() ` for gRPC network calls, risking infinite hangs during network partitions. This commit applies a hybrid context patch based on RPC type:  1. Unary RPCs ( ` TimeToLive ` , ` Leases `, ` KeepAliveOnce ` ) are patched with ` commandCtx(cmd) ` to strictly enforce the CLI's global ` --command-timeout ` configuration, utilizing explicit early cancellation to prevent timer leaks during terminal output rendering.  2. The streaming RPC ( ` KeepAlive ` ) is patched with ` context.Background() ` to explicitly declare an infinite execution window without an artificial timeout, maintaining the intended continuous heartbeat behavior.
  **Post-Mortem & Fix Analysis**:
  > Hi @Aadeen. Thanks for your PR.  I'm waiting for a [etcd-io](https://github.com/orgs/etcd-io/people) member to verify that this patch is reasonable to test. If it is, they should reply with `/ok-to-test` on its own line. Until that is done, I will not automatically test new commits in this PR, but the usual testing commands by org members will still work.  Regular contributors should [join the org](https://github.com/etcd-io/etcd/blob/main/CONTRIBUTING.md) to skip this step.  Once the patch is verified, the new status will be reflected by the `ok-to-test` label.  I understand the commands that are listed [here](https://go.k8s.io/bot-commands?repo=etcd-io%2Fetcd).  <details>  Instructions for interacting with me using PR comments are available [here](https://git.k8s.io/community/contributors/guide/pull-requests.md).  If you have questions or suggestions related to my behavior, please file an issue against the [kubernetes-sigs/prow](https://github.com/kubernetes-sigs/prow/issues/new?titl
  > [APPROVALNOTIFIER] This PR is **APPROVED**  This pull-request has been approved by: *<a href="https://github.com/etcd-io/etcd/pull/22523#" title="Author self-approved">Aadeen</a>*, *<a href="https://github.com/etcd-io/etcd/pull/22523#pullrequestreview-5405356708" title="Approved">serathius</a>*  The full list of commands accepted by this bot can be found [here](https://go.k8s.io/bot-commands?repo=etcd-io%2Fetcd).  The pull request process is described [here](https://git.k8s.io/community/contributors/guide/owners.md#the-code-review-process)  <details > Needs approval from an approver in each of these files:  - ~~[OWNERS](https://github.com/etcd-io/etcd/blob/main/OWNERS)~~ [serathius]  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":[]} -->
  > /ok-to-test

- **Issue #22520** (2026-10-04): **verify: return error instead of panicking when WAL has no snapshot entries**
  *Symptoms*: ## Summary  Fixes #22519.  `validateWAL` in `server/verify/verify.go` indexed `walSnaps[len(walSnaps)-1]` without checking whether `wal.ValidSnapshotEntries` returned an empty, error-free slice. That slice is legitimately empty when every WAL segment holding a snapshot record is gone (e.g. an incomplete backup/restore, or WAL files pruned past what etcd's own retention would normally remove) while later entry-only segments survive. The missing bounds check caused an unrecovered panic (`index out of range [-1]`) instead of a clean error — which defeats the purpose of a tool whose entire job is to detect and cleanly report a damaged data directory.  `(w *WAL) LatestSnapshotEntry()` in `server/storage/wal/wal.go` already guards against this exact case:  ```go func (w *WAL) LatestSnapshotEntry() (*walpb.Snapshot, error) { 	walSnaps, err := ValidSnapshotEntries(w.lg, w.dir) 	if err != nil || len(walSnaps) == 0 { 		return &walpb.Snapshot{}, err 	} 	return walSnaps[len(walSnaps)-1], nil } ```  This PR adds the equivalent `len(walSnaps) == 0` check to `validateWAL`, returning a descriptive error instead of panicking.  - Before: `Verify()`/`etcdutl` would crash with an unrecovered Go panic on a damaged data directory. - After: `Verify()` returns a normal error (`"no valid snapshot entries found in WAL directory ..."`), which is logged and handled the same way as any other verification failure.  ## Test plan  - [x] Added `TestValidateWALReturnsErrorWithoutPanicWhenNoSnapshotEntriesSurv
  **Post-Mortem & Fix Analysis**:
  > [APPROVALNOTIFIER] This PR is **NOT APPROVED**  This pull-request has been approved by: *<a href="https://github.com/etcd-io/etcd/pull/22520#" title="Author self-approved">lokeshramchand-ctrl</a>* **Once this PR has been reviewed and has the lgtm label**, please assign [fuweid](https://github.com/fuweid) for approval. For more information see [the Code Review Process](https://git.k8s.io/community/contributors/guide/owners.md#the-code-review-process).  The full list of commands accepted by this bot can be found [here](https://go.k8s.io/bot-commands?repo=etcd-io%2Fetcd).  <details open> Needs approval from an approver in each of these files:  - **[OWNERS](https://github.com/etcd-io/etcd/blob/main/OWNERS)**  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":["fuweid"]} -->
  > Hi @lokeshramchand-ctrl. Thanks for your PR.  I'm waiting for a [etcd-io](https://github.com/orgs/etcd-io/people) member to verify that this patch is reasonable to test. If it is, they should reply with `/ok-to-test` on its own line. Until that is done, I will not automatically test new commits in this PR, but the usual testing commands by org members will still work.  Regular contributors should [join the org](https://github.com/etcd-io/etcd/blob/main/CONTRIBUTING.md) to skip this step.  Once the patch is verified, the new status will be reflected by the `ok-to-test` label.  I understand the commands that are listed [here](https://go.k8s.io/bot-commands?repo=etcd-io%2Fetcd).  <details>  Instructions for interacting with me using PR comments are available [here](https://git.k8s.io/community/contributors/guide/pull-requests.md).  If you have questions or suggestions related to my behavior, please file an issue against the [kubernetes-sigs/prow](https://github.com/kubernetes-sigs/prow/is
  > /assign @fuweid 

- **Issue #22519** (2026-10-04): **server/verify: validateWAL panics with index out of range when WAL has no valid snapshot entries**
  *Symptoms*: ### Bug report criteria  - [x] This bug report is not security related, security issues should be disclosed privately via the report form. - [x] This is not a support request or question. - [x] You have read the etcd bug reporting guidelines. - [x] Existing open issues along with the FAQ have been checked and this is not a duplicate.  ### What happened?  `server/verify/verify.go`'s `validateWAL` panics with `index out of range [-1]` when the WAL directory contains no valid snapshot record, instead of returning a descriptive error.  ```go func validateWAL(cfg Config) (*walpb.Snapshot, *raftpb.HardState, error) { 	walDir := datadir.ToWALDir(cfg.DataDir)  	walSnaps, err := wal2.ValidSnapshotEntries(cfg.Logger, walDir) 	if err != nil { 		return nil, nil, err 	}  	snapshot := walSnaps[len(walSnaps)-1] // <-- panics if walSnaps is empty 	hardstate, err := wal2.Verify(cfg.Logger, walDir, snapshot) 	... } ```  `wal.ValidSnapshotEntries` can legitimately return `([], nil)` — no error — when every WAL segment that held a snapshot record is gone but later entry-only segments survive (e.g. an incomplete backup/restore, or WAL segments pruned beyond what etcd's own retention would normally remove). `validateWAL` does not check for this case before indexing, so it panics instead of returning an error.  Note that the sibling function `(w *WAL) LatestSnapshotEntry()` in the same package (`server/storage/wal/wal.go`) already guards against exactly this:  ```go func (w *WAL) LatestSnapshotEntr
  **Post-Mortem & Fix Analysis**:
  > > Lower wal.SegmentSizeBytes and Save enough entries to force the WAL  Looks like AI generated concern not user report

- **Issue #22509** (2026-10-01): **Update OWNERS_ALIASES**
  *Symptoms*: Apparently the one in this repo doesn't inherit from k8s/org, so updating manually.  @siyuanfoundation @fuweid  
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/etcd-io/etcd/pull/22509?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=etcd-io) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 72.99%. Comparing base ([`7583cc6`](https://app.codecov.io/gh/etcd-io/etcd/commit/7583cc6e7e2756bb4166d646fe48d2fa1863b4b6?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=etcd-io)) to head ([`aadc358`](https://app.codecov.io/gh/etcd-io/etcd/commit/aadc358b5640c4abb42542cc8e41a0948974a228?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=etcd-io)).  <details><summary>Additional details and impacted files</summary>   [see 21 files with indirect coverage changes](https://app.codecov.io/gh/etcd-io/etcd/pull/22509/indirect-changes?src=pr&el=tree-
  > [APPROVALNOTIFIER] This PR is **APPROVED**  This pull-request has been approved by: *<a href="https://github.com/etcd-io/etcd/pull/22509#pullrequestreview-5384767435" title="Approved">ahrtr</a>*, *<a href="https://github.com/etcd-io/etcd/pull/22509#pullrequestreview-5384556950" title="Approved">fuweid</a>*, *<a href="https://github.com/etcd-io/etcd/pull/22509#" title="Author self-approved">jberkus</a>*  The full list of commands accepted by this bot can be found [here](https://go.k8s.io/bot-commands?repo=etcd-io%2Fetcd).  The pull request process is described [here](https://git.k8s.io/community/contributors/guide/owners.md#the-code-review-process)  <details > Needs approval from an approver in each of these files:  - ~~[OWNERS](https://github.com/etcd-io/etcd/blob/main/OWNERS)~~ [ahrtr,fuweid]  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":[]} -->

- **Issue #22508** (2026-10-01): **Add self to OWNERS_ALIASES**
  *Symptoms*: Figured out why I wasn't seeing security issues.  Please merge!  @siyuanfoundation @fuweid @ivanvc  
  **Post-Mortem & Fix Analysis**:
  > Feh, dragged in  some unrelated commits.  /close 
  > @jberkus: Closed this PR.  <details>  In response to [this](https://github.com/etcd-io/etcd/pull/22508#issuecomment-5936625668):  >Feh, dragged in  some unrelated commits. > >/close >   Instructions for interacting with me using PR comments are available [here](https://git.k8s.io/community/contributors/guide/pull-requests.md).  If you have questions or suggestions related to my behavior, please file an issue against the [kubernetes-sigs/prow](https://github.com/kubernetes-sigs/prow/issues/new?title=Prow%20issue:) repository. </details>
  > [APPROVALNOTIFIER] This PR is **NOT APPROVED**  This pull-request has been approved by: *<a href="https://github.com/etcd-io/etcd/pull/22508#" title="Author self-approved">jberkus</a>* **Once this PR has been reviewed and has the lgtm label**, please assign [ahrtr](https://github.com/ahrtr) for approval. For more information see [the Code Review Process](https://git.k8s.io/community/contributors/guide/owners.md#the-code-review-process).  The full list of commands accepted by this bot can be found [here](https://go.k8s.io/bot-commands?repo=etcd-io%2Fetcd).  <details open> Needs approval from an approver in each of these files:  - **[OWNERS](https://github.com/etcd-io/etcd/blob/main/OWNERS)**  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":["ahrtr"]} -->

- **Issue #22506** (2026-10-01): **client/v3 leases: better precision for TTLs from KeepAlive()**
  *Symptoms*: ### What would you like to be added?  I think some of us are using leases and lease-bound keys to make sure an instance has exclusive access to something. In cases like that, I must not simply receive updated keepalive and infer I have exactly that duration of lease left (the response might arrived with a delay, the request itself might have arrived with delay, etcd might have added some lag etc.). Rather, I could count that TTL from the moment I made the request, sure that is a lower, conservative estimation, but at least it's on the safe side. The problem with KeepAlive, though, is that each response you read from a stream does not carry direct indication which request it responds to (we could have sent 2 keepalive requests for the same ID if the responses are not coming, then receive 2 responses). Still, having some solution for that would be nice.  ### Why is this needed?  That's probably not so important that it has to be supported by adding some arbitrary client-provided fields to requests (like "start timestamp" in request to be mirrored in response), otherwise you would have done so already. And this can be worked around by just using KeepAliveOnce, for example, if less efficiently than with shared KeepAlive.  **But how about this? This one looks like a simple enough fix, I can do it myself if you approve the idea. For each ID in keepalives, we could keep a queue of timestamps of requests made, and each next response we combine with queue.pop, by including the timesta
  **Post-Mortem & Fix Analysis**:
  > Actually it's probably not worth the risk of impact on most users. The better estimation still cannot guarantee that some action we are starting within that TTL will still finish within it. So, the feature is likely only useful for handful or applications, like mine one.

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

### Incident Patch 1: `48e67bca` (2026-10-05)
**Commit Message**: build(deps): bump the codeql group across 1 directory with 4 updates

Bumps the codeql group with 4 updates in the / directory: [github/codeql-action/init](https://github.com/github/codeql-action), [github/codeql-action/autobuild](https://github.com/github/codeql-action), [github/codeql-action/analyze](https://github.com/github/codeql-action) and [github/codeql-action/upload-sarif](https://github.com/github/codeql-action).


Updates `github/codeql-action/init` from 4.38.1 to 4.38.2
- [Release notes](https://github.com/github/codeql-action/releases)
- [Changelog](https://github.com/github/codeql-action/blob/main/CHANGELOG.md)
- [Commits](https://github.com/github/codeql-action/compare/1c5b675653bb5c22dbe9b12b556ec555138e09fd...2892aa5e19bbd11bc0cff5427e3b750a04d9e3c2)

Updates `github/codeql-action/autobuild` from 4.38.1 to 4.38.2
- [Release notes](https://github.com/github/codeql-action/releases)
- [Changelog](https://github.com/github/codeql-action/blob/main/CHANGELOG.md)
- [Commits](https://github.com/github/codeql-action/compare/1c5b675653bb5c22dbe9b12b556ec555138e09fd...2892aa5e19bbd11bc0cff5427e3b750a04d9e3c2)

Updates `github/codeql-action/analyze` from 4.38.1 to 4.38.2
- [Re

**File**: `.github/workflows/codeql-analysis.yml` (modified, +3/-3)
```diff
@@ -40,7 +40,7 @@ jobs:
         uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
       # Initializes the CodeQL tools for scanning.
       - name: Initialize CodeQL
-        uses: github/codeql-action/init@1c5b675653bb5c22dbe9b12b556ec555138e09fd # v4.38.1
+        uses: github/codeql-action/init@2892aa5e19bbd11bc0cff5427e3b750a04d9e3c2 # v4.38.2
         with:
           # If you wish to specify custom queries, you can do so here or in a config file.
           # By default, queries listed here will override any specified in a config file.
@@ -50,6 +50,6 @@ jobs:
       # Autobuild attempts to build any compiled languages  (C/C++, C#, or Java).
       # If this step fails, then you should remove it and run the build manually (see below)
       - name: Autobuild
-        uses: github/codeql-action/autobuild@1c5b675653bb5c22dbe9b12b556ec555138e09fd # v4.38.1
+        uses: github/codeql-action/autobuild@2892aa5e19bbd11bc0cff5427e3b750a04d9e3c2 # v4.38.2
       - name: Perform CodeQL Analysis
-        uses: github/codeql-action/analyze@1c5b675653bb5c22dbe9b12b556ec555138e09fd # v4.38.1
+        uses: github/codeql-action/analyze@2892aa5e19bbd11bc0cff5427e3b750a04d9e3c2 # v4.38.2
```

**File**: `.github/workflows/scorecards.yml` (modified, +1/-1)
```diff
@@ -50,6 +50,6 @@ jobs:
 
       # Upload the results to GitHub's code scanning dashboard.
       - name: "Upload to code-scanning"
-        uses: github/codeql-action/upload-sarif@1c5b675653bb5c22dbe9b12b556ec555138e09fd # v4.38.1
+        uses: github/codeql-action/upload-sarif@2892aa5e19bbd11bc0cff5427e3b750a04d9e3c2 # v4.38.2
         with:
           sarif_file: results.sarif
```

---

### Incident Patch 2: `91703b3d` (2026-10-04)
**Commit Message**: Merge pull request #22523 from Aadeen/fix-lease-timeouts

cli: enforce context timeouts in lease commands

**File**: `etcdctl/ctlv3/command/lease_command.go` (modified, +10/-4)
```diff
@@ -127,7 +127,9 @@ func leaseTimeToLiveCommandFunc(cmd *cobra.Command, args []string) {
 	if timeToLiveKeys {
 		opts = append(opts, v3.WithAttachedKeys())
 	}
-	resp, rerr := mustClientFromCmd(cmd).TimeToLive(context.TODO(), leaseFromArgs(args[0]), opts...)
+	ctx, cancel := commandCtx(cmd)
+	resp, rerr := mustClientFromCmd(cmd).TimeToLive(ctx, leaseFromArgs(args[0]), opts...)
+	cancel()
 	if rerr != nil {
 		cobrautl.ExitWithError(cobrautl.ExitBadConnection, rerr)
 	}
@@ -146,7 +148,9 @@ func NewLeaseListCommand() *cobra.Command {
 
 // leaseListCommandFunc executes the "lease list" command.
 func leaseListCommandFunc(cmd *cobra.Command, args []string) {
-	resp, rerr := mustClientFromCmd(cmd).Leases(context.TODO())
+	ctx, cancel := commandCtx(cmd)
+	resp, rerr := mustClientFromCmd(cmd).Leases(ctx)
+	cancel()
 	if rerr != nil {
 		cobrautl.ExitWithError(cobrautl.ExitBadConnection, rerr)
 	}
@@ -178,15 +182,17 @@ func leaseKeepAliveCommandFunc(cmd *cobra.Command, args []string) {
 	id := leaseFromArgs(args[0])
 
 	if leaseKeepAliveOnce {
-		respc, kerr := mustClientFromCmd(cmd).KeepAliveOnce(context.TODO(), id)
+		ctx, cancel := commandCtx(cmd)
+		respc, kerr := mustClientFromCmd(cmd).KeepAliveOnce(ctx, id)
+		cancel()
 		if kerr != nil {
 			cobrautl.ExitWithError(cobrautl.ExitBadConnection, kerr)
 		}
 		display.KeepAlive(respc)
 		return
 	}
 
-	respc, kerr := mustClientFromCmd(cmd).KeepAlive(context.TODO(), id)
+	respc, kerr := mustClientFromCmd(cmd).KeepAlive(context.Background(), id)
 	if kerr != nil {
 		cobrautl.ExitWithError(cobrautl.ExitBadConnection, kerr)
 	}
```

---

### Incident Patch 3: `24916d65` (2026-10-04)
**Commit Message**: cli: enforce context timeouts in lease commands

Signed-off-by: Aadeen Rashid <[REDACTED_EMAIL]>

**File**: `etcdctl/ctlv3/command/lease_command.go` (modified, +10/-4)
```diff
@@ -127,7 +127,9 @@ func leaseTimeToLiveCommandFunc(cmd *cobra.Command, args []string) {
 	if timeToLiveKeys {
 		opts = append(opts, v3.WithAttachedKeys())
 	}
-	resp, rerr := mustClientFromCmd(cmd).TimeToLive(context.TODO(), leaseFromArgs(args[0]), opts...)
+	ctx, cancel := commandCtx(cmd)
+	resp, rerr := mustClientFromCmd(cmd).TimeToLive(ctx, leaseFromArgs(args[0]), opts...)
+	cancel()
 	if rerr != nil {
 		cobrautl.ExitWithError(cobrautl.ExitBadConnection, rerr)
 	}
@@ -146,7 +148,9 @@ func NewLeaseListCommand() *cobra.Command {
 
 // leaseListCommandFunc executes the "lease list" command.
 func leaseListCommandFunc(cmd *cobra.Command, args []string) {
-	resp, rerr := mustClientFromCmd(cmd).Leases(context.TODO())
+	ctx, cancel := commandCtx(cmd)
+	resp, rerr := mustClientFromCmd(cmd).Leases(ctx)
+	cancel()
 	if rerr != nil {
 		cobrautl.ExitWithError(cobrautl.ExitBadConnection, rerr)
 	}
@@ -178,15 +182,17 @@ func leaseKeepAliveCommandFunc(cmd *cobra.Command, args []string) {
 	id := leaseFromArgs(args[0])
 
 	if leaseKeepAliveOnce {
-		respc, kerr := mustClientFromCmd(cmd).KeepAliveOnce(context.TODO(), id)
+		ctx, cancel := commandCtx(cmd)
+		respc, kerr := mustClientFromCmd(cmd).KeepAliveOnce(ctx, id)
+		cancel()
 		if kerr != nil {
 			cobrautl.ExitWithError(cobrautl.ExitBadConnection, kerr)
 		}
 		display.KeepAlive(respc)
 		return
 	}
 
-	respc, kerr := mustClientFromCmd(cmd).KeepAlive(context.TODO(), id)
+	respc, kerr := mustClientFromCmd(cmd).KeepAlive(context.Background(), id)
 	if kerr != nil {
 		cobrautl.ExitWithError(cobrautl.ExitBadConnection, kerr)
 	}
```

---

### Incident Patch 4: `94d3eb10` (2026-09-25)
**Commit Message**: Merge pull request #21766 from SebTardif/fix-wal-resource-leaks

wal: close files on Open and Create error paths

**File**: `server/storage/wal/wal.go` (modified, +7/-2)
```diff
@@ -98,7 +98,7 @@ type WAL struct {
 // Create creates a WAL ready for appending records. The given metadata is
 // recorded at the head of each WAL file, and can be retrieved with ReadAll
 // after the file is Open.
-func Create(lg *zap.Logger, dirpath string, metadata []byte) (*WAL, error) {
+func Create(lg *zap.Logger, dirpath string, metadata []byte) (_ *WAL, retErr error) {
 	if Exist(dirpath) {
 		return nil, os.ErrExist
 	}
@@ -136,6 +136,11 @@ func Create(lg *zap.Logger, dirpath string, metadata []byte) (*WAL, error) {
 		)
 		return nil, err
 	}
+	defer func() {
+		if retErr != nil {
+			f.Close()
+		}
+	}()
 	if _, err = f.Seek(0, io.SeekEnd); err != nil {
 		lg.Warn(
 			"failed to seek an initial WAL file",
@@ -192,7 +197,6 @@ func Create(lg *zap.Logger, dirpath string, metadata []byte) (*WAL, error) {
 			w.cleanupWAL(lg)
 		}
 	}()
-
 	// directory was renamed; sync parent dir to persist rename
 	pdir, perr := fileutil.OpenDir(filepath.Dir(w.dir))
 	if perr != nil {
@@ -349,6 +353,7 @@ func Open(lg *zap.Logger, dirpath string, snap *walpb.Snapshot) (*WAL, error) {
 		return nil, fmt.Errorf("openAtIndex failed: %w", err)
 	}
 	if w.dirFile, err = fileutil.OpenDir(w.dir); err != nil {
+		w.Close()
 		return nil, fmt.Errorf("fileutil.OpenDir failed: %w", err)
 	}
 	return w, nil
```

---

### Incident Patch 5: `b147d754` (2026-08-21)
**Commit Message**: fix(alerts): align etcdHighNumberOfFailedProposals description with rate window

The description said proposal failures were within the last 30 minutes, but
the value comes from rate(...[15m]) and for is also 15m. Update the wording
to 15 minutes so it matches the PromQL window.

Signed-off-by: prithvipatil97 <[REDACTED_EMAIL]>

**File**: `contrib/mixin/alerts/alerts.libsonnet` (modified, +1/-1)
```diff
@@ -141,7 +141,7 @@
               severity: 'warning',
             },
             annotations: {
-              description: 'etcd cluster "{{ $labels.%s }}": {{ $value }} proposal failures within the last 30 minutes on etcd instance {{ $labels.instance }}.' % $._config.clusterLabel,
+              description: 'etcd cluster "{{ $labels.%s }}": {{ $value }} proposal failures within the last 15 minutes on etcd instance {{ $labels.instance }}.' % $._config.clusterLabel,
               summary: 'etcd cluster has high number of proposal failures.',
             },
           },
```

---

### Incident Patch 6: `d8a03ef0` (2026-09-21)
**Commit Message**: build(deps): bump devcontainers/go

Bumps devcontainers/go from `6f19f51` to `dfe837b`.

---
updated-dependencies:
- dependency-name: devcontainers/go
  dependency-version: dev-1.27-bookworm
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `tools/container-images/devcontainer/Dockerfile` (modified, +1/-1)
```diff
@@ -1 +1 @@
-FROM mcr.microsoft.com/devcontainers/go:dev-1.27-bookworm@sha256:6f19f514101062fefcb35497f15e136d71f9b78892083cfb5d35ab8989a5114b
+FROM mcr.microsoft.com/devcontainers/go:dev-1.27-bookworm@sha256:dfe837b7e2f76a433d2ba85f19089ac0e6bcbb832c4740b1a58d25765d3d7b1d
```

---

### Incident Patch 7: `145b3e4d` (2026-09-21)
**Commit Message**: build(deps): bump the codeql group with 4 updates

Bumps the codeql group with 4 updates: [github/codeql-action/init](https://github.com/github/codeql-action), [github/codeql-action/autobuild](https://github.com/github/codeql-action), [github/codeql-action/analyze](https://github.com/github/codeql-action) and [github/codeql-action/upload-sarif](https://github.com/github/codeql-action).


Updates `github/codeql-action/init` from 4.38.0 to 4.38.1
- [Release notes](https://github.com/github/codeql-action/releases)
- [Changelog](https://github.com/github/codeql-action/blob/main/CHANGELOG.md)
- [Commits](https://github.com/github/codeql-action/compare/b96794f015dfd88f77b49b1c93e0fa7110f94c63...1c5b675653bb5c22dbe9b12b556ec555138e09fd)

Updates `github/codeql-action/autobuild` from 4.38.0 to 4.38.1
- [Release notes](https://github.com/github/codeql-action/releases)
- [Changelog](https://github.com/github/codeql-action/blob/main/CHANGELOG.md)
- [Commits](https://github.com/github/codeql-action/compare/b96794f015dfd88f77b49b1c93e0fa7110f94c63...1c5b675653bb5c22dbe9b12b556ec555138e09fd)

Updates `github/codeql-action/analyze` from 4.38.0 to 4.38.1
- [Release notes](https://github.com/github

**File**: `.github/workflows/codeql-analysis.yml` (modified, +3/-3)
```diff
@@ -40,7 +40,7 @@ jobs:
         uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
       # Initializes the CodeQL tools for scanning.
       - name: Initialize CodeQL
-        uses: github/codeql-action/init@b96794f015dfd88f77b49b1c93e0fa7110f94c63 # v4.38.0
+        uses: github/codeql-action/init@1c5b675653bb5c22dbe9b12b556ec555138e09fd # v4.38.1
         with:
           # If you wish to specify custom queries, you can do so here or in a config file.
           # By default, queries listed here will override any specified in a config file.
@@ -50,6 +50,6 @@ jobs:
       # Autobuild attempts to build any compiled languages  (C/C++, C#, or Java).
       # If this step fails, then you should remove it and run the build manually (see below)
       - name: Autobuild
-        uses: github/codeql-action/autobuild@b96794f015dfd88f77b49b1c93e0fa7110f94c63 # v4.38.0
+        uses: github/codeql-action/autobuild@1c5b675653bb5c22dbe9b12b556ec555138e09fd # v4.38.1
       - name: Perform CodeQL Analysis
-        uses: github/codeql-action/analyze@b96794f015dfd88f77b49b1c93e0fa7110f94c63 # v4.38.0
+        uses: github/codeql-action/analyze@1c5b675653bb5c22dbe9b12b556ec555138e09fd # v4.38.1
```

**File**: `.github/workflows/scorecards.yml` (modified, +1/-1)
```diff
@@ -50,6 +50,6 @@ jobs:
 
       # Upload the results to GitHub's code scanning dashboard.
       - name: "Upload to code-scanning"
-        uses: github/codeql-action/upload-sarif@b96794f015dfd88f77b49b1c93e0fa7110f94c63 # v4.38.0
+        uses: github/codeql-action/upload-sarif@1c5b675653bb5c22dbe9b12b556ec555138e09fd # v4.38.1
         with:
           sarif_file: results.sarif
```

---

### Incident Patch 8: `53363b51` (2026-09-20)
**Commit Message**: docs: fix spelling and line reference for MinClusterVersion

Signed-off-by: Aadeen Rashid <[REDACTED_EMAIL]>

**File**: `Documentation/contributor-guide/release.md` (modified, +1/-1)
```diff
@@ -24,7 +24,7 @@ All release version numbers follow the format of [semantic versioning 2.0.0](htt
 
 - Ensure the relevant [milestone](https://github.com/etcd-io/etcd/milestones) on GitHub is complete. All referenced issues should be closed or moved elsewhere.
 - Ensure the latest [upgrade documentation](https://etcd.io/docs/next/upgrades) is available.
-- Bump [hardcoded MinClusterVerion in the repository](https://github.com/etcd-io/etcd/blob/v3.4.15/version/version.go#L29), if necessary.
+- Bump [hardcoded MinClusterVersion in the repository](https://github.com/etcd-io/etcd/blob/v3.4.15/version/version.go#L28), if necessary.
 - Add feature capability maps for the new version, if necessary.
 
 ### Patch version release
```

---

### Incident Patch 9: `8928e5c1` (2026-09-17)
**Commit Message**: dependency: bump go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc from 1.45.0 to 1.46.0

Reference: https://github.com/etcd-io/etcd/pull/22428

Signed-off-by: Ivan Valdes <[REDACTED_EMAIL]>

**File**: `api/go.mod` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@ require (
 	github.com/golang/protobuf v1.5.4
 	github.com/grpc-ecosystem/grpc-gateway/v2 v2.30.0
 	github.com/stretchr/testify v1.12.1
-	google.golang.org/genproto/googleapis/api v0.0.0-20260803160001-6ac0973c030d
+	google.golang.org/genproto/googleapis/api v0.0.0-20260819154853-08b0e4226688
 	google.golang.org/grpc v1.83.2
 	google.golang.org/protobuf v1.36.12
 )
```

**File**: `api/go.sum` (modified, +2/-2)
```diff
@@ -38,8 +38,8 @@ golang.org/x/text v0.42.0 h1:JbOZXgfeCPU9gacVtYliJqOhD+zhrEqK4LfdpmlUZqI=
 golang.org/x/text v0.42.0/go.mod h1:ojzP1Z+2QtioaF8DTtO8K5q7JWVVYwZKenzujK0Zd0E=
 gonum.org/v1/gonum v0.17.0 h1:VbpOemQlsSMrYmn7T2OUvQ4dqxQXU+ouZFQsZOx50z4=
 gonum.org/v1/gonum v0.17.0/go.mod h1:El3tOrEuMpv2UdMrbNlKEh9vd86bmQ6vqIcDwxEOc1E=
-google.golang.org/genproto/googleapis/api v0.0.0-20260803160001-6ac0973c030d h1:FarXi840EJWSHYTN3ERkADbPWjl307+FGrA22KAVjjc=
-google.golang.org/genproto/googleapis/api v0.0.0-20260803160001-6ac0973c030d/go.mod h1:K/+WGbmBY7aNW1HDw1fJnKYo10i0DkAX6pows00dLig=
+google.golang.org/genproto/googleapis/api v0.0.0-20260819154853-08b0e4226688 h1:ax2KzoSRIZU/M0cIxri3pKxy99vniH1PVxWC6si/eZI=
+google.golang.org/genproto/googleapis/api v0.0.0-20260819154853-08b0e4226688/go.mod h1:1RJ9BQGyNdZwkGc1eTqkErfRZ6RJyYPHZo73BZ1vQqI=
 google.golang.org/genproto/googleapis/rpc v0.0.0-20260825221802-da73d73af1c5 h1:1VUiZAXyC+zmiFYi+WLtBzr68Cj8wOofHjjrA/kkizc=
 google.golang.org/genproto/googleapis/rpc v0.0.0-20260825221802-da73d73af1c5/go.mod h1:DjtHYE8FKJLivXcBEjGwndXfIC23G0VpXiXKqG179uA=
 google.golang.org/grpc v1.83.2 h1:EManeRomTObA0BU7I8vXgg/78uE5MJ9M8B39EX2WscU=
```

**File**: `cache/go.mod` (modified, +1/-1)
```diff
@@ -25,7 +25,7 @@ require (
 	golang.org/x/net v0.59.0 // indirect
 	golang.org/x/sys v0.48.0 // indirect
 	golang.org/x/text v0.42.0 // indirect
-	google.golang.org/genproto/googleapis/api v0.0.0-20260803160001-6ac0973c030d // indirect
+	google.golang.org/genproto/googleapis/api v0.0.0-20260819154853-08b0e4226688 // indirect
 	google.golang.org/genproto/googleapis/rpc v0.0.0-20260825221802-da73d73af1c5 // indirect
 	google.golang.org/grpc v1.83.2 // indirect
 )
```

**File**: `cache/go.sum` (modified, +2/-2)
```diff
@@ -62,8 +62,8 @@ golang.org/x/text v0.42.0 h1:JbOZXgfeCPU9gacVtYliJqOhD+zhrEqK4LfdpmlUZqI=
 golang.org/x/text v0.42.0/go.mod h1:ojzP1Z+2QtioaF8DTtO8K5q7JWVVYwZKenzujK0Zd0E=
 gonum.org/v1/gonum v0.17.0 h1:VbpOemQlsSMrYmn7T2OUvQ4dqxQXU+ouZFQsZOx50z4=
 gonum.org/v1/gonum v0.17.0/go.mod h1:El3tOrEuMpv2UdMrbNlKEh9vd86bmQ6vqIcDwxEOc1E=
-google.golang.org/genproto/googleapis/api v0.0.0-20260803160001-6ac0973c030d h1:FarXi840EJWSHYTN3ERkADbPWjl307+FGrA22KAVjjc=
-google.golang.org/genproto/googleapis/api v0.0.0-20260803160001-6ac0973c030d/go.mod h1:K/+WGbmBY7aNW1HDw1fJnKYo10i0DkAX6pows00dLig=
+google.golang.org/genproto/googleapis/api v0.0.0-20260819154853-08b0e4226688 h1:ax2KzoSRIZU/M0cIxri3pKxy99vniH1PVxWC6si/eZI=
+google.golang.org/genproto/googleapis/api v0.0.0-20260819154853-08b0e4226688/go.mod h1:1RJ9BQGyNdZwkGc1eTqkErfRZ6RJyYPHZo73BZ1vQqI=
 google.golang.org/genproto/googleapis/rpc v0.0.0-20260825221802-da73d73af1c5 h1:1VUiZAXyC+zmiFYi+WLtBzr68Cj8wOofHjjrA/kkizc=
 google.golang.org/genproto/googleapis/rpc v0.0.0-20260825221802-da73d73af1c5/go.mod h1:DjtHYE8FKJLivXcBEjGwndXfIC23G0VpXiXKqG179uA=
 google.golang.org/grpc v1.83.2 h1:EManeRomTObA0BU7I8vXgg/78uE5MJ9M8B39EX2WscU=
```

**File**: `client/v3/go.mod` (modified, +1/-1)
```diff
@@ -35,7 +35,7 @@ require (
 	golang.org/x/net v0.59.0 // indirect
 	golang.org/x/sys v0.48.0 // indirect
 	golang.org/x/text v0.42.0 // indirect
-	google.golang.org/genproto/googleapis/api v0.0.0-20260803160001-6ac0973c030d // indirect
+	google.golang.org/genproto/googleapis/api v0.0.0-20260819154853-08b0e4226688 // indirect
 	google.golang.org/genproto/googleapis/rpc v0.0.0-20260825221802-da73d73af1c5 // indirect
 )
 
```

**File**: `client/v3/go.sum` (modified, +2/-2)
```diff
@@ -70,8 +70,8 @@ golang.org/x/text v0.42.0 h1:JbOZXgfeCPU9gacVtYliJqOhD+zhrEqK4LfdpmlUZqI=
 golang.org/x/text v0.42.0/go.mod h1:ojzP1Z+2QtioaF8DTtO8K5q7JWVVYwZKenzujK0Zd0E=
 gonum.org/v1/gonum v0.17.0 h1:VbpOemQlsSMrYmn7T2OUvQ4dqxQXU+ouZFQsZOx50z4=
 gonum.org/v1/gonum v0.17.0/go.mod h1:El3tOrEuMpv2UdMrbNlKEh9vd86bmQ6vqIcDwxEOc1E=
-google.golang.org/genproto/googleapis/api v0.0.0-20260803160001-6ac0973c030d h1:FarXi840EJWSHYTN3ERkADbPWjl307+FGrA22KAVjjc=
-google.golang.org/genproto/googleapis/api v0.0.0-20260803160001-6ac0973c030d/go.mod h1:K/+WGbmBY7aNW1HDw1fJnKYo10i0DkAX6pows00dLig=
+google.golang.org/genproto/googleapis/api v0.0.0-20260819154853-08b0e4226688 h1:ax2KzoSRIZU/M0cIxri3pKxy99vniH1PVxWC6si/eZI=
+google.golang.org/genproto/googleapis/api v0.0.0-20260819154853-08b0e4226688/go.mod h1:1RJ9BQGyNdZwkGc1eTqkErfRZ6RJyYPHZo73BZ1vQqI=
 google.golang.org/genproto/googleapis/rpc v0.0.0-20260825221802-da73d73af1c5 h1:1VUiZAXyC+zmiFYi+WLtBzr68Cj8wOofHjjrA/kkizc=
 google.golang.org/genproto/googleapis/rpc v0.0.0-20260825221802-da73d73af1c5/go.mod h1:DjtHYE8FKJLivXcBEjGwndXfIC23G0VpXiXKqG179uA=
 google.golang.org/grpc v1.83.2 h1:EManeRomTObA0BU7I8vXgg/78uE5MJ9M8B39EX2WscU=
```

**File**: `etcdctl/go.mod` (modified, +1/-1)
```diff
@@ -44,7 +44,7 @@ require (
 	golang.org/x/net v0.59.0 // indirect
 	golang.org/x/sys v0.48.0 // indirect
 	golang.org/x/text v0.42.0 // indirect
-	google.golang.org/genproto/googleapis/api v0.0.0-20260803160001-6ac0973c030d // indirect
+	google.golang.org/genproto/googleapis/api v0.0.0-20260819154853-08b0e4226688 // indirect
 	google.golang.org/genproto/googleapis/rpc v0.0.0-20260825221802-da73d73af1c5 // indirect
 )
 
```

**File**: `etcdctl/go.sum` (modified, +2/-2)
```diff
@@ -102,8 +102,8 @@ golang.org/x/time v0.15.0 h1:bbrp8t3bGUeFOx08pvsMYRTCVSMk89u4tKbNOZbp88U=
 golang.org/x/time v0.15.0/go.mod h1:Y4YMaQmXwGQZoFaVFk4YpCt4FLQMYKZe9oeV/f4MSno=
 gonum.org/v1/gonum v0.17.0 h1:VbpOemQlsSMrYmn7T2OUvQ4dqxQXU+ouZFQsZOx50z4=
 gonum.org/v1/gonum v0.17.0/go.mod h1:El3tOrEuMpv2UdMrbNlKEh9vd86bmQ6vqIcDwxEOc1E=
-google.golang.org/genproto/googleapis/api v0.0.0-20260803160001-6ac0973c030d h1:FarXi840EJWSHYTN3ERkADbPWjl307+FGrA22KAVjjc=
-google.golang.org/genproto/googleapis/api v0.0.0-20260803160001-6ac0973c030d/go.mod h1:K/+WGbmBY7aNW1HDw1fJnKYo10i0DkAX6pows00dLig=
+google.golang.org/genproto/googleapis/api v0.0.0-20260819154853-08b0e4226688 h1:ax2KzoSRIZU/M0cIxri3pKxy99vniH1PVxWC6si/eZI=
+google.golang.org/genproto/googleapis/api v0.0.0-20260819154853-08b0e4226688/go.mod h1:1RJ9BQGyNdZwkGc1eTqkErfRZ6RJyYPHZo73BZ1vQqI=
 google.golang.org/genproto/googleapis/rpc v0.0.0-20260825221802-da73d73af1c5 h1:1VUiZAXyC+zmiFYi+WLtBzr68Cj8wOofHjjrA/kkizc=
 google.golang.org/genproto/googleapis/rpc v0.0.0-20260825221802-da73d73af1c5/go.mod h1:DjtHYE8FKJLivXcBEjGwndXfIC23G0VpXiXKqG179uA=
 google.golang.org/grpc v1.83.2 h1:EManeRomTObA0BU7I8vXgg/78uE5MJ9M8B39EX2WscU=
```

---

### Incident Patch 10: `4f1cdf1f` (2026-09-17)
**Commit Message**: build(deps): bump devcontainer version to dev-1.27-bookworm

Bumps .devcontainer/devcontainer.json to dev-1.27-bookworm.

Signed-off-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>

**File**: `.devcontainer/devcontainer.json` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@
 {
 	"name": "Go",
 	// Or use a Dockerfile or Docker Compose file. More info: https://containers.dev/guide/dockerfile
-	"image": "mcr.microsoft.com/devcontainers/go:dev-1.26-bookworm",
+	"image": "mcr.microsoft.com/devcontainers/go:dev-1.27-bookworm",
 	// Features to add to the dev container. More info: https://containers.dev/features.
 	"features": {
 		"ghcr.io/devcontainers/features/docker-in-docker:2": {},
```

---

### Incident Patch 11: `3b9af3b7` (2026-09-17)
**Commit Message**: build(deps): bump devcontainers/go

Bumps devcontainers/go from dev-1.26-bookworm to dev-1.27-bookworm.

---
updated-dependencies:
- dependency-name: devcontainers/go
  dependency-version: dev-1.27-bookworm
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `tools/container-images/devcontainer/Dockerfile` (modified, +1/-1)
```diff
@@ -1 +1 @@
-FROM mcr.microsoft.com/devcontainers/go:dev-1.26-bookworm@sha256:f203ba07a5430a3e1a0e65bf36073efae9fa5bdbce9cbb736249afd442561619
+FROM mcr.microsoft.com/devcontainers/go:dev-1.27-bookworm@sha256:6f19f514101062fefcb35497f15e136d71f9b78892083cfb5d35ab8989a5114b
```

---

### Incident Patch 12: `f094b983` (2026-09-09)
**Commit Message**: client/v3: emit a single resolver update in EtcdManualResolver.Build

Build used to push the endpoints and round_robin ServiceConfig in a second
updateState call. gRPC saw a first state without the ServiceConfig, then a
second one with it, so it switched balancers mid-connection, canceled an
in-flight dial, and logged "operation was canceled" warnings.

Now seed the state with manual.Resolver.InitialState before Build, so gRPC
gets one update with both endpoints and the ServiceConfig. A shared state()
helper is reused by updateState.

Fixes #21660

Signed-off-by: Sunnatillo <[REDACTED_EMAIL]>

**File**: `CHANGELOG/CHANGELOG-3.8.md` (modified, +4/-0)
```diff
@@ -14,6 +14,10 @@ Previous change logs can be found at [CHANGELOG-3.7](https://github.com/etcd-io/
   - [Cleanup the legacy v2 snapshot source code and cleanup orphaned defragmentation files on bootstrap](https://github.com/etcd-io/etcd/pull/22341)
 - [Add `LeaderId` (`leader_id`) to `ResponseHeader`, including headers for `DefragmentResponse`, `SnapshotResponse`, and `MoveLeaderResponse`](https://github.com/etcd-io/etcd/pull/22327).
 
+### Package `clientv3`
+
+- [Emit a single resolver update in EtcdManualResolver.Build](https://github.com/etcd-io/etcd/pull/22133) to avoid spurious "operation was canceled" dial warnings.
+
 ### Dependencies
 
 - Compile binaries using [go 1.26.5](https://github.com/etcd-io/etcd/pull/22062).
```

**File**: `client/v3/internal/resolver/resolver.go` (modified, +19/-19)
```diff
@@ -45,13 +45,8 @@ func (r *EtcdManualResolver) Build(target resolver.Target, cc resolver.ClientCon
 	if r.serviceConfig.Err != nil {
 		return nil, r.serviceConfig.Err
 	}
-	res, err := r.Resolver.Build(target, cc, opts)
-	if err != nil {
-		return nil, err
-	}
-	// Populates endpoints stored in r into ClientConn (cc).
-	r.updateState()
-	return res, nil
+	r.Resolver.InitialState(r.state())
+	return r.Resolver.Build(target, cc, opts)
 }
 
 func (r *EtcdManualResolver) SetEndpoints(endpoints []string) {
@@ -61,18 +56,23 @@ func (r *EtcdManualResolver) SetEndpoints(endpoints []string) {
 
 func (r EtcdManualResolver) updateState() {
 	if getCC(r) != nil {
-		eps := make([]resolver.Endpoint, len(r.endpoints))
-		for i, ep := range r.endpoints {
-			addr, serverName := endpoint.Interpret(ep)
-			eps[i] = resolver.Endpoint{Addresses: []resolver.Address{
-				{Addr: addr, ServerName: serverName},
-			}}
-		}
-		state := resolver.State{
-			Endpoints:     eps,
-			ServiceConfig: r.serviceConfig,
-		}
-		r.UpdateState(state)
+		r.UpdateState(r.state())
+	}
+}
+
+// state builds the resolver state (endpoints + ServiceConfig) from the
+// endpoints currently stored in r.
+func (r EtcdManualResolver) state() resolver.State {
+	eps := make([]resolver.Endpoint, len(r.endpoints))
+	for i, ep := range r.endpoints {
+		addr, serverName := endpoint.Interpret(ep)
+		eps[i] = resolver.Endpoint{Addresses: []resolver.Address{
+			{Addr: addr, ServerName: serverName},
+		}}
+	}
+	return resolver.State{
+		Endpoints:     eps,
+		ServiceConfig: r.serviceConfig,
 	}
 }
 
```

**File**: `client/v3/internal/resolver/resolver_test.go` (modified, +12/-0)
```diff
@@ -261,3 +261,15 @@ func TestGetCCBeforeBuildReturnsNil(t *testing.T) {
 	// CC() panics before Build; getCC must recover and return nil.
 	assert.Nil(t, getCC(*r))
 }
+
+func TestState(t *testing.T) {
+	sc := &serviceconfig.ParseResult{}
+	r := New("http://127.0.0.1:2379", "unix:///tmp/etcd.sock")
+	r.serviceConfig = sc
+
+	want := wantState(sc,
+		addr("127.0.0.1:2379", "127.0.0.1:2379"),
+		addr("unix:///tmp/etcd.sock", "etcd.sock"),
+	)
+	assert.Equal(t, want, r.state())
+}
```

---

### Incident Patch 13: `ddd93a16` (2026-09-09)
**Commit Message**: client/v3: add regression tests for EtcdManualResolver.Build

Add unit tests that run EtcdManualResolver against a fake ClientConn that
records every UpdateState call.

TestBuildEmitsSingleResolverUpdate shows the bug: a second Build emits two
updates instead of one. It fails on the current code and passes after the
fix in the next commit.

Signed-off-by: Sunnatillo <[REDACTED_EMAIL]>

**File**: `client/v3/internal/resolver/resolver_test.go` (added, +263/-0)
```diff
@@ -0,0 +1,263 @@
+// Copyright 2026 The etcd Authors
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+//     http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
+
+package resolver
+
+import (
+	"errors"
+	"testing"
+
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+	"google.golang.org/grpc/resolver"
+	"google.golang.org/grpc/serviceconfig"
+)
+
+// fakeClientConn records every state passed to UpdateState so tests can assert
+// how many resolver updates were emitted and what they carried. It also lets a
+// test control the value returned by ParseServiceConfig.
+//
+// Assertions compare whole resolver.State values built with composite literals
+// rather than reading individual grpc resolver fields (state.Endpoints, .Addr,
+// ...). Field reads would be flagged by tools/check-grpc-experimental as
+// experimental gRPC API usage; composite-literal keys are not.
+type fakeClientConn struct {
+	resolver.ClientConn
+	parsed        *serviceconfig.ParseResult
+	states        []resolver.State
+	parseCalls    int
+	lastParsedArg string
+}
+
+func (f *fakeClientConn) UpdateState(s resolver.State) error {
+	f.states = append(f.states, s)
+	return nil
+}
+
+func (f *fakeClientConn) ParseServiceConfig(cfg string) *serviceconfig.ParseResult {
+	f.parseCalls++
+	f.lastParsedArg = cfg
+	return f.parsed
+}
+
+func (f *fakeClientConn) ReportError(error) {}
+
+func newFakeClientConn() *fakeClientConn {
+	return &fakeClientConn{parsed: &serviceconfig.ParseResult{}}
+}
+
+// wantState builds the resolver.State we expect the resolver to emit for the
+// given addresses and service config, using composite literals only.
+func wantState(sc *serviceconfig.ParseResult, addrs ...struct{ addr, serverName string }) resolver.State {
+	eps := make([]resolver.Endpoint, len(addrs))
+	for i, a := range addrs {
+		eps[i] = resolver.Endpoint{Addresses: []resolver.Address{
+			{Addr: a.addr, ServerName: a.serverName},
+		}}
+	}
+	return resolver.State{Endpoints: eps, ServiceConfig: sc}
+}
+
+func addr(a, serverName string) struct{ addr, serverName string } {
+	return struct{ addr, serverName string }{a, serverName}
+}
+
+func TestNew(t *testing.T) {
+	t.Run("stores endpoints", func(t *testing.T) {
+		r := New("127.0.0.1:2379", "127.0.0.1:22379")
+		require.NotNil(t, r)
+		require.NotNil(t, r.Resolver)
+		assert.Equal(t, []string{"127.0.0.1:2379", "127.0.0.1:22379"}, r.endpoints)
+		// ServiceConfig is only populated once Build parses it.
+		assert.Nil(t, r.serviceConfig)
+	})
+
+	t.Run("no endpoints", func(t *testing.T) {
+		r := New()
+		require.NotNil(t, r)
+		assert.Empty(t, r.endpoints)
+	})
+
+	t.Run("uses the etcd-endpoints scheme", func(t *testing.T) {
+		r := New()
+		assert.Equal(t, Schema, r.Scheme())
+		assert.Equal(t, "etcd-endpoints", r.Scheme())
+	})
+}
+
+// TestBuildEmitsSingleResolverUpdate is a regression test for the double
+// resolver update that Build used to produce. Build must emit exactly one
+// update to the ClientConn, and that update must already carry both the
+// endpoints and the round_robin ServiceConfig. A second update carrying the
+// ServiceConfig separately would force gRPC to switch balancers mid-connection
+// and tear down an in-flight SubConn.
+func TestBuildEmitsSingleResolverUpdate(t *testing.T) {
+	sc := &serviceconfig.ParseResult{}
+	cc := &fakeClientConn{parsed: sc}
+
+	r := New("127.0.0.1:2379", "127.0.0.1:22379")
+
+	res, err := r.Build(resolver.Target{}, cc, resolver.BuildOptions{})
+	require.NoError(t, err)
+	require.NotNil(t, res)
+
+	// Build must request the round_robin load balancing policy.
+	assert.Equal(t, 1, cc.parseCalls)
+	assert.JSONEq(t, `{"loadBalancingPolicy": "round_robin"}`, cc.lastParsedArg)
+
+	// Exactly one resolver update, already carrying endpoints + ServiceConfig.
+	require.Len(t, cc.states, 1)
+	want := wantState(sc,
+		addr("127.0.0.1:2379", "127.0.0.1:2379"),
+		addr("127.0.0.1:22379", "127.0.0.1:22379"),
+	)
+	assert.Equal(t, want, cc.states[0])
+
+	cc2 := &fakeClientConn{parsed: sc}
+	res, err = r.Build(resolver.Target{}, cc2, resolver.BuildOptions{})
+	require.NoError(t, err)
+	require.NotNil(t, res)
+	assert.Len(t, cc2.states, 1)
+	assert.Equal(t, want, cc2.states[0])
+
+	assert.Same(t, cc2, r.CC())
+	assert.Same(t, cc2, getCC(*r))
+}
+
+func TestBuildReturnsServiceConfigParseError(t *testing.T) {
+	parseErr := errors.New("bad service config")
+	cc := &fakeClientConn{parsed: &serviceconfig.ParseResult{Err: parseErr}}
+
+	r := New("127.0.0.1:2379")
+
+	res, err := r.Build(resol
```

---

### Incident Patch 14: `87282fac` (2026-09-14)
**Commit Message**: build(deps): bump the codeql group with 4 updates

Bumps the codeql group with 4 updates: [github/codeql-action/init](https://github.com/github/codeql-action), [github/codeql-action/autobuild](https://github.com/github/codeql-action), [github/codeql-action/analyze](https://github.com/github/codeql-action) and [github/codeql-action/upload-sarif](https://github.com/github/codeql-action).


Updates `github/codeql-action/init` from 4.37.9 to 4.38.0
- [Release notes](https://github.com/github/codeql-action/releases)
- [Changelog](https://github.com/github/codeql-action/blob/main/CHANGELOG.md)
- [Commits](https://github.com/github/codeql-action/compare/cdf488f595d80d6e07e03d4674febd5ab45fa938...b96794f015dfd88f77b49b1c93e0fa7110f94c63)

Updates `github/codeql-action/autobuild` from 4.37.9 to 4.38.0
- [Release notes](https://github.com/github/codeql-action/releases)
- [Changelog](https://github.com/github/codeql-action/blob/main/CHANGELOG.md)
- [Commits](https://github.com/github/codeql-action/compare/cdf488f595d80d6e07e03d4674febd5ab45fa938...b96794f015dfd88f77b49b1c93e0fa7110f94c63)

Updates `github/codeql-action/analyze` from 4.37.9 to 4.38.0
- [Release notes](https://github.com/github

**File**: `.github/workflows/codeql-analysis.yml` (modified, +3/-3)
```diff
@@ -40,7 +40,7 @@ jobs:
         uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
       # Initializes the CodeQL tools for scanning.
       - name: Initialize CodeQL
-        uses: github/codeql-action/init@cdf488f595d80d6e07e03d4674febd5ab45fa938 # v4.37.9
+        uses: github/codeql-action/init@b96794f015dfd88f77b49b1c93e0fa7110f94c63 # v4.38.0
         with:
           # If you wish to specify custom queries, you can do so here or in a config file.
           # By default, queries listed here will override any specified in a config file.
@@ -50,6 +50,6 @@ jobs:
       # Autobuild attempts to build any compiled languages  (C/C++, C#, or Java).
       # If this step fails, then you should remove it and run the build manually (see below)
       - name: Autobuild
-        uses: github/codeql-action/autobuild@cdf488f595d80d6e07e03d4674febd5ab45fa938 # v4.37.9
+        uses: github/codeql-action/autobuild@b96794f015dfd88f77b49b1c93e0fa7110f94c63 # v4.38.0
       - name: Perform CodeQL Analysis
-        uses: github/codeql-action/analyze@cdf488f595d80d6e07e03d4674febd5ab45fa938 # v4.37.9
+        uses: github/codeql-action/analyze@b96794f015dfd88f77b49b1c93e0fa7110f94c63 # v4.38.0
```

**File**: `.github/workflows/scorecards.yml` (modified, +1/-1)
```diff
@@ -50,6 +50,6 @@ jobs:
 
       # Upload the results to GitHub's code scanning dashboard.
       - name: "Upload to code-scanning"
-        uses: github/codeql-action/upload-sarif@cdf488f595d80d6e07e03d4674febd5ab45fa938 # v4.37.9
+        uses: github/codeql-action/upload-sarif@b96794f015dfd88f77b49b1c93e0fa7110f94c63 # v4.38.0
         with:
           sarif_file: results.sarif
```

---

### Incident Patch 15: `066bd949` (2026-09-11)
**Commit Message**: tests: fix snapshot checks after adding response headers

Signed-off-by: Gyuho Lee <[REDACTED_EMAIL]>

**File**: `tests/e2e/v3_curl_maintenance_test.go` (modified, +2/-1)
```diff
@@ -126,7 +126,8 @@ func testCurlV3MaintenanceSnapshot(cx ctlCtx) {
 		Endpoint: "/v3/maintenance/snapshot",
 		Value:    "{}",
 		Expected: expect.ExpectedResponse{
-			Value: `"result":{"blob":`,
+			Value:         `"result":\{"header":\{[^}]*"leader_id":"[1-9][0-9]*"[^}]*\},"blob":`,
+			IsRegularExpr: true,
 		},
 	}), "failed post maintenance snapshot request")
 }
```

**File**: `tests/integration/clientv3/maintenance_test.go` (modified, +4/-4)
```diff
@@ -155,7 +155,7 @@ func TestMaintenanceSnapshotResponseHeader(t *testing.T) {
 
 	clus := integration.NewCluster(t, &integration.ClusterConfig{Size: 3})
 	defer clus.Terminate(t)
-	populateDataIntoCluster(t, clus, 3, 64*1024)
+	populateDataIntoCluster(t, clus, 64*1024)
 	leaderID := uint64(clus.Members[clus.WaitLeader(t)].ID())
 
 	for i, member := range clus.Members {
@@ -200,7 +200,7 @@ func TestMaintenanceSnapshotCancel(t *testing.T) {
 	// And the initialized cluster has 20KiB snapshot, which can be
 	// pre-read by underlayer. We should increase the snapshot's size here,
 	// just in case that io.Copy won't return the canceled error.
-	populateDataIntoCluster(t, clus, 3, 1024*1024)
+	populateDataIntoCluster(t, clus, 1024*1024)
 
 	rc1, err := clus.RandClient().Snapshot(ctx)
 	require.NoError(t, err)
@@ -277,7 +277,7 @@ func testMaintenanceSnapshotTimeout(t *testing.T, snapshot func(context.Context,
 	// And the initialized cluster has 20KiB snapshot, which can be
 	// pre-read by underlayer. We should increase the snapshot's size here,
 	// just in case that io.Copy won't return the timeout error.
-	populateDataIntoCluster(t, clus, 3, 1024*1024)
+	populateDataIntoCluster(t, clus, 1024*1024)
 
 	rc2, err := snapshot(ctx, clus.RandClient())
 	require.NoError(t, err)
@@ -407,7 +407,7 @@ func TestMaintenanceSnapshotContentDigest(t *testing.T) {
 	clus := integration.NewCluster(t, &integration.ClusterConfig{Size: 1})
 	defer clus.Terminate(t)
 
-	populateDataIntoCluster(t, clus, 3, 1024*1024)
+	populateDataIntoCluster(t, clus, 1024*1024)
 
 	// reading snapshot with canceled context should error out
 	resp, err := clus.RandClient().SnapshotWithVersion(t.Context())
```

**File**: `tests/integration/clientv3/util.go` (modified, +3/-3)
```diff
@@ -106,12 +106,12 @@ func IsUnavailable(err error) bool {
 	return code == codes.Unavailable
 }
 
-// populateDataIntoCluster populates the key-value pairs into cluster and the
+// populateDataIntoCluster populates three key-value pairs into cluster and the
 // key will be named by testing.T.Name()-index.
-func populateDataIntoCluster(t *testing.T, cluster *integration.Cluster, numKeys int, valueSize int) {
+func populateDataIntoCluster(t *testing.T, cluster *integration.Cluster, valueSize int) {
 	ctx := t.Context()
 
-	for i := 0; i < numKeys; i++ {
+	for i := 0; i < 3; i++ {
 		_, err := cluster.RandClient().Put(ctx,
 			fmt.Sprintf("%s-%v", t.Name(), i), strings.Repeat("a", valueSize))
 		if err != nil {
```

#### Recent Merged Pull Requests:
- **PR #22531** (2026-10-05): CHANGELOG(3.7,3.8): add NewJournalWriter deprecation and removal entries (@dims)
- **PR #22530** (2026-10-05): [release-3.7] client/pkg: deprecate logutil.NewJournalWriter (@dims)
- **PR #22523** (2026-10-04): cli: enforce context timeouts in lease commands (@Aadeen)
- **PR #22520** (closed): verify: return error instead of panicking when WAL has no snapshot entries (@lokeshramchand-ctrl)
- **PR #22509** (2026-10-01): Update OWNERS_ALIASES (@jberkus)
- **PR #22508** (closed): Add self to OWNERS_ALIASES (@jberkus)
- **PR #22505** (2026-10-01): etcdserverpb: clarify RangeStreamResponse kvs chunk population (@Jefftree)
- **PR #22503** (2026-10-01): [2026-09-28] dependency bump (@ivanvc)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
