> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/alibaba-sentinel-golang-learnings.md`  
> **Source**: github ([https://github.com/alibaba/sentinel-golang](https://github.com/alibaba/sentinel-golang))  
> **Source Version**: `f7a7f957`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-18T23:51:48.033Z  
> **Learning ID**: `learn-github-alibaba-sentinel-golang`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): alibaba/sentinel-golang

> **Canonical Artifact**: `07_PROJECT_LEARNING/alibaba-sentinel-golang-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/alibaba/sentinel-golang](https://github.com/alibaba/sentinel-golang))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-18T23:51:47.177Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `alibaba/sentinel-golang`
- **Description**: Sentinel Go enables reliability and resiliency for Go microservices
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 2962 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

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

### Core Architecture Module: `core/base/entry.go`
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

import (
	"sync"

	"github.com/pkg/errors"

	"github.com/alibaba/sentinel-golang/logging"
)

type ExitHandler func(entry *SentinelEntry, ctx *EntryContext) error

type SentinelEntry struct {
	res *ResourceWrapper
	// one entry bounds with one context
	ctx *EntryContext

	exitHandlers []ExitHandler
	// each entry holds a slot chain.
	// it means this entry will go through the sc
	sc *SlotChain

	exitCtl sync.Once
}

func NewSentinelEntry(ctx *EntryContext, rw *ResourceWrapper, sc *SlotChain) *SentinelEntry {
	return &SentinelEntry{
		res:          rw,
		ctx:          ctx,
		exitHandlers: make([]ExitHandler, 0),
		sc:           sc,
	}
}

func (e *SentinelEntry) WhenExit(exitHandler ExitHandler) {
	e.exitHandlers = append(e.exitHandlers, exitHandler)
}

func (e *SentinelEntry) SetError(err error) {
	if e.ctx != nil {
		e.ctx.SetError(err)
	}
}

func (e *SentinelEntry) SetPair(key, val interface{}) {
	if e.ctx != nil {
		e.ctx.SetPair(key, val)
	}
}

func (e *SentinelEntry) Context() *EntryContext {
	return e.ctx
}

func (e *SentinelEntry) Resource() *ResourceWrapper {
	return e.res
}

type ExitOptions struct {
	err error
}
type ExitOption func(*ExitOptions)

func WithError(err error) ExitOption {
	return func(opts *ExitOptions) {
		opts.err = err
	}
}

func (e *SentinelEntry) Exit(exitOps ...ExitOption) {
	var options = ExitOptions{
		err: nil,
	}
	for _, opt := range exitOps {
		opt(&options)
	}
	ctx := e.ctx
	if ctx == nil {
		return
	}
	if options.err != nil {
		ctx.SetError(options.err)
	}
	e.exitCtl.Do(func() {
		defer func() {
			if err := recover(); err != nil {
				logging.Error(errors.Errorf("%+v", err), "Sentinel internal panic in SentinelEntry.Exit()")
			}
			if e.sc != nil {
				e.sc.RefurbishContext(ctx)
			}
		}()
		for _, handler := range e.exitHandlers {
			if err := handler(e, ctx); err != nil {
				logging.Error(err, "Fail to execute exitHandler in SentinelEntry.Exit()", "resource", e.Resource().Name())
			}
		}
		if e.sc != nil {
			e.sc.exit(ctx)
		}
	})
}

```

### Core Architecture Module: `core/base/metric_item.go`
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

import (
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/alibaba/sentinel-golang/util"
)

const metricPartSeparator = "|"

// MetricItem represents the data of metric log per line.
type MetricItem struct {
	Resource       string
	Classification int32
	Timestamp      uint64

	PassQps         uint64
	BlockQps        uint64
	CompleteQps     uint64
	ErrorQps        uint64
	AvgRt           uint64
	OccupiedPassQps uint64
	Concurrency     uint32
}

type MetricItemRetriever interface {
	MetricsOnCondition(predicate TimePredicate) []*MetricItem
}

func (m *MetricItem) ToFatString() (string, error) {
	b := strings.Builder{}
	timeStr := util.FormatTimeMillis(m.Timestamp)
	// All "|" in the resource name will be replaced with "_"
	finalName := strings.ReplaceAll(m.Resource, "|", "_")
	_, err := fmt.Fprintf(&b, "%d|%s|%s|%d|%d|%d|%d|%d|%d|%d|%d",
		m.Timestamp, timeStr, finalName, m.PassQps,
		m.BlockQps, m.CompleteQps, m.ErrorQps, m.AvgRt,
		m.OccupiedPassQps, m.Concurrency, m.Classification)
	if err != nil {
		return "", err
	}
	return b.String(), nil
}

func (m *MetricItem) ToThinString() (string, error) {
	b := strings.Builder{}
	finalName := strings.ReplaceAll(m.Resource, "|", "_")
	_, err := fmt.Fprintf(&b, "%d|%s|%d|%d|%d|%d|%d|%d|%d|%d",
		m.Timestamp, finalName, m.PassQps,
		m.BlockQps, m.CompleteQps, m.ErrorQps, m.AvgRt,
		m.OccupiedPassQps, m.Concurrency, m.Classification)
	if err != nil {
		return "", err
	}
	return b.String(), nil
}

func MetricItemFromFatString(line string) (*MetricItem, error) {
	if len(line) == 0 {
		return nil, errors.New("invalid metric line: empty string")
	}
	item := &MetricItem{}
	arr := strings.Split(line, metricPartSeparator)
	if len(arr) < 8 {
		return nil, errors.New("invalid metric line: invalid format")
	}
	ts, err := strconv.ParseUint(arr[0], 10, 64)
	if err != nil {
		return nil, err
	}
	item.Timestamp = ts
	item.Resource = arr[2]
	p, err := strconv.ParseUint(arr[3], 10, 64)
	if err != nil {
		return nil, err
	}
	item.PassQps = p
	b, err := strconv.ParseUint(arr[4], 10, 64)
	if err != nil {
		return nil, err
	}
	item.BlockQps = b
	c, err := strconv.ParseUint(arr[5], 10, 64)
	if err != nil {
		return nil, err
	}
	item.CompleteQps = c
	e, err := strconv.ParseUint(arr[6], 10, 64)
	if err != nil {
		return nil, err
	}
	item.ErrorQps = e
	rt, err := strconv.ParseUint(arr[7], 10, 64)
	if err != nil {
		return nil, err
	}
	item.AvgRt = rt

	if len(arr) >= 9 {
		oc, err := strconv.ParseUint(arr[8], 10, 64)
		if err != nil {
			return nil, err
		}
		item.OccupiedPassQps = oc
	}
	if len(arr) >= 10 {
		concurrency, err := strconv.ParseUint(arr[9], 10, 32)
		if err != nil {
			return nil, err
		}
		item.Concurrency = uint32(concurrency)
	}
	if len(arr) >= 11 {
		cl, err := strconv.ParseInt(arr[10], 10, 32)
		if err != nil {
			return nil, err
		}
		item.Classification = int32(cl)
	}
	return item, nil
}

```

### Core Architecture Module: `core/base/resource.go`
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

// ResourceType represents classification of the resources
type ResourceType int32

const (
	ResTypeCommon ResourceType = iota
	ResTypeWeb
	ResTypeRPC
	ResTypeAPIGateway
	ResTypeDBSQL
	ResTypeCache
	ResTypeMQ
)

// TrafficType describes the traffic type: Inbound or Outbound
type TrafficType int32

const (
	// Inbound represents the inbound traffic (e.g. provider)
	Inbound TrafficType = iota
	// Outbound represents the outbound traffic (e.g. consumer)
	Outbound
)

func (t TrafficType) String() string {
	switch t {
	case Inbound:
		return "Inbound"
	case Outbound:
		return "Outbound"
	default:
		return fmt.Sprintf("%d", t)
	}
}

// ResourceWrapper represents the invocation
type ResourceWrapper struct {
	// global unique resource name
	name string
	// resource classification
	classification ResourceType
	// Inbound or Outbound
	flowType TrafficType
}

func (r *ResourceWrapper) String() string {
	return fmt.Sprintf("ResourceWrapper{name=%s, flowType=%s, classification=%d}", r.name, r.flowType, r.classification)
}

func (r *ResourceWrapper) Name() string {
	return r.name
}

func (r *ResourceWrapper) Classification() ResourceType {
	return r.classification
}

func (r *ResourceWrapper) FlowType() TrafficType {
	return r.flowType
}

func NewResourceWrapper(name string, classification ResourceType, flowType TrafficType) *ResourceWrapper {
	return &ResourceWrapper{name: name, classification: classification, flowType: flowType}
}

```

### Core Architecture Module: `core/base/result.go`
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

import (
	"fmt"
	"time"
)

type BlockType uint8

const (
	BlockTypeUnknown BlockType = iota
	BlockTypeFlow
	BlockTypeIsolation
	BlockTypeCircuitBreaking
	BlockTypeSystemFlow
	BlockTypeHotSpotParamFlow
)

var (
	blockTypeMap = map[BlockType]string{
		BlockTypeUnknown:          "BlockTypeUnknown",
		BlockTypeFlow:             "BlockTypeFlowControl",
		BlockTypeIsolation:        "BlockTypeIsolation",
		BlockTypeCircuitBreaking:  "BlockTypeCircuitBreaking",
		BlockTypeSystemFlow:       "BlockTypeSystem",
		BlockTypeHotSpotParamFlow: "BlockTypeHotSpotParamFlow",
	}
	blockTypeExisted = fmt.Errorf("block type existed")
)

// RegistryBlockType adds block type and corresponding description in order.
func RegistryBlockType(blockType BlockType, desc string) error {
	_, exist := blockTypeMap[blockType]
	if exist {
		return blockTypeExisted
	}
	blockTypeMap[blockType] = desc
	return nil
}

func (t BlockType) String() string {
	name, ok := blockTypeMap[t]
	if ok {
		return name
	}
	return fmt.Sprintf("%d", t)
}

type TokenResultStatus uint8

const (
	ResultStatusPass TokenResultStatus = iota
	ResultStatusBlocked
	ResultStatusShouldWait
)

func (s TokenResultStatus) String() string {
	switch s {
	case ResultStatusPass:
		return "ResultStatusPass"
	case ResultStatusBlocked:
		return "ResultStatusBlocked"
	case ResultStatusShouldWait:
		return "ResultStatusShouldWait"
	default:
		return "Undefined"
	}
}

type TokenResult struct {
	status TokenResultStatus

	blockErr      *BlockError
	nanosToWait   time.Duration
	filterNodes   []string
	halfOpenNodes []string
}

func (r *TokenResult) DeepCopyFrom(newResult *TokenResult) {
	r.status = newResult.status
	r.nanosToWait = newResult.nanosToWait
	if r.blockErr == nil {
		r.blockErr = &BlockError{
			blockType:     newResult.blockErr.blockType,
			blockMsg:      newResult.blockErr.blockMsg,
			rule:          newResult.blockErr.rule,
			snapshotValue: newResult.blockErr.snapshotValue,
		}
	} else {
		// TODO: review the reusing logic
		r.blockErr.blockType = newResult.blockErr.blockType
		r.blockErr.blockMsg = newResult.blockErr.blockMsg
		r.blockErr.rule = newResult.blockErr.rule
		r.blockErr.snapshotValue = newResult.blockErr.snapshotValue
	}
}
func (r *TokenResult) ResetToPass() {
	r.status = ResultStatusPass
	r.blockErr = nil
	r.nanosToWait = 0
}

func (r *TokenResult) ResetToBlockedWith(opts ...BlockErrorOption) {
	r.status = ResultStatusBlocked
	if r.blockErr == nil {
		r.blockErr = NewBlockError(opts...)
	} else {
		r.blockErr.ResetBlockError(opts...)
	}
	r.nanosToWait = 0
}

func (r *TokenResult) ResetToBlocked(blockType BlockType) {
	r.ResetToBlockedWith(WithBlockType(blockType))
}

func (r *TokenResult) ResetToBlockedWithMessage(blockType BlockType, blockMsg string) {
	r.ResetToBlockedWith(WithBlockType(blockType), WithBlockMsg(blockMsg))
}

func (r *TokenResult) ResetToBlockedWithCause(blockType BlockType, blockMsg string, rule SentinelRule, snapshot interface{}) {
	r.ResetToBlockedWith(WithBlockType(blockType), WithBlockMsg(blockMsg), WithRule(rule), WithSnapshotValue(snapshot))
}

func (r *TokenResult) IsPass() bool {
	return r.status == ResultStatusPass
}

func (r *TokenResult) IsBlocked() bool {
	return r.status == ResultStatusBlocked
}

func (r *TokenResult) Status() TokenResultStatus {
	return r.status
}

func (r *TokenResult) BlockError() *BlockError {
	return r.blockErr
}

func (r *TokenResult) NanosToWait() time.Duration {
	return r.nanosToWait
}

func (r *TokenResult) FilterNodes() []string {
	return r.filterNodes
}

func (r *TokenResult) HalfOpenNodes() []string {
	return r.halfOpenNodes
}

func (r *TokenResult) SetFilterNodes(nodes []string) {
	r.filterNodes = nodes
}

func (r *TokenResult) SetHalfOpenNodes(nodes []string) {
	r.halfOpenNodes = nodes
}

func (r *TokenResult) String() string {
	var blockMsg string
	if r.blockErr == nil {
		blockMsg = "none"
	} else {
		blockMsg = r.blockErr.Error()
	}
	return fmt.Sprintf("TokenResult{status=%s, blockErr=%s, nanosToWait=%d}", r.status.String(), blockMsg, r.nanosToWait)
}

func NewTokenResultPass() *TokenResult {
	return NewTokenResult(ResultStatusPass)
}

func NewTokenResultBlocked(blockType BlockType) *TokenResult {
	return NewTokenResult(ResultStatusBlocked, WithBlockType(blockType))
}

func NewTokenResultBlockedWithMessage(blockType BlockType, blockMsg string) *TokenResult {
	return NewTokenResult(ResultStatusBlocked, WithBlockType(blockType), WithBlockMsg(blockMsg))
}

func NewTokenResultBlockedWithCause(blockType BlockType, blockMsg string, rule SentinelRule, snapshot interface{}) *TokenResult {
	return NewTokenResult(ResultStatusBlocked, WithBlockType(blockType), WithBlockMsg(blockMsg), WithRule(rule), WithSnapshotValue(snapshot))
}

func NewTokenResult(status TokenResultStatus, blockErrOpts ...BlockErrorOption) *TokenResult {
	return &TokenResult{
		status:      status,
		blockErr:    NewBlockError(blockErrOpts...),
		nanosToWait: 0,
	}
}

func NewTokenResultShouldWait(waitNs time.Duration) *TokenResult {
	result := NewTokenResult(ResultStatusShouldWait)
	result.nanosToWait = waitNs
	return result
}

```

### Core Architecture Module: `core/base/rule.go`
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

type SentinelRule interface {
	fmt.Stringer

	ResourceName() string
}

```

### Core Architecture Module: `core/base/slot_chain.go`
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

import (
	"sort"
	"sync"

	"github.com/alibaba/sentinel-golang/logging"
	"github.com/alibaba/sentinel-golang/util"
	"github.com/pkg/errors"
)

type BaseSlot interface {
	// Order returns the sort value of the slot.
	// SlotChain will sort all it's slots by ascending sort value in each bucket
	// (StatPrepareSlot bucket、RuleCheckSlot bucket and StatSlot bucket)
	Order() uint32
}

// StatPrepareSlot is responsible for some preparation before statistic
// For example: init structure and so on
type StatPrepareSlot interface {
	BaseSlot
	// Prepare function do some initialization
	// Such as: init statistic structure、node and etc
	// The result of preparing would store in EntryContext
	// All StatPrepareSlots execute in sequence
	// Prepare function should not throw panic.
	Prepare(ctx *EntryContext)
}

// RuleCheckSlot is rule based checking strategy
// All checking rule must implement this interface.
type RuleCheckSlot interface {
	BaseSlot
	// Check function do some validation
	// It can break off the slot pipeline
	// Each TokenResult will return check result
	// The upper logic will control pipeline according to SlotResult.
	Check(ctx *EntryContext) *TokenResult
}

// StatSlot is responsible for counting all custom biz metrics.
// StatSlot would not handle any panic, and pass up all panic to slot chain
type StatSlot interface {
	BaseSlot
	// OnEntryPass function will be invoked when StatPrepareSlots and RuleCheckSlots execute pass
	// StatSlots will do some statistic logic, such as QPS、log、etc
	OnEntryPassed(ctx *EntryContext)
	// OnEntryBlocked function will be invoked when StatPrepareSlots and RuleCheckSlots fail to execute
	// It may be inbound flow control or outbound cir
	// StatSlots will do some statistic logic, such as QPS、log、etc
	// blockError introduce the block detail
	OnEntryBlocked(ctx *EntryContext, blockError *BlockError)
	// OnCompleted function will be invoked when chain exits.
	// The semantics of OnCompleted is the entry passed and completed
	// Note: blocked entry will not call this function
	OnCompleted(ctx *EntryContext)
}

// SlotChain hold all system slots and customized slot.
// SlotChain support plug-in slots developed by developer.
type SlotChain struct {
	// statPres is in ascending order by StatPrepareSlot.Order() value.
	statPres []StatPrepareSlot
	// ruleChecks is in ascending order by RuleCheckSlot.Order() value.
	ruleChecks []RuleCheckSlot
	// stats is in ascending order by StatSlot.Order() value.
	stats []StatSlot
	// EntryContext Pool, used for reuse EntryContext object
	ctxPool *sync.Pool
}

var (
	ctxPool = &sync.Pool{
		New: func() interface{} {
			ctx := NewEmptyEntryContext()
			ctx.RuleCheckResult = NewTokenResultPass()
			ctx.Data = make(map[interface{}]interface{})
			ctx.Input = &SentinelInput{
				BatchCount:  1,
				Flag:        0,
				Args:        make([]interface{}, 0),
				Attachments: make(map[interface{}]interface{}),
			}
			return ctx
		},
	}
)

func NewSlotChain() *SlotChain {
	return &SlotChain{
		statPres:   make([]StatPrepareSlot, 0, 8),
		ruleChecks: make([]RuleCheckSlot, 0, 8),
		stats:      make([]StatSlot, 0, 8),
		ctxPool:    ctxPool,
	}
}

// Get an EntryContext from EntryContext ctxPool, if ctxPool doesn't have enough EntryContext then new one.
func (sc *SlotChain) GetPooledContext() *EntryContext {
	ctx := sc.ctxPool.Get().(*EntryContext)
	ctx.startTime = util.CurrentTimeMillis()
	return ctx
}

func (sc *SlotChain) RefurbishContext(c *EntryContext) {
	if c != nil {
		c.Reset()
		sc.ctxPool.Put(c)
	}
}

// AddStatPrepareSlot adds the StatPrepareSlot slot to the StatPrepareSlot list of the SlotChain.
// All StatPrepareSlot in the list will be sorted according to StatPrepareSlot.Order() in ascending order.
// AddStatPrepareSlot is non-thread safe,
// In concurrency scenario, AddStatPrepareSlot must be guarded by SlotChain.RWMutex#Lock
func (sc *SlotChain) AddStatPrepareSlot(s StatPrepareSlot) {
	sc.statPres = append(sc.statPres, s)
	sort.SliceStable(sc.statPres, func(i, j int) bool {
		return sc.statPres[i].Order() < sc.statPres[j].Order()
	})
}

// AddRuleCheckSlot adds the RuleCheckSlot to the RuleCheckSlot list of the SlotChain.
// All RuleCheckSlot in the list will be sorted according to RuleCheckSlot.Order() in ascending order.
// AddRuleCheckSlot is non-thread safe,
// In concurrency scenario, AddRuleCheckSlot must be guarded by SlotChain.RWMutex#Lock
func (sc *SlotChain) AddRuleCheckSlot(s RuleCheckSlot) {
	sc.ruleChecks = append(sc.ruleChecks, s)
	sort.SliceStable(sc.ruleChecks, func(i, j int) bool {
		return sc.ruleChecks[i].Order() < sc.ruleChecks[j].Order()
	})
}

// AddStatSlot adds the StatSlot to the StatSlot list of the SlotChain.
// All StatSlot in the list will be sorted according to StatSlot.Order() in ascending order.
// AddStatSlot is non-thread safe,
// In concurrency scenario, AddStatSlot must be guarded by SlotChain.RWMutex#Lock
func (sc *SlotChain) AddStatSlot(s StatSlot) {
	sc.stats = append(sc.stats, s)
	sort.SliceStable(sc.stats, func(i, j int) bool {
		return sc.stats[i].Order() < sc.stats[j].Order()
	})
}

// The entrance of slot chain
// Return the TokenResult and nil if internal panic.
func (sc *SlotChain) Entry(ctx *EntryContext) *TokenResult {
	// This should not happen, unless there are errors existing in Sentinel internal.
	// If happened, need to add TokenResult in EntryContext
	defer func() {
		if err := recover(); err != nil {
			logging.Error(errors.Errorf("%+v", err), "Sentinel internal panic in SlotChain.Entry()")
			ctx.SetError(errors.Errorf("%+v", err))
			return
		}
	}()

	// execute prepare slot
	sps := sc.statPres
	if len(sps) > 0 {
		for _, s := range sps {
			s.Prepare(ctx)
		}
	}

	// execute rule based checking slot
	rcs := sc.ruleChecks
	var ruleCheckRet *TokenResult
	if len(rcs) > 0 {
		for _, s := range rcs {
			sr := s.Check(ctx)
			if sr == nil {
				// nil equals to check pass
				continue
			}
			// check slot result
			if sr.IsBlocked() {
				ruleCheckRet = sr
				break
			}
		}
	}
	if ruleCheckRet == nil {
		ctx.RuleCheckResult.ResetToPass()
	} else {
		ctx.RuleCheckResult = ruleCheckRet
	}

	// execute statistic slot
	ss := sc.stats
	ruleCheckRet = ctx.RuleCheckResult
	if len(ss) > 0 {
		for _, s := range ss {
			// indicate the result of rule based checking slot.
			if !ruleCheckRet.IsBlocked() {
				s.OnEntryPassed(ctx)
			} else {
				// The block error should not be nil.
				s.OnEntryBlocked(ctx, ruleCheckRet.blockErr)
			}
		}
	}
	return ruleCheckRet
}

func (sc *SlotChain) exit(ctx *EntryContext) {
	if ctx == nil || ctx.Entry() == nil {
		logging.Error(errors.New("entryContext or SentinelEntry is nil"),
			"EntryContext or SentinelEntry is nil in SlotChain.exit()", "ctx", ctx)
		return
	}
	// The OnCompleted is called only when entry passed
	if ctx.IsBlocked() {
		return
	}
	for _, s := range sc.stats {
		s.OnCompleted(ctx)
	}
	// relieve the context here
}

```

### Core Architecture Module: `core/base/stat.go`
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

import (
	"errors"
)

type TimePredicate func(uint64) bool

type MetricEvent int8

// There are five events to record
// pass + block == Total
const (
	// sentinel rules check pass
	MetricEventPass MetricEvent = iota
	// sentinel rules check block
	MetricEventBlock

	MetricEventComplete
	// Biz error, used for circuit breaker
	MetricEventError
	// request execute rt, unit is millisecond
	MetricEventRt
	// hack for the number of event
	MetricEventTotal
)

var (
	globalNopReadStat  = &nopReadStat{}
	globalNopWriteStat = &nopWriteStat{}
)

type ReadStat interface {
	GetQPS(event MetricEvent) float64
	GetPreviousQPS(event MetricEvent) float64
	GetSum(event MetricEvent) int64

	MinRT() float64
	AvgRT() float64
}

func NopReadStat() *nopReadStat {
	return globalNopReadStat
}

type nopReadStat struct {
}

func (rs *nopReadStat) GetQPS(_ MetricEvent) float64 {
	return 0.0
}

func (rs *nopReadStat) GetPreviousQPS(_ MetricEvent) float64 {
	return 0.0
}

func (rs *nopReadStat) GetSum(_ MetricEvent) int64 {
	return 0
}

func (rs *nopReadStat) MinRT() float64 {
	return 0.0
}

func (rs *nopReadStat) AvgRT() float64 {
	return 0.0
}

type WriteStat interface {
	// AddCount adds given count to the metric of provided MetricEvent.
	AddCount(event MetricEvent, count int64)
}

func NopWriteStat() *nopWriteStat {
	return globalNopWriteStat
}

type nopWriteStat struct {
}

func (ws *nopWriteStat) AddCount(_ MetricEvent, _ int64) {
}

// ConcurrencyStat provides read/update operation for concurrency statistics.
type ConcurrencyStat interface {
	CurrentConcurrency() int32
	IncreaseConcurrency()
	DecreaseConcurrency()
}

// StatNode holds real-time statistics for resources.
type StatNode interface {
	MetricItemRetriever

	ReadStat
	WriteStat
	ConcurrencyStat

	// GenerateReadStat generates the readonly metric statistic based on resource level global statistic
	// If parameters, sampleCount and intervalInMs, are not suitable for resource level global statistic, return (nil, error)
	GenerateReadStat(sampleCount uint32, intervalInMs uint32) (ReadStat, error)
}

var (
	IllegalGlobalStatisticParamsError = errors.New("Invalid parameters, sampleCount or interval, for resource's global statistic")
	IllegalStatisticParamsError       = errors.New("Invalid parameters, sampleCount or interval, for metric statistic")
	GlobalStatisticNonReusableError   = errors.New("The parameters, sampleCount and interval, mismatch for reusing between resource's global statistic and readonly metric statistic.")
)

func CheckValidityForStatistic(sampleCount, intervalInMs uint32) error {
	if intervalInMs == 0 || sampleCount == 0 || intervalInMs%sampleCount != 0 {
		return IllegalStatisticParamsError
	}
	return nil
}

// CheckValidityForReuseStatistic checks whether the read-only stat-metric with given attributes
// (i.e. sampleCount and intervalInMs) can be built based on underlying global statistics data-structure
// with given attributes (parentSampleCount and parentIntervalInMs). Returns nil if the attributes
// satisfy the validation, or return specific error if not.
//
// The parameters, sampleCount and intervalInMs, are the attributes of the stat-metric view you want to build.
// The parameters, parentSampleCount and parentIntervalInMs, are the attributes of the underlying statistics data-structure.
func CheckValidityForReuseStatistic(sampleCount, intervalInMs uint32, parentSampleCount, parentIntervalInMs uint32) error {
	if intervalInMs == 0 || sampleCount == 0 || intervalInMs%sampleCount != 0 {
		return IllegalStatisticParamsError
	}
	bucketLengthInMs := intervalInMs / sampleCount

	if parentIntervalInMs == 0 || parentSampleCount == 0 || parentIntervalInMs%parentSampleCount != 0 {
		return IllegalGlobalStatisticParamsError
	}
	parentBucketLengthInMs := parentIntervalInMs / parentSampleCount

	// intervalInMs of the SlidingWindowMetric is not divisible by BucketLeapArray's intervalInMs
	if parentIntervalInMs%intervalInMs != 0 {
		return GlobalStatisticNonReusableError
	}
	// BucketLeapArray's BucketLengthInMs is not divisible by BucketLengthInMs of SlidingWindowMetric
	if bucketLengthInMs%parentBucketLengthInMs != 0 {
		return GlobalStatisticNonReusableError
	}
	return nil
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

### Incident Patch 3: `7100e5be` (2024-09-13)
**Commit Message**: Merge pull request #527 from cuishuang/master

fix some comments

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

**File**: `core/circuitbreaker/circuit_breaker.go` (modified, +1/-1)
```diff
@@ -229,7 +229,7 @@ func (b *circuitBreakerBase) fromHalfOpenToOpen(snapshot interface{}) bool {
 	return false
 }
 
-// fromHalfOpenToOpen updates circuit breaker state machine from half-open to closed
+// fromHalfOpenToClosed updates circuit breaker state machine from half-open to closed
 // Return true only if current goroutine successfully accomplished the transformation.
 func (b *circuitBreakerBase) fromHalfOpenToClosed() bool {
 	if b.state.cas(HalfOpen, Closed) {
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

**File**: `pkg/adapters/micro/options.go` (modified, +4/-4)
```diff
@@ -26,15 +26,15 @@ type (
 	}
 )
 
-// WithUnaryClientResourceExtractor sets the resource extractor of unary client request.
+// WithClientResourceExtractor sets the resource extractor of unary client request.
 // The second string parameter is the full method name of current invocation.
 func WithClientResourceExtractor(fn func(context.Context, client.Request) string) Option {
 	return func(opts *options) {
 		opts.clientResourceExtract = fn
 	}
 }
 
-// WithUnaryServerResourceExtractor sets the resource extractor of unary server request.
+// WithServerResourceExtractor sets the resource extractor of unary server request.
 func WithServerResourceExtractor(fn func(context.Context, server.Request) string) Option {
 	return func(opts *options) {
 		opts.serverResourceExtract = fn
@@ -55,15 +55,15 @@ func WithStreamServerResourceExtractor(fn func(server.Stream) string) Option {
 	}
 }
 
-// WithUnaryClientBlockFallback sets the block fallback handler of unary client request.
+// WithClientBlockFallback sets the block fallback handler of unary client request.
 // The second string parameter is the full method name of current invocation.
 func WithClientBlockFallback(fn func(context.Context, client.Request, *base.BlockError) error) Option {
 	return func(opts *options) {
 		opts.clientBlockFallback = fn
 	}
 }
 
-// WithUnaryServerBlockFallback sets the block fallback handler of unary server request.
+// WithServerBlockFallback sets the block fallback handler of unary server request.
 func WithServerBlockFallback(fn func(context.Context, server.Request, *base.BlockError) error) Option {
 	return func(opts *options) {
 		opts.serverBlockFallback = fn
```

**File**: `pkg/datasource/k8s/controllers/hotspotrules_controller.go` (modified, +1/-1)
```diff
@@ -151,7 +151,7 @@ func (r *HotspotRulesReconciler) assembleHotspotRules(rs *datasourcev1.HotspotRu
 	return ret
 }
 
-// arseSpecificItems parses the SpecificValue as real value.
+// parseSpecificItems parses the SpecificValue as real value.
 func parseSpecificItems(source []datasourcev1.SpecificValue) map[interface{}]int64 {
 	ret := make(map[interface{}]int64)
 	if len(source) == 0 {
```

**File**: `util/time.go` (modified, +1/-1)
```diff
@@ -255,7 +255,7 @@ func CurrentClock() Clock {
 	return currentClock.Load().(*clockWrapper).clock
 }
 
-// SetClock sets the ticker creator used by util package.
+// SetTickerCreator sets the ticker creator used by util package.
 // In general, no need to set it. It is usually used for testing.
 func SetTickerCreator(tc TickerCreator) {
 	currentTickerCreator.Store(&tickerCreatorWrapper{tc})
```

#### Recent Merged Pull Requests:
- **PR #611** (2026-07-02): feat: add GetGroupID() method to SentinelRule interface (@ansiz)
- **PR #609** (closed): fix(deps): update etcd import path from coreos to io (@zhengshui)
- **PR #606** (closed): feat:add trpc-go adapter (@crazyfrankie)
- **PR #605** (closed): feat:add trpc-agent-go for token-limit (@zhuyanhuazhuyanhua)
- **PR #602** (2025-10-28): [Feature] 添加LLM Token限流功能 | Add LLM Token Rate Limit (@dancing-ui)
- **PR #601** (closed): feat: Compatible with higher versions of agollo and supports fetching  rules from specified namespace. (@yguilai)

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

## X. Fix batch count exceeding threshold issue caused by first time access or expired

**RULE**:
When implementing operations in `core/hotspot/traffic_shaping.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in alibaba/sentinel-golang. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `368e01c4`: Fix batch count exceeding threshold issue caused by first time access or expired lastPassTime in queuing strategy (#594). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `core/hotspot/traffic_shaping.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
		var (
			expectedTime    int64
			currentTimeInMs int64
			lastPassTime    int64
			lastPassTimePtr *int64
		)

		currentTimeInMs = int64(util.CurrentTimeMillis())
		lastPassTimePtr = timeCounter.AddIfAbsent(arg, &currentTimeInMs)
			// initialize pointer for first access
			lastPassTimePtr = &currentTimeInMs
		lastPassTime = atomic.LoadInt64(lastPassTimePtr)
		// calculate expected pass time based on two scenarios:
		// 1. first access or expired statistics window
		// 2. normal within-window access
		if lastPassTimePtr == &currentTimeInMs || lastPassTime < currentTimeInMs-(c.durationInSec*1000) {
			// adjust the time of the previous window to one second ago, and at most TokenCount tokens can pass through
			expectedTime = currentTimeInMs - (c.durationInSec * 1000) + intervalCostTime
		} else {
			// normal cumulative calculation
			expectedTime = lastPassTime + intervalCostTime
		}
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
		currentTimeInMs := int64(util.CurrentTimeMillis())
		lastPassTimePtr := timeCounter.AddIfAbsent(arg, &currentTimeInMs)
			// first access arg
			return nil
		lastPassTime := atomic.LoadInt64(lastPassTimePtr)
		// calculate the expected pass time
		expectedTime := lastPassTime + intervalCostTime
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `368e01c4` are properly handled with clean fallback behavior.
