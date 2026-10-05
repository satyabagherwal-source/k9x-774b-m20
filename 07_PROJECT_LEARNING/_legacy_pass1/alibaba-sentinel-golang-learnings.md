# Forensic Learning Record (Deep Inspection): alibaba/sentinel-golang

> **Canonical Artifact**: `07_PROJECT_LEARNING/alibaba-sentinel-golang-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/alibaba/sentinel-golang](https://github.com/alibaba/sentinel-golang))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:43:17.137Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `alibaba/sentinel-golang`
- **Description**: Sentinel Go enables reliability and resiliency for Go microservices
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 2963 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `api/api.go`
```
// Copyright 1999-2020 Alibaba Group Holding Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package api

import (
	"sync"

	"github.com/alibaba/sentinel-golang/core/base"
)

var entryOptsPool = sync.Pool{
	New: func() interface{} {
		return &EntryOptions{
			resourceType: base.ResTypeCommon,
			entryType:    base.Outbound,
			batchCount:   1,
			flag:         0,
			slotChain:    nil,
			args:         nil,
			attachments:  nil,
		}
	},
}

// EntryOptions represents the options of a Sentinel resource entry.
type EntryOptions struct {
	resourceType base.ResourceType
	entryType    base.TrafficType
	batchCount   uint32
	flag         int32
	slotChain    *base.SlotChain
	args         []interface{}
	attachments  map[interface{}]interface{}
}

func (o *EntryOptions) Reset() {
	o.resourceType = base.ResTypeCommon
	o.entryType = base.Outbound
	o.batchCount = 1
	o.flag = 0
	o.slotChain = nil
	o.args = o.args[:0]
	o.attachments = nil
}

type EntryOption func(*EntryOptions)

// WithResourceType sets the resource entry with the given resource type.
func WithResourceType(resourceType base.ResourceType) EntryOption {
	return func(opts *EntryOptions) {
		opts.resourceType = resourceType
	}
}

// WithTrafficType sets the resource entry with the given traffic type.
func WithTrafficType(entryType base.TrafficType) EntryOption {
	return func(opts *EntryOptions) {
		opts.entryType = entryType
	}
}

// DEPRECATED: use WithBatchCount instead.
// WithAcquireCount sets the resource entry with the given batch count (by default 1).
func WithAcquireCount(acquireCount uint32) EntryOption {
	return func(opts *EntryOptions) {
		opts.batchCount = acquireCount
	}
}

// WithBatchCount sets the resource entry with the given batch count (by default 1).
func WithBatchCount(batchCount uint32) EntryOption {
	return func(opts *EntryOptions) {
		opts.batchCount = batchCount
	}
}

// WithFlag sets the resource entry with the given additional flag.
func WithFlag(flag int32) EntryOption {
	return func(opts *EntryOptions) {
		opts.flag = flag
	}
}

// WithArgs sets the resource entry with the given additional parameters.
func WithArgs(args ...interface{}) EntryOption {
	return func(opts *EntryOptions) {
		opts.args = append(opts.args, args...)
	}
}

// WithSlotChain sets the slot chain.
func WithSlotChain(chain *base.SlotChain) EntryOption {
	return func(opts *EntryOptions) {
		opts.slotChain = chain
	}
}

// WithAttachment set the resource entry with the given k-v pair
func WithAttachment(key interface{}, value interface{}) EntryOption {
	return func(opts *EntryOptions) {
		if opts.attachments == nil {
			opts.attachments = make(map[interface{}]interface{}, 8)
		}
		opts.attachments[key] = value
	}
}

// WithAttachments set the resource entry with the given k-v pairs
func WithAttachments(data map[interface{}]interface{}) EntryOption {
	return func(opts *EntryOptions) {
		if opts.attachments == nil {
			opts.attachments = make(map[interface{}]interface{}, len(data))
		}
		for key, value := range data {
			opts.attachments[key] = value
		}
	}
}

// Entry is the basic API of Sentinel.
func Entry(resource string, opts ...EntryOption) (*base.SentinelEntry, *base.BlockError) {
	options := entryOptsPool.Get().(*EntryOptions)
	defer func() {
		options.Reset()
		entryOptsPool.Put(options)
	}()

	for _, opt := range opts {
		opt(options)
	}
	if options.slotChain == nil {
		options.slotChain = GlobalSlotChain()
	}
	return entry(resource, options)
}

func entry(resource string, options *EntryOptions) (*base.SentinelEntry, *base.BlockError) {
	rw := base.NewResourceWrapper(resource, options.resourceType, options.entryType)
	sc := options.slotChain

	if sc == nil {
		return base.NewSentinelEntry(nil, rw, nil), nil
	}
	// Get context from pool.
	ctx := sc.GetPooledContext()
	ctx.Resource = rw
	ctx.Input.BatchCount = options.batchCount
	ctx.Input.Flag = options.flag
	if len(options.args) != 0 {
		ctx.Input.Args = options.args
	}
	if len(options.attachments) != 0 {
		ctx.Input.Attachments = options.attachments
	}
	e := base.NewSentinelEntry(ctx, rw, sc)
	ctx.SetEntry(e)
	r := sc.Entry(ctx)
	if r == nil {
		// This indicates internal error in some slots, so just pass
		return e, nil
	}
	if r.Status() == base.ResultStatusBlocked {
		// r will be put to Pool in calling Exit()
		// must finish the lifecycle of r.
		blockErr := base.NewBlockErrorFromDeepCopy(r.BlockError())
		e.Exit()
		return nil, blockErr
	}

	return e, nil
}

```

### Core Architecture Module: `api/doc.go`
```
// Copyright 1999-2020 Alibaba Group Holding Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Package api provides the topmost fundamental APIs for users using sentinel-golang.
// Users must initialize Sentinel before loading Sentinel rules. Sentinel support three ways to perform initialization:
//
//  1. api.InitDefault(), using default config to initialize.
//  2. api.InitWithConfig(confEntity *config.Entity), using customized config Entity to initialize.
//  3. api.InitWithConfigFile(configPath string), using yaml file to initialize.
//
// Here is the example code to use Sentinel:
//
//	import sentinel "github.com/alibaba/sentinel-golang/api"
//
//	err := sentinel.InitDefault()
//	if err != nil {
//	    log.Fatal(err)
//	}
//
//	//Load sentinel rules
//	_, err = flow.LoadRules([]*flow.Rule{
//	    {
//	        Resource:        "some-test",
//	        MetricType:      flow.QPS,
//	        Threshold:           10,
//	        ControlBehavior: flow.Reject,
//	    },
//	})
//	if err != nil {
//	    log.Fatalf("Unexpected error: %+v", err)
//	    return
//	}
//	ch := make(chan struct{})
//	for i := 0; i < 10; i++ {
//	    go func() {
//	        for {
//	            e, b := sentinel.Entry("some-test", sentinel.WithTrafficType(base.Inbound))
//	            if b != nil {
//	                // Blocked. We could get the block reason from the BlockError.
//	                time.Sleep(time.Duration(rand.Uint64()%10) * time.Millisecond)
//	            } else {
//	                // Passed, wrap the logic here.
//	                fmt.Println(util.CurrentTimeMillis(), "passed")
//	                time.Sleep(time.Duration(rand.Uint64()%10) * time.Millisecond)
//	                // Be sure the entry is exited finally.
//	                e.Exit()
//	            }
//	        }
//	    }()
//	}
//	<-ch
package api

```

### Core Architecture Module: `api/init.go`
```
// Copyright 1999-2020 Alibaba Group Holding Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package api

import (
	"fmt"
	"net"
	"net/http"

	"github.com/alibaba/sentinel-golang/core/config"
	"github.com/alibaba/sentinel-golang/core/log/metric"
	"github.com/alibaba/sentinel-golang/core/system_metric"
	metric_exporter "github.com/alibaba/sentinel-golang/exporter/metric"
	"github.com/alibaba/sentinel-golang/util"
	"github.com/pkg/errors"
)

// Initialization func initialize the Sentinel's runtime environment, including:
//  1. override global config, from manually config or yaml file or env variable
//  2. override global logger
//  3. initiate core component async task, including: metric log, system statistic...
//
// InitDefault initializes Sentinel using the configuration from system
// environment and the default value.
func InitDefault() error {
	return initSentinel("")
}

// InitWithParser initializes Sentinel using given config parser
// parser deserializes the configBytes and return config.Entity
func InitWithParser(configBytes []byte, parser func([]byte) (*config.Entity, error)) (err error) {
	if parser == nil {
		return errors.New("nil parser")
	}
	confEntity, err := parser(configBytes)
	if err != nil {
		return err
	}
	return InitWithConfig(confEntity)
}

// InitWithConfig initializes Sentinel using given config.
func InitWithConfig(confEntity *config.Entity) (err error) {
	defer func() {
		if r := recover(); r != nil {
			var ok bool
			err, ok = r.(error)
			if !ok {
				err = fmt.Errorf("%v", r)
			}
		}
	}()

	err = config.CheckValid(confEntity)
	if err != nil {
		return err
	}
	config.ResetGlobalConfig(confEntity)
	if err = config.OverrideConfigFromEnvAndInitLog(); err != nil {
		return err
	}
	return initCoreComponents()
}

// Init loads Sentinel general configuration from the given YAML file
// and initializes Sentinel.
func InitWithConfigFile(configPath string) error {
	return initSentinel(configPath)
}

// initCoreComponents init core components with global config
func initCoreComponents() error {
	if config.MetricLogFlushIntervalSec() > 0 {
		if err := metric.InitTask(); err != nil {
			return err
		}
	}

	systemStatInterval := config.SystemStatCollectIntervalMs()
	loadStatInterval := systemStatInterval
	cpuStatInterval := systemStatInterval
	memStatInterval := systemStatInterval

	if config.LoadStatCollectIntervalMs() > 0 {
		loadStatInterval = config.LoadStatCollectIntervalMs()
	}
	if config.CpuStatCollectIntervalMs() > 0 {
		cpuStatInterval = config.CpuStatCollectIntervalMs()
	}
	if config.MemoryStatCollectIntervalMs() > 0 {
		memStatInterval = config.MemoryStatCollectIntervalMs()
	}

	if loadStatInterval > 0 {
		system_metric.InitLoadCollector(loadStatInterval)
	}
	if cpuStatInterval > 0 {
		system_metric.InitCpuCollector(cpuStatInterval)
	}
	if memStatInterval > 0 {
		system_metric.InitMemoryCollector(memStatInterval)
	}

	if config.UseCacheTime() {
		util.StartTimeTicker()
	}

	if config.MetricExportHTTPAddr() != "" {
		httpAddr := config.MetricExportHTTPAddr()
		httpPath := config.MetricExportHTTPPath()

		l, err := net.Listen("tcp", httpAddr)
		if err != nil {
			return fmt.Errorf("init metric exporter http server err: %s", err.Error())
		}

		http.Handle(httpPath, metric_exporter.HTTPHandler())
		go func() {
			_ = http.Serve(l, nil)
		}()

		return nil
	}

	return nil
}

func initSentinel(configPath string) (err error) {
	defer func() {
		if r := recover(); r != nil {
			var ok bool
			err, ok = r.(error)
			if !ok {
				err = fmt.Errorf("%v", r)
			}
		}
	}()
	// Initialize general config and logging module.
	if err = config.InitConfigWithYaml(configPath); err != nil {
		return err
	}
	return initCoreComponents()
}

```

### Core Architecture Module: `api/slot_chain.go`
```
// Copyright 1999-2020 Alibaba Group Holding Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package api

import (
	"github.com/alibaba/sentinel-golang/core/base"
	"github.com/alibaba/sentinel-golang/core/circuitbreaker"
	"github.com/alibaba/sentinel-golang/core/flow"
	"github.com/alibaba/sentinel-golang/core/hotspot"
	"github.com/alibaba/sentinel-golang/core/isolation"
	"github.com/alibaba/sentinel-golang/core/log"
	"github.com/alibaba/sentinel-golang/core/stat"
	"github.com/alibaba/sentinel-golang/core/system"
)

var globalSlotChain = BuildDefaultSlotChain()

func GlobalSlotChain() *base.SlotChain {
	return globalSlotChain
}

func BuildDefaultSlotChain() *base.SlotChain {
	sc := base.NewSlotChain()
	sc.AddStatPrepareSlot(stat.DefaultResourceNodePrepareSlot)

	sc.AddRuleCheckSlot(system.DefaultAdaptiveSlot)
	sc.AddRuleCheckSlot(flow.DefaultSlot)
	sc.AddRuleCheckSlot(isolation.DefaultSlot)
	sc.AddRuleCheckSlot(hotspot.DefaultSlot)
	sc.AddRuleCheckSlot(circuitbreaker.DefaultSlot)

	sc.AddStatSlot(stat.DefaultSlot)
	sc.AddStatSlot(log.DefaultSlot)
	sc.AddStatSlot(flow.DefaultStandaloneStatSlot)
	sc.AddStatSlot(hotspot.DefaultConcurrencyStatSlot)
	sc.AddStatSlot(circuitbreaker.DefaultMetricStatSlot)
	return sc
}

```

### Core Architecture Module: `api/tracer.go`
```
// Copyright 1999-2020 Alibaba Group Holding Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package api

import (
	"github.com/pkg/errors"

	"github.com/alibaba/sentinel-golang/core/base"
	"github.com/alibaba/sentinel-golang/logging"
)

// TraceError records the provided error to the given SentinelEntry.
func TraceError(entry *base.SentinelEntry, err error) {
	defer func() {
		if e := recover(); e != nil {
			logging.Error(errors.Errorf("%+v", e), "Failed to api.TraceError()")
			return
		}
	}()
	if entry == nil || err == nil {
		return
	}

	entry.SetError(err)
}

func TraceCallee(entry *base.SentinelEntry, address string) {
	defer func() {
		if e := recover(); e != nil {
			logging.Error(errors.Errorf("%+v", e), "Failed to api.TraceCallee()")
			return
		}
	}()
	if entry == nil || address == "" {
		return
	}
	entry.SetPair("address", address)
}

```

### Core Architecture Module: `core/base/block_error.go`
```
// Copyright 1999-2020 Alibaba Group Holding Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package base

import "fmt"

// BlockError indicates the request was blocked by Sentinel.
type BlockError struct {
	blockType BlockType
	// blockMsg provides additional message for the block error.
	blockMsg string

	rule SentinelRule
	// snapshotValue represents the triggered "snapshot" value
	snapshotValue interface{}
}

type BlockErrorOption func(*BlockError)

func WithBlockType(blockType BlockType) BlockErrorOption {
	return func(b *BlockError) {
		b.blockType = blockType
	}
}

func WithBlockMsg(blockMsg string) BlockErrorOption {
	return func(b *BlockError) {
		b.blockMsg = blockMsg
	}
}

func WithRule(rule SentinelRule) BlockErrorOption {
	return func(b *BlockError) {
		b.rule = rule
	}
}

func WithSnapshotValue(snapshotValue interface{}) BlockErrorOption {
	return func(b *BlockError) {
		b.snapshotValue = snapshotValue
	}
}

func NewBlockError(opts ...BlockErrorOption) *BlockError {
	b := &BlockError{
		blockType: BlockTypeUnknown,
	}

	for _, opt := range opts {
		opt(b)
	}
	return b
}

func (e *BlockError) ResetBlockError(opts ...BlockErrorOption) {
	for _, opt := range opts {
		opt(e)
	}
	return
}

func (e *BlockError) BlockMsg() string {
	return e.blockMsg
}

func (e *BlockError) BlockType() BlockType {
	return e.blockType
}

func (e *BlockError) TriggeredRule() SentinelRule {
	return e.rule
}

func (e *BlockError) TriggeredValue() interface{} {
	return e.snapshotValue
}

func NewBlockErrorFromDeepCopy(from *BlockError) *BlockError {
	return &BlockError{
		blockType:     from.blockType,
		blockMsg:      from.blockMsg,
		rule:          from.rule,
		snapshotValue: from.snapshotValue,
	}
}

func NewBlockErrorWithMessage(blockType BlockType, message string) *BlockError {
	return NewBlockError(WithBlockType(blockType), WithBlockMsg(message))
}

func NewBlockErrorWithCause(blockType BlockType, blockMsg string, rule SentinelRule, snapshot interface{}) *BlockError {
	return NewBlockError(WithBlockType(blockType), WithBlockMsg(blockMsg), WithRule(rule), WithSnapshotValue(snapshot))
}

func (e *BlockError) Error() string {
	if e == nil {
		return "nil *BlockError"
	}

	if len(e.blockMsg) == 0 {
		return fmt.Sprintf("SentinelBlockError: %s", e.blockType.String())
	}
	return fmt.Sprintf("SentinelBlockError: %s, message: %s", e.blockType.String(), e.blockMsg)
}

```

### Core Architecture Module: `core/base/constant.go`
```
// Copyright 1999-2020 Alibaba Group Holding Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package base

// global variable
const (
	TotalInBoundResourceName = "__total_inbound_traffic__"

	DefaultMaxResourceAmount uint32 = 10000

	DefaultSampleCount uint32 = 2
	DefaultIntervalMs  uint32 = 1000

	// default 10*1000/500 = 20
	DefaultSampleCountTotal uint32 = 20
	// default 10s (total length)
	DefaultIntervalMsTotal uint32 = 10000

	DefaultStatisticMaxRt = int64(60000)
)

```

### Core Architecture Module: `core/base/context.go`
```
// Copyright 1999-2020 Alibaba Group Holding Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package base

import "github.com/alibaba/sentinel-golang/util"

type EntryContext struct {
	entry *SentinelEntry
	// internal error when sentinel Entry or
	// biz error of downstream
	err error
	// Use to calculate RT
	startTime uint64
	// the rt of this transaction
	rt uint64

	Resource *ResourceWrapper
	StatNode StatNode

	Input *SentinelInput
	// the result of rule slots check
	RuleCheckResult *TokenResult
	// reserve for storing some intermediate data from the Entry execution process
	Data map[interface{}]interface{}
}

func (ctx *EntryContext) SetEntry(entry *SentinelEntry) {
	ctx.entry = entry
}

func (ctx *EntryContext) Entry() *SentinelEntry {
	return ctx.entry
}

func (ctx *EntryContext) Err() error {
	return ctx.err
}

func (ctx *EntryContext) SetError(err error) {
	ctx.err = err
}

func (ctx *EntryContext) StartTime() uint64 {
	return ctx.startTime
}

func (ctx *EntryContext) IsBlocked() bool {
	if ctx.RuleCheckResult == nil {
		return false
	}
	return ctx.RuleCheckResult.IsBlocked()
}

func (ctx *EntryContext) PutRt(rt uint64) {
	ctx.rt = rt
}

func (ctx *EntryContext) Rt() uint64 {
	if ctx.rt == 0 {
		rt := util.CurrentTimeMillis() - ctx.StartTime()
		return rt
	}
	return ctx.rt
}

func (ctx *EntryContext) FilterNodes() []string {
	return ctx.RuleCheckResult.FilterNodes()
}

func (ctx *EntryContext) HalfOpenNodes() []string {
	return ctx.RuleCheckResult.HalfOpenNodes()
}

func (ctx *EntryContext) SetPair(key, val interface{}) {
	ctx.Data[key] = val
}

func (ctx *EntryContext) GetPair(key interface{}) interface{} {
	return ctx.Data[key]
}

func NewEmptyEntryContext() *EntryContext {
	return &EntryContext{}
}

// The input data of sentinel
type SentinelInput struct {
	BatchCount uint32
	Flag       int32
	Args       []interface{}
	// store some values in this context when calling context in slot.
	Attachments map[interface{}]interface{}
}

func (i *SentinelInput) reset() {
	i.BatchCount = 1
	i.Flag = 0
	i.Args = i.Args[:0]
	if len(i.Attachments) != 0 {
		i.Attachments = make(map[interface{}]interface{})
	}
}

// Reset init EntryContext,
func (ctx *EntryContext) Reset() {
	// reset all fields of ctx
	ctx.entry = nil
	ctx.err = nil
	ctx.startTime = 0
	ctx.rt = 0
	ctx.Resource = nil
	ctx.StatNode = nil
	ctx.Input.reset()
	if ctx.RuleCheckResult == nil {
		ctx.RuleCheckResult = NewTokenResultPass()
	} else {
		ctx.RuleCheckResult.ResetToPass()
	}
	if len(ctx.Data) != 0 {
		ctx.Data = make(map[interface{}]interface{})
	}
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #611** (2026-07-02): **feat: add GetGroupID() method to SentinelRule interface**
  *Symptoms*: Add GetGroupID() to the SentinelRule interface for stable rule group identification. Most implementations return RuleID() directly; hotspot Rule supports a separate GroupID field with fallback to RuleID().  <!--  Thanks for submitting a pull request! Here are some tips for you: 1. Please make sure you have read and understood the contributing guidelines: https://github.com/alibaba/blob/master/CONTRIBUTING.md 2. Please make sure the PR has a corresponding issue. -->  ### Describe what this PR does / why we need it   ### Does this pull request fix one issue?  <!--If that, add "Fixes #xxxx" below in the next line. For example, Fixes #15. Otherwise, add "NONE" -->  ### Describe how you did it   ### Describe how to verify it   ### Special notes for reviews

- **Issue #609** (2026-03-17): **fix(deps): update etcd import path from coreos to io**
  *Symptoms*: ## Summary  This PR fixes issue #584 by updating the deprecated etcd import path.  ## Problem  The project uses the old import path `github.com/coreos/etcd` which has been redirected to `github.com/etcd-io/etcd`. This causes build errors for downstream users:  ``` go get: github.com/coreos/etcd : parsing go.mod: module declares its path as: github.com/etcd-io/etcd but was required as: github.com/coreos/etcd ```  ## Solution  Replace all occurrences of `github.com/coreos/etcd` with `github.com/etcd-io/etcd` in:  - `pkg/datasource/etcdv3/etcdv3.go` - `pkg/datasource/etcdv3/etcdv3_example.go` - `pkg/datasource/etcdv3/demo/datasource_etcdv3_example.go`  Also updated go.mod and go.sum accordingly via `go mod tidy`.  ## Verification  ```bash go build ./... ```  Build succeeds.  Closes #584
  **Post-Mortem & Fix Analysis**:
  > [![CLA assistant check](https://cla-assistant.io/pull/badge/not_signed)](https://cla-assistant.io/alibaba/sentinel-golang?pullRequest=609) <br/>Thank you for your submission! We really appreciate it. Like many open source projects, we ask that you sign our [Contributor License Agreement](https://cla-assistant.io/alibaba/sentinel-golang?pullRequest=609) before we can accept your contribution.<br/><sub>You have signed the CLA already but the status is still pending? Let us [recheck](https://cla-assistant.io/check/alibaba/sentinel-golang?pullRequest=609) it.</sub>

- **Issue #606** (2026-01-09): **feat:add trpc-go adapter**
  *Symptoms*: ### Describe what this PR does / why we need it Add Sentinel adapter for tRPC-Go framework.  ### Does this pull request fix one issue? NONE  ### Describe how you did it 1. Implemented SentinelServerFilter that wraps tRPC server handlers with Sentinel entry for inbound traffic control 2. Implemented SentinelClientFilter that wraps tRPC client calls with Sentinel entry for outbound traffic control 3. Added Option pattern for customizing resource extraction and block fallback behavior 4. Default resource name format: {CalleeServiceName}:{RPCName} 5. Added comprehensive unit tests following the existing adapter test patterns  ### Describe how to verify it ``` cd pkg/adapters/trpc go test -v ./... ```  ### Special notes for reviews
  **Post-Mortem & Fix Analysis**:
  > [![CLA assistant check](https://cla-assistant.io/pull/badge/not_signed)](https://cla-assistant.io/alibaba/sentinel-golang?pullRequest=606) <br/>Thank you for your submission! We really appreciate it. Like many open source projects, we ask that you sign our [Contributor License Agreement](https://cla-assistant.io/alibaba/sentinel-golang?pullRequest=606) before we can accept your contribution.<br/><hr/>**berenzhang** seems not to be a GitHub user. You need a GitHub account to be able to sign the CLA. If you have already a GitHub account, please [add the email address used for this commit to your account](https://help.github.com/articles/why-are-my-commits-linked-to-the-wrong-user/#commits-are-not-linked-to-any-user).<br/><sub>You have signed the CLA already but the status is still pending? Let us [recheck](https://cla-assistant.io/check/alibaba/sentinel-golang?pullRequest=606) it.</sub>

- **Issue #605** (2026-03-06): **feat:add trpc-agent-go for token-limit**
  *Symptoms*: <!--  Thanks for submitting a pull request! Here are some tips for you: 1. Please make sure you have read and understood the contributing guidelines: https://github.com/alibaba/blob/master/CONTRIBUTING.md 2. Please make sure the PR has a corresponding issue. -->  ### Describe what this PR does / why we need it Compatible with trpc-agent-go framework to realise token flow limitation  ### Does this pull request fix one issue? [https://github.com/alibaba/sentinel-golang/issues/596](url) <!--If that, add "Fixes #xxxx" below in the next line. For example, Fixes #15. Otherwise, add "NONE" -->  ### Describe how you did it Wrap the trpc-agent-go interface to implement a unified interface, similar to EINO and LangchainGo  ### Describe how to verify it cd example go run main.go   ### Special notes for reviews
  **Post-Mortem & Fix Analysis**:
  > [![CLA assistant check](https://cla-assistant.io/pull/badge/signed)](https://cla-assistant.io/alibaba/sentinel-golang?pullRequest=605) <br/>All committers have signed the CLA.
  > 测试后正常 <img width="1512" height="982" alt="image" src="https://github.com/user-attachments/assets/c718f252-60a2-4393-b610-9bfa4328b8b3" /> 
  > 测试后正常 <img width="1512" height="982" alt="image" src="https://github.com/user-attachments/assets/771461e9-1397-4f84-8fb9-5ca9951b412a" /> 

- **Issue #604** (2025-11-27): **Golang的限流可以实现FLOW_GRADE_THREAD的效果吗**
  *Symptoms*: 类似于java那边的demo的效果，可以基于并发线程数进行控制：  https://github.com/alibaba/Sentinel/blob/master/sentinel-demo/sentinel-demo-basic/src/main/java/com/alibaba/csp/sentinel/demo/flow/FlowThreadDemo.java  Golang的flow可以实现一样的效果吗，好想没有找到对应的demo以及配置
  **Post-Mortem & Fix Analysis**:
  > 找到了，在https://sentinelguard.io/zh-cn/docs/golang/concurrency-limiting-isolation.html

- **Issue #602** (2025-10-28): **[Feature] 添加LLM Token限流功能 | Add LLM Token Rate Limit**
  *Symptoms*: refers to: https://github.com/alibaba/sentinel-golang/issues/596 [性能测试报告](https://arvas2ztsq.feishu.cn/docx/VgjMdFRBLoGKh7xAwOuc3iNznee?from=from_copylink)
  **Post-Mortem & Fix Analysis**:
  > [![CLA assistant check](https://cla-assistant.io/pull/badge/signed)](https://cla-assistant.io/alibaba/sentinel-golang?pullRequest=602) <br/>All committers have signed the CLA.

- **Issue #601** (2025-12-15): **feat: Compatible with higher versions of agollo and supports fetching  rules from specified namespace.**
  *Symptoms*: <!--  Thanks for submitting a pull request! Here are some tips for you: 1. Please make sure you have read and understood the contributing guidelines: https://github.com/alibaba/blob/master/CONTRIBUTING.md 2. Please make sure the PR has a corresponding issue. -->  ### Describe what this PR does / why we need it 1. Create a new specialized `apolloClient` interface to replace `*agollo.Client`, enabling apolloDataSource to be compatible with all current versions of agollo. 2. add `WithNamespace` option to support fetching  rules from specified namespace.  ### Does this pull request fix one issue?  <!--If that, add "Fixes #xxxx" below in the next line. For example, Fixes #15. Otherwise, add "NONE" --> Fixes #600  ### Describe how you did it   ### Describe how to verify it   ### Special notes for reviews
  **Post-Mortem & Fix Analysis**:
  > [![CLA assistant check](https://cla-assistant.io/pull/badge/signed)](https://cla-assistant.io/alibaba/sentinel-golang?pullRequest=601) <br/>All committers have signed the CLA.
  > @binbin0325 request a review

- **Issue #600** (2025-12-15): **[Feature] Make Apollo dynamic datasource compatible with higher versions of the Agollo client**
  *Symptoms*: <!-- Here is for bug reports and feature requests ONLY!   If you're looking for help, please check our mail list and the Gitter room.  Please try to use English to describe your issue, or at least provide a snippet of English translation. -->  ## Issue Description  Type: *feature request* 1. Starting from [agollo v4.0.10](https://github.com/apolloconfig/agollo/blob/v4.0.10/client.go), the [`agollo.Client`](https://github.com/apolloconfig/agollo/blob/v4.0.10/client.go#L62) has transitioned from a struct to an interface type, and `agollo.StartWithConfig` now returns this interface. Consequently, the current apolloDatasource is no longer compatible with newer versions of agollo. 2. Currently, using the `agollo.Client.GetValue` method directly retrieves configuration information by querying the default application namespace. We hope to enable the option to retrieve Sentinel rules from a specified namespace.   ### Describe what feature you want  1. Create a new specialized ApolloClient interface to replace *agollo.Client, enabling apolloDataSource to be compatible with all current versions of agollo. 2. add `WithNamespace` option  ### Additional context  

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

### Incident Patch 1: `368e01c4` (2025-05-13)
**Commit Message**: fix: Fix batch count exceeding threshold issue caused by first time access or expired lastPassTime in queuing strategy (#594)

**File**: `core/hotspot/traffic_shaping.go` (modified, +22/-7)
```diff
@@ -349,16 +349,31 @@ func (c *throttlingTrafficShapingController) PerformChecking(arg interface{}, ba
 	}
 	intervalCostTime := int64(math.Round(float64(batchCount * c.durationInSec * 1000 / tokenCount)))
 	for {
-		currentTimeInMs := int64(util.CurrentTimeMillis())
-		lastPassTimePtr := timeCounter.AddIfAbsent(arg, &currentTimeInMs)
+		var (
+			expectedTime    int64
+			currentTimeInMs int64
+			lastPassTime    int64
+			lastPassTimePtr *int64
+		)
+
+		currentTimeInMs = int64(util.CurrentTimeMillis())
+		lastPassTimePtr = timeCounter.AddIfAbsent(arg, &currentTimeInMs)
 		if lastPassTimePtr == nil {
-			// first access arg
-			return nil
+			// initialize pointer for first access
+			lastPassTimePtr = &currentTimeInMs
 		}
 		// load the last pass time
-		lastPassTime := atomic.LoadInt64(lastPassTimePtr)
-		// calculate the expected pass time
-		expectedTime := lastPassTime + intervalCostTime
+		lastPassTime = atomic.LoadInt64(lastPassTimePtr)
+		// calculate expected pass time based on two scenarios:
+		// 1. first access or expired statistics window
+		// 2. normal within-window access
+		if lastPassTimePtr == &currentTimeInMs || lastPassTime < currentTimeInMs-(c.durationInSec*1000) {
+			// adjust the time of the previous window to one second ago, and at most TokenCount tokens can pass through
+			expectedTime = currentTimeInMs - (c.durationInSec * 1000) + intervalCostTime
+		} else {
+			// normal cumulative calculation
+			expectedTime = lastPassTime + intervalCostTime
+		}
 
 		if expectedTime <= currentTimeInMs || expectedTime-currentTimeInMs < c.maxQueueingTimeMs {
 			if atomic.CompareAndSwapInt64(lastPassTimePtr, lastPassTime, currentTimeInMs) {
```

---

### Incident Patch 2: `64cf4489` (2024-10-10)
**Commit Message**: [bug-fix] probeNum参数更新，loadRule生效

[bug-fix] probeNum参数更新，loadRule生效

**File**: `core/circuitbreaker/rule.go` (modified, +8/-6)
```diff
@@ -61,7 +61,7 @@ type Rule struct {
 	// that can trigger circuit breaking.
 	MinRequestAmount uint64 `json:"minRequestAmount"`
 	// StatIntervalMs represents statistic time interval of the internal circuit breaker (in ms).
-	// Currently the statistic interval is collected by sliding window.
+	// Currently, the statistic interval is collected by sliding window.
 	StatIntervalMs uint32 `json:"statIntervalMs"`
 	// StatSlidingWindowBucketCount represents the bucket count of statistic sliding window.
 	// The statistic will be more precise as the bucket count increases, but the memory cost increases too.
@@ -78,10 +78,10 @@ type Rule struct {
 	// for ErrorRatio, it represents the max error request ratio
 	// for ErrorCount, it represents the max error request count
 	Threshold float64 `json:"threshold"`
-	//ProbeNum is number of probes required when the circuit breaker is half-open.
-	//when the probe num are set  and circuit breaker in the half-open state.
-	//if err occurs during the probe, the circuit breaker is opened immediately.
-	//otherwise,the circuit breaker is closed only after the number of probes is reached
+	// ProbeNum is number of probes required when the circuit breaker is half-open.
+	// when the probe num are set  and circuit breaker in the half-open state.
+	// if err occurs during the probe, the circuit breaker is opened immediately.
+	// otherwise,the circuit breaker is closed only after the number of probes is reached
 	ProbeNum uint64 `json:"probeNum"`
 }
 
@@ -103,12 +103,14 @@ func (r *Rule) ResourceName() string {
 	return r.Resource
 }
 
+// Check whether the fields shared by all rule strategy types are consistent
 func (r *Rule) isEqualsToBase(newRule *Rule) bool {
 	if newRule == nil {
 		return false
 	}
 	return r.Resource == newRule.Resource && r.Strategy == newRule.Strategy && r.RetryTimeoutMs == newRule.RetryTimeoutMs &&
-		r.MinRequestAmount == newRule.MinRequestAmount && r.StatIntervalMs == newRule.StatIntervalMs && r.StatSlidingWindowBucketCount == newRule.StatSlidingWindowBucketCount
+		r.MinRequestAmount == newRule.MinRequestAmount && r.StatIntervalMs == newRule.StatIntervalMs && r.StatSlidingWindowBucketCount == newRule.StatSlidingWindowBucketCount &&
+		r.ProbeNum == newRule.ProbeNum
 }
 
 func (r *Rule) isEqualsTo(newRule *Rule) bool {
```

**File**: `core/circuitbreaker/rule_test.go` (modified, +24/-0)
```diff
@@ -368,6 +368,30 @@ func TestRuleIsEqualsToBase(t *testing.T) {
 			},
 			expectedResult: false,
 		},
+		// different ProbeNum
+		{
+			rule1: &Rule{
+				Resource:                     "abc",
+				Strategy:                     ErrorCount,
+				RetryTimeoutMs:               3000,
+				MinRequestAmount:             10,
+				StatIntervalMs:               10000,
+				StatSlidingWindowBucketCount: 2,
+				Threshold:                    1.0,
+				ProbeNum:                     10,
+			},
+			rule2: &Rule{
+				Resource:                     "abc",
+				Strategy:                     ErrorCount,
+				RetryTimeoutMs:               3000,
+				MinRequestAmount:             10,
+				StatIntervalMs:               10000,
+				StatSlidingWindowBucketCount: 2,
+				Threshold:                    1.0,
+				ProbeNum:                     11,
+			},
+			expectedResult: false,
+		},
 	}
 
 	for i, c := range cases {
```

**File**: `core/hotspot/rule.go` (modified, +1/-1)
```diff
@@ -76,7 +76,7 @@ type Rule struct {
 	// ControlBehavior only takes effect when MetricType is QPS
 	ControlBehavior ControlBehavior `json:"controlBehavior"`
 	// ParamIndex is the index in context arguments slice.
-	// if ParamIndex is great than or equals to zero, ParamIndex means the <ParamIndex>-th parameter
+	// if ParamIndex is greater than or equals to zero, ParamIndex means the <ParamIndex>-th parameter
 	// if ParamIndex is the negative, ParamIndex means the reversed <ParamIndex>-th parameter
 	ParamIndex int `json:"paramIndex"`
 	// ParamKey is the key in EntryContext.Input.Attachments map.
```

---

### Incident Patch 3: `67f7f695` (2024-03-27)
**Commit Message**: fix:log optimization

**File**: `pkg/datasource/etcdv3/etcdv3.go` (modified, +1/-1)
```diff
@@ -81,7 +81,7 @@ func (s *Etcdv3DataSource) processWatchResponse(resp *clientv3.WatchResponse) {
 	}
 
 	if err := resp.Err(); err != nil {
-		logging.Error(err, "Watch on etcd endpoints occur error", "endpointd", s.client.Endpoints())
+		logging.Error(err, "Watch on etcd endpoints occur error", "endpoints", s.client.Endpoints())
 		return
 	}
 
```

---

### Incident Patch 4: `e2f2f73c` (2023-06-25)
**Commit Message**: doc: Fix godoc typo in core/system_metric/sys_metric_stat.go (#523)

**File**: `core/system_metric/sys_metric_stat.go` (modified, +1/-1)
```diff
@@ -181,7 +181,7 @@ func retrieveAndUpdateCpuStat() {
 	currentCpuUsage.Store(cpuPercent)
 }
 
-// getProcessCpuStat gets current process's memory usage in Bytes
+// getProcessCpuStat gets current process's cpu usage in percentage
 func getProcessCpuStat() (float64, error) {
 	curProcess := currentProcess.Load()
 	if curProcess == nil {
```

---

### Incident Patch 5: `ddd26426` (2023-06-24)
**Commit Message**: Fix ci (#536)

**File**: `api/doc.go` (modified, +39/-40)
```diff
@@ -21,44 +21,43 @@
 //
 // Here is the example code to use Sentinel:
 //
-//  import sentinel "github.com/alibaba/sentinel-golang/api"
-//
-//  err := sentinel.InitDefault()
-//  if err != nil {
-//      log.Fatal(err)
-//  }
-//
-//  //Load sentinel rules
-//  _, err = flow.LoadRules([]*flow.Rule{
-//      {
-//          Resource:        "some-test",
-//          MetricType:      flow.QPS,
-//          Threshold:           10,
-//          ControlBehavior: flow.Reject,
-//      },
-//  })
-//  if err != nil {
-//      log.Fatalf("Unexpected error: %+v", err)
-//      return
-//  }
-//  ch := make(chan struct{})
-//  for i := 0; i < 10; i++ {
-//      go func() {
-//          for {
-//              e, b := sentinel.Entry("some-test", sentinel.WithTrafficType(base.Inbound))
-//              if b != nil {
-//                  // Blocked. We could get the block reason from the BlockError.
-//                  time.Sleep(time.Duration(rand.Uint64()%10) * time.Millisecond)
-//              } else {
-//                  // Passed, wrap the logic here.
-//                  fmt.Println(util.CurrentTimeMillis(), "passed")
-//                  time.Sleep(time.Duration(rand.Uint64()%10) * time.Millisecond)
-//                  // Be sure the entry is exited finally.
-//                  e.Exit()
-//              }
-//          }
-//      }()
-//  }
-//  <-ch
-//
+//	import sentinel "github.com/alibaba/sentinel-golang/api"
+//
+//	err := sentinel.InitDefault()
+//	if err != nil {
+//	    log.Fatal(err)
+//	}
+//
+//	//Load sentinel rules
+//	_, err = flow.LoadRules([]*flow.Rule{
+//	    {
+//	        Resource:        "some-test",
+//	        MetricType:      flow.QPS,
+//	        Threshold:           10,
+//	        ControlBehavior: flow.Reject,
+//	    },
+//	})
+//	if err != nil {
+//	    log.Fatalf("Unexpected error: %+v", err)
+//	    return
+//	}
+//	ch := make(chan struct{})
+//	for i := 0; i < 10; i++ {
+//	    go func() {
+//	        for {
+//	            e, b := sentinel.Entry("some-test", sentinel.WithTrafficType(base.Inbound))
+//	            if b != nil {
+//	                // Blocked. We could get the block reason from the BlockError.
+//	                time.Sleep(time.Duration(rand.Uint64()%10) * time.Millisecond)
+//	            } else {
+//	                // Passed, wrap the logic here.
+//	                fmt.Println(util.CurrentTimeMillis(), "passed")
+//	                time.Sleep(time.Duration(rand.Uint64()%10) * time.Millisecond)
+//	                // Be sure the entry is exited finally.
+//	                e.Exit()
+//	            }
+//	        }
+//	    }()
+//	}
+//	<-ch
 package api
```

**File**: `api/init.go` (modified, +4/-3)
```diff
@@ -28,9 +28,10 @@ import (
 )
 
 // Initialization func initialize the Sentinel's runtime environment, including:
-// 		1. override global config, from manually config or yaml file or env variable
-//		2. override global logger
-// 		3. initiate core component async task, including: metric log, system statistic...
+//  1. override global config, from manually config or yaml file or env variable
+//  2. override global logger
+//  3. initiate core component async task, including: metric log, system statistic...
+//
 // InitDefault initializes Sentinel using the configuration from system
 // environment and the default value.
 func InitDefault() error {
```

**File**: `core/circuitbreaker/circuit_breaker.go` (modified, +16/-17)
```diff
@@ -26,20 +26,19 @@ import (
 	"github.com/pkg/errors"
 )
 
+//	 Circuit Breaker State Machine:
 //
-//  Circuit Breaker State Machine:
-//
-//                                 switch to open based on rule
-//				+-----------------------------------------------------------------------+
-//				|                                                                       |
-//				|                                                                       v
-//		+----------------+                   +----------------+      Probe      +----------------+
-//		|                |                   |                |<----------------|                |
-//		|                |   Probe succeed   |                |                 |                |
-//		|     Closed     |<------------------|    HalfOpen    |                 |      Open      |
-//		|                |                   |                |   Probe failed  |                |
-//		|                |                   |                +---------------->|                |
-//		+----------------+                   +----------------+                 +----------------+
+//	                                switch to open based on rule
+//					+-----------------------------------------------------------------------+
+//					|                                                                       |
+//					|                                                                       v
+//			+----------------+                   +----------------+      Probe      +----------------+
+//			|                |                   |                |<----------------|                |
+//			|                |   Probe succeed   |                |                 |                |
+//			|     Closed     |<------------------|    HalfOpen    |                 |      Open      |
+//			|                |                   |                |   Probe failed  |                |
+//			|                |                   |                +---------------->|                |
+//			+----------------+                   +----------------+                 +----------------+
 type State int32
 
 const (
@@ -126,7 +125,7 @@ type CircuitBreaker interface {
 	OnRequestComplete(rtt uint64, err error)
 }
 
-//================================= circuitBreakerBase ====================================
+// ================================= circuitBreakerBase ====================================
 // circuitBreakerBase encompasses the common fields of circuit breaker.
 type circuitBreakerBase struct {
 	rule *Rule
@@ -245,7 +244,7 @@ func (b *circuitBreakerBase) fromHalfOpenToClosed() bool {
 	return false
 }
 
-//================================= slowRtCircuitBreaker ====================================
+// ================================= slowRtCircuitBreaker ====================================
 type slowRtCircuitBreaker struct {
 	circuitBreakerBase
 	stat                *slowRequestLeapArray
@@ -437,7 +436,7 @@ func (s *slowRequestLeapArray) allCounter() []*slowRequestCounter {
 	return ret
 }
 
-//================================= errorRatioCircuitBreaker ====================================
+// ================================= errorRatioCircuitBreaker ====================================
 type errorRatioCircuitBreaker struct {
 	circuitBreakerBase
 	minRequestAmount    uint64
@@ -622,7 +621,7 @@ func (s *errorCounterLeapArray) allCounter() []*errorCounter {
 	return ret
 }
 
-//================================= errorCountCircuitBreaker ====================================
+// ================================= errorCountCircuitBreaker ====================================
 type errorCountCircuitBreaker struct {
 	circuitBreakerBase
 	minRequestAmount    uint64
```

**File**: `core/circuitbreaker/doc.go` (modified, +88/-89)
```diff
@@ -18,7 +18,7 @@
 // Sentinel circuit breaker module supports three strategies:
 //
 //  1. SlowRequestRatio: the ratio of slow response time entry(entry's response time is great than max slow response time) exceeds the threshold. The following entry to resource will be broken.
-//                       In SlowRequestRatio strategy, user must set max response time.
+//     In SlowRequestRatio strategy, user must set max response time.
 //  2. ErrorRatio: the ratio of error entry exceeds the threshold. The following entry to resource will be broken.
 //  3. ErrorCount: the number of error entry exceeds the threshold. The following entry to resource will be broken.
 //
@@ -32,97 +32,96 @@
 //
 // Sentinel circuit breaker provides the listener to observe events of state changes.
 //
-//  type StateChangeListener interface {
-//  	OnTransformToClosed(prev State, rule Rule)
+//	type StateChangeListener interface {
+//		OnTransformToClosed(prev State, rule Rule)
 //
-//  	OnTransformToOpen(prev State, rule Rule, snapshot interface{})
+//		OnTransformToOpen(prev State, rule Rule, snapshot interface{})
 //
-//  	OnTransformToHalfOpen(prev State, rule Rule)
-//  }
+//		OnTransformToHalfOpen(prev State, rule Rule)
+//	}
 //
 // Here is the example code to use circuit breaker:
 //
-//  type stateChangeTestListener struct {}
-//
-//  func (s *stateChangeTestListener) OnTransformToClosed(prev circuitbreaker.State, rule circuitbreaker.Rule) {
-//  	fmt.Printf("rule.steategy: %+v, From %s to Closed, time: %d\n", rule.Strategy, prev.String(), util.CurrentTimeMillis())
-//  }
-//
-//  func (s *stateChangeTestListener) OnTransformToOpen(prev circuitbreaker.State, rule circuitbreaker.Rule, snapshot interface{}) {
-//  	fmt.Printf("rule.steategy: %+v, From %s to Open, snapshot: %.2f, time: %d\n", rule.Strategy, prev.String(), snapshot, util.CurrentTimeMillis())
-//  }
-//
-//  func (s *stateChangeTestListener) OnTransformToHalfOpen(prev circuitbreaker.State, rule circuitbreaker.Rule) {
-//  	fmt.Printf("rule.steategy: %+v, From %s to Half-Open, time: %d\n", rule.Strategy, prev.String(), util.CurrentTimeMillis())
-//  }
-//
-//  func main() {
-//  	err := sentinel.InitDefault()
-//  	if err != nil {
-//  		log.Fatal(err)
-//  	}
-//  	ch := make(chan struct{})
-//  	// Register a state change listener so that we could observer the state change of the internal circuit breaker.
-//  	circuitbreaker.RegisterStateChangeListeners(&stateChangeTestListener{})
-//
-//  	_, err = circuitbreaker.LoadRules([]*circuitbreaker.Rule{
-//  	// Statistic time span=10s, recoveryTimeout=3s, slowRtUpperBound=50ms, maxSlowRequestRatio=50%
-//  		{
-//  			Resource:         "abc",
-//  			Strategy:         circuitbreaker.SlowRequestRatio,
-//  			RetryTimeoutMs:   3000,
-//  			MinRequestAmount: 10,
-//  			StatIntervalMs:   10000,
-//  			MaxAllowedRtMs:   50,
-//  			Threshold:        0.5,
-//  		},
-//  		// Statistic time span=10s, recoveryTimeout=3s, maxErrorRatio=50%
-//  		{
-//  			Resource:         "abc",
-//  			Strategy:         circuitbreaker.ErrorRatio,
-//  			RetryTimeoutMs:   3000,
-//  			MinRequestAmount: 10,
-//  			StatIntervalMs:   10000,
-//  			Threshold:        0.5,
-//  		},
-//  	})
-//  	if err != nil {
-//  		log.Fatal(err)
-//  	}
-//
-//  	fmt.Println("Sentinel Go circuit breaking demo is running. You may see the pass/block metric in the metric log.")
-//  	go func() {
-//  		for {
-//  			e, b := sentinel.Entry("abc")
-//  			if b != nil {
-//  				//fmt.Println("g1blocked")
-//  				time.Sleep(time.Duration(rand.Uint64()%20) * time.Millisecond)
-//  			} else {
-//  				if rand.Uint64()%20 > 9 {
-//  					// Record current invocation as error.
-//  					sentinel.TraceError(e, errors.New("biz error"))
-//  				}
-//  				//fmt.Println("g1passed")
-//  				time.Sleep(time.Duration(rand.Uint64()%80+10) * time.Millisecond)
-//  				e.Exit()
-//  			}
-//  		}
-//		}()
-//
-//  	go func() {
-//  		for {
-//  			e, b := sentinel.Entry("abc")

```

**File**: `core/circuitbreaker/rule_manager.go` (modified, +4/-2)
```diff
@@ -88,7 +88,8 @@ func init() {
 // GetRulesOfResource returns specific resource's rules based on copy.
 // It doesn't take effect for circuit breaker module if user changes the rule.
 // GetRulesOfResource need to compete circuit breaker module's global lock and the high performance losses of copy,
-// 		reduce or do not call GetRulesOfResource frequently if possible
+//
+//	reduce or do not call GetRulesOfResource frequently if possible
 func GetRulesOfResource(resource string) []Rule {
 	updateMux.RLock()
 	resRules, ok := breakerRules[resource]
@@ -106,7 +107,8 @@ func GetRulesOfResource(resource string) []Rule {
 // GetRules returns all the rules based on copy.
 // It doesn't take effect for circuit breaker module if user changes the rule.
 // GetRules need to compete circuit breaker module's global lock and the high performance losses of copy,
-// 		reduce or do not call GetRules if possible
+//
+//	reduce or do not call GetRules if possible
 func GetRules() []Rule {
 	updateMux.RLock()
 	rules := rulesFrom(breakerRules)
```

---

### Incident Patch 6: `a2e7b218` (2023-04-21)
**Commit Message**: fix some comments

Signed-off-by: cui fliter <imcusg@gmail.com>

**File**: `api/api.go` (modified, +1/-1)
```diff
@@ -117,7 +117,7 @@ func WithAttachment(key interface{}, value interface{}) EntryOption {
 	}
 }
 
-// WithAttachment set the resource entry with the given k-v pairs
+// WithAttachments set the resource entry with the given k-v pairs
 func WithAttachments(data map[interface{}]interface{}) EntryOption {
 	return func(opts *EntryOptions) {
 		if opts.attachments == nil {
```

**File**: `core/base/slot_chain.go` (modified, +1/-1)
```diff
@@ -110,7 +110,7 @@ func NewSlotChain() *SlotChain {
 	}
 }
 
-// Get a EntryContext from EntryContext ctxPool, if ctxPool doesn't have enough EntryContext then new one.
+// Get an EntryContext from EntryContext ctxPool, if ctxPool doesn't have enough EntryContext then new one.
 func (sc *SlotChain) GetPooledContext() *EntryContext {
 	ctx := sc.ctxPool.Get().(*EntryContext)
 	ctx.startTime = util.CurrentTimeMillis()
```

**File**: `core/circuitbreaker/circuit_breaker.go` (modified, +17/-18)
```diff
@@ -26,20 +26,19 @@ import (
 	"github.com/pkg/errors"
 )
 
+//	 Circuit Breaker State Machine:
 //
-//  Circuit Breaker State Machine:
-//
-//                                 switch to open based on rule
-//				+-----------------------------------------------------------------------+
-//				|                                                                       |
-//				|                                                                       v
-//		+----------------+                   +----------------+      Probe      +----------------+
-//		|                |                   |                |<----------------|                |
-//		|                |   Probe succeed   |                |                 |                |
-//		|     Closed     |<------------------|    HalfOpen    |                 |      Open      |
-//		|                |                   |                |   Probe failed  |                |
-//		|                |                   |                +---------------->|                |
-//		+----------------+                   +----------------+                 +----------------+
+//	                                switch to open based on rule
+//					+-----------------------------------------------------------------------+
+//					|                                                                       |
+//					|                                                                       v
+//			+----------------+                   +----------------+      Probe      +----------------+
+//			|                |                   |                |<----------------|                |
+//			|                |   Probe succeed   |                |                 |                |
+//			|     Closed     |<------------------|    HalfOpen    |                 |      Open      |
+//			|                |                   |                |   Probe failed  |                |
+//			|                |                   |                +---------------->|                |
+//			+----------------+                   +----------------+                 +----------------+
 type State int32
 
 const (
@@ -126,7 +125,7 @@ type CircuitBreaker interface {
 	OnRequestComplete(rtt uint64, err error)
 }
 
-//================================= circuitBreakerBase ====================================
+// ================================= circuitBreakerBase ====================================
 // circuitBreakerBase encompasses the common fields of circuit breaker.
 type circuitBreakerBase struct {
 	rule *Rule
@@ -230,7 +229,7 @@ func (b *circuitBreakerBase) fromHalfOpenToOpen(snapshot interface{}) bool {
 	return false
 }
 
-// fromHalfOpenToOpen updates circuit breaker state machine from half-open to closed
+// fromHalfOpenToClosed updates circuit breaker state machine from half-open to closed
 // Return true only if current goroutine successfully accomplished the transformation.
 func (b *circuitBreakerBase) fromHalfOpenToClosed() bool {
 	if b.state.cas(HalfOpen, Closed) {
@@ -245,7 +244,7 @@ func (b *circuitBreakerBase) fromHalfOpenToClosed() bool {
 	return false
 }
 
-//================================= slowRtCircuitBreaker ====================================
+// ================================= slowRtCircuitBreaker ====================================
 type slowRtCircuitBreaker struct {
 	circuitBreakerBase
 	stat                *slowRequestLeapArray
@@ -437,7 +436,7 @@ func (s *slowRequestLeapArray) allCounter() []*slowRequestCounter {
 	return ret
 }
 
-//================================= errorRatioCircuitBreaker ====================================
+// ================================= errorRatioCircuitBreaker ====================================
 type errorRatioCircuitBreaker struct {
 	circuitBreakerBase
 	minRequestAmount    uint64
@@ -622,7 +621,7 @@ func (s *errorCounterLeapArray) allCounter() []*errorCounter {
 	return ret
 }
 
-//================================= errorCountCircuitBreaker =============================
```

**File**: `core/system_metric/sys_metric_stat.go` (modified, +1/-1)
```diff
@@ -78,7 +78,7 @@ func init() {
 	metric_exporter.Register(processMemoryGauge)
 }
 
-// getMemoryStat returns the current machine's memory statistic
+// getTotalMemorySize returns the current machine's memory statistic
 func getTotalMemorySize() (total uint64) {
 	stat, err := mem.VirtualMemory()
 	if err != nil {
```

**File**: `ext/datasource/hotspot_rule_converter.go` (modified, +1/-1)
```diff
@@ -93,7 +93,7 @@ func (s *SpecificValue) String() string {
 	return fmt.Sprintf("SpecificValue: [ValKind: %+v, ValStr: %s]", s.ValKind, s.ValStr)
 }
 
-// arseSpecificItems parses the SpecificValue as real value.
+// parseSpecificItems parses the SpecificValue as real value.
 func parseSpecificItems(source []SpecificValue) map[interface{}]int64 {
 	ret := make(map[interface{}]int64, len(source))
 	if len(source) == 0 {
```

---

### Incident Patch 7: `2992e5c0` (2022-08-02)
**Commit Message**: Fix module path of pkg/adapters/hertz (#474)

**File**: `pkg/adapters/hertz/go.mod` (modified, +4/-5)
```diff
@@ -1,10 +1,9 @@
-module github.com/sentinel-go/pkg/adapters/hertz
+module github.com/alibaba/sentinel-golang/pkg/adapters/hertz
 
-go 1.13
+go 1.16
 
 require (
-	github.com/StackExchange/wmi v1.2.1 // indirect
-	github.com/alibaba/sentinel-golang v1.0.2
+	github.com/alibaba/sentinel-golang v1.0.4
 	github.com/cloudwego/hertz v0.2.0
-	github.com/stretchr/testify v1.7.0
+	github.com/stretchr/testify v1.8.0
 )
```

**File**: `pkg/adapters/hertz/go.sum` (modified, +378/-16)
```diff
@@ -1,72 +1,310 @@
+cloud.google.com/go v0.26.0/go.mod h1:aQUYkXzVsufM+DwF1aE+0xfcU+56JwCaLick0ClmMTw=
+cloud.google.com/go v0.34.0/go.mod h1:aQUYkXzVsufM+DwF1aE+0xfcU+56JwCaLick0ClmMTw=
 github.com/BurntSushi/toml v0.3.1/go.mod h1:xHWCNGjB5oqiDr8zfno3MHue2Ht5sIBksp03qcyfWMU=
-github.com/StackExchange/wmi v1.2.1 h1:VIkavFPXSjcnS+O8yTq7NI32k0R5Aj+v39y29VYDOSA=
-github.com/StackExchange/wmi v1.2.1/go.mod h1:rcmrprowKIVzvc+NUiLncP2uuArMWLCbu9SBzvHz7e8=
-github.com/alibaba/sentinel-golang v1.0.2 h1:Acopq74hOtZN4MV1v811MQ6QcqPFLDSczTrRXv9zpIg=
-github.com/alibaba/sentinel-golang v1.0.2/go.mod h1:QsB99f/z35D2AiMrAWwgWE85kDTkBUIkcmPrRt+61NI=
+github.com/Knetic/govaluate v3.0.1-0.20171022003610-9aa49832a739+incompatible/go.mod h1:r7JcOSlj0wfOMncg0iLm8Leh48TZaKVeNIfJntJ2wa0=
+github.com/Shopify/sarama v1.19.0/go.mod h1:FVkBWblsNy7DGZRfXLU0O9RCGt5g3g3yEuWXgklEdEo=
+github.com/Shopify/toxiproxy v2.1.4+incompatible/go.mod h1:OXgGpZ6Cli1/URJOF1DMxUHB2q5Ap20/P/eIdh4G0pI=
+github.com/StackExchange/wmi v0.0.0-20190523213315-cbe66965904d h1:G0m3OIz70MZUWq3EgK3CesDbo8upS2Vm9/P3FtgI+Jk=
+github.com/StackExchange/wmi v0.0.0-20190523213315-cbe66965904d/go.mod h1:3eOhrUMpNV+6aFIbp5/iudMxNCF27Vw2OZgy4xEx0Fg=
+github.com/VividCortex/gohistogram v1.0.0/go.mod h1:Pf5mBqqDxYaXu3hDrrU+w6nw50o/4+TcAqDqk/vUH7g=
+github.com/afex/hystrix-go v0.0.0-20180502004556-fa1af6a1f4f5/go.mod h1:SkGFH1ia65gfNATL8TAiHDNxPzPdmEL5uirI2Uyuz6c=
+github.com/alecthomas/template v0.0.0-20160405071501-a0175ee3bccc/go.mod h1:LOuyumcjzFXgccqObfd/Ljyb9UuFJ6TxHnclSeseNhc=
+github.com/alecthomas/template v0.0.0-20190718012654-fb15b899a751/go.mod h1:LOuyumcjzFXgccqObfd/Ljyb9UuFJ6TxHnclSeseNhc=
+github.com/alecthomas/units v0.0.0-20151022065526-2efee857e7cf/go.mod h1:ybxpYRFXyAe+OPACYpWeL0wqObRcbAqCMya13uyzqw0=
+github.com/alecthomas/units v0.0.0-20190717042225-c3de453c63f4/go.mod h1:ybxpYRFXyAe+OPACYpWeL0wqObRcbAqCMya13uyzqw0=
+github.com/alecthomas/units v0.0.0-20190924025748-f65c72e2690d/go.mod h1:rBZYJk541a8SKzHPHnH3zbiI+7dagKZ0cgpgrD7Fyho=
+github.com/alibaba/sentinel-golang v1.0.4 h1:i0wtMvNVdy7vM4DdzYrlC4r/Mpk1OKUUBurKKkWhEo8=
+github.com/alibaba/sentinel-golang v1.0.4/go.mod h1:Lag5rIYyJiPOylK8Kku2P+a23gdKMMqzQS7wTnjWEpk=
+github.com/apache/thrift v0.12.0/go.mod h1:cp2SuWMxlEZw2r+iP2GNCdIi4C1qmUzdZFSVb+bacwQ=
+github.com/apache/thrift v0.13.0/go.mod h1:cp2SuWMxlEZw2r+iP2GNCdIi4C1qmUzdZFSVb+bacwQ=
+github.com/armon/circbuf v0.0.0-20150827004946-bbbad097214e/go.mod h1:3U/XgcO3hCbHZ8TKRvWD2dDTCfh9M9ya+I9JpbB7O8o=
+github.com/armon/go-metrics v0.0.0-20180917152333-f0300d1749da/go.mod h1:Q73ZrmVTwzkszR9V5SSuryQ31EELlFMUz1kKyl939pY=
+github.com/armon/go-radix v0.0.0-20180808171621-7fddfc383310/go.mod h1:ufUuZ+zHj4x4TnLV4JWEpy2hxWSpsRywHrMgIH9cCH8=
+github.com/aryann/difflib v0.0.0-20170710044230-e206f873d14a/go.mod h1:DAHtR1m6lCRdSC2Tm3DSWRPvIPr6xNKyeHdqDQSQT+A=
+github.com/aws/aws-lambda-go v1.13.3/go.mod h1:4UKl9IzQMoD+QF79YdCuzCwp8VbmG4VAQwij/eHl5CU=
+github.com/aws/aws-sdk-go v1.27.0/go.mod h1:KmX6BPdI08NWTb3/sm4ZGu5ShLoqVDhKgpiN924inxo=
+github.com/aws/aws-sdk-go-v2 v0.18.0/go.mod h1:JWVYvqSMppoMJC0x5wdwiImzgXTI9FuZwxzkQq9wy+g=
+github.com/beorn7/perks v0.0.0-20180321164747-3a771d992973/go.mod h1:Dwedo/Wpr24TaqPxmxbtue+5NUziq4I4S80YR8gNf3Q=
+github.com/beorn7/perks v1.0.0/go.mod h1:KWe93zE9D1o94FZ5RNwFwVgaQK1VOXiVxmqh+CedLV8=
+github.com/beorn7/perks v1.0.1 h1:VlbKKnNfV8bJzeqoa4cOKqO6bYr3WgKZxO8Z16+hsOM=
+github.com/beorn7/perks v1.0.1/go.mod h1:G2ZrVWU2WbWT9wwq4/hrbKbnv/1ERSJQ0ibhJ6rlkpw=
+github.com/bgentry/speakeasy v0.1.0/go.mod h1:+zsyZBPWlz7T6j88CTgSN5bM796AkVf0kBD4zp0CCIs=
 github.com/bytedance/go-tagexpr/v2 v2.9.2 h1:QySJaAIQgOEDQBLS3x9BxOWrnhqu5sQ+f6HaZIxD39I=
 github.com/bytedance/go-tagexpr/v2 v2.9.2/go.mod h1:5qsx05dYOiUXOUgnQ7w3Oz8BYs2qtM/bJokdLb79wRM=
 github.com/bytedance/gopkg v0.0.0-20220413063733-65bf48ffb3a7 h1:PtwsQyQJGxf8iaPptPNaduEIu9BnrNms+pcRdHAxZaM=
 github.com/bytedance/gopkg v0.0.0-20220413063733-65bf48ffb3a7/go.mod h1:2ZlV9BaUH4+NXIBF0aMdKKAnHTzqH+iM
```

---

### Incident Patch 8: `31fdb144` (2022-05-20)
**Commit Message**: Reuse slice in SentinelInput of base/context to reduce memory allocation (#466)

**File**: `api/api.go` (modified, +1/-1)
```diff
@@ -51,7 +51,7 @@ func (o *EntryOptions) Reset() {
 	o.batchCount = 1
 	o.flag = 0
 	o.slotChain = nil
-	o.args = nil
+	o.args = o.args[:0]
 	o.attachments = nil
 }
 
```

**File**: `core/base/context.go` (modified, +1/-3)
```diff
@@ -91,9 +91,7 @@ type SentinelInput struct {
 func (i *SentinelInput) reset() {
 	i.BatchCount = 1
 	i.Flag = 0
-	if len(i.Args) != 0 {
-		i.Args = make([]interface{}, 0)
-	}
+	i.Args = i.Args[:0]
 	if len(i.Attachments) != 0 {
 		i.Attachments = make(map[interface{}]interface{})
 	}
```

---

### Incident Patch 9: `ace810bc` (2021-09-22)
**Commit Message**: Fix fixed pointer size problem in AtomicBucketWrapArray to support 32-bit OS (#429)

**File**: `core/stat/base/leap_array.go` (modified, +1/-5)
```diff
@@ -26,10 +26,6 @@ import (
 	"github.com/pkg/errors"
 )
 
-const (
-	PtrSize = int(8)
-)
-
 // BucketWrap represent a slot to record metrics
 // In order to reduce the usage of memory, BucketWrap don't hold length of BucketWrap
 // The length of BucketWrap could be seen in LeapArray.
@@ -115,7 +111,7 @@ func (aa *AtomicBucketWrapArray) elementOffset(idx int) (unsafe.Pointer, bool) {
 		return nil, false
 	}
 	basePtr := aa.base
-	return unsafe.Pointer(uintptr(basePtr) + uintptr(idx*PtrSize)), true
+	return unsafe.Pointer(uintptr(basePtr) + uintptr(idx)*unsafe.Sizeof(basePtr)), true
 }
 
 func (aa *AtomicBucketWrapArray) get(idx int) *BucketWrap {
```

---

### Incident Patch 10: `671274f0` (2021-09-09)
**Commit Message**: Fix logging typo in sys_metric_stat.go (#426)

**File**: `core/system_metric/sys_metric_stat.go` (modified, +1/-1)
```diff
@@ -114,7 +114,7 @@ func InitMemoryCollector(intervalMs uint32) {
 func retrieveAndUpdateMemoryStat() {
 	memoryUsedBytes, err := GetProcessMemoryStat()
 	if err != nil {
-		logging.Error(err, "Fail to retrieve and update cpu statistic")
+		logging.Error(err, "Fail to retrieve and update memory statistic")
 		return
 	}
 
```

#### Recent Merged Pull Requests:
- **PR #611** (2026-07-02): feat: add GetGroupID() method to SentinelRule interface (@ansiz)
- **PR #609** (closed): fix(deps): update etcd import path from coreos to io (@zhengshui)
- **PR #606** (closed): feat:add trpc-go adapter (@crazyfrankie)
- **PR #605** (closed): feat:add trpc-agent-go for token-limit (@zhuyanhuazhuyanhua)
- **PR #602** (2025-10-28): [Feature] 添加LLM Token限流功能 | Add LLM Token Rate Limit (@dancing-ui)
- **PR #601** (closed): feat: Compatible with higher versions of agollo and supports fetching  rules from specified namespace. (@yguilai)
- **PR #595** (2025-07-02): [feature] support regex in flow control and isolation for resource name (@MingsingGo)
- **PR #594** (2025-05-13): fix: Fix batch count exceeding threshold issue caused by first time access or expired lastPassTime in queuing strategy (@kongchengzhuge)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
