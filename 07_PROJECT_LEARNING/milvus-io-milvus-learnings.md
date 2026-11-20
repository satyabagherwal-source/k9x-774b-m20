> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/milvus-io-milvus-learnings.md`  
> **Source**: github ([https://github.com/milvus-io/milvus](https://github.com/milvus-io/milvus))  
> **Source Version**: `19ed1d67`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-20T16:56:42.712Z  
> **Learning ID**: `learn-github-milvus-io-milvus`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): milvus-io/milvus

> **Canonical Artifact**: `07_PROJECT_LEARNING/milvus-io-milvus-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/milvus-io/milvus](https://github.com/milvus-io/milvus))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-20T16:56:42.705Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `milvus-io/milvus`
- **Description**: Milvus is a high-performance, cloud-native vector database built for scalable vector ANN search
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 46707 stars

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
- **Issue #55758** (2026-11-20): **fix: [cp3.0] read external refresh task state from response properties**
  *Symptoms*: pr: #55708 issue: #55707  Cherry-pick `a0e4df5387` to `3.0`.  DataCoord reads `task_state` and `task_reason` from the worker's refresh query response properties. A failed task now reports its state and reason even when the payload is empty or contains a stale result. DataCoord reads segment changes from the payload only when the worker reports `Finished` and the payload confirms that state.  The regression test covers failed and retry responses with empty or stale payloads, in-progress responses with stale segment results, and validation of finished results.  On the unpatched 3.0 implementation, the two failure cases reproduced the bug: an empty payload returned `None` and a stale finished payload returned `Finished`. With this change, the full `internal/datacoord/session`, `internal/datacoord/externalrefresh`, and `internal/datacoord/task` unit test suites passed locally. 

- **Issue #55754** (2026-11-20): **enhance: [2.6] backport reliability, performance, and Azure CMEK updates**
  *Symptoms*: ## Summary - Backport fixes and enhancements for CDC partition loading, WAL coordination, segment loading, import cancellation, and query execution. - Improve storage and indexing performance, sparse index configuration, autoscale load checks, and resource handling. - Align the Azure Key Vault cipher plugin SDK and refresh build, CI, and dependency configuration.  ## Testing - Added and updated unit and integration coverage for CDC partition loading, CMEK, and related fixes. - Not run: no test results were provided.
  **Post-Mortem & Fix Analysis**:
  > [APPROVALNOTIFIER] This PR is **NOT APPROVED**  This pull-request has been approved by: To complete the [pull request process](https://git.k8s.io/community/contributors/guide/owners.md#the-code-review-process), please assign **foxspy** after the PR has been reviewed. You can assign the PR to them by writing `/assign @foxspy` in a comment when ready.  The full list of commands accepted by this bot can be found [here](https://go.k8s.io/bot-commands?repo=milvus-io%2Fmilvus).  <details open> Needs approval from an approver in each of these files:  - **[OWNERS](https://github.com/milvus-io/milvus/blob/master/OWNERS)**  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":["foxspy"]} -->
  > @XuanYang-cn Thanks for your contribution. Please submit with DCO, see the contributing guide https://github.com/milvus-io/milvus/blob/master/CONTRIBUTING.md#developer-certificate-of-origin-dco. 

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

### Incident Patch 1: `c31070a6` (2026-11-20)
**Commit Message**: fix: read external refresh task state from response properties (#55708)

Fixes #55707

Read `task_state` and `task_reason` from the worker's refresh query
response properties. A failure with an empty payload now reaches the
refresh task handler with its original reason. A stale payload can no
longer hide that failure.

For a finished task, DataCoord still needs the segment results from the
payload. It validates that the payload contains a finished result before
passing those results to the handler.

## Tests

- Added regression cases for empty and stale payloads, including a
reported failure with a stale finished result.
- Ran the DataCoord session, external refresh, and task scheduler
package tests.

Signed-off-by: cai.zhang <[REDACTED_EMAIL]>

**File**: `internal/datacoord/session/cluster.go` (modified, +17/-2)
```diff
@@ -941,12 +941,27 @@ func (c *cluster) QueryRefreshExternalCollectionTask(nodeID int64, taskID int64)
 		return nil, err
 	}
 
-	// Unmarshal the response payload
+	resProperties := taskcommon.NewProperties(resp.GetProperties())
+	state, err := resProperties.GetTaskState()
+	if err != nil {
+		return nil, err
+	}
+	reason := resProperties.GetTaskReason()
+	if state != taskcommon.Finished {
+		// Only a finished task needs segment results from the payload.
+		return &datapb.RefreshExternalCollectionTaskResponse{Status: resp.GetStatus(), State: state, FailReason: reason}, nil
+	}
+
 	result := &datapb.RefreshExternalCollectionTaskResponse{}
 	if err := proto.Unmarshal(resp.GetPayload(), result); err != nil {
 		return nil, err
 	}
-
+	// An empty payload decodes to None. Only a finished worker result can
+	// supply the segment changes that DataCoord will publish.
+	if result.GetState() != taskcommon.Finished {
+		return nil, merr.WrapErrServiceInternalMsg("finished refresh task %d has result payload in state %s", taskID, result.GetState())
+	}
+	result.FailReason = reason
 	return result, nil
 }
 
```

**File**: `internal/datacoord/session/cluster_test.go` (modified, +57/-0)
```diff
@@ -539,6 +539,63 @@ func TestCluster_QueryReshard(t *testing.T) {
 	})
 }
 
+func TestCluster_QueryRefreshExternalCollectionTask(t *testing.T) {
+	finished, err := proto.Marshal(&datapb.RefreshExternalCollectionTaskResponse{
+		State: taskcommon.Finished, KeptSegments: []int64{23},
+		UpdatedSegments: []*datapb.SegmentInfo{{ID: 42}},
+	})
+	require.NoError(t, err)
+	stale, err := proto.Marshal(&datapb.RefreshExternalCollectionTaskResponse{State: taskcommon.InProgress})
+	require.NoError(t, err)
+
+	for _, tc := range []struct {
+		name    string
+		state   string
+		reason  string
+		payload []byte
+		wantErr bool
+	}{
+		{"worker gone", taskcommon.Retry.String(), "worker is not exist", nil, false},
+		{"retry with stale payload", taskcommon.Retry.String(), "worker is not exist", stale, false},
+		{"failure without payload", taskcommon.Failed.String(), "invalid manifest", nil, false},
+		{"failure overrides stale result", taskcommon.Failed.String(), "invalid manifest", finished, false},
+		{"in progress with stale result", taskcommon.InProgress.String(), "", finished, false},
+		{"finished", taskcommon.Finished.String(), "", finished, false},
+		{"finished without result", taskcommon.Finished.String(), "", nil, true},
+		{"finished with invalid result", taskcommon.Finished.String(), "", []byte{0xff}, true},
+		{"finished with stale result", taskcommon.Finished.String(), "", stale, true},
+		{"unknown state", "unknown", "", finished, true},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			nm := NewMockNodeManager(t)
+			client := mocks.NewMockDataNodeClient(t)
+			nm.EXPECT().GetClient(int64(1)).Return(client, nil)
+			client.EXPECT().QueryTask(mock.Anything, mock.Anything).Return(&workerpb.QueryTaskResponse{
+				Status:     merr.Success(),
+				Properties: map[string]string{taskcommon.StateKey: tc.state, taskcommon.ReasonKey: tc.reason},
+				Payload:    tc.payload,
+			}, nil)
+			result, err := NewCluster(nm).QueryRefreshExternalCollectionTask(1, 1001)
+			if tc.wantErr {
+				require.Error(t, err)
+				require.Nil(t, result)
+				return
+			}
+			require.NoError(t, err)
+			require.Equal(t, tc.state, result.GetState().String())
+			require.Equal(t, tc.reason, result.GetFailReason())
+			if result.GetState() == taskcommon.Finished {
+				require.Equal(t, []int64{23}, result.GetKeptSegments())
+				require.Len(t, result.GetUpdatedSegments(), 1)
+				require.EqualValues(t, 42, result.GetUpdatedSegments()[0].GetID())
+			} else {
+				require.Empty(t, result.GetKeptSegments())
+				require.Empty(t, result.GetUpdatedSegments())
+			}
+		})
+	}
+}
+
 func TestCluster_QueryImportV3(t *testing.T) {
 	t.Run("retry verdict overrides stale in-progress payload", func(t *testing.T) {
 		mockNodeManager := NewMockNodeManager(t)
```

---

### Incident Patch 2: `15fc0773` (2026-11-20)
**Commit Message**: fix: Remove PyUDF supervisor thread-count assertions (#55456)

Remove Python and OS thread-count assertions from the supervisor test
probe while retaining pre-fork gRPC/PyArrow import checks. Update the
design documentation and comments to match.

Verified all 12 supervisor tests with jemalloc background threads
enabled locally; product-image validation remains pending.

Fixes #55336  #55335

Signed-off-by: junjie.jiang <[REDACTED_EMAIL]>

**File**: `docs/design-docs/design_docs/20260722-pyudf-function-chain.md` (modified, +16/-5)
```diff
@@ -137,9 +137,12 @@ is checked before creation; cancellation after creation does not stop Python.
 
 ### Python supervisor
 
-The supervisor stays single-threaded and does not import gRPC, PyArrow, or user
-models before `fork`. Runtime package exports are lazy so importing the
-supervisor does not initialize worker dependencies.
+The supervisor keeps a single Python thread and does not import gRPC, PyArrow,
+or user models before `fork`. Runtime package exports are lazy so importing the
+supervisor does not initialize worker dependencies. This does not require the
+whole process to have exactly one native OS thread: the product image's jemalloc
+allocator may create background threads. Its fork handling must be validated
+with worker startup, replacement, and shutdown tests in the image configuration.
 
 During fork, the supervisor blocks TERM/INT. Each child restores default signal
 handling and the previous signal mask, then imports and starts its worker.
@@ -173,7 +176,10 @@ Go process.
 Linux and macOS are the target platforms. macOS fork safety and port-reuse
 behavior require native validation; Linux test results do not establish macOS
 traffic distribution or throughput. The supervisor must remain free of
-background threads and worker-library initialization before every fork.
+additional Python threads and worker-library initialization before every fork.
+Tests check `threading.active_count() == 1`, dependency imports, and worker
+lifecycle behavior without imposing an OS thread-count limit. This does not
+establish fork safety for arbitrary threaded libraries.
 
 ## 4. Go client and connection reuse
 
@@ -755,7 +761,10 @@ The worker needs the runtime wheel and compatible user dependencies installed
 in that environment. Core CMake does not select this interpreter.
 
 The package currently pins PyArrow 23.0.1, grpcio and grpcio-health-checking
-1.74.0, and protobuf 6.31.1. The codegen extra pins grpcio-tools 1.74.0. Generated
+1.74.0, and protobuf 6.33.5. See
+[`pyproject.toml`](../../../internal/util/function/pyudf/python/pyproject.toml)
+for the authoritative runtime dependencies. The codegen extra pins
+grpcio-tools 1.74.0. Generated
 Python files ship in the runtime wheel; deployment needs no protoc or codegen
 extra. The user UDF wheel is a separate FileResource artifact loaded at Execute.
 
@@ -943,6 +952,8 @@ These are single-run local measurements, not a production capacity guarantee.
 The load generators and server ran on the same Linux host, with 48 logical CPUs
 visible to the benchmark. The environment used Python 3.12.13, grpcio 1.74.0,
 PyArrow 23.0.1, and protobuf 6.31.1.
+These versions describe the historical benchmark environment. For current
+runtime dependencies, see [Packaging and generated files](#13-packaging-and-generated-files).
 
 Both runs used the same workload and client settings:
 
```

**File**: `internal/util/function/pyudf/python/milvus_pyudf_runtime/supervisor.py` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@
 # See the License for the specific language governing permissions and
 # limitations under the License.
 
-"""Linux/macOS process supervision. Never import gRPC/PyArrow or start threads here."""
+"""Linux/macOS process supervision. Never import gRPC/PyArrow or start Python threads here."""
 
 from __future__ import annotations
 
```

**File**: `internal/util/function/pyudf/testdata/supervisor_probe.py` (modified, +0/-2)
```diff
@@ -46,8 +46,6 @@ class ProbeSupervisor(Supervisor):
     def _spawn(self, index, now):
         assert "grpc" not in sys.modules and "pyarrow" not in sys.modules
         assert threading.active_count() == 1
-        if sys.platform == "linux":
-            assert len(list(Path("/proc/self/task").iterdir())) == 1
         if mode == "partial_fork" and index == 1:
             raise OSError("injected fork failure")
         if (
```

---

### Incident Patch 3: `e7fa3979` (2026-11-20)
**Commit Message**: fix: count search nq before the rate limiter and the request registry read it (#55744)

issue: #55743, #55691

## What is wrong

The `nq` field of a search request is optional. The RESTful v2 handlers
and older clients leave it at 0, and the search task derives the real
value from the placeholder group later. Everything that read the field
before the task ran saw 0 for those requests:

- **Rate limiter** (#55743). `GetRequestInfo` charges a search `nq`
tokens and both callers skip a request that costs 0, so REST search and
hybrid search were never charged against
`quotaAndLimits.dql.searchRate`. A gRPC client could get the same result
by not declaring `nq`.
- **ListRunningRequests** (#55691) listed them with `nq: 0`.
- **`milvus_proxy_received_nq`** counted 0 for them.

## What changes

- `funcutil.CountPlaceholderGroupValues` counts the rows of a serialized
`PlaceholderGroup` by walking its wire format. It does not copy the
query vectors and does not allocate (about 7 ns per row, independent of
dimension; unmarshalling 10000 x 1536-dim float vectors takes about 9 ms
and 62 MB).
- `searchRequestNq` / `hybridSearchRequestNq` return the declared `nq`,
or, when it is 0, the rows of th

**File**: `internal/distributed/proxy/httpserver/utils_test.go` (modified, +21/-1)
```diff
@@ -138,6 +138,20 @@ func TestCheckLimiter_ChargedRequestsRemainRateLimited(t *testing.T) {
 	defer getPartition.UnPatch()
 
 	insert := &milvuspb.InsertRequest{DbName: "target", CollectionName: "collection", PartitionName: "partition"}
+	// The handlers build search requests without nq; they are charged by the
+	// rows of their placeholder group.
+	placeholder, err := proto.Marshal(&commonpb.PlaceholderGroup{Placeholders: []*commonpb.PlaceholderValue{
+		{Tag: "$0", Type: commonpb.PlaceholderType_FloatVector, Values: [][]byte{{0, 0, 0, 0}, {0, 0, 0, 0}, {0, 0, 0, 0}}},
+	}})
+	require.NoError(t, err)
+	search := &milvuspb.SearchRequest{
+		DbName: "target", CollectionName: "collection",
+		SearchInput: &milvuspb.SearchRequest_PlaceholderGroup{PlaceholderGroup: placeholder},
+	}
+	hybridSearch := &milvuspb.HybridSearchRequest{
+		DbName: "target", CollectionName: "collection",
+		Requests: []*milvuspb.SearchRequest{search, search},
+	}
 	testCases := []struct {
 		name     string
 		request  proto.Message
@@ -146,6 +160,8 @@ func TestCheckLimiter_ChargedRequestsRemainRateLimited(t *testing.T) {
 	}{
 		{"create collection", &milvuspb.CreateCollectionRequest{DbName: "target", CollectionName: "collection"}, internalpb.RateType_DDLCollection, 1},
 		{"insert", insert, internalpb.RateType_DMLInsert, proto.Size(insert)},
+		{"search", search, internalpb.RateType_DQLSearch, 3},
+		{"hybrid search", hybridSearch, internalpb.RateType_DQLSearch, 6},
 	}
 	for _, tc := range testCases {
 		t.Run(tc.name, func(t *testing.T) {
@@ -174,7 +190,11 @@ func TestCheckLimiter_ChargedRequestsRemainRateLimited(t *testing.T) {
 					assert.Equal(t, totalBefore+1, testutil.ToFloat64(total))
 					if rejected {
 						require.ErrorIs(t, err, merr.ErrServiceQuotaExceeded)
-						assert.NotNil(t, resp)
+						// GetFailedResponse has no response type for a hybrid
+						// search; the error alone carries the rejection.
+						if _, hybrid := tc.request.(*milvuspb.HybridSearchRequest); !hybrid {
+							assert.NotNil(t, resp)
+						}
 						assert.Equal(t, successBefore, testutil.ToFloat64(success))
 						assert.Equal(t, failBefore+1, testutil.ToFloat64(fail))
 					} else {
```

**File**: `internal/proxy/dql/search_util.go` (modified, +32/-25)
```diff
@@ -694,37 +694,44 @@ func getOutputFieldIDs(schema *schemaInfo, outputFields []string) (outputFieldID
 }
 
 func getNqFromSubSearch(req *milvuspb.SubSearchRequest) (int64, error) {
-	if req.GetNq() == 0 {
-		// keep compatible with older client version.
-		x := &commonpb.PlaceholderGroup{}
-		err := proto.Unmarshal(req.GetPlaceholderGroup(), x)
-		if err != nil {
-			return 0, merr.WrapErrParameterInvalidErr(err, "failed to unmarshal placeholder group for sub search")
-		}
-		total := int64(0)
-		for _, h := range x.GetPlaceholders() {
-			total += int64(len(h.Values))
-		}
-		return total, nil
-	}
-	return req.GetNq(), nil
+	return resolveNq(req.GetNq(), req.GetPlaceholderGroup(), "failed to unmarshal placeholder group for sub search")
 }
 
 func getNq(req *milvuspb.SearchRequest) (int64, error) {
-	if req.GetNq() == 0 {
-		// keep compatible with older client version.
-		x := &commonpb.PlaceholderGroup{}
-		err := proto.Unmarshal(req.GetPlaceholderGroup(), x)
-		if err != nil {
-			return 0, merr.WrapErrParameterInvalidErr(err, "failed to unmarshal placeholder group")
+	return resolveNq(req.GetNq(), req.GetPlaceholderGroup(), "failed to unmarshal placeholder group")
+}
+
+// resolveNq returns the number of query rows of a search. The placeholder
+// group is what the query nodes execute, so its row count is the answer; the
+// nq a client declares is optional (older clients and the RESTful API leave it
+// at 0) and has to agree with that count when both are present. A request
+// whose nq disagreed used to be forwarded and fail on a query node while
+// reducing results.
+//
+// A declared nq with no placeholder group at all is passed through unchanged:
+// that request carries nothing to search with and the query nodes refuse it.
+func resolveNq(declared int64, placeholderGroup []byte, malformedMsg string) (int64, error) {
+	if declared != 0 && len(placeholderGroup) == 0 {
+		return declared, nil
+	}
+	rows, err := funcutil.CountPlaceholderGroupValues(placeholderGroup)
+	if err != nil {
+		// Let the decoder name what is wrong with the bytes. Should it accept
+		// them after all, its count stands.
+		group := &commonpb.PlaceholderGroup{}
+		if err := proto.Unmarshal(placeholderGroup, group); err != nil {
+			return 0, merr.WrapErrParameterInvalidErr(err, "%s", malformedMsg)
 		}
-		total := int64(0)
-		for _, h := range x.GetPlaceholders() {
-			total += int64(len(h.Values))
+		rows = 0
+		for _, placeholder := range group.GetPlaceholders() {
+			rows += int64(len(placeholder.GetValues()))
 		}
-		return total, nil
 	}
-	return req.GetNq(), nil
+	if declared != 0 && declared != rows {
+		return 0, merr.WrapErrParameterInvalidMsg(
+			"nq %d does not match the %d query rows in the placeholder group", declared, rows)
+	}
+	return rows, nil
 }
 
 func GetPartitionIDs(ctx context.Context, metaCache Cache, dbName string, collectionName string, partitionNames []string) (partitionIDs []UniqueID, err error) {
```

**File**: `internal/proxy/dql/search_util_test.go` (modified, +45/-0)
```diff
@@ -103,6 +103,51 @@ func TestSearchTaskCheckNqCompatibility(t *testing.T) {
 	}
 }
 
+// A declared nq that disagrees with the placeholder group is refused by the
+// Proxy; it used to be forwarded and fail on a query node.
+func TestSearchTaskCheckNqMismatch(t *testing.T) {
+	placeholder, err := proto.Marshal(&commonpb.PlaceholderGroup{
+		Placeholders: []*commonpb.PlaceholderValue{
+			{Tag: "$0", Type: commonpb.PlaceholderType_FloatVector, Values: [][]byte{{0, 0, 0, 0}, {0, 0, 0, 0}}},
+		},
+	})
+	require.NoError(t, err)
+	for _, advanced := range []bool{false, true} {
+		for _, nq := range []int64{1, 3} {
+			request := &milvuspb.SearchRequest{
+				Nq:          nq,
+				SearchInput: &milvuspb.SearchRequest_PlaceholderGroup{PlaceholderGroup: placeholder},
+			}
+			if advanced {
+				request = ConvertHybridSearchToSearch(&milvuspb.HybridSearchRequest{
+					Requests: []*milvuspb.SearchRequest{request},
+				})
+			}
+			task := &SearchTask{
+				SearchRequest: &internalpb.SearchRequest{IsAdvanced: advanced},
+				request:       request,
+			}
+			_, err := task.checkNq(context.Background())
+			require.ErrorIs(t, err, merr.ErrParameterInvalid, "advanced=%v nq=%d", advanced, nq)
+			assert.Contains(t, err.Error(), "does not match the 2 query rows")
+		}
+	}
+
+	// A group the row counter refuses is judged by proto.Unmarshal, with its
+	// error: the counter alone never turns a request away.
+	invalidTag := []byte{0x0a, 0x03, 0x0a, 0x01, 0xff}
+	_, err = resolveNq(1, invalidTag, "failed to unmarshal placeholder group")
+	require.ErrorIs(t, err, merr.ErrParameterInvalid)
+	require.ErrorIs(t, err, proto.Error)
+	_, _, convertErr := ConvertPlaceholderGroup(invalidTag, &schemapb.FieldSchema{DataType: schemapb.DataType_FloatVector})
+	require.Error(t, convertErr, "the pre-existing decode refuses the same bytes")
+
+	// Nothing to compare a declared nq with: left to the query nodes, as before.
+	nq, err := resolveNq(4, nil, "unused")
+	require.NoError(t, err)
+	assert.Equal(t, int64(4), nq)
+}
+
 func TestConvertHybridSearchToSearchKeepsNamespace(t *testing.T) {
 	namespace := "tenant_a"
 
```

**File**: `internal/proxy/impl.go` (modified, +1/-1)
```diff
@@ -2712,7 +2712,7 @@ func (node *Proxy) search(ctx context.Context, request *milvuspb.SearchRequest,
 		metrics.SearchLabel,
 		request.GetDbName(),
 		request.GetCollectionName(),
-	).Add(float64(request.GetNq()))
+	).Add(float64(searchRequestNq(request)))
 
 	if err := merr.CheckHealthy(node.GetStateCode()); err != nil {
 		return &milvuspb.SearchResults{
```

**File**: `internal/proxy/request_registry.go` (modified, +2/-2)
```diff
@@ -159,7 +159,7 @@ func searchRequestInfo(request *milvuspb.SearchRequest) reqregistry.Info {
 		Type:           reqregistry.TypeSearch,
 		DBName:         request.GetDbName(),
 		CollectionName: request.GetCollectionName(),
-		NQ:             request.GetNq(),
+		NQ:             searchRequestNq(request),
 		TopK:           kvInt64(request.GetSearchParams(), common.TopKKey, LimitKey),
 		Expr:           request.GetDsl(),
 	}
@@ -169,7 +169,7 @@ func hybridSearchRequestInfo(request *milvuspb.HybridSearchRequest) reqregistry.
 	var nq, topk int64
 	expr := ""
 	for _, sub := range request.GetRequests() {
-		nq += sub.GetNq()
+		nq += searchRequestNq(sub)
 		if k := kvInt64(sub.GetSearchParams(), common.TopKKey, LimitKey); k > topk {
 			topk = k
 		}
```

**File**: `internal/proxy/request_registry_test.go` (modified, +60/-0)
```diff
@@ -31,12 +31,15 @@ import (
 	"github.com/stretchr/testify/mock"
 	"github.com/stretchr/testify/require"
 	"google.golang.org/grpc/peer"
+	"google.golang.org/protobuf/proto"
 
 	"github.com/milvus-io/milvus-proto/go-api/v3/commonpb"
 	"github.com/milvus-io/milvus-proto/go-api/v3/milvuspb"
+	"github.com/milvus-io/milvus-proto/go-api/v3/schemapb"
 	"github.com/milvus-io/milvus/internal/mocks"
 	"github.com/milvus-io/milvus/internal/proxy/reqregistry"
 	"github.com/milvus-io/milvus/pkg/v3/metrics"
+	"github.com/milvus-io/milvus/pkg/v3/proto/internalpb"
 	"github.com/milvus-io/milvus/pkg/v3/util/merr"
 	"github.com/milvus-io/milvus/pkg/v3/util/paramtable"
 )
@@ -45,6 +48,63 @@ func kv(key, value string) *commonpb.KeyValuePair {
 	return &commonpb.KeyValuePair{Key: key, Value: value}
 }
 
+// A search that does not declare nq is counted by what it carries, both for the
+// registry and for the rate limiter.
+func TestSearchRequestNq(t *testing.T) {
+	placeholder := func(rows int) *milvuspb.SearchRequest_PlaceholderGroup {
+		values := make([][]byte, rows)
+		for i := range values {
+			values[i] = []byte{0, 0, 0, 0}
+		}
+		blob, err := proto.Marshal(&commonpb.PlaceholderGroup{Placeholders: []*commonpb.PlaceholderValue{
+			{Tag: "$0", Type: commonpb.PlaceholderType_FloatVector, Values: values},
+		}})
+		require.NoError(t, err)
+		return &milvuspb.SearchRequest_PlaceholderGroup{PlaceholderGroup: blob}
+	}
+	intIDs := &milvuspb.SearchRequest_Ids{Ids: &schemapb.IDs{
+		IdField: &schemapb.IDs_IntId{IntId: &schemapb.LongArray{Data: []int64{1, 2, 3, 4}}},
+	}}
+
+	assert.Equal(t, int64(0), searchRequestNq(&milvuspb.SearchRequest{}))
+	assert.Equal(t, int64(3), searchRequestNq(&milvuspb.SearchRequest{SearchInput: placeholder(3)}))
+	assert.Equal(t, int64(4), searchRequestNq(&milvuspb.SearchRequest{SearchInput: intIDs}))
+	// a declared nq is taken as it is; the search task checks it
+	assert.Equal(t, int64(7), searchRequestNq(&milvuspb.SearchRequest{Nq: 7, SearchInput: placeholder(3)}))
+	// a malformed group is the search task's to refuse
+	assert.Equal(t, int64(0), searchRequestNq(&milvuspb.SearchRequest{
+		SearchInput: &milvuspb.SearchRequest_PlaceholderGroup{PlaceholderGroup: []byte{0xff}},
+	}))
+
+	hybrid := &milvuspb.HybridSearchRequest{Requests: []*milvuspb.SearchRequest{
+		{SearchInput: placeholder(2)},
+		{Nq: 5, SearchInput: placeholder(5)},
+	}}
+	assert.Equal(t, int64(7), hybridSearchRequestNq(hybrid))
+
+	assert.Equal(t, int64(3), searchRequestInfo(&milvuspb.SearchRequest{SearchInput: placeholder(3)}).NQ)
+	assert.Equal(t, int64(4), searchRequestInfo(&milvuspb.SearchRequest{SearchInput: intIDs}).NQ)
+	assert.Equal(t, int64(7), hybridSearchRequestInfo(hybrid).NQ)
+
+	// The limiter skips a request that costs 0 tokens, so these have to cost
+	// their rows.
+	cache := NewMockCache(t)
+	cache.EXPECT().GetDatabaseInfo(mock.Anything, mock.Anything).Return(&databaseInfo{DBID: 100}, nil)
+	cache.EXPECT().GetCollectionID(mock.Anything, mock.Anything, mock.Anything).Return(int64(1), nil)
+	_, _, rt, tokens, err := GetRequestInfo(context.Background(), cache, &milvuspb.SearchRequest{
+		DbName: "db", CollectionName: "c", SearchInput: placeholder(3),
+	})
+	require.NoError(t, err)
+	assert.Equal(t, internalpb.RateType_DQLSearch, rt)
+	assert.Equal(t, 3, tokens)
+	_, _, rt, tokens, err = GetRequestInfo(context.Background(), cache, &milvuspb.HybridSearchRequest{
+		DbName: "db", CollectionName: "c", Requests: hybrid.GetRequests(),
+	})
+	require.NoError(t, err)
+	assert.Equal(t, internalpb.RateType_DQLSearch, rt)
+	assert.Equal(t, 7, tokens)
+}
+
 func TestRequestInfoExtraction(t *testing.T) {
 	t.Run("search", func(t *testing.T) {
 		info := searchRequestInfo(&milvuspb.SearchRequest{
```

**File**: `internal/proxy/util.go` (modified, +34/-6)
```diff
@@ -2305,6 +2305,38 @@ func GetStorageCost(status *commonpb.Status) (int64, int64, float64, bool) {
 	return scannedRemoteBytes, scannedTotalBytes, cacheHitRatio, true
 }
 
+// searchRequestNq returns the number of query rows of a search request as it
+// arrives, before any task has looked at it. The nq field is optional -- older
+// clients and the RESTful API leave it at 0 -- so a request that does not
+// declare it is counted by what it carries: the rows of its placeholder group,
+// or its primary keys when it searches by primary key. Reading the field alone
+// lets such a request through the rate limiter uncharged and lists it with
+// nq 0.
+//
+// A malformed placeholder group counts as 0 here; the search task rejects it.
+func searchRequestNq(req *milvuspb.SearchRequest) int64 {
+	if nq := req.GetNq(); nq != 0 {
+		return nq
+	}
+	if ids := req.GetIds(); ids != nil {
+		return int64(typeutil.GetSizeOfIDs(ids))
+	}
+	rows, err := funcutil.CountPlaceholderGroupValues(req.GetPlaceholderGroup())
+	if err != nil {
+		return 0
+	}
+	return rows
+}
+
+// hybridSearchRequestNq is searchRequestNq summed over the sub-requests.
+func hybridSearchRequestNq(req *milvuspb.HybridSearchRequest) int64 {
+	var nq int64
+	for _, sub := range req.GetRequests() {
+		nq += searchRequestNq(sub)
+	}
+	return nq
+}
+
 // GetRequestInfo returns the quota scope, rate type, and tokens needed by a request.
 // Zero tokens bypass rate limiting and its metrics; the rate type is unused in that case.
 func GetRequestInfo(ctx context.Context, metaCache Cache, req proto.Message) (int64, map[int64][]int64, internalpb.RateType, int, error) {
@@ -2326,14 +2358,10 @@ func GetRequestInfo(ctx context.Context, metaCache Cache, req proto.Message) (in
 		return dbID, collToPartIDs, internalpb.RateType_DMLBulkLoad, proto.Size(r), err
 	case *milvuspb.SearchRequest:
 		dbID, collToPartIDs, err := getCollectionAndPartitionIDs(ctx, metaCache, req.(reqPartNames))
-		return dbID, collToPartIDs, internalpb.RateType_DQLSearch, int(r.GetNq()), err
+		return dbID, collToPartIDs, internalpb.RateType_DQLSearch, int(searchRequestNq(r)), err
 	case *milvuspb.HybridSearchRequest:
 		dbID, collToPartIDs, err := getCollectionAndPartitionIDs(ctx, metaCache, req.(reqPartNames))
-		nq := 0
-		for _, subReq := range r.GetRequests() {
-			nq += int(subReq.GetNq())
-		}
-		return dbID, collToPartIDs, internalpb.RateType_DQLSearch, nq, err
+		return dbID, collToPartIDs, internalpb.RateType_DQLSearch, int(hybridSearchRequestNq(r)), err
 	case *milvuspb.QueryRequest:
 		dbID, collToPartIDs, err := getCollectionAndPartitionIDs(ctx, metaCache, req.(reqPartNames))
 		return dbID, collToPartIDs, internalpb.RateType_DQLQuery, 1, err // think of the query request's nq as 1
```

**File**: `pkg/util/funcutil/placeholdergroup_count.go` (added, +93/-0)
```diff
@@ -0,0 +1,93 @@
+package funcutil
+
+import (
+	"unicode/utf8"
+
+	"google.golang.org/protobuf/encoding/protowire"
+
+	"github.com/milvus-io/milvus/pkg/v3/util/merr"
+)
+
+// Field numbers of commonpb.PlaceholderGroup and commonpb.PlaceholderValue.
+const (
+	placeholderGroupPlaceholdersField protowire.Number = 1
+	placeholderValueTagField          protowire.Number = 1
+	placeholderValueValuesField       protowire.Number = 3
+)
+
+// CountPlaceholderGroupValues returns the number of query rows carried by a
+// serialized commonpb.PlaceholderGroup, summed over its placeholders. It is
+// the same number as unmarshalling the group and adding up len(Values), but it
+// walks the wire format and never copies a row, so it costs a few nanoseconds
+// per row and does not allocate.
+//
+// It rejects every input proto.Unmarshal rejects, so it can stand in for the
+// unmarshal as the first check on a group that came from a client.
+func CountPlaceholderGroupValues(blob []byte) (int64, error) {
+	var total int64
+	for len(blob) > 0 {
+		num, typ, n := protowire.ConsumeTag(blob)
+		if n < 0 || num > protowire.MaxValidNumber {
+			return 0, errMalformedPlaceholderGroup()
+		}
+		blob = blob[n:]
+		if num != placeholderGroupPlaceholdersField || typ != protowire.BytesType {
+			if n = protowire.ConsumeFieldValue(num, typ, blob); n < 0 {
+				return 0, errMalformedPlaceholderGroup()
+			}
+			blob = blob[n:]
+			continue
+		}
+		placeholder, n := protowire.ConsumeBytes(blob)
+		if n < 0 {
+			return 0, errMalformedPlaceholderGroup()
+		}
+		blob = blob[n:]
+		count, err := countPlaceholderValues(placeholder)
+		if err != nil {
+			return 0, err
+		}
+		total += count
+	}
+	return total, nil
+}
+
+func countPlaceholderValues(placeholder []byte) (int64, error) {
+	var count int64
+	for len(placeholder) > 0 {
+		num, typ, n := protowire.ConsumeTag(placeholder)
+		if n < 0 || num > protowire.MaxValidNumber {
+			return 0, errMalformedPlaceholderGroup()
+		}
+		placeholder = placeholder[n:]
+		if typ != protowire.BytesType || (num != placeholderValueTagField && num != placeholderValueValuesField) {
+			if n = protowire.ConsumeFieldValue(num, typ, placeholder); n < 0 {
+				return 0, errMalformedPlaceholderGroup()
+			}
+			placeholder = placeholder[n:]
+			continue
+		}
+		value, n := protowire.ConsumeBytes(placeholder)
+		if n < 0 {
+			return 0, errMalformedPlaceholderGroup()
+		}
+		placeholder = placeholder[n:]
+		if num == placeholderValueValuesField {
+			count++
+		} else if !utf8.Valid(value) {
+			// tag is a proto3 string, and proto.Unmarshal refuses one that is
+			// not valid UTF-8. This check only keeps the two in agreement; it
+			// does not turn away a search that used to run. The Proxy has
+			// always unmarshalled the group of every search
+			// (ConvertPlaceholderGroup), so such a request was already
+			// refused there, and the search task falls back to
+			// proto.Unmarshal whenever this function reports an error.
+			return 0, errMalformedPlaceholderGroup()
+		}
+	}
+	return count, nil
+}
+
+func errMalformedPlaceholderGroup() error {
+	return merr.WrapErrParameterInvalidMsg("malformed placeholder group")
+}
```

#### Recent Merged Pull Requests:
- **PR #55758** (2026-11-20): fix: [cp3.0] read external refresh task state from response properties (@xiaocai2333)
- **PR #55754** (closed): enhance: [2.6] backport reliability, performance, and Azure CMEK updates (@XuanYang-cn)
- **PR #55752** (closed): build: update documented compiler requirements for macOS LLVM 14-21 (@yhmo)
- **PR #55751** (2026-11-20): enhance: [cp3.0] simplify external import storage validation and share per-task source clients (@xaxys)
- **PR #55744** (2026-11-20): fix: count search nq before the rate limiter and the request registry read it (@czs007)
- **PR #55708** (2026-11-20): fix: read external refresh task state from response properties (@xiaocai2333)

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

## X. read external refresh task state from response properties

**RULE**:
When implementing operations in `internal/datacoord/session/cluster.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in milvus-io/milvus. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c31070a6`: read external refresh task state from response properties. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `internal/datacoord/session/cluster.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	resProperties := taskcommon.NewProperties(resp.GetProperties())
	state, err := resProperties.GetTaskState()
	if err != nil {
		return nil, err
	}
	reason := resProperties.GetTaskReason()
	if state != taskcommon.Finished {
		// Only a finished task needs segment results from the payload.
		return &datapb.RefreshExternalCollectionTaskResponse{Status: resp.GetStatus(), State: state, FailReason: reason}, nil
	}

	// An empty payload decodes to None. Only a finished worker result can
	// supply the segment changes that DataCoord will publish.
	if result.GetState() != taskcommon.Finished {
		return nil, merr.WrapErrServiceInternalMsg("finished refresh task %d has result payload in state %s", taskID, result.GetState())
	}
	result.FailReason = reason
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
	// Unmarshal the response payload

```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `c31070a6` are properly handled with clean fallback behavior.
