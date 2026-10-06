# Forensic Learning Record (Deep Inspection): apache/incubator-pegasus

> **Canonical Artifact**: `07_PROJECT_LEARNING/apache-incubator-pegasus-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/apache/incubator-pegasus](https://github.com/apache/incubator-pegasus))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:25:06.977Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `apache/incubator-pegasus`
- **Description**: Apache Pegasus - A horizontally scalable, strongly consistent and high-performance key-value store
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2066 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `admin-cli/cmd/utils.go`
```
/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

package cmd

import "strings"

// filterStringWithPrefix returns strings with the same prefix.
// This function is commonly used for the auto-completion of commands.
func filterStringWithPrefix(strs []string, prefix string) []string {
	var result []string
	for _, s := range strs {
		if strings.HasPrefix(s, prefix) {
			result = append(result, s)
		}
	}
	return result
}

```

### Core Architecture Module: `admin-cli/util/common_utils.go`
```
/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

package util

import (
	"fmt"
	"reflect"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/apache/incubator-pegasus/go-client/idl/base"
)

func Str2Gpid(gpid string) (*base.Gpid, error) {
	splitResult := strings.Split(gpid, ".")
	if len(splitResult) < 2 {
		return &base.Gpid{}, fmt.Errorf("Invalid gpid format [%s]", gpid)
	}

	appID, err := strconv.ParseInt(splitResult[0], 10, 32)

	if err != nil {
		return &base.Gpid{}, fmt.Errorf("Invalid gpid format [%s]", gpid)
	}

	partitionID, err := strconv.ParseInt(splitResult[1], 10, 32)
	if err != nil {
		return &base.Gpid{}, fmt.Errorf("Invalid gpid format [%s]", gpid)
	}

	return &base.Gpid{Appid: int32(appID), PartitionIndex: int32(partitionID)}, nil
}

func SortStructsByField(structs []interface{}, key string) {
	sort.Slice(structs, func(i, j int) bool {
		v1 := reflect.ValueOf(structs[i]).FieldByName(key)
		v2 := reflect.ValueOf(structs[j]).FieldByName(key)

		if v1.Type().Name() == "string" {
			return strings.Compare(v1.String(), v2.String()) < 0
		}

		if v1.Type().Name() == "int" || v1.Type().Name() == "int64" {
			return v1.Int() < v2.Int()
		}

		if v1.Type().Name() == "float64" {
			return v1.Float() < v2.Float()
		}

		panic(fmt.Sprintf("Not support sort %s", v1.Type().Name()))

	})
}

func FormatDate(date int64) string {
	if date != 0 {
		return time.Unix(date, 0).Format("2006-01-02")
	}
	return "unknown"
}

```

### Core Architecture Module: `admin-cli/util/http_client.go`
```
/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

package util

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/go-resty/resty/v2"
)

type Arguments struct {
	Name  string
	Value string
}

type Result struct {
	Resp string
	Err  error
}

type HTTPRequestFunc func(addr string, args Arguments) (string, error)

func BatchCallHTTP(nodes []*PegasusNode, request HTTPRequestFunc, args Arguments) map[string]*Result {
	results := make(map[string]*Result)

	var mu sync.Mutex
	var wg sync.WaitGroup
	wg.Add(len(nodes))
	for _, n := range nodes {
		go func(node *PegasusNode) {
			_, cancel := context.WithTimeout(context.Background(), time.Second*10)
			defer cancel()
			result, err := request(node.TCPAddr(), args)
			mu.Lock()
			if err != nil {
				results[node.CombinedAddr()] = &Result{Err: err}
			} else {
				results[node.CombinedAddr()] = &Result{Resp: result}
			}
			mu.Unlock()
			wg.Done()
		}(n)
	}
	wg.Wait()

	return results
}

func CallHTTPGet(url string) (string, error) {
	resp, err := resty.New().SetTimeout(time.Second * 10).R().Get(url)
	if err != nil {
		return "", fmt.Errorf("failed to call \"%s\": %s", url, err)
	}
	if resp.StatusCode() != 200 {
		return "", fmt.Errorf("failed to call \"%s\": code=%d", url, resp.StatusCode())
	}
	return string(resp.Body()), nil
}

```

### Core Architecture Module: `admin-cli/util/pegasus_node.go`
```
/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

package util

import (
	"fmt"
	"net"
	"strings"
	"sync"

	"github.com/apache/incubator-pegasus/collector/aggregate"
	"github.com/apache/incubator-pegasus/go-client/idl/base"
	"github.com/apache/incubator-pegasus/go-client/session"
)

// PegasusNode is a representation of MetaServer and ReplicaServer.
// Compared to session.NodeSession, it extends with more detailed information.
type PegasusNode struct {
	// the session is nil by default, it will be initialized only when needed.
	session session.NodeSession

	IP net.IP

	Port int

	Hostname string

	Type session.NodeType
}

// TCPAddr returns the tcp address of the node
func (n *PegasusNode) TCPAddr() string {
	return fmt.Sprintf("%s:%d", n.IP.String(), n.Port)
}

// CombinedAddr returns a string combining with tcp address and hostname.
func (n *PegasusNode) CombinedAddr() string {
	return fmt.Sprintf("%s(%s)", n.Hostname, n.TCPAddr())
}

func (n *PegasusNode) String() string {
	return fmt.Sprintf("[%s]%s", n.Type, n.CombinedAddr())
}

// Replica returns a ReplicaSession if this node is a ReplicaServer.
// Will initialize the TCP connection.
func (n *PegasusNode) Replica() *session.ReplicaSession {
	if n.Type != session.NodeTypeReplica {
		panic(fmt.Sprintf("%s is not replica", n))
	}
	if n.session == nil {
		n.session = session.NewNodeSession(n.TCPAddr(), session.NodeTypeReplica)
	}
	return &session.ReplicaSession{NodeSession: n.session}
}

// Session returns a tcp session to the node.
// Will initialize the TCP connection.
func (n *PegasusNode) Session() session.NodeSession {
	if n.session == nil {
		n.session = session.NewNodeSession(n.TCPAddr(), session.NodeTypeReplica)
	}
	return n.session
}

func (n *PegasusNode) RPCAddress() *base.RPCAddress {
	return base.NewRPCAddress(n.IP, n.Port)
}

func (n *PegasusNode) Close() error {
	if n.session != nil {
		return n.session.Close()
	}
	return nil
}

// NewNodeFromTCPAddr creates a node from tcp address.
// NOTE:
//   - Will not initialize TCP connection unless needed.
//   - Should not be called too frequently because it costs 1 DNS resolution.
func NewNodeFromTCPAddr(addr string, ntype session.NodeType) *PegasusNode {
	tcpAddr, err := net.ResolveTCPAddr("tcp", addr)
	if err != nil {
		// the addr given is always trusted
		panic(err)
	}

	n := &PegasusNode{
		IP:   tcpAddr.IP,
		Port: tcpAddr.Port,
		Type: ntype,
	}
	n.resolveIP()
	return n
}

func (n *PegasusNode) resolveIP() {
	hostnames, err := net.LookupAddr(n.IP.String())
	if err != nil {
		n.Hostname = "unknown"
	} else {
		n.Hostname = strings.TrimSuffix(hostnames[0], ".")
	}
}

// PegasusNodeManager manages the sessions of all types of Pegasus node.
type PegasusNodeManager struct {
	// filled on initialization, won't be updated after that.
	MetaAddresses []string

	// a cache for nodes, to prevent unnecessary hostname resolving
	// in each PegasusNode creation.
	mu               sync.RWMutex
	replicaAddresses []string
	nodes            map[string]*PegasusNode
}

// NewPegasusNodeManager creates a PegasusNodeManager.
func NewPegasusNodeManager(metaAddrs []string, replicaAddrs []string) *PegasusNodeManager {
	m := &PegasusNodeManager{
		MetaAddresses:    metaAddrs,
		replicaAddresses: replicaAddrs,
		nodes:            make(map[string]*PegasusNode),
	}
	for _, addr := range metaAddrs {
		n := NewNodeFromTCPAddr(addr, session.NodeTypeMeta)
		m.nodes[n.TCPAddr()] = n
	}
	for _, addr := range replicaAddrs {
		n := NewNodeFromTCPAddr(addr, session.NodeTypeReplica)
		m.nodes[n.TCPAddr()] = n
	}
	return m
}

// MustGetReplica returns a replica node even if it doens't exist before.
// User should assure the validity of the given info.
func (m *PegasusNodeManager) MustGetReplica(addr string) *PegasusNode {
	n, err := m.GetNode(addr, session.NodeTypeReplica)
	if err != nil {
		n = NewNodeFromTCPAddr(addr, session.NodeTypeReplica)
		m.mu.Lock()
		m.nodes[addr] = n
		m.replicaAddresses = append(m.replicaAddresses, addr)
		m.mu.Unlock()
	}
	return n
}

// GetNode returns the specified node if it exists.
func (m *PegasusNodeManager) GetNode(addr string, ntype session.NodeType) (*PegasusNode, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if n, ok := m.nodes[addr]; ok { // node exists
		if n.Type != ntype {
			return nil, fmt.Errorf("node(%s) is not %s", n, ntype)
		}
		return n, nil
	}
	node, err := m.getNodeFromHost(addr, ntype)
	if err == nil {
		return node, nil
	}
	return nil, err
}

func (m *PegasusNodeManager) getNodeFromHost(hostPort string, ntype session.NodeType) (*PegasusNode, error) {
	for _, node := range m.nodes {
		if fmt.Sprintf("%s:%d", node.Hostname, node.Port) == hostPort {
			if node.Type != ntype {
				return nil, fmt.Errorf("node(%s) is not %s", node, ntype)
			}
			return node, nil
		}
	}

	return nil, fmt.Errorf("Invalid node %s", hostPort)
}

// GetAllNodes returns all nodes that matches the type. The result could be inconsistent
// with the latest cluster state. Please use MetaManager.ListNodes whenever possible.
func (m *PegasusNodeManager) GetAllNodes(ntype session.NodeType) []*PegasusNode {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var result []*PegasusNode
	for _, n := range m.nodes {
		if n.Type == ntype {
			result = append(result, n)
		}
	}
	return result
}

func (m *PegasusNodeManager) GetPerfSession(addr string, ntype session.NodeType) *aggregate.PerfSession {
	node, err := m.GetNode(addr, ntype)
	if err != nil {
		panic(fmt.Sprintf("Get PerfSession %s error %s", addr, err))
	}

	return aggregate.WrapPerf(addr, node.session)
}

func (m *PegasusNodeManager) CloseAllNodes() error {
	var errorStrings []string
	for _, n := range m.nodes {
		err := n.Close()
		if err != nil {
			errorStrings = append(errorStrings, err.Error())
		}
	}
	if len(errorStrings) != 0 {
		return fmt.Errorf("%s", strings.Join(errorStrings, "\n"))
	}
	return nil
}

```

### Core Architecture Module: `admin-cli/util/perf_counter.go`
```
/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

package util

import (
	"strings"

	"github.com/apache/incubator-pegasus/collector/aggregate"
)

func GetPartitionStat(perfSession *aggregate.PerfSession, counter string) map[string]float64 {
	// gpid->value
	partitionStats := make(map[string]float64)
	stats, err := perfSession.GetPerfCounters(counter)
	if err != nil {
		panic(err)
	}

	for _, stat := range stats {
		ret := strings.Split(stat.Name, "@")
		partitionStats[ret[1]] = stat.Value
	}
	return partitionStats
}

// GetNodeStats returns a mapping of [node address => node stats]
func GetNodeStats(perfClient *aggregate.PerfClient) (map[string]*aggregate.NodeStat, error) {
	var nodesStats = make(map[string]*aggregate.NodeStat)

	nodes, err := perfClient.GetNodeStats("replica")
	if err != nil {
		return nil, err
	}
	for _, node := range nodes {
		nodesStats[node.Addr] = &aggregate.NodeStat{
			Addr:  node.Addr,
			Stats: make(map[string]float64),
		}
	}
	for _, node := range nodes {
		for name, value := range node.Stats {
			name = getCounterName(name)
			nodesStats[node.Addr].Stats[name] += value
		}
	}
	return nodesStats, nil
}

func getCounterName(name string) string {
	ret := strings.Split(name, "@")
	if len(ret) != 0 {
		return ret[0]
	}
	return name
}

```

### Core Architecture Module: `collector/aggregate/hook.go`
```
// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

package aggregate

import "sync"

// HookAfterTableStatEmitted is a hook of event that new TableStats are generated.
// Each call of the hook handles a batch of tables.
type HookAfterTableStatEmitted func(stats []TableStats, allStats ClusterStats)

// AddHookAfterTableStatEmitted adds a hook of event that a new TableStats is generated.
func AddHookAfterTableStatEmitted(hk HookAfterTableStatEmitted) {
	m := &hooksManager
	m.lock.Lock()
	defer m.lock.Unlock()
	m.emittedHooks = append(m.emittedHooks, hk)
}

// HookAfterTableDropped is a hook of event that a table is dropped.
type HookAfterTableDropped func(appID int)

// AddHookAfterTableDropped adds a hook of event that a table is dropped.
func AddHookAfterTableDropped(hk HookAfterTableDropped) {
	m := &hooksManager
	m.lock.Lock()
	defer m.lock.Unlock()
	m.droppedHooks = append(m.droppedHooks, hk)
}

type tableStatsHooksManager struct {
	lock         sync.RWMutex
	emittedHooks []HookAfterTableStatEmitted
	droppedHooks []HookAfterTableDropped
}

func (m *tableStatsHooksManager) afterTableStatsEmitted(stats []TableStats, allStat ClusterStats) {
	m.lock.RLock()
	defer m.lock.RUnlock()

	for _, hook := range m.emittedHooks {
		hook(stats, allStat)
	}
}

func (m *tableStatsHooksManager) afterTableDropped(appID int32) {
	m.lock.RLock()
	defer m.lock.RUnlock()

	for _, hook := range m.droppedHooks {
		hook(int(appID))
	}
}

var hooksManager tableStatsHooksManager

```

### Core Architecture Module: `go-client/idl/utils/GoUnusedProtection__.go`
```
// Autogenerated by Thrift Compiler (0.13.0)
// DO NOT EDIT UNLESS YOU ARE SURE THAT YOU KNOW WHAT YOU ARE DOING

package utils

var GoUnusedProtection__ int

```

### Core Architecture Module: `go-client/idl/utils/utils-consts.go`
```
// Autogenerated by Thrift Compiler (0.13.0)
// DO NOT EDIT UNLESS YOU ARE SURE THAT YOU KNOW WHAT YOU ARE DOING

package utils

import (
	"bytes"
	"context"
	"fmt"
	"github.com/apache/thrift/lib/go/thrift"
	"reflect"
)

// (needed to ensure safety because of naive import list construction.)
var _ = thrift.ZERO
var _ = fmt.Printf
var _ = context.Background
var _ = reflect.DeepEqual
var _ = bytes.Equal

func init() {
}

```

### Core Architecture Module: `go-client/idl/utils/utils.go`
```
// Autogenerated by Thrift Compiler (0.13.0)
// DO NOT EDIT UNLESS YOU ARE SURE THAT YOU KNOW WHAT YOU ARE DOING

package utils

import (
	"bytes"
	"context"
	"database/sql/driver"
	"errors"
	"fmt"
	"github.com/apache/thrift/lib/go/thrift"
	"reflect"
)

// (needed to ensure safety because of naive import list construction.)
var _ = thrift.ZERO
var _ = fmt.Printf
var _ = context.Background
var _ = reflect.DeepEqual
var _ = bytes.Equal

type PatternMatchType int64

const (
	PatternMatchType_PMT_INVALID        PatternMatchType = 0
	PatternMatchType_PMT_MATCH_ALL      PatternMatchType = 1
	PatternMatchType_PMT_MATCH_EXACT    PatternMatchType = 2
	PatternMatchType_PMT_MATCH_ANYWHERE PatternMatchType = 3
	PatternMatchType_PMT_MATCH_PREFIX   PatternMatchType = 4
	PatternMatchType_PMT_MATCH_POSTFIX  PatternMatchType = 5
	PatternMatchType_PMT_MATCH_REGEX    PatternMatchType = 6
)

func (p PatternMatchType) String() string {
	switch p {
	case PatternMatchType_PMT_INVALID:
		return "PMT_INVALID"
	case PatternMatchType_PMT_MATCH_ALL:
		return "PMT_MATCH_ALL"
	case PatternMatchType_PMT_MATCH_EXACT:
		return "PMT_MATCH_EXACT"
	case PatternMatchType_PMT_MATCH_ANYWHERE:
		return "PMT_MATCH_ANYWHERE"
	case PatternMatchType_PMT_MATCH_PREFIX:
		return "PMT_MATCH_PREFIX"
	case PatternMatchType_PMT_MATCH_POSTFIX:
		return "PMT_MATCH_POSTFIX"
	case PatternMatchType_PMT_MATCH_REGEX:
		return "PMT_MATCH_REGEX"
	}
	return "<UNSET>"
}

func PatternMatchTypeFromString(s string) (PatternMatchType, error) {
	switch s {
	case "PMT_INVALID":
		return PatternMatchType_PMT_INVALID, nil
	case "PMT_MATCH_ALL":
		return PatternMatchType_PMT_MATCH_ALL, nil
	case "PMT_MATCH_EXACT":
		return PatternMatchType_PMT_MATCH_EXACT, nil
	case "PMT_MATCH_ANYWHERE":
		return PatternMatchType_PMT_MATCH_ANYWHERE, nil
	case "PMT_MATCH_PREFIX":
		return PatternMatchType_PMT_MATCH_PREFIX, nil
	case "PMT_MATCH_POSTFIX":
		return PatternMatchType_PMT_MATCH_POSTFIX, nil
	case "PMT_MATCH_REGEX":
		return PatternMatchType_PMT_MATCH_REGEX, nil
	}
	return PatternMatchType(0), fmt.Errorf("not a valid PatternMatchType string")
}

func PatternMatchTypePtr(v PatternMatchType) *PatternMatchType { return &v }

func (p PatternMatchType) MarshalText() ([]byte, error) {
	return []byte(p.String()), nil
}

func (p *PatternMatchType) UnmarshalText(text []byte) error {
	q, err := PatternMatchTypeFromString(string(text))
	if err != nil {
		return err
	}
	*p = q
	return nil
}

func (p *PatternMatchType) Scan(value interface{}) error {
	v, ok := value.(int64)
	if !ok {
		return errors.New("Scan value is not int64")
	}
	*p = PatternMatchType(v)
	return nil
}

func (p *PatternMatchType) Value() (driver.Value, error) {
	if p == nil {
		return nil, nil
	}
	return int64(*p), nil
}

type ChecksumType int64

const (
	ChecksumType_CST_INVALID ChecksumType = 0
	ChecksumType_CST_NONE    ChecksumType = 1
	ChecksumType_CST_MD5     ChecksumType = 2
)

func (p ChecksumType) String() string {
	switch p {
	case ChecksumType_CST_INVALID:
		return "CST_INVALID"
	case ChecksumType_CST_NONE:
		return "CST_NONE"
	case ChecksumType_CST_MD5:
		return "CST_MD5"
	}
	return "<UNSET>"
}

func ChecksumTypeFromString(s string) (ChecksumType, error) {
	switch s {
	case "CST_INVALID":
		return ChecksumType_CST_INVALID, nil
	case "CST_NONE":
		return ChecksumType_CST_NONE, nil
	case "CST_MD5":
		return ChecksumType_CST_MD5, nil
	}
	return ChecksumType(0), fmt.Errorf("not a valid ChecksumType string")
}

func ChecksumTypePtr(v ChecksumType) *ChecksumType { return &v }

func (p ChecksumType) MarshalText() ([]byte, error) {
	return []byte(p.String()), nil
}

func (p *ChecksumType) UnmarshalText(text []byte) error {
	q, err := ChecksumTypeFromString(string(text))
	if err != nil {
		return err
	}
	*p = q
	return nil
}

func (p *ChecksumType) Scan(value interface{}) error {
	v, ok := value.(int64)
	if !ok {
		return errors.New("Scan value is not int64")
	}
	*p = ChecksumType(v)
	return nil
}

func (p *ChecksumType) Value() (driver.Value, error) {
	if p == nil {
		return nil, nil
	}
	return int64(*p), nil
}

```

### Core Architecture Module: `go-client/pegasus/op/utils.go`
```
/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

package op

import (
	"encoding/binary"
	"fmt"
	"math"
	"time"

	"github.com/apache/incubator-pegasus/go-client/idl/base"
)

func validateHashKey(hashKey []byte) error {
	if hashKey == nil {
		return fmt.Errorf("InvalidParameter: hashkey must not be nil")
	}
	if len(hashKey) == 0 {
		return fmt.Errorf("InvalidParameter: hashkey must not be empty")
	}
	if len(hashKey) > math.MaxUint16 {
		return fmt.Errorf("InvalidParameter: length of hashkey (%d) must be less than %d", len(hashKey), math.MaxUint16)
	}
	return nil
}

func validateValue(value []byte) error {
	if value == nil {
		return fmt.Errorf("InvalidParameter: value must not be nil")
	}
	return nil
}

func validateValues(values [][]byte) error {
	if values == nil {
		return fmt.Errorf("InvalidParameter: values must not be nil")
	}
	if len(values) == 0 {
		return fmt.Errorf("InvalidParameter: values must not be empty")
	}
	for i, value := range values {
		if value == nil {
			return fmt.Errorf("InvalidParameter: values[%d] must not be nil", i)
		}
	}
	return nil
}

func validateSortKey(sortKey []byte) error {
	if sortKey == nil {
		return fmt.Errorf("InvalidParameter: sortkey must not be nil")
	}
	return nil
}

func validateSortKeys(sortKeys [][]byte) error {
	if sortKeys == nil {
		return fmt.Errorf("InvalidParameter: sortkeys must not be nil")
	}
	if len(sortKeys) == 0 {
		return fmt.Errorf("InvalidParameter: sortkeys must not be empty")
	}
	for i, sortKey := range sortKeys {
		if sortKey == nil {
			return fmt.Errorf("InvalidParameter: sortkeys[%d] must not be nil", i)
		}
	}
	return nil
}

func validateTTL(TTL time.Duration) error {
	if TTL < 0 {
		return fmt.Errorf("InvalidParameter: TTL[%d] must be greater than 0", TTL)
	}
	return nil
}

func encodeHashKeySortKey(hashKey []byte, sortKey []byte) *base.Blob {
	hashKeyLen := len(hashKey)
	sortKeyLen := len(sortKey)

	blob := &base.Blob{
		Data: make([]byte, 2+hashKeyLen+sortKeyLen),
	}

	binary.BigEndian.PutUint16(blob.Data, uint16(hashKeyLen))

	if hashKeyLen > 0 {
		copy(blob.Data[2:], hashKey)
	}

	if sortKeyLen > 0 {
		copy(blob.Data[2+hashKeyLen:], sortKey)
	}

	return blob
}

func expireTsSeconds(ttl time.Duration) int32 {
	if ttl == 0 {
		return 0
	}
	// 1451606400 means seconds since 2016.01.01-00:00:00 GMT
	return int32(ttl.Seconds()) + int32(time.Now().Unix()-1451606400)
}

type rpcResponse interface {
	GetError() int32
}

func wrapRPCFailure(resp rpcResponse, err error) error {
	if err != nil {
		return err
	}
	err = base.NewRocksDBErrFromInt(resp.GetError())
	if err != nil {
		return err
	}
	return nil
}

```

### Core Architecture Module: `go-client/pegasus/util.go`
```
/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

package pegasus

import (
	"encoding/binary"
	"hash/crc64"

	"github.com/apache/incubator-pegasus/go-client/idl/base"
)

func encodeHashKeySortKey(hashKey []byte, sortKey []byte) *base.Blob {
	hashKeyLen := len(hashKey)
	sortKeyLen := len(sortKey)

	blob := &base.Blob{
		Data: make([]byte, 2+hashKeyLen+sortKeyLen),
	}

	binary.BigEndian.PutUint16(blob.Data, uint16(hashKeyLen))

	if hashKeyLen > 0 {
		copy(blob.Data[2:], hashKey)
	}

	if sortKeyLen > 0 {
		copy(blob.Data[2+hashKeyLen:], sortKey)
	}

	return blob
}

func encodeNextBytesByKeys(hashKey []byte, sortKey []byte) *base.Blob {
	key := encodeHashKeySortKey(hashKey, sortKey)
	array := key.Data

	i := len(array) - 1
	for ; i >= 2; i-- {
		if array[i] != 0xFF {
			array[i]++
			break
		}
	}
	return &base.Blob{Data: array[:i+1]}
}

var crc64Table = crc64.MakeTable(0x9a6c9329ac4bc9b5)

func crc64Hash(data []byte) uint64 {
	return crc64.Checksum(data, crc64Table)
}

```

### Core Architecture Module: `go-client/rpc/utils.go`
```
/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

package rpc

import (
	"io"
	"net"
)

// IsNetworkTimeoutErr returns whether the given error is a timeout error.
func IsNetworkTimeoutErr(err error) bool {
	// if it's a network timeout error
	opErr, ok := err.(*net.OpError)
	if ok {
		return opErr.Timeout()
	}

	return false
}

// IsNetworkClosed returns whether the session is shutdown by the peer.
func IsNetworkClosed(err error) bool {
	opErr, ok := err.(*net.OpError)
	if ok {
		return opErr.Err == io.EOF
	}

	return err == io.EOF
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2402** (2026-05-26): **[backport] ci(github): fix branch glob to actually match release branches**
  *Symptoms*: ## Summary  Backport of #2401 to `v2.5`.  The branch filter `'v[0-9]+.*'` used in workflow files **never matches the `v2.5` branch**, because GitHub Actions branch filters use glob syntax (not regex):  - `+` is a **literal character**, not a quantifier - `[0-9]` matches **exactly one** digit, not "one or more"  As a result, PRs targeting `v2.5` silently skip every workflow that has this filter, while only those without `branches:` filters (e.g., the Golang/Labeler ones) actually run.  ## Evidence  **PR #2394** targets `v2.5` and modifies `src/replica/duplication/**` (C++ code):  - ✅ Triggered: `Golang Lint and Unit Test - admin-cli/pegic`, `Module Labeler` (no `branches` filter) - ❌ Did NOT trigger: `Cpp CI`, `Lint and Test - admin-cli` (cli proper), `Lint and Test - go-client`, etc.  Confirmed historically: ``` $ gh run list --repo apache/incubator-pegasus \     --workflow lint_and_test_cpp.yaml --branch v2.5 --limit 5 (empty — never run) ```  `Cpp CI` has **never run on the `v2.5` branch** since the workflow was added.  ## Fix  Replace `'v[0-9]+.*'` with `'v[0-9]*'`, which is valid GitHub Actions glob syntax and matches `v2.5`, `v2.5.1`, `v10.20`, etc. Applied uniformly to all 14 affected workflows on `v2.5` (mechanical sed replacement, one-line change per file).  ## Self-validating  This PR modifies `.github/workflows/lint_and_test_cpp.yaml`, which matches `Cpp CI`'s own `paths:` filter. Combined with the branch glob fix on `v2.5`, **this PR itself should be the first time
  **Post-Mortem & Fix Analysis**:
  > ## Closing — original diagnosis was wrong  After deeper investigation, the premise of this PR is incorrect:  **1. `v[0-9]+.*` actually does match `v2.5`.** GitHub Actions branch filters tolerate this glob shape and successfully match release branches like `v2.5`. PR #2394's `Cpp CI` workflow **was triggered** (run https://github.com/apache/incubator-pegasus/actions/runs/24079456724), it just doesn't show up in the PR Checks UI because of (2) below.  **2. The reason `Cpp CI` doesn't appear in PR #2394's Checks UI:** the workflow run ended in `conclusion: startup_failure` with an empty `jobs` array. When a run fails before any job is created, GitHub doesn't emit any `check_run`, so the PR's Checks UI has nothing to display.  **3. The actual root cause of `startup_failure`:** the **ASF GitHub Actions allow-list policy** (effective 2025-08-01, see [INFRA-27084](https://issues.apache.org/jira/browse/INFRA-27084)). On v2.5, workflows still reference unpinned third-party actions like `dorny/p

- **Issue #2401** (2026-05-26): **ci(github): fix branch glob to actually match release branches**
  *Symptoms*: ## Summary  The branch filter `'v[0-9]+.*'` used in 15 workflow files **never matches any release branch**, because GitHub Actions branch filters use glob syntax (not regex):  - `+` is a **literal character**, not a quantifier - `[0-9]` matches **exactly one** digit, not "one or more"  As a result, PRs targeting release branches like `v2.5` silently skip every workflow that has this filter, while only those without `branches:` filters (e.g., the Golang/Labeler ones) actually run.  ## Evidence  **PR #2394** targets `v2.5` and modifies `src/replica/duplication/**` (C++ code):  - ✅ Triggered: `Golang Lint and Unit Test - admin-cli/pegic`, `Module Labeler` (no `branches` filter) - ❌ Did NOT trigger: `Cpp CI`, `Lint and Test - admin-cli` (cli proper), `Lint and Test - go-client`, etc.  Confirmed historically: ``` $ gh run list --repo apache/incubator-pegasus \     --workflow lint_and_test_cpp.yaml --branch v2.5 --limit 5 (empty — never run) ```  `Cpp CI` has **never run on the v2.5 branch** since the workflow was added.  ## Fix  Replace `'v[0-9]+.*'` with `'v[0-9]*'`, which is valid GitHub Actions glob syntax and matches `v2.5`, `v2.5.1`, `v10.20`, etc.  Applied uniformly to all 15 affected workflows (mechanical sed replacement, one-line change per file).  ## Verification  - [x] All 18 workflow YAMLs parse successfully (`yaml.safe_load`) - [x] Diff is minimal: 15 files changed, +15/-15 - [ ] After merge: backport to active release branches (`v2.5`, etc.) so existing release-branch
  **Post-Mortem & Fix Analysis**:
  > ## Closing — original diagnosis was wrong  After deeper investigation, the premise of this PR is incorrect:  **1. `v[0-9]+.*` actually does match `v2.5`.** GitHub Actions branch filters tolerate this glob shape and successfully match release branches like `v2.5`. PR #2394's `Cpp CI` workflow **was triggered** (run https://github.com/apache/incubator-pegasus/actions/runs/24079456724), it just doesn't show up in the PR Checks UI because of (2) below.  **2. The reason `Cpp CI` doesn't appear in PR #2394's Checks UI:** the workflow run ended in `conclusion: startup_failure` with an empty `jobs` array. When a run fails before any job is created, GitHub doesn't emit any `check_run`, so the PR's Checks UI has nothing to display.  **3. The actual root cause of `startup_failure`:** the **ASF GitHub Actions allow-list policy** (effective 2025-08-01, see [INFRA-27084](https://issues.apache.org/jira/browse/INFRA-27084)). On v2.5, workflows still reference unpinned third-party actions like `dorny/p

- **Issue #2399** (2026-04-28): **block_service: fix 'occured' -> 'occurred' typos in ERR_FS_INTERNAL doc**
  *Symptoms*: Five inline comments in `src/block_service/block_service.h` (lines 75, 109, 174, 177, 206) documenting the `ERR_FS_INTERNAL` error used `an internal error occured`. Doc-only change.
  **Post-Mortem & Fix Analysis**:
  > Closing — typo-only PR. Multiple maintainers across the OSS ecosystem have flagged my recent typo-sweep PRs as AI-generated spam (notably hashicorp/nomad#27855, hashicorp/hcl#794, argo-cd reviewers). I should have caught this pattern sooner. Apologies for the noise.

- **Issue #2398** (2026-04-15): **ci(github): pin all actions to exact commit SHAs instead of tags or branch references**
  *Symptoms*: https://github.com/apache/incubator-pegasus/issues/2397  According to the the reply from INFRA team[1] and the doc of infrastructure actions[2], the actions in allow list must be pinned to a SHA rather than a tag as of August 1st, 2025.  1. https://issues.apache.org/jira/browse/INFRA-27084 2. https://github.com/apache/infrastructure-actions/?tab=readme-ov-file#adding-a-new-action-to-the-allow-list

- **Issue #2396** (2026-04-09): **feat(docker): support arm64 (#2081)**
  *Symptoms*: Resolve https://github.com/apache/incubator-pegasus/issues/2080.  ### What problem does this PR solve? <!--add issue link with summary if exists-->   ### What is changed and how does it work?   ### Checklist <!--REMOVE the items that are not applicable-->  ##### Tests <!-- At least one of them must be included. -->  - Unit test - Integration test - Manual test (add detailed scripts or steps below) - No code  ##### Code changes  - Has exported function/method change - Has exported variable/fields change - Has interface methods change - Has persistent data change  ##### Side effects  - Possible performance regression - Increased code complexity - Breaking backward compatibility  ##### Related changes  - Need to cherry-pick to the release branch - Need to update the documentation - Need to be included in the release note 

- **Issue #2393** (2026-04-14): **feat(new_metrics): support `server_stat` command showing some important server-level metrics (part 4)**
  *Symptoms*: https://github.com/apache/incubator-pegasus/issues/2382  Add metrics related to profiler RPC tasks as the 4th part to be shown by `server_stat` command.

- **Issue #2385** (2026-03-18): **feat(new_metrics): support `server_stat` command showing some important server-level metrics (part 3)**
  *Symptoms*: https://github.com/apache/incubator-pegasus/issues/2382  Add metrics related to the number of RocksDB as the 3rd part to be shown by `server_stat` command.

- **Issue #2377** (2026-03-18): **feat(replica): support querying replica status via RESTful API**
  *Symptoms*: Sometimes we need to know the current status of a replica. For example, during **offline partition split**, after new partitions are generated locally, we need to start the replica server to load the new partitions. Only after confirming that all partition data has been successfully loaded can we rebuild the metadata and recover the Pegasus cluster. However, there is currently no reliable way to verify that *all partition data has finished loading*.  There are two possible approaches:  1. **Check the replica server logs.**    For example, if we find `"load replica successfully"`, we assume the partition has been loaded successfully; if we find `"load replica failed"`, we assume the loading failed.    However, the problem is that log files are automatically cleaned up once their size or count exceeds certain thresholds. When there are a large number of partitions, the relevant logs might already be removed before we even start checking whether the partitions were loaded successfully.  2. **Wait for a fixed period of time.**    This approach is also impractical because we do not know when a partition starts loading or how long it will take to load. At the same time, we cannot wait indefinitely.  If we could directly know the current status of a replica — such as whether it is still loading or already serving — this problem would be much easier to solve. Therefore, this PR introduces a **RESTful API** to query the current status of a replica.  Since t

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

### Incident Patch 1: `db756dcd` (2026-03-13)
**Commit Message**: fix: avoid reopening GC-deleted plog during duplication (#2373)

Fix https://github.com/apache/incubator-pegasus/issues/2372.

Duplication replay may access private log files deleted by
concurrent GC. Track cleanable decree and stop scanning
plog files beyond GC boundary to prevent crash.

**File**: `src/replica/duplication/load_from_private_log.cpp` (modified, +22/-4)
```diff
@@ -156,17 +156,35 @@ void load_from_private_log::find_log_file_to_start()
     // Reopen the files. Because the internal file handle of `file_map`
     // is cleared once WAL replay finished. They are unable to read.
     mutation_log::log_file_map_by_index new_file_map;
-    for (const auto &pr : file_map) {
+
+    const decree cleanable_decree = _private_log->get_cleanable_decree();
+    const decree max_decree_gpid = _private_log->max_decree(get_gpid());
+
+    if (max_decree_gpid <= cleanable_decree) {
+        LOG_ERROR_PREFIX("max_decree_gpid({}) should be > cleanable_decree({}) for plog",
+                         max_decree_gpid,
+                         cleanable_decree);
+        return;
+    }
+
+    for (auto it = file_map.rbegin(); it != file_map.rend(); ++it) {
         log_file_ptr file;
-        error_s es = log_utils::open_read(pr.second->path(), file);
+        error_s es = log_utils::open_read(it->second->path(), file);
         if (!es.is_ok()) {
             LOG_ERROR_PREFIX("{}", es);
             return;
         }
-        new_file_map.emplace(pr.first, file);
+
+        new_file_map.emplace(it->first, file);
+
+        // If the max decree of a log file falls within `cleanable_decree`, the file may be deleted
+        // during the GC of plog files. Therefore, these files should be skipped here.
+        if (cleanable_decree >= file->previous_log_max_decree(get_gpid())) {
+            break;
+        }
     }
 
-    find_log_file_to_start(std::move(new_file_map));
+    find_log_file_to_start(new_file_map);
 }
 
 void load_from_private_log::find_log_file_to_start(
```

**File**: `src/replica/duplication/load_from_private_log.h` (modified, +1/-2)
```diff
@@ -82,9 +82,8 @@ class load_from_private_log final : public replica_base,
     static constexpr int MAX_ALLOWED_FILE_REPEATS{10};
 
 private:
-    void find_log_file_to_start(const mutation_log::log_file_map_by_index &log_files);
+    void find_log_file_to_start(const mutation_log::log_file_map_by_index &log_file_map);
 
-private:
     friend class load_from_private_log_test;
     friend class load_fail_mode_test;
     FRIEND_TEST(load_fail_mode_test, fail_skip);
```

**File**: `src/replica/mutation_log.cpp` (modified, +13/-0)
```diff
@@ -361,6 +361,7 @@ void mutation_log::init_states()
     _private_log_info = {0, 0};
     _plog_max_decree_on_disk = 0;
     _plog_max_commit_on_disk = 0;
+    _cleanable_decree = 0;
 }
 
 error_code mutation_log::open(replay_callback read_callback,
@@ -898,6 +899,18 @@ void mutation_log::update_max_commit_on_disk_no_lock(decree d)
     }
 }
 
+decree mutation_log::get_cleanable_decree() const
+{
+    zauto_lock l(_lock);
+    return _cleanable_decree;
+}
+
+void mutation_log::set_cleanable_decree(decree d)
+{
+    zauto_lock l(_lock);
+    _cleanable_decree = d;
+}
+
 bool mutation_log::get_learn_state(gpid gpid, decree start, /*out*/ learn_state &state) const
 {
     CHECK(_is_private, "this method is only valid for private logs");
```

**File**: `src/replica/mutation_log.h` (modified, +14/-3)
```diff
@@ -47,6 +47,7 @@
 #include "task/task_code.h"
 #include "task/task_tracker.h"
 #include "utils/autoref_ptr.h"
+#include "utils/ports.h"
 #include "utils/error_code.h"
 #include "utils/errors.h"
 #include "utils/zlocks.h"
@@ -301,6 +302,9 @@ class mutation_log : public ref_counter
 
     task_tracker *tracker() { return &_tracker; }
 
+    decree get_cleanable_decree() const;
+    void set_cleanable_decree(decree d);
+
 protected:
     // 'size' is data size to write; the '_global_end_offset' will be updated by 'size'.
     // can switch file only when create_new_log_if_needed = true;
@@ -400,9 +404,14 @@ class mutation_log : public ref_counter
     // for plog. Since it is set with mutation.data.header.last_committed_decree, it must
     // be less than _plog_max_decree_on_disk.
     decree _plog_max_commit_on_disk;
+
+    // The decree threshold for private log garbage collection. Mutations with decree <= this
+    // value are considered cleanable and their log files may be deleted by GC.
+    // Protected by _lock in get/set.
+    decree _cleanable_decree;
 };
 
-typedef dsn::ref_ptr<mutation_log> mutation_log_ptr;
+using mutation_log_ptr = dsn::ref_ptr<mutation_log>;
 
 class mutation_log_private : public mutation_log, private replica_base
 {
@@ -438,6 +447,9 @@ class mutation_log_private : public mutation_log, private replica_base
     void flush_once() override;
 
 private:
+    DISALLOW_COPY_AND_ASSIGN(mutation_log_private);
+    DISALLOW_MOVE_AND_ASSIGN(mutation_log_private);
+
     // async write pending mutations into log file
     // Preconditions:
     // - _pending_write != nullptr
@@ -457,9 +469,8 @@ class mutation_log_private : public mutation_log, private replica_base
     // if count <= 0, means flush until all data is on disk
     void flush_internal(int max_count);
 
-private:
     // bufferring - only one concurrent write is allowed
-    typedef std::vector<mutation_ptr> mutations;
+    using mutations = std::vector<mutation_ptr>;
     std::atomic_bool _is_writing;
     // Writes that are emitted to `commit_log_block` but are not completely written.
     // The weak_ptr used here is a trick. Once the pointer freed, ie.
```

**File**: `src/replica/replica_chkpt.cpp` (modified, +1/-0)
```diff
@@ -177,6 +177,7 @@ void replica::on_checkpoint_timer()
         }
     }
 
+    _private_log->set_cleanable_decree(cleanable_decree);
     tasking::enqueue(LPC_GARBAGE_COLLECT_LOGS_AND_REPLICAS,
                      &_tracker,
                      [this, plog, cleanable_decree, valid_start_offset] {
```

---

### Incident Patch 2: `02e3fa22` (2026-03-09)
**Commit Message**: fix(shell): change default value of checkpoint flag to false in duplication add command (#2365)

When the -p flag is not explicitly specified, checkpoint synchronization should be disabled by default.

**File**: `admin-cli/cmd/duplication.go` (modified, +1/-1)
```diff
@@ -53,7 +53,7 @@ func init() {
 		}),
 		Flags: func(f *grumble.Flags) {
 			f.String("c", "cluster", "", "the destination where the source data is duplicated")
-			f.Bool("p", "checkpoint", true, "whether to duplicate checkpoint when duplication created")
+			f.Bool("p", "checkpoint", false, "whether to duplicate checkpoint when duplication created")
 		},
 	})
 	rootCmd.AddCommand(&grumble.Command{
```

---

### Incident Patch 3: `cb40b233` (2026-03-05)
**Commit Message**: ci(github): bump hadolint/hadolint-action from 3.1.0 to 3.3.0 and fix Dockerfile and license issues reported by lint checks (#2331)

Resolve https://github.com/apache/incubator-pegasus/issues/2330.

Since `hadolint/hadolint-action@v3.1.0` is no longer in the allow list, Dockerfile
linting could not run. Therefore, `hadolint-action` needs to be pinned to the
commit SHA of version 3.3.0.

After `hadolint-action` has been successfully re-enabled, this PR fixes the
issues reported by lint in the Ubuntu 20.04 image Dockerfile as well as in the
license file.

**File**: `.github/workflows/standardization_lint.yaml` (modified, +1/-1)
```diff
@@ -55,7 +55,7 @@ jobs:
     runs-on: ubuntu-latest
     steps:
       - uses: actions/checkout@v4
-      - uses: hadolint/hadolint-action@v3.1.0
+      - uses: hadolint/hadolint-action@2332a7b74a6de0dda2e2221d575162eba76ba5e5
         with:
           recursive: true
           ignore: 'DL3033,DL3013,DL3059,SC2086,DL3003,SC2164,DL3008,DL3007,DL3006,DL4001,DL3041'
```

**File**: `.licenserc.yaml` (modified, +4/-1)
```diff
@@ -48,6 +48,7 @@ header:
     - 'go-client/idl/radmin/**'
     - 'go-client/idl/replication/**'
     - 'go-client/idl/rrdb/**'
+    - 'go-client/idl/utils/**'
     # Special files for nodejs.
     - '**/.npmigonre'
     # Special files for python.
@@ -68,12 +69,14 @@ header:
     - 'src/replica/duplication/test/log.1.0.handle_real_private_log2'
     - 'src/replica/duplication/test/log.1.0.all_loaded_are_write_empties'
     # Used for patches for thirdparties.
+    - 'thirdparty/fix_absl_build_on_macos_arm64.patch'
     - 'thirdparty/fix_hdfs_native_client.patch'
     - 'thirdparty/fix_jemalloc_for_m1_on_macos.patch'
     - 'thirdparty/fix_libevent_for_macos.patch'
     - 'thirdparty/fix_rocksdb-cmake-PORTABLE-option.patch'
-    - 'thirdparty/fix_snappy-Wsign-compare-warning.patch'
+    - 'thirdparty/fix_rocksdb-plugin-hdfs.patch'
     - 'thirdparty/fix_s2_build_with_absl_and_gtest.patch'
+    - 'thirdparty/fix_snappy-Wsign-compare-warning.patch'
     - 'thirdparty/fix_thrift_build_and_link_errors.patch'
     # TODO(yingchun): shell/* files are import from thirdparties, we can move them to thirdparty later.
     # Copyright (c) 2016, Adi Shavit
```

**File**: `docker/pegasus-build-env/ubuntu2004/Dockerfile` (modified, +11/-10)
```diff
@@ -70,16 +70,17 @@ RUN wget --progress=dot:giga https://archive.apache.org/dist/thrift/0.11.0/thrif
 ENV OPENSSL_VERSION="3.0.12"
 ENV OPENSSL_INSTALL_DIR="/usr/local/ssl"
 
-RUN wget https://www.openssl.org/source/openssl-$OPENSSL_VERSION.tar.gz -P /opt/openssl\
-    && cd /opt/openssl \ && tar -xzvf openssl-$OPENSSL_VERSION.tar.gz \
-    && cd openssl-$OPENSSL_VERSION \
-    && ./config shared --prefix=$OPENSSL_INSTALL_DIR \
-    && make -j$(nproc) \
-    && make install \
-    && ln -sf $OPENSSL_INSTALL_DIR/bin/openssl /usr/bin/openssl \
-    && ln -sf $OPENSSL_INSTALL_DIR/include/openssl /usr/local/include/openssl \
-    && echo "$OPENSSL_INSTALL_DIR/lib64" | tee /etc/ld.so.conf.d/openssl-3.0.conf \
-    && ldconfig -v
+RUN wget --progress=dot:giga https://www.openssl.org/source/openssl-${OPENSSL_VERSION}.tar.gz -P /opt/openssl && \
+    cd /opt/openssl && \
+    tar -xzvf "openssl-${OPENSSL_VERSION}.tar.gz" && \
+    cd "openssl-${OPENSSL_VERSION}" && \
+    ./config shared --prefix="${OPENSSL_INSTALL_DIR}" && \
+    make -j"$(nproc)" && \
+    make install && \
+    ln -sf "${OPENSSL_INSTALL_DIR}/bin/openssl" /usr/bin/openssl && \
+    ln -sf "${OPENSSL_INSTALL_DIR}/include/openssl" /usr/local/include/openssl && \
+    echo "${OPENSSL_INSTALL_DIR}/lib64" > /etc/ld.so.conf.d/openssl-3.0.conf && \
+    ldconfig -v
 
 ENV JAVA_HOME=/usr/lib/jvm/java-8-openjdk-amd64
 ENV CLASSPATH=$JAVA_HOME/lib/
```

---

### Incident Patch 4: `848ed89a` (2026-02-11)
**Commit Message**: fix(network): fix heartbeat failure caused by inability to obtain peer address when receiving UDP data (#2364)

Fix https://github.com/apache/incubator-pegasus/issues/2363.

The root cause is that when starting onebox with `--use_product_config`, both replica
servers and meta servers use [src/server/config.ini](https://github.com/apache/incubator-pegasus/blob/a9a11da886bd32d170fc166c08b69210d89d6a52/src/server/config.ini)
instead of [src/server/config.min.ini](https://github.com/apache/incubator-pegasus/blob/a9a11da886bd32d170fc166c08b69210d89d6a52/src/server/config.min.ini).
As a result, beacons are sent and received over **UDP** instead of **TCP**.

The UDP implementation uses Boost.Asio APIs. If the sender socket does not call `connect()`,
then calling `remote_endpoint()` on the receiver socket will always fail.

The fix is to remove the logic that calls `remote_endpoint()` on the receiving side. This logic
was introduced in https://github.com/apache/incubator-pegasus/pull/1658 to handle cross-network
scenarios (when the address in the message header differs from the actual socket connection
address, the non-forwarding path corrects it to a recognizable address). Since UDP is pr

**File**: `src/rpc/asio_net_provider.cpp` (modified, +0/-30)
```diff
@@ -348,19 +348,6 @@ void asio_udp_provider::do_receive()
                 return;
             }
 
-            // Get the remote endpoint of the socket.
-            boost::system::error_code ec;
-            auto remote = _socket->remote_endpoint(ec);
-            if (ec) {
-                LOG_ERROR("failed to get the remote endpoint: {}", ec.message());
-                do_receive();
-                return;
-            }
-
-            auto ip = remote.address().to_v4().to_ulong();
-            auto port = remote.port();
-            const auto &remote_addr = ::dsn::rpc_address(ip, port);
-
             auto hdr_format = message_parser::get_header_type(_recv_reader._buffer.data());
             if (NET_HDR_INVALID == hdr_format) {
                 LOG_ERROR("{}: asio udp read failed: invalid header type '{}'",
@@ -384,23 +371,6 @@ void asio_udp_provider::do_receive()
                 return;
             }
 
-            if (msg->header->from_address != remote_addr) {
-                if (!msg->header->context.u.is_forwarded) {
-                    msg->header->from_address = remote_addr;
-                    LOG_DEBUG("{}: message's from_address {} is not equal to socket's remote_addr "
-                              "{}, assign it to remote_addr.",
-                              _address,
-                              msg->header->from_address,
-                              remote_addr);
-                } else {
-                    LOG_DEBUG("{}: message's from_address {} is not equal to socket's remote_addr "
-                              "{}, but it's forwarded message, ignore it!.",
-                              _address,
-                              msg->header->from_address,
-                              remote_addr);
-                }
-            }
-
             msg->to_address = _address;
             msg->to_host_port = _hp;
             if (msg->header->context.u.is_request) {
```

---

### Incident Patch 5: `817a18d2` (2026-02-11)
**Commit Message**: feat(rocksdb): support building RocksDB with the HDFS plugin in the Pegasus server (#2362)

https://github.com/apache/incubator-pegasus/issues/2361

Enable building RocksDB with HDFS plugin through the following steps:
1. Introduce [rocksdb-hdfs-env](https://github.com/riversand963/rocksdb-hdfs-env)
plugin when building RocksDB as a third-party dependency.
2. Configure Java and Hadoop environment variables, as well as the dynamic library
search paths, to support compiling and linking the plugin.
3. Apply patches to fix issues encountered during compilation.

**File**: `.github/actions/rebuild_thirdparty_if_needed/action.yaml` (modified, +6/-3)
```diff
@@ -37,15 +37,18 @@ runs:
       # Build third-parties and leave some necessary libraries and source.
       run: |
         rm -f /root/thirdparties-src.zip
+        ../admin_tools/download_hadoop.sh hadoop-bin
+        rm -rf hadoop-bin/share/doc
+        mv hadoop-bin ..
+        # The RocksDB HDFS plugin (rocksdb-hdfs-env) in thirdparty relies on ${HADOOP_HOME}
+        # environment variable to locate the libraries to link against.
+        export HADOOP_HOME="$(dirname "$(pwd)")"/hadoop-bin
         mkdir build
         cmake -DCMAKE_BUILD_TYPE=Release -DROCKSDB_PORTABLE=1 -DUSE_JEMALLOC=${USE_JEMALLOC} -DENABLE_ASAN=${ENABLE_ASAN} -B build/
         cmake --build build/ -j $(nproc)
         rm -rf build/Build build/Download/[a-y]* build/Source/[a-g]* build/Source/[i-q]* build/Source/[s-z]*
         find ./ -name '*CMakeFiles*' -type d -exec rm -rf "{}" +
-        ../admin_tools/download_hadoop.sh hadoop-bin
         ../admin_tools/download_zk.sh zookeeper-bin
-        rm -rf hadoop-bin/share/doc
         rm -rf zookeeper-bin/docs
-        mv hadoop-bin ..
         mv zookeeper-bin ..
       shell: bash
```

**File**: `cmake_modules/BaseFunctions.cmake` (modified, +37/-4)
```diff
@@ -325,6 +325,42 @@ function(dsn_setup_include_path)#TODO(huangwei5): remove this
   include_directories(${THIRDPARTY_INSTALL_DIR}/include)
 endfunction(dsn_setup_include_path)
 
+function(dsn_setup_java_libs)
+  if (NOT DEFINED ARCH_TYPE)
+    message(FATAL_ERROR "ARCH_TYPE is not defined. Please configure with -DARCH_TYPE=...")
+  endif()
+
+  if (NOT DEFINED JAVA_HOME)
+    message(FATAL_ERROR "JAVA_HOME is not defined. Please configure with -DJAVA_HOME=...")
+  endif()
+
+  if (NOT EXISTS "${JAVA_HOME}")
+    message(FATAL_ERROR "JAVA_HOME does not exist: ${JAVA_HOME}")
+  endif()
+
+  message(STATUS "JAVA_HOME = ${JAVA_HOME}")
+
+  if (APPLE)
+    if (NOT EXISTS "${JAVA_HOME}/lib/server/libjvm.dylib"
+        AND NOT EXISTS "${JAVA_HOME}/jre/lib/server/libjvm.dylib")
+      message(FATAL_ERROR "libjvm.dylib not found under JAVA_HOME: ${JAVA_HOME}")
+    endif()
+  else()
+    if (NOT EXISTS "${JAVA_HOME}/lib/server/libjvm.so"
+        AND NOT EXISTS "${JAVA_HOME}/jre/lib/${ARCH_TYPE}/server/libjvm.so")
+      message(FATAL_ERROR "libjvm.so not found under JAVA_HOME: ${JAVA_HOME}")
+    endif()
+  endif()
+
+  # Provide directories to be searched for JVM libraries such as libjvm.so, libjava.so
+  # and libverify.so.
+  #
+  # Currently these directories are used by the RocksDB HDFS plugin (rocksdb-hdfs-env)
+  # in thirdparty to be searched while linking against JVM libraries for JNI.
+  link_directories(${JAVA_HOME}/jre/lib/${ARCH_TYPE}/server)
+  link_directories(${JAVA_HOME}/jre/lib/${ARCH_TYPE})
+endfunction(dsn_setup_java_libs)
+
 function(dsn_setup_thirdparty_libs)
   set(BOOST_ROOT ${THIRDPARTY_INSTALL_DIR})
   set(Boost_USE_MULTITHREADED ON)
@@ -360,10 +396,7 @@ function(dsn_setup_thirdparty_libs)
   endif()
   find_package(RocksDB REQUIRED)
 
-  # libhdfs
-  find_package(JNI REQUIRED)
-  message (STATUS "JAVA_JVM_LIBRARY=${JAVA_JVM_LIBRARY}")
-  link_libraries(${JAVA_JVM_LIBRARY})
+  dsn_setup_java_libs()
 
   find_package(OpenSSL REQUIRED)
   include_directories(${OPENSSL_INCLUDE_DIR})
```

**File**: `run.sh` (modified, +13/-0)
```diff
@@ -276,6 +276,17 @@ function run_build()
     echo "Build start time: `date`"
     start_time=`date +%s`
 
+    case "$(uname)" in
+        Darwin)
+            echo "Currently, macOS does not support ${ROOT}/admin_tools/config_hdfs.sh"
+            ;;
+        *)
+            # The RocksDB HDFS plugin (rocksdb-hdfs-env) in thirdparty relies on ${HADOOP_HOME}
+            # environment variable to locate the libraries to link against.
+            source "${ROOT}"/admin_tools/config_hdfs.sh
+            ;;
+    esac
+
     if [[ ${SKIP_THIRDPARTY} == "YES" ]]; then
         echo "Skip building third-parties..."
     else
@@ -301,6 +312,8 @@ function run_build()
     fi
 
     CMAKE_OPTIONS="${CMAKE_OPTIONS}
+                   -DARCH_TYPE=${ARCH_TYPE}
+                   -DJAVA_HOME=${JAVA_HOME}
                    -DENABLE_GCOV=${ENABLE_GCOV}
                    -DENABLE_GPERF=${ENABLE_GPERF}
                    -DBoost_NO_BOOST_CMAKE=ON
```

**File**: `thirdparty/CMakeLists.txt` (modified, +4/-1)
```diff
@@ -502,7 +502,7 @@ set(ROCKSDB_OPTIONS
 if (NOT APPLE)
     set(ROCKSDB_OPTIONS
             ${ROCKSDB_OPTIONS}
-            -DROCKSDB_PLUGINS=encfs)
+            "-DROCKSDB_PLUGINS=encfs hdfs")
 endif ()
 ExternalProject_Add(rocksdb
         URL ${OSS_URL_PREFIX}/rocksdb-v8.5.3.tar.gz
@@ -511,6 +511,9 @@ ExternalProject_Add(rocksdb
         PATCH_COMMAND patch -p1 < ${TP_DIR}/fix_rocksdb-cmake-PORTABLE-option.patch
         COMMAND rm -rf ${TP_DIR}/build/Source/rocksdb/plugin/encfs
         COMMAND git clone -b main --depth=1 https://github.com/pegasus-kv/encfs.git ${TP_DIR}/build/Source/rocksdb/plugin/encfs
+        COMMAND rm -rf ${TP_DIR}/build/Source/rocksdb/plugin/hdfs
+        COMMAND git clone -b master --depth=1 https://github.com/riversand963/rocksdb-hdfs-env.git ${TP_DIR}/build/Source/rocksdb/plugin/hdfs
+        COMMAND cd ${TP_DIR}/build/Source/rocksdb/plugin/hdfs && patch -p1 < ${TP_DIR}/fix_rocksdb-plugin-hdfs.patch
         DEPENDS googletest jemalloc lz4 snappy zstd
         CMAKE_ARGS ${ROCKSDB_OPTIONS}
         DOWNLOAD_EXTRACT_TIMESTAMP true
```

**File**: `thirdparty/fix_rocksdb-plugin-hdfs.patch` (added, +33/-0)
```diff
@@ -0,0 +1,33 @@
+diff --git a/CMakeLists.txt b/CMakeLists.txt
+index c660747..5fef10e 100644
+--- a/CMakeLists.txt
++++ b/CMakeLists.txt
+@@ -5,6 +5,7 @@ cmake_minimum_required(VERSION 3.4)
+ # Windows is not supported.
+ 
+ set(hdfs_SOURCES "env_hdfs.cc" "env_hdfs_impl.cc" PARENT_SCOPE)
++set(hdfs_HEADERS "env_hdfs.h" PARENT_SCOPE)
+ set(hdfs_LIBS "hdfs" "dl" "verify" "java" "jvm" PARENT_SCOPE)
+ set(hdfs_INCLUDE_PATHS "$ENV{JAVA_HOME}/include" "$ENV{JAVA_HOME}/include/linux" "$ENV{HADOOP_HOME}/include" PARENT_SCOPE)
+ set(hdfs_LINK_PATHS "$ENV{JAVA_HOME}/jre/lib/amd64/server" "$ENV{JAVA_HOME}/jre/lib/amd64" "$ENV{HADOOP_HOME}/lib/native" PARENT_SCOPE)
+diff --git a/env_hdfs_impl.cc b/env_hdfs_impl.cc
+index 01574bc..3927e5d 100644
+--- a/env_hdfs_impl.cc
++++ b/env_hdfs_impl.cc
+@@ -14,6 +14,7 @@
+ #include <iostream>
+ #include <sstream>
+ #include "logging/logging.h"
++#include "port/sys_time.h"
+ #include "rocksdb/status.h"
+ #include "util/string_util.h"
+ 
+@@ -524,7 +525,7 @@ IOStatus HdfsFileSystem::FileExists(const std::string& fname,
+     default:  // anything else should be an error
+       ROCKS_LOG_FATAL(mylog, "FileExists hdfsExists call failed");
+       return IOStatus::IOError("hdfsExists call failed with error " +
+-                               ROCKSDB_NAMESPACE::ToString(value) + " on path " + fname + ".\n");
++                               std::to_string(value) + " on path " + fname + ".\n");
+   }
+ }
+ 
```

---

### Incident Patch 6: `23f58920` (2026-01-27)
**Commit Message**: fix: fix binary_writer::write not supporting C-style strings (#2349)

Fix https://github.com/apache/incubator-pegasus/issues/2355.

The `mutation_log_test.replay_single_file_1000` test was crashing because, in the `mutation_log_test::create_test_mutation` function (see the code below), the default
template function `template <typename T> void binary_writer::write(const T &val)` was
invoked instead of one of the non-template `binary_writer::write` overloads.

https://github.com/apache/incubator-pegasus/blob/58b83260ec31530c4316e1cedceeb84731b66e95/src/replica/test/mutation_log_test.cpp#L294-L315

The default template implementation contains only a single line: `assert(false);` (also shown below).

https://github.com/apache/incubator-pegasus/blob/58b83260ec31530c4316e1cedceeb84731b66e95/src/utils/binary_writer.h#L53-L58

This explains why the issue occurs only in tests built in **debug** mode and not in **release** mode, as described
in the issue: in release builds, `assert` is disabled and therefore does nothing.

The fix is to remove the default template function and introduce a `void binary_writer::write(std::string_view val)` overload instead. In addition to fixing the issue, thi

**File**: `src/utils/binary_writer.cpp` (modified, +73/-92)
```diff
@@ -26,6 +26,7 @@
 
 #include "binary_writer.h"
 
+#include <algorithm>
 #include <memory>
 
 #include "utils.h"
@@ -48,16 +49,6 @@ binary_writer::binary_writer(int reserved_buffer_size)
     _buffers.reserve(1);
 }
 
-binary_writer::binary_writer(blob &buffer)
-    : _buffers({buffer}),
-      _current_buffer(const_cast<char *>(buffer.data())),
-      _current_offset(0),
-      _current_buffer_length(static_cast<int>(buffer.length())),
-      _total_size(0),
-      _reserved_size_per_buffer(kReservedSizePerBuffer)
-{
-}
-
 void binary_writer::flush() { commit(); }
 
 void binary_writer::create_buffer(size_t size)
@@ -68,23 +59,26 @@ void binary_writer::create_buffer(size_t size)
     create_new_buffer(size, bb);
     _buffers.push_back(bb);
 
-    _current_buffer = (char *)bb.data();
-    _current_buffer_length = bb.length();
+    _current_buffer = const_cast<char *>(bb.data());
+    _current_buffer_length = static_cast<int>(bb.length());
 }
 
 void binary_writer::create_new_buffer(size_t size, /*out*/ blob &bb)
 {
-    bb.assign(::dsn::utils::make_shared_array<char>(size), 0, (int)size);
+    bb.assign(utils::make_shared_array<char>(size), 0, size);
 }
 
 void binary_writer::commit()
 {
-    if (_current_offset > 0) {
-        *_buffers.rbegin() = _buffers.rbegin()->range(0, _current_offset);
-
-        _current_offset = 0;
-        _current_buffer_length = 0;
+    if (_current_offset <= 0) {
+        return;
     }
+
+    // Commit the last buffer.
+    *_buffers.rbegin() = _buffers.rbegin()->range(0, _current_offset);
+
+    _current_offset = 0;
+    _current_buffer_length = 0;
 }
 
 blob binary_writer::get_buffer()
@@ -99,108 +93,95 @@ blob binary_writer::get_buffer()
         return {};
     }
 
-    std::shared_ptr<char> bptr(utils::make_shared_array<char>(_total_size));
-    blob bb(bptr, _total_size);
-    char *ptr = const_cast<char *>(bb.data());
+    blob bb(utils::make_shared_array<char>(_total_size), _total_size);
+    auto *ptr = const_cast<char *>(bb.data());
 
     for (const auto &buf : _buffers) {
-        memcpy(ptr, buf.data(), buf.length());
+        std::memcpy(ptr, buf.data(), buf.length());
         ptr += buf.length();
     }
 
     return bb;
 }
 
-blob binary_writer::get_current_buffer()
+blob binary_writer::get_current_buffer() const
 {
     if (_buffers.size() == 1) {
         return _current_offset > 0 ? _buffers[0].range(0, _current_offset) : _buffers[0];
-    } else {
-        std::shared_ptr<char> bptr(::dsn::utils::make_shared_array<char>(_total_size));
-        blob bb(bptr, _total_size);
-        const char *ptr = bb.data();
-
-        for (int i = 0; i < static_cast<int>(_buffers.size()); i++) {
-            size_t len = (size_t)_buffers[i].length();
-            if (_current_offset > 0 && i + 1 == (int)_buffers.size()) {
-                len = _current_offset;
-            }
-
-            memcpy((void *)ptr, (const void *)_buffers[i].data(), len);
-            ptr += _buffers[i].length();
-        }
+    }
+
+    blob bb(utils::make_shared_array<char>(_total_size), _total_size);
+    if (_buffers.empty()) {
+        // TODO(wangdan): just return a default-initialized blob object?
         return bb;
     }
-}
 
-void binary_writer::write_empty(int sz)
-{
-    int sz0 = sz;
-    int rem_size = _current_buffer_length - _current_offset;
-    if (rem_size >= sz) {
-        _current_offset += sz;
-    } else {
-        _current_offset += rem_size;
-        sz -= rem_size;
+    auto *ptr = const_cast<char *>(bb.data());
+    int i = 0;
 
-        int allocSize = _reserved_size_per_buffer;
-        if (sz > allocSize)
-            allocSize = sz;
+    // Now the size of _buffers is at least 2.
+    for (; i < static_cast<int>(_buffers.size()) - 1; ++i) {
+        std::memcpy(ptr, _buffers[i].data(), _buffers[i].length());
+        ptr += _buffers[i].length();
+    }
 
-        create_buffer(allocSize);
-        _current_offset += sz;
+    // Get bytes from the last buffer(namely current buffer).
+    if (_current_offset > 0) {
+        std::memcpy(ptr, _buffers[i].data(), _current_offset);
+    } else {
+        std::memcpy(ptr, _buffers[i].data(), _buffers[i].length());
     }
 
-    _total_size += sz0;
+    return bb;
 }
 
-void binary_writer::write(const char *buffer, int sz)
+void binary_writer::write_empty(int size)
 {
-    int rem_size = _current_buffer_length - _current_offset;
-    if (rem_size >= sz) {
-        memcpy((void *)(_current_buffer + _current_offset), buffer, (size_t)sz);
-        _current_offset += sz;
-        _total_size += sz;
-    } else {
-        if (rem_size > 0) {
-            memcpy((void *)(_current_buffer + _current_offset), buffer, (size_t)rem_size);
-            _current_offset += rem_size;
-            _total_size += rem_size;
-            sz -= rem_size;
-        }
-
-        int allocSize = _reserved_size_per_buffer;
-        if (sz > allocSize)
-            allocSize = sz;
-
-        create_buffer(allocSize);
-        memcpy((void *)(_cu
```

**File**: `src/utils/binary_writer.h` (modified, +51/-48)
```diff
@@ -26,14 +26,12 @@
 
 #pragma once
 
-#include <assert.h>
-#include <stdint.h>
-#include <algorithm>
+#include <cstdint>
 #include <cstring>
-#include <string>
+#include <string_view>
 #include <vector>
 
-#include "blob.h"
+#include "utils/blob.h"
 #include "utils/ports.h"
 
 namespace dsn {
@@ -43,19 +41,16 @@ class binary_writer
 public:
     binary_writer();
     explicit binary_writer(int reserved_buffer_size);
-    explicit binary_writer(blob &buffer);
+
     virtual ~binary_writer() = default;
 
     virtual void flush();
 
-    template <typename T>
-    void write_pod(const T &val);
-    template <typename T>
-    void write(const T &val)
-    {
-        // write of this type is not implemented
-        assert(false);
-    }
+    // Write data of POD types into the buffers.
+    template <typename TVal>
+    void write_pod(const TVal &val);
+
+    // Write data of built-in types into the buffers.
     void write(const int8_t &val) { write_pod(val); }
     void write(const uint8_t &val) { write_pod(val); }
     void write(const int16_t &val) { write_pod(val); }
@@ -66,31 +61,46 @@ class binary_writer
     void write(const uint64_t &val) { write_pod(val); }
     void write(const bool &val) { write_pod(val); }
 
-    void write(const std::string &val);
-    void write(const char *buffer, int sz);
+    // Write bytes in string_view into the buffers.
+    void write(std::string_view val);
+
+    // Write bytes in blob into the buffers.
     void write(const blob &val);
-    void write_empty(int sz);
 
-    bool next(void **data, int *size);
-    bool backup(int count);
+    // Write `size` bytes from `buffer` into the buffers.
+    void write(const char *buffer, int size);
+
+    // Just increase the buffers by `size` bytes without writing any data into it.
+    void write_empty(int size);
 
-    void get_buffers(/*out*/ std::vector<blob> &buffers);
-    int get_buffer_count() const { return static_cast<int>(_buffers.size()); }
+    // Commit the current buffer and return a blob filled with all bytes over all buffers.
     blob get_buffer();
-    blob get_current_buffer(); // without commit, write can be continued on the last buffer
-    blob get_first_buffer() const;
 
-    int total_size() const { return _total_size; }
+    // Return a blob filled with all bytes over all buffers without committing the current
+    // buffer and thus future written bytes will continue to be put into the current buffer.
+    [[nodiscard]] blob get_current_buffer() const;
+
+    // Get the total size in bytes over all buffers.
+    [[nodiscard]] int total_size() const { return _total_size; }
 
 protected:
-    // bb may have large space than size
+    // Commit the current buffer and create a new buffer of at least `size` bytes.
     void create_buffer(size_t size);
-    void commit();
+
+    // Allocate space of at least `size` bytes for a new buffer into `bb`.
     virtual void create_new_buffer(size_t size, /*out*/ blob &bb);
 
+    // Commit the current buffer.
+    void commit();
+
 private:
+    // Write data of bytes-like types into buffers.
+    template <typename TBytes>
+    void write_bytes(const TBytes &val);
+
     std::vector<blob> _buffers;
 
+    // The current buffer is just the last buffer of `_buffers`.
     char *_current_buffer;
     int _current_offset;
     int _current_buffer_length;
@@ -104,34 +114,27 @@ class binary_writer
 };
 
 //--------------- inline implementation -------------------
-template <typename T>
-inline void binary_writer::write_pod(const T &val)
+template <typename TVal>
+inline void binary_writer::write_pod(const TVal &val)
 {
-    write((char *)&val, static_cast<int>(sizeof(T)));
+    write(reinterpret_cast<const char *>(&val), static_cast<int>(sizeof(val)));
 }
 
-inline void binary_writer::get_buffers(/*out*/ std::vector<blob> &buffers)
+template <typename TBytes>
+inline void binary_writer::write_bytes(const TBytes &val)
 {
-    commit();
-    buffers = _buffers;
+    // Write the length of `val` into the buffers.
+    const auto len = static_cast<int>(val.length());
+    write_pod(len);
+
+    // Write `val` into the buffers if it's not empty.
+    if (len > 0) {
+        write(val.data(), len);
+    }
 }
 
-inline blob binary_writer::get_first_buffer() const { return _buffers[0]; }
+inline void binary_writer::write(std::string_view val) { write_bytes(val); }
 
-inline void binary_writer::write(const std::string &val)
-{
-    int len = static_cast<int>(val.length());
-    write((const char *)&len, sizeof(int));
-    if (len > 0)
-        write((const char *)&val[0], len);
-}
+inline void binary_writer::write(const blob &val) { write_bytes(val); }
 
-inline void binary_writer::write(const blob &val)
-{
-    // TODO: optimization by not memcpy
-    int len = val.length();
-    write((const char *)&len, sizeof(int));
-    if (len > 0)
-        write((const char *)val.data(), len);
-}
 } // namespace dsn
```

---

### Incident Patch 7: `255189f3` (2026-01-12)
**Commit Message**: build(images): build third-party images for ASan tests (#2347)

https://github.com/apache/incubator-pegasus/issues/2344.

As is described in https://github.com/apache/incubator-pegasus/pull/2341,
this PR is to build third-party images with ASan enabled, which are dedicated
to ASan tests.

**File**: `.github/workflows/build-push-thirdparty.yml` (modified, +30/-0)
```diff
@@ -154,6 +154,36 @@ jobs:
             HADOOP_BIN_PATH=hadoop-bin
             ZOOKEEPER_BIN_PATH=zookeeper-bin
 
+  build_push_bin_test_asan_docker_images:
+    runs-on: ubuntu-latest
+    needs: build_push_src_docker_images
+    steps:
+      - uses: actions/checkout@v4
+      - name: Set up QEMU
+        uses: docker/setup-qemu-action@v1
+      - name: Set up Docker Buildx
+        uses: docker/setup-buildx-action@v1
+      - name: Login to DockerHub
+        uses: docker/login-action@v1
+        with:
+          username: ${{ secrets.DOCKERHUB_USER }}
+          password: ${{ secrets.DOCKERHUB_TOKEN }}
+      - name: Build and push for test asan
+        uses: docker/build-push-action@v2.10.0
+        with:
+          context: .
+          file: ./docker/thirdparties-bin/Dockerfile
+          push: true
+          tags: |
+            apache/pegasus:thirdparties-bin-test-asan-${{ inputs.osversion }}-${{ github.ref_name }}
+          build-args: |
+            GITHUB_BRANCH=${{ github.ref_name }}
+            OS_VERSION=${{ inputs.osversion }}
+            ROCKSDB_PORTABLE=1
+            ENABLE_ASAN=ON
+            HADOOP_BIN_PATH=hadoop-bin
+            ZOOKEEPER_BIN_PATH=zookeeper-bin
+
   build_push_bin_test_jemalloc_docker_images:
     runs-on: ubuntu-latest
     needs: build_push_src_docker_images
```

**File**: `docker/thirdparties-bin/Dockerfile` (modified, +2/-1)
```diff
@@ -28,12 +28,13 @@ ARG GITHUB_BRANCH
 ARG GITHUB_REPOSITORY_URL=https://github.com/apache/incubator-pegasus.git
 ARG ROCKSDB_PORTABLE=native
 ARG USE_JEMALLOC=OFF
+ARG ENABLE_ASAN=OFF
 ARG HADOOP_BIN_PATH=hadoop-bin
 ARG ZOOKEEPER_BIN_PATH=zookeeper-bin
 RUN git clone --depth=1 --branch=${GITHUB_BRANCH} ${GITHUB_REPOSITORY_URL} \
     && cd incubator-pegasus/thirdparty \
     && unzip /root/thirdparties-src.zip -d . \
-    && cmake -DCMAKE_BUILD_TYPE=Release -DROCKSDB_PORTABLE=${ROCKSDB_PORTABLE} -DUSE_JEMALLOC=${USE_JEMALLOC} -B build/ . \
+    && cmake -DCMAKE_BUILD_TYPE=Release -DROCKSDB_PORTABLE=${ROCKSDB_PORTABLE} -DUSE_JEMALLOC=${USE_JEMALLOC} -DENABLE_ASAN=${ENABLE_ASAN} -B build/ . \
     && cmake --build build/ -j $(($(nproc)/2+1)) \
     && ../admin_tools/download_hadoop.sh ${HADOOP_BIN_PATH} \
     && ../admin_tools/download_zk.sh ${ZOOKEEPER_BIN_PATH} \
```

---

### Incident Patch 8: `b507fd36` (2026-01-09)
**Commit Message**: fix(test): fix the failed ASan test for gutil due to absl::node_hash_map (#2341)

https://github.com/apache/incubator-pegasus/issues/2344.

The internal types used by `absl::node_hash_map` have different layouts when
compiled with ASan versus non-ASan builds. As a third-party dependency, Abseil
is always built in non-ASan mode. However, when Pegasus is built with ASan enabled,
Abseil headers are also compiled under ASan, which leads to a mismatch between the
header-compiled structures and the Abseil library itself, causing ASAN tests to fail.

Possible solutions include:
1. When third-party dependencies change, also build those third-party libraries with
ASan enabled for ASan builds.
2. When building third-party images, additionally produce a separate ASan-based
image, which can be used by ASan CI workflows when third-party dependencies
themselves have not changed.

**File**: `.github/actions/rebuild_thirdparty_if_needed/action.yaml` (modified, +1/-1)
```diff
@@ -38,7 +38,7 @@ runs:
       run: |
         rm -f /root/thirdparties-src.zip
         mkdir build
-        cmake -DCMAKE_BUILD_TYPE=Release -DROCKSDB_PORTABLE=1 -DUSE_JEMALLOC=${USE_JEMALLOC} -B build/
+        cmake -DCMAKE_BUILD_TYPE=Release -DROCKSDB_PORTABLE=1 -DUSE_JEMALLOC=${USE_JEMALLOC} -DENABLE_ASAN=${ENABLE_ASAN} -B build/
         cmake --build build/ -j $(nproc)
         rm -rf build/Build build/Download/[a-y]* build/Source/[a-g]* build/Source/[i-q]* build/Source/[s-z]*
         find ./ -name '*CMakeFiles*' -type d -exec rm -rf "{}" +
```

**File**: `.github/workflows/lint_and_test_cpp.yaml` (modified, +10/-4)
```diff
@@ -60,6 +60,9 @@ jobs:
   cpp_clang_tidy_linter:
     name: Tidy
     runs-on: ubuntu-22.04
+    env:
+      USE_JEMALLOC: OFF
+      ENABLE_ASAN: OFF
     container:
       image: apache/pegasus:thirdparties-bin-ubuntu2204-${{ github.base_ref }}
     steps:
@@ -86,6 +89,7 @@ jobs:
     runs-on: ubuntu-latest
     env:
       USE_JEMALLOC: OFF
+      ENABLE_ASAN: OFF
     container:
       image: apache/pegasus:thirdparties-bin-ubuntu2204-${{ github.base_ref }}
     steps:
@@ -115,6 +119,7 @@ jobs:
     runs-on: ubuntu-latest
     env:
       USE_JEMALLOC: OFF
+      ENABLE_ASAN: OFF
       ARTIFACT_NAME: release
       BUILD_OPTIONS: -t release --test
     container:
@@ -204,6 +209,7 @@ jobs:
     runs-on: ubuntu-latest
     env:
       USE_JEMALLOC: OFF
+      ENABLE_ASAN: ON
       ARTIFACT_NAME: release_address
       BUILD_OPTIONS: --sanitizer address --disable_gperf --test
     container:
@@ -259,10 +265,7 @@ jobs:
           - dsn_task_tests
           - dsn_utils_tests
           - dsn.zookeeper.tests
-          # TODO(wangdan): absl::node_hash_map will fail when ASan tests run because some objects
-          # have different structures between non-ASan and ASan building. Will be enabled after
-          # this issue is fixed.
-          # - gutil_test
+          - gutil_test
           # TODO(yingchun): Disable it because we find it's too flaky, we will re-enable it after
           # it has been optimized.
           # - partition_split_test
@@ -300,6 +303,7 @@ jobs:
 #    runs-on: ubuntu-latest
 #    env:
 #      USE_JEMALLOC: OFF
+#      ENABLE_ASAN: OFF
 #      ARTIFACT_NAME: release_undefined
 #      BUILD_OPTIONS: --sanitizer undefined --disable_gperf --test
 #    container:
@@ -386,6 +390,7 @@ jobs:
     runs-on: ubuntu-latest
     env:
       USE_JEMALLOC: ON
+      ENABLE_ASAN: OFF
       ARTIFACT_NAME: release_jemalloc
       BUILD_OPTIONS: -t release --use_jemalloc --test
     container:
@@ -463,6 +468,7 @@ jobs:
     runs-on: ubuntu-latest
     env:
       USE_JEMALLOC: OFF
+      ENABLE_ASAN: OFF
       BUILD_OPTIONS: -t debug --test --separate_servers
       PACK_OPTIONS: --separate_servers
     container:
```

**File**: `.github/workflows/lint_and_test_go-client.yml` (modified, +1/-0)
```diff
@@ -86,6 +86,7 @@ jobs:
     runs-on: ubuntu-latest
     env:
       USE_JEMALLOC: OFF
+      ENABLE_ASAN: OFF
       BUILD_OPTIONS: -t release
     container:
       image: apache/pegasus:thirdparties-bin-test-ubuntu2204-${{ github.base_ref }}
```

**File**: `.github/workflows/lint_and_test_java-client.yml` (modified, +1/-0)
```diff
@@ -55,6 +55,7 @@ jobs:
     runs-on: ubuntu-latest
     env:
       USE_JEMALLOC: OFF
+      ENABLE_ASAN: OFF
       ARTIFACT_NAME: release_for_java_client
       BUILD_OPTIONS: -t release
     container:
```

**File**: `.github/workflows/lint_and_test_scala-client.yml` (modified, +1/-0)
```diff
@@ -63,6 +63,7 @@ jobs:
     runs-on: ubuntu-latest
     env:
       USE_JEMALLOC: OFF
+      ENABLE_ASAN: OFF
       BUILD_OPTIONS: -t release
     container:
       image: apache/pegasus:thirdparties-bin-test-ubuntu2204-${{ github.base_ref }}
```

**File**: `.github/workflows/test_nodejs-client.yml` (modified, +1/-0)
```diff
@@ -43,6 +43,7 @@ jobs:
     runs-on: ubuntu-latest
     env:
       USE_JEMALLOC: OFF
+      ENABLE_ASAN: OFF
       BUILD_OPTIONS: -t release
     container:
       image: apache/pegasus:thirdparties-bin-test-ubuntu2204-${{ github.base_ref }}
```

**File**: `.github/workflows/test_python-client.yml` (modified, +1/-0)
```diff
@@ -43,6 +43,7 @@ jobs:
     runs-on: ubuntu-latest
     env:
       USE_JEMALLOC: OFF
+      ENABLE_ASAN: OFF
       BUILD_OPTIONS: -t release
     container:
       image: apache/pegasus:thirdparties-bin-test-ubuntu2204-${{ github.base_ref }}
```

**File**: `run.sh` (modified, +4/-0)
```diff
@@ -288,6 +288,10 @@ function run_build()
         echo "Start building third-parties..."
         mkdir -p build
         pushd build
+        if [[ "${SANITIZER}" == *address* ]]; then
+            echo "ASan for third-parties is enabled"
+            CMAKE_OPTIONS="${CMAKE_OPTIONS} -DENABLE_ASAN=ON"
+        fi
         CMAKE_OPTIONS="${CMAKE_OPTIONS} -DROCKSDB_PORTABLE=${ROCKSDB_PORTABLE}"
         cmake .. ${CMAKE_OPTIONS}
         make -j$JOB_NUM
```

---

### Incident Patch 9: `68a76223` (2026-01-06)
**Commit Message**: ci(github): build third-party images independently per OS version to prevent a single OS build failure from breaking the entire build (#2346)

Currently, the third-party images used for CI are built in roughly two stages: the first stage
builds the *src* images, and the second stage builds the *bin* images. In each stage,
images are built for multiple OS versions. If the src image build fails for **any** OS version,
all bin image builds are canceled.

In practice, this is not ideal. The likelihood of build failures differs across OS versions —
for example, older OS versions are more prone to issues. A failure in a single older OS
version can block the entire third-party image build process.

This PR improves the process by fully decoupling image builds across different OS versions
so they do not affect each other. If a third-party image build fails for one OS version, it can
be fixed independently without impacting the builds for other OS versions.

**File**: `.github/workflows/build-push-thirdparty.yml` (added, +185/-0)
```diff
@@ -0,0 +1,185 @@
+# Licensed to the Apache Software Foundation (ASF) under one
+# or more contributor license agreements.  See the NOTICE file
+# distributed with this work for additional information
+# regarding copyright ownership.  The ASF licenses this file
+# to you under the Apache License, Version 2.0 (the
+# "License"); you may not use this file except in compliance
+# with the License.  You may obtain a copy of the License at
+#
+#   http://www.apache.org/licenses/LICENSE-2.0
+#
+# Unless required by applicable law or agreed to in writing,
+# software distributed under the License is distributed on an
+# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
+# KIND, either express or implied.  See the License for the
+# specific language governing permissions and limitations
+# under the License.
+
+name: BuildThirdpartyDocker - build and publish thirdparty
+
+on:
+  workflow_call:
+    inputs:
+      osversion:
+        required: true
+        type: string
+
+jobs:
+  build_push_src_docker_images:
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/checkout@v4
+      - name: Set up QEMU
+        uses: docker/setup-qemu-action@v1
+      - name: Set up Docker Buildx
+        uses: docker/setup-buildx-action@v1
+      - name: Login to DockerHub
+        uses: docker/login-action@v1
+        with:
+          username: ${{ secrets.DOCKERHUB_USER }}
+          password: ${{ secrets.DOCKERHUB_TOKEN }}
+      - name: Build and push
+        uses: docker/build-push-action@v2.10.0
+        with:
+          context: .
+          file: ./docker/thirdparties-src/Dockerfile
+          push: true
+          tags: |
+            apache/pegasus:thirdparties-src-${{ inputs.osversion }}-${{ github.ref_name }}
+          build-args: |
+            GITHUB_BRANCH=${{ github.ref_name }}
+            OS_VERSION=${{ inputs.osversion }}
+            HADOOP_BIN_PATH=hadoop-bin
+            ZOOKEEPER_BIN_PATH=zookeeper-bin
+
+  build_push_bin_docker_images:
+    runs-on: ubuntu-latest
+    env:
+      # The glibc version on ubuntu1804 is lower than the node20 required, so
+      # we need to force the node version to 16.
+      # See more details: https://github.com/actions/checkout/issues/1809
+      ACTIONS_RUNNER_FORCE_ACTIONS_NODE_VERSION: node16
+      ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION: true
+    needs: build_push_src_docker_images
+    steps:
+      # The glibc version on ubuntu1804 is lower than the actions/checkout@v4 required, so
+      # we need to force to use actions/checkout@v3.
+      - uses: actions/checkout@v3
+      - name: Set up QEMU
+        uses: docker/setup-qemu-action@v1
+      - name: Set up Docker Buildx
+        uses: docker/setup-buildx-action@v1
+      - name: Login to DockerHub
+        uses: docker/login-action@v1
+        with:
+          username: ${{ secrets.DOCKERHUB_USER }}
+          password: ${{ secrets.DOCKERHUB_TOKEN }}
+      - name: Build and push for production
+        uses: docker/build-push-action@v2.10.0
+        with:
+          context: .
+          file: ./docker/thirdparties-bin/Dockerfile
+          push: true
+          tags: |
+            apache/pegasus:thirdparties-bin-${{ inputs.osversion }}-${{ github.ref_name }}
+          build-args: |
+            GITHUB_BRANCH=${{ github.ref_name }}
+            OS_VERSION=${{ inputs.osversion }}
+            HADOOP_BIN_PATH=hadoop-bin
+            ZOOKEEPER_BIN_PATH=zookeeper-bin
+
+  build_push_bin_jemalloc_docker_images:
+    runs-on: ubuntu-latest
+    env:
+      # The glibc version on ubuntu1804 is lower than the node20 required, so
+      # we need to force the node version to 16.
+      # See more details: https://github.com/actions/checkout/issues/1809
+      ACTIONS_RUNNER_FORCE_ACTIONS_NODE_VERSION: node16
+      ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION: true
+    needs: build_push_src_docker_images
+    steps:
+      # The glibc version on ubuntu1804 is lower than the actions/checkout@v4 required, so
+      # we need to force to use actions/checkout@v3.
+      - uses: actions/checkout@v3
+      - name: Set up QEMU
+        uses: docker/setup-qemu-action@v1
+      - name: Set up Docker Buildx
+        uses: docker/setup-buildx-action@v1
+      - name: Login to DockerHub
+        uses: docker/login-action@v1
+        with:
+          username: ${{ secrets.DOCKERHUB_USER }}
+          password: ${{ secrets.DOCKERHUB_TOKEN }}
+      - name: Build and push for production with jemalloc
+        uses: docker/build-push-action@v2.10.0
+        with:
+          context: .
+          file: ./docker/thirdparties-bin/Dockerfile
+          push: true
+          tags: |
+            apache/pegasus:thirdparties-bin-jemallc-${{ inputs.osversion }}-${{ github.ref_name }}
+          build-args: |
+            GITHUB_BRANCH=${{ github.ref_name }}
+            OS_VERSION=${{ inputs.osversion }}
+            USE_JEMALLOC=ON
+            HADOOP_BIN_PATH=hadoop-bin
+            ZOOKEEPER_BIN_PATH=zookeeper-bin
+
+  build_p
```

**File**: `.github/workflows/thirdparty-regular-push.yml` (modified, +6/-185)
```diff
@@ -15,7 +15,7 @@
 # specific language governing permissions and limitations
 # under the License.
 ---
-name:  BuildThirdpartyDockerRegularly - build and publish thirdparty every week
+name: BuildThirdpartyDockerRegularly - build and publish thirdparty every week
 
 on:
   push:
@@ -40,8 +40,7 @@ on:
     - cron:  '0 18 * * 1'
 
 jobs:
-  build_push_src_docker_images:
-    runs-on: ubuntu-latest
+  build_push_thirdparty_docker_images:
     strategy:
       fail-fast: false
       matrix:
@@ -50,185 +49,7 @@ jobs:
           - ubuntu2004
           - ubuntu2204
           - rockylinux9
-    steps:
-      - uses: actions/checkout@v4
-      - name: Set up QEMU
-        uses: docker/setup-qemu-action@v1
-      - name: Set up Docker Buildx
-        uses: docker/setup-buildx-action@v1
-      - name: Login to DockerHub
-        uses: docker/login-action@v1
-        with:
-          username: ${{ secrets.DOCKERHUB_USER }}
-          password: ${{ secrets.DOCKERHUB_TOKEN }}
-      - name: Build and push
-        uses: docker/build-push-action@v2.10.0
-        with:
-          context: .
-          file: ./docker/thirdparties-src/Dockerfile
-          push: true
-          tags: |
-            apache/pegasus:thirdparties-src-${{ matrix.osversion }}-${{ github.ref_name }}
-          build-args: |
-            GITHUB_BRANCH=${{ github.ref_name }}
-            OS_VERSION=${{ matrix.osversion }}
-            HADOOP_BIN_PATH=hadoop-bin
-            ZOOKEEPER_BIN_PATH=zookeeper-bin
-
-  build_push_bin_docker_images:
-    runs-on: ubuntu-latest
-    env:
-      # The glibc version on ubuntu1804 is lower than the node20 required, so
-      # we need to force the node version to 16.
-      # See more details: https://github.com/actions/checkout/issues/1809
-      ACTIONS_RUNNER_FORCE_ACTIONS_NODE_VERSION: node16
-      ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION: true
-    needs: build_push_src_docker_images
-    strategy:
-      fail-fast: false
-      matrix:
-        osversion:
-          - ubuntu1804
-          - ubuntu2004
-          - ubuntu2204
-          - rockylinux9
-    steps:
-      # The glibc version on ubuntu1804 is lower than the actions/checkout@v4 required, so
-      # we need to force to use actions/checkout@v3.
-      - uses: actions/checkout@v3
-      - name: Set up QEMU
-        uses: docker/setup-qemu-action@v1
-      - name: Set up Docker Buildx
-        uses: docker/setup-buildx-action@v1
-      - name: Login to DockerHub
-        uses: docker/login-action@v1
-        with:
-          username: ${{ secrets.DOCKERHUB_USER }}
-          password: ${{ secrets.DOCKERHUB_TOKEN }}
-      - name: Build and push for production
-        uses: docker/build-push-action@v2.10.0
-        with:
-          context: .
-          file: ./docker/thirdparties-bin/Dockerfile
-          push: true
-          tags: |
-            apache/pegasus:thirdparties-bin-${{ matrix.osversion }}-${{ github.ref_name }}
-          build-args: |
-            GITHUB_BRANCH=${{ github.ref_name }}
-            OS_VERSION=${{ matrix.osversion }}
-            HADOOP_BIN_PATH=hadoop-bin
-            ZOOKEEPER_BIN_PATH=zookeeper-bin
-
-  build_push_bin_jemalloc_docker_images:
-    runs-on: ubuntu-latest
-    env:
-      # The glibc version on ubuntu1804 is lower than the node20 required, so
-      # we need to force the node version to 16.
-      # See more details: https://github.com/actions/checkout/issues/1809
-      ACTIONS_RUNNER_FORCE_ACTIONS_NODE_VERSION: node16
-      ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION: true
-    needs: build_push_src_docker_images
-    strategy:
-      fail-fast: false
-      matrix:
-        osversion:
-          - ubuntu1804
-          - ubuntu2004
-          - ubuntu2204
-          - rockylinux9
-    steps:
-      # The glibc version on ubuntu1804 is lower than the actions/checkout@v4 required, so
-      # we need to force to use actions/checkout@v3.
-      - uses: actions/checkout@v3
-      - name: Set up QEMU
-        uses: docker/setup-qemu-action@v1
-      - name: Set up Docker Buildx
-        uses: docker/setup-buildx-action@v1
-      - name: Login to DockerHub
-        uses: docker/login-action@v1
-        with:
-          username: ${{ secrets.DOCKERHUB_USER }}
-          password: ${{ secrets.DOCKERHUB_TOKEN }}
-      - name: Build and push for production with jemalloc
-        uses: docker/build-push-action@v2.10.0
-        with:
-          context: .
-          file: ./docker/thirdparties-bin/Dockerfile
-          push: true
-          tags: |
-            apache/pegasus:thirdparties-bin-jemallc-${{ matrix.osversion }}-${{ github.ref_name }}
-          build-args: |
-            GITHUB_BRANCH=${{ github.ref_name }}
-            OS_VERSION=${{ matrix.osversion }}
-            USE_JEMALLOC=ON
-            HADOOP_BIN_PATH=hadoop-bin
-            ZOOKEEPER_BIN_PATH=zookeeper-bin
-
-  build_push_bin_test_docker_images:
-    runs-on: ubuntu-latest
-    needs: build_push_src_docker_images
-    strategy:
-     
```

---

### Incident Patch 10: `abddf21a` (2026-01-05)
**Commit Message**: fix(Python-client):add thrift client timeout support (#2304)

This PR fixes a critical issue where Python client Thrift requests were being dropped by the server
when the `rpc_request_dropped_before_execution_when_timeout` parameter is enabled, due to
the `client_timeout` field not being properly set in the Thrift header.

**File**: `python-client/pypegasus/operate/packet.py` (modified, +2/-1)
```diff
@@ -74,7 +74,8 @@ def __init__(self, gpid=gpid(), request=None, partition_hash=0):
         self.request = request
         self.response = None
 
-    def prepare_thrift_header(self, body_length):
+    def prepare_thrift_header(self, body_length, timeout):
+        self.header.client_timeout = max(0, timeout)
         self.header.body_length = body_length
         self.header.thread_hash = tools.dsn_gpid_to_thread_hash(self.header.app_id, self.header.partition_index)
         return self.header.to_bytes()
```

**File**: `python-client/pypegasus/pgclient.py` (modified, +3/-3)
```diff
@@ -107,7 +107,7 @@ def operate(self, op, timeout=None):
         self._requests[seqid] = dr
 
         # ds(deferred send) will wait dr(deferred receive)
-        ds = defer.maybeDeferred(self.send_req, op, seqid)
+        ds = defer.maybeDeferred(self.send_req, op, seqid, timeout)
         ds.addCallbacks(
             callback=self.cb_send,
             callbackArgs=(seqid,),
@@ -116,13 +116,13 @@ def operate(self, op, timeout=None):
         ds.addTimeout(timeout/1000.0, reactor, self.on_timeout)
         return ds
 
-    def send_req(self, op, seqid):
+    def send_req(self, op, seqid, timeout):
         oprot = self._oprot_factory.getProtocol(self._transport)
         oprot.trans.seek(ThriftHeader.HEADER_LENGTH)                    # skip header
         op.send_data(oprot, seqid)
         body_length = oprot.trans.tell() - ThriftHeader.HEADER_LENGTH
         oprot.trans.seek(0)                                             # back to header
-        oprot.trans.write(op.prepare_thrift_header(body_length))
+        oprot.trans.write(op.prepare_thrift_header(body_length, timeout))
         oprot.trans.flush()
 
     def recv_ACK(self, iprot, mtype, rseqid, errno, result_type, parser):
```

---

### Incident Patch 11: `90093402` (2025-11-25)
**Commit Message**: fix: fix ubuntu openssl (#2327)

Fix https://github.com/apache/incubator-pegasus/issues/2325.

The reason is that in https://github.com/apache/incubator-pegasus/pull/2293
openssl/types.h was included, while the default version of OpenSSL on Ubuntu
20.04 is 1.1.1 which does not have this header file. To solve this problem, we
install OpenSSL 3.0.12 instead on Ubuntu 20.04.

**File**: `docker/pegasus-build-env/ubuntu2004/Dockerfile` (modified, +14/-0)
```diff
@@ -67,6 +67,20 @@ RUN wget --progress=dot:giga https://archive.apache.org/dist/thrift/0.11.0/thrif
     make -j$(($(nproc)/2+1)) && make install && cd - && \
     rm -rf thrift-0.11.0 thrift-0.11.0.tar.gz
 
+ENV OPENSSL_VERSION="3.0.12"
+ENV OPENSSL_INSTALL_DIR="/usr/local/ssl"
+
+RUN wget https://www.openssl.org/source/openssl-$OPENSSL_VERSION.tar.gz -P /opt/openssl\
+    && cd /opt/openssl \ && tar -xzvf openssl-$OPENSSL_VERSION.tar.gz \
+    && cd openssl-$OPENSSL_VERSION \
+    && ./config shared --prefix=$OPENSSL_INSTALL_DIR \
+    && make -j$(nproc) \
+    && make install \
+    && ln -sf $OPENSSL_INSTALL_DIR/bin/openssl /usr/bin/openssl \
+    && ln -sf $OPENSSL_INSTALL_DIR/include/openssl /usr/local/include/openssl \
+    && echo "$OPENSSL_INSTALL_DIR/lib64" | tee /etc/ld.so.conf.d/openssl-3.0.conf \
+    && ldconfig -v
+
 ENV JAVA_HOME=/usr/lib/jvm/java-8-openjdk-amd64
 ENV CLASSPATH=$JAVA_HOME/lib/
 ENV PATH=$JAVA_HOME/bin:$PATH
```

---

### Incident Patch 12: `e4555f07` (2025-11-21)
**Commit Message**: build(go-collector): bump go-client dependency in collector to latest version including `ListNodes` interface (#2322)

Upgrade to go-client version to [5eb1665e0630](https://github.com/apache/incubator-pegasus/commit/5eb1665e06302ebbdb8b15f41ed1c85b407d10d9)
to introduce [ListNodes](https://github.com/apache/incubator-pegasus/pull/1939)
for hotsport detection.

**File**: `collector/aggregate/aggregator.go` (modified, +2/-2)
```diff
@@ -21,7 +21,7 @@ import (
 	"fmt"
 	"time"
 
-	"github.com/apache/incubator-pegasus/go-client/idl/admin"
+	"github.com/apache/incubator-pegasus/go-client/idl/replication"
 	log "github.com/sirupsen/logrus"
 	"github.com/spf13/viper"
 	"gopkg.in/tomb.v2"
@@ -133,7 +133,7 @@ func (ag *tableStatsAggregator) updateTableMap() error {
 	return nil
 }
 
-func (ag *tableStatsAggregator) doUpdateTableMap(tables []*admin.AppInfo) {
+func (ag *tableStatsAggregator) doUpdateTableMap(tables []*replication.AppInfo) {
 	currentTableSet := make(map[int32]*struct{})
 	for _, tb := range tables {
 		currentTableSet[tb.AppID] = nil
```

**File**: `collector/aggregate/aggregator_test.go` (modified, +4/-4)
```diff
@@ -20,8 +20,8 @@ package aggregate
 import (
 	"testing"
 
-	"github.com/apache/incubator-pegasus/go-client/idl/admin"
 	"github.com/apache/incubator-pegasus/go-client/idl/base"
+	"github.com/apache/incubator-pegasus/go-client/idl/replication"
 	"github.com/stretchr/testify/assert"
 )
 
@@ -36,7 +36,7 @@ func TestUpdateLocalTableMap(t *testing.T) {
 	assert.Equal(t, len(ag.tables[1].Partitions), 4) // test
 	assert.Equal(t, len(ag.tables[2].Partitions), 8) // stat
 
-	tables := []*admin.AppInfo{
+	tables := []*replication.AppInfo{
 		{AppID: 1, AppName: "stat", PartitionCount: 4},
 		{AppID: 2, AppName: "test", PartitionCount: 8},
 		{AppID: 3, AppName: "new_table", PartitionCount: 16},
@@ -45,7 +45,7 @@ func TestUpdateLocalTableMap(t *testing.T) {
 	assert.Equal(t, len(ag.tables), 3)
 	assert.Equal(t, len(ag.tables[3].Partitions), 16)
 
-	tables = []*admin.AppInfo{
+	tables = []*replication.AppInfo{
 		{AppID: 1, AppName: "stat", PartitionCount: 4},
 	}
 	ag.doUpdateTableMap(tables)
@@ -57,7 +57,7 @@ func TestUpdatePartitionStats(t *testing.T) {
 	ag := &tableStatsAggregator{
 		tables: make(map[int32]*TableStats),
 	}
-	tables := []*admin.AppInfo{
+	tables := []*replication.AppInfo{
 		{AppID: 1, AppName: "stat", PartitionCount: 4},
 	}
 	ag.doUpdateTableMap(tables)
```

**File**: `collector/aggregate/perf_client.go` (modified, +6/-5)
```diff
@@ -25,6 +25,7 @@ import (
 
 	"github.com/apache/incubator-pegasus/go-client/idl/admin"
 	"github.com/apache/incubator-pegasus/go-client/idl/base"
+	"github.com/apache/incubator-pegasus/go-client/idl/replication"
 	"github.com/apache/incubator-pegasus/go-client/session"
 	log "github.com/sirupsen/logrus"
 	batchErr "k8s.io/apimachinery/pkg/util/errors"
@@ -171,7 +172,7 @@ func (m *PerfClient) GetNodeStats(filter string) ([]*NodeStat, error) {
 func (m *PerfClient) listNodes() ([]*admin.NodeInfo, error) {
 	ctx, cancel := context.WithTimeout(context.Background(), time.Second*5)
 	defer cancel()
-	resp, err := m.meta.ListNodes(ctx, &admin.ListNodesRequest{
+	resp, err := m.meta.ListNodes(ctx, &admin.ConfigurationListNodesRequest{
 		Status: admin.NodeStatus_NS_ALIVE,
 	})
 	if err != nil {
@@ -180,11 +181,11 @@ func (m *PerfClient) listNodes() ([]*admin.NodeInfo, error) {
 	return resp.Infos, nil
 }
 
-func (m *PerfClient) listTables() ([]*admin.AppInfo, error) {
+func (m *PerfClient) listTables() ([]*replication.AppInfo, error) {
 	ctx, cancel := context.WithTimeout(context.Background(), time.Second*5)
 	defer cancel()
-	resp, err := m.meta.ListApps(ctx, &admin.ListAppsRequest{
-		Status: admin.AppStatus_AS_AVAILABLE,
+	resp, err := m.meta.ListApps(ctx, &admin.ConfigurationListAppsRequest{
+		Status: replication.AppStatus_AS_AVAILABLE,
 	})
 	if err != nil {
 		return nil, err
@@ -202,7 +203,7 @@ func (m *PerfClient) updateNodes() {
 
 	newNodes := make(map[string]*PerfSession)
 	for _, n := range nodeInfos {
-		addr := n.Address.GetAddress()
+		addr := n.Node.GetAddress()
 		node, found := m.nodes[addr]
 		if !found {
 			newNodes[addr] = NewPerfSession(addr)
```

**File**: `collector/aggregate/perf_session.go` (modified, +1/-1)
```diff
@@ -48,7 +48,7 @@ func (p *PerfCounter) String() string {
 func NewPerfSession(addr string) *PerfSession {
 	return &PerfSession{
 		Address:     addr,
-		NodeSession: session.NewNodeSession(addr, session.NodeTypeReplica),
+		NodeSession: session.NewNodeSession(addr, session.NodeTypeReplica, false),
 	}
 }
 
```

**File**: `collector/aggregate/table_stats.go` (modified, +2/-2)
```diff
@@ -20,8 +20,8 @@ package aggregate
 import (
 	"time"
 
-	"github.com/apache/incubator-pegasus/go-client/idl/admin"
 	"github.com/apache/incubator-pegasus/go-client/idl/base"
+	"github.com/apache/incubator-pegasus/go-client/idl/replication"
 )
 
 // PartitionStats is a set of metrics retrieved from this partition.
@@ -59,7 +59,7 @@ type ClusterStats struct {
 	Stats map[string]float64
 }
 
-func newTableStats(info *admin.AppInfo) *TableStats {
+func newTableStats(info *replication.AppInfo) *TableStats {
 	tb := &TableStats{
 		TableName:  info.AppName,
 		AppID:      int(info.AppID),
```

**File**: `collector/avail/detector.go` (modified, +28/-8)
```diff
@@ -23,6 +23,7 @@ import (
 	"time"
 
 	"github.com/apache/incubator-pegasus/go-client/admin"
+	"github.com/apache/incubator-pegasus/go-client/config"
 	"github.com/apache/incubator-pegasus/go-client/pegasus"
 	"github.com/prometheus/client_golang/prometheus"
 	"github.com/prometheus/client_golang/prometheus/promauto"
@@ -39,16 +40,35 @@ type Detector interface {
 
 // NewDetector returns a service-availability detector.
 func NewDetector(detectInterval time.Duration,
-	detectTimeout time.Duration, partitionCount int) Detector {
+	detectTimeout time.Duration) Detector {
 	metaServers := viper.GetStringSlice("meta_servers")
-	tableName := viper.GetStringMapString("availablity_detect")["table_name"]
+	if len(metaServers) == 0 {
+		log.Fatal("meta_servers is empty")
+	}
+
+	tableName := viper.GetString("availability_detect.table_name")
+	if len(tableName) == 0 {
+		log.Fatal("availability_detect.table_name is empty")
+	}
+
+	partitionCount := viper.GetInt32("availability_detect.partition_count")
+	if partitionCount <= 0 || (partitionCount&(partitionCount-1)) != 0 {
+		log.Fatalf("availability_detect.partition_count(%d) must be power of 2", partitionCount)
+	}
+
+	maxReplicaCount := viper.GetInt32("availability_detect.max_replica_count")
+	if maxReplicaCount <= 0 {
+		log.Fatalf("availability_detect.max_replica_count(%d) must be > 0", partitionCount)
+	}
+
 	// Create detect table.
-	adminClient := admin.NewClient(admin.Config{MetaServers: metaServers})
-	err := adminClient.CreateTable(context.Background(), tableName, partitionCount)
+	adminClient := admin.NewClient(admin.Config{MetaServers: metaServers, Timeout: 10 * time.Second})
+	_, err := adminClient.CreateTable(tableName, partitionCount, maxReplicaCount, make(map[string]string), 600, true)
 	if err != nil {
-		log.Errorf("Create detect table %s failed, error: %s", tableName, err)
+		log.Fatalf("Create detect table %s failed, error: %s", tableName, err)
 	}
-	pegasusClient := pegasus.NewClient(pegasus.Config{MetaServers: metaServers})
+
+	pegasusClient := pegasus.NewClient(*config.NewConfig(metaServers))
 	return &pegasusDetector{
 		client:          pegasusClient,
 		detectTableName: tableName,
@@ -93,7 +113,7 @@ type pegasusDetector struct {
 	// timeout of a single detect.
 	detectTimeout time.Duration
 	// partition count.
-	partitionCount int
+	partitionCount int32
 }
 
 func (d *pegasusDetector) Run(tom *tomb.Tomb) error {
@@ -143,7 +163,7 @@ func (d *pegasusDetector) detectPartition() {
 const letterBytes = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
 
 // Generate a random string.
-func RandStringBytes(n int) string {
+func RandStringBytes(n int32) string {
 	b := make([]byte, n)
 	for i := range b {
 		b[i] = letterBytes[rand.Intn(len(letterBytes))]
```

**File**: `collector/config.yml` (modified, +3/-1)
```diff
@@ -42,8 +42,10 @@ falcon_agent:
   port : 1988
   http_path : "/v1/push"
 
-availablity_detect:
+availability_detect:
   table_name : test
+  partition_count : 16
+  max_replica_count : 3
 
 hotspot:
   partition_detect_interval : 10s
```

**File**: `collector/go.mod` (modified, +7/-8)
```diff
@@ -20,9 +20,9 @@ module github.com/apache/incubator-pegasus/collector
 go 1.18
 
 require (
-	github.com/apache/incubator-pegasus/go-client v0.0.0-20220526071020-be5634371701
+	github.com/apache/incubator-pegasus/go-client v0.0.0-20251112031012-5eb1665e0630
 	github.com/kataras/iris/v12 v12.2.0
-	github.com/prometheus/client_golang v1.11.1
+	github.com/prometheus/client_golang v1.18.0
 	github.com/sirupsen/logrus v1.8.1
 	github.com/spf13/viper v1.7.1
 	github.com/stretchr/testify v1.8.2
@@ -43,13 +43,12 @@ require (
 	github.com/aymerick/douceur v0.2.0 // indirect
 	github.com/beorn7/perks v1.0.1 // indirect
 	github.com/cenkalti/backoff/v4 v4.1.0 // indirect
-	github.com/cespare/xxhash/v2 v2.1.2 // indirect
+	github.com/cespare/xxhash/v2 v2.2.0 // indirect
 	github.com/davecgh/go-spew v1.1.1 // indirect
 	github.com/eknkc/amber v0.0.0-20171010120322-cdade1c07385 // indirect
 	github.com/fatih/structs v1.1.0 // indirect
 	github.com/flosch/pongo2/v4 v4.0.2 // indirect
 	github.com/fsnotify/fsnotify v1.5.4 // indirect
-	github.com/golang/protobuf v1.5.2 // indirect
 	github.com/golang/snappy v0.0.4 // indirect
 	github.com/google/uuid v1.3.0 // indirect
 	github.com/gorilla/css v1.0.0 // indirect
@@ -65,14 +64,14 @@ require (
 	github.com/magiconair/properties v1.8.1 // indirect
 	github.com/mailgun/raymond/v2 v2.0.48 // indirect
 	github.com/mailru/easyjson v0.7.7 // indirect
-	github.com/matttproud/golang_protobuf_extensions v1.0.1 // indirect
+	github.com/matttproud/golang_protobuf_extensions/v2 v2.0.0 // indirect
 	github.com/microcosm-cc/bluemonday v1.0.23 // indirect
 	github.com/mitchellh/mapstructure v1.1.2 // indirect
 	github.com/pelletier/go-toml v1.2.0 // indirect
 	github.com/pmezard/go-difflib v1.0.0 // indirect
-	github.com/prometheus/client_model v0.2.0 // indirect
-	github.com/prometheus/common v0.26.0 // indirect
-	github.com/prometheus/procfs v0.6.0 // indirect
+	github.com/prometheus/client_model v0.5.0 // indirect
+	github.com/prometheus/common v0.45.0 // indirect
+	github.com/prometheus/procfs v0.12.0 // indirect
 	github.com/russross/blackfriday/v2 v2.1.0 // indirect
 	github.com/schollz/closestmatch v2.1.0+incompatible // indirect
 	github.com/sergi/go-diff v1.1.0 // indirect
```

---

### Incident Patch 13: `e56cccb4` (2025-11-19)
**Commit Message**: ci(github): fix workflow configuration issues to enable Go collector code style checks (#2321)

**File**: `.github/workflows/lint_and_test_collector.yml` (modified, +1/-1)
```diff
@@ -50,7 +50,7 @@ jobs:
         with:
           go-version: 1.18
       - name: Format
-        working-directory: ./go-client
+        working-directory: ./collector
         run: |
           gofmt -d .
           test -z "$(gofmt -d .)"
```

---

### Incident Patch 14: `5eb1665e` (2025-11-12)
**Commit Message**: fix(cluster_balance_policy): clear partitions in migration info before outputting result into it (#2317)

**File**: `src/meta/cluster_balance_policy.cpp` (modified, +2/-0)
```diff
@@ -224,6 +224,8 @@ bool cluster_balance_policy::get_app_migration_info(std::shared_ptr<app_state> a
 {
     info.app_id = app->app_id;
     info.app_name = app->app_name;
+
+    info.partitions.clear();
     info.partitions.reserve(app->pcs.size());
     for (const auto &pc : app->pcs) {
         std::map<host_port, partition_status::type> pstatus_map;
```

**File**: `src/meta/test/cluster_balance_policy_test.cpp` (modified, +26/-14)
```diff
@@ -23,6 +23,7 @@
 #include <memory>
 #include <set>
 #include <string>
+#include <string_view>
 #include <unordered_map>
 #include <utility>
 #include <vector>
@@ -112,41 +113,52 @@ TEST(cluster_balance_policy, get_app_migration_info)
     meta_service svc;
     cluster_balance_policy policy(&svc);
 
-    int appid = 1;
-    std::string appname = "test";
+    constexpr int kAppId = 1;
+    constexpr std::string_view kAppName("test");
     const auto &hp = host_port("localhost", 10086);
+
     app_info info;
-    info.app_id = appid;
-    info.app_name = appname;
+    info.app_id = kAppId;
+    info.app_name = kAppName;
     info.partition_count = 1;
-    auto app = std::make_shared<app_state>(info);
+
+    const auto app = std::make_shared<app_state>(info);
     SET_IP_AND_HOST_PORT_BY_DNS(app->pcs[0], primary, hp);
 
     node_state ns;
     ns.set_hp(hp);
-    ns.put_partition(gpid(appid, 0), true);
+    ns.put_partition(gpid(kAppId, 0), true);
     node_mapper nodes;
     nodes[hp] = ns;
 
     cluster_balance_policy::app_migration_info migration_info;
+
     {
         app->pcs[0].max_replica_count = 100;
-        auto res =
+        const auto res =
             policy.get_app_migration_info(app, nodes, balance_type::COPY_PRIMARY, migration_info);
         ASSERT_FALSE(res);
     }
 
+    migration_info.partitions.emplace_back();
+    ASSERT_EQ(1, migration_info.partitions.size());
+
     {
         app->pcs[0].max_replica_count = 1;
-        auto res =
+        const auto res =
             policy.get_app_migration_info(app, nodes, balance_type::COPY_PRIMARY, migration_info);
         ASSERT_TRUE(res);
-        ASSERT_EQ(migration_info.app_id, appid);
-        ASSERT_EQ(migration_info.app_name, appname);
-        std::map<host_port, partition_status::type> pstatus_map;
-        pstatus_map[hp] = partition_status::type::PS_PRIMARY;
-        ASSERT_EQ(migration_info.partitions[0], pstatus_map);
-        ASSERT_EQ(migration_info.replicas_count[hp], 1);
+
+        ASSERT_EQ(kAppId, migration_info.app_id);
+        ASSERT_EQ(kAppName, migration_info.app_name);
+
+        ASSERT_EQ(1, migration_info.partitions.size());
+
+        std::map<host_port, partition_status::type> expected_status_map;
+        expected_status_map[hp] = partition_status::type::PS_PRIMARY;
+        ASSERT_EQ(expected_status_map, migration_info.partitions[0]);
+
+        ASSERT_EQ(1, migration_info.replicas_count[hp]);
     }
 }
 
```

---

### Incident Patch 15: `bdabe0ac` (2025-11-11)
**Commit Message**: build(deps): bump twisted from 21.2.0 to 24.7.0 in /python-client (#2095)

Bumps [twisted](https://github.com/twisted/twisted) from 21.2.0 to 24.7.0.
- [Release notes](https://github.com/twisted/twisted/releases)
- [Changelog](https://github.com/twisted/twisted/blob/trunk/NEWS.rst)
- [Commits](https://github.com/twisted/twisted/compare/twisted-21.2.0...twisted-24.7.0)

---
updated-dependencies:
- dependency-name: twisted
  dependency-type: direct:production

**File**: `.github/workflows/test_python-client.yml` (modified, +2/-0)
```diff
@@ -68,6 +68,8 @@ jobs:
       # build and install thrift-compiler 0.13.0 manually.
       - name: Install thrift
         run: |
+          apt-get update
+          apt-get install python3-dev -y
           export THRIFT_VERSION=0.13.0
           wget --progress=dot:giga https://github.com/apache/thrift/archive/refs/tags/v${THRIFT_VERSION}.tar.gz
           tar -xzf v${THRIFT_VERSION}.tar.gz
```

**File**: `python-client/requirement.txt` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-Twisted==21.2.0
+Twisted==24.7.0
 aenum==3.0.0
 thrift==0.13.0
 pyOpenSSL==24.2.1
```

**File**: `python-client/setup.py` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@
 setup(
     name='pypegasus3',
     version=pypegasus.__version__,
-    install_requires=['Twisted==21.2.0', 'aenum==3.0.0', 'thrift==0.13.0', 'pyOpenSSL==24.2.1', 'cryptography==43.0.1', 'PyYAML>=5.1'],
+    install_requires=['Twisted==24.7.0', 'aenum==3.0.0', 'thrift==0.13.0', 'pyOpenSSL==24.2.1', 'cryptography==43.0.1', 'PyYAML>=5.1'],
     packages=find_packages(),
     package_data={'': ['logger.yaml']},
     platforms='any',
```

#### Recent Merged Pull Requests:
- **PR #2402** (closed): [backport] ci(github): fix branch glob to actually match release branches (@acelyc111)
- **PR #2401** (closed): ci(github): fix branch glob to actually match release branches (@acelyc111)
- **PR #2399** (closed): block_service: fix 'occured' -> 'occurred' typos in ERR_FS_INTERNAL doc (@SAY-5)
- **PR #2398** (2026-04-15): ci(github): pin all actions to exact commit SHAs instead of tags or branch references (@empiredan)
- **PR #2396** (2026-04-09): feat(docker): support arm64 (#2081) (@empiredan)
- **PR #2393** (2026-04-14): feat(new_metrics): support `server_stat` command showing some important server-level metrics (part 4) (@empiredan)
- **PR #2385** (2026-03-18): feat(new_metrics): support `server_stat` command showing some important server-level metrics (part 3) (@empiredan)
- **PR #2377** (2026-03-18): feat(replica): support querying replica status via RESTful API (@empiredan)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
