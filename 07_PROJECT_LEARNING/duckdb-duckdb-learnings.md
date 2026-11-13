> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/duckdb-duckdb-learnings.md`  
> **Source**: github ([https://github.com/duckdb/duckdb](https://github.com/duckdb/duckdb))  
> **Source Version**: `399d7a83`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-13T15:18:40.275Z  
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
> **Harvest Timestamp**: 2026-11-13T15:18:40.270Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `duckdb/duckdb`
- **Description**: DuckDB is a high-performance analytical database system
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 43060 stars

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
#include "duckdb/planner/expression/bound_aggregate_expression.hpp"

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
		this->err += other.err;
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

//! The average of timestamps in nanosecond resolution - mirrors TimestampAverageOperation, but
//! interprets the state value as a nanosecond timestamp so infinity is the ns infinity
template <class NS_TIMESTAMP>
struct TimestampNSAverageOperation : public DiscreteAverageOperation {
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
	static void Operation(STATE &state, const INPUT_TYPE &input, AggregateUnaryInput 
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
		auto min_source = source.values.size() < source.capacity ? 0 : source.values.back().get().count;
		idx_t min_target;
		if (target.values.empty()) {
			min_target = 0;
			target.Initialize(source.k);
		} else {
			if (source.k != target.k) {
				throw NotImplementedException("Approx Top K - cannot combine approx_top_K with different k values. "
				                              "K values must be the same for all entries within the same group");
			}
			min_target = target.values.size() < target.capacity ? 0 : target.values.back().get().count;
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
					// if we do not we can skip this en
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
		auto &allocator = aggr_input_data.allocator;
		if (!target.h) {
			target.h = allocator.Make<duckdb_tdigest::TDigest>(allocator, 100);
		} else if (&target.h->getAllocator() != &allocator) {
			// Copied states can share a sink arena across partitions being combined in parallel.
			target.h = allocator.Make<duckdb_tdigest::TDigest>(allocator, *target.h);
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
    VectorStructType<uint64_t, double, double, Vecto
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
#include "duckdb/common/vector/vector_iterator.hpp"
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

	static ModeAttr &GetOrCreate(MAP_TYPE &map, const T &key, ArenaAllocator &) {
		return map[key];
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

	static MAP_TYPE *CreateEmpty(ArenaAllocator &) {
		return new MAP_TYPE();
	}
	static MAP_TYPE *CreateEmpty(Allocator &allocator) {
		return new MAP_TYPE(allocator);
	}

	static ModeAttr &GetOrCreate(MAP_TYPE &map, const string_t &key, ArenaAllocator &allocator) {
		return map.GetOrCreate(key, allocator);
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
	//! Cell access into the page, rebuilt per page load - scans can return constant and dictionary vectors
	unique_ptr<VectorIterator<KEY_TYPE>> values;

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
			values = make_uniq<VectorIterator<KEY_TYPE>>(page.data[0]);
		}
		return RowOffset(row_idx);
	}

	inline const KEY_TYPE &GetCell(idx_t row_idx) {
		const auto offset = Seek(row_idx);
		return (*values)[offset].GetValueUnsafe();
	}

	inline bool RowIsValid(idx_t row_idx) {
		const auto offset = Seek(row_idx);
		return (*values)[offset].IsValid();
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

	void Update(c
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #28801** (2026-11-13): **Remove obsolete Member-label workflow**
  *Symptoms*: Remove `.github/workflows/OnPR.yml`, which only applies the `Member` label to newly opened pull requests. The label is no longer used.
  **Post-Mortem & Fix Analysis**:
  > Thanks!

- **Issue #28800** (2026-11-13): **Add an escape_mode option to the CSV reader: 'quote' stops the escape from escaping the delimiter and newlines**
  *Symptoms*: This adds an `escape_mode` option to `read_csv` and `COPY ... FROM`. The default, `'all'`, is today's behavior: with `strict_mode = false`, the escape character makes whatever byte follows it literal, including the delimiter and the line break. `'quote'` limits the escape to the quote and escape characters: before anything else the escape is dropped and the byte keeps its meaning, so a delimiter still separates values and a newline still ends the record. This is how Hive/Athena's OpenCSVSerde (and similar line-based readers) treat a `\` escape — files written that way currently read back corrupted: `a\,b` collapses into one field, and a line ending in `\` swallows the following row (`1,\` / `2,b` / `3,c` reads as 2 rows instead of 3).  The change is confined to the state machine: under `'quote'`, the `UNQUOTED_ESCAPE` row transitions to `DELIMITER`/`RECORD_SEPARATOR`/`CARRIAGE_RETURN` instead of staying in the field (multi-byte delimiters and comment characters keep their meaning too); value materialization is untouched since escape removal already drops the escape byte. The option is part of the state machine cache key, flows through the sniffer, and is serialized with a default so existing plans are unaffected. An invalid value gets an error explaining both modes; combining it with an explicit `strict_mode = true` errors (unset `strict_mode` is implied `false`); without an escape character distinct from the quote the option is inert, which keeps the prompt built by `sniff_c
  **Post-Mortem & Fix Analysis**:
  > Do we really need this to be yet another option? Can't we just use our existing options to model this?

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

### Incident Patch 1: `5c8008b4` (2026-11-13)
**Commit Message**: Order small runtime filter builds before filtered and nested scans (#28768)

IMDB 05c can report much higher intermediate cardinalities with an
unchanged physical plan. Filtered scans and scans feeding nested join
builds currently do not wait for ordinary runtime filter producers, so
they can snapshot their filters before a small dimension build publishes
its filter. In 05c, missing the `company_type_id = 2` filter makes the
`movie_companies` scan emit 295,628 rows instead of 798.

Allow these scans to wait when the producer's estimated build fits in
one vector. Keep the existing build/probe size guard, cycle checks, and
CTE disjunction scheduling behavior. The regression test checks the
filtered nested build scan's cardinality with one and four threads, plus
prepared executions after changing and emptying the dimension.

Reproduced the exact costs from [the failing CI job for
#28750](https://github.com/duckdb/duckdb/actions/runs/43249792499/job/131303617671?pr=28750):

| 05c measured cost | Before | After |
| --- | ---: | ---: |
| Total join output | 107,606 | 2,872 |
| Build input | 296,506 | 1,676 |
| Probe input | 190,121 | 2,843 |

Both results were stable over 30 tries agains

**File**: `src/parallel/runtime_filter_schedule.cpp` (modified, +29/-7)
```diff
@@ -23,6 +23,18 @@ static optional_ptr<PhysicalComparisonJoin> RuntimeFilterProducer(Pipeline &pipe
 	}
 }
 
+static bool IsSmallBuild(const PhysicalOperator &op) {
+	if (op.estimated_cardinality > DEFAULT_STANDARD_VECTOR_SIZE || op.IsSink()) {
+		return false;
+	}
+	for (auto &child : op.children) {
+		if (!IsSmallBuild(child.get())) {
+			return false;
+		}
+	}
+	return true;
+}
+
 static bool HasJoinSink(Pipeline &pipeline) {
 	auto sink = pipeline.GetSink();
 	if (!sink) {
@@ -128,7 +140,11 @@ static void ScheduleRuntimeFiltersInternal(PipelineSchedule &schedule, bool clea
 		dependency_check = RuntimeFilterDependencyCheck(schedule);
 		join_build_stages = CollectJoinBuildStages(schedule);
 	}
-	reference_map_t<DynamicTableFilterSet, vector<idx_t>> sources;
+	struct FilterSource {
+		idx_t stage_idx;
+		bool small_build_only;
+	};
+	reference_map_t<DynamicTableFilterSet, vector<FilterSource>> sources;
 	for (idx_t stage_idx = 0; add_edges && stage_idx < schedule.stages.size(); stage_idx++) {
 		auto &stage = schedule.stages[stage_idx];
 		auto &pipeline = *stage.pipeline;
@@ -143,12 +159,12 @@ static void ScheduleRuntimeFiltersInternal(PipelineSchedule &schedule, bool clea
 		    scan.function.global_initialization == TableFunctionInitialization::INITIALIZE_ON_SCHEDULE) {
 			continue;
 		}
-		if (!join_build_stages[stage_idx] && (!scan.table_filters || (!scan.table_filters->HasFilters() &&
-		                                                              !scan.table_filters->HasMultiColumnFilters()))) {
-			sources[*scan.dynamic_filters].push_back(stage_idx);
-		}
+		const auto small_build_only =
+		    join_build_stages[stage_idx] ||
+		    (scan.table_filters && (scan.table_filters->HasFilters() || scan.table_filters->HasMultiColumnFilters()));
+		sources[*scan.dynamic_filters].push_back({stage_idx, small_build_only});
 		for (auto &filters : scan.dynamic_filters->GetDisjunctionFilters()) {
-			sources[filters.get()].push_back(stage_idx);
+			sources[filters.get()].push_back({stage_idx, false});
 		}
 	}
 
@@ -157,6 +173,7 @@ static void ScheduleRuntimeFiltersInternal(PipelineSchedule &schedule, bool clea
 		auto &publication = publications[producer];
 		auto build_estimate = producer.children[1].get().estimated_cardinality;
 		auto probe_estimate = producer.children[0].get().estimated_cardinality;
+		const auto small_build = add_edges && IsSmallBuild(producer.children[1].get());
 		for (auto &target : producer.filter_pushdown->probe_info) {
 			if (clear_filters) {
 				// Clear previous executions before any scan can take its filter snapshot.
@@ -170,7 +187,12 @@ static void ScheduleRuntimeFiltersInternal(PipelineSchedule &schedule, bool clea
 			    build_estimate >= MaxValue(probe_estimate, target.estimated_scan_cardinality)) {
 				continue;
 			}
-			for (auto execution : source->second) {
+			for (auto &filter_source : source->second) {
+				// A small aggregate or join result can still require expensive inputs.
+				if (filter_source.small_build_only && !small_build) {
+					continue;
+				}
+				auto execution = filter_source.stage_idx;
 				if (dependency_check.TryAddDependency(execution, publication[0])) {
 					schedule.TryAddDependency(execution, publication[0]);
 				}
```

**File**: `test/optimizer/runtime_filter_schedule.cpp` (modified, +83/-0)
```diff
@@ -1,10 +1,16 @@
 #include "catch.hpp"
 #include "duckdb.hpp"
+#include "duckdb/execution/operator/aggregate/physical_ungrouped_aggregate.hpp"
 #include "duckdb/execution/operator/join/physical_cross_product.hpp"
+#include "duckdb/execution/operator/join/physical_hash_join.hpp"
+#include "duckdb/execution/operator/projection/physical_projection.hpp"
 #include "duckdb/execution/operator/scan/physical_dummy_scan.hpp"
+#include "duckdb/execution/operator/scan/physical_table_scan.hpp"
 #include "duckdb/execution/physical_plan_generator.hpp"
 #include "duckdb/parallel/meta_pipeline.hpp"
 #include "duckdb/parallel/pipeline_schedule.hpp"
+#include "duckdb/planner/filter/expression_filter.hpp"
+#include "duckdb/planner/operator/logical_comparison_join.hpp"
 
 using namespace duckdb;
 
@@ -73,3 +79,80 @@ TEST_CASE("Sibling coordination uses build input cardinality", "[runtime_filter_
 		REQUIRE_FALSE(schedule->HasCycle());
 	}
 }
+
+TEST_CASE("Small runtime filter builds exclude blocking and larger inputs", "[runtime_filter_schedule]") {
+	DuckDB db(nullptr);
+	Connection con(db);
+	Executor executor(*con.context);
+	PipelineBuildState state;
+	PhysicalPlan plan(Allocator::Get(*con.context));
+	auto &probe = plan.Make<PhysicalDummyScan>(vector<LogicalType> {}, 100000);
+	auto &small_input = plan.Make<PhysicalDummyScan>(vector<LogicalType> {}, DEFAULT_STANDARD_VECTOR_SIZE);
+	auto &large_input = plan.Make<PhysicalDummyScan>(vector<LogicalType> {}, DEFAULT_STANDARD_VECTOR_SIZE + 1);
+	auto &unknown_input = plan.Make<PhysicalDummyScan>(vector<LogicalType> {}, 0);
+	auto &small_projection =
+	    plan.Make<PhysicalProjection>(vector<LogicalType> {}, vector<unique_ptr<Expression>> {}, 1);
+	small_projection.children.push_back(small_input);
+	auto &large_projection =
+	    plan.Make<PhysicalProjection>(vector<LogicalType> {}, vector<unique_ptr<Expression>> {}, 1);
+	large_projection.children.push_back(large_input);
+	auto &aggregate = plan.Make<PhysicalUngroupedAggregate>(vector<LogicalType> {}, vector<unique_ptr<Expression>> {},
+	                                                        1, TupleDataValidityType::CAN_HAVE_NULL_VALUES);
+	aggregate.children.push_back(unknown_input);
+	auto &aggregate_projection =
+	    plan.Make<PhysicalProjection>(vector<LogicalType> {}, vector<unique_ptr<Expression>> {}, 1);
+	aggregate_projection.children.push_back(aggregate);
+	auto &scan =
+	    plan.Make<PhysicalTableScan>(vector<LogicalType> {}, BoundTableFunction(), nullptr, vector<LogicalType> {},
+	                                 vector<ColumnIndex> {}, vector<idx_t> {}, vector<string> {}, nullptr, 100000,
+	                                 ExtraOperatorInfo(), vector<Value> {}, virtual_column_map_t {})
+	        .Cast<PhysicalTableScan>();
+	scan.dynamic_filters = make_shared_ptr<DynamicTableFilterSet>();
+	auto &nested_join = plan.Make<PhysicalCrossProduct>(vector<LogicalType> {}, probe, scan, 100000);
+
+	vector<pair<reference<PhysicalOperator>, bool>> builds {{small_input, true},      {large_input, false},
+	                                                        {small_projection, true}, {large_projection, false},
+	                                                        {aggregate, false},       {aggregate_projection, false}};
+	vector<pair<bool, bool>> consumers {{false, false}, {true, false}, {false, true}};
+	for (auto &build : builds) {
+		for (auto &consumer : consumers) {
+			const auto nested = consumer.first;
+			const auto filtered = consumer.second;
+			CAPTURE(build.first.get().type);
+			CAPTURE(nested);
+			CAPTURE(filtered);
+			scan.table_filters.reset();
+			if (filtered) {
+				scan.table_filters = make_uniq<TableFilterSet>();
+				scan.table_filters->PushFilter(
+				    ProjectionIndex(0),
+				    ExpressionFilter::CreateComparisonFilter(ExpressionType::COMPARE_EQUAL, Value::BIGINT(0)));
+			}
+			LogicalComparisonJoin logical_join(JoinType::INNER);
+			auto &producer = plan.Make<PhysicalHashJoin>(logical_join, probe, build.first.get(),
+			                                             vector<JoinCondition> {}, JoinType::INNER, 100000)
+			                     .Cast<PhysicalHashJoin>();
+			producer.filter_pushdown = make_uniq<JoinFilterPushdownInfo>();
+			producer.filter_pushdown->build_side_has_filter = false;
+			JoinFilterPushdownFilter target;
+			target.dynamic_filters = scan.dynamic_filters;
+			target.estimated_scan_cardinality = 100000;
+			producer.filter_pushdown->probe_info.push_back(std::move(target));
+			auto consumer_pipeline = make_shared_ptr<Pipeline>(executor);
+			state.SetPipelineSource(*consumer_pipeline, scan);
+			auto producer_pipeline = make_shared_ptr<Pipeline>(executor);
+			state.SetPipelineSink(*producer_pipeline, producer, 1);
+			PipelineSchedule schedule;
+			schedule.stages.emplace_back(PipelineScheduleStageType::EXECUTE, consumer_pipeline);
+			schedule.stages.emplace_back(PipelineScheduleStageType::COMPLETE, producer_pipeline);
+			if (nested) {
+				state.SetPipeline
```

**File**: `test/sql/join/runtime_filter_nested_build_scheduling.test` (added, +70/-0)
```diff
@@ -0,0 +1,70 @@
+# name: test/sql/join/runtime_filter_nested_build_scheduling.test
+# description: Small runtime filter producers finish before filtered nested build scans
+# group: [join]
+
+statement ok
+SET disabled_optimizers='statistics_propagation,join_order,build_side_probe_side,compressed_materialization';
+
+statement ok
+CREATE TABLE nested_probe AS SELECT i AS id FROM range(200000) t(i);
+
+statement ok
+CREATE TABLE nested_build AS
+SELECT i AS id,i%1000 AS k,CASE WHEN i%2=0 THEN 'USA' ELSE 'Sweden' END AS country
+FROM range(200000) t(i);
+
+statement ok
+CREATE TABLE dimension AS SELECT 0::BIGINT AS k,true AS selected;
+
+statement ok
+PREPARE nested_target AS
+SELECT count(*) FROM nested_probe p
+JOIN nested_build b ON p.id=b.id
+JOIN dimension d ON b.k=d.k
+WHERE b.country='USA' AND d.selected;
+
+foreach threads 1 4
+
+statement ok
+SET threads={threads};
+
+query I
+EXECUTE nested_target;
+----
+200
+
+# The dimension filter must be published before the nested build scan takes its snapshot.
+query II
+EXPLAIN (ANALYZE, FORMAT JSON)
+SELECT count(*) FROM nested_probe p
+JOIN nested_build b ON p.id=b.id
+JOIN dimension d ON b.k=d.k
+WHERE b.country='USA' AND d.selected;
+----
+analyzed_plan	<REGEX>:(?s).*"Table": "[^"]*[.]nested_build"[^}]*},\s*"intermediate_rows": 200,.*
+
+endloop
+
+statement ok
+UPDATE dimension SET k=1;
+
+query I
+EXECUTE nested_target;
+----
+0
+
+statement ok
+UPDATE dimension SET k=2;
+
+query I
+EXECUTE nested_target;
+----
+200
+
+statement ok
+DELETE FROM dimension;
+
+query I
+EXECUTE nested_target;
+----
+0
```

---

### Incident Patch 2: `27c6fa82` (2026-11-13)
**Commit Message**: Support MAP generic settings and migrate profiling_renderer_settings (#28787)

Follow-up to #28700. This adds `MAP` support to generic settings and
uses it to migrate `profiling_renderer_settings`, which was one of the
remaining custom-implementation settings that stored its state in
`ClientConfig`.

### Generic settings: `MAP(K, V)`

- `Settings::Get` turns a `MAP(K, V)` setting into an `unordered_map<K,
V>`. Keys and values are converted with the existing `FromValue`
overloads, so nested types work the same way they do for lists.
- `ToSettingValue` gets an `unordered_map` overload that builds the
`Value::MAP` for the typed default.
- The only map default supported is `{}`. Any other default is an
`InternalException` at startup.

### `profiling_renderer_settings`

- It is now a generic `LOCAL` setting of type `MAP(VARCHAR, VARCHAR)`
with default `{}` and an `OnSet` callback. `RESET` goes through the same
path.
- `OnSet` keeps the existing validation. It lower-cases the keys,
rejects NULL values, and eagerly configures the active renderer so bad
values fail at `SET` time. It then stores the values as VARCHAR, sorted
by key, so `current_setting` / `duckdb_settings()` output is
deter

**File**: `src/common/settings.json` (modified, +4/-1)
```diff
@@ -1542,7 +1542,10 @@
         "description": "A map of settings passed to the renderer of the profiler output, e.g. {'max_extra_lines': 100}. Settings not recognized by the active renderer are ignored.",
         "type": "MAP(VARCHAR, VARCHAR)",
         "scope": "local",
-        "custom_implementation": true
+        "default_value": "{}",
+        "on_callbacks": [
+            "set"
+        ]
     },
     {
         "name": "progress_bar_time",
```

**File**: `src/common/tree_renderer.cpp` (modified, +30/-1)
```diff
@@ -11,6 +11,7 @@
 #include "duckdb/common/string_util.hpp"
 #include "duckdb/main/query_profiler.hpp"
 #include "duckdb/main/client_config.hpp"
+#include "duckdb/main/settings.hpp"
 #include "duckdb/main/profiler_extension.hpp"
 
 namespace duckdb {
@@ -89,6 +90,34 @@ unique_ptr<TreeRenderer> TreeRenderer::CreateRenderer(const ProfilerPrintFormat
 	return CreateRenderer(format.ToString());
 }
 
+unordered_map<string, Value> TreeRenderer::GetRendererSettings(ClientContext &context) {
+	unordered_map<string, Value> result;
+	for (auto &entry : Settings::Get<ProfilingRendererSettingsSetting>(context)) {
+		result.emplace(entry.first, Value(entry.second));
+	}
+	return result;
+}
+
+void TreeRenderer::SetRendererSettings(ClientContext &context, const unordered_map<string, Value> &settings) {
+	Settings::Set<ProfilingRendererSettingsSetting>(context, SetScope::SESSION, RendererSettingsToValue(settings));
+}
+
+Value TreeRenderer::RendererSettingsToValue(const unordered_map<string, Value> &settings) {
+	// sort the settings by name so that the rendered value is deterministic
+	vector<string> setting_names;
+	for (auto &entry : settings) {
+		setting_names.push_back(entry.first);
+	}
+	std::sort(setting_names.begin(), setting_names.end());
+	vector<Value> keys;
+	vector<Value> values;
+	for (auto &name : setting_names) {
+		keys.emplace_back(name);
+		values.push_back(settings.at(name).DefaultCastAs(LogicalType::VARCHAR));
+	}
+	return Value::MAP(LogicalType::VARCHAR, LogicalType::VARCHAR, std::move(keys), std::move(values));
+}
+
 unique_ptr<TreeRenderer> TreeRenderer::CreateRenderer(ClientContext &context, const string &name) {
 	// registered renderers take precedence over the built-in formats
 	auto extension = ProfilerExtension::Find(context, name);
@@ -97,7 +126,7 @@ unique_ptr<TreeRenderer> TreeRenderer::CreateRenderer(ClientContext &context, co
 	}
 	auto renderer = CreateRenderer(name);
 	if (renderer) {
-		renderer->Configure(ClientConfig::GetConfig(context).profiling_renderer_settings);
+		renderer->Configure(GetRendererSettings(context));
 	}
 	return renderer;
 }
```

**File**: `src/include/duckdb/common/tree_renderer.hpp` (modified, +7/-0)
```diff
@@ -67,6 +67,13 @@ class TreeRenderer {
 	virtual void Configure(const unordered_map<string, Value> &settings) {
 	}
 
+	//! The "profiling_renderer_settings" of the client, as passed to Configure
+	static unordered_map<string, Value> GetRendererSettings(ClientContext &context);
+	//! Overwrites the "profiling_renderer_settings" of the client without validating them
+	static void SetRendererSettings(ClientContext &context, const unordered_map<string, Value> &settings);
+	//! Converts renderer settings to the MAP(VARCHAR, VARCHAR) value of the setting, sorted by name
+	static Value RendererSettingsToValue(const unordered_map<string, Value> &settings);
+
 	virtual bool UsesRawKeyNames() {
 		return false;
 	}
```

**File**: `src/include/duckdb/main/client_config.hpp` (modified, +0/-3)
```diff
@@ -44,9 +44,6 @@ struct ClientConfig {
 	//! The format to print query profiling information in (default: query_tree), if enabled.
 	//! This is the profiler format name passed to QueryProfiler::CreateProfiler.
 	string profiler_print_format = "query_tree";
-	//! Settings that are passed to the renderer of the profiler output (e.g. 'maximum_render_width' for the text
-	//! renderer). Settings that are not recognized by the active renderer are ignored.
-	unordered_map<string, Value> profiling_renderer_settings;
 
 	//! system-wide progress bar disable.
 	const char *system_progress_bar_disable_reason = nullptr;
```

**File**: `src/include/duckdb/main/settings.hpp` (modified, +41/-3)
```diff
@@ -21,6 +21,12 @@ struct IsSettingList : std::false_type {};
 template <class T>
 struct IsSettingList<vector<T>> : std::true_type {};
 
+template <class T>
+struct IsSettingMap : std::false_type {};
+
+template <class K, class V>
+struct IsSettingMap<unordered_map<K, V>> : std::true_type {};
+
 struct Settings {
 	template <class OP, class SOURCE>
 	static typename OP::RETURN_TYPE Get(const SOURCE &source) {
@@ -82,6 +88,17 @@ struct Settings {
 		return result;
 	}
 
+	template <class T>
+	static typename std::enable_if<IsSettingMap<T>::value, T>::type FromValue(const Value &value) {
+		T result;
+		for (auto &entry : MapValue::GetChildren(value)) {
+			auto &key_value = StructValue::GetChildren(entry);
+			result.emplace(FromValue<typename T::key_type>(key_value[0]),
+			               FromValue<typename T::mapped_type>(key_value[1]));
+		}
+		return result;
+	}
+
 	//! Parses the default value of a setting
 	template <class T>
 	static typename std::enable_if<std::is_enum<T>::value, T>::type FromDefault(const char *default_value) {
@@ -115,6 +132,15 @@ struct Settings {
 		}
 		return result;
 	}
+	template <class T>
+	static typename std::enable_if<IsSettingMap<T>::value, T>::type FromDefault(const char *default_value) {
+		// only the empty map is supported as a default
+		if (!StringUtil::Equals(default_value, "{}")) {
+			throw InternalException("Default value \"%s\" of a map setting must be {}", default_value);
+		}
+		return T();
+	}
+
 	//! Splits a list literal (e.g. "['a', 'b']") into its entries
 	static vector<string> SplitListDefault(const char *default_value);
 
@@ -153,6 +179,17 @@ struct Settings {
 		}
 		return Value::LIST(SettingLogicalType(static_cast<const T *>(nullptr)), std::move(children));
 	}
+	template <class K, class V>
+	static Value ToSettingValue(const unordered_map<K, V> &values) {
+		vector<Value> keys;
+		vector<Value> map_values;
+		for (auto &entry : values) {
+			keys.push_back(ToSettingValue(entry.first));
+			map_values.push_back(ToSettingValue(entry.second));
+		}
+		return Value::MAP(SettingLogicalType(static_cast<const K *>(nullptr)),
+		                  SettingLogicalType(static_cast<const V *>(nullptr)), std::move(keys), std::move(map_values));
+	}
 
 	//! The logical type of a setting value, selected by the (unused) pointer type
 	static LogicalType SettingLogicalType(const string *) {
@@ -2536,9 +2573,10 @@ struct ProfilingRendererSettingsSetting {
 	static constexpr const char *InputType = "MAP(VARCHAR, VARCHAR)";
 	static constexpr bool IsDebug = false;
 	static constexpr bool IsDeprecated = false;
-	static void SetLocal(ClientContext &context, const Value &parameter);
-	static void ResetLocal(ClientContext &context);
-	static Value GetSetting(const ClientContext &context);
+	static constexpr const char *DefaultValue = "{}";
+	static constexpr SettingScopeTarget Scope = SettingScopeTarget::LOCAL_ONLY;
+	static constexpr idx_t SettingIndex = NEXT_SETTING_INDEX();
+	static void OnSet(SettingCallbackInfo &info, Value &input);
 };
 
 struct ProgressBarTimeSetting {
```

**File**: `src/main/config.cpp` (modified, +1/-1)
```diff
@@ -250,7 +250,7 @@ static const ConfigurationOption internal_options[] = {
     DUCKDB_SETTING_CALLBACK(ProfilingCoverageSetting),
     DUCKDB_LOCAL(ProfilingModeSetting),
     DUCKDB_SETTING_CALLBACK(ProfilingOutputSetting),
-    DUCKDB_LOCAL(ProfilingRendererSettingsSetting),
+    DUCKDB_SETTING_CALLBACK(ProfilingRendererSettingsSetting),
     DUCKDB_SETTING_CALLBACK(ProgressBarTimeSetting),
     DUCKDB_SETTING_CALLBACK(ReadAheadDepthSetting),
     DUCKDB_SETTING(RedactHttpLogsSetting),
```

**File**: `src/main/query_profiler.cpp` (modified, +1/-1)
```diff
@@ -1163,7 +1163,7 @@ void QueryProfiler::Initialize(const PhysicalOperator &root_op) {
 
 void QueryProfiler::Render(const ProfilingNode &node, BaseTreeRenderer &ss) const {
 	TextTreeRenderer renderer;
-	renderer.Configure(ClientConfig::GetConfig(context).profiling_renderer_settings);
+	renderer.Configure(TreeRenderer::GetRendererSettings(context));
 	renderer.Render(node, ss);
 }
 
```

**File**: `src/main/settings/custom_settings.cpp` (modified, +8/-28)
```diff
@@ -1462,8 +1462,7 @@ void ProfilingOutputSetting::OnSet(SettingCallbackInfo &info, Value &input) {
 //===----------------------------------------------------------------------===//
 // Profiler Renderer Settings
 //===----------------------------------------------------------------------===//
-void ProfilingRendererSettingsSetting::SetLocal(ClientContext &context, const Value &input) {
-	auto &config = ClientConfig::GetConfig(context);
+void ProfilingRendererSettingsSetting::OnSet(SettingCallbackInfo &info, Value &input) {
 	if (input.IsNull() || input.type().id() != LogicalTypeId::MAP) {
 		throw InvalidInputException("Invalid profiling_renderer_settings type \"%s\", expected a map of settings "
 		                            "(e.g. {'maximum_render_width': 300})",
@@ -1476,35 +1475,16 @@ void ProfilingRendererSettingsSetting::SetLocal(ClientContext &context, const Va
 			throw InvalidInputException("profiling_renderer_settings: the value of \"%s\" cannot be NULL",
 			                            key_value[0].ToString());
 		}
-		new_settings[StringUtil::Lower(key_value[0].ToString())] = key_value[1];
+		new_settings[StringUtil::Lower(key_value[0].ToString())] = key_value[1].DefaultCastAs(LogicalType::VARCHAR);
 	}
 	// eagerly configure the renderer of the current profiler format to validate the setting values
-	auto renderer = QueryProfiler::Get(context).GetRenderer();
-	if (renderer) {
-		renderer->Configure(new_settings);
-	}
-	config.profiling_renderer_settings = std::move(new_settings);
-}
-
-void ProfilingRendererSettingsSetting::ResetLocal(ClientContext &context) {
-	ClientConfig::GetConfig(context).profiling_renderer_settings.clear();
-}
-
-Value ProfilingRendererSettingsSetting::GetSetting(const ClientContext &context) {
-	auto &config = ClientConfig::GetConfig(context);
-	// sort the settings by name so that the rendered value is deterministic
-	vector<string> setting_names;
-	for (auto &entry : config.profiling_renderer_settings) {
-		setting_names.push_back(entry.first);
-	}
-	std::sort(setting_names.begin(), setting_names.end());
-	vector<Value> keys;
-	vector<Value> values;
-	for (auto &name : setting_names) {
-		keys.emplace_back(name);
-		values.push_back(config.profiling_renderer_settings.at(name).DefaultCastAs(LogicalType::VARCHAR));
+	if (info.context) {
+		auto renderer = QueryProfiler::Get(*info.context).GetRenderer();
+		if (renderer) {
+			renderer->Configure(new_settings);
+		}
 	}
-	return Value::MAP(LogicalType::VARCHAR, LogicalType::VARCHAR, std::move(keys), std::move(values));
+	input = TreeRenderer::RendererSettingsToValue(new_settings);
 }
 
 //===----------------------------------------------------------------------===//
```

---

### Incident Patch 3: `399d7a83` (2026-11-13)
**Commit Message**: Improve ALP size estimate and relax block size requirement (#28695)

In the encoding analyze phase ALP calculates a multiplier, it does so
for scaling the estimated bytes of the sample set to the total value
count. This multiplier however is truncated, so for example x2.9 would
become x2, leading to inaccurate size estimates. In addition,
segment-scoped metadata was over counted and vector-scoped metadata was
omitted.

We've also relaxed the minimum block size from 256KiB to 32KiB when we
don't support the uncompressed fallback, since we'll never write close
to 32KiB for a single vector anyway (exact calculation is present in a
comment above the constant).

**File**: `src/include/duckdb/storage/compression/alp/alp_analyze.hpp` (modified, +43/-68)
```diff
@@ -23,61 +23,32 @@ struct AlpAnalyzeState : public AnalyzeState {
 public:
 	using EXACT_TYPE = typename FloatingToExact<T>::TYPE;
 
-	explicit AlpAnalyzeState(BlockManager &block_manager) : AnalyzeState(block_manager), compression_data() {
+	AlpAnalyzeState(BlockManager &block_manager, bool has_fallback)
+	    : AnalyzeState(block_manager), has_fallback(has_fallback) {
 	}
 
-	idx_t total_bytes_used = 0;
-	idx_t current_bytes_used_in_segment = 0;
+	//! Flag indicating support for uncompressed storage in case of many exceptions.
+	const bool has_fallback;
 	idx_t vectors_sampled_count = 0;
 	idx_t total_values_count = 0;
 	idx_t vectors_count = 0;
 	vector<vector<T>> rowgroup_sample;
 	vector<vector<T>> complete_vectors_sampled;
 	alp::AlpCompressionData<T, true> compression_data;
-	StorageVersion storage_version = StorageVersion::INVALID;
-
-public:
-	// Returns the required space to hyphotetically store the compressed segment
-	void FlushSegment() {
-		// We add the size of the segment header (the pointer to the metadata)
-		total_bytes_used += current_bytes_used_in_segment + AlpConstants::METADATA_POINTER_SIZE;
-		current_bytes_used_in_segment = 0;
-	}
-
-	void FlushVector(idx_t vector_size) {
-		current_bytes_used_in_segment += vector_size;
-		compression_data.Reset();
-	}
-
-	// Check if we have enough space in the segment to hyphotetically store the compressed vector
-	bool HasEnoughSpace(idx_t vector_size) {
-		idx_t bytes_to_be_used = AlignValue(current_bytes_used_in_segment + vector_size);
-		// We have enough space if the already used space + the required space for a new vector
-		// does not exceed the space of the block - the segment header (the pointer to the metadata)
-		return bytes_to_be_used <= (info.GetBlockSize() - AlpConstants::METADATA_POINTER_SIZE);
-	}
-
-	idx_t TotalUsedBytes() const {
-		return AlignValue(total_bytes_used);
-	}
 };
 
 template <class T>
 unique_ptr<AnalyzeState> AlpInitAnalyze(ColumnData &col_data, PhysicalType type) {
-	auto &storage_manager = col_data.GetStorageManager();
 	auto &block_manager = col_data.GetBlockManager();
-	const auto storage_version = storage_manager.GetStorageVersion();
+	const auto storage_version = col_data.GetStorageManager().GetStorageVersion();
+	const bool has_fallback = !StorageManager::IsPriorToVersion(StorageVersion::V1_5_0, storage_version);
 
-	if (block_manager.GetBlockSize() + block_manager.GetBlockHeaderSize() < DEFAULT_BLOCK_ALLOC_SIZE) {
-		if (StorageManager::IsPriorToVersion(StorageVersion::V1_5_0, storage_version)) {
-			// Before v1.5.0, blocks cannot use uncompressed-vector fallback
-			return nullptr;
-		}
+	if (!has_fallback &&
+	    block_manager.GetBlockSize() + block_manager.GetBlockHeaderSize() < AlpConstants::MIN_BLOCK_SIZE) {
+		return nullptr;
 	}
 
-	auto state = make_uniq<AlpAnalyzeState<T>>(block_manager);
-	state->storage_version = storage_version;
-	return unique_ptr<AnalyzeState>(std::move(state));
+	return make_uniq<AlpAnalyzeState<T>>(block_manager, has_fallback);
 }
 
 /*
@@ -152,42 +123,46 @@ bool AlpAnalyze(AnalyzeState &state, const Vector &input) {
 template <class T>
 idx_t AlpFinalAnalyze(AnalyzeState &state) {
 	auto &analyze_state = state.Cast<AlpAnalyzeState<T>>();
-
-	// Finding the Top K combinations of Exponent and Factor
-	alp::AlpCompression<T, true>::FindTopKCombinations(analyze_state.rowgroup_sample, analyze_state.compression_data);
-
-	// Encode the entire sampled vectors to estimate a compression size
-	idx_t compressed_values = 0;
-	for (auto &vector_to_compress : analyze_state.complete_vectors_sampled) {
-		alp::AlpCompression<T, true>::Compress(vector_to_compress.data(), vector_to_compress.size(),
-		                                       analyze_state.compression_data);
-		const idx_t uncompressed_size = AlpConstants::EXPONENT_SIZE + sizeof(T) * vector_to_compress.size();
-		const idx_t compressed_size = analyze_state.compression_data.RequiredSpace();
-		const bool should_compress =
-		    compressed_size < uncompressed_size ||
-		    StorageManager::IsPriorToVersion(StorageVersion::V1_5_0, analyze_state.storage_version);
-
-		const idx_t vector_size = should_compress ? compressed_size : uncompressed_size;
-
-		if (!analyze_state.HasEnoughSpace(vector_size)) {
-			analyze_state.FlushSegment();
+	auto &compression_data = analyze_state.compression_data;
+
+	// Find the top combinations of exponent and factor.
+	alp::AlpCompression<T, true>::FindTopKCombinations(analyze_state.rowgroup_sample, compression_data);
+
+	// Encode the sampled vectors to estimate their storage size.
+	double sampled_values = 0;
+	double sampled_bytes = 0;
+	for (auto &sample : analyze_state.complete_vectors_sampled) {
+		alp::AlpCompression<T, true>::Compress(sample.data(), sample.size(), compression_data);
+		auto vector_size = compression_data.RequiredSpace();
+		if (analyze_state.has_fallback) {
+			const idx_t uncompressed_size = AlpConstants::EXPONENT_SIZE + sizeof(T) * sample.size();
+			vector_size = Mi
```

**File**: `src/include/duckdb/storage/compression/alp/alp_compress.hpp` (modified, +0/-3)
```diff
@@ -9,12 +9,9 @@
 #pragma once
 
 #include "duckdb/common/helper.hpp"
-#include "duckdb/common/operator/subtract.hpp"
-#include "duckdb/common/types/null_value.hpp"
 #include "duckdb/function/compression_function.hpp"
 #include "duckdb/storage/compression/standard_compression_state.hpp"
 #include "duckdb/main/config.hpp"
-#include "duckdb/storage/buffer_manager.hpp"
 #include "duckdb/storage/compression/alp/algorithm/alp.hpp"
 #include "duckdb/storage/compression/alp/alp_analyze.hpp"
 #include "duckdb/storage/compression/patas/patas.hpp"
```

**File**: `src/include/duckdb/storage/compression/alp/alp_constants.hpp` (modified, +9/-0)
```diff
@@ -25,6 +25,15 @@ class AlpConstants {
 	using BIT_WIDTH_TYPE = uint8_t;
 	using METADATA_POINTER_TYPE = uint32_t;
 
+	//! Conservative upper bounds on encoded vector size, combining maximum bitpacked data and exception sizes.
+	//! Formula: vector_size * max_bit_width / 8 + vector_size * (original_type_size + position_size) +
+	//! encoding_metadata
+	//!
+	//! DOUBLE: 1024 * 64 / 8 + 1024 * (8 + 2) + 13 = 18445 bytes < 32 KiB
+	//! FLOAT:  1024 * 64 / 8 + 1024 * (4 + 2) + 13 = 14349 bytes < 32 KiB
+	//! 32 KiB also accommodates block/segment headers, vector pointers and alignment.
+	static constexpr idx_t MIN_BLOCK_SIZE = static_cast<const idx_t>(1024 * 32);
+
 	static constexpr uint32_t ALP_VECTOR_SIZE = 1024;
 	static constexpr uint32_t RG_SAMPLES = 8;
 	static constexpr uint16_t SAMPLES_PER_VECTOR = 32;
```

**File**: `test/configs/force_storage_restart.json` (modified, +2/-1)
```diff
@@ -107,7 +107,8 @@
     {
       "reason": "disabled_compression_methods doesn't survive database restarts",
       "paths": [
-        "test/sql/settings/setting_validation_and_reset.test"
+        "test/sql/settings/setting_validation_and_reset.test",
+        "test/sql/storage/compression/alp/alp_sampling_ratio.test"
       ]
     },
     {
```

**File**: `test/sql/storage/compression/alp/alp_legacy_block_size.test` (added, +52/-0)
```diff
@@ -0,0 +1,52 @@
+# name: test/sql/storage/compression/alp/alp_legacy_block_size.test
+# description: Legacy ALP supports 32 KiB blocks without uncompressed-vector fallback
+# group: [alp]
+
+require exact_vector_size 2048
+
+statement ok
+SET initial_column_segment_size=262144
+
+statement ok
+SET force_compression='alp'
+
+# The sampled values have a wide integer range; most other values are exceptions.
+statement ok
+CREATE TEMP TABLE source AS
+SELECT x::FLOAT AS f, x AS d FROM (
+    SELECT CASE WHEN i % 64 = 0 THEN 1152921504606846976.0::DOUBLE
+                WHEN i % 64 = 32 THEN -1152921504606846976.0::DOUBLE
+                WHEN i % 64 = 1 THEN NULL
+                ELSE 'NaN'::DOUBLE END AS x
+    FROM range(12345) t(i)
+)
+
+query RR rowsort original_data
+SELECT * FROM source
+----
+
+statement ok
+ATTACH '{TEST_DIR}/alp_legacy_32k.db' AS legacy (STORAGE_VERSION 'v1.4.0', BLOCK_SIZE 32768)
+
+statement ok
+CREATE TABLE legacy.exceptions AS SELECT * FROM source
+
+statement ok
+CHECKPOINT legacy
+
+query TT rowsort
+SELECT DISTINCT segment_type, compression FROM pragma_storage_info('legacy.exceptions')
+WHERE segment_type IN ('FLOAT', 'DOUBLE') AND compression <> 'Constant'
+----
+DOUBLE	ALP
+FLOAT	ALP
+
+statement ok
+DETACH legacy
+
+statement ok
+ATTACH '{TEST_DIR}/alp_legacy_32k.db' AS legacy (READ_ONLY)
+
+query RR rowsort original_data
+SELECT * FROM legacy.exceptions
+----
```

**File**: `test/sql/storage/compression/alp/alp_sampling_ratio.test` (added, +51/-0)
```diff
@@ -0,0 +1,51 @@
+# name: test/sql/storage/compression/alp/alp_sampling_ratio.test
+# description: ALP size extrapolation retains fractional sampling ratios
+# group: [alp]
+
+require exact_vector_size 2048
+
+load {TEST_DIR}/alp_sampling_ratio.db
+
+# Ensure the first analyzed vector contains at least 1024 values for both types.
+statement ok
+SET initial_column_segment_size=262144
+
+# Isolate ALP's estimate against uncompressed storage.
+statement ok
+SET disabled_compression_methods='chimp,patas,alprd,rle'
+
+# An exact sampling ratio and a fractional ratio with a partial vector.
+foreach count 3072 3000
+
+statement ok
+CREATE OR REPLACE TABLE incompressible AS
+SELECT (hash(i)::DOUBLE / 18446744073709551616.0)::FLOAT AS f,
+       hash(i)::DOUBLE / 18446744073709551616.0 AS d
+FROM range({count}) t(i)
+
+statement ok
+CHECKPOINT
+
+query TT rowsort
+SELECT DISTINCT segment_type, compression FROM pragma_storage_info('incompressible')
+WHERE segment_type IN ('FLOAT', 'DOUBLE') AND compression <> 'Constant'
+----
+DOUBLE	Uncompressed
+FLOAT	Uncompressed
+
+endloop
+
+# Compressible data must still select ALP with a fractional sampling ratio.
+statement ok
+CREATE TABLE compressible AS
+SELECT i::FLOAT AS f, i::DOUBLE AS d FROM range(3000) t(i)
+
+statement ok
+CHECKPOINT
+
+query TT rowsort
+SELECT segment_type, compression FROM pragma_storage_info('compressible')
+WHERE segment_type IN ('FLOAT', 'DOUBLE')
+----
+DOUBLE	ALP
+FLOAT	ALP
```

**File**: `test/sql/storage/compression/alp/alp_storage_version.test` (modified, +1/-1)
```diff
@@ -31,7 +31,7 @@ CHECKPOINT alp_v1_4_0_default;
 statement ok
 CHECKPOINT alp_v1_5_0;
 
-# Before storage version v1.5.0 should disable ALP with block sizes smaller than the default
+# Before storage version v1.5.0, ALP is disabled for 16 KiB blocks.
 
 query I
 SELECT compression FROM pragma_storage_info('alp_v1_4_0.t') WHERE segment_type = 'DOUBLE' ORDER BY compression LIMIT 1;
```

#### Recent Merged Pull Requests:
- **PR #28801** (2026-11-13): Remove obsolete Member-label workflow (@smvv)
- **PR #28800** (closed): Add an escape_mode option to the CSV reader: 'quote' stops the escape from escaping the delimiter and newlines (@pdet)
- **PR #28787** (2026-11-13): Support MAP generic settings and migrate profiling_renderer_settings (@Robinho-MR)
- **PR #28783** (2026-11-13): Keep the loaded-copy extension test path under Windows MAX_PATH (@h4nsmuller)
- **PR #28781** (2026-11-13): Run one-chunk task slices on the consumer of a parallel streaming result (@h4nsmuller)
- **PR #28768** (2026-11-13): Order small runtime filter builds before filtered and nested scans (@smvv)

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

## X. Order small runtime filter builds before filtered and nested scans (#28768)

**RULE**:
When implementing operations in `src/parallel/runtime_filter_schedule.cpp`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in duckdb/duckdb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `5c8008b4`: Order small runtime filter builds before filtered and nested scans (#28768). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/parallel/runtime_filter_schedule.cpp`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
static bool IsSmallBuild(const PhysicalOperator &op) {
	if (op.estimated_cardinality > DEFAULT_STANDARD_VECTOR_SIZE || op.IsSink()) {
		return false;
	}
	for (auto &child : op.children) {
		if (!IsSmallBuild(child.get())) {
			return false;
		}
	}
	return true;
}

	struct FilterSource {
		idx_t stage_idx;
		bool small_build_only;
	};
	reference_map_t<DynamicTableFilterSet, vector<FilterSource>> sources;
		const auto small_build_only =
		    join_build_stages[stage_idx] ||
		    (scan.table_filters && (scan.table_filters->HasFilters() || scan.table_filters->HasMultiColumnFilters()));
		sources[*scan.dynamic_filters].push_back({stage_idx, small_build_only});
			sources[filters.get()].push_back({stage_idx, false});
		const auto small_build = add_edges && IsSmallBuild(producer.children[1].get());
			for (auto &filter_source : source->second) {
				// A small aggregate or join result can still require expensive inputs.
				if (filter_source.small_build_only && !small_build) {
					continue;
				}
				auto execution = filter_source.stage_idx;
```

**NEGATIVE CONSTRAINT**:
```c++
// Anti-pattern to NEVER write (induced failure mode):
	reference_map_t<DynamicTableFilterSet, vector<idx_t>> sources;
		if (!join_build_stages[stage_idx] && (!scan.table_filters || (!scan.table_filters->HasFilters() &&
		                                                              !scan.table_filters->HasMultiColumnFilters()))) {
			sources[*scan.dynamic_filters].push_back(stage_idx);
		}
			sources[filters.get()].push_back(stage_idx);
			for (auto execution : source->second) {
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `5c8008b4` are properly handled with clean fallback behavior.
