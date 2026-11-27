# Verification Protocol: Verification Protocol: Empirical Defect Shield for milvus-io-milvus-learnings

<!-- PROVENANCE_START
{
  "source_repository": "milvus-io-milvus-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-27T10:43:21.087Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-milvus-io-milvus-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [milvus-io-milvus-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-27T10:43:21.087Z`  
> **Learning ID**: `LEARN-EVO-milvus-io-milvus-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `milvus-io-milvus-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/milvus-io-milvus-learnings.md`  
> **Source**: github ([https://github.com/milvus-io/milvus](https://github.com/milvus-io/milvus))  
> **Source Version**: `8425467c`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-27T10:43:14.829Z  
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
> **Harvest Timestamp**: 2026-11-27T10:43:14.823Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `milvus-io/milvus`
- **Description**: Milvus is a high-performance, cloud-native vector database built for scalable vector ANN search
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 46751 stars

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
- **Issue #56130** (2026-11-27): **enhance: [3.0] Propagate caller context in console metadata handlers**
  *Symptoms*: issue: #56127 pr: #56128  ### Summary  Cherry-pick #56128 to `3.0`: align caller context propagation in the console metadata HTTP handlers (`listCollection`, `listDatabase`, `describeDatabase`) with regular Proxy RPC paths:  - Add `consoleMetadataContext` in `internal/proxy/http_req_impl.go` to construct request metadata context from the authenticated user when business authorization is enabled, while preserving the existing management view for verified admin requests and when authorization is disabled. - Forward caller metadata in `listCollection` (via `AppendUserInfoForRPC` for `ShowCollections` and passing the derived context to `ShowLoadCollections`) and `listDatabase`. - Apply `PrivilegeInterceptor` on the target database request in `describeDatabase` for non-admin requests, mapping `PermissionDenied` to HTTP `403`. - Add unit tests in `internal/proxy/http_req_impl_test.go` (`TestConsoleMetadataAuthorization`) covering caller context propagation, missing caller rejection, target database checks, and management view handling.  ### Verification  - Clean cherry-pick of `8439b17fd9` onto `3.0` (`git diff --check` passed). - Targeted Go unit tests in `./internal/proxy` passed on `master` (10/10 subtests in `TestConsoleMetadataAuthorization`); CI will verify on `3.0`.
  **Post-Mortem & Fix Analysis**:
  > [ci-v2-notice] Notice: ci-v2 system is enabled for this PR (3.0 branch).  To rerun ci-v2 checks, comment with: - /ci-rerun-code-check-macos  // for Code Checker MacOS (GitHub Actions) - /ci-rerun-build-ut-cov  // for ci-v2/build-ut-cov (build + unit tests) - /ci-rerun-e2e-amd  // for ci-v2/e2e-amd (e2e tests) - /ci-rerun-e2e-dist-wp  // for ci-v2/e2e-dist-wp (Tencent distributed woodpecker-service boundary) - /ci-rerun-gosdk  // for ci-v2/go-sdk (Go SDK E2E tests) - /ci-rerun-gosdk-std  // for ci-v2/go-sdk-std (Go SDK E2E, standalone) - /ci-rerun-gosdk-dist-wp // for ci-v2/go-sdk-dist-wp (distributed + Woodpecker service)  If you have any questions or requests, please contact @zhikunyao. 
  > [INFO] PR Label Summary by Default [FAILED] PR #56128 not merged - Title: enhance: Propagate caller context in console metadata handlers - Status: OPEN - Link: https://github.com/milvus-io/milvus/pull/56128   [WARNING] Milestone not set - PR: #56130 - Title: enhance: [3.0] Propagate caller context in console metadata handlers Please set a milestone for better release tracking  You can set milestone by commenting:   /set-milestone <milestone-name> Example:   /set-milestone 2.5.0  Use /refresh-label to update related check and label manually

- **Issue #56124** (2026-11-27): **test: Fix Parquet array validation and snapshot backfill waits**
  *Symptoms*: ## Summary  Two CI failures on #56113 exposed assumptions shared by the master and 3.0 E2E tests.  - Give the Parquet file a neutral name and assert the specific rejection for NaN, positive infinity, negative infinity and NULL. A filename containing `nan` could satisfy the old check for every input. Keep the Arrow validity check and verify that a failed import exposes zero rows. - Before taking the new snapshot in the deferred field binding test, wait until every eligible source segment reports the collection's current schema version. Background schema backfill can own an old segment while a manual compaction request returns no plan. Reuse the same physical backfill check in the mapped nullable field test.  3.0 backport in #56123. Related to #55966.  ## Verification  - Ran all four master REST cases against an isolated 3.0 standalone server with Import V3 enabled. All four passed. - Compiled the master Go SDK test package. The corresponding 3.0 Go E2E passed against that server with warmup enabled and disabled. - Ruff lint and format, gofmt and git diff checks passed. 
  **Post-Mortem & Fix Analysis**:
  > [ci-v2-notice] Notice: New ci-v2 system is enabled for this PR.  To rerun ci-v2 checks, comment with: - /ci-rerun-code-check  // for ci-v2/code-check - /ci-rerun-code-check-macos  // for Code Checker MacOS (GitHub Actions) - /ci-rerun-build  // for ci-v2/build - /ci-rerun-build-all  // for ci-v2/build-all (multi-arch builds) - /ci-rerun-buildenv  // for ci-v2/build-env (build milvus-env builder images; update .env after the new tag is ready) - /ci-rerun-ut-integration  // for ci-v2/ut-integration, will rerun ci-v2/build - /ci-rerun-ut-go  // for ci-v2/ut-go, will rerun ci-v2/build - /ci-rerun-ut-cpp  // for ci-v2/ut-cpp - /ci-rerun-ut  // for all ci-v2/ut-integration, ci-v2/ut-go, ci-v2/ut-cpp, will rerun ci-v2/build - /ci-rerun-e2e-default  // for ci-v2/e2e-default - /ci-rerun-e2e-pulsar-wp  // for ci-v2/e2e-pulsar-wp (GCP branch-equivalent Pulsar + Woodpecker Python E2E) - /ci-rerun-e2e-amd  // for ci-v2/e2e-amd (e2e pool dispatcher) - /ci-rerun-e2e-dist-wp  // for ci-v2/e2e-dist-wp 
  > <!-- ciloop-result-7612 --> ### :white_check_mark: CI Loop Results  `0966985`  | Stage | Result | Duration | Tests | |-------|--------|----------|-------| | :white_check_mark: Build | SUCCESS | 8.9min | - | | :white_check_mark: Code-Check | SUCCESS | 6.0min | - | | :white_check_mark: UT-Integration | SUCCESS | 26.0min | - | | :white_check_mark: UT-GO | SUCCESS | 27.4min | - | | :white_check_mark: UT-CPP-Cov | SUCCESS | 32.5min | 23335 total, 23335 passed, 0 failed |  **Total:** 53min | [Pipeline](https://jenkins-milvus-ci.milvus.io/job/MILVUS-CI-V2-PR-PIPELINES/job/milvus-build-ut-ciloop-pipeline-for-tcus/7612/pipeline-overview/) | [Artifacts](https://jenkins-milvus-ci.milvus.io/job/MILVUS-CI-V2-PR-PIPELINES/job/milvus-build-ut-ciloop-pipeline-for-tcus/7612/artifact) **C++ coverage phases:** Compile 6.5min · UT 21.8min · LCOV 4.1min  **Overall Coverage:** 79.9%  

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

### Incident Patch 1: `3b35b67b` (2026-11-26)
**Commit Message**: enhance: Build MILVUS_FIPS_ENABLED=ON on Go's FIPS 140-3 module (#55851)

Issue: #55850. Design: [FIPS builds on the Go Cryptographic
Module](https://github.com/milvus-io/milvus/blob/814ca9da80c7773a5f3dd4c4f9bbc62ccb77d67f/docs/design-docs/design_docs/20261123-fips-go-cryptographic-module.md).

## What changed

- `make ... MILVUS_FIPS_ENABLED=ON` pins `GOFIPS140=v1.0.0` and adds the
required `milvus_fips` tag, including when the caller supplies custom
tags. Go 1.26.10 resolves this to `v1.0.0-c2097c7c`, covered by [CMVP
certificate
#5247](https://csrc.nist.gov/projects/cryptographic-module-validation-program/certificate/5247).
External builds can read the selector with `make -s
MILVUS_FIPS_ENABLED=ON print-fips-go-module`. Go plugins must match the
host toolchain, snapshot and shared-package build settings.
- Before it reads remote configuration, which opens the process's first
etcd connection, the tagged binary checks its recorded module snapshot
and Go FIPS mode. Before starting a service, it checks them again and
loads the OpenSSL configuration. It checks the default FIPS properties
and the providers of the shared primary and current thread's public and
private random generator

**File**: `Makefile` (modified, +27/-8)
```diff
@@ -52,7 +52,7 @@ ifeq ($(USE_ASAN), ON)
 	use_asan = ${USE_ASAN}
 	CGO_LDFLAGS += -fno-stack-protector -fno-omit-frame-pointer -fno-var-tracking -fsanitize=address
 	CGO_CFLAGS += -fno-stack-protector -fno-omit-frame-pointer -fno-var-tracking -fsanitize=address
-	MILVUS_GO_BUILD_TAGS := $(MILVUS_GO_BUILD_TAGS),use_asan
+	asan_go_tag := ,use_asan
 endif
 
 USE_TSAN ?= OFF
@@ -116,11 +116,6 @@ ifdef WITH_CRT
 	with_crt = ${WITH_CRT}
 endif
 
-# FIPS: default OFF. Set MILVUS_FIPS_ENABLED=ON to enable BoringCrypto.
-GOEXPERIMENT_FLAG :=
-ifeq ($(MILVUS_FIPS_ENABLED),ON)
-	GOEXPERIMENT_FLAG := GOEXPERIMENT=boringcrypto
-endif
 # golangci-lint
 GOLANGCI_LINT_VERSION := 2.11.3
 GOLANGCI_LINT_OUTPUT := $(shell $(INSTALL_PATH)/golangci-lint --version 2>/dev/null)
@@ -159,10 +154,29 @@ ifneq ($(filter ON on TRUE True true 1,$(WITH_GPU)),)
         $(error USE_TSAN does not support GPU builds)
     endif
     ifneq ($(index_engine),cardinal)
-        MILVUS_GO_BUILD_TAGS := $(MILVUS_GO_BUILD_TAGS),cuda
+        cuda_go_tag := ,cuda
     endif
 endif
 
+# All Go artifacts loaded into the same process must use the same snapshot.
+# Go 1.26.10 resolves v1.0.0 to the certified v1.0.0-c2097c7c (CMVP #5247).
+ifeq ($(MILVUS_FIPS_ENABLED),ON)
+ifneq ($(findstring ',$(MILVUS_GO_BUILD_TAGS))$(findstring ",$(MILVUS_GO_BUILD_TAGS)),)
+$(error FIPS build tags must not contain literal quote characters)
+endif
+	override GOFIPS140 := v1.0.0
+	export GOFIPS140
+	# Go accepts whitespace-separated or comma-separated tags. Normalize custom
+	# lists before adding a required tag so the Go tool sees it as its own tag.
+	empty :=
+	space := $(empty) $(empty)
+	comma := ,
+	fips_go_tags := $(subst $(comma), ,$(MILVUS_GO_BUILD_TAGS)$(asan_go_tag)$(cuda_go_tag))
+	override MILVUS_GO_BUILD_TAGS := $(subst $(space),$(comma),$(strip $(filter-out milvus_fips,$(fips_go_tags)) milvus_fips))
+else
+	MILVUS_GO_BUILD_TAGS := $(MILVUS_GO_BUILD_TAGS)$(asan_go_tag)$(cuda_go_tag)
+endif
+
 # Ensure git works inside containers where .git is owned by a different user.
 # Must use git config --global: git without 2.38's protected config reads
 # safe.directory only from system/global config, ignoring -c and
@@ -183,11 +197,16 @@ endif
 
 milvus: build-cpp print-build-info build-go build-pyudf-runtime-wheel
 
+# Expose the server's Go module selection to external packaging builds.
+.PHONY: print-fips-go-module
+print-fips-go-module:
+	@printf '%s\n' "$$GOFIPS140"
+
 build-go:
 	@echo "Building Milvus ..."
 	@source $(PWD)/scripts/setenv.sh && \
 		mkdir -p $(INSTALL_PATH) && go env -w CGO_ENABLED="1" && \
-		$(GOEXPERIMENT_FLAG) CGO_LDFLAGS="$(CGO_LDFLAGS)" CGO_CFLAGS="$(CGO_CFLAGS)" CGO_CXXFLAGS="$(CGO_CXXFLAGS)" GO111MODULE=on $(GO) build -pgo=$(PGO_PATH)/default.pgo -ldflags="$(TSAN_GO_LDFLAGS) $(SONIC_PLUGIN_SYNC_LDFLAG) -r $${RPATH} -X '$(OBJPREFIX).BuildTags=$(BUILD_TAGS)' -X '$(OBJPREFIX).BuildTime=$(BUILD_TIME)' -X '$(OBJPREFIX).GitCommit=$(GIT_COMMIT)' -X '$(OBJPREFIX).GoVersion=$(GO_VERSION)' -X '$(OBJPREFIX).MilvusVersion=$(MILVUS_VERSION)'" \
+		CGO_LDFLAGS="$(CGO_LDFLAGS)" CGO_CFLAGS="$(CGO_CFLAGS)" CGO_CXXFLAGS="$(CGO_CXXFLAGS)" GO111MODULE=on $(GO) build -pgo=$(PGO_PATH)/default.pgo -ldflags="$(TSAN_GO_LDFLAGS) $(SONIC_PLUGIN_SYNC_LDFLAG) -r $${RPATH} -X '$(OBJPREFIX).BuildTags=$(BUILD_TAGS)' -X '$(OBJPREFIX).BuildTime=$(BUILD_TIME)' -X '$(OBJPREFIX).GitCommit=$(GIT_COMMIT)' -X '$(OBJPREFIX).GoVersion=$(GO_VERSION)' -X '$(OBJPREFIX).MilvusVersion=$(MILVUS_VERSION)'" \
 		-tags "$(MILVUS_GO_BUILD_TAGS)" -o $(INSTALL_PATH)/milvus $(PWD)/cmd/main.go 1>/dev/null
 
 get-build-deps:
```

**File**: `cmd/milvus/boring_disabled.go` (removed, +0/-13)
```diff
@@ -1,13 +0,0 @@
-//go:build !boringcrypto
-
-package milvus
-
-import "github.com/milvus-io/milvus/pkg/v3/util/fips"
-
-func boringEnabled() bool {
-	return false
-}
-
-func maybeEnableOpenSSLFIPS() bool {
-	return fips.MaybeEnableOpenSSLFIPS()
-}
```

**File**: `cmd/milvus/boring_enabled.go` (removed, +0/-17)
```diff
@@ -1,17 +0,0 @@
-//go:build boringcrypto
-
-package milvus
-
-import (
-	"crypto/boring"
-
-	"github.com/milvus-io/milvus/pkg/v3/util/fips"
-)
-
-func boringEnabled() bool {
-	return boring.Enabled()
-}
-
-func maybeEnableOpenSSLFIPS() bool {
-	return fips.MaybeEnableOpenSSLFIPS()
-}
```

**File**: `cmd/milvus/main_entry.go` (modified, +17/-8)
```diff
@@ -32,12 +32,9 @@ import (
 )
 
 // Main is the process entry point, exported so a distribution can build its own
-// main package around it instead of duplicating the startup preamble. The body
-// is the former cmd/main.go moved unchanged apart from three adaptations: it
-// reads args instead of the os.Args global (with the inner slice renamed to
-// subArgs), the original if/else became an if block that always returns
-// followed by an unconditional tail call, and the subprocess marker is
-// stripped into a copy of args rather than in place.
+// main package around it instead of duplicating the startup preamble.
+// When supervising a service, it propagates a nonzero exit status from the child
+// after session cleanup has finished.
 //
 // args is the full argument vector, program name first, as os.Args is. Main
 // does not modify the caller's slice: the subprocess branch deletes an element,
@@ -48,11 +45,17 @@ import (
 // (pkg/extension) before calling Main; nothing runs earlier than the first
 // line here except package initialization.
 func Main(args []string) {
+	if code := runMain(args); code != 0 {
+		os.Exit(code)
+	}
+}
+
+func runMain(args []string) int {
 	defer asan.LsanDoLeakCheck()
 	args, profileEnv, err := prepareNativeProfile(args, os.Environ())
 	if err != nil {
 		fmt.Fprintln(os.Stderr, err)
-		os.Exit(1)
+		return 1
 	}
 
 	// execute command as a subprocess if the command contains "--run-with-subprocess"
@@ -107,15 +110,21 @@ func Main(args []string) {
 
 				if err != nil {
 					log.Println("subprocess exit, ", err.Error())
+					// A run child can reject startup before creating any sessions,
+					// including when its FIPS checks fail. Report its status to the caller.
+					if code := cmd.ProcessState.ExitCode(); code > 0 && len(subArgs) > 1 && subArgs[1] == RunCmd {
+						return code
+					}
 				} else {
 					log.Println("exit code:", cmd.ProcessState.ExitCode())
 				}
-				return
+				return 0
 			}
 		}
 	}
 
 	RunMilvus(args)
+	return 0
 }
 
 // subprocessArgs returns args with the --run-with-subprocess marker removed,
```

**File**: `cmd/milvus/main_entry_test.go` (modified, +19/-0)
```diff
@@ -19,6 +19,7 @@ package milvus
 import (
 	"context"
 	"os"
+	"path/filepath"
 	"strconv"
 	"testing"
 
@@ -101,3 +102,21 @@ func TestMainSubprocessReturnsAndPreservesArgs(t *testing.T) {
 		})
 	}
 }
+
+func TestSupervisedRunPropagatesStartupFailureAfterCleanup(t *testing.T) {
+	child := filepath.Join(t.TempDir(), "milvus")
+	require.NoError(t, os.WriteFile(child, []byte("#!/bin/sh\nexit 1\n"), 0o700)) // #nosec G306 -- The temporary test child must be executable.
+	// A failed startup has not registered a session yet.
+	sessions := mockey.Mock(sessionutil.GetSessions).Return([]string(nil)).Build()
+	defer sessions.UnPatch()
+	cleaned := false
+	cleanup := mockey.Mock(CleanSession).To(func(_ string, _ []string, suffixes []string) error {
+		assert.Empty(t, suffixes)
+		cleaned = true
+		return nil
+	}).Build()
+	defer cleanup.UnPatch()
+
+	assert.Equal(t, 1, runMain([]string{child, "run", "standalone", "--run-with-subprocess"}))
+	assert.True(t, cleaned)
+}
```

**File**: `cmd/milvus/run.go` (modified, +7/-2)
```diff
@@ -12,6 +12,7 @@ import (
 	"github.com/milvus-io/milvus/pkg/v3/common"
 	"github.com/milvus-io/milvus/pkg/v3/metrics"
 	"github.com/milvus-io/milvus/pkg/v3/mlog"
+	"github.com/milvus-io/milvus/pkg/v3/util/fips"
 	"github.com/milvus-io/milvus/pkg/v3/util/hardware"
 	"github.com/milvus-io/milvus/pkg/v3/util/metricsinfo"
 )
@@ -36,7 +37,11 @@ func (c *run) execute(args []string, flags *flag.FlagSet) {
 	runtimeDir := createRuntimeDir(serverType)
 	filename := getPidFileName(serverType, roles.Alias)
 
-	maybeEnableOpenSSLFIPS()
+	// A MILVUS_FIPS_ENABLED=ON build must not run outside FIPS 140-3 mode.
+	if err := fips.Require(); err != nil {
+		fmt.Fprintln(os.Stderr, "Milvus cannot start:", err)
+		os.Exit(1)
+	}
 	c.printBanner(flags.Output())
 	c.injectVariablesToEnv()
 	c.printHardwareInfo(flags.Output())
@@ -60,7 +65,7 @@ func (c *run) printBanner(w io.Writer) {
 	fmt.Fprintln(w, "Built:     "+BuildTime)
 	fmt.Fprintln(w, "GitCommit: "+GitCommit)
 	fmt.Fprintln(w, "GoVersion: "+GoVersion)
-	fmt.Fprintf(w, "Milvus FIPS in Go: BoringCrypto %v\n", boringEnabled())
+	fmt.Fprintln(w, "FIPS:      "+fips.Status())
 	fmt.Fprintln(w)
 	metrics.BuildInfo.WithLabelValues(getEffectiveVersion(), BuildTime, GitCommit).Set(1)
 }
```

**File**: `configs/milvus.yaml` (modified, +1/-1)
```diff
@@ -1426,7 +1426,7 @@ common:
     # Large numeric passwords require double quotes to avoid yaml parsing precision issues.
     defaultRootPassword: Milvus
     # Algorithm used to hash newly created or updated passwords: bcrypt or pbkdf2-sha512.
-    # pbkdf2-sha512 is a FIPS-approved key derivation function. On a build with MILVUS_FIPS_ENABLED=ON it runs on BoringCrypto.
+    # pbkdf2-sha512 is a FIPS-approved key derivation function. On a build with MILVUS_FIPS_ENABLED=ON it runs in the FIPS 140-3 Go Cryptographic Module.
     # Existing hashes keep working after a change and are rehashed only when the password is updated, including the root hash created at first startup.
     # Upgrade every node, and every cluster in a CDC topology, before selecting pbkdf2-sha512: older versions cannot verify these hashes, and they stop verifying after a downgrade.
     passwordHashAlgorithm: bcrypt
```

**File**: `docs/design-docs/design_docs/20261123-fips-go-cryptographic-module.md` (added, +86/-0)
```diff
@@ -0,0 +1,86 @@
+# FIPS builds on the Go Cryptographic Module
+
+Related issue: #55850.
+
+`MILVUS_FIPS_ENABLED=ON` used BoringCrypto (`GOEXPERIMENT=boringcrypto`) for
+Go cryptography and loaded OpenSSL's FIPS provider for C++. This change moves
+the Go side to Go's native FIPS 140-3 module and makes a FIPS build refuse to
+start outside FIPS mode.
+
+## Why
+
+- **The module is validated.** The Go Cryptographic Module v1.0.0 has CMVP
+  certificate #5247, and its approved algorithms include PBKDF. When
+  BoringCrypto was adopted (#48331), the native module was not yet validated.
+- **BoringCrypto is on its way out.** Go documents it as an unsupported
+  mechanism that will be removed in a future release.
+- **BoringCrypto runs hashing through cgo.** PBKDF2 makes hundreds of
+  thousands of cgo calls into BoringSSL assembly per password. A signal that
+  lands in that assembly makes cgosymbolizer unwind through code without unwind
+  information, and Milvus segfaults (#55557). The native module is Go code, so
+  hashing makes no cgo calls.
+- **A FIPS build could run without FIPS.** When OpenSSL's FIPS provider failed
+  to load, Milvus logged it and started anyway.
+
+## Design
+
+**Build.** `MILVUS_FIPS_ENABLED=ON` pins `GOFIPS140=v1.0.0` for all Go
+commands run by Make and adds `milvus_fips` to the server build tags, including
+custom tag lists. Go 1.26.10 resolves this selector to the certified snapshot
+`v1.0.0-c2097c7c`. External Go plugins must use the server's Go toolchain,
+module snapshot, and matching tags (including `milvus_fips`). External packaging
+builds can query the selector with
+`make -s --no-print-directory MILVUS_FIPS_ENABLED=ON print-fips-go-module`.
+
+**OpenSSL.** `pkg/util/fips` enables the OpenSSL FIPS provider under the
+`milvus_fips` tag. After loading the configuration, it checks the default
+`fips=yes` property and the provider backing the shared primary random generator
+and the startup thread's public and private generators. Both public and private
+random generation must succeed. Embedding hosts must configure FIPS before
+initializing the OpenSSL random generators, since OpenSSL retains generators
+across changes to default properties. `MaybeEnableOpenSSLFIPS` still drives
+CRC32C for S3.
+
+**Startup.** `milvus run` calls `fips.Require` before starting service roles. In a `milvus_fips`
+build it returns an error, and Milvus exits with status 1, when:
+
+- Go build metadata is missing or its resolved `GOFIPS140` value differs
+  from `v1.0.0-c2097c7c`;
+- Go FIPS mode is off at run time (`GODEBUG=fips140=off`);
+- the OpenSSL FIPS provider could not be enabled.
+
+With `--run-with-subprocess`, the supervisor finishes session cleanup and
+propagates an explicit nonzero exit status from the run child in both build
+modes. A FIPS startup failure therefore reaches the caller as exit status 1.
+Outside a `milvus_fips` build, `fips.Require` returns nil.
+
+**PBKDF2.** `pkg/util/crypto` uses `crypto/pbkdf2` instead of its own HMAC
+loop. The loop existed only because `crypto/pbkdf2` bypasses BoringCrypto.
+Stored hashes are unchanged; the RFC known-answer tests still pass.
+
+## Behaviour changes for MILVUS_FIPS_ENABLED=ON
+
+- **Startup is fail-closed.** A deployment whose OpenSSL FIPS configuration
+  does not load now fails to start instead of running without it.
+- **Go TLS is restricted.** In FIPS mode `crypto/tls` negotiates only approved
+  versions, cipher suites and key exchanges. Peers that offer only TLS 1.0 or
+  1.1, only ChaCha20-Poly1305, or only X25519 key exchange fail the handshake,
+  and TLS 1.2 peers must support Extended Master Secret. This covers etcd,
+  object storage, the SDK and gRPC between components. `etcd.ssl.tlsMinVersion`
+  and `minio.ssl.tlsMinVersion` values of `1.0` or `1.1` act as `1.2`.
+- **The banner line changes** from `Milvus FIPS in Go: BoringCrypto <bool>` to
+  `FIPS: on (Go Cryptographic Module v1.0.0, OpenSSL FIPS provider)`.
+
+Default builds continue to use Go's standard cryptography with their existing FIPS mode defaults.
+
+## Not covered
+
+- OpenSSL's FIPS provider is still built from Conan's OpenSSL 3.3.2, which is
+  not a validated version, and `openssl-fips.cnf` still activates the default
+  provider. The C++ part of #55086 addresses both.
+- Rust crates and other libraries in the image that bundle their own
+  cryptography (#55083 and related issues).
+- Go tools built from this repository (`binlog`, `meta-migration`, ...) now
+  use the Go module but do not enable OpenSSL's FIPS provider.
+- bcrypt stays the default password hash; FIPS deployments should select
+  `pbkdf2-sha512`.
```

---

### Incident Patch 2: `e8cda3c2` (2026-11-27)
**Commit Message**: fix: reject external specs that set one key twice (#56051)

issue: #56049

## What this fixes

#51897 (3dafbf4e47) added case folding to `NormalizeExternalSpec`. With
it, a lone non-canonical top-level key such as `"Format"` or `"EXTFS"`
is read as `format` / `extfs` by Go, and by native code after
normalization. Go and native code agree on such a spec. This PR keeps
that behaviour.

What #51897 does not cover is a spec that sets one key twice.
`encoding/json` matches `ExternalSpec` fields ignoring case and merges
repeated objects. So `{"extfs":{...},"Extfs":{...}}` is validated and
normalized as one merged `extfs` map. A layer in front of Milvus that
replaces only the exact `extfs` key (and `cloud_extra`, and `format` on
the snapshot path) and keeps the caller's other top-level keys therefore
leaves the caller's `"Extfs"` in place, and its keys are merged into the
extfs passed to native code.

**Why lone spellings stay folded:** a lone spelling is one setting, and
every reader resolves it the same way. Existing collections may also use
one.

**Why collisions are rejected:** nothing about the spelling says which
of the two values should win, and the merge is exactly how caller keys

**File**: `internal/datacoord/externalrefresh/manager_test.go` (modified, +113/-0)
```diff
@@ -1038,6 +1038,119 @@ func TestExploreExternalFiles_UsesUniqueAttemptDirectories(t *testing.T) {
 	}, baseDirs)
 }
 
+// Refresh revalidates the job's source and spec before exploring. A spec that
+// sets one key twice fails with an error naming the keys; a lone other
+// spelling of a key is still accepted.
+func TestExploreExternalFiles_RejectsCollidingSpecKeys(t *testing.T) {
+	paramtable.Init()
+	ms := metacache.NewMetaStore(nil)
+	ms.PutCollection(&meta.CollectionInfo{
+		ID: 100,
+		Schema: &schemapb.CollectionSchema{Fields: []*schemapb.FieldSchema{{
+			FieldID:       100,
+			Name:          "id",
+			ExternalField: "id",
+		}}},
+	})
+	mgr := &Manager{
+		mt:        &meta.Meta{MetaStore: ms},
+		allocator: &stubAllocator{nextID: 300},
+	}
+	explored := 0
+	mockExplore := mockey.Mock(packed.ExploreFilesReturnManifestPath).
+		To(func(_ []string, _ string, _, _ string, _ *indexpb.StorageConfig, _ packed.ExternalSpecContext) ([]packed.FileInfo, string, error) {
+			explored++
+			return []packed.FileInfo{{FilePath: "f.parquet", NumRows: 1}}, "manifest", nil
+		}).Build()
+	defer mockExplore.UnPatch()
+
+	newJob := func(spec string) *datapb.ExternalCollectionRefreshJob {
+		return &datapb.ExternalCollectionRefreshJob{
+			JobId:          42,
+			CollectionId:   100,
+			ExternalSource: "s3://bucket/path",
+			ExternalSpec:   spec,
+		}
+	}
+	const extfs = `{"cloud_provider":"aws","region":"us-west-2","access_key_id":"ak","access_key_value":"sk"}`
+	for _, tc := range []struct{ spec, wantErr string }{
+		{`{"format":"parquet","extfs":` + extfs + `,"Extfs":{"role_arn":"arn:aws:iam::123456789012:role/other"}}`, `external spec keys "extfs" and "Extfs" differ only in case`},
+		{`{"format":"parquet","Format":"vortex","extfs":` + extfs + `}`, `external spec keys "format" and "Format" differ only in case`},
+		{`{"format":"parquet","extfs":` + extfs + `,"extfs":` + extfs + `}`, `external spec key "extfs" appears more than once`},
+		{`{"format":"parquet","extfs":{"cloud_provider":"aws","region":"us-west-2","access_key_id":"ak","access_key_value":"sk","Region":"eu-west-1"}}`, `extfs keys "region" and "Region" differ only in case`},
+	} {
+		_, _, err := mgr.exploreExternalFiles(context.Background(), newJob(tc.spec))
+		require.ErrorIs(t, err, merr.ErrParameterInvalid, tc.spec)
+		require.ErrorContains(t, err, "external source/spec failed revalidation", tc.spec)
+		require.ErrorContains(t, err, tc.wantErr, tc.spec)
+	}
+	require.Zero(t, explored)
+
+	for _, spec := range []string{
+		`{"format":"parquet","extfs":` + extfs + `}`,
+		`{"Format":"parquet","EXTFS":` + extfs + `}`,
+	} {
+		_, _, err := mgr.exploreExternalFiles(context.Background(), newJob(spec))
+		require.NoError(t, err, spec)
+	}
+	require.Equal(t, 2, explored)
+}
+
+// When the collection already has segments, refresh parses the collection's
+// persisted spec to read the baseline manifests. That parse is strict, so a
+// persisted spec that sets one key twice fails every refresh.
+func TestCreateTasksForJob_CollidingBaselineSpecKeys(t *testing.T) {
+	ctx := context.Background()
+	collectionID := int64(100)
+	jobID := int64(1001)
+
+	for _, tc := range []struct{ baselineSpec, wantErr string }{
+		{`{"format":"parquet","extfs":{"region":"us-west-2"},"Extfs":{"use_ssl":"true"}}`, `external spec keys "extfs" and "Extfs" differ only in case`},
+		// A lone other spelling parses, so planning gets as far as reading
+		// the baseline manifests.
+		{`{"Format":"parquet","EXTFS":{"region":"us-west-2"}}`, "read external refresh baseline manifests"},
+	} {
+		ms := metacache.NewMetaStore(nil)
+		ms.PutCollection(&meta.CollectionInfo{ID: collectionID, Schema: &schemapb.CollectionSchema{ExternalSpec: tc.baselineSpec}})
+		segments := meta.NewSegmentsInfo(ms)
+		segments.SetSegment(10, &meta.SegmentInfo{SegmentInfo: &datapb.SegmentInfo{
+			ID:           10,
+			CollectionID: collectionID,
+			State:        commonpb.SegmentState_Flushed,
+			ManifestPath: "baseline-manifest",
+		}})
+		mt := &meta.Meta{MetaStore: ms, Segments: segments}
+		refreshMeta := createTestRefreshMetaWithJobs(t, nil, nil)
+		mgr := NewExternalCollectionRefreshManager(
+			ctx, mt, nil, newStubScheduler(), &stubAllocator{nextID: 2000},
+			refreshMeta, nil, testCollectionGetter(mt), nil, nil, nil).(*Manager)
+
+		mockExplore := mockey.Mock((*Manager).exploreExternalFiles).
+			Return([]packed.FileInfo{{FilePath: "s3://bucket/path/a.parquet", NumRows: 10}}, "manifest-path", nil).
+			Build()
+		mockRead := mockey.Mock(packed.ReadFragmentsFromManifest).
+			Return(nil, errors.New("manifest read failed")).
+			Build()
+
+		job := &datapb.ExternalCollectionRefreshJob{
+			JobId:        jobID,
+			CollectionId: collectionID,
+			State:        indexpb.JobState_JobStateInit,
+			ExternalSpec: `{"format":"parquet"}`,
+		}
+		require.NoError(t, refreshMeta.AddJob(job))
+		tasks, err := mgr.createTasksForJob(ctx, job)
+		mockRead.UnPatch()
+		mockExplore.UnPatch()
+		require.ErrorContains(t, 
```

**File**: `internal/snapshotio/storage/validator.go` (modified, +6/-0)
```diff
@@ -23,6 +23,7 @@ import (
 
 	"github.com/milvus-io/milvus/pkg/v3/objectstorage"
 	"github.com/milvus-io/milvus/pkg/v3/util/externalspec"
+	"github.com/milvus-io/milvus/pkg/v3/util/externalspec/specutil"
 	"github.com/milvus-io/milvus/pkg/v3/util/merr"
 )
 
@@ -355,6 +356,11 @@ func parseSnapshotExternalSpec(externalSpec string) (*externalspec.ExternalSpec,
 	if err := json.Unmarshal([]byte(externalSpec), &snapshotSpec); err != nil {
 		return nil, merr.WrapErrParameterInvalidErr(err, "invalid external spec JSON")
 	}
+	// The re-marshal below would turn "Format" next to "format", or "Extfs"
+	// next to "extfs", into one merged key, so check the keys first.
+	if err := specutil.ValidateExternalSpecKeys(externalSpec); err != nil {
+		return nil, err
+	}
 	snapshotOnly := make(map[string]string)
 	for key := range snapshotExtfsOnlyKeys {
 		if value, ok := snapshotSpec.Extfs[key]; ok {
```

**File**: `internal/snapshotio/storage/validator_test.go` (modified, +29/-0)
```diff
@@ -31,6 +31,7 @@ import (
 	"github.com/milvus-io/milvus/pkg/v3/objectstorage"
 	"github.com/milvus-io/milvus/pkg/v3/proto/datapb"
 	"github.com/milvus-io/milvus/pkg/v3/util/externalspec"
+	"github.com/milvus-io/milvus/pkg/v3/util/merr"
 )
 
 func validateSnapshotForeignStorageForTest(
@@ -110,6 +111,34 @@ func TestValidateSnapshotForeignStorageRestoreGCPServiceAccountJSONAllowed(t *te
 	assert.False(t, cfg.UseIAM)
 }
 
+// A spec with snapshot-only extfs keys is re-marshaled before the generic
+// parser sees it, and the re-marshal would merge two spellings of one key, so
+// the caller's keys are checked first.
+func TestParseSnapshotExternalSpecRejectsCollidingKeys(t *testing.T) {
+	const extfs = `{"cloud_provider":"gcpnative","credential_json":"{}"}`
+	for _, spec := range []string{
+		`{"extfs":` + extfs + `}`,
+		`{"FORMAT":"parquet","EXTFS":` + extfs + `}`,
+	} {
+		parsed, err := parseSnapshotExternalSpec(spec)
+		require.NoError(t, err, spec)
+		assert.Equal(t, "parquet", parsed.Format, spec)
+		assert.Equal(t, "{}", parsed.Extfs[snapshotExtfsKeyCredentialJSON], spec)
+	}
+	for _, tc := range []struct{ spec, wantErr string }{
+		{`{"extfs":` + extfs + `,"Extfs":{"use_iam":"true"}}`, `external spec keys "extfs" and "Extfs" differ only in case`},
+		{`{"format":"parquet","Format":"vortex","extfs":` + extfs + `}`, `external spec keys "format" and "Format" differ only in case`},
+		{`{"extfs":` + extfs + `,"extfs":` + extfs + `}`, `external spec key "extfs" appears more than once`},
+		{`{"extfs":{"cloud_provider":"gcpnative","credential_json":"{}","Credential_Json":"{}"}}`, `extfs keys "credential_json" and "Credential_Json" differ only in case`},
+		// Without snapshot-only keys the spec goes straight to the generic parser.
+		{`{"format":"parquet","FORMAT":"vortex"}`, `external spec keys "format" and "FORMAT" differ only in case`},
+	} {
+		_, err := parseSnapshotExternalSpec(tc.spec)
+		require.ErrorIs(t, err, merr.ErrParameterInvalid, tc.spec)
+		require.ErrorContains(t, err, tc.wantErr, tc.spec)
+	}
+}
+
 func TestApplySnapshotExternalSpecUseIAMClearsInheritedCredentials(t *testing.T) {
 	cfg := objectstorage.NewDefaultConfig()
 	cfg.AccessKeyID = "instance-ak"
```

**File**: `internal/storagev2/packed/exttable_test.go` (modified, +25/-1)
```diff
@@ -1792,13 +1792,37 @@ func TestInjectExternalSpecProperties_LegacyKeys(t *testing.T) {
 	props, err := MakePropertiesFromStorageConfig(config, nil)
 	require.NoError(t, err)
 	defer FreeProperties(props)
-	const spec = `{"FORMAT":"paimon-table","Snapshot_Id":9007199254740993,"SCAN_MODE":"auto","scan_mode":"data-split","EXTFS":{"cloud_provider":"aws","region":"us-east-1","use_iam":"true"}}`
+	const spec = `{"FORMAT":"paimon-table","Snapshot_Id":9007199254740993,"SCAN_MODE":"data-split","EXTFS":{"cloud_provider":"aws","region":"us-east-1","use_iam":"true"}}`
 	require.NoError(t, injectExternalSpecProperties(props, 42, "s3://bucket/table", spec))
 	require.Equal(t, "data-split", loonPropertyString(props, "paimon.scan_mode"))
 	require.Equal(t, "9007199254740993", loonPropertyString(props, "reader.exttable.snapshot_id"))
 	require.Equal(t, "us-east-1", loonPropertyString(props, ExtfsPrefixForCollection(42)+"region"))
 }
 
+// A persisted spec that sets one key twice stops at the Go boundary instead of
+// reaching native code as a merge of both values.
+func TestInjectExternalSpecProperties_RejectsCollidingKeys(t *testing.T) {
+	paramtable.Init()
+	config := &indexpb.StorageConfig{StorageType: "local", RootPath: t.TempDir()}
+	props, err := MakePropertiesFromStorageConfig(config, nil)
+	require.NoError(t, err)
+	defer FreeProperties(props)
+	for _, tc := range []struct{ spec, wantErr string }{
+		{`{"FORMAT":"paimon-table","SCAN_MODE":"auto","scan_mode":"data-split"}`, `external spec keys "SCAN_MODE" and "scan_mode" differ only in case`},
+		{`{"extfs":{"cloud_provider":"gcp","use_iam":"true"},"Extfs":{"gcp_target_service_account":"other@project.iam.gserviceaccount.com"}}`, `external spec keys "extfs" and "Extfs" differ only in case`},
+		{`{"extfs":{"cloud_provider":"aws","region":"us-east-1","region":"eu-west-1"}}`, `extfs key "region" appears more than once`},
+	} {
+		err := injectExternalSpecProperties(props, 42, "s3://bucket/table", tc.spec)
+		require.ErrorIs(t, err, merr.ErrParameterInvalid, tc.spec)
+		require.ErrorContains(t, err, tc.wantErr, tc.spec)
+		source, cSpec, cleanup, err := newCExternalContext("s3://bucket/table", tc.spec)
+		require.ErrorIs(t, err, merr.ErrParameterInvalid, tc.spec)
+		require.Nil(t, source)
+		require.Nil(t, cSpec)
+		require.Nil(t, cleanup)
+	}
+}
+
 func TestNewCExternalContextRejectsMalformedSpec(t *testing.T) {
 	source, spec, cleanup, err := newCExternalContext("s3://bucket/table", `{"Format":"paimon-table","Scan_Mode":true}`)
 	require.ErrorIs(t, err, merr.ErrParameterInvalid)
```

**File**: `internal/util/indexcgowrapper/external_spec_test.go` (modified, +4/-0)
```diff
@@ -42,4 +42,8 @@ func TestMarshalBuildIndexInfoNormalizesHistoricalSpec(t *testing.T) {
 func TestMarshalBuildIndexInfoRejectsInvalidSpec(t *testing.T) {
 	_, err := marshalBuildIndexInfo(&indexcgopb.BuildIndexInfo{ExternalSpec: `{"Scan_Mode":true}`})
 	require.ErrorIs(t, err, merr.ErrParameterInvalid)
+
+	_, err = marshalBuildIndexInfo(&indexcgopb.BuildIndexInfo{ExternalSpec: `{"extfs":{"region":"us-east-1"},"EXTFS":{"use_ssl":"true"}}`})
+	require.ErrorIs(t, err, merr.ErrParameterInvalid)
+	require.ErrorContains(t, err, `external spec keys "extfs" and "EXTFS" differ only in case`)
 }
```

**File**: `pkg/util/externalspec/external_spec.go` (modified, +16/-3)
```diff
@@ -920,15 +920,28 @@ var awsFamilyScheme = map[string]bool{
 // are preserved as extension metadata. Because unknown pre-validation fields
 // may themselves be sensitive, external-collection request logging uses
 // RedactExternalSpecForLog. On parse failure this returns "<invalid spec>"
-// rather than the raw input.
+// rather than the raw input, as it does for a spec that sets a key twice (see
+// specutil.ValidateExternalSpecKeys). A lone other spelling of a known key,
+// such as "EXTFS", is read under its canonical name, as Go and native readers
+// read it.
 func RedactExternalSpec(specStr string) string {
 	if specStr == "" {
 		return ""
 	}
-	var spec map[string]json.RawMessage
-	if err := json.Unmarshal([]byte(specStr), &spec); err != nil {
+	if specutil.ValidateExternalSpecKeys(specStr) != nil {
+		return "<invalid spec>"
+	}
+	var raw map[string]json.RawMessage
+	if err := json.Unmarshal([]byte(specStr), &raw); err != nil {
 		return "<invalid spec>"
 	}
+	var spec map[string]json.RawMessage
+	if raw != nil {
+		spec = make(map[string]json.RawMessage, len(raw))
+		for key, value := range raw {
+			spec[specutil.CanonicalSpecKey(key)] = value
+		}
+	}
 	if err := normalizeInt64Field(spec, "snapshot_id"); err != nil {
 		return "<invalid spec>"
 	}
```

**File**: `pkg/util/externalspec/external_spec_test.go` (modified, +42/-0)
```diff
@@ -53,6 +53,12 @@ func TestMarshalCollectionSchemaNormalizesHistoricalSpec(t *testing.T) {
 	_, err = MarshalCollectionSchema(schema)
 	require.ErrorIs(t, err, merr.ErrParameterInvalid)
 
+	// A persisted spec that sets one key twice is not sent to native code.
+	schema.ExternalSpec = `{"format":"paimon-table","Format":"parquet"}`
+	_, err = MarshalCollectionSchema(schema)
+	require.ErrorIs(t, err, merr.ErrParameterInvalid)
+	require.ErrorContains(t, err, `external spec keys "format" and "Format" differ only in case`)
+
 	schema.ExternalSpec = ""
 	blob, err = MarshalCollectionSchema(schema)
 	require.NoError(t, err)
@@ -65,6 +71,26 @@ func TestValidateSourceAndSpecLegacyKeys(t *testing.T) {
 		`{"Format":"paimon-table","SNAPSHOT_ID":"7","Scan_Mode":"data-split","EXTFS":{"cloud_provider":"aws","region":"us-east-1","anonymous":"true"}}`))
 }
 
+// Create in Proxy and RootCoord, Proxy refresh and DataCoord refresh
+// revalidation all call ValidateSourceAndSpec.
+func TestValidateSourceAndSpecRejectsCollidingKeys(t *testing.T) {
+	const extfs = `{"cloud_provider":"aws","region":"us-east-1","anonymous":"true"}`
+	require.NoError(t, ValidateSourceAndSpec("s3://bucket/table", `{"format":"parquet","extfs":`+extfs+`}`))
+	for _, tc := range []struct{ spec, wantErr string }{
+		{`{"extfs":` + extfs + `,"Extfs":{"role_arn":"arn:aws:iam::123456789012:role/other"}}`, `external spec keys "extfs" and "Extfs" differ only in case`},
+		{`{"EXTFS":` + extfs + `,"Extfs":{"role_arn":"arn:aws:iam::123456789012:role/other"}}`, `external spec keys "EXTFS" and "Extfs" differ only in case`},
+		{`{"format":"parquet","Format":"vortex","extfs":` + extfs + `}`, `external spec keys "format" and "Format" differ only in case`},
+		{`{"cloud_extra":{},"Cloud_Extra":{},"extfs":` + extfs + `}`, `external spec keys "cloud_extra" and "Cloud_Extra" differ only in case`},
+		{`{"extfs":` + extfs + `,"extfs":` + extfs + `}`, `external spec key "extfs" appears more than once`},
+		{`{"extfs":{"cloud_provider":"aws","region":"us-east-1","anonymous":"true","Region":"eu-west-1"}}`, `extfs keys "region" and "Region" differ only in case`},
+		{`{"extfs":{"cloud_provider":"aws","region":"us-east-1","anonymous":"true","region":"eu-west-1"}}`, `extfs key "region" appears more than once`},
+	} {
+		err := ValidateSourceAndSpec("s3://bucket/table", tc.spec)
+		require.ErrorIs(t, err, merr.ErrParameterInvalid, tc.spec)
+		require.ErrorContains(t, err, tc.wantErr, tc.spec)
+	}
+}
+
 func TestParseExternalSpec_Empty(t *testing.T) {
 	spec, err := ParseExternalSpec("")
 	require.NoError(t, err)
@@ -640,6 +666,22 @@ func TestRedactExternalSpec(t *testing.T) {
 		assert.Equal(t, "<invalid spec>", RedactExternalSpec(`{"format":"iceberg-table","snapshot_id":{}}`))
 	})
 
+	t.Run("lone_key_spelling_redacted_under_canonical_name", func(t *testing.T) {
+		out := RedactExternalSpec(`{"Format":"parquet","EXTFS":{"region":"us-east-1","access_key_value":"SEC"},"Snapshot_Id":7}`)
+		assert.NotContains(t, out, "SEC")
+		assert.JSONEq(t, `{"format":"parquet","extfs":{"region":"us-east-1","access_key_value":"***"},"snapshot_id":"7"}`, out)
+	})
+
+	t.Run("key_set_twice_returns_placeholder", func(t *testing.T) {
+		for _, spec := range []string{
+			`{"format":"parquet","extfs":{"access_key_value":"SEC"},"Extfs":{"access_key_value":"SEC2"}}`,
+			`{"format":"parquet","extfs":{"access_key_value":"SEC"},"extfs":{}}`,
+			`{"format":"parquet","extfs":{"access_key_value":"SEC","Access_Key_Value":"SEC2"}}`,
+		} {
+			assert.Equal(t, "<invalid spec>", RedactExternalSpec(spec), spec)
+		}
+	})
+
 	t.Run("preserves_unknown_top_level_fields", func(t *testing.T) {
 		out := RedactExternalSpec(`{
 			"format":"parquet",
```

**File**: `pkg/util/externalspec/specutil/normalize_test.go` (modified, +20/-10)
```diff
@@ -21,6 +21,8 @@ import (
 	"testing"
 
 	"github.com/stretchr/testify/require"
+
+	"github.com/milvus-io/milvus/pkg/v3/util/merr"
 )
 
 func TestNormalizeExternalSpec(t *testing.T) {
@@ -32,18 +34,13 @@ func TestNormalizeExternalSpec(t *testing.T) {
 		{"extfs", `{"EXTFS":{"region":"US-East-1"}}`, `{"extfs":{"region":"US-East-1"}}`},
 		{"snapshot precision", `{"Snapshot_Id":5320540205222981137}`, `{"snapshot_id":"5320540205222981137"}`},
 		{"unicode fold", `{"Format":"paimon-table","ſnapshot_id":"7","ſcan_mode":"data-split"}`, `{"format":"paimon-table","snapshot_id":"7","scan_mode":"data-split"}`},
-		{"last variant", `{"format":"parquet","FORMAT":"vortex"}`, `{"format":"vortex"}`},
-		{"last canonical", `{"FORMAT":"vortex","format":"parquet"}`, `{"format":"parquet"}`},
-		{"identical keys", `{"format":"vortex","format":"parquet"}`, `{"format":"parquet"}`},
-		{"null string keeps value", `{"format":"vortex","FORMAT":null}`, `{"format":"vortex"}`},
-		{"null snapshot clears value", `{"snapshot_id":7,"SNAPSHOT_ID":null}`, `{"snapshot_id":null}`},
-		{"duplicate maps merge", `{"extfs":{"region":"us-east-1"},"EXTFS":{"use_ssl":"true"}}`, `{"extfs":{"region":"us-east-1","use_ssl":"true"}}`},
-		{"null map clears value", `{"extfs":{"region":"us-east-1"},"EXTFS":null}`, `{"extfs":null}`},
-		{"duplicate arrays replace", `{"columns":["a"],"COLUMNS":["b"]}`, `{"columns":["b"]}`},
-		{"null array clears value", `{"columns":["a"],"COLUMNS":null}`, `{"columns":null}`},
+		{"null string", `{"FORMAT":null}`, `{"format":""}`},
+		{"null snapshot", `{"SNAPSHOT_ID":null}`, `{"snapshot_id":null}`},
+		{"null map", `{"EXTFS":null}`, `{"extfs":null}`},
+		{"null array", `{"COLUMNS":null}`, `{"columns":null}`},
+		{"escaped key names", `{"form\u0061t":"paimon-table","\u0045XTFS":{"r\u0065gion":"us-east-1"}}`, `{"format":"paimon-table","extfs":{"region":"us-east-1"}}`},
 		{"scan mode missing", `{"Format":"paimon-table"}`, `{"format":"paimon-table"}`},
 		{"scan mode null", `{"Format":"paimon-table","Scan_Mode":null}`, `{"format":"paimon-table","scan_mode":""}`},
-		{"scan mode duplicate", `{"Format":"paimon-table","SCAN_MODE":"data-split","scan_mode":"direct-file"}`, `{"format":"paimon-table","scan_mode":"direct-file"}`},
 		{"unknown values", `{"Format":"parquet","CUSTOM":{"Format":"untouched","n":9007199254740993,"f":1.2300},"custom":null}`, `{"format":"parquet","CUSTOM":{"Format":"untouched","n":9007199254740993,"f":1.2300},"custom":null}`},
 	} {
 		t.Run(tc.name, func(t *testing.T) {
@@ -80,3 +77,16 @@ func TestNormalizeExternalSpecInvalidTypes(t *testing.T) {
 		require.Equal(t, input, got)
 	}
 }
+
+// NormalizeExternalSpec is the last Go step before native readers, so a
+// persisted spec that sets one key twice fails here instead of reaching native
+// code as a merge of both values.
+func TestNormalizeExternalSpecRejectsCollidingKeys(t *testing.T) {
+	for _, tc := range collidingKeySpecs {
+		t.Run(tc.name, func(t *testing.T) {
+			_, err := NormalizeExternalSpec(tc.spec)
+			require.ErrorIs(t, err, merr.ErrParameterInvalid)
+			require.ErrorContains(t, err, tc.wantErr)
+		})
+	}
+}
```

---

### Incident Patch 3: `8425467c` (2026-11-27)
**Commit Message**: fix: persist segment transform coverage for empty WAL positions (#56054)

issue: #54417

- DataCoord: persist the first Insert's Transform cursor before
filtering physical StartPosition, so Woodpecker's valid empty-encoded
`0/0` ID cannot leave L1 flush publication blocked. Preserve existing
cursors and catalog-before-ack ordering.
- Design: clarify that durable Segment Transform coverage is independent
of the physical seek ID.

Signed-off-by: chyezh <[REDACTED_EMAIL]>

**File**: `docs/design-docs/design_docs/qviews/transform_start_after_timetick.md` (modified, +6/-0)
```diff
@@ -54,6 +54,12 @@ only deletes rows with `insert_ts < delete_ts`. A Delete at or before the
 earliest Insert cannot delete any row in that Segment. Transactions use their
 effective outer commit time. Imported rows use their per-VChannel commit time.
 
+The first data pack persists this logical cursor in SegmentInfo independently
+of accepting its physical StartPosition. An empty serialized seek ID does not
+invalidate the cursor: Woodpecker's valid `0/0` ID encodes as empty bytes. The
+catalog write must succeed before SN acknowledges that pack; retries preserve
+an already initialized cursor, including after recovery.
+
 External collections reject Insert/Delete/Upsert and WAL L1 Flush. Their persisted
 W therefore remains the business VChannel creation origin B across refreshes
 and recovery. New refresh broadcasts reach every target business VChannel and
```

**File**: `internal/datacoord/meta/meta.go` (modified, +7/-4)
```diff
@@ -1626,20 +1626,23 @@ func UpdateStartPosition(startPositions []*datapb.SegmentStartPosition) UpdateOp
 			if s == nil {
 				continue
 			}
+			startPosition := pos.GetStartPosition()
+			// Transform coverage is a logical timestamp, independent of the
+			// physical seek ID (Woodpecker 0/0 serializes to empty bytes).
+			// Persist it with the first data pack even if its seek ID is empty.
+			if s.GetLevel() != datapb.SegmentLevel_L0 && !s.GetIsImporting() && s.GetTransformStartAfterTimetick() == 0 {
+				s.TransformStartAfterTimetick = startPosition.GetTimestamp()
+			}
 			// L0 segments materialized from WALSummary have no physical WAL
 			// position. Their timestamp-only StartPosition is a valid delete
 			// retention boundary used by QueryCoord/delegators, not a WAL seek
 			// position. Dropping it would allow live L0 deletes to be evicted.
-			startPosition := pos.GetStartPosition()
 			if len(startPosition.GetMsgID()) == 0 &&
 				(s.GetLevel() != datapb.SegmentLevel_L0 || startPosition.GetTimestamp() == 0) {
 				continue
 			}
 
 			s.StartPosition = startPosition
-			if s.GetLevel() != datapb.SegmentLevel_L0 && !s.GetIsImporting() && s.GetTransformStartAfterTimetick() == 0 {
-				s.TransformStartAfterTimetick = startPosition.GetTimestamp()
-			}
 		}
 		return true
 	}
```

**File**: `internal/datacoord/meta/segment_operator_test.go` (modified, +62/-0)
```diff
@@ -20,14 +20,18 @@ import (
 	"context"
 	"testing"
 
+	"github.com/bytedance/mockey"
 	"github.com/stretchr/testify/assert"
 	"github.com/stretchr/testify/require"
 	"github.com/stretchr/testify/suite"
 	"google.golang.org/protobuf/proto"
 
+	"github.com/milvus-io/milvus-proto/go-api/v3/commonpb"
 	"github.com/milvus-io/milvus-proto/go-api/v3/msgpb"
 	"github.com/milvus-io/milvus/internal/metacache"
+	catalogkv "github.com/milvus-io/milvus/internal/metastore/kv/datacoord"
 	"github.com/milvus-io/milvus/pkg/v3/proto/datapb"
+	"github.com/milvus-io/milvus/pkg/v3/util/merr"
 )
 
 type TestSegmentOperatorSuite struct {
@@ -66,6 +70,8 @@ func TestUpdateStartPosition(t *testing.T) {
 		{"L0 missing position", datapb.SegmentLevel_L0, nil, false},
 		{"L0 empty position", datapb.SegmentLevel_L0, &msgpb.MsgPosition{}, false},
 		{"L1 timestamp only", datapb.SegmentLevel_L1, &msgpb.MsgPosition{Timestamp: 100}, false},
+		{"L1 Woodpecker zero ID", datapb.SegmentLevel_L1, &msgpb.MsgPosition{Timestamp: 100, WALName: commonpb.WALName_WoodPecker}, false},
+		{"L1 missing position", datapb.SegmentLevel_L1, nil, false},
 		{"L1 WAL position", datapb.SegmentLevel_L1, &msgpb.MsgPosition{MsgID: []byte{1}, Timestamp: 100}, true},
 		{"L1 message ID only", datapb.SegmentLevel_L1, &msgpb.MsgPosition{MsgID: []byte{1}}, true},
 	} {
@@ -86,6 +92,11 @@ func TestUpdateStartPosition(t *testing.T) {
 				want = tc.position
 			}
 			require.True(t, proto.Equal(want, segment.GetStartPosition()))
+			if tc.level != datapb.SegmentLevel_L0 {
+				require.Equal(t, tc.position.GetTimestamp(), segment.GetTransformStartAfterTimetick())
+			} else {
+				require.Zero(t, segment.GetTransformStartAfterTimetick())
+			}
 		})
 	}
 
@@ -101,6 +112,57 @@ func TestUpdateStartPosition(t *testing.T) {
 	})
 }
 
+func TestFirstPackTransformCoveragePersistence(t *testing.T) {
+	ctx := context.Background()
+	m, err := NewMemoryMeta(t)
+	require.NoError(t, err)
+	require.NoError(t, m.AddSegment(ctx, NewSegmentInfo(&datapb.SegmentInfo{
+		ID: 1, CollectionID: 100, PartitionID: 10, InsertChannel: "ch",
+		Level: datapb.SegmentLevel_L1, State: commonpb.SegmentState_Growing,
+	})))
+	first := UpdateStartPosition([]*datapb.SegmentStartPosition{{
+		SegmentID: 1, StartPosition: &msgpb.MsgPosition{
+			ChannelName: "ch", Timestamp: 100, WALName: commonpb.WALName_WoodPecker,
+		},
+	}})
+	// A failed catalog write must leave both persisted and in-memory coverage
+	// unknown, so the caller retries before acknowledging the first data pack.
+	failure := mockey.Mock((*catalogkv.Catalog).AlterSegments).Return(merr.ErrServiceUnavailable).Build()
+	t.Cleanup(func() { failure.UnPatch() })
+	require.ErrorIs(t, m.UpdateSegmentsInfo(ctx, first), merr.ErrServiceUnavailable)
+	require.Zero(t, m.GetSegment(ctx, 1).GetTransformStartAfterTimetick())
+	stored, err := m.Catalog.ListSegments(ctx, 100)
+	require.NoError(t, err)
+	require.Len(t, stored, 1)
+	require.Zero(t, stored[0].GetTransformStartAfterTimetick())
+	failure.UnPatch()
+
+	require.NoError(t, m.UpdateSegmentsInfo(ctx, first))
+	require.NoError(t, m.UpdateSegmentsInfo(ctx, first), "first-pack replay is idempotent")
+	stored, err = m.Catalog.ListSegments(ctx, 100)
+	require.NoError(t, err)
+	require.Len(t, stored, 1)
+	require.Equal(t, uint64(100), stored[0].GetTransformStartAfterTimetick())
+
+	// Reload through the real metadata loader. Final publication must resolve
+	// coverage from the persisted field even without a physical StartPosition.
+	recovered, err := NewMeta(ctx, m.Catalog, nil, NewMetaStoreWithCollections(m.Catalog, 100), nil, NoDomainMetas)
+	require.NoError(t, err)
+	t.Cleanup(recovered.CloseManifestCommitExecutor)
+	segment := recovered.GetSegment(ctx, 1)
+	require.NotNil(t, segment)
+	require.Nil(t, segment.GetStartPosition())
+	require.Equal(t, uint64(100), SegmentTransformStart(segment))
+	require.NoError(t, recovered.UpdateSegmentsInfo(ctx, UpdateStartPosition([]*datapb.SegmentStartPosition{{
+		SegmentID: 1, StartPosition: &msgpb.MsgPosition{Timestamp: 200, MsgID: []byte{1}},
+	}})))
+	require.Equal(t, uint64(100), SegmentTransformStart(recovered.GetSegment(ctx, 1)), "later positions cannot skip earlier transforms")
+
+	importing := &SegmentInfo{SegmentInfo: &datapb.SegmentInfo{ID: 1, Level: datapb.SegmentLevel_L1, IsImporting: true}}
+	require.True(t, first(&UpdateSegmentPack{Segments: map[int64]*SegmentInfo{1: importing}}))
+	require.Zero(t, importing.GetTransformStartAfterTimetick(), "import coverage comes from its commit")
+}
+
 func TestUpdateImportSegmentPosition(t *testing.T) {
 	t.Run("segment not found", func(t *testing.T) {
 		// Create a meta with empty segments to properly test the "not found" case
```

#### Recent Merged Pull Requests:
- **PR #56130** (2026-11-27): enhance: [3.0] Propagate caller context in console metadata handlers (@weiliu1031)
- **PR #56124** (2026-11-27): test: Fix Parquet array validation and snapshot backfill waits (@yanliang567)
- **PR #56120** (2026-11-27): build(deps): bump milvus-storage for Talon Broker routing (@jiaqizho)
- **PR #56119** (2026-11-27): build(deps): [3.0] bump milvus-storage for Talon Broker routing (@jiaqizho)
- **PR #56113** (2026-11-27): enhance: Bump milvus & proto version to v3.0.7 (@congqixia)
- **PR #56109** (2026-11-27): enhance: [3.0] Support business-version conditional upserts in the Go SDK (@weiliu1031)

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

## X. enhance: Build MILVUS_FIPS_ENABLED=ON on Go's FIPS 140-3 module

**RULE**:
When implementing operations in `Makefile`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in milvus-io/milvus. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `3b35b67b`: enhance: Build MILVUS_FIPS_ENABLED=ON on Go's FIPS 140-3 module. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `Makefile`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	asan_go_tag := ,use_asan
        cuda_go_tag := ,cuda
# All Go artifacts loaded into the same process must use the same snapshot.
# Go 1.26.10 resolves v1.0.0 to the certified v1.0.0-c2097c7c (CMVP #5247).
ifeq ($(MILVUS_FIPS_ENABLED),ON)
ifneq ($(findstring ',$(MILVUS_GO_BUILD_TAGS))$(findstring ",$(MILVUS_GO_BUILD_TAGS)),)
$(error FIPS build tags must not contain literal quote characters)
endif
	override GOFIPS140 := v1.0.0
	export GOFIPS140
	# Go accepts whitespace-separated or comma-separated tags. Normalize custom
	# lists before adding a required tag so the Go tool sees it as its own tag.
	empty :=
	space := $(empty) $(empty)
	comma := ,
	fips_go_tags := $(subst $(comma), ,$(MILVUS_GO_BUILD_TAGS)$(asan_go_tag)$(cuda_go_tag))
	override MILVUS_GO_BUILD_TAGS := $(subst $(space),$(comma),$(strip $(filter-out milvus_fips,$(fips_go_tags)) milvus_fips))
else
	MILVUS_GO_BUILD_TAGS := $(MILVUS_GO_BUILD_TAGS)$(asan_go_tag)$(cuda_go_tag)
endif

# Expose the server's Go module selection to external packaging builds.
.PHONY: print-fips-go-module
print-fips-go-module:
	@printf '%s\n' "$$GOFIPS140"

		CGO_LDFLAGS="$(CGO_LDFLAGS)" CGO_CFLAGS="$(CGO_CFLAGS)" CGO_CXXFLAGS="$(CGO_CXXFLAGS)" GO
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
	MILVUS_GO_BUILD_TAGS := $(MILVUS_GO_BUILD_TAGS),use_asan
# FIPS: default OFF. Set MILVUS_FIPS_ENABLED=ON to enable BoringCrypto.
GOEXPERIMENT_FLAG :=
ifeq ($(MILVUS_FIPS_ENABLED),ON)
	GOEXPERIMENT_FLAG := GOEXPERIMENT=boringcrypto
endif
        MILVUS_GO_BUILD_TAGS := $(MILVUS_GO_BUILD_TAGS),cuda
		$(GOEXPERIMENT_FLAG) CGO_LDFLAGS="$(CGO_LDFLAGS)" CGO_CFLAGS="$(CGO_CFLAGS)" CGO_CXXFLAGS="$(CGO_CXXFLAGS)" GO111MODULE=on $(GO) build -pgo=$(PGO_PATH)/default.pgo -ldflags="$(TSAN_GO_LDFLAGS) $(SONIC_PLUGIN_SYNC_LDFLAG) -r $${RPATH} -X '$(OBJPREFIX).BuildTags=$(BUILD_TAGS)' -X '$(OBJPREFIX).BuildTime=$(BUILD_TIME)' -X '$(OBJPREFIX).GitCommit=$(GIT_COMMIT)' -X '$(OBJPREFIX).GoVersion=$(GO_VERSION)' -X '$(OBJPREFIX).MilvusVersion=$(MILVUS_VERSION)'" \
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `3b35b67b` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
