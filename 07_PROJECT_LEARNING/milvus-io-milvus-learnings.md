> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/milvus-io-milvus-learnings.md`  
> **Source**: github ([https://github.com/milvus-io/milvus](https://github.com/milvus-io/milvus))  
> **Source Version**: `1cee5900`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-03T20:27:38.256Z  
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
> **Harvest Timestamp**: 2026-11-03T20:27:37.624Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `milvus-io/milvus`
- **Description**: Milvus is a high-performance, cloud-native vector database built for scalable vector ANN search
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 46574 stars

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
- **Issue #55064** (2026-11-03): **fix: [hotfix-3.0.5] prefer safe JSON indexes over stats**
  *Symptoms*: issue: #55001 pr: #55006  JSON predicates on segments with shredding stats currently bypass usable path indexes. Backport #55006 to `hotfix-3.0.5`, adapting its execution-path fallback and tests to this branch's existing index interfaces.  Ordinary unary comparisons, IN, binary ranges, and EXISTS prefer a usable index, then fall back to JSON stats. Keep three safeguards before scalar-index pinning:  - JSON string pattern predicates retain the existing stats path when eligible, avoiding the flat-index regex failure on keys such as `(`. - Precision-sensitive numeric bounds and IN literals retain exact stats comparisons before any scalar-index pin, including floating values at ±2^53 that numeric indexes can confuse with adjacent integers. Every IN literal is checked, even when the first literal is small. - JSON_CONTAINS / ANY / ALL retain their existing stats path when eligible. This preserves null/missing/non-array semantics and avoids loading an index that would subsequently be rejected.  EXISTS now passes paths relative to the flat index root, matching the other scalar-index executors; a query on `/a/b` uses `/b` when the index is rooted at `/a`.  This hotfix intentionally keeps contains and pattern predicates conservative instead of importing master's index-capability selector. It does not fix Tantivy's underlying regex handling or the existing array-index validity gap on segments without eligible stats. NGRAM's existing execution path is unchanged.  Validation: - `git diff 

- **Issue #55063** (2026-11-03): **fix: [hotfix-3.0.5] preserve candidate masks in logical and GIS filters**
  *Symptoms*: Backport of #55057 via the 3.0 backport #55060 to hotfix-3.0.5 for issue #55018 items 01, 05 and 07.  Preserve inherited candidate masks during nested logical evaluation and restore them on exit. Refine indexed GIS candidates within the active batch and skip masked raw geometry work.  Also fix an existing cursor mismatch for nonnullable scalar IS NULL / IS NOT NULL: a skipped batch must advance the constant-result cursor so the final partial batch has the correct length. This is item 01 and is independent of the inherited-mask change.  This includes the 3.0 backport and the subsequent master ownership-transfer update.  pr: #55057  Move the inherited bitmap into local ownership after the first child returns and restore it on exit, avoiding an additional deep copy.  issue: #55018  Validation: no hotfix build or test run was completed; the earlier validation job was cancelled before test execution. The ownership-transfer update was verified on master commit 01b9fdcadc with 348 targeted C++ tests, with no separate Dev CLI validation on this hotfix branch.  Suggested reading order: ConjunctExpr/EvalCtx mask scope and ownership transfer, NullExpr skipped-batch cursor handling, then GISFunctionFilterExpr raw/indexed evaluation. The remaining changes are focused regressions. 

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

### Incident Patch 1: `20d2246e` (2026-11-03)
**Commit Message**: fix: prevent CDC replicator panic after source scanner termination (#54663)

## Summary

Prevent the CDC ChannelReplicator from dereferencing a nil message after
the source scanner terminates and closes its message channel.

## Root Cause

`startConsumeLoop` previously ignored the channel receive status and did
not observe scanner completion. A receive from a closed channel returned
a nil `message.ImmutableMessage`, which was then dereferenced through
`MessageType()`.

Transient scanner and broker failures are already handled by the
existing resumable consumer. The ChannelReplicator should handle an
outer scanner termination safely without introducing a second recovery
loop.

## Changes

- Check the channel receive status before processing a message.
- Observe scanner completion and propagate scanner errors.
- Exit cleanly when replication or scanner context is canceled.
- Log an unexpected scanner termination and let the existing cleanup
path close the scanner and replication stream.
- Add regression tests for closed channels, scanner errors, and
cancellation.

## Testing

- `gofmt -d
internal/cdc/replication/replicatemanager/channel_replicator.go
internal/cdc/replication/replicat

**File**: `internal/cdc/replication/replicatemanager/channel_replicator.go` (modified, +38/-5)
```diff
@@ -51,6 +51,8 @@ type Replicator interface {
 
 var _ Replicator = (*channelReplicator)(nil)
 
+var errScannerClosed = errors.New("replication source scanner closed")
+
 // channelReplicator is the implementation of ChannelReplicator.
 type channelReplicator struct {
 	channel       *meta.ReplicateChannel
@@ -106,7 +108,11 @@ func (r *channelReplicator) StartReplication() {
 				break INIT_LOOP
 			}
 		}
-		r.startConsumeLoop()
+		if err := r.startConsumeLoop(); err != nil &&
+			!errors.Is(err, context.Canceled) &&
+			!errors.Is(err, replicatestream.ErrReplicationRemoved) {
+			logger.Warn(context.TODO(), "replication source scanner stopped", mlog.Err(err))
+		}
 	}()
 }
 
@@ -170,16 +176,25 @@ func (r *channelReplicator) init() error {
 }
 
 // startConsumeLoop starts the replicate loop.
-func (r *channelReplicator) startConsumeLoop() {
+func (r *channelReplicator) startConsumeLoop() error {
 	logger := mlog.With(mlog.String("key", r.channel.Key), mlog.Int64("modRevision", r.channel.ModRevision))
 	logger.Info(context.TODO(), "start consume loop")
+	var scannerDone <-chan struct{}
+	if r.msgScanner != nil {
+		scannerDone = r.msgScanner.Done()
+	}
 
 	for {
 		select {
 		case <-r.asyncNotifier.Context().Done():
 			logger.Info(context.TODO(), "consume loop stopped")
-			return
-		case msg := <-r.msgChan:
+			return nil
+		case <-scannerDone:
+			return r.scannerStoppedError(true)
+		case msg, ok := <-r.msgChan:
+			if !ok {
+				return r.scannerStoppedError(false)
+			}
 			// A topology change older than this task describes a past state, not an
 			// instruction. Forwarding it would make the secondary act on it — a
 			// configuration that no longer lists the secondary turns it back into a
@@ -207,13 +222,31 @@ func (r *channelReplicator) startConsumeLoop() {
 					// series. Deleting after BlockUntilFinish ensures no
 					// in-flight confirm re-creates the series afterwards.
 					replicatestream.DeleteLastReplicatedTimeTick(r.channel.Value)
-					return
+					return replicatestream.ErrReplicationRemoved
 				}
 			}
 		}
 	}
 }
 
+func (r *channelReplicator) scannerStoppedError(scannerDone bool) error {
+	if r.msgScanner == nil {
+		return errScannerClosed
+	}
+
+	if !scannerDone {
+		select {
+		case <-r.msgScanner.Done():
+		case <-r.asyncNotifier.Context().Done():
+			return r.asyncNotifier.Context().Err()
+		}
+	}
+	if err := r.msgScanner.Error(); err != nil {
+		return errors.Wrap(err, "replication source scanner stopped")
+	}
+	return errScannerClosed
+}
+
 func (r *channelReplicator) getReplicateCheckpoint() (*utility.ReplicateCheckpoint, error) {
 	logger := mlog.With(mlog.String("key", r.channel.Key), mlog.Int64("modRevision", r.channel.ModRevision))
 
```

**File**: `internal/cdc/replication/replicatemanager/channel_replicator_test.go` (modified, +135/-0)
```diff
@@ -22,6 +22,7 @@ import (
 	"time"
 
 	"github.com/apache/pulsar-client-go/pulsar"
+	"github.com/cockroachdb/errors"
 	"github.com/prometheus/client_golang/prometheus/testutil"
 	"github.com/stretchr/testify/assert"
 	mock "github.com/stretchr/testify/mock"
@@ -65,6 +66,7 @@ func TestChannelReplicator_StartReplicateChannel(t *testing.T) {
 
 	scanner := mock_streaming.NewMockScanner(t)
 	scanner.EXPECT().Close().Return()
+	scanner.EXPECT().Done().Return(make(chan struct{})).Once()
 	wal := mock_streaming.NewMockWALAccesser(t)
 	wal.EXPECT().Read(mock.Anything, mock.Anything).Return(scanner)
 	streaming.SetWALForTest(wal)
@@ -159,6 +161,139 @@ func TestChannelReplicatorConsumeLoopDeletesLagSeriesOnRemoval(t *testing.T) {
 	assert.False(t, metrics.CDCLastReplicatedTimeTick.DeleteLabelValues(source, target))
 }
 
+func TestChannelReplicatorConsumeLoopStopsOnClosedMessageChannel(t *testing.T) {
+	replicator := &channelReplicator{
+		channel:       &meta.ReplicateChannel{},
+		msgChan:       make(adaptor.ChanMessageHandler),
+		asyncNotifier: syncutil.NewAsyncTaskNotifier[struct{}](),
+	}
+
+	done := make(chan error, 1)
+	go func() {
+		done <- replicator.startConsumeLoop()
+	}()
+	close(replicator.msgChan)
+
+	select {
+	case err := <-done:
+		assert.ErrorIs(t, err, errScannerClosed)
+	case <-time.After(time.Second):
+		t.Fatal("consume loop did not stop after message channel was closed")
+	}
+}
+
+func TestChannelReplicatorConsumeLoopReturnsScannerError(t *testing.T) {
+	scannerDone := make(chan struct{})
+	scannerErr := errors.New("source scanner failed")
+	scanner := mock_streaming.NewMockScanner(t)
+	scanner.EXPECT().Done().Return(scannerDone).Once()
+	scanner.EXPECT().Error().Return(scannerErr).Once()
+
+	replicator := &channelReplicator{
+		channel:       &meta.ReplicateChannel{},
+		msgChan:       make(adaptor.ChanMessageHandler),
+		msgScanner:    scanner,
+		asyncNotifier: syncutil.NewAsyncTaskNotifier[struct{}](),
+	}
+
+	done := make(chan error, 1)
+	go func() {
+		done <- replicator.startConsumeLoop()
+	}()
+	close(scannerDone)
+
+	select {
+	case err := <-done:
+		assert.ErrorIs(t, err, scannerErr)
+	case <-time.After(time.Second):
+		t.Fatal("consume loop did not stop after scanner was done")
+	}
+}
+
+func TestChannelReplicatorConsumeLoopClosedMessageChannelWithScanner(t *testing.T) {
+	scannerDone := make(chan struct{})
+	scannerDoneCalls := make(chan struct{}, 2)
+	scannerErr := errors.New("source scanner failed")
+	scanner := mock_streaming.NewMockScanner(t)
+	scanner.EXPECT().Done().
+		Run(func() { scannerDoneCalls <- struct{}{} }).
+		Return(scannerDone).Twice()
+	scanner.EXPECT().Error().Return(scannerErr).Once()
+
+	replicator := &channelReplicator{
+		channel:       &meta.ReplicateChannel{},
+		msgChan:       make(adaptor.ChanMessageHandler),
+		msgScanner:    scanner,
+		asyncNotifier: syncutil.NewAsyncTaskNotifier[struct{}](),
+	}
+
+	done := make(chan error, 1)
+	go func() {
+		done <- replicator.startConsumeLoop()
+	}()
+
+	select {
+	case <-scannerDoneCalls:
+	case <-time.After(time.Second):
+		t.Fatal("consume loop did not initialize scanner completion channel")
+	}
+	close(replicator.msgChan)
+	select {
+	case <-scannerDoneCalls:
+	case <-time.After(time.Second):
+		t.Fatal("consume loop did not wait for scanner completion after channel close")
+	}
+	close(scannerDone)
+
+	select {
+	case err := <-done:
+		assert.ErrorIs(t, err, scannerErr)
+	case <-time.After(time.Second):
+		t.Fatal("consume loop did not return the scanner error")
+	}
+}
+
+func TestChannelReplicatorConsumeLoopClosedMessageChannelCancellation(t *testing.T) {
+	scannerDone := make(chan struct{})
+	scannerDoneCalls := make(chan struct{}, 2)
+	scanner := mock_streaming.NewMockScanner(t)
+	scanner.EXPECT().Done().
+		Run(func() { scannerDoneCalls <- struct{}{} }).
+		Return(scannerDone).Twice()
+
+	replicator := &channelReplicator{
+		channel:       &meta.ReplicateChannel{},
+		msgChan:       make(adaptor.ChanMessageHandler),
+		msgScanner:    scanner,
+		asyncNotifier: syncutil.NewAsyncTaskNotifier[struct{}](),
+	}
+
+	done := make(chan error, 1)
+	go func() {
+		done <- replicator.startConsumeLoop()
+	}()
+
+	select {
+	case <-scannerDoneCalls:
+	case <-time.After(time.Second):
+		t.Fatal("consume loop did not initialize scanner completion channel")
+	}
+	close(replicator.msgChan)
+	select {
+	case <-scannerDoneCalls:
+	case <-time.After(time.Second):
+		t.Fatal("consume loop did not wait for scanner completion after channel close")
+	}
+	replicator.asyncNotifier.Cancel()
+
+	select {
+	case err := <-done:
+		assert.ErrorIs(t, err, context.Canceled)
+	case <-time.After(time.Second):
+		t.Fatal("consume loop did not stop after cancellation")
+	}
+}
+
 func TestChannelReplicatorInitMetricFromInitializedCheckpoint(t *testing.T) {
 	source, target := "TestInitMetric-source", "TestInitMetric-target"
 	checkpoint := tsoutil.ComposeTSByTime(time.Now().Add(-5 * time.Minute))
```

---

### Incident Patch 2: `92a260c3` (2026-11-02)
**Commit Message**: fix: address post-merge review comments on the SegIdx refactor (#54826)

issue: #53567

Follow-up to #54182. Fixes four review comments posted after it merged.

- `fix: avoid draining an exhausted growing load channel`
([r4400447632](https://github.com/milvus-io/milvus/pull/54182#discussion_r4400447632)):
when the producer of a StorageV2 growing load fails, the consumer has
already taken the close marker, and the unwind guard added in #51180
popped the empty channel again and blocked forever. The guard now skips
the drain once the channel is exhausted. This bug predates the SegIdx
refactor. A regression test loads a parquet file with a damaged data
page and expects the original StorageError instead of a hang.
- `fix: classify invalid MARISA key ids`
([r4400445984](https://github.com/milvus-io/milvus/pull/54182#discussion_r4400445984)):
ReverseKey checks a persisted key id against the trie key count and
throws DataFormatBroken, instead of letting MARISA throw an untyped
exception that surfaces as UnexpectedError.
- `fix: classify invalid sorted index coordinates`
([r4400446533](https://github.com/milvus-io/milvus/pull/54182#discussion_r4400446533)):
the five sorted-reader checks on 

**File**: `internal/core/src/index/scalar/marisa/MarisaIndexReader.cpp` (modified, +14/-4)
```diff
@@ -70,7 +70,17 @@ SetRowsForKey(const MarisaIndexStorage& data,
 }
 
 std::string_view
-ReverseKey(const marisa::Trie& trie, size_t key_id, marisa::Agent& agent) {
+ReverseKey(const marisa::Trie& trie,
+           size_t key_id,
+           marisa::Agent& agent,
+           int64_t row = -1) {
+    if (key_id >= trie.num_keys()) {
+        ThrowInfo(DataFormatBroken,
+                  "marisa key id {} exceeds key count {} for row {}",
+                  key_id,
+                  trie.num_keys(),
+                  row);
+    }
     agent.set_query(key_id);
     trie.reverse_lookup(agent);
     return {agent.key().ptr(), agent.key().length()};
@@ -320,7 +330,7 @@ MarisaIndexReader::Lookup(int64_t offset) const {
     }
     marisa::Agent agent;
     const auto value =
-        ReverseKey(*storage_->trie, static_cast<size_t>(key_id), agent);
+        ReverseKey(*storage_->trie, static_cast<size_t>(key_id), agent, offset);
     return std::string(value);
 }
 
@@ -346,8 +356,8 @@ MarisaIndexReader::Gather(
             out(i, nullptr, false);
             continue;
         }
-        const auto value =
-            ReverseKey(*storage_->trie, static_cast<size_t>(key_id), agent);
+        const auto value = ReverseKey(
+            *storage_->trie, static_cast<size_t>(key_id), agent, offset);
         out(i, &value, true);
     }
 }
```

**File**: `internal/core/src/index/scalar/sort/SortedIndexReader.cpp` (modified, +30/-20)
```diff
@@ -381,21 +381,25 @@ PrefixRange(const SortedStringLayout& layout, std::string_view prefix) {
 
 void
 SetNumericRow(TargetBitmap& result, size_t row, bool value) {
-    AssertInfo(row < result.size(),
-               "sorted numeric row {} exceeds count {}",
-               row,
-               result.size());
+    if (row >= result.size()) {
+        ThrowInfo(DataFormatBroken,
+                  "sorted numeric row {} exceeds count {}",
+                  row,
+                  result.size());
+    }
     result[row] = value;
 }
 
 void
 SetPosting(TargetBitmap& result, const SortedStringPostingView& posting) {
     for (size_t i = 0; i < posting.size; ++i) {
         const auto row = posting.At(i);
-        AssertInfo(static_cast<size_t>(row) < result.size(),
-                   "sorted string row {} exceeds count {}",
-                   row,
-                   result.size());
+        if (static_cast<size_t>(row) >= result.size()) {
+            ThrowInfo(DataFormatBroken,
+                      "sorted string row {} exceeds count {}",
+                      row,
+                      result.size());
+        }
         result.set(row);
     }
 }
@@ -404,10 +408,12 @@ void
 ClearPosting(TargetBitmap& result, const SortedStringPostingView& posting) {
     for (size_t i = 0; i < posting.size; ++i) {
         const auto row = posting.At(i);
-        AssertInfo(static_cast<size_t>(row) < result.size(),
-                   "sorted string row {} exceeds count {}",
-                   row,
-                   result.size());
+        if (static_cast<size_t>(row) >= result.size()) {
+            ThrowInfo(DataFormatBroken,
+                      "sorted string row {} exceeds count {}",
+                      row,
+                      result.size());
+        }
         result.reset(row);
     }
 }
@@ -860,10 +866,12 @@ SortedIndexReader<T>::Lookup(int64_t offset) const {
                "sorted offset map does not cover row {}",
                row);
     const auto index = state_.idx_to_offsets[row];
-    AssertInfo(storage_.ValidReverseIndex(index),
-               "sorted value offset {} is invalid for row {}",
-               index,
-               row);
+    if (!storage_.ValidReverseIndex(index)) {
+        ThrowInfo(DataFormatBroken,
+                  "sorted value offset {} is invalid for row {}",
+                  index,
+                  row);
+    }
     return owned_t<T>(storage_.ValueAt(static_cast<size_t>(index)));
 }
 
@@ -896,10 +904,12 @@ SortedIndexReader<T>::Gather(
                    "sorted offset map does not cover row {}",
                    row);
         const auto index = state_.idx_to_offsets[coordinate];
-        AssertInfo(storage_.ValidReverseIndex(index),
-                   "sorted value offset {} is invalid for row {}",
-                   index,
-                   row);
+        if (!storage_.ValidReverseIndex(index)) {
+            ThrowInfo(DataFormatBroken,
+                      "sorted value offset {} is invalid for row {}",
+                      index,
+                      row);
+        }
         const auto value = storage_.ValueAt(static_cast<size_t>(index));
         out(i, &value, true);
     }
```

**File**: `internal/core/src/indexbuilder/BuildSession.cpp` (modified, +10/-8)
```diff
@@ -749,14 +749,16 @@ BuildSession::RunToArtifact() {
             AssertInfo(missing_rows >= 0,
                        "index-build missing row count {} is negative",
                        missing_rows);
-            AssertInfo(
-                missing_rows == 0 || field_spec_.nullable ||
-                    file_manager_context_.fieldDataMeta.field_schema
-                        .has_default_value(),
-                "index-build source is missing {} rows for non-nullable field "
-                "{} without a default value",
-                missing_rows,
-                req_.field_id.get());
+            if (missing_rows > 0 && !field_spec_.nullable &&
+                !file_manager_context_.fieldDataMeta.field_schema
+                     .has_default_value()) {
+                ThrowInfo(DataFormatBroken,
+                          "index-build source is missing {} rows for "
+                          "non-nullable field "
+                          "{} without a default value",
+                          missing_rows,
+                          req_.field_id.get());
+            }
             while (missing_rows > 0) {
                 const auto batch_rows = MissingBatchRows(
                     field_spec_.estimated_missing_row_bytes, missing_rows);
```

**File**: `internal/core/src/segcore/SegmentGrowingImpl.cpp` (modified, +10/-4)
```diff
@@ -2212,12 +2212,16 @@ SegmentGrowingImpl::load_column_group_data_internal(
         // pushing into the bounded channel. If the consumer loop below
         // throws, unblock the task and wait for it before unwinding
         // (see #46958).
+        bool channel_exhausted = false;
         auto drain_on_unwind = folly::makeGuard([&]() {
-            try {
-                std::shared_ptr<milvus::ArrowDataWrapper> discard;
-                while (column_group_info.arrow_reader_channel->pop(discard)) {
+            if (!channel_exhausted) {
+                try {
+                    std::shared_ptr<milvus::ArrowDataWrapper> discard;
+                    while (
+                        column_group_info.arrow_reader_channel->pop(discard)) {
+                    }
+                } catch (...) {
                 }
-            } catch (...) {
             }
             storage::DrainFuture(load_future);
         });
@@ -2279,6 +2283,8 @@ SegmentGrowingImpl::load_column_group_data_internal(
                 }
             }
         }
+        // The loop consumed the close marker, even if the producer failed.
+        channel_exhausted = true;
         // access underlying feature to get exception if any
         load_future.get();
         drain_on_unwind.dismiss();
```

**File**: `internal/core/src/segcore/SegmentGrowingStorageV2Test.cpp` (modified, +84/-0)
```diff
@@ -21,9 +21,11 @@
 #include <arrow/record_batch.h>
 #include <arrow/util/key_value_metadata.h>
 #include <parquet/properties.h>
+#include <unistd.h>
 #include <stdlib.h>
 #include <algorithm>
 #include <cstdint>
+#include <csignal>
 #include <iostream>
 #include <map>
 #include <memory>
@@ -44,6 +46,7 @@
 #include "common/Types.h"
 #include "common/Utils.h"
 #include "common/protobuf_utils.h"
+#include "folly/ScopeGuard.h"
 #include "gtest/gtest.h"
 #include "knowhere/comp/index_param.h"
 #include "milvus-storage/common/config.h"
@@ -202,6 +205,87 @@ TEST_F(TestGrowingStorageV2, LoadFieldData) {
     segment->LoadFieldData(load_info);
 }
 
+TEST_F(TestGrowingStorageV2, ProducerReadFailurePreservesErrorWithoutHanging) {
+    const auto directory = path_ + "/growing-producer-read-failure";
+    auto cleanup = folly::makeGuard([&] { (void)fs_->DeleteDir(directory); });
+    const auto check_failure = [&] {
+        ASSERT_TRUE(fs_->CreateDir(directory).ok());
+        const auto path = directory + "/1";
+        std::vector<std::string> paths{path};
+        milvus_storage::StorageConfig config{};
+        std::vector<std::vector<int>> column_groups{{0, 1, 2}};
+        auto result = milvus_storage::PackedRecordBatchWriter::Make(
+            fs_, paths, schema_, config, column_groups, 16 * 1024 * 1024);
+        auto writer = result.ValueOrDie();
+        ASSERT_TRUE(writer->Write(record_batch_).ok());
+        ASSERT_TRUE(writer->Close().ok());
+
+        auto reader =
+            milvus_storage::FileRowGroupReader::Make(fs_, path).ValueOrDie();
+        auto metadata = reader->file_metadata()->GetParquetMetadata();
+        const auto column = metadata->RowGroup(0)->ColumnChunk(0);
+        const auto data_offset = column->data_page_offset();
+        const auto chunk_start = column->has_dictionary_page()
+                                     ? column->dictionary_page_offset()
+                                     : data_offset;
+        ASSERT_GE(data_offset, 4);
+        ASSERT_LE(data_offset + 16,
+                  chunk_start + column->total_compressed_size());
+        ASSERT_TRUE(reader->Close().ok());
+        auto input = fs_->OpenInputFile(path).ValueOrDie();
+        const auto size = input->GetSize().ValueOrDie();
+        auto damaged = input->ReadAt(0, size).ValueOrDie()->ToString();
+        ASSERT_LE(data_offset + 16, damaged.size());
+        ASSERT_TRUE(input->Close().ok());
+        std::fill_n(damaged.begin() + data_offset, 16, '\xff');
+        auto output = fs_->OpenOutputStream(path).ValueOrDie();
+        ASSERT_TRUE(output->Write(damaged.data(), damaged.size()).ok());
+        ASSERT_TRUE(output->Close().ok());
+
+        auto schema = std::make_shared<Schema>();
+        schema->AddDebugField("ts", DataType::INT64, true);
+        const auto pk = schema->AddDebugField("pk", DataType::INT64, false);
+        schema->AddDebugField("str", DataType::VARCHAR, true);
+        schema->set_primary_field_id(pk);
+        auto segment = CreateGrowingSegment(schema, empty_index_meta);
+        const auto rows = record_batch_->num_rows();
+        LoadFieldDataInfo info;
+        info.storage_version = 2;
+        info.field_infos = {
+            {0, FieldBinlogInfo{0, rows, {rows}, {rows}, false, "", {path}}}};
+        try {
+            segment->LoadFieldData(info);
+            FAIL() << "expected producer read failure";
+        } catch (const SegcoreError& error) {
+            EXPECT_EQ(error.get_error_code(), StorageError);
+            const auto prefix =
+                "[StorageV2] Failed to read row group 0 from file " + path;
+            EXPECT_NE(std::string(error.what()).find(prefix),
+                      std::string::npos);
+        }
+    };
+
+    const auto previous_style = ::testing::FLAGS_gtest_death_test_style;
+    auto restore_style = folly::makeGuard(
+        [&] { ::testing::FLAGS_gtest_death_test_style = previous_style; });
+    ::testing::FLAGS_gtest_death_test_style = "threadsafe";
+    ASSERT_EXIT(
+        {
+            sigset_t signals;
+            if (std::signal(SIGALRM, SIG_DFL) == SIG_ERR ||
+                ::sigemptyset(&signals) != 0 ||
+                ::sigaddset(&signals, SIGALRM) != 0 ||
+                ::sigprocmask(SIG_UNBLOCK, &signals, nullptr) != 0) {
+                std::_Exit(2);
+            }
+            ::alarm(15);
+            check_failure();
+            std::_Exit(::testing::Test::HasFailure() ? 1 : 0);
+        },
+        ::testing::ExitedWithCode(0),
+        "");
+}
+
 // Regression for add-field + legacy StorageV2 data: a growing segment written
 // by StorageV2 can have a TEXT field added to its schema afterwards (AddField)
 // while its binlogs carry no TEXT column and it has no StorageV3 manifest. The
```

---

### Incident Patch 3: `21ee765c` (2026-11-03)
**Commit Message**: enhance: [ElemNull 4] row-level and element-level filters on element-nullable struct sub-fields, with search tests and struct sub-field fixes (#54792)

Fourth layer (EN4) of the element-null / nested-Array stack. Base:
`Element-Null-3` (#54791).

issue: https://github.com/milvus-io/milvus/issues/51162

## Row-level filters on element-nullable struct sub-fields

### What changes

Row-level filters now evaluate element-nullable and nested struct
sub-fields. These native-list Arrays are read through `ArrayValueView`,
which exposes per-element validity. No plan proto change.

- **C3, subscript comparisons** (`s[i][b] op v`, `in`, `like`, range,
arithmetic): a null element or an out-of-bounds subscript gives UNKNOWN,
which stays UNKNOWN under `NOT`.
- Subscripts are parsed with a range check, so an overflowing index
counts as out of bounds and does not raise an error.
- An empty set is FALSE for every row, as `x IN ()` is in SQL: `arr[i]
in []` and `s[i][b] in []` are FALSE on an out-of-bounds subscript, a
null element and a null row, and `not (... in [])` is TRUE. This is the
behavior from before element-nullable sub-fields.
- **C7**: in `array_contains` / `_any` / `_all` on `s[b]`, a 

**File**: `internal/core/src/common/ArrayValue.h` (modified, +59/-0)
```diff
@@ -263,6 +263,65 @@ class ArrayValueView {
             *type_, *child_, static_cast<size_t>(begin_ + index));
     }
 
+    // Whether this scalar Array equals the literal. Null is an ordinary value
+    // and a literal cannot spell it, so a value holding a null element never
+    // equals one. Mirrors ArrayView::is_same_array.
+    bool
+    is_same_array(const proto::plan::Array& literal) const {
+        const auto length = size();
+        if (static_cast<size_t>(literal.array_size()) != length) {
+            return false;
+        }
+        if (length == 0) {
+            return true;
+        }
+        if (!literal.same_type()) {
+            return false;
+        }
+        const auto type = element_type();
+        const auto expected_val_case =
+            array_detail::ExpectedLiteralValCase(type);
+        if (expected_val_case ==
+            proto::plan::GenericValue::ValCase::VAL_NOT_SET) {
+            return false;
+        }
+        for (size_t i = 0; i < length; ++i) {
+            const auto& expected = literal.array(static_cast<int>(i));
+            if (!is_valid(i) || expected.val_case() != expected_val_case) {
+                return false;
+            }
+            bool same = false;
+            switch (type) {
+                case DataType::BOOL:
+                    same = get_data_unchecked<bool>(i) == expected.bool_val();
+                    break;
+                case DataType::INT8:
+                case DataType::INT16:
+                case DataType::INT32:
+                case DataType::INT64:
+                    same =
+                        get_data_unchecked<int64_t>(i) == expected.int64_val();
+                    break;
+                case DataType::FLOAT:
+                    same = get_data_unchecked<float>(i) ==
+                           static_cast<float>(expected.float_val());
+                    break;
+                case DataType::DOUBLE:
+                    same =
+                        get_data_unchecked<double>(i) == expected.float_val();
+                    break;
+                default:
+                    same = get_data_unchecked<std::string_view>(i) ==
+                           expected.string_val();
+                    break;
+            }
+            if (!same) {
+                return false;
+            }
+        }
+        return true;
+    }
+
     void
     output_data(ScalarFieldProto& output) const {
         assert(type_ != nullptr && child_ != nullptr);
```

**File**: `internal/core/src/common/ArrayValueTest.cpp` (modified, +11/-2)
```diff
@@ -1176,8 +1176,17 @@ TEST(ArrayValue, GrowingSegmentRetrievesNullableScalarElements) {
         segment->bulk_subscript(nullptr, array_field, &result_offset, 1);
     ASSERT_EQ(result->scalars().array_data().data_size(), 1);
     AssertProtoEqual(*row, result->scalars().array_data().data(0));
-    EXPECT_ANY_THROW(segment->chunk_view<ArrayValueView>(
-        nullptr, array_field, 0, std::make_pair(0, 1)));
+    // Row filters read element-nullable rows as ArrayValueView, which
+    // exposes element validity.
+    auto views = segment->chunk_view<ArrayValueView>(
+        nullptr, array_field, 0, std::make_pair(0, 1));
+    const auto& [view_rows, view_valid] = views.get();
+    ASSERT_EQ(view_rows.size(), 1);
+    ASSERT_EQ(view_rows[0].size(), 3);
+    EXPECT_TRUE(view_rows[0].is_valid(0));
+    EXPECT_FALSE(view_rows[0].is_valid(1));
+    EXPECT_TRUE(view_rows[0].is_valid(2));
+    EXPECT_EQ(view_rows[0].get_data_unchecked<int64_t>(2), 16);
     auto offsets = segment->GetStructElementOffsets(array_field);
     ASSERT_NE(offsets, nullptr);
     EXPECT_EQ(offsets->GetRowCount(), 1);
```

**File**: `internal/core/src/exec/expression/BinaryArithOpEvalRangeExpr.cpp` (modified, +461/-427)
```diff
@@ -119,16 +119,14 @@ PhyBinaryArithOpEvalRangeExpr::Eval(EvalCtx& context, VectorPtr& result) {
             switch (value_type) {
                 case proto::plan::GenericValue::ValCase::kInt64Val: {
                     if (is_array_length) {
-                        if (is_nested_array) {
-                            if (expr_->column_.element_level_) {
-                                result = ExecArrayLength<ArrayValueView,
-                                                         int64_t,
-                                                         true>(input);
-                            } else {
-                                result = ExecArrayLength<ArrayValueView,
-                                                         int64_t,
-                                                         false>(input);
-                            }
+                        if (is_nested_array && expr_->column_.element_level_) {
+                            result =
+                                ExecArrayLength<ArrayValueView, int64_t, true>(
+                                    input);
+                        } else if (is_native_list_array_) {
+                            result =
+                                ExecArrayLength<ArrayValueView, int64_t, false>(
+                                    input);
                         } else {
                             result = ExecArrayLength<ArrayView, int64_t, false>(
                                 input);
@@ -140,16 +138,14 @@ PhyBinaryArithOpEvalRangeExpr::Eval(EvalCtx& context, VectorPtr& result) {
                 }
                 case proto::plan::GenericValue::ValCase::kFloatVal: {
                     if (is_array_length) {
-                        if (is_nested_array) {
-                            if (expr_->column_.element_level_) {
-                                result = ExecArrayLength<ArrayValueView,
-                                                         double,
-                                                         true>(input);
-                            } else {
-                                result = ExecArrayLength<ArrayValueView,
-                                                         double,
-                                                         false>(input);
-                            }
+                        if (is_nested_array && expr_->column_.element_level_) {
+                            result =
+                                ExecArrayLength<ArrayValueView, double, true>(
+                                    input);
+                        } else if (is_native_list_array_) {
+                            result =
+                                ExecArrayLength<ArrayValueView, double, false>(
+                                    input);
                         } else {
                             result = ExecArrayLength<ArrayView, double, false>(
                                 input);
@@ -791,10 +787,7 @@ PhyBinaryArithOpEvalRangeExpr::ExecRangeVisitorImplForArray(
     TargetBitmapView res(res_vec->GetRawData(), real_batch_size);
     TargetBitmapView valid_res(res_vec->GetValidRawData(), real_batch_size);
 
-    int index = -1;
-    if (expr_->column_.nested_path_.size() > 0) {
-        index = std::stoi(expr_->column_.nested_path_[0]);
-    }
+    int index = ParseArraySubscript(expr_->column_.nested_path_);
     auto op_type = expr_->op_type_;
     auto arith_type = expr_->arith_op_type_;
     auto value = value_arg_.GetValue<ValueType>();
@@ -821,20 +814,27 @@ PhyBinaryArithOpEvalRangeExpr::ExecRangeVisitorImplForArray(
                 valid_res[i] = false;                                     \
                 continue;                                                 \
             }                                                             \
-            if (index >= data[offset].length()) {                         \
+            if (!HasArrayElementAt(data[offset], index)) {                \
                 res[i] = false;                                           \
                 valid_res[i] = false;                                     \
                 continue;                                                 \
             }                                                             \
-            auto value = data[offset].get_data_unchecked<GetType>(index); \
+            auto value =                                                  \
+                data[offset].template get_data_unchecked<GetType>(index); \
             res[i] = (cmp);                                               \
         }                                                                 \
     } while (false)
 
-    auto execute_sub_batch =
-        [ op_type,
-          arith_type ]<FilterType filter_type = FilterType::sequential>(
-            const ArrayView* data,
+    if (is_nested_array_field_) {
+        ThrowInfo(ErrorCode::Unsupported,
+                  "nested ARRAY field {} does not support 
```

**File**: `internal/core/src/exec/expression/BinaryRangeExpr.cpp` (modified, +104/-99)
```diff
@@ -366,10 +366,9 @@ PhyBinaryRangeFilterExpr::PreCheckOverflow(HighPrecisionType& val1,
         [this, batch_size](OffsetVector* input) -> ColumnVectorPtr {
         TargetBitmap valid_res;
         if (expr_->column_.element_level_) {
-            valid_res = TargetBitmap(batch_size, true);
-            if (input == nullptr) {
-                MoveCursor();
-            }
+            // A null element stays UNKNOWN. Without input this consumes the
+            // batch.
+            valid_res = ProcessElementValidity(input, batch_size);
         } else if (input != nullptr) {
             valid_res =
                 ProcessChunksForValidByOffsets<T>(UseIndexCursor(), *input);
@@ -1030,16 +1029,23 @@ PhyBinaryRangeFilterExpr::ExecRangeVisitorImplForArray(EvalCtx& context) {
     const ValueType& val1 = lower_arg_.GetValue<ValueType>();
     const ValueType& val2 = upper_arg_.GetValue<ValueType>();
 
-    int index = -1;
-    if (expr_->column_.nested_path_.size() > 0) {
-        index = std::stoi(expr_->column_.nested_path_[0]);
-    }
+    int index = ParseArraySubscript(expr_->column_.nested_path_);
 
+    if (is_nested_array_field_) {
+        ThrowInfo(ErrorCode::Unsupported,
+                  "nested ARRAY field {} does not support element range "
+                  "predicates",
+                  field_id_.get());
+    }
     size_t processed_cursor = 0;
-    auto execute_sub_batch =
-        [ lower_inclusive, upper_inclusive, &processed_cursor, &
-          bitmap_input ]<FilterType filter_type = FilterType::sequential>(
-            const milvus::ArrayView* data,
+    auto make_sub_batch = [&]<typename ArrayType>() {
+        return [
+            lower_inclusive,
+            upper_inclusive,
+            &processed_cursor,
+            &bitmap_input
+        ]<FilterType filter_type = FilterType::sequential>(
+            const ArrayType* data,
             ValidityView valid_data,
             const int32_t* offsets,
             const int size,
@@ -1048,96 +1054,95 @@ PhyBinaryRangeFilterExpr::ExecRangeVisitorImplForArray(EvalCtx& context) {
             const ValueType& val1,
             const ValueType& val2,
             int index) {
-        AssertInfo(index >= 0,
-                   "array element range predicate requires nested path");
-        // If data is nullptr, this chunk was skipped by SkipIndex.
-        // We only need to update processed_cursor for bitmap_input indexing.
-        if (data == nullptr) {
-            processed_cursor += size;
-            return;
-        }
-        if (lower_inclusive && upper_inclusive) {
-            BinaryRangeElementFuncForArray<ValueType, true, true, filter_type>
-                func;
-            func(val1,
-                 val2,
-                 index,
-                 data,
-                 valid_data,
-                 size,
-                 res,
-                 valid_res,
-                 bitmap_input,
-                 processed_cursor,
-                 offsets);
-        } else if (lower_inclusive && !upper_inclusive) {
-            BinaryRangeElementFuncForArray<ValueType, true, false, filter_type>
-                func;
-            func(val1,
-                 val2,
-                 index,
-                 data,
-                 valid_data,
-                 size,
-                 res,
-                 valid_res,
-                 bitmap_input,
-                 processed_cursor,
-                 offsets);
-
-        } else if (!lower_inclusive && upper_inclusive) {
-            BinaryRangeElementFuncForArray<ValueType, false, true, filter_type>
-                func;
-            func(val1,
-                 val2,
-                 index,
-                 data,
-                 valid_data,
-                 size,
-                 res,
-                 valid_res,
-                 bitmap_input,
-                 processed_cursor,
-                 offsets);
+            AssertInfo(index >= 0,
+                       "array element range predicate requires nested path");
+            // If data is nullptr, this chunk was skipped by SkipIndex.
+            // We only need to update processed_cursor for bitmap_input indexing.
+            if (data == nullptr) {
+                processed_cursor += size;
+                return;
+            }
+            if (lower_inclusive && upper_inclusive) {
+                BinaryRangeElementFuncForArray<ValueType,
+                                               true,
+                                               true,
+                                               filter_type,
+                                               ArrayType>
+                    func;
+                func(val1,
+                     val2,
+                     index,
+                     data,
+                     valid_data,
+                     size,
+                     res,
+                     valid_res,
+                     bitmap_input,
+                     processed_cursor
```

**File**: `internal/core/src/exec/expression/BinaryRangeExpr.h` (modified, +6/-4)
```diff
@@ -190,7 +190,8 @@ struct BinaryRangeElementFuncForJson {
 template <typename ValueType,
           bool lower_inclusive,
           bool upper_inclusive,
-          FilterType filter_type = FilterType::sequential>
+          FilterType filter_type = FilterType::sequential,
+          typename ArrayType = milvus::ArrayView>
 struct BinaryRangeElementFuncForArray {
     using GetType = std::conditional_t<std::is_same_v<ValueType, std::string>,
                                        std::string_view,
@@ -199,7 +200,7 @@ struct BinaryRangeElementFuncForArray {
     operator()(const ValueType& val1,
                const ValueType& val2,
                int index,
-               const milvus::ArrayView* src,
+               const ArrayType* src,
                ValidityView valid_data,
                size_t n,
                TargetBitmapView res,
@@ -222,12 +223,13 @@ struct BinaryRangeElementFuncForArray {
                 res[i] = valid_res[i] = false;
                 continue;
             }
-            if (index >= src[offset].length()) {
+            if (!HasArrayElementAt(src[offset], index)) {
                 res[i] = false;
                 valid_res[i] = false;
                 continue;
             }
-            auto value = src[offset].get_data_unchecked<GetType>(index);
+            auto value =
+                src[offset].template get_data_unchecked<GetType>(index);
             if constexpr (lower_inclusive && upper_inclusive) {
                 res[i] = val1 <= value && value <= val2;
             } else if constexpr (lower_inclusive && !upper_inclusive) {
```

**File**: `internal/core/src/exec/expression/Expr.h` (modified, +336/-63)
```diff
@@ -18,9 +18,11 @@
 
 #include <algorithm>
 #include <bit>
+#include <charconv>
 #include <chrono>
 #include <cmath>
 #include <exception>
+#include <limits>
 #include <memory>
 #include <mutex>
 #include <optional>
@@ -86,6 +88,81 @@ CanUseSkipFilter(bool is_nullable, bool null_rejecting) {
 using SkipChunkFn =
     std::function<bool(const FieldSkipMetricsView&, int64_t chunk_id)>;
 
+// Logical element count of one ARRAY row, null elements included.
+template <typename ArrayType>
+inline size_t
+ArrayRowLength(const ArrayType& row) {
+    if constexpr (std::is_same_v<ArrayType, ArrayValueView>) {
+        return row.size();
+    } else {
+        return static_cast<size_t>(row.length());
+    }
+}
+
+// Subscript of an ARRAY operand (`a[i]`, `s[i][x]`), parsed from
+// nested_path[0]. kWholeArrayOperand: no subscript, the operand is the whole
+// row.
+inline constexpr int kWholeArrayOperand = -1;
+// A subscript that names no element: above INT_MAX or negative. It is never
+// kWholeArrayOperand, and HasArrayElementAt / NestedArrayElementAt treat it as
+// out of bounds, so the operand is UNKNOWN.
+inline constexpr int kArraySubscriptOutOfRange =
+    std::numeric_limits<int>::max();
+
+inline int
+ParseArraySubscript(const std::vector<std::string>& nested_path) {
+    if (nested_path.empty()) {
+        return kWholeArrayOperand;
+    }
+    const auto& text = nested_path[0];
+    const char* last = text.data() + text.size();
+    int index = 0;
+    const auto [end, ec] = std::from_chars(text.data(), last, index);
+    // The plan parser emits only decimal digits here.
+    AssertInfo(ec != std::errc::invalid_argument && end == last,
+               "invalid array subscript '{}'",
+               text);
+    if (ec == std::errc::result_out_of_range || index < 0) {
+        return kArraySubscriptOutOfRange;
+    }
+    return index;
+}
+
+// Whether row[index] is a non-null element. A subscript that misses (out of
+// bounds or a null element) evaluates to UNKNOWN.
+template <typename ArrayType>
+inline bool
+HasArrayElementAt(const ArrayType& row, int index) {
+    if (index < 0 || index == kArraySubscriptOutOfRange ||
+        static_cast<size_t>(index) >= ArrayRowLength(row)) {
+        return false;
+    }
+    if constexpr (std::is_same_v<ArrayType, ArrayValueView>) {
+        return row.is_valid(index);
+    } else {
+        return true;
+    }
+}
+
+// `s[i][tags]` on a nested Array field: the inner Array of struct element i,
+// or nullopt (NULL) when element i is missing or null.
+inline std::optional<ArrayValueView>
+NestedArrayElementAt(const ArrayValueView& row, int index) {
+    if (index < 0 || index == kArraySubscriptOutOfRange ||
+        static_cast<size_t>(index) >= row.size()) {
+        return std::nullopt;
+    }
+    auto inner = row.array_at(index);
+    if (inner.is_null()) {
+        return std::nullopt;
+    }
+    return inner;
+}
+
+// ElementType of an element-level visit that reads element validity only.
+// Its batches carry a placeholder data pointer that must not be read.
+struct ElementValidityOnly {};
+
 // IndexPathSelection.h owns ExprExecPath and metadata-only path selection.
 // Capability inspection must not pin a cold reader to choose an execution path.
 
@@ -518,7 +595,10 @@ class SegmentExpr : public Expr {
         auto field_meta = segment_->get_field_meta(field_id_);
         field_type_ = field_meta.get_data_type();
         is_nullable_ = field_meta.is_nullable();
-        has_nullable_array_element_ = field_meta.has_nullable_array_element();
+        is_native_list_array_ = field_meta.get_data_type() == DataType::ARRAY &&
+                                field_meta.is_native_list_array();
+        is_nested_array_field_ = field_meta.is_nested_array();
+        is_element_nullable_ = field_meta.is_element_nullable();
 
         if (segment_->is_primary_field(field_id_) &&
             IsPrimaryKeyDataType(field_meta.get_data_type())) {
@@ -2079,18 +2159,27 @@ class SegmentExpr : public Expr {
         }
     }
 
+    // std::vector<bool> has no data(), so bool elements use FixedVector.
+    template <typename ElementType>
+    using ElementValueBuffer =
+        std::conditional_t<std::is_same_v<ElementType, bool>,
+                           FixedVector<bool>,
+                           std::vector<ElementType>>;
+
     // Normalize one physical ARRAY row into batches of logical ElementType.
     // Scalar ARRAY rows expose their leaf payload, while recursive ARRAY rows
     // expose their child ArrayValueView values. The caller only sees the
-    // uniform (data, valid_data, size) batch contract.
+    // uniform (data, valid_data, size) batch contract. A null element is
+    // reported through valid_data; its value slot is a default value.
     template <typename ElementType, typename RowType, typename Consumer>
     static void
     VisitArrayElementRun(const RowType& row,
                          int32_t first_element,
                          
```

**File**: `internal/core/src/exec/expression/JsonContainsExpr.cpp` (modified, +76/-17)
```diff
@@ -136,7 +136,10 @@ PhyJsonContainsFilterExpr::Eval(EvalCtx& context, VectorPtr& result) {
     const bool is_element_level_array =
         expr_->column_.data_type_ == DataType::ARRAY &&
         expr_->column_.element_level_;
-    if (expr_->vals_.empty() && !is_element_level_array) {
+    // array_contains*(s[i][tags], []) still yields UNKNOWN for a missing or
+    // null element, so it takes the data path.
+    if (expr_->vals_.empty() && !is_element_level_array &&
+        !IsNestedArrayElementOperand()) {
         auto real_batch_size =
             has_offset_input_ ? input->size() : GetNextBatchSize();
         if (real_batch_size == 0) {
@@ -333,6 +336,10 @@ PhyJsonContainsFilterExpr::ExecArrayContains(EvalCtx& context) {
         return ExecArrayContainsImpl<ArrayValueView, ExprValueType, true>(
             context);
     }
+    if (is_native_list_array_) {
+        return ExecArrayContainsImpl<ArrayValueView, ExprValueType, false>(
+            context);
+    }
     return ExecArrayContainsImpl<ArrayView, ExprValueType, false>(context);
 }
 
@@ -375,8 +382,8 @@ PhyJsonContainsFilterExpr::ExecArrayContainsImpl(EvalCtx& context) {
                "ARRAY contains element-level mismatch: plan={}, executor={}",
                expr_->column_.element_level_,
                ElementLevel);
-    AssertInfo(expr_->column_.nested_path_.size() == 0,
-               "[ExecArrayContains]nested path must be null");
+    const int nested_index =
+        ArrayContainsNestedIndex<ArrayType, ElementLevel>();
 
     auto res_vec =
         std::make_shared<ColumnVector>(TargetBitmap(real_batch_size, false),
@@ -397,8 +404,8 @@ PhyJsonContainsFilterExpr::ExecArrayContainsImpl(EvalCtx& context) {
 
     int processed_cursor = 0;
     auto execute_sub_batch =
-        [&processed_cursor, &
-         bitmap_input ]<FilterType filter_type = FilterType::sequential>(
+        [&processed_cursor, &bitmap_input,
+         nested_index ]<FilterType filter_type = FilterType::sequential>(
             const ArrayType* data,
             ValidityView valid_data,
             const int32_t* offsets,
@@ -412,10 +419,15 @@ PhyJsonContainsFilterExpr::ExecArrayContainsImpl(EvalCtx& context) {
             processed_cursor += size;
             return;
         }
-        auto executor = [&](size_t i) {
-            const auto& array = data[i];
+        // Null elements match no value.
+        auto executor = [&](const ArrayType& array) {
             const auto array_size = GetArrayRowSize(array);
             for (size_t j = 0; j < array_size; ++j) {
+                if constexpr (std::is_same_v<ArrayType, ArrayValueView>) {
+                    if (!array.is_valid(j)) {
+                        continue;
+                    }
+                }
                 if (elements.find(array.template get_data_unchecked<GetType>(
                         j)) != elements.end()) {
                     return true;
@@ -436,7 +448,19 @@ PhyJsonContainsFilterExpr::ExecArrayContainsImpl(EvalCtx& context) {
             if (has_bitmap_input && !bitmap_input[processed_cursor + i]) {
                 continue;
             }
-            res[i] = executor(offset);
+            if constexpr (std::is_same_v<ArrayType, ArrayValueView>) {
+                if (nested_index >= 0) {
+                    auto inner =
+                        NestedArrayElementAt(data[offset], nested_index);
+                    if (!inner.has_value()) {
+                        res[i] = valid_res[i] = false;
+                        continue;
+                    }
+                    res[i] = executor(*inner);
+                    continue;
+                }
+            }
+            res[i] = executor(data[offset]);
         }
         processed_cursor += size;
     };
@@ -977,6 +1001,10 @@ PhyJsonContainsFilterExpr::ExecArrayContainsAll(EvalCtx& context) {
         return ExecArrayContainsAllImpl<ArrayValueView, ExprValueType, true>(
             context);
     }
+    if (is_native_list_array_) {
+        return ExecArrayContainsAllImpl<ArrayValueView, ExprValueType, false>(
+            context);
+    }
     return ExecArrayContainsAllImpl<ArrayView, ExprValueType, false>(context);
 }
 
@@ -989,8 +1017,8 @@ PhyJsonContainsFilterExpr::ExecArrayContainsAllImpl(EvalCtx& context) {
                            ExprValueType>;
     auto* input = context.get_offset_input();
     const auto& bitmap_input = context.get_bitmap_input();
-    AssertInfo(expr_->column_.nested_path_.size() == 0,
-               "[ExecArrayContainsAll]nested path must be null");
+    const int nested_index =
+        ArrayContainsNestedIndex<ArrayType, ElementLevel>();
     auto next_batch_size = GetNextRealBatchSize(input, ElementLevel);
     if (!next_batch_size.has_value()) {
         return nullptr;
@@ -1028,8 +1056,13 @@ PhyJsonContainsFilterExpr::ExecArrayContainsAllImpl(EvalCtx& context) {
     std::vector<uint64_t> found_large(
         matcher.use_small() ? 0 : matcher.num_words()
```

**File**: `internal/core/src/exec/expression/JsonContainsExpr.h` (modified, +25/-1)
```diff
@@ -519,7 +519,8 @@ class PhyJsonContainsFilterExpr : public SegmentExpr {
             return;
         }
         if (expr_->column_.data_type_ == DataType::ARRAY &&
-            (expr_->column_.element_level_ || expr_->vals_.empty())) {
+            (expr_->column_.element_level_ || expr_->vals_.empty() ||
+             is_native_list_array_)) {
             exec_path_ = ExprExecPath::RawData;
             return;
         }
@@ -562,6 +563,29 @@ class PhyJsonContainsFilterExpr : public SegmentExpr {
     VectorPtr
     ExecArrayContainsImpl(EvalCtx& context);
 
+    // Struct element index i for array_contains*(s[i][tags], ...) on a
+    // nested Array field, or kWholeArrayOperand when the row itself is the
+    // operand.
+    template <typename ArrayType, bool ElementLevel>
+    int
+    ArrayContainsNestedIndex() const {
+        if constexpr (std::is_same_v<ArrayType, ArrayValueView> &&
+                      !ElementLevel) {
+            if (IsNestedArrayElementOperand()) {
+                return ParseArraySubscript(expr_->column_.nested_path_);
+            }
+            if (is_nested_array_field_) {
+                ThrowInfo(ErrorCode::Unsupported,
+                          "array_contains on nested ARRAY field {} requires "
+                          "a struct element index",
+                          field_id_.get());
+            }
+        }
+        AssertInfo(expr_->column_.nested_path_.empty(),
+                   "[ExecArrayContains]nested path must be null");
+        return kWholeArrayOperand;
+    }
+
     template <typename ExprValueType>
     VectorPtr
     ExecJsonContainsAll(EvalCtx& context);
```

#### Recent Merged Pull Requests:
- **PR #55064** (2026-11-03): fix: [hotfix-3.0.5] prefer safe JSON indexes over stats (@sparknack)
- **PR #55063** (2026-11-03): fix: [hotfix-3.0.5] preserve candidate masks in logical and GIS filters (@zhengbuqian)
- **PR #55060** (2026-11-03): fix: [3.0] preserve candidate masks in logical and GIS filters (@zhengbuqian)
- **PR #55058** (2026-11-03): fix: [2.6] preserve candidate masks in logical and GIS filters (@zhengbuqian)
- **PR #55057** (2026-11-03): fix: preserve candidate masks in logical and GIS filters (@zhengbuqian)
- **PR #55042** (closed): fix: [3.0] keep array-index JSON paths off a flat index on the whole field (@xiaofan-luan)

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

## X. prevent CDC replicator panic after source scanner termination (#54663)

**RULE**:
When implementing operations in `internal/cdc/replication/replicatemanager/channel_replicator.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in milvus-io/milvus. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `20d2246e`: prevent CDC replicator panic after source scanner termination (#54663). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `internal/cdc/replication/replicatemanager/channel_replicator.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
var errScannerClosed = errors.New("replication source scanner closed")

		if err := r.startConsumeLoop(); err != nil &&
			!errors.Is(err, context.Canceled) &&
			!errors.Is(err, replicatestream.ErrReplicationRemoved) {
			logger.Warn(context.TODO(), "replication source scanner stopped", mlog.Err(err))
		}
func (r *channelReplicator) startConsumeLoop() error {
	var scannerDone <-chan struct{}
	if r.msgScanner != nil {
		scannerDone = r.msgScanner.Done()
	}
			return nil
		case <-scannerDone:
			return r.scannerStoppedError(true)
		case msg, ok := <-r.msgChan:
			if !ok {
				return r.scannerStoppedError(false)
			}
					return replicatestream.ErrReplicationRemoved
func (r *channelReplicator) scannerStoppedError(scannerDone bool) error {
	if r.msgScanner == nil {
		return errScannerClosed
	}

	if !scannerDone {
		select {
		case <-r.msgScanner.Done():
		case <-r.asyncNotifier.Context().Done():
			return r.asyncNotifier.Context().Err()
		}
	}
	if err := r.msgScanner.Error(); err != nil {
		return errors.Wrap(err, "replication source scanner stopped")
	}
	return errScannerClosed
}

```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
		r.startConsumeLoop()
func (r *channelReplicator) startConsumeLoop() {
			return
		case msg := <-r.msgChan:
					return
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `20d2246e` are properly handled with clean fallback behavior.
