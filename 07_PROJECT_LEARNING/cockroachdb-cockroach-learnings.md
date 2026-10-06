# Forensic Learning Record (Deep Inspection): cockroachdb/cockroach

> **Canonical Artifact**: `07_PROJECT_LEARNING/cockroachdb-cockroach-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/cockroachdb/cockroach](https://github.com/cockroachdb/cockroach))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:56:45.645Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `cockroachdb/cockroach`
- **Description**: CockroachDB — the cloud native, distributed SQL database designed for high availability, effortless scale, and control over data placement.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 32552 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `pkg/acceptance/util_cluster.go`
```
// Copyright 2015 The Cockroach Authors.
//
// Use of this software is governed by the CockroachDB Software License
// included in the /LICENSE file.

package acceptance

import (
	"context"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/cockroachdb/cockroach/pkg/acceptance/cluster"
	"github.com/cockroachdb/cockroach/pkg/testutils"
	"github.com/cockroachdb/cockroach/pkg/util/log"
	"github.com/cockroachdb/cockroach/pkg/util/stop"
	"github.com/cockroachdb/errors"
)

const (
	dockerTest = "runMode=docker"
)

var stopper = stop.NewStopper()

// RunDocker runs the given acceptance test using a Docker cluster.
func RunDocker(t *testing.T, testee func(t *testing.T)) {
	maybeSkipTest(t)
	t.Run(dockerTest, testee)
}

// turns someTest#123 into someTest when invoked with ReplicaAllLiteralString.
// This is useful because the go test harness automatically disambiguates
// subtests in that way when they are invoked multiple times with the same name,
// and we sometimes call RunDocker multiple times in tests.
var reStripTestEnumeration = regexp.MustCompile(`#\d+$`)

// StartCluster starts a cluster from the relevant flags. All test clusters
// should be created through this command since it sets up the logging in a
// unified way.
func StartCluster(ctx context.Context, t *testing.T, cfg cluster.TestConfig) (c cluster.Cluster) {
	var completed bool
	defer func() {
		if !completed && c != nil {
			c.AssertAndStop(ctx, t)
		}
	}()

	parts := strings.Split(t.Name(), "/")
	if len(parts) < 2 {
		t.Fatal("must invoke RunDocker")
	}

	var runMode string
	for _, part := range parts[1:] {
		part = reStripTestEnumeration.ReplaceAllLiteralString(part, "")
		switch part {
		case dockerTest:
			if runMode != "" {
				t.Fatalf("test has more than one run mode: %s and %s", runMode, part)
			}
			runMode = part
		}
	}

	switch runMode {
	case dockerTest:
		var logDir string
		isRemote := os.Getenv("REMOTE_EXEC")
		if len(isRemote) > 0 {
			logDir = os.Getenv("TEST_UNDECLARED_OUTPUTS_DIR")
			if logDir != "" {
				logDir = filepath.Join(logDir, "logs")
			}
		} else {
			logDir = *flagLogDir
		}
		if logDir != "" {
			logDir = filepath.Join(logDir, filepath.Clean(t.Name()))
		}
		l := cluster.CreateDocker(ctx, cfg, logDir, stopper)
		l.Start(ctx)
		c = l

	default:
		t.Fatalf("unable to run in mode %q, use RunDocker", runMode)
	}

	// Don't wait for replication unless requested (usually it is).
	if !cfg.NoWait && cfg.InitMode != cluster.INIT_NONE {
		wantedReplicas := 3
		if numNodes := c.NumNodes(); numNodes < wantedReplicas {
			wantedReplicas = numNodes
		}

		// We actually start zero-node clusters in the reference tests. For one-node
		// clusters, no replication is possible, so we can also skip this step.
		if wantedReplicas > 1 {
			log.Dev.Infof(ctx, "waiting for first range to have %d replicas", wantedReplicas)

			testutils.SucceedsSoon(t, func() error {
				select {
				case <-stopper.ShouldQuiesce():
					t.Fatal("interrupted")
				case <-time.After(time.Second):
				}

				// Always talk to node 0 because it's guaranteed to exist.
				db, err := c.NewDB(ctx, 0)
				if err != nil {
					t.Fatal(err)
				}
				rows, err := db.Query(`SELECT array_length(replicas, 1) FROM crdb_internal.ranges LIMIT 1`)
				if err != nil {
					// Versions <= 1.1 do not contain the crdb_internal table, which is what's used
					// to determine whether a cluster has up-replicated. This is relevant for the
					// version upgrade acceptance test. Just skip the replication check for this case.
					if testutils.IsError(err, "(table|relation) \"crdb_internal.ranges\" does not exist") {
						return nil
					}
					t.Fatal(err)
				}
				defer rows.Close()
				var foundReplicas int
				if rows.Next() {
					if err = rows.Scan(&foundReplicas); err != nil {
						t.Fatalf("unable to scan for length of replicas array: %s", err)
					}
					if log.V(1) {
						log.Dev.Infof(ctx, "found %d replicas", foundReplicas)
					}
				} else {
					return errors.Errorf("no ranges listed")
				}

				if foundReplicas < wantedReplicas {
					return errors.Errorf("expected %d replicas, only found %d", wantedReplicas, foundReplicas)
				}
				return nil
			})
		}

		// Ensure that all nodes are serving SQL by making sure a simple
		// read-only query succeeds.
		for i := 0; i < c.NumNodes(); i++ {
			testutils.SucceedsSoon(t, func() error {
				db, err := c.NewDB(ctx, i)
				if err != nil {
					return err
				}
				if _, err := db.Exec("SHOW DATABASES"); err != nil {
					return err
				}
				return nil
			})
		}
	}

	completed = true
	return c
}

```

### Core Architecture Module: `pkg/acceptance/util_docker.go`
```
// Copyright 2015 The Cockroach Authors.
//
// Use of this software is governed by the CockroachDB Software License
// included in the /LICENSE file.

package acceptance

import (
	"context"
	"crypto/rand"
	"fmt"
	"io/fs"
	"math/big"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	"github.com/cockroachdb/cockroach/pkg/acceptance/cluster"
	"github.com/cockroachdb/cockroach/pkg/base"
	"github.com/cockroachdb/cockroach/pkg/build/bazel"
	"github.com/cockroachdb/cockroach/pkg/security/username"
	"github.com/cockroachdb/cockroach/pkg/testutils/skip"
	"github.com/cockroachdb/cockroach/pkg/util/envutil"
	"github.com/cockroachdb/cockroach/pkg/util/log"
	"github.com/containerd/containerd/platforms"
	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
)

func defaultContainerConfig() container.Config {
	return container.Config{
		Image: acceptanceImage,
		Env: []string{
			fmt.Sprintf("PGUSER=%s", username.RootUser),
			fmt.Sprintf("PGPORT=%s", base.DefaultPort),
			"PGSSLCERT=/certs/client.root.crt",
			"PGSSLKEY=/certs/client.root.key",
		},
		Entrypoint: []string{"autouseradd", "-u", "roach", "-C", "/home/roach", "--"},
	}
}

// testDockerFail ensures the specified docker cmd fails.
func testDockerFail(ctx context.Context, t *testing.T, name string, cmd []string) {
	containerConfig := defaultContainerConfig()
	containerConfig.Cmd = cmd
	if err := testDockerSingleNode(ctx, t, name, containerConfig); err == nil {
		t.Error("expected failure")
	}
}

// testDockerSuccess ensures the specified docker cmd succeeds.
func testDockerSuccess(ctx context.Context, t *testing.T, name string, cmd []string) {
	containerConfig := defaultContainerConfig()
	containerConfig.Cmd = cmd
	if err := testDockerSingleNode(ctx, t, name, containerConfig); err != nil {
		t.Error(err)
	}
}

const (
	// Iterating against a locally built version of the docker image can be done
	// by changing acceptanceImage to the hash of the container.
	acceptanceImage = "us-east1-docker.pkg.dev/crl-ci-images/cockroach/acceptance:20250612-132728"
)

func testDocker(
	ctx context.Context, t *testing.T, num int, name string, containerConfig container.Config,
) error {
	maybeSkipTest(t)
	var err error
	RunDocker(t, func(t *testing.T) {
		var pwd string
		pwd, err = os.Getwd()
		if err != nil {
			return
		}
		testdataDir := filepath.Join(pwd, "testdata")
		if bazel.BuiltWithBazel() {
			testdataDir, err = os.MkdirTemp("", "")
			if err != nil {
				t.Fatal(err)
			}
			// Copy runfiles symlink content to a temporary directory to avoid broken symlinks in docker.
			err = copyRunfiles("testdata", testdataDir)
			if err != nil {
				t.Fatal(err)
			}
			defer func() {
				_ = os.RemoveAll(testdataDir)
			}()
		}
		hostConfig := container.HostConfig{
			NetworkMode: "host",
			Binds:       []string{testdataDir + ":/mnt/data"},
		}
		if bazel.BuiltWithBazel() {
			interactivetestsDir, err := os.MkdirTemp("", "")
			if err != nil {
				t.Fatal(err)
			}
			// Copy runfiles symlink content to a temporary directory to avoid broken symlinks in docker.
			err = copyRunfiles("../cli/interactive_tests", interactivetestsDir)
			if err != nil {
				t.Fatal(err)
			}
			defer func() {
				_ = os.RemoveAll(interactivetestsDir)
			}()
			hostConfig.Binds = append(hostConfig.Binds, interactivetestsDir+":/mnt/interactive_tests")
		}

		// Add a randomID to the container name to avoid overlap between tests running on
		// different shards.
		var nBig *big.Int
		nBig, err = rand.Int(rand.Reader, big.NewInt(10000000))
		if err != nil {
			t.Fatal(err)
		}
		n := nBig.Int64()
		name = name + "-" + strconv.Itoa(int(n))

		// Prepare the docker cluster.
		// We need to do this "under" the directory preparation above so as
		// to prevent the test from crashing because the directory gets
		// deleted before the container shutdown assertions get a chance to run.
		cfg := cluster.TestConfig{
			Name:     name,
			Duration: *flagDuration,
		}
		for i := 0; i < num; i++ {
			cfg.Nodes = append(cfg.Nodes, cluster.NodeConfig{Stores: []cluster.StoreConfig{{}}})
		}
		l := StartCluster(ctx, t, cfg).(*cluster.DockerCluster)

		var preserveLogs bool
		defer func() {
			// Check the final health of the cluster nodes and
			// stop the cluster after that.
			l.AssertAndStop(ctx, t)

			// Note: we must be careful to clean up the volumes *after*
			// the cluster has been shut down (in the `AssertAndStop` call).
			// Otherwise, the directory removal will cause the cluster nodes
			// to crash and report abnormal termination, even when the test
			// succeeds otherwise.
			log.Dev.Infof(ctx, "cleaning up docker volume")
			l.Cleanup(ctx, preserveLogs)
		}()

		if len(l.Nodes) > 0 {
			containerConfig.Env = append(containerConfig.Env, "PGHOST="+l.Hostname(0))
		}

		log.Dev.Infof(ctx, "starting one-shot container")
		err = l.OneShot(
			ctx, acceptanceImage, types.ImagePullOptions{}, containerConfig, hostConfig,
			platforms.DefaultSpec(), "docker-"+name,
		)
		log.Dev.Infof(ctx, "one-shot container terminated: %v", err)
		preserveLogs = err != nil
	})
	return err
}

// Bazel uses symlinks in the runfiles directory. If a directory with symlinks is mounted inside a docker container,
// the symlinks point to not existing destination.
// This function copies the content of the symlinks to another directory,
// so the files can be used inside a docker container. The caller function is responsible for cleaning up.
// This function doesn't copy the original file permissions and uses 755 for directories and files.
func copyRunfiles(source, destination string) error {
	return filepath.WalkDir(source, func(path string, dirEntry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		relPath := strings.Replace(path, source, "", 1)
		if relPath == "" {
			return nil
		}
		if dirEntry.IsDir() {
			return os.Mkdir(filepath.Join(destination, relPath), 0755)
		}
		data, err := os.ReadFile(filepath.Join(source, relPath))
		if err != nil {
			return err
		}
		return os.WriteFile(filepath.Join(destination, relPath), data, 0755)
	})
}

func testDockerSingleNode(
	ctx context.Context, t *testing.T, name string, containerConfig container.Config,
) error {
	return testDocker(ctx, t, 1, name, containerConfig)
}

func testDockerOneShot(
	ctx context.Context, t *testing.T, name string, containerConfig container.Config,
) error {
	return testDocker(ctx, t, 0, name, containerConfig)
}

var cmdBase = []string{
	"/usr/bin/env",
	"COCKROACH_SKIP_UPDATE_CHECK=1",
	"COCKROACH_CRASH_REPORTS=",
	// Disable metamorphic testing for acceptance tests, since they are
	// end-to-end tests and metamorphic constants can make them too slow.
	"COCKROACH_INTERNAL_DISABLE_METAMORPHIC_TESTING=true",
	"/bin/bash",
	"-c",
}

func runTestDockerCLI(t *testing.T, testNameSuffix, testFilePath string) {
	containerConfig := defaultContainerConfig()
	containerConfig.Cmd = []string{"stat", cluster.CockroachBinaryInContainer}
	containerConfig.Env = []string{
		"CI=1", // Disables the initial color query by the termenv library.
		fmt.Sprintf("PGUSER=%s", username.RootUser),
		fmt.Sprintf("COCKROACH_DEV_LICENSE=%s", envutil.EnvOrDefaultString("COCKROACH_DEV_LICENSE", "")),
	}
	ctx := context.Background()
	if err := testDockerOneShot(ctx, t, "cli_test_"+testNameSuffix, containerConfig); err != nil {
		skip.IgnoreLintf(t, "TODO(dt): No binary in one-shot container, see #6086: %s", err)
	}

	containerPath := "/go/src/github.com/cockroachdb/cockroach/cli/interactive_tests"
	if bazel.BuiltWithBazel() {
		containerPath = "/mnt/interactive_tests"
	}
	testFile := filepath.Base(testFilePath)
	testPath := filepath.Join(containerPath, testFile)
	t.Run(testFile, func(t *testing.T) {
		log.Dev.Infof(ctx, "-- starting tests from: %s", testFile)

		// Symlink the logs directory to /logs, which is visible outside of the
		// container and preserved if the test fails. (They don't write to /logs
		// directly because they are often run manually outside of Docker, where
		// /logs is unlikely to exist.)
		cmd := "ln -s /logs logs"

		// We run the expect command using 'bash -c "(expect ...)"'.
		//
		// We cannot run "expect" directly, nor "bash -c 'expect ...'",
		// because both cause Expect to become the PID 1 process inside
		// the container. On Unix, orphan processes need to be wait()ed
		// upon by the PID 1 process when they terminate, lest they
		// remain forever in the zombie state. Unfortunately, Expect
		// does not contain code to do this. Bash does.
		cmd += "; (expect -d -f " + testPath + " " + cluster.CockroachBinaryInContainer + ")"
		containerConfig.Cmd = append(cmdBase, cmd)

		if err := testDockerOneShot(ctx, t, "cli_test_"+testNameSuffix, containerConfig); err != nil {
			t.Error(err)
		}
	})
}

```

### Core Architecture Module: `pkg/backup/backupinfo/external_sst_util.go`
```
// Copyright 2025 The Cockroach Authors.
//
// Use of this software is governed by the CockroachDB Software License
// included in the /LICENSE file.

package backupinfo

import (
	"bytes"
	"context"

	"github.com/cockroachdb/cockroach/pkg/backup/backupencryption"
	"github.com/cockroachdb/cockroach/pkg/cloud"
	"github.com/cockroachdb/cockroach/pkg/jobs/jobspb"
	"github.com/cockroachdb/cockroach/pkg/keys"
	"github.com/cockroachdb/cockroach/pkg/kv/kvpb"
	"github.com/cockroachdb/cockroach/pkg/storage"
	"github.com/cockroachdb/pebble/objstorage"
)

func makeWriter(
	ctx context.Context,
	dest cloud.ExternalStorage,
	filename string,
	enc *jobspb.BackupEncryptionOptions,
	kmsEnv cloud.KMSEnv,
) (objstorage.Writable, error) {
	var w objstorage.Writable
	w, err := cloud.OpenAbortableWriter(ctx, dest, filename)
	if err != nil {
		return nil, err
	}

	if enc != nil {
		key, err := backupencryption.GetEncryptionKey(ctx, enc, kmsEnv)
		if err != nil {
			return nil, err
		}
		encW, err := storage.EncryptingWriter(w, key)
		if err != nil {
			return nil, err
		}
		w = encW
	}
	return w, nil
}

var iterOpts = storage.IterOptions{
	KeyTypes:   storage.IterKeyTypePointsOnly,
	LowerBound: keys.LocalMax,
	UpperBound: keys.MaxKey,
}

type sliceIterator[T any] struct {
	backingSlice []T
	idx          int
}

func newSlicePointerIterator[T any](backing []T) *sliceIterator[T] {
	return &sliceIterator[T]{
		backingSlice: backing,
	}
}

func (s *sliceIterator[T]) Valid() (bool, error) {
	return s.idx < len(s.backingSlice), nil
}

func (s *sliceIterator[T]) Value() *T {
	if s.idx < len(s.backingSlice) {
		return &s.backingSlice[s.idx]
	}

	return nil
}

func (s *sliceIterator[T]) Next() {
	s.idx++
}

func (s *sliceIterator[T]) Close() {
}

type bytesIter struct {
	Iter storage.SimpleMVCCIterator

	prefix      []byte
	useMVCCNext bool
	iterError   error
}

type resultWrapper struct {
	key   storage.MVCCKey
	value []byte
}

func makeBytesIter(
	ctx context.Context,
	store cloud.ExternalStorage,
	path string,
	prefix []byte,
	enc *jobspb.BackupEncryptionOptions,
	useMVCCNext bool,
	kmsEnv cloud.KMSEnv,
) bytesIter {
	var encOpts *kvpb.FileEncryptionOptions
	if enc != nil {
		key, err := backupencryption.GetEncryptionKey(ctx, enc, kmsEnv)
		if err != nil {
			return bytesIter{iterError: err}
		}
		encOpts = &kvpb.FileEncryptionOptions{Key: key}
	}

	iter, err := storage.ExternalSSTReader(ctx, []storage.StoreFile{{Store: store,
		FilePath: path}}, encOpts, iterOpts)
	if err != nil {
		return bytesIter{iterError: err}
	}

	iter.SeekGE(storage.MakeMVCCMetadataKey(prefix))
	return bytesIter{
		Iter:        iter,
		prefix:      prefix,
		useMVCCNext: useMVCCNext,
	}
}

func (bi *bytesIter) next(resWrapper *resultWrapper) bool {
	if bi.iterError != nil {
		return false
	}

	valid, err := bi.Iter.Valid()
	if err != nil || !valid || !bytes.HasPrefix(bi.Iter.UnsafeKey().Key, bi.prefix) {
		bi.iterError = err
		return false
	}

	key := bi.Iter.UnsafeKey()
	resWrapper.key.Key = key.Key.Clone()
	resWrapper.key.Timestamp = key.Timestamp
	resWrapper.value = resWrapper.value[:0]
	v, err := bi.Iter.UnsafeValue()
	if err != nil {
		bi.close()
		bi.iterError = err
		return false
	}
	resWrapper.value = append(resWrapper.value, v...)

	if bi.useMVCCNext {
		bi.Iter.NextKey()
	} else {
		bi.Iter.Next()
	}
	return true
}

func (bi *bytesIter) err() error {
	return bi.iterError
}

func (bi *bytesIter) close() {
	if bi.Iter != nil {
		bi.Iter.Close()
		bi.Iter = nil
	}
}

```

### Core Architecture Module: `pkg/backup/backupsink/sink_utils.go`
```
// Copyright 2022 The Cockroach Authors.
//
// Use of this software is governed by the CockroachDB Software License
// included in the /LICENSE file.

package backupsink

import (
	"bytes"
	"fmt"

	"github.com/cockroachdb/cockroach/pkg/base"
	"github.com/cockroachdb/cockroach/pkg/keys"
	"github.com/cockroachdb/cockroach/pkg/roachpb"
	"github.com/cockroachdb/cockroach/pkg/sql/execinfrapb"
	"github.com/cockroachdb/cockroach/pkg/util/unique"
)

// ElidedPrefix returns the prefix of the key that is elided by the given mode.
func ElidedPrefix(key roachpb.Key, mode execinfrapb.ElidePrefix) ([]byte, error) {
	switch mode {
	case execinfrapb.ElidePrefix_TenantAndTable:
		rest, err := keys.StripTablePrefix(key)
		if err != nil {
			return nil, err
		}
		return key[: len(key)-len(rest) : len(key)-len(rest)], nil

	case execinfrapb.ElidePrefix_Tenant:
		rest, err := keys.StripTenantPrefix(key)
		if err != nil {
			return nil, err
		}
		return key[: len(key)-len(rest) : len(key)-len(rest)], nil
	}
	return nil, nil
}

// adjustFileEndKey checks if the export respsonse end key can be used as a
// split point during restore. If the end key is not splitable (i.e. it splits
// two column families in the same row), the function will attempt to adjust the
// endkey to become splitable. The function returns the potentially adjusted
// end key and whether this end key is mid row/unsplitable (i.e. splits a 2
// column families or mvcc versions).
func adjustFileEndKey(endKey, maxPointKey, maxRangeEnd roachpb.Key) (roachpb.Key, bool) {
	maxKey := maxPointKey
	if maxKey.Compare(maxRangeEnd) < 0 {
		maxKey = maxRangeEnd
	}

	endRowKey, err := keys.EnsureSafeSplitKey(endKey)
	if err != nil {
		// If the key does not parse a family key, it must be from reaching the end
		// of a range and be a range boundary.
		return endKey, false
	}

	// If the end key parses as a family key but truncating to the row key does
	// _not_ produce a row key greater than every key in the file, then one of two
	// things has happened: we *did* stop at family key mid-row, so we copied some
	// families after the row key but have more to get in the next file -- so we
	// must *not* flush now -- or the file ended at a range boundary that _looks_
	// like a family key due to a numeric suffix, so the (nonsense) truncated key
	// is now some prefix less than the last copied key. The latter is unfortunate
	// but should be rare given range-sized export requests.
	if endRowKey.Compare(maxKey) <= 0 {
		return endKey, true
	}

	// If the file end does parse as a family key but the truncated 'row' key is
	// still above any key in the file, the end key likely came from export's
	// iteration stopping early and setting the end to the resume key, i.e. the
	// next real family key. In this case, we are not mid-row, but want to adjust
	// our span end -- and where we resume the next file -- to be this row key.
	// Thus return the truncated row key and false.
	return endRowKey, false

}

func generateUniqueSSTName(nodeID base.SQLInstanceID) string {
	// The data/ prefix, including a /, is intended to group SSTs in most of the
	// common file/bucket browse UIs.
	return fmt.Sprintf("data/%d.sst",
		unique.GenerateUniqueInt(unique.ProcessUniqueID(nodeID)))
}

// isContiguousSpan returns true if the first span ends where the second span begins.
func isContiguousSpan(first, second roachpb.Span) bool {
	return first.EndKey.Equal(second.Key)
}

// sameElidedPrefix returns true if the elided prefix of a and b are equal based
// on the given mode.
func sameElidedPrefix(a, b roachpb.Key, mode execinfrapb.ElidePrefix) (bool, error) {
	prefixA, err := ElidedPrefix(a, mode)
	if err != nil {
		return false, err
	}
	prefixB, err := ElidedPrefix(b, mode)
	if err != nil {
		return false, err
	}
	return bytes.Equal(prefixA, prefixB), nil
}

```

### Core Architecture Module: `pkg/backup/backuputils/memory_backed_quota_pool.go`
```
// Copyright 2023 The Cockroach Authors.
//
// Use of this software is governed by the CockroachDB Software License
// included in the /LICENSE file.

package backuputils

import (
	"context"
	"fmt"

	"github.com/cockroachdb/cockroach/pkg/util/mon"
	"github.com/cockroachdb/cockroach/pkg/util/quotapool"
	"github.com/cockroachdb/cockroach/pkg/util/syncutil"
	"github.com/cockroachdb/errors"
	"github.com/cockroachdb/redact"
)

// MemoryBackedQuotaPool is an IntPool backed up by a memory monitor. Users of
// MemoryBackedQuotaPool can acquire capacity from the IntPool, but the capacity
// of the IntPool can only be increased by acquiring the corresponding amount of
// memory from the backing memory monitor.
type MemoryBackedQuotaPool struct {
	mon *mon.BytesMonitor
	mem *mon.BoundAccount

	// capacityMu synchronizes operations related to the capacity
	// of quotaPool.
	capacityMu syncutil.Mutex
	quotaPool  *quotapool.IntPool
}

// NewMemoryBackedQuotaPool creates a MemoryBackedQuotaPool from a parent
// monitor m with a limit.
func NewMemoryBackedQuotaPool(
	ctx context.Context, m *mon.BytesMonitor, name redact.SafeString, limit int64,
) *MemoryBackedQuotaPool {
	q := MemoryBackedQuotaPool{
		quotaPool: quotapool.NewIntPool(fmt.Sprintf("%s-pool", name), 0),
	}

	if m != nil {
		q.mon = mon.NewMonitorInheritWithLimit(mon.MakeName(name), limit, m, false /* longLiving */)
		q.mon.StartNoReserved(ctx, m)
		mem := q.mon.MakeBoundAccount()
		q.mem = &mem
	}
	return &q
}

// TryAcquireMaybeIncreaseCapacity tries to acquire size from the pool. On
// success, a non-nil alloc is returned and Release() must be called on it to
// return the quota to the pool. If the acquire fails because of not enough
// quota, it will repeatedly attempt to increase the capacity of the pool until
// the acquire succeeds. If the capacity increase fails, then the function will
// return with the error quotapool.ErrNotEnoughQuota.
//
// Safe for concurrent use.
func (q *MemoryBackedQuotaPool) TryAcquireMaybeIncreaseCapacity(
	ctx context.Context, size uint64,
) (*quotapool.IntAlloc, error) {
	for {
		alloc, err := q.quotaPool.TryAcquire(ctx, size)
		if err == nil || !errors.Is(err, quotapool.ErrNotEnoughQuota) {
			return alloc, err
		}

		// Not enough quota, attempt to grow the memory to increase quota pool
		// capacity
		if err := q.IncreaseCapacity(ctx, size); err != nil {
			return nil, quotapool.ErrNotEnoughQuota
		}
	}
}

// Acquire acquires size from the pool. On success, a non-nil alloc is
// returned and Release() must be called on it to return the quota to the pool.
//
// Safe for concurrent use.
func (q *MemoryBackedQuotaPool) Acquire(
	ctx context.Context, size uint64,
) (*quotapool.IntAlloc, error) {
	return q.quotaPool.Acquire(ctx, size)
}

// Release will release allocs back to the pool.
func (q *MemoryBackedQuotaPool) Release(allocs ...*quotapool.IntAlloc) {
	q.quotaPool.Release(allocs...)
}

// IncreaseCapacity will attempt to increase the capacity of the pool. Returns
// true if the increase succeeds and false otherwise.
//
// Safe for concurrent use.
func (q *MemoryBackedQuotaPool) IncreaseCapacity(ctx context.Context, size uint64) error {
	q.capacityMu.Lock()
	defer q.capacityMu.Unlock()

	if err := q.mem.Grow(ctx, int64(size)); err != nil {
		c := q.quotaPool.Capacity()
		return errors.Wrapf(err, "failed to increase capacity from %d to %d", c, c+size)
	}

	q.quotaPool.UpdateCapacity(q.quotaPool.Capacity() + size)
	return nil
}

// Capacity returns the capacity of the pool.
func (q *MemoryBackedQuotaPool) Capacity() uint64 {
	q.capacityMu.Lock()
	defer q.capacityMu.Unlock()
	return q.quotaPool.Capacity()
}

// Close closes the pool and returns the reserved memory to the backing memory
// monitor.
func (q *MemoryBackedQuotaPool) Close(ctx context.Context) {
	if q.mem != nil {
		q.mem.Close(ctx)
	}

	if q.mon != nil {
		q.mon.Stop(ctx)
	}
}

```

### Core Architecture Module: `pkg/backup/backuputils/utils.go`
```
// Copyright 2022 The Cockroach Authors.
//
// Use of this software is governed by the CockroachDB Software License
// included in the /LICENSE file.

package backuputils

import (
	"encoding/hex"
	"net/url"
	"path"
	"regexp"
	"strings"
	"time"

	"github.com/cockroachdb/cockroach/pkg/cloud"
	"github.com/cockroachdb/cockroach/pkg/util/encoding"
	"github.com/cockroachdb/errors"
)

// URLSeparator represents the standard separator used in backup URLs.
const URLSeparator = '/'

// RedactURIForErrorMessage redacts any storage secrets before returning a URI which is safe to
// return to the client in an error message.
func RedactURIForErrorMessage(uri string) string {
	redactedURI, err := cloud.SanitizeExternalStorageURI(uri, []string{})
	if err != nil {
		return "<uri_failed_to_redact>"
	}
	return redactedURI
}

// JoinURLPath forces a relative path join by removing any leading slash, then
// re-prepending it later.
//
// Stores are an odd combination of absolute and relative path.
// They present as absolute paths, since they contain a hostname. URL.Parse
// thus prepends each URL.Path with a leading slash.
// But some schemes, e.g. nodelocal, can legally travel _above_ the ostensible
// root (e.g. nodelocal://0/.../). This is not typically possible in file
// paths, and the standard path package doesn't like it. Specifically, it will
// clean up something like nodelocal://0/../ to nodelocal://0. This is normally
// correct behavior, but is wrong here.
//
// In point of fact we block this URLs resolved this way elsewhere. But we
// still want to make sure to resolve the paths correctly here. We don't want
// to accidentally correct an unauthorized file path to an authorized one, then
// write a backup to an unexpected place or print the wrong error message on
// a restore.
func JoinURLPath(args ...string) string {
	argsCopy := make([]string, 0)
	for _, arg := range args {
		if len(arg) == 0 {
			continue
		}
		// We only want non-empty tokens.
		argsCopy = append(argsCopy, arg)
	}
	if len(argsCopy) == 0 {
		return path.Join(argsCopy...)
	}

	// We have at least 1 arg, and each has at least length 1.
	isAbs := false
	if argsCopy[0][0] == URLSeparator {
		isAbs = true
		argsCopy[0] = argsCopy[0][1:]
	}
	joined := path.Join(argsCopy...)
	if isAbs {
		joined = string(URLSeparator) + joined
	}
	return joined
}

// AppendPaths appends the tailDir to the `path` of the passed in uris.
func AppendPaths(uris []string, tailDir ...string) ([]string, error) {
	retval := make([]string, len(uris))
	for i, uri := range uris {
		appended, err := AppendPath(uri, tailDir...)
		if err != nil {
			return nil, err
		}
		retval[i] = appended
	}
	return retval, nil
}

// AppendPath appends the tailDir to the `path` of the passed in uri.
func AppendPath(uri string, tailDir ...string) (string, error) {
	parsed, err := url.Parse(uri)
	if err != nil {
		return "", err
	}
	joinArgs := append([]string{parsed.Path}, tailDir...)
	parsed.Path = JoinURLPath(joinArgs...)
	return parsed.String(), nil
}

// EncodeDescendingTS encodes a time.Time in a way such that later timestamps
// sort lexicographically before earlier timestamps. It is encoded as a hex
// string with millisecond precision.
//
// Note: This encoding only supports times within 292 million years of the Unix
// epoch. If you have a time after that, welcome to the 21st century, I hope you
// enjoy your stay.
func EncodeDescendingTS(ts time.Time) string {
	var buffer []byte
	buffer = encoding.EncodeUvarintDescending(buffer, uint64(ts.UnixMilli()))
	return hex.EncodeToString(buffer)
}

// DecodeDescendingTS decodes a time.Time encoded with EncodeDescendingTS.
func DecodeDescendingTS(encoded string) (time.Time, error) {
	buffer, err := hex.DecodeString(encoded)
	if err != nil {
		return time.Time{}, err
	}
	_, tsMillis, err := encoding.DecodeUvarintDescending(buffer)
	if err != nil {
		return time.Time{}, err
	}
	return time.UnixMilli(int64(tsMillis)), nil
}

// AbsoluteBackupPathInCollectionURI returns the absolute path of a backup
// assuming the root is the collection URI. Backup URI represents the URI that
// points to the directory containing the backup manifest of the backup. Since
// this is an absolute path, it always starts with `/`. Any trailing slash is
// also removed.
//
// Example:
//
//	collectionURI: "nodelocal://1/collection"
//	backupURI: "nodelocal://1/collection/path/to/backup"
//	returns: "/path/to/backup"
func AbsoluteBackupPathInCollectionURI(collectionURI string, backupURI string) (string, error) {
	backupURL, err := url.Parse(backupURI)
	if err != nil {
		return "", err
	}
	collectionURL, err := url.Parse(collectionURI)
	if err != nil {
		return "", err
	}

	if backupURL.Scheme != collectionURL.Scheme || backupURL.Host != collectionURL.Host {
		return "", errors.New("backup URI does not share the same scheme and host as collection URI")
	}

	collectionPath := path.Clean(collectionURL.Path)
	if collectionPath == "." {
		collectionPath = ""
	}
	backupPath := path.Clean(backupURL.Path)
	if backupPath == "." {
		backupPath = ""
	}

	relPath, found := strings.CutPrefix(backupPath, collectionPath)
	if !found {
		return "", errors.New("backup URI not contained within collection URI")
	}

	relPath = strings.TrimSuffix(relPath, string(URLSeparator))
	if len(relPath) == 0 || relPath[0] != URLSeparator {
		relPath = string(URLSeparator) + relPath
	}
	return relPath, nil
}

// NormalizeSubdir takes a provided full backup subdirectory and normalizes it
// to the form /YYYY/MM/DD-HHMMSS.SS with a leading slash and no trailing slash.
func NormalizeSubdir(subdir string) (string, error) {
	subdirPattern := regexp.MustCompile(`\/?\d{4}\/\d{2}\/\d{2}-\d{6}\.\d{2}\/?`)
	if !subdirPattern.Match([]byte(subdir)) {
		return "", errors.Newf(
			`provided subdir "%s" does not match expected format YYYY/MM/DD-HHMMSS.SS`, subdir,
		)
	}
	normalized := strings.TrimSuffix(subdir, string(URLSeparator))
	if normalized[0] != URLSeparator {
		normalized = string(URLSeparator) + normalized
	}
	return normalized, nil
}

```

### Core Architecture Module: `pkg/ccl/changefeedccl/cdcutils/throttle.go`
```
// Copyright 2021 The Cockroach Authors.
//
// Use of this software is governed by the CockroachDB Software License
// included in the /LICENSE file.

package cdcutils

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/cockroachdb/cockroach/pkg/ccl/changefeedccl/changefeedbase"
	"github.com/cockroachdb/cockroach/pkg/settings"
	"github.com/cockroachdb/cockroach/pkg/util/log"
	"github.com/cockroachdb/cockroach/pkg/util/metric"
	"github.com/cockroachdb/cockroach/pkg/util/quotapool"
	"github.com/cockroachdb/cockroach/pkg/util/tracing"
	"github.com/cockroachdb/crlib/crtime"
)

// Throttler is a changefeed IO throttler.
type Throttler struct {
	name           string
	messageLimiter *quotapool.RateLimiter
	byteLimiter    *quotapool.RateLimiter
	flushLimiter   *quotapool.RateLimiter
	metrics        *Metrics
}

// AcquireMessageQuota acquires quota for a message with the specified size.
// Blocks until such quota is available.
func (t *Throttler) AcquireMessageQuota(ctx context.Context, sz int) error {
	if t.messageLimiter.AdmitN(1) && t.byteLimiter.AdmitN(int64(sz)) {
		return nil
	}

	// Slow case.
	var span *tracing.Span
	ctx, span = tracing.ChildSpan(ctx, fmt.Sprintf("quota-wait-%s", t.name))
	defer span.Finish()

	if err := waitQuota(ctx, 1, t.messageLimiter, t.metrics.MessagesPushbackNanos); err != nil {
		return err
	}
	return waitQuota(ctx, int64(sz), t.byteLimiter, t.metrics.BytesPushbackNanos)
}

// AcquireFlushQuota acquires quota for a message with the specified size.
// Blocks until such quota is available.
func (t *Throttler) AcquireFlushQuota(ctx context.Context) error {
	if t.flushLimiter.AdmitN(1) {
		return nil
	}

	// Slow case.
	var span *tracing.Span
	ctx, span = tracing.ChildSpan(ctx, fmt.Sprintf("quota-wait-flush-%s", t.name))
	defer span.Finish()
	return waitQuota(ctx, 1, t.flushLimiter, t.metrics.FlushPushbackNanos)
}

func (t *Throttler) updateConfig(config changefeedbase.SinkThrottleConfig) {
	setLimits := func(rl *quotapool.RateLimiter, rate, burst float64) {
		// set rateBudget to unlimited if rate is 0.
		rateBudget := quotapool.Inf()
		if rate > 0 {
			rateBudget = quotapool.Limit(rate)
		}
		// set burstBudget to be at least the rate.
		burstBudget := int64(burst)
		if burst < rate {
			burstBudget = int64(rate)
		}
		rl.UpdateLimit(rateBudget, burstBudget)
	}

	setLimits(t.messageLimiter, config.MessageRate, config.MessageBurst)
	setLimits(t.byteLimiter, config.ByteRate, config.ByteBurst)
	setLimits(t.flushLimiter, config.FlushRate, config.FlushBurst)
}

// NewThrottler creates a new throttler with the specified configuration.
func NewThrottler(name string, config changefeedbase.SinkThrottleConfig, m *Metrics) *Throttler {
	logSlowAcquisition := quotapool.OnSlowAcquisition(500*time.Millisecond, quotapool.LogSlowAcquisition)
	t := &Throttler{
		name: name,
		messageLimiter: quotapool.NewRateLimiter(
			fmt.Sprintf("%s-messages", name), 0, 0, logSlowAcquisition,
		),
		byteLimiter: quotapool.NewRateLimiter(
			fmt.Sprintf("%s-bytes", name), 0, 0, logSlowAcquisition,
		),
		flushLimiter: quotapool.NewRateLimiter(
			fmt.Sprintf("%s-flushes", name), 0, 0, logSlowAcquisition,
		),
		metrics: m,
	}
	t.updateConfig(config)
	return t
}

var nodeSinkThrottle = struct {
	sync.Once
	*Throttler
}{}

// NodeLevelThrottler returns node level Throttler for changefeeds.
func NodeLevelThrottler(sv *settings.Values, metrics *Metrics) *Throttler {
	getConfig := func() (config changefeedbase.SinkThrottleConfig) {
		configStr := changefeedbase.NodeSinkThrottleConfig.Get(sv)
		if configStr != "" {
			if err := json.Unmarshal([]byte(configStr), &config); err != nil {
				log.Changefeed.Errorf(context.Background(),
					"failed to parse node throttle config %q: err=%v; throttling disabled", configStr, err)
			}
		}
		return
	}

	// Initialize node level throttler once.
	nodeSinkThrottle.Do(func() {
		if nodeSinkThrottle.Throttler != nil {
			panic("unexpected state")
		}
		nodeSinkThrottle.Throttler = NewThrottler("cf.node.throttle", getConfig(), metrics)
		// Update node throttler configs when settings change.
		changefeedbase.NodeSinkThrottleConfig.SetOnChange(sv, func(ctx context.Context) {
			nodeSinkThrottle.Throttler.updateConfig(getConfig())
		})
	})

	return nodeSinkThrottle.Throttler
}

// Metrics is a metric.Struct for kvfeed metrics.
type Metrics struct {
	BytesPushbackNanos    *metric.Counter
	MessagesPushbackNanos *metric.Counter
	FlushPushbackNanos    *metric.Counter
}

// MakeMetrics constructs a Metrics struct with the provided histogram window.
func MakeMetrics(histogramWindow time.Duration) Metrics {
	makeMetric := func(n string) metric.Metadata {
		return metric.Metadata{
			Name:        fmt.Sprintf("changefeed.%s.messages_pushback_nanos", n),
			Help:        fmt.Sprintf("Total time spent throttled for %s quota", n),
			Measurement: "Nanoseconds",
			Unit:        metric.Unit_NANOSECONDS,
			Category:    metric.Metadata_CHANGEFEEDS,
		}
	}

	return Metrics{
		BytesPushbackNanos:    metric.NewCounter(makeMetric("bytes")),
		MessagesPushbackNanos: metric.NewCounter(makeMetric("messages")),
		FlushPushbackNanos:    metric.NewCounter(makeMetric("flush")),
	}
}

var _ metric.Struct = (*Metrics)(nil)

// MetricStruct makes Metrics a metric.Struct.
func (m Metrics) MetricStruct() {}

func waitQuota(
	ctx context.Context, n int64, limit *quotapool.RateLimiter, c *metric.Counter,
) error {
	start := crtime.NowMono()
	defer func() {
		c.Inc(start.Elapsed().Nanoseconds())
	}()
	return limit.WaitN(ctx, n)
}

```

### Core Architecture Module: `pkg/ccl/changefeedccl/kvevent/chunked_event_queue.go`
```
// Copyright 2022 The Cockroach Authors.
//
// Use of this software is governed by the CockroachDB Software License
// included in the /LICENSE file.

package kvevent

import "sync"

const bufferEventChunkArrSize = 128

// bufferEventChunkQueue is a queue implemented as a linked-list of bufferEntry.
// TODO(#120216): This data structure should use `util/queue.Queue`.
type bufferEventChunkQueue struct {
	head, tail *bufferEventChunk
}

func (l *bufferEventChunkQueue) enqueue(e Event) {
	if l.tail == nil {
		chunk := newBufferEntryChunk()
		l.head, l.tail = chunk, chunk
		l.head.push(e) // guaranteed to insert into new chunk
		return
	}

	if !l.tail.push(e) {
		chunk := newBufferEntryChunk()
		l.tail.next = chunk
		l.tail = chunk
		l.tail.push(e) // guaranteed to insert into new chunk
	}
}

func (l *bufferEventChunkQueue) empty() bool {
	return l.head == nil || l.head.empty()
}

func (l *bufferEventChunkQueue) dequeue() (e Event, ok bool) {
	if l.head == nil {
		return Event{}, false
	}

	e, ok, consumedAllFromChunk := l.head.pop()

	if consumedAllFromChunk {
		toFree := l.head
		if l.tail == l.head {
			l.tail = l.head.next
		}
		l.head = l.head.next
		freeBufferEventChunk(toFree)
		if !ok {
			return l.dequeue()
		}
	}

	if !ok {
		return Event{}, false
	}

	return e, true

}

func (l *bufferEventChunkQueue) purge() {
	for l.head != nil {
		chunkToFree := l.head
		l.head = l.head.next
		freeBufferEventChunk(chunkToFree)
	}
	l.tail = l.head
}

type bufferEventChunk struct {
	events [bufferEventChunkArrSize]Event
	// Since bufferEventChunkArrSize may be increased beyond 128 in the future, we
	// can leave this as an int32 for now. Also, bufferEventChunk allocations are
	// pooled, so there should not be a significant increase in memory because of
	// this.
	head, tail int32
	next       *bufferEventChunk // linked-list element
}

var bufferEntryChunkPool = sync.Pool{
	New: func() interface{} {
		return new(bufferEventChunk)
	},
}

func newBufferEntryChunk() *bufferEventChunk {
	return bufferEntryChunkPool.Get().(*bufferEventChunk)
}

func freeBufferEventChunk(c *bufferEventChunk) {
	*c = bufferEventChunk{}
	bufferEntryChunkPool.Put(c)
}

func (bec *bufferEventChunk) push(e Event) (inserted bool) {
	if bec.tail == bufferEventChunkArrSize {
		return false
	}

	bec.events[bec.tail] = e
	bec.tail++
	return true
}

func (bec *bufferEventChunk) pop() (e Event, ok bool, consumedAll bool) {
	if bec.head == bufferEventChunkArrSize {
		return Event{}, false, true
	}

	if bec.head == bec.tail {
		return Event{}, false, false
	}

	e = bec.events[bec.head]
	bec.head++
	return e, true, bec.head == bufferEventChunkArrSize
}

func (bec *bufferEventChunk) empty() bool {
	return bec.tail == bec.head
}

```

### Core Architecture Module: `pkg/ccl/changefeedccl/sink_webhook_v2.go`
```
// Copyright 2023 The Cockroach Authors.
//
// Use of this software is governed by the CockroachDB Software License
// included in the /LICENSE file.

package changefeedccl

import (
	"bytes"
	"context"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/cockroachdb/cockroach/pkg/ccl/changefeedccl/changefeedbase"
	"github.com/cockroachdb/cockroach/pkg/settings/cluster"
	"github.com/cockroachdb/cockroach/pkg/util/admission"
	"github.com/cockroachdb/cockroach/pkg/util/cidr"
	"github.com/cockroachdb/cockroach/pkg/util/httputil"
	"github.com/cockroachdb/cockroach/pkg/util/retry"
	"github.com/cockroachdb/cockroach/pkg/util/timeutil"
	"github.com/cockroachdb/errors"
	"github.com/cockroachdb/redact"
)

const (
	applicationTypeJSON   = `application/json`
	applicationTypeCSV    = `text/csv`
	authorizationHeader   = `Authorization`
	contentEncodingHeader = `Content-Encoding`
	acceptEncodingHeader  = `Accept-Encoding`
	contentTypeHeader     = `Content-Type`
)

func isWebhookSink(u *url.URL) bool {
	switch u.Scheme {
	// Allow HTTP here but throw an error later to make it clear HTTPS is required.
	case changefeedbase.SinkSchemeWebhookHTTP, changefeedbase.SinkSchemeWebhookHTTPS:
		return true
	default:
		return false
	}
}

type webhookSinkClient struct {
	ctx               context.Context
	format            changefeedbase.FormatType
	url               *changefeedbase.SinkURL
	authHeader        string
	additionalHeaders map[string]string
	batchCfg          sinkBatchConfig
	client            *httputil.Client
	settings          *cluster.Settings
	compression       compressionAlgo
}

var _ SinkClient = (*webhookSinkClient)(nil)
var _ SinkPayload = (*http.Request)(nil)

func makeWebhookSinkClient(
	ctx context.Context,
	u *changefeedbase.SinkURL,
	encodingOpts changefeedbase.EncodingOptions,
	opts changefeedbase.WebhookSinkOptions,
	batchCfg sinkBatchConfig,
	parallelism int,
	m metricsRecorder,
	settings *cluster.Settings,
) (SinkClient, error) {
	err := validateWebhookOpts(u, encodingOpts, opts)
	if err != nil {
		return nil, err
	}

	var compression compressionAlgo
	if opts.Compression != "" {
		cType := strings.ToLower(opts.Compression)
		algo, _, err := compressionFromString(cType)
		if err != nil {
			return nil, errors.Wrapf(err, `unsupported compression type "%s"`, cType)
		}
		compression = algo
	}

	u.Scheme = strings.TrimPrefix(u.Scheme, `webhook-`)

	sinkClient := &webhookSinkClient{
		ctx:               ctx,
		authHeader:        opts.AuthHeader,
		additionalHeaders: opts.ExtraHeaders,
		format:            encodingOpts.Format,
		batchCfg:          batchCfg,
		settings:          settings,
		compression:       compression,
	}

	var connTimeout time.Duration
	if opts.ClientTimeout != nil {
		connTimeout = *opts.ClientTimeout
	}
	sinkClient.client, err = makeWebhookClient(u, connTimeout, parallelism, m.netMetrics())
	if err != nil {
		return nil, err
	}

	// Remove known query params from sink URL before setting in sink config.
	sinkURLParsed, err := url.Parse(u.String())
	if err != nil {
		return nil, err
	}
	params := sinkURLParsed.Query()
	params.Del(changefeedbase.SinkParamSkipTLSVerify)
	params.Del(changefeedbase.SinkParamCACert)
	params.Del(changefeedbase.SinkParamClientCert)
	params.Del(changefeedbase.SinkParamClientKey)
	sinkURLParsed.RawQuery = params.Encode()
	sinkClient.url = &changefeedbase.SinkURL{URL: sinkURLParsed}

	return sinkClient, nil
}

func makeWebhookClient(
	u *changefeedbase.SinkURL, timeout time.Duration, parallelism int, nm *cidr.NetMetrics,
) (*httputil.Client, error) {
	client := &httputil.Client{
		Client: &http.Client{
			Timeout: timeout,
			Transport: &http.Transport{
				DialContext:         nm.Wrap((&net.Dialer{Timeout: timeout}).DialContext, "webhook"),
				MaxConnsPerHost:     parallelism,
				MaxIdleConnsPerHost: parallelism,
				IdleConnTimeout:     time.Minute,
				ForceAttemptHTTP2:   true,
			},
		},
	}

	dialConfig := struct {
		tlsSkipVerify bool
		caCert        []byte
		clientCert    []byte
		clientKey     []byte
	}{}

	transport := client.Transport.(*http.Transport)

	if _, err := u.ConsumeBool(changefeedbase.SinkParamSkipTLSVerify, &dialConfig.tlsSkipVerify); err != nil {
		return nil, err
	}
	if err := u.DecodeBase64(changefeedbase.SinkParamCACert, &dialConfig.caCert); err != nil {
		return nil, err
	}
	if err := u.DecodeBase64(changefeedbase.SinkParamClientCert, &dialConfig.clientCert); err != nil {
		return nil, err
	}
	if err := u.DecodeBase64(changefeedbase.SinkParamClientKey, &dialConfig.clientKey); err != nil {
		return nil, err
	}

	transport.TLSClientConfig = &tls.Config{
		InsecureSkipVerify: dialConfig.tlsSkipVerify,
	}

	if dialConfig.caCert != nil {
		caCertPool, err := x509.SystemCertPool()
		if err != nil {
			return nil, errors.Wrap(err, "could not load system root CA pool")
		}
		if caCertPool == nil {
			caCertPool = x509.NewCertPool()
		}
		if !caCertPool.AppendCertsFromPEM(dialConfig.caCert) {
			return nil, errors.Errorf("failed to parse certificate data:%s", string(dialConfig.caCert))
		}
		transport.TLSClientConfig.RootCAs = caCertPool
	}

	if dialConfig.clientCert != nil && dialConfig.clientKey == nil {
		return nil, errors.Errorf(`%s requires %s to be set`, changefeedbase.SinkParamClientCert, changefeedbase.SinkParamClientKey)
	} else if dialConfig.clientKey != nil && dialConfig.clientCert == nil {
		return nil, errors.Errorf(`%s requires %s to be set`, changefeedbase.SinkParamClientKey, changefeedbase.SinkParamClientCert)
	}

	if dialConfig.clientCert != nil && dialConfig.clientKey != nil {
		cert, err := tls.X509KeyPair(dialConfig.clientCert, dialConfig.clientKey)
		if err != nil {
			return nil, errors.Wrap(err, `invalid client certificate data provided`)
		}
		transport.TLSClientConfig.Certificates = []tls.Certificate{cert}
	}

	return client, nil
}

func (sc *webhookSinkClient) makePayloadForBytes(body []byte) (SinkPayload, error) {
	finalBytes := body
	if sc.compression.enabled() {
		var buf bytes.Buffer
		codec, err := newCompressionCodec(sc.compression, &sc.settings.SV, &buf)
		if err != nil {
			return nil, errors.Wrap(err, "failed to create compression codec")
		}
		if _, err := codec.Write(body); err != nil {
			return nil, errors.Wrap(err, "failed to compress payload")
		}
		if err := codec.Close(); err != nil {
			return nil, errors.Wrap(err, "failed to close compression codec")
		}

		finalBytes = buf.Bytes()
	}

	req, err := http.NewRequestWithContext(sc.ctx, http.MethodPost, sc.url.String(), bytes.NewReader(finalBytes))
	if err != nil {
		return nil, err
	}

	sc.setRequestHeaders(req)

	return req, nil
}

// FlushResolvedPayload implements the SinkClient interface.
func (sc *webhookSinkClient) FlushResolvedPayload(
	ctx context.Context, body []byte, _ func(func(topic string) error) error, retryOpts retry.Options,
) error {
	pl, err := sc.makePayloadForBytes(body)
	if err != nil {
		return err
	}
	return retry.WithMaxAttempts(ctx, retryOpts, retryOpts.MaxRetries+1, func() error {
		return sc.Flush(ctx, pl)
	})
}

// readResponseBody handles response body reading and decompression if needed.
func (sc *webhookSinkClient) readResponseBody(res *http.Response) ([]byte, error) {
	encoding := res.Header.Get(contentEncodingHeader)
	if encoding == "" {
		return io.ReadAll(res.Body)
	}

	// Convert the content-encoding header to our internal compression algorithm type.
	algo, _, err := compressionFromString(encoding)
	if err != nil {
		return nil, errors.Wrapf(err,
			"webhook endpoint returned unsupported content encoding: %s", encoding)
	}

	reader, err := newDecompressionReader(algo, res.Body)
	if err != nil {
		return nil, errors.Wrapf(err,
			"failed to create decompression reader for algorithm %s", algo)
	}
	defer reader.Close()

	return io.ReadAll(reader)
}

// Flush implements the SinkClient interface.
func (sc *webhookSinkClient) Flush(ctx context.Context, batch SinkPayload) error {
	req := batch.(*http.Request)
	b, err := req.GetBody()
	if err != nil {
		return err
	}
	req.Body = b
	res, err := sc.client.Do(req)
	if err != nil {
		return errors.Wrap(err, "webhook sink request failed")
	}
	defer res.Body.Close()

	if !(res.StatusCode >= http.StatusOK && res.StatusCode < http.StatusMultipleChoices) {
		// Response body may be compressed, so we need to use our reader with decompression support.
		resBody, err := sc.readResponseBody(res)
		if err != nil {
			return errors.Wrapf(err, "failed to read body for HTTP response with status: %d", res.StatusCode)
		}
		return errors.Newf("webhook sink HTTP error %s: %s",
			redact.Safe(res.Status), resBody)
	}
	return nil
}

// Close implements the SinkClient interface.
func (sc *webhookSinkClient) Close() error {
	sc.client.CloseIdleConnections()
	return nil
}

func (sc *webhookSinkClient) CheckConnection(ctx context.Context) error {
	return nil
}

func (sc *webhookSinkClient) setRequestHeaders(req *http.Request) {
	switch sc.format {
	case changefeedbase.OptFormatJSON:
		req.Header.Set(contentTypeHeader, applicationTypeJSON)
	case changefeedbase.OptFormatCSV:
		req.Header.Set(contentTypeHeader, applicationTypeCSV)
	}

	if sc.compression.enabled() {
		compression := string(sc.compression)
		req.Header.Set(acceptEncodingHeader, compression)
		req.Header.Set(contentEncodingHeader, compression)
	}

	for k, v := range sc.additionalHeaders {
		req.Header.Set(k, v)
	}
	if sc.authHeader != "" {
		req.Header.Set(authorizationHeader, sc.authHeader)
	}
}

func validateWebhookOpts(
	u *changefeedbase.SinkURL,
	encodingOpts changefeedbase.EncodingOptions,
	opts changefeedbase.WebhookSinkOptions,
) error {
	if u.Scheme != changefeedbase.SinkSchemeWebhookHTTPS {
		return errors.Errorf(`this sink requires %s`, changefeedbase.SinkSchemeWebhookHTTPS)
	}

	switch encodingOpts.Format {
	case changefeedbase.OptFormatJSON:
	case changefeedbase.OptFormatCSV:
	default:
		return errors.Errorf(`this sink is incompatible with %s=%s`,
			changefeedbase.OptFormat, encodi
```

### Core Architecture Module: `pkg/cli/clisqlclient/statement_diag.go`
```
// Copyright 2021 The Cockroach Authors.
//
// Use of this software is governed by the CockroachDB Software License
// included in the /LICENSE file.

package clisqlclient

import (
	"context"
	"database/sql/driver"
	"io"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/cockroachdb/errors"
)

// StmtDiagBundleInfo contains information about a statement diagnostics bundle
// that was collected.
type StmtDiagBundleInfo struct {
	ID int64
	// Statement is the SQL statement fingerprint.
	Statement   string
	CollectedAt time.Time
}

// StmtDiagListBundles retrieves information about all available statement
// diagnostics bundles.
func StmtDiagListBundles(ctx context.Context, conn Conn) ([]StmtDiagBundleInfo, error) {
	result, err := stmtDiagListBundlesInternal(ctx, conn)
	if err != nil {
		return nil, errors.Wrap(
			err, "failed to retrieve statement diagnostics bundles",
		)
	}
	return result, nil
}

func stmtDiagListBundlesInternal(ctx context.Context, conn Conn) ([]StmtDiagBundleInfo, error) {
	rows, err := conn.Query(ctx,
		`SELECT id, statement_fingerprint, collected_at
		 FROM system.statement_diagnostics
		 WHERE error IS NULL
		 ORDER BY collected_at DESC`,
	)
	if err != nil {
		return nil, err
	}
	var result []StmtDiagBundleInfo
	vals := make([]driver.Value, 3)
	for {
		if err := rows.Next(vals); err == io.EOF {
			break
		} else if err != nil {
			return nil, err
		}
		i, ok := vals[0].(int64)
		if !ok {
			// We're arriving in this function via the interactive shell,
			// with result type inference disabled.
			// The value has been read as a string.
			i, err = strconv.ParseInt(vals[0].(string), 10, 64)
			if err != nil {
				return nil, err
			}
		}
		d, ok := vals[2].(time.Time)
		if !ok {
			// We're arriving in this function via the interactive shell,
			// with result type inference disabled.
			// The value has been read as a string.
			ts := vals[2].(string)
			ts = strings.TrimSuffix(ts, "+00")
			d, err = time.Parse("2006-01-02 15:04:05.999999", ts)
			if err != nil {
				return nil, err
			}
		}
		info := StmtDiagBundleInfo{
			ID:          i,
			Statement:   vals[1].(string),
			CollectedAt: d,
		}
		result = append(result, info)
	}
	if err := rows.Close(); err != nil {
		return nil, err
	}
	return result, nil
}

// StmtDiagActivationRequest contains information about a statement diagnostics
// activation request.
type StmtDiagActivationRequest struct {
	ID int64
	// Statement is the SQL statement fingerprint.
	Statement string
	// If empty then any plan will do.
	PlanGist string
	// If true and PlanGist is not empty, then any plan not matching the gist
	// will do.
	AntiPlanGist bool
	RequestedAt  time.Time
	// Zero value indicates that there is no sampling probability set on the
	// request.
	SamplingProbability float64
	// Zero value indicates that there is no minimum latency set on the request.
	MinExecutionLatency time.Duration
	// Zero value indicates that the request never expires.
	ExpiresAt time.Time
	// If true, then the redacted bundle is requested.
	Redacted bool
}

// StmtDiagListOutstandingRequests retrieves outstanding statement diagnostics
// activation requests.
func StmtDiagListOutstandingRequests(
	ctx context.Context, conn Conn,
) ([]StmtDiagActivationRequest, error) {
	result, err := stmtDiagListOutstandingRequestsInternal(ctx, conn)
	if err != nil {
		return nil, errors.Wrap(
			err, "failed to retrieve outstanding statement diagnostics activation requests",
		)
	}
	return result, nil
}

func stmtDiagListOutstandingRequestsInternal(
	ctx context.Context, conn Conn,
) ([]StmtDiagActivationRequest, error) {
	// Converting an INTERVAL to a number of milliseconds within that interval
	// is a pain - we extract the number of seconds and multiply it by 1000,
	// then we extract the number of milliseconds and add that up to the
	// previous result; however, we have now double counted the seconds field,
	// so we have to remove that times 1000.
	getMilliseconds := `EXTRACT(epoch FROM min_execution_latency)::INT8 * 1000 +
                        EXTRACT(millisecond FROM min_execution_latency)::INT8 -
                        EXTRACT(second FROM min_execution_latency)::INT8 * 1000`
	rows, err := conn.Query(ctx,
		"SELECT id, statement_fingerprint, requested_at, "+getMilliseconds+`,
                                   expires_at, sampling_probability, plan_gist, anti_plan_gist, redacted
			FROM system.statement_diagnostics_requests
			WHERE NOT completed
			ORDER BY requested_at DESC`,
	)
	if err != nil {
		return nil, err
	}
	var result []StmtDiagActivationRequest
	vals := make([]driver.Value, 9)
	for {
		if err := rows.Next(vals); err == io.EOF {
			break
		} else if err != nil {
			return nil, err
		}
		var minExecutionLatency time.Duration
		var expiresAt time.Time
		var samplingProbability float64
		var planGist string
		var antiPlanGist, redacted bool

		if ms, ok := vals[3].(int64); ok {
			minExecutionLatency = time.Millisecond * time.Duration(ms)
		}
		if e, ok := vals[4].(time.Time); ok {
			expiresAt = e
		}
		if sp, ok := vals[5].(float64); ok {
			samplingProbability = sp
		}
		if gist, ok := vals[6].(string); ok {
			planGist = gist
		}
		if antiGist, ok := vals[7].(bool); ok {
			antiPlanGist = antiGist
		}
		if b, ok := vals[8].(bool); ok {
			redacted = b
		}
		info := StmtDiagActivationRequest{
			ID:                  vals[0].(int64),
			Statement:           vals[1].(string),
			PlanGist:            planGist,
			AntiPlanGist:        antiPlanGist,
			RequestedAt:         vals[2].(time.Time),
			SamplingProbability: samplingProbability,
			MinExecutionLatency: minExecutionLatency,
			ExpiresAt:           expiresAt,
			Redacted:            redacted,
		}
		result = append(result, info)
	}
	if err := rows.Close(); err != nil {
		return nil, err
	}
	return result, nil
}

// StmtDiagDownloadBundle downloads the bundle with the given ID to a file.
func StmtDiagDownloadBundle(ctx context.Context, conn Conn, id int64, filename string) error {
	if err := stmtDiagDownloadBundleInternal(ctx, conn, id, filename); err != nil {
		return errors.Wrapf(
			err, "failed to download statement diagnostics bundle %d to '%s'", id, filename,
		)
	}
	return nil
}

func stmtDiagDownloadBundleInternal(
	ctx context.Context, conn Conn, id int64, filename string,
) error {
	// Retrieve the chunk IDs; these are stored in an INT ARRAY column.
	rows, err := conn.Query(ctx,
		"SELECT unnest(bundle_chunks) FROM system.statement_diagnostics WHERE id = $1",
		id,
	)
	if err != nil {
		return err
	}
	var chunkIDs []int64
	vals := make([]driver.Value, 1)
	for {
		if err := rows.Next(vals); err == io.EOF {
			break
		} else if err != nil {
			return err
		}
		chunkIDs = append(chunkIDs, vals[0].(int64))
	}
	if err := rows.Close(); err != nil {
		return err
	}

	if len(chunkIDs) == 0 {
		return errors.Newf("no statement diagnostics bundle with ID %d", id)
	}

	// Create the file and write out the chunks.
	out, err := os.Create(filename)
	if err != nil {
		return err
	}

	for _, chunkID := range chunkIDs {
		data, err := conn.QueryRow(ctx,
			"SELECT data FROM system.statement_bundle_chunks WHERE id = $1",
			chunkID,
		)
		if err != nil {
			_ = out.Close()
			return err
		}
		if _, err := out.Write(data[0].([]byte)); err != nil {
			_ = out.Close()
			return err
		}
	}

	return out.Close()
}

// StmtDiagDeleteBundle deletes a statement diagnostics bundle.
func StmtDiagDeleteBundle(ctx context.Context, conn Conn, id int64) error {
	_, err := conn.QueryRow(ctx,
		"SELECT 1 FROM system.statement_diagnostics WHERE id = $1",
		id,
	)
	if err != nil {
		if err == io.EOF {
			return errors.Newf("no statement diagnostics bundle with ID %d", id)
		}
		return err
	}
	return conn.ExecTxn(ctx, func(ctx context.Context, conn TxBoundConn) error {
		// Delete the request metadata.
		if err := conn.Exec(ctx,
			"DELETE FROM system.statement_diagnostics_requests WHERE statement_diagnostics_id = $1",
			id,
		); err != nil {
			return err
		}
		// Delete the bundle chunks.
		if err := conn.Exec(ctx,
			`DELETE FROM system.statement_bundle_chunks
			  WHERE id IN (
				  SELECT unnest(bundle_chunks) FROM system.statement_diagnostics WHERE id = $1
				)`,
			id,
		); err != nil {
			return err
		}
		// Finally, delete the diagnostics entry.
		return conn.Exec(ctx,
			"DELETE FROM system.statement_diagnostics WHERE id = $1",
			id,
		)
	})
}

// StmtDiagDeleteAllBundles deletes all statement diagnostics bundles.
func StmtDiagDeleteAllBundles(ctx context.Context, conn Conn) error {
	return conn.ExecTxn(ctx, func(ctx context.Context, conn TxBoundConn) error {
		// Delete the request metadata.
		if err := conn.Exec(ctx,
			"DELETE FROM system.statement_diagnostics_requests WHERE completed",
		); err != nil {
			return err
		}
		// Delete all bundle chunks.
		if err := conn.Exec(ctx,
			`DELETE FROM system.statement_bundle_chunks WHERE true`,
		); err != nil {
			return err
		}
		// Finally, delete the diagnostics entry.
		return conn.Exec(ctx,
			"DELETE FROM system.statement_diagnostics WHERE true",
		)
	})
}

// StmtDiagCancelOutstandingRequest deletes an outstanding statement diagnostics
// activation request.
func StmtDiagCancelOutstandingRequest(ctx context.Context, conn Conn, id int64) error {
	_, err := conn.QueryRow(ctx,
		"DELETE FROM system.statement_diagnostics_requests WHERE id = $1 RETURNING id",
		id,
	)
	if err != nil {
		if err == io.EOF {
			return errors.Newf("no outstanding activation request with ID %d", id)
		}
		return err
	}
	return nil
}

// StmtDiagCancelAllOutstandingRequests deletes all outstanding statement
// diagnostics activation requests.
func StmtDiagCancelAllOutstandingRequests(ctx context.Context, conn Conn) error {
	return conn.Exec(ctx,
		"DELETE FROM system.statement_diagnostics_requests WHERE NOT completed",
	)
}

```

### Core Architecture Module: `pkg/cli/clisqlshell/statement_diag.go`
```
// Copyright 2021 The Cockroach Authors.
//
// Use of this software is governed by the CockroachDB Software License
// included in the /LICENSE file.

package clisqlshell

import (
	"bytes"
	"context"
	"fmt"
	"strconv"
	"text/tabwriter"

	"github.com/cockroachdb/cockroach/pkg/cli/clisqlclient"
	"github.com/cockroachdb/errors"
)

// handleStatementDiag handles the `\statement-diag` command.
func (c *cliState) handleStatementDiag(
	args []string, loopState, errState cliStateEnum,
) (resState cliStateEnum) {
	var cmd string
	if len(args) > 0 {
		cmd = args[0]
		args = args[1:]
	}
	// `\statement-diag download` writes a zip file to the local
	// filesystem with the shell process's UID, so it must be gated by
	// DisableUnsafeCmds. `list` only issues a server-side query and
	// remains enabled. The dispatcher cannot reject this from
	// embedderSafeCmds because the dangerous subcommand is in
	// args[0], not cmd[0].
	if c.sqlCtx.DisableUnsafeCmds && cmd == stmtDiagDownload {
		return c.cliError(errState, errors.Newf(
			"%s %s: command disabled by embedder", cmdStmtDiag, stmtDiagDownload))
	}
	defer c.conn.AllowExecuteInternal(context.Background())()
	var cmdErr error
	switch cmd {
	case stmtDiagList:
		if len(args) > 0 {
			return c.invalidSyntax(errState)
		}
		cmdErr = c.statementDiagList()

	case stmtDiagDownload:
		if len(args) < 1 || len(args) > 2 {
			return c.invalidSyntax(errState)
		}
		id, err := strconv.ParseInt(args[0], 10, 64)
		if err != nil {
			return c.cliError(errState, errors.Wrapf(err, "%q is not a valid bundle ID", args[0]))
		}
		var filename string
		if len(args) > 1 {
			filename = args[1]
		} else {
			filename = fmt.Sprintf("stmt-bundle-%d.zip", id)
		}
		cmdErr = clisqlclient.StmtDiagDownloadBundle(
			context.Background(), c.conn, id, filename)
		if cmdErr == nil {
			fmt.Fprintf(c.iCtx.stdout, "Bundle saved to %q\n", filename)
		}

	default:
		return c.invalidSyntax(errState)
	}

	if cmdErr != nil {
		fmt.Fprintln(c.iCtx.stderr, cmdErr)
		c.exitErr = cmdErr
		return errState
	}
	return loopState
}

func (c *cliState) statementDiagList() error {
	const timeFmt = "2006-01-02 15:04:05 MST"

	// -- List bundles --
	bundles, err := clisqlclient.StmtDiagListBundles(context.Background(), c.conn)
	if err != nil {
		return err
	}

	if len(bundles) == 0 {
		fmt.Fprintf(c.iCtx.stdout, "No statement diagnostics bundles available.\n")
	} else {
		var buf bytes.Buffer
		fmt.Fprintf(c.iCtx.stdout, "Statement diagnostics bundles:\n")
		w := tabwriter.NewWriter(&buf, 4, 0, 2, ' ', 0)
		fmt.Fprint(w, "  ID\tCollection time\tStatement\n")
		for _, b := range bundles {
			fmt.Fprintf(w, "  %d\t%s\t%s\n", b.ID, b.CollectedAt.UTC().Format(timeFmt), b.Statement)
		}
		_ = w.Flush()
		_, _ = buf.WriteTo(c.iCtx.stdout)
	}
	fmt.Fprintln(c.iCtx.stdout)

	return nil
}

```

### Core Architecture Module: `pkg/cli/clisqlshell/statements_value.go`
```
// Copyright 2021 The Cockroach Authors.
//
// Use of this software is governed by the CockroachDB Software License
// included in the /LICENSE file.

package clisqlshell

import "strings"

// StatementsValue is an implementation of pflag.Value that appends any
// argument to a slice.
type StatementsValue []string

// Type implements the pflag.Value interface.
func (s *StatementsValue) Type() string { return "<stmtlist>" }

// String implements the pflag.Value interface.
func (s *StatementsValue) String() string {
	return strings.Join(*s, ";")
}

// Set implements the pflag.Value interface.
func (s *StatementsValue) Set(value string) error {
	*s = append(*s, value)
	return nil
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #176054** (2026-10-05): **basalt-26.3.2-rc-20260914: sql/row: TestRowFetcherMemoryLimits failed**
  *Symptoms*: sql/row.TestRowFetcherMemoryLimits [failed](https://mesolite.cluster.engflow.com/invocations/default/1c91eec4-88ea-40a4-89e4-e9f935748f16?testReportRun=3&testReportShard=1&testReportAttempt=1#targets-Ly9wa2cvc3FsL3Jvdzpyb3dfdGVzdA==) on basalt-26.3.2-rc-20260914 @ [d3eb08ebdd1dacc8d3dac0b107a7db5929e09969](https://github.com/cockroachdb/cockroach/commits/d3eb08ebdd1dacc8d3dac0b107a7db5929e09969):   ``` === RUN   TestRowFetcherMemoryLimits     test_log_scope.go:172: test logs captured to: outputs.zip/logTestRowFetcherMemoryLimits2192898540     test_log_scope.go:82: use -show-logs to present logs inline     test_server_shim.go:168: automatically injected an external process virtual cluster under test; see comment at top of test_server_shim.go for details. ```  Parameters:  - <code>attempt=1</code>  - <code>race=true</code>  - <code>run=3</code>  - <code>shard=1</code> <details><summary>Help</summary> <p>  See also: [How To Investigate a Go Test Failure \(internal\)](https://cockroachlabs.atlassian.net/l/c/HgfXfJgM) </p> </details> <sub>  [This test on roachdash](https://roachdash.crdb.dev/?filter=status:open%20t:.*TestRowFetcherMemoryLimits.*&sort=title+created&display=lastcommented+project) | [Improve this report!](https://github.com/cockroachdb/cockroach/tree/master/pkg/cmd/bazci/githubpost/issues)  </sub>   Jira issue: CRDB-69271
  **Post-Mortem & Fix Analysis**:
  > this branch should be deleted soon

- **Issue #176045** (2026-10-05): **release-26.4: ccl/multiregionccl: TestMrSystemDatabaseUpgrade failed**
  *Symptoms*: ccl/multiregionccl.TestMrSystemDatabaseUpgrade [failed](https://mesolite.cluster.engflow.com/invocations/default/5e0e0bcf-7a83-4fd0-836c-386671709157?testReportRun=1&testReportShard=9&testReportAttempt=1#targets-Ly9wa2cvY2NsL211bHRpcmVnaW9uY2NsOm11bHRpcmVnaW9uY2NsX3Rlc3Q=) on release-26.4 @ [f2023e0d90d6d49ec272fb97ffafbeadcbedc0a3](https://github.com/cockroachdb/cockroach/commits/f2023e0d90d6d49ec272fb97ffafbeadcbedc0a3):  Data race:  ``` WARNING: DATA RACE Write at 0x00c045588030 by goroutine 4075:   github.com/cockroachdb/cockroach/pkg/kv/kvserver.(*Replica).canAttempt1PCEvaluation()       pkg/kv/kvserver/replica_write.go:405 +0x69c   github.com/cockroachdb/cockroach/pkg/kv/kvserver.(*Replica).evaluateWriteBatch()       pkg/kv/kvserver/replica_write.go:448 +0x19b   github.com/cockroachdb/cockroach/pkg/kv/kvserver.(*Replica).evaluateProposal()       pkg/kv/kvserver/replica_proposal.go:1096 +0x25a   github.com/cockroachdb/cockroach/pkg/kv/kvserver.(*Replica).requestToProposal()       pkg/kv/kvserver/replica_proposal.go:1204 +0x14c   github.com/cockroachdb/cockroach/pkg/kv/kvserver.(*Replica).evalAndPropose()       pkg/kv/kvserver/replica_raft.go:129 +0x1da   github.com/cockroachdb/cockroach/pkg/kv/kvserver.(*Replica).executeWriteBatch()       pkg/kv/kvserver/replica_write.go:190 +0xbb9   github.com/cockroachdb/cockroach/pkg/kv/kvserver.(*Replica).executeBatchWithConcurrencyRetries()       pkg/kv/kvserver/replica_send.go:573 +0x682   github.com/cockroachdb/cockroach/pkg/kv/kv
  **Post-Mortem & Fix Analysis**:
  > /investigate
  > ## Investigation: ccl/multiregionccl.TestMrSystemDatabaseUpgrade (data race)  **Investigated failure:** [issue body](https://github.com/cockroachdb/cockroach/issues/176045) — release-26.4, EngFlow invocation `5e0e0bcf-7a83-4fd0-836c-386671709157`, shard 9 **Failure SHA:** `f2023e0d90d6d49ec272fb97ffafbeadcbedc0a3` **Confidence:** high  **TL;DR:** This is not a bug in `TestMrSystemDatabaseUpgrade`. It is the known KV data race in `canAttempt1PCEvaluation`, already diagnosed and **fixed on master** by commit `a987c0cdfb3` ("kvserver: don't mutate the request's txn in canAttempt1PCEvaluation", 2026-09-18, resolves #175561 / #175582). That fix is **not present on release-26.4** at the failure SHA, so the race still reproduces there. The recommended action is to track the 26.4 backport, not to investigate this test.  ### What This Test Does  `TestMrSystemDatabaseUpgrade` ([multiregion_system_table_test.go:552](https://github.com/cockroachdb/cockroach/blob/f2023e0d90d6d49ec272fb97ffafbeadcbe
  > ccl/multiregionccl.TestMrSystemDatabaseUpgrade [failed](https://mesolite.cluster.engflow.com/invocations/default/81ea31df-7acf-4deb-9120-afd8fcd3c1e0?testReportRun=1&testReportShard=9&testReportAttempt=1#targets-Ly9wa2cvY2NsL211bHRpcmVnaW9uY2NsOm11bHRpcmVnaW9uY2NsX3Rlc3Q=) on release-26.4 @ [a354e949ce6d9122b47bc825d5afae2447622616](https://github.com/cockroachdb/cockroach/commits/a354e949ce6d9122b47bc825d5afae2447622616):  Data race:  ``` WARNING: DATA RACE Write at 0x00c02f102390 by goroutine 6523:   github.com/cockroachdb/cockroach/pkg/kv/kvserver.(*Replica).canAttempt1PCEvaluation()       pkg/kv/kvserver/replica_write.go:405 +0x69c   github.com/cockroachdb/cockroach/pkg/kv/kvserver.(*Replica).evaluateWriteBatch()       pkg/kv/kvserver/replica_write.go:448 +0x19b   github.com/cockroachdb/cockroach/pkg/kv/kvserver.(*Replica).evaluateProposal()       pkg/kv/kvserver/replica_proposal.go:1096 +0x25a   github.com/cockroachdb/cockroach/pkg/kv/kvserver.(*Replica).requestToProposal()       

- **Issue #176043** (2026-10-04): **Sentry: overload.go:927: ×(): only one overload can have VariadicType {types.Any} parameters
(1) while executing: SELECT _._(decode(repeat(_, _), _), _, _, decode(repeat(_, _), _), decode(repeat(_, _...**
  *Symptoms*: This issue was auto filed by Sentry. It represents a crash or reported error on a live cluster with telemetry enabled.  Sentry Link: [https://cockroach-labs.sentry.io/issues/7772229943/?referrer=webhooks_plugin](https://cockroach-labs.sentry.io/issues/7772229943/?referrer=webhooks_plugin)  Panic Message:  ``` overload.go:927: ×(): only one overload can have VariadicType {types.Any} parameters (1) while executing: SELECT _._(decode(repeat(_, _), _), _, _, decode(repeat(_, _), _), decode(repeat(_, _), _), decode(repeat(_, _), _), _, decode(repeat(_, _), _))::STRING Wraps: (2) candidate pg code: 22023 Wraps: (3) attached stack trace   -- stack trace:   | github.com/cockroachdb/cockroach/pkg/sql/sem/tree.(*FuncExpr).TypeCheck.func2   | 	pkg/sql/sem/tree/type_check.go:1255   | github.com/cockroachdb/cockroach/pkg/sql/sem/tree.(*FuncExpr).typeCheckWithFuncAncestor   | 	pkg/sql/sem/tree/type_check.go:1193   | github.com/cockroachdb/cockroach/pkg/sql/sem/tree.(*FuncExpr).TypeCheck   | 	pkg/sql/sem/tree/type_check.go:1253   | github.com/cockroachdb/cockroach/pkg/sql/opt/optbuilder.(*plpgsqlBuilder).buildSQLExpr   | 	pkg/sql/opt/optbuilder/plpgsql.go:2436   | github.com/cockroachdb/cockroach/pkg/sql/opt/optbuilder.(*plpgsqlBuilder).buildPLpgSQLStatements   | 	pkg/sql/opt/optbuilder/plpgsql.go:646   | github.com/cockroachdb/cockroach/pkg/sql/opt/optbuilder.(*plpgsqlBuilder).appendPlpgSQLStmts   | 	pkg/sql/opt/optbuilder/plpgsql.go:2313   | github.com/cockroachdb/cockroach/pkg/sql/opt/op
  **Post-Mortem & Fix Analysis**:
  > CC'ing via the CODEOWNERS-based sentry heuristic: * @cockroachdb/sql-queries  Sentry issue cause: pkg/sql/sem/tree/overload.go  <sub>:owl: Hoot! I am a [Blathers](https://github.com/apps/blathers-crl), a bot for [CockroachDB](https://github.com/cockroachdb). My owner is [dev-inf](https://github.com/orgs/cockroachdb/teams/dev-inf).</sub>
  > dup of #176041

- **Issue #176042** (2026-10-04): **Sentry: overload.go:927: ×(): only one overload can have VariadicType {types.Any} parameters
(1) while executing: SELECT _._()
Wraps: (2) candidate pg code: 22023
Wraps: (3) attached stack trace
  --...**
  *Symptoms*: This issue was auto filed by Sentry. It represents a crash or reported error on a live cluster with telemetry enabled.  Sentry Link: [https://cockroach-labs.sentry.io/issues/7772186556/?referrer=webhooks_plugin](https://cockroach-labs.sentry.io/issues/7772186556/?referrer=webhooks_plugin)  Panic Message:  ``` overload.go:927: ×(): only one overload can have VariadicType {types.Any} parameters (1) while executing: SELECT _._() Wraps: (2) candidate pg code: 22023 Wraps: (3) attached stack trace   -- stack trace:   | github.com/cockroachdb/cockroach/pkg/sql/sem/tree.(*FuncExpr).TypeCheck.func2   | 	pkg/sql/sem/tree/type_check.go:1255   | github.com/cockroachdb/cockroach/pkg/sql/sem/tree.(*FuncExpr).typeCheckWithFuncAncestor   | 	pkg/sql/sem/tree/type_check.go:1193   | github.com/cockroachdb/cockroach/pkg/sql/sem/tree.(*FuncExpr).TypeCheck   | 	pkg/sql/sem/tree/type_check.go:1253   | github.com/cockroachdb/cockroach/pkg/sql/sem/tree.(*CastExpr).TypeCheck   | 	pkg/sql/sem/tree/type_check.go:690   | github.com/cockroachdb/cockroach/pkg/sql/sem/tree.(*overloadTypeChecker).typeCheckOverloadedExprs   | 	pkg/sql/sem/tree/overload.go:1085   | github.com/cockroachdb/cockroach/pkg/sql/sem/tree.(*BinaryExpr).TypeCheck   | 	pkg/sql/sem/tree/type_check.go:414   | github.com/cockroachdb/cockroach/pkg/sql/opt/optbuilder.(*plpgsqlBuilder).buildSQLExpr   | 	pkg/sql/opt/optbuilder/plpgsql.go:2436   | github.com/cockroachdb/cockroach/pkg/sql/opt/optbuilder.(*plpgsqlBuilder).buildPLpgSQLStatements 
  **Post-Mortem & Fix Analysis**:
  > CC'ing via the CODEOWNERS-based sentry heuristic: * @cockroachdb/sql-queries  Sentry issue cause: pkg/sql/sem/tree/overload.go  <sub>:owl: Hoot! I am a [Blathers](https://github.com/apps/blathers-crl), a bot for [CockroachDB](https://github.com/cockroachdb). My owner is [dev-inf](https://github.com/orgs/cockroachdb/teams/dev-inf).</sub>
  > dup of #176041

- **Issue #176040** (2026-10-04): **Sentry: error.go:77: unexpected error from the vectorized engine: unhandled cast
(1) plan gist: AgHQAQIADwAAAAcKBQobBQIGAg==
Wraps: (2) while executing: SELECT lag(COALESCE(_, _)) OVER (PARTITION BY _...**
  *Symptoms*: This issue was auto filed by Sentry. It represents a crash or reported error on a live cluster with telemetry enabled.  Sentry Link: [https://cockroach-labs.sentry.io/issues/7772037059/?referrer=webhooks_plugin](https://cockroach-labs.sentry.io/issues/7772037059/?referrer=webhooks_plugin)  Panic Message:  ``` error.go:77: unexpected error from the vectorized engine: unhandled cast (1) plan gist: AgHQAQIADwAAAAcKBQobBQIGAg== Wraps: (2) while executing: SELECT lag(COALESCE(_, _)) OVER (PARTITION BY _ ORDER BY _) FROM _ Wraps: (3) assertion failure Wraps: (4) attached stack trace   -- stack trace:   | github.com/cockroachdb/cockroach/pkg/sql/colexecerror.CatchVectorizedRuntimeError.func1   | 	pkg/sql/colexecerror/error.go:77   | runtime.gopanic   | 	GOROOT/src/runtime/panic.go:783   | github.com/cockroachdb/cockroach/pkg/sql/colexecerror.InternalError   | 	pkg/sql/colexecerror/error.go:301   | github.com/cockroachdb/cockroach/pkg/sql/colexec/colbuilder.NewColOperator   | 	pkg/sql/colexec/colbuilder/execplan.go:1570   | github.com/cockroachdb/cockroach/pkg/sql/colflow.(*vectorizedFlow).Setup.(*vectorizedFlowCreator).setupFlow.func1   | 	pkg/sql/colflow/vectorized_flow.go:1199   | github.com/cockroachdb/cockroach/pkg/sql/colexecerror.CatchVectorizedRuntimeError   | 	pkg/sql/colexecerror/error.go:162   | github.com/cockroachdb/cockroach/pkg/sql/colflow.(*vectorizedFlowCreator).setupFlow   | 	pkg/sql/colflow/vectorized_flow.go:1137   | github.com/cockroachdb/cockroach/pkg/sql/colflo
  **Post-Mortem & Fix Analysis**:
  > CC'ing via the CODEOWNERS-based sentry heuristic: * @cockroachdb/sql-queries  Sentry issue cause: pkg/sql/colexecerror/error.go  <sub>:owl: Hoot! I am a [Blathers](https://github.com/apps/blathers-crl), a bot for [CockroachDB](https://github.com/cockroachdb). My owner is [dev-inf](https://github.com/orgs/cockroachdb/teams/dev-inf).</sub>
  > dup of #175855

- **Issue #176027** (2026-10-03): **release-26.4: sql/inspect: TestDetectIndexConsistencyErrors_PartialIndex failed**
  *Symptoms*: sql/inspect.TestDetectIndexConsistencyErrors_PartialIndex [failed](https://mesolite.cluster.engflow.com/invocations/default/ae3ae5a1-7014-43c0-9fad-fb5bcf07b15d?testReportRun=9&testReportShard=8&testReportAttempt=1#targets-Ly9wa2cvc3FsL2luc3BlY3Q6aW5zcGVjdF90ZXN0) on release-26.4 @ [100bf0ffec278ae008665d3361cd5c6b947a6333](https://github.com/cockroachdb/cockroach/commits/100bf0ffec278ae008665d3361cd5c6b947a6333):   ``` github.com/cockroachdb/cockroach/pkg/rpc.kvAuth.streamDRPCInterceptor({0x215e51256000, {{0x1}, {0x6d7c4e0, 0x215e5084b540}}, 0x1}, {0x6d51580, 0x215e6cf74e08}, {0x215e5a9c76b0, 0x26}, 0x215e546c9940) 	pkg/rpc/auth.go:254 +0x3a6 storj.io/drpc/drpcmux.getChainedStreamHandler.func1.getChainedStreamHandler.1({0x6d51580, 0x215e6cf74e08}) 	external/io_storj_drpc/drpcmux/interceptor.go:77 +0x8e github.com/cockroachdb/cockroach/pkg/server.newDRPCServer.NewDRPCStreamServerRequestMetricsInterceptor.func10({0x6d51580?, 0x215e6cf74e08?}, {0x215e5a9c76b0?, 0x26?}, 0x215e546c9900?) 	pkg/rpc/metrics.go:700 +0x1a9 storj.io/drpc/drpcmux.getChainedStreamHandler.func1({0x6d51580?, 0x215e6cf74e08?}) 	external/io_storj_drpc/drpcmux/interceptor.go:77 +0x132 github.com/cockroachdb/cockroach/pkg/rpc.NewDRPCServer.makeStopperInterceptors.func4.1({0x1be20b8?, 0x6d27e50?}) 	pkg/rpc/drpc.go:378 +0x2b github.com/cockroachdb/cockroach/pkg/util/stop.(*Stopper).RunTaskWithErr(0x215e50f5b950, {0x6d27e50, 0x215e6cf74e08}, {0x215e5a9c76b0, 0x26}, 0x215e57836d20) 	pkg/util/stop/stopper.go:358 +0
  **Post-Mortem & Fix Analysis**:
  > will be fixed by cockroachlabs/cockroach#5188

- **Issue #176022** (2026-10-02): **basalt-26.3.2-rc-20260914: sql: TestAmbiguousCommit failed**
  *Symptoms*: sql.TestAmbiguousCommit [failed](https://mesolite.cluster.engflow.com/invocations/default/9609d599-04c2-41c4-a8e7-6de7afc33857?testReportRun=3&testReportShard=6&testReportAttempt=1#targets-Ly9wa2cvc3FsOnNxbF90ZXN0) on basalt-26.3.2-rc-20260914 @ [d3eb08ebdd1dacc8d3dac0b107a7db5929e09969](https://github.com/cockroachdb/cockroach/commits/d3eb08ebdd1dacc8d3dac0b107a7db5929e09969):   ``` === RUN   TestAmbiguousCommit     test_log_scope.go:172: test logs captured to: outputs.zip/logTestAmbiguousCommit2817823798     test_log_scope.go:82: use -show-logs to present logs inline     ambiguous_commit_test.go:206: -- test log scope end -- test logs left over in: outputs.zip/logTestAmbiguousCommit2817823798 --- FAIL: TestAmbiguousCommit (151.10s) === RUN   TestAmbiguousCommit/ambiguousSuccess=false     test_server_shim.go:168: automatically injected an external process virtual cluster under test; see comment at top of test_server_shim.go for details.     ambiguous_commit_test.go:193: pq: result is ambiguous: error=boom [propagate] (last error: TransactionRetryError: retry txn (RETRY_SERIALIZABLE): "sql txn" meta={id=d335b46f key=/Tenant/10/Table/106/1/1215248657344397313/0 iso=Serializable pri=0.00611446 epo=0 ts=1790934858.058175764,2 min=1790934857.844555432,0 seq=2} lock=true stat=PENDING rts=1790934857.844555432,0 gul=1790934858.344555432,0 obs={n3@1790934861.115083118,0})     ambiguous_commit_test.go:203: expected 1 row(s) but found 0 --- FAIL: TestAmbiguousCommit/ambiguousSuccess=fa
  **Post-Mortem & Fix Analysis**:
  > /investigate
  > ## Investigation: sql: TestAmbiguousCommit/ambiguousSuccess=false  **Investigated failure:** [issue body](https://github.com/cockroachdb/cockroach/issues/176022) (only failure in the thread) **Failure SHA:** `d3eb08ebdd1dacc8d3dac0b107a7db5929e09969` (basalt-26.3.2-rc-20260914, `race=true`) **Confidence:** moderate-to-high (mechanism established from code + artifact timestamps; the exact push source is inferred, not logged)  ### What This Test Does  `TestAmbiguousCommit` injects a fault into the KV transport while a one-row `INSERT` commits, to verify that CockroachDB reports an *ambiguous* result rather than silently duplicating or losing the row. The `ambiguousSuccess=false` subtest blackholes the first `ConditionalPut` RPC *before it reaches any server* ([ambiguous_commit_test.go:110-120](https://github.com/cockroachlabs/cockroach/blob/d3eb08ebdd1dacc8d3dac0b107a7db5929e09969/pkg/sql/ambiguous_commit_test.go#L110-L120)), so the expected outcome is that DistSender transparently retri
  > closing this as a test flake which shouldn't be shown anymore given we opted out of non-race failures on race runs

- **Issue #176020** (2026-10-04): **basalt-26.3: pkg/sql/colenc/colenc_test: TestEncoderEqualityRand failed**
  *Symptoms*: pkg/sql/colenc/colenc_test.TestEncoderEqualityRand [failed](https://mesolite.cluster.engflow.com/invocations/default/303ab993-a4ae-4e94-8b18-29938af8266f?testReportRun=3&testReportShard=1&testReportAttempt=1#targets-Ly9wa2cvc3FsL2NvbGVuYzpjb2xlbmNfdGVzdA==) on basalt-26.3 @ [8f0a4c430c5434fd01580556373e7456655353bc](https://github.com/cockroachdb/cockroach/commits/8f0a4c430c5434fd01580556373e7456655353bc):   ``` === RUN   TestEncoderEqualityRand     test_log_scope.go:172: test logs captured to: outputs.zip/logTestEncoderEqualityRand4009537135     test_log_scope.go:82: use -show-logs to present logs inline     test_server_shim.go:168: automatically injected an external process virtual cluster under test; see comment at top of test_server_shim.go for details.     encode_test.go:273: error executing query="CREATE TABLE t99 (col99_0 BOX2D NOT NULL, PRIMARY KEY (col99_0 ASC), INDEX (col99_0), UNIQUE (col99_0 DESC), UNIQUE (col99_0 DESC), INDEX (col99_0 DESC), INDEX (col99_0), INDEX (col99_0), INDEX (lower(CAST(col99_0 AS STRING)) ASC), INDEX (col99_0 ASC), UNIQUE (col99_0) PARTITION BY LIST (col99_0) (PARTITION t99_part_0 VALUES IN (('BOX(0.41706603788190355 -0.49461846216100863,1.132072352163737 0.7153124791175383)':::BOX2D,), ('BOX(-1.3985117324453311 -1.4377041729124653,-0.6811814762423563 0.9322531176314806)':::BOX2D,)), PARTITION t99_part_1 VALUES IN (('BOX(-10 -10,10 10)':::BOX2D,), ('BOX(-0.34560875125898394 -1.358591706610412,0.5079999507422178 -0.3282515506219498)':::BOX2
  **Post-Mortem & Fix Analysis**:
  > /investigate
  > ## Investigation: `pkg/sql/colenc/colenc_test.TestEncoderEqualityRand`  **Investigated failure:** [issue body](https://github.com/cockroachdb/cockroach/issues/176020) (EngFlow invocation `303ab993-a4ae-4e94-8b18-29938af8266f`, run 3 / shard 1) **Failure SHA:** `8f0a4c430c5434fd01580556373e7456655353bc` **Confidence:** high  ### What This Test Does  `TestEncoderEqualityRand` generates 100 random tables with `randgen.RandCreateTableWithName` (indexes, partitions, computed columns, etc.), inserts random rows, and compares the row-oriented encoder against the columnar (`colenc`) encoder for byte-for-byte equality. The tables are created in a single server and never dropped.  ### Where the Failure Occurs  The test fails on the 100th `CREATE TABLE` (`t99`), not in the encoder:  ``` pq: exceeded limit for number of table spans ```  That error comes from the secondary-tenant span-config limiter: [descs/txn.go:173](https://github.com/cockroachlabs/cockroach/blob/8f0a4c430c5434fd01580556373e7456
  > Auto-solver run dispatched to the code repository's [Issue Auto-Solver workflow](https://github.com/cockroachlabs/cockroach/actions/workflows/issue-autosolve.yml).  If it produces a fix, a draft PR referencing this issue will be opened there. Skipped or failed runs are reported only in that workflow's logs.

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

### Incident Patch 1: `00a3c2c5` (2026-08-05)
**Commit Message**: Merge pull request #173146 from rafiss/investigate-fix-local-action

ci/ai: reference setup-roachdev by repo path, not local ./

**File**: `.github/workflows/investigate.yml` (modified, +9/-2)
```diff
@@ -338,13 +338,20 @@ jobs:
       #
       # roachdev is an internal release in another org, which a public repo
       # cannot install via `uses: cockroachlabs/roachdev@main` (GitHub blocks
-      # internal-repo actions from public repos). The local composite action
+      # internal-repo actions from public repos). This composite action
       # downloads the released binary directly, using the cross-org PAT that
       # already checks out the private code repo. On the personal-fork
       # API-key path no token is passed, so roachdev is skipped — that path
       # runs Claude directly and never posts to a public repo.
+      #
+      # This is referenced by full repo path @ref rather than the local `./`
+      # form on purpose: the Checkout step above replaced the workspace with
+      # CODE_REPO, so `./.github/actions/...` (resolved against the workspace)
+      # would not be found. A remote ref is fetched independently of the
+      # workspace. Tracks master so same-repo action edits take effect without
+      # a version bump.
       - name: Set up roachdev and Claude Code
-        uses: ./.github/actions/setup-roachdev
+        uses: cockroachdb/cockroach/.github/actions/setup-roachdev@master
         with:
           # Pinned: claude-code-action@v1 would otherwise install Claude Code
           # 1.0.127 (Sep 2025), which predates --effort and the Sonnet 5 /
```

---

### Incident Patch 2: `d6dab970` (2026-08-05)
**Commit Message**: Merge pull request #172083 from shafi-VM/fix/170544-inlineconstvar-cast

opt: cast inlined constant to the variable's type in InlineConstVar

**File**: `pkg/sql/logictest/testdata/logic_test/select` (modified, +33/-0)
```diff
@@ -1013,3 +1013,36 @@ query ITT
 SELECT * FROM t146637 WHERE (a = 0 OR a = 100) AND b = 'foo' ORDER BY a DESC LIMIT 1;
 ----
 100  foo  bar
+
+# Regression test for #170544. InlineConstVar must cast an inlined constant to
+# the variable's type when the two are equivalent but not identical, so that
+# type-sensitive expressions such as pg_typeof are not changed.
+statement ok
+CREATE TABLE t170544_name (n NAME);
+INSERT INTO t170544_name VALUES ('hello')
+
+# pg_typeof(n) must still observe NAME (not STRING), so the row is returned.
+query T
+SELECT n FROM t170544_name WHERE n = 'hello' AND pg_typeof(n)::TEXT = 'name'
+----
+hello
+
+# The cast added when inlining must not introduce an evaluation error for
+# out-of-range or lossy casts, because the constant only reaches dead rows.
+# INT8 -> INT2 overflow: the query returns zero rows rather than erroring.
+statement ok
+CREATE TABLE t170544_int2 (i2 INT2);
+INSERT INTO t170544_int2 VALUES (5)
+
+query I
+SELECT i2 FROM t170544_int2 WHERE i2 = 40000 AND i2 + 0 = 5
+----
+
+# VARCHAR(n) truncation: the query returns zero rows rather than incorrect rows.
+statement ok
+CREATE TABLE t170544_varchar (s VARCHAR(3));
+INSERT INTO t170544_varchar VALUES ('abc')
+
+query T
+SELECT s FROM t170544_varchar WHERE s = 'abcdef' AND lower(s) = 'abc'
+----
```

**File**: `pkg/sql/opt/norm/inline_funcs.go` (modified, +10/-0)
```diff
@@ -388,6 +388,16 @@ func (c *CustomFuncs) InlineConstVar(f memo.FiltersExpr) memo.FiltersExpr {
 	replace = func(nd opt.Expr) opt.Expr {
 		if t, ok := nd.(*memo.VariableExpr); ok {
 			if e, ok := vals[t.Col]; ok {
+				// The constant was matched against the variable using Equivalent
+				// (not Identical) above, so its type may differ from the
+				// variable's (e.g. a STRING constant for a NAME column).
+				// Substituting the constant directly would change the result of
+				// type-sensitive expressions such as pg_typeof, so cast the
+				// constant to the variable's type when the two are not identical.
+				colType := c.mem.Metadata().ColumnMeta(t.Col).Type
+				if !e.DataType().Identical(colType) {
+					return c.f.ConstructCast(e, colType)
+				}
 				return e
 			}
 		}
```

**File**: `pkg/sql/opt/norm/testdata/rules/inline` (modified, +60/-0)
```diff
@@ -226,6 +226,66 @@ project
                 │              └── true [as=column14:14]
                 └── false
 
+# Regression test for #170544. InlineConstVar must not replace a variable with a
+# constant whose type is equivalent but not identical to the variable's type
+# without a cast, since that changes the result of type-sensitive expressions
+# such as pg_typeof. Here n is NAME and the constant 'hello' is STRING; the
+# inlined constant is cast back to NAME so pg_typeof(n) still reports 'name' and
+# the row is not incorrectly filtered out.
+exec-ddl
+CREATE TABLE t_name (n NAME)
+----
+
+norm expect=InlineConstVar
+SELECT * FROM t_name WHERE n = 'hello' AND pg_typeof(n)::TEXT = 'name'
+----
+select
+ ├── columns: n:1!null
+ ├── fd: ()-->(1)
+ ├── scan t_name
+ │    └── columns: n:1
+ └── filters
+      └── n:1 = 'hello' [outer=(1), constraints=(/1: [/'hello' - /'hello']; tight), fd=()-->(1)]
+
+# Out-of-range constant (#170544). i2 = 40000 is a contradiction for an INT2
+# column, so no row is ever live. The cast that InlineConstVar adds (40000::INT2,
+# which would overflow) must not be folded eagerly, or the query would error
+# instead of returning zero rows.
+exec-ddl
+CREATE TABLE t_int2 (i2 INT2)
+----
+
+norm
+SELECT * FROM t_int2 WHERE i2 = 40000 AND i2 + 0 = 5
+----
+select
+ ├── columns: i2:1!null
+ ├── immutable
+ ├── fd: ()-->(1)
+ ├── scan t_int2
+ │    └── columns: i2:1
+ └── filters
+      ├── i2:1 = 40000 [outer=(1), constraints=(/1: [/40000 - /40000]; tight), fd=()-->(1)]
+      └── 40000::INT2::INT8 = 5 [immutable]
+
+# Length-limited type (#170544). 'abcdef' truncates to 'abc' when cast to
+# VARCHAR(3), but s = 'abcdef' is a contradiction, so the truncated constant is
+# only ever inlined into dead rows.
+exec-ddl
+CREATE TABLE t_varchar (s VARCHAR(3))
+----
+
+norm
+SELECT * FROM t_varchar WHERE s = 'abcdef' AND lower(s) = 'abc'
+----
+select
+ ├── columns: s:1!null
+ ├── fd: ()-->(1)
+ ├── scan t_varchar
+ │    └── columns: s:1
+ └── filters
+      └── s:1 = 'abcdef' [outer=(1), constraints=(/1: [/'abcdef' - /'abcdef']; tight), fd=()-->(1)]
+
 # --------------------------------------------------
 # InlineProjectConstants
 # --------------------------------------------------
```

---

### Incident Patch 3: `c21c6784` (2026-08-05)
**Commit Message**: Merge pull request #172915 from shivamshaw23/fix-172889-compaction-lock-cleanup

backup: clean up BACKUP-LOCK on compaction failure

**File**: `pkg/backup/backup_job.go` (modified, +19/-0)
```diff
@@ -51,6 +51,7 @@ import (
 	"github.com/cockroachdb/cockroach/pkg/sql/sem/tree"
 	"github.com/cockroachdb/cockroach/pkg/sql/sessiondata"
 	"github.com/cockroachdb/cockroach/pkg/sql/stats"
+	"github.com/cockroachdb/cockroach/pkg/util/besteffort"
 	bulkutil "github.com/cockroachdb/cockroach/pkg/util/bulk"
 	"github.com/cockroachdb/cockroach/pkg/util/ctxgroup"
 	"github.com/cockroachdb/cockroach/pkg/util/errorutil/unimplemented"
@@ -1946,6 +1947,10 @@ func (b *backupResumer) processScheduledBackupCompletion(
 	return nil
 }
 
+// compactionBackupLockCleanupOp is the besteffort operation name used when
+// removing the BACKUP-LOCK file left behind by a failed compaction job.
+const compactionBackupLockCleanupOp = "delete-compaction-backup-lock"
+
 // OnFailOrCancel is part of the jobs.Resumer interface.
 func (b *backupResumer) OnFailOrCancel(
 	ctx context.Context, execCtx interface{}, jobErr error,
@@ -1960,6 +1965,20 @@ func (b *backupResumer) OnFailOrCancel(
 	details := b.job.Details().(jobspb.BackupDetails)
 
 	b.deleteCheckpoint(ctx, cfg, p.User())
+
+	// For compaction jobs, clean up the BACKUP-LOCK file from the backup
+	// destination to unblock subsequent compaction attempts that may target
+	// the same location. A failed compaction does not produce a valid backup at
+	// the destination, so the lock serves no purpose and only blocks future
+	// compactions.
+	if details.Compact && details.URI != "" {
+		besteffort.Warning(ctx, compactionBackupLockCleanupOp, func(ctx context.Context) error {
+			return backupinfo.DeleteBackupLock(
+				ctx, cfg, details.URI, b.job.ID(), p.User(),
+			)
+		})
+	}
+
 	if err := cfg.InternalDB.Txn(ctx, func(ctx context.Context, txn isql.Txn) error {
 		pts := cfg.ProtectedTimestampProvider.WithTxn(txn)
 		return releaseProtectedTimestamp(ctx, pts, details.ProtectedTimestampRecord)
```

**File**: `pkg/backup/backupinfo/manifest_handling.go` (modified, +31/-0)
```diff
@@ -541,6 +541,37 @@ func WriteBackupLock(
 	return cloud.WriteFile(ctx, defaultStore, lockFileName, bytes.NewReader([]byte("lock")))
 }
 
+// DeleteBackupLock removes the backup lock file for the given jobID from the
+// default backup destination. This is used to clean up lock files from failed
+// compaction jobs so that subsequent compaction attempts to the same destination
+// are not blocked.
+func DeleteBackupLock(
+	ctx context.Context,
+	execCfg *sql.ExecutorConfig,
+	defaultURI string,
+	jobID jobspb.JobID,
+	user username.SQLUsername,
+) error {
+	ctx, sp := tracing.ChildSpan(ctx, "backupinfo.DeleteBackupLock")
+	defer sp.Finish()
+
+	defaultStore, err := execCfg.DistSQLSrv.ExternalStorageFromURI(ctx, defaultURI, user)
+	if err != nil {
+		return err
+	}
+	defer defaultStore.Close()
+
+	lockFileName := fmt.Sprintf("%s%s", BackupLockFilePrefix, strconv.FormatInt(int64(jobID), 10))
+	if err := defaultStore.Delete(ctx, lockFileName); err != nil {
+		// If the lock file does not exist, there is nothing to clean up.
+		if errors.Is(err, cloud.ErrFileDoesNotExist) {
+			return nil
+		}
+		return err
+	}
+	return nil
+}
+
 // WriteMetadataWithExternalSSTs writes a "slim" version of manifest to
 // `exportStore`. This version has the alloc heavy `Files`, `Descriptors`, and
 // `DescriptorChanges` repeated fields nil'ed out, and written to an
```

**File**: `pkg/backup/datadriven_test.go` (modified, +22/-0)
```diff
@@ -46,6 +46,7 @@ import (
 	"github.com/cockroachdb/cockroach/pkg/testutils/skip"
 	"github.com/cockroachdb/cockroach/pkg/testutils/sqlutils"
 	"github.com/cockroachdb/cockroach/pkg/util/admission"
+	"github.com/cockroachdb/cockroach/pkg/util/besteffort"
 	"github.com/cockroachdb/cockroach/pkg/util/ctxgroup"
 	"github.com/cockroachdb/datadriven"
 	"github.com/cockroachdb/errors"
@@ -485,6 +486,11 @@ func (d *datadrivenTestState) getSQLDBForVC(
 //   - "sleep ms=TIME"
 //     Sleep for TIME milliseconds.
 //
+//   - "besteffort-forbid-skip op=OP"
+//     Forbids the besteffort operation named OP from being randomly skipped in
+//     test builds for the remainder of the test, so its side effects run
+//     deterministically. See pkg/util/besteffort.
+//
 //lint:ignore U1000 unused
 func runTestDataDriven(t *testing.T, testFilePathFromWorkspace string) {
 	// TODO(at): data driven tests will need some tweaks to work with OR metamorphic, which will
@@ -514,6 +520,16 @@ func runTestDataDriven(t *testing.T, testFilePathFromWorkspace string) {
 	var lastCreatedCluster string
 	ds := newDatadrivenTestState()
 	defer ds.cleanup(ctx, t)
+
+	// The "besteffort-forbid-skip" command registers cleanups that must remain
+	// in effect for the remainder of the test; run them once it finishes.
+	var besteffortCleanups []func()
+	defer func() {
+		for _, cleanup := range besteffortCleanups {
+			cleanup()
+		}
+	}()
+
 	datadriven.RunTest(t, path, func(t *testing.T, d *datadriven.TestData) string {
 		execWithTagAndPausePoint := func(jobType jobspb.Type) string {
 			ds.noticeBuffer = nil
@@ -572,6 +588,12 @@ func runTestDataDriven(t *testing.T, testFilePathFromWorkspace string) {
 			skip.UnderDuress(t)
 			return ""
 
+		case "besteffort-forbid-skip":
+			var op string
+			d.ScanArgs(t, "op", &op)
+			besteffortCleanups = append(besteffortCleanups, besteffort.TestForbidSkip(op))
+			return ""
+
 		case "reset":
 			ds.cleanup(ctx, t)
 			ds = newDatadrivenTestState()
```

**File**: `pkg/backup/testdata/backup-restore/compaction-failed-lock-cleanup` (added, +90/-0)
```diff
@@ -0,0 +1,90 @@
+# Test that when a compaction job is cancelled/fails, its BACKUP-LOCK file is
+# cleaned up, allowing subsequent compactions to proceed without being blocked.
+# See: https://github.com/cockroachdb/cockroach/issues/172889
+
+reset test-nodelocal
+----
+
+new-cluster name=s1 disable-tenant
+----
+
+# The BACKUP-LOCK cleanup in OnFailOrCancel is a besteffort operation, which is
+# randomly skipped in test builds. Forbid skipping it so the cancelled
+# compaction below deterministically removes its lock and the subsequent
+# compaction can proceed.
+besteffort-forbid-skip op=delete-compaction-backup-lock
+----
+
+# 1. Setup: create a table and take a full backup followed by two incrementals,
+# saving timestamps to use as compaction start/end boundaries.
+exec-sql
+CREATE DATABASE orig;
+USE orig;
+CREATE TABLE foo (i INT PRIMARY KEY, s STRING);
+INSERT INTO foo VALUES (1, 'a'), (2, 'b');
+----
+
+save-cluster-ts tag=start
+----
+
+backup aost=start
+BACKUP INTO 'nodelocal://1/test-root/' AS OF SYSTEM TIME start;
+----
+
+exec-sql
+INSERT INTO orig.foo VALUES (3, 'c');
+----
+
+backup
+BACKUP INTO LATEST IN 'nodelocal://1/test-root/';
+----
+
+exec-sql
+INSERT INTO orig.foo VALUES (4, 'd');
+----
+
+save-cluster-ts tag=end
+----
+
+backup aost=end
+BACKUP INTO LATEST IN 'nodelocal://1/test-root/' AS OF SYSTEM TIME end;
+----
+
+let $backup_path
+SHOW BACKUPS IN 'nodelocal://1/test-root/';
+----
+
+# 2. Set a pausepoint so the compaction pauses right after it writes the
+# BACKUP-LOCK, letting us cancel it while the lock is still present. The
+# crdb_internal.backup_compaction builtin starts the job asynchronously, so the
+# call returns immediately with the job ID; we wait for the job to pause
+# separately rather than expecting a synchronous pausepoint error.
+exec-sql
+SET CLUSTER SETTING jobs.debug.pausepoints = 'backup_compaction.after.details_has_checkpoint';
+----
+
+compact start=start end=end tag=comp1
+SELECT crdb_internal.backup_compaction(0, 'BACKUP INTO LATEST IN ''nodelocal://1/test-root/''', '$backup_path', start, end);
+----
+
+job tag=comp1 wait-for-state=paused
+----
+
+# 3. Cancel the paused compaction to trigger OnFailOrCancel, which cleans up the
+# BACKUP-LOCK file.
+job cancel=comp1
+----
+
+# 4. Clear pausepoints so the next compaction can run to completion.
+exec-sql
+SET CLUSTER SETTING jobs.debug.pausepoints = '';
+----
+
+# 5. Run a new compaction over the same range. If the stale BACKUP-LOCK from the
+# cancelled job was not cleaned up, this would fail with FileAlreadyExists.
+compact start=start end=end tag=comp2
+SELECT crdb_internal.backup_compaction(0, 'BACKUP INTO LATEST IN ''nodelocal://1/test-root/''', '$backup_path', start, end);
+----
+
+job tag=comp2 wait-for-state=succeeded
+----
```

---

### Incident Patch 4: `84864bbe` (2026-08-01)
**Commit Message**: backup: fix async pausepoint handling in compaction lock cleanup test

The compaction-failed-lock-cleanup datadriven test used `expect-pausepoint`
on the `compact` directive, which asserts that the SQL call returns a
synchronous "pause point ... hit" error. However,
crdb_internal.backup_compaction starts an asynchronous job and returns
immediately with the job ID, so no such error ever surfaces. The assertion
therefore failed in CI with "expected pause point error".

Start the compaction without expecting a synchronous pausepoint error and
instead wait for the job to reach the paused state before cancelling it,
matching the async pattern already used by the rangekeys test.

Release note: None

Co-Authored-By: Claude Opus 4.8 <[REDACTED_EMAIL]>

**File**: `pkg/backup/testdata/backup-restore/compaction-failed-lock-cleanup` (modified, +11/-4)
```diff
@@ -47,17 +47,24 @@ let $backup_path
 SHOW BACKUPS IN 'nodelocal://1/test-root/';
 ----
 
-# 2. Pause compaction after the BACKUP-LOCK is written so we can cancel it.
+# 2. Set a pausepoint so the compaction pauses right after it writes the
+# BACKUP-LOCK, letting us cancel it while the lock is still present. The
+# crdb_internal.backup_compaction builtin starts the job asynchronously, so the
+# call returns immediately with the job ID; we wait for the job to pause
+# separately rather than expecting a synchronous pausepoint error.
 exec-sql
 SET CLUSTER SETTING jobs.debug.pausepoints = 'backup_compaction.after.details_has_checkpoint';
 ----
 
-compact expect-pausepoint start=start end=end tag=comp1
+compact start=start end=end tag=comp1
 SELECT crdb_internal.backup_compaction(0, 'BACKUP INTO LATEST IN ''nodelocal://1/test-root/''', '$backup_path', start, end);
 ----
-job paused at pausepoint
 
-# 3. Cancel the compaction job to trigger OnFailOrCancel cleanup.
+job tag=comp1 wait-for-state=paused
+----
+
+# 3. Cancel the paused compaction to trigger OnFailOrCancel, which cleans up the
+# BACKUP-LOCK file.
 job cancel=comp1
 ----
 
```

---

### Incident Patch 5: `144a7b9c` (2026-07-17)
**Commit Message**: Merge pull request #172571 from harryfallows/opt-histogram-unconstrained-prefix

opt: use histograms for constant columns outside of the exact prefix

**File**: `pkg/sql/opt/memo/testdata/stats/inverted-json-multi-column` (added, +163/-0)
```diff
@@ -0,0 +1,163 @@
+exec-ddl
+CREATE TABLE t (
+    k INT PRIMARY KEY,
+    i INT,
+    s STRING,
+    j JSONB,
+    INVERTED INDEX isj (i, s, j)
+)
+----
+
+exec-ddl
+ALTER TABLE t INJECT STATISTICS '[
+  {
+    "columns": ["i"],
+    "created_at": "2018-01-01 1:00:00.00000+00:00",
+    "row_count": 2000,
+    "distinct_count": 41,
+    "null_count": 0
+  },
+  {
+    "columns": ["s"],
+    "created_at": "2018-01-01 1:00:00.00000+00:00",
+    "row_count": 2000,
+    "distinct_count": 40,
+    "null_count": 100,
+    "histo_col_type": "string",
+    "histo_buckets": [
+      {"num_eq": 0, "num_range": 0, "distinct_range": 0, "upper_bound": "apple"},
+      {"num_eq": 100, "num_range": 200, "distinct_range": 9, "upper_bound": "banana"},
+      {"num_eq": 100, "num_range": 300, "distinct_range": 9, "upper_bound": "cherry"},
+      {"num_eq": 200, "num_range": 400, "distinct_range": 9, "upper_bound": "mango"},
+      {"num_eq": 200, "num_range": 400, "distinct_range": 9, "upper_bound": "pineapple"}
+    ]
+  },
+  {
+    "columns": ["j"],
+    "created_at": "2018-01-01 1:00:00.00000+00:00",
+    "row_count": 2000,
+    "distinct_count": 10,
+    "null_count": 0,
+    "histo_col_type": "BYTES",
+    "histo_buckets": [
+      {"distinct_range": 0, "num_eq": 10, "num_range": 0, "upper_bound": "\\x37000138"},
+      {"distinct_range": 0, "num_eq": 10, "num_range": 0, "upper_bound": "\\x37000139"},
+      {"distinct_range": 0, "num_eq": 990, "num_range": 0, "upper_bound": "\\x37000300012a0200"},
+      {"distinct_range": 0, "num_eq": 100, "num_range": 0, "upper_bound": "\\x37000300012a0400"},
+      {"distinct_range": 0, "num_eq": 10, "num_range": 0, "upper_bound": "\\x37000300012a0600"},
+      {"distinct_range": 0, "num_eq": 990, "num_range": 0, "upper_bound": "\\x3761000112620001"},
+      {"distinct_range": 0, "num_eq": 100, "num_range": 0, "upper_bound": "\\x3763000112640001"},
+      {"distinct_range": 0, "num_eq": 10, "num_range": 0, "upper_bound": "\\x3765000112660001"}
+    ]
+  }
+]'
+----
+
+# Test a multi-column inverted index scan where the leading prefix column i
+# spans multiple values but the second prefix column s is held to a single
+# value. s's histogram should be used even though s is outside the exact prefix.
+opt
+SELECT k FROM t@isj WHERE i IN (200, 300) AND s = 'banana' AND j @> '{"a": "b"}'
+----
+project
+ ├── columns: k:1(int!null)
+ ├── immutable
+ ├── stats: [rows=1]
+ ├── key: (1)
+ └── scan t@isj,inverted
+      ├── columns: k:1(int!null)
+      ├── constraint: /2/3
+      │    ├── [/200/'banana' - /200/'banana']
+      │    └── [/300/'banana' - /300/'banana']
+      ├── inverted constraint: /7/1
+      │    └── spans: ["a"/"b", "a"/"b"]
+      ├── flags: force-index=isj
+      ├── stats: [rows=2.41463, distinct(2)=2, null(2)=0, distinct(3)=1, null(3)=0, distinct(7)=1, null(7)=0, distinct(3,7)=1, null(3,7)=0, distinct(2,3,7)=2, null(2,3,7)=0]
+      │   histogram(3)=  0   2.4146
+      │                <--- 'banana'
+      │   histogram(7)=  0         2.4146         0           0
+      │                <--- '\x3761000112620001' --- '\x3761000112620002'
+      └── key: (1)
+
+exec-ddl
+CREATE TABLE rbr (
+    k INT PRIMARY KEY,
+    s STRING,
+    j JSONB,
+    INVERTED INDEX sj (s, j)
+) LOCALITY REGIONAL BY ROW
+----
+
+exec-ddl
+ALTER TABLE rbr INJECT STATISTICS '[
+  {
+    "columns": ["crdb_region"],
+    "created_at": "2018-01-01 1:00:00.00000+00:00",
+    "row_count": 2000,
+    "distinct_count": 3,
+    "null_count": 0
+  },
+  {
+    "columns": ["s"],
+    "created_at": "2018-01-01 1:00:00.00000+00:00",
+    "row_count": 2000,
+    "distinct_count": 40,
+    "null_count": 100,
+    "histo_col_type": "string",
+    "histo_buckets": [
+      {"num_eq": 0, "num_range": 0, "distinct_range": 0, "upper_bound": "apple"},
+      {"num_eq": 100, "num_range": 200, "distinct_range": 9, "upper_bound": "banana"},
+      {"num_eq": 100, "num_range": 300, "distinct_range": 9, "upper_bound": "cherry"},
+      {"num_eq": 200, "num_range": 400, "distinct_range": 9, "upper_bound": "mango"},
+      {"num_eq": 200, "num_range": 400, "distinct_range": 9, "upper_bound": "pineapple"}
+    ]
+  },
+  {
+    "columns": ["j"],
+    "created_at": "2018-01-01 1:00:00.00000+00:00",
+    "row_count": 2000,
+    "distinct_count": 10,
+    "null_count": 0,
+    "histo_col_type": "BYTES",
+    "histo_buckets": [
+      {"distinct_range": 0, "num_eq": 10, "num_range": 0, "upper_bound": "\\x37000138"},
+      {"distinct_range": 0, "num_eq": 10, "num_range": 0, "upper_bound": "\\x37000139"},
+      {"distinct_range": 0, "num_eq": 990, "num_range": 0, "upper_bound": "\\x37000300012a0200"},
+      {"distinct_range": 0, "num_eq": 100, "num_range": 0, "upper_bound": "\\x37000300012a0400"},
+      {"distinct_range": 0, "num_eq": 10, "num_range": 0, "upper_bound": "\\x37000300012a0600"},
+      {"distinct_range": 0, "num_eq": 990, "num_range": 0, "upper_bound": "\\x3761000112620001"},
+      {"distinct_range": 0, "nu
```

**File**: `pkg/sql/opt/memo/testdata/stats/scan` (modified, +116/-0)
```diff
@@ -3466,3 +3466,119 @@ index-join stale
       ├── stats: [rows=0.00200002]
       ├── key: ()
       └── fd: ()-->(1-3)
+
+exec-ddl
+CREATE TABLE hist_multi (
+  k INT PRIMARY KEY,
+  a INT NOT NULL,
+  b INT,
+  INDEX ab (a, b)
+)
+----
+
+exec-ddl
+ALTER TABLE hist_multi INJECT STATISTICS '[
+  {
+    "columns": ["a"],
+    "created_at": "2018-01-01 1:00:00.00000+00:00",
+    "row_count": 1000,
+    "distinct_count": 5,
+    "null_count": 0
+  },
+  {
+    "columns": ["b"],
+    "created_at": "2018-01-01 1:00:00.00000+00:00",
+    "row_count": 1000,
+    "distinct_count": 40,
+    "null_count": 0,
+    "histo_col_type": "int",
+    "histo_buckets": [
+      {"num_eq": 0, "num_range": 0, "distinct_range": 0, "upper_bound": "0"},
+      {"num_eq": 10, "num_range": 90, "distinct_range": 9, "upper_bound": "10"},
+      {"num_eq": 20, "num_range": 180, "distinct_range": 9, "upper_bound": "20"},
+      {"num_eq": 30, "num_range": 270, "distinct_range": 9, "upper_bound": "30"},
+      {"num_eq": 40, "num_range": 360, "distinct_range": 9, "upper_bound": "40"}
+    ]
+  }
+]'
+----
+
+# The leading index column a spans multiple values while b is held to a single
+# value, so b's histogram is used for the estimate even though b falls outside
+# the constraint's exact prefix.
+opt
+SELECT k FROM hist_multi@ab WHERE a IN (1, 2) AND b = 10
+----
+project
+ ├── columns: k:1(int!null)
+ ├── stats: [rows=4]
+ ├── key: (1)
+ └── scan hist_multi@ab
+      ├── columns: k:1(int!null) a:2(int!null) b:3(int!null)
+      ├── constraint: /2/3/1
+      │    ├── [/1/10 - /1/10]
+      │    └── [/2/10 - /2/10]
+      ├── flags: force-index=ab
+      ├── stats: [rows=4, distinct(2)=2, null(2)=0, distinct(3)=1, null(3)=0, distinct(2,3)=2, null(2,3)=0]
+      │   histogram(3)=  0  4
+      │                <--- 10
+      ├── key: (1)
+      └── fd: ()-->(3), (1)-->(2)
+
+exec-ddl
+CREATE TABLE hist_rbr (
+  k INT PRIMARY KEY,
+  a INT,
+  INDEX a_idx (a)
+) LOCALITY REGIONAL BY ROW
+----
+
+exec-ddl
+ALTER TABLE hist_rbr INJECT STATISTICS '[
+  {
+    "columns": ["crdb_region"],
+    "created_at": "2018-01-01 1:00:00.00000+00:00",
+    "row_count": 1000,
+    "distinct_count": 3,
+    "null_count": 0
+  },
+  {
+    "columns": ["a"],
+    "created_at": "2018-01-01 1:00:00.00000+00:00",
+    "row_count": 1000,
+    "distinct_count": 40,
+    "null_count": 0,
+    "histo_col_type": "int",
+    "histo_buckets": [
+      {"num_eq": 0, "num_range": 0, "distinct_range": 0, "upper_bound": "0"},
+      {"num_eq": 10, "num_range": 90, "distinct_range": 9, "upper_bound": "10"},
+      {"num_eq": 20, "num_range": 180, "distinct_range": 9, "upper_bound": "20"},
+      {"num_eq": 30, "num_range": 270, "distinct_range": 9, "upper_bound": "30"},
+      {"num_eq": 40, "num_range": 360, "distinct_range": 9, "upper_bound": "40"}
+    ]
+  }
+]'
+----
+
+# On a REGIONAL BY ROW table with crdb_region left unconstrained, the optimizer
+# enumerates crdb_region into one span per region, so crdb_region varies while a
+# is held to a single value outside the exact prefix. a's histogram is still used.
+opt
+SELECT k FROM hist_rbr@a_idx WHERE a = 10
+----
+project
+ ├── columns: k:1(int!null)
+ ├── stats: [rows=10]
+ ├── key: (1)
+ └── scan hist_rbr@a_idx
+      ├── columns: k:1(int!null) a:2(int!null)
+      ├── constraint: /3/2/1
+      │    ├── [/'central'/10 - /'central'/10]
+      │    ├── [/'east'/10 - /'east'/10]
+      │    └── [/'west'/10 - /'west'/10]
+      ├── flags: force-index=a_idx
+      ├── stats: [rows=10, distinct(2)=1, null(2)=0]
+      │   histogram(2)=  0  10
+      │                <--- 10
+      ├── key: (1)
+      └── fd: ()-->(2)
```

**File**: `pkg/sql/opt/props/histogram.go` (modified, +32/-1)
```diff
@@ -333,7 +333,8 @@ func maxDistinctValuesInRange(lowerBound, upperBound tree.Datum) (n float64, ok
 
 // CanFilter returns true if the given constraint can filter the histogram.
 // This is the case if the histogram column matches one of the columns in
-// the exact prefix of c or the next column immediately after the exact prefix.
+// the exact prefix of c, the next column immediately after the exact prefix,
+// or a column constrained to a single value in every span (a constant column).
 // Returns the offset of the matching column in the constraint if found, as
 // well as the exact prefix.
 func (h *Histogram) CanFilter(
@@ -346,6 +347,17 @@ func (h *Histogram) CanFilter(
 			return i, exactPrefix, true
 		}
 	}
+	// A constant column (constrained to a single value in every span) can filter
+	// the histogram even when an earlier unconstrained column pushes it past the
+	// exact prefix, e.g. crdb_region on a REGIONAL BY ROW table. See Filter.
+	for i := exactPrefix + 1; i < constrainedCols; i++ {
+		if c.Columns.Get(i).ID() == h.col {
+			if c.ExtractConstCols(ctx, h.evalCtx).Contains(h.col) {
+				return i, exactPrefix, true
+			}
+			break
+		}
+	}
 	return 0, exactPrefix, false
 }
 
@@ -582,6 +594,25 @@ func (h *Histogram) Filter(ctx context.Context, c *constraint.Constraint) *Histo
 	if !ok {
 		panic(errors.AssertionFailedf("column mismatch"))
 	}
+
+	// A column past the exact prefix was admitted as a constant column with value
+	// V. The prefix-based path below assumes the columns before colOffset are
+	// fixed to the first span's values, which does not hold when an earlier
+	// column varies, so filter against a synthetic single-column [V - V]
+	// constraint instead.
+	if colOffset > exactPrefix {
+		val := c.Spans.Get(0).StartKey().Value(colOffset)
+		var cols constraint.Columns
+		cols.InitSingle(opt.MakeOrderingColumn(h.col, false /* descending */))
+		key := constraint.MakeKey(val)
+		var span constraint.Span
+		span.Init(key, constraint.IncludeBoundary, key, constraint.IncludeBoundary)
+		return h.filter(
+			ctx, 1 /* spanCount */, func(int) *constraint.Span { return &span },
+			false /* desc */, 0 /* colOffset */, 1 /* exactPrefix */, nil /* prefix */, cols,
+		)
+	}
+
 	prefix := make([]tree.Datum, colOffset)
 	for i := range prefix {
 		prefix[i] = c.Spans.Get(0).StartKey().Value(i)
```

**File**: `pkg/sql/opt/props/histogram_test.go` (modified, +15/-2)
```diff
@@ -79,7 +79,7 @@ func TestCanFilter(t *testing.T) {
 
 	// The histogram column ID is 1 for all test cases. CanFilter should only
 	// return true for constraints in which column ID 1 is part of the exact
-	// prefix or the first column after.
+	// prefix, the first column after, or a constant column.
 	testData := []struct {
 		constraint string
 		canFilter  bool
@@ -111,7 +111,8 @@ func TestCanFilter(t *testing.T) {
 		},
 		{
 			constraint: "/2/-1: [/0/3 - /0/3] [/2/3 - /2/3]",
-			canFilter:  false,
+			canFilter:  true,
+			colIdx:     1,
 		},
 		{
 			constraint: "/2/1: [/0/3 - /0/3] [/0/5 - /0/5]",
@@ -367,6 +368,18 @@ func TestHistogram(t *testing.T) {
 			distinct:     1,
 			maxFrequency: 5.71,
 		},
+		{
+			constraint: "/2/1: [/0/40 - /0/40] [/2/40 - /2/40]",
+			//   0 5.7143
+			// <---- 40 -
+			buckets: []cat.HistogramBucket{
+				{NumRange: 0, NumEq: 5.71, DistinctRange: 0, UpperBound: tree.NewDInt(40)},
+			},
+			count:        5.71,
+			maxDistinct:  1,
+			distinct:     1,
+			maxFrequency: 5.71,
+		},
 	}
 
 	for i := range testData {
```

---

### Incident Patch 6: `e325c8fe` (2026-07-14)
**Commit Message**: opt: use histograms for constant columns outside the exact prefix

When estimating the row count for a scan over an index whose leading
column is left unconstrained (and therefore spans multiple values), the
optimizer discarded the histogram of a later, equality-constrained column
and fell back to a distinct-count estimate. This happened because
Histogram.CanFilter only admitted a column whose position was within the
constraint's exact prefix, and an unconstrained leading column collapses
that exact prefix to zero.

The effect was most visible on REGIONAL BY ROW tables queried without
pinning crdb_region, especially for multi-column inverted indexes such as
(crdb_region, s, j): the inverted column kept its histogram via the
separate inverted-constraint path, while the forward prefix column s
silently lost its own, producing large row-count misestimates and, in
turn, suboptimal plans.

CanFilter now also admits a histogram column that is constrained to a
single value in every span (a constant column, per
Constraint.ExtractConstCols) even when it falls outside the exact prefix.
Filter cannot reuse the general prefix-based machinery in this case,
because that machinery assumes every c

**File**: `pkg/sql/opt/memo/testdata/stats/inverted-json-multi-column` (added, +163/-0)
```diff
@@ -0,0 +1,163 @@
+exec-ddl
+CREATE TABLE t (
+    k INT PRIMARY KEY,
+    i INT,
+    s STRING,
+    j JSONB,
+    INVERTED INDEX isj (i, s, j)
+)
+----
+
+exec-ddl
+ALTER TABLE t INJECT STATISTICS '[
+  {
+    "columns": ["i"],
+    "created_at": "2018-01-01 1:00:00.00000+00:00",
+    "row_count": 2000,
+    "distinct_count": 41,
+    "null_count": 0
+  },
+  {
+    "columns": ["s"],
+    "created_at": "2018-01-01 1:00:00.00000+00:00",
+    "row_count": 2000,
+    "distinct_count": 40,
+    "null_count": 100,
+    "histo_col_type": "string",
+    "histo_buckets": [
+      {"num_eq": 0, "num_range": 0, "distinct_range": 0, "upper_bound": "apple"},
+      {"num_eq": 100, "num_range": 200, "distinct_range": 9, "upper_bound": "banana"},
+      {"num_eq": 100, "num_range": 300, "distinct_range": 9, "upper_bound": "cherry"},
+      {"num_eq": 200, "num_range": 400, "distinct_range": 9, "upper_bound": "mango"},
+      {"num_eq": 200, "num_range": 400, "distinct_range": 9, "upper_bound": "pineapple"}
+    ]
+  },
+  {
+    "columns": ["j"],
+    "created_at": "2018-01-01 1:00:00.00000+00:00",
+    "row_count": 2000,
+    "distinct_count": 10,
+    "null_count": 0,
+    "histo_col_type": "BYTES",
+    "histo_buckets": [
+      {"distinct_range": 0, "num_eq": 10, "num_range": 0, "upper_bound": "\\x37000138"},
+      {"distinct_range": 0, "num_eq": 10, "num_range": 0, "upper_bound": "\\x37000139"},
+      {"distinct_range": 0, "num_eq": 990, "num_range": 0, "upper_bound": "\\x37000300012a0200"},
+      {"distinct_range": 0, "num_eq": 100, "num_range": 0, "upper_bound": "\\x37000300012a0400"},
+      {"distinct_range": 0, "num_eq": 10, "num_range": 0, "upper_bound": "\\x37000300012a0600"},
+      {"distinct_range": 0, "num_eq": 990, "num_range": 0, "upper_bound": "\\x3761000112620001"},
+      {"distinct_range": 0, "num_eq": 100, "num_range": 0, "upper_bound": "\\x3763000112640001"},
+      {"distinct_range": 0, "num_eq": 10, "num_range": 0, "upper_bound": "\\x3765000112660001"}
+    ]
+  }
+]'
+----
+
+# Test a multi-column inverted index scan where the leading prefix column i
+# spans multiple values but the second prefix column s is held to a single
+# value. s's histogram should be used even though s is outside the exact prefix.
+opt
+SELECT k FROM t@isj WHERE i IN (200, 300) AND s = 'banana' AND j @> '{"a": "b"}'
+----
+project
+ ├── columns: k:1(int!null)
+ ├── immutable
+ ├── stats: [rows=1]
+ ├── key: (1)
+ └── scan t@isj,inverted
+      ├── columns: k:1(int!null)
+      ├── constraint: /2/3
+      │    ├── [/200/'banana' - /200/'banana']
+      │    └── [/300/'banana' - /300/'banana']
+      ├── inverted constraint: /7/1
+      │    └── spans: ["a"/"b", "a"/"b"]
+      ├── flags: force-index=isj
+      ├── stats: [rows=2.41463, distinct(2)=2, null(2)=0, distinct(3)=1, null(3)=0, distinct(7)=1, null(7)=0, distinct(3,7)=1, null(3,7)=0, distinct(2,3,7)=2, null(2,3,7)=0]
+      │   histogram(3)=  0   2.4146
+      │                <--- 'banana'
+      │   histogram(7)=  0         2.4146         0           0
+      │                <--- '\x3761000112620001' --- '\x3761000112620002'
+      └── key: (1)
+
+exec-ddl
+CREATE TABLE rbr (
+    k INT PRIMARY KEY,
+    s STRING,
+    j JSONB,
+    INVERTED INDEX sj (s, j)
+) LOCALITY REGIONAL BY ROW
+----
+
+exec-ddl
+ALTER TABLE rbr INJECT STATISTICS '[
+  {
+    "columns": ["crdb_region"],
+    "created_at": "2018-01-01 1:00:00.00000+00:00",
+    "row_count": 2000,
+    "distinct_count": 3,
+    "null_count": 0
+  },
+  {
+    "columns": ["s"],
+    "created_at": "2018-01-01 1:00:00.00000+00:00",
+    "row_count": 2000,
+    "distinct_count": 40,
+    "null_count": 100,
+    "histo_col_type": "string",
+    "histo_buckets": [
+      {"num_eq": 0, "num_range": 0, "distinct_range": 0, "upper_bound": "apple"},
+      {"num_eq": 100, "num_range": 200, "distinct_range": 9, "upper_bound": "banana"},
+      {"num_eq": 100, "num_range": 300, "distinct_range": 9, "upper_bound": "cherry"},
+      {"num_eq": 200, "num_range": 400, "distinct_range": 9, "upper_bound": "mango"},
+      {"num_eq": 200, "num_range": 400, "distinct_range": 9, "upper_bound": "pineapple"}
+    ]
+  },
+  {
+    "columns": ["j"],
+    "created_at": "2018-01-01 1:00:00.00000+00:00",
+    "row_count": 2000,
+    "distinct_count": 10,
+    "null_count": 0,
+    "histo_col_type": "BYTES",
+    "histo_buckets": [
+      {"distinct_range": 0, "num_eq": 10, "num_range": 0, "upper_bound": "\\x37000138"},
+      {"distinct_range": 0, "num_eq": 10, "num_range": 0, "upper_bound": "\\x37000139"},
+      {"distinct_range": 0, "num_eq": 990, "num_range": 0, "upper_bound": "\\x37000300012a0200"},
+      {"distinct_range": 0, "num_eq": 100, "num_range": 0, "upper_bound": "\\x37000300012a0400"},
+      {"distinct_range": 0, "num_eq": 10, "num_range": 0, "upper_bound": "\\x37000300012a0600"},
+      {"distinct_range": 0, "num_eq": 990, "num_range": 0, "upper_bound": "\\x3761000112620001"},
+      {"distinct_range": 0, "nu
```

**File**: `pkg/sql/opt/memo/testdata/stats/scan` (modified, +116/-0)
```diff
@@ -3466,3 +3466,119 @@ index-join stale
       ├── stats: [rows=0.00200002]
       ├── key: ()
       └── fd: ()-->(1-3)
+
+exec-ddl
+CREATE TABLE hist_multi (
+  k INT PRIMARY KEY,
+  a INT NOT NULL,
+  b INT,
+  INDEX ab (a, b)
+)
+----
+
+exec-ddl
+ALTER TABLE hist_multi INJECT STATISTICS '[
+  {
+    "columns": ["a"],
+    "created_at": "2018-01-01 1:00:00.00000+00:00",
+    "row_count": 1000,
+    "distinct_count": 5,
+    "null_count": 0
+  },
+  {
+    "columns": ["b"],
+    "created_at": "2018-01-01 1:00:00.00000+00:00",
+    "row_count": 1000,
+    "distinct_count": 40,
+    "null_count": 0,
+    "histo_col_type": "int",
+    "histo_buckets": [
+      {"num_eq": 0, "num_range": 0, "distinct_range": 0, "upper_bound": "0"},
+      {"num_eq": 10, "num_range": 90, "distinct_range": 9, "upper_bound": "10"},
+      {"num_eq": 20, "num_range": 180, "distinct_range": 9, "upper_bound": "20"},
+      {"num_eq": 30, "num_range": 270, "distinct_range": 9, "upper_bound": "30"},
+      {"num_eq": 40, "num_range": 360, "distinct_range": 9, "upper_bound": "40"}
+    ]
+  }
+]'
+----
+
+# The leading index column a spans multiple values while b is held to a single
+# value, so b's histogram is used for the estimate even though b falls outside
+# the constraint's exact prefix.
+opt
+SELECT k FROM hist_multi@ab WHERE a IN (1, 2) AND b = 10
+----
+project
+ ├── columns: k:1(int!null)
+ ├── stats: [rows=4]
+ ├── key: (1)
+ └── scan hist_multi@ab
+      ├── columns: k:1(int!null) a:2(int!null) b:3(int!null)
+      ├── constraint: /2/3/1
+      │    ├── [/1/10 - /1/10]
+      │    └── [/2/10 - /2/10]
+      ├── flags: force-index=ab
+      ├── stats: [rows=4, distinct(2)=2, null(2)=0, distinct(3)=1, null(3)=0, distinct(2,3)=2, null(2,3)=0]
+      │   histogram(3)=  0  4
+      │                <--- 10
+      ├── key: (1)
+      └── fd: ()-->(3), (1)-->(2)
+
+exec-ddl
+CREATE TABLE hist_rbr (
+  k INT PRIMARY KEY,
+  a INT,
+  INDEX a_idx (a)
+) LOCALITY REGIONAL BY ROW
+----
+
+exec-ddl
+ALTER TABLE hist_rbr INJECT STATISTICS '[
+  {
+    "columns": ["crdb_region"],
+    "created_at": "2018-01-01 1:00:00.00000+00:00",
+    "row_count": 1000,
+    "distinct_count": 3,
+    "null_count": 0
+  },
+  {
+    "columns": ["a"],
+    "created_at": "2018-01-01 1:00:00.00000+00:00",
+    "row_count": 1000,
+    "distinct_count": 40,
+    "null_count": 0,
+    "histo_col_type": "int",
+    "histo_buckets": [
+      {"num_eq": 0, "num_range": 0, "distinct_range": 0, "upper_bound": "0"},
+      {"num_eq": 10, "num_range": 90, "distinct_range": 9, "upper_bound": "10"},
+      {"num_eq": 20, "num_range": 180, "distinct_range": 9, "upper_bound": "20"},
+      {"num_eq": 30, "num_range": 270, "distinct_range": 9, "upper_bound": "30"},
+      {"num_eq": 40, "num_range": 360, "distinct_range": 9, "upper_bound": "40"}
+    ]
+  }
+]'
+----
+
+# On a REGIONAL BY ROW table with crdb_region left unconstrained, the optimizer
+# enumerates crdb_region into one span per region, so crdb_region varies while a
+# is held to a single value outside the exact prefix. a's histogram is still used.
+opt
+SELECT k FROM hist_rbr@a_idx WHERE a = 10
+----
+project
+ ├── columns: k:1(int!null)
+ ├── stats: [rows=10]
+ ├── key: (1)
+ └── scan hist_rbr@a_idx
+      ├── columns: k:1(int!null) a:2(int!null)
+      ├── constraint: /3/2/1
+      │    ├── [/'central'/10 - /'central'/10]
+      │    ├── [/'east'/10 - /'east'/10]
+      │    └── [/'west'/10 - /'west'/10]
+      ├── flags: force-index=a_idx
+      ├── stats: [rows=10, distinct(2)=1, null(2)=0]
+      │   histogram(2)=  0  10
+      │                <--- 10
+      ├── key: (1)
+      └── fd: ()-->(2)
```

**File**: `pkg/sql/opt/props/histogram.go` (modified, +31/-1)
```diff
@@ -333,7 +333,8 @@ func maxDistinctValuesInRange(lowerBound, upperBound tree.Datum) (n float64, ok
 
 // CanFilter returns true if the given constraint can filter the histogram.
 // This is the case if the histogram column matches one of the columns in
-// the exact prefix of c or the next column immediately after the exact prefix.
+// the exact prefix of c, the next column immediately after the exact prefix,
+// or a column constrained to a single value in every span (a constant column).
 // Returns the offset of the matching column in the constraint if found, as
 // well as the exact prefix.
 func (h *Histogram) CanFilter(
@@ -346,6 +347,16 @@ func (h *Histogram) CanFilter(
 			return i, exactPrefix, true
 		}
 	}
+	// A constant column (constrained to a single value in every span) can filter
+	// the histogram even when an earlier unconstrained column pushes it past the
+	// exact prefix, e.g. crdb_region on a REGIONAL BY ROW table. See Filter.
+	if c.ExtractConstCols(ctx, h.evalCtx).Contains(h.col) {
+		for i := 0; i < constrainedCols; i++ {
+			if c.Columns.Get(i).ID() == h.col {
+				return i, exactPrefix, true
+			}
+		}
+	}
 	return 0, exactPrefix, false
 }
 
@@ -582,6 +593,25 @@ func (h *Histogram) Filter(ctx context.Context, c *constraint.Constraint) *Histo
 	if !ok {
 		panic(errors.AssertionFailedf("column mismatch"))
 	}
+
+	// A column past the exact prefix was admitted as a constant column with value
+	// V. The prefix-based path below assumes the columns before colOffset are
+	// fixed to the first span's values, which does not hold when an earlier
+	// column varies, so filter against a synthetic single-column [V - V]
+	// constraint instead.
+	if colOffset > exactPrefix {
+		val := c.Spans.Get(0).StartKey().Value(colOffset)
+		var cols constraint.Columns
+		cols.InitSingle(opt.MakeOrderingColumn(h.col, false /* descending */))
+		key := constraint.MakeKey(val)
+		var span constraint.Span
+		span.Init(key, constraint.IncludeBoundary, key, constraint.IncludeBoundary)
+		return h.filter(
+			ctx, 1 /* spanCount */, func(int) *constraint.Span { return &span },
+			false /* desc */, 0 /* colOffset */, 1 /* exactPrefix */, nil /* prefix */, cols,
+		)
+	}
+
 	prefix := make([]tree.Datum, colOffset)
 	for i := range prefix {
 		prefix[i] = c.Spans.Get(0).StartKey().Value(i)
```

**File**: `pkg/sql/opt/props/histogram_test.go` (modified, +15/-2)
```diff
@@ -79,7 +79,7 @@ func TestCanFilter(t *testing.T) {
 
 	// The histogram column ID is 1 for all test cases. CanFilter should only
 	// return true for constraints in which column ID 1 is part of the exact
-	// prefix or the first column after.
+	// prefix, the first column after, or a constant column.
 	testData := []struct {
 		constraint string
 		canFilter  bool
@@ -111,7 +111,8 @@ func TestCanFilter(t *testing.T) {
 		},
 		{
 			constraint: "/2/-1: [/0/3 - /0/3] [/2/3 - /2/3]",
-			canFilter:  false,
+			canFilter:  true,
+			colIdx:     1,
 		},
 		{
 			constraint: "/2/1: [/0/3 - /0/3] [/0/5 - /0/5]",
@@ -367,6 +368,18 @@ func TestHistogram(t *testing.T) {
 			distinct:     1,
 			maxFrequency: 5.71,
 		},
+		{
+			constraint: "/2/1: [/0/40 - /0/40] [/2/40 - /2/40]",
+			//   0 5.7143
+			// <---- 40 -
+			buckets: []cat.HistogramBucket{
+				{NumRange: 0, NumEq: 5.71, DistinctRange: 0, UpperBound: tree.NewDInt(40)},
+			},
+			count:        5.71,
+			maxDistinct:  1,
+			distinct:     1,
+			maxFrequency: 5.71,
+		},
 	}
 
 	for i := range testData {
```

---

### Incident Patch 7: `b195566e` (2026-07-14)
**Commit Message**: ci/ai: fix the go-deeper hint, document the effort guard

The go-deeper footer hint listed (high|xhigh|max) as suggestions,
which for a fable-5 xhigh run offers a downgrade and a repeat. The
hint's condition already guarantees the run was not fable-5 at max,
so suggest only that: it is strictly deeper than any run that sees
the hint, with no effort-comparison logic.

Also expand the guard's comment to note that max — unlike xhigh — is
supported on Opus 4.6 (xhigh arrived later, slotted between high and
max), so the guard intentionally downgrades only xhigh. Downgrading
max as well would silently strip a supported capability.

Epic: none

Release note: None

Co-Authored-By: roachdev-claude <[REDACTED_EMAIL]>

**File**: `.github/workflows/investigate.yml` (modified, +7/-3)
```diff
@@ -291,7 +291,9 @@ jobs:
               low|medium|high|xhigh|max) effort="$arg" ;;
             esac
           done
-          # Opus 4.6 predates the xhigh effort level.
+          # Opus 4.6 predates the xhigh effort level; max, in contrast,
+          # is supported on Opus 4.6 (xhigh arrived later, slotted
+          # between high and max), so only xhigh is downgraded.
           if [ "$model" = 'claude-opus-4-6' ] && [ "$effort" = 'xhigh' ]; then
             effort='high'
           fi
@@ -427,10 +429,12 @@ jobs:
           # Empty if the job failed before the Select model step.
           : "${CLAUDE_MODEL:=unknown}" "${CLAUDE_EFFORT:=unknown}"
           # Footer identifying the model, plus a pointer at the deeper
-          # settings (omitted when this run already used them).
+          # settings (omitted when this run already used them). The
+          # suggested setting is strictly deeper than any run that sees
+          # the hint, since fable-5 at max is excluded above.
           hint=''
           if [ "$CLAUDE_MODEL" != 'claude-fable-5' ] || [ "$CLAUDE_EFFORT" != 'max' ]; then
-            hint=' Use `/investigate fable-5 (high|xhigh|max)` to go deeper.'
+            hint=' Use `/investigate fable-5 max` to go deeper.'
           fi
           if [ -s artifacts/findings.md ]; then
             # Append the footers here rather than asking the agent to write
```

---

### Incident Patch 8: `0eedd74a` (2026-06-02)
**Commit Message**: roachtest: add OR to backup roundtrip chaos test and introduce an OR fixture chaos test (#170867)

roachtest: add OR to backup roundtrip chaos test and introduce an OR fixture chaos test

**File**: `pkg/cmd/roachtest/tests/backup_restore_roundtrip.go` (modified, +18/-3)
```diff
@@ -262,6 +262,10 @@ func backupRestoreChaos(ctx context.Context, t test.Test, c cluster.Cluster) {
 	workloadSeed := testRNG.Int63()
 	t.L().Printf("workload seed: %d", workloadSeed)
 
+	onlineRestore := testRNG.Intn(2) == 0
+	t.L().Printf("online restore: %t", onlineRestore)
+	t.AddParam("onlineRestore", fmt.Sprintf("%t", onlineRestore))
+
 	startOpts := roachtestutil.MaybeUseMemoryBudget(t, 50)
 	startOpts.RoachprodOpts.ExtraArgs = []string{"--vmodule=split_queue=3,cloud_logging_transport=1"}
 	c.Start(ctx, t.L(), startOpts, install.MakeClusterSettings(), c.CRDBNodes())
@@ -291,10 +295,8 @@ func backupRestoreChaos(ctx context.Context, t test.Test, c cluster.Cluster) {
 	// quite a while to backup. Considering the goal of this test, it'd be good
 	// to add some options to provide the caller with more flexibility over the
 	// workload.
-	// TODO (kev-cao): Once OR download phase is resilient to node failures, we
-	// can metamorphically add online restore to this test as well.
 	testUtils, err := setupBackupRestoreTestUtils(
-		ctx, t, c, testRNG, withCompaction(true),
+		ctx, t, c, testRNG, withCompaction(true), withOnlineRestore(onlineRestore),
 	)
 	require.NoError(t, err)
 	defer testUtils.CloseConnections()
@@ -376,6 +378,19 @@ func backupRestoreChaos(ctx context.Context, t test.Test, c cluster.Cluster) {
 		min(randFloatBetween(testRNG, 0.65, 1.1), 1),
 	)
 	require.NoError(t, restoreJob.WaitForJobSuccess(ctx))
+	// If running online restore, inject an additional failure during the download phase.
+	if onlineRestore {
+		downloadJobID, err := d.getORDownloadJobID(ctx, t.L(), testRNG)
+		require.NoError(t, err)
+		injectAndRecoverFailure(
+			ctx, t, t.L(), testUtils, testUtils.RandomNode(testRNG, liveNodes), downloadJobID, failer, args,
+			randFloatBetween(testRNG, 0.15, 0.50),
+			randFloatBetween(testRNG, 0.50, 0.66),
+		)
+		require.NoError(t, testUtils.waitForJobSuccess(
+			ctx, t.L(), testRNG, downloadJobID, true, /* internalSystemJobs */
+		))
+	}
 	require.NoError(t, restoreJob.ValidateRestore(ctx))
 }
 
```

**File**: `pkg/cmd/roachtest/tests/online_restore.go` (modified, +111/-0)
```diff
@@ -582,6 +582,117 @@ func registerOnlineRestoreRecovery(r registry.Registry) {
 	})
 }
 
+// registerOnlineRestoreChaos registers a roachtest that restores SmallFixture
+// (350 GiB TPCC) via online restore and injects a process-kill failure during
+// the download phase, then verifies the restored data against the fixture's
+// stored fingerprint. The link phase is fast (~20s) and the download is
+// ~10min, so most of the 4h timeout is reserved for the fingerprint check.
+func registerOnlineRestoreChaos(r registry.Registry) {
+	sp := onlineRestoreSpecs{
+		restoreSpecs: restoreSpecs{
+			hardware:   makeHardwareSpecs(hardwareSpecs{workloadNode: true}),
+			backup:     backupSpecs{cloud: spec.GCE, fixture: SmallFixture},
+			timeout:    4 * time.Hour,
+			suites:     registry.Suites(registry.Nightly),
+			namePrefix: "online-restore-chaos",
+		},
+	}
+	if !backuptestutils.IsOnlineRestoreSupported() {
+		sp.skip = "online restore is only tested on development branch"
+	}
+	sp.initTestName()
+	r.Add(registry.TestSpec{
+		Name:                      sp.testName,
+		Owner:                     registry.OwnerDisasterRecovery,
+		Cluster:                   sp.hardware.makeClusterSpecs(r),
+		Timeout:                   sp.timeout,
+		EncryptionSupport:         registry.EncryptionMetamorphic,
+		CompatibleClouds:          sp.backup.CompatibleClouds(),
+		Suites:                    sp.suites,
+		TestSelectionOptOutSuites: sp.suites,
+		SkipPostValidations:       registry.PostValidationReplicaDivergence,
+		Randomized:                true,
+		Monitor:                   true,
+		Skip:                      sp.skip,
+		Run: func(ctx context.Context, t test.Test, c cluster.Cluster) {
+			runOnlineRestoreChaos(ctx, t, c, sp)
+		},
+	})
+}
+
+func runOnlineRestoreChaos(
+	ctx context.Context, t test.Test, c cluster.Cluster, sp onlineRestoreSpecs,
+) {
+	testRNG, seed := randutil.NewLockedPseudoRand()
+	t.L().Printf("random seed: %d", seed)
+
+	rd := makeRestoreDriver(ctx, t, c, sp.restoreSpecs)
+	rd.prepareCluster(ctx)
+
+	testUtils, err := setupBackupRestoreTestUtils(
+		ctx, t, c, testRNG, withOnlineRestore(true), withCompaction(false),
+	)
+	require.NoError(t, err)
+	defer testUtils.CloseConnections()
+	defer testUtils.takeDebugZip(ctx, t.L())
+
+	// Cap the download retry duration so a stalled job pauses in minutes
+	// rather than after the 72h default.
+	require.NoError(t, testUtils.Exec(ctx, testRNG,
+		"SET CLUSTER SETTING backup.restore.online_download_retry_max_duration = '30m'",
+	))
+
+	const numToKill = 1
+	failureNodes := c.CRDBNodes()[:numToKill]
+	liveNodes := c.CRDBNodes()[numToKill:]
+	isGraceful := testRNG.Intn(2) == 0
+	t.L().Printf("process kill failure isGraceful: %t", isGraceful)
+	t.Monitor().ExpectProcessDead(failureNodes)
+	failer, args, err := roachtestutil.MakeProcessKillFailer(
+		t.L(), c, failureNodes, isGraceful, 5*time.Minute, /* gracePeriod */
+	)
+	require.NoError(t, err)
+	require.NoError(t, failer.Setup(ctx, t.L(), args))
+	defer func() {
+		if err := failer.Cleanup(ctx, t.L()); err != nil {
+			t.L().Printf("failed to clean up failure: %v", err)
+		}
+	}()
+
+	// Link phase. The non-detached restore blocks until the link completes,
+	// after which the download job is queryable from the jobs table.
+	if _, _, err := executeTestRestorePhase(
+		ctx, t, c, sp, rd, true, /* runOnline */
+	); err != nil {
+		t.Fatal(err)
+	}
+
+	queryNode := testUtils.RandomNode(testRNG, liveNodes)
+	var downloadJobID int
+	require.NoError(t, testUtils.QueryRow(ctx, testRNG,
+		`SELECT job_id FROM [SHOW JOBS]
+		 WHERE description LIKE '%Background Data Download%' AND job_type = 'RESTORE'
+		 ORDER BY created DESC LIMIT 1`,
+	).Scan(&downloadJobID))
+	t.L().Printf("OR download job id: %d", downloadJobID)
+
+	injectAndRecoverFailure(
+		ctx, t, t.L(), testUtils, queryNode, downloadJobID, failer, args,
+		randFloatBetween(testRNG, 0.15, 0.50),
+		randFloatBetween(testRNG, 0.50, 0.66),
+	)
+
+	// injectAndRecoverFailure returns once the job has succeeded, but it does
+	// not assert the cluster has actually drained external bytes. Do that
+	// explicitly before the (expensive) fingerprint.
+	conn, err := c.ConnE(ctx, t.L(), queryNode)
+	require.NoError(t, err)
+	defer conn.Close()
+	require.NoError(t, checkNoExternalBytesRemaining(ctx, conn))
+
+	rd.maybeValidateFingerprint(ctx)
+}
+
 func postRestoreValidation(
 	ctx context.Context,
 	c cluster.Cluster,
```

**File**: `pkg/cmd/roachtest/tests/registry.go` (modified, +1/-0)
```diff
@@ -143,6 +143,7 @@ func RegisterTests(r registry.Registry) {
 	registerOnlineRestorePerfBreakdown(r)
 	registerFastRestorePerf(r)
 	registerOnlineRestoreCorrectness(r)
+	registerOnlineRestoreChaos(r)
 	registerRoachmart(r)
 	registerRoachtest(r)
 	registerRubyPG(r)
```

---

### Incident Patch 9: `78450ef4` (2026-06-02)
**Commit Message**: security: remove CCL imports (#171247)

security: remove CCL imports

**File**: `pkg/security/jwtauth/BUILD.bazel` (modified, +0/-1)
```diff
@@ -41,7 +41,6 @@ go_test(
     embed = [":jwtauth"],
     deps = [
         "//pkg/base",
-        "//pkg/ccl",
         "//pkg/security/certnames",
         "//pkg/security/securityassets",
         "//pkg/security/securitytest",
```

**File**: `pkg/security/jwtauth/main_test.go` (modified, +0/-2)
```diff
@@ -10,7 +10,6 @@ import (
 	"testing"
 
 	"github.com/cockroachdb/cockroach/pkg/base"
-	"github.com/cockroachdb/cockroach/pkg/ccl"
 	"github.com/cockroachdb/cockroach/pkg/security/securityassets"
 	"github.com/cockroachdb/cockroach/pkg/security/securitytest"
 	"github.com/cockroachdb/cockroach/pkg/server"
@@ -20,7 +19,6 @@ import (
 )
 
 func TestMain(m *testing.M) {
-	defer ccl.TestingEnableEnterprise()()
 	securityassets.SetLoader(securitytest.EmbeddedAssets)
 	randutil.SeedForTests()
 	serverutils.InitTestServerFactory(
```

**File**: `pkg/security/ldapauth/BUILD.bazel` (modified, +0/-1)
```diff
@@ -43,7 +43,6 @@ go_test(
     embed = [":ldapauth"],
     deps = [
         "//pkg/base",
-        "//pkg/ccl",
         "//pkg/security/certnames",
         "//pkg/security/distinguishedname",
         "//pkg/security/securityassets",
```

**File**: `pkg/security/ldapauth/ldap_util.go` (modified, +1/-1)
```diff
@@ -125,7 +125,7 @@ func (lu *ldapUtil) ListGroups(
 	return ldapGroupsDN, nil
 }
 
-// ILDAPUtil is an interface for the `ldapauthccl` library to wrap various LDAP
+// ILDAPUtil is an interface for the `ldapauth` library to wrap various LDAP
 // functionalities exposed by `go-ldap` library as part of CRDB modules for
 // authN and authZ.
 type ILDAPUtil interface {
```

**File**: `pkg/security/ldapauth/main_test.go` (modified, +0/-2)
```diff
@@ -10,7 +10,6 @@ import (
 	"testing"
 
 	"github.com/cockroachdb/cockroach/pkg/base"
-	"github.com/cockroachdb/cockroach/pkg/ccl"
 	"github.com/cockroachdb/cockroach/pkg/security/securityassets"
 	"github.com/cockroachdb/cockroach/pkg/security/securitytest"
 	"github.com/cockroachdb/cockroach/pkg/server"
@@ -20,7 +19,6 @@ import (
 )
 
 func TestMain(m *testing.M) {
-	defer ccl.TestingEnableEnterprise()()
 	securityassets.SetLoader(securitytest.EmbeddedAssets)
 	randutil.SeedForTests()
 	serverutils.InitTestServerFactory(
```

**File**: `pkg/security/oidcauth/BUILD.bazel` (modified, +0/-1)
```diff
@@ -51,7 +51,6 @@ go_test(
     embed = [":oidcauth"],
     deps = [
         "//pkg/base",
-        "//pkg/ccl",
         "//pkg/roachpb",
         "//pkg/security/certnames",
         "//pkg/security/provisioning",
```

**File**: `pkg/security/oidcauth/main_test.go` (modified, +0/-2)
```diff
@@ -10,7 +10,6 @@ import (
 	"testing"
 
 	"github.com/cockroachdb/cockroach/pkg/base"
-	"github.com/cockroachdb/cockroach/pkg/ccl"
 	"github.com/cockroachdb/cockroach/pkg/security/securityassets"
 	"github.com/cockroachdb/cockroach/pkg/security/securitytest"
 	"github.com/cockroachdb/cockroach/pkg/server"
@@ -20,7 +19,6 @@ import (
 )
 
 func TestMain(m *testing.M) {
-	defer ccl.TestingEnableEnterprise()()
 	securityassets.SetLoader(securitytest.EmbeddedAssets)
 	randutil.SeedForTests()
 	serverutils.InitTestServerFactory(
```

---

### Incident Patch 10: `e40eab30` (2026-06-02)
**Commit Message**: sql: fix FETCH FIRST on empty WITH HOLD cursor

FETCH FIRST on an empty persisted WITH HOLD cursor discarded the
"no more rows" signal from sqlCursor.Next and returned true, causing
the caller to decode an unset EncDatum. Propagate Next's (more, err)
directly, matching the FetchAbsolute path.

Fixes #171238

Release note (bug fix): FETCH FIRST on an empty WITH HOLD cursor no
longer returns an internal error.

**File**: `pkg/sql/logictest/testdata/logic_test/cursor` (modified, +17/-0)
```diff
@@ -943,3 +943,20 @@ statement ok
 CLOSE foo;
 
 subtest end
+
+# Regression test for FETCH FIRST on a persisted WITH HOLD cursor over an
+# empty result set returning an internal error instead of zero rows (#171238).
+subtest regression_171238
+
+statement ok
+BEGIN;
+DECLARE foo_first CURSOR WITH HOLD FOR SELECT * FROM empty;
+COMMIT;
+
+query empty
+FETCH FIRST FROM foo_first;
+
+statement ok
+CLOSE foo_first;
+
+subtest end
```

**File**: `pkg/sql/sql_cursor.go` (modified, +2/-2)
```diff
@@ -288,8 +288,8 @@ func (b *fetchMoveNodeBase) nextInternal(ctx context.Context) (bool, error) {
 		case tree.FetchFirst:
 			switch b.cursor.curRow {
 			case 0:
-				_, err := b.cursor.Next(ctx)
-				return true, err
+				more, err := b.cursor.Next(ctx)
+				return more, err
 			case 1:
 				return true, nil
 			}
```

---

### Incident Patch 11: `116a730b` (2026-05-18)
**Commit Message**: sql/opt/props/physical: add PlanGramBuilder

Add PlanGramBuilder, a stateful builder for constructing PlanGrams,
modeled on explain.OutputBuilder. Enter*/Leave* push and pop frames;
AddField and Ref* methods apply to the current frame. Forward
references and cycles are resolved at Build; the zero value is ready
to use; Reset reuses the underlying map and slice memory.

ParsePlanGram is rewired to drive the same builder so construction
invariants are validated in one place.

Epic: none
Release note: None

**File**: `pkg/sql/opt/plangram/plangram.go` (modified, +1/-16)
```diff
@@ -11,27 +11,12 @@ import (
 	"github.com/cockroachdb/cockroach/pkg/sql/opt/props/physical"
 )
 
-// VisibleToPlanGram returns false if expr is invisible to PlanGram
-// matching. Invisible expressions (e.g. Distribute, Barrier, Explain, etc) are
-// ignored during PlanGram matching.
-func VisibleToPlanGram(expr memo.RelExpr) bool {
-	switch expr.(type) {
-	// Invisible expressions must be unary so that the required PlanGram term can
-	// be passed down to the child group.
-	case *memo.NormCycleTestRelExpr, *memo.MemoCycleTestRelExpr, *memo.BarrierExpr,
-		*memo.DistributeExpr, *memo.ExplainExpr:
-		return false
-	default:
-		return true
-	}
-}
-
 // BuildChildRequired returns the PlanGram term for the nth child of
 // the parent expression.
 func BuildChildRequired(
 	parent memo.RelExpr, required physical.PlanGram, childIdx int, md *opt.Metadata,
 ) physical.PlanGram {
-	if !VisibleToPlanGram(parent) {
+	if !physical.VisibleToPlanGram(parent.Op()) {
 		// For expressions not visible to PlanGrams, the current term is simply
 		// passed down.
 		return required
```

**File**: `pkg/sql/opt/plangram/plangram_test.go` (modified, +1/-1)
```diff
@@ -42,7 +42,7 @@ func TestVisibleToPlanGram(t *testing.T) {
 
 	for _, tc := range tests {
 		t.Run(tc.name, func(t *testing.T) {
-			require.Equal(t, tc.expected, plangram.VisibleToPlanGram(tc.expr))
+			require.Equal(t, tc.expected, physical.VisibleToPlanGram(tc.expr.Op()))
 		})
 	}
 }
```

**File**: `pkg/sql/opt/props/physical/plangram.go` (modified, +353/-116)
```diff
@@ -10,6 +10,7 @@ import (
 	"bytes"
 	"io"
 	"reflect"
+	"slices"
 	"strconv"
 	"strings"
 	"unicode"
@@ -60,6 +61,10 @@ import (
 // automatons. We could compile the PlanGram into a state-table-based NFTA, but
 // for now we simply walk and interpret it during planning.
 //
+// PlanGrams are constructed via PlanGramBuilder or ParsePlanGram. The internal
+// term representation is hidden so that the package retains freedom to change
+// it (e.g., to intern shared subtrees or compile to an NFTA).
+//
 // For some background see https://en.wikipedia.org/wiki/Regular_tree_grammar
 // and https://en.wikipedia.org/wiki/Tree_automaton.
 //
@@ -344,18 +349,316 @@ func (p PlanGram) String() string {
 	return b.String()
 }
 
-// ParsePlanGram parses a PlanGram grammar from the given io.Reader, or returns
-// an error if it cannot.
+// PlanGramBuilder builds a PlanGram via a stateful nested-context API,
+// modeled on explain.OutputBuilder. The builder maintains an implicit
+// "current position" stack: Enter* pushes a new context, Leave* pops it.
+// AddField and the Ref* methods apply to whatever's on top.
+//
+// Production references are by name. Forward references are permitted: a
+// production may be referenced before EnterProduction has declared it; the
+// reference is resolved at Build time. The same idiom supports cycles —
+// reference a production from within its own rules.
+//
+// Nested EnterProduction (declaring a sub-production while another context is
+// open) is allowed; the inner production is not connected to the outer
+// context except via explicit RefProduction calls. This matches the
+// requirement of decompile, where an alternation production is declared
+// inline at the spot where it is referenced.
+//
+// The zero value is ready to use. Build does not mutate state, so it may be
+// called multiple times (returning equivalent PlanGrams) or interleaved with
+// further construction calls. To construct a new grammar, call Reset —
+// following the strings.Builder convention.
+//
+// A PlanGramBuilder is not safe for concurrent use.
+type PlanGramBuilder struct {
+	// productions tracks all named productions, including forward-reference
+	// stubs (which have empty rules until their EnterProduction call
+	// completes). Lazily allocated on first use; cleared by Reset.
+	productions map[string]*planGramProduction
+	// stack is the nested context stack. Each frame is the in-progress
+	// production or expression at that nesting depth. Cleared by Reset.
+	stack []planGramTerm
+}
+
+// EnterProduction starts a new named production. Subsequent EnterExpr / Ref*
+// calls add rules to this production until the matching LeaveProduction. The
+// "root" production is required and must contain exactly one rule.
+//
+// See planGramProduction.name for the constraints on name. Calling
+// EnterProduction with a name that already has rules (i.e., was previously
+// completed via LeaveProduction) is a duplicate error.
+func (b *PlanGramBuilder) EnterProduction(name string) error {
+	if name == "any" || name == "none" {
+		return errors.Newf("%q cannot be used as a production name", name)
+	}
+	pp, err := b.getOrCreateProduction(name)
+	if err != nil {
+		return err
+	}
+	if len(pp.rules) > 0 {
+		return errors.Newf("duplicate production %q", name)
+	}
+	// Disallow re-entering an already-in-progress production.
+	for _, frame := range b.stack {
+		if frame == pp {
+			return errors.Newf("production %q already in progress", name)
+		}
+	}
+	b.stack = append(b.stack, pp)
+	return nil
+}
+
+// LeaveProduction pops the current production. The production must have at
+// least one rule. Pairs with EnterProduction.
+func (b *PlanGramBuilder) LeaveProduction() error {
+	if len(b.stack) == 0 {
+		return errors.New("LeaveProduction without matching EnterProduction")
+	}
+	top, ok := b.stack[len(b.stack)-1].(*planGramProduction)
+	if !ok {
+		return errors.New("LeaveProduction called with expression on top")
+	}
+	if len(top.rules) == 0 {
+		return errors.Newf("production %q has no rules", top.name)
+	}
+	b.stack = b.stack[:len(b.stack)-1]
+	return nil
+}
+
+// EnterExpr starts a new expression with the given op. Subsequent AddField,
+// EnterExpr, and Ref* calls add fields and children. On LeaveExpr, the
+// completed expression becomes either a child of the enclosing expression or
+// a rule of the enclosing production, depending on context.
+func (b *PlanGramBuilder) EnterExpr(op opt.Operator) error {
+	if len(b.stack) == 0 {
+		return errors.New("EnterExpr on empty builder")
+	}
+	if !VisibleToPlanGram(op) {
+		return errors.AssertionFailedf("op %s is invisible to PlanGram matching", op)
+	}
+	b.stack = append(b.stack, &planGramExpr{op: op})
+	return nil
+}
+
+// VisibleToPlanGram reports whether op participates in PlanGram matching.
+// Invisible operators (e.g. Explain, Barrier, Distribute) are optimizer-internal
+// or are dropped before a plan is costed; the matcher skips them, so a PlanGram
+// must never
```

**File**: `pkg/sql/opt/props/physical/plangram_test.go` (modified, +366/-1)
```diff
@@ -810,6 +810,371 @@ func TestPlanGramVisitAlternates(t *testing.T) {
 	}
 }
 
+func TestPlanGramBuilder(t *testing.T) {
+	defer leaktest.AfterTest(t)()
+	defer log.Scope(t).Close(t)
+
+	t.Run("simple terminal", func(t *testing.T) {
+		var b PlanGramBuilder
+		require.NoError(t, b.EnterProduction("root"))
+		require.NoError(t, b.EnterExpr(opt.ScanOp))
+		require.NoError(t, b.AddField(PlanGramField{Key: "Index", Val: "abc_a_idx"}))
+		require.NoError(t, b.LeaveExpr())
+		require.NoError(t, b.LeaveProduction())
+		pg, err := b.Build()
+		require.NoError(t, err)
+		require.Equal(t, `root: (Scan Index="abc_a_idx");`, pg.String())
+	})
+
+	t.Run("nested expressions", func(t *testing.T) {
+		var b PlanGramBuilder
+		require.NoError(t, b.EnterProduction("root"))
+		require.NoError(t, b.EnterExpr(opt.SelectOp))
+		require.NoError(t, b.EnterExpr(opt.IndexJoinOp))
+		require.NoError(t, b.AddField(PlanGramField{Key: "Table", Val: "abc"}))
+		require.NoError(t, b.EnterExpr(opt.ScanOp))
+		require.NoError(t, b.AddField(PlanGramField{Key: "Index", Val: "abc_b_idx"}))
+		require.NoError(t, b.LeaveExpr())
+		require.NoError(t, b.LeaveExpr())
+		require.NoError(t, b.LeaveExpr())
+		require.NoError(t, b.LeaveProduction())
+		pg, err := b.Build()
+		require.NoError(t, err)
+		require.Equal(t, `root: (Select (IndexJoin Table="abc" (Scan Index="abc_b_idx")));`, pg.String())
+	})
+
+	t.Run("any and none refs", func(t *testing.T) {
+		var b PlanGramBuilder
+		require.NoError(t, b.EnterProduction("root"))
+		require.NoError(t, b.EnterExpr(opt.SelectOp))
+		require.NoError(t, b.RefAny())
+		require.NoError(t, b.RefNone())
+		require.NoError(t, b.LeaveExpr())
+		require.NoError(t, b.LeaveProduction())
+		pg, err := b.Build()
+		require.NoError(t, err)
+		require.Equal(t, "root: (Select any none);", pg.String())
+	})
+
+	t.Run("forward reference and alternates", func(t *testing.T) {
+		var b PlanGramBuilder
+		require.NoError(t, b.EnterProduction("root"))
+		require.NoError(t, b.EnterExpr(opt.SelectOp))
+		require.NoError(t, b.EnterExpr(opt.IndexJoinOp))
+		require.NoError(t, b.RefProduction("scan"))
+		require.NoError(t, b.LeaveExpr())
+		require.NoError(t, b.LeaveExpr())
+		require.NoError(t, b.LeaveProduction())
+		require.NoError(t, b.EnterProduction("scan"))
+		require.NoError(t, b.EnterExpr(opt.ScanOp))
+		require.NoError(t, b.AddField(PlanGramField{Key: "Index", Val: "abc_b_idx"}))
+		require.NoError(t, b.LeaveExpr())
+		require.NoError(t, b.EnterExpr(opt.ScanOp))
+		require.NoError(t, b.AddField(PlanGramField{Key: "Index", Val: "abc_c_idx"}))
+		require.NoError(t, b.LeaveExpr())
+		require.NoError(t, b.LeaveProduction())
+		pg, err := b.Build()
+		require.NoError(t, err)
+		require.Equal(t,
+			`root: (Select (IndexJoin scan)); scan: (Scan Index="abc_b_idx") | (Scan Index="abc_c_idx");`,
+			pg.String())
+	})
+
+	t.Run("self-referencing cycle", func(t *testing.T) {
+		// Nested EnterProduction: declare cycle inside the root expression at
+		// the spot where it's referenced. This mirrors what decompile.go does.
+		var b PlanGramBuilder
+		require.NoError(t, b.EnterProduction("root"))
+		require.NoError(t, b.RefProduction("cycle"))
+		require.NoError(t, b.EnterProduction("cycle"))
+		require.NoError(t, b.EnterExpr(opt.InnerJoinOp))
+		require.NoError(t, b.RefProduction("cycle"))
+		require.NoError(t, b.RefProduction("cycle"))
+		require.NoError(t, b.LeaveExpr())
+		require.NoError(t, b.RefProduction("scan"))
+		require.NoError(t, b.LeaveProduction())
+		require.NoError(t, b.LeaveProduction())
+		require.NoError(t, b.EnterProduction("scan"))
+		require.NoError(t, b.EnterExpr(opt.ScanOp))
+		require.NoError(t, b.AddField(PlanGramField{Key: "Index", Val: "abc_b_idx"}))
+		require.NoError(t, b.LeaveExpr())
+		require.NoError(t, b.LeaveProduction())
+		pg, err := b.Build()
+		require.NoError(t, err)
+		require.Equal(t,
+			`root: cycle; cycle: (InnerJoin cycle cycle) | scan; scan: (Scan Index="abc_b_idx");`,
+			pg.String())
+	})
+
+	t.Run("reuse after Reset", func(t *testing.T) {
+		var b PlanGramBuilder
+		require.NoError(t, b.EnterProduction("root"))
+		require.NoError(t, b.EnterExpr(opt.ScanOp))
+		require.NoError(t, b.LeaveExpr())
+		require.NoError(t, b.LeaveProduction())
+		pg1, err := b.Build()
+		require.NoError(t, err)
+		require.Equal(t, "root: (Scan);", pg1.String())
+
+		b.Reset()
+
+		require.NoError(t, b.EnterProduction("root"))
+		require.NoError(t, b.EnterExpr(opt.SelectOp))
+		require.NoError(t, b.LeaveExpr())
+		require.NoError(t, b.LeaveProduction())
+		pg2, err := b.Build()
+		require.NoError(t, err)
+		require.Equal(t, "root: (Select);", pg2.String())
+
+		// The first grammar must not be affected by the reset.
+		require.Equal(t, "root: (Scan);", pg1.String())
+	})
+
+	t.Run("Build does not mutate", func(t *testing.T) {
+		// Build can be called repeatedly and interleaved with construction
+		// without disturbing the builder state, matching the strings.Builder
+		// convention.
+		var b PlanGramBuilder
+		r
```

**File**: `pkg/sql/opt/xform/coster.go` (modified, +1/-2)
```diff
@@ -16,7 +16,6 @@ import (
 	"github.com/cockroachdb/cockroach/pkg/sql/opt/distribution"
 	"github.com/cockroachdb/cockroach/pkg/sql/opt/memo"
 	"github.com/cockroachdb/cockroach/pkg/sql/opt/ordering"
-	"github.com/cockroachdb/cockroach/pkg/sql/opt/plangram"
 	"github.com/cockroachdb/cockroach/pkg/sql/opt/props"
 	"github.com/cockroachdb/cockroach/pkg/sql/opt/props/physical"
 	"github.com/cockroachdb/cockroach/pkg/sql/sem/eval"
@@ -639,7 +638,7 @@ func (c *coster) ComputeCost(candidate memo.RelExpr, required *physical.Required
 	}
 
 	// Penalize expressions that don't match the PlanGram.
-	if plangram.VisibleToPlanGram(candidate) && !required.PlanGram.Matches(candidate, c.mem.Metadata()) {
+	if physical.VisibleToPlanGram(candidate.Op()) && !required.PlanGram.Matches(candidate, c.mem.Metadata()) {
 		cost.Penalties |= memo.PlanGramMismatchPenalty
 	}
 
```

---

### Incident Patch 12: `17b56ec5` (2026-06-02)
**Commit Message**: opt,optbuilder: add NumStmts/BuildStmt to RoutineBodyBuilder (#171173)

opt,optbuilder: add NumStmts/BuildStmt to RoutineBodyBuilder

**File**: `pkg/sql/opt/memo/expr.go` (modified, +34/-0)
```diff
@@ -1471,13 +1471,47 @@ type PostQueryBuilder interface {
 // Note: factory is always *norm.Factory; declared as interface{} to
 // avoid circular package dependencies.
 type RoutineBodyBuilder interface {
+	// Build constructs all body statements at once into the single provided
+	// factory, for callers that do not interleave building with execution. It
+	// produces the same per-statement RelExprs as BuildStmt over
+	// [0, NumStmts()), but with all statements sharing one factory and one set
+	// of parameter columns. (BuildStmt requires a fresh factory per call to
+	// keep parameter column IDs stable; see BuildStmt.)
 	Build(
 		ctx context.Context,
 		semaCtx *tree.SemaContext,
 		evalCtx *eval.Context,
 		catalog cat.Catalog,
 		factory interface{},
 	) (body []RelExpr, bodyProps []*physical.Required, params opt.ColList, err error)
+
+	// NumStmts returns the number of body statements that will be built,
+	// including any synthetic statement appended for a VOID-returning
+	// routine. It is stable for the lifetime of the builder.
+	NumStmts() int
+
+	// BuildStmt builds the body statement at stmtIdx into a RelExpr using the
+	// provided catalog and factory. The caller may refresh the catalog
+	// between calls so that a statement can resolve names introduced by DDL
+	// executed in an earlier statement.
+	//
+	// The caller must pass a fresh, empty factory on each call. Parameter
+	// columns are then synthesized with identical column IDs across calls, so
+	// one argument-to-parameter mapping serves every statement.
+	//
+	// TODO(janexing): think about the mutation detection with interleaving
+	// model. Unlike the lump-sum Build path, where all statements share one
+	// statementTree and a later body statement sees mutations registered by
+	// earlier ones, BuildStmt re-inits the tree per call, so cross-statement
+	// conflict detection within a body no longer happens here.
+	BuildStmt(
+		ctx context.Context,
+		semaCtx *tree.SemaContext,
+		evalCtx *eval.Context,
+		catalog cat.Catalog,
+		factory interface{},
+		stmtIdx int,
+	) (stmt RelExpr, props *physical.Required, params opt.ColList, err error)
 }
 
 // GroupingOrderType is the grouping column order type for group by and distinct
```

**File**: `pkg/sql/opt/optbuilder/BUILD.bazel` (modified, +3/-0)
```diff
@@ -122,6 +122,7 @@ go_test(
     srcs = [
         "builder_test.go",
         "name_resolution_test.go",
+        "routine_test.go",
         "scalar_test.go",
         "statement_tree_test.go",
         "union_test.go",
@@ -134,6 +135,7 @@ go_test(
         "//pkg/sql/catalog/colinfo/colinfotestutils",
         "//pkg/sql/opt/cat",
         "//pkg/sql/opt/memo",
+        "//pkg/sql/opt/norm",
         "//pkg/sql/opt/testutils",
         "//pkg/sql/opt/testutils/opttester",
         "//pkg/sql/opt/testutils/testcat",
@@ -146,5 +148,6 @@ go_test(
         "//pkg/testutils/datapathutils",
         "//pkg/util/leaktest",
         "@com_github_cockroachdb_datadriven//:datadriven",
+        "@com_github_stretchr_testify//require",
     ],
 )
```

**File**: `pkg/sql/opt/optbuilder/routine.go` (modified, +218/-83)
```diff
@@ -558,26 +558,20 @@ func (b *Builder) buildRoutine(
 	return routine
 }
 
-// buildSQLRoutineBodyStmts builds the body statements of a SQL routine into
-// RelExprs. It is used on both the eager path (plan-time) and the deferred path
-// (execution-time), distinguished by funcExpr:
+// buildSQLRoutineBodyStmts builds all body statements of a SQL routine into
+// RelExprs at plan time (the eager path), called from buildRoutine.
 //
-//   - Eager path (funcExpr != nil): called at plan time from
-//     buildRoutine. The return type may still need finalization (e.g. resolving
-//     AnyTuple for RETURNS RECORD routines), so finalizeRoutineReturnType is
-//     called. funcExpr and inScope are required for this
-//     finalization.
-//
-//   - Deferred path (funcExpr == nil): called at execution time from
-//     sqlRoutineBodyBuilder.Build. The return type (rTyp) was already resolved
-//     and persisted at plan time — AnyTuple and ReturnsRecordType are always
-//     resolved before reaching this path. Only validateReturnType is needed to
-//     confirm that the rebuilt body columns are still compatible.
+// It appends the synthetic VOID-return statement when needed, then builds each
+// statement via buildOneBodyStmt. funcExpr (always non-nil here) and inScope
+// are required because the final statement's return type may still need
+// finalization at plan time, e.g. resolving AnyTuple for RETURNS RECORD
+// routines; see buildOneBodyStmt for how funcExpr selects between finalization
+// and validation. rTyp is the return type (funcExpr.ResolvedType()), used for
+// the VOID-return check.
 //
-// rTyp is the routine's return type on both paths: on the eager path it is
-// funcExpr.ResolvedType(); on the deferred path it is the type captured
-// at plan time. It is always used for the VOID-return check (appending
-// VALUES (NULL)).
+// The deferred (execution-time) path does not go through this function; it
+// builds statements directly via buildOneBodyStmt from
+// sqlRoutineBodyBuilder.Build and BuildStmt.
 func (b *Builder) buildSQLRoutineBodyStmts(
 	stmtASTs []tree.Statement,
 	bodyScope *scope,
@@ -587,64 +581,111 @@ func (b *Builder) buildSQLRoutineBodyStmts(
 	isSetReturning bool,
 	insideDataSource bool,
 ) (body []memo.RelExpr, bodyProps []*physical.Required, bodyTags []string) {
-	// Add a VALUES (NULL) statement if the return type of the function is
-	// VOID. We cannot simply project NULL from the last statement because
-	// all columns would be pruned and the contents of last statement would
-	// not be executed.
-	// TODO(mgartner): This will add some planning overhead for every
-	// invocation of the function. Is there a more efficient way to do this?
-	var appendedNullForVoidReturn bool
-	if rTyp.Family() == types.VoidFamily {
-		stmtASTs = append(append([]tree.Statement(nil), stmtASTs...), &tree.Select{
-			Select: &tree.ValuesClause{
-				Rows: []tree.Exprs{{tree.DNull}},
-			},
-		})
-		appendedNullForVoidReturn = true
-	}
-
+	stmtASTs, appendedNullForVoidReturn := maybeAppendVoidReturnStmt(stmtASTs, rTyp)
+	lastIdx := len(stmtASTs) - 1
 	body = make([]memo.RelExpr, len(stmtASTs))
 	bodyProps = make([]*physical.Required, len(stmtASTs))
 	bodyTags = make([]string, len(stmtASTs))
 	for i, ast := range stmtASTs {
-		// TODO(michae2): We should be checking the statement hints cache here to
-		// find any external statement hints that could apply to this statement.
-		stmtScope := b.buildStmtAtRootWithScope(ast, nil /* desiredTypes */, bodyScope)
-
-		// The last statement produces the output of the routine.
-		if i == len(stmtASTs)-1 {
-			if funcExpr != nil {
-				// Eager path: finalize the return type. This handles AnyTuple
-				// resolution for RETURNS RECORD routines, column-definition-list
-				// validation for data-source usage, and type annotation on the
-				// FuncExpr. See finalizeRoutineReturnType for details.
-				rTyp = b.finalizeRoutineReturnType(
-					funcExpr, stmtScope, inScope, insideDataSource,
-				)
-			} else {
-				// Deferred path: the return type is already resolved. Just
-				// validate that the rebuilt body columns are compatible.
-				if err := validateReturnType(
-					b.ctx, b.semaCtx, rTyp, stmtScope.cols,
-				); err != nil {
-					panic(err)
-				}
-			}
-			stmtScope = b.finishRoutineReturnStmt(stmtScope, isSetReturning, insideDataSource, rTyp)
-		}
-		body[i] = stmtScope.expr
-		bodyProps[i] = stmtScope.makePhysicalProps()
+		expr, props, tag := b.buildOneBodyStmt(
+			ast, bodyScope, rTyp, funcExpr, inScope, isSetReturning, insideDataSource, i, lastIdx,
+		)
+		body[i] = expr
+		bodyProps[i] = props
 		// We don't need a statement tag for the artificial appended `SELECT NULL`
 		// statement.
-		if appendedNullForVoidReturn && i == len(stmtASTs)-1 {
+		if appendedNullForVoidReturn && i == lastIdx {
 			bodyTags[i] = ""
 		} else {
-			bodyTags[i] = ast.StatementTag()
+			bodyTags[i] = tag
 		}
 	}
 	return body, bodyProps, bodyTags
 }
 
+// bui
```

**File**: `pkg/sql/opt/optbuilder/routine_test.go` (added, +179/-0)
```diff
@@ -0,0 +1,179 @@
+// Copyright 2026 The Cockroach Authors.
+//
+// Use of this software is governed by the CockroachDB Software License
+// included in the /LICENSE file.
+
+package optbuilder
+
+import (
+	"context"
+	"testing"
+
+	"github.com/cockroachdb/cockroach/pkg/settings/cluster"
+	"github.com/cockroachdb/cockroach/pkg/sql/opt/cat"
+	"github.com/cockroachdb/cockroach/pkg/sql/opt/memo"
+	"github.com/cockroachdb/cockroach/pkg/sql/opt/norm"
+	"github.com/cockroachdb/cockroach/pkg/sql/opt/testutils/testcat"
+	"github.com/cockroachdb/cockroach/pkg/sql/parser"
+	"github.com/cockroachdb/cockroach/pkg/sql/sem/eval"
+	"github.com/cockroachdb/cockroach/pkg/sql/sem/tree"
+	"github.com/cockroachdb/cockroach/pkg/sql/types"
+	"github.com/cockroachdb/cockroach/pkg/util/leaktest"
+	"github.com/stretchr/testify/require"
+)
+
+// routineBuilderHarness bundles the state needed to drive a
+// sqlRoutineBodyBuilder directly in a unit test, without going through
+// buildRoutine.
+type routineBuilderHarness struct {
+	ctx     context.Context
+	semaCtx tree.SemaContext
+	evalCtx eval.Context
+	catalog cat.Catalog
+}
+
+func newRoutineBuilderHarness() *routineBuilderHarness {
+	ctx := context.Background()
+	return &routineBuilderHarness{
+		ctx:     ctx,
+		semaCtx: tree.MakeSemaContext(nil /* resolver */),
+		evalCtx: eval.MakeTestingEvalContext(cluster.MakeTestingClusterSettings()),
+		catalog: testcat.New(),
+	}
+}
+
+// freshFactory returns a norm.Factory backed by a new, empty memo. Build and
+// BuildStmt each require their own factory; a fresh factory also makes
+// column-ID allocation deterministic across calls.
+func (h *routineBuilderHarness) freshFactory() *norm.Factory {
+	var f norm.Factory
+	f.Init(h.ctx, &h.evalCtx, h.catalog)
+	return &f
+}
+
+func (h *routineBuilderHarness) parseBody(t *testing.T, body string) []tree.Statement {
+	stmts, err := parser.Parse(body)
+	require.NoError(t, err)
+	asts := make([]tree.Statement, len(stmts))
+	for i := range stmts {
+		asts[i] = stmts[i].AST
+	}
+	return asts
+}
+
+func (h *routineBuilderHarness) newBodyBuilder(
+	t *testing.T,
+	body string,
+	rTyp *types.T,
+	isSetReturning bool,
+	paramNames []tree.Name,
+	paramTypes []*types.T,
+) memo.RoutineBodyBuilder {
+	return newSQLRoutineBodyBuilder(sqlRoutineBodyBuilder{
+		stmtASTs:       h.parseBody(t, body),
+		paramTypes:     paramTypes,
+		paramNames:     paramNames,
+		rTyp:           rTyp,
+		isSetReturning: isSetReturning,
+		routineType:    tree.UDFRoutine,
+	})
+}
+
+// TestSQLRoutineBodyBuilderNumStmts verifies that NumStmts reflects the number
+// of body statements, including the synthetic VALUES (NULL) statement appended
+// for VOID-returning routines.
+func TestSQLRoutineBodyBuilderNumStmts(t *testing.T) {
+	defer leaktest.AfterTest(t)()
+	h := newRoutineBuilderHarness()
+	testCases := []struct {
+		name             string
+		body             string
+		rTyp             *types.T
+		expectedNumStmts int
+	}{
+		{name: "single statement", body: "SELECT 1", rTyp: types.Int, expectedNumStmts: 1},
+		{name: "multiple statements", body: "SELECT 1; SELECT 2; SELECT 3", rTyp: types.Int, expectedNumStmts: 3},
+		{name: "void appends synthetic statement", body: "SELECT 1", rTyp: types.Void, expectedNumStmts: 2},
+	}
+	for _, tc := range testCases {
+		t.Run(tc.name, func(t *testing.T) {
+			rb := h.newBodyBuilder(
+				t, tc.body, tc.rTyp, false /* isSetReturning */, nil /* paramNames */, nil, /* paramTypes */
+			)
+			require.Equal(t, tc.expectedNumStmts, rb.NumStmts())
+		})
+	}
+}
+
+// TestSQLRoutineBodyBuilderBuildStmtMatchesBuild verifies that building the body
+// one statement at a time via BuildStmt produces the same number of statements,
+// the same per-statement operators, and the same parameter columns as the
+// all-at-once Build.
+func TestSQLRoutineBodyBuilderBuildStmtMatchesBuild(t *testing.T) {
+	defer leaktest.AfterTest(t)()
+	h := newRoutineBuilderHarness()
+	rb := h.newBodyBuilder(
+		t, "SELECT 1; SELECT 2; SELECT 3", types.Int, false /* isSetReturning */, nil, nil,
+	)
+
+	body, bodyProps, params, err := rb.Build(
+		h.ctx, &h.semaCtx, &h.evalCtx, h.catalog, h.freshFactory(),
+	)
+	require.NoError(t, err)
+	require.Len(t, body, rb.NumStmts())
+	require.Len(t, bodyProps, rb.NumStmts())
+
+	for i := 0; i < rb.NumStmts(); i++ {
+		stmt, props, perStmtParams, err := rb.BuildStmt(
+			h.ctx, &h.semaCtx, &h.evalCtx, h.catalog, h.freshFactory(), i,
+		)
+		require.NoErrorf(t, err, "stmt %d", i)
+		require.NotNil(t, stmt)
+		require.NotNil(t, props)
+		require.Equalf(t, body[i].Op(), stmt.Op(), "operator mismatch at stmt %d", i)
+		require.Equalf(t, params, perStmtParams, "params mismatch at stmt %d", i)
+	}
+}
+
+// TestSQLRoutineBodyBuilderStableParamCols verifies that BuildStmt returns the
+// same parameter column IDs regardless of which statement index is built. The
+// interleaved build/execute path relies on this so that argument-to-parameter
+// mapping is consistent across statements.
+fu
```

#### Recent Merged Pull Requests:
- **PR #175795** (closed): opt: penalize full scans of partial indexes under AVOID_FULL_SCAN (@u9g)
- **PR #175770** (2026-09-23): .github: forward autosolve labels to the code repository's workflow (@rafiss)
- **PR #175567** (2026-09-22): .github: run CI agents on the full Claude Code system prompt (@rafiss)
- **PR #175564** (2026-09-16): .github: fix issue autosolver diagnostics and retry behavior (@rafiss)
- **PR #175527** (2026-09-15): readme: update to new logo (@jlinder)
- **PR #175476** (closed): sql: handle empty geography in inverted DWithin joins (@sakshichitnis27)
- **PR #175301** (closed): sql: resolve PostgreSQL timezone abbreviations as fixed offsets (@Alignyx)
- **PR #174717** (closed): sql: stabilize decimal VARIANCE with large offsets (@Alignyx)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
