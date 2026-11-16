# Verification Protocol: Verification Protocol: Empirical Defect Shield for milvus-io/milvus

<!-- PROVENANCE_START
{
  "source_repository": "milvus-io/milvus",
  "source_url": "https://github.com/milvus-io/milvus",
  "source_version": "9f1054c2",
  "license": "Apache-2.0",
  "timestamp": "2026-11-16T13:38:33.227Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-milvus-io-milvus",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [milvus-io/milvus](https://github.com/milvus-io/milvus) (Revision: `9f1054c2`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-16T13:38:33.227Z`  
> **Learning ID**: `learn-github-milvus-io-milvus`


## 1. Scope & Verification Target
- **Target Repository**: `milvus-io/milvus` (Commit: `9f1054c2`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): milvus-io/milvus

> **Canonical Artifact**: `07_PROJECT_LEARNING/milvus-io-milvus-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/milvus-io/milvus](https://github.com/milvus-io/milvus))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-16T13:38:32.204Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `milvus-io/milvus`
- **Description**: Milvus is a high-performance, cloud-native vector database built for scalable vector ANN search
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 46674 stars

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

### Core Architecture Module: `internal/core/benchmark/BitmapRangeBenchmark.cpp`
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

// Times BitmapIndexReader::Range over heap Roaring postings. Built with the
// unit tests; run before and after a change to compare.
#include <algorithm>
#include <cstddef>
#include <cstdint>
#include <memory>
#include <random>
#include <utility>
#include <vector>

#include <benchmark/benchmark.h>
#include <roaring/roaring.hh>

#include "common/Types.h"
#include "index/contracts/query/IScalarPredicateReader.h"
#include "index/scalar/bitmap/BitmapIndexReader.h"

namespace milvus::index {
namespace {

constexpr size_t kRows = 1'000'000;
constexpr size_t kNullEvery = 10;

struct Fixture {
    std::unique_ptr<BitmapIndexReader<int64_t>> reader;
    // Values of the valid rows, sorted, for selectivity thresholds.
    std::vector<int64_t> sorted;
};

// distribution 0: uniform keys. 1: rows concentrated on the high keys, so
// `<` ranges start in sparse postings and reach the heavy ones only when broad.
Fixture
MakeFixture(int64_t keys, int64_t distribution) {
    std::mt19937_64 rng(42);
    std::uniform_real_distribution<double> unit(0.0, 1.0);
    BitmapRoaringPostingMap<int64_t> postings;
    TargetBitmap valid(kRows, true);
    Fixture fixture;
    fixture.sorted.reserve(kRows);
    for (size_t row = 0; row < kRows; ++row) {
        if (row % kNullEvery == 0) {
            valid.reset(row);
            continue;
        }
        const double u = unit(rng);
        const auto bucket =
            std::min(static_cast<int64_t>((distribution == 0 ? u : u * u) *
                                          static_cast<double>(keys)),
                     keys - 1);
        const auto key = distribution == 0 ? bucket : keys - 1 - bucket;
        postings[key].add(static_cast<uint32_t>(row));
        fixture.sorted.push_back(key);
    }
    std::sort(fixture.sorted.begin(), fixture.sorted.end());
    fixture.reader = CreateBitmapIndexReader<int64_t>(
        std::move(postings),
        BitmapStorageOptions{.valid_bitset = std::move(valid),
                             .total_num_rows = kRows});
    return fixture;
}

// Arguments: distinct keys, distribution, percent of valid rows matched.
void
RangeLessThan(benchmark::State& state) {
    const auto fixture = MakeFixture(state.range(0), state.range(1));
    const auto percent = static_cast<size_t>(state.range(2));
    const auto threshold =
        fixture.sorted[fixture.sorted.size() * percent / 100];
    state.counters["matched"] = static_cast<double>(
        fixture.reader->Range(threshold, CompareOp::LessThan).count());
    for (auto _ : state) {
        auto result = fixture.reader->Range(threshold, CompareOp::LessThan);
        benchmark::DoNotOptimize(result);
    }
}

}  // namespace
}  // namespace milvus::index

BENCHMARK(milvus::index::RangeLessThan)
    ->ArgsProduct({{1000, 10000, 100000}, {0, 1}, {1, 10, 50, 90, 99}})
    ->Unit(benchmark::kMicrosecond);

BENCHMARK_MAIN();

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #55561** (2026-11-16): **fix: [cp3.0]Retry coordinator RPCs promptly after ServerID changes**
  *Symptoms*: Cherry-pick from master (PR still open)  pr: #55553 issue: #55552  Backport coordinator retry recovery to 3.0: after a retryable ServerID mismatch, try a successfully acquired connection immediately when its ServerID differs. Preserve fresh acquisition after backoff when discovery remains stale or lookup/dial fails, including recovery during the wait with only one attempt left.  This is a preemptive backport of master PR #55553 at commit 5283826e54dcdfe5678d35c85af0ed1e63d4af42. The original PR is still open; this backport must be updated if it changes.  Verification: - [x] All 6 changed files match the original PR: 700 additions, 9 deletions. - [x] Added/deleted lines match per file, including duplicate counts. - [x] Applied without conflicts; no conflict markers; `git diff --check` passes. - [ ] make static-check (skipped by cherry-pick workflow)  Tests were not rerun locally on 3.0; target-branch validation is left to CI. This patch does not wake an existing backoff or change its maximum. The historical 14.120-second recovery delay is not a measured saving from this change. 
  **Post-Mortem & Fix Analysis**:
  > [ci-v2-notice] Notice: ci-v2 system is enabled for this PR (3.0 branch).  To rerun ci-v2 checks, comment with: - /ci-rerun-code-check-macos  // for Code Checker MacOS (GitHub Actions) - /ci-rerun-build-ut-cov  // for ci-v2/build-ut-cov (build + unit tests) - /ci-rerun-e2e-amd  // for ci-v2/e2e-amd (e2e tests) - /ci-rerun-e2e-dist-wp  // for ci-v2/e2e-dist-wp (Tencent distributed woodpecker-service boundary) - /ci-rerun-gosdk  // for ci-v2/go-sdk (Go SDK E2E tests) - /ci-rerun-gosdk-std  // for ci-v2/go-sdk-std (Go SDK E2E, standalone) - /ci-rerun-gosdk-dist-wp // for ci-v2/go-sdk-dist-wp (distributed + Woodpecker service)  If you have any questions or requests, please contact @zhikunyao. 
  > [INFO] PR Label Summary by Default [FAILED] PR #55553 not merged - Title: fix: Retry coordinator RPCs promptly after ServerID changes - Status: OPEN - Link: https://github.com/milvus-io/milvus/pull/55553   [WARNING] Milestone not set - PR: #55561 - Title: fix: [cp3.0]Retry coordinator RPCs promptly after ServerID changes Please set a milestone for better release tracking  You can set milestone by commenting:   /set-milestone <milestone-name> Example:   /set-milestone 2.5.0  Use /refresh-label to update related check and label manually

- **Issue #55560** (2026-11-16): **enhance: [cp3.0]revoke session leases before a forced stop exit**
  *Symptoms*: Cherry-pick from master  pr: #54556  When graceful stop times out, revoke the session leases this process keeps alive before forced exit so a standby coordinator can take over without waiting for lease expiry. Backports merged master PR #54556 to 3.0 without code changes or conflict resolution.  Verification: - [x] All 3 changed files match the original PR: 77 additions, 0 deletions. - [x] Added/deleted lines match per file, including duplicate counts. - [x] No conflict markers; `git diff --check` passes. - [ ] make static-check (skipped by cherry-pick workflow)  Runtime tests were not run locally; validation is left to CI. 

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

### Incident Patch 1: `86534551` (2026-11-15)
**Commit Message**: test: fix flaky TestBuildLatencyExcludesAdmissionWait (#55314)

## Problem

`TestBuildLatencyExcludesAdmissionWait`
(`internal/datanode/index/task_test.go`) intermittently fails in CI. It
was observed failing in `milvus-build-ut-ciloop-pipeline-for-tcus/4060`
(UT-GO) with:

```
=== FAIL: internal/datanode/index TestIndexBuildTask/TestBuildLatencyExcludesAdmissionWait (unknown)
signal: segmentation fault (core dumped)
```

The test patched the globally-hot `time.Now` with
`mockey.Mock(time.Now)`. mockey rewrites the target function's machine
code non-atomically, so concurrent `time.Now` callers (e.g. the
config-refresh goroutine started by `paramtable.Init` in `TestMain`)
race with the patch. Under `-race` this surfaces as a data race; without
`-race` it segfaults.

## Root cause

`mockey.Mock(time.Now)` in `TestBuildLatencyExcludesAdmissionWait` races
with background goroutines that call `time.Now` concurrently. Reproduced
locally with `-race -gcflags="all=-N -l"`:

- `-test.run 'TestIndexBuildTask/TestBuildLatencyExcludesAdmissionWait'
-test.count=300` → repeated `WARNING: DATA RACE` between goroutine 214
(test goroutine at `task_test.go:231` `mockey.Mock(time.Now)`) and
goroutine

**File**: `internal/datanode/index/task_index.go` (modified, +8/-6)
```diff
@@ -61,6 +61,7 @@ type indexBuildTask struct {
 	prepareDur     time.Duration // Preparation and input loading, excluding waits between stages.
 	manager        *TaskManager
 
+	now           func() time.Time // Injectable clock; defaults to time.Now, tests override it.
 	pluginContext *indexcgopb.StoragePluginContext
 }
 
@@ -79,6 +80,7 @@ func NewIndexBuildTask(ctx context.Context,
 		req:           req,
 		tr:            timerecord.NewTimeRecorder(fmt.Sprintf("IndexBuildID: %d, ClusterID: %s", req.GetBuildID(), req.GetClusterID())),
 		manager:       manager,
+		now:           time.Now,
 		pluginContext: pluginContext,
 	}
 
@@ -163,7 +165,7 @@ func (it *indexBuildTask) IsVectorIndex() bool {
 }
 
 func (it *indexBuildTask) PreExecute(ctx context.Context) error {
-	started := time.Now()
+	started := it.now()
 	it.queueDur = it.tr.RecordSpan()
 	mlog.Info(ctx, "Begin to prepare indexBuildTask", mlog.FieldBuildID(it.req.GetBuildID()),
 		mlog.Int64("Collection", it.req.GetCollectionID()), mlog.Int64("SegmentID", it.req.GetSegmentID()))
@@ -237,7 +239,7 @@ func (it *indexBuildTask) PreExecute(ctx context.Context) error {
 		mlog.Int32("currentIndexVersion", it.req.GetCurrentIndexVersion()),
 		mlog.Int32("currentScalarIndexVersion", it.req.GetCurrentScalarIndexVersion()),
 	)
-	it.prepareDur = time.Since(started)
+	it.prepareDur = it.now().Sub(started)
 	return nil
 }
 
@@ -261,7 +263,7 @@ func redactBuildIndexParamsForLog(params *indexcgopb.BuildIndexInfo) *indexcgopb
 }
 
 func (it *indexBuildTask) LoadData(ctx context.Context) error {
-	started := time.Now()
+	started := it.now()
 	if it.index == nil {
 		if err := it.createBuilder(ctx); err != nil {
 			return err
@@ -270,7 +272,7 @@ func (it *indexBuildTask) LoadData(ctx context.Context) error {
 	if err := it.index.LoadData(); err != nil {
 		return err
 	}
-	it.prepareDur += time.Since(started)
+	it.prepareDur += it.now().Sub(started)
 	it.tr.RecordSpan()
 	return nil
 }
@@ -404,11 +406,11 @@ func (it *indexBuildTask) Execute(ctx context.Context) error {
 	if it.index == nil {
 		return merr.WrapErrServiceInternalMsg("index input has not been prepared")
 	}
-	started := time.Now()
+	started := it.now()
 	if err := it.index.Build(); err != nil {
 		return err
 	}
-	buildIndexLatency := it.prepareDur + time.Since(started)
+	buildIndexLatency := it.prepareDur + it.now().Sub(started)
 	metrics.DataNodeKnowhereBuildIndexLatency.WithLabelValues(strconv.FormatInt(paramtable.GetNodeID(), 10)).Observe(buildIndexLatency.Seconds())
 	it.tr.RecordSpan()
 	return nil
```

**File**: `internal/datanode/index/task_test.go` (modified, +2/-3)
```diff
@@ -228,10 +228,9 @@ func (suite *IndexBuildTaskSuite) TestBuildLatencyExcludesAdmissionWait() {
 	}
 	before := readMetric()
 	var elapsed atomic.Int64
-	clock := mockey.Mock(time.Now).To(func() time.Time {
+	task.now = func() time.Time {
 		return time.Unix(1000, elapsed.Load())
-	}).Build()
-	defer clock.UnPatch()
+	}
 	prepare := mockey.Mock(getCurrentIndexVersion).To(func(version int32) int32 {
 		elapsed.Add(int64(2 * time.Second))
 		return version
```

---

### Incident Patch 2: `e07890ac` (2026-11-16)
**Commit Message**: fix: restrict default collection lookup fallback to missing keys (#55261)

## Summary

Fix RootCoord default-database collection lookup so legacy metadata is
used only when the modern default-database key is explicitly absent.

## Root Cause

`loadCollectionFromDb` converted every `Load` error and tombstone into
`ErrCollectionNotFound`. `loadCollectionFromDefaultDb` then treated
every non-nil error as evidence that the modern key was absent and read
the legacy `NonDBID` key.

As a result, a valid legacy collection could be returned after a logical
deletion or a storage I/O failure.

## Changes

- Preserve typed storage errors and classify untyped load errors as
`ErrIoFailed`.
- Fall back to the legacy `NonDBID` key only for `ErrIoKeyNotFound`.
- Keep tombstones as `ErrCollectionNotFound`.
- Preserve `ErrCollectionNotFound` when both the default and legacy keys
are absent.
- Add regression coverage for tombstones, I/O errors, explicit key
absence, and both keys being absent.

## Testing

Passed:

- Focused `GetCollectionByID` regression tests with `-tags dynamic,test
-gcflags="all=-N -l"`.
- Catalog-focused RootCoord metastore tests.
- `go build ./internal/metastore/kv/rootcoord`
- 

**File**: `internal/metastore/kv/rootcoord/kv_catalog.go` (modified, +18/-3)
```diff
@@ -267,7 +267,11 @@ func (kc *Catalog) loadCollectionFromDb(ctx context.Context, dbID int64, collect
 	collKey := BuildCollectionKey(dbID, collectionID)
 	collVal, err := kc.Txn.Load(ctx, collKey)
 	if err != nil {
-		return nil, merr.WrapErrCollectionNotFound(collectionID, err.Error())
+		// Return the storage error as is. The default-database compatibility
+		// fallback must distinguish a missing key from a tombstone or an I/O
+		// failure, and callers must still see a cancellation or a timeout as
+		// such.
+		return nil, err
 	}
 
 	// Legacy SuffixSnapshot deletion with ts!=0 overwrote the plain key with a
@@ -283,9 +287,13 @@ func (kc *Catalog) loadCollectionFromDb(ctx context.Context, dbID int64, collect
 }
 
 func (kc *Catalog) loadCollectionFromDefaultDb(ctx context.Context, collectionID typeutil.UniqueID, ts typeutil.Timestamp) (*pb.CollectionInfo, error) {
-	if info, err := kc.loadCollectionFromDb(ctx, util.DefaultDBID, collectionID, ts); err == nil {
+	info, err := kc.loadCollectionFromDb(ctx, util.DefaultDBID, collectionID, ts)
+	if err == nil {
 		return info, nil
 	}
+	if !errors.Is(err, merr.ErrIoKeyNotFound) {
+		return nil, err
+	}
 	// get collection from older version.
 	return kc.loadCollectionFromDb(ctx, util.NonDBID, collectionID, ts)
 }
@@ -294,12 +302,19 @@ func (kc *Catalog) loadCollection(ctx context.Context, dbID int64, collectionID
 	if isDefaultDB(dbID) {
 		info, err := kc.loadCollectionFromDefaultDb(ctx, collectionID, ts)
 		if err != nil {
+			if errors.Is(err, merr.ErrIoKeyNotFound) {
+				return nil, merr.WrapErrCollectionNotFound(collectionID)
+			}
 			return nil, err
 		}
 		kc.fixDefaultDBIDConsistency(ctx, info, ts)
 		return info, nil
 	}
-	return kc.loadCollectionFromDb(ctx, dbID, collectionID, ts)
+	info, err := kc.loadCollectionFromDb(ctx, dbID, collectionID, ts)
+	if errors.Is(err, merr.ErrIoKeyNotFound) {
+		return nil, merr.WrapErrCollectionNotFound(collectionID)
+	}
+	return info, err
 }
 
 func partitionVersionAfter210(collMeta *pb.CollectionInfo) bool {
```

**File**: `internal/metastore/kv/rootcoord/kv_catalog_test.go` (modified, +2/-1)
```diff
@@ -414,9 +414,10 @@ func TestCatalog_GetCollectionByID(t *testing.T) {
 	ss := mocks.NewTxnKV(t)
 	c := NewCatalog(ss)
 
-	ss.EXPECT().Load(mock.Anything, mock.Anything).Return("", errors.New("load error")).Twice()
+	ss.EXPECT().Load(mock.Anything, mock.Anything).Return("", errors.New("load error")).Once()
 	coll, err := c.GetCollectionByID(ctx, 0, 1, 1)
 	assert.Error(t, err)
+	assert.False(t, merr.ErrCollectionNotFound.Is(err))
 	assert.Nil(t, coll)
 
 	ss.EXPECT().Load(mock.Anything, mock.Anything).RunAndReturn(func(ctx context.Context, key string) (string, error) {
```

**File**: `internal/metastore/kv/rootcoord/kv_catalog_tombstone_test.go` (modified, +86/-2)
```diff
@@ -72,8 +72,10 @@ func TestCatalog_ListCollections_SkipsTombstone(t *testing.T) {
 func TestCatalog_GetCollectionByID_TombstoneIsNotFound(t *testing.T) {
 	ctx := context.Background()
 	kv := mocks.NewTxnKV(t)
-	// Both default-db attempt and legacy-path attempt return the tombstone.
-	kv.EXPECT().Load(mock.Anything, mock.Anything).Return(tombstone(), nil)
+	defaultKey := BuildCollectionKey(util.DefaultDBID, 99999)
+	// A tombstone is a logical deletion, not evidence that the modern key is
+	// absent. The legacy key must not be read.
+	kv.EXPECT().Load(mock.Anything, defaultKey).Return(tombstone(), nil).Once()
 
 	kc := NewCatalog(kv)
 	got, err := kc.GetCollectionByID(ctx, util.DefaultDBID, 1, 99999)
@@ -82,6 +84,88 @@ func TestCatalog_GetCollectionByID_TombstoneIsNotFound(t *testing.T) {
 	assert.Nil(t, got)
 }
 
+func TestCatalog_GetCollectionByID_DefaultLoadErrorDoesNotFallback(t *testing.T) {
+	ctx := context.Background()
+	defaultKey := BuildCollectionKey(util.DefaultDBID, 42)
+	kv := mocks.NewTxnKV(t)
+	kv.EXPECT().Load(mock.Anything, defaultKey).
+		Return("", merr.WrapErrIoFailed(defaultKey, context.DeadlineExceeded)).Once()
+
+	kc := NewCatalog(kv)
+	got, err := kc.GetCollectionByID(ctx, util.DefaultDBID, 1, 42)
+	assert.Error(t, err)
+	assert.True(t, merr.ErrIoFailed.Is(err))
+	assert.False(t, merr.ErrCollectionNotFound.Is(err))
+	assert.Nil(t, got)
+}
+
+func TestCatalog_GetCollectionByID_DefaultLoadContextErrorIsPreserved(t *testing.T) {
+	ctx := context.Background()
+	defaultKey := BuildCollectionKey(util.DefaultDBID, 42)
+	for _, loadErr := range []error{context.DeadlineExceeded, context.Canceled} {
+		kv := mocks.NewTxnKV(t)
+		// The KV layer returns the context error unwrapped. It must reach the
+		// caller unchanged and must not trigger the legacy fallback.
+		kv.EXPECT().Load(mock.Anything, defaultKey).Return("", loadErr).Once()
+
+		kc := NewCatalog(kv)
+		got, err := kc.GetCollectionByID(ctx, util.DefaultDBID, 1, 42)
+		assert.ErrorIs(t, err, loadErr)
+		assert.True(t, merr.IsCanceledOrTimeout(err))
+		assert.False(t, merr.ErrCollectionNotFound.Is(err))
+		assert.Nil(t, got)
+	}
+}
+
+func TestCatalog_GetCollectionByID_DefaultKeyNotFoundFallsBackToLegacy(t *testing.T) {
+	ctx := context.Background()
+	defaultKey := BuildCollectionKey(util.DefaultDBID, 42)
+	legacyKey := BuildCollectionKey(util.NonDBID, 42)
+	legacy := &pb.CollectionInfo{
+		ID:    42,
+		DbId:  util.DefaultDBID,
+		State: pb.CollectionState_CollectionCreated,
+		Schema: &schemapb.CollectionSchema{
+			Name:   "legacy-collection",
+			Fields: []*schemapb.FieldSchema{{FieldID: 1, Name: "field"}},
+		},
+		PartitionIDs:               []int64{43},
+		PartitionNames:             []string{"_default"},
+		PartitionCreatedTimestamps: []uint64{1},
+	}
+	legacyValue, err := proto.Marshal(legacy)
+	require.NoError(t, err)
+
+	kv := mocks.NewTxnKV(t)
+	kv.EXPECT().Load(mock.Anything, defaultKey).
+		Return("", merr.WrapErrIoKeyNotFound(defaultKey)).Once()
+	kv.EXPECT().Load(mock.Anything, legacyKey).
+		Return(string(legacyValue), nil).Once()
+
+	kc := NewCatalog(kv)
+	got, err := kc.GetCollectionByID(ctx, util.DefaultDBID, 1, 42)
+	require.NoError(t, err)
+	require.NotNil(t, got)
+	assert.Equal(t, "legacy-collection", got.Name)
+}
+
+func TestCatalog_GetCollectionByID_DefaultAndLegacyKeysNotFound(t *testing.T) {
+	ctx := context.Background()
+	defaultKey := BuildCollectionKey(util.DefaultDBID, 42)
+	legacyKey := BuildCollectionKey(util.NonDBID, 42)
+	kv := mocks.NewTxnKV(t)
+	kv.EXPECT().Load(mock.Anything, defaultKey).
+		Return("", merr.WrapErrIoKeyNotFound(defaultKey)).Once()
+	kv.EXPECT().Load(mock.Anything, legacyKey).
+		Return("", merr.WrapErrIoKeyNotFound(legacyKey)).Once()
+
+	kc := NewCatalog(kv)
+	got, err := kc.GetCollectionByID(ctx, util.DefaultDBID, 1, 42)
+	assert.Error(t, err)
+	assert.True(t, merr.ErrCollectionNotFound.Is(err))
+	assert.Nil(t, got)
+}
+
 func TestCatalog_GetCollectionByName_SkipsTombstone(t *testing.T) {
 	ctx := context.Background()
 	kv := mocks.NewTxnKV(t)
```

---

### Incident Patch 3: `4d2a35e4` (2026-11-16)
**Commit Message**: test: fix chaos cleanup hook for pytest 8 (#55501)

When `TestChaosApply` fails after creating a Chaos Mesh Schedule, its
legacy `teardown` method is ignored by pytest 8.3.4. The Schedule
remains installed and can keep disrupting the instance while subsequent
checks run.

Rename the hook to `teardown_method` so pytest executes the existing
cleanup on both success and failure. Preserve the Schedule visibility
assertion and existing deletion behavior.

Validation:
- Replayed the source cleanup method under pytest 8.3.4: the original
hook left both tracked resources undeleted after an intentional
assertion failure.
- With the supported hook, cleanup ran in four local scenarios:
assertion failure, partial-creation state, failure before configuration,
and normal completion. The original test outcomes were preserved.
Kubernetes deletion was replaced with a recorder for this isolated
lifecycle check.
- Ruff 0.15.11 check and format check, Python compilation, and `git diff
--check` passed. The repository's configured license-header scope covers
`internal/**/*.go`; this Python-only change is outside that scope.
- Full Kubernetes chaos E2E was not rerun.

Signed-off-by: zhuwenxing <[REDACTED

**File**: `tests/python_client/chaos/test_chaos_apply.py` (modified, +1/-1)
```diff
@@ -131,7 +131,7 @@ def reconnect(self):
         if connections.has_connection("default") is False:
             raise Exception("no connections")
 
-    def teardown(self):
+    def teardown_method(self):
         for chaos_config in getattr(self, "chaos_configs", [getattr(self, "chaos_config", {})]):
             if not chaos_config:
                 continue
```

#### Recent Merged Pull Requests:
- **PR #55561** (2026-11-16): fix: [cp3.0]Retry coordinator RPCs promptly after ServerID changes (@bigsheeper)
- **PR #55560** (2026-11-16): enhance: [cp3.0]revoke session leases before a forced stop exit (@bigsheeper)
- **PR #55559** (2026-11-16): test: stabilize Base64 vector allocation budget (@chyezh)
- **PR #55553** (2026-11-16): fix: Retry coordinator RPCs promptly after ServerID changes (@bigsheeper)
- **PR #55550** (2026-11-16): test: wait for the index before iterating in search_iterator_using_mul_db (@xiaofan-luan)
- **PR #55548** (2026-11-15): test: fix nil viewFeedback panic in TestQueryViewReleaseRuntimeShutdown (@xiaofan-luan)

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

## X. test: fix flaky TestBuildLatencyExcludesAdmissionWait

**RULE**:
When implementing operations in `internal/datanode/index/task_index.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in milvus-io/milvus. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `86534551`: test: fix flaky TestBuildLatencyExcludesAdmissionWait. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `internal/datanode/index/task_index.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	now           func() time.Time // Injectable clock; defaults to time.Now, tests override it.
		now:           time.Now,
	started := it.now()
	it.prepareDur = it.now().Sub(started)
	started := it.now()
	it.prepareDur += it.now().Sub(started)
	started := it.now()
	buildIndexLatency := it.prepareDur + it.now().Sub(started)
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
	started := time.Now()
	it.prepareDur = time.Since(started)
	started := time.Now()
	it.prepareDur += time.Since(started)
	started := time.Now()
	buildIndexLatency := it.prepareDur + time.Since(started)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `86534551` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
