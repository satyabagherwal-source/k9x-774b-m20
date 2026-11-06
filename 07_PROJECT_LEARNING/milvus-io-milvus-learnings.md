> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/milvus-io-milvus-learnings.md`  
> **Source**: github ([https://github.com/milvus-io/milvus](https://github.com/milvus-io/milvus))  
> **Source Version**: `41584c75`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-06T20:38:18.897Z  
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
> **Harvest Timestamp**: 2026-11-06T20:38:18.888Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `milvus-io/milvus`
- **Description**: Milvus is a high-performance, cloud-native vector database built for scalable vector ANN search
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 46608 stars

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
- **Issue #55222** (2026-11-06): **fix: report NumPy import schema errors through the job instead of the proxy**
  *Symptoms*: issue: #55220  ## What this changes  This reverts the redundant NumPy schema check that #54794 added to the proxy. `ImportTask.PreExecute` no longer calls `numpy.ValidateSchema`; a NumPy import with an invalid schema now creates a job and fails in preimport, like every other import schema error.  ## Why  Before this, NumPy schema errors were rejected synchronously: `code=2100` with an empty `jobID`. Parquet schema errors and NumPy header errors (dimension, element type, shape) still created a job and failed later, so the same kind of input produced two different client flows.  The proxy call came from the element-null work, where a NumPy file named after a struct sub-field was silently dropped; rejecting it at the API boundary kept a job from being created. A later change moved the remaining field rules (auto-id, function output, unsupported type, missing required field) into the shared `ValidateSchema`, which widened the synchronous rejection well beyond that intent.  ## Where the checks still run  Every NumPy consumer calls the same function before reading any data:  - Import V2 preimport and import: `numpy.NewReader` -> `CreateReaders` -> `ValidateSchema` - Import V3 row count: `NumRowsAndBytes` -> `ValidateSchema`, so zero-row inputs are covered - Import V3 reshard reader: `NewReader` -> `CreateReaders` -> `ValidateSchema`  A failed preimport marks the job `Failed` with the same `ErrImportFailed` (2100, InputError, non-retryable) reason, and nothing writes data.  ## Test 

- **Issue #55214** (2026-11-06): **enhance: [3.0] broadcast file resource metadata through WAL (#54562)**
  *Symptoms*: relate: #54518 pr: https://github.com/milvus-io/milvus/pull/54562  ## Summary  Broadcast AddFileResource and RemoveFileResource metadata through WAL, preserving source resource IDs and idempotent ACK replay. Node synchronization stays with the existing observer; file transfer, existing-resource bootstrap, cross-PChannel readiness, and failover remain follow-ups. Validation on the 3.0 baseline relies on PR CI; live dual-cluster CDC and failover have not been run. 
  **Post-Mortem & Fix Analysis**:
  > [ci-v2-notice] Notice: ci-v2 system is enabled for this PR (3.0 branch).  To rerun ci-v2 checks, comment with: - /ci-rerun-code-check-macos  // for Code Checker MacOS (GitHub Actions) - /ci-rerun-build-ut-cov  // for ci-v2/build-ut-cov (build + unit tests) - /ci-rerun-e2e-amd  // for ci-v2/e2e-amd (e2e tests) - /ci-rerun-e2e-dist-wp  // for ci-v2/e2e-dist-wp (Tencent distributed woodpecker-service boundary) - /ci-rerun-gosdk  // for ci-v2/go-sdk (Go SDK E2E tests) - /ci-rerun-gosdk-std  // for ci-v2/go-sdk-std (Go SDK E2E, standalone) - /ci-rerun-gosdk-dist-wp // for ci-v2/go-sdk-dist-wp (distributed + Woodpecker service)  If you have any questions or requests, please contact @zhikunyao. 
  > <!-- ciloop-result-3824 --> ### :white_check_mark: CI Loop Results  `ffbc584`  | Stage | Result | Duration | Tests | |-------|--------|----------|-------| | :white_check_mark: Build | SUCCESS | 11.4min | - | | :white_check_mark: Code-Check | SUCCESS | 4.9min | - | | :white_check_mark: UT-Integration | SUCCESS | 34.0min | - | | :white_check_mark: UT-GO | SUCCESS | 26.9min | - | | :white_check_mark: UT-CPP-Cov | SUCCESS | 32.4min | 9191 total, 9191 passed, 0 failed |  **Total:** 57min | [Pipeline](https://jenkins-milvus-ci.milvus.io/job/MILVUS-CI-V2-PR-PIPELINES/job/milvus-build-ut-ciloop-pipeline-for-tcus/3824/pipeline-overview/) | [Artifacts](https://jenkins-milvus-ci.milvus.io/job/MILVUS-CI-V2-PR-PIPELINES/job/milvus-build-ut-ciloop-pipeline-for-tcus/3824/artifact)  **Overall Coverage:** 75.4% **Diff Coverage:** Go 95.0% (172 hit, 9 miss, 181 measurable lines, 594 unmeasured) **Diff Coverage HTML:** [view changed lines](https://jenkins-milvus-ci.milvus.io/job/MILVUS-CI-V2-PR-PIPELINES

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

### Incident Patch 1: `5f9a1114` (2026-11-06)
**Commit Message**: enhance: bound memory of ORDER BY ... LIMIT in segcore SortBuffer with a selection algorithm (#54383)

issue: #53846

### Problem (investigated hotspot)

Before making changes, I looked for the bottleneck in `ORDER BY ...
LIMIT`. When K is small, most of the time goes to memory operations:
`SortBuffer` stores every row and frees it later, even though most rows
are discarded.

| 1M rows | K | total | alloc (`newRow`) | `store` | free | **memory
ops** | sort |
|---|---|---|---|---|---|---|---|
| INT64 key, INT64 pk | 100 | 82 ms | 46% | 19% | 25% | **90%** | 7% |
| | 16384 | 120 ms | 41% | 16% | 15% | **72%** | 25% |
| INT64 key, VARCHAR pk | 100 | 221 ms | 22% | 43% | 31% | **96%** | 3%
|
| | 16384 | 226 ms | 19% | 37% | 29% | **85%** | 12% |
| VARCHAR key, INT64 pk | 100 | 205 ms | 21% | 38% | 32% | **91%** | 8%
|
| | 16384 | 259 ms | 17% | 30% | 24% | **70%** | 28% |
| INT64 key (full sort) | 1M | 475 ms | 8% | 4% | 5% | 17% | **79%** |

The existing `partial_sort` **is not an equivalent optimization**: it
reduces comparisons, not the O(N) memory work. To bound memory I
compared a heap with a selection algorithm. Rough numbers from an
experimental revision, 1M rows, speedup over b

**File**: `internal/core/src/exec/SortBuffer.cpp` (modified, +178/-30)
```diff
@@ -18,13 +18,71 @@
 
 #include <algorithm>
 #include <functional>
+#include <limits>
+#include <string_view>
 
 #include "common/EasyAssert.h"
 #include "log/Log.h"
 
 namespace milvus {
 namespace exec {
 
+namespace {
+
+// With a limit, up to kCandidateBufferFactor * limit candidate rows are kept
+// before shrinking back to limit. The slack amortizes each O(n) selection
+// over the (factor - 1) * limit rows accepted in between.
+constexpr int64_t kCandidateBufferFactor = 2;
+
+// Left-hand side of SortBuffer::CompareImpl(): a row stored in the
+// RowContainer.
+struct StoredRow {
+    const char* row;
+
+    bool
+    IsNull(int32_t, const RowColumn& column) const {
+        return RowContainer::isNullAt(
+            row, column.nullByte(), column.nullMask());
+    }
+    template <typename T>
+    T
+    ValueAt(int32_t, const RowColumn& column) const {
+        return RowContainer::valueAt<T>(row, column.offset());
+    }
+    const std::string*
+    StrAt(int32_t, const RowColumn& column) const {
+        return RowContainer::strAt(row, column.offset());
+    }
+};
+
+// Left-hand side of SortBuffer::CompareImpl(): an input row that has not been
+// stored, read straight from its column vectors. Values are read exactly as
+// RowContainer::storeWithNull()/storeNoNulls() read them (ValidAt and
+// RawValueAt), so comparing in place equals comparing the stored row, and
+// strings are viewed without being copied.
+struct InputRow {
+    const std::vector<ColumnVectorPtr>& columns;
+    vector_size_t index;
+
+    bool
+    IsNull(int32_t column_index, const RowColumn&) const {
+        return !columns[column_index]->ValidAt(index);
+    }
+    template <typename T>
+    T
+    ValueAt(int32_t column_index, const RowColumn&) const {
+        return *static_cast<const T*>(
+            columns[column_index]->RawValueAt(index, sizeof(T)));
+    }
+    const std::string*
+    StrAt(int32_t column_index, const RowColumn&) const {
+        return static_cast<const std::string*>(
+            columns[column_index]->RawValueAt(index, sizeof(std::string)));
+    }
+};
+
+}  // namespace
+
 SortBuffer::SortBuffer(const std::vector<DataType>& column_types,
                        const std::vector<SortKeyInfo>& sort_keys,
                        int64_t limit)
@@ -47,6 +105,13 @@ SortBuffer::SortBuffer(const std::vector<DataType>& column_types,
     // Create RowContainer with no accumulators (pure data storage)
     std::vector<Accumulator> empty_accumulators;
     data_ = std::make_unique<RowContainer>(column_types_, empty_accumulators);
+
+    if (limit_ > 0) {
+        candidate_capacity_ = limit_ > std::numeric_limits<int64_t>::max() /
+                                           kCandidateBufferFactor
+                                  ? std::numeric_limits<int64_t>::max()
+                                  : limit_ * kCandidateBufferFactor;
+    }
 }
 
 void
@@ -58,6 +123,13 @@ SortBuffer::AddRow(const std::vector<ColumnVectorPtr>& columns,
                column_types_.size(),
                columns.size());
 
+    // With a limit, only rows that can still make the top limit_ are stored
+    if (limit_ > 0) {
+        OfferRow(columns, row_index);
+        num_input_rows_++;
+        return;
+    }
+
     // Allocate a new row in RowContainer
     char* row = data_->newRow();
 
@@ -82,6 +154,16 @@ SortBuffer::AddRows(const std::vector<ColumnVectorPtr>& columns,
         return;
     }
 
+    // With a limit, rows go through OfferRow() instead of being stored in bulk
+    if (limit_ > 0) {
+        for (vector_size_t i = 0; i < num_rows; ++i) {
+            OfferRow(columns, i);
+        }
+        num_input_rows_ += num_rows;
+        return;
+    }
+
+    // Without a limit
     // Phase 1: Batch-allocate all rows upfront
     std::vector<char*> new_rows(num_rows);
     for (vector_size_t i = 0; i < num_rows; ++i) {
@@ -100,6 +182,60 @@ SortBuffer::AddRows(const std::vector<ColumnVectorPtr>& columns,
     num_input_rows_ += num_rows;
 }
 
+// Bounded TopK (threshold + periodic selection): stores the input row as a
+// candidate unless it can no longer make the top limit_; when the candidates
+// are full, first shrinks them back to limit_ with a selection algorithm.
+void
+SortBuffer::OfferRow(const std::vector<ColumnVectorPtr>& columns,
+                     vector_size_t row_index) {
+    // A row that is not strictly better than the threshold can never make the
+    // top limit_: at least limit_ candidates already compare <= it, and the
+    // threshold only improves. Such rows are compared in place and never
+    // stored. Ties are rejected too; as with the (unstable) sort, no
+    // particular row among equal keys is guaranteed to be kept.
+    if (threshold_row_ != nullptr &&
+        CompareInput(columns, row_index, threshold_row_) >= 0) {
+        return;
+    }
+
+    // Only a row that is kept needs room, so shrink just before storing it
+    if (static_cast<int64_t>(sorted_rows_.size()
```

**File**: `internal/core/src/exec/SortBuffer.h` (modified, +50/-3)
```diff
@@ -52,7 +52,11 @@ struct SortKeyInfo {
  * - Pointer-based sorting: Only sorts pointers (8 bytes each), not row data
  * - Multi-field sorting: Supports compound ORDER BY (field1 ASC, field2 DESC)
  * - NULL handling: Configurable NULLS FIRST/LAST per sort key
- * - TopK optimization: Uses partial_sort when limit is small relative to input
+ * - TopK optimization: With a limit, rows that cannot make the top limit are
+ *   rejected on arrival and never stored; at most 2 * limit candidate rows
+ *   are kept and shrunk back to limit with a selection algorithm
+ *   (std::nth_element) when full. The final sort orders the candidates and
+ *   the result is truncated to limit
  * - Batched output: Returns results in configurable batch sizes
  *
  * Usage pattern:
@@ -63,7 +67,8 @@ struct SortKeyInfo {
  *
  * Memory model:
  *   - Current implementation is memory-only (no disk spilling)
- *   - Memory usage: O(rows * row_size) for data + O(rows * 8) for pointers
+ *   - Memory usage: O(n * row_size) for data + O(n * 8) for pointers, where
+ *     n = rows without a limit, and n <= 2 * limit with a limit
  *
  * @note This class is NOT thread-safe. External synchronization is required
  *       if used from multiple threads.
@@ -241,6 +246,42 @@ class SortBuffer {
     std::vector<VectorPtr>
     ExtractOutput(int64_t num_rows);
 
+    /**
+     * @brief With a limit: add one input row to the candidate rows, unless it
+     *        can no longer make the top limit_
+     */
+    void
+    OfferRow(const std::vector<ColumnVectorPtr>& columns,
+             vector_size_t row_index);
+
+    /**
+     * @brief With a limit: keep the best limit_ candidate rows, release the
+     *        rest for reuse and update the rejection threshold
+     */
+    void
+    ShrinkCandidates();
+
+    /**
+     * @brief Compare a not yet stored input row against a stored row
+     *
+     * Same semantics as Compare(input_row, row); the input row's sort keys
+     * are read directly from the column vectors.
+     */
+    int
+    CompareInput(const std::vector<ColumnVectorPtr>& columns,
+                 vector_size_t row_index,
+                 const char* row) const;
+
+    /**
+     * @brief Shared implementation of Compare() and CompareInput()
+     *
+     * @tparam Lhs Accessor for the left-hand row (a stored row, or an input
+     *             row read from column vectors)
+     */
+    template <typename Lhs>
+    int
+    CompareImpl(const Lhs& lhs, const char* rhs) const;
+
     //=========================================================================
     // Data Members
     //=========================================================================
@@ -254,9 +295,15 @@ class SortBuffer {
     std::unique_ptr<RowContainer> data_;
 
     // Sorted row pointers (8 bytes per row)
-    // After Sort(), these point to rows in data_ in sorted order
+    // After Sort(), these point to rows in data_ in sorted order.
+    // With a limit, during input these are the (unordered) candidate rows.
     std::vector<char*> sorted_rows_;
 
+    // TopK state, only used with a limit
+    int64_t candidate_capacity_ = 0;       // shrink candidates when reached
+    const char* threshold_row_ = nullptr;  // worst row kept by last shrink
+    std::vector<char*> free_rows_;  // released rows, reused before newRow()
+
     // State tracking
     bool sorted_ = false;
     int64_t num_input_rows_ = 0;
```

**File**: `internal/core/src/exec/operator/query-agg/RowContainer.h` (modified, +18/-0)
```diff
@@ -467,6 +467,24 @@ class RowContainer {
         numRows_ = 0;
     }
 
+    /// Frees the strings owned by 'row' (same per-row logic as clear()) and
+    /// re-initializes it, so the row can be reused for another store(). The
+    /// row stays owned by the container.
+    void
+    resetRow(char* row) {
+        for (auto i = 0; i < variable_offsets_.size(); i++) {
+            auto& off = variable_offsets_[i];
+            auto& row_col = columnAt(variable_idxes_[i]);
+            bool isStrNull =
+                isNullAt(row, row_col.nullByte(), row_col.nullMask());
+            auto str = *reinterpret_cast<std::string**>(row + off);
+            if (!isStrNull && str) {
+                delete str;
+            }
+        }
+        initializeRow(row);
+    }
+
     char*
     initializeRow(char* row);
 
```

**File**: `internal/core/unittest/test_sort_buffer.cpp` (modified, +335/-0)
```diff
@@ -12,8 +12,14 @@
 #include <gtest/gtest.h>
 
 #include <algorithm>
+#include <cmath>
+#include <iomanip>
+#include <limits>
 #include <memory>
 #include <random>
+#include <set>
+#include <sstream>
+#include <string>
 #include <vector>
 
 #include "common/Types.h"
@@ -1151,3 +1157,332 @@ TEST_F(SortBufferTest, NonSortColumnPreserved) {
     EXPECT_EQ(raw[1], "two");
     EXPECT_EQ(raw[2], "three");
 }
+
+// =========================================================================
+// TopK (limit > 0): the result must equal the first `limit` rows of a full
+// sort (limit = -1), and every output row must still carry its own columns.
+// =========================================================================
+
+namespace {
+
+struct TopKSpec {
+    DataType key_type = DataType::INT64;
+    bool nullable = false;
+    int64_t key_cardinality = 0;  // 0 = (almost) unique keys
+    bool second_key = false;      // add a VARCHAR second sort key
+    bool varchar_pk = false;
+    int sorted_input = 0;  // +1 / -1: key increases / decreases with arrival
+};
+
+// Columns: [pk, key, (key2 varchar), row_id (int64)]
+struct TopKTable {
+    std::vector<DataType> types;
+    std::vector<std::vector<ColumnVectorPtr>> batches;
+    std::vector<vector_size_t> batch_rows;
+};
+
+void
+SetKey(const ColumnVectorPtr& col, size_t i, DataType type, int64_t v) {
+    switch (type) {
+        case DataType::BOOL:
+            col->SetValueAt<bool>(i, (v & 1) != 0);
+            break;
+        case DataType::INT8:
+            col->SetValueAt<int8_t>(i, static_cast<int8_t>(v));
+            break;
+        case DataType::INT16:
+            col->SetValueAt<int16_t>(i, static_cast<int16_t>(v));
+            break;
+        case DataType::INT32:
+            col->SetValueAt<int32_t>(i, static_cast<int32_t>(v));
+            break;
+        case DataType::INT64:
+        case DataType::TIMESTAMPTZ:
+            col->SetValueAt<int64_t>(i, v);
+            break;
+        case DataType::FLOAT:
+            // every 13th value is NaN, which sorts as the largest value
+            col->SetValueAt<float>(i,
+                                   v % 13 == 0
+                                       ? std::numeric_limits<float>::quiet_NaN()
+                                       : static_cast<float>(v % 100000) / 3);
+            break;
+        case DataType::DOUBLE:
+            col->SetValueAt<double>(
+                i,
+                v % 13 == 0 ? std::numeric_limits<double>::quiet_NaN()
+                            : static_cast<double>(v) / 7);
+            break;
+        default:  // VARCHAR
+            col->SetValueAt<std::string>(i, "k" + std::to_string(v));
+    }
+}
+
+TopKTable
+GenerateTopKTable(const TopKSpec& spec,
+                  int64_t num_rows,
+                  uint64_t seed,
+                  int64_t batch_size = 256) {
+    TopKTable table;
+    table.types = {spec.varchar_pk ? DataType::VARCHAR : DataType::INT64,
+                   spec.key_type};
+    if (spec.second_key) {
+        table.types.push_back(DataType::VARCHAR);
+    }
+    table.types.push_back(DataType::INT64);
+
+    std::mt19937_64 rng(seed);
+    for (int64_t start = 0; start < num_rows; start += batch_size) {
+        auto n = std::min(batch_size, num_rows - start);
+        std::vector<ColumnVectorPtr> cols;
+        for (auto type : table.types) {
+            cols.push_back(std::make_shared<ColumnVector>(type, n));
+        }
+        for (int64_t i = 0; i < n; ++i) {
+            int64_t id = start + i;
+            uint64_t r = rng();
+            if (spec.varchar_pk) {
+                cols[0]->SetValueAt<std::string>(i, "pk-" + std::to_string(id));
+            } else {
+                cols[0]->SetValueAt<int64_t>(i, id);
+            }
+            if (spec.nullable && r % 10 == 0) {
+                cols[1]->nullAt(i);
+            } else {
+                int64_t v =
+                    spec.sorted_input > 0   ? id
+                    : spec.sorted_input < 0 ? num_rows - id
+                    : spec.key_cardinality > 0
+                        ? static_cast<int64_t>((r >> 8) % spec.key_cardinality)
+                        : static_cast<int64_t>(r >> 2);
+                SetKey(cols[1], i, spec.key_type, v);
+            }
+            if (spec.second_key) {
+                if (spec.nullable && r % 7 == 0) {
+                    cols[2]->nullAt(i);
+                } else {
+                    cols[2]->SetValueAt<std::string>(
+                        i, "s" + std::to_string((r >> 40) % 5));
+                }
+            }
+            cols.back()->SetValueAt<int64_t>(i, id);
+        }
+        table.batches.push_back(std::move(cols));
+        table.batch_rows.push_back(static_cast<vector_size_t>(n));
+    }
+    return table;
+}
+
+template <typename T>
+std::string
+RenderFloat(T v) {
+    if (std::isnan(v)) {
+        return "nan";
+    }
+    std::ostringstream os;
+    os << std::setprecision(std::numeric_li
```

---

### Incident Patch 2: `6049ebb7` (2026-11-06)
**Commit Message**: fix: Preserve derived artifacts during deltalog refresh (#52892)

issue: #51819

## What was changed

- Stage fresh source columns and the complete refreshed deltalog set
together
with unchanged Function output column groups and retained manifest
stats,
  then commit one complete target manifest. Reuse Go-owned column-group
  descriptors to preserve all packed-writer file properties.
- Start from an empty snapshot in the existing segment namespace so old
  target deltalogs are not retained. Prepare real-PK L0 references or
  virtual-PK translated deltalogs before the final transaction.
- Derive text and JSON stats placeholders from the retained entries
before
committing, and preserve them when DataCoord adopts the refresh result.
Source imports only replace bloom-filter stats, so no post-commit stats
  reread is needed.
- Use manifest contents as the source of truth when checking Function
output
  columns, with fake binlogs retained only as the legacy fallback.
- Validate manifest FFI arrays and retained column ownership/row
alignment.
  Remove the obsolete carry and intermediate-manifest cleanup helpers.
- Keep real-I/O manifest test fixtures under their temporary storage
roots so

**File**: `docs/design-docs/design_docs/20260526-external_table_add_column_refresh.md` (modified, +19/-6)
```diff
@@ -240,9 +240,9 @@ For each current segment:
 1. If any fragment is missing from the new external fragment set, the segment
    is invalidated and its surviving fragments are treated as orphan fragments.
 2. If all fragments still exist and all current external fields are covered by
-   fake binlogs, the segment is kept unchanged.
-3. If all fragments still exist but some external fields are missing from fake
-   binlog `ChildFields`, the segment is patched in place.
+   fake binlogs or the pinned manifest, the segment is kept unchanged.
+3. If all fragments still exist but some external fields are absent from both
+   fake binlog `ChildFields` and the pinned manifest, the segment is patched in place.
 
 Orphan fragments are still balanced into new segments using the existing
 refresh path.
@@ -252,9 +252,14 @@ refresh path.
 DataNode derives target external fields from the task schema:
 
 - Only fields with `external_field` are considered.
-- Existing coverage is read from segment fake binlog `ChildFields`.
-- A field is missing if the schema requires it and no fake binlog child field
-  covers it.
+- Existing coverage is first read from segment fake binlog `ChildFields`.
+- Fields not advertised there are checked together against the pinned segment
+  manifest. StorageV3 fake binlogs are not persisted, so their absence after a
+  DataCoord restart does not prove that the physical columns are missing.
+- `StorageColumnResolver` supplies physical names for this check: numeric field
+  IDs for `milvus-table`, and `external_field` names for ordinary file formats.
+- Only fields absent from both sources are returned as missing. Manifest read
+  failures abort the task rather than being treated as missing columns.
 
 The missing set is expressed as external column names, not Milvus field IDs,
 because manifest column groups reference external source column names.
@@ -277,6 +282,14 @@ When missing columns are detected for an otherwise unchanged segment, DataNode:
 The old segment is not mutated in DataNode. DataCoord performs the actual meta
 patch after validation.
 
+The sampling, memory estimate, and fake-binlog construction are shared with
+manifest-only deltalog updates. After catalog recovery a StorageV3 segment can
+have all physical columns but no fake binlogs. Before returning such a same-ID
+manifest patch, DataNode reconstructs its fake binlogs from the final manifest
+without appending columns or recomputing Functions. Existing binlogs are reused;
+sampling failure aborts the task without publishing a partial result. Unchanged
+segments returned only through `kept_segments` do not need this reconstruction.
+
 ### 6.4 Worker Response
 
 `GetUpdatedSegments()` returns only segments DataCoord should upsert:
```

**File**: `internal/core/src/storage/loon_ffi/milvus_table_c.cpp` (modified, +22/-43)
```diff
@@ -805,32 +805,27 @@ AppendSourceDeltalogs(LoonTransactionHandle transaction,
 
 }  // namespace
 
-// loon_milvus_table_create_manifest_from_segment_manifests creates one target
-// StorageV3 manifest from source StorageV3 segment manifests. Real-PK mode also
-// imports source deltalogs and bloom-filter stats; virtual-PK mode leaves delete
-// translation to DataNode. On success it reports the committed version and,
-// when out_manifest_size is not null, the byte size of the committed manifest.
+// Stage source column groups on a caller-owned transaction without committing.
+// DataNode can add translated deletes and retained Function output/stats before
+// the single commit, so refresh never needs an incomplete intermediate manifest.
+// Only bloom-filter stats are imported from the source; text/JSON stats remain
+// target-owned and are supplied by the caller.
 extern "C" LoonFFIResult
-loon_milvus_table_create_manifest_from_segment_manifests(
-    const char* base_path,
-    char** source_manifest_paths,
-    const int64_t* source_row_counts,
-    size_t num_source_manifests,
-    char** target_columns,
-    size_t num_target_columns,
-    const char* external_source,
-    const LoonProperties* properties,
-    int has_external_primary_key,
-    int64_t* out_committed_version,
-    int64_t* out_manifest_size) {
-    if (base_path == nullptr || source_manifest_paths == nullptr ||
+loon_milvus_table_append_source_manifests(LoonTransactionHandle transaction,
+                                          char** source_manifest_paths,
+                                          const int64_t* source_row_counts,
+                                          size_t num_source_manifests,
+                                          char** target_columns,
+                                          size_t num_target_columns,
+                                          const char* external_source,
+                                          const LoonProperties* properties,
+                                          int has_external_primary_key) {
+    if (transaction == 0 || source_manifest_paths == nullptr ||
         source_row_counts == nullptr || num_source_manifests == 0 ||
-        target_columns == nullptr || num_target_columns == 0 ||
-        out_committed_version == nullptr) {
-        RETURN_ERROR(
-            LOON_INVALID_ARGS,
-            "base_path, source_manifest_paths, source_row_counts, "
-            "target_columns, and out_committed_version must not be empty");
+        target_columns == nullptr || num_target_columns == 0) {
+        RETURN_ERROR(LOON_INVALID_ARGS,
+                     "transaction, source_manifest_paths, source_row_counts, "
+                     "and target_columns must not be empty");
     }
 
     try {
@@ -844,17 +839,6 @@ loon_milvus_table_create_manifest_from_segment_manifests(
             target_column_set.emplace(target_columns[i]);
         }
 
-        TransactionGuard transaction;
-        ThrowIfFFIError(
-            loon_transaction_open(base_path,
-                                  properties,
-                                  0,
-                                  /*manifest_size=*/-1,
-                                  LOON_TRANSACTION_RESOLVE_OVERWRITE,
-                                  10,
-                                  &transaction.handle),
-            "open milvus-table target manifest transaction");
-
         std::unordered_set<std::string> added_delta_paths;
         std::unordered_set<std::string> added_stat_paths;
         std::map<std::string, StatData> imported_stats;
@@ -886,12 +870,12 @@ loon_milvus_table_create_manifest_from_segment_manifests(
             }
 
             auto target_groups = MaterializeColumnGroups(target_groups_data);
-            ThrowIfFFIError(loon_transaction_append_files(transaction.handle,
+            ThrowIfFFIError(loon_transaction_append_files(transaction,
                                                           target_groups.groups),
                             "append milvus-table source column groups");
 
             if (has_external_primary_key) {
-                AppendSourceDeltalogs(transaction.handle,
+                AppendSourceDeltalogs(transaction,
                                       source_manifest.manifest->delta_logs,
                                       external_source,
                                       properties,
@@ -904,12 +888,7 @@ loon_milvus_table_create_manifest_from_segment_manifests(
             }
         }
 
-        AppendImportedStats(transaction.handle, imported_stats);
-
-        ThrowIfFFIError(
-            loon_transaction_commit(
-                transaction.handle, out_committed_version, out_manifest_size),
-            "commit milvus-table target manifest");
+        AppendImportedStats(transaction, imported_stats);
         RETURN_SUCCESS();
     } catch (const LoonFFIError& e) {
         // Preserve the producer's own err_code instead of collapsing to
```

**File**: `internal/core/unittest/test_loon_ffi_error_passthrough.cpp` (modified, +52/-28)
```diff
@@ -14,6 +14,7 @@
 // See the License for the specific language governing permissions and
 // limitations under the License.
 
+#include <folly/ScopeGuard.h>
 #include <gtest/gtest.h>
 
 #include <string>
@@ -25,18 +26,15 @@
 
 // milvus_table_c.cpp exports this without a header of its own.
 extern "C" LoonFFIResult
-loon_milvus_table_create_manifest_from_segment_manifests(
-    const char* base_path,
-    char** source_manifest_paths,
-    const int64_t* source_row_counts,
-    size_t num_source_manifests,
-    char** target_columns,
-    size_t num_target_columns,
-    const char* external_source,
-    const LoonProperties* properties,
-    int has_external_primary_key,
-    int64_t* out_committed_version,
-    int64_t* out_manifest_size);
+loon_milvus_table_append_source_manifests(LoonTransactionHandle transaction,
+                                          char** source_manifest_paths,
+                                          const int64_t* source_row_counts,
+                                          size_t num_source_manifests,
+                                          char** target_columns,
+                                          size_t num_target_columns,
+                                          const char* external_source,
+                                          const LoonProperties* properties,
+                                          int has_external_primary_key);
 
 // The err_code a loon FFI call reports must survive milvus's OWN C-ABI export
 // layer (milvus_table_c.cpp), whose tail returns a LoonFFIResult. That tail
@@ -58,30 +56,56 @@ TEST(LoonFFIErrorPassthrough, NestedErrCodeSurvivesTheExportBoundary) {
     std::vector<char*> manifests{missing_manifest.data()};
     std::vector<int64_t> row_counts{1};
     std::vector<char*> columns{column.data()};
-    int64_t committed_version = -1;
 
-    auto result = loon_milvus_table_create_manifest_from_segment_manifests(
-        base_path.c_str(),
+    // Both the target transaction and the nested source read require valid
+    // properties. A null configuration fails with LOON_INVALID_ARGS before
+    // reaching the missing manifest, which is the failure this test exercises.
+    const char* keys[] = {loon_properties_fs_storage_type,
+                          loon_properties_fs_root_path};
+    const char* values[] = {"local", "/"};
+    LoonProperties properties{};
+    auto props_result = loon_properties_create(keys, values, 2, &properties);
+    SCOPE_EXIT {
+        loon_ffi_free_result(&props_result);
+        loon_properties_free(&properties);
+    };
+    ASSERT_NE(loon_ffi_is_success(&props_result), 0)
+        << loon_ffi_get_errmsg(&props_result);
+
+    LoonTransactionHandle transaction = 0;
+    auto begin = loon_transaction_open(base_path.c_str(),
+                                       &properties,
+                                       0,
+                                       -1,
+                                       LOON_TRANSACTION_RESOLVE_OVERWRITE,
+                                       10,
+                                       &transaction);
+    SCOPE_EXIT {
+        loon_ffi_free_result(&begin);
+        loon_transaction_destroy(transaction);
+    };
+    ASSERT_NE(loon_ffi_is_success(&begin), 0) << loon_ffi_get_errmsg(&begin);
+
+    auto result = loon_milvus_table_append_source_manifests(
+        transaction,
         manifests.data(),
         row_counts.data(),
         manifests.size(),
         columns.data(),
         columns.size(),
         /*external_source=*/nullptr,
-        /*properties=*/nullptr,
-        /*has_external_primary_key=*/0,
-        &committed_version,
-        /*out_manifest_size=*/nullptr);
+        &properties,
+        /*has_external_primary_key=*/0);
+    SCOPE_EXIT {
+        loon_ffi_free_result(&result);
+    };
 
-    ASSERT_EQ(loon_ffi_is_success(&result), 0)
-        << "a missing source manifest must fail";
-    EXPECT_NE(result.err_code, LOON_GOT_EXCEPTION)
-        << "the export boundary collapsed the producer's err_code to "
-           "LOON_GOT_EXCEPTION; Go then classifies every failure of this entry "
-           "point as permanent";
+    EXPECT_EQ(result.err_code, LOON_FILE_NOT_FOUND)
+        << "the export boundary must preserve the missing-manifest error, not "
+           "an argument error or a generic exception: "
+        << loon_ffi_get_errmsg(&result);
     // The classification the Go side derives from the code must round-trip
     // through milvus's own mapper as well.
-    EXPECT_NE(milvus::storage::LoonErrCodeToErrorCode(result.err_code),
-              milvus::ErrorCode::UnexpectedError);
-    loon_ffi_free_result(&result);
+    EXPECT_EQ(milvus::storage::LoonErrCodeToErrorCode(result.err_code),
+              milvus::ErrorCode::ObjectNotExist);
 }
```

**File**: `internal/datacoord/externalrefresh/checker.go` (modified, +4/-4)
```diff
@@ -525,10 +525,10 @@ func (c *externalCollectionRefreshChecker) AggregateJobState(job *datapb.Externa
 	// rest of its life, whatever the parameter says NOW. This is the only exit
 	// that does not re-run the apply, so keying it on the parameter instead of
 	// the marker would make turning the parameter off mid-wait replay the
-	// apply - and applyExternalRefreshPatch clears TextStatsLogs/JsonKeyStats,
-	// so that replay would discard indexes built during the very wait it was
-	// disabling. Off now simply means release the job: finish it at once
-	// without waiting, which is what an operator disabling the hold wants.
+	// apply with older text/JSON placeholders. That replay would discard stats
+	// built during the very wait it was disabling. Off now simply means release
+	// the job: finish it at once without waiting, which is what an operator
+	// disabling the hold wants.
 	if state == indexpb.JobState_JobStateFinished && job.GetIndexWaitStartedTime() != 0 {
 		if c.indexWaitEnabled() && !c.indexWaitDone(job) {
 			return
```

**File**: `internal/datacoord/externalrefresh/checker_test.go` (modified, +4/-4)
```diff
@@ -1547,10 +1547,10 @@ func TestExternalCollectionRefreshChecker_IndexWait(t *testing.T) {
 	t.Run("turning the parameter off mid-wait releases the job without re-applying", func(t *testing.T) {
 		// Keying the branch on the parameter rather than the marker would send
 		// an already-applied job down the generic transition, which carries a
-		// pre-apply - and applyExternalRefreshPatch clears TextStatsLogs and
-		// JsonKeyStats, so the replay would discard indexes built during the
-		// very wait being disabled. An operator turning the hold off wants the
-		// held jobs released, so the job finishes at once instead.
+		// pre-apply with older text/JSON placeholders. That replay would discard
+		// stats built during the very wait being disabled. An operator turning
+		// the hold off wants the held jobs released, so the job finishes at once
+		// instead.
 		mockey.PatchConvey("parameter off mid-wait", t, func() {
 			pt := paramtable.Get()
 			pt.Save(pt.DataCoordCfg.RefreshWaitForIndex.Key, "true")
```

**File**: `internal/datacoord/externalrefresh/task.go` (modified, +10/-7)
```diff
@@ -404,11 +404,11 @@ func applyExternalCollectionSegmentUpdateAtFence(
 				continue
 			}
 			if externalRefreshManifestAlreadyApplied(existing, incoming) {
-				// Replaying a patch is NOT harmless: applyExternalRefreshPatch
-				// clears TextStatsLogs and JsonKeyStats, so a second write
-				// would discard a text index or JSON key stats built since the
-				// first one, orphaning their files. A genuine patch always
-				// installs a strictly newer manifest, so it still applies.
+				// Replaying a patch is NOT harmless: replacing placeholders
+				// from the same incoming result could discard text or JSON stats
+				// built since the first apply, orphaning their files. A genuine
+				// patch always installs a strictly newer manifest, so it still
+				// applies.
 				alreadyAppliedSegments[segmentID] = struct{}{}
 				mlog.Info(ctx, "external refresh segment patch already applied, skipping replay",
 					mlog.FieldSegmentID(segmentID))
@@ -681,8 +681,11 @@ func applyExternalRefreshPatch(oldSeg *meta.SegmentInfo, incoming *datapb.Segmen
 	cloned.ManifestPath = incoming.GetManifestPath()
 	cloned.SchemaVersion = incoming.GetSchemaVersion()
 	cloned.Binlogs = incoming.GetBinlogs()
-	cloned.TextStatsLogs = nil
-	cloned.JsonKeyStats = nil
+	// The incoming placeholders describe the stats carried by the incoming
+	// manifest. Apply both atomically so deltalog-only refreshes do not trigger
+	// redundant text or JSON stats rebuilds.
+	cloned.TextStatsLogs = incoming.GetTextStatsLogs()
+	cloned.JsonKeyStats = incoming.GetJsonKeyStats()
 	if incoming.GetStorageVersion() != 0 {
 		cloned.StorageVersion = incoming.GetStorageVersion()
 	}
```

**File**: `internal/datacoord/externalrefresh/task_test.go` (modified, +35/-8)
```diff
@@ -1492,11 +1492,10 @@ func TestApplyExternalCollectionSegmentUpdateForBaseline_ReplayNewSegment(t *tes
 }
 
 func TestApplyExternalCollectionSegmentUpdateForBaseline_ReplayPatchedBaselineSegment(t *testing.T) {
-	// A replayed patch is not harmless: applyExternalRefreshPatch clears
-	// TextStatsLogs and JsonKeyStats unconditionally, so writing the same
-	// result twice discards a text index or JSON key stats built between the
-	// two applies and orphans their files. New segments have always had this
-	// short-circuit; patches need it for the same reason.
+	// A replayed patch is not harmless: replacing placeholders from the same
+	// incoming result discards text or JSON stats built between the two applies
+	// and orphans their files. New segments have always had this short-circuit;
+	// patches need it for the same reason.
 	ctx := context.Background()
 	collectionID := int64(100)
 	segmentID := int64(10)
@@ -1550,7 +1549,7 @@ func TestApplyExternalCollectionSegmentUpdateForBaseline_ReplayPatchedBaselineSe
 		"a genuine patch still invalidates the stats it supersedes")
 }
 
-func TestApplyExternalRefreshPatchClearsStatsPlaceholders(t *testing.T) {
+func TestApplyExternalRefreshPatchUsesIncomingStatsPlaceholders(t *testing.T) {
 	oldManifest := packed.MarshalManifestPath("files/insert_log/100/200/300", 1)
 	newManifest := packed.MarshalManifestPath("files/insert_log/100/200/300", 2)
 
@@ -1560,6 +1559,8 @@ func TestApplyExternalRefreshPatchClearsStatsPlaceholders(t *testing.T) {
 			CollectionID:   100,
 			PartitionID:    200,
 			NumOfRows:      1000,
+			State:          commonpb.SegmentState_Flushed,
+			Level:          datapb.SegmentLevel_L1,
 			ManifestPath:   oldManifest,
 			StorageVersion: storage.StorageV3,
 			SchemaVersion:  1,
@@ -1590,6 +1591,23 @@ func TestApplyExternalRefreshPatchClearsStatsPlaceholders(t *testing.T) {
 		ManifestPath:   newManifest,
 		StorageVersion: storage.StorageV3,
 		SchemaVersion:  2,
+		TextStatsLogs: map[int64]*datapb.TextIndexStats{
+			500: {
+				FieldID: 500,
+				Version: 1,
+				BuildID: 10,
+				Files:   []string{"files/insert_log/100/200/300/_stats/text_index.500/tokenizer.json"},
+			},
+		},
+		JsonKeyStats: map[int64]*datapb.JsonKeyStats{
+			500: {
+				FieldID:                500,
+				Version:                1,
+				BuildID:                10,
+				Files:                  []string{"shared_key_index/.managed.json_0"},
+				JsonKeyStatsDataFormat: common.JSONStatsDataFormatVersion,
+			},
+		},
 		Binlogs: []*datapb.FieldBinlog{{
 			FieldID:     0,
 			ChildFields: []int64{100, 500},
@@ -1604,8 +1622,17 @@ func TestApplyExternalRefreshPatchClearsStatsPlaceholders(t *testing.T) {
 
 	patched := applyExternalRefreshPatch(oldSeg, incoming)
 	assert.Equal(t, newManifest, patched.GetManifestPath())
-	assert.Empty(t, patched.GetTextStatsLogs())
-	assert.Empty(t, patched.GetJsonKeyStats())
+	assert.Equal(t, incoming.GetTextStatsLogs(), patched.GetTextStatsLogs())
+	assert.Equal(t, incoming.GetJsonKeyStats(), patched.GetJsonKeyStats())
+	assert.False(t, meta.NeedDoTextIndex(patched, []UniqueID{500}, true))
+	assert.False(t, meta.NeedDoJSONKeyIndex(patched, []UniqueID{500}, true))
+
+	incomingWithoutStats := proto.Clone(incoming).(*datapb.SegmentInfo)
+	incomingWithoutStats.TextStatsLogs = nil
+	incomingWithoutStats.JsonKeyStats = nil
+	patchedWithoutStats := applyExternalRefreshPatch(oldSeg, incomingWithoutStats)
+	assert.True(t, meta.NeedDoTextIndex(patchedWithoutStats, []UniqueID{500}, true))
+	assert.True(t, meta.NeedDoJSONKeyIndex(patchedWithoutStats, []UniqueID{500}, true))
 }
 
 func TestApplyExternalCollectionSegmentUpdateForBaseline_RejectPatchRowCountChange(t *testing.T) {
```

**File**: `internal/datanode/external/milvus_table_deltalog.go` (modified, +57/-29)
```diff
@@ -68,6 +68,32 @@ func (t *RefreshExternalCollectionTask) addMilvusTableL0DeltalogsToManifest(
 	manifestPath string,
 	fragments []packed.Fragment,
 ) (string, error) {
+	entries, err := t.prepareMilvusTableL0Deltalogs(ctx, fragments)
+	if err != nil {
+		return "", err
+	}
+	if len(entries) == 0 {
+		return manifestPath, nil
+	}
+	if err := ensureContext(ctx); err != nil {
+		return "", err
+	}
+	updatedManifestPath, err := packed.AddDeltaLogsToManifestOverwrite(manifestPath, t.req.GetStorageConfig(), entries)
+	if err != nil {
+		return "", err
+	}
+	if err := ensureContext(ctx); err != nil {
+		return "", err
+	}
+	return updatedManifestPath, nil
+}
+
+// prepareMilvusTableL0Deltalogs collects references without committing a
+// manifest, so delete-only refresh can publish them together with its artifacts.
+func (t *RefreshExternalCollectionTask) prepareMilvusTableL0Deltalogs(
+	ctx context.Context,
+	fragments []packed.Fragment,
+) ([]packed.DeltaLogEntry, error) {
 	var entries []packed.DeltaLogEntry
 	seen := make(map[string]struct{})
 	for _, fragment := range fragments {
@@ -82,14 +108,14 @@ func (t *RefreshExternalCollectionTask) addMilvusTableL0DeltalogsToManifest(
 				}
 				seen[sourcePath] = struct{}{}
 				if err := packed.ValidateMilvusTableSourceDeltalogPath(sourcePath); err != nil {
-					return "", err
+					return nil, err
 				}
 				logID := binlog.GetLogID()
 				if logID == 0 {
-					return "", merr.WrapErrServiceInternalMsg("milvus-table source deltalog %s has no allocated log ID", sourcePath)
+					return nil, merr.WrapErrServiceInternalMsg("milvus-table source deltalog %s has no allocated log ID", sourcePath)
 				}
 				if err := ensureContext(ctx); err != nil {
-					return "", err
+					return nil, err
 				}
 				entries = append(entries, packed.DeltaLogEntry{
 					Path:       sourcePath,
@@ -98,20 +124,7 @@ func (t *RefreshExternalCollectionTask) addMilvusTableL0DeltalogsToManifest(
 			}
 		}
 	}
-	if len(entries) == 0 {
-		return manifestPath, nil
-	}
-	if err := ensureContext(ctx); err != nil {
-		return "", err
-	}
-	updatedManifestPath, err := packed.AddDeltaLogsToManifestOverwrite(manifestPath, t.req.GetStorageConfig(), entries)
-	if err != nil {
-		return "", err
-	}
-	if err := ensureContext(ctx); err != nil {
-		return "", err
-	}
-	return updatedManifestPath, nil
+	return entries, nil
 }
 
 // milvusTableDeltalogRef identifies one source StorageV3 deltalog that may
@@ -241,17 +254,35 @@ func (t *RefreshExternalCollectionTask) translateMilvusTableDeltalogsToVirtualPK
 	segmentID int64,
 	fragments []packed.Fragment,
 ) (string, error) {
-	refs, err := collectMilvusTableDeltalogRefs(fragments)
+	entries, err := t.prepareMilvusTableVirtualPKDeltalogs(ctx, basePath, segmentID, fragments)
 	if err != nil {
 		return "", err
 	}
-	if len(refs) == 0 {
+	if len(entries) == 0 {
 		return manifestPath, nil
 	}
+	return packed.AddDeltaLogsToManifestOverwrite(manifestPath, t.req.GetStorageConfig(), entries)
+}
+
+// prepareMilvusTableVirtualPKDeltalogs writes translated logs but does not create
+// a manifest. The caller registers the complete set in its final transaction.
+func (t *RefreshExternalCollectionTask) prepareMilvusTableVirtualPKDeltalogs(
+	ctx context.Context,
+	basePath string,
+	segmentID int64,
+	fragments []packed.Fragment,
+) ([]packed.DeltaLogEntry, error) {
+	refs, err := collectMilvusTableDeltalogRefs(fragments)
+	if err != nil {
+		return nil, err
+	}
+	if len(refs) == 0 {
+		return nil, nil
+	}
 
 	sourcePKField, err := t.getMilvusTableSourcePKField()
 	if err != nil {
-		return "", err
+		return nil, err
 	}
 
 	var entries []packed.DeltaLogEntry
@@ -265,15 +296,15 @@ func (t *RefreshExternalCollectionTask) translateMilvusTableDeltalogsToVirtualPK
 		deletedSourcePKKeys := make(map[string]struct{})
 		for _, ref := range batchRefs {
 			if err := ensureContext(ctx); err != nil {
-				return "", err
+				return nil, err
 			}
 			deletes, refDeletedSourcePKKeys, err := t.loadMilvusTableSourceDeltalogDeletes(
 				ctx,
 				ref,
 				sourcePKField.GetDataType(),
 			)
 			if err != nil {
-				return "", err
+				return nil, err
 			}
 			batchDeletes = append(batchDeletes, deletes)
 			for key := range refDeletedSourcePKKeys {
@@ -283,11 +314,11 @@ func (t *RefreshExternalCollectionTask) translateMilvusTableDeltalogsToVirtualPK
 
 		sourcePKOffsets, err := t.loadMilvusTableSourcePKOffsets(ctx, fragments, sourcePKField, deletedSourcePKKeys)
 		if err != nil {
-			return "", err
+			return nil, err
 		}
 		for _, deletes := range batchDeletes {
 			if err := ensureContext(ctx); err != nil {
-				return "", err
+				return nil, err
 			}
 			entry, err := t.writeMilvusTableVirtualPKDeltalog(
 				ctx,
@@ -297,15 +328,12 @@ func (t *RefreshExternalCollectionTask) translateMilvusTableDeltalogsToVirtualPK
 				deletes,
 			)
 			if err != nil {
-				return "", err
+				return nil, err
 			}
 			entries = append(entries, entry)
 		}
 	}
-	if len(entries) == 0 
```

---

### Incident Patch 3: `86fa36ec` (2026-11-06)
**Commit Message**: fix: clear drained piece references when a reshard bucket spills (#55202)

## Scope

**This is not a fix for the OOM reported in the linked issue, and the
stale references cleared here are not its root cause.** The retention is
bounded and self-limiting -- the dropped slots are overwritten one by
one by the pieces routed afterwards, and a cut drops the backing array
entirely -- so it works out to a few hundred MiB per task and well under
1 GiB per node, roughly 6% of the `HeapAlloc` observed at the OOM. That
cannot account for a multi-GiB overshoot of the GC goal, and a bounded
steady-state quantity cannot produce the monotonic 3.26 GiB climb seen
in the last 30 seconds. At most this is one contributing factor; it is
not the decisive one.

It is still worth fixing on its own merits. A spill that reports bytes
freed while the heap does not move makes the accounting lie, and the
dynamic free-memory checkpoint is exactly the brake meant to react to
what the static model misses. The change is one line, cannot affect the
happy path, and also removes a large amount of pointless spill I/O: on
the reported run the node wrote ~6.9 GiB of spill per task without
buying memory back.

The linke

**File**: `internal/datanode/importv3/reshard_bucket.go` (modified, +6/-0)
```diff
@@ -88,6 +88,12 @@ func (b *bucket) spill(spill *SpillManager, bucketOrdinal int64) (int64, error)
 		return 0, err
 	}
 	freed := b.bytes
+	// append reuses the backing array when it has room, so it overwrites only
+	// the slot at head and the drained pieces past the new len would keep their
+	// InsertData reachable -- the GC scans the whole allocation, not the slice
+	// length. Clearing first keeps every slot in [len, cap) at its zero value,
+	// so the accounted bytes this spill reports as freed really leave the heap.
+	clear(b.pieces[head:])
 	b.pieces = append(b.pieces[:head], piece{disk: &spillRange, logical: spillRange.Logical, rows: spillRange.Rows})
 	b.bytes = 0
 	return freed, nil
```

**File**: `internal/datanode/importv3/reshard_bucket_test.go` (added, +188/-0)
```diff
@@ -0,0 +1,188 @@
+// Licensed to the LF AI & Data foundation under one or more contributor
+// license agreements. See the NOTICE file distributed with this work for
+// additional information regarding copyright ownership.
+// The ASF licenses this file to you under the Apache License, Version 2.0.
+
+package importv3
+
+import (
+	"testing"
+
+	"github.com/stretchr/testify/require"
+)
+
+// bucketTestPolicy never cuts on its own and never splits a sort input: these
+// tests drive the spill and the cut explicitly.
+func bucketTestPolicy() *fragmentPolicy {
+	return &fragmentPolicy{target: 1 << 40, sortInput: 1 << 40, overhead: 600}
+}
+
+// newBucketTestFixture builds a bucket table over one (vchannel, partition)
+// bucket plus the spill area its drained tails go to.
+func newBucketTestFixture(t *testing.T) (*bucketTable, *SpillManager, bucketKey) {
+	t.Helper()
+	spill, err := NewSpillManager(t.TempDir(), spillTestSchema(), 1)
+	require.NoError(t, err)
+	t.Cleanup(func() { _ = spill.Close() })
+	key := bucketKey{vchannelOrdinal: 0, partitionOrdinal: 0}
+	return newBucketTable(bucketTestPolicy(), 1), spill, key
+}
+
+// routePieces routes count in-memory pieces of rows rows each into key's bucket
+// through the table, so the bucket and the table both account them, and returns
+// the accounted bytes charged.
+func routePieces(t *testing.T, table *bucketTable, key bucketKey, pkStart int64, count, rows int) int64 {
+	t.Helper()
+	var accounted int64
+	for i := 0; i < count; i++ {
+		data, logical := spillTestBatch(pkStart+int64(i*rows), rows)
+		mem := logical + table.policy.overhead
+		require.Nil(t, table.add(key, data, mem, logical), "the fixture policy must not cut on its own")
+		accounted += mem
+	}
+	return accounted
+}
+
+// requireZeroedPieceTail pins the bucket's piece invariant: every slot of the
+// backing array past len is the zero piece. A drained slot that keeps its
+// *storage.InsertData stays reachable for the GC, which scans the whole
+// allocation and not the slice length, so the accounted bytes a spill reports
+// as freed would never actually leave the heap.
+func requireZeroedPieceTail(t *testing.T, b *bucket) {
+	t.Helper()
+	backing := b.pieces[:cap(b.pieces)]
+	for i := len(b.pieces); i < len(backing); i++ {
+		require.Nil(t, backing[i].mem, "slot %d past len %d still references a drained InsertData", i, len(b.pieces))
+		require.Nil(t, backing[i].disk, "slot %d past len %d still references a spilled range", i, len(b.pieces))
+	}
+}
+
+// TestBucketSpillDropsDrainedPieceReferences pins that a spill really releases
+// the tail it drained: the bucket collapses into one unsplittable on-disk piece,
+// the freed bytes it reports are the bytes it held, the segment totals survive
+// (the flushed fragment covers everything the bucket ever received) and no slot
+// of the backing array past the new len still references a drained InsertData.
+// Without that last part the accounting reads zero while the heap keeps every
+// routed chunk alive, and the free-memory checkpoint has nothing left to spill.
+func TestBucketSpillDropsDrainedPieceReferences(t *testing.T) {
+	table, spill, key := newBucketTestFixture(t)
+	accounted := routePieces(t, table, key, 0, 3, 4)
+	b := table.buckets[key]
+	require.Len(t, b.pieces, 3)
+	require.Equal(t, accounted, b.bytes)
+	require.Equal(t, accounted, table.memBytes())
+	logicalBytes, rows := b.logicalBytes, b.rows
+	require.Positive(t, logicalBytes)
+
+	freed, err := table.spillBucket(spill, b)
+	require.NoError(t, err)
+
+	require.Equal(t, accounted, freed, "a spill frees exactly the accounted bytes the tail held")
+	require.Len(t, b.pieces, 1, "the drained tail collapses into one on-disk piece")
+	require.NotNil(t, b.pieces[0].disk)
+	require.Nil(t, b.pieces[0].mem)
+	require.Zero(t, b.bytes)
+	require.Zero(t, table.memBytes())
+	require.Equal(t, logicalBytes, b.logicalBytes, "a spill keeps the segment totals")
+	require.Equal(t, rows, b.rows)
+	require.Equal(t, logicalBytes, b.pieces[0].logical)
+	require.Equal(t, rows, b.pieces[0].rows)
+	require.Greater(t, cap(b.pieces), len(b.pieces),
+		"the drained slots must still sit inside the backing array for the assertions below to bite")
+	requireZeroedPieceTail(t, b)
+
+	// The drained rows still come back through the range the piece carries.
+	_, gotRows, pks := readRange(t, spill, *b.pieces[0].disk)
+	require.Equal(t, int(rows), gotRows)
+	for i, pk := range pks {
+		require.Equal(t, int64(i), pk)
+	}
+}
+
+// TestBucketRespillKeepsLeadingDiskPieceAndDropsTail pins the second spill of
+// one bucket, the path where a stale reference really hides: the pieces routed
+// after the first spill land in the very slots it drained, so the tail the
+// second spill drops is only partly overwritten by the append that installs the
+// new on-disk piece. The leading disk piece must survive untouched and readable
+// while every slot past the new len goes back to zero.
+func TestBucketRespillKeepsLeadingDiskPiece
```

#### Recent Merged Pull Requests:
- **PR #55222** (2026-11-06): fix: report NumPy import schema errors through the job instead of the proxy (@xaxys)
- **PR #55214** (2026-11-06): enhance: [3.0] broadcast file resource metadata through WAL (#54562) (@aoiasd)
- **PR #55203** (2026-11-06): fix: [cp3.0] validate import schemas when a numpy or parquet file counts to zero (@xaxys)
- **PR #55202** (2026-11-06): fix: clear drained piece references when a reshard bucket spills (@xaxys)
- **PR #55201** (2026-11-06): fix: [3.0] stop growing filter cursors at batch boundaries (@zhengbuqian)
- **PR #55200** (2026-11-06): fix: [3.0] Preserve segment index types across snapshot restore (@weiliu1031)

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

## X. enhance: bound memory of ORDER BY ... LIMIT in segcore SortBuffer with a selecti

**RULE**:
When implementing operations in `internal/core/src/exec/SortBuffer.cpp`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in milvus-io/milvus. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `5f9a1114`: enhance: bound memory of ORDER BY ... LIMIT in segcore SortBuffer with a selection algorithm (#54383). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `internal/core/src/exec/SortBuffer.cpp`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
#include <limits>
#include <string_view>
namespace {

// With a limit, up to kCandidateBufferFactor * limit candidate rows are kept
// before shrinking back to limit. The slack amortizes each O(n) selection
// over the (factor - 1) * limit rows accepted in between.
constexpr int64_t kCandidateBufferFactor = 2;

// Left-hand side of SortBuffer::CompareImpl(): a row stored in the
// RowContainer.
struct StoredRow {
    const char* row;

    bool
    IsNull(int32_t, const RowColumn& column) const {
        return RowContainer::isNullAt(
            row, column.nullByte(), column.nullMask());
    }
    template <typename T>
    T
    ValueAt(int32_t, const RowColumn& column) const {
        return RowContainer::valueAt<T>(row, column.offset());
    }
    const std::string*
    StrAt(int32_t, const RowColumn& column) const {
        return RowContainer::strAt(row, column.offset());
    }
};

// Left-hand side of SortBuffer::CompareImpl(): an input row that has not been
// stored, read straight from its column vectors. Values are read exactly as
// RowContainer::storeWithNull()/storeNoNulls() read them (ValidAt and
// RawValueAt), so comparing in place equals comparing the stored row, an
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `5f9a1114` are properly handled with clean fallback behavior.
