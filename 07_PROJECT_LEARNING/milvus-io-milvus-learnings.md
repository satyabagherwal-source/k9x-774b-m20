> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/milvus-io-milvus-learnings.md`  
> **Source**: github ([https://github.com/milvus-io/milvus](https://github.com/milvus-io/milvus))  
> **Source Version**: `f830e57c`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-04T20:10:10.175Z  
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
> **Harvest Timestamp**: 2026-11-04T20:10:10.072Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `milvus-io/milvus`
- **Description**: Milvus is a high-performance, cloud-native vector database built for scalable vector ANN search
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 46595 stars

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
- **Issue #55138** (2026-11-04): **fix: [3.0] release MinioChunkManager's AWS SDK reference when the process exits**
  *Symptoms*: issue: #55128 pr: #55131  Cherry-pick of #55131 to 3.0. The patch applies cleanly: `MinioChunkManager.h` and `RemoteChunkManagerSingleton.h` are identical on both branches, and 3.0's `MinioChunkManager.cpp` differs from master only in credential handling, away from the changed lines. 3.0 builds the same AWS SDK (1.11.842), its milvus-storage pin (ab1d5fd4) releases its own reference through `FinalizeS3` as master's does, and `RemoteChunkManagerSingleton` is the only static owner of a remote chunk manager there too.  ## What  - MinioChunkManager takes its AWS SDK reference through `InitSDKAPIUntilExit`, which registers `ReleaseSDKAPIAtExit` with `std::atexit` once. At exit the handler calls `Aws::ShutdownAPI` with the options the SDK was initialized with, unless `ShutdownSDKAPI` has released the reference already. While the process runs nothing changes: managers coming and going still leave the SDK initialized. - `RemoteChunkManagerSingleton::GetInstance` allocates the instance and never destroys it. The remote chunk manager already lives as long as the process (`Release` keeps it), and its static destructor would otherwise destroy an S3 client after the SDK was shut down at exit. It is the only static owner of a remote chunk manager in segcore; the others are created per task.  ## Why  A process that runs exit handlers destroys the SDK's static objects while MinioChunkManager's reference keeps the SDK initialized. The default client bootstrap then shuts down from its static d

- **Issue #55131** (2026-11-04): **fix: release MinioChunkManager's AWS SDK reference when the process exits**
  *Symptoms*: issue: #55128  ## What  - MinioChunkManager takes its AWS SDK reference through `InitSDKAPIUntilExit`, which registers `ReleaseSDKAPIAtExit` with `std::atexit` once. At exit the handler calls `Aws::ShutdownAPI` with the options the SDK was initialized with, unless `ShutdownSDKAPI` has released the reference already. While the process runs nothing changes: managers coming and going still leave the SDK initialized. - `RemoteChunkManagerSingleton::GetInstance` allocates the instance and never destroys it. The remote chunk manager already lives as long as the process (`Release` keeps it), and its static destructor would otherwise destroy an S3 client after the SDK was shut down at exit. It is the only static owner of a remote chunk manager in segcore; the others are created per task.  ## Why  A process that runs exit handlers destroys the SDK's static objects while MinioChunkManager's reference keeps the SDK initialized. The default client bootstrap then shuts down from its static destructor, and the cleanup thread that starts races the destruction of the SDK's log redirection: a CRT thread crashes in `s_aws_logger_redirect_get_log_level`. `Aws::ShutdownAPI` counts references, so with this change whichever holder releases last, MinioChunkManager or milvus-storage's `FinalizeS3`, shuts the SDK down before its static objects are destroyed.  ## Effect on Milvus  None for the milvus binary: `os.Exit` and the return from `main` end with `exit_group`, so exit handlers never run. C++ te
  **Post-Mortem & Fix Analysis**:
  > [ci-v2-notice] Notice: New ci-v2 system is enabled for this PR.  To rerun ci-v2 checks, comment with: - /ci-rerun-code-check  // for ci-v2/code-check - /ci-rerun-code-check-macos  // for Code Checker MacOS (GitHub Actions) - /ci-rerun-build  // for ci-v2/build - /ci-rerun-build-all  // for ci-v2/build-all (multi-arch builds) - /ci-rerun-buildenv  // for ci-v2/build-env (build milvus-env builder images; update .env after the new tag is ready) - /ci-rerun-ut-integration  // for ci-v2/ut-integration, will rerun ci-v2/build - /ci-rerun-ut-go  // for ci-v2/ut-go, will rerun ci-v2/build - /ci-rerun-ut-cpp  // for ci-v2/ut-cpp - /ci-rerun-ut  // for all ci-v2/ut-integration, ci-v2/ut-go, ci-v2/ut-cpp, will rerun ci-v2/build - /ci-rerun-e2e-default  // for ci-v2/e2e-default - /ci-rerun-e2e-pulsar-wp  // for ci-v2/e2e-pulsar-wp (GCP branch-equivalent Pulsar + Woodpecker Python E2E) - /ci-rerun-e2e-amd  // for ci-v2/e2e-amd (e2e pool dispatcher) - /ci-rerun-e2e-dist-wp  // for ci-v2/e2e-dist-wp 
  > <!-- team2-arev:debate-D235ee857e4 --> > **Must-fix issues introduced by this PR: 0** > **Merge recommendation:** Mergeable as-is — this review found no must-fix issue introduced by this PR.  Adversarial review found no issues requiring changes.  **Verified:** - `internal/core/src/storage/minio/MinioChunkManager.cpp:406-410`: `init_count_.exchange(0) > 0` results in exactly one `Aws::ShutdownAPI` call. That matches the single `Aws::InitAPI` call made on the 0→1 transition (`:272-273`, `:327-328`). When `ShutdownSDKAPI` has already brought the count back to 0, the handler does nothing. - `internal/core/src/storage/minio/MinioChunkManager.cpp:397-401`: `std::call_once` ensures `atexit` is registered only once. If the SDK is initialized again after an explicit shutdown, `sdk_options_at_init` is overwritten, so the handler shuts down with the options from the most recent init. - `internal/core/src/storage/minio/MinioChunkManager.cpp:405`: the handler takes `client_mutex_`, the same mutex b

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

### Incident Patch 1: `eabafc85` (2026-11-04)
**Commit Message**: fix: release MinioChunkManager's AWS SDK reference when the process exits (#55131)

issue: #55128

## What

- MinioChunkManager takes its AWS SDK reference through
`InitSDKAPIUntilExit`, which registers `ReleaseSDKAPIAtExit` with
`std::atexit` once. At exit the handler calls `Aws::ShutdownAPI` with
the options the SDK was initialized with, unless `ShutdownSDKAPI` has
released the reference already. While the process runs nothing changes:
managers coming and going still leave the SDK initialized.
- `RemoteChunkManagerSingleton::GetInstance` allocates the instance and
never destroys it. The remote chunk manager already lives as long as the
process (`Release` keeps it), and its static destructor would otherwise
destroy an S3 client after the SDK was shut down at exit. It is the only
static owner of a remote chunk manager in segcore; the others are
created per task.

## Why

A process that runs exit handlers destroys the SDK's static objects
while MinioChunkManager's reference keeps the SDK initialized. The
default client bootstrap then shuts down from its static destructor, and
the cleanup thread that starts races the destruction of the SDK's log
redirection: a CRT thread crashes in
`

**File**: `internal/core/src/storage/RemoteChunkManagerSingleton.h` (modified, +6/-2)
```diff
@@ -33,8 +33,12 @@ class RemoteChunkManagerSingleton {
 
     static RemoteChunkManagerSingleton&
     GetInstance() {
-        static RemoteChunkManagerSingleton instance;
-        return instance;
+        // Never destroyed. The remote chunk manager lives as long as the
+        // process, since Release keeps it, and a static destructor would
+        // destroy its client after MinioChunkManager released the AWS SDK at
+        // exit, which the SDK does not allow.
+        static auto* instance = new RemoteChunkManagerSingleton();
+        return *instance;
     }
 
     void
```

**File**: `internal/core/src/storage/minio/MinioChunkManager.cpp` (modified, +37/-3)
```diff
@@ -32,6 +32,7 @@
 #include <algorithm>
 #include <cctype>
 #include <chrono>
+#include <cstdlib>
 #include <exception>
 #include <functional>
 #include <mutex>
@@ -75,6 +76,11 @@ std::mutex MinioChunkManager::client_mutex_;
 
 namespace {
 
+// The options the SDK was last initialized with: Aws::ShutdownAPI undoes what
+// Aws::InitAPI set up from them.
+Aws::SDKOptions sdk_options_at_init;
+std::once_flag release_sdk_at_exit;
+
 std::mutex&
 GcsEndpointsMutex() {
     static std::mutex mutex;
@@ -310,7 +316,7 @@ MinioChunkManager::InitSDKAPI(RemoteStorageType type,
         sdk_options_.loggingOptions.logger_create_fn = [log_level]() {
             return std::make_shared<AwsLogger>(log_level);
         };
-        Aws::InitAPI(sdk_options_);
+        InitSDKAPIUntilExit(sdk_options_);
     }
 }
 
@@ -363,7 +369,7 @@ MinioChunkManager::InitSDKAPIDefault(const std::string& log_level_str,
         sdk_options_.loggingOptions.logger_create_fn = [log_level]() {
             return std::make_shared<AwsLogger>(log_level);
         };
-        Aws::InitAPI(sdk_options_);
+        InitSDKAPIUntilExit(sdk_options_);
     }
 }
 
@@ -376,6 +382,34 @@ MinioChunkManager::ShutdownSDKAPI() {
     }
 }
 
+// MinioChunkManagers share one reference to the AWS SDK. The first manager
+// takes it, and managers coming and going do not release it, since the SDK
+// would then have to be initialized again for the next one (#42459). It is
+// released when the process exits instead. A Go process ends with exit_group
+// and runs no exit handlers, but a host process that runs them would
+// otherwise destroy the SDK's static objects while the SDK is still
+// initialized: the default client bootstrap then shuts down from its static
+// destructor, and the cleanup thread that starts races the destruction of the
+// SDK's log redirection (a SIGSEGV in s_aws_logger_redirect_get_log_level).
+// Aws::ShutdownAPI counts references, so whichever holder releases the SDK
+// last shuts it down, this one or milvus-storage's own release at exit.
+void
+MinioChunkManager::InitSDKAPIUntilExit(const Aws::SDKOptions& options) {
+    Aws::InitAPI(options);
+    sdk_options_at_init = options;
+    std::call_once(release_sdk_at_exit,
+                   [] { std::atexit(MinioChunkManager::ReleaseSDKAPIAtExit); });
+}
+
+void
+MinioChunkManager::ReleaseSDKAPIAtExit() {
+    std::scoped_lock lock{client_mutex_};
+    // ShutdownSDKAPI may have released the reference already.
+    if (init_count_.exchange(0) > 0) {
+        Aws::ShutdownAPI(sdk_options_at_init);
+    }
+}
+
 void
 MinioChunkManager::BuildS3Client(
     const StorageConfig& storage_config,
@@ -654,7 +688,7 @@ MinioChunkManager::MinioChunkManager(const StorageConfig& storage_config)
 
 MinioChunkManager::~MinioChunkManager() {
     client_.reset();
-    // ShutdownSDKAPI();
+    // The SDK reference outlives the manager: see InitSDKAPIUntilExit.
 }
 
 uint64_t
```

**File**: `internal/core/src/storage/minio/MinioChunkManager.h` (modified, +7/-0)
```diff
@@ -312,6 +312,13 @@ class MinioChunkManager : public ChunkManager {
     static bool
     NeedChecksumOverride(const std::string& cloud_provider);
 
+    // Aws::InitAPI, whose reference ReleaseSDKAPIAtExit drops when the
+    // process exits. Called with client_mutex_ held.
+    static void
+    InitSDKAPIUntilExit(const Aws::SDKOptions& options);
+    static void
+    ReleaseSDKAPIAtExit();
+
     Aws::SDKOptions sdk_options_;
     static std::atomic<size_t> init_count_;
     static std::mutex client_mutex_;
```

---

### Incident Patch 2: `1fe17a49` (2026-11-04)
**Commit Message**: fix: Replay deltalogs when reopening external milvus-table segments (#54736)

issue: #54735

### Problem

A milvus-table refresh reuses a target segment when every fragment
identity is unchanged. The identity is the source segment manifest path
**including its version**, plus the row range
(`packed.FragmentIdentity`). Snapshot-level L0 deltalogs are attached to
every fragment (`buildMilvusTableFileInfosFromSnapshotMetadata`).

Trigger: the source table deletes rows, and a new snapshot is taken
**before source L0 compaction** folds those deletes into the source
segments. The source segment manifests keep their versions, so the
refresh keeps the target segments. Their L0 deltalog sets differ, so
`refreshMilvusTableSegmentManifest` only rewrites their manifests to
include the new deltalogs. QueryCoord sees the newer manifest and sends
a reopen.

QueryNode reopen only switched the segcore view and never loaded the new
deltalogs, so the deleted rows stayed visible. Because the new manifest
was already reported, QueryCoord never retried. One such refresh affects
every kept segment of the collection. The deletes took effect only after
a full reload (release/load, QueryNode restart, balanc

**File**: `internal/core/unittest/test_sealed.cpp` (modified, +32/-0)
```diff
@@ -5037,6 +5037,38 @@ TEST(SealedSegmentReopen, LazySchemaReopenDoesNotWaitForReopenMutex) {
     EXPECT_EQ(sealed->TestGetSchemaSnapshot()->get_schema_version(), 300);
 }
 
+TEST(SealedSegmentReopen, ReplayedDeletesSurviveReopen) {
+    auto schema = std::make_shared<Schema>();
+    auto pk_id = schema->AddDebugField("pk", DataType::INT64);
+    schema->set_primary_field_id(pk_id);
+    schema->set_schema_version(100);
+    auto dataset = DataGen(schema, 10);
+    auto segment = CreateSealedWithFieldDataLoaded(schema, dataset);
+    auto* sealed = dynamic_cast<ChunkedSegmentSealedImpl*>(segment.get());
+    ASSERT_NE(sealed, nullptr);
+
+    auto pks = dataset.get_col<int64_t>(pk_id);
+    auto ids = std::make_unique<IdArray>();
+    ids->mutable_int_id()->add_data(pks[0]);
+    std::vector<Timestamp> timestamps{1000};
+    LoadDeletedRecordInfo deletes = {timestamps.data(), ids.get(), 1};
+    segment->LoadDeletedRecord(deletes);
+    ASSERT_EQ(segment->get_deleted_count(), 1);
+
+    // A later reopen must retain deletes; retrying their application is idempotent.
+    auto next_schema = std::make_shared<Schema>();
+    auto next_pk = next_schema->AddDebugField("pk", DataType::INT64);
+    next_schema->set_primary_field_id(next_pk);
+    next_schema->set_schema_version(101);
+    EXPECT_NO_THROW(sealed->Reopen(next_schema));
+    segment->LoadDeletedRecord(deletes);
+    EXPECT_EQ(segment->get_deleted_count(), 1);
+    BitsetType mask(10, false);
+    auto view = BitsetTypeView(mask);
+    segment->mask_with_delete(view, 10, 2000);
+    EXPECT_EQ(mask.count(), 1);
+}
+
 TEST(SealedSegmentReopen, SchemaOnlyReopenPublishesDefaultFilledState) {
     auto old_schema = std::make_shared<Schema>();
     old_schema->AddDebugField("pk", DataType::INT64);
```

**File**: `internal/querynodev2/segments/segment.go` (modified, +14/-0)
```diff
@@ -1306,6 +1306,15 @@ func (s *LocalSegment) Load(ctx context.Context) error {
 }
 
 func (s *LocalSegment) Reopen(ctx context.Context, newLoadInfo *querypb.SegmentLoadInfo) error {
+	return s.reopen(ctx, newLoadInfo, nil)
+}
+
+// reopen runs the optional delete replay before publishing newLoadInfo. If the
+// replay fails, the old load info stays reported so the QueryCoord checker can
+// schedule another reopen, independently of the RPC error retry classification.
+// Segcore has already switched views; rows pending deletion can remain visible
+// until a later replay succeeds (permanent source errors require repair).
+func (s *LocalSegment) reopen(ctx context.Context, newLoadInfo *querypb.SegmentLoadInfo, replayDeletes func() error) error {
 	if !s.ptrLock.PinIfNotReleased() {
 		return merr.WrapErrSegmentNotLoaded(s.ID(), "segment released during reopen")
 	}
@@ -1327,6 +1336,11 @@ func (s *LocalSegment) Reopen(ctx context.Context, newLoadInfo *querypb.SegmentL
 	if err != nil {
 		return err
 	}
+	if replayDeletes != nil {
+		if err := replayDeletes(); err != nil {
+			return merr.Wrap(err, "replay deltalogs after reopen")
+		}
+	}
 	s.syncFieldIndexes(newLoadInfo.GetIndexInfos())
 	if s.relatedDataSize != nil {
 		s.relatedDataSize.Store(calculateSegmentLogSize(newLoadInfo))
```

**File**: `internal/querynodev2/segments/segment_loader.go` (modified, +41/-1)
```diff
@@ -27,6 +27,7 @@ import (
 	"context"
 	"fmt"
 	"io"
+	"maps"
 	"math"
 	"path"
 	"strconv"
@@ -2104,7 +2105,19 @@ func (loader *segmentLoader) ReopenSegments(ctx context.Context,
 			configureUseTakeForOutput(info, collection.Schema())
 		}
 
-		err := segment.Reopen(ctx, info)
+		var err error
+		local, ok := segment.(*LocalSegment)
+		if ok && collection != nil && typeutil.IsExternalCollection(collection.Schema()) &&
+			typeutil.NewStorageColumnResolver(collection.Schema()).IsMilvusTable() &&
+			!deltaSourceUnchanged(local.LoadInfo(), info) {
+			// External refresh may add deletes to the new manifest; replay them
+			// before the new load info is published.
+			err = local.reopen(ctx, info, func() error {
+				return loader.loadDeltalogs(ctx, local, info)
+			})
+		} else {
+			err = segment.Reopen(ctx, info)
+		}
 		if err != nil {
 			mlog.Warn(context.TODO(), "failed to reopen segment", mlog.Int64("segmentID", info.GetSegmentID()), mlog.Err(err))
 			return err
@@ -2114,6 +2127,33 @@ func (loader *segmentLoader) ReopenSegments(ctx context.Context,
 	return nil
 }
 
+// deltaSourceUnchanged reports whether incoming references the same delete
+// sources as the published load info. Reopen publishes load info only after a
+// successful replay, so an unchanged source (e.g. index-only reopen) has
+// already been applied. Child manifests are not kept in the runtime load info,
+// so their presence always forces a replay.
+func deltaSourceUnchanged(current, incoming *querypb.SegmentLoadInfo) bool {
+	if len(incoming.GetChildManifestPaths()) != 0 || current.GetManifestPath() != incoming.GetManifestPath() {
+		return false
+	}
+	// Files are immutable; ordering and repeated references do not change their contents.
+	type identity struct {
+		fieldID int64
+		logID   int64
+		path    string
+	}
+	sources := func(info *querypb.SegmentLoadInfo) map[identity]struct{} {
+		result := make(map[identity]struct{})
+		for _, field := range info.GetDeltalogs() {
+			for _, log := range field.GetBinlogs() {
+				result[identity{field.GetFieldID(), log.GetLogID(), log.GetLogPath()}] = struct{}{}
+			}
+		}
+		return result
+	}
+	return maps.Equal(sources(current), sources(incoming))
+}
+
 func getBinlogDataDiskSize(fieldBinlog *datapb.FieldBinlog) int64 {
 	fieldSize := int64(0)
 	for _, binlog := range fieldBinlog.Binlogs {
```

**File**: `internal/querynodev2/segments/segment_loader_test.go` (modified, +365/-0)
```diff
@@ -24,19 +24,25 @@ import (
 	"testing"
 	"time"
 
+	"github.com/apache/arrow/go/v17/arrow"
+	"github.com/apache/arrow/go/v17/arrow/array"
+	"github.com/apache/arrow/go/v17/arrow/memory"
 	"github.com/bytedance/mockey"
 	"github.com/cockroachdb/errors"
 	"github.com/stretchr/testify/assert"
 	"github.com/stretchr/testify/require"
 	"github.com/stretchr/testify/suite"
 	"go.uber.org/atomic"
+	"google.golang.org/protobuf/proto"
 
 	"github.com/milvus-io/milvus-proto/go-api/v3/commonpb"
 	"github.com/milvus-io/milvus-proto/go-api/v3/schemapb"
 	"github.com/milvus-io/milvus/internal/mocks/util/mock_segcore"
+	"github.com/milvus-io/milvus/internal/querynodev2/segments/state"
 	"github.com/milvus-io/milvus/internal/storage"
 	"github.com/milvus-io/milvus/internal/storagev2/packed"
 	"github.com/milvus-io/milvus/internal/util/initcore"
+	"github.com/milvus-io/milvus/internal/util/segcore"
 	"github.com/milvus-io/milvus/internal/util/segcore/loadresource"
 	"github.com/milvus-io/milvus/pkg/v3/common"
 	"github.com/milvus-io/milvus/pkg/v3/mlog"
@@ -132,6 +138,291 @@ func (eofRecordReader) Close() error {
 	return nil
 }
 
+type reopenTestCore struct{ segcore.CSegment }
+
+type reopenDeltaReader struct {
+	record storage.Record
+	read   bool
+}
+
+func (r *reopenDeltaReader) Next() (storage.Record, error) {
+	if r.read {
+		return nil, io.EOF
+	}
+	r.read = true
+	return r.record, nil
+}
+
+func (r *reopenDeltaReader) Close() error {
+	r.record.Release()
+	return nil
+}
+
+func newReopenTestSegment(schema *schemapb.CollectionSchema, info *querypb.SegmentLoadInfo) *LocalSegment {
+	return &LocalSegment{
+		baseSegment: baseSegment{
+			collection: NewCollectionWithoutSegcoreForTest(info.GetCollectionID(), schema),
+			loadInfo:   atomic.NewPointer(info),
+		},
+		ptrLock:            state.NewLoadStateLock(state.LoadStateDataLoaded),
+		csegment:           &reopenTestCore{},
+		lastDeltaTimestamp: atomic.NewUint64(0),
+		fieldIndexes:       typeutil.NewConcurrentMap[int64, *IndexedFieldInfo](),
+	}
+}
+
+func TestReopenSegmentsExternalDeltalogs(t *testing.T) {
+	paramtable.Init()
+	params := paramtable.Get()
+	statsKey := params.CommonCfg.EnabledJSONKeyStats.Key
+	statsValue := params.CommonCfg.EnabledJSONKeyStats.GetValue()
+	require.NoError(t, params.Save(statsKey, "false"))
+	t.Cleanup(func() { require.NoError(t, params.Save(statsKey, statsValue)) })
+	for _, scenario := range []struct {
+		name      string
+		virtualPK bool
+		failure   string
+		permanent bool
+	}{
+		{name: "real_pk_success", failure: "none"},
+		{name: "virtual_pk_success", virtualPK: true, failure: "none"},
+		{name: "reopen_failure", failure: "reopen"},
+		{name: "read_failure", failure: "read"},
+		{name: "apply_failure", failure: "apply"},
+		{name: "permanent_read_failure", failure: "read", permanent: true},
+		{name: "permanent_apply_failure", failure: "apply", permanent: true},
+		{name: "virtual_pk_read_failure", virtualPK: true, failure: "read"},
+	} {
+		t.Run(scenario.name, func(t *testing.T) {
+			failure := scenario.failure
+			ctx := context.Background()
+			manager := NewManager()
+			schema := milvusTableCollectionSchema(scenario.virtualPK)
+			schema.ExternalSource = "s3://source-bucket/snapshots/100/metadata/200.json"
+			manager.Collection.(*collectionManager).collections[1000] = NewCollectionWithoutSegcoreForTest(1000, schema)
+			oldInfo := &querypb.SegmentLoadInfo{
+				CollectionID: 1000, SegmentID: 3000,
+				ManifestPath: packed.MarshalManifestPath("files/insert_log/1000/2000/3000", 1),
+			}
+			newInfo := &querypb.SegmentLoadInfo{
+				CollectionID: 1000, SegmentID: 3000,
+				ManifestPath: packed.MarshalManifestPath("files/insert_log/1000/2000/3000", 2),
+			}
+			segment := newReopenTestSegment(schema, oldInfo)
+			// Deletes from the old manifest were already applied; replay only
+			// reads the newly added deltalog.
+			segment.lastDeltaTimestamp.Store(50)
+			manager.Segment.(*segmentManager).globalSegments.Put(ctx, SegmentTypeSealed, segment)
+			loader := &segmentLoader{manager: manager, loadingSegments: typeutil.NewConcurrentMap[int64, *loadResult]()}
+			resourcePatch := mockey.Mock((*segmentLoader).requestResource).Return(requestResourceResult{}, nil).Build()
+			defer resourcePatch.UnPatch()
+			freePatch := mockey.Mock((*segmentLoader).freeRequestResource).Return().Build()
+			defer freePatch.UnPatch()
+
+			injected := merr.Wrap(merr.ErrIoTooManyRequests, "injected reopen failure")
+			if scenario.permanent {
+				injected = merr.Wrap(merr.ErrParameterInvalid, "injected permanent failure")
+			}
+			var calls []string
+			failed := false
+			expectedInfo := oldInfo
+			failOnce := func(stage string) error {
+				calls = append(calls, stage)
+				assert.Same(t, expectedInfo, segment.LoadInfo(), "load info must not be published before replay completes")
+				if failure == stage && !failed {
+					failed = true
+					return injected
+				}
+				return nil
+			}
+			corePatch := mockey.Mock((*reopenTestCore)
```

---

### Incident Patch 3: `fc28ab6b` (2026-11-04)
**Commit Message**: enhance: add native TSan builds with LLVM Archer (#53895)

## What changed

Add an opt-in `USE_TSAN=ON` CMake build for Linux CPU development with
LLVM 20 and upstream Archer. Native race investigations can use the
standard build and runtime entry points without maintaining custom
OpenMP synchronization wrappers.

- Use a shared LLVM TSan runtime across Core, source dependencies, the
parser wrapper and cgo; reject incompatible sanitizer/GPU combinations
and mixed build outputs.
- Rebuild six synchronization-sensitive Conan packages with distinct
TSan identities, use pthread OpenBLAS to avoid mixing OpenMP runtimes,
and verify installed dependencies.
- Package libomp, Archer and the matching LLVM symbolizer; activate
Archer automatically and fail detected races with exit code 66.
- Add synchronized and intentionally racy C/C++/OpenMP controls, plus
two Clang narrowing-conversion compatibility fixes.

issue: #53763

design doc:
docs/design-docs/design_docs/20260928-native-thread-sanitizer.md

## Verification

- Full native + Go build and container packaging passed; the deployed
service reached Healthy. Runtime dependency auditing checked 163 ELF
files without unresolved dependencies,

**File**: `Makefile` (modified, +39/-4)
```diff
@@ -55,6 +55,38 @@ ifeq ($(USE_ASAN), ON)
 	MILVUS_GO_BUILD_TAGS := $(MILVUS_GO_BUILD_TAGS),use_asan
 endif
 
+USE_TSAN ?= OFF
+export USE_TSAN
+# Preserve Go's default C++ flags when the caller did not provide an override.
+CGO_CXXFLAGS ?= $(shell $(GO) env CGO_CXXFLAGS)
+ifneq ($(USE_TSAN),ON)
+ifneq ($(USE_TSAN),OFF)
+$(error USE_TSAN must be ON or OFF)
+endif
+endif
+use_tsan = $(USE_TSAN)
+TSAN_GO_LDFLAGS :=
+ifeq ($(USE_TSAN), ON)
+ifneq ($(OS),Linux)
+$(error USE_TSAN currently requires Linux)
+endif
+ifeq ($(USE_ASAN), ON)
+$(error USE_ASAN and USE_TSAN are mutually exclusive)
+endif
+ifneq ($(filter -race -race=true,$(GOFLAGS) $(shell $(GO) env GOFLAGS)),)
+$(error USE_TSAN cannot be combined with Go -race)
+endif
+	override CGO_CFLAGS += -fsanitize=thread -g -fno-omit-frame-pointer
+	override CGO_CXXFLAGS += -fsanitize=thread -g -fno-omit-frame-pointer
+	override CGO_LDFLAGS += -fsanitize=thread -shared-libsan
+	MILVUS_LLVM_ROOT ?= /usr/lib/llvm-20
+	override CC := $(MILVUS_LLVM_ROOT)/bin/clang
+	override CXX := $(MILVUS_LLVM_ROOT)/bin/clang++
+	export CC CXX MILVUS_LLVM_ROOT
+	MILVUS_GO_BUILD_TAGS := dynamic,sonic,$(SONIC_PLUGIN_SYNC_TAG)
+	TSAN_GO_LDFLAGS := -linkmode=external
+endif
+
 use_dynamic_simd = ON
 ifdef USE_DYNAMIC_SIMD
 	use_dynamic_simd = ${USE_DYNAMIC_SIMD}
@@ -126,6 +158,9 @@ endif
 unexport WITH_GPU
 
 ifneq ($(filter ON on TRUE True true 1,$(WITH_GPU)),)
+    ifeq ($(USE_TSAN),ON)
+        $(error USE_TSAN does not support GPU builds)
+    endif
     ifneq ($(index_engine),cardinal)
         MILVUS_GO_BUILD_TAGS := $(MILVUS_GO_BUILD_TAGS),cuda
     endif
@@ -149,7 +184,7 @@ build-go:
 	@echo "Building Milvus ..."
 	@source $(PWD)/scripts/setenv.sh && \
 		mkdir -p $(INSTALL_PATH) && go env -w CGO_ENABLED="1" && \
-		$(GOEXPERIMENT_FLAG) CGO_LDFLAGS="$(CGO_LDFLAGS)" CGO_CFLAGS="$(CGO_CFLAGS)" GO111MODULE=on $(GO) build -pgo=$(PGO_PATH)/default.pgo -ldflags="$(SONIC_PLUGIN_SYNC_LDFLAG) -r $${RPATH} -X '$(OBJPREFIX).BuildTags=$(BUILD_TAGS)' -X '$(OBJPREFIX).BuildTime=$(BUILD_TIME)' -X '$(OBJPREFIX).GitCommit=$(GIT_COMMIT)' -X '$(OBJPREFIX).GoVersion=$(GO_VERSION)' -X '$(OBJPREFIX).MilvusVersion=$(MILVUS_VERSION)'" \
+		$(GOEXPERIMENT_FLAG) CGO_LDFLAGS="$(CGO_LDFLAGS)" CGO_CFLAGS="$(CGO_CFLAGS)" CGO_CXXFLAGS="$(CGO_CXXFLAGS)" GO111MODULE=on $(GO) build -pgo=$(PGO_PATH)/default.pgo -ldflags="$(TSAN_GO_LDFLAGS) $(SONIC_PLUGIN_SYNC_LDFLAG) -r $${RPATH} -X '$(OBJPREFIX).BuildTags=$(BUILD_TAGS)' -X '$(OBJPREFIX).BuildTime=$(BUILD_TIME)' -X '$(OBJPREFIX).GitCommit=$(GIT_COMMIT)' -X '$(OBJPREFIX).GoVersion=$(GO_VERSION)' -X '$(OBJPREFIX).MilvusVersion=$(MILVUS_VERSION)'" \
 		-tags "$(MILVUS_GO_BUILD_TAGS)" -o $(INSTALL_PATH)/milvus $(PWD)/cmd/main.go 1>/dev/null
 
 get-build-deps:
@@ -350,15 +385,15 @@ check-segcore-codes-product: generate-segcore-codes
 
 build-cpp: generated-proto plan-parser-lib
 	@echo "Building Milvus cpp library ..."
-	@(env TANTIVY_ANALYZER_REMOTE_TLS=$(tantivy_analyzer_remote_tls) bash $(PWD)/scripts/core_build.sh -t ${mode} -a ${use_asan} -n ${use_disk_index} -y ${use_dynamic_simd} ${AZURE_OPTION} -x ${index_engine} -G ${WITH_GPU} -f $(tantivy_features) -S ${use_svs} -R ${with_crt})
+	@(env TANTIVY_ANALYZER_REMOTE_TLS=$(tantivy_analyzer_remote_tls) bash $(PWD)/scripts/core_build.sh -t ${mode} -a ${use_asan} -T ${use_tsan} -n ${use_disk_index} -y ${use_dynamic_simd} ${AZURE_OPTION} -x ${index_engine} -G ${WITH_GPU} -f $(tantivy_features) -S ${use_svs} -R ${with_crt})
 
 build-cpp-with-unittest: generated-proto plan-parser-lib
 	@echo "Building Milvus cpp library with unittest ... "
-	@(env TANTIVY_ANALYZER_REMOTE_TLS=$(tantivy_analyzer_remote_tls) bash $(PWD)/scripts/core_build.sh -t ${mode} -a ${use_asan} -u -n ${use_disk_index} -y ${use_dynamic_simd} ${AZURE_OPTION} -x ${index_engine} -G ${WITH_GPU} -f $(tantivy_features) -S ${use_svs} -R ${with_crt})
+	@(env TANTIVY_ANALYZER_REMOTE_TLS=$(tantivy_analyzer_remote_tls) bash $(PWD)/scripts/core_build.sh -t ${mode} -a ${use_asan} -T ${use_tsan} -u -n ${use_disk_index} -y ${use_dynamic_simd} ${AZURE_OPTION} -x ${index_engine} -G ${WITH_GPU} -f $(tantivy_features) -S ${use_svs} -R ${with_crt})
 
 build-cpp-with-coverage: generated-proto plan-parser-lib
 	@echo "Building Milvus cpp library with coverage and unittest ..."
-	@(env TANTIVY_ANALYZER_REMOTE_TLS=$(tantivy_analyzer_remote_tls) bash $(PWD)/scripts/core_build.sh -t ${mode} -a ${use_asan} -u -c -n ${use_disk_index} -y ${use_dynamic_simd} ${AZURE_OPTION} -x ${index_engine} -G ${WITH_GPU} -f $(tantivy_features) -S ${use_svs} -R ${with_crt})
+	@(env TANTIVY_ANALYZER_REMOTE_TLS=$(tantivy_analyzer_remote_tls) bash $(PWD)/scripts/core_build.sh -t ${mode} -a ${use_asan} -T ${use_tsan} -u -c -n ${use_disk_index} -y ${use_dynamic_simd} ${AZURE_OPTION} -x ${index_engine} -G ${WITH_GPU} -f $(tantivy_features) -S ${use_svs} -R ${with_crt})
 
 check-proto-product: generated-proto
 	 @(env bash $(PWD)/scripts/check_proto_product.sh)
```

**File**: `build/build_image.sh` (modified, +12/-0)
```diff
@@ -44,6 +44,9 @@ fi
 
 echo ${IMAGE_ARCH}
 
+source "${toplevel}/scripts/sanitizer_env.sh"
+milvus_sanitizer_env "${toplevel}"
+
 if [[ "$USE_ASAN" == "ON" ]]; then
     if [[ "$OS_NAME" == "ubuntu20.04" ]]; then
         BUILD_ARGS="${BUILD_ARGS:---build-arg TARGETARCH=${IMAGE_ARCH} --build-arg MILVUS_ASAN_LIB=/milvus/lib/libasan.so.6}"
@@ -56,6 +59,15 @@ else
     BUILD_ARGS="${BUILD_ARGS:---build-arg TARGETARCH=${IMAGE_ARCH}}"
 fi
 
+if [[ "${MILVUS_ENABLE_TSAN}" == "ON" ]]; then
+    BUILD_ARGS="${BUILD_ARGS} --build-arg MILVUS_JEMALLOC_LIB="
+    if [[ -f "${toplevel}/lib/milvus-archer" ]]; then
+        python3 "${toplevel}/internal/core/milvus_tsan.py" verify "${toplevel}/lib"
+        python3 "${toplevel}/internal/core/milvus_tsan.py" verify-runtime "${toplevel}/lib"
+        BUILD_ARGS="${BUILD_ARGS} --build-arg MILVUS_ARCHER_LIB=/milvus/lib/libarcher.so --build-arg MILVUS_TSAN_OPTIONS=halt_on_error=1:exitcode=66:suppressions=/milvus/lib/tsan.supp:external_symbolizer_path=/milvus/lib/llvm-symbolizer"
+    fi
+fi
+
 pushd "${toplevel}"
 
 docker build --network host ${BUILD_ARGS} --platform linux/${IMAGE_ARCH} -f "./build/docker/milvus/${OS_NAME}/Dockerfile" -t "${MILVUS_IMAGE_REPO}:${MILVUS_IMAGE_TAG}" .
```

**File**: `build/docker/milvus/amazonlinux2023/Dockerfile` (modified, +6/-1)
```diff
@@ -15,6 +15,9 @@ FROM amazonlinux:2023
 
 ARG TARGETARCH
 ARG MILVUS_ASAN_LIB
+ARG MILVUS_ARCHER_LIB
+ARG MILVUS_TSAN_OPTIONS=halt_on_error=1:exitcode=66
+ARG MILVUS_JEMALLOC_LIB=/milvus/lib/libjemalloc.so
 ARG MILVUS_RUNTIME_USER=milvus:milvus
 
 COPY --from=uv /uv /usr/local/bin/uv
@@ -50,7 +53,9 @@ RUN uv --no-cache pip install --python python3.12 --system --break-system-packag
 
 ENV PATH=/milvus/bin:$PATH
 ENV LD_LIBRARY_PATH=/milvus/lib:$LD_LIBRARY_PATH:/usr/lib
-ENV LD_PRELOAD=${MILVUS_ASAN_LIB}:/milvus/lib/libjemalloc.so
+ENV LD_PRELOAD=${MILVUS_ASAN_LIB}:${MILVUS_JEMALLOC_LIB}
+ENV TSAN_OPTIONS=${MILVUS_TSAN_OPTIONS}
+ENV OMP_TOOL_LIBRARIES=${MILVUS_ARCHER_LIB}
 ENV MALLOC_CONF=background_thread:true
 ENV OPENSSL_MODULES=/milvus/lib/ossl-modules
 
```

**File**: `build/docker/milvus/rockylinux9/Dockerfile` (modified, +6/-1)
```diff
@@ -15,6 +15,9 @@ FROM rockylinux/rockylinux:9
 
 ARG TARGETARCH
 ARG MILVUS_ASAN_LIB
+ARG MILVUS_ARCHER_LIB
+ARG MILVUS_TSAN_OPTIONS=halt_on_error=1:exitcode=66
+ARG MILVUS_JEMALLOC_LIB=/milvus/lib/libjemalloc.so
 ARG MILVUS_RUNTIME_USER=milvus:milvus
 
 COPY --from=uv /uv /usr/local/bin/uv
@@ -52,7 +55,9 @@ RUN uv --no-cache pip install --python python3.12 --system --break-system-packag
 
 ENV PATH=/milvus/bin:$PATH
 ENV LD_LIBRARY_PATH=/milvus/lib:$LD_LIBRARY_PATH:/usr/lib
-ENV LD_PRELOAD=${MILVUS_ASAN_LIB}:/milvus/lib/libjemalloc.so
+ENV LD_PRELOAD=${MILVUS_ASAN_LIB}:${MILVUS_JEMALLOC_LIB}
+ENV TSAN_OPTIONS=${MILVUS_TSAN_OPTIONS}
+ENV OMP_TOOL_LIBRARIES=${MILVUS_ARCHER_LIB}
 ENV MALLOC_CONF=background_thread:true
 ENV OPENSSL_MODULES=/milvus/lib/ossl-modules
 
```

**File**: `build/docker/milvus/ubuntu20.04/Dockerfile` (modified, +6/-1)
```diff
@@ -15,6 +15,9 @@ FROM ubuntu:focal-20240530
 
 ARG TARGETARCH
 ARG MILVUS_ASAN_LIB
+ARG MILVUS_ARCHER_LIB
+ARG MILVUS_TSAN_OPTIONS=halt_on_error=1:exitcode=66
+ARG MILVUS_JEMALLOC_LIB=/milvus/lib/libjemalloc.so
 ARG MILVUS_RUNTIME_USER=milvus:milvus
 
 COPY --from=uv /uv /usr/local/bin/uv
@@ -59,7 +62,9 @@ RUN uv --no-cache pip install --python python3.12 --system --break-system-packag
 
 ENV PATH=/milvus/bin:$PATH
 ENV LD_LIBRARY_PATH=/milvus/lib:$LD_LIBRARY_PATH:/usr/lib
-ENV LD_PRELOAD=${MILVUS_ASAN_LIB}:/milvus/lib/libjemalloc.so
+ENV LD_PRELOAD=${MILVUS_ASAN_LIB}:${MILVUS_JEMALLOC_LIB}
+ENV TSAN_OPTIONS=${MILVUS_TSAN_OPTIONS}
+ENV OMP_TOOL_LIBRARIES=${MILVUS_ARCHER_LIB}
 ENV MALLOC_CONF=background_thread:true
 
 # protobuf 5.x RepeatedField adds container annotations that trigger ASAN
```

**File**: `build/docker/milvus/ubuntu22.04/Dockerfile` (modified, +6/-1)
```diff
@@ -15,6 +15,9 @@ FROM ubuntu:jammy-20240530
 
 ARG TARGETARCH
 ARG MILVUS_ASAN_LIB
+ARG MILVUS_ARCHER_LIB
+ARG MILVUS_TSAN_OPTIONS=halt_on_error=1:exitcode=66
+ARG MILVUS_JEMALLOC_LIB=/milvus/lib/libjemalloc.so
 ARG MILVUS_RUNTIME_USER=milvus:milvus
 
 COPY --from=uv /uv /usr/local/bin/uv
@@ -59,7 +62,9 @@ RUN uv --no-cache pip install --python python3.12 --system --break-system-packag
 
 ENV PATH=/milvus/bin:$PATH
 ENV LD_LIBRARY_PATH=/milvus/lib:$LD_LIBRARY_PATH:/usr/lib
-ENV LD_PRELOAD=${MILVUS_ASAN_LIB}:/milvus/lib/libjemalloc.so
+ENV LD_PRELOAD=${MILVUS_ASAN_LIB}:${MILVUS_JEMALLOC_LIB}
+ENV TSAN_OPTIONS=${MILVUS_TSAN_OPTIONS}
+ENV OMP_TOOL_LIBRARIES=${MILVUS_ARCHER_LIB}
 ENV MALLOC_CONF=background_thread:true
 ENV OPENSSL_MODULES=/milvus/lib/ossl-modules
 
```

**File**: `docs/design-docs/design_docs/20260928-native-thread-sanitizer.md` (added, +246/-0)
```diff
@@ -0,0 +1,246 @@
+# MEP: Native ThreadSanitizer builds with LLVM Archer
+
+- **Created:** 2026-09-28
+- **Author(s):** @zhuwenxing
+- **Status:** Under Review
+- **Component:** Other (native build and test infrastructure)
+- **Related Issues:** #53763
+
+## Summary
+
+`USE_TSAN` is an opt-in CMake option for 64-bit Linux CPU builds with LLVM 20 (Clang, compiler-rt,
+libomp and Archer). It instruments Milvus C/C++ targets and CMake source dependencies with
+`-fsanitize=thread`, debug information, and frame pointers. It is independent of
+`BUILD_UNIT_TEST` and defaults to `OFF`. ASan and TSan cannot be combined.
+
+This is a native-code diagnostic build, not a claim of whole-process race
+coverage. Go `-race` is a separate build. Stable Rust/Cargo builds and ordinary
+prebuilt Conan packages do not become instrumented when this option is enabled.
+GPU builds are rejected. Runtime compatibility and dependency coverage must be
+validated for the particular compiler, container, and dependency versions used.
+
+## Motivation
+
+Native concurrency investigations currently require manual sanitizer flags,
+dependency rebuilds and OpenMP synchronization controls. A repeatable build
+must expose application races without treating invisible OpenMP synchronization
+as a missing lock. The build also needs to preserve symbols and runtime
+compatibility when artifacts move from a compiler environment into an image.
+
+## Public Interfaces
+
+The existing build entry points propagate the option:
+
+```bash
+make USE_TSAN=ON mode=RelWithDebInfo build-cpp-with-unittest
+make USE_TSAN=ON mode=RelWithDebInfo install
+```
+
+These are commands for the Linux build environment with LLVM 20 installed.
+`MILVUS_LLVM_ROOT` defaults to `/usr/lib/llvm-20`; the build scripts select its
+Clang drivers and fail if the compiler-rt, libomp or Archer library is absent.
+The native/cgo links use `-shared-libsan` so DSOs and the Go executable share
+one LLVM TSan runtime. The C++ ABI remains `libstdc++11`.
+
+The direct Core script accepts `-T ON`. Direct CMake users pass
+`-DUSE_TSAN=ON` along with their existing Conan toolchain, install prefix and
+other configuration arguments. Use a separate worktree/build/install tree and
+Cargo cache from ordinary or ASan builds. CMake rejects changing
+to or from TSan in a build/install tree already marked with another mode.
+For direct CMake invocation, first prepare the parser prerequisite with
+`USE_TSAN=ON bash scripts/build_plan_parser.sh`; CMake cannot change an already
+built parser wrapper.
+
+`cmake/Sanitizers.cmake` is loaded before dependency and source subdirectories.
+Its directory compile options reach the OBJECT libraries aggregated into
+`milvus_core`; flags attached only to the final shared library would not
+instrument those objects. Link options reach shared libraries and executables.
+Both C and C++ compiler/runtime links are checked during configuration.
+
+ASan flags are centralized in the same module. The Tantivy C++ helpers no longer
+implicitly enable ASan just because the build type is Debug; select `USE_ASAN`
+explicitly. TSan builds skip jemalloc and split DWARF. The handwritten parser
+wrapper build and Go/cgo compilation receive their own TSan flags.
+
+## Design Details
+
+### Conan dependency variants
+
+The standard build scripts rebuild Folly, milvus-common, libevent, oneTBB,
+GEOS and gtest with TSan by default. Synchronization in prebuilt Folly is not
+visible to TSan and can produce reports during service startup. The generated
+host profile selects Clang 20 and C++20 for Core and these six packages,
+retains the default compiler identity for other packages and build tools and makes sanitizer flags part of
+package IDs. A scoped Conan hook preserves the flags that the Folly recipe
+otherwise overwrites. The generated dependency manifest verifies native symbols
+and records package revisions and library hashes.
+
+OpenBLAS uses its pthread backend in the TSan profile. Its default GCC/Fortran
+OpenMP backend would introduce `libgomp` alongside LLVM `libomp`; pthread BLAS
+preserves parallelism without mixing OpenMP runtimes. Other Conan dependencies
+remain prebuilt. For broader native dependency
+instrumentation, opt into the provided full host profile (this broader profile
+still requires validation of each recipe):
+
+```bash
+mkdir -p cmake_build
+python3 internal/core/milvus_tsan.py profile --all > cmake_build/tsan-all.profile
+CONAN_HOST_PROFILE="$PWD/cmake_build/tsan-all.profile" \
+    make USE_TSAN=ON mode=RelWithDebInfo build-cpp-with-unittest
+```
+
+The full profile extends `default` and configures C/C++ compile flags and executable/
+shared-library link flags. It includes those settings and the sanitizer marker
+in Conan package IDs. `--build=missing` can therefore reuse TSan variants without
+silently substituting ordinary packages. Build-context tools retain the normal
+profile. A custom compiler profile must match the Core compiler and runtime.
+
+The 
```

**File**: `internal/core/CMakeLists.txt` (modified, +17/-7)
```diff
@@ -83,6 +83,8 @@ endif ()
 
 set( CMAKE_MODULE_PATH ${CMAKE_MODULE_PATH} "${CMAKE_CURRENT_SOURCE_DIR}/cmake" )
 include( Utils )
+include( DefineOptions )
+include( Sanitizers )
 
 # **************************** Build time, type and code version ****************************
 get_current_time( BUILD_TIME )
@@ -188,12 +190,11 @@ find_package(Azure REQUIRED)
 include( CTest )
 include( BuildUtils )
 include( AwsRuntime )
-include( DefineOptions )
 
 # ---- Split DWARF (Linux only) ----
 # Keep this opt-in: .dwo files stay in the build tree and are not included in
 # installed artifacts or the published debug image by default.
-if (LINUX AND MILVUS_USE_SPLIT_DWARF AND NOT USE_ASAN STREQUAL "ON")
+if (LINUX AND MILVUS_USE_SPLIT_DWARF AND NOT USE_ASAN AND NOT USE_TSAN)
     check_cxx_compiler_flag("-gsplit-dwarf" HAS_SPLIT_DWARF)
     if (HAS_SPLIT_DWARF)
         set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -gsplit-dwarf")
@@ -204,6 +205,20 @@ endif ()
 
 include( ExternalProject )
 include( GNUInstallDirs )
+foreach(_libdir lib lib64)
+    set(_sanitizer_marker "${CMAKE_INSTALL_PREFIX}/${_libdir}/milvus-sanitizer")
+    if(EXISTS "${_sanitizer_marker}")
+        file(READ "${_sanitizer_marker}" _installed_sanitizer)
+        string(STRIP "${_installed_sanitizer}" _installed_sanitizer)
+        if(NOT _installed_sanitizer STREQUAL MILVUS_SANITIZER AND
+           (_installed_sanitizer STREQUAL "thread" OR USE_TSAN))
+            message(FATAL_ERROR "Changing TSan mode requires a fresh install directory")
+        endif()
+    endif()
+endforeach()
+file(WRITE "${CMAKE_CURRENT_BINARY_DIR}/milvus-sanitizer" "${MILVUS_SANITIZER}\n")
+install(FILES "${CMAKE_CURRENT_BINARY_DIR}/milvus-sanitizer"
+        DESTINATION "${CMAKE_INSTALL_LIBDIR}")
 include( FetchContent )
 
 include_directories( thirdparty )
@@ -228,11 +243,6 @@ if (LINUX OR MSYS)
                   "-Wno-error"
                   "-Wno-all"
                   )
-    if (USE_ASAN STREQUAL "ON")
-        message( STATUS "Building Milvus Core Using AddressSanitizer")
-        add_compile_options(-fno-stack-protector -fno-omit-frame-pointer -fno-var-tracking -fsanitize=address)
-        add_link_options(-fno-stack-protector -fno-omit-frame-pointer -fno-var-tracking -fsanitize=address)
-    endif()
     if (CMAKE_BUILD_TYPE STREQUAL "Release")
         append_flags( CMAKE_CXX_FLAGS
                 "-O3"
```

#### Recent Merged Pull Requests:
- **PR #55138** (2026-11-04): fix: [3.0] release MinioChunkManager's AWS SDK reference when the process exits (@santiago-wjq)
- **PR #55131** (2026-11-04): fix: release MinioChunkManager's AWS SDK reference when the process exits (@santiago-wjq)
- **PR #55120** (2026-11-04): enhance: reduce StreamingNode metadata memory overhead (@sijie-ni-0214)
- **PR #55105** (2026-11-04): fix: count each proxy request once at boundary (@congqixia)
- **PR #55101** (2026-11-04): build(deps): upgrade AWS SDK to 1.11.921 and CRT to 0.44.3 (@jiaqizho)
- **PR #55096** (2026-11-04): fix: [cp3.0]don't blacklist a healthy delegator when the client cancels (@bigsheeper)

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

## X. release MinioChunkManager's AWS SDK reference when the process exits (#55131)

**RULE**:
When implementing operations in `internal/core/src/storage/RemoteChunkManagerSingleton.h`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in milvus-io/milvus. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `eabafc85`: release MinioChunkManager's AWS SDK reference when the process exits (#55131). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `internal/core/src/storage/RemoteChunkManagerSingleton.h`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
        // Never destroyed. The remote chunk manager lives as long as the
        // process, since Release keeps it, and a static destructor would
        // destroy its client after MinioChunkManager released the AWS SDK at
        // exit, which the SDK does not allow.
        static auto* instance = new RemoteChunkManagerSingleton();
        return *instance;
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
        static RemoteChunkManagerSingleton instance;
        return instance;
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `eabafc85` are properly handled with clean fallback behavior.
