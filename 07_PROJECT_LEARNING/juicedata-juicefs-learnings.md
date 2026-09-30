# Forensic Learning Record (Deep Inspection): juicedata/juicefs

> **Canonical Artifact**: `07_PROJECT_LEARNING/juicedata-juicefs-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/juicedata/juicefs](https://github.com/juicedata/juicefs))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:16:28.861Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `juicedata/juicefs`
- **Description**: JuiceFS is a distributed POSIX file system built on top of Redis and S3.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: package.json, go.mod, README.md
- **Stars / Engagement**: 14487 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cmd/bench.go`
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

package cmd

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/dustin/go-humanize"
	"github.com/juicedata/juicefs/pkg/utils"
	"github.com/urfave/cli/v2"
)

func cmdBench() *cli.Command {
	return &cli.Command{
		Name:      "bench",
		Action:    bench,
		Category:  "TOOL",
		Usage:     "Run benchmarks on a path",
		ArgsUsage: "PATH",
		Description: `
Run basic benchmarks on the target PATH to test if it works as expected. Results are colored with
green/yellow/red to indicate whether they are in a normal range. If you see any red value, please
double check relevant configuration before further test.

Examples:
# Run benchmarks with 4 threads
$ juicefs bench /mnt/jfs -p 4

# Run benchmarks of only small files
$ juicefs bench /mnt/jfs --big-file-size 0

Details: https://juicefs.com/docs/community/performance_evaluation_guide#juicefs-bench`,
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:  "block-size",
				Value: "1M",
				Usage: "size of each IO block in MiB",
			},
			&cli.StringFlag{
				Name:  "big-file-size",
				Value: "1G",
				Usage: "size of each big file in MiB",
			},
			&cli.StringFlag{
				Name:  "small-file-size",
				Value: "128K",
				Usage: "size of each small file in KiB",
			},
			&cli.UintFlag{
				Name:  "small-file-count",
				Value: 100,
				Usage: "number of small files per thread",
			},
			&cli.UintFlag{
				Name:    "threads",
				Aliases: []string{"p"},
				Value:   1,
				Usage:   "number of concurrent threads",
			},
		},
	}
}

var resultRange = map[string][4]float64{
	"bigwr":   {100, 200, 10, 50},
	"bigrd":   {100, 200, 10, 50},
	"smallwr": {12.5, 20, 50, 80},
	"smallrd": {50, 100, 10, 20},
	"stat":    {20, 1000, 1, 5},
	"fuse":    {0, 0, 0.5, 2},
	"meta":    {0, 0, 2, 5},
	"put":     {0, 0, 100, 200},
	"get":     {0, 0, 100, 200},
	"delete":  {0, 0, 30, 100},
	"cachewr": {0, 0, 10, 20},
	"cacherd": {0, 0, 1, 5},
}

type benchCase struct {
	bm               *benchmark
	name             string
	fsize, bsize     int        // file/block size in Bytes
	fcount, bcount   int        // file/block count
	wbar, rbar, sbar *utils.Bar // progress bar for write/read/stat
}

type benchmark struct {
	colorful   bool
	big, small *benchCase
	threads    int
	tmpdir     string
}

func (bc *benchCase) writeFiles(index int) {
	for i := 0; i < bc.fcount; i++ {
		fname := filepath.Join(bc.bm.tmpdir, fmt.Sprintf("%s.%d.%d", bc.name, index, i))
		fp, err := os.OpenFile(fname, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0644)
		if err != nil {
			logger.Fatalf("Failed to open file %q: %s", fname, err)
		}
		buf := make([]byte, bc.bsize)
		utils.RandRead(buf)
		for j := 0; j < bc.bcount; j++ {
			if _, err = fp.Write(buf); err != nil {
				logger.Fatalf("Failed to write file %q: %s", fname, err)
			}
			bc.wbar.Increment()
		}
		_ = fp.Close()
	}
}

func (bc *benchCase) readFiles(index int) {
	for i := 0; i < bc.fcount; i++ {
		fname := filepath.Join(bc.bm.tmpdir, fmt.Sprintf("%s.%d.%d", bc.name, index, i))
		fp, err := os.Open(fname)
		if err != nil {
			logger.Fatalf("Failed to open file %q: %s", fname, err)
		}
		buf := make([]byte, bc.bsize)
		for j := 0; j < bc.bcount; j++ {
			if n, err := fp.Read(buf); err != nil || n != bc.bsize {
				logger.Fatalf("Failed to read file %q: %d %s", fname, n, err)
			}
			bc.rbar.Increment()
		}
		_ = fp.Close()
	}
}

func (bc *benchCase) statFiles(index int) {
	for i := 0; i < bc.fcount; i++ {
		fname := filepath.Join(bc.bm.tmpdir, fmt.Sprintf("%s.%d.%d", bc.name, index, i))
		if _, err := os.Stat(fname); err != nil {
			logger.Fatalf("Failed to stat file %q: %s", fname, err)
		}
		bc.sbar.Increment()
	}
}

func (bc *benchCase) run(test string) float64 {
	var fn func(int)
	switch test {
	case "write":
		fn = bc.writeFiles
	case "read":
		fn = bc.readFiles
	case "stat":
		fn = bc.statFiles
	} // default: fatal
	var wg sync.WaitGroup
	start := time.Now()
	for i := 0; i < bc.bm.threads; i++ {
		index := i
		wg.Add(1)
		go func() {
			fn(index)
			wg.Done()
		}()
	}
	wg.Wait()
	return time.Since(start).Seconds()
}

func newBenchmark(tmpdir string, blockSize, bigSize, smallSize, smallCount, threads int) *benchmark {
	bm := &benchmark{threads: threads, tmpdir: tmpdir}
	if bigSize > 0 {
		bm.big = bm.newCase("bigfile", bigSize, 1, blockSize)
	}
	if smallSize > 0 && smallCount > 0 {
		bm.small = bm.newCase("smallfile", smallSize, smallCount, blockSize)
	}
	return bm
}

func (bm *benchmark) newCase(name string, fsize, fcount, bsize int) *benchCase {
	bc := &benchCase{
		bm:     bm,
		name:   name,
		fsize:  fsize,
		fcount: fcount,
		bsize:  bsize,
	}
	if fsize <= bsize {
		bc.bcount = 1
		bc.bsize = fsize
	} else {
		bc.bcount = (fsize-1)/bsize + 1
		bc.fsize = bc.bcount * bsize
	}
	return bc
}

func (bm *benchmark) colorize(item string, value, cost float64, prec int) (string, string) {
	svalue := strconv.FormatFloat(value, 'f', prec, 64)
	scost := strconv.FormatFloat(cost, 'f', 2, 64)
	if bm.colorful {
		r, ok := resultRange[item]
		if !ok {
			logger.Fatalf("Invalid item: %s", item)
		}
		if item == "smallwr" || item == "smallrd" || item == "stat" {
			r[0] *= float64(bm.threads)
			r[1] *= float64(bm.threads)
		}
		var color int
		if value > r[1] { // max
			color = GREEN
		} else if value > r[0] { // min
			color = YELLOW
		} else {
			color = RED
		}
		svalue = fmt.Sprintf("%s%dm%s%s", COLOR_SEQ, color, svalue, RESET_SEQ)
		if cost < r[2] { // min
			color = GREEN
		} else if cost < r[3] { // max
			color = YELLOW
		} else {
			color = RED
		}
		scost = fmt.Sprintf("%s%dm%s%s", COLOR_SEQ, color, scost, RESET_SEQ)
	}
	return svalue, scost
}

func printResult(result [][]string, leftAlign int, colorful bool) {
	if len(result) < 2 {
		logger.Fatalf("result must not be empty")
	}
	colNum := len(result[0])
	rawmax, max := make([]int, colNum), make([]int, colNum)
	for _, l := range result {
		for i := 0; i < colNum; i++ {
			if len(l[i]) > rawmax[i] {
				rawmax[i] = len(l[i])
			}
		}
	}
	copy(max, rawmax)
	if colorful {
		for i := 1; i < colNum; i++ {
			max[i] -= 11
		}
	}

	var b strings.Builder
	for i := 0; i < colNum; i++ {
		b.WriteByte('+')
		b.WriteString(strings.Repeat("-", max[i]+2))
	}
	b.WriteByte('+')
	divider := b.String()
	fmt.Println(divider)

	b.Reset()
	header := result[0]
	for i := 0; i < colNum; i++ {
		b.WriteString(" | ")
		b.WriteString(padding(header[i], max[i], ' '))
	}
	b.WriteString(" |")
	fmt.Println(b.String()[1:])
	fmt.Println(divider)

	for _, l := range result[1:] {
		b.Reset()
		for i := 0; i < colNum; i++ {
			b.WriteString(" | ")
			if i == leftAlign {
				b.WriteString(l[i])
			}
			if spaces := rawmax[i] - len(l[i]); spaces > 0 {
				b.WriteString(strings.Repeat(" ", spaces))
			}
			if i != leftAlign {
				b.WriteString(l[i])
			}
		}
		b.WriteString(" |")
		fmt.Println(b.String()[1:])
	}
	fmt.Println(divider)
}

func bench(ctx *cli.Context) error {
	setup(ctx, 1)
	/* --- Pre-check --- */
	blockSize := utils.ParseBytes(ctx, "block-size", 'M')
	if blockSize == 0 || ctx.Uint("threads") == 0 {
		return os.ErrInvalid
	}
	tmpdir, err := filepath.Abs(ctx.Args().First())
	if err != nil {
		logger.Fatalf("Failed to get absolute path of %q: %s", ctx.Args().First(), err)
	}
	bigSize := utils.ParseBytes(ctx, "big-file-size", 'M')
	smallSize := utils.ParseBytes(ctx, "small-file-size", 'K')
	tmpdir = filepath.Join(tmpdir, fmt.Sprintf("_
```

### Core Architecture Module: `cmd/changelog.go`
```
/*
 * JuiceFS, Copyright 2026 Juicedata, Inc.
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

package cmd

import (
	"fmt"

	"github.com/juicedata/juicefs/pkg/meta"
	"github.com/urfave/cli/v2"
)

func cmdChangelog() *cli.Command {
	return &cli.Command{
		Name:      "changelog",
		Action:    changelog,
		Category:  "INSPECTOR",
		Usage:     "Tail the changelog of a volume",
		ArgsUsage: "META-URL",
		Description: `
Show the changelog of metadata operations on the volume. This requires the changelog feature
to be enabled via "juicefs config META-URL --changelog".

Examples:
$ juicefs changelog redis://localhost

# Start tailing from a specific version
$ juicefs changelog redis://localhost --from 100`,
		Flags: []cli.Flag{
			&cli.Int64Flag{
				Name:  "from",
				Usage: "show changelog from this version (0 means from the latest)",
			},
		},
	}
}

func changelog(ctx *cli.Context) error {
	setup(ctx, 1)
	metaUri := ctx.Args().Get(0)
	removePassword(metaUri)

	m := meta.NewClient(metaUri, nil)
	if format, err := m.Load(true); err != nil {
		return err
	} else if !format.ChangeLog {
		return fmt.Errorf("changelog is not enabled, use `juicefs config %s --changelog` to enable it", metaUri)
	}

	last := ctx.Int64("from")
	return m.ScanChangelog(meta.Background(), last, func(ver int64, entry string) error {
		fmt.Printf("%d: %s\n", ver, entry)
		return nil
	})
}

```

### Core Architecture Module: `cmd/clone.go`
```
/*
 * JuiceFS, Copyright 2023 Juicedata, Inc.
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

package cmd

import (
	"fmt"
	"os"
	"path"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/juicedata/juicefs/pkg/meta"
	"github.com/juicedata/juicefs/pkg/utils"
	"github.com/urfave/cli/v2"
)

func cmdClone() *cli.Command {
	return &cli.Command{
		Name:      "clone",
		Action:    clone,
		Usage:     "clone a file or directory without copying the underlying data",
		ArgsUsage: "SRC DST",
		Category:  "TOOL",
		Description: `
This command can clone a file or directory without copying the underlying data,similar to the cp command but very fast.
Examples:
# Clone a file
$ juicefs clone /mnt/jfs/file1 /mnt/jfs/file2

# Clone a directory
$ juicefs clone /mnt/jfs/dir1 /mnt/jfs/dir2

# Clone with preserving the uid, gid, and mode of the file
$ juicefs clone -p /mnt/jfs/file1 /mnt/jfs/file2`,
		Flags: []cli.Flag{
			&cli.BoolFlag{
				Name:    "preserve",
				Aliases: []string{"p"},
				Usage:   "preserve the uid, gid, and mode of the file. (This is forced on Windows)",
			},
			&cli.IntFlag{
				Name:  "threads",
				Value: meta.CLONE_DEFAULT_CONCURRENCY,
				Usage: "number of concurrent workers for cloning directories",
			},
		},
	}
}

func clone(ctx *cli.Context) error {
	setup(ctx, 2)
	srcPath := ctx.Args().Get(0)
	srcAbsPath, err := filepath.Abs(srcPath)
	if err != nil {
		return fmt.Errorf("abs of %s: %s", srcPath, err)
	}
	srcIno, err := utils.GetFileInode(srcPath)
	if err != nil {
		return fmt.Errorf("lookup inode for %s: %s", srcPath, err)
	}
	srcParentIno, err := utils.GetFileInode(filepath.Dir(srcAbsPath))
	if err != nil {
		return fmt.Errorf("lookup inode for %s: %s", filepath.Dir(srcAbsPath), err)
	}
	dst := ctx.Args().Get(1)
	if strings.HasSuffix(dst, string(filepath.Separator)) {
		dst = filepath.Join(dst, filepath.Base(srcPath))
	}
	if _, err := os.Stat(dst); err == nil {
		return fmt.Errorf("%s already exists", dst)
	} else if !os.IsNotExist(err) {
		return fmt.Errorf("stat %s: %s", dst, err)
	}
	dstAbsPath, err := filepath.Abs(dst)
	if err != nil {
		return fmt.Errorf("abs of %s: %s", dst, err)
	}

	srcMp, err := findMountpoint(srcAbsPath)
	if err != nil {
		return err
	}
	dstMp, err := findMountpoint(filepath.Dir(dstAbsPath))
	if err != nil {
		return err
	}
	if srcMp != dstMp {
		return fmt.Errorf("the clone DST path should be at the same mount point as the SRC path")
	}
	if strings.HasPrefix(dstAbsPath, path.Clean(srcAbsPath)+"/") {
		return fmt.Errorf("the clone DST path should not be under the SRC path")
	}

	dstParent := filepath.Dir(dstAbsPath)
	dstName := filepath.Base(dstAbsPath)
	dstParentIno, err := utils.GetFileInode(dstParent)
	if err != nil {
		return fmt.Errorf("lookup inode for %s: %s", dstParent, err)
	}
	var cmode uint8
	umask := utils.GetUmask()
	if ctx.Bool("preserve") || runtime.GOOS == "windows" {
		cmode |= meta.CLONE_MODE_PRESERVE_ATTR
	}
	threads := ctx.Int("threads")
	if threads < 1 {
		threads = 1
	} else if threads > 255 {
		threads = 255
	}
	headerSize := 4 + 4
	contentSize := 8 + 8 + 8 + 1 + uint32(len(dstName)) + 2 + 1 + 1 // +1 for threads
	wb := utils.NewBuffer(uint32(headerSize) + contentSize)
	wb.Put32(meta.Clone)
	wb.Put32(contentSize)
	wb.Put64(srcIno)
	wb.Put64(srcParentIno)
	wb.Put64(dstParentIno)
	wb.Put8(uint8(len(dstName)))
	wb.Put([]byte(dstName))
	wb.Put16(uint16(umask))
	wb.Put8(cmode)
	wb.Put8(uint8(threads))
	f, err := openController(srcMp)
	if err != nil {
		return err
	}
	defer f.Close()
	if _, err = f.Write(wb.Bytes()); err != nil {
		return fmt.Errorf("write message: %s", err)
	}

	progress := utils.NewProgress(false)
	defer progress.Done()
	bar := progress.AddCountBar("Cloning entries", 0)
	if _, errno := readProgress(f, func(count uint64, total uint64) {
		bar.SetTotal(int64(total))
		bar.SetCurrent(int64(count))
	}); errno != 0 {
		return fmt.Errorf("clone failed: %v", errno)
	}
	return nil
}

func findMountpoint(fpath string) (string, error) {
	for p := fpath; p != "/"; p = filepath.Dir(p) {
		inode, err := utils.GetFileInode(p)
		if err != nil {
			return "", fmt.Errorf("get inode of %s: %s", p, err)
		}
		if inode == uint64(meta.RootInode) {
			return p, nil
		}
	}
	return "", fmt.Errorf("%s is not inside JuiceFS", fpath)
}

```

### Core Architecture Module: `cmd/compact.go`
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

package cmd

import (
	"fmt"
	"math"
	"path/filepath"
	"syscall"

	"github.com/juicedata/juicefs/pkg/meta"
	"github.com/juicedata/juicefs/pkg/utils"
	"github.com/urfave/cli/v2"
)

func cmdCompact() *cli.Command {
	return &cli.Command{
		Name:      "compact",
		Action:    compact,
		Category:  "TOOL",
		Usage:     "Trigger compaction of chunks",
		ArgsUsage: "PATH...",
		Description: `
 Examples:
 # compact with path
 $ juicefs compact /mnt/jfs/foo
 `,
		Flags: []cli.Flag{
			&cli.UintFlag{
				Name:    "threads",
				Aliases: []string{"p"},
				Value:   10,
				Usage:   "compact concurrency",
			},
		},
	}
}

func compact(ctx *cli.Context) error {
	setup0(ctx, 1, 0)

	coCnt := ctx.Int("threads")
	if coCnt <= 0 {
		logger.Warn("threads should be > 0")
		coCnt = 1
	} else if coCnt >= math.MaxUint16 {
		logger.Warn("threads should be < MaxUint16")
		coCnt = math.MaxUint16
	}

	paths := ctx.Args().Slice()
	for i := 0; i < len(paths); i++ {
		path, err := filepath.Abs(paths[i])
		if err != nil {
			logger.Fatalf("get absolute path of %q error: %v", paths[i], err)
		}

		inodeNo, err := utils.GetFileInode(path)
		if err != nil {
			logger.Errorf("lookup inode for %q error: %v", path, err)
			continue
		}
		inode := meta.Ino(inodeNo)

		if !inode.IsValid() {
			logger.Fatalf("inode numbe %d not valid", inode)
		}

		if err = doCompact(inode, path, uint16(coCnt)); err != nil {
			logger.Error(err)
		}
	}
	return nil
}

func doCompact(inode meta.Ino, path string, coCnt uint16) error {
	f, err := openController(path)
	if err != nil {
		return fmt.Errorf("open control file for [%d:%s]: %w", inode, path, err)
	}
	defer f.Close()

	headerLen, bodyLen := uint32(8), uint32(8+2)
	wb := utils.NewBuffer(headerLen + bodyLen)
	wb.Put32(meta.CompactPath)
	wb.Put32(bodyLen)
	wb.Put64(uint64(inode))
	wb.Put16(coCnt)

	_, err = f.Write(wb.Bytes())
	if err != nil {
		logger.Fatalf("write message: %s", err)
	}

	progress := utils.NewProgress(false)
	bar := progress.AddCountBar("Compacted chunks", 0)
	_, errno := readProgress(f, func(totalChunks, currChunks uint64) {
		bar.SetTotal(int64(totalChunks))
		bar.SetCurrent(int64(currChunks))
	})

	bar.Done()
	progress.Done()

	if errno == syscall.EINVAL {
		logger.Fatalf("compact is not supported, please upgrade and mount again")
	}
	if errno != 0 {
		return fmt.Errorf("compact [%d:%s] error: %s", inode, path, errno)
	}

	logger.Infof("compact [%d:%q] success.", inode, path)
	return nil
}

```

### Core Architecture Module: `cmd/config.go`
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

package cmd

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/dustin/go-humanize"
	"github.com/juicedata/juicefs/pkg/meta"
	"github.com/juicedata/juicefs/pkg/object"
	"github.com/juicedata/juicefs/pkg/utils"
	"github.com/juicedata/juicefs/pkg/version"
	"github.com/pkg/errors"
	"github.com/urfave/cli/v2"
)

func cmdConfig() *cli.Command {
	return &cli.Command{
		Name:      "config",
		Action:    config,
		Category:  "ADMIN",
		Usage:     "Change configuration of a volume",
		ArgsUsage: "META-URL",
		Description: `
Only flags explicitly specified are changed.

Examples:
# Show the current configurations
$ juicefs config redis://localhost

# Change volume "quota"
$ juicefs config redis://localhost --inodes 10000000 --capacity 1048576

# Change maximum days before files in trash are deleted
$ juicefs config redis://localhost --trash-days 7

# Limit client version that is allowed to connect
$ juicefs config redis://localhost --min-client-version 1.0.0 --max-client-version 1.1.0`,
		Flags: expandFlags(
			formatStorageFlags(),
			addCategories("DATA STORAGE", []cli.Flag{
				&cli.StringFlag{
					Name:  "upload-limit",
					Usage: "default bandwidth limit of a client for upload in Mbps",
				},
				&cli.StringFlag{
					Name:  "download-limit",
					Usage: "default bandwidth limit of a client for download in Mbps",
				},
			}),
			formatManagementFlags(),
			configManagementFlags(),
			configFlags()),
	}
}

func configManagementFlags() []cli.Flag {
	return addCategories("MANAGEMENT", []cli.Flag{
		&cli.BoolFlag{
			Name:  "encrypt-secret",
			Usage: "encrypt the secret key if it was previously stored in plain format",
		},
		&cli.StringFlag{
			Name:  "min-client-version",
			Usage: "minimum client version allowed to connect",
		},
		&cli.StringFlag{
			Name:  "max-client-version",
			Usage: "maximum client version allowed to connect",
		},
		&cli.BoolFlag{
			Name:  "dir-stats",
			Usage: "enable dir stats, which is necessary for fast summary and dir quota",
		},
		&cli.BoolFlag{
			Name:  "user-group-quota",
			Usage: "enable user and group quota management",
		},
		&cli.BoolFlag{
			Name:  "changelog",
			Usage: "enable changelog",
		},
		&cli.DurationFlag{
			Name:        "changelog-max-age",
			Usage:       "max age of changelog entries (e.g. 2h, 30m); 0 to disable time-based cleanup",
			Value:       2 * time.Hour,
			DefaultText: "2h",
		},
		&cli.Int64Flag{
			Name:  "changelog-max-lines",
			Usage: "max number of changelog entries to keep; 0 means unlimited",
		},
		&cli.IntFlag{
			Name:  "tier",
			Usage: "tier (0-3; 0 is default tier when unset)",
			Action: func(ctx *cli.Context, v int) error {
				if !ctx.IsSet("tier") {
					return nil
				}
				if v < 0 || v > 3 {
					return fmt.Errorf("tier should be between 0 and 3")
				}
				return nil
			},
		},
	})
}

func configFlags() []cli.Flag {
	return []cli.Flag{
		&cli.BoolFlag{
			Name:    "yes",
			Aliases: []string{"y"},
			Usage:   "automatically answer 'yes' to all prompts and run non-interactively",
		},
		&cli.BoolFlag{
			Name:  "force",
			Usage: "skip sanity check and force update the configurations",
		},
	}
}

func warn(format string, a ...interface{}) {
	fmt.Printf("\033[1;33mWARNING\033[0m: "+format+"\n", a...)
}

func userConfirmed() bool {
	fmt.Print("Proceed anyway? [y/N]: ")
	scanner := bufio.NewScanner(os.Stdin)
	for scanner.Scan() {
		if text := strings.ToLower(scanner.Text()); text == "y" || text == "yes" {
			return true
		} else if text == "" || text == "n" || text == "no" {
			return false
		} else {
			fmt.Print("Please input y(yes) or n(no): ")
		}
	}
	return false
}

func config(ctx *cli.Context) error {
	setup(ctx, 1)
	removePassword(ctx.Args().Get(0))
	m := meta.NewClient(ctx.Args().Get(0), nil)

	format, err := m.Load(false)
	if err != nil {
		return err
	}
	if len(ctx.LocalFlagNames()) == 0 {
		fmt.Println(format)
		return nil
	}

	if err := checkFormatVersion(format, ctx.Bool("force")); err != nil {
		return err
	}

	originDirStats := format.DirStats
	originUGQuota := format.UserGroupQuota
	var quota, storage, trash, clientVer, tier bool
	var msg strings.Builder
	encrypted := format.KeyEncrypted
	var targetTierID uint8
	var currentTier object.Tier
	var findTier bool
	var newTier object.Tier

	var requiredMinClientVersion string
	requireMinClientVersion := func(required string) {
		requiredMinClientVersion = maxVersion(requiredMinClientVersion, required)
	}

	for _, flag := range ctx.LocalFlagNames() {
		switch flag {
		case "capacity":
			if new := utils.ParseBytes(ctx, flag, 'G'); new != format.Capacity {
				msg.WriteString(fmt.Sprintf("%10s: %s -> %s\n", flag,
					humanize.IBytes(format.Capacity), humanize.IBytes(new)))
				format.Capacity = new
				quota = true
			}
		case "inodes":
			if new := ctx.Uint64(flag); new != format.Inodes {
				msg.WriteString(fmt.Sprintf("%10s: %s -> %s\n", flag,
					humanize.Comma(int64(format.Inodes)), humanize.Comma(int64(new))))
				format.Inodes = new
				quota = true
			}
		case "storage":
			if new := ctx.String(flag); new != format.Storage {
				msg.WriteString(fmt.Sprintf("%10s: %s -> %s\n", flag, format.Storage, new))
				format.Storage = new
				storage = true
			}
		case "bucket":
			// bucket will be accessed before storage, so it is necessary to determine if storage is a file
			if new := ctx.String(flag); new != format.Bucket {
				effectiveStorage := format.Storage
				if ctx.IsSet("storage") {
					effectiveStorage = ctx.String("storage")
				}
				if effectiveStorage == "file" {
					if p, err := filepath.Abs(new); err == nil {
						new = p + "/"
					} else {
						logger.Fatalf("Failed to get absolute path of %q: %s", new, err)
					}
				}
				msg.WriteString(fmt.Sprintf("%10s: %s -> %s\n", flag, format.Bucket, new))
				format.Bucket = new
				storage = true
			}
		case "access-key":
			if ctx.IsSet("tier") {
				continue
			}
			if new := ctx.String(flag); new != format.AccessKey {
				msg.WriteString(fmt.Sprintf("%10s: %s -> %s\n", flag, format.AccessKey, new))
				format.AccessKey = new
				storage = true
			}
		case "secret-key": // always update
			if ctx.IsSet("tier") {
				continue
			}
			msg.WriteString(fmt.Sprintf("%10s: updated\n", flag))
			if err := format.Decrypt(); err != nil && strings.Contains(err.Error(), "secret was removed") {
				logger.Warnf("decrypt secrets: %s", err)
			}
			format.SecretKey = ctx.String(flag)
			storage = true
		case "session-token": // always update
			if ctx.IsSet("tier") {
				continue
			}
			msg.WriteString(fmt.Sprintf("%10s: updated\n", flag))
			if err := format.Decrypt(); err != nil && strings.Contains(err.Error(), "secret was removed") {
				logger.Warnf("decrypt secrets: %s", err)
			}
			format.SessionToken = ctx.String(flag)
			storage = true
		case "storage-class": // always update
			if ctx.IsSet("tier") {
				continue
			}
			if new := ctx.String(flag); new != format.Tiers[0].Sc {
				msg.WriteString(fmt.Sprintf("%10s: %s -> %s\n", flag, format.Tiers[0].Sc, new))
				newTier := format.Tiers[0]
				newTier.Sc = new
				format.Tiers[0] = newTier
				storage = true
				tier = true
			}
		case "tag":
			if ctx.IsSet("tier") {
				continue
			}
			new := ctx.String(flag)
			if !object.ValidateTag(new) {
				logger.Fatalf("Invalid tag format: %s", new)
			}
			if new != format.Tiers[0].Tag {
				msg.WriteString(
```

### Core Architecture Module: `cmd/debug.go`
```
/*
 * JuiceFS, Copyright 2022 Juicedata, Inc.
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

package cmd

import (
	"archive/zip"
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/juicedata/juicefs/pkg/meta"
	"github.com/juicedata/juicefs/pkg/utils"
	"github.com/juicedata/juicefs/pkg/vfs"
	"github.com/urfave/cli/v2"
)

var defaultOutDir = filepath.Join(".", "debug")

func cmdDebug() *cli.Command {
	return &cli.Command{
		Name:      "debug",
		Action:    debug,
		Category:  "INSPECTOR",
		ArgsUsage: "MOUNTPOINT",
		Usage:     "Collect and display system static and runtime information",
		Description: `
It collects and displays information from multiple dimensions such as the running environment and system logs, etc.

Examples:
$ juicefs debug /mnt/jfs

# Result will be output to /var/log/
$ juicefs debug --out-dir=/var/log /mnt/jfs

# Get the last up to 1000 log entries
$ juicefs debug --out-dir=/var/log --limit=1000 /mnt/jfs
`,
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:  "out-dir",
				Value: defaultOutDir,
				Usage: "the output directory of the result file",
			},
			&cli.Uint64Flag{
				Name:  "limit",
				Usage: "the number of last entries to be collected",
				Value: 5000,
			},
			&cli.Uint64Flag{
				Name:  "stats-sec",
				Value: 5,
				Usage: "stats sampling duration",
			},
			&cli.Uint64Flag{
				Name:  "trace-sec",
				Value: 5,
				Usage: "trace sampling duration",
			},
			&cli.Uint64Flag{
				Name:  "profile-sec",
				Value: 30,
				Usage: "profile sampling duration",
			},
		},
	}
}

func copyFileOnWindows(srcPath, destPath string) error {
	srcFile, err := os.Open(srcPath)
	if err != nil {
		return err
	}
	defer closeFile(srcFile)
	destFile, err := os.Create(destPath)
	if err != nil {
		return err
	}
	defer closeFile(destFile)
	if _, err := io.Copy(destFile, srcFile); err != nil {
		return err
	}
	return nil
}

func copyFile(srcPath, destPath string, requireRootPrivileges bool) error {
	if runtime.GOOS == "windows" {
		return utils.WithTimeout(context.TODO(), func(context.Context) error {
			return copyFileOnWindows(srcPath, destPath)
		}, 3*time.Second)
	}

	var copyArgs []string
	if requireRootPrivileges {
		copyArgs = append(copyArgs, "sudo")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	copyArgs = append(copyArgs, "/bin/sh", "-c", fmt.Sprintf("cat %s > %s", srcPath, destPath))
	return exec.CommandContext(ctx, copyArgs[0], copyArgs[1:]...).Run()
}

var logArg = regexp.MustCompile(`--log(\s*=?\s*)(\S+)`)

func getLogPath(cmd string) (string, error) {
	var logPath string
	tmp := logArg.FindStringSubmatch(cmd)
	if len(tmp) == 3 {
		logPath = tmp[2]
	} else {
		logPath = filepath.Join(getDefaultLogDir(), "juicefs.log")
	}

	return logPath, nil
}

func closeFile(file *os.File) {
	if err := file.Close(); err != nil {
		logger.Fatalf("failed to close file %s: %v", file.Name(), err)
	}
}

func getPprofPort(pid, amp string, requireRootPrivileges bool) (int, error) {
	cfg := vfs.Config{}
	_ = utils.WithTimeout(context.TODO(), func(context.Context) error {
		content, err := readConfig(amp)
		if err != nil {
			logger.Warnf("failed to read config file: %v", err)
		}
		if err := json.Unmarshal(content, &cfg); err != nil {
			logger.Warnf("failed to unmarshal config file: %v", err)
		}
		return nil
	}, 3*time.Second)

	if cfg.Port != nil {
		if len(strings.Split(cfg.Port.DebugAgent, ":")) >= 2 {
			if port, err := strconv.Atoi(strings.Split(cfg.Port.DebugAgent, ":")[1]); err != nil {
				logger.Warnf("failed to parse debug agent port: %v", err)
			} else {
				return port, nil
			}
		}
	}

	var lsofArgs []string
	if requireRootPrivileges {
		lsofArgs = append(lsofArgs, "sudo")
	}
	lsofArgs = append(lsofArgs, "/bin/sh", "-c", "lsof -i -nP | grep -v grep | grep LISTEN | grep "+pid)
	ret, err := exec.Command(lsofArgs[0], lsofArgs[1:]...).CombinedOutput()
	if err != nil {
		return 0, fmt.Errorf("failed to execute command `%s`: %v", strings.Join(lsofArgs, " "), err)
	}
	logger.Debugf("lsof output: \n%s", string(ret))
	lines := strings.Split(string(ret), "\n")
	if len(lines) == 0 {
		return 0, fmt.Errorf("pprof will be collected, but no listen port")
	}

	var listenPort = -1
	for _, line := range lines {
		fields := strings.Fields(line)
		if len(fields) != 0 {
			port, err := func() (port int, err error) {
				defer func() {
					e := recover()
					if e != nil {
						err = fmt.Errorf("failed to parse listen port: %v", e)
					}
				}()
				port, err = strconv.Atoi(strings.Split(fields[len(fields)-2], ":")[1])
				if err != nil {
					logger.Errorf("failed to parse port %v: %v", port, err)
				}
				return
			}()
			if err != nil {
				continue
			}
			if port >= 6060 && port <= 6099 && port > listenPort {
				if err := checkPort(port, amp); err == nil {
					listenPort = port
				}
				continue
			}
		}
	}

	if listenPort == -1 {
		return 0, fmt.Errorf("no valid pprof port found")
	}
	return listenPort, nil
}

func getRequest(url string, timeout time.Duration) ([]byte, error) {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("error creating GET request: %v", err)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("error GET request: %v", err)
	}
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("error GET request, status code %d", resp.StatusCode)
	}

	defer func(body io.ReadCloser) {
		if err := body.Close(); err != nil {
			logger.Errorf("error closing body: %v", err)
		}
	}(resp.Body)
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("error reading response: %v", err)
	}

	return body, nil
}

// check pprof service status
func checkPort(port int, amp string) error {
	url := fmt.Sprintf("http://localhost:%d/debug/pprof/cmdline?debug=1", port)
	resp, err := getRequest(url, 3*time.Second)
	if err != nil {
		return fmt.Errorf("error checking pprof alive: %v", err)
	}
	resp = bytes.ReplaceAll(resp, []byte{0}, []byte{' '})
	fields := strings.Fields(string(resp))
	flag := false
	for _, field := range fields {
		if amp == field {
			flag = true
		}
	}
	if !flag {
		return fmt.Errorf("mount point mismatch: \n%s\n%s", resp, amp)
	}
	return nil
}

type metricItem struct {
	name, url string
}

func reqAndSaveMetric(name string, metric metricItem, outDir string, timeout time.Duration) error {
	resp, err := getRequest(metric.url, timeout)
	if err != nil {
		return fmt.Errorf("error getting metric: %v", err)
	}
	retPath := filepath.Join(outDir, fmt.Sprintf("juicefs.%s", metric.name))
	retFile, err := os.Create(retPath)
	if err != nil {
		logger.Fatalf("error creating metric file %s: %v", retPath, err)
	}
	defer closeFile(retFile)

	if name == "cmdline" {
		resp = bytes.ReplaceAll(resp, []byte{0}, []byte{' '})
	}

	writer := bufio.NewWriter(retFile)
	if _, err := writer.Write(resp); err != nil {
		return fmt.Errorf("failed to write metric %s: %v", name, err)
	}
	return writer.Flush()
}

func checkAgent(cmd string) bool {
	for _, field := range strings.Fields(cmd) {
		if field == "--no-agent" {
			return false
		}
	}
	return true
}

func geneZipFile(srcPath, destPath string) error {
	zipFile, err := os.Create(destPath)
	if err != nil {
		return err
	}
	defer closeFile(zipFi
```

### Core Architecture Module: `cmd/debug_unix.go`
```
//go:build !windows
// +build !windows

/*
 * JuiceFS, Copyright 2025 Juicedata, Inc.
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

package cmd

import (
	"context"
	"encoding/json"
	"fmt"
	"os/exec"
	"strconv"
	"strings"
	"time"

	"github.com/juicedata/juicefs/pkg/utils"
	"github.com/juicedata/juicefs/pkg/vfs"
)

func getCmdMount(mp string) (uid, pid, cmd string, err error) {
	var tmpPid string
	_ = utils.WithTimeout(context.TODO(), func(context.Context) error {
		content, err := readConfig(mp)
		if err != nil {
			logger.Warnf("failed to read config file: %v", err)
		}
		cfg := vfs.Config{}
		if err := json.Unmarshal(content, &cfg); err != nil {
			logger.Warnf("failed to unmarshal config file: %v", err)
		}
		if cfg.Pid != 0 {
			tmpPid = strconv.Itoa(cfg.Pid)
		}
		return nil
	}, 3*time.Second)

	var psArgs []string
	if tmpPid != "" {
		pid = tmpPid
		psArgs = []string{"/bin/sh", "-c", fmt.Sprintf("ps -f -p %s", pid)}
	} else {
		psArgs = []string{"/bin/sh", "-c", fmt.Sprintf("ps -ef | grep -v grep | grep mount | grep %s", mp)}
	}
	ret, err := exec.Command(psArgs[0], psArgs[1:]...).CombinedOutput()
	if err != nil {
		return "", "", "", fmt.Errorf("failed to execute command `%s`: %v", strings.Join(psArgs, " "), err)
	}
	var find bool
	var ppid string
	lines := strings.Split(string(ret), "\n")
	for i := len(lines) - 1; i >= 0; i-- {
		line := lines[i]
		fields := strings.Fields(line)
		if len(fields) <= 7 {
			continue
		}
		cmdFields := fields[7:]
		for _, arg := range cmdFields {
			if mp == arg {
				if find {
					newCmd := strings.Join(fields[7:], " ")
					newUid, newPid, newPpid := strings.TrimSpace(fields[0]), strings.TrimSpace(fields[1]), strings.TrimSpace(fields[2])
					if newPid == ppid {
						return uid, pid, cmd, nil
					} else if pid == newPpid {
						return newUid, newPid, newCmd, nil
					} else {
						return "", "", "", fmt.Errorf("find more than one mount process for %s", mp)
					}
				}
				cmd = strings.Join(fields[7:], " ")
				uid, pid, ppid = strings.TrimSpace(fields[0]), strings.TrimSpace(fields[1]), strings.TrimSpace(fields[2])
				find = true
			}
		}
	}
	if cmd == "" {
		return "", "", "", fmt.Errorf("no mount command found for %s", mp)
	}
	return uid, pid, cmd, nil
}

```

### Core Architecture Module: `cmd/debug_windows.go`
```
package cmd

/*
 * JuiceFS, Copyright 2025 Juicedata, Inc.
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

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/juicedata/juicefs/pkg/utils"
	"github.com/juicedata/juicefs/pkg/vfs"
	"golang.org/x/sys/windows"
)

func getprocessCommandLine(pid int) (string, error) {
	cmd := exec.Command("wmic", "process", "where", "ProcessID="+strconv.Itoa(pid), "get", "CommandLine")
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("failed to run command line: %s, %v", cmd.String(), err)
	}

	lines := strings.Split(string(out), "\r\n")
	if len(lines) < 2 {
		return "", fmt.Errorf("failed to find command line for pid: %d", pid)
	}

	for _, line := range lines[1:] {
		sline := strings.TrimSpace(line)
		if sline == "" {
			continue
		}
		return sline, nil
	}

	return "", fmt.Errorf("cannot find command line for pid %d. If the juicefs are mounted at background, Please rerun this with the admin permission.", pid)
}

func findMountProcess(mp string) (int, error) {
	processName := filepath.Base(os.Args[0])
	cmd := exec.Command("wmic", "process", "where", fmt.Sprintf("name='%s'", processName), "get", "CommandLine,ProcessId")
	out, err := cmd.CombinedOutput()
	if err != nil {
		return 0, fmt.Errorf("failed to exec command line: %s, %s", cmd.String(), err)
	}

	lines := strings.Split(string(out), "\r\n")
	if len(lines) < 2 {
		return 0, fmt.Errorf("failed to find mount process")
	}

	mp = strings.TrimRight(mp, "\\")
	for _, line := range lines[1:] {
		sline := strings.TrimSpace(line)

		if sline == "" {
			continue
		}

		// the first part of commandline contains 'xxx/mount.exe"'
		slines := strings.SplitN(sline, ".exe\" ", 2)
		if len(slines) < 2 {
			logger.Warnf("failed to split command line: %s", sline)
			continue
		}

		sline = slines[1]
		logger.Infof("sline: %s", sline)

		args := strings.Split(sline, " ")
		if len(args) < 3 {
			continue
		}
		mpFound := false
		mountFound := false
		for _, arg := range args {
			arg = strings.TrimSpace(arg)
			if arg == "" {
				continue
			}

			if arg == "mount" {
				mountFound = true
				continue
			}

			arg = strings.TrimRight(arg, "\\")

			if strings.EqualFold(arg, mp) {
				mpFound = true
			}
		}

		if mpFound && mountFound {
			// THE LAST PART IS PID
			pid, err := strconv.Atoi(args[len(args)-1])
			if err != nil {
				return 0, fmt.Errorf("failed to parse pid: %s", args[len(args)-1])
			}
			return pid, nil
		}
	}

	return 0, fmt.Errorf("cannot find the mount process for %s", mp)
}

func getProcessUserSid(pid int) (string, error) {
	h, err := windows.OpenProcess(windows.PROCESS_QUERY_INFORMATION, false, uint32(pid))
	if err != nil {
		return "", err
	}
	defer windows.CloseHandle(h)

	var token windows.Token
	err = windows.OpenProcessToken(h, windows.TOKEN_QUERY, &token)
	if err != nil {
		return "", err
	}
	defer token.Close()

	user, err := token.GetTokenUser()
	if err != nil {
		return "", err
	}

	return user.User.Sid.String(), nil

}

func getCmdMount(mp string) (uid, pid, cmd string, err error) {
	var tmpPid string
	_ = utils.WithTimeout(context.TODO(), func(context.Context) error {
		content, err := readConfig(mp)
		if err != nil {
			logger.Warnf("failed to read config file: %v", err)
		}
		cfg := vfs.Config{}
		if err := json.Unmarshal(content, &cfg); err != nil {
			logger.Warnf("failed to unmarshal config file: %v", err)
		}
		if cfg.Pid != 0 {
			tmpPid = strconv.Itoa(cfg.Pid)
		}
		return nil
	}, 3*time.Second)

	foundPid := 0
	if tmpPid != "" {
		pid = tmpPid
		foundPid, err = strconv.Atoi(pid)
		if err != nil {
			return "", "", "", fmt.Errorf("failed to parse pid: %s", pid)
		}
	} else {
		foundPid, err = findMountProcess(mp)
		if err != nil {
			return "", "", "", err
		}

		pid = strconv.Itoa(foundPid)
	}

	cmd, err = getprocessCommandLine(foundPid)
	if err != nil {
		return "", "", "", err
	}

	uid, err = getProcessUserSid(foundPid)
	if err != nil {
		return "", "", "", err
	}

	return uid, pid, cmd, nil
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

### Incident Patch 1: `7ca76c6e` (2026-09-29)
**Commit Message**: test(object): fix data race on err in multipart upload test (#7581)

Signed-off-by: Git'Fellow <12234510+solracsf@users.noreply.github.com>

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

### Incident Patch 2: `7cbb3dfe` (2026-09-28)
**Commit Message**: CI: fix pysdk failed (#7585)

Signed-off-by: miyang <myang@juicedata.io>

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

### Incident Patch 3: `b2489c35` (2026-09-22)
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

### Incident Patch 4: `51c657c7` (2026-09-21)
**Commit Message**: chunk: fix zstd decompression overwriting adjacent slices (#7556)

Co-authored-by: Claude <noreply@anthropic.com>
Co-authored-by: jiefenghuang <jiefeng@juicedata.io>

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

### Incident Patch 5: `277570a3` (2026-09-15)
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

---

### Incident Patch 6: `34b8f398` (2026-09-15)
**Commit Message**: chunk: exit the fallback watchdog after switching to memory cache (#7505)

Co-authored-by: jiefenghuang <jiefeng@juicedata.io>

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

### Incident Patch 7: `30387489` (2026-09-14)
**Commit Message**: CI: fix the MinIO image address (#7536)

Signed-off-by: miyang <myang@juicedata.io>

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

---

### Incident Patch 8: `55f38139` (2026-09-02)
**Commit Message**: sdk: fix python sdk ctypes ABI widths (#7486)

Co-authored-by: jiefenghuang <jiefeng@juicedata.io>
Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>

**File**: `.github/scripts/pysdk/pysdk_test.py` (modified, +39/-0)
```diff
@@ -3,6 +3,7 @@
 import unittest
 import os
 import pwd
+import stat
 from os.path import dirname
 import sys
 import time
@@ -233,6 +234,44 @@ def test_directory_link_nonlocal(self):
         assert self.v.readlink(src) == '../some_dir'
 
 
+class ListdirTests(FileTests):
+    def test_listdir_empty(self):
+        d = os.path.join(TESTFN, 'empty_dir')
+        self.v.mkdir(d)
+        self.assertEqual(self.v.listdir(d), [])
+        self.assertEqual(self.v.listdir(d, detail=True), [])
+
+    def test_listdir_names(self):
+        d = os.path.join(TESTFN, 'names_dir')
+        self.v.mkdir(d)
+        names = ['a', 'b' * 200, 'with space', '中文名字']
+        for n in names:
+            self.create_file(os.path.join(d, n))
+        self.v.mkdir(os.path.join(d, 'subdir'))
+        self.assertEqual(sorted(self.v.listdir(d)), sorted(names + ['subdir']))
+
+    def test_listdir_detail(self):
+        d = os.path.join(TESTFN, 'detail_dir')
+        self.v.mkdir(d)
+        self.create_file(os.path.join(d, 'f'), b'0123456789')
+        self.v.mkdir(os.path.join(d, 'sub'))
+        infos = dict(self.v.listdir(d, detail=True))
+        self.assertEqual(sorted(infos), ['f', 'sub'])
+        self.assertTrue(stat.S_ISREG(infos['f'].st_mode))
+        self.assertEqual(infos['f'].st_size, 10)
+        self.assertTrue(stat.S_ISDIR(infos['sub'].st_mode))
+
+    def test_listdir_many(self):
+        d = os.path.join(TESTFN, 'many_dir')
+        self.v.mkdir(d)
+        names = ['file_%03d' % i for i in range(200)]
+        for n in names:
+            self.create_file(os.path.join(d, n))
+        self.assertEqual(sorted(self.v.listdir(d)), sorted(names))
+        infos = self.v.listdir(d, detail=True)
+        self.assertEqual(sorted(n for n, _ in infos), sorted(names))
+
+
 class ExtendedAttributeTests(FileTests):
     def _check_xattrs_str(self, s, getxattr, setxattr, removexattr, listxattr, **kwargs):
         fn = TESTFN + '_xattr'
```

**File**: `sdk/java/libjfs/main.go` (modified, +6/-3)
```diff
@@ -1226,15 +1226,17 @@ func jfs_listXattr(pid int64, h int64, path *C.char, buf uintptr, bufsize int32)
 }
 
 //export jfs_listXattr2
-func jfs_listXattr2(pid int64, h int64, path *C.char, value **C.char, size *int) int32 {
+func jfs_listXattr2(pid int64, h int64, path *C.char, value **C.char, size *int64) int32 {
+	*value = nil
+	*size = 0
 	w := F(h)
 	if w == nil {
 		return EINVAL
 	}
 	t, err := w.ListXattr(w.withPid(pid), C.GoString(path))
 	if err == 0 {
 		*value = C.CString(string(t))
-		*size = len(t)
+		*size = int64(len(t))
 	}
 	return errno(err)
 }
@@ -1697,6 +1699,8 @@ func jfs_listdir(pid int64, h int64, cpath *C.char, offset int64, buf uintptr, b
 func jfs_listdir2(pid int64, h int64, cpath *C.char, plus bool, buf **byte, size *int64) int32 {
 	var ctx meta.Context
 	var f *fs.File
+	*buf = nil
+	*size = 0
 	w := F(h)
 	if w == nil {
 		return EINVAL
@@ -1712,7 +1716,6 @@ func jfs_listdir2(pid int64, h int64, cpath *C.char, plus bool, buf **byte, size
 		return ENOTDIR
 	}
 
-	*size = 0
 	if plus {
 		es, err := f.ReaddirPlus(ctx, 0)
 		if err != 0 {
```

**File**: `sdk/python/juicefs/juicefs/juicefs.py` (modified, +5/-6)
```diff
@@ -278,11 +278,10 @@ def rename(self, old, new):
     def listdir(self, path, detail=False):
         """Return a list containing the names of the entries in the directory given by path."""
         buf = c_void_p()
-        size = c_int()
-        # func jfs_listdir(pid int, h int64, cpath *C.char, offset int, buf uintptr, bufsize int) int {
+        size = c_int64()
 
         self.lib.jfs_listdir2(c_int64(_tid()), c_int64(self.h), _bin(path), bool(detail), byref(buf), byref(size))
-        data = string_at(buf, size)
+        data = string_at(buf, size.value)
         infos = []
         pos = 0
         while pos < len(data):
@@ -356,9 +355,9 @@ def getxattr(self, path, name):
     def listxattr(self, path):
         """List extended attributes on a file."""
         buf = c_void_p()
-        size = c_int()
+        size = c_int64()
         self.lib.jfs_listXattr2(c_int64(_tid()), c_int64(self.h), _bin(path), byref(buf), byref(size))
-        data = string_at(buf, size).decode()
+        data = string_at(buf, size.value).decode()
         self.lib.free(buf)
         if not data:
             return []
@@ -420,7 +419,7 @@ def summary(self, path, depth=0, entries=1):
         """Get the summary of a directory."""
         buf = c_void_p()
 
-        n = self.lib.jfs_gettreesummary(_tid(), self.h, _bin(path), c_uint8(depth), c_uint32(entries), byref(buf))
+        n = self.lib.jfs_gettreesummary(c_int64(_tid()), c_int64(self.h), _bin(path), c_uint8(depth), c_uint8(entries), byref(buf))
         data = string_at(buf, n)
         res = json.loads(str(data, encoding='utf-8'))
 
```

---

### Incident Patch 9: `537ed545` (2026-08-27)
**Commit Message**: CI: fix sync MinIO gateway startup race (#7470)

Co-authored-by: jiefenghuang <jiefeng@juicedata.io>

**File**: `.github/scripts/sync/sync_minio.sh` (modified, +27/-12)
```diff
@@ -129,33 +129,48 @@ test_sync_list_object_symlink(){
 
 prepare_test(){
     umount_jfs /jfs $META_URL
+    stop_gateway
     python3 .github/scripts/flush_meta.py $META_URL
     rm -rf /var/jfs/myjfs
     rm -rf /var/jfsCache/myjfs
     (./mc rb myminio/myjfs > /dev/null 2>&1 --force || true) && ./mc mb myminio/myjfs
     ./juicefs format $META_URL myjfs
     ./juicefs mount -d $META_URL /jfs
-    lsof -i :9005 | awk 'NR!=1 {print $2}' | xargs -r kill -9 || true
     MINIO_ROOT_USER=minioadmin MINIO_ROOT_PASSWORD=minioadmin ./juicefs gateway $META_URL localhost:9005 &
-    wait_gateway_ready
+    wait_gateway_ready $!
     ./mc alias set juicegw http://localhost:9005 minioadmin minioadmin --api S3v4
 }
 
+stop_gateway(){
+    local timeout=100
+    lsof -tiTCP:9005 -sTCP:LISTEN | xargs -r kill -9 || true
+    for _ in $(seq 1 $timeout); do
+        if ! lsof -tiTCP:9005 -sTCP:LISTEN > /dev/null 2>&1; then
+            return
+        fi
+        sleep 0.1
+    done
+    echo "gateway is still listening on port 9005"
+    return 1
+}
+
 wait_gateway_ready(){
-    timeout=30
+    local gateway_pid=$1
+    local timeout=30
     for i in $(seq 1 $timeout); do
-        if [[ -z $(lsof -i :9005) ]]; then
-            echo "$i Waiting for port 9005 to be ready..."
-            sleep 1
-        else
+        if ! kill -0 "$gateway_pid" 2>/dev/null; then
+            echo "gateway process exited before becoming ready"
+            return 1
+        fi
+        if curl -fsS --connect-timeout 1 --max-time 2 http://localhost:9005/minio/health/cluster > /dev/null 2>&1; then
             echo "gateway is now ready on port 9005"
-            break
+            return
         fi
+        echo "$i Waiting for gateway to be ready..."
+        sleep 1
     done
-    if [[ -z $(lsof -i :9005) ]]; then
-        echo "gateway is not ready after $timeout seconds"
-        exit 1
-    fi
+    echo "gateway is not ready after $timeout seconds"
+    return 1
 }
 
 create_sparse_marker_file(){
```

---

### Incident Patch 10: `14ef6d4a` (2026-08-27)
**Commit Message**: cmd/warmup: treat malformed range suffix as path (#7463)

**File**: `pkg/vfs/fill.go` (modified, +0/-6)
```diff
@@ -47,16 +47,10 @@ type ByteRange struct {
 // targetRe matches "path [start-end;...]"
 var targetRe = regexp.MustCompile(`^(.*\S)\s+\[([0-9]+-[0-9]+(?:;[0-9]+-[0-9]+)*)\]$`)
 
-// bracketSuffixRe detects a trailing bracket group
-var bracketSuffixRe = regexp.MustCompile(`\s\[[^\[\]]*\]$`)
-
 // SplitTarget splits a warmup target into its path and byte ranges.
 func SplitTarget(target string) (path, spec string, ranges []ByteRange, err error) {
 	m := targetRe.FindStringSubmatch(target)
 	if m == nil {
-		if bracketSuffixRe.MatchString(target) {
-			return "", "", nil, fmt.Errorf("malformed byte ranges, expect %q", "path [start-end;...]")
-		}
 		return target, "", nil, nil
 	}
 	if ranges, err = parseRanges(m[2]); err != nil {
```

**File**: `pkg/vfs/fill_test.go` (modified, +20/-6)
```diff
@@ -51,6 +51,19 @@ func TestFill(t *testing.T) {
 	v.cacheFiller.Cache(meta.Background(), WarmupCache, []string{"/test/file", "/sym2", "/sym3", "/.stats", "/not_exists"}, 2, nil)
 }
 
+func TestFillLiteralBracketPath(t *testing.T) {
+	v, _ := createTestVFS(nil, "")
+	ctx := NewLogContext(meta.Background())
+	fe, fh, _ := v.Create(ctx, 1, "file [abc]", 0644, 0, uint32(os.O_WRONLY))
+	v.Release(ctx, fe.Inode, fh)
+
+	resp := &CacheResponse{Locations: make(map[string]uint64)}
+	v.cacheFiller.Cache(meta.Background(), WarmupCache, []string{"/file [abc]"}, 2, resp)
+	if resp.FileCount != 1 {
+		t.Fatalf("warmed files: %d, want 1", resp.FileCount)
+	}
+}
+
 func TestParseRanges(t *testing.T) {
 	tests := []struct {
 		name    string
@@ -97,11 +110,12 @@ func TestSplitTarget(t *testing.T) {
 		{"/data/file.lance [0-100]", "/data/file.lance", "0-100", false},
 		{"/data/my file.lance [0-100;200-300]", "/data/my file.lance", "0-100;200-300", false},
 		{"inode:42 [0-100]", "inode:42", "0-100", false},
-		// malformed range groups are rejected rather than read as part of the path
-		{"/data/file [0-100 200-300]", "", "", true},
-		{"/data/file [abc]", "", "", true},
-		{"/data/file []", "", "", true},
-		{"/data/file [0-100;]", "", "", true},
+		// Targets that do not match the range syntax are treated as paths.
+		{"/data/file [0-100 200-300]", "/data/file [0-100 200-300]", "", false},
+		{"/data/file [abc]", "/data/file [abc]", "", false},
+		{"/data/file []", "/data/file []", "", false},
+		{"/data/file [0-100;]", "/data/file [0-100;]", "", false},
+		// Syntactically valid but invalid ranges are still rejected.
 		{"/data/file [100-50]", "", "", true},
 	}
 	for _, tt := range tests {
@@ -194,7 +208,7 @@ func TestFillWithRanges(t *testing.T) {
 	// Bad cases: range beyond file size should still work (slices beyond file size won't exist)
 	v.cacheFiller.Cache(meta.Background(), WarmupCache, []string{"/test/bigfile [1000000-2000000]"}, 2, nil)
 
-	// Bad cases: malformed ranges are skipped instead of warming the whole file
+	// Bad cases: invalid ranges and nonexistent literal bracket paths are skipped
 	v.cacheFiller.Cache(meta.Background(), WarmupCache, []string{"/test/bigfile [100-50]", "/test/bigfile [abc]"}, 2, nil)
 }
 
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
