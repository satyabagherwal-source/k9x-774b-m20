# Forensic Learning Record (Deep Inspection): duckdb/duckdb

> **Canonical Artifact**: `07_PROJECT_LEARNING/duckdb-duckdb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/duckdb/duckdb](https://github.com/duckdb/duckdb))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-07T21:19:52.221Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `duckdb/duckdb`
- **Description**: DuckDB is an analytical in-process SQL database management system
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 41968 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `extension/core_functions/aggregate/algebraic/avg.cpp`
```
#include "core_functions/aggregate/algebraic_functions.hpp"
#include "core_functions/aggregate/sum_helpers.hpp"
#include "duckdb/common/types/hugeint.hpp"
#include "duckdb/common/types/time.hpp"
#include "duckdb/common/exception.hpp"
#include "duckdb/function/function_set.hpp"
#include "duckdb/planner/expression.hpp"

namespace duckdb {

namespace {

template <class T>
struct AvgState {
	static constexpr const char *STATE_NAMES[] = {"count", "value"};
	using STATE_TYPE = StructStateType<uint64_t, T>;

	uint64_t count;
	T value;

	void Combine(const AvgState<T> &other) {
		this->count += other.count;
		CombineSumStateValue(this->value, other.value);
	}
};

struct IntervalAvgState {
	static constexpr const char *STATE_NAMES[] = {"count", "value"};
	using STATE_TYPE = StructStateType<int64_t, interval_t>;

	int64_t count;
	interval_t value;

	void Combine(const IntervalAvgState &other) {
		this->count += other.count;
		this->value = AddOperator::Operation<interval_t, interval_t, interval_t>(this->value, other.value);
	}
};

struct KahanAvgState {
	static constexpr const char *STATE_NAMES[] = {"count", "value", "err"};
	using STATE_TYPE = StructStateType<uint64_t, double, double>;

	uint64_t count;
	double value;
	double err;

	void Combine(const KahanAvgState &other) {
		this->count += other.count;
		KahanAddInternal(other.value, this->value, this->err);
		KahanAddInternal(other.err, this->value, this->err);
	}
};

struct AverageDecimalBindData : public FunctionData {
	explicit AverageDecimalBindData(double scale) : scale(scale) {
	}

	double scale;

public:
	unique_ptr<FunctionData> Copy() const override {
		return make_uniq<AverageDecimalBindData>(scale);
	};

	bool Equals(const FunctionData &other_p) const override {
		auto &other = other_p.Cast<AverageDecimalBindData>();
		return scale == other.scale;
	}
};

struct AverageSetOperation {
	template <class STATE>
	static void Combine(const STATE &source, STATE &target, AggregateInputData &) {
		target.Combine(source);
	}
	template <class STATE>
	static void AddValues(STATE &state, idx_t count) {
		state.count += count;
	}
};

template <class T>
static T GetAverageDivident(uint64_t count, optional_ptr<FunctionData> bind_data) {
	T divident = T(count);
	if (bind_data) {
		auto &avg_bind_data = bind_data->Cast<AverageDecimalBindData>();
		divident *= avg_bind_data.scale;
	}
	return divident;
}

struct IntegerAverageOperation : public BaseSumOperation<AverageSetOperation, RegularAdd> {
	template <class STATE, class OP>
	static void RepeatedCombine(const STATE &source, STATE &target, AggregateInputData &input, idx_t count) {
		RepeatedAverageState::Combine(source, target, input, count);
	}

	template <class T, class STATE>
	static void Finalize(STATE &state, T &target, AggregateFinalizeData &finalize_data) {
		if (state.count == 0) {
			finalize_data.ReturnNull();
		} else {
			double divident = GetAverageDivident<double>(state.count, finalize_data.input.bind_data);
			target = double(state.value) / divident;
		}
	}
};

struct IntegerAverageOperationHugeint : public BaseSumOperation<AverageSetOperation, AddToHugeint> {
	template <class STATE, class OP>
	static void RepeatedCombine(const STATE &source, STATE &target, AggregateInputData &input, idx_t count) {
		RepeatedAverageState::Combine(source, target, input, count);
	}

	template <class T, class STATE>
	static void Finalize(STATE &state, T &target, AggregateFinalizeData &finalize_data) {
		if (state.count == 0) {
			finalize_data.ReturnNull();
		} else {
			long double divident = GetAverageDivident<long double>(state.count, finalize_data.input.bind_data);
			target = Hugeint::Cast<long double>(state.value) / divident;
		}
	}
};

struct DiscreteAverageOperation : public BaseSumOperation<AverageSetOperation, AddToHugeint> {
	template <class STATE, class OP>
	static void RepeatedCombine(const STATE &source, STATE &target, AggregateInputData &input, idx_t count) {
		RepeatedAverageState::Combine(source, target, input, count);
	}

	template <class T, class STATE>
	static void Finalize(STATE &state, T &target, AggregateFinalizeData &finalize_data) {
		if (state.count == 0) {
			finalize_data.ReturnNull();
		} else {
			hugeint_t remainder;
			target = Hugeint::Cast<T>(Hugeint::DivMod(state.value, state.count, remainder));
			// Round the result
			target += (remainder > (state.count / 2));
		}
	}
};

struct HugeintAverageOperation : public BaseSumOperation<AverageSetOperation, HugeintAdd> {
	template <class STATE, class OP>
	static void RepeatedCombine(const STATE &source, STATE &target, AggregateInputData &input, idx_t count) {
		RepeatedAverageState::Combine(source, target, input, count);
	}

	template <class T, class STATE>
	static void Finalize(STATE &state, T &target, AggregateFinalizeData &finalize_data) {
		if (state.count == 0) {
			finalize_data.ReturnNull();
		} else {
			long double divident = GetAverageDivident<long double>(state.count, finalize_data.input.bind_data);
			target = Hugeint::Cast<long double>(state.value) / divident;
		}
	}
};

struct NumericAverageOperation : public BaseSumOperation<AverageSetOperation, RegularAdd> {
	template <class STATE, class OP>
	static void RepeatedCombine(const STATE &source, STATE &target, AggregateInputData &input, idx_t count) {
		RepeatedAverageState::Combine(source, target, input, count);
	}

	template <class T, class STATE>
	static void Finalize(STATE &state, T &target, AggregateFinalizeData &finalize_data) {
		if (state.count == 0) {
			finalize_data.ReturnNull();
		} else {
			target = state.value / state.count;
		}
	}
};

struct KahanAverageOperation : public BaseSumOperation<AverageSetOperation, KahanAdd> {
	template <class T, class STATE>
	static void Finalize(STATE &state, T &target, AggregateFinalizeData &finalize_data) {
		if (state.count == 0) {
			finalize_data.ReturnNull();
		} else {
			target = (state.value / state.count) + (state.err / state.count);
		}
	}
};

struct IntervalAverageOperation : public BaseSumOperation<AverageSetOperation, IntervalAdd> {
	template <class STATE, class OP>
	static void RepeatedCombine(const STATE &source, STATE &target, AggregateInputData &input, idx_t count) {
		RepeatedAverageState::Combine(source, target, input, count);
	}

	template <class RESULT_TYPE, class STATE>
	static void Finalize(STATE &state, RESULT_TYPE &target, AggregateFinalizeData &finalize_data) {
		if (state.count == 0) {
			finalize_data.ReturnNull();
		} else {
			// DivideOperator does not borrow fractions right,
			// TODO: Maybe it should?
			// Copy PG implementation.
			const auto &value = state.value;
			const auto count = UnsafeNumericCast<int64_t>(state.count);

			target.months = value.months / count;
			auto months_remainder = value.months % count;

			target.days = value.days / count;
			auto days_remainder = value.days % count;

			target.micros = value.micros / count;
			auto micros_remainder = value.micros % count;

			//	Shift the remainders right
			months_remainder *= Interval::DAYS_PER_MONTH;
			target.days += months_remainder / count;
			days_remainder += months_remainder % count;

			days_remainder *= Interval::MICROS_PER_DAY;
			micros_remainder += days_remainder / count;
			target.micros += micros_remainder;
		}
	}
};

struct TimeTZAverageOperation : public BaseSumOperation<AverageSetOperation, AddToHugeint> {
	template <class STATE, class OP>
	static void RepeatedCombine(const STATE &source, STATE &target, AggregateInputData &input, idx_t count) {
		RepeatedAverageState::Combine(source, target, input, count);
	}

	template <class INPUT_TYPE, class STATE, class OP>
	static void Operation(STATE &state, const INPUT_TYPE &input, AggregateUnaryInput &aggr_unary) {
		const auto micros = Time::NormalizeTimeTZ(input).value;
		AverageSetOperation::template AddValues<STATE>(state, 1);
		AddToHugeint::template AddNumber<STATE, int64_t>(state, micros);
	}

	template <class INPUT_TYPE, class STATE, class OP>
	static void ConstantOperation(STATE &state, const INPUT_TYPE &input, AggregateUnaryInput &aggr_unary, idx_t count) {
		const auto micros = Time::NormalizeTimeTZ(input).value;
		AverageSetOperation::template AddValues<STATE>(state, count);
		AddToHugeint::template AddConstant<STATE, int64_t>(state, micros, count);
	}

	template <class T, class STATE>
	static void Finalize(STATE &state, T &target, AggregateFinalizeData &finalize_data) {
		if (state.count == 0) {
			finalize_data.ReturnNull();
		} else {
			uint64_t remainder;
			auto micros = Hugeint::Cast<int64_t>(Hugeint::DivModPositive(state.value, state.count, remainder));
			// Round the result
			micros += (remainder > (state.count / 2));
			target = dtime_tz_t(dtime_t(micros), 0);
		}
	}
};

static AggregateFunction NameXParameter(AggregateFunction fun) {
	fun.GetSignature().GetParameter(0).SetName("x");
	return fun;
}

AggregateFunction GetAverageAggregate(PhysicalType type) {
	switch (type) {
	case PhysicalType::INT16: {
		return NameXParameter(
		    AggregateFunction::UnaryAggregate<AvgState<int64_t>, int16_t, double, IntegerAverageOperation>(
		        LogicalType::SMALLINT, LogicalType::DOUBLE));
	}
	case PhysicalType::INT32: {
		return NameXParameter(
		    AggregateFunction::UnaryAggregate<AvgState<hugeint_t>, int32_t, double, IntegerAverageOperationHugeint>(
		        LogicalType::INTEGER, LogicalType::DOUBLE));
	}
	case PhysicalType::INT64: {
		return NameXParameter(
		    AggregateFunction::UnaryAggregate<AvgState<hugeint_t>, int64_t, double, IntegerAverageOperationHugeint>(
		        LogicalType::BIGINT, LogicalType::DOUBLE));
	}
	case PhysicalType::INT128: {
		return NameXParameter(
		    AggregateFunction::UnaryAggregate<AvgState<hugeint_t>, hugeint_t, double, HugeintAverageOperation>(
		        LogicalType::HUGEINT, LogicalType::DOUBLE));
	}
	case PhysicalType::INTERVAL: {
		return NameXParameter(
		    AggregateFunction::UnaryAggregate<IntervalAvgState, interval_t, interval_t, IntervalAverageOperation>(
		        LogicalType::INTERVAL, LogicalType::INTERVAL));
	}
	
```

### Core Architecture Module: `extension/core_functions/aggregate/algebraic/corr.cpp`
```
#include "core_functions/aggregate/algebraic_functions.hpp"
#include "core_functions/aggregate/algebraic/covar.hpp"
#include "core_functions/aggregate/algebraic/stddev.hpp"
#include "core_functions/aggregate/algebraic/corr.hpp"
#include "duckdb/function/function_set.hpp"

namespace duckdb {

AggregateFunction CorrFun::GetFunction() {
	auto fun = AggregateFunction::BinaryAggregate<CorrState, double, double, double, CorrOperation>(
	    LogicalType::DOUBLE, LogicalType::DOUBLE, LogicalType::DOUBLE);
	fun.GetSignature().GetParameter(0).SetName("y");
	fun.GetSignature().GetParameter(1).SetName("x");
	return fun;
}
} // namespace duckdb

```

### Core Architecture Module: `extension/core_functions/aggregate/algebraic/covar.cpp`
```
#include "core_functions/aggregate/algebraic_functions.hpp"
#include "core_functions/aggregate/algebraic/covar.hpp"

namespace duckdb {

AggregateFunction CovarPopFun::GetFunction() {
	auto fun = AggregateFunction::BinaryAggregate<CovarState, double, double, double, CovarPopOperation>(
	    LogicalType::DOUBLE, LogicalType::DOUBLE, LogicalType::DOUBLE);
	fun.GetSignature().GetParameter(0).SetName("y");
	fun.GetSignature().GetParameter(1).SetName("x");
	return fun;
}

AggregateFunction CovarSampFun::GetFunction() {
	auto fun = AggregateFunction::BinaryAggregate<CovarState, double, double, double, CovarSampOperation>(
	    LogicalType::DOUBLE, LogicalType::DOUBLE, LogicalType::DOUBLE);
	fun.GetSignature().GetParameter(0).SetName("y");
	fun.GetSignature().GetParameter(1).SetName("x");
	return fun;
}

} // namespace duckdb

```

### Core Architecture Module: `extension/core_functions/aggregate/algebraic/stddev.cpp`
```
#include "core_functions/aggregate/algebraic_functions.hpp"
#include "duckdb/function/function_set.hpp"
#include "core_functions/aggregate/algebraic/stddev.hpp"

namespace duckdb {

AggregateFunction StdDevSampFun::GetFunction() {
	auto fun = AggregateFunction::UnaryAggregate<StddevState, double, double, STDDevSampOperation>(LogicalType::DOUBLE,
	                                                                                               LogicalType::DOUBLE);
	fun.GetSignature().GetParameter(0).SetName("x");
	return fun;
}

AggregateFunction StdDevPopFun::GetFunction() {
	auto fun = AggregateFunction::UnaryAggregate<StddevState, double, double, STDDevPopOperation>(LogicalType::DOUBLE,
	                                                                                              LogicalType::DOUBLE);
	fun.GetSignature().GetParameter(0).SetName("x");
	return fun;
}

AggregateFunction VarPopFun::GetFunction() {
	auto fun = AggregateFunction::UnaryAggregate<StddevState, double, double, VarPopOperation>(LogicalType::DOUBLE,
	                                                                                           LogicalType::DOUBLE);
	fun.GetSignature().GetParameter(0).SetName("x");
	return fun;
}

AggregateFunction VarSampFun::GetFunction() {
	auto fun = AggregateFunction::UnaryAggregate<StddevState, double, double, VarSampOperation>(LogicalType::DOUBLE,
	                                                                                            LogicalType::DOUBLE);
	fun.GetSignature().GetParameter(0).SetName("x");
	return fun;
}

AggregateFunction StandardErrorOfTheMeanFun::GetFunction() {
	auto fun = AggregateFunction::UnaryAggregate<StddevState, double, double, StandardErrorOfTheMeanOperation>(
	    LogicalType::DOUBLE, LogicalType::DOUBLE);
	fun.GetSignature().GetParameter(0).SetName("x");
	return fun;
}

} // namespace duckdb

```

### Core Architecture Module: `extension/core_functions/aggregate/holistic/approx_top_k.cpp`
```
#include "duckdb/common/vector/flat_vector.hpp"
#include "duckdb/common/vector/vector_iterator.hpp"
#include "duckdb/common/vector/list_vector.hpp"
#include "duckdb/common/vector/struct_vector.hpp"
#include "core_functions/aggregate/histogram_helpers.hpp"
#include "core_functions/aggregate/holistic_functions.hpp"

namespace duckdb {

namespace {

static constexpr int64_t MAX_APPROX_K = 1000000;

struct ApproxTopKString {
	ApproxTopKString() : str(UINT32_C(0)), hash(0) {
	}
	ApproxTopKString(string_t str_p, hash_t hash_p) : str(str_p), hash(hash_p) {
	}

	string_t str;
	hash_t hash;
};

struct ApproxTopKHash {
	std::size_t operator()(const ApproxTopKString &k) const {
		return k.hash;
	}
};

struct ApproxTopKEquality {
	bool operator()(const ApproxTopKString &a, const ApproxTopKString &b) const {
		return Equals::Operation(a.str, b.str);
	}
};

template <typename T>
using approx_topk_map_t = unordered_map<ApproxTopKString, T, ApproxTopKHash, ApproxTopKEquality>;

// approx top k algorithm based on "A parallel space saving algorithm for frequent items and the Hurwitz zeta
// distribution" arxiv link -  https://arxiv.org/pdf/1401.0702
// together with the filter extension (Filtered Space-Saving) from "Estimating Top-k Destinations in Data Streams"
struct ApproxTopKValue {
	//! The counter
	idx_t count = 0;
	//! Index in the values array
	idx_t index = 0;
	//! The string value
	ApproxTopKString str_val;
	//! Allocated data
	char *dataptr = nullptr;
	uint32_t size = 0;
	idx_t capacity = 0;
};

struct InternalApproxTopKState {
	// the top-k data structure has two components
	// a list of k values sorted on "count" (i.e. values[0] has the lowest count)
	// a lookup map: string_t -> idx in "values" array
	unsafe_unique_array<ApproxTopKValue> stored_values;
	unsafe_vector<reference<ApproxTopKValue>> values;
	approx_topk_map_t<reference<ApproxTopKValue>> lookup_map;
	unsafe_vector<idx_t> filter;
	idx_t k = 0;
	idx_t capacity = 0;
	idx_t filter_mask;

	void Initialize(idx_t kval) {
		static constexpr idx_t MONITORED_VALUES_RATIO = 3;
		static constexpr idx_t FILTER_RATIO = 8;

		D_ASSERT(values.empty());
		D_ASSERT(lookup_map.empty());
		k = kval;
		if (k > MAX_APPROX_K) {
			throw InvalidInputException("Requested 'k' (%d) is bigger than accepted max (%d)", kval, MAX_APPROX_K);
		}
		capacity = kval * MONITORED_VALUES_RATIO;
		stored_values = make_unsafe_uniq_array_uninitialized<ApproxTopKValue>(capacity);
		values.reserve(capacity);

		// we scale the filter based on the amount of values we are monitoring
		idx_t filter_size = NextPowerOfTwo(capacity * FILTER_RATIO);
		filter_mask = filter_size - 1;
		filter.resize(filter_size);
	}

	static void CopyValue(ApproxTopKValue &value, const ApproxTopKString &input, ArenaAllocator &allocator) {
		value.str_val.hash = input.hash;
		if (input.str.IsInlined()) {
			// no need to copy
			value.str_val = input;
			return;
		}
		value.size = UnsafeNumericCast<uint32_t>(input.str.GetSize());
		if (value.size > value.capacity) {
			// need to re-allocate for this value
			value.capacity = NextPowerOfTwo(value.size);
			value.dataptr = char_ptr_cast(allocator.Allocate(value.capacity));
		}
		// copy over the data
		memcpy(value.dataptr, input.str.GetData(), value.size);
		value.str_val.str = string_t(value.dataptr, value.size);
	}

	void InsertOrReplaceEntry(const ApproxTopKString &input, AggregateInputData &aggr_input, idx_t increment = 1) {
		if (values.size() < capacity) {
			D_ASSERT(increment > 0);
			// we can always add this entry
			auto &val = stored_values[values.size()];
			val.index = values.size();
			values.push_back(val);
		}
		auto &value = values.back().get();
		if (value.count > 0) {
			// the capacity is reached - we need to replace an entry

			// we use the filter as an early out
			// based on the hash - we find a slot in the filter
			// instead of monitoring the value immediately, we add to the slot in the filter
			// ONLY when the value in the filter exceeds the current min value, we start monitoring the value
			// this speeds up the algorithm as switching monitor values means we need to erase/insert in the hash table
			auto &filter_value = filter[input.hash & filter_mask];
			if (filter_value + increment < value.count) {
				// if the filter has a lower count than the current min count
				// we can skip adding this entry (for now)
				filter_value += increment;
				return;
			}
			// the filter exceeds the min value - start monitoring this value
			// erase the existing entry from the map
			// and set the filter for the minimum value back to the current minimum value
			filter[value.str_val.hash & filter_mask] = value.count;
			lookup_map.erase(value.str_val);
		}
		CopyValue(value, input, aggr_input.allocator);
		lookup_map.insert(make_pair(value.str_val, reference<ApproxTopKValue>(value)));
		IncrementCount(value, increment);
	}

	void IncrementCount(ApproxTopKValue &value, idx_t increment = 1) {
		value.count += increment;
		// maintain sortedness of "values"
		// swap while we have a higher count than the next entry
		while (value.index > 0 && values[value.index].get().count > values[value.index - 1].get().count) {
			// swap the elements around
			auto &left = values[value.index];
			auto &right = values[value.index - 1];
			std::swap(left.get().index, right.get().index);
			std::swap(left, right);
		}
	}

	void Verify() const {
#ifdef DEBUG
		if (values.empty()) {
			D_ASSERT(lookup_map.empty());
			return;
		}
		D_ASSERT(values.size() <= capacity);
		for (idx_t k = 0; k < values.size(); k++) {
			auto &val = values[k].get();
			D_ASSERT(val.count > 0);
			// verify map exists
			auto entry = lookup_map.find(val.str_val);
			D_ASSERT(entry != lookup_map.end());
			// verify the index is correct
			D_ASSERT(val.index == k);
			if (k > 0) {
				// sortedness
				D_ASSERT(val.count <= values[k - 1].get().count);
			}
		}
		D_ASSERT(lookup_map.size() == values.size());
#endif
	}
};

struct ApproxTopKState {
	InternalApproxTopKState *state;

	InternalApproxTopKState &GetState() {
		if (!state) {
			state = new InternalApproxTopKState();
		}
		return *state;
	}

	const InternalApproxTopKState &GetState() const {
		if (!state) {
			throw InternalException("No state available");
		}
		return *state;
	}
};

struct ApproxTopKOperation {
	template <class TYPE, class STATE>
	static void Operation(STATE &aggr_state, const TYPE &input, AggregateInputData &aggr_input,
	                      const Vector &top_k_vector, idx_t offset, idx_t count) {
		auto &state = aggr_state.GetState();
		if (state.values.empty()) {
			static constexpr int64_t MAX_APPROX_K = 1000000;
			// not initialized yet - initialize the K value and set all counters to 0
			auto top_k_format = top_k_vector.Values<int64_t>();
			auto top_k_entry = top_k_format[offset];
			if (!top_k_entry.IsValid()) {
				throw InvalidInputException("Invalid input for approx_top_k: k value cannot be NULL");
			}
			auto kval = top_k_entry.GetValue();
			if (kval <= 0) {
				throw InvalidInputException("Invalid input for approx_top_k: k value must be > 0");
			}
			if (kval >= MAX_APPROX_K) {
				throw InvalidInputException("Invalid input for approx_top_k: k value must be < %d", MAX_APPROX_K);
			}
			state.Initialize(UnsafeNumericCast<idx_t>(kval));
		}
		ApproxTopKString topk_string(input, Hash(input));
		auto entry = state.lookup_map.find(topk_string);
		if (entry != state.lookup_map.end()) {
			// the input is monitored - increment the count
			state.IncrementCount(entry->second.get());
		} else {
			// the input is not monitored - replace the first entry with the current entry and increment
			state.InsertOrReplaceEntry(topk_string, aggr_input);
		}
	}

	template <class STATE, class OP>
	static void Combine(const STATE &aggr_source, STATE &aggr_target, AggregateInputData &aggr_input) {
		if (!aggr_source.state) {
			// source state is empty
			return;
		}
		auto &source = aggr_source.GetState();
		auto &target = aggr_target.GetState();
		if (source.values.empty()) {
			// source is empty
			return;
		}
		source.Verify();
		auto min_source = source.values.back().get().count;
		idx_t min_target;
		if (target.values.empty()) {
			min_target = 0;
			target.Initialize(source.k);
		} else {
			if (source.k != target.k) {
				throw NotImplementedException("Approx Top K - cannot combine approx_top_K with different k values. "
				                              "K values must be the same for all entries within the same group");
			}
			min_target = target.values.back().get().count;
		}
		// for all entries in target
		// check if they are tracked in source
		//     if they do - add the tracked count
		//     if they do not - add the minimum count
		for (idx_t target_idx = 0; target_idx < target.values.size(); target_idx++) {
			auto &val = target.values[target_idx].get();
			auto source_entry = source.lookup_map.find(val.str_val);
			idx_t increment = min_source;
			if (source_entry != source.lookup_map.end()) {
				increment = source_entry->second.get().count;
			}
			if (increment == 0) {
				continue;
			}
			target.IncrementCount(val, increment);
		}
		// now for each entry in source, if it is not tracked by the target, at the target minimum
		for (auto &source_entry : source.values) {
			auto &source_val = source_entry.get();
			auto target_entry = target.lookup_map.find(source_val.str_val);
			if (target_entry != target.lookup_map.end()) {
				// already tracked - no need to add anything
				continue;
			}
			auto new_count = source_val.count + min_target;
			idx_t increment;
			if (target.values.size() >= target.capacity) {
				idx_t current_min = target.values.empty() ? 0 : target.values.back().get().count;
				D_ASSERT(target.values.size() == target.capacity);
				// target already has capacity values
				// check if we should insert this entry
				if (new_count <= current_min) {
					// if we do not we can skip this entry
					continue;
				}
				increment = new_count - current_min;
			} else {
				// targe
```

### Core Architecture Module: `extension/core_functions/aggregate/holistic/approximate_quantile.cpp`
```
#include "duckdb/common/vector/flat_vector.hpp"
#include "duckdb/common/vector/vector_iterator.hpp"
#include "duckdb/common/vector/list_vector.hpp"
#include "duckdb/execution/expression_executor.hpp"
#include "core_functions/aggregate/holistic_functions.hpp"
#include "t_digest.hpp"
#include "duckdb/planner/expression.hpp"
#include "duckdb/common/operator/cast_operators.hpp"
#include "duckdb/common/serializer/serializer.hpp"
#include "duckdb/common/serializer/deserializer.hpp"

#include <stdlib.h>

namespace duckdb {

namespace {

struct ApproxQuantileState {
	duckdb_tdigest::TDigest *h;
	idx_t pos;
};

struct ApproxQuantileCoding {
	template <typename INPUT_TYPE, typename SAVE_TYPE>
	static SAVE_TYPE Encode(const INPUT_TYPE &input) {
		return Cast::template Operation<INPUT_TYPE, SAVE_TYPE>(input);
	}

	template <typename SAVE_TYPE, typename TARGET_TYPE>
	static bool Decode(const SAVE_TYPE &source, TARGET_TYPE &target) {
		// The result is approximate, so clamp instead of overflowing.
		if (TryCast::Operation(source, target, false)) {
			return true;
		} else if (source < 0) {
			target = NumericLimits<TARGET_TYPE>::Minimum();
		} else {
			target = NumericLimits<TARGET_TYPE>::Maximum();
		}
		return false;
	}
};

template <>
double ApproxQuantileCoding::Encode(const dtime_tz_t &input) {
	return Encode<uint64_t, double>(input.sort_key());
}

template <>
bool ApproxQuantileCoding::Decode(const double &source, dtime_tz_t &target) {
	uint64_t sort_key;
	const auto decoded = Decode<double, uint64_t>(source, sort_key);
	if (decoded) {
		//	We can invert the sort key because its offset was not touched.
		auto offset = dtime_tz_t::decode_offset(sort_key);
		auto micros = dtime_tz_t::decode_micros(sort_key);
		micros -= int64_t(dtime_tz_t::encode_offset(offset) * dtime_tz_t::OFFSET_MICROS);
		target = dtime_tz_t(dtime_t(micros), offset);
	} else if (source < 0) {
		target = Value::MinimumValue(LogicalTypeId::TIME_TZ).GetValue<dtime_tz_t>();
	} else {
		target = Value::MaximumValue(LogicalTypeId::TIME_TZ).GetValue<dtime_tz_t>();
	}

	return decoded;
}

struct ApproximateQuantileBindData : public FunctionData {
	ApproximateQuantileBindData() {
	}
	explicit ApproximateQuantileBindData(float quantile_p) : quantiles(1, quantile_p) {
	}

	explicit ApproximateQuantileBindData(vector<float> quantiles_p) : quantiles(std::move(quantiles_p)) {
	}

	unique_ptr<FunctionData> Copy() const override {
		return make_uniq<ApproximateQuantileBindData>(quantiles);
	}

	bool Equals(const FunctionData &other_p) const override {
		auto &other = other_p.Cast<ApproximateQuantileBindData>();
		//		return quantiles == other.quantiles;
		if (quantiles != other.quantiles) {
			return false;
		}
		return true;
	}

	static void Serialize(Serializer &serializer, const optional_ptr<FunctionData> bind_data_p,
	                      const BoundAggregateFunction &function) {
		auto &bind_data = bind_data_p->Cast<ApproximateQuantileBindData>();
		serializer.WriteProperty(100, "quantiles", bind_data.quantiles);
	}

	static unique_ptr<FunctionData> Deserialize(Deserializer &deserializer, BoundAggregateFunction &function) {
		auto result = make_uniq<ApproximateQuantileBindData>();
		deserializer.ReadProperty(100, "quantiles", result->quantiles);
		return std::move(result);
	}

	vector<float> quantiles;
};

struct ApproxQuantileOperation {
	using SAVE_TYPE = duckdb_tdigest::Value;

	template <class INPUT_TYPE, class STATE, class OP>
	static void ConstantOperation(STATE &state, const INPUT_TYPE &input, AggregateUnaryInput &unary_input,
	                              idx_t count) {
		for (idx_t i = 0; i < count; i++) {
			Operation<INPUT_TYPE, STATE, OP>(state, input, unary_input);
		}
	}

	template <class INPUT_TYPE, class STATE, class OP>
	static void Operation(STATE &state, const INPUT_TYPE &input, AggregateUnaryInput &unary_input) {
		auto val = ApproxQuantileCoding::template Encode<INPUT_TYPE, SAVE_TYPE>(input);
		if (!Value::DoubleIsFinite(val)) {
			return;
		}
		if (!state.h) {
			// the digest and its buffers live in the aggregate's arena, so an aborted query does not leak them
			auto &allocator = unary_input.input.allocator;
			state.h = allocator.Make<duckdb_tdigest::TDigest>(allocator, 100);
		}
		state.h->add(val);
		state.pos++;
	}

	template <class STATE, class OP>
	static void Combine(const STATE &source, STATE &target, AggregateInputData &aggr_input_data) {
		if (source.pos == 0) {
			return;
		}
		D_ASSERT(source.h);
		if (!target.h) {
			auto &allocator = aggr_input_data.allocator;
			target.h = allocator.Make<duckdb_tdigest::TDigest>(allocator, 100);
		}
		target.h->merge(source.h);
		target.pos += source.pos;
	}

	static bool IgnoreNull() {
		return true;
	}
};

struct ApproxQuantileScalarOperation : public ApproxQuantileOperation {
	template <class TARGET_TYPE, class STATE>
	static void Finalize(STATE &state, TARGET_TYPE &target, AggregateFinalizeData &finalize_data) {
		if (state.pos == 0) {
			finalize_data.ReturnNull();
			return;
		}
		D_ASSERT(state.h);
		D_ASSERT(finalize_data.input.bind_data);
		state.h->compress();
		auto &bind_data = finalize_data.input.bind_data->template Cast<ApproximateQuantileBindData>();
		D_ASSERT(bind_data.quantiles.size() == 1);
		const auto source = state.h->quantile(bind_data.quantiles[0]);
		ApproxQuantileCoding::Decode(source, target);
	}
};

//===--------------------------------------------------------------------===//
// State Export
//===--------------------------------------------------------------------===//
//! Exported state: STRUCT(count, min, max, centroids) - the value count, exact min/max and the t-digest centroids.
LogicalType ApproxQuantileExportType() {
	child_list_t<LogicalType> centroid_children;
	centroid_children.emplace_back("mean", LogicalType::DOUBLE);
	centroid_children.emplace_back("weight", LogicalType::DOUBLE);

	child_list_t<LogicalType> children;
	children.emplace_back("count", LogicalType::UBIGINT);
	children.emplace_back("min", LogicalType::DOUBLE);
	children.emplace_back("max", LogicalType::DOUBLE);
	children.emplace_back("centroids", LogicalType::LIST(LogicalType::STRUCT(std::move(centroid_children))));
	return LogicalType::STRUCT(std::move(children));
}

//! Rebuilds the quantile parameter (e.g. 0.5 or [0.25, 0.75]) from the bind data so re-binding can supply it.
//! param_type is the declared type of the quantile argument.
Value ApproxQuantileParameterValue(const ApproximateQuantileBindData &bind_data, const LogicalType &param_type) {
	vector<Value> quantiles;
	for (auto &q : bind_data.quantiles) {
		quantiles.push_back(Value::FLOAT(q));
	}
	if (param_type.id() != LogicalTypeId::LIST && param_type.id() != LogicalTypeId::ARRAY) {
		D_ASSERT(quantiles.size() == 1);
		return quantiles[0];
	}
	return Value::LIST(LogicalType::FLOAT, std::move(quantiles));
}

AggregateStateLayout ApproxQuantileGetStateType(AggregateLayoutInput &input) {
	auto &function = input.function;
	AggregateStateLayout layout;
	layout.type = ApproxQuantileExportType();
	layout.total_state_size = AlignValue<idx_t>(sizeof(ApproxQuantileState));
	if (input.bind_data && function.GetArguments().size() == 2) {
		// the quantile parameter must be a constant at bind time (BindApproxQuantile folds it into the bind data) -
		// record its value so that re-binding the exported state can supply it and reconstruct the bind data
		auto &bind_data = input.bind_data->Cast<ApproximateQuantileBindData>();
		layout.constant_parameters.emplace(1, ApproxQuantileParameterValue(bind_data, function.GetArguments()[1]));
	}
	return layout;
}

//! The shape of the exported state: STRUCT(count, min, max, centroids LIST(STRUCT(mean, weight)))
using APPROX_QUANTILE_EXPORT_TYPE =
    VectorStructType<uint64_t, double, double, VectorListType<VectorStructType<double, double>>>;

void ApproxQuantileExportState(Vector &state_vector, AggregateFinalizeInputData &aggr_input_data, Vector &result,
                               idx_t count, idx_t offset) {
	auto states = state_vector.Values<ApproxQuantileState *>();
	auto writer = FlatVector::Writer<APPROX_QUANTILE_EXPORT_TYPE>(result, count, offset);
	for (idx_t i = 0; i < count; i++) {
		auto &state = *states[i].GetValue();
		if (!state.h || state.pos == 0) {
			// no values have been added to this state - export NULL
			writer.WriteNull();
			continue;
		}
		// fold any unprocessed values into the centroids
		state.h->compress();
		writer.WriteValue([&](auto &count_writer, auto &min_writer, auto &max_writer, auto &centroids_writer) {
			count_writer.WriteValue(state.pos);
			min_writer.WriteValue(state.h->min());
			max_writer.WriteValue(state.h->max());
			auto &centroids = state.h->processed();
			idx_t centroid_idx = 0;
			for (auto &centroid_writer : centroids_writer.WriteList(centroids.size())) {
				auto &centroid = centroids[centroid_idx++];
				centroid_writer.WriteValue([&](auto &mean_writer, auto &weight_writer) {
					mean_writer.WriteValue(centroid.mean());
					weight_writer.WriteValue(centroid.weight());
				});
			}
		});
	}
}

void ApproxQuantileImportState(AggregateImportInputData &input) {
	const auto &layout = input.layout;
	const auto &input_vec = input.input_vec;
	const auto count = input_vec.size();
	const auto dest_buffer = input.dest_buffer;
	auto entries = input_vec.Values<APPROX_QUANTILE_EXPORT_TYPE>();
	for (idx_t i = 0; i < count; i++) {
		auto &state = *reinterpret_cast<ApproxQuantileState *>(dest_buffer + i * layout.total_state_size);
		state.h = nullptr;
		state.pos = 0;
		const auto entry = entries[i];
		if (!entry.IsValid()) {
			// NULL input - leave the state empty
			continue;
		}
		const auto count_entry = entry.template GetChildValue<0>();
		const auto min_entry = entry.template GetChildValue<1>();
		const auto max_entry = entry.template GetChildValue<2>();
		const auto centroid_list = entry.template GetChildValue<3>();
		if (!count_entry.IsValid() || !min_entry.IsValid() || !max_entry.IsValid() || !centroid_list.IsValid()) {
			throw InvalidInputExc
```

### Core Architecture Module: `extension/core_functions/aggregate/holistic/lttb.cpp`
```
#include "core_functions/aggregate/holistic_functions.hpp"
#include "duckdb/common/exception.hpp"
#include "duckdb/common/limits.hpp"
#include "duckdb/common/numeric_utils.hpp"
#include "duckdb/common/serializer/deserializer.hpp"
#include "duckdb/common/serializer/serializer.hpp"
#include "duckdb/common/types/hugeint.hpp"
#include "duckdb/common/vector/list_vector.hpp"
#include "duckdb/common/vector/struct_vector.hpp"
#include "duckdb/execution/expression_executor.hpp"
#include "duckdb/function/aggregate/list_aggregate.hpp"

#include <cmath>

namespace duckdb {

namespace {

//! LTTB (Largest Triangle Three Buckets) downsampling. Buffers all (x, y) points as a linked list of STRUCT(x, y),
//! reusing the "list" aggregate callbacks, and selects the representative points at finalize time. Like other
//! order-sensitive aggregates, the points are expected to arrive ordered by x (use "lttb(x, y, n ORDER BY x)").
struct LTTBState : ListAggState {};

//! Holds the constant target point count folded into the bind data.
struct LTTBBindData : FunctionData {
	idx_t n;

	explicit LTTBBindData(const idx_t n) : n(n) {
	}

	unique_ptr<FunctionData> Copy() const override {
		return make_uniq<LTTBBindData>(n);
	}
	bool Equals(const FunctionData &other_p) const override {
		return n == other_p.Cast<LTTBBindData>().n;
	}
};

//! The element type buffered in the state and returned in the list: STRUCT(x, y)
auto LTTBStructType(const LogicalType &x_type, const LogicalType &y_type) -> LogicalType {
	child_list_t<LogicalType> children;
	children.emplace_back("x", x_type);
	children.emplace_back("y", y_type);
	return LogicalType::STRUCT(std::move(children));
}

struct LTTBFunction {
	//! The type of the values buffered in the linked list, used by ListCombineFunction
	static LogicalType GetElementType(AggregateInputData &aggr_input_data) {
		return ListType::GetChildType(aggr_input_data.function.GetReturnType());
	}
};

//! Packs the two (x, y) input columns into a single STRUCT vector.
//! Points with a NULL x or y are marked NULL so the list append can filter them out.
//! Returns true if any NULLs were found, so that the faster non-filtering path can be used otherwise.
auto LTTBPackPoints(Vector inputs[], idx_t count, Vector &packed) -> bool {
	auto &entries = StructVector::GetEntries(packed);
	entries[0].Reference(inputs[0]);
	entries[1].Reference(inputs[1]);
	FlatVector::SetSize(packed, count);

	const auto x_validity = entries[0].Validity();
	const auto y_validity = entries[1].Validity();
	if (!x_validity.CanHaveNull() && !y_validity.CanHaveNull()) {
		return false;
	}

	auto &point_validity = FlatVector::ValidityMutable(packed);
	point_validity.EnsureWritable();

	bool any_null = false;
	for (idx_t i = 0; i < count; i++) {
		if (!x_validity.IsValid(i) || !y_validity.IsValid(i)) {
			point_validity.SetInvalid(i);
			any_null = true;
		}
	}
	return any_null;
}

//! The number of points is folded into the bind data by the bind, but stays part of the expression tree - only the
//! leading x and y arguments are consumed
void LTTBUpdate(Vector inputs[], AggregateInputData &aggr_input_data, idx_t input_count, Vector &states, idx_t count) {
	D_ASSERT(input_count >= 2);
	if (count == 0) {
		return;
	}
	Vector packed(ListType::GetChildType(aggr_input_data.function.GetReturnType()), count);
	if (LTTBPackPoints(inputs, count, packed)) {
		ListUpdateFunction<true>(&packed, aggr_input_data, 1, states, count);
	} else {
		ListUpdateFunction<false>(&packed, aggr_input_data, 1, states, count);
	}
}

//! The clustered variant of LTTBUpdate
void LTTBClusterUpdate(Vector inputs[], AggregateInputData &aggr_input_data, idx_t input_count,
                       const ClusteredAggr &clustered, idx_t count) {
	D_ASSERT(input_count >= 2);
	if (count == 0) {
		return;
	}
	Vector packed(ListType::GetChildType(aggr_input_data.function.GetReturnType()), count);
	if (LTTBPackPoints(inputs, count, packed)) {
		ListClusterUpdate<true>(&packed, aggr_input_data, 1, clustered, count);
	} else {
		ListClusterUpdate<false>(&packed, aggr_input_data, 1, clustered, count);
	}
}

//! Converts axis values to double. Timestamp axes are normalized against an origin taken from the data.
//! Absolute epoch values do not fit the 53-bit double mantissa (nanoseconds around 2020 need ~61 bits).
//! Translating an axis does not change any triangle area.
template <class T>
struct LTTBAxis {
	explicit LTTBAxis(const T *) {
	}
	double operator()(const T value) const {
		return static_cast<double>(value);
	}
};

template <>
struct LTTBAxis<int64_t> {
	explicit LTTBAxis(const int64_t *values) : origin(values[0]) {
	}
	double operator()(const int64_t value) const {
		// infinity timestamps are INT64_MIN/MAX, so the subtraction can overflow int64_t
		return Hugeint::Cast<double>(hugeint_t(value) - hugeint_t(origin));
	}

	int64_t origin;
};

//! Compacts the materialized points down to the non-NULL ones, returning the remaining count.
//! The update path already drops NULL points, but an imported state can still contain them, so we do this to be safe.
template <class XTYPE, class YTYPE>
auto LTTBDropNullPoints(Vector &points, XTYPE *vx, YTYPE *vy, const idx_t v) -> idx_t {
	auto &axes = StructVector::GetEntries(points);
	auto &point_validity = FlatVector::Validity(points);
	auto &x_validity = FlatVector::Validity(axes[0]);
	auto &y_validity = FlatVector::Validity(axes[1]);

	// the validity is reset (and so allocated) for every group, so the bits have to be checked rather than the mask
	if (point_validity.CheckAllValid(v) && x_validity.CheckAllValid(v) && y_validity.CheckAllValid(v)) {
		return v;
	}

	idx_t valid = 0;
	for (idx_t i = 0; i < v; i++) {
		if (!point_validity.RowIsValid(i) || !x_validity.RowIsValid(i) || !y_validity.RowIsValid(i)) {
			continue;
		}
		vx[valid] = vx[i];
		vy[valid] = vy[i];
		valid++;
	}

	// the compacted prefix is fully valid
	FlatVector::ValidityMutable(points).SetAllValid(valid);
	for (auto &axis : axes) {
		FlatVector::ValidityMutable(axis).SetAllValid(valid);
	}
	return valid;
}

//! XTYPE/YTYPE are the physical C++ types of the x and y columns: float/double for a FLOAT/DOUBLE axis, int64_t for
//! any of the TIMESTAMP axes. We perform all computations with doubles, but we need the templates to cast the input
//! correctly.
template <class XTYPE, class YTYPE>
auto LTTBFinalize(Vector &vec, AggregateFinalizeInputData &data, Vector &result, idx_t count, idx_t offset) -> void {
	D_ASSERT(result.GetType().id() == LogicalTypeId::LIST);

	const auto states = vec.Values<LTTBState *>();
	const auto &bdata = data.bind_data->Cast<LTTBBindData>();

	const auto n = bdata.n;
	const auto struct_type = ListType::GetChildType(result.GetType());

	ListSegmentFunctions functions;
	GetSegmentDataFunctions(functions, struct_type);

	const auto list_entries = FlatVector::GetDataMutable<list_entry_t>(result);

	// The reusable selection vector is only needed if any group downsamples (v > n). In that case n is smaller than
	// the largest buffered group, so the allocation is bounded by the points themselves even for an oversized n.
	idx_t max_v = 0;

	// Figure out the largest list size
	for (idx_t state_idx = 0; state_idx < count; state_idx++) {
		max_v = MaxValue(max_v, states[state_idx].GetValue()->linked_list.total_capacity);
	}

	SelectionVector sel;

	// If a list contains more points than the target, we will downsample
	if (max_v > n) {
		// The selected point indices must fit in the selection vector entries
		if (max_v > NumericLimits<sel_t>::Maximum()) {
			throw OutOfRangeException("lttb: cannot downsample a group of more than %llu points",
			                          static_cast<uint64_t>(NumericLimits<sel_t>::Maximum()));
		}

		// Initialize the selection vector
		sel.Initialize(reinterpret_cast<sel_t *>(data.allocator.AllocateAligned(n * sizeof(sel_t))), n);
	}

	// Reusable vector for materializing each groups points, sized up-front to the largest group.
	Vector points(struct_type, MaxValue<idx_t>(max_v, 1));

	// Now do the selection for each list
	for (idx_t state_idx = 0; state_idx < count; state_idx++) {
		const auto rid = offset + state_idx;
		const auto &state = *states[state_idx].GetValue();

		auto v = state.linked_list.total_capacity;

		if (v == 0) {
			// Empty list (or all points filtered out as NULL)
			FlatVector::SetNull(result, rid, true);
			continue;
		}

		// Materialize the buffered (x, y) points (kept in insertion order, i.e. ordered by x).
		// The scan only ever marks entries invalid, so the reused validity has to be cleared for each group.
		FlatVector::ValidityMutable(points).SetAllValid(v);
		for (auto &child : StructVector::GetEntries(points)) {
			FlatVector::ValidityMutable(child).SetAllValid(v);
		}
		functions.BuildListVector(state.linked_list, points, 0);

		auto &axes = StructVector::GetEntries(points);
		const auto vx = FlatVector::GetDataMutable<XTYPE>(axes[0]);
		const auto vy = FlatVector::GetDataMutable<YTYPE>(axes[1]);

		// Imported states may contain NULL points, drop them before reading any of the axis data
		v = LTTBDropNullPoints(points, vx, vy, v);
		if (v == 0) {
			FlatVector::SetNull(result, rid, true);
			continue;
		}

		const auto old_size = ListVector::GetListSize(result);

		if (v <= n) {
			// Too few points to downsample, keep all points
			ListVector::Append(result, points, v);
			list_entries[rid] = list_entry_t(old_size, v);
			continue;
		}

		if (n < 3) {
			// n == 2: Keep only the first and the last point
			sel[0] = 0;
			sel[1] = v - 1;
			ListVector::Append(result, points, sel, 2);
			list_entries[rid] = list_entry_t(old_size, 2);
			continue;
		}

		// Downsample the v points into n buckets: the first point, n - 2 "middle" buckets, and the last point
		// Functors to normalize the axis values, if required.
		const LTTBAxis<XTYPE> to_x(vx);
		const LTTBAxis<YTYPE> to_y(vy);

		// Always keep the first and the last point
		sel[0] = 0;
		sel[n - 1] = v - 1;

		// The "width" of each bucket in 
```

### Core Architecture Module: `extension/core_functions/aggregate/holistic/mad.cpp`
```
#include "core_functions/aggregate/holistic_functions.hpp"
#include "core_functions/aggregate/quantile_state.hpp"
#include "duckdb/common/helper.hpp"
#include "duckdb/common/operator/abs.hpp"
#include "duckdb/common/operator/cast_operators.hpp"
#include "duckdb/common/operator/subtract.hpp"
#include "duckdb/common/smaller_binary.hpp"
#include "duckdb/common/typedefs.hpp"
#include "duckdb/planner/expression.hpp"

namespace duckdb {

namespace {

//===--------------------------------------------------------------------===//
// Median Absolute Deviation
//===--------------------------------------------------------------------===//
template <typename T, typename R, typename MEDIAN_TYPE>
struct MadAccessor {
	using INPUT_TYPE = T;
	using RESULT_TYPE = R;
	const MEDIAN_TYPE &median;
	explicit MadAccessor(const MEDIAN_TYPE &median_p) : median(median_p) {
	}

	inline RESULT_TYPE operator()(const INPUT_TYPE &input) const {
		const RESULT_TYPE delta = input - UnsafeNumericCast<RESULT_TYPE>(median);
		return TryAbsOperator::Operation<RESULT_TYPE, RESULT_TYPE>(delta);
	}
};

// hugeint_t - double => undefined
template <>
struct MadAccessor<hugeint_t, double, double> {
	using INPUT_TYPE = hugeint_t;
	using RESULT_TYPE = double;
	using MEDIAN_TYPE = double;
	const MEDIAN_TYPE &median;
	explicit MadAccessor(const MEDIAN_TYPE &median_p) : median(median_p) {
	}
	inline RESULT_TYPE operator()(const INPUT_TYPE &input) const {
		const auto delta = Hugeint::Cast<double>(input) - median;
		return TryAbsOperator::Operation<double, double>(delta);
	}
};

// date_t - timestamp_t => interval_t
template <>
struct MadAccessor<date_t, interval_t, timestamp_t> {
	using INPUT_TYPE = date_t;
	using RESULT_TYPE = interval_t;
	using MEDIAN_TYPE = timestamp_t;
	const MEDIAN_TYPE &median;
	explicit MadAccessor(const MEDIAN_TYPE &median_p) : median(median_p) {
	}
	inline RESULT_TYPE operator()(const INPUT_TYPE &input) const {
		const auto dt = Cast::Operation<date_t, timestamp_t>(input);
		const auto delta = SubtractOperator::Operation<timestamp_t, MEDIAN_TYPE, int64_t>(dt, median);
		return Interval::FromMicro(TryAbsOperator::Operation<int64_t, int64_t>(delta));
	}
};

// timestamp_t - timestamp_t => int64_t
template <>
struct MadAccessor<timestamp_t, interval_t, timestamp_t> {
	using INPUT_TYPE = timestamp_t;
	using RESULT_TYPE = interval_t;
	using MEDIAN_TYPE = timestamp_t;
	const MEDIAN_TYPE &median;
	explicit MadAccessor(const MEDIAN_TYPE &median_p) : median(median_p) {
	}
	inline RESULT_TYPE operator()(const INPUT_TYPE &input) const {
		const auto delta = SubtractOperator::Operation<timestamp_t, MEDIAN_TYPE, int64_t>(input, median);
		return Interval::FromMicro(TryAbsOperator::Operation<int64_t, int64_t>(delta));
	}
};

// dtime_t - dtime_t => int64_t
template <>
struct MadAccessor<dtime_t, interval_t, dtime_t> {
	using INPUT_TYPE = dtime_t;
	using RESULT_TYPE = interval_t;
	using MEDIAN_TYPE = dtime_t;
	const MEDIAN_TYPE &median;
	explicit MadAccessor(const MEDIAN_TYPE &median_p) : median(median_p) {
	}
	inline RESULT_TYPE operator()(const INPUT_TYPE &input) const {
		const auto delta = input - median;
		return Interval::FromMicro(TryAbsOperator::Operation<int64_t, int64_t>(delta));
	}
};

// Find the element at zero-based rank k in the union of two sorted ranges.
// Instead of combining and sorting the ranges, partition each range so that their two lower partitions together
// contain the first k + 1 elements of the union. The largest element in that combined partition is the element at
// rank k.
template <typename RESULT_TYPE, typename LEFT_OP, typename RIGHT_OP>
static RESULT_TYPE SelectUnionNth(idx_t left_count, idx_t right_count, idx_t k, LEFT_OP &&left, RIGHT_OP &&right) {
	D_ASSERT(k < left_count + right_count);

	// Lower bound: assume the right range contributes as many elements as it can, leftovers are supplied by the left
	// range.
	idx_t lo = k + 1 > right_count ? k + 1 - right_count : 0;
	// Upper bound: the left range cannot contribute more elements than it contains.
	idx_t hi = MinValue(k + 1, left_count);

	// Binary-search the number of elements contributed by the left range.
	while (lo < hi) {
		const idx_t i = lo + (hi - lo) / 2;
		const idx_t j = k + 1 - i;

		D_ASSERT(i < left_count);
		D_ASSERT(j > 0);

		if (LessThan::Operation(left(i), right(j - 1))) {
			// The chosen partition size for the left range is too small. The next unselected value from the left range
			// precedes the last selected value from the right range, so that left value belongs in the combined lower
			// partition.
			lo = i + 1;
		} else {
			hi = i;
		}
	}

	const idx_t i = lo;
	const idx_t j = k + 1 - i;
	if (i == 0) {
		return right(j - 1);
	}
	if (j == 0) {
		return left(i - 1);
	}

	const auto l = left(i - 1);
	const auto r = right(j - 1);
	return LessThan::Operation(r, l) ? l : r;
}

template <typename MEDIAN_TYPE>
struct MedianAbsoluteDeviationOperation : QuantileOperation {
	template <class T, class STATE>
	static void Finalize(STATE &state, T &target, AggregateFinalizeData &finalize_data) {
		if (state.linked_list.total_capacity == 0) {
			finalize_data.ReturnNull();
			return;
		}
		using INPUT_TYPE = typename STATE::InputType;
		D_ASSERT(finalize_data.input.bind_data);
		auto &bind_data = finalize_data.input.bind_data->Cast<QuantileBindData>();
		D_ASSERT(bind_data.quantiles.size() == 1);
		const auto &q = bind_data.quantiles[0];
		auto &flattened = FlattenedQuantileValues<INPUT_TYPE>::Flatten(finalize_data, state.linked_list);
		QuantileInterpolator<false> interp(q, state.linked_list.total_capacity, false);
		const auto med = interp.template Operation<INPUT_TYPE, MEDIAN_TYPE>(flattened.Data(), finalize_data.result);

		MadAccessor<INPUT_TYPE, T, MEDIAN_TYPE> accessor(med);
		target = interp.template Operation<INPUT_TYPE, T>(flattened.Data(), finalize_data.result, accessor);
	}

	template <class STATE, class INPUT_TYPE, class RESULT_TYPE>
	static void Window(AggregateInputData &aggr_input_data, const WindowPartitionInput &partition,
	                   const_data_ptr_t g_state, data_ptr_t l_state, const SubFrames *subframes_per_row, idx_t count,
	                   Vector &result, idx_t row_idx) {
		using MAD = MadAccessor<INPUT_TYPE, RESULT_TYPE, MEDIAN_TYPE>;

		auto &state = *reinterpret_cast<STATE *>(l_state);
		auto gstate = reinterpret_cast<const STATE *>(g_state);

		auto &data = state.GetOrCreateWindowCursor(partition);
		const auto &fmask = partition.filter_mask;

		auto rdata = FlatVector::GetDataMutable<RESULT_TYPE>(result);
		auto &rmask = FlatVector::ValidityMutable(result);

		QuantileIncluded<INPUT_TYPE> included(fmask, data);

		D_ASSERT(aggr_input_data.bind_data);
		auto &bind_data = aggr_input_data.bind_data->Cast<QuantileBindData>();

		D_ASSERT(bind_data.quantiles.size() == 1);
		const auto &quantile = bind_data.quantiles[0];

		auto &window_state = state.GetOrCreateWindowState();
		auto &prevs = window_state.prevs;
		vector<RESULT_TYPE> deviations;
		MEDIAN_TYPE med;

		for (idx_t ridx = 0; ridx < count; ++ridx) {
			const auto &frames = subframes_per_row[ridx];
			const auto n = FrameSize(included, frames);
			if (!n) {
				rmask.Set(ridx, false);
				continue;
			}

			if (gstate && gstate->HasTree()) {
				med = gstate->GetWindowState().template WindowScalar<MEDIAN_TYPE, false>(data, frames, n, result,
				                                                                         quantile);
			} else {
				window_state.UpdateSkip(data, frames, included);
				med = window_state.template WindowScalar<MEDIAN_TYPE, false>(data, frames, n, result, quantile);
			}

			QuantileInterpolator<false> interp(quantile, n, false);
			MAD mad(med);

			if (gstate && gstate->HasTree()) {
				deviations.clear();
				deviations.reserve(n);

				if (included.AllValid()) {
					for (const auto &frame : frames) {
						for (auto i = frame.start; i < frame.end; ++i) {
							deviations.push_back(mad(data[i]));
						}
					}
				} else {
					for (const auto &frame : frames) {
						for (auto i = frame.start; i < frame.end; ++i) {
							if (included(i)) {
								deviations.push_back(mad(data[i]));
							}
						}
					}
				}

				D_ASSERT(deviations.size() == n);
				rdata[ridx] = interp.template Operation<RESULT_TYPE, RESULT_TYPE>(deviations.data(), result);
			} else {
				// The median lies between the two halves of the values stored in the sorted skip list. Absolute
				// deviations decrease as values in the lower half approach the median and increase as values in the
				// upper half move away from the median. Reading the lower half in reverse therefore produces two
				// non-decreasing deviation ranges without materializing or sorting those ranges.
				const auto left_count = (n + 1) / 2;
				const auto right_count = n - left_count;
				auto left = [&](idx_t i) {
					return mad(window_state.SkipNth(left_count - i - 1));
				};
				auto right = [&](idx_t i) {
					return mad(window_state.SkipNth(left_count + i));
				};

				array<RESULT_TYPE, 2> dest;
				dest[0] = SelectUnionNth<RESULT_TYPE>(left_count, right_count, interp.FRN, left, right);
				if (interp.CRN != interp.FRN) {
					dest[1] = SelectUnionNth<RESULT_TYPE>(left_count, right_count, interp.CRN, left, right);
				}

				rdata[ridx] = interp.template Extract<RESULT_TYPE, RESULT_TYPE>(dest.data(), result);
			}

			//	Prev is used by both skip lists and increments
			prevs = frames;
		}
	}
};

unique_ptr<FunctionData> BindMAD(BindAggregateFunctionInput &input) {
	return make_uniq<QuantileBindData>(Value::DECIMAL(int16_t(5), 2, 1));
}

template <typename INPUT_TYPE, typename MEDIAN_TYPE, typename TARGET_TYPE>
AggregateFunction GetTypedMedianAbsoluteDeviationAggregateFunction(const LogicalType &input_type,
                                                                   const LogicalType &target_type) {
	using STATE = QuantileState<INPUT_TYPE>;
	using OP = MedianAbsoluteDeviationOperation<MEDIAN_TYPE>;
	auto fun = QuantileBufferingAggregate<STATE, TARGET_TYP
```

### Core Architecture Module: `extension/core_functions/aggregate/holistic/mode.cpp`
```
#include "core_functions/aggregate/distributive_functions.hpp"
#include "core_functions/aggregate/holistic_functions.hpp"
#include "duckdb/catalog/catalog.hpp"
#include "duckdb/catalog/catalog_entry/aggregate_function_catalog_entry.hpp"
#include "duckdb/common/exception.hpp"
#include "duckdb/common/operator/comparison_operators.hpp"
#include "duckdb/common/owning_string_map.hpp"
#include "duckdb/common/smaller_binary.hpp"
#include "duckdb/common/types/column/column_data_collection.hpp"
#include "duckdb/common/types/sql_value_map.hpp"
#include "duckdb/common/uhugeint.hpp"
#include "duckdb/function/aggregate/sort_key_helpers.hpp"
#include "duckdb/function/create_sort_key.hpp"
#include "duckdb/function/function_binder.hpp"
#include "duckdb/optimizer/aggregate_rewrite.hpp"
#include "duckdb/planner/expression/bound_aggregate_expression.hpp"
#include "duckdb/planner/expression/bound_columnref_expression.hpp"
#include "duckdb/planner/expression/bound_constant_expression.hpp"
#include "duckdb/planner/expression/bound_operator_expression.hpp"

// MODE( <expr1> )
// Returns the most frequent value for the values within expr1.
// NULL values are ignored. If all the values are NULL, or there are 0 rows, then the function returns NULL.

namespace std {} // namespace std

namespace duckdb {

namespace {

static unique_ptr<BoundAggregateExpression> BindAggregate(ClientContext &context, const char *name,
                                                          vector<unique_ptr<Expression>> children,
                                                          unique_ptr<Expression> filter = nullptr) {
	auto &catalog = Catalog::GetSystemCatalog(context);
	auto &entry = catalog.GetEntry<AggregateFunctionCatalogEntry>(
	    context, QualifiedName(catalog.GetName(), Identifier::DefaultSchema(), name));
	vector<LogicalType> child_types;
	for (auto &child : children) {
		child_types.push_back(child->GetReturnType());
	}
	const auto &function = entry.functions.GetFunctionByArguments(context, child_types);
	FunctionBinder function_binder(context);
	return function_binder.BindAggregateFunction(function, std::move(children), std::move(filter));
}

static unique_ptr<Expression> BindScalar(ClientContext &context, const char *name,
                                         vector<unique_ptr<Expression>> children) {
	FunctionBinder function_binder(context);
	return function_binder.BindScalarFunction(Identifier::DefaultSchema(), name, std::move(children));
}

static unique_ptr<Expression> BindScalar(ClientContext &context, const char *name, unique_ptr<Expression> child) {
	vector<unique_ptr<Expression>> children;
	children.push_back(std::move(child));
	return BindScalar(context, name, std::move(children));
}

static unique_ptr<Expression> BindScalar(ClientContext &context, const char *name, unique_ptr<Expression> left,
                                         unique_ptr<Expression> right) {
	vector<unique_ptr<Expression>> children;
	children.push_back(std::move(left));
	children.push_back(std::move(right));
	return BindScalar(context, name, std::move(children));
}

static FrequencyAggregateFinalizeResult FinalizeModeRewrite(FrequencyAggregateFinalizeInput &input) {
	vector<unique_ptr<Expression>> children;
	children.push_back(std::move(input.value));
	const char *aggregate_name;
	if (input.order_key) {
		vector<unique_ptr<Expression>> sort_children;
		sort_children.push_back(std::move(input.frequency));
		sort_children.push_back(make_uniq<BoundConstantExpression>(Value("DESC NULLS LAST")));
		sort_children.push_back(std::move(input.order_key));
		sort_children.push_back(make_uniq<BoundConstantExpression>(Value("ASC NULLS LAST")));
		auto sort_key = BindScalar(input.rewrite_input.context, "create_sort_key", std::move(sort_children));
		children.push_back(std::move(sort_key));
		aggregate_name = "arg_min";
	} else {
		children.push_back(std::move(input.frequency));
		aggregate_name = "arg_max";
	}

	FrequencyAggregateFinalizeResult result;
	auto aggregate =
	    BindAggregate(input.rewrite_input.context, aggregate_name, std::move(children), std::move(input.filter));
	D_ASSERT(aggregate->GetReturnType() == input.rewrite_input.aggregate.GetReturnType());
	result.aggregates.push_back(std::move(aggregate));
	result.result = make_uniq<BoundColumnRefExpression>(input.rewrite_input.aggregate.GetReturnType(),
	                                                    ColumnBinding(input.aggregate_index, ProjectionIndex(0)));
	return result;
}

static unique_ptr<AggregateRewritePlan> RewriteMode(AggregateRewriteInput &input) {
	return FrequencyAggregateRewrite::Create(input, true, true, FinalizeModeRewrite);
}

struct ModeAttr {
	ModeAttr() : count(0), first_row(std::numeric_limits<idx_t>::max()) {
	}
	size_t count;
	idx_t first_row;
};

template <class T>
struct ModeStandard {
	using MAP_TYPE = sql_value_map_t<T, ModeAttr>;

	static MAP_TYPE *CreateEmpty(ArenaAllocator &) {
		return new MAP_TYPE();
	}
	static MAP_TYPE *CreateEmpty(Allocator &) {
		return new MAP_TYPE();
	}

	template <class INPUT_TYPE, class RESULT_TYPE>
	static RESULT_TYPE Assign(Vector &result, INPUT_TYPE input) {
		return RESULT_TYPE(input);
	}

	static bool IsEqual(const T &left, const T &right) {
		return Equals::Operation(left, right);
	}

	static T *Update(T *mode, idx_t &, const T &key, AggregateInputData &) {
		if (!mode) {
			mode = new T(key);
		}
		*mode = key;

		return mode;
	}
};

struct ModeString {
	using MAP_TYPE = OwningStringMap<ModeAttr>;

	static MAP_TYPE *CreateEmpty(ArenaAllocator &allocator) {
		return new MAP_TYPE(allocator);
	}
	static MAP_TYPE *CreateEmpty(Allocator &allocator) {
		return new MAP_TYPE(allocator);
	}

	template <class INPUT_TYPE, class RESULT_TYPE>
	static RESULT_TYPE Assign(Vector &result, INPUT_TYPE input) {
		return StringVector::AddStringOrBlob(result, input);
	}

	static bool IsEqual(const string_t &left, const string_t &right) {
		return Equals::Operation(left, right);
	}

	static string_t *Update(string_t *mode, idx_t &alloc_size, const string_t &key,
	                        AggregateInputData &aggr_input_data) {
		if (key.IsInlined()) {
			if (!mode) {
				mode = new string_t(nullptr, 0);
			}
			*mode = key;
			alloc_size = 0;
			return mode;
		}

		// non-inlined string, need to allocate space for it somehow
		const auto len = key.GetSize();
		char *ptr;
		if (mode && alloc_size >= len) {
			// this fits into the current arena allocation - reuse it
			ptr = mode->GetDataWriteable();
		} else {
			// round up so repeatedly growing keys don't churn through a new arena allocation every time
			alloc_size = NextPowerOfTwo(len);
			ptr = char_ptr_cast(aggr_input_data.allocator.Allocate(alloc_size));
			if (!mode) {
				mode = new string_t(nullptr, 0);
			}
		}
		memcpy(ptr, key.GetData(), len);
		*mode = string_t(ptr, len);
		return mode;
	}
};

template <class KEY_TYPE, class TYPE_OP>
struct ModeState {
	using Counts = typename TYPE_OP::MAP_TYPE;

	ModeState() {
	}

	SubFrames prevs;
	Counts *frequency_map = nullptr;
	KEY_TYPE *mode = nullptr;
	//! Must be wide enough for NextPowerOfTwo(MAX_STRING_SIZE), which does not fit in a uint32_t
	idx_t mode_alloc_size = 0;
	size_t nonzero = 0;
	bool valid = false;
	size_t count = 0;

	//! The collection being read
	const ColumnDataCollection *inputs;
	//! The state used for reading the collection on this thread
	ColumnDataScanState *scan = nullptr;
	//! The data chunk paged into into
	DataChunk page;
	//! The data pointer
	const KEY_TYPE *data = nullptr;
	//! The validity mask
	const ValidityMask *validity = nullptr;

	~ModeState() {
		if (frequency_map) {
			delete frequency_map;
		}
		delete mode;
		if (scan) {
			delete scan;
		}
	}

	void InitializePage(const WindowPartitionInput &partition) {
		if (!scan) {
			scan = new ColumnDataScanState();
		}
		if (page.ColumnCount() == 0) {
			D_ASSERT(partition.inputs);
			inputs = partition.inputs;
			D_ASSERT(partition.column_ids.size() == 1);
			inputs->InitializeScan(*scan, partition.column_ids);
			inputs->InitializeScanChunk(*scan, page);
		}
	}

	inline sel_t RowOffset(idx_t row_idx) const {
		D_ASSERT(RowIsVisible(row_idx));
		return UnsafeNumericCast<sel_t>(row_idx - scan->current_row_index);
	}

	inline bool RowIsVisible(idx_t row_idx) const {
		return (row_idx < scan->next_row_index && scan->current_row_index <= row_idx);
	}

	inline idx_t Seek(idx_t row_idx) {
		if (!RowIsVisible(row_idx)) {
			D_ASSERT(inputs);
			inputs->Seek(row_idx, *scan, page);
			data = FlatVector::GetData<KEY_TYPE>(page.data[0]);
			validity = &FlatVector::ValidityMutable(page.data[0]);
		}
		return RowOffset(row_idx);
	}

	inline const KEY_TYPE &GetCell(idx_t row_idx) {
		const auto offset = Seek(row_idx);
		return data[offset];
	}

	inline bool RowIsValid(idx_t row_idx) {
		const auto offset = Seek(row_idx);
		return validity->RowIsValid(offset);
	}

	void Reset() {
		if (frequency_map) {
			frequency_map->clear();
		}
		nonzero = 0;
		count = 0;
		valid = false;
	}

	void ModeAdd(idx_t row, AggregateInputData &aggr_input_data) {
		const auto &key = GetCell(row);
		auto &attr = (*frequency_map)[key];
		auto new_count = (attr.count += 1);
		nonzero += size_t(new_count == 1);
		if (new_count > count) {
			valid = true;
			count = new_count;
			Update(key, aggr_input_data);
		} else if (new_count == count) {
			// The key now ties the mode, so the tie must be broken by frame position
			valid = false;
		}
	}

	void ModeRm(idx_t frame) {
		const auto &key = GetCell(frame);
		auto &attr = (*frequency_map)[key];
		auto old_count = attr.count;
		nonzero -= size_t(old_count == 1);

		attr.count -= 1;
		if (count == old_count && TYPE_OP::IsEqual(key, *mode)) {
			valid = false;
		}
	}

	void Update(const KEY_TYPE &key, AggregateInputData &aggr_input_data) {
		mode = TYPE_OP::Update(mode, mode_alloc_size, key, aggr_input_data);
	}

	//! Rescan the frequency map, breaking ties by the first tied value in the frames.
	//! The per-value first_row is not tracked by ModeRm, so it c
```

### Core Architecture Module: `extension/core_functions/aggregate/holistic/quantile.cpp`
```
#include "core_functions/aggregate/holistic_functions.hpp"
#include "core_functions/aggregate/quantile_state.hpp"
#include "duckdb/common/enums/quantile_enum.hpp"
#include "duckdb/common/operator/abs.hpp"
#include "duckdb/common/operator/cast_operators.hpp"
#include "duckdb/common/serializer/deserializer.hpp"
#include "duckdb/common/serializer/serializer.hpp"
#include "duckdb/common/smaller_binary.hpp"
#include "duckdb/common/types/timestamp.hpp"
#include "duckdb/common/vector/flat_vector.hpp"
#include "duckdb/common/vector/list_vector.hpp"
#include "duckdb/common/vector/string_vector.hpp"
#include "duckdb/execution/expression_executor.hpp"
#include "duckdb/function/aggregate/list_aggregate.hpp"
#include "duckdb/function/create_sort_key.hpp"
#include "duckdb/planner/expression.hpp"

#include <cmath>

namespace duckdb {

// Descending order is encoded as a negative quantile parameter. A zero fraction
// is stored as negative zero, so use the sign bit to detect that case as well.
static bool QuantileDescending(const Value &q) {
	return std::signbit(q.GetValue<double>());
}

template <class INPUT_TYPE>
struct IndirectLess {
	inline explicit IndirectLess(const INPUT_TYPE *inputs_p) : inputs(inputs_p) {
	}

	inline bool operator()(const idx_t &lhi, const idx_t &rhi) const {
		return inputs[lhi] < inputs[rhi];
	}

	const INPUT_TYPE *inputs;
};

template <typename T>
static inline T QuantileAbs(const T &t) {
	return AbsOperator::Operation<T, T>(t);
}

template <>
inline Value QuantileAbs(const Value &v) {
	const auto &type = v.type();
	switch (type.id()) {
	case LogicalTypeId::DECIMAL: {
		const auto integral = IntegralValue::Get(v);
		const auto width = DecimalType::GetWidth(type);
		const auto scale = DecimalType::GetScale(type);
		switch (type.InternalType()) {
		case PhysicalType::INT16:
			return Value::DECIMAL(QuantileAbs<int16_t>(Cast::Operation<hugeint_t, int16_t>(integral)), width, scale);
		case PhysicalType::INT32:
			return Value::DECIMAL(QuantileAbs<int32_t>(Cast::Operation<hugeint_t, int32_t>(integral)), width, scale);
		case PhysicalType::INT64:
			return Value::DECIMAL(QuantileAbs<int64_t>(Cast::Operation<hugeint_t, int64_t>(integral)), width, scale);
		case PhysicalType::INT128:
			return Value::DECIMAL(QuantileAbs<hugeint_t>(integral), width, scale);
		default:
			throw InternalException("Unknown DECIMAL type");
		}
	}
	default:
		return Value::DOUBLE(QuantileAbs<double>(v.GetValue<double>()));
	}
}

//===--------------------------------------------------------------------===//
// Quantile Bind Data
//===--------------------------------------------------------------------===//
QuantileBindData::QuantileBindData() {
}

QuantileBindData::QuantileBindData(const Value &quantile_p)
    : quantiles(1, QuantileValue(QuantileAbs(quantile_p))), order(1, 0), desc(QuantileDescending(quantile_p)) {
}

QuantileBindData::QuantileBindData(const vector<Value> &quantiles_p) {
	vector<Value> normalised;
	size_t pos = 0;
	size_t neg = 0;
	for (idx_t i = 0; i < quantiles_p.size(); ++i) {
		const auto &q = quantiles_p[i];
		pos += (q > 0);
		neg += QuantileDescending(q);
		normalised.push_back(QuantileAbs(q));
		order.push_back(i);
	}
	if (pos && neg) {
		throw BinderException("QUANTILE parameters must have consistent signs");
	}
	desc = (neg > 0);

	IndirectLess<Value> lt(normalised.data());
	std::sort(order.begin(), order.end(), lt);

	for (const auto &q : normalised) {
		quantiles.emplace_back(q);
	}
}

QuantileBindData::QuantileBindData(const QuantileBindData &other)
    : FunctionData(other), order(other.order), desc(other.desc) {
	for (const auto &q : other.quantiles) {
		quantiles.emplace_back(q);
	}
}

unique_ptr<FunctionData> QuantileBindData::Copy() const {
	return make_uniq<QuantileBindData>(*this);
}

bool QuantileBindData::Equals(const FunctionData &other_p) const {
	auto &other = other_p.Cast<QuantileBindData>();
	return desc == other.desc && quantiles == other.quantiles && order == other.order;
}

void QuantileBindData::Serialize(Serializer &serializer, const optional_ptr<FunctionData> bind_data_p,
                                 const BoundAggregateFunction &function) {
	auto &bind_data = bind_data_p->Cast<QuantileBindData>();
	vector<Value> raw;
	for (const auto &q : bind_data.quantiles) {
		raw.emplace_back(q.val);
	}
	serializer.WriteProperty(100, "quantiles", raw);
	serializer.WriteProperty(101, "order", bind_data.order);
	serializer.WriteProperty(102, "desc", bind_data.desc);
}

unique_ptr<FunctionData> QuantileBindData::Deserialize(Deserializer &deserializer, BoundAggregateFunction &function) {
	auto result = make_uniq<QuantileBindData>();
	vector<Value> raw;
	deserializer.ReadProperty(100, "quantiles", raw);
	deserializer.ReadProperty(101, "order", result->order);
	deserializer.ReadProperty(102, "desc", result->desc);
	QuantileSerializationType deserialization_type;
	deserializer.ReadPropertyWithExplicitDefault(103, "quantile_type", deserialization_type,
	                                             QuantileSerializationType::NON_DECIMAL);

	if (deserialization_type != QuantileSerializationType::NON_DECIMAL) {
		deserializer.ReadDeletedProperty<LogicalType>(104, "logical_type");
	}

	for (const auto &r : raw) {
		result->quantiles.emplace_back(r);
	}
	return std::move(result);
}

//===--------------------------------------------------------------------===//
// Quantile Casts
//===--------------------------------------------------------------------===//
template <>
interval_t QuantileCast::Operation(const dtime_t &src, Vector &result) {
	return {0, 0, src.value};
}

template <>
string_t QuantileCast::Operation(const string_t &src, Vector &result) {
	return StringVector::AddStringOrBlob(result, src);
}

//===--------------------------------------------------------------------===//
// Scalar Quantile
//===--------------------------------------------------------------------===//
template <bool DISCRETE>
struct QuantileScalarOperation : public QuantileOperation {
	template <class T, class STATE>
	static void Finalize(STATE &state, T &target, AggregateFinalizeData &finalize_data) {
		if (state.linked_list.total_capacity == 0) {
			finalize_data.ReturnNull();
			return;
		}
		D_ASSERT(finalize_data.input.bind_data);
		auto &bind_data = finalize_data.input.bind_data->Cast<QuantileBindData>();
		D_ASSERT(bind_data.quantiles.size() == 1);
		auto &flattened = FlattenedQuantileValues<typename STATE::InputType>::Flatten(finalize_data, state.linked_list);
		QuantileInterpolator<DISCRETE> interp(bind_data.quantiles[0], state.linked_list.total_capacity, bind_data.desc);
		target = interp.template Operation<typename STATE::InputType, T>(flattened.Data(), finalize_data.result);
	}

	template <class STATE, class INPUT_TYPE, class RESULT_TYPE>
	static void Window(AggregateInputData &aggr_input_data, const WindowPartitionInput &partition,
	                   const_data_ptr_t g_state, data_ptr_t l_state, const SubFrames *subframes_per_row, idx_t count,
	                   Vector &result, idx_t row_idx) {
		auto &state = *reinterpret_cast<STATE *>(l_state);
		auto gstate = reinterpret_cast<const STATE *>(g_state);

		auto &data = state.GetOrCreateWindowCursor(partition);
		const auto &fmask = partition.filter_mask;

		QuantileIncluded<INPUT_TYPE> included(fmask, data);

		D_ASSERT(aggr_input_data.bind_data);
		auto &bind_data = aggr_input_data.bind_data->Cast<QuantileBindData>();

		auto rdata = FlatVector::GetDataMutable<RESULT_TYPE>(result);
		auto &rmask = FlatVector::ValidityMutable(result);

		const auto &quantile = bind_data.quantiles[0];
		if (gstate && gstate->HasTree()) {
			for (idx_t ridx = 0; ridx < count; ++ridx) {
				const auto &frames = subframes_per_row[ridx];
				const auto n = FrameSize(included, frames);
				if (!n) {
					rmask.Set(ridx, false);
					continue;
				}

				rdata[ridx] = gstate->GetWindowState().template WindowScalar<RESULT_TYPE, DISCRETE>(data, frames, n,
				                                                                                    result, quantile);
			}
		} else {
			auto &window_state = state.GetOrCreateWindowState();

			for (idx_t ridx = 0; ridx < count; ++ridx) {
				const auto &frames = subframes_per_row[ridx];
				const auto n = FrameSize(included, frames);
				if (!n) {
					rmask.Set(ridx, false);
					continue;
				}

				//	Update the skip list
				window_state.UpdateSkip(data, frames, included);

				// Find the position(s) needed
				rdata[ridx] =
				    window_state.template WindowScalar<RESULT_TYPE, DISCRETE>(data, frames, n, result, quantile);

				//	Save the previous state for next time
				window_state.prevs = frames;
			}
		}
	}
};

//! Buffers the sort key of each input row in the state's linked list - NULL inputs are skipped
//! The quantile parameter is folded into the bind data by the bind, but stays part of the expression tree - only the
//! leading input argument is consumed
static void QuantileSortKeyUpdate(Vector inputs[], AggregateInputData &aggr_input_data, idx_t input_count,
                                  Vector &states, idx_t count) {
	D_ASSERT(input_count >= 1);
	Vector sort_keys(LogicalType::BLOB);
	const OrderModifiers modifiers(OrderType::ASCENDING, OrderByNullType::NULLS_LAST);
	CreateSortKeyHelpers::CreateSortKeyWithValidity(inputs[0], sort_keys, modifiers, count);
	ListUpdateFunction<true>(&sort_keys, aggr_input_data, 1, states, count);
}

struct QuantileScalarFallback : QuantileOperation {
	//! The fallback buffers sort keys instead of the input values
	static LogicalType GetElementType(AggregateInputData &) {
		return LogicalType::BLOB;
	}

	template <class STATE>
	static void Finalize(STATE &state, AggregateFinalizeData &finalize_data) {
		if (state.linked_list.total_capacity == 0) {
			finalize_data.ReturnNull();
			return;
		}
		D_ASSERT(finalize_data.input.bind_data);
		auto &bind_data = finalize_data.input.bind_data->Cast<QuantileBindData>();
		D_ASSERT(bind_data.quantiles.size() == 1);
		auto &flattened = FlattenedQuantil
```

### Core Architecture Module: `extension/core_functions/aggregate/holistic/reservoir_quantile.cpp`
```
#include "duckdb/common/types.hpp"
#include "duckdb/common/vector/flat_vector.hpp"
#include "duckdb/common/vector/list_vector.hpp"
#include "duckdb/execution/expression_executor.hpp"
#include "duckdb/execution/reservoir_sample.hpp"
#include "core_functions/aggregate/holistic_functions.hpp"
#include "duckdb/planner/expression.hpp"
#include "duckdb/common/queue.hpp"
#include "duckdb/common/serializer/serializer.hpp"
#include "duckdb/common/serializer/deserializer.hpp"

#include <algorithm>
#include <cstdint>
#include <stdlib.h>

namespace duckdb {

namespace {

//! The quantile defaults to the median
constexpr double DEFAULT_QUANTILE = 0.5;
constexpr int32_t DEFAULT_SAMPLE_SIZE = 8192;

template <typename T>
struct ReservoirQuantileState {
	T *v;
	idx_t len;
	idx_t pos;
	BaseReservoirSampling *r_samp;

	void Resize(idx_t new_len) {
		if (new_len <= len) {
			return;
		}
		T *old_v = v;
		v = (T *)realloc(v, new_len * sizeof(T));
		if (!v) {
			free(old_v);
			throw InternalException("Memory allocation failure");
		}
		len = new_len;
	}

	void ReplaceElement(T &input) {
		v[r_samp->min_weighted_entry_index] = input;
		r_samp->ReplaceElement();
	}

	void FillReservoir(idx_t sample_size, T element) {
		if (pos < sample_size) {
			v[pos++] = element;
			r_samp->InitializeReservoirWeights(pos, len);
		} else {
			D_ASSERT(r_samp->next_index_to_sample >= r_samp->num_entries_to_skip_b4_next_sample);
			if (r_samp->next_index_to_sample == r_samp->num_entries_to_skip_b4_next_sample) {
				ReplaceElement(element);
			}
		}
	}
};

struct ReservoirQuantileBindData : public FunctionData {
	ReservoirQuantileBindData() : decimal_type(LogicalType::INVALID) {
	}
	ReservoirQuantileBindData(double quantile_p, idx_t sample_size_p)
	    : quantiles(1, quantile_p), sample_size(sample_size_p), decimal_type(LogicalType::INVALID) {
	}

	ReservoirQuantileBindData(vector<double> quantiles_p, idx_t sample_size_p)
	    : quantiles(std::move(quantiles_p)), sample_size(sample_size_p), decimal_type(LogicalType::INVALID) {
	}

	unique_ptr<FunctionData> Copy() const override {
		auto result = make_uniq<ReservoirQuantileBindData>(quantiles, sample_size);
		result->decimal_type = decimal_type;
		return std::move(result);
	}

	bool Equals(const FunctionData &other_p) const override {
		auto &other = other_p.Cast<ReservoirQuantileBindData>();
		return quantiles == other.quantiles && sample_size == other.sample_size && decimal_type == other.decimal_type;
	}

	static void Serialize(Serializer &serializer, const optional_ptr<FunctionData> bind_data_p,
	                      const BoundAggregateFunction &function) {
		auto &bind_data = bind_data_p->Cast<ReservoirQuantileBindData>();
		serializer.WriteProperty(100, "quantiles", bind_data.quantiles);
		serializer.WriteProperty(101, "sample_size", bind_data.sample_size);
		serializer.WriteProperty(102, "decimal_type", bind_data.decimal_type);
	}

	static unique_ptr<FunctionData> Deserialize(Deserializer &deserializer, BoundAggregateFunction &function) {
		auto result = make_uniq<ReservoirQuantileBindData>();
		deserializer.ReadProperty(100, "quantiles", result->quantiles);
		deserializer.ReadProperty(101, "sample_size", result->sample_size);
		result->decimal_type =
		    deserializer.ReadPropertyWithExplicitDefault<LogicalType>(102, "decimal_type", LogicalType::INVALID);
		return std::move(result);
	}

	vector<double> quantiles;
	idx_t sample_size;
	LogicalType decimal_type;
};

struct ReservoirQuantileOperation {
	template <class INPUT_TYPE, class STATE, class OP>
	static void ConstantOperation(STATE &state, const INPUT_TYPE &input, AggregateUnaryInput &unary_input,
	                              idx_t count) {
		for (idx_t i = 0; i < count; i++) {
			Operation<INPUT_TYPE, STATE, OP>(state, input, unary_input);
		}
	}

	template <class INPUT_TYPE, class STATE, class OP>
	static void Operation(STATE &state, const INPUT_TYPE &input, AggregateUnaryInput &unary_input) {
		auto &bind_data = unary_input.input.bind_data->template Cast<ReservoirQuantileBindData>();
		if (state.pos == 0) {
			state.Resize(bind_data.sample_size);
		}
		if (!state.r_samp) {
			state.r_samp = new BaseReservoirSampling();
		}
		D_ASSERT(state.v);
		state.FillReservoir(bind_data.sample_size, input);
	}

	template <class STATE, class OP>
	static void Combine(const STATE &source, STATE &target, AggregateInputData &) {
		if (source.pos == 0) {
			return;
		}
		if (target.pos == 0) {
			target.Resize(source.len);
		}
		if (!target.r_samp) {
			target.r_samp = new BaseReservoirSampling();
		}
		for (idx_t src_idx = 0; src_idx < source.pos; src_idx++) {
			target.FillReservoir(target.len, source.v[src_idx]);
		}
	}

	template <class STATE>
	static void Destroy(STATE &state, AggregateInputData &aggr_input_data) {
		if (state.v) {
			free(state.v);
			state.v = nullptr;
		}
		if (state.r_samp) {
			delete state.r_samp;
			state.r_samp = nullptr;
		}
	}

	static bool IgnoreNull() {
		return true;
	}
};

struct ReservoirQuantileScalarOperation : public ReservoirQuantileOperation {
	template <class T, class STATE>
	static void Finalize(STATE &state, T &target, AggregateFinalizeData &finalize_data) {
		if (state.pos == 0) {
			finalize_data.ReturnNull();
			return;
		}
		D_ASSERT(state.v);
		D_ASSERT(finalize_data.input.bind_data);
		auto &bind_data = finalize_data.input.bind_data->template Cast<ReservoirQuantileBindData>();
		auto v_t = state.v;
		D_ASSERT(bind_data.quantiles.size() == 1);
		auto offset = (idx_t)((double)(state.pos - 1) * bind_data.quantiles[0]);
		std::nth_element(v_t, v_t + offset, v_t + state.pos);
		target = v_t[offset];
	}
};

AggregateFunction GetReservoirQuantileAggregateFunction(PhysicalType type) {
	switch (type) {
	case PhysicalType::INT8:
		return AggregateFunction::UnaryAggregate<ReservoirQuantileState<int8_t>, int8_t, int8_t,
		                                         ReservoirQuantileScalarOperation>(LogicalType::TINYINT,
		                                                                           LogicalType::TINYINT);

	case PhysicalType::INT16:
		return AggregateFunction::UnaryAggregate<ReservoirQuantileState<int16_t>, int16_t, int16_t,
		                                         ReservoirQuantileScalarOperation>(LogicalType::SMALLINT,
		                                                                           LogicalType::SMALLINT);

	case PhysicalType::INT32:
		return AggregateFunction::UnaryAggregate<ReservoirQuantileState<int32_t>, int32_t, int32_t,
		                                         ReservoirQuantileScalarOperation>(LogicalType::INTEGER,
		                                                                           LogicalType::INTEGER);

	case PhysicalType::INT64:
		return AggregateFunction::UnaryAggregate<ReservoirQuantileState<int64_t>, int64_t, int64_t,
		                                         ReservoirQuantileScalarOperation>(LogicalType::BIGINT,
		                                                                           LogicalType::BIGINT);

	case PhysicalType::INT128:
		return AggregateFunction::UnaryAggregate<ReservoirQuantileState<hugeint_t>, hugeint_t, hugeint_t,
		                                         ReservoirQuantileScalarOperation>(LogicalType::HUGEINT,
		                                                                           LogicalType::HUGEINT);
	case PhysicalType::FLOAT:
		return AggregateFunction::UnaryAggregate<ReservoirQuantileState<float>, float, float,
		                                         ReservoirQuantileScalarOperation>(LogicalType::FLOAT,
		                                                                           LogicalType::FLOAT);
	case PhysicalType::DOUBLE:
		return AggregateFunction::UnaryAggregate<ReservoirQuantileState<double>, double, double,
		                                         ReservoirQuantileScalarOperation>(LogicalType::DOUBLE,
		                                                                           LogicalType::DOUBLE);
	default:
		throw InternalException("Unimplemented reservoir quantile aggregate");
	}
}

template <class CHILD_TYPE>
struct ReservoirQuantileListOperation : public ReservoirQuantileOperation {
	template <class T, class STATE>
	static void Finalize(STATE &state, T &target, AggregateFinalizeData &finalize_data) {
		if (state.pos == 0) {
			finalize_data.ReturnNull();
			return;
		}

		D_ASSERT(finalize_data.input.bind_data);
		auto &bind_data = finalize_data.input.bind_data->template Cast<ReservoirQuantileBindData>();

		auto &result = ListVector::GetChildMutable(finalize_data.result);
		auto ridx = ListVector::GetListSize(finalize_data.result);
		ListVector::Reserve(finalize_data.result, ridx + bind_data.quantiles.size());
		auto rdata = FlatVector::GetDataMutable<CHILD_TYPE>(result);

		auto v_t = state.v;
		D_ASSERT(v_t);

		auto &entry = target;
		entry.offset = ridx;
		entry.length = bind_data.quantiles.size();
		for (size_t q = 0; q < entry.length; ++q) {
			const auto &quantile = bind_data.quantiles[q];
			auto offset = (idx_t)((double)(state.pos - 1) * quantile);
			std::nth_element(v_t, v_t + offset, v_t + state.pos);
			rdata[ridx + q] = v_t[offset];
		}

		ListVector::SetListSize(finalize_data.result, entry.offset + entry.length);
	}
};

template <class STATE, class INPUT_TYPE, class RESULT_TYPE, class OP>
AggregateFunction ReservoirQuantileListAggregate(const LogicalType &input_type, const LogicalType &child_type) {
	LogicalType result_type = LogicalType::LIST(child_type);
	return AggregateFunction(
	    {input_type}, result_type, AggregateFunction::StateSize<STATE>, AggregateFunction::StateInitialize<STATE, OP>,
	    AggregateFunction::UnaryScatterUpdate<STATE, INPUT_TYPE, OP>, AggregateFunction::StateCombine<STATE, OP>,
	    AggregateFunction::StateFinalize<STATE, RESULT_TYPE, OP>, FunctionNullHandling::DEFAULT_NULL_HANDLING,
	    AggregateFunction::NoClusterUpdate(), AggregateFunction::NoBind(), AggregateFunction::StateDestroy<STATE, OP>);
}

template <typename INPUT_TYPE, typename SAVE_TYPE>
AggregateFunc
```

### Core Architecture Module: `extension/core_functions/aggregate/nested/binned_histogram.cpp`
```
#include "core_functions/aggregate/histogram_helpers.hpp"
#include "core_functions/aggregate/nested_functions.hpp"
#include "core_functions/scalar/generic_functions.hpp"
#include "duckdb/common/algorithm.hpp"
#include "duckdb/common/smaller_binary.hpp"
#include "duckdb/common/types/vector.hpp"
#include "duckdb/common/vector/flat_vector.hpp"
#include "duckdb/common/vector/list_vector.hpp"
#include "duckdb/common/vector/map_vector.hpp"
#include "duckdb/common/vector_operations/vector_operations.hpp"
#include "duckdb/function/scalar/nested_functions.hpp"
#include "duckdb/planner/expression/bound_aggregate_expression.hpp"

namespace duckdb {

namespace {

template <class T>
struct HistogramBinState {
	using TYPE = T;

	unsafe_vector<T> *bin_boundaries;
	unsafe_vector<idx_t> *counts;

	void Destroy() {
		if (bin_boundaries) {
			delete bin_boundaries;
			bin_boundaries = nullptr;
		}
		if (counts) {
			delete counts;
			counts = nullptr;
		}
	}

	bool IsSet() {
		return bin_boundaries;
	}

	template <class OP>
	void InitializeBins(Vector &bin_vector, idx_t pos, AggregateInputData &aggr_input) {
		bin_boundaries = new unsafe_vector<T>();
		counts = new unsafe_vector<idx_t>();
		auto bin_counts = bin_vector.Values<list_entry_t>();
		auto bin_entry = bin_counts[pos];
		if (!bin_entry.IsValid()) {
			throw BinderException("Histogram bin list cannot be NULL");
		}
		auto bin_list = bin_entry.GetValue();

		auto &bin_child = ListVector::GetChildMutable(bin_vector);
		UnifiedVectorFormat bin_child_data;
		auto extra_state = OP::CreateExtraState();
		OP::PrepareData(bin_child, extra_state, bin_child_data);

		bin_boundaries->reserve(bin_list.length);
		for (idx_t i = 0; i < bin_list.length; i++) {
			auto bin_child_idx = bin_child_data.sel->get_index(bin_list.offset + i);
			if (!bin_child_data.validity.RowIsValid(bin_child_idx)) {
				throw BinderException("Histogram bin entry cannot be NULL");
			}
			bin_boundaries->push_back(OP::template ExtractValue<T>(bin_child_data, bin_list.offset + i, aggr_input));
		}
		// sort the bin boundaries
		std::sort(bin_boundaries->begin(), bin_boundaries->end());
		// ensure there are no duplicate bin boundaries
		for (idx_t i = 1; i < bin_boundaries->size(); i++) {
			if (Equals::Operation((*bin_boundaries)[i - 1], (*bin_boundaries)[i])) {
				bin_boundaries->erase_at(i);
				i--;
			}
		}

		counts->resize(bin_boundaries->size() + 1);
	}
};

struct HistogramBinFunction {
	template <class STATE>
	static void Destroy(STATE &state, AggregateInputData &aggr_input_data) {
		state.Destroy();
	}

	static bool IgnoreNull() {
		return true;
	}

	template <class STATE, class OP>
	static void Combine(const STATE &source, STATE &target, AggregateInputData &input_data) {
		if (!source.bin_boundaries) {
			// nothing to combine
			return;
		}
		if (!target.bin_boundaries) {
			// target does not have bin boundaries - copy everything over
			target.bin_boundaries = new unsafe_vector<typename STATE::TYPE>();
			target.counts = new unsafe_vector<idx_t>();
			*target.bin_boundaries = *source.bin_boundaries;
			*target.counts = *source.counts;
		} else {
			// both source and target have bin boundaries
			if (*target.bin_boundaries != *source.bin_boundaries) {
				throw NotImplementedException(
				    "Histogram - cannot combine histograms with different bin boundaries. "
				    "Bin boundaries must be the same for all histograms within the same group");
			}
			if (target.counts->size() != source.counts->size()) {
				throw InternalException("Histogram combine - bin boundaries are the same but counts are different");
			}
			D_ASSERT(target.counts->size() == source.counts->size());
			for (idx_t bin_idx = 0; bin_idx < target.counts->size(); bin_idx++) {
				(*target.counts)[bin_idx] += (*source.counts)[bin_idx];
			}
		}
	}
};

struct HistogramRange {
	static constexpr bool EXACT = false;

	template <class T>
	static idx_t GetBin(T value, const unsafe_vector<T> &bin_boundaries) {
		auto entry = std::lower_bound(bin_boundaries.begin(), bin_boundaries.end(), value);
		return UnsafeNumericCast<idx_t>(entry - bin_boundaries.begin());
	}
};

struct HistogramExact {
	static constexpr bool EXACT = true;

	template <class T>
	static idx_t GetBin(T value, const unsafe_vector<T> &bin_boundaries) {
		auto entry = std::lower_bound(bin_boundaries.begin(), bin_boundaries.end(), value);
		if (entry == bin_boundaries.end() || !(*entry == value)) {
			// entry not found - return last bucket
			return bin_boundaries.size();
		}
		return UnsafeNumericCast<idx_t>(entry - bin_boundaries.begin());
	}
};

template <class OP, class T, class HIST>
void HistogramBinUpdateFunction(Vector inputs[], AggregateInputData &aggr_input, idx_t input_count,
                                Vector &state_vector, idx_t count) {
	auto &input = inputs[0];
	auto &bin_vector = inputs[1];

	auto extra_state = OP::CreateExtraState();
	UnifiedVectorFormat input_data;
	OP::PrepareData(input, extra_state, input_data);

	auto states = state_vector.Values<HistogramBinState<T> *>();
	auto data = UnifiedVectorFormat::GetData<T>(input_data);
	for (idx_t i = 0; i < count; i++) {
		auto idx = input_data.sel->get_index(i);
		if (!input_data.validity.RowIsValid(idx)) {
			continue;
		}
		auto &state = *states[i].GetValue();
		if (!state.IsSet()) {
			state.template InitializeBins<OP>(bin_vector, i, aggr_input);
		}
		auto bin_entry = HIST::template GetBin<T>(data[idx], *state.bin_boundaries);
		++(*state.counts)[bin_entry];
	}
}

bool SupportsOtherBucket(const LogicalType &type) {
	if (type.HasAlias()) {
		return false;
	}
	switch (type.id()) {
	case LogicalTypeId::TINYINT:
	case LogicalTypeId::SMALLINT:
	case LogicalTypeId::INTEGER:
	case LogicalTypeId::BIGINT:
	case LogicalTypeId::HUGEINT:
	case LogicalTypeId::FLOAT:
	case LogicalTypeId::DOUBLE:
	case LogicalTypeId::DECIMAL:
	case LogicalTypeId::UTINYINT:
	case LogicalTypeId::USMALLINT:
	case LogicalTypeId::UINTEGER:
	case LogicalTypeId::UBIGINT:
	case LogicalTypeId::UHUGEINT:
	case LogicalTypeId::TIME:
	case LogicalTypeId::TIME_TZ:
	case LogicalTypeId::DATE:
	case LogicalTypeId::TIMESTAMP:
	case LogicalTypeId::TIMESTAMP_TZ:
	case LogicalTypeId::TIMESTAMP_TZ_NS:
	case LogicalTypeId::TIMESTAMP_SEC:
	case LogicalTypeId::TIMESTAMP_MS:
	case LogicalTypeId::TIMESTAMP_NS:
	case LogicalTypeId::VARCHAR:
	case LogicalTypeId::BLOB:
	case LogicalTypeId::STRUCT:
	case LogicalTypeId::LIST:
		return true;
	default:
		return false;
	}
}
Value OtherBucketValue(const LogicalType &type) {
	switch (type.id()) {
	case LogicalTypeId::TINYINT:
	case LogicalTypeId::SMALLINT:
	case LogicalTypeId::INTEGER:
	case LogicalTypeId::BIGINT:
	case LogicalTypeId::HUGEINT:
	case LogicalTypeId::DECIMAL:
	case LogicalTypeId::UTINYINT:
	case LogicalTypeId::USMALLINT:
	case LogicalTypeId::UINTEGER:
	case LogicalTypeId::UBIGINT:
	case LogicalTypeId::UHUGEINT:
	case LogicalTypeId::TIME:
	case LogicalTypeId::TIME_TZ:
		return Value::MaximumValue(type);
	case LogicalTypeId::DATE:
	case LogicalTypeId::TIMESTAMP:
	case LogicalTypeId::TIMESTAMP_TZ:
	case LogicalTypeId::TIMESTAMP_TZ_NS:
	case LogicalTypeId::TIMESTAMP_SEC:
	case LogicalTypeId::TIMESTAMP_MS:
	case LogicalTypeId::TIMESTAMP_NS:
	case LogicalTypeId::FLOAT:
	case LogicalTypeId::DOUBLE:
		return Value::Infinity(type);
	case LogicalTypeId::VARCHAR:
		return Value("");
	case LogicalTypeId::BLOB:
		return Value::BLOB("");
	case LogicalTypeId::STRUCT: {
		// for structs we can set all child members to NULL
		auto &child_types = StructType::GetChildTypes(type);
		child_list_t<Value> child_list;
		for (auto &child_type : child_types) {
			child_list.push_back(make_pair(child_type.first, Value(child_type.second)));
		}
		return Value::STRUCT(std::move(child_list));
	}
	case LogicalTypeId::LIST:
		return Value::LIST(ListType::GetChildType(type), vector<Value>());
	default:
		throw InternalException("Unsupported type for other bucket");
	}
}

void IsHistogramOtherBinFunction(DataChunk &args, ExpressionState &state, Vector &result) {
	auto &input_type = args.data[0].GetType();
	if (!SupportsOtherBucket(input_type)) {
		result.Reference(Value::BOOLEAN(false), count_t(args.size()));
		return;
	}
	auto v = OtherBucketValue(input_type);
	Vector ref(v, count_t(args.size()));
	VectorOperations::NotDistinctFrom(args.data[0], ref, result);

	// Set NULL if input is NULL.
	UnifiedVectorFormat input_data;
	args.data[0].ToUnifiedFormat(input_data);
	if (!input_data.validity.CannotHaveNull()) {
		auto &result_validity = FlatVector::ValidityMutable(result);
		for (idx_t idx = 0; idx < args.size(); ++idx) {
			auto input_idx = input_data.sel->get_index(idx);
			if (!input_data.validity.RowIsValid(input_idx)) {
				result_validity.SetInvalid(idx);
			}
		}
	}
}

template <class OP, class T>
void HistogramBinFinalizeFunction(Vector &state_vector, AggregateFinalizeInputData &, Vector &result, idx_t count,
                                  idx_t offset) {
	auto states = state_vector.Values<HistogramBinState<T> *>();

	auto &mask = FlatVector::ValidityMutable(result);
	auto old_len = ListVector::GetListSize(result);
	idx_t new_entries = 0;
	bool supports_other_bucket = SupportsOtherBucket(MapType::KeyType(result.GetType()));
	// figure out how much space we need
	for (idx_t i = 0; i < count; i++) {
		auto &state = *states[i].GetValue();
		if (!state.bin_boundaries) {
			continue;
		}
		new_entries += state.bin_boundaries->size();
		if (state.counts->back() > 0 && supports_other_bucket) {
			// overflow bucket has entries
			new_entries++;
		}
	}
	// reserve space in the list vector
	ListVector::Reserve(result, old_len + new_entries);
	auto &keys = MapVector::GetKeys(result);
	auto &values = MapVector::GetValues(result);
	auto list_entries = FlatVector::GetDataMutable<list_entry_t>(result);
	auto count_entries = FlatVector::GetDataMutable<uint64_t>(values);

	idx_t current_offset = old_len;
	for (idx_t i = 0; i < count; i++) {
		const auto rid = i + offset;
		auto &state = *states[i].GetValue();
		if (!state.bin_bounda
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #26698** (2026-10-07): **Fixup so that avro is compatible with clang-cl**
  *Symptoms*: Connected to https://github.com/duckdb/extension-ci-tools/pull/428 and move to clang-cl, that surfaced as Windows CI issue in the avro extension.
  **Post-Mortem & Fix Analysis**:
  > Thanks!

- **Issue #26693** (2026-10-07): **Skip the partitioned COPY backpressure test on Windows**
  *Symptoms*: `test/sql/copy/partitioned/partitioned_write_backpressure.test` (added in #25913) fails intermittently on the Windows (64 Bit) job, e.g. https://github.com/duckdb/duckdb/actions/runs/37631967754/job/112841227180 on #26592:  ``` Out of Memory Error: failed to offload data block of size 64.0 KiB (0 bytes/0 bytes used). This limit was set by the 'max_temp_directory_size' setting. ```  Since Oct 7 it accounts for 11 of the 12 Windows (64 Bit) job failures I looked at, across unrelated branches. A job that hits it fails every retry. I did not find it failing on any Linux or macOS job I checked.  I could not reproduce it on Linux. The COPY peaks at ~50-60 MB of the 128 MB limit, even pinned to a single core, under heavy CPU contention, with injected write latency, or without jemalloc. The test also passes on Linux with #25913 reverted, so outside of Windows it does not detect the regression it targets. The deterministic coverage of the bounded overlap is in `test/api/test_copy_output_lifecycle.cpp`.  This PR skips the test on Windows. The underlying cause of the higher memory use on Windows is still unknown and probably worth looking at separately. 
  **Post-Mortem & Fix Analysis**:
  > Already fixed in https://github.com/duckdb/duckdb/pull/26677

- **Issue #26677** (2026-10-07): **Stabilize partitioned_write_backpressure test**
  *Symptoms*: The test failed intermittently in CI with `failed to offload data block`, e.g.: https://github.com/duckdb/duckdb/actions/runs/37596932539/job/112727031550  With backpressure the COPY usually peaks around 70MB, but occasionally reaches ~117MB, just under the 128MB limit. Those spikes are in memory with the `ALLOCATOR` tag, not in the partitioned COPY's buffered runs (the `WINDOW` tag), which stay bounded.  The COPY now writes CSV instead of Parquet, which removes most of that noise. With backpressure it peaks at 55-82MB. Without it (the code before #25913) it peaks at 452-681MB, so it still fails reliably at 128MB when backpressure regresses. Reading the CSV output back needs more memory than the Parquet output did, so the limit is raised to 1GB after the COPY. 

- **Issue #26655** (2026-10-07): **Fix flaky mode_tpch test after dbgen data change**
  *Symptoms*: Since #26431 changed the generated TPC-H data, `' carefully'` and `' furiously'` are tied as the most common `l_comment` for `l_returnflag = 'R'`, so `mode` returns either depending on thread scheduling. Test the `A` and `N` groups instead, which have a clear winner, and add an `ORDER BY` so the row order is deterministic too.  The tie can be seen with:  ```sql CALL dbgen(sf=1); SELECT '"' || l_comment || '"' AS comment, count(*) AS c FROM lineitem WHERE l_returnflag = 'R' GROUP BY l_comment ORDER BY c DESC, l_comment LIMIT 3; ```  ``` " carefully"    228 " furiously"    228 " furiously "   211 ```  Random failure happened here in CI: https://github.com/duckdb/duckdb/actions/runs/37478275741/job/112334138507?pr=26570
  **Post-Mortem & Fix Analysis**:
  > hey, thanks for looking into this! It's already resolved by https://github.com/duckdb/duckdb/pull/26541, so i'm closing this PR.

- **Issue #26653** (2026-10-07): **Stabilize parquet_prefetch_tracked_memory test**
  *Symptoms*: `test/sql/copy/parquet/parquet_prefetch_tracked_memory.test` fails intermittently in CI (seen on several unrelated PRs and on a default-branch run), always in the second half:  ``` Query unexpectedly failed (test/sql/copy/parquet/parquet_prefetch_tracked_memory.test:32) Out of Memory Error: failed to allocate data of size 64.0 MiB (189.1 MiB/228.8 MiB used) ```  under `--verify-vector constant_operator` (Execution group), `latest_storage.json` (Persistence group) and the Query Verification group. It usually passes on the automatic retry.  ### Cause The test pins a memory-fit boundary: a prefetching scan must OOM where synchronous reads fit. With a 64MB row group and a 240MB limit both margins are thin. Bisecting the limit with the current code gives:  | row group | prefetch still OOMs up to | synchronous read alone needs | |---|---|---| | 64MB (16M rows, current) | ~262MB | < 120MB | | 128MB (32M rows) | ~323MB | < 120MB | | 256MB (64M rows) | ~455MB | < 120MB |  So at 240MB the first half has ~24MB of margin, and the second half runs in the same connection right after the failed query, so whatever that query still holds (~189MB in the failing runs) is counted against the limit before the synchronous reads allocate their first 64MB chunk.  ### Change - Use a 256MB row group and a 360MB limit: prefetching needs over 450MB and fails with a ~95MB margin; the synchronous reads need less than 120MB. - `restart` between the two halves so the synchronous reads start from a clean buf

- **Issue #26652** (2026-10-07): **C API v2: passthrough catalog types, so C extensions can be CONNECT targets**
  *Symptoms*: This lets an extension built against the v2 C API (or the stable C++ API on top of it) become a `CONNECT` target.  ### Why  `CONNECT` (#25990) routes the statements of a connected client to the attached database's `Catalog`, which has to declare `RemoteCapability::CONNECT` and implement `RemoteExecute(sql)`. Catalogs can only be provided by storage extensions written against DuckDB's internal C++ API, so a C API extension that talks to a remote query engine has no way to offer  ```sql CONNECT 'myengine:some/endpoint' (OPTION 'value'); select whatever the remote understands; DISCONNECT; ```  even though it already has everything else: a table function that runs a query on the remote and returns its rows.  ### What  A **passthrough catalog type**: the smallest catalog an extension can attach. A catalog of this type holds no schemas or tables. It exists so that `ATTACH 'type:path' AS x (OPTION 'value')`, `ATTACH 'path' AS x (TYPE type, ...)` and `CONNECT 'type:path' (...)` resolve to the extension, and so that every statement forwarded to it while CONNECT-ed becomes a call of the extension's table function:  ``` query_function(path, sql, option := value, ...) ```  `path` is the attach path without the `type:` prefix, `sql` the statement text as the user typed it, and the named arguments are the options of the ATTACH/CONNECT statement (lowercased), so the function can take endpoint, credentials, defaults, etc. from them. Its result is the statement's result.  - `src/storage/passt
  **Post-Mortem & Fix Analysis**:
  > LGTM!   Im not 100% on the `remote_catalog_type` naming, `type` feels like an enum or something that represent a set of values. But I also cant think of what else to really call it... `remote_catalog_kind`? `remote_catalog_method`? ... idk, lets keep it for now.

- **Issue #26645** (2026-10-07): **Fix out-of-bound access for column segment**
  *Symptoms*: Hi team, I found the following SQL suffers INTERNAL exception ```sql haojiang@HaoJiangs-MacBook-Pro$ ./build/debug/duckdb /tmp/segment_access.db DuckDB v2.0.0-dev77342 (Development Version, 4c6461bf76) Enter ".help" for usage hints. segment_access D SET force_compression='rle'; segment_access D CREATE TABLE t AS SELECT i, i::BIGINT AS x FROM range(100000) r(i); segment_access D CHECKPOINT; segment_access D .quit  haojiang@HaoJiangs-MacBook-Pro$ ./build/debug/duckdb /tmp/segment_access.db DuckDB v2.0.0-dev77342 (Development Version, 4c6461bf76) Enter ".help" for usage hints. segment_access D SET debug_force_fetch_row = true; segment_access D SELECT count(*), sum(x) FROM t; ┌──────────────┬────────────┐ │ count_star() │   sum(x)   │ │    int64     │   int128   │ ├──────────────┼────────────┤ │       100000 │ 4999950000 │ └──────────────┴────────────┘ segment_access D SELECT count(*), sum(x) FROM t WHERE i BETWEEN 60000 AND 60010; INTERNAL Error: ColumnSegment::FetchRow - row_id out of range for segment ``` I think the reason is,  - Currently we're passing the row id for the whole column into `ColumnSegment::FetchRow` - But the `FetchRow` function is expecting row id inside of the column, see [assertion](https://github.com/duckdb/duckdb/blob/86be5722eefdca644f9d848de58ee3d9feb7bbf2/src/storage/table/column_segment.cpp#L186), the [`count`](https://github.com/duckdb/duckdb/blob/86be5722eefdca644f9d848de58ee3d9feb7bbf2/src/include/duckdb/storage/table/seg
  **Post-Mortem & Fix Analysis**:
  > Thanks!

- **Issue #26638** (2026-10-07): **Fix storage leak for blocks freed while still in use**
  *Symptoms*: Hi team, in the following sql, I find DuckDB storage assertion fails, which indicates storage leak in the following SQL (already converted to the regression test) ```sql load {TEST_DIR}/checkpoint_free_blocks_in_use.db  statement ok SET threads=1  statement ok SET checkpoint_threshold='1TB'  statement ok CREATE TABLE big AS SELECT i, i::VARCHAR || 'xxxxxxxxxxxxxxxx' AS s FROM range(200000) t(i)  statement ok CREATE TABLE other(i INT)  statement ok CHECKPOINT  # the next checkpoint rewrites column s and frees its old blocks statement ok UPDATE big SET s = s || 'y' WHERE i % 2 = 0  concurrentloop threadid 0 2  # a scan of about three seconds that keeps the old blocks alive onlyif threadid=0 query I SELECT count(sleep_ms(1)) FROM big WHERE i < 3000 ---- 0  # both checkpoints run while the scan still uses the freed blocks onlyif threadid=1 statement ok SELECT sleep_ms(500)  onlyif threadid=1 statement ok CHECKPOINT  onlyif threadid=1 statement ok INSERT INTO other VALUES (1)  onlyif threadid=1 statement ok CHECKPOINT  endloop  # the WAL is empty, so the free list of the last checkpoint is what gets loaded restart  statement ok SET debug_verify_blocks=true  statement ok INSERT INTO other VALUES (2)  statement ok CHECKPOINT ``` which gets error message ```sh FATAL Error: Failed to create checkpoint because of error: Block verification failed - blocks "0, 1, 2, 3" were not found as being used OR marked as free Max blo
  **Post-Mortem & Fix Analysis**:
  > Thanks!

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

### Incident Patch 1: `6afcb082` (2026-10-07)
**Commit Message**: Fixup so that avro is compatible with clang-cl (#26698)

Connected to https://github.com/duckdb/extension-ci-tools/pull/428 and
move to clang-cl, that surfaced as Windows CI issue in the avro
extension.

**File**: `.github/config/extensions/avro.cmake` (modified, +1/-0)
```diff
@@ -4,5 +4,6 @@ if (NOT MINGW)
             GIT_URL https://github.com/duckdb/duckdb-avro
             GIT_TAG 859d56d1bcf8e1645a4d6cb905b96ebf327af139
 	    SUBMODULES "third_party/avro-c"
+            APPLY_PATCHES
     )
 endif()
```

**File**: `.github/patches/extensions/avro/0001-avro-c-skip-tp-for-clang-cl.patch` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+diff --git a/third_party/avro-c/lang/c/CMakeLists.txt b/third_party/avro-c/lang/c/CMakeLists.txt
+index d842af8..2ff6cc9 100644
+--- a/third_party/avro-c/lang/c/CMakeLists.txt
++++ b/third_party/avro-c/lang/c/CMakeLists.txt
+@@ -111,10 +111,13 @@ if(CMAKE_COMPILER_IS_GNUCC)
+     add_definitions(-W -Wall)
+ endif(CMAKE_COMPILER_IS_GNUCC)
+ 
+-if (WIN32)
+-   # Compile win32 in C++ to allow declarations after statements
++if (WIN32 AND NOT CMAKE_C_COMPILER_ID MATCHES "Clang")
++   # Compile win32 in C++ to allow declarations after statements.
++   # Only needed for MSVC's cl.exe: clang-cl supports C99 natively, and
++   # compiling this C code as C++ fails under clang's stricter conversion
++   # rules (e.g. string literal to void* in datafile.c).
+    add_definitions(/TP)
+-endif(WIN32)
++endif()
+ 
+ # Uncomment to allow missing fields in the resolved-writer
+ # add_definitions(-DAVRO_ALLOW_MISSING_FIELDS_IN_RESOLVED_WRITER)
```

---

### Incident Patch 2: `744d3152` (2026-10-07)
**Commit Message**: Fixup so that avro is compatible with clang-cl

Connected to https://github.com/duckdb/extension-ci-tools/pull/428 and move to clang-cl

**File**: `.github/config/extensions/avro.cmake` (modified, +1/-0)
```diff
@@ -4,5 +4,6 @@ if (NOT MINGW)
             GIT_URL https://github.com/duckdb/duckdb-avro
             GIT_TAG 859d56d1bcf8e1645a4d6cb905b96ebf327af139
 	    SUBMODULES "third_party/avro-c"
+            APPLY_PATCHES
     )
 endif()
```

**File**: `.github/patches/extensions/avro/0001-avro-c-skip-tp-for-clang-cl.patch` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+diff --git a/third_party/avro-c/lang/c/CMakeLists.txt b/third_party/avro-c/lang/c/CMakeLists.txt
+index d842af8..2ff6cc9 100644
+--- a/third_party/avro-c/lang/c/CMakeLists.txt
++++ b/third_party/avro-c/lang/c/CMakeLists.txt
+@@ -111,10 +111,13 @@ if(CMAKE_COMPILER_IS_GNUCC)
+     add_definitions(-W -Wall)
+ endif(CMAKE_COMPILER_IS_GNUCC)
+ 
+-if (WIN32)
+-   # Compile win32 in C++ to allow declarations after statements
++if (WIN32 AND NOT CMAKE_C_COMPILER_ID MATCHES "Clang")
++   # Compile win32 in C++ to allow declarations after statements.
++   # Only needed for MSVC's cl.exe: clang-cl supports C99 natively, and
++   # compiling this C code as C++ fails under clang's stricter conversion
++   # rules (e.g. string literal to void* in datafile.c).
+    add_definitions(/TP)
+-endif(WIN32)
++endif()
+ 
+ # Uncomment to allow missing fields in the resolved-writer
+ # add_definitions(-DAVRO_ALLOW_MISSING_FIELDS_IN_RESOLVED_WRITER)
```

---

### Incident Patch 3: `3e78c60f` (2026-10-07)
**Commit Message**: Merge remote-tracking branch 'origin' into fix-flaky-memory

**File**: `.github/patches/extensions/iceberg/0002-link-loadable-mbedtls.patch` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+diff --git a/CMakeLists.txt b/CMakeLists.txt
+index 248abbfe..dde54e54 100644
+--- a/CMakeLists.txt
++++ b/CMakeLists.txt
+@@ -50,6 +50,7 @@ if(EMSCRIPTEN)
+ endif()
+ 
+ build_loadable_extension(${TARGET_NAME} ${PARAMETERS} ${ALL_OBJECT_FILES})
++target_link_libraries(${TARGET_NAME}_loadable_extension duckdb_mbedtls)
+ 
+ # Link Roaring library
+ target_link_libraries(
```

**File**: `.github/workflows/Windows.yml` (modified, +18/-0)
```diff
@@ -63,6 +63,9 @@ jobs:
       shell: pwsh
       run: |
         $commands = Get-Content compile_commands.json -Raw
+        if (!$commands.Contains('clang-cl')) {
+          throw 'Windows amd64 Release compile commands are not using clang-cl'
+        }
         if (!$commands.Contains('-march=haswell') -or !$commands.Contains('-mtune=generic')) {
           throw 'Windows amd64 Release compile commands are missing the CLI architecture flags'
         }
@@ -175,6 +178,9 @@ jobs:
     runs-on: ${{ fromJSON(inputs.runners).windows_2022_x64 || 'windows-2022' }}
     env:
       GEN: ninja
+      CC: clang-cl
+      CXX: clang-cl
+      EXTRA_CMAKE_VARIABLES: -DCMAKE_C_COMPILER_TARGET=i686-pc-windows-msvc -DCMAKE_CXX_COMPILER_TARGET=i686-pc-windows-msvc
 
     steps:
     - name: "Checkout"
@@ -198,8 +204,17 @@ jobs:
     - name: Build
       shell: bash
       run: |
+        clang-cl --version
         python scripts/ci/retry.py -- make windows_release_32
 
+    - name: Verify compiler
+      shell: pwsh
+      run: |
+        $commands = Get-Content compile_commands.json -Raw
+        if (!$commands.Contains('clang-cl')) {
+          throw 'Windows 32-bit compile commands are not using clang-cl'
+        }
+
     - name: Test
       shell: bash
       if: ${{ !inputs.skip_tests }}
@@ -251,6 +266,9 @@ jobs:
        shell: pwsh
        run: |
          $commands = Get-Content compile_commands.json -Raw
+         if (!$commands.Contains('clang-cl')) {
+           throw 'Windows ARM64 Release compile commands are not using clang-cl'
+         }
          if (!$commands.Contains('-march=armv8-a') -or !$commands.Contains('-mtune=generic')) {
            throw 'Windows ARM64 Release compile commands are missing the architecture flags'
          }
```

**File**: `extension/extension_build_tools.cmake` (modified, +10/-3)
```diff
@@ -255,6 +255,9 @@ function(build_loadable_extension_directory NAME ABI_TYPE OUTPUT_DIRECTORY EXTEN
     set_target_properties(${TARGET_NAME} PROPERTIES DEFINE_SYMBOL "")
     set_target_properties(${TARGET_NAME} PROPERTIES OUTPUT_NAME ${NAME})
     set_target_properties(${TARGET_NAME} PROPERTIES PREFIX "")
+    if(NOT EXTENSION_STATIC_BUILD)
+        set_property(TARGET ${TARGET_NAME} PROPERTY DUCKDB_DYNAMIC_LOADABLE_EXTENSION TRUE)
+    endif()
     if(${IGNORE_WARNINGS} GREATER -1)
         disable_target_warnings(${TARGET_NAME})
     endif()
@@ -462,15 +465,18 @@ function(build_static_extension NAME PARAMETERS)
         set(PREBUILT_TARGET ${NAME}_prebuilt_extension)
         add_library(${PREBUILT_TARGET} STATIC IMPORTED GLOBAL)
         set_property(TARGET ${PREBUILT_TARGET} PROPERTY IMPORTED_LOCATION "${PREBUILT_PATH}")
-        target_link_libraries(${PREBUILT_TARGET} INTERFACE duckdb_static)
+        target_link_libraries(${PREBUILT_TARGET} INTERFACE
+            "$<$<NOT:$<BOOL:$<TARGET_PROPERTY:DUCKDB_DYNAMIC_LOADABLE_EXTENSION>>>:duckdb_static>")
         add_library(${NAME}_extension STATIC "${DUMMY_SOURCE}")
         target_link_libraries(${NAME}_extension "$<BUILD_INTERFACE:${PREBUILT_TARGET}>")
         set_property(TARGET ${NAME}_extension PROPERTY DUCKDB_EXTENSION_KIND CPP)
         set_property(TARGET ${NAME}_extension PROPERTY DUCKDB_PREBUILT_EXTENSION TRUE)
         return()
     endif()
     add_library(${NAME}_extension STATIC ${FILES})
-    target_link_libraries(${NAME}_extension duckdb_static)
+    # Dynamic loadables resolve DuckDB symbols from the host, including when linked through this archive.
+    target_link_libraries(${NAME}_extension
+        "$<$<NOT:$<BOOL:$<TARGET_PROPERTY:DUCKDB_DYNAMIC_LOADABLE_EXTENSION>>>:duckdb_static>")
     duckdb_add_extension_describe(${NAME} CPP)
     duckdb_make_native_lto_archive(${NAME}_extension)
 endfunction()
@@ -542,7 +548,8 @@ endfunction()
 
 function(build_static_extension_capi_internal NAME KIND API_VERSION FILES)
     add_library(${NAME}_extension STATIC ${FILES})
-    target_link_libraries(${NAME}_extension duckdb_static)
+    target_link_libraries(${NAME}_extension
+        "$<$<NOT:$<BOOL:$<TARGET_PROPERTY:DUCKDB_DYNAMIC_LOADABLE_EXTENSION>>>:duckdb_static>")
     target_compile_definitions(${NAME}_extension PRIVATE DUCKDB_BUILD_STATIC_EXTENSION)
     duckdb_add_extension_describe(${NAME} ${KIND} "${API_VERSION}")
     duckdb_make_native_lto_archive(${NAME}_extension)
```

**File**: `scripts/ci/test_extension_linkage.py` (added, +75/-0)
```diff
@@ -0,0 +1,75 @@
+#!/usr/bin/env python3
+import json
+from pathlib import Path
+import shutil
+import subprocess
+import sys
+import tempfile
+import unittest
+
+
+REPO_ROOT = Path(__file__).resolve().parents[2]
+
+
+@unittest.skipUnless(shutil.which("cmake") and shutil.which("ninja"), "requires CMake and Ninja")
+class ExtensionLinkageTest(unittest.TestCase):
+    def check_linkage(self, static_build):
+        with tempfile.TemporaryDirectory() as directory:
+            build = Path(directory)
+            query = build / ".cmake/api/v1/query"
+            query.mkdir(parents=True)
+            (query / "codemodel-v2").touch()
+            result = subprocess.run(
+                [
+                    "cmake",
+                    "-S",
+                    str(REPO_ROOT),
+                    "-B",
+                    str(build),
+                    "-G",
+                    "Ninja",
+                    "-DCMAKE_BUILD_TYPE=RelWithDebInfo",
+                    "-DBUILD_EXTENSIONS=tpch",
+                    "-DSTATICALLY_LINK_EXTENSIONS=core_functions;tpch",
+                    f"-DEXTENSION_STATIC_BUILD={int(static_build)}",
+                    "-DENABLE_SANITIZER=OFF",
+                    "-DENABLE_UBSAN=OFF",
+                ],
+                capture_output=True,
+                text=True,
+            )
+            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
+            reply = build / ".cmake/api/v1/reply"
+            index = json.loads(next(reply.glob("index-*.json")).read_text())
+            model = json.loads((reply / index["reply"]["codemodel-v2"]["jsonFile"]).read_text())
+            targets = {
+                target["name"]: json.loads((reply / target["jsonFile"]).read_text())
+                for target in model["configurations"][0]["targets"]
+            }
+
+            def libraries(name):
+                return " ".join(
+                    fragment["fragment"]
+                    for fragment in targets[name]["link"]["commandFragments"]
+                    if fragment["role"] == "libraries"
+                )
+
+            tpch_libraries = libraries("tpch_loadable_extension")
+            self.assertIn("libtpch_extension.a", tpch_libraries)
+            self.assertEqual("libduckdb_static.a" in tpch_libraries, static_build, tpch_libraries)
+            # Static consumers still need the core archive after their extension archives.
+            for name, extension in (("duckdb", "tpch"), ("static_link_smoke", "parquet")):
+                linked = libraries(name)
+                self.assertIn("libduckdb_static.a", linked)
+                self.assertLess(linked.index(f"lib{extension}_extension.a"), linked.rindex("libduckdb_static.a"))
+
+    @unittest.skipIf(sys.platform == "win32", "Windows requires EXTENSION_STATIC_BUILD")
+    def test_dynamic_loadable_uses_host_duckdb(self):
+        self.check_linkage(False)
+
+    def test_static_loadable_includes_duckdb(self):
+        self.check_linkage(True)
+
+
+if __name__ == "__main__":
+    unittest.main()
```

**File**: `scripts/generate_extensions_function.py` (modified, +5/-0)
```diff
@@ -50,6 +50,11 @@
     'ducklake': [
         'parquet',
     ],
+    'glue': [
+        'avro',
+        'json',
+        'parquet',
+    ],
     'iceberg': [
         'avro',
         'parquet',
```

**File**: `src/storage/single_file_block_manager.cpp` (modified, +1/-0)
```diff
@@ -1338,6 +1338,7 @@ void SingleFileBlockManager::WriteHeader(QueryContext context, DatabaseHeader he
 	header.iteration = ++iteration_count;
 
 	set<block_id_t> all_free_blocks = free_list;
+	all_free_blocks.insert(free_blocks_in_use.begin(), free_blocks_in_use.end());
 	auto checkpoint_freed_blocks = modified_blocks;
 	for (auto &block : checkpoint_freed_blocks) {
 		all_free_blocks.insert(block);
```

**File**: `src/storage/table/column_data.cpp` (modified, +2/-1)
```diff
@@ -268,10 +268,11 @@ void ColumnData::SelectVector(ColumnScanState &state, Vector &result, idx_t targ
 		throw InternalException("ColumnData::SelectVector should be able to fetch everything from one segment");
 	}
 	if (state.scan_options && state.scan_options->force_fetch_row) {
+		auto start = state.GetPositionInSegment();
 		for (idx_t i = 0; i < sel_count; i++) {
 			auto source_idx = sel.get_index(i);
 			ColumnFetchState fetch_state;
-			current.FetchRow(fetch_state, UnsafeNumericCast<row_t>(state.offset_in_column + source_idx), result, i);
+			current.FetchRow(fetch_state, UnsafeNumericCast<row_t>(start + source_idx), result, i);
 		}
 	} else {
 		current.Select(state, target_count, result, sel, sel_count);
```

**File**: `test/sql/storage/checkpoint_free_blocks_in_use.test_slow` (added, +75/-0)
```diff
@@ -0,0 +1,75 @@
+# name: test/sql/storage/checkpoint_free_blocks_in_use.test_slow
+# description: Blocks freed while a scan still uses them are written to the free list by later checkpoints
+# group: [storage]
+
+load {TEST_DIR}/checkpoint_free_blocks_in_use.db
+
+statement ok
+SET threads=1
+
+statement ok
+SET checkpoint_threshold='1TB'
+
+statement ok
+CREATE TABLE big AS SELECT i, i::VARCHAR || 'xxxxxxxxxxxxxxxx' AS s FROM range(200000) t(i)
+
+statement ok
+CREATE TABLE other(i INT)
+
+statement ok
+CHECKPOINT
+
+# the next checkpoint rewrites column s and frees its old blocks
+statement ok
+UPDATE big SET s = s || 'y' WHERE i % 2 = 0
+
+concurrentloop threadid 0 2
+
+# a scan of about three seconds that keeps the old blocks alive
+onlyif threadid=0
+query I
+SELECT count(sleep_ms(1)) FROM big WHERE i < 3000
+----
+0
+
+# both checkpoints run while the scan still uses the freed blocks
+onlyif threadid=1
+statement ok
+SELECT sleep_ms(500)
+
+onlyif threadid=1
+statement ok
+CHECKPOINT
+
+onlyif threadid=1
+statement ok
+INSERT INTO other VALUES (1)
+
+onlyif threadid=1
+statement ok
+CHECKPOINT
+
+endloop
+
+# the WAL is empty, so the free list of the last checkpoint is what gets loaded
+restart
+
+statement ok
+SET debug_verify_blocks=true
+
+statement ok
+INSERT INTO other VALUES (2)
+
+statement ok
+CHECKPOINT
+
+query III
+SELECT count(*), count(*) FILTER (WHERE s LIKE '%y'), sum(i) FROM big
+----
+200000	100000	19999900000
+
+query I
+SELECT i FROM other ORDER BY i
+----
+1
+2
```

---

### Incident Patch 4: `b76acf72` (2026-10-07)
**Commit Message**: Fix storage leak for blocks freed while still in use (#26638)

Hi team, in the following sql, I find DuckDB storage assertion fails,
which indicates storage leak in the following SQL (already converted to
the regression test)
```sql
load {TEST_DIR}/checkpoint_free_blocks_in_use.db

statement ok
SET threads=1

statement ok
SET checkpoint_threshold='1TB'

statement ok
CREATE TABLE big AS SELECT i, i::VARCHAR || 'xxxxxxxxxxxxxxxx' AS s FROM range(200000) t(i)

statement ok
CREATE TABLE other(i INT)

statement ok
CHECKPOINT

# the next checkpoint rewrites column s and frees its old blocks
statement ok
UPDATE big SET s = s || 'y' WHERE i % 2 = 0

concurrentloop threadid 0 2

# a scan of about three seconds that keeps the old blocks alive
onlyif threadid=0
query I
SELECT count(sleep_ms(1)) FROM big WHERE i < 3000
----
0

# both checkpoints run while the scan still uses the freed blocks
onlyif threadid=1
statement ok
SELECT sleep_ms(500)

onlyif threadid=1
statement ok
CHECKPOINT

onlyif threadid=1
statement ok
INSERT INTO other VALUES (1)

onlyif threadid=1
statement ok
CHECKPOINT

endloop

# the WAL is empty, so the free list of the last checkpoint is what gets loaded
restart

statement

**File**: `src/storage/single_file_block_manager.cpp` (modified, +1/-0)
```diff
@@ -1338,6 +1338,7 @@ void SingleFileBlockManager::WriteHeader(QueryContext context, DatabaseHeader he
 	header.iteration = ++iteration_count;
 
 	set<block_id_t> all_free_blocks = free_list;
+	all_free_blocks.insert(free_blocks_in_use.begin(), free_blocks_in_use.end());
 	auto checkpoint_freed_blocks = modified_blocks;
 	for (auto &block : checkpoint_freed_blocks) {
 		all_free_blocks.insert(block);
```

**File**: `test/sql/storage/checkpoint_free_blocks_in_use.test_slow` (added, +75/-0)
```diff
@@ -0,0 +1,75 @@
+# name: test/sql/storage/checkpoint_free_blocks_in_use.test_slow
+# description: Blocks freed while a scan still uses them are written to the free list by later checkpoints
+# group: [storage]
+
+load {TEST_DIR}/checkpoint_free_blocks_in_use.db
+
+statement ok
+SET threads=1
+
+statement ok
+SET checkpoint_threshold='1TB'
+
+statement ok
+CREATE TABLE big AS SELECT i, i::VARCHAR || 'xxxxxxxxxxxxxxxx' AS s FROM range(200000) t(i)
+
+statement ok
+CREATE TABLE other(i INT)
+
+statement ok
+CHECKPOINT
+
+# the next checkpoint rewrites column s and frees its old blocks
+statement ok
+UPDATE big SET s = s || 'y' WHERE i % 2 = 0
+
+concurrentloop threadid 0 2
+
+# a scan of about three seconds that keeps the old blocks alive
+onlyif threadid=0
+query I
+SELECT count(sleep_ms(1)) FROM big WHERE i < 3000
+----
+0
+
+# both checkpoints run while the scan still uses the freed blocks
+onlyif threadid=1
+statement ok
+SELECT sleep_ms(500)
+
+onlyif threadid=1
+statement ok
+CHECKPOINT
+
+onlyif threadid=1
+statement ok
+INSERT INTO other VALUES (1)
+
+onlyif threadid=1
+statement ok
+CHECKPOINT
+
+endloop
+
+# the WAL is empty, so the free list of the last checkpoint is what gets loaded
+restart
+
+statement ok
+SET debug_verify_blocks=true
+
+statement ok
+INSERT INTO other VALUES (2)
+
+statement ok
+CHECKPOINT
+
+query III
+SELECT count(*), count(*) FILTER (WHERE s LIKE '%y'), sum(i) FROM big
+----
+200000	100000	19999900000
+
+query I
+SELECT i FROM other ORDER BY i
+----
+1
+2
```

---

### Incident Patch 5: `a11f21ed` (2026-10-07)
**Commit Message**: Fix out-of-bound access for column segment (#26645)

Hi team, I found the following SQL suffers INTERNAL exception
```sql
haojiang@HaoJiangs-MacBook-Pro$ ./build/debug/duckdb /tmp/segment_access.db
DuckDB v2.0.0-dev77342 (Development Version, 4c6461bf76)
Enter ".help" for usage hints.
segment_access D SET force_compression='rle';
segment_access D CREATE TABLE t AS SELECT i, i::BIGINT AS x FROM range(100000) r(i);
segment_access D CHECKPOINT;
segment_access D .quit

haojiang@HaoJiangs-MacBook-Pro$ ./build/debug/duckdb /tmp/segment_access.db
DuckDB v2.0.0-dev77342 (Development Version, 4c6461bf76)
Enter ".help" for usage hints.
segment_access D SET debug_force_fetch_row = true;
segment_access D SELECT count(*), sum(x) FROM t;
┌──────────────┬────────────┐
│ count_star() │   sum(x)   │
│    int64     │   int128   │
├──────────────┼────────────┤
│       100000 │ 4999950000 │
└──────────────┴────────────┘
segment_access D SELECT count(*), sum(x) FROM t WHERE i BETWEEN 60000 AND 60010;
INTERNAL Error:
ColumnSegment::FetchRow - row_id out of range for segment
```
I think the reason is, 
- Currently we're passing the row id for the whole column into
`ColumnSegment::FetchRow`
- But the `Fet

**File**: `src/storage/table/column_data.cpp` (modified, +2/-1)
```diff
@@ -268,10 +268,11 @@ void ColumnData::SelectVector(ColumnScanState &state, Vector &result, idx_t targ
 		throw InternalException("ColumnData::SelectVector should be able to fetch everything from one segment");
 	}
 	if (state.scan_options && state.scan_options->force_fetch_row) {
+		auto start = state.GetPositionInSegment();
 		for (idx_t i = 0; i < sel_count; i++) {
 			auto source_idx = sel.get_index(i);
 			ColumnFetchState fetch_state;
-			current.FetchRow(fetch_state, UnsafeNumericCast<row_t>(state.offset_in_column + source_idx), result, i);
+			current.FetchRow(fetch_state, UnsafeNumericCast<row_t>(start + source_idx), result, i);
 		}
 	} else {
 		current.Select(state, target_count, result, sel, sel_count);
```

**File**: `test/sql/storage/compression/rle/rle_select_force_fetch_row.test` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+# name: test/sql/storage/compression/rle/rle_select_force_fetch_row.test
+# description: Filtered scans with debug_force_fetch_row must fetch rows relative to the segment start
+# group: [rle]
+
+load {TEST_DIR}/rle_select_force_fetch_row.db
+
+statement ok
+SET force_compression='rle';
+
+statement ok
+CREATE TABLE t AS SELECT i, i::BIGINT AS x FROM range(100000) r(i);
+
+statement ok
+CHECKPOINT
+
+restart
+
+# the column spans multiple segments within a single row group
+query I
+SELECT count(*) > 1 FROM pragma_storage_info('t') WHERE column_name = 'x' AND segment_type = 'BIGINT';
+----
+true
+
+statement ok
+SET debug_force_fetch_row = true;
+
+# the filter on i selects rows that live in a later segment of x
+query II
+SELECT count(*), sum(x) FROM t WHERE i BETWEEN 60000 AND 60010;
+----
+11	660055
```

---

### Incident Patch 6: `3fc556b7` (2026-10-07)
**Commit Message**: [Build] Fix linking for extension builds (#26463)

`EXTENSION_STATIC_BUILD=0` wasn't being respected in the extension
linking step, in the `build_loadable_extension_directory` function.

### Summary of changes
Define `DUCKDB_DYNAMIC_LOADABLE_EXTENSION` if `EXTENSION_STATIC_BUILD`
is false.
Change the `target_link_libraries` calls to only include `duckdb_static`
if `DUCKDB_DYNAMIC_LOADABLE_EXTENSION` is false (undefined also expands
to false).

**File**: `.github/patches/extensions/iceberg/0002-link-loadable-mbedtls.patch` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+diff --git a/CMakeLists.txt b/CMakeLists.txt
+index 248abbfe..dde54e54 100644
+--- a/CMakeLists.txt
++++ b/CMakeLists.txt
+@@ -50,6 +50,7 @@ if(EMSCRIPTEN)
+ endif()
+ 
+ build_loadable_extension(${TARGET_NAME} ${PARAMETERS} ${ALL_OBJECT_FILES})
++target_link_libraries(${TARGET_NAME}_loadable_extension duckdb_mbedtls)
+ 
+ # Link Roaring library
+ target_link_libraries(
```

**File**: `extension/extension_build_tools.cmake` (modified, +10/-3)
```diff
@@ -255,6 +255,9 @@ function(build_loadable_extension_directory NAME ABI_TYPE OUTPUT_DIRECTORY EXTEN
     set_target_properties(${TARGET_NAME} PROPERTIES DEFINE_SYMBOL "")
     set_target_properties(${TARGET_NAME} PROPERTIES OUTPUT_NAME ${NAME})
     set_target_properties(${TARGET_NAME} PROPERTIES PREFIX "")
+    if(NOT EXTENSION_STATIC_BUILD)
+        set_property(TARGET ${TARGET_NAME} PROPERTY DUCKDB_DYNAMIC_LOADABLE_EXTENSION TRUE)
+    endif()
     if(${IGNORE_WARNINGS} GREATER -1)
         disable_target_warnings(${TARGET_NAME})
     endif()
@@ -462,15 +465,18 @@ function(build_static_extension NAME PARAMETERS)
         set(PREBUILT_TARGET ${NAME}_prebuilt_extension)
         add_library(${PREBUILT_TARGET} STATIC IMPORTED GLOBAL)
         set_property(TARGET ${PREBUILT_TARGET} PROPERTY IMPORTED_LOCATION "${PREBUILT_PATH}")
-        target_link_libraries(${PREBUILT_TARGET} INTERFACE duckdb_static)
+        target_link_libraries(${PREBUILT_TARGET} INTERFACE
+            "$<$<NOT:$<BOOL:$<TARGET_PROPERTY:DUCKDB_DYNAMIC_LOADABLE_EXTENSION>>>:duckdb_static>")
         add_library(${NAME}_extension STATIC "${DUMMY_SOURCE}")
         target_link_libraries(${NAME}_extension "$<BUILD_INTERFACE:${PREBUILT_TARGET}>")
         set_property(TARGET ${NAME}_extension PROPERTY DUCKDB_EXTENSION_KIND CPP)
         set_property(TARGET ${NAME}_extension PROPERTY DUCKDB_PREBUILT_EXTENSION TRUE)
         return()
     endif()
     add_library(${NAME}_extension STATIC ${FILES})
-    target_link_libraries(${NAME}_extension duckdb_static)
+    # Dynamic loadables resolve DuckDB symbols from the host, including when linked through this archive.
+    target_link_libraries(${NAME}_extension
+        "$<$<NOT:$<BOOL:$<TARGET_PROPERTY:DUCKDB_DYNAMIC_LOADABLE_EXTENSION>>>:duckdb_static>")
     duckdb_add_extension_describe(${NAME} CPP)
     duckdb_make_native_lto_archive(${NAME}_extension)
 endfunction()
@@ -542,7 +548,8 @@ endfunction()
 
 function(build_static_extension_capi_internal NAME KIND API_VERSION FILES)
     add_library(${NAME}_extension STATIC ${FILES})
-    target_link_libraries(${NAME}_extension duckdb_static)
+    target_link_libraries(${NAME}_extension
+        "$<$<NOT:$<BOOL:$<TARGET_PROPERTY:DUCKDB_DYNAMIC_LOADABLE_EXTENSION>>>:duckdb_static>")
     target_compile_definitions(${NAME}_extension PRIVATE DUCKDB_BUILD_STATIC_EXTENSION)
     duckdb_add_extension_describe(${NAME} ${KIND} "${API_VERSION}")
     duckdb_make_native_lto_archive(${NAME}_extension)
```

**File**: `scripts/ci/test_extension_linkage.py` (added, +75/-0)
```diff
@@ -0,0 +1,75 @@
+#!/usr/bin/env python3
+import json
+from pathlib import Path
+import shutil
+import subprocess
+import sys
+import tempfile
+import unittest
+
+
+REPO_ROOT = Path(__file__).resolve().parents[2]
+
+
+@unittest.skipUnless(shutil.which("cmake") and shutil.which("ninja"), "requires CMake and Ninja")
+class ExtensionLinkageTest(unittest.TestCase):
+    def check_linkage(self, static_build):
+        with tempfile.TemporaryDirectory() as directory:
+            build = Path(directory)
+            query = build / ".cmake/api/v1/query"
+            query.mkdir(parents=True)
+            (query / "codemodel-v2").touch()
+            result = subprocess.run(
+                [
+                    "cmake",
+                    "-S",
+                    str(REPO_ROOT),
+                    "-B",
+                    str(build),
+                    "-G",
+                    "Ninja",
+                    "-DCMAKE_BUILD_TYPE=RelWithDebInfo",
+                    "-DBUILD_EXTENSIONS=tpch",
+                    "-DSTATICALLY_LINK_EXTENSIONS=core_functions;tpch",
+                    f"-DEXTENSION_STATIC_BUILD={int(static_build)}",
+                    "-DENABLE_SANITIZER=OFF",
+                    "-DENABLE_UBSAN=OFF",
+                ],
+                capture_output=True,
+                text=True,
+            )
+            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
+            reply = build / ".cmake/api/v1/reply"
+            index = json.loads(next(reply.glob("index-*.json")).read_text())
+            model = json.loads((reply / index["reply"]["codemodel-v2"]["jsonFile"]).read_text())
+            targets = {
+                target["name"]: json.loads((reply / target["jsonFile"]).read_text())
+                for target in model["configurations"][0]["targets"]
+            }
+
+            def libraries(name):
+                return " ".join(
+                    fragment["fragment"]
+                    for fragment in targets[name]["link"]["commandFragments"]
+                    if fragment["role"] == "libraries"
+                )
+
+            tpch_libraries = libraries("tpch_loadable_extension")
+            self.assertIn("libtpch_extension.a", tpch_libraries)
+            self.assertEqual("libduckdb_static.a" in tpch_libraries, static_build, tpch_libraries)
+            # Static consumers still need the core archive after their extension archives.
+            for name, extension in (("duckdb", "tpch"), ("static_link_smoke", "parquet")):
+                linked = libraries(name)
+                self.assertIn("libduckdb_static.a", linked)
+                self.assertLess(linked.index(f"lib{extension}_extension.a"), linked.rindex("libduckdb_static.a"))
+
+    @unittest.skipIf(sys.platform == "win32", "Windows requires EXTENSION_STATIC_BUILD")
+    def test_dynamic_loadable_uses_host_duckdb(self):
+        self.check_linkage(False)
+
+    def test_static_loadable_includes_duckdb(self):
+        self.check_linkage(True)
+
+
+if __name__ == "__main__":
+    unittest.main()
```

---

### Incident Patch 7: `57c755a9` (2026-10-07)
**Commit Message**: [Parquet] Fix disabling `VARIANT` shredding in `COPY` (#26462)

This PR fixes https://github.com/duckdblabs/duckdb-internal/issues/11170

We had tests to disable shredding
(https://github.com/duckdb/duckdb/pull/22464) but those weren't properly
testing that the result wasn't shredded, nor did it have enough coverage
for the various shapes the input to the `SHREDDING` option could take.
This PR adds that missing coverage and fixes the problems encountered.

**File**: `extension/parquet/column_writer.cpp` (modified, +5/-6)
```diff
@@ -323,18 +323,17 @@ unique_ptr<ColumnWriter> ColumnWriter::CreateWriterRecursive(ClientContext &cont
 	}
 
 	if (type.id() == LogicalTypeId::VARIANT) {
-		const bool is_shredded = shredding_type != nullptr;
+		const bool is_shredded = shredding_type && shredding_type->type.id() != LogicalTypeId::SQLNULL &&
+		                         shredding_type->type.id() != LogicalTypeId::ANY;
 
 		//! Build the child types for the Parquet VARIANT
 		child_list_t<LogicalType> child_types;
 		child_types.emplace_back("metadata", LogicalType::BLOB);
 		child_types.emplace_back("value", LogicalType::BLOB);
 		if (is_shredded) {
 			auto &typed_value_type = shredding_type->type;
-			if (typed_value_type.id() != LogicalTypeId::SQLNULL) {
-				child_types.emplace_back("typed_value",
-				                         VariantColumnWriter::TransformTypedValueRecursive(typed_value_type));
-			}
+			child_types.emplace_back("typed_value",
+			                         VariantColumnWriter::TransformTypedValueRecursive(typed_value_type));
 		}
 
 		//! Construct the column schema
@@ -374,7 +373,7 @@ unique_ptr<ColumnWriter> ColumnWriter::CreateWriterRecursive(ClientContext &cont
 			                                              max_define + 1, is_optional));
 		}
 		return make_uniq<VariantColumnWriter>(writer, std::move(variant_column), path_in_schema,
-		                                      std::move(child_writers));
+		                                      std::move(child_writers), !shredding_type);
 	}
 
 	if (StructType::IsStruct(type.id()) || type.id() == LogicalTypeId::UNION) {
```

**File**: `extension/parquet/include/writer/variant_column_writer.hpp` (modified, +4/-3)
```diff
@@ -72,8 +72,9 @@ struct VariantAnalyzeSchemaState : public ParquetAnalyzeSchemaState {
 class VariantColumnWriter : public StructColumnWriter {
 public:
 	VariantColumnWriter(ParquetWriter &writer, ParquetColumnSchema &&column_schema, vector<Identifier> schema_path_p,
-	                    vector<unique_ptr<ColumnWriter>> child_writers_p)
-	    : StructColumnWriter(writer, std::move(column_schema), std::move(schema_path_p), std::move(child_writers_p)) {
+	                    vector<unique_ptr<ColumnWriter>> child_writers_p, bool auto_shred)
+	    : StructColumnWriter(writer, std::move(column_schema), std::move(schema_path_p), std::move(child_writers_p)),
+	      is_analyzed(!auto_shred) {
 	}
 	~VariantColumnWriter() override = default;
 
@@ -114,7 +115,7 @@ class VariantColumnWriter : public StructColumnWriter {
 	static LogicalType TransformTypedValueRecursive(const LogicalType &type);
 
 private:
-	//! Whether the schema of the variant has been analyzed already
+	//! Whether the schema has been analyzed or explicitly specified
 	bool is_analyzed = false;
 	ShreddingType analyzed_shredding_type;
 };
```

**File**: `extension/parquet/parquet_reader.cpp` (modified, +14/-20)
```diff
@@ -857,36 +857,30 @@ unique_ptr<ColumnReader> ParquetReader::CreateReaderRecursive(ClientContext &con
 		}
 		vector<unique_ptr<ColumnReader>> children;
 		children.resize(schema.children.size());
-		if (schema.children.size() != 3 || !column_id.IsPushdownExtract()) {
-			for (idx_t child_index = 0; child_index < schema.children.size(); child_index++) {
-				children[child_index] =
-				    CreateReaderRecursive(context, ColumnIndex(child_index), schema.children[child_index]);
+		if (schema.children.size() == 3 && column_id.IsPushdownExtract()) {
+			//! VARIANT is shredded - it has a 'typed_value' column
+			auto &typed_value_schema = schema.children[2];
+			D_ASSERT(typed_value_schema.name == "typed_value");
+			auto variant_stats = GetVariantStats(schema);
+
+			if (variant_stats && IsFullyShredded(*variant_stats, column_id)) {
+				//! This field is present in 'typed_value' across all rowgroups
+				//! So we can directly push a struct extract into 'typed_value' and ignore 'value'+'metadata'
+				auto typed_value_index = CreateVariantTypedValuePushdown(typed_value_schema, column_id);
+				return CreateReaderRecursive(context, typed_value_index, typed_value_schema);
 			}
-			return make_uniq<VariantColumnReader>(context, *this, schema, std::move(children));
 		}
-		//! VARIANT is shredded -  it has a 'typed_value' column
-		//! And the extract is pushed down into the scan
-		auto &typed_value_schema = schema.children[2];
-		D_ASSERT(typed_value_schema.name == "typed_value");
-		auto variant_stats = GetVariantStats(schema);
-
-		if (variant_stats && IsFullyShredded(*variant_stats, column_id)) {
-			//! This field is present in 'typed_value' across all rowgroups
-			//! So we can directly push a struct extract into 'typed_value' and ignore 'value'+'metadata'
-			auto typed_value_index = CreateVariantTypedValuePushdown(typed_value_schema, column_id);
-			return CreateReaderRecursive(context, typed_value_index, typed_value_schema);
-		}
-		for (idx_t child_index = 0; child_index < 3; child_index++) {
+		for (idx_t child_index = 0; child_index < schema.children.size(); child_index++) {
 			children[child_index] =
 			    CreateReaderRecursive(context, ColumnIndex(child_index), schema.children[child_index]);
 		}
 		// Create the VariantColumnReader with the column index, so we can perform the extract at Read
 		auto column_reader = make_uniq<VariantColumnReader>(context, *this, schema, std::move(children), column_id);
 
-		const auto &scan_type = column_id.GetScanType();
-		if (scan_type.id() == LogicalTypeId::VARIANT) {
+		if (!column_id.IsPushdownExtract() || column_id.GetScanType().id() == LogicalTypeId::VARIANT) {
 			return std::move(column_reader);
 		}
+		const auto &scan_type = column_id.GetScanType();
 		auto input = make_uniq<BoundReferenceExpression>(LogicalType::VARIANT(), 0ULL);
 		auto cast_expression = BoundCastExpression::AddCastToType(context, std::move(input), scan_type);
 		auto expr_schema = make_uniq<ParquetColumnSchema>(ParquetColumnSchema::FromParentSchema(
```

**File**: `extension/parquet/writer/variant/convert_variant.cpp` (modified, +2/-2)
```diff
@@ -100,7 +100,7 @@ LogicalType VariantColumnWriter::TransformTypedValueRecursive(const LogicalType
 		for (auto &entry : child_types) {
 			child_list_t<LogicalType> child_children;
 			child_children.emplace_back("value", LogicalType::BLOB);
-			if (entry.second.id() != LogicalTypeId::VARIANT) {
+			if (entry.second.id() != LogicalTypeId::VARIANT && entry.second.id() != LogicalTypeId::SQLNULL) {
 				child_children.emplace_back("typed_value", TransformTypedValueRecursive(entry.second));
 			}
 			replaced_types.emplace_back(entry.first, LogicalType::STRUCT(child_children));
@@ -111,7 +111,7 @@ LogicalType VariantColumnWriter::TransformTypedValueRecursive(const LogicalType
 		auto &child_type = ListType::GetChildType(type);
 		child_list_t<LogicalType> replaced_types;
 		replaced_types.emplace_back("value", LogicalType::BLOB);
-		if (child_type.id() != LogicalTypeId::VARIANT) {
+		if (child_type.id() != LogicalTypeId::VARIANT && child_type.id() != LogicalTypeId::SQLNULL) {
 			replaced_types.emplace_back("typed_value", TransformTypedValueRecursive(child_type));
 		}
 		return LogicalType::LIST(LogicalType::STRUCT(replaced_types));
```

**File**: `src/execution/operator/helper/physical_verify_vector.cpp` (modified, +43/-1)
```diff
@@ -56,6 +56,48 @@ struct ConstantOrSequenceInfo {
 	bool is_constant = true;
 };
 
+static const vector<Value> &GetNestedValueChildren(const Value &value) {
+	switch (value.type().InternalType()) {
+	case PhysicalType::STRUCT:
+		return StructValue::GetChildren(value);
+	case PhysicalType::LIST:
+		return ListValue::GetChildren(value);
+	case PhysicalType::ARRAY:
+		return ArrayValue::GetChildren(value);
+	default:
+		throw InternalException("Expected a nested value");
+	}
+}
+
+static bool CanShareConstantValue(const Value &left, const Value &right) {
+	if (left.type() != right.type()) {
+		return false;
+	}
+	if (left.IsNull() || right.IsNull()) {
+		return left.IsNull() == right.IsNull();
+	}
+	switch (left.type().InternalType()) {
+	case PhysicalType::STRUCT:
+	case PhysicalType::LIST:
+	case PhysicalType::ARRAY: {
+		// Compare VARIANT storage children directly to preserve payload types and object fields.
+		auto &left_children = GetNestedValueChildren(left);
+		auto &right_children = GetNestedValueChildren(right);
+		if (left_children.size() != right_children.size()) {
+			return false;
+		}
+		for (idx_t i = 0; i < left_children.size(); i++) {
+			if (!CanShareConstantValue(left_children[i], right_children[i])) {
+				return false;
+			}
+		}
+		return true;
+	}
+	default:
+		return ValueOperations::NotDistinctFrom(left, right);
+	}
+}
+
 OperatorResultType VerifyEmitSequenceVector(const DataChunk &input_p, DataChunk &chunk, OperatorState &state_p) {
 	auto &state = state_p.Cast<VerifyVectorState>();
 	D_ASSERT(state.const_idx < input_p.size());
@@ -97,7 +139,7 @@ OperatorResultType VerifyEmitSequenceVector(const DataChunk &input_p, DataChunk
 			if (info.values.empty()) {
 				info.values.push_back(std::move(val));
 			} else if (info.is_constant) {
-				if (!ValueOperations::DistinctFrom(val, info.values[0]) && can_be_constant) {
+				if (can_be_constant && CanShareConstantValue(val, info.values[0])) {
 					// found the same value! continue
 					info.values.push_back(std::move(val));
 					continue;
```

**File**: `test/parquet/variant/variant_all_types_shredded.test` (modified, +0/-9)
```diff
@@ -33,15 +33,8 @@ query I nosort expected_res
 select * from data();
 ----
 
-foreach disabled true false
-
 foreach type bool tinyint smallint int bigint date time timestamp timestamp_ns timestamp_tz float double dec_9_4 dec_18_6 dec38_10 uuid varchar blob small_enum medium_enum large_enum int_array double_array date_array timestamp_array timestamptz_array varchar_array nested_int_array struct struct_of_arrays array_of_structs
 
-onlyif disabled=true
-statement ok
-SET VARIABLE type_str = 'NULL';
-
-onlyif disabled=false
 statement ok
 SET VARIABLE type_str = (SELECT $$STRUCT("{type}" $$ || typeof("{type}") || ')' from test_all_types() limit 1);
 
@@ -59,5 +52,3 @@ select * from '{TEST_DIR}/all_types_shredded_{type}.parquet'
 ----
 
 endloop
-
-endloop
```

**File**: `test/parquet/variant/variant_basic_shredded_writing.test` (modified, +0/-26)
```diff
@@ -16,33 +16,10 @@ create macro data() AS TABLE (
 	) t(a)
 )
 
-foreach disabled true false
-
 query I nosort expected_res
 select * from data();
 ----
 
-onlyif disabled=true
-statement ok
-COPY (
-	from data() t(a)
-) TO '{TEST_DIR}/shredded_struct.parquet' (
-	shredding {
-		a: 'NULL'
-	}
-)
-
-onlyif disabled=true
-statement ok
-COPY (
-	select a from data()
-) TO '{TEST_DIR}/shredded_list.parquet' (
-	shredding {
-		a: 'NULL'
-	}
-)
-
-onlyif disabled=false
 statement ok
 COPY (
 	from data() t(a)
@@ -52,7 +29,6 @@ COPY (
 	}
 )
 
-onlyif disabled=false
 statement ok
 COPY (
 	select a from data()
@@ -69,5 +45,3 @@ select * from '{TEST_DIR}/shredded_struct.parquet';
 query I nosort expected_res
 select * from '{TEST_DIR}/shredded_list.parquet';
 ----
-
-endloop
```

**File**: `test/parquet/variant/variant_disabled_shredding.test` (added, +185/-0)
```diff
@@ -0,0 +1,185 @@
+# name: test/parquet/variant/variant_disabled_shredding.test
+# description: Disabling Parquet VARIANT shredding preserves values without typed_value columns
+# group: [variant]
+
+require parquet
+
+# SHREDDING requires a mapping from column names to types.
+foreach option NULL 'NULL' 'ANY' 'VARIANT' 42 true ['NULL']
+
+statement error
+COPY (SELECT 42::VARIANT AS v) TO '{TEST_DIR}/variant_invalid_shredding_option.parquet' (SHREDDING {option});
+----
+Binder Error: SHREDDING value should be a STRUCT of column names to types
+
+endloop
+
+# An untyped NULL is not a stringified type.
+foreach option NULL 42 true ['NULL']
+
+statement error
+COPY (SELECT 42::VARIANT AS v) TO '{TEST_DIR}/variant_invalid_shredding_option.parquet' (SHREDDING {v: {option}});
+----
+Binder Error: SHREDDING value should be of type VARCHAR
+
+endloop
+
+# ANY is an internal type, not a SQL type name.
+foreach option 'ANY' 'any'
+
+statement error
+COPY (SELECT 42::VARIANT AS v) TO '{TEST_DIR}/variant_invalid_shredding_option.parquet' (SHREDDING {v: {option}});
+----
+can not be converted to a DuckDB Type
+
+endloop
+
+statement ok
+CREATE MACRO mixed_data() AS TABLE (
+	FROM (VALUES
+		({'a': 21::INTEGER, 'b': NULL}::VARIANT),
+		({'a': 42::INTEGER, 'd': 'test'}::VARIANT),
+		([]::VARIANT),
+		(NULL::VARIANT),
+		([{'b': True, 'c': 'test'}::VARIANT, 'test', 21, {'a': True}, [1::VARIANT, 2, True, 'false']]::VARIANT),
+		('this is a long string'::VARIANT),
+		('this is big enough to not be classified as a "short string" by parquet VARIANT'::VARIANT)
+	) t(v)
+)
+
+statement ok
+CREATE MACRO all_types_data() AS TABLE (
+	SELECT unnest([*COLUMNS(*)]) AS v FROM (
+		SELECT COLUMNS([
+			x FOR x IN (*) IF x NOT IN [
+				'utinyint', 'usmallint', 'uint', 'ubigint', 'hugeint', 'uhugeint',
+				'bignum', 'time_ns', 'timestamp_s', 'timestamp_ms', 'timestamp_tz',
+				'time_tz', 'interval', 'bit', 'dec_4_1', 'timestamp_tz_ns',
+				'blob', -- Parquet VARIANT reads blobs as base64.
+				'geometry' -- Not supported yet.
+			]
+		])::VARIANT FROM test_all_types()
+	)
+)
+
+statement ok
+CREATE MACRO partial_data() AS TABLE (
+	SELECT {
+		'field1': CASE WHEN i%2=0 THEN CONCAT('hello', i)::VARIANT ELSE i::VARIANT END,
+		'field2': i::INT
+	}::VARIANT AS v
+	FROM range(5) t(i)
+)
+
+# Typed NULLs and the NULL/VARIANT type names all leave the column unshredded.
+foreach shredding_type 'NULL' 'null' NULL::VARCHAR 'VARIANT' 'variant'
+
+foreach data mixed_data all_types_data partial_data
+
+query I nosort disabled_data
+FROM {data}();
+----
+
+statement ok
+COPY (FROM {data}()) TO '{TEST_DIR}/variant_disabled_{data}.parquet' (SHREDDING {v: {shredding_type}});
+
+query I nosort disabled_data
+FROM '{TEST_DIR}/variant_disabled_{data}.parquet';
+----
+
+query III
+SELECT name, type, repetition_type
+FROM parquet_schema('{TEST_DIR}/variant_disabled_{data}.parquet')
+ORDER BY column_id;
+----
+duckdb_schema	NULL	REQUIRED
+v	NULL	OPTIONAL
+metadata	BYTE_ARRAY	REQUIRED
+value	BYTE_ARRAY	REQUIRED
+
+reset label disabled_data
+
+endloop
+
+# Each shape would be automatically shredded without the explicit type.
+foreach serialize_enabled true false
+
+statement ok
+SET debug_verify_serializer = {serialize_enabled};
+
+foreach shape 42 'hello' {'a':42} [1,2,3] NULL
+
+statement ok
+COPY (SELECT {shape}::VARIANT AS v) TO '{TEST_DIR}/variant_disabled_shape.parquet' (SHREDDING {v: {shredding_type}});
+
+query I
+SELECT count(*) FROM parquet_schema('{TEST_DIR}/variant_disabled_shape.parquet') WHERE name = 'typed_value';
+----
+0
+
+query I
+SELECT v IS NOT DISTINCT FROM {shape}::VARIANT FROM '{TEST_DIR}/variant_disabled_shape.parquet';
+----
+true
+
+statement ok
+COPY (SELECT {shape}::VARIANT AS v) TO '{TEST_DIR}/variant_auto_shape.parquet';
+
+query I
+SELECT count(*) > 0 FROM parquet_schema('{TEST_DIR}/variant_auto_shape.parquet') WHERE name = 'typed_value';
+----
+true
+
+endloop
+
+# Disabling one column leaves automatic and explicit shredding of other columns intact.
+statement ok
+COPY (
+	SELECT i::VARIANT AS disabled, i::VARIANT AS automatic, i::VARIANT AS explicit
+	FROM range(5000) t(i)
+) TO '{TEST_DIR}/variant_disabled_columns.parquet' (
+	ROW_GROUP_SIZE 2048, SHREDDING {disabled: {shredding_type}, explicit: 'BIGINT'}
+);
+
+query II
+SELECT path_in_schema, count(DISTINCT row_group_id)
+FROM parquet_metadata('{TEST_DIR}/variant_disabled_columns.parquet')
+GROUP BY path_in_schema ORDER BY path_in_schema;
+----
+automatic, metadata	3
+automatic, typed_value	3
+automatic, value	3
+disabled, metadata	3
+disabled, value	3
+explicit, metadata	3
+explicit, typed_value	3
+explicit, value	3
+
+query IIII
+SELECT count(*), min(disabled)::BIGINT, max(disabled)::BIGINT,
+       count(*) FILTER (WHERE disabled = automatic AND disabled = explicit)
+FROM '{TEST_DIR}/variant_disabled_columns.parquet';
+----
+5000	0	4999	5000
+
+# No rows must still produce an unshredded VARIANT schema.
+statement ok
+COPY (SELECT 42::VARIANT AS v WHERE false)
+TO '{T
```

---

### Incident Patch 8: `6fa6bc76` (2026-10-07)
**Commit Message**: Merge remote-tracking branch 'origin' into isducktable-fix

**File**: `src/common/operator/cast_operators.cpp` (modified, +14/-3)
```diff
@@ -1845,9 +1845,20 @@ hugeint_t CastFromUHugeintToUUID::Operation(uhugeint_t input) {
 //===--------------------------------------------------------------------===//
 template <>
 bool TryCastToGeometry::Operation(string_t input, string_t &result, Vector &result_vector, CastParameters &parameters) {
-	// Pass the query location of the cast source if available.
-	return Geometry::FromString(input, result, StringVector::GetStringHeap(result_vector), parameters.strict,
-	                            parameters.cast_source ? parameters.cast_source->GetQueryLocation() : QueryLocation());
+	auto &heap = StringVector::GetStringHeap(result_vector);
+	if (!parameters.error_message) {
+		// Pass the query location of the cast source if available.
+		return Geometry::FromString(input, result, heap, parameters.strict,
+		                            parameters.cast_source ? parameters.cast_source->GetQueryLocation()
+		                                                   : QueryLocation());
+	}
+	// the caller collects errors (e.g. TRY_CAST) - report malformed WKT as a cast error
+	string error_message;
+	if (Geometry::TryFromString(input, result, heap, error_message)) {
+		return true;
+	}
+	HandleCastError::AssignError(error_message, parameters);
+	return false;
 }
 
 //===--------------------------------------------------------------------===//
```

**File**: `src/common/types/geometry.cpp` (modified, +181/-77)
```diff
@@ -267,38 +267,38 @@ class TextReader {
 		return false; // not matched
 	}
 
-	void Match(const char *str) {
-		if (!TryMatch(str)) {
-			// Check if this would go EOF
-			if (pos + strlen(str) >= end) {
-				throw MakeError("Expected '%s' but got end of input", str);
-			}
-
-			throw MakeError("Expected '%s' but got '%c'", str, *pos);
+	bool Match(const char *str) {
+		if (TryMatch(str)) {
+			return true;
+		}
+		// Check if this would go EOF
+		if (pos + strlen(str) >= end) {
+			return SetError("Expected '%s' but got end of input", str);
 		}
+		return SetError("Expected '%s' but got '%c'", str, *pos);
 	}
 
-	void Match(char c) {
-		if (!TryMatch(c)) {
-			if (pos >= end) {
-				throw MakeError("Expected '%c' but got end of input", c);
-			}
-			throw MakeError("Expected '%c' but got '%c'", c, *pos);
+	bool Match(char c) {
+		if (TryMatch(c)) {
+			return true;
+		}
+		if (pos >= end) {
+			return SetError("Expected '%c' but got end of input", c);
 		}
+		return SetError("Expected '%c' but got '%c'", c, *pos);
 	}
 
-	double MatchNumber() {
+	bool MatchNumber(double &num) {
 		// Now use fast_float to parse the number
-		double num;
 		const auto res = duckdb_fast_float::from_chars(pos, end, num);
 		if (res.ec != std::errc()) {
-			throw MakeError("Expected number");
+			return SetError("Expected number");
 		}
 
 		pos = res.ptr; // update position to the end of the parsed number
 
 		SkipWhitespace(); // remove trailing whitespace
-		return num;       // return the parsed number
+		return true;
 	}
 
 	idx_t GetPosition() const {
@@ -314,18 +314,25 @@ class TextReader {
 		pos = beg;
 	}
 
+	//! Records a parse error at the current position, always returns false
 	template <class... ARGS>
-	InvalidInputException MakeError(const char *raw_msg, ARGS... args) const {
-		const auto byte_offset = UnsafeNumericCast<idx_t>(pos - beg);
-		auto msg = StringUtil::Format("Failed to parse geometry: %s at offset %lu",
-		                              StringUtil::Format(raw_msg, args...), byte_offset);
+	bool SetError(const char *raw_msg, ARGS... args) {
+		error_message = StringUtil::Format(raw_msg, args...);
+		error_offset = UnsafeNumericCast<idx_t>(pos - beg);
+		return false;
+	}
+
+	string GetErrorMessage() const {
+		return StringUtil::Format("Failed to parse geometry: %s at offset %lu", error_message, error_offset);
+	}
+
+	InvalidInputException MakeError() const {
 		if (query_location.IsValid()) {
 			// point at the specific byte within the WKT literal where parsing failed
-			const QueryLocation expr_location(query_location.Start() + byte_offset, 0);
-			return InvalidInputException(Exception::InitializeExtraInfo(expr_location), msg);
-		} else {
-			return InvalidInputException(msg);
+			const QueryLocation expr_location(query_location.Start() + error_offset, 0);
+			return InvalidInputException(Exception::InitializeExtraInfo(expr_location), GetErrorMessage());
 		}
+		return InvalidInputException(GetErrorMessage());
 	}
 
 	void SetQueryLocation(QueryLocation location) {
@@ -343,21 +350,31 @@ class TextReader {
 	const char *pos;
 	const char *end;
 	QueryLocation query_location;
+	string error_message;
+	idx_t error_offset = 0;
 };
 
-void FromStringRecursive(TextReader &reader, BlobWriter &writer, uint32_t depth, bool parent_has_z, bool parent_has_m) {
+//! Returns false if the text is not valid WKT, the error is recorded in the reader
+bool FromStringRecursive(TextReader &reader, BlobWriter &writer, uint32_t depth, bool parent_has_z, bool parent_has_m) {
 	if (depth == Geometry::MAX_RECURSION_DEPTH) {
-		throw reader.MakeError("Geometry string exceeds maximum recursion depth of %d", Geometry::MAX_RECURSION_DEPTH);
+		return reader.SetError("Geometry string exceeds maximum recursion depth of %d", Geometry::MAX_RECURSION_DEPTH);
 	}
 
 	// Skip leading whitespace
 	reader.SkipWhitespace();
 
 	// EWKT dialect (ignore SRID if present)
 	if (reader.TryMatch("SRID")) {
-		reader.Match('=');
-		reader.MatchNumber();
-		reader.Match(';');
+		if (!reader.Match('=')) {
+			return false;
+		}
+		double srid;
+		if (!reader.MatchNumber(srid)) {
+			return false;
+		}
+		if (!reader.Match(';')) {
+			return false;
+		}
 	}
 
 	GeometryType type = GeometryType::INVALID;
@@ -377,7 +394,7 @@ void FromStringRecursive(TextReader &reader, BlobWriter &writer, uint32_t depth,
 	} else if (reader.TryMatch("geometrycollection")) {
 		type = GeometryType::GEOMETRYCOLLECTION;
 	} else {
-		throw reader.MakeError("Unknown geometry type");
+		return reader.SetError("Unknown geometry type");
 	}
 
 	const auto has_z = reader.TryMatch("z");
@@ -386,7 +403,7 @@ void FromStringRecursive(TextReader &reader, BlobWriter &writer, uint32_t depth,
 	const auto is_empty = reader.TryMatch("empty");
 
 	if ((depth != 0) && ((parent_has_z != has_z) || (parent_has_m != has_m))) {
-		throw reader.MakeError("Geometry has inconsistent Z/M dimensions");
+		return reader.SetError("Geometry has inconsistent Z/M dimensions");
 	}
 
 	// How
```

**File**: `src/common/types/variant/parquet_variant_iterator.cpp` (modified, +24/-6)
```diff
@@ -568,18 +568,36 @@ VariantDecimalProperties ParquetVariantNode::GetDecimalProperties() const {
 	auto value_metadata = VariantValueMetadata::FromHeaderByte(binary[0]);
 	auto payload = binary + 1;
 	uint8_t scale = LoadChecked<uint8_t>(payload, binary_end);
+	if (scale > Decimal::MAX_WIDTH_DECIMAL) {
+		throw IOException("Corrupted VARIANT 'value' buffer, decimal scale %d exceeds the maximum of %d", scale,
+		                  Decimal::MAX_WIDTH_DECIMAL);
+	}
 	auto value_data = payload + sizeof(uint8_t);
+	uint32_t width;
 	switch (value_metadata.primitive_type) {
 	case VariantPrimitiveType::DECIMAL4:
-		return VariantDecimalProperties(ComputeDecimalWidth<int32_t>(LoadChecked<int32_t>(value_data, binary_end)),
-		                                scale);
+		width = ComputeDecimalWidth<int32_t>(LoadChecked<int32_t>(value_data, binary_end));
+		break;
 	case VariantPrimitiveType::DECIMAL8:
-		return VariantDecimalProperties(ComputeDecimalWidth<int64_t>(LoadChecked<int64_t>(value_data, binary_end)),
-		                                scale);
-	default:
+		width = ComputeDecimalWidth<int64_t>(LoadChecked<int64_t>(value_data, binary_end));
+		break;
+	default: {
 		D_ASSERT(value_metadata.primitive_type == VariantPrimitiveType::DECIMAL16);
-		return VariantDecimalProperties(DecimalWidth<hugeint_t>::max, scale);
+		CheckBinaryRead(value_data, sizeof(hugeint_t), binary_end);
+		hugeint_t value;
+		value.lower = Load<uint64_t>(value_data);
+		value.upper = Load<int64_t>(value_data + sizeof(uint64_t));
+		auto &limit = Hugeint::POWERS_OF_TEN[Decimal::MAX_WIDTH_DECIMAL];
+		if (value >= limit || value <= -limit) {
+			throw IOException("Corrupted VARIANT 'value' buffer, DECIMAL16 value exceeds the maximum width of %d",
+			                  Decimal::MAX_WIDTH_DECIMAL);
+		}
+		width = Decimal::MAX_WIDTH_DECIMAL;
+		break;
+	}
 	}
+	//! The scale can exceed the digits of the unscaled value (e.g. 0.005), the width must cover it
+	return VariantDecimalProperties(MaxValue<uint32_t>(width, scale), scale);
 }
 
 ParquetObjectIterator ParquetVariantNode::GetObjectChildren(VariantIterationOrder order) const {
```

**File**: `src/common/types/vector_buffer.cpp` (modified, +2/-2)
```diff
@@ -321,7 +321,7 @@ void VectorBuffer::Copy(const Vector &source_p, const SelectionVector &source_se
 			auto &dict_sel = DictionaryVector::SelVector(source);
 			// merge the selection vectors and verify the child
 			if (sel.IsSet()) {
-				auto new_buffer = dict_sel.Slice(sel, copy_count);
+				auto new_buffer = dict_sel.Slice(sel, source_offset + copy_count);
 				owned_sel.Initialize(new_buffer);
 				sel_ref = owned_sel;
 			} else {
@@ -331,7 +331,7 @@ void VectorBuffer::Copy(const Vector &source_p, const SelectionVector &source_se
 			break;
 		}
 		case VectorType::CONSTANT_VECTOR:
-			sel_ref = *ConstantVector::ZeroSelectionVector(copy_count, owned_sel);
+			sel_ref = *ConstantVector::ZeroSelectionVector(source_offset + copy_count, owned_sel);
 			finished = true;
 			break;
 		case VectorType::FLAT_VECTOR:
```

**File**: `src/execution/physical_plan/plan_window.cpp` (modified, +2/-1)
```diff
@@ -31,14 +31,15 @@ PhysicalOperator &PhysicalPlanGenerator::CreatePlan(LogicalWindow &op) {
 	// Identify streaming windows and partitioned windows
 	using Columns = vector<column_t>;
 	const bool enable_optimizer = Settings::Get<EnableOptimizerSetting>(context);
+	const bool can_stream = enable_optimizer && (plan.get().GetSources().size() == 1);
 	vector<idx_t> blocking_windows;
 	vector<idx_t> streaming_windows;
 	vector<idx_t> partitioned_windows;
 	vector<Columns> partitioned_columns;
 	for (idx_t expr_idx = 0; expr_idx < op.expressions.size(); expr_idx++) {
 		auto &wexpr = op.expressions[expr_idx]->Cast<BoundWindowExpression>();
 		Columns partition_columns;
-		if (enable_optimizer && PhysicalStreamingWindow::IsStreamingFunction(context, wexpr)) {
+		if (can_stream && PhysicalStreamingWindow::IsStreamingFunction(context, wexpr)) {
 			streaming_windows.push_back(expr_idx);
 		} else if (!wexpr.Partitions().empty() &&
 		           HasSingleValuePartitions(context, wexpr.Partitions(), plan, partition_columns)) {
```

**File**: `src/function/aggregate/sorted_aggregate_function.cpp` (modified, +15/-0)
```diff
@@ -555,6 +555,21 @@ pair<AggregateFunction, unique_ptr<FunctionData>>
 FunctionBinder::BindSortedAggregateState(ClientContext &context, const BoundAggregateFunction &inner_function,
                                          unique_ptr<FunctionData> inner_bind_info, const LogicalType &buffer_struct,
                                          const vector<SortedAggregateStateOrder> &orders, idx_t argument_count) {
+	// the leading buffered columns are passed to the inner aggregate as-is - they must have its argument types
+	auto &buffer_columns = StructType::GetChildTypes(buffer_struct);
+	auto &inner_arguments = inner_function.GetArguments();
+	if (argument_count != inner_arguments.size() || argument_count > buffer_columns.size()) {
+		throw BinderException("Aggregate state for \"%s\" has %llu state columns, expected at least %llu",
+		                      inner_function.GetName(), (uint64_t)buffer_columns.size(),
+		                      (uint64_t)inner_arguments.size());
+	}
+	for (idx_t i = 0; i < argument_count; i++) {
+		if (inner_arguments[i].IsComplete() && buffer_columns[i].second != inner_arguments[i]) {
+			throw BinderException("Aggregate state for \"%s\" has state column %llu of type %s, expected %s",
+			                      inner_function.GetName(), (uint64_t)i, buffer_columns[i].second.ToString(),
+			                      inner_arguments[i].ToString());
+		}
+	}
 	const auto null_handling = inner_function.GetProperties().GetNullHandling();
 	auto bind_data = make_uniq<SortedAggregateBindData>(context, inner_function, std::move(inner_bind_info),
 	                                                    buffer_struct, orders, argument_count);
```

**File**: `src/function/cast/union_casts.cpp` (modified, +40/-14)
```diff
@@ -210,16 +210,28 @@ static bool ToUnionMemberCast(Vector &source, Vector &result, idx_t count, CastP
 	auto member_cast_info = cast_data.member_casts[0].Copy();
 
 	CastParameters child_parameters(parameters, member_cast_info.GetCastData(), parameters.local_state);
-	if (!member_cast_info.Cast(source, selected_member_vector, count, child_parameters)) {
-		return false;
-	}
-
-	// cast succeeded, create union vector
+	bool all_converted = member_cast_info.Cast(source, selected_member_vector, count, child_parameters);
 	UnionVector::SetToMember(result, cast_data.tag_map[0], selected_member_vector, count, true);
+	if (!all_converted) {
+		// rows that failed to cast (under TRY_CAST) are NULL in the member - make the union NULL as well
+		auto source_validity = source.Validity();
+		auto member_validity = selected_member_vector.Validity();
+		if (result.GetVectorType() == VectorType::CONSTANT_VECTOR) {
+			if (source_validity.IsValid(0) && !member_validity.IsValid(0)) {
+				ConstantVector::SetNull(result, count_t(count));
+			}
+		} else {
+			for (idx_t row_idx = 0; row_idx < count; row_idx++) {
+				if (source_validity.IsValid(row_idx) && !member_validity.IsValid(row_idx)) {
+					FlatVector::SetNull(result, row_idx, true);
+				}
+			}
+		}
+	}
 
 	result.Verify();
 
-	return true;
+	return all_converted;
 }
 
 static bool UnionMemberToMemberCast(Vector &source, Vector &result, idx_t count, CastParameters &parameters) {
@@ -232,6 +244,7 @@ static bool UnionMemberToMemberCast(Vector &source, Vector &result, idx_t count,
 	auto target_member_is_mapped = vector<bool>(target_member_count);
 
 	// Perform the casts from source to target members
+	bool all_converted = true;
 	for (idx_t member_idx = 0; member_idx < source_member_count; member_idx++) {
 		auto target_member_idx = cast_data.tag_map[member_idx];
 
@@ -241,14 +254,12 @@ static bool UnionMemberToMemberCast(Vector &source, Vector &result, idx_t count,
 
 		CastParameters child_parameters(parameters, member_cast.GetCastData(), lstate.local_states[member_idx]);
 		if (!member_cast.Cast(source_member_vector, target_member_vector, count, child_parameters)) {
-			return false;
+			all_converted = false;
 		}
 
 		target_member_is_mapped[target_member_idx] = true;
 	}
 
-	// All member casts succeeded!
-
 	// Set the unmapped target members to constant NULL.
 	// If we cast UNION(A, B) -> UNION(A, B, C) we need to invalidate C so that
 	// the invariants of the result union hold. (only member columns "selected"
@@ -275,6 +286,11 @@ static bool UnionMemberToMemberCast(Vector &source, Vector &result, idx_t count,
 			auto source_tag = ConstantVector::GetData<union_tag_t>(source_tag_vector)[0];
 			auto mapped_tag = cast_data.tag_map[source_tag];
 			ConstantVector::GetData<union_tag_t>(result_tag_vector)[0] = UnsafeNumericCast<union_tag_t>(mapped_tag);
+			// the selected member failed to cast (under TRY_CAST) - the union becomes NULL
+			if (!all_converted && UnionVector::GetMember(source, source_tag).Validity().IsValid(0) &&
+			    !UnionVector::GetMember(result, mapped_tag).Validity().IsValid(0)) {
+				ConstantVector::SetNull(result, count_t(count));
+			}
 		}
 	} else {
 		// Otherwise, use the unified vector format to access the source vector.
@@ -288,6 +304,13 @@ static bool UnionMemberToMemberCast(Vector &source, Vector &result, idx_t count,
 
 		// We assume that a union tag vector validity matches the union vector validity.
 		auto source_tag_entries = source_tag_vector.Values<union_tag_t>();
+		vector<unique_ptr<VectorValidityIterator>> source_member_validity;
+		if (!all_converted) {
+			for (idx_t member_idx = 0; member_idx < source_member_count; member_idx++) {
+				source_member_validity.push_back(
+				    make_uniq<VectorValidityIterator>(UnionVector::GetMember(source, member_idx)));
+			}
+		}
 
 		for (idx_t row_idx = 0; row_idx < count; row_idx++) {
 			auto entry = source_tag_entries[row_idx];
@@ -296,6 +319,11 @@ static bool UnionMemberToMemberCast(Vector &source, Vector &result, idx_t count,
 				auto target_tag = cast_data.tag_map[entry.GetValue()];
 				FlatVector::GetDataMutable<union_tag_t>(result_tag_vector)[row_idx] =
 				    UnsafeNumericCast<union_tag_t>(target_tag);
+				// the selected member failed to cast (under TRY_CAST) - the union becomes NULL
+				if (!all_converted && source_member_validity[entry.GetValue()]->IsValid(row_idx) &&
+				    !FlatVector::Validity(UnionVector::GetMember(result, target_tag)).RowIsValid(row_idx)) {
+					FlatVector::SetNull(result, row_idx, true);
+				}
 			} else {
 				// Issue: The members of the result is not always flatvectors
 				// In the case of TryNullCast, the result member is constant.
@@ -307,19 +335,17 @@ static bool UnionMemberToMemberCast(Vector &source, Vector &result, idx_t count,
 	FlatVector::SetSize(result, count_t(count));
 	result.Verify();
 
-	return true;
+	return all_converted;
 }
 
 static bool ToUnionCast(Vector &source, Vector &result, idx_t count, CastParamet
```

**File**: `src/function/scalar/struct/struct_contains.cpp` (modified, +10/-10)
```diff
@@ -221,20 +221,20 @@ static unique_ptr<FunctionData> StructContainsBind(BindScalarFunctionInput &inpu
 
 	// the value type must match one of the struct's children
 	LogicalType max_child_type = arguments[1]->GetReturnType();
-	vector<LogicalType> new_child_types;
+	vector<bool> compatible_children;
 	for (auto &child : struct_children) {
-		if (!LogicalType::TryGetMaxLogicalType(context, child.second, max_child_type, max_child_type)) {
-			new_child_types.push_back(child.second);
-			continue;
-		}
-
-		new_child_types.push_back(max_child_type);
-		bound_function.GetArguments()[1] = max_child_type;
+		compatible_children.push_back(
+		    LogicalType::TryGetMaxLogicalType(context, child.second, max_child_type, max_child_type));
 	}
 
+	// cast all compatible children to the final max type
 	child_list_t<LogicalType> cast_children;
-	for (idx_t i = 0; i < new_child_types.size(); i++) {
-		cast_children.push_back(make_pair(struct_children[i].first, new_child_types[i]));
+	for (idx_t i = 0; i < struct_children.size(); i++) {
+		auto &child = struct_children[i];
+		cast_children.push_back(make_pair(child.first, compatible_children[i] ? max_child_type : child.second));
+		if (compatible_children[i]) {
+			bound_function.GetArguments()[1] = max_child_type;
+		}
 	}
 
 	// the input is an unnamed struct - represent it as a TUPLE
```

---

### Incident Patch 9: `fae06497` (2026-10-07)
**Commit Message**: Stabilize parquet_prefetch_tracked_memory test (#26653)

`test/sql/copy/parquet/parquet_prefetch_tracked_memory.test` fails
intermittently in CI (seen on several unrelated PRs and on a
default-branch run), always in the second half:

```
Query unexpectedly failed (test/sql/copy/parquet/parquet_prefetch_tracked_memory.test:32)
Out of Memory Error: failed to allocate data of size 64.0 MiB (189.1 MiB/228.8 MiB used)
```

under `--verify-vector constant_operator` (Execution group),
`latest_storage.json` (Persistence group) and the Query Verification
group. It usually passes on the automatic retry.

### Cause
The test pins a memory-fit boundary: a prefetching scan must OOM where
synchronous reads fit. With a 64MB row group and a 240MB limit both
margins are thin. Bisecting the limit with the current code gives:

| row group | prefetch still OOMs up to | synchronous read alone needs |
|---|---|---|
| 64MB (16M rows, current) | ~262MB | < 120MB |
| 128MB (32M rows) | ~323MB | < 120MB |
| 256MB (64M rows) | ~455MB | < 120MB |

So at 240MB the first half has ~24MB of margin, and the second half runs
in the same connection right after the failed query, so whatever that
query still holds (~18

**File**: `test/sql/copy/parquet/parquet_prefetch_tracked_memory.test` (modified, +18/-7)
```diff
@@ -4,8 +4,10 @@
 
 require parquet
 
-# this test calibrates exact memory-fit boundaries (the prefetch span must not fit, the synchronous
-# reads must fit), alternative-verify builds, small vectors and parallel scans shift both sides of that margin
+# this test calibrates memory-fit boundaries (the prefetch span must not fit, the synchronous
+# reads must fit). The file is large enough that both sides have ample margin: with a 256MB row
+# group span, prefetching needs well over 450MB while the synchronous reads need less than 120MB.
+# Alternative-verify builds and small vectors shift the margins, so they are excluded.
 require vector_size 2048
 
 require no_alternative_verify
@@ -14,22 +16,31 @@ statement ok
 set threads=1;
 
 statement ok
-copy (select range i from range(16000000)) to '{TEST_DIR}/prefetch_tracked_big.parquet' (ROW_GROUP_SIZE 16000000);
+copy (select range i from range(64000000)) to '{TEST_DIR}/prefetch_tracked_big.parquet' (ROW_GROUP_SIZE 64000000);
 
-# prefetch pins the full ~64MB row group span on top of the decode memory, so it OOMs where sync reads fit
+# prefetch pins the full ~256MB row group span on top of the decode memory, so it OOMs where sync reads fit
 statement ok
-set memory_limit='240mb';
+set memory_limit='360mb';
 
 statement error
 select count(*), sum(i) from '{TEST_DIR}/prefetch_tracked_big.parquet';
 ----
 Out of Memory
 
-# disabling prefetching reads the file in small synchronous chunks, which fits in the memory limit
+# start from a clean buffer pool so nothing the failed query still holds is counted against the sync reads
+restart
+
+statement ok
+set threads=1;
+
+statement ok
+set memory_limit='360mb';
+
+# disabling prefetching reads the file in small synchronous chunks, which fits comfortably in the memory limit
 statement ok
 set disable_parquet_prefetching=true;
 
 query II
 select count(*), sum(i) from '{TEST_DIR}/prefetch_tracked_big.parquet';
 ----
-16000000	127999992000000
+64000000	2047999968000000
```

---

### Incident Patch 10: `67ec9ec6` (2026-10-07)
**Commit Message**: [Dev] Fix randomly failing `mode_tpch.test_slow` (#26541)

Introduce tie-break with ORDER BY l_comment.

This failure was caused by
https://github.com/duckdb/duckdb/commit/e909c8d1762a46ec86af31cfe5a3d8a7a0d145b6
introducing a change to the generated TPCH data that ended up making "
furiously" and " carefully" have the same amount of entries on this
query.

**File**: `test/sql/aggregate/aggregates/mode_tpch.test_slow` (modified, +3/-2)
```diff
@@ -7,11 +7,12 @@ require tpch
 statement ok
 CALL dbgen(sf=1);
 
+# Break ties by comment value.
 query II
-select l_returnflag, mode(l_comment) from lineitem where l_returnflag <> 'N' group by l_returnflag;
+select l_returnflag, mode(l_comment ORDER BY l_comment) from lineitem where l_returnflag <> 'N' group by l_returnflag order by l_returnflag;
 ----
 A	 furiously
-R	 furiously
+R	 carefully
 
 # run a windowed mode
 query I
```

---

### Incident Patch 11: `fa07ea06` (2026-10-07)
**Commit Message**: Fix register issue in zstd for clang-cl on win32

**File**: `.github/workflows/Windows.yml` (modified, +12/-0)
```diff
@@ -178,6 +178,9 @@ jobs:
     runs-on: ${{ fromJSON(inputs.runners).windows_2022_x64 || 'windows-2022' }}
     env:
       GEN: ninja
+      CC: clang-cl
+      CXX: clang-cl
+      EXTRA_CMAKE_VARIABLES: -DCMAKE_C_COMPILER_TARGET=i686-pc-windows-msvc -DCMAKE_CXX_COMPILER_TARGET=i686-pc-windows-msvc
 
     steps:
     - name: "Checkout"
@@ -201,8 +204,17 @@ jobs:
     - name: Build
       shell: bash
       run: |
+        clang-cl --version
         python scripts/ci/retry.py -- make windows_release_32
 
+    - name: Verify compiler
+      shell: pwsh
+      run: |
+        $commands = Get-Content compile_commands.json -Raw
+        if (!$commands.Contains('clang-cl')) {
+          throw 'Windows 32-bit compile commands are not using clang-cl'
+        }
+
     - name: Test
       shell: bash
       if: ${{ !inputs.skip_tests }}
```

**File**: `third_party/zstd/include/zstd/common/cpu.h` (modified, +1/-1)
```diff
@@ -37,7 +37,7 @@ MEM_STATIC ZSTD_cpuid_t ZSTD_cpuid(void) {
     U32 f7b = 0;
     U32 f7c = 0;
 #if defined(_MSC_VER) && (defined(_M_X64) || defined(_M_IX86))
-#if !defined(__clang__)
+#if !defined(_M_X64) || !defined(__clang__) || __clang_major__ >= 16
     int reg[4];
     __cpuid((int*)reg, 0);
     {
```

---

### Incident Patch 12: `14aab908` (2026-10-07)
**Commit Message**: Fix copying from a constant vector at an offset beyond the standard vector size (#26524)

`VectorBuffer::Copy` reads the source selection at `source_offset ..
source_offset + copy_count`, but for a constant source it used a zero
selection sized for only `copy_count` entries, and for a dictionary
source it merged only the first `copy_count` entries of the selection.
When copying from a constant vector at an offset of 2048 or more (e.g.
row by row in the STRUCT -> MAP cast, or in map element extraction) this
read past the end of the global zero selection, and the resulting
garbage index was then used to read from the constant's data:

```sql
SELECT x[2049]['b'] FROM (SELECT list({'a': NULL, 'b': i})::MAP(VARCHAR, INT)[] x FROM range(2049) t(i));
-- Segmentation fault

SELECT m['2048'] FROM (SELECT map(list(i::VARCHAR), list(NULL))::MAP(VARCHAR, INT) m FROM range(2049) t(i));
-- Segmentation fault
```

Both selections now cover `source_offset + copy_count` entries.

**File**: `src/common/types/vector_buffer.cpp` (modified, +2/-2)
```diff
@@ -321,7 +321,7 @@ void VectorBuffer::Copy(const Vector &source_p, const SelectionVector &source_se
 			auto &dict_sel = DictionaryVector::SelVector(source);
 			// merge the selection vectors and verify the child
 			if (sel.IsSet()) {
-				auto new_buffer = dict_sel.Slice(sel, copy_count);
+				auto new_buffer = dict_sel.Slice(sel, source_offset + copy_count);
 				owned_sel.Initialize(new_buffer);
 				sel_ref = owned_sel;
 			} else {
@@ -331,7 +331,7 @@ void VectorBuffer::Copy(const Vector &source_p, const SelectionVector &source_se
 			break;
 		}
 		case VectorType::CONSTANT_VECTOR:
-			sel_ref = *ConstantVector::ZeroSelectionVector(copy_count, owned_sel);
+			sel_ref = *ConstantVector::ZeroSelectionVector(source_offset + copy_count, owned_sel);
 			finished = true;
 			break;
 		case VectorType::FLAT_VECTOR:
```

**File**: `test/sql/cast/test_copy_constant_vector_offset.test` (added, +53/-0)
```diff
@@ -0,0 +1,53 @@
+# name: test/sql/cast/test_copy_constant_vector_offset.test
+# description: Copy from a constant vector at an offset beyond the standard vector size
+# group: [cast]
+
+query I
+SELECT count(*) FROM (SELECT TRY_CAST(l AS MAP(VARCHAR, INTEGER)[]) x FROM (SELECT list({'a': [i::INT]}) l FROM range(3000) t(i)));
+----
+1
+
+query I
+SELECT bool_and(x[1]['a'] IS NULL) FROM (SELECT TRY_CAST(l AS MAP(VARCHAR, INTEGER)[]) x FROM (SELECT list({'a': [i::INT]}) l FROM range(2049) t(i)));
+----
+true
+
+query I
+SELECT bool_and(x[2999]['a'] IS NULL) FROM (SELECT TRY_CAST(l AS MAP(VARCHAR, UUID)[]) x FROM (SELECT list({'a': i::INT, 'b': i::INT}) l FROM range(3000) t(i)));
+----
+true
+
+query I
+SELECT max(length(x::VARCHAR)) FROM (SELECT TRY_CAST(l AS MAP(VARCHAR, INT)[][]) x FROM (SELECT list([{'a': [i::INT]}]) l FROM range(3000) t(i)));
+----
+36000
+
+query I
+SELECT max(length(u::MAP(VARCHAR, VARCHAR)[]::VARCHAR)) FROM (SELECT TRY_CAST(l AS STRUCT(a INT, b VARCHAR)[]) u FROM (SELECT list(i) l FROM range(5000) t(i)));
+----
+30000
+
+query I
+SELECT m['2048'] IS NULL FROM (SELECT TRY_CAST(map_from_entries(list({'k': i::VARCHAR, 'v': i::INT})) AS MAP(VARCHAR, UUID)) m FROM range(2049) t(i));
+----
+true
+
+query I
+SELECT x[2049]['b'] FROM (SELECT list({'a': NULL, 'b': i})::MAP(VARCHAR, INT)[] x FROM range(2049) t(i));
+----
+2048
+
+query I
+SELECT x[2049]['a'] IS NULL FROM (SELECT list({'a': NULL, 'b': i})::MAP(VARCHAR, INT)[] x FROM range(2049) t(i));
+----
+true
+
+query I
+SELECT m['2048'] IS NULL FROM (SELECT map(list(i::VARCHAR), list(NULL))::MAP(VARCHAR, INT) m FROM range(2049) t(i));
+----
+true
+
+query I
+SELECT len(list({'a': NULL, 'b': i})::MAP(VARCHAR, INT)[]::VARCHAR) FROM range(3000) t(i);
+----
+52890
```

---

### Incident Patch 13: `28fa83eb` (2026-10-07)
**Commit Message**: Stabilize parquet_prefetch_tracked_memory test

The test calibrates a memory-fit boundary: a prefetching scan must run out of
memory where synchronous reads fit. With a 64MB row group and a 240MB limit the
margins were thin on both sides, and CI intermittently failed the synchronous
half with "failed to allocate data of size 64.0 MiB (189.1 MiB/228.8 MiB used)"
under the vector-verification and storage test configurations, where memory the
failed prefetching query still held was counted against the limit.

Changes:
- use a 256MB row group (64M rows) and a 360MB limit: prefetching now needs over
  450MB and fails with a ~95MB margin, while the synchronous reads need less than
  120MB (measured by bisecting the limit in normal and vector-verification modes);
- restart between the two halves so the synchronous reads start from a clean
  buffer pool instead of depending on when the failed query releases its memory.

The test takes about one second.

**File**: `test/sql/copy/parquet/parquet_prefetch_tracked_memory.test` (modified, +18/-7)
```diff
@@ -4,8 +4,10 @@
 
 require parquet
 
-# this test calibrates exact memory-fit boundaries (the prefetch span must not fit, the synchronous
-# reads must fit), alternative-verify builds, small vectors and parallel scans shift both sides of that margin
+# this test calibrates memory-fit boundaries (the prefetch span must not fit, the synchronous
+# reads must fit). The file is large enough that both sides have ample margin: with a 256MB row
+# group span, prefetching needs well over 450MB while the synchronous reads need less than 120MB.
+# Alternative-verify builds and small vectors shift the margins, so they are excluded.
 require vector_size 2048
 
 require no_alternative_verify
@@ -14,22 +16,31 @@ statement ok
 set threads=1;
 
 statement ok
-copy (select range i from range(16000000)) to '{TEST_DIR}/prefetch_tracked_big.parquet' (ROW_GROUP_SIZE 16000000);
+copy (select range i from range(64000000)) to '{TEST_DIR}/prefetch_tracked_big.parquet' (ROW_GROUP_SIZE 64000000);
 
-# prefetch pins the full ~64MB row group span on top of the decode memory, so it OOMs where sync reads fit
+# prefetch pins the full ~256MB row group span on top of the decode memory, so it OOMs where sync reads fit
 statement ok
-set memory_limit='240mb';
+set memory_limit='360mb';
 
 statement error
 select count(*), sum(i) from '{TEST_DIR}/prefetch_tracked_big.parquet';
 ----
 Out of Memory
 
-# disabling prefetching reads the file in small synchronous chunks, which fits in the memory limit
+# start from a clean buffer pool so nothing the failed query still holds is counted against the sync reads
+restart
+
+statement ok
+set threads=1;
+
+statement ok
+set memory_limit='360mb';
+
+# disabling prefetching reads the file in small synchronous chunks, which fits comfortably in the memory limit
 statement ok
 set disable_parquet_prefetching=true;
 
 query II
 select count(*), sum(i) from '{TEST_DIR}/prefetch_tracked_big.parquet';
 ----
-16000000	127999992000000
+64000000	2047999968000000
```

---

### Incident Patch 14: `9ca2c4ff` (2026-10-07)
**Commit Message**: Fix out-of-bound access for column segment

**File**: `src/storage/table/column_data.cpp` (modified, +2/-1)
```diff
@@ -268,10 +268,11 @@ void ColumnData::SelectVector(ColumnScanState &state, Vector &result, idx_t targ
 		throw InternalException("ColumnData::SelectVector should be able to fetch everything from one segment");
 	}
 	if (state.scan_options && state.scan_options->force_fetch_row) {
+		auto start = state.GetPositionInSegment();
 		for (idx_t i = 0; i < sel_count; i++) {
 			auto source_idx = sel.get_index(i);
 			ColumnFetchState fetch_state;
-			current.FetchRow(fetch_state, UnsafeNumericCast<row_t>(state.offset_in_column + source_idx), result, i);
+			current.FetchRow(fetch_state, UnsafeNumericCast<row_t>(start + source_idx), result, i);
 		}
 	} else {
 		current.Select(state, target_count, result, sel, sel_count);
```

**File**: `test/sql/storage/compression/rle/rle_select_force_fetch_row.test` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+# name: test/sql/storage/compression/rle/rle_select_force_fetch_row.test
+# description: Filtered scans with debug_force_fetch_row must fetch rows relative to the segment start
+# group: [rle]
+
+load {TEST_DIR}/rle_select_force_fetch_row.db
+
+statement ok
+SET force_compression='rle';
+
+statement ok
+CREATE TABLE t AS SELECT i, i::BIGINT AS x FROM range(100000) r(i);
+
+statement ok
+CHECKPOINT
+
+restart
+
+# the column spans multiple segments within a single row group
+query I
+SELECT count(*) > 1 FROM pragma_storage_info('t') WHERE column_name = 'x' AND segment_type = 'BIGINT';
+----
+true
+
+statement ok
+SET debug_force_fetch_row = true;
+
+# the filter on i selects rows that live in a later segment of x
+query II
+SELECT count(*), sum(x) FROM t WHERE i BETWEEN 60000 AND 60010;
+----
+11	660055
```

---

### Incident Patch 15: `86be5722` (2026-10-07)
**Commit Message**: Fix #26433: Do not drop filter when LIKE/ILIKE pattern is NULL (#26469)

In FilterCombiner::TryPushdownLikeFilter, a NULL constant pattern
previously pushed an OPERATOR_IS_NOT_NULL filter and returned
PUSHED_DOWN_FULLY. This erroneously allowed all non-null rows to match
and dropped the original predicate from the plan. When the pattern is
NULL, return NO_PUSHDOWN so the filter is retained and evaluated under
three-valued SQL logic.

Additionally, update LikeOptimizationRule to include ILIKE operators
('~~*' and '!~~*') so constant NULL patterns are folded to NULL
identically to LIKE.

**File**: `src/optimizer/filter_combiner.cpp` (modified, +1/-6)
```diff
@@ -568,13 +568,8 @@ FilterPushdownResult FilterCombiner::TryPushdownLikeFilter(TableFilterSet &table
 	auto &constant_value_expr = func.GetChildren()[1]->Cast<BoundConstantExpression>();
 	auto proj_index = column_ref.Binding().column_index;
 
-	// constant value expr can sometimes be null. if so, push is not null filter, which will
-	// make the filter unsatisfiable and return no results.
 	if (constant_value_expr.GetValue().IsNull()) {
-		auto is_not_null = ExpressionFilter::CreateNullCheckExpression(
-		    CreateFilterTargetExpression(*func.GetChildren()[0]), ExpressionType::OPERATOR_IS_NOT_NULL);
-		table_filters.PushFilter(proj_index, make_uniq<ExpressionFilter>(std::move(is_not_null)));
-		return FilterPushdownResult::PUSHED_DOWN_FULLY;
+		return FilterPushdownResult::NO_PUSHDOWN;
 	}
 	auto &like_string = StringValue::Get(constant_value_expr.GetValue());
 	if (like_string[0] == '%' || like_string[0] == '_') {
```

**File**: `src/optimizer/rule/like_optimizations.cpp` (modified, +9/-3)
```diff
@@ -17,9 +17,10 @@ LikeOptimizationRule::LikeOptimizationRule(ExpressionRewriter &rewriter) : Rule(
 	func->matchers.push_back(make_uniq<ExpressionMatcher>());
 	func->matchers.push_back(make_uniq<ConstantExpressionMatcher>());
 	func->policy = SetMatcher::Policy::ORDERED;
-	// we match on LIKE ("~~"), NOT LIKE ("!~~"), GLOB ("~~~"), and NOT GLOB ("!~~~")
-	func->function = make_uniq<ManyFunctionMatcher>(
-	    identifier_set_t {Identifier("!~~"), Identifier("~~"), Identifier("!~~~"), Identifier("~~~")});
+	// we match on LIKE ("~~"), NOT LIKE ("!~~"), GLOB ("~~~"), NOT GLOB ("!~~~"), ILIKE ("~~*"), and NOT ILIKE ("!~~*")
+	func->function =
+	    make_uniq<ManyFunctionMatcher>(identifier_set_t {Identifier("!~~"), Identifier("~~"), Identifier("!~~~"),
+	                                                     Identifier("~~~"), Identifier("~~*"), Identifier("!~~*")});
 	root = std::move(func);
 }
 
@@ -139,6 +140,11 @@ unique_ptr<Expression> LikeOptimizationRule::Apply(LogicalOperator &op, vector<r
 		return make_uniq<BoundConstantExpression>(Value(root.GetReturnType()));
 	}
 
+	bool is_ilike = root.Function().GetName() == "~~*" || root.Function().GetName() == "!~~*";
+	if (is_ilike) {
+		return nullptr;
+	}
+
 	// the constant_expr is a scalar expression that we have to fold
 	if (!constant_expr.IsFoldable()) {
 		return nullptr;
```

**File**: `test/sql/filter/test_like_null.test` (added, +78/-0)
```diff
@@ -0,0 +1,78 @@
+# name: test/sql/filter/test_like_null.test
+# description: Test LIKE/ILIKE with NULL pattern via CASE simplification and filters (issue #26433)
+# group: [filter]
+
+statement ok
+CREATE TABLE t(c1 VARCHAR);
+
+statement ok
+INSERT INTO t VALUES ('Jd*q^c'),(''),('x');
+
+# Test 1 — exact regression from issue #26433
+query I
+SELECT count(*) FROM t WHERE c1 ILIKE (CASE CAST(NULL AS BLOB) WHEN NULL THEN c1 END);
+----
+0
+
+# Test 2 — expression-level semantics in projection
+query III
+SELECT c1, (CASE CAST(NULL AS BLOB) WHEN NULL THEN c1 END) AS case_value, c1 ILIKE (CASE CAST(NULL AS BLOB) WHEN NULL THEN c1 END) AS predicate FROM t;
+----
+Jd*q^c	NULL	NULL
+(empty)	NULL	NULL
+x	NULL	NULL
+
+# Test 3 — valid non-NULL CASE control (matches should still be preserved)
+query I
+SELECT count(*) FROM t WHERE c1 ILIKE (CASE WHEN true THEN 'x' ELSE 'other' END);
+----
+1
+
+query I
+SELECT count(*) FROM t WHERE c1 ILIKE (CASE WHEN false THEN 'other' ELSE 'x' END);
+----
+1
+
+# Test 4 — closest sibling operator: LIKE with NULL pattern via CASE
+query I
+SELECT count(*) FROM t WHERE c1 LIKE (CASE CAST(NULL AS BLOB) WHEN NULL THEN c1 END);
+----
+0
+
+# Test 5 — structurally equivalent searched CASE producing NULL
+query I
+SELECT count(*) FROM t WHERE c1 ILIKE (CASE WHEN false THEN c1 END);
+----
+0
+
+query I
+SELECT count(*) FROM t WHERE c1 ILIKE (CASE WHEN false THEN c1 ELSE NULL END);
+----
+0
+
+# Direct NULL pattern control
+query I
+SELECT count(*) FROM t WHERE c1 ILIKE NULL;
+----
+0
+
+query I
+SELECT count(*) FROM t WHERE c1 NOT ILIKE NULL;
+----
+0
+
+query I
+SELECT count(*) FROM t WHERE c1 LIKE NULL;
+----
+0
+
+query I
+SELECT count(*) FROM t WHERE c1 NOT LIKE NULL;
+----
+0
+
+# Scalar evaluation of NULL patterns
+query IIIIII
+SELECT 'x' LIKE NULL, 'x' NOT LIKE NULL, 'x' ILIKE NULL, 'x' NOT ILIKE NULL, NULL LIKE NULL, NULL ILIKE NULL;
+----
+NULL	NULL	NULL	NULL	NULL	NULL
```

#### Recent Merged Pull Requests:
- **PR #26698** (2026-10-07): Fixup so that avro is compatible with clang-cl (@carlopi)
- **PR #26693** (closed): Skip the partitioned COPY backpressure test on Windows (@Robinho-MR)
- **PR #26677** (2026-10-07): Stabilize partitioned_write_backpressure test (@JelteF)
- **PR #26655** (closed): Fix flaky mode_tpch test after dbgen data change (@JelteF)
- **PR #26653** (2026-10-07): Stabilize parquet_prefetch_tracked_memory test (@h4nsmuller)
- **PR #26652** (closed): C API v2: passthrough catalog types, so C extensions can be CONNECT targets (@h4nsmuller)
- **PR #26645** (2026-10-07): Fix out-of-bound access for column segment (@dentiny)
- **PR #26638** (2026-10-07): Fix storage leak for blocks freed while still in use (@dentiny)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
