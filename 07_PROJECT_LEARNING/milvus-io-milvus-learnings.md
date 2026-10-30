> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/milvus-io-milvus-learnings.md`  
> **Source**: github ([https://github.com/milvus-io/milvus](https://github.com/milvus-io/milvus))  
> **Source Version**: `eb9f5b29`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-30T11:28:18.955Z  
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
> **Harvest Timestamp**: 2026-10-30T11:28:17.822Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `milvus-io/milvus`
- **Description**: Milvus is a high-performance, cloud-native vector database built for scalable vector ANN search
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 46537 stars

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
- **Issue #54881** (2026-10-30): **fix: [3.0] retry worker cleanup during import task GC**
  *Symptoms*: Backport of #54867.  pr: #54867 issue: #52332  ## Changes  Cherry-picks source commit `67b23600ed9b2efc474118020ae23473fb5730b8` onto branch `3.0`.  - Let GC retry worker cleanup for expired V2 import/pre-import tasks whose scheduler owner is already gone, retaining metadata on RPC or catalog failures. - Preserve failed-output segment and CDC rollback gates before deleting task/job metadata. - Keep the reviewed per-task synchronization across worker callbacks, slot calculation, no-slot requeue and delayed requeue, preventing finalized tasks from re-entering the scheduler or accessing deleted jobs. - Retain all seven Finalize concurrency regression groups and the GC/persistence/missing-job coverage.  Only a test import-context conflict needed adaptation: retain the 3.0 fixture without introducing master's metacache dependency. All added/deleted lines across the ten files match the source fix.  ## Validation  - On the 3.0 checkout, the full scheduler/task package passes with `dynamic,test` build tags. - All seven Finalize concurrency groups pass with `-race -tags dynamic,test -count=20`. - Scheduler/task golangci-lint reports zero issues; changed-file gofumpt/gci and `git diff --check` pass. - On an isolated development host using Go 1.26.9 and 3.0 native libraries, the original 3.0 GC baseline passes all nine cases. The patched target `TestCalculateTaskSlot|TestImportChecker|TestImportInspector` passes 19 top-level tests / 98 cases including subtests, with all 50 ImportChecker

- **Issue #54875** (2026-10-30): **fix: make REST v1 test log directory creation race-safe**
  *Symptoms*: ## What does this PR do?  Fix REST v1 test collection failing with `FileExistsError` when parallel pytest workers initialize the same client log directory. Use `os.makedirs(..., exist_ok=True)` so a directory created between the existing check and creation is accepted, matching REST v2.  This is a one-line change to the existing test helper; no new test files are added.  ## Verification  - Local validation confirmed concurrent directory creation is accepted and an existing ordinary file still raises an error. - `git diff --check`: passed. - Separate 10-process reproduction: original REST v1 initialization failed 23/100 times; the candidate fix passed 100/100. Forced interleaving failed 27/30 original initializations and passed 30/30 with the fix. - Full Milvus E2E was not run locally.  Observed in TCUS E2E build #442 during REST v1 collection, before test execution. No server behavior changes. 

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

### Incident Patch 1: `31c941f0` (2026-10-29)
**Commit Message**: fix: Bound Python E2E collection cleanup and report failures (#54349)

Python E2E collection drops can wait without an RPC deadline, both
during automatic teardown and when a test calls the MilvusClient drop
helper directly. In CI #65505,
`test_milvus_client_list_collections_multi_collections` blocked in its
test-body drop loop until pytest-timeout killed the worker; the
crash-rerun path then raised an unrelated `NotImplementedError`.

This change:

- gives `TestMilvusClientV2Base.drop_collection()` a 120-second default
RPC timeout when the caller omits it or supplies `None`, preserving
explicit timeouts and the existing positional check arguments;
- initializes collection tracking alongside each test's wrappers,
retaining the legacy class-scoped lifecycle;
- passes finite RPC timeouts from a shared 120-second budget checked
between collection-cleanup operations, and gives the utility drop
wrapper its usual 20-second default;
- reports unsuccessful cleanup results and exceptions after attempting
remaining collection cleanup and resetting connections; removes aliases
in the owning connection, skips missing collections, and avoids
duplicate drops.

issue: #54348
Fixes #54348

Validat

**File**: `tests/python_client/base/client_base.py` (modified, +89/-18)
```diff
@@ -1,4 +1,5 @@
 import sys
+import time
 
 from base.database_wrapper import ApiDatabaseWrapper
 from pymilvus import DefaultConfig
@@ -18,6 +19,8 @@
 from pymilvus import DataType, MilvusClient, ResourceGroupInfo, utility
 from utils.util_log import test_log as log
 
+COLLECTION_CLEANUP_TIMEOUT = 120
+
 
 class Base:
     """Initialize class object"""
@@ -30,7 +33,7 @@ class Base:
     collection_schema_wrap = None
     field_schema_wrap = None
     database_wrap = None
-    tear_down_collection_names = []
+    tear_down_collection_names = ()
     tear_down_role_names = []
     tear_down_user_names = []
     resource_group_list = []
@@ -51,6 +54,9 @@ def setup_method(self, method):
         self._setup_objects()
 
     def _setup_objects(self):
+        # TestCaseClassBase calls this once per class; ordinary cases call it
+        # once per method. Keep the registry in the same scope as the wrappers.
+        self.tear_down_collection_names = []
         self.connection_wrap = ApiConnectionsWrapper()
         self.utility_wrap = ApiUtilityWrapper()
         self.collection_wrap = ApiCollectionWrapper()
@@ -66,6 +72,67 @@ def teardown_method(self, method):
         log.info(f"[teardown_method] Start teardown test case {method.__name__}...")
         self._teardown_objects()
 
+    def _cleanup_collections(self):
+        deadline = time.monotonic() + COLLECTION_CLEANUP_TIMEOUT
+        errors = []
+
+        def cleanup_call(action, operation, *args, **kwargs):
+            try:
+                timeout = deadline - time.monotonic()
+                if timeout <= 0:
+                    raise TimeoutError("collection cleanup deadline exceeded")
+                result, success = operation(*args, timeout=timeout, check_task=ct.CheckTasks.check_nothing, **kwargs)
+                if not success:
+                    raise AssertionError(str(result))
+                if time.monotonic() >= deadline:
+                    raise TimeoutError("collection cleanup deadline exceeded")
+                return result
+            except Exception as error:
+                errors.append((action, error))
+                log.exception(f"Collection cleanup failed: {action}")
+                return None
+
+        def drop_aliases(collection_name, using):
+            aliases = cleanup_call(
+                f"list aliases for {collection_name}", self.utility_wrap.list_aliases, collection_name, using=using
+            )
+            for alias in aliases or []:
+                cleanup_call(f"drop alias {alias}", self.utility_wrap.drop_alias, alias, using=using)
+
+        # A collection may be registered more than once, or also be owned by
+        # collection_wrap. Attempt each drop only once during this teardown.
+        collection_names = dict.fromkeys(name for name in self.tear_down_collection_names if name is not None)
+        collection = self.collection_wrap.collection
+        collection_list = None
+        if collection is not None:
+            if collection.name.startswith("alias"):
+                log.info(f"collection {collection.name} is alias, skip drop operation")
+            else:
+                using = collection._using
+                wrapped_collection_list = cleanup_call(
+                    f"list collections using {using}", self.utility_wrap.list_collections, using=using
+                )
+                if wrapped_collection_list is not None and collection.name in wrapped_collection_list:
+                    drop_aliases(collection.name, using)
+                    cleanup_call(f"drop collection {collection.name}", self.collection_wrap.drop)
+                if using == DefaultConfig.DEFAULT_USING:
+                    collection_list = wrapped_collection_list
+                    collection_names.pop(collection.name, None)
+
+        if collection_names:
+            if collection_list is None:
+                collection_list = cleanup_call("list collections", self.utility_wrap.list_collections)
+            if collection_list is not None:
+                for collection_name in collection_names:
+                    if collection_name not in collection_list:
+                        continue
+                    drop_aliases(collection_name, DefaultConfig.DEFAULT_USING)
+                    cleanup_call(
+                        f"drop collection {collection_name}", self.utility_wrap.drop_collection, collection_name
+                    )
+
+        return errors
+
     def _teardown_objects(self):
         # Prioritize uri and token for connection
         if cf.param_info.param_uri:
@@ -82,29 +149,29 @@ def _teardown_objects(self):
                 else None
             )
 
+        cleanup_errors = []
         try:
             """ Drop collection before disconnect """
             if not self.connection_wrap.has_connection(alias=DefaultConfig.DEFAULT_USING)[0]:
                 if token:
-                    self.connection_wrap.connect(alias=DefaultConfig.DEFAULT_USING, ur
```

**File**: `tests/python_client/base/client_v2_base.py` (modified, +4/-0)
```diff
@@ -489,6 +489,10 @@ def list_collections(self, client, timeout=None, check_task=None, check_items=No
 
     @trace()
     def drop_collection(self, client, collection_name, check_task=None, check_items=None, **kwargs):
+        # Drops in test bodies do not use Base's collection-cleanup budget.
+        timeout = kwargs.get("timeout")
+        kwargs["timeout"] = TIMEOUT if timeout is None else timeout
+
         func_name = sys._getframe().f_code.co_name
         res, check = api_request([client.drop_collection, collection_name], **kwargs)
         check_result = ResponseChecker(
```

**File**: `tests/python_client/base/utility_wrapper.py` (modified, +1/-0)
```diff
@@ -375,6 +375,7 @@ def has_partition(self, collection_name, partition_name, using="default", check_
         return res, check_result
 
     def drop_collection(self, collection_name, timeout=None, using="default", check_task=None, check_items=None):
+        timeout = TIMEOUT if timeout is None else timeout
         func_name = sys._getframe().f_code.co_name
         res, is_succ = api_request([self.ut.drop_collection, collection_name, timeout, using])
         check_result = ResponseChecker(
```

**File**: `tests/scripts/test_python_client_cleanup.py` (added, +468/-0)
```diff
@@ -0,0 +1,468 @@
+"""Server-independent regressions for Python E2E collection cleanup.
+
+Run explicitly with: python3 -m pytest tests/scripts/test_python_client_cleanup.py
+The tests use the E2E Python dependencies and a local gRPC fault injector.
+"""
+
+import importlib
+import threading
+import time
+import xml.etree.ElementTree as ET
+from concurrent.futures import ThreadPoolExecutor
+from pathlib import Path
+from types import SimpleNamespace
+from unittest.mock import Mock, call
+
+import grpc
+import numpy as np
+import pytest
+from pymilvus import MilvusClient
+from pymilvus.client.grpc_handler import GrpcHandler
+from pymilvus.grpc_gen import common_pb2, milvus_pb2_grpc
+
+pytest_plugins = ["pytester"]
+
+
+@pytest.fixture
+def client_base(monkeypatch):
+    monkeypatch.syspath_prepend(str(Path(__file__).resolve().parents[1] / "python_client"))
+    # Standalone runs and pytester workers do not load python_client/conftest.py.
+    # Match its NumPy 2 compatibility bootstrap before importing legacy wrappers.
+    if not hasattr(np, "NaN"):
+        monkeypatch.setattr(np, "NaN", np.nan, raising=False)
+    # Match conftest's import order: common_func and the wrappers depend on
+    # each other during import.
+    common = importlib.import_module("common.common_func")
+    module = importlib.import_module("base.client_base")
+    for name, value in {
+        "param_uri": "http://localhost:19530",
+        "param_token": "",
+        "param_user": "",
+        "param_password": "",
+    }.items():
+        monkeypatch.setattr(common.param_info, name, value)
+    return module
+
+
+@pytest.fixture
+def case(client_base):
+    case = client_base.Base()
+    case._setup_objects()
+    case.skip_global_role_cleanup = True
+    case.connection_wrap = Mock(spec=client_base.ApiConnectionsWrapper)
+    case.connection_wrap.has_connection.return_value = (True, True)
+    case.connection_wrap.list_connections.return_value = ([("default", None), ("extra", None)], True)
+    case.collection_wrap = Mock(spec=client_base.ApiCollectionWrapper)
+    case.collection_wrap.collection = None
+    case.utility_wrap = Mock(spec=client_base.ApiUtilityWrapper)
+    case.utility_wrap.list_collections.return_value = (["one", "two", "unowned"], True)
+    case.utility_wrap.list_aliases.return_value = ([], True)
+    case.utility_wrap.drop_alias.return_value = (None, True)
+    case.utility_wrap.drop_collection.return_value = (None, True)
+    case.utility_wrap.list_resource_groups.return_value = ([], True)
+    return case
+
+
+@pytest.fixture
+def client_v2_base(client_base):
+    return importlib.import_module("base.client_v2_base")
+
+
+@pytest.fixture
+def client_v2_case(client_v2_base):
+    case = client_v2_base.TestMilvusClientV2Base()
+    case._setup_objects()
+    return case
+
+
+@pytest.fixture
+def stalled_drop():
+    canceled = threading.Event()
+    observed_deadlines = []
+
+    class StalledDrop(milvus_pb2_grpc.MilvusServiceServicer):
+        def DropCollection(self, request, context):
+            observed_deadlines.append(context.time_remaining())
+            context.add_callback(canceled.set)
+            canceled.wait(20)
+            return common_pb2.Status()
+
+    with ThreadPoolExecutor(max_workers=1) as executor:
+        server = grpc.server(executor)
+        milvus_pb2_grpc.add_MilvusServiceServicer_to_server(StalledDrop(), server)
+        port = server.add_insecure_port("127.0.0.1:0")
+        server.start()
+        channel = grpc.insecure_channel(f"127.0.0.1:{port}")
+        try:
+            grpc.channel_ready_future(channel).result(timeout=5)
+            handler = GrpcHandler(channel=channel)
+            client = object.__new__(MilvusClient)
+            client._get_connection = lambda: handler
+            client._generate_call_context = lambda **kwargs: None
+            yield SimpleNamespace(
+                handler=handler, client=client, canceled=canceled, observed_deadlines=observed_deadlines
+            )
+        finally:
+            canceled.set()
+            channel.close()
+            server.stop(0).wait(timeout=5)
+
+
+def test_registries_are_isolated_and_reset_with_wrappers(client_base):
+    first, second = client_base.Base(), client_base.Base()
+    first._setup_objects()
+    second._setup_objects()
+    first.tear_down_collection_names.append("first")
+    assert second.tear_down_collection_names == []
+    assert client_base.Base.tear_down_collection_names == ()
+    first._setup_objects()
+    assert first.tear_down_collection_names == []
+
+
+def test_success_drops_only_owned_collections_and_aliases_once(case):
+    case.tear_down_collection_names.extend(["one", None, "one", "missing", "two"])
+    case.utility_wrap.list_aliases.side_effect = [(["one_alias"], True), ([], True)]
+    case._teardown_objects()
+    assert [c.args for c in case.utility_wrap.drop_collection.call_args_list] == [("one",), ("two",)]
+    assert case.utility_wrap.drop_alias.call_args
```

---

### Incident Patch 2: `00dac515` (2026-10-30)
**Commit Message**: fix: retry worker cleanup during import task GC (#54867)

issue: #52332

## Problem

A terminal V2 import task can lose its scheduler owner after worker
cleanup fails while retaining its persisted NodeID. GC only checks that
NodeID and skips the task forever, including after coordinator restart.

## Changes

- Retry worker cleanup from import GC and remove task/job metadata only
after cleanup succeeds. Keep metadata for a later GC tick on RPC or
catalog errors, preserving the existing failed-output segment and CDC
rollback gates.
- Add a narrow scheduler Finalize callback to drain in-flight work
before cleanup. Mark failed-job tasks terminal under that lock, re-read
the latest worker assignment, and reject queued Query callbacks that no
longer own the task.
- Hold the task lock across slot calculation and no-slot/backoff
requeues, checking terminal state again after Pop and before delayed
requeue. Finalized tasks cannot re-enter the queue or read job metadata
after GC removes it.
- Make import slot calculation tolerate a missing job as a secondary
safeguard, and stop admitting Pending tasks from terminal import jobs.

This extracts the failed-import GC fix from #52277 without its
r

**File**: `internal/datacoord/import_checker.go` (modified, +60/-15)
```diff
@@ -28,6 +28,8 @@ import (
 	"github.com/milvus-io/milvus-proto/go-api/v3/commonpb"
 	"github.com/milvus-io/milvus/internal/datacoord/allocator"
 	"github.com/milvus-io/milvus/internal/datacoord/broker"
+	"github.com/milvus-io/milvus/internal/datacoord/session"
+	"github.com/milvus-io/milvus/internal/datacoord/task"
 	"github.com/milvus-io/milvus/internal/streamingcoord/server/broadcaster"
 	"github.com/milvus-io/milvus/internal/util/importutilv2"
 	"github.com/milvus-io/milvus/internal/util/importutilv2/importid"
@@ -77,6 +79,8 @@ type importChecker struct {
 	importMeta ImportMeta
 	ci         CompactionInspector
 	handler    Handler
+	cluster    session.Cluster
+	scheduler  task.GlobalScheduler
 
 	hooks importCheckerHooks
 
@@ -99,6 +103,8 @@ func NewImportChecker(ctx context.Context,
 	importMeta ImportMeta,
 	ci CompactionInspector,
 	handler Handler,
+	cluster session.Cluster,
+	scheduler task.GlobalScheduler,
 	hooks importCheckerHooks,
 ) ImportChecker {
 	return &importChecker{
@@ -109,6 +115,8 @@ func NewImportChecker(ctx context.Context,
 		importMeta: importMeta,
 		ci:         ci,
 		handler:    handler,
+		cluster:    cluster,
+		scheduler:  scheduler,
 		hooks:      hooks,
 		closeChan:  make(chan struct{}),
 	}
@@ -930,23 +938,9 @@ func (c *importChecker) checkGC(job ImportJob) {
 		tasks := c.importMeta.GetTaskByJob(c.ctx, job.GetJobID())
 		shouldRemoveJob := true
 		for _, task := range tasks {
-			if job.GetState() == internalpb.ImportJobState_Failed && task.GetType() == ImportTaskType {
-				if len(task.(*importTask).GetSegmentIDs()) != 0 || len(task.(*importTask).GetSortedSegmentIDs()) != 0 {
-					shouldRemoveJob = false
-					continue
-				}
-			}
-			if task.GetNodeID() != NullNodeID {
-				shouldRemoveJob = false
-				continue
-			}
-			err := c.importMeta.RemoveTask(c.ctx, task.GetTaskID())
-			if err != nil {
-				log.Warn(c.ctx, "remove task failed during GC", WrapTaskLog(task, mlog.Err(err))...)
+			if !c.cleanupTaskForGC(job, task.GetTaskID()) {
 				shouldRemoveJob = false
-				continue
 			}
-			log.Info(c.ctx, "reached GC retention, task removed", WrapTaskLog(task)...)
 		}
 		if !shouldRemoveJob {
 			return
@@ -1011,6 +1005,57 @@ func (c *importChecker) checkGC(job ImportJob) {
 	}
 }
 
+func (c *importChecker) cleanupTaskForGC(job ImportJob, taskID int64) bool {
+	cleaned := false
+	cleanup := func() {
+		// An in-flight Create may have persisted its assignment while Finalize
+		// waited for it. Read the task only after scheduler callbacks drain.
+		latest := c.importMeta.GetTask(c.ctx, taskID)
+		if latest == nil {
+			cleaned = true
+			return
+		}
+		if job.GetState() == internalpb.ImportJobState_Failed {
+			// A queued Create must see a terminal state after Finalize releases
+			// the task lock, even if the failed-job checker has not run yet.
+			if latest.GetState() != datapb.ImportTaskStateV2_Failed {
+				if err := c.importMeta.UpdateTask(c.ctx, taskID,
+					UpdateState(datapb.ImportTaskStateV2_Failed), UpdateReason(job.GetReason())); err != nil {
+					mlog.Warn(c.ctx, "mark import task failed during GC", WrapTaskLog(latest, mlog.Err(err))...)
+					return
+				}
+			}
+			if latest.GetType() == ImportTaskType {
+				importTask := latest.(*importTask)
+				if len(importTask.GetSegmentIDs()) != 0 || len(importTask.GetSortedSegmentIDs()) != 0 {
+					return
+				}
+			}
+		}
+		if latest.GetNodeID() != NullNodeID {
+			if c.cluster == nil {
+				return
+			}
+			if err := DropImportTask(latest, c.cluster, c.importMeta); err != nil {
+				mlog.Warn(c.ctx, "drop import task during GC failed, will retry", WrapTaskLog(latest, mlog.Err(err))...)
+				return
+			}
+		}
+		if err := c.importMeta.RemoveTask(c.ctx, taskID); err != nil {
+			mlog.Warn(c.ctx, "remove task failed during GC", WrapTaskLog(latest, mlog.Err(err))...)
+			return
+		}
+		mlog.Info(c.ctx, "reached GC retention, task removed", WrapTaskLog(latest)...)
+		cleaned = true
+	}
+	if c.scheduler != nil {
+		c.scheduler.Finalize(taskID, cleanup)
+	} else {
+		cleanup()
+	}
+	return cleaned
+}
+
 // isPermanentRollbackErr reports whether a RollbackImport broadcast error is permanent,
 // i.e. retrying it can never succeed, so the failed job should still be GC'd rather than
 // retried forever (which would leak its metadata). Everything else is treated as transient
```

**File**: `internal/datacoord/import_checker_test.go` (modified, +135/-2)
```diff
@@ -33,6 +33,8 @@ import (
 	"github.com/milvus-io/milvus-proto/go-api/v3/schemapb"
 	"github.com/milvus-io/milvus/internal/datacoord/allocator"
 	broker2 "github.com/milvus-io/milvus/internal/datacoord/broker"
+	"github.com/milvus-io/milvus/internal/datacoord/session"
+	"github.com/milvus-io/milvus/internal/datacoord/task"
 	"github.com/milvus-io/milvus/internal/metacache"
 	"github.com/milvus-io/milvus/internal/metastore/mocks"
 	"github.com/milvus-io/milvus/internal/metastore/model"
@@ -100,7 +102,7 @@ func (s *ImportCheckerSuite) SetupTest() {
 		}, nil
 	}).Maybe()
 
-	checker := NewImportChecker(context.TODO(), meta, broker, s.alloc, importMeta, ci, handler, importCheckerHooks{}).(*importChecker)
+	checker := NewImportChecker(context.TODO(), meta, broker, s.alloc, importMeta, ci, handler, nil, nil, importCheckerHooks{}).(*importChecker)
 	s.checker = checker
 
 	job := &importJob{
@@ -594,6 +596,137 @@ func (s *ImportCheckerSuite) TestCheckGC() {
 	s.Equal(0, len(s.importMeta.GetJobBy(context.TODO())))
 }
 
+func (s *ImportCheckerSuite) TestCheckGCPreImportWorkerCleanup() {
+	s.checkGCWorkerCleanup(PreImportTaskType)
+}
+
+func (s *ImportCheckerSuite) TestCheckGCImportWorkerCleanup() {
+	s.checkGCWorkerCleanup(ImportTaskType)
+}
+
+func (s *ImportCheckerSuite) checkGCWorkerCleanup(taskType TaskType) {
+	catalog := s.importMeta.(*importMeta).catalog.(*mocks.DataCoordCatalog)
+	catalog.EXPECT().SaveImportJob(mock.Anything, mock.Anything).Return(nil)
+	s.NoError(s.importMeta.UpdateJob(context.TODO(), s.jobID, UpdateJobState(internalpb.ImportJobState_Failed)))
+	s.manuallyUpdateJob(s.jobID, func(job ImportJob) { job.(*importJob).CleanupTs = 1 })
+
+	const taskID, nodeID = int64(1), int64(17)
+	var gcTask ImportTask
+	if taskType == PreImportTaskType {
+		catalog.EXPECT().SavePreImportTask(mock.Anything, mock.Anything).Return(nil)
+		catalog.EXPECT().DropPreImportTask(mock.Anything, taskID).Return(nil).Once()
+		preImport := &preImportTask{importMeta: s.importMeta}
+		preImport.task.Store(&datapb.PreImportTask{
+			JobID: s.jobID, TaskID: taskID, NodeID: nodeID, State: datapb.ImportTaskStateV2_Failed,
+		})
+		gcTask = preImport
+	} else {
+		catalog.EXPECT().SaveImportTask(mock.Anything, mock.Anything).Return(nil)
+		catalog.EXPECT().DropImportTask(mock.Anything, taskID).Return(nil).Once()
+		importing := &importTask{importMeta: s.importMeta}
+		importing.task.Store(&datapb.ImportTaskV2{
+			JobID: s.jobID, TaskID: taskID, NodeID: nodeID, State: datapb.ImportTaskStateV2_Failed,
+		})
+		gcTask = importing
+	}
+	s.NoError(s.importMeta.AddTask(context.TODO(), gcTask))
+	cluster := session.NewMockCluster(s.T())
+	s.checker.cluster = cluster
+	s.checker.scheduler = task.NewGlobalTaskScheduler(context.TODO(), cluster)
+
+	// Simulate a failed task restored from metadata: the scheduler no longer
+	// owns it, but its previous worker assignment still needs cleanup.
+	cluster.EXPECT().DropImport(nodeID, taskID).Return(errors.New("worker unavailable")).Once()
+	s.checker.checkGC(s.importMeta.GetJob(context.TODO(), s.jobID))
+	s.NotNil(s.importMeta.GetJob(context.TODO(), s.jobID))
+	s.Equal(nodeID, s.importMeta.GetTask(context.TODO(), taskID).GetNodeID())
+
+	cluster.EXPECT().DropImport(nodeID, taskID).Return(nil).Once()
+	catalog.EXPECT().DropImportJob(mock.Anything, s.jobID).Return(nil).Once()
+	s.checker.checkGC(s.importMeta.GetJob(context.TODO(), s.jobID))
+	s.Nil(s.importMeta.GetTask(context.TODO(), taskID))
+	s.Nil(s.importMeta.GetJob(context.TODO(), s.jobID))
+}
+
+func (s *ImportCheckerSuite) TestCheckGCWorkerNotFound() {
+	s.setupGCReadyFailedJob()
+	s.NoError(s.importMeta.UpdateTask(context.TODO(), 1, UpdateNodeID(17)))
+	catalog := s.importMeta.(*importMeta).catalog.(*mocks.DataCoordCatalog)
+	cluster := session.NewMockCluster(s.T())
+	s.checker.cluster = cluster
+	s.checker.scheduler = task.NewGlobalTaskScheduler(context.TODO(), cluster)
+	cluster.EXPECT().DropImport(int64(17), int64(1)).Return(merr.ErrNodeNotFound).Once()
+	catalog.EXPECT().DropImportTask(mock.Anything, int64(1)).Return(nil).Once()
+	catalog.EXPECT().DropImportJob(mock.Anything, s.jobID).Return(nil).Once()
+	s.checker.checkGC(s.importMeta.GetJob(context.TODO(), s.jobID))
+	s.Nil(s.importMeta.GetTask(context.TODO(), 1))
+	s.Nil(s.importMeta.GetJob(context.TODO(), s.jobID))
+}
+
+func (s *ImportCheckerSuite) TestCheckGCWorkerCleanupPersistenceFailure() {
+	s.setupGCReadyFailedJob()
+	s.NoError(s.importMeta.UpdateTask(context.TODO(), 1, UpdateNodeID(17)))
+	catalog := s.importMeta.(*importMeta).catalog.(*mocks.DataCoordCatalog)
+	catalog.ExpectedCalls = nil
+	cluster := session.NewMockCluster(s.T())
+	s.checker.cluster = cluster
+	s.checker.scheduler = task.NewGlobalTaskScheduler(context.TODO(), cluster)
+	cluster.EXPECT().DropImport(int64(17), int64(1)).Return(nil).Twice()
+	catalog.EXPECT().SaveImportTask(mock.Anything, mock.Anything).Return(errors.New("catalog unavailable")).Once()
+	s.checker.checkGC(s.importMeta.GetJob(context.TODO()
```

**File**: `internal/datacoord/import_inspector.go` (modified, +4/-0)
```diff
@@ -27,6 +27,7 @@ import (
 	"github.com/milvus-io/milvus/internal/datacoord/task"
 	"github.com/milvus-io/milvus/pkg/v3/mlog"
 	"github.com/milvus-io/milvus/pkg/v3/proto/datapb"
+	"github.com/milvus-io/milvus/pkg/v3/proto/internalpb"
 )
 
 const (
@@ -187,6 +188,9 @@ func (s *importInspector) inspect() {
 		for _, task := range tasks {
 			switch task.GetState() {
 			case datapb.ImportTaskStateV2_Pending:
+				if job.GetState() == internalpb.ImportJobState_Failed || job.GetState() == internalpb.ImportJobState_Completed {
+					continue
+				}
 				switch task.GetType() {
 				case ReshardTaskType:
 					// A ReshardTask is persisted just before the job advances to
```

**File**: `internal/datacoord/import_inspector_test.go` (modified, +20/-0)
```diff
@@ -421,6 +421,26 @@ func TestImportInspector(t *testing.T) {
 	suite.Run(t, new(ImportInspectorSuite))
 }
 
+func TestImportInspectorSkipsPendingTasksOfTerminalJobs(t *testing.T) {
+	for _, state := range []internalpb.ImportJobState{
+		internalpb.ImportJobState_Failed, internalpb.ImportJobState_Completed,
+	} {
+		t.Run(state.String(), func(t *testing.T) {
+			importMeta := NewMockImportMeta(t)
+			scheduler := task2.NewMockGlobalScheduler(t)
+			inspector := NewImportInspector(context.Background(), nil, importMeta, scheduler, nil).(*importInspector)
+			job := &importJob{ImportJob: &datapb.ImportJob{JobID: 1, State: state}}
+			preImport := &preImportTask{}
+			preImport.task.Store(&datapb.PreImportTask{JobID: 1, TaskID: 10, State: datapb.ImportTaskStateV2_Pending})
+			importing := &importTask{}
+			importing.task.Store(&datapb.ImportTaskV2{JobID: 1, TaskID: 20, State: datapb.ImportTaskStateV2_Pending})
+			importMeta.EXPECT().GetJobBy(mock.Anything).Return([]ImportJob{job}).Once()
+			importMeta.EXPECT().GetTaskByJob(mock.Anything, int64(1)).Return([]ImportTask{preImport, importing}).Once()
+			inspector.inspect()
+		})
+	}
+}
+
 func TestImportInspectorSchedulesV3PendingTasksWithoutJobGate(t *testing.T) {
 	ctx := context.Background()
 	importMeta := NewMockImportMeta(t)
```

**File**: `internal/datacoord/import_util.go` (modified, +6/-0)
```diff
@@ -1428,6 +1428,12 @@ func ValidateMaxImportJobExceed(ctx context.Context, importMeta ImportMeta) erro
 // Returns the maximum of the two constraints to ensure sufficient resources
 func CalculateTaskSlot(task ImportTask, importMeta ImportMeta) int {
 	job := importMeta.GetJob(context.TODO(), task.GetJobID())
+	if job == nil {
+		// The scheduler skips finalized tasks before calculating their slots.
+		// Keep this accessor safe for other callers holding an older snapshot,
+		// matching the V3 task accessors' minimum-slot fallback.
+		return 1
+	}
 
 	// Calculate CPU-based slots
 	fileNumPerSlot := paramtable.Get().DataCoordCfg.ImportFileNumPerSlot.GetAsInt()
```

**File**: `internal/datacoord/import_util_test.go` (modified, +10/-0)
```diff
@@ -56,6 +56,16 @@ import (
 	"github.com/milvus-io/milvus/pkg/v3/util/timerecord"
 )
 
+func TestCalculateTaskSlotMissingJob(t *testing.T) {
+	meta := &importMeta{jobs: map[int64]ImportJob{}}
+	pre := &preImportTask{importMeta: meta}
+	pre.task.Store(&datapb.PreImportTask{JobID: 1})
+	imp := &importTask{importMeta: meta}
+	imp.task.Store(&datapb.ImportTaskV2{JobID: 1})
+	require.EqualValues(t, 1, pre.GetTaskSlot())
+	require.EqualValues(t, 1, imp.GetTaskSlot())
+}
+
 func TestCalculateTaskSlotSnapshotBudgets(t *testing.T) {
 	paramtable.Init()
 	params := paramtable.Get()
```

**File**: `internal/datacoord/server.go` (modified, +1/-1)
```diff
@@ -377,7 +377,7 @@ func (s *Server) initDataCoord() (initErr error) {
 
 	s.initGarbageCollection(storageCli)
 
-	s.importChecker = NewImportChecker(s.ctx, s.meta, s.broker, s.allocator, s.importMeta, s.compactionInspector, s.handler, importCheckerHooks{
+	s.importChecker = NewImportChecker(s.ctx, s.meta, s.broker, s.allocator, s.importMeta, s.compactionInspector, s.handler, s.cluster2, s.globalScheduler, importCheckerHooks{
 		commitImport:        s.broadcastCommitImportMessage,
 		rollbackImport:      s.broadcastRollbackImportMessage,
 		assignImportIDRange: s.broadcastUpdateImportMessage,
```

**File**: `internal/datacoord/task/global_scheduler.go` (modified, +48/-1)
```diff
@@ -36,6 +36,10 @@ const NullNodeID = -1
 type GlobalScheduler interface {
 	Enqueue(task Task)
 	AbortAndRemoveTask(taskID int64)
+	// Finalize releases scheduler ownership and runs cleanup after in-flight
+	// callbacks finish. Cleanup must leave the task terminal before removing its
+	// metadata, so a previously submitted Create callback cannot dispatch it.
+	Finalize(taskID int64, cleanup func())
 	// GetPendingTaskCount returns the number of queued tasks of the given type.
 	// The queue is shared by every task type, so callers that gate admission for
 	// one kind of work must scope the count to that kind, otherwise an unrelated
@@ -113,6 +117,9 @@ func (s *globalTaskScheduler) taskInBackoff(task Task) bool {
 }
 
 func (s *globalTaskScheduler) Enqueue(task Task) {
+	s.mu.RLock(task.GetTaskID())
+	defer s.mu.RUnlock(task.GetTaskID())
+
 	if s.pendingTasks.Get(task.GetTaskID()) != nil {
 		return
 	}
@@ -149,6 +156,16 @@ func (s *globalTaskScheduler) AbortAndRemoveTask(taskID int64) {
 	s.backoffs.Remove(taskID)
 }
 
+func (s *globalTaskScheduler) Finalize(taskID int64, cleanup func()) {
+	s.mu.Lock(taskID)
+	defer s.mu.Unlock(taskID)
+
+	s.pendingTasks.Remove(taskID)
+	s.runningTasks.Remove(taskID)
+	s.backoffs.Remove(taskID)
+	cleanup()
+}
+
 func (s *globalTaskScheduler) Start() {
 	dur := paramtable.Get().DataCoordCfg.TaskScheduleInterval.GetAsDuration(time.Millisecond)
 	s.wg.Add(3)
@@ -278,19 +295,33 @@ func (s *globalTaskScheduler) schedule() {
 		if task == nil {
 			break
 		}
+		// Pop removes the task from the queue before it acquires this lock.
+		// Finalize may have completed in that window, so check the state before
+		// GetTaskSlot reads metadata that cleanup may already have removed.
+		taskID := task.GetTaskID()
+		s.mu.RLock(taskID)
+		switch task.GetTaskState() {
+		case taskcommon.None, taskcommon.Finished, taskcommon.Failed:
+			s.backoffs.Remove(taskID)
+			s.mu.RUnlock(taskID)
+			continue
+		}
 		// A task in failure backoff gives way: it re-enters the queue after
 		// this round and is dispatched once its delay elapses, so one
 		// persistently failing task cannot occupy the scheduler.
 		if s.taskInBackoff(task) {
 			delayed = append(delayed, task)
+			s.mu.RUnlock(taskID)
 			continue
 		}
 		taskSlot := task.GetTaskSlot()
 		nodeID := s.pickNode(slotHeap, taskSlot)
 		if nodeID == NullNodeID {
 			s.pendingTasks.Push(task)
+			s.mu.RUnlock(taskID)
 			break
 		}
+		s.mu.RUnlock(taskID)
 		future := s.execPool.Submit(func() (struct{}, error) {
 			s.mu.RLock(task.GetTaskID())
 			defer s.mu.RUnlock(task.GetTaskID())
@@ -327,7 +358,17 @@ func (s *globalTaskScheduler) schedule() {
 		futures = append(futures, future)
 	}
 	for _, task := range delayed {
-		s.pendingTasks.Push(task)
+		// Finalize can run while this task waits in delayed. Re-check under
+		// the same lock before putting it back, just like the no-slot path.
+		taskID := task.GetTaskID()
+		s.mu.RLock(taskID)
+		switch task.GetTaskState() {
+		case taskcommon.None, taskcommon.Finished, taskcommon.Failed:
+			s.backoffs.Remove(taskID)
+		default:
+			s.pendingTasks.Push(task)
+		}
+		s.mu.RUnlock(taskID)
 	}
 	_ = conc.AwaitAll(futures...)
 }
@@ -344,6 +385,12 @@ func (s *globalTaskScheduler) check() {
 		future := s.checkPool.Submit(func() (struct{}, error) {
 			s.mu.RLock(task.GetTaskID())
 			defer s.mu.RUnlock(task.GetTaskID())
+			// A captured task may have been finalized while this callback was
+			// waiting for a worker or the task lock. Its late query must not
+			// overwrite terminal metadata or put it back in the pending queue.
+			if current, ok := s.runningTasks.Get(task.GetTaskID()); !ok || current != task {
+				return struct{}{}, nil
+			}
 			task.QueryTaskOnWorker(s.cluster)
 			switch task.GetTaskState() {
 			case taskcommon.None:
```

---

### Incident Patch 3: `71b8073b` (2026-10-29)
**Commit Message**: fix: Keep unassignNode's etcd retry from being cut short by the caller (#54801)

issue: #54706
Related: #54733

Follow-up to #54733.

`ResourceManager.unassignNode` retries a transient etcd save error and
calls `mlog.Fatal` if the save still fails, while holding `rm.rwmutex`.
The retry ran on the caller's `ctx`. On the SuspendNode path
(`ops_services.go` → `HandleNodeDown`), that is the RPC request context.
If the client went away during the retry, `retry.Do` returned the last
etcd error and the process exited. mixcoord then lost its in-memory node
suspension, which is the outcome #54733 set out to remove, on the drain
operation of the original incident.

The retry and the save now run on `context.WithoutCancel(ctx)`, so the
caller can no longer decide whether the process dies. Each save keeps
the metastore's own request timeout (`etcdKV` and `txnTiKV` both wrap
every call in `WithTimeout`), so a request timeout still aborts, and the
retry is still bounded by `retry.Do`'s default attempts. Paths that
already passed `context.Background()` (the node watcher) are unchanged.

### Test

`TestResourceManager/TestUnassignSurvivesCallerCancel`: the caller
cancels while the first save fails

**File**: `internal/querycoordv2/meta/resource_manager.go` (modified, +7/-2)
```diff
@@ -1102,8 +1102,13 @@ func (rm *ResourceManager) unassignNode(ctx context.Context, node int64) (string
 		// restart) even if the failed attempt was applied. The retry is bounded
 		// because rm.rwmutex is held; a persistent failure still exits to reload
 		// a consistent state.
-		err := retry.Do(ctx, func() error {
-			return rm.catalog.SaveResourceGroup(ctx, rg.GetMeta())
+		//
+		// A failed save exits the process, so the caller (e.g. a SuspendNode RPC
+		// whose client went away) must not decide it by canceling ctx. Each save
+		// keeps the metastore's own request timeout, which still aborts.
+		saveCtx := context.WithoutCancel(ctx)
+		err := retry.Do(saveCtx, func() error {
+			return rm.catalog.SaveResourceGroup(saveCtx, rg.GetMeta())
 		}, retry.RetryErr(etcd.IsRetriableEtcdErr))
 		if err != nil {
 			mlog.Fatal(context.TODO(), "unassign node from resource group",
```

**File**: `internal/querycoordv2/meta/resource_manager_test.go` (modified, +36/-0)
```diff
@@ -722,6 +722,42 @@ func (suite *ResourceManagerSuite) TestUnassignRetriesTransientEtcdError() {
 	suite.Empty(suite.manager.GetResourceGroupByNodeID(1))
 }
 
+func (suite *ResourceManagerSuite) TestUnassignSurvivesCallerCancel() {
+	mockKV := mocks.NewMetaKv(suite.T())
+	mockKV.EXPECT().MultiSave(mock.Anything, mock.Anything).Return(nil)
+
+	store := querycoord.NewCatalog(mockKV)
+	suite.manager = NewResourceManager(store, session.NewNodeManager())
+
+	suite.manager.AlterResourceGroups(suite.ctx, map[string]*rgpb.ResourceGroupConfig{
+		"rg1": newResourceGroupConfig(20, 30),
+	})
+
+	suite.manager.nodeMgr.Add(session.NewNodeInfo(session.ImmutableNodeInfo{
+		NodeID:   1,
+		Address:  "localhost",
+		Hostname: "localhost",
+	}))
+	suite.manager.HandleNodeUp(suite.ctx, 1)
+	suite.Equal("rg1", suite.manager.GetResourceGroupByNodeID(1))
+
+	// A SuspendNode client goes away while the save hits a transient etcd
+	// error, wrapped the way etcdKV returns it.
+	ctx, cancel := context.WithCancel(suite.ctx)
+	defer cancel()
+	mockKV.EXPECT().MultiSave(mock.Anything, mock.Anything).Unset()
+	mockKV.EXPECT().MultiSave(mock.Anything, mock.Anything).RunAndReturn(func(context.Context, map[string]string) error {
+		cancel()
+		return merr.WrapErrIoFailedErr(rpctypes.ErrLeaderChanged, "execute etcd txn failed")
+	}).Once()
+	mockKV.EXPECT().MultiSave(mock.Anything, mock.Anything).Return(nil).Once()
+
+	suite.NotPanics(func() {
+		suite.manager.HandleNodeDown(ctx, 1)
+	})
+	suite.Empty(suite.manager.GetResourceGroupByNodeID(1))
+}
+
 func TestGetResourceGroupsJSON(t *testing.T) {
 	ctx := context.Background()
 	nodeManager := session.NewNodeManager()
```

#### Recent Merged Pull Requests:
- **PR #54881** (2026-10-30): fix: [3.0] retry worker cleanup during import task GC (@xiaofan-luan)
- **PR #54875** (2026-10-30): fix: make REST v1 test log directory creation race-safe (@zhikunyao)
- **PR #54867** (2026-10-30): fix: retry worker cleanup during import task GC (@xiaofan-luan)
- **PR #54856** (2026-10-30): fix: [3.0] Keep SegcoreError codes at the segcore C API boundary (@xiaofan-luan)
- **PR #54854** (2026-10-29): fix: Correct embedded UniDic loader name (@xiaofan-luan)
- **PR #54851** (2026-10-30): [automated] Bump milvus version to v3.0.5 (@sre-ci-robot)

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

## X. Bound Python E2E collection cleanup and report failures (#54349)

**RULE**:
When implementing operations in `tests/python_client/base/client_base.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in milvus-io/milvus. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `31c941f0`: Bound Python E2E collection cleanup and report failures (#54349). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `tests/python_client/base/client_base.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
import time
COLLECTION_CLEANUP_TIMEOUT = 120

    tear_down_collection_names = ()
        # TestCaseClassBase calls this once per class; ordinary cases call it
        # once per method. Keep the registry in the same scope as the wrappers.
        self.tear_down_collection_names = []
    def _cleanup_collections(self):
        deadline = time.monotonic() + COLLECTION_CLEANUP_TIMEOUT
        errors = []

        def cleanup_call(action, operation, *args, **kwargs):
            try:
                timeout = deadline - time.monotonic()
                if timeout <= 0:
                    raise TimeoutError("collection cleanup deadline exceeded")
                result, success = operation(*args, timeout=timeout, check_task=ct.CheckTasks.check_nothing, **kwargs)
                if not success:
                    raise AssertionError(str(result))
                if time.monotonic() >= deadline:
                    raise TimeoutError("collection cleanup deadline exceeded")
                return result
            except Exception as error:
                errors.append((action, error))
                log.exception(f"Collection cleanup failed: {action}")
                return None

 
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
    tear_down_collection_names = []
                    self.connection_wrap.connect(alias=DefaultConfig.DEFAULT_USING, ur
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `31c941f0` are properly handled with clean fallback behavior.
