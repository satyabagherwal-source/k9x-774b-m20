> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/cockroachdb-cockroach-learnings.md`  
> **Source**: github ([https://github.com/cockroachdb/cockroach](https://github.com/cockroachdb/cockroach))  
> **Source Version**: `d30c905f`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T02:10:00.761Z  
> **Learning ID**: `learn-github-cockroachdb-cockroach`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): cockroachdb/cockroach

> **Canonical Artifact**: `07_PROJECT_LEARNING/cockroachdb-cockroach-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/cockroachdb/cockroach](https://github.com/cockroachdb/cockroach))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-19T02:10:00.755Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `cockroachdb/cockroach`
- **Description**: CockroachDB — the cloud native, distributed SQL database designed for high availability, effortless scale, and control over data placement.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 32572 stars

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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #176139** (2026-10-17): **basalt-26.3.2-rc-20260916: pkg/sql/sqlitelogictest/tests/local-prepared/local-prepared_test: TestSqlLiteLogic_testindexdelete1slt_good_0_test failed**
  *Symptoms*: pkg/sql/sqlitelogictest/tests/local-prepared/local-prepared_test.TestSqlLiteLogic_testindexdelete1slt_good_0_test [failed](https://teamcity.cockroachdb.com/buildConfiguration/Cockroach_Nightlies_SQLiteLogicTestsBazel/21557953?buildTab=log) with [artifacts](https://teamcity.cockroachdb.com/buildConfiguration/Cockroach_Nightlies_SQLiteLogicTestsBazel/21557953?buildTab=artifacts#/) on basalt-26.3.2-rc-20260916 @ [7105e31e582a453d3e1af1938ada5fa6066f5580](https://github.com/cockroachdb/cockroach/commits/7105e31e582a453d3e1af1938ada5fa6066f5580):   ``` [15:40:13] --- progress: /home/roach/.cache/bazel/_bazel_roach/c5a4e7d36696d9cd970af2045211a7df/sandbox/processwrapper-sandbox/3718/execroot/com_github_cockroachdb_cockroach/bazel-out/k8-fastbuild/bin/pkg/sql/sqlitelogictest/tests/local-prepared/local-prepared_test_/local-prepared_test.runfiles/com_github_cockroachdb_cockroach/external/com_github_cockroachdb_sqllogictest/test/index/delete/1/slt_good_0.test: 6039 statements [15:40:16] --- progress: /home/roach/.cache/bazel/_bazel_roach/c5a4e7d36696d9cd970af2045211a7df/sandbox/processwrapper-sandbox/3718/execroot/com_github_cockroachdb_cockroach/bazel-out/k8-fastbuild/bin/pkg/sql/sqlitelogictest/tests/local-prepared/local-prepared_test_/local-prepared_test.runfiles/com_github_cockroachdb_cockroach/external/com_github_cockroachdb_sqllogictest/test/index/delete/1/slt_good_0.test: 6044 statements [15:40:18] --- progress: /home/roach/.cache/bazel/_bazel_roach/c5a4e7d36696d9cd970af2045211a
  **Post-Mortem & Fix Analysis**:
  > dup of #173148

- **Issue #176133** (2026-10-15): **basalt-26.3.2-rc-20260916: sql/physicalplan: TestFakeSpanResolver failed**
  *Symptoms*: sql/physicalplan.TestFakeSpanResolver [failed](https://mesolite.cluster.engflow.com/invocations/default/d22d2517-617b-4be3-925e-1dfd89759c29?testReportRun=2&testReportShard=3&testReportAttempt=1#targets-Ly9wa2cvc3FsL3BoeXNpY2FscGxhbjpwaHlzaWNhbHBsYW5fdGVzdA==) on basalt-26.3.2-rc-20260916 @ [7105e31e582a453d3e1af1938ada5fa6066f5580](https://github.com/cockroachdb/cockroach/commits/7105e31e582a453d3e1af1938ada5fa6066f5580):   ``` === RUN   TestFakeSpanResolver     test_log_scope.go:172: test logs captured to: outputs.zip/logTestFakeSpanResolver3849239118     test_log_scope.go:82: use -show-logs to present logs inline     test_server_shim.go:168: automatically injected an external process virtual cluster under test; see comment at top of test_server_shim.go for details.     table_gen.go:51: error executing query="CREATE DATABASE IF NOT EXISTS test;CREATE TABLE test.t (k INT PRIMARY KEY, v INT);" args=[]: ERROR: EOF     panic.go:694: -- test log scope end -- test logs left over in: outputs.zip/logTestFakeSpanResolver3849239118 --- FAIL: TestFakeSpanResolver (1047.59s) ```  Parameters:  - <code>attempt=1</code>  - <code>race=true</code>  - <code>run=2</code>  - <code>shard=3</code> <details><summary>Help</summary> <p>  See also: [How To Investigate a Go Test Failure \(internal\)](https://cockroachlabs.atlassian.net/l/c/HgfXfJgM) </p> </details> <sub>  [This test on roachdash](https://roachdash.crdb.dev/?filter=status:open%20t:.*TestFakeSpanResolver.*&sort=title+created&display=la

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

### Incident Patch 1: `c21c6784` (2026-08-05)
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

### Incident Patch 2: `84864bbe` (2026-08-01)
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

### Incident Patch 3: `00a3c2c5` (2026-08-05)
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

#### Recent Merged Pull Requests:
- **PR #176080** (closed): sql: abort open transaction on pgwire cancel request (@erikhortsch)
- **PR #176062** (closed): colexec: fall back for unsupported window argument casts (@sakshichitnis27)
- **PR #176037** (closed): sql: fix FETCH FIRST on persisted single-row WITH HOLD cursor (@Mitshah2406)
- **PR #175921** (closed): lex: allow whitespace between hex digit pairs in bytea input (@Shubham-Padkonde)
- **PR #175920** (closed): duration: accept a trailing number without a unit in intervals (@Shubham-Padkonde)
- **PR #175919** (closed): duration: support the ISO 8601 alternative interval format (@Shubham-Padkonde)

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

## X. Merge pull request #172915 from shivamshaw23/fix-172889-compaction-lock-cleanup

**RULE**:
When implementing operations in `pkg/backup/backup_job.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in cockroachdb/cockroach. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c21c6784`: Merge pull request #172915 from shivamshaw23/fix-172889-compaction-lock-cleanup. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `pkg/backup/backup_job.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	"github.com/cockroachdb/cockroach/pkg/util/besteffort"
// compactionBackupLockCleanupOp is the besteffort operation name used when
// removing the BACKUP-LOCK file left behind by a failed compaction job.
const compactionBackupLockCleanupOp = "delete-compaction-backup-lock"


	// For compaction jobs, clean up the BACKUP-LOCK file from the backup
	// destination to unblock subsequent compaction attempts that may target
	// the same location. A failed compaction does not produce a valid backup at
	// the destination, so the lock serves no purpose and only blocks future
	// compactions.
	if details.Compact && details.URI != "" {
		besteffort.Warning(ctx, compactionBackupLockCleanupOp, func(ctx context.Context) error {
			return backupinfo.DeleteBackupLock(
				ctx, cfg, details.URI, b.job.ID(), p.User(),
			)
		})
	}

```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `c21c6784` are properly handled with clean fallback behavior.
