# Forensic Learning Record (Deep Inspection): lindb/lindb

> **Canonical Artifact**: `07_PROJECT_LEARNING/lindb-lindb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/lindb/lindb](https://github.com/lindb/lindb))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:38:11.529Z  
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

### Core Architecture Module: `aggregation/binary.go`
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

package aggregation

import (
	"github.com/lindb/lindb/pkg/collections"
	"github.com/lindb/lindb/sql/stmt"
)

// binaryEval evaluates two float array and returns float array
// 1. capacity not equals, return nil
// 2. merge two array based on binary operator, return other float array
// NOTE: make sure both left and right array are not nil and same capacity
func binaryEval(binaryOp stmt.BinaryOP, left, right *collections.FloatArray) *collections.FloatArray {
	if left == nil || right == nil {
		return nil
	}
	if left.IsEmpty() && right.IsEmpty() {
		return nil
	}

	capacity := left.Capacity()
	result := collections.NewFloatArray(capacity)

	for i := 0; i < capacity; i++ {
		leftHasValue := left.HasValue(i)
		rightHasValue := right.HasValue(i)
		switch {
		case !leftHasValue && right.IsSingle():
		case left.IsSingle() && !rightHasValue:
		case leftHasValue || rightHasValue:
			result.SetValue(i, eval(binaryOp, left.GetValue(i), right.GetValue(i)))
		}
	}

	return result
}

// eval evaluates two values and returns another value
func eval(binaryOp stmt.BinaryOP, left, right float64) float64 {
	switch binaryOp {
	case stmt.ADD:
		return left + right
	case stmt.SUB:
		return left - right
	case stmt.MUL:
		return left * right
	case stmt.DIV:
		if right == 0 {
			return 0
		}
		return left / right
	default:
		return 0
	}
}

```

### Core Architecture Module: `aggregation/down_sampling_agg.go`
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

package aggregation

import (
	"math"
	"sync"

	"github.com/lindb/lindb/pkg/encoding"
	"github.com/lindb/lindb/pkg/timeutil"
	"github.com/lindb/lindb/series/field"
)

const infBlockSize = 360

var (
	infFilledBlock = make([]float64, infBlockSize)
)

func init() {
	for i := 0; i < infBlockSize; i++ {
		infFilledBlock[i] = math.Inf(1) + 1
	}
}

var float64Pool sync.Pool

func fillInfBlock(sl []float64) {
	length := len(sl)
	for i := 0; i <= length/infBlockSize; i++ {
		from := i * infBlockSize
		to := (i + 1) * infBlockSize
		if to > length {
			to = length
		}
		copy(sl[from:to], infFilledBlock)
	}
}

func getFloat64Slice(size int) []float64 {
	item := float64Pool.Get()
	if item == nil {
		return make([]float64, size)
	}
	sl := item.(*[]float64)
	if cap(*sl) < size {
		return make([]float64, size)
	}
	return (*sl)[:size]
}

func putFloat64Slice(sl *[]float64) {
	float64Pool.Put(sl)
}

// DownSamplingMultiSeriesInto merges field data from source time range => target time range,
// data will be merged into DownSamplingResult
// for example: source range[5,182]=>target range[0,6], ratio:30, source interval:10s, target interval:5min.
func DownSamplingMultiSeriesInto(
	target timeutil.SlotRange, ratio uint16, baseSlot uint16,
	fieldType field.Type, decoders []*encoding.TSDDecoder,
	emitValue func(targetPos int, value float64),
) {
	targetValues := make([]float64, infBlockSize)
	length := int(target.End-target.Start) + 1
	if length <= infBlockSize {
		// on stack
		targetValues = targetValues[:length]
	} else {
		// on heap
		targetValues = getFloat64Slice(length)
		defer putFloat64Slice(&targetValues)
	}
	// first loop: filled target values with inf value,
	// inf value is invalid, and won't be emitted after down sampling
	fillInfBlock(targetValues)
	bs := int(baseSlot)
	// second loop: iterating tsd decoder
	for _, decoder := range decoders {
		if decoder == nil {
			continue
		}
		for movingSourceSlot := decoder.StartTime(); movingSourceSlot <= decoder.EndTime(); movingSourceSlot++ {
			if !decoder.HasValueWithSlot(movingSourceSlot) {
				continue
			}
			value := math.Float64frombits(decoder.Value())
			targetPos := bs + int(movingSourceSlot/ratio) - int(target.Start)
			if targetPos < 0 {
				continue
			}
			// exhausted
			if targetPos >= length {
				break
			}
			// not set before
			if math.IsInf(targetValues[targetPos], 1) {
				targetValues[targetPos] = value
				// set before, aggregate
			} else {
				targetValues[targetPos] = fieldType.AggType().Aggregate(targetValues[targetPos], value)
			}
		}
	}
	// third loop, emit down sampling data
	for offset, value := range targetValues {
		emitValue(offset, value)
	}
}

// DownSampling merges field data from source time range => target time range,
// for example: source range[5,182]=>target range[0,6], ratio:30, source interval:10s, target interval:5min.
func DownSampling(
	source, target timeutil.SlotRange, ratio uint16, baseSlot int, getter encoding.TSDValueGetter,
	emitValue func(targetPos int, value float64),
) {
	start := target.Start
	end := target.End
	intervalRatio := int(ratio)
	for movingSourceSlot := source.Start; movingSourceSlot <= source.End; movingSourceSlot++ {
		value, ok := getter.GetValue(movingSourceSlot)
		if !ok {
			// no data, goto next loop
			continue
		}
		if movingSourceSlot < start {
			// target slot < query start slot, goto next loop
			continue
		}
		if movingSourceSlot > end {
			// exhausted when target slot > query end slot
			break
		}
		targetSlot := (baseSlot + int(movingSourceSlot)) / intervalRatio // (base slot + source slot(down sampling))/ratio => target
		emitValue(targetSlot, value)
	}
}

```

### Core Architecture Module: `aggregation/expression.go`
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

package aggregation

import (
	"strconv"

	"github.com/lindb/common/pkg/logger"

	"github.com/lindb/lindb/aggregation/fields"
	"github.com/lindb/lindb/aggregation/function"
	"github.com/lindb/lindb/pkg/collections"
	"github.com/lindb/lindb/pkg/timeutil"
	"github.com/lindb/lindb/series"
	"github.com/lindb/lindb/series/field"
	"github.com/lindb/lindb/series/metric"
	"github.com/lindb/lindb/sql/stmt"
)

//go:generate mockgen -source=./expression.go -destination=./expression_mock.go -package=aggregation

var log = logger.GetLogger("Aggregation", "Expression")

// Expression represents Expression eval like math calc, function call etc.
// 1. prepare field store based on time series iterator
// 2. eval the Expression
// 3. build result set
type Expression interface {
	// Eval evaluates the select item's expression.
	Eval(timeSeries series.GroupedIterator)
	// ResultSet returns the eval result, returns field name(alias) => series data.
	ResultSet() map[string]*collections.FloatArray
	// Reset resets the Expression context for reusing.
	Reset()
}

// expression implements Expression interface.
type expression struct {
	fieldStore  map[field.Name]fields.Field
	resultSet   map[string]*collections.FloatArray
	selectItems []stmt.Expr
	timeRange   timeutil.TimeRange
	pointCount  int
	interval    int64
}

// NewExpression creates an Expression instance.
func NewExpression(timeRange timeutil.TimeRange, interval int64, selectItems []stmt.Expr) Expression {
	return &expression{
		pointCount:  timeutil.CalPointCount(timeRange.Start, timeRange.End, interval) + 1,
		interval:    interval,
		timeRange:   timeRange,
		selectItems: selectItems,
		fieldStore:  make(map[field.Name]fields.Field),
		resultSet:   make(map[string]*collections.FloatArray),
	}
}

// Eval evaluates the select item's Expression
func (e *expression) Eval(timeSeries series.GroupedIterator) {
	if len(e.selectItems) == 0 {
		return
	}
	// prepare Expression context
	e.prepare(timeSeries)

	if len(e.fieldStore) == 0 {
		return
	}

	for _, selectItem := range e.selectItems {
		values := e.eval(nil, selectItem)
		if len(values) != 0 {
			if item, ok := selectItem.(*stmt.SelectItem); ok && item.Alias != "" {
				e.resultSet[item.Alias] = values[0]
			} else {
				e.resultSet[item.Rewrite()] = values[0]
			}
		}
	}
}

// ResultSet returns the eval result, returns field name(alias) => series data.
func (e *expression) ResultSet() map[string]*collections.FloatArray {
	return e.resultSet
}

// prepare the field store.
func (e *expression) prepare(timeSeries series.GroupedIterator) {
	if timeSeries == nil {
		return
	}
	for timeSeries.HasNext() {
		fieldSeries := timeSeries.Next()
		fieldName := fieldSeries.FieldName()
		fieldType := fieldSeries.FieldType()
		f := fields.NewDynamicField(fieldType, e.timeRange.Start, e.interval, e.pointCount)
		e.fieldStore[fieldName] = f
		f.SetValue(fieldSeries)
	}
}

// eval evaluates the Expression.
func (e *expression) eval(parentFunc *stmt.CallExpr, expr stmt.Expr) []*collections.FloatArray {
	switch ex := expr.(type) {
	case *stmt.SelectItem:
		return e.eval(nil, ex.Expr)
	case *stmt.CallExpr:
		switch ex.FuncType {
		case function.Quantile:
			return e.quantile(ex)
		default:
			return e.funcCall(ex)
		}
	case *stmt.ParenExpr:
		return e.eval(nil, ex.Expr)
	case *stmt.BinaryExpr:
		return e.binaryEval(ex)
	case *stmt.NumberLiteral:
		values := collections.NewFloatArray(e.pointCount)
		for i := 0; i < e.pointCount; i++ {
			values.SetValue(i, ex.Val)
		}
		values.SetSingle(true)
		return []*collections.FloatArray{values}
	case *stmt.FieldExpr:
		fieldName := ex.Name
		if fieldValues, ok := e.fieldStore[field.Name(fieldName)]; ok {
			// tests if it has func with field
			if parentFunc == nil {
				return fieldValues.GetDefaultValues()
			}
			// get field data by function type
			return fieldValues.GetValues(parentFunc.FuncType)
		}
		return nil
	default:
		return nil
	}
}

func (e *expression) quantile(expr *stmt.CallExpr) []*collections.FloatArray {
	histogramFields := make(map[float64][]*collections.FloatArray)
	if len(expr.Params) != 1 {
		return nil
	}
	quantileValue, err := strconv.ParseFloat(expr.Params[0].Rewrite(), 64)
	if err != nil {
		return nil
	}
	for fieldName, df := range e.fieldStore {
		if df.Type() == field.HistogramField {
			var upperBound float64
			upperBound, err = metric.UpperBound(fieldName.String())
			if err != nil {
				continue
			}
			histogramFields[upperBound] = df.GetDefaultValues()
		}
	}
	if len(histogramFields) == 0 {
		return nil
	}
	array, err := function.QuantileCall(quantileValue, histogramFields)
	if err != nil {
		log.Warn("histogram quantile call error", logger.Error(err))
		return nil
	}
	return []*collections.FloatArray{array}
}

// funcCall calls the function
func (e *expression) funcCall(expr *stmt.CallExpr) []*collections.FloatArray {
	var params []*collections.FloatArray
	for _, param := range expr.Params {
		paramValues := e.eval(expr, param)
		if len(paramValues) == 0 {
			return nil
		}
		params = append(params, paramValues...)
	}
	var result *collections.FloatArray
	switch expr.FuncType {
	case function.Avg:
		result = function.AvgCall(params...)
	case function.Rate:
		result = function.RateCall(e.interval, params...)
	default:
		result = function.FuncCall(expr.FuncType, params...)
	}
	if result == nil {
		return nil
	}
	return []*collections.FloatArray{result}
}

// binaryEval evaluates binary operator
func (e *expression) binaryEval(expr *stmt.BinaryExpr) []*collections.FloatArray {
	binaryOP := expr.Operator
	if binaryOP == stmt.ADD || binaryOP == stmt.SUB || binaryOP == stmt.DIV || binaryOP == stmt.MUL {
		left := e.eval(nil, expr.Left)
		if len(left) != 1 {
			return nil
		}
		right := e.eval(nil, expr.Right)
		if len(right) != 1 {
			return nil
		}
		result := binaryEval(binaryOP, left[0], right[0])
		return []*collections.FloatArray{result}
	}

	return nil
}

// Reset resets the Expression context for reusing.
func (e *expression) Reset() {
	for _, f := range e.fieldStore {
		f.Reset()
	}
	e.resultSet = make(map[string]*collections.FloatArray)
}

```

### Core Architecture Module: `aggregation/field_agg.go`
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

package aggregation

import (
	"math"
	"sort"

	"github.com/lindb/lindb/pkg/collections"
	"github.com/lindb/lindb/series"
	"github.com/lindb/lindb/series/field"
)

//go:generate mockgen -source=./field_agg.go -destination=./field_agg_mock.go -package=aggregation

// FieldAggregator represents a field aggregator, aggregator the field series which with same field id.
type FieldAggregator interface {
	// Aggregate aggregates the field series into current aggregator.
	Aggregate(it series.FieldIterator)
	// AggregateBySlot aggregates the field series into current aggregator.
	AggregateBySlot(slot int, value float64)
	// ResultSet returns the result set of field aggregator.
	ResultSet() (startTime int64, it series.FieldIterator)
	// reset aggregator context for reusing.
	reset()
}

// fieldAggregator implements field aggregator interface, aggregator field series based on aggregator spec.
type fieldAggregator struct {
	aggTypes         []field.AggType
	segmentStartTime int64
	start, end       int // slot range based on query interval and time range

	fieldSeriesList []*collections.FloatArray
}

// NewFieldAggregator creates a field aggregator,
// time range 's start and end is index based on segment start time and interval.
// e.g. segment start time = 20190905 10:00:00, start = 10, end = 50, interval = 10 seconds,
// real query time range {20190905 10:01:40 ~ 20190905 10:08:20}
func NewFieldAggregator(aggSpec AggregatorSpec, segmentStartTime int64, start, end int) FieldAggregator {
	var aggTypes []field.AggType
	for f := range aggSpec.Functions() {
		aggTypes = append(aggTypes, aggSpec.GetFieldType().GetFuncFieldParams(f)...)
	}

	aggTypes = uniqueAggTypes(aggTypes)

	agg := &fieldAggregator{
		aggTypes:         aggTypes,
		segmentStartTime: segmentStartTime,
		start:            start,
		end:              end,
		fieldSeriesList:  make([]*collections.FloatArray, len(aggTypes)),
	}
	return agg
}

// ResultSet returns the result set of field aggregator
func (a *fieldAggregator) ResultSet() (startTime int64, it series.FieldIterator) {
	return a.segmentStartTime, newFieldIterator(a.start, a.aggTypes, a.fieldSeriesList)
}

// Aggregate aggregates the field series into current aggregator
func (a *fieldAggregator) Aggregate(it series.FieldIterator) {
	for it.HasNext() {
		pIt := it.Next()
		for pIt.HasNext() {
			slot, value := pIt.Next()
			a.AggregateBySlot(slot, value)
		}
	}
}

// AggregateBySlot aggregates the field series into current aggregator
func (a *fieldAggregator) AggregateBySlot(slot int, value float64) {
	// drop inf value
	if math.IsInf(value, 1) {
		return
	}
	pos := slot - a.start
	for idx, aggType := range a.aggTypes {
		values := a.fieldSeriesList[idx]
		if values == nil {
			values = collections.NewFloatArray(a.end - a.start + 1)
			values.SetValue(pos, value)
			a.fieldSeriesList[idx] = values
		} else {
			// slot too large for last family
			if values.HasValue(pos) {
				values.SetValue(pos, aggType.Aggregate(values.GetValue(pos), value))
			} else {
				values.SetValue(pos, value)
			}
		}
	}
}

// reset aggregator context for reusing.
func (a *fieldAggregator) reset() {
	for idx := range a.fieldSeriesList {
		if a.fieldSeriesList[idx] == nil {
			continue
		}
		a.fieldSeriesList[idx].Reset()
	}
}

// uniqueAggTypes removes duplicate elements from types
func uniqueAggTypes(types []field.AggType) []field.AggType {
	if len(types) <= 1 {
		return types
	}

	sort.Slice(types, func(i, j int) bool {
		return types[i] < types[j]
	})

	var index = 0
	for i := 1; i < len(types); i++ {
		if types[i] != types[index] {
			index++
			types[index] = types[i]
		}
	}

	return types[:index+1]
}

```

### Core Architecture Module: `aggregation/field_iterator.go`
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

package aggregation

import (
	"math"

	"github.com/lindb/lindb/pkg/bit"
	"github.com/lindb/lindb/pkg/collections"
	"github.com/lindb/lindb/pkg/encoding"
	"github.com/lindb/lindb/pkg/stream"
	"github.com/lindb/lindb/series"
	"github.com/lindb/lindb/series/field"
)

// for testing
var (
	toBytesFn = toBytes
)

// fieldIterator implements series.FieldIterator interface.
type fieldIterator struct {
	startSlot int
	aggTypes  []field.AggType

	fieldSeriesList []*collections.FloatArray

	length int
	idx    int
}

// newFieldIterator creates a field iterator.
func newFieldIterator(
	startSlot int,
	aggTypes []field.AggType,
	fieldSeriesList []*collections.FloatArray,
) series.FieldIterator {
	return &fieldIterator{
		startSlot:       startSlot,
		aggTypes:        aggTypes,
		fieldSeriesList: fieldSeriesList,
		length:          len(fieldSeriesList),
	}
}

// HasNext returns if the iteration has more fields.
func (it *fieldIterator) HasNext() bool {
	return it.idx < it.length
}

// Next returns the data point in the iteration.
func (it *fieldIterator) Next() series.PrimitiveIterator {
	if it.idx >= it.length {
		return nil
	}
	primitiveIt := newPrimitiveIterator(it.startSlot, it.aggTypes[it.idx], it.fieldSeriesList[it.idx])
	it.idx++
	return primitiveIt
}

// MarshalBinary marshals the data.
func (it *fieldIterator) MarshalBinary() ([]byte, error) {
	if it.length == 0 {
		return nil, nil
	}
	// need reset idx
	it.idx = 0
	writer := stream.NewBufferWriter(nil)
	var encoder *encoding.TSDEncoder
	defer encoding.ReleaseTSDEncoder(encoder)

	for it.HasNext() {
		primitiveIt := it.Next()
		if encoder == nil {
			encoder = encoding.TSDEncodeFunc(uint16(it.startSlot))
		} else {
			encoder.RestWithStartTime(uint16(it.startSlot))
		}
		idx := it.startSlot // start with start slot
		for primitiveIt.HasNext() {
			slot, value := primitiveIt.Next()
			for slot > idx {
				encoder.AppendTime(bit.Zero)
				idx++
			}
			encoder.AppendTime(bit.One)
			encoder.AppendValue(math.Float64bits(value))
			idx++
		}
		data, err := toBytesFn(encoder)
		if err != nil {
			return nil, err
		}
		writer.PutByte(byte(primitiveIt.AggType()))
		writer.PutVarint32(int32(len(data)))
		writer.PutBytes(data)
	}
	return writer.Bytes()
}

func toBytes(e *encoding.TSDEncoder) ([]byte, error) {
	return e.Bytes()
}

// primitiveIterator represents primitive iterator using array.
type primitiveIterator struct {
	start   int
	aggType field.AggType
	it      *collections.FloatArrayIterator
}

// newPrimitiveIterator create primitive iterator using array.
func newPrimitiveIterator(start int, aggType field.AggType, values *collections.FloatArray) series.PrimitiveIterator {
	it := &primitiveIterator{
		start:   start,
		aggType: aggType,
	}
	if values != nil {
		it.it = values.NewIterator()
	}
	return it
}

// AggType returns the primitive field's agg type.
func (it *primitiveIterator) AggType() field.AggType {
	return it.aggType
}

// HasNext returns if the iteration has more data points.
func (it *primitiveIterator) HasNext() bool {
	if it.it == nil {
		return false
	}
	return it.it.HasNext()
}

// Next returns the data point in the iteration.
func (it *primitiveIterator) Next() (timeSlot int, value float64) {
	if it.it == nil {
		return -1, 0
	}
	timeSlot, value = it.it.Next()
	if timeSlot == -1 {
		return
	}
	timeSlot += it.start
	return
}

```

### Core Architecture Module: `aggregation/fields/field.go`
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

package fields

import (
	"github.com/lindb/lindb/aggregation/function"
	"github.com/lindb/lindb/pkg/collections"
	"github.com/lindb/lindb/series"
	"github.com/lindb/lindb/series/field"
)

//go:generate mockgen -source=./field.go -destination=./field_mock.go -package=fields

// Field represents the field series for the time series.
type Field interface {
	// Type returns field's type
	Type() field.Type
	// SetValue sets field value using series iterator.
	SetValue(fieldSeries series.Iterator)
	// GetValues returns the values which function call need by given function type.
	GetValues(funcType function.FuncType) (result []*collections.FloatArray)
	// GetDefaultValues returns the field default values which aggregation need if user not input function type.
	GetDefaultValues() (result []*collections.FloatArray)
	// Reset resets field's value for reusing.
	Reset()
}

// dynamicField represents the dynamic field for storing multi-agg types.
type dynamicField struct {
	fields map[field.AggType]*collections.FloatArray

	fieldType field.Type
	startTime int64
	interval  int64
	capacity  int
}

// NewDynamicField creates a dynamic field series.
func NewDynamicField(fieldType field.Type, startTime, interval int64, capacity int) Field {
	return &dynamicField{
		fieldType: fieldType,
		startTime: startTime,
		interval:  interval,
		capacity:  capacity,
		fields:    make(map[field.AggType]*collections.FloatArray),
	}
}

// Type returns the type of dynamic field.
func (f *dynamicField) Type() field.Type {
	return f.fieldType
}

// SetValue sets the field's value by time slot
func (f *dynamicField) SetValue(fieldSeries series.Iterator) {
	if fieldSeries == nil {
		return
	}
	var fieldValues *collections.FloatArray
	ok := false
	for fieldSeries.HasNext() {
		startTime, it := fieldSeries.Next()
		if it == nil {
			continue
		}
		for it.HasNext() {
			pIt := it.Next()
			aggType := pIt.AggType()
			fieldValues, ok = f.fields[aggType]
			if !ok {
				fieldValues = collections.NewFloatArray(f.capacity)
				f.fields[aggType] = fieldValues
			}
			for pIt.HasNext() {
				slot, val := pIt.Next()
				idx := ((int64(slot)*f.interval + startTime) - f.startTime) / f.interval
				fieldValues.SetValue(int(idx), val)
			}
		}
	}
}

// GetValues returns the values which function call need by given function type and field type
func (f *dynamicField) GetValues(funcType function.FuncType) (result []*collections.FloatArray) {
	pFields := f.fieldType.GetFuncFieldParams(funcType)
	return f.getFieldValues(pFields)
}

// GetDefaultValues returns the field default values which aggregation need by field type
func (f *dynamicField) GetDefaultValues() []*collections.FloatArray {
	return f.getFieldValues(f.fieldType.GetDefaultFuncFieldParams())
}

func (f *dynamicField) Reset() {
	for _, pField := range f.fields {
		pField.Reset()
	}
}

// getFieldValues returns the values by field name and agg type.
func (f *dynamicField) getFieldValues(aggTypes []field.AggType) (result []*collections.FloatArray) {
	if len(aggTypes) == 0 {
		return
	}
	for _, aggType := range aggTypes {
		if pField, ok := f.fields[aggType]; ok {
			result = append(result, pField)
		}
	}
	return
}

```

### Core Architecture Module: `aggregation/function/avg.go`
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

package function

import "github.com/lindb/lindb/pkg/collections"

func AvgCall(arrays ...*collections.FloatArray) *collections.FloatArray {
	// params: 0=>sum, 1=>count
	if len(arrays) < 2 {
		return nil
	}
	result := collections.NewFloatArray(arrays[0].Capacity())
	itr := arrays[0].NewIterator()
	for itr.HasNext() {
		idx, sum := itr.Next()
		if arrays[1].HasValue(idx) {
			count := arrays[1].GetValue(idx)
			if count != 0 {
				result.SetValue(idx, sum/count)
			}
		}
	}
	return result
}

```

### Core Architecture Module: `aggregation/function/functions.go`
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

package function

import (
	"github.com/lindb/lindb/pkg/collections"
)

// FuncCall calls the function calc by function type and params
func FuncCall(funcType FuncType, params ...*collections.FloatArray) *collections.FloatArray {
	switch funcType {
	case Sum, Min, Max, Count, Last, First:
		if len(params) == 0 {
			return nil
		}
		return params[0]
	default:
		return nil
	}
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

### Incident Patch 2: `1b73b9b7` (2024-07-18)
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

### Incident Patch 3: `c194374a` (2024-07-18)
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

---

### Incident Patch 4: `17726189` (2024-07-17)
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

---

### Incident Patch 5: `d40f316b` (2024-07-17)
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

---

### Incident Patch 6: `cf501e9c` (2024-07-16)
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

---

### Incident Patch 7: `a3b39d95` (2024-07-12)
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

### Incident Patch 8: `277d3f2c` (2024-07-12)
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

### Incident Patch 9: `e86c6f9f` (2024-07-12)
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

---

### Incident Patch 10: `bad92282` (2024-05-07)
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
 	channelMgr := replica.Ne
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
