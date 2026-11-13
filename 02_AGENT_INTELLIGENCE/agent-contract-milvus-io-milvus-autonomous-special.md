# Agent Contract: Agent Contract: milvus/io/milvus Autonomous Specialist Persona

<!-- PROVENANCE_START
{
  "source_repository": "milvus/io/milvus",
  "source_url": "https://github.com/milvus/io/milvus",
  "source_version": "historical-head",
  "license": "OPEN_HARVEST",
  "timestamp": "2026-11-13T07:59:57.599Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "unknown",
  "canonical_classification": "agent_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [milvus/io/milvus](https://github.com/milvus/io/milvus) (Revision: `historical`).  
> **License**: OPEN_HARVEST | **Timestamp**: `2026-11-13T07:59:57.599Z`  
> **Learning ID**: `unknown`


## 1. Agent Role & Persona Contract
- **Role Identifier**: `milvus-io-milvus-specialist`
- **Governing Capability**: Autonomous execution and domain-specialized problem resolution.
- **Trust Boundary**: Reads and modifies only authorized workspace resources.

## 2. Operational Capabilities
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/milvus-io-milvus-learnings.md`  
> **Source**: github ([https://github.com/milvus-io/milvus](https://github.com/milvus-io/milvus))  
> **Source Version**: `0ff3d233`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-12T12:32:49.353Z  
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
> **Harvest Timestamp**: 2026-11-12T12:32:49.342Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `milvus-io/milvus`
- **Description**: Milvus is a high-performance, cloud-native vector database built for scalable vector ANN search
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 46649 stars

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
- **Issue #55464** (2026-11-12): **test: [cp 3.0] harden REST import correctness and completion polling**
  *Symptoms*: ## Summary  Backport REST import testcase repairs to 3.0 for the release nightly. Use AutoID so repeated input files produce distinct rows, poll all distinct job IDs under one deadline, and verify exact query-visible row counts and source-value multiplicity.  Keep the 1,000-job / 20,000-row correctness case at L2 and the 4.8-million-row load scenario at L3. Add pytest timeouts and the REST query helpers needed by the repaired case. Missing rows remain hard failures.  Fix the ordinary import case's deadline handling without increasing its 360-second budget. A job finished at 356.5 seconds, but the old loop returned a stale pre-sleep state and failed. Observe the final state at a monotonic deadline and report terminal failures directly.  Align NumPy Struct Array import coverage with master: job admission succeeds, then asynchronous schema validation reports Failed. Verify the specific rejection reason and unchanged existing rows. Backup/snapshot rejection assertions remain unchanged.  Related to #55454; this changes regression coverage, not server behavior.  ## Validation  - Ruff 0.15.11 lint and formatting passed for all modified Python files; dependency and diff checks passed. - Three deterministic polling regressions passed; NumPy/backup/snapshot collection selects three cases. - Full regular-suite collection selected 960 instances using PyMilvus 3.0.4rc1. - The 1,000-job case passed in the unified six-worker full-suite run on server commit `10de5d3069`, including exactly 20

- **Issue #55463** (2026-11-12): **test: harden REST import correctness and completion polling**
  *Symptoms*: ## Summary  Concurrent REST import tests reused fixed primary keys across jobs, making their visible-row expectation unreliable. Generate primary keys with AutoID, verify distinct job IDs, poll all jobs on one deadline, and assert the exact query-visible row count and source-value multiplicity.  Keep the 1,000-job / 20,000-row correctness regression at L2 and classify the 48-job / 4.8-million-row load test as L3. Add bounded pytest timeouts. Missing rows remain hard failures.  Fix import polling at the deadline: a job that completed during the final sleep previously caused a false timeout. Use a monotonic deadline, read the final state, and retain the original 360-second budget in the ordinary import E2E case. Return immediately on a terminal failure and include the last response in assertion failures.  Related to #55454. This changes tests, not the server implementation.  ## Validation  - Ruff 0.15.11 lint and format checks passed for all modified Python files; dependency consistency and diff checks passed. - Three deterministic polling regressions passed: completion during the final interval, unfinished work at the deadline, and terminal failure. - Collection confirms the 1,000-job case is selected at L2 and the large-data case only at L3. - The repaired 1,000-job case passed with exactly 20,000 query-visible rows in the unified six-worker full-suite run on server commit `584004ae14` (642.57 seconds). - Full L0-L2 selection completed on the standard standalone profile: 1,14

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

### Incident Patch 1: `34e03edc` (2026-11-12)
**Commit Message**: test: add PyUDF search, lifecycle and runtime regression coverage (#55386)

Add Python SDK and REST regression coverage for PyUDF search,
resource/snapshot lifecycles, index combinations, admission,
cancellation and worker pools. Preserve strict score and lifecycle
assertions while sharing resource fixtures and independent workload
oracles.

System workloads run through pytest in
`tests/python_client/system_tests/pyudf/`, with combined `L3` and
`pyudf` tags. Fixtures retain live clients and prepared inputs through
each scenario and own cleanup, including partial setup failures. STOP
guards cover preparation, baseline queries, audits and load. Probe
cleanup attempts every owned resource and preserves the original failure
alongside cleanup errors. Tests and custom environment definitions
belong in Milvus; test-jobs owns orchestration.

ABBA and batch measurements are independently selectable for
HNSW/DISKANN, so rerunning the six-minute batch matrix no longer
requires the preceding fifty-minute instrumentation/ABBA phase. Worker
counters use an explicit UDF subclass and atomic PID-bound snapshots,
without source-text rewriting or unused mmap files. SDK cases use
standard index types 

**File**: `tests/python_client/base/client_v2_pyudf_base.py` (added, +344/-0)
```diff
@@ -0,0 +1,344 @@
+"""Owned wheel, collection and permission lifecycles for PyUDF SDK cases."""
+
+import io
+import time
+from contextlib import ExitStack, contextmanager
+
+import grpc
+import pytest
+from base.client_v2_base import TestMilvusClientV2Base
+from common import common_func as cf
+from common.common_type import CheckTasks
+from common.pyudf_helpers import build_wheel
+from pymilvus import DataType, FunctionChain, FunctionChainStage, MilvusClient
+from pymilvus.function_chain import col
+from pymilvus.function_chain.chain import FunctionChainExpr
+
+
+class PyUDFClientBase(TestMilvusClientV2Base):
+    """Share fixture ownership without importing or inheriting collected tests."""
+
+    dim = 2
+    vector_field = "vector"
+    scalar_field = "ts"
+
+    @staticmethod
+    def _pyudf_management_config(request, key):
+        import requests
+
+        endpoint = request.config.getoption("--pyudf-management-endpoint")
+        assert endpoint, "requires --pyudf-management-endpoint pointing to the coordinator management service"
+        response = requests.get(
+            endpoint.rstrip("/") + "/management/config/get",
+            params={"keys": key},
+            timeout=10,
+        )
+        response.raise_for_status()
+        entry = response.json()["configs"][0]
+        assert entry["key"] == key and "value" in entry, entry
+        return entry["value"]
+
+    @staticmethod
+    def _build_wheel(tmp_path, package_name, module=None, entry_points=None):
+        wheel_path = tmp_path / f"{package_name}-0.0.1-py3-none-any.whl"
+        if module is None:
+            module = """import pyarrow as pa
+
+
+class UDF:
+    def __init__(self, context):
+        self.context = context
+
+    def transform_query(self, params, columns):
+        factor = float(params.get("factor", 1.0))
+        values = [float(value.as_py()) * factor for value in columns[1]]
+        return [pa.array(values, type=pa.float32())]
+
+
+def create_udf(context):
+    return UDF(context)
+"""
+        wheel_path.write_bytes(build_wheel(package_name, module, entry_points=entry_points))
+        return wheel_path
+
+    @staticmethod
+    def _hit_field(hit, field):
+        if field in hit:
+            return hit[field]
+        return hit.get("entity", {}).get(field)
+
+    @staticmethod
+    def _remove_file_resource(client, resource_name, timeout=30):
+        deadline = time.time() + timeout
+        while time.time() < deadline:
+            try:
+                client.remove_file_resource(name=resource_name)
+                return
+            except Exception as exc:
+                if "not found" in str(exc):
+                    return
+                time.sleep(1)
+        client.remove_file_resource(name=resource_name)
+
+    def _search_with_synced_resource(
+        self, client, collection_name, chain, timeout=30, data=None, limit=3, search_params=None, **kwargs
+    ):
+        deadline = time.time() + timeout
+        queries = [[0.0, 0.0]] if data is None else data
+        while True:
+            try:
+                return client.search(
+                    collection_name=collection_name,
+                    data=queries,
+                    anns_field=self.vector_field,
+                    search_params={"metric_type": "L2"} if search_params is None else search_params,
+                    limit=limit,
+                    output_fields=[self.scalar_field],
+                    function_chains=chain,
+                    **kwargs,
+                )
+            except Exception as exc:
+                message = str(exc)
+                transient = (
+                    "file resource snapshot is not ready" in message
+                    or "file resource" in message
+                    and "not found" in message
+                )
+                if not transient or time.time() >= deadline:
+                    raise
+                time.sleep(1)
+
+    def _wait_for_removed_pyudf(self, client, collection_name, chain, resource_name, timeout=30):
+        deadline = time.time() + timeout
+        while True:
+            try:
+                client.search(
+                    collection_name=collection_name,
+                    data=[[0.0, 0.0]],
+                    anns_field=self.vector_field,
+                    search_params={"metric_type": "L2"},
+                    limit=3,
+                    output_fields=[self.scalar_field],
+                    function_chains=chain,
+                )
+            except Exception as exc:
+                message = str(exc)
+                if "py_udf: file resource" in message and resource_name in message and "not found" in message:
+                    return
+                raise
+            if time.time() >= deadline:
+                raise AssertionError(f"removed PyUDF resource {resource_name!r} remains executable")
+            time.sleep(1)
+
+    @contextmanager
+    def _pyudf_test_environment(
+        self,
+ 
```

**File**: `tests/python_client/common/pyudf_helpers.py` (modified, +15/-20)
```diff
@@ -1,17 +1,17 @@
 """Small PyUDF fixtures shared by CI tests."""
 
-import errno
 import io
-import socket
 import zipfile
 
 
-def build_wheel(package, module):
+def build_wheel(package, module, *, entry_points=None):
     """Build a wheel containing only the supplied UDF module and entry point."""
     output = io.BytesIO()
     files = {
         f"{package}/__init__.py": module,
-        f"{package}-0.0.1.dist-info/entry_points.txt": f"[milvus.pyudf]\nmain = {package}:create_udf\n",
+        f"{package}-0.0.1.dist-info/entry_points.txt": (
+            f"[milvus.pyudf]\nmain = {package}:create_udf\n" if entry_points is None else entry_points
+        ),
         f"{package}-0.0.1.dist-info/METADATA": f"Metadata-Version: 2.1\nName: {package}\nVersion: 0.0.1\n",
     }
     with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_STORED) as wheel:
@@ -20,19 +20,14 @@ def build_wheel(package, module):
     return output.getvalue()
 
 
-def probe_endpoint(host, public_port=19530, worker_port=19090):
-    """Check only the supplied address; a Service address does not prove Pod isolation."""
-    observed = {}
-    for label, port in (("public_api", public_port), ("worker_rpc", worker_port)):
-        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as connection:
-            connection.settimeout(2)
-            observed[label] = {"port": port, "tcp_connect_code": connection.connect_ex((host, port))}
-    assert observed["public_api"]["tcp_connect_code"] == 0, observed
-    assert observed["worker_rpc"]["tcp_connect_code"] in {
-        errno.ECONNREFUSED,
-        errno.ETIMEDOUT,
-        errno.EHOSTUNREACH,
-        errno.ENETUNREACH,
-        errno.EAGAIN,
-    }, observed
-    return {"observation": observed}
+def assert_pyudf_deadline(call):
+    import grpc
+    import pytest
+    from pymilvus import MilvusException
+
+    with pytest.raises((MilvusException, grpc.RpcError)) as caught:
+        call()
+    if isinstance(caught.value, grpc.RpcError):
+        assert caught.value.code() == grpc.StatusCode.DEADLINE_EXCEEDED, caught.value
+    else:
+        assert caught.value.code == 10001, caught.value
```

**File**: `tests/python_client/conftest.py` (modified, +5/-0)
```diff
@@ -43,6 +43,11 @@
 
 
 def pytest_addoption(parser):
+    parser.addoption(
+        "--pyudf-expected-commit",
+        default=None,
+        help="Optional deployed Git commit prefix for dedicated PyUDF profiles.",
+    )
     parser.addoption(
         "--struct-max-array-capacity",
         type=int,
```

**File**: `tests/python_client/milvus_client/test_milvus_client_pyudf.py` (modified, +37/-350)
```diff
@@ -3,11 +3,11 @@
 import time
 import zipfile
 from concurrent.futures import ThreadPoolExecutor
-from contextlib import ExitStack, contextmanager
+from contextlib import ExitStack
 
 import grpc
 import pytest
-from base.client_v2_base import TestMilvusClientV2Base
+from base.client_v2_pyudf_base import PyUDFClientBase
 from common import common_func as cf
 from common.common_type import CaseLabel, CheckTasks
 from google.protobuf.message import DecodeError
@@ -30,115 +30,19 @@
 prefix = "pyudf"
 
 
-class TestMilvusClientPyUDF(TestMilvusClientV2Base):
+class TestMilvusClientPyUDF(PyUDFClientBase):
     """End-to-end tests for PyUDF-backed FunctionChain reranking."""
 
     dim = 2
     vector_field = "vector"
     scalar_field = "ts"
 
-    @staticmethod
-    def _pyudf_management_config(request, key):
-        import requests
-
-        endpoint = request.config.getoption("--pyudf-management-endpoint")
-        assert endpoint, "requires --pyudf-management-endpoint pointing to the coordinator management service"
-        response = requests.get(
-            endpoint.rstrip("/") + "/management/config/get",
-            params={"keys": key},
-            timeout=10,
-        )
-        response.raise_for_status()
-        entry = response.json()["configs"][0]
-        assert entry["key"] == key and "value" in entry, entry
-        return entry["value"]
-
-    @staticmethod
-    def _build_wheel(tmp_path, package_name, module=None, entry_points=None):
-        wheel_path = tmp_path / f"{package_name}-0.0.1-py3-none-any.whl"
-        if module is None:
-            module = """import pyarrow as pa
-
-
-class UDF:
-    def __init__(self, context):
-        self.context = context
-
-    def transform_query(self, params, columns):
-        factor = float(params.get("factor", 1.0))
-        values = [float(value.as_py()) * factor for value in columns[1]]
-        return [pa.array(values, type=pa.float32())]
-
-
-def create_udf(context):
-    return UDF(context)
-"""
-        dist_info = f"{package_name}-0.0.1.dist-info"
-        with zipfile.ZipFile(wheel_path, "w", compression=zipfile.ZIP_STORED) as wheel:
-            wheel.writestr(f"{package_name}/__init__.py", module)
-            wheel.writestr(
-                f"{dist_info}/entry_points.txt",
-                f"[milvus.pyudf]\nmain = {package_name}:create_udf\n" if entry_points is None else entry_points,
-            )
-            wheel.writestr(
-                f"{dist_info}/METADATA",
-                f"Metadata-Version: 2.1\nName: {package_name}\nVersion: 0.0.1\n",
-            )
-        return wheel_path
-
-    @staticmethod
-    def _hit_field(hit, field):
-        if field in hit:
-            return hit[field]
-        return hit.get("entity", {}).get(field)
-
     @staticmethod
     def _assert_intermediate_field_absent(hits, field):
         for hit in hits:
             assert field not in hit, hit
             assert field not in hit.get("entity", {}), hit
 
-    @staticmethod
-    def _remove_file_resource(client, resource_name, timeout=30):
-        deadline = time.time() + timeout
-        while time.time() < deadline:
-            try:
-                client.remove_file_resource(name=resource_name)
-                return
-            except Exception as exc:
-                if "not found" in str(exc):
-                    return
-                time.sleep(1)
-        client.remove_file_resource(name=resource_name)
-
-    def _search_with_synced_resource(
-        self, client, collection_name, chain, timeout=30, data=None, limit=3, search_params=None, **kwargs
-    ):
-        deadline = time.time() + timeout
-        queries = [[0.0, 0.0]] if data is None else data
-        while True:
-            try:
-                return client.search(
-                    collection_name=collection_name,
-                    data=queries,
-                    anns_field=self.vector_field,
-                    search_params={"metric_type": "L2"} if search_params is None else search_params,
-                    limit=limit,
-                    output_fields=[self.scalar_field],
-                    function_chains=chain,
-                    **kwargs,
-                )
-            except Exception as exc:
-                message = str(exc)
-                transient = (
-                    "file resource snapshot is not ready" in message
-                    or "file resource" in message
-                    and "not found" in message
-                )
-                if not transient or time.time() >= deadline:
-                    raise
-                time.sleep(1)
-
     def _wait_for_file_resource_absent(self, client, resource_name, timeout=30):
         deadline = time.time() + timeout
         while True:
@@ -150,192 +54,6 @@ def _wait_for_file_resource_absent(self, client, resource_name, timeout=30):
                 raise AssertionError(f"file resource {resource_name!r} was not removed")
             time.sleep(1)
 
-    def
```

**File**: `tests/python_client/milvus_client/test_milvus_client_pyudf_concurrency.py` (added, +655/-0)
```diff
@@ -0,0 +1,655 @@
+"""Search admission, cancellation and worker-pool concurrency on dedicated profiles."""
+
+import io
+import json
+import statistics
+import sys
+import threading
+import time
+import uuid
+from concurrent.futures import ThreadPoolExecutor, as_completed
+from functools import partial
+
+import pyarrow as pa
+import pytest
+import requests
+from common import common_func as cf
+from common.pyudf_helpers import assert_pyudf_deadline, build_wheel
+from minio import Minio
+from pymilvus import FunctionChain, FunctionChainStage, MilvusClient, MilvusException
+from pymilvus.function_chain import col
+from pymilvus.function_chain.chain import FunctionChainExpr
+from workloads.pyudf.probe import pyudf_probe
+
+
+@pytest.fixture
+def runtime_connection(minio_host, minio_bucket):
+    uri = cf.param_info.param_uri or f"http://{cf.param_info.param_host}:{cf.param_info.param_port}"
+    token = cf.param_info.param_token or f"{cf.param_info.param_user}:{cf.param_info.param_password}"
+    client = MilvusClient(uri, token=token)
+    storage = Minio(f"{minio_host}:9000", access_key="minioadmin", secret_key="minioadmin", secure=False)
+    try:
+        yield client, storage, minio_bucket
+    finally:
+        client.close()
+
+
+def require_config(request, expected):
+    endpoint = request.config.getoption("--pyudf-management-endpoint")
+    assert endpoint, "This L3 selection requires its isolated runtime management endpoint"
+    for key, value in expected.items():
+        response = requests.get(endpoint.rstrip("/") + "/management/config/get", params={"keys": key}, timeout=10)
+        response.raise_for_status()
+        assert response.json()["configs"][0]["value"] == str(value), response.json()
+
+
+def cleanup_runtime_resources(runtime_connection, registered, uploaded, observer_cleanup=None):
+    """Attempt every owned cleanup and retain any failure active in the caller's finally block."""
+    failure = sys.exception()
+    client, storage, bucket = runtime_connection
+    operations = []
+    if observer_cleanup is not None:
+        operations.append(("remove cancellation marker", observer_cleanup))
+    operations.extend(
+        (f"remove resource {name}", partial(client.remove_file_resource, name, timeout=30)) for name in registered
+    )
+    operations.extend(
+        (f"remove wheel object {path}", partial(storage.remove_object, bucket, path)) for path in uploaded
+    )
+    errors = []
+    for operation, remove in operations:
+        try:
+            remove()
+        except Exception as error:
+            error.add_note(operation)
+            errors.append(error)
+    if errors:
+        raise BaseExceptionGroup("PyUDF runtime cleanup failed", ([failure] if failure is not None else []) + errors)
+
+
+def wait_for_full_admission(futures):
+    """Observe a real capacity rejection without assuming which caller arrived first."""
+    rejected = next(as_completed(futures, timeout=3))
+    with pytest.raises(MilvusException) as error:
+        rejected.result()
+    assert error.value.code == 12, f"No full admission window observed: {error.value}"
+    assert "Concurrent RPC limit exceeded" in str(error.value), error.value
+    return [future for future in futures if future is not rejected]
+
+
+@pytest.mark.tags("L3", "pyudf")
+def test_pyudf_expired_active_call_retains_capacity_until_actual_completion(
+    request, runtime_connection, record_property
+):
+    """target: late admission; method: wait past deadline; expected: executing Python retains capacity."""
+    require_config(
+        request,
+        {
+            "function.pyUDF.server.workerCount": 1,
+            "function.pyUDF.server.grpcConcurrency": 1,
+            "function.pyUDF.server.maxConcurrentRPCs": 2,
+            "function.pyUDF.rpcTimeout": "5s",
+        },
+    )
+    with pyudf_probe(*runtime_connection) as probe:
+
+        def invoke(mode, timeout):
+            return probe.client.search(
+                probe.name,
+                data=[[0.0, 0.0]],
+                anns_field="vector",
+                limit=3,
+                search_params={"metric_type": "L2"},
+                function_chains=probe.chain(mode),
+                timeout=timeout,
+                retry_on_rate_limit=False,
+            )
+
+        begin = time.monotonic()
+        try:
+            with ThreadPoolExecutor(max_workers=2) as pool:
+                active = pool.submit(invoke, "server_timeout", 12)
+                assert_pyudf_deadline(lambda: active.result(timeout=7))
+                assert 4.5 < time.monotonic() - begin < 7, "Service deadline did not occur before Python completion"
+                # Either contender may take the remaining slot. Its peer's
+                # capacity rejection is the observable full-admission barrier.
+                contenders = [pool.submit(invoke, "normal", 1) for _ in range(2)]
+                pending = wait_for_full_admission(contenders)
+                with p
```

**File**: `tests/python_client/milvus_client/test_milvus_client_pyudf_disabled.py` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@ def require_disabled_profile(self, request):
         if not request.config.getoption("--run-pyudf-disabled"):
             pytest.skip("requires --run-pyudf-disabled and a dedicated PyUDF-disabled deployment")
 
-    @pytest.mark.tags(CaseLabel.L3)
+    @pytest.mark.tags(CaseLabel.L3, "pyudf")
     @pytest.mark.parametrize("nq", [1, 2])
     def test_pyudf_disabled_rejects_nonempty_search_without_affecting_search(self, nq):
         """
```

**File**: `tests/python_client/milvus_client/test_milvus_client_pyudf_embedding_list.py` (modified, +1/-1)
```diff
@@ -261,7 +261,7 @@ def test_pyudf_embedding_list_preserves_scores_and_fields(self, minio_host, mini
             control = self._synced_search(client, self._request(name, nq, chain=self._chain(resource)))
             self._assert_results(control, nq, [1, 2, 3], reranked=True)
 
-    @pytest.mark.tags(CaseLabel.L3)
+    @pytest.mark.tags(CaseLabel.L3, "pyudf")
     @pytest.mark.parametrize("element_level", [False, True], ids=["embedding_list", "element"])
     def test_pyudf_indexed_array_search_preserves_scores_and_fields(
         self, minio_host, minio_bucket, request, record_property, element_level
```

**File**: `tests/python_client/milvus_client/test_milvus_client_pyudf_runtime.py` (added, +203/-0)
```diff
@@ -0,0 +1,203 @@
+"""Search-level runtime contracts on a single enabled PyUDF worker."""
+
+import time
+
+import grpc
+import pytest
+from common import common_func as cf
+from minio import Minio
+from pymilvus import DataType, FunctionChain, FunctionChainStage, MilvusClient, MilvusException
+from pymilvus.function_chain import col, fn
+from pymilvus.function_chain.chain import FunctionChainExpr
+from workloads.pyudf.probe import pyudf_probe
+
+
+@pytest.fixture
+def probe_connection(minio_host, minio_bucket):
+    uri = cf.param_info.param_uri or f"http://{cf.param_info.param_host}:{cf.param_info.param_port}"
+    token = cf.param_info.param_token or f"{cf.param_info.param_user}:{cf.param_info.param_password}"
+    client = MilvusClient(uri, token=token)
+    storage = Minio(f"{minio_host}:9000", access_key="minioadmin", secret_key="minioadmin", secure=False)
+    try:
+        yield client, storage, minio_bucket
+    finally:
+        client.close()
+
+
+@pytest.fixture
+def owned_probe(probe_connection, request):
+    with pyudf_probe(*probe_connection, string_pk=True, metric=getattr(request, "param", "L2")) as probe:
+        yield probe
+
+
+@pytest.mark.tags("L1")
+def test_pyudf_unicode_primary_key_multiple_queries(owned_probe):
+    """Unicode primary keys and scalar payloads stay aligned for every query."""
+    owned_probe.check(with_udf=False, nq=4)
+    owned_probe.check(nq=4)
+
+
+@pytest.mark.tags("L1")
+def test_pyudf_map_preserves_candidate_order_without_sort(owned_probe):
+    chain = FunctionChain(FunctionChainStage.L2_RERANK).map(
+        "$score", FunctionChainExpr("py_udf", args=(col("ts"),), params={"resource_name": owned_probe.resource})
+    )
+    results = owned_probe.client.search(
+        owned_probe.name,
+        data=[[0.0, 0.0]],
+        anns_field="vector",
+        limit=3,
+        search_params={"metric_type": "L2"},
+        function_chains=chain,
+    )
+    assert [hit["id"] for hit in results[0]] == owned_probe.ids
+    assert [hit["distance"] for hit in results[0]] == [20, 40, 60]
+    owned_probe.check()
+
+
+@pytest.mark.tags("L2")
+@pytest.mark.parametrize("owned_probe", ["L2", "IP"], indirect=True)
+@pytest.mark.parametrize("order", [(0, 1, 2), (2, 0, 1), (1, 2, 0)])
+def test_pyudf_composes_with_builtin_l0_l1_in_stage_order(owned_probe, order):
+    l0 = FunctionChain(FunctionChainStage.L0_RERANK).map("$score", fn.num_combine(col("ts"), col("ts"), mode="sum"))
+    l1 = FunctionChain(FunctionChainStage.L1_RERANK).map("$score", fn.num_combine(col("$score"), col("ts"), mode="sum"))
+    l2 = (
+        FunctionChain(FunctionChainStage.L2_RERANK)
+        .map(
+            "$score", FunctionChainExpr("py_udf", args=(col("$score"),), params={"resource_name": owned_probe.resource})
+        )
+        .sort(col("$score"), desc=True, tie_break_col=col("$id"))
+    )
+    stages = [l0, l1, l2]
+    results = owned_probe.client.search(
+        owned_probe.name,
+        data=[[0.0, 0.0]] * 2,
+        anns_field="vector",
+        limit=3,
+        search_params={"metric_type": owned_probe.metric},
+        output_fields=["ts"],
+        function_chains=[stages[index] for index in order],
+    )
+    assert len(results) == 2, results
+    for hits in results:
+        assert [hit["id"] for hit in hits] == list(reversed(owned_probe.ids))
+        assert [hit["distance"] for hit in hits] == [180, 120, 60]
+        assert [hit["entity"]["ts"] for hit in hits] == [30, 20, 10]
+    owned_probe.check()
+
+
+@pytest.mark.tags("L1")
+@pytest.mark.parametrize("mode,code", [("system_exit", 5), ("os_error", 2400), ("memory_error", 3)])
+def test_pyudf_exception_origin_and_recovery(owned_probe, mode, code):
+    """User exception origins survive the entire worker-to-Search error path."""
+    with pytest.raises(MilvusException) as caught:
+        owned_probe.search(mode)
+    assert caught.value.code == code, caught.value
+    assert "qa_synthetic_" + mode in str(caught.value), caught.value
+    owned_probe.check(with_udf=False)
+    owned_probe.check()
+
+
+@pytest.mark.tags("L2")
+@pytest.mark.parametrize(
+    "kind,metric",
+    [
+        *[
+            (kind, metric)
+            for kind in (DataType.FLOAT_VECTOR, DataType.FLOAT16_VECTOR, DataType.BFLOAT16_VECTOR, DataType.INT8_VECTOR)
+            for metric in ("L2", "IP", "COSINE")
+        ],
+        (DataType.BINARY_VECTOR, "HAMMING"),
+        (DataType.BINARY_VECTOR, "JACCARD"),
+        (DataType.SPARSE_FLOAT_VECTOR, "IP"),
+    ],
+)
+def test_pyudf_vector_recall_types_preserve_scalar_rerank(probe_connection, kind, metric, record_property):
+    """All candidates are retained; vector encoding must not alter scalar/ID alignment."""
+    with pyudf_probe(*probe_connection, vector_kind=kind, metric=metric) as probe:
+        probe.check(with_udf=False, nq=2)
+        probe.check(nq=2)
+        probe.client.release_collection(probe.name)
+        probe.client.load_collection(probe.name)
+        probe.check(wi
```

---

### Incident Patch 2: `6666a559` (2026-11-12)
**Commit Message**: test: fix snapshot checker drain and query pagination assumptions (#55270)

Two independent test assumptions caused nightly failures: snapshot
restore may poll for 300 seconds while checker teardown waits only 180
seconds, and pagination over repeated price values assumes a
deterministic order among equal keys.

Allow a shared, bounded 600-second checker drain deadline for in-flight
restore and cleanup. Use the unique primary key for the pagination case
and verify the exact complete ordered ID sequence across all 3,200 rows.
Keep operation success thresholds and the stuck-thread failure intact.

Validation:
- Python SDK E2E: pagination, ascending order, and descending order all
pass (3/3).
- Controlled clock validation reproduces the old 180-second failure for
a 253-second operation, verifies successful draining, and verifies that
hung threads still fail under one shared deadline.
- Ruff 0.15.11 lint and format checks, Python compilation/collection,
and git diff checks pass.
- The repository license configuration covers internal Go files; no
matching files are changed.

The full chaos scenario has not been rerun. The drain check verifies
harness behavior, not snapshot correctness u

**File**: `tests/python_client/chaos/chaos_commons.py` (modified, +3/-1)
```diff
@@ -9,7 +9,9 @@
 from utils.util_log import test_log as log
 from yaml import full_load
 
-DEFAULT_MONITOR_JOIN_TIMEOUT_SECONDS = 180
+# Snapshot restore can poll for 300 seconds before verification and cleanup.
+# Keep a bounded shared drain deadline that covers an in-flight restore.
+DEFAULT_MONITOR_JOIN_TIMEOUT_SECONDS = 600
 
 
 def check_config(chaos_config):
```

**File**: `tests/python_client/milvus_client/test_milvus_client_query_order.py` (modified, +9/-13)
```diff
@@ -464,9 +464,10 @@ def test_query_order_by_bool_field(self):
 
     @pytest.mark.tags(CaseLabel.L2)
     def test_query_order_by_pagination(self):
-        """OB-020~023: Pagination with a single ORDER BY field."""
+        """OB-020~023: Pagination with a unique ORDER BY field."""
         client = self._client()
-        order_by = [{"field": "price", "order": "asc"}]
+        # Equal prices have no stable order across independent page requests.
+        order_by = [{"field": "id", "order": "asc"}]
 
         # --- OB-020: Page 1 and Page 2 consistency ---
         page1 = self.query(
@@ -494,14 +495,14 @@ def test_query_order_by_pagination(self):
         ids1 = {r["id"] for r in page1}
         ids2 = {r["id"] for r in page2}
         assert ids1.isdisjoint(ids2), f"Overlap between pages: {ids1 & ids2}"
-        assert page1[-1]["price"] <= page2[0]["price"], (
-            f"Pages not contiguous: page1 last {page1[-1]['price']} > page2 first {page2[0]['price']}"
+        assert page1[-1]["id"] <= page2[0]["id"], (
+            f"Pages not contiguous: page1 last {page1[-1]['id']} > page2 first {page2[0]['id']}"
         )
 
         # --- OB-021: Multi-page full traversal ---
         page_size = 100
         all_ids = set()
-        all_prices = []
+        ordered_ids = []
         offset = 0
         while True:
             page = self.query(
@@ -519,15 +520,12 @@ def test_query_order_by_pagination(self):
             page_ids = {r["id"] for r in page}
             assert page_ids.isdisjoint(all_ids), f"Duplicate ids at offset {offset}"
             all_ids.update(page_ids)
-            all_prices.extend([r["price"] for r in page])
+            ordered_ids.extend([r["id"] for r in page])
             offset += page_size
             if offset > default_nb + 1000:
                 break
         assert len(all_ids) == default_nb, f"Expected {default_nb} total rows, got {len(all_ids)}"
-        for i in range(len(all_prices) - 1):
-            assert all_prices[i] <= all_prices[i + 1], (
-                f"Global sort broken at index {i}: {all_prices[i]} > {all_prices[i + 1]}"
-            )
+        assert ordered_ids == list(range(default_nb)), "Pagination must return every ID exactly once in order"
 
         # --- OB-022: Offset exceeds total rows (but within topK cap 16384) ---
         # Data has 3200 rows, offset=4000 is beyond data but offset+limit=4010 < 16384
@@ -555,9 +553,7 @@ def test_query_order_by_pagination(self):
             consistency_level="Strong",
         )[0]
         assert len(res) == default_nb
-        prices = [r["price"] for r in res]
-        for i in range(len(prices) - 1):
-            assert prices[i] <= prices[i + 1]
+        assert [r["id"] for r in res] == list(range(default_nb))
         log.info(f"OB-023: limit=16000, returned {len(res)} rows (total={default_nb})")
 
     # ==================== 5.5 L1: Nullable Field Handling ====================
```

---

### Incident Patch 3: `584004ae` (2026-11-12)
**Commit Message**: fix: restore TSan compatibility and enforce native GCC checks (#55129)

## What changed

Fix LLVM 20 TSan build and runtime compatibility after #53895.

- Keep libomp and libarcher interceptor exclusions consistent to prevent
false double-lock reports, while retaining Archer synchronization
annotations.
- Add distinct-lock and memcpy race controls to guard against missed
application races.
- Fix Clang list-initialization narrowing errors in bitmap and BSON
index resource accounting.
- Skip the shared precompiled header for VectorMemBuilder.cpp, whose
source-specific definitions and SSE4.2 options differ from the PCH.

- Treat narrowing conversions and invalid precompiled headers as errors
for first-party Linux/GCC C++ targets, including unit tests and
benchmarks. Exclude third-party targets and generated protobuf targets;
keep TSan disabled in ordinary PR builds.
- Run lightweight compiler regression fixtures through the existing
cppcheck target, covering valid PCH use, both rejected error cases,
nested targets, and C/generated/vendor exclusions.

issue: #53763

## Verification

- GCC 12.3 compiler regression fixtures passed: six positive controls
and two expected compilation failu

**File**: `Makefile` (modified, +1/-0)
```diff
@@ -229,6 +229,7 @@ tools/bin/revive: tools/check/go.mod
 cppcheck:
 	@#(env bash ${PWD}/scripts/core_build.sh -l)
 	@(env bash ${PWD}/scripts/check_cpp_fmt.sh)
+	@cmake -DWORK_DIR=$(PWD)/cmake_build/compile-checks -P $(PWD)/internal/core/unittest/check_compile_options.cmake
 
 rustfmt:
 	@echo  "Running cargo format"
```

**File**: `docs/design-docs/design_docs/20260928-native-thread-sanitizer.md` (modified, +9/-4)
```diff
@@ -124,10 +124,15 @@ CMake also installs `libomp.so.5`, `libarcher.so`, the shared compiler-rt and a
 `milvus-archer` marker. Launchers activate OMPT through `OMP_TOOL=enabled` and
 an absolute `OMP_TOOL_LIBRARIES` path.
 
-The installed `tsan.supp` suppresses reports originating in uninstrumented
-`libomp` internals by library name. Interceptor reports from Milvus and other
-libraries remain enabled. A memcpy race probe checks this along with the
-existing ordinary load/store and OpenMP probes.
+The installed `tsan.supp` ignores interceptor calls originating in uninstrumented
+`libomp` and `libarcher` internals by library name. Both libraries must be listed:
+Archer's mutex unlock can be tail-called, leaving a return address in `libomp`,
+while its matching lock has a return address in `libarcher`. Ignoring only one
+side leaves TSan with an incomplete lock history. Archer's explicit
+happens-before annotations remain active. Interceptor reports from Milvus and
+other libraries remain enabled. The probes check ordinary load/store and memcpy
+races, OpenMP synchronization, races under distinct OpenMP locks, and memcpy
+races inside OpenMP regions.
 
 External image builders must set `MILVUS_JEMALLOC_LIB` to an empty build
 argument, `MILVUS_ARCHER_LIB=/milvus/lib/libarcher.so`, and `MILVUS_TSAN_OPTIONS`
```

**File**: `internal/core/CMakeLists.txt` (modified, +9/-0)
```diff
@@ -425,6 +425,15 @@ if ( BUILD_UNIT_TEST STREQUAL "ON" )
     add_subdirectory(benchmark)
 endif ()
 
+# Use the same checks in normal, verifier and coverage builds. These operate
+# on first-party targets only; no additional compiler or sanitizer build runs.
+include(CompileChecks)
+milvus_enable_cpp_compile_checks("${CMAKE_CURRENT_SOURCE_DIR}/src")
+if ( BUILD_UNIT_TEST STREQUAL "ON" )
+    milvus_enable_cpp_compile_checks("${CMAKE_CURRENT_SOURCE_DIR}/unittest")
+    milvus_enable_cpp_compile_checks("${CMAKE_CURRENT_SOURCE_DIR}/benchmark")
+endif ()
+
 add_custom_target( Clean-All COMMAND ${CMAKE_BUILD_TOOL} clean )
 
 # **************************** Install ****************************
```

**File**: `internal/core/cmake/CompileChecks.cmake` (added, +43/-0)
```diff
@@ -0,0 +1,43 @@
+# Licensed to the LF AI & Data foundation under one
+# or more contributor license agreements. See the NOTICE file
+# distributed with this work for additional information
+# regarding copyright ownership. The ASF licenses this file
+# to you under the Apache License, Version 2.0 (the
+# "License"); you may not use this file except in compliance
+# with the License. You may obtain a copy of the License at
+#
+# http://www.apache.org/licenses/LICENSE-2.0
+#
+# Unless required by applicable law or agreed to in writing, software
+# distributed under the License is distributed on an "AS IS" BASIS,
+# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+# See the License for the specific language governing permissions and
+# limitations under the License.
+
+include_guard(GLOBAL)
+
+# Apply after target creation so new first-party targets inherit the checks
+# without changing third-party build flags or generated protobuf sources.
+function(milvus_enable_cpp_compile_checks directory)
+    if(NOT CMAKE_SYSTEM_NAME STREQUAL "Linux" OR
+       NOT CMAKE_CXX_COMPILER_ID STREQUAL "GNU")
+        return()
+    endif()
+    if(directory STREQUAL "${MILVUS_SOURCE_DIR}/src/pb")
+        return()
+    endif()
+
+    get_property(targets DIRECTORY "${directory}" PROPERTY BUILDSYSTEM_TARGETS)
+    foreach(target IN LISTS targets)
+        get_target_property(type "${target}" TYPE)
+        if(type MATCHES "^(OBJECT_LIBRARY|STATIC_LIBRARY|SHARED_LIBRARY|MODULE_LIBRARY|EXECUTABLE)$")
+            target_compile_options("${target}" PRIVATE
+                "$<$<COMPILE_LANGUAGE:CXX>:-Werror=narrowing>"
+                "$<$<COMPILE_LANGUAGE:CXX>:-Werror=invalid-pch>")
+        endif()
+    endforeach()
+    get_property(children DIRECTORY "${directory}" PROPERTY SUBDIRECTORIES)
+    foreach(child IN LISTS children)
+        milvus_enable_cpp_compile_checks("${child}")
+    endforeach()
+endfunction()
```

**File**: `internal/core/src/index/CMakeLists.txt` (modified, +4/-1)
```diff
@@ -15,8 +15,11 @@ list(FILTER SOURCE_FILES EXCLUDE REGEX "^test_utils/")
 
 # Match Knowhere's layout for the inline reservation release used by empty
 # embedding lists, without changing unrelated consumers' header definitions.
+# Its source-specific definitions and target features differ from the target's
+# PCH, so compile this translation unit without the shared precompiled header.
 set_source_files_properties(vector/VectorMemBuilder.cpp
-    PROPERTIES COMPILE_DEFINITIONS NOT_COMPILE_FOR_SWIG)
+    PROPERTIES COMPILE_DEFINITIONS NOT_COMPILE_FOR_SWIG
+               SKIP_PRECOMPILE_HEADERS ON)
 if (CMAKE_SYSTEM_PROCESSOR STREQUAL "x86_64")
     set_property(SOURCE vector/VectorMemBuilder.cpp APPEND
         PROPERTY COMPILE_OPTIONS -msse4.2)
```

**File**: `internal/core/src/index/LoadResource.cpp` (modified, +3/-2)
```diff
@@ -619,8 +619,9 @@ LegacyScalarIndexLoadResourceAsync(
                 .value_or(false)) {
             resident = SaturatingAdd(
                 resident,
-                SaturatingMultiply(uint64_t{std::max<int64_t>(0, rows)},
-                                   sizeof(void*)));
+                SaturatingMultiply(
+                    static_cast<uint64_t>(std::max<int64_t>(0, rows)),
+                    sizeof(void*)));
         }
         request.final_memory_cost =
             std::max(request.final_memory_cost,
```

**File**: `internal/core/src/index/LoadResourceTest.cpp` (modified, +4/-4)
```diff
@@ -500,13 +500,13 @@ TEST(LegacyLoadResourceTest, SegmentMetadataPreservesFileAwareEstimates) {
                 translator.EstimatedResources();
             const auto transient = private_overhead + shared_overhead;
             EXPECT_EQ(resident,
-                      (cachinglayer::ResourceUsage{expected.final_memory_cost,
-                                                   expected.final_disk_cost}));
+                      (cachinglayer::ResourceUsage(expected.final_memory_cost,
+                                                   expected.final_disk_cost)));
             EXPECT_EQ(
                 transient,
-                (cachinglayer::ResourceUsage{
+                (cachinglayer::ResourceUsage(
                     expected.max_memory_cost - expected.final_memory_cost,
-                    2 * expected.max_disk_cost - expected.final_disk_cost}));
+                    2 * expected.max_disk_cost - expected.final_disk_cost)));
         }
     }
 }
```

**File**: `internal/core/src/index/scalar/json/JsonProjectedHybridIndexBuilderTest.cpp` (modified, +12/-12)
```diff
@@ -119,10 +119,10 @@ TEST(JsonProjectedHybridIndexBuilderTest, LowCardinalityStringsSelectBitmap) {
     ASSERT_NO_FATAL_FAILURE(ExpectSelector(persisted, ScalarIndexType::BITMAP));
     const auto& backend = ScalarReaderBackends().Get<std::string_view>(
         "JsonProjectedHybridVarchar");
-    auto reader = OpenV3(backend,
-                         persisted,
-                         {.row_count = static_cast<int64_t>(raw.size()),
-                          .values = {{JSON_PATH, "/x"}}});
+    auto reader =
+        OpenV3(backend,
+               persisted,
+               {.row_count = raw.size(), .values = {{JSON_PATH, "/x"}}});
     ASSERT_NE(reader, nullptr);
     const auto* json = dynamic_cast<const IJsonIndexReader*>(reader.get());
     ASSERT_NE(json, nullptr);
@@ -151,10 +151,10 @@ TEST(JsonProjectedHybridIndexBuilderTest, HighCardinalityNumbersSelectSorted) {
         ExpectSelector(persisted, ScalarIndexType::STLSORT));
     const auto& backend =
         ScalarReaderBackends().Get<double>("JsonProjectedHybridDouble");
-    auto reader = OpenV3(backend,
-                         persisted,
-                         {.row_count = static_cast<int64_t>(raw.size()),
-                          .values = {{JSON_PATH, "/n"}}});
+    auto reader =
+        OpenV3(backend,
+               persisted,
+               {.row_count = raw.size(), .values = {{JSON_PATH, "/n"}}});
     ASSERT_NE(reader, nullptr);
     const auto* json = dynamic_cast<const IJsonIndexReader*>(reader.get());
     ASSERT_NE(json, nullptr);
@@ -181,10 +181,10 @@ TEST(JsonProjectedHybridIndexBuilderTest,
     ASSERT_NO_FATAL_FAILURE(ExpectSelector(persisted, ScalarIndexType::BITMAP));
     const auto& backend =
         ScalarReaderBackends().Get<double>("JsonProjectedHybridDouble");
-    auto reader = OpenV3(backend,
-                         persisted,
-                         {.row_count = static_cast<int64_t>(raw.size()),
-                          .values = {{JSON_PATH, "/v"}}});
+    auto reader =
+        OpenV3(backend,
+               persisted,
+               {.row_count = raw.size(), .values = {{JSON_PATH, "/v"}}});
     ASSERT_NE(reader, nullptr);
     const auto* json = dynamic_cast<const IJsonIndexReader*>(reader.get());
     ASSERT_NE(json, nullptr);
```

#### Recent Merged Pull Requests:
- **PR #55464** (2026-11-12): test: [cp 3.0] harden REST import correctness and completion polling (@zhuwenxing)
- **PR #55463** (2026-11-12): test: harden REST import correctness and completion polling (@zhuwenxing)
- **PR #55453** (2026-11-12): fix: align 3.0 mixed E2E test label gates with CI routing (@zhikunyao)
- **PR #55444** (2026-11-12): enhance: [3.0] Avoid redundant sealed worker PK candidates (@weiliu1031)
- **PR #55442** (2026-11-12): enhance: Enable Storage V3 by default (@jiaqizho)
- **PR #55440** (2026-11-12): enhance: [cp3.0] decode struct string sub-field into one buffer per row (@xaxys)

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

## X. test: add PyUDF search, lifecycle and runtime regression coverage (#55386)

**RULE**:
When implementing operations in `tests/python_client/base/client_v2_pyudf_base.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in milvus-io/milvus. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `34e03edc`: test: add PyUDF search, lifecycle and runtime regression coverage (#55386). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `tests/python_client/base/client_v2_pyudf_base.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
"""Owned wheel, collection and permission lifecycles for PyUDF SDK cases."""

import io
import time
from contextlib import ExitStack, contextmanager

import grpc
import pytest
from base.client_v2_base import TestMilvusClientV2Base
from common import common_func as cf
from common.common_type import CheckTasks
from common.pyudf_helpers import build_wheel
from pymilvus import DataType, FunctionChain, FunctionChainStage, MilvusClient
from pymilvus.function_chain import col
from pymilvus.function_chain.chain import FunctionChainExpr


class PyUDFClientBase(TestMilvusClientV2Base):
    """Share fixture ownership without importing or inheriting collected tests."""

    dim = 2
    vector_field = "vector"
    scalar_field = "ts"

    @staticmethod
    def _pyudf_management_config(request, key):
        import requests

        endpoint = request.config.getoption("--pyudf-management-endpoint")
        assert endpoint, "requires --pyudf-management-endpoint pointing to the coordinator management service"
        response = requests.get(
            endpoint.rstrip("/") + "/management/config/get",
            params={"keys": key},
            timeout=10,
        )
        response.raise_for_st
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `34e03edc` are properly handled with clean fallback behavior.


## 3. Decision Protocol & Boundary Restrictions
- Must NOT delete canonical verification records without authorization.
- Must execute independent read-back verification after every mutation.
