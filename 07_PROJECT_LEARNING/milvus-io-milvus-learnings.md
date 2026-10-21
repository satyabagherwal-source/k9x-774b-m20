> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/milvus-io-milvus-learnings.md`  
> **Source**: github ([https://github.com/milvus-io/milvus](https://github.com/milvus-io/milvus))  
> **Source Version**: `a880185c`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-21T00:22:02.203Z  
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
> **Harvest Timestamp**: 2026-10-21T00:22:02.195Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `milvus-io/milvus`
- **Description**: Milvus is a high-performance, cloud-native vector database built for scalable vector ANN search
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 46450 stars

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
- **Issue #54465** (2026-10-20): **enhance: [3.0] convert ARRAY_CONTAINS terms only on cache miss**
  *Symptoms*: Indexed ARRAY_CONTAINS predicates rebuilt and deduplicated their query terms for every expression batch even though the index bitmap was already cached. Move that conversion into the cache-miss callback so later batches and expression-result cache hits reuse the bitmap without rebuilding the term list.  Backport #54052 using the 3.0 array-offset and Array access APIs. The 20,000-row BITMAP regression builds, serializes and reloads the index, forces three evaluation batches, and checks ContainsAny/ContainsAll results with duplicate query terms against brute force. The existing ARRAY_LENGTH regression remains intact.  pr: #54052 issue: #54051  Validation:  - Compiled the complete changed production and test translation units against 3.0 headers, then linked them with the real 3.0 native libraries for unchanged classes. No class layout changes are involved. - All seven ARRAY_CONTAINS regressions passed, including the new multi-batch case, empty terms, numeric casts and nested-index coverage. The existing cross-chunk ARRAY_LENGTH regression also passed. - Separate local instrumentation of the actual production TU verifies one term-list construction over three batches and zero conversions on an ExprResCache hit. Replacing it with the unchanged target baseline fails the count assertions (three reconstructions, including cache hits) while result checks still pass. The committed regression asserts row-result correctness; conversion counts are verified only in this local instrumented 
  **Post-Mortem & Fix Analysis**:
  > [INFO] PR Label Summary by Default [SUCCESS] PR #54052 merged to master - Title: enhance: convert ARRAY_CONTAINS terms only on an index-result cache miss - Link: https://github.com/milvus-io/milvus/pull/54052    Use /refresh-label to update related check and label manually
  > [ci-v2-notice] Notice: ci-v2 system is enabled for this PR (3.0 branch).  To rerun ci-v2 checks, comment with: - /ci-rerun-code-check-macos  // for Code Checker MacOS (GitHub Actions) - /ci-rerun-build-ut-cov  // for ci-v2/build-ut-cov (build + unit tests) - /ci-rerun-e2e-amd  // for ci-v2/e2e-amd (e2e tests) - /ci-rerun-e2e-amd-gray  // for ci-v2/e2e-amd-gray (TC pool shadow; non-gating) - /ci-rerun-e2e-dist-wp  // for ci-v2/e2e-dist-wp (Tencent distributed woodpecker-service boundary) - /ci-rerun-gosdk  // for ci-v2/go-sdk (Go SDK E2E tests) - /ci-rerun-gosdk-std  // for ci-v2/go-sdk-std (Go SDK E2E, standalone) - /ci-rerun-gosdk-dist-wp // for ci-v2/go-sdk-dist-wp (distributed + Woodpecker service)  If you have any questions or requests, please contact @zhikunyao. 

- **Issue #54464** (2026-10-20): **fix: [3.0] preserve omitted timestamptz fields in partial upserts**
  *Symptoms*: Partial upserts that omit a nullable or default-valued TIMESTAMPTZ field can panic or reject valid requests when new primary keys are present. The generated integer column replaces string-form query results during merging, leaving timestamps and validity entries out of alignment.  Keep omitted TIMESTAMPTZ placeholders in string form until insert validation converts the merged column to UTC microseconds and fills nulls/defaults. This backport uses the 3.0 proxy package and FieldData validity bitmap.  pr: #54087 issue: #54084  Validation: - 30 regression cases exercise production upsert preparation and insert validation with mocked query, allocator, and WAL dependencies. They cover nullable/default schemas, all-new and mixed PK batches, reversed PK ordering, null ordering, a non-UTC collection timezone, and RLS USING enabled/disabled; exact values and validity are asserted. - Target generation tests pass using `-tags dynamic,test -gcflags="all=-N -l" -count=1` and native libraries from a successful 3.0 CI build. - The identical regression tests fail on unchanged 3.0: 8 bounds panics and 22 timestamp-type rejections; all 30 pass after the fix. - Complete `internal/proxy/fieldvalidator`, `internal/proxy/dql`, and `internal/util/rlsutil` tests pass. - Independent Codex and Claude reviews converged after correcting the backport rationale; no code changes were needed. - A temporary tree combining this change with the independent #54088 backport passes all 30 timestamp and 288 nullab

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

### Incident Patch 1: `ac7e94e2` (2026-10-20)
**Commit Message**: fix: stop import from waiting forever (#54109)

issue: #54106, #54149, #54430

## What changed

### Oversized request (#54106)

`memoryAllocator.BlockingAllocate` waited for `usedMemory + size <=
limit`. When `size` is larger than the whole limit, this condition is
never true, even when `usedMemory` is 0. `cond.Wait()` wakes up only on
`Release`, so the task waited forever.

A request larger than the limit now waits only until no other task holds
memory (`usedMemory == 0`). Then it runs alone. A request within the
limit behaves as before.

### Cancellation (#54149)

`BlockingAllocate` took no context. `taskManager.Remove` cancels the
task context, but a worker parked in `cond.Wait()` did not see it. The
worker stayed parked until an unrelated task released memory, then
charged memory to the canceled task before it failed in `NewReader`.

`BlockingAllocate` now takes the task context and returns `ctx.Err()`
when the task is canceled while it waits. No memory is charged on that
path, so the worker has nothing to release. It reuses `waitForMemory`,
which already wakes waiters on cancellation for the snapshot path. The
oversized-request rule moves into `waitForMemory` as well. Both sna

**File**: `docs/agent_guides/streaming-system/coordination/broadcaster.md` (modified, +5/-0)
```diff
@@ -52,6 +52,11 @@ per-channel RPC or L0 materialization is required for these jobs. Absent/false
 flags retain legacy completion: BroadcastAckModule calls HandleCommitVchannel
 before Ack on each business VChannel, and the checker completes the job after
 all channel commits. The RPC is a no-op for new jobs when sent by old nodes.
+Both the RPC and the callback treat a job that importMeta no longer holds as
+already committed and garbage collected, except on a CDC secondary, where the
+replicated CommitImport can precede the local job and the caller keeps waiting.
+A secondary that already garbage collected the job waits forever. A GC tombstone
+(#54425) is the follow-up that closes this case.
 See [Import commit ownership](../../../design-docs/design_docs/wal/broadcast_ack_module.md#8-import-commit-ownership).
 
 ## Resource Key Locking
```

**File**: `docs/design-docs/design_docs/wal/broadcast_ack_module.md` (modified, +12/-0)
```diff
@@ -199,6 +199,18 @@ works when the original broadcast task is already TOMBSTONE. No WAL scan or
 rebroadcast by the checker is needed. RPC calls may repeat after a failure or
 restart; their effects are idempotent, not exactly-once calls.
 
+A replay can arrive after importChecker.checkGC removed the job. A job exists
+before any CommitImport for it is written, so on a cluster that is not a CDC
+secondary a missing job at commit time is a terminal job that GC removed: both
+HandleCommitVchannel and the CommitImport callback return success and leave
+metadata unchanged. On a CDC secondary the replicated CommitImport can precede
+the local Import ack callback, so a missing job there still returns a retriable
+error. When the replication role cannot be read yet, the error is retriable too.
+A secondary cannot tell a job that is not created yet from a job that its own
+checkGC removed, so a replay of a garbage-collected CommitImport on a secondary
+retries without end. A durable tombstone at GC time (see #54425) would close
+that case. It is follow-up work.
+
 This branch uses the existing segment-metadata serving path: MVCC already
 tracks CommitImport's WAL position, and QueryNode uses CommitTimestamp for
 import visibility and the delete replay boundary. DataView reconciliation from
```

**File**: `internal/datacoord/ddl_callbacks_import.go` (modified, +35/-0)
```diff
@@ -208,6 +208,34 @@ func (s *Server) getReplicationRole(ctx context.Context) (replicateutil.Role, bo
 	return helper.GetCurrentCluster().Role(), true, nil
 }
 
+// importJobForgotten reports whether a CommitImport for a job that importMeta
+// does not hold can be acknowledged as already applied.
+//
+// A job is created before any CommitImport for it exists: by ImportV2 on the
+// primary, or by the Import ack callback. So on a cluster that is not a CDC
+// secondary, a missing job at commit time is a job that reached a terminal
+// state and that importChecker.checkGC removed after the retention period. A
+// WAL replay of that CommitImport (StreamingNode restart with an old channel
+// checkpoint) has nothing left to commit, and waiting for the job to appear
+// would block forever.
+//
+// A secondary can receive the replicated CommitImport before its own Import
+// ack callback creates the job, so there the caller must keep waiting. An
+// unknown role (balancer not ready) is reported as an error, so the caller
+// retries instead of guessing.
+func (s *Server) importJobForgotten(ctx context.Context, jobID int64) (bool, error) {
+	role, _, err := s.getReplicationRole(ctx)
+	if err != nil {
+		return false, merr.Wrap(err, "cannot tell whether the import job can still be created")
+	}
+	if role == replicateutil.RoleSecondary {
+		return false, nil
+	}
+	mlog.Info(ctx, "CommitImport refers to a job that was completed and garbage collected, nothing to commit",
+		mlog.FieldJobID(jobID))
+	return true, nil
+}
+
 // jobIDFromDuplicatedBroadcast recovers the original import jobID from the broadcast
 // message the broadcaster returned on an idempotency hit. The broadcaster does not
 // know about import-specific structures, so the decode happens here.
@@ -429,6 +457,13 @@ func (c *DDLCallbacks) commitImportV2AckCallback(ctx context.Context, result mes
 
 	job := c.importMeta.GetJob(ctx, jobID)
 	if job == nil {
+		forgotten, err := c.importJobForgotten(ctx, jobID)
+		if err != nil {
+			return err
+		}
+		if forgotten {
+			return nil
+		}
 		mlog.Info(ctx, "CommitImport: job not found, retry later", mlog.FieldJobID(jobID))
 		return merr.WrapErrImportSysFailedMsg("job %d not found, waiting for import job creation", jobID)
 	}
```

**File**: `internal/datacoord/ddl_callbacks_import_test.go` (modified, +50/-1)
```diff
@@ -1356,10 +1356,59 @@ func TestCommitImportCallback_BeforeUncommitted_Retry(t *testing.T) {
 	assert.Equal(t, internalpb.ImportJobState_Importing, updatedJob.GetState())
 }
 
-func TestCommitImportCallback_MissingJob_Retry(t *testing.T) {
+// mockReplicateConfiguration makes getReplicationRole see cfg as the live
+// channel assignment for the rest of the test. nil means no replication.
+func mockReplicateConfiguration(t *testing.T, cfg *commonpb.ReplicateConfiguration) {
+	t.Helper()
+	mockBalancer := &mockBalancerImpl{}
+	mockBalance := mockey.Mock(balance.GetWithContext).To(func(ctx context.Context) (balancer.Balancer, error) {
+		return mockBalancer, nil
+	}).Build()
+	mockAssignment := mockey.Mock((*mockBalancerImpl).GetLatestChannelAssignment).To(
+		func(_ *mockBalancerImpl) (*channel.WatchChannelAssignmentsCallbackParam, error) {
+			return &channel.WatchChannelAssignmentsCallbackParam{ReplicateConfiguration: cfg}, nil
+		}).Build()
+	t.Cleanup(func() {
+		mockAssignment.UnPatch()
+		mockBalance.UnPatch()
+	})
+}
+
+// secondaryReplicateConfiguration returns a topology in which this cluster
+// is the CDC secondary of "primary-cluster".
+func secondaryReplicateConfiguration() *commonpb.ReplicateConfiguration {
+	current := Params.CommonCfg.ClusterPrefix.GetValue()
+	return &commonpb.ReplicateConfiguration{
+		Clusters: []*commonpb.MilvusCluster{
+			{ClusterId: "primary-cluster"},
+			{ClusterId: current},
+		},
+		CrossClusterTopology: []*commonpb.CrossClusterTopology{
+			{SourceClusterId: "primary-cluster", TargetClusterId: current},
+		},
+	}
+}
+
+func TestCommitImportCallback_MissingJob_PrimaryIsNoOp(t *testing.T) {
+	ctx := context.Background()
+	importMeta, _ := newTestImportMeta(t)
+	mockReplicateConfiguration(t, nil)
+
+	// A replayed CommitImport for a job that checkGC already removed must not
+	// keep the broadcast task alive: nothing can create that job again.
+	callbacks := &DDLCallbacks{Server: &Server{importMeta: importMeta}}
+	err := callbacks.commitImportV2AckCallback(ctx, buildCommitImportBroadcastResult(13))
+	assert.NoError(t, err)
+	assert.Nil(t, importMeta.GetJob(ctx, 13))
+}
+
+func TestCommitImportCallback_MissingJob_SecondaryRetries(t *testing.T) {
 	ctx := context.Background()
 	importMeta, _ := newTestImportMeta(t)
+	mockReplicateConfiguration(t, secondaryReplicateConfiguration())
 
+	// On a secondary the replicated CommitImport can arrive before the local
+	// Import ack callback creates the job, so the callback must wait.
 	callbacks := &DDLCallbacks{Server: &Server{importMeta: importMeta}}
 	err := callbacks.commitImportV2AckCallback(ctx, buildCommitImportBroadcastResult(13))
 	assert.Error(t, err)
```

**File**: `internal/datacoord/services.go` (modified, +9/-0)
```diff
@@ -3567,6 +3567,15 @@ func (s *Server) HandleCommitVchannel(ctx context.Context, req *datapb.HandleCom
 		return merr.Status(err), nil
 	}
 	job := s.importMeta.GetJob(ctx, req.GetJobId())
+	if job == nil {
+		forgotten, err := s.importJobForgotten(ctx, req.GetJobId())
+		if err != nil {
+			return merr.Status(err), nil
+		}
+		if forgotten {
+			return merr.Success(), nil
+		}
+	}
 	if job != nil && job.GetCommitByCoordinator() {
 		return merr.Success(), nil
 	}
```

**File**: `internal/datacoord/services_test.go` (modified, +29/-0)
```diff
@@ -6597,6 +6597,35 @@ func TestHandleCommitVchannelRPCIsNoOpForCoordinatorOwnedJob(t *testing.T) {
 	require.Error(t, merr.CheckRPCCall(resp, err))
 }
 
+func TestHandleCommitVchannelRPC_MissingJob_PrimaryIsNoOp(t *testing.T) {
+	importMeta, _ := newTestImportMeta(t)
+	mockReplicateConfiguration(t, nil)
+	server := &Server{importMeta: importMeta}
+	server.stateCode.Store(commonpb.StateCode_Healthy)
+
+	// A StreamingNode replaying an old CommitImport after checkGC removed the
+	// job must get success, or it retries forever and blocks the pchannel.
+	resp, err := server.HandleCommitVchannel(context.Background(), &datapb.HandleCommitVchannelRequest{
+		JobId: 13, Vchannel: "vchan-0", CommitTimestamp: 300,
+	})
+	require.NoError(t, merr.CheckRPCCall(resp, err))
+	require.Nil(t, importMeta.GetJob(context.Background(), 13))
+}
+
+func TestHandleCommitVchannelRPC_MissingJob_SecondaryRetries(t *testing.T) {
+	importMeta, _ := newTestImportMeta(t)
+	mockReplicateConfiguration(t, secondaryReplicateConfiguration())
+	server := &Server{importMeta: importMeta}
+	server.stateCode.Store(commonpb.StateCode_Healthy)
+
+	resp, err := server.HandleCommitVchannel(context.Background(), &datapb.HandleCommitVchannelRequest{
+		JobId: 13, Vchannel: "vchan-0", CommitTimestamp: 300,
+	})
+	err = merr.CheckRPCCall(resp, err)
+	require.Error(t, err)
+	require.True(t, errors.Is(err, merr.ErrImportSysFailed))
+}
+
 func TestLoadableProjectionUsesFinalSegments(t *testing.T) {
 	ctx := context.Background()
 	segments := NewSegmentsInfo(metacache.NewMetaStore(nil))
```

**File**: `internal/datanode/importv2/memory_allocator.go` (modified, +22/-20)
```diff
@@ -41,9 +41,10 @@ func GetMemoryAllocator() MemoryAllocator {
 
 // MemoryAllocator handles memory allocation and deallocation for import tasks
 type MemoryAllocator interface {
-	// BlockingAllocate blocks until memory is available and then allocates
-	// This method will block until memory becomes available
-	BlockingAllocate(taskID int64, size int64)
+	// BlockingAllocate blocks until memory is available and then allocates.
+	// It returns ctx.Err() when ctx is canceled before the allocation succeeds,
+	// in which case no memory is charged.
+	BlockingAllocate(ctx context.Context, taskID int64, size int64) error
 	// Allocate reserves snapshot row/delete budgets atomically and returns the
 	// admitted row buffer, shrinking it if needed to retain the full delete budget.
 	Allocate(ctx context.Context, taskID, preferredRowBuffer, deleteBudget int64) (int64, error)
@@ -74,32 +75,27 @@ func NewMemoryAllocator(systemTotalMemory int64) MemoryAllocator {
 	return ma
 }
 
-// BlockingAllocate blocks until memory is available and then allocates
-func (ma *memoryAllocator) BlockingAllocate(taskID int64, size int64) {
+// BlockingAllocate blocks until memory is available and then allocates.
+func (ma *memoryAllocator) BlockingAllocate(ctx context.Context, taskID int64, size int64) error {
 	ma.mutex.Lock()
 	defer ma.mutex.Unlock()
 
 	percentage := paramtable.Get().DataNodeCfg.ImportMemoryLimitPercentage.GetAsFloat()
 	memoryLimit := int64(float64(ma.systemTotalMemory) * percentage / 100.0)
 
-	// Wait until enough memory is available
-	for ma.usedMemory+size > memoryLimit {
-		mlog.Warn(context.TODO(), "task waiting for memory allocation...",
+	if err := ma.waitForMemory(ctx, taskID, size, memoryLimit); err != nil {
+		mlog.Warn(ctx, "task canceled while waiting for memory allocation",
 			mlog.FieldTaskID(taskID),
 			mlog.Int64("requestedSize", size),
-			mlog.Int64("usedMemory", ma.usedMemory),
-			mlog.Int64("availableMemory", memoryLimit-ma.usedMemory))
-
-		ma.cond.Wait()
+			mlog.Err(err))
+		return err
 	}
-
-	// Allocate memory
-	ma.usedMemory += size
-	mlog.Info(context.TODO(), "memory allocated successfully",
+	mlog.Info(ctx, "memory allocated successfully",
 		mlog.FieldTaskID(taskID),
 		mlog.Int64("allocatedSize", size),
 		mlog.Int64("usedMemory", ma.usedMemory),
 		mlog.Int64("availableMemory", memoryLimit-ma.usedMemory))
+	return nil
 }
 
 // Allocate reserves row and delete-map memory atomically for a typed snapshot
@@ -120,7 +116,7 @@ func (ma *memoryAllocator) Allocate(ctx context.Context, taskID, preferredRowBuf
 	// adding also avoids overflow for a very large preferred row buffer.
 	rowBuffer := min(preferredRowBuffer, limit-deleteBudget)
 	size := rowBuffer + deleteBudget
-	if err := ma.waitForMemory(ctx, size, limit); err != nil {
+	if err := ma.waitForMemory(ctx, taskID, size, limit); err != nil {
 		return 0, err
 	}
 	return rowBuffer, nil
@@ -138,15 +134,16 @@ func (ma *memoryAllocator) AllocateSnapshotTask(ctx context.Context, taskID, pre
 	rowBuffer := min(preferredRowBuffer, limit-2*deleteBudget)
 	admitted := min(int64(readers), (limit-deleteBudget)/(rowBuffer+deleteBudget))
 	size := deleteBudget + admitted*(rowBuffer+deleteBudget)
-	if err := ma.waitForMemory(ctx, size, limit); err != nil {
+	if err := ma.waitForMemory(ctx, taskID, size, limit); err != nil {
 		return 0, 0, err
 	}
 	return rowBuffer, int(admitted), nil
 }
 
 // Caller holds ma.mutex. Waiting acquires no partial reservation, and releasing
 // any existing reservation or canceling the context wakes the waiter.
-func (ma *memoryAllocator) waitForMemory(ctx context.Context, size, limit int64) error {
+// A request larger than the whole limit runs alone instead of waiting forever.
+func (ma *memoryAllocator) waitForMemory(ctx context.Context, taskID, size, limit int64) error {
 	// Acquiring the same lock in the callback prevents a lost wakeup between
 	// checking ctx.Err and Cond.Wait. Stop need not wait for the callback.
 	stop := context.AfterFunc(ctx, func() {
@@ -159,10 +156,15 @@ func (ma *memoryAllocator) waitForMemory(ctx context.Context, size, limit int64)
 		if err := ctx.Err(); err != nil {
 			return err
 		}
-		if size <= limit-ma.usedMemory {
+		if ma.usedMemory == 0 || size <= limit-ma.usedMemory {
 			ma.usedMemory += size
 			return nil
 		}
+		mlog.Warn(ctx, "task waiting for memory allocation...",
+			mlog.FieldTaskID(taskID),
+			mlog.Int64("requestedSize", size),
+			mlog.Int64("usedMemory", ma.usedMemory),
+			mlog.Int64("availableMemory", limit-ma.usedMemory))
 		ma.cond.Wait()
 	}
 }
```

**File**: `internal/datanode/importv2/memory_allocator_test.go` (modified, +108/-12)
```diff
@@ -113,7 +113,7 @@ func TestSnapshotTaskMemoryAdmission(t *testing.T) {
 		})
 	}
 	ma := NewMemoryAllocator(1024).(*memoryAllocator)
-	ma.BlockingAllocate(1, 512)
+	ma.BlockingAllocate(context.Background(), 1, 512)
 	ctx, cancel := context.WithCancel(context.Background())
 	done := make(chan error, 1)
 	go func() {
@@ -174,7 +174,7 @@ func TestSnapshotMemoryAdmission(t *testing.T) {
 
 	// A legacy reader occupies half the allowance. Snapshot readers must wait
 	// for their full reservation, not shrink to the currently free half.
-	ma.BlockingAllocate(1, 512)
+	ma.BlockingAllocate(context.Background(), 1, 512)
 	ctx, cancel = context.WithCancel(context.Background())
 	defer cancel()
 	done := make(chan error, 1)
@@ -265,11 +265,11 @@ func TestMemoryAllocatorBasicOperations(t *testing.T) {
 	assert.Equal(t, int64(0), ma.(*memoryAllocator).usedMemory)
 
 	// Test memory allocation for task 1 using BlockingAllocate
-	ma.BlockingAllocate(1, 50*1024*1024) // 50MB for task 1
+	ma.BlockingAllocate(context.Background(), 1, 50*1024*1024) // 50MB for task 1
 	assert.Equal(t, int64(50*1024*1024), ma.(*memoryAllocator).usedMemory)
 
 	// Test memory allocation for task 2
-	ma.BlockingAllocate(2, 50*1024*1024) // 50MB for task 2
+	ma.BlockingAllocate(context.Background(), 2, 50*1024*1024) // 50MB for task 2
 	assert.Equal(t, int64(100*1024*1024), ma.(*memoryAllocator).usedMemory)
 
 	// Test memory release for task 1
@@ -292,13 +292,13 @@ func TestMemoryAllocatorMemoryLimit(t *testing.T) {
 	testSize := memoryLimit / 10 // Use 10% of available memory
 
 	// Allocate memory up to the limit
-	ma.BlockingAllocate(1, testSize)
+	ma.BlockingAllocate(context.Background(), 1, testSize)
 	assert.Equal(t, testSize, ma.(*memoryAllocator).usedMemory)
 
 	// Try to allocate more memory than available (this will block, so we test in a goroutine)
 	done := make(chan bool)
 	go func() {
-		ma.BlockingAllocate(2, testSize)
+		ma.BlockingAllocate(context.Background(), 2, testSize)
 		done <- true
 	}()
 
@@ -324,7 +324,7 @@ func TestMemoryAllocatorConcurrentAccess(t *testing.T) {
 	for i := 0; i < 10; i++ {
 		taskID := int64(i + 1)
 		go func() {
-			ma.BlockingAllocate(taskID, 50*1024*1024) // 50MB each
+			ma.BlockingAllocate(context.Background(), taskID, 50*1024*1024) // 50MB each
 			ma.Release(taskID, 50*1024*1024)
 			done <- true
 		}()
@@ -346,7 +346,7 @@ func TestMemoryAllocatorNegativeRelease(t *testing.T) {
 	ma := NewMemoryAllocator(1024 * 1024 * 1024)
 
 	// Allocate some memory
-	ma.BlockingAllocate(1, 100*1024*1024) // 100MB
+	ma.BlockingAllocate(context.Background(), 1, 100*1024*1024) // 100MB
 	assert.Equal(t, int64(100*1024*1024), ma.(*memoryAllocator).usedMemory)
 
 	// Release more than allocated (should not go negative)
@@ -364,7 +364,7 @@ func TestMemoryAllocatorMultipleTasks(t *testing.T) {
 	sizes := []int64{20, 30, 25, 15, 35} // Total: 125MB
 
 	for i, taskID := range taskIDs {
-		ma.BlockingAllocate(taskID, sizes[i]*1024*1024)
+		ma.BlockingAllocate(context.Background(), taskID, sizes[i]*1024*1024)
 	}
 
 	// Verify total used memory
@@ -397,7 +397,7 @@ func TestMemoryAllocatorZeroSize(t *testing.T) {
 	ma := NewMemoryAllocator(1024 * 1024 * 1024)
 
 	// Test zero size allocation
-	ma.BlockingAllocate(1, 0)
+	ma.BlockingAllocate(context.Background(), 1, 0)
 	assert.Equal(t, int64(0), ma.(*memoryAllocator).usedMemory)
 
 	// Test zero size release
@@ -414,7 +414,7 @@ func TestMemoryAllocatorSimple(t *testing.T) {
 	assert.Equal(t, int64(0), ma.(*memoryAllocator).usedMemory)
 
 	// Test memory allocation
-	ma.BlockingAllocate(1, 50*1024*1024) // 50MB
+	ma.BlockingAllocate(context.Background(), 1, 50*1024*1024) // 50MB
 	assert.Equal(t, int64(50*1024*1024), ma.(*memoryAllocator).usedMemory)
 
 	// Test memory release
@@ -446,7 +446,7 @@ func TestMemoryAllocatorMassiveConcurrency(t *testing.T) {
 
 		go func(id int64, size int64) {
 			defer wg.Done()
-			ma.BlockingAllocate(id, size)
+			ma.BlockingAllocate(context.Background(), id, size)
 			time.Sleep(1 * time.Millisecond)
 			ma.Release(id, size)
 		}(taskID, memorySize)
@@ -457,3 +457,99 @@ func TestMemoryAllocatorMassiveConcurrency(t *testing.T) {
 	finalMemory := ma.(*memoryAllocator).usedMemory
 	assert.Equal(t, int64(0), finalMemory, "All memory should be released")
 }
+
+// TestMemoryAllocatorOversizedRequest tests that a request larger than the whole limit
+// runs alone instead of waiting forever.
+func TestMemoryAllocatorOversizedRequest(t *testing.T) {
+	ma := NewMemoryAllocator(1024 * 1024 * 1024)
+	memoryLimit := int64(float64(ma.(*memoryAllocator).systemTotalMemory) *
+		paramtable.Get().DataNodeCfg.ImportMemoryLimitPercentage.GetAsFloat() / 100.0)
+	oversized := memoryLimit * 2
+	small := memoryLimit / 10
+
+	allocateAsync := func(taskID int64, size int64) chan struct{} {
+		done := make(chan struct{})
+		go func() {
+			ma.BlockingAllocate(context.Background(), taskID, size)
+			close(done)
+		}()
+		return done
+	}
+
+	// The oversized requ
```

---

### Incident Patch 2: `281b9372` (2026-10-20)
**Commit Message**: fix: restore the DataCoord build after the metacache and Talon prewarm merges (#54462)

#54316 still enumerates `SegmentsInfo.segments` and builds test metadata
with `NewSegmentsInfo()`, both removed by #53579, so
`internal/datacoord` no longer compiles on master
(`manifest_supplier.go:42`). Enumerate segments with
`SegmentsInfo.GetSegments()` and build test metadata with
`newEmptyTestMeta()`. The prewarm startup test builds a bare `Server`,
which now reaches `importInspector.Reload` (added by #53334); stub it
like the test's other startup dependencies.

issue: #53875

Signed-off-by: sunby <[REDACTED_EMAIL]>

**File**: `internal/datacoord/manifest_supplier.go` (modified, +1/-1)
```diff
@@ -39,7 +39,7 @@ func (s *Server) GetPublishedManifestPaths(ctx context.Context) ([]string, error
 	s.meta.segMu.RLock()
 	defer s.meta.segMu.RUnlock()
 	manifests := make([]string, 0)
-	for _, segment := range s.meta.segments.segments {
+	for _, segment := range s.meta.segments.GetSegments() {
 		if err := ctx.Err(); err != nil {
 			return nil, err
 		}
```

**File**: `internal/datacoord/manifest_supplier_test.go` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ import (
 )
 
 func TestPublishedManifestSnapshot(t *testing.T) {
-	s := &Server{meta: &meta{segments: NewSegmentsInfo()}}
+	s := &Server{meta: newEmptyTestMeta()}
 	s.UpdateStateCode(commonpb.StateCode_Healthy)
 	fixtures := []*datapb.SegmentInfo{
 		{ID: 1, CollectionID: 10, State: commonpb.SegmentState_Flushed, Level: datapb.SegmentLevel_L1, ManifestPath: "collection10/v1"},
```

**File**: `internal/datacoord/talon_prewarm_test.go` (modified, +5/-2)
```diff
@@ -138,15 +138,18 @@ func TestTalonPrewarmUsesDataCoordConfiguration(t *testing.T) {
 
 func TestTalonPrewarmDataCoordStartAfterHealthy(t *testing.T) {
 	// Keep DC's state transition and prewarm loop real; suppress unrelated
-	// schedulers/service discovery and the process-level server-info file.
+	// schedulers, import recovery, service discovery and the process-level
+	// server-info file.
 	patchScheduler := mockey.Mock((*Server).startTaskScheduler).To(func(*Server) {}).Build()
 	defer patchScheduler.UnPatch()
+	patchImportReload := mockey.Mock((*importInspector).Reload).To(func(*importInspector) {}).Build()
+	defer patchImportReload.UnPatch()
 	patchLoops := mockey.Mock((*Server).startServerLoop).To(func(*Server) {}).Build()
 	defer patchLoops.UnPatch()
 	patchInfo := mockey.Mock(sessionutil.SaveServerInfo).To(func(string, int64) {}).Build()
 	defer patchInfo.UnPatch()
 
-	s := &Server{ctx: context.Background(), meta: &meta{segments: NewSegmentsInfo()}}
+	s := &Server{ctx: context.Background(), meta: newEmptyTestMeta(), importInspector: &importInspector{}}
 	s.UpdateStateCode(commonpb.StateCode_Initializing)
 	s.meta.segments.SetSegment(1, NewSegmentInfo(&datapb.SegmentInfo{
 		ID: 1, CollectionID: 10, State: commonpb.SegmentState_Flushed, ManifestPath: "unloaded/object",
```

#### Recent Merged Pull Requests:
- **PR #54465** (2026-10-20): enhance: [3.0] convert ARRAY_CONTAINS terms only on cache miss (@liliu-z)
- **PR #54464** (2026-10-20): fix: [3.0] preserve omitted timestamptz fields in partial upserts (@liliu-z)
- **PR #54463** (2026-10-20): fix: [3.0] release Rust token strings after word-level MinHash computation (@liliu-z)
- **PR #54462** (2026-10-20): fix: restore the DataCoord build after the metacache and Talon prewarm merges (@sunby)
- **PR #54461** (2026-10-20): fix: [3.0] upgrade otel, ebpf and runtime package recipes (@liliu-z)
- **PR #54459** (2026-10-20): enhance: [3.0] bound raw array reads during indexed equality checks (@liliu-z)

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

## X. stop import from waiting forever (#54109)

**RULE**:
When implementing operations in `docs/agent_guides/streaming-system/coordination/broadcaster.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in milvus-io/milvus. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `ac7e94e2`: stop import from waiting forever (#54109). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/agent_guides/streaming-system/coordination/broadcaster.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
Both the RPC and the callback treat a job that importMeta no longer holds as
already committed and garbage collected, except on a CDC secondary, where the
replicated CommitImport can precede the local job and the caller keeps waiting.
A secondary that already garbage collected the job waits forever. A GC tombstone
(#54425) is the follow-up that closes this case.
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `ac7e94e2` are properly handled with clean fallback behavior.
