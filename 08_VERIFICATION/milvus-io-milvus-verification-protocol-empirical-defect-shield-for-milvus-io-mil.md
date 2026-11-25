# Verification Protocol: Verification Protocol: Empirical Defect Shield for milvus-io/milvus

<!-- PROVENANCE_START
{
  "source_repository": "milvus-io/milvus",
  "source_url": "https://github.com/milvus-io/milvus",
  "source_version": "45164988",
  "license": "Apache-2.0",
  "timestamp": "2026-11-25T15:00:44.162Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-milvus-io-milvus",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [milvus-io/milvus](https://github.com/milvus-io/milvus) (Revision: `45164988`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-25T15:00:44.162Z`  
> **Learning ID**: `learn-github-milvus-io-milvus`


## 1. Scope & Verification Target
- **Target Repository**: `milvus-io/milvus` (Commit: `45164988`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): milvus-io/milvus

> **Canonical Artifact**: `07_PROJECT_LEARNING/milvus-io-milvus-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/milvus-io/milvus](https://github.com/milvus-io/milvus))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-25T15:00:42.262Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `milvus-io/milvus`
- **Description**: Milvus is a high-performance, cloud-native vector database built for scalable vector ANN search
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 46739 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `client/entity/load_state.go`
```
// Licensed to the LF AI & Data foundation under one
// or more contributor license agreements. See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership. The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License. You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package entity

import "github.com/milvus-io/milvus-proto/go-api/v3/commonpb"

type LoadStateCode commonpb.LoadState

const (
	// LoadStateNone      LoadStateCode = LoadStateCode(commonpb.LoadState)
	LoadStateLoading   LoadStateCode = LoadStateCode(commonpb.LoadState_LoadStateLoading)
	LoadStateLoaded    LoadStateCode = LoadStateCode(commonpb.LoadState_LoadStateLoaded)
	LoadStateUnloading LoadStateCode = LoadStateCode(commonpb.LoadState_LoadStateNotExist)
	LoadStateNotLoad   LoadStateCode = LoadStateCode(commonpb.LoadState_LoadStateNotLoad)
)

type LoadState struct {
	State    LoadStateCode
	Progress int64
}

```

### Core Architecture Module: `client/internal/rowutil/fields.go`
```
// Licensed to the LF AI & Data foundation under one
// or more contributor license agreements. See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership. The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License. You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Package rowutil owns field mapping shared by SDK row conversion and mutation operands.
package rowutil

import (
	"fmt"
	"reflect"
	"strings"
)

const (
	MilvusTag          = "milvus"
	MilvusSkipTagValue = "-"
	MilvusTagSep       = ";"
	MilvusTagName      = "NAME"
)

type Field struct {
	Value reflect.Value
	// IsPtr applies to struct fields, whose pointers encode nullable columns.
	// Map values keep their original representation for the column converter.
	IsPtr bool
}

// ParseFields maps row values to column names. It preserves writable values for
// primary-key write-back and flattens embedded value structs, as row conversion does.
func ParseFields(value reflect.Value) (map[string]Field, error) {
	for value.Kind() == reflect.Ptr {
		value = value.Elem()
	}
	fields := make(map[string]Field)
	switch value.Kind() {
	case reflect.Map:
		if value.Type().Key().Kind() != reflect.String {
			return nil, fmt.Errorf("unsupported row map key type: %s", value.Type().Key())
		}
		iter := value.MapRange()
		for iter.Next() {
			fields[iter.Key().String()] = Field{Value: iter.Value()}
		}
	case reflect.Struct:
		for i := 0; i < value.NumField(); i++ {
			fieldType := value.Type().Field(i)
			if fieldType.Anonymous && fieldType.Type.Kind() == reflect.Struct {
				embedded, err := ParseFields(value.Field(i))
				if err != nil {
					return nil, err
				}
				for name, field := range embedded {
					if _, exists := fields[name]; exists {
						return nil, fmt.Errorf("column has duplicated name: %s when parsing field: %s", name, fieldType.Name)
					}
					fields[name] = field
				}
				continue
			}
			name := fieldType.Name
			if tag, ok := fieldType.Tag.Lookup(MilvusTag); ok {
				if tag == MilvusSkipTagValue {
					continue
				}
				if taggedName, ok := ParseTagSetting(tag, MilvusTagSep)[MilvusTagName]; ok {
					name = taggedName
				}
			}
			if _, exists := fields[name]; exists {
				return nil, fmt.Errorf("column has duplicated name: %s when parsing field: %s", name, fieldType.Name)
			}
			fieldValue := value.Field(i)
			isPtr := fieldValue.Kind() == reflect.Ptr
			if fieldValue.Kind() == reflect.Array {
				fieldValue = fieldValue.Slice(0, fieldValue.Len())
			}
			fields[name] = Field{Value: fieldValue, IsPtr: isPtr}
		}
	default:
		return nil, fmt.Errorf("unsupported row type: %s", value.Kind())
	}
	return fields, nil
}

// ParseTagSetting parses struct tag attributes, including escaped separators.
func ParseTagSetting(str string, sep string) map[string]string {
	settings := map[string]string{}
	names := strings.Split(str, sep)

	for i := 0; i < len(names); i++ {
		j := i
		if len(names[j]) > 0 {
			for {
				if names[j][len(names[j])-1] == '\\' {
					i++
					names[j] = names[j][0:len(names[j])-1] + sep + names[i]
					names[i] = ""
				} else {
					break
				}
			}
		}

		values := strings.Split(names[j], ":")
		k := strings.TrimSpace(strings.ToUpper(values[0]))

		if len(values) >= 2 {
			settings[k] = strings.Join(values[1:], ":")
		} else if k != "" {
			settings[k] = k
		}
	}

	return settings
}

```

### Core Architecture Module: `client/internal/typeutil/typeutil.go`
```
// Licensed to the LF AI & Data foundation under one
// or more contributor license agreements. See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership. The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License. You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Package typeutil contains the small set of generic and vector helpers used
// by the standalone Go SDK.
package typeutil

import (
	"encoding/binary"
	"math"
	"sync"

	"github.com/x448/float16"

	"github.com/milvus-io/milvus-proto/go-api/v3/schemapb"
)

type ConcurrentMap[K comparable, V any] struct {
	inner sync.Map
}

func NewConcurrentMap[K comparable, V any]() *ConcurrentMap[K, V] {
	return &ConcurrentMap[K, V]{}
}

func (m *ConcurrentMap[K, V]) Get(key K) (V, bool) {
	var zero V
	value, ok := m.inner.Load(key)
	if !ok {
		return zero, false
	}
	return value.(V), true
}

func (m *ConcurrentMap[K, V]) Insert(key K, value V) {
	m.inner.Store(key, value)
}

func (m *ConcurrentMap[K, V]) Remove(key K) {
	m.inner.Delete(key)
}

type Set[T comparable] map[T]struct{}

func NewSet[T comparable](elements ...T) Set[T] {
	set := make(Set[T], len(elements))
	for _, element := range elements {
		set[element] = struct{}{}
	}
	return set
}

func (set Set[T]) Complement(other Set[T]) Set[T] {
	result := NewSet[T]()
	for element := range set {
		if _, ok := other[element]; !ok {
			result[element] = struct{}{}
		}
	}
	return result
}

func Float32ArrayToBytes(values []float32) []byte {
	result := make([]byte, 4*len(values))
	for i, value := range values {
		binary.LittleEndian.PutUint32(result[i*4:], math.Float32bits(value))
	}
	return result
}

func Float32ArrayToFloat16Bytes(values []float32) []byte {
	result := make([]byte, 2*len(values))
	for i, value := range values {
		binary.LittleEndian.PutUint16(result[i*2:], float16.Fromfloat32(value).Bits())
	}
	return result
}

func Float16BytesToFloat32Vector(values []byte) []float32 {
	result := make([]float32, len(values)/2)
	for i := range result {
		result[i] = float16.Frombits(binary.LittleEndian.Uint16(values[i*2:])).Float32()
	}
	return result
}

func Float32ArrayToBFloat16Bytes(values []float32) []byte {
	result := make([]byte, 2*len(values))
	for i, value := range values {
		binary.LittleEndian.PutUint16(result[i*2:], uint16(math.Float32bits(value)>>16))
	}
	return result
}

func BFloat16BytesToFloat32Vector(values []byte) []float32 {
	result := make([]float32, len(values)/2)
	for i := range result {
		result[i] = math.Float32frombits(uint32(binary.LittleEndian.Uint16(values[i*2:])) << 16)
	}
	return result
}

func Int8ArrayToBytes(values []int8) []byte {
	result := make([]byte, len(values))
	for i, value := range values {
		result[i] = byte(value)
	}
	return result
}

func IsVectorType(dataType schemapb.DataType) bool {
	switch dataType {
	case schemapb.DataType_BinaryVector,
		schemapb.DataType_FloatVector,
		schemapb.DataType_Float16Vector,
		schemapb.DataType_BFloat16Vector,
		schemapb.DataType_SparseFloatVector,
		schemapb.DataType_Int8Vector,
		schemapb.DataType_ArrayOfVector:
		return true
	default:
		return false
	}
}

```

### Core Architecture Module: `cmd/components/util.go`
```
package components

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"runtime/pprof"
	"time"

	"github.com/cockroachdb/errors"

	"github.com/milvus-io/milvus/internal/util/sessionutil"
	"github.com/milvus-io/milvus/pkg/v3/mlog"
	"github.com/milvus-io/milvus/pkg/v3/util/conc"
	"github.com/milvus-io/milvus/pkg/v3/util/paramtable"
)

var errStopTimeout = errors.New("stop timeout")

// exitWhenStopTimeout stops a component with timeout and exit progress when timeout.
func exitWhenStopTimeout(stop func() error, timeout time.Duration) error {
	err := stopWithTimeout(stop, timeout)
	if errors.Is(err, errStopTimeout) {
		start := time.Now()
		dumpPprof()
		mlog.Info(context.TODO(), "stop progress timeout, force exit",
			mlog.FieldComponent(paramtable.GetRole()),
			mlog.Duration("cost", time.Since(start)),
			mlog.Err(err))
		sessionutil.RevokeLeasesBeforeExit(time.Second)
		mlog.Cleanup()
		os.Exit(1)
	}
	return err
}

// stopWithTimeout stops a component with timeout.
func stopWithTimeout(stop func() error, timeout time.Duration) error {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	future := conc.Go(func() (struct{}, error) {
		return struct{}{}, stop()
	})
	select {
	case <-future.Inner():
		return errors.Wrap(future.Err(), "failed to stop component")
	case <-ctx.Done():
		return errStopTimeout
	}
}

// profileType defines the structure for each type of profile to be collected
type profileType struct {
	name     string               // Name of the profile type
	filename string               // File path for the profile
	dump     func(*os.File) error // Function to dump the profile data
}

// dumpPprof collects various performance profiles
func dumpPprof() {
	// Get pprof directory from configuration
	pprofDir := paramtable.Get().ProfileCfg.PprofPath.GetValue()

	// Clean existing directory if not empty
	if pprofDir != "" {
		if err := os.RemoveAll(pprofDir); err != nil {
			mlog.Error(context.TODO(), "failed to clean pprof directory",
				mlog.String("path", pprofDir),
				mlog.Err(err))
		}
	}

	// Recreate directory with proper permissions
	if err := os.MkdirAll(pprofDir, 0o755); err != nil {
		mlog.Error(context.TODO(), "failed to create pprof directory",
			mlog.String("path", pprofDir),
			mlog.Err(err))
		return
	}

	// Generate base file path with timestamp
	baseFilePath := filepath.Join(
		pprofDir,
		fmt.Sprintf("%s_pprof_%s",
			paramtable.GetRole(),
			time.Now().Format("20060102_150405"),
		),
	)

	// Define all profile types to be collected
	profiles := []profileType{
		{
			name:     "goroutine",
			filename: baseFilePath + "_goroutine.prof",
			dump: func(f *os.File) error {
				return pprof.Lookup("goroutine").WriteTo(f, 0)
			},
		},
		{
			name:     "heap",
			filename: baseFilePath + "_heap.prof",
			dump: func(f *os.File) error {
				return pprof.WriteHeapProfile(f)
			},
		},
		{
			name:     "block",
			filename: baseFilePath + "_block.prof",
			dump: func(f *os.File) error {
				return pprof.Lookup("block").WriteTo(f, 0)
			},
		},
		{
			name:     "mutex",
			filename: baseFilePath + "_mutex.prof",
			dump: func(f *os.File) error {
				return pprof.Lookup("mutex").WriteTo(f, 0)
			},
		},
	}

	// Create all profile files and store file handles
	files := make(map[string]*os.File)
	for _, p := range profiles {
		f, err := os.Create(p.filename)
		if err != nil {
			mlog.Error(context.TODO(), "could not create profile file",
				mlog.String("profile", p.name),
				mlog.Err(err))
			for filename, f := range files {
				f.Close()
				os.Remove(filename)
			}
			return
		}
		files[p.filename] = f
	}
	// Ensure all files are closed when function returns
	defer func() {
		for _, f := range files {
			f.Close()
		}
	}()

	for _, p := range profiles {
		if err := p.dump(files[p.filename]); err != nil {
			mlog.Error(context.TODO(), "could not write profile",
				mlog.String("profile", p.name),
				mlog.Err(err))
		}
	}
}

```

### Core Architecture Module: `cmd/milvus/util.go`
```
package milvus

import (
	"context"
	"flag"
	"fmt"
	"io"
	"os"
	"path"
	"runtime"
	"time"

	"github.com/gofrs/flock"

	"github.com/milvus-io/milvus/cmd/roles"
	"github.com/milvus-io/milvus/internal/util/sessionutil"
	"github.com/milvus-io/milvus/pkg/v3/mlog"
	"github.com/milvus-io/milvus/pkg/v3/util/etcd"
	"github.com/milvus-io/milvus/pkg/v3/util/hardware"
	"github.com/milvus-io/milvus/pkg/v3/util/typeutil"
)

func makeRuntimeDir(dir string) error {
	perm := os.FileMode(0o755)
	// os.MkdirAll equal to `mkdir -p`
	err := os.MkdirAll(dir, perm)
	if err != nil {
		// err will be raised only when dir exists and dir is a file instead of a directory.
		return fmt.Errorf("create runtime dir %s failed, err: %s", dir, err.Error())
	}

	tmpFile, err := os.CreateTemp(dir, "tmp")
	if err != nil {
		return err
	}
	fileName := tmpFile.Name()
	tmpFile.Close()
	os.Remove(fileName)
	return nil
}

// create runtime folder
func createRuntimeDir(sType string) string {
	var writer io.Writer
	if sType == typeutil.EmbeddedRole {
		writer = io.Discard
	} else {
		writer = os.Stderr
	}
	runtimeDir := "/run/milvus"
	if runtime.GOOS == "windows" {
		runtimeDir = "run"
		if err := makeRuntimeDir(runtimeDir); err != nil {
			fmt.Fprintf(writer, "Create runtime directory at %s failed\n", runtimeDir)
			os.Exit(-1)
		}
	} else {
		if err := makeRuntimeDir(runtimeDir); err != nil {
			fmt.Fprintf(writer, "Set runtime dir at %s failed, set it to /tmp/milvus directory\n", runtimeDir)
			runtimeDir = "/tmp/milvus"
			if err = makeRuntimeDir(runtimeDir); err != nil {
				fmt.Fprintf(writer, "Create runtime directory at %s failed\n", runtimeDir)
				os.Exit(-1)
			}
		}
	}
	return runtimeDir
}

func createPidFile(w io.Writer, filename string, runtimeDir string) (*flock.Flock, error) {
	fileFullName := path.Join(runtimeDir, filename)

	fd, err := os.OpenFile(fileFullName, os.O_CREATE|os.O_RDWR, 0o664)
	if err != nil {
		return nil, fmt.Errorf("file %s is locked, error = %w", filename, err)
	}
	fmt.Fprintln(w, "open pid file:", fileFullName)

	defer fd.Close()

	fd.Truncate(0)
	_, err = fmt.Fprintf(fd, "%d", os.Getpid())
	if err != nil {
		return nil, fmt.Errorf("file %s write fail, error = %w", filename, err)
	}

	lock := flock.New(fileFullName)
	_, err = lock.TryLock()
	if err != nil {
		return nil, fmt.Errorf("file %s is locked, error = %w", filename, err)
	}

	fmt.Fprintln(w, "lock pid file:", fileFullName)
	return lock, nil
}

func getPidFileName(serverType string, alias string) string {
	var filename string
	if len(alias) != 0 {
		filename = fmt.Sprintf("%s-%s.pid", serverType, alias)
	} else {
		filename = serverType + ".pid"
	}
	return filename
}

func closePidFile(fd *os.File) {
	fd.Close()
}

func removePidFile(lock *flock.Flock) {
	filename := lock.Path()
	lock.Close()
	os.Remove(filename)
}

func GetMilvusRoles(args []string, flags *flag.FlagSet) *roles.MilvusRoles {
	alias, enableRootCoord, enableQueryCoord, enableDataCoord, enableQueryNode,
		enableDataNode, enableProxy, enableStreamingNode := formatFlags(args, flags)
	serverType := args[2]
	role := roles.NewMilvusRoles()
	role.Alias = alias
	role.ServerType = serverType

	switch serverType {
	case typeutil.ProxyRole:
		role.EnableProxy = true
	case typeutil.QueryNodeRole:
		role.EnableQueryNode = true
	case typeutil.DataNodeRole:
		role.EnableDataNode = true
	case typeutil.StreamingNodeRole:
		role.EnableStreamingNode = true
	case typeutil.StandaloneRole, typeutil.EmbeddedRole:
		role.EnableMixCoord = true
		role.EnableProxy = true
		role.EnableQueryNode = true
		role.EnableDataNode = true
		role.EnableStreamingNode = true
		role.Local = true
		role.Embedded = serverType == typeutil.EmbeddedRole
		sessionutil.EnableStandaloneLabel()
	case typeutil.MixCoordRole:
		role.EnableMixCoord = true
	case typeutil.MixtureRole:
		role.EnableRootCoord = enableRootCoord
		role.EnableQueryCoord = enableQueryCoord
		role.EnableDataCoord = enableDataCoord
		role.EnableQueryNode = enableQueryNode
		role.EnableDataNode = enableDataNode
		role.EnableProxy = enableProxy
		role.EnableStreamingNode = enableStreamingNode

	case typeutil.CDCRole:
		role.EnableCDC = true
	default:
		fmt.Fprintf(os.Stderr, "Unknown server type = %s\n%s", serverType, getHelp())
		os.Exit(-1)
	}

	return role
}

func formatFlags(args []string, flags *flag.FlagSet) (alias string, enableRootCoord, enableQueryCoord,
	enableDataCoord, enableQueryNode, enableDataNode, enableProxy bool, enableStreamingNode bool,
) {
	flags.StringVar(&alias, "alias", "", "set alias")
	var enableIndexCoord bool
	flags.BoolVar(&enableRootCoord, typeutil.RootCoordRole, false, "enable root coordinator")
	flags.BoolVar(&enableQueryCoord, typeutil.QueryCoordRole, false, "enable query coordinator")
	flags.BoolVar(&enableDataCoord, typeutil.DataCoordRole, false, "enable data coordinator")
	flags.BoolVar(&enableIndexCoord, typeutil.IndexCoordRole, false, "enable index coordinator")
	flags.BoolVar(&enableQueryNode, typeutil.QueryNodeRole, false, "enable query node")
	flags.BoolVar(&enableDataNode, typeutil.DataNodeRole, false, "enable data node")
	flags.BoolVar(&enableProxy, typeutil.ProxyRole, false, "enable proxy node")
	flags.BoolVar(&enableStreamingNode, typeutil.StreamingNodeRole, false, "enable streaming node")

	serverType := args[2]
	if serverType == typeutil.EmbeddedRole {
		flags.SetOutput(io.Discard)
	}
	hardware.InitMaxprocs(serverType, flags)
	if err := flags.Parse(args[3:]); err != nil {
		os.Exit(-1)
	}
	return alias, enableRootCoord, enableQueryCoord, enableDataCoord, enableQueryNode, enableDataNode, enableProxy, enableStreamingNode
}

func getHelp() string {
	return runLine + "\n" + serverTypeLine
}

func CleanSession(metaPath string, etcdEndpoints []string, sessionSuffix []string) error {
	if len(sessionSuffix) == 0 {
		mlog.Warn(context.TODO(), "not found session info , skip to clean sessions")
		return nil
	}

	etcdCli, err := etcd.GetRemoteEtcdClient(etcdEndpoints)
	if err != nil {
		return err
	}
	defer etcdCli.Close()

	ctx, cancel := context.WithTimeout(context.TODO(), 5*time.Second)
	defer cancel()

	targets, err := collectSessionCleanupTargets(ctx, etcdCli, path.Join(metaPath, sessionutil.DefaultServiceRoot), sessionSuffix)
	if err != nil {
		return err
	}
	if err := deleteSessionCleanupTargets(ctx, etcdCli, targets); err != nil {
		return err
	}
	keys := make([]string, 0, len(targets))
	for _, target := range targets {
		keys = append(keys, target.key)
	}
	mlog.Info(ctx, "finished session cleanup", mlog.Strings("keys", keys))
	return nil
}

```

### Core Architecture Module: `cmd/tools/migration/legacy/util.go`
```
package legacy

import (
	"fmt"

	"github.com/milvus-io/milvus/cmd/tools/migration/utils"
)

func BuildCollectionIndexKey210(collectionID, indexID utils.UniqueID) string {
	return fmt.Sprintf("%s/%d/%d", IndexMetaBefore220Prefix, collectionID, indexID)
}

func BuildSegmentIndexKey210(segmentID, indexID utils.UniqueID) string {
	return fmt.Sprintf("%s/%d/%d", SegmentIndexPrefixBefore220, segmentID, indexID)
}

func BuildIndexBuildKey210(buildID utils.UniqueID) string {
	return fmt.Sprintf("%s/%d", IndexBuildPrefixBefore220, buildID)
}

```

### Core Architecture Module: `cmd/tools/migration/utils/util.go`
```
package utils

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/milvus-io/milvus/internal/metastore/kv/rootcoord"
	"github.com/milvus-io/milvus/pkg/v3/util/typeutil"
)

type (
	UniqueID  = typeutil.UniqueID
	Timestamp = typeutil.Timestamp
)

type errNotOfTsKey struct {
	key string
}

func (e errNotOfTsKey) Error() string {
	return fmt.Sprintf("%s is not of snapshot", e.key)
}

func NewErrNotOfTsKey(key string) *errNotOfTsKey {
	return &errNotOfTsKey{key: key}
}

func IsErrNotOfTsKey(err error) bool {
	_, ok := err.(*errNotOfTsKey)
	return ok
}

func SplitBySeparator(s string) (key string, ts Timestamp, err error) {
	got := strings.Split(s, rootcoord.SnapshotsSep)
	if len(got) != 2 {
		return "", 0, NewErrNotOfTsKey(s)
	}
	convertedTs, err := strconv.Atoi(got[1])
	if err != nil {
		return "", 0, fmt.Errorf("%s is not of snapshot", s)
	}
	return got[0], Timestamp(convertedTs), nil
}

func GetFileName(p string) string {
	got := strings.Split(p, "/")
	l := len(got)
	return got[l-1]
}

```

### Core Architecture Module: `internal/agg/aggregate_util.go`
```
package agg

import (
	"encoding/binary"
	"fmt"
	"hash"
	"hash/fnv"
	"math"
	"unsafe"

	"github.com/milvus-io/milvus-proto/go-api/v3/schemapb"
	"github.com/milvus-io/milvus/pkg/v3/util/merr"
	"github.com/milvus-io/milvus/pkg/v3/util/typeutil"
)

func NewFieldAccessor(fieldType schemapb.DataType) (FieldAccessor, error) {
	switch fieldType {
	case schemapb.DataType_Bool:
		return newBoolFieldAccessor(), nil
	case schemapb.DataType_Int8, schemapb.DataType_Int16, schemapb.DataType_Int32:
		return newInt32FieldAccessor(), nil
	case schemapb.DataType_Int64:
		return newInt64FieldAccessor(), nil
	case schemapb.DataType_Timestamptz:
		return newTimestamptzFieldAccessor(), nil
	case schemapb.DataType_VarChar, schemapb.DataType_String:
		return newStringFieldAccessor(), nil
	case schemapb.DataType_Float:
		return newFloat32FieldAccessor(), nil
	case schemapb.DataType_Double:
		return newFloat64FieldAccessor(), nil
	default:
		return nil, merr.WrapErrParameterInvalidMsg("unsupported data type for hasher")
	}
}

type FieldAccessor interface {
	Hash(idx int) uint64
	ValAt(idx int) interface{}
	IsNullAt(idx int) bool
	SetVals(fieldData *schemapb.FieldData)
	RowCount() int
}

// Special hash value for null - using a prime number unlikely to collide
const nullHashValue uint64 = 0x9E3779B97F4A7C15

type Int32FieldAccessor struct {
	vals      []int32
	validData []bool
	hasher    hash.Hash64
	buffer    []byte
}

func (i32Field *Int32FieldAccessor) Hash(idx int) uint64 {
	if idx < 0 || idx >= len(i32Field.vals) {
		panic(fmt.Sprintf("Int32FieldAccessor.Hash: index %d out of range [0,%d)", idx, len(i32Field.vals)))
	}
	if i32Field.IsNullAt(idx) {
		return nullHashValue
	}
	i32Field.hasher.Reset()
	val := i32Field.vals[idx]
	binary.LittleEndian.PutUint32(i32Field.buffer, uint32(val))
	i32Field.hasher.Write(i32Field.buffer)
	ret := i32Field.hasher.Sum64()
	return ret
}

func (i32Field *Int32FieldAccessor) SetVals(fieldData *schemapb.FieldData) {
	i32Field.vals = fieldData.GetScalars().GetIntData().GetData()
	i32Field.validData = typeutil.GetFieldDataValidData(fieldData)
}

func (i32Field *Int32FieldAccessor) RowCount() int {
	return len(i32Field.vals)
}

func (i32Field *Int32FieldAccessor) ValAt(idx int) interface{} {
	return i32Field.vals[idx]
}

func (i32Field *Int32FieldAccessor) IsNullAt(idx int) bool {
	if len(i32Field.validData) == 0 {
		return false // No validity data means all values are valid
	}
	return !i32Field.validData[idx]
}

func newInt32FieldAccessor() FieldAccessor {
	return &Int32FieldAccessor{hasher: fnv.New64a(), buffer: make([]byte, 4)}
}

type Int64FieldAccessor struct {
	vals      []int64
	validData []bool
	hasher    hash.Hash64
	buffer    []byte
}

func (i64Field *Int64FieldAccessor) Hash(idx int) uint64 {
	if idx < 0 || idx >= len(i64Field.vals) {
		panic(fmt.Sprintf("Int64FieldAccessor.Hash: index %d out of range [0,%d)", idx, len(i64Field.vals)))
	}
	if i64Field.IsNullAt(idx) {
		return nullHashValue
	}
	i64Field.hasher.Reset()
	val := i64Field.vals[idx]
	binary.LittleEndian.PutUint64(i64Field.buffer, uint64(val))
	i64Field.hasher.Write(i64Field.buffer)
	return i64Field.hasher.Sum64()
}

func (i64Field *Int64FieldAccessor) SetVals(fieldData *schemapb.FieldData) {
	i64Field.vals = fieldData.GetScalars().GetLongData().GetData()
	i64Field.validData = typeutil.GetFieldDataValidData(fieldData)
}

func (i64Field *Int64FieldAccessor) RowCount() int {
	return len(i64Field.vals)
}

func (i64Field *Int64FieldAccessor) ValAt(idx int) interface{} {
	return i64Field.vals[idx]
}

func (i64Field *Int64FieldAccessor) IsNullAt(idx int) bool {
	if len(i64Field.validData) == 0 {
		return false
	}
	return !i64Field.validData[idx]
}

func newInt64FieldAccessor() FieldAccessor {
	return &Int64FieldAccessor{hasher: fnv.New64a(), buffer: make([]byte, 8)}
}

type TimestamptzFieldAccessor struct {
	vals      []int64
	validData []bool
	hasher    hash.Hash64
	buffer    []byte
}

func (tzField *TimestamptzFieldAccessor) Hash(idx int) uint64 {
	if idx < 0 || idx >= len(tzField.vals) {
		panic(fmt.Sprintf("TimestamptzFieldAccessor.Hash: index %d out of range [0,%d)", idx, len(tzField.vals)))
	}
	if tzField.IsNullAt(idx) {
		return nullHashValue
	}
	tzField.hasher.Reset()
	val := tzField.vals[idx]
	binary.LittleEndian.PutUint64(tzField.buffer, uint64(val))
	tzField.hasher.Write(tzField.buffer)
	return tzField.hasher.Sum64()
}

func (tzField *TimestamptzFieldAccessor) SetVals(fieldData *schemapb.FieldData) {
	tzField.vals = fieldData.GetScalars().GetTimestamptzData().GetData()
	tzField.validData = typeutil.GetFieldDataValidData(fieldData)
}

func (tzField *TimestamptzFieldAccessor) RowCount() int {
	return len(tzField.vals)
}

func (tzField *TimestamptzFieldAccessor) ValAt(idx int) interface{} {
	return tzField.vals[idx]
}

func (tzField *TimestamptzFieldAccessor) IsNullAt(idx int) bool {
	if len(tzField.validData) == 0 {
		return false
	}
	return !tzField.validData[idx]
}

func newTimestamptzFieldAccessor() FieldAccessor {
	return &TimestamptzFieldAccessor{hasher: fnv.New64a(), buffer: make([]byte, 8)}
}

// BoolFieldAccessor
type BoolFieldAccessor struct {
	vals      []bool
	validData []bool
	hasher    hash.Hash64
	buffer    []byte
}

func (boolField *BoolFieldAccessor) Hash(idx int) uint64 {
	if idx < 0 || idx >= len(boolField.vals) {
		panic(fmt.Sprintf("BoolFieldAccessor.Hash: index %d out of range [0,%d)", idx, len(boolField.vals)))
	}
	if boolField.IsNullAt(idx) {
		return nullHashValue
	}
	boolField.hasher.Reset()
	val := boolField.vals[idx]
	if val {
		boolField.buffer[0] = 1
	} else {
		boolField.buffer[0] = 0
	}
	boolField.hasher.Write(boolField.buffer[:1])
	return boolField.hasher.Sum64()
}

func (boolField *BoolFieldAccessor) SetVals(fieldData *schemapb.FieldData) {
	boolField.vals = fieldData.GetScalars().GetBoolData().GetData()
	boolField.validData = typeutil.GetFieldDataValidData(fieldData)
}

func (boolField *BoolFieldAccessor) RowCount() int {
	return len(boolField.vals)
}

func (boolField *BoolFieldAccessor) ValAt(idx int) interface{} {
	return boolField.vals[idx]
}

func (boolField *BoolFieldAccessor) IsNullAt(idx int) bool {
	if len(boolField.validData) == 0 {
		return false
	}
	return !boolField.validData[idx]
}

func newBoolFieldAccessor() FieldAccessor {
	return &BoolFieldAccessor{hasher: fnv.New64a(), buffer: make([]byte, 1)}
}

// Float32FieldAccessor
type Float32FieldAccessor struct {
	vals      []float32
	validData []bool
	hasher    hash.Hash64
	buffer    []byte
}

func (f32FieldAccessor *Float32FieldAccessor) Hash(idx int) uint64 {
	if idx < 0 || idx >= len(f32FieldAccessor.vals) {
		panic(fmt.Sprintf("Float32FieldAccessor.Hash: index %d out of range [0,%d)", idx, len(f32FieldAccessor.vals)))
	}
	if f32FieldAccessor.IsNullAt(idx) {
		return nullHashValue
	}
	f32FieldAccessor.hasher.Reset()
	val := f32FieldAccessor.vals[idx]
	binary.LittleEndian.PutUint32(f32FieldAccessor.buffer, math.Float32bits(val))
	f32FieldAccessor.hasher.Write(f32FieldAccessor.buffer[:4])
	return f32FieldAccessor.hasher.Sum64()
}

func (f32FieldAccessor *Float32FieldAccessor) SetVals(fieldData *schemapb.FieldData) {
	f32FieldAccessor.vals = fieldData.GetScalars().GetFloatData().GetData()
	f32FieldAccessor.validData = typeutil.GetFieldDataValidData(fieldData)
}

func (f32FieldAccessor *Float32FieldAccessor) RowCount() int {
	return len(f32FieldAccessor.vals)
}

func (f32FieldAccessor *Float32FieldAccessor) ValAt(idx int) interface{} {
	return f32FieldAccessor.vals[idx]
}

func (f32FieldAccessor *Float32FieldAccessor) IsNullAt(idx int) bool {
	if len(f32FieldAccessor.validData) == 0 {
		return false
	}
	return !f32FieldAccessor.validData[idx]
}

func newFloat32FieldAccessor() FieldAccessor {
	return &Float32FieldAccessor{hasher: fnv.New64a(), buffer: make([]byte, 4)}
}

// Float64FieldAccessor
type Float64FieldAccessor struct {
	vals      []float64
	validData []bool
	hasher    hash.Hash64
	buffer    []byte
}

func (f64Field *Float64FieldAccessor) Hash(idx int) uint64 {
	if idx < 0 || idx >= len(f64Field.vals) {
		panic(fmt.Sprintf("Float64FieldAccessor.Hash: index %d out of range [0,%d)", idx, len(f64Field.vals)))
	}
	if f64Field.IsNullAt(idx) {
		return nullHashValue
	}
	f64Field.hasher.Reset()
	val := f64Field.vals[idx]
	binary.LittleEndian.PutUint64(f64Field.buffer, math.Float64bits(val))
	f64Field.hasher.Write(f64Field.buffer)
	return f64Field.hasher.Sum64()
}

func (f64Field *Float64FieldAccessor) SetVals(fieldData *schemapb.FieldData) {
	f64Field.vals = fieldData.GetScalars().GetDoubleData().GetData()
	f64Field.validData = typeutil.GetFieldDataValidData(fieldData)
}

func (f64Field *Float64FieldAccessor) RowCount() int {
	return len(f64Field.vals)
}

func (f64Field *Float64FieldAccessor) ValAt(idx int) interface{} {
	return f64Field.vals[idx]
}

func (f64Field *Float64FieldAccessor) IsNullAt(idx int) bool {
	if len(f64Field.validData) == 0 {
		return false
	}
	return !f64Field.validData[idx]
}

func newFloat64FieldAccessor() FieldAccessor {
	return &Float64FieldAccessor{hasher: fnv.New64a(), buffer: make([]byte, 8)}
}

// StringFieldAccessor
type StringFieldAccessor struct {
	vals      []string
	validData []bool
	hasher    hash.Hash64
}

func (stringField *StringFieldAccessor) Hash(idx int) uint64 {
	if idx < 0 || idx >= len(stringField.vals) {
		panic(fmt.Sprintf("StringFieldAccessor.Hash: index %d out of range [0,%d)", idx, len(stringField.vals)))
	}
	if stringField.IsNullAt(idx) {
		return nullHashValue
	}
	stringField.hasher.Reset()
	val := stringField.vals[idx]
	b := unsafe.Slice(unsafe.StringData(val), len(val))
	stringField.hasher.Write(b)
	return stringField.hasher.Sum64()
}

func (stringField *StringFieldAccessor) SetVals(fieldData *schemapb.FieldData) {
	stringField.vals = fieldData.GetScalars().GetStringData().GetData()
	stringField.validData = typeutil.GetFieldDataValidData(fieldData)
}

func (stringField *StringFieldAccessor) RowCount() int {
	return len(stringField.vals)
}

func (stringField *StringFieldAccessor) ValAt
```

### Core Architecture Module: `internal/cdc/util/util.go`
```
package util

import (
	"github.com/milvus-io/milvus/pkg/v3/proto/streamingpb"
	"github.com/milvus-io/milvus/pkg/v3/streaming/util/message"
	"github.com/milvus-io/milvus/pkg/v3/util/paramtable"
	"github.com/milvus-io/milvus/pkg/v3/util/replicateutil"
)

// IsStaleTopologyChange reports whether an AlterReplicateConfig message predates
// the replication task it is being evaluated against.
//
// A replicator does not necessarily start reading at the live position: it
// resumes from the checkpoint reported by the target cluster, which after a
// `restore secondary` is the position the backup was taken at. Replaying from
// there walks over every topology change made since — including ones that
// removed this very edge before it was re-created — and those describe a past
// state, not an instruction for the task replaying them.
//
// The initialized checkpoint carries the time tick of the AlterReplicateConfig
// that created the task, so anything at or before it predates the task itself.
// A zero value means the field is absent (task written by an older version), in
// which case no ordering is enforced and the previous behavior is kept.
func IsStaleTopologyChange(msg message.ImmutableMessage, replicateInfo *streamingpb.ReplicatePChannelMeta) bool {
	initTimeTick := replicateInfo.GetInitializedCheckpoint().GetTimeTick()
	return initTimeTick != 0 && msg.TimeTick() <= initTimeTick
}

// IsReplicationRemovedByAlterReplicateConfigMessage reports whether the given
// AlterReplicateConfig message removes the replication task described by
// replicateInfo, i.e. whether its topology still carries the task's
// `current -> target` edge. A message that predates the task is not an
// instruction for it and never removes it.
func IsReplicationRemovedByAlterReplicateConfigMessage(msg message.ImmutableMessage, replicateInfo *streamingpb.ReplicatePChannelMeta) (replicationRemoved bool) {
	prcMsg := message.MustAsImmutableAlterReplicateConfigMessageV2(msg)
	header := prcMsg.Header()

	// Check ignore field - if true, this message should be ignored
	// This is used for incomplete switchover messages that should be ignored after force promote
	if header.Ignore {
		return false
	}

	if IsStaleTopologyChange(msg, replicateInfo) {
		return false
	}

	replicateConfig := header.ReplicateConfiguration
	currentClusterID := paramtable.Get().CommonCfg.ClusterPrefix.GetValue()
	currentCluster := replicateutil.MustNewConfigHelper(currentClusterID, replicateConfig).GetCurrentCluster()
	_, err := currentCluster.GetTargetChannel(replicateInfo.GetSourceChannelName(),
		replicateInfo.GetTargetCluster().GetClusterId())
	if err != nil {
		// Cannot find the target channel, it means that the `current->target` topology edge is removed,
		// it means that the replication is removed.
		return true
	}
	return false
}

```

### Core Architecture Module: `internal/core/benchmark/BitSlicedIndexBenchmark.cpp`
```
// Licensed to the LF AI & Data foundation under one
// or more contributor license agreements. See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership. The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License. You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Standalone component benchmark for the Int32 bit-sliced index kernel
// (issue #53831). Reports build time, index size and query latency, and
// compares each query with the path Milvus uses for an unindexed int32 field,
// ANDed with the validity bitmap:
// - comparisons and ranges: a SIMD scan of the raw column
//   (TargetBitmap::inplace_compare_val / inplace_within_range_val, as in
//   UnaryExpr / BinaryRangeExpr);
// - IN / NOT IN: the dispatch of TermExpr::ExecVisitorImplForData, which runs
//   the SIMD batch filter (exec::simdFilterChunk, as SimdBatchElement) for
//   lists of at most simdLaneCount<int32_t>() * 8 keys and a per-row
//   ankerl::unordered_dense set probe (as SetElement) for longer lists. The
//   limit depends on the CPU, so the CSV says which one ran.
// Every query result is checked against that baseline before it is timed; a
// mismatch aborts the run. Index and scan are timed in interleaved trials,
// median of 7 each.
//
// Usage: bit_sliced_index_benchmark [--rows=N] [--quick]
//   default rows: 1048576 and 8388608; --quick: 65536 only.
// Output: CSV on stdout, one row per (dataset, query).

#include <algorithm>
#include <chrono>
#include <cstddef>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <functional>
#include <iostream>
#include <limits>
#include <memory>
#include <random>
#include <span>
#include <string>
#include <utility>
#include <vector>

#include "ankerl/unordered_dense.h"
#include "common/Types.h"
#include "common/ValidityView.h"
#include "exec/expression/SimdFilter.h"
#include "index/contracts/build/ScalarBuildInput.h"
#include "index/scalar/bsi/BitSlicedIndex.h"

namespace {

using milvus::TargetBitmap;
using milvus::index::BitSlicedIndexInt32;
using milvus::index::CompareOp;
using milvus::index::ScalarBuildBatch;
using milvus::index::ScalarBuildInput;
using Clock = std::chrono::steady_clock;

volatile size_t sink = 0;

// Mean time per call over one trial of at least 30 ms.
template <typename F>
double
TrialMicros(F& fn) {
    const auto start = Clock::now();
    size_t calls = 0;
    double elapsed_us = 0;
    do {
        sink = sink + fn().size();
        ++calls;
        elapsed_us =
            std::chrono::duration<double, std::micro>(Clock::now() - start)
                .count();
    } while (elapsed_us < 30000);
    return elapsed_us / static_cast<double>(calls);
}

// Times the index and the scan for one query with interleaved trials
// (index, scan, index, scan, ...), so a transient slowdown of the machine
// lands on both sides rather than on one, and returns the median of 7 trials
// per side. Each side is warmed up with one call first.
template <typename A, typename B>
std::pair<double, double>
InterleavedMedianMicros(A index_fn, B scan_fn) {
    sink = sink + index_fn().size() + scan_fn().size();
    std::vector<double> index_us, scan_us;
    for (int t = 0; t < 7; ++t) {
        index_us.push_back(TrialMicros(index_fn));
        scan_us.push_back(TrialMicros(scan_fn));
    }
    std::sort(index_us.begin(), index_us.end());
    std::sort(scan_us.begin(), scan_us.end());
    return {index_us[index_us.size() / 2], scan_us[scan_us.size() / 2]};
}

struct Dataset {
    std::string name;
    std::vector<int32_t> values;
    std::unique_ptr<bool[]> valid;
    size_t rows = 0;
    double null_rate = 0;
};

Dataset
MakeDataset(const std::string& shape,
            size_t rows,
            double null_rate,
            uint64_t seed) {
    Dataset d;
    d.name = shape;
    d.rows = rows;
    d.null_rate = null_rate;
    d.values.resize(rows);
    d.valid = std::make_unique<bool[]>(rows);
    std::mt19937_64 rng(seed);
    std::bernoulli_distribution is_null(null_rate);
    for (size_t i = 0; i < rows; ++i) {
        if (shape == "narrow") {
            // 1000 distinct values -> 10 slices.
            d.values[i] = static_cast<int32_t>(rng() % 1000);
        } else {
            // Full int32 range -> 32 slices.
            d.values[i] = static_cast<int32_t>(static_cast<uint32_t>(rng()));
        }
        d.valid[i] = !is_null(rng);
    }
    return d;
}

TargetBitmap
ValidBitmap(const Dataset& d) {
    TargetBitmap valid(d.rows, false);
    for (size_t i = 0; i < d.rows; ++i) {
        if (d.valid[i]) {
            valid.set(i);
        }
    }
    return valid;
}

// Baselines: the unindexed raw-column paths.
TargetBitmap
ScanCompare(const Dataset& d,
            const TargetBitmap& valid,
            int32_t c,
            milvus::bitset::CompareOpType op) {
    TargetBitmap res(d.rows, false);
    res.inplace_compare_val(d.values.data(), d.rows, c, op);
    res &= valid;
    return res;
}

TargetBitmap
ScanRange(const Dataset& d, const TargetBitmap& valid, int32_t lo, int32_t hi) {
    TargetBitmap res(d.rows, false);
    res.inplace_within_range_val(
        lo, hi, d.values.data(), d.rows, milvus::bitset::RangeType::IncInc);
    res &= valid;
    return res;
}

// IN baseline. TermExpr::ExecVisitorImplForData evaluates a numeric IN list
// with the SIMD batch filter (SimdBatchElement) when it has at most
// simdLaneCount<T>() * 8 keys, and with a per-row hash set probe (SetElement,
// load factor 0.5) otherwise. Milvus sorts and deduplicates the keys and
// builds the set once per plan, so that preparation happens in the
// constructor, outside the timed call.
class InBaseline {
 public:
    explicit InBaseline(std::vector<int32_t> keys) : keys_(std::move(keys)) {
        std::sort(keys_.begin(), keys_.end());
        keys_.erase(std::unique(keys_.begin(), keys_.end()), keys_.end());
        if (!UsesSimd()) {
            set_.max_load_factor(0.5f);
            set_.insert(keys_.begin(), keys_.end());
        }
    }

    static size_t
    SimdKeyLimit() {
        return static_cast<size_t>(milvus::exec::simdLaneCount<int32_t>()) * 8;
    }

    bool
    UsesSimd() const {
        return keys_.size() <= SimdKeyLimit();
    }

    const char*
    Name() const {
        return UsesSimd() ? "simd" : "hash";
    }

    // Sorted and unique, as the Go rewriter hands them to TermExpr.
    const std::vector<int32_t>&
    Keys() const {
        return keys_;
    }

    // Valid rows whose value is in the key list, or not in it when `negate`.
    TargetBitmap
    Run(const Dataset& d, const TargetBitmap& valid, bool negate) const {
        TargetBitmap res(d.rows, false);
        if (UsesSimd()) {
            // ORs the matching rows into a byte-aligned bitmap; a fresh
            // TargetBitmap starts on a word boundary.
            milvus::exec::simdFilterChunk<int32_t>(
                d.values.data(),
                static_cast<int>(d.rows),
                reinterpret_cast<uint8_t*>(res.data()),
                keys_.data(),
                static_cast<int>(keys_.size()));
        } else {
            for (size_t i = 0; i < d.rows; ++i) {
                res[i] = set_.contains(d.values[i]);
            }
        }
        if (negate) {
            res.flip();
        }
        res &= valid;
        return res;
    }

 private:
    std::vector<int32_t> keys_;
    ankerl::unordered_dense::set<int32_t> set_;
};

void
Verify(const std::string& what, TargetBitmap a, TargetBitmap b) {
    if (a.size() != b.size() || !(a == b)) {
        std::cerr << "MISMATCH between index and scan for " << what << '\n';
        std::exit(1);
    }
}

void
RunDataset(const Dataset& d) {
    const ScalarBuildBatch<int32_t> batch{
        std::span<const int32_t>(d.values),
        d.null_rate > 0 ? milvus::ValidityView::FromExpanded(d.valid.get())
                        : milvus::ValidityView{}};
    const ScalarBuildInput<int32_t> input{
        std::span<const ScalarBuildBatch<int32_t>>(&batch, 1)};

    // Build time: median of 5 builds.
    std::vector<double> build_ms;
    for (int t = 0; t < 5; ++t) {
        const auto start = Clock::now();
        BitSlicedIndexInt32 tmp(input);
        build_ms.push_back(
            std::chrono::duration<double, std::milli>(Clock::now() - start)
                .count());
        sink = sink + tmp.Count();
    }
    std::sort(build_ms.begin(), build_ms.end());
    const BitSlicedIndexInt32 index(input);
    const auto valid = ValidBitmap(d);

    // Query constants from percentiles of the valid values.
    std::vector<int32_t> sorted;
    for (size_t i = 0; i < d.rows; ++i) {
        if (d.valid[i]) {
            sorted.push_back(d.values[i]);
        }
    }
    std::sort(sorted.begin(), sorted.end());
    if (sorted.empty()) {
        std::cerr << "skipping dataset " << d.name << " with " << d.rows
                  << " rows: no valid values\n";
        return;
    }
    const auto pct = [&](double p) {
        return sorted[std::min(sorted.size() - 1,
                               static_cast<size_t>(p * sorted.size()))];
    };
    // n keys spread evenly over the value distribution (scattered runs).
    const auto spread_keys = [&](int n) {
        std::vector<int32_t> keys;
        for (int i = 0; i < n; ++i) {
            keys.push_back(pct((i + 0.5) / n));
        }
        return keys;
    };
    const InBaseline in8(spread_keys(8)), in32(spread_keys(32)),
        in128(spread_keys(128)), in512(spread_keys(512));

    struc
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #56021** (2026-11-25): **CI trust-path probe (transient, will be closed)**
  *Symptoms*: Authorized CI trust-boundary check: this PR adds a single marker file and is closed immediately after observing which base-context workflow jobs (if any) execute it. No secret values are printed.
  **Post-Mortem & Fix Analysis**:
  > Welcome @le-schlo! It looks like this is your first PR to milvus-io/milvus 🎉
  > [APPROVALNOTIFIER] This PR is **NOT APPROVED**  This pull-request has been approved by: To complete the [pull request process](https://git.k8s.io/community/contributors/guide/owners.md#the-code-review-process), please assign **zhuwenxing** after the PR has been reviewed. You can assign the PR to them by writing `/assign @zhuwenxing` in a comment when ready.  The full list of commands accepted by this bot can be found [here](https://go.k8s.io/bot-commands?repo=milvus-io%2Fmilvus).  <details open> Needs approval from an approver in each of these files:  - **[OWNERS](https://github.com/milvus-io/milvus/blob/master/OWNERS)**  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":["zhuwenxing"]} -->

- **Issue #55991** (2026-11-25): **enhance: reclaim empty PK version index storage**
  *Symptoms*: When a vchannel goes idle after a burst of writes, TTL eviction removes the PK version entries but leaves the hash tables and expiration queue allocated. With many previously written collections, that storage remains reachable after the live-entry byte budget drops to zero.  Release the backing storage under the index mutex when the last entry expires. Preserve the forgotten-write boundary for CAS validation and allocate a map on the next admitted PK write.  Related: #52374  design doc: docs/design-docs/design_docs/20260601-partial-update-optimistic-lock-design.md  ## Validation  - The regression fails on the old implementation and passes on the new one. It covers both Int64 and VarChar PKs, stale snapshot rejection, and conflict detection after a later write recreates the index. - Isolated index unit tests pass with the race detector and 95.1% statement coverage on Go 1.26.11 (darwin/arm64). The full interceptor package was blocked by a local C++ dependency mismatch. - In a local workload of 4,096 vchannels with 1,000 distinct PKs each, expiring all entries reduced post-GC retained heap from 177.5 MiB to 0.73 MiB. Active update median was 27.1 µs before and 27.5 µs after. Evicting and refilling a 1,000-PK index took 183 µs before and 227 µs after. 
  **Post-Mortem & Fix Analysis**:
  > [ci-v2-notice] Notice: New ci-v2 system is enabled for this PR.  To rerun ci-v2 checks, comment with: - /ci-rerun-code-check  // for ci-v2/code-check - /ci-rerun-code-check-macos  // for Code Checker MacOS (GitHub Actions) - /ci-rerun-build  // for ci-v2/build - /ci-rerun-build-all  // for ci-v2/build-all (multi-arch builds) - /ci-rerun-buildenv  // for ci-v2/build-env (build milvus-env builder images; update .env after the new tag is ready) - /ci-rerun-ut-integration  // for ci-v2/ut-integration, will rerun ci-v2/build - /ci-rerun-ut-go  // for ci-v2/ut-go, will rerun ci-v2/build - /ci-rerun-ut-cpp  // for ci-v2/ut-cpp - /ci-rerun-ut  // for all ci-v2/ut-integration, ci-v2/ut-go, ci-v2/ut-cpp, will rerun ci-v2/build - /ci-rerun-e2e-default  // for ci-v2/e2e-default - /ci-rerun-e2e-pulsar-wp  // for ci-v2/e2e-pulsar-wp (GCP branch-equivalent Pulsar + Woodpecker Python E2E) - /ci-rerun-e2e-amd  // for ci-v2/e2e-amd (e2e pool dispatcher) - /ci-rerun-e2e-dist-wp  // for ci-v2/e2e-dist-wp 
  > /lgtm /approve

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

### Incident Patch 1: `ae3d2586` (2026-11-25)
**Commit Message**: fix: Wake QueryView recovery waiters before WAL shutdown (#55391)

WAL close waits for active operations before closing the QueryView
handler, but a query waiting for view recovery can hold the operation
reference that close is waiting for. Stop new acquisitions and wake
recovery waiters with the existing on-shutdown ViewError before the
lifetime wait. Keep resources for already acquired leases until the
later handoff cleanup.

Propagate the stopped state to shards created during shutdown, preserve
cancellation and requested-version semantics, and cover recovery waiting
through the real SN query/search service entrypoints with injected
resource backends.

Related issue: #40451

Validation: focused SN handler, WAL adaptor, ViewError and streaming
interceptor tests passed with `-tags dynamic,test -gcflags="all=-N -l"`
on macOS arm64 using an existing native SDK. Tests cover
ready/unrecoverable/down/dropped/canceled/deadline/shutdown paths, MVCC
waiting, and the existing retryable wire projection. The recovery-wait
and query/search RPC regressions also passed under `-race`. The
production close ordering was traced from lifetime stop through
acquisition shutdown, operation drain and ha

**File**: `docs/design-docs/design_docs/qviews/query/query_plan.md` (modified, +5/-0)
```diff
@@ -9,6 +9,11 @@ locates the local shard by vchannel and returns its real identity in the plan.
 Matching UpRecovering state waits for local recovery; missing or unusable views
 return the existing View errors.
 
+Waiting is local to SN; the Coord-facing `UpRecovering` to `Up` projection is
+unchanged. WAL shutdown stops query acquisition before draining its in-flight
+operations: waiters wake and new acquisitions fail with an on-shutdown error.
+QueryView resources are released only after those operations finish.
+
 Planning first acquires a serving View with the request's exact schema, then
 fixes one MVCC and waits for the runtime's Growing and Transform data visibility.
 It resolves the View's loaded partitions and optimizes against its exact read
```

**File**: `internal/streamingnode/server/wal/adaptor/query_shutdown_test.go` (added, +257/-0)
```diff
@@ -0,0 +1,257 @@
+package adaptor
+
+import (
+	"context"
+	"sync"
+	"sync/atomic"
+	"testing"
+	"time"
+
+	"github.com/bytedance/mockey"
+	"github.com/stretchr/testify/require"
+
+	"github.com/milvus-io/milvus/internal/metastore"
+	"github.com/milvus-io/milvus/internal/metastore/kv/streamingnode"
+	"github.com/milvus-io/milvus/internal/mocks/streamingnode/server/wal/interceptors/shard/mock_shards"
+	"github.com/milvus-io/milvus/internal/streamingnode/server/resource"
+	"github.com/milvus-io/milvus/internal/streamingnode/server/wal/snview"
+	"github.com/milvus-io/milvus/internal/views/qviews"
+	"github.com/milvus-io/milvus/internal/views/viewerror"
+	worknodehandler "github.com/milvus-io/milvus/internal/views/worknode/handler"
+	"github.com/milvus-io/milvus/pkg/v3/kv"
+	"github.com/milvus-io/milvus/pkg/v3/kv/predicates"
+	"github.com/milvus-io/milvus/pkg/v3/proto/internalpb"
+	"github.com/milvus-io/milvus/pkg/v3/proto/viewpb"
+	"github.com/milvus-io/milvus/pkg/v3/streaming/util/message"
+	"github.com/milvus-io/milvus/pkg/v3/streaming/walimpls/impls/walimplstest"
+	"github.com/milvus-io/milvus/pkg/v3/util/merr"
+	"github.com/milvus-io/milvus/pkg/v3/util/paramtable"
+)
+
+type queryShutdownTestResMgr struct {
+	mu        sync.Mutex
+	acquired  map[qviews.QueryViewKey]snview.AcquireResource
+	onRelease func(snview.ReleaseResource)
+}
+
+func newQueryShutdownTestResMgr(onRelease func(snview.ReleaseResource)) *queryShutdownTestResMgr {
+	return &queryShutdownTestResMgr{
+		acquired:  make(map[qviews.QueryViewKey]snview.AcquireResource),
+		onRelease: onRelease,
+	}
+}
+
+func (m *queryShutdownTestResMgr) Acquire(req snview.AcquireResource) {
+	m.mu.Lock()
+	m.acquired[req.Key] = req
+	m.mu.Unlock()
+}
+
+func (m *queryShutdownTestResMgr) Release(req snview.ReleaseResource) {
+	if m.onRelease != nil {
+		m.onRelease(req)
+	}
+	go req.OnDropped()
+}
+
+func (m *queryShutdownTestResMgr) getAcquired(key qviews.QueryViewKey) (snview.AcquireResource, bool) {
+	m.mu.Lock()
+	defer m.mu.Unlock()
+	req, ok := m.acquired[key]
+	return req, ok
+}
+
+type failingQueryViewMetaKV struct {
+	kv.MetaKv
+	entered chan struct{}
+	once    sync.Once
+}
+
+func (f *failingQueryViewMetaKV) MultiSaveAndRemove(
+	ctx context.Context,
+	_ map[string]string,
+	_ []string,
+	_ ...predicates.Predicate,
+) error {
+	f.once.Do(func() {
+		close(f.entered)
+	})
+	if err := ctx.Err(); err != nil {
+		return err
+	}
+	return merr.WrapErrIoFailedReason("etcd unavailable")
+}
+
+func newQueryShutdownTestView(vchannel string, replicaID int64, state viewpb.QueryViewState) *viewpb.QueryViewOfShard {
+	return &viewpb.QueryViewOfShard{
+		Meta: &viewpb.QueryViewMeta{
+			CollectionId: 1,
+			ReplicaId:    replicaID,
+			Vchannel:     vchannel,
+			State:        state,
+			Version: &viewpb.QueryViewVersion{
+				DataVersion:  &viewpb.DataVersion{StreamingVersion: 1},
+				QueryVersion: 1,
+			},
+		},
+		StreamingNode: &viewpb.QueryViewOfStreamingNode{},
+	}
+}
+
+func newQueryShutdownTestWAL(
+	t *testing.T,
+	catalog metastore.StreamingNodeCataLog,
+	resMgr snview.StreamingNodeResourceManager,
+	views []*viewpb.QueryViewOfShard,
+) *walAdaptorImpl {
+	t.Helper()
+	paramtable.Init()
+	resource.InitForTest(t)
+
+	walImpls := newFirstTimeTickWALImpls(func(context.Context, message.MutableMessage) (message.MessageID, error) {
+		return walimplstest.NewTestMessageID(1), nil
+	})
+	roWAL := adaptImplsToROWAL(walImpls, func() {})
+	param, err := buildInterceptorParams(context.Background(), walImpls, nil)
+	require.NoError(t, err)
+	shardManager := mock_shards.NewMockShardManager(t)
+	shardManager.EXPECT().Close().Return()
+	param.ShardManager = shardManager
+
+	w := adaptImplsToRWWAL(roWAL, nil, param)
+	w.queryViewHandler = snview.RecoverPChannelSNQueryViewHandler(
+		roWAL.availableCtx,
+		walImpls.Channel().Name,
+		catalog,
+		resMgr,
+		views,
+	)
+	return w
+}
+
+func TestWALCloseWakesRecoveryWaitersBeforeResourceRelease(t *testing.T) {
+	mockey.PatchConvey("close wakes recovery waiters before lifetime drain and resource release", t, func() {
+		var acquireExited atomic.Bool
+		var released atomic.Int32
+		resMgr := newQueryShutdownTestResMgr(func(snview.ReleaseResource) {
+			require.True(t, acquireExited.Load(), "query plan waiter must exit before handoff releases view resources")
+			released.Add(1)
+		})
+		recovered := newQueryShutdownTestView("first-time-tick-test_1v0", 1, viewpb.QueryViewState_QueryViewStateUp)
+		w := newQueryShutdownTestWAL(t, nil, resMgr, []*viewpb.QueryViewOfShard{recovered})
+
+		entered := make(chan struct{})
+		var enterOnce sync.Once
+		var orig func(*snview.SNQueryViewHandler, context.Context, qviews.ShardID, int32) (*snview.QueryViewLease, error)
+		mockey.Mock((*snview.SNQueryViewHandler).AcquireUpViewAtSchema).Origin(&orig).To(
+			func(h *snview.SNQueryViewHandler, ctx context.Context, shardID qviews.ShardID, schema int32) (*snview.QueryViewLease, error) {
+				enterOnce.Do(func() { close(entered) })
+				lease, er
```

**File**: `internal/streamingnode/server/wal/adaptor/wal_adaptor.go` (modified, +5/-0)
```diff
@@ -403,6 +403,11 @@ func (w *walAdaptorImpl) Close() {
 	// begin to close the wal.
 	w.lifetime.SetState(typeutil.LifetimeStateStopped)
 	w.forceCancelAfterGracefulTimeout()
+	if w.queryViewHandler != nil {
+		// Recovery waiters hold a lifetime reference. Wake them before waiting
+		// for in-flight operations, without releasing their query resources yet.
+		w.queryViewHandler.StopQueryAcquisition()
+	}
 	w.lifetime.Wait()
 	if w.queryViewHandler != nil {
 		w.queryViewHandler.CloseForHandoff()
```

**File**: `internal/streamingnode/server/wal/snview/handler.go` (modified, +7/-0)
```diff
@@ -78,6 +78,8 @@ type SNQueryViewHandler struct {
 	resMgr         StreamingNodeResourceManager
 	localOptimizer optimizer.LocalOptimizer
 	leaseDuration  time.Duration
+	// queriesStopped fails new acquisitions once WAL shutdown starts.
+	queriesStopped bool
 }
 
 // recoverSNQueryViewHandler reconstructs the handler from persisted views
@@ -233,6 +235,7 @@ func (h *SNQueryViewHandler) getOrCreateShard(shardID qviews.ShardID) *snShardVi
 			onEmpty:       h.makeOnEmpty(shardID),
 			leaseDuration: h.leaseDuration,
 		}
+		shard.queriesStopped = h.queriesStopped
 		h.shards[shardID] = shard
 	}
 	return shard
@@ -273,6 +276,10 @@ func (h *SNQueryViewHandler) acquireUpViewForSchema(ctx context.Context, shardID
 			return nil, err
 		}
 		h.mu.Lock()
+		if h.queriesStopped {
+			h.mu.Unlock()
+			return nil, viewerror.NewOnShutdownError("query view handler is shutting down")
+		}
 		var candidates []*snShardView
 		if shard := h.shards[shardID]; shard != nil {
 			candidates = append(candidates, shard)
```

**File**: `internal/streamingnode/server/wal/snview/handler_test.go` (modified, +15/-0)
```diff
@@ -1003,3 +1003,18 @@ func TestSNHandler_Recover_AcquireCallbackFlow(t *testing.T) {
 func (m *mockResourceManager) QueryRuntime(qviews.QueryViewKey) (QueryRuntime, bool) {
 	return m.runtime, m.runtime != nil
 }
+
+func newFullSNViewWithState(version int64, state viewpb.QueryViewState, qnNodeIDs ...int64) qviews.QueryViewAtWorkNode {
+	meta := buildHandlerTestMeta(version)
+	meta.State = state
+	queryNodes := make([]*viewpb.QueryViewOfQueryNode, 0, len(qnNodeIDs))
+	for _, nodeID := range qnNodeIDs {
+		queryNodes = append(queryNodes, &viewpb.QueryViewOfQueryNode{
+			NodeId: nodeID,
+			Partitions: []*viewpb.QueryViewOfPartition{
+				{PartitionId: 10, SegmentIds: []int64{nodeID * 100}},
+			},
+		})
+	}
+	return qviews.NewFullQueryViewAtStreamingNode(meta, &viewpb.QueryViewOfStreamingNode{}, queryNodes)
+}
```

**File**: `internal/streamingnode/server/wal/snview/query_lease.go` (modified, +29/-0)
```diff
@@ -26,6 +26,10 @@ func (h *SNQueryViewHandler) acquireUpView(ctx context.Context, shardID qviews.S
 	default:
 	}
 	h.mu.Lock()
+	if h.queriesStopped {
+		h.mu.Unlock()
+		return nil, viewerror.NewOnShutdownError("query view handler is shutting down")
+	}
 	shard := h.shards[shardID]
 	h.mu.Unlock()
 	if shard == nil {
@@ -34,12 +38,37 @@ func (h *SNQueryViewHandler) acquireUpView(ctx context.Context, shardID qviews.S
 	return shard.acquireUpView(ctx, version, withTopology)
 }
 
+// StopQueryAcquisition wakes recovery waiters without releasing resources used
+// by in-flight queries. WAL shutdown must call this before waiting for queries
+// to finish; CloseForHandoff performs resource cleanup after that wait.
+func (h *SNQueryViewHandler) StopQueryAcquisition() {
+	h.mu.Lock()
+	if h.queriesStopped {
+		h.mu.Unlock()
+		return
+	}
+	h.queriesStopped = true
+	shards := make([]*snShardView, 0, len(h.shards))
+	for _, shard := range h.shards {
+		shards = append(shards, shard)
+	}
+	h.mu.Unlock()
+	// Never nest shard locks under h.mu: onEmpty takes h.mu under a shard lock.
+	for _, shard := range shards {
+		shard.stopQueryAcquisition()
+	}
+}
+
 func (s *snShardView) acquireUpView(ctx context.Context, version qviews.QueryViewVersion, withTopology bool) (*QueryViewLease, error) {
 	for {
 		if err := ctx.Err(); err != nil {
 			return nil, err
 		}
 		s.mu.Lock()
+		if s.queriesStopped {
+			s.mu.Unlock()
+			return nil, viewerror.NewOnShutdownError("query view %s is shutting down", s.shardID.String())
+		}
 		entry, exists := s.views[version]
 		if !exists {
 			s.mu.Unlock()
```

**File**: `internal/streamingnode/server/wal/snview/query_recovery_rpc_test.go` (added, +124/-0)
```diff
@@ -0,0 +1,124 @@
+//go:build test && dynamic
+
+package snview
+
+import (
+	"context"
+	"testing"
+	"time"
+
+	"github.com/stretchr/testify/require"
+
+	"github.com/milvus-io/milvus/internal/views/viewerror"
+	"github.com/milvus-io/milvus/internal/views/viewquery"
+	"github.com/milvus-io/milvus/pkg/v3/proto/internalpb"
+	"github.com/milvus-io/milvus/pkg/v3/proto/viewpb"
+)
+
+type recoveryWaitRuntime struct {
+	mockQueryRuntime
+	entered chan struct{}
+	visible chan struct{}
+}
+
+func (r *recoveryWaitRuntime) WaitMVCCVisible(ctx context.Context, growing, transforming uint64) error {
+	_ = r.mockQueryRuntime.WaitMVCCVisible(ctx, growing, transforming)
+	close(r.entered)
+	select {
+	case <-ctx.Done():
+		return ctx.Err()
+	case <-r.visible:
+		return nil
+	}
+}
+
+func TestSNHandler_Phase2RecoveryRPC(t *testing.T) {
+	for _, operation := range []string{"search", "query"} {
+		for _, event := range []string{"ready", "unrecoverable", "canceled", "shutdown"} {
+			t.Run(operation+"/"+event, func(t *testing.T) {
+				mockResolvePartitions(t)
+				view := newFullSNViewWithState(1, viewpb.QueryViewState_QueryViewStateUp, 101)
+				mgr := newMockResourceManager()
+				runtime := &recoveryWaitRuntime{entered: make(chan struct{}), visible: make(chan struct{})}
+				mgr.runtime = runtime
+				h := recoverSNQueryViewHandler(context.Background(), testPChannel, newMockCatalog(), mgr, []*viewpb.QueryViewOfShard{view.IntoProto()})
+				recovery, ok := mgr.getAcquired(view.QueryViewKey())
+				require.True(t, ok)
+				// Empty growing results exercise the real RPC server and task
+				// provider without needing native segment execution.
+				server := viewquery.NewServer(h, nil)
+				ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
+				defer cancel()
+				result := make(chan error, 1)
+				go func() {
+					id := view.ShardID().IntoProto()
+					version := view.Version().IntoProto()
+					mvcc := &viewpb.QueryPlanMVCC{GrowingTimetick: 11, TransformingTimetick: 10}
+					var err error
+					if operation == "search" {
+						_, err = server.SearchOnView(ctx, &viewpb.SearchOnViewRequest{
+							ShardId: id, Version: version, Mvcc: mvcc,
+							LegacyReq: &internalpb.SearchRequest{CollectionID: testCollectionID},
+						})
+					} else {
+						_, err = server.QueryOnView(ctx, &viewpb.QueryOnViewRequest{
+							ShardId: id, Version: version, Mvcc: mvcc,
+							LegacyReq: &internalpb.RetrieveRequest{CollectionID: testCollectionID},
+						})
+					}
+					result <- err
+				}()
+				waitForRecoveryWaiter(t, h)
+				select {
+				case <-runtime.entered:
+					t.Fatal("runtime used before recovery completed")
+				default:
+				}
+				switch event {
+				case "ready":
+					recovery.OnReady()
+					select {
+					case <-runtime.entered:
+					case <-ctx.Done():
+						t.Fatal("RPC did not resume after recovery")
+					}
+					require.EqualValues(t, 11, runtime.growingTimetick)
+					require.EqualValues(t, 10, runtime.transformingTimetick)
+					select {
+					case err := <-result:
+						t.Fatalf("RPC skipped MVCC visibility wait: %v", err)
+					default:
+					}
+					close(runtime.visible)
+				case "unrecoverable":
+					recovery.OnUnrecoverable()
+				case "canceled":
+					cancel()
+				case "shutdown":
+					h.StopQueryAcquisition()
+				}
+				select {
+				case err := <-result:
+					switch event {
+					case "ready":
+						require.NoError(t, err)
+					case "canceled":
+						require.ErrorIs(t, err, context.Canceled)
+					default:
+						// Check that the real RPC projection preserves retryability.
+						wire := viewerror.ConvertViewError(operation, viewerror.NewGRPCStatusFromError(err).Err())
+						viewErr := viewerror.AsViewError(wire)
+						require.True(t, viewErr.IsRetryable(), "%v", wire)
+						if event == "shutdown" {
+							require.True(t, viewErr.IsOnShutdown())
+						} else {
+							require.True(t, viewErr.IsViewInvalidated())
+						}
+					}
+				case <-time.After(5 * time.Second):
+					t.Fatal("RPC did not finish")
+				}
+			})
+		}
+	}
+}
```

**File**: `internal/streamingnode/server/wal/snview/query_recovery_wait_test.go` (added, +282/-0)
```diff
@@ -0,0 +1,282 @@
+//go:build test && dynamic
+
+package snview
+
+import (
+	"context"
+	"testing"
+	"time"
+
+	"github.com/bytedance/mockey"
+	"github.com/stretchr/testify/require"
+	"google.golang.org/protobuf/proto"
+
+	"github.com/milvus-io/milvus/internal/views/qviews"
+	"github.com/milvus-io/milvus/internal/views/viewerror"
+	"github.com/milvus-io/milvus/internal/views/worknode/handler"
+	"github.com/milvus-io/milvus/pkg/v3/proto/viewpb"
+)
+
+type queryLeaseResult struct {
+	lease *QueryViewLease
+	err   error
+}
+
+// waitForRecoveryWaiter returns once a query has parked on a recovering shard
+// of testVChannel: waiters take the shard's recovery notification under the
+// same lock that inspects the state, so a registered channel means "waiting".
+func waitForRecoveryWaiter(t *testing.T, h *SNQueryViewHandler) {
+	t.Helper()
+	require.Eventually(t, func() bool {
+		h.mu.Lock()
+		shards := make([]*snShardView, 0, len(h.shards))
+		for id, shard := range h.shards {
+			if id.VChannel == testVChannel {
+				shards = append(shards, shard)
+			}
+		}
+		h.mu.Unlock()
+		for _, shard := range shards {
+			shard.mu.Lock()
+			waiting := shard.recoveryChanged != nil
+			shard.mu.Unlock()
+			if waiting {
+				return true
+			}
+		}
+		return false
+	}, 5*time.Second, time.Millisecond)
+}
+
+func startRecoveryQuery(ctx context.Context, h *SNQueryViewHandler, id qviews.ShardID, version *qviews.QueryViewVersion) <-chan queryLeaseResult {
+	result := make(chan queryLeaseResult, 1)
+	go func() {
+		var lease *QueryViewLease
+		var err error
+		if version == nil {
+			lease, err = h.AcquireLatestUpView(ctx, id)
+		} else {
+			lease, err = h.AcquireUpView(ctx, id, *version)
+		}
+		result <- queryLeaseResult{lease, err}
+	}()
+	return result
+}
+
+func receiveRecoveryQuery(t *testing.T, result <-chan queryLeaseResult) queryLeaseResult {
+	t.Helper()
+	select {
+	case got := <-result:
+		if got.lease != nil {
+			t.Cleanup(got.lease.Release)
+		}
+		return got
+	case <-time.After(5 * time.Second):
+		t.Fatal("query did not leave recovery wait")
+		return queryLeaseResult{}
+	}
+}
+
+func TestSNHandler_RecoveryWaitExits(t *testing.T) {
+	for _, exact := range []bool{false, true} {
+		mode := "latest"
+		if exact {
+			mode = "exact"
+		}
+		for _, event := range []string{"unrecoverable", "down", "dropped", "canceled", "deadline", "shutdown"} {
+			t.Run(mode+"/"+event, func(t *testing.T) {
+				view := newFullSNViewWithState(1, viewpb.QueryViewState_QueryViewStateUp, 101)
+				mgr := newMockResourceManager()
+				h := recoverSNQueryViewHandler(context.Background(), testPChannel, newMockCatalog(), mgr, []*viewpb.QueryViewOfShard{view.IntoProto()})
+				recovery, ok := mgr.getAcquired(view.QueryViewKey())
+				require.True(t, ok)
+				timeout := 5 * time.Second
+				if event == "deadline" {
+					timeout = 100 * time.Millisecond
+				}
+				ctx, cancel := context.WithTimeout(context.Background(), timeout)
+				defer cancel()
+				var version *qviews.QueryViewVersion
+				if exact {
+					v := view.Version()
+					version = &v
+				}
+				result := startRecoveryQuery(ctx, h, view.ShardID(), version)
+				waitForRecoveryWaiter(t, h)
+				switch event {
+				case "unrecoverable":
+					recovery.OnUnrecoverable()
+				case "down":
+					h.ApplyViews([]handler.ApplyView{{View: newSNViewWithState(1, viewpb.QueryViewState_QueryViewStateDown)}})
+				case "dropped":
+					h.ApplyViews([]handler.ApplyView{{View: newSNViewWithState(1, viewpb.QueryViewState_QueryViewStateDropped)}})
+				case "canceled":
+					cancel()
+				case "shutdown":
+					h.StopQueryAcquisition()
+					h.StopQueryAcquisition()
+				}
+				got := receiveRecoveryQuery(t, result)
+				require.Nil(t, got.lease)
+				switch event {
+				case "canceled":
+					require.ErrorIs(t, got.err, context.Canceled)
+				case "deadline":
+					require.ErrorIs(t, got.err, context.DeadlineExceeded)
+				case "shutdown":
+					require.True(t, viewerror.AsViewError(got.err).IsOnShutdown(), "%v", got.err)
+				default:
+					viewErr := viewerror.AsViewError(got.err)
+					require.True(t, viewErr.IsRetryable(), "%v", got.err)
+					if exact {
+						require.True(t, viewErr.IsViewInvalidated())
+					} else {
+						require.True(t, viewErr.IsViewNotFound())
+					}
+					// A delayed completion cannot resurrect a failed or retired view.
+					recovery.OnReady()
+					lease, err := h.AcquireUpView(ctx, view.ShardID(), view.Version())
+					require.Nil(t, lease)
+					require.True(t, viewerror.AsViewError(err).IsViewInvalidated())
+				}
+			})
+		}
+	}
+}
+
+func TestSNHandler_RecoveryWaitPinsRequestedVersion(t *testing.T) {
+	old := newFullSNViewWithState(1, viewpb.QueryViewState_QueryViewStateUp, 101)
+	newer := newFullSNViewWithState(2, viewpb.QueryViewState_QueryViewStateUp, 102)
+	mgr := newMockResourceManager()
+	h := recoverSNQueryViewHandler(context.Background(), testPChannel, newMockCatalog(), mgr, []*viewpb.QueryViewOfShard{old.IntoProto(), newer.IntoProto()})
+	ol
```

---

### Incident Patch 2: `16ffc35f` (2026-11-25)
**Commit Message**: fix: align JSON stats existence with raw empty-container semantics (#55594)

Fixes #55290

JSON stats previously treated shredded arrays such as `[]`, `[null]`,
and recursively empty containers as existing because their column
entries were valid. Evaluate their BSON contents with the existing
recursive emptiness check so `EXISTS`, `IS NULL`, and `IS NOT NULL`
agree with raw JSON evaluation. Scalar columns retain their
validity-based check.

For parent paths, combine shared and shredded matches with OR. For
example, in `{"parent":{"a":[1],"empty":null}}`, the empty shared
remainder must not overwrite the existence established by the shredded
array.

Resolve scalar descendants first. If all rows are resolved, skip
remaining arrays and shared data. Otherwise, use the accumulated result
bitmap to skip fully resolved physical array cells before pinning either
payload or validity. Mixed cells retain the per-row guard against
redundant BSON parsing. Ordinary shredding scans retain their existing
validity handling.

### Validation

- Latest update: `be07357945`. Its source snapshot passed **148 tests
across 6 suites** through Dev CLI cloud C++ validation, covering JSON
stats routing, empty

**File**: `internal/core/src/exec/expression/ExistsExpr.cpp` (modified, +68/-2)
```diff
@@ -41,6 +41,36 @@
 namespace milvus {
 namespace exec {
 
+namespace {
+
+// Determine whether each unresolved BSON array contains a nonempty value for
+// EXISTS. Resolved rows in mixed scan batches need no BSON parsing.
+void
+EvaluateShreddedArrayExists(const std::string_view* values,
+                            ValidityView valid,
+                            size_t size,
+                            TargetBitmapView result,
+                            TargetBitmapView /*valid_result*/,
+                            TargetBitmapView resolved) {
+    // The executor slices result for each scan batch; resolved spans the segment.
+    const auto resolved_batch = resolved.view(result.offset(), size);
+    for (size_t i = 0; i < size; ++i) {
+        // Rows already matched by another descendant need no BSON parsing.
+        if (resolved_batch[i] || (valid && !valid[i])) {
+            result[i] = false;
+            continue;
+        }
+        // A valid BSON array can still be recursively empty ([], [null],
+        // [[]], ...). Match Json::exist and the shared BSON evaluator.
+        BsonView bson(reinterpret_cast<const uint8_t*>(values[i].data()),
+                      values[i].size());
+        auto array = bson.ParseAsArrayAtOffset(0);
+        result[i] = array.has_value() && !BsonView::IsBsonValueEmpty(*array);
+    }
+}
+
+}  // namespace
+
 void
 PhyExistsFilterExpr::DetermineExecPath() {
     // JsonStats is the fallback applied by EnsureExecPathDetermined() when no
@@ -241,17 +271,49 @@ PhyExistsFilterExpr::EvalJsonExistsForDataSegmentByStats() {
                         });
                     auto shredding_fields =
                         index->GetShreddingFieldsWithPrefix(pointer);
+                    // Resolve cheap scalar validity first, regardless of field
+                    // name order, before reading any array payloads.
                     for (const auto& field : shredding_fields) {
+                        if (index->GetShreddingJsonType(field) ==
+                            index::JSONType::ARRAY) {
+                            continue;
+                        }
+                        if (res_view.all()) {
+                            break;
+                        }
                         TargetBitmap temp_valid(active_count_, true);
                         TargetBitmapView temp_valid_view(temp_valid);
                         index->ExecutorForGettingValid(
                             op_ctx_, field, temp_valid_view);
                         res_view |= temp_valid_view;
                     }
+
+                    // Only read arrays if scalar validity left unresolved rows.
+                    for (const auto& field : shredding_fields) {
+                        if (index->GetShreddingJsonType(field) !=
+                            index::JSONType::ARRAY) {
+                            continue;
+                        }
+                        if (res_view.all()) {
+                            break;
+                        }
+                        TargetBitmap array_exists(active_count_, false);
+                        // Fully resolved cells need neither payload nor
+                        // validity. Mixed cells still skip resolved rows in
+                        // the evaluator; its validity output is unused.
+                        index->ExecutorForUnresolvedShreddingData<
+                            std::string_view>(op_ctx_,
+                                              field,
+                                              EvaluateShreddedArrayExists,
+                                              TargetBitmapView(array_exists),
+                                              TargetBitmapView(array_exists),
+                                              res_view);
+                        res_view |= TargetBitmapView(array_exists);
+                    }
                 }
 
                 // process shared data
-                {
+                if (!res_view.all()) {
                     milvus::ScopedTimer timer(
                         "exists_json_stats_shared_data", [this](double us) {
                             json_stats_shared_latency_us_ += us;
@@ -261,7 +323,11 @@ PhyExistsFilterExpr::EvalJsonExistsForDataSegmentByStats() {
                         bson_index_,
                         pointer,
                         [&](BsonView bson, uint32_t row_id, uint32_t offset) {
-                            res_view[row_id] = !bson.IsBsonValueEmpty(offset);
+                            // A parent can have children in both layouts. An
+                            // empty shared child must not erase a shredded hit.
+                            if (!bson.IsBsonValueEmpty(offset)) {
+                                res_view[row_id] = true;
+                            }
                         });
                 }
 
```

**File**: `internal/core/src/exec/expression/JsonContainsByStatsTest.cpp` (modified, +424/-2)
```diff
@@ -38,7 +38,9 @@
 #include "common/protobuf_utils.h"
 #include "exec/expression/BinaryRangeExpr.h"
 #include "exec/expression/ExprBatchTestUtils.h"
+#include "exec/expression/ExprCache.h"
 #include "exec/expression/ExprIndexIntegrationTestUtils.h"
+#include "exec/expression/ExistsExpr.h"
 #include "exec/expression/JsonContainsExpr.h"
 #include "index/Meta.h"
 #include "exec/expression/TermExpr.h"
@@ -80,6 +82,16 @@ using namespace milvus::index;
 
 class JsonStatsProjectionTestAccessor {
  public:
+    static std::shared_ptr<ChunkedColumnInterface>&
+    ShreddingColumn(JsonKeyStats& stats, const std::string& field_name) {
+        return stats.shredding_columns_.at(field_name);
+    }
+
+    static std::shared_ptr<ChunkedColumnInterface>&
+    SharedColumn(JsonKeyStats& stats) {
+        return stats.shared_column_;
+    }
+
     static bool
     IsInMultiFieldColumnGroup(const JsonKeyStats& stats,
                               const std::string& field_name) {
@@ -90,6 +102,70 @@ class JsonStatsProjectionTestAccessor {
 
 namespace {
 
+struct DisableExprCache {
+    bool was_enabled = exec::ExprResCacheManager::IsEnabled();
+    DisableExprCache() {
+        exec::ExprResCacheManager::SetEnabled(false);
+    }
+    ~DisableExprCache() {
+        exec::ExprResCacheManager::SetEnabled(was_enabled);
+    }
+};
+
+// Keep the real stats reads, but count entry into the expensive scan paths.
+class CountingExistsColumn : public ChunkedVariableColumn<std::string> {
+ public:
+    CountingExistsColumn(std::shared_ptr<cachinglayer::CacheSlot<Chunk>> slot,
+                         const FieldMeta& meta,
+                         std::shared_ptr<ChunkedColumnInterface> source)
+        : ChunkedVariableColumn<std::string>(std::move(slot), meta),
+          source_(std::move(source)) {
+    }
+
+    ScanResult
+    Scan(OpContext* ctx, const ScanOptions& options) const override {
+        ++array_scans;
+        return source_->Scan(ctx, options);
+    }
+
+    void
+    BulkRawBsonAt(OpContext* ctx,
+                  std::function<void(BsonView, uint32_t, uint32_t)> fn,
+                  const uint32_t* rows,
+                  const uint32_t* offsets,
+                  int64_t count) const override {
+        ++shared_reads;
+        source_->BulkRawBsonAt(ctx, std::move(fn), rows, offsets, count);
+    }
+
+    mutable int64_t array_scans = 0;
+    mutable int64_t shared_reads = 0;
+
+ private:
+    std::shared_ptr<ChunkedColumnInterface> source_;
+};
+
+// Use the production scan cursor and record every payload/validity pin.
+class CountingExistsArrayColumn : public ChunkedVariableColumn<std::string> {
+ public:
+    using ChunkedVariableColumn<std::string>::ChunkedVariableColumn;
+
+    PinWrapper<Chunk*>
+    GetChunk(OpContext* ctx, int64_t chunk_id) const override {
+        pinned_chunks.push_back(chunk_id);
+        return ChunkedVariableColumn<std::string>::GetChunk(ctx, chunk_id);
+    }
+
+    ScanResult
+    Scan(OpContext* ctx, const ScanOptions& options) const override {
+        ++array_scans;
+        return ChunkedVariableColumn<std::string>::Scan(ctx, options);
+    }
+
+    mutable std::vector<int64_t> pinned_chunks;
+    mutable int64_t array_scans = 0;
+};
+
 bool
 IsValidAt(const std::vector<uint8_t>& valid_data, size_t i) {
     return ((valid_data[i >> 3] >> (i & 0x07)) & 1) != 0;
@@ -228,7 +304,8 @@ BuildJsonStatsIndex(const std::vector<std::string>& json_strings,
                     int64_t field_id,
                     int64_t build_id,
                     int64_t version_id,
-                    const std::vector<uint8_t>* valid_data = nullptr) {
+                    const std::vector<uint8_t>* valid_data = nullptr,
+                    int64_t max_shredding_columns = 1024) {
     std::vector<milvus::Json> data;
     data.reserve(json_strings.size());
     for (const auto& s : json_strings) {
@@ -284,7 +361,8 @@ BuildJsonStatsIndex(const std::vector<std::string>& json_strings,
     Config build_config;
     build_config[INSERT_FILES_KEY] = std::vector<std::string>{log_path};
 
-    auto builder = std::make_shared<JsonKeyStats>(ctx, false);
+    auto builder =
+        std::make_shared<JsonKeyStats>(ctx, false, max_shredding_columns);
     builder->Build(build_config);
 
     const auto create_index_result = builder->Upload(build_config);
@@ -2054,3 +2132,347 @@ TEST(JsonStatsExecPathTest, TypedArrayIndexWinsOverJsonStatsForContains) {
                   exec::ExprExecPath::JsonStats);
     }
 }
+
+class JsonStatsExistsOrderTest : public ::testing::TestWithParam<bool> {};
+
+TEST_P(JsonStatsExistsOrderTest, ResolvedParentSkipsRemainingColumns) {
+    DisableExprCache disable_cache;
+    milvus::test::ExprBatchSizeGuard batch_size(7);
+    constexpr int64_t n =
+        17;  // Exercise a partial bitmap word and final batch.
+    const bool array_first = GetParam();
+    const std::string scalar_key = array_first ? "z" : "a";
+    enum LastRow { Scalar, ComplementaryScalars, Array
```

**File**: `internal/core/src/segcore/json_stats/JsonKeyStats.h` (modified, +59/-8)
```diff
@@ -267,6 +267,63 @@ class JsonKeyStats {
         TargetBitmapView res,
         TargetBitmapView valid_res,
         ValTypes... values) {
+        milvus::detail::ColumnFilterPtr filter;
+        if (skip_func) {
+            filter = std::make_shared<milvus::detail::ColumnFilter>(
+                milvus::detail::ColumnFilter::MetricsSource::
+                    PreloadedStatistics,
+                [&](int64_t cell_id) {
+                    return skip_func(skip_index_, path, cell_id);
+                });
+        }
+        return ScanShreddingData<T>(
+            op_ctx, path, func, filter, res, valid_res, values...);
+    }
+
+    // EXISTS has already resolved the rows set in resolved. Skip their entire
+    // physical cells before pinning payload or validity; the callback still
+    // receives resolved to avoid parsing those rows in mixed cells.
+    template <typename T, typename FUNC>
+    int64_t
+    ExecutorForUnresolvedShreddingData(milvus::OpContext* op_ctx,
+                                       const std::string& path,
+                                       FUNC func,
+                                       TargetBitmapView res,
+                                       TargetBitmapView valid_res,
+                                       TargetBitmapView resolved) {
+        const auto it = shredding_columns_.find(path);
+        if (it == shredding_columns_.end()) {
+            return 0;
+        }
+        const auto& column = it->second;
+        column->Prepare(op_ctx);
+        AssertInfo(resolved.size() >= column->NumRows(),
+                   "Resolved bitmap is shorter than shredding column {}",
+                   path);
+        auto filter = std::make_shared<milvus::detail::ColumnFilter>(
+            milvus::detail::ColumnFilter::MetricsSource::PreloadedStatistics,
+            [column, resolved](int64_t cell_id) {
+                const auto start = column->GetNumRowsUntilChunk(cell_id);
+                const auto size = column->chunk_row_nums(cell_id);
+                return resolved.view(start, size).all();
+            },
+            // These rows already have their final result. Their array-column
+            // validity must not trigger a payload pin or clear that result.
+            /*skipped_validity_required=*/false);
+        return ScanShreddingData<T>(
+            op_ctx, path, func, filter, res, valid_res, resolved);
+    }
+
+ private:
+    template <typename T, typename FUNC, typename... ValTypes>
+    int64_t
+    ScanShreddingData(milvus::OpContext* op_ctx,
+                      const std::string& path,
+                      FUNC& func,
+                      milvus::detail::ColumnFilterPtr filter,
+                      TargetBitmapView res,
+                      TargetBitmapView valid_res,
+                      ValTypes... values) {
         int64_t processed_size = 0;
         // if path is not in shredding_columns_, return 0
         if (shredding_columns_.find(path) == shredding_columns_.end()) {
@@ -284,14 +341,7 @@ class JsonKeyStats {
                 : ChunkedColumnInterface::ScanPinPolicy::ResultOwned;
         auto options = ChunkedColumnInterface::ScanOptions::ForData(
             0, TargetTypeOf<T>(), pin_policy);
-        if (skip_func) {
-            options.filter = std::make_shared<milvus::detail::ColumnFilter>(
-                milvus::detail::ColumnFilter::MetricsSource::
-                    PreloadedStatistics,
-                [&](int64_t cell_id) {
-                    return skip_func(skip_index_, path, cell_id);
-                });
-        }
+        options.filter = std::move(filter);
         auto cursor = column->Scan(op_ctx, options);
         AssertInfo(cursor != nullptr,
                    "Shredding column {} does not support data scan",
@@ -344,6 +394,7 @@ class JsonKeyStats {
         return processed_size;
     }
 
+ public:
     std::set<std::string>
     GetShreddingFields(const std::string& pointer) {
         std::set<std::string> fields;
```

**File**: `internal/core/src/segcore/json_stats/JsonKeyStatsScanTest.cpp` (modified, +77/-0)
```diff
@@ -16,6 +16,7 @@
 
 #include <gtest/gtest.h>
 
+#include <algorithm>
 #include <cstring>
 #include <numeric>
 #include <optional>
@@ -374,6 +375,82 @@ TEST_P(JsonKeyStatsScanTest, SkipUsesPhysicalCellOnceAndPreservesIncomingBits) {
     }
 }
 
+TEST_P(JsonKeyStatsScanTest, ResolvedCellsNeverPinPayloadOrValidity) {
+    const int64_t first_rows = DEFAULT_EXEC_EVAL_EXPR_BATCH_SIZE + 3;
+    const int64_t rows = first_rows + 5 + 7;
+    for (bool nullable : {false, true}) {
+        for (int mode : {0, 1, 2, 3}) {
+            SCOPED_TRACE(testing::Message()
+                         << "nullable=" << nullable << " mode=" << mode);
+            auto fixture = MakeColumn({first_rows, 5, 7},
+                                      std::vector<std::string>(rows, "payload"),
+                                      DataType::STRING,
+                                      nullable);
+            auto stats = MakeStats(fixture.column);
+            // 0: none resolved, 1: all resolved, 2/3: a single unresolved
+            // valid/invalid row in the middle cell. Both end cells can skip.
+            TargetBitmap resolved(rows, mode != 0);
+            if (mode >= 2) {
+                int64_t unresolved = first_rows;
+                while (ValidRow(unresolved) != (mode == 2)) {
+                    ++unresolved;
+                }
+                ASSERT_LT(unresolved, first_rows + 5);
+                resolved[unresolved] = false;
+            }
+            auto original = resolved.clone();
+            TargetBitmap result(rows, false), valid(rows, true);
+            int64_t parsed_rows = 0;
+            auto predicate = [&](const std::string_view* data,
+                                 ValidityView validity,
+                                 int64_t size,
+                                 TargetBitmapView res,
+                                 TargetBitmapView valid_res,
+                                 TargetBitmapView resolved_rows) {
+                auto resolved_batch = resolved_rows.view(res.offset(), size);
+                for (int64_t i = 0; i < size; ++i) {
+                    if (resolved_batch[i]) {
+                        continue;
+                    }
+                    valid_res[i] = !validity || validity[i];
+                    if (!valid_res[i]) {
+                        continue;
+                    }
+                    ++parsed_rows;
+                    res[i] = data[i] == "payload";
+                }
+            };
+            fixture.trace->fail_pin = mode == 1;
+            EXPECT_EQ(
+                stats->ExecutorForUnresolvedShreddingData<std::string_view>(
+                    nullptr,
+                    "test_path",
+                    predicate,
+                    TargetBitmapView(result),
+                    TargetBitmapView(valid),
+                    TargetBitmapView(resolved)),
+                rows);
+            const auto& pins = fixture.trace->pinned_chunks;
+            if (mode == 1) {
+                EXPECT_TRUE(pins.empty());
+            } else if (mode >= 2) {
+                EXPECT_EQ(pins, (std::vector<int64_t>{1}));
+                EXPECT_EQ(parsed_rows, mode == 2 || !nullable ? 1 : 0);
+            } else {
+                EXPECT_NE(std::find(pins.begin(), pins.end(), 0), pins.end());
+                EXPECT_NE(std::find(pins.begin(), pins.end(), 1), pins.end());
+                EXPECT_NE(std::find(pins.begin(), pins.end(), 2), pins.end());
+            }
+            for (int64_t i = 0; i < rows; ++i) {
+                EXPECT_EQ(resolved[i], original[i]);
+                EXPECT_EQ(result[i],
+                          !resolved[i] && (!nullable || ValidRow(i)));
+                EXPECT_EQ(valid[i], resolved[i] || !nullable || ValidRow(i));
+            }
+        }
+    }
+}
+
 template <typename T>
 void
 CheckFixedWidth(DataType type,
```

---

### Incident Patch 3: `cd5310ef` (2026-11-25)
**Commit Message**: fix: honor Talon routing for broker-backed external tables (#55904)

Allow external tables that use a credential broker to follow the
operator's Talon read settings. The external-table opt-in defaults to
false. When enabled, AWS broker target roles, supported broker IAM
modes, and Azure broker targets can use the configured Talon coordinator
and read mode.

The previous policy in #54986 forced every broker-backed external
filesystem to origin. The storage revision already pinned on master
supports per-request broker descriptors. Aliyun and Tencent target-role
reads continue to use native storage because the pinned Talon S3
provider accepts AWS target roles only. Local filesystems also use
native storage. Endpoint allowlisting and Azure alias normalization run
before routing.

Related to #53875 and #54985. Corresponding 3.0 change in #55901.

**Verification**

- Exercised the existing broker policy, Azure legacy alias/query,
endpoint normalization and non-broker routing tests in a focused native
executable. The two updated broker cases failed against the original
master implementation. All four cases passed with this change.
- Covered AWS, Aliyun and Tencent with both IAM and target

**File**: `internal/core/src/storage/loon_ffi/util.cpp` (modified, +9/-10)
```diff
@@ -1283,9 +1283,14 @@ InjectExternalSpecProperties(
         ARROW_RETURN_NOT_OK(validate_token_lifetime("GCP Bearer credentials"));
     }
 
-    // External Tables share the filesystem tuning, with an independently
-    // configured mode. Local external filesystems never use Talon.
-    const bool external_is_local = value("storage_type") == "local";
+    // Talon's S3 broker accepts target roles only for AWS. Preserve native
+    // routing for Aliyun and Tencent target roles.
+    const bool native_target_role =
+        !broker_endpoint.empty() &&
+        (spec_cloud_provider == "aliyun" || spec_cloud_provider == "tencent") &&
+        !use_iam;
+    const bool origin_only =
+        native_target_role || value("storage_type") == "local";
     for (const auto* key : {PROPERTY_FS_TALON_MODE,
                             PROPERTY_FS_TALON_OPEN_ONLY,
                             PROPERTY_FS_TALON_SMALL_READ_THRESHOLD,
@@ -1298,13 +1303,7 @@ InjectExternalSpecProperties(
                                      : key;
         const auto value = PropertyValueAsString(properties, source_key);
         const auto extfs_key = ExternalFsPropertyKey(extfs_prefix, key);
-        // Keep Broker credential acquisition and refresh on the origin filesystem.
-        if (!broker_endpoint.empty()) {
-            properties.erase(extfs_key);
-            if (std::string_view(key) == PROPERTY_FS_TALON_MODE) {
-                properties[extfs_key] = std::string("0");
-            }
-        } else if (external_is_local) {
+        if (origin_only) {
             properties.erase(extfs_key);
         } else if (value.has_value()) {
             properties[extfs_key] = *value;
```

**File**: `internal/core/unittest/test_external_take.cpp` (modified, +28/-11)
```diff
@@ -33,6 +33,8 @@
 #include <memory>
 #include <optional>
 #include <string>
+#include <string_view>
+#include <utility>
 #include <vector>
 
 #include "common/ChunkWriter.h"
@@ -4030,7 +4032,7 @@ TEST(InjectExtfsAllowlist, AzureLegacyBrokerQuery) {
     EXPECT_EQ(std::get<std::string>(props.at("extfs.42.credential_endpoint")),
               endpoint);
     EXPECT_EQ(props.count("extfs.42.azure_credential_endpoint"), 0u);
-    EXPECT_EQ(std::get<std::string>(props.at("extfs.42.talon.mode")), "0");
+    EXPECT_EQ(props.count("extfs.42.talon.mode"), 0u);
     EXPECT_ANY_THROW(inject(endpoint + "&extra=1"));
     EXPECT_ANY_THROW(
         inject("https://broker.example.com/v1/credentials/"
@@ -4748,7 +4750,12 @@ TEST(InjectExtfsAllowlist, BrokerIamPolicyAndLegacyAliases) {
     EXPECT_FALSE(
         InitCredentialBrokerPolicy(std::string(R"(["file:///tmp/broker"])"))
             .ok());
-    for (const auto& cloud : {"aws", "aliyun", "tencent"}) {
+    for (const auto& [cloud, iam] : {std::pair{"aws", true},
+                                     {"aliyun", true},
+                                     {"tencent", true},
+                                     {"aws", false},
+                                     {"aliyun", false},
+                                     {"tencent", false}}) {
         for (const auto* format : {"parquet", "milvus-table"}) {
             for (uint32_t mode : {0u, 1u, 2u}) {
                 milvus_storage::api::Properties props;
@@ -4761,14 +4768,17 @@ TEST(InjectExtfsAllowlist, BrokerIamPolicyAndLegacyAliases) {
                                    {"extfs",
                                     {{"cloud_provider", cloud},
                                      {"region", "us-west-2"},
-                                     {"use_iam", "true"},
+                                     {"use_iam", iam ? "true" : "false"},
                                      {"credential_endpoint", endpoint}}}};
+                if (!iam) {
+                    spec["extfs"]["role_arn"] = "target-role";
+                }
                 InjectExternalSpecProperties(
                     props, 42, "s3://bucket/path", spec.dump());
                 EXPECT_EQ(std::get<std::string>(
                               props.at("extfs.42.credential_endpoint")),
                           endpoint);
-                EXPECT_EQ(props.count("extfs.42.role_arn"), 0u);
+                EXPECT_EQ(props.count("extfs.42.role_arn"), iam ? 0u : 1u);
                 auto address =
                     std::get<std::string>(props.at("extfs.42.address"));
                 auto scheme_end = address.find("://");
@@ -4779,13 +4789,16 @@ TEST(InjectExtfsAllowlist, BrokerIamPolicyAndLegacyAliases) {
                         props),
                     "s3://" + address + "/bucket/path");
                 ASSERT_TRUE(config.ok()) << config.status();
-                EXPECT_TRUE(config->use_iam);
+                EXPECT_EQ(config->use_iam, iam);
                 EXPECT_TRUE(config->IsAwsCredentialBrokerEnabled());
                 EXPECT_EQ(config->credential_endpoint, endpoint);
                 EXPECT_FALSE(config->s3_use_crt);
-                EXPECT_EQ(config->talon_mode,
-                          milvus_storage::TalonMode::Disabled);
-                EXPECT_EQ(props.count("extfs.42.talon.coordinator"), 0u);
+                const bool supports_talon =
+                    iam || std::string_view(cloud) == "aws";
+                EXPECT_EQ(static_cast<uint32_t>(config->talon_mode),
+                          supports_talon ? mode : 0u);
+                EXPECT_EQ(config->talon_coordinator,
+                          supports_talon ? "talon:1234" : "");
                 spec["extfs"]["credential_endpoint"] = endpoint + "/other";
                 EXPECT_ANY_THROW(InjectExternalSpecProperties(
                     props, 42, "s3://bucket/path", spec.dump()));
@@ -4809,8 +4822,9 @@ TEST(InjectExtfsAllowlist, BrokerIamPolicyAndLegacyAliases) {
     InjectExternalSpecProperties(
         props, 42, "azure://core.windows.net/container/path", spec.dump());
     EXPECT_EQ(props.count("extfs.42.azure_credential_endpoint"), 0u);
-    EXPECT_EQ(std::get<std::string>(props.at("extfs.42.talon.mode")), "0");
-    EXPECT_EQ(props.count("extfs.42.talon.coordinator"), 0u);
+    EXPECT_EQ(std::get<std::string>(props.at("extfs.42.talon.mode")), "2");
+    EXPECT_EQ(std::get<std::string>(props.at("extfs.42.talon.coordinator")),
+              "talon:1234");
     EXPECT_EQ(std::get<std::string>(props.at("extfs.42.credential_endpoint")),
               endpoint);
     spec["extfs"]["azure_credential_endpoint"] = endpoint + "/other";
@@ -5425,6 +5439,7 @@ TEST(InjectExtfsAllowlist, S3BrokerTargetRoleAcrossClouds) {
             }
             milvus_storage::api::Properties props;
             props["milvus.talon.external_mode"] = uint32_t{2};
+            props[PROPERTY_FS_TALON_COORDINATOR] = std::string("talon:1234");
             InjectExter
```

#### Recent Merged Pull Requests:
- **PR #56021** (closed): CI trust-path probe (transient, will be closed) (@le-schlo)
- **PR #55991** (2026-11-25): enhance: reclaim empty PK version index storage (@sunby)
- **PR #55990** (closed): enhance: [3.0] enable configurable S3 CRT for index builds (@marcelo-cjl)
- **PR #55987** (closed): enhance: enable S3 CRT by default for index builds (@marcelo-cjl)
- **PR #55982** (closed): fix: Publish grouped imports with their commit-time Transform cursors (@sijie-ni-0214)
- **PR #55969** (2026-11-25): enhance: [cp3.0] Gate Import V3 default enablement on cluster version (@xaxys)

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

## X. Wake QueryView recovery waiters before WAL shutdown

**RULE**:
When implementing operations in `docs/design-docs/design_docs/qviews/query/query_plan.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in milvus-io/milvus. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `ae3d2586`: Wake QueryView recovery waiters before WAL shutdown. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/design-docs/design_docs/qviews/query/query_plan.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
Waiting is local to SN; the Coord-facing `UpRecovering` to `Up` projection is
unchanged. WAL shutdown stops query acquisition before draining its in-flight
operations: waiters wake and new acquisitions fail with an on-shutdown error.
QueryView resources are released only after those operations finish.

```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `ae3d2586` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
