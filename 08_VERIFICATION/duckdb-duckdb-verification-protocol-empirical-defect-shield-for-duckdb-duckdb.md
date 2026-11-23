# Verification Protocol: Verification Protocol: Empirical Defect Shield for duckdb/duckdb

<!-- PROVENANCE_START
{
  "source_repository": "duckdb/duckdb",
  "source_url": "https://github.com/duckdb/duckdb",
  "source_version": "94a1663a",
  "license": "MIT",
  "timestamp": "2026-11-23T21:04:57.577Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-duckdb-duckdb",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [duckdb/duckdb](https://github.com/duckdb/duckdb) (Revision: `94a1663a`).  
> **License**: MIT | **Timestamp**: `2026-11-23T21:04:57.577Z`  
> **Learning ID**: `learn-github-duckdb-duckdb`


## 1. Scope & Verification Target
- **Target Repository**: `duckdb/duckdb` (Commit: `94a1663a`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): duckdb/duckdb

> **Canonical Artifact**: `07_PROJECT_LEARNING/duckdb-duckdb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/duckdb/duckdb](https://github.com/duckdb/duckdb))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-23T21:04:56.166Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `duckdb/duckdb`
- **Description**: DuckDB is a high-performance analytical database system
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 43275 stars

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
#include "duckdb/common/bignum.hpp"
#include "duckdb/common/types/decimal_helper.hpp"
#include "duckdb/common/types/string_heap.hpp"
#include "duckdb/common/types/decimal.hpp"
#include "duckdb/common/types/hugeint.hpp"
#include "duckdb/common/types/time.hpp"
#include "duckdb/common/vector/struct_vector.hpp"
#include "duckdb/common/exception.hpp"
#include "duckdb/common/likely.hpp"
#include "duckdb/function/function_set.hpp"
#include "duckdb/planner/expression.hpp"
#include "duckdb/planner/expression/bound_aggregate_expression.hpp"

#include <cmath>

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
	AverageDecimalBindData(double scale, uint32_t decimal_scale) : scale(scale), decimal_scale(decimal_scale) {
	}

	//! 10^decimal_scale, the divisor of the unscaled sum
	double scale;
	uint32_t decimal_scale;

public:
	unique_ptr<FunctionData> Copy() const override {
		return make_uniq<AverageDecimalBindData>(scale, decimal_scale);
	};

	bool Equals(const FunctionData &other_p) const override {
		auto &other = other_p.Cast<AverageDecimalBindData>();
		return scale == other.scale && decimal_scale == other.decimal_scale;
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
static T GetAverageDivident(uint64_t count, optional_ptr<const FunctionData> bind_data) {
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
				AddInfinities(targe
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
#include "duckdb/common/arena_containers/arena_vector.hpp"

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
	explicit InternalApproxTopKState(ArenaAllocator &allocator) : values(allocator), filter(allocator) {
	}

	// the top-k data structure has two components
	// a list of k values sorted on "count" (i.e. values[0] has the lowest count)
	// a lookup table: open addressing over the stored values, 0 = empty, otherwise the stored_values index + 1
	ApproxTopKValue *stored_values = nullptr;
	unsafe_arena_vector<reference<ApproxTopKValue>> values;
	unsafe_arena_vector<idx_t> filter;
	uint32_t *lookup = nullptr;
	idx_t lookup_mask = 0;
	idx_t lookup_count = 0;
	idx_t k = 0;
	idx_t capacity = 0;
	idx_t filter_mask = 0;

	void Initialize(ArenaAllocator &allocator, idx_t kval) {
		static constexpr idx_t MONITORED_VALUES_RATIO = 3;
		static constexpr idx_t FILTER_RATIO = 8;

		D_ASSERT(values.empty());
		k = kval;
		if (k > MAX_APPROX_K) {
			throw InvalidInputException("Requested 'k' (%d) is bigger than accepted max (%d)", kval, MAX_APPROX_K);
		}
		capacity = kval * MONITORED_VALUES_RATIO;
		// the stored values are constructed when they are first used
		stored_values = reinterpret_cast<ApproxTopKValue *>(
		    allocator.AllocateAligned(MaxValue<idx_t>(capacity, 1) * sizeof(ApproxTopKValue)));
		values.reserve(capacity);

		// at most half of the lookup table is ever used, so probing always ends at an empty slot
		const idx_t lookup_size = NextPowerOfTwo(capacity * 2);
		lookup_mask = lookup_size - 1;
		lookup = reinterpret_cast<uint32_t *>(allocator.AllocateAligned(lookup_size * sizeof(uint32_t)));
		memset(lookup, 0, lookup_size * sizeof(uint32_t));

		// we scale the filter based on the amount of values we are monitoring
		idx_t filter_size = NextPowerOfTwo(capacity * FILTER_RATIO);
		filter_mask = filter_size - 1;
		filter.resize(filter_size);
	}

	uint32_t SlotId(const ApproxTopKValue &value) const {
		D_ASSERT(&value >= stored_values && &value < stored_values + capacity);
		return UnsafeNumericCast<uint32_t>(&value - stored_values);
	}

	ApproxTopKValue *Find(const ApproxTopKString &key) const {
		for (idx_t pos = key.hash & lookup_mask; lookup[pos] != 0; pos = (pos + 1) & lookup_mask) {
			auto &entry = stored_values[lookup[pos] - 1];
			if (entry.str_val.hash == key.hash && Equals::Operation(entry.str_val.str, key.str)) {
				return &entry;
			}
		}
		return nullptr;
	}

	//! Insert a value whose key is known to be absent
	void Insert(ApproxTopKValue &value) {
		D_ASSERT(lookup_count < capacity);
		idx_t pos = value.str_val.hash & lookup_mask;
		while (lookup[pos] != 0) {
			pos = (pos + 1) & lookup_mask;
		}
		lookup[pos] = SlotId(value) + 1;
		lookup_count++;
	}

	//! Insert a value, returns false if its key is already present
	bool TryInsert(ApproxTopKValue &value) {
		idx_t pos = value.str_val.hash & lookup_mask;
		for (; lookup[pos] != 0; pos = (pos + 1) & lookup_mask) {
			auto &entry = stored_values[lookup[pos] - 1];
			if (entry.str_val.hash == value.str_val.hash && Equals::Operation(entry.str_val.str, value.str_val.str)) {
				return false;
			}
		}
		lookup[pos] = SlotId(value) + 1;
		lookup_count++;
		return true;
	}

	//! Remove a value (by identity) from the lookup table, backward-shifting the entries after it
	void Erase(const ApproxTopKValue &value) {
		const auto id = SlotId(value) + 1;
		idx_t pos = value.str_val.hash & lookup_mask;
		while (lookup[pos] != id) {
			if (lookup[pos] == 0) {
				throw InternalException("approx_top_k: erased value is not in the lookup table");
			}
			pos = (pos + 1) & lookup_mask;
		}
		lookup[pos] = 0;
		lookup_count--;
		for (idx_t next = (pos + 1) & lookup_mask; lookup[next] != 0; next = (next + 1) & lookup_mask) {
			const idx_t home = stored_values[lookup[next] - 1].str_val.hash & lookup_mask;
			if (((next - home) & lookup_mask) >= ((next - pos) & lookup_mask)) {
				lookup[pos] = lookup[next];
				lookup[next] = 0;
				pos = next;
			}
		}
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
			auto &val = *new (stored_values + values.size()) ApproxTopKValue();
			val.index = values.size();
			values.push_back(val);
		}
		auto &value = values.back().get();
		if (value.count > 0) {
			// the capacity is reached - replace the entry with the lowest count
			// erase it from the lookup table (before CopyValue overwrites its hash and data)
			// and set the filter for the minimum value back to the current minimum value
			filter[value.str_val.hash & filter_mask] = value.count;
			Erase(value);
		}
		CopyValue(value, input, aggr_input.allocator);
		Insert(value);
		IncrementCount(value, increment);
	}

	//! Returns true if an unmonitored input is only counted in the filter
	bool FilterInput(const ApproxTopKString &input) {
		if (values.size() < capacity) {
			return false;
		}
		// instead of monitoring the value immediately, we add to its slot in the filter
		// ONLY when the filter slot reaches the current min count, we start monitoring the value
		// this speeds up the algorithm as switching monitor values means we need to erase/insert in the hash table
		auto &filter_value = filter[input.hash & filter_mask];
		if (filter_value + 1 < values.back().get().count) {
			filter_value++;
			return true;
		}
		return false;
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
		D_ASSERT(lookup_count == values.size());
		D_ASSERT(values.size() <= capacity);
		for (idx_t k = 0; k < values.size(); k++) {
			auto &val = values[k].get();
			D_ASSERT(val.count > 0);
			// verify the lookup table finds exactly this value
			D_ASSERT(Find(val.str_val) == &val);
			// verify the index is correct
			D_ASSERT(val.index == k);
			if (k > 0) {
				// sortedness
				D_ASSERT(val.count <= values[k - 1].get().count);
			}
		}
#endif
	}
};

struct ApproxTopKState {
	//! nullptr if no value has been added yet
	InternalApproxTopKState *state;
};

struct ApproxTopKOperation {
	template <class TYPE, class STATE>
	static void Operation(STATE &aggr_state, const TYPE &input, AggregateInputData &aggr_input,
	                      const Vector &top_k_vector, idx_t offset, idx_t count) {
		if (!aggr_state.state || aggr_state.state->values.empty()) {
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
			// an existing empty state is only reused if its k matches
			if (!aggr_state.state || aggr_state.state->k != UnsafeNumericCast<idx_t>(kval)) {
				aggr_state.state = aggr_input.allocator.Make<InternalApproxTopKState>(aggr_input.allocator);
				aggr_state.state->Initialize(aggr_input.allocator, UnsafeNumericCast<idx_t>(kval));
			}
		}
		auto &state = *aggr_state.state;
		ApproxTopKString topk_string(input, Hash(input));
		auto entry = state.Find(topk_string);
		if (entry) {
			// the input is monitored - increment the count
			state.IncrementCount(*entry);
		} else if (!state.FilterInput(topk_string)) {
			// the input is not monitored and passes the filter - start monitoring it
			state.InsertOrReplaceEntry(topk_string, aggr_input);
		}
	}

	template <cla
```

### Core Architecture Module: `extension/core_functions/aggregate/holistic/approximate_quantile.cpp`
```
#include "duckdb/common/operator/add.hpp"
#include "duckdb/common/types/decimal.hpp"
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

	static void Serialize(Serializer &serializer, const optional_ptr<const FunctionData> bind_data_p,
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
#include "duckdb/common/arena_containers/arena_sql_value_map.hpp"
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
	using MAP_TYPE = arena_sql_value_map_t<T, ModeAttr>;

	static MAP_TYPE *CreateEmpty(ArenaAllocator &allocator) {
		return allocator.Make<MAP_TYPE>(typename MAP_TYPE::allocator_type(allocator));
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

	static T *Update(T *mode, idx_t &, const T &key, AggregateInputData &aggr_input_data) {
		if (!mode) {
			mode = aggr_input_data.allocator.Make<T>(key);
		}
		*mode = key;

		return mode;
	}
};

struct ModeString {
	using MAP_TYPE = ArenaOwningStringMap<ModeAttr>;

	static MAP_TYPE *CreateEmpty(ArenaAllocator &allocator) {
		return allocator.Make<MAP_TYPE>(allocator);
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
				mode = aggr_input_data.allocator.Make<string_t>(nullptr, 0);
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
				mode = aggr_input_data.allocator.Make<string_t>(nullptr, 0);
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
	unique_ptr<ColumnDataScanState> scan;
	//! The arena of the frequency map in the window path, reset when the frames are recomputed
	unique_ptr<ArenaAllocator> window_arena;
	//! The data chunk paged into into
	DataChunk page;
	//! Cell access into the page, rebuilt per page load - scans can return constant and dictionary vectors
	unique_ptr<VectorIterator<KEY_TYPE>> values;

	void InitializePage(const WindowPartitionInput &partition) {
		if (!scan) {
			scan = make_uniq<ColumnDataScanState>();
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
			// rebuild the map instead of clearing it, the arena would retain the erased nodes
			D_ASSERT(window_arena);
			const auto previous_size = frequency_map->size();
			window_arena->Reset();
			frequency_map = TYPE_OP::CreateEmpty(*window_arena);
			frequency_map->reserve(previous_size);
		}
		nonzero = 0;
		count = 0;
		valid = false;
	}

	void ModeAdd(idx_t row, AggregateInputData &aggr_input_data) {
		const auto &key = GetCell(row);
		auto &attr = TYPE_OP::GetOrCreate(*frequency_map, key, *window_arena);
		auto new_count = (attr.count += 1);
		nonzero += size_t(new_count == 1);
		if (new_count > count) {
			valid = true;
			count = new_count;
			Update(key, aggr_input_data);
	
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #29244** (2026-11-23): **Cache sort-key suffixes during merging**
  *Symptoms*: When merge keys share a prefix, cache the first word after it in their existing inline storage so comparisons can avoid reading the heap. Share the temporary substitution and restoration with initial radix sorting, without adding allocations or increasing key size.

- **Issue #29242** (2026-11-23): **Move DateTruncSimplificationRule::DatePartToFunc into its own file**
  *Symptoms*: The parser also needs it, to read INTERVAL literals (transform_expression.cpp). It moves out of the date_trunc rule's translation unit into date_part_to_func.cpp; behavior is unchanged.  Just moving code around, to make different libraries actually compile when stripped down. Function is used at `src/parser/peg/transformer/transform_expression.cpp`
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

### Incident Patch 1: `52dac04d` (2026-11-23)
**Commit Message**: Fix runtime memory management for growing perfect-hash aggregates (#29175)

Fixes #29163.

With four million rows and a 64 MB memory limit, `list(hash(i))` can
exhaust memory in `PERFECT_HASH_GROUP_BY` even with only 1,000 groups.
The key range bounds the number of groups, but each list can grow with
the input.

This change selects the operator at planning time. Every aggregate must
have a known fixed-size native state or an explicit opt-in to use
perfect hash aggregation. The built-in `approx_count_distinct` sketch
and native single-result `min`/`max` opt in. A variable-width minimum
can still retain a large value per group. Missing layouts, state
destructors, and custom state export/import callbacks select regular
hash aggregation unless the implementation opts in. A `list` alongside
`min`, `min(x, n)` and `max(x, n)`, and wrappers that buffer ordered
input all use `HASH_GROUP_BY`, which can spill.

### Results under memory pressure

| Workload | Memory limit | Upstream base | Base with
`perfect_ht_threshold=0` | This PR |
|---|---:|---|---|---|
| Reported list query, 4M rows, 1,000 groups | 64 MB | Out of memory |
Passed | Passed |
| List and string minimum, 192M rows, 100 group

**File**: `src/execution/physical_plan/plan_aggregate.cpp` (modified, +16/-2)
```diff
@@ -240,8 +240,22 @@ static bool CanUsePerfectHashAggregate(ClientContext &context, LogicalAggregate
 	}
 	for (auto &expression : op.expressions) {
 		auto &aggregate = expression->Cast<BoundAggregateExpression>();
-		if (aggregate.IsDistinct() || !aggregate.Function().HasStateCombineCallback()) {
-			// distinct aggregates are not supported in perfect hash aggregates
+		const auto &function = aggregate.Function();
+		if (aggregate.IsDistinct() || !function.HasStateCombineCallback()) {
+			return false;
+		}
+		if (!function.HasGetStateTypeCallback() || function.HasStateDestructorCallback()) {
+			return false;
+		}
+		const auto layout = function.GetStateType(aggregate.BindInfo().get());
+		// Preserve min/max and fixed-size sketch fast paths, excluding sorted aggregate buffers.
+		const auto &name = function.GetName();
+		if (function.GetArguments().size() == 1 && layout.field.kind != AggregateFieldKind::LIST &&
+		    (name == "min" || name == "max" || name == "approx_count_distinct")) {
+			continue;
+		}
+		if (function.HasExportAggregateStateCallback() || function.HasImportAggregateStateCallback() ||
+		    !layout.field.IsFixedSize(layout.type)) {
 			return false;
 		}
 	}
```

**File**: `src/function/aggregate_state_serialization.cpp` (modified, +26/-0)
```diff
@@ -11,6 +11,32 @@
 
 namespace duckdb {
 
+bool AggregateStateField::IsFixedSize(const LogicalType &type) const {
+	switch (kind) {
+	case AggregateFieldKind::PRIMITIVE:
+		return TypeIsConstantSize(type.InternalType());
+	case AggregateFieldKind::OPTIONAL_VALUE:
+		return children.size() == 1 && children[0].IsFixedSize(type);
+	case AggregateFieldKind::STRUCT: {
+		if (type.id() != LogicalTypeId::STRUCT) {
+			return false;
+		}
+		const auto &types = StructType::GetChildTypes(type);
+		if (types.size() != children.size()) {
+			return false;
+		}
+		for (idx_t i = 0; i < types.size(); i++) {
+			if (!children[i].IsFixedSize(types[i].second)) {
+				return false;
+			}
+		}
+		return true;
+	}
+	default:
+		return false;
+	}
+}
+
 namespace {
 
 template <class OP, class... ARGS>
```

**File**: `src/include/duckdb/function/aggregate_state_layout.hpp` (modified, +3/-0)
```diff
@@ -255,6 +255,9 @@ struct AggregateStateField {
 	//! aggregate's empty-group finalize (e.g. count -> 0) instead of short-circuiting to NULL on a NULL state.
 	bool list_empty_as_empty = false;
 
+	//! Whether the described native field consists entirely of fixed-size values.
+	bool IsFixedSize(const LogicalType &type) const;
+
 	//! The alignment of this field when placed as a struct member, mirroring the C++ struct layout rules.
 	//! For OPTIONAL_VALUE the alignment is that of the wrapped value - the trailing is_set bool does not affect it.
 	idx_t GetAlignment() const {
```

**File**: `src/optimizer/common_subplan_optimizer.cpp` (modified, +1/-27)
```diff
@@ -108,32 +108,6 @@ static bool CanShareSubplanExpression(const Expression &expr) {
 	return !unsafe;
 }
 
-static bool HasFixedSizeState(const LogicalType &type, const AggregateStateField &field) {
-	switch (field.kind) {
-	case AggregateFieldKind::PRIMITIVE:
-		return TypeIsConstantSize(type.InternalType());
-	case AggregateFieldKind::OPTIONAL_VALUE:
-		return field.children.size() == 1 && HasFixedSizeState(type, field.children[0]);
-	case AggregateFieldKind::STRUCT: {
-		if (type.id() != LogicalTypeId::STRUCT) {
-			return false;
-		}
-		const auto &types = StructType::GetChildTypes(type);
-		if (types.size() != field.children.size()) {
-			return false;
-		}
-		for (idx_t i = 0; i < types.size(); i++) {
-			if (!HasFixedSizeState(types[i].second, field.children[i])) {
-				return false;
-			}
-		}
-		return true;
-	}
-	default:
-		return false;
-	}
-}
-
 static bool CanCombineAggregateState(const BoundAggregateExpression &aggregate) {
 	const auto &function = aggregate.Function();
 	if (aggregate.IsDistinct() || aggregate.GetOrderBys() ||
@@ -143,7 +117,7 @@ static bool CanCombineAggregateState(const BoundAggregateExpression &aggregate)
 	}
 	// Combining growing states can use more memory than evaluating the original aggregates separately.
 	const auto layout = function.GetStateType(aggregate.BindInfo().get());
-	return HasFixedSizeState(layout.type, layout.field);
+	return layout.field.IsFixedSize(layout.type);
 }
 
 enum class ConversionType {
```

**File**: `test/sql/aggregate/aggregate_state_export/ordered_aggregate_export_state.test` (modified, +1/-1)
```diff
@@ -159,7 +159,7 @@ WHERE d.direct IS DISTINCT FROM e.exported;
 ----
 0
 
-# many groups via the perfect hash aggregate (small integer keys)
+# ordered list states with small integer group keys
 statement ok
 CREATE TABLE narrow AS SELECT (range % 8)::TINYINT AS g, range AS v FROM range(1000);
 
```

**File**: `test/sql/aggregate/aggregates/test_order_by_aggregate.test` (modified, +1/-1)
```diff
@@ -97,7 +97,7 @@ SELECT string_agg(x, ',' ORDER BY x), string_agg(x, '|' ORDER BY x DESC) FROM (V
 ----
 a string that is not inlined,b,c	c|b|a string that is not inlined
 
-# the perfect hash aggregate keeps the finalize state alive while its results are scanned
+# the grouped strings remain valid while the results are scanned
 query I
 SELECT count(*) FROM (SELECT i % 1000 g, string_agg(md5(i::VARCHAR), ',' ORDER BY i) s FROM range(3000) r(i) GROUP BY g) WHERE s != concat_ws(',', md5(g::VARCHAR), md5((g + 1000)::VARCHAR), md5((g + 2000)::VARCHAR));
 ----
```

**File**: `test/sql/aggregate/external/list_hash_aggregate_spill.test_slow` (added, +50/-0)
```diff
@@ -0,0 +1,50 @@
+# name: test/sql/aggregate/external/list_hash_aggregate_spill.test_slow
+# description: Regular hash aggregation of lists spills under memory pressure
+# group: [external]
+
+require core_functions
+
+statement ok
+SET threads = 1
+
+# Each group is an arithmetic progression starting at its key with a step of 250.
+statement ok
+CREATE MACRO group_totals(n) AS TABLE
+SELECT count(*) AS groups,
+       bool_and(len(xs) = n // 250 AND list_avg(xs) = g + (n - 250) / 2) AS groups_match
+FROM (
+    SELECT (i % 250)::UTINYINT AS g, list(i) AS xs FROM range(n) t(i) GROUP BY g
+) grouped
+
+statement ok
+SET tracked_metrics = ['operator.type', 'system.total_bytes_spilled']
+
+statement ok
+SET perfect_ht_threshold = 12
+
+statement ok
+SET memory_limit = '48MB'
+
+statement ok
+SET operator_memory_limit = '24MB'
+
+query II
+EXPLAIN ANALYZE (FORMAT JSON) SELECT * FROM group_totals(50000)
+----
+analyzed_plan	<REGEX>:(?s).*"type": "HASH_GROUP_BY".*"total_bytes_spilled": 0.*
+
+query II
+SELECT * FROM group_totals(50000)
+----
+250	true
+
+# The lists retain 64 MB of integers. Only the grouped aggregate can spill in this query.
+query II
+EXPLAIN ANALYZE (FORMAT JSON) SELECT * FROM group_totals(8000000)
+----
+analyzed_plan	<REGEX>:(?s).*"type": "HASH_GROUP_BY".*"total_bytes_spilled": [1-9].*
+
+query II
+SELECT * FROM group_totals(8000000)
+----
+250	true
```

**File**: `test/sql/aggregate/external/perfect_hash_growing_state.test_slow` (added, +232/-0)
```diff
@@ -0,0 +1,232 @@
+# name: test/sql/aggregate/external/perfect_hash_growing_state.test_slow
+# description: Aggregation of growing lists under a small memory limit
+# group: [external]
+
+require vector_size 2048
+
+statement ok
+SET threads = 1
+
+statement ok
+SET memory_limit = '8MB'
+
+query III
+SELECT count(*), count(xs), count(*) FILTER (WHERE g = 1 AND xs = [repeat('x', 512) || '1']) FROM (
+    SELECT (i % 10)::UTINYINT AS g, list(repeat('x', 512) || i::VARCHAR) FILTER (WHERE i % 50000 = 1) AS xs
+    FROM range(6000) t(i) GROUP BY g
+)
+----
+10	1	1
+
+statement ok
+SET memory_limit = '12MB'
+
+query II
+SELECT count(*), count(*) FILTER (WHERE v = repeat('x', 512) || lpad(g::VARCHAR, 4, '0')) FROM (
+    SELECT (i % 10)::UTINYINT AS g, min(repeat('x', 512) || lpad(i::VARCHAR, 4, '0')) AS v
+    FROM range(6000) t(i) GROUP BY g
+)
+----
+10	10
+
+foreach budget 24 32
+
+statement ok
+SET memory_limit = '{budget}MB'
+
+query III
+SELECT sum(len(xs)), count(v), sum(length(v)) FROM (
+    SELECT (i % 100)::UTINYINT AS g, list(hash(i)) AS xs,
+           min(CASE WHEN i < 100 THEN repeat('x', 16384) || i::VARCHAR END) AS v
+    FROM range(65536) t(i) GROUP BY g
+)
+----
+65536	100	1638590
+
+endloop
+
+statement ok
+SET memory_limit = '22MB'
+
+query I
+SELECT sum(len(xs)) FROM (
+    SELECT (i % 57)::UTINYINT AS g, list(hash(i)) AS xs
+    FROM range(524288) t(i) GROUP BY g
+)
+----
+524288
+
+statement ok
+SET memory_limit = '16MB'
+
+statement ok
+CREATE TABLE grouped_output AS
+SELECT (i % 100)::UTINYINT AS g, list(hash(i)) AS xs FROM range(524288) t(i) GROUP BY g
+
+statement ok
+RESET memory_limit
+
+query II
+SELECT count(*), sum(len(xs)) FROM grouped_output
+----
+100	524288
+
+statement ok
+DROP TABLE grouped_output
+
+statement ok
+SET memory_limit = '256MB'
+
+foreach width 128 1024
+
+query II
+SELECT sum(len(xs)), sum(length(v)) FROM (
+    SELECT (i % 32)::UTINYINT AS g, list(i) FILTER (WHERE i = 0) AS xs,
+           last(CASE WHEN (i // 2048) % 2 = 0 THEN repeat('x', {width}) ELSE 'x' END ORDER BY i) AS v
+    FROM range(1073741824 // {width}) t(i) GROUP BY g
+)
+----
+1	32
+
+endloop
+
+statement ok
+SET memory_limit = '32MB'
+
+foreach start_row 0 524288
+
+query II
+SELECT sum(len(xs)), sum(length(v)) FROM (
+    SELECT (i % 100)::UTINYINT AS g, list(hash(i)) AS xs,
+           min(CASE WHEN i BETWEEN {start_row} AND {start_row} + 99 THEN repeat('x', 16385) || (i % 100)::VARCHAR END) AS v
+    FROM range(524388) t(i) GROUP BY g
+)
+----
+524388	1638690
+
+endloop
+
+statement ok
+SET memory_limit = '48MB'
+
+query I
+SELECT sum(len(xs)) FROM (
+    SELECT (i % 100)::UTINYINT AS g, list(i::VARCHAR) AS xs FROM range(1500000) t(i) GROUP BY g
+)
+----
+1500000
+
+foreach budget 64 80
+
+statement ok
+SET memory_limit = '{budget}MB'
+
+query III
+SELECT sum(len(xs)), max(len(xs)) FILTER (WHERE g = 0), sum(list_sum(xs)) FROM (
+    SELECT (CASE WHEN i % 3 = 0 THEN 0 ELSE i % 100 END)::UTINYINT AS g, list(i) AS xs
+    FROM range(1500000) t(i) GROUP BY g
+)
+----
+1500000	510000	1124999250000
+
+endloop
+
+statement ok
+SET memory_limit = '32MB'
+
+statement ok
+CREATE TABLE crossover AS
+SELECT (i % 100)::UTINYINT AS g, list(hash(i)) AS xs FROM range(1500000) t(i) GROUP BY g
+
+statement ok
+RESET memory_limit
+
+query II
+SELECT count(*), sum(len(xs)) FROM crossover
+----
+100	1500000
+
+statement ok
+DROP TABLE crossover
+
+# An earlier UNION branch can already have contributed states when the filtered LIST spills.
+statement ok
+SET memory_limit = '96MB'
+
+statement ok
+CREATE TABLE merged AS
+SELECT g, list(hash(i)) FILTER (WHERE i % 13 <> 0) AS xs, count(*) AS n
+FROM (SELECT i, (i % 100)::UTINYINT AS g FROM range(16384) t(i)
+      UNION ALL
+      SELECT i, (i % 100)::UTINYINT AS g FROM range(16384, 1500000) t(i))
+GROUP BY g
+
+statement ok
+RESET memory_limit
+
+query II
+SELECT count(*), count(*) FILTER (WHERE n <> 15000 OR list_sort(xs) IS DISTINCT FROM
+    list_sort(list_transform(list_filter(range(g::BIGINT, 1500000, 100), lambda j: j % 13 <> 0), lambda j: hash(j))))
+FROM merged
+----
+100	0
+
+statement ok
+DROP TABLE merged
+
+statement ok
+SET threads = 4
+
+foreach groups 1000 100
+
+statement ok
+SET memory_limit = '64MB'
+
+statement ok
+CREATE TABLE grouped AS
+SELECT g, list(hash(i)) AS xs
+FROM range(4000000) t(i), (SELECT i % {groups} AS g)
+GROUP BY g
+
+statement ok
+RESET memory_limit
+
+query II
+SELECT count(*) = {groups},
+       bool_and(list_sort(xs) IS NOT DISTINCT FROM
+                list_sort(list_transform(range(4000000 // {groups}), lambda j: hash(j * {groups} + g))))
+FROM grouped
+----
+true	true
+
+statement ok
+DROP TABLE grouped
+
+endloop
+
+# Compare a parallel table scan with a filtered list, repeated values and a NULL group.
+statement ok
+CREATE TABLE input AS
+SELECT CASE WHEN i % 17 <> 0 THEN (i % 100)::UTINYINT END AS g,
+       CASE WHEN i % 11 <> 0 THEN i % 127 END AS v, i % 3 <> 0 AS keep
+FROM range(1000000) t(i)
+
+statement ok
+SE
```

---

### Incident Patch 2: `f9a37d38` (2026-11-23)
**Commit Message**: Account PEG parser arenas against memory limits (#29032)

PEG parser match and transform arenas now count against the database
memory limit when parsing with a client context. Match process and
packrat storage are released before transformation begins, while parse
results remain alive through transformation.

Parsing allocation failures report that the statement is too large for
the current memory limit, with guidance to reduce the statement size or
increase memory_limit. Type parsing and json_serialize_sql propagate OOM
instead of turning it into an invalid type error or a successful JSON
error value; ordinary JSON SQL parse errors retain the existing
error-value behavior.

Validation:
- DEBUG/FORCE_ASSERT/CRASH_ON_ASSERT build via make reldebug.
- SQLLogicTests cover repeated parse OOM, allocator memory returning to
the pre-query baseline, subsequent query recovery, type parsing, and
JSON SQL error handling.
- A targeted grammar-extension test exercises OOM inside the transform
phase and verifies memory returns to its baseline.
- Parser, grammar-extension, and related JSON regressions: 135 passed.
- Full JSON SQL suite: 151 passed, one slow test passed on a standalone
rerun with 

**File**: `extension/json/json_functions/json_serialize_plan.cpp` (modified, +3/-0)
```diff
@@ -181,6 +181,9 @@ static void JsonSerializePlanFunction(DataChunk &args, ExpressionState &state, V
 
 		} catch (std::exception &ex) {
 			ErrorData error(ex);
+			if (error.Type() == ExceptionType::OUT_OF_MEMORY) {
+				throw;
+			}
 			yyjson_mut_obj_add_true(doc, result_obj, "error");
 			// error type and message
 			yyjson_mut_obj_add_strcpy(doc, result_obj, "error_type",
```

**File**: `extension/json/json_functions/json_serialize_sql.cpp` (modified, +3/-0)
```diff
@@ -129,6 +129,9 @@ static void JsonSerializeFunction(DataChunk &args, ExpressionState &state, Vecto
 
 		} catch (std::exception &ex) {
 			ErrorData error(ex);
+			if (error.Type() == ExceptionType::OUT_OF_MEMORY) {
+				throw;
+			}
 			yyjson_mut_obj_add_true(doc, result_obj, "error");
 			yyjson_mut_obj_add_strcpy(doc, result_obj, "error_type",
 			                          StringUtil::Lower(Exception::ExceptionTypeToString(error.Type())).c_str());
```

**File**: `src/common/types/type_manager.cpp` (modified, +4/-0)
```diff
@@ -1,6 +1,7 @@
 #include "duckdb/common/types/type_manager.hpp"
 
 #include "duckdb/common/type_visitor.hpp"
+#include "duckdb/common/error_data.hpp"
 #include "duckdb/function/cast/cast_function_set.hpp"
 #include "duckdb/parser/parser.hpp"
 #include "duckdb/planner/binder.hpp"
@@ -26,6 +27,9 @@ static LogicalType TransformStringToUnboundType(const string &str, ClientContext
 	try {
 		column_list = Parser(context).ParseColumnList("dummy " + str);
 	} catch (const std::runtime_error &e) {
+		if (ErrorData(e).Type() == ExceptionType::OUT_OF_MEMORY) {
+			throw;
+		}
 		const vector<string> suggested_types {"BIGINT",
 		                                      "INT8",
 		                                      "LONG",
```

**File**: `src/include/duckdb/parser/peg/matcher.hpp` (modified, +1/-0)
```diff
@@ -536,6 +536,7 @@ static constexpr idx_t PARSER_ARENA_INITIAL_CAPACITY = 8 * ArenaAllocator::ARENA
 class ParseResultAllocator {
 public:
 	ParseResultAllocator();
+	explicit ParseResultAllocator(Allocator &allocator);
 	~ParseResultAllocator();
 
 	template <class RESULT, class... ARGS>
```

**File**: `src/parser/peg/matcher.cpp` (modified, +5/-2)
```diff
@@ -217,8 +217,11 @@ void MatcherAllocator::InitializeListChains() {
 	}
 }
 
-ParseResultAllocator::ParseResultAllocator()
-    : arena(Allocator::DefaultAllocator(), PARSER_ARENA_INITIAL_CAPACITY), pending_destructors(arena) {
+ParseResultAllocator::ParseResultAllocator() : ParseResultAllocator(Allocator::DefaultAllocator()) {
+}
+
+ParseResultAllocator::ParseResultAllocator(Allocator &allocator)
+    : arena(allocator, PARSER_ARENA_INITIAL_CAPACITY), pending_destructors(arena) {
 }
 
 ParseResultAllocator::~ParseResultAllocator() = default;
```

**File**: `src/parser/peg/transformer/peg_transformer_factory.cpp` (modified, +31/-19)
```diff
@@ -19,6 +19,7 @@
 #include "duckdb/parser/query_node/set_operation_node.hpp"
 #include "duckdb/parser/statement/merge_into_statement.hpp"
 #include "duckdb/parser/constraints/foreign_key_constraint.hpp"
+#include "duckdb/common/error_data.hpp"
 
 namespace duckdb {
 
@@ -51,30 +52,36 @@ static unique_ptr<SQLStatement> ExtractAndTransformStatement(PEGTransformer &tra
 unique_ptr<SQLStatement> PEGTransformerFactory::TransformTopLevelStatement(TokenIterator &token_iterator,
                                                                            ParserOptions &options,
                                                                            const CompiledGrammar &grammar,
-                                                                           optional_idx &failure_index) {
+                                                                           optional_idx &failure_index) try {
 	if (!token_iterator.Current()) {
 		return nullptr;
 	}
 	vector<MatcherSuggestion> suggestions;
-	ParseResultAllocator parse_result_allocator;
+	// Parsing is query work too: count its arenas against the database memory
+	// limit instead of letting a complex statement grow the process unchecked.
+	auto &allocator = options.context ? BufferAllocator::Get(*options.context) : Allocator::DefaultAllocator();
+	ParseResultAllocator parse_result_allocator(allocator);
 	idx_t max_token_index = token_iterator.Position();
-	// the packrat cache outlives the match processes, so they need separate arenas
-	ArenaAllocator process_allocator(Allocator::DefaultAllocator(), PARSER_ARENA_INITIAL_CAPACITY);
-	ArenaAllocator packrat_allocator(Allocator::DefaultAllocator(), PARSER_ARENA_INITIAL_CAPACITY);
-	ParserPackratCache packrat_cache(packrat_allocator, token_iterator.Position(), token_iterator.Size());
-	MatchContext match_context(suggestions, parse_result_allocator, process_allocator, max_token_index,
-	                           MatchMode::BUILD_PARSE_RESULT, options.identifier_case_mode, &packrat_cache);
-	MatchState state(token_iterator, match_context);
-	auto match_result = grammar.TopLevelStatementMatcher().MatchParseResult(state);
-	process_allocator.FreeAll();
-	if (!match_result.IsSuccess()) {
-		failure_index = state.GetMaxTokenIndex();
-		return nullptr;
-	}
-	D_ASSERT(match_result.HasParseResult());
+	auto match_result = MatcherResult::Failure();
+	{
+		// Match processes and packrat entries are no longer needed once the parse result is built.
+		// the packrat cache outlives the match processes, so they need separate arenas
+		ArenaAllocator process_allocator(allocator, PARSER_ARENA_INITIAL_CAPACITY);
+		ArenaAllocator packrat_allocator(allocator, PARSER_ARENA_INITIAL_CAPACITY);
+		ParserPackratCache packrat_cache(packrat_allocator, token_iterator.Position(), token_iterator.Size());
+		MatchContext match_context(suggestions, parse_result_allocator, process_allocator, max_token_index,
+		                           MatchMode::BUILD_PARSE_RESULT, options.identifier_case_mode, &packrat_cache);
+		MatchState state(token_iterator, match_context);
+		match_result = grammar.TopLevelStatementMatcher().MatchParseResult(state);
+		if (!match_result.IsSuccess()) {
+			failure_index = state.GetMaxTokenIndex();
+			return nullptr;
+		}
+		D_ASSERT(match_result.HasParseResult());
 
-	// Advance the caller's cursor past the consumed tokens.
-	token_iterator.SetPosition(state.token_iterator);
+		// Advance the caller's cursor past the consumed tokens.
+		token_iterator.SetPosition(state.token_iterator);
+	}
 
 	// TopLevelStatement <- Statement? (';'+ / EndOfInput)
 	//   child 0: Optional<Statement>
@@ -95,10 +102,15 @@ unique_ptr<SQLStatement> PEGTransformerFactory::TransformTopLevelStatement(Token
 		}
 	}
 
-	ArenaAllocator transformer_allocator(Allocator::DefaultAllocator(), PARSER_ARENA_INITIAL_CAPACITY);
+	ArenaAllocator transformer_allocator(allocator, PARSER_ARENA_INITIAL_CAPACITY);
 	PEGTransformer transformer(transformer_allocator, token_iterator, options, grammar);
 
 	return ExtractAndTransformStatement(transformer, token_iterator, stmt_opt.GetResult(), terminator_offset);
+} catch (const OutOfMemoryException &ex) {
+	if (!options.context) {
+		throw;
+	}
+	throw OutOfMemoryException("While parsing SQL: %s", ErrorData(ex).RawMessage());
 }
 
 PEGTransformerFactory::PEGTransformerFactory(ParsedGrammar &grammar_p) : grammar(grammar_p) {
```

**File**: `test/api/test_grammar_extension.cpp` (modified, +49/-0)
```diff
@@ -8,6 +8,7 @@
 #include "duckdb/common/limits.hpp"
 #include "duckdb/main/parse_iterator.hpp"
 #include "duckdb/main/settings.hpp"
+#include "duckdb/storage/buffer_manager.hpp"
 #include "duckdb/parser/expression/constant_expression.hpp"
 #include "duckdb/parser/grammar_extension.hpp"
 #include "duckdb/parser/parser.hpp"
@@ -3735,3 +3736,51 @@ TEST_CASE("The parser's tokens keep the literal info the tokenizer cached", "[ap
 	REQUIRE_FALSE(borrowing_iterator.GetToken(0).HasLiteralInfo(table));
 	REQUIRE(borrowed[0].GetLiteralInfo(table).LiteralId() == table.Lookup("SELECT").LiteralId());
 }
+
+class MemoryLimitGrammarExtension final : public GrammarExtension {
+public:
+	MemoryLimitGrammarExtension() : GrammarExtension("memory_limit_test", "ARENA_MEMORY") {
+	}
+
+	vector<GrammarChange> GetChanges() const override {
+		vector<GrammarChange> changes;
+		changes.push_back(GrammarChange::AddRule(
+		    "ArenaMemoryStatement <- 'ARENA_MEMORY'",
+		    [this](PEGTransformer &transformer, ParseResult &) -> arena_ptr<TransformProcess> {
+			    transform_calls++;
+			    auto &buffer_manager = transformer.options.context->GetBufferManager();
+			    transformer.GetAllocator().Allocate(buffer_manager.GetMaxMemory());
+			    throw InternalException("Transform arena allocation unexpectedly exceeded the memory limit");
+		    }));
+		changes.push_back(GrammarChange::PrependChoice("Statement", "ArenaMemoryStatement"));
+		return changes;
+	}
+
+	mutable idx_t transform_calls = 0;
+};
+
+TEST_CASE("Top-level transform arenas honor the database memory limit", "[api][grammar_extension]") {
+	DuckDB db(nullptr);
+	Connection con(db);
+	auto extension = make_shared_ptr<MemoryLimitGrammarExtension>();
+	GrammarExtension::Register(*db.instance, extension);
+	REQUIRE_NO_FAIL(con.Query("SET active_grammar_extensions=['memory_limit_test']"));
+	REQUIRE_NO_FAIL(con.Query("SET memory_limit='16MB'"));
+	auto &buffer_manager = BufferManager::GetBufferManager(*con.context);
+	const auto memory_before = buffer_manager.GetUsedMemory();
+	for (idx_t attempt = 0; attempt < 2; attempt++) {
+		auto result = con.Query("ARENA_MEMORY");
+		REQUIRE(result->HasError());
+		REQUIRE(result->GetErrorType() == ExceptionType::OUT_OF_MEMORY);
+		REQUIRE(extension->transform_calls == attempt + 1);
+		REQUIRE(buffer_manager.GetUsedMemory() == memory_before);
+		REQUIRE_NO_FAIL(con.Query("SELECT 42"));
+	}
+	Parser parser(*con.context);
+	try {
+		parser.ParseQuery("ARENA_MEMORY");
+		FAIL("Expected an out-of-memory exception during parsing");
+	} catch (const OutOfMemoryException &ex) {
+		REQUIRE(StringUtil::Contains(ErrorData(ex).RawMessage(), "While parsing SQL:"));
+	}
+}
```

**File**: `test/sql/json/peg_memory_limit.test` (added, +64/-0)
```diff
@@ -0,0 +1,64 @@
+# name: test/sql/json/peg_memory_limit.test
+# description: JSON SQL and type parsing preserve PEG out-of-memory errors
+# group: [json]
+
+require json
+
+statement ok
+SET VARIABLE oversized_statement = 'SELECT [' || repeat('1,', 400000) || '1]';
+
+statement ok
+SET VARIABLE oversized_type = (
+    SELECT '"STRUCT(' || string_agg('c' || i || ' INTEGER', ',') || ')"'
+    FROM range(10000) t(i)
+);
+
+statement ok
+SET memory_limit='16MB';
+
+statement ok
+SET VARIABLE parser_memory_before = (
+    SELECT memory_usage_bytes FROM duckdb_memory() WHERE tag='ALLOCATOR'
+);
+
+# Allocation failure must abort the query, rather than become a successful JSON error value.
+foreach serializer json_serialize_sql json_serialize_plan
+
+statement error
+SELECT {serializer}(getvariable('oversized_statement'));
+----
+<REGEX>:Out of Memory Error: While parsing SQL: failed to allocate data of size .* \(.*/.* used\).*
+
+query I
+SELECT memory_usage_bytes <= getvariable('parser_memory_before')
+FROM duckdb_memory() WHERE tag='ALLOCATOR';
+----
+true
+
+endloop
+
+# Type parsing must preserve OOM instead of reporting an invalid type name.
+statement error
+SELECT json_transform('{}', getvariable('oversized_type'));
+----
+<REGEX>:Out of Memory Error: While parsing SQL: failed to allocate data of size .* \(.*/.* used\).*
+
+query I
+SELECT memory_usage_bytes <= getvariable('parser_memory_before')
+FROM duckdb_memory() WHERE tag='ALLOCATOR';
+----
+true
+
+# Ordinary parse errors still use the existing JSON error-value contract.
+query TT
+SELECT json_serialize_sql('SELECT') ->> 'error', json_serialize_sql('SELECT') ->> 'error_type';
+----
+true	parser
+
+query I
+SELECT 42;
+----
+42
+
+statement ok
+RESET memory_limit;
```

---

### Incident Patch 3: `8b2341c3` (2026-11-23)
**Commit Message**: Narrow full joins before pushing down null-rejecting filters (#29195)

## Problem

A query using `FULL JOIN ... WHERE a.age <= 25` can read every Parquet
row group even when the equivalent `LEFT JOIN` prunes most of them.
DuckDB proves that the join can become a LEFT join after the general
filter pushdown pass has already visited it. The predicate ends up in a
separate filter above the scan. See
[duckdb/duckdb#29171](https://github.com/duckdb/duckdb/issues/29171).

## Change

During filter pushdown, reuse the existing NULL-rejection check for
predicates that reference a single input of a FULL comparison join. When
substituting NULLs for that input proves the predicate cannot be true,
narrow the join and use the existing LEFT or INNER pushdown path. A
right-preserving join swaps the inputs and comparison operands. The
rewrite respects the outer-join simplification setting and guards
against volatile or potentially throwing expressions.

The shared-key rewrite runs while the comparison join is still FULL. It
attaches a range on the coalesced equality key to both original inputs.
The remaining filters can then narrow the join without losing Parquet
row-group pruning, including when th

**File**: `src/optimizer/pushdown/pushdown_aggregate.cpp` (modified, +8/-7)
```diff
@@ -9,15 +9,16 @@ namespace duckdb {
 
 using Filter = FilterPushdown::Filter;
 
-static bool IsVolatile(LogicalAggregate &aggr, const Expression &expr) {
-	bool is_volatile = false;
+static bool CanInlineGroupBindings(LogicalAggregate &aggr, const Expression &expr) {
+	bool can_inline = true;
 	ExpressionIterator::VisitExpression<BoundColumnRefExpression>(expr, [&](const BoundColumnRefExpression &colref) {
 		D_ASSERT(colref.Depth() == 0);
-		if (aggr.GetExpression(colref.Binding()).IsVolatile()) {
-			is_volatile = true;
+		auto &group_expr = aggr.GetExpression(colref.Binding());
+		if (group_expr.IsVolatile() || group_expr.CanThrow()) {
+			can_inline = false;
 		}
 	});
-	return is_volatile;
+	return can_inline;
 }
 
 static unique_ptr<Expression> ReplaceGroupBindings(LogicalAggregate &aggr, unique_ptr<Expression> root_expr) {
@@ -82,8 +83,8 @@ unique_ptr<LogicalOperator> FilterPushdown::PushdownAggregate(unique_ptr<Logical
 		if (!can_pushdown_filter) {
 			continue;
 		}
-		if (f.filter->IsVolatile() || IsVolatile(aggr, *f.filter)) {
-			// a volatile filter is evaluated once per group, not once per input row
+		if (f.filter->IsVolatile() || !CanInlineGroupBindings(aggr, *f.filter)) {
+			// Keep volatile evaluation counts and the rows seen by throwing group expressions unchanged.
 			continue;
 		}
 		// no aggregate! we can push this down
```

**File**: `src/optimizer/pushdown/pushdown_outer_join.cpp` (modified, +86/-22)
```diff
@@ -1,7 +1,13 @@
 #include "duckdb/optimizer/filter_pushdown.hpp"
 #include "duckdb/parser/expression_map.hpp"
+#include "duckdb/planner/expression/bound_between_expression.hpp"
+#include "duckdb/planner/expression/bound_columnref_expression.hpp"
+#include "duckdb/planner/expression/bound_comparison_expression.hpp"
 #include "duckdb/planner/expression/bound_constant_expression.hpp"
+#include "duckdb/planner/expression/bound_operator_expression.hpp"
+#include "duckdb/planner/expression/expression_barrier.hpp"
 #include "duckdb/planner/expression_iterator.hpp"
+#include "duckdb/planner/logical_operator_visitor.hpp"
 #include "duckdb/planner/operator/logical_comparison_join.hpp"
 
 namespace duckdb {
@@ -93,7 +99,7 @@ static bool ExprIsFunctionOnlyOf(const Expression &expr, const expression_set_t
 //! is a join condition of the form `l = r` where `l` and `r` are join keys for
 //! the left and right table respectively, then pushdown `P(l)` to the left
 //! table, `P(r)` to the right table, and remove the original filter.
-static bool
+static void
 PushDownFiltersOnCoalescedEqualJoinKeys(vector<unique_ptr<Filter>> &filters, vector<JoinCondition> &join_conditions,
                                         const std::function<void(unique_ptr<Expression> filter)> &pushdown_left,
                                         const std::function<void(unique_ptr<Expression> filter)> &pushdown_right) {
@@ -116,10 +122,9 @@ PushDownFiltersOnCoalescedEqualJoinKeys(vector<unique_ptr<Filter>> &filters, vec
 	}
 
 	if (join_cond_by_coalesced_join_keys.empty()) {
-		return false;
+		return;
 	}
 
-	bool has_applied_pushdown = false;
 	for (idx_t i = 0; i < filters.size(); i++) {
 		auto &filter = filters[i]->filter;
 		if (filter->IsVolatile() || filter->CanThrow()) {
@@ -164,38 +169,97 @@ PushDownFiltersOnCoalescedEqualJoinKeys(vector<unique_ptr<Filter>> &filters, vec
 		pushdown_left(std::move(left_filter));
 		pushdown_right(std::move(right_filter));
 		filters.erase_at(i);
-		has_applied_pushdown = true;
 		i--;
 	}
+}
 
-	return has_applied_pushdown;
+static bool CanSplitOuterJoinFilters(LogicalOperator &join, const vector<unique_ptr<Filter>> &filters) {
+	for (auto &filter : filters) {
+		if (filter->filter->IsVolatile() || filter->filter->CanThrow()) {
+			return false;
+		}
+	}
+	bool can_split = true;
+	LogicalOperatorVisitor::EnumerateExpressions(join, [&](unique_ptr<Expression> *expr) {
+		if ((*expr)->IsVolatile() || ExpressionBarrier::Contains(**expr)) {
+			can_split = false;
+		}
+	});
+	return can_split;
+}
+
+static void PushDownComparisonFilters(vector<unique_ptr<Filter>> &filters, const unordered_set<TableIndex> &bindings,
+                                      vector<unique_ptr<Expression>> &child_filters) {
+	auto is_non_null_constant = [](const Expression &expr) {
+		return expr.GetExpressionClass() == ExpressionClass::BOUND_CONSTANT &&
+		       !expr.Cast<BoundConstantExpression>().GetValue().IsNull();
+	};
+	for (auto &filter_ptr : filters) {
+		auto &filter = *filter_ptr;
+		auto &expr = *filter.filter;
+		optional_ptr<const Expression> column;
+		if (expr.GetExpressionType() == ExpressionType::COMPARE_BETWEEN) {
+			auto &between = expr.Cast<BoundFunctionExpression>();
+			if (!is_non_null_constant(BoundBetweenExpression::LowerBound(between)) ||
+			    !is_non_null_constant(BoundBetweenExpression::UpperBound(between))) {
+				continue;
+			}
+			column = BoundBetweenExpression::Input(between);
+		} else {
+			if (!BoundComparisonExpression::IsComparison(expr) ||
+			    expr.GetExpressionType() == ExpressionType::COMPARE_DISTINCT_FROM ||
+			    expr.GetExpressionType() == ExpressionType::COMPARE_NOT_DISTINCT_FROM) {
+				continue;
+			}
+			auto &comparison = expr.Cast<BoundFunctionExpression>();
+			auto &left = BoundComparisonExpression::Left(comparison);
+			auto &right = BoundComparisonExpression::Right(comparison);
+			const auto left_is_column = left.GetExpressionClass() == ExpressionClass::BOUND_COLUMN_REF;
+			column = left_is_column ? left : right;
+			if (!is_non_null_constant(left_is_column ? right : left)) {
+				continue;
+			}
+		}
+		if (column->GetExpressionClass() != ExpressionClass::BOUND_COLUMN_REF) {
+			continue;
+		}
+		auto &colref = column->Cast<BoundColumnRefExpression>();
+		if (colref.Depth() != 0 || !bindings.count(colref.Binding().table_index)) {
+			continue;
+		}
+		child_filters.push_back(std::move(filter.filter));
+		// Removing a match can create an unmatched row on the other side: reject its NULL-extended column.
+		filter.filter = make_uniq<BoundOperatorExpression>(ExpressionType::OPERATOR_IS_NOT_NULL, LogicalType::BOOLEAN,
+		                                                   column->Copy());
+		filter.ExtractBindings();
+	}
 }
 
 unique_ptr<LogicalOperator> FilterPushdown::PushdownOuterJoin(unique_ptr<LogicalOperator> op,
                                                               unordered_set<TableIndex> &left_bindings,
                                       
```

**File**: `src/optimizer/pushdown/pushdown_projection.cpp` (modified, +31/-25)
```diff
@@ -10,16 +10,20 @@
 
 namespace duckdb {
 
-static bool IsVolatile(LogicalProjection &proj, const Expression &expr) {
-	bool is_volatile = false;
-	ExpressionIterator::VisitExpression<BoundColumnRefExpression>(expr, [&](const BoundColumnRefExpression &colref) {
-		D_ASSERT(colref.Depth() == 0);
-		auto &proj_expr = proj.GetExpression(colref.Binding());
-		if (proj_expr.IsVolatile()) {
-			is_volatile = true;
-		}
-	});
-	return is_volatile;
+static bool CanPushProjectionFilter(LogicalProjection &proj, const FilterPushdown::Filter &filter) {
+	if (filter.filter->CanThrow() && !filter.has_barrier) {
+		return false;
+	}
+	bool can_push = true;
+	ExpressionIterator::VisitExpression<BoundColumnRefExpression>(
+	    *filter.filter, [&](const BoundColumnRefExpression &colref) {
+		    D_ASSERT(colref.Depth() == 0);
+		    auto &proj_expr = proj.GetExpression(colref.Binding());
+		    if (proj_expr.IsVolatile()) {
+			    can_push = false;
+		    }
+	    });
+	return can_push;
 }
 
 // A compress expression only holds where it was placed, so a filter must not inline it into a position below
@@ -34,16 +38,20 @@ static bool ReferencesCompressExpression(LogicalProjection &proj, const Expressi
 	return references_compress_expression;
 }
 
-static bool ReferencesComputedExpression(LogicalProjection &proj, const Expression &expr) {
-	bool references_computed_expression = false;
-	ExpressionIterator::VisitExpression<BoundColumnRefExpression>(expr, [&](const BoundColumnRefExpression &colref) {
-		D_ASSERT(colref.Depth() == 0);
-		auto &proj_expr = proj.GetExpression(colref.Binding());
-		if (proj_expr.GetExpressionClass() != ExpressionClass::BOUND_COLUMN_REF) {
-			references_computed_expression = true;
-		}
-	});
-	return references_computed_expression;
+static bool NeedsProjectionSplit(LogicalProjection &proj, const FilterPushdown::Filter &filter,
+                                 FilterPushdown::ProjectionMode projection_mode) {
+	bool needs_split = false;
+	ExpressionIterator::VisitExpression<BoundColumnRefExpression>(
+	    *filter.filter, [&](const BoundColumnRefExpression &colref) {
+		    D_ASSERT(colref.Depth() == 0);
+		    auto &proj_expr = proj.GetExpression(colref.Binding());
+		    if ((!filter.has_barrier && proj_expr.CanThrow()) ||
+		        (projection_mode == FilterPushdown::ProjectionMode::PRESERVE_COMPUTED_EXPRESSIONS &&
+		         proj_expr.GetExpressionClass() != ExpressionClass::BOUND_COLUMN_REF)) {
+			    needs_split = true;
+		    }
+	    });
+	return needs_split;
 }
 
 static unique_ptr<Expression> CreateColumnReference(const Expression &expr, ColumnBinding binding) {
@@ -168,12 +176,10 @@ unique_ptr<LogicalOperator> FilterPushdown::PushdownProjection(unique_ptr<Logica
 	vector<unique_ptr<Expression>> remain_expressions;
 	vector<unique_ptr<Expression>> split_expressions;
 	auto stays_on_top = [&](const Filter &f) {
-		return IsVolatile(proj, *f.filter) || ReferencesCompressExpression(proj, *f.filter) ||
-		       (f.filter->CanThrow() && !f.has_barrier);
+		return !CanPushProjectionFilter(proj, f) || ReferencesCompressExpression(proj, *f.filter);
 	};
 	auto splits_off = [&](const Filter &f) {
-		return projection_mode == ProjectionMode::PRESERVE_COMPUTED_EXPRESSIONS &&
-		       ReferencesComputedExpression(proj, *f.filter);
+		return NeedsProjectionSplit(proj, f, projection_mode);
 	};
 	// barred expressions may only cross the projection if every other filter does: a filter kept on top of the
 	// projection, or split off below it, would otherwise be evaluated after them
@@ -187,7 +193,7 @@ unique_ptr<LogicalOperator> FilterPushdown::PushdownProjection(unique_ptr<Logica
 		auto &f = *filter;
 		D_ASSERT(f.bindings.size() <= 1);
 		if (stays_on_top(f) || (f.has_barrier && hold_back_barriers)) {
-			// Volatile and throwing expressions and filters over compressed columns cannot move across the
+			// Volatile inputs, throwing filters and filters over compressed columns cannot move across the
 			// projection. Expressions carrying a barrier are the exception: a projection does not remove any rows,
 			// so pushing them through it does not change which rows they are evaluated on - unless another filter
 			// stays behind, see above.
```

**File**: `test/optimizer/full_join_filter_pushdown.test` (added, +270/-0)
```diff
@@ -0,0 +1,270 @@
+# name: test/optimizer/full_join_filter_pushdown.test
+# description: Push comparisons into FULL join inputs while retaining NULL rejection
+# group: [optimizer]
+
+statement ok
+CREATE TABLE lhs (id INTEGER, la INTEGER);
+CREATE TABLE rhs (id INTEGER, ra INTEGER);
+INSERT INTO lhs VALUES (1, 20), (2, 30), (3, NULL), (4, 25);
+INSERT INTO rhs VALUES (1, 20), (1, 21), (2, 40), (3, NULL), (5, 25);
+
+query II
+EXPLAIN SELECT l.id, r.id FROM lhs l FULL JOIN rhs r ON l.id = r.id WHERE l.la <= 25;
+----
+physical_plan	<REGEX>:.*Filters:.*la <= 25.*
+
+query III
+SELECT l.id, r.id, r.ra FROM lhs l FULL JOIN rhs r ON l.id = r.id WHERE l.la <= 25 ORDER BY 1, 2, 3;
+----
+1	1	20
+1	1	21
+4	NULL	NULL
+
+query II
+EXPLAIN SELECT l.id, r.id FROM lhs l FULL JOIN rhs r ON l.id = r.id WHERE r.ra <= 25;
+----
+physical_plan	<REGEX>:.*Filters:.*ra <= 25.*
+
+query III
+SELECT l.id, r.id, r.ra FROM lhs l FULL JOIN rhs r ON l.id = r.id WHERE r.ra <= 25 ORDER BY 1, 2, 3;
+----
+1	1	20
+1	1	21
+NULL	5	25
+
+query II
+EXPLAIN SELECT l.id, r.id FROM lhs l FULL JOIN rhs r ON l.id = r.id WHERE l.la <= 25 AND r.ra <= 25;
+----
+physical_plan	<REGEX>:.*Join Type: INNER.*
+
+query III
+SELECT l.id, r.id, r.ra FROM lhs l FULL JOIN rhs r ON l.id = r.id
+WHERE l.la <= 25 AND r.ra <= 25 ORDER BY 1, 2, 3;
+----
+1	1	20
+1	1	21
+
+query II
+SELECT l.id, r.id FROM lhs l FULL JOIN rhs r ON l.id = r.id WHERE l.la IS NULL ORDER BY 1, 2;
+----
+3	3
+NULL	5
+
+# Simple projections and reversed operands retain the original output bindings.
+query IIII
+SELECT r.ra, l.k, r.id, l.a
+FROM (SELECT la AS a, id AS k FROM lhs) l FULL JOIN rhs r ON l.k = r.id
+WHERE 25 >= l.a ORDER BY l.k, r.ra;
+----
+20	1	1	20
+21	1	1	20
+NULL	4	NULL	25
+
+# The ordinary outer-join simplifier still narrows a one-sided predicate.
+query II
+EXPLAIN SELECT l.id, r.id FROM lhs l FULL JOIN rhs r ON l.id = r.id WHERE l.la <= 25;
+----
+physical_plan	<REGEX>:.*Join Type: (LEFT|RIGHT).*
+
+statement ok
+SET disabled_optimizers = 'outer_join_simplification';
+
+query II
+EXPLAIN SELECT l.id, r.id FROM lhs l FULL JOIN rhs r ON l.id = r.id WHERE l.la <= 25;
+----
+physical_plan	<REGEX>:.*la IS NOT NULL.*Join Type: FULL.*Filters:.*la <= 25.*
+
+query II
+EXPLAIN SELECT l.k, r.id
+FROM (SELECT la AS a, id AS k FROM lhs) l FULL JOIN rhs r ON l.k = r.id WHERE 25 >= l.a;
+----
+physical_plan	<REGEX>:.*Join Type: FULL.*Filters:.*la <= 25.*
+
+# Removing the last match must not leave a new unmatched row from the other input.
+query III
+SELECT l.id, r.id, r.ra FROM lhs l FULL JOIN rhs r ON l.id = r.id
+WHERE l.la <= 25 ORDER BY 1, 2, 3;
+----
+1	1	20
+1	1	21
+4	NULL	NULL
+
+query III
+SELECT l.id, r.id, r.ra FROM lhs l FULL JOIN rhs r ON l.id = r.id
+WHERE 25 >= r.ra ORDER BY 1, 2, 3;
+----
+1	1	20
+1	1	21
+NULL	5	25
+
+query III
+SELECT l.id, r.id, r.ra FROM lhs l FULL JOIN rhs r ON l.id = r.id
+WHERE l.la <= 25 AND r.ra <= 25 ORDER BY 1, 2, 3;
+----
+1	1	20
+1	1	21
+
+# The residual also protects matches removed from a non-equality FULL join.
+query II
+SELECT l.id, r.id FROM lhs l FULL JOIN rhs r ON l.id < r.id
+WHERE l.la > 25 ORDER BY 1, 2;
+----
+2	3
+2	5
+
+# Paired bounds are combined into BETWEEN before filter pushdown.
+query II
+SELECT l.id, r.id FROM lhs l FULL JOIN rhs r ON l.id = r.id
+WHERE l.la >= 20 AND l.la < 25 ORDER BY 1, 2;
+----
+1	1
+1	1
+
+# Multiple predicates on one column retain all comparisons.
+query II
+SELECT l.id, r.id FROM lhs l FULL JOIN rhs r ON l.id = r.id
+WHERE l.la <= 25 AND l.la <> 20 ORDER BY 1, 2;
+----
+4	NULL
+
+# A one-sided ON condition uses a regular ANY join.
+query II
+EXPLAIN SELECT l.id, r.id FROM lhs l FULL JOIN rhs r ON l.id < 3 WHERE r.ra <= 25;
+----
+physical_plan	<REGEX>:.*Join Type: FULL.*Filters:.*ra <= 25.*
+
+query III
+SELECT l.id, r.id, r.ra FROM lhs l FULL JOIN rhs r ON l.id < 3
+WHERE r.ra <= 25 ORDER BY 1, 2, 3;
+----
+1	1	20
+1	1	21
+1	5	25
+2	1	20
+2	1	21
+2	5	25
+
+query I
+SELECT count(*) FROM lhs l FULL JOIN rhs r USING (id)
+WHERE id BETWEEN 1 AND 2 AND l.id > 2;
+----
+0
+
+# NULL-safe comparisons must retain their original NULL behavior.
+query II
+SELECT l.id, r.id FROM lhs l FULL JOIN rhs r ON l.id = r.id
+WHERE l.la IS NOT DISTINCT FROM NULL ORDER BY 1, 2;
+----
+3	3
+NULL	5
+
+query II
+SELECT l.id, r.id FROM lhs l FULL JOIN rhs r ON l.id = r.id
+WHERE l.la IS DISTINCT FROM 25 ORDER BY 1, 2;
+----
+1	1
+1	1
+2	2
+3	3
+NULL	5
+
+# A synthesized row must not reach a throwing sibling before the NULL check.
+statement ok
+CREATE TABLE match_rhs AS SELECT * FROM rhs WHERE id < 5;
+
+query II
+EXPLAIN SELECT l.id, r.id FROM lhs l FULL JOIN match_rhs r ON l.id = r.id
+WHERE l.la <= 25 AND CASE WHEN l.id IS NULL THEN (r.ra * 1000)::TINYINT ELSE 0 END = 0;
+----
+physical_plan	<!REGEX>:.*Filters:.*la <= 25.*
+
+query II
+SELECT l.id, r.id FROM lhs l FULL JOIN match_rhs r ON l.id = r.id
+WHERE l.la <= 25 AND CASE WHEN l.id IS NULL THEN (r.ra * 1000)::TINYINT ELSE 0 END = 0
+ORDER BY 1, 2;
+----
+1	1
+
```

**File**: `test/optimizer/pushdown/full_join_shared_key_range.test` (added, +107/-0)
```diff
@@ -0,0 +1,107 @@
+# name: test/optimizer/pushdown/full_join_shared_key_range.test
+# description: FULL join pushdown preserves shared-key and one-sided scan pruning
+# group: [pushdown]
+
+require parquet
+
+statement ok
+SET threads = 1;
+
+statement ok
+COPY (SELECT i AS id, (i % 40)::INTEGER AS age FROM range(16384) t(i) ORDER BY i)
+TO '{TEST_DIR}/full_join_shared_key_range.parquet' (FORMAT PARQUET, ROW_GROUP_SIZE 2048);
+
+statement ok
+CREATE VIEW ages AS SELECT * FROM read_parquet('{TEST_DIR}/full_join_shared_key_range.parquet');
+
+query II
+EXPLAIN (ANALYZE, FORMAT JSON)
+SELECT id FROM ages l FULL JOIN ages r USING (id)
+WHERE id BETWEEN 100 AND 106 AND l.age <= 25 ORDER BY id;
+----
+analyzed_plan	<REGEX>:.*"row_groups_scanned": 1,.*"row_groups_scanned": 1,.*
+
+query II
+EXPLAIN (ANALYZE, FORMAT JSON)
+SELECT id FROM ages l FULL JOIN ages r USING (id)
+WHERE id BETWEEN 100 AND 106 AND r.age <= 25 ORDER BY id;
+----
+analyzed_plan	<REGEX>:.*"row_groups_scanned": 1,.*"row_groups_scanned": 1,.*
+
+query II
+EXPLAIN (ANALYZE, FORMAT JSON)
+SELECT id FROM ages l FULL JOIN ages r USING (id)
+WHERE id BETWEEN 100 AND 106 AND l.age <= 25 AND r.age <= 25 ORDER BY id;
+----
+analyzed_plan	<REGEX>:.*"row_groups_scanned": 1,.*"row_groups_scanned": 1,.*
+
+query I
+SELECT id FROM ages l FULL JOIN ages r USING (id)
+WHERE id BETWEEN 100 AND 106 AND l.age <= 25 AND r.age <= 25 ORDER BY id;
+----
+100
+101
+102
+103
+104
+105
+
+# Cluster age independently of the original fixture's repeating values.
+statement ok
+COPY (SELECT i AS id, i::INTEGER AS age FROM range(16384) t(i) ORDER BY age)
+TO '{TEST_DIR}/full_join_age_range.parquet' (FORMAT PARQUET, ROW_GROUP_SIZE 2048);
+CREATE VIEW sorted_ages AS SELECT * FROM read_parquet('{TEST_DIR}/full_join_age_range.parquet');
+CREATE TABLE other_ids AS SELECT i AS id FROM range(16384) t(i);
+
+# Identify the Parquet input by its eight row groups; age alone must prune it.
+query II
+EXPLAIN (ANALYZE, FORMAT JSON)
+SELECT count(*) FROM sorted_ages l FULL JOIN other_ids r USING (id) WHERE l.age < 2048;
+----
+analyzed_plan	<REGEX>:.*"row_groups_scanned": 1,[^{}]*"total_row_groups_to_scan": 8,.*
+
+query II
+EXPLAIN (ANALYZE, FORMAT JSON)
+SELECT count(*) FROM other_ids l FULL JOIN sorted_ages r USING (id) WHERE r.age < 2048;
+----
+analyzed_plan	<REGEX>:.*"row_groups_scanned": 1,[^{}]*"total_row_groups_to_scan": 8,.*
+
+query II
+EXPLAIN (ANALYZE, FORMAT JSON)
+SELECT count(*) FROM sorted_ages l LEFT JOIN other_ids r USING (id) WHERE l.age < 2048;
+----
+analyzed_plan	<REGEX>:.*"row_groups_scanned": 1,[^{}]*"total_row_groups_to_scan": 8,.*
+
+# Keep the FULL join while checking BETWEEN and combined-filter pruning.
+statement ok
+SET disabled_optimizers = 'outer_join_simplification';
+
+query II
+EXPLAIN (ANALYZE, FORMAT JSON)
+SELECT count(*) FROM sorted_ages l FULL JOIN other_ids r USING (id)
+WHERE l.age >= 2048 AND l.age < 4096;
+----
+analyzed_plan	<REGEX>:.*"row_groups_scanned": 1,[^{}]*"total_row_groups_to_scan": 8,.*
+
+query I
+SELECT count(*) FROM sorted_ages l FULL JOIN other_ids r USING (id)
+WHERE l.age >= 2048 AND l.age < 4096;
+----
+2048
+
+# The shared key admits two groups; age must remove one more on the affected input.
+query II
+EXPLAIN (ANALYZE, FORMAT JSON)
+SELECT count(*) FROM sorted_ages l FULL JOIN sorted_ages r USING (id)
+WHERE id BETWEEN 0 AND 4095 AND l.age < 2048;
+----
+analyzed_plan	<REGEX>:.*("row_groups_scanned": 1,.*"row_groups_scanned": 2,|"row_groups_scanned": 2,.*"row_groups_scanned": 1,).*
+
+query I
+SELECT count(*) FROM sorted_ages l FULL JOIN sorted_ages r USING (id)
+WHERE id BETWEEN 0 AND 4095 AND l.age < 2048;
+----
+2048
+
+statement ok
+RESET disabled_optimizers;
```

**File**: `test/sql/cte/materialized/cte_filter_pusher.test` (modified, +2/-2)
```diff
@@ -94,7 +94,7 @@ WHERE x < 10;
 ----
 288
 
-# Ordinary filter pushdown still moves computed predicates below unrelated projection expressions
+# Ordinary filter pushdown also splits throwing inputs from unrelated projection expressions
 query II
 EXPLAIN SELECT sum(length(payload))
 FROM (
@@ -103,7 +103,7 @@ FROM (
 ) sq
 WHERE x < 10;
 ----
-logical_opt	<REGEX>:(?s).*Expressions: payload.*Expressions: \(i \+ 1\) < 10.*Range.*
+logical_opt	<REGEX>:(?s).*Expressions: payload.*Expressions: x < 10.*Expressions: x, i.*Range.*
 
 # Preserve NULLs and duplicates while splitting a computed projection
 statement ok
```

**File**: `test/sql/optimizer/barrier_projection_siblings.test` (modified, +11/-0)
```diff
@@ -96,3 +96,14 @@ WITH computed AS MATERIALIZED (
 SELECT sum(v) FROM computed WHERE k=2
 ----
 1
+
+# Throwing filter inputs also permit splitting ordinary projections.
+query I
+SELECT sum(v)
+FROM (
+    SELECT i+1 AS k, CASE WHEN i=0 THEN error('filtered projection') ELSE i END AS v
+    FROM pushdown_rows
+) computed
+WHERE k=2
+----
+1
```

**File**: `test/sql/optimizer/test_no_pushdown_cast_into_cte.test` (modified, +2/-2)
```diff
@@ -43,7 +43,7 @@ SELECT a, b
 FROM   t
 WHERE  a < b;
 ----
-logical_opt	<REGEX>:.*FILTER.*CAST\(a AS INTEGER.*<.*b AS INTEGER\).*FILTER.*position.*
+logical_opt	<REGEX>:.*FILTER.*a < b.*PROJECTION.*CAST\(a AS INTEGER\).*CAST\(b AS INTEGER\).*FILTER.*position.*
 
 
 # INT can always be cast to varchar, so the filter a[1] = '1'
@@ -106,4 +106,4 @@ where mycolname[1:3] != 'xxx' AND mycolname2 = 0 limit 5;
 0
 0
 0
-0
\ No newline at end of file
+0
```

#### Recent Merged Pull Requests:
- **PR #29244** (2026-11-23): Cache sort-key suffixes during merging (@lnkuiper)
- **PR #29242** (2026-11-23): Move DateTruncSimplificationRule::DatePartToFunc into its own file (@carlopi)
- **PR #29241** (2026-11-23): Declare thread_id in namespace duckdb when threads are disabled (@carlopi)
- **PR #29238** (2026-11-23): Make transaction-local state safe for concurrent statements of one transaction (@Robinho-MR)
- **PR #29236** (2026-11-23): GrammarChange: expose Collapsible(), SuppressSuggestions() and HasCode() (@carlopi)
- **PR #29235** (2026-11-23): Add `duckdb_grammar_changes()`, listing the changes of the active grammar extensions (@carlopi)

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

## X. runtime memory management for growing perfect-hash aggregates

**RULE**:
When implementing operations in `src/execution/physical_plan/plan_aggregate.cpp`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in duckdb/duckdb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `52dac04d`: runtime memory management for growing perfect-hash aggregates. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/execution/physical_plan/plan_aggregate.cpp`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
		const auto &function = aggregate.Function();
		if (aggregate.IsDistinct() || !function.HasStateCombineCallback()) {
			return false;
		}
		if (!function.HasGetStateTypeCallback() || function.HasStateDestructorCallback()) {
			return false;
		}
		const auto layout = function.GetStateType(aggregate.BindInfo().get());
		// Preserve min/max and fixed-size sketch fast paths, excluding sorted aggregate buffers.
		const auto &name = function.GetName();
		if (function.GetArguments().size() == 1 && layout.field.kind != AggregateFieldKind::LIST &&
		    (name == "min" || name == "max" || name == "approx_count_distinct")) {
			continue;
		}
		if (function.HasExportAggregateStateCallback() || function.HasImportAggregateStateCallback() ||
		    !layout.field.IsFixedSize(layout.type)) {
```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
		if (aggregate.IsDistinct() || !aggregate.Function().HasStateCombineCallback()) {
			// distinct aggregates are not supported in perfect hash aggregates
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `52dac04d` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
