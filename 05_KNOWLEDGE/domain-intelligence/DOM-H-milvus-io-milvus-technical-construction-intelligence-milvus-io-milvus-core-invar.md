# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: milvus-io/milvus Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "milvus-io/milvus",
  "source_url": "https://github.com/milvus-io/milvus",
  "source_version": "72e14334",
  "license": "Apache-2.0",
  "timestamp": "2026-11-23T23:18:25.082Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-milvus-io-milvus",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [milvus-io/milvus](https://github.com/milvus-io/milvus) (Revision: `72e14334`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-23T23:18:25.082Z`  
> **Learning ID**: `learn-github-milvus-io-milvus`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: G (Architecture Intelligence), D (Research & Knowledge Intelligence), K (Quality & Verification Intelligence), I (Content & Information Intelligence), L (Deployment & Operations Intelligence), M (Feedback & Evolution Intelligence), J (Search & Distribution Intelligence), F (Design Intelligence), A (Human & Need Intelligence)
- **Confidence Rating**: 73%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from milvus-io/milvus:

# Forensic Learning Record (Deep Inspection): milvus-io/milvus

> **Canonical Artifact**: `07_PROJECT_LEARNING/milvus-io-milvus-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/milvus-io/milvus](https://github.com/milvus-io/milvus))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-23T23:18:23.862Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `milvus-io/milvus`
- **Description**: Milvus is a high-performance, cloud-native vector database built for scalable vector ANN search
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 46726 stars

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
- **Issue #55829** (2026-11-23): **fix: format RPC context for QueryView streaming errors**
  *Symptoms*: ## What type of PR is this?  - [x] Bug Fix  ## Which issue(s) this PR fixes  Fixes #55827 (regression from #55219)  ## Description  `NewServiceStreamClientInterceptor` attaches `viewpb.RPCRequestContext` to `SearchOnViewStream` and `QueryOnViewStream` errors, just like the unary interceptor does for `SearchOnView` and `QueryOnView`. However, `formatRPCContext` in `internal/views/queryclient/error.go` only switched on the unary method names, causing streaming QueryView errors to hit `default: return err` and drop the `"fail to search on QueryNode <id>: "` / `"fail to query on QueryNode <id>: "` prefix.  This broke all 6 index variants of `test_search_invalid_params_type` on `master` nightly suites (`milvus-e2e-master` and `cardinal-e2e-master`) once #55219 enabled streaming reduction by default.  ### Changes - Handle `ViewQueryService_SearchOnViewStream_FullMethodName` and `ViewQueryService_QueryOnViewStream_FullMethodName` in `formatRPCContext` (`internal/views/queryclient/error.go`). - Add streaming method cases for both QueryNode and StreamingNode to `TestToMilvusErrorFormatsRPCContext` (`internal/views/queryclient/error_test.go`).  ### Verification - `golangci-lint fmt --diff --enable {gci,gofmt,gofumpt,goimports}`: no diff on all 4 formatters. - Remote Go UT (`milvus-dev-cli go-ut local . -b master -t ./internal/views/queryclient -k 'TestToMilvusError'`, task `go-ut-local-wenxing-fix-queryview-d1fa78a-c89227464cd654a8-u482`): PASS (`ok github.com/milvus-io/milvus/internal

- **Issue #55828** (2026-11-23): **test: fix remaining chaos cleanup hooks for pytest 8**
  *Symptoms*: ## What type of PR is this?  - [x] Test  ## Description  Follow-up to #55501 (`test: fix chaos cleanup hook for pytest 8`), which updated `tests/python_client/chaos/test_chaos_apply.py` from legacy `def teardown(self)` to `def teardown_method(self)`.  Six remaining chaos test files still defined `def teardown(self)`, which pytest 8 silently ignores. In `chaos-test-kafka-cron` build 4770 and `chaos-test-wp-cron` build 2934, when `test_chaos_apply_to_determined_pod.py` failed after creating a `PodChaos` CR, cleanup never ran and leaked `PodChaos` CRs (`test-etcd-leader-pod-kill-1795307084`, `test-etcd-followers-pod-kill-1795354005`) into `chaos-testing`.  ### Changes - Rename `def teardown(self)` to `def teardown_method(self)` in:   - `tests/python_client/chaos/test_chaos_apply_to_determined_pod.py`   - `tests/python_client/chaos/test_chaos_apply_multi_replicas.py`   - `tests/python_client/chaos/test_chaos_apply_to_coord.py`   - `tests/python_client/chaos/test_chaos.py`   - `tests/python_client/chaos/test_chaos_bulk_insert.py`   - `tests/python_client/chaos/test_load_with_checker.py` - Guard attribute lookups with `getattr(...)` and non-empty `meta_name` checks so teardown does not mask an earlier failure with `AttributeError` when a test fails before creating a chaos CR.  ### Verification - `python -m py_compile` on all 6 files: PASS. - `ruff check --select E,F,W`: 0 warnings on touched lines. - Isolated pytest lifecycle verification using the real `TestChaosApply.teardown_met

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

### Incident Patch 1: `f81b4bca` (2026-11-23)
**Commit Message**: fix: record replicated idempotency keys on the secondary (#54903)

issue: #54572

### Problem

A replicated Insert carries the source cluster's idempotency key and
insert result, but the secondary recorded neither. The idempotency
interceptor appended it without touching the window, and the summary
observer stored it as keyless. After a planned switchover, the promoted
cluster had no entry for the key. A client retry took the Owner path,
allocated new autoIDs and appended a second copy (32 -> 64 rows in the
issue).

### Fix

The secondary records replicated keys but never checks against them.

- The window is never read for a replicated message. The interceptor
still appends every replicated message unconditionally. So the hazards
the design doc lists for deduplicating a replicated write locally (a
demotion, or a legal key reuse after the source evicted the key) cannot
occur.
- The window is written after the append. The new `Window.Record` stores
key -> result and replaces an entry already held for the key
(last-wins). `Complete` and `Record` share one `storeLocked`, so bytes
and commit order stay consistent.
- A replicated transaction buffers its body results and records on the
c

**File**: `docs/design-docs/design_docs/20260604-idempotent_write.md` (modified, +72/-10)
```diff
@@ -91,8 +91,11 @@ cannot be done correctly for autoID collections at all.
   sent (`client/milvusclient`), but REST, pymilvus and raw gRPC callers reach the server,
   where it is dropped silently. Deleting the same rows twice is already effectively a
   no-op; `Upsert` needs its delete leg deduped as well, which is a separate design.
-- Cross-cluster dedup. Replicated writes bypass the window entirely (see
-  [Replication and CDC](#replication-and-cdc)).
+- Cross-cluster dedup of replicated writes. A replicated write is never deduplicated
+  against the local window; it is only recorded there, so that a client retry after a
+  planned switchover can reuse the result while the secondary retains the key (see
+  [Replication and CDC](#replication-and-cdc)). Keys that replication had not delivered
+  before a force promote are not recovered.
 - Unbounded retention. Duplicate visibility is a bounded window (see
   [Retention](#retention)).
 
@@ -466,17 +469,75 @@ be recovered from WALSummary.
 
 ## Replication and CDC
 
-Replicated messages **bypass the window entirely**. The replicate stream has its own
+Replicated messages are **recorded in the window but never checked against it**.
+
+The window is never read for a replicated message. The replicate stream has its own
 exactly-once delivery via source-timetick checkpoints, and the idempotency key inside a
 replicated message belongs to the *source* cluster's window history. Deduplicating
 against the local window would silently drop replicated writes whenever the key happens
 to sit in this cluster's window — after a demotion, or after the source released the key
-and a client legally re-issued it.
-
-The recovery observer applies the same rule: a replicated write becomes a *keyless*
-committed write in Summary, so a foreign key can never materialize a local dedup
-entry. Its local WAL positions still participate in Summary persistence and
-checkpoint gating.
+and a client legally re-issued it. So a replicated message is appended unconditionally.
+
+The window is written after the append. A replicated Insert carries the source's key and
+its `idempotent_result` header; a replicated transaction carries them on its bodies and
+its commit, and the interceptor merges the body results on the commit exactly as it does
+for a native transaction. The recorded entry replaces an entry already held for the key:
+when the source evicted the key and a client legally reused it, the newer write is the one
+a retry must see. The recovery observer applies the same rule, so a window rebuilt from
+Summary carries the replicated keys too, and restore already keeps the newest record per
+key.
+
+During a **planned switchover**, each PChannel appends `AlterReplicateConfig`
+after its preceding replicated writes have updated the window. A client retry on the
+promoted cluster returns the original primary keys if its window still holds the entry.
+Each cluster enforces its own idle TTL and byte budget. A duplicate hit on the old
+primary refreshes only that cluster's entry, so the secondary can evict the key sooner.
+Routing lines up because row *i* goes to shard `i % n` on every attempt and a secondary
+names its VChannels by PChannel index.
+
+A native request releases the role lock while waiting for function resources, segment
+readiness, or another owner of the same key. If the topology changed during the wait,
+the request checks the current role and window again before it can append.
+
+After a **force promote**, replication may also have missed writes. A retry appends
+again when the promoted cluster has no entry for the key.
+
+Recording is best effort. A replicated write must land even when its key cannot be
+remembered. A replicated transaction is recorded only when the buffer holds a result for
+every body, that is, when the buffered count equals the commit's `BodyCnt`. On a restart the
+replicate side recovers an open replicated transaction from the WAL and ignores the resent
+bodies it already holds; the interceptor restores the buffered results of those bodies from
+the same `TxnBuffer`, so the commit still finds every body. The buffer is released only
+after the commit lands, so a rejected commit that the source replays also finds the earlier
+bodies.
+
+A replicated body is buffered with an infinite keepalive, no matter what keepalive the
+source stamped on it. The source owns a replicated transaction's lifecycle, so the buffer
+is reclaimed only once the txn session leaves the txn manager — never by a timetick-based
+expiry. That matters on a restart: the reopened WAL places the vchannel MVCC at the
+recovery timetick, which can sit far beyond a body's timetick plus the source keepalive,
+and would otherwise delete the very results the restore just filled, leaving the commit
+unrecordable and the key forgotten.
+
+When a replicated write lands but cannot be recorded (a malformed result header, an
+incomplete transaction, or a commit without `BodyCnt`), the entry he
```

**File**: `internal/streamingnode/server/wal/adaptor/preparation_test.go` (modified, +71/-2)
```diff
@@ -9,12 +9,16 @@ import (
 	"github.com/bytedance/mockey"
 	"github.com/stretchr/testify/require"
 
+	"github.com/milvus-io/milvus-proto/go-api/v3/commonpb"
 	"github.com/milvus-io/milvus-proto/go-api/v3/msgpb"
 	"github.com/milvus-io/milvus-proto/go-api/v3/schemapb"
 	"github.com/milvus-io/milvus/internal/streamingnode/server/wal/interceptors"
 	"github.com/milvus-io/milvus/internal/streamingnode/server/wal/interceptors/idempotency"
 	"github.com/milvus-io/milvus/internal/streamingnode/server/wal/interceptors/redo"
+	"github.com/milvus-io/milvus/internal/streamingnode/server/wal/interceptors/replicate"
+	"github.com/milvus-io/milvus/internal/streamingnode/server/wal/interceptors/replicate/replicates"
 	"github.com/milvus-io/milvus/internal/streamingnode/server/wal/interceptors/shard/shards"
+	"github.com/milvus-io/milvus/internal/streamingnode/server/wal/recovery"
 	"github.com/milvus-io/milvus/internal/util/fileresource"
 	"github.com/milvus-io/milvus/internal/util/function"
 	"github.com/milvus-io/milvus/internal/util/streamingutil/status"
@@ -69,11 +73,16 @@ func installPreparationTestInterceptor(t *testing.T, w *walAdaptorImpl) function
 	redoInterceptor := redo.NewInterceptorBuilder().Build(&interceptors.InterceptorBuildParam{
 		ShardManager: &preparationTestShardManager{},
 	})
-	idempotencyInterceptor := idempotency.NewInterceptorBuilder().Build(&interceptors.InterceptorBuildParam{})
+	rm, err := replicates.RecoverReplicateManager(&replicates.ReplicateManagerRecoverParam{
+		ChannelInfo: w.Channel(), CurrentClusterID: "local", InitialRecoverSnapshot: &recovery.RecoverySnapshot{},
+	})
+	require.NoError(t, err)
+	param := &interceptors.InterceptorBuildParam{ReplicateManager: rm}
+	idempotencyInterceptor := idempotency.NewInterceptorBuilder().Build(param)
 	t.Cleanup(redoInterceptor.Close)
 	t.Cleanup(idempotencyInterceptor.Close)
 	w.interceptorBuildResult.Interceptor = interceptors.NewChainedInterceptor(
-		idempotencyInterceptor, redoInterceptor, w.interceptorBuildResult.Interceptor, &preparationTestInterceptor{})
+		idempotencyInterceptor, redoInterceptor, w.interceptorBuildResult.Interceptor, replicate.NewInterceptorBuilder().Build(param), &preparationTestInterceptor{})
 	return manager
 }
 
@@ -197,6 +206,66 @@ func TestAppendPreparationReleasesWALLockAndHonorsCancellation(t *testing.T) {
 	}
 }
 
+func TestAppendRechecksRoleAfterPreparation(t *testing.T) {
+	mockey.PatchConvey("demotion can finish while owner and duplicate wait", t, func() {
+		var persisted atomic.Int32
+		w := newFenceTestWAL(t, newFirstTimeTickWALImpls(func(ctx context.Context, msg message.MutableMessage) (message.MessageID, error) {
+			persisted.Add(1)
+			return finishFenceTestAppend(ctx, 1), nil
+		}))
+		manager := installPreparationTestInterceptor(t, w)
+		defer manager.Close()
+		started, resume := make(chan struct{}), make(chan struct{})
+		var once sync.Once
+		release := func() { once.Do(func() { close(resume) }) }
+		defer release()
+		mockey.Mock(fileresource.Acquire).To(func(context.Context, []int64, ...string) (*fileresource.Resources, error) {
+			close(started)
+			<-resume
+			return &fileresource.Resources{}, nil
+		}).Build()
+		mockey.Mock(function.BuildEmbeddingRunner).Return(&preparationTestRunner{}, nil).Build()
+		mockey.Mock((*preparationTestRunner).Close).Return().Build()
+		waiterJoined := make(chan struct{})
+		var original func(*idempotency.PendingEntry, context.Context, message.MutableMessage) idempotency.PendingResult
+		mockey.Mock((*idempotency.PendingEntry).Wait).Origin(&original).To(func(p *idempotency.PendingEntry, ctx context.Context, msg message.MutableMessage) idempotency.PendingResult {
+			close(waiterJoined)
+			return original(p, ctx, msg)
+		}).Build()
+		result := make(chan error, 2)
+		insert := func() {
+			_, err := w.Append(t.Context(), newPreparationTestInsert("same-key"))
+			result <- err
+		}
+		go insert()
+		waitFenceTestSignal(t, started)
+		go insert()
+		waitFenceTestSignal(t, waiterJoined)
+		config := &commonpb.ReplicateConfiguration{
+			Clusters: []*commonpb.MilvusCluster{
+				{ClusterId: "local", Pchannels: []string{w.Channel().Name}},
+				{ClusterId: "peer", Pchannels: []string{"peer-channel"}},
+			},
+			CrossClusterTopology: []*commonpb.CrossClusterTopology{{SourceClusterId: "peer", TargetClusterId: "local"}},
+		}
+		ddl := make(chan error, 1)
+		go func() {
+			_, err := w.Append(t.Context(), message.NewAlterReplicateConfigMessageBuilderV2().WithAllVChannel().
+				WithHeader(&message.AlterReplicateConfigMessageHeader{ReplicateConfiguration: config}).
+				WithBody(&message.AlterReplicateConfigMessageBody{}).MustBuildMutable())
+			ddl <- err
+		}()
+		require.NoError(t, waitFenceTestError(t, ddl))
+		release()
+		for range 2 {
+			err := waitFenceTestError(t, result)
+			require.Error(t, err)
+			require.True(t, status.AsStreamingError(err).IsReplicateViolation())
+		}
+		require.EqualValues(t, 1, persisted.Load())
+	})
+}
+
 func TestAppendResumesAfte
```

**File**: `internal/streamingnode/server/wal/interceptors/idempotency/idempotency_interceptor.go` (modified, +230/-33)
```diff
@@ -2,7 +2,9 @@ package idempotency
 
 import (
 	"context"
+	"sync"
 
+	"github.com/cockroachdb/errors"
 	"github.com/pingcap/failpoint"
 
 	walpoint "github.com/milvus-io/milvus/internal/streamingnode/server/wal/failpoint"
@@ -15,11 +17,13 @@ import (
 	"github.com/milvus-io/milvus/pkg/v3/proto/messagespb"
 	"github.com/milvus-io/milvus/pkg/v3/streaming/util/message"
 	"github.com/milvus-io/milvus/pkg/v3/util/replicateutil"
-	"github.com/milvus-io/milvus/pkg/v3/util/typeutil"
 )
 
 const interceptorName = "idempotency"
 
+// Consumed inside DoAppend before the caller sees an append outcome.
+var errTopologyChanged = errors.New("topology changed while append was waiting")
+
 var (
 	_ interceptors.Interceptor            = (*idempotencyInterceptor)(nil)
 	_ interceptors.InterceptorWithMetrics = (*idempotencyInterceptor)(nil)
@@ -29,8 +33,13 @@ type idempotencyInterceptor struct {
 	config WindowConfig
 	cache  *windowManager
 
-	windows                *typeutil.ConcurrentMap[string, *Window]
 	txnInsertResultBuffers *idempotencyutils.TxnInsertResultBuffers
+	// A replicated append holds exclusive admission from checkpoint acceptance
+	// through publication of its results. Native writes share admission across
+	// their role check, window decision and append. Redo and duplicate waits
+	// release admission before blocking and check the generation on resumption.
+	replicatedMu       sync.RWMutex
+	topologyGeneration uint64
 	// txnActive reports whether a txn session is still tracked by the txn
 	// manager; a duplicate commit only synthesizes a rollback for a txn that is
 	// positively known to be still open. nil means "unknown" and skips the
@@ -78,21 +87,24 @@ func newIdempotencyInterceptorWithParam(config WindowConfig, param *interceptors
 	}
 	cache := newWindowManager(config)
 	cache.start()
-	return &idempotencyInterceptor{
+	interceptor := &idempotencyInterceptor{
 		cache:                  cache,
-		windows:                typeutil.NewConcurrentMap[string, *Window](),
 		txnInsertResultBuffers: idempotencyutils.NewTxnInsertResultBuffers(currentTimeTick, txnActive),
 		txnActive:              txnActive,
 		replicateRole:          replicateRole,
 		config:                 config,
 	}
+	if param != nil && param.InitialRecoverSnapshot != nil {
+		interceptor.restoreReplicatedTxnBuffers(param.InitialRecoverSnapshot.TxnBuffer)
+	}
+	return interceptor
 }
 
 func newIdempotencyInterceptorWithSnapshots(config WindowConfig, snapshots map[string]*idempotencyview.Snapshot, param *interceptors.InterceptorBuildParam) *idempotencyInterceptor {
 	interceptor := newIdempotencyInterceptorWithParam(config, param)
 	interceptor.cache.mu.Lock()
 	for vchannel, window := range interceptor.cache.restore(snapshots) {
-		interceptor.windows.Insert(vchannel, window)
+		interceptor.cache.registerRecoveredWindow(vchannel, window)
 	}
 	interceptor.cache.mu.Unlock()
 	return interceptor
@@ -102,24 +114,104 @@ func newIdempotencyInterceptorWithRecovery(config WindowConfig, snapshot *idempo
 	interceptor := newIdempotencyInterceptorWithParam(config, param)
 	interceptor.cache.mu.Lock()
 	for vc, window := range interceptor.cache.restoreOrdered(snapshot) {
-		interceptor.windows.Insert(vc, window)
+		interceptor.cache.registerRecoveredWindow(vc, window)
 	}
 	interceptor.cache.mu.Unlock()
 	return interceptor
 }
 
+// restoreReplicatedTxnBuffers buffers the insert results of the bodies of every
+// open replicated transaction in txnBuffer. On a restart the replicate side
+// recovers such a transaction from the same TxnBuffer (recoverSecondaryState)
+// and ignores the resent bodies it already holds, so those bodies never pass
+// through appendTxnBodyWithInsertResult again. Native transactions are skipped:
+// the producer rebuilds them under a new txnID instead of resending them.
+func (impl *idempotencyInterceptor) restoreReplicatedTxnBuffers(txnBuffer *utility.TxnBuffer) {
+	if txnBuffer == nil {
+		return
+	}
+	for _, builder := range txnBuffer.GetUncommittedMessageBuilder() {
+		begin, bodies := builder.Messages()
+		if begin.ReplicateHeader() == nil {
+			continue
+		}
+		for _, body := range bodies {
+			if body.MessageType() != message.MessageTypeInsert {
+				continue
+			}
+			insertMsg, err := message.AsImmutableInsertMessageV1(body)
+			if err != nil {
+				continue
+			}
+			result, ok := message.IdempotentInsertResultFromInsertHeader(insertMsg.Header())
+			if !ok || message.ValidateIdempotentInsertResult(result) != nil {
+				continue
+			}
+			impl.txnInsertResultBuffers.Restore(body, result)
+		}
+	}
+}
+
 func (impl *idempotencyInterceptor) DoAppend(ctx context.Context, msg message.MutableMessage, append interceptors.Append) (message.MessageID, error) {
-	// Replicated messages bypass the idempotency window entirely: the replicate
-	// stream has its own exactly-once delivery (source-timetick checkpoints),
-	// and the idempotency key inside a replicated header belongs to the SOURCE
-	// cluster's window histo
```

**File**: `internal/streamingnode/server/wal/interceptors/idempotency/idempotency_interceptor_test.go` (modified, +696/-21)
```diff
@@ -27,9 +27,11 @@ import (
 	"github.com/milvus-io/milvus/internal/streamingnode/server/wal/interceptors/timetick/mvcc"
 	"github.com/milvus-io/milvus/internal/streamingnode/server/wal/interceptors/txn"
 	"github.com/milvus-io/milvus/internal/streamingnode/server/wal/metricsutil"
+	"github.com/milvus-io/milvus/internal/streamingnode/server/wal/recovery"
 	"github.com/milvus-io/milvus/internal/streamingnode/server/wal/utility"
 	"github.com/milvus-io/milvus/internal/util/streamingutil/status"
 	"github.com/milvus-io/milvus/pkg/v3/metrics"
+	"github.com/milvus-io/milvus/pkg/v3/mlog"
 	"github.com/milvus-io/milvus/pkg/v3/proto/messagespb"
 	"github.com/milvus-io/milvus/pkg/v3/proto/streamingpb"
 	"github.com/milvus-io/milvus/pkg/v3/streaming/util/message"
@@ -39,6 +41,12 @@ import (
 	"github.com/milvus-io/milvus/pkg/v3/util/tsoutil"
 )
 
+func testWindow(t *testing.T, impl *idempotencyInterceptor, vc string) *Window {
+	w := impl.cache.acquireWindow(vc)
+	t.Cleanup(w.release)
+	return w
+}
+
 func newInterceptor(config WindowConfig) *idempotencyInterceptor {
 	return newIdempotencyInterceptor(config)
 }
@@ -117,28 +125,77 @@ func TestInterceptorBypassesReplicatedInsert(t *testing.T) {
 	require.NoError(t, err)
 	require.True(t, replicatedID.EQ(msgID))
 	require.Equal(t, 2, appendCount)
+}
 
-	// A replicated insert with a fresh key must leave no trace in the window: a
-	// later native insert reusing that key is still the owner and appends.
-	ctx = utility.WithExtraAppendResult(context.Background(), &utility.ExtraAppendResult{})
-	_, err = interceptor.DoAppend(ctx, withTestReplicateHeader(newIdempotentInsertMessage(t, "v1", "key-2")), func(ctx context.Context, msg message.MutableMessage) (message.MessageID, error) {
+// A replicated insert is recorded after it lands, so a client retry on this
+// cluster after a promotion answers with the source cluster's primary keys
+// instead of appending a second copy.
+func TestInterceptorRecordsReplicatedInsert(t *testing.T) {
+	interceptor := newInterceptor(WindowConfig{})
+	insertResult := &messagespb.IdempotentInsertResult{
+		RowOffsets: []uint32{0, 1},
+		Ids: &schemapb.IDs{
+			IdField: &schemapb.IDs_IntId{IntId: &schemapb.LongArray{Data: []int64{100, 101}}},
+		},
+	}
+
+	appendCount := 0
+	replicatedID := newTestMessageID(12)
+	replicatedLastConfirmed := newTestMessageID(11)
+	ctx := utility.WithExtraAppendResult(context.Background(), &utility.ExtraAppendResult{})
+	_, err := interceptor.DoAppend(ctx, withTestReplicateHeader(newIdempotentInsertMessageWithInsertResult(t, "v1", "key-2", insertResult)), func(ctx context.Context, msg message.MutableMessage) (message.MessageID, error) {
 		appendCount++
-		return newTestMessageID(12), nil
+		utility.ReplaceAppendResultTimeTick(ctx, 200)
+		utility.ReplaceAppendResultLastConfirmedMessageID(ctx, replicatedLastConfirmed)
+		return replicatedID, nil
 	})
 	require.NoError(t, err)
-	require.Equal(t, 3, appendCount)
+	require.Equal(t, 1, appendCount)
 
-	nativeID := newTestMessageID(13)
 	ctx = utility.WithExtraAppendResult(context.Background(), &utility.ExtraAppendResult{})
-	msgID, err = interceptor.DoAppend(ctx, newIdempotentInsertMessage(t, "v1", "key-2"), func(ctx context.Context, msg message.MutableMessage) (message.MessageID, error) {
+	msgID, err := interceptor.DoAppend(ctx, newIdempotentInsertMessage(t, "v1", "key-2"), func(ctx context.Context, msg message.MutableMessage) (message.MessageID, error) {
 		appendCount++
-		utility.ReplaceAppendResultTimeTick(ctx, 200)
-		utility.ReplaceAppendResultLastConfirmedMessageID(ctx, newTestMessageID(12))
-		return nativeID, nil
+		return newTestMessageID(13), nil
 	})
 	require.NoError(t, err)
-	require.True(t, nativeID.EQ(msgID))
-	require.Equal(t, 4, appendCount)
+	require.Equal(t, 1, appendCount)
+	require.True(t, replicatedID.EQ(msgID))
+
+	extra := utility.GetExtraAppendResult(ctx)
+	require.Equal(t, uint64(200), extra.TimeTick)
+	require.True(t, replicatedLastConfirmed.EQ(extra.LastConfirmedMessageID))
+	require.True(t, proto.Equal(insertResult, extra.Extra.(*messagespb.IdempotentInsertResult)))
+}
+
+// A replicated insert whose key the window already holds replaces the entry:
+// the source evicted the key and a client legally reused it, so the newer
+// write is what a retry must see.
+func TestInterceptorReplicatedInsertOverwritesSameKey(t *testing.T) {
+	interceptor := newInterceptor(WindowConfig{})
+
+	appendCount := 0
+	appendAt := func(timetick uint64, id int64) func(ctx context.Context, msg message.MutableMessage) (message.MessageID, error) {
+		return func(ctx context.Context, msg message.MutableMessage) (message.MessageID, error) {
+			appendCount++
+			utility.ReplaceAppendResultTimeTick(ctx, timetick)
+			utility.ReplaceAppendResultLastConfirmedMessageID(ctx, newTestMessageID(id-1))
+			return newTestMessageID(id), nil
+		}
+	}
+	ctx := utility.WithExtraAppendResult(context.Background(), &utility.ExtraAppendResult{})
+	_, err := interceptor.DoAppend(ctx,
```

**File**: `internal/streamingnode/server/wal/interceptors/idempotency/metrics.go` (modified, +9/-0)
```diff
@@ -41,9 +41,18 @@ func observeWindowEviction(vchannel string, count int) {
 // do not accumulate forever in the registry as the interceptor tears down. The
 // series are keyed by (node_id, vchannel); vchannel encodes its pchannel.
 func deleteWindowMetrics(vchannel string) {
+	deleteWindowGauges(vchannel)
+	deleteWindowCounters(vchannel)
+}
+
+func deleteWindowGauges(vchannel string) {
 	nodeID := paramtable.GetStringNodeID()
 	metrics.WALIdempotencyWindowEntries.DeleteLabelValues(nodeID, vchannel)
 	metrics.WALIdempotencyWindowInflight.DeleteLabelValues(nodeID, vchannel)
+}
+
+func deleteWindowCounters(vchannel string) {
+	nodeID := paramtable.GetStringNodeID()
 	metrics.WALIdempotencyDuplicateTotal.DeleteLabelValues(nodeID, vchannel)
 	metrics.WALIdempotencyEvictionTotal.DeleteLabelValues(nodeID, vchannel)
 }
```

**File**: `internal/streamingnode/server/wal/interceptors/idempotency/retention_test.go` (modified, +42/-1)
```diff
@@ -17,15 +17,18 @@
 package idempotency
 
 import (
+	"context"
 	"fmt"
 	"sync"
 	"sync/atomic"
 	"testing"
 	"time"
 
+	"github.com/prometheus/client_golang/prometheus/testutil"
 	"github.com/stretchr/testify/require"
 
 	"github.com/milvus-io/milvus/internal/streamingnode/server/wal/idempotencyview"
+	"github.com/milvus-io/milvus/pkg/v3/metrics"
 	"github.com/milvus-io/milvus/pkg/v3/util/paramtable"
 	"github.com/milvus-io/milvus/pkg/v3/util/tsoutil"
 )
@@ -123,14 +126,19 @@ func TestPChannelRetentionIdleCleanupAndShutdown(t *testing.T) {
 		Now: func() time.Time { return time.Unix(0, clock.Load()) },
 	})
 	defer interceptor.Close()
-	w := interceptor.window("idle")
+	w := interceptor.cache.acquireWindow("idle")
 	for i := 0; i < 600; i++ {
 		completeKey(t, w, IdempotencyKey(fmt.Sprint(i)), uint64(i+1))
 	}
 	require.Equal(t, 600, w.Len())
+	w.release()
 	clock.Add(int64(20 * time.Millisecond))
 	require.Eventually(t, func() bool { return w.Len() == 0 }, 5*time.Second, 5*time.Millisecond,
 		"expired records must be reclaimed without another append")
+	interceptor.cache.mu.Lock()
+	_, found := interceptor.cache.windows["idle"]
+	interceptor.cache.mu.Unlock()
+	require.False(t, found)
 	interceptor.cache.shutdown()
 	select {
 	case <-interceptor.cache.done:
@@ -139,6 +147,39 @@ func TestPChannelRetentionIdleCleanupAndShutdown(t *testing.T) {
 	}
 }
 
+func TestEmptyWindowRemainsRegisteredWhileInUse(t *testing.T) {
+	paramtable.Init()
+	m := newWindowManager(WindowConfig{MaxSize: 1})
+	const vc = "pending-window"
+	owner := m.acquireWindow(vc)
+	msg := newIdempotentInsertMessage(t, vc, "key")
+	pending := owner.Begin("key", msg).Pending
+	waiter := m.acquireWindow(vc)
+	require.Same(t, pending, waiter.Begin("key", msg).Pending)
+	owner.Complete(pending, CommitResult{CommitTimeTick: 1}, msg)
+	owner.release()
+	require.Zero(t, waiter.Len(), "the record exceeds the byte budget")
+	again := m.acquireWindow(vc)
+	require.Same(t, waiter, again)
+	again.release()
+	require.NotNil(t, pending.Wait(context.Background(), msg).Entry)
+	waiter.release()
+	require.NotContains(t, m.windows, vc)
+	node := paramtable.GetStringNodeID()
+	require.False(t, metrics.WALIdempotencyWindowEntries.DeleteLabelValues(node, vc))
+	require.False(t, metrics.WALIdempotencyWindowInflight.DeleteLabelValues(node, vc))
+	require.EqualValues(t, 1, testutil.ToFloat64(metrics.WALIdempotencyDuplicateTotal.WithLabelValues(node, vc)))
+	require.EqualValues(t, 1, testutil.ToFloat64(metrics.WALIdempotencyEvictionTotal.WithLabelValues(node, vc)))
+	next := m.acquireWindow(vc)
+	completeKey(t, next, "other", 2)
+	next.release()
+	require.EqualValues(t, 2, testutil.ToFloat64(metrics.WALIdempotencyEvictionTotal.WithLabelValues(node, vc)))
+	m.dropVChannel(vc)
+	require.NotContains(t, m.idleCounters, vc)
+	require.False(t, metrics.WALIdempotencyDuplicateTotal.DeleteLabelValues(node, vc))
+	require.False(t, metrics.WALIdempotencyEvictionTotal.DeleteLabelValues(node, vc))
+}
+
 func TestPChannelRetentionConcurrentWindows(t *testing.T) {
 	m := newWindowManager(WindowConfig{TTL: time.Hour, MaxSize: 512, MinCount: 2})
 	var wg sync.WaitGroup
```

**File**: `internal/streamingnode/server/wal/interceptors/idempotency/utils/txn_insert_results_buffer.go` (modified, +61/-2)
```diff
@@ -48,7 +48,34 @@ func (bs *TxnInsertResultBuffers) Add(msg message.MutableMessage, result *messag
 	if !hasTxnKey {
 		return
 	}
-	expiredTimeTick := txnExpiredTimeTick(msg.TxnContext(), timeTick)
+	bs.add(key, bufferTxnContext(msg.TxnContext(), msg.ReplicateHeader() != nil), result, timeTick)
+}
+
+// Restore records the insert result of a txn body that is already in the WAL,
+// for a transaction that is still open after a restart.
+func (bs *TxnInsertResultBuffers) Restore(body message.ImmutableMessage, result *messagespb.IdempotentInsertResult) {
+	txnCtx := body.TxnContext()
+	if txnCtx == nil {
+		return
+	}
+	bs.add(txnKey{vchannel: body.VChannel(), txnID: txnCtx.TxnID}, bufferTxnContext(txnCtx, body.ReplicateHeader() != nil), result, body.TimeTick())
+}
+
+// bufferTxnContext returns the txn context whose keepalive bounds a body's
+// buffered result. A replicated body carries the source cluster's finite
+// keepalive, but the source owns a replicated transaction's lifecycle: it cannot
+// expire locally, so its buffer is reclaimed only through the txn-active check,
+// never by a keepalive measured from a body timetick that a restart leaves far
+// behind.
+func bufferTxnContext(txnCtx *message.TxnContext, replicated bool) *message.TxnContext {
+	if txnCtx == nil || !replicated || txnCtx.Keepalive == message.TxnKeepaliveInfinite {
+		return txnCtx
+	}
+	return &message.TxnContext{TxnID: txnCtx.TxnID, Keepalive: message.TxnKeepaliveInfinite}
+}
+
+func (bs *TxnInsertResultBuffers) add(key txnKey, txnCtx *message.TxnContext, result *messagespb.IdempotentInsertResult, timeTick uint64) {
+	expiredTimeTick := txnExpiredTimeTick(txnCtx, timeTick)
 	currentTimeTick, hasCurrentTimeTick := bs.vchannelTimeTick(key.vchannel)
 
 	bs.mu.Lock()
@@ -85,6 +112,30 @@ func (bs *TxnInsertResultBuffers) Build(msg message.MutableMessage) *messagespb.
 	return builder.build()
 }
 
+// BuildIfComplete merges buffered insert results for a txn commit message, but
+// only when every body of the transaction contributed one: the number of
+// buffered results must equal bodyCnt, the body count the commit carries. It
+// returns nil when bodyCnt is 0 (unknown) or when results are missing, for
+// example after a restart emptied the buffer while the transaction itself
+// survived. A caller that records the result must not record a partial one,
+// which would answer a later retry with missing primary keys.
+func (bs *TxnInsertResultBuffers) BuildIfComplete(msg message.MutableMessage, bodyCnt uint64) *messagespb.IdempotentInsertResult {
+	key, hasTxnKey := keyOfTxnMessage(msg)
+	if !hasTxnKey || bodyCnt == 0 {
+		return nil
+	}
+	currentTimeTick, hasCurrentTimeTick := bs.vchannelTimeTick(key.vchannel)
+
+	bs.mu.Lock()
+	defer bs.mu.Unlock()
+	bs.clearExpiredLocked(key.vchannel, currentTimeTick, hasCurrentTimeTick)
+	builder := bs.builders[key.vchannel][key.txnID]
+	if builder == nil || uint64(len(builder.insertResults)) != bodyCnt {
+		return nil
+	}
+	return builder.build()
+}
+
 // Remove drops buffered insert results for a transaction.
 func (bs *TxnInsertResultBuffers) Remove(msg message.MutableMessage) {
 	key, hasTxnKey := keyOfTxnMessage(msg)
@@ -101,6 +152,13 @@ func (bs *TxnInsertResultBuffers) Remove(msg message.MutableMessage) {
 	bs.clearExpiredLocked(key.vchannel, currentTimeTick, hasCurrentTimeTick)
 }
 
+// Clear releases buffered results after a PChannel-wide transaction abort.
+func (bs *TxnInsertResultBuffers) Clear() {
+	bs.mu.Lock()
+	defer bs.mu.Unlock()
+	clear(bs.builders)
+}
+
 // RemoveVChannel drops every buffered transaction result for a reclaimed
 // vchannel. DropCollection is the last message for that vchannel, so normal
 // Add/Build/Remove-triggered sweeping will not get another chance to run.
@@ -126,7 +184,8 @@ func (bs *TxnInsertResultBuffers) clearExpiredLocked(vchannel string, currentTim
 		// manager. These transactions ended without a commit/rollback message
 		// reaching the interceptor (abort, expiry, failover), so the
 		// timetick-based expiry below cannot reclaim them -- in particular it
-		// never fires for infinite-keepalive (replicated) transactions.
+		// never fires for replicated transactions, whose bodies are buffered
+		// with an infinite keepalive (bufferTxnContext).
 		if bs.txnActive != nil && !bs.txnActive(txnID) {
 			delete(builders, txnID)
 			continue
```

**File**: `internal/streamingnode/server/wal/interceptors/idempotency/utils/txn_insert_results_buffer_test.go` (modified, +65/-0)
```diff
@@ -11,6 +11,8 @@ import (
 	"github.com/milvus-io/milvus-proto/go-api/v3/schemapb"
 	"github.com/milvus-io/milvus/pkg/v3/proto/messagespb"
 	"github.com/milvus-io/milvus/pkg/v3/streaming/util/message"
+	"github.com/milvus-io/milvus/pkg/v3/streaming/walimpls/impls/walimplstest"
+	"github.com/milvus-io/milvus/pkg/v3/util/tsoutil"
 )
 
 func newTestTxnMessage(t *testing.T, vchannel string, txnID message.TxnID) message.MutableMessage {
@@ -23,6 +25,18 @@ func newTestTxnMessage(t *testing.T, vchannel string, txnID message.TxnID) messa
 		WithTxnContext(message.TxnContext{TxnID: txnID, Keepalive: 10 * time.Second})
 }
 
+func replicatedTestTxnBody(t *testing.T, vchannel string, txnID message.TxnID) message.MutableMessage {
+	t.Helper()
+	return newTestTxnMessage(t, vchannel, txnID).
+		WithReplicateHeader(&message.ReplicateHeader{
+			ClusterID:              "source-cluster",
+			MessageID:              walimplstest.NewTestMessageID(1),
+			LastConfirmedMessageID: walimplstest.NewTestMessageID(1),
+			TimeTick:               1,
+			VChannel:               vchannel,
+		})
+}
+
 func intIDsResult(offsets []uint32, data ...int64) *messagespb.IdempotentInsertResult {
 	return &messagespb.IdempotentInsertResult{
 		RowOffsets: offsets,
@@ -42,6 +56,23 @@ func TestTxnInsertResultBuffersDropsEmptyVChannel(t *testing.T) {
 	require.Empty(t, buffers.builders, "an empty vchannel buffer must be dropped so the map does not leak one entry per vchannel")
 }
 
+// BuildIfComplete merges only when every body contributed: a partial merge would
+// answer a later retry with missing primary keys.
+func TestTxnInsertResultBuffersBuildIfCompleteRequiresEveryBody(t *testing.T) {
+	buffers := NewTxnInsertResultBuffers(nil, nil)
+	msg := newTestTxnMessage(t, "v1", 1)
+	buffers.Add(msg, intIDsResult([]uint32{0}, 100), 0)
+
+	require.Nil(t, buffers.BuildIfComplete(msg, 2), "one of two bodies is buffered")
+	require.Nil(t, buffers.BuildIfComplete(msg, 0), "an unknown body count cannot prove completeness")
+	require.Nil(t, buffers.BuildIfComplete(newTestTxnMessage(t, "v1", 2), 1), "nothing is buffered for this txn")
+
+	buffers.Add(msg, intIDsResult([]uint32{1}, 101), 0)
+	merged := buffers.BuildIfComplete(msg, 2)
+	require.NotNil(t, merged)
+	require.ElementsMatch(t, []int64{100, 101}, merged.GetIds().GetIntId().GetData())
+}
+
 func TestTxnInsertResultBuffersRemoveVChannel(t *testing.T) {
 	buffers := NewTxnInsertResultBuffers(nil, nil)
 	msg1 := newTestTxnMessage(t, "v1", 1)
@@ -102,3 +133,37 @@ func TestTxnInsertResultBuffersConcurrentAddBuildRemove(t *testing.T) {
 	wg.Wait()
 	require.Empty(t, buffers.builders, "all txns removed: the vchannel buffer must be dropped")
 }
+
+// A WAL reopen places the vchannel MVCC at the recovery timetick, which can sit
+// far ahead of a body written more than one keepalive before the restart. A
+// replicated body must survive that timetick: the source owns the transaction's
+// lifecycle, so its buffer is reclaimed only through the txn-active check.
+func TestTxnInsertResultBuffersReplicatedBodySurvivesAheadMVCC(t *testing.T) {
+	currentTimeTick := tsoutil.ComposeTS(20000, 0)
+	buffers := NewTxnInsertResultBuffers(func(string) (uint64, bool) {
+		return currentTimeTick, true
+	}, nil)
+
+	restored := replicatedTestTxnBody(t, "v1", 7).WithTimeTick(tsoutil.ComposeTS(0, 11))
+	buffers.Restore(restored.IntoImmutableMessage(walimplstest.NewTestMessageID(11)), intIDsResult([]uint32{0}, 100))
+	require.NotNil(t, buffers.BuildIfComplete(restored, 1),
+		"a restored replicated body must not expire just because the recovery MVCC is ahead")
+
+	added := replicatedTestTxnBody(t, "v1", 8).WithTimeTick(tsoutil.ComposeTS(0, 11))
+	buffers.Add(added, intIDsResult([]uint32{0}, 200), tsoutil.ComposeTS(0, 11))
+	require.NotNil(t, buffers.BuildIfComplete(added, 1),
+		"a replicated body buffered live must also ignore a MVCC that moved ahead")
+}
+
+// The same ahead MVCC still reclaims a native body: only replicated transactions
+// are immune to timetick-based expiry.
+func TestTxnInsertResultBuffersNativeBodyExpiresWhenMVCCAhead(t *testing.T) {
+	currentTimeTick := tsoutil.ComposeTS(20000, 0)
+	buffers := NewTxnInsertResultBuffers(func(string) (uint64, bool) {
+		return currentTimeTick, true
+	}, nil)
+
+	msg := newTestTxnMessage(t, "v1", 7).WithTimeTick(tsoutil.ComposeTS(0, 11))
+	buffers.Add(msg, intIDsResult([]uint32{0}, 100), tsoutil.ComposeTS(0, 11))
+	require.Nil(t, buffers.Build(msg))
+}
```

---

### Incident Patch 2: `548817d2` (2026-11-23)
**Commit Message**: build(deps): upgrade Go to 1.26.11 and golang.org/x/crypto to v0.59.0 for CVEs (#55781)

## Summary

Fix the High-severity Go stdlib CVE and the x/crypto openpgp advisory
reported by the daily image scan
(`milvusdb/milvus:master-20261119-20746425`).

| CVE | Component | Installed | Fixed | Severity |
|-----|-----------|-----------|-------|----------|
| CVE-2026-97054 | Go stdlib | v1.26.10 | 1.26.11 / 1.27.4 | High |
| GO-2026-5932 | golang.org/x/crypto (openpgp) | v0.58.0 | v0.59.0 |
Advisory |

- CVE-2026-97054: Go stdlib vulnerability fixed in 1.26.11 / 1.27.4.
- GO-2026-5932: `golang.org/x/crypto/openpgp` is unmaintained and unsafe
by design; removed in x/crypto v0.59.0. Milvus itself only imports
`x/crypto/bcrypt` (not openpgp), so this clears the scanner finding and
drops the unsafe package from the module graph.

## Change scope

Bump the Go toolchain `1.26.10` -> `1.26.11`:

- `go.mod` / `pkg/go.mod` / `tests/go_client/go.mod`
- builder images:
`build/docker/builder/cpu/{ubuntu22.04,ubuntu20.04,ubuntu24.04,amazonlinux2023,rockylinux9}/Dockerfile`,
`build/docker/builder/gpu/{ubuntu22.04,ubuntu20.04}/Dockerfile`
- `build/docker/meta-migration/builder/Dockerfile`,
`build/rpm/s

**File**: `.github/workflows/mac.yaml` (modified, +1/-1)
```diff
@@ -52,7 +52,7 @@ jobs:
       - name: Setup Go environment
         uses: actions/setup-go@v4
         with:
-          go-version: '1.26.10'
+          go-version: '1.26.11'
           cache: false
       - name: Download Caches
         uses: ./.github/actions/macos-cache-restore
```

**File**: `.github/workflows/publish-krte-images.yaml` (modified, +1/-1)
```diff
@@ -39,7 +39,7 @@ jobs:
         working-directory: build/docker/krte
         run: |
           export TAG=${{ steps.extracter.outputs.version }}-${{ steps.extracter.outputs.sha_short }}
-          docker build --build-arg IMAGE_ARG="milvusdb/krte:$TAG" --build-arg GO_VERSION=1.26.10 -t "milvusdb/krte:$TAG" .
+          docker build --build-arg IMAGE_ARG="milvusdb/krte:$TAG" --build-arg GO_VERSION=1.26.11 -t "milvusdb/krte:$TAG" .
       - name: Docker Push
         if: success() && (github.event_name == 'push' || github.event_name == 'workflow_dispatch' )&& github.repository == 'milvus-io/milvus'
         continue-on-error: true
```

**File**: `build/docker/builder/cpu/amazonlinux2023/Dockerfile` (modified, +1/-1)
```diff
@@ -37,7 +37,7 @@ ENV GOPATH /go
 ENV GOROOT /usr/local/go
 ENV GO111MODULE on
 ENV PATH $GOPATH/bin:$GOROOT/bin:$PATH
-RUN mkdir -p /usr/local/go && wget -qO- "https://go.dev/dl/go1.26.10.linux-$TARGETARCH.tar.gz" | tar --strip-components=1 -xz -C /usr/local/go && \
+RUN mkdir -p /usr/local/go && wget -qO- "https://go.dev/dl/go1.26.11.linux-$TARGETARCH.tar.gz" | tar --strip-components=1 -xz -C /usr/local/go && \
     mkdir -p "$GOPATH/src" "$GOPATH/bin" && \
     go clean --modcache && \
     chmod -R 777 "$GOPATH" && chmod -R a+w $(go env GOTOOLDIR)
```

**File**: `build/docker/builder/cpu/rockylinux9/Dockerfile` (modified, +1/-1)
```diff
@@ -43,7 +43,7 @@ ENV GOPATH /go
 ENV GOROOT /usr/local/go
 ENV GO111MODULE on
 ENV PATH $GOPATH/bin:$GOROOT/bin:$PATH
-RUN mkdir -p /usr/local/go && wget -qO- "https://go.dev/dl/go1.26.10.linux-$TARGETARCH.tar.gz" | tar --strip-components=1 -xz -C /usr/local/go && \
+RUN mkdir -p /usr/local/go && wget -qO- "https://go.dev/dl/go1.26.11.linux-$TARGETARCH.tar.gz" | tar --strip-components=1 -xz -C /usr/local/go && \
     mkdir -p "$GOPATH/src" "$GOPATH/bin" && \
     go clean --modcache && \
     chmod -R 777 "$GOPATH" && chmod -R a+w $(go env GOTOOLDIR)
```

**File**: `build/docker/builder/cpu/ubuntu20.04/Dockerfile` (modified, +1/-1)
```diff
@@ -56,7 +56,7 @@ ENV GOPATH /go
 ENV GOROOT /usr/local/go
 ENV GO111MODULE on
 ENV PATH $GOPATH/bin:$GOROOT/bin:$PATH
-RUN mkdir -p /usr/local/go && wget -qO- "https://go.dev/dl/go1.26.10.linux-$TARGETARCH.tar.gz" | tar --strip-components=1 -xz -C /usr/local/go && \
+RUN mkdir -p /usr/local/go && wget -qO- "https://go.dev/dl/go1.26.11.linux-$TARGETARCH.tar.gz" | tar --strip-components=1 -xz -C /usr/local/go && \
     mkdir -p "$GOPATH/src" "$GOPATH/bin" && \
     go clean --modcache && \
     chmod -R 777 "$GOPATH" && chmod -R a+w $(go env GOTOOLDIR)
```

**File**: `build/docker/builder/cpu/ubuntu22.04/Dockerfile` (modified, +1/-1)
```diff
@@ -53,7 +53,7 @@ ENV GOPATH /go
 ENV GOROOT /usr/local/go
 ENV GO111MODULE on
 ENV PATH $GOPATH/bin:$GOROOT/bin:$PATH
-RUN mkdir -p /usr/local/go && wget -qO- "https://go.dev/dl/go1.26.10.linux-$TARGETARCH.tar.gz" | tar --strip-components=1 -xz -C /usr/local/go && \
+RUN mkdir -p /usr/local/go && wget -qO- "https://go.dev/dl/go1.26.11.linux-$TARGETARCH.tar.gz" | tar --strip-components=1 -xz -C /usr/local/go && \
     mkdir -p "$GOPATH/src" "$GOPATH/bin" && \
     go clean --modcache && \
     chmod -R 777 "$GOPATH" && chmod -R a+w $(go env GOTOOLDIR)
```

**File**: `build/docker/builder/cpu/ubuntu24.04/Dockerfile` (modified, +1/-1)
```diff
@@ -49,7 +49,7 @@ ENV GOPATH /go
 ENV GOROOT /usr/local/go
 ENV GO111MODULE on
 ENV PATH $GOPATH/bin:$GOROOT/bin:$PATH
-RUN mkdir -p /usr/local/go && wget -qO- "https://go.dev/dl/go1.26.10.linux-$TARGETARCH.tar.gz" | tar --strip-components=1 -xz -C /usr/local/go && \
+RUN mkdir -p /usr/local/go && wget -qO- "https://go.dev/dl/go1.26.11.linux-$TARGETARCH.tar.gz" | tar --strip-components=1 -xz -C /usr/local/go && \
     mkdir -p "$GOPATH/src" "$GOPATH/bin" && \
     go clean --modcache && \
     chmod -R 777 "$GOPATH" && chmod -R a+w $(go env GOTOOLDIR)
```

**File**: `build/docker/builder/gpu/ubuntu20.04/Dockerfile` (modified, +1/-1)
```diff
@@ -58,7 +58,7 @@ ENV GOPATH /go
 ENV GOROOT /usr/local/go
 ENV GO111MODULE on
 ENV PATH $GOPATH/bin:$GOROOT/bin:$PATH
-RUN mkdir -p /usr/local/go && wget -qO- "https://go.dev/dl/go1.26.10.linux-$TARGETARCH.tar.gz" | tar --strip-components=1 -xz -C /usr/local/go && \
+RUN mkdir -p /usr/local/go && wget -qO- "https://go.dev/dl/go1.26.11.linux-$TARGETARCH.tar.gz" | tar --strip-components=1 -xz -C /usr/local/go && \
     mkdir -p "$GOPATH/src" "$GOPATH/bin" && \
     curl -sSfL https://raw.githubusercontent.com/golangci/golangci-lint/master/install.sh | sh -s -- -b ${GOROOT}/bin v2.11.3 && \
     # export GO111MODULE=on && go get github.com/quasilyte/go-ruleguard/cmd/ruleguard@v0.2.1 && \
```

---

### Incident Patch 3: `aa17fe45` (2026-11-23)
**Commit Message**: test: fix remaining chaos cleanup hooks for pytest 8 (#55828)

## What type of PR is this?

- [x] Test

## Description

Follow-up to #55501 (`test: fix chaos cleanup hook for pytest 8`), which
updated `tests/python_client/chaos/test_chaos_apply.py` from legacy `def
teardown(self)` to `def teardown_method(self)`.

Six remaining chaos test files still defined `def teardown(self)`, which
pytest 8 silently ignores. In `chaos-test-kafka-cron` build 4770 and
`chaos-test-wp-cron` build 2934, when
`test_chaos_apply_to_determined_pod.py` failed after creating a
`PodChaos` CR, cleanup never ran and leaked `PodChaos` CRs
(`test-etcd-leader-pod-kill-1795307084`,
`test-etcd-followers-pod-kill-1795354005`) into `chaos-testing`.

### Changes
- Rename `def teardown(self)` to `def teardown_method(self)` in:
  - `tests/python_client/chaos/test_chaos_apply_to_determined_pod.py`
  - `tests/python_client/chaos/test_chaos_apply_multi_replicas.py`
  - `tests/python_client/chaos/test_chaos_apply_to_coord.py`
  - `tests/python_client/chaos/test_chaos.py`
  - `tests/python_client/chaos/test_chaos_bulk_insert.py`
  - `tests/python_client/chaos/test_load_with_checker.py`
- Guard attribute lookups with `getatt

**File**: `tests/python_client/chaos/test_chaos.py` (modified, +12/-9)
```diff
@@ -121,15 +121,18 @@ def init_health_checkers(self):
         }
         self.health_checkers = checkers
 
-    def teardown(self):
-        chaos_res = CusResource(
-            kind=self._chaos_config["kind"],
-            group=constants.CHAOS_GROUP,
-            version=constants.CHAOS_VERSION,
-            namespace=constants.CHAOS_NAMESPACE,
-        )
-        meta_name = self._chaos_config.get("metadata", None).get("name", None)
-        chaos_res.delete(meta_name, raise_ex=False)
+    def teardown_method(self):
+        chaos_config = getattr(self, "_chaos_config", None)
+        if chaos_config:
+            chaos_res = CusResource(
+                kind=chaos_config["kind"],
+                group=constants.CHAOS_GROUP,
+                version=constants.CHAOS_VERSION,
+                namespace=constants.CHAOS_NAMESPACE,
+            )
+            meta_name = chaos_config.get("metadata", {}).get("name", None)
+            if meta_name:
+                chaos_res.delete(meta_name, raise_ex=False)
         sleep(2)
         log.info(f"Alive threads: {threading.enumerate()}")
 
```

**File**: `tests/python_client/chaos/test_chaos_apply_multi_replicas.py` (modified, +4/-2)
```diff
@@ -250,8 +250,10 @@ def reconnect(self):
         if connections.has_connection("default") is False:
             raise Exception("no connections")
 
-    def teardown(self):
-        for chaos_config in self.chaos_configs:
+    def teardown_method(self):
+        for chaos_config in getattr(self, "chaos_configs", []):
+            if not chaos_config:
+                continue
             chaos_res = CusResource(
                 kind=chaos_config["kind"],
                 group=constants.CHAOS_GROUP,
```

**File**: `tests/python_client/chaos/test_chaos_apply_to_coord.py` (modified, +12/-9)
```diff
@@ -46,15 +46,18 @@ def reconnect(self):
         if connections.has_connection("default") is False:
             raise Exception("no connections")
 
-    def teardown(self):
-        chaos_res = CusResource(
-            kind=self.chaos_config["kind"],
-            group=constants.CHAOS_GROUP,
-            version=constants.CHAOS_VERSION,
-            namespace=constants.CHAOS_NAMESPACE,
-        )
-        meta_name = self.chaos_config.get("metadata", None).get("name", None)
-        chaos_res.delete(meta_name, raise_ex=False)
+    def teardown_method(self):
+        chaos_config = getattr(self, "chaos_config", None)
+        if chaos_config:
+            chaos_res = CusResource(
+                kind=chaos_config["kind"],
+                group=constants.CHAOS_GROUP,
+                version=constants.CHAOS_VERSION,
+                namespace=constants.CHAOS_NAMESPACE,
+            )
+            meta_name = chaos_config.get("metadata", {}).get("name", None)
+            if meta_name:
+                chaos_res.delete(meta_name, raise_ex=False)
         sleep(2)
 
     def test_chaos_apply(self, chaos_type, role_type, target_component, chaos_duration, chaos_interval):
```

**File**: `tests/python_client/chaos/test_chaos_apply_to_determined_pod.py` (modified, +4/-3)
```diff
@@ -51,7 +51,7 @@ def reconnect(self):
         if connections.has_connection("default") is False:
             raise Exception("no connections")
 
-    def teardown(self):
+    def teardown_method(self):
         chaos_config = getattr(self, "chaos_config", None)
         if chaos_config:
             chaos_res = CusResource(
@@ -60,8 +60,9 @@ def teardown(self):
                 version=constants.CHAOS_VERSION,
                 namespace=constants.CHAOS_NAMESPACE,
             )
-            meta_name = chaos_config.get("metadata", None).get("name", None)
-            chaos_res.delete(meta_name, raise_ex=False)
+            meta_name = chaos_config.get("metadata", {}).get("name", None)
+            if meta_name:
+                chaos_res.delete(meta_name, raise_ex=False)
         sleep(2)
 
     def test_chaos_apply(self, chaos_type, target_pod, chaos_duration, chaos_interval, wait_signal):
```

**File**: `tests/python_client/chaos/test_chaos_bulk_insert.py` (modified, +12/-9)
```diff
@@ -132,15 +132,18 @@ def prepare_bulk_insert(self, nb=3000):
         self.health_checkers[Op.bulk_insert].update(schema=schema, files=files)
         log.info("prepare data for bulk load done")
 
-    def teardown(self):
-        chaos_res = CusResource(
-            kind=self._chaos_config["kind"],
-            group=constants.CHAOS_GROUP,
-            version=constants.CHAOS_VERSION,
-            namespace=constants.CHAOS_NAMESPACE,
-        )
-        meta_name = self._chaos_config.get("metadata", None).get("name", None)
-        chaos_res.delete(meta_name, raise_ex=False)
+    def teardown_method(self):
+        chaos_config = getattr(self, "_chaos_config", None)
+        if chaos_config:
+            chaos_res = CusResource(
+                kind=chaos_config["kind"],
+                group=constants.CHAOS_GROUP,
+                version=constants.CHAOS_VERSION,
+                namespace=constants.CHAOS_NAMESPACE,
+            )
+            meta_name = chaos_config.get("metadata", {}).get("name", None)
+            if meta_name:
+                chaos_res.delete(meta_name, raise_ex=False)
         sleep(2)
         log.info(f"Alive threads: {threading.enumerate()}")
 
```

**File**: `tests/python_client/chaos/test_load_with_checker.py` (modified, +12/-9)
```diff
@@ -99,15 +99,18 @@ def prepare_bulk_insert(self, nb=30000, row_based=True):
         self.health_checkers[Op.bulk_insert].update(schema=schema, files=files, row_based=row_based)
         log.info("prepare data for bulk insert done")
 
-    def teardown(self):
-        chaos_res = CusResource(
-            kind=self._chaos_config["kind"],
-            group=constants.CHAOS_GROUP,
-            version=constants.CHAOS_VERSION,
-            namespace=constants.CHAOS_NAMESPACE,
-        )
-        meta_name = self._chaos_config.get("metadata", None).get("name", None)
-        chaos_res.delete(meta_name, raise_ex=False)
+    def teardown_method(self):
+        chaos_config = getattr(self, "_chaos_config", None)
+        if chaos_config:
+            chaos_res = CusResource(
+                kind=chaos_config["kind"],
+                group=constants.CHAOS_GROUP,
+                version=constants.CHAOS_VERSION,
+                namespace=constants.CHAOS_NAMESPACE,
+            )
+            meta_name = chaos_config.get("metadata", {}).get("name", None)
+            if meta_name:
+                chaos_res.delete(meta_name, raise_ex=False)
         sleep(2)
         log.info(f"Alive threads: {threading.enumerate()}")
 
```

#### Recent Merged Pull Requests:
- **PR #55829** (2026-11-23): fix: format RPC context for QueryView streaming errors (@zhuwenxing)
- **PR #55828** (2026-11-23): test: fix remaining chaos cleanup hooks for pytest 8 (@zhuwenxing)
- **PR #55826** (2026-11-23): build(deps): [3.0] bump milvus-storage for independent writer buffer release (@xaxys)
- **PR #55824** (2026-11-23): fix: [cp 3.0] retain unhandled WAL messages after consumer reconnect (@chyezh)
- **PR #55822** (2026-11-23): fix: retain unhandled WAL messages after consumer reconnect (@chyezh)
- **PR #55817** (2026-11-22): enhance: Read the schema snapshot in the growing segment load path (@xiaofan-luan)

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

## X. record replicated idempotency keys on the secondary

**RULE**:
When implementing operations in `docs/design-docs/design_docs/20260604-idempotent_write.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in milvus-io/milvus. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `f81b4bca`: record replicated idempotency keys on the secondary. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/design-docs/design_docs/20260604-idempotent_write.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
- Cross-cluster dedup of replicated writes. A replicated write is never deduplicated
  against the local window; it is only recorded there, so that a client retry after a
  planned switchover can reuse the result while the secondary retains the key (see
  [Replication and CDC](#replication-and-cdc)). Keys that replication had not delivered
  before a force promote are not recovered.
Replicated messages are **recorded in the window but never checked against it**.

The window is never read for a replicated message. The replicate stream has its own
and a client legally re-issued it. So a replicated message is appended unconditionally.

The window is written after the append. A replicated Insert carries the source's key and
its `idempotent_result` header; a replicated transaction carries them on its bodies and
its commit, and the interceptor merges the body results on the commit exactly as it does
for a native transaction. The recorded entry replaces an entry already held for the key:
when the source evicted the key and a client legally reused it, the newer write is the one
a retry must see. The recovery observer applies the same rule, so a window rebuilt from
Summary carries the repli
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
- Cross-cluster dedup. Replicated writes bypass the window entirely (see
  [Replication and CDC](#replication-and-cdc)).
Replicated messages **bypass the window entirely**. The replicate stream has its own
and a client legally re-issued it.

The recovery observer applies the same rule: a replicated write becomes a *keyless*
committed write in Summary, so a foreign key can never materialize a local dedup
entry. Its local WAL positions still participate in Summary persistence and
checkpoint gating.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `f81b4bca` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
