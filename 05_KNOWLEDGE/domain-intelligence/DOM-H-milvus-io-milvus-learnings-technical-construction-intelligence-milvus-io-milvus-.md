# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: milvus-io-milvus-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "milvus-io-milvus-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-13T17:55:47.471Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-milvus-io-milvus-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [milvus-io-milvus-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-13T17:55:47.471Z`  
> **Learning ID**: `LEARN-EVO-milvus-io-milvus-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: G (Architecture Intelligence), D (Research & Knowledge Intelligence), K (Quality & Verification Intelligence), I (Content & Information Intelligence), L (Deployment & Operations Intelligence), M (Feedback & Evolution Intelligence), J (Search & Distribution Intelligence)
- **Confidence Rating**: 62%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from milvus-io-milvus-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/milvus-io-milvus-learnings.md`  
> **Source**: github ([https://github.com/milvus-io/milvus](https://github.com/milvus-io/milvus))  
> **Source Version**: `03d63d65`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-13T17:55:11.766Z  
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
> **Harvest Timestamp**: 2026-11-13T17:55:11.761Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `milvus-io/milvus`
- **Description**: Milvus is a high-performance, cloud-native vector database built for scalable vector ANN search
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 46654 stars

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
- **Issue #55508** (2026-11-13): **fix: [2.6] restore AND early exit at null-rejecting filters**
  *Symptoms*: issue: #51181 pr: #51182  AND conjunctions keep UNKNOWN rows active even when the filter consumer excludes them together with FALSE. Backport #51182 to restore early exit for these rows at FilterBitsNode and IterativeFilterNode, while keeping strict three-valued semantics below NOT. Native iterative filtering now explicitly folds validity before selecting rows.  Preserves the inherited candidate-mask handling from #55058. The master batch-LIKE reserved-slot fix does not apply to 2.6. Includes the five applicable upstream regression tests and retains existing conjunction and mask coverage.  Validation: clang-format 15 and git diff --check pass. Compilation and runtime validation are pending CI; local-source remote test attempts were blocked before compilation by test dependency image startup failures. 

- **Issue #55493** (2026-11-13): **enhance: reduce broadcast task logger memory**
  *Symptoms*: issue: #40451  - Broadcaster: reuse the component logger across broadcast tasks to avoid retaining a logger and encoded message per task. - Task logging: attach the task message at persistence, broadcast execution, and legacy ACK log sites to preserve message correlation.
  **Post-Mortem & Fix Analysis**:
  > [ci-v2-notice] Notice: New ci-v2 system is enabled for this PR.  To rerun ci-v2 checks, comment with: - /ci-rerun-code-check  // for ci-v2/code-check - /ci-rerun-code-check-macos  // for Code Checker MacOS (GitHub Actions) - /ci-rerun-build  // for ci-v2/build - /ci-rerun-build-all  // for ci-v2/build-all (multi-arch builds) - /ci-rerun-buildenv  // for ci-v2/build-env (build milvus-env builder images; update .env after the new tag is ready) - /ci-rerun-ut-integration  // for ci-v2/ut-integration, will rerun ci-v2/build - /ci-rerun-ut-go  // for ci-v2/ut-go, will rerun ci-v2/build - /ci-rerun-ut-cpp  // for ci-v2/ut-cpp - /ci-rerun-ut  // for all ci-v2/ut-integration, ci-v2/ut-go, ci-v2/ut-cpp, will rerun ci-v2/build - /ci-rerun-e2e-default  // for ci-v2/e2e-default - /ci-rerun-e2e-pulsar-wp  // for ci-v2/e2e-pulsar-wp (GCP branch-equivalent Pulsar + Woodpecker Python E2E) - /ci-rerun-e2e-amd  // for ci-v2/e2e-amd (e2e pool dispatcher) - /ci-rerun-e2e-dist-wp  // for ci-v2/e2e-dist-wp 
  > <!-- team2-arev:debate-D7b128574ec --> > **Must-fix issues introduced by this PR: 0** > **Merge recommendation:** Mergeable as-is — this review found no must-fix issue introduced by this PR.  Adversarial review found no issues requiring changes.  **Verified:** - `internal/streamingcoord/server/broadcaster/broadcast_task.go:132`: `SetLogger` now stores the shared component logger. Tasks no longer keep the cloned encoder buffer and message reference that `logger.With(mlog.FieldMessage(b.msg))` created for each task. - `internal/streamingcoord/server/broadcaster/broadcast_task.go:664`: `saveTaskIfDirty` reads `b.msg` directly, and all three callers hold `b.mu` at that point. The callers are `InitializeRecovery`, `ack` (through `Ack`/`FastAck`) and `MarkAckCallbackDone`. There is no unlocked read and no recursive locking. - `internal/streamingcoord/server/broadcaster/pending_broadcast_task.go:54`: the five `Execute` log sites call `BroadcastMessage()` without already holding the non-reentr

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

### Incident Patch 1: `5ce39ad7` (2026-11-13)
**Commit Message**: fix: resolve Azure Germany regions and explicit storage authorities (#55484)

issue: #55483

External collections on Azure cannot be read when the storage account is
in `germanywestcentral` or `germanynorth`. Spec producers write
`azure://core.windows.net/<container>/<blob>` with the account's region.
`DeriveEndpoint` maps every `germany*` region to `core.cloudapi.de`
(Microsoft Cloud Germany, closed in October 2021), so native injection
set the address to `core.cloudapi.de` and the container to
`core.windows.net`.

- Drop the `germany*` rule in the Go and C++ `DeriveEndpoint`; those
regions are public Azure on `core.windows.net`.
- In native injection, a bare Azure Storage authority in the source host
wins over the region-derived authority, as endpoint hosts of the other
clouds already do. An Azure container name cannot contain a dot, so such
a host is never a container. This also covers other region/authority
mismatches, for example `chinaeast2` with `core.windows.net`.

### Validation
- `pkg/util/externalspec` tests, `go vet` and golangci-lint pass.
- C++ `InjectExtfsAllowlist.*` and the related external-table suites (92
tests) pass on a local build with this patch applied; the 

**File**: `internal/core/src/storage/loon_ffi/util.cpp` (modified, +25/-4)
```diff
@@ -544,9 +544,8 @@ DeriveEndpoint(const std::string& cloud_provider, const std::string& region) {
         if (r.rfind("usgov", 0) == 0 || r.rfind("usdod", 0) == 0) {
             return "core.usgovcloudapi.net";
         }
-        if (r.rfind("germany", 0) == 0) {
-            return "core.cloudapi.de";
-        }
+        // Microsoft Cloud Germany (core.cloudapi.de) closed in October 2021;
+        // germanywestcentral and germanynorth are public Azure regions.
         return "core.windows.net";
     }
     return "";
@@ -565,6 +564,19 @@ StripURIScheme(const std::string& addr) {
 // family, the URI is Milvus-form regardless of whether DeriveEndpoint(cp,
 // region) equals the host string. Keep list in sync with Go
 // externalspec.IsCloudEndpointHost.
+// IsAzureStorageAuthority returns true for the bare Azure Storage
+// authorities that azure://<authority>/<container>/<blob> names. An Azure
+// container name cannot contain a dot, so such a host is never a container.
+static bool
+IsAzureStorageAuthority(const std::string& host) {
+    std::string h = host;
+    std::transform(h.begin(), h.end(), h.begin(), [](unsigned char c) {
+        return std::tolower(c);
+    });
+    return h == "core.windows.net" || h == "core.chinacloudapi.cn" ||
+           h == "core.usgovcloudapi.net" || h == "core.cloudapi.de";
+}
+
 static bool
 IsCloudEndpointHost(const std::string& host) {
     std::string h = host;
@@ -949,7 +961,16 @@ InjectExternalSpecProperties(
         // regardless of whether DeriveEndpoint string-matches. This prevents
         // misclassifying `s3://s3.amazonaws.com/bucket/key` as AWS-form when
         // spec.region is a regional value.
-        bool uri_host_is_cloud_endpoint = IsCloudEndpointHost(host);
+        // A bare Azure Storage authority is the endpoint the source names, so
+        // it also wins over the region-derived authority.
+        std::string spec_cp = spec_cloud_provider;
+        std::transform(spec_cp.begin(),
+                       spec_cp.end(),
+                       spec_cp.begin(),
+                       [](unsigned char c) { return std::tolower(c); });
+        bool uri_host_is_cloud_endpoint =
+            IsCloudEndpointHost(host) ||
+            (spec_cp == "azure" && IsAzureStorageAuthority(host));
         if (!uri_host_is_cloud_endpoint && !derived.empty() &&
             StripURIScheme(derived) != host) {
             milvus_storage::api::SetValue(
```

**File**: `internal/core/unittest/test_external_take.cpp` (modified, +75/-1)
```diff
@@ -3982,7 +3982,9 @@ TEST(InjectExtfsAllowlist, AzureSovereignCloudEndpoints) {
         {"chinaeast", "core.chinacloudapi.cn"},
         {"usgovvirginia", "core.usgovcloudapi.net"},
         {"usdodcentral", "core.usgovcloudapi.net"},
-        {"germanynortheast", "core.cloudapi.de"},
+        // Microsoft Cloud Germany closed; these are public Azure regions.
+        {"germanywestcentral", "core.windows.net"},
+        {"germanynorth", "core.windows.net"},
         {"eastus", "core.windows.net"},
     };
     for (const auto& c : cases) {
@@ -4001,6 +4003,78 @@ TEST(InjectExtfsAllowlist, AzureSovereignCloudEndpoints) {
     }
 }
 
+// Spec producers write azure://core.windows.net/<container>/<blob> together
+// with the storage account's region. The authority in the source wins over the
+// region-derived one, so a region never turns the authority into a container.
+TEST(InjectExtfsAllowlist, AzureAuthorityHostWinsOverRegion) {
+    // The native policy is process-wide and immutable: reuse the allowlist
+    // that the other Broker tests in this binary install.
+    const std::string endpoint =
+        "https://broker.example.com/v1/credentials/assume-role";
+    ASSERT_TRUE(
+        InitCredentialBrokerPolicy(
+            std::string(
+                R"(["https://broker.example.com/v1/credentials/assume-role","https://broker.example.com/v1/credentials/assume-role?api-version=1&scope=a%2Fb+x"])"))
+            .ok());
+    struct Case {
+        std::string source;
+        std::string region;
+        std::string address;
+    };
+    const std::vector<Case> cases = {
+        {"azure://core.windows.net/ctr/dir/file.parquet",
+         "westeurope",
+         "core.windows.net"},
+        {"azure://core.windows.net/ctr/dir/file.parquet",
+         "germanywestcentral",
+         "core.windows.net"},
+        {"azure://core.windows.net/ctr/dir/file.parquet",
+         "germanynorth",
+         "core.windows.net"},
+        {"azure://core.windows.net/ctr/dir/file.parquet",
+         "chinaeast2",
+         "core.windows.net"},
+        {"azure://core.windows.net/ctr/dir/file.parquet",
+         "usgovvirginia",
+         "core.windows.net"},
+        {"azure://core.chinacloudapi.cn/ctr/dir/file.parquet",
+         "eastus",
+         "core.chinacloudapi.cn"},
+        {"azure://CORE.WINDOWS.NET/ctr/dir/file.parquet",
+         "eastus",
+         "CORE.WINDOWS.NET"},
+    };
+    for (const auto& c : cases) {
+        SCOPED_TRACE(c.source + " region=" + c.region);
+        // The target-mode spec the Zilliz Cloud control plane builds.
+        nlohmann::json spec = {{"format", "parquet"},
+                               {"extfs",
+                                {{"cloud_provider", "azure"},
+                                 {"region", c.region},
+                                 {"access_key_id", "account"},
+                                 {"azure_client_id", "client"},
+                                 {"azure_tenant_id", "tenant"},
+                                 {"azure_credential_endpoint", endpoint},
+                                 {"load_frequency", "3600"}}}};
+        milvus_storage::api::Properties props;
+        ::InjectExternalSpecProperties(props, 42, c.source, spec.dump());
+        EXPECT_EQ(std::get<std::string>(props.at("extfs.42.address")),
+                  c.address);
+        EXPECT_EQ(std::get<std::string>(props.at("extfs.42.bucket_name")),
+                  "ctr");
+    }
+    // A container host still takes its authority from the region.
+    milvus_storage::api::Properties props;
+    ::InjectExternalSpecProperties(
+        props,
+        42,
+        "azure://ctr/dir/file.parquet",
+        R"({"format":"parquet","extfs":{"cloud_provider":"azure","region":"germanywestcentral","access_key_id":"account","access_key_value":"KEY"}})");
+    EXPECT_EQ(std::get<std::string>(props.at("extfs.42.address")),
+              "core.windows.net");
+    EXPECT_EQ(std::get<std::string>(props.at("extfs.42.bucket_name")), "ctr");
+}
+
 TEST(InjectExtfsAllowlist, AzuriteMilvusFormURIUsesHostAsEndpoint) {
     // Azurite / Azure Stack Hub: custom endpoint expressed via Milvus-form URI
     // (path has ≥2 segments). URI.host is authoritative; cp+region are
```

**File**: `pkg/util/externalspec/external_spec.go` (modified, +2/-3)
```diff
@@ -630,9 +630,8 @@ func DeriveEndpoint(cloudProvider, region string) string {
 		if strings.HasPrefix(r, "usgov") || strings.HasPrefix(r, "usdod") {
 			return "core.usgovcloudapi.net"
 		}
-		if strings.HasPrefix(r, "germany") {
-			return "core.cloudapi.de"
-		}
+		// Microsoft Cloud Germany (core.cloudapi.de) closed in October 2021;
+		// germanywestcentral and germanynorth are public Azure regions.
 		return "core.windows.net"
 	}
 	return ""
```

**File**: `pkg/util/externalspec/external_spec_test.go` (modified, +2/-1)
```diff
@@ -797,7 +797,8 @@ func TestDeriveEndpoint(t *testing.T) {
 		{"azure_china", CloudProviderAzure, "china", "core.chinacloudapi.cn"},
 		{"azure_usgov", CloudProviderAzure, "usgov", "core.usgovcloudapi.net"},
 		{"azure_usdod", CloudProviderAzure, "usdod", "core.usgovcloudapi.net"},
-		{"azure_germany", CloudProviderAzure, "germany", "core.cloudapi.de"},
+		{"azure_germany_west_central", CloudProviderAzure, "germanywestcentral", "core.windows.net"},
+		{"azure_germany_north", CloudProviderAzure, "germanynorth", "core.windows.net"},
 		{"azure_public", CloudProviderAzure, "public", "core.windows.net"},
 		{"case_insensitive_provider", "AWS", "us-east-1", "https://s3.us-east-1.amazonaws.com"},
 		{"unknown_provider", "minio", "us-east-1", ""},
```

---

### Incident Patch 2: `b66a69d2` (2026-11-13)
**Commit Message**: enhance: raise default bounded staleness (common.gracefulTime) to 60s (#55480)

## What

Raise the default of `common.gracefulTime` (the staleness bound of
Bounded consistency) from 5000ms to 60000ms, in
`pkg/util/paramtable/component_param.go` and `configs/milvus.yaml`. The
value stays configurable and refreshable; the proxy reads it per
request.

Strong, Session, Customized and Eventually reads are not affected: only
the Bounded branch of `parseGuaranteeTs` /
`parseGuaranteeTsFromConsistency` uses it.

## Why

For a Bounded read the proxy sets the guarantee timestamp to `now -
gracefulTime`, and the delegator waits in `waitTSafe` until the
channel's tSafe reaches it. tSafe is driven by the time ticks of the
channel's WAL. When the WAL stops advancing (StreamingNode power loss,
object storage stall), the delegators of **all** replicas of that
channel stop at the same tSafe. With 5s, every Bounded read on the
channel starts failing about 5s into the outage, so a second replica
does not help.

With 60s the guarantee timestamp stays below the stalled tSafe for the
first minute of a WAL outage, and the delegators on healthy nodes keep
answering Bounded reads.

Outside of an outage res

**File**: `configs/milvus.yaml` (modified, +1/-1)
```diff
@@ -1316,7 +1316,7 @@ common:
     SearchCacheBudgetGBRatio: 0.1
     LoadNumThreadRatio: 8
     BeamWidthRatio: 4
-  gracefulTime: 5000 # milliseconds. it represents the interval (in ms) by which the request arrival time needs to be subtracted in the case of Bounded Consistency.
+  gracefulTime: 60000 # milliseconds. it represents the interval (in ms) by which the request arrival time needs to be subtracted in the case of Bounded Consistency.
   gracefulStopTimeout: 1800 # seconds. it will force quit the server if the graceful stop process is not completed during this time.
   parquetStatsSkipIndex:
     enabled: true # whether to force one row group per cache cell and build the sealed-segment chunk skip index from parquet footer statistics. When enabled, packing is 1:1 even without usable statistics; disabling allows target-size packing. Takes effect only at startup (not refreshable): the flag decides the segment cache cell layout, which must not change while queries are running. Storage v2 segments only; manifest-based (v3) segments do not build this index yet.
```

**File**: `pkg/util/paramtable/component_param.go` (modified, +4/-4)
```diff
@@ -61,10 +61,10 @@ const (
 	// DefaultStorageV2AsyncLoadReadWindowSizeBytes is the historical-key
 	// default for the Storage V3 async read-window threshold.
 	DefaultStorageV2AsyncLoadReadWindowSizeBytes = 16 * 1024 * 1024
-	DefaultGracefulTime                          = 5000 // ms
-	DefaultGracefulStopTimeout                   = 1800 // s, for node
-	DefaultProxyGracefulStopTimeout              = 30   // s，for proxy
-	DefaultCoordGracefulStopTimeout              = 5    // s，for coord
+	DefaultGracefulTime                          = 60000 // ms
+	DefaultGracefulStopTimeout                   = 1800  // s, for node
+	DefaultProxyGracefulStopTimeout              = 30    // s，for proxy
+	DefaultCoordGracefulStopTimeout              = 5     // s，for coord
 	DefaultHighPriorityThreadCoreCoefficient     = 10
 	DefaultMiddlePriorityThreadCoreCoefficient   = 5
 	DefaultLowPriorityThreadCoreCoefficient      = 1
```

---

### Incident Patch 3: `09c12608` (2026-11-13)
**Commit Message**: fix: forward the resolved consistency level from Query to QueryView (#55474)

issue: #55473

### What

`QueryTask.PreExecute` now forwards the resolved consistency level, not
the raw request level, in `RetrieveRequest.ConsistencyLevel`. This
matches what `SearchTask.PreExecute` already does (`t.ConsistencyLevel =
consistencyLevel`).

### Why

The proxy computes the guarantee timestamp from the resolved level (the
collection level when `use_default_consistency` is true), but QueryView
plans the read by the forwarded level (`executeGetQueryPlan` in
`internal/views/queryclient/shard_client.go` → `resolveQueryPlanMVCC` in
`internal/streamingnode/server/wal/adaptor/query_plan.go`). Strong and
Session also wait for pending WAL writes (`QueryMVCCManager.Minimum`);
Bounded and Eventually do not.

SDKs that defer to the collection default put a placeholder level in the
request:

- pymilvus sends `consistency_level=0` (Strong) with
`use_default_consistency=true`. Its default query on a Bounded or
Eventually collection was planned as Strong.
- The Go SDK and RESTful v2 send `Bounded` with
`use_default_consistency=true` and no guarantee timestamp. Their default
query on a Strong or Session col

**File**: `internal/proxy/dql/task_query.go` (modified, +3/-1)
```diff
@@ -1009,7 +1009,6 @@ func (t *QueryTask) PreExecute(ctx context.Context) error {
 	guaranteeTs := t.request.GetGuaranteeTimestamp()
 	var consistencyLevel commonpb.ConsistencyLevel
 	useDefaultConsistency := t.request.GetUseDefaultConsistency()
-	t.ConsistencyLevel = t.request.GetConsistencyLevel()
 	if useDefaultConsistency {
 		consistencyLevel = collectionInfo.ConsistencyLevel
 		guaranteeTs = ParseGuaranteeTsFromConsistency(guaranteeTs, t.BeginTs(), consistencyLevel)
@@ -1023,6 +1022,9 @@ func (t *QueryTask) PreExecute(ctx context.Context) error {
 			guaranteeTs = ParseGuaranteeTsFromConsistency(guaranteeTs, t.BeginTs(), consistencyLevel)
 		}
 	}
+	// Forward the resolved level: QueryView and the delegator plan the read by
+	// it, so it must match the level the guarantee timestamp was computed from.
+	t.ConsistencyLevel = consistencyLevel
 
 	// update actual consistency level
 	accesslog.SetActualConsistencyLevel(ctx, consistencyLevel)
```

**File**: `internal/proxy/dql/task_query_test.go` (modified, +132/-0)
```diff
@@ -38,6 +38,7 @@ import (
 	"github.com/milvus-io/milvus/internal/proxy/shardclient"
 	"github.com/milvus-io/milvus/internal/types"
 	"github.com/milvus-io/milvus/internal/util/reduce"
+	"github.com/milvus-io/milvus/internal/views/queryclient"
 	"github.com/milvus-io/milvus/pkg/v3/common"
 	"github.com/milvus-io/milvus/pkg/v3/mlog"
 	"github.com/milvus-io/milvus/pkg/v3/proto/internalpb"
@@ -341,6 +342,137 @@ func TestQueryTaskPreExecuteUsesStrongVisibility(t *testing.T) {
 	}
 }
 
+// The level forwarded to QueryView decides how the read is planned (Strong
+// and Session wait for pending WAL writes; Bounded and Eventually do not), so
+// it must be the level the guarantee timestamp was computed from, not the raw
+// request field. SDKs that defer to the collection default send a placeholder
+// level with use_default_consistency=true: pymilvus sends 0 (Strong), the Go
+// SDK sends Bounded.
+func TestQueryTaskPreExecuteForwardsResolvedConsistencyLevel(t *testing.T) {
+	const collectionID = int64(100)
+	schedulerTime := time.Unix(1_700_000_000, 0)
+	schedulerTS := tsoutil.ComposeTSByTime(schedulerTime)
+	graceful := paramtable.Get().CommonCfg.GracefulTime.GetAsDuration(time.Millisecond)
+	boundedTS := tsoutil.ComposeTSByTime(schedulerTime.Add(-graceful))
+
+	schema := mustNewSchemaInfo(&schemapb.CollectionSchema{
+		Name: "test_collection",
+		Fields: []*schemapb.FieldSchema{{
+			FieldID:      100,
+			Name:         "id",
+			IsPrimaryKey: true,
+			DataType:     schemapb.DataType_Int64,
+		}},
+	})
+	info := &collectionInfo{CollID: collectionID, Schema: schema}
+	for _, m := range []*mockey.Mocker{
+		mockTest(t, (*metacache.MetaCache).GetCollectionID, collectionID, nil),
+		mockTest(t, (*metacache.MetaCache).GetCollectionInfo, info, nil),
+		mockTest(t, (*metacache.MetaCache).GetCollectionSchema, schema, nil),
+		mockey.Mock((*metacache.MetaCache).GetPartitions).Return(map[string]UniqueID{
+			paramtable.Get().CommonCfg.DefaultPartitionName.GetValue(): 200,
+		}, nil).Build(),
+	} {
+		defer m.UnPatch()
+	}
+
+	for _, tc := range []struct {
+		name             string
+		collectionLevel  commonpb.ConsistencyLevel
+		requestLevel     commonpb.ConsistencyLevel
+		useDefault       bool
+		requestGuarantee uint64
+		wantLevel        commonpb.ConsistencyLevel
+		wantGuarantee    uint64
+	}{
+		{
+			name:            "pymilvus default on bounded collection",
+			collectionLevel: commonpb.ConsistencyLevel_Bounded,
+			requestLevel:    commonpb.ConsistencyLevel_Strong,
+			useDefault:      true,
+			wantLevel:       commonpb.ConsistencyLevel_Bounded,
+			wantGuarantee:   boundedTS,
+		},
+		{
+			name:            "pymilvus default on eventually collection",
+			collectionLevel: commonpb.ConsistencyLevel_Eventually,
+			requestLevel:    commonpb.ConsistencyLevel_Strong,
+			useDefault:      true,
+			wantLevel:       commonpb.ConsistencyLevel_Eventually,
+			wantGuarantee:   1,
+		},
+		{
+			name:            "go sdk default on strong collection",
+			collectionLevel: commonpb.ConsistencyLevel_Strong,
+			requestLevel:    commonpb.ConsistencyLevel_Bounded,
+			useDefault:      true,
+			wantLevel:       commonpb.ConsistencyLevel_Strong,
+			wantGuarantee:   schedulerTS,
+		},
+		{
+			// No session timestamp is sent, so the guarantee is 0; QueryView
+			// must still plan it as Session (Strong) to keep read-your-writes.
+			name:            "go sdk default on session collection",
+			collectionLevel: commonpb.ConsistencyLevel_Session,
+			requestLevel:    commonpb.ConsistencyLevel_Bounded,
+			useDefault:      true,
+			wantLevel:       commonpb.ConsistencyLevel_Session,
+			wantGuarantee:   0,
+		},
+		{
+			name:            "explicit level overrides collection",
+			collectionLevel: commonpb.ConsistencyLevel_Bounded,
+			requestLevel:    commonpb.ConsistencyLevel_Eventually,
+			wantLevel:       commonpb.ConsistencyLevel_Eventually,
+			wantGuarantee:   1,
+		},
+		{
+			// Compatibility: the legacy marker (level 0 with a placeholder
+			// guarantee timestamp) only selects the guarantee; the level
+			// stays 0, so QueryView keeps planning it as Strong.
+			name:             "legacy bounded marker stays strong",
+			collectionLevel:  commonpb.ConsistencyLevel_Bounded,
+			requestLevel:     commonpb.ConsistencyLevel_Strong,
+			requestGuarantee: 2,
+			wantLevel:        commonpb.ConsistencyLevel_Strong,
+			wantGuarantee:    boundedTS,
+		},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			info.ConsistencyLevel = tc.collectionLevel
+			ctx := context.Background()
+			legacy := &fakeLegacyQueryClient{queryResult: &queryclient.LegacyQueryResult{}}
+			task := &QueryTask{
+				baseTask:        baseTask{MetaCache: newTestCache()},
+				Condition:       NewTaskCondition(ctx),
+				RetrieveRequest: &internalpb.RetrieveRequest{Base: &commonpb.MsgBase{}},
+				ctx:             ctx,
+				request: &milvuspb.QueryRequest{
+					Base:                  &commonpb.MsgBase{},
+					DbName:                "default",
+					Coll
```

**File**: `internal/proxy/dql/task_query_view_legacy_test.go` (modified, +2/-0)
```diff
@@ -49,6 +49,7 @@ type fakeLegacyQueryClient struct {
 	queryCalled  int
 	searchResult *queryclient.LegacySearchResult
 	queryResult  *queryclient.LegacyQueryResult
+	lastQuery    *queryclient.LegacyQueryRequest
 	err          error
 }
 
@@ -59,6 +60,7 @@ func (c *fakeLegacyQueryClient) Search(ctx context.Context, req *queryclient.Leg
 
 func (c *fakeLegacyQueryClient) Query(ctx context.Context, req *queryclient.LegacyQueryRequest) (*queryclient.LegacyQueryResult, error) {
 	c.queryCalled++
+	c.lastQuery = req
 	return c.queryResult, c.err
 }
 
```

#### Recent Merged Pull Requests:
- **PR #55508** (2026-11-13): fix: [2.6] restore AND early exit at null-rejecting filters (@zhengbuqian)
- **PR #55493** (2026-11-13): enhance: reduce broadcast task logger memory (@chyezh)
- **PR #55485** (2026-11-13): fix: [cp3.0] resolve Azure Germany regions and explicit storage authorities (@xiaofan-luan)
- **PR #55484** (2026-11-13): fix: resolve Azure Germany regions and explicit storage authorities (@xiaofan-luan)
- **PR #55482** (2026-11-13): enhance: [2.6] raise default bounded staleness (common.gracefulTime) to 60s (@xiaofan-luan)
- **PR #55481** (2026-11-13): enhance: [3.0] raise default bounded staleness (common.gracefulTime) to 60s (@xiaofan-luan)

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

## X. resolve Azure Germany regions and explicit storage authorities (#55484)

**RULE**:
When implementing operations in `internal/core/src/storage/loon_ffi/util.cpp`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in milvus-io/milvus. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `5ce39ad7`: resolve Azure Germany regions and explicit storage authorities (#55484). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `internal/core/src/storage/loon_ffi/util.cpp`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
        // Microsoft Cloud Germany (core.cloudapi.de) closed in October 2021;
        // germanywestcentral and germanynorth are public Azure regions.
// IsAzureStorageAuthority returns true for the bare Azure Storage
// authorities that azure://<authority>/<container>/<blob> names. An Azure
// container name cannot contain a dot, so such a host is never a container.
static bool
IsAzureStorageAuthority(const std::string& host) {
    std::string h = host;
    std::transform(h.begin(), h.end(), h.begin(), [](unsigned char c) {
        return std::tolower(c);
    });
    return h == "core.windows.net" || h == "core.chinacloudapi.cn" ||
           h == "core.usgovcloudapi.net" || h == "core.cloudapi.de";
}

        // A bare Azure Storage authority is the endpoint the source names, so
        // it also wins over the region-derived authority.
        std::string spec_cp = spec_cloud_provider;
        std::transform(spec_cp.begin(),
                       spec_cp.end(),
                       spec_cp.begin(),
                       [](unsigned char c) { return std::tolower(c); });
        bool uri_host_is_cloud_endpoint =
            IsCloudEndpointHost(host) ||
            (spec_cp == 
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
        if (r.rfind("germany", 0) == 0) {
            return "core.cloudapi.de";
        }
        bool uri_host_is_cloud_endpoint = IsCloudEndpointHost(host);
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `5ce39ad7` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
