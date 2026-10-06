# Forensic Learning Record (Deep Inspection): alibaba/sentinel-golang

> **Canonical Artifact**: `07_PROJECT_LEARNING/alibaba-sentinel-golang-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/alibaba/sentinel-golang](https://github.com/alibaba/sentinel-golang))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:04:15.041Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `alibaba/sentinel-golang`
- **Description**: Sentinel Go enables reliability and resiliency for Go microservices
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 2960 stars

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

### Core Architecture Module: `core/circuitbreaker/circuit_breaker.go`
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

package circuitbreaker

import (
	"reflect"
	"sync/atomic"

	"github.com/alibaba/sentinel-golang/core/base"
	sbase "github.com/alibaba/sentinel-golang/core/stat/base"
	metric_exporter "github.com/alibaba/sentinel-golang/exporter/metric"
	"github.com/alibaba/sentinel-golang/logging"
	"github.com/alibaba/sentinel-golang/util"
	"github.com/pkg/errors"
)

//	 Circuit Breaker State Machine:
//
//	                                switch to open based on rule
//					+-----------------------------------------------------------------------+
//					|                                                                       |
//					|                                                                       v
//			+----------------+                   +----------------+      Probe      +----------------+
//			|                |                   |                |<----------------|                |
//			|                |   Probe succeed   |                |                 |                |
//			|     Closed     |<------------------|    HalfOpen    |                 |      Open      |
//			|                |                   |                |   Probe failed  |                |
//			|                |                   |                +---------------->|                |
//			+----------------+                   +----------------+                 +----------------+
type State int32

const (
	Closed State = iota
	HalfOpen
	Open
)

var (
	stateChangedCounter = metric_exporter.NewCounter(
		"circuit_breaker_state_changed_total",
		"Circuit breaker total state change count",
		[]string{"resource", "from_state", "to_state"})
)

func init() {
	metric_exporter.Register(stateChangedCounter)
}

func newState() *State {
	var state State
	state = Closed

	return &state
}

func (s *State) String() string {
	switch s.get() {
	case Closed:
		return "Closed"
	case HalfOpen:
		return "HalfOpen"
	case Open:
		return "Open"
	default:
		return "Undefined"
	}
}

func (s *State) get() State {
	return State(atomic.LoadInt32((*int32)(s)))
}

func (s *State) set(update State) {
	atomic.StoreInt32((*int32)(s), int32(update))
}

func (s *State) cas(expect State, update State) bool {
	return atomic.CompareAndSwapInt32((*int32)(s), int32(expect), int32(update))
}

// StateChangeListener listens on the circuit breaker state change event
type StateChangeListener interface {
	// OnTransformToClosed is triggered when circuit breaker state transformed to Closed.
	// Argument rule is copy from circuit breaker's rule, any changes of rule don't take effect for circuit breaker
	// Copying rule has a performance penalty and avoids invalid listeners as much as possible
	OnTransformToClosed(prev State, rule Rule)

	// OnTransformToOpen is triggered when circuit breaker state transformed to Open.
	// The "snapshot" indicates the triggered value when the transformation occurs.
	// Argument rule is copy from circuit breaker's rule, any changes of rule don't take effect for circuit breaker
	// Copying rule has a performance penalty and avoids invalid listeners as much as possible
	OnTransformToOpen(prev State, rule Rule, snapshot interface{})

	// OnTransformToHalfOpen is triggered when circuit breaker state transformed to HalfOpen.
	// Argument rule is copy from circuit breaker's rule, any changes of rule don't take effect for circuit breaker
	// Copying rule has a performance penalty and avoids invalid listeners as much as possible
	OnTransformToHalfOpen(prev State, rule Rule)
}

// CircuitBreaker is the basic interface of circuit breaker
type CircuitBreaker interface {
	// BoundRule returns the associated circuit breaking rule.
	BoundRule() *Rule
	// BoundStat returns the associated statistic data structure.
	BoundStat() interface{}
	// TryPass acquires permission of an invocation only if it is available at the time of invocation.
	TryPass(ctx *base.EntryContext) bool
	// CurrentState returns current state of the circuit breaker.
	CurrentState() State
	// OnRequestComplete record a completed request with the given response time as well as error (if present),
	// and handle state transformation of the circuit breaker.
	// OnRequestComplete is called only when a passed invocation finished.
	OnRequestComplete(rtt uint64, err error)
}

// ================================= circuitBreakerBase ====================================
// circuitBreakerBase encompasses the common fields of circuit breaker.
type circuitBreakerBase struct {
	rule *Rule
	// retryTimeoutMs represents recovery timeout (in milliseconds) before the circuit breaker opens.
	// During the open period, no requests are permitted until the timeout has elapsed.
	// After that, the circuit breaker will transform to half-open state for trying a few "trial" requests.
	retryTimeoutMs uint32
	// nextRetryTimestampMs is the time circuit breaker could probe
	nextRetryTimestampMs uint64
	// probeNumber is the number of probe requests that are allowed to pass when the circuit breaker is half open.
	probeNumber uint64
	// curProbeNumber is the real-time probe number.
	curProbeNumber uint64
	// state is the state machine of circuit breaker
	state *State
}

func (b *circuitBreakerBase) BoundRule() *Rule {
	return b.rule
}

func (b *circuitBreakerBase) CurrentState() State {
	return b.state.get()
}

func (b *circuitBreakerBase) retryTimeoutArrived() bool {
	return util.CurrentTimeMillis() >= atomic.LoadUint64(&b.nextRetryTimestampMs)
}

func (b *circuitBreakerBase) updateNextRetryTimestamp() {
	atomic.StoreUint64(&b.nextRetryTimestampMs, util.CurrentTimeMillis()+uint64(b.retryTimeoutMs))
}

func (b *circuitBreakerBase) addCurProbeNum() {
	atomic.AddUint64(&b.curProbeNumber, 1)
}

func (b *circuitBreakerBase) resetCurProbeNum() {
	atomic.StoreUint64(&b.curProbeNumber, 0)
}

// fromClosedToOpen updates circuit breaker state machine from closed to open.
// Return true only if current goroutine successfully accomplished the transformation.
func (b *circuitBreakerBase) fromClosedToOpen(snapshot interface{}) bool {
	if b.state.cas(Closed, Open) {
		b.updateNextRetryTimestamp()
		for _, listener := range stateChangeListeners {
			listener.OnTransformToOpen(Closed, *b.rule, snapshot)
		}

		stateChangedCounter.Add(float64(1), b.BoundRule().Resource, "Closed", "Open")
		return true
	}
	return false
}

// fromOpenToHalfOpen updates circuit breaker state machine from open to half-open.
// Return true only if current goroutine successfully accomplished the transformation.
func (b *circuitBreakerBase) fromOpenToHalfOpen(ctx *base.EntryContext) bool {
	if b.state.cas(Open, HalfOpen) {
		for _, listener := range stateChangeListeners {
			listener.OnTransformToHalfOpen(Open, *b.rule)
		}

		entry := ctx.Entry()
		if entry == nil {
			logging.Error(errors.New("nil entry"), "Nil entry in circuitBreakerBase.fromOpenToHalfOpen()", "rule", b.rule)
		} else {
			// add hook for entry exit
			// if the current circuit breaker performs the probe through this entry, but the entry was blocked,
			// this hook will guarantee current circuit breaker state machine will rollback to Open from Half-Open
			entry.WhenExit(func(entry *base.SentinelEntry, ctx *base.EntryContext) error {
				if ctx.IsBlocked() && b.state.cas(HalfOpen, Open) {
					for _, listener := range stateChangeListeners {
						listener.OnTransformToOpen(HalfOpen, *b.rule, 1.0)
					}
				}
				return nil
			})
		}

		stateChangedCounter.Add(float64(1), b.BoundRule().Resource, "Open", "HalfOpen")
		return true
	}
	return false
}

// fromHalfOpenToOpen updates circuit breaker state machine from half-open to open.
// Return true only if current goroutine successfully accomplished the transformation.
func (b *circuitBreakerBase) fromHalfOpenToOpen(snapshot interface{}) bool {
	if b.state.cas(HalfOpen, Open) {
		b.resetCurProbeNum()
		b.updateNextRetryTimestamp()
		for _, listener := range stateChangeListeners {
			listener.OnTransformToOpen(HalfOpen, *b.rule, snapshot)
		}

		stateChangedCounter.Add(float64(1), b.BoundRule().Resource, "HalfOpen", "Open")
		return true
	}
	return false
}

// fromHalfOpenToClosed updates circuit breaker state machine from half-open to closed
// Return true only if current goroutine successfully accomplished the transformation.
func (b *circuitBreakerBase) fromHalfOpenToClosed() bool {
	if b.state.cas(HalfOpen, Closed) {
		b.resetCurProbeNum()
		for _, listener := range stateChangeListeners {
			listener.OnTransformToClosed(HalfOpen, *b.rule)
		}

		stateChangedCounter.Add(float64(1), b.BoundRule().Resource, "HalfOpen", "Closed")
		return true
	}
	return false
}

// ================================= slowRtCircuitBreaker ====================================
type slowRtCircuitBreaker struct {
	circuitBreakerBase
	stat                *slowRequestLeapArray
	maxAllowedRt        uint64
	maxSlowRequestRatio float64
	minRequestAmount    uint64
}

func newSlowRtCircuitBreakerWithStat(r *Rule, stat *slowRequestLeapArray) *slowRtCircuitBreaker {
	return &slowRtCircuitBreaker{
		circuitBreakerBase: circuitBreakerBase{
			rule:                 r,
			retryTimeoutMs:       r.RetryTimeoutMs,
			nextRetryTimestampMs: 0,
			state:                newState(),
			probeNumber:          r.ProbeNum,
		},
		stat:                stat,
		maxAllowedRt:        r.MaxAllowedRtMs,
		maxSlowRequestRatio: r.Threshold,
		minRequestAmount:    r.MinRequestAmount,
	}
}

func newSlowRtCircuitBreake
```

### Core Architecture Module: `core/circuitbreaker/doc.go`
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

// Package circuitbreaker implements the circuit breaker pattern, which provides
// stability and prevents cascading failures in distributed systems.
//
// Sentinel circuit breaker module supports three strategies:
//
//  1. SlowRequestRatio: the ratio of slow response time entry(entry's response time is great than max slow response time) exceeds the threshold. The following entry to resource will be broken.
//     In SlowRequestRatio strategy, user must set max response time.
//  2. ErrorRatio: the ratio of error entry exceeds the threshold. The following entry to resource will be broken.
//  3. ErrorCount: the number of error entry exceeds the threshold. The following entry to resource will be broken.
//
// Sentinel converts each circuit breaking Rule into a CircuitBreaker. Each CircuitBreaker has its own statistical structure.
//
// Sentinel circuit breaker is implemented based on state machines. There are three states:
//
//  1. Closed: all entries could pass checking.
//  2. Open: the circuit breaker is broken, all entries are blocked. After retry timeout, circuit breaker switches state to Half-Open and allows one entry to probe whether the resource returns to its expected state.
//  3. Half-Open: the circuit breaker is in a temporary state of probing, only one entry is allowed to access resource, others are blocked.
//
// Sentinel circuit breaker provides the listener to observe events of state changes.
//
//	type StateChangeListener interface {
//		OnTransformToClosed(prev State, rule Rule)
//
//		OnTransformToOpen(prev State, rule Rule, snapshot interface{})
//
//		OnTransformToHalfOpen(prev State, rule Rule)
//	}
//
// Here is the example code to use circuit breaker:
//
//	 type stateChangeTestListener struct {}
//
//	 func (s *stateChangeTestListener) OnTransformToClosed(prev circuitbreaker.State, rule circuitbreaker.Rule) {
//	 	fmt.Printf("rule.steategy: %+v, From %s to Closed, time: %d\n", rule.Strategy, prev.String(), util.CurrentTimeMillis())
//	 }
//
//	 func (s *stateChangeTestListener) OnTransformToOpen(prev circuitbreaker.State, rule circuitbreaker.Rule, snapshot interface{}) {
//	 	fmt.Printf("rule.steategy: %+v, From %s to Open, snapshot: %.2f, time: %d\n", rule.Strategy, prev.String(), snapshot, util.CurrentTimeMillis())
//	 }
//
//	 func (s *stateChangeTestListener) OnTransformToHalfOpen(prev circuitbreaker.State, rule circuitbreaker.Rule) {
//	 	fmt.Printf("rule.steategy: %+v, From %s to Half-Open, time: %d\n", rule.Strategy, prev.String(), util.CurrentTimeMillis())
//	 }
//
//	 func main() {
//	 	err := sentinel.InitDefault()
//	 	if err != nil {
//	 		log.Fatal(err)
//	 	}
//	 	ch := make(chan struct{})
//	 	// Register a state change listener so that we could observer the state change of the internal circuit breaker.
//	 	circuitbreaker.RegisterStateChangeListeners(&stateChangeTestListener{})
//
//	 	_, err = circuitbreaker.LoadRules([]*circuitbreaker.Rule{
//	 	// Statistic time span=10s, recoveryTimeout=3s, slowRtUpperBound=50ms, maxSlowRequestRatio=50%
//	 		{
//	 			Resource:         "abc",
//	 			Strategy:         circuitbreaker.SlowRequestRatio,
//	 			RetryTimeoutMs:   3000,
//	 			MinRequestAmount: 10,
//	 			StatIntervalMs:   10000,
//	 			MaxAllowedRtMs:   50,
//	 			Threshold:        0.5,
//	 		},
//	 		// Statistic time span=10s, recoveryTimeout=3s, maxErrorRatio=50%
//	 		{
//	 			Resource:         "abc",
//	 			Strategy:         circuitbreaker.ErrorRatio,
//	 			RetryTimeoutMs:   3000,
//	 			MinRequestAmount: 10,
//	 			StatIntervalMs:   10000,
//	 			Threshold:        0.5,
//	 		},
//	 	})
//	 	if err != nil {
//	 		log.Fatal(err)
//	 	}
//
//	 	fmt.Println("Sentinel Go circuit breaking demo is running. You may see the pass/block metric in the metric log.")
//	 	go func() {
//	 		for {
//	 			e, b := sentinel.Entry("abc")
//	 			if b != nil {
//	 				//fmt.Println("g1blocked")
//	 				time.Sleep(time.Duration(rand.Uint64()%20) * time.Millisecond)
//	 			} else {
//	 				if rand.Uint64()%20 > 9 {
//	 					// Record current invocation as error.
//	 					sentinel.TraceError(e, errors.New("biz error"))
//	 				}
//	 				//fmt.Println("g1passed")
//	 				time.Sleep(time.Duration(rand.Uint64()%80+10) * time.Millisecond)
//	 				e.Exit()
//	 			}
//	 		}
//			}()
//
//	 	go func() {
//	 		for {
//	 			e, b := sentinel.Entry("abc")
//	 			if b != nil {
//	 				//fmt.Println("g2blocked")
//	 				time.Sleep(time.Duration(rand.Uint64()%20) * time.Millisecond)
//	 			} else {
//	 				//fmt.Println("g2passed")
//	 				time.Sleep(time.Duration(rand.Uint64()%80) * time.Millisecond)
//	 				e.Exit()
//	 			}
//	 		}
//	 	}()
//	 	<-ch
//	 }
package circuitbreaker

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

---

### Incident Patch 4: `67f7f695` (2024-03-27)
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

### Incident Patch 5: `e2f2f73c` (2023-06-25)
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

### Incident Patch 6: `ddd26426` (2023-06-24)
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
-//  			if b != nil {
-//  				//fmt.Println("g2blocked")
-//  				time.Sleep(time.Duration(rand.Uint64()%20) * time.Millisecond)
-//  			} else {
-//  				//fmt.Println("g2passed")
-//  				time.Sleep(time.Duration(rand.Uint64()%80) * time.Millisecond)
-//  				e.Exit()
-//  			}
-//  		}
-//  	}()
-//  	<-ch
-//  }
-//
+//	 type stateChangeTestListener struct {}
+//
+//	 func (s *stateChangeTestListener) OnTransformToClosed(prev circuitbreaker.State, rule circuitbreaker.Rule) {
+//	 	fmt.Printf("rule.steategy: %+v, From %s to Closed, time: %d\n", rule.Strategy, prev.String(), util.CurrentTimeMillis())
+//	 }
+//
+//	 func (s *stateChangeTestListener) OnTransformToOpen(prev circuitbreaker.State, rule circuitbreaker.Rule, snapshot interface{}) {
+//	 	fmt.Printf("rule.steategy: %+v, From %s to Open, snapshot: %.2f, time: %d\n", rule.Strategy, prev.String(), snapshot, util.CurrentTimeMillis())
+//	 }
+//
+//	 func (s *stateChangeTestListener) OnTransformToHalfOpen(prev circuitbreaker.St
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

**File**: `core/flow/doc.go` (modified, +0/-1)
```diff
@@ -26,5 +26,4 @@
 //
 //  1. The function both SetTrafficShapingGenerator and RemoveTrafficShapingGenerator is not thread safe.
 //  2. Users can not override the Sentinel supported TrafficShapingController.
-//
 package flow
```

**File**: `core/flow/tc_adaptive.go` (modified, +1/-0)
```diff
@@ -11,6 +11,7 @@ import (
 // If the watermark is less than Rule.MemLowWaterMarkBytes, the threshold is Rule.LowMemUsageThreshold.
 // If the watermark is greater than Rule.MemHighWaterMarkBytes, the threshold is Rule.HighMemUsageThreshold.
 // Otherwise, the threshold is ((watermark - MemLowWaterMarkBytes)/(MemHighWaterMarkBytes - MemLowWaterMarkBytes)) *
+//
 //	(HighMemUsageThreshold - LowMemUsageThreshold) + LowMemUsageThreshold.
 type MemoryAdaptiveTrafficShapingCalculator struct {
 	owner                 *TrafficShapingController
```

**File**: `core/hotspot/rule.go` (modified, +4/-8)
```diff
@@ -15,7 +15,6 @@
 package hotspot
 
 import (
-	"encoding/json"
 	"fmt"
 	"reflect"
 	"strconv"
@@ -101,14 +100,11 @@ type Rule struct {
 }
 
 func (r *Rule) String() string {
-	b, err := json.Marshal(r)
-	if err != nil {
-		// Return the fallback string
-		return fmt.Sprintf("{Id:%s, Resource:%s, MetricType:%+v, ControlBehavior:%+v, ParamIndex:%d, ParamKey:%s, Threshold:%d, MaxQueueingTimeMs:%d, BurstCount:%d, DurationInSec:%d, ParamsMaxCapacity:%d, SpecificItems:%+v}",
-			r.ID, r.Resource, r.MetricType, r.ControlBehavior, r.ParamIndex, r.ParamKey, r.Threshold, r.MaxQueueingTimeMs, r.BurstCount, r.DurationInSec, r.ParamsMaxCapacity, r.SpecificItems)
-	}
-	return string(b)
+	// Return the fallback string
+	return fmt.Sprintf("{Id:%s, Resource:%s, MetricType:%+v, ControlBehavior:%+v, ParamIndex:%d, ParamKey:%s, Threshold:%d, MaxQueueingTimeMs:%d, BurstCount:%d, DurationInSec:%d, ParamsMaxCapacity:%d, SpecificItems:%+v}",
+		r.ID, r.Resource, r.MetricType, r.ControlBehavior, r.ParamIndex, r.ParamKey, r.Threshold, r.MaxQueueingTimeMs, r.BurstCount, r.DurationInSec, r.ParamsMaxCapacity, r.SpecificItems)
 }
+
 func (r *Rule) ResourceName() string {
 	return r.Resource
 }
```

---

### Incident Patch 7: `a2e7b218` (2023-04-21)
**Commit Message**: fix some comments

Signed-off-by: cui fliter <[REDACTED_EMAIL]>

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
 
-//================================= errorCountCircuitBreaker ====================================
+// ================================= errorCountCircuitBreaker ====================================
 type errorCountCircuitBreaker struct {
 	circuitBreakerBase
 	minRequestAmount    uint64
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

---

### Incident Patch 8: `31069bac` (2022-09-25)
**Commit Message**: Merge pull request #484 from tylitianrui/feature/code_optimize

code optimization

**File**: `core/hotspot/cache/lru.go` (modified, +5/-4)
```diff
@@ -129,19 +129,20 @@ func (c *LRU) Contains(key interface{}) (ok bool) {
 func (c *LRU) Peek(key interface{}) (value interface{}, isFound bool) {
 	var ent *list.Element
 	if ent, isFound = c.items[key]; isFound {
-		return ent.Value.(*entry).value, true
+		return ent.Value.(*entry).value, isFound
 	}
 	return nil, isFound
 }
 
 // Remove removes the provided key from the cache, returning if the
 // key was contained.
 func (c *LRU) Remove(key interface{}) (isFound bool) {
-	if ent, ok := c.items[key]; ok {
+	var ent *list.Element
+	if ent, isFound = c.items[key]; isFound {
 		c.removeElement(ent)
-		return true
+		return
 	}
-	return false
+	return
 }
 
 // RemoveOldest removes the oldest item from the cache.
```

**File**: `core/hotspot/traffic_shaping.go` (modified, +2/-3)
```diff
@@ -115,9 +115,8 @@ func (c *baseTrafficShapingController) BoundMetric() *ParamsMetric {
 
 func (c *baseTrafficShapingController) performCheckingForConcurrencyMetric(arg interface{}) *base.TokenResult {
 	specificItem := c.specificItems
-	initConcurrency := new(int64)
-	*initConcurrency = 0
-	concurrencyPtr := c.metric.ConcurrencyCounter.AddIfAbsent(arg, initConcurrency)
+	initConcurrency := int64(0)
+	concurrencyPtr := c.metric.ConcurrencyCounter.AddIfAbsent(arg, &initConcurrency)
 	if concurrencyPtr == nil {
 		// First to access this arg
 		return nil
```

---

### Incident Patch 9: `2992e5c0` (2022-08-02)
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
 github.com/bytedance/gopkg v0.0.0-20220413063733-65bf48ffb3a7/go.mod h1:2ZlV9BaUH4+NXIBF0aMdKKAnHTzqH+iMU4KUjAbL23Q=
 github.com/bytedance/sonic v1.3.0 h1:T2rlvNytw6bTmczlAXvGqmuMzIqGJBOsJKYwRPWR7Y8=
 github.com/bytedance/sonic v1.3.0/go.mod h1:V973WhNhGmvHxW6nQmsHEfHaoU9F3zTF+93rH03hcUQ=
+github.com/casbin/casbin/v2 v2.1.2/go.mod h1:YcPU1XXisHhLzuxH9coDNf2FbKpjGlbCg3n9yuLkIJQ=
+github.com/cenkalti/backoff v2.2.1+incompatible/go.mod h1:90ReRw6GdpyfrHakVjL/QHaoyV4aDUVVkXQJJJ3NXXM=
+github.com/census-instrumentation/opencensus-proto v0.2.1/go.mod h1:f6KPmirojxKA12rnyqOA5BBL4O983OfeGPqjHWSTneU=
+github.com/cespare/xxhash/v2 v2.1.1 h1:6MnRN8NT7+YBpUIWxHtefFZOKTAPgGjpQSxqLNn0+qY=
+github.com/cespare/xxhash/v2 v2.1.1/go.mod h1:VGX0DQ3Q6kWi7AoAeZDth3/j3BFtOZR5XLFGgcrjCOs=
 github.com/chenzhuoyu/base64x v0.0.0-20211019084208-fb5309c8db06 h1:1sDoSuDPWzhkdzNVxCxtIaKiAe96ESVPv8coGwc1gZ4=
 github.com/chenzhuoyu/base64x v0.0.0-20211019084208-fb5309c8db06/go.mod h1:DH46F32mSOjUmXrMHnKwZdA8wcEefY7UVqBKYGjpdQY=
+github.com/clbanning/x2j v0.0.0-20191024224557-825249438eec/go.mod h1:jMjuTZXRI4dUb/I5gc9Hdh
```

---

### Incident Patch 10: `31fdb144` (2022-05-20)
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

### Incident Patch 11: `9eabe9f0` (2021-12-11)
**Commit Message**: Add customized probe num support for circuit breaker (#428)

**File**: `core/circuitbreaker/circuit_breaker.go` (modified, +39/-7)
```diff
@@ -136,6 +136,10 @@ type circuitBreakerBase struct {
 	retryTimeoutMs uint32
 	// nextRetryTimestampMs is the time circuit breaker could probe
 	nextRetryTimestampMs uint64
+	// probeNumber is the number of probe requests that are allowed to pass when the circuit breaker is half open.
+	probeNumber uint64
+	// curProbeNumber is the real-time probe number.
+	curProbeNumber uint64
 	// state is the state machine of circuit breaker
 	state *State
 }
@@ -156,6 +160,14 @@ func (b *circuitBreakerBase) updateNextRetryTimestamp() {
 	atomic.StoreUint64(&b.nextRetryTimestampMs, util.CurrentTimeMillis()+uint64(b.retryTimeoutMs))
 }
 
+func (b *circuitBreakerBase) addCurProbeNum() {
+	atomic.AddUint64(&b.curProbeNumber, 1)
+}
+
+func (b *circuitBreakerBase) resetCurProbeNum() {
+	atomic.StoreUint64(&b.curProbeNumber, 0)
+}
+
 // fromClosedToOpen updates circuit breaker state machine from closed to open.
 // Return true only if current goroutine successfully accomplished the transformation.
 func (b *circuitBreakerBase) fromClosedToOpen(snapshot interface{}) bool {
@@ -206,6 +218,7 @@ func (b *circuitBreakerBase) fromOpenToHalfOpen(ctx *base.EntryContext) bool {
 // Return true only if current goroutine successfully accomplished the transformation.
 func (b *circuitBreakerBase) fromHalfOpenToOpen(snapshot interface{}) bool {
 	if b.state.cas(HalfOpen, Open) {
+		b.resetCurProbeNum()
 		b.updateNextRetryTimestamp()
 		for _, listener := range stateChangeListeners {
 			listener.OnTransformToOpen(HalfOpen, *b.rule, snapshot)
@@ -221,6 +234,7 @@ func (b *circuitBreakerBase) fromHalfOpenToOpen(snapshot interface{}) bool {
 // Return true only if current goroutine successfully accomplished the transformation.
 func (b *circuitBreakerBase) fromHalfOpenToClosed() bool {
 	if b.state.cas(HalfOpen, Closed) {
+		b.resetCurProbeNum()
 		for _, listener := range stateChangeListeners {
 			listener.OnTransformToClosed(HalfOpen, *b.rule)
 		}
@@ -247,6 +261,7 @@ func newSlowRtCircuitBreakerWithStat(r *Rule, stat *slowRequestLeapArray) *slowR
 			retryTimeoutMs:       r.RetryTimeoutMs,
 			nextRetryTimestampMs: 0,
 			state:                newState(),
+			probeNumber:          r.ProbeNum,
 		},
 		stat:                stat,
 		maxAllowedRt:        r.MaxAllowedRtMs,
@@ -282,6 +297,8 @@ func (b *slowRtCircuitBreaker) TryPass(ctx *base.EntryContext) bool {
 		if b.retryTimeoutArrived() && b.fromOpenToHalfOpen(ctx) {
 			return true
 		}
+	} else if curStatus == HalfOpen && b.probeNumber > 0 {
+		return true
 	}
 	return false
 }
@@ -318,9 +335,12 @@ func (b *slowRtCircuitBreaker) OnRequestComplete(rt uint64, _ error) {
 			// fail to probe
 			b.fromHalfOpenToOpen(1.0)
 		} else {
-			// succeed to probe
-			b.fromHalfOpenToClosed()
-			b.resetMetric()
+			b.addCurProbeNum()
+			if b.probeNumber == 0 || atomic.LoadUint64(&b.curProbeNumber) >= b.probeNumber {
+				// succeed to probe
+				b.fromHalfOpenToClosed()
+				b.resetMetric()
+			}
 		}
 		return
 	}
@@ -433,6 +453,7 @@ func newErrorRatioCircuitBreakerWithStat(r *Rule, stat *errorCounterLeapArray) *
 			retryTimeoutMs:       r.RetryTimeoutMs,
 			nextRetryTimestampMs: 0,
 			state:                newState(),
+			probeNumber:          r.ProbeNum,
 		},
 		minRequestAmount:    r.MinRequestAmount,
 		errorRatioThreshold: r.Threshold,
@@ -465,6 +486,8 @@ func (b *errorRatioCircuitBreaker) TryPass(ctx *base.EntryContext) bool {
 		if b.retryTimeoutArrived() && b.fromOpenToHalfOpen(ctx) {
 			return true
 		}
+	} else if curStatus == HalfOpen && b.probeNumber > 0 {
+		return true
 	}
 	return false
 }
@@ -498,8 +521,11 @@ func (b *errorRatioCircuitBreaker) OnRequestComplete(_ uint64, err error) {
 	}
 	if curStatus == HalfOpen {
 		if err == nil {
-			b.fromHalfOpenToClosed()
-			b.resetMetric()
+			b.addCurProbeNum()
+			if b.probeNumber == 0 || atomic.LoadUint64(&b.curProbeNumber) >= b.probeNumber {
+				b.fromHalfOpenToClosed()
+				b.resetMetric()
+			}
 		} else {
 			b.fromHalfOpenToOpen(1.0)
 		}
@@ -612,6 +638,7 @@ func newErrorCountCircuitBreakerWithStat(r *Rule, stat *errorCounterLeapArray) *
 			retryTimeoutMs:       r.RetryTimeoutMs,
 			nextRetryTimestampMs: 0,
 			state:                newState(),
+			probeNumber:          r.ProbeNum,
 		},
 		minRequestAmount:    r.MinRequestAmount,
 		errorCountThreshold: uint64(r.Threshold),
@@ -644,6 +671,8 @@ func (b *errorCountCircuitBreaker) TryPass(ctx *base.EntryContext) bool {
 		if b.retryTimeoutArrived() && b.fromOpenToHalfOpen(ctx) {
 			return true
 		}
+	} else if curStatus == HalfOpen && b.probeNumber > 0 {
+		return true
 	}
 	return false
 }
@@ -675,8 +704,11 @@ func (b *errorCountCircuitBreaker) OnRequestComplete(_ uint64, err error) {
 	}
 	if curStatus == HalfOpen {
 		if err == nil {
-			b.fromHalfOpenToClosed()
-			b.resetMetric()
+			b.addCurProbeNum()
+			if b.probeNumber == 0 || atomic.LoadUint64(&b.curProbeNumber) >= b.probeNumber {
+				b.fromHalfOpenToClosed()
+				b.resetMetric()
+			}
 		} else {
 			b.from
```

**File**: `core/circuitbreaker/circuit_breaker_test.go` (modified, +126/-3)
```diff
@@ -61,18 +61,15 @@ type StateChangeListenerMock struct {
 }
 
 func (s *StateChangeListenerMock) OnTransformToClosed(prev State, rule Rule) {
-	_ = s.Called(prev, rule)
 	logging.Debug("transform to closed", "strategy", rule.Strategy, "prevState", prev.String())
 	return
 }
 
 func (s *StateChangeListenerMock) OnTransformToOpen(prev State, rule Rule, snapshot interface{}) {
-	_ = s.Called(prev, rule, snapshot)
 	logging.Debug("transform to open", "strategy", rule.Strategy, "prevState", prev.String(), "snapshot", snapshot)
 }
 
 func (s *StateChangeListenerMock) OnTransformToHalfOpen(prev State, rule Rule) {
-	_ = s.Called(prev, rule)
 	logging.Debug("transform to Half-Open", "strategy", rule.Strategy, "prevState", prev.String())
 }
 
@@ -140,6 +137,35 @@ func TestSlowRtCircuitBreaker_TryPass(t *testing.T) {
 		assert.True(t, pass)
 		assert.True(t, b.state.get() == HalfOpen)
 	})
+
+	t.Run("TryPass_ProbeNum", func(t *testing.T) {
+		r := &Rule{
+			Resource:         "abc",
+			Strategy:         SlowRequestRatio,
+			RetryTimeoutMs:   3000,
+			MinRequestAmount: 10,
+			StatIntervalMs:   10000,
+			MaxAllowedRtMs:   50,
+			Threshold:        0.5,
+			ProbeNum:         10,
+		}
+		b, err := newSlowRtCircuitBreaker(r)
+		assert.Nil(t, err)
+
+		b.state.set(Open)
+		ctx := &base.EntryContext{
+			Resource: base.NewResourceWrapper("abc", base.ResTypeCommon, base.Inbound),
+		}
+		e := base.NewSentinelEntry(ctx, base.NewResourceWrapper("abc", base.ResTypeCommon, base.Inbound), nil)
+		ctx.SetEntry(e)
+		for i := 0; i < 10; i++ {
+			pass := b.TryPass(ctx)
+			assert.True(t, pass)
+			assert.True(t, b.state.get() == HalfOpen)
+			b.OnRequestComplete(1, nil)
+		}
+		assert.True(t, b.state.get() == Closed)
+	})
 }
 
 func TestSlowRt_OnRequestComplete(t *testing.T) {
@@ -169,6 +195,20 @@ func TestSlowRt_OnRequestComplete(t *testing.T) {
 		b.OnRequestComplete(10, nil)
 		assert.True(t, b.CurrentState() == Closed)
 	})
+	t.Run("OnRequestComplete_ProbeNum_Success", func(t *testing.T) {
+		b.probeNumber = 2
+		b.state.set(HalfOpen)
+		b.OnRequestComplete(10, nil)
+		assert.True(t, b.CurrentState() == HalfOpen)
+		assert.True(t, b.curProbeNumber == 1)
+	})
+	t.Run("OnRequestComplete_ProbeNum_Failed", func(t *testing.T) {
+		b.probeNumber = 2
+		b.state.set(HalfOpen)
+		b.OnRequestComplete(base.NewEmptyEntryContext().Rt(), nil)
+		assert.True(t, b.CurrentState() == Open)
+		assert.True(t, b.curProbeNumber == 0)
+	})
 }
 
 func TestSlowRt_ResetBucketTo(t *testing.T) {
@@ -227,6 +267,33 @@ func TestErrorRatioCircuitBreaker_TryPass(t *testing.T) {
 		assert.True(t, pass)
 		assert.True(t, b.state.get() == HalfOpen)
 	})
+	t.Run("TryPass_ProbeNum", func(t *testing.T) {
+		r := &Rule{
+			Resource:         "abc",
+			Strategy:         ErrorRatio,
+			RetryTimeoutMs:   3000,
+			MinRequestAmount: 10,
+			StatIntervalMs:   10000,
+			Threshold:        0.5,
+			ProbeNum:         10,
+		}
+		b, err := newErrorRatioCircuitBreaker(r)
+		assert.Nil(t, err)
+
+		b.state.set(Open)
+		ctx := &base.EntryContext{
+			Resource: base.NewResourceWrapper("abc", base.ResTypeCommon, base.Inbound),
+		}
+		e := base.NewSentinelEntry(ctx, base.NewResourceWrapper("abc", base.ResTypeCommon, base.Inbound), nil)
+		ctx.SetEntry(e)
+		for i := 0; i < 10; i++ {
+			pass := b.TryPass(ctx)
+			assert.True(t, pass)
+			assert.True(t, b.state.get() == HalfOpen)
+			b.OnRequestComplete(1, nil)
+		}
+		assert.True(t, b.state.get() == Closed)
+	})
 }
 
 func TestErrorRatio_OnRequestComplete(t *testing.T) {
@@ -254,6 +321,20 @@ func TestErrorRatio_OnRequestComplete(t *testing.T) {
 		b.OnRequestComplete(0, errors.New("errorRatio"))
 		assert.True(t, b.CurrentState() == Open)
 	})
+	t.Run("OnRequestComplete_ProbeNum_Success", func(t *testing.T) {
+		b.probeNumber = 2
+		b.state.set(HalfOpen)
+		b.OnRequestComplete(base.NewEmptyEntryContext().Rt(), nil)
+		assert.True(t, b.CurrentState() == HalfOpen)
+		assert.True(t, b.curProbeNumber == 1)
+	})
+	t.Run("OnRequestComplete_ProbeNum_Failed", func(t *testing.T) {
+		b.probeNumber = 2
+		b.state.set(HalfOpen)
+		b.OnRequestComplete(0, errors.New("errorRatio"))
+		assert.True(t, b.CurrentState() == Open)
+		assert.True(t, b.curProbeNumber == 0)
+	})
 }
 
 func TestErrorRatio_ResetBucketTo(t *testing.T) {
@@ -312,6 +393,34 @@ func TestErrorCountCircuitBreaker_TryPass(t *testing.T) {
 		assert.True(t, pass)
 		assert.True(t, b.state.get() == HalfOpen)
 	})
+
+	t.Run("TryPass_ProbeNum", func(t *testing.T) {
+		r := &Rule{
+			Resource:         "abc",
+			Strategy:         ErrorCount,
+			RetryTimeoutMs:   3000,
+			MinRequestAmount: 10,
+			StatIntervalMs:   10000,
+			Threshold:        1.0,
+			ProbeNum:         10,
+		}
+		b, err := newErrorCountCircuitBreaker(r)
+		assert.Nil(t, err)
+
+		b.state.set(Open)
+		ctx := &base.EntryContext{
+			Resource: base.NewResourceWrapper("abc", base.ResTypeCommon, base.Inbound),
+		}
+		e := base.NewSentinelEntry(ctx, base.NewResourceWrapper("abc", base.ResTypeCommon, base.Inbound
```

**File**: `core/circuitbreaker/rule.go` (modified, +5/-0)
```diff
@@ -78,6 +78,11 @@ type Rule struct {
 	// for ErrorRatio, it represents the max error request ratio
 	// for ErrorCount, it represents the max error request count
 	Threshold float64 `json:"threshold"`
+	//ProbeNum is number of probes required when the circuit breaker is half-open.
+	//when the probe num are set  and circuit breaker in the half-open state.
+	//if err occurs during the probe, the circuit breaker is opened immediately.
+	//otherwise,the circuit breaker is closed only after the number of probes is reached
+	ProbeNum uint64 `json:"probeNum"`
 }
 
 func (r *Rule) String() string {
```

---

### Incident Patch 12: `ace810bc` (2021-09-22)
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

### Incident Patch 13: `671274f0` (2021-09-09)
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

---

### Incident Patch 14: `194d4be0` (2021-07-28)
**Commit Message**: Fix LeapArray integer overflow problem on 32-bit platform (#422)

Signed-off-by: Long Dai <[REDACTED_EMAIL]>

**File**: `core/stat/base/leap_array.go` (modified, +1/-2)
```diff
@@ -70,8 +70,7 @@ func NewAtomicBucketWrapArrayWithTime(len int, bucketLengthInMs uint32, now uint
 		data:   make([]*BucketWrap, len),
 	}
 
-	timeId := now / uint64(bucketLengthInMs)
-	idx := int(timeId) % len
+	idx := int((now / uint64(bucketLengthInMs)) % uint64(len))
 	startTime := calculateStartTime(now, bucketLengthInMs)
 
 	for i := idx; i <= len-1; i++ {
```

---

### Incident Patch 15: `d022a912` (2021-07-19)
**Commit Message**: Optimize code in core/circuitbreaker/rule.go (#417)

**File**: `core/circuitbreaker/rule.go` (modified, +1/-5)
```diff
@@ -126,12 +126,8 @@ func (r *Rule) isEqualsTo(newRule *Rule) bool {
 func getRuleStatSlidingWindowBucketCount(r *Rule) uint32 {
 	interval := r.StatIntervalMs
 	bucketCount := r.StatSlidingWindowBucketCount
-	if bucketCount == 0 {
+	if bucketCount == 0 || interval%bucketCount != 0 {
 		bucketCount = 1
-	} else {
-		if interval%bucketCount != 0 {
-			bucketCount = 1
-		}
 	}
 	return bucketCount
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
