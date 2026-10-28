> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/milvus-io-milvus-learnings.md`  
> **Source**: github ([https://github.com/milvus-io/milvus](https://github.com/milvus-io/milvus))  
> **Source Version**: `3f0e3b9a`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-28T20:44:34.465Z  
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
> **Harvest Timestamp**: 2026-10-28T20:44:34.458Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `milvus-io/milvus`
- **Description**: Milvus is a high-performance, cloud-native vector database built for scalable vector ANN search
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 46513 stars

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
- **Issue #54770** (2026-10-28): **fix: [cp3.0] support contextual keywords as field names**
  *Symptoms*: issue: #53925 pr: #53968  Cherry-pick of #53968 onto 3.0.  ## What  Fields named after contextual keywords (`iso`, `interval`, ...) can be created but could not be used in filters, because the lexer emits a keyword token where the parser expects an identifier. A shared `fieldName` rule now accepts 20 contextual keyword families in expression field positions while keeping their function, option and timestamp syntax. `LIKE`, `AND`, `OR`, `NOT` and `IN` are rejected as field names in every casing on Create and Add.  Compatibility (same as master): mixed-case names such as `And`, `In` and `Like` could be created before; new Create/Add requests now reject them. Existing collections are not revalidated.  ## 3.0 adaptations  - The master change to `internal/proxy/task.go` / `internal/proxy/util.go` maps to `internal/proxy/ddl/task.go` / `internal/proxy/ddl/util_ddl.go` on 3.0. - 3.0 already validates the struct-array parent name before the remaining struct checks and already classifies `ErrFieldInvalidName` (1701) as `InputError`, so those parts of #53968 are kept as they are on 3.0 (`pkg/util/merr/errors.go` is unchanged). - `ARRAY_LENGTH` keeps 3.0's operand list (no struct sub-field operand); that operand comes from a different master change, not from #53968. - The parser under `internal/parser/planparserv2/generated` was regenerated from the 3.0 grammar with ANTLR 4.13.2 (`generate.sh`), not copied from master. - `internal/proxy/contextual_keywords_test.go` already existed on 3.

- **Issue #54764** (2026-10-28): **fix: return WALNameMismatch synchronously during remote consumer creation**
  *Symptoms*: Fixes #54762  When a remote consumer reconnects with a position from the previous WAL backend, the VChannel handshake reports `WALNameMismatch` after the constructor has already returned. The handler client's existing `DeliverPolicyAll` fallback therefore cannot catch the error.  Complete the VChannel handshake before returning the consumer and starting its receive loop. Each creation attempt owns a child context, so failures release its stream while preserving the parent context and upper message handler for retry. Validate both successful and embedded-error handshake responses.  Add gRPC regressions using the production server/client error interceptors, with fault-injection coverage for handshake failures and cancellation. Historical WAL catch-up and handler-level catch-up/All-handoff coverage are in #54778 (issue #54763), which must merge after this PR. The two PRs have no overlapping changed files.  ### Validation  - Confirmed the gRPC mismatch regression fails on unmodified master and passes with this change. - Passed consumer, streaming status and streaming service interceptor tests with `-tags dynamic,test -gcflags="all=-N -l" -count=1`; reran the full consumer package after moving handler handoff coverage to #54778. - Passed scoped consumer lint. - Audited the mismatch source through server construction, gRPC error conversion and the existing handler fallback. - Full online concurrent read/write + MQ switch e2e has not been run. 

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

### Incident Patch 1: `029df857` (2026-10-28)
**Commit Message**: fix: Recover from all transient etcd errors, not only leader changes (#54733)

issue: #54706
Related: #54707

### What

#54707 made `etcdserver: leader changed` recoverable for the proxy and
session watchers. That error is only one member of a family. With etcd
auth enabled, clientv3 authenticates before opening every watch stream.
`Authenticate` is a raft request that clientv3 does not retry, and its
failure is converted to an `rpctypes.EtcdError`, which
`openWatchClient`'s `isHaltErr` treats as fatal. The watch is then
canceled with whatever transient error the member returned. During an
etcd rolling restart that is just as likely to be `server stopped`, `no
leader` or `request timed out`.

The new `TestIsRetriableWatchErr_WatchCanceledByAuthFailure` injects
each error into `Authenticate` through a bufconn server and uses the
real clientv3. Every case cancels the watch. On master after #54707,
every error except leader changed is classified as non-retriable, so the
watcher panics:

| injected | watch canceled | `IsRetriableWatchErr` on master |
|---|---|---|
| leader changed | yes | true |
| no leader | yes | **false** |
| server stopped | yes | **false** |
| request timed out | 

**File**: `internal/cdc/controller/controller.go` (modified, +37/-4)
```diff
@@ -18,9 +18,11 @@ package controller
 
 import (
 	"context"
+	"fmt"
 	"path"
 	"strings"
 	"sync"
+	"time"
 
 	"go.etcd.io/etcd/api/v3/mvccpb"
 	clientv3 "go.etcd.io/etcd/client/v3"
@@ -29,9 +31,14 @@ import (
 	"github.com/milvus-io/milvus/internal/cdc/resource"
 	"github.com/milvus-io/milvus/internal/metastore/kv/streamingcoord"
 	"github.com/milvus-io/milvus/pkg/v3/mlog"
+	"github.com/milvus-io/milvus/pkg/v3/util/etcd"
 	"github.com/milvus-io/milvus/pkg/v3/util/paramtable"
 )
 
+// listRetryInterval is how long the controller waits before listing the
+// replicate pchannels again after a transient etcd error.
+const listRetryInterval = time.Second
+
 // Controller controls and schedules the CDC process.
 // It will periodically update the replications by the replicate configuration.
 type Controller interface {
@@ -103,10 +110,12 @@ func (c *controller) startWatchLoop() {
 	go func() {
 		defer c.wg.Done()
 		for {
-			m, err := meta.ListReplicatePChannels(c.ctx, resource.Resource().ETCD(), c.prefix)
-			if err != nil && c.ctx.Err() == nil {
-				mlog.Warn(c.ctx, "failed to list replicate pchannels", mlog.Err(err))
-				continue
+			m, err := c.listReplicatePChannels()
+			if err != nil {
+				if c.ctx.Err() != nil {
+					return
+				}
+				panic(fmt.Sprintf("failed to list replicate pchannels: %v", err))
 			}
 			c.recoverReplicatePChannelMeta(m.Channels)
 			eventCh := c.watchEvents(m.Revision + 1)
@@ -118,13 +127,37 @@ func (c *controller) startWatchLoop() {
 	}()
 }
 
+// listReplicatePChannels lists the replicate pchannels, retrying transient etcd
+// errors (e.g. leader changed while etcd restarts). Any other error, including
+// a request timeout, is returned.
+func (c *controller) listReplicatePChannels() (*meta.ReplicateChannels, error) {
+	for {
+		m, err := meta.ListReplicatePChannels(c.ctx, resource.Resource().ETCD(), c.prefix)
+		if err == nil {
+			return m, nil
+		}
+		if c.ctx.Err() != nil || !etcd.IsRetriableEtcdErr(err) {
+			return nil, err
+		}
+		mlog.Warn(c.ctx, "failed to list replicate pchannels, retry", mlog.Err(err))
+		select {
+		case <-time.After(listRetryInterval):
+		case <-c.ctx.Done():
+			return nil, c.ctx.Err()
+		}
+	}
+}
+
 func (c *controller) watchLoop(eventCh clientv3.WatchChan) error {
 	for {
 		select {
 		case <-c.ctx.Done():
 			return nil
 		case event, ok := <-eventCh:
 			if !ok {
+				if c.ctx.Err() != nil {
+					return nil
+				}
 				panic("etcd event channel closed")
 			}
 			if err := event.Err(); err != nil {
```

**File**: `internal/cdc/controller/controller_test.go` (modified, +109/-0)
```diff
@@ -17,12 +17,20 @@
 package controller
 
 import (
+	"context"
+	"net"
+	"sync/atomic"
 	"testing"
 	"time"
 
 	"github.com/stretchr/testify/mock"
+	"github.com/stretchr/testify/require"
+	"go.etcd.io/etcd/api/v3/etcdserverpb"
 	"go.etcd.io/etcd/api/v3/mvccpb"
+	"go.etcd.io/etcd/api/v3/v3rpc/rpctypes"
 	clientv3 "go.etcd.io/etcd/client/v3"
+	"google.golang.org/grpc"
+	"google.golang.org/grpc/test/bufconn"
 	"google.golang.org/protobuf/proto"
 
 	"github.com/milvus-io/milvus/internal/cdc/meta"
@@ -102,3 +110,104 @@ func TestController_StartAndStop_WithEvents(t *testing.T) {
 	}
 	ctrl.Stop()
 }
+
+// failingRangeServer fails the first failures Range calls with err.
+type failingRangeServer struct {
+	etcdserverpb.UnimplementedKVServer
+	failures int32
+	err      error
+	calls    atomic.Int32
+}
+
+func (s *failingRangeServer) Range(context.Context, *etcdserverpb.RangeRequest) (*etcdserverpb.RangeResponse, error) {
+	if s.calls.Add(1) <= s.failures {
+		return nil, s.err
+	}
+	return &etcdserverpb.RangeResponse{Header: &etcdserverpb.ResponseHeader{Revision: 10}}, nil
+}
+
+func newBufconnEtcdClient(t *testing.T, kv etcdserverpb.KVServer) *clientv3.Client {
+	listener := bufconn.Listen(1024 * 1024)
+	server := grpc.NewServer()
+	etcdserverpb.RegisterKVServer(server, kv)
+	go server.Serve(listener)
+	t.Cleanup(server.Stop)
+
+	cli, err := clientv3.New(clientv3.Config{
+		Endpoints:   []string{"http://etcd-controller"},
+		DialTimeout: time.Second,
+		// Surface server errors to the controller instead of retrying them
+		// inside clientv3.
+		MaxUnaryRetries: 1,
+		DialOptions: []grpc.DialOption{grpc.WithContextDialer(func(ctx context.Context, _ string) (net.Conn, error) {
+			return listener.DialContext(ctx)
+		})},
+	})
+	require.NoError(t, err)
+	t.Cleanup(func() { cli.Close() })
+	return cli
+}
+
+func TestController_ListRetriesTransientEtcdError(t *testing.T) {
+	// The leader change outlasts clientv3's own retry and reaches the controller.
+	kv := &failingRangeServer{failures: 3, err: rpctypes.ErrGRPCLeaderChanged}
+	resource.InitForTest(t, resource.OptETCD(newBufconnEtcdClient(t, kv)))
+
+	ctrl := NewController()
+	defer ctrl.cancel()
+	m, err := ctrl.listReplicatePChannels()
+	require.NoError(t, err)
+	require.EqualValues(t, 10, m.Revision)
+	require.EqualValues(t, 4, kv.calls.Load())
+}
+
+func TestController_ListAbortsOnNonTransientError(t *testing.T) {
+	kv := &failingRangeServer{failures: 1, err: rpctypes.ErrGRPCPermissionDenied}
+	resource.InitForTest(t, resource.OptETCD(newBufconnEtcdClient(t, kv)))
+
+	ctrl := NewController()
+	defer ctrl.cancel()
+	_, err := ctrl.listReplicatePChannels()
+	require.ErrorIs(t, err, rpctypes.ErrPermissionDenied)
+	require.EqualValues(t, 1, kv.calls.Load())
+}
+
+func TestController_ListWithCanceledContext(t *testing.T) {
+	kv := &failingRangeServer{}
+	manager := replication.NewMockReplicateManagerClient(t)
+	manager.EXPECT().Close().Return().Once()
+	resource.InitForTest(t,
+		resource.OptETCD(newBufconnEtcdClient(t, kv)),
+		resource.OptReplicateManagerClient(manager),
+	)
+
+	ctrl := NewController()
+	ctrl.cancel()
+	require.NoError(t, ctrl.Start())
+	ctrl.Stop()
+	require.Zero(t, kv.calls.Load())
+}
+
+func TestController_WatchLoopCanceled(t *testing.T) {
+	ctx, cancel := context.WithCancel(context.Background())
+	events := make(chan clientv3.WatchResponse)
+	ctrl := &controller{ctx: ctx}
+	// clientv3 closes the watch channel after cancellation. Both select cases
+	// can be ready before the controller resumes.
+	cancel()
+	close(events)
+	for range 128 {
+		require.NotPanics(t, func() {
+			require.NoError(t, ctrl.watchLoop(events))
+		})
+	}
+}
+
+func TestController_WatchLoopUnexpectedClose(t *testing.T) {
+	ctrl := &controller{ctx: context.Background()}
+	events := make(chan clientv3.WatchResponse)
+	close(events)
+	require.PanicsWithValue(t, "etcd event channel closed", func() {
+		ctrl.watchLoop(events)
+	})
+}
```

**File**: `internal/cdc/replication/replicatestream/replicate_stream_client_impl.go` (modified, +13/-2)
```diff
@@ -36,7 +36,9 @@ import (
 	"github.com/milvus-io/milvus/internal/util/streamingutil/service/contextutil"
 	"github.com/milvus-io/milvus/pkg/v3/mlog"
 	"github.com/milvus-io/milvus/pkg/v3/streaming/util/message"
+	"github.com/milvus-io/milvus/pkg/v3/util/etcd"
 	"github.com/milvus-io/milvus/pkg/v3/util/paramtable"
+	"github.com/milvus-io/milvus/pkg/v3/util/retry"
 )
 
 var ErrReplicationRemoved = errors.New("replication removed")
@@ -359,15 +361,24 @@ func (r *replicateStreamClient) handleAlterReplicateConfigMessage(msg message.Im
 		// Cannot find the target channel, it means that the `current->target` topology edge is removed,
 		// so we need to remove the replicate pchannel and stop replicate.
 		etcdCli := resource.Resource().ETCD()
-		ok, err := meta.RemoveReplicatePChannelWithRevision(r.ctx, etcdCli, r.channel.Key, r.channel.ModRevision)
+		// Retry transient etcd errors (e.g. leader changed during an etcd restart).
+		// The delete is guarded by the channel's revision, so retrying after an
+		// attempt that was applied despite the error just finds the revision
+		// changed; the replication is removed either way.
+		var ok bool
+		err := retry.Do(r.ctx, func() error {
+			var err error
+			ok, err = meta.RemoveReplicatePChannelWithRevision(r.ctx, etcdCli, r.channel.Key, r.channel.ModRevision)
+			return err
+		}, retry.Attempts(0), retry.RetryErr(etcd.IsRetriableEtcdErr))
 		if err != nil {
 			logger.Warn(r.ctx, "failed to remove replicate pchannel", mlog.Err(err))
 			// When performing delete operation on etcd, the context may be canceled by the delete event
 			// in cdc controller and then return `context.Canceled` error.
 			// Since the delete event is generated after the delete operation is committed in etcd,
 			// the delete is guaranteed to have succeeded on the server side.
 			// So we can ignore the context canceled error here.
-			if !errors.Is(err, context.Canceled) {
+			if !errors.Is(err, context.Canceled) && r.ctx.Err() == nil {
 				panic(fmt.Sprintf("failed to remove replicate pchannel: %v", err))
 			}
 		}
```

**File**: `internal/kv/etcd/embed_etcd_error_test.go` (added, +75/-0)
```diff
@@ -0,0 +1,75 @@
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
+package etcdkv
+
+import (
+	"context"
+	"testing"
+	"time"
+
+	"github.com/stretchr/testify/require"
+	"go.etcd.io/etcd/api/v3/v3rpc/rpctypes"
+	clientv3 "go.etcd.io/etcd/client/v3"
+
+	"github.com/milvus-io/milvus/pkg/v3/util/etcd"
+	"github.com/milvus-io/milvus/pkg/v3/util/merr"
+)
+
+type failedEmbeddedTxnKV struct {
+	clientv3.KV
+	err error
+}
+
+func (kv failedEmbeddedTxnKV) Txn(context.Context) clientv3.Txn {
+	return failedEmbeddedTxn{err: kv.err}
+}
+
+type failedEmbeddedTxn struct {
+	err error
+}
+
+func (t failedEmbeddedTxn) If(...clientv3.Cmp) clientv3.Txn  { return t }
+func (t failedEmbeddedTxn) Then(...clientv3.Op) clientv3.Txn { return t }
+func (t failedEmbeddedTxn) Else(...clientv3.Op) clientv3.Txn { return t }
+func (t failedEmbeddedTxn) Commit() (*clientv3.TxnResponse, error) {
+	return nil, t.err
+}
+
+func TestEmbedEtcdKVMultiSavePreservesEtcdCause(t *testing.T) {
+	for _, tc := range []struct {
+		cause     error
+		retriable bool
+	}{
+		{rpctypes.ErrLeaderChanged, true},
+		{rpctypes.ErrPermissionDenied, false},
+		{context.Canceled, false},
+		{context.DeadlineExceeded, false},
+	} {
+		t.Run(tc.cause.Error(), func(t *testing.T) {
+			kv := &EmbedEtcdKV{
+				client:         &clientv3.Client{KV: failedEmbeddedTxnKV{err: tc.cause}},
+				rootPath:       "test",
+				requestTimeout: time.Second,
+			}
+			err := kv.MultiSave(context.Background(), map[string]string{"rg": "value"})
+			require.ErrorIs(t, err, tc.cause)
+			require.ErrorIs(t, err, merr.ErrIoFailed)
+			require.EqualValues(t, 1001, merr.Code(err))
+			require.Equal(t, tc.retriable, etcd.IsRetriableEtcdErr(err))
+		})
+	}
+}
```

**File**: `internal/kv/etcd/embed_etcd_kv.go` (modified, +2/-1)
```diff
@@ -415,7 +415,8 @@ func (kv *EmbedEtcdKV) MultiSave(ctx context.Context, kvs map[string]string) err
 
 	_, err := kv.client.Txn(ctx1).If().Then(ops...).Commit()
 	if err != nil {
-		return merr.WrapErrIoFailedReason("failed to execute transaction", err.Error())
+		// Preserve the same IO contract and driver cause as external etcd.
+		return merr.WrapErrIoFailedErr(err, "failed to execute transaction")
 	}
 	return nil
 }
```

**File**: `internal/kv/etcd/etcd_kv.go` (modified, +3/-1)
```diff
@@ -810,7 +810,9 @@ func (kv *etcdKV) executeTxn(txn clientv3.Txn, ops ...clientv3.Op) (*clientv3.Tx
 	}
 
 	if err != nil {
-		err = merr.WrapErrIoFailedReason("execute etcd txn failed", err.Error())
+		// Keep the existing IO classification at this boundary, but retain the
+		// driver cause so callers can distinguish transient etcd errors.
+		err = merr.WrapErrIoFailedErr(err, "execute etcd txn failed")
 	}
 	return resp, err
 }
```

**File**: `internal/metastore/kv/querycoord/etcd_retry_test.go` (added, +148/-0)
```diff
@@ -0,0 +1,148 @@
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
+package querycoord
+
+import (
+	"context"
+	"net"
+	"sync/atomic"
+	"testing"
+	"time"
+
+	"github.com/stretchr/testify/require"
+	"go.etcd.io/etcd/api/v3/etcdserverpb"
+	"go.etcd.io/etcd/api/v3/v3rpc/rpctypes"
+	clientv3 "go.etcd.io/etcd/client/v3"
+	"google.golang.org/grpc"
+	"google.golang.org/grpc/test/bufconn"
+
+	etcdkv "github.com/milvus-io/milvus/internal/kv/etcd"
+	"github.com/milvus-io/milvus/pkg/v3/proto/querypb"
+	"github.com/milvus-io/milvus/pkg/v3/util/etcd"
+	"github.com/milvus-io/milvus/pkg/v3/util/merr"
+	"github.com/milvus-io/milvus/pkg/v3/util/paramtable"
+	"github.com/milvus-io/milvus/pkg/v3/util/retry"
+)
+
+type resourceGroupTxnServer struct {
+	etcdserverpb.UnimplementedKVServer
+	txn func(context.Context, *etcdserverpb.TxnRequest) (*etcdserverpb.TxnResponse, error)
+}
+
+func (s *resourceGroupTxnServer) Txn(ctx context.Context, req *etcdserverpb.TxnRequest) (*etcdserverpb.TxnResponse, error) {
+	return s.txn(ctx, req)
+}
+
+func newResourceGroupTxnClient(t *testing.T, service *resourceGroupTxnServer) *clientv3.Client {
+	t.Helper()
+	listener := bufconn.Listen(1024 * 1024)
+	t.Cleanup(func() { listener.Close() })
+	server := grpc.NewServer()
+	etcdserverpb.RegisterKVServer(server, service)
+	go server.Serve(listener)
+	t.Cleanup(server.Stop)
+	cli, err := clientv3.New(clientv3.Config{
+		Endpoints:   []string{"http://resource-group-etcd"},
+		DialTimeout: time.Second,
+		DialOptions: []grpc.DialOption{grpc.WithContextDialer(func(ctx context.Context, _ string) (net.Conn, error) {
+			return listener.DialContext(ctx)
+		})},
+	})
+	require.NoError(t, err)
+	t.Cleanup(func() { cli.Close() })
+	return cli
+}
+
+// Exercise the actual catalog and etcdKV layers: mocking SaveResourceGroup to
+// return an etcd sentinel misses errors that get stringified below the catalog.
+func TestCatalogSaveResourceGroupRetriesEtcdErrors(t *testing.T) {
+	paramtable.Init()
+	for _, tc := range []struct {
+		name      string
+		rpcErr    error
+		cause     error
+		retriable bool
+	}{
+		{"leader changed", rpctypes.ErrGRPCLeaderChanged, rpctypes.ErrLeaderChanged, true},
+		{"server stopped", rpctypes.ErrGRPCStopped, rpctypes.ErrStopped, true},
+		{"permission denied", rpctypes.ErrGRPCPermissionDenied, rpctypes.ErrPermissionDenied, false},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
+			defer cancel()
+			var rpcCalls atomic.Int32
+			requests := make(chan *etcdserverpb.TxnRequest, 3)
+			cli := newResourceGroupTxnClient(t, &resourceGroupTxnServer{
+				txn: func(_ context.Context, req *etcdserverpb.TxnRequest) (*etcdserverpb.TxnResponse, error) {
+					requests <- req
+					if rpcCalls.Add(1) == 1 {
+						return nil, tc.rpcErr
+					}
+					return &etcdserverpb.TxnResponse{
+						Header: &etcdserverpb.ResponseHeader{Revision: 2}, Succeeded: true,
+					}, nil
+				},
+			})
+			catalog := NewCatalog(etcdkv.NewEtcdKV(cli, "test"))
+			rg := &querypb.ResourceGroup{Name: "rg", Nodes: []int64{101}}
+			var firstErr error
+			var attempts int
+			err := retry.Do(ctx, func() error {
+				attempts++
+				err := catalog.SaveResourceGroup(ctx, rg)
+				if attempts == 1 {
+					firstErr = err
+				}
+				return err
+			}, retry.Attempts(3), retry.Sleep(time.Millisecond), retry.RetryErr(etcd.IsRetriableEtcdErr))
+			require.ErrorIs(t, firstErr, tc.cause)
+			var etcdErr rpctypes.EtcdError
+			require.ErrorAs(t, firstErr, &etcdErr)
+			require.Equal(t, merr.Code(merr.ErrIoFailed), merr.Code(firstErr))
+			require.Equal(t, tc.retriable, etcd.IsRetriableEtcdErr(firstErr))
+			if tc.retriable {
+				require.NoError(t, err)
+				require.Equal(t, 2, attempts)
+				require.EqualValues(t, 2, rpcCalls.Load())
+				first, second := <-requests, <-requests
+				require.Equal(t, first, second, "retry must persist the same resource group")
+			} else {
+				require.ErrorIs(t, err, tc.cause)
+				require.Equal(t, 1, attempts)
+				require.EqualValues(t, 1, rpcCalls.Load())
+			}
+		})
+	}
+}
+
+func TestCatalogSaveResourceGroupPreservesRequestDeadline(t *testing.T) {
+	paramtable.Init()
+	ctx, cancel := context.WithTimeout(context.Background(), 5
```

**File**: `internal/querycoordv2/meta/resource_manager.go` (modified, +11/-1)
```diff
@@ -35,9 +35,11 @@ import (
 	"github.com/milvus-io/milvus/pkg/v3/metrics"
 	"github.com/milvus-io/milvus/pkg/v3/mlog"
 	"github.com/milvus-io/milvus/pkg/v3/proto/querypb"
+	"github.com/milvus-io/milvus/pkg/v3/util/etcd"
 	"github.com/milvus-io/milvus/pkg/v3/util/merr"
 	"github.com/milvus-io/milvus/pkg/v3/util/metricsinfo"
 	"github.com/milvus-io/milvus/pkg/v3/util/paramtable"
+	"github.com/milvus-io/milvus/pkg/v3/util/retry"
 	"github.com/milvus-io/milvus/pkg/v3/util/syncutil"
 	"github.com/milvus-io/milvus/pkg/v3/util/typeutil"
 )
@@ -1095,7 +1097,15 @@ func (rm *ResourceManager) unassignNode(ctx context.Context, node int64) (string
 		mrg.UnassignNode(node)
 		rg := mrg.ToResourceGroup()
 
-		if err := rm.catalog.SaveResourceGroup(ctx, rg.GetMeta()); err != nil {
+		// Saving the whole resource group is an unconditional overwrite, so it is
+		// safe to retry a transient etcd error (e.g. leader changed during an etcd
+		// restart) even if the failed attempt was applied. The retry is bounded
+		// because rm.rwmutex is held; a persistent failure still exits to reload
+		// a consistent state.
+		err := retry.Do(ctx, func() error {
+			return rm.catalog.SaveResourceGroup(ctx, rg.GetMeta())
+		}, retry.RetryErr(etcd.IsRetriableEtcdErr))
+		if err != nil {
 			mlog.Fatal(context.TODO(), "unassign node from resource group",
 				mlog.String("rgName", rg.GetName()),
 				mlog.Int64("node", node),
```

---

### Incident Patch 2: `3f4f04d3` (2026-10-28)
**Commit Message**: fix: authenticate GCS requests with the registered GCP credential provider (#54760)

issue: #54759

### What

With `minio.useIAM=true` on GCP, Milvus installs
`GoogleHttpClientFactory` as the process-wide AWS SDK HTTP factory (only
the first `Aws::InitAPI` in a process takes effect), so it also serves
milvus-storage (StorageV2 / StorageV3). It fetched a token from its own
`ComputeEngineCredentials` for every request and threw when the fetch
failed. Since the google-cloud-cpp 2.28 upgrade
`ComputeEngineCredentials` no longer caches tokens, so every S3 request
became a GKE metadata server request. Under load the metadata server
throttles, and the exception — raised inside the AWS SDK, which is built
with `-fno-exceptions` — ended the process in `std::terminate`.

### Changes
(`internal/core/src/storage/minio/MinioChunkManager.{h,cpp}`)

1. **Authenticate with milvus-storage's GCP credential providers**,
which cache the token (google-cloud-cpp `CachedCredentials`, the same
stack milvus-storage uses). Milvus no longer builds its own
`ComputeEngineCredentials`.
- Milvus' own bucket uses the IAM provider built in
`BuildGoogleCloudClient`, kept per (endpoint, bucket) and reused by
later c

**File**: `internal/core/src/storage/minio/MinioChunkManager.cpp` (modified, +190/-26)
```diff
@@ -18,6 +18,7 @@
 #include "storage/minio/GuardedS3EndpointProvider.h"
 
 #include <aws/core/auth/AWSCredentials.h>
+#include <aws/core/auth/AWSCredentialsProvider.h>
 #include <aws/s3/model/CreateBucketRequest.h>
 #include <aws/s3/model/DeleteBucketRequest.h>
 #include <aws/s3/model/DeleteObjectRequest.h>
@@ -29,10 +30,16 @@
 #include <string.h>
 #include <unistd.h>
 #include <algorithm>
+#include <cctype>
 #include <chrono>
 #include <exception>
 #include <functional>
+#include <mutex>
+#include <optional>
+#include <set>
 #include <sstream>
+#include <unordered_map>
+#include <utility>
 
 #include "aws/core/Aws.h"
 #include "aws/core/auth/signer/AWSAuthV4Signer.h"
@@ -49,9 +56,6 @@
 #include "common/Consts.h"
 #include "common/EasyAssert.h"
 #include "fmt/core.h"
-#include "google/cloud/internal/rest_client.h"
-#include "google/cloud/storage/oauth2/compute_engine_credentials.h"
-#include "google/cloud/version.h"
 #include "log/Log.h"
 #include "milvus-storage/common/extend_status.h"
 #include "milvus-storage/filesystem/gcp/gcp_credential_registry.h"
@@ -69,22 +73,156 @@ namespace milvus::storage {
 std::atomic<size_t> MinioChunkManager::init_count_(0);
 std::mutex MinioChunkManager::client_mutex_;
 
+namespace {
+
+std::mutex&
+GcsEndpointsMutex() {
+    static std::mutex mutex;
+    return mutex;
+}
+
+std::set<std::string>&
+GcsEndpointHosts() {
+    static std::set<std::string> hosts;
+    return hosts;
+}
+
+// The IAM providers of the GCS buckets Milvus itself is configured with,
+// guarded by GcsEndpointsMutex(). milvus-storage replaces its registry entry
+// for a bucket whenever it opens a filesystem there, possibly with another
+// identity (an external table on the same bucket), so Milvus' own requests do
+// not use the registry entry. Reusing the provider also keeps its cached token.
+using GcpProviderMap =
+    std::unordered_map<milvus_storage::GcpBucketKey,
+                       std::shared_ptr<milvus_storage::GcpCredentialProvider>,
+                       milvus_storage::GcpBucketKeyHash>;
+
+GcpProviderMap&
+MilvusGcpProviders() {
+    static GcpProviderMap providers;
+    return providers;
+}
+
+std::string
+ToLower(std::string s) {
+    std::transform(s.begin(), s.end(), s.begin(), [](unsigned char c) {
+        return std::tolower(c);
+    });
+    return s;
+}
+
+// Matches a request like GcpCredentialRegistry::Lookup: path-style
+// (<endpoint>/<bucket>/<key>), then virtual-host style (<bucket>.<endpoint>).
+std::shared_ptr<milvus_storage::GcpCredentialProvider>
+LookupMilvusGcpProvider(const Aws::Http::URI& uri) {
+    milvus_storage::GcpEndpointKey endpoint{
+        uri.GetScheme(), uri.GetPort(), ToLower(uri.GetAuthority().c_str())};
+    std::string path = uri.GetPath().c_str();
+    size_t start = (!path.empty() && path.front() == '/') ? 1 : 0;
+    std::string bucket = path.substr(start, path.find('/', start) - start);
+
+    std::lock_guard<std::mutex> lock(GcsEndpointsMutex());
+    const auto& providers = MilvusGcpProviders();
+    if (!bucket.empty()) {
+        auto it = providers.find({endpoint, bucket});
+        if (it != providers.end()) {
+            return it->second;
+        }
+    }
+    auto dot = endpoint.host.find('.');
+    if (dot != std::string::npos && dot > 0) {
+        bucket = endpoint.host.substr(0, dot);
+        endpoint.host.erase(0, dot + 1);
+        auto it = providers.find({endpoint, bucket});
+        if (it != providers.end()) {
+            return it->second;
+        }
+    }
+    return nullptr;
+}
+
+// Whether a request to `host` may carry GCP credentials: Google's own
+// endpoints, and the GCS endpoints Milvus is configured with, also in
+// virtual-host form (<bucket>.<endpoint>).
+bool
+IsGcsHostForCredentials(std::string host) {
+    host = ToLower(std::move(host));
+    const std::string google_suffix = ".googleapis.com";
+    if (host.size() > google_suffix.size() &&
+        host.compare(host.size() - google_suffix.size(),
+                     google_suffix.size(),
+                     google_suffix) == 0) {
+        return true;
+    }
+    std::lock_guard<std::mutex> lock(GcsEndpointsMutex());
+    const auto& hosts = GcsEndpointHosts();
+    if (hosts.count(host) > 0) {
+        return true;
+    }
+    auto dot = host.find('.');
+    return dot != std::string::npos && hosts.count(host.substr(dot + 1)) > 0;
+}
+
+}  // namespace
+
+void
+AddGcsEndpointForCredentials(const std::string& address, bool use_ssl) {
+    auto endpoint = milvus_storage::NormalizeGcpEndpoint(address, use_ssl);
+    std::lock_guard<std::mutex> lock(GcsEndpointsMutex());
+    GcsEndpointHosts().insert(endpoint.host);
+}
+
 void
 ConfigureGoogleCloudIAMHttpClientFactory(Aws::SDKOptions& sdk_options) {
     sdk_options.httpOptions.httpClientFactory_create_fn = []() {
-        auto credentials =
-            std::make_shared<google::cloud::oauth2_internal::
-                                 GOOGLE_CLOUD_CPP_NS::ComputeEngineCredentials>(
-         
```

**File**: `internal/core/src/storage/minio/MinioChunkManager.h` (modified, +16/-35)
```diff
@@ -455,20 +455,22 @@ class TlsHttpClientFactory : public Aws::Http::HttpClientFactory {
 static const char* GOOGLE_CLIENT_FACTORY_ALLOCATION_TAG =
     "GoogleHttpClientFactory";
 
+// Records a GCS endpoint that Milvus itself is configured to use.
+// GoogleHttpClientFactory sends GCP credentials only to these endpoints and to
+// Google's *.googleapis.com.
+void
+AddGcsEndpointForCredentials(const std::string& address, bool use_ssl);
+
+// Process-wide AWS SDK HTTP factory for GCP IAM. Only the first Aws::InitAPI
+// in a process takes effect, so it also serves milvus-storage. It
+// authenticates a request for Milvus' own GCS bucket with Milvus' IAM
+// provider, and any other GCS request with the provider milvus-storage's
+// GcpCredentialRegistry holds for its endpoint and bucket, as milvus-storage's
+// own GCP factory does. Every other request is left alone.
 class GoogleHttpClientFactory : public Aws::Http::HttpClientFactory {
  public:
-    explicit GoogleHttpClientFactory(
-        std::shared_ptr<google::cloud::oauth2_internal::Credentials>
-            credentials,
-        const std::string& tls_min_version = "")
+    explicit GoogleHttpClientFactory(const std::string& tls_min_version = "")
         : tls_min_version_(tls_min_version) {
-        credentials_ = credentials;
-    }
-
-    void
-    SetCredentials(std::shared_ptr<google::cloud::oauth2_internal::Credentials>
-                       credentials) {
-        credentials_ = credentials;
     }
 
     std::shared_ptr<Aws::Http::HttpClient>
@@ -493,32 +495,11 @@ class GoogleHttpClientFactory : public Aws::Http::HttpClientFactory {
     }
 
     std::shared_ptr<Aws::Http::HttpRequest>
-    CreateHttpRequest(
-        const Aws::Http::URI& uri,
-        Aws::Http::HttpMethod method,
-        const Aws::IOStreamFactory& streamFactory) const override {
-        auto request =
-            Aws::MakeShared<Aws::Http::Standard::StandardHttpRequest>(
-                GOOGLE_CLIENT_FACTORY_ALLOCATION_TAG, uri, method);
-        request->SetResponseStreamFactory(streamFactory);
-        auto auth_header =
-            google::cloud::oauth2_internal::AuthorizationHeader(*credentials_);
-        if (!auth_header.ok()) {
-            ThrowInfo(IsRetryableGcpStatus(auth_header.status().code())
-                          ? ErrorCode::S3Error
-                          : ErrorCode::UnexpectedError,
-                      fmt::format("get authorization failed, errcode: {}",
-                                  google::cloud::StatusCodeToString(
-                                      auth_header.status().code())));
-        }
-        request->SetHeaderValue(auth_header->first.c_str(),
-                                auth_header->second.c_str());
-
-        return request;
-    }
+    CreateHttpRequest(const Aws::Http::URI& uri,
+                      Aws::Http::HttpMethod method,
+                      const Aws::IOStreamFactory& streamFactory) const override;
 
  private:
-    std::shared_ptr<google::cloud::oauth2_internal::Credentials> credentials_;
     std::string tls_min_version_;
 };
 
```

**File**: `internal/core/unittest/test_gcp_chunk_manager.cpp` (modified, +259/-0)
```diff
@@ -20,7 +20,14 @@
 #include <aws/core/http/standard/StandardHttpRequest.h>
 #include <cstdio>
 #include <cstdlib>
+#include <memory>
+#include <optional>
 #include <sstream>
+#include <stdexcept>
+#include <string>
+#include <utility>
+
+#include <arrow/status.h>
 
 #include "milvus-storage/filesystem/gcp/gcp_credential_registry.h"
 #include "milvus-storage/filesystem/gcp/gcp_filesystem_producer.h"
@@ -150,8 +157,249 @@ CheckGcpRegistration(const bool legacy_first, const bool use_iam) {
     }
 }
 
+class FakeGcpCredentialProvider : public milvus_storage::GcpCredentialProvider {
+ public:
+    enum class Mode { kToken, kNoToken, kEmptyHeader, kThrow };
+
+    explicit FakeGcpCredentialProvider(Mode mode) : mode_(mode) {
+    }
+
+    std::optional<std::pair<std::string, std::string>>
+    AuthorizationHeader() override {
+        ++calls_;
+        switch (mode_) {
+            case Mode::kToken:
+                return std::make_pair(std::string("Authorization"),
+                                      std::string("Bearer fake-token"));
+            case Mode::kNoToken:
+                return std::nullopt;
+            case Mode::kEmptyHeader:
+                return std::make_pair(std::string(), std::string());
+            case Mode::kThrow:
+                throw std::runtime_error("malformed token response");
+        }
+        return std::nullopt;
+    }
+
+    arrow::Status
+    MaybeSignConditionalWrite(
+        const std::shared_ptr<Aws::Http::HttpRequest>&) override {
+        return arrow::Status::OK();
+    }
+
+    int
+    calls() const {
+        return calls_;
+    }
+
+ private:
+    Mode mode_;
+    int calls_ = 0;
+};
+
+// Registers a provider for a bucket on `endpoint`, as milvus-storage does for
+// every filesystem it opens.
+static std::shared_ptr<FakeGcpCredentialProvider>
+RegisterFakeProvider(const std::string& endpoint,
+                     const std::string& bucket,
+                     FakeGcpCredentialProvider::Mode mode) {
+    auto provider = std::make_shared<FakeGcpCredentialProvider>(mode);
+    milvus_storage::GcpCredentialRegistry::Instance().Register(
+        {milvus_storage::NormalizeGcpEndpoint(endpoint, true), bucket},
+        provider);
+    return provider;
+}
+
+// Registers a provider the way MinioChunkManager::BuildGoogleCloudClient does
+// for the GCS endpoint Milvus is configured with.
+static std::shared_ptr<FakeGcpCredentialProvider>
+RegisterMilvusProvider(const std::string& bucket,
+                       FakeGcpCredentialProvider::Mode mode) {
+    AddGcsEndpointForCredentials("gcs-factory-test.invalid", true);
+    return RegisterFakeProvider("gcs-factory-test.invalid", bucket, mode);
+}
+
+static std::shared_ptr<Aws::Http::HttpRequest>
+CreateGoogleRequest(const std::string& uri) {
+    GoogleHttpClientFactory factory;
+    return factory.CreateHttpRequest(
+        Aws::Http::URI(uri.c_str()),
+        Aws::Http::HttpMethod::HTTP_GET,
+        Aws::Utils::Stream::DefaultResponseStreamFactoryMethod);
+}
+
+static void
+CheckMilvusBucketKeepsItsProvider() {
+    setenv("AWS_EC2_METADATA_DISABLED", "true", 1);
+    setenv("AWS_CONFIG_FILE", "/dev/null", 1);
+    setenv("AWS_SHARED_CREDENTIALS_FILE", "/dev/null", 1);
+    // Milvus' own IAM provider asks the metadata server for a token; point it
+    // at a closed port so the fetch fails at once instead of reaching GCP.
+    setenv("GCE_METADATA_ROOT", "127.0.0.1:1", 1);
+    unsetenv("GOOGLE_APPLICATION_CREDENTIALS");
+    setenv("GOOGLE_GCLOUD_ADC_PATH_OVERRIDE", "/nonexistent/adc.json", 1);
+
+    MinioChunkManager manager;
+    manager.InitSDKAPI(RemoteStorageType::GOOGLE_CLOUD, true, "off");
+
+    StorageConfig storage_config;
+    storage_config.address = "storage.googleapis.com:443";
+    storage_config.bucket_name = "milvus-own-bucket";
+    storage_config.cloud_provider = "gcp";
+    storage_config.useSSL = true;
+    storage_config.useIAM = true;
+    Aws::Client::ClientConfiguration client_config;
+    client_config.region = "europe-west3";
+    client_config.endpointOverride = "storage.googleapis.com:443";
+    manager.BuildGoogleCloudClient(storage_config, client_config);
+
+    auto& registry = milvus_storage::GcpCredentialRegistry::Instance();
+    const Aws::Http::URI own_uri(
+        "https://storage.googleapis.com/milvus-own-bucket/key");
+    const auto milvus_provider = registry.Lookup(own_uri);
+    ASSERT_NE(milvus_provider, nullptr);
+
+    // milvus-storage registers another identity for the same bucket, as for
+    // an external table on it. Milvus' own requests keep Milvus' provider.
+    const milvus_storage::GcpBucketKey own_key{
+        milvus_storage::NormalizeGcpEndpoint(storage_config.address, true),
+        storage_config.bucket_name};
+    auto replacement = std::make_shared<FakeGcpCredentialProvider>(
+        FakeGcpCredentialProvider::Mode::kToken);
+    registry.Register(own_key, replacement);
+    for (const auto* uri :
+         {"https://storage.google
```

---

### Incident Patch 3: `6a779486` (2026-10-28)
**Commit Message**: fix: return WALNameMismatch synchronously during remote consumer creation (#54764)

Fixes #54762

When a remote consumer reconnects with a position from the previous WAL
backend, the VChannel handshake reports `WALNameMismatch` after the
constructor has already returned. The handler client's existing
`DeliverPolicyAll` fallback therefore cannot catch the error.

Complete the VChannel handshake before returning the consumer and
starting its receive loop. Each creation attempt owns a child context,
so failures release its stream while preserving the parent context and
upper message handler for retry. Validate both successful and
embedded-error handshake responses.

Add gRPC regressions using the production server/client error
interceptors, with fault-injection coverage for handshake failures and
cancellation. Historical WAL catch-up and handler-level
catch-up/All-handoff coverage are in #54778 (issue #54763), which must
merge after this PR. The two PRs have no overlapping changed files.

### Validation

- Confirmed the gRPC mismatch regression fails on unmodified master and
passes with this change.
- Passed consumer, streaming status and streaming service interceptor
tests with `-tag

**File**: `internal/streamingnode/client/handler/consumer/consumer_impl.go` (modified, +30/-6)
```diff
@@ -45,6 +45,13 @@ func CreateConsumer(
 	opts *ConsumerOptions,
 	handlerClient streamingpb.StreamingNodeHandlerServiceClient,
 ) (Consumer, error) {
+	ctx, cancel := context.WithCancel(ctx)
+	created := false
+	defer func() {
+		if !created {
+			cancel()
+		}
+	}()
 	ctx = contextutil.WithCreateConsumer(ctx, &streamingpb.CreateConsumerRequest{
 		Pchannel: types.NewProtoFromPChannelInfo(opts.Assignment.Channel),
 	})
@@ -69,6 +76,7 @@ func CreateConsumer(
 	}
 	cli := &consumerImpl{
 		ctx:              ctx,
+		cancel:           cancel,
 		walName:          createResp.GetWalName(),
 		opts:             opts,
 		grpcStreamClient: streamClient,
@@ -77,16 +85,26 @@ func CreateConsumer(
 			mlog.String("walName", createResp.GetWalName()),
 			mlog.String("pchannel", opts.Assignment.Channel.Name),
 			mlog.Int64("term", opts.Assignment.Channel.Term),
-			mlog.Int64("streamingNodeID", opts.Assignment.Node.ServerID)),
+			mlog.Int64("streamingNodeID", opts.Assignment.Node.ServerID),
+		),
 		msgHandler: opts.MessageHandler,
 		finishErr:  syncutil.NewFuture[error](),
 	}
+	if err := cli.createVChannelConsumer(); err != nil {
+		// No receiver owns finishErr yet. Cancel only this attempt and leave
+		// the upper message handler available for a retry.
+		cancel()
+		_ = streamClient.CloseSend()
+		return nil, err
+	}
+	created = true
 	go cli.execute()
 	return cli, nil
 }
 
 type consumerImpl struct {
-	ctx              context.Context // TODO: the cancel method of consumer should be managed by consumerImpl, fix it in future.
+	ctx              context.Context
+	cancel           context.CancelFunc
 	walName          string
 	opts             *ConsumerOptions
 	grpcStreamClient streamingpb.StreamingNodeHandlerService_ConsumeClient
@@ -147,12 +165,10 @@ func (c *consumerImpl) recvLoop() (err error) {
 		} else {
 			c.logger.Info(c.ctx, "recv arm of stream closed")
 		}
+		c.cancel()
 		c.finishErr.Set(err)
 		c.msgHandler.Close()
 	}()
-	if err := c.createVChannelConsumer(); err != nil {
-		return err
-	}
 	for {
 		resp, err := c.grpcStreamClient.Recv()
 		if errors.Is(err, io.EOF) {
@@ -221,7 +237,15 @@ func (c *consumerImpl) createVChannelConsumer() error {
 	if createVChannelResp == nil {
 		return status.NewInvalidRequestSeq("expect create vchannel response")
 	}
-	return nil
+	switch response := createVChannelResp.GetResponse().(type) {
+	case *streamingpb.CreateVChannelConsumerResponse_ConsumerId:
+		return nil
+	case *streamingpb.CreateVChannelConsumerResponse_Error:
+		if response.Error != nil {
+			return (*status.StreamingError)(response.Error)
+		}
+	}
+	return status.NewInvalidRequestSeq("expect successful create vchannel response")
 }
 
 func (c *consumerImpl) handleTxnMessage(ctx context.Context, msg message.ImmutableMessage) error {
```

**File**: `internal/streamingnode/client/handler/consumer/handshake_test.go` (added, +211/-0)
```diff
@@ -0,0 +1,211 @@
+package consumer
+
+import (
+	"context"
+	"io"
+	"net"
+	"sync/atomic"
+	"testing"
+	"time"
+
+	"github.com/cockroachdb/errors"
+	"github.com/stretchr/testify/mock"
+	"github.com/stretchr/testify/require"
+	"google.golang.org/grpc"
+	"google.golang.org/grpc/credentials/insecure"
+	"google.golang.org/grpc/test/bufconn"
+
+	serviceinterceptor "github.com/milvus-io/milvus/internal/util/streamingutil/service/interceptor"
+	"github.com/milvus-io/milvus/internal/util/streamingutil/status"
+	"github.com/milvus-io/milvus/pkg/v3/mocks/proto/mock_streamingpb"
+	"github.com/milvus-io/milvus/pkg/v3/proto/streamingpb"
+	"github.com/milvus-io/milvus/pkg/v3/streaming/util/message"
+	"github.com/milvus-io/milvus/pkg/v3/streaming/util/options"
+	"github.com/milvus-io/milvus/pkg/v3/streaming/util/types"
+	"github.com/milvus-io/milvus/pkg/v3/streaming/walimpls/impls/walimplstest"
+)
+
+type handshakeHandler struct{ closed atomic.Int32 }
+
+func (h *handshakeHandler) Handle(message.HandleParam) message.HandleResult {
+	return message.HandleResult{MessageHandled: true}
+}
+func (h *handshakeHandler) Close() { h.closed.Add(1) }
+func handshakeOptions(h message.Handler) *ConsumerOptions {
+	return &ConsumerOptions{
+		Assignment: &types.PChannelInfoAssigned{Channel: types.PChannelInfo{Name: "p", Term: 1}},
+		VChannel:   "v1", DeliverPolicy: options.DeliverPolicyStartFrom(walimplstest.NewTestMessageID(1)), MessageHandler: h,
+	}
+}
+
+func firstHandshakeResponse() *streamingpb.ConsumeResponse {
+	return &streamingpb.ConsumeResponse{Response: &streamingpb.ConsumeResponse_Create{Create: &streamingpb.CreateConsumerResponse{WalName: "woodpecker"}}}
+}
+
+func successfulHandshakeResponse() *streamingpb.ConsumeResponse {
+	return &streamingpb.ConsumeResponse{Response: &streamingpb.ConsumeResponse_CreateVchannel{CreateVchannel: &streamingpb.CreateVChannelConsumerResponse{Response: &streamingpb.CreateVChannelConsumerResponse_ConsumerId{ConsumerId: 1}}}}
+}
+
+func TestConsumerFailedHandshakeCancelsOnlyItsStream(t *testing.T) {
+	expected := status.NewWALNameMismatchError("woodpecker", "test")
+	for _, stage := range []string{"open", "first-recv", "first-response", "second-send", "second-recv", "embedded-error", "second-response", "empty-second-response", "nil-embedded-error"} {
+		t.Run(stage, func(t *testing.T) {
+			parent, cancel := context.WithCancel(t.Context())
+			defer cancel()
+			h := &handshakeHandler{}
+			client := mock_streamingpb.NewMockStreamingNodeHandlerServiceClient(t)
+			stream := mock_streamingpb.NewMockStreamingNodeHandlerService_ConsumeClient(t)
+			var attempt context.Context
+			client.EXPECT().Consume(mock.Anything, mock.Anything).RunAndReturn(func(ctx context.Context, _ ...grpc.CallOption) (streamingpb.StreamingNodeHandlerService_ConsumeClient, error) {
+				attempt = ctx
+				if stage == "open" {
+					return nil, expected
+				}
+				return stream, nil
+			}).Once()
+			if stage != "open" {
+				calls := 0
+				stream.EXPECT().Recv().RunAndReturn(func() (*streamingpb.ConsumeResponse, error) {
+					calls++
+					if calls == 1 {
+						if stage == "first-recv" {
+							return nil, expected
+						}
+						if stage == "first-response" {
+							return &streamingpb.ConsumeResponse{}, nil
+						}
+						return firstHandshakeResponse(), nil
+					}
+					if stage == "second-recv" {
+						return nil, expected
+					}
+					if stage == "embedded-error" {
+						return &streamingpb.ConsumeResponse{Response: &streamingpb.ConsumeResponse_CreateVchannel{CreateVchannel: &streamingpb.CreateVChannelConsumerResponse{Response: &streamingpb.CreateVChannelConsumerResponse_Error{Error: expected.AsPBError()}}}}, nil
+					}
+					if stage == "empty-second-response" {
+						return &streamingpb.ConsumeResponse{Response: &streamingpb.ConsumeResponse_CreateVchannel{CreateVchannel: &streamingpb.CreateVChannelConsumerResponse{}}}, nil
+					}
+					if stage == "nil-embedded-error" {
+						return &streamingpb.ConsumeResponse{Response: &streamingpb.ConsumeResponse_CreateVchannel{CreateVchannel: &streamingpb.CreateVChannelConsumerResponse{Response: &streamingpb.CreateVChannelConsumerResponse_Error{}}}}, nil
+					}
+					return &streamingpb.ConsumeResponse{}, nil
+				}).Maybe()
+				stream.EXPECT().Send(mock.Anything).RunAndReturn(func(*streamingpb.ConsumeRequest) error {
+					if stage == "second-send" {
+						return expected
+					}
+					return nil
+				}).Maybe()
+				stream.EXPECT().CloseSend().Return(nil).Maybe()
+			}
+			c, err := CreateConsumer(parent, handshakeOptions(h), client)
+			require.Error(t, err)
+			require.Nil(t, c)
+			if stage == "embedded-error" || stage == "open" || stage == "first-recv" || stage == "second-send" || stage == "second-recv" {
+				require.True(t, status.AsStreamingError(err).IsWALNameMismatch())
+			} else {
+				require.Equal(t, streamingpb.StreamingCode_STREAMING_CODE_INVALID_REQUEST_SEQ, status.AsStreamingError(err).Code)
+			}
+			require.NoError(t, parent.Err())
+		
```

#### Recent Merged Pull Requests:
- **PR #54770** (2026-10-28): fix: [cp3.0] support contextual keywords as field names (@zhengbuqian)
- **PR #54764** (2026-10-28): fix: return WALNameMismatch synchronously during remote consumer creation (@tinswzy)
- **PR #54761** (2026-10-28): fix: [cp3.0] authenticate GCS requests with the registered GCP credential provider (@xiaofan-luan)
- **PR #54760** (2026-10-28): fix: authenticate GCS requests with the registered GCP credential provider (@xiaofan-luan)
- **PR #54758** (2026-10-28): test: [3.0] expand CDC API contract and boundary coverage (@zhuwenxing)
- **PR #54754** (2026-10-28): fix: [3.0] Recover from transient etcd errors instead of crashing (@xiaofan-luan)

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

## X. Recover from all transient etcd errors, not only leader changes (#54733)

**RULE**:
When implementing operations in `internal/cdc/controller/controller.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in milvus-io/milvus. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `029df857`: Recover from all transient etcd errors, not only leader changes (#54733). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `internal/cdc/controller/controller.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	"fmt"
	"time"
	"github.com/milvus-io/milvus/pkg/v3/util/etcd"
// listRetryInterval is how long the controller waits before listing the
// replicate pchannels again after a transient etcd error.
const listRetryInterval = time.Second

			m, err := c.listReplicatePChannels()
			if err != nil {
				if c.ctx.Err() != nil {
					return
				}
				panic(fmt.Sprintf("failed to list replicate pchannels: %v", err))
// listReplicatePChannels lists the replicate pchannels, retrying transient etcd
// errors (e.g. leader changed while etcd restarts). Any other error, including
// a request timeout, is returned.
func (c *controller) listReplicatePChannels() (*meta.ReplicateChannels, error) {
	for {
		m, err := meta.ListReplicatePChannels(c.ctx, resource.Resource().ETCD(), c.prefix)
		if err == nil {
			return m, nil
		}
		if c.ctx.Err() != nil || !etcd.IsRetriableEtcdErr(err) {
			return nil, err
		}
		mlog.Warn(c.ctx, "failed to list replicate pchannels, retry", mlog.Err(err))
		select {
		case <-time.After(listRetryInterval):
		case <-c.ctx.Done():
			return nil, c.ctx.Err()
		}
	}
}

				if c.ctx.Err() != nil {
					return nil
				}
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
			m, err := meta.ListReplicatePChannels(c.ctx, resource.Resource().ETCD(), c.prefix)
			if err != nil && c.ctx.Err() == nil {
				mlog.Warn(c.ctx, "failed to list replicate pchannels", mlog.Err(err))
				continue
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `029df857` are properly handled with clean fallback behavior.
