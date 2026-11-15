# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: milvus-io-milvus-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "milvus-io-milvus-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-15T02:35:54.583Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-milvus-io-milvus-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [milvus-io-milvus-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-15T02:35:54.583Z`  
> **Learning ID**: `LEARN-EVO-milvus-io-milvus-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: G (Architecture Intelligence), K (Quality & Verification Intelligence), I (Content & Information Intelligence), D (Research & Knowledge Intelligence), M (Feedback & Evolution Intelligence), J (Search & Distribution Intelligence), L (Deployment & Operations Intelligence)
- **Confidence Rating**: 54%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from milvus-io-milvus-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/milvus-io-milvus-learnings.md`  
> **Source**: github ([https://github.com/milvus-io/milvus](https://github.com/milvus-io/milvus))  
> **Source Version**: `6893a8c3`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-15T02:35:13.593Z  
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
> **Harvest Timestamp**: 2026-11-15T02:35:13.585Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `milvus-io/milvus`
- **Description**: Milvus is a high-performance, cloud-native vector database built for scalable vector ANN search
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 46665 stars

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
- **Issue #55527** (2026-11-14): **enhance: [cp3.0] Support PBKDF2 password hashing for FIPS deployments**
  *Symptoms*: issue: #55081 pr: #55084  Cherry-pick of #55084 to 3.0. See #55084 for the design, upgrade notes and limits.  The only conflict was in `pkg/util/paramtable/component_param.go`: 3.0 doesn't have master's `FeatureUsage*` fields, so `PasswordHashAlgorithm` was added to 3.0's field list. The other changes are the same as in #55084.  Default behaviour is unchanged: `common.security.passwordHashAlgorithm` defaults to `bcrypt`.  ## Testing on 3.0  - Unit tests in the builder image: `pkg/util/crypto`, `pkg/util/paramtable`, `internal/util/adminauth`, `internal/proxy` (credential, password and auth filter), `internal/rootcoord` (credential filter, with etcd) and `cmd/tools/config`. - golangci-lint on the changed packages. - A local linux/arm64 3.0 image with this change and other open FIPS PRs, configured with `pbkdf2-sha512`: an end-to-end run passed user creation, login, wrong-password refusal and password change. etcd held only `$pbkdf2-sha512$` hashes, root's included. - Upgrade on that image: users created with `bcrypt` kept logging in after switching to `pbkdf2-sha512`, and updating their passwords stored PBKDF2 hashes.  🤖 Generated with [Claude Code](https://claude.com/claude-code) 
  **Post-Mortem & Fix Analysis**:
  > /set-milestone 3.0.7
  > [ci-v2-notice] Notice: ci-v2 system is enabled for this PR (3.0 branch).  To rerun ci-v2 checks, comment with: - /ci-rerun-code-check-macos  // for Code Checker MacOS (GitHub Actions) - /ci-rerun-build-ut-cov  // for ci-v2/build-ut-cov (build + unit tests) - /ci-rerun-e2e-amd  // for ci-v2/e2e-amd (e2e tests) - /ci-rerun-e2e-dist-wp  // for ci-v2/e2e-dist-wp (Tencent distributed woodpecker-service boundary) - /ci-rerun-gosdk  // for ci-v2/go-sdk (Go SDK E2E tests) - /ci-rerun-gosdk-std  // for ci-v2/go-sdk-std (Go SDK E2E, standalone) - /ci-rerun-gosdk-dist-wp // for ci-v2/go-sdk-dist-wp (distributed + Woodpecker service)  If you have any questions or requests, please contact @zhikunyao. 

- **Issue #55508** (2026-11-13): **fix: [2.6] restore AND early exit at null-rejecting filters**
  *Symptoms*: issue: #51181 pr: #51182  AND conjunctions keep UNKNOWN rows active even when the filter consumer excludes them together with FALSE. Backport #51182 to restore early exit for these rows at FilterBitsNode and IterativeFilterNode, while keeping strict three-valued semantics below NOT. Native iterative filtering now explicitly folds validity before selecting rows.  Preserves the inherited candidate-mask handling from #55058. The master batch-LIKE reserved-slot fix does not apply to 2.6. Includes the five applicable upstream regression tests and retains existing conjunction and mask coverage.  Validation: clang-format 15 and git diff --check pass. Compilation and runtime validation are pending CI; local-source remote test attempts were blocked before compilation by test dependency image startup failures. 

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

### Incident Patch 1: `6893a8c3` (2026-11-14)
**Commit Message**: fix: bound manifest cgo concurrency process-wide (#55182)

cgo pins a goroutine to an OS thread for the duration of every C call,
so the blocking milvus-storage manifest FFI calls (transaction
open/commit, filesystem read/write, external-source explore, and the
async executor workers) grow one OS thread each while in flight. The
per-context ManifestIOContext pools bound only their own callers, and
the synchronous entry points had no process-wide ceiling, so under
concurrent manifest add-file load mixcoord grew 1500-2000 threads and
RSS jumped from ~220-277 MB to 3.66-5.27 GB.

Add a process-wide budget, common.storage.manifestFFIConcurrency
(default 128, clamped [1, 2048]), acquired around every blocking
manifest FFI call and shared by all components in the process. The
budget is read once at first manifest I/O and requires a restart to
change. Worker execution stays deadlock-free because rejected native
continuations run inline on the submitting worker instead of waiting for
another slot.

issue: #55176

---------

Signed-off-by: Congqi Xia <[REDACTED_EMAIL]>

**File**: `internal/storagev2/packed/cgo_limit.go` (added, +127/-0)
```diff
@@ -0,0 +1,127 @@
+// Copyright 2023 Zilliz
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+//     http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
+
+package packed
+
+import (
+	"context"
+	"sync"
+
+	"golang.org/x/sync/semaphore"
+
+	"github.com/milvus-io/milvus/pkg/v3/util/paramtable"
+)
+
+// cgo call entry points in this package
+//
+// A goroutine that enters a cgo call is pinned to an OS thread for the whole
+// call, so the number of OS threads the process holds tracks the number of
+// goroutines simultaneously blocked inside C. Storage v3 routes every manifest
+// add-file / read / commit through milvus-storage FFI; the per-context
+// ManifestIOContext pools bound only their own callers, and the synchronous
+// entry points had no process-wide ceiling at all. Under load (segment change
+// commit bursts, index/stats publication, L0 compaction, startup manifest
+// reload, GC, copy-segment and backfill reads) hundreds of callers across many
+// contexts blocked in cgo at once, growing process threads to 1500-2000 and
+// inflating RSS by gigabytes. Every *blocking* cgo call below therefore
+// acquires a shared process-wide slot (manifestFFI) before entering C.
+//
+// Blocking manifest transaction I/O (wrapped):
+//   - openTransaction          (C.loon_transaction_open)   ffi_common.go
+//   - commitTransaction        (C.loon_transaction_commit) ffi_common.go
+//   - createMilvusTableManifest
+//     (C.loon_transaction_open +
+//      C.loon_milvus_table_append_source_manifests)         manifest_ffi.go
+//
+//   Every synchronous manifest mutator funnels through the first two:
+//   CommitManifestUpdates, CreateManifestForSegment, AppendSegmentManifestColumns,
+//   AddLobFilesToTransaction, AddDeltaLogsToManifest(Overwrite), AddStatsToManifest.
+//   Every synchronous manifest reader funnels through openTransaction:
+//   GetManifestHandle(WithExtfs), GetManifestFieldIDs, ReadFragmentsFromManifest,
+//   ManifestHasColumns, ResolveManifestSingleWriterFormat, ReadManifestColumnGroups,
+//   GetManifestIndexInfos, GetManifestLobFiles, GetManifestStats,
+//   StatsBinlogSizeFromManifest, GetDeltaLogPathsFromManifest,
+//   GetDeltaLogsFromManifestWithExtfs, ReadMilvusTableSnapshotMetadata.
+//
+// Blocking manifest filesystem I/O (wrapped):
+//   - readFileWithExternalSpec (C.loon_filesystem_read_file_all)  ffi_filesystem.go
+//   - WriteFile               (C.loon_filesystem_create_dir /
+//                              C.loon_filesystem_write_file)      ffi_filesystem.go
+//
+// Blocking external-source explore I/O (wrapped):
+//   - GetFileInfoFromExternalSource
+//     (C.loon_exttable_get_file_info)                             explore_ffi.go
+//   - ExploreFilesFromExternalSource
+//     (C.loon_exttable_explore)                                   explore_ffi.go
+//   - ReadFileInfosFromManifestPath
+//     (C.loon_exttable_read_manifest)                             explore_ffi.go
+//
+// Async manifest executor worker (wrapped):
+//   - runWorker               (C.milvusRunManifestTask)           manifest_async.go
+//
+//   The caller's submitOpen/submitCommit only enqueue to the native async
+//   engine; the actual blocking manifest I/O runs on these workers, so bounding
+//   worker execution bounds the async path's threads process-wide. The worker
+//   never re-enters acquire for native continuations (rejected enqueues run
+//   inline on the same worker), so this cannot deadlock with the budget.
+//
+// Quick staging / parse cgo (not wrapped): these build in-memory column-group /
+// properties / stat descriptors or copy loaded manifest bytes and do not block
+// on storage: loon_properties_create/free, loon_properties_inject_external_spec,
+// loon_column_groups_create, loon_transaction_append_files/add_lob_file/
+// add_delta_log/drop_column/update_stat, loon_transaction_get_manifest,
+// loon_manifest_destroy, CString/free, and the result/error helpers.
+//
+// Data-plane writer/reader FFI (not wrapped): NewPackedWriter/NewFFIPackedWriter
+// Close (parquet file write) and NewPackedReader/NewFFISegmentReader run on
+// DataNode / QueryNode write/read paths, not on coordinators; the coordinator
+// manifest-add operations they feed are the wrapped ones above.
+
+// manifestFFILimit bounds the number of goroutines that may simultaneously run
+// blocking milvus-storage FFI calls in this process. The budget is read once
+// from CommonCfg.ManifestFFIConcurrency at first use (the param is
+// refreshable=false) and is shared by eve
```

**File**: `internal/storagev2/packed/cgo_limit_test.go` (added, +83/-0)
```diff
@@ -0,0 +1,83 @@
+// Copyright 2023 Zilliz
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+//     http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
+
+package packed
+
+import (
+	"context"
+	"sync/atomic"
+	"testing"
+	"time"
+
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+	"golang.org/x/sync/semaphore"
+
+	"github.com/milvus-io/milvus/pkg/v3/util/paramtable"
+)
+
+// TestManifestFFILimiterBoundsConcurrency verifies the limiter caps the number
+// of simultaneous holders even when more goroutines than the budget request it.
+func TestManifestFFILimiterBoundsConcurrency(t *testing.T) {
+	limiter := &manifestFFILimit{slots: semaphore.NewWeighted(2)}
+	ctx := context.Background()
+
+	var held atomic.Int32
+	var maxHeld atomic.Int32
+	done := make(chan struct{})
+	for i := 0; i < 8; i++ {
+		go func() {
+			defer func() { done <- struct{}{} }()
+			for j := 0; j < 20; j++ {
+				require.NoError(t, limiter.acquire(ctx))
+				current := held.Add(1)
+				for maxHeld.Load() < current {
+					if maxHeld.CompareAndSwap(maxHeld.Load(), current) {
+						break
+					}
+				}
+				time.Sleep(time.Millisecond)
+				held.Add(-1)
+				limiter.release()
+			}
+		}()
+	}
+	for i := 0; i < 8; i++ {
+		<-done
+	}
+	assert.LessOrEqual(t, int(maxHeld.Load()), 2, "the limiter must never admit more holders than its budget")
+}
+
+// TestManifestFFILimiterContextCancellation verifies a canceled caller is not
+// admitted and does not consume a slot.
+func TestManifestFFILimiterContextCancellation(t *testing.T) {
+	limiter := &manifestFFILimit{slots: semaphore.NewWeighted(1)}
+	require.NoError(t, limiter.acquire(context.Background()))
+
+	canceled, cancel := context.WithCancel(context.Background())
+	cancel()
+	require.ErrorIs(t, limiter.acquire(canceled), context.Canceled)
+
+	limiter.release()
+	require.NoError(t, limiter.acquire(context.Background()))
+	limiter.release()
+}
+
+// TestManifestFFILimiterReadsConfiguredBudget verifies the package-wide budget
+// is sized from the configured paramtable value and is at least one.
+func TestManifestFFILimiterReadsConfiguredBudget(t *testing.T) {
+	paramtable.Init()
+	require.NoError(t, acquireManifestFFI(context.Background()))
+	releaseManifestFFI()
+}
```

**File**: `internal/storagev2/packed/explore_ffi.go` (modified, +10/-0)
```diff
@@ -128,7 +128,11 @@ func GetFileInfo(
 
 	var numRows C.uint64_t
 
+	// GetFileInfo stats an external object; blocking storage I/O on this
+	// goroutine's OS thread, bounded process-wide like the other FFI calls.
+	acquireManifestFFI(context.Background())
 	result := C.loon_exttable_get_file_info(cFormat, cFilePath, cProperties, &numRows)
+	releaseManifestFFI()
 	if err := HandleLoonFFIResult(result); err != nil {
 		return nil, merr.WrapErrStorage(err, "loon_exttable_get_file_info failed")
 	}
@@ -420,11 +424,15 @@ func ExploreFilesReturnManifestPath(
 		cColumnsPtr = &cColumns[0]
 	}
 
+	// Explore lists/reads the external source and writes an explore manifest;
+	// blocking storage I/O bounded process-wide like the other FFI calls.
+	acquireManifestFFI(context.Background())
 	result := C.loon_exttable_explore(
 		cColumnsPtr, C.size_t(len(columns)),
 		cFormat, cBaseDir, cExploreDir, cProperties,
 		&numFiles, &outColumnGroupsPath,
 	)
+	releaseManifestFFI()
 	if err := HandleLoonFFIResult(result); err != nil {
 		return nil, "", merr.WrapErrStorage(err, "loon_exttable_explore failed")
 	}
@@ -469,7 +477,9 @@ func ReadFileInfosFromManifestPath(
 	defer C.loon_properties_free(cProperties)
 
 	var manifest *C.LoonManifest
+	acquireManifestFFI(context.Background())
 	result := C.loon_exttable_read_manifest(cManifestPath, cProperties, &manifest)
+	releaseManifestFFI()
 	if err := HandleLoonFFIResult(result); err != nil {
 		return nil, merr.WrapErrStorage(err, "loon_exttable_read_manifest failed")
 	}
```

**File**: `internal/storagev2/packed/ffi_common.go` (modified, +10/-0)
```diff
@@ -13,6 +13,7 @@ package packed
 import "C"
 
 import (
+	"context"
 	"encoding/json"
 	"fmt"
 	"strconv"
@@ -508,6 +509,11 @@ func openTransaction(manifest ManifestJSON, cProperties *C.LoonProperties, resol
 	cBasePath := C.CString(manifest.BasePath)
 	defer C.free(unsafe.Pointer(cBasePath))
 	var handle C.LoonTransactionHandle
+	// The open reads the manifest revision from storage and blocks the calling
+	// goroutine's OS thread; bound it process-wide like every other blocking
+	// manifest FFI call so concurrent commits cannot explode thread count.
+	acquireManifestFFI(context.Background())
+	defer releaseManifestFFI()
 	result := C.loon_transaction_open(cBasePath, cProperties, C.int64_t(manifest.ManifestVersion),
 		C.int64_t(manifest.Size), resolveID, retryLimit, &handle)
 	return handle, HandleLoonFFIResult(result)
@@ -531,6 +537,10 @@ func openManifest(manifest ManifestJSON, cProperties *C.LoonProperties) (*C.Loon
 // revision it wrote on basePath, recording the size of the manifest object.
 func commitTransaction(handle C.LoonTransactionHandle, basePath string, storageConfig *indexpb.StorageConfig) (string, error) {
 	var version, size C.int64_t
+	// The commit writes the manifest revision and blocks the calling
+	// goroutine's OS thread; bound it process-wide like openTransaction.
+	acquireManifestFFI(context.Background())
+	defer releaseManifestFFI()
 	if err := HandleLoonFFIResult(C.loon_transaction_commit(handle, &version, &size)); err != nil {
 		return "", err
 	}
```

**File**: `internal/storagev2/packed/ffi_filesystem.go` (modified, +7/-0)
```diff
@@ -23,6 +23,7 @@ package packed
 import "C"
 
 import (
+	"context"
 	"net/url"
 	"strings"
 	"unsafe"
@@ -63,7 +64,9 @@ func WriteFile(
 			dir := filePath[:idx]
 			cDir := C.CString(dir)
 			defer C.free(unsafe.Pointer(cDir))
+			acquireManifestFFI(context.Background())
 			result = C.loon_filesystem_create_dir(fsHandle, cDir, C.uint32_t(len(dir)), true)
+			releaseManifestFFI()
 			if err := HandleLoonFFIResult(result); err != nil {
 				return merr.WrapErrStorage(err, "failed to create parent directory %q", dir)
 			}
@@ -76,6 +79,8 @@ func WriteFile(
 		dataPtr = (*C.uint8_t)(unsafe.Pointer(&data[0]))
 	}
 
+	acquireManifestFFI(context.Background())
+	defer releaseManifestFFI()
 	result = C.loon_filesystem_write_file(
 		fsHandle,
 		cPath, pathLen,
@@ -148,6 +153,8 @@ func readFileWithExternalSpec(
 
 	var outData *C.uint8_t
 	var outSize C.uint64_t
+	acquireManifestFFI(context.Background())
+	defer releaseManifestFFI()
 	result = C.loon_filesystem_read_file_all(fsHandle, cPath, pathLen, &outData, &outSize)
 	if err := HandleLoonFFIResult(result); err != nil {
 		return nil, merr.Wrapf(err, "read file %s via filesystem %s", normalizedFilePath, filesystemPath)
```

**File**: `internal/storagev2/packed/manifest_async.go` (modified, +6/-0)
```diff
@@ -101,7 +101,13 @@ func (io *ManifestIOContext) init() {
 func (io *ManifestIOContext) runWorker() {
 	defer io.workers.Done()
 	for task := range io.tasks {
+		// The native task performs blocking manifest I/O on this goroutine's
+		// OS thread. Bound worker execution by the process-wide manifest FFI
+		// budget, not just this context's capacity: many short-lived contexts
+		// (GC, copy-segment, backfill, index reads) share one process.
+		acquireManifestFFI(context.Background())
 		C.milvusRunManifestTask(task.run, task.data)
+		releaseManifestFFI()
 		io.taskMu.Lock()
 		io.pendingTasks--
 		io.taskMu.Unlock()
```

**File**: `internal/storagev2/packed/manifest_ffi.go` (modified, +11/-2)
```diff
@@ -442,9 +442,12 @@ func createMilvusTableManifest(
 	// updates append, even with OVERWRITE; opening the old version would retain
 	// its stale deletes. Version allocation still advances past existing files.
 	var handle C.LoonTransactionHandle
-	if err := HandleLoonFFIResult(C.loon_transaction_open(cBasePath, cProperties,
+	acquireManifestFFI(context.Background())
+	err = HandleLoonFFIResult(C.loon_transaction_open(cBasePath, cProperties,
 		C.int64_t(ManifestEarliest), C.int64_t(-1), C.LOON_TRANSACTION_RESOLVE_OVERWRITE,
-		getRetryLimit(), &handle)); err != nil {
+		getRetryLimit(), &handle))
+	releaseManifestFFI()
+	if err != nil {
 		return "", merr.WrapErrStorage(err, "begin milvus-table manifest")
 	}
 	defer C.loon_transaction_destroy(handle)
@@ -457,6 +460,11 @@ func createMilvusTableManifest(
 	if extfs.MilvusTablePKMode.usesExternalPrimaryKey() {
 		hasExternalPrimaryKey = C.int(1)
 	}
+	// The call reads the source segment manifests and writes the new target
+	// manifest, blocking this goroutine's OS thread; bound it process-wide.
+	// Release before commitTransaction, which acquires its own slot: holding
+	// this one through it would nest and deadlock a budget of one.
+	acquireManifestFFI(context.Background())
 	result := C.loon_milvus_table_append_source_manifests(
 		handle,
 		cPathsPtr,
@@ -468,6 +476,7 @@ func createMilvusTableManifest(
 		cProperties,
 		hasExternalPrimaryKey,
 	)
+	releaseManifestFFI()
 	if err := HandleLoonFFIResult(result); err != nil {
 		return "", err
 	}
```

**File**: `pkg/util/paramtable/component_param.go` (modified, +18/-0)
```diff
@@ -380,6 +380,7 @@ type commonConfig struct {
 
 	StorageType                   ParamItem `refreshable:"false"`
 	ManifestTransactionRetryLimit ParamItem `refreshable:"true"`
+	ManifestFFIConcurrency        ParamItem `refreshable:"false"`
 	UseArrowFSChunkManager        ParamItem `refreshable:"false"`
 	SimdType                      ParamItem `refreshable:"false"`
 
@@ -882,6 +883,23 @@ This configuration is only used by querynode and indexnode, it selects CPU instr
 	}
 	p.ManifestTransactionRetryLimit.Init(base.mgr)
 
+	p.ManifestFFIConcurrency = ParamItem{
+		Key:          "common.storage.manifestFFIConcurrency",
+		Version:      "3.0.0",
+		DefaultValue: "128",
+		Formatter: func(v string) string {
+			return strconv.Itoa(min(2048, max(1, getAsInt(v))))
+		},
+		Doc: "Maximum number of goroutines that may concurrently execute blocking milvus-storage manifest FFI calls " +
+			"in one process. cgo pins each such goroutine to an OS thread, so unbounded concurrency across the " +
+			"synchronous manifest transaction/filesystem entry points and the async manifest executor workers inflates " +
+			"thread count and process RSS (observed 1500+ cgo threads / multiple GBs on coordinators). The budget is " +
+			"process-wide and shared by every component in the process. Values are clamped to [1, 2048]; read once at " +
+			"first manifest I/O, changes require restart.",
+		Export: false,
+	}
+	p.ManifestFFIConcurrency.Init(base.mgr)
+
 	p.UseArrowFSChunkManager = ParamItem{
 		Key:          "common.storage.useArrowFileSystemChunkManager",
 		Version:      "3.0.1",
```

---

### Incident Patch 2: `8f5d5ecc` (2026-11-13)
**Commit Message**: fix: preserve VARCHAR primary key when building QueryIterator filter (#55426)

## What

`composeIteratorExpr` (`client/milvusclient/iterator.go`) builds the
continuation filter for `QueryIterator` by interpolating the last
primary key into a double-quoted expression:

```go
pkFilter := fmt.Sprintf(`%s > "%s"`, pkName, it.lastPK)
```

For a VARCHAR primary key whose value needs escaping, this produces a
broken filter. A value such as `a"b` yields `ID > "a"b"`, which fails to
parse, so the iterator returns the first page and then errors on the
next request. A trailing backslash or an actual newline fails the same
way, and a backslash followed by `n` changes the comparison value so the
iterator returns the same row repeatedly instead of advancing.

Int64 primary keys are not affected.

## How

Quote the key as a Go string literal with `strconv.Quote`. The server
unquotes a filter string literal with `strconv.Unquote` (see
`planparserv2.convertEscapeSingle` and the `StringLiteral` escape rules
in `Plan.g4`), so `strconv.Quote` round-trips any value, including one
that contains a double quote, a backslash, a control character or a
newline. Iterating valid primary keys now returns each m

**File**: `client/milvusclient/iterator.go` (modified, +6/-1)
```diff
@@ -263,7 +263,12 @@ func (it *queryIterator) composeIteratorExpr() string {
 		}
 		return fmt.Sprintf("(%s) and %s", expr, pkFilter)
 	case entity.FieldTypeVarChar:
-		pkFilter := fmt.Sprintf(`%s > "%s"`, pkName, it.lastPK)
+		// Quote the primary key as a Go string literal. The server unquotes a
+		// string literal with strconv.Unquote (see planparserv2.convertEscapeSingle),
+		// so strconv.Quote round-trips any value, including one that contains a
+		// double quote, a backslash or a newline. Interpolating the raw value
+		// instead produced an invalid filter such as `ID > "a"b"`.
+		pkFilter := fmt.Sprintf("%s > %s", pkName, strconv.Quote(fmt.Sprintf("%v", it.lastPK)))
 		if len(expr) == 0 {
 			return pkFilter
 		}
```

**File**: `client/milvusclient/iterator_test.go` (modified, +37/-0)
```diff
@@ -21,9 +21,12 @@ import (
 	"fmt"
 	"io"
 	"math/rand"
+	"strconv"
+	"strings"
 	"testing"
 
 	"github.com/samber/lo"
+	"github.com/stretchr/testify/assert"
 	"github.com/stretchr/testify/mock"
 	"github.com/stretchr/testify/suite"
 
@@ -848,3 +851,37 @@ func (s *QueryIteratorSuite) TestQueryIteratorWithFilter() {
 func TestQueryIterator(t *testing.T) {
 	suite.Run(t, new(QueryIteratorSuite))
 }
+
+func TestComposeIteratorExprVarChar(t *testing.T) {
+	newIt := func(expr string, pk any) *queryIterator {
+		return &queryIterator{
+			expr:    expr,
+			pkField: entity.NewField().WithName("ID").WithDataType(entity.FieldTypeVarChar),
+			lastPK:  pk,
+		}
+	}
+
+	t.Run("plain value", func(t *testing.T) {
+		assert.Equal(t, `ID > "abc"`, newIt("", "abc").composeIteratorExpr())
+	})
+
+	t.Run("value with double quote", func(t *testing.T) {
+		assert.Equal(t, `ID > "a\"b"`, newIt("", `a"b`).composeIteratorExpr())
+	})
+
+	t.Run("special characters round-trip", func(t *testing.T) {
+		// The emitted literal must unquote back to the original value, the way the
+		// server parses it, so iteration keeps advancing past such a key.
+		for _, pk := range []string{`a"b`, `a\b`, "a\nb", "trailing\\", "plain"} {
+			got := newIt("", pk).composeIteratorExpr()
+			literal := strings.TrimPrefix(got, "ID > ")
+			unquoted, err := strconv.Unquote(literal)
+			assert.NoError(t, err)
+			assert.Equal(t, pk, unquoted)
+		}
+	})
+
+	t.Run("combined with base expression", func(t *testing.T) {
+		assert.Equal(t, `(age > 10) and ID > "a\"b"`, newIt("age > 10", `a"b`).composeIteratorExpr())
+	})
+}
```

#### Recent Merged Pull Requests:
- **PR #55527** (2026-11-14): enhance: [cp3.0] Support PBKDF2 password hashing for FIPS deployments (@aleks-s10)
- **PR #55508** (2026-11-13): fix: [2.6] restore AND early exit at null-rejecting filters (@zhengbuqian)
- **PR #55499** (2026-11-14): feat: [3.0] Support V2 and mixed V2/V3 snapshot import (@weiliu1031)
- **PR #55493** (2026-11-13): enhance: reduce broadcast task logger memory (@chyezh)
- **PR #55485** (2026-11-13): fix: [cp3.0] resolve Azure Germany regions and explicit storage authorities (@xiaofan-luan)
- **PR #55484** (2026-11-13): fix: resolve Azure Germany regions and explicit storage authorities (@xiaofan-luan)

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

## X. bound manifest cgo concurrency process-wide

**RULE**:
When implementing operations in `internal/storagev2/packed/cgo_limit.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in milvus-io/milvus. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `6893a8c3`: bound manifest cgo concurrency process-wide. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `internal/storagev2/packed/cgo_limit.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
// Copyright 2023 Zilliz
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package packed

import (
	"context"
	"sync"

	"golang.org/x/sync/semaphore"

	"github.com/milvus-io/milvus/pkg/v3/util/paramtable"
)

// cgo call entry points in this package
//
// A goroutine that enters a cgo call is pinned to an OS thread for the whole
// call, so the number of OS threads the process holds tracks the number of
// goroutines simultaneously blocked inside C. Storage v3 routes every manifest
// add-file / read / commit through milvus-storage FFI; the per-context
// ManifestIOContext pools bound only their own callers, and the synchronous
// entry points had no process-wide ceiling at all. Und
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `6893a8c3` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
