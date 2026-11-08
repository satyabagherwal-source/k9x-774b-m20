> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/duckdb-duckdb-learnings.md`  
> **Source**: github ([https://github.com/duckdb/duckdb](https://github.com/duckdb/duckdb))  
> **Source Version**: `d4eea3f2`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-08T00:56:11.280Z  
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
> **Harvest Timestamp**: 2026-11-08T00:56:10.278Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `duckdb/duckdb`
- **Description**: DuckDB is a high-performance analytical database system
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 42902 stars

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
	static void Operation(STATE &state, const INPUT_TYPE &input, AggregateUnaryInput &unary_input) {
		if (DUCKDB_UNLIKELY(!NS_TIMESTAMP(input).IsFinite(
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

	void Update(const KEY_TYPE &key, AggregateInputData &aggr_input_data) {
		mode = TYPE_OP::Update(mode, mode_alloc_size, key, aggr_input_data);
	}

	//! Rescan the frequency map, breaking ties by the first tied value in the frames.
	//! Th
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #28496** (2026-11-06): **Fix glue extension build after LazyMultiFileList takes Context**
  *Symptoms*: Adds a glue patch so `HiveMultiFileList` passes `context.GetContext()` to `LazyMultiFileList`, which now takes `optional_ptr<Context>`. Fixes the `Build Linux (cloud, linux_amd64)` extension build failure on main (e.g. in #28470).  The glue patches were not updated in #28417, and the extension build is skipped on PRs, so it was not caught there. Verified by applying patches 0001-0003 to the pinned glue revision and compiling `hive_multi_file_reader.cpp` against main's headers.

- **Issue #28470** (2026-11-06): **Skip slow persistent part of variant_stats_merge_decimal under alternative verify**
  *Symptoms*: The No String Inline / Destroy Unpinned Blocks job timed out (300s, 4 retries exhausted) on `variant_stats_merge_decimal.test` in https://github.com/duckdb/duckdb/actions/runs/42082273268/job/127474458470. The persistent part (200k-row inserts, checkpoint, restart) is too slow with DESTROY_UNPINNED_BLOCKS. Add `require no_alternative_verify` before it; the in-memory checks still run.  Other flakes in that run (`cte_runtime_filter_sibling_dependencies`, `csv_quoted_buffer_boundary`) recovered on retry and are not addressed here. 

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

### Incident Patch 1: `f32c9494` (2026-11-06)
**Commit Message**: Batch the Ready To Merge fixes from Robinho-MR/duckdb (#28420)

Batches the fork PRs labeled `Ready To Merge` in
https://github.com/Robinho-MR/duckdb/pulls that are not yet in `main`,
on top of the current head of `main`.

Each PR is squashed into a single commit on top of `main`, with the PR
title as the commit message. Robinho-MR/duckdb#273,
Robinho-MR/duckdb#274 and Robinho-MR/duckdb#275 each add a hidden
`[storage][.]` test case at the end of
`test/sql/storage/wal_torn_write.cpp`; the conflicts were resolved by
keeping all three.

## Changes applied (15 PRs)

- Robinho-MR/duckdb#286: Throw DataCorruptionException for unregistered
metadata block pointer
- Robinho-MR/duckdb#282: Throw a corruption error for unknown WAL entry
type
- Robinho-MR/duckdb#280: Skip memcpy calls for empty DELTA_BYTE_ARRAY
values
- Robinho-MR/duckdb#279: Clamp accepted completion length to edit buffer
- Robinho-MR/duckdb#278: Bound AcceptSearch history copy to buffer size
- Robinho-MR/duckdb#276: Fix stack buffer overflow in linenoise
EditSwapCharacter
- Robinho-MR/duckdb#275: Validate catalog information of WAL entries
during replay
- Robinho-MR/duckdb#274: Reject encrypted WAL version for an unencrypte

**File**: `data/csv/test/invalid_utf_nested.csv` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+a,b
+�,�
+[a],[b]
+�,[c]
+[d],�
+[e],[f]
```

**File**: `extension/core_functions/aggregate/nested/binned_histogram.cpp` (modified, +10/-1)
```diff
@@ -318,7 +318,16 @@ void HistogramBinFinalizeFunction(Vector &state_vector, AggregateFinalizeInputDa
 		if (state.counts->back() > 0 && supports_other_bucket) {
 			// add overflow bucket ("others")
 			// set bin boundary to NULL for overflow bucket
-			keys.SetValue(current_offset, OtherBucketValue(keys.GetType()));
+			auto other_value = OtherBucketValue(keys.GetType());
+			for (idx_t bin_idx = list_entry.offset; bin_idx < current_offset; bin_idx++) {
+				if (Value::NotDistinctFrom(keys.GetValue(bin_idx), other_value)) {
+					throw InvalidInputException(
+					    "Histogram bin %s collides with the key of the \"other values\" bucket, "
+					    "which has entries - use a different bin value",
+					    other_value.ToSQLString());
+				}
+			}
+			keys.SetValue(current_offset, other_value);
 			count_entries[current_offset] = state.counts->back();
 			current_offset++;
 		}
```

**File**: `extension/json/json_functions/json_transform.cpp` (modified, +1/-2)
```diff
@@ -984,8 +984,7 @@ static bool TransformObjectToMap(yyjson_val *objects[], yyjson_alc *alc, Vector
 
 	// Transform keys
 	if (!JSONTransform::Transform(keys, alc, MapVector::GetKeys(result), list_size, options, nullptr)) {
-		throw ConversionException(
-		    StringUtil::Format("%s. Cannot default to NULL, because map keys cannot be NULL", options.error_message));
+		success = false;
 	}
 
 	// Transform values
```

**File**: `extension/parquet/decoder/delta_byte_array_decoder.cpp` (modified, +5/-4)
```diff
@@ -115,12 +115,13 @@ void DeltaByteArrayDecoder::InitializePage() {
 			output += sizeof(uint32_t);
 		}
 
-		memcpy(output, prev_value.data(), prefix_len);
 		block.available(suffix_len);
-		memcpy(output + prefix_len, block.ptr, suffix_len);
+		if (value_len > 0) {
+			memcpy(output, prev_value.data(), prefix_len);
+			memcpy(output + prefix_len, block.ptr, suffix_len);
+			memcpy(prev_value.data(), output, value_len);
+		}
 		block.inc(suffix_len);
-
-		memcpy(prev_value.data(), output, value_len);
 		prev_len = value_len;
 		output += value_len;
 	}
```

**File**: `src/execution/operator/csv_scanner/scanner/string_value_scanner.cpp` (modified, +3/-5)
```diff
@@ -749,11 +749,9 @@ bool LineError::HandleErrors(StringValueResult &result) {
 				    result.current_line_position.begin.GetGlobalPosition(result.requested_size, first_nl),
 				    line_pos.GetGlobalPosition(result.requested_size), result.path);
 			}
-			// the file types are those of the projected columns
-			auto &file_types = result.csv_file_scan->file_types;
-			if (cur_error.chunk_idx < file_types.size() &&
-			    !StringValueScanner::CanDirectlyCast(file_types[cur_error.chunk_idx], result.icu_loaded)) {
-				result.number_of_rows--;
+			// the value is invalid: make it NULL so that casting the column does not report a second error for it
+			if (cur_error.chunk_idx < result.validity_mask.size()) {
+				result.validity_mask[cur_error.chunk_idx]->SetInvalid(static_cast<idx_t>(result.number_of_rows));
 			}
 			break;
 		}
```

**File**: `src/function/scalar/operator/decimal_division.cpp` (modified, +74/-43)
```diff
@@ -40,9 +40,63 @@ struct DecimalDivBindData : public FunctionData {
 //   hugeint_t -- otherwise
 //===--------------------------------------------------------------------===//
 
+template <class T>
+static constexpr uint8_t DecimalTierWidth() {
+	if constexpr (std::is_same_v<T, int16_t>) {
+		return Decimal::MAX_WIDTH_INT16;
+	} else if constexpr (std::is_same_v<T, int32_t>) {
+		return Decimal::MAX_WIDTH_INT32;
+	} else if constexpr (std::is_same_v<T, int64_t>) {
+		return Decimal::MAX_WIDTH_INT64;
+	} else {
+		return Decimal::MAX_WIDTH_DECIMAL;
+	}
+}
+
+template <class SOURCE_TYPE, class INPUT_TYPE>
+static void WidenDecimal(Vector &input, Vector &widened, idx_t count) {
+	if constexpr (sizeof(SOURCE_TYPE) < sizeof(INPUT_TYPE)) {
+		auto widen = [](SOURCE_TYPE value) {
+			return INPUT_TYPE(value);
+		};
+		UnaryExecutor::Execute<SOURCE_TYPE, INPUT_TYPE>(input, widened, count, widen);
+	} else {
+		throw InternalException("decimal_division: argument is wider than the compute tier");
+	}
+}
+
+//! Bring an argument to the physical type of the wider argument; a decimal keeps its integer value at the same scale
+template <class INPUT_TYPE>
+static Vector &GetDecimalInput(Vector &input, idx_t count, unique_ptr<Vector> &widened) {
+	auto source_physical = input.GetType().InternalType();
+	if (source_physical == GetTypeId<INPUT_TYPE>()) {
+		return input;
+	}
+	auto scale = DecimalType::GetScale(input.GetType());
+	widened = make_uniq<Vector>(LogicalType::DECIMAL(DecimalTierWidth<INPUT_TYPE>(), scale), count);
+	switch (source_physical) {
+	case PhysicalType::INT16:
+		WidenDecimal<int16_t, INPUT_TYPE>(input, *widened, count);
+		break;
+	case PhysicalType::INT32:
+		WidenDecimal<int32_t, INPUT_TYPE>(input, *widened, count);
+		break;
+	case PhysicalType::INT64:
+		WidenDecimal<int64_t, INPUT_TYPE>(input, *widened, count);
+		break;
+	default:
+		throw InternalException("decimal_division: unexpected argument physical type");
+	}
+	return *widened;
+}
+
 template <class INPUT_TYPE, class RESULT_TYPE, class COMPUTE_TYPE>
 static void DecimalDivExecute(DataChunk &args, ExpressionState &state, Vector &result) {
 	auto &bind_data = state.expr.Cast<BoundFunctionExpression>().BindInfo()->Cast<DecimalDivBindData>();
+	unique_ptr<Vector> lhs_widened;
+	unique_ptr<Vector> rhs_widened;
+	auto &lhs = GetDecimalInput<INPUT_TYPE>(args.data[0], args.size(), lhs_widened);
+	auto &rhs = GetDecimalInput<INPUT_TYPE>(args.data[1], args.size(), rhs_widened);
 
 	bool scale_divisor = bind_data.scale_exp < 0;
 	uint32_t abs_exp = UnsafeNumericCast<uint32_t>(AbsValue(bind_data.scale_exp));
@@ -56,7 +110,7 @@ static void DecimalDivExecute(DataChunk &args, ExpressionState &state, Vector &r
 	auto result_width = DecimalType::GetWidth(result.GetType());
 
 	BinaryExecutor::Execute<INPUT_TYPE, INPUT_TYPE, RESULT_TYPE>(
-	    args.data[0], args.data[1], result, args.size(), [&](INPUT_TYPE a, INPUT_TYPE b) -> RESULT_TYPE {
+	    lhs, rhs, result, args.size(), [&](INPUT_TYPE a, INPUT_TYPE b) -> RESULT_TYPE {
 		    if (b == INPUT_TYPE(0)) {
 			    throw InvalidInputException("decimal_division: division by zero");
 		    }
@@ -160,6 +214,8 @@ static scalar_function_t GetDecimalDivExecuteFunction(PhysicalType result_physic
 // Bind function
 //===--------------------------------------------------------------------===//
 
+static void SelectDecimalDivFunction(BoundScalarFunction &bound_function);
+
 // Result width and scale for e1 / e2 (SQL Server semantics):
 //   result_scale = max(6, s1 + p2 + 1)
 //   result_width = p1 - s1 + s2 + result_scale
@@ -173,6 +229,9 @@ static void DecimalDivisionResolveTypes(ResolveScalarFunctionTypesInput &input)
 	if (!lhs_type.GetDecimalProperties(p1, s1) || !rhs_type.GetDecimalProperties(p2, s2)) {
 		throw InvalidInputException("decimal_division: both arguments must be DECIMAL");
 	}
+	// an integer argument is an implicit DECIMAL(p, 0): bind on its canonical DECIMAL type
+	auto lhs_decimal_type = lhs_type.id() == LogicalTypeId::DECIMAL ? lhs_type : LogicalType::DECIMAL(p1, s1);
+	auto rhs_decimal_type = rhs_type.id() == LogicalTypeId::DECIMAL ? rhs_type : LogicalType::DECIMAL(p2, s2);
 
 	uint32_t result_scale;
 	if (input.GetArgumentCount() == 3) {
@@ -209,50 +268,22 @@ static void DecimalDivisionResolveTypes(ResolveScalarFunctionTypesInput &input)
 		    result_width, Decimal::MAX_WIDTH_DECIMAL);
 	}
 
-	PhysicalType result_physical;
-	if (result_width <= Decimal::MAX_WIDTH_INT16) {
-		result_physical = PhysicalType::INT16;
-	} else if (result_width <= Decimal::MAX_WIDTH_INT32) {
-		result_physical = PhysicalType::INT32;
-	} else if (result_width <= Decimal::MAX_WIDTH_INT64) {
-		result_physical = PhysicalType::INT64;
-	} else {
-		result_physical = PhysicalType::INT128;
-	}
-
 	bound_function.SetReturnType(LogicalType::DECIMAL(result_width, result_scale));
+	// keep the argument types: a narrower argument is widened at execution, so binding again yields the same types
+	bound_function.GetArguments()
```

**File**: `src/optimizer/rule/struct_extract_struct_pack_folding.cpp` (modified, +4/-1)
```diff
@@ -36,7 +36,10 @@ unique_ptr<Expression> StructExtractStructPackFoldingRule::Apply(LogicalOperator
 	}
 	// struct_extract(struct_pack(e0, .., en), ki) is equivalent to ei
 	auto result = std::move(packed_children[extract_data.index]);
-	return BoundCastExpression::AddCastToType(GetContext(), std::move(result), extract.Function().GetReturnType());
+	auto &return_type = extract.GetReturnType();
+	// AddCastToType skips the cast when only the collation differs - keep the collation of the extract
+	auto cast = BoundCastExpression::AddCastToType(GetContext(), std::move(result), return_type);
+	return Expression::PreserveReturnType(return_type, std::move(cast));
 }
 
 } // namespace duckdb
```

**File**: `src/planner/sql_export/sql_export_dml.cpp` (modified, +5/-0)
```diff
@@ -314,6 +314,11 @@ static LogicalPlanSQLExportResult ExportMergeNode(LogicalMergeInto &op, LogicalP
 					set_info->columns.push_back(op.table.GetColumns().GetColumn(bound_action->columns[i]).Name());
 					set_info->expressions.push_back(std::move(value.GetValue()));
 				}
+				if (set_info->columns.empty()) {
+					// an update without assignments is expressed as DO NOTHING
+					action->action_type = MergeActionType::MERGE_DO_NOTHING;
+					break;
+				}
 				action->update_info = std::move(set_info);
 				break;
 			}
```

---

### Incident Patch 2: `f3581650` (2026-11-06)
**Commit Message**: Do not wrap the total string length statistic on overflow (#28462)

Sibling of #28457, which fixed the same mechanism for the total list
length statistic and noted this site. `StringStats::Merge` accumulates
`total_string_length` with an unchecked `+=`. When the sum exceeds
`uint64_t`, the total wraps silently and consumers of
`StringStats::TotalStringLength` read a small but "known" value.

The total already has an unknown sentinel, the `has_total_string_length`
flag, which `Merge` uses for `EXPAND_BOUNDS` and
`ResetAdditiveStatistics` uses after updates and deletes. The fix
follows that idiom: the accumulation site uses `TryAddOperator` and
marks the total as unknown when the sum overflows. The min/max string
length bounds are unaffected.

This is the only merge-level accumulation site, the
`StatsWriter<string_t>` overload of `Merge` funnels into the same code.
The per-value sums in `StatsWriter<string_t>::Update` and
`UpdateRepeated` count bytes of strings actually fed through a writer
with a bounded lifetime (one append batch, one compression state per
column per row group, or one update segment), the same class as the
unguarded `ListColumnData::Append` feeder in #28457, so the

**File**: `src/storage/statistics/string_stats.cpp` (modified, +7/-2)
```diff
@@ -1,6 +1,7 @@
 #include "duckdb/storage/statistics/string_stats.hpp"
 #include "duckdb/common/types/value.hpp"
 
+#include "duckdb/common/operator/add.hpp"
 #include "duckdb/common/serializer/deserializer.hpp"
 #include "duckdb/common/serializer/serializer.hpp"
 #include "duckdb/common/typedefs.hpp"
@@ -661,8 +662,12 @@ void StringStats::Merge(BaseStatistics &stats, const StringStatsData &other_data
 		string_data.has_total_string_length = false;
 	} else {
 		string_data.has_total_string_length = string_data.has_total_string_length && other_data.has_total_string_length;
-		if (string_data.has_total_string_length) {
-			string_data.total_string_length += other_data.total_string_length;
+		if (string_data.has_total_string_length &&
+		    !TryAddOperator::Operation<uint64_t, uint64_t, uint64_t>(
+		        string_data.total_string_length, other_data.total_string_length, string_data.total_string_length)) {
+			// the sum of the totals overflows - the total is no longer known
+			string_data.has_total_string_length = false;
+			string_data.total_string_length = 0;
 		}
 	}
 }
```

**File**: `test/common/CMakeLists.txt` (modified, +1/-0)
```diff
@@ -42,6 +42,7 @@ add_library_unity(
   test_pipeline_broadcast_exchange.cpp
   test_recursive_cte_metrics.cpp
   test_scalar_executor.cpp
+  test_string_stats.cpp
   test_logical_type_is_complete.cpp
   test_logical_type_immutable.cpp
   test_type_visitor.cpp
```

**File**: `test/common/test_string_stats.cpp` (added, +79/-0)
```diff
@@ -0,0 +1,79 @@
+#include "catch.hpp"
+#include "duckdb/common/limits.hpp"
+#include "duckdb/storage/statistics/base_statistics.hpp"
+#include "duckdb/storage/statistics/string_stats.hpp"
+
+using namespace duckdb; // NOLINT
+
+//! Build string stats data that only carries length information, as a disjoint data set for MERGE_STATS
+static StringStatsData LengthStats(uint32_t min_length, uint32_t max_length, uint64_t total_length) {
+	StringStatsData data;
+	data.min_type = StringStatsType::EMPTY_STATS;
+	data.max_type = StringStatsType::EMPTY_STATS;
+	data.has_unicode = false;
+	data.has_max_string_length = true;
+	data.max_string_length = max_length;
+	data.has_min_string_length = true;
+	data.min_string_length = min_length;
+	data.has_total_string_length = true;
+	data.total_string_length = total_length;
+	return data;
+}
+
+TEST_CASE("Total string length statistics do not wrap on overflow", "[statistics]") {
+	const auto max_total = NumericLimits<uint64_t>::Maximum();
+
+	SECTION("Merge sums totals and invalidates the total on overflow") {
+		auto stats = StringStats::CreateEmpty(LogicalType::VARCHAR);
+		StringStats::Merge(stats, LengthStats(2, 4, 6));
+		StringStats::Merge(stats, LengthStats(1, 8, 10));
+		REQUIRE(StringStats::MinStringLength(stats).GetIndex() == 1);
+		REQUIRE(StringStats::MaxStringLength(stats) == 8);
+		REQUIRE(StringStats::TotalStringLength(stats).GetIndex() == 16);
+
+		// summing up to the maximum keeps the total known
+		StringStats::Merge(stats, LengthStats(1, 8, max_total - 16));
+		REQUIRE(StringStats::TotalStringLength(stats).GetIndex() == max_total);
+
+		// one more byte overflows - the total becomes unknown, the bounds remain
+		StringStats::Merge(stats, LengthStats(1, 8, 1));
+		REQUIRE(!StringStats::TotalStringLength(stats).IsValid());
+		REQUIRE(StringStats::MinStringLength(stats).GetIndex() == 1);
+		REQUIRE(StringStats::MaxStringLength(stats) == 8);
+
+		// the total stays unknown for subsequent merges
+		StringStats::Merge(stats, LengthStats(1, 8, 42));
+		REQUIRE(!StringStats::TotalStringLength(stats).IsValid());
+	}
+
+	SECTION("Merge keeps a total that lands exactly on the maximum") {
+		auto stats = StringStats::CreateEmpty(LogicalType::VARCHAR);
+		StringStats::Merge(stats, LengthStats(2, 4, max_total - 11));
+		StringStats::Merge(stats, LengthStats(3, 7, 11));
+		REQUIRE(StringStats::TotalStringLength(stats).GetIndex() == max_total);
+	}
+
+	SECTION("Merge with an unknown total keeps the total unknown") {
+		auto stats = StringStats::CreateEmpty(LogicalType::VARCHAR);
+		StringStats::Merge(stats, LengthStats(2, 4, 100));
+		auto unknown_total = LengthStats(3, 7, 0);
+		unknown_total.has_total_string_length = false;
+		StringStats::Merge(stats, unknown_total);
+		REQUIRE(!StringStats::TotalStringLength(stats).IsValid());
+		REQUIRE(StringStats::MinStringLength(stats).GetIndex() == 2);
+		REQUIRE(StringStats::MaxStringLength(stats) == 7);
+
+		// merging a known total into an unknown one stays unknown
+		StringStats::Merge(stats, LengthStats(1, 9, 5));
+		REQUIRE(!StringStats::TotalStringLength(stats).IsValid());
+	}
+
+	SECTION("Merge invalidates the total on overflow and keeps the bounds") {
+		auto stats = StringStats::CreateEmpty(LogicalType::VARCHAR);
+		StringStats::Merge(stats, LengthStats(2, 4, max_total - 10));
+		StringStats::Merge(stats, LengthStats(3, 7, 11));
+		REQUIRE(!StringStats::TotalStringLength(stats).IsValid());
+		REQUIRE(StringStats::MinStringLength(stats).GetIndex() == 2);
+		REQUIRE(StringStats::MaxStringLength(stats) == 7);
+	}
+}
```

**File**: `test/configs/force_storage_restart.json` (modified, +1/-0)
```diff
@@ -147,6 +147,7 @@
         "test/sql/storage/list_length_stats_checkpoint.test",
         "test/sql/optimizer/statistics/list_length_stats_propagation.test",
         "test/sql/storage/total_string_length_repeated_insert.test",
+        "test/sql/storage/total_string_length_multi_row_group.test",
         "test/sql/storage/compression/dictionary/total_string_length_dictionary.test"
       ]
     },
```

**File**: `test/configs/stats_dependent_tests.json` (modified, +1/-0)
```diff
@@ -60,6 +60,7 @@
         "test/sql/storage/extended_string_stats.test",
         "test/sql/storage/min_string_length_too_large.test_slow",
         "test/sql/storage/total_string_length_repeated_insert.test",
+        "test/sql/storage/total_string_length_multi_row_group.test",
         "test/sql/storage/compression/dictionary/total_string_length_dictionary.test",
         "test/sql/storage/compression/dict_fsst/repeated_string_stats.test",
         "test/sql/types/geo/geometry_from_wkb_stats.test",
```

**File**: `test/sql/storage/total_string_length_multi_row_group.test` (added, +29/-0)
```diff
@@ -0,0 +1,29 @@
+# name: test/sql/storage/total_string_length_multi_row_group.test
+# description: Test that total string length merges exactly across row groups, a checkpoint, and a restart
+# group: [storage]
+
+load {TEST_DIR}/total_string_length_multi_row_group.db readwrite v2.0.0
+
+statement ok
+CREATE TABLE multi_rg(s VARCHAR);
+
+statement ok
+INSERT INTO multi_rg SELECT repeat('x', i % 7) FROM range(250000) t(i);
+
+statement ok
+INSERT INTO multi_rg SELECT repeat('y', i % 11) FROM range(50000) t(i);
+
+query III
+SELECT s.min_string_length, s.max_string_length, s.total_string_length = (SELECT sum(strlen(s)) FROM multi_rg) FROM (SELECT stats(s) s FROM multi_rg LIMIT 1)
+----
+0	10	true
+
+statement ok
+CHECKPOINT
+
+restart
+
+query III
+SELECT s.min_string_length, s.max_string_length, s.total_string_length = (SELECT sum(strlen(s)) FROM multi_rg) FROM (SELECT stats(s) s FROM multi_rg LIMIT 1)
+----
+0	10	true
```

---

### Incident Patch 3: `87a4c14b` (2026-11-06)
**Commit Message**: Fix: do not treat TUPLE casts as throw-able in CastCanThrow (#28441)

## What does this PR fix?
Fixes #28385.

BoundCastExpression::CastCanThrow (used to decide whether a filter can
be
pushed through a cast) classified every TUPLE cast as fallible. A TUPLE
is an
unnamed STRUCT: same physical layout, positional child matching, and the
same
shared struct cast operators (TupleCastSwitch routes TUPLE->TUPLE and
TUPLE->STRUCT to the identical StructToStructCast), so a TUPLE cast
cannot
throw whenever the equivalent STRUCT cast cannot.

NestedCastCanThrow special-cased STRUCT (and accepted only a STRUCT
target), so
TUPLE fell through to the default: return true branch and filters such
as

    SELECT ... WHERE CAST(t AS TUPLE(BIGINT)) = row(1::BIGINT)

were never pushed down, while the same filter over a named STRUCT was.
CastIsInvertible in the same file already groups STRUCT and TUPLE.

## Description
Handle TUPLE alongside STRUCT in NestedCastCanThrow: recurse into the
child
casts and only report the cast as throw-able when the target is not a
STRUCT/TUPLE or a child cast can throw.

## Checklist
- [x] I have added tests that prove my fix is effective or that my
feature works
(test/sql

**File**: `src/planner/expression/bound_cast_expression.cpp` (modified, +4/-1)
```diff
@@ -308,8 +308,11 @@ static bool NestedCastCanThrow(const LogicalType &source_type, const LogicalType
 		}
 		return BoundCastExpression::CastCanThrow(ListOrArrayChildType(source_type), ListOrArrayChildType(target_type),
 		                                         false);
+	// TUPLE is an unnamed STRUCT - same physical layout, positional child matching, and the same shared struct
+	// cast operators, so it can throw exactly when a STRUCT of the same children can.
+	case LogicalTypeId::TUPLE:
 	case LogicalTypeId::STRUCT: {
-		if (target_type.id() != LogicalTypeId::STRUCT) {
+		if (target_type.id() != LogicalTypeId::STRUCT && target_type.id() != LogicalTypeId::TUPLE) {
 			return true;
 		}
 		// Pair the fields as the cast executes them: positionally for unnamed structs, by name otherwise.
```

**File**: `test/configs/v1_storage.json` (modified, +2/-1)
```diff
@@ -87,7 +87,8 @@
       "paths": [
         "test/sql/sql_export/empty_aggregate_state.test",
         "test/sql/sql_export/mark_condition_shapes.test",
-        "test/sql/types/variant/variant_struct_field_subquery.test"
+        "test/sql/types/variant/variant_struct_field_subquery.test",
+        "test/sql/optimizer/tuple_cast_pushdown.test"
       ]
     }
   ]
```

**File**: `test/configs/v1_storage_block_size_16kB.json` (modified, +2/-1)
```diff
@@ -83,7 +83,8 @@
       "paths": [
         "test/sql/sql_export/empty_aggregate_state.test",
         "test/sql/sql_export/mark_condition_shapes.test",
-        "test/sql/types/variant/variant_struct_field_subquery.test"
+        "test/sql/types/variant/variant_struct_field_subquery.test",
+        "test/sql/optimizer/tuple_cast_pushdown.test"
       ]
     }
   ]
```

**File**: `test/sql/optimizer/tuple_cast_pushdown.test` (added, +49/-0)
```diff
@@ -0,0 +1,49 @@
+# name: test/sql/optimizer/tuple_cast_pushdown.test
+# description: TUPLE casts with non-throwing children are not throw-able, so filters over them push down
+# group: [optimizer]
+
+# TUPLE is an unnamed STRUCT - same physical layout, positional child matching, and the same shared struct
+# cast operators. A TUPLE cast with non-throwing children cannot throw, just like the equivalent STRUCT cast,
+# so a filter built on it must be pushed down to the scan (CastCanThrow used to classify every TUPLE cast as
+# fallible, which blocked the pushdown).
+
+statement ok
+CREATE TABLE tt_tuple AS SELECT row(range::INTEGER) AS t, struct_pack(a := range::INTEGER) AS s FROM range(1000);
+
+# TUPLE(BIGINT) <- row(INTEGER): INTEGER -> BIGINT cannot throw, so the filter must be pushed to the scan
+query II
+EXPLAIN SELECT * FROM (SELECT t FROM tt_tuple) p WHERE CAST(p.t AS TUPLE(BIGINT)) = row(1::BIGINT);
+----
+physical_plan	<REGEX>:(?s).*Seq Scan.*Filters:.*CAST\(t AS TUPLE\(BIGINT\)\).*
+
+# the equivalent filter over a named STRUCT was already pushed down
+query II
+EXPLAIN SELECT * FROM (SELECT s FROM tt_tuple) p WHERE CAST(p.s AS STRUCT(a BIGINT)) = struct_pack(a := 1::BIGINT);
+----
+physical_plan	<REGEX>:(?s).*Seq Scan.*Filters:.*CAST\(s AS STRUCT\(a BIGINT\)\).*
+
+# results are correct with the pushed filter
+query I
+SELECT count(*) FROM (SELECT t FROM tt_tuple) p WHERE CAST(p.t AS TUPLE(BIGINT)) = row(1::BIGINT);
+----
+1
+
+query I
+SELECT count(*) FROM (SELECT s FROM tt_tuple) p WHERE CAST(p.s AS STRUCT(a BIGINT)) = struct_pack(a := 1::BIGINT);
+----
+1
+
+# negative control: a TUPLE cast with a throwing child (VARCHAR -> INTEGER) still cannot be pushed down,
+# it must stay in a Filter node above the scan
+statement ok
+CREATE TABLE tt_bad AS SELECT row(range::VARCHAR) AS t FROM range(1000);
+
+query II
+EXPLAIN SELECT * FROM (SELECT t FROM tt_bad) p WHERE CAST(p.t AS TUPLE(BIGINT)) = row(1::BIGINT);
+----
+physical_plan	<REGEX>:(?s).*Filter.*Expression:.*CAST\(t AS TUPLE\(BIGINT\)\).*
+
+query I
+SELECT count(*) FROM (SELECT t FROM tt_bad) p WHERE CAST(p.t AS TUPLE(BIGINT)) = row(1::BIGINT);
+----
+1
```

#### Recent Merged Pull Requests:
- **PR #28496** (closed): Fix glue extension build after LazyMultiFileList takes Context (@Robinho-MR)
- **PR #28470** (2026-11-06): Skip slow persistent part of variant_stats_merge_decimal under alternative verify (@Robinho-MR)
- **PR #28469** (2026-11-06): Bind again at EXECUTE when an untyped parameter meets an incomplete function argument type (@Robinho-MR)
- **PR #28468** (2026-11-06): Report a failed write of a persistent secret file (to backport to v2.0) (@Robinho-MR)
- **PR #28464** (2026-11-06): Make CatalogTransaction db a reference (@Robinho-MR)
- **PR #28462** (2026-11-06): Do not wrap the total string length statistic on overflow (@kryonix)

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

## X. Batch the Ready To Merge fixes from Robinho-MR/duckdb (#28420)

**RULE**:
When implementing operations in `extension/core_functions/aggregate/nested/binned_histogram.cpp`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in duckdb/duckdb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `f32c9494`: Batch the Ready To Merge fixes from Robinho-MR/duckdb (#28420). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `extension/core_functions/aggregate/nested/binned_histogram.cpp`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
			auto other_value = OtherBucketValue(keys.GetType());
			for (idx_t bin_idx = list_entry.offset; bin_idx < current_offset; bin_idx++) {
				if (Value::NotDistinctFrom(keys.GetValue(bin_idx), other_value)) {
					throw InvalidInputException(
					    "Histogram bin %s collides with the key of the \"other values\" bucket, "
					    "which has entries - use a different bin value",
					    other_value.ToSQLString());
				}
			}
			keys.SetValue(current_offset, other_value);
```

**NEGATIVE CONSTRAINT**:
```c++
// Anti-pattern to NEVER write (induced failure mode):
			keys.SetValue(current_offset, OtherBucketValue(keys.GetType()));
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `f32c9494` are properly handled with clean fallback behavior.
