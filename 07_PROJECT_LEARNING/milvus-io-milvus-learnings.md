> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/milvus-io-milvus-learnings.md`  
> **Source**: github ([https://github.com/milvus-io/milvus](https://github.com/milvus-io/milvus))  
> **Source Version**: `3fb4f56c`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T06:26:30.449Z  
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
> **Harvest Timestamp**: 2026-10-19T06:26:30.442Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `milvus-io/milvus`
- **Description**: Milvus is a high-performance, cloud-native vector database built for scalable vector ANN search
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 46422 stars

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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #54372** (2026-10-17): **fix: drop zero-count tokens in ConcurrentBM25Stats like BM25Stats.Minus**
  *Symptoms*: issue: #53949  ## What  UT-GO on master fails every run in `internal/storage`:  - `TestConcurrentBM25StatsUnlockedMatchesSerial` (`bm25_stats_concurrent_test.go:123`) - `TestConcurrentBM25StatsMergeFrom` (`bm25_stats_concurrent_test.go:149`)  #53819 made `BM25Stats.Minus` delete a token once its count reaches zero. `ConcurrentBM25Stats` (#53950) kept the zero entries, so a token taken back to zero is `{token: 0}` in the concurrent table and absent from the serial one. Both PRs were green on their own heads; they merged on master about nine hours apart.  ## Change  - Every write path of `ConcurrentBM25Stats` (locked per-token and split merges, `MergeUnlocked`/`MinusUnlocked`, `MergeFrom`) deletes a token whose count becomes zero, matching `BM25Stats.Minus`. Tokens of removed segments no longer stay in the table or count toward `MemSize`. `BuildIDF` is unchanged: a missing token and a zero count give the same IDF. - The tests compare against the serial stats without zero counts, because `BM25Stats.Merge` keeps a zero it reaches from a negative count, so its zero entries depend on the order of operations. - New `TestConcurrentBM25StatsDropsZeroCounts`: merges and takes back the same stats on each write path, below and above the split threshold, and expects an empty table.  3.0 and 2.6 do not have the #53819 change to `BM25Stats.Minus`, so #54273 and #54274 are not affected.  ## Test  - Master as is: both tests fail 4 of 4 runs. - New tests on the old `ConcurrentBM25Stats`: `Test

- **Issue #54360** (2026-10-17): **fix: [2.6] initialize VectorArray in PrepareResultFieldData for empty pages**
  *Symptoms*: issue: #54240 related master pr: #51164  ### What  `PrepareResultFieldData` on 2.6 has no `VectorField_VectorArray` case. For an `ArrayOfVector` field, including a StructArray vector sub-field (reached through the existing `StructArrays` recursion), the prepared output column ends up with a nil `VectorArray` payload.  When query pagination skips every matching row (`offset >= match count`), the reducer appends no rows. `FillRetrieveResultIfEmpty` does not rebuild the result because the field list is non-empty, so the nil payload reaches the client. The Go SDK then rejects it with `FieldData type not matched`.  ### Fix  Add the same `VectorArray` initializer that master has, from #51164: `Dim`, `ElementType`, and an empty `Data` with capacity `topK`. This does not backport the rest of the element-nullable feature.  Unlike master's initializer, `VectorArray.dim` falls back to the enclosing `VectorField.dim` when the nested dim is 0. On 2.6, sealed segments build the VectorArray output without setting `VectorArray.dim`. On an empty page the client has no rows to infer the dim from, so without the fallback it fails with `vector array ... has unknown dim`. All required proto fields and the analogous empty-field construction (`gen_empty_field_data.go`) already exist on 2.6.  ### Tests  - New `TestFieldData/TestPrepareFieldData/vector_array`. - New `TestFieldData/TestPrepareFieldData/struct_array_with_vector_array_empty_page`, which covers the `topK=0` struct sub-field case. - New `

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

### Incident Patch 1: `840041e0` (2026-10-19)
**Commit Message**: fix: remove canceled DQL tasks from queue (#52939)

Remove canceled DQL tasks from the Proxy unissued queue when the request
context ends, and skip canceled or expired tasks before worker
execution. The cleanup hook is registered before waiting and remains
immutable afterward, so it does not require per-task synchronization.

Validation: scheduler and condition tests passed with `-race -count=3`,
including blocked-worker regression tests for both pools; scoped lint
passed. Removing the worker-entry check makes all four
cancellation/deadline regression cases fail. `run_clang_format.sh`
passed. Full `make lint-fix` was run but is blocked locally by
incompatible native storage headers (`LoonFilesystemMetricsList`);
hosted CI remains required.

issue: #52936

---------

Signed-off-by: sunby <[REDACTED_EMAIL]>

**File**: `internal/proxy/condition_test.go` (modified, +40/-0)
```diff
@@ -19,6 +19,7 @@ package proxy
 import (
 	"context"
 	"sync"
+	"sync/atomic"
 	"testing"
 	"time"
 
@@ -120,3 +121,42 @@ func TestTaskCondition_Notify(t *testing.T) {
 	}()
 	wg.Wait()
 }
+
+func TestTaskCondition_OnContextDone(t *testing.T) {
+	t.Run("success", func(t *testing.T) {
+		condition := NewTaskCondition(context.Background())
+		var calls atomic.Int32
+		condition.SetOnContextDone(func() {
+			calls.Add(1)
+		})
+
+		condition.Notify(nil)
+		assert.NoError(t, condition.WaitToFinish())
+		assert.Zero(t, calls.Load())
+	})
+
+	t.Run("task error", func(t *testing.T) {
+		condition := NewTaskCondition(context.Background())
+		var calls atomic.Int32
+		condition.SetOnContextDone(func() {
+			calls.Add(1)
+		})
+
+		condition.Notify(errors.New("task failed"))
+		assert.Error(t, condition.WaitToFinish())
+		assert.Zero(t, calls.Load())
+	})
+
+	t.Run("context canceled", func(t *testing.T) {
+		ctx, cancel := context.WithCancel(context.Background())
+		condition := NewTaskCondition(ctx)
+		var calls atomic.Int32
+		condition.SetOnContextDone(func() {
+			calls.Add(1)
+		})
+
+		cancel()
+		assert.Error(t, condition.WaitToFinish())
+		assert.Equal(t, int32(1), calls.Load())
+	})
+}
```

**File**: `internal/proxy/scheduler/task_scheduler.go` (modified, +43/-10)
```diff
@@ -43,7 +43,6 @@ type TaskQueue interface {
 	utChan() <-chan int
 	utEmpty() bool
 	utFull() bool
-	addUnissuedTask(t taskmodel.Task) error
 	FrontUnissuedTask() taskmodel.Task
 	PopUnissuedTask() taskmodel.Task
 	AddActiveTask(t taskmodel.Task)
@@ -95,22 +94,22 @@ func (queue *BaseTaskQueue) IsFull() bool {
 	return queue.utFull()
 }
 
-func (queue *BaseTaskQueue) addUnissuedTask(t taskmodel.Task) error {
+func (queue *BaseTaskQueue) addUnissuedTask(t taskmodel.Task) (*list.Element, error) {
 	queue.utLock.Lock()
 	defer queue.utLock.Unlock()
 
 	if queue.utFull() {
-		return merr.WrapErrTooManyRequests(int32(queue.GetMaxTaskNum()))
+		return nil, merr.WrapErrTooManyRequests(int32(queue.GetMaxTaskNum()))
 	}
-	queue.unissuedTasks.PushBack(t)
+	element := queue.unissuedTasks.PushBack(t)
 	// utBufChan is an edge-triggered, capacity-1 notifier: a pending token
 	// means "the unissued list is non-empty, wake the scheduler". Concurrent
 	// sends coalesce; the scheduler drains the list on each wake.
 	select {
 	case queue.utBufChan <- 1:
 	default:
 	}
-	return nil
+	return element, nil
 }
 
 func (queue *BaseTaskQueue) FrontUnissuedTask() taskmodel.Task {
@@ -155,6 +154,18 @@ func (queue *BaseTaskQueue) popUnissuedTasks(filter func(taskmodel.Task) bool) [
 	return removed
 }
 
+// removeUnissuedTask removes element only if it is still waiting in this queue.
+// list.Remove is a no-op if the scheduler has already popped the element.
+func (queue *BaseTaskQueue) removeUnissuedTask(element *list.Element) {
+	if element == nil {
+		return
+	}
+
+	queue.utLock.Lock()
+	defer queue.utLock.Unlock()
+	queue.unissuedTasks.Remove(element)
+}
+
 func (queue *BaseTaskQueue) AddActiveTask(t taskmodel.Task) {
 	queue.atLock.Lock()
 	defer queue.atLock.Unlock()
@@ -199,10 +210,10 @@ func (queue *BaseTaskQueue) getTaskByReqID(reqID taskmodel.UniqueID) taskmodel.T
 	return nil
 }
 
-func (queue *BaseTaskQueue) Enqueue(t taskmodel.Task) error {
+func (queue *BaseTaskQueue) enqueue(t taskmodel.Task) (*list.Element, error) {
 	err := t.OnEnqueue()
 	if err != nil {
-		return err
+		return nil, err
 	}
 
 	// Fast-fail when the queue is already full, before any potentially-blocking
@@ -213,7 +224,7 @@ func (queue *BaseTaskQueue) Enqueue(t taskmodel.Task) error {
 	full := queue.utFull()
 	queue.utLock.RUnlock()
 	if full {
-		return merr.WrapErrTooManyRequests(int32(queue.GetMaxTaskNum()))
+		return nil, merr.WrapErrTooManyRequests(int32(queue.GetMaxTaskNum()))
 	}
 
 	var ts taskmodel.Timestamp
@@ -222,12 +233,12 @@ func (queue *BaseTaskQueue) Enqueue(t taskmodel.Task) error {
 		ts = tsoutil.ComposeTS(time.Now().UnixMilli(), 0)
 		id, err = t.GetMetaCache().AllocID(t.TraceCtx())
 		if err != nil {
-			return err
+			return nil, err
 		}
 	} else {
 		ts, err = queue.tsoAllocatorIns.AllocOne(t.TraceCtx())
 		if err != nil {
-			return err
+			return nil, err
 		}
 		// we always use same msg id and ts for now.
 		id = taskmodel.UniqueID(ts)
@@ -239,6 +250,11 @@ func (queue *BaseTaskQueue) Enqueue(t taskmodel.Task) error {
 	return queue.addUnissuedTask(t)
 }
 
+func (queue *BaseTaskQueue) Enqueue(t taskmodel.Task) error {
+	_, err := queue.enqueue(t)
+	return err
+}
+
 func (queue *BaseTaskQueue) SetMaxTaskNum(num int64) {
 	queue.maxTaskNumMtx.Lock()
 	defer queue.maxTaskNumMtx.Unlock()
@@ -316,6 +332,18 @@ type DqTaskQueue struct {
 	*BaseTaskQueue
 }
 
+func (queue *DqTaskQueue) Enqueue(t taskmodel.Task) error {
+	element, err := queue.enqueue(t)
+	if err != nil {
+		return err
+	}
+
+	t.SetOnContextDone(func() {
+		queue.removeUnissuedTask(element)
+	})
+	return nil
+}
+
 type ClearTaskQueueResult struct {
 	QueuedCleared int64
 }
@@ -586,6 +614,11 @@ func (sched *TaskScheduler) queryLoop() {
 					p = subTaskPool
 				}
 				p.Submit(func() (struct{}, error) {
+					// Submit may wait for a worker after the task has left the queue.
+					if err := task.TraceCtx().Err(); err != nil {
+						task.Notify(err)
+						return struct{}{}, nil
+					}
 					sched.processTask(task, sched.DqQueue)
 					return struct{}{}, nil
 				})
```

**File**: `internal/proxy/scheduler/task_scheduler_context_test.go` (added, +179/-0)
```diff
@@ -0,0 +1,179 @@
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
+package scheduler
+
+import (
+	"context"
+	"sync"
+	"sync/atomic"
+	"testing"
+	"time"
+
+	"github.com/bytedance/mockey"
+	"github.com/stretchr/testify/require"
+
+	"github.com/milvus-io/milvus/pkg/v3/util/conc"
+)
+
+type queryLoopTestTask struct {
+	*mockDqlTask
+	subTask          bool
+	preExecute       func()
+	preExecuteCalls  atomic.Int32
+	executeCalls     atomic.Int32
+	postExecuteCalls atomic.Int32
+	notified         chan error
+}
+
+func (t *queryLoopTestTask) IsSubTask() bool {
+	return t.subTask
+}
+
+func (t *queryLoopTestTask) PreExecute(context.Context) error {
+	t.preExecuteCalls.Add(1)
+	if t.preExecute != nil {
+		t.preExecute()
+	}
+	return nil
+}
+
+func (t *queryLoopTestTask) Execute(context.Context) error {
+	t.executeCalls.Add(1)
+	return nil
+}
+
+func (t *queryLoopTestTask) PostExecute(context.Context) error {
+	t.postExecuteCalls.Add(1)
+	return nil
+}
+
+func (t *queryLoopTestTask) Notify(err error) {
+	t.mockDqlTask.Notify(err)
+	t.notified <- err
+}
+
+func TestTaskScheduler_QueryLoopContextDoneBeforeExecution(t *testing.T) {
+	for _, subTask := range []bool{false, true} {
+		poolName := "main pool"
+		if subTask {
+			poolName = "subtask pool"
+		}
+		t.Run(poolName, func(t *testing.T) {
+			for _, outcome := range []string{"canceled", "deadline exceeded", "live"} {
+				t.Run(outcome, func(t *testing.T) {
+					pools := []*conc.Pool[struct{}]{conc.NewPool[struct{}](1), conc.NewPool[struct{}](1)}
+					t.Cleanup(func() {
+						for _, pool := range pools {
+							pool.Release()
+						}
+					})
+
+					// Keep the actual pools so Waiting proves Submit is blocked before cancellation.
+					nextPool := 0
+					poolMock := mockey.MockGeneric(conc.NewPool[struct{}]).To(func(_ int, _ ...conc.PoolOption) *conc.Pool[struct{}] {
+						pool := pools[nextPool]
+						nextPool++
+						return pool
+					}).Build()
+					t.Cleanup(func() { poolMock.UnPatch() })
+
+					sched, err := NewTaskScheduler(context.Background(), newMockTsoAllocator())
+					require.NoError(t, err)
+					release := make(chan struct{})
+					var releaseOnce sync.Once
+					releaseWorker := func() { releaseOnce.Do(func() { close(release) }) }
+					t.Cleanup(func() {
+						releaseWorker()
+						sched.Close()
+					})
+					sched.wg.Add(1)
+					go sched.queryLoop()
+
+					started := make(chan struct{})
+					blockingTask := &queryLoopTestTask{
+						mockDqlTask: newDefaultMockDqlTask(),
+						subTask:     subTask,
+						preExecute: func() {
+							close(started)
+							<-release
+						},
+						notified: make(chan error, 1),
+					}
+					require.NoError(t, sched.DqQueue.Enqueue(blockingTask))
+					select {
+					case <-started:
+					case <-time.After(5 * time.Second):
+						t.Fatal("first task did not occupy the worker")
+					}
+
+					ctx, cancel := context.WithCancel(context.Background())
+					if outcome == "deadline exceeded" {
+						cancel()
+						ctx, cancel = context.WithTimeout(context.Background(), time.Second)
+					}
+					t.Cleanup(cancel)
+					task := &queryLoopTestTask{
+						mockDqlTask: newMockDqlTask(ctx),
+						subTask:     subTask,
+						notified:    make(chan error, 1),
+					}
+					require.NoError(t, sched.DqQueue.Enqueue(task))
+
+					pool := pools[0]
+					if subTask {
+						pool = pools[1]
+					}
+					require.Eventually(t, func() bool { return pool.Waiting() == 1 }, 5*time.Second, time.Millisecond)
+					require.True(t, sched.DqQueue.utEmpty())
+
+					var expectedErr error
+					switch outcome {
+					case "canceled":
+						require.NoError(t, ctx.Err(), "cancel only after Submit starts waiting")
+						cancel()
+						expectedErr = context.Canceled
+					case "deadline exceeded":
+						<-ctx.Done()
+						expectedErr = context.DeadlineExceeded
+					}
+					if expectedErr != nil {
+						require.ErrorIs(t, task.WaitToFinish(), expectedErr)
+					}
+					releaseWorker()
+
+					select {
+					case err := <-task.notified:
+						require.ErrorIs(t, err, expectedErr)
+					case <-time.After(5 * time.Second):
+						t.Fatal("submitted task was not notified")
+					}
+					var expectedCalls int32
+					if expectedErr == nil {
+						expectedCalls = 1
+						req
```

**File**: `internal/proxy/scheduler/task_scheduler_test.go` (modified, +32/-0)
```diff
@@ -122,6 +122,38 @@ func TestBaseTaskQueue(t *testing.T) {
 	assert.Error(t, err)
 }
 
+func TestDqTaskQueue_RemoveUnissuedTaskOnContextDone(t *testing.T) {
+	t.Run("remove queued task", func(t *testing.T) {
+		ctx, cancel := context.WithCancel(context.Background())
+		queue := newDqTaskQueue(newMockTsoAllocator())
+		task := newMockDqlTask(ctx)
+
+		assert.NoError(t, queue.Enqueue(task))
+		assert.Equal(t, 1, queue.unissuedTasks.Len())
+
+		cancel()
+		assert.Error(t, task.WaitToFinish())
+		assert.True(t, queue.utEmpty())
+		assert.Nil(t, queue.getTaskByReqID(task.ID()))
+	})
+
+	t.Run("popped task is unchanged", func(t *testing.T) {
+		ctx, cancel := context.WithCancel(context.Background())
+		queue := newDqTaskQueue(newMockTsoAllocator())
+		poppedTask := newMockDqlTask(ctx)
+		queuedTask := newDefaultMockDqlTask()
+
+		assert.NoError(t, queue.Enqueue(poppedTask))
+		assert.NoError(t, queue.Enqueue(queuedTask))
+		assert.Same(t, poppedTask, queue.PopUnissuedTask())
+
+		cancel()
+		assert.Error(t, poppedTask.WaitToFinish())
+		assert.Equal(t, 1, queue.unissuedTasks.Len())
+		assert.Same(t, queuedTask, queue.FrontUnissuedTask())
+	})
+}
+
 func TestDdTaskQueue(t *testing.T) {
 	var err error
 	var unissuedTask taskmodel.Task
```

**File**: `internal/proxy/taskmodel/condition.go` (modified, +12/-0)
```diff
@@ -27,6 +27,7 @@ type Condition interface {
 	WaitToFinish() error
 	Notify(err error)
 	Ctx() context.Context
+	SetOnContextDone(handler func())
 }
 
 // make sure interface implementation
@@ -36,12 +37,17 @@ var _ Condition = (*TaskCondition)(nil)
 type TaskCondition struct {
 	done chan error
 	ctx  context.Context
+
+	onContextDone func()
 }
 
 // WaitToFinish waits until the TaskCondition is notified or context done or canceled
 func (tc *TaskCondition) WaitToFinish() error {
 	select {
 	case <-tc.ctx.Done():
+		if tc.onContextDone != nil {
+			tc.onContextDone()
+		}
 		return errors.Wrap(tc.ctx.Err(), "proxy TaskCondition context Done")
 	case err := <-tc.done:
 		return err
@@ -58,6 +64,12 @@ func (tc *TaskCondition) Ctx() context.Context {
 	return tc.ctx
 }
 
+// SetOnContextDone registers a handler invoked when WaitToFinish returns because its context is done.
+// Registration must complete before WaitToFinish begins, and the handler must not change after waiting starts.
+func (tc *TaskCondition) SetOnContextDone(handler func()) {
+	tc.onContextDone = handler
+}
+
 // NewTaskCondition creates a TaskCondition with provided context
 func NewTaskCondition(ctx context.Context) *TaskCondition {
 	return &TaskCondition{
```

**File**: `internal/proxy/taskmodel/task.go` (modified, +1/-0)
```diff
@@ -50,6 +50,7 @@ type Task interface {
 	PostExecute(ctx context.Context) error
 	WaitToFinish() error
 	Notify(err error)
+	SetOnContextDone(handler func())
 	CanSkipAllocTimestamp() bool
 	GetMetaCache() metacache.Cache
 	SetOnEnqueueTime()
```

---

### Incident Patch 2: `2ca2a79d` (2026-10-17)
**Commit Message**: fix: drop zero-count tokens in ConcurrentBM25Stats like BM25Stats.Minus (#54372)

issue: #53949

## What

UT-GO on master fails every run in `internal/storage`:

- `TestConcurrentBM25StatsUnlockedMatchesSerial`
(`bm25_stats_concurrent_test.go:123`)
- `TestConcurrentBM25StatsMergeFrom`
(`bm25_stats_concurrent_test.go:149`)

#53819 made `BM25Stats.Minus` delete a token once its count reaches
zero. `ConcurrentBM25Stats` (#53950) kept the zero entries, so a token
taken back to zero is `{token: 0}` in the concurrent table and absent
from the serial one. Both PRs were green on their own heads; they merged
on master about nine hours apart.

## Change

- Every write path of `ConcurrentBM25Stats` (locked per-token and split
merges, `MergeUnlocked`/`MinusUnlocked`, `MergeFrom`) deletes a token
whose count becomes zero, matching `BM25Stats.Minus`. Tokens of removed
segments no longer stay in the table or count toward `MemSize`.
`BuildIDF` is unchanged: a missing token and a zero count give the same
IDF.
- The tests compare against the serial stats without zero counts,
because `BM25Stats.Merge` keeps a zero it reaches from a negative count,
so its zero entries depend on the order of operations

**File**: `internal/storage/bm25_stats_concurrent.go` (modified, +14/-4)
```diff
@@ -111,7 +111,17 @@ func (c *ConcurrentBM25Stats) MinusUnlocked(stats *BM25Stats) {
 
 func (c *ConcurrentBM25Stats) applyUnlocked(rows map[uint32]int32, sign int32) {
 	for token, count := range rows {
-		c.shards[shardOf(token)].rowsWithToken[token] += sign * count
+		addTokenCount(c.shards[shardOf(token)].rowsWithToken, token, sign*count)
+	}
+}
+
+// addTokenCount adds delta to the count of token and drops the token once its count is zero,
+// like BM25Stats.Minus, so tokens of removed segments do not stay in the table.
+func addTokenCount(rows map[uint32]int32, token uint32, delta int32) {
+	if count := rows[token] + delta; count != 0 {
+		rows[token] = count
+	} else {
+		delete(rows, token)
 	}
 }
 
@@ -120,7 +130,7 @@ func (c *ConcurrentBM25Stats) apply(rows map[uint32]int32, sign int32) {
 		for token, count := range rows {
 			shard := &c.shards[shardOf(token)]
 			shard.Lock()
-			shard.rowsWithToken[token] += sign * count
+			addTokenCount(shard.rowsWithToken, token, sign*count)
 			shard.Unlock()
 		}
 		return
@@ -148,7 +158,7 @@ func (c *ConcurrentBM25Stats) apply(rows map[uint32]int32, sign int32) {
 		shard := &c.shards[s]
 		shard.Lock()
 		for _, tc := range split[s] {
-			shard.rowsWithToken[tc.token] += sign * tc.count
+			addTokenCount(shard.rowsWithToken, tc.token, sign*tc.count)
 		}
 		shard.Unlock()
 	}
@@ -170,7 +180,7 @@ func (c *ConcurrentBM25Stats) MergeFrom(other *ConcurrentBM25Stats) {
 			src.RLock()
 			dst.Lock()
 			for token, count := range src.rowsWithToken {
-				dst.rowsWithToken[token] += count
+				addTokenCount(dst.rowsWithToken, token, count)
 			}
 			dst.Unlock()
 			src.RUnlock()
```

**File**: `internal/storage/bm25_stats_concurrent_test.go` (modified, +41/-3)
```diff
@@ -47,6 +47,44 @@ func allTokensTF(vocab int32) []byte {
 	return typeutil.CreateAndSortSparseFloatRow(all)
 }
 
+// nonZeroCounts drops the zero counts BM25Stats keeps when a merge brings a token back to zero;
+// ConcurrentBM25Stats drops a token whenever its count reaches zero.
+func nonZeroCounts(rows map[uint32]int32) map[uint32]int32 {
+	out := make(map[uint32]int32, len(rows))
+	for token, count := range rows {
+		if count != 0 {
+			out[token] = count
+		}
+	}
+	return out
+}
+
+// Taking back everything that was merged must leave no tokens, on every write path.
+func TestConcurrentBM25StatsDropsZeroCounts(t *testing.T) {
+	r := rand.New(rand.NewSource(21))
+	// below and above the split threshold of the locked path
+	for _, rows := range []int{20, 2000} {
+		s := randomBM25Stats(r, rows, 20000)
+
+		c := NewConcurrentBM25Stats()
+		c.Merge(s)
+		c.Minus(s)
+		assert.Empty(t, c.Snapshot().rowsWithToken, "Minus, %d rows", rows)
+		assert.Zero(t, c.MemSize()-NewConcurrentBM25Stats().MemSize(), "Minus, %d rows", rows)
+
+		c.MergeUnlocked(s)
+		c.MinusUnlocked(s)
+		assert.Empty(t, c.Snapshot().rowsWithToken, "MinusUnlocked, %d rows", rows)
+
+		negative := NewConcurrentBM25Stats()
+		negative.Minus(s)
+		c.Merge(s)
+		c.MergeFrom(negative)
+		assert.Empty(t, c.Snapshot().rowsWithToken, "MergeFrom, %d rows", rows)
+		assert.Zero(t, c.NumRow())
+	}
+}
+
 func TestConcurrentBM25StatsMatchesSerial(t *testing.T) {
 	// both the per-token path (small stats) and the split path (large stats)
 	for _, tc := range []struct {
@@ -95,7 +133,7 @@ func TestConcurrentBM25StatsMatchesSerial(t *testing.T) {
 			got := c.Snapshot()
 			assert.Equal(t, expected.NumRow(), c.NumRow())
 			assert.Equal(t, expected.NumToken(), c.NumToken())
-			assert.Equal(t, expected.rowsWithToken, got.rowsWithToken)
+			assert.Equal(t, nonZeroCounts(expected.rowsWithToken), got.rowsWithToken)
 			assert.Equal(t, expected.GetAvgdl(), c.GetAvgdl())
 			tf := allTokensTF(tc.vocab)
 			assert.Equal(t, expected.BuildIDF(tf), c.BuildIDF(tf))
@@ -120,7 +158,7 @@ func TestConcurrentBM25StatsUnlockedMatchesSerial(t *testing.T) {
 		}
 		assert.Equal(t, expected.NumRow(), c.NumRow())
 		assert.Equal(t, expected.NumToken(), c.NumToken())
-		assert.Equal(t, expected.rowsWithToken, c.Snapshot().rowsWithToken)
+		assert.Equal(t, nonZeroCounts(expected.rowsWithToken), c.Snapshot().rowsWithToken)
 		tf := allTokensTF(20000)
 		assert.Equal(t, expected.BuildIDF(tf), c.BuildIDFUnlocked(tf))
 		assert.Equal(t, c.BuildIDF(tf), c.BuildIDFUnlocked(tf))
@@ -146,7 +184,7 @@ func TestConcurrentBM25StatsMergeFrom(t *testing.T) {
 	got := a.Snapshot()
 	assert.Equal(t, expected.NumRow(), a.NumRow())
 	assert.Equal(t, expected.NumToken(), a.NumToken())
-	assert.Equal(t, expected.rowsWithToken, got.rowsWithToken)
+	assert.Equal(t, nonZeroCounts(expected.rowsWithToken), got.rowsWithToken)
 }
 
 // A search during preload reads current while segments merge into it. It must never see a token in more
```

---

### Incident Patch 3: `e93d9b7d` (2026-10-16)
**Commit Message**: fix: stop serializing BM25 IDF stats merges and holding every segment's stats during delegator recovery (#53950)

issue: #53949

## What

A delegator recreated after a streaming node failure becomes serviceable
only after every sealed segment of its shard is registered with it, and
each registration merges the segment's BM25 stats into the shard-wide
IDF stats (`idfOracle.current`). Both ways of doing that merge were
serialized per shard, and on master the second one also held every
segment's stats in memory at once. This PR has three commits.

### 1. Shard the IDF stats by token

`preloadSealed` merged each preloaded segment under the oracle write
lock, so a shard registered segments at the speed of one map merge.
`storage.ConcurrentBM25Stats` splits the token table into 32 shards,
each with its own lock. Every token lives in exactly one shard, so it
takes the same memory as `BM25Stats`, and merges of different segments
run in parallel. `current` becomes a table of these per BM25 field,
preloads merge under the oracle read lock, and `BuildIDF` shares the IDF
formula with `BM25Stats` (same result bit for bit). The split buffers of
large merges are pooled.

### 2. One diff in SyncDi

**File**: `internal/querynodev2/delegator/distribution.go` (modified, +4/-1)
```diff
@@ -515,8 +515,11 @@ func (d *distribution) SyncTargetVersion(action *querypb.SyncAction, partitions
 	// depends on the snapshot just generated.
 	d.genSnapshot()
 	if d.idfOracle != nil {
-		d.idfOracle.SetNext(d.current.Load())
+		// Mark the growing segments replaced by sealed ones before publishing the target: the sync of this
+		// target counts their sealed stats and must drop the growing ones in the same step. SetNext syncs the
+		// first target before returning and later ones may sync before a mark placed after it.
 		d.idfOracle.LazyRemoveGrowings(action.GetTargetVersion(), redundantGrowings...)
+		d.idfOracle.SetNext(d.current.Load())
 	}
 	d.updateServiceable("SyncTargetVersion")
 
```

**File**: `internal/querynodev2/delegator/idf_oracle.go` (modified, +488/-83)
```diff
@@ -189,6 +189,10 @@ type sealedBm25Stats struct {
 	localDir  string
 	fieldList []int64 // bm25 field list
 	diskSize  int64   // total disk size of local files
+
+	// version changes whenever what the segment contributes to current changes:
+	// activation and its field list. Written with the struct lock held.
+	version uint64
 }
 
 func (s *sealedBm25Stats) HasField(fieldID int64) bool {
@@ -218,6 +222,7 @@ func (s *sealedBm25Stats) addFieldsLocked(fieldIDs []int64) {
 			continue
 		}
 		s.fieldList = append(s.fieldList, fieldID)
+		s.version++
 	}
 }
 
@@ -247,6 +252,9 @@ func (s *sealedBm25Stats) RetainFields(fieldIDs map[int64]struct{}) int64 {
 		}
 		removedDiskSize += fieldDiskSize
 	}
+	if len(kept) != len(s.fieldList) {
+		s.version++
+	}
 	s.fieldList = kept
 	if removedDiskSize > s.diskSize {
 		removedDiskSize = s.diskSize
@@ -279,13 +287,28 @@ func (s *sealedBm25Stats) Remove() {
 func (s *sealedBm25Stats) FetchStats() (map[int64]*storage.BM25Stats, error) {
 	s.RLock()
 	defer s.RUnlock()
+	return s.fetchFieldsLocked(s.fieldList)
+}
 
+// fetchSnapshot reads the stats together with the version and field list they belong to.
+func (s *sealedBm25Stats) fetchSnapshot() (bm25Stats, uint64, []int64, error) {
+	s.RLock()
+	defer s.RUnlock()
+	stats, err := s.fetchFieldsLocked(s.fieldList)
+	if err != nil {
+		return nil, 0, nil, err
+	}
+	return stats, s.version, slices.Clone(s.fieldList), nil
+}
+
+// fetchFieldsLocked reads the stats of the given fields. Caller must hold the lock (read or write).
+func (s *sealedBm25Stats) fetchFieldsLocked(fieldIDs []int64) (map[int64]*storage.BM25Stats, error) {
 	if s.removed {
 		return nil, merr.WrapErrServiceInternalMsg("sealed bm25 stats for segment %d already removed", s.segmentID)
 	}
 
 	stats := make(map[int64]*storage.BM25Stats)
-	for _, fieldID := range s.fieldList {
+	for _, fieldID := range fieldIDs {
 		fieldDir := path.Join(s.localDir, fmt.Sprintf("%d", fieldID))
 		entries, err := os.ReadDir(fieldDir)
 		if err != nil {
@@ -362,6 +385,140 @@ func (s bm25Stats) RetainFields(fieldIDs map[int64]struct{}) {
 	}
 }
 
+// idfSyncParallelism bounds the goroutines that read sealed segment stats in SyncDistribution.
+const idfSyncParallelism = 8
+
+// idfSyncMaxAttempts bounds how often SyncDistribution restarts when the BM25 fields change while it reads stats.
+const idfSyncMaxAttempts = 3
+
+// syncDistributionAfterFetchHook runs in tests between reading stats outside the lock and applying them.
+var syncDistributionAfterFetchHook func()
+
+// statsTable is the shard-wide BM25 stats of each BM25 field. Merge and Minus are safe for
+// concurrent use, so loads holding only the oracle read lock can merge in parallel.
+// Changing the field set (SyncFunctions) needs the oracle write lock.
+type statsTable struct {
+	mu     sync.RWMutex // guards fields
+	fields map[int64]*storage.ConcurrentBM25Stats
+}
+
+func newStatsTable(functions []*schemapb.FunctionSchema) *statsTable {
+	t := &statsTable{fields: make(map[int64]*storage.ConcurrentBM25Stats)}
+	for _, function := range functions {
+		if function.GetType() == schemapb.FunctionType_BM25 {
+			t.fields[function.GetOutputFieldIds()[0]] = storage.NewConcurrentBM25Stats()
+		}
+	}
+	return t
+}
+
+func (t *statsTable) field(fieldID int64) *storage.ConcurrentBM25Stats {
+	t.mu.RLock()
+	stats, ok := t.fields[fieldID]
+	t.mu.RUnlock()
+	if ok {
+		return stats
+	}
+
+	t.mu.Lock()
+	defer t.mu.Unlock()
+	if stats, ok = t.fields[fieldID]; !ok {
+		stats = storage.NewConcurrentBM25Stats()
+		t.fields[fieldID] = stats
+	}
+	return stats
+}
+
+func (t *statsTable) Merge(stats bm25Stats) {
+	for fieldID, s := range stats {
+		if s != nil {
+			t.field(fieldID).Merge(s)
+		}
+	}
+}
+
+func (t *statsTable) Minus(stats bm25Stats) {
+	for fieldID, s := range stats {
+		if s != nil {
+			t.field(fieldID).Minus(s)
+		}
+	}
+}
+
+// MergeExclusive and MinusExclusive are Merge and Minus for callers holding the oracle write lock,
+// which keeps every other reader and writer of current out, so the shard locks are skipped.
+func (t *statsTable) MergeExclusive(stats bm25Stats) {
+	for fieldID, s := range stats {
+		if s != nil {
+			t.field(fieldID).MergeUnlocked(s)
+		}
+	}
+}
+
+func (t *statsTable) MinusExclusive(stats bm25Stats) {
+	for fieldID, s := range stats {
+		if s != nil {
+			t.field(fieldID).MinusUnlocked(s)
+		}
+	}
+}
+
+func (t *statsTable) GetStats(fieldID int64) (*storage.ConcurrentBM25Stats, error) {
+	t.mu.RLock()
+	defer t.mu.RUnlock()
+	stats, ok := t.fields[fieldID]
+	if !ok {
+		return nil, merr.WrapErrFieldNotFound(fieldID, "not in idf oracle BM25 stats")
+	}
+	return stats, nil
+}
+
+func (t *statsTable) NumRow() int64 {
+	t.mu.RLock()
+	defer t.mu.RUnlock()
+	for _, stats := range t.fields {
+		return stats.NumRow()
+	}
+	return 0
+}
+
+func (t *statsTable) MemSize() int64 {
+	t.mu.RLock()
+	defer t.mu.RUnlock()
+	size := int64(0)
+	for _, stats := range t.fields {
+		size += stats.MemSize()
+	}
```

**File**: `internal/querynodev2/delegator/idf_oracle_sync_test.go` (added, +599/-0)
```diff
@@ -0,0 +1,599 @@
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
+package delegator
+
+import (
+	"bytes"
+	"context"
+	"fmt"
+	"math/rand"
+	"os"
+	"path"
+	"sync"
+	"testing"
+	"time"
+
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/mock"
+	"github.com/stretchr/testify/require"
+
+	"github.com/milvus-io/milvus-proto/go-api/v3/schemapb"
+	"github.com/milvus-io/milvus/internal/mocks"
+	"github.com/milvus-io/milvus/internal/storage"
+	"github.com/milvus-io/milvus/pkg/v3/proto/datapb"
+	"github.com/milvus-io/milvus/pkg/v3/proto/querypb"
+	"github.com/milvus-io/milvus/pkg/v3/util/merr"
+	"github.com/milvus-io/milvus/pkg/v3/util/typeutil"
+)
+
+// These tests change the sealed segments while SyncDistribution is between reading the stats
+// of the segments it activates or deactivates (outside the oracle lock) and applying them
+// (under the oracle lock), through syncDistributionAfterFetchHook.
+
+const syncTestVocab = 64
+
+func newSyncTestOracle(t *testing.T, fieldIDs ...int64) *idfOracle {
+	functions := make([]*schemapb.FunctionSchema, 0, len(fieldIDs))
+	for _, fieldID := range fieldIDs {
+		functions = append(functions, &schemapb.FunctionSchema{
+			Type:           schemapb.FunctionType_BM25,
+			InputFieldIds:  []int64{fieldID - 1},
+			OutputFieldIds: []int64{fieldID},
+		})
+	}
+	o := NewIDFOracle("sync-test-channel", functions).(*idfOracle)
+	o.dirPath = t.TempDir()
+	o.Start()
+	t.Cleanup(o.Close)
+	return o
+}
+
+func syncTestFunctions(fieldIDs ...int64) []*schemapb.FunctionSchema {
+	functions := make([]*schemapb.FunctionSchema, 0, len(fieldIDs))
+	for _, fieldID := range fieldIDs {
+		functions = append(functions, &schemapb.FunctionSchema{
+			Type:           schemapb.FunctionType_BM25,
+			InputFieldIds:  []int64{fieldID - 1},
+			OutputFieldIds: []int64{fieldID},
+		})
+	}
+	return functions
+}
+
+func randomSyncTestStats(r *rand.Rand, rows int) *storage.BM25Stats {
+	stats := storage.NewBM25Stats()
+	for i := 0; i < rows; i++ {
+		row := map[uint32]float32{}
+		for j := 0; j < 4; j++ {
+			row[uint32(r.Int31n(syncTestVocab))] += 1
+		}
+		stats.Append(row)
+	}
+	return stats
+}
+
+// syncTestSegment serves the stats files of one sealed segment from a mock chunk manager.
+type syncTestSegment struct {
+	id    int64
+	stats map[int64]*storage.BM25Stats
+	cm    *mocks.ChunkManager
+}
+
+func newSyncTestSegment(t *testing.T, id int64, stats map[int64]*storage.BM25Stats) *syncTestSegment {
+	seg := &syncTestSegment{id: id, stats: stats, cm: mocks.NewChunkManager(t)}
+	for fieldID, s := range stats {
+		data, err := s.Serialize()
+		require.NoError(t, err)
+		seg.cm.EXPECT().Reader(mock.Anything, seg.remotePath(fieldID)).RunAndReturn(
+			func(context.Context, string) (storage.FileReader, error) {
+				return &bytesFileReader{bytes.NewReader(data)}, nil
+			}).Maybe()
+	}
+	return seg
+}
+
+func (s *syncTestSegment) remotePath(fieldID int64) string {
+	return fmt.Sprintf("bm25stats/seg_%d/field_%d/0", s.id, fieldID)
+}
+
+func (s *syncTestSegment) loadInfo(fieldIDs ...int64) *querypb.SegmentLoadInfo {
+	logs := make([]*datapb.FieldBinlog, 0, len(fieldIDs))
+	for _, fieldID := range fieldIDs {
+		logs = append(logs, bm25LogsForField(fieldID, s.remotePath(fieldID))...)
+	}
+	return &querypb.SegmentLoadInfo{Bm25Logs: logs}
+}
+
+// load registers the segment with the given fields. Before the first target (targetVersion 0)
+// the segment is preloaded and active; after it, the segment stays inactive until a sync activates it.
+func (s *syncTestSegment) load(t *testing.T, o *idfOracle, fieldIDs ...int64) {
+	require.NoError(t, o.LoadSealed(context.Background(), s.id, s.loadInfo(fieldIDs...), s.cm))
+}
+
+func syncTestSnapshot(version int64, segIDs ...int64) *snapshot {
+	segments := make([]SegmentEntry, 0, len(segIDs))
+	for _, segID := range segIDs {
+		segments = append(segments, SegmentEntry{NodeID: 1, SegmentID: segID, TargetVersion: version})
+	}
+	return &snapshot{dist: []SnapshotItem{{NodeID: 1, Segments: segments}}, targetVersion: version}
+}
+
+// syncWithHook runs SyncDistribution for the snapshot, running hook once between the
+// unlocked stats read and the locked apply.
+func syncWithHook(t *testing.T, o *idfOracle, snap *snaps
```

**File**: `internal/querynodev2/delegator/idf_oracle_test.go` (modified, +149/-8)
```diff
@@ -20,8 +20,10 @@ import (
 	"bytes"
 	"context"
 	"fmt"
+	"math/rand"
 	"os"
 	"path"
+	"sync"
 	"testing"
 	"time"
 
@@ -494,6 +496,141 @@ func (suite *IDFOracleSuite) TestLoadSealedFailureCleanup() {
 	suite.True(os.IsNotExist(statErr))
 }
 
+// setFieldForTest replaces the stats of one field.
+func (t *statsTable) setFieldForTest(fieldID int64, stats *storage.BM25Stats) {
+	concurrent := storage.NewConcurrentBM25Stats()
+	concurrent.Merge(stats)
+	t.mu.Lock()
+	defer t.mu.Unlock()
+	t.fields[fieldID] = concurrent
+}
+
+// genOverlapStats builds stats of rows drawing tokens from [0, vocab), so different segments share tokens.
+func (suite *IDFOracleSuite) genOverlapStats(r *rand.Rand, rows int, vocab uint32) map[int64]*storage.BM25Stats {
+	result := map[int64]*storage.BM25Stats{102: storage.NewBM25Stats()}
+	for i := 0; i < rows; i++ {
+		row := map[uint32]float32{}
+		for j := 0; j < 8; j++ {
+			row[uint32(r.Int31n(int32(vocab)))] += 1
+		}
+		result[102].Append(row)
+	}
+	return result
+}
+
+// assertIDFEqual checks that the oracle builds the same IDF and avgdl as expected for every token.
+func (suite *IDFOracleSuite) assertIDFEqual(expected *storage.BM25Stats, vocab uint32) {
+	all := map[uint32]float32{}
+	for i := uint32(0); i < vocab; i++ {
+		all[i] = 1
+	}
+	tf := typeutil.CreateAndSortSparseFloatRow(all)
+	idf, avgdl, err := suite.idfOracle.BuildIDF(102, &schemapb.SparseFloatArray{Contents: [][]byte{tf}, Dim: int64(vocab)})
+	suite.Require().NoError(err)
+	suite.Equal(expected.GetAvgdl(), avgdl)
+	suite.Equal(typeutil.SparseFloatBytesToMap(expected.BuildIDF(tf)), typeutil.SparseFloatBytesToMap(idf[0]))
+}
+
+func (suite *IDFOracleSuite) TestConcurrentPreloadMatchesSerial() {
+	const segNum, vocab = 200, 500
+	r := rand.New(rand.NewSource(7))
+
+	segStats := make(map[int64]*storage.BM25Stats, segNum)
+	cms := make(map[int64]*mocks.ChunkManager, segNum)
+	logs := make(map[int64][]*datapb.FieldBinlog, segNum)
+	for segID := int64(1); segID <= segNum; segID++ {
+		stats := suite.genOverlapStats(r, 20, vocab)
+		data, err := stats[102].Serialize()
+		suite.Require().NoError(err)
+		remotePath := fmt.Sprintf("bm25stats/seg_%d/field_102/0", segID)
+		cm := mocks.NewChunkManager(suite.T())
+		cm.EXPECT().Reader(mock.Anything, remotePath).Return(&bytesFileReader{bytes.NewReader(data)}, nil)
+		segStats[segID], cms[segID] = stats[102], cm
+		logs[segID] = bm25LogsForField(102, remotePath)
+	}
+
+	// load all segments concurrently while searches and memory accounting read the oracle
+	var wg sync.WaitGroup
+	stop := make(chan struct{})
+	readerDone := make(chan struct{})
+	go func() {
+		defer close(readerDone)
+		tf := typeutil.CreateAndSortSparseFloatRow(map[uint32]float32{1: 1})
+		for {
+			select {
+			case <-stop:
+				return
+			default:
+				suite.idfOracle.BuildIDF(102, &schemapb.SparseFloatArray{Contents: [][]byte{tf}, Dim: 2})
+				suite.idfOracle.MemorySize()
+			}
+		}
+	}()
+	errs := make(chan error, segNum)
+	for segID := int64(1); segID <= segNum; segID++ {
+		wg.Add(1)
+		go func(segID int64) {
+			defer wg.Done()
+			errs <- suite.idfOracle.LoadSealed(context.Background(), segID, &querypb.SegmentLoadInfo{Bm25Logs: logs[segID]}, cms[segID])
+		}(segID)
+	}
+	wg.Wait()
+	close(stop)
+	<-readerDone
+	close(errs)
+	for err := range errs {
+		suite.Require().NoError(err)
+	}
+
+	expected := storage.NewBM25Stats()
+	for _, stats := range segStats {
+		expected.Merge(stats)
+	}
+	suite.assertIDFEqual(expected, vocab)
+
+	// first target keeps the odd segments: the even ones are deactivated through the parallel merge
+	seals := []int64{}
+	expected = storage.NewBM25Stats()
+	for segID := int64(1); segID <= segNum; segID += 2 {
+		seals = append(seals, segID)
+		expected.Merge(segStats[segID])
+	}
+	suite.updateSnapshot(seals, []int64{}, []int64{})
+	suite.idfOracle.SetNext(suite.snapshot)
+	suite.waitTargetVersion(suite.targetVersion)
+	suite.assertIDFEqual(expected, vocab)
+}
+
+func (suite *IDFOracleSuite) TestFetchStatsDiff() {
+	suite.registerSealed(1, 1, 5)
+	suite.registerSealed(2, 5, 9)
+	kept, ok := suite.idfOracle.sealed.Get(1)
+	suite.Require().True(ok)
+	removed, ok := suite.idfOracle.sealed.Get(2)
+	suite.Require().True(ok)
+
+	// one activated, one deactivated: the diff holds the difference and records what was read
+	add := &statsCandidate{seg: kept}
+	sub := &statsCandidate{seg: removed, minus: true}
+	diff, err := fetchStatsDiff(map[int64]*statsCandidate{1: add, 2: sub})
+	suite.NoError(err)
+	suite.Equal(int64(0), diff.NumRow())
+	suite.Equal([]int64{102}, add.fields)
+	suite.Equal(kept.version, add.version)
+
+	diff, err = fetchStatsDiff(map[int64]*statsCandidate{1: {seg: kept}})
+	suite.NoError(err)
+	suite.Equal(int64(4), diff.NumRow())
+
+	removed.Remove()
+	_, err = fetchStatsDiff(map[int64]*statsCandidate{1: {seg: kept}, 2: {seg: removed}})
+	suite.Error(err)
+
+	diff, err = fetchStatsDiff(nil)
+	suite.NoError(err)
+	suite.Equal(int64(0), diff.NumRow())
+}
+
 func TestI
```

**File**: `internal/storage/bm25_stats_concurrent.go` (added, +262/-0)
```diff
@@ -0,0 +1,262 @@
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
+package storage
+
+import (
+	"sync"
+	"sync/atomic"
+
+	"github.com/milvus-io/milvus/pkg/v3/util/paramtable"
+	"github.com/milvus-io/milvus/pkg/v3/util/typeutil"
+)
+
+const (
+	// concurrentBM25StatsShardBits sets 32 shards; each token belongs to exactly one shard.
+	concurrentBM25StatsShardBits = 5
+	concurrentBM25StatsShards    = 1 << concurrentBM25StatsShardBits
+
+	// below this many tokens a merge locks the shard per token instead of splitting the stats first
+	concurrentBM25StatsSplitThreshold = 1024
+)
+
+// ConcurrentBM25Stats holds the same data as BM25Stats with the token table split into shards,
+// each guarded by its own lock, so concurrent merges of different stats proceed in parallel.
+// Every token lives in exactly one shard, so it takes the same memory as a single BM25Stats.
+// A reader running concurrently with a merge may observe that merge partially applied.
+//
+// A concurrent BuildIDF still never sees more rows containing a token than rows in total, which would
+// make the IDF negative: Merge and MergeFrom add the row count before the token counts, and BuildIDF reads
+// the token counts before the row count. Minus does not keep this, so it must not run concurrently with BuildIDF.
+//
+// The shard locks cost an atomic update per token, which matters on hot paths that are already
+// serialized by the caller. The Unlocked methods skip them: MergeUnlocked and MinusUnlocked need
+// the caller to hold c exclusively, and BuildIDFUnlocked needs that no write runs concurrently.
+type ConcurrentBM25Stats struct {
+	shards    [concurrentBM25StatsShards]bm25StatsShard
+	numRow    atomic.Int64
+	numToken  atomic.Int64
+	nextShard atomic.Uint32 // rotates the first shard a large merge writes to, to spread contention
+}
+
+type bm25StatsShard struct {
+	sync.RWMutex
+	rowsWithToken map[uint32]int32
+}
+
+type tokenCount struct {
+	token uint32
+	count int32
+}
+
+var splitBufferPool = sync.Pool{New: func() any {
+	split := make([][]tokenCount, concurrentBM25StatsShards)
+	return &split
+}}
+
+func NewConcurrentBM25Stats() *ConcurrentBM25Stats {
+	c := &ConcurrentBM25Stats{}
+	for i := range c.shards {
+		c.shards[i].rowsWithToken = map[uint32]int32{}
+	}
+	return c
+}
+
+// shardOf spreads tokens with Fibonacci hashing, so shards stay balanced even if token low bits are not uniform.
+func shardOf(token uint32) uint32 {
+	return (token * 2654435769) >> (32 - concurrentBM25StatsShardBits)
+}
+
+// Merge adds stats into c. Safe for concurrent use.
+func (c *ConcurrentBM25Stats) Merge(stats *BM25Stats) {
+	// the row count goes first, see the type comment
+	c.numRow.Add(stats.numRow)
+	c.numToken.Add(stats.numToken)
+	c.apply(stats.rowsWithToken, 1)
+}
+
+// Minus subtracts stats from c. Safe for concurrent use with other writes, but not with BuildIDF.
+func (c *ConcurrentBM25Stats) Minus(stats *BM25Stats) {
+	c.apply(stats.rowsWithToken, -1)
+	c.numRow.Add(-stats.numRow)
+	c.numToken.Add(-stats.numToken)
+}
+
+// MergeUnlocked adds stats into c. The caller must hold c exclusively.
+func (c *ConcurrentBM25Stats) MergeUnlocked(stats *BM25Stats) {
+	c.applyUnlocked(stats.rowsWithToken, 1)
+	c.numRow.Add(stats.numRow)
+	c.numToken.Add(stats.numToken)
+}
+
+// MinusUnlocked subtracts stats from c. The caller must hold c exclusively.
+func (c *ConcurrentBM25Stats) MinusUnlocked(stats *BM25Stats) {
+	c.applyUnlocked(stats.rowsWithToken, -1)
+	c.numRow.Add(-stats.numRow)
+	c.numToken.Add(-stats.numToken)
+}
+
+func (c *ConcurrentBM25Stats) applyUnlocked(rows map[uint32]int32, sign int32) {
+	for token, count := range rows {
+		c.shards[shardOf(token)].rowsWithToken[token] += sign * count
+	}
+}
+
+func (c *ConcurrentBM25Stats) apply(rows map[uint32]int32, sign int32) {
+	if len(rows) < concurrentBM25StatsSplitThreshold {
+		for token, count := range rows {
+			shard := &c.shards[shardOf(token)]
+			shard.Lock()
+			shard.rowsWithToken[token] += sign * count
+			shard.Unlock()
+		}
+		return
+	}
+
+	// the split buffers are reused across merges: a recovering delegator merges thousands of
+	// segments with hundreds of thousands of tokens each, and fresh buffers per merge pile up as garbage
+	buf
```

**File**: `internal/storage/bm25_stats_concurrent_bench_test.go` (added, +133/-0)
```diff
@@ -0,0 +1,133 @@
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
+package storage
+
+import (
+	"fmt"
+	"math/rand"
+	"sync"
+	"testing"
+
+	"github.com/milvus-io/milvus/pkg/v3/util/typeutil"
+)
+
+// The benchmarks compare BM25Stats (master) and ConcurrentBM25Stats on the paths that run outside
+// recovery, the way idfOracle calls them: BuildIDF under the oracle read lock (every BM25 search)
+// and a small Merge under the oracle write lock (UpdateGrowing, every insert batch).
+
+const benchVocab = 2_000_000
+
+type benchTables struct {
+	tokens     []uint32
+	plain      *BM25Stats
+	concurrent *ConcurrentBM25Stats
+}
+
+var (
+	benchOnce sync.Once
+	benchData benchTables
+)
+
+func loadBenchTables() benchTables {
+	benchOnce.Do(func() {
+		r := rand.New(rand.NewSource(1))
+		tokens := make([]uint32, benchVocab)
+		plain := NewBM25Stats()
+		for i := range tokens {
+			tokens[i] = r.Uint32()
+			plain.rowsWithToken[tokens[i]] += 1 + int32(r.Intn(100))
+		}
+		plain.numRow, plain.numToken = 12_000_000, 600_000_000
+		concurrent := NewConcurrentBM25Stats()
+		concurrent.Merge(plain)
+		benchData = benchTables{tokens: tokens, plain: plain, concurrent: concurrent}
+	})
+	return benchData
+}
+
+func benchQuery(r *rand.Rand, tokens []uint32, n int) []byte {
+	row := make(map[uint32]float32, n)
+	for len(row) < n {
+		row[tokens[r.Intn(len(tokens))]] = 1
+	}
+	return typeutil.CreateAndSortSparseFloatRow(row)
+}
+
+func BenchmarkBuildIDF(b *testing.B) {
+	data := loadBenchTables()
+	for _, queryTokens := range []int{8, 128, 512} {
+		queries := make([][]byte, 64)
+		r := rand.New(rand.NewSource(int64(queryTokens)))
+		for i := range queries {
+			queries[i] = benchQuery(r, data.tokens, queryTokens)
+		}
+		for _, perCPU := range []int{1, 4} {
+			run := func(b *testing.B, buildIDF func(tf []byte) []byte) {
+				var oracle sync.RWMutex
+				b.SetParallelism(perCPU)
+				b.ResetTimer()
+				b.RunParallel(func(pb *testing.PB) {
+					i := 0
+					for pb.Next() {
+						oracle.RLock()
+						buildIDF(queries[i%len(queries)])
+						oracle.RUnlock()
+						i++
+					}
+				})
+			}
+			name := fmt.Sprintf("tokens=%d/goroutinesPerCPU=%d", queryTokens, perCPU)
+			b.Run(name+"/plain", func(b *testing.B) { run(b, data.plain.BuildIDF) })
+			b.Run(name+"/concurrent", func(b *testing.B) { run(b, data.concurrent.BuildIDF) })
+			b.Run(name+"/concurrent-unlocked", func(b *testing.B) { run(b, data.concurrent.BuildIDFUnlocked) })
+		}
+	}
+}
+
+func BenchmarkUpdateGrowing(b *testing.B) {
+	data := loadBenchTables()
+	for _, rows := range []int{1, 100} {
+		r := rand.New(rand.NewSource(int64(rows)))
+		batches := make([]*BM25Stats, 64)
+		for i := range batches {
+			batches[i] = NewBM25Stats()
+			for j := 0; j < rows; j++ {
+				row := map[uint32]float32{}
+				for k := 0; k < 50; k++ {
+					row[data.tokens[r.Intn(len(data.tokens))]] += 1
+				}
+				batches[i].Append(row)
+			}
+		}
+		run := func(b *testing.B, merge func(s *BM25Stats)) {
+			var oracle sync.RWMutex
+			b.ResetTimer()
+			for i := 0; i < b.N; i++ {
+				oracle.Lock()
+				merge(batches[i%len(batches)])
+				oracle.Unlock()
+			}
+		}
+		// both tables keep growing their counts, which does not change their size
+		plain := data.plain.Clone()
+		concurrent := NewConcurrentBM25Stats()
+		concurrent.Merge(plain)
+		b.Run(fmt.Sprintf("rows=%d/plain", rows), func(b *testing.B) { run(b, plain.Merge) })
+		b.Run(fmt.Sprintf("rows=%d/concurrent", rows), func(b *testing.B) { run(b, concurrent.Merge) })
+		b.Run(fmt.Sprintf("rows=%d/concurrent-unlocked", rows), func(b *testing.B) { run(b, concurrent.MergeUnlocked) })
+	}
+}
```

**File**: `internal/storage/bm25_stats_concurrent_test.go` (added, +236/-0)
```diff
@@ -0,0 +1,236 @@
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
+package storage
+
+import (
+	"math/rand"
+	"sync"
+	"testing"
+
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+
+	"github.com/milvus-io/milvus/pkg/v3/util/typeutil"
+)
+
+func randomBM25Stats(r *rand.Rand, rows int, vocab int32) *BM25Stats {
+	stats := NewBM25Stats()
+	for i := 0; i < rows; i++ {
+		row := map[uint32]float32{}
+		for j := 0; j < 8; j++ {
+			row[uint32(r.Int31n(vocab))] += 1
+		}
+		stats.Append(row)
+	}
+	return stats
+}
+
+func allTokensTF(vocab int32) []byte {
+	all := map[uint32]float32{}
+	for i := int32(0); i < vocab; i++ {
+		all[uint32(i)] = 1
+	}
+	return typeutil.CreateAndSortSparseFloatRow(all)
+}
+
+func TestConcurrentBM25StatsMatchesSerial(t *testing.T) {
+	// both the per-token path (small stats) and the split path (large stats)
+	for _, tc := range []struct {
+		name  string
+		rows  int
+		vocab int32
+	}{
+		{"small", 20, 200},
+		{"large", 2000, 20000},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			r := rand.New(rand.NewSource(11))
+			adds := make([]*BM25Stats, 64)
+			for i := range adds {
+				adds[i] = randomBM25Stats(r, tc.rows, tc.vocab)
+			}
+			minus := adds[:16]
+
+			expected := NewBM25Stats()
+			for _, s := range adds {
+				expected.Merge(s)
+			}
+			for _, s := range minus {
+				expected.Minus(s)
+			}
+
+			c := NewConcurrentBM25Stats()
+			var wg sync.WaitGroup
+			for _, s := range adds {
+				wg.Add(1)
+				go func(s *BM25Stats) {
+					defer wg.Done()
+					c.Merge(s)
+				}(s)
+			}
+			wg.Wait()
+			for _, s := range minus {
+				wg.Add(1)
+				go func(s *BM25Stats) {
+					defer wg.Done()
+					c.Minus(s)
+				}(s)
+			}
+			wg.Wait()
+
+			got := c.Snapshot()
+			assert.Equal(t, expected.NumRow(), c.NumRow())
+			assert.Equal(t, expected.NumToken(), c.NumToken())
+			assert.Equal(t, expected.rowsWithToken, got.rowsWithToken)
+			assert.Equal(t, expected.GetAvgdl(), c.GetAvgdl())
+			tf := allTokensTF(tc.vocab)
+			assert.Equal(t, expected.BuildIDF(tf), c.BuildIDF(tf))
+		})
+	}
+}
+
+func TestConcurrentBM25StatsUnlockedMatchesSerial(t *testing.T) {
+	// below and above the split threshold of the locked path
+	for _, rows := range []int{20, 2000} {
+		r := rand.New(rand.NewSource(int64(rows)))
+		expected := NewBM25Stats()
+		c := NewConcurrentBM25Stats()
+		for i := 0; i < 16; i++ {
+			s := randomBM25Stats(r, rows, 20000)
+			expected.Merge(s)
+			c.MergeUnlocked(s)
+			if i%4 == 0 {
+				expected.Minus(s)
+				c.MinusUnlocked(s)
+			}
+		}
+		assert.Equal(t, expected.NumRow(), c.NumRow())
+		assert.Equal(t, expected.NumToken(), c.NumToken())
+		assert.Equal(t, expected.rowsWithToken, c.Snapshot().rowsWithToken)
+		tf := allTokensTF(20000)
+		assert.Equal(t, expected.BuildIDF(tf), c.BuildIDFUnlocked(tf))
+		assert.Equal(t, c.BuildIDF(tf), c.BuildIDFUnlocked(tf))
+	}
+}
+
+func TestConcurrentBM25StatsMergeFrom(t *testing.T) {
+	r := rand.New(rand.NewSource(5))
+	expected := NewBM25Stats()
+	a, b := NewConcurrentBM25Stats(), NewConcurrentBM25Stats()
+	for i := 0; i < 10; i++ {
+		s := randomBM25Stats(r, 500, 5000)
+		expected.Merge(s)
+		if i%2 == 0 {
+			a.Merge(s)
+		} else {
+			b.Minus(s) // MergeFrom must carry negative counts too
+			expected.Minus(s)
+			expected.Minus(s)
+		}
+	}
+	a.MergeFrom(b)
+	got := a.Snapshot()
+	assert.Equal(t, expected.NumRow(), a.NumRow())
+	assert.Equal(t, expected.NumToken(), a.NumToken())
+	assert.Equal(t, expected.rowsWithToken, got.rowsWithToken)
+}
+
+// A search during preload reads current while segments merge into it. It must never see a token in more
+// rows than the row count, which gives a negative IDF that the worker rejects as an invalid sparse vector.
+func TestConcurrentBM25StatsBuildIDFNeverNegativeDuringMerge(t *testing.T) {
+	const vocab = 2048 // above the split threshold, like a real segment
+	// every row holds every token, so after any set of whole merges each token is in exactly numRow rows
+	row := map[uint32]float32{}
+	for i := uint32(0); i < vocab; i++ {
+		row[i] = 1
+	}
+	segment := NewBM25Stats()
+	for i := 0; i < 4; i++ {
+		segment.Append(row)
+	}
+	tf := allTokensTF(vocab)
+
+	for _, merge := range []struct {
+		name string
+		fn   func
```

**File**: `internal/storage/stats.go` (modified, +6/-2)
```diff
@@ -509,12 +509,16 @@ func (m *BM25Stats) BuildIDF(tf []byte) (idf []byte) {
 	for idx := 0; idx < numElements; idx++ {
 		key := typeutil.SparseFloatRowIndexAt(tf, idx)
 		value := typeutil.SparseFloatRowValueAt(tf, idx)
-		nq := m.rowsWithToken[key]
-		typeutil.SparseFloatRowSetAt(idf, idx, key, value*float32(math.Log(1+(float64(m.numRow)-float64(nq)+0.5)/(float64(nq)+0.5))))
+		typeutil.SparseFloatRowSetAt(idf, idx, key, bm25TermIDF(value, m.numRow, m.rowsWithToken[key]))
 	}
 	return idf
 }
 
+// bm25TermIDF weights a query term by its IDF given the total row count and the rows containing the term.
+func bm25TermIDF(value float32, numRow int64, nq int32) float32 {
+	return value * float32(math.Log(1+(float64(numRow)-float64(nq)+0.5)/(float64(nq)+0.5)))
+}
+
 func (m *BM25Stats) GetAvgdl() float64 {
 	if m.numRow == 0 || m.numToken == 0 {
 		return 0
```

#### Recent Merged Pull Requests:
- **PR #54372** (2026-10-17): fix: drop zero-count tokens in ConcurrentBM25Stats like BM25Stats.Minus (@czs007)
- **PR #54360** (2026-10-17): fix: [2.6] initialize VectorArray in PrepareResultFieldData for empty pages (@xiaofan-luan)
- **PR #54356** (2026-10-19): enhance: [3.0] Import StorageV3 snapshots with L0 deletes (@weiliu1031)
- **PR #54347** (2026-10-18): build(deps): bump Rust to 1.94 in builder images and install scripts (@yanbinyang)
- **PR #54346** (2026-10-16): enhance: materialize only paginated query results (@xiaofan-luan)
- **PR #54336** (2026-10-19): fix: [2.6] Preserve load priority in LoadBatchFieldData (@sparknack)

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

## X. remove canceled DQL tasks from queue (#52939)

**RULE**:
When implementing operations in `internal/proxy/condition_test.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in milvus-io/milvus. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `840041e0`: remove canceled DQL tasks from queue (#52939). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `internal/proxy/condition_test.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	"sync/atomic"

func TestTaskCondition_OnContextDone(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		condition := NewTaskCondition(context.Background())
		var calls atomic.Int32
		condition.SetOnContextDone(func() {
			calls.Add(1)
		})

		condition.Notify(nil)
		assert.NoError(t, condition.WaitToFinish())
		assert.Zero(t, calls.Load())
	})

	t.Run("task error", func(t *testing.T) {
		condition := NewTaskCondition(context.Background())
		var calls atomic.Int32
		condition.SetOnContextDone(func() {
			calls.Add(1)
		})

		condition.Notify(errors.New("task failed"))
		assert.Error(t, condition.WaitToFinish())
		assert.Zero(t, calls.Load())
	})

	t.Run("context canceled", func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		condition := NewTaskCondition(ctx)
		var calls atomic.Int32
		condition.SetOnContextDone(func() {
			calls.Add(1)
		})

		cancel()
		assert.Error(t, condition.WaitToFinish())
		assert.Equal(t, int32(1), calls.Load())
	})
}
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `840041e0` are properly handled with clean fallback behavior.
