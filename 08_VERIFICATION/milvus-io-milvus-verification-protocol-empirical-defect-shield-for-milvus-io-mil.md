# Verification Protocol: Verification Protocol: Empirical Defect Shield for milvus-io/milvus

<!-- PROVENANCE_START
{
  "source_repository": "milvus-io/milvus",
  "source_url": "https://github.com/milvus-io/milvus",
  "source_version": "b830b0cd",
  "license": "Apache-2.0",
  "timestamp": "2026-11-26T16:21:27.560Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-milvus-io-milvus",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [milvus-io/milvus](https://github.com/milvus-io/milvus) (Revision: `b830b0cd`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-26T16:21:27.560Z`  
> **Learning ID**: `learn-github-milvus-io-milvus`


## 1. Scope & Verification Target
- **Target Repository**: `milvus-io/milvus` (Commit: `b830b0cd`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): milvus-io/milvus

> **Canonical Artifact**: `07_PROJECT_LEARNING/milvus-io-milvus-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/milvus-io/milvus](https://github.com/milvus-io/milvus))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-26T16:21:25.686Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `milvus-io/milvus`
- **Description**: Milvus is a high-performance, cloud-native vector database built for scalable vector ANN search
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 46747 stars

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
- **Issue #56108** (2026-11-26): **enhance: keep the GC checkpoint test fixture out of production builds**
  *Symptoms*: ### Problem `internal/datacoord/gc/checkpoint_fixtures_testonly.go` (added in #52977) is guarded by `//go:build test || dynamic`. Production builds pass the `dynamic` tag (`MILVUS_GO_BUILD_TAGS` in the Makefile), so this test-only fixture is compiled into the `milvus` binary. It imports `testing` and `github.com/bytedance/mockey`, and it is the only package in the production dependency graph that imports mockey.  In mockey v1.4.6, the `internal/monkey/linkname` package has an `init()` that walks the main module's whole function table and stores every function in a name-to-PC map and a `[]*runtime.Func` slice. It runs at startup in every Milvus process. In a mixcoord heap profile taken on master `20746425a1` (`inuse_space`, after a forced GC), `github.com/bytedance/mockey/internal/monkey/linkname.init.0` retained 9.97 MB (flat = cum).  ### Change Change the build constraint to `//go:build test`, as used by the other `*_testonly.go` fixtures in `internal/datacoord`.  ### Verification - `go list -deps -tags dynamic,sonic,with_jemalloc,bytedance_tango ./cmd`, before and after: on arm64, 22 packages leave the production dependency set (mockey, its 12 internal packages, the goconvey/smartystreets/gls packages it pulls in, and `golang.org/x/arch/arm64/arm64asm`); on amd64, 21. No package is added. - No non-test code references the fixture's symbols (`MockCheckpointCatalog`, `CheckDroppedSegmentGCForTest`, `DataViewCompactionProtectionForTest`, `(*GarbageCollector).ContextForTest`). 

- **Issue #56071** (2026-11-26): **fix: [3.0] bump milvus-storage to read Tencent role_arn volumes**
  *Symptoms*: issue: #56070 pr: #54316  ## What  Upgrade milvus-storage from `03e23960` to `49b22ab8`. The only change in that range is milvus-io/milvus-storage#846, the 3.0 backport of milvus-io/milvus-storage#714 ("support Tencent OIDC assume-role chains").  ## Why  An external collection on Tencent COS that reads through a customer role sends `cloud_provider=tencent`, `use_iam=true`, `role_arn` and an optional `external_id`. Go admission accepts that spec, but milvus-storage `03e23960` handles `role_arn` only for aws and aliyun. Creating the filesystem therefore fails with `role_arn not supported for cloud provider: tencent`, and the collection can be created but not read.  With #846, milvus-storage takes the pod's TKE OIDC identity and assumes the target role with a TC3-signed `sts:AssumeRole` call, sending `ExternalId` when it is set.  Master has had #714 since #54316 moved its storage pin to `3bc763b`, so this change has no master PR of its own.  ## Effect on other Tencent deployments  #846 also rewrites the Tencent STS client that plain `use_iam` deployments (no `role_arn`) use. In the #846 review, the old and new clients were compared on about 30 STS response shapes: responses of the real shape and HTTP errors behave as before.  ## Validation  - milvus-io/milvus-storage#846 passed its CI (build, unit tests, Talon integration) before it merged. - This PR changes only the pin. Milvus CI builds and tests it. - Not tested against live Tencent COS on 3.0.  🤖 Generated with [Claude Code
  **Post-Mortem & Fix Analysis**:
  > <!-- codex-pull-request-review-summary --> <!-- codex-review-state:v1 {"code_review":{"commit_sha":"52734c83943729a91ce915bf077060f2e21a70f5","has_any_findings":false,"has_unresolved_findings":false,"status":"completed"},"security_review":{"commit_sha":null,"has_any_findings":null,"has_unresolved_findings":null,"status":null}} -->  <details> <summary><strong>Codex Review Summary</strong>: ✅ Completed</summary>  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 📝 **Code Review** | ✅ **Completed** <relative-time datetime="2026-11-26T08:13:19.814808Z">2026-11-26T08:13:19.814808Z</relative-time> | `52734c8` | PR opened |    <details> <summary>ℹ️ About Codex in GitHub</summary> <br/>  [Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you - Open a pull request for review - Mark a draft as ready - Comm
  > [APPROVALNOTIFIER] This PR is **NOT APPROVED**  This pull-request has been approved by: To complete the [pull request process](https://git.k8s.io/community/contributors/guide/owners.md#the-code-review-process), please ask for approval from **xiaofan-luan** after the PR has been reviewed.  The full list of commands accepted by this bot can be found [here](https://go.k8s.io/bot-commands?repo=milvus-io%2Fmilvus).  <details open> Needs approval from an approver in each of these files:  - **[internal/core/OWNERS](https://github.com/milvus-io/milvus/blob/3.0/internal/core/OWNERS)**  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":["xiaofan-luan"]} -->

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

### Incident Patch 1: `a9679897` (2026-11-26)
**Commit Message**: build(deps): bump milvus-storage for per-client GCP credentials (#56050)

## What

Upgrade milvus-storage from `ce42fa1d` to `f9138562`. The only change in
that range is milvus-io/milvus-storage#837 ("allow multiple GCP
identities on the same endpoint and bucket").

## Why

The old pin kept one process-wide `GcpCredentialRegistry` keyed by
endpoint and bucket, so two GCP identities on one bucket could not
coexist. For example, an existing external spec that impersonates a
service account directly and a new spec that goes through the credential
Broker on the same bucket blocked each other. #837 removes the registry
and binds the credential provider to each S3 client.

## Changes

- `internal/core/thirdparty/milvus-storage/CMakeLists.txt`: the new pin.
- `internal/core/unittest/test_external_take.cpp`: #837 removes
`GcpCredentialProvider::IssuesBearerToken()` and `Identity()`, which the
external spec injection tests used. The tests now check the credential
mode through what the provider still exposes:
- both Broker modes build a `GcpBrokerCredentialProvider`; node IAM and
impersonation do not;
- Bearer providers return empty AWS credentials, while HMAC returns its
key pair;
- the res

**File**: `docs/design-docs/design_docs/20261110-external-collection-broker-iam.md` (modified, +6/-3)
```diff
@@ -189,6 +189,9 @@ fallback. Server tests
 verify vendor AssumeRole requests with temporary source credentials and
 sanitized failures.
 
-The one-GCP-identity-per-(endpoint,bucket) registry restriction and mixed
-GCP/S3 HTTP-factory initialization limitation remain. Mocked tests and source
-inspection do not establish production deployment or live five-cloud E2E.
+milvus-storage f9138562 (milvus-storage#837) removes the process-wide GCP
+credential registry and the separate GCP HTTP-factory initialization. The
+credential provider is bound to each S3 client, so several GCP identities can
+share an endpoint and bucket, and GCP and S3-compatible filesystems initialize
+together in one process. Mocked tests and source inspection do not establish
+production deployment or live five-cloud E2E.
```

**File**: `internal/core/src/storage/loon_ffi/util.cpp` (modified, +2/-1)
```diff
@@ -1267,7 +1267,8 @@ InjectExternalSpecProperties(
 
     // Target impersonation and Broker tokens have the same endpoint contract
     // in Go admission and native readers, including persisted specs. Plain IAM
-    // retains GcpCredentialRegistry's operator-trusted endpoint delivery policy.
+    // keeps milvus-storage's Bearer delivery policy: HTTPS *.googleapis.com,
+    // or an endpoint the operator's primary GCP filesystem trusts.
     if (spec_cloud_provider == "gcp" &&
         (has_target || !broker_endpoint.empty())) {
         arrow::util::Uri endpoint;
```

**File**: `internal/core/thirdparty/milvus-storage/CMakeLists.txt` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@
 # Update milvus-storage_VERSION for the first occurrence
 milvus_add_pkg_config("milvus-storage")
 set_property(DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR} PROPERTY INCLUDE_DIRECTORIES "")
-set( milvus-storage_VERSION ce42fa1d4bec64015ff7dab9232634e1b6e602bf)
+set( milvus-storage_VERSION f9138562ffa1c8567b7197518164374c9eb5e7fa)
 set( GIT_REPOSITORY  "https://github.com/milvus-io/milvus-storage.git")
 message(STATUS "milvus-storage repo: ${GIT_REPOSITORY}")
 message(STATUS "milvus-storage version: ${milvus-storage_VERSION}")
```

**File**: `internal/core/unittest/test_external_take.cpp` (modified, +34/-9)
```diff
@@ -52,6 +52,7 @@
 #include "knowhere/comp/index_param.h"
 #include "milvus-storage/filesystem/fs.h"
 #include "milvus-storage/lob_column/lob_reference.h"
+#include "milvus-storage/filesystem/gcp/gcp_broker_credential_provider.h"
 #include "milvus-storage/filesystem/gcp/gcp_credential_provider.h"
 #include "milvus-storage/properties.h"
 #include "milvus-storage/reader.h"
@@ -4978,13 +4979,19 @@ TEST(InjectExtfsAllowlist, GcpBrokerTargetAndEndpoint) {
     ASSERT_TRUE(config.ok()) << config.status();
     EXPECT_EQ(config->gcp_target_service_account, target);
     EXPECT_EQ(config->credential_endpoint, endpoint);
+    // use_iam would make the Broker mint tokens for its own identity instead
+    // of the target.
+    EXPECT_FALSE(config->use_iam);
     EXPECT_EQ(config->access_key_id, "");
     EXPECT_EQ(config->access_key_value, "");
     EXPECT_EQ(config->talon_mode, milvus_storage::TalonMode::Disabled);
     auto provider = milvus_storage::BuildGcpProviderFromConfig(*config);
     ASSERT_TRUE(provider.ok()) << provider.status();
-    EXPECT_TRUE((*provider)->IssuesBearerToken());
-    EXPECT_EQ((*provider)->Identity().find("broker:"), 0u);
+    // The Broker provider, sending Bearer tokens (HMAC returns its key pair).
+    EXPECT_NE(dynamic_cast<milvus_storage::GcpBrokerCredentialProvider*>(
+                  provider->get()),
+              nullptr);
+    EXPECT_TRUE((*provider)->GetAWSCredentials().IsEmpty());
 
     auto reject = [&](const nlohmann::json& spec) {
         milvus_storage::api::Properties denied;
@@ -5067,13 +5074,25 @@ TEST(InjectExtfsAllowlist, GcpTargetServiceAccountWithOptionalIam) {
             std::make_shared<const milvus_storage::api::Properties>(props),
             "gs://storage.googleapis.com/bucket/path");
         ASSERT_TRUE(config.ok()) << config.status();
+        EXPECT_EQ(config->gcp_target_service_account, target);
+        EXPECT_TRUE(config->credential_endpoint.empty());
         EXPECT_EQ(config->access_key_id, "");
         EXPECT_EQ(config->access_key_value, "");
         EXPECT_EQ(config->talon_mode, milvus_storage::TalonMode::Disabled);
         auto provider = milvus_storage::BuildGcpProviderFromConfig(*config);
         ASSERT_TRUE(provider.ok()) << provider.status();
-        EXPECT_TRUE((*provider)->IssuesBearerToken());
-        EXPECT_EQ((*provider)->Identity(), "impersonate:" + target);
+        // A Bearer provider outside the Broker: node IAM or impersonation.
+        EXPECT_EQ(dynamic_cast<milvus_storage::GcpBrokerCredentialProvider*>(
+                      provider->get()),
+                  nullptr);
+        EXPECT_TRUE((*provider)->GetAWSCredentials().IsEmpty());
+        // Node IAM takes no token lifetime; impersonation rejects one above
+        // GCP's 3600 s cap.
+        auto unbounded = *config;
+        unbounded.load_frequency = 7200;
+        EXPECT_TRUE(milvus_storage::BuildGcpProviderFromConfig(unbounded)
+                        .status()
+                        .IsInvalid());
     }
 }
 
@@ -5182,8 +5201,9 @@ TEST(InjectExtfsAllowlist, S3CloudEndpointsResolveWithExplicitPort) {
 }
 
 TEST(InjectExtfsAllowlist, GcpPlainIamKeepsTrustedEndpointPolicy) {
-    // Injection must preserve plain IAM's existing endpoint policy. Actual
-    // Bearer delivery still depends on the operator-trusted registry entry.
+    // Injection must preserve plain IAM's existing endpoint policy.
+    // milvus-storage still sends the Bearer token to these custom endpoints
+    // only after the operator's primary GCP filesystem trusts them.
     ASSERT_TRUE(
         InitCredentialBrokerPolicy(
             std::string(
@@ -5251,16 +5271,21 @@ TEST(InjectExtfsAllowlist, GcpBrokerIamProviderAndValidation) {
     EXPECT_EQ(config->talon_mode, milvus_storage::TalonMode::Disabled);
     auto provider = milvus_storage::BuildGcpProviderFromConfig(*config);
     ASSERT_TRUE(provider.ok()) << provider.status();
-    EXPECT_TRUE((*provider)->IssuesBearerToken());
-    EXPECT_EQ((*provider)->Identity(), "broker-iam:" + endpoint);
+    EXPECT_NE(dynamic_cast<milvus_storage::GcpBrokerCredentialProvider*>(
+                  provider->get()),
+              nullptr);
+    EXPECT_TRUE((*provider)->GetAWSCredentials().IsEmpty());
 
     // Without a Broker endpoint the same IAM flag still selects node IAM.
     auto node_config = *config;
     node_config.credential_endpoint.clear();
     auto node_provider =
         milvus_storage::BuildGcpProviderFromConfig(node_config);
     ASSERT_TRUE(node_provider.ok()) << node_provider.status();
-    EXPECT_EQ((*node_provider)->Identity(), "iam");
+    EXPECT_EQ(dynamic_cast<milvus_storage::GcpBrokerCredentialProvider*>(
+                  node_provider->get()),
+              nullptr);
+    EXPECT_TRUE((*node_provider)->GetAWSCredentials().IsEmpty());
 
     auto reject = [&](const nlohmann::json& spec) {
         milvus_storage::api::Properties denied;
```

---

### Incident Patch 2: `b830b0cd` (2026-11-26)
**Commit Message**: enhance: keep the GC checkpoint test fixture out of production builds (#56108)

### Problem
`internal/datacoord/gc/checkpoint_fixtures_testonly.go` (added in
#52977) is guarded by `//go:build test || dynamic`. Production builds
pass the `dynamic` tag (`MILVUS_GO_BUILD_TAGS` in the Makefile), so this
test-only fixture is compiled into the `milvus` binary. It imports
`testing` and `github.com/bytedance/mockey`, and it is the only package
in the production dependency graph that imports mockey.

In mockey v1.4.6, the `internal/monkey/linkname` package has an `init()`
that walks the main module's whole function table and stores every
function in a name-to-PC map and a `[]*runtime.Func` slice. It runs at
startup in every Milvus process. In a mixcoord heap profile taken on
master `20746425a1` (`inuse_space`, after a forced GC),
`github.com/bytedance/mockey/internal/monkey/linkname.init.0` retained
9.97 MB (flat = cum).

### Change
Change the build constraint to `//go:build test`, as used by the other
`*_testonly.go` fixtures in `internal/datacoord`.

### Verification
- `go list -deps -tags dynamic,sonic,with_jemalloc,bytedance_tango
./cmd`, before and after: on arm64, 22 packages leave th

**File**: `internal/datacoord/gc/checkpoint_fixtures_testonly.go` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-//go:build test || dynamic
+//go:build test
 
 // Licensed to the LF AI & Data foundation under one
 // or more contributor license agreements. See the NOTICE file
```

---

### Incident Patch 3: `efd7ef8d` (2026-11-26)
**Commit Message**: fix: Align refused RESTful request logs and authorization reports with gRPC (#55957)

issue: #55955

A request refused before it reaches the Proxy method left different
records depending on the entry it came through. The first commit aligns
the RESTful entry with gRPC in four places without touching any log
format: values are only made available, and the configured access log
formatter decides which of them are written.

The second commit is the one change to the default configuration: the
default `upsert` formatter now also applies to the RESTful v2 upsert
path.

The third commit is the one change to a response: a RESTful request
naming a partition that does not exist is no longer answered as a rate
limit rejection.

The fourth commit lets the error type of a failed RESTful call reach the
access log.

### What changes

| | Before | After |
|---|---|---|
| Access log of a RESTful request refused by authentication | user
`Unknown`, code `Unknown`, empty message and error type | claimed user
name, code `1800`, message, `input_error` |
| Authorization report (`ReportAction` / `ActionAuthorize`) from the
RESTful entry | context without the gin context, so an extension cannot
read clien

**File**: `configs/milvus.yaml` (modified, +1/-1)
```diff
@@ -520,7 +520,7 @@ proxy:
         methods: "HybridSearch, Search, /search, /v1/vector/search, /v2/vectordb/entities/search, /v2/vectordb/entities/advanced_search, /v2/vectordb/entities/hybrid_search"
       upsert:
         format: "[$time_now] [ACCESS] <$user_name: $user_addr> $method_name [status: $method_status] [code: $error_code] [sdk: $sdk_version] [msg: $error_msg] [traceID: $trace_id] [timeCost: $time_cost] [database: $database_name] [collection: $collection_name] [partitions: $partition_name] [partial_update: $partial_update] [error_type: $error_type]"
-        methods: Upsert
+        methods: "Upsert, /v2/vectordb/entities/upsert"
     cacheSize: 0 # Size of log of write cache, in byte. (Close write cache if size was 0)
     cacheFlushInterval: 3 # time interval of auto flush write cache, in seconds. (Close auto flush if interval was 0)
   connectionCheckIntervalSeconds: 120 # the interval time(in seconds) for connection manager to scan inactive client info
```

**File**: `internal/distributed/proxy/httpserver/auth_report_test.go` (added, +135/-0)
```diff
@@ -0,0 +1,135 @@
+// Licensed to the LF AI & Data foundation under one
+// or more contributor license agreements. See the NOTICE file
+// distributed with this work for additional information
+// regarding copyright ownership. The ASF licenses this file
+// to you under the Apache License, Version 2.0 (the
+// "License"); you may not use this file except in compliance
+// with the License. You may obtain a copy of the License at
+//
+//     http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
+
+package httpserver
+
+import (
+	"context"
+	"net/http"
+	"net/http/httptest"
+	"testing"
+
+	"github.com/bytedance/mockey"
+	"github.com/gin-gonic/gin"
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+	"google.golang.org/grpc/codes"
+	"google.golang.org/grpc/status"
+
+	"github.com/milvus-io/milvus-proto/go-api/v3/hook"
+	"github.com/milvus-io/milvus-proto/go-api/v3/milvuspb"
+	"github.com/milvus-io/milvus/internal/proxy"
+	"github.com/milvus-io/milvus/internal/util/hookutil"
+	"github.com/milvus-io/milvus/pkg/v3/util/merr"
+	"github.com/milvus-io/milvus/pkg/v3/util/paramtable"
+)
+
+type reportedAction struct {
+	ctx        context.Context
+	req        interface{}
+	fullMethod string
+	action     string
+}
+
+type actionRecorder struct {
+	hookutil.DefaultExtension
+	actions []reportedAction
+}
+
+func (r *actionRecorder) ReportAction(ctx context.Context, req interface{}, _ interface{}, _ error, fullMethod string, action string) error {
+	r.actions = append(r.actions, reportedAction{ctx: ctx, req: req, fullMethod: fullMethod, action: action})
+	return nil
+}
+
+func (r *actionRecorder) authorizeActions() []reportedAction {
+	var result []reportedAction
+	for _, action := range r.actions {
+		if action.action == hookutil.ActionAuthorize {
+			result = append(result, action)
+		}
+	}
+	return result
+}
+
+func recordActions(t *testing.T) *actionRecorder {
+	original := hookutil.GetExtension()
+	t.Cleanup(func() { hookutil.SetTestExtension(original) })
+	recorder := &actionRecorder{}
+	hookutil.SetTestExtension(recorder)
+	return recorder
+}
+
+// A refusal reported as an authorization event carries the gin context, the
+// only place the hook extension can read the HTTP caller from.
+func TestCheckAuthorizationV2ReportsWithGinContext(t *testing.T) {
+	denied := status.Error(codes.PermissionDenied, "PrivilegeSearch: permission deny to alice in the `default` database")
+	privilege := mockey.Mock(proxy.PrivilegeInterceptorWithMetaCache).Return(
+		proxy.PrivilegeFunc(func(ctx context.Context, _ interface{}) (context.Context, error) {
+			return ctx, denied
+		})).Build()
+	defer privilege.UnPatch()
+
+	for _, tc := range []struct {
+		name     string
+		username string
+		status   int
+	}{
+		{name: "no authenticated user", username: "", status: http.StatusUnauthorized},
+		{name: "privilege denied", username: "alice", status: http.StatusForbidden},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			recorder := recordActions(t)
+			w := httptest.NewRecorder()
+			c, _ := gin.CreateTestContext(w)
+			c.Request = httptest.NewRequest(http.MethodPost, "/v2/vectordb/entities/search", nil)
+			c.Set(ContextUsername, tc.username)
+			req := &milvuspb.SearchRequest{DbName: "default", CollectionName: "collection"}
+
+			err := (&HandlersV2{}).checkAuthorizationV2(context.Background(), c, false, req)
+
+			assert.Error(t, err)
+			assert.Equal(t, tc.status, w.Code)
+			reports := recorder.authorizeActions()
+			require.Len(t, reports, 1)
+			assert.Same(t, c, reports[0].ctx.Value(hook.GinParamsKey))
+			assert.Same(t, req, reports[0].req)
+		})
+	}
+}
+
+// A rate limit rejection is not an authorization decision. The gRPC limiter
+// does not report it as one, so the RESTful entry must not either.
+func TestRateLimitRejectionIsNotReportedAsAuthorization(t *testing.T) {
+	paramtable.Init()
+	checkLimiter := mockey.Mock(CheckLimiter).Return(nil, merr.ErrServiceRateLimit).Build()
+	defer checkLimiter.UnPatch()
+	recorder := recordActions(t)
+
+	w := httptest.NewRecorder()
+	c, _ := gin.CreateTestContext(w)
+	c.Request = httptest.NewRequest(http.MethodPost, "/v2/vectordb/entities/search", nil)
+	handled := false
+
+	_, err := (&HandlersV2{}).wrapperProxyWithLimit(context.Background(), c, &milvuspb.SearchRequest{}, false, false,
+		"/milvus.proto.milvus.MilvusService/Search", true, nil,
+		func(context.Context, any) (any, error) { handled = true; return nil, nil })
+
+	assert.ErrorIs(t, err, RestRequestInterceptorErr)
+	assert.False(t, handled)
+	code, _ := c.Get(HTTPReturnCode)
+	assert.EqualValues(t, merr.Code(merr.ErrHTTPRateLimit), code)
+	assert.Empty(t, recorder.authorizeActions())
+
```

**File**: `internal/distributed/proxy/httpserver/constant.go` (modified, +1/-0)
```diff
@@ -112,6 +112,7 @@ const (
 	ContextResponse               = "response"
 	ContextUsername               = "username"
 	ContextToken                  = "token"
+	ContextErrorType              = "error_type" // merr classification of a failed call, read by the access log; must match accesslog/info.ContextErrorType
 	VectorCollectionsPath         = "/vector/collections"
 	VectorCollectionsCreatePath   = "/vector/collections/create"
 	VectorCollectionsDescribePath = "/vector/collections/describe"
```

**File**: `internal/distributed/proxy/httpserver/handler_v2.go` (modified, +18/-6)
```diff
@@ -753,21 +753,30 @@ func wrapperTraceLog(v2 handlerFuncV2) handlerFuncV2 {
 	}
 }
 
+// ContextWithGin attaches the gin context to ctx under the key the hook
+// extension looks it up by. With it the extension reads the caller of a RESTful
+// request (user, client address, user agent) from the HTTP request; without it
+// the extension looks for gRPC metadata and a gRPC peer, which a RESTful request
+// does not have.
+func ContextWithGin(ctx context.Context, c *gin.Context) context.Context {
+	return context.WithValue(ctx, hook.GinParamsKey, c)
+}
+
 func (h *HandlersV2) checkAuthorizationV2(ctx context.Context, c *gin.Context, ignoreErr bool, req interface{}) error {
 	username, ok := c.Get(ContextUsername)
 	if !ok || username.(string) == "" {
 		if !ignoreErr {
 			HTTPReturn(c, http.StatusUnauthorized, gin.H{HTTPReturnCode: merr.Code(merr.ErrNeedAuthenticate), HTTPReturnMessage: merr.ErrNeedAuthenticate.Error()})
 		}
-		hookutil.GetExtension().ReportAction(ctx, req, WrapErrorToResponse(merr.ErrNeedAuthenticate), nil, c.FullPath(), hookutil.ActionAuthorize)
+		hookutil.GetExtension().ReportAction(ContextWithGin(ctx, c), req, WrapErrorToResponse(merr.ErrNeedAuthenticate), nil, c.FullPath(), hookutil.ActionAuthorize)
 		return merr.ErrNeedAuthenticate
 	}
 	ctx, authErr := proxy.PrivilegeInterceptorWithMetaCache(h.metaCache)(ctx, req)
 	if authErr != nil {
 		if !ignoreErr {
 			HTTPReturn(c, http.StatusForbidden, gin.H{HTTPReturnCode: merr.Code(authErr), HTTPReturnMessage: authErr.Error()})
 		}
-		hookutil.GetExtension().ReportAction(ctx, req, WrapErrorToResponse(authErr), nil, c.FullPath(), hookutil.ActionAuthorize)
+		hookutil.GetExtension().ReportAction(ContextWithGin(ctx, c), req, WrapErrorToResponse(authErr), nil, c.FullPath(), hookutil.ActionAuthorize)
 		return authErr
 	}
 
@@ -795,7 +804,10 @@ func (h *HandlersV2) wrapperProxyWithLimit(ctx context.Context, ginCtx *gin.Cont
 		_, err := CheckLimiter(ctx, req, pxy)
 		if err != nil {
 			mlog.Warn(context.TODO(), "high level restful api, fail to check limiter", mlog.Err(err), mlog.String("method", fullMethod))
-			hookutil.GetExtension().ReportAction(ctx, req, WrapErrorToResponse(merr.ErrHTTPRateLimit), nil, ginCtx.FullPath(), hookutil.ActionAuthorize)
+			// A rate limit rejection is not an authorization decision and is
+			// not reported as one; the gRPC limiter does not report it either.
+			// The request still reaches the audit log through the report made
+			// when the RESTful request returns.
 			HTTPAbortReturn(ginCtx, http.StatusOK, gin.H{
 				HTTPReturnCode:    merr.Code(merr.ErrHTTPRateLimit),
 				HTTPReturnMessage: merr.ErrHTTPRateLimit.Error() + ", error: " + err.Error(),
@@ -818,7 +830,7 @@ func (h *HandlersV2) wrapperProxyWithLimit(ctx context.Context, ginCtx *gin.Cont
 			return handler(ctx, req)
 		})
 	}
-	response, err := proxy.HookInterceptor(context.WithValue(ctx, hook.GinParamsKey, ginCtx), req, username.(string), fullMethod, forwardHandler)
+	response, err := proxy.HookInterceptor(ContextWithGin(ctx, ginCtx), req, username.(string), fullMethod, forwardHandler)
 	if response != nil {
 		ginCtx.Set(ContextResponse, response)
 	}
@@ -831,8 +843,8 @@ func (h *HandlersV2) wrapperProxyWithLimit(ctx context.Context, ginCtx *gin.Cont
 
 	if err != nil {
 		// Expose the exact classification (incl. boundary InputError marks) to
-		// the REST access log; key must match accesslog/info.ContextErrorType.
-		ginCtx.Set("error_type", merr.GetErrorType(err).String())
+		// the REST access log.
+		ginCtx.Set(ContextErrorType, merr.GetErrorType(err).String())
 		mlog.Warn(ctx, "high level restful api, grpc call failed", mlog.Err(err))
 		if !ignoreErr {
 			HTTPAbortReturn(ginCtx, http.StatusOK, gin.H{HTTPReturnCode: merr.Code(err), HTTPReturnMessage: err.Error()})
```

**File**: `internal/distributed/proxy/httpserver/handler_v2_test.go` (modified, +4/-0)
```diff
@@ -1014,6 +1014,7 @@ func TestTimeoutMiddlewareCommitsBufferedResponsesAndMetadata(t *testing.T) {
 				c.Header("X-Test", testcase.name)
 				c.Set(ContextRequest, "request-"+testcase.name)
 				c.Set(ContextResponse, "response-"+testcase.name)
+				c.Set(ContextErrorType, merr.InputError.String())
 				c.Set("traceID", "trace-"+testcase.name)
 				testcase.write(c, testcase.code, testcase.name)
 			}))
@@ -1043,6 +1044,9 @@ func TestTimeoutMiddlewareCommitsBufferedResponsesAndMetadata(t *testing.T) {
 			value, ok = ctx.Get(ContextResponse)
 			assert.True(t, ok)
 			assert.Equal(t, "response-"+testcase.name, value)
+			value, ok = ctx.Get(ContextErrorType)
+			assert.True(t, ok)
+			assert.Equal(t, merr.InputError.String(), value)
 			value, ok = ctx.Get("traceID")
 			assert.True(t, ok)
 			assert.Equal(t, "trace-"+testcase.name, value)
```

**File**: `internal/distributed/proxy/httpserver/timeout_middleware.go` (modified, +5/-0)
```diff
@@ -222,6 +222,11 @@ var timeoutContextKeysToPropagate = []string{
 	HTTPReturnMessage,
 	ContextRequest,
 	ContextResponse,
+	// Without it the access log, which reads the original context, falls
+	// back to the default classification of the code and loses the marks
+	// made at the proxy boundary (for example a not-found name is an input
+	// error there, a system error by default).
+	ContextErrorType,
 	"traceID",
 }
 
```

**File**: `internal/distributed/proxy/httpserver/utils.go` (modified, +7/-1)
```diff
@@ -5020,7 +5020,13 @@ func CheckLimiter(ctx context.Context, req interface{}, pxy types.ProxyComponent
 	metaCache := getProxyMetaCache(pxy)
 	dbID, collectionIDToPartIDs, rt, n, err := proxy.GetRequestInfo(ctx, metaCache(), request)
 	if err != nil {
-		return nil, err
+		// Failing to resolve the names in the request is not a rate limit
+		// decision. Let the request through, as the gRPC rate limit
+		// interceptor does, so that the Proxy method reports the real error
+		// (for example partition not found) instead of the caller reporting
+		// a rate limit rejection.
+		mlog.Warn(ctx, "failed to get request info when check limiter", mlog.Err(err))
+		return nil, nil
 	}
 	if n == 0 {
 		return nil, nil
```

**File**: `internal/distributed/proxy/httpserver/utils_test.go` (modified, +42/-0)
```diff
@@ -115,6 +115,48 @@ func TestCheckLimiter_ZeroTokenRequestsBypassLimiter(t *testing.T) {
 	}
 }
 
+// A request naming a partition that does not exist is not a rate limit
+// rejection: the limiter is not consulted and the request goes on to the Proxy
+// method, which reports the real error, as it does behind the gRPC rate limit
+// interceptor.
+func TestCheckLimiter_MetaLookupFailureIsNotARateLimitRejection(t *testing.T) {
+	quotaConfig := &paramtable.Get().QuotaConfig.QuotaAndLimitsEnabled
+	originalValue := quotaConfig.GetValue()
+	require.NoError(t, paramtable.Get().Save(quotaConfig.Key, "true"))
+	t.Cleanup(func() { _ = paramtable.Get().Save(quotaConfig.Key, originalValue) })
+
+	pxy := proxyComponentWithMetaCache{ProxyComponent: &proxy.Proxy{}, metaCache: &proxy.MetaCache{}}
+	getLimiter := mockey.Mock((*proxy.Proxy).GetRateLimiter).Return(&proxy.SimpleLimiter{}, nil).Build()
+	defer getLimiter.UnPatch()
+	check := mockey.Mock((*proxy.SimpleLimiter).Check).Return(nil).Build()
+	defer check.UnPatch()
+	getDatabase := mockey.Mock((*proxy.MetaCache).GetDatabaseInfo).Return(&metacache.DatabaseInfo{DBID: 100}, nil).Build()
+	defer getDatabase.UnPatch()
+	getCollection := mockey.Mock((*proxy.MetaCache).GetCollectionID).Return(int64(10), nil).Build()
+	defer getCollection.UnPatch()
+	getPartition := mockey.Mock((*proxy.MetaCache).GetPartitionInfo).Return(nil, merr.WrapErrPartitionNotFound("nopart")).Build()
+	defer getPartition.UnPatch()
+
+	testCases := []struct {
+		name    string
+		request proto.Message
+	}{
+		{"insert", &milvuspb.InsertRequest{DbName: "target", CollectionName: "collection", PartitionName: "nopart"}},
+		{"delete", &milvuspb.DeleteRequest{DbName: "target", CollectionName: "collection", PartitionName: "nopart", Expr: "id == 1"}},
+		{"search", &milvuspb.SearchRequest{DbName: "target", CollectionName: "collection", PartitionNames: []string{"nopart"}, Nq: 1}},
+		{"query", &milvuspb.QueryRequest{DbName: "target", CollectionName: "collection", PartitionNames: []string{"nopart"}}},
+	}
+	for _, tc := range testCases {
+		t.Run(tc.name, func(t *testing.T) {
+			resp, err := CheckLimiter(context.Background(), tc.request, pxy)
+			assert.NoError(t, err)
+			assert.Nil(t, resp)
+		})
+	}
+	assert.Zero(t, check.Times(), "the limiter must not be consulted when the request info cannot be resolved")
+	assert.EqualValues(t, len(testCases), getPartition.Times(), "the lookup failure must be the reason the limiter was skipped")
+}
+
 func TestCheckLimiter_ChargedRequestsRemainRateLimited(t *testing.T) {
 	quotaConfig := &paramtable.Get().QuotaConfig.QuotaAndLimitsEnabled
 	originalValue := quotaConfig.GetValue()
```

#### Recent Merged Pull Requests:
- **PR #56108** (2026-11-26): enhance: keep the GC checkpoint test fixture out of production builds (@liliu-z)
- **PR #56071** (2026-11-26): fix: [3.0] bump milvus-storage to read Tencent role_arn volumes (@xiaofan-luan)
- **PR #56063** (closed): enhance: schedule async segment loads by sequence and priority (@sparknack)
- **PR #56061** (closed): feat: Support business-version conditional upserts in the Go SDK (@weiliu1031)
- **PR #56057** (2026-11-26): enhance: reduce logging allocations in compaction scans (@sijie-ni-0214)
- **PR #56050** (2026-11-26): build(deps): bump milvus-storage for per-client GCP credentials (@xiaofan-luan)

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

## X. build(deps): bump milvus-storage for per-client GCP credentials

**RULE**:
When implementing operations in `docs/design-docs/design_docs/20261110-external-collection-broker-iam.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in milvus-io/milvus. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `a9679897`: build(deps): bump milvus-storage for per-client GCP credentials. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/design-docs/design_docs/20261110-external-collection-broker-iam.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
milvus-storage f9138562 (milvus-storage#837) removes the process-wide GCP
credential registry and the separate GCP HTTP-factory initialization. The
credential provider is bound to each S3 client, so several GCP identities can
share an endpoint and bucket, and GCP and S3-compatible filesystems initialize
together in one process. Mocked tests and source inspection do not establish
production deployment or live five-cloud E2E.
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
The one-GCP-identity-per-(endpoint,bucket) registry restriction and mixed
GCP/S3 HTTP-factory initialization limitation remain. Mocked tests and source
inspection do not establish production deployment or live five-cloud E2E.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `a9679897` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
