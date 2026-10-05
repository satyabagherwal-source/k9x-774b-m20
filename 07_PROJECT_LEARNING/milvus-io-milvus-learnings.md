# Forensic Learning Record (Deep Inspection): milvus-io/milvus

> **Canonical Artifact**: `07_PROJECT_LEARNING/milvus-io-milvus-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/milvus-io/milvus](https://github.com/milvus-io/milvus))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:16:36.811Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `milvus-io/milvus`
- **Description**: Milvus is a high-performance, cloud-native vector database built for scalable vector ANN search
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 46319 stars

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
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"
	"path"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/cockroachdb/errors"
	"github.com/gofrs/flock"
	"github.com/samber/lo"
	clientv3 "go.etcd.io/etcd/client/v3"

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
		sessionutil.EnableEmbededQueryNodeLabel()
		role.EnableStreamingNode = true
		role.EnableQueryNode = true
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
		if enableStreamingNode && !enableQueryNode {
			role.EnableQueryNode = true
			sessionutil.EnableEmbededQueryNodeLabel()
		}

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

	keys := getSessionPaths(ctx, etcdCli, metaPath, sessionSuffix)
	if len(keys) == 0 {
		return nil
	}

	for _, key := range keys {
		_, _ = etcdCli.Delete(ctx, key)
	}
	mlog.Info(ctx, "clean sessions from etcd", mlog.Any("keys", keys))
	return nil
}

func getSessionPaths(ctx context.Context, client *clientv3.Client, metaPath string, sessionSuffix []string) []string {
	sessionKeys := make([]string, 0)
	sessionPathPrefix := path.Join(metaPath, sessionutil.DefaultServiceRoot)
	newSessionSuffixSet := addActiveKeySuffix(ctx, client, sessionPathPrefix, sessionSuffix)
	for _, suffix := range newSessionSuffixSet {
		key := path.Join(sessionPathPrefix, suffix)
		sessionKeys = append(sessionKeys, key)
	}
	return sessionKeys
}

// filterUnmatchedKey skip active keys that don't match completed key, the latest active key may from standby server
func addActiveKeySuffix(ctx context.Context, client *clientv3.Client, sessionPathPrefix string, sessionSuffix []string) []string {
	suffixSet := lo.SliceToMap(sessionSuffix, func(t string) (string, struct{}) {
		return t, struct{}{}
	})

	for _, suffix := range sessionSuffix {
		if strings.Contains(suffix, "-") && (strings.HasPrefix(suffix, typeutil.MixCoordRole) ||
			strings.HasPrefix(suffix, typeutil.QueryCoordRole) || strings.HasPrefix(suffix, typeutil.DataCoordRole)) {
			res := strings.Split(suffix, "-")
			if len(res) != 2 {
				// skip illegal keys
				mlog.Warn(ctx, "skip illegal key", mlog.String("suffix", suffix))
				continue
			}

			serverType := res[0]
			targetServerID, err := strconv.ParseInt(res[1], 10, 64)
			if err != nil {
				mlog.Warn(ctx, "get server id failed from key", mlog.String("suffix", suffix), mlog.Err(err))
				continue
			}

			key := path.Join(sessionPathPrefix, serverType)
			serverID, err := getServerID(ctx, client, key)
			if err != nil {
				mlog.Warn(ctx, "get server id failed from key", mlog.String("suffix", suffix), mlog.Err(err))
				continue
			}

			if serverID == targetServerID {
				mlog.Info(ctx, "add active serverID key", mlog.String("suffix", suffix), mlog.String("key", key))
				suffixSet[serverType] = struct{}{}
			}
		}
	}

	return lo.MapToSlice(suffixSet, func(key string, v struct{}) string { return key })
}

func getServerID(ctx context.Context, client *clientv3.Client, key string) (int64, error) {
	resp, err := client.Get(ctx, key)
	if err != nil {
		return 0, err
	}

	if len(resp.Kvs) == 0 {
		return 0, errors.New("not found value")
	}

	value := resp.Kvs[0].Value
	session := &sessionutil.SessionRaw{}
	err = json.Unmarshal(value, &session)
	if err != nil {
		return 0, err
	}

	return session.ServerID, nil
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

### Core Architecture Module: `internal/core/benchmark/FastMemBenchmark.cpp`
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

#include "common/FastMem.h"

#include <algorithm>
#include <array>
#include <cstddef>
#include <cstdint>
#include <cstring>
#include <vector>

#include <benchmark/benchmark.h>

namespace milvus::fastmem {
namespace {

constexpr size_t kBufferSize = 4096;

std::vector<uint8_t>
MakeBenchmarkSource() {
    std::vector<uint8_t> source(kBufferSize);
    for (size_t i = 0; i < source.size(); ++i) {
        source[i] = static_cast<uint8_t>((i * 131 + 17) & 0xFF);
    }
    return source;
}

void
StdMemcpyBenchmark(benchmark::State& state) {
    auto source = MakeBenchmarkSource();
    std::vector<uint8_t> destination(kBufferSize);
    auto size = static_cast<size_t>(state.range(0));
    for (auto _ : state) {
        std::memcpy(destination.data(), source.data(), size);
        benchmark::DoNotOptimize(destination.data());
        benchmark::DoNotOptimize(source.data());
        benchmark::ClobberMemory();
    }
    state.SetBytesProcessed(state.iterations() * static_cast<int64_t>(size));
}

void
FastMemcpyBenchmark(benchmark::State& state) {
    auto source = MakeBenchmarkSource();
    std::vector<uint8_t> destination(kBufferSize);
    auto size = static_cast<size_t>(state.range(0));
    for (auto _ : state) {
        FastMemcpy(destination.data(), source.data(), size);
        benchmark::DoNotOptimize(destination.data());
        benchmark::DoNotOptimize(source.data());
        benchmark::ClobberMemory();
    }
    state.SetBytesProcessed(state.iterations() * static_cast<int64_t>(size));
}

void
ApplyFastMemArgs(benchmark::internal::Benchmark* benchmark) {
    for (auto size : std::array<int64_t, 9>{1, 2, 4, 8, 16, 32, 64, 128, 256}) {
        benchmark->Arg(size);
    }
}

}  // namespace
}  // namespace milvus::fastmem

BENCHMARK(milvus::fastmem::StdMemcpyBenchmark)
    ->Apply(milvus::fastmem::ApplyFastMemArgs);
BENCHMARK(milvus::fastmem::FastMemcpyBenchmark)
    ->Apply(milvus::fastmem::ApplyFastMemArgs);

BENCHMARK_MAIN();

```

### Core Architecture Module: `internal/core/conanfile.py`
```
required_conan_version = ">=2.0"

from conan import ConanFile
from conan.tools.cmake import CMakeDeps, CMakeToolchain
from conan.tools.files import copy
import os


class MilvusConan(ConanFile):
    settings = "os", "compiler", "build_type", "arch"
    requires = (
        "rocksdb/6.29.5@milvus/dev#67b8ae76ad7be5f779082f67416f89bf",
        "onetbb/2021.9.0#f9d7a3aa294ac4a594a93f9b4c7f272d",
        "zstd/1.5.5#70dc5eb8ea16708fc946fbac884c507e",
        "arrow/17.0.0@milvus/dev#17b7257ae0de563ed6ab7b7843cedf86",
        "libevent/2.1.12#95065aaefcd58d3956d6dfbfc5631d97",
        "googleapis/cci.20221108#4553d68a2429cc0fff7d2bab4e5b3ea9",
        "gtest/1.13.0#2cf98fac7337eb73fc4ee839dbcd4468",
        "benchmark/1.7.0#459f3bb1a64400a886ba43047576df3c",
        "yaml-cpp/0.7.0#355a88fb838abacfeb022dd52b91e248",
        "marisa/0.2.6#a1352b20c0c6c48fee4968584ffef631",
        "glog/0.7.1#a306e61d7b8311db8cb148ad62c48030",
        "gflags/2.2.2#7671803f1dc19354cc90bd32874dcfda",
        "double-conversion/3.3.0#640e35791a4bac95b0545e2f54b7aceb",
        "libsodium/1.0.19",
        "xsimd/9.0.1#51df19a2d512f70597105ee2a2d21916",
        "xz_utils/5.4.5#fc4e36861e0a47ecd4a40a00e6d29ac8",
        "prometheus-cpp/1.2.4#0918d66c13f97acb7809759f9de49b3f",
        "re2/20230301#f8efaf45f98d0193cd0b2ea08b6b4060",
        "folly/2026.04.20.00@milvus/dev#06852bea5b6449f0c4eb0df002b5779c",
        "milvus-common/1.0.0-45fca32@milvus/dev#ac7e38699c9dcc9a83d5be95e8227900",
        "google-cloud-cpp/2.28.0@milvus/dev#468918b43cec43624531a0340398cf43",
        "opentelemetry-cpp/1.23.0@milvus/dev#11bc565ec6e82910ae8f7471da756720",
        "librdkafka/2.6.1@milvus/dev#a15d9fefad917290d59fa3fcbc144888",
        "roaring/3.0.0#25a703f80eda0764a31ef939229e202d",
        "crc32c/1.1.2",
        "simde/0.8.2#5e1edfd5cba92f25d79bf6ef4616b972",
        "xxhash/0.8.3#caa6d0af1b951c247922e38fbcebdbe6",
        "unordered_dense/4.4.0#6a855c992618cc4c63019109a2e47298",
        "geos/3.12.0#a923af6dc4c18f87a7dfa960118f3166",
        "icu/74.2#cd1937b9561b8950a2ae6311284c5813",
        "libavrocpp/1.12.1.1@milvus/dev#b4854183542196740ec9a004fdfff7ec",
    )

    default_options = {
        "openssl/*:shared": True,
        "openssl/*:no_apps": True,
        "libevent/*:shared": True,
        "double-conversion/*:shared": True,
        "folly/*:shared": True,
        "librdkafka/*:shared": True,
        "librdkafka/*:zstd": True,
        "librdkafka/*:ssl": True,
        "librdkafka/*:sasl": True,
        "rocksdb/*:shared": True,
        "rocksdb/*:with_zstd": True,
        "arrow/*:filesystem_layer": True,
        "arrow/*:parquet": True,
        "arrow/*:compute": True,
        "arrow/*:with_re2": True,
        "arrow/*:with_zstd": True,
        "arrow/*:with_snappy": True,
        "arrow/*:with_lz4": True,
        "arrow/*:with_boost": True,
        "arrow/*:with_thrift": True,
        "arrow/*:with_jemalloc": False,
        "arrow/*:with_openssl": True,
        "arrow/*:shared": False,
        "arrow/*:with_azure": True,
        "arrow/*:with_s3": True,
        "arrow/*:encryption": True,
        "protobuf/*:shared": True,
        "grpc/*:shared": True,
        "grpc/*:secure": True,
        "aws-sdk-cpp/*:config": True,
        "aws-sdk-cpp/*:text-to-speech": False,
        "aws-sdk-cpp/*:transfer": False,
        "aws-sdk-cpp/*:s3-crt": True,
        "gtest/*:build_gmock": True,
        "boost/*:without_locale": False,
        "boost/*:without_test": True,
        "glog/*:with_gflags": True,
        "glog/*:shared": True,
        "prometheus-cpp/*:with_pull": False,
        "fmt/*:header_only": False,
        "openblas/*:dynamic_arch": True,
        "openblas/*:shared": False,
        "onetbb/*:tbbmalloc": False,
        "onetbb/*:tbbproxy": False,
        "gflags/*:shared": True,
        "gdal/*:shared": False,
        "gdal/*:fPIC": True,
        "icu/*:shared": False,
        "icu/*:data_packaging": "library",
        "xz_utils/*:shared": True,
        "openblas/*:use_openmp": True,
        "opentelemetry-cpp/*:with_stl": True,
    }

    def configure(self):
        if self.settings.arch not in ("x86_64", "x86"):
            try:
                del self.options["folly"].use_sse4_2
            except Exception:
                pass
        if self.settings.os == "Macos":
            # abseil static linking on macOS (previously shared for X86 compat)
            self.options["arrow"].with_jemalloc = False
            # Use OpenSSL for libcurl on macOS
            self.options["libcurl"].with_ssl = "openssl"
        self.options["arrow"].with_azure = True

    def requirements(self):
        # force=True: override transitive dependency versions (same behavior as Conan 1)
        # In Conan 1.x, the consumer's requires implicitly override transitive versions.
        # In Conan 2.x, force=True must be explicit.
        self.requires("boost/1.83.0#4e8a94ac1b88312af95eded83cd81ca8", force=True)
        self.requires("openssl/3.3.2#9f9f130d58e7c13e76bb8a559f0a6a8b", force=True)
        self.requires("protobuf/5.27.0@milvus/dev#42f031a96d21c230a6e05bcac4bdd633", force=True)
        self.requires("grpc/1.67.1@milvus/dev#efeaa484b59bffaa579004d5e82ec4fd", force=True)
        self.requires("zlib/1.3.1#8045430172a5f8d56ba001b14561b4ea", force=True)
        self.requires("libcurl/8.10.1#a3113369c86086b0e84231844e7ed0a9", force=True)
        self.requires("nlohmann_json/3.11.3#ffb9e9236619f1c883e36662f944345d", force=True)
        self.requires("abseil/20250127.0#481edcc75deb0efb16500f511f0f0a1c", force=True)
        self.requires("fmt/11.2.0#eb98daa559c7c59d591f4720dde4cd5c", force=True)
        # libbson only (BSON C library) for JSON stats — NOT the full mongo-c-driver.
        # Drops libmongoc/mongocxx/utf8proc; see src/common/bson_shim.h.
        self.requires("libbson/1.30.6@milvus/dev#4fc4c269cbda1b46c3118fa396cdc690")
        # azure-sdk-for-cpp is a transitive dep of Arrow, but must be declared
        # as a direct dep so CMakeDeps generates standalone cmake config files.
        # Without this, find_package(Azure) can't find include directories.
        self.requires("azure-sdk-for-cpp/1.16.4@milvus/dev#7c95e3df67cfea28b3cf6dbd60fbf137", force=True)
        self.requires("aws-sdk-cpp/1.11.842@milvus/dev#363556887f622db23a10168c108dd55d", force=True)
        # Force snappy/lz4 versions to override Arrow's older transitive deps
        # (arrow/*:with_snappy and arrow/*:with_lz4 are enabled for Parquet decoding)
        self.requires("snappy/1.2.1#b940695c64ccbff63c1aabd4b1eee3f3", force=True)
        self.requires("lz4/1.10.0#982d9b673900f665a1da109e09c17cab", force=True)
        # Pin rapidjson to the newest cci snapshot. Arrow 17 pulls an older
        # rapidjson transitively, which fails to compile under clang 19 (libc++ 19).
        # force=True overrides Arrow's transitive version.
        self.requires("rapidjson/cci.20230929#0a3982e5f4fa453a9b9cd0dd5b1dcb3a", force=True)
        if self.settings.os == "Linux":
            self.requires("openblas/0.3.30")
        if self.settings.os != "Macos":
            self.requires("libunwind/1.8.1#748a981ace010b80163a08867b732e71")
        # Override s2n 1.4.1 (from aws-c-io) to 1.6.0 for OpenSSL 3.x FIPS detection
        if self.settings.os in ["Linux", "FreeBSD"]:
            self.requires("s2n/1.6.0#4fa3b751b92e126a55e45dce723f0384", force=True)

    def generate(self):
        deps = CMakeDeps(self)
        # Set cmake file names to match what downstream projects expect
        deps.set_property("libavrocpp", "cmake_file_name", "libavrocpp")
        deps.set_property("libavrocpp", "cmake_target_name", "libavrocpp::libavrocpp")
        deps.generate()
        tc = CMakeToolchain(self)
        tc.generate()
        # Copy shared libraries (replaces imports() from Conan 1)
        # In Conan 1, imports() dst="lib" was relative to the build dir (cmake_build/).
        # In Conan 2, we use generators_folder (cmake_build/conan/) parent to get cmake_build/lib.
        build_dir = os.path.join(self.generators_folder, "..")
        for dep in self.dependencies.values():
            if dep.package_folder:
                copy(self, "*.so*", src=os.path.join(dep.package_folder, "lib"),
                     dst=os.path.join(build_dir, "lib"))
                copy(self, "*.dylib", src=os.path.join(dep.package_folder, "lib"),
                     dst=os.path.join(build_dir, "lib"))
                copy(self, "*.dll", src=os.path.join(dep.package_folder, "lib"),
                     dst=os.path.join(build_dir, "lib"))
                copy(self, "*", src=os.path.join(dep.package_folder, "bin"),
                     dst=os.path.join(build_dir, "bin"))
                copy(self, "*.proto", src=os.path.join(dep.package_folder, "include"),
                     dst=os.path.join(build_dir, "include"))

```

### Core Architecture Module: `internal/core/src/bitset/bitset.h`
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

#pragma once

#include <cassert>
#include <cstddef>
#include <cstdint>
#include <optional>
#include <type_traits>

#include "common.h"
#include "detail/maybe_vector.h"

namespace milvus {
namespace bitset {

namespace {

// A supporting facility for checking out of range.
// It is needed to add a capability to verify that we won't go out of
//   range even for the Release build.
template <bool RangeCheck>
struct RangeChecker {};

// disabled.
template <>
struct RangeChecker<false> {
    // Check if a < max
    template <typename SizeT>
    static inline void
    lt(const SizeT a, const SizeT max) {
    }

    // Check if a <= max
    template <typename SizeT>
    static inline void
    le(const SizeT a, const SizeT max) {
    }

    // Check if a == b
    template <typename SizeT>
    static inline void
    eq(const SizeT a, const SizeT b) {
    }
};

// enabled.
template <>
struct RangeChecker<true> {
    // Check if a < max
    template <typename SizeT>
    static inline void
    lt(const SizeT a, const SizeT max) {
        // todo: replace
        assert(a < max);
    }

    // Check if a <= max
    template <typename SizeT>
    static inline void
    le(const SizeT a, const SizeT max) {
        // todo: replace
        assert(a <= max);
    }

    // Check if a == b
    template <typename SizeT>
    static inline void
    eq(const SizeT a, const SizeT b) {
        // todo: replace
        assert(a == b);
    }
};

}  // namespace

// CRTP

// Bitset view, which does not own the data.
template <typename PolicyT, bool IsRangeCheckEnabled>
class BitsetView;

// Bitset, which owns the data.
template <typename PolicyT, typename ContainerT, bool IsRangeCheckEnabled>
class Bitset;

// This is the base CRTP class.
template <typename PolicyT, typename ImplT, bool IsRangeCheckEnabled>
class BitsetBase {
    template <typename, bool>
    friend class BitsetView;

    template <typename, typename, bool>
    friend class Bitset;

 public:
    using policy_type = PolicyT;
    using data_type = typename policy_type::data_type;
    using proxy_type = typename policy_type::proxy_type;
    using const_proxy_type = typename policy_type::const_proxy_type;

    using range_checker = RangeChecker<IsRangeCheckEnabled>;

    //
    inline data_type*
    data() {
        return as_derived().data_impl();
    }

    //
    inline const data_type*
    data() const {
        return as_derived().data_impl();
    }

    // Return the number of bits we're working with.
    inline size_t
    size() const {
        return as_derived().size_impl();
    }

    // Return the number of bytes which is needed to
    //   contain all our bits.
    inline size_t
    size_in_bytes() const {
        return policy_type::get_required_size_in_bytes(this->size());
    }

    // Return the number of elements which is needed to
    //   contain all our bits.
    inline size_t
    size_in_elements() const {
        return policy_type::get_required_size_in_elements(this->size());
    }

    //
    inline bool
    empty() const {
        return (this->size() == 0);
    }

    //
    inline proxy_type
    operator[](const size_t bit_idx) {
        range_checker::lt(bit_idx, this->size());

        const size_t idx_v = bit_idx + this->offset();
        return policy_type::get_proxy(this->data(), idx_v);
    }

    //
    inline bool
    operator[](const size_t bit_idx) const {
        range_checker::lt(bit_idx, this->size());

        const size_t idx_v = bit_idx + this->offset();
        const auto proxy = policy_type::get_proxy(this->data(), idx_v);
        return proxy.operator bool();
    }

    // Set all bits to true.
    inline void
    set() {
        policy_type::op_set(this->data(), this->offset(), this->size());
    }

    // Set a given bit to a given value.
    inline void
    set(const size_t bit_idx, const bool value = true) {
        this->operator[](bit_idx) = value;
    }

    // Set a given range of [a, b) bits to a given value.
    inline void
    set(const size_t bit_idx_start,
        const size_t size,
        const bool value = true) {
        range_checker::le(bit_idx_start + size, this->size());

        policy_type::op_fill(
            this->data(), this->offset() + bit_idx_start, size, value);
    }

    // Set all bits to false.
    inline void
    reset() {
        policy_type::op_reset(this->data(), this->offset(), this->size());
    }

    // Set a given bit to false.
    inline void
    reset(const size_t bit_idx) {
        this->operator[](bit_idx) = false;
    }

    // Set a given range of [a, b) bits to false.
    inline void
    reset(const size_t bit_idx_start, const size_t size) {
        this->set(bit_idx_start, size, false);
    }

    // Return whether all bits are set to true.
    inline bool
    all() const {
        return policy_type::op_all(this->data(), this->offset(), this->size());
    }

    // Return whether any of the bits is set to true.
    inline bool
    any() const {
        return (!this->none());
    }

    // Return whether all bits are set to false.
    inline bool
    none() const {
        return policy_type::op_none(this->data(), this->offset(), this->size());
    }

    // Inplace and.
    template <typename I, bool R>
    inline void
    inplace_and(const BitsetBase<PolicyT, I, R>& other, const size_t size) {
        range_checker::le(size, this->size());
        range_checker::le(size, other.size());

        policy_type::op_and(
            this->data(), other.data(), this->offset(), other.offset(), size);
    }

    template <bool R>
    inline void
    inplace_and(const BitsetView<PolicyT, R>* const others,
                const size_t n_others,
                const size_t size) {
        range_checker::le(size, this->size());
        for (size_t i = 0; i < n_others; i++) {
            range_checker::le(size, others[i].size());
        }

        // pick buffers
        detail::MaybeVector<const data_type*> tmp_data(n_others);
        detail::MaybeVector<size_t> tmp_offset(n_others);

        for (size_t i = 0; i < n_others; i++) {
            tmp_data[i] = others[i].data();
            tmp_offset[i] = others[i].offset();
        }

        policy_type::op_and_multiple(this->data(),
                                     tmp_data.data(),
                                     this->offset(),
                                     tmp_offset.data(),
                                     n_others,
                                     size);
    }

    template <bool R>
    inline void
    inplace_and(const BitsetView<PolicyT, R>* const others,
                const size_t n_others) {
        this->inplace_and(others, n_others, this->size());
    }

    template <typename ContainerT, bool R>
    inline void
    inplace_and(const Bitset<PolicyT, ContainerT, R>* const others,
                const size_t n_others,
                const size_t size) {
        range_checker::le(size, this->size());
        for (size_t i = 0; i < n_others; i++) {
            range_checker::le(size, others[i].size());
        }

        // pick buffers
        detail::MaybeVector<const data_type*> tmp_data(n_others);
        detail::MaybeVector<size_t> tmp_offset(n_others);

        for (size_t i = 0; i < n_others; i++) {
            tmp_data[i] = others[i].data();
            tmp_offset[i] = others[i].offset();
        }

        policy_type::op_and_multiple(this->data(),
                                     tmp_data.data(),
                                     this->offset(),
                                     tmp_offset.data(),
                                     n_others,
                                     size);
    }

    template <typename ContainerT, bool R>
    inline void
    inplace_and(const Bitset<PolicyT, ContainerT, R>* const others,
                const size_t n_others) {
        this->inplace_and(others, n_others, this->size());
    }

    // Inplace and. A given bitset / bitset view is expected to have the same size.
    template <typename I, bool R>
    inline ImplT&
    operator&=(const BitsetBase<PolicyT, I, R>& other) {
        range_checker::eq(other.size(), this->size());

        this->inplace_and(other, this->size());
        return as_derived();
    }

    // Inplace or.
    template <typename I, bool R>
    inline void
    inplace_or(const BitsetBase<PolicyT, I, R>& other, const size_t size) {
        range_checker::le(size, this->size());
        range_checker::le(size, other.size());

        policy_type::op_or(
            this->data(), other.data(), this->offset(), other.offset(), size);
    }

    template <bool R>
    inline void
    inplace_or(const BitsetView<PolicyT, R>* const others,
               const size_t n_others,
               const size_t size) {
        range_checker::le(size, this->size());
        for (size_t i = 0; i < n_others; i++) {
            range_checker::le(size, others[i].size());
        }

        // pick buffers
        detail::MaybeVector<const data_type*> tmp_data(n_others);
        detail::MaybeVector<size_t> tmp_offset(n_others);

        for (size_t i = 0; i < n_others; i++) {
            tmp_data[i] = others[i].data();
            tmp_offset[i] = others[i].offset();
     
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #53964** (2026-10-05): **test: wait for compactable segments in struct partial-update lifecycle**
  *Symptoms*: issue: #53962  The Struct Array partial-update lifecycle test can request manual compaction while its freshly flushed segments are still being sorted. DataCoord then returns the valid no-plan result `-1`, and the immediate positive-ID assertion fails before the compaction/reload checks run.  Wait for vector-index readiness, then retry only `-1` against a monotonic 120-second deadline, passing the remaining budget to each compact RPC. Require an accepted compaction to complete and check the baseline both immediately afterward and after release/load. RPC failures, unexpected IDs, timeouts, and data mismatches remain failures.  This follows the existing Struct nullable lifecycle test's approach from #52108. The observed failure is in [PR #53941's E2E run](https://jenkins-milvus-ci.milvus.io/job/MILVUS-CI-V2-PR-PIPELINES/job/milvus-e2e-pipeline-gcp/61102/console); this change does not modify server compaction behavior.  Validation: - Ruff lint and format checks, Python syntax compilation, and `git diff --check`. - Executed the changed statements extracted from the actual file with simulated time/RPC responses: retry then success, persistent no-plan timeout, invalid IDs, RPC failure, index/compaction wait failures, and both post-compaction and post-reload data mismatches. - Live E2E has not been run against this fix locally; CI validation is pending. The separately requested rerun of #53941 uses its original head and does not validate this patch. 
  **Post-Mortem & Fix Analysis**:
  > You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage). To continue using code reviews, add credits to your account and enable them for code reviews in your [settings](https://chatgpt.com/codex/cloud/settings/code-review).
  > [APPROVALNOTIFIER] This PR is **NOT APPROVED**  This pull-request has been approved by: To complete the [pull request process](https://git.k8s.io/community/contributors/guide/owners.md#the-code-review-process), please ask for approval from **xiaofan-luan** after the PR has been reviewed.  The full list of commands accepted by this bot can be found [here](https://go.k8s.io/bot-commands?repo=milvus-io%2Fmilvus).  <details open> Needs approval from an approver in each of these files:  - **[tests/OWNERS](https://github.com/milvus-io/milvus/blob/master/tests/OWNERS)**  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":["xiaofan-luan"]} -->
  > [ci-v2-notice] Notice: New ci-v2 system is enabled for this PR.  To rerun ci-v2 checks, comment with: - /ci-rerun-code-check  // for ci-v2/code-check - /ci-rerun-code-check-macos  // for Code Checker MacOS (GitHub Actions) - /ci-rerun-build  // for ci-v2/build - /ci-rerun-build-all  // for ci-v2/build-all (multi-arch builds) - /ci-rerun-buildenv  // for ci-v2/build-env (build milvus-env builder images; update .env after the new tag is ready) - /ci-rerun-ut-integration  // for ci-v2/ut-integration, will rerun ci-v2/build - /ci-rerun-ut-go  // for ci-v2/ut-go, will rerun ci-v2/build - /ci-rerun-ut-cpp  // for ci-v2/ut-cpp - /ci-rerun-ut  // for all ci-v2/ut-integration, ci-v2/ut-go, ci-v2/ut-cpp, will rerun ci-v2/build - /ci-rerun-e2e-default  // for ci-v2/e2e-default - /ci-rerun-e2e-amd  // for ci-v2/e2e-amd (e2e pool dispatcher) - /ci-rerun-e2e-dist-wp  // for ci-v2/e2e-dist-wp (Tencent distributed woodpecker-service boundary) - /ci-rerun-build-ut-cov  // for ci-v2/build-ut-cov (build 

- **Issue #53951** (2026-10-04): **畫面要說清楚的事**
  *Symptoms*: 畫面要說清楚的事  不要只交代外觀，也要交代資料與輸入規則。 背景真的要停下來 遮罩、滑鼠操作與鍵盤焦點必須一致；只把背景變暗卻仍能點擊，是錯誤的 Modal。  第一個焦點依內容決定 短表單可落在第一個輸入欄；資訊量大時先讓標題或起始文字取得焦點，別直接跳到危險按鈕。  不要做成迷你頁面 內容一長，Dialog 會讓捲動、焦點與閱讀變得不舒服；改頁面或 Drawer 更誠實。  必要狀態與回應  每個狀態都要讓使用者知道下一步。 觸發前 開啟按鈕說明用途，例如「邀請成員」。  模態開啟 背景不可操作，焦點進入 Dialog，Tab 在內容內循環。  取消或 Escape 關閉而不做變更，焦點回到觸發按鈕。  ○完成小任務後關閉，原頁能看見合理的更新或回饋。 ●送出  操作 Demo  先知道要觀察什麼，再動手操作。 操作前先知道  邀請成員 先觀察：開啟後背景是否真的停止互動，焦點是否落在邀請表單內。  操作：開啟 Modal，按 Tab 走訪動作，再按 Escape。  預期結果：焦點不離開 Modal；Escape 關閉後回到「開啟邀請 Modal」按鈕。  Modal Dialog Demo  需要先完成或取消，才回到上一個任務 情境：LumenDesk 成員管理 成員管理  盧月鑨 產品設計 · 專案管理員 帳號啟用中 背景在此時不可再操作；焦點會留在對話框內，關閉後才回到開啟按鈕。  開啟邀請確認 尚未開啟對話框。   _最初由 aa0901292300-bit 在 https://github.com/aa0901292300-bit/marc2bibframe2/pull/1#issuecomment-5964911487 发布_
  **Post-Mortem & Fix Analysis**:
  > The title and description of this issue contains Chinese. Please use English to describe your issue.

- **Issue #53943** (2026-10-05): **fix: fix a Regex-related ASAN violation on ARM machine**
  *Symptoms*: related to #53942  The baseline code: ```C++ bool is_special(char c) {     // initial special_bytes_bitmap only once.     static std::once_flag _initialized;     static std::string special_bytes(R"(\.+*?()|[]{}^$)");     static std::vector<bool> special_bytes_bitmap;     std::call_once(_initialized, []() -> void {         special_bytes_bitmap.resize(256);         for (char b : special_bytes) {             special_bytes_bitmap[b + 128] = true;         }     });      return special_bytes_bitmap[c + 128]; } ``` The `c + 128` triggers a problem, because of goes outside of `[0..255]` buffer. The root reason is that `char` is an unsigned type on ARM. The baseline code leads to an overflow. 
  **Post-Mortem & Fix Analysis**:
  > [ci-v2-notice] Notice: New ci-v2 system is enabled for this PR.  To rerun ci-v2 checks, comment with: - /ci-rerun-code-check  // for ci-v2/code-check - /ci-rerun-code-check-macos  // for Code Checker MacOS (GitHub Actions) - /ci-rerun-build  // for ci-v2/build - /ci-rerun-build-all  // for ci-v2/build-all (multi-arch builds) - /ci-rerun-buildenv  // for ci-v2/build-env (build milvus-env builder images; update .env after the new tag is ready) - /ci-rerun-ut-integration  // for ci-v2/ut-integration, will rerun ci-v2/build - /ci-rerun-ut-go  // for ci-v2/ut-go, will rerun ci-v2/build - /ci-rerun-ut-cpp  // for ci-v2/ut-cpp - /ci-rerun-ut  // for all ci-v2/ut-integration, ci-v2/ut-go, ci-v2/ut-cpp, will rerun ci-v2/build - /ci-rerun-e2e-default  // for ci-v2/e2e-default - /ci-rerun-e2e-amd  // for ci-v2/e2e-amd (e2e pool dispatcher) - /ci-rerun-e2e-dist-wp  // for ci-v2/e2e-dist-wp (Tencent distributed woodpecker-service boundary) - /ci-rerun-build-ut-cov  // for ci-v2/build-ut-cov (build 
  > <!-- ciloop-result-1000 --> ### :white_check_mark: CI Loop Results  `4e98e78`  | Stage | Result | Duration | Tests | |-------|--------|----------|-------| | :white_check_mark: Build | SUCCESS | 13.9min | - | | :white_check_mark: Code-Check | SUCCESS | 5.8min | - | | :white_check_mark: UT-Integration | SUCCESS | 39.3min | - | | :white_check_mark: UT-GO | SUCCESS | 29.1min | - | | :white_check_mark: UT-CPP-Cov | SUCCESS | 60.3min | 9706 total, 9706 passed, 0 failed |  **Total:** 98min | [Pipeline](https://jenkins-milvus-ci.milvus.io/job/MILVUS-CI-V2-PR-PIPELINES/job/milvus-build-ut-ciloop-pipeline-for-tcus/1000/pipeline-overview/) | [Artifacts](https://jenkins-milvus-ci.milvus.io/job/MILVUS-CI-V2-PR-PIPELINES/job/milvus-build-ut-ciloop-pipeline-for-tcus/1000/artifact)  **Overall Coverage:** 77.0% **Diff Coverage:** CPP 100.0% (3 hit, 0 miss, 3 measurable lines, 0 unmeasured) **Diff Coverage HTML:** [view changed lines](https://jenkins-milvus-ci.milvus.io/job/MILVUS-CI-V2-PR-PIPELINES/job
  > <!-- ciloop-result-1002 --> ### :white_check_mark: CI Loop Results  `b794924`  | Stage | Result | Duration | Tests | |-------|--------|----------|-------| | :white_check_mark: Build | SUCCESS | 17.1min | - | | :white_check_mark: Code-Check | SUCCESS | 10.4min | - | | :white_check_mark: UT-Integration | SUCCESS | 39.6min | - | | :white_check_mark: UT-GO | SUCCESS | 29.1min | - | | :white_check_mark: UT-CPP-Cov | SUCCESS | 64.1min | 9706 total, 9706 passed, 0 failed |  **Total:** 106min | [Pipeline](https://jenkins-milvus-ci.milvus.io/job/MILVUS-CI-V2-PR-PIPELINES/job/milvus-build-ut-ciloop-pipeline-for-tcus/1002/pipeline-overview/) | [Artifacts](https://jenkins-milvus-ci.milvus.io/job/MILVUS-CI-V2-PR-PIPELINES/job/milvus-build-ut-ciloop-pipeline-for-tcus/1002/artifact)  **Overall Coverage:** 77.0% **Diff Coverage:** CPP 100.0% (5 hit, 0 miss, 5 measurable lines, 2 unmeasured) **Diff Coverage HTML:** [view changed lines](https://jenkins-milvus-ci.milvus.io/job/MILVUS-CI-V2-PR-PIPELINES/j

- **Issue #53941** (2026-10-05): **enhance: bump simdjson from v3.12.2 to v5.0.2**
  *Symptoms*: issue #53940   The new version is slightly (up to several percents) faster on benchmarks.  Tested on an ARM machine
  **Post-Mortem & Fix Analysis**:
  > [ci-v2-notice] Notice: New ci-v2 system is enabled for this PR.  To rerun ci-v2 checks, comment with: - /ci-rerun-code-check  // for ci-v2/code-check - /ci-rerun-code-check-macos  // for Code Checker MacOS (GitHub Actions) - /ci-rerun-build  // for ci-v2/build - /ci-rerun-build-all  // for ci-v2/build-all (multi-arch builds) - /ci-rerun-buildenv  // for ci-v2/build-env (build milvus-env builder images; update .env after the new tag is ready) - /ci-rerun-ut-integration  // for ci-v2/ut-integration, will rerun ci-v2/build - /ci-rerun-ut-go  // for ci-v2/ut-go, will rerun ci-v2/build - /ci-rerun-ut-cpp  // for ci-v2/ut-cpp - /ci-rerun-ut  // for all ci-v2/ut-integration, ci-v2/ut-go, ci-v2/ut-cpp, will rerun ci-v2/build - /ci-rerun-e2e-default  // for ci-v2/e2e-default - /ci-rerun-e2e-amd  // for ci-v2/e2e-amd (e2e pool dispatcher) - /ci-rerun-e2e-dist-wp  // for ci-v2/e2e-dist-wp (Tencent distributed woodpecker-service boundary) - /ci-rerun-build-ut-cov  // for ci-v2/build-ut-cov (build 
  > <!-- ciloop-result-999 --> ### :x: CI Loop Results  `311cedf`  | Stage | Result | Duration | Tests | |-------|--------|----------|-------| | :white_check_mark: Build | SUCCESS | 13.8min | - | | :white_check_mark: Code-Check | SUCCESS | 5.6min | - | | :x: UT-Integration | FAILURE | 39.4min | - | | :white_check_mark: UT-GO | SUCCESS | 28.6min | - | | :white_check_mark: UT-CPP-Cov | SUCCESS | 61.7min | 9706 total, 9706 passed, 0 failed |  **Total:** 98min | [Pipeline](https://jenkins-milvus-ci.milvus.io/job/MILVUS-CI-V2-PR-PIPELINES/job/milvus-build-ut-ciloop-pipeline-for-tcus/999/pipeline-overview/) | [Artifacts](https://jenkins-milvus-ci.milvus.io/job/MILVUS-CI-V2-PR-PIPELINES/job/milvus-build-ut-ciloop-pipeline-for-tcus/999/artifact)  **Overall Coverage:** 77.0%  **Failed Test Logs:** - **UT-Integration**: [view log](https://jenkins-milvus-ci.milvus.io/job/MILVUS-CI-V2-PR-PIPELINES/job/milvus-build-ut-ciloop-pipeline-for-tcus/999/artifact/ut-integration-test.log)  
  > <!-- ciloop-result-1034 --> ### :white_check_mark: CI Loop Results  `adfcd9d`  | Stage | Result | Duration | Tests | |-------|--------|----------|-------| | :white_check_mark: Build | SUCCESS | 9.7min | - | | :white_check_mark: Code-Check | SUCCESS | 6.7min | - | | :white_check_mark: UT-Integration | SUCCESS | 39.2min | - | | :white_check_mark: UT-GO | SUCCESS | 30.3min | - | | :white_check_mark: UT-CPP-Cov | SUCCESS | 59.4min | 9706 total, 9706 passed, 0 failed |  **Total:** 98min | [Pipeline](https://jenkins-milvus-ci.milvus.io/job/MILVUS-CI-V2-PR-PIPELINES/job/milvus-build-ut-ciloop-pipeline-for-tcus/1034/pipeline-overview/) | [Artifacts](https://jenkins-milvus-ci.milvus.io/job/MILVUS-CI-V2-PR-PIPELINES/job/milvus-build-ut-ciloop-pipeline-for-tcus/1034/artifact)  **Overall Coverage:** 77.0%  

- **Issue #53937** (2026-10-01): **feat: [2.6][RLS4] enforce row-level security (#52075)**
  *Symptoms*: issue: #50263 pr: https://github.com/milvus-io/milvus/pull/52075 design doc: docs/design-docs/design_docs/20250610-rls_design.md design doc link: https://github.com/milvus-io/milvus/blob/master/docs/design-docs/design_docs/20250610-rls_design.md design doc PR: #53173  ## Summary Enforces RLS across query, search, delete, insert, and upsert, including privileged skip_rls.
  **Post-Mortem & Fix Analysis**:
  > @aoiasd This is a feature PR (`feat:`). Please provide a design document.  **How to resolve:** Add a design document under `docs/design-docs/design_docs/` in this PR, or link an existing in-repo design document in the PR description: ``` design doc: docs/design-docs/design_docs/YYYYMMDD-your_design.md ``` 
  > [INFO] PR Label Summary by Default [SUCCESS] PR #52075 merged to master - Title: feat: [RLS4] enforce row-level security - Link: https://github.com/milvus-io/milvus/pull/52075   [WARNING] Milestone not set - PR: #53937 - Title: feat: [2.6][RLS4] enforce row-level security (#52075) Please set a milestone for better release tracking  You can set milestone by commenting:   /set-milestone <milestone-name> Example:   /set-milestone 2.5.0  Use /refresh-label to update related check and label manually
  > [APPROVALNOTIFIER] This PR is **NOT APPROVED**  This pull-request has been approved by: To complete the [pull request process](https://git.k8s.io/community/contributors/guide/owners.md#the-code-review-process), please assign **wxyucs** after the PR has been reviewed. You can assign the PR to them by writing `/assign @wxyucs` in a comment when ready.  The full list of commands accepted by this bot can be found [here](https://go.k8s.io/bot-commands?repo=milvus-io%2Fmilvus).  <details open> Needs approval from an approver in each of these files:  - **[OWNERS](https://github.com/milvus-io/milvus/blob/2.6/OWNERS)**  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":["wxyucs"]} -->

- **Issue #53936** (2026-10-01): **feat: [2.6][RLS5] expose row policy and principal tag APIs (#53873)**
  *Symptoms*: issue: #50263 pr: https://github.com/milvus-io/milvus/pull/53873 design doc: docs/design-docs/design_docs/20250610-rls_design.md design doc link: https://github.com/milvus-io/milvus/blob/master/docs/design-docs/design_docs/20250610-rls_design.md design doc PR: #53173  ## Summary Exposes row policy and principal tag management through Proxy and the Go client.
  **Post-Mortem & Fix Analysis**:
  > @aoiasd This is a feature PR (`feat:`). Please provide a design document.  **How to resolve:** Add a design document under `docs/design-docs/design_docs/` in this PR, or link an existing in-repo design document in the PR description: ``` design doc: docs/design-docs/design_docs/YYYYMMDD-your_design.md ``` 
  > [INFO] PR Label Summary by Default [SUCCESS] PR #53873 merged to master - Title: feat: [RLS5] expose row policy and principal tag APIs - Link: https://github.com/milvus-io/milvus/pull/53873   [WARNING] Milestone not set - PR: #53936 - Title: feat: [2.6][RLS5] expose row policy and principal tag APIs (#53873) Please set a milestone for better release tracking  You can set milestone by commenting:   /set-milestone <milestone-name> Example:   /set-milestone 2.5.0  Use /refresh-label to update related check and label manually
  > [APPROVALNOTIFIER] This PR is **NOT APPROVED**  This pull-request has been approved by: To complete the [pull request process](https://git.k8s.io/community/contributors/guide/owners.md#the-code-review-process), please assign **jiaoew1991** after the PR has been reviewed. You can assign the PR to them by writing `/assign @jiaoew1991` in a comment when ready.  The full list of commands accepted by this bot can be found [here](https://go.k8s.io/bot-commands?repo=milvus-io%2Fmilvus).  <details open> Needs approval from an approver in each of these files:  - **[OWNERS](https://github.com/milvus-io/milvus/blob/2.6/OWNERS)**  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":["jiaoew1991"]} -->

- **Issue #53935** (2026-10-01): **feat: [2.6][RLS3] evaluate row-level security policies (#52074)**
  *Symptoms*: issue: #50263 pr: https://github.com/milvus-io/milvus/pull/52074 design doc: docs/design-docs/design_docs/20250610-rls_design.md design doc link: https://github.com/milvus-io/milvus/blob/master/docs/design-docs/design_docs/20250610-rls_design.md design doc PR: #53173  ## Summary Adds policy combination, template compilation, and a three-valued local evaluator for write checks.
  **Post-Mortem & Fix Analysis**:
  > [APPROVALNOTIFIER] This PR is **NOT APPROVED**  This pull-request has been approved by: To complete the [pull request process](https://git.k8s.io/community/contributors/guide/owners.md#the-code-review-process), please assign **wxyucs** after the PR has been reviewed. You can assign the PR to them by writing `/assign @wxyucs` in a comment when ready.  The full list of commands accepted by this bot can be found [here](https://go.k8s.io/bot-commands?repo=milvus-io%2Fmilvus).  <details open> Needs approval from an approver in each of these files:  - **[OWNERS](https://github.com/milvus-io/milvus/blob/2.6/OWNERS)**  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":["wxyucs"]} -->
  > @aoiasd This is a feature PR (`feat:`). Please provide a design document.  **How to resolve:** Add a design document under `docs/design-docs/design_docs/` in this PR, or link an existing in-repo design document in the PR description: ``` design doc: docs/design-docs/design_docs/YYYYMMDD-your_design.md ``` 
  > [INFO] PR Label Summary by Default [SUCCESS] PR #52074 merged to master - Title: feat: [RLS3] evaluate row-level security policies - Link: https://github.com/milvus-io/milvus/pull/52074   [WARNING] Milestone not set - PR: #53935 - Title: feat: [2.6][RLS3] evaluate row-level security policies (#52074) Please set a milestone for better release tracking  You can set milestone by commenting:   /set-milestone <milestone-name> Example:   /set-milestone 2.5.0  Use /refresh-label to update related check and label manually

- **Issue #53934** (2026-10-01): **feat: [2.6][RLS2] synchronize row-level security metadata (#52073)**
  *Symptoms*: issue: #50263 pr: https://github.com/milvus-io/milvus/pull/52073 design doc: docs/design-docs/design_docs/20250610-rls_design.md design doc link: https://github.com/milvus-io/milvus/blob/master/docs/design-docs/design_docs/20250610-rls_design.md design doc PR: #53173  ## Summary Adds bulk RLS metadata loading, versioned Proxy snapshots, notifications, TTL reconciliation, and fail-closed refresh.
  **Post-Mortem & Fix Analysis**:
  > @aoiasd This is a feature PR (`feat:`). Please provide a design document.  **How to resolve:** Add a design document under `docs/design-docs/design_docs/` in this PR, or link an existing in-repo design document in the PR description: ``` design doc: docs/design-docs/design_docs/YYYYMMDD-your_design.md ``` 
  > [INFO] PR Label Summary by Default [SUCCESS] PR #52073 merged to master - Title: feat: [RLS2] synchronize row-level security metadata - Link: https://github.com/milvus-io/milvus/pull/52073   [WARNING] Milestone not set - PR: #53934 - Title: feat: [2.6][RLS2] synchronize row-level security metadata (#52073) Please set a milestone for better release tracking  You can set milestone by commenting:   /set-milestone <milestone-name> Example:   /set-milestone 2.5.0  Use /refresh-label to update related check and label manually
  > [APPROVALNOTIFIER] This PR is **NOT APPROVED**  This pull-request has been approved by: To complete the [pull request process](https://git.k8s.io/community/contributors/guide/owners.md#the-code-review-process), please assign **liliu-z** after the PR has been reviewed. You can assign the PR to them by writing `/assign @liliu-z` in a comment when ready.  The full list of commands accepted by this bot can be found [here](https://go.k8s.io/bot-commands?repo=milvus-io%2Fmilvus).  <details open> Needs approval from an approver in each of these files:  - **[OWNERS](https://github.com/milvus-io/milvus/blob/2.6/OWNERS)**  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":["liliu-z"]} -->

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

### Incident Patch 1: `81f3209c` (2026-10-05)
**Commit Message**: fix: fix a Regex-related ASAN violation on ARM machine (#53943)

related to #53942

The baseline code:
```C++
bool
is_special(char c) {
    // initial special_bytes_bitmap only once.
    static std::once_flag _initialized;
    static std::string special_bytes(R"(\.+*?()|[]{}^$)");
    static std::vector<bool> special_bytes_bitmap;
    std::call_once(_initialized, []() -> void {
        special_bytes_bitmap.resize(256);
        for (char b : special_bytes) {
            special_bytes_bitmap[b + 128] = true;
        }
    });

    return special_bytes_bitmap[c + 128];
}
```
The `c + 128` triggers a problem, because of goes outside of `[0..255]`
buffer. The root reason is that `char` is an unsigned type on ARM. The
baseline code leads to an overflow.

Signed-off-by: Alexandr Guzhva <[REDACTED_EMAIL]>

**File**: `internal/core/src/common/RegexQuery.cpp` (modified, +3/-3)
```diff
@@ -21,14 +21,14 @@ is_special(char c) {
     static std::once_flag _initialized;
     static std::string special_bytes(R"(\.+*?()|[]{}^$)");
     static std::vector<bool> special_bytes_bitmap;
-    std::call_once(_initialized, []() -> void {
+    std::call_once(_initialized, []() {
         special_bytes_bitmap.resize(256);
         for (char b : special_bytes) {
-            special_bytes_bitmap[b + 128] = true;
+            special_bytes_bitmap[static_cast<unsigned char>(b)] = true;
         }
     });
 
-    return special_bytes_bitmap[c + 128];
+    return special_bytes_bitmap[static_cast<unsigned char>(c)];
 }
 
 std::string
```

**File**: `internal/core/src/common/RegexQueryUtilTest.cpp` (modified, +4/-3)
```diff
@@ -96,9 +96,10 @@ TEST(IsSpecial, Demo) {
     for (char b : special_bytes) {
         specials.insert(b);
     }
-    for (char c = std::numeric_limits<int8_t>::min();
-         c < std::numeric_limits<int8_t>::max();
-         c++) {
+    // Use an integer counter so this covers all bytes on both signed-char
+    // and unsigned-char platforms.
+    for (int byte = 0; byte < 256; ++byte) {
+        const char c = static_cast<char>(static_cast<unsigned char>(byte));
         if (specials.find(c) != specials.end()) {
             EXPECT_TRUE(milvus::is_special(c)) << c << static_cast<int>(c);
         } else {
```

---

### Incident Patch 2: `b2a20c81` (2026-10-05)
**Commit Message**: fix: send VoyageAI embedding truncation=false instead of dropping it (#53867)

/kind bug

issue: #53866

### What

- `models/voyageai/voyageai_client.go`: remove `omitempty` from
  `EmbeddingRequest.Truncation`, so the value is always sent.
- `embedding/voyageai_embedding_provider.go`: default `truncate` to
`true`
  instead of `false`.

### Why

VoyageAI treats a missing `truncation` as `true`. With `omitempty` on a
`bool`, an explicit `truncation: "false"` was never sent, so VoyageAI
truncated
over-length text and Milvus stored/searched with a vector of the
truncated text
instead of returning the error the user asked for. Both VoyageAI paths
dropped an explicit `truncation=false`. On the embedding path, the
request struct tagged `Truncation` with `omitempty`, so false was
omitted from the JSON body. On the rerank path, the provider parsed
`truncation` into its params but passed `nil` to the client, so the
value never reached the request. In both cases VoyageAI then applied its
default (true) and silently truncated over-length input. This PR fixes
both: the embedding request always sends the field (the provider
defaults to true when the param is unset, preserving existing behavior)

**File**: `internal/util/function/embedding/voyageai_embedding_provider.go` (modified, +2/-1)
```diff
@@ -58,7 +58,8 @@ func NewVoyageAIEmbeddingProvider(fieldSchema *schemapb.FieldSchema, functionSch
 	}
 	var modelName string
 	dim := int64(0)
-	truncate := false
+	// Matches the VoyageAI service default; the value is always sent.
+	truncate := true
 
 	for _, param := range functionSchema.Params {
 		switch strings.ToLower(param.Key) {
```

**File**: `internal/util/function/embedding/voyageai_embedding_provider_test.go` (modified, +26/-0)
```diff
@@ -299,6 +299,32 @@ func (s *VoyageAITextEmbeddingProviderSuite) TestNewVoyageAIEmbeddingProvider()
 	s.NoError(err)
 	s.Equal(provider.FieldDim(), int64(1024))
 	s.True(provider.MaxBatch() > 0)
+	s.True(provider.truncate)
+
+	// Truncation unset defaults to true; explicit false is kept
+	{
+		unsetSchema := &schemapb.FunctionSchema{
+			Name:             "test",
+			Type:             schemapb.FunctionType_Unknown,
+			InputFieldNames:  []string{"text"},
+			OutputFieldNames: []string{"vector"},
+			InputFieldIds:    []int64{101},
+			OutputFieldIds:   []int64{102},
+			Params: []*commonpb.KeyValuePair{
+				{Key: models.ModelNameParamKey, Value: TestModel},
+				{Key: models.CredentialParamKey, Value: "mock"},
+				{Key: models.DimParamKey, Value: "1024"},
+			},
+		}
+		unsetProvider, err := NewVoyageAIEmbeddingProvider(s.schema.Fields[2], unsetSchema, map[string]string{models.URLParamKey: "mock"}, credentials.NewCredentials(map[string]string{"mock.apikey": "mock"}), &models.ModelExtraInfo{ClusterID: "test-cluster", DBName: "test-db", BatchFactor: 5})
+		s.NoError(err)
+		s.True(unsetProvider.truncate)
+
+		unsetSchema.Params = append(unsetSchema.Params, &commonpb.KeyValuePair{Key: models.TruncationParamKey, Value: "false"})
+		falseProvider, err := NewVoyageAIEmbeddingProvider(s.schema.Fields[2], unsetSchema, map[string]string{models.URLParamKey: "mock"}, credentials.NewCredentials(map[string]string{"mock.apikey": "mock"}), &models.ModelExtraInfo{ClusterID: "test-cluster", DBName: "test-db", BatchFactor: 5})
+		s.NoError(err)
+		s.False(falseProvider.truncate)
+	}
 
 	// Invalid truncation
 	{
```

**File**: `internal/util/function/models/voyageai/voyageai_client.go` (modified, +3/-1)
```diff
@@ -64,7 +64,9 @@ type EmbeddingRequest struct {
 
 	InputType string `json:"input_type,omitempty"`
 
-	Truncation bool `json:"truncation,omitempty"`
+	// Always sent: the service defaults an absent truncation to true, so
+	// omitting false would silently turn an explicit false into true.
+	Truncation bool `json:"truncation"`
 
 	OutputDimension int64 `json:"output_dimension,omitempty"`
 
```

**File**: `internal/util/function/models/voyageai/voyageai_client_test.go` (modified, +32/-0)
```diff
@@ -205,3 +205,35 @@ func TestRerankFailed(t *testing.T) {
 		assert.True(t, err != nil)
 	}
 }
+
+// VoyageAI defaults `truncation` to true when the field is absent, so the
+// request must carry the caller's value explicitly, including false.
+func TestEmbeddingSendsTruncation(t *testing.T) {
+	cases := []struct {
+		name       string
+		truncation bool
+	}{
+		{name: "truncation true", truncation: true},
+		{name: "truncation false", truncation: false},
+	}
+	for _, tc := range cases {
+		t.Run(tc.name, func(t *testing.T) {
+			var got map[string]any
+			ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+				assert.NoError(t, json.NewDecoder(r.Body).Decode(&got))
+				w.WriteHeader(http.StatusOK)
+				w.Write([]byte(`{"object":"list","data":[{"object":"embedding","embedding":[0.1,0.2],"index":0}]}`))
+			}))
+			defer ts.Close()
+
+			c, err := NewVoyageAIClient("mock_key")
+			assert.NoError(t, err)
+			_, err = c.Embedding(ts.URL, "voyage-3", []string{"sentence"}, 0, "query", "float", tc.truncation, 0)
+			assert.NoError(t, err)
+
+			value, ok := got["truncation"]
+			assert.True(t, ok, "request body must contain truncation, got %v", got)
+			assert.Equal(t, tc.truncation, value)
+		})
+	}
+}
```

**File**: `internal/util/function/rerank/model_function_test.go` (modified, +36/-0)
```diff
@@ -20,6 +20,8 @@ package rerank
 
 import (
 	"context"
+	"encoding/json"
+	"io"
 	"net/http"
 	"net/http/httptest"
 	"testing"
@@ -440,6 +442,40 @@ func (s *RerankModelSuite) TestCallVoyageAI() {
 	}
 }
 
+func (s *RerankModelSuite) TestVoyageAISendsTruncation() {
+	repStr := `{"object": "list", "data": [{"object": "rerank", "index": 0, "relevance_score": 0.0}]}`
+	for _, tc := range []struct {
+		value    string
+		expected bool
+	}{
+		{"false", false},
+		{"true", true},
+	} {
+		var body map[string]any
+		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+			data, _ := io.ReadAll(r.Body)
+			body = map[string]any{}
+			_ = json.Unmarshal(data, &body)
+			w.WriteHeader(http.StatusOK)
+			w.Write([]byte(repStr))
+		}))
+		params := []*commonpb.KeyValuePair{
+			{Key: providerParamName, Value: "voyageai"},
+			{Key: models.ModelNameParamKey, Value: "voyageai-test"},
+			{Key: models.CredentialParamKey, Value: "mock"},
+			{Key: models.TruncationParamKey, Value: tc.value},
+		}
+		provider, err := newVoyageaiProvider(params, map[string]string{models.URLParamKey: ts.URL}, credentials.NewCredentials(map[string]string{"mock.apikey": "mock"}), &models.ModelExtraInfo{ClusterID: "test-cluster", DBName: "test-db"})
+		s.NoError(err)
+		_, err = provider.Rerank(context.Background(), "mytest", []string{"t1"})
+		s.NoError(err)
+		ts.Close()
+		v, ok := body[models.TruncationParamKey]
+		s.True(ok, "truncation must be present in the request body")
+		s.Equal(tc.expected, v)
+	}
+}
+
 func (s *RerankModelSuite) TestCallAli() {
 	{
 		repStr := `{"output":{"results":[{"index":0,"relevance_score":0},{"index":1,"relevance_score":0.1},{"index":2,"relevance_score":0.2}]},"usage":{"total_tokens":1},"request_id":"x"}`
```

**File**: `internal/util/function/rerank/voyageai_rerank_provider.go` (modified, +1/-1)
```diff
@@ -88,7 +88,7 @@ func newVoyageaiProvider(params []*commonpb.KeyValuePair, conf map[string]string
 }
 
 func (provider *voyageaiProvider) Rerank(ctx context.Context, query string, docs []string) ([]float32, error) {
-	rerankResp, err := provider.voyageaiClient.Rerank(provider.url, provider.modelName, query, docs, nil, provider.timeoutMs)
+	rerankResp, err := provider.voyageaiClient.Rerank(provider.url, provider.modelName, query, docs, provider.params, provider.timeoutMs)
 	if err != nil {
 		return nil, err
 	}
```

---

### Incident Patch 3: `8247e529` (2026-10-05)
**Commit Message**: fix: return the failure a zilliz model service reports in its response status (#53872)

/kind bug

issue: #53871

### What

`internal/util/function/models/zilliz/zilliz_client.go`: `Embedding`,
`Rerank`
and `Highlight` now check the `Status` of the model service response
through one
helper, `checkResponseStatus`, and return
`merr.WrapErrFunctionFailedMsg("model service returned error, code: %d,
msg: %s")`
when the code is non-zero. A nil `Status` is still treated as success.

### Why

Each model service response (`TextEmbeddingResponse`,
`TextRerankResponse`,
`HighlightResponse`) carries a `Status` next to the payload, and the
client only
checked the gRPC error. A failure reported in `Status` on an RPC that
returned
normally came back as an empty successful result, and the service's code
and
message were dropped. Downstream this turned into a different, less
useful
error: rerank reports `ServiceInternal: rerank service returned 0 scores
for N
docs`, highlight reports a size mismatch, and the embedding path passes
the empty
result on (the embedding function's `Check` indexes `embds[0]`).

`FunctionFailed` is the class the HTTP providers already use for a
non-transient failure report

**File**: `internal/util/function/models/zilliz/zilliz_client.go` (modified, +21/-0)
```diff
@@ -244,6 +244,18 @@ func (c *ZillizClient) setMeta(ctx context.Context) context.Context {
 	return ctx
 }
 
+// checkResponseStatus returns the failure the model service reported in the
+// response body. Every model service response carries its own Status next to
+// the payload, so a nil gRPC error alone does not mean the call succeeded: a
+// non-zero code is a failure even when the RPC itself returned normally. A
+// missing Status is treated as success, as before.
+func checkResponseStatus(status *modelservicepb.Status) error {
+	if status.GetCode() != 0 {
+		return merr.WrapErrFunctionFailedMsg("model service returned error, code: %d, msg: %s", status.GetCode(), status.GetMsg())
+	}
+	return nil
+}
+
 func (c *ZillizClient) Embedding(ctx context.Context, texts []string, params map[string]string) ([][]float32, error) {
 	stub := modelservicepb.NewTextEmbeddingServiceClient(c.conn)
 	req := &modelservicepb.TextEmbeddingRequest{
@@ -256,6 +268,9 @@ func (c *ZillizClient) Embedding(ctx context.Context, texts []string, params map
 	if err != nil {
 		return nil, err
 	}
+	if err := checkResponseStatus(res.GetStatus()); err != nil {
+		return nil, err
+	}
 	embds := make([][]float32, 0, len(res.GetResults()))
 	for _, ret := range res.GetResults() {
 		reader := bytes.NewReader(ret.Dense.Data)
@@ -284,6 +299,9 @@ func (c *ZillizClient) Rerank(ctx context.Context, query string, texts []string,
 	if err != nil {
 		return nil, err
 	}
+	if err := checkResponseStatus(res.GetStatus()); err != nil {
+		return nil, err
+	}
 	return res.Scores, nil
 }
 
@@ -300,6 +318,9 @@ func (c *ZillizClient) Highlight(ctx context.Context, query string, texts []stri
 	if err != nil {
 		return nil, nil, err
 	}
+	if err := checkResponseStatus(res.GetStatus()); err != nil {
+		return nil, nil, err
+	}
 	highlights := make([][]string, 0, len(res.GetResults()))
 	scores := make([][]float32, 0, len(res.GetResults()))
 	for _, ret := range res.GetResults() {
```

**File**: `internal/util/function/models/zilliz/zilliz_client_test.go` (modified, +93/-0)
```diff
@@ -32,6 +32,7 @@ import (
 	"google.golang.org/grpc/test/bufconn"
 
 	"github.com/milvus-io/milvus/pkg/v3/proto/modelservicepb"
+	"github.com/milvus-io/milvus/pkg/v3/util/merr"
 )
 
 const bufSize = 1024 * 1024
@@ -815,3 +816,95 @@ func TestZillizClient_RequestContext(t *testing.T) {
 	assert.True(t, ok)
 	assert.Greater(t, time.Until(fbDeadline), 29*time.Second)
 }
+
+// A model service response carries its own Status. A non-zero code on an RPC
+// that itself returned normally must surface as an error from each client
+// method, instead of the (empty) payload being returned as a result.
+func TestZillizClient_ResponseStatus(t *testing.T) {
+	floatBytes := make([]byte, 8)
+	binary.LittleEndian.PutUint32(floatBytes[0:4], 0x3f800000) // 1.0
+	binary.LittleEndian.PutUint32(floatBytes[4:8], 0x40000000) // 2.0
+
+	failed := &modelservicepb.Status{Code: 1, Msg: "model deployment not ready"}
+	ok := &modelservicepb.Status{Code: 0, Msg: "success"}
+
+	call := map[string]func(c *ZillizClient) (int, error){
+		"embedding": func(c *ZillizClient) (int, error) {
+			res, err := c.Embedding(context.Background(), []string{"a"}, nil)
+			return len(res), err
+		},
+		"rerank": func(c *ZillizClient) (int, error) {
+			res, err := c.Rerank(context.Background(), "q", []string{"a"}, nil)
+			return len(res), err
+		},
+		"highlight": func(c *ZillizClient) (int, error) {
+			res, _, err := c.Highlight(context.Background(), "q", []string{"a"}, nil)
+			return len(res), err
+		},
+	}
+
+	tests := []struct {
+		name    string
+		method  string
+		status  *modelservicepb.Status
+		wantErr bool
+		wantLen int
+	}{
+		{"embedding failed status", "embedding", failed, true, 0},
+		{"embedding ok status", "embedding", ok, false, 1},
+		{"embedding nil status", "embedding", nil, false, 1},
+		{"rerank failed status", "rerank", failed, true, 0},
+		{"rerank ok status", "rerank", ok, false, 1},
+		{"rerank nil status", "rerank", nil, false, 1},
+		{"highlight failed status", "highlight", failed, true, 0},
+		{"highlight ok status", "highlight", ok, false, 1},
+		{"highlight nil status", "highlight", nil, false, 1},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			s, lis, dialer := setupMockServer(t)
+			defer lis.Close()
+			defer s.Stop()
+
+			// A failed status comes without a payload; a successful one with one.
+			embResp := &modelservicepb.TextEmbeddingResponse{Status: tt.status}
+			rerankResp := &modelservicepb.TextRerankResponse{Status: tt.status}
+			hlResp := &modelservicepb.HighlightResponse{Status: tt.status}
+			if !tt.wantErr {
+				embResp.Results = []*modelservicepb.EmbeddingResult{{
+					Dense: &modelservicepb.DenseVector{Dtype: modelservicepb.DenseVector_DTYPE_FLOAT, Data: floatBytes, Dim: 2},
+				}}
+				rerankResp.Scores = []float32{0.5}
+				hlResp.Results = []*modelservicepb.HighlightResult{{Sentences: []string{"a"}, Scores: []float32{0.5}}}
+			}
+			modelservicepb.RegisterTextEmbeddingServiceServer(s, &mockTextEmbeddingServer{response: embResp})
+			modelservicepb.RegisterRerankServiceServer(s, &mockRerankServer{response: rerankResp})
+			modelservicepb.RegisterHighlightServiceServer(s, &mockHighlightServer{response: hlResp})
+			go func() {
+				_ = s.Serve(lis)
+			}()
+
+			conn, err := grpc.DialContext(context.Background(), "bufnet",
+				grpc.WithContextDialer(dialer),
+				grpc.WithTransportCredentials(insecure.NewCredentials()),
+				grpc.WithBlock(),
+			)
+			require.NoError(t, err)
+			defer conn.Close()
+
+			client := NewZilliClientForTests("test-deployment", "test-cluster", "", conn, 5000)
+			n, err := call[tt.method](client)
+			if tt.wantErr {
+				require.Error(t, err)
+				assert.Contains(t, err.Error(), "model deployment not ready")
+				assert.Contains(t, err.Error(), "code: 1")
+				assert.ErrorIs(t, err, merr.ErrFunctionFailed)
+				assert.Equal(t, int32(2400), merr.Code(err))
+				return
+			}
+			require.NoError(t, err)
+			assert.Equal(t, tt.wantLen, n)
+		})
+	}
+}
```

---

### Incident Patch 4: `0d166dc4` (2026-10-05)
**Commit Message**: fix: preserve GC checkpoint protection on channel lookup errors (#53924)

issue: #53916

- DataCoord GC: check the channel checkpoint first, and retain dropped
segments for retry when a required channel lookup fails
- Metastore: distinguish channel lookup errors from missing markers
while preserving successful-read behavior

Signed-off-by: chyezh <[REDACTED_EMAIL]>

**File**: `internal/datacoord/garbage_collector.go` (modified, +15/-6)
```diff
@@ -909,14 +909,23 @@ func (gc *garbageCollector) checkDroppedSegmentGC(segment *SegmentInfo,
 		}
 	}
 
+	dmlTs := segmentEffectiveDmlTs(segment.SegmentInfo)
+	if dmlTs <= cpTimestamp {
+		return true
+	}
+
+	// A removed channel no longer needs checkpoint protection. Its checkpoint
+	// may stop advancing, while collection cleanup waits for segment GC.
 	segInsertChannel := segment.GetInsertChannel()
-	// Ignore segments from potentially dropped collection. Check if collection is to be dropped by checking if channel is dropped.
-	// We do this because collection meta drop relies on all segment being GCed.
-	if gc.meta.catalog.ChannelExists(context.Background(), segInsertChannel) &&
-		segmentEffectiveDmlTs(segment.SegmentInfo) > cpTimestamp {
-		// segment gc shall only happen when channel cp is after segment dml cp.
+	channelExists, err := gc.meta.catalog.ChannelExists(gc.ctx, segInsertChannel)
+	if err != nil {
+		log.RatedWarn(gc.ctx, rate.Limit(60), "failed to check channel existence, skip dropped segment GC",
+			mlog.FieldVChannel(segInsertChannel), mlog.Err(err))
+		return false
+	}
+	if channelExists {
 		log.RatedInfo(gc.ctx, rate.Limit(60), "dropped segment dml position after channel cp, skip meta gc",
-			mlog.Uint64("dmlPosTs", segmentEffectiveDmlTs(segment.SegmentInfo)),
+			mlog.Uint64("dmlPosTs", dmlTs),
 			mlog.Uint64("channelCpTs", cpTimestamp),
 		)
 		return false
```

**File**: `internal/datacoord/garbage_collector_channel_lookup_test.go` (added, +182/-0)
```diff
@@ -0,0 +1,182 @@
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
+package datacoord
+
+import (
+	"context"
+	"path"
+	"testing"
+	"time"
+
+	"github.com/bytedance/mockey"
+	"github.com/google/uuid"
+	"github.com/stretchr/testify/require"
+	"go.etcd.io/etcd/api/v3/v3rpc/rpctypes"
+	clientv3 "go.etcd.io/etcd/client/v3"
+
+	"github.com/milvus-io/milvus-proto/go-api/v3/commonpb"
+	"github.com/milvus-io/milvus-proto/go-api/v3/msgpb"
+	etcdkv "github.com/milvus-io/milvus/internal/kv/etcd"
+	"github.com/milvus-io/milvus/internal/metastore/kv/binlog"
+	kvdatacoord "github.com/milvus-io/milvus/internal/metastore/kv/datacoord"
+	"github.com/milvus-io/milvus/internal/storage"
+	"github.com/milvus-io/milvus/pkg/v3/objectstorage"
+	"github.com/milvus-io/milvus/pkg/v3/proto/datapb"
+	"github.com/milvus-io/milvus/pkg/v3/util/funcutil"
+	"github.com/milvus-io/milvus/pkg/v3/util/merr"
+)
+
+// Exercise real etcd metadata and local object deletion through the GC sweep.
+// Faults affect only channel-marker Load; segment reads and deletion stay healthy.
+func TestGarbageCollector_ChannelLookup(t *testing.T) {
+	ctx := context.Background()
+	client, err := clientv3.New(clientv3.Config{
+		Endpoints: Params.EtcdCfg.Endpoints.GetAsStrings(), DialTimeout: 5 * time.Second,
+	})
+	require.NoError(t, err)
+	defer client.Close()
+
+	loaded := mockey.Mock((*ServerHandler).ListLoadedSegments).Return([]int64{}, nil).Build()
+	defer loaded.UnPatch()
+
+	for _, tc := range []struct {
+		name            string
+		marker          string
+		checkpoint      uint64
+		lookupErr       error
+		persistentError bool
+		wantRetained    bool
+	}{
+		{name: "transient lookup failure", marker: kvdatacoord.NonRemoveFlagTomestone, checkpoint: 100, lookupErr: context.DeadlineExceeded, wantRetained: true},
+		{name: "persistent lookup failure", marker: kvdatacoord.NonRemoveFlagTomestone, checkpoint: 100, lookupErr: rpctypes.ErrPermissionDenied, persistentError: true, wantRetained: true},
+		{name: "checkpoint behind", marker: kvdatacoord.NonRemoveFlagTomestone, checkpoint: 100, wantRetained: true},
+		{name: "checkpoint equal", marker: kvdatacoord.NonRemoveFlagTomestone, checkpoint: 120},
+		{name: "checkpoint passed", marker: kvdatacoord.NonRemoveFlagTomestone, checkpoint: 130},
+		{name: "checkpoint equal with persistent failure", marker: kvdatacoord.NonRemoveFlagTomestone, checkpoint: 120, lookupErr: context.DeadlineExceeded, persistentError: true},
+		{name: "checkpoint passed with persistent failure", marker: kvdatacoord.NonRemoveFlagTomestone, checkpoint: 130, lookupErr: rpctypes.ErrPermissionDenied, persistentError: true},
+		{name: "dropped checkpoint with persistent failure", marker: kvdatacoord.NonRemoveFlagTomestone, checkpoint: funcutil.DroppedChannelCheckpointTimestamp, lookupErr: rpctypes.ErrPermissionDenied, persistentError: true},
+		{name: "removed channel", marker: kvdatacoord.RemoveFlagTomestone, checkpoint: 100},
+		{name: "missing marker", checkpoint: 100},
+		{name: "removed channel after lookup recovers", marker: kvdatacoord.RemoveFlagTomestone, checkpoint: 100, lookupErr: context.DeadlineExceeded, wantRetained: true},
+		{name: "missing marker after lookup recovers", checkpoint: 100, lookupErr: context.DeadlineExceeded, wantRetained: true},
+		{name: "permission denied", marker: kvdatacoord.NonRemoveFlagTomestone, checkpoint: 100, lookupErr: rpctypes.ErrPermissionDenied, wantRetained: true},
+		{name: "canceled lookup", marker: kvdatacoord.NonRemoveFlagTomestone, checkpoint: 100, lookupErr: context.Canceled, wantRetained: true},
+		{name: "unknown marker preserves legacy behavior", marker: "invalid", checkpoint: 100},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			root := "gc-channel-lookup-" + uuid.NewString()
+			kv := etcdkv.NewEtcdKV(client, root)
+			defer func() { require.NoError(t, kv.RemoveWithPrefix(ctx, "")) }()
+			objectRoot := t.TempDir()
+			cli := storage.NewLocalChunkManager(objectstorage.RootPath(objectRoot))
+			rootPatch := mockey.Mock(binlog.GetRootPath).Return(objectRoot).Build()
+			defer rootPatch.UnPatch()
+			catalog := kvdatacoord.NewCatalog(kv, objectRoot, root)
+			m := &meta{ctx: ctx, catalog: catalog, segments: NewSegmentsInfo(), channelCPs: newChannelCps(
```

**File**: `internal/datacoord/garbage_collector_test.go` (modified, +11/-12)
```diff
@@ -1418,10 +1418,8 @@ func TestGarbageCollector_recycleUnusedIndexFilesV1(t *testing.T) {
 
 func TestGarbageCollector_clearETCD(t *testing.T) {
 	catalog := catalogmocks.NewDataCoordCatalog(t)
-	catalog.On("ChannelExists",
-		mock.Anything,
-		mock.Anything,
-	).Return(true)
+	channelExists := mockey.Mock((*catalogmocks.DataCoordCatalog).ChannelExists).Return(true, nil).Build()
+	defer channelExists.UnPatch()
 	catalog.On("DropChannelCheckpoint",
 		mock.Anything,
 		mock.Anything,
@@ -2629,7 +2627,8 @@ func TestGarbageCollector_recycleDroppedSegments_NoIndexCollection(t *testing.T)
 	for _, test := range tests {
 		t.Run(test.name, func(t *testing.T) {
 			catalog := catalogmocks.NewDataCoordCatalog(t)
-			catalog.EXPECT().ChannelExists(mock.Anything, channelName).Return(false).Once()
+			channelExists := mockey.Mock((*catalogmocks.DataCoordCatalog).ChannelExists).Return(false, nil).Build()
+			defer channelExists.UnPatch()
 
 			meta := &meta{
 				catalog:    catalog,
@@ -2765,9 +2764,7 @@ func TestGarbageCollector_recycleDroppedSegments_SnapshotReference(t *testing.T)
 	}).Build()
 	defer mock6.UnPatch()
 
-	mock7 := mockey.Mock((*datacoord.Catalog).ChannelExists).To(func(c *datacoord.Catalog, ctx context.Context, channel string) bool {
-		return true
-	}).Build()
+	mock7 := mockey.Mock((*datacoord.Catalog).ChannelExists).Return(true, nil).Build()
 	defer mock7.UnPatch()
 
 	dropSegmentCalled := false
@@ -3641,7 +3638,7 @@ func TestGarbageCollector_recycleDroppedSegments_SnapshotMetaNil(t *testing.T) {
 	mockListSegmentIndexes := mockey.Mock((*datacoord.Catalog).ListSegmentIndexes).Return([]*model.SegmentIndex{}, nil).Build()
 	defer mockListSegmentIndexes.UnPatch()
 
-	mockChannelExists := mockey.Mock((*datacoord.Catalog).ChannelExists).Return(true).Build()
+	mockChannelExists := mockey.Mock((*datacoord.Catalog).ChannelExists).Return(true, nil).Build()
 	defer mockChannelExists.UnPatch()
 
 	dropSegmentCalled := false
@@ -4598,7 +4595,7 @@ func TestGarbageCollector_recycleDroppedSegments_V3(t *testing.T) {
 	defer mockIsSegBlocked.UnPatch()
 	mockListLoaded := mockey.Mock((*ServerHandler).ListLoadedSegments).Return([]int64{}, nil).Build()
 	defer mockListLoaded.UnPatch()
-	mockChannelExists := mockey.Mock((*datacoord.Catalog).ChannelExists).Return(true).Build()
+	mockChannelExists := mockey.Mock((*datacoord.Catalog).ChannelExists).Return(true, nil).Build()
 	defer mockChannelExists.UnPatch()
 	mockDropSegment := mockey.Mock((*datacoord.Catalog).DropSegment).To(func(c *datacoord.Catalog, ctx context.Context, segment *datapb.SegmentInfo) error {
 		droppedSegmentIDs = append(droppedSegmentIDs, segment.ID)
@@ -5318,7 +5315,8 @@ func TestGarbageCollector_recycleSnapshots_OrphanCleanup(t *testing.T) {
 func TestCheckDroppedSegmentGC_CommitTimestamp(t *testing.T) {
 	t.Run("import segment not GCed when commit_timestamp > cpTimestamp", func(t *testing.T) {
 		catalog := catalogmocks.NewDataCoordCatalog(t)
-		catalog.On("ChannelExists", mock.Anything, mock.Anything).Return(true)
+		channelExists := mockey.Mock((*catalogmocks.DataCoordCatalog).ChannelExists).Return(true, nil).Build()
+		defer channelExists.UnPatch()
 
 		m := &meta{
 			catalog:    catalog,
@@ -5343,7 +5341,8 @@ func TestCheckDroppedSegmentGC_CommitTimestamp(t *testing.T) {
 
 	t.Run("import segment GCed when commit_timestamp <= cpTimestamp", func(t *testing.T) {
 		catalog := catalogmocks.NewDataCoordCatalog(t)
-		catalog.On("ChannelExists", mock.Anything, mock.Anything).Return(true)
+		channelExists := mockey.Mock((*catalogmocks.DataCoordCatalog).ChannelExists).Return(true, nil).Build()
+		defer channelExists.UnPatch()
 
 		m := &meta{
 			catalog:    catalog,
```

**File**: `internal/metastore/datacoord_catalog.go` (modified, +2/-1)
```diff
@@ -83,7 +83,8 @@ type DataCoordCatalog interface {
 	// TODO: From MarkChannelAdded to DropChannel, it's totally a redundant design by now, remove it in future.
 	MarkChannelAdded(ctx context.Context, channel string) error
 	ShouldDropChannel(ctx context.Context, channel string) bool
-	ChannelExists(ctx context.Context, channel string) bool
+	// ChannelExists returns lookup errors separately from an absent channel.
+	ChannelExists(ctx context.Context, channel string) (bool, error)
 	DropChannel(ctx context.Context, channel string) error
 
 	ListChannelCheckpoint(ctx context.Context) (map[string]*msgpb.MsgPosition, error)
```

**File**: `internal/metastore/kv/datacoord/channel_lookup_test.go` (added, +74/-0)
```diff
@@ -0,0 +1,74 @@
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
+package datacoord
+
+import (
+	"context"
+	"testing"
+
+	"github.com/bytedance/mockey"
+	"github.com/stretchr/testify/require"
+	"go.etcd.io/etcd/api/v3/v3rpc/rpctypes"
+
+	etcdkv "github.com/milvus-io/milvus/internal/kv/etcd"
+	"github.com/milvus-io/milvus/pkg/v3/util/merr"
+)
+
+func TestChannelExists(t *testing.T) {
+	for _, tc := range []struct {
+		name    string
+		value   string
+		loadErr error
+		exists  bool
+		wantErr error
+	}{
+		{name: "active", value: NonRemoveFlagTomestone, exists: true},
+		{name: "removed", value: RemoveFlagTomestone},
+		{name: "not found", loadErr: merr.WrapErrIoKeyNotFound("channel")},
+		{name: "wrapped not found", loadErr: merr.Wrap(merr.WrapErrIoKeyNotFound("channel"), "load")},
+		{name: "deadline", loadErr: context.DeadlineExceeded, wantErr: context.DeadlineExceeded},
+		{name: "canceled", loadErr: context.Canceled, wantErr: context.Canceled},
+		{name: "permission denied", loadErr: rpctypes.ErrPermissionDenied, wantErr: rpctypes.ErrPermissionDenied},
+		{name: "unavailable", loadErr: merr.ErrServiceUnavailable, wantErr: merr.ErrServiceUnavailable},
+		{name: "io failure", loadErr: merr.ErrIoFailed, wantErr: merr.ErrIoFailed},
+		{name: "empty marker preserves legacy behavior"},
+		{name: "unknown marker preserves legacy behavior", value: "unexpected"},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			ctx, cancel := context.WithCancel(context.Background())
+			defer cancel()
+			kv := etcdkv.NewEtcdKV(nil, "channel-lookup")
+			load := mockey.Mock(mockey.GetMethod(kv, "Load")).To(func(gotCtx context.Context, key string) (string, error) {
+				require.Same(t, ctx, gotCtx)
+				require.Equal(t, buildChannelRemovePath("channel"), key)
+				return tc.value, tc.loadErr
+			}).Build()
+			defer load.UnPatch()
+			catalog := &Catalog{MetaKv: kv}
+			exists, err := catalog.ChannelExists(ctx, "channel")
+			require.Equal(t, tc.exists, exists)
+			if tc.wantErr == nil {
+				require.NoError(t, err)
+			} else {
+				require.ErrorIs(t, err, tc.wantErr)
+				require.Equal(t, merr.Code(tc.wantErr), merr.Code(err), "preserve the source error code")
+				require.Contains(t, err.Error(), "channel")
+			}
+			require.Equal(t, 1, load.Times())
+		})
+	}
+}
```

**File**: `internal/metastore/kv/datacoord/kv_catalog.go` (modified, +10/-2)
```diff
@@ -583,10 +583,18 @@ func (kc *Catalog) ShouldDropChannel(ctx context.Context, channel string) bool {
 	return true
 }
 
-func (kc *Catalog) ChannelExists(ctx context.Context, channel string) bool {
+// ChannelExists reports whether the channel marker is active. Missing keys are
+// treated as absent; other lookup failures are returned to the caller.
+func (kc *Catalog) ChannelExists(ctx context.Context, channel string) (bool, error) {
 	key := buildChannelRemovePath(channel)
 	v, err := kc.MetaKv.Load(ctx, key)
-	return err == nil && v == NonRemoveFlagTomestone
+	if errors.Is(err, merr.ErrIoKeyNotFound) {
+		return false, nil
+	}
+	if err != nil {
+		return false, merr.Wrapf(err, "failed to load channel marker %s", channel)
+	}
+	return v == NonRemoveFlagTomestone, nil
 }
 
 // DropChannel removes channel remove flag after whole procedure is finished
```

**File**: `internal/metastore/kv/datacoord/kv_catalog_test.go` (modified, +9/-6)
```diff
@@ -29,6 +29,7 @@ import (
 	"testing"
 	"time"
 
+	"github.com/bytedance/mockey"
 	"github.com/cockroachdb/errors"
 	"github.com/stretchr/testify/assert"
 	"github.com/stretchr/testify/mock"
@@ -905,14 +906,16 @@ func Test_MarkChannelAdded_SaveError(t *testing.T) {
 	assert.Error(t, err)
 }
 
-func Test_ChannelExists_SaveError(t *testing.T) {
-	txn := mocks.NewMetaKv(t)
-	txn.EXPECT().
-		Load(mock.Anything, mock.Anything).
-		Return("", errors.New("mock error"))
+func Test_ChannelExists_LoadError(t *testing.T) {
+	txn := etcdkv.NewEtcdKV(nil, "")
+	loadErr := errors.New("mock error")
+	load := mockey.Mock(mockey.GetMethod(txn, "Load")).Return("", loadErr).Build()
+	defer load.UnPatch()
 
 	catalog := NewCatalog(txn, rootPath, "")
-	assert.False(t, catalog.ChannelExists(context.TODO(), "test_channel_1"))
+	exists, err := catalog.ChannelExists(context.TODO(), "test_channel_1")
+	assert.False(t, exists)
+	require.ErrorIs(t, err, loadErr)
 }
 
 func Test_parseBinlogKey(t *testing.T) {
```

**File**: `internal/metastore/mocks/mock_datacoord_catalog.go` (modified, +15/-5)
```diff
@@ -230,21 +230,31 @@ func (_c *DataCoordCatalog_AlterSegments_Call) RunAndReturn(run func(context.Con
 }
 
 // ChannelExists provides a mock function with given fields: ctx, channel
-func (_m *DataCoordCatalog) ChannelExists(ctx context.Context, channel string) bool {
+func (_m *DataCoordCatalog) ChannelExists(ctx context.Context, channel string) (bool, error) {
 	ret := _m.Called(ctx, channel)
 
 	if len(ret) == 0 {
 		panic("no return value specified for ChannelExists")
 	}
 
 	var r0 bool
+	var r1 error
+	if rf, ok := ret.Get(0).(func(context.Context, string) (bool, error)); ok {
+		return rf(ctx, channel)
+	}
 	if rf, ok := ret.Get(0).(func(context.Context, string) bool); ok {
 		r0 = rf(ctx, channel)
 	} else {
 		r0 = ret.Get(0).(bool)
 	}
 
-	return r0
+	if rf, ok := ret.Get(1).(func(context.Context, string) error); ok {
+		r1 = rf(ctx, channel)
+	} else {
+		r1 = ret.Error(1)
+	}
+
+	return r0, r1
 }
 
 // DataCoordCatalog_ChannelExists_Call is a *mock.Call that shadows Run/Return methods with type explicit version for method 'ChannelExists'
@@ -266,12 +276,12 @@ func (_c *DataCoordCatalog_ChannelExists_Call) Run(run func(ctx context.Context,
 	return _c
 }
 
-func (_c *DataCoordCatalog_ChannelExists_Call) Return(_a0 bool) *DataCoordCatalog_ChannelExists_Call {
-	_c.Call.Return(_a0)
+func (_c *DataCoordCatalog_ChannelExists_Call) Return(_a0 bool, _a1 error) *DataCoordCatalog_ChannelExists_Call {
+	_c.Call.Return(_a0, _a1)
 	return _c
 }
 
-func (_c *DataCoordCatalog_ChannelExists_Call) RunAndReturn(run func(context.Context, string) bool) *DataCoordCatalog_ChannelExists_Call {
+func (_c *DataCoordCatalog_ChannelExists_Call) RunAndReturn(run func(context.Context, string) (bool, error)) *DataCoordCatalog_ChannelExists_Call {
 	_c.Call.Return(run)
 	return _c
 }
```

---

### Incident Patch 5: `0acf11fd` (2026-10-02)
**Commit Message**: fix: authorize collection metadata RPCs (#53722)

Authenticated callers can reach segment and replica metadata without a
target-collection permission check. Require the existing `GetStatistics`
privilege for `GetPersistentSegmentInfo` / `GetQuerySegmentInfo`, and
`GetLoadState` for `GetReplicas`. Both permissions remain compatible
with the existing ReadOnly group.

Apply the checks at gRPC dispatch and at the public Proxy methods used
by direct callers. Normalize each request's database before
authorization and execution. ID-only replica requests are authorized
against the resolved collection's actual database and name; incomplete
identity fails closed. Preserve name-selector precedence, configured
alias behavior, root role binding, and other public/result-filtered RPC
contracts.

For ID-only `GetReplicas`, missing collection/database identities and
existing but unauthorized identities now return the same
`PermissionDenied` code and sanitized message. The response does not
disclose the resolved database or collection name. Direct Proxy calls
likewise return matching response status fields. Only lookup not-found
errors are concealed; cancellation, timeout, not-ready, and unavailable

**File**: `internal/distributed/proxy/httpserver/handler.go` (modified, +22/-3)
```diff
@@ -17,12 +17,16 @@
 package httpserver
 
 import (
+	"context"
+
 	"github.com/gin-gonic/gin"
+	"google.golang.org/grpc/metadata"
 	"google.golang.org/protobuf/proto"
 
 	"github.com/milvus-io/milvus-proto/go-api/v3/milvuspb"
 	"github.com/milvus-io/milvus/internal/proxy"
 	"github.com/milvus-io/milvus/internal/types"
+	"github.com/milvus-io/milvus/pkg/v3/util"
 	"github.com/milvus-io/milvus/pkg/v3/util/merr"
 )
 
@@ -444,13 +448,26 @@ func (h *Handlers) handleGetFlushState(c *gin.Context) (interface{}, error) {
 	return h.proxy.GetFlushState(c, &req)
 }
 
+// metadataRequestContext forwards only the identity verified by HTTP middleware.
+// Preserve request values, deadlines and cancellation, but replace any inherited
+// authentication/database metadata rather than appending behind its first value.
+func metadataRequestContext(c *gin.Context, dbName string) context.Context {
+	ctx := c.Request.Context()
+	md, _ := metadata.FromIncomingContext(ctx)
+	md = md.Copy()
+	md.Delete(util.HeaderAuthorize)
+	md.Delete(util.HeaderDBName)
+	return proxy.NewContextWithMetadata(metadata.NewIncomingContext(ctx, md), c.GetString(ContextUsername), dbName)
+}
+
 func (h *Handlers) handleGetPersistentSegmentInfo(c *gin.Context) (interface{}, error) {
 	req := milvuspb.GetPersistentSegmentInfoRequest{}
 	err := shouldBind(c, &req)
 	if err != nil {
 		return nil, badRequestf(err, "parse body failed")
 	}
-	return h.proxy.GetPersistentSegmentInfo(c, &req)
+	ctx := metadataRequestContext(c, req.GetDbName())
+	return h.proxy.GetPersistentSegmentInfo(ctx, &req)
 }
 
 func (h *Handlers) handleGetQuerySegmentInfo(c *gin.Context) (interface{}, error) {
@@ -459,7 +476,8 @@ func (h *Handlers) handleGetQuerySegmentInfo(c *gin.Context) (interface{}, error
 	if err != nil {
 		return nil, badRequestf(err, "parse body failed")
 	}
-	return h.proxy.GetQuerySegmentInfo(c, &req)
+	ctx := metadataRequestContext(c, req.GetDbName())
+	return h.proxy.GetQuerySegmentInfo(ctx, &req)
 }
 
 func (h *Handlers) handleGetReplicas(c *gin.Context) (interface{}, error) {
@@ -468,7 +486,8 @@ func (h *Handlers) handleGetReplicas(c *gin.Context) (interface{}, error) {
 	if err != nil {
 		return nil, badRequestf(err, "parse body failed")
 	}
-	return h.proxy.GetReplicas(c, &req)
+	ctx := metadataRequestContext(c, req.GetDbName())
+	return h.proxy.GetReplicas(ctx, &req)
 }
 
 func (h *Handlers) handleGetMetrics(c *gin.Context) (interface{}, error) {
```

**File**: `internal/distributed/proxy/httpserver/metadata_privilege_test.go` (added, +130/-0)
```diff
@@ -0,0 +1,130 @@
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
+	"fmt"
+	"net/http"
+	"net/http/httptest"
+	"strings"
+	"testing"
+	"time"
+
+	"github.com/gin-gonic/gin"
+	"github.com/stretchr/testify/require"
+	"google.golang.org/grpc/metadata"
+
+	"github.com/milvus-io/milvus-proto/go-api/v3/milvuspb"
+	"github.com/milvus-io/milvus/internal/types"
+	"github.com/milvus-io/milvus/pkg/v3/util"
+	"github.com/milvus-io/milvus/pkg/v3/util/contextutil"
+	"github.com/milvus-io/milvus/pkg/v3/util/crypto"
+)
+
+type metadataIdentityProxy struct {
+	types.ProxyComponent
+	ctx            context.Context
+	dbName         string
+	collectionName string
+}
+
+func (p *metadataIdentityProxy) GetPersistentSegmentInfo(ctx context.Context, req *milvuspb.GetPersistentSegmentInfoRequest) (*milvuspb.GetPersistentSegmentInfoResponse, error) {
+	p.ctx = ctx
+	p.dbName, p.collectionName = req.GetDbName(), req.GetCollectionName()
+	return &milvuspb.GetPersistentSegmentInfoResponse{}, nil
+}
+
+func (p *metadataIdentityProxy) GetQuerySegmentInfo(ctx context.Context, req *milvuspb.GetQuerySegmentInfoRequest) (*milvuspb.GetQuerySegmentInfoResponse, error) {
+	p.ctx = ctx
+	p.dbName, p.collectionName = req.GetDbName(), req.GetCollectionName()
+	return &milvuspb.GetQuerySegmentInfoResponse{}, nil
+}
+
+func (p *metadataIdentityProxy) GetReplicas(ctx context.Context, req *milvuspb.GetReplicasRequest) (*milvuspb.GetReplicasResponse, error) {
+	p.ctx = ctx
+	p.dbName, p.collectionName = req.GetDbName(), req.GetCollectionName()
+	return &milvuspb.GetReplicasResponse{}, nil
+}
+
+func TestMetadataHandlersForwardVerifiedPrincipal(t *testing.T) {
+	for _, inherited := range []bool{false, true} {
+		for _, username := range []string{"root", "reader", ""} {
+			for _, method := range []string{"persistent", "query", "replicas"} {
+				t.Run(fmt.Sprintf("%s/%s/inherited=%v", method, username, inherited), func(t *testing.T) {
+					p := &metadataIdentityProxy{}
+					h := &Handlers{proxy: p}
+					c, _ := gin.CreateTestContext(httptest.NewRecorder())
+					// Existing incoming metadata must not override the principal
+					// verified by HTTP middleware, including when it is missing.
+					originalMD := metadata.Pairs("request-id", "metadata-request")
+					if inherited {
+						originalMD.Set(util.HeaderAuthorize, crypto.Base64Encode("unverified:password"))
+						originalMD.Set(util.HeaderDBName, "unverified_db")
+					}
+					requestCtx, cancel := context.WithTimeout(metadata.NewIncomingContext(context.Background(), originalMD), time.Minute)
+					defer cancel()
+					body := `{"dbName":"tenant_b","collectionName":"records"}`
+					if method == "replicas" {
+						body = `{"db_name":"tenant_b","collection_name":"records"}`
+					}
+					c.Request = httptest.NewRequest(http.MethodGet, "/", strings.NewReader(body)).WithContext(requestCtx)
+					c.Request.Header.Set("Content-Type", "application/json")
+					// The handler must use the verified middleware identity, never this
+					// caller-controlled credential header or Gin's context fallback.
+					c.Request.SetBasicAuth("forged_user", "password")
+					if username != "" {
+						c.Set(ContextUsername, username)
+					}
+					var err error
+					switch method {
+					case "persistent":
+						_, err = h.handleGetPersistentSegmentInfo(c)
+					case "query":
+						_, err = h.handleGetQuerySegmentInfo(c)
+					case "replicas":
+						_, err = h.handleGetReplicas(c)
+					}
+					require.NoError(t, err)
+					require.NotNil(t, p.ctx)
+					require.Equal(t, "tenant_b", p.dbName)
+					require.Equal(t, "records", p.collectionName)
+					forwardedMD, ok := metadata.FromIncomingContext(p.ctx)
+					require.True(t, ok)
+					require.Equal(t, []string{"tenant_b"}, forwardedMD.Get(util.HeaderDBName))
+					require.Equal(t, []string{"metadata-request"}, forwardedMD.Get("request-id"))
+					if inherited {
+						require.Equal(t, []string{"unverified_db"}, originalMD.Get(util.HeaderDBName), "do not mutate the parent metadata")
+					}
+					deadline, ok := p.ctx.Deadline()
+					require.True(t, ok)
+					requestDeadline, _ := requestCtx.Deadline()
+					require.Equal(t, requestDeadline, deadline)
+					actual, _, authEr
```

**File**: `internal/proxy/impl.go` (modified, +27/-9)
```diff
@@ -4465,7 +4465,7 @@ func (node *Proxy) GetPersistentSegmentInfo(ctx context.Context, req *milvuspb.G
 	ctx, sp := otel.Tracer(typeutil.ProxyRole).Start(ctx, "Proxy-GetPersistentSegmentInfo")
 	defer sp.End()
 
-	mlog.Debug(context.TODO(), "GetPersistentSegmentInfo",
+	mlog.Debug(ctx, "GetPersistentSegmentInfo",
 		mlog.String("role", typeutil.ProxyRole),
 		mlog.String("db", req.DbName),
 		mlog.Any("collection", req.CollectionName))
@@ -4479,6 +4479,12 @@ func (node *Proxy) GetPersistentSegmentInfo(ctx context.Context, req *milvuspb.G
 	}
 	method := "GetPersistentSegmentInfo"
 	tr := timerecord.NewTimeRecorder(method)
+	req.DbName = GetCurDBNameFromRequestOrContext(ctx, req)
+	ctx, err := node.authorizeCollectionMetadata(ctx, req)
+	if err != nil {
+		resp.Status = merr.Status(err)
+		return resp, nil
+	}
 
 	// list segments
 	collectionID, err := node.GetMetaCache().GetCollectionID(ctx, req.GetDbName(), req.GetCollectionName())
@@ -4516,7 +4522,7 @@ func (node *Proxy) GetPersistentSegmentInfo(ctx context.Context, req *milvuspb.G
 		IncludeUnHealthy: lo.Contains(states, commonpb.SegmentState_Dropped),
 	})
 	if err != nil {
-		mlog.Warn(context.TODO(), "GetPersistentSegmentInfo fail",
+		mlog.Warn(ctx, "GetPersistentSegmentInfo fail",
 			mlog.Err(err))
 		resp.Status = merr.Status(err)
 		return resp, nil
@@ -4526,7 +4532,7 @@ func (node *Proxy) GetPersistentSegmentInfo(ctx context.Context, req *milvuspb.G
 		resp.Status = merr.Status(err)
 		return resp, nil
 	}
-	mlog.Debug(context.TODO(), "GetPersistentSegmentInfo",
+	mlog.Debug(ctx, "GetPersistentSegmentInfo",
 		mlog.Int("len(infos)", len(infoResp.Infos)),
 		mlog.Any("status", infoResp.Status))
 	persistentInfos := make([]*milvuspb.PersistentSegmentInfo, 0, len(infoResp.Infos))
@@ -4639,7 +4645,7 @@ func (node *Proxy) GetQuerySegmentInfo(ctx context.Context, req *milvuspb.GetQue
 	ctx, sp := otel.Tracer(typeutil.ProxyRole).Start(ctx, "Proxy-GetQuerySegmentInfo")
 	defer sp.End()
 
-	mlog.Debug(context.TODO(), "GetQuerySegmentInfo",
+	mlog.Debug(ctx, "GetQuerySegmentInfo",
 		mlog.String("role", typeutil.ProxyRole),
 		mlog.String("db", req.DbName),
 		mlog.Any("collection", req.CollectionName))
@@ -4654,6 +4660,12 @@ func (node *Proxy) GetQuerySegmentInfo(ctx context.Context, req *milvuspb.GetQue
 
 	method := "GetQuerySegmentInfo"
 	tr := timerecord.NewTimeRecorder(method)
+	req.DbName = GetCurDBNameFromRequestOrContext(ctx, req)
+	ctx, err := node.authorizeCollectionMetadata(ctx, req)
+	if err != nil {
+		resp.Status = merr.Status(err)
+		return resp, nil
+	}
 
 	collID, err := node.GetMetaCache().GetCollectionID(ctx, req.GetDbName(), req.CollectionName)
 	if err != nil {
@@ -4671,12 +4683,12 @@ func (node *Proxy) GetQuerySegmentInfo(ctx context.Context, req *milvuspb.GetQue
 		err = merr.Error(infoResp.GetStatus())
 	}
 	if err != nil {
-		mlog.Error(context.TODO(), "Failed to get segment info from QueryCoord",
+		mlog.Error(ctx, "Failed to get segment info from QueryCoord",
 			mlog.Err(err))
 		resp.Status = merr.Status(err)
 		return resp, nil
 	}
-	mlog.Debug(context.TODO(), "GetQuerySegmentInfo",
+	mlog.Debug(ctx, "GetQuerySegmentInfo",
 		mlog.Any("infos", infoResp.Infos),
 		mlog.Any("status", infoResp.Status))
 	queryInfos := make([]*milvuspb.QuerySegmentInfo, len(infoResp.Infos))
@@ -4929,14 +4941,20 @@ func (node *Proxy) GetReplicas(ctx context.Context, req *milvuspb.GetReplicasReq
 	ctx, sp := otel.Tracer(typeutil.ProxyRole).Start(ctx, "Proxy-GetReplicas")
 	defer sp.End()
 
-	mlog.Debug(context.TODO(), "received get replicas request",
+	mlog.Debug(ctx, "received get replicas request",
 		mlog.Int64("collection", req.GetCollectionID()),
 		mlog.Bool("with shard nodes", req.GetWithShardNodes()))
 	resp := &milvuspb.GetReplicasResponse{}
 	if err := merr.CheckHealthy(node.GetStateCode()); err != nil {
 		resp.Status = merr.Status(err)
 		return resp, nil
 	}
+	req.DbName = GetCurDBNameFromRequestOrContext(ctx, req)
+	ctx, err := node.authorizeCollectionMetadata(ctx, req)
+	if err != nil {
+		resp.Status = merr.Status(err)
+		return resp, nil
+	}
 
 	req.Base = commonpbutil.NewMsgBase(
 		commonpbutil.WithMsgType(commonpb.MsgType_GetReplicas),
@@ -4954,12 +4972,12 @@ func (node *Proxy) GetReplicas(ctx context.Context, req *milvuspb.GetReplicasReq
 
 	r, err := node.mixCoord.GetReplicas(ctx, req)
 	if err != nil {
-		mlog.Warn(context.TODO(), "Failed to get replicas from Query Coordinator",
+		mlog.Warn(ctx, "Failed to get replicas from Query Coordinator",
 			mlog.Err(err))
 		resp.Status = merr.Status(err)
 		return resp, nil
 	}
-	mlog.Debug(context.TODO(), "received get replicas response", mlog.String("resp", r.String()))
+	mlog.Debug(ctx, "received get replicas response", mlog.String("resp", r.String()))
 	return r, nil
 }
 
```

**File**: `internal/proxy/metadata_privilege.go` (added, +88/-0)
```diff
@@ -0,0 +1,88 @@
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
+package proxy
+
+import (
+	"context"
+
+	"github.com/cockroachdb/errors"
+	"google.golang.org/grpc/codes"
+	"google.golang.org/grpc/status"
+
+	"github.com/milvus-io/milvus-proto/go-api/v3/milvuspb"
+	"github.com/milvus-io/milvus/pkg/v3/util/merr"
+)
+
+// These legacy requests have no protobuf privilege annotation. Reuse the
+// existing collection privileges: segment diagnostics expose statistics, while
+// replica diagnostics describe collection loading. Both belong to ReadOnly.
+// Other unannotated methods keep their own public/result-filtered contracts.
+func collectionMetadataPrivilegeRequest(req interface{}) interface{} {
+	switch req := req.(type) {
+	case *milvuspb.GetPersistentSegmentInfoRequest:
+		return &milvuspb.GetCollectionStatisticsRequest{DbName: req.GetDbName(), CollectionName: req.GetCollectionName()}
+	case *milvuspb.GetQuerySegmentInfoRequest:
+		return &milvuspb.GetCollectionStatisticsRequest{DbName: req.GetDbName(), CollectionName: req.GetCollectionName()}
+	case *milvuspb.GetReplicasRequest:
+		return &milvuspb.GetLoadStateRequest{DbName: req.GetDbName(), CollectionName: req.GetCollectionName()}
+	default:
+		return req
+	}
+}
+
+func replicaPrivilegeRequestByID(ctx context.Context, cache Cache, req *milvuspb.GetReplicasRequest) (*milvuspb.GetLoadStateRequest, error) {
+	if req.GetCollectionID() <= 0 {
+		return nil, merr.WrapErrParameterInvalidMsg("collection name or a positive collection ID is required")
+	}
+	if cache == nil {
+		return nil, merr.WrapErrServiceUnavailable("collection metadata cache is not ready")
+	}
+	info, err := cache.GetCollectionInfo(ctx, GetCurDBNameFromRequestOrContext(ctx, req), "", req.GetCollectionID())
+	if err != nil {
+		// Identity resolution runs before authorization. An absent collection or
+		// database must be indistinguishable from an existing, forbidden ID.
+		// Keep operational failures intact so callers can still retry them.
+		if errors.Is(err, merr.ErrCollectionNotFound) || errors.Is(err, merr.ErrDatabaseNotFound) {
+			return nil, replicaPrivilegeDenied()
+		}
+		return nil, err
+	}
+	// IDs are cluster-wide: neither the connection database nor a caller-supplied
+	// DbName establishes which database owns this collection. Older coordinators
+	// can omit the real database; never authorize such an ID against a guessed DB.
+	if info == nil || info.CollID != req.GetCollectionID() || info.DBName == "" || info.Schema == nil || info.Schema.GetName() == "" {
+		return nil, merr.WrapErrServiceUnavailable("cannot resolve collection identity for authorization")
+	}
+	return &milvuspb.GetLoadStateRequest{DbName: info.DBName, CollectionName: info.Schema.GetName()}, nil
+}
+
+func replicaPrivilegeDenied() error {
+	// Do not include the resolved database, collection name, or lookup error:
+	// none of that identity has been authorized for the caller to see.
+	return status.Error(codes.PermissionDenied, "GetReplicas: permission deny")
+}
+
+// Guard the Proxy methods as well as gRPC dispatch: in-process HTTP handlers
+// call these methods directly. Internal coordinator RPCs use a separate service
+// and do not enter these user-facing Proxy methods.
+func (node *Proxy) authorizeCollectionMetadata(ctx context.Context, req interface{}) (context.Context, error) {
+	nextCtx, err := PrivilegeInterceptorWithMetaCache(node.GetMetaCache)(ctx, req)
+	if status.Code(err) == codes.PermissionDenied {
+		return ctx, merr.WrapErrPrivilegeNotPermitted("%s", status.Convert(err).Message())
+	}
+	return nextCtx, err
+}
```

**File**: `internal/proxy/metadata_privilege_test.go` (added, +444/-0)
```diff
@@ -0,0 +1,444 @@
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
+package proxy
+
+import (
+	"context"
+	"testing"
+
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+	"google.golang.org/grpc"
+	"google.golang.org/grpc/codes"
+	"google.golang.org/grpc/status"
+	"google.golang.org/protobuf/proto"
+
+	"github.com/milvus-io/milvus-proto/go-api/v3/commonpb"
+	"github.com/milvus-io/milvus-proto/go-api/v3/milvuspb"
+	"github.com/milvus-io/milvus-proto/go-api/v3/schemapb"
+	"github.com/milvus-io/milvus/internal/proxy/metacache"
+	"github.com/milvus-io/milvus/internal/proxy/privilege"
+	"github.com/milvus-io/milvus/internal/types"
+	"github.com/milvus-io/milvus/pkg/v3/proto/datapb"
+	"github.com/milvus-io/milvus/pkg/v3/proto/internalpb"
+	"github.com/milvus-io/milvus/pkg/v3/proto/querypb"
+	"github.com/milvus-io/milvus/pkg/v3/util"
+	"github.com/milvus-io/milvus/pkg/v3/util/funcutil"
+	"github.com/milvus-io/milvus/pkg/v3/util/merr"
+	"github.com/milvus-io/milvus/pkg/v3/util/paramtable"
+)
+
+type metadataPrivilegeCoordinator struct {
+	types.MixCoordClient
+	policies      []string
+	describeCalls int
+	metadataCalls int
+	collectionIDs []int64
+}
+
+func (c *metadataPrivilegeCoordinator) ListPolicy(context.Context, *internalpb.ListPolicyRequest, ...grpc.CallOption) (*internalpb.ListPolicyResponse, error) {
+	return &internalpb.ListPolicyResponse{
+		Status: merr.Success(), PolicyInfos: c.policies,
+		UserRoles: []string{funcutil.EncodeUserRoleCache("reader", "metadata_reader")},
+	}, nil
+}
+
+func (c *metadataPrivilegeCoordinator) DescribeCollection(_ context.Context, req *milvuspb.DescribeCollectionRequest, _ ...grpc.CallOption) (*milvuspb.DescribeCollectionResponse, error) {
+	c.describeCalls++
+	if req.GetCollectionID() != 41 && req.GetCollectionName() != "records" && req.GetCollectionName() != "records_alias" {
+		return &milvuspb.DescribeCollectionResponse{Status: merr.Status(merr.WrapErrCollectionNotFound("unknown"))}, nil
+	}
+	dbName, collectionID := "tenant_b", int64(41)
+	if req.GetCollectionID() == 0 {
+		dbName = req.GetDbName()
+		switch dbName {
+		case "", util.DefaultDBName:
+			dbName, collectionID = util.DefaultDBName, 42
+		case "tenant_a":
+			collectionID = 43
+		}
+	}
+	return &milvuspb.DescribeCollectionResponse{
+		Status: merr.Success(), CollectionID: collectionID, DbName: dbName,
+		Schema: &schemapb.CollectionSchema{Name: "records"}, Aliases: []string{"records_alias"},
+	}, nil
+}
+
+func (c *metadataPrivilegeCoordinator) GetSegmentsByStates(_ context.Context, req *datapb.GetSegmentsByStatesRequest, _ ...grpc.CallOption) (*datapb.GetSegmentsByStatesResponse, error) {
+	c.metadataCalls++
+	c.collectionIDs = append(c.collectionIDs, req.GetCollectionID())
+	return &datapb.GetSegmentsByStatesResponse{Status: merr.Success()}, nil
+}
+
+func (c *metadataPrivilegeCoordinator) GetSegmentInfo(context.Context, *datapb.GetSegmentInfoRequest, ...grpc.CallOption) (*datapb.GetSegmentInfoResponse, error) {
+	c.metadataCalls++
+	return &datapb.GetSegmentInfoResponse{Status: merr.Success()}, nil
+}
+
+func (c *metadataPrivilegeCoordinator) GetLoadSegmentInfo(_ context.Context, req *querypb.GetSegmentInfoRequest, _ ...grpc.CallOption) (*querypb.GetSegmentInfoResponse, error) {
+	c.metadataCalls++
+	c.collectionIDs = append(c.collectionIDs, req.GetCollectionID())
+	return &querypb.GetSegmentInfoResponse{Status: merr.Success()}, nil
+}
+
+func (c *metadataPrivilegeCoordinator) GetReplicas(_ context.Context, req *milvuspb.GetReplicasRequest, _ ...grpc.CallOption) (*milvuspb.GetReplicasResponse, error) {
+	c.metadataCalls++
+	c.collectionIDs = append(c.collectionIDs, req.GetCollectionID())
+	return &milvuspb.GetReplicasResponse{Status: merr.Success()}, nil
+}
+
+func setupMetadataPrivileges(t *testing.T) (*metadataPrivilegeCoordinator, func(string, ...commonpb.ObjectPrivilege)) {
+	t.Helper()
+	paramtable.Init()
+	for key, value := range map[string]string{
+		Params.CommonCfg.AuthorizationEnabled.Key:    "true",
+		Params.CommonCfg.RootShouldBindRole.Key:      "false",
+		Params.ProxyCfg.ResolveAliasForPrivilege.Key: "false",
+	} {
+		previous, err := paramtable.GetBaseTable().Load(key)
+		require.NoError(t, err)
+		require.NoError(t, P
```

**File**: `internal/proxy/privilege_interceptor.go` (modified, +15/-4)
```diff
@@ -98,7 +98,8 @@ func PrivilegeInterceptorWithMetaCache(GetMetaCache func() Cache) PrivilegeFunc
 			return ctx, nil
 		}
 		mlog.RatedDebug(ctx, rate.Limit(60), "PrivilegeInterceptor", mlog.String("type", reflect.TypeOf(req).String()))
-		privilegeExt, err := funcutil.GetPrivilegeExtObj(req)
+		privilegeReq := collectionMetadataPrivilegeRequest(req)
+		privilegeExt, err := funcutil.GetPrivilegeExtObj(privilegeReq)
 		if err != nil {
 			mlog.RatedInfo(ctx, rate.Limit(60), "GetPrivilegeExtObj err", mlog.Err(err))
 			return ctx, nil
@@ -112,9 +113,15 @@ func PrivilegeInterceptorWithMetaCache(GetMetaCache func() Cache) PrivilegeFunc
 		}
 		username, password, roleNames := subject.username, subject.password, subject.roleNames
 		ctx = SetRBACRolesToContext(ctx, roleNames)
+		if replicas, ok := req.(*milvuspb.GetReplicasRequest); ok && replicas.GetCollectionName() == "" {
+			privilegeReq, err = replicaPrivilegeRequestByID(ctx, GetMetaCache(), replicas)
+			if err != nil {
+				return ctx, err
+			}
+		}
 		objectType := privilegeExt.ObjectType.String()
 		objectNameIndex := privilegeExt.ObjectNameIndex
-		objectName := funcutil.GetObjectName(req, objectNameIndex)
+		objectName := funcutil.GetObjectName(privilegeReq, objectNameIndex)
 		objectPrivilege := privilegeExt.ObjectPrivilege.String()
 		// Resolve resources against the database the request actually reads from,
 		// while keeping the database used by the policy check separate. Alias
@@ -128,7 +135,7 @@ func PrivilegeInterceptorWithMetaCache(GetMetaCache func() Cache) PrivilegeFunc
 		//   - Database-/Collection-level privileges are scoped to the db the request
 		//     targets: the request-body DbName takes precedence, falling back to the
 		//     connection-context db.
-		dbName := GetCurDBNameFromRequestOrContext(ctx, req)
+		dbName := GetCurDBNameFromRequestOrContext(ctx, privilegeReq)
 		policyDBName := dbName
 		if util.GetPrivilegeLevel(util.MetaStore2API(objectPrivilege)) == milvuspb.PrivilegeLevel_Cluster.String() {
 			policyDBName = util.AnyWord
@@ -166,7 +173,7 @@ func PrivilegeInterceptorWithMetaCache(GetMetaCache func() Cache) PrivilegeFunc
 		}
 
 		objectNameIndexs := privilegeExt.ObjectNameIndexs
-		objectNames := funcutil.GetObjectNames(req, objectNameIndexs)
+		objectNames := funcutil.GetObjectNames(privilegeReq, objectNameIndexs)
 
 		// Resolve aliases for operations that refer to multiple resources
 		if Params.ProxyCfg.ResolveAliasForPrivilege.GetAsBool() && objectType == commonpb.ObjectType_Collection.String() && objectNameIndexs != 0 && len(objectNames) > 0 {
@@ -222,6 +229,10 @@ func PrivilegeInterceptorWithMetaCache(GetMetaCache func() Cache) PrivilegeFunc
 
 		log.Info(ctx, "permission deny", mlog.Strings("roles", roleNames))
 
+		if replicas, ok := req.(*milvuspb.GetReplicasRequest); ok && replicas.GetCollectionName() == "" {
+			return ctx, replicaPrivilegeDenied()
+		}
+
 		if password == util.PasswordHolder {
 			username = "apikey user"
 		}
```

**File**: `pkg/util/funcutil/rbac_annotation_coverage_test.go` (modified, +6/-6)
```diff
@@ -79,14 +79,14 @@ var rbacAnnotationAllowlist = map[protoreflect.Name]string{
 	"GetImportState": "legacy import status polling",
 	// GetMetrics is a diagnostics endpoint for system metrics.
 	"GetMetrics": "system metrics diagnostics",
-	// GetPersistentSegmentInfo is a legacy segment diagnostics endpoint.
-	"GetPersistentSegmentInfo": "legacy segment diagnostics",
-	// GetQuerySegmentInfo is a legacy query-segment diagnostics endpoint.
-	"GetQuerySegmentInfo": "legacy query-segment diagnostics",
+	// GetPersistentSegmentInfo explicitly requires collection GetStatistics in Proxy.
+	"GetPersistentSegmentInfo": "explicit collection GetStatistics authorization",
+	// GetQuerySegmentInfo explicitly requires collection GetStatistics in Proxy.
+	"GetQuerySegmentInfo": "explicit collection GetStatistics authorization",
 	// GetRefreshExternalCollectionProgress only polls the state of an external-collection refresh job.
 	"GetRefreshExternalCollectionProgress": "async external-collection refresh status polling",
-	// GetReplicas is a legacy replica-topology diagnostics endpoint.
-	"GetReplicas": "legacy replica diagnostics",
+	// GetReplicas explicitly requires collection GetLoadState, resolving ID-only targets in Proxy.
+	"GetReplicas": "explicit collection GetLoadState authorization",
 	// GetReplicateInfo reports CDC checkpoint metadata for replication recovery.
 	"GetReplicateInfo": "CDC checkpoint diagnostics",
 	// GetRestoreSnapshotState only polls the state of a snapshot restore job.
```

---

### Incident Patch 6: `1211f933` (2026-09-30)
**Commit Message**: feat: [RLS6] enforce row-level security for bulk import (#53911)

relate: #50263
design doc: docs/design-docs/design_docs/20250610-rls_design.md
design doc PR: #53173

## Summary
Enforces row-level security for bulk import by authorizing import
options at Proxy, persisting a trusted policy snapshot with the import
job, and validating imported rows before write.

---------

Signed-off-by: aoiasd <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 4.6 <[REDACTED_EMAIL]>

**File**: `client/bulkwriter/bulk_import.go` (modified, +9/-0)
```diff
@@ -23,6 +23,7 @@ import (
 	"fmt"
 	"io"
 	"net/http"
+	"strconv"
 )
 
 // ResponseBase is the common milvus restful response struct.
@@ -67,6 +68,14 @@ func (opt *BulkImportOption) WithPartition(partitionName string) *BulkImportOpti
 	return opt
 }
 
+func (opt *BulkImportOption) WithRLSPrincipal(principal string) *BulkImportOption {
+	return opt.WithOption("rls_principal", principal)
+}
+
+func (opt *BulkImportOption) WithSkipRLS(skip bool) *BulkImportOption {
+	return opt.WithOption("skip_rls", strconv.FormatBool(skip))
+}
+
 func (opt *BulkImportOption) WithAPIKey(key string) *BulkImportOption {
 	opt.APIKey = key
 	return opt
```

**File**: `client/bulkwriter/bulk_import_test.go` (modified, +17/-0)
```diff
@@ -82,6 +82,23 @@ func (s *BulkImportSuite) TestBulkImport() {
 	})
 }
 
+func (s *BulkImportSuite) TestBulkImportRLSOptions() {
+	request, err := NewBulkImportOption("http://localhost", "hello_milvus", [][]string{{"files/a.json"}}).
+		WithRLSPrincipal("alice").
+		WithSkipRLS(true).
+		GetRequest()
+
+	s.NoError(err)
+	s.JSONEq(`{
+		"collectionName": "hello_milvus",
+		"files": [["files/a.json"]],
+		"options": {
+			"rls_principal": "alice",
+			"skip_rls": "true"
+		}
+	}`, string(request))
+}
+
 func (s *BulkImportSuite) TestListImportJobs() {
 	s.Run("normal_case", func() {
 		svr := httptest.NewServer(http.HandlerFunc(func(rw http.ResponseWriter, req *http.Request) {
```

**File**: `client/milvusclient/iterator_option.go` (modified, +24/-0)
```diff
@@ -75,6 +75,16 @@ func (opt *searchIteratorOption) WithNamespace(namespace string) *searchIterator
 	return opt
 }
 
+func (opt *searchIteratorOption) WithRLSPrincipal(principal string) *searchIteratorOption {
+	opt.searchOption.WithRLSPrincipal(principal)
+	return opt
+}
+
+func (opt *searchIteratorOption) WithSkipRLS(skip bool) *searchIteratorOption {
+	opt.searchOption.WithSkipRLS(skip)
+	return opt
+}
+
 func (opt *searchIteratorOption) WithFilter(expr string) *searchIteratorOption {
 	opt.annRequest.WithFilter(expr)
 	return opt
@@ -172,6 +182,8 @@ type queryIteratorOption struct {
 	collectionName             string
 	partitionNames             []string
 	namespace                  *string
+	rlsPrincipal               string
+	skipRLS                    bool
 	outputFields               []string
 	expr                       string
 	batchSize                  int
@@ -185,6 +197,8 @@ func (opt *queryIteratorOption) Request() (*milvuspb.QueryRequest, error) {
 		CollectionName:        opt.collectionName,
 		PartitionNames:        opt.partitionNames,
 		Namespace:             opt.namespace,
+		RlsPrincipal:          opt.rlsPrincipal,
+		SkipRls:               opt.skipRLS,
 		OutputFields:          opt.outputFields,
 		Expr:                  opt.expr,
 		ConsistencyLevel:      opt.consistencyLevel.CommonConsistencyLevel(),
@@ -223,6 +237,16 @@ func (opt *queryIteratorOption) WithNamespace(namespace string) *queryIteratorOp
 	return opt
 }
 
+func (opt *queryIteratorOption) WithRLSPrincipal(principal string) *queryIteratorOption {
+	opt.rlsPrincipal = principal
+	return opt
+}
+
+func (opt *queryIteratorOption) WithSkipRLS(skip bool) *queryIteratorOption {
+	opt.skipRLS = skip
+	return opt
+}
+
 func (opt *queryIteratorOption) WithFilter(expr string) *queryIteratorOption {
 	opt.expr = expr
 	return opt
```

**File**: `client/milvusclient/iterator_test.go` (modified, +23/-0)
```diff
@@ -59,6 +59,17 @@ func (s *SearchIteratorSuite) TestSearchIteratorOptionWithNamespace() {
 	s.Equal(namespace, req.GetNamespace())
 }
 
+func (s *SearchIteratorSuite) TestSearchIteratorOptionWithRLSContext() {
+	opt := NewSearchIteratorOption("coll", entity.FloatVector(lo.RepeatBy(128, func(_ int) float32 {
+		return rand.Float32()
+	}))).WithRLSPrincipal("alice").WithSkipRLS(true).WithBatchSize(10)
+	req, err := opt.SearchOption().Request()
+
+	s.Require().NoError(err)
+	s.Equal("alice", req.GetRlsPrincipal())
+	s.True(req.GetSkipRls())
+}
+
 func (s *SearchIteratorSuite) TestSearchIteratorInit() {
 	ctx := context.Background()
 	s.Run("success", func() {
@@ -452,6 +463,18 @@ func (s *QueryIteratorSuite) TestQueryIteratorOptionWithNamespace() {
 	s.Equal(namespace, req.GetNamespace())
 }
 
+func (s *QueryIteratorSuite) TestQueryIteratorOptionWithRLSContext() {
+	req, err := NewQueryIteratorOption("coll").
+		WithRLSPrincipal("alice").
+		WithSkipRLS(true).
+		WithBatchSize(10).
+		Request()
+
+	s.Require().NoError(err)
+	s.Equal("alice", req.GetRlsPrincipal())
+	s.True(req.GetSkipRls())
+}
+
 func (s *QueryIteratorSuite) TestQueryIteratorInit() {
 	ctx := context.Background()
 	s.Run("success", func() {
```

**File**: `client/milvusclient/read_option_test.go` (modified, +31/-0)
```diff
@@ -255,6 +255,37 @@ func (s *SearchOptionSuite) TestWithNamespace() {
 	s.Equal(namespace, hybridReq.GetNamespace())
 }
 
+func (s *SearchOptionSuite) TestWithRLSContext() {
+	const principal = "alice"
+	vector := entity.FloatVector([]float32{0.1, 0.2})
+
+	searchReq, err := NewSearchOption("collection", 10, []entity.Vector{vector}).
+		WithRLSPrincipal(principal).
+		WithSkipRLS(true).
+		Request()
+	s.Require().NoError(err)
+	s.Equal(principal, searchReq.GetRlsPrincipal())
+	s.True(searchReq.GetSkipRls())
+
+	hybridReq, err := NewHybridSearchOption("collection", 10, NewAnnRequest("vector", 10, vector)).
+		WithRLSPrincipal(principal).
+		WithSkipRLS(true).
+		HybridRequest()
+	s.Require().NoError(err)
+	s.Equal(principal, hybridReq.GetRlsPrincipal())
+	s.True(hybridReq.GetSkipRls())
+	s.Empty(hybridReq.GetRequests()[0].GetRlsPrincipal())
+	s.False(hybridReq.GetRequests()[0].GetSkipRls())
+
+	queryReq, err := NewQueryOption("collection").
+		WithRLSPrincipal(principal).
+		WithSkipRLS(true).
+		Request()
+	s.Require().NoError(err)
+	s.Equal(principal, queryReq.GetRlsPrincipal())
+	s.True(queryReq.GetSkipRls())
+}
+
 func (s *SearchOptionSuite) TestQueryOrderByFields() {
 	collName := "query_order_by"
 
```

**File**: `client/milvusclient/read_options.go` (modified, +42/-0)
```diff
@@ -61,6 +61,8 @@ type searchOption struct {
 	collectionName             string
 	partitionNames             []string
 	namespace                  *string
+	rlsPrincipal               string
+	skipRLS                    bool
 	outputFields               []string
 	searchAggregation          *SearchAggregation
 	consistencyLevel           entity.ConsistencyLevel
@@ -410,6 +412,8 @@ func (opt *searchOption) Request() (*milvuspb.SearchRequest, error) {
 	request.CollectionName = opt.collectionName
 	request.PartitionNames = opt.partitionNames
 	request.Namespace = opt.namespace
+	request.RlsPrincipal = opt.rlsPrincipal
+	request.SkipRls = opt.skipRLS
 	request.ConsistencyLevel = commonpb.ConsistencyLevel(opt.consistencyLevel)
 	request.UseDefaultConsistency = opt.useDefaultConsistencyLevel
 	request.OutputFields = opt.outputFields
@@ -449,6 +453,16 @@ func (opt *searchOption) WithNamespace(namespace string) *searchOption {
 	return opt
 }
 
+func (opt *searchOption) WithRLSPrincipal(principal string) *searchOption {
+	opt.rlsPrincipal = principal
+	return opt
+}
+
+func (opt *searchOption) WithSkipRLS(skip bool) *searchOption {
+	opt.skipRLS = skip
+	return opt
+}
+
 func (opt *searchOption) WithFilter(expr string) *searchOption {
 	opt.annRequest.WithFilter(expr)
 	return opt
@@ -623,6 +637,8 @@ type hybridSearchOption struct {
 	collectionName string
 	partitionNames []string
 	namespace      *string
+	rlsPrincipal   string
+	skipRLS        bool
 
 	reqs []*AnnRequest
 
@@ -657,6 +673,16 @@ func (opt *hybridSearchOption) WithNamespace(namespace string) *hybridSearchOpti
 	return opt
 }
 
+func (opt *hybridSearchOption) WithRLSPrincipal(principal string) *hybridSearchOption {
+	opt.rlsPrincipal = principal
+	return opt
+}
+
+func (opt *hybridSearchOption) WithSkipRLS(skip bool) *hybridSearchOption {
+	opt.skipRLS = skip
+	return opt
+}
+
 func (opt *hybridSearchOption) WithOutputFields(outputFields ...string) *hybridSearchOption {
 	opt.outputFields = outputFields
 	return opt
@@ -720,6 +746,8 @@ func (opt *hybridSearchOption) HybridRequest() (*milvuspb.HybridSearchRequest, e
 		CollectionName:        opt.collectionName,
 		PartitionNames:        opt.partitionNames,
 		Namespace:             opt.namespace,
+		RlsPrincipal:          opt.rlsPrincipal,
+		SkipRls:               opt.skipRLS,
 		Requests:              requests,
 		UseDefaultConsistency: opt.useDefaultConsistency,
 		ConsistencyLevel:      commonpb.ConsistencyLevel(opt.consistencyLevel),
@@ -754,6 +782,8 @@ type queryOption struct {
 	collectionName             string
 	partitionNames             []string
 	namespace                  *string
+	rlsPrincipal               string
+	skipRLS                    bool
 	queryParams                map[string]string
 	outputFields               []string
 	consistencyLevel           entity.ConsistencyLevel
@@ -770,6 +800,8 @@ func (opt *queryOption) Request() (*milvuspb.QueryRequest, error) {
 		CollectionName: opt.collectionName,
 		PartitionNames: opt.partitionNames,
 		Namespace:      opt.namespace,
+		RlsPrincipal:   opt.rlsPrincipal,
+		SkipRls:        opt.skipRLS,
 		OutputFields:   opt.outputFields,
 
 		Expr:                  opt.expr,
@@ -858,6 +890,16 @@ func (opt *queryOption) WithNamespace(namespace string) *queryOption {
 	return opt
 }
 
+func (opt *queryOption) WithRLSPrincipal(principal string) *queryOption {
+	opt.rlsPrincipal = principal
+	return opt
+}
+
+func (opt *queryOption) WithSkipRLS(skip bool) *queryOption {
+	opt.skipRLS = skip
+	return opt
+}
+
 func (opt *queryOption) WithIDs(ids column.Column) *queryOption {
 	opt.expr = pks2Expr(ids)
 	return opt
```

**File**: `client/milvusclient/write_option_test.go` (modified, +44/-0)
```diff
@@ -60,6 +60,40 @@ func (s *ColumnBasedDataOptionSuite) TestWithIdempotencyKey() {
 	s.Empty(NewColumnBasedInsertOption("c", column.NewColumnInt64("id", []int64{1})).IdempotencyKey())
 }
 
+func (s *ColumnBasedDataOptionSuite) TestWithRLSContext() {
+	const principal = "alice"
+	coll := &entity.Collection{
+		Schema: entity.NewSchema().WithField(entity.NewField().WithName("id").WithDataType(entity.FieldTypeInt64)),
+	}
+
+	columnOpt := NewColumnBasedInsertOption("c", column.NewColumnInt64("id", []int64{1})).
+		WithRLSPrincipal(principal).
+		WithSkipRLS(true)
+	insertReq, err := columnOpt.InsertRequest(coll)
+	s.Require().NoError(err)
+	s.Equal(principal, insertReq.GetRlsPrincipal())
+	s.True(insertReq.GetSkipRls())
+
+	upsertReq, err := columnOpt.UpsertRequest(coll)
+	s.Require().NoError(err)
+	s.Equal(principal, upsertReq.GetRlsPrincipal())
+	s.True(upsertReq.GetSkipRls())
+
+	rowOpt := NewRowBasedInsertOption("c", map[string]any{"id": int64(1)}).
+		WithRLSPrincipal(principal).
+		WithSkipRLS(true).
+		WithPartialUpdate(true)
+	insertReq, err = rowOpt.InsertRequest(coll)
+	s.Require().NoError(err)
+	s.Equal(principal, insertReq.GetRlsPrincipal())
+	s.True(insertReq.GetSkipRls())
+
+	upsertReq, err = rowOpt.UpsertRequest(coll)
+	s.Require().NoError(err)
+	s.Equal(principal, upsertReq.GetRlsPrincipal())
+	s.True(upsertReq.GetSkipRls())
+}
+
 func (s *ColumnBasedDataOptionSuite) TestUpsertRejectsIdempotencyKey() {
 	coll := &entity.Collection{
 		Schema: entity.NewSchema().WithField(entity.NewField().WithName("id").WithDataType(entity.FieldTypeInt64)),
@@ -402,6 +436,16 @@ func (s *DeleteOptionSuite) TestWithNamespace() {
 	s.Equal(namespace, req.GetNamespace())
 }
 
+func (s *DeleteOptionSuite) TestWithRLSContext() {
+	req, err := NewDeleteOption("collection").
+		WithRLSPrincipal("alice").
+		WithSkipRLS(true).
+		Request()
+	s.Require().NoError(err)
+	s.Equal("alice", req.GetRlsPrincipal())
+	s.True(req.GetSkipRls())
+}
+
 func (s *DeleteOptionSuite) TestWithTemplateParam() {
 	blob, err := NewRoaringBitmapBlob([]int64{-1, 0, 42})
 	s.Require().NoError(err)
```

**File**: `client/milvusclient/write_options.go` (modified, +44/-0)
```diff
@@ -57,6 +57,8 @@ type columnBasedDataOption struct {
 	collName      string
 	partitionName string
 	namespace     *string
+	rlsPrincipal  string
+	skipRLS       bool
 	columns       []column.Column
 	partialUpdate bool
 
@@ -365,6 +367,16 @@ func (opt *columnBasedDataOption) WithNamespace(namespace string) *columnBasedDa
 	return opt
 }
 
+func (opt *columnBasedDataOption) WithRLSPrincipal(principal string) *columnBasedDataOption {
+	opt.rlsPrincipal = principal
+	return opt
+}
+
+func (opt *columnBasedDataOption) WithSkipRLS(skip bool) *columnBasedDataOption {
+	opt.skipRLS = skip
+	return opt
+}
+
 func (opt *columnBasedDataOption) WithPartialUpdate(partialUpdate bool) *columnBasedDataOption {
 	opt.partialUpdate = partialUpdate
 	return opt
@@ -483,6 +495,8 @@ func (opt *columnBasedDataOption) InsertRequest(coll *entity.Collection) (*milvu
 		CollectionName:  opt.collName,
 		PartitionName:   opt.partitionName,
 		Namespace:       opt.namespace,
+		RlsPrincipal:    opt.rlsPrincipal,
+		SkipRls:         opt.skipRLS,
 		FieldsData:      fieldsData,
 		NumRows:         uint32(rowNum),
 		SchemaTimestamp: coll.UpdateTimestamp,
@@ -512,6 +526,8 @@ func (opt *columnBasedDataOption) UpsertRequest(coll *entity.Collection) (*milvu
 		CollectionName:  opt.collName,
 		PartitionName:   opt.partitionName,
 		Namespace:       opt.namespace,
+		RlsPrincipal:    opt.rlsPrincipal,
+		SkipRls:         opt.skipRLS,
 		FieldsData:      fieldsData,
 		NumRows:         uint32(rowNum),
 		SchemaTimestamp: coll.UpdateTimestamp,
@@ -556,6 +572,16 @@ func (opt *rowBasedDataOption) WithNamespace(namespace string) *rowBasedDataOpti
 	return opt
 }
 
+func (opt *rowBasedDataOption) WithRLSPrincipal(principal string) *rowBasedDataOption {
+	opt.columnBasedDataOption.WithRLSPrincipal(principal)
+	return opt
+}
+
+func (opt *rowBasedDataOption) WithSkipRLS(skip bool) *rowBasedDataOption {
+	opt.columnBasedDataOption.WithSkipRLS(skip)
+	return opt
+}
+
 func (opt *rowBasedDataOption) WithPartialUpdate(partialUpdate bool) *rowBasedDataOption {
 	opt.columnBasedDataOption.WithPartialUpdate(partialUpdate)
 	return opt
@@ -598,6 +624,8 @@ func (opt *rowBasedDataOption) InsertRequest(coll *entity.Collection) (*milvuspb
 		CollectionName: opt.collName,
 		PartitionName:  opt.partitionName,
 		Namespace:      opt.namespace,
+		RlsPrincipal:   opt.rlsPrincipal,
+		SkipRls:        opt.skipRLS,
 		FieldsData:     fieldsData,
 		NumRows:        uint32(rowNum),
 	}, nil
@@ -635,6 +663,8 @@ func (opt *rowBasedDataOption) UpsertRequest(coll *entity.Collection) (*milvuspb
 		CollectionName: opt.collName,
 		PartitionName:  opt.partitionName,
 		Namespace:      opt.namespace,
+		RlsPrincipal:   opt.rlsPrincipal,
+		SkipRls:        opt.skipRLS,
 		FieldsData:     fieldsData,
 		NumRows:        uint32(rowNum),
 		PartialUpdate:  partialUpdate,
@@ -789,6 +819,8 @@ type deleteOption struct {
 	collectionName string
 	partitionName  string
 	namespace      *string
+	rlsPrincipal   string
+	skipRLS        bool
 	expr           string
 	templateParams map[string]any
 }
@@ -798,6 +830,8 @@ func (opt *deleteOption) Request() (*milvuspb.DeleteRequest, error) {
 		CollectionName: opt.collectionName,
 		PartitionName:  opt.partitionName,
 		Namespace:      opt.namespace,
+		RlsPrincipal:   opt.rlsPrincipal,
+		SkipRls:        opt.skipRLS,
 		Expr:           opt.expr,
 	}
 	req.ExprTemplateValues = make(map[string]*schemapb.TemplateValue, len(opt.templateParams))
@@ -849,6 +883,16 @@ func (opt *deleteOption) WithNamespace(namespace string) *deleteOption {
 	return opt
 }
 
+func (opt *deleteOption) WithRLSPrincipal(principal string) *deleteOption {
+	opt.rlsPrincipal = principal
+	return opt
+}
+
+func (opt *deleteOption) WithSkipRLS(skip bool) *deleteOption {
+	opt.skipRLS = skip
+	return opt
+}
+
 func NewDeleteOption(collectionName string) *deleteOption {
 	return &deleteOption{
 		collectionName: collectionName,
```

---

### Incident Patch 7: `a46f0acf` (2026-09-30)
**Commit Message**: fix: Keep manifest-only segments in query recovery targets (#53781)

issue: #53778

Recovered V3 segments can have a committed manifest but no fake binlogs
or segment positions. The empty-segment guard previously discarded them,
leaving channel-only targets that could report load completion without
loading data.

Validate manifests before the empty-segment guard. Malformed V3
manifests produce an individual `mlog.Warn` with the segment ID and
parse error and are skipped, including segments with binlogs or
positions. Warnings are not rate-limited, so a burst of invalid
manifests does not suppress affected segment IDs. When positions and
binlogs are absent, only a committed V3 manifest (version > 0) may pass;
earliest/latest placeholders remain excluded. The recovery RPC interface
is unchanged.

Validation before the latest rebase and logging-only follow-up
(`f8e7446`):
- Reused this worktree's validated master C++ build; native build inputs
are unchanged.
- 17 recovery cases and 6 committed-manifest helper cases pass using `go
test -tags dynamic,test -gcflags="all=-N -l" -count=1
-coverprofile=<branch>-coverage.out
github.com/milvus-io/milvus/internal/datacoord -run
'^(TestGetRecove

**File**: `internal/datacoord/handler.go` (modified, +7/-1)
```diff
@@ -171,7 +171,13 @@ func (h *ServerHandler) GetQueryVChanPositions(channel RWChannel, partitionIDs .
 		if filterWithPartition && !validPartitionsMap[s.GetPartitionID()] {
 			continue
 		}
-		if s.GetStartPosition() == nil && s.GetDmlPosition() == nil && len(s.GetBinlogs()) == 0 {
+		committed, err := hasCommittedManifest(s)
+		if err != nil {
+			mlog.Warn(h.s.ctx, "skip segment with invalid manifest during query recovery",
+				mlog.FieldSegmentID(s.GetID()), mlog.Err(err))
+			continue
+		}
+		if !committed && s.GetStartPosition() == nil && s.GetDmlPosition() == nil && len(s.GetBinlogs()) == 0 {
 			continue
 		}
 		if s.GetIsImporting() {
```

**File**: `internal/datacoord/services_test.go` (modified, +138/-1)
```diff
@@ -1979,6 +1979,143 @@ func TestGetRecoveryInfoV2(t *testing.T) {
 	})
 }
 
+func TestGetRecoveryInfoV2_ManifestOnlySegment(t *testing.T) {
+	const (
+		collectionID = int64(1)
+		partitionID  = int64(2)
+		segmentID    = int64(100)
+		channelName  = "recovery_manifest_v0"
+	)
+	manifestPath := packed.MarshalManifestPath("files/binlogs/1/2/100", 1)
+	ctx := context.Background()
+	channel := &channelMeta{Name: channelName, CollectionID: collectionID}
+	checkpoint := &msgpb.MsgPosition{ChannelName: channelName, MsgID: []byte{1}, Timestamp: 10}
+	channelsMock := mockey.Mock((*Server).getChannelsByCollectionID).Return([]RWChannel{channel}, nil).Build()
+	defer channelsMock.UnPatch()
+	indexMock := mockey.Mock(FilterInIndexedSegments).Return([]*SegmentInfo(nil)).Build()
+	defer indexMock.UnPatch()
+
+	for _, test := range []struct {
+		name          string
+		prepare       func(*datapb.SegmentInfo)
+		wantFlushed   bool
+		wantGrowing   bool
+		wantRecovered bool
+	}{
+		{name: "manifest_only", wantFlushed: true, wantRecovered: true},
+		{name: "earliest_flushed", prepare: func(seg *datapb.SegmentInfo) {
+			seg.ManifestPath = packed.MarshalManifestPath("files/binlogs/1/2/100", packed.ManifestEarliest)
+		}},
+		{name: "earliest_growing", prepare: func(seg *datapb.SegmentInfo) {
+			seg.State = commonpb.SegmentState_Growing
+			seg.NumOfRows = 0
+			seg.ManifestPath = packed.MarshalManifestPath("files/binlogs/1/2/100", packed.ManifestEarliest)
+		}},
+		{name: "committed_growing", prepare: func(seg *datapb.SegmentInfo) {
+			seg.State = commonpb.SegmentState_Growing
+		}, wantGrowing: true},
+		{name: "latest_placeholder", prepare: func(seg *datapb.SegmentInfo) {
+			seg.ManifestPath = packed.MarshalManifestPath("files/binlogs/1/2/100", packed.ManifestLatest)
+		}},
+		{name: "invalid_manifest", prepare: func(seg *datapb.SegmentInfo) {
+			seg.ManifestPath = "invalid"
+		}},
+		{name: "invalid_manifest_with_binlog", prepare: func(seg *datapb.SegmentInfo) {
+			seg.ManifestPath = "invalid"
+			seg.Binlogs = []*datapb.FieldBinlog{{FieldID: 100, Binlogs: []*datapb.Binlog{{EntriesNum: 50}}}}
+		}},
+		{name: "invalid_manifest_with_start_position", prepare: func(seg *datapb.SegmentInfo) {
+			seg.ManifestPath = "invalid"
+			seg.StartPosition = checkpoint
+		}},
+		{name: "invalid_manifest_with_dml_position", prepare: func(seg *datapb.SegmentInfo) {
+			seg.ManifestPath = "invalid"
+			seg.DmlPosition = checkpoint
+		}},
+		{name: "non_v3_manifest", prepare: func(seg *datapb.SegmentInfo) {
+			seg.StorageVersion = storage.StorageV2
+		}},
+		{name: "empty", prepare: func(seg *datapb.SegmentInfo) { seg.ManifestPath = "" }},
+		{name: "legacy_binlog", prepare: func(seg *datapb.SegmentInfo) {
+			seg.ManifestPath = ""
+			seg.StorageVersion = storage.StorageV2
+			seg.Binlogs = []*datapb.FieldBinlog{{FieldID: 100, Binlogs: []*datapb.Binlog{{EntriesNum: 50}}}}
+		}, wantFlushed: true, wantRecovered: true},
+		{name: "start_position_only", prepare: func(seg *datapb.SegmentInfo) {
+			seg.ManifestPath = ""
+			seg.StartPosition = checkpoint
+		}, wantFlushed: true},
+		{name: "dml_position_only", prepare: func(seg *datapb.SegmentInfo) {
+			seg.ManifestPath = ""
+			seg.DmlPosition = checkpoint
+		}, wantFlushed: true},
+		{name: "importing", prepare: func(seg *datapb.SegmentInfo) { seg.IsImporting = true }},
+		{name: "other_partition", prepare: func(seg *datapb.SegmentInfo) { seg.PartitionID++ }},
+		{name: "invisible_compaction", prepare: func(seg *datapb.SegmentInfo) {
+			seg.IsInvisible = true
+			seg.CreatedByCompaction = true
+		}},
+	} {
+		t.Run(test.name, func(t *testing.T) {
+			// Model metadata recovered after fake binlogs were omitted from persistence.
+			seg := &datapb.SegmentInfo{
+				ID:             segmentID,
+				CollectionID:   collectionID,
+				PartitionID:    partitionID,
+				InsertChannel:  channelName,
+				State:          commonpb.SegmentState_Flushed,
+				Level:          datapb.SegmentLevel_L1,
+				StorageVersion: storage.StorageV3,
+				NumOfRows:      50,
+				ManifestPath:   manifestPath,
+			}
+			if test.prepare != nil {
+				test.prepare(seg)
+			}
+			svr := &Server{
+				ctx: ctx,
+				meta: &meta{
+					segments:           NewSegmentsInfo(),
+					partitionStatsMeta: &partitionStatsMeta{},
+					channelCPs:         newChannelCps(),
+				},
+			}
+			svr.meta.channelCPs.checkpoints[channelName] = checkpoint
+			svr.stateCode.Store(commonpb.StateCode_Healthy)
+			svr.meta.segments.SetSegment(segmentID, NewSegmentInfo(seg))
+			svr.handler = &ServerHandler{s: svr}
+
+			// Keep both the channel filtering and recovery response construction real.
+			resp, err := svr.GetRecoveryInfoV2(ctx, &datapb.GetRecoveryInfoRequestV2{
+				CollectionID: collectionID,
+				PartitionIDs: []int64{partitionID},
+			})
+			require.NoError(t, err)
+			require.NoError(t, merr.Error(resp.GetStatus()))
+			require.Len(t, resp.GetChannels(), 1)
+			assert.Equal(t, checkpoint, resp.GetChannels()[0].GetSeekPo
```

---

### Incident Patch 8: `03516008` (2026-09-29)
**Commit Message**: feat: [RLS4] enforce row-level security (#52075)

relate: #50263
design doc: docs/design-docs/design_docs/20250610-rls_design.md
design doc PR: #53173

## Summary
Enforces RLS across query, search, delete, insert, and upsert, including
privileged `skip_rls`.

---------

Signed-off-by: aoiasd <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 4.6 <[REDACTED_EMAIL]>

**File**: `internal/distributed/proxy/httpserver/handler_v1.go` (modified, +16/-0)
```diff
@@ -519,6 +519,8 @@ func (h *HandlersV1) query(c *gin.Context) {
 	req := &milvuspb.QueryRequest{
 		DbName:             httpReq.DbName,
 		CollectionName:     httpReq.CollectionName,
+		RlsPrincipal:       httpReq.RlsPrincipal,
+		SkipRls:            httpReq.SkipRls,
 		Expr:               httpReq.Filter,
 		OutputFields:       httpReq.OutputFields,
 		GuaranteeTimestamp: BoundedTimestamp,
@@ -591,6 +593,8 @@ func (h *HandlersV1) get(c *gin.Context) {
 	req := &milvuspb.QueryRequest{
 		DbName:             httpReq.DbName,
 		CollectionName:     httpReq.CollectionName,
+		RlsPrincipal:       httpReq.RlsPrincipal,
+		SkipRls:            httpReq.SkipRls,
 		OutputFields:       httpReq.OutputFields,
 		GuaranteeTimestamp: BoundedTimestamp,
 	}
@@ -670,6 +674,8 @@ func (h *HandlersV1) delete(c *gin.Context) {
 	req := &milvuspb.DeleteRequest{
 		DbName:         httpReq.DbName,
 		CollectionName: httpReq.CollectionName,
+		RlsPrincipal:   httpReq.RlsPrincipal,
+		SkipRls:        httpReq.SkipRls,
 	}
 	c.Set(ContextRequest, req)
 	username, _ := c.Get(ContextUsername)
@@ -734,6 +740,8 @@ func (h *HandlersV1) insert(c *gin.Context) {
 		}
 		httpReq.DbName = singleInsertReq.DbName
 		httpReq.CollectionName = singleInsertReq.CollectionName
+		httpReq.RlsPrincipal = singleInsertReq.RlsPrincipal
+		httpReq.SkipRls = singleInsertReq.SkipRls
 		httpReq.Data = []map[string]interface{}{singleInsertReq.Data}
 	}
 	if httpReq.CollectionName == "" || httpReq.Data == nil {
@@ -747,6 +755,8 @@ func (h *HandlersV1) insert(c *gin.Context) {
 	req := &milvuspb.InsertRequest{
 		DbName:         httpReq.DbName,
 		CollectionName: httpReq.CollectionName,
+		RlsPrincipal:   httpReq.RlsPrincipal,
+		SkipRls:        httpReq.SkipRls,
 		NumRows:        uint32(len(httpReq.Data)),
 	}
 	c.Set(ContextRequest, req)
@@ -834,6 +844,8 @@ func (h *HandlersV1) upsert(c *gin.Context) {
 		}
 		httpReq.DbName = singleUpsertReq.DbName
 		httpReq.CollectionName = singleUpsertReq.CollectionName
+		httpReq.RlsPrincipal = singleUpsertReq.RlsPrincipal
+		httpReq.SkipRls = singleUpsertReq.SkipRls
 		httpReq.Data = []map[string]interface{}{singleUpsertReq.Data}
 		httpReq.PartialUpdate = singleUpsertReq.PartialUpdate
 		httpReq.FieldOps = singleUpsertReq.FieldOps
@@ -849,6 +861,8 @@ func (h *HandlersV1) upsert(c *gin.Context) {
 	req := &milvuspb.UpsertRequest{
 		DbName:         httpReq.DbName,
 		CollectionName: httpReq.CollectionName,
+		RlsPrincipal:   httpReq.RlsPrincipal,
+		SkipRls:        httpReq.SkipRls,
 		NumRows:        uint32(len(httpReq.Data)),
 		PartialUpdate:  httpReq.PartialUpdate,
 	}
@@ -967,6 +981,8 @@ func (h *HandlersV1) search(c *gin.Context) {
 	req := &milvuspb.SearchRequest{
 		DbName:         httpReq.DbName,
 		CollectionName: httpReq.CollectionName,
+		RlsPrincipal:   httpReq.RlsPrincipal,
+		SkipRls:        httpReq.SkipRls,
 		Dsl:            httpReq.Filter,
 		SearchInput: &milvuspb.SearchRequest_PlaceholderGroup{
 			PlaceholderGroup: vectors2PlaceholderGroupBytes([][]float32{httpReq.Vector}),
```

**File**: `internal/distributed/proxy/httpserver/handler_v1_test.go` (modified, +63/-0)
```diff
@@ -715,6 +715,69 @@ func genGetRequest() *http.Request {
 	return req
 }
 
+func TestRESTV1ForwardsRLSFields(t *testing.T) {
+	paramtable.Init()
+	require.NoError(t, paramtable.Get().Save(paramtable.Get().QuotaConfig.QuotaAndLimitsEnabled.Key, "false"))
+	t.Cleanup(func() {
+		require.NoError(t, paramtable.Get().Reset(paramtable.Get().QuotaConfig.QuotaAndLimitsEnabled.Key))
+	})
+
+	matchesRLS := func(req interface {
+		GetRlsPrincipal() string
+		GetSkipRls() bool
+	},
+	) bool {
+		return req.GetRlsPrincipal() == "alice" && req.GetSkipRls()
+	}
+	mp := mocks.NewMockProxy(t)
+	mp.EXPECT().DescribeCollection(mock.Anything, mock.Anything).Return(&DefaultDescCollectionResp, nil).Times(4)
+	mp.EXPECT().Query(mock.Anything, mock.MatchedBy(func(req *milvuspb.QueryRequest) bool {
+		return matchesRLS(req)
+	})).Return(&milvuspb.QueryResults{Status: &StatusSuccess}, nil).Twice()
+	mp.EXPECT().Delete(mock.Anything, mock.MatchedBy(func(req *milvuspb.DeleteRequest) bool {
+		return matchesRLS(req)
+	})).Return(&milvuspb.MutationResult{Status: &StatusSuccess}, nil).Once()
+	mp.EXPECT().Insert(mock.Anything, mock.MatchedBy(func(req *milvuspb.InsertRequest) bool {
+		return matchesRLS(req)
+	})).Return(&milvuspb.MutationResult{
+		Status: &StatusSuccess, IDs: genIDs(schemapb.DataType_Int64), InsertCnt: 1,
+	}, nil).Once()
+	mp.EXPECT().Upsert(mock.Anything, mock.MatchedBy(func(req *milvuspb.UpsertRequest) bool {
+		return matchesRLS(req)
+	})).Return(&milvuspb.MutationResult{
+		Status: &StatusSuccess, IDs: genIDs(schemapb.DataType_Int64), UpsertCnt: 1,
+	}, nil).Once()
+	mp.EXPECT().Search(mock.Anything, mock.MatchedBy(func(req *milvuspb.SearchRequest) bool {
+		return matchesRLS(req)
+	})).Return(&milvuspb.SearchResults{
+		Status: &StatusSuccess, Results: &schemapb.SearchResultData{},
+	}, nil).Once()
+
+	engine := initHTTPServer(mp, false)
+	send := func(path, body string) {
+		t.Helper()
+		w := httptest.NewRecorder()
+		engine.ServeHTTP(w, httptest.NewRequest(http.MethodPost, versional(path), strings.NewReader(body)))
+		require.Equal(t, http.StatusOK, w.Code, w.Body.String())
+	}
+	row := generateSearchResult(schemapb.DataType_Int64)[0]
+	data, err := json.Marshal(map[string]interface{}{
+		HTTPCollectionName: DefaultCollectionName,
+		HTTPReturnData:     row,
+		"rlsPrincipal":     "alice",
+		"skipRls":          true,
+	})
+	require.NoError(t, err)
+
+	send(VectorQueryPath, `{"collectionName":"book","filter":"book_id > 0","rlsPrincipal":"alice","skipRls":true}`)
+	send(VectorGetPath, `{"collectionName":"book","id":[1],"rlsPrincipal":"alice","skipRls":true}`)
+	send(VectorDeletePath, `{"collectionName":"book","filter":"book_id in [1]","rlsPrincipal":"alice","skipRls":true}`)
+	// Object-form data exercises the single-row Insert/Upsert fallback copies.
+	send(VectorInsertPath, string(data))
+	send(VectorUpsertPath, string(data))
+	send(VectorSearchPath, `{"collectionName":"book","vector":[0.1,0.2],"rlsPrincipal":"alice","skipRls":true}`)
+}
+
 func TestDelete(t *testing.T) {
 	paramtable.Init()
 	testCases := []testCase{}
```

**File**: `internal/distributed/proxy/httpserver/handler_v2.go` (modified, +14/-0)
```diff
@@ -1554,6 +1554,8 @@ func (h *HandlersV2) query(ctx context.Context, c *gin.Context, anyReq any, dbNa
 	req := &milvuspb.QueryRequest{
 		DbName:         dbName,
 		CollectionName: httpReq.CollectionName,
+		RlsPrincipal:   httpReq.RlsPrincipal,
+		SkipRls:        httpReq.SkipRls,
 		Expr:           httpReq.Filter,
 		OutputFields:   httpReq.OutputFields,
 		PartitionNames: httpReq.PartitionNames,
@@ -1654,6 +1656,8 @@ func (h *HandlersV2) get(ctx context.Context, c *gin.Context, anyReq any, dbName
 	req := &milvuspb.QueryRequest{
 		DbName:             dbName,
 		CollectionName:     httpReq.CollectionName,
+		RlsPrincipal:       httpReq.RlsPrincipal,
+		SkipRls:            httpReq.SkipRls,
 		OutputFields:       httpReq.OutputFields,
 		PartitionNames:     httpReq.PartitionNames,
 		Expr:               filter,
@@ -1714,6 +1718,8 @@ func (h *HandlersV2) delete(ctx context.Context, c *gin.Context, anyReq any, dbN
 	req := &milvuspb.DeleteRequest{
 		DbName:         dbName,
 		CollectionName: httpReq.CollectionName,
+		RlsPrincipal:   httpReq.RlsPrincipal,
+		SkipRls:        httpReq.SkipRls,
 		PartitionName:  httpReq.PartitionName,
 		Expr:           httpReq.Filter,
 	}
@@ -1759,6 +1765,8 @@ func (h *HandlersV2) insert(ctx context.Context, c *gin.Context, anyReq any, dbN
 	req := &milvuspb.InsertRequest{
 		DbName:         dbName,
 		CollectionName: httpReq.CollectionName,
+		RlsPrincipal:   httpReq.RlsPrincipal,
+		SkipRls:        httpReq.SkipRls,
 		PartitionName:  httpReq.PartitionName,
 		// PartitionName:  "_default",
 	}
@@ -1833,6 +1841,8 @@ func (h *HandlersV2) upsert(ctx context.Context, c *gin.Context, anyReq any, dbN
 	req := &milvuspb.UpsertRequest{
 		DbName:         dbName,
 		CollectionName: httpReq.CollectionName,
+		RlsPrincipal:   httpReq.RlsPrincipal,
+		SkipRls:        httpReq.SkipRls,
 		PartitionName:  httpReq.PartitionName,
 		PartialUpdate:  httpReq.PartialUpdate,
 		// PartitionName:  "_default",
@@ -2075,6 +2085,8 @@ func (h *HandlersV2) search(ctx context.Context, c *gin.Context, anyReq any, dbN
 	req := &milvuspb.SearchRequest{
 		DbName:         dbName,
 		CollectionName: httpReq.CollectionName,
+		RlsPrincipal:   httpReq.RlsPrincipal,
+		SkipRls:        httpReq.SkipRls,
 		Dsl:            httpReq.Filter,
 		DslType:        commonpb.DslType_BoolExprV1,
 		OutputFields:   httpReq.OutputFields,
@@ -2406,6 +2418,8 @@ func (h *HandlersV2) advancedSearch(ctx context.Context, c *gin.Context, anyReq
 	req := &milvuspb.HybridSearchRequest{
 		DbName:         dbName,
 		CollectionName: httpReq.CollectionName,
+		RlsPrincipal:   httpReq.RlsPrincipal,
+		SkipRls:        httpReq.SkipRls,
 		PartitionNames: httpReq.PartitionNames,
 		Requests:       []*milvuspb.SearchRequest{},
 		OutputFields:   httpReq.OutputFields,
```

**File**: `internal/distributed/proxy/httpserver/handler_v2_test.go` (modified, +66/-0)
```diff
@@ -4976,6 +4976,72 @@ func TestDML(t *testing.T) {
 	validateTestCases(t, testEngine, queryTestCases, false)
 }
 
+func TestRESTV2ForwardsRLSFields(t *testing.T) {
+	paramtable.Init()
+	require.NoError(t, paramtable.Get().Save(paramtable.Get().QuotaConfig.QuotaAndLimitsEnabled.Key, "false"))
+	t.Cleanup(func() {
+		require.NoError(t, paramtable.Get().Reset(paramtable.Get().QuotaConfig.QuotaAndLimitsEnabled.Key))
+	})
+
+	matchesRLS := func(req interface {
+		GetRlsPrincipal() string
+		GetSkipRls() bool
+	},
+	) bool {
+		return req.GetRlsPrincipal() == "alice" && req.GetSkipRls()
+	}
+	mp := mocks.NewMockProxy(t)
+	mp.EXPECT().DescribeCollection(mock.Anything, mock.Anything).Return(&milvuspb.DescribeCollectionResponse{
+		CollectionName: DefaultCollectionName,
+		Schema:         generateCollectionSchema(schemapb.DataType_Int64, false, true),
+		ShardsNum:      ShardNumDefault,
+		Status:         &StatusSuccess,
+	}, nil).Times(7)
+	mp.EXPECT().Query(mock.Anything, mock.MatchedBy(func(req *milvuspb.QueryRequest) bool {
+		return matchesRLS(req)
+	})).Return(&milvuspb.QueryResults{Status: commonSuccessStatus}, nil).Twice()
+	mp.EXPECT().Delete(mock.Anything, mock.MatchedBy(func(req *milvuspb.DeleteRequest) bool {
+		return matchesRLS(req)
+	})).Return(&milvuspb.MutationResult{Status: commonSuccessStatus}, nil).Once()
+	mp.EXPECT().Insert(mock.Anything, mock.MatchedBy(func(req *milvuspb.InsertRequest) bool {
+		return matchesRLS(req)
+	})).Return(&milvuspb.MutationResult{
+		Status: commonSuccessStatus, IDs: generateIDs(schemapb.DataType_Int64, 1), InsertCnt: 1,
+	}, nil).Once()
+	mp.EXPECT().Upsert(mock.Anything, mock.MatchedBy(func(req *milvuspb.UpsertRequest) bool {
+		return matchesRLS(req)
+	})).Return(&milvuspb.MutationResult{
+		Status: commonSuccessStatus, IDs: generateIDs(schemapb.DataType_Int64, 1), UpsertCnt: 1,
+	}, nil).Once()
+	mp.EXPECT().Search(mock.Anything, mock.MatchedBy(func(req *milvuspb.SearchRequest) bool {
+		return matchesRLS(req)
+	})).Return(&milvuspb.SearchResults{
+		Status: commonSuccessStatus, Results: &schemapb.SearchResultData{},
+	}, nil).Once()
+	mp.EXPECT().HybridSearch(mock.Anything, mock.MatchedBy(func(req *milvuspb.HybridSearchRequest) bool {
+		return matchesRLS(req) && len(req.GetRequests()) == 1 &&
+			req.GetRequests()[0].GetRlsPrincipal() == "" && !req.GetRequests()[0].GetSkipRls()
+	})).Return(&milvuspb.SearchResults{
+		Status: commonSuccessStatus, Results: &schemapb.SearchResultData{},
+	}, nil).Once()
+
+	engine := initHTTPServerV2(mp, false)
+	send := func(action, body string) {
+		t.Helper()
+		w := httptest.NewRecorder()
+		engine.ServeHTTP(w, httptest.NewRequest(http.MethodPost, versionalV2(EntityCategory, action), strings.NewReader(body)))
+		require.Equal(t, http.StatusOK, w.Code, w.Body.String())
+	}
+
+	send(QueryAction, `{"collectionName":"book","filter":"book_id > 0","rlsPrincipal":"alice","skipRls":true}`)
+	send(GetAction, `{"collectionName":"book","id":[1],"rlsPrincipal":"alice","skipRls":true}`)
+	send(DeleteAction, `{"collectionName":"book","filter":"book_id in [1]","rlsPrincipal":"alice","skipRls":true}`)
+	send(InsertAction, `{"collectionName":"book","data":[{"book_id":1,"word_count":1,"book_intro":[0.1,0.2]}],"rlsPrincipal":"alice","skipRls":true}`)
+	send(UpsertAction, `{"collectionName":"book","data":[{"book_id":1,"word_count":1,"book_intro":[0.1,0.2]}],"rlsPrincipal":"alice","skipRls":true}`)
+	send(SearchAction, `{"collectionName":"book","data":[[0.1,0.2]],"annsField":"book_intro","limit":1,"rlsPrincipal":"alice","skipRls":true}`)
+	send(HybridSearchAction, `{"collectionName":"book","search":[{"data":[[0.1,0.2]],"annsField":"book_intro","limit":1}],"limit":1,"rlsPrincipal":"alice","skipRls":true}`)
+}
+
 func TestQueryOrderByFields(t *testing.T) {
 	paramtable.Init()
 	// disable rate limit
```

**File**: `internal/distributed/proxy/httpserver/request.go` (modified, +16/-0)
```diff
@@ -40,6 +40,8 @@ type DropCollectionReq struct {
 type QueryReq struct {
 	DbName         string   `json:"dbName"`
 	CollectionName string   `json:"collectionName" validate:"required"`
+	RlsPrincipal   string   `json:"rlsPrincipal"`
+	SkipRls        bool     `json:"skipRls"`
 	OutputFields   []string `json:"outputFields"`
 	Filter         string   `json:"filter" validate:"required"`
 	Limit          int32    `json:"limit"`
@@ -49,32 +51,42 @@ type QueryReq struct {
 type GetReq struct {
 	DbName         string      `json:"dbName"`
 	CollectionName string      `json:"collectionName" validate:"required"`
+	RlsPrincipal   string      `json:"rlsPrincipal"`
+	SkipRls        bool        `json:"skipRls"`
 	OutputFields   []string    `json:"outputFields"`
 	ID             interface{} `json:"id" validate:"required"`
 }
 
 type DeleteReq struct {
 	DbName         string      `json:"dbName"`
 	CollectionName string      `json:"collectionName" validate:"required"`
+	RlsPrincipal   string      `json:"rlsPrincipal"`
+	SkipRls        bool        `json:"skipRls"`
 	ID             interface{} `json:"id"`
 	Filter         string      `json:"filter"`
 }
 
 type InsertReq struct {
 	DbName         string                   `json:"dbName"`
 	CollectionName string                   `json:"collectionName" validate:"required"`
+	RlsPrincipal   string                   `json:"rlsPrincipal"`
+	SkipRls        bool                     `json:"skipRls"`
 	Data           []map[string]interface{} `json:"data" validate:"required"`
 }
 
 type SingleInsertReq struct {
 	DbName         string                 `json:"dbName"`
 	CollectionName string                 `json:"collectionName" validate:"required"`
+	RlsPrincipal   string                 `json:"rlsPrincipal"`
+	SkipRls        bool                   `json:"skipRls"`
 	Data           map[string]interface{} `json:"data" validate:"required"`
 }
 
 type UpsertReq struct {
 	DbName         string                    `json:"dbName"`
 	CollectionName string                    `json:"collectionName" validate:"required"`
+	RlsPrincipal   string                    `json:"rlsPrincipal"`
+	SkipRls        bool                      `json:"skipRls"`
 	Data           []map[string]interface{}  `json:"data" validate:"required"`
 	PartialUpdate  bool                      `json:"partialUpdate"`
 	FieldOps       []FieldPartialUpdateOpReq `json:"fieldOps"`
@@ -83,6 +95,8 @@ type UpsertReq struct {
 type SingleUpsertReq struct {
 	DbName         string                    `json:"dbName"`
 	CollectionName string                    `json:"collectionName" validate:"required"`
+	RlsPrincipal   string                    `json:"rlsPrincipal"`
+	SkipRls        bool                      `json:"skipRls"`
 	Data           map[string]interface{}    `json:"data" validate:"required"`
 	PartialUpdate  bool                      `json:"partialUpdate"`
 	FieldOps       []FieldPartialUpdateOpReq `json:"fieldOps"`
@@ -167,6 +181,8 @@ func (v *Base64VectorQuery) UnmarshalJSON(data []byte) error {
 type SearchReq struct {
 	DbName            string                `json:"dbName"`
 	CollectionName    string                `json:"collectionName" validate:"required"`
+	RlsPrincipal      string                `json:"rlsPrincipal"`
+	SkipRls           bool                  `json:"skipRls"`
 	Filter            string                `json:"filter"`
 	Limit             int32                 `json:"limit"`
 	Offset            int32                 `json:"offset"`
```

**File**: `internal/distributed/proxy/httpserver/request_v2.go` (modified, +12/-0)
```diff
@@ -450,6 +450,8 @@ func (req *ExportSnapshotReq) GetDbName() string { return req.DbName }
 type QueryReqV2 struct {
 	DbName         string   `json:"dbName"`
 	CollectionName string   `json:"collectionName" binding:"required"`
+	RlsPrincipal   string   `json:"rlsPrincipal"`
+	SkipRls        bool     `json:"skipRls"`
 	PartitionNames []string `json:"partitionNames"`
 	OutputFields   []string `json:"outputFields"`
 	Filter         string   `json:"filter"`
@@ -471,6 +473,8 @@ func (req *QueryReqV2) GetCollectionName() string { return req.CollectionName }
 type CollectionIDReq struct {
 	DbName           string      `json:"dbName"`
 	CollectionName   string      `json:"collectionName" binding:"required"`
+	RlsPrincipal     string      `json:"rlsPrincipal"`
+	SkipRls          bool        `json:"skipRls"`
 	PartitionName    string      `json:"partitionName"`
 	PartitionNames   []string    `json:"partitionNames"`
 	OutputFields     []string    `json:"outputFields"`
@@ -484,6 +488,8 @@ func (req *CollectionIDReq) GetCollectionName() string { return req.CollectionNa
 type CollectionFilterReq struct {
 	DbName         string                     `json:"dbName"`
 	CollectionName string                     `json:"collectionName" binding:"required"`
+	RlsPrincipal   string                     `json:"rlsPrincipal"`
+	SkipRls        bool                       `json:"skipRls"`
 	PartitionName  string                     `json:"partitionName"`
 	Filter         string                     `json:"filter" binding:"required"`
 	ExprParams     map[string]json.RawMessage `json:"exprParams"`
@@ -495,6 +501,8 @@ func (req *CollectionFilterReq) GetCollectionName() string { return req.Collecti
 type CollectionDataReq struct {
 	DbName         string                    `json:"dbName"`
 	CollectionName string                    `json:"collectionName" binding:"required"`
+	RlsPrincipal   string                    `json:"rlsPrincipal"`
+	SkipRls        bool                      `json:"skipRls"`
 	PartitionName  string                    `json:"partitionName"`
 	Data           []map[string]interface{}  `json:"data" binding:"required"`
 	PartialUpdate  bool                      `json:"partialUpdate"`
@@ -578,6 +586,8 @@ func parseFieldPartialUpdateOpV2(op string) (schemapb.FieldPartialUpdateOp_OpTyp
 type SearchReqV2 struct {
 	DbName            string                     `json:"dbName"`
 	CollectionName    string                     `json:"collectionName" binding:"required"`
+	RlsPrincipal      string                     `json:"rlsPrincipal"`
+	SkipRls           bool                       `json:"skipRls"`
 	Data              []interface{}              `json:"data"`
 	Ids               []json.RawMessage          `json:"ids"`
 	AnnsField         string                     `json:"annsField"`
@@ -657,6 +667,8 @@ type SubSearchReq struct {
 type HybridSearchReq struct {
 	DbName            string                `json:"dbName"`
 	CollectionName    string                `json:"collectionName" binding:"required"`
+	RlsPrincipal      string                `json:"rlsPrincipal"`
+	SkipRls           bool                  `json:"skipRls"`
 	PartitionNames    []string              `json:"partitionNames"`
 	Search            []SubSearchReq        `json:"search"`
 	Rerank            Rand                  `json:"rerank"`
```

**File**: `internal/parser/planparserv2/rewriter/README.md` (modified, +1/-1)
```diff
@@ -102,7 +102,7 @@ The rewriter can be configured via the following parameter (refreshable at runti
 ### General Notes
 - All merges require operands to target the same column (same `ColumnInfo`, including nested path/element type).
 - Rewrite runs after template value filling; template placeholders do not appear here.
-- Optional visitor rewrites do not descend into `MatchExpr` or `ElementFilterExpr` predicates.
+- Optional visitor rewrites do not descend into `MatchExpr` predicates.
 - Sorting/dedup for IN/NOT IN is deterministic; duplicates are removed post-sort.
 - Numeric-threshold for OR→IN / AND≠→NOT IN is defined in `util.go` (`defaultConvertOrToInNumericLimit`, default 150).
 - Nullable fields keep contradiction/tautology predicates instead of folding to valid `true`/`false`, because NULL must remain unknown under outer logical operators such as `NOT`. Fixed JSON/array paths also avoid domain-wide folds that assume every path/index exists.
```

**File**: `internal/parser/planparserv2/rewriter/entry.go` (modified, +34/-10)
```diff
@@ -11,6 +11,19 @@ func RewriteExpr(e *planpb.Expr) *planpb.Expr {
 	return RewriteExprWithConfig(e, optimizeEnabled)
 }
 
+// MergeNormalizedAnd combines two expressions that have already passed
+// RewriteExpr. It preserves cross-branch AND optimizations without walking or
+// mutating either input tree again.
+func MergeNormalizedAnd(left, right *planpb.Expr) *planpb.Expr {
+	v := &visitor{optimizeEnabled: paramtable.Get().CommonCfg.EnabledOptimizeExpr.GetAsBool()}
+	if !v.optimizeEnabled {
+		return &planpb.Expr{Expr: &planpb.Expr_BinaryExpr{BinaryExpr: &planpb.BinaryExpr{
+			Left: left, Right: right, Op: planpb.BinaryExpr_LogicalAnd,
+		}}}
+	}
+	return v.mergeAnd(left, right)
+}
+
 func RewriteExprWithConfig(e *planpb.Expr, optimizeEnabled bool) *planpb.Expr {
 	if e == nil {
 		return nil
@@ -39,6 +52,13 @@ func (v *visitor) visitExpr(expr *planpb.Expr) interface{} {
 		return v.visitTermExpr(real.TermExpr)
 	case *planpb.Expr_ValueExpr:
 		return v.visitValueExpr(real.ValueExpr, expr)
+	case *planpb.Expr_RandomSampleExpr:
+		real.RandomSampleExpr.Predicate = v.visitExpr(real.RandomSampleExpr.GetPredicate()).(*planpb.Expr)
+		return expr
+	case *planpb.Expr_ElementFilterExpr:
+		real.ElementFilterExpr.ElementExpr = v.visitExpr(real.ElementFilterExpr.GetElementExpr()).(*planpb.Expr)
+		real.ElementFilterExpr.Predicate = v.visitExpr(real.ElementFilterExpr.GetPredicate()).(*planpb.Expr)
+		return expr
 	// no optimization for other types
 	default:
 		return expr
@@ -72,16 +92,7 @@ func (v *visitor) visitBinaryExpr(expr *planpb.BinaryExpr) interface{} {
 		parts = v.combineOrInWithEqual(parts)
 		return foldBinary(planpb.BinaryExpr_LogicalOr, parts)
 	case planpb.BinaryExpr_LogicalAnd:
-		parts := flattenAnd(left, right)
-		parts = combineArrayContains(parts, planpb.JSONContainsExpr_ContainsAll)
-		parts = v.combineAndRangePredicates(parts)
-		parts = v.combineAndBinaryRanges(parts)
-		parts = v.combineAndInWithIn(parts)
-		parts = v.combineAndInWithNotEqual(parts)
-		parts = v.combineAndInWithRange(parts)
-		parts = v.combineAndInWithEqual(parts)
-		parts = v.combineAndNotEqualsToNotIn(parts)
-		return foldBinary(planpb.BinaryExpr_LogicalAnd, parts)
+		return v.mergeAnd(left, right)
 	default:
 		return &planpb.Expr{
 			Expr: &planpb.Expr_BinaryExpr{
@@ -95,6 +106,19 @@ func (v *visitor) visitBinaryExpr(expr *planpb.BinaryExpr) interface{} {
 	}
 }
 
+func (v *visitor) mergeAnd(left, right *planpb.Expr) *planpb.Expr {
+	parts := flattenAnd(left, right)
+	parts = combineArrayContains(parts, planpb.JSONContainsExpr_ContainsAll)
+	parts = v.combineAndRangePredicates(parts)
+	parts = v.combineAndBinaryRanges(parts)
+	parts = v.combineAndInWithIn(parts)
+	parts = v.combineAndInWithNotEqual(parts)
+	parts = v.combineAndInWithRange(parts)
+	parts = v.combineAndInWithEqual(parts)
+	parts = v.combineAndNotEqualsToNotIn(parts)
+	return foldBinary(planpb.BinaryExpr_LogicalAnd, parts)
+}
+
 func (v *visitor) visitUnaryExpr(expr *planpb.UnaryExpr) interface{} {
 	if !v.optimizeEnabled {
 		child := v.visitExpr(expr.GetChild()).(*planpb.Expr)
```

---

### Incident Patch 9: `62569cb3` (2026-09-29)
**Commit Message**: fix: Use multipart copy above a configurable 1 GiB threshold (#53787)

## Problem

issue: #53786

An approximately 2 GB cross-bucket OSS snapshot copy currently uses one
CopyObject request and can fail with `net/http: timeout awaiting
response headers`.

## Change

Use the existing server-side multipart copy path above 1 GiB by default.
Add the refreshable `minio.multipartCopyThreshold` setting (bytes,
version 3.0.3), read for each subsequent copy and exported in the
default YAML. Positive int64 values are accepted; invalid values fall
back to 1073741824. The effective single-copy limit remains capped at 5
GiB. Explicit and endpoint-inferred GCP configurations retain the
single-copy path through shared provider resolution without mutating
caller configuration. The separate Azure implementation is retained.

## Validation

On the rebased master commit, the targeted storage and paramtable tests
pass with `-tags dynamic,test -gcflags='all=-N -l' -count=1`. The real
SDK HTTP test verifies that a 2,000,000,000-byte object emits four
server-side part-copy requests and completes, and that a rejected second
part returns the storage permission error without completing the upload.
Routing te

**File**: `configs/milvus.yaml` (modified, +1/-0)
```diff
@@ -166,6 +166,7 @@ minio:
   # The maximum number of objects requested per batch in minio ListObjects rpc, 
   # 0 means using oss client by default, decrease these configuration if ListObjects timeout
   listObjectsMaxKeys: 0
+  multipartCopyThreshold: 1073741824 # Object size threshold in bytes for switching from a single CopyObject request to multipart copy. Larger objects use multipart copy. Default is 1 GiB (1073741824 bytes). Must be a positive integer; invalid values fall back to the default. Single CopyObject requests remain capped at 5 GiB regardless of this threshold. Changes apply to subsequent copies, not copies already in progress. Does not apply to GCP or Azure.
 
 # Milvus supports four message queues (MQ): rocksmq (based on RocksDB), Pulsar, Kafka, and Woodpecker.
 # You can change the MQ by setting the mq.type field.
```

**File**: `internal/storage/minio_object_storage.go` (modified, +9/-5)
```diff
@@ -29,6 +29,7 @@ import (
 
 var _ ObjectStorage = (*MinioObjectStorage)(nil)
 
+// minio-go caps a single CopyObject request at 5 GiB, regardless of the configured threshold.
 const minioSingleCopyObjectMaxSize = 5 * 1024 * 1024 * 1024
 
 type MinioObjectStorage struct {
@@ -50,11 +51,13 @@ func (or *ObjectReader) Size() (int64, error) {
 }
 
 func newMinioObjectStorageWithConfig(ctx context.Context, c *objectstorage.Config) (*MinioObjectStorage, error) {
-	minIOClient, err := objectstorage.NewMinioClient(ctx, c)
+	resolvedConfig := *c
+	resolvedConfig.CloudProvider = objectstorage.ResolveCloudProvider(c)
+	minIOClient, err := objectstorage.NewMinioClient(ctx, &resolvedConfig)
 	if err != nil {
 		return nil, err
 	}
-	return &MinioObjectStorage{Client: minIOClient, cloudProvider: c.CloudProvider}, nil
+	return &MinioObjectStorage{Client: minIOClient, cloudProvider: resolvedConfig.CloudProvider}, nil
 }
 
 func (minioObjectStorage *MinioObjectStorage) GetObject(ctx context.Context, bucketName, objectName string, offset int64, size int64) (FileReader, error) {
@@ -126,6 +129,7 @@ func (minioObjectStorage *MinioObjectStorage) RemoveObject(ctx context.Context,
 }
 
 func (minioObjectStorage *MinioObjectStorage) CopyObjectCrossBucket(ctx context.Context, srcBucket, srcObjectName, dstBucket, dstObjectName string) error {
+	singleCopyMaxSize := min(paramtable.Get().MinioCfg.MultipartCopyThreshold.GetAsInt64(), minioSingleCopyObjectMaxSize)
 	srcOpts := minio.CopySrcOptions{
 		Bucket: srcBucket,
 		Object: srcObjectName,
@@ -141,12 +145,12 @@ func (minioObjectStorage *MinioObjectStorage) CopyObjectCrossBucket(ctx context.
 	// GCS's XML API has no multipart copy: x-amz-copy-source-range (emitted by
 	// ComposeObject) has no x-goog-* equivalent. Its whole-object copy has no
 	// 5GiB cap though, so GCP always takes the single-copy path.
-	if srcInfo.Size <= minioSingleCopyObjectMaxSize || minioObjectStorage.cloudProvider == objectstorage.CloudProviderGCP {
+	if srcInfo.Size <= singleCopyMaxSize || minioObjectStorage.cloudProvider == objectstorage.CloudProviderGCP {
 		_, err = minioObjectStorage.CopyObject(ctx, dstOpts, srcOpts)
 		return mapObjectStorageError(srcObjectName, err)
 	}
-	// MinIO's single CopyObject path is capped at 5GiB. ComposeObject still runs
-	// provider-side and avoids streaming snapshot data through Milvus.
+	// Copy larger objects in parts to reduce the work per request. ComposeObject
+	// runs provider-side and avoids streaming snapshot data through Milvus.
 	_, err = minioObjectStorage.ComposeObject(ctx, dstOpts, srcOpts)
 	return mapObjectStorageError(srcObjectName, err)
 }
```

**File**: `internal/storage/minio_object_storage_test.go` (modified, +210/-134)
```diff
@@ -19,11 +19,13 @@ package storage
 import (
 	"bytes"
 	"context"
+	"encoding/xml"
 	"fmt"
 	"io"
 	"net/http"
 	"net/http/httptest"
 	"strings"
+	"sync"
 	"testing"
 	"time"
 
@@ -57,143 +59,217 @@ func TestMinioObjectStoragePutObjectOptions(t *testing.T) {
 	assert.False(t, opts.SendContentMd5)
 }
 
-func TestMinioObjectStorageCopyObjectCrossBucketUsesSingleCopyForSameBucket(t *testing.T) {
-	var gotDst minio.CopyDestOptions
-	var gotSrc minio.CopySrcOptions
-	copyCalled := false
-	composeCalled := false
-	mockStat := mockey.Mock((*minio.Client).StatObject).Return(
-		minio.ObjectInfo{Size: minioSingleCopyObjectMaxSize}, nil).Build()
-	defer mockStat.UnPatch()
-	mockCopy := mockey.Mock((*minio.Client).CopyObject).To(
-		func(_ *minio.Client, _ context.Context, dst minio.CopyDestOptions, src minio.CopySrcOptions) (minio.UploadInfo, error) {
-			copyCalled = true
-			gotDst = dst
-			gotSrc = src
-			return minio.UploadInfo{}, nil
-		}).Build()
-	defer mockCopy.UnPatch()
-	mockCompose := mockey.Mock((*minio.Client).ComposeObject).To(
-		func(_ *minio.Client, _ context.Context, _ minio.CopyDestOptions, _ ...minio.CopySrcOptions) (minio.UploadInfo, error) {
-			composeCalled = true
-			return minio.UploadInfo{}, nil
-		}).Build()
-	defer mockCompose.UnPatch()
-
-	objectStorage := &MinioObjectStorage{Client: &minio.Client{}}
-	err := objectStorage.CopyObjectCrossBucket(context.Background(), "bucket", "src-object", "bucket", "dst-object")
-	require.NoError(t, err)
-
-	assert.True(t, copyCalled)
-	assert.False(t, composeCalled)
-	assert.Equal(t, "bucket", gotSrc.Bucket)
-	assert.Equal(t, "src-object", gotSrc.Object)
-	assert.Equal(t, "bucket", gotDst.Bucket)
-	assert.Equal(t, "dst-object", gotDst.Object)
-}
-
-func TestMinioObjectStorageCopyObjectCrossBucketUsesSingleCopyForSmallObject(t *testing.T) {
-	var gotDst minio.CopyDestOptions
-	var gotSrc minio.CopySrcOptions
-	copyCalled := false
-	composeCalled := false
-	mockStat := mockey.Mock((*minio.Client).StatObject).Return(
-		minio.ObjectInfo{Size: minioSingleCopyObjectMaxSize}, nil).Build()
-	defer mockStat.UnPatch()
-	mockCopy := mockey.Mock((*minio.Client).CopyObject).To(
-		func(_ *minio.Client, _ context.Context, dst minio.CopyDestOptions, src minio.CopySrcOptions) (minio.UploadInfo, error) {
-			copyCalled = true
-			gotDst = dst
-			gotSrc = src
-			return minio.UploadInfo{}, nil
-		}).Build()
-	defer mockCopy.UnPatch()
-	mockCompose := mockey.Mock((*minio.Client).ComposeObject).To(
-		func(_ *minio.Client, _ context.Context, _ minio.CopyDestOptions, _ ...minio.CopySrcOptions) (minio.UploadInfo, error) {
-			composeCalled = true
-			return minio.UploadInfo{}, nil
-		}).Build()
-	defer mockCompose.UnPatch()
-
-	objectStorage := &MinioObjectStorage{Client: &minio.Client{}}
-	err := objectStorage.CopyObjectCrossBucket(context.Background(), "src-bucket", "src-object", "dst-bucket", "dst-object")
-	require.NoError(t, err)
-
-	assert.True(t, copyCalled)
-	assert.False(t, composeCalled)
-	assert.Equal(t, "src-bucket", gotSrc.Bucket)
-	assert.Equal(t, "src-object", gotSrc.Object)
-	assert.Equal(t, "dst-bucket", gotDst.Bucket)
-	assert.Equal(t, "dst-object", gotDst.Object)
-}
+func TestMinioObjectStorageCopyObjectCrossBucket(t *testing.T) {
+	params := paramtable.Get()
+	key := params.MinioCfg.MultipartCopyThreshold.Key
+	original := params.MinioCfg.MultipartCopyThreshold.GetValue()
+	t.Cleanup(func() { require.NoError(t, params.Save(key, original)) })
 
-func TestMinioObjectStorageCopyObjectCrossBucketUsesComposeForLargeObject(t *testing.T) {
-	var gotDst minio.CopyDestOptions
-	var gotSrcs []minio.CopySrcOptions
-	copyCalled := false
-	mockStat := mockey.Mock((*minio.Client).StatObject).Return(
-		minio.ObjectInfo{Size: minioSingleCopyObjectMaxSize + 1}, nil).Build()
-	defer mockStat.UnPatch()
-	mockCopy := mockey.Mock((*minio.Client).CopyObject).To(
-		func(_ *minio.Client, _ context.Context, _ minio.CopyDestOptions, _ minio.CopySrcOptions) (minio.UploadInfo, error) {
-			copyCalled = true
-			return minio.UploadInfo{}, nil
-		}).Build()
-	defer mockCopy.UnPatch()
-	mockCompose := mockey.Mock((*minio.Client).ComposeObject).To(
-		func(_ *minio.Client, _ context.Context, dst minio.CopyDestOptions, srcs ...minio.CopySrcOptions) (minio.UploadInfo, error) {
-			gotDst = dst
-			gotSrcs = append([]minio.CopySrcOptions(nil), srcs...)
-			return minio.UploadInfo{}, nil
-		}).Build()
-	defer mockCompose.UnPatch()
-
-	objectStorage := &MinioObjectStorage{Client: &minio.Client{}}
-	err := objectStorage.CopyObjectCrossBucket(context.Background(), "src-bucket", "src-object", "dst-bucket", "dst-object")
-	require.NoError(t, err)
-
-	assert.False(t, copyCalled)
-	require.Len(t, gotSrcs, 1)
-	assert.Equal(t, "src-bucket", gotSrcs[0].Bucket)
-	assert.Equal(t, "src-object", gotSrcs[0].Object)
-	assert.Equal(t, int64(0), gotSrcs[0].Start)
-	assert.Equal(t, "dst-bucket", gotDst.Bucket)
-	assert.Equal(t, "dst-object", gotDst.Object)
+	for _, tc := range []struct {
+		name    
```

**File**: `pkg/objectstorage/util.go` (modified, +19/-30)
```diff
@@ -44,6 +44,24 @@ const (
 
 var CheckBucketRetryAttempts uint = 20
 
+// ResolveCloudProvider applies the endpoint compatibility rules used by the
+// MinIO client factory without changing the caller's configuration.
+func ResolveCloudProvider(c *Config) string {
+	switch c.CloudProvider {
+	case CloudProviderAliyun, CloudProviderGCP, CloudProviderTencent, CloudProviderHuawei:
+		return c.CloudProvider
+	}
+	// Preserve endpoint inference for the default S3-compatible client path.
+	switch {
+	case strings.Contains(c.Address, gcp.GcsDefaultAddress):
+		return CloudProviderGCP
+	case strings.Contains(c.Address, aliyun.OSSAddressFeatureString):
+		return CloudProviderAliyun
+	default:
+		return c.CloudProvider
+	}
+}
+
 func NewMinioClient(ctx context.Context, c *Config) (*minio.Client, error) {
 	var creds *credentials.Credentials
 	newMinioFn := minio.New
@@ -53,8 +71,7 @@ func NewMinioClient(ctx context.Context, c *Config) (*minio.Client, error) {
 		bucketLookupType = minio.BucketLookupDNS
 	}
 
-	matchedDefault := false
-	switch c.CloudProvider {
+	switch ResolveCloudProvider(c) {
 	case CloudProviderAliyun:
 		// auto doesn't work for aliyun, so we set to dns deliberately
 		bucketLookupType = minio.BucketLookupDNS
@@ -81,34 +98,6 @@ func NewMinioClient(ctx context.Context, c *Config) (*minio.Client, error) {
 			creds = credentials.NewStaticV4(c.AccessKeyID, c.SecretAccessKeyID, "")
 		}
 	default: // aws, minio
-		matchedDefault = true
-	}
-
-	// Compatibility logic. If the cloud provider is not specified in the request,
-	// it shall be inferred based on the service address.
-	if matchedDefault {
-		matchedDefault = false
-		switch {
-		case strings.Contains(c.Address, gcp.GcsDefaultAddress):
-			newMinioFn = gcp.NewMinioClient
-			if !c.UseIAM {
-				creds = credentials.NewStaticV2(c.AccessKeyID, c.SecretAccessKeyID, "")
-			}
-		case strings.Contains(c.Address, aliyun.OSSAddressFeatureString):
-			// auto doesn't work for aliyun, so we set to dns deliberately
-			bucketLookupType = minio.BucketLookupDNS
-			if c.UseIAM {
-				newMinioFn = aliyun.NewMinioClient
-			} else {
-				creds = credentials.NewStaticV4(c.AccessKeyID, c.SecretAccessKeyID, "")
-			}
-		default:
-			matchedDefault = true
-		}
-	}
-
-	if matchedDefault {
-		// aws, minio
 		if c.UseIAM {
 			creds = credentials.NewIAM("")
 		} else {
```

**File**: `pkg/objectstorage/util_test.go` (modified, +49/-0)
```diff
@@ -19,6 +19,35 @@ import (
 	"google.golang.org/api/googleapi"
 )
 
+func TestResolveCloudProvider(t *testing.T) {
+	for _, tc := range []struct {
+		name, provider, address, want string
+	}{
+		{"explicit_gcp", CloudProviderGCP, "custom.example.com", CloudProviderGCP},
+		{"explicit_aliyun", CloudProviderAliyun, "storage.googleapis.com", CloudProviderAliyun},
+		{"explicit_tencent", CloudProviderTencent, "storage.googleapis.com", CloudProviderTencent},
+		{"explicit_huawei", CloudProviderHuawei, "oss-cn-hangzhou.aliyuncs.com", CloudProviderHuawei},
+		{"default_gcp", "", "storage.googleapis.com", CloudProviderGCP},
+		{"aws_gcp_with_port", CloudProviderAWS, "storage.googleapis.com:443", CloudProviderGCP},
+		{"unknown_gcp", "minio", "storage.googleapis.com", CloudProviderGCP},
+		{"default_aliyun", "", "oss-cn-hangzhou.aliyuncs.com", CloudProviderAliyun},
+		{"aws_aliyun", CloudProviderAWS, "oss-cn-hangzhou.aliyuncs.com", CloudProviderAliyun},
+		{"gcp_endpoint_precedence", "", "storage.googleapis.com.oss.aliyuncs.com", CloudProviderGCP},
+		{"aws", CloudProviderAWS, "s3.amazonaws.com", CloudProviderAWS},
+		{"default_minio", "", "localhost:9000", ""},
+		{"unknown_provider", "minio", "localhost:9000", "minio"},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			config := Config{CloudProvider: tc.provider, Address: tc.address}
+			original := config
+			assert.Equal(t, tc.want, ResolveCloudProvider(&config))
+			assert.Equal(t, original, config)
+			config.CloudProvider = tc.want
+			assert.Equal(t, tc.want, ResolveCloudProvider(&config), "resolution must be idempotent")
+		})
+	}
+}
+
 func TestIsGcsNotExist(t *testing.T) {
 	notFound := &googleapi.Error{Code: http.StatusNotFound}
 	// cloud.google.com/go/storage >= v1.51 formats not-found errors this way
@@ -167,6 +196,26 @@ func TestNewTLSHTTPClientRejectsLowerVersion(t *testing.T) {
 	})
 }
 
+func TestNewMinioClientInferredGCP(t *testing.T) {
+	for _, provider := range []string{"", CloudProviderAWS} {
+		for _, useIAM := range []bool{false, true} {
+			t.Run(fmt.Sprintf("provider=%s/iam=%t", provider, useIAM), func(t *testing.T) {
+				config := Config{
+					Address: "storage.googleapis.com:443", CloudProvider: provider,
+					UseSSL: true, UseIAM: useIAM, SkipBucketCheck: true,
+					BucketName: "src-bucket", AccessKeyID: "access-key", SecretAccessKeyID: "secret-key",
+				}
+				original := config
+				client, err := NewMinioClient(context.Background(), &config)
+				require.NoError(t, err)
+				// The GCP constructor removes the port so the SDK recognizes GCS.
+				assert.Equal(t, "storage.googleapis.com", client.EndpointURL().Host)
+				assert.Equal(t, original, config)
+			})
+		}
+	}
+}
+
 func TestNewMinioClientSkipsBucketCheck(t *testing.T) {
 	var requestCount atomic.Int32
 	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
```

**File**: `pkg/util/paramtable/service_param.go` (modified, +22/-0)
```diff
@@ -1937,6 +1937,7 @@ type MinioConfig struct {
 	ListObjectsMaxKeys ParamItem `refreshable:"true"`
 	UseCRC32C          ParamItem `refreshable:"false"`
 
+	MultipartCopyThreshold    ParamItem `refreshable:"true"`
 	DisableAWSChunkedEncoding ParamItem `refreshable:"false"`
 }
 
@@ -2197,6 +2198,27 @@ Leave it empty if you want to use AWS default endpoint`,
 	}
 	p.ListObjectsMaxKeys.Init(base.mgr)
 
+	p.MultipartCopyThreshold = ParamItem{
+		Key:          "minio.multipartCopyThreshold",
+		Version:      "3.0.3",
+		DefaultValue: "1073741824",
+		Doc: "Object size threshold in bytes for switching from a single CopyObject request to multipart copy. " +
+			"Larger objects use multipart copy. Default is 1 GiB (1073741824 bytes). " +
+			"Must be a positive integer; invalid values fall back to the default. " +
+			"Single CopyObject requests remain capped at 5 GiB regardless of this threshold. " +
+			"Changes apply to subsequent copies, not copies already in progress. " +
+			"Does not apply to GCP or Azure.",
+		Formatter: func(v string) string {
+			size, err := strconv.ParseInt(v, 10, 64)
+			if err != nil || size <= 0 {
+				return "1073741824"
+			}
+			return v
+		},
+		Export: true,
+	}
+	p.MultipartCopyThreshold.Init(base.mgr)
+
 	p.UseCRC32C = ParamItem{
 		Key:          "minio.ssl.useCRC32C",
 		Version:      "2.6.11",
```

**File**: `pkg/util/paramtable/service_param_test.go` (modified, +38/-0)
```diff
@@ -33,6 +33,44 @@ import (
 	"github.com/milvus-io/milvus/pkg/v3/util/typeutil"
 )
 
+func TestMinioConfig_MultipartCopyThreshold(t *testing.T) {
+	base := NewBaseTable(SkipRemote(true), SkipEnv(true), Files([]string{}))
+	t.Cleanup(base.mgr.Close)
+	var params MinioConfig
+	params.Init(base)
+	assert.Equal(t, "minio.multipartCopyThreshold", params.MultipartCopyThreshold.Key)
+	assert.Equal(t, "3.0.3", params.MultipartCopyThreshold.Version)
+	assert.True(t, params.MultipartCopyThreshold.Export)
+	assert.Equal(t, int64(1024*1024*1024), params.MultipartCopyThreshold.GetAsInt64())
+
+	for _, tc := range []struct {
+		name  string
+		value string
+		want  int64
+	}{
+		{name: "minimum", value: "1", want: 1},
+		{name: "lower_threshold", value: "500000000", want: 500_000_000},
+		{name: "higher_threshold", value: "2000000000", want: 2_000_000_000},
+		{name: "single_copy_limit", value: "5368709120", want: 5 * 1024 * 1024 * 1024},
+		{name: "above_single_copy_limit", value: "5368709121", want: 5*1024*1024*1024 + 1},
+		{name: "ten_gib", value: "10737418240", want: 10 * 1024 * 1024 * 1024},
+		{name: "max_int64", value: "9223372036854775807", want: 1<<63 - 1},
+		{name: "zero", value: "0", want: 1024 * 1024 * 1024},
+		{name: "negative", value: "-1", want: 1024 * 1024 * 1024},
+		{name: "empty", value: "", want: 1024 * 1024 * 1024},
+		{name: "invalid", value: "invalid", want: 1024 * 1024 * 1024},
+		{name: "unit_suffix", value: "1GB", want: 1024 * 1024 * 1024},
+		{name: "overflow", value: "9223372036854775808", want: 1024 * 1024 * 1024},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			require.NoError(t, base.Save(params.MultipartCopyThreshold.Key, tc.value))
+			assert.Equal(t, tc.want, params.MultipartCopyThreshold.GetAsInt64())
+		})
+	}
+	require.NoError(t, base.Reset(params.MultipartCopyThreshold.Key))
+	assert.Equal(t, int64(1024*1024*1024), params.MultipartCopyThreshold.GetAsInt64())
+}
+
 // Every local storage key is a complete filesystem path that starts with
 // localStorage.path, and the loon local filesystem is rooted at "/", so the
 // configured value must never depend on the process working directory.
```

---

### Incident Patch 10: `ad4887b3` (2026-09-28)
**Commit Message**: fix: support vector null predicates (#52442)

issue: #52239

## Summary
- Support IS NULL and IS NOT NULL predicates for ordinary vector fields.
- Read logical-row validity through vector-index HasValidData/IsRowValid
when raw field data is unavailable, remaining compatible with #50524's
Knowhere IdMap ownership.
- Rebase onto current master while preserving master's broader
search-by-PK result reordering and tests.

## Test Plan
- [x] Rebase onto master `38c4699891` with exactly two commits and no
merge commit.
- [x] `git range-diff` confirms both patches are unchanged by the
rebase.
- [x] `git diff --check origin/master...HEAD`
- [x] `go test ./internal/parser/planparserv2`
- [x] `go test -c -o /tmp/milvus-pr-52442-rebased-testcases.test
./testcases` (from `tests/go_client`)
- [x] C++ clang-format, Rust format, and Go format checks.
- [x] `bash scripts/check_segcore_error_boundaries.sh`
- [x] `ruff check` for the four changed Python test files.
- [x] `python3 -m py_compile` for the four changed Python test files.
- [x] Pre-rebase private Release+ASan integration build at `d839d36b`;
the rebased commits are patch-equivalent.
- [ ] CI on rebased head `a9e9d31ff2`.

---------

Signe

**File**: `internal/core/src/common/Types.h` (modified, +5/-0)
```diff
@@ -598,6 +598,11 @@ IsVectorDataType(DataType data_type) {
            IsVectorArrayDataType(data_type);
 }
 
+inline bool
+IsOrdinaryVectorDataType(DataType data_type) {
+    return IsVectorDataType(data_type) && !IsVectorArrayDataType(data_type);
+}
+
 inline bool
 IsVariableDataType(DataType data_type) {
     return IsStringDataType(data_type) || IsBinaryDataType(data_type) ||
```

**File**: `internal/core/src/exec/expression/ExprArrayTest.cpp` (modified, +529/-0)
```diff
@@ -26,6 +26,7 @@
 #include <string>
 #include <string_view>
 #include <tuple>
+#include <unordered_map>
 #include <utility>
 #include <vector>
 
@@ -43,6 +44,7 @@
 #include "filemanager/InputStream.h"
 #include "gtest/gtest.h"
 #include "index/BitmapIndex.h"
+#include "index/VectorIndex.h"
 #include "knowhere/comp/index_param.h"
 #include "pb/plan.pb.h"
 #include "plan/PlanNode.h"
@@ -54,8 +56,10 @@
 #include "segcore/SegcoreConfig.h"
 #include "segcore/SegmentGrowing.h"
 #include "segcore/SegmentGrowingImpl.h"
+#include "segcore/SegmentSealed.h"
 #include "test_utils/DataGen.h"
 #include "test_utils/GenExprProto.h"
+#include "test_utils/SegcoreConfigUtils.h"
 #include "test_utils/storage_test_utils.h"
 #include "test_utils/cachinglayer_test_utils.h"
 
@@ -111,8 +115,251 @@ AssertColumnVector(const ColumnVectorPtr& vec,
     }
 }
 
+std::vector<uint8_t>
+BuildValidBitmap(const FixedVector<bool>& valid_data) {
+    std::vector<uint8_t> valid_bitmap((valid_data.size() + 7) / 8, 0);
+    for (size_t i = 0; i < valid_data.size(); ++i) {
+        if (valid_data[i]) {
+            valid_bitmap[i >> 3] |= 1 << (i & 0x07);
+        }
+    }
+    return valid_bitmap;
+}
+
+int64_t
+CountValidRows(const FixedVector<bool>& valid_data) {
+    return std::count(valid_data.begin(), valid_data.end(), true);
+}
+
+std::vector<float>
+MakeCompactFloatVectors(int64_t valid_count, int64_t dim) {
+    std::vector<float> vectors(valid_count * dim);
+    for (int64_t i = 0; i < valid_count; ++i) {
+        for (int64_t d = 0; d < dim; ++d) {
+            vectors[i * dim + d] = static_cast<float>(i * dim + d);
+        }
+    }
+    return vectors;
+}
+
+std::shared_ptr<expr::NullExpr>
+MakeVectorNullExpr(FieldId field_id,
+                   bool nullable,
+                   proto::plan::NullExpr_NullOp op,
+                   DataType data_type = DataType::VECTOR_FLOAT) {
+    return std::make_shared<expr::NullExpr>(
+        expr::ColumnInfo(field_id, data_type, {}, nullable), op);
+}
+
+std::shared_ptr<plan::FilterBitsNode>
+MakeVectorNullPlan(FieldId field_id,
+                   bool nullable,
+                   proto::plan::NullExpr_NullOp op,
+                   DataType data_type = DataType::VECTOR_FLOAT) {
+    return std::make_shared<plan::FilterBitsNode>(
+        DEFAULT_PLANNODE_ID,
+        MakeVectorNullExpr(field_id, nullable, op, data_type));
+}
+
+IndexMetaPtr
+MakeFloatVectorIndexMeta(FieldId field_id, int64_t dim, int64_t max_rows) {
+    std::map<std::string, std::string> index_params = {
+        {"index_type", knowhere::IndexEnum::INDEX_FAISS_IVFFLAT},
+        {"metric_type", knowhere::metric::L2},
+        {"nlist", "1"}};
+    std::map<std::string, std::string> type_params = {
+        {"dim", std::to_string(dim)}};
+    FieldIndexMeta field_index_meta(
+        field_id, std::move(index_params), std::move(type_params));
+    std::map<FieldId, FieldIndexMeta> field_map = {
+        {field_id, field_index_meta}};
+    return std::make_shared<CollectionIndexMeta>(max_rows,
+                                                 std::move(field_map));
+}
+
+SegmentSealedUPtr
+MakeSealedVectorIndexOnlySegment(const SchemaPtr& schema,
+                                 FieldId vector_fid,
+                                 const FixedVector<bool>& valid_data,
+                                 int64_t dim,
+                                 const std::string& cache_key) {
+    const auto row_count = static_cast<int64_t>(valid_data.size());
+    const auto valid_count = CountValidRows(valid_data);
+    auto vectors =
+        MakeCompactFloatVectors(std::max<int64_t>(valid_count, 1), dim);
+    auto indexing = GenVecIndexing(valid_count,
+                                   dim,
+                                   vectors.data(),
+                                   knowhere::IndexEnum::INDEX_FAISS_IDMAP);
+    auto vec_indexing = dynamic_cast<index::VectorIndex*>(indexing.get());
+    AssertInfo(vec_indexing != nullptr, "invalid generated vector index");
+
+    std::unique_ptr<bool[]> valid_data_bool(new bool[row_count]);
+    for (int64_t i = 0; i < row_count; ++i) {
+        valid_data_bool[i] = valid_data[i];
+    }
+    vec_indexing->SetIdMapType(knowhere::IdMap::Type::SEALED);
+    vec_indexing->GetIdMap().AddFromData(
+        knowhere::IdMapData::FromValidData(valid_data_bool.get(), row_count));
+    vec_indexing->GetIdMap().FinalizeVectorIds();
+
+    auto sealed_segment = CreateSealedSegment(schema);
+    LoadIndexInfo load_index_info;
+    load_index_info.collection_id = kCollectionID;
+    load_index_info.partition_id = kPartitionID;
+    load_index_info.segment_id = kSegmentID;
+    load_index_info.field_id = vector_fid.get();
+    load_index_info.field_type = DataType::VECTOR_FLOAT;
+    load_index_info.element_type = DataType::NONE;
+    load_index_info.enable_mmap = false;
+    load_index_info.index_size = 0;
+    load_index_info.dim = dim;
+    load_index_info.num_rows = row_count;
+    load_index_inf
```

**File**: `internal/core/src/exec/expression/NullExpr.cpp` (modified, +93/-16)
```diff
@@ -16,10 +16,12 @@
 
 #include "NullExpr.h"
 
+#include <algorithm>
 #include <cstdint>
 #include <memory>
 #include <string_view>
 #include <utility>
+#include <vector>
 
 #include "common/Array.h"
 #include "common/EasyAssert.h"
@@ -43,6 +45,7 @@ PhyNullExpr::Eval(EvalCtx& context, VectorPtr& result) {
     span.SetAttribute("data_type", static_cast<int>(expr_->column_.data_type_));
 
     auto input = context.get_offset_input();
+    SetHasOffsetInput(input != nullptr);
     auto data_type = expr_->column_.data_type_;
     if (expr_->column_.element_level_) {
         data_type = expr_->column_.element_type_;
@@ -114,6 +117,15 @@ PhyNullExpr::Eval(EvalCtx& context, VectorPtr& result) {
             }
             break;
         }
+        case DataType::VECTOR_FLOAT:
+        case DataType::VECTOR_BINARY:
+        case DataType::VECTOR_FLOAT16:
+        case DataType::VECTOR_BFLOAT16:
+        case DataType::VECTOR_SPARSE_U32_F32:
+        case DataType::VECTOR_INT8: {
+            result = ExecVectorNull(input);
+            break;
+        }
         default:
             ThrowInfo(UnexpectedError,
                       "unsupported data type: {}",
@@ -123,7 +135,7 @@ PhyNullExpr::Eval(EvalCtx& context, VectorPtr& result) {
 
 void
 PhyNullExpr::DetermineExecPath() {
-    if (expr_->column_.data_type_ == DataType::VECTOR_ARRAY) {
+    if (IsVectorDataType(expr_->column_.data_type_)) {
         exec_path_ = ExprExecPath::RawData;
         return;
     }
@@ -136,6 +148,76 @@ PhyNullExpr::DetermineExecPath() {
     }
 }
 
+void
+PhyNullExpr::MoveCursor() {
+    if (IsOrdinaryVectorDataType(expr_->column_.data_type_)) {
+        if (!has_offset_input_ && !execute_all_at_once_) {
+            current_data_global_pos_ +=
+                std::min(batch_size_, active_count_ - current_data_global_pos_);
+        }
+        return;
+    }
+
+    SegmentExpr::MoveCursor();
+}
+
+bool
+PhyNullExpr::CanExecuteAllAtOnce() const {
+    if (IsOrdinaryVectorDataType(expr_->column_.data_type_)) {
+        return false;
+    }
+    return SegmentExpr::CanExecuteAllAtOnce();
+}
+
+void
+PhyNullExpr::PrefetchRawData() {
+    if (IsOrdinaryVectorDataType(expr_->column_.data_type_)) {
+        return;
+    }
+    SegmentExpr::PrefetchRawData();
+}
+
+VectorPtr
+PhyNullExpr::ExecVectorNull(OffsetVector* input) {
+    if (!expr_->column_.nullable_) {
+        const auto batch_size =
+            input != nullptr
+                ? static_cast<int64_t>(input->size())
+                : std::min(batch_size_,
+                           active_count_ - current_data_global_pos_);
+        if (input == nullptr) {
+            current_data_global_pos_ += batch_size;
+        }
+        return BuildNullResult(TargetBitmap(batch_size, true));
+    }
+
+    if (input != nullptr) {
+        TargetBitmap valid_res(input->size(), true);
+        std::vector<int64_t> offsets(input->begin(), input->end());
+        segment_->ApplyFieldValidDataByOffsets(op_ctx_,
+                                               field_id_,
+                                               offsets.data(),
+                                               offsets.size(),
+                                               TargetBitmapView(valid_res));
+        return BuildNullResult(std::move(valid_res));
+    }
+
+    const auto batch_size =
+        std::min(batch_size_, active_count_ - current_data_global_pos_);
+    TargetBitmap valid_res(batch_size, true);
+    std::vector<int64_t> offsets(batch_size);
+    for (int64_t i = 0; i < batch_size; ++i) {
+        offsets[i] = current_data_global_pos_ + i;
+    }
+    segment_->ApplyFieldValidDataByOffsets(op_ctx_,
+                                           field_id_,
+                                           offsets.data(),
+                                           offsets.size(),
+                                           TargetBitmapView(valid_res));
+    current_data_global_pos_ += batch_size;
+    return BuildNullResult(std::move(valid_res));
+}
+
 template <typename T>
 VectorPtr
 PhyNullExpr::ExecVisitorImpl(OffsetVector* input) {
@@ -146,13 +228,7 @@ PhyNullExpr::ExecVisitorImpl(OffsetVector* input) {
         (input != nullptr)
             ? ProcessChunksForValidByOffsets<T>(UseIndexCursor(), *input)
             : ProcessChunksForValid<T>(UseIndexCursor());
-    TargetBitmap res = valid_res.clone();
-    if (expr_->op_ == proto::plan::NullExpr_NullOp_IsNull) {
-        res.flip();
-    }
-    auto res_vec = std::make_shared<ColumnVector>(
-        std::move(res), TargetBitmap(valid_res.size(), true));
-    return res_vec;
+    return BuildNullResult(std::move(valid_res));
 }
 
 // if nullable is false, no need to process chunks
@@ -173,26 +249,27 @@ PhyNullExpr::PreCheckNullable(OffsetVector* input) {
         precheck_pos_ += batch_size;
     }
 
-    auto res_vec = std::make_shared<ColumnVector>(TargetBitmap(batch_size),
-                                                  TargetBitmap(batch_size));

```

**File**: `internal/core/src/exec/expression/NullExpr.h` (modified, +15/-0)
```diff
@@ -55,9 +55,18 @@ class PhyNullExpr : public SegmentExpr {
     void
     Eval(EvalCtx& context, VectorPtr& result) override;
 
+    void
+    MoveCursor() override;
+
+    bool
+    CanExecuteAllAtOnce() const override;
+
     void
     DetermineExecPath() override;
 
+    void
+    PrefetchRawData() override;
+
     std::string
     ToString() const override {
         return fmt::format("{}", expr_->ToString());
@@ -77,6 +86,12 @@ class PhyNullExpr : public SegmentExpr {
     ColumnVectorPtr
     PreCheckNullable(OffsetVector* input);
 
+    ColumnVectorPtr
+    BuildNullResult(TargetBitmap&& field_valid) const;
+
+    VectorPtr
+    ExecVectorNull(OffsetVector* input);
+
     template <typename T>
     VectorPtr
     ExecVisitorImpl(OffsetVector* input);
```

**File**: `internal/core/src/segcore/ChunkedSegmentSealedImpl.cpp` (modified, +24/-0)
```diff
@@ -3882,6 +3882,30 @@ ChunkedSegmentSealedImpl::ApplyFieldValidDataByOffsets(
     }
 
     auto snapshot = CapturePublishedState();
+    auto& field_meta = snapshot->schema->operator[](field_id);
+    if (!field_meta.is_nullable()) {
+        return;
+    }
+
+    if (IsOrdinaryVectorDataType(field_meta.get_data_type())) {
+        auto vector_entry = GetVectorIndexing(snapshot->runtime, field_id);
+        if (vector_entry != nullptr) {
+            auto ca =
+                SemiInlineGet(vector_entry->indexing_->PinCells(op_ctx, {0}));
+            auto vec_index =
+                dynamic_cast<index::VectorIndex*>(ca->get_cell_of(0));
+            AssertInfo(vec_index != nullptr, "invalid vector indexing");
+            if (vec_index->HasValidData()) {
+                for (int64_t i = 0; i < count; ++i) {
+                    if (!vec_index->IsRowValid(offsets[i])) {
+                        valid_result[i] = false;
+                    }
+                }
+                return;
+            }
+        }
+    }
+
     std::shared_ptr<ChunkedColumnInterface> column;
     AssertInfo(get_bit(snapshot->field_data_ready_bitset, field_id),
                "Can't get bitset element at " + std::to_string(field_id.get()));
```

**File**: `internal/core/src/segcore/SegmentGrowingImpl.cpp` (modified, +19/-1)
```diff
@@ -1566,9 +1566,27 @@ SegmentGrowingImpl::ApplyFieldValidDataByOffsets(
         return;
     }
 
+    if (IsOrdinaryVectorDataType(field_meta.get_data_type()) &&
+        indexing_record_.SyncDataWithIndex(field_id)) {
+        const auto& field_indexing =
+            indexing_record_.get_vec_field_indexing(field_id);
+        auto indexing = field_indexing.get_segment_indexing();
+        auto vec_index = dynamic_cast<index::VectorIndex*>(indexing.get());
+        if (vec_index != nullptr && vec_index->HasValidData()) {
+            for (int64_t i = 0; i < count; ++i) {
+                if (!vec_index->IsRowValid(offsets[i])) {
+                    valid_result[i] = false;
+                }
+            }
+            return;
+        }
+    }
+
     auto valid_vec_ptr = insert_record_.get_valid_data(field_id);
+    std::unique_ptr<bool[]> valid_data(new bool[count]);
+    valid_vec_ptr->bulk_is_valid(offsets, count, valid_data.get());
     for (int64_t i = 0; i < count; ++i) {
-        if (!valid_vec_ptr->is_valid(offsets[i])) {
+        if (!valid_data[i]) {
             valid_result[i] = false;
         }
     }
```

**File**: `internal/parser/planparserv2/parser_visitor.go` (modified, +0/-12)
```diff
@@ -1449,10 +1449,6 @@ func (v *ParserVisitor) getNullExprColumnInfo(identifier, child antlr.TerminalNo
 	return v.getChildColumnInfo(identifier, child, nil, nil)
 }
 
-func isUnsupportedNullExprVectorType(dataType schemapb.DataType) bool {
-	return typeutil.IsVectorType(dataType) && !typeutil.IsVectorArrayType(dataType)
-}
-
 // VisitCall parses the expr to call plan.
 func (v *ParserVisitor) VisitCall(ctx *parser.CallContext) interface{} {
 	functionName := strings.ToLower(ctx.Identifier().GetText())
@@ -2447,10 +2443,6 @@ func (v *ParserVisitor) VisitIsNotNull(ctx *parser.IsNotNullContext) interface{}
 		return err
 	}
 
-	if isUnsupportedNullExprVectorType(column.DataType) {
-		return merr.WrapErrParameterInvalidMsg("IsNull/IsNotNull operations are not supported on vector fields")
-	}
-
 	if len(column.NestedPath) != 0 {
 		if typeutil.IsArrayType(column.GetDataType()) {
 			return merr.WrapErrParameterInvalidMsg("IsNull/IsNotNull operations are not supported on array element access, got: %s", ctx.GetText())
@@ -2494,10 +2486,6 @@ func (v *ParserVisitor) VisitIsNull(ctx *parser.IsNullContext) interface{} {
 		return err
 	}
 
-	if isUnsupportedNullExprVectorType(column.DataType) {
-		return merr.WrapErrParameterInvalidMsg("IsNull/IsNotNull operations are not supported on vector fields")
-	}
-
 	if len(column.NestedPath) != 0 {
 		if typeutil.IsArrayType(column.GetDataType()) {
 			return merr.WrapErrParameterInvalidMsg("IsNull/IsNotNull operations are not supported on array element access, got: %s", ctx.GetText())
```

**File**: `internal/parser/planparserv2/plan_parser_v2_test.go` (modified, +12/-12)
```diff
@@ -1399,19 +1399,19 @@ func TestExpr_IsNull(t *testing.T) {
 		`VarCharField IS NULL`,
 		`ArrayField is null`,
 		`StringArrayField IS NULL`,
+		`FloatVectorField is null`,
+		`BinaryVectorField is null`,
+		`Float16VectorField is null`,
+		`BFloat16VectorField is null`,
+		`SparseFloatVectorField is null`,
+		`Int8VectorField is null`,
 	}
 	for _, exprStr := range exprStrs {
 		assertValidExpr(t, helper, exprStr)
 	}
 
 	unsupported := []string{
 		`not_exist is null`,
-		`FloatVectorField is null`,
-		`BinaryVectorField is null`,
-		`Float16VectorField is null`,
-		`BFloat16VectorField is null`,
-		`SparseFloatVectorField is null`,
-		`Int8VectorField is null`,
 		// issue #48904: array element access with IS NULL should be
 		// rejected at parse time rather than raising an internal error
 		// at execution time.
@@ -1501,19 +1501,19 @@ func TestExpr_IsNotNull(t *testing.T) {
 		`VarCharField IS NOT NULL`,
 		`ArrayField is not null`,
 		`StringArrayField IS NOT NULL`,
+		`FloatVectorField is not null`,
+		`BinaryVectorField is not null`,
+		`Float16VectorField is not null`,
+		`BFloat16VectorField is not null`,
+		`SparseFloatVectorField is not null`,
+		`Int8VectorField is not null`,
 	}
 	for _, exprStr := range exprStrs {
 		assertValidExpr(t, helper, exprStr)
 	}
 
 	unsupported := []string{
 		`not_exist is not null`,
-		`FloatVectorField is not null`,
-		`BinaryVectorField is not null`,
-		`Float16VectorField is not null`,
-		`BFloat16VectorField is not null`,
-		`SparseFloatVectorField is not null`,
-		`Int8VectorField is not null`,
 		// issue #48904: array element access with IS NOT NULL should be
 		// rejected at parse time rather than raising an internal error
 		// at execution time.
```

---

### Incident Patch 11: `d2c77fd9` (2026-09-28)
**Commit Message**: fix: complete strict groups with per-group filtered search (#53471)

## Summary

Fixes #53277

Complete strict groups with ordinary per-group filtered Search. Only
single-query strict grouping with group_size > 1 is eligible; preserve
visibility, null semantics and typed backend errors.

## Configuration / migration

- `queryNode.groupBy.strictGroupStrategy`: `per_group` or `original`.
- `queryNode.groupBy.strictGroupPhase1CandidateWeight`: nonnegative
integer; default 0 disables truncation. Effective phase-one consumer
Next limit is `topk * group_size * weight`, saturating at INT64_MAX on
overflow. It never limits completion of already locked groups.
Truncation may reduce recall.
- Weight 50 with gs=3 gives limits 1500 at topK=10 and 7500 at topK=50.
- `queryNode.groupBy.strictGroupSkipRefine`: default false;
`queryNode.groupBy.strictGroupDebug`: default false.

## Local validation

- Config YAML consistency, optimizer/config snapshots, and ParamTable
refresh/reset tests passed; core, all_tests and the dynamic Go
executable built successfully.
- 60 targeted C++ regressions passed, including HNSW ef handling,
weighted cutoff/completion, overflow, unsupported iterator errors,
nullab

**File**: `configs/milvus.yaml` (modified, +3/-2)
```diff
@@ -626,8 +626,9 @@ queryCoord:
 # Related configuration of queryNode, used to run hybrid search between vector and scalar data.
 queryNode:
   groupBy:
-    strictGroupAcceptanceThreshold: 0.1 # Recreate a strict group iterator only below this acceptance ratio [0,1]. Zero disables the optimization.
-    strictGroupProbeCandidates: 100 # Positive consumer candidate budget after locking strict groups, not a backend graph visit budget.
+    strictGroupStrategy: per_group # Strict group completion strategy: original or per_group. Independent phase-one and refinement controls still apply to original.
+    strictGroupPhase1CandidateWeight: 0 # Strict group phase-one consumer Next limit is topk * group_size * weight; zero disables truncation. Overflow saturates at INT64_MAX. Only group discovery is limited; completion is not. May reduce recall.
+    strictGroupSkipRefine: false # Skip query-time refinement consistently in both phases of single-query strict grouping with group size greater than one. May reduce recall.
   stats:
     publishInterval: 1000 # The interval that query node publishes the node statistics information, including segment status, cpu usage, memory usage, health status, etc. Unit: ms.
   segcore:
```

**File**: `internal/core/src/common/Consts.h` (modified, +4/-4)
```diff
@@ -22,10 +22,10 @@
 #include "knowhere/comp/index_param.h"
 
 const int64_t INVALID_FIELD_ID = -1;
-inline constexpr char kStrictGroupAcceptanceThreshold[] =
-    "strict_group_acceptance_threshold";
-inline constexpr char kStrictGroupProbeCandidates[] =
-    "strict_group_probe_candidates";
+inline constexpr char kStrictGroupStrategy[] = "strict_group_strategy";
+inline constexpr char kStrictGroupPhase1CandidateWeight[] =
+    "strict_group_phase1_candidate_weight";
+inline constexpr char kStrictGroupSkipRefine[] = "strict_group_skip_refine";
 const int64_t INVALID_SEG_OFFSET = -1;
 const int64_t INVALID_ARRAY_INDEX = -1;
 const milvus::PkType INVALID_PK;  // of std::monostate if not set.
```

**File**: `internal/core/src/common/QueryInfo.h` (modified, +6/-2)
```diff
@@ -26,6 +26,8 @@
 
 namespace milvus {
 
+enum class StrictGroupStrategy { Original, PerGroup };
+
 struct SearchIteratorV2Info {
     std::string token = "";
     uint32_t batch_size = 0;
@@ -46,8 +48,10 @@ struct SearchInfo {
     int64_t topk_{0};
     int64_t group_size_{1};
     bool strict_group_size_{false};
-    double strict_group_acceptance_threshold_{0.1};
-    int64_t strict_group_probe_candidates_{100};
+    StrictGroupStrategy strict_group_strategy_{StrictGroupStrategy::PerGroup};
+    int64_t strict_group_phase1_candidate_weight_{0};
+    bool strict_group_skip_refine_{false};
+
     int64_t round_decimal_{0};
     FieldId field_id_;
     MetricType metric_type_;
```

**File**: `internal/core/src/common/QueryResult.h` (modified, +50/-59)
```diff
@@ -209,8 +209,8 @@ class ChunkMergeIterator : public VectorIterator {
 };
 
 struct SearchResult {
-    using VectorIteratorRecreateFn =
-        std::function<void(const BitsetView&, SearchResult&)>;
+    using FilteredVectorSearchFn =
+        std::function<void(const BitsetView&, int64_t, SearchResult&)>;
     SearchResult() = default;
 
     int64_t
@@ -269,36 +269,30 @@ struct SearchResult {
     }
 
     void
-    SetVectorIteratorRecreator(const BitsetView& base_filter,
-                               VectorIteratorRecreateFn recreate_fn) {
-        vector_iterator_base_filter_.reset();
-        vector_iterator_base_filter_view_ = base_filter;
-        // The execution pipeline shares its input column. Direct low-level
-        // callers without an owner retain the original defensive-copy contract.
-        if (!vector_iterator_filter_owner_) {
-            GetVectorIteratorBaseFilter();
+    SetVectorSearchProvider(const BitsetView& base_filter,
+                            FilteredVectorSearchFn provider) {
+        vector_search_base_filter_.reset();
+        vector_search_base_filter_view_ = base_filter;
+        // The execution pipeline owns its input column. Direct callers without
+        // an owner retain a defensive copy of their filter.
+        if (!vector_search_filter_owner_) {
+            GetVectorSearchBaseFilter();
         }
-        vector_iterator_recreate_fn_ = std::move(recreate_fn);
+        filtered_vector_search_fn_ = std::move(provider);
     }
 
     void
-    ClearVectorIteratorRecreator() {
-        vector_iterator_recreate_fn_ = {};
-        vector_iterator_base_filter_view_ = {};
-        vector_iterator_base_filter_.reset();
-        vector_iterator_filter_owner_.reset();
-    }
-
-    bool
-    CanRecreateVectorIterator() const {
-        return allow_vector_iterator_recreation_ &&
-               static_cast<bool>(vector_iterator_recreate_fn_);
+    ClearVectorSearchProvider() {
+        filtered_vector_search_fn_ = {};
+        vector_search_base_filter_view_ = {};
+        vector_search_base_filter_.reset();
+        vector_search_filter_owner_.reset();
     }
 
     const TargetBitmap*
-    GetVectorIteratorBaseFilter() {
-        const auto& base_filter = vector_iterator_base_filter_view_;
-        if (!vector_iterator_base_filter_ && !base_filter.empty()) {
+    GetVectorSearchBaseFilter() {
+        const auto& base_filter = vector_search_base_filter_view_;
+        if (!vector_search_base_filter_ && !base_filter.empty()) {
             auto copied_filter =
                 std::make_unique<TargetBitmap>(base_filter.size(), false);
             if (!base_filter.has_out_ids()) {
@@ -310,44 +304,41 @@ struct SearchResult {
                     (*copied_filter)[i] = base_filter.test(i);
                 }
             }
-            vector_iterator_base_filter_ = std::move(copied_filter);
-            vector_iterator_base_filter_view_ =
-                BitsetView(*vector_iterator_base_filter_);
+            vector_search_base_filter_ = std::move(copied_filter);
+            vector_search_base_filter_view_ =
+                BitsetView(*vector_search_base_filter_);
         }
-        return vector_iterator_base_filter_.get();
+        return vector_search_base_filter_.get();
     }
 
-    // The returned SearchResult owns every bitmap and raw chunk buffer used by
-    // its iterators. Keep it alive while consuming the batch, then release it
-    // before recreating the next batch.
+    bool
+    CanSearchFilteredVectors() const {
+        return allow_filtered_vector_search_ &&
+               static_cast<bool>(filtered_vector_search_fn_);
+    }
+
+    // Synchronous ordinary top-k search. Serial callers may reuse the bitmap
+    // after releasing the result; each invocation gets a fresh BitsetView.
     std::optional<std::unique_ptr<SearchResult>>
-    RecreateVectorIterators(TargetBitmap additional_filter) {
-        if (!CanRecreateVectorIterator()) {
+    SearchFilteredVectors(const std::shared_ptr<TargetBitmap>& filter,
+                          int64_t topk) {
+        if (!filter || topk <= 0 || !CanSearchFilteredVectors()) {
             return std::nullopt;
         }
-        GetVectorIteratorBaseFilter();
-        if (vector_iterator_base_filter_ != nullptr &&
-            vector_iterator_base_filter_->size() != additional_filter.size()) {
+        const auto* base = GetVectorSearchBaseFilter();
+        if (base && base->size() != filter->size()) {
             return std::nullopt;
         }
-
-        auto combined_filter = std::move(additional_filter);
-        if (vector_iterator_base_filter_ != nullptr) {
-            combined_filter |= *vector_iterator_base_filter_;
-        }
-
-        auto recreated_result = std::make_unique<SearchResult>();
-        recreated_result->allow_vector_iterator_recreation_ = false;
-        auto combined_view =
-            recreated_result->PinBitset(std::move(combined_filter));
-        vector_iterator_
```

**File**: `internal/core/src/exec/operator/Utils.h` (modified, +8/-6)
```diff
@@ -120,6 +120,7 @@ PrepareVectorIteratorsFromIndex(const SearchInfo& search_info,
     if (UseVectorIterator(search_info)) {
         try {
             auto search_conf = index.PrepareSearchParams(search_info);
+            query::ApplyStrictGroupSkipRefine(search_info, nq, search_conf);
             knowhere::expected<std::vector<knowhere::IndexNode::IteratorPtr>>
                 iterators_val = index.VectorIterators(
                     dataset, search_conf, bitset, op_context);
@@ -140,12 +141,13 @@ PrepareVectorIteratorsFromIndex(const SearchInfo& search_info,
                     "inside, terminate {} operation:{}",
                     operator_type,
                     knowhere::Status2String(iterators_val.error()));
-                ThrowInfo(
-                    ErrorCode::Unsupported,
-                    fmt::format(
-                        "Returned knowhere iterator has non-ready iterators "
-                        "inside, terminate {} operation",
-                        operator_type));
+                ThrowInfo(ErrorCode::Unsupported,
+                          fmt::format(
+                              "Failed to {}, current index:{} doesn't support "
+                              "the requested iterator operation: {}",
+                              operator_type,
+                              index.GetIndexType(),
+                              knowhere::Status2String(iterators_val.error())));
             }
             search_result.total_nq_ = nq;
             search_result.unity_topK_ = search_info.topk_;
```

**File**: `internal/core/src/exec/operator/VectorSearchNode.cpp` (modified, +2/-2)
```diff
@@ -187,9 +187,9 @@ PhyVectorSearchNode::GetOutput() {
 
     // Single search + metrics path
     milvus::SearchResult search_result;
-    if (query::CanUseStrictGroupFilteredIterator(search_info_, num_queries) &&
+    if (query::CanUseStrictGroupSearch(search_info_, num_queries) &&
         !search_view.empty()) {
-        search_result.vector_iterator_filter_owner_ = GetColumnVector(input_);
+        search_result.vector_search_filter_owner_ = GetColumnVector(input_);
     }
     auto op_context = query_context_->get_op_context();
     segment_->vector_search(search_info_,
```

**File**: `internal/core/src/exec/operator/search-groupby/GroupMembership.cpp` (modified, +46/-136)
```diff
@@ -18,9 +18,8 @@
 
 #include <algorithm>
 #include <memory>
-#include <unordered_set>
+#include <unordered_map>
 
-#include "index/ScalarIndex.h"
 #include "segcore/SegmentChunkReader.h"
 #include "segcore/SegmentGrowingImpl.h"
 #include "segcore/Utils.h"
@@ -36,70 +35,6 @@ IsEligible(const TargetBitmap* base_filter, size_t offset) {
     return base_filter == nullptr || !(*base_filter)[offset];
 }
 
-void
-ApplyBaseFilter(TargetBitmap& membership, const TargetBitmap* base_filter) {
-    if (base_filter == nullptr) {
-        return;
-    }
-    membership -= *base_filter;
-}
-
-template <typename T>
-std::optional<TargetBitmap>
-BuildIndexMembership(const segcore::PinnedIndexView& pinned_indexes,
-                     size_t row_count,
-                     const std::vector<GroupKey<T>>& groups,
-                     const TargetBitmap* base_filter) {
-    if (pinned_indexes.empty()) {
-        return std::nullopt;
-    }
-
-    // Avoid vector<bool>: ScalarIndex<bool>::In needs a contiguous bool array.
-    auto values = std::make_unique<T[]>(groups.size());
-    size_t value_count = 0;
-    bool include_null = false;
-    for (const auto& group : groups) {
-        if (group.has_value()) {
-            values[value_count++] = *group;
-        } else {
-            include_null = true;
-        }
-    }
-    TargetBitmap membership;
-    membership.reserve(row_count);
-    size_t remaining = row_count;
-    for (auto& pinned_index : pinned_indexes) {
-        auto scalar_index =
-            dynamic_cast<const index::ScalarIndex<T>*>(pinned_index.get());
-        if (scalar_index == nullptr) {
-            return std::nullopt;
-        }
-        auto* mutable_index = const_cast<index::ScalarIndex<T>*>(scalar_index);
-        auto chunk_membership =
-            value_count > 0 ? mutable_index->In(value_count, values.get())
-                            : TargetBitmap(mutable_index->Count(), false);
-        if (include_null) {
-            auto matches = mutable_index->IsNull();
-            if (matches.size() != chunk_membership.size()) {
-                return std::nullopt;
-            }
-            chunk_membership |= matches;
-        }
-
-        auto append_size = std::min(remaining, chunk_membership.size());
-        membership.append(chunk_membership, 0, append_size);
-        remaining -= append_size;
-        if (remaining == 0) {
-            break;
-        }
-    }
-    if (membership.size() != row_count) {
-        return std::nullopt;
-    }
-    ApplyBaseFilter(membership, base_filter);
-    return membership;
-}
-
 template <typename T, typename Visitor>
 bool
 ScanRawField(milvus::OpContext* op_ctx,
@@ -190,81 +125,56 @@ ScanRawField(milvus::OpContext* op_ctx,
 }  // namespace
 
 template <typename T>
-std::optional<TargetBitmap>
-BuildGroupMembership(milvus::OpContext* op_ctx,
-                     const segcore::SegmentInternalInterface& segment,
-                     FieldId field_id,
-                     int64_t row_count,
-                     const std::vector<GroupKey<T>>& groups,
-                     const TargetBitmap* base_filter) {
-    if (row_count < 0 ||
-        (base_filter != nullptr &&
-         base_filter->size() != static_cast<size_t>(row_count))) {
+std::optional<std::vector<std::vector<int64_t>>>
+BuildGroupOffsets(milvus::OpContext* op_ctx,
+                  const segcore::SegmentInternalInterface& segment,
+                  FieldId field_id,
+                  int64_t row_count,
+                  const std::vector<GroupKey<T>>& groups,
+                  const TargetBitmap* base_filter) {
+    if (row_count < 0 || (base_filter && base_filter->size() !=
+                                             static_cast<size_t>(row_count))) {
         return std::nullopt;
     }
-    auto count = static_cast<size_t>(row_count);
-    // Match phase one's raw-first access policy. Do not pin an unused index.
-    if (segment.HasFieldData(field_id)) {
-        std::unordered_set<GroupKey<T>> target_groups(groups.begin(),
-                                                      groups.end());
-        TargetBitmap membership(count, false);
-        auto scanned = ScanRawField<T>(
-            op_ctx, segment, field_id, count, [&](size_t offset, auto group) {
-                if (IsEligible(base_filter, offset) &&
-                    target_groups.find(group) != target_groups.end()) {
-                    membership[offset] = true;
-                }
-            });
-        if (scanned) {
-            return membership;
+    std::unordered_map<GroupKey<T>, size_t> group_ids;
+    for (size_t i = 0; i < groups.size(); ++i) {
+        if (!group_ids.emplace(groups[i], i).second) {
+            return std::nullopt;
         }
     }
-    auto indexes = segment.PinIndex(op_ctx, field_id);
-    return BuildIndexMembership<T>(indexes, count, groups, base_filter);
+    std::vector<std::vector<int64_t>> offsets(groups.size());
+    if (!ScanRawField<T>(op_ctx,
+               
```

**File**: `internal/core/src/exec/operator/search-groupby/GroupMembership.h` (modified, +10/-10)
```diff
@@ -25,16 +25,16 @@
 
 namespace milvus::exec {
 
-// `base_filter` uses vector-search semantics: one means invalid. The returned
-// membership bitmap uses scalar-index semantics: one means that the eligible
-// row belongs to one of the requested groups.
+// One raw-column pass classifies eligible logical row offsets into groups.
+// Missing or incomplete raw data returns nullopt; retain the original iterator
+// rather than rescanning an indexed column once for each target group.
 template <typename T>
-std::optional<TargetBitmap>
-BuildGroupMembership(milvus::OpContext* op_ctx,
-                     const segcore::SegmentInternalInterface& segment,
-                     FieldId field_id,
-                     int64_t row_count,
-                     const std::vector<std::optional<T>>& groups,
-                     const TargetBitmap* base_filter);
+std::optional<std::vector<std::vector<int64_t>>>
+BuildGroupOffsets(milvus::OpContext* op_ctx,
+                  const segcore::SegmentInternalInterface& segment,
+                  FieldId field_id,
+                  int64_t row_count,
+                  const std::vector<std::optional<T>>& groups,
+                  const TargetBitmap* base_filter);
 
 }  // namespace milvus::exec
```

---

### Incident Patch 12: `0277d6c1` (2026-09-28)
**Commit Message**: fix: keep short or NUL-bearing ngram literals from aborting the QueryNode (#53709)

issue: #53661

## Problem

A `LIKE` literal whose wildcard-free part is a single multi-byte UTF-8
character (`title like '%）%'`, `'订%'`, `'%）'`, `'%abc%）%'`) aborted the
whole QueryNode on 2.6: the C++ ngram gate compared **bytes** (`3 >=
min_gram=2`), the rust binding `assert!`ed on **chars** (`1 < 2`), and a
panic under an `extern "C"` frame cannot unwind, so rust aborted the
process. Every client retry killed the node again.

## What master already had

#51238 moved `NgramInvertedIndex::CanHandleLiteral` to UTF-8 character
counts, which closes the reported trigger on master. This PR closes the
gaps it left so this path can no longer take the process down, and so
the C++ and rust sides always reason about the same literal:

1. **The rust side could still abort the process.** Any future
divergence between the C++ gate and the rust check would hit the same
`assert!`. `ngram_match_query` / `ngram_tokenize` now return
`Err(InternalError)`; `AssertTantivyOk` turns that into a `SegcoreError`
and the query fails instead of the node.
2. **One divergence already existed: embedded NUL.** The ngram FFI
passe

**File**: `internal/core/src/index/NgramInvertedIndex.cpp` (modified, +6/-2)
```diff
@@ -1017,9 +1017,13 @@ NgramInvertedIndex::ExecutePhase2(const std::string& literal,
                                   TargetBitmap& candidates,
                                   int64_t segment_offset,
                                   int64_t batch_size) {
-    // InnerMatch with short literal doesn't need post-filter
+    // InnerMatch with a literal of at most max_gram chars needs no
+    // post-filter: the literal is itself an indexed gram and rust answers it
+    // with an exact term query. Count chars, as rust does; byte length would
+    // send every short multi-byte (e.g. CJK) literal through a redundant
+    // full post-filter.
     if (op_type == proto::plan::OpType::InnerMatch &&
-        literal.length() <= max_gram_) {
+        Utf8LiteralLength(literal) <= max_gram_) {
         return;
     }
 
```

**File**: `internal/core/src/index/NgramInvertedIndex.h` (modified, +2/-1)
```diff
@@ -71,7 +71,8 @@ class NgramInvertedIndex : public InvertedIndexTantivy<std::string> {
                       exec::SegmentExpr* segment,
                       const TargetBitmap* pre_filter = nullptr);
 
-    // Check if literal can be handled by ngram index (length >= min_gram)
+    // Check if literal can be handled by ngram index: every wildcard-free
+    // part has >= min_gram UTF-8 characters.
     bool
     CanHandleLiteral(const std::string& literal,
                      proto::plan::OpType op_type) const;
```

**File**: `internal/core/src/index/NgramInvertedIndexTest.cpp` (modified, +166/-0)
```diff
@@ -1584,6 +1584,172 @@ TEST(NgramPatternMatchConsistency, CanHandleLiteralUsesUtf8CharacterCount) {
     }
 }
 
+// End-to-end shape of the reported crash: a LIKE literal (or wildcard-free
+// part) that is a single multi-byte UTF-8 character. 3 bytes pass a
+// byte-length min_gram gate, the rust binding counts 1 char and used to
+// panic across the FFI, aborting the QueryNode. The literal must be
+// forwarded to brute force and the filter must still produce the right rows.
+TEST(NgramPatternMatchConsistency, SingleMultiByteCharLiteralFallsBack) {
+    boost::container::vector<std::string> test_data = {
+        "订单（已取消）",
+        "中文测试",
+        "hello world",
+        "abc）",
+    };
+
+    struct TestCase {
+        std::string literal;
+        proto::plan::OpType op_type;
+        std::string like_pattern;
+    };
+    std::vector<TestCase> test_cases = {
+        {"）", proto::plan::OpType::InnerMatch, "%）%"},
+        {"订", proto::plan::OpType::PrefixMatch, "订%"},
+        {"）", proto::plan::OpType::PostfixMatch, "%）"},
+        {"%abc%）%", proto::plan::OpType::Match, "%abc%）%"},
+        // 2-byte and 4-byte characters take the same path
+        {"é", proto::plan::OpType::InnerMatch, "%é%"},
+        {"😀", proto::plan::OpType::InnerMatch, "%😀%"},
+    };
+
+    for (const auto& test_case : test_cases) {
+        ASSERT_GE(test_case.literal.size(), 2)
+            << "literal must be >= min_gram bytes for this test to matter";
+        PatternMatchTranslator translator;
+        RegexMatcher re2_matcher(translator(test_case.like_pattern));
+        std::vector<bool> expected_results;
+        for (const auto& data : test_data) {
+            expected_results.push_back(re2_matcher(data));
+        }
+        test_ngram_with_data(test_data,
+                             test_case.literal,
+                             test_case.op_type,
+                             expected_results,
+                             /*forward_to_br=*/true);
+    }
+}
+
+// A literal with an interior NUL must cross the ngram FFI intact: the entry
+// points take (pointer, length), so rust checks and queries the same literal
+// the C++ gate saw. The InnerMatch case below is <= max_gram chars and skips
+// the post-filter, so a truncated "ab" would have returned "xabzz" as a
+// false positive.
+TEST(NgramPatternMatchConsistency, EmbeddedNulLiteralIsHandledByNgram) {
+    const std::string nul_row("xab\0cy", 6);
+    const std::string nul_short("ab\0c", 4);
+    boost::container::vector<std::string> test_data = {
+        nul_row, "xabzz", "hello", nul_short};
+
+    struct TestCase {
+        std::string literal;
+        proto::plan::OpType op_type;
+        std::vector<bool> expected;
+    };
+    std::vector<TestCase> test_cases = {
+        {nul_short,
+         proto::plan::OpType::InnerMatch,
+         {true, false, false, true}},
+        {nul_short,
+         proto::plan::OpType::PrefixMatch,
+         {false, false, false, true}},
+        {std::string("b\0c", 3),
+         proto::plan::OpType::PostfixMatch,
+         {false, false, false, true}},
+        {"%xa%" + std::string("\0cy", 3) + "%",
+         proto::plan::OpType::Match,
+         {true, false, false, false}},
+    };
+    for (const auto& test_case : test_cases) {
+        test_ngram_with_data(test_data,
+                             test_case.literal,
+                             test_case.op_type,
+                             test_case.expected,
+                             /*forward_to_br=*/false);
+    }
+}
+
+TEST(NgramPatternMatchConsistency, EmbeddedNulCrossesFfiIntact) {
+    auto path = TestLocalPath + "ngram_nul_ffi/";
+    boost::filesystem::remove_all(path);
+    boost::filesystem::create_directories(path);
+
+    milvus::tantivy::TantivyIndexWrapper wrapper(
+        "ngram", path.c_str(), uintptr_t{2}, uintptr_t{4});
+    std::vector<std::string> data = {std::string("xab\0cy", 6), "xabzz"};
+    wrapper.add_data<std::string>(data.data(), data.size(), 0);
+    wrapper.finish();
+    wrapper.create_reader(milvus::index::SetBitsetSealed);
+
+    const std::string nul_literal("ab\0c", 4);
+    {
+        TargetBitmap bitset(data.size());
+        wrapper.ngram_match_query(nul_literal, 2, 4, &bitset);
+        EXPECT_TRUE(bitset[0]);
+        EXPECT_FALSE(bitset[1]) << "literal truncated at NUL to \"ab\"";
+    }
+    {
+        auto terms = wrapper.ngram_tokenize({nul_literal}, 2, 4);
+        ASSERT_EQ(terms.size(), 1);
+        EXPECT_EQ(terms[0], nul_literal);
+        TargetBitmap bitset(data.size());
+        wrapper.ngram_term_posting_list(terms[0], &bitset);
+        EXPECT_TRUE(bitset[0]);
+        EXPECT_FALSE(bitset[1]);
+    }
+    {
+        // longer than max_gram: split into 4-char grams, each carrying the NUL
+        auto terms = wrapper.ngram_tokenize({data[0]}, 2, 4);
+        ASSERT_EQ(terms.size(), 3);
+        for (const auto& term : terms) {
+            EXPECT_EQ(term.size(), 4) << "term lost bytes at NUL";

```

**File**: `internal/core/thirdparty/tantivy/tantivy-binding/include/tantivy-binding.h` (modified, +11/-3)
```diff
@@ -54,11 +54,14 @@ struct RustArrayI64 {
   size_t cap;
 };
 
-/// Array of C strings (char*) for returning Vec<String> to C++
+/// Array of byte strings for returning Vec<String> to C++. Each element is
+/// `array[i]` with `lens[i]` bytes, NOT NUL-terminated: the strings are index
+/// terms that may legitimately contain interior NUL bytes, which a C string
+/// cannot carry. `array` and `lens` are boxed slices of `len` elements.
 struct RustStringArray {
   char **array;
+  size_t *lens;
   size_t len;
-  size_t cap;
 };
 
 struct Value {
@@ -398,17 +401,22 @@ RustResult tantivy_json_prefix_query(void *ptr,
 
 RustResult tantivy_ngram_match_query(void *ptr,
                                      const char *literal,
+                                     uintptr_t literal_len,
                                      uintptr_t min_gram,
                                      uintptr_t max_gram,
                                      void *bitset);
 
 RustResult tantivy_ngram_tokenize(void *ptr,
                                   const char *const *literals,
+                                  const uintptr_t *literal_lens,
                                   uintptr_t literals_len,
                                   uintptr_t min_gram,
                                   uintptr_t max_gram);
 
-RustResult tantivy_ngram_term_posting_list(void *ptr, const char *term, void *bitset);
+RustResult tantivy_ngram_term_posting_list(void *ptr,
+                                           const char *term,
+                                           uintptr_t term_len,
+                                           void *bitset);
 
 RustResult tantivy_match_query(void *ptr,
                                const char *query,
```

**File**: `internal/core/thirdparty/tantivy/tantivy-binding/src/array.rs` (modified, +70/-22)
```diff
@@ -98,33 +98,32 @@ pub extern "C" fn free_rust_array_i64(array: RustArrayI64) {
     }
 }
 
-/// Array of C strings (char*) for returning Vec<String> to C++
+/// Array of byte strings for returning Vec<String> to C++. Each element is
+/// `array[i]` with `lens[i]` bytes, NOT NUL-terminated: the strings are index
+/// terms that may legitimately contain interior NUL bytes, which a C string
+/// cannot carry. `array` and `lens` are boxed slices of `len` elements.
 #[repr(C)]
 pub struct RustStringArray {
     pub array: *mut *mut c_char,
+    pub lens: *mut size_t,
     pub len: size_t,
-    pub cap: size_t,
 }
 
 impl RustStringArray {
     pub fn from_vec(vec: Vec<String>) -> RustStringArray {
         let len = vec.len();
-        let cap = vec.capacity();
-
-        // Convert Vec<String> to Vec<*mut c_char>
-        let c_strings: Vec<*mut c_char> = vec
-            .into_iter()
-            .map(|s| create_string(&s) as *mut c_char)
-            .collect();
-
-        let c_len = c_strings.len();
-        let c_cap = c_strings.capacity();
-        let ptr = c_strings.leak().as_mut_ptr();
+        let mut ptrs: Vec<*mut c_char> = Vec::with_capacity(len);
+        let mut lens: Vec<size_t> = Vec::with_capacity(len);
+        for s in vec {
+            let bytes = s.into_bytes().into_boxed_slice();
+            lens.push(bytes.len());
+            ptrs.push(Box::into_raw(bytes) as *mut c_char);
+        }
 
         RustStringArray {
-            array: ptr,
-            len: c_len,
-            cap: c_cap,
+            array: Box::into_raw(ptrs.into_boxed_slice()) as *mut *mut c_char,
+            lens: Box::into_raw(lens.into_boxed_slice()) as *mut size_t,
+            len,
         }
     }
 }
@@ -133,8 +132,8 @@ impl std::default::Default for RustStringArray {
     fn default() -> Self {
         RustStringArray {
             array: std::ptr::null_mut(),
+            lens: std::ptr::null_mut(),
             len: 0,
-            cap: 0,
         }
     }
 }
@@ -147,15 +146,19 @@ impl From<Vec<String>> for RustStringArray {
 
 #[no_mangle]
 pub extern "C" fn free_rust_string_array(array: RustStringArray) {
-    let RustStringArray { array, len, cap } = array;
+    let RustStringArray { array, lens, len } = array;
     if array.is_null() {
         return;
     }
     unsafe {
-        let vec = Vec::from_raw_parts(array, len, cap);
-        for s in vec {
-            if !s.is_null() {
-                free_rust_string(s);
+        let ptrs = Box::from_raw(std::slice::from_raw_parts_mut(array, len));
+        let lens = Box::from_raw(std::slice::from_raw_parts_mut(lens, len));
+        for (&p, &l) in ptrs.iter().zip(lens.iter()) {
+            if !p.is_null() {
+                drop(Box::from_raw(std::slice::from_raw_parts_mut(
+                    p as *mut u8,
+                    l,
+                )));
             }
         }
     }
@@ -356,3 +359,48 @@ pub extern "C" fn free_test_ptr(ptr: *mut c_void) {
     }
     free_binding::<u32>(ptr);
 }
+
+#[cfg(test)]
+mod tests {
+    use std::ffi::CStr;
+
+    use super::*;
+
+    // An error message may quote the caller's literal, which can carry an
+    // interior NUL. Building the C string must not panic: this conversion
+    // happens inside `extern "C"` frames, where a panic aborts the process.
+    #[test]
+    fn test_error_message_with_interior_nul_does_not_panic() {
+        let err: error::Result<()> = Err(TantivyBindingError::InternalError(
+            "bad \0 literal".to_string(),
+        ));
+        let result = RustResult::from(err);
+        assert!(!result.success);
+        let msg = unsafe { CStr::from_ptr(result.error) }.to_str().unwrap();
+        assert!(msg.contains("\\0"), "unexpected message: {}", msg);
+        free_rust_result(result);
+
+        let result = RustResult::from_error("a\0b".to_string());
+        let msg = unsafe { CStr::from_ptr(result.error) }.to_str().unwrap();
+        assert_eq!(msg, "a\\0b");
+        free_rust_result(result);
+    }
+
+    #[test]
+    fn test_rust_string_array_keeps_interior_nul() {
+        let array =
+            RustStringArray::from_vec(vec!["ab\0c".to_string(), String::new(), "测试".to_string()]);
+        assert_eq!(array.len, 3);
+        let got: Vec<Vec<u8>> = (0..array.len)
+            .map(|i| unsafe {
+                std::slice::from_raw_parts(*array.array.add(i) as *const u8, *array.lens.add(i))
+                    .to_vec()
+            })
+            .collect();
+        assert_eq!(got[0], b"ab\0c");
+        assert!(got[1].is_empty());
+        assert_eq!(got[2], "测试".as_bytes());
+        free_rust_string_array(array);
+        free_rust_string_array(RustStringArray::default());
+    }
+}
```

**File**: `internal/core/thirdparty/tantivy/tantivy-binding/src/index_ngram_writer.rs` (modified, +82/-0)
```diff
@@ -157,4 +157,86 @@ mod tests {
             .unwrap();
         assert_eq!(res, vec![4].into_iter().collect::<HashSet<u32>>());
     }
+
+    // A literal shorter than min_gram must surface as an Err, never a panic:
+    // these functions are reached through `extern "C"` frames, where a panic
+    // aborts the whole process.
+    #[test]
+    fn test_ngram_short_literal_returns_error() {
+        let dir = TempDir::new().unwrap();
+        let mut writer = IndexWriterWrapper::create_ngram_writer(
+            "test",
+            dir.path().to_str().unwrap(),
+            2,
+            3,
+            1,
+            15000000,
+        )
+        .unwrap();
+        writer.add("订单（已取消）", Some(0)).unwrap();
+        writer.commit().unwrap();
+        let reader = writer.create_reader(set_bitset).unwrap();
+
+        // one 3-byte character: byte length passes min_gram, char count does not
+        for literal in ["订", "）", "a", ""] {
+            let mut res: HashSet<u32> = HashSet::new();
+            assert!(
+                reader
+                    .ngram_match_query(literal, 2, 3, &mut res as *mut _ as *mut c_void)
+                    .is_err(),
+                "literal {:?} should be rejected",
+                literal
+            );
+            assert!(res.is_empty());
+            assert!(
+                reader.ngram_tokenize(&[literal], 2, 3).is_err(),
+                "literal {:?} should be rejected",
+                literal
+            );
+        }
+        assert!(reader.ngram_tokenize(&["订单", "）"], 2, 3).is_err());
+        assert!(reader.ngram_tokenize(&[], 2, 3).is_err());
+
+        // sanity: a valid literal still works on the same reader
+        let mut res: HashSet<u32> = HashSet::new();
+        reader
+            .ngram_match_query("订单", 2, 3, &mut res as *mut _ as *mut c_void)
+            .unwrap();
+        assert_eq!(res, vec![0].into_iter().collect::<HashSet<u32>>());
+        assert!(!reader.ngram_tokenize(&["订单"], 2, 3).unwrap().is_empty());
+    }
+
+    // Interior NUL bytes are ordinary characters for the ngram index; the
+    // FFI shims pass (pointer, length) so they reach here intact.
+    #[test]
+    fn test_ngram_literal_with_interior_nul() {
+        let dir = TempDir::new().unwrap();
+        let mut writer = IndexWriterWrapper::create_ngram_writer(
+            "test",
+            dir.path().to_str().unwrap(),
+            2,
+            4,
+            1,
+            15000000,
+        )
+        .unwrap();
+        writer.add("xab\0cy", Some(0)).unwrap();
+        writer.add("xabzz", Some(1)).unwrap();
+        writer.commit().unwrap();
+        let reader = writer.create_reader(set_bitset).unwrap();
+
+        let mut res: HashSet<u32> = HashSet::new();
+        reader
+            .ngram_match_query("ab\0c", 2, 4, &mut res as *mut _ as *mut c_void)
+            .unwrap();
+        assert_eq!(res, vec![0].into_iter().collect::<HashSet<u32>>());
+
+        let terms = reader.ngram_tokenize(&["ab\0c"], 2, 4).unwrap();
+        assert_eq!(terms, vec!["ab\0c".to_string()]);
+        let terms = reader.ngram_tokenize(&["xab\0cy"], 2, 4).unwrap();
+        assert_eq!(terms.len(), 3);
+        assert!(terms
+            .iter()
+            .all(|t| t.chars().count() == 4 && t.contains('\0')));
+    }
 }
```

**File**: `internal/core/thirdparty/tantivy/tantivy-binding/src/index_reader.rs` (modified, +27/-21)
```diff
@@ -733,23 +733,27 @@ impl IndexReaderWrapper {
         self.json_regex_query(json_path, &pattern, bitset)
     }
 
-    // **Note**: literal length must be larger or equal to min_gram.
+    // **Note**: literal length must be larger or equal to min_gram. The C++
+    // side (`NgramInvertedIndex::CanHandleLiteral`) is the gate; a violation
+    // here means that gate was bypassed. It is reported as an error rather
+    // than asserted: this runs under an `extern "C"` frame, where a panic
+    // cannot unwind and aborts the whole process.
     pub fn ngram_match_query(
         &self,
         literal: &str,
         min_gram: usize,
         max_gram: usize,
         bitset: *mut c_void,
     ) -> Result<()> {
-        // literal length should be larger or equal to min_gram.
-        assert!(
-            literal.chars().count() >= min_gram,
-            "literal length should be larger or equal to min_gram. literal: {}, min_gram: {}",
-            literal,
-            min_gram
-        );
+        let char_count = literal.chars().count();
+        if char_count < min_gram {
+            return Err(TantivyBindingError::InternalError(format!(
+                "ngram_match_query: literal char length {} < min_gram {}, literal: {:?}",
+                char_count, min_gram, literal
+            )));
+        }
 
-        if literal.chars().count() <= max_gram {
+        if char_count <= max_gram {
             return self.term_query_keyword(literal, bitset);
         }
 
@@ -785,14 +789,15 @@ impl IndexReaderWrapper {
         let mut tokenizer = NgramTokenizer::new(max_gram, max_gram, false).unwrap();
 
         for literal in literals {
-            assert!(
-                literal.chars().count() >= min_gram,
-                "literal '{}' must be >= min_gram {}",
-                literal,
-                min_gram
-            );
-
-            if literal.chars().count() <= max_gram {
+            let char_count = literal.chars().count();
+            if char_count < min_gram {
+                return Err(TantivyBindingError::InternalError(format!(
+                    "ngram_tokenize: literal char length {} < min_gram {}, literal: {:?}",
+                    char_count, min_gram, literal
+                )));
+            }
+
+            if char_count <= max_gram {
                 all_term_pairs.push((
                     literal.to_string(),
                     Term::from_field_text(self.field, literal),
@@ -808,10 +813,11 @@ impl IndexReaderWrapper {
             }
         }
 
-        assert!(
-            !all_term_pairs.is_empty(),
-            "ngram_tokenize should not produce empty terms for valid literals"
-        );
+        if all_term_pairs.is_empty() {
+            return Err(TantivyBindingError::InternalError(
+                "ngram_tokenize: no ngram terms produced, literals must be non-empty".to_string(),
+            ));
+        }
 
         // Get doc_freq for each term and sort
         let searcher = self.reader.searcher();
```

**File**: `internal/core/thirdparty/tantivy/tantivy-binding/src/index_reader_c.rs` (modified, +11/-4)
```diff
@@ -694,16 +694,20 @@ pub extern "C" fn tantivy_json_prefix_query(
     unsafe { (*real).json_prefix_query(json_path, prefix, bitset).into() }
 }
 
+// The ngram entry points take (pointer, length) rather than C strings: a
+// LIKE literal may carry an interior NUL, and truncating it there would make
+// the rust side query a different literal than the one the C++ gate checked.
 #[no_mangle]
 pub extern "C" fn tantivy_ngram_match_query(
     ptr: *mut c_void,
     literal: *const c_char,
+    literal_len: usize,
     min_gram: usize,
     max_gram: usize,
     bitset: *mut c_void,
 ) -> RustResult {
     let real = ptr as *mut IndexReaderWrapper;
-    let literal = cstr_to_str!(literal);
+    let literal = ptr_to_str!(literal, literal_len);
 
     unsafe {
         (*real)
@@ -716,16 +720,18 @@ pub extern "C" fn tantivy_ngram_match_query(
 pub extern "C" fn tantivy_ngram_tokenize(
     ptr: *mut c_void,
     literals: *const *const c_char,
+    literal_lens: *const usize,
     literals_len: usize,
     min_gram: usize,
     max_gram: usize,
 ) -> RustResult {
     let real = ptr as *mut IndexReaderWrapper;
     let literals_slice = unsafe { convert_to_rust_slice!(literals, literals_len) };
+    let lens_slice = unsafe { convert_to_rust_slice!(literal_lens, literals_len) };
 
     let mut literal_strs: Vec<&str> = Vec::with_capacity(literals_len);
-    for &lit in literals_slice {
-        literal_strs.push(cstr_to_str!(lit));
+    for (&lit, &len) in literals_slice.iter().zip(lens_slice.iter()) {
+        literal_strs.push(ptr_to_str!(lit, len));
     }
 
     unsafe {
@@ -739,9 +745,10 @@ pub extern "C" fn tantivy_ngram_tokenize(
 pub extern "C" fn tantivy_ngram_term_posting_list(
     ptr: *mut c_void,
     term: *const c_char,
+    term_len: usize,
     bitset: *mut c_void,
 ) -> RustResult {
     let real = ptr as *mut IndexReaderWrapper;
-    let term = cstr_to_str!(term);
+    let term = ptr_to_str!(term, term_len);
     unsafe { (*real).ngram_term_posting_list(term, bitset).into() }
 }
```

---

### Incident Patch 13: `b6797ad8` (2026-09-28)
**Commit Message**: fix: use multi-arch Docker Hub MinIO image (#53889)

## What changed

- Replace the unavailable Quay MinIO image in Docker and Ansible
deployment definitions with
`milvusdb/minio:RELEASE.2024-12-18T13-15-44Z` from Docker Hub.
- Use a multi-architecture image supporting Linux amd64, arm64, and
ppc64le.

This is a follow-up to #53549 after the Quay image became unavailable.

## Validation

- Synced the image from the approved AWS US VDC Harbor source to Docker
Hub through CICD Portal record `11462` / Jenkins
`vdc-harbor-to-dockerhub #20`.
- Verified the Docker Hub OCI index digest is
`sha256:1dce27c494a16bae114774f1cec295493f3613142713130c2d22dd5696be6ad3`,
matching the source.
- Verified the index contains Linux amd64, arm64, and ppc64le manifests.
- Started the Docker Hub image on a Linux arm64 Kubernetes node and
verified `mc ready local` succeeds.
- Ran `docker compose config --quiet` for the root, dev, Apple Silicon,
standalone CPU, and standalone GPU Compose files.
- Parsed the Ansible MinIO task as YAML and ran `git diff --check`.

Signed-off-by: Zhikun Yao <[REDACTED_EMAIL]>

**File**: `deployments/docker/cluster-distributed-deployment/roles/deploy-minio/tasks/main.yml` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@
 - name: "minio"
   docker_container:
     name: minio
-    image: quay.io/minio/minio:RELEASE.2024-05-28T17-19-04Z
+    image: milvusdb/minio:RELEASE.2024-12-18T13-15-44Z
     env:
       MINIO_ACCESS_KEY: minioadmin
       MINIO_SECRET_KEY: minioadmin
```

**File**: `deployments/docker/dev/docker-compose-apple-silicon.yml` (modified, +1/-1)
```diff
@@ -32,7 +32,7 @@ services:
       - "18080:8080"
 
   minio:
-    image: quay.io/minio/minio:RELEASE.2024-05-28T17-19-04Z
+    image: milvusdb/minio:RELEASE.2024-12-18T13-15-44Z
     ports:
       - "9000:9000"
       - "9001:9001"
```

**File**: `deployments/docker/dev/docker-compose.yml` (modified, +1/-1)
```diff
@@ -38,7 +38,7 @@ services:
       - "18080:8080"
 
   minio:
-    image: quay.io/minio/minio:RELEASE.2024-05-28T17-19-04Z
+    image: milvusdb/minio:RELEASE.2024-12-18T13-15-44Z
     ports:
       - "9000:9000"
       - "9001:9001"
```

**File**: `deployments/docker/gpu/standalone/docker-compose.yml` (modified, +1/-1)
```diff
@@ -46,7 +46,7 @@ services:
 
   minio:
     container_name: milvus-minio
-    image: quay.io/minio/minio:RELEASE.2024-05-28T17-19-04Z
+    image: milvusdb/minio:RELEASE.2024-12-18T13-15-44Z
     environment:
       MINIO_ACCESS_KEY: minioadmin
       MINIO_SECRET_KEY: minioadmin
```

**File**: `deployments/docker/standalone/docker-compose.yml` (modified, +1/-1)
```diff
@@ -46,7 +46,7 @@ services:
 
   minio:
     container_name: milvus-minio
-    image: quay.io/minio/minio:RELEASE.2024-05-28T17-19-04Z
+    image: milvusdb/minio:RELEASE.2024-12-18T13-15-44Z
     environment:
       MINIO_ACCESS_KEY: minioadmin
       MINIO_SECRET_KEY: minioadmin
```

**File**: `docker-compose.yml` (modified, +1/-1)
```diff
@@ -121,7 +121,7 @@ services:
       - PULSAR_GC=-XX:+UseG1GC
 
   minio:
-    image: quay.io/minio/minio:RELEASE.2024-05-28T17-19-04Z
+    image: milvusdb/minio:RELEASE.2024-12-18T13-15-44Z
     environment:
       MINIO_ACCESS_KEY: minioadmin
       MINIO_SECRET_KEY: minioadmin
```

---

### Incident Patch 14: `ca8c70ba` (2026-09-28)
**Commit Message**: build(deps): bump deepdiff from 8.6.1 to 8.6.2 in /tests/python_client (#53674)

Bumps [deepdiff](https://github.com/qlustered/deepdiff) from 8.6.1 to
8.6.2.
<details>
<summary>Release notes</summary>
<p><em>Sourced from <a
href="https://github.com/qlustered/deepdiff/releases">deepdiff's
releases</a>.</em></p>
<blockquote>
<p>8.6.2 - Fix (CVE-2025-58367)</p>
</blockquote>
</details>
<details>
<summary>Commits</summary>
<ul>
<li><a
href="https://github.com/qlustered/deepdiff/commit/0d07ec21d12b46ef4e489383b363eadc22d990fb"><code>0d07ec2</code></a>
Merge commit from fork</li>
<li><a
href="https://github.com/qlustered/deepdiff/commit/791f5aac51b2da7f90375ab204256ef6a6b40206"><code>791f5aa</code></a>
updating CVE number</li>
<li><a
href="https://github.com/qlustered/deepdiff/commit/a6aafea3ba5498aab6f9c77047c54949e7e968ae"><code>a6aafea</code></a>
updating docs</li>
<li><a
href="https://github.com/qlustered/deepdiff/commit/a0950abbe6263298bc4bdbc3ebb57edc1af079b4"><code>a0950ab</code></a>
Bump version: 8.6.1 → 8.6.2</li>
<li><a
href="https://github.com/qlustered/deepdiff/commit/887128abe5e510341cc4a82f6914a82d5ff1b6a7"><code>887128a</code></a>
Fix (CVE-2025-58367)</li>
<li>See full dif

**File**: `tests/python_client/requirements.txt` (modified, +1/-1)
```diff
@@ -53,7 +53,7 @@ tenacity==8.2.3
 rich==13.7.0
 # for standby test
 etcd-sdk-python==0.0.6
-deepdiff==8.6.1
+deepdiff==8.6.2
 
 # for test result analyzer
 prettytable==3.8.0
```

---

### Incident Patch 15: `acd8a677` (2026-09-26)
**Commit Message**: fix: correct misspelled cipherPlugin.updatePeriodInMinutes config key (#53826)

issue: #53825
https://github.com/milvus-io/milvus/issues/53825

## What

- Rename the config key `cipherPlugin.updatePerieldInMinutes` →
`cipherPlugin.updatePeriodInMinutes` and the Go field
`UpdatePerieldInMinutes` → `UpdatePeriodInMinutes`.
- Keep the old misspelled key as `FallbackKeys` so an existing
`hook.yaml` / `user.yaml` override keeps being read.
- Rename the Go field `EnalbeDiskEncryption` → `EnableDiskEncryption`
(its key `cipherPlugin.enableDiskEncryption` was already correct).
- Add `cipher_config_test.go` asserting the key name, the default, the
fallback and the precedence of the correctly spelled key.

## Why

`hookutil.buildCipherInitConfig()` passes `GetCipherParams().GetAll()`
to the cipher plugin, which looks the value up under the correctly
spelled key. Because the shipped key was misspelled, the value never
matched on the plugin side and the refreshable callback reloaded a map
that still lacked the expected key. See the issue for details.

## Compatibility

No behavior change for deployments that do not set this key. Deployments
that set the old spelling keep working through the fa

**File**: `internal/util/hookutil/cipher.go` (modified, +1/-1)
```diff
@@ -498,7 +498,7 @@ func registerCallback() {
 	params.KmsAwsRoleARN.RegisterCallback(reloadCipherConfig)
 	params.KmsAwsExternalID.RegisterCallback(reloadCipherConfig)
 	params.RotationPeriodInHours.RegisterCallback(reloadCipherConfig)
-	params.UpdatePerieldInMinutes.RegisterCallback(reloadCipherConfig)
+	params.UpdatePeriodInMinutes.RegisterCallback(reloadCipherConfig)
 	mlog.Info(context.TODO(), "cipher config callbacks registered")
 }
 
```

**File**: `internal/util/hookutil/cipher_test.go` (modified, +1/-1)
```diff
@@ -248,7 +248,7 @@ func (s *CipherSuite) TestNewKmsConfigFields() {
 	s.NotNil(params.KmsAwsRoleARN.GetValue())
 	s.NotNil(params.KmsAwsExternalID.GetValue())
 	s.NotNil(params.RotationPeriodInHours.GetValue())
-	s.NotNil(params.UpdatePerieldInMinutes.GetValue())
+	s.NotNil(params.UpdatePeriodInMinutes.GetValue())
 
 	s.Equal("cipherPlugin.kms.defaultKey", params.DefaultRootKey.Key)
 	s.Equal("cipherPlugin.kms.credentials.aws.roleARN", params.KmsAwsRoleARN.Key)
```

**File**: `pkg/util/paramtable/cipher_config.go` (modified, +17/-14)
```diff
@@ -11,14 +11,14 @@ const cipherYamlFile = "hook.yaml"
 type cipherConfig struct {
 	cipherBase *BaseTable
 
-	SoPathGo               ParamItem `refreshable:"false"`
-	SoPathCpp              ParamItem `refreshable:"false"`
-	DefaultRootKey         ParamItem `refreshable:"true"`
-	KmsAwsRoleARN          ParamItem `refreshable:"true"`
-	KmsAwsExternalID       ParamItem `refreshable:"true"`
-	RotationPeriodInHours  ParamItem `refreshable:"true"`
-	UpdatePerieldInMinutes ParamItem `refreshable:"true"`
-	EnalbeDiskEncryption   ParamItem `refreshable:"false"`
+	SoPathGo              ParamItem `refreshable:"false"`
+	SoPathCpp             ParamItem `refreshable:"false"`
+	DefaultRootKey        ParamItem `refreshable:"true"`
+	KmsAwsRoleARN         ParamItem `refreshable:"true"`
+	KmsAwsExternalID      ParamItem `refreshable:"true"`
+	RotationPeriodInHours ParamItem `refreshable:"true"`
+	UpdatePeriodInMinutes ParamItem `refreshable:"true"`
+	EnableDiskEncryption  ParamItem `refreshable:"false"`
 }
 
 func (c *cipherConfig) init(base *BaseTable) {
@@ -66,19 +66,22 @@ func (c *cipherConfig) init(base *BaseTable) {
 	}
 	c.RotationPeriodInHours.Init(base.mgr)
 
-	c.UpdatePerieldInMinutes = ParamItem{
-		Key:          "cipherPlugin.updatePerieldInMinutes",
-		Version:      "2.6.1",
+	c.UpdatePeriodInMinutes = ParamItem{
+		Key:     "cipherPlugin.updatePeriodInMinutes",
+		Version: "2.6.1",
+		// The key shipped misspelled in 2.6.1; keep reading the old spelling so
+		// an existing hook.yaml / user.yaml override is not silently dropped.
+		FallbackKeys: []string{"cipherPlugin.updatePerieldInMinutes"},
 		DefaultValue: "60",
 	}
-	c.UpdatePerieldInMinutes.Init(base.mgr)
+	c.UpdatePeriodInMinutes.Init(base.mgr)
 
-	c.EnalbeDiskEncryption = ParamItem{
+	c.EnableDiskEncryption = ParamItem{
 		Key:          "cipherPlugin.enableDiskEncryption",
 		Version:      "2.6.1",
 		DefaultValue: "false",
 	}
-	c.EnalbeDiskEncryption.Init(base.mgr)
+	c.EnableDiskEncryption.Init(base.mgr)
 }
 
 func (c *cipherConfig) Save(key string, value string) error {
```

**File**: `pkg/util/paramtable/cipher_config_test.go` (added, +43/-0)
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
+package paramtable
+
+import (
+	"testing"
+
+	"github.com/stretchr/testify/assert"
+)
+
+func TestCipherConfigUpdatePeriodKey(t *testing.T) {
+	Init()
+	params := GetCipherParams()
+
+	assert.Equal(t, "cipherPlugin.updatePeriodInMinutes", params.UpdatePeriodInMinutes.Key)
+	assert.Equal(t, "60", params.UpdatePeriodInMinutes.GetValue())
+
+	// The key shipped misspelled in 2.6.1; an override written under the old
+	// spelling must still be read through the fallback key.
+	assert.NoError(t, params.Save("cipherPlugin.updatePerieldInMinutes", "30"))
+	assert.Equal(t, "30", params.UpdatePeriodInMinutes.GetValue())
+
+	// The correctly spelled key wins once it is set.
+	assert.NoError(t, params.Save("cipherPlugin.updatePeriodInMinutes", "45"))
+	assert.Equal(t, "45", params.UpdatePeriodInMinutes.GetValue())
+
+	assert.Equal(t, "cipherPlugin.enableDiskEncryption", params.EnableDiskEncryption.Key)
+	assert.Equal(t, "false", params.EnableDiskEncryption.GetValue())
+}
```

#### Recent Merged Pull Requests:
- **PR #53964** (2026-10-05): test: wait for compactable segments in struct partial-update lifecycle (@xiaofan-luan)
- **PR #53943** (2026-10-05): fix: fix a Regex-related ASAN violation on ARM machine (@alexanderguzhva)
- **PR #53941** (2026-10-05): enhance: bump simdjson from v3.12.2 to v5.0.2 (@alexanderguzhva)
- **PR #53937** (closed): feat: [2.6][RLS4] enforce row-level security (#52075) (@aoiasd)
- **PR #53936** (closed): feat: [2.6][RLS5] expose row policy and principal tag APIs (#53873) (@aoiasd)
- **PR #53935** (closed): feat: [2.6][RLS3] evaluate row-level security policies (#52074) (@aoiasd)
- **PR #53934** (closed): feat: [2.6][RLS2] synchronize row-level security metadata (#52073) (@aoiasd)
- **PR #53933** (closed): feat: [2.6][RLS1] add row-level security metadata foundation (#52072) (@aoiasd)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
