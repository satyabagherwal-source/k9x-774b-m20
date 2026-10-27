> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/duckdb-duckdb-learnings.md`  
> **Source**: github ([https://github.com/duckdb/duckdb](https://github.com/duckdb/duckdb))  
> **Source Version**: `d1de96c1`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-27T13:28:34.733Z  
> **Learning ID**: `learn-github-duckdb-duckdb`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): duckdb/duckdb

> **Canonical Artifact**: `07_PROJECT_LEARNING/duckdb-duckdb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/duckdb/duckdb](https://github.com/duckdb/duckdb))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-27T13:28:34.104Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `duckdb/duckdb`
- **Description**: DuckDB is a high-performance analytical database system
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 42615 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `benchmark/micro/concurrent_commits.cpp`
```
#include "benchmark_runner.hpp"
#include "duckdb_benchmark_macro.hpp"
#include "duckdb/common/local_file_system.hpp"
#include "duckdb/common/virtual_file_system.hpp"

#include <chrono>
#include <thread>
#include <vector>

using namespace duckdb;

// A LocalFileSystem whose fsync is a fixed delay, emulating high-latency durable storage (e.g.
// networked disks). A zero delay skips the fsync altogether, which measures the commit path itself
class DelayFsyncFileSystem : public LocalFileSystem {
public:
	explicit DelayFsyncFileSystem(int64_t delay_us_p) : delay_us(delay_us_p) {
	}
	void FileSync(FileHandle &handle) override {
		if (delay_us > 0) {
			std::this_thread::sleep_for(std::chrono::microseconds(delay_us));
		}
	}

private:
	int64_t delay_us;
};

// Owns a persistent database whose WAL fsync latency is simulated. The base
// DuckDBBenchmarkState db/conn (in-memory) are unused; all work runs on persistent_db.
struct ConcurrentCommitState : public DuckDBBenchmarkState {
	duckdb::unique_ptr<DuckDB> persistent_db;

	explicit ConcurrentCommitState(int64_t delay_us) : DuckDBBenchmarkState(string()) {
		DBConfig config;
		config.file_system = make_uniq<VirtualFileSystem>(make_uniq<DelayFsyncFileSystem>(delay_us));
		string path = "duckdb_concurrent_commits_bench.db";
		DeleteDatabase(path);
		persistent_db = make_uniq<DuckDB>(path, &config);
		Connection con(*persistent_db);
		// keep the whole run on the WAL path - do not checkpoint mid-run
		con.Query("SET checkpoint_threshold='1TB'");
	}
};

// NUM_THREADS connections each commit COMMITS_PER_THREAD single-row INSERTs. Every auto-commit
// INSERT is its own transaction, so concurrent committers share their WAL fsyncs
struct ConcurrentCommits {
	static void Load(DuckDBBenchmarkState *state_p) {
		auto state = (ConcurrentCommitState *)state_p;
		Connection con(*state->persistent_db);
		con.Query("CREATE TABLE integers(i INTEGER, t INTEGER)");
	}
	static void Run(DuckDBBenchmarkState *state_p, int64_t num_threads, int64_t commits_per_thread) {
		auto state = (ConcurrentCommitState *)state_p;
		std::vector<std::thread> threads;
		for (int64_t t = 0; t < num_threads; t++) {
			threads.emplace_back([state, t, commits_per_thread]() {
				Connection con(*state->persistent_db);
				for (int64_t i = 0; i < commits_per_thread; i++) {
					con.Query("INSERT INTO integers VALUES (" + std::to_string(i) + ", " + std::to_string(t) + ")");
				}
			});
		}
		for (auto &thread : threads) {
			thread.join();
		}
	}
	static void Cleanup(DuckDBBenchmarkState *state_p) {
		auto state = (ConcurrentCommitState *)state_p;
		Connection con(*state->persistent_db);
		con.Query("DROP TABLE integers");
		con.Query("CREATE TABLE integers(i INTEGER, t INTEGER)");
	}
	static string Info(int64_t num_threads, int64_t commits_per_thread, int64_t delay_us) {
		return std::to_string(num_threads) + " threads commit " + std::to_string(num_threads * commits_per_thread) +
		       " INSERT transactions, " + std::to_string(delay_us) + "us simulated WAL fsync latency";
	}
};

#define CONCURRENT_COMMITS_BENCHMARK(NUM_THREADS, COMMITS_PER_THREAD, DELAY_US)                                        \
	duckdb::unique_ptr<DuckDBBenchmarkState> CreateBenchmarkState() override {                                         \
		return make_uniq<ConcurrentCommitState>(DELAY_US);                                                             \
	}                                                                                                                  \
	void Load(DuckDBBenchmarkState *state) override {                                                                  \
		ConcurrentCommits::Load(state);                                                                                \
	}                                                                                                                  \
	void RunBenchmark(DuckDBBenchmarkState *state) override {                                                          \
		ConcurrentCommits::Run(state, NUM_THREADS, COMMITS_PER_THREAD);                                                \
	}                                                                                                                  \
	void Cleanup(DuckDBBenchmarkState *state) override {                                                               \
		ConcurrentCommits::Cleanup(state);                                                                             \
	}                                                                                                                  \
	string VerifyResult(QueryResult *result) override {                                                                \
		return string();                                                                                               \
	}                                                                                                                  \
	string BenchmarkInfo() override {                                                                                  \
		return ConcurrentCommits::Info(NUM_THREADS, COMMITS_PER_THREAD, DELAY_US);                                     \
	}

// no fsync (fixed 16000 total commits)
DUCKDB_BENCHMARK(ConcurrentCommits1Thread, "[wal]")
CONCURRENT_COMMITS_BENCHMARK(1, 16000, 0)
FINISH_BENCHMARK(ConcurrentCommits1Thread)

DUCKDB_BENCHMARK(ConcurrentCommits4Threads, "[wal]")
CONCURRENT_COMMITS_BENCHMARK(4, 4000, 0)
FINISH_BENCHMARK(ConcurrentCommits4Threads)

DUCKDB_BENCHMARK(ConcurrentCommits8Threads, "[wal]")
CONCURRENT_COMMITS_BENCHMARK(8, 2000, 0)
FINISH_BENCHMARK(ConcurrentCommits8Threads)

DUCKDB_BENCHMARK(ConcurrentCommits16Threads, "[wal]")
CONCURRENT_COMMITS_BENCHMARK(16, 1000, 0)
FINISH_BENCHMARK(ConcurrentCommits16Threads)

DUCKDB_BENCHMARK(ConcurrentCommits32Threads, "[wal]")
CONCURRENT_COMMITS_BENCHMARK(32, 500, 0)
FINISH_BENCHMARK(ConcurrentCommits32Threads)

// 1ms simulated fsync latency (fixed 800 total commits)
DUCKDB_BENCHMARK(ConcurrentCommits1Thread1ms, "[wal]")
CONCURRENT_COMMITS_BENCHMARK(1, 800, 1000)
FINISH_BENCHMARK(ConcurrentCommits1Thread1ms)

DUCKDB_BENCHMARK(ConcurrentCommits4Threads1ms, "[wal]")
CONCURRENT_COMMITS_BENCHMARK(4, 200, 1000)
FINISH_BENCHMARK(ConcurrentCommits4Threads1ms)

DUCKDB_BENCHMARK(ConcurrentCommits8Threads1ms, "[wal]")
CONCURRENT_COMMITS_BENCHMARK(8, 100, 1000)
FINISH_BENCHMARK(ConcurrentCommits8Threads1ms)

DUCKDB_BENCHMARK(ConcurrentCommits16Threads1ms, "[wal]")
CONCURRENT_COMMITS_BENCHMARK(16, 50, 1000)
FINISH_BENCHMARK(ConcurrentCommits16Threads1ms)

DUCKDB_BENCHMARK(ConcurrentCommits32Threads1ms, "[wal]")
CONCURRENT_COMMITS_BENCHMARK(32, 25, 1000)
FINISH_BENCHMARK(ConcurrentCommits32Threads1ms)

// 10ms simulated fsync latency (fixed 160 total commits)
DUCKDB_BENCHMARK(ConcurrentCommits1Thread10ms, "[wal]")
CONCURRENT_COMMITS_BENCHMARK(1, 160, 10000)
FINISH_BENCHMARK(ConcurrentCommits1Thread10ms)

DUCKDB_BENCHMARK(ConcurrentCommits4Threads10ms, "[wal]")
CONCURRENT_COMMITS_BENCHMARK(4, 40, 10000)
FINISH_BENCHMARK(ConcurrentCommits4Threads10ms)

DUCKDB_BENCHMARK(ConcurrentCommits8Threads10ms, "[wal]")
CONCURRENT_COMMITS_BENCHMARK(8, 20, 10000)
FINISH_BENCHMARK(ConcurrentCommits8Threads10ms)

DUCKDB_BENCHMARK(ConcurrentCommits16Threads10ms, "[wal]")
CONCURRENT_COMMITS_BENCHMARK(16, 10, 10000)
FINISH_BENCHMARK(ConcurrentCommits16Threads10ms)

DUCKDB_BENCHMARK(ConcurrentCommits32Threads10ms, "[wal]")
CONCURRENT_COMMITS_BENCHMARK(32, 5, 10000)
FINISH_BENCHMARK(ConcurrentCommits32Threads10ms)

```

### Core Architecture Module: `extension/core_functions/aggregate/algebraic/avg.cpp`
```
#include "core_functions/aggregate/algebraic_functions.hpp"
#include "core_functions/aggregate/sum_helpers.hpp"
#include "duckdb/common/types/hugeint.hpp"
#include "duckdb/common/types/time.hpp"
#include "duckdb/common/exception.hpp"
#include "duckdb/common/likely.hpp"
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
		KahanAddInternal(-other.err, this->value, this->err);
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

//! The average of timestamps with an infinity is that infinity, or NULL with both, as for DOUBLE it is NaN. A state
//! that saw an infinity has the maximum count and the infinities as its value
struct TimestampAverageOperation : public DiscreteAverageOperation {
	static constexpr uint64_t INFINITE_COUNT = NumericLimits<uint64_t>::Maximum();
	static constexpr uint64_t POSITIVE_INFINITY = 1;
	static constexpr uint64_t NEGATIVE_INFINITY = 2;
	static constexpr uint64_t BOTH_INFINITIES = POSITIVE_INFINITY | NEGATIVE_INFINITY;

	template <class STATE>
	static void AddInfinities(STATE &state, uint64_t infinities) {
		if (state.count != INFINITE_COUNT) {
			state.count = INFINITE_COUNT;
			state.value = hugeint_t(0);
		}
		state.value.lower |= infinities;
	}

	static uint64_t GetInfinity(int64_t input) {
		return input > 0 ? POSITIVE_INFINITY : NEGATIVE_INFINITY;
	}

	template <class STATE, class OP>
	static void Combine(const STATE &source, STATE &target, AggregateInputData &) {
		if (source.count == INFINITE_COUNT) {
			AddInfinities(target, source.value.lower);
		} else if (source.count != 0 && target.count != INFINITE_COUNT) {
			if (target.count == 0) {
				// an empty target holds no sum
				target.value = hugeint_t(0);
			}
			if (!TryAddOperator::Operation(target.count, source.count, target.count) ||
			    target.count == INFINITE_COUNT) {
				throw OutOfRangeException("Overflow in aggregate state combine");
			}
			CombineSumStateValue(target.value, source.value);
		}
	}

	template <class STATE, class OP>
	static void RepeatedCombine(const STATE &source, STATE &target, AggregateInputData &input, idx_t count) {
		if (source.count == INFINITE_COUNT) {
			if (count > 0) {
				AddInfinities(target, source.value.lower);
			}
		} else if (target.count != INFINITE_COUNT) {
			DiscreteAverageOperation::RepeatedCombine<STATE, OP>(source, target, input, count);
			if (target.count == INFINITE_COUNT) {
				throw OutOfRangeException("Overflow in repeated aggregate state combine");
			}
		}
	}

	template <class INPUT_TYPE, class STATE, class OP>
	static void Operation(STATE &state, const INPUT_TYPE &input, AggregateUnaryInput &unary_input) {
		if (DUCKDB_UNLIKELY(!timestamp_t(input).IsFinite())) {
			AddInfinities(state, GetInfinity(input));
		} else if (state.count != INFINITE_COUNT) {
			DiscreteAverageOperation::Operation<INPUT_TYPE, STATE, OP>(state, input, unary_input);
		}
	}

	template <class INPUT_TYPE, class STATE, class OP>
	static void ConstantOperation(STATE &state, const INPUT_TYPE &input, AggregateUnaryInput &unary_input,
	                              idx_t count) {
		if (DUCKDB_UNLIKELY(!timestamp_t(input).IsFinite())) {
			AddInfinities(state, GetInfinity(input));
		} else if (state.count != INFINITE_COUNT) {
			DiscreteAverageOperation::ConstantOperation<INPUT_TYPE, STATE, OP>(state, input, unary_input, count);
		}
	}

	template <class T, class STATE>
	static void Finalize(STATE &state, T &target, AggregateFinalizeData &finalize_data) {
		if (state.count != INFINITE_COUNT) {
			DiscreteAverageOperation::Finalize<T, STATE>(state, target, finalize_data);
		} else if (state.value == hugeint_t(POSITIVE_INFINITY)) {
			target = timestamp_t::infinity().value;
		} else if (state.value == hugeint_t(NEGATIVE_INFINITY)) {
			target = timestamp_t::ninfinity().value;
		} else {
			finalize_data.ReturnNull();
		}
	}
};

//! A state with the maximum count holds only infinities, reject imported ones that hold other values
void ValidateTimestampAverageStates(const_data_ptr_t states, idx_t count, idx_t stride) {
	for (idx_t i = 0; i < count; i++) {
		const auto state = Load<AvgState<hugeint_t>>(states + i * stride);
		if (state.count == TimestampAverageOperation::INFINITE_COUNT &&
		    (state.value < hugeint_t(TimestampAverageOperation::POSITIVE_INFINITY) ||
		     state.value > hugeint_t(TimestampAverageOperation::BOTH_INFINITIES))) {
			throw InvalidInputException(
			    "Invalid avg state - with a count of %llu the value must be 1 (infinity), 2 (-infinity) or 3 (both), "
			    "not %s",
			    state.count, state.value.ToString());
		}
	}
}

AggregateStateLayout TimestampAverageStateLayout(AggregateLayoutInput &input) {
	auto layout = AggregateFunction::StructStateLayout<AvgState<hugeint_t>>(input);
	layout.validate_state = ValidateTimestampAverageStates;
	return layout;
}

//! The average of TIME values is within a day - reject imported states that average outside of it
void ValidateTimeAverageStates(const_data_ptr_t states, idx_t count, idx_t stride) {
	for (idx_t i = 0; i < count; i++) {
		const auto state = Load<AvgState<hugeint_t>>(states + i * stride);
		if (state.count == 0) {
			continue;
		}
		const auto max_value = hugeint_t(0, state.count) * hugeint_t(Interval::MICROS_PER_DAY);
		if (state.value < 0 || state.value > max_value) {
			throw InvalidInputException("Invalid avg state - the average of %s over %llu values is not a valid time",
			                            state.value.ToString(), state.count);
		}
	}
}

AggregateStateLayout TimeAverageStateLayout(AggregateLayoutInput &input) {
	auto layout = AggregateFunction::StructStateLayout<AvgState<hugeint_t>>(input);
	layout.validate_state = ValidateTimeAverageStates;
	return layout;
}

struct HugeintAverageOperation : public BaseSumOperation<AverageSetOperation, HugeintAdd> {
	template <class STATE, class OP>
	static void RepeatedCombine(const STATE &source, STATE &target, AggregateInputData &input, idx_t count) {
		RepeatedAverageState::Combine(source, target, input, count);
	}

	template <class T, class STATE>
	static void Fin
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
#include "duckdb/common/operator/add.hpp"
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

	template <typename SAVE_TYPE, typename TARGET_TYPE>
	static void Decode(const SAVE_TYPE &source, TARGET_TYPE &target, const LogicalType &type) {
		Decode(source, target);
		if (type.id() != LogicalTypeId::DECIMAL) {
			return;
		}
		// The unscaled decimal range can be narrower than its physical integer range.
		const auto limit = Hugeint::POWERS_OF_TEN[DecimalType::GetWidth(type)] - 1;
		const auto value = Cast::Operation<TARGET_TYPE, hugeint_t>(target);
		if (value > limit) {
			target = Cast::Operation<hugeint_t, TARGET_TYPE>(limit);
		} else if (value < -limit) {
			target = Cast::Operation<hugeint_t, TARGET_TYPE>(-limit);
		}
	}
};

template <>
double ApproxQuantileCoding::Encode(const dtime_t &input) {
	return Encode<int64_t, double>(input.value);
}

template <>
bool ApproxQuantileCoding::Decode(const double &source, dtime_t &target) {
	int64_t micros;
	auto decoded = Decode<double, int64_t>(source, micros);
	if (micros < 0 || micros > Interval::MICROS_PER_DAY) {
		micros = MinValue<int64_t>(MaxValue<int64_t>(micros, 0), Interval::MICROS_PER_DAY);
		decoded = false;
	}
	target = dtime_t(micros);
	return decoded;
}

template <>
double ApproxQuantileCoding::Encode(const dtime_tz_t &input) {
	return Encode<uint64_t, double>(input.sort_key());
}

template <>
bool ApproxQuantileCoding::Decode(const double &source, dtime_tz_t &target) {
	uint64_t sort_key;
	const auto decoded = Decode<double, uint64_t>(source, sort_key);
	if (decoded) {
		//	The offset bits of an interpolated sort key are meaningless: return the normalized time at +00.
		auto micros = dtime_tz_t::decode_micros(sort_key);
		micros -= int64_t(dtime_tz_t::MAX_OFFSET * dtime_tz_t::OFFSET_MICROS);
		micros = (micros % Interval::MICROS_PER_DAY + Interval::MICROS_PER_DAY) % Interval::MICROS_PER_DAY;
		target = dtime_tz_t(dtime_t(micros), 0);
	} else if (source < 0) {
		target = Value::MinimumValue(LogicalTypeId::TIME_TZ).GetValue<dtime_tz_t>();
	} else {
		target = Value::MaximumValue(LogicalTypeId::TIME_TZ).GetValue<dtime_tz_t>();
	}

	return decoded;
}

template <>
double ApproxQuantileCoding::Encode(const timestamp_t &input) {
	return Encode<int64_t, double>(input.value);
}

template <>
bool ApproxQuantileCoding::Decode(const double &source, timestamp_t &target) {
	int64_t value;
	const auto decoded = Decode<double, int64_t>(source, value);
	// the infinities are the largest and smallest timestamps - do not return anything beyond them
	if (value >= timestamp_t::infinity().value) {
		target = timestamp_t::infinity();
	} else if (value <= timestamp_t::ninfinity().value) {
		target = timestamp_t::ninfinity();
	} else {
		target = timestamp_t(value);
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
		if (!TryAddOperator::Operation(target.pos, source.pos, target.pos)) {
			throw OutOfRangeException("Overflow in aggregate state combine");
		}
		target.h->merge(source.h);
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
		ApproxQuantileCoding::Decode(source, target, finalize_data.result.GetType());
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
	// A group can be the whole input, so the vector is allocated through the (tracked) base allocator.
	DataChunk points_chunk;
	points_chunk.Initialize(data.allocator.GetUnderlyingAllocator(), {struct_type}, MaxValue<idx_t>(max_v, 1));
	auto &points = points_chunk.data[0];

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
		// Functors to normalize 
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
		if constexpr (std::is_same<RESULT_TYPE, hugeint_t>::value) {
			// values of opposite sign (e.g. DECIMAL(38)) can be further apart than the range of a hugeint - such
			// deviations are larger than any other, so saturate them
			RESULT_TYPE delta;
			if (!TrySubtractOperator::Operation<RESULT_TYPE, RESULT_TYPE, RESULT_TYPE>(
			        input, UnsafeNumericCast<RESULT_TYPE>(median), delta) ||
			    delta == NumericLimits<RESULT_TYPE>::Minimum()) {
				return NumericLimits<RESULT_TYPE>::Maximum();
			}
			return TryAbsOperator::Operation<RESULT_TYPE, RESULT_TYPE>(delta);
		} else {
			const RESULT_TYPE delta = input - UnsafeNumericCast<RESULT_TYPE>(median);
			return TryAbsOperator::Operation<RESULT_TYPE, RESULT_TYPE>(delta);
		}
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
				med = gstate->GetWindowState().template WindowScalar<MEDIAN_TYPE, false>(partition.context.client, data,
				                                                                         frames, n, result, quantile);
			} else {
				window_state.UpdateSkip(data, frames, included);
				med = window_state.template WindowScalar<MEDIAN_TYPE, false>(partition.context.client, data, frames, n,
				                                                             result, quantile);
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

				rdata[ridx] = interp.template Extrac
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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #27947** (2026-10-27): **Codename 'Islandica'**
  *Symptoms*: Adds the release codename for the upcoming 2.1 series to `DuckDB::ReleaseCodename()`: builds tagged `v2.1.*` now report `Islandica` from `PRAGMA version` / `pragma_version()` instead of falling through to `Unknown Version`.  Same shape as the previous codename additions (#23056 for Cyanoptera). No test changes: `test/sql/pragma/test_pragma_version.test` only asserts a codename on dev builds and `v0.0.1`.  Note: this PR was generated by an AI coding agent and reviewed by the author. 
  **Post-Mortem & Fix Analysis**:
  > Added a narrower version of that check in 705e8d7: for the version lines the function knows (v1.2 through v2.1) the test asserts the matching codename and fails on 'Unknown Version', while dev/pre-release builds and tags the function has no entry for are left alone, since `ReleaseCodename()` deliberately tolerates arbitrary tags on forks.

- **Issue #27935** (2026-10-27): **Revert "Merge Rust extension CI groups (#27600)"**
  *Symptoms*:  A clean `git revert` of the merge commit, one file.  Every pull request that touches extensions fails `Build extensions / Build Linux (rust, linux_arm64_musl)` and `Build Windows (rust, windows_arm64)`, and `Summary` with them. The two jobs first show up in pull-request runs on 2026-10-23, as PRs picked up the workflow from #27600 (merged 2026-10-21), and across every run since then (53 checked) they have never passed. #27600 is what put the rust extensions on those two architectures for pull requests: besides merging the `rust` and `external` groups, it moved `opt_in_archs` from the four main groups to the reusable workflow level, so the opt-in now covers every group. For a pull request that changes extensions, `scripts/ci/job_stages.py` opts in exactly `windows_arm64;linux_arm64_musl`; before #27600 the rust group had no opt-in and never built there.  The extensions do not build on those targets today: delta's cargo build runs with `--target=aarch64-unknown-linux-gnu` inside the musl image, whose toolchain only has the musl standard library (`error[E0463]: can't find crate for core`), and lance's `aws-lc-sys` build script exits with status 101 on `aarch64-unknown-linux-musl`.  Reverting restores the two groups and the per-group opt-in, so pull requests stop building the rust extensions on `linux_arm64_musl` and `windows_arm64`. It also takes back the `osx_amd64` opt-in that #27600 wanted for delta and unity_catalog; that part can come back as an `opt_in_archs` entry on the

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

### Incident Patch 1: `142a9e7d` (2026-10-27)
**Commit Message**: Fix DETACH in a transaction, instance cache reuse, encrypted attach, logging storage and extension installs (#27765)

Fixes problems around database and extension lifecycle: DETACH of a
database used by the current transaction, handing out cached databases
that are still in use, the storage version of encrypted databases
attached without one, the path of file log storage, and extension
installs in progress.

Combines the PRs labeled `Ready To Merge` in
https://github.com/duckdb-bot/duckdb/pulls below, on top of the current
head of `main`. The changes of each PR are applied as one squashed
commit.

## Changes applied (5 PRs)

- duckdb-bot/duckdb#195: Allow DETACH of a database the current
transaction has used, so its COMMIT commits the work
- duckdb-bot/duckdb#110: Hand out a cached database that a connection or
a result still holds after its last handle is closed
- duckdb-bot/duckdb#213: Keep the storage version of an existing
encrypted database when attaching it without one
- duckdb-bot/duckdb#146: Keep the path of file log storage when
enable_logging fails, runs prepared after a switch, or names the storage
in uppercase
- duckdb-bot/duckdb#14: Skip extension installs in progress 

**File**: `src/execution/operator/schema/physical_detach.cpp` (modified, +0/-16)
```diff
@@ -1,12 +1,10 @@
 #include "duckdb/execution/operator/schema/physical_detach.hpp"
 #include "duckdb/parser/parsed_data/detach_info.hpp"
 #include "duckdb/catalog/catalog.hpp"
-#include "duckdb/common/exception/transaction_exception.hpp"
 #include "duckdb/main/database_manager.hpp"
 #include "duckdb/main/attached_database.hpp"
 #include "duckdb/main/database.hpp"
 #include "duckdb/storage/storage_extension.hpp"
-#include "duckdb/transaction/meta_transaction.hpp"
 
 namespace duckdb {
 
@@ -16,20 +14,6 @@ namespace duckdb {
 SourceResultType PhysicalDetach::GetDataInternal(ExecutionContext &context, DataChunk &chunk,
                                                  OperatorSourceInput &input) const {
 	auto &db_manager = DatabaseManager::Get(context.client);
-
-	// Reject detach if the current transaction already has outstanding work on the database.
-	{
-		auto attached_db = db_manager.GetDatabase(info->name);
-		if (attached_db) {
-			auto &meta_transaction = MetaTransaction::Get(context.client);
-			if (meta_transaction.TryGetTransaction(*attached_db)) {
-				throw TransactionException("Cannot detach database %s because the current transaction has outstanding "
-				                           "work on it - commit or rollback first",
-				                           info->name);
-			}
-		}
-	}
-
 	db_manager.DetachDatabase(context.client, info->name, info->if_not_found);
 
 	return SourceResultType::FINISHED;
```

**File**: `src/function/table/system/duckdb_extensions.cpp` (modified, +1/-1)
```diff
@@ -114,7 +114,7 @@ unique_ptr<GlobalTableFunctionState> DuckDBExtensionsInit(ClientContext &context
 	auto ext_directories = ExtensionHelper::GetExtensionDirectoryPath(context);
 	for (const auto &ext_directory : ext_directories) {
 		fs.ListFiles(ext_directory, [&](const string &path, bool is_directory) {
-			if (!StringUtil::EndsWith(path, ".duckdb_extension")) {
+			if (!ExtensionHelper::IsInstalledExtensionFile(path)) {
 				return;
 			}
 			ExtensionInformation info;
```

**File**: `src/function/table/system/logging_utils.cpp` (modified, +30/-19)
```diff
@@ -24,6 +24,29 @@ class EnableLoggingBindData : public TableFunctionData {
 	vector<string> log_types_to_set;
 };
 
+//! File logging requires a path. Reject switching to file storage without one before mutating any state, so the
+//! active storage is preserved instead of becoming a path-less storage that throws on every later flush (end-of-query
+//! and shutdown included).
+static void VerifyFileStoragePath(LogManager &log_manager, const string &storage,
+                                  const case_insensitive_map_t<Value> &storage_config) {
+	if (StringUtil::Lower(storage) != LogConfig::FILE_STORAGE_NAME) {
+		return;
+	}
+	auto current_storage = StringUtil::Lower(log_manager.GetConfig().storage);
+	// Already-active file storage keeps its existing path, only a fresh switch is guarded.
+	if (current_storage == LogConfig::FILE_STORAGE_NAME) {
+		return;
+	}
+	auto path_entry = storage_config.find("path");
+	bool has_usable_path =
+	    path_entry != storage_config.end() && !path_entry->second.IsNull() && !path_entry->second.ToString().empty();
+	if (!has_usable_path) {
+		throw InvalidInputException(
+		    "Cannot enable 'file' log storage without a valid path. Provide one via storage_path, "
+		    "e.g. CALL enable_logging(storage='file', storage_path='mylog.csv');");
+	}
+}
+
 static void EnableLogging(ClientContext &context, TableFunctionInput &data, DataChunk &output) {
 	auto bind_data = data.bind_data->Cast<EnableLoggingBindData>();
 
@@ -33,8 +56,11 @@ static void EnableLogging(ClientContext &context, TableFunctionInput &data, Data
 
 	auto &log_manager = context.db->GetLogManager();
 
+	// a prepared call can run after the storage it was bound against changed
+	VerifyFileStoragePath(log_manager, bind_data.config.storage, bind_data.storage_config);
+
 	// Apply the config generated from the input - restoring the previous config if that fails part-way
-	auto previous_config = log_manager.GetConfig();
+	auto previous = log_manager.GetConfigAndStorage();
 	try {
 		log_manager.SetConfig(*context.db, bind_data.config);
 
@@ -49,7 +75,8 @@ static void EnableLogging(ClientContext &context, TableFunctionInput &data, Data
 			log_manager.UpdateLogStorageConfig(*context.db, bind_data.storage_config);
 		}
 	} catch (...) {
-		log_manager.SetConfig(*context.db, previous_config);
+		// the previous storage itself, as a new one of its kind would lack its storage config
+		log_manager.RestoreConfig(previous.first, std::move(previous.second));
 		throw;
 	}
 }
@@ -122,23 +149,7 @@ static unique_ptr<FunctionData> BindEnableLogging(ClientContext &context, TableF
 		}
 	}
 
-	// File logging requires a path. Reject switching to file storage without one before mutating any
-	// state, so the active storage is preserved instead of becoming a path-less storage that throws
-	// on every later flush (end-of-query and shutdown included).
-	if (StringUtil::Lower(result->config.storage) == LogConfig::FILE_STORAGE_NAME) {
-		auto current_storage = StringUtil::Lower(context.db->GetLogManager().GetConfig().storage);
-		// Already-active file storage keeps its existing path; only guard a fresh switch.
-		if (current_storage != LogConfig::FILE_STORAGE_NAME) {
-			auto path_entry = result->storage_config.find("path");
-			bool has_usable_path = path_entry != result->storage_config.end() && !path_entry->second.IsNull() &&
-			                       !path_entry->second.ToString().empty();
-			if (!has_usable_path) {
-				throw InvalidInputException(
-				    "Cannot enable 'file' log storage without a valid path. Provide one via storage_path, "
-				    "e.g. CALL enable_logging(storage='file', storage_path='mylog.csv');");
-			}
-		}
-	}
+	VerifyFileStoragePath(context.db->GetLogManager(), result->config.storage, result->storage_config);
 
 	// Process positional params
 	if (!input.inputs.empty()) {
```

**File**: `src/include/duckdb/logging/log_manager.hpp` (modified, +4/-0)
```diff
@@ -51,6 +51,10 @@ class LogManager {
 	DUCKDB_API bool CanScan(LoggingTargetTable table);
 
 	DUCKDB_API void SetConfig(DatabaseInstance &db, const LogConfig &config);
+	//! The config together with its storage, to put back with RestoreConfig when a change fails
+	DUCKDB_API pair<LogConfig, shared_ptr<LogStorage>> GetConfigAndStorage();
+	//! Puts back a config and its storage as GetConfigAndStorage returned them
+	DUCKDB_API void RestoreConfig(const LogConfig &config, shared_ptr<LogStorage> storage);
 	DUCKDB_API void SetEnableLogging(bool enable);
 	DUCKDB_API void SetLogMode(LogMode mode);
 	DUCKDB_API void SetLogLevel(LogLevel level);
```

**File**: `src/include/duckdb/main/database_manager.hpp` (modified, +3/-2)
```diff
@@ -70,8 +70,9 @@ class DatabaseManager {
 	void DetachResourceBorrowers(ClientContext &context, const string &resource_name);
 	//! Alter operation dispatcher
 	void Alter(ClientContext &context, AlterInfo &info);
-	//! Rollback the attach of a database
-	shared_ptr<AttachedDatabase> DetachInternal(const Identifier &name);
+	//! Rollback the attach of a database, given the database only when its name still refers to it
+	shared_ptr<AttachedDatabase> DetachInternal(const Identifier &name,
+	                                            optional_ptr<AttachedDatabase> database = nullptr);
 	//! Returns a reference to the system catalog
 	Catalog &GetSystemCatalog();
 
```

**File**: `src/include/duckdb/main/db_instance_cache.hpp` (modified, +3/-2)
```diff
@@ -19,10 +19,11 @@ class DatabaseFilePathManager;
 
 struct DatabaseCacheEntry {
 	DatabaseCacheEntry();
-	explicit DatabaseCacheEntry(const shared_ptr<DuckDB> &database);
+	explicit DatabaseCacheEntry(const shared_ptr<DatabaseInstance> &instance);
 	~DatabaseCacheEntry();
 
-	weak_ptr<DuckDB> database;
+	//! Connections and unfinished results keep the instance alive after its last handle is closed
+	weak_ptr<DatabaseInstance> instance;
 	mutex update_database_mutex;
 };
 
```

**File**: `src/include/duckdb/main/extension_helper.hpp` (modified, +2/-0)
```diff
@@ -144,6 +144,8 @@ class ExtensionHelper {
 	// Get all extension directory paths
 	static vector<string> GetExtensionDirectoryPath(ClientContext &context);
 	static vector<string> GetExtensionDirectoryPath(DatabaseInstance &db, FileSystem &fs);
+	//! Whether a file in an extension directory is an installed extension, and not the temporary file of an install
+	static bool IsInstalledExtensionFile(const string &path);
 
 	// Check signature of an Extension stored as FileHandle
 	static bool CheckExtensionSignature(DatabaseInstance &db, FileHandle &handle,
```

**File**: `src/logging/log_manager.cpp` (modified, +14/-0)
```diff
@@ -115,6 +115,20 @@ void LogManager::SetConfig(DatabaseInstance &db, const LogConfig &config_p) {
 	// We need extra handling for switching storage
 	SetLogStorageInternal(db, config_p.storage);
 
+	// keep the storage name as SetLogStorageInternal lowercased it, so that it is recognized when set again
+	auto new_config = config_p;
+	new_config.storage = config.storage;
+	SetConfigInternal(std::move(new_config));
+}
+
+pair<LogConfig, shared_ptr<LogStorage>> LogManager::GetConfigAndStorage() {
+	unique_lock<mutex> lck(lock);
+	return make_pair(config, log_storage);
+}
+
+void LogManager::RestoreConfig(const LogConfig &config_p, shared_ptr<LogStorage> storage) {
+	unique_lock<mutex> lck(lock);
+	log_storage = std::move(storage);
 	SetConfigInternal(config_p);
 }
 
```

---

### Incident Patch 2: `766da897` (2026-10-27)
**Commit Message**: Restrict recursive partitions of CTE-decorrelated lateral joins (fixes #27072) (#27089)

Fixes https://github.com/duckdb/duckdb/issues/27072.

The issue reports that a selective correlated LATERAL query over a
recursive CTE computes every recursive partition on v2.0, while 1.5.6
computes only the matching one. Both versions return the correct result,
but with 1000 input rows the recursive CTE emits 3 rows on 1.5.6 and
3000 on v2.0. The report uses a computed STRUCT field as the correlation
key, but while investigating it turned out that the struct is
incidental. Plain-column variants, nested laterals, and correlated
EXISTS all show the same regression, so this addresses the whole class
rather than the reported query alone.

The root cause is a structural difference between the two decorrelation
strategies. The 1.5.x delim joins fed the duplicate-eliminated outer
keys directly into the inner plan, where they restricted the correlated
input before the recursive CTE ran. CTE-based decorrelation materializes
the correlated input as a delim CTE instead, and the selective join
against the outer keys sits above that materialization boundary, which
no later optimizer crosses. The CTE join 

**File**: `src/include/duckdb/optimizer/cte_join_filter_collector.hpp` (modified, +40/-6)
```diff
@@ -9,34 +9,68 @@
 #pragma once
 
 #include "duckdb/common/enums/expression_type.hpp"
+#include "duckdb/common/optional_ptr.hpp"
 #include "duckdb/common/unordered_map.hpp"
 #include "duckdb/planner/column_binding.hpp"
+#include "duckdb/planner/expression.hpp"
 
 namespace duckdb {
 
 class LogicalOperator;
 class LogicalCTERef;
 
+//! A deterministic expression over a single output column of a materialized CTE
+struct CTEJoinFilterKey {
+	//! Expression containing exactly one column reference
+	unique_ptr<Expression> expression;
+	//! The CTE output column the expression references
+	ProjectionIndex column;
+
+	CTEJoinFilterKey Copy() const;
+	//! Copy of the expression with its column reference rebound
+	unique_ptr<Expression> BindExpression(const LogicalType &type, ColumnBinding binding) const;
+};
+
 struct CTEJoinFilter {
+	//! Materialized CTE providing the key domain, unless source_parent is set
 	TableIndex source;
+	//! Operator whose child subtree can be copied to provide the key domain instead
+	optional_ptr<LogicalOperator> source_parent;
+	idx_t source_child = 0;
 	TableIndex target;
 	TableIndex target_scan;
-	vector<ProjectionIndex> source_columns;
-	vector<ProjectionIndex> target_columns;
+	//! Key columns are CTE output columns, or output positions of the source subtree
+	vector<CTEJoinFilterKey> source_keys;
+	vector<CTEJoinFilterKey> target_keys;
 	vector<ExpressionType> comparisons;
 };
 
 class CTEJoinFilterCollector {
 public:
 	static vector<CTEJoinFilter> Collect(LogicalOperator &op, const unordered_map<TableIndex, TableIndex> &targets);
 
+	//! A filter key tracked while traversing the plan, bound to the keys' current position
+	struct CTEJoinKey {
+		//! Expression containing exactly one column reference
+		unique_ptr<Expression> expression;
+		//! Binding of that column reference at the current operator
+		ColumnBinding binding;
+	};
+
+	//! The key domain of a join side: a materialized CTE ref, or a copyable child subtree
+	struct CTEJoinSource {
+		optional_ptr<const LogicalCTERef> ref;
+		optional_ptr<LogicalOperator> parent;
+		idx_t child_index = 0;
+	};
+
 private:
 	explicit CTEJoinFilterCollector(const unordered_map<TableIndex, TableIndex> &targets);
 	void VisitOperator(LogicalOperator &op);
-	void PushFilter(LogicalOperator &op, const LogicalCTERef &source, const vector<ColumnBinding> &source_keys,
-	                vector<ColumnBinding> target_keys, const vector<ExpressionType> &comparisons);
-	void AddFilter(const LogicalCTERef &source, const LogicalCTERef &target, const vector<ColumnBinding> &source_keys,
-	               const vector<ColumnBinding> &target_keys, const vector<ExpressionType> &comparisons);
+	void PushFilter(LogicalOperator &op, const CTEJoinSource &source, const vector<CTEJoinKey> &source_keys,
+	                vector<CTEJoinKey> target_keys, const vector<ExpressionType> &comparisons);
+	void AddFilter(const CTEJoinSource &source, const LogicalCTERef &target, const vector<CTEJoinKey> &source_keys,
+	               const vector<CTEJoinKey> &target_keys, const vector<ExpressionType> &comparisons);
 
 private:
 	const unordered_map<TableIndex, TableIndex> &join_targets;
```

**File**: `src/include/duckdb/optimizer/cte_join_filter_pusher.hpp` (modified, +3/-0)
```diff
@@ -9,6 +9,7 @@
 #pragma once
 
 #include "duckdb/common/insertion_order_preserving_map.hpp"
+#include "duckdb/planner/bound_parameter_map.hpp"
 #include "duckdb/planner/column_binding.hpp"
 
 namespace duckdb {
@@ -38,6 +39,8 @@ class CTEJoinFilterPusher {
 	Optimizer &optimizer;
 	InsertionOrderPreservingMap<unique_ptr<MaterializedCTEInfo>> cte_info_map;
 	vector<TableIndex> available_ctes;
+	//! Parameter data, in case the plan is part of a prepared statement and a subtree must be copied
+	optional_ptr<bound_parameter_map_t> parameter_data;
 };
 
 } // namespace duckdb
```

**File**: `src/optimizer/cte_join_filter_collector.cpp` (modified, +219/-61)
```diff
@@ -9,6 +9,7 @@
 #include "duckdb/planner/operator/logical_comparison_join.hpp"
 #include "duckdb/planner/operator/logical_cteref.hpp"
 #include "duckdb/planner/operator/logical_distinct.hpp"
+#include "duckdb/planner/operator/logical_get.hpp"
 #include "duckdb/planner/operator/logical_projection.hpp"
 
 namespace duckdb {
@@ -24,41 +25,107 @@ vector<CTEJoinFilter> CTEJoinFilterCollector::Collect(LogicalOperator &op,
 	return std::move(collector.join_filters);
 }
 
-static bool CanPassCTEJoinFilter(LogicalOperator &op) {
+static bool CTEJoinKeyExpressionIsSafe(const Expression &expr) {
+	if (expr.IsVolatile() || expr.CanThrow() || ExpressionBarrier::Contains(expr)) {
+		return false;
+	}
 	bool safe = true;
-	LogicalOperatorVisitor::EnumerateExpressions(op, [&](unique_ptr<Expression> *expr) {
-		safe &= !(*expr)->IsVolatile() && !(*expr)->CanThrow() && !ExpressionBarrier::Contains(**expr);
-		ExpressionIterator::VisitExpression<BoundFunctionExpression>(
-		    **expr, [&](const BoundFunctionExpression &func) { safe &= !func.Function().RequiresOrderedExecution(); });
+	ExpressionIterator::VisitExpression<BoundFunctionExpression>(
+	    expr, [&](const BoundFunctionExpression &func) { safe &= !func.Function().RequiresOrderedExecution(); });
+	return safe;
+}
+
+static optional_ptr<const BoundColumnRefExpression> GetSingleColumnRef(const Expression &expr) {
+	optional_ptr<const BoundColumnRefExpression> result;
+	idx_t count = 0;
+	ExpressionIterator::VisitExpression<BoundColumnRefExpression>(expr, [&](const BoundColumnRefExpression &ref) {
+		count++;
+		result = &ref;
 	});
+	return count == 1 ? result : nullptr;
+}
+
+static void ReplaceCTEJoinKeyColumnRef(unique_ptr<Expression> &expr, unique_ptr<Expression> replacement) {
+	ExpressionIterator::VisitExpressionMutable<BoundColumnRefExpression>(
+	    expr, [&](BoundColumnRefExpression &, unique_ptr<Expression> &slot) {
+		    D_ASSERT(replacement);
+		    slot = std::move(replacement);
+	    });
+}
+
+CTEJoinFilterKey CTEJoinFilterKey::Copy() const {
+	return CTEJoinFilterKey {expression->Copy(), column};
+}
+
+unique_ptr<Expression> CTEJoinFilterKey::BindExpression(const LogicalType &type, ColumnBinding binding) const {
+	auto result = expression->Copy();
+	ReplaceCTEJoinKeyColumnRef(result, make_uniq<BoundColumnRefExpression>(type, binding));
+	return result;
+}
+
+static bool CanPassCTEJoinFilter(LogicalOperator &op) {
+	bool safe = true;
+	LogicalOperatorVisitor::EnumerateExpressions(
+	    op, [&](unique_ptr<Expression> *expr) { safe &= CTEJoinKeyExpressionIsSafe(**expr); });
 	return safe;
 }
 
-static bool ContainsCTEJoinKeys(LogicalOperator &op, const vector<ColumnBinding> &keys) {
+//! Rebind a key to the expression its column maps to in a child operator
+static bool MapCTEJoinKey(CTEJoinFilterCollector::CTEJoinKey &key, const Expression &mapped) {
+	if (!CTEJoinKeyExpressionIsSafe(mapped)) {
+		return false;
+	}
+	auto column_ref = GetSingleColumnRef(mapped);
+	if (!column_ref) {
+		return false;
+	}
+	key.binding = column_ref->Binding();
+	ReplaceCTEJoinKeyColumnRef(key.expression, mapped.Copy());
+	return true;
+}
+
+static bool ContainsCTEJoinKeys(LogicalOperator &op, const vector<CTEJoinFilterCollector::CTEJoinKey> &keys) {
 	auto bindings = op.GetColumnBindings();
 	for (auto &key : keys) {
-		if (std::find(bindings.begin(), bindings.end(), key) == bindings.end()) {
+		if (std::find(bindings.begin(), bindings.end(), key.binding) == bindings.end()) {
+			return false;
+		}
+	}
+	return true;
+}
+
+static bool MapCTEJoinProjection(LogicalProjection &projection, vector<CTEJoinFilterCollector::CTEJoinKey> &keys) {
+	for (auto &key : keys) {
+		if (key.binding.table_index != projection.table_index) {
+			return false;
+		}
+		if (!MapCTEJoinKey(key, projection.GetExpression(key.binding))) {
 			return false;
 		}
 	}
 	return true;
 }
 
-static bool MapCTEJoinProjection(LogicalProjection &projection, vector<ColumnBinding> &keys) {
+//! Group columns of an aggregate carry the distinct values of their input expressions
+static bool MapCTEJoinAggregate(LogicalAggregate &aggregate, vector<CTEJoinFilterCollector::CTEJoinKey> &keys) {
 	for (auto &key : keys) {
-		if (key.table_index != projection.table_index) {
+		if (key.binding.table_index != aggregate.group_index) {
 			return false;
 		}
-		auto &expr = projection.GetExpression(key);
-		if (expr.GetExpressionClass() != ExpressionClass::BOUND_COLUMN_REF) {
+		for (auto &grouping_set : aggregate.grouping_sets) {
+			if (!grouping_set.count(key.binding.column_index)) {
+				return false;
+			}
+		}
+		if (!MapCTEJoinKey(key, aggregate.GetGroupExpression(key.binding.column_index))) {
 			return false;
 		}
-		key = expr.Cast<BoundColumnRefExpression>().Binding();
 	}
 	return true;
 }
 
-static optional_ptr<LogicalCTERef> FindCTEJoinSource(LogicalOperator &op, vector<ColumnBinding> &keys) {
+static optional_ptr<LogicalCTERef> FindCTEJoinSource(LogicalOperator &op,
+                                      
```

**File**: `src/optimizer/cte_join_filter_pusher.cpp` (modified, +73/-27)
```diff
@@ -4,14 +4,33 @@
 #include "duckdb/optimizer/relation_statistics/relation_statistics_extractor.hpp"
 #include "duckdb/planner/binder.hpp"
 #include "duckdb/planner/expression/bound_columnref_expression.hpp"
+#include "duckdb/planner/logical_operator_deep_copy.hpp"
 #include "duckdb/planner/operator/logical_comparison_join.hpp"
 #include "duckdb/planner/operator/logical_cteref.hpp"
+#include "duckdb/planner/operator/logical_get.hpp"
 #include "duckdb/planner/operator/logical_materialized_cte.hpp"
+#include "duckdb/planner/operator/logical_prepare.hpp"
 
 #include <cmath>
 
 namespace duckdb {
 
+static bool CanAffordCTEJoinSource(ClientContext &context, LogicalOperator &op, idx_t target_cardinality) {
+	if (op.type == LogicalOperatorType::LOGICAL_FILTER || op.type == LogicalOperatorType::LOGICAL_PROJECTION) {
+		return op.children.size() == 1 && CanAffordCTEJoinSource(context, *op.children[0], target_cardinality);
+	}
+	if (op.type != LogicalOperatorType::LOGICAL_GET || !op.children.empty()) {
+		return false;
+	}
+	auto &get = op.Cast<LogicalGet>();
+	if (!get.function.cardinality || !get.bind_data) {
+		return false;
+	}
+	// Bound the copied scan before filters; its output cardinality only bounds the hash build.
+	auto stats = get.function.cardinality(context, get.bind_data.get());
+	return stats && stats->has_estimated_cardinality && stats->estimated_cardinality <= target_cardinality;
+}
+
 CTEJoinFilterPusher::CTEJoinFilterPusher(Optimizer &optimizer) : optimizer(optimizer) {
 }
 
@@ -46,9 +65,12 @@ void CTEJoinFilterPusher::FindCandidates(LogicalOperator &op) {
 }
 
 void CTEJoinFilterPusher::Optimize(LogicalOperator &op) {
-	// Bound the extra scan/hash-build cost and require a substantial reduction in retained keys.
+	// Bound the hash build and require a substantial reduction in retained keys.
 	static constexpr double MAX_SOURCE_RATIO = 0.25;
 	static constexpr double MAX_KEY_RATIO = 0.5;
+	if (op.type == LogicalOperatorType::LOGICAL_PREPARE) {
+		parameter_data = op.Cast<LogicalPrepare>().prepared->value_map;
+	}
 	unordered_map<TableIndex, TableIndex> join_targets;
 	cte_info_map.clear();
 	FindCandidates(op);
@@ -95,28 +117,40 @@ void CTEJoinFilterPusher::Optimize(LogicalOperator &op) {
 		double best_fraction = 1;
 		idx_t best_source_count = 0;
 		for (auto &filter : join_filters) {
-			if (filter.target != target || filter.target_scan != cte.filter_dependency->row_scan ||
-			    std::find(info.ancestors.begin(), info.ancestors.end(), filter.source) == info.ancestors.end()) {
+			if (filter.target != target || filter.target_scan != cte.filter_dependency->row_scan) {
 				continue;
 			}
-			auto source_entry = cte_info_map.find(to_string(filter.source.index));
-			if (source_entry == cte_info_map.end()) {
-				continue;
+			optional_ptr<const RelationStats> source_stats;
+			if (filter.source_parent) {
+				// A copyable source subtree only reads base tables, so it is valid in any CTE definition.
+				auto &source = *filter.source_parent->children[filter.source_child];
+				if (!CanAffordCTEJoinSource(optimizer.context, source, target_stats->cardinality)) {
+					continue;
+				}
+				source_stats = extractor.Extract(source);
+			} else {
+				if (std::find(info.ancestors.begin(), info.ancestors.end(), filter.source) == info.ancestors.end()) {
+					continue;
+				}
+				auto source_entry = cte_info_map.find(to_string(filter.source.index));
+				if (source_entry == cte_info_map.end()) {
+					continue;
+				}
+				auto &source_cte = source_entry->second->materialized_cte;
+				auto cached = restricted_stats.find(filter.source);
+				source_stats =
+				    cached == restricted_stats.end() ? extractor.Extract(*source_cte.children[0]) : &cached->second;
 			}
-			auto &source_cte = source_entry->second->materialized_cte;
-			auto cached = restricted_stats.find(filter.source);
-			optional_ptr<const RelationStats> source_stats =
-			    cached == restricted_stats.end() ? extractor.Extract(*source_cte.children[0]) : &cached->second;
-			// An extra scan and hash build should be small relative to the input being restricted.
+			// The hash build should be small relative to the input being restricted.
 			if (!source_stats || static_cast<double>(source_stats->cardinality) >
 			                         static_cast<double>(target_stats->cardinality) * MAX_SOURCE_RATIO) {
 				continue;
 			}
 			double fraction = 1;
 			bool valid_columns = true;
 			for (idx_t i = 0; i < filter.comparisons.size(); i++) {
-				auto source_col = filter.source_columns[i].GetIndex();
-				auto target_col = filter.target_columns[i].GetIndex();
+				auto source_col = filter.source_keys[i].column.GetIndex();
+				auto target_col = filter.target_keys[i].column.GetIndex();
 				if (source_col >= source_stats->columns.size() || target_col >= target_stats->columns.size()) {
 					valid_columns = false;
 					break;
@@ -141,25 +175,37 @@ void CTEJoinFilterPusher::Optimize(LogicalOperator &op) {
 		if (!best) {
 			continue;
 
```

**File**: `test/optimizer/pushdown/cte_domain_join_filter.test` (modified, +229/-0)
```diff
@@ -188,6 +188,235 @@ SELECT count(*) FROM o JOIN (
 ----
 physical_plan	<!REGEX>:[\s\S]*Join Type: SEMI[\s\S]*
 
+# Join keys computed from a STRUCT field restrict the recursive partitions (issue #27072)
+
+statement ok
+CREATE VIEW nodes AS SELECT id, selected, struct_pack(k := id) AS node FROM person;
+
+statement ok
+PRAGMA enable_profiling='json';
+
+query I
+SELECT max(q.x)
+FROM nodes o, LATERAL (
+    SELECT r.x FROM nodes i, LATERAL (
+        WITH RECURSIVE walk(x) AS (
+            SELECT i.node.k
+            UNION ALL SELECT x+1 FROM walk WHERE x < i.node.k+2
+        ) SELECT x FROM walk
+    ) r
+    WHERE i.node.k = o.node.k
+) q WHERE o.id=3;
+----
+5
+
+statement ok
+PRAGMA disable_profiling;
+
+query II
+SELECT recursive_rows(), semi_joins();
+----
+3	1
+
+statement ok
+PRAGMA enable_profiling='json';
+
+query III
+SELECT count(*), sum(q.x), max(q.x)
+FROM nodes o, LATERAL (
+    SELECT r.x FROM nodes i, LATERAL (
+        WITH RECURSIVE walk(x) AS (
+            SELECT i.node.k
+            UNION ALL SELECT x+1 FROM walk WHERE x < i.node.k+2
+        ) SELECT x FROM walk
+    ) r
+    WHERE i.node.k = o.node.k
+) q WHERE o.selected;
+----
+9	222	53
+
+statement ok
+PRAGMA disable_profiling;
+
+query I
+SELECT recursive_rows();
+----
+9
+
+# A plain selective scan restricts the partitions even without a materialized key domain
+
+statement ok
+PRAGMA enable_profiling='json';
+
+query I
+SELECT max(q.x)
+FROM person o, LATERAL (
+    SELECT r.x FROM person i, LATERAL (
+        WITH RECURSIVE walk(x) AS (
+            SELECT i.id UNION ALL SELECT x+1 FROM walk WHERE x < i.id+2
+        ) SELECT x FROM walk
+    ) r
+    WHERE i.id = o.id
+) q WHERE o.id=3;
+----
+5
+
+statement ok
+PRAGMA disable_profiling;
+
+query II
+SELECT recursive_rows(), semi_joins();
+----
+3	1
+
+# Transitive restriction through nested lateral joins is deferred to cost-based domain placement
+
+statement ok
+PRAGMA enable_profiling='json';
+
+query I
+SELECT max(q.x) FROM person o, LATERAL (
+    SELECT p.x FROM person m, LATERAL (
+        SELECT r.x FROM person i, LATERAL (
+            WITH RECURSIVE walk(x) AS (
+                SELECT i.id UNION ALL SELECT x+1 FROM walk WHERE x < i.id+2
+            ) SELECT x FROM walk
+        ) r WHERE i.id = m.id
+    ) p WHERE m.id = o.id
+) q WHERE o.id=3;
+----
+5
+
+statement ok
+PRAGMA disable_profiling;
+
+# Cost-based domain placement (duckdb/duckdb#24561, duckdb/duckdb#27426) should bring this back to 3.
+
+query I
+SELECT recursive_rows();
+----
+3000
+
+# Only the lateral joined directly with the selective scan is restricted
+
+statement ok
+PRAGMA enable_profiling='json';
+
+query II
+SELECT max(a.x), max(b.y) FROM person o, LATERAL (
+    SELECT r.x FROM person i, LATERAL (
+        WITH RECURSIVE walk(x) AS (
+            SELECT i.id UNION ALL SELECT x+1 FROM walk WHERE x < i.id+2
+        ) SELECT x FROM walk
+    ) r WHERE i.id = o.id
+) a, LATERAL (
+    SELECT r.y FROM person j, LATERAL (
+        WITH RECURSIVE walk2(y) AS (
+            SELECT j.id UNION ALL SELECT y+1 FROM walk2 WHERE y < j.id+3
+        ) SELECT y FROM walk2
+    ) r WHERE j.id = o.id
+) b WHERE o.id=5;
+----
+7	8
+
+statement ok
+PRAGMA disable_profiling;
+
+# Cost-based domain placement (duckdb/duckdb#24561, duckdb/duckdb#27426) should bring this back to 7.
+
+query I
+SELECT recursive_rows();
+----
+4003
+
+# Restriction of correlated EXISTS subqueries is deferred to cost-based domain placement
+
+statement ok
+PRAGMA enable_profiling='json';
+
+query I
+SELECT count(*) FROM person o WHERE o.id=3 AND EXISTS (
+    SELECT 1 FROM person i, LATERAL (
+        WITH RECURSIVE walk(x) AS (
+            SELECT i.id UNION ALL SELECT x+1 FROM walk WHERE x < i.id+2
+        ) SELECT x FROM walk
+    ) r WHERE i.id = o.id AND r.x > 4
+);
+----
+1
+
+statement ok
+PRAGMA disable_profiling;
+
+# Cost-based domain placement (duckdb/duckdb#24561, duckdb/duckdb#27426) should bring this back to 3.
+
+query I
+SELECT recursive_rows();
+----
+3000
+
+# Prepared statement parameters survive copying the key domain
+
+statement ok
+PREPARE walk_sel AS SELECT max(q.x)
+FROM person o, LATERAL (
+    SELECT r.x FROM person i, LATERAL (
+        WITH RECURSIVE walk(x) AS (
+            SELECT i.id UNION ALL SELECT x+1 FROM walk WHERE x < i.id+2
+        ) SELECT x FROM walk
+    ) r
+    WHERE i.id = o.id
+) q WHERE o.id=$1;
+
+statement ok
+PRAGMA enable_profiling='json';
+
+query I
+EXECUTE walk_sel(3);
+----
+5
+
+statement ok
+PRAGMA disable_profiling;
+
+query I
+SELECT recursive_rows();
+----
+3
+
+# A filtered scan of a large table is not copied as a key domain, even when the filter is selective
+
+statement ok
+CREATE TABLE big AS SELECT i AS id FROM range(100000) t(i);
+
+statement ok
+CREATE MACRO big_scans() AS (
+    SELECT count(*) FROM read_text('{TEST_DIR}/cte_domain_join_filter.json'), json_tree(content)
+    WHERE (value->'extra_info')->>'Table' LIKE '%.main.big'
+);
+
+statement ok
+PRAGMA
```

---

### Incident Patch 3: `3a8bf4bd` (2026-10-27)
**Commit Message**: Cache invariant chunk counts in aggregate hash-table loops (#27859)

I started looking into hash-table and map/set performance after reading
[this post](https://x.com/MOVNTDQ/status/2114045515876995111). While
profiling DuckDB's aggregation code and inspecting instruction and cycle
counts, I stumbled on these repeated chunk-size lookups in the inner
loops.

This PR caches them in `GroupedAggregateHashTable::ReinsertTuples` and
`PerfectAggregateHashTable::AddChunk` as cardinality stays unchanged
during each loop.

In the tested build, hoisting the bounds removes repeated out-of-line
metadata calls and lets the compiler retain invariant table fields.

I ran a few benchmarks on myM4 Pro, Apple Clang 21, Release (`-O3
-mcpu=apple-m1`) and found it quite amazing:

| Change / existing benchmark | Threads | Before mean ± SD (ms) | After
mean ± SD (ms) | Mean time change | Mean instructions change | Mean
cycles change |
|---|---:|---:|---:|---:|---:|---:
| rehash / `large_groups` | 1 | 29.900 ± 2.625 | 27.096 ± 0.854 | -9.38%
| -7.14% | -10.30% |
| rehash / `large_groups` | 2 | 23.983 ± 0.932 | 24.207 ± 1.063 | +0.93%
| -2.93% | -3.37% |
| rehash / `many_groups_large_values_small` | 1 | 19

**File**: `src/execution/aggregate_hashtable.cpp` (modified, +2/-1)
```diff
@@ -378,7 +378,8 @@ void GroupedAggregateHashTable::ReinsertTuples(PartitionedTupleData &data) {
 		TupleDataChunkIterator iterator(*data_collection, TupleDataPinProperties::ALREADY_PINNED, false);
 		const auto row_locations = iterator.GetRowLocations();
 		do {
-			for (idx_t i = 0; i < iterator.GetCurrentChunkCount(); i++) {
+			const auto row_count = iterator.GetCurrentChunkCount();
+			for (idx_t i = 0; i < row_count; i++) {
 				const auto &row_location = row_locations[i];
 				const auto hash = Load<hash_t>(row_location + hash_offset);
 				const auto salt = ht_entry_t::ExtractSalt(hash);
```

**File**: `src/execution/perfect_aggregate_hashtable.cpp` (modified, +4/-3)
```diff
@@ -124,11 +124,12 @@ static void ComputeGroupLocation(const Vector &group, Value &min, uintptr_t *add
 }
 
 void PerfectAggregateHashTable::AddChunk(DataChunk &groups, DataChunk &payload) {
+	const auto row_count = groups.size();
 	// first we need to find the location in the HT of each of the groups
-	FlatVector::SetSize(addresses, groups.size());
+	FlatVector::SetSize(addresses, row_count);
 	auto address_data = FlatVector::GetDataMutable<uintptr_t>(addresses);
 	// zero-initialize the address data
-	memset(address_data, 0, groups.size() * sizeof(uintptr_t));
+	memset(address_data, 0, row_count * sizeof(uintptr_t));
 	D_ASSERT(groups.ColumnCount() == group_minima.size());
 
 	// Compute raw group ids first; convert them to state pointers below if needed.
@@ -143,7 +144,7 @@ void PerfectAggregateHashTable::AddChunk(DataChunk &groups, DataChunk &payload)
 	}
 
 	// Non-clustered path: convert group ids to state pointers and update aggregates.
-	for (idx_t i = 0; i < groups.size(); i++) {
+	for (idx_t i = 0; i < row_count; i++) {
 		const auto group = address_data[i];
 		if (group >= total_groups) {
 			throw InvalidInputException("Perfect hash aggregate: aggregate group %llu exceeded total groups %llu. This "
```

#### Recent Merged Pull Requests:
- **PR #27947** (2026-10-27): Codename 'Islandica' (@h4nsmuller)
- **PR #27935** (2026-10-27): Revert "Merge Rust extension CI groups (#27600)" (@louie-duck)
- **PR #27934** (closed): CI: pull requests skip the rust extension group on linux_arm64_musl and windows_arm64 (@louie-duck)
- **PR #27932** (closed): Skip the reduced-stack deep VARIANT cast test under forced shredding (@louie-duck)
- **PR #27929** (2026-10-27): Push OR of equalities down as an IN filter (@dentiny)
- **PR #27926** (2026-10-27): Use ART index scans for range conjunctions on the indexed column (@dentiny)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
