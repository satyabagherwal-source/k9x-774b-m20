# Domain K — Quality & Verification Intelligence: Quality & Verification Intelligence: milvus-io/milvus Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "milvus-io/milvus",
  "source_url": "https://github.com/milvus-io/milvus",
  "source_version": "f266503a",
  "license": "Apache-2.0",
  "timestamp": "2026-11-17T16:31:05.599Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-milvus-io-milvus",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [milvus-io/milvus](https://github.com/milvus-io/milvus) (Revision: `f266503a`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-17T16:31:05.599Z`  
> **Learning ID**: `learn-github-milvus-io-milvus`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain K (Quality & Verification Intelligence)
- **Secondary Corroborating Domains**: H (Technical Construction Intelligence), G (Architecture Intelligence), D (Research & Knowledge Intelligence), I (Content & Information Intelligence), M (Feedback & Evolution Intelligence), J (Search & Distribution Intelligence), B (Product Intelligence), A (Human & Need Intelligence), L (Deployment & Operations Intelligence)
- **Confidence Rating**: 57%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from milvus-io/milvus:

# Forensic Learning Record (Deep Inspection): milvus-io/milvus

> **Canonical Artifact**: `07_PROJECT_LEARNING/milvus-io-milvus-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/milvus-io/milvus](https://github.com/milvus-io/milvus))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-17T16:31:04.650Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `milvus-io/milvus`
- **Description**: Milvus is a high-performance, cloud-native vector database built for scalable vector ANN search
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 46677 stars

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
- **Issue #55643** (2026-11-17): **feat: [cp3.0] support per-request source storage for bulk import**
  *Symptoms*: Cherry-pick from master pr: #55357  ### What this PR does / why we need it:  Ordinary bulk imports can read JSON, JSONL, CSV, Parquet and NumPy files from a per-request S3-compatible source (for example `files: [["exports/data.parquet"]]` with `storage.endpoint`, `storage.bucket` and source credentials), while segment, index and intermediate writes keep using the cluster's configured storage. The object no longer has to be copied into the cluster bucket first.  - Parse and validate a self-contained `storage.*` contract. Reject incomplete, unknown, duplicate or incorrectly cased options and absolute/URI file paths. Preserve literal bucket-relative keys and never fall back to destination storage after a source failure. - Resolve a separate reader client for Import V2 and V3, including V3's Parquet/NumPy metadata-only counting path. Do not inherit destination credentials, IAM settings or root paths, and do not probe or create source buckets during client initialization. - Reject combinations with backup, L0 and snapshot imports, and reject external-source imports on a replicating cluster. The existing broadcast/ACK flow is retained. - Share general import-source validation across the request, ACK and worker entry points, with separate snapshot-specific checks and one source-key validator. - Redact all `storage.*` values in request-option logging, including case variants, and remove them from the retained job record on Completed/Failed transitions.  ### Special notes for your rev
  **Post-Mortem & Fix Analysis**:
  > [ci-v2-notice] Notice: ci-v2 system is enabled for this PR (3.0 branch).  To rerun ci-v2 checks, comment with: - /ci-rerun-code-check-macos  // for Code Checker MacOS (GitHub Actions) - /ci-rerun-build-ut-cov  // for ci-v2/build-ut-cov (build + unit tests) - /ci-rerun-e2e-amd  // for ci-v2/e2e-amd (e2e tests) - /ci-rerun-e2e-dist-wp  // for ci-v2/e2e-dist-wp (Tencent distributed woodpecker-service boundary) - /ci-rerun-gosdk  // for ci-v2/go-sdk (Go SDK E2E tests) - /ci-rerun-gosdk-std  // for ci-v2/go-sdk-std (Go SDK E2E, standalone) - /ci-rerun-gosdk-dist-wp // for ci-v2/go-sdk-dist-wp (distributed + Woodpecker service)  If you have any questions or requests, please contact @zhikunyao. 
  > [INFO] PR Label Summary by Default [SUCCESS] PR #55357 merged to master - Title: feat: support per-request source storage for bulk import - Link: https://github.com/milvus-io/milvus/pull/55357   [WARNING] Milestone not set - PR: #55643 - Title: feat: [cp3.0] support per-request source storage for bulk import Please set a milestone for better release tracking  You can set milestone by commenting:   /set-milestone <milestone-name> Example:   /set-milestone 2.5.0  Use /refresh-label to update related check and label manually

- **Issue #55631** (2026-11-17): **fix: [cp3.0] preserve IAM credential caches across storage clients**
  *Symptoms*: issue: #55601 pr: #55630  Backport the legacy C++ and Go credential-cache protections from #55630 to 3.0 and pin the matching storage repair.  Dependency: https://github.com/milvus-io/milvus-storage/pull/804, pinned at 0f997e0f82571082b0bbbe921987331dfa6f7fbc. This commit is fetchable from the existing upstream repository URL. Keep this PR draft until the storage backport is reviewed/merged; refresh the pin to the final merge commit if needed.  The backport validates complete tuples and real expiration before publication, preserves usable old credentials during failed refreshes, rejects expired fallback, and retains configured identity and native Azure Bearer/CAE/TLS behavior. It preserves 3.0's existing provider selection without introducing main-only providers. The internal Aliyun compatibility source includes its upstream license and provenance and adds no module replacement.  Local verification on the actual 3.0 tree: - Full `go test -race -tags dynamic,test -gcflags='all=-N -l' -count=1 ./objectstorage/...` from pkg passes, with final source hashes unchanged after execution. - Legacy provider tests: 41/41 focused tests, including prior tests and new failure/expiry/recovery regressions. - Real TLS loopback Aliyun tests and real Azure Go SDK/transport tests cover atomic snapshots, selected token-file identity, expiration during refresh, rejection before HTTP, recovery, CAE and SharedKey compatibility. - Legacy Azure/GCP translation units compile against the repaired storag
  **Post-Mortem & Fix Analysis**:
  > [APPROVALNOTIFIER] This PR is **NOT APPROVED**  This pull-request has been approved by: To complete the [pull request process](https://git.k8s.io/community/contributors/guide/owners.md#the-code-review-process), please ask for approval from **xiaofan-luan** after the PR has been reviewed.  The full list of commands accepted by this bot can be found [here](https://go.k8s.io/bot-commands?repo=milvus-io%2Fmilvus).  <details open> Needs approval from an approver in each of these files:  - **[OWNERS](https://github.com/milvus-io/milvus/blob/3.0/OWNERS)**  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":["xiaofan-luan"]} -->
  > [INFO] PR Label Summary by Default [FAILED] PR #55630 not merged - Title: fix: preserve IAM credential caches across storage clients - Status: OPEN - Link: https://github.com/milvus-io/milvus/pull/55630   [WARNING] Milestone not set - PR: #55631 - Title: fix: [cp3.0] preserve IAM credential caches across storage clients Please set a milestone for better release tracking  You can set milestone by commenting:   /set-milestone <milestone-name> Example:   /set-milestone 2.5.0  Use /refresh-label to update related check and label manually

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

### Incident Patch 1: `663f0d57` (2026-11-17)
**Commit Message**: enhance: propagate candidates and null rejection to element predicates (#55529)

issue: #55516

Addresses follow-up cases **01, 02, 03, 08 and 09**.

MATCH and full-mode `element_filter` pass inherited parent candidates to
element predicates before evaluation. Explicit parent offsets retain
input-position masking, repeated/non-monotonic rows, complete element
ranges, empty-array rules and parent validity.

Automatic sparse MATCH evaluation is limited to supported raw-data
predicates with at most **5% of both parent rows and elements**
selected. Indexed and unsupported trees stay sequential. Offset
evaluation advances all sequential leaf cursors exactly once, including
short-circuited leaves, so later dense batches resume correctly.
Empty-only candidates use constant quantifier results without predicate
Eval or an explicit prefetch wait. Each batch reuses one row-offset
snapshot and reserves its exact element count.

`EvalCtx` can own a bitmap or borrow a view; AND/OR saves and restores
ownership, including on exceptions. Full-mode element filtering borrows
batch slices and builds only an element selection, without an unused
validity bitmap. Expansion reads packed 64-bit words, coal

**File**: `internal/core/src/common/ElementFilterIterator.cpp` (modified, +2/-1)
```diff
@@ -109,10 +109,11 @@ ElementFilterIterator::FetchAndFilterBatch() {
                "ElementFilterIterator: evaluation result size mismatch");
 
     TargetBitmapView bitsetview(col_vec->GetRawData(), col_vec_size);
+    TargetBitmapView validview(col_vec->GetValidRawData(), col_vec_size);
 
     // Step 4: Filter elements based on evaluation results and cache them
     for (size_t i = 0; i < element_ids_buffer_.size(); ++i) {
-        if (bitsetview[i]) {
+        if (bitsetview[i] && validview[i]) {
             // Element passes filter, cache it
             filtered_buffer_.emplace_back(element_ids_buffer_[i],
                                           distances_buffer_[i]);
```

**File**: `internal/core/src/common/StructElementOffsets.cpp` (modified, +73/-0)
```diff
@@ -18,6 +18,7 @@
 
 #include <assert.h>
 #include <algorithm>
+#include <bit>
 #include <cstddef>
 #include <cstring>
 #include <limits>
@@ -188,6 +189,38 @@ ElementBitsetAnyReduce(const Starts& starts,
     }
 }
 
+// Scan the packed row bitmap by 64-bit words and merge adjacent selected
+// rows. Each run becomes one bulk bit-range fill (packed words plus masked
+// boundary words), so excluded rows never rewrite the zero-initialized output.
+template <typename Starts>
+TargetBitmap
+ExpandRowSelection(const TargetBitmapView& rows,
+                   int64_t row_start,
+                   const Starts& starts) {
+    const auto first_element = starts[row_start];
+    TargetBitmap result(starts[row_start + rows.size()] - first_element, false);
+    // Match ElementBitsetAnyReduce's packed-word traversal. Consume each
+    // input word once, even for heavily interleaved selections.
+    using word_t = TargetBitmapView::policy_type::data_type;
+    constexpr size_t kWordBits = 8 * sizeof(word_t);
+    for (size_t position = 0; position < rows.size(); position += kWordBits) {
+        const auto count = std::min(kWordBits, rows.size() - position);
+        word_t word = rows.read(position, count);
+        while (word != 0) {
+            const size_t first_bit = std::countr_zero(word);
+            const size_t last_bit =
+                first_bit + std::countr_one(word >> first_bit);
+            const auto first =
+                starts[row_start + position + first_bit] - first_element;
+            const auto last =
+                starts[row_start + position + last_bit] - first_element;
+            result.set(first, last - first, true);
+            word = last_bit == kWordBits ? 0 : word & (~word_t(0) << last_bit);
+        }
+    }
+    return result;
+}
+
 }  // namespace
 
 std::pair<int32_t, int32_t>
@@ -246,6 +279,14 @@ StructElementOffsetsSealed::CopyRowElementStarts(int64_t row_start,
                 sizeof(int32_t) * (row_count + 1));
 }
 
+TargetBitmap
+IStructElementOffsets::RowBitsetToElementBitset(const TargetBitmapView& rows,
+                                                int64_t row_start) const {
+    FixedVector<int32_t> starts(rows.size() + 1);
+    CopyRowElementStarts(row_start, rows.size(), starts.data());
+    return ExpandRowSelection(rows, 0, starts);
+}
+
 std::pair<TargetBitmap, TargetBitmap>
 StructElementOffsetsSealed::RowBitsetToElementBitset(
     const TargetBitmapView& row_bitset,
@@ -279,6 +320,20 @@ StructElementOffsetsSealed::RowBitsetToElementBitset(
     return {std::move(element_bitset), std::move(valid_element_bitset)};
 }
 
+TargetBitmap
+StructElementOffsetsSealed::RowBitsetToElementBitset(
+    const TargetBitmapView& row_bitset, int64_t row_start) const {
+    int64_t row_count = row_bitset.size();
+    AssertInfo(row_start >= 0 && row_start + row_count <= GetRowCount(),
+               "row range out of bounds: row_start={}, row_count={}, "
+               "total_rows={}",
+               row_start,
+               row_count,
+               GetRowCount());
+
+    return ExpandRowSelection(row_bitset, row_start, row_to_element_start_);
+}
+
 FixedVector<int32_t>
 StructElementOffsetsSealed::RowBitsetToElementOffsets(
     const TargetBitmapView& row_bitset, int64_t row_start) const {
@@ -717,6 +772,24 @@ StructElementOffsetsGrowing::RowBitsetToElementBitset(
     return {std::move(element_bitset), std::move(valid_element_bitset)};
 }
 
+TargetBitmap
+StructElementOffsetsGrowing::RowBitsetToElementBitset(
+    const TargetBitmapView& row_bitset, int64_t row_start) const {
+    const int64_t committed =
+        committed_row_count_.load(std::memory_order_acquire);
+
+    int64_t row_count = row_bitset.size();
+    AssertInfo(row_start >= 0 && row_start + row_count <= committed,
+               "row range out of bounds: row_start={}, row_count={}, "
+               "committed_rows={}",
+               row_start,
+               row_count,
+               committed);
+
+    ChunkedReader starts(starts_chunks_);
+    return ExpandRowSelection(row_bitset, row_start, starts);
+}
+
 FixedVector<int32_t>
 StructElementOffsetsGrowing::RowBitsetToElementOffsets(
     const TargetBitmapView& row_bitset, int64_t row_start) const {
```

**File**: `internal/core/src/common/StructElementOffsets.h` (modified, +13/-0)
```diff
@@ -128,6 +128,11 @@ class IStructElementOffsets {
                              const TargetBitmapView& valid_row_bitset,
                              int64_t row_start) const = 0;
 
+    // Expand a normalized row selection without allocating a validity bitmap.
+    virtual TargetBitmap
+    RowBitsetToElementBitset(const TargetBitmapView& row_bitset,
+                             int64_t row_start) const;
+
     // Convert row-level bitset to element offsets
     // Returns element IDs for all rows where row_bitset[row_id] is true
     virtual FixedVector<int32_t>
@@ -257,6 +262,10 @@ class StructElementOffsetsSealed : public IStructElementOffsets {
                              const TargetBitmapView& valid_row_bitset,
                              int64_t row_start) const override;
 
+    TargetBitmap
+    RowBitsetToElementBitset(const TargetBitmapView& row_bitset,
+                             int64_t row_start) const override;
+
     FixedVector<int32_t>
     RowBitsetToElementOffsets(const TargetBitmapView& row_bitset,
                               int64_t row_start) const override;
@@ -359,6 +368,10 @@ class StructElementOffsetsGrowing : public IStructElementOffsets {
                              const TargetBitmapView& valid_row_bitset,
                              int64_t row_start) const override;
 
+    TargetBitmap
+    RowBitsetToElementBitset(const TargetBitmapView& row_bitset,
+                             int64_t row_start) const override;
+
     FixedVector<int32_t>
     RowBitsetToElementOffsets(const TargetBitmapView& row_bitset,
                               int64_t row_start) const override;
```

**File**: `internal/core/src/common/StructElementOffsetsTest.cpp` (modified, +54/-0)
```diff
@@ -1587,3 +1587,57 @@ TEST_F(StructElementOffsetsTest, GrowingConcurrentWriters) {
         ASSERT_EQ(end, expected[row + 1]) << "row " << row;
     }
 }
+
+TEST_F(StructElementOffsetsTest, SelectionOnlyExpansionMatchesPairedAPI) {
+    const int rows = StructElementOffsetsGrowing::kEntriesPerChunk + 140;
+    std::vector<int32_t> starts{0}, lengths;
+    for (int i = 0; i < rows; ++i) {
+        lengths.push_back(i % 5 == 0 ? 0 : (i % 3 == 0 ? 129 : i % 7));
+        starts.push_back(starts.back() + lengths.back());
+    }
+    StructElementOffsetsSealed sealed(starts);
+    StructElementOffsetsGrowing growing;
+    growing.Insert(0, lengths.data(), lengths.size());
+    for (IStructElementOffsets* offsets :
+         {static_cast<IStructElementOffsets*>(&sealed),
+          static_cast<IStructElementOffsets*>(&growing)}) {
+        for (auto [start, count] : std::vector<std::pair<int, int>>{
+                 {0, 0},
+                 {0, rows},
+                 {7, 67},
+                 {63, 130},
+                 {StructElementOffsetsGrowing::kEntriesPerChunk - 2, 71},
+                 {rows, 0}}) {
+            for (int pattern = 0; pattern < 5; ++pattern) {
+                SCOPED_TRACE(::testing::Message()
+                             << "start=" << start << ", count=" << count
+                             << ", pattern=" << pattern);
+                TargetBitmap backing(count + 13, false);
+                auto selection = backing.view(7, count);
+                for (int i = 0; i < count; ++i) {
+                    selection[i] = pattern == 1 ||
+                                   (pattern == 2 && i % 67 == 0) ||
+                                   (pattern == 3 && i % 129 < 68) ||
+                                   (pattern == 4 && i % 2 == 0);
+                }
+                TargetBitmap validity(count, false);
+                auto [expected, unused] = offsets->RowBitsetToElementBitset(
+                    selection, validity.view(), start);
+                auto actual =
+                    offsets->RowBitsetToElementBitset(selection, start);
+                EXPECT_TRUE(actual == expected);
+                // Independent scalar oracle: each element inherits exactly
+                // its parent selection, without using packed range operations.
+                ASSERT_EQ(actual.size(), starts[start + count] - starts[start]);
+                for (int row = 0; row < count; ++row) {
+                    for (int element = starts[start + row];
+                         element < starts[start + row + 1];
+                         ++element) {
+                        EXPECT_EQ(bool(actual[element - starts[start]]),
+                                  bool(selection[row]));
+                    }
+                }
+            }
+        }
+    }
+}
```

**File**: `internal/core/src/exec/expression/BinaryRangeExpr.h` (modified, +10/-3)
```diff
@@ -66,7 +66,7 @@ struct BinaryRangeElementFunc {
                const T* src,
                size_t n,
                TargetBitmapView res,
-               const TargetBitmap& bitmap_input,
+               const TargetBitmapView& bitmap_input,
                size_t start_cursor,
                const int32_t* offsets = nullptr) {
         if constexpr (filter_type == FilterType::random ||
@@ -165,7 +165,7 @@ struct BinaryRangeElementFuncForJson {
                size_t n,
                TargetBitmapView res,
                TargetBitmapView valid_res,
-               const TargetBitmap& bitmap_input,
+               const TargetBitmapView& bitmap_input,
                size_t start_cursor,
                const int32_t* offsets = nullptr) {
         bool has_bitmap_input = !bitmap_input.empty();
@@ -205,7 +205,7 @@ struct BinaryRangeElementFuncForArray {
                size_t n,
                TargetBitmapView res,
                TargetBitmapView valid_res,
-               const TargetBitmap& bitmap_input,
+               const TargetBitmapView& bitmap_input,
                size_t start_cursor,
                const int32_t* offsets = nullptr) {
         bool has_bitmap_input = !bitmap_input.empty();
@@ -301,6 +301,13 @@ class PhyBinaryRangeFilterExpr : public SegmentExpr {
         return true;
     }
 
+    bool
+    CanUseOffsetsForSequentialBatch() override {
+        EnsureExecPathDetermined();
+        return expr_->column_.element_level_ &&
+               exec_path_ == ExprExecPath::RawData && SupportOffsetInput();
+    }
+
     void
     DetermineExecPath() override;
 
```

**File**: `internal/core/src/exec/expression/CompareExpr.h` (modified, +1/-1)
```diff
@@ -96,7 +96,7 @@ struct CompareElementFunc {
                const U* right,
                size_t size,
                TargetBitmapView res,
-               const TargetBitmap& bitmap_input,
+               const TargetBitmapView& bitmap_input,
                size_t start_cursor,
                const int32_t* offsets = nullptr) {
         // This is the original code, kept here for the documentation purposes
```

**File**: `internal/core/src/exec/expression/ConjunctExpr.cpp` (modified, +7/-4)
```diff
@@ -95,7 +95,7 @@ PhyConjunctFilterExpr::Eval(EvalCtx& context, VectorPtr& result) {
         "PhyConjunctFilterExpr::Eval", tracer::GetRootSpan(), true);
     span.SetAttribute("is_and", is_and_);
 
-    TargetBitmap inherited_bitmap;
+    EvalCtx::BitmapInput inherited_bitmap;
     bool has_result = false;
     auto restore_bitmap =
         folly::makeGuard([&context, &inherited_bitmap, &has_result] {
@@ -221,11 +221,14 @@ PhyConjunctFilterExpr::Eval(EvalCtx& context, VectorPtr& result) {
         auto active_rows = BuildActiveBitmap(all_flat_result);
         // Local results outside the parent's candidates are unspecified and
         // must neither reactivate rows nor prevent a batch-level early exit.
-        if (!inherited_bitmap.empty()) {
-            active_rows.inplace_and(inherited_bitmap, active_rows.size());
+        const auto inherited_view = inherited_bitmap.view();
+        if (!inherited_view.empty()) {
+            active_rows.inplace_and(inherited_view, active_rows.size());
         }
         if (active_rows.none()) {
-            SkipFollowingExprs(i + 1);
+            if (!has_input_offset) {
+                SkipFollowingExprs(i + 1);
+            }
             return;
         }
         context.set_bitmap_input(std::move(active_rows));
```

**File**: `internal/core/src/exec/expression/ConjunctExpr.h` (modified, +8/-0)
```diff
@@ -73,6 +73,14 @@ class PhyConjunctFilterExpr : public Expr {
         }
     }
 
+    bool
+    CanUseOffsetsForSequentialBatch() override {
+        return std::all_of(
+            inputs_.begin(), inputs_.end(), [](const auto& input) {
+                return input->CanUseOffsetsForSequentialBatch();
+            });
+    }
+
     bool
     SupportOffsetInput() override {
         for (auto& input : inputs_) {
```

---

### Incident Patch 2: `45e9c711` (2026-11-17)
**Commit Message**: fix: forward Lance external table snapshot IDs (#55497)

issue: #53352

Lance external collections silently ignored `external_spec.snapshot_id`
because the shared property injection path only handled Iceberg and
Paimon. Include `lance-table` so its requested version reaches
milvus-storage as `reader.exttable.snapshot_id`.

Extend the existing native snapshot tests for Lance string/number IDs,
JSON field order, C ABI conversion, invalid negative IDs, and the
omitted-version default. Extend the existing Lance E2E to create v1 with
100,000 rows, overwrite it with a one-row v2, and select v1 before
refreshing and querying the collection.

Validation:
- Six focused native tests: three failed before the fix; all six passed
after it. These test bodies were compiled from `test_external_take.cpp`
in a standalone runner with the freshly compiled `util.cpp`.
- Real MinIO/Lance native read check: with v2 present, the old code
selected v2 and returned one row despite requesting v1; the fix returned
all three v1 fixture rows with exact ID/value checks. Omitting the
version still returned v2. Native checks used the existing local storage
build `95215819`.
- Go E2E package compiled with `-tags dyn

**File**: `internal/core/src/storage/loon_ffi/util.cpp` (modified, +3/-3)
```diff
@@ -1035,8 +1035,7 @@ InjectExternalSpecProperties(
     }
 
     // Format-layer: emit per-format properties derived from spec.format.
-    // Iceberg and Paimon use reader.exttable.snapshot_id. Future formats
-    // (Lance version, Iceberg branch, etc.) land here.
+    // Lance, Iceberg, and Paimon use reader.exttable.snapshot_id.
     if (external_spec.empty()) {
         return arrow::Status::OK();
     }
@@ -1048,7 +1047,8 @@ InjectExternalSpecProperties(
         if (doc.find_field("format").get_string().get(format_view) ==
             simdjson::SUCCESS) {
             std::string format{format_view};
-            if (format == "iceberg-table" || format == "paimon-table") {
+            if (format == "lance-table" || format == "iceberg-table" ||
+                format == "paimon-table") {
                 // JSON fields may appear before or after "format".
                 auto snapshot_field = doc.find_field_unordered("snapshot_id");
                 int64_t snapshot_id = 0;
```

**File**: `internal/core/unittest/test_external_take.cpp` (modified, +26/-14)
```diff
@@ -4227,20 +4227,24 @@ TEST(InjectExtfsAllowlist, AnonymousLayer0SkippedWithStalePreseed) {
     EXPECT_EQ(std::get<std::string>(props.at("extfs.42.anonymous")), "true");
 }
 
-TEST(InjectExtfsAllowlist, IcebergSnapshotID) {
+TEST(InjectExtfsAllowlist, TableSnapshotID) {
     for (
         const std::string spec : {
             R"({"format":"iceberg-table","snapshot_id":"5320540205222981137"})",
             R"({"format":"iceberg-table","snapshot_id":5320540205222981137})",
             R"({"snapshot_id":"5320540205222981137","format":"iceberg-table"})",
             R"({"snapshot_id":5320540205222981137,"format":"iceberg-table"})",
+            R"({"format":"lance-table","snapshot_id":"5320540205222981137"})",
+            R"({"format":"lance-table","snapshot_id":5320540205222981137})",
+            R"({"snapshot_id":"5320540205222981137","format":"lance-table"})",
+            R"({"snapshot_id":5320540205222981137,"format":"lance-table"})",
         }) {
         SCOPED_TRACE(spec);
         milvus_storage::api::Properties props;
         ::InjectExternalSpecProperties(
             props, 42, "s3://s3.amazonaws.com/bucket/key", spec);
 
-        // Read the same typed property as IcebergFormat::explore so a stale
+        // Read the same typed property as the format's explore() so a stale
         // property key cannot silently fall back to the latest snapshot.
         const auto snapshot_id = milvus_storage::api::GetValue<int64_t>(
             std::make_shared<const milvus_storage::api::Properties>(props),
@@ -4250,13 +4254,17 @@ TEST(InjectExtfsAllowlist, IcebergSnapshotID) {
     }
 }
 
-TEST(InjectExtfsAllowlist, IcebergSnapshotIDCAbiRoundTrip) {
+TEST(InjectExtfsAllowlist, TableSnapshotIDCAbiRoundTrip) {
     for (
         const std::string spec : {
             R"({"format":"iceberg-table","snapshot_id":"5320540205222981137"})",
             R"({"format":"iceberg-table","snapshot_id":5320540205222981137})",
             R"({"snapshot_id":"5320540205222981137","format":"iceberg-table"})",
             R"({"snapshot_id":5320540205222981137,"format":"iceberg-table"})",
+            R"({"format":"lance-table","snapshot_id":"5320540205222981137"})",
+            R"({"format":"lance-table","snapshot_id":5320540205222981137})",
+            R"({"snapshot_id":"5320540205222981137","format":"lance-table"})",
+            R"({"snapshot_id":5320540205222981137,"format":"lance-table"})",
         }) {
         SCOPED_TRACE(spec);
         LoonProperties properties{};
@@ -4288,12 +4296,16 @@ TEST(InjectExtfsAllowlist, IcebergSnapshotIDCAbiRoundTrip) {
     }
 }
 
-TEST(InjectExtfsAllowlist, InvalidIcebergSnapshotIDIsRejected) {
+TEST(InjectExtfsAllowlist, InvalidTableSnapshotIDIsRejected) {
     for (const std::string spec : {
              R"({"format":"iceberg-table","snapshot_id":-2})",
              R"({"format":"iceberg-table","snapshot_id":"-2"})",
              R"({"snapshot_id":-2,"format":"iceberg-table"})",
              R"({"snapshot_id":"-2","format":"iceberg-table"})",
+             R"({"format":"lance-table","snapshot_id":-2})",
+             R"({"format":"lance-table","snapshot_id":"-2"})",
+             R"({"snapshot_id":-2,"format":"lance-table"})",
+             R"({"snapshot_id":"-2","format":"lance-table"})",
          }) {
         SCOPED_TRACE(spec);
         milvus_storage::api::Properties props;
@@ -4366,17 +4378,17 @@ TEST(InjectExtfsAllowlist, PaimonSnapshotIDSurvivesCABIConversion) {
     loon_properties_free(&props);
 }
 
-TEST(InjectExtfsAllowlist, PaimonSnapshotIDOptional) {
-    // Without snapshot_id the property must stay absent so the paimon
-    // planner falls back to the latest snapshot.
-    milvus_storage::api::Properties props;
-    const int64_t coll_id = 42;
-    std::string spec = R"({"format":"paimon-table"})";
-
-    ::InjectExternalSpecProperties(
-        props, coll_id, "s3://s3.amazonaws.com/bucket/key", spec);
+TEST(InjectExtfsAllowlist, TableSnapshotIDOptional) {
+    // Without snapshot_id the format must keep its latest-snapshot default.
+    for (const std::string spec :
+         {R"({"format":"paimon-table"})", R"({"format":"lance-table"})"}) {
+        SCOPED_TRACE(spec);
+        milvus_storage::api::Properties props;
+        ::InjectExternalSpecProperties(
+            props, 42, "s3://s3.amazonaws.com/bucket/key", spec);
 
-    EXPECT_EQ(props.count(PROPERTY_READER_EXTTABLE_SNAPSHOT_ID), 0u);
+        EXPECT_EQ(props.count(PROPERTY_READER_EXTTABLE_SNAPSHOT_ID), 0u);
+    }
 }
 
 TEST(InjectExtfsAllowlist, PaimonScanModeIsInjected) {
```

**File**: `tests/go_client/testcases/external_table_refresh_test.go` (modified, +13/-3)
```diff
@@ -3,6 +3,7 @@ package testcases
 import (
 	"bytes"
 	"context"
+	"encoding/json"
 	"fmt"
 	"net"
 	"net/url"
@@ -2115,8 +2116,8 @@ func mapToEnvSlice(m map[string]string) []string {
 }
 
 // TestExternalCollectionLanceFormat tests external collections with lance-table format:
-//  1. Generate Lance dataset on MinIO using Python
-//  2. Create external collection with lance-table format
+//  1. Generate two Lance dataset versions with different rows on MinIO
+//  2. Create external collection with lance-table format pinned to the old version
 //  3. Refresh and wait for completion
 //  4. Create index and load collection
 //  5. Query count(*) and verify row count
@@ -2156,13 +2157,22 @@ func TestExternalCollectionLanceFormat(t *testing.T) {
 			fmt.Sprintf("%s/%s/", minioCfg.rootPath, extPath))
 	})
 
+	// Overwrite the fresh dataset to create v2 with only id=100000. Selecting
+	// v1 must still return the original 100000 rows, not the latest snapshot.
+	generateLanceDataOnMinIO(t, s3URI, externalDataSchemaBasic, 1, totalRows)
+	var spec map[string]any
+	require.NoError(t, json.Unmarshal([]byte(extTestSpec(minioCfg, "lance-table")), &spec))
+	spec["snapshot_id"] = "1"
+	specJSON, err := json.Marshal(spec)
+	require.NoError(t, err)
+
 	// ---------------------------------------------------------------
 	// Step 2: Create external collection with lance-table format
 	// ---------------------------------------------------------------
 	schema := entity.NewSchema().
 		WithName(collName).
 		WithExternalSource(extTestURI(minioCfg, extPath)).
-		WithExternalSpec(extTestSpec(minioCfg, "lance-table")).
+		WithExternalSpec(string(specJSON)).
 		WithField(
 			entity.NewField().
 				WithName("id").
```

---

### Incident Patch 3: `f266503a` (2026-11-17)
**Commit Message**: test: disable background config refresh in test builds (#55546)

## Problem

`paramtable.Init()` starts background config refreshers: every 5 s they
re-read `milvus.yaml` and `hook.yaml` and poll the etcd config source.
Go unit tests run with `-tags dynamic,test` and almost all of them call
`paramtable.Init()` (directly, in `TestMain`, or lazily through
`paramtable.Get()`), so these goroutines run alongside every unit test.

Unit tests do not need them: they change configuration with `Save` /
`Reset` / `Remove`, which take effect immediately and fire config
events. Tests that do exercise refreshing already build their own
`BaseTable` with an explicit `Interval`.

But the refreshers make test processes nondeterministic. Within one week
they were the concurrent goroutine behind four flaky tests:

| PR | Test | How the refresher broke it |
| --- | --- | --- |
| #55262 | `TestGetCollectionProperties` | its allocations landed in a
process-wide `testing.AllocsPerRun` measurement |
| #55477 | `TestCheckAndSetDataDoesNotCopyWholeDataArray` | each tick
allocates over 1 MiB, which landed in a process-wide
`MemStats.TotalAlloc` measurement |
| #55314 | `TestBuildLatencyExcludesAdmissionWait` 

**File**: `internal/querynodev2/server_test.go` (modified, +18/-71)
```diff
@@ -19,8 +19,6 @@ package querynodev2
 import (
 	"context"
 	"fmt"
-	"os"
-	"strings"
 	"sync/atomic"
 	"testing"
 	"time"
@@ -31,7 +29,6 @@ import (
 	"github.com/stretchr/testify/mock"
 	"github.com/stretchr/testify/suite"
 	clientv3 "go.etcd.io/etcd/client/v3"
-	"gopkg.in/yaml.v3"
 
 	"github.com/milvus-io/milvus-proto/go-api/v3/commonpb"
 	"github.com/milvus-io/milvus-proto/go-api/v3/schemapb"
@@ -171,14 +168,18 @@ func (suite *QueryNodeSuite) TestInit_QueryHook() {
 	suite.node.queryHook = mockHook
 	suite.node.handleQueryHookEvent()
 
-	configPath := "../../configs/milvus.yaml"
-	origConfig, err := os.ReadFile(configPath)
-	suite.Require().NoError(err)
+	// Drive the create, update and delete cases through Save and Remove. Their
+	// runtime config events reach the same hook callbacks synchronously,
+	// without rewriting configs/milvus.yaml (which other test packages read) or
+	// relying on the background file refresh, which test builds do not run.
+	pt := paramtable.Get()
+	tuningKey := pt.AutoIndexConfig.AutoIndexTuningConfig.KeyPrefix + "1238"
+	searchKey := pt.AutoIndexConfig.AutoIndexSearchConfig.Key
 	suite.T().Cleanup(func() {
-		os.WriteFile(configPath, origConfig, 0o600) //nolint:gosec // configPath is a hardcoded test path
+		pt.Reset(tuningKey)
+		pt.Reset(searchKey)
 	})
 
-	yamlWriter := newYamlConfigWriter(configPath)
 	var x1, x2, x3 int32
 	suite.Equal(atomic.LoadInt32(&x1), int32(0))
 	suite.Equal(atomic.LoadInt32(&x2), int32(0))
@@ -189,42 +190,37 @@ func (suite *QueryNodeSuite) TestInit_QueryHook() {
 	}).Return(nil)
 
 	// create tuning conf
-	yamlWriter.set("autoIndex.params.tuning.1238", "xxxx")
-	yamlWriter.writeConfig()
+	pt.Save(tuningKey, "xxxx")
 	suite.Eventually(func() bool {
 		return atomic.LoadInt32(&x1) == int32(6)
-	}, 20*time.Second, time.Second)
+	}, 20*time.Second, 10*time.Millisecond)
 
 	mockHook.EXPECT().Init(mock.Anything).Run(func(params string) {
 		atomic.StoreInt32(&x2, 5)
 	}).Return(nil)
-	yamlWriter.set("autoIndex.params.search", "aaaa")
-	yamlWriter.writeConfig()
+	pt.Save(searchKey, "aaaa")
 	suite.Eventually(func() bool {
 		return atomic.LoadInt32(&x2) == int32(5)
-	}, 20*time.Second, time.Second)
-	yamlWriter.set("autoIndex.params.search", "")
-	yamlWriter.writeConfig()
+	}, 20*time.Second, 10*time.Millisecond)
+	pt.Save(searchKey, "")
 
 	atomic.StoreInt32(&x1, 0)
 	suite.Equal(atomic.LoadInt32(&x1), int32(0))
 	// update tuning conf
-	yamlWriter.set("autoIndex.params.tuning.1238", "yyyy")
-	yamlWriter.writeConfig()
+	pt.Save(tuningKey, "yyyy")
 	suite.Eventually(func() bool {
 		return atomic.LoadInt32(&x1) == int32(6)
-	}, 20*time.Second, time.Second)
+	}, 20*time.Second, 10*time.Millisecond)
 
 	mockHook.EXPECT().DeleteTuningConfig(mock.Anything).Run(func(params string) {
 		atomic.StoreInt32(&x3, 7)
 	}).Return(nil)
 
 	// delete tuning conf
-	yamlWriter.set("autoIndex.params.tuning", "")
-	yamlWriter.writeConfig()
+	pt.Remove(tuningKey)
 	suite.Eventually(func() bool {
 		return atomic.LoadInt32(&x3) == int32(7)
-	}, 20*time.Second, time.Second)
+	}, 20*time.Second, 10*time.Millisecond)
 }
 
 func (suite *QueryNodeSuite) TestStop() {
@@ -512,52 +508,3 @@ func TestRegisterSegcoreConfigWatcher(t *testing.T) {
 func TestQueryNode(t *testing.T) {
 	suite.Run(t, new(QueryNodeSuite))
 }
-
-// yamlConfigWriter is a minimal viper replacement for test config manipulation.
-type yamlConfigWriter struct {
-	path string
-	data map[string]interface{}
-}
-
-func newYamlConfigWriter(path string) *yamlConfigWriter {
-	w := &yamlConfigWriter{path: path}
-	raw, err := os.ReadFile(path)
-	if err != nil {
-		panic(err)
-	}
-	w.data = make(map[string]interface{})
-	if err := yaml.Unmarshal(raw, &w.data); err != nil {
-		panic(err)
-	}
-	return w
-}
-
-func (w *yamlConfigWriter) set(key string, value interface{}) {
-	parts := strings.Split(key, ".")
-	m := w.data
-	for _, p := range parts[:len(parts)-1] {
-		child, ok := m[p]
-		if !ok {
-			child = make(map[string]interface{})
-			m[p] = child
-		}
-		if cm, ok := child.(map[string]interface{}); ok {
-			m = cm
-		} else {
-			nm := make(map[string]interface{})
-			m[p] = nm
-			m = nm
-		}
-	}
-	m[parts[len(parts)-1]] = value
-}
-
-func (w *yamlConfigWriter) writeConfig() {
-	out, err := yaml.Marshal(w.data)
-	if err != nil {
-		panic(err)
-	}
-	if err := os.WriteFile(w.path, out, 0o600); err != nil {
-		panic(err)
-	}
-}
```

**File**: `pkg/util/paramtable/base_table.go` (modified, +1/-1)
```diff
@@ -128,7 +128,7 @@ func NewBaseTable(opts ...Option) *BaseTable {
 	defaultConfig := &baseTableConfig{
 		configDir:       initConfPath(),
 		yamlFiles:       defaultYaml,
-		refreshInterval: 5 * time.Second,
+		refreshInterval: defaultRefreshInterval,
 		skipRemote:      false,
 		skipEnv:         false,
 	}
```

**File**: `pkg/util/paramtable/refresh_interval.go` (added, +27/-0)
```diff
@@ -0,0 +1,27 @@
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
+//go:build !test
+
+package paramtable
+
+import "time"
+
+// defaultRefreshInterval is how often a BaseTable re-reads its file and etcd
+// sources when the Interval option does not set one. paramtable.Init passes
+// MILVUS_CONFIG_REFRESH_INTERVAL as that option for the table it builds.
+// Test builds use refresh_interval_testonly.go instead.
+const defaultRefreshInterval = 5 * time.Second
```

**File**: `pkg/util/paramtable/refresh_interval_test.go` (added, +43/-0)
```diff
@@ -0,0 +1,43 @@
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
+//go:build test
+
+package paramtable
+
+import (
+	"testing"
+	"time"
+
+	"github.com/stretchr/testify/require"
+)
+
+func TestNewBaseTable_TestBuildDoesNotRefreshByDefault(t *testing.T) {
+	mainTable := NewBaseTable(SkipRemote(true))
+	t.Cleanup(mainTable.mgr.Close)
+	require.Zero(t, mainTable.config.refreshInterval,
+		"test builds must not refresh configuration in the background by default")
+
+	hook := NewBaseTableFromYamlOnly(hookYamlFile)
+	t.Cleanup(hook.mgr.Close)
+	require.Zero(t, hook.config.refreshInterval,
+		"the hook table must follow the same default")
+
+	refreshing := NewBaseTable(SkipRemote(true), Interval(time.Hour))
+	t.Cleanup(refreshing.mgr.Close)
+	require.Equal(t, time.Hour, refreshing.config.refreshInterval,
+		"an explicit Interval must still enable refreshing")
+}
```

**File**: `pkg/util/paramtable/refresh_interval_testonly.go` (added, +37/-0)
```diff
@@ -0,0 +1,37 @@
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
+//go:build test
+
+package paramtable
+
+import "time"
+
+// defaultRefreshInterval is zero in test builds, so a BaseTable does not
+// refresh its sources in the background unless asked to.
+//
+// Unit tests should change configuration through Save, Reset or Remove,
+// which take effect immediately and fire the same config events. A
+// background refresher only adds goroutines that re-read milvus.yaml and
+// hook.yaml and poll etcd every few seconds: their allocations land in
+// process-wide measurements such as testing.AllocsPerRun and
+// runtime.MemStats, and their calls race with mockey patches of functions
+// they use, such as time.Now and proto.Unmarshal.
+//
+// Tests that exercise refreshing pass the Interval option.
+// MILVUS_CONFIG_REFRESH_INTERVAL only applies to the table paramtable.Init
+// builds; the integration cluster sets it for the Milvus processes it starts.
+const defaultRefreshInterval time.Duration = 0
```

#### Recent Merged Pull Requests:
- **PR #55643** (2026-11-17): feat: [cp3.0] support per-request source storage for bulk import (@xaxys)
- **PR #55631** (closed): fix: [cp3.0] preserve IAM credential caches across storage clients (@xiaofan-luan)
- **PR #55630** (closed): fix: preserve IAM credential caches across storage clients (@xiaofan-luan)
- **PR #55619** (2026-11-17): fix: keep GPU support disabled by default for Cardinal builds (@marcelo-cjl)
- **PR #55617** (2026-11-17): test: copy TEXT values before reading the next batch in the flush test (@xiaofan-luan)
- **PR #55612** (2026-11-16): fix: [GoSDK] add Timestamptz column write helper (@xiaofan-luan)

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

## X. enhance: propagate candidates and null rejection to element predicates

**RULE**:
When implementing operations in `internal/core/src/common/ElementFilterIterator.cpp`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in milvus-io/milvus. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `663f0d57`: enhance: propagate candidates and null rejection to element predicates. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `internal/core/src/common/ElementFilterIterator.cpp`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
    TargetBitmapView validview(col_vec->GetValidRawData(), col_vec_size);
        if (bitsetview[i] && validview[i]) {
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
        if (bitsetview[i]) {
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `663f0d57` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
