> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/milvus-io-milvus-learnings.md`  
> **Source**: github ([https://github.com/milvus-io/milvus](https://github.com/milvus-io/milvus))  
> **Source Version**: `32e53bb3`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-31T05:52:38.907Z  
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
> **Harvest Timestamp**: 2026-10-31T05:52:38.143Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `milvus-io/milvus`
- **Description**: Milvus is a high-performance, cloud-native vector database built for scalable vector ANN search
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 46539 stars

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
- **Issue #54928** (2026-10-31): **fix: return typed empty columns from PresizeAppendFieldData so empty reduced results keep the primary field**
  *Symptoms*: Fixes #54924  When a search result is empty and the QueryNode has to reduce several sub-results, `PresizeAppendFieldData` gets `rows <= 0` and returns a slice of nil `*schemapb.FieldData` entries. Downstream code walks that slice looking for the primary field to build the result, finds a nil entry instead, and reports `1100 can't find data for primary field`.  The function already has `PrepareResultFieldData`, which builds a typed but empty column from a single-row sample. With `rows <= 0` there is no row to append, but the column still has to carry `FieldId`/`FieldName`, so the fix uses that helper on each source sample instead of leaving the entries nil. Rows still are not appended, and the layout-mismatch behaviour is unchanged.  Regression test covers the empty result path with several sub-results. 

- **Issue #54927** (2026-10-31): **fix: keep typed empty columns when QueryNode reduce yields no rows**
  *Symptoms*: <!-- team2-issuefix:54924 --> fix: #54924  ## What Auto-generated **draft** candidate fix for #54924, produced by the team2 pipeline (RCA -> minimal patch -> compile + affected tests pass -> **fail-to-pass regression test** -> adversarial review). **Not auto-merged; please review before considering.**  ## Root cause 1. When a search has more than one sub-result, QueryNode `ReduceSearchResults` (`internal/querynodev2/segments/result.go:56`) skips the single-result fast path and goes through `SearchCommonReduce.ReduceSearchResultData`. 2. `search_reduce.go:66` computes `rowCap = reduce.PresizeRows(...)`; with zero hits, `rowCap == 0`. 3. `reduceFieldsData` (`search_reduce.go:42`) calls `typeutil.PresizeAppendFieldData(rowCap, ...)`. For `rows <= 0`, `pkg/util/typeutil/schema.go:996-998` returns `make([]*schemapb.FieldData, len(sample))`, i.e. a slice of nil pointers (len=2 here). This is intentional per the comment ("every column stays nil"). 4. Normally each nil column is created lazily by `AppendFieldData` on the first appended row, which fills in Type, FieldId and FieldName. With zero rows nothing is appended, so the columns stay nil. This matches the log: `ids.len=0 fieldsData.len=2`. 5. After proto encoding, each nil element becomes an empty `FieldData{}` (FieldId=0, FieldName=""). In the proxy `searchWithRerank` pipeline, `organizeOperator.run` (`internal/proxy/dql/search_pipeline.go:1453-1459`) sees `len(fields)=2 != 0` and does not take the empty-result early return. `t

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

### Incident Patch 1: `421d9866` (2026-10-30)
**Commit Message**: fix: stop a late import result from reviving segments that DropCollection already dropped (#54891)

issue: #54886

## Problem

`DropCollection` (and `DropPartition`) marks every segment of the
channel `Dropped` through `DropVirtualChannel`, including the
preallocated segments of an ImportTask that is still running on the
DataNode. When that task finished, DataCoord wrote its result with
`UpdateStatusOperator(Flushed)`. `updateSegmentPack.Get` no longer
rejects unhealthy segments (#36799) and `UpdateStatusOperator` only
rejects nil and same-state writes, so the segment went back to
`Flushed`. It then belonged to a collection that no longer existed,
nothing dropped it again, and GC never reclaimed it. A production
instance carries 1.93 GB of such segments months after the drop.

The import job itself kept going. For `DropCollection` it was failed by
`checkCollection` up to two minutes later (the check runs on the 2 min
GC loop and skips `Completed` jobs). For `DropPartition` nothing checks
the partition, so the job reached `Completed` with none of its rows
stored.

## Fix

1. `UpdateStatusOperator` treats `Dropped` as terminal: a write from
`Dropped` to any other state is refused (lo

**File**: `internal/datacoord/import_task_import.go` (modified, +24/-1)
```diff
@@ -37,6 +37,7 @@ import (
 	"github.com/milvus-io/milvus/pkg/v3/proto/datapb"
 	"github.com/milvus-io/milvus/pkg/v3/proto/internalpb"
 	"github.com/milvus-io/milvus/pkg/v3/taskcommon"
+	"github.com/milvus-io/milvus/pkg/v3/util/merr"
 	"github.com/milvus-io/milvus/pkg/v3/util/metricsinfo"
 	"github.com/milvus-io/milvus/pkg/v3/util/timerecord"
 	"github.com/milvus-io/milvus/pkg/v3/util/typeutil"
@@ -293,6 +294,7 @@ func (t *importTask) QueryTaskOnWorker(cluster session.Cluster) {
 				maxTs = importStats.GetTimestampTo()
 			}
 
+			opAccept := acceptImportSegmentOperator(info.GetSegmentID())
 			opBinlog := UpdateBinlogsOperator(info.GetSegmentID(), info.GetBinlogs(), info.GetStatslogs(), info.GetDeltalogs(), info.GetBm25Logs())
 			opManifest := UpdateManifest(info.GetSegmentID(), info.GetManifestPath())
 			opState := UpdateStatusOperator(info.GetSegmentID(), commonpb.SegmentState_Flushed)
@@ -301,7 +303,7 @@ func (t *importTask) QueryTaskOnWorker(cluster session.Cluster) {
 			// UpdateBinlogsOperator so it wins over the array-derived value);
 			// when nil it array-derives from the arrays just set above.
 			opStats := UpdateSegmentStats(info.GetSegmentID(), info.GetStats())
-			err = t.meta.UpdateSegmentsInfo(context.TODO(), opBinlog, opManifest, opState, opPosition, opStats)
+			err = t.meta.UpdateSegmentsInfo(context.TODO(), opAccept, opBinlog, opManifest, opState, opPosition, opStats)
 			if err != nil {
 				updateErr := t.importMeta.UpdateJob(context.TODO(), t.GetJobID(), UpdateJobState(internalpb.ImportJobState_Failed), UpdateJobReason(err.Error()))
 				if updateErr != nil {
@@ -374,3 +376,24 @@ func (t *importTask) MarshalJSON() ([]byte, error) {
 	}
 	return json.Marshal(importTask)
 }
+
+// acceptImportSegmentOperator checks that a preallocated import segment can
+// still take the DataNode's result. The segment is Importing until the first
+// acceptance and Flushed when the task is replayed after a crash. Any other
+// state means DropCollection, DropPartition or a failed-job GC retired the
+// segment while the task was running, and its result must not revive it.
+func acceptImportSegmentOperator(segmentID int64) UpdateOperator {
+	return func(pack *updateSegmentPack) bool {
+		segment := pack.Get(segmentID)
+		if segment == nil {
+			return pack.fail(merr.WrapErrSegmentNotFound(segmentID, "import segment is missing"))
+		}
+		switch segment.GetState() {
+		case commonpb.SegmentState_Importing, commonpb.SegmentState_Flushed:
+			return true
+		default:
+			return pack.fail(merr.WrapErrSegmentNotFound(segmentID,
+				"import segment is "+segment.GetState().String()+", its result is not accepted"))
+		}
+	}
+}
```

**File**: `internal/datacoord/import_task_import_test.go` (modified, +73/-0)
```diff
@@ -610,12 +610,14 @@ func TestImportTask_QueryTaskOnWorker(t *testing.T) {
 		task.meta.segments.SetSegment(5, &SegmentInfo{
 			SegmentInfo: &datapb.SegmentInfo{
 				ID:        5,
+				State:     commonpb.SegmentState_Importing,
 				NumOfRows: 100,
 			},
 		})
 		task.meta.segments.SetSegment(6, &SegmentInfo{
 			SegmentInfo: &datapb.SegmentInfo{
 				ID:        6,
+				State:     commonpb.SegmentState_Importing,
 				NumOfRows: 100,
 			},
 		})
@@ -648,6 +650,75 @@ func TestImportTask_QueryTaskOnWorker(t *testing.T) {
 		assert.EqualValues(t, 333, seg6Stats.GetStatsBinlogSize())
 	})
 
+	// DropCollection marks the preallocated import segments Dropped while the
+	// task is still running on the DataNode. The late result must fail the
+	// job instead of writing the segments back to Flushed.
+	t.Run("completed result for dropped segments fails the job", func(t *testing.T) {
+		catalog := mocks.NewDataCoordCatalog(t)
+		catalog.EXPECT().ListReshardTasks(mock.Anything).Return(nil, nil).Maybe()
+		catalog.EXPECT().ListImportTasksV3(mock.Anything).Return(nil, nil).Maybe()
+		catalog.EXPECT().ListImportJobs(mock.Anything).Return(nil, nil)
+		catalog.EXPECT().ListPreImportTasks(mock.Anything).Return(nil, nil)
+		catalog.EXPECT().ListPreImportTasksV3(mock.Anything).Return(nil, nil).Maybe()
+		catalog.EXPECT().ListImportTasks(mock.Anything).Return(nil, nil)
+		catalog.EXPECT().SaveImportTask(mock.Anything, mock.Anything).Return(nil)
+		catalog.EXPECT().SaveImportJob(mock.Anything, mock.Anything).Return(nil)
+		catalog.EXPECT().AlterSegments(mock.Anything, mock.Anything, mock.Anything).Return(nil).Maybe()
+
+		im, err := NewImportMeta(context.TODO(), catalog, nil, nil)
+		require.NoError(t, err)
+		require.NoError(t, im.AddJob(context.TODO(), &importJob{
+			ImportJob: &datapb.ImportJob{
+				JobID: 1,
+				State: internalpb.ImportJobState_Importing,
+			},
+		}))
+
+		taskProto := &datapb.ImportTaskV2{
+			JobID:        1,
+			TaskID:       2,
+			CollectionID: 3,
+			SegmentIDs:   []int64{5},
+			NodeID:       7,
+			State:        datapb.ImportTaskStateV2_InProgress,
+		}
+		importStore := metacache.NewMetaStore(catalog)
+		task := &importTask{
+			meta: &meta{
+				catalog:   catalog,
+				metaStore: importStore,
+				segments:  NewSegmentsInfo(importStore),
+			},
+			importMeta: im,
+			tr:         timerecord.NewTimeRecorder(""),
+		}
+		task.task.Store(taskProto)
+		require.NoError(t, im.AddTask(context.TODO(), task))
+
+		task.meta.segments.SetSegment(5, &SegmentInfo{
+			SegmentInfo: &datapb.SegmentInfo{
+				ID:           5,
+				CollectionID: 3,
+				State:        commonpb.SegmentState_Dropped,
+				IsImporting:  true,
+			},
+		})
+
+		cluster := session.NewMockCluster(t)
+		cluster.EXPECT().QueryImport(mock.Anything, mock.Anything).Return(&datapb.QueryImportResponse{
+			State: datapb.ImportTaskStateV2_Completed,
+			ImportSegmentsInfo: []*datapb.ImportSegmentInfo{
+				{SegmentID: 5, ImportedRows: 100},
+			},
+		}, nil)
+
+		task.QueryTaskOnWorker(cluster)
+
+		assert.Equal(t, datapb.ImportTaskStateV2_InProgress, task.GetState())
+		assert.Equal(t, internalpb.ImportJobState_Failed, im.GetJob(context.TODO(), 1).GetState())
+		assert.Equal(t, commonpb.SegmentState_Dropped, task.meta.segments.GetSegment(5).GetState())
+	})
+
 	// Replaces the removed TestExtractTimestampFromBinlogs coverage. The
 	// helper extractTimestampFromBinlogs was inlined into the Completed
 	// branch and now reuses storage.BuildStatsFromFieldBinlogs. Verify
@@ -702,6 +773,7 @@ func TestImportTask_QueryTaskOnWorker(t *testing.T) {
 		task.meta.segments.SetSegment(42, &SegmentInfo{
 			SegmentInfo: &datapb.SegmentInfo{
 				ID:        42,
+				State:     commonpb.SegmentState_Importing,
 				NumOfRows: 0,
 			},
 		})
@@ -790,6 +862,7 @@ func TestImportTask_QueryTaskOnWorker(t *testing.T) {
 		task.meta.segments.SetSegment(43, &SegmentInfo{
 			SegmentInfo: &datapb.SegmentInfo{
 				ID:        43,
+				State:     commonpb.SegmentState_Importing,
 				NumOfRows: 0,
 				Level:     datapb.SegmentLevel_L0,
 			},
```

**File**: `internal/datacoord/meta.go` (modified, +9/-0)
```diff
@@ -972,6 +972,15 @@ func UpdateStatusOperator(segmentID int64, status commonpb.SegmentState) UpdateO
 			return false
 		}
 
+		// Dropped is terminal. A late writer (an import result, a flush
+		// completion) that still holds the segment ID must not revive a
+		// segment that DropVirtualChannel, compaction or GC already retired.
+		if segment.GetState() == commonpb.SegmentState_Dropped {
+			mlog.Warn(modPack.meta.ctx, "meta update: segment is dropped, refuse to change its state",
+				mlog.Int64("segmentID", segmentID), mlog.String("status", status.String()))
+			return false
+		}
+
 		updateSegState(segment, status)
 		return true
 	}
```

**File**: `internal/datacoord/meta_test.go` (modified, +25/-0)
```diff
@@ -7142,3 +7142,28 @@ func TestMeta_CleanPartitionStatsInfo(t *testing.T) {
 		assert.NotNil(t, psm.GetPartitionStats(1, 2, "ch-1", 100))
 	})
 }
+
+func TestUpdateStatusOperator_DroppedIsTerminal(t *testing.T) {
+	meta, err := newMemoryMeta(t)
+	require.NoError(t, err)
+	require.NoError(t, meta.AddSegment(context.TODO(), NewSegmentInfo(&datapb.SegmentInfo{
+		ID:        1,
+		State:     commonpb.SegmentState_Dropped,
+		DroppedAt: 42,
+	})))
+
+	for _, target := range []commonpb.SegmentState{
+		commonpb.SegmentState_Growing,
+		commonpb.SegmentState_Sealed,
+		commonpb.SegmentState_Flushing,
+		commonpb.SegmentState_Flushed,
+		commonpb.SegmentState_Importing,
+	} {
+		t.Run(target.String(), func(t *testing.T) {
+			require.NoError(t, meta.UpdateSegmentsInfo(context.TODO(), UpdateStatusOperator(1, target)))
+			segment := meta.GetSegment(context.TODO(), 1)
+			require.Equal(t, commonpb.SegmentState_Dropped, segment.GetState())
+			require.EqualValues(t, 42, segment.GetDroppedAt())
+		})
+	}
+}
```

---

### Incident Patch 2: `c04226fe` (2026-10-30)
**Commit Message**: fix: restore nullable embedding-list validity when loading disk indexes (#54899)

issue: #54861

Pass the embedding-list field hint to Knowhere when loading nullable
disk indexes, so ordinary metrics restore validity in the element ID
domain without changing persisted valid_data. Cover both row/element
count relationships and nullable mapping mmap modes.

Update Knowhere to 8adf58d9, including zilliztech/knowhere#1940, and
adapt the growing-index test node to the current Build interface.

Signed-off-by: marcelo-cjl <[REDACTED_EMAIL]>

**File**: `internal/core/src/index/growing/KnowhereGrowingVectorIndexTest.cpp` (modified, +3/-2)
```diff
@@ -109,8 +109,9 @@ class ControlledVectorNode final : public knowhere::IndexNode {
     knowhere::Status
     Build(const knowhere::DataSetPtr dataset,
           std::shared_ptr<knowhere::Config> cfg,
-          bool use_pool) override {
-        return inner_.Node()->Build(dataset, std::move(cfg), use_pool);
+          bool use_pool,
+          milvus::OpContext* ctx) override {
+        return inner_.Node()->Build(dataset, std::move(cfg), use_pool, ctx);
     }
 
     knowhere::Status
```

**File**: `internal/core/src/index/vector/VectorDiskFamilyTest.cpp` (modified, +133/-5)
```diff
@@ -25,6 +25,8 @@
 #include <filesystem>
 #include <fstream>
 #include <memory>
+#include <optional>
+#include <random>
 #include <string>
 #include <type_traits>
 #include <utility>
@@ -39,12 +41,14 @@
 #include "index/vector/KnowhereEngine.h"
 #include "index/vector/VectorDiskBuildFileManager.h"
 #include "index/vector/VectorDiskArtifact.h"
+#include "index/vector/VectorIndexValidDataUtils.h"
 #include "knowhere/comp/index_param.h"
 #include "knowhere/version.h"
 #include "storage/FileManager.h"
 #include "storage/Types.h"
 #include "storage/Util.h"
 #include "storage/artifact/FileSink.h"
+#include "storage/artifact/FileSource.h"
 #include "storage/artifact/LoadOptions.h"
 #include "storage/artifact/LocalDirectory.h"
 
@@ -109,6 +113,7 @@ MakeRows() {
 template <typename T>
 struct OpenedDiskIndex {
     IIndexReaderBasePtr base;
+    std::vector<uint8_t> persisted_validity;
 };
 
 template <typename T>
@@ -120,7 +125,9 @@ BuildDisk(const std::string& raw_path,
           int64_t dim = kDim,
           int64_t logical_rows = kRows,
           const std::string& offsets_path = {},
-          bool mmap = false) {
+          bool mmap = false,
+          const std::string& validity_path = {},
+          bool mmap_id_map = false) {
     auto adapted = AdaptIndexType({
         .index_type = knowhere::IndexEnum::INDEX_DISKANN,
         .field_type =
@@ -142,10 +149,15 @@ BuildDisk(const std::string& raw_path,
         BuilderRegistry<PreparedVectorBuildFiles<T>>::Instance().Create(
             adapted.family, adapted.params);
     ASSERT_NE(builder, nullptr);
-    PreparedVectorBuildFiles<T> input{.raw_path = raw_path};
-    if (!offsets_path.empty()) {
-        input.embedding_offsets_path = offsets_path;
-    }
+    PreparedVectorBuildFiles<T> input{
+        .raw_path = raw_path,
+        .validity_path = validity_path.empty()
+                             ? std::nullopt
+                             : std::make_optional(validity_path),
+        .embedding_offsets_path = offsets_path.empty()
+                                      ? std::nullopt
+                                      : std::make_optional(offsets_path),
+    };
     auto artifact = std::move(*builder).Build(input);
     ASSERT_NE(artifact, nullptr);
 
@@ -180,10 +192,23 @@ BuildDisk(const std::string& raw_path,
     for (const auto& file : stats.Files()) {
         paths.push_back(file.file_name);
     }
+    if (!validity_path.empty()) {
+        storage::V1RemoteSource source(context,
+                                       paths,
+                                       {},
+                                       storage::ArtifactStorageNamespace::Index,
+                                       storage::V1SourceLayout::DiskFiles);
+        opened.persisted_validity = source.ReadEntry(VALID_DATA_KEY);
+    }
     sink.ReleaseLocalStaging();
     storage::LoadOptions options;
     options.params = adapted.params;
     options.params[INDEX_NUM_ROWS_KEY] = logical_rows;
+    if (!validity_path.empty()) {
+        options.params["nullable"] = true;
+        options.params[ENABLE_MMAP_I2O_MAP] = mmap_id_map;
+        options.params[ENABLE_MMAP_O2I_MAP] = mmap_id_map;
+    }
     options.params[DISK_ANN_LOAD_THREAD_NUM] = 2;
     options.enable_mmap = mmap;
     options.mmap_dir_path = staging_dir;
@@ -508,6 +533,109 @@ TEST(VectorDiskFamilyTest, EmbeddingListsPreserveTrailingEmptyParents) {
     EXPECT_EQ(result.distances_.size(), 8);
 }
 
+// Disk validity describes lists; ordinary-metric searches use element ids.
+// Keep the persisted row bitmap and restore element validity during loading.
+void
+RunNullableElementLevelDiskSearch(bool more_rows_than_vectors,
+                                  bool mmap_id_map) {
+    auto files = storage::LocalDirectory::CreateOwned(
+        "/tmp", "vector_disk_nullable_XXXXXX", "vector disk nullable test");
+    // Both shapes need enough vectors for the disk index's PQ training.
+    constexpr int64_t parents = kRows * 2;
+    std::vector<uint8_t> bitmap((parents + 7) / 8, 0);
+    std::vector<size_t> offsets{0};
+    for (int64_t row = 0; row < parents; ++row) {
+        if (row % 5 == 1) {
+            continue;  // Null lists contribute neither vectors nor offsets.
+        }
+        bitmap[row / 8] |= static_cast<uint8_t>(1U << (row % 8));
+        const size_t vectors = more_rows_than_vectors
+                                   ? (row % 5 == 0 ? 1 : 0)
+                                   : (row % 5 == 3 ? 0 : row % 4 + 1);
+        offsets.push_back(offsets.back() + vectors);
+    }
+    const auto element_count = static_cast<int64_t>(offsets.back());
+    ASSERT_EQ(more_rows_than_vectors, parents > element_count);
+    std::default_random_engine rng(42);
+    std::normal_distribution<float> dist(0.0F, 1.0F);
+    std::vector<float> values(element_count * kDim);
+    for (auto& value : values) {
+        value = dist(rng);
+    }
+    std::vector<uint8_t> row_validity(sizeof(uint64_t) + bitmap.size()
```

**File**: `internal/core/src/index/vector/VectorDiskLoader.cpp` (modified, +4/-1)
```diff
@@ -222,7 +222,10 @@ ReadValidity(bool use_async,
         CountValidDataBitmap(valid_data.count, valid_data.bitmap) == 0) {
         mmap_flags = {};
     }
-    co_return MakeNullableLoadInput(valid_data, mmap_flags, local_prefix);
+    co_return MakeNullableLoadInput(valid_data,
+                                    mmap_flags,
+                                    local_prefix,
+                                    params.elem_type != DataType::NONE);
 }
 
 using detail::EmptyEmbeddingListState;
```

**File**: `internal/core/src/index/vector/VectorIndexValidDataUtils.h` (modified, +5/-3)
```diff
@@ -416,9 +416,10 @@ NullableMmapOptions(const IdMapMmapFlags& flags,
 inline knowhere::LoadOptions
 MakeNullableLoadInput(const ValidDataView& valid_data,
                       const IdMapMmapFlags& mmap_flags = {},
-                      const std::string& mmap_path_prefix = {}) {
+                      const std::string& mmap_path_prefix = {},
+                      bool embedding_list = false) {
     if (!valid_data.found) {
-        return {};
+        return {.embedding_list = embedding_list};
     }
     ValidatePersistedValidDataCount(valid_data.count);
     if (valid_data.count > 0 && valid_data.bitmap == nullptr) {
@@ -429,7 +430,8 @@ MakeNullableLoadInput(const ValidDataView& valid_data,
     return {knowhere::ValidityView{valid_data.bitmap,
                                    GetValidDataBitmapSize(valid_data.count),
                                    ToValidDataCount(valid_data.count)},
-            NullableMmapOptions(mmap_flags, mmap_path_prefix)};
+            NullableMmapOptions(mmap_flags, mmap_path_prefix),
+            embedding_list};
 }
 
 inline ValidDataView
```

**File**: `internal/core/thirdparty/knowhere/CMakeLists.txt` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@
 # Update KNOWHERE_VERSION for the first occurrence
 milvus_add_pkg_config("knowhere")
 set_property(DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR} PROPERTY INCLUDE_DIRECTORIES "")
-set( KNOWHERE_VERSION d0a96c58 )
+set( KNOWHERE_VERSION 8adf58d9 )
 set( GIT_REPOSITORY  "https://github.com/zilliztech/knowhere.git")
 
 message(STATUS "Knowhere repo: ${GIT_REPOSITORY}")
```

---

### Incident Patch 3: `949f068b` (2026-10-30)
**Commit Message**: fix: clean up DataCoord state of dropped collections (#54900)

issue: #54870

Clean up a dropped collection's DataCoord state (metacache entry,
metrics, segment change groups, channel removal flag) once the
collection is gone for good. Based on #54871, with its review comments
applied.

---------

Signed-off-by: xiaofanluan <[REDACTED_EMAIL]>
Signed-off-by: sunby <[REDACTED_EMAIL]>
Co-authored-by: xiaofanluan <[REDACTED_EMAIL]>

**File**: `internal/datacoord/checkpoint_availability_test.go` (modified, +2/-0)
```diff
@@ -141,6 +141,8 @@ func TestCheckpointAvailabilityFallback(t *testing.T) {
 					catalog.EXPECT().GcConfirm(mock.Anything, mock.Anything, int64(-1)).Return(tc.confirm).Twice()
 				}
 				if tc.dropped {
+					// Each dropped collection's DataCoord meta goes before its checkpoints.
+					catalog.EXPECT().DropSegmentChangeGroups(mock.Anything, mock.Anything).Return(nil).Twice()
 					catalog.EXPECT().DropChannelCheckpoint(mock.Anything, mock.Anything).Return(nil).Times(3)
 				}
 				store := metacache.NewMetaStore(catalog)
```

**File**: `internal/datacoord/garbage_collector.go` (modified, +86/-27)
```diff
@@ -379,7 +379,7 @@ func (gc *garbageCollector) Resume(ctx context.Context, collectionID int64, tick
 func (gc *garbageCollector) work(ctx context.Context) {
 	// TODO: fast cancel for gc when closing.
 	// Run gc tasks in parallel.
-	gc.wg.Add(4)
+	gc.wg.Add(5)
 	go func() {
 		defer gc.wg.Done()
 		gc.runRecycleTaskWithPauser(ctx, "meta", gc.option.checkInterval, func(ctx context.Context, signal <-chan gcCmd) {
@@ -413,6 +413,10 @@ func (gc *garbageCollector) work(ctx context.Context) {
 			gc.recycleUnusedLOBFiles(ctx)
 		})
 	}()
+	go func() {
+		defer gc.wg.Done()
+		gc.recycleDroppedChannelFlags(ctx)
+	}()
 	go func() {
 		defer gc.wg.Done()
 		gc.startControlLoop(ctx)
@@ -1505,9 +1509,11 @@ func (gc *garbageCollector) recycleChannelCPMeta(ctx context.Context, signal <-c
 		return
 	}
 
-	collectionID2GcStatus := make(map[int64]bool)
 	availability, _ := gc.option.broker.(broker.CollectionAvailability)
 	skippedCnt := 0
+	// The checkpoints of collections that may be dropped, by collection: a
+	// dropped collection's checkpoints go together, after the rest of its meta.
+	candidates := make(map[int64][]string)
 
 	mlog.Info(ctx, "start to GC channel cp", mlog.Int("vchannelCPCnt", len(channelCPs)))
 	for vChannel := range channelCPs {
@@ -1534,41 +1540,94 @@ func (gc *garbageCollector) recycleChannelCPMeta(ctx context.Context, signal <-c
 			skippedCnt++
 			continue
 		}
+		candidates[collectionID] = append(candidates[collectionID], vChannel)
+	}
 
-		_, ok := collectionID2GcStatus[collectionID]
-		if !ok {
-			timeoutCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
-			has, err := gc.option.broker.HasCollection(timeoutCtx, collectionID)
-			cancel()
-			if err == nil && !has {
-				collectionID2GcStatus[collectionID] = gc.meta.metaStore.GcConfirm(ctx, collectionID, -1)
-			} else {
-				// skip checkpoints GC of this cycle if describe collection fails or the collection state is available.
-				mlog.Debug(ctx, "skip channel cp GC, the collection state is available",
-					mlog.Int64("collectionID", collectionID),
-					mlog.Bool("dropped", has), mlog.Err(err))
-				collectionID2GcStatus[collectionID] = false
-			}
+	for collectionID, vChannels := range candidates {
+		gc.ackSignal(signal)
+		if ctx.Err() != nil {
+			return
 		}
-
-		// Skip to GC if all segments meta of the corresponding collection are not removed
-		if gcConfirmed := collectionID2GcStatus[collectionID]; !gcConfirmed {
-			skippedCnt++
+		if gc.collectionGCPaused(collectionID) {
 			continue
 		}
-
-		err := gc.meta.DropChannelCheckpoint(vChannel)
-		if err != nil {
-			// Try to GC in the next gc cycle if drop channel cp meta fail.
-			mlog.Warn(ctx, "failed to drop channelcp check point during gc", mlog.String("vchannel", vChannel), mlog.Err(err))
-		} else {
-			mlog.Info(ctx, "GC channel cp", mlog.String("vchannel", vChannel))
+		if !gc.collectionRecyclable(ctx, collectionID) {
+			skippedCnt += len(vChannels)
+			continue
+		}
+		if err := gc.recycleDroppedCollection(ctx, collectionID, vChannels); err != nil {
+			mlog.Warn(ctx, "failed to recycle dropped collection meta, retry in next GC round",
+				mlog.Int64("collectionID", collectionID), mlog.Err(err))
 		}
 	}
 
 	mlog.Info(ctx, "GC channel cp done", mlog.Int("skippedChannelCP", skippedCnt))
 }
 
+// collectionRecyclable reports whether RootCoord has dropped the collection and
+// all its segments are recycled, the condition RootCoord uses to remove the
+// collection meta.
+func (gc *garbageCollector) collectionRecyclable(ctx context.Context, collectionID int64) bool {
+	timeoutCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
+	has, err := gc.option.broker.HasCollection(timeoutCtx, collectionID)
+	cancel()
+	if err != nil || has {
+		// skip checkpoints GC of this cycle if describe collection fails or the collection state is available.
+		mlog.Debug(ctx, "skip channel cp GC, the collection state is available",
+			mlog.Int64("collectionID", collectionID),
+			mlog.Bool("exists", has), mlog.Err(err))
+		return false
+	}
+	// Skip to GC if all segments meta of the corresponding collection are not removed
+	return gc.meta.metaStore.GcConfirm(ctx, collectionID, -1)
+}
+
+// recycleDroppedCollection drops what DataCoord still keeps for a collection
+// that RootCoord has dropped and whose segments are all recycled: its segment
+// change groups, its cached collection info and metrics, and the checkpoints
+// of its vChannels. The checkpoints go last: they are what brings GC back to
+// the collection if an earlier step fails.
+func (gc *garbageCollector) recycleDroppedCollection(ctx context.Context, collectionID int64, vChannels []string) error {
+	if err := gc.meta.DropSegmentChangeGroupsOfCollection(ctx, collectionID); err != nil {
+		return err
+	}
+	gc.meta.DropCollection(collectionID)
+	var errs []error
+	for _, vChannel := range vChannels {
+		if err := gc.meta.DropChannelCheckpoint(vChannel); err != nil {
+			errs = append(errs, merr.Wrapf(err, "failed to dr
```

**File**: `internal/datacoord/garbage_collector_test.go` (modified, +33/-4)
```diff
@@ -2318,6 +2318,8 @@ func TestGarbageCollector_recycleChannelMeta(t *testing.T) {
 		// has no coverage anywhere.
 		"cluster-id-rootcoord-dm_0_invalidedCollectionIDv0": nil,
 	})
+	store.PutCollection(&metacache.CollectionInfo{ID: 123})
+	store.PutCollection(&metacache.CollectionInfo{ID: 124})
 
 	broker := broker2.NewMockBroker(t)
 	broker.EXPECT().HasCollection(mock.Anything, mock.Anything).Return(true, nil).Twice()
@@ -2335,7 +2337,7 @@ func TestGarbageCollector_recycleChannelMeta(t *testing.T) {
 	catalog.EXPECT().ListChannelCheckpoint(mock.Anything).
 		RunAndReturn(func(ctx context.Context) (map[string]*msgpb.MsgPosition, error) {
 			return store.GetChannelCheckpoints(), nil
-		}).Times(3)
+		}).Times(4)
 
 	catalog.EXPECT().GcConfirm(mock.Anything, mock.Anything, mock.Anything).
 		RunAndReturn(func(ctx context.Context, collectionID int64, i2 int64) bool {
@@ -2347,24 +2349,51 @@ func TestGarbageCollector_recycleChannelMeta(t *testing.T) {
 		assert.Equal(t, 4, len(m.metaStore.GetChannelCheckpoints()))
 	})
 
-	broker.EXPECT().HasCollection(mock.Anything, mock.Anything).Return(false, nil).Times(4)
+	broker.EXPECT().HasCollection(mock.Anything, mock.Anything).Return(false, nil).Times(6)
+	t.Run("drop collection meta fail keeps channel cp", func(t *testing.T) {
+		catalog.EXPECT().DropSegmentChangeGroups(mock.Anything, int64(123)).Return(errors.New("mock error")).Once()
+		gc.recycleChannelCPMeta(context.TODO(), nil)
+		assert.Equal(t, 4, len(m.metaStore.GetChannelCheckpoints()))
+		_, cached := store.GetCollection(123)
+		assert.True(t, cached)
+	})
+
 	t.Run("drop channel cp fail", func(t *testing.T) {
+		catalog.EXPECT().DropSegmentChangeGroups(mock.Anything, int64(123)).Return(nil).Once()
 		catalog.EXPECT().DropChannelCheckpoint(mock.Anything, mock.Anything).Return(errors.New("mock error")).Twice()
 		gc.recycleChannelCPMeta(context.TODO(), nil)
 		assert.Equal(t, 4, len(m.metaStore.GetChannelCheckpoints()))
 	})
 
 	t.Run("channel cp gc ok", func(t *testing.T) {
+		catalog.EXPECT().DropSegmentChangeGroups(mock.Anything, int64(123)).Return(nil).Once()
 		catalog.EXPECT().DropChannelCheckpoint(mock.Anything, mock.Anything).Return(nil).Twice()
 		gc.recycleChannelCPMeta(context.TODO(), nil)
-		// 124's checkpoint is GC'd; 123's survives (collection still there) and
-		// so does the unparseable one, which must never be GC'd.
+		// 123's checkpoints are GC'd (its segments are all recycled); 124's
+		// survive (GcConfirm is false) and so does the unparseable one, which
+		// must never be GC'd.
 		assert.Equal(t, 2, len(m.metaStore.GetChannelCheckpoints()))
 		_, stillThere := m.metaStore.GetChannelCheckpoints()["cluster-id-rootcoord-dm_0_invalidedCollectionIDv0"]
 		assert.True(t, stillThere, "an unparseable vchannel must be skipped, not GC'd")
+		// Only the collection whose segments are all recycled leaves the cache.
+		_, cached := store.GetCollection(123)
+		assert.False(t, cached)
+		_, cached = store.GetCollection(124)
+		assert.True(t, cached)
 	})
 }
 
+func TestGarbageCollector_recycleDroppedChannelFlags(t *testing.T) {
+	catalog := catalogmocks.NewDataCoordCatalog(t)
+	m := &meta{catalog: catalog, metaStore: metacache.NewMetaStore(catalog)}
+	gc := newGarbageCollector(m, newMockHandlerWithMeta(m), GcOption{checkInterval: time.Millisecond})
+
+	// A failed sweep is retried, and the first success ends the loop.
+	catalog.EXPECT().RemoveDroppedChannelFlags(mock.Anything).Return(0, errors.New("mock error")).Once()
+	catalog.EXPECT().RemoveDroppedChannelFlags(mock.Anything).Return(2, nil).Once()
+	gc.recycleDroppedChannelFlags(context.TODO())
+}
+
 func TestGarbageCollector_removeObjectPool(t *testing.T) {
 	paramtable.Init()
 	cm := mocks.NewChunkManager(t)
```

**File**: `internal/datacoord/handler.go` (modified, +10/-33)
```diff
@@ -22,6 +22,7 @@ import (
 	"strconv"
 	"time"
 
+	"github.com/cockroachdb/errors"
 	"github.com/samber/lo"
 	"golang.org/x/time/rate"
 	"google.golang.org/protobuf/proto"
@@ -52,8 +53,6 @@ type Handler interface {
 	GetQueryVChanPositions(ch RWChannel, partitionIDs ...UniqueID) *datapb.VchannelInfo
 	// GetDataVChanPositions gets the information recovery needed of a channel for DataNode
 	GetDataVChanPositions(ch RWChannel, partitionID UniqueID) *datapb.VchannelInfo
-	CheckShouldDropChannel(ch string) bool
-	FinishDropChannel(ch string, collectionID int64) error
 	GetCollection(ctx context.Context, collectionID UniqueID) (*collectionInfo, error)
 	GetCurrentSegmentsView(ctx context.Context, channel RWChannel, partitionIDs ...UniqueID) *SegmentsView
 	ListLoadedSegments(ctx context.Context) ([]int64, error)
@@ -810,6 +809,10 @@ func (h *ServerHandler) GetCollection(ctx context.Context, collectionID UniqueID
 		err := h.s.loadCollectionFromRootCoord(ctx2, collectionID)
 		if err != nil {
 			mlog.Warn(ctx, "failed to load collection from rootcoord", mlog.FieldCollectionID(collectionID), mlog.Err(err))
+			// A dropped collection never comes back, retrying only stalls the caller.
+			if errors.Is(err, merr.ErrCollectionNotFound) {
+				return retry.Unrecoverable(err)
+			}
 			return err
 		}
 		return nil
@@ -819,38 +822,12 @@ func (h *ServerHandler) GetCollection(ctx context.Context, collectionID UniqueID
 			mlog.Err(err))
 		return nil, err
 	}
-	return h.s.meta.GetCollection(collectionID), nil
-}
-
-// CheckShouldDropChannel returns whether specified channel is marked to be removed
-func (h *ServerHandler) CheckShouldDropChannel(channel string) bool {
-	return h.s.meta.metaStore.ShouldDropChannel(h.s.ctx, channel)
-}
-
-// FinishDropChannel cleans up the remove flag for channels
-// this function is a wrapper of server.meta.FinishDropChannel
-func (h *ServerHandler) FinishDropChannel(channel string, collectionID int64) error {
-	err := h.s.meta.metaStore.DropChannel(h.s.ctx, channel)
-	if err != nil {
-		mlog.Warn(context.TODO(), "DropChannel failed", mlog.String("vChannel", channel), mlog.Err(err))
-		return err
-	}
-	mlog.Info(context.TODO(), "DropChannel succeeded", mlog.String("channel", channel))
-	// Channel checkpoints are cleaned up during garbage collection.
-
-	// clean collection info cache when meet drop collection info
-	h.s.meta.DropCollection(collectionID)
-
-	// tedxu: drop this collection's segment change group records together with
-	// its other metadata. Without this they would leak in etcd forever (and a
-	// reused collectionID could resurrect stale groups on recovery).
-	if err := h.s.meta.DropSegmentChangeGroupsOfCollection(h.s.ctx, collectionID); err != nil {
-		mlog.Warn(context.TODO(), "drop segment change groups of collection failed",
-			mlog.Int64("collectionID", collectionID), mlog.Err(err))
-		return err
+	coll = h.s.meta.GetCollection(collectionID)
+	if coll == nil {
+		// Dropped and recycled by GC right after it was loaded.
+		return nil, merr.WrapErrCollectionNotFound(collectionID)
 	}
-
-	return nil
+	return coll, nil
 }
 
 func (h *ServerHandler) ListLoadedSegments(ctx context.Context) ([]int64, error) {
```

**File**: `internal/datacoord/handler_test.go` (modified, +49/-56)
```diff
@@ -3,7 +3,6 @@ package datacoord
 import (
 	"context"
 	"testing"
-	"time"
 
 	"github.com/bytedance/mockey"
 	"github.com/samber/lo"
@@ -15,7 +14,7 @@ import (
 	"github.com/milvus-io/milvus-proto/go-api/v3/milvuspb"
 	"github.com/milvus-io/milvus-proto/go-api/v3/msgpb"
 	"github.com/milvus-io/milvus/internal/datacoord/broker"
-	"github.com/milvus-io/milvus/internal/metastore"
+	"github.com/milvus-io/milvus/internal/metacache"
 	"github.com/milvus-io/milvus/internal/metastore/kv/binlog"
 	"github.com/milvus-io/milvus/internal/metastore/model"
 	mocks2 "github.com/milvus-io/milvus/internal/mocks"
@@ -25,11 +24,9 @@ import (
 	"github.com/milvus-io/milvus/pkg/v3/objectstorage"
 	"github.com/milvus-io/milvus/pkg/v3/proto/datapb"
 	"github.com/milvus-io/milvus/pkg/v3/proto/indexpb"
-	"github.com/milvus-io/milvus/pkg/v3/proto/rootcoordpb"
 	"github.com/milvus-io/milvus/pkg/v3/proto/workerpb"
 	"github.com/milvus-io/milvus/pkg/v3/util/funcutil"
 	"github.com/milvus-io/milvus/pkg/v3/util/merr"
-	"github.com/milvus-io/milvus/pkg/v3/util/tsoutil"
 	"github.com/milvus-io/milvus/pkg/v3/util/typeutil"
 )
 
@@ -1639,58 +1636,6 @@ func TestGetCurrentSegmentsViewExternalCollection(t *testing.T) {
 	assert.ElementsMatch(t, []int64{100, 101}, view.FlushedSegmentIDs)
 }
 
-func TestShouldDropChannel(t *testing.T) {
-	type myRootCoord struct {
-		mocks2.MockRootCoordClient
-	}
-	myRoot := &myRootCoord{}
-	myRoot.EXPECT().AllocTimestamp(mock.Anything, mock.Anything).Return(&rootcoordpb.AllocTimestampResponse{
-		Status:    merr.Success(),
-		Timestamp: tsoutil.ComposeTSByTime(time.Now()),
-		Count:     1,
-	}, nil)
-
-	myRoot.EXPECT().AllocID(mock.Anything, mock.Anything).Return(&rootcoordpb.AllocIDResponse{
-		Status: merr.Success(),
-		ID:     int64(tsoutil.ComposeTSByTime(time.Now())),
-		Count:  1,
-	}, nil)
-
-	svr := newTestServer(t)
-	defer closeTestServer(t, svr)
-	schema := newTestSchema()
-	svr.meta.AddCollection(&collectionInfo{
-		ID:     0,
-		Schema: schema,
-		StartPositions: []*commonpb.KeyDataPair{
-			{
-				Key:  "ch1",
-				Data: []byte{8, 9, 10},
-			},
-		},
-	})
-	svr.meta.AddCollection(&collectionInfo{
-		ID:     1,
-		Schema: schema,
-		StartPositions: []*commonpb.KeyDataPair{
-			{
-				Key:  "ch0",
-				Data: []byte{8, 9, 10},
-			},
-		},
-	})
-
-	t.Run("channel name not in kv ", func(t *testing.T) {
-		assert.False(t, svr.handler.CheckShouldDropChannel("ch99"))
-	})
-
-	t.Run("channel in remove flag", func(t *testing.T) {
-		err := svr.meta.catalog.Update(context.TODO(), metastore.MarkChannelDropped("ch1"))
-		require.NoError(t, err)
-		assert.True(t, svr.handler.CheckShouldDropChannel("ch1"))
-	})
-}
-
 func TestGetDataVChanPositions(t *testing.T) {
 	svr := newTestServer(t)
 	defer closeTestServer(t, svr)
@@ -2921,3 +2866,51 @@ func TestGenSnapshot_CommitTimestamp(t *testing.T) {
 		assert.Equal(t, int64(999), snapshotData.Segments[0].SegmentId)
 	})
 }
+
+func TestServerHandler_GetCollectionRetry(t *testing.T) {
+	newHandler := func(b broker.Broker) *ServerHandler {
+		m := &meta{metaStore: metacache.NewMetaStore(nil)}
+		return newServerHandler(&Server{broker: b, meta: m})
+	}
+
+	t.Run("dropped collection is not retried", func(t *testing.T) {
+		b := broker.NewMockBroker(t)
+		b.EXPECT().HasCollection(mock.Anything, int64(1)).Return(false, nil).Once()
+
+		coll, err := newHandler(b).GetCollection(context.TODO(), 1)
+		assert.ErrorIs(t, err, merr.ErrCollectionNotFound)
+		assert.Nil(t, coll)
+	})
+
+	t.Run("transient error is retried", func(t *testing.T) {
+		b := broker.NewMockBroker(t)
+		b.EXPECT().HasCollection(mock.Anything, int64(1)).Return(false, merr.ErrServiceUnavailable).Once()
+		b.EXPECT().HasCollection(mock.Anything, int64(1)).Return(true, nil).Once()
+		b.EXPECT().DescribeCollectionInternal(mock.Anything, int64(1)).Return(&milvuspb.DescribeCollectionResponse{
+			Status:       merr.Success(),
+			CollectionID: 1,
+		}, nil).Once()
+		b.EXPECT().ShowPartitionsInternal(mock.Anything, int64(1)).Return([]int64{10}, nil).Once()
+
+		coll, err := newHandler(b).GetCollection(context.TODO(), 1)
+		assert.NoError(t, err)
+		assert.Equal(t, int64(1), coll.ID)
+	})
+
+	t.Run("collection gone from the cache after load", func(t *testing.T) {
+		b := broker.NewMockBroker(t)
+		b.EXPECT().HasCollection(mock.Anything, int64(1)).Return(true, nil).Once()
+		b.EXPECT().DescribeCollectionInternal(mock.Anything, int64(1)).Return(&milvuspb.DescribeCollectionResponse{
+			Status:       merr.Success(),
+			CollectionID: 1,
+		}, nil).Once()
+		b.EXPECT().ShowPartitionsInternal(mock.Anything, int64(1)).Return([]int64{10}, nil).Once()
+		// GC drops the collection between the load and the read.
+		dropAfterAdd := mockey.Mock((*meta).AddCollection).Return().Build()
+		defer dropAfterAdd.UnPatch()
+
+		coll, err := newHandler(b).GetCollection(context.TODO(), 1)
+		assert.ErrorIs(t, err, merr.ErrCollectionNotFound)
+		assert.Nil(t, coll)
+	})
+}
```

**File**: `internal/datacoord/meta.go` (modified, +9/-8)
```diff
@@ -2290,11 +2290,12 @@ func (m *meta) mergeDropSegment(seg2Drop *SegmentInfo) *SegmentInfo {
 	return clonedSegment
 }
 
-// batchSaveDropSegments saves drop segments info together with the channel
-// removal flag as a single composite catalog.Update call, so the dropped
-// segments and the channel tombstone commit atomically (or, when the op
-// count exceeds the txn size limit, via the caller-ordered chunked
-// fallback - see kv/txn.Commit for the exact atomicity contract).
+// batchSaveDropSegments saves the dropped segments of a channel and deletes the
+// channel's removal flag as a single composite catalog.Update call (or, when
+// the op count exceeds the txn size limit, via the caller-ordered chunked
+// fallback - see kv/txn.Commit for the exact atomicity contract). A missing
+// flag reads as a dropped channel, so the flag is deleted instead of being
+// rewritten to "removed" and leaking forever.
 func (m *meta) batchSaveDropSegments(ctx context.Context, channel string, modSegments map[int64]*SegmentInfo) error {
 	var modSegIDs []int64
 	for k := range modSegments {
@@ -2311,9 +2312,9 @@ func (m *meta) batchSaveDropSegments(ctx context.Context, channel string, modSeg
 		}
 		actions = append(actions, metastore.UpdateSegment(seg.SegmentInfo))
 	}
-	// The channel tombstone is the visibility marker; it commits last (see
-	// MarkChannelDropped -> CommitSave), after the dropped segments.
-	actions = append(actions, metastore.MarkChannelDropped(channel))
+	// The flag delete is the visibility marker; it commits last (see
+	// DropChannelFlag -> CommitRemove), after the dropped segments.
+	actions = append(actions, metastore.DropChannelFlag(channel))
 	if err := m.catalog.Update(ctx, actions...); err != nil {
 		return err
 	}
```

**File**: `internal/datacoord/meta_test.go` (modified, +6/-7)
```diff
@@ -1264,10 +1264,9 @@ func (suite *MetaBasicSuite) TestBatchSaveDropSegments_UsesCompositeUpdate() {
 		}},
 	}
 
-	// catalog has no SaveDroppedSegmentsInBatch/MarkChannelDeleted
-	// expectation: if batchSaveDropSegments still called those directly (the
-	// old two-call path), mockery would fail the test with an
-	// unexpected-call panic.
+	// catalog has no SaveDroppedSegmentsInBatch expectation: if
+	// batchSaveDropSegments still called it directly (the old two-call path),
+	// mockery would fail the test with an unexpected-call panic.
 	catalog := mocks2.NewDataCoordCatalog(suite.T())
 	catalog.EXPECT().ListSegmentChangeGroups(mock.Anything).Return(nil, nil).Maybe()
 	var gotActions []metastore.UpdateAction
@@ -1285,14 +1284,14 @@ func (suite *MetaBasicSuite) TestBatchSaveDropSegments_UsesCompositeUpdate() {
 	err := m.batchSaveDropSegments(context.TODO(), "ch-1", modSegments)
 	suite.NoError(err)
 
-	// One UpdateSegment per dropped segment (2), then the channel tombstone.
+	// One UpdateSegment per dropped segment (2), then the channel flag delete.
 	// catalog.Update called exactly once (.Once()).
 	suite.Require().Len(gotActions, 3, "expected two segment updates + one channel action")
 
-	// The channel tombstone is last (the visibility marker).
+	// The channel flag delete is last, after the dropped segments.
 	channelEntry, ok := gotActions[2].Entry.(metastore.ChannelEntry)
 	suite.Require().True(ok)
-	suite.Equal(metastore.ActionUpdate, gotActions[2].Type)
+	suite.Equal(metastore.ActionDelete, gotActions[2].Type)
 	suite.Require().Equal("ch-1", channelEntry.Channel)
 
 	var droppedIDs []int64
```

**File**: `internal/datacoord/mock_handler.go` (modified, +0/-93)
```diff
@@ -25,99 +25,6 @@ func (_m *NMockHandler) EXPECT() *NMockHandler_Expecter {
 	return &NMockHandler_Expecter{mock: &_m.Mock}
 }
 
-// CheckShouldDropChannel provides a mock function with given fields: ch
-func (_m *NMockHandler) CheckShouldDropChannel(ch string) bool {
-	ret := _m.Called(ch)
-
-	if len(ret) == 0 {
-		panic("no return value specified for CheckShouldDropChannel")
-	}
-
-	var r0 bool
-	if rf, ok := ret.Get(0).(func(string) bool); ok {
-		r0 = rf(ch)
-	} else {
-		r0 = ret.Get(0).(bool)
-	}
-
-	return r0
-}
-
-// NMockHandler_CheckShouldDropChannel_Call is a *mock.Call that shadows Run/Return methods with type explicit version for method 'CheckShouldDropChannel'
-type NMockHandler_CheckShouldDropChannel_Call struct {
-	*mock.Call
-}
-
-// CheckShouldDropChannel is a helper method to define mock.On call
-//   - ch string
-func (_e *NMockHandler_Expecter) CheckShouldDropChannel(ch interface{}) *NMockHandler_CheckShouldDropChannel_Call {
-	return &NMockHandler_CheckShouldDropChannel_Call{Call: _e.mock.On("CheckShouldDropChannel", ch)}
-}
-
-func (_c *NMockHandler_CheckShouldDropChannel_Call) Run(run func(ch string)) *NMockHandler_CheckShouldDropChannel_Call {
-	_c.Call.Run(func(args mock.Arguments) {
-		run(args[0].(string))
-	})
-	return _c
-}
-
-func (_c *NMockHandler_CheckShouldDropChannel_Call) Return(_a0 bool) *NMockHandler_CheckShouldDropChannel_Call {
-	_c.Call.Return(_a0)
-	return _c
-}
-
-func (_c *NMockHandler_CheckShouldDropChannel_Call) RunAndReturn(run func(string) bool) *NMockHandler_CheckShouldDropChannel_Call {
-	_c.Call.Return(run)
-	return _c
-}
-
-// FinishDropChannel provides a mock function with given fields: ch, collectionID
-func (_m *NMockHandler) FinishDropChannel(ch string, collectionID int64) error {
-	ret := _m.Called(ch, collectionID)
-
-	if len(ret) == 0 {
-		panic("no return value specified for FinishDropChannel")
-	}
-
-	var r0 error
-	if rf, ok := ret.Get(0).(func(string, int64) error); ok {
-		r0 = rf(ch, collectionID)
-	} else {
-		r0 = ret.Error(0)
-	}
-
-	return r0
-}
-
-// NMockHandler_FinishDropChannel_Call is a *mock.Call that shadows Run/Return methods with type explicit version for method 'FinishDropChannel'
-type NMockHandler_FinishDropChannel_Call struct {
-	*mock.Call
-}
-
-// FinishDropChannel is a helper method to define mock.On call
-//   - ch string
-//   - collectionID int64
-func (_e *NMockHandler_Expecter) FinishDropChannel(ch interface{}, collectionID interface{}) *NMockHandler_FinishDropChannel_Call {
-	return &NMockHandler_FinishDropChannel_Call{Call: _e.mock.On("FinishDropChannel", ch, collectionID)}
-}
-
-func (_c *NMockHandler_FinishDropChannel_Call) Run(run func(ch string, collectionID int64)) *NMockHandler_FinishDropChannel_Call {
-	_c.Call.Run(func(args mock.Arguments) {
-		run(args[0].(string), args[1].(int64))
-	})
-	return _c
-}
-
-func (_c *NMockHandler_FinishDropChannel_Call) Return(_a0 error) *NMockHandler_FinishDropChannel_Call {
-	_c.Call.Return(_a0)
-	return _c
-}
-
-func (_c *NMockHandler_FinishDropChannel_Call) RunAndReturn(run func(string, int64) error) *NMockHandler_FinishDropChannel_Call {
-	_c.Call.Return(run)
-	return _c
-}
-
 // GenSnapshot provides a mock function with given fields: ctx, collectionID, channelSeekPositions
 func (_m *NMockHandler) GenSnapshot(ctx context.Context, collectionID int64, channelSeekPositions []*msgpb.MsgPosition) (*storage.SnapshotData, error) {
 	ret := _m.Called(ctx, collectionID, channelSeekPositions)
```

#### Recent Merged Pull Requests:
- **PR #54928** (closed): fix: return typed empty columns from PresizeAppendFieldData so empty reduced results keep the primary field (@xixi-box)
- **PR #54927** (closed): fix: keep typed empty columns when QueryNode reduce yields no rows (@czs007)
- **PR #54926** (closed): fix: [Bug]: Search with rerank/function_chain fails with 1100 "can't find data for primary field" when the result is empty and QueryNode reduces multiple sub-results (@xixi-box)
- **PR #54919** (2026-10-30): fix: [hotfix-3.0.5] build JSON indexes over valid rows with empty bytes (@zhengbuqian)
- **PR #54900** (2026-10-30): fix: clean up DataCoord state of dropped collections (@sunby)
- **PR #54899** (2026-10-30): fix: restore nullable embedding-list validity when loading disk indexes (@marcelo-cjl)

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

## X. stop a late import result from reviving segments that DropCollection already dro

**RULE**:
When implementing operations in `internal/datacoord/import_task_import.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in milvus-io/milvus. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `421d9866`: stop a late import result from reviving segments that DropCollection already dropped (#54891). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `internal/datacoord/import_task_import.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	"github.com/milvus-io/milvus/pkg/v3/util/merr"
			opAccept := acceptImportSegmentOperator(info.GetSegmentID())
			err = t.meta.UpdateSegmentsInfo(context.TODO(), opAccept, opBinlog, opManifest, opState, opPosition, opStats)

// acceptImportSegmentOperator checks that a preallocated import segment can
// still take the DataNode's result. The segment is Importing until the first
// acceptance and Flushed when the task is replayed after a crash. Any other
// state means DropCollection, DropPartition or a failed-job GC retired the
// segment while the task was running, and its result must not revive it.
func acceptImportSegmentOperator(segmentID int64) UpdateOperator {
	return func(pack *updateSegmentPack) bool {
		segment := pack.Get(segmentID)
		if segment == nil {
			return pack.fail(merr.WrapErrSegmentNotFound(segmentID, "import segment is missing"))
		}
		switch segment.GetState() {
		case commonpb.SegmentState_Importing, commonpb.SegmentState_Flushed:
			return true
		default:
			return pack.fail(merr.WrapErrSegmentNotFound(segmentID,
				"import segment is "+segment.GetState().String()+", its result is not accepted"))
		}
	}
}
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
			err = t.meta.UpdateSegmentsInfo(context.TODO(), opBinlog, opManifest, opState, opPosition, opStats)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `421d9866` are properly handled with clean fallback behavior.
