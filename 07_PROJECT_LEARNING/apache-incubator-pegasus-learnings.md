# Forensic Learning Record (Deep Inspection): apache/incubator-pegasus

> **Canonical Artifact**: `07_PROJECT_LEARNING/apache-incubator-pegasus-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/apache/incubator-pegasus](https://github.com/apache/incubator-pegasus))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:40:50.514Z  
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

### Core Architecture Module: `admin-cli/client/meta.go`
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

package client

import (
	"context"
	"fmt"
	"reflect"
	"time"

	"github.com/apache/incubator-pegasus/admin-cli/util"
	"github.com/apache/incubator-pegasus/go-client/idl/admin"
	"github.com/apache/incubator-pegasus/go-client/idl/base"
	"github.com/apache/incubator-pegasus/go-client/idl/replication"
	"github.com/apache/incubator-pegasus/go-client/session"
)

type BalanceType int

const (
	BalanceMovePri BalanceType = iota
	BalanceCopyPri
	BalanceCopySec
)

func (t BalanceType) String() string {
	switch t {
	case BalanceMovePri:
		return "MovePri"
	case BalanceCopyPri:
		return "CopyPri"
	case BalanceCopySec:
		return "CopySec"
	default:
		panic(fmt.Sprintf("unexpected BalanceType: %d", t))
	}
}

// Meta is a helper over pegasus-go-client's primitive session.MetaManager.
// It aims to provide an easy-to-use API that eliminates some boilerplate code, like
// context creation, request/response creation, etc.
type Meta interface {
	Close() error

	// ListAvailableApps lists only available tables.
	ListAvailableApps() ([]*admin.AppInfo, error)

	ListApps(status admin.AppStatus) ([]*admin.AppInfo, error)

	QueryConfig(tableName string) (*replication.QueryCfgResponse, error)

	MetaControl(level admin.MetaFunctionLevel) (oldLevel admin.MetaFunctionLevel, err error)

	QueryClusterInfo() (map[string]string, error)

	UpdateAppEnvs(tableName string, envs map[string]string) error

	ClearAppEnvs(tableName string, clearPrefix string) error

	DelAppEnvs(tableName string, keys []string) error

	CreateApp(tableName string, envs map[string]string, partitionCount int) (int32, error)

	DropApp(tableName string, reserveSeconds int64) error

	ModifyDuplication(tableName string, dupid int, status admin.DuplicationStatus) error

	AddDuplication(tableName string, remoteCluster string, duplicateCheckpoint bool) (*admin.DuplicationAddResponse, error)

	QueryDuplication(tableName string) (*admin.DuplicationQueryResponse, error)

	ListNodes() ([]*admin.NodeInfo, error)

	RecallApp(originTableID int, newTableName string) (*admin.AppInfo, error)

	Balance(gpid *base.Gpid, opType BalanceType, from *util.PegasusNode, to *util.PegasusNode) error

	Propose(gpid *base.Gpid, action admin.ConfigType, target *util.PegasusNode, node *util.PegasusNode) error

	StartBackupApp(tableID int, providerType string, backupPath string) (*admin.StartBackupAppResponse, error)

	QueryBackupStatus(tableID int, backupID int64) (*admin.QueryBackupStatusResponse, error)

	RestoreApp(oldClusterName string, oldTableName string, oldTableID int, backupID int64, providerType string,
		newTableName string, restorePath string, skipBadPartition bool, policyName string) (*admin.CreateAppResponse, error)

	StartPartitionSplit(tableName string, newPartitionCount int) error

	QuerySplitStatus(tableName string) (*admin.QuerySplitResponse, error)

	PausePartitionSplit(tableName string, parentPidx int) error

	RestartPartitionSplit(tableName string, parentPidx int) error

	CancelPartitionSplit(tableName string, oldPartitionCount int) error

	StartBulkLoad(tableName string, clusterName string, providerType string, rootPath string) error

	QueryBulkLoad(tableName string) (*admin.QueryBulkLoadResponse, error)

	PauseBulkLoad(tableName string) error

	RestartBulkLoad(tableName string) error

	CancelBulkLoad(tableName string, forced bool) error

	ClearBulkLoad(tableName string) error

	StartManualCompaction(tableName string, targetLevel int, maxRunningCount int, bottommost bool) error

	QueryManualCompaction(tableName string) (*admin.QueryAppManualCompactResponse, error)
}

type rpcBasedMeta struct {
	meta *session.MetaManager
}

// NewRPCBasedMeta creates the connection to meta.
func NewRPCBasedMeta(metaAddrs []string) Meta {
	return &rpcBasedMeta{
		meta: session.NewMetaManager(metaAddrs, session.NewNodeSession),
	}
}

// Some responses have not only error-code but also a string-type "hint" that can tells the error details.
// This function wraps the "hint" into error.
func wrapHintIntoError(hint string, err error) error {
	if err != nil {
		if hint != "" {
			return fmt.Errorf("%s [hint: %s]", err, hint)
		}
	}
	return err
}

func (m *rpcBasedMeta) Close() error {
	return m.meta.Close()
}

// `callback` always accepts non-nil `resp`.
func (m *rpcBasedMeta) callMeta(methodName string, req interface{}, callback func(resp interface{})) error {
	ctx, cancel := context.WithTimeout(context.Background(), rpcTimeout)
	defer cancel()

	ret := reflect.ValueOf(m.meta).MethodByName(methodName).Call([]reflect.Value{
		reflect.ValueOf(ctx),
		reflect.ValueOf(req),
	})

	// the last returned value is always error
	ierr := ret[len(ret)-1].Interface()
	var err error
	if ierr != nil {
		err = ierr.(error)
	}

	if len(ret) == 1 {
		return err
	}

	// len(ret) == 2
	if !ret[0].IsNil() {
		callback(ret[0].Interface())
	}
	return err
}

func (m *rpcBasedMeta) ListAvailableApps() ([]*admin.AppInfo, error) {
	return m.ListApps(admin.AppStatus_AS_AVAILABLE)
}

func (m *rpcBasedMeta) ListApps(status admin.AppStatus) ([]*admin.AppInfo, error) {
	var result []*admin.AppInfo
	req := &admin.ListAppsRequest{Status: status}
	err := m.callMeta("ListApps", req, func(resp interface{}) {
		result = resp.(*admin.ListAppsResponse).Infos
	})
	return result, err
}

func (m *rpcBasedMeta) QueryConfig(tableName string) (*replication.QueryCfgResponse, error) {
	var result *replication.QueryCfgResponse
	err := m.callMeta("QueryConfig", tableName, func(resp interface{}) {
		result = resp.(*replication.QueryCfgResponse)
	})
	if err == nil {
		if result.GetErr().Errno == base.ERR_OBJECT_NOT_FOUND.String() {
			return nil, fmt.Errorf("table(%s) doesn't exist", tableName)
		}
		if result.GetErr().Errno != base.ERR_OK.String() {
			return nil, fmt.Errorf("query config failed: %s", result.GetErr())
		}
	}
	return result, err
}

func (m *rpcBasedMeta) MetaControl(level admin.MetaFunctionLevel) (oldLevel admin.MetaFunctionLevel, err error) {
	req := &admin.MetaControlRequest{Level: level}
	err = m.callMeta("MetaControl", req, func(resp interface{}) {
		oldLevel = resp.(*admin.MetaControlResponse).OldLevel
	})
	return oldLevel, err
}

func (m *rpcBasedMeta) QueryClusterInfo() (map[string]string, error) {
	result := make(map[string]string)
	req := &admin.ClusterInfoRequest{}
	err := m.callMeta("QueryClusterInfo", req, func(resp interface{}) {
		keys := resp.(*admin.ClusterInfoResponse).Keys
		values := resp.(*admin.ClusterInfoResponse).Values
		for i := range keys {
			result[keys[i]] = values[i]
		}
	})
	return result, err
}

func (m *rpcBasedMeta) updateAppEnvs(req *admin.UpdateAppEnvRequest) error {
	var hint string
	err := m.callMeta("UpdateAppEnv", req, func(resp interface{}) {
		hint = resp.(*admin.UpdateAppEnvResponse).HintMessage
	})
	return wrapHintIntoError(hint, err)
}

func (m *rpcBasedMeta) UpdateAppEnvs(tableName string, envs map[string]string) error {
	var keys []string
	var values []string
	for key, value := range envs {
		keys = append(keys, key)
		values = append(values, value)
	}
	req := &admin.UpdateAppEnvRequest{
		AppName: tableName,
		Op:      admin.AppEnvOperation_APP_ENV_OP_SET,
		Keys:    keys,
		Values:  values,
	}
	return m.updateAppEnvs(req)
}

func (m *rp
```

### Core Architecture Module: `admin-cli/client/migrate_node.go`
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

package client

import (
	"fmt"
	"math/rand"

	"github.com/apache/incubator-pegasus/admin-cli/util"
	"github.com/apache/incubator-pegasus/go-client/idl/admin"
	"github.com/apache/incubator-pegasus/go-client/idl/base"
	"github.com/apache/incubator-pegasus/go-client/idl/replication"
	"github.com/apache/incubator-pegasus/go-client/session"
	log "github.com/sirupsen/logrus"
)

func SetMetaLevelLively(meta Meta) error {
	_, err := meta.MetaControl(admin.MetaFunctionLevel_fl_lively)
	return err
}

func SetMetaLevelSteady(meta Meta) error {
	_, err := meta.MetaControl(admin.MetaFunctionLevel_fl_steady)
	return err
}

func listReplicasOnNode(meta Meta, node *util.PegasusNode, tableName string) ([]*replication.PartitionConfiguration, error) {
	resp, err := meta.QueryConfig(tableName)
	if err != nil {
		return nil, err
	}

	var result []*replication.PartitionConfiguration
	for _, part := range resp.Partitions {
		if part.Primary.GetAddress() == node.TCPAddr() {
			result = append(result, part)
		}
		for _, sec := range part.Secondaries {
			if sec.GetAddress() == node.TCPAddr() {
				result = append(result, part)
				break
			}
		}
	}
	return result, nil
}

func ListPrimariesOnNode(meta Meta, node *util.PegasusNode, tableName string) ([]*replication.PartitionConfiguration, error) {
	resp, err := meta.QueryConfig(tableName)
	if err != nil {
		return nil, err
	}

	var result []*replication.PartitionConfiguration
	for _, part := range resp.Partitions {
		if part.Primary.GetAddress() == node.TCPAddr() {
			result = append(result, part)
		}
	}
	return result, nil
}

func replicaNode(addr *base.RPCAddress) *util.PegasusNode {
	return util.NewNodeFromTCPAddr(addr.GetAddress(), session.NodeTypeReplica)
}

// MigratePrimariesOut migrates all primaries out from the specified node.
// Internally, for every partition it merely swaps the roles of primary and secondary,
// so it incurs no data migration.
// Eventually, the node will have no primaries because they are all turned to secondaries.
func MigratePrimariesOut(meta Meta, node *util.PegasusNode) error {
	cmd := fmt.Sprintf("MigratePrimariesOut from=%s", node.CombinedAddr())
	log.Debug(cmd)

	if err := SetMetaLevelSteady(meta); err != nil {
		return fmt.Errorf("%s failed: %s", cmd, err)
	}

	tables, err := meta.ListAvailableApps()
	if err != nil {
		return fmt.Errorf("%s failed: %s", cmd, err)
	}

	for _, tb := range tables {
		tbCmd := cmd + fmt.Sprintf(" table=%s", tb.AppName)
		log.Debug(tbCmd)

		partitions, err := ListPrimariesOnNode(meta, node, tb.AppName)
		if err != nil {
			return fmt.Errorf("%s failed: %s", tbCmd, err)
		}
		for _, part := range partitions {
			from := node

			secIdx := rand.Intn(len(part.Secondaries))
			sec := part.Secondaries[secIdx]
			to := replicaNode(sec)

			balanceCmd := tbCmd + fmt.Sprintf(" to=%s gpid=%s", to.CombinedAddr(), part.Pid)
			log.Debug(balanceCmd)

			err := meta.Balance(part.Pid, BalanceMovePri, from, to)
			if err != nil {
				return fmt.Errorf("%s failed: %s", balanceCmd, err)
			}
		}
	}
	return nil
}

// DowngradeNode sets all secondaries from the specified node to inactive state.
// NOTE: this step requires that the node has no primary, otherwise error is returned.
func DowngradeNode(meta Meta, node *util.PegasusNode) error {
	return downgradeNode(meta, node, nil)
}

// DowngradeNodeWithDetails is like DowngradeNode but also returns the partitions that were downgraded.
func DowngradeNodeWithDetails(meta Meta, node *util.PegasusNode) ([]*base.Gpid, error) {
	var downgradedParts []*base.Gpid
	err := downgradeNode(meta, node, &downgradedParts)
	if err != nil {
		return nil, err
	}
	return downgradedParts, nil
}

func downgradeNode(meta Meta, node *util.PegasusNode, downgradedParts *[]*base.Gpid) error {
	cmd := fmt.Sprintf("DowngradeNode node=%s", node.CombinedAddr())
	log.Debug(cmd)

	if err := SetMetaLevelSteady(meta); err != nil {
		return fmt.Errorf("%s failed: %s", cmd, err)
	}

	tables, err := meta.ListAvailableApps()
	if err != nil {
		return fmt.Errorf("%s failed: %s", cmd, err)
	}

	for _, tb := range tables {
		tbCmd := cmd + fmt.Sprintf(" table=%s", tb.AppName)
		log.Debug(tbCmd)

		partitions, err := listReplicasOnNode(meta, node, tb.AppName)
		if err != nil {
			return fmt.Errorf("%s failed: %s", tbCmd, err)
		}
		for _, part := range partitions {
			if part.Primary.GetAddress() == node.TCPAddr() {
				return fmt.Errorf("%s failed: no primary should be on this node", tbCmd)
			}

			pri := replicaNode(part.Primary)
			proposeCmd := tbCmd + fmt.Sprintf(" target=%s gpid=%s", pri.CombinedAddr(), part.Pid)
			log.Debug(proposeCmd)

			err := meta.Propose(part.Pid, admin.ConfigType_CT_DOWNGRADE_TO_INACTIVE, pri, node)
			if err != nil {
				return fmt.Errorf("%s failed: %s", proposeCmd, err)
			}

			if downgradedParts != nil {
				*downgradedParts = append(*downgradedParts, part.Pid)
			}
		}
	}
	return nil
}

```

### Core Architecture Module: `admin-cli/client/options.go`
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

package client

import "time"

var rpcTimeout = time.Second * 10

// SetRPCTimeout is the global timeout setting of RPC.
func SetRPCTimeout(d time.Duration) {
	rpcTimeout = d
}

```

### Core Architecture Module: `admin-cli/client/remote_command.go`
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

package client

import (
	"context"
	"fmt"
	"sync"

	"github.com/apache/incubator-pegasus/admin-cli/util"
	adminCli "github.com/apache/incubator-pegasus/go-client/admin"
)

// CmdResult is the result of remote command to a node.
type CmdResult struct {
	resp string
	err  error
}

func (c *CmdResult) String() string {
	if c.err != nil {
		return fmt.Sprintf("failure: %s", c.err)
	}
	return c.resp
}

func (c *CmdResult) Failed() bool {
	return c.err != nil
}

func (c *CmdResult) Error() error {
	return c.err
}

func (c *CmdResult) RespBody() string {
	return c.resp
}

// BatchCallCmd performs remote commands in parallel to multiple nodes.
func BatchCallCmd(nodes []*util.PegasusNode, cmd string, args []string) map[*util.PegasusNode]*CmdResult {
	results := make(map[*util.PegasusNode]*CmdResult)

	rc := &adminCli.RemoteCommand{
		Command:   cmd,
		Arguments: args,
	}

	var mu sync.Mutex
	var wg sync.WaitGroup
	wg.Add(len(nodes))
	for _, n := range nodes {
		go func(node *util.PegasusNode) {
			ctx, cancel := context.WithTimeout(context.Background(), rpcTimeout)
			defer cancel()
			result, err := rc.Call(ctx, node.Session())
			mu.Lock()
			if err != nil {
				results[node] = &CmdResult{err: err}
			} else {
				results[node] = &CmdResult{resp: result}
			}
			mu.Unlock()
			wg.Done()
		}(n)
	}
	wg.Wait()

	return results
}

// CallCmd calls remote command to a single node.
func CallCmd(n *util.PegasusNode, cmd string, args []string) *CmdResult {
	rc := &adminCli.RemoteCommand{
		Command:   cmd,
		Arguments: args,
	}

	ctx, cancel := context.WithTimeout(context.Background(), rpcTimeout)
	defer cancel()
	result, err := rc.Call(ctx, n.Session())
	if err != nil {
		return &CmdResult{err: err}
	}
	return &CmdResult{resp: result}
}

```

### Core Architecture Module: `admin-cli/client/replica_health.go`
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

package client

import (
	"github.com/apache/incubator-pegasus/go-client/idl/admin"
	"github.com/apache/incubator-pegasus/go-client/idl/replication"
)

// TableHealthInfo is a report of replica health within the table.
type TableHealthInfo struct {
	PartitionCount int32
	Unhealthy      int32
	WriteUnhealthy int32
	ReadUnhealthy  int32
	FullHealthy    int32
}

type NodeState struct {
	IPPort string

	Status admin.NodeStatus

	PrimariesNum   int
	SecondariesNum int
	ReplicaCount   int
}

// ClusterReplicaInfo is a report of the replicas distributed in the cluster.
type ClusterReplicaInfo struct {
	Tables []*TableHealthInfo
	Nodes  []*NodeState
}

// GetTableHealthInfo return *TableHealthInfo from meta.
func GetTableHealthInfo(meta Meta, tableName string) (*TableHealthInfo, error) {
	tbHealth, err := aggregateReplicaInfo(meta, tableName, nil)
	if err != nil {
		return nil, err
	}
	return tbHealth, nil
}

func aggregateReplicaInfo(meta Meta, tableName string, nodes *map[string]*NodeState) (*TableHealthInfo, error) {
	resp, err := meta.QueryConfig(tableName)
	if err != nil {
		return nil, err
	}
	if nodes != nil {
		aggregateNodeState(resp, nodes)
	}
	return aggregateTableHealthInfo(resp), nil
}

func aggregateTableHealthInfo(resp *replication.QueryCfgResponse) *TableHealthInfo {
	var fullHealthy, unHealthy, writeUnHealthy, readUnHealthy int32
	for _, partition := range resp.Partitions {
		var replicaCnt int32
		if partition.Primary.GetRawAddress() == 0 {
			writeUnHealthy++
			readUnHealthy++
		} else {
			replicaCnt = int32(len(partition.Secondaries) + 1)
			if replicaCnt >= partition.MaxReplicaCount {
				fullHealthy++
			} else if replicaCnt < 2 {
				writeUnHealthy++
			}
		}
	}

	unHealthy = resp.PartitionCount - fullHealthy
	return &TableHealthInfo{
		PartitionCount: resp.PartitionCount,
		Unhealthy:      unHealthy,
		WriteUnhealthy: writeUnHealthy,
		ReadUnhealthy:  readUnHealthy,
		FullHealthy:    fullHealthy,
	}
}

func aggregateNodeState(resp *replication.QueryCfgResponse, nodesPtr *map[string]*NodeState) {
	nodes := *nodesPtr
	for _, p := range resp.Partitions {
		if p.Primary.GetRawAddress() != 0 {
			naddr := p.Primary.GetAddress()
			nodes[naddr].PrimariesNum++
			nodes[naddr].ReplicaCount++
		}
		for _, sec := range p.Secondaries {
			naddr := sec.GetAddress()
			nodes[naddr].SecondariesNum++
			nodes[naddr].ReplicaCount++
		}
	}
}

// GetClusterReplicaInfo returns replica info in both node and table perspectives.
// = From node perspective, it returns a list of node states, each contains the replica details,
// including those with no replicas (empty node).
// = From table perspective, it returns a list of table states, each contains the partition health information.
func GetClusterReplicaInfo(meta Meta) (*ClusterReplicaInfo, error) {
	c := &ClusterReplicaInfo{}

	metaTables, err := meta.ListAvailableApps()
	if err != nil {
		return nil, err
	}

	// initialize the nodes in the cluster
	metaNodes, err := meta.ListNodes()
	if err != nil {
		return nil, err
	}
	nodesMap := map[string]*NodeState{}
	for _, node := range metaNodes {
		ipPort := node.GetAddress().GetAddress()
		nodesMap[ipPort] = &NodeState{
			IPPort: ipPort,
			Status: node.Status,
		}
	}

	for _, tb := range metaTables {
		tbHealthInfo, err := aggregateReplicaInfo(meta, tb.AppName, &nodesMap)
		if err != nil {
			return nil, err
		}
		c.Tables = append(c.Tables, tbHealthInfo)
	}

	for _, node := range nodesMap {
		c.Nodes = append(c.Nodes, node)
	}

	return c, nil
}

// ListNodesReplicaInfo returns how replicas distributed among nodes.
func ListNodesReplicaInfo(meta Meta) ([]*NodeState, error) {
	c, err := GetClusterReplicaInfo(meta)
	if err != nil {
		return nil, err
	}
	return c.Nodes, nil
}

```

### Core Architecture Module: `admin-cli/cmd/backup_restore.go`
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

import (
	"fmt"

	"github.com/apache/incubator-pegasus/admin-cli/executor"
	"github.com/apache/incubator-pegasus/admin-cli/shell"
	"github.com/desertbit/grumble"
)

func init() {

	shell.AddCommand(&grumble.Command{
		Name:  "backup",
		Help:  "backup a table",
		Usage: "backup <TABLE_ID> <PROVIDER_TYPE> [SPECIFIC_BACKUP_PATH]",

		Args: func(a *grumble.Args) {
			a.Int("tableID", "the table ID")
			a.String("providerType", "the provider type of backup")
			a.String("backupPath", "the user specified backup path", grumble.Default(""))
		},
		Run: func(c *grumble.Context) error {
			tableID := c.Args.Int("tableID")
			providerType := c.Args.String("providerType")
			backupPath := c.Args.String("backupPath")
			return executor.BackupTable(pegasusClient, tableID, providerType, backupPath)
		},
	})

	shell.AddCommand(&grumble.Command{
		Name:  "query-backup-status",
		Help:  "query backup status",
		Usage: "query-backup-status <TABLE_ID> [BACKUP_ID]",
		Args: func(a *grumble.Args) {
			a.Int("tableID", "the table ID")
			a.Int64("backupID", "the backup ID", grumble.Default(int64(0)))
		},
		Run: func(c *grumble.Context) error {
			tableID := c.Args.Int("tableID")
			backupID := c.Args.Int64("backupID")
			return executor.QueryBackupStatus(pegasusClient, tableID, backupID)
		},
	})

	shell.AddCommand(&grumble.Command{
		Name: "restore",
		Help: "restore a table",
		Usage: `restore 
		<-c|--oldClusterName OLD_CLUSTER_NAME> 
		<-a|--oldTableName OLD_TABLE_NAME> 
		<-i|--oldTableID OLD_TABLE_ID>
		<-t|--timestamp TIMESTAMP/BACKUP_ID>
		<-b|--providerType PROVIDER_TYPE>
		[-n|--newTableName NEW_TABLE_NAME]
		[-r|--restorePath SPECIFIC_RESTORE_PATH]
		[-s|--skipBadPartition SKIP_BAD_PARTITION]
		[-p|--policyName POLICY_NAME]`,
		Run: func(c *grumble.Context) error {
			if c.Flags.String("oldClusterName") == "" {
				return fmt.Errorf("oldClusterName cannot be empty")
			}
			if c.Flags.String("oldTableName") == "" {
				return fmt.Errorf("oldTableName cannot be empty")
			}
			if c.Flags.Int("oldTableID") == 0 {
				return fmt.Errorf("oldTableID cannot be empty")
			}
			if c.Flags.Int64("timestamp") == 0 {
				return fmt.Errorf("timestamp cannot be empty")
			}
			if c.Flags.String("providerType") == "" {
				return fmt.Errorf("providerType cannot be empty")
			}
			var newName string
			if c.Flags.String("newTableName") == "" {
				newName = c.Flags.String("oldTableName")
			} else {
				newName = c.Flags.String("newTableName")
			}
			oldClusterName := c.Flags.String("oldClusterName")
			oldTableName := c.Flags.String("oldTableName")
			oldTableID := c.Flags.Int("oldTableID")
			backupID := c.Flags.Int64("timestamp")
			providerType := c.Flags.String("providerType")
			newTableName := newName
			restorePath := c.Flags.String("restorePath")
			skipBadPartition := c.Flags.Bool("skipBadPartition")
			policyName := c.Flags.String("policyName")
			return executor.RestoreTable(pegasusClient, oldClusterName, oldTableName,
				oldTableID, backupID, providerType, newTableName, restorePath, skipBadPartition, policyName)
		},
		Flags: func(f *grumble.Flags) {
			/*define the flags*/
			f.String("c", "oldClusterName", "", "old_cluster_name, for example, onebox")
			f.String("a", "oldTableName", "", "old_app_name, for example, temp")
			f.Int("i", "oldTableID", 0, "old_app_id, for example, 1")
			f.Int64("t", "timestamp", 0, "timestamp or backup_id")
			f.String("b", "providerType", "", "backup_provider_type, for example, hdfs_zjy")
			f.String("n", "newTableName", "", "new_app_name")
			f.String("r", "restorePath", "", "restore_path")
			f.Bool("s", "skipBadPartition", false, "whether to skip bad partition when create new table")
			f.String("p", "policyName", "", "old_policy_name, only worked for restoring app created before Pegasus2.2.0")
		},
	})
}

```

### Core Architecture Module: `admin-cli/cmd/bulk_load.go`
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

import (
	"fmt"

	"github.com/apache/incubator-pegasus/admin-cli/executor"
	"github.com/apache/incubator-pegasus/admin-cli/shell"
	"github.com/desertbit/grumble"
)

func init() {
	rootCmd := &grumble.Command{
		Name: "bulk-load",
		Help: "bulk load related commands",
	}

	rootCmd.AddCommand(&grumble.Command{
		Name:  "start",
		Help:  "start bulk load for a specific table",
		Usage: `start <-a|--tableName TABLE_NAME> <-c|--clusterName CLUSTER_NAME> <-p|--providerType PROVIDER_TYPE> <-r|--rootPath ROOT_PATH>`,
		Run: func(c *grumble.Context) error {
			if c.Flags.String("tableName") == "" {
				return fmt.Errorf("tableName cannot be empty")
			}
			if c.Flags.String("clusterName") == "" {
				return fmt.Errorf("clusterName cannot be empty")
			}
			if c.Flags.String("providerType") == "" {
				return fmt.Errorf("providerType cannot be empty")
			}
			if c.Flags.String("rootPath") == "" {
				return fmt.Errorf("rootPath cannot be empty")
			}
			tableName := c.Flags.String("tableName")
			clusterName := c.Flags.String("clusterName")
			providerType := c.Flags.String("providerType")
			rootPath := c.Flags.String("rootPath")
			return executor.StartBulkLoad(pegasusClient, tableName, clusterName, providerType, rootPath)
		},
		Flags: func(f *grumble.Flags) {
			/*define the flags*/
			f.String("a", "tableName", "", "table name")
			f.String("c", "clusterName", "", "cluster name")
			f.String("p", "providerType", "", "remote provider type")
			f.String("r", "rootPath", "", "remote root path")
		},
	})

	rootCmd.AddCommand(&grumble.Command{
		Name:  "query",
		Help:  "query bulk load status for a specific table or a specific partition",
		Usage: `query <-a|--tableName TABLE_NAME> [-i|--partitionIndex PARTITION_INDEX] [-d|--detailed SHOW_DETAILED_BULK_LOAD_STATUS]`,
		Run: func(c *grumble.Context) error {
			if c.Flags.String("tableName") == "" {
				return fmt.Errorf("tableName cannot be empty")
			}
			tableName := c.Flags.String("tableName")
			partitionIndex := c.Flags.Int("partitionIndex")
			detailed := c.Flags.Bool("detailed")
			return executor.QueryBulkLoad(pegasusClient, tableName, partitionIndex, detailed)
		},
		Flags: func(f *grumble.Flags) {
			/*define the flags*/
			f.String("a", "tableName", "", "table name")
			f.Int("i", "partitionIndex", -1, "partition index, default value is -1, meaning show all partitions status")
			f.Bool("d", "detailed", false, "show detailed bulk load status, default value is false")
		},
	})

	rootCmd.AddCommand(&grumble.Command{
		Name:  "pause",
		Help:  "pause bulk load for a specific table",
		Usage: "pause <-a|--tableName TABLE_NAME>",
		Run: func(c *grumble.Context) error {
			if c.Flags.String("tableName") == "" {
				return fmt.Errorf("tableName cannot be empty")
			}
			tableName := c.Flags.String("tableName")
			return executor.PauseBulkLoad(pegasusClient, tableName)
		},
		Flags: func(f *grumble.Flags) {
			/*define the flags*/
			f.String("a", "tableName", "", "table name")
		},
	})

	rootCmd.AddCommand(&grumble.Command{
		Name:  "restart",
		Help:  "restart bulk load for a specific table",
		Usage: "restart <-a|--tableName TABLE_NAME>",
		Run: func(c *grumble.Context) error {
			if c.Flags.String("tableName") == "" {
				return fmt.Errorf("tableName cannot be empty")
			}
			tableName := c.Flags.String("tableName")
			return executor.RestartBulkLoad(pegasusClient, tableName)
		},
		Flags: func(f *grumble.Flags) {
			/*define the flags*/
			f.String("a", "tableName", "", "table name")
		},
	})

	rootCmd.AddCommand(&grumble.Command{
		Name:  "cancel",
		Help:  "cancel bulk load for a specific table",
		Usage: "cancel <-a|--tableName TABLE_NAME> [-f|--forced FORCED]",
		Run: func(c *grumble.Context) error {
			if c.Flags.String("tableName") == "" {
				return fmt.Errorf("tableName cannot be empty")
			}
			tableName := c.Flags.String("tableName")
			forced := c.Flags.Bool("forced")
			return executor.CancelBulkLoad(pegasusClient, tableName, forced)
		},
		Flags: func(f *grumble.Flags) {
			/*define the flags*/
			f.String("a", "tableName", "", "table name")
			f.Bool("f", "forced", false, "force cancel bulk load")
		},
	})

	rootCmd.AddCommand(&grumble.Command{
		Name:  "clear",
		Help:  "clear bulk load for a specific table",
		Usage: "clear <-a|--tableName TABLE_NAME>",
		Run: func(c *grumble.Context) error {
			if c.Flags.String("tableName") == "" {
				return fmt.Errorf("tableName cannot be empty")
			}
			tableName := c.Flags.String("tableName")
			return executor.ClearBulkLoad(pegasusClient, tableName)
		},
		Flags: func(f *grumble.Flags) {
			/*define the flags*/
			f.String("a", "tableName", "", "table name")
		},
	})

	shell.AddCommand(rootCmd)
}

```

### Core Architecture Module: `admin-cli/cmd/cluster_info.go`
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

import (
	"github.com/apache/incubator-pegasus/admin-cli/executor"
	"github.com/apache/incubator-pegasus/admin-cli/shell"

	"github.com/desertbit/grumble"
)

func init() {
	shell.AddCommand(&grumble.Command{
		Name: "cluster-info",
		Help: "displays the overall cluster information",
		Run: func(c *grumble.Context) error {
			return executor.ClusterInfo(pegasusClient)
		},
	})
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

### Incident Patch 5: `23f58920` (2026-01-27)
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
+    // Get bytes from the last buffer(namely current buffer)
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
+    // Write the length of `
```

---

### Incident Patch 6: `b507fd36` (2026-01-09)
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

---

### Incident Patch 7: `abddf21a` (2026-01-05)
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

### Incident Patch 8: `90093402` (2025-11-25)
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

### Incident Patch 9: `e56cccb4` (2025-11-19)
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

### Incident Patch 10: `5eb1665e` (2025-11-12)
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
