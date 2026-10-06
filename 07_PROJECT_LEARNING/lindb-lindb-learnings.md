# Forensic Learning Record (Deep Inspection): lindb/lindb

> **Canonical Artifact**: `07_PROJECT_LEARNING/lindb-lindb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/lindb/lindb](https://github.com/lindb/lindb))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:22:54.422Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `lindb/lindb`
- **Description**: LinDB is a scalable, high performance, high availability distributed time series database.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 3065 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `app/broker/api/exec/command/state.go`
```
// Licensed to LinDB under one or more contributor
// license agreements. See the NOTICE file distributed with
// this work for additional information regarding copyright
// ownership. LinDB licenses this file to you under
// the Apache License, Version 2.0 (the "License"); you may
// not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

package command

import (
	"context"
	"sync"

	"github.com/go-resty/resty/v2"

	"github.com/lindb/common/pkg/logger"

	depspkg "github.com/lindb/lindb/app/broker/deps"
	"github.com/lindb/lindb/constants"
	"github.com/lindb/lindb/internal/client"
	"github.com/lindb/lindb/models"
	stmtpkg "github.com/lindb/lindb/sql/stmt"
)

var (
	metricCli = client.NewMetricCli()
)

// StateCommand executes the state query.
func StateCommand(_ context.Context, deps *depspkg.HTTPDeps,
	_ *models.ExecuteParam, stmt stmtpkg.Statement) (interface{}, error) {
	stateStmt := stmt.(*stmtpkg.State)
	switch stateStmt.Type {
	case stmtpkg.Master:
		return deps.Master.GetMaster(), nil
	case stmtpkg.BrokerAlive:
		return deps.StateMgr.GetLiveNodes(), nil
	case stmtpkg.StorageAlive:
		return deps.StateMgr.GetStorage(), nil
	case stmtpkg.Replication:
		return getStateFromStorage(deps, stateStmt, "/state/replica", func() interface{} {
			var state []models.FamilyLogReplicaState
			return &state
		})
	case stmtpkg.MemoryDatabase:
		return getStateFromStorage(deps, stateStmt, "/state/tsdb/memory", func() interface{} {
			var state []models.DataFamilyState
			return &state
		})
	case stmtpkg.BrokerMetric:
		liveNodes := deps.StateMgr.GetLiveNodes()
		var nodes []models.Node
		for idx := range liveNodes {
			nodes = append(nodes, &liveNodes[idx])
		}
		return metricCli.FetchMetricData(nodes, stateStmt.MetricNames)
	case stmtpkg.StorageMetric:
		storage := deps.StateMgr.GetStorage()
		liveNodes := storage.LiveNodes
		var nodes []models.Node
		for id := range liveNodes {
			n := liveNodes[id]
			nodes = append(nodes, &n)
		}
		return metricCli.FetchMetricData(nodes, stateStmt.MetricNames)
	default:
		return nil, nil
	}
}

// getStateFromStorage returns the state from storage cluster.
func getStateFromStorage(deps *depspkg.HTTPDeps, stmt *stmtpkg.State, path string, newStateFn func() interface{}) (interface{}, error) {
	storage := deps.StateMgr.GetStorage()
	liveNodes := storage.LiveNodes
	var nodes []models.Node
	for id := range liveNodes {
		n := liveNodes[id]
		nodes = append(nodes, &n)
	}
	return fetchStateData(nodes, stmt, path, newStateFn)
}

// fetchStateData fetches the state metric from each live node.
func fetchStateData(nodes []models.Node, stmt *stmtpkg.State, path string, newStateFn func() interface{}) (interface{}, error) {
	size := len(nodes)
	if size == 0 {
		return nil, nil
	}
	result := make([]interface{}, size)
	var wait sync.WaitGroup
	wait.Add(size)
	for idx := range nodes {
		i := idx
		go func() {
			defer wait.Done()
			node := nodes[i]
			address := node.HTTPAddress()
			state := newStateFn()
			_, err := resty.New().R().SetQueryParams(map[string]string{"db": stmt.Database}).
				SetHeader("Accept", "application/json").
				SetResult(&state).
				Get(address + constants.APIVersion1CliPath + path)
			if err != nil {
				log.Error("get state from storage node", logger.String("url", address), logger.Error(err))
				return
			}
			result[i] = state
		}()
	}
	wait.Wait()
	rs := make(map[string]interface{})
	for idx := range nodes {
		rs[nodes[idx].Indicator()] = result[idx]
	}
	return rs, nil
}

```

### Core Architecture Module: `app/broker/api/prometheus/util.go`
```
// Licensed to LinDB under one or more contributor
// license agreements. See the NOTICE file distributed with
// this work for additional information regarding copyright
// ownership. LinDB licenses this file to you under
// the Apache License, Version 2.0 (the "License"); you may
// not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

package prometheus

import (
	"errors"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"time"

	"github.com/prometheus/common/model"
	"github.com/prometheus/prometheus/model/labels"
	"github.com/prometheus/prometheus/prompb"
	"github.com/prometheus/prometheus/promql"
	"github.com/prometheus/prometheus/promql/parser"

	stmtpkg "github.com/lindb/lindb/sql/stmt"
)

func parseTimeParam(r *http.Request, paramName string, defaultValue time.Time) (time.Time, error) {
	val := r.FormValue(paramName)
	if val == "" {
		return defaultValue, nil
	}
	result, err := parseTime(val)
	if err != nil {
		return time.Time{}, fmt.Errorf("invalid time value for '%s', err:%w", paramName, err)
	}
	return result, nil
}

func parseTime(s string) (time.Time, error) {
	if t, err := strconv.ParseFloat(s, 64); err == nil {
		s, ns := math.Modf(t)
		ns = math.Round(ns*1000) / 1000
		return time.Unix(int64(s), int64(ns*float64(time.Second))).UTC(), nil
	}
	if t, err := time.Parse(time.RFC3339Nano, s); err == nil {
		return t, nil
	}

	// Stdlib's time parser can only handle 4 digit years. As a workaround until
	// that is fixed we want to at least support our own boundary times.
	// Context: https://github.com/prometheus/client_golang/issues/614
	// Upstream issue: https://github.com/golang/go/issues/20555
	switch s {
	case minTimeFormatted:
		return MinTime, nil
	case maxTimeFormatted:
		return MaxTime, nil
	}
	return time.Time{}, fmt.Errorf("cannot parse %q to a valid timestamp", s)
}

func parseDuration(s string) (time.Duration, error) {
	if d, err := strconv.ParseFloat(s, 64); err == nil {
		ts := d * float64(time.Second)
		if ts > float64(math.MaxInt64) || ts < float64(math.MinInt64) {
			return 0, fmt.Errorf("cannot parse %q to a valid duration. It overflows int64", s)
		}
		return time.Duration(ts), nil
	}
	if d, err := model.ParseDuration(s); err == nil {
		return time.Duration(d), nil
	}
	return 0, fmt.Errorf("cannot parse %q to a valid duration", s)
}

func invalidParamError(err error, parameter string) apiFuncResult {
	return apiFuncResult{nil, &apiError{
		errorBadData, fmt.Errorf("invalid parameter %q, err: %w", parameter, err),
	}, nil, nil}
}

func unavailableError(err error) apiFuncResult {
	return apiFuncResult{
		err: &apiError{
			typ: errorUnavailable,
			err: err,
		},
	}
}

func extractQueryOpts(r *http.Request) (promql.QueryOpts, error) {
	var duration time.Duration

	if strDuration := r.FormValue("lookback_delta"); strDuration != "" {
		parsedDuration, err := parseDuration(strDuration)
		if err != nil {
			return nil, fmt.Errorf("error parsing lookback delta duration: %w", err)
		}
		duration = parsedDuration
	}

	return promql.NewPrometheusQueryOpts(r.FormValue("stats") == "all", duration), nil
}

func parseMatchersParam(matchers []string) ([][]*labels.Matcher, error) {
	var matcherSets [][]*labels.Matcher
	for _, s := range matchers {
		matchers, err := parser.ParseMetricSelector(s)
		if err != nil {
			return nil, err
		}
		matcherSets = append(matcherSets, matchers)
	}

OUTER:
	for _, ms := range matcherSets {
		for _, lm := range ms {
			if lm != nil && !lm.Matches("") {
				continue OUTER
			}
		}
		return nil, errors.New("match[] must contain at least one non-empty matcher")
	}
	return matcherSets, nil
}

// walkMatcher iterates matchers and make binary tree.
func walkMatcher(root *stmtpkg.BinaryExpr, matchers []*labels.Matcher) {
	if root == nil || len(matchers) == 0 {
		return
	}
	if root.Left == nil {
		root.Left = &stmtpkg.EqualsExpr{
			Key:   matchers[0].Name,
			Value: matchers[0].Value,
		}
	} else if root.Right == nil {
		if len(matchers) > 1 {
			expr := &stmtpkg.BinaryExpr{
				Left: &stmtpkg.EqualsExpr{
					Key:   matchers[0].Name,
					Value: matchers[0].Value,
				},
				Operator: stmtpkg.ADD,
			}
			root.Right = expr
			root = expr
		} else {
			root.Right = &stmtpkg.EqualsExpr{
				Key:   matchers[0].Name,
				Value: matchers[0].Value,
			}
		}
	}

	matchers = matchers[1:]
	walkMatcher(root, matchers)
}

// makeCondition extracts metric name and condition from matchers.
func makeCondition(matchers ...*labels.Matcher) (metricName string, expr stmtpkg.Expr) {
	pureMatchers := make([]*labels.Matcher, 0, len(matchers)-1)
	for index := range matchers {
		matcher := matchers[index]
		if matcher.Name == metricLabelName {
			metricName = matcher.Value
		} else {
			pureMatchers = append(pureMatchers, matcher)
		}
	}

	switch len(pureMatchers) {
	case 0:
		return metricName, nil
	case 1:
		return metricName, &stmtpkg.EqualsExpr{
			Key:   pureMatchers[0].Name,
			Value: pureMatchers[0].Value,
		}
	default:
		e := &stmtpkg.BinaryExpr{Operator: stmtpkg.ADD}
		walkMatcher(e, pureMatchers)
		return metricName, e
	}
}

func labelProtosToLabels(labelPairs []prompb.Label) labels.Labels {
	b := labels.ScratchBuilder{}
	for _, l := range labelPairs {
		b.Add(l.Name, l.Value)
	}
	b.Sort()
	return b.Labels()
}

```

### Core Architecture Module: `app/broker/api/state/state_machine.go`
```
// Licensed to LinDB under one or more contributor
// license agreements. See the NOTICE file distributed with
// this work for additional information regarding copyright
// ownership. LinDB licenses this file to you under
// the Apache License, Version 2.0 (the "License"); you may
// not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

package state

import (
	"sort"

	"github.com/gin-gonic/gin"

	"github.com/lindb/common/pkg/http"
	"github.com/lindb/common/pkg/logger"

	depspkg "github.com/lindb/lindb/app/broker/deps"
	"github.com/lindb/lindb/constants"
	"github.com/lindb/lindb/internal/client"
	"github.com/lindb/lindb/models"
	stmtpkg "github.com/lindb/lindb/sql/stmt"
)

var (
	ExplorePath = "/state/machine/explore"
)

type Param struct {
	Type        string               `form:"type" binding:"required"`
	Role        stmtpkg.MetadataType `form:"role" binding:"required"`
	StorageName string               `form:"storageName"`
}

// BrokerStateMachineAPI represents state machine explore api.
type BrokerStateMachineAPI struct {
	deps   *depspkg.HTTPDeps
	cli    client.StateMachineCli
	logger logger.Logger
}

// NewBrokerStateMachineAPI creates broker state machine api instance.
func NewBrokerStateMachineAPI(deps *depspkg.HTTPDeps) *BrokerStateMachineAPI {
	return &BrokerStateMachineAPI{
		deps:   deps,
		cli:    client.NewStateMachineCli(),
		logger: logger.GetLogger("Broker", "StateMachineAPI"),
	}
}

// Register adds state machine url route.
func (api *BrokerStateMachineAPI) Register(route gin.IRoutes) {
	route.GET(ExplorePath, api.Explore)
}

// Explore explores the state from state machine of broker/master/storage.
func (api *BrokerStateMachineAPI) Explore(c *gin.Context) {
	param := &Param{}
	err := c.ShouldBindQuery(param)
	if err != nil {
		http.Error(c, err)
		return
	}
	switch param.Role {
	case stmtpkg.BrokerMetadata:
		api.exploreBroker(c, param)
	case stmtpkg.MasterMetadata:
		api.exploreMaster(c, param)
	case stmtpkg.StorageMetadata:
		stateMgr := api.deps.Master.GetStateManager()
		storageCluster := stateMgr.GetStorageCluster()
		if storageCluster == nil {
			http.NotFound(c)
			return
		}
		liveNodes, err := storageCluster.GetLiveNodes()
		if err != nil {
			http.Error(c, err)
			return
		}
		var nodes []models.Node
		for idx := range liveNodes {
			nodes = append(nodes, &liveNodes[idx])
		}
		http.OK(c, api.cli.FetchStateByNodes(map[string]string{"type": param.Type}, nodes))
	default:
		http.NotFound(c)
	}
}

// exploreMaster explores the state from state machine of master.
func (api *BrokerStateMachineAPI) exploreMaster(c *gin.Context, param *Param) {
	switch param.Type {
	case constants.StorageState:
		http.OK(c, []*models.StorageState{api.deps.Master.GetStateManager().GetStorageState()})
	case constants.DatabaseConfig:
		api.writeDatabaseState(c, api.deps.Master.GetStateManager().GetDatabases())
	case constants.ShardAssignment:
		shardAssignments := api.deps.Master.GetStateManager().GetShardAssignments()
		sort.Slice(shardAssignments, func(i, j int) bool {
			return shardAssignments[i].Name < shardAssignments[j].Name
		})
		http.OK(c, shardAssignments)
	case constants.Master:
		// return master slice, because common logic read state from repo.
		http.OK(c, []*models.Master{api.deps.Master.GetMaster()})
	default:
		http.NotFound(c)
	}
}

// exploreMaster explores the state from state machine of broker.
func (api *BrokerStateMachineAPI) exploreBroker(c *gin.Context, param *Param) {
	switch param.Type {
	case constants.StorageState:
		http.OK(c, []*models.StorageState{api.deps.StateMgr.GetStorage()})
	case constants.LiveNode:
		nodes := api.deps.StateMgr.GetLiveNodes()
		sort.Slice(nodes, func(i, j int) bool {
			return nodes[i].Indicator() < nodes[j].Indicator()
		})
		http.OK(c, nodes)
	case constants.DatabaseConfig:
		api.writeDatabaseState(c, api.deps.StateMgr.GetDatabases())
	default:
		http.NotFound(c)
	}
}

// writeDatabaseState writes response with database.
func (api *BrokerStateMachineAPI) writeDatabaseState(c *gin.Context, dbs []models.Database) {
	sort.Slice(dbs, func(i, j int) bool {
		return dbs[i].Name < dbs[j].Name
	})
	http.OK(c, dbs)
}

```

### Core Architecture Module: `app/root/api/command/state.go`
```
// Licensed to LinDB under one or more contributor
// license agreements. See the NOTICE file distributed with
// this work for additional information regarding copyright
// ownership. LinDB licenses this file to you under
// the Apache License, Version 2.0 (the "License"); you may
// not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

package command

import (
	"context"

	depspkg "github.com/lindb/lindb/app/root/deps"
	"github.com/lindb/lindb/internal/client"
	"github.com/lindb/lindb/models"
	stmtpkg "github.com/lindb/lindb/sql/stmt"
)

var (
	metricCli = client.NewMetricCli()
)

// StateCommand executes the state query.
func StateCommand(_ context.Context, deps *depspkg.HTTPDeps,
	_ *models.ExecuteParam, stmt stmtpkg.Statement) (interface{}, error) {
	stateStmt := stmt.(*stmtpkg.State)
	switch stateStmt.Type {
	case stmtpkg.RootAlive:
		return deps.StateMgr.GetLiveNodes(), nil
	case stmtpkg.BrokerAlive:
		return deps.StateMgr.GetBrokerStates(), nil
	case stmtpkg.RootMetric:
		liveNodes := deps.StateMgr.GetLiveNodes()
		var nodes []models.Node
		for idx := range liveNodes {
			nodes = append(nodes, &liveNodes[idx])
		}
		return metricCli.FetchMetricData(nodes, stateStmt.MetricNames)
	default:
		return nil, nil
	}
}

```

### Core Architecture Module: `app/root/api/state/state_machine.go`
```
// Licensed to LinDB under one or more contributor
// license agreements. See the NOTICE file distributed with
// this work for additional information regarding copyright
// ownership. LinDB licenses this file to you under
// the Apache License, Version 2.0 (the "License"); you may
// not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

package state

import (
	"github.com/gin-gonic/gin"

	"github.com/lindb/common/pkg/http"
	"github.com/lindb/common/pkg/logger"

	depspkg "github.com/lindb/lindb/app/root/deps"
	"github.com/lindb/lindb/constants"
)

var (
	ExplorePath = "/state/machine/explore"
)

type Param struct {
	Type       string `form:"type" binding:"required"`
	BrokerName string `form:"brokerName"`
}

// RootStateMachineAPI represents state machine explore api.
type RootStateMachineAPI struct {
	deps   *depspkg.HTTPDeps
	logger logger.Logger
}

// NewRootStateMachineAPI creates root state machine api instance.
func NewRootStateMachineAPI(deps *depspkg.HTTPDeps) *RootStateMachineAPI {
	return &RootStateMachineAPI{
		deps:   deps,
		logger: logger.GetLogger("Root", "StateMachineAPI"),
	}
}

// Register adds state machine url route.
func (api *RootStateMachineAPI) Register(route gin.IRoutes) {
	route.GET(ExplorePath, api.Explore)
}

// Explore explores the state from state machine of broker/live node/database.
func (api *RootStateMachineAPI) Explore(c *gin.Context) {
	param := &Param{}
	err := c.ShouldBindQuery(param)
	if err != nil {
		http.Error(c, err)
		return
	}
	switch param.Type {
	case constants.BrokerState:
		if param.BrokerName != "" {
			state, ok := api.deps.StateMgr.GetBrokerState(param.BrokerName)
			if ok {
				http.OK(c, state)
			} else {
				http.NotFound(c)
			}
		} else {
			http.OK(c, api.deps.StateMgr.GetBrokerStates())
		}
	case constants.LiveNode:
		http.OK(c, api.deps.StateMgr.GetLiveNodes())
	case constants.DatabaseConfig:
		http.OK(c, api.deps.StateMgr.GetDatabases())
	default:
		http.NotFound(c)
	}
}

```

### Core Architecture Module: `app/storage/api/state/metadata.go`
```
// Licensed to LinDB under one or more contributor
// license agreements. See the NOTICE file distributed with
// this work for additional information regarding copyright
// ownership. LinDB licenses this file to you under
// the Apache License, Version 2.0 (the "License"); you may
// not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

package state

import (
	"github.com/gin-gonic/gin"

	httppkg "github.com/lindb/common/pkg/http"

	"github.com/lindb/lindb/models"
	"github.com/lindb/lindb/tsdb"
)

var (
	DatabaseCfgPath = "/state/metadata/local/database/config"
)

// MetadataAPI represents internal metadata state rest api.
type MetadataAPI struct {
	engine tsdb.Engine
}

// NewMetadataAPI creates a metadata api instance.
func NewMetadataAPI(engine tsdb.Engine) *MetadataAPI {
	return &MetadataAPI{
		engine: engine,
	}
}

// Register adds metadata api url route.
func (m *MetadataAPI) Register(route gin.IRoutes) {
	route.GET(DatabaseCfgPath, m.GetLocalAllDatabaseCfg)
}

// GetLocalAllDatabaseCfg returns the configuration map of all local databases.
func (m *MetadataAPI) GetLocalAllDatabaseCfg(c *gin.Context) {
	databases := m.engine.GetAllDatabases()
	cfgMap := make(map[string]models.DatabaseConfig)
	for name, db := range databases {
		cfgMap[name] = *db.GetConfig()
	}
	httppkg.OK(c, cfgMap)
}

```

### Core Architecture Module: `app/storage/api/state/replica.go`
```
// Licensed to LinDB under one or more contributor
// license agreements. See the NOTICE file distributed with
// this work for additional information regarding copyright
// ownership. LinDB licenses this file to you under
// the Apache License, Version 2.0 (the "License"); you may
// not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

package state

import (
	"github.com/gin-gonic/gin"

	httppkg "github.com/lindb/common/pkg/http"
	"github.com/lindb/common/pkg/logger"

	"github.com/lindb/lindb/replica"
)

var (
	ReplicaPath = "/state/replica"
)

// ReplicaAPI represents internal replica state rest api.
type ReplicaAPI struct {
	walMgr replica.WriteAheadLogManager
	logger logger.Logger
}

// NewReplicaAPI creates a replica state api instance.
func NewReplicaAPI(walMgr replica.WriteAheadLogManager) *ReplicaAPI {
	return &ReplicaAPI{
		walMgr: walMgr,
		logger: logger.GetLogger("Storage", "ReplicaAPI"),
	}
}

// Register adds explore url route.
func (d *ReplicaAPI) Register(route gin.IRoutes) {
	route.GET(ReplicaPath, d.GetReplicaState)
}

// GetReplicaState returns replica state by given database's name.
func (d *ReplicaAPI) GetReplicaState(c *gin.Context) {
	var param struct {
		DB string `form:"db" binding:"required"`
	}
	err := c.ShouldBindQuery(&param)
	if err != nil {
		httppkg.Error(c, err)
		return
	}
	rs := d.walMgr.GetReplicaState(param.DB)
	httppkg.OK(c, rs)
}

```

### Core Architecture Module: `app/storage/api/state/request.go`
```
// Licensed to LinDB under one or more contributor
// license agreements. See the NOTICE file distributed with
// this work for additional information regarding copyright
// ownership. LinDB licenses this file to you under
// the Apache License, Version 2.0 (the "License"); you may
// not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

package state

import (
	"github.com/gin-gonic/gin"

	httppkg "github.com/lindb/common/pkg/http"

	"github.com/lindb/lindb/query"
)

const (
	RequestPath  = "/state/request"
	RequestsPath = "/state/requests"
)

// RequestAPI represents lin query request stats related api.
type RequestAPI struct {
}

// NewRequestAPI creates a RequestAPI instance.
func NewRequestAPI() *RequestAPI {
	return &RequestAPI{}
}

// Register adds request api route.
func (r *RequestAPI) Register(route gin.IRoutes) {
	route.GET(RequestPath, r.GetRequestState)
	route.GET(RequestsPath, r.GetAllAliveRequests)
}

// GetRequestState returns request stats by given request id.
func (r *RequestAPI) GetRequestState(c *gin.Context) {
	var param struct {
		RequestID string `form:"requestId" binding:"required"`
	}
	err := c.ShouldBindQuery(&param)
	if err != nil {
		httppkg.Error(c, err)
		return
	}
	pipeline := query.GetPipelineManager().GetPipeline(param.RequestID)
	if pipeline == nil {
		httppkg.NotFound(c)
		return
	}
	httppkg.OK(c, pipeline.Stats())
}

// GetAllAliveRequests returns all alive requests.
func (r *RequestAPI) GetAllAliveRequests(c *gin.Context) {
	httppkg.OK(c, query.GetPipelineManager().GetAllAlivePipelines())
}

```

### Core Architecture Module: `app/storage/api/state/state_machine.go`
```
// Licensed to LinDB under one or more contributor
// license agreements. See the NOTICE file distributed with
// this work for additional information regarding copyright
// ownership. LinDB licenses this file to you under
// the Apache License, Version 2.0 (the "License"); you may
// not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

package state

import (
	"sort"

	"github.com/gin-gonic/gin"

	"github.com/lindb/common/pkg/http"
	"github.com/lindb/common/pkg/logger"

	"github.com/lindb/lindb/constants"
	"github.com/lindb/lindb/coordinator/storage"
)

var (
	ExplorePath = "/state/machine/explore"
)

type param struct {
	Type string `form:"type" binding:"required"`
}

type StorageStateMachineAPI struct {
	stateMgr storage.StateManager
	logger   logger.Logger
}

// NewStorageStateMachineAPI creates storage state machine api instance.
func NewStorageStateMachineAPI(stateMgr storage.StateManager) *StorageStateMachineAPI {
	return &StorageStateMachineAPI{
		stateMgr: stateMgr,
		logger:   logger.GetLogger("Storage", "StateMachineAPI"),
	}
}

// Register adds state machine url route.
func (api *StorageStateMachineAPI) Register(route gin.IRoutes) {
	route.GET(ExplorePath, api.Explore)
}

// Explore explores the state from storage state machine.
func (api *StorageStateMachineAPI) Explore(c *gin.Context) {
	param := &param{}
	err := c.ShouldBindQuery(param)
	if err != nil {
		http.Error(c, err)
		return
	}
	switch param.Type {
	case constants.ShardAssignment:
		shardAssignments := api.stateMgr.GetShardAssignments()
		sort.Slice(shardAssignments, func(i, j int) bool {
			return shardAssignments[i].Name < shardAssignments[j].Name
		})
		http.OK(c, shardAssignments)
	case constants.LiveNode:
		nodes := api.stateMgr.GetLiveNodes()
		sort.Slice(nodes, func(i, j int) bool {
			return nodes[i].Indicator() < nodes[j].Indicator()
		})
		http.OK(c, nodes)
	default:
		http.NotFound(c)
	}
}

```

### Core Architecture Module: `app/storage/api/state/tsdb.go`
```
// Licensed to LinDB under one or more contributor
// license agreements. See the NOTICE file distributed with
// this work for additional information regarding copyright
// ownership. LinDB licenses this file to you under
// the Apache License, Version 2.0 (the "License"); you may
// not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

package state

import (
	"github.com/gin-gonic/gin"

	httppkg "github.com/lindb/common/pkg/http"
	"github.com/lindb/common/pkg/logger"

	"github.com/lindb/lindb/models"
	"github.com/lindb/lindb/tsdb"
)

var (
	MemoryDatabase = "/state/tsdb/memory"
)

// TSDBAPI represents tsdb internal state rest api.
type TSDBAPI struct {
	logger logger.Logger
}

// NewTSDBAPI creates a tsdb state api instance.
func NewTSDBAPI() *TSDBAPI {
	return &TSDBAPI{
		logger: logger.GetLogger("Storage", "TSDBAPI"),
	}
}

// Register adds the route for tsdb state api.
func (db *TSDBAPI) Register(route gin.IRoutes) {
	route.GET(MemoryDatabase, db.GetMemoryDatabaseState)
}

// GetMemoryDatabaseState returns memory database
func (db *TSDBAPI) GetMemoryDatabaseState(c *gin.Context) {
	var param struct {
		DB string `form:"db" binding:"required"`
	}
	err := c.ShouldBindQuery(&param)
	if err != nil {
		httppkg.Error(c, err)
		return
	}
	var rs []models.DataFamilyState
	tsdb.GetFamilyManager().WalkEntry(func(family tsdb.DataFamily) {
		if param.DB == family.Shard().Database().Name() {
			rs = append(rs, family.GetState())
		}
	})
	httppkg.OK(c, rs)
}

```

### Core Architecture Module: `app/storage/database_lifecycle.go`
```
// Licensed to LinDB under one or more contributor
// license agreements. See the NOTICE file distributed with
// this work for additional information regarding copyright
// ownership. LinDB licenses this file to you under
// the Apache License, Version 2.0 (the "License"); you may
// not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

package storage

import (
	"context"
	"path"
	"time"

	"github.com/lindb/common/pkg/logger"

	"github.com/lindb/lindb/config"
	"github.com/lindb/lindb/constants"
	"github.com/lindb/lindb/pkg/state"
	"github.com/lindb/lindb/replica"
	"github.com/lindb/lindb/tsdb"
)

//go:generate mockgen -source=./database_lifecycle.go -destination=./database_lifecycle_mock.go -package=storage

// DatabaseLifecycle represents database's lifecycle manager include data and write ahead log.
type DatabaseLifecycle interface {
	// Startup startups database's lifecycle, includes background task(ttl etc.)
	Startup()
	// Shutdown shutdowns database's lifecycle.
	Shutdown()
}

// databaseLifecycle implements DatabaseLifecycle interface.
type databaseLifecycle struct {
	ctx    context.Context
	cancel context.CancelFunc

	walMgr replica.WriteAheadLogManager
	engine tsdb.Engine
	repo   state.Repository

	logger logger.Logger
}

// NewDatabaseLifecycle creates a DatabaseLifecycle instance.
func NewDatabaseLifecycle(
	ctx context.Context,
	repo state.Repository,
	walMgr replica.WriteAheadLogManager,
	engine tsdb.Engine,
) DatabaseLifecycle {
	c, cancel := context.WithCancel(ctx)
	return &databaseLifecycle{
		ctx:    c,
		cancel: cancel,
		repo:   repo,
		walMgr: walMgr,
		engine: engine,
		logger: logger.GetLogger("Lifecycle", "Database"),
	}
}

// Startup startups database's lifecycle, includes background task(ttl etc.)
func (l *databaseLifecycle) Startup() {
	l.ttlTask()
}

// Shutdown shutdowns database's lifecycle.
func (l *databaseLifecycle) Shutdown() {
	l.cancel()

	if l.walMgr != nil {
		l.logger.Info("stopping write ahead log replicator...")
		l.walMgr.Stop()
		l.logger.Info("stopped write ahead log replicator...")
	}

	// close the storage engine
	if l.engine != nil {
		l.logger.Info("stopping tsdb engine...")
		l.engine.Close()
		l.logger.Info("stopped tsdb engine")
	}

	if l.walMgr != nil {
		l.logger.Info("Closing write ahead log ...")
		if err := l.walMgr.Close(); err != nil {
			l.logger.Error("stopped write ahead log replicator with error", logger.Error(err))
		} else {
			l.logger.Info("write ahead log closed...")
		}
	}
}

// ttlTask runs ttl task in background goroutine.
func (l *databaseLifecycle) ttlTask() {
	go func() {
		ticker := time.NewTicker(config.GlobalStorageConfig().TTLTaskInterval.Duration())
		for {
			select {
			case <-ticker.C:
				// try drop databases
				l.tryDropDatabases()
				// do data ttl
				l.engine.TTL()
				// do data compaction
				tsdb.GetFamilyManager().WalkEntry(func(family tsdb.DataFamily) {
					family.Compact()
					family.Evict()
				})
				// try to evict segment(long term no read)
				l.engine.EvictSegment()
				// support dynamic modify config
				ticker.Reset(config.GlobalStorageConfig().TTLTaskInterval.Duration())
			case <-l.ctx.Done():
				return
			}
		}
	}()
}

// tryDropDatabases tries drop database's resource(data/write ahead log), keeps active databases.
func (l *databaseLifecycle) tryDropDatabases() {
	activeDatabases := make(map[string]struct{})
	if err := l.repo.WalkEntry(l.ctx, constants.ShardAssignmentPath, func(key, _ []byte) {
		_, name := path.Split(string(key))
		activeDatabases[name] = struct{}{}
	}); err != nil {
		l.logger.Error("list active database list failure", logger.Error(err))
		return
	}
	if len(activeDatabases) == 0 {
		// if active database is empty, do not drop database operation.
		return
	}
	l.walMgr.StopDatabases(activeDatabases)
	l.engine.DropDatabases(activeDatabases)
	l.walMgr.DropDatabases(activeDatabases)
}

```

### Core Architecture Module: `coordinator/broker/state_machine_factory.go`
```
// Licensed to LinDB under one or more contributor
// license agreements. See the NOTICE file distributed with
// this work for additional information regarding copyright
// ownership. LinDB licenses this file to you under
// the Apache License, Version 2.0 (the "License"); you may
// not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

package broker

import (
	"context"

	"github.com/lindb/common/pkg/logger"

	"github.com/lindb/lindb/constants"
	"github.com/lindb/lindb/coordinator/discovery"
	"github.com/lindb/lindb/models"
)

// StateMachinePaths represents the paths which broker state machine need watch.
var StateMachinePaths = make(map[string]models.StateMachineInfo)

func init() {
	StateMachinePaths[constants.LiveNode] = models.StateMachineInfo{
		Path: constants.LiveNodesPath,
		CreateState: func() interface{} {
			return &models.StatelessNode{}
		},
	}
	StateMachinePaths[constants.DatabaseConfig] = models.StateMachineInfo{
		Path: constants.DatabaseConfigPath,
		CreateState: func() interface{} {
			return &models.Database{}
		},
	}
	StateMachinePaths[constants.StorageState] = models.StateMachineInfo{
		Path: constants.StorageStatePath,
		CreateState: func() interface{} {
			return &models.StorageState{}
		},
	}
}

// stateMachineFactory implements discovery.StateMachineFactory.
type stateMachineFactory struct {
	ctx              context.Context
	discoveryFactory discovery.Factory
	stateMgr         StateManager
	logger           logger.Logger
	stateMachines    []discovery.StateMachine
}

// NewStateMachineFactory creates a state machine factory instance.
func NewStateMachineFactory(
	ctx context.Context,
	discoveryFactory discovery.Factory,
	stateMgr StateManager,
) discovery.StateMachineFactory {
	return &stateMachineFactory{
		ctx:              ctx,
		discoveryFactory: discoveryFactory,
		stateMgr:         stateMgr,
		logger:           logger.GetLogger("Broker", "StateMachineFactory"),
	}
}

// Start starts all broker's related state machines.
func (f *stateMachineFactory) Start() (err error) {
	f.logger.Debug("starting LiveNodeStateMachine")
	sm, err := f.createBrokerLiveNodeStateMachine()
	if err != nil {
		return err
	}
	f.stateMachines = append(f.stateMachines, sm)

	f.logger.Debug("starting DatabaseConfigStateMachine")
	sm, err = f.createDatabaseCfgStateMachine()
	if err != nil {
		return err
	}
	f.stateMachines = append(f.stateMachines, sm)

	f.logger.Debug("starting StorageStatusStateMachine")
	sm, err = f.createStorageStatusStateMachine()
	if err != nil {
		return err
	}
	f.stateMachines = append(f.stateMachines, sm)
	sm, err = f.createDatabaseLimitsStateMachine()
	if err != nil {
		return err
	}
	f.stateMachines = append(f.stateMachines, sm)

	f.logger.Info("started BrokerStateMachines")
	return nil
}

// Stop stops all broker's related state machines.
func (f *stateMachineFactory) Stop() {
	f.logger.Info("stopping broker state machines...")
	for _, sm := range f.stateMachines {
		if err := sm.Close(); err != nil {
			f.logger.Error("close state machine error", logger.Error(err))
		}
	}
}

// createBrokerLiveNodeStateMachine creates broker live node state machine.
func (f *stateMachineFactory) createBrokerLiveNodeStateMachine() (discovery.StateMachine, error) {
	return discovery.NewStateMachineFn(
		f.ctx,
		discovery.LiveNodeStateMachine,
		f.discoveryFactory,
		constants.LiveNodesPath,
		true,
		f.onNodeStartup,
		f.onNodeFailure,
	)
}

// createDatabaseCfgStateMachine creates database config state machine.
func (f *stateMachineFactory) createDatabaseCfgStateMachine() (discovery.StateMachine, error) {
	return discovery.NewStateMachineFn(
		f.ctx,
		discovery.DatabaseConfigStateMachine,
		f.discoveryFactory,
		constants.DatabaseConfigPath,
		true,
		f.onDatabaseConfigChanged,
		f.onDatabaseConfigDeletion,
	)
}

// createStorageStatusStateMachine creates storage status state machine.
func (f *stateMachineFactory) createStorageStatusStateMachine() (discovery.StateMachine, error) {
	return discovery.NewStateMachineFn(
		f.ctx,
		discovery.StorageStatusStateMachine,
		f.discoveryFactory,
		constants.StorageStatePath,
		true,
		f.onStorageStateChange,
		nil,
	)
}

// createDatabaseLimitsStateMachine creates database's limits state machine.
func (f *stateMachineFactory) createDatabaseLimitsStateMachine() (discovery.StateMachine, error) {
	return discovery.NewStateMachine(
		f.ctx,
		discovery.DatabaseLimitsStateMachine,
		f.discoveryFactory,
		constants.DatabaseLimitPath,
		true,
		func(key string, data []byte) {
			f.stateMgr.EmitEvent(&discovery.Event{
				Type:  discovery.DatabaseLimitsChanged,
				Key:   key,
				Value: data,
			})
		},
		nil,
	)
}

// onDatabaseConfigChanged triggers when database config modified(create/update)
func (f *stateMachineFactory) onDatabaseConfigChanged(key string, data []byte) {
	f.stateMgr.EmitEvent(&discovery.Event{
		Type:  discovery.DatabaseConfigChanged,
		Key:   key,
		Value: data,
	})
}

// onDatabaseConfigDeletion triggers when database is deletion.
func (f *stateMachineFactory) onDatabaseConfigDeletion(key string) {
	f.stateMgr.EmitEvent(&discovery.Event{
		Type: discovery.DatabaseConfigDeletion,
		Key:  key,
	})
}

// onNodeStartup triggers when node online.
func (f *stateMachineFactory) onNodeStartup(key string, data []byte) {
	f.stateMgr.EmitEvent(&discovery.Event{
		Type:  discovery.NodeStartup,
		Key:   key,
		Value: data,
	})
}

// onNodeFailure triggers when node offline.
func (f *stateMachineFactory) onNodeFailure(key string) {
	f.stateMgr.EmitEvent(&discovery.Event{
		Type: discovery.NodeFailure,
		Key:  key,
	})
}

// onStorageStateChange triggers when storage state changed.
func (f *stateMachineFactory) onStorageStateChange(key string, data []byte) {
	f.stateMgr.EmitEvent(&discovery.Event{
		Type:  discovery.StorageStateChanged,
		Key:   key,
		Value: data,
	})
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1077** (2024-11-05): **[feat]: add master port/fix output column order**
  *Symptoms*: ### What problem does this PR solve?  Issue Number: #xxx  Problem Summary:   ### Check List  Tests   - [x] Unit test - [x] Integration test - [x] No code 

- **Issue #1071** (2024-10-21): **[bug]: fix cannot find field when select item is expression**
  *Symptoms*: ### What problem does this PR solve?  Issue Number: #xxx  Problem Summary:   ### Check List  Tests   - [x] Unit test - [x] Integration test - [x] No code 

- **Issue #1044** (2024-08-15): **[bug]: fix cannot flush metric data when server shutdown**
  *Symptoms*: ### What problem does this PR solve?  Issue Number: #xxx  Problem Summary:   ### Check List  Tests   - [x] Unit test - [x] Integration test - [x] No code 

- **Issue #1038** (2024-07-18): **[bug]: fix wal ack invalid seq msg**
  *Symptoms*: ### What problem does this PR solve?  Issue Number: #xxx  Problem Summary:   ### Check List  Tests   - [x] Unit test - [x] Integration test - [x] No code 

- **Issue #1034** (2024-07-16): **[bug]: fix get wrong data from memory database**
  *Symptoms*: ### What problem does this PR solve?  Issue Number: #xxx  Problem Summary:   ### Check List  Tests   - [x] Unit test - [x] Integration test - [x] No code 

- **Issue #1033** (2024-07-16): **[opt]: ignore histogram bucket if count<0**
  *Symptoms*: ### What problem does this PR solve?  Issue Number: #xxx  Problem Summary: - ignore histogram bucket if count<0 - fix histogram no data found  ### Check List  Tests   - [x] Unit test - [x] Integration test - [x] No code 

- **Issue #1032** (2024-07-12): **[bug]: miss makezero in slice init**
  *Symptoms*: ### What problem does this PR solve?  Issue Number: #1029  Problem Summary:   ### Check List  Tests   - [x] Unit test - [x] Integration test - [x] No code 

- **Issue #1031** (2024-07-12): **[bug]: fix build docker fail**
  *Symptoms*: ### What problem does this PR solve?  Issue Number: #xxx  Problem Summary:   ### Check List  Tests   - [x] Unit test - [x] Integration test - [x] No code 

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

### Incident Patch 1: `361018dd` (2024-08-15)
**Commit Message**: [bug]: fix cannot flush metric data when server shutdown (#1044)

**File**: `tsdb/memdb/index_database.go` (modified, +4/-3)
```diff
@@ -21,6 +21,7 @@ import (
 	"context"
 	"sync"
 
+	"github.com/lindb/common/pkg/fasttime"
 	"github.com/lindb/common/pkg/logger"
 	"github.com/lindb/common/pkg/timeutil"
 	"go.uber.org/atomic"
@@ -131,13 +132,13 @@ func (idb *indexDatabase) GetTimeSeriesIndex(memMetricID uint64) (TimeSeriesInde
 // Cleanup cleanups index data for inactive memory database.
 func (idb *indexDatabase) Cleanup(db MemoryDatabase) {
 	familyCreateTime := db.CreatedTime()
-	expiredTimestamp := timeutil.Now()
+	now := fasttime.UnixMilliseconds()
 	memTimeSeriesIDs := db.MemTimeSeriesIDs()
-	gcTimestamp := timeutil.Now() - 3*timeutil.OneHour // TODO: add config?
+	gcTimestamp := now - 3*timeutil.OneHour // TODO: add config?
 	idb.timeSeriesIndexes.Range(func(key, value any) bool {
 		timeSeriesIndex := (value.(TimeSeriesIndex))
 		timeSeriesIndex.ClearTimeRange(familyCreateTime)
-		timeSeriesIndex.ExpireTimeSeriesIDs(memTimeSeriesIDs, expiredTimestamp)
+		timeSeriesIndex.ExpireTimeSeriesIDs(memTimeSeriesIDs, now)
 		timeSeriesIndex.GC(gcTimestamp)
 
 		// if no time series undex index, remove it from metric index store
```

**File**: `tsdb/memdb/metadata_database.go` (modified, +1/-1)
```diff
@@ -181,7 +181,7 @@ func (mdb *metadataDatabase) handleFlush(event *FlushEvent) {
 	err := mdb.metaDB.Flush()
 	event.Callback(err)
 
-	mdb.gc(fasttime.UnixMicroseconds() - timeutil.OneDay)
+	mdb.gc(fasttime.UnixMilliseconds() - timeutil.OneDay)
 }
 
 // handleRow lookups metric metedata and indexes.
```

---

### Incident Patch 2: `c63e9d2f` (2024-07-22)
**Commit Message**: [enhance]: remove installation guides from release notes (#1043)

**File**: `.github/workflows/release.yml` (modified, +1/-1)
```diff
@@ -36,7 +36,7 @@ jobs:
         if: github.event_name != 'workflow_dispatch'
         with:
           release_name: ${{ github.ref_name }}
-          body: "For installation guides, please check out [Quick start](https://lindb.io/guide/get-started.html).\n${{ steps.generate_changelog.outputs.changelog }}"
+          body: "${{ steps.generate_changelog.outputs.changelog }}"
           files: |
             release/lindb-*
       - name: Get current date
```

---

### Incident Patch 3: `1b73b9b7` (2024-07-18)
**Commit Message**: [bug]: fix wal ack invalid seq msg (#1038)

**File**: `pkg/queue/consumer_group.go` (modified, +1/-1)
```diff
@@ -194,7 +194,7 @@ func (f *consumerGroup) Ack(ackSeq int64) {
 	hs := f.ConsumedSeq()
 	// In the initial condition, ts == 0, if the first acknowledgedSeq == 0, it would be ignored.
 	// Since ack is always in batch mode and the following ack will ack the previous data, it's not big problem.
-	if ackSeq > ts && ackSeq <= hs {
+	if ackSeq >= ts && ackSeq <= hs {
 		f.acknowledgedSeq.Store(ackSeq)
 
 		f.metaPage.PutUint64(uint64(f.ConsumedSeq()), consumerGroupConsumedSeqOffset)
```

**File**: `replica/replicator_local.go` (modified, +3/-3)
```diff
@@ -29,10 +29,10 @@ import (
 
 // localReplicator represents local replicator which writes data into local tsdb storage.
 type localReplicator struct {
-	shard  tsdb.Shard
-	family tsdb.DataFamily
-	logger logger.Logger
 	replicator
+	shard      tsdb.Shard
+	family     tsdb.DataFamily
+	logger     logger.Logger
 	batchRows  *metric.StorageBatchRows
 	reader     compress.Reader
 	statistics *metrics.StorageLocalReplicatorStatistics
```

**File**: `replica/replicator_remote.go` (modified, +6/-11)
```diff
@@ -21,10 +21,9 @@ import (
 	"context"
 	"sync"
 
-	"go.uber.org/atomic"
-
 	"github.com/lindb/common/pkg/encoding"
 	"github.com/lindb/common/pkg/logger"
+	"go.uber.org/atomic"
 
 	"github.com/lindb/lindb/constants"
 	"github.com/lindb/lindb/coordinator/storage"
@@ -37,22 +36,18 @@ import (
 // remoteReplicator implements Replicator interface, do remote wal replica.
 type remoteReplicator struct {
 	replicator
-
 	ctx   context.Context
 	state atomic.Value // ref: state
 
 	cliFct        rpc.ClientStreamFactory
 	replicaCli    protoReplicaV1.ReplicaServiceClient
 	replicaStream protoReplicaV1.ReplicaService_ReplicaClient
 	stateMgr      storage.StateManager
-
-	isSuspend *atomic.Bool
-	suspend   chan struct{}
-
-	rwMutex sync.RWMutex
-
-	statistics *metrics.StorageRemoteReplicatorStatistics
-	logger     logger.Logger
+	logger        logger.Logger
+	isSuspend     *atomic.Bool
+	suspend       chan struct{}
+	statistics    *metrics.StorageRemoteReplicatorStatistics
+	rwMutex       sync.RWMutex
 }
 
 // NewRemoteReplicator creates remote replicator.
```

---

### Incident Patch 4: `c194374a` (2024-07-18)
**Commit Message**: [feat]: cleanup memory metric meta/index if not used (#1037)

**File**: `tsdb/memdb/database.go` (modified, +28/-13)
```diff
@@ -86,10 +86,14 @@ type MemoryDatabase interface {
 	io.Closer
 	// FamilyTime returns the family time of this memdb
 	FamilyTime() int64
+	// CreatedTime returns created timestamp of family's memory database.
+	CreatedTime() int64
 	// Uptime returns duration since created
 	Uptime() time.Duration
 	// NumOfSeries returns the number of series.
 	NumOfSeries() int
+	// MemTimeSeriesIDs returns all memory time series ids under current database.
+	MemTimeSeriesIDs() *roaring.Bitmap
 }
 
 // MemoryDatabaseCfg represents the memory database config
@@ -175,15 +179,6 @@ func (md *memoryDatabase) WriteRow(row *metric.StorageRow) error {
 	timeSeriesIndex := md.indexDB.GetOrCreateTimeSeriesIndex(row)
 	mStore, newMetric := md.indexDB.GetMetadataDatabase().GetOrCreateMetricMeta(row)
 
-	defer func() {
-		if newMetric || len(row.Fields) > 0 {
-			// notify meta worker does build metadata
-			md.indexDB.GetMetadataDatabase().Notify(row)
-		} else {
-			row.Done()
-		}
-	}()
-
 	tagsHash := row.TagsHash()
 
 	// generate memory level unique time series id
@@ -196,13 +191,24 @@ func (md *memoryDatabase) WriteRow(row *metric.StorageRow) error {
 	} else {
 		row.Done()
 	}
-
 	slotIndex := uint16(md.cfg.IntervalCalc.CalcSlot(
 		row.Timestamp(),
 		md.familyTime,
 		md.cfg.Interval.Int64()),
 	)
 
+	defer func() {
+		if newMetric || len(row.Fields) > 0 {
+			// notify meta worker does build metadata
+			md.indexDB.GetMetadataDatabase().Notify(row)
+		} else {
+			row.Done()
+		}
+
+		timeSeriesIndex.StoreTimeRange(md.createdTime, slotIndex)
+		md.timeSeriesIDs.Add(memSeriesID)
+	}()
+
 	simpleFieldItr := row.NewSimpleFieldIterator()
 	for simpleFieldItr.HasNext() {
 		if err := md.writeLinField(
@@ -221,8 +227,6 @@ func (md *memoryDatabase) WriteRow(row *metric.StorageRow) error {
 		return err
 	}
 
-	timeSeriesIndex.StoreTimeRange(md.createdTime, slotIndex)
-	md.timeSeriesIDs.Add(memSeriesID)
 	return nil
 }
 
@@ -460,20 +464,31 @@ func (md *memoryDatabase) MemSize() (memSize int64) {
 	return memSize
 }
 
+// CreatedTime returns created timestamp of family's memory database.
+func (md *memoryDatabase) CreatedTime() int64 {
+	return md.createdTime
+}
+
 // Close releases resources for current memory database.
 func (md *memoryDatabase) Close() error {
 	md.fieldWriteStores.Range(func(key, value any) bool {
 		(value.(DataPointBuffer)).Release()
 		return true
 	})
-	md.indexDB.ClearTimeRange(md.createdTime)
+	md.indexDB.Cleanup(md)
 	return nil
 }
 
 func (md *memoryDatabase) Uptime() time.Duration {
 	return time.Duration(fasttime.UnixNano() - md.createdTime)
 }
 
+// MemTimeSeriesIDs returns all memory time series ids under current database.
+// NOTE: after database flush invoke.
+func (md *memoryDatabase) MemTimeSeriesIDs() *roaring.Bitmap {
+	return md.timeSeriesIDs
+}
+
 // NumOfSeries returns the number of series.
 func (md *memoryDatabase) NumOfSeries() int {
 	md.lock.RLock()
```

**File**: `tsdb/memdb/database_test.go` (modified, +2/-1)
```diff
@@ -71,7 +71,7 @@ func TestMemoryDatabase_New(t *testing.T) {
 	mdINTF.MarkReadOnly()
 	assert.True(t, mdINTF.IsReadOnly())
 	md := mdINTF.(*memoryDatabase)
-	indexDB.EXPECT().ClearTimeRange(md.createdTime)
+	indexDB.EXPECT().Cleanup(md)
 	err = mdINTF.Close()
 	assert.NoError(t, err)
 	time.Sleep(time.Millisecond * 100)
@@ -145,6 +145,7 @@ func TestDatabase_Write(t *testing.T) {
 	})
 	assert.NoError(t, db.WriteRow(row))
 	assert.NotZero(t, db.MemSize())
+	assert.False(t, db.MemTimeSeriesIDs().IsEmpty())
 
 	// wait meta/index update
 	time.Sleep(500 * time.Millisecond)
```

**File**: `tsdb/memdb/index_database.go` (modified, +19/-7)
```diff
@@ -21,6 +21,7 @@ import (
 	"context"
 	"sync"
 
+	"github.com/lindb/common/pkg/timeutil"
 	"go.uber.org/atomic"
 
 	"github.com/lindb/lindb/index"
@@ -39,8 +40,8 @@ type IndexDatabase interface {
 	GetMetadataDatabase() MetadataDatabase
 	// GetTimeSeriesIndex returns memory time series index by memory metric id.
 	GetTimeSeriesIndex(memMetricID uint64) (TimeSeriesIndex, bool)
-	// ClearTimeRange clears time range by family create time.
-	ClearTimeRange(familyCreate int64)
+	// Cleanup cleanups index data for inactive memory database.
+	Cleanup(db MemoryDatabase)
 	// Notify notifies update or flush metric index.
 	Notify(event any)
 	// Close closed index database.
@@ -55,8 +56,7 @@ type indexDatabase struct {
 	ctx    context.Context
 	cancel context.CancelFunc
 
-	ch chan any
-	// TODO: clean time series index if not used long time
+	ch                chan any
 	timeSeriesIndexes sync.Map // hash(ns + metirc name) => metric index store(map[uint64]TimeSeriesIndex)
 
 	timeSeriesSeq atomic.Uint32 // like db primary key sequence(memory level)
@@ -127,10 +127,22 @@ func (idb *indexDatabase) GetTimeSeriesIndex(memMetricID uint64) (TimeSeriesInde
 	return nil, false
 }
 
-// ClearTimeRange clears time range by family create time.
-func (idb *indexDatabase) ClearTimeRange(familyCreateTime int64) {
+// Cleanup cleanups index data for inactive memory database.
+func (idb *indexDatabase) Cleanup(db MemoryDatabase) {
+	familyCreateTime := db.CreatedTime()
+	expiredTimestamp := timeutil.Now()
+	memTimeSeriesIDs := db.MemTimeSeriesIDs()
+	gcTimestamp := timeutil.Now() - 3*timeutil.OneHour // TODO: add config?
 	idb.timeSeriesIndexes.Range(func(key, value any) bool {
-		(value.(TimeSeriesIndex)).ClearTimeRange(familyCreateTime)
+		timeSeriesIndex := (value.(TimeSeriesIndex))
+		timeSeriesIndex.ClearTimeRange(familyCreateTime)
+		timeSeriesIndex.ExpireTimeSeriesIDs(memTimeSeriesIDs, expiredTimestamp)
+		timeSeriesIndex.GC(gcTimestamp)
+
+		// if no time series undex index, remove it from metric index store
+		if timeSeriesIndex.NumOfSeries() == 0 {
+			idb.timeSeriesIndexes.Delete(key)
+		}
 		return true
 	})
 }
```

**File**: `tsdb/memdb/index_database_test.go` (modified, +20/-2)
```diff
@@ -21,7 +21,9 @@ import (
 	"fmt"
 	"testing"
 
+	"github.com/lindb/common/pkg/timeutil"
 	protoMetricsV1 "github.com/lindb/common/proto/gen/v1/linmetrics"
+	"github.com/lindb/roaring"
 	"github.com/stretchr/testify/assert"
 	gomock "go.uber.org/mock/gomock"
 
@@ -30,6 +32,9 @@ import (
 )
 
 func TestIndexDatabase_GetOrCreateTimeSeriesIndex(t *testing.T) {
+	ctrl := gomock.NewController(t)
+	defer ctrl.Finish()
+
 	idx := NewIndexDatabase(nil, nil)
 
 	m := &protoMetricsV1.Metric{
@@ -43,6 +48,7 @@ func TestIndexDatabase_GetOrCreateTimeSeriesIndex(t *testing.T) {
 
 	row := protoToStorageRow(m)
 	tsIndex := idx.GetOrCreateTimeSeriesIndex(row)
+	tsIndex.GenMemTimeSeriesID(row.TagsHash(), idx.GenMemSeriesID)
 	assert.NotNil(t, tsIndex)
 
 	tsIndex1 := idx.(*indexDatabase).getOrCreateTimeSeriesIndex(row.NameHash())
@@ -54,8 +60,20 @@ func TestIndexDatabase_GetOrCreateTimeSeriesIndex(t *testing.T) {
 	assert.Nil(t, tsIndex)
 	assert.False(t, ok)
 
-	// clear time range
-	idx.ClearTimeRange(100)
+	db := NewMockMemoryDatabase(ctrl)
+	db.EXPECT().CreatedTime().Return(timeutil.Now())
+	db.EXPECT().MemTimeSeriesIDs().Return(roaring.BitmapOf(1, 2, 3))
+	tsIndex1.IndexTimeSeries(100, 1)
+	assert.NotZero(t, tsIndex1.NumOfSeries())
+	idx.Cleanup(db)
+	assert.NotZero(t, tsIndex1.NumOfSeries())
+
+	db.EXPECT().CreatedTime().Return(timeutil.Now())
+	db.EXPECT().MemTimeSeriesIDs().Return(roaring.BitmapOf(3))
+	tsIndex1.ExpireTimeSeriesIDs(roaring.BitmapOf(1, 0), timeutil.Now()-4*timeutil.OneHour)
+	assert.NotZero(t, tsIndex1.NumOfSeries())
+	idx.Cleanup(db)
+	assert.Zero(t, tsIndex1.NumOfSeries())
 
 	idx.Close()
 }
```

**File**: `tsdb/memdb/metadata_database.go` (modified, +43/-2)
```diff
@@ -21,6 +21,8 @@ import (
 	"context"
 	"sync"
 
+	"github.com/lindb/common/pkg/fasttime"
+	"github.com/lindb/common/pkg/timeutil"
 	"github.com/lindb/roaring"
 
 	"github.com/lindb/lindb/index"
@@ -30,6 +32,8 @@ import (
 
 //go:generate mockgen -source ./metadata_database.go -destination=./metadata_database_mock.go -package=memdb
 
+var empty = struct{}{}
+
 // MetadataDatabase represents memory metadata database for storing metric meta(name,field etc./database level)
 type MetadataDatabase interface {
 	// GetOrCreateMetricMeta returns metric meta store, if not exist create new store.
@@ -55,8 +59,7 @@ type metadataDatabase struct {
 	ctx    context.Context
 	cancel context.CancelFunc
 
-	ch chan any
-	// TODO: clean metric metadata if not used long time
+	ch               chan any
 	metricIndexStore *imap.IntMap[uint64] // metric id => hash(ns + metric name)
 	metricMetadatas  sync.Map             // hash(ns + metirc name) => metric store index(map[uint64]mStoreINTF)
 
@@ -166,6 +169,8 @@ func (mdb *metadataDatabase) handle() {
 func (mdb *metadataDatabase) handleFlush(event *FlushEvent) {
 	err := mdb.metaDB.Flush()
 	event.Callback(err)
+
+	mdb.gc(fasttime.UnixMicroseconds() - timeutil.OneDay)
 }
 
 // handleRow lookups metric metedata and indexes.
@@ -198,3 +203,39 @@ func (mdb *metadataDatabase) handleRow(row *metric.StorageRow) {
 		mStore.UpdateFieldMeta(fieldID, fm)
 	}
 }
+
+// gc clears expired metric meta store.
+func (mdb *metadataDatabase) gc(gcTimestamp int64) {
+	activeMetricIDs := make(map[uint64]struct{})
+
+	// gc metric store
+	mdb.metricMetadatas.Range(func(key, value any) bool {
+		mStore := value.(mStoreINTF)
+		if mStore.IsActive(gcTimestamp) {
+			activeMetricIDs[key.(uint64)] = empty
+		} else {
+			mdb.metricMetadatas.Delete(key) // delete inactive metric store
+		}
+		return true
+	})
+
+	active := len(activeMetricIDs)
+
+	mdb.lock.Lock()
+	defer mdb.lock.Unlock()
+	// gc metric store index
+	if active == 0 && !mdb.metricIndexStore.IsEmpty() {
+		mdb.metricIndexStore = imap.NewIntMap[uint64]()
+	} else if float64(active) <= 0.5*float64(mdb.metricIndexStore.Size()) {
+		// TODO: add config?
+		newIds := imap.NewIntMap[uint64]()
+		_ = mdb.metricIndexStore.WalkEntry(func(key uint32, value uint64) error {
+			_, ok := activeMetricIDs[value]
+			if ok {
+				newIds.Put(key, value)
+			}
+			return nil
+		})
+		mdb.metricIndexStore = newIds
+	}
+}
```

**File**: `tsdb/memdb/metadata_database_test.go` (modified, +69/-0)
```diff
@@ -21,11 +21,13 @@ import (
 	"fmt"
 	"testing"
 
+	"github.com/lindb/common/pkg/fasttime"
 	protoMetricsV1 "github.com/lindb/common/proto/gen/v1/linmetrics"
 	"github.com/stretchr/testify/assert"
 	"go.uber.org/mock/gomock"
 
 	"github.com/lindb/lindb/index"
+	"github.com/lindb/lindb/pkg/imap"
 	"github.com/lindb/lindb/series/field"
 	"github.com/lindb/lindb/series/metric"
 )
@@ -112,3 +114,70 @@ func TestMetadataDatabase_handleRow(t *testing.T) {
 	_, _ = mdb.GetOrCreateMetricMeta(row)
 	mdb.handleRow(row)
 }
+
+func TestMetadataDatabase_gc(t *testing.T) {
+	ctrl := gomock.NewController(t)
+	defer ctrl.Finish()
+
+	mStore := NewMockmStoreINTF(ctrl)
+
+	t.Run("no data gc", func(t *testing.T) {
+		mdb := &metadataDatabase{
+			metricIndexStore: imap.NewIntMap[uint64](),
+		}
+		mdb.gc(fasttime.UnixMilliseconds())
+	})
+
+	t.Run("metric store active", func(t *testing.T) {
+		mdb := &metadataDatabase{
+			metricIndexStore: imap.NewIntMap[uint64](),
+		}
+		mdb.metricMetadatas.Store(uint64(100), mStore)
+		mStore.EXPECT().IsActive(gomock.Any()).Return(true)
+		mdb.gc(fasttime.UnixMilliseconds())
+		_, ok := mdb.metricMetadatas.Load(uint64(100))
+		assert.True(t, ok)
+	})
+
+	t.Run("gc metric store", func(t *testing.T) {
+		mdb := &metadataDatabase{
+			metricIndexStore: imap.NewIntMap[uint64](),
+		}
+		mdb.metricIndexStore.Put(10, 100)
+		mdb.metricMetadatas.Store(uint64(100), mStore)
+		mStore.EXPECT().IsActive(gomock.Any()).Return(false)
+		mdb.gc(fasttime.UnixMilliseconds())
+		_, ok := mdb.metricMetadatas.Load(uint64(100))
+		assert.False(t, ok)
+		assert.True(t, mdb.metricIndexStore.IsEmpty())
+	})
+
+	t.Run("not gc metric index", func(t *testing.T) {
+		mdb := &metadataDatabase{
+			metricIndexStore: imap.NewIntMap[uint64](),
+		}
+		mdb.metricIndexStore.Put(10, 100)
+		mdb.metricIndexStore.Put(20, 200)
+		mdb.metricMetadatas.Store(uint64(100), mStore)
+		mdb.metricMetadatas.Store(uint64(200), mStore)
+		mdb.metricMetadatas.Store(uint64(300), mStore)
+		mStore.EXPECT().IsActive(gomock.Any()).Return(false)
+		mStore.EXPECT().IsActive(gomock.Any()).Return(true).MaxTimes(2)
+		mdb.gc(fasttime.UnixMilliseconds())
+		assert.Equal(t, 2, mdb.metricIndexStore.Size())
+	})
+
+	t.Run("not gc metric index", func(t *testing.T) {
+		mdb := &metadataDatabase{
+			metricIndexStore: imap.NewIntMap[uint64](),
+		}
+		mdb.metricIndexStore.Put(10, 100)
+		mdb.metricIndexStore.Put(20, 200)
+		mdb.metricMetadatas.Store(uint64(100), mStore)
+		mdb.metricMetadatas.Store(uint64(200), mStore)
+		mStore.EXPECT().IsActive(gomock.Any()).Return(false)
+		mStore.EXPECT().IsActive(gomock.Any()).Return(true)
+		mdb.gc(fasttime.UnixMilliseconds())
+		assert.Equal(t, 1, mdb.metricIndexStore.Size())
+	})
+}
```

**File**: `tsdb/memdb/metric_store.go` (modified, +11/-0)
```diff
@@ -20,6 +20,8 @@ package memdb
 import (
 	"sync"
 
+	"github.com/lindb/common/pkg/fasttime"
+
 	"github.com/lindb/lindb/series/field"
 )
 
@@ -35,13 +37,16 @@ type mStoreINTF interface {
 	UpdateFieldMeta(fieldID field.ID, fm field.Meta)
 	// FindFields returns fields from store based on current written fields.
 	FindFields(fields field.Metas) (found field.Metas)
+	// IsActive returns if metric store active.
+	IsActive(timestamp int64) bool
 }
 
 // metricStore represents metric level storage, stores all series data, and fields/family times metadata
 type metricStore struct {
 	fields sync.Map // field metadata(field.Metas)
 
 	fieldCount int
+	accessTime int64
 	lock       sync.RWMutex
 }
 
@@ -62,6 +67,7 @@ func (ms *metricStore) GetFields() (fields field.Metas) {
 
 // GenField generates field meta under memory database.
 func (ms *metricStore) GenField(name field.Name, fType field.Type) (f field.Meta, created bool) {
+	ms.accessTime = fasttime.UnixMilliseconds()
 	fm, ok := ms.fields.Load(name)
 	if ok {
 		return fm.(field.Meta), false
@@ -114,3 +120,8 @@ func (ms *metricStore) FindFields(fields field.Metas) (found field.Metas) {
 	}
 	return
 }
+
+// IsActive returns if metric store active.
+func (ms *metricStore) IsActive(timestamp int64) bool {
+	return ms.accessTime >= timestamp
+}
```

**File**: `tsdb/memdb/metric_store_test.go` (modified, +10/-0)
```diff
@@ -20,6 +20,8 @@ package memdb
 import (
 	"testing"
 
+	"github.com/lindb/common/pkg/fasttime"
+	"github.com/lindb/common/pkg/timeutil"
 	"github.com/stretchr/testify/assert"
 
 	"github.com/lindb/lindb/series/field"
@@ -35,3 +37,11 @@ func TestMetricStore_genField(t *testing.T) {
 	assert.False(t, isNew)
 	assert.Equal(t, field.Meta{Name: "test", Type: field.SumField, Index: 0}, f)
 }
+
+func TestMetricStore_IsAction(t *testing.T) {
+	ms := newMetricStore()
+	_, isNew := ms.GenField("test", field.SumField)
+	assert.True(t, isNew)
+	assert.True(t, ms.IsActive(fasttime.UnixMilliseconds()))
+	assert.False(t, ms.IsActive(fasttime.UnixMilliseconds()+timeutil.OneDay))
+}
```

---

### Incident Patch 5: `17726189` (2024-07-17)
**Commit Message**: [feat]: memory database approximate memory size (#1036)

**File**: `tsdb/memdb/compact_store.go` (modified, +23/-1)
```diff
@@ -17,19 +17,28 @@
 
 package memdb
 
-import "sync"
+import (
+	"sync"
+	"unsafe"
+
+	"go.uber.org/atomic"
+)
 
 // CompressStore represents memory compress buffer store for field writing.
 type CompressStore interface {
 	// GetCompressBuffer returns memory compress buffer by memory time series id.
 	GetCompressBuffer(memSeriesID uint32) []byte
 	// StoreCompressBuffer stores memory compress buffer based on momery time series id.
 	StoreCompressBuffer(memSeriesID uint32, buf []byte)
+	// MemSize returns compress store memory approximate size.
+	MemSize() int64
 }
 
 // compressStore implements CompressStore interface.
 type compressStore struct {
 	store sync.Map // memory series id => compress buffer
+
+	memSize atomic.Int64
 }
 
 // NewCompressStore creates CompressStore instance.
@@ -48,5 +57,18 @@ func (s *compressStore) GetCompressBuffer(memSeriesID uint32) []byte {
 
 // StoreCompressBuffer stores memory compress buffer based on momery time series id.
 func (s *compressStore) StoreCompressBuffer(memSeriesID uint32, buf []byte) {
+	oldBuf, ok := s.store.Load(memSeriesID)
+	var diff int
+	if ok {
+		diff = len(buf) - len(oldBuf.([]byte))
+	} else {
+		diff = len(buf) + 4
+	}
 	s.store.Store(memSeriesID, buf)
+	s.memSize.Add(int64(diff))
+}
+
+// MemSize returns compress store memory approximate size.
+func (s *compressStore) MemSize() (memSize int64) {
+	return int64(unsafe.Sizeof(s)) + s.memSize.Load()
 }
```

**File**: `tsdb/memdb/compact_store_test.go` (added, +35/-0)
```diff
@@ -0,0 +1,35 @@
+// Licensed to LinDB under one or more contributor
+// license agreements. See the NOTICE file distributed with
+// this work for additional information regarding copyright
+// ownership. LinDB licenses this file to you under
+// the Apache License, Version 2.0 (the "License"); you may
+// not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+//     http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing,
+// software distributed under the License is distributed on an
+// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
+// KIND, either express or implied.  See the License for the
+// specific language governing permissions and limitations
+// under the License.
+
+package memdb
+
+import (
+	"testing"
+
+	"github.com/stretchr/testify/assert"
+)
+
+func TestCompressStore(t *testing.T) {
+	store := NewCompressStore()
+	size := store.MemSize()
+	assert.NotZero(t, size)
+
+	store.StoreCompressBuffer(10, make([]byte, 4))
+	size = store.MemSize()
+	store.StoreCompressBuffer(10, make([]byte, 8))
+	assert.Equal(t, size+4, store.MemSize())
+}
```

**File**: `tsdb/memdb/data_point_buffer.go` (modified, +7/-0)
```diff
@@ -62,6 +62,8 @@ type DataPointBuffer interface {
 	Release()
 	// IsDirty returns data point buffer if dirty, dirty buffer can be collect.
 	IsDirty() bool
+	// BufferSize returns data point buffer size.
+	BufferSize() int64
 }
 
 // dataPointBuffer implements DataPointBuffer interface
@@ -163,6 +165,11 @@ func (d *dataPointBuffer) IsDirty() bool {
 	return d.dirty.Load()
 }
 
+// BufferSize returns data point buffer size.
+func (d *dataPointBuffer) BufferSize() int64 {
+	return int64(d.pageIDSeq) * pageSize
+}
+
 // Close closes data point buffer, unmap memory map file
 func (d *dataPointBuffer) Close() error {
 	if !d.dirty.Load() {
```

**File**: `tsdb/memdb/database.go` (modified, +12/-5)
```diff
@@ -78,7 +78,7 @@ type MemoryDatabase interface {
 	// FlushFamilyTo flushes the corresponded family data to builder.
 	// Close is not in the flushing process.
 	FlushFamilyTo(flusher metricsdata.Flusher) error
-	// MemSize returns the memory-size of this metric-store
+	// MemSize returns the memory-size of memory database.
 	MemSize() int64
 	// DataFilter filters the data based on condition
 	flow.DataFilter
@@ -447,10 +447,17 @@ func (md *memoryDatabase) Filter(shardExecuteContext *flow.ShardExecuteContext)
 	return md.filter(shardExecuteContext, memMetricID, storageSlotRange, timeSeriesIndex)
 }
 
-// MemSize returns the time series database memory size
-func (md *memoryDatabase) MemSize() int64 {
-	// FIXME: page buffer size
-	return 0
+// MemSize returns the time series database memory size.
+func (md *memoryDatabase) MemSize() (memSize int64) {
+	md.fieldWriteStores.Range(func(key, value any) bool {
+		memSize += (value.(DataPointBuffer)).BufferSize()
+		return true
+	})
+	md.fieldCompressStore.Range(func(key, value any) bool {
+		memSize += (value.(CompressStore)).MemSize()
+		return true
+	})
+	return memSize
 }
 
 // Close releases resources for current memory database.
```

**File**: `tsdb/memdb/database_test.go` (modified, +1/-0)
```diff
@@ -144,6 +144,7 @@ func TestDatabase_Write(t *testing.T) {
 		},
 	})
 	assert.NoError(t, db.WriteRow(row))
+	assert.NotZero(t, db.MemSize())
 
 	// wait meta/index update
 	time.Sleep(500 * time.Millisecond)
```

**File**: `tsdb/memdb/time_series_index.go` (modified, +1/-1)
```diff
@@ -69,7 +69,7 @@ type timeSeriesIndex struct {
 	hashes sync.Map             // tag hash => memory time series id(map[uint64]uint32)
 	ids    *imap.IntMap[uint32] // global series id => memory time series id
 
-	families sync.Map // family create timestamp(ns) => metric write time range(map[uint64]*timeutil.SlotRange)
+	families sync.Map // family create timestamp(ns) => metric level time range(map[uint64]*timeutil.SlotRange)
 
 	lock sync.RWMutex
 }
```

---

### Incident Patch 6: `d40f316b` (2024-07-17)
**Commit Message**: [opt]: opt metric field memory store (#1035)

**File**: `series/field/metas.go` (modified, +1/-1)
```diff
@@ -35,7 +35,7 @@ type Meta struct {
 	// write: field index under memory database
 	// read: field index of query fields
 	Index     uint8
-	Persisted bool // FIXME: can remove
+	Persisted bool
 }
 
 // MarshalBinary marshals meta as binary.
```

**File**: `tsdb/memdb/database.go` (modified, +4/-0)
```diff
@@ -377,6 +377,10 @@ func (md *memoryDatabase) FlushFamilyTo(flusher metricsdata.Flusher) error {
 		allFields := mStore.GetFields()
 		for idx := range allFields {
 			f := allFields[idx]
+			if !f.Persisted {
+				// ignore if field meta not persist
+				continue
+			}
 			buf, ok := md.fieldWriteStores.Load(f.Index)
 			if ok {
 				buffer := buf.(DataPointBuffer)
```

**File**: `tsdb/memdb/database_test.go` (modified, +15/-2)
```diff
@@ -465,7 +465,7 @@ func TestMemoryDatabase_Flush_Error(t *testing.T) {
 			},
 		},
 		{
-			name: "flush field data err",
+			name: "flush field not persist",
 			prepare: func() {
 				metaDB.EXPECT().GetMetricIDs().Return(roaring.BitmapOf(1))
 				metaDB.EXPECT().GetMemMetricID(gomock.Any()).Return(uint64(0), true)
@@ -474,6 +474,19 @@ func TestMemoryDatabase_Flush_Error(t *testing.T) {
 				timeSeriesIndex.EXPECT().GetTimeRange(gomock.Any()).Return(&timeutil.SlotRange{}, true)
 				timeSeriesIndex.EXPECT().MemTimeSeriesIDs().Return(roaring.BitmapOf(1))
 				mStore.EXPECT().GetFields().Return(field.Metas{{Name: "test", Index: 1}})
+				flusher.EXPECT().Close().Return(nil)
+			},
+		},
+		{
+			name: "flush field data err",
+			prepare: func() {
+				metaDB.EXPECT().GetMetricIDs().Return(roaring.BitmapOf(1))
+				metaDB.EXPECT().GetMemMetricID(gomock.Any()).Return(uint64(0), true)
+				metaDB.EXPECT().GetMetricMeta(gomock.Any()).Return(mStore, true)
+				indexDB.EXPECT().GetTimeSeriesIndex(gomock.Any()).Return(timeSeriesIndex, true)
+				timeSeriesIndex.EXPECT().GetTimeRange(gomock.Any()).Return(&timeutil.SlotRange{}, true)
+				timeSeriesIndex.EXPECT().MemTimeSeriesIDs().Return(roaring.BitmapOf(1))
+				mStore.EXPECT().GetFields().Return(field.Metas{{Name: "test", Persisted: true, Index: 1}})
 				flusher.EXPECT().PrepareMetric(gomock.Any(), gomock.Any())
 				timeSeriesIndex.EXPECT().FlushMetricsDataTo(gomock.Any(), gomock.Any()).
 					DoAndReturn(func(
@@ -497,7 +510,7 @@ func TestMemoryDatabase_Flush_Error(t *testing.T) {
 				indexDB.EXPECT().GetTimeSeriesIndex(gomock.Any()).Return(timeSeriesIndex, true)
 				timeSeriesIndex.EXPECT().GetTimeRange(gomock.Any()).Return(&timeutil.SlotRange{}, true)
 				timeSeriesIndex.EXPECT().MemTimeSeriesIDs().Return(roaring.BitmapOf(1))
-				mStore.EXPECT().GetFields().Return(field.Metas{{Name: "test", Index: 1}})
+				mStore.EXPECT().GetFields().Return(field.Metas{{Name: "test", Persisted: true, Index: 1}})
 				flusher.EXPECT().PrepareMetric(gomock.Any(), gomock.Any())
 				timeSeriesIndex.EXPECT().FlushMetricsDataTo(gomock.Any(), gomock.Any()).Return(nil)
 				flusher.EXPECT().CommitMetric(gomock.Any()).Return(fmt.Errorf("err"))
```

**File**: `tsdb/memdb/metric_store.go` (modified, +35/-37)
```diff
@@ -18,11 +18,8 @@
 package memdb
 
 import (
-	"sort"
 	"sync"
 
-	"go.uber.org/atomic"
-
 	"github.com/lindb/lindb/series/field"
 )
 
@@ -42,76 +39,77 @@ type mStoreINTF interface {
 
 // metricStore represents metric level storage, stores all series data, and fields/family times metadata
 type metricStore struct {
-	fields atomic.Value // field metadata(field.Metas)
+	fields sync.Map // field metadata(field.Metas)
 
-	lock sync.RWMutex
+	fieldCount int
+	lock       sync.RWMutex
 }
 
 // newMetricStore returns a new mStoreINTF.
 func newMetricStore() mStoreINTF {
 	var ms metricStore
-	// init field metas
-	ms.fields.Store(field.Metas{})
 	return &ms
 }
 
 // GetFields returns all field metas.
-func (ms *metricStore) GetFields() field.Metas {
-	ms.lock.RLock()
-	defer ms.lock.RUnlock()
-
-	mFields := ms.fields.Load().(field.Metas)
-	return mFields.Clone()
+func (ms *metricStore) GetFields() (fields field.Metas) {
+	ms.fields.Range(func(key, value any) bool {
+		fields = append(fields, value.(field.Meta))
+		return true
+	})
+	return fields
 }
 
 // GenField generates field meta under memory database.
 func (ms *metricStore) GenField(name field.Name, fType field.Type) (f field.Meta, created bool) {
+	fm, ok := ms.fields.Load(name)
+	if ok {
+		return fm.(field.Meta), false
+	}
+
 	ms.lock.Lock()
 	defer ms.lock.Unlock()
 
-	// TODO: use sync.Map?
-	fields := ms.fields.Load().(field.Metas)
-	fm, ok := fields.GetFromName(name)
+	return ms.genField(name, fType)
+}
+
+func (ms *metricStore) genField(name field.Name, fType field.Type) (f field.Meta, created bool) {
+	fm, ok := ms.fields.Load(name)
 	if ok {
-		return fm, false
+		return fm.(field.Meta), false
 	}
 
-	index := uint8(len(fields))
-	fm = field.Meta{
+	index := uint8(ms.fieldCount)
+	f = field.Meta{
 		Type:  fType,
 		Name:  name, // TODO: check name
 		Index: index,
 	}
-	fields = append(fields, fm)
-	// sort by field name
-	sort.Sort(fields)
-	ms.fields.Store(fields)
-	return fm, true
+	ms.fieldCount++
+	ms.fields.Store(name, f)
+	return f, true
 }
 
 // UpdateFieldMeta updates field meta after metric meta updated.
 func (ms *metricStore) UpdateFieldMeta(fieldID field.ID, fm field.Meta) {
-	ms.lock.Lock()
-	defer ms.lock.Unlock()
-
-	fields := ms.fields.Load().(field.Metas)
-
-	idx, ok := fields.FindIndexByName(fm.Name)
+	f, ok := ms.fields.Load(fm.Name)
 	if ok {
-		fields[idx].ID = fieldID
-		fields[idx].Persisted = true
-	}
+		ms.lock.Lock()
+		defer ms.lock.Unlock()
 
-	ms.fields.Store(fields)
+		fm := f.(field.Meta)
+		fm.ID = fieldID
+		fm.Persisted = true
+		ms.fields.Store(fm.Name, fm)
+	}
 }
 
 // FindFields returns fields from store based on current written fields.
 func (ms *metricStore) FindFields(fields field.Metas) (found field.Metas) {
-	mFields := ms.fields.Load().(field.Metas)
 	for _, f := range fields {
-		fm, ok := mFields.Find(f.Name)
+		fm, ok := ms.fields.Load(f.Name)
 		if ok {
-			found = append(found, fm)
+			found = append(found, fm.(field.Meta))
 		}
 	}
 	return
```

**File**: `tsdb/memdb/metric_store_test.go` (modified, +18/-62)
```diff
@@ -17,65 +17,21 @@
 
 package memdb
 
-// func TestMetricStore_SetTimestamp(t *testing.T) {
-// 	mStoreInterface := newMetricStore()
-// 	mStoreInterface.SetSlot(10)
-// 	slotRange := mStoreInterface.GetSlotRange()
-// 	assert.Equal(t, uint16(10), slotRange.Start)
-// 	assert.Equal(t, uint16(10), slotRange.End)
-// 	mStoreInterface.SetSlot(5)
-// 	slotRange = mStoreInterface.GetSlotRange()
-// 	assert.Equal(t, uint16(5), slotRange.Start)
-// 	assert.Equal(t, uint16(10), slotRange.End)
-// 	mStoreInterface.SetSlot(50)
-// 	slotRange = mStoreInterface.GetSlotRange()
-// 	assert.Equal(t, uint16(5), slotRange.Start)
-// 	assert.Equal(t, uint16(50), slotRange.End)
-// }
-//
-// func TestMetricStore_Flush_Error(t *testing.T) {
-// 	ctrl := gomock.NewController(t)
-// 	defer ctrl.Finish()
-// 	flusher := metricsdata.NewMockFlusher(ctrl)
-// 	flusher.EXPECT().PrepareMetric(gomock.Any(), gomock.Any()).AnyTimes()
-// 	ids := imap.NewIntMap[uint32]()
-// 	ids.Put(1, 1)
-// 	ms := &metricStore{
-// 		slotRange: &timeutil.SlotRange{Start: 0},
-// 		ids:       ids,
-// 	}
-// 	cases := []struct {
-// 		name    string
-// 		prepare func()
-// 		wantErr bool
-// 	}{
-// 		{
-// 			name: "no field",
-// 			prepare: func() {
-// 				ms.fields = nil
-// 			},
-// 		},
-// 		{
-// 			name: "flush field error",
-// 			prepare: func() {
-// 				ms.fields = append(ms.fields, field.Meta{ID: 1, Persisted: true})
-// 			},
-// 			wantErr: true,
-// 		},
-// 	}
-// 	for i := range cases {
-// 		tt := cases[i]
-// 		t.Run(tt.name, func(t *testing.T) {
-// 			tt.prepare()
-// 			err := ms.FlushMetricsDataTo(flusher,
-// 				&flushContext{},
-// 				func(memSeriesID uint32, fields field.Metas) error {
-// 					return fmt.Errorf("err")
-// 				},
-// 			)
-// 			if (err != nil) != tt.wantErr {
-// 				t.Fatal(tt.name)
-// 			}
-// 		})
-// 	}
-// }
+import (
+	"testing"
+
+	"github.com/stretchr/testify/assert"
+
+	"github.com/lindb/lindb/series/field"
+)
+
+func TestMetricStore_genField(t *testing.T) {
+	ms := &metricStore{}
+	f, isNew := ms.genField("test", field.SumField)
+	assert.True(t, isNew)
+	assert.Equal(t, field.Meta{Name: "test", Type: field.SumField, Index: 0}, f)
+
+	f, isNew = ms.genField("test", field.SumField)
+	assert.False(t, isNew)
+	assert.Equal(t, field.Meta{Name: "test", Type: field.SumField, Index: 0}, f)
+}
```

**File**: `web/package.json` (modified, +1/-1)
```diff
@@ -70,6 +70,6 @@
     "stylelint-plugin-license-header": "^1.0.3",
     "stylelint-prettier": "^3.0.0",
     "typescript": "^4.3.2",
-    "vite": "^2.6.4"
+    "vite": "^2.9.18"
   }
 }
```

**File**: `web/vite.config.ts` (modified, +4/-1)
```diff
@@ -17,7 +17,7 @@ under the License.
 */
 import { defineConfig } from "vite";
 import react from "@vitejs/plugin-react";
-const path = require("path");
+import path from "path";
 
 // https://vitejs.dev/config/
 export default defineConfig({
@@ -41,5 +41,8 @@ export default defineConfig({
   },
   build: {
     outDir: "build",
+    rollupOptions: {
+      external: ["#minpath", "#minproc", "#minurl"],
+    },
   },
 });
```

**File**: `web/yarn.lock` (modified, +5/-5)
```diff
@@ -5752,9 +5752,9 @@ __metadata:
   languageName: node
   linkType: hard
 
-"vite@npm:^2.6.4":
-  version: 2.9.15
-  resolution: "vite@npm:2.9.15"
+"vite@npm:^2.9.18":
+  version: 2.9.18
+  resolution: "vite@npm:2.9.18"
   dependencies:
     esbuild: "npm:^0.14.27"
     fsevents: "npm:~2.3.2"
@@ -5777,7 +5777,7 @@ __metadata:
       optional: true
   bin:
     vite: bin/vite.js
-  checksum: 10c0/3bc83ea78396215a4d1dbf8b7c8c81869e9c3a877593a87978b964baa6ea675b6063b275e01f6c818d18bee78b32a9f94adc6f76b8023eecb12f9cd8f6dde727
+  checksum: 10c0/2325b272e473981d7c589f4b28485a60d641bad2a42bae387002ea92c6f8d9664f76b2d35aaf52c81feac5c642399db62598668f40db4198fce138a5df9a3e06
   languageName: node
   linkType: hard
 
@@ -5833,7 +5833,7 @@ __metadata:
     stylelint-prettier: "npm:^3.0.0"
     typescript: "npm:^4.3.2"
     uuid: "npm:^8.3.2"
-    vite: "npm:^2.6.4"
+    vite: "npm:^2.9.18"
   languageName: unknown
   linkType: soft
 
```

---

### Incident Patch 7: `cf501e9c` (2024-07-16)
**Commit Message**: [bug]: fix get wrong data from memory database (#1034)

**File**: `query/operator/metadata_lookup.go` (modified, +1/-1)
```diff
@@ -121,7 +121,6 @@ func (op *metadataLookup) buildField() {
 	for fieldID := range op.fields {
 		f := op.fields[fieldID]
 		op.executeCtx.Fields[idx] = field.Meta{
-			// FIXME: need set field index
 			ID:   fieldID,
 			Type: f.DownSampling.GetFieldType(),
 			Name: f.DownSampling.FieldName(),
@@ -135,6 +134,7 @@ func (op *metadataLookup) buildField() {
 	op.executeCtx.AggregatorSpecs = make(aggregation.AggregatorSpecs, lengthOfFields)
 	for fieldIdx, fieldMeta := range op.executeCtx.Fields {
 		f := op.fields[fieldMeta.ID]
+		op.executeCtx.Fields[fieldIdx].Index = uint8(fieldIdx) // NOTE: read field index for memory data read
 		op.executeCtx.DownSamplingSpecs[fieldIdx] = f.DownSampling
 		op.executeCtx.AggregatorSpecs[fieldIdx] = f.Aggregator
 	}
```

**File**: `series/field/metas.go` (modified, +2/-1)
```diff
@@ -112,7 +112,8 @@ func (fms Metas) Find(fieldName Name) (Meta, bool) {
 	return Meta{}, false
 }
 
-// GetFromName searches the meta by fieldName, return false when not exist
+// GetFromName searches the meta by fieldName, return false when not exist.
+// NOTE: Metas must be sorted.
 func (fms Metas) GetFromName(fieldName Name) (Meta, bool) {
 	idx := sort.Search(len(fms), func(i int) bool { return fms[i].Name >= fieldName })
 	if idx >= len(fms) || fms[idx].Name != fieldName {
```

**File**: `series/field/metas_test.go` (modified, +16/-1)
```diff
@@ -19,6 +19,7 @@ package field
 
 import (
 	"bytes"
+	"fmt"
 	"sort"
 	"strconv"
 	"testing"
@@ -29,7 +30,7 @@ import (
 )
 
 func Test_Metas(t *testing.T) {
-	var metas = Metas{}
+	metas := Metas{}
 	ids := make(map[uint16]struct{})
 	for i := uint16(0); i < 230; i++ {
 		ids[i] = struct{}{}
@@ -117,3 +118,17 @@ func TestMeta_Write_Error(t *testing.T) {
 	assert.Error(t, m.Write(mock.NewWriter(2)))
 	assert.Error(t, m.Write(mock.NewWriter(3)))
 }
+
+func TestMetas_Find(t *testing.T) {
+	fields := Metas{
+		{Name: "HistogramSum"},
+		{Name: "HistogramMin"},
+		{Name: "HistogramMax"},
+		{Name: "HistogramCount"},
+	}
+	sort.Sort(fields)
+	fmt.Println(fields)
+	f, ok := fields.Find("HistogramMax")
+	assert.True(t, ok)
+	assert.Equal(t, Name("HistogramMax"), f.Name)
+}
```

**File**: `tsdb/memdb/metric_store.go` (modified, +3/-1)
```diff
@@ -32,6 +32,7 @@ import (
 type mStoreINTF interface {
 	// GenField generates field meta under memory database.
 	GenField(fieldName field.Name, fieldType field.Type) (f field.Meta, created bool)
+	// GetFields returns all field metas.
 	GetFields() field.Metas
 	// UpdateFieldMeta updates field meta after metric meta updated.
 	UpdateFieldMeta(fieldID field.ID, fm field.Meta)
@@ -54,6 +55,7 @@ func newMetricStore() mStoreINTF {
 	return &ms
 }
 
+// GetFields returns all field metas.
 func (ms *metricStore) GetFields() field.Metas {
 	ms.lock.RLock()
 	defer ms.lock.RUnlock()
@@ -82,7 +84,7 @@ func (ms *metricStore) GenField(name field.Name, fType field.Type) (f field.Meta
 	}
 	fields = append(fields, fm)
 	// sort by field name
-	sort.Slice(fields, func(i, j int) bool { return fields[i].Name < fields[j].Name })
+	sort.Sort(fields)
 	ms.fields.Store(fields)
 	return fm, true
 }
```

**File**: `tsdb/memdb/metric_store_filter.go` (modified, +4/-2)
```diff
@@ -19,6 +19,7 @@ package memdb
 
 import (
 	"fmt"
+	"sort"
 
 	commontimeutil "github.com/lindb/common/pkg/timeutil"
 	"github.com/lindb/roaring"
@@ -79,7 +80,9 @@ func (md *memoryDatabase) filter(shardExecuteContext *flow.ShardExecuteContext,
 		// metric meta not found
 		return nil, nil
 	}
-	fields := shardExecuteContext.StorageExecuteCtx.Fields
+	fields := shardExecuteContext.StorageExecuteCtx.Fields.Clone()
+	// NOTE: must re-stort by field name, if not cannot find field from query fields
+	sort.Sort(fields)
 	// first need check query's fields is match store's fields, if not return.
 	foundFields := mStore.FindFields(fields)
 	if len(foundFields) == 0 {
@@ -91,7 +94,6 @@ func (md *memoryDatabase) filter(shardExecuteContext *flow.ShardExecuteContext,
 	for _, fm := range foundFields {
 		fStore, ok := md.fieldWriteStores.Load(fm.Index)
 		fcStore, fcOK := md.fieldCompressStore.Load(fm.Index)
-
 		if ok || fcOK {
 			queryField, _ := fields.GetFromName(fm.Name)
 			fieldEntry := &fieldEntry{
```

**File**: `tsdb/tblstore/metricsdata/reader.go` (modified, +9/-10)
```diff
@@ -62,16 +62,15 @@ type MetricReader interface {
 
 // metricReader implements MetricReader interface that reads metric block
 type metricReader struct {
-	path           string
-	metricBlock    []byte
-	seriesBucket   []byte
-	highKeyOffsets *encoding.FixedOffsetDecoder
-	seriesIDs      *roaring.Bitmap
-	fields         field.Metas
-	crc32CheckSum  uint32
-	timeRange      timeutil.SlotRange
-
-	readFieldIndexes []int // read field indexes be used when query metric data
+	highKeyOffsets   *encoding.FixedOffsetDecoder
+	seriesIDs        *roaring.Bitmap
+	path             string
+	metricBlock      []byte
+	seriesBucket     []byte
+	fields           field.Metas
+	readFieldIndexes []int
+	crc32CheckSum    uint32
+	timeRange        timeutil.SlotRange
 }
 
 // NewReader creates a metric block metricReader
```

---

### Incident Patch 8: `a3b39d95` (2024-07-12)
**Commit Message**: [bug]: miss makezero in slice init (#1032)

**File**: `.codecov.yml` (modified, +1/-0)
```diff
@@ -18,5 +18,6 @@ coverage:
 # which folders/files to ignore
 ignore:
   - "web"         # ignore web folders
+  - "proto"         # ignore web folders
   - "mock"        # ignore mock folders
   - "sql/grammar" # ignore sql grammar generate files
```

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -25,7 +25,7 @@ require (
 	github.com/jedib0t/go-pretty/v6 v6.4.6
 	github.com/json-iterator/go v1.1.12
 	github.com/klauspost/compress v1.17.1
-	github.com/lindb/common v0.0.5
+	github.com/lindb/common v0.0.6
 	github.com/lindb/roaring v1.2.1
 	github.com/lithammer/go-jump-consistent-hash v1.0.2
 	github.com/munnerz/goautoneg v0.0.0-20191010083416-a7dc8b61c822
```

**File**: `go.sum` (modified, +2/-2)
```diff
@@ -476,8 +476,8 @@ github.com/kylelemons/godebug v1.1.0/go.mod h1:9/0rRGxNHcop5bhtWyNeEfOS8JIWk580+
 github.com/leodido/go-urn v1.2.0/go.mod h1:+8+nEpDfqqsY+g338gtMEUOtuK+4dEMhiQEgxpxOKII=
 github.com/leodido/go-urn v1.2.1 h1:BqpAaACuzVSgi/VLzGZIobT2z4v53pjosyNd9Yv6n/w=
 github.com/leodido/go-urn v1.2.1/go.mod h1:zt4jvISO2HfUBqxjfIshjdMTYS56ZS/qv49ictyFfxY=
-github.com/lindb/common v0.0.5 h1:sXgWXQRApCREvd3z79Ya3vNjcAw/n3EMLl7Ka6i9ilo=
-github.com/lindb/common v0.0.5/go.mod h1:ZSkV9Ds0TlY7N4xSOznTw9OSsbzMW0SqXGOWldvqDd8=
+github.com/lindb/common v0.0.6 h1:Wq8+hMPXJ64Y4oVqwRovaJwHx9RleOfOi6TbwH006oc=
+github.com/lindb/common v0.0.6/go.mod h1:ZSkV9Ds0TlY7N4xSOznTw9OSsbzMW0SqXGOWldvqDd8=
 github.com/lindb/roaring v1.2.1 h1:Ik1hEg3i55CwNOYefdKWWYfm5CUy4SWp84zMSDxZSEo=
 github.com/lindb/roaring v1.2.1/go.mod h1:MDk6EPsveXlV1nOxVGw5XgoWekxVdiaVALgrrzMjg6E=
 github.com/linode/linodego v1.23.0 h1:s0ReCZtuN9Z1IoUN9w1RLeYO1dMZUGPwOQ/IBFsBHtU=
```

**File**: `prometheus/engine.go` (modified, +8/-5)
```diff
@@ -44,12 +44,15 @@ type Logger struct {
 }
 
 func (l *Logger) Log(keyvals ...interface{}) error {
-	fields := make([]zap.Field, len(keyvals)/2)
-	for i := 1; i < len(keyvals); i++ {
-		key := fmt.Sprintf("%v", keyvals[i-1])
-		fields = append(fields, logger.Any(key, keyvals[i]))
+	if l.logger.Enabled(logger.DebugLevel) {
+		// heavy op, need check log level if enabled
+		fields := make([]zap.Field, 0, len(keyvals)/2)
+		for i := 1; i < len(keyvals); i++ {
+			key := fmt.Sprintf("%v", keyvals[i-1])
+			fields = append(fields, logger.Any(key, keyvals[i]))
+		}
+		l.logger.Debug("prometheus", fields...)
 	}
-	l.logger.Debug("prometheus", fields...)
 	return nil
 }
 
```

---

### Incident Patch 9: `277d3f2c` (2024-07-12)
**Commit Message**: [bug]: fix build docker fail (#1031)

**File**: `Dockerfile` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@ COPY Makefile Makefile
 RUN make build-frontend
 
 # Build the manager binary
-FROM golang:1.21 as go_builder
+FROM golang:1.22 as go_builder
 ARG TARGETOS
 ARG TARGETARCH
 ARG LD_FLAGS
```

**File**: `Dockerfile-gh` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 # Build the manager binary
-FROM golang:1.21 as go_builder
+FROM golang:1.22 as go_builder
 ARG TARGETOS
 ARG TARGETARCH
 ARG LD_FLAGS
```

**File**: `internal/linmetric/histogram_delta.go` (modified, +1/-1)
```diff
@@ -31,11 +31,11 @@ import (
 // however, you can also specify your own buckets.
 // Prometheus Histogram's buckets are cumulative where values in each buckets is cumulative,
 type BoundHistogram struct {
-	mu             sync.Mutex
 	bkts           *histogramBuckets
 	lastValues     []float64
 	lastTotalCount float64
 	lastTotalSum   float64
+	mu             sync.Mutex
 }
 
 func NewHistogram() *BoundHistogram {
```

**File**: `internal/linmetric/histogram_test.go` (modified, +7/-1)
```diff
@@ -18,6 +18,7 @@
 package linmetric
 
 import (
+	"fmt"
 	"sync"
 	"testing"
 	"time"
@@ -51,7 +52,12 @@ func Test_Histogram(t *testing.T) {
 			dh.UpdateSince(time.Now().Add(time.Second))      // drop
 			dh.UpdateSince(time.Now().Add(-1 * time.Second)) // bucket0
 		})
-	assert.InDeltaSlice(t, []float64{100, 100, 300, 200, 300}, dh.bkts.values, 0.01)
+	fmt.Println(dh.bkts.values)
+	var values []int
+	for _, v := range dh.bkts.values {
+		values = append(values, int(v))
+	}
+	assert.Equal(t, []int{100, 100, 300, 200, 300}, values)
 }
 
 func concurrentDo(f func()) {
```

---

### Incident Patch 10: `e86c6f9f` (2024-07-12)
**Commit Message**: [opt]: reduce memory database memory usage (#1030)

**File**: `.gitignore` (modified, +5/-2)
```diff
@@ -40,9 +40,10 @@ docker/storage*/
 default.etcd
 web/node_modules/
 web/build/*
-web/static/*
-web/yarn-error.log
+web/static/* web/yarn-error.log
 web/package-lock.json
+web/.yarn
+web/.yarnrc.yml
 
 # Test binary, built with `go test -c`
 *.test
@@ -51,6 +52,8 @@ web/package-lock.json
 # Output of the go coverage tool, specifically when used with LiteIDE
 *.out
 *.cov
+*.tmp
+coverage.html
 
 /data
 
```

**File**: `Makefile` (modified, +2/-1)
```diff
@@ -63,7 +63,7 @@ format: ## go format
 lint: ## run lint
 ifeq (, $(shell which golangci-lint))
 	# binary will be $(go env GOPATH)/bin/golangci-lint
-	curl -sSfL https://raw.githubusercontent.com/golangci/golangci-lint/master/install.sh | sh -s -- -b $(shell go env GOPATH)/bin v1.55.2
+	curl -sSfL https://raw.githubusercontent.com/golangci/golangci-lint/master/install.sh | sh -s -- -b $(shell go env GOPATH)/bin v1.57.2
 else
 	echo "Found golangci-lint"
 endif
@@ -79,6 +79,7 @@ test-without-lint: ## Run test without lint
 	LOG_LEVEL=fatal ## disable log for test
 	gotest -v -race -coverprofile=coverage_tmp.out -covermode=atomic ./...
 	cat coverage_tmp.out |grep -v "_mock.go" > coverage.out
+	go tool cover -html=coverage.out -o coverage.html
 
 test: header lint test-without-lint ## Run test cases.
 
```

**File**: `app/standalone/runtime.go` (modified, +3/-4)
```diff
@@ -23,11 +23,10 @@ import (
 	"net/url"
 	"time"
 
-	"go.etcd.io/etcd/server/v3/embed"
-	"go.uber.org/zap/zapcore"
-
 	"github.com/lindb/common/pkg/logger"
 	commontimeutil "github.com/lindb/common/pkg/timeutil"
+	"go.etcd.io/etcd/server/v3/embed"
+	"go.uber.org/zap/zapcore"
 
 	"github.com/lindb/lindb/app/broker"
 	"github.com/lindb/lindb/app/storage"
@@ -200,7 +199,7 @@ func (r *runtime) Stop() {
 func (r *runtime) startETCD() error {
 	cfg := embed.NewConfig()
 	lcurl, _ := url.Parse(r.cfg.ETCD.URL)
-	cfg.LCUrls = []url.URL{*lcurl}
+	cfg.ListenClientUrls = []url.URL{*lcurl}
 	cfg.Dir = r.cfg.ETCD.Dir
 	// always set etcd runtime to error level
 	cfg.LogLevel = zapcore.ErrorLevel.String()
```

**File**: `app/storage/runtime.go` (modified, +39/-34)
```diff
@@ -70,6 +70,11 @@ type rpcHandler struct {
 	task    *query.TaskHandler
 }
 
+var (
+	maxRetries    = 20
+	retryInterval = time.Second
+)
+
 // just for testing
 var (
 	getHostIP                 = hostutil.GetHostIP
@@ -225,28 +230,33 @@ func (r *runtime) Run() error {
 	// start http server
 	r.startHTTPServer()
 
+	discoveryFactory := discovery.NewFactory(r.repo)
+	r.stateMachineFactory = newStateMachineFactory(r.ctx, discoveryFactory, r.stateMgr)
 	r.dbLifecycle = newDatabaseLifecycleFn(r.ctx, r.repo, r.walMgr, r.engine)
 	r.dbLifecycle.Startup()
 
-	// Use Leader election mechanism to ensure the uniqueness of stateful node id
-	if err := r.MustRegisterStatefulNode(); err != nil {
+	if err := r.startStorageState(); err != nil {
+		r.state = server.Failed
 		return err
 	}
-	discoveryFactory := discovery.NewFactory(r.repo)
-	// finally, start all state machine
-	r.stateMachineFactory = newStateMachineFactory(r.ctx, discoveryFactory, r.stateMgr)
-
-	if err := r.stateMachineFactory.Start(); err != nil {
-		return fmt.Errorf("start state machines error: %s", err)
-	}
-
 	// start system collector
 	r.SystemCollector()
 	// start stat monitoring
 	r.NativePusher()
 
 	r.state = server.Running
+	return nil
+}
 
+func (r *runtime) startStorageState() error {
+	// Use Leader election mechanism to ensure the uniqueness of stateful node id
+	if err := r.MustRegisterStatefulNode(); err != nil {
+		return err
+	}
+	// finally, start all state machine
+	if err := r.stateMachineFactory.Start(); err != nil {
+		return fmt.Errorf("start state machines error: %s", err)
+	}
 	return nil
 }
 
@@ -256,16 +266,12 @@ func (r *runtime) MustRegisterStatefulNode() error {
 		logger.Int("indicator", int(r.node.ID)),
 		logger.String("lease-ttl", r.config.Coordinator.LeaseTTL.String()),
 	)
-	var (
-		err           error
-		maxRetries    = 20
-		retryInterval = time.Second
-	)
+	var err error
 	// sometimes lease isn't expired when storage restarts, retry registering is necessary
 	for attempt := 1; attempt <= maxRetries; attempt++ {
 		select {
 		case <-r.ctx.Done(): // no more retries when context is done
-			return nil
+			return r.ctx.Err()
 		default:
 		}
 		// register storage node info
@@ -288,13 +294,8 @@ func (r *runtime) MustRegisterStatefulNode() error {
 		return nil
 	}
 	r.state = server.Failed
-	if err != nil {
-		// stateful node register err
-		return err
-	}
-	// stateful node already exist
-	r.state = server.Failed
-	return constants.ErrStatefulNodeExist
+	// stateful node register err
+	return err
 }
 
 // State returns current storage server state
@@ -404,12 +405,14 @@ func (r *runtime) startHTTPServer() {
 	metadataAPI := stateapi.NewMetadataAPI(r.engine)
 	metadataAPI.Register(v1)
 
-	go func() {
-		if err := r.httpServer.Run(); err != http.ErrServerClosed {
-			panic(fmt.Sprintf("start http server with error: %s", err))
-		}
-		r.log.Info("http server stopped successfully")
-	}()
+	go r.runHTTPServer()
+}
+
+func (r *runtime) runHTTPServer() {
+	if err := r.httpServer.Run(); err != http.ErrServerClosed {
+		panic(fmt.Sprintf("start http server with error: %s", err))
+	}
+	r.log.Info("http server stopped successfully")
 }
 
 // startTCPServer starts tcp server
@@ -419,11 +422,13 @@ func (r *runtime) startTCPServer() {
 	// bind rpc handlers
 	r.bindRPCHandlers()
 
-	go func() {
-		if err := r.server.Start(); err != nil {
-			panic(err)
-		}
-	}()
+	go r.startRPCServer()
+}
+
+func (r *runtime) startRPCServer() {
+	if err := r.server.Start(); err != nil {
+		panic(err)
+	}
 }
 
 // bindRPCHandlers binds rpc handlers, registers task into grpc server
```

**File**: `app/storage/runtime_test.go` (modified, +89/-0)
```diff
@@ -28,17 +28,20 @@ import (
 
 	"github.com/lindb/common/pkg/encoding"
 	"github.com/lindb/common/pkg/fileutil"
+	"github.com/lindb/common/pkg/logger"
 	"github.com/lindb/common/pkg/ltoml"
 	"github.com/stretchr/testify/assert"
 	"go.uber.org/mock/gomock"
 
 	"github.com/lindb/lindb/config"
 	"github.com/lindb/lindb/constants"
+	"github.com/lindb/lindb/coordinator/discovery"
 	storagepkg "github.com/lindb/lindb/coordinator/storage"
 	"github.com/lindb/lindb/internal/mock"
 	"github.com/lindb/lindb/internal/server"
 	"github.com/lindb/lindb/models"
 	"github.com/lindb/lindb/pkg/hostutil"
+	"github.com/lindb/lindb/pkg/http"
 	"github.com/lindb/lindb/pkg/state"
 	"github.com/lindb/lindb/replica"
 	"github.com/lindb/lindb/rpc"
@@ -222,6 +225,42 @@ func TestStorageRun_Err(t *testing.T) {
 	assert.Error(t, err)
 }
 
+func TestStorage_StartStorageState_Error(t *testing.T) {
+	ctrl := gomock.NewController(t)
+	defer func() {
+		ctrl.Finish()
+		newRegistry = discovery.NewRegistry
+	}()
+	maxRetries = 2
+	retryInterval = time.Millisecond * 10
+	registry := discovery.NewMockRegistry(ctrl)
+	newRegistry = func(repo state.Repository, path string, node models.Node, ttl time.Duration) discovery.Registry {
+		return registry
+	}
+	smFactory := discovery.NewMockStateMachineFactory(ctrl)
+
+	ctx, cancel := context.WithCancel(context.TODO())
+	r := &runtime{
+		ctx:                 ctx,
+		log:                 logger.GetLogger("Storage", "Register"),
+		node:                &models.StatefulNode{},
+		stateMachineFactory: smFactory,
+		config: &config.Storage{
+			Coordinator: config.RepoState{
+				LeaseTTL: ltoml.Duration(time.Minute),
+			},
+		},
+	}
+	registry.EXPECT().Register().Return(fmt.Errorf("err")).MaxTimes(2)
+	assert.Error(t, r.startStorageState())
+	smFactory.EXPECT().Start().Return(fmt.Errorf("err"))
+	registry.EXPECT().Register().Return(nil)
+	assert.Error(t, r.startStorageState())
+
+	cancel()
+	assert.Error(t, r.startStorageState())
+}
+
 func TestStorage_MyID(t *testing.T) {
 	defer func() {
 		existFn = fileutil.Exist
@@ -357,3 +396,53 @@ func TestStorage_Run_With_Wrong_MyID(t *testing.T) {
 	assert.Error(t, err)
 	assert.Equal(t, server.Failed, r.State())
 }
+
+func TestStorage_StartServer_Fail(t *testing.T) {
+	ctrl := gomock.NewController(t)
+	defer ctrl.Finish()
+
+	rpcServer := rpc.NewMockGRPCServer(ctrl)
+	httpServer := http.NewMockServer(ctrl)
+	r := &runtime{
+		server:     rpcServer,
+		httpServer: httpServer,
+		log:        logger.GetLogger("storage", "test"),
+	}
+	rpcServer.EXPECT().Start().Return(fmt.Errorf("err"))
+	assert.Panics(t, func() {
+		r.startRPCServer()
+	})
+	httpServer.EXPECT().Run().Return(fmt.Errorf("err"))
+	assert.Panics(t, func() {
+		r.runHTTPServer()
+	})
+
+	// port <=0
+	r.config = &config.Storage{
+		StorageBase: config.StorageBase{
+			HTTP: config.HTTP{
+				Port: 0,
+			},
+		},
+	}
+	r.startHTTPServer()
+}
+
+func TestStorage_Stop_Error(t *testing.T) {
+	ctrl := gomock.NewController(t)
+	defer ctrl.Finish()
+	registry := discovery.NewMockRegistry(ctrl)
+	ctx, cancel := context.WithCancel(context.TODO())
+	httpServer := http.NewMockServer(ctrl)
+	r := &runtime{
+		ctx:        ctx,
+		cancel:     cancel,
+		log:        logger.GetLogger("Storage", "test"),
+		registry:   registry,
+		httpServer: httpServer,
+	}
+	registry.EXPECT().Deregister().Return(fmt.Errorf("err"))
+	registry.EXPECT().Close().Return(fmt.Errorf("err"))
+	httpServer.EXPECT().Close(gomock.Any()).Return(fmt.Errorf("err"))
+	r.Stop()
+}
```

**File**: `constants/coordinator_test.go` (modified, +8/-0)
```diff
@@ -47,3 +47,11 @@ func TestGetNodePath(t *testing.T) {
 func TestGetBrokerClusterConfigPath(t *testing.T) {
 	assert.Equal(t, BrokerConfigPath+slashPathName, GetBrokerClusterConfigPath(pathName))
 }
+
+func TestGetLiveNodePath(t *testing.T) {
+	assert.Equal(t, LiveNodesPath+slashPathName, GetLiveNodePath(pathName))
+}
+
+func TestShardAssignPath(t *testing.T) {
+	assert.Equal(t, ShardAssignmentPath+slashPathName, GetShardAssignPath(pathName))
+}
```

**File**: `coordinator/storage/state_machine_factory.go` (modified, +2/-4)
```diff
@@ -50,10 +50,8 @@ type StateMachineFactory struct {
 	ctx              context.Context
 	discoveryFactory discovery.Factory
 	stateMgr         StateManager
-
-	stateMachines []discovery.StateMachine
-
-	logger logger.Logger
+	logger           logger.Logger
+	stateMachines    []discovery.StateMachine
 }
 
 // NewStateMachineFactory creates a StateMachineFactory instance.
```

**File**: `e2e/benchmark/write_metric_test.go` (modified, +1/-1)
```diff
@@ -153,7 +153,7 @@ func TestWriteSumMetric_7Days(b *testing.T) {
 func write(timestamp int64, cli *resty.Client) {
 	for i := 0; i < 40; i++ {
 		var buf bytes.Buffer
-		for j := 0; j < 20; j++ {
+		for j := 0; j < 200; j++ {
 			for k := 0; k < 400; k++ {
 				var brokerRow metric.BrokerRow
 				converter := metric.NewProtoConverter(models.NewDefaultLimits())
```

---

### Incident Patch 11: `bad92282` (2024-05-07)
**Commit Message**: [bug:#1019]: fix storage node goes dead when gc pause (#1026)

* [opt]: upgrade golangci version

* [chore]: change log

* [bug:#1019]: fix storage node goes dead when gc pause

**File**: `app/broker/runtime.go` (modified, +3/-3)
```diff
@@ -216,8 +216,8 @@ func (r *runtime) Run() error {
 	r.master = newMasterController(masterCfg)
 
 	// register broker node info
-	r.registry = newRegistry(r.repo, constants.LiveNodesPath, r.config.Coordinator.LeaseTTL.Duration())
-	err = r.registry.Register(r.node)
+	r.registry = newRegistry(r.repo, constants.GetLiveNodePath(r.node.Indicator()), r.node, r.config.Coordinator.LeaseTTL.Duration())
+	err = r.registry.Register()
 	if err != nil {
 		r.state = server.Failed
 		return fmt.Errorf("register broker node error:%s", err)
@@ -306,7 +306,7 @@ func (r *runtime) Stop() {
 	// close registry, deregister broker node from active list
 	if r.registry != nil {
 		r.logger.Info("closing discovery-registry...")
-		if err := r.registry.Deregister(r.node); err != nil {
+		if err := r.registry.Deregister(); err != nil {
 			r.logger.Error("unregister broker node error", logger.Error(err))
 		}
 		if err := r.registry.Close(); err != nil {
```

**File**: `app/broker/runtime_test.go` (modified, +24/-18)
```diff
@@ -25,11 +25,10 @@ import (
 	"time"
 
 	"github.com/gin-gonic/gin"
+	"github.com/lindb/common/pkg/logger"
 	"github.com/stretchr/testify/assert"
 	"go.uber.org/mock/gomock"
 
-	"github.com/lindb/common/pkg/logger"
-
 	"github.com/lindb/lindb/config"
 	"github.com/lindb/lindb/coordinator"
 	brokerpkg "github.com/lindb/lindb/coordinator/broker"
@@ -58,7 +57,8 @@ var cfg = config.Broker{
 		GRPC: config.GRPC{
 			Port: 2881,
 		},
-	}}
+	},
+}
 
 func init() {
 	gin.SetMode(gin.ReleaseMode)
@@ -112,8 +112,8 @@ func TestBrokerRuntime_Run(t *testing.T) {
 			prepare: func() {
 				repoFct.EXPECT().CreateNormalRepo(gomock.Any()).Return(repo, nil)
 				registry := discovery.NewMockRegistry(ctrl)
-				registry.EXPECT().Register(gomock.Any()).Return(fmt.Errorf("err"))
-				newRegistry = func(repo state.Repository, prefixPath string, ttl time.Duration) discovery.Registry {
+				registry.EXPECT().Register().Return(fmt.Errorf("err"))
+				newRegistry = func(repo state.Repository, path string, node models.Node, ttl time.Duration) discovery.Registry {
 					return registry
 				}
 			},
@@ -124,8 +124,8 @@ func TestBrokerRuntime_Run(t *testing.T) {
 			prepare: func() {
 				repoFct.EXPECT().CreateNormalRepo(gomock.Any()).Return(repo, nil)
 				registry := discovery.NewMockRegistry(ctrl)
-				registry.EXPECT().Register(gomock.Any()).Return(nil)
-				newRegistry = func(repo state.Repository, prefixPath string, ttl time.Duration) discovery.Registry {
+				registry.EXPECT().Register().Return(nil)
+				newRegistry = func(repo state.Repository, path string, node models.Node, ttl time.Duration) discovery.Registry {
 					return registry
 				}
 				mc := coordinator.NewMockMasterController(ctrl)
@@ -142,8 +142,8 @@ func TestBrokerRuntime_Run(t *testing.T) {
 			prepare: func() {
 				repoFct.EXPECT().CreateNormalRepo(gomock.Any()).Return(repo, nil)
 				registry := discovery.NewMockRegistry(ctrl)
-				registry.EXPECT().Register(gomock.Any()).Return(nil)
-				newRegistry = func(repo state.Repository, prefixPath string, ttl time.Duration) discovery.Registry {
+				registry.EXPECT().Register().Return(nil)
+				newRegistry = func(repo state.Repository, path string, node models.Node, ttl time.Duration) discovery.Registry {
 					return registry
 				}
 				mc := coordinator.NewMockMasterController(ctrl)
@@ -157,7 +157,8 @@ func TestBrokerRuntime_Run(t *testing.T) {
 				smFct := discovery.NewMockStateMachineFactory(ctrl)
 				smFct.EXPECT().Start().Return(fmt.Errorf("err"))
 				newStateMachineFactory = func(ctx context.Context, discoveryFactory discovery.Factory,
-					stateMgr brokerpkg.StateManager) discovery.StateMachineFactory {
+					stateMgr brokerpkg.StateManager,
+				) discovery.StateMachineFactory {
 					return smFct
 				}
 			},
@@ -168,8 +169,8 @@ func TestBrokerRuntime_Run(t *testing.T) {
 			prepare: func() {
 				repoFct.EXPECT().CreateNormalRepo(gomock.Any()).Return(repo, nil)
 				registry := discovery.NewMockRegistry(ctrl)
-				registry.EXPECT().Register(gomock.Any()).Return(nil)
-				newRegistry = func(repo state.Repository, prefixPath string, ttl time.Duration) discovery.Registry {
+				registry.EXPECT().Register().Return(nil)
+				newRegistry = func(repo state.Repository, path string, node models.Node, ttl time.Duration) discovery.Registry {
 					return registry
 				}
 				mc := coordinator.NewMockMasterController(ctrl)
@@ -183,7 +184,8 @@ func TestBrokerRuntime_Run(t *testing.T) {
 				smFct := discovery.NewMockStateMachineFactory(ctrl)
 				smFct.EXPECT().Start().Return(nil)
 				newStateMachineFactory = func(ctx context.Context, discoveryFactory discovery.Factory,
-					stateMgr brokerpkg.StateManager) discovery.StateMachineFactory {
+					stateMgr brokerpkg.StateManager,
+				) discovery.StateMachineFactory {
 					return smFct
 				}
 				httpSrv := httppkg.NewMockServer(ctrl)
@@ -253,7 +255,7 @@ func TestBrokerRuntime_Stop(t *testing.T) {
 	connectionMgr := rpc.NewMockConnectionManager(ctrl)
 	channelMgr := replica.NewMockChannelManager(ctrl)
 	grpcServer := rpc.NewMockGRPCServer(ctrl)
-	registry.EXPECT().Deregister(gomock.Any()).Return(fmt.Errorf("err")).AnyTimes()
+	registry.EXPECT().Deregister().Return(fmt.Errorf("err")).AnyTimes()
 
 	cases := []struct {
 		name    string
@@ -330,6 +332,7 @@ func TestBrokerRuntime_startGrpcServer(t *testing.T) {
 		serveGRPC(grpcServer)
 	})
 }
+
 func TestBrokerRuntime_RunHTTPServer(t *testing.T) {
 	ctrl := gomock.NewController(t)
 	defer ctrl.Finish()
@@ -354,23 +357,26 @@ func TestBrokerRuntime_RunHTTPServer(t *testing.T) {
 func resetNewDepsMock() {
 	newStateManager = func(ctx context.Context, currentNode models.StatelessNode,
 		connectionManager rpc.ConnectionManager,
-		taskClientFactory rpc.TaskClientFactory) brokerpkg.StateManager {
+		taskClientFactory rpc.TaskClientFactory,
+	) brokerpkg.StateManager {
 		return nil
 	}
 	newChannelManager = func(ctx context.Context, fct rpc.ClientStreamFactory,
-		stateMgr brokerpkg.StateManager) replica.ChannelMa
```

**File**: `app/root/runtime.go` (modified, +3/-3)
```diff
@@ -169,7 +169,7 @@ func (r *runtime) Run() error {
 		return err
 	}
 	// register root node info
-	r.registry = newRegistry(r.repo, constants.LiveNodesPath, r.config.Coordinator.LeaseTTL.Duration())
+	r.registry = newRegistry(r.repo, constants.GetLiveNodePath(r.node.Indicator()), r.node, r.config.Coordinator.LeaseTTL.Duration())
 
 	if err = r.MustRegisterStatelessNode(); err != nil {
 		r.state = server.Failed
@@ -197,7 +197,7 @@ func (r *runtime) Run() error {
 
 // MustRegisterStatelessNode make sure root node is registered to etcd.
 func (r *runtime) MustRegisterStatelessNode() error {
-	if err := r.registry.Register(r.node); err != nil {
+	if err := r.registry.Register(); err != nil {
 		return fmt.Errorf("register root node error:%s", err)
 	}
 	// sometimes lease isn't expired when storage restarts, retry registering is necessary
@@ -235,7 +235,7 @@ func (r *runtime) Stop() {
 	// close registry, deregister root node from active list
 	if r.registry != nil {
 		r.logger.Info("closing discovery-registry...")
-		if err := r.registry.Deregister(r.node); err != nil {
+		if err := r.registry.Deregister(); err != nil {
 			r.logger.Error("unregister root node error", logger.Error(err))
 		}
 		if err := r.registry.Close(); err != nil {
```

**File**: `app/root/runtime_test.go` (modified, +14/-14)
```diff
@@ -25,17 +25,17 @@ import (
 	"time"
 
 	"github.com/gin-gonic/gin"
-	"github.com/stretchr/testify/assert"
-	"go.uber.org/mock/gomock"
-
 	"github.com/lindb/common/pkg/logger"
 	"github.com/lindb/common/pkg/ltoml"
+	"github.com/stretchr/testify/assert"
+	"go.uber.org/mock/gomock"
 
 	"github.com/lindb/lindb/config"
 	"github.com/lindb/lindb/coordinator/discovery"
 	"github.com/lindb/lindb/coordinator/root"
 	"github.com/lindb/lindb/internal/linmetric"
 	"github.com/lindb/lindb/internal/server"
+	"github.com/lindb/lindb/models"
 	"github.com/lindb/lindb/pkg/hostutil"
 	httppkg "github.com/lindb/lindb/pkg/http"
 	"github.com/lindb/lindb/pkg/state"
@@ -57,12 +57,12 @@ func TestRootRun(t *testing.T) {
 		ctrl.Finish()
 	}()
 	registry := discovery.NewMockRegistry(ctrl)
-	newRegistry = func(_ state.Repository, _ string, _ time.Duration) discovery.Registry {
+	newRegistry = func(_ state.Repository, _ string, _ models.Node, _ time.Duration) discovery.Registry {
 		return registry
 	}
-	registry.EXPECT().Register(gomock.Any()).Return(nil)
+	registry.EXPECT().Register().Return(nil)
 	registry.EXPECT().IsSuccess().Return(true)
-	registry.EXPECT().Deregister(gomock.Any()).Return(fmt.Errorf("err"))
+	registry.EXPECT().Deregister().Return(fmt.Errorf("err"))
 	registry.EXPECT().Close().Return(fmt.Errorf("err"))
 	repoFct := state.NewMockRepositoryFactory(ctrl)
 	newRepositoryFactory = func(_ string) state.RepositoryFactory {
@@ -106,7 +106,7 @@ func TestRootRun_Err(t *testing.T) {
 	}()
 	registry := discovery.NewMockRegistry(ctrl)
 	registry.EXPECT().IsSuccess().Return(true)
-	newRegistry = func(_ state.Repository, _ string, _ time.Duration) discovery.Registry {
+	newRegistry = func(_ state.Repository, _ string, _ models.Node, _ time.Duration) discovery.Registry {
 		return registry
 	}
 	cfg.HTTP.Port = 3991
@@ -141,19 +141,19 @@ func TestRootRun_Err(t *testing.T) {
 	})
 	t.Run("register node fail", func(t *testing.T) {
 		repoFct.EXPECT().CreateRootRepo(gomock.Any()).Return(nil, nil)
-		registry.EXPECT().Register(gomock.Any()).Return(fmt.Errorf("err"))
+		registry.EXPECT().Register().Return(fmt.Errorf("err"))
 		r := NewRootRuntime("test-version", &cfg)
 		err := r.Run()
 		assert.Error(t, err)
 	})
 	t.Run("start state machine fail", func(t *testing.T) {
 		repoFct.EXPECT().CreateRootRepo(gomock.Any()).Return(nil, nil)
-		registry.EXPECT().Register(gomock.Any()).Return(nil)
+		registry.EXPECT().Register().Return(nil)
 		stateMachineFct.EXPECT().Start().Return(fmt.Errorf("err"))
 		r := NewRootRuntime("test-version", &cfg)
 		err := r.Run()
 		assert.Error(t, err)
-		registry.EXPECT().Deregister(gomock.Any()).Return(nil)
+		registry.EXPECT().Deregister().Return(nil)
 		registry.EXPECT().Close().Return(nil)
 		r.Stop()
 	})
@@ -237,22 +237,22 @@ func TestRuntime_MustRegisterNode(t *testing.T) {
 		ctx:      ctx,
 		registry: register,
 	}
-	register.EXPECT().Register(gomock.Any()).Return(fmt.Errorf("err"))
+	register.EXPECT().Register().Return(fmt.Errorf("err"))
 	err := r.MustRegisterStatelessNode()
 	assert.Error(t, err)
 
-	register.EXPECT().Register(gomock.Any()).Return(nil)
+	register.EXPECT().Register().Return(nil)
 	register.EXPECT().IsSuccess().Return(true)
 	err = r.MustRegisterStatelessNode()
 	assert.NoError(t, err)
 
-	register.EXPECT().Register(gomock.Any()).Return(nil)
+	register.EXPECT().Register().Return(nil)
 	register.EXPECT().IsSuccess().Return(false).MaxTimes(2)
 	err = r.MustRegisterStatelessNode()
 	assert.Error(t, err)
 
 	cancel()
-	register.EXPECT().Register(gomock.Any()).Return(nil)
+	register.EXPECT().Register().Return(nil)
 	err = r.MustRegisterStatelessNode()
 	assert.NoError(t, err)
 }
```

**File**: `app/runtime.go` (modified, +3/-4)
```diff
@@ -37,12 +37,11 @@ var (
 // BaseRuntime represents the common logic of runtime.
 type BaseRuntime struct {
 	ctx             context.Context
-	monitor         config.Monitor
-	registry        *linmetric.Registry
 	pusher          monitoring.NativePusher
+	logger          logger.Logger
+	registry        *linmetric.Registry
+	monitor         config.Monitor
 	globalKeyValues tag.Tags
-
-	logger logger.Logger
 }
 
 // NewBaseRuntime creates a base runtime instance.
```

**File**: `app/storage/runtime.go` (modified, +45/-46)
```diff
@@ -27,7 +27,6 @@ import (
 	"strconv"
 	"time"
 
-	"github.com/lindb/common/pkg/encoding"
 	"github.com/lindb/common/pkg/fileutil"
 	"github.com/lindb/common/pkg/logger"
 	"github.com/lindb/common/pkg/timeutil"
@@ -75,6 +74,7 @@ type rpcHandler struct {
 var (
 	getHostIP                 = hostutil.GetHostIP
 	hostName                  = os.Hostname
+	newRegistry               = discovery.NewRegistry
 	newStateMachineFactory    = storage.NewStateMachineFactory
 	newDatabaseLifecycleFn    = NewDatabaseLifecycle
 	newEngineFn               = tsdb.NewEngine
@@ -89,34 +89,30 @@ var (
 
 // runtime represents storage runtime dependency
 type runtime struct {
-	app.BaseRuntime
-	myID    int // default myid value
-	state   server.State
-	version string
-	config  *config.Storage
-
-	ctx    context.Context
-	cancel context.CancelFunc
-
-	jobScheduler kv.JobScheduler
-
+	factory             factory
 	stateMachineFactory discovery.StateMachineFactory
+	queryPool           concurrent.Pool
+	httpServer          httppkg.Server
+	engine              tsdb.Engine
+	ctx                 context.Context
+	log                 logger.Logger
+	jobScheduler        kv.JobScheduler
+	repoFactory         state.RepositoryFactory
 	stateMgr            storage.StateManager
 	walMgr              replica.WriteAheadLogManager
 	dbLifecycle         DatabaseLifecycle
-
-	node            *models.StatefulNode
-	server          rpc.GRPCServer
-	repoFactory     state.RepositoryFactory
-	repo            state.Repository
-	factory         factory
-	engine          tsdb.Engine
-	rpcHandler      *rpcHandler
-	httpServer      httppkg.Server
-	queryPool       concurrent.Pool
+	repo                state.Repository
+	server              rpc.GRPCServer
+	registry            discovery.Registry
+	cancel              context.CancelFunc
+	node                *models.StatefulNode
+	config              *config.Storage
+	rpcHandler          *rpcHandler
+	version             string
+	app.BaseRuntime
 	globalKeyValues tag.Tags
-
-	log logger.Logger
+	state           server.State
+	myID            int
 }
 
 // NewStorageRuntime creates storage runtime
@@ -261,7 +257,6 @@ func (r *runtime) MustRegisterStatefulNode() error {
 		logger.String("lease-ttl", r.config.Coordinator.LeaseTTL.String()),
 	)
 	var (
-		ok            bool
 		err           error
 		maxRetries    = 20
 		retryInterval = time.Second
@@ -273,33 +268,24 @@ func (r *runtime) MustRegisterStatefulNode() error {
 			return nil
 		default:
 		}
-		fmt.Println(constants.GetStorageLiveNodePath(strconv.Itoa(int(r.node.ID))))
-		ok, _, err = r.repo.Elect(
-			r.ctx,
-			constants.GetStorageLiveNodePath(strconv.Itoa(int(r.node.ID))),
-			encoding.JSONMarshal(r.node),
-			int64(r.config.Coordinator.LeaseTTL.Duration().Seconds()))
-		if ok {
-			r.log.Info("registered state node successfully",
-				logger.Int("indicator", int(r.node.ID)),
-				logger.String("lease-ttl", r.config.Coordinator.LeaseTTL.String()),
-			)
-			return nil
-		}
+		// register storage node info
+		r.registry = newRegistry(r.repo, constants.GetStorageLiveNodePath(strconv.Itoa(int(r.node.ID))),
+			r.node, r.config.Coordinator.LeaseTTL.Duration())
+		err = r.registry.Register()
 		if err != nil {
 			r.log.Error("failed to register state node",
 				logger.Int("indicator", int(r.node.ID)),
 				logger.Int("attempt", attempt),
 				logger.Error(err),
 			)
+			time.Sleep(retryInterval)
+			continue
 		}
-		if !ok {
-			r.log.Error("stateful node is already registered",
-				logger.Int("indicator", int(r.node.ID)),
-				logger.Int("attempt", attempt),
-			)
-		}
-		time.Sleep(retryInterval)
+		r.log.Info("registered state node successfully",
+			logger.Int("indicator", int(r.node.ID)),
+			logger.String("lease-ttl", r.config.Coordinator.LeaseTTL.String()),
+		)
+		return nil
 	}
 	r.state = server.Failed
 	if err != nil {
@@ -338,6 +324,19 @@ func (r *runtime) Stop() {
 		r.jobScheduler.Shutdown()
 	}
 
+	// close registry, deregister broker node from active list
+	if r.registry != nil {
+		r.log.Info("closing discovery-registry...")
+		if err := r.registry.Deregister(); err != nil {
+			r.log.Error("unregister storage node error", logger.Error(err))
+		}
+		if err := r.registry.Close(); err != nil {
+			r.log.Error("unregister storage node error", logger.Error(err))
+		} else {
+			r.log.Info("closed discovery-registry successfully")
+		}
+	}
+
 	// close state repo if exist
 	if r.repo != nil {
 		r.log.Info("closing state repo...")
@@ -429,7 +428,7 @@ func (r *runtime) startTCPServer() {
 
 // bindRPCHandlers binds rpc handlers, registers task into grpc server
 func (r *runtime) bindRPCHandlers() {
-	//FIXME: (stone1100) need close
+	// FIXME: (stone1100) need close
 	leafTaskProcessor := query.NewLeafTaskProcessor(
 		r.node,
 		r.engine,
```

**File**: `app/storage/runtime_test.go` (modified, +10/-8)
```diff
@@ -26,12 +26,11 @@ import (
 	"testing"
 	"time"
 
-	"github.com/stretchr/testify/assert"
-	"go.uber.org/mock/gomock"
-
 	"github.com/lindb/common/pkg/encoding"
 	"github.com/lindb/common/pkg/fileutil"
 	"github.com/lindb/common/pkg/ltoml"
+	"github.com/stretchr/testify/assert"
+	"go.uber.org/mock/gomock"
 
 	"github.com/lindb/lindb/config"
 	"github.com/lindb/lindb/constants"
@@ -75,7 +74,8 @@ func TestStorageRun(t *testing.T) {
 	dbLifecycle.EXPECT().Startup()
 	dbLifecycle.EXPECT().Shutdown()
 	newDatabaseLifecycleFn = func(ctx context.Context, repo state.Repository,
-		walMgr replica.WriteAheadLogManager, engine tsdb.Engine) DatabaseLifecycle {
+		walMgr replica.WriteAheadLogManager, engine tsdb.Engine,
+	) DatabaseLifecycle {
 		return dbLifecycle
 	}
 
@@ -124,7 +124,8 @@ func TestStorageRun_GetHost_Err(t *testing.T) {
 	dbLifecycle.EXPECT().Startup()
 	dbLifecycle.EXPECT().Shutdown()
 	newDatabaseLifecycleFn = func(ctx context.Context, repo state.Repository,
-		walMgr replica.WriteAheadLogManager, engine tsdb.Engine) DatabaseLifecycle {
+		walMgr replica.WriteAheadLogManager, engine tsdb.Engine,
+	) DatabaseLifecycle {
 		return dbLifecycle
 	}
 	cfg.Coordinator.Endpoints = cluster.Endpoints
@@ -207,7 +208,8 @@ func TestStorageRun_Err(t *testing.T) {
 	walMgr := replica.NewMockWriteAheadLogManager(ctrl)
 	newWriteAheadLogManagerFn = func(_ context.Context, _ config.WAL,
 		_ models.NodeID, _ tsdb.Engine, _ rpc.ClientStreamFactory,
-		_ storagepkg.StateManager) replica.WriteAheadLogManager {
+		_ storagepkg.StateManager,
+	) replica.WriteAheadLogManager {
 		return walMgr
 	}
 	walMgr.EXPECT().Recovery().Return(fmt.Errorf("err"))
@@ -232,10 +234,10 @@ func TestStorage_MyID(t *testing.T) {
 	err0 := fmt.Errorf("err")
 	_, err1 := strconv.Atoi("abc")
 	testCases := []struct {
-		desc    string
 		err     error
-		id      int
 		prepare func()
+		desc    string
+		id      int
 	}{
 		{
 			desc: "mk parent path failure",
```

**File**: `config/standalone.toml.example` (modified, +4/-4)
```diff
@@ -203,11 +203,11 @@ connect-timeout = "3s"
 ## Default: data/storage/wal
 ## Env: LINDB_STORAGE_WAL_DIR
 dir = "data/storage/wal"
-## data-size-limit is the maximum size in megabytes of the page file before a new
-## file is created. It defaults to 512 megabytes, available size is in [1MB, 1GB]
+## page-size is the maximum page size in megabytes of the page file before a new
+## file is created, available size is in [128MB, 1GB]
 ## Default: 128 MiB
-## Env: LINDB_STORAGE_WAL_DATA_SIZE_LIMIT
-data-size-limit = "128 MiB"
+## Env: LINDB_STORAGE_WAL_PAGE_SIZE
+page-size = "128 MiB"
 ## interval for how often remove expired write ahead log
 ## Default: 1m0s
 ## Env: LINDB_STORAGE_WAL_REMOVE_TASK_INTERVAL
```

---

### Incident Patch 12: `2ea8de19` (2024-05-06)
**Commit Message**: [chore]: rebase v0.3.0_bug_fix (#1025)

* [bug#1017]: fix storage panic when write old data point (#1020)

* [opt]: upgrade golangci version

* [chore]: change log

**File**: `.github/workflows/lind.yml` (modified, +19/-20)
```diff
@@ -11,11 +11,11 @@ jobs:
     runs-on: ubuntu-latest
     steps:
       - name: Check out code
-        uses: actions/checkout@v3
+        uses: actions/checkout@v4
         with:
           fetch-depth: 1
       - name: Setup Go
-        uses: actions/setup-go@v4
+        uses: actions/setup-go@v5
         with:
           go-version: 1.21.1
           cache: false 
@@ -25,23 +25,22 @@ jobs:
       - name: Make Deps
         run: make deps 
       - name: golangci-lint
-        uses: golangci/golangci-lint-action@v3
+        uses: golangci/golangci-lint-action@v5
         with:
-          version: v1.51.2
+          version: v1.57.2
           skip-cache: true
-          skip-pkg-cache: true
-          skip-build-cache: true 
+          skip-save-cache: true
 
   linux-test-with-coverage:
     name: Uint Test With Coverage(Linux)
     runs-on: ubuntu-latest
     steps:
       - name: Check out code
-        uses: actions/checkout@v3
+        uses: actions/checkout@v4
         with:
           fetch-depth: 1
       - name: Setup Go
-        uses: actions/setup-go@v3
+        uses: actions/setup-go@v5
         with:
           go-version: 1.21
           cache: true
@@ -58,11 +57,11 @@ jobs:
     runs-on: macos-latest
     steps:
       - name: Check out code
-        uses: actions/checkout@v3
+        uses: actions/checkout@v4
         with:
           fetch-depth: 1
       - name: Setup Go
-        uses: actions/setup-go@v3
+        uses: actions/setup-go@v5
         with:
           go-version: 1.21
           cache: true
@@ -77,11 +76,11 @@ jobs:
     runs-on: windows-latest
     steps:
       - name: Check out code
-        uses: actions/checkout@v3
+        uses: actions/checkout@v4
         with:
           fetch-depth: 1
       - name: Setup Go
-        uses: actions/setup-go@v3
+        uses: actions/setup-go@v5
         with:
           go-version: 1.21
           cache: true
@@ -100,11 +99,11 @@ jobs:
     runs-on: ubuntu-latest
     steps:
       - name: Check out code
-        uses: actions/checkout@v3
+        uses: actions/checkout@v4
         with:
           fetch-depth: 1
       - name: Set up Go
-        uses: actions/setup-go@v3
+        uses: actions/setup-go@v5
         with:
           go-version: 1.21
           cache: true
@@ -116,11 +115,11 @@ jobs:
     runs-on: macos-latest
     steps:
       - name: Check out code
-        uses: actions/checkout@v3
+        uses: actions/checkout@v4
         with:
           fetch-depth: 1
       - name: Set up Go
-        uses: actions/setup-go@v3
+        uses: actions/setup-go@v5
         with:
           go-version: 1.21
           cache: true
@@ -132,11 +131,11 @@ jobs:
     runs-on: windows-latest
     steps:
       - name: Check out code
-        uses: actions/checkout@v3
+        uses: actions/checkout@v4
         with:
           fetch-depth: 1
       - name: Set up Go
-        uses: actions/setup-go@v3
+        uses: actions/setup-go@v5
         with:
           go-version: 1.21
           cache: true
@@ -152,11 +151,11 @@ jobs:
     runs-on: ubuntu-latest
     steps:
       - name: Check out code
-        uses: actions/checkout@v3
+        uses: actions/checkout@v4
         with:
           fetch-depth: 1
       - name: Set up Go
-        uses: actions/setup-go@v3
+        uses: actions/setup-go@v5
         with:
           go-version: 1.21
           cache: true
```

**File**: `.golangci.yml` (modified, +45/-11)
```diff
@@ -8,14 +8,50 @@ linters-settings:
     # Minimal code complexity to report.
     # Default: 30 (but we recommend 10-20)
     min-complexity: 50
+  # depguard:
+  #   list-type: blacklist
+  #   packages:
+  #     # logging is allowed only by logutils.Log, logrus
+  #     # is allowed to use only in logutils package
+  #     - github.com/sirupsen/logrus
+  #   packages-with-error-message:
+  #     - github.com/sirupsen/logrus: "logging is allowed only by logutils.Log"
   depguard:
-    list-type: blacklist
-    packages:
-      # logging is allowed only by logutils.Log, logrus
-      # is allowed to use only in logutils package
-      - github.com/sirupsen/logrus
-    packages-with-error-message:
-      - github.com/sirupsen/logrus: "logging is allowed only by logutils.Log"
+    # Rules to apply.
+    #
+    # Variables:
+    # - File Variables
+    #   you can still use and exclamation mark ! in front of a variable to say not to use it.
+    #   Example !$test will match any file that is not a go test file.
+    #
+    #   `$all` - matches all go files
+    #   `$test` - matches all go test files
+    #
+    # - Package Variables
+    #
+    #  `$gostd` - matches all of go's standard library (Pulled from `GOROOT`)
+    #
+    # Default: Only allow $gostd in all files.
+    rules:
+      # Name of a rule.
+      main:
+        # Used to determine the package matching priority.
+        # There are three different modes: `original`, `strict`, and `lax`.
+        # Default: "original"
+        list-mode: lax
+        # List of file globs that will match this list of settings to compare against.
+        # Default: $all
+        files:
+          - "!**/*_a _file.go"
+        # List of allowed packages.
+        allow:
+          - $gostd
+        # Packages that are not allowed where the value is a suggestion.
+        deny:
+          - pkg: "github.com/sirupsen/logrus"
+            desc: not allowed
+          - pkg: "github.com/pkg/errors"
+            desc: Should be replaced by standard lib errors package
   dupl:
     threshold: 100
   funlen:
@@ -41,7 +77,7 @@ linters-settings:
     local-prefixes: github.com/lindb/lindb
 
   govet:
-    check-shadowing: true
+    shadow: true
     settings:
       printf:
         funcs:
@@ -55,7 +91,7 @@ linters-settings:
     locale: US
   nolintlint:
     allow-leading-space: true # don't require machine-readable nolint directives (i.e. with no leading space)
-    allow-unused: false # report any unused nolint directives
+    allow-unused: true # report any unused nolint directives
     require-explanation: false # don't require an explanation for nolint directives
     require-specific: false # don't require nolint directives to be specific about which linter is being skipped
   gosec:
@@ -176,8 +212,6 @@ issues:
 
 run:
   timeout: 5m
-  skip-dirs:
-    - test/testdata_etc
   # timeout for analysis, e.g. 30s, 5m, default is 1m
   deadline: 10m
   # list of build tags, all linters use it. Default is empty list.
```

**File**: `CHANGELOG/CHANGELOG-1.0.md` (modified, +8/-0)
```diff
@@ -1,3 +1,11 @@
+## [v0.3.1](https://github.com/lindb/lindb/releases/tag/v0.3.1) - 2024-04-21
+
+See [code changes](https://github.com/lindb/lindb/compare/v0.3.0...v0.3.1).
+
+### 🐛 Bug fixes
+
+- [bug]: fix storage panic when write old data point by @stone1100 in #1020
+
 ## [v0.3.0](https://github.com/lindb/lindb/releases/tag/v0.3.0) - 2023-08-29
 
 See [code changes](https://github.com/lindb/lindb/compare/v0.2.6...v0.3.0).
```

**File**: `aggregation/expression.go` (modified, +6/-9)
```diff
@@ -47,13 +47,12 @@ type Expression interface {
 
 // expression implements Expression interface.
 type expression struct {
+	fieldStore  map[field.Name]fields.Field
+	resultSet   map[string]*collections.FloatArray
+	selectItems []stmt.Expr
+	timeRange   timeutil.TimeRange
 	pointCount  int
 	interval    int64
-	timeRange   timeutil.TimeRange
-	selectItems []stmt.Expr
-
-	fieldStore map[field.Name]fields.Field
-	resultSet  map[string]*collections.FloatArray // field => series
 }
 
 // NewExpression creates an Expression instance.
@@ -83,7 +82,7 @@ func (e *expression) Eval(timeSeries series.GroupedIterator) {
 	for _, selectItem := range e.selectItems {
 		values := e.eval(nil, selectItem)
 		if len(values) != 0 {
-			if item, ok := selectItem.(*stmt.SelectItem); ok && len(item.Alias) > 0 {
+			if item, ok := selectItem.(*stmt.SelectItem); ok && item.Alias != "" {
 				e.resultSet[item.Alias] = values[0]
 			} else {
 				e.resultSet[item.Rewrite()] = values[0]
@@ -152,9 +151,7 @@ func (e *expression) eval(parentFunc *stmt.CallExpr, expr stmt.Expr) []*collecti
 }
 
 func (e *expression) quantile(expr *stmt.CallExpr) []*collections.FloatArray {
-	var (
-		histogramFields = make(map[float64][]*collections.FloatArray)
-	)
+	histogramFields := make(map[float64][]*collections.FloatArray)
 	if len(expr.Params) != 1 {
 		return nil
 	}
```

**File**: `app/broker/api/exec/command/schema.go` (modified, +2/-0)
```diff
@@ -117,6 +117,8 @@ func saveDataBase(ctx context.Context, deps *depspkg.HTTPDeps, stmt *stmtpkg.Sch
 	database.Option = opt // reset option after set default value
 
 	log.Info("Saving Database", logger.String("config", stmt.Value))
+	// reset database after check and set default value
+	data = encoding.JSONMarshal(database)
 	if err := deps.Repo.Put(ctx, constants.GetDatabaseConfigPath(database.Name), data); err != nil {
 		return nil, err
 	}
```

**File**: `app/broker/api/prometheus/execute.go` (modified, +7/-6)
```diff
@@ -19,11 +19,12 @@ package prometheus
 
 import (
 	"context"
+	"errors"
+	"fmt"
 	"time"
 
 	"github.com/gin-gonic/gin"
 	"github.com/lindb/common/pkg/logger"
-	"github.com/pkg/errors"
 	"github.com/prometheus/common/version"
 	"github.com/prometheus/prometheus/model/labels"
 	"github.com/prometheus/prometheus/model/textparse"
@@ -61,12 +62,12 @@ const (
 
 // ExecuteAPI wraps all Prometheus APIs.
 type ExecuteAPI struct {
-	deps             *depspkg.HTTPDeps
 	prometheusWriter prometheusIngest.Writer
-	codecs           []Codec
-	engine           *promql.Engine
 	queryable        storage.Queryable
 	logger           logger.Logger
+	deps             *depspkg.HTTPDeps
+	engine           *promql.Engine
+	codecs           []Codec
 }
 
 // NewExecuteAPI creates a promql execution api.
@@ -155,7 +156,7 @@ func (e *ExecuteAPI) querySeries(c *gin.Context) apiFuncResult {
 	r, ctx := c.Request, c.Request.Context()
 
 	if err := r.ParseForm(); err != nil {
-		return apiFuncResult{nil, &apiError{errorBadData, errors.Wrapf(err, "error parsing form values")}, nil, nil}
+		return apiFuncResult{nil, &apiError{errorBadData, fmt.Errorf("error parsing form values: %w", err)}, nil, nil}
 	}
 	if len(r.Form["match[]"]) == 0 {
 		return apiFuncResult{nil, &apiError{errorBadData, errors.New("no match[] parameter provided")}, nil, nil}
@@ -306,7 +307,7 @@ func (e *ExecuteAPI) query(c *gin.Context) {
 
 // queryResult is the implementation of query.
 func (e *ExecuteAPI) queryResult(c *gin.Context) (result apiFuncResult) {
-	var r = c.Request
+	r := c.Request
 	ts, err := parseTimeParam(r, "time", time.Now())
 	if err != nil {
 		return invalidParamError(err, "time")
```

**File**: `app/broker/api/prometheus/model.go` (modified, +3/-2)
```diff
@@ -19,13 +19,13 @@ package prometheus
 
 import (
 	"context"
+	"errors"
 	"fmt"
 	"math"
 	"time"
 
 	jsoniter "github.com/json-iterator/go"
 	"github.com/munnerz/goautoneg"
-	"github.com/pkg/errors"
 	"github.com/prometheus/prometheus/model/textparse"
 	"github.com/prometheus/prometheus/promql"
 	"github.com/prometheus/prometheus/storage"
@@ -158,7 +158,8 @@ func (s *seriesSet) At() storage.Series {
 	return s.series[s.index]
 }
 
-func (s *seriesSet) Err() error                        { return s.err }
+func (s *seriesSet) Err() error { return s.err }
+
 func (s *seriesSet) Warnings() annotations.Annotations { return nil }
 
 func (s *seriesSet) setErr(err error) {
```

**File**: `app/broker/api/prometheus/util.go` (modified, +9/-9)
```diff
@@ -18,20 +18,20 @@
 package prometheus
 
 import (
+	"errors"
 	"fmt"
 	"math"
 	"net/http"
 	"strconv"
 	"time"
 
-	stmtpkg "github.com/lindb/lindb/sql/stmt"
-
-	"github.com/pkg/errors"
 	"github.com/prometheus/common/model"
 	"github.com/prometheus/prometheus/model/labels"
 	"github.com/prometheus/prometheus/prompb"
 	"github.com/prometheus/prometheus/promql"
 	"github.com/prometheus/prometheus/promql/parser"
+
+	stmtpkg "github.com/lindb/lindb/sql/stmt"
 )
 
 func parseTimeParam(r *http.Request, paramName string, defaultValue time.Time) (time.Time, error) {
@@ -41,7 +41,7 @@ func parseTimeParam(r *http.Request, paramName string, defaultValue time.Time) (
 	}
 	result, err := parseTime(val)
 	if err != nil {
-		return time.Time{}, errors.Wrapf(err, "Invalid time value for '%s'", paramName)
+		return time.Time{}, fmt.Errorf("invalid time value for '%s', err:%w", paramName, err)
 	}
 	return result, nil
 }
@@ -66,26 +66,26 @@ func parseTime(s string) (time.Time, error) {
 	case maxTimeFormatted:
 		return MaxTime, nil
 	}
-	return time.Time{}, errors.Errorf("cannot parse %q to a valid timestamp", s)
+	return time.Time{}, fmt.Errorf("cannot parse %q to a valid timestamp", s)
 }
 
 func parseDuration(s string) (time.Duration, error) {
 	if d, err := strconv.ParseFloat(s, 64); err == nil {
 		ts := d * float64(time.Second)
 		if ts > float64(math.MaxInt64) || ts < float64(math.MinInt64) {
-			return 0, errors.Errorf("cannot parse %q to a valid duration. It overflows int64", s)
+			return 0, fmt.Errorf("cannot parse %q to a valid duration. It overflows int64", s)
 		}
 		return time.Duration(ts), nil
 	}
 	if d, err := model.ParseDuration(s); err == nil {
 		return time.Duration(d), nil
 	}
-	return 0, errors.Errorf("cannot parse %q to a valid duration", s)
+	return 0, fmt.Errorf("cannot parse %q to a valid duration", s)
 }
 
 func invalidParamError(err error, parameter string) apiFuncResult {
 	return apiFuncResult{nil, &apiError{
-		errorBadData, errors.Wrapf(err, "invalid parameter %q", parameter),
+		errorBadData, fmt.Errorf("invalid parameter %q, err: %w", parameter, err),
 	}, nil, nil}
 }
 
@@ -188,7 +188,7 @@ func makeCondition(matchers ...*labels.Matcher) (metricName string, expr stmtpkg
 			Value: pureMatchers[0].Value,
 		}
 	default:
-		var e = &stmtpkg.BinaryExpr{Operator: stmtpkg.ADD}
+		e := &stmtpkg.BinaryExpr{Operator: stmtpkg.ADD}
 		walkMatcher(e, pureMatchers)
 		return metricName, e
 	}
```

---

### Incident Patch 13: `809d94f0` (2024-01-29)
**Commit Message**: [bug:#1012]: fix show metrics returns incorrect results (#1013)

**File**: `index/model/trie_bucket.go` (modified, +12/-1)
```diff
@@ -278,7 +278,8 @@ func (m *mergedIterator) HasNext() bool {
 		// pop item and get value
 		val := heap.Pop(&m.pq)
 		item := val.(*item)
-		m.curKey = item.key
+		// use getKey() instead of item.key to prevent key from being overwritten.
+		m.curKey = item.getKey()
 
 		// if it has value, push back queue and adjust priority
 		it := item.it
@@ -307,6 +308,16 @@ type item struct {
 	index int
 }
 
+// getKey clones the key and returns it.
+func (i *item) getKey() []byte {
+	if len(i.key) == 0 {
+		return nil
+	}
+	key := make([]byte, len(i.key))
+	copy(key, i.key)
+	return key
+}
+
 // priorityQueue implements heap.Interface and holds Items.
 type priorityQueue []*item
 
```

**File**: `index/model/trie_bucket_test.go` (modified, +75/-0)
```diff
@@ -22,6 +22,7 @@ import (
 	"fmt"
 	"math"
 	"regexp"
+	"sort"
 	"testing"
 
 	"github.com/stretchr/testify/assert"
@@ -274,3 +275,77 @@ func createTriesData(t *testing.T, blockSize int) (keys [][]byte, values []uint3
 	data = w.Bytes()
 	return
 }
+
+func createTriesDataBulk(t *testing.T, blockSize int) (keys [][]byte, values []uint32, data []byte, keysString []string) {
+	keysString = []string{
+		"go_memstats_alloc_bytes_total",
+		"process_virtual_memory_bytes",
+		"request_count",
+		"err_request_count",
+		"go_info",
+		"go_memstats_heap_idle_bytes",
+		"go_memstats_mcache_inuse_bytes",
+		"go_memstats_mallocs_total",
+		"go_memstats_mspan_inuse_bytes",
+		"go_memstats_mspan_sys_bytes",
+		"go_gc_duration_seconds_sum",
+		"go_gc_duration_seconds_count",
+		"go_memstats_frees_total",
+		"go_memstats_heap_alloc_bytes",
+		"go_memstats_heap_objects",
+		"request_duration_seconds_count",
+		"go_memstats_heap_inuse_bytes",
+		"process_max_fds",
+		"process_start_time_seconds",
+		"promhttp_metric_handler_requests_total",
+		"request_duration_seconds_sum",
+		"go_memstats_heap_released_bytes",
+		"go_memstats_next_gc_bytes",
+		"go_memstats_stack_sys_bytes",
+		"go_threads",
+		"process_open_fds",
+		"go_memstats_gc_sys_bytes",
+		"process_resident_memory_bytes",
+		"go_memstats_buck_hash_sys_bytes",
+		"go_memstats_last_gc_time_seconds",
+		"go_memstats_lookups_total",
+		"go_memstats_sys_bytes",
+		"promhttp_metric_handler_requests_in_flight",
+		"go_memstats_other_sys_bytes",
+		"go_memstats_stack_inuse_bytes",
+		"process_cpu_seconds_total",
+		"go_gc_duration_seconds",
+		"go_goroutines",
+		"go_memstats_alloc_bytes",
+		"go_memstats_heap_sys_bytes",
+		"go_memstats_mcache_sys_bytes",
+		"process_virtual_memory_max_bytes",
+		"request_duration_seconds_bucket",
+	}
+	for idx, key := range keysString {
+		keys = append(keys, []byte(key))
+		values = append(values, uint32(idx))
+	}
+	w := bytes.NewBuffer([]byte{})
+	b := NewTrieBucketBuilder(blockSize, w)
+	assert.NoError(t, b.Write(keys, values))
+	data = w.Bytes()
+	return
+}
+
+func TestTrieBucket_Unmarlshal(t *testing.T) {
+	tries := NewTrieBucket()
+	_, _, data, keys := createTriesDataBulk(t, 4)
+	err := tries.Unmarshal(data)
+	assert.Nil(t, err)
+	for _, key := range keys {
+		id, ok := tries.GetValue([]byte(key))
+		assert.Equal(t, ok, true)
+		assert.GreaterOrEqual(t, id, uint32(0))
+	}
+	rs := tries.Suggest("", len(keys))
+	sort.Strings(keys)
+	sort.Strings(rs)
+	assert.Equal(t, keys, rs)
+}
+
```

---

### Incident Patch 14: `11229411` (2024-01-02)
**Commit Message**: [refactor]: memory database data loader (#1009)

**File**: `tsdb/memdb/data_loader.go` (modified, +20/-16)
```diff
@@ -18,36 +18,34 @@
 package memdb
 
 import (
-	"github.com/lindb/roaring"
-
 	"github.com/lindb/lindb/flow"
 	"github.com/lindb/lindb/pkg/timeutil"
 	"github.com/lindb/lindb/series/field"
 )
 
 // timeSeriesLoader represents time series store loader.
 type timeSeriesLoader struct {
-	db           *memoryDatabase
-	lowContainer roaring.Container
-	fStores      []uint32 //FIXME: add lock??
-	fields       field.Metas
-	slotRange    timeutil.SlotRange // slot range of metric store
+	db              *memoryDatabase
+	mStore          *metricStore
+	seriesIDHighKey uint16
+	fields          field.Metas        // metric store field meta
+	slotRange       timeutil.SlotRange // slot range of metric store
 }
 
 // NewTimeSeriesLoader creates a time series store loader.
 func NewTimeSeriesLoader(
 	db *memoryDatabase,
-	lowContainer roaring.Container,
-	fStores []uint32,
+	mStore *metricStore,
+	seriesIDHighKey uint16,
 	fields field.Metas,
 	slotRange timeutil.SlotRange,
 ) flow.DataLoader {
 	return &timeSeriesLoader{
-		db:           db,
-		lowContainer: lowContainer,
-		fStores:      fStores,
-		fields:       fields,
-		slotRange:    slotRange,
+		db:              db,
+		mStore:          mStore,
+		seriesIDHighKey: seriesIDHighKey,
+		fields:          fields,
+		slotRange:       slotRange,
 	}
 }
 
@@ -56,10 +54,16 @@ func (tsl *timeSeriesLoader) Load(ctx *flow.DataLoadContext) {
 	release := tsl.db.WithLock()
 	defer release()
 
-	ctx.IterateLowSeriesIDs(tsl.lowContainer, func(seriesIdxFromQuery uint16, seriesIdxFromStorage int) {
-		tsKey := tsl.fStores[seriesIdxFromStorage]
+	keys := tsl.mStore.ids.Keys()
+	highContainerIdx := keys.GetContainerIndex(tsl.seriesIDHighKey)
+	lowContainer := keys.GetContainerAtIndex(highContainerIdx)
+	fStores := tsl.mStore.ids.Values()[highContainerIdx]
+
+	ctx.IterateLowSeriesIDs(lowContainer, func(seriesIdxFromQuery uint16, seriesIdxFromStorage int) {
+		tsKey := fStores[seriesIdxFromStorage]
 		for idx := range tsl.fields {
 			fm := tsl.fields[idx]
+
 			tsStores := tsl.db.timeSeriesStores[fm.Index]
 			fStore, ok := tsStores.Get(tsKey)
 			if ok {
```

**File**: `tsdb/memdb/metric_store_filter.go` (modified, +1/-3)
```diff
@@ -112,10 +112,8 @@ func (rs *memFilterResultSet) Load(ctx *flow.DataLoadContext) flow.DataLoader {
 	if foundSeriesIDs.GetCardinality() == 0 {
 		return nil
 	}
-
-	values := rs.store.ids.Values()
 	// must use lowContainer from store, because get series index based on container
-	return NewTimeSeriesLoader(rs.db, lowContainer, values[highContainerIdx], rs.fields, *rs.store.slotRange)
+	return NewTimeSeriesLoader(rs.db, rs.store, ctx.SeriesIDHighKey, rs.fields, *rs.store.slotRange)
 }
 
 // Close release the resource during doing query operation.
```

---

### Incident Patch 15: `69b0b1d5` (2023-12-25)
**Commit Message**: [feat]: memory database estimate heap size (#1005)

**File**: `.github/workflows/lind.yml` (modified, +5/-1)
```diff
@@ -17,16 +17,20 @@ jobs:
       - name: Setup Go
         uses: actions/setup-go@v4
         with:
-          go-version: 1.21
+          go-version: 1.21.1
           cache: false 
         id: go
       - name: Make Mock files
         run: make gomock
+      - name: Make Deps
+        run: make deps 
       - name: golangci-lint
         uses: golangci/golangci-lint-action@v3
         with:
           version: v1.51.2
           skip-cache: true
+          skip-pkg-cache: true
+          skip-build-cache: true 
 
   linux-test-with-coverage:
     name: Uint Test With Coverage(Linux)
```

**File**: `pkg/imap/int_map.go` (modified, +1/-1)
```diff
@@ -23,9 +23,9 @@ import (
 
 // IntMap represents int map using roaring bitmap
 type IntMap[V any] struct {
-	putCount int             // insert count
 	keys     *roaring.Bitmap // store all keys
 	values   [][]V           // store all values by high/low key
+	putCount int             // insert count
 }
 
 // NewIntMap creates a int map
```

**File**: `tsdb/data_family.go` (modified, +8/-4)
```diff
@@ -232,21 +232,25 @@ func (f *dataFamily) NeedFlush() bool {
 		}
 	}
 	maxMemDBSize := config.GlobalStorageConfig().TSDB.MaxMemDBSize
+	memDBUptime := f.mutableMemDB.Uptime()
+	memDBHeapSize := f.mutableMemDB.MemSize()
 
 	f.logger.Info("check memory database if need flush",
 		logger.String("family", f.indicator),
-		logger.String("uptime", f.mutableMemDB.Uptime().String()),
+		logger.Any("check-ttl", memDBUptime >= ttl),
+		logger.Any("check-memdb-heap-size", memDBHeapSize >= int64(maxMemDBSize)),
+		logger.String("uptime", memDBUptime.String()),
 		logger.String("mutable-memdb-ttl", ttl.String()),
-		logger.String("memdb-size", ltoml.Size(f.mutableMemDB.MemSize()).String()),
+		logger.String("memdb-size", ltoml.Size(memDBHeapSize).String()),
 		logger.String("max-memdb-size", maxMemDBSize.String()),
 	)
 
 	// check memory database's uptime
-	if f.mutableMemDB.Uptime() >= ttl {
+	if memDBUptime >= ttl {
 		return true
 	}
 	// check memory database's heap size
-	if f.mutableMemDB.MemSize() >= int64(maxMemDBSize) {
+	if memDBHeapSize >= int64(maxMemDBSize) {
 		return true
 	}
 	return false
```

**File**: `tsdb/data_family_test.go` (modified, +6/-6)
```diff
@@ -273,9 +273,9 @@ func TestDataFamily_NeedFlush(t *testing.T) {
 				config.SetGlobalStorageConfig(cfg)
 				memDB := memdb.NewMockMemoryDatabase(ctrl)
 				f.mutableMemDB = memDB
-				memDB.EXPECT().MemSize().Return(int64(10))
 				memDB.EXPECT().NumOfMetrics().Return(10)
-				memDB.EXPECT().Uptime().Return(time.Minute).MaxTimes(2)
+				memDB.EXPECT().Uptime().Return(time.Minute)
+				memDB.EXPECT().MemSize().Return(int64(10))
 			},
 			needFlush: true,
 		},
@@ -295,8 +295,8 @@ func TestDataFamily_NeedFlush(t *testing.T) {
 				memDB := memdb.NewMockMemoryDatabase(ctrl)
 				f.mutableMemDB = memDB
 				memDB.EXPECT().NumOfMetrics().Return(10)
-				memDB.EXPECT().Uptime().Return(time.Minute).MaxTimes(2)
-				memDB.EXPECT().MemSize().Return(int64(1000)).MaxTimes(2)
+				memDB.EXPECT().Uptime().Return(time.Minute)
+				memDB.EXPECT().MemSize().Return(int64(1000))
 			},
 			needFlush: true,
 		},
@@ -316,8 +316,8 @@ func TestDataFamily_NeedFlush(t *testing.T) {
 				memDB := memdb.NewMockMemoryDatabase(ctrl)
 				f.mutableMemDB = memDB
 				memDB.EXPECT().NumOfMetrics().Return(10)
-				memDB.EXPECT().Uptime().Return(time.Minute).MaxTimes(2)
-				memDB.EXPECT().MemSize().Return(int64(10)).MaxTimes(2)
+				memDB.EXPECT().Uptime().Return(time.Minute)
+				memDB.EXPECT().MemSize().Return(int64(10))
 			},
 			needFlush: false,
 		},
```

**File**: `tsdb/memdb/database.go` (modified, +48/-9)
```diff
@@ -23,11 +23,13 @@ import (
 	"math"
 	"sync"
 	"time"
+	"unsafe"
 
 	"go.uber.org/atomic"
 
 	"github.com/lindb/common/pkg/fasttime"
 	"github.com/lindb/common/pkg/logger"
+	"github.com/lindb/roaring"
 
 	"github.com/lindb/lindb/flow"
 	"github.com/lindb/lindb/index"
@@ -44,6 +46,25 @@ import (
 
 var memDBLogger = logger.GetLogger("TSDB", "MemDB")
 
+type nilPointer struct{}
+
+var nilPointerSize *nilPointer
+
+const (
+	MetricStoreEntry = 8 + 4 + // ns+name hash(uint64) + metric store index(int)
+		int64(unsafe.Sizeof(metricStore{})) + // metric store struct size
+		2 + 2 + // metric slot range
+		int64(unsafe.Sizeof(roaring.Bitmap{})) + // series ids
+		int64(unsafe.Sizeof([][]uint32{})) // series ids
+	HashSeriesMappingEntry  = 8 + 4              // tags hash + memory series id
+	SeriesMappingEntry      = 4 * math.MaxUint16 // global series + memory series
+	FieldMetaEntry          = int64(unsafe.Sizeof(field.Meta{}))
+	FieldStoreEntry         = int64(unsafe.Sizeof(fieldStore{}))
+	IntMapValuesEntry       = int64(unsafe.Sizeof([]uint16{})) + 2*math.MaxUint16
+	NilPointerEntry         = int64(unsafe.Sizeof(nilPointerSize))
+	IntMapStructValuesEntry = IntMapValuesEntry + math.MaxUint16*NilPointerEntry
+)
+
 // MemoryDatabase is a database-like concept of Shard as memTable in cassandra.
 type MemoryDatabase interface {
 	// MarkReadOnly marks memory database cannot writable.
@@ -111,14 +132,14 @@ type memoryDatabase struct {
 	timeSeriesStores []tStoreINTF   // time series id(memory unique) => field store
 	sequence         *atomic.Uint32 // time series id generate sequence
 
-	buf DataPointBuffer
+	buf         DataPointBuffer
+	createdTime int64
+	statistics  *metrics.MemDBStatistics
 
 	writeCondition sync.WaitGroup
 	lock           sync.RWMutex // lock of create metric store
 
-	readonly    atomic.Bool
-	createdTime int64
-	statistics  *metrics.MemDBStatistics
+	readonly atomic.Bool
 }
 
 // NewMemoryDatabase returns a new MemoryDatabase.
@@ -174,6 +195,8 @@ func (md *memoryDatabase) getOrCreateMetricStore(row *metric.StorageRow) (mStore
 	mStore = newMetricStore()
 	md.metricStore[hash] = metricIdx
 	md.stores = append(md.stores, mStore)
+
+	md.allocSize.Add(MetricStoreEntry)
 	return
 }
 
@@ -206,7 +229,13 @@ func (md *memoryDatabase) WriteRow(row *metric.StorageRow) error {
 			}
 			// build index goroutine callback, with lock
 			md.lock.Lock()
+			size := len(md.metricIndexStore.Values())
 			md.metricIndexStore.Put(metricID, metricIdx)
+
+			if len(md.metricIndexStore.Values())-size > 0 {
+				md.allocSize.Add(IntMapValuesEntry)
+				md.allocSize.Add(SeriesMappingEntry)
+			}
 			md.lock.Unlock()
 		}
 		md.cfg.MetaNotifier(notifier)
@@ -224,6 +253,9 @@ func (md *memoryDatabase) WriteRow(row *metric.StorageRow) error {
 	timeSeriesID = mStore.GenTStore(row.TagsHash(), func() uint32 {
 		newSeries = true
 		seriesIdx := md.sequence.Inc()
+
+		// heap size
+		md.allocSize.Add(HashSeriesMappingEntry)
 		return seriesIdx
 	})
 	md.lock.Unlock()
@@ -240,17 +272,21 @@ func (md *memoryDatabase) WriteRow(row *metric.StorageRow) error {
 				notifier.Tags = append(notifier.Tags, tag.NewTag(bytes.Clone(it.NextKey()), bytes.Clone(it.NextValue())))
 			}
 		}
-		// FIXME: size
 		notifier.Callback = func(seriesID uint32, err error) {
 			if err != nil {
 				memDBLogger.Error("generate time series id failure", logger.String("metric", string(row.Name())), logger.Error(err))
 				return
 			}
 			md.lock.Lock()
-			mStore.IndexTStore(seriesID, timeSeriesID)
+			newValueBucket := mStore.IndexTStore(seriesID, timeSeriesID)
+			if newValueBucket {
+				md.allocSize.Add(IntMapValuesEntry)
+				md.allocSize.Add(SeriesMappingEntry)
+			}
 			md.lock.Unlock()
 		}
 		md.cfg.IndexNotifier(notifier)
+		md.numOfSeries.Inc()
 	}
 
 	written := false
@@ -375,19 +411,22 @@ func (md *memoryDatabase) writeLinField(
 			mStore.UpdateFieldMeta(fieldID, fm)
 		}
 		md.cfg.MetaNotifier(fieldNotifier)
+
+		md.allocSize.Add(FieldMetaEntry)
+		md.allocSize.Add(int64(len(fName)))
 	}
 
 	tsStore := md.timeSeriesStores[fm.Index]
-	err = tsStore.Write(ts, fType, row.SlotIndex, fValue, func() (fStoreINTF, error) {
+	writtenSize, err = tsStore.Write(ts, fType, row.SlotIndex, fValue, func() (fStoreINTF, error) {
 		buf, err0 := md.buf.AllocPage()
 		if err0 != nil {
 			md.statistics.AllocatePageFailures.Incr()
 			return nil, err0
 		}
 		md.statistics.AllocatedPages.Incr()
 		fStore := newFieldStore(buf)
-		writtenSize += fStore.Capacity()
-		md.numOfSeries.Inc()
+
+		md.allocSize.Add(FieldStoreEntry) // field store size
 		return fStore, nil
 	})
 	if err != nil {
```

**File**: `tsdb/memdb/database_test.go` (modified, +2/-1)
```diff
@@ -371,8 +371,9 @@ func TestMemoryDatabase_Flush_Error(t *testing.T) {
 	metricIndex.Put(0, 0)
 	timeSeries := newTimeSeriesStore()
 	fStore := NewMockfStoreINTF(ctrl)
+	fStore.EXPECT().Capacity().Return(10).MaxTimes(2)
 	fStore.EXPECT().Write(gomock.Any(), gomock.Any(), gomock.Any())
-	_ = timeSeries.Write(0, field.SumField, 0, 0, func() (fStoreINTF, error) {
+	_, _ = timeSeries.Write(0, field.SumField, 0, 0, func() (fStoreINTF, error) {
 		return fStore, nil
 	})
 	db := &memoryDatabase{
```

**File**: `tsdb/memdb/field_store.go` (modified, +1/-4)
```diff
@@ -50,9 +50,6 @@ const (
 	headLen       = 8
 	valueSize     = 8
 	markContainer = 8
-
-	emptyFieldStoreSize = 24 + // empty buf slice cost
-		24 // empty compress slice cost
 )
 
 // fStoreINTF represents field-store,
@@ -163,7 +160,7 @@ func (fs *fieldStore) resetBuf() {
 
 func (fs *fieldStore) Capacity() int {
 	// NOTE: do not use cap as it's a allocated page
-	return cap(fs.compress) + len(fs.buf) + emptyFieldStoreSize
+	return cap(fs.compress)
 }
 
 // compact the current write buffer,
```

**File**: `tsdb/memdb/field_store_test.go` (modified, +1/-1)
```diff
@@ -166,7 +166,7 @@ func TestFieldStore_Write_Compact_err(t *testing.T) {
 	s := store.(*fieldStore)
 
 	store.Write(field.SumField, 10, 10.1)
-	assert.NotZero(t, store.Capacity())
+	assert.Zero(t, store.Capacity())
 	capacity := store.Capacity()
 	store.Write(field.SumField, 100, 100.1)
 	assert.Equal(t, 13, store.Capacity()-capacity)
```

#### Recent Merged Pull Requests:
- **PR #1091** (2025-04-23): [feat]: hash join (@stone1100)
- **PR #1090** (2025-04-22): [bug]: only check/push down hidden timestamp column (@stone1100)
- **PR #1089** (2025-03-20): [feat]: validate plan tree/render pipeline execute tree (@stone1100)
- **PR #1088** (2025-03-18): [feat]: push timestamp into table scan opt (@stone1100)
- **PR #1087** (2025-03-18): [feat]: grouping metric tag key (@stone1100)
- **PR #1086** (2025-03-13): [feat]: build new web console (@stone1100)
- **PR #1085** (2025-03-13): [feat]: new sql execution operator pipeline chan (@stone1100)
- **PR #1084** (2025-01-25): [feat]: new data fetch from tsdb (@stone1100)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
