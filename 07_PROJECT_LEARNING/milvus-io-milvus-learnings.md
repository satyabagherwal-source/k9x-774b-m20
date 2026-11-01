> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/milvus-io-milvus-learnings.md`  
> **Source**: github ([https://github.com/milvus-io/milvus](https://github.com/milvus-io/milvus))  
> **Source Version**: `5f7e1124`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-31T22:31:27.104Z  
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
> **Harvest Timestamp**: 2026-10-31T22:31:26.431Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `milvus-io/milvus`
- **Description**: Milvus is a high-performance, cloud-native vector database built for scalable vector ANN search
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 46542 stars

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
- **Issue #54939** (2026-10-31): **feat: prototype independent MultiSearch requests through Proxy**
  *Symptoms*: > Superseded by #54940, which implements the actual `MilvusService.MultiSearch` RPC and `MilvusClient.multi_search()` across databases, with v3.0.5 standalone/Kubernetes tests and CPU-contention measurements. This earlier separate-service/adapter prototype is retained for history and is no longer the proposed implementation.  ## What this prototype demonstrates  A retrieval stage can need dozens of independent searches across collections with different schemas, vector dimensions, metrics, filters, and topK values. Today the client has to orchestrate those calls. This prototype adds **MultiSearch**: one external RPC carrying a bag of complete `SearchRequest` messages, with Proxy executing each item through the ordinary Search entry path and returning separate outcomes.  The purpose of this draft is to demonstrate feasibility with running code and reproducible evidence, and to support an API/Proxy design discussion. It is not proposed as a production-ready API release.  issue: #41791  **[Design document](https://github.com/codingjaguar/milvus/blob/09ce1f9022bbe9eac7b2900047849b7e51eedfc9/docs/design-docs/multisearch.md) · [Engineering report (PDF)](https://github.com/codingjaguar/milvus/blob/09ce1f9022bbe9eac7b2900047849b7e51eedfc9/artifacts/multisearch-prototype-report.pdf) · [HTML report](https://github.com/codingjaguar/milvus/blob/09ce1f9022bbe9eac7b2900047849b7e51eedfc9/artifacts/multisearch-prototype-report.html) · [Build, test, and deployment instructions](https://github.
  **Post-Mortem & Fix Analysis**:
  > [APPROVALNOTIFIER] This PR is **NOT APPROVED**  This pull-request has been approved by: To complete the [pull request process](https://git.k8s.io/community/contributors/guide/owners.md#the-code-review-process), please assign **liliu-z** after the PR has been reviewed. You can assign the PR to them by writing `/assign @liliu-z` in a comment when ready.  The full list of commands accepted by this bot can be found [here](https://go.k8s.io/bot-commands?repo=milvus-io%2Fmilvus).  <details open> Needs approval from an approver in each of these files:  - **[OWNERS](https://github.com/milvus-io/milvus/blob/master/OWNERS)**  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":["liliu-z"]} -->
  > @codingjaguar This is a feature PR (`feat:`). Please provide a design document.  **How to resolve:** Add a design document under `docs/design-docs/design_docs/` in this PR, or link an existing in-repo design document in the PR description: ``` design doc: docs/design-docs/design_docs/YYYYMMDD-your_design.md ``` 

- **Issue #54936** (2026-10-31): **fix(ci): stop macOS Conan recipe auto-updates**
  *Symptoms*: ## Summary - Stop automatic Conan recipe updates on macOS, matching the Linux CI install policy. - Remove only the known-incompatible cached aws-c-event-stream/0.7.1 recipe revision left by the old update behavior.  ## Incident The master macOS checker failed from build #159 onward after Conan Center recipe revision 7efb08d7203c90891cc0a2a36d38f4ce introduced aws-c-common/0.14.5 while the SDK graph uses 0.14.0. The internal Conan remote carries a compatible revision.  ## Validation - bash -n scripts/3rdparty_build.sh - git diff --check - Isolated Conan 2.25.1 macOS arm64 graph: 134 nodes resolved with internal recipe revision 2cff773a69a926fe775dfe21f6c15650. - Importing the incompatible revision reproduces the exact 0.14.5 versus 0.14.0 conflict; removing only that revision restores graph resolution. - Production Jenkins Mac build remains to be verified after merge.

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

### Incident Patch 1: `059b8466` (2026-10-31)
**Commit Message**: fix: map every available collection to its DB in QuotaCenter (#54890)

issue: #54858

## What

- Build the collection-to-database mapping from the same RootCoord
metadata snapshot as the limiter tree, so WAL lag protection also
reaches unloaded or unflushed collections.
- Remove redundant `collectionIDToDBID` writes from `collectMetrics`,
leaving metadata as the single source for this mapping.
- Preserve collection identity in quota-state metrics by falling back to
`collection_id_<id>` when node metrics do not provide a collection name.

This is an independent implementation and does not modify #54859.

## Test

- [x] Focused RED/GREEN RootCoord regression tests
  - `TestQuotaCenterDeniesWritingToWALLaggingCollectionWithoutMetrics`
  - `TestQuotaCenterRecordMetricsFallsBackToCollectionID`
- [x] Formatting and diff checks
- [ ] Full RootCoord package suite: the changed tests pass, but the
suite is currently blocked by the unrelated existing
`TestBroadcastCreateCollectionV1RollbackFileResourcesWhenTaskNotCreated`
failure. The same test fails on master commit `822665400f` with the same
unmet `DecFileResourceRefCnt` mock expectation.

Signed-off-by: MrPresent-Han <[REDACTED_EMAIL]>
Co-

**File**: `internal/rootcoord/quota_center.go` (modified, +15/-6)
```diff
@@ -459,7 +459,6 @@ func (q *QuotaCenter) collectMetrics() error {
 			}
 			collIDToPartIDs[collectionID] = append(collIDToPartIDs[collectionID],
 				lo.Map(coll.Partitions, func(part *model.Partition, _ int) int64 { return part.PartitionID })...)
-			q.collectionIDToDBID.Insert(collectionID, coll.DBID)
 			q.collections.Insert(FormatCollectionKey(coll.DBID, coll.Name), collectionID)
 			if numEntity, ok := numEntitiesLoaded[collectionID]; ok {
 				metrics.RootCoordNumEntities.WithLabelValues(coll.DBName, coll.Name, metrics.LoadedLabel).Set(float64(numEntity))
@@ -516,7 +515,6 @@ func (q *QuotaCenter) collectMetrics() error {
 			}
 			collIDToPartIDs[collectionID] = append(collIDToPartIDs[collectionID],
 				lo.Map(coll.Partitions, func(part *model.Partition, _ int) int64 { return part.PartitionID })...)
-			q.collectionIDToDBID.Insert(collectionID, coll.DBID)
 			q.collections.Insert(FormatCollectionKey(coll.DBID, coll.Name), collectionID)
 			if collectionMetrics == nil {
 				return true
@@ -540,16 +538,14 @@ func (q *QuotaCenter) collectMetrics() error {
 		})
 
 		for _, collectionID := range datacoordQuotaCollections {
-			_, ok := q.collectionIDToDBID.Get(collectionID)
-			if ok {
+			if collections.Contain(collectionID) {
 				continue
 			}
 			coll, getErr := q.meta.GetCollectionByIDWithMaxTs(context.TODO(), collectionID)
 			if getErr != nil {
 				// skip limit check if the collection meta has been removed from rootcoord meta
 				continue
 			}
-			q.collectionIDToDBID.Insert(collectionID, coll.DBID)
 			q.collections.Insert(FormatCollectionKey(coll.DBID, coll.Name), collectionID)
 		}
 
@@ -1413,6 +1409,14 @@ func (q *QuotaCenter) resetAllCurrentRates() error {
 		}
 	}
 	partitions := q.meta.ListAllAvailPartitions(q.ctx)
+	// Build the collection-to-DB mapping from the same metadata snapshot as the
+	// limiter tree. Node metrics omit unloaded or unflushed collections, while
+	// WAL lag protection still covers every collection on a pchannel.
+	for dbID, collections := range partitions {
+		for collectionID := range collections {
+			q.collectionIDToDBID.Insert(collectionID, dbID)
+		}
+	}
 	initLimiters(partitions)
 	return nil
 }
@@ -1714,7 +1718,12 @@ func (q *QuotaCenter) recordMetrics() {
 				case internalpb.RateScope_Database:
 					name = "db_" + dbIDs[node.GetID()]
 				case internalpb.RateScope_Collection:
-					name = "collection_" + collectionIDs[node.GetID()]
+					collectionID := node.GetID()
+					if collectionName, ok := collectionIDs[collectionID]; ok {
+						name = "collection_" + collectionName
+					} else {
+						name = "collection_id_" + strconv.FormatInt(collectionID, 10)
+					}
 				default:
 					return false
 				}
```

**File**: `internal/rootcoord/quota_center_test.go` (modified, +89/-0)
```diff
@@ -25,21 +25,25 @@ import (
 	"time"
 
 	"github.com/cockroachdb/errors"
+	"github.com/prometheus/client_golang/prometheus/testutil"
 	"github.com/samber/lo"
 	"github.com/stretchr/testify/assert"
 	"github.com/stretchr/testify/mock"
+	"github.com/stretchr/testify/require"
 	"github.com/stretchr/testify/suite"
 
 	"github.com/milvus-io/milvus-proto/go-api/v3/commonpb"
 	"github.com/milvus-io/milvus-proto/go-api/v3/milvuspb"
 	"github.com/milvus-io/milvus/internal/metastore/model"
 	"github.com/milvus-io/milvus/internal/mocks"
 	mockrootcoord "github.com/milvus-io/milvus/internal/rootcoord/mocks"
+	"github.com/milvus-io/milvus/internal/streamingcoord/server/balancer/channel"
 	"github.com/milvus-io/milvus/internal/util/proxyutil"
 	rlinternal "github.com/milvus-io/milvus/internal/util/ratelimitutil"
 	"github.com/milvus-io/milvus/pkg/v3/common"
 	"github.com/milvus-io/milvus/pkg/v3/metrics"
 	"github.com/milvus-io/milvus/pkg/v3/proto/internalpb"
+	"github.com/milvus-io/milvus/pkg/v3/streaming/util/types"
 	"github.com/milvus-io/milvus/pkg/v3/util/merr"
 	"github.com/milvus-io/milvus/pkg/v3/util/metricsinfo"
 	"github.com/milvus-io/milvus/pkg/v3/util/paramtable"
@@ -1074,6 +1078,91 @@ func TestQuotaCenter(t *testing.T) {
 	})
 }
 
+// A collection that is neither loaded nor has a healthy segment is named by no
+// node metric, but the WAL lag check still covers it through its pchannel. Its
+// DB must come from RootCoord meta, or the write deny is never applied to it.
+func TestQuotaCenterDeniesWritingToWALLaggingCollectionWithoutMetrics(t *testing.T) {
+	paramtable.Init()
+	for key, value := range map[string]string{
+		Params.QuotaConfig.DMLLimitEnabled.Key:     "true",
+		Params.QuotaConfig.TtProtectionEnabled.Key: "true",
+		Params.QuotaConfig.MaxTimeTickDelay.Key:    "10.0",
+		Params.QuotaConfig.ForceDenyWriting.Key:    "false",
+	} {
+		paramtable.Get().Save(key, value)
+		defer paramtable.Get().Reset(key)
+	}
+
+	const (
+		dbID         = int64(1)
+		collectionID = int64(100)
+		pchannel     = "quota-dml_0"
+	)
+	channel.ResetStaticPChannelStatsManager()
+	channel.RecoverPChannelStatsManager([]string{fmt.Sprintf("%s_%dv0", pchannel, collectionID)})
+	t.Cleanup(channel.ResetStaticPChannelStatsManager)
+
+	meta := mockrootcoord.NewIMetaTable(t)
+	meta.EXPECT().ListAllAvailPartitions(mock.Anything).Return(map[int64]map[int64][]int64{
+		dbID: {collectionID: {1000}},
+	})
+	meta.EXPECT().GetCollectionByIDWithMaxTs(mock.Anything, collectionID).
+		Return(&model.Collection{CollectionID: collectionID, DBID: dbID}, nil).Maybe()
+	meta.EXPECT().GetDatabaseByID(mock.Anything, mock.Anything, mock.Anything).Return(nil, merr.ErrDatabaseNotFound).Maybe()
+
+	alloc := newMockTsoAllocator()
+	walTimeTick := tsoutil.ComposeTSByTime(time.Now())
+	alloc.GenerateTSOF = func(count uint32) (typeutil.Timestamp, error) {
+		return tsoutil.ComposeTSByTime(time.Now().Add(time.Minute)), nil
+	}
+	quotaCenter := NewQuotaCenter(proxyutil.NewMockProxyClientManager(t), mocks.NewMixCoord(t), alloc, meta)
+	// Only a streaming node reports, and only its WAL lag: no collection IDs.
+	quotaCenter.queryNodeMetrics = map[UniqueID]*metricsinfo.QueryNodeQuotaMetrics{
+		1: {StreamingQuota: &metricsinfo.StreamingQuotaMetrics{WALs: []metricsinfo.WALMetrics{
+			{Channel: types.ChannelID{Name: pchannel}, RecoveryTimeTick: walTimeTick},
+		}}},
+	}
+
+	require.NoError(t, quotaCenter.resetAllCurrentRates())
+	gotDBID, ok := quotaCenter.collectionIDToDBID.Get(collectionID)
+	require.True(t, ok)
+	assert.Equal(t, dbID, gotDBID)
+
+	require.NoError(t, quotaCenter.calculateWriteRates())
+	limiter := quotaCenter.rateLimiter.GetCollectionLimiters(dbID, collectionID)
+	require.NotNil(t, limiter)
+	state, ok := limiter.GetQuotaStates().Get(milvuspb.QuotaState_DenyToWrite)
+	require.True(t, ok)
+	assert.Equal(t, commonpb.ErrorCode_TimeTickLongDelay, state.ErrorCode)
+}
+
+func TestQuotaCenterRecordMetricsFallsBackToCollectionID(t *testing.T) {
+	paramtable.Init()
+
+	const (
+		dbID         = int64(1)
+		collectionID = int64(100)
+	)
+	meta := mockrootcoord.NewIMetaTable(t)
+	meta.EXPECT().ListAllAvailPartitions(mock.Anything).Return(map[int64]map[int64][]int64{
+		dbID: {collectionID: nil},
+	})
+	meta.EXPECT().GetCollectionByIDWithMaxTs(mock.Anything, collectionID).
+		Return(&model.Collection{CollectionID: collectionID, DBID: dbID}, nil).Maybe()
+
+	quotaCenter := NewQuotaCenter(proxyutil.NewMockProxyClientManager(t), mocks.NewMixCoord(t), newMockTsoAllocator(), meta)
+	require.NoError(t, quotaCenter.resetAllCurrentRates())
+	limiter := quotaCenter.rateLimiter.GetCollectionLimiters(dbID, collectionID)
+	require.NotNil(t, limiter)
+	limiter.GetQuotaStates().Insert(milvuspb.QuotaState_DenyToWrite, &rlinternal.QuotaStateInfo{
+		ErrorCode: commonpb.ErrorCode_TimeTickLongDelay,
+	})
+
+	quotaCenter.recordMetrics()
+	assert.Equal(t, 1.0, testutil.ToFloat64(metrics.RootCoordQuotaStates.WithLabelValues(
+		commonpb.ErrorCode_TimeTickLongDelay.String(), "col
```

---

### Incident Patch 2: `5f7e1124` (2026-10-31)
**Commit Message**: fix: build JSON indexes over valid rows with empty bytes and reject invalid JSON on write (#54898)

issue: #54868

Takes over #54873 (its commit is kept) and fixes the crash it introduced
in JSON ARRAY indexes on HYBRID / STL_SORT: rows whose path is absent or
holds an empty array read an unset document, a SIGSEGV in
`ArrayProjectedMaterializer::Add`. `Locate` now always returns the
`dom_doc()` result; a valid row with empty bytes keeps its error, which
`ExtractArray` treats as no array.
`ArrayCastsSelectBitmapAndSortWithParentRows` gains an empty-bytes row.

C++ unit tests were not run locally.

---------

Signed-off-by: xiaofanluan <[REDACTED_EMAIL]>
Signed-off-by: sunby <[REDACTED_EMAIL]>
Signed-off-by: Li Liu <[REDACTED_EMAIL]>
Co-authored-by: xiaofanluan <[REDACTED_EMAIL]>
Co-authored-by: Li Liu <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `internal/core/src/common/JsonUtils.cpp` (modified, +9/-0)
```diff
@@ -80,4 +80,13 @@ path_exists(const simdjson::dom::element& root,
     }
     return true;
 }
+
+bool
+path_exists(const simdjson::simdjson_result<simdjson::dom::element>& root,
+            const std::vector<std::string>& tokens) {
+    if (root.error() != simdjson::SUCCESS) {
+        return false;
+    }
+    return path_exists(root.value_unsafe(), tokens);
+}
 }  // namespace milvus
```

**File**: `internal/core/src/common/JsonUtils.h` (modified, +8/-0)
```diff
@@ -25,4 +25,12 @@ parse_json_pointer(const std::string& pointer);
 bool
 path_exists(const simdjson::dom::element& root,
             const std::vector<std::string>& tokens);
+
+// Check if a JSON Pointer path exists in the result of Json::dom_doc(). A
+// valid row whose stored bytes are empty has no document (dom_doc() returns an
+// error result instead of throwing), so no path exists in it. Taking the result
+// keeps callers from converting it to an element, which would throw.
+bool
+path_exists(const simdjson::simdjson_result<simdjson::dom::element>& root,
+            const std::vector<std::string>& tokens);
 }  // namespace milvus
\ No newline at end of file
```

**File**: `internal/core/src/index/scalar/json/JsonFlatIndexBuilder.cpp` (modified, +3/-7)
```diff
@@ -244,11 +244,6 @@ JsonFlatIndexBuilder::AddBatch(
         }
 
         const auto raw = batch.values[i];
-        if (raw.empty()) {
-            ThrowInfo(DataFormatBroken,
-                      "JSON flat input at offset {} is empty",
-                      offset);
-        }
         if (raw.find('\0') != std::string_view::npos) {
             ThrowInfo(DataFormatBroken,
                       "JSON flat input at offset {} contains an embedded "
@@ -260,9 +255,10 @@ JsonFlatIndexBuilder::AddBatch(
 
         // Parsing happens before the writer sees this row. The reusable
         // scratch owns the padded bytes; Json borrows them only across the
-        // synchronous parse and FFI call. No caller view is retained.
+        // synchronous parse and FFI call. No caller view is retained. A valid
+        // row with empty bytes has no document, so no path exists in it.
         auto dom = document.dom_doc();
-        const bool exists = path_exists(dom.value(), path_tokens_) &&
+        const bool exists = path_exists(dom, path_tokens_) &&
                             document.exist(params_.nested_path);
         if (!exists) {
             AddEmptyDocument(*engine_, offset);
```

**File**: `internal/core/src/index/scalar/json/JsonProjectedHybridIndexBuilderTest.cpp` (modified, +9/-4)
```diff
@@ -272,7 +272,7 @@ CheckProjectedArrayIndexes(std::string_view type_name,
                         dynamic_cast<const INullReader*>(resolved.get());
                     ASSERT_NE(nulls, nullptr);
                     ExpectHits(nulls->IsNotNull(), raw.size(), {0, 1, 2, 6, 7});
-                    ExpectHits(nulls->IsNull(), raw.size(), {3, 4, 5});
+                    ExpectHits(nulls->IsNull(), raw.size(), {3, 4, 5, 8});
                     ExpectHits(
                         predicate->NotIn(1, &first), raw.size(), {1, 2, 7});
                 }
@@ -283,6 +283,8 @@ CheckProjectedArrayIndexes(std::string_view type_name,
 
 TEST(JsonProjectedHybridIndexBuilderTest,
      ArrayCastsSelectBitmapAndSortWithParentRows) {
+    // The last row is valid but its stored bytes are empty: it has no
+    // document, so no array either.
     CheckProjectedArrayIndexes<bool>("Bool",
                                      DataType::BOOL,
                                      "ARRAY_BOOL",
@@ -293,7 +295,8 @@ TEST(JsonProjectedHybridIndexBuilderTest,
                                       R"({"a":null})",
                                       R"({"a":3})",
                                       R"({"a":[false,3,"ignored",null,{}]})",
-                                      R"({"a":[null,{},[]]})"},
+                                      R"({"a":[null,{},[]]})",
+                                      ""},
                                      false,
                                      true);
     CheckProjectedArrayIndexes<double>(
@@ -307,7 +310,8 @@ TEST(JsonProjectedHybridIndexBuilderTest,
          R"({"a":null})",
          R"({"a":true})",
          R"({"a":[1.0,false,"ignored",null,{}]})",
-         R"({"a":[null,{},[]]})"},
+         R"({"a":[null,{},[]]})",
+         ""},
         1,
         100);
     CheckProjectedArrayIndexes<std::string_view>(
@@ -321,7 +325,8 @@ TEST(JsonProjectedHybridIndexBuilderTest,
          R"({"a":null})",
          R"({"a":true})",
          R"({"a":["a",false,3,null,{}]})",
-         R"({"a":[null,{},[]]})"},
+         R"({"a":[null,{},[]]})",
+         ""},
         "a",
         "z");
 }
```

**File**: `internal/core/src/indexbuilder/JsonBuildMaterializer.cpp` (modified, +7/-8)
```diff
@@ -238,14 +238,12 @@ RowPresence
 Locate(const JsonBatch& batch,
        size_t row,
        const ProjectionParams& params,
-       simdjson::dom::element& root) {
+       value_result<simdjson::dom::element>& root) {
     if (!batch.IsValid(row))
         return RowPresence::FieldNull;
     const auto& document = batch.Document(row);
-    AssertInfo(!document.data().empty(),
-               "valid JSON row {} has an empty document",
-               row);
-    root = document.dom_doc().value();
+    // A valid row with empty bytes has no document, so no path exists in it.
+    root = document.dom_doc();
     if (!path_exists(root, params.path_tokens) ||
         !document.exist(params.json_path)) {
         return RowPresence::NoValue;
@@ -255,7 +253,7 @@ Locate(const JsonBatch& batch,
 
 RowPresence
 Locate(const JsonBatch& batch, size_t row, const ProjectionParams& params) {
-    simdjson::dom::element root;
+    value_result<simdjson::dom::element> root;
     return Locate(batch, row, params, root);
 }
 
@@ -628,7 +626,7 @@ class ArrayProjectedMaterializer final : public ProjectedBase<ArrayView> {
             std::vector<size_t> non_exist;
             for (size_t i = 0; i < count; ++i) {
                 const auto row = begin + i;
-                simdjson::dom::element root;
+                value_result<simdjson::dom::element> root;
                 const auto presence = Locate(source, row, Params(), root);
                 batch->validity[i] = presence != RowPresence::FieldNull;
                 if (presence != RowPresence::Present)
@@ -664,7 +662,8 @@ class ArrayProjectedMaterializer final : public ProjectedBase<ArrayView> {
 
  private:
     bool
-    ExtractArray(const simdjson::dom::element& root, Row& row) const {
+    ExtractArray(const value_result<simdjson::dom::element>& root,
+                 Row& row) const {
         auto array = root.at_pointer(Params().json_path).get_array();
         if (array.error() != simdjson::SUCCESS)
             return false;
```

**File**: `internal/core/src/indexbuilder/ScalarBuildSessionTest.cpp` (modified, +96/-3)
```diff
@@ -9,6 +9,7 @@
 // is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
 // or implied. See the License for the specific language governing permissions and limitations under the License
 
+#include <arrow/builder.h>
 #include <gtest/gtest.h>
 
 #include <array>
@@ -117,10 +118,14 @@ class ScalarBuildSessionTest : public ::testing::Test {
         const auto resolved_family =
             index::ResolvePackedLoadFamily(family, source.Metadata(), params);
         // Cold-load planning annotates typed JSON completeness, as the sealed
-        // index translator does before opening the reader.
+        // index translator does before opening the reader. A JSON flat index
+        // is not a typed projection, so the translator skips it.
         storage::LoadOptions options;
-        options.params = index::AnnotateJsonProjectionCompleteness(
-            params, source.Directory(), source.Metadata());
+        options.params = params;
+        if (family != index::families::kJsonFlat) {
+            options.params = index::AnnotateJsonProjectionCompleteness(
+                params, source.Directory(), source.Metadata());
+        }
         return index::LoaderRegistry::Instance()
             .Lookup(resolved_family)
             .Load({index::OpenedIndexSource{std::move(source)},
@@ -513,5 +518,93 @@ TEST_F(ScalarBuildSessionTest, NgramJsonIndexOnFieldRoot) {
     }
 }
 
+// Older clients could store a valid nullable JSON row whose bytes are empty.
+// Such a row has no document: every JSON index must still build and treat it
+// as a row where no path exists, distinct from a null row.
+TEST_F(ScalarBuildSessionTest, JsonIndexBuildsWithEmptyValidDocument) {
+    constexpr int64_t rows = 12;
+    constexpr int64_t empty_row = 0;
+    constexpr int64_t null_row = 1;
+    arrow::BinaryBuilder builder;
+    for (int64_t row = 0; row < rows; ++row) {
+        arrow::Status status;
+        if (row == empty_row) {
+            status = builder.Append("");
+        } else if (row == null_row) {
+            status = builder.AppendNull();
+        } else if (row % 2 == 0) {
+            status = builder.Append("{\"a\":" + std::to_string(row) + "}");
+        } else {
+            status = builder.Append("\"apple " + std::to_string(row) + "\"");
+        }
+        ASSERT_TRUE(status.ok()) << status.ToString();
+    }
+    std::shared_ptr<arrow::Array> array;
+    ASSERT_TRUE(builder.Finish(&array).ok());
+
+    struct Case {
+        const char* index_type;
+        const char* cast;
+        const char* path;
+    };
+    for (const auto& [index_type, cast, path] :
+         {Case{index::INVERTED_INDEX_TYPE, "JSON", ""},
+          Case{index::INVERTED_INDEX_TYPE, "DOUBLE", "/a"},
+          Case{index::ASCENDING_SORT, "DOUBLE", "/a"},
+          Case{index::NGRAM_INDEX_TYPE, "VARCHAR", ""}}) {
+        SCOPED_TRACE(::testing::Message()
+                     << index_type << "/" << cast << "/" << path);
+        auto info = Info(DataType::JSON, index_type);
+        info.set_num_rows(rows);
+        info.mutable_field_schema()->set_nullable(true);
+        std::vector<std::pair<std::string, std::string>> params{
+            {JSON_CAST_TYPE, cast}, {JSON_PATH, path}};
+        if (std::string_view(index_type) == index::NGRAM_INDEX_TYPE) {
+            params.emplace_back(index::MIN_GRAM, "2");
+            params.emplace_back(index::MAX_GRAM, "3");
+        }
+        for (const auto& [key, value] : params) {
+            auto* param = info.add_index_params();
+            param->set_key(key);
+            param->set_value(value);
+        }
+        auto prepared = AdaptBuildIndexInfo(info, BuildPurpose::ScalarIndex);
+        auto data = std::make_shared<FieldData<Json>>(DataType::JSON, true);
+        data->FillFieldData(array);
+        ASSERT_EQ(data->get_null_count(), 1);
+        info.add_insert_files(WriteBinlog(prepared.file_manager_context, data));
+        prepared = AdaptBuildIndexInfo(info, BuildPurpose::ScalarIndex);
+        auto reader = BuildAndLoad(std::move(prepared));
+        ASSERT_NE(reader, nullptr);
+        EXPECT_EQ(reader->Count(), rows);
+        const auto* json =
+            dynamic_cast<const index::IJsonIndexReader*>(reader.get());
+        ASSERT_NE(json, nullptr);
+        const auto exists = json->Exists(path);
+        ASSERT_EQ(exists.size(), rows);
+        EXPECT_FALSE(exists[empty_row]);
+        EXPECT_FALSE(exists[null_row]);
+        if (std::string_view(path) == "/a") {
+            // Only the even object rows from 2 on carry "a".
+            EXPECT_EQ(exists.count(), rows / 2 - 1);
+            const auto resolved =
+                json->Resolve(path, JsonCastType::FromString(cast));
+            ASSERT_TRUE(static_cast<bool>(resolved));
+            const auto* predicate =
+                dynamic_cast<const index::IScalarPredicateReader<double>*>(
+                    resolved.get());
+            ASSERT_NE(predicate
```

**File**: `internal/proxy/dml/task_upsert.go` (modified, +19/-1)
```diff
@@ -1877,7 +1877,25 @@ func (it *UpsertTask) insertPreExecute(ctx context.Context) error {
 		}
 	}
 
-	if err := fieldvalidator.NewValidateUtil(fieldvalidator.WithNANCheck(), fieldvalidator.WithOverflowCheck(), fieldvalidator.WithMaxLenCheck(), fieldvalidator.WithMaxCapCheck()).
+	validateOpts := []fieldvalidator.ValidateOption{fieldvalidator.WithNANCheck(), fieldvalidator.WithOverflowCheck(), fieldvalidator.WithMaxLenCheck(), fieldvalidator.WithMaxCapCheck()}
+	if it.req.GetPartialUpdate() {
+		// The merge filled the fields the request omits from the stored rows.
+		// A request may name the dynamic field "" (REST does); it is $meta here.
+		requested := typeutil.NewSet(lo.Map(it.partialUpdateOriginalFields, func(f *schemapb.FieldData, _ int) string {
+			if f.GetIsDynamic() {
+				return common.MetaFieldName
+			}
+			return f.GetFieldName()
+		})...)
+		var stored []string
+		for _, f := range it.upsertMsg.InsertMsg.GetFieldsData() {
+			if !requested.Contain(f.GetFieldName()) {
+				stored = append(stored, f.GetFieldName())
+			}
+		}
+		validateOpts = append(validateOpts, fieldvalidator.WithStoredFields(stored...))
+	}
+	if err := fieldvalidator.NewValidateUtil(validateOpts...).
 		Validate(it.upsertMsg.InsertMsg.GetFieldsData(), it.schema.SchemaHelper, it.upsertMsg.InsertMsg.NRows()); err != nil {
 		return err
 	}
```

**File**: `internal/proxy/dml/task_upsert_json_stored_test.go` (added, +170/-0)
```diff
@@ -0,0 +1,170 @@
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
+package dml
+
+import (
+	"context"
+	"testing"
+
+	"github.com/bytedance/mockey"
+	"github.com/stretchr/testify/require"
+
+	"github.com/milvus-io/milvus-proto/go-api/v3/milvuspb"
+	"github.com/milvus-io/milvus-proto/go-api/v3/msgpb"
+	"github.com/milvus-io/milvus-proto/go-api/v3/schemapb"
+	"github.com/milvus-io/milvus/internal/allocator"
+	"github.com/milvus-io/milvus/internal/distributed/streaming"
+	"github.com/milvus-io/milvus/internal/util/segcore"
+	"github.com/milvus-io/milvus/pkg/v3/common"
+	"github.com/milvus-io/milvus/pkg/v3/mq/msgstream"
+	"github.com/milvus-io/milvus/pkg/v3/util/commonpbutil"
+	"github.com/milvus-io/milvus/pkg/v3/util/merr"
+	"github.com/milvus-io/milvus/pkg/v3/util/typeutil"
+)
+
+func partialUpdateJSONTestFieldData(rows [][]byte) *schemapb.FieldData {
+	return &schemapb.FieldData{
+		FieldName: "meta", FieldId: 102, Type: schemapb.DataType_JSON,
+		Field: &schemapb.FieldData_Scalars{Scalars: &schemapb.ScalarField{Data: &schemapb.ScalarField_JsonData{JsonData: &schemapb.JSONArray{Data: rows}}}},
+	}
+}
+
+func partialUpdateValueTestFieldData(rows []int32) *schemapb.FieldData {
+	return &schemapb.FieldData{
+		FieldName: "value", FieldId: 101, Type: schemapb.DataType_Int32,
+		Field: &schemapb.FieldData_Scalars{Scalars: &schemapb.ScalarField{Data: &schemapb.ScalarField_IntData{IntData: &schemapb.IntArray{Data: rows}}}},
+	}
+}
+
+// partialUpdateJSONTestTask builds a two-row partial upsert over a schema with
+// a non-nullable JSON field; requestFields are the fields after the PK that the
+// request itself carries.
+func partialUpdateJSONTestTask(t *testing.T, requestFields ...*schemapb.FieldData) *UpsertTask {
+	t.Helper()
+	pk := partialUpdateCASPKFieldData([]int64{1, 2})
+	pk.FieldName = "id"
+	pk.FieldId = 100
+	schema := mustNewSchemaInfo(&schemapb.CollectionSchema{
+		Name: "test_partial_update_stored_json",
+		Fields: []*schemapb.FieldSchema{
+			{FieldID: 100, Name: "id", IsPrimaryKey: true, DataType: schemapb.DataType_Int64},
+			{FieldID: 101, Name: "value", DataType: schemapb.DataType_Int32},
+			{FieldID: 102, Name: "meta", DataType: schemapb.DataType_JSON},
+		},
+	})
+	fields := append([]*schemapb.FieldData{pk}, requestFields...)
+	task := &UpsertTask{
+		baseTask: baseTask{MetaCache: newTestCache()},
+		ctx:      context.Background(), schema: schema, idAllocator: &allocator.IDAllocator{}, collectionID: 100,
+		req: &milvuspb.UpsertRequest{Base: commonpbutil.NewMsgBase(), FieldsData: fields, NumRows: 2, PartialUpdate: true, CollectionName: schema.GetName()},
+		upsertMsg: &msgstream.UpsertMsg{
+			InsertMsg: &msgstream.InsertMsg{InsertRequest: &msgpb.InsertRequest{
+				Base:           commonpbutil.NewMsgBase(),
+				CollectionName: schema.GetName(), CollectionID: 100, PartitionName: "_default",
+				FieldsData: fields, NumRows: 2, Version: msgpb.InsertDataVersion_ColumnBased,
+			}},
+			DeleteMsg: &msgstream.DeleteMsg{DeleteRequest: &msgpb.DeleteRequest{Base: commonpbutil.NewMsgBase(), CollectionName: schema.GetName(), CollectionID: 100, PartitionName: "_default"}},
+		},
+		node: &mockUpsertNode{}, result: &milvuspb.MutationResult{},
+		partialUpdateOriginalFields: cloneFieldDataList(fields),
+	}
+	task.SetTs(12345)
+	setPartialUpdateCASTestChannels(task, partialUpdateCASTestVChannels)
+	return task
+}
+
+// A row stored before the proxy validated JSON documents may hold empty bytes.
+// A partial upsert that leaves that JSON field out must still succeed (the
+// stored row is carried over, not re-judged), while a request that itself
+// supplies empty bytes for the JSON field must be rejected.
+func TestPartialUpdateStoredInvalidJSONIsNotRejudged(t *testing.T) {
+	storedMeta := [][]byte{[]byte(`{"a":1}`), {}}
+	for _, testCase := range []struct {
+		name        string
+		request     []*schemapb.FieldData
+		wantErr     bool
+		wantMetaOut [][]byte
+	}{
+		{
+			name:        "request omits the JSON field",
+			request:     []*schemapb.FieldData{partialUpdateValueTestFieldData([]int32{100, 200})},
+			wantMetaOut: storedMeta,
+		},
+		{
+			name: "request supplies a valid JSON document",
+			request: []*schemapb.FieldData{
+				partialUpdateValueTestFi
```

---

### Incident Patch 3: `eb1bb266` (2026-10-31)
**Commit Message**: fix(ci): stop macOS Conan recipe auto-updates (#54936)

## Summary
- Stop automatic Conan recipe updates on macOS, matching the Linux CI
install policy.
- Remove only the known-incompatible cached aws-c-event-stream/0.7.1
recipe revision left by the old update behavior.

## Incident
The master macOS checker failed from build #159 onward after Conan
Center recipe revision 7efb08d7203c90891cc0a2a36d38f4ce introduced
aws-c-common/0.14.5 while the SDK graph uses 0.14.0. The internal Conan
remote carries a compatible revision.

## Validation
- bash -n scripts/3rdparty_build.sh
- git diff --check
- Isolated Conan 2.25.1 macOS arm64 graph: 134 nodes resolved with
internal recipe revision 2cff773a69a926fe775dfe21f6c15650.
- Importing the incompatible revision reproduces the exact 0.14.5 versus
0.14.0 conflict; removing only that revision restores graph resolution.
- Production Jenkins Mac build remains to be verified after merge.

Signed-off-by: Zhikun Yao <[REDACTED_EMAIL]>

**File**: `scripts/3rdparty_build.sh` (modified, +15/-1)
```diff
@@ -214,7 +214,21 @@ case "${unameOut}" in
     export CMAKE_CXX_COMPILER_LAUNCHER=ccache
     echo "Using CXX: $CXX"
     echo "Using CC: $CC"
-    CONAN_ARGS="--output-folder conan --build=missing -s build_type=${BUILD_TYPE} -s compiler=clang -s compiler.version=${llvm_version} -s compiler.libcxx=libc++ -s compiler.cppstd=20 -u"
+    # Match Linux CI: do not refresh every recipe revision during a normal build.
+    # An upstream recipe revision can change transitive requirements without a
+    # Milvus source change, making a previously valid dependency graph fail.
+    CONAN_ARGS="--output-folder conan --build=missing -s build_type=${BUILD_TYPE} -s compiler=clang -s compiler.version=${llvm_version} -s compiler.libcxx=libc++ -s compiler.cppstd=20"
+
+    # Recover caches updated by the old -u behavior. This Conan Center recipe
+    # requires aws-c-common/0.14.5, conflicting with the SDK's 0.14.0 graph.
+    # Remove only the known-bad revision; the internal remote has a compatible
+    # revision, so no unrelated Conan packages or binaries are discarded.
+    bad_event_stream_revision=7efb08d7203c90891cc0a2a36d38f4ce
+    bad_event_stream_ref="aws-c-event-stream/0.7.1#${bad_event_stream_revision}"
+    if "$CONAN" list "$bad_event_stream_ref" -c -f json | grep -Fq "\"${bad_event_stream_revision}\":"; then
+        echo "Removing incompatible cached Conan recipe: ${bad_event_stream_ref}"
+        "$CONAN" remove "$bad_event_stream_ref" --confirm
+    fi
 
     # On macOS, Conan packages with shared libraries (protobuf, grpc) produce
     # binaries (protoc, grpc_cpp_plugin) whose install rpaths don't include
```

#### Recent Merged Pull Requests:
- **PR #54939** (closed): feat: prototype independent MultiSearch requests through Proxy (@codingjaguar)
- **PR #54936** (2026-10-31): fix(ci): stop macOS Conan recipe auto-updates (@zhikunyao)
- **PR #54933** (closed): fix: return typed empty columns from PresizeAppendFieldData so empty reduced results keep the primary field (@xixi-box)
- **PR #54928** (closed): fix: return typed empty columns from PresizeAppendFieldData so empty reduced results keep the primary field (@xixi-box)
- **PR #54927** (closed): fix: keep typed empty columns when QueryNode reduce yields no rows (@czs007)
- **PR #54926** (closed): fix: [Bug]: Search with rerank/function_chain fails with 1100 "can't find data for primary field" when the result is empty and QueryNode reduces multiple sub-results (@xixi-box)

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

## X. map every available collection to its DB in QuotaCenter (#54890)

**RULE**:
When implementing operations in `internal/rootcoord/quota_center.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in milvus-io/milvus. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `059b8466`: map every available collection to its DB in QuotaCenter (#54890). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `internal/rootcoord/quota_center.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
			if collections.Contain(collectionID) {
	// Build the collection-to-DB mapping from the same metadata snapshot as the
	// limiter tree. Node metrics omit unloaded or unflushed collections, while
	// WAL lag protection still covers every collection on a pchannel.
	for dbID, collections := range partitions {
		for collectionID := range collections {
			q.collectionIDToDBID.Insert(collectionID, dbID)
		}
	}
					collectionID := node.GetID()
					if collectionName, ok := collectionIDs[collectionID]; ok {
						name = "collection_" + collectionName
					} else {
						name = "collection_id_" + strconv.FormatInt(collectionID, 10)
					}
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
			q.collectionIDToDBID.Insert(collectionID, coll.DBID)
			q.collectionIDToDBID.Insert(collectionID, coll.DBID)
			_, ok := q.collectionIDToDBID.Get(collectionID)
			if ok {
			q.collectionIDToDBID.Insert(collectionID, coll.DBID)
					name = "collection_" + collectionIDs[node.GetID()]
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `059b8466` are properly handled with clean fallback behavior.
